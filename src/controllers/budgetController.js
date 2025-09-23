// src/controllers/budgetController.js - Controller budgets FinApp Haiti
const Budget = require('../models/Budget');
const Transaction = require('../models/Transaction');
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');

/**
 * Controller pour la gestion des budgets
 * Inspiration de transactionController.js avec logique budgets
 */
class BudgetController {

  // ===================================================================
  // CRUD BUDGETS
  // ===================================================================

  /**
   * Créer un nouveau budget
   * POST /api/budgets
   */
  static async createBudget(req, res) {
    try {
      // Validation des erreurs
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Données de budget invalides',
          errors: errors.array()
        });
      }

      const budgetData = {
        ...req.body,
        user: req.user.userId
      };

      // Vérifier si budget existe déjà pour cette période
      const existingBudget = await Budget.findOne({
        user: req.user.userId,
        period: budgetData.period,
        startDate: { 
          $gte: new Date(budgetData.startDate).toISOString().slice(0, 7) + '-01' 
        },
        isActive: true
      });

      if (existingBudget) {
        return res.status(409).json({
          success: false,
          message: 'Un budget actif existe déjà pour cette période',
          existing_budget: {
            id: existingBudget._id,
            name: existingBudget.name,
            period: existingBudget.period
          }
        });
      }

      const budget = new Budget(budgetData);
      await budget.save();

      res.status(201).json({
        success: true,
        message: 'Budget créé avec succès',
        data: { budget }
      });

    } catch (error) {
      console.error('Erreur création budget:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la création du budget',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Créer budget depuis template
   * POST /api/budgets/from-template
   */
  static async createFromTemplate(req, res) {
    try {
      const { templateName, customData } = req.body;

      if (!templateName) {
        return res.status(400).json({
          success: false,
          message: 'Nom de template requis'
        });
      }

      const budget = await Budget.createFromTemplate(
        req.user.userId,
        templateName,
        customData
      );

      res.status(201).json({
        success: true,
        message: `Budget créé depuis template "${templateName}"`,
        data: { budget }
      });

    } catch (error) {
      if (error.message === 'Template de budget non trouvé') {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }

      console.error('Erreur création budget template:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la création du budget depuis template',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Lister les budgets de l'utilisateur
   * GET /api/budgets/list
   */
  static async listBudgets(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        status = 'active',
        period,
        sort = '-startDate',
        includeArchived = false
      } = req.query;

      // Construction du filtre
      const filter = { user: req.user.userId };
      
      if (status && status !== 'all') {
        if (status === 'active') {
          filter.isActive = true;
          filter.isArchived = false;
        } else if (status === 'archived') {
          filter.isArchived = true;
        } else {
          filter.status = status;
        }
      }

      if (period) {
        filter.period = period;
      }

      if (!includeArchived) {
        filter.isArchived = { $ne: true };
      }

      // Pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      const budgets = await Budget.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('user', 'firstName lastName');

      const total = await Budget.countDocuments(filter);

      // Calculer statistiques rapides
      const stats = {
        total_budgets: total,
        total_active: await Budget.countDocuments({ 
          ...filter, 
          isActive: true, 
          isArchived: false 
        }),
        total_exceeded: await Budget.countDocuments({ 
          ...filter, 
          status: 'exceeded' 
        })
      };

      res.json({
        success: true,
        data: {
          budgets,
          pagination: {
            current_page: parseInt(page),
            per_page: parseInt(limit),
            total,
            total_pages: Math.ceil(total / parseInt(limit))
          },
          stats
        }
      });

    } catch (error) {
      console.error('Erreur liste budgets:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des budgets',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Obtenir détails d'un budget
   * GET /api/budgets/:id
   */
  static async getBudgetDetails(req, res) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: 'ID de budget invalide'
        });
      }

      const budget = await Budget.findOne({
        _id: id,
        user: req.user.userId
      }).populate('user', 'firstName lastName');

      if (!budget) {
        return res.status(404).json({
          success: false,
          message: 'Budget non trouvé'
        });
      }

      // Récupérer transactions liées à ce budget
      const transactions = await Transaction.find({
        user: req.user.userId,
        date: {
          $gte: budget.startDate,
          $lte: budget.endDate
        }
      }).sort({ date: -1 }).limit(20);

      // Calculer analytics pour ce budget
      const analytics = await BudgetController.calculateBudgetAnalytics(budget, transactions);

      res.json({
        success: true,
        data: {
          budget,
          recent_transactions: transactions,
          analytics
        }
      });

    } catch (error) {
      console.error('Erreur détails budget:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération du budget',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Modifier un budget
   * PUT /api/budgets/:id
   */
  static async updateBudget(req, res) {
    try {
      const { id } = req.params;
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Données de modification invalides',
          errors: errors.array()
        });
      }

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: 'ID de budget invalide'
        });
      }

      const budget = await Budget.findOne({
        _id: id,
        user: req.user.userId
      });

      if (!budget) {
        return res.status(404).json({
          success: false,
          message: 'Budget non trouvé'
        });
      }

      // Mettre à jour les champs autorisés
      const allowedUpdates = [
        'name', 'description', 'expectedIncome', 'categories',
        'alertSettings', 'savingsGoal', 'tags'
      ];

      allowedUpdates.forEach(field => {
        if (req.body[field] !== undefined) {
          budget[field] = req.body[field];
        }
      });

      await budget.save();

      res.json({
        success: true,
        message: 'Budget modifié avec succès',
        data: { budget }
      });

    } catch (error) {
      console.error('Erreur modification budget:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la modification du budget',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Supprimer un budget
   * DELETE /api/budgets/:id
   */
  static async deleteBudget(req, res) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: 'ID de budget invalide'
        });
      }

      const budget = await Budget.findOne({
        _id: id,
        user: req.user.userId
      });

      if (!budget) {
        return res.status(404).json({
          success: false,
          message: 'Budget non trouvé'
        });
      }

      // Vérifier si le budget a des transactions associées
      const transactionCount = await Transaction.countDocuments({
        user: req.user.userId,
        date: {
          $gte: budget.startDate,
          $lte: budget.endDate
        }
      });

      if (transactionCount > 0) {
        // Archiver au lieu de supprimer si transactions existent
        budget.isArchived = true;
        budget.isActive = false;
        await budget.save();

        return res.json({
          success: true,
          message: 'Budget archivé (transactions existantes)',
          action: 'archived'
        });
      }

      // Supprimer définitivement si pas de transactions
      await Budget.findByIdAndDelete(id);

      res.json({
        success: true,
        message: 'Budget supprimé avec succès',
        action: 'deleted'
      });

    } catch (error) {
      console.error('Erreur suppression budget:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la suppression du budget',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // ===================================================================
  // ACTIONS SPÉCIALES BUDGETS
  // ===================================================================

  /**
   * Ajuster budget d'une catégorie
   * PUT /api/budgets/:id/adjust-category
   */
  static async adjustCategoryBudget(req, res) {
    try {
      const { id } = req.params;
      const { category, newAmount, reason } = req.body;

      if (!category || newAmount === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Catégorie et nouveau montant requis'
        });
      }

      const budget = await Budget.findOne({
        _id: id,
        user: req.user.userId
      });

      if (!budget) {
        return res.status(404).json({
          success: false,
          message: 'Budget non trouvé'
        });
      }

      await budget.adjustCategoryBudget(category, newAmount, reason);

      res.json({
        success: true,
        message: `Budget ${category} ajusté à ${newAmount}`,
        data: { budget }
      });

    } catch (error) {
      if (error.message === 'Catégorie non trouvée dans ce budget') {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }

      console.error('Erreur ajustement budget:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'ajustement du budget',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Créer snapshot mensuel
   * POST /api/budgets/:id/snapshot
   */
  static async createSnapshot(req, res) {
    try {
      const { id } = req.params;

      const budget = await Budget.findOne({
        _id: id,
        user: req.user.userId
      });

      if (!budget) {
        return res.status(404).json({
          success: false,
          message: 'Budget non trouvé'
        });
      }

      await budget.createMonthlySnapshot();

      res.json({
        success: true,
        message: 'Snapshot mensuel créé',
        data: {
          snapshot: budget.monthlySnapshots[budget.monthlySnapshots.length - 1]
        }
      });

    } catch (error) {
      console.error('Erreur création snapshot:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la création du snapshot',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Archiver/désarchiver budget
   * PUT /api/budgets/:id/archive
   */
  static async toggleArchive(req, res) {
    try {
      const { id } = req.params;
      const { archive = true } = req.body;

      const budget = await Budget.findOne({
        _id: id,
        user: req.user.userId
      });

      if (!budget) {
        return res.status(404).json({
          success: false,
          message: 'Budget non trouvé'
        });
      }

      if (archive) {
        await budget.archive();
      } else {
        budget.isArchived = false;
        budget.isActive = true;
        await budget.save();
      }

      res.json({
        success: true,
        message: archive ? 'Budget archivé' : 'Budget désarchivé',
        data: { budget }
      });

    } catch (error) {
      console.error('Erreur archivage budget:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'archivage',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // ===================================================================
  // ANALYTICS BUDGETS
  // ===================================================================

  /**
   * Analytics de progression des budgets
   * GET /api/budgets/analytics/progress
   */
  static async getBudgetProgress(req, res) {
    try {
      const { period = 'current', category } = req.query;

      // Filtre de base
      const filter = { 
        user: req.user.userId,
        isActive: true,
        isArchived: false
      };

      // Filtre par période
      if (period === 'current') {
        const now = new Date();
        filter.startDate = { $lte: now };
        filter.endDate = { $gte: now };
      }

      if (category) {
        filter['categories.category'] = category;
      }

      const budgets = await Budget.find(filter);

      // Calculer progression globale
      const progression = {
        total_budgets: budgets.length,
        total_budgeted: 0,
        total_spent: 0,
        categories_progress: {},
        alerts: {
          warning: 0,
          critical: 0
        }
      };

      budgets.forEach(budget => {
        progression.total_budgeted += budget.totalBudgeted;
        progression.total_spent += budget.totalSpent;

        budget.categories.forEach(cat => {
          if (!progression.categories_progress[cat.category]) {
            progression.categories_progress[cat.category] = {
              budgeted: 0,
              spent: 0,
              count: 0
            };
          }

          const catProgress = progression.categories_progress[cat.category];
          catProgress.budgeted += cat.budgetedAmount;
          catProgress.spent += cat.spentAmount;
          catProgress.count += 1;

          // Compter alertes
          const percentage = (cat.spentAmount / cat.budgetedAmount) * 100;
          if (percentage >= budget.alertSettings.criticalThreshold) {
            progression.alerts.critical += 1;
          } else if (percentage >= budget.alertSettings.warningThreshold) {
            progression.alerts.warning += 1;
          }
        });
      });

      // Calculer pourcentages
      progression.overall_percentage = progression.total_budgeted > 0 
        ? Math.round((progression.total_spent / progression.total_budgeted) * 100)
        : 0;

      Object.keys(progression.categories_progress).forEach(category => {
        const cat = progression.categories_progress[category];
        cat.percentage = cat.budgeted > 0 
          ? Math.round((cat.spent / cat.budgeted) * 100)
          : 0;
      });

      res.json({
        success: true,
        data: { progression }
      });

    } catch (error) {
      console.error('Erreur analytics progression:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors du calcul de la progression',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Analytics par période
   * GET /api/budgets/analytics/trends
   */
  static async getBudgetTrends(req, res) {
    try {
      const { months = 6 } = req.query;

      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - parseInt(months));

      const trends = await Budget.getAnalyticsByUser(
        req.user.userId,
        startDate,
        new Date()
      );

      // Calculer évolution mensuelle
      const monthlyData = await Budget.aggregate([
        {
          $match: {
            user: new mongoose.Types.ObjectId(req.user.userId),
            startDate: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$startDate' },
              month: { $month: '$startDate' }
            },
            total_budgeted: { $sum: '$totalBudgeted' },
            total_spent: { $sum: '$totalSpent' },
            count: { $sum: 1 },
            avg_health_score: { $avg: '$healthScore' }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]);

      res.json({
        success: true,
        data: {
          category_trends: trends,
          monthly_evolution: monthlyData
        }
      });

    } catch (error) {
      console.error('Erreur analytics tendances:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors du calcul des tendances',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Budgets nécessitant attention
   * GET /api/budgets/alerts
   */
  static async getBudgetAlerts(req, res) {
    try {
      const budgets = await Budget.findNeedingAttention(req.user.userId);

      const alerts = [];

      budgets.forEach(budget => {
        // Alertes de dépassement par catégorie
        budget.categories.forEach(category => {
          const percentage = (category.spentAmount / category.budgetedAmount) * 100;
          
          if (percentage >= budget.alertSettings.criticalThreshold) {
            alerts.push({
              type: 'critical',
              budget_id: budget._id,
              budget_name: budget.name,
              category: category.category,
              percentage: Math.round(percentage),
              message: `Budget ${category.category} dépassé de ${Math.round(percentage - 100)}%`,
              action: 'adjust_budget'
            });
          } else if (percentage >= budget.alertSettings.warningThreshold) {
            alerts.push({
              type: 'warning',
              budget_id: budget._id,
              budget_name: budget.name,
              category: category.category,
              percentage: Math.round(percentage),
              message: `Budget ${category.category} à ${Math.round(percentage)}%`,
              action: 'monitor'
            });
          }
        });

        // Alertes de fin de période
        if (budget.remainingDays <= 7) {
          alerts.push({
            type: 'info',
            budget_id: budget._id,
            budget_name: budget.name,
            message: `Budget se termine dans ${budget.remainingDays} jour(s)`,
            action: 'create_next_budget'
          });
        }
      });

      res.json({
        success: true,
        data: {
          alerts,
          summary: {
            total: alerts.length,
            critical: alerts.filter(a => a.type === 'critical').length,
            warning: alerts.filter(a => a.type === 'warning').length,
            info: alerts.filter(a => a.type === 'info').length
          }
        }
      });

    } catch (error) {
      console.error('Erreur alertes budgets:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des alertes',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // ===================================================================
  // TEMPLATES ET UTILS
  // ===================================================================

  /**
   * Obtenir templates disponibles
   * GET /api/budgets/templates
   */
  static async getTemplates(req, res) {
    try {
      const { BUDGET_TEMPLATES } = require('../utils/constants');

      const templates = Object.entries(BUDGET_TEMPLATES).map(([key, template]) => ({
        id: key,
        name: template.name,
        description: template.description,
        target_income: template.targetIncome,
        categories: template.categories,
        suited_for: template.suitedFor || 'general'
      }));

      res.json({
        success: true,
        data: { templates }
      });

    } catch (error) {
      console.error('Erreur templates:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des templates',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Statistiques utilisateur globales
   * GET /api/budgets/stats
   */
  static async getUserStats(req, res) {
    try {
      const stats = await Budget.getUserStats(req.user.userId);

      if (!stats || stats.length === 0) {
        return res.json({
          success: true,
          data: {
            stats: {
              total_budgets: 0,
              active_budgets: 0,
              total_budgeted: 0,
              total_spent: 0,
              avg_health_score: 0
            }
          }
        });
      }

      res.json({
        success: true,
        data: { stats: stats[0] }
      });

    } catch (error) {
      console.error('Erreur stats utilisateur:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors du calcul des statistiques',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // ===================================================================
  // ADMIN ENDPOINTS
  // ===================================================================

  /**
   * Statistiques admin globales
   * GET /api/budgets/admin/stats
   */
  static async getAdminStats(req, res) {
    try {
      // Vérifier role admin
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Accès admin requis'
        });
      }

      const stats = await Budget.aggregate([
        {
          $group: {
            _id: null,
            total_budgets: { $sum: 1 },
            active_budgets: {
              $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
            },
            total_budgeted: { $sum: '$totalBudgeted' },
            total_spent: { $sum: '$totalSpent' },
            avg_health_score: { $avg: '$healthScore' }
          }
        }
      ]);

      // Stats par template
      const templateStats = await Budget.aggregate([
        { $match: { isFromTemplate: true } },
        {
          $group: {
            _id: '$templateUsed',
            count: { $sum: 1 },
            avg_success: { $avg: '$healthScore' }
          }
        },
        { $sort: { count: -1 } }
      ]);

      res.json({
        success: true,
        data: {
          global_stats: stats[0] || {},
          template_usage: templateStats
        }
      });

    } catch (error) {
      console.error('Erreur stats admin:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors du calcul des statistiques admin',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // ===================================================================
  // UTILS PRIVÉES
  // ===================================================================

  /**
   * Calculer analytics détaillés pour un budget
   */
  static async calculateBudgetAnalytics(budget, transactions = []) {
    const analytics = {
      performance: {
        total_budgeted: budget.totalBudgeted,
        total_spent: budget.totalSpent,
        remaining: budget.totalRemaining,
        percentage: budget.spentPercentage,
        health_score: budget.healthScore
      },
      timeline: {
        days_elapsed: budget.daysElapsed,
        days_remaining: budget.remainingDays,
        daily_average: budget.daysElapsed > 0 ? budget.totalSpent / budget.daysElapsed : 0
      },
      categories: budget.categories.map(cat => ({
        category: cat.category,
        budgeted: cat.budgetedAmount,
        spent: cat.spentAmount,
        remaining: cat.budgetedAmount - cat.spentAmount,
        percentage: Math.round((cat.spentAmount / cat.budgetedAmount) * 100),
        status: cat.spentAmount > cat.budgetedAmount ? 'exceeded' : 'on_track'
      })),
      predictions: {
        projected_end_spending: budget.daysElapsed > 0 
          ? (budget.totalSpent / budget.daysElapsed) * (budget.daysElapsed + budget.remainingDays)
          : budget.totalSpent,
        will_exceed: budget.daysElapsed > 0 
          ? ((budget.totalSpent / budget.daysElapsed) * (budget.daysElapsed + budget.remainingDays)) > budget.totalBudgeted
          : false
      }
    };

    return analytics;
  }
}

module.exports = BudgetController;