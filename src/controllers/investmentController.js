// src/controllers/investmentController.js
// Controller pour gestion investissements - FinApp Haiti
// Version complète avec analytics et performance tracking

const { body, validationResult, param, query } = require('express-validator');
const mongoose = require('mongoose');
const Investment = require('../models/Investment');
const User = require('../models/User');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');

class InvestmentController {

  // ===================================================================
  // 1. CRÉATION INVESTISSEMENT
  // ===================================================================

  static createInvestment = async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Données d\'investissement invalides',
          errors: errors.array()
        });
      }

      const {
        name, description, type, category, initialInvestment, currency,
        location, expectedDuration, projections, partners, risks, goals
      } = req.body;

      // Vérifier limite investissements actifs (optionnel)
      const activeInvestmentsCount = await Investment.countDocuments({
        user: req.user.userId,
        isActive: true
      });

      if (activeInvestmentsCount >= 20) {
        return res.status(400).json({
          success: false,
          message: 'Limite de 20 investissements actifs atteinte',
          error: 'max_active_investments_exceeded'
        });
      }

      // Créer investissement
      const investment = new Investment({
        user: req.user.userId,
        name,
        description,
        type,
        category,
        initialInvestment,
        currency: currency || 'HTG',
        location,
        expectedDuration,
        projections,
        partners: partners || [],
        risks: risks || [],
        goals: goals || {},
        status: 'planning',
        startDate: new Date()
      });

      await investment.save();

      res.status(201).json({
        success: true,
        message: 'Investissement créé avec succès',
        data: {
          investment: investment.toObject({ virtuals: true }),
          nextSteps: [
            'Définir les objectifs financiers',
            'Identifier les risques potentiels',
            'Ajouter des partenaires si nécessaire',
            'Commencer le suivi des revenus/dépenses'
          ]
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur création investissement:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la création de l\'investissement',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  // ===================================================================
  // 2. RÉCUPÉRER INVESTISSEMENTS UTILISATEUR
  // ===================================================================

  static getUserInvestments = async (req, res) => {
    try {
      const { 
        status = 'all',
        type,
        isActive,
        page = 1,
        limit = 20,
        sortBy = 'lastUpdateDate',
        sortOrder = 'desc',
        includeAnalytics = false
      } = req.query;

      // Construction filtre
      const filter = { user: req.user.userId };

      if (status !== 'all') {
        filter.status = status;
      }

      if (type) {
        filter.type = type;
      }

      if (isActive !== undefined) {
        filter.isActive = isActive === 'true';
      }

      // Pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

      // Récupérer investissements
      const [investments, totalCount] = await Promise.all([
        Investment.find(filter)
          .populate('partners.user', 'firstName lastName')
          .sort(sortOptions)
          .skip(skip)
          .limit(parseInt(limit)),
        Investment.countDocuments(filter)
      ]);

      // Enrichir avec virtuels
      const enrichedInvestments = investments.map(inv => 
        inv.toObject({ virtuals: true })
      );

      // Calculer summary
      const summary = {
        totalInvestments: totalCount,
        activeInvestments: await Investment.countDocuments({ 
          user: req.user.userId, 
          isActive: true 
        }),
        totalInvested: enrichedInvestments.reduce((sum, inv) => sum + inv.totalInvested, 0),
        totalCurrentValue: enrichedInvestments.reduce((sum, inv) => sum + inv.currentValue, 0),
        totalProfit: enrichedInvestments.reduce((sum, inv) => sum + inv.netProfit, 0)
      };

      const response = {
        success: true,
        data: {
          investments: enrichedInvestments,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalCount / parseInt(limit)),
            totalItems: totalCount,
            itemsPerPage: parseInt(limit)
          },
          summary
        },
        timestamp: new Date().toISOString()
      };

      // Ajouter analytics si demandé
      if (includeAnalytics === 'true') {
        const analytics = await this.calculatePortfolioAnalytics(req.user.userId);
        response.data.analytics = analytics;
      }

      res.status(200).json(response);

    } catch (error) {
      console.error('❌ Erreur récupération investissements:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des investissements',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  // ===================================================================
  // 3. RÉCUPÉRER UN INVESTISSEMENT SPÉCIFIQUE
  // ===================================================================

  static getInvestmentById = async (req, res) => {
    try {
      const { investmentId } = req.params;
      const { includeHistory = false } = req.query;

      const investment = await Investment.findOne({
        _id: investmentId,
        user: req.user.userId
      }).populate('partners.user', 'firstName lastName email');

      if (!investment) {
        return res.status(404).json({
          success: false,
          message: 'Investissement non trouvé',
          error: 'investment_not_found'
        });
      }

      const response = {
        success: true,
        data: {
          investment: investment.toObject({ virtuals: true })
        },
        timestamp: new Date().toISOString()
      };

      // Ajouter historique transactions si demandé
      if (includeHistory === 'true') {
        const relatedTransactions = await Transaction.find({
          user: req.user.userId,
          'metadata.investmentId': investmentId
        })
        .sort({ date: -1 })
        .limit(50);

        response.data.transactionHistory = relatedTransactions;
      }

      res.status(200).json(response);

    } catch (error) {
      console.error('❌ Erreur récupération investissement:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération de l\'investissement',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  // ===================================================================
  // 4. METTRE À JOUR INVESTISSEMENT
  // ===================================================================

  static updateInvestment = async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Données de mise à jour invalides',
          errors: errors.array()
        });
      }

      const { investmentId } = req.params;
      const updateData = req.body;

      // Trouver investissement
      const investment = await Investment.findOne({
        _id: investmentId,
        user: req.user.userId
      });

      if (!investment) {
        return res.status(404).json({
          success: false,
          message: 'Investissement non trouvé',
          error: 'investment_not_found'
        });
      }

      // Champs modifiables
      const allowedUpdates = [
        'name', 'description', 'category', 'location',
        'expectedDuration', 'projections', 'goals', 'status'
      ];

      Object.keys(updateData).forEach(key => {
        if (allowedUpdates.includes(key)) {
          investment[key] = updateData[key];
        }
      });

      investment.lastUpdateDate = new Date();
      await investment.save();

      res.status(200).json({
        success: true,
        message: 'Investissement mis à jour avec succès',
        data: {
          investment: investment.toObject({ virtuals: true })
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur mise à jour investissement:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la mise à jour de l\'investissement',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  // ===================================================================
  // 5. AJOUTER REVENU
  // ===================================================================

  static addRevenue = async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Données de revenu invalides',
          errors: errors.array()
        });
      }

      const { investmentId } = req.params;
      const { amount, description, source, date, isRecurring, recurringFrequency } = req.body;

      const investment = await Investment.findOne({
        _id: investmentId,
        user: req.user.userId
      });

      if (!investment) {
        return res.status(404).json({
          success: false,
          message: 'Investissement non trouvé',
          error: 'investment_not_found'
        });
      }

      // Ajouter revenu
      await investment.addRevenue({
        amount,
        description,
        source: source || 'sales',
        date: date || new Date(),
        isRecurring: isRecurring || false,
        recurringFrequency
      });

      res.status(200).json({
        success: true,
        message: 'Revenu ajouté avec succès',
        data: {
          investment: investment.toObject({ virtuals: true }),
          newRevenue: {
            amount,
            description,
            date: date || new Date()
          }
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur ajout revenu:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'ajout du revenu',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  // ===================================================================
  // 6. AJOUTER DÉPENSE
  // ===================================================================

  static addExpense = async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Données de dépense invalides',
          errors: errors.array()
        });
      }

      const { investmentId } = req.params;
      const { amount, description, category, date, isRecurring, recurringFrequency } = req.body;

      const investment = await Investment.findOne({
        _id: investmentId,
        user: req.user.userId
      });

      if (!investment) {
        return res.status(404).json({
          success: false,
          message: 'Investissement non trouvé',
          error: 'investment_not_found'
        });
      }

      // Ajouter dépense
      await investment.addExpense({
        amount,
        description,
        category: category || 'operational',
        date: date || new Date(),
        isRecurring: isRecurring || false,
        recurringFrequency
      });

      res.status(200).json({
        success: true,
        message: 'Dépense ajoutée avec succès',
        data: {
          investment: investment.toObject({ virtuals: true }),
          newExpense: {
            amount,
            description,
            category,
            date: date || new Date()
          }
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur ajout dépense:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'ajout de la dépense',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  // ===================================================================
  // 7. GÉRER PARTENAIRES
  // ===================================================================

  static addPartner = async (req, res) => {
    try {
      const { investmentId } = req.params;
      const { userId, percentage, role, investmentAmount, joinDate } = req.body;

      const investment = await Investment.findOne({
        _id: investmentId,
        user: req.user.userId
      });

      if (!investment) {
        return res.status(404).json({
          success: false,
          message: 'Investissement non trouvé',
          error: 'investment_not_found'
        });
      }

      // Vérifier total pourcentages
      const totalPercentage = investment.partners.reduce((sum, p) => sum + p.percentage, 0) + percentage;
      
      if (totalPercentage > 100) {
        return res.status(400).json({
          success: false,
          message: 'Le total des pourcentages dépasse 100%',
          error: 'percentage_exceeded'
        });
      }

      // Vérifier si partenaire existe déjà
      const existingPartner = investment.partners.find(p => 
        p.user.toString() === userId
      );

      if (existingPartner) {
        return res.status(400).json({
          success: false,
          message: 'Ce partenaire existe déjà',
          error: 'partner_already_exists'
        });
      }

      // Ajouter partenaire
      investment.partners.push({
        user: userId,
        percentage,
        role: role || 'investor',
        investmentAmount: investmentAmount || 0,
        joinDate: joinDate || new Date()
      });

      await investment.save();

      res.status(200).json({
        success: true,
        message: 'Partenaire ajouté avec succès',
        data: {
          investment: investment.toObject({ virtuals: true })
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur ajout partenaire:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'ajout du partenaire',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  // ===================================================================
  // 8. ANALYTICS PORTFOLIO
  // ===================================================================

  static getPortfolioAnalytics = async (req, res) => {
    try {
      const analytics = await this.calculatePortfolioAnalytics(req.user.userId);

      res.status(200).json({
        success: true,
        data: {
          analytics,
          generatedAt: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur analytics portfolio:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors du calcul des analytics',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  // ===================================================================
  // 9. ANALYTICS PAR TYPE
  // ===================================================================

  static getAnalyticsByType = async (req, res) => {
    try {
      const analyticsByType = await Investment.getAnalyticsByType(req.user.userId);

      res.status(200).json({
        success: true,
        data: {
          analyticsByType,
          totalTypes: analyticsByType.length
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur analytics par type:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors du calcul des analytics par type',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  // ===================================================================
  // 10. INVESTISSEMENTS NÉCESSITANT ATTENTION
  // ===================================================================

  static getNeedingAttention = async (req, res) => {
    try {
      const needingAttention = await Investment.findNeedingAttention(req.user.userId);

      const categorized = {
        highRisk: needingAttention.filter(inv => inv.riskScore > 70),
        negativeROI: needingAttention.filter(inv => inv.actualROI < -10),
        outdated: needingAttention.filter(inv => {
          const sixMonthsAgo = new Date();
          sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
          return inv.lastUpdateDate < sixMonthsAgo;
        })
      };

      res.status(200).json({
        success: true,
        data: {
          totalNeedingAttention: needingAttention.length,
          categorized,
          allInvestments: needingAttention.map(inv => inv.toObject({ virtuals: true }))
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur investissements nécessitant attention:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  // ===================================================================
  // 11. ARCHIVER/COMPLÉTER INVESTISSEMENT
  // ===================================================================

  static archiveInvestment = async (req, res) => {
    try {
      const { investmentId } = req.params;
      const { reason = 'completed', notes } = req.body;

      const investment = await Investment.findOne({
        _id: investmentId,
        user: req.user.userId
      });

      if (!investment) {
        return res.status(404).json({
          success: false,
          message: 'Investissement non trouvé',
          error: 'investment_not_found'
        });
      }

      await investment.archive(reason);

      res.status(200).json({
        success: true,
        message: `Investissement ${reason === 'failed' ? 'marqué comme échoué' : 'archivé avec succès'}`,
        data: {
          investment: investment.toObject({ virtuals: true }),
          finalStats: {
            totalInvested: investment.totalInvested,
            finalValue: investment.currentValue,
            totalProfit: investment.netProfit,
            roi: investment.actualROI,
            duration: investment.ageInMonths
          }
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur archivage investissement:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'archivage',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  // ===================================================================
  // MÉTHODES UTILITAIRES
  // ===================================================================

  static async calculatePortfolioAnalytics(userId) {
    const [overview, byType] = await Promise.all([
      Investment.getPortfolioOverview(userId),
      Investment.getAnalyticsByType(userId)
    ]);

    const overviewData = overview[0] || {
      totalInvestments: 0,
      totalInvested: 0,
      totalCurrentValue: 0,
      totalRevenue: 0,
      totalExpenses: 0,
      avgROI: 0,
      profitableCount: 0
    };

    return {
      overview: {
        ...overviewData,
        netProfit: overviewData.totalRevenue - overviewData.totalExpenses,
        profitablePercentage: overviewData.totalInvestments > 0 
          ? (overviewData.profitableCount / overviewData.totalInvestments) * 100 
          : 0
      },
      byType,
      diversification: {
        typesCount: byType.length,
        dominantType: byType[0]?._id || 'none',
        diversificationScore: this.calculateDiversificationScore(byType)
      }
    };
  }

  static calculateDiversificationScore(byType) {
    if (byType.length === 0) return 0;
    if (byType.length === 1) return 20;
    if (byType.length === 2) return 40;
    if (byType.length === 3) return 60;
    if (byType.length === 4) return 80;
    return 100;
  }

  // ===================================================================
  // VALIDATION RULES
  // ===================================================================

  static validateCreateInvestment = [
    body('name')
      .notEmpty()
      .withMessage('Le nom de l\'investissement est requis')
      .isLength({ min: 3, max: 100 })
      .withMessage('Le nom doit contenir entre 3 et 100 caractères'),

    body('type')
      .notEmpty()
      .withMessage('Le type d\'investissement est requis')
      .isIn([
        'real_estate', 'agriculture', 'commerce', 'livestock', 
        'transport', 'services', 'technology', 'education', 'other'
      ])
      .withMessage('Type d\'investissement invalide'),

    body('initialInvestment')
      .notEmpty()
      .withMessage('Le montant initial est requis')
      .isFloat({ min: 0 })
      .withMessage('Le montant doit être positif'),

    body('currency')
      .optional()
      .isIn(['HTG', 'USD'])
      .withMessage('Devise invalide (HTG ou USD uniquement)')
  ];

  static validateAddRevenue = [
    body('amount')
      .notEmpty()
      .withMessage('Le montant du revenu est requis')
      .isFloat({ min: 0.01 })
      .withMessage('Le montant doit être positif'),

    body('description')
      .notEmpty()
      .withMessage('La description est requise')
      .isLength({ max: 200 })
      .withMessage('La description ne peut pas dépasser 200 caractères')
  ];

  static validateAddExpense = [
    body('amount')
      .notEmpty()
      .withMessage('Le montant de la dépense est requis')
      .isFloat({ min: 0.01 })
      .withMessage('Le montant doit être positif'),

    body('description')
      .notEmpty()
      .withMessage('La description est requise')
      .isLength({ max: 200 })
      .withMessage('La description ne peut pas dépasser 200 caractères')
  ];
}

module.exports = InvestmentController;