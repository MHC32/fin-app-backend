// src/controllers/solController.js
// Controller pour gestion sols/tontines - FinApp Haiti
// Approche progressive : CRUD complet + Analytics + IA Data Collection

const Sol = require('../models/Sol');
const User = require('../models/User');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const { body, validationResult, param, query } = require('express-validator');
const mongoose = require('mongoose');

/**
 * ===================================================================
 * SOL CONTROLLER - GESTION TONTINES HAITI
 * ===================================================================
 * 
 * Fonctionnalités :
 * - CRUD sols complets (Create, Read, Update, Delete)
 * - Gestion des participants et rounds
 * - Calculs automatisés (tours, paiements, intérêts)
 * - Analytics et patterns comportementaux pour IA
 * - Intégration avec comptes bancaires et transactions
 * - Notifications intelligentes contexte Haiti
 */

class SolController {

  // ===================================================================
  // 1. CRÉATION SOLS
  // ===================================================================

  /**
   * Créer un nouveau sol/tontine
   * POST /api/sols/
   */
  static createSol = async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Données de sol invalides',
          errors: errors.array()
        });
      }

      const {
        name,
        description,
        type,
        contributionAmount,
        currency,
        maxParticipants,
        frequency,
        startDate,
        duration,
        paymentDay,
        interestRate,
        tags,
        isPrivate,
        rules
      } = req.body;

      // Vérifier que l'utilisateur n'a pas trop de sols actifs
      const activeSolsCount = await Sol.countDocuments({
        creator: req.user.userId,
        status: { $in: ['recruiting', 'active'] }
      });

      if (activeSolsCount >= 5) {
        return res.status(400).json({
          success: false,
          message: 'Limite de 5 sols actifs simultanés atteinte',
          error: 'max_active_sols_exceeded'
        });
      }

      // Générer code d'accès unique
      const accessCode = await this.generateUniqueAccessCode();

      // Créer le sol
      const newSol = new Sol({
        creator: req.user.userId,
        name: name.trim(),
        description: description?.trim(),
        type,
        contributionAmount,
        currency,
        maxParticipants,
        frequency,
        startDate: new Date(startDate),
        duration,
        paymentDay: paymentDay || 1,
        interestRate: interestRate || 0,
        tags: tags || [],
        isPrivate: isPrivate || false,
        rules: rules || [],
        accessCode,
        status: 'recruiting',
        
        // Initialiser rounds automatiquement
        rounds: this.generateRounds(maxParticipants, new Date(startDate), frequency),
        
        // Le créateur rejoint automatiquement
        participants: [{
          user: req.user.userId,
          position: 1,
          joinedAt: new Date(),
          role: 'creator',
          paymentStatus: 'pending'
        }],
        
        // Metrics pour IA
        metrics: {
          totalRounds: maxParticipants,
          completedRounds: 0,
          successRate: 0,
          avgPaymentDelay: 0,
          participantRetention: 100
        }
      });

      await newSol.save();

      // Peupler les relations pour la réponse
      await newSol.populate([
        { path: 'creator', select: 'firstName lastName email' },
        { path: 'participants.user', select: 'firstName lastName' }
      ]);

      // Collecte données pour IA
      await this.collectCreationAnalytics(req.user.userId, newSol);

      res.status(201).json({
        success: true,
        message: 'Sol créé avec succès',
        data: { 
          sol: newSol,
          accessCode: newSol.accessCode,
          nextSteps: [
            'Inviter des participants avec le code d\'accès',
            'Paramétrer les notifications de paiement',
            'Définir les règles spécifiques du groupe'
          ]
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur création sol:', error.message);
      
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'Un sol avec ce nom existe déjà',
          error: 'duplicate_sol_name'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Erreur lors de la création du sol',
        error: 'sol_creation_error'
      });
    }
  };

  // ===================================================================
  // 2. LECTURE SOLS
  // ===================================================================

  /**
   * Récupérer tous les sols d'un utilisateur
   * GET /api/sols/
   */
  static getUserSols = async (req, res) => {
    try {
      const { 
        status = 'all',
        type,
        page = 1,
        limit = 20,
        sortBy = 'lastActivityDate',
        sortOrder = 'desc',
        includeAnalytics = false
      } = req.query;

      // Construire filtre de base
      const filter = {
        $or: [
          { creator: req.user.userId },
          { 'participants.user': req.user.userId }
        ]
      };

      // Filtres optionnels
      if (status !== 'all') {
        filter.status = status;
      }

      if (type) {
        filter.type = type;
      }

      // Pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Récupération avec populate complet
      const [sols, totalCount] = await Promise.all([
        Sol.find(filter)
          .populate('creator', 'firstName lastName email')
          .populate('participants.user', 'firstName lastName')
          .populate('rounds.recipient', 'firstName lastName')
          .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
          .skip(skip)
          .limit(parseInt(limit)),
        Sol.countDocuments(filter)
      ]);

      // Enrichir avec informations utilisateur spécifiques
      const enrichedSols = sols.map(sol => {
        const userParticipation = sol.participants.find(p => 
          p.user._id.toString() === req.user.userId
        );

        const nextRound = sol.rounds.find(r => r.status === 'pending');
        const nextPaymentDue = sol.getNextPaymentDate();

        return {
          ...sol.toJSON(),
          userRole: sol.creator._id.toString() === req.user.userId ? 'creator' : 'participant',
          userPosition: userParticipation?.position,
          nextRoundIndex: nextRound ? sol.rounds.indexOf(nextRound) + 1 : null,
          daysUntilNextPayment: nextPaymentDue ? 
            Math.ceil((nextPaymentDue - new Date()) / (1000 * 60 * 60 * 24)) : null,
          turnsUntilMe: this.calculateTurnsUntilUser(sol, req.user.userId)
        };
      });

      // Analytics si demandées
      let analytics = null;
      if (includeAnalytics) {
        analytics = await this.generateUserSolAnalytics(req.user.userId, sols);
      }

      res.status(200).json({
        success: true,
        data: {
          sols: enrichedSols,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: totalCount,
            pages: Math.ceil(totalCount / parseInt(limit))
          },
          summary: {
            totalSols: totalCount,
            activeSols: sols.filter(s => s.status === 'active').length,
            recruitingSols: sols.filter(s => s.status === 'recruiting').length,
            completedSols: sols.filter(s => s.status === 'completed').length
          },
          analytics: analytics
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur récupération sols utilisateur:', error.message);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des sols',
        error: 'sols_fetch_error'
      });
    }
  };

  /**
   * Récupérer un sol spécifique
   * GET /api/sols/:id
   */
  static getSolById = async (req, res) => {
    try {
      const { id } = req.params;
      const { includeHistory = false } = req.query;

      const sol = await Sol.findById(id)
        .populate('creator', 'firstName lastName email phone')
        .populate('participants.user', 'firstName lastName email phone')
        .populate('rounds.recipient', 'firstName lastName')
        .populate('rounds.payments.payer', 'firstName lastName');

      if (!sol) {
        return res.status(404).json({
          success: false,
          message: 'Sol introuvable',
          error: 'sol_not_found'
        });
      }

      // Vérifier que l'utilisateur fait partie du sol
      const hasAccess = sol.creator._id.toString() === req.user.userId ||
                       sol.participants.some(p => p.user._id.toString() === req.user.userId);

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Accès non autorisé à ce sol',
          error: 'unauthorized_sol_access'
        });
      }

      // Enrichir avec informations contextuelles
      const enrichedSol = {
        ...sol.toJSON(),
        userRole: sol.creator._id.toString() === req.user.userId ? 'creator' : 'participant',
        progress: {
          completedRounds: sol.rounds.filter(r => r.status === 'completed').length,
          totalRounds: sol.rounds.length,
          percentage: Math.round((sol.rounds.filter(r => r.status === 'completed').length / sol.rounds.length) * 100)
        },
        financial: {
          totalContributed: sol.contributionAmount * sol.rounds.filter(r => r.status === 'completed').length,
          expectedTotal: sol.contributionAmount * sol.rounds.length,
          pendingAmount: sol.contributionAmount * sol.rounds.filter(r => r.status === 'pending').length
        },
        timeline: {
          nextPaymentDate: sol.getNextPaymentDate(),
          estimatedEndDate: sol.calculateEndDate(),
          daysRemaining: sol.calculateDaysRemaining()
        }
      };

      // Historique des transactions si demandé
      let transactionHistory = null;
      if (includeHistory) {
        transactionHistory = await Transaction.find({
          'metadata.solId': sol._id,
          user: req.user.userId
        }).sort({ date: -1 }).limit(50);
      }

      // Collecter données analytiques pour IA
      await this.collectViewAnalytics(req.user.userId, sol._id);

      res.status(200).json({
        success: true,
        data: {
          sol: enrichedSol,
          transactionHistory: transactionHistory,
          recommendations: await this.generateSolRecommendations(sol, req.user.userId)
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur récupération sol:', error.message);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération du sol',
        error: 'sol_fetch_error'
      });
    }
  };

  // ===================================================================
  // 3. GESTION PARTICIPANTS
  // ===================================================================

  /**
   * Rejoindre un sol avec code d'accès
   * POST /api/sols/join
   */
  static joinSol = async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Code d\'accès requis',
          errors: errors.array()
        });
      }

      const { accessCode } = req.body;

      // Trouver le sol
      const sol = await Sol.findByAccessCode(accessCode);

      if (!sol) {
        return res.status(404).json({
          success: false,
          message: 'Code d\'accès invalide ou sol non disponible',
          error: 'invalid_access_code'
        });
      }

      // Vérifications
      if (sol.status !== 'recruiting') {
        return res.status(400).json({
          success: false,
          message: 'Ce sol n\'accepte plus de nouveaux participants',
          error: 'sol_not_recruiting'
        });
      }

      if (sol.participants.length >= sol.maxParticipants) {
        return res.status(400).json({
          success: false,
          message: 'Ce sol est complet',
          error: 'sol_full'
        });
      }

      // Vérifier si déjà participant
      const alreadyMember = sol.participants.some(p => 
        p.user.toString() === req.user.userId
      );

      if (alreadyMember) {
        return res.status(400).json({
          success: false,
          message: 'Vous participez déjà à ce sol',
          error: 'already_participant'
        });
      }

      // Ajouter le participant
      const newPosition = sol.participants.length + 1;
      sol.participants.push({
        user: req.user.userId,
        position: newPosition,
        joinedAt: new Date(),
        role: 'participant',
        paymentStatus: 'pending'
      });

      // Assigner au round correspondant à sa position
      if (sol.rounds[newPosition - 1]) {
        sol.rounds[newPosition - 1].recipient = req.user.userId;
      }

      // Si c'est le dernier participant, démarrer le sol
      if (sol.participants.length === sol.maxParticipants) {
        sol.status = 'active';
        sol.actualStartDate = new Date();
        
        // Programmer première notification
        await this.schedulePaymentNotifications(sol);
      }

      await sol.save();

      // Peupler pour réponse
      await sol.populate([
        { path: 'creator', select: 'firstName lastName' },
        { path: 'participants.user', select: 'firstName lastName' }
      ]);

      // Analytics rejoindre sol pour IA
      await this.collectJoinAnalytics(req.user.userId, sol);

      res.status(200).json({
        success: true,
        message: 'Vous avez rejoint le sol avec succès',
        data: {
          sol: sol,
          yourPosition: newPosition,
          yourRoundNumber: newPosition,
          status: sol.status,
          nextSteps: sol.status === 'active' ? [
            'Premier paiement dû dans les 7 prochains jours',
            'Configurez vos notifications',
            'Consultez le calendrier des rounds'
          ] : [
            `En attente de ${sol.maxParticipants - sol.participants.length} participant(s)`,
            'Vous serez notifié au démarrage du sol'
          ]
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur rejoindre sol:', error.message);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'adhésion au sol',
        error: 'sol_join_error'
      });
    }
  };

  /**
   * Quitter un sol (avec conditions)
   * DELETE /api/sols/:id/leave
   */
  static leaveSol = async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const sol = await Sol.findById(id);

      if (!sol) {
        return res.status(404).json({
          success: false,
          message: 'Sol introuvable',
          error: 'sol_not_found'
        });
      }

      // Vérifier participation
      const participantIndex = sol.participants.findIndex(p => 
        p.user.toString() === req.user.userId
      );

      if (participantIndex === -1) {
        return res.status(400).json({
          success: false,
          message: 'Vous ne participez pas à ce sol',
          error: 'not_participant'
        });
      }

      const participant = sol.participants[participantIndex];

      // Restrictions pour quitter
      if (sol.status === 'active') {
        // Créateur ne peut pas quitter un sol actif
        if (sol.creator.toString() === req.user.userId) {
          return res.status(400).json({
            success: false,
            message: 'Le créateur ne peut pas quitter un sol actif',
            error: 'creator_cannot_leave_active_sol'
          });
        }

        // Si round déjà reçu, ne peut pas quitter
        const userRound = sol.rounds[participant.position - 1];
        if (userRound && userRound.status === 'completed') {
          return res.status(400).json({
            success: false,
            message: 'Impossible de quitter après avoir reçu votre tour',
            error: 'cannot_leave_after_receiving'
          });
        }

        // Pénalité pour départ
        const penalty = sol.contributionAmount * 0.1; // 10% de pénalité
        
        return res.status(400).json({
          success: false,
          message: `Quitter ce sol actif entraîne une pénalité de ${penalty} ${sol.currency}`,
          error: 'early_leave_penalty',
          penalty: penalty
        });
      }

      // Retirer le participant
      sol.participants.splice(participantIndex, 1);

      // Réorganiser les positions
      sol.participants.forEach((p, index) => {
        p.position = index + 1;
      });

      // Réorganiser les rounds
      sol.rounds = this.regenerateRounds(sol);

      // Si moins de 3 participants restants, marquer comme annulé
      if (sol.participants.length < 3) {
        sol.status = 'cancelled';
        sol.cancellationReason = 'Insufficient participants';
      }

      await sol.save();

      // Analytics quitter pour IA
      await this.collectLeaveAnalytics(req.user.userId, sol, reason);

      res.status(200).json({
        success: true,
        message: 'Vous avez quitté le sol avec succès',
        data: {
          solStatus: sol.status,
          remainingParticipants: sol.participants.length,
          reason: reason
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur quitter sol:', error.message);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la sortie du sol',
        error: 'sol_leave_error'
      });
    }
  };

  // ===================================================================
  // 4. GESTION PAIEMENTS
  // ===================================================================

  /**
   * Effectuer un paiement de sol
   * POST /api/sols/:id/payment
   */
  static makePayment = async (req, res) => {
    try {
      const { id } = req.params;
      const { accountId, amount, roundIndex, notes } = req.body;

      const sol = await Sol.findById(id)
        .populate('participants.user', 'firstName lastName');

      if (!sol) {
        return res.status(404).json({
          success: false,
          message: 'Sol introuvable',
          error: 'sol_not_found'
        });
      }

      // Vérifier participation
      const participant = sol.participants.find(p => 
        p.user._id.toString() === req.user.userId
      );

      if (!participant) {
        return res.status(400).json({
          success: false,
          message: 'Vous ne participez pas à ce sol',
          error: 'not_participant'
        });
      }

      // Vérifier compte utilisateur
      const account = await Account.findOne({
        _id: accountId,
        user: req.user.userId,
        isActive: true
      });

      if (!account) {
        return res.status(404).json({
          success: false,
          message: 'Compte introuvable',
          error: 'account_not_found'
        });
      }

      // Vérifier montant et solde
      if (amount !== sol.contributionAmount) {
        return res.status(400).json({
          success: false,
          message: `Montant incorrect. Montant requis: ${sol.contributionAmount} ${sol.currency}`,
          error: 'incorrect_amount'
        });
      }

      if (account.balance < amount) {
        return res.status(400).json({
          success: false,
          message: 'Solde insuffisant',
          error: 'insufficient_funds'
        });
      }

      // Trouver le round actuel ou spécifique
      let targetRound;
      if (roundIndex !== undefined) {
        targetRound = sol.rounds[roundIndex];
      } else {
        targetRound = sol.rounds.find(r => r.status === 'active');
      }

      if (!targetRound) {
        return res.status(400).json({
          success: false,
          message: 'Aucun round actif trouvé',
          error: 'no_active_round'
        });
      }

      // Vérifier si déjà payé pour ce round
      const existingPayment = targetRound.payments.find(p => 
        p.payer.toString() === req.user.userId
      );

      if (existingPayment) {
        return res.status(400).json({
          success: false,
          message: 'Paiement déjà effectué pour ce round',
          error: 'payment_already_made'
        });
      }

      // Session MongoDB pour transaction atomique
      const session = await mongoose.startSession();
      await session.withTransaction(async () => {
        // Débiter le compte
        account.balance -= amount;
        await account.save({ session });

        // Enregistrer paiement dans le round
        targetRound.payments.push({
          payer: req.user.userId,
          amount: amount,
          date: new Date(),
          status: 'completed',
          notes: notes
        });

        // Créer transaction
        const transaction = new Transaction({
          user: req.user.userId,
          account: accountId,
          type: 'expense',
          category: 'sols',
          subcategory: 'contribution',
          amount: amount,
          currency: sol.currency,
          description: `Paiement Sol: ${sol.name} - Round ${targetRound.roundNumber}`,
          date: new Date(),
          isConfirmed: true,
          metadata: {
            solId: sol._id,
            roundIndex: sol.rounds.indexOf(targetRound),
            roundNumber: targetRound.roundNumber,
            recipient: targetRound.recipient
          },
          // Tags pour IA analytics
          tags: [
            'sol_payment',
            `sol_type_${sol.type}`,
            `frequency_${sol.frequency}`,
            `position_${participant.position}`
          ]
        });

        await transaction.save({ session });

        // Vérifier si tous ont payé pour ce round
        if (targetRound.payments.length === sol.participants.length) {
          targetRound.status = 'completed';
          targetRound.completedDate = new Date();
          
          // Calculer et transférer le montant au bénéficiaire
          const totalAmount = targetRound.payments.reduce((sum, p) => sum + p.amount, 0);
          await this.transferToRecipient(sol, targetRound, totalAmount, session);
          
          // Activer le round suivant
          const nextRoundIndex = sol.rounds.indexOf(targetRound) + 1;
          if (sol.rounds[nextRoundIndex]) {
            sol.rounds[nextRoundIndex].status = 'active';
            sol.rounds[nextRoundIndex].startDate = new Date();
          } else {
            // Dernier round terminé
            sol.status = 'completed';
            sol.completedDate = new Date();
          }
        }

        // Mettre à jour métriques du sol
        sol.metrics.totalCollected += amount;
        sol.lastActivityDate = new Date();

        await sol.save({ session });
      });

      // Analytics paiement pour IA
      await this.collectPaymentAnalytics(req.user.userId, sol, targetRound, amount);

      res.status(200).json({
        success: true,
        message: 'Paiement effectué avec succès',
        data: {
          transaction: {
            amount: amount,
            round: targetRound.roundNumber,
            recipient: targetRound.recipient,
            date: new Date()
          },
          roundStatus: {
            paymentsReceived: targetRound.payments.length,
            paymentsExpected: sol.participants.length,
            isComplete: targetRound.payments.length === sol.participants.length
          },
          solProgress: {
            completedRounds: sol.rounds.filter(r => r.status === 'completed').length,
            totalRounds: sol.rounds.length,
            status: sol.status
          }
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur paiement sol:', error.message);
      res.status(500).json({
        success: false,
        message: 'Erreur lors du paiement',
        error: 'sol_payment_error'
      });
    }
  };

  // ===================================================================
  // 5. ANALYTICS ET RAPPORTS
  // ===================================================================

  /**
   * Analytics personnels des sols
   * GET /api/sols/analytics/personal
   */
  static getPersonalAnalytics = async (req, res) => {
    try {
      const { timeframe = 90 } = req.query;
      const startDate = new Date(Date.now() - timeframe * 24 * 60 * 60 * 1000);

      // Récupérer tous les sols de l'utilisateur
      const userSols = await Sol.find({
        $or: [
          { creator: req.user.userId },
          { 'participants.user': req.user.userId }
        ],
        createdAt: { $gte: startDate }
      }).populate('participants.user', 'firstName lastName');

      // Récupérer transactions sol
      const solTransactions = await Transaction.find({
        user: req.user.userId,
        category: 'sols',
        date: { $gte: startDate }
      });

      // Calculer analytics de base
      const analytics = {
        overview: {
          totalSols: userSols.length,
          activeSols: userSols.filter(s => s.status === 'active').length,
          completedSols: userSols.filter(s => s.status === 'completed').length,
          totalContributed: solTransactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0),
          totalReceived: solTransactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0)
        },

        patterns: {
          preferredTypes: this.analyzeSolTypePreferences(userSols),
          paymentTiming: this.analyzePaymentTiming(solTransactions),
          participation: this.analyzeParticipationPatterns(userSols, req.user.userId),
          success_rate: this.calculateSuccessRate(userSols, req.user.userId)
        },

        financial: {
          avgContribution: userSols.length > 0 ? 
            userSols.reduce((sum, s) => sum + s.contributionAmount, 0) / userSols.length : 0,
          monthlyCommitment: this.calculateMonthlyCommitment(userSols),
          roi_analysis: this.calculateROI(userSols, req.user.userId),
          cash_flow_impact: this.analyzeCashFlowImpact(solTransactions)
        },

        behavioral: {
          creation_tendency: userSols.filter(s => s.creator.toString() === req.user.userId).length,
          joining_tendency: userSols.filter(s => s.creator.toString() !== req.user.userId).length,
          completion_rate: this.calculateCompletionRate(userSols, req.user.userId),
          punctuality_score: this.calculatePunctualityScore(solTransactions),
          risk_profile: this.calculateRiskProfile(userSols)
        },

        predictions: {
          likely_next_contribution: await this.predictNextContribution(req.user.userId, userSols),
          completion_probability: this.predictCompletionProbability(userSols, req.user.userId),
          optimal_timing: this.suggestOptimalTiming(solTransactions),
          recommendations: await this.generatePersonalRecommendations(req.user.userId, userSols)
        }
      };

      // Collecter ces analytics pour alimenter l'IA future
      await this.storeAnalyticsForIA(req.user.userId, analytics);

      res.status(200).json({
        success: true,
        data: {
          analytics: analytics,
          generatedAt: new Date().toISOString(),
          timeframe: `${timeframe} jours`,
          dataQuality: this.assessDataQuality(userSols, solTransactions)
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur analytics sols:', error.message);
      res.status(500).json({
        success: false,
        message: 'Erreur lors du calcul des analytics',
        error: 'sol_analytics_error'
      });
    }
  };

  /**
   * Découverte de sols ouverts
   * GET /api/sols/discover
   */
  static discoverSols = async (req, res) => {
    try {
      const { 
        type,
        minAmount,
        maxAmount,
        currency = 'HTG',
        region,
        page = 1,
        limit = 20 
      } = req.query;

      // Construire filtre de recherche
      const filter = {
        status: 'recruiting',
        isPrivate: false,
        isActive: true
      };

      if (type) filter.type = type;
      if (currency) filter.currency = currency;
      if (minAmount) filter.contributionAmount = { $gte: parseInt(minAmount) };
      if (maxAmount) {
        filter.contributionAmount = filter.contributionAmount || {};
        filter.contributionAmount.$lte = parseInt(maxAmount);
      }

      // Pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Rechercher sols avec scoring de pertinence
      const availableSols = await Sol.find(filter)
        .populate('creator', 'firstName lastName region')
        .populate('participants.user', 'firstName lastName')
        .sort({ 
          createdAt: -1,
          participantCount: -1 // Privilégier sols avec plus de participants
        })
        .skip(skip)
        .limit(parseInt(limit));

      // Calculer score de pertinence personnalisé
      const userSols = await Sol.find({
        $or: [
          { creator: req.user.userId },
          { 'participants.user': req.user.userId }
        ]
      });

      const scoredSols = availableSols.map(sol => {
        const relevanceScore = this.calculateRelevanceScore(sol, userSols, req.user);
        
        return {
          ...sol.toJSON(),
          relevanceScore,
          spotsLeft: sol.maxParticipants - sol.participants.length,
          estimatedStartDate: this.estimateStartDate(sol),
          compatibility: this.calculateCompatibility(sol, userSols),
          riskLevel: this.assessRiskLevel(sol)
        };
      }).sort((a, b) => b.relevanceScore - a.relevanceScore);

      // Analytics discovery pour IA
      await this.collectDiscoveryAnalytics(req.user.userId, filter, scoredSols);

      res.status(200).json({
        success: true,
        data: {
          sols: scoredSols,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: await Sol.countDocuments(filter)
          },
          filters: {
            availableTypes: await this.getAvailableTypes(),
            amountRanges: await this.getAmountRanges(currency),
            popularRegions: await this.getPopularRegions()
          },
          recommendations: await this.generateDiscoveryRecommendations(req.user.userId, userSols)
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur découverte sols:', error.message);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la découverte de sols',
        error: 'sol_discovery_error'
      });
    }
  };

  // ===================================================================
  // 6. MÉTHODES UTILITAIRES PRIVÉES
  // ===================================================================

  /**
   * Générer code d'accès unique
   */
  static async generateUniqueAccessCode() {
    let code;
    let exists = true;
    
    while (exists) {
      code = Math.random().toString(36).substring(2, 8).toUpperCase();
      exists = await Sol.findOne({ accessCode: code });
    }
    
    return code;
  }

  /**
   * Générer rounds automatiquement
   */
  static generateRounds(maxParticipants, startDate, frequency) {
    const rounds = [];
    let currentDate = new Date(startDate);

    for (let i = 0; i < maxParticipants; i++) {
      rounds.push({
        roundNumber: i + 1,
        startDate: new Date(currentDate),
        endDate: new Date(currentDate.getTime() + this.getFrequencyDuration(frequency)),
        status: i === 0 ? 'pending' : 'scheduled',
        recipient: null, // Assigné quand participant rejoint
        payments: []
      });

      // Incrémenter date selon fréquence
      currentDate = this.addFrequencyToDate(currentDate, frequency);
    }

    return rounds;
  }

  /**
   * Calculer durée fréquence en millisecondes
   */
  static getFrequencyDuration(frequency) {
    const durations = {
      'weekly': 7 * 24 * 60 * 60 * 1000,
      'biweekly': 14 * 24 * 60 * 60 * 1000,
      'monthly': 30 * 24 * 60 * 60 * 1000,
      'quarterly': 90 * 24 * 60 * 60 * 1000
    };
    return durations[frequency] || durations.monthly;
  }

  /**
   * Ajouter fréquence à une date
   */
  static addFrequencyToDate(date, frequency) {
    const newDate = new Date(date);
    
    switch (frequency) {
      case 'weekly':
        newDate.setDate(newDate.getDate() + 7);
        break;
      case 'biweekly':
        newDate.setDate(newDate.getDate() + 14);
        break;
      case 'monthly':
        newDate.setMonth(newDate.getMonth() + 1);
        break;
      case 'quarterly':
        newDate.setMonth(newDate.getMonth() + 3);
        break;
      default:
        newDate.setMonth(newDate.getMonth() + 1);
    }
    
    return newDate;
  }

  /**
   * Calculer tours restants avant utilisateur
   */
  static calculateTurnsUntilUser(sol, userId) {
    const userParticipant = sol.participants.find(p => 
      p.user.toString() === userId || p.user._id.toString() === userId
    );
    
    if (!userParticipant) return null;

    const currentRound = sol.rounds.findIndex(r => r.status === 'active' || r.status === 'pending');
    const userRound = userParticipant.position - 1;

    if (currentRound === -1) return userRound + 1;
    
    return userRound >= currentRound ? 
      userRound - currentRound : 
      sol.rounds.length - currentRound + userRound;
  }

  /**
   * Transférer montant au bénéficiaire du round
   */
  static async transferToRecipient(sol, round, amount, session) {
    try {
      // Trouver compte principal du bénéficiaire
      const recipientAccount = await Account.findOne({
        user: round.recipient,
        isPrimary: true,
        isActive: true
      }).session(session);

      if (recipientAccount) {
        // Créditer compte bénéficiaire
        recipientAccount.balance += amount;
        await recipientAccount.save({ session });

        // Créer transaction de réception
        const incomeTransaction = new Transaction({
          user: round.recipient,
          account: recipientAccount._id,
          type: 'income',
          category: 'sols',
          subcategory: 'reception',
          amount: amount,
          currency: sol.currency,
          description: `Réception Sol: ${sol.name} - Round ${round.roundNumber}`,
          date: new Date(),
          isConfirmed: true,
          metadata: {
            solId: sol._id,
            roundIndex: sol.rounds.indexOf(round),
            roundNumber: round.roundNumber,
            contributors: round.payments.length
          },
          tags: [
            'sol_reception',
            `sol_type_${sol.type}`,
            `round_${round.roundNumber}`
          ]
        });

        await incomeTransaction.save({ session });

        round.transferTransaction = incomeTransaction._id;
      }

      return true;
    } catch (error) {
      console.error('❌ Erreur transfert bénéficiaire:', error.message);
      throw error;
    }
  }

  // ===================================================================
  // 7. MÉTHODES ANALYTICS POUR IA
  // ===================================================================

  /**
   * Collecter analytics création pour IA
   */
  static async collectCreationAnalytics(userId, sol) {
    try {
      const analyticsData = {
        userId: userId,
        event: 'sol_creation',
        solData: {
          type: sol.type,
          amount: sol.contributionAmount,
          currency: sol.currency,
          participants: sol.maxParticipants,
          frequency: sol.frequency,
          isPrivate: sol.isPrivate
        },
        context: {
          timeOfDay: new Date().getHours(),
          dayOfWeek: new Date().getDay(),
          timestamp: new Date()
        },
        patterns: {
          previousSols: await Sol.countDocuments({ creator: userId }),
          avgAmount: await this.calculateUserAvgContribution(userId),
          preferredType: await this.getUserPreferredType(userId)
        }
      };

      // Sauvegarder pour traitement IA futur
      // TODO: Intégrer avec service HabitInsight en Phase 7
      console.log('📊 Sol Creation Analytics:', analyticsData.event);
      
    } catch (error) {
      console.error('❌ Erreur collecte analytics création:', error.message);
    }
  }

  /**
   * Collecter analytics paiement pour IA
   */
  static async collectPaymentAnalytics(userId, sol, round, amount) {
    try {
      const payment = round.payments.find(p => p.payer.toString() === userId);
      const participant = sol.participants.find(p => p.user.toString() === userId);

      const analyticsData = {
        userId: userId,
        event: 'sol_payment',
        paymentData: {
          amount: amount,
          onTime: this.isPaymentOnTime(payment, round),
          daysSinceRoundStart: Math.ceil((payment.date - round.startDate) / (1000 * 60 * 60 * 24)),
          roundNumber: round.roundNumber,
          userPosition: participant?.position
        },
        solContext: {
          type: sol.type,
          frequency: sol.frequency,
          totalParticipants: sol.participants.length,
          isCreator: sol.creator.toString() === userId
        },
        behavioral: {
          paymentTiming: this.analyzePaymentTiming([payment]),
          consistency: await this.calculatePaymentConsistency(userId),
          riskLevel: this.assessUserRiskLevel(userId)
        }
      };

      console.log('📊 Sol Payment Analytics:', analyticsData.event);
      
    } catch (error) {
      console.error('❌ Erreur collecte analytics paiement:', error.message);
    }
  }

  /**
   * Collecter analytics vue pour IA
   */
  static async collectViewAnalytics(userId, solId) {
    try {
      const analyticsData = {
        userId: userId,
        event: 'sol_view',
        solId: solId,
        context: {
          timestamp: new Date(),
          timeOfDay: new Date().getHours(),
          dayOfWeek: new Date().getDay()
        }
      };

      console.log('📊 Sol View Analytics:', analyticsData.event);
      
    } catch (error) {
      console.error('❌ Erreur collecte analytics vue:', error.message);
    }
  }

  /**
   * Stocker analytics pour IA future
   */
  static async storeAnalyticsForIA(userId, analytics) {
    try {
      // TODO: Phase 7 - Sauvegarder dans HabitInsight collection
      const iaData = {
        userId: userId,
        category: 'sols',
        insights: analytics,
        generatedAt: new Date(),
        dataQuality: this.assessAnalyticsQuality(analytics)
      };

      console.log('🤖 IA Analytics Stored for future processing');
      
    } catch (error) {
      console.error('❌ Erreur stockage analytics IA:', error.message);
    }
  }

  /**
   * Analyser préférences types de sols
   */
  static analyzeSolTypePreferences(userSols) {
    const typeCount = {};
    userSols.forEach(sol => {
      typeCount[sol.type] = (typeCount[sol.type] || 0) + 1;
    });

    return Object.entries(typeCount)
      .map(([type, count]) => ({
        type,
        count,
        percentage: Math.round((count / userSols.length) * 100)
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Analyser timing des paiements
   */
  static analyzePaymentTiming(transactions) {
    if (transactions.length === 0) return null;

    const timingData = {
      avgHour: 0,
      preferredDays: [],
      punctualityScore: 0,
      patterns: {}
    };

    const hours = transactions.map(t => new Date(t.date).getHours());
    const days = transactions.map(t => new Date(t.date).getDay());

    timingData.avgHour = Math.round(hours.reduce((sum, h) => sum + h, 0) / hours.length);

    const dayCount = {};
    days.forEach(day => {
      dayCount[day] = (dayCount[day] || 0) + 1;
    });

    timingData.preferredDays = Object.entries(dayCount)
      .sort(([,a], [,b]) => b - a)
      .map(([day]) => parseInt(day));

    return timingData;
  }

  /**
   * Calculer taux de succès
   */
  static calculateSuccessRate(userSols, userId) {
    const completedSols = userSols.filter(sol => sol.status === 'completed');
    const totalSols = userSols.filter(sol => sol.status !== 'recruiting');

    return totalSols.length > 0 ? 
      Math.round((completedSols.length / totalSols.length) * 100) : 0;
  }

  /**
   * Générer recommandations personnelles
   */
  static async generatePersonalRecommendations(userId, userSols) {
    const recommendations = [];

    // Analyse patterns existants
    const avgAmount = userSols.length > 0 ? 
      userSols.reduce((sum, s) => sum + s.contributionAmount, 0) / userSols.length : 0;

    const hasActiveAsCreator = userSols.some(s => 
      s.creator.toString() === userId && s.status === 'active'
    );

    const completionRate = this.calculateSuccessRate(userSols, userId);

    // Recommandations basées sur patterns
    if (avgAmount < 1000) {
      recommendations.push({
        type: 'amount_optimization',
        title: 'Augmenter montant contribution',
        description: 'Vos contributions moyennes sont faibles. Augmenter pourrait accélérer vos objectifs.',
        confidence: 0.7,
        actionable: true
      });
    }

    if (!hasActiveAsCreator && userSols.length > 2) {
      recommendations.push({
        type: 'leadership_opportunity',
        title: 'Créer votre propre sol',
        description: 'Vous avez l\'expérience pour organiser un sol selon vos besoins.',
        confidence: 0.8,
        actionable: true
      });
    }

    if (completionRate < 80) {
      recommendations.push({
        type: 'commitment_improvement',
        title: 'Améliorer engagement',
        description: 'Choisir des montants plus adaptés à votre budget pourrait améliorer votre taux de réussite.',
        confidence: 0.9,
        actionable: true
      });
    }

    return recommendations;
  }

  /**
   * Estimer qualité des données pour IA
   */
  static assessDataQuality(sols, transactions) {
    let score = 0;
    
    if (sols.length >= 3) score += 30;
    if (transactions.length >= 10) score += 30;
    if (sols.some(s => s.status === 'completed')) score += 20;
    if (transactions.length >= 20) score += 20;

    return Math.min(score, 100);
  }

  /**
   * Calculer score de pertinence pour découverte
   */
  static calculateRelevanceScore(sol, userSols, user) {
    let score = 0;

    // Basé sur historique utilisateur
    const userTypes = userSols.map(s => s.type);
    if (userTypes.includes(sol.type)) score += 30;

    const userAmounts = userSols.map(s => s.contributionAmount);
    const avgAmount = userAmounts.length > 0 ? 
      userAmounts.reduce((sum, a) => sum + a, 0) / userAmounts.length : 0;
    
    if (Math.abs(sol.contributionAmount - avgAmount) < avgAmount * 0.3) score += 25;

    // Autres facteurs
    if (sol.participants.length > sol.maxParticipants * 0.5) score += 20;
    if (sol.currency === 'HTG') score += 15;
    if (!sol.isPrivate) score += 10;

    return Math.min(score, 100);
  }
}

// ===================================================================
// VALIDATIONS MIDDLEWARE
// ===================================================================

/**
 * Validations pour création de sol
 */
SolController.validateCreateSol = [
  body('name')
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Le nom doit contenir entre 3 et 100 caractères'),
  
  body('contributionAmount')
    .isFloat({ min: 100 })
    .withMessage('Le montant de contribution doit être au moins 100'),
  
  body('maxParticipants')
    .isInt({ min: 3, max: 20 })
    .withMessage('Le nombre de participants doit être entre 3 et 20'),
  
  body('frequency')
    .isIn(['weekly', 'biweekly', 'monthly', 'quarterly'])
    .withMessage('Fréquence invalide'),
  
  body('startDate')
    .isISO8601()
    .withMessage('Date de début invalide')
    .custom(value => {
      const startDate = new Date(value);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      if (startDate < tomorrow) {
        throw new Error('La date de début doit être au moins demain');
      }
      return true;
    }),
  
  body('type')
    .isIn(['classic', 'investment', 'emergency', 'project', 'business'])
    .withMessage('Type de sol invalide'),
  
  body('currency')
    .isIn(['HTG', 'USD'])
    .withMessage('Devise non supportée')
];

/**
 * Validations pour rejoindre sol
 */
SolController.validateJoinSol = [
  body('accessCode')
    .isLength({ min: 6, max: 6 })
    .isAlphanumeric()
    .withMessage('Code d\'accès invalide (6 caractères alphanumériques)')
];

/**
 * Validations pour paiement
 */
SolController.validatePayment = [
  body('accountId')
    .isMongoId()
    .withMessage('ID de compte invalide'),
  
  body('amount')
    .isFloat({ min: 1 })
    .withMessage('Montant invalide'),
  
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Notes trop longues (max 200 caractères)')
];

module.exports = SolController;