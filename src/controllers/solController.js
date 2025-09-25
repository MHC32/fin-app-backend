// src/controllers/solController.js
// Controller pour gestion sols/tontines - FinApp Haiti
// Version complète finale avec toutes les corrections

const Sol = require('../models/Sol');
const User = require('../models/User');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const { body, validationResult, param, query } = require('express-validator');
const mongoose = require('mongoose');

class SolController {

  // ===================================================================
  // 1. CRÉATION SOLS
  // ===================================================================

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
        name, description, type, contributionAmount, currency, maxParticipants,
        frequency, startDate, duration, paymentDay, interestRate, tags, isPrivate, rules
      } = req.body;

      // Vérifier limite sols actifs
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
        type, contributionAmount, currency, maxParticipants, frequency,
        startDate: new Date(startDate),
        duration, paymentDay: paymentDay || 1, interestRate: interestRate || 0,
        tags: tags || [], isPrivate: isPrivate || false, rules: rules || [],
        accessCode, status: 'recruiting',
        
        rounds: this.generateRounds(maxParticipants, new Date(startDate), frequency),
        
        participants: [{
          user: req.user.userId,
          position: 1,
          joinedAt: new Date(),
          role: 'creator',
          paymentStatus: 'pending'
        }],
        
        metrics: {
          totalRounds: maxParticipants,
          completedRounds: 0,
          successRate: 0,
          avgPaymentDelay: 0,
          participantRetention: 100
        }
      });

      await newSol.save();
      await newSol.populate([
        { path: 'creator', select: 'firstName lastName email' },
        { path: 'participants.user', select: 'firstName lastName' }
      ]);

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

  static getUserSols = async (req, res) => {
    try {
      const { 
        status = 'all', type, page = 1, limit = 20,
        sortBy = 'lastActivityDate', sortOrder = 'desc', includeAnalytics = false
      } = req.query;

      const filter = {
        $or: [
          { creator: req.user.userId },
          { 'participants.user': req.user.userId }
        ]
      };

      if (status !== 'all') filter.status = status;
      if (type) filter.type = type;

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [sols, totalCount] = await Promise.all([
        Sol.find(filter)
          .populate('creator', 'firstName lastName email')
          .populate('participants.user', 'firstName lastName')
          .populate('rounds.recipient', 'firstName lastName')
          .populate('rounds.payments.payer', 'firstName lastName')
          .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
          .skip(skip)
          .limit(parseInt(limit)),
        Sol.countDocuments(filter)
      ]);

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

      let analytics = null;
      if (includeAnalytics) {
        analytics = await this.generateUserSolAnalytics(req.user.userId, sols);
      }

      res.status(200).json({
        success: true,
        data: {
          sols: enrichedSols,
          pagination: {
            page: parseInt(page), limit: parseInt(limit),
            total: totalCount, pages: Math.ceil(totalCount / parseInt(limit))
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

      const hasAccess = sol.creator._id.toString() === req.user.userId ||
                       sol.participants.some(p => p.user._id.toString() === req.user.userId);

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Accès non autorisé à ce sol',
          error: 'unauthorized_sol_access'
        });
      }

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

      let transactionHistory = null;
      if (includeHistory) {
        transactionHistory = await Transaction.find({
          'metadata.solId': sol._id,
          user: req.user.userId
        }).sort({ date: -1 }).limit(50);
      }

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
      const sol = await Sol.findByAccessCode(accessCode);

      if (!sol) {
        return res.status(404).json({
          success: false,
          message: 'Code d\'accès invalide ou sol non disponible',
          error: 'invalid_access_code'
        });
      }

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

      const newPosition = sol.participants.length + 1;
      sol.participants.push({
        user: req.user.userId,
        position: newPosition,
        joinedAt: new Date(),
        role: 'participant',
        paymentStatus: 'pending'
      });

      if (sol.rounds[newPosition - 1]) {
        sol.rounds[newPosition - 1].recipient = req.user.userId;
      }

      if (sol.participants.length === sol.maxParticipants) {
        sol.status = 'active';
        sol.actualStartDate = new Date();
        await this.schedulePaymentNotifications(sol);
      }

      await sol.save();
      await sol.populate([
        { path: 'creator', select: 'firstName lastName' },
        { path: 'participants.user', select: 'firstName lastName' }
      ]);

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

      if (sol.status === 'active') {
        if (sol.creator.toString() === req.user.userId) {
          return res.status(400).json({
            success: false,
            message: 'Le créateur ne peut pas quitter un sol actif',
            error: 'creator_cannot_leave_active_sol'
          });
        }

        const userRound = sol.rounds[participant.position - 1];
        if (userRound && userRound.status === 'completed') {
          return res.status(400).json({
            success: false,
            message: 'Impossible de quitter après avoir reçu votre tour',
            error: 'cannot_leave_after_receiving'
          });
        }

        const penalty = sol.contributionAmount * 0.1;
        return res.status(400).json({
          success: false,
          message: `Quitter ce sol actif entraîne une pénalité de ${penalty} ${sol.currency}`,
          error: 'early_leave_penalty',
          penalty: penalty
        });
      }

      sol.participants.splice(participantIndex, 1);
      sol.participants.forEach((p, index) => {
        p.position = index + 1;
      });

      sol.rounds = this.regenerateRounds(sol);

      if (sol.participants.length < 3) {
        sol.status = 'cancelled';
        sol.cancellationReason = 'Insufficient participants';
      }

      await sol.save();
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

  static makePayment = async (req, res) => {
    try {
      const { id } = req.params;
      const { accountId, amount, roundIndex, notes } = req.body;

      const sol = await Sol.findById(id).populate('participants.user', 'firstName lastName');

      if (!sol) {
        return res.status(404).json({
          success: false,
          message: 'Sol introuvable',
          error: 'sol_not_found'
        });
      }

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

      const session = await mongoose.startSession();
      await session.withTransaction(async () => {
        account.balance -= amount;
        await account.save({ session });

        targetRound.payments.push({
          payer: req.user.userId,
          amount: amount,
          date: new Date(),
          status: 'completed',
          notes: notes
        });

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
          tags: [
            'sol_payment',
            `sol_type_${sol.type}`,
            `frequency_${sol.frequency}`,
            `position_${participant.position}`
          ]
        });

        await transaction.save({ session });

        if (targetRound.payments.length === sol.participants.length) {
          targetRound.status = 'completed';
          targetRound.completedDate = new Date();
          
          const totalAmount = targetRound.payments.reduce((sum, p) => sum + p.amount, 0);
          await this.transferToRecipient(sol, targetRound, totalAmount, session);
          
          const nextRoundIndex = sol.rounds.indexOf(targetRound) + 1;
          if (sol.rounds[nextRoundIndex]) {
            sol.rounds[nextRoundIndex].status = 'active';
            sol.rounds[nextRoundIndex].startDate = new Date();
          } else {
            sol.status = 'completed';
            sol.completedDate = new Date();
          }
        }

        sol.metrics.totalCollected += amount;
        sol.lastActivityDate = new Date();
        await sol.save({ session });
      });

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
  // 5. ANALYTICS ET DÉCOUVERTE
  // ===================================================================

  static getPersonalAnalytics = async (req, res) => {
    try {
      const { timeframe = 90 } = req.query;
      const startDate = new Date(Date.now() - timeframe * 24 * 60 * 60 * 1000);

      const userSols = await Sol.find({
        $or: [
          { creator: req.user.userId },
          { 'participants.user': req.user.userId }
        ],
        createdAt: { $gte: startDate }
      }).populate('participants.user', 'firstName lastName');

      const solTransactions = await Transaction.find({
        user: req.user.userId,
        category: 'sols',
        date: { $gte: startDate }
      });

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

  static discoverSols = async (req, res) => {
    try {
      const { 
        type, minAmount, maxAmount, currency = 'HTG', region, page = 1, limit = 20 
      } = req.query;

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

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const availableSols = await Sol.find(filter)
        .populate('creator', 'firstName lastName region')
        .populate('participants.user', 'firstName lastName')
        .sort({ createdAt: -1, participantCount: -1 })
        .skip(skip)
        .limit(parseInt(limit));

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
  // MÉTHODES UTILITAIRES
  // ===================================================================

  static async generateUniqueAccessCode() {
    let code;
    let exists = true;
    
    while (exists) {
      code = Math.random().toString(36).substring(2, 8).toUpperCase();
      exists = await Sol.findOne({ accessCode: code });
    }
    
    return code;
  }

  static generateRounds(maxParticipants, startDate, frequency) {
    const rounds = [];
    let currentDate = new Date(startDate);

    for (let i = 0; i < maxParticipants; i++) {
      rounds.push({
        roundNumber: i + 1,
        startDate: new Date(currentDate),
        endDate: new Date(currentDate.getTime() + this.getFrequencyDuration(frequency)),
        status: i === 0 ? 'pending' : 'scheduled',
        recipient: null,
        payments: []
      });

      currentDate = this.addFrequencyToDate(currentDate, frequency);
    }

    return rounds;
  }

  static getFrequencyDuration(frequency) {
    const durations = {
      'weekly': 7 * 24 * 60 * 60 * 1000,
      'biweekly': 14 * 24 * 60 * 60 * 1000,
      'monthly': 30 * 24 * 60 * 60 * 1000,
      'quarterly': 90 * 24 * 60 * 60 * 1000
    };
    return durations[frequency] || durations.monthly;
  }

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

  static async transferToRecipient(sol, round, amount, session) {
    try {
      const recipientAccount = await Account.findOne({
        user: round.recipient,
        isPrimary: true,
        isActive: true
      }).session(session);

      if (recipientAccount) {
        recipientAccount.balance += amount;
        await recipientAccount.save({ session });

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
  // MÉTHODES ANALYTICS POUR IA
  // ===================================================================

  static async calculateUserAvgContribution(userId) {
    try {
      const userSols = await Sol.find({
        $or: [
          { creator: userId },
          { 'participants.user': userId }
        ]
      });

      if (userSols.length === 0) return 0;

      const totalContribution = userSols.reduce((sum, sol) => sum + sol.contributionAmount, 0);
      return Math.round(totalContribution / userSols.length);
    } catch (error) {
      console.error('❌ Erreur calcul contribution moyenne:', error.message);
      return 0;
    }
  }

  static async getUserPreferredType(userId) {
    try {
      const userSols = await Sol.find({
        $or: [
          { creator: userId },
          { 'participants.user': userId }
        ]
      });

      if (userSols.length === 0) return 'classic';

      const typeCount = {};
      userSols.forEach(sol => {
        typeCount[sol.type] = (typeCount[sol.type] || 0) + 1;
      });

      return Object.keys(typeCount).reduce((a, b) => 
        typeCount[a] > typeCount[b] ? a : b
      );
    } catch (error) {
      console.error('❌ Erreur type préféré:', error.message);
      return 'classic';
    }
  }

  static async generateUserSolAnalytics(userId, sols) {
    try {
      if (!sols || sols.length === 0) {
        return {
          totalSols: 0,
          activeSols: 0,
          completedSols: 0,
          avgContribution: 0,
          patterns: {
            preferredType: 'classic',
            avgParticipants: 0,
            successRate: 0
          }
        };
      }

      const analytics = {
        totalSols: sols.length,
        activeSols: sols.filter(s => s.status === 'active').length,
        completedSols: sols.filter(s => s.status === 'completed').length,
        avgContribution: Math.round(
          sols.reduce((sum, s) => sum + s.contributionAmount, 0) / sols.length
        ),
        patterns: {
          preferredType: this.analyzeSolTypePreferences(sols)[0]?.type || 'classic',
          avgParticipants: Math.round(
            sols.reduce((sum, s) => s.participants.length, 0) / sols.length
          ),
          successRate: this.calculateSuccessRate(sols, userId)
        }
      };

      return analytics;
    } catch (error) {
      console.error('❌ Erreur analytics génération:', error.message);
      return null;
    }
  }

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

  static analyzeParticipationPatterns(userSols, userId) {
    const patterns = {
      asCreator: 0,
      asParticipant: 0,
      avgSolSize: 0,
      preferredPositions: []
    };

    userSols.forEach(sol => {
      if (sol.creator.toString() === userId) {
        patterns.asCreator++;
      } else {
        patterns.asParticipant++;
        const userParticipant = sol.participants.find(p => 
          p.user.toString() === userId || p.user._id?.toString() === userId
        );
        if (userParticipant) {
          patterns.preferredPositions.push(userParticipant.position);
        }
      }
    });

    patterns.avgSolSize = userSols.length > 0 ? 
      Math.round(userSols.reduce((sum, s) => sum + s.participants.length, 0) / userSols.length) : 0;

    return patterns;
  }

  static calculateSuccessRate(userSols, userId) {
    const completedSols = userSols.filter(sol => sol.status === 'completed');
    const totalSols = userSols.filter(sol => sol.status !== 'recruiting');

    return totalSols.length > 0 ? 
      Math.round((completedSols.length / totalSols.length) * 100) : 0;
  }

  static calculateMonthlyCommitment(userSols) {
    try {
      const activeSols = userSols.filter(sol => sol.status === 'active');
      
      return activeSols.reduce((total, sol) => {
        const monthlyAmount = sol.frequency === 'weekly' ? sol.contributionAmount * 4 :
                             sol.frequency === 'biweekly' ? sol.contributionAmount * 2 :
                             sol.frequency === 'quarterly' ? sol.contributionAmount / 3 :
                             sol.contributionAmount;
        
        return total + monthlyAmount;
      }, 0);
    } catch (error) {
      console.error('❌ Erreur calcul engagement mensuel:', error.message);
      return 0;
    }
  }

  static calculateROI(userSols, userId) {
    try {
      const completedSols = userSols.filter(sol => sol.status === 'completed');
      
      if (completedSols.length === 0) return { roi: 0, analysis: 'Aucun sol terminé' };

      let totalInvested = 0;
      let totalReceived = 0;

      completedSols.forEach(sol => {
        const userParticipant = sol.participants.find(p => 
          p.user.toString() === userId || p.user._id?.toString() === userId
        );
        
        if (userParticipant) {
          totalInvested += sol.contributionAmount * (sol.rounds?.length || sol.maxParticipants);
          totalReceived += userParticipant.receivedAmount || (sol.contributionAmount * sol.maxParticipants);
        }
      });

      const roi = totalInvested > 0 ? ((totalReceived - totalInvested) / totalInvested) * 100 : 0;
      
      return {
        roi: Math.round(roi * 100) / 100,
        totalInvested,
        totalReceived,
        analysis: roi > 0 ? 'ROI positif' : roi === 0 ? 'ROI neutre' : 'ROI négatif'
      };
    } catch (error) {
      console.error('❌ Erreur calcul ROI:', error.message);
      return { roi: 0, analysis: 'Erreur calcul' };
    }
  }

  static analyzeCashFlowImpact(solTransactions) {
    try {
      const monthlyFlow = {};
      
      solTransactions.forEach(tx => {
        const monthKey = `${tx.date.getFullYear()}-${tx.date.getMonth() + 1}`;
        
        if (!monthlyFlow[monthKey]) {
          monthlyFlow[monthKey] = { out: 0, in: 0 };
        }
        
        if (tx.type === 'expense') {
          monthlyFlow[monthKey].out += tx.amount;
        } else if (tx.type === 'income') {
          monthlyFlow[monthKey].in += tx.amount;
        }
      });

      const months = Object.keys(monthlyFlow);
      if (months.length === 0) {
        return { avgMonthlyOut: 0, avgMonthlyIn: 0, netFlow: 0, volatility: 0 };
      }

      const avgOut = months.reduce((sum, month) => sum + monthlyFlow[month].out, 0) / months.length;
      const avgIn = months.reduce((sum, month) => sum + monthlyFlow[month].in, 0) / months.length;

      return {
        avgMonthlyOut: Math.round(avgOut),
        avgMonthlyIn: Math.round(avgIn),
        netFlow: Math.round(avgIn - avgOut),
        volatility: this.calculateVolatility(Object.values(monthlyFlow))
      };
    } catch (error) {
      console.error('❌ Erreur analyse cash flow:', error.message);
      return { avgMonthlyOut: 0, avgMonthlyIn: 0, netFlow: 0, volatility: 0 };
    }
  }

  static calculateVolatility(flowData) {
    try {
      if (flowData.length < 2) return 0;
      
      const netFlows = flowData.map(f => f.in - f.out);
      const mean = netFlows.reduce((sum, flow) => sum + flow, 0) / netFlows.length;
      const variance = netFlows.reduce((sum, flow) => sum + Math.pow(flow - mean, 2), 0) / netFlows.length;
      
      return Math.round(Math.sqrt(variance));
    } catch (error) {
      return 0;
    }
  }

  static calculateCompletionRate(userSols, userId) {
    try {
      const totalSols = userSols.filter(sol => sol.status !== 'recruiting').length;
      const completedSols = userSols.filter(sol => sol.status === 'completed').length;
      
      return totalSols > 0 ? Math.round((completedSols / totalSols) * 100) : 0;
    } catch (error) {
      console.error('❌ Erreur taux completion:', error.message);
      return 0;
    }
  }

  static calculatePunctualityScore(solTransactions) {
    try {
      if (solTransactions.length === 0) return 50;
      
      const onTimeTransactions = solTransactions.filter(tx => {
        const txDate = new Date(tx.date);
        return txDate.getDate() <= 5;
      });

      return Math.round((onTimeTransactions.length / solTransactions.length) * 100);
    } catch (error) {
      console.error('❌ Erreur score ponctualité:', error.message);
      return 50;
    }
  }

  static calculateRiskProfile(userSols) {
    try {
      if (userSols.length === 0) return 'nouveau';
      
      const completedRate = this.calculateCompletionRate(userSols);
      const cancelledSols = userSols.filter(s => s.status === 'cancelled').length;

      if (completedRate >= 90 && cancelledSols === 0) return 'très faible';
      if (completedRate >= 75) return 'faible';
      if (completedRate >= 50) return 'moyen';
      if (cancelledSols > 2 || completedRate < 30) return 'élevé';
      
      return 'moyen';
    } catch (error) {
      console.error('❌ Erreur profil risque:', error.message);
      return 'moyen';
    }
  }

  static async predictNextContribution(userId, userSols) {
    try {
      if (userSols.length === 0) {
        return { amount: 1000, confidence: 0, reasoning: 'Nouvel utilisateur' };
      }

      const avgAmount = userSols.reduce((sum, s) => sum + s.contributionAmount, 0) / userSols.length;
      const recentSols = userSols.slice(-3);
      const trend = recentSols.length > 1 ? 
        (recentSols[recentSols.length - 1].contributionAmount - recentSols[0].contributionAmount) / recentSols.length : 0;

      const predictedAmount = Math.round(avgAmount + trend);
      const confidence = Math.min(userSols.length * 20, 90);

      return {
        amount: Math.max(predictedAmount, 500),
        confidence: confidence,
        reasoning: `Basé sur ${userSols.length} sols précédents`
      };
    } catch (error) {
      console.error('❌ Erreur prédiction contribution:', error.message);
      return { amount: 1000, confidence: 0, reasoning: 'Erreur calcul' };
    }
  }

  static predictCompletionProbability(userSols, userId) {
    try {
      if (userSols.length === 0) return 70;

      const completionRate = this.calculateCompletionRate(userSols, userId);
      const cancelledRate = (userSols.filter(s => s.status === 'cancelled').length / userSols.length) * 100;

      let probability = completionRate;
      
      if (cancelledRate > 20) probability -= 15;
      if (userSols.length > 5) probability += 10;

      return Math.max(Math.min(Math.round(probability), 95), 5);
    } catch (error) {
      return 70;
    }
  }

  static suggestOptimalTiming(solTransactions) {
    try {
      if (solTransactions.length === 0) {
        return { day: 1, reasoning: 'Début de mois recommandé par défaut' };
      }

      const dayFrequency = {};
      solTransactions.forEach(tx => {
        const day = new Date(tx.date).getDate();
        dayFrequency[day] = (dayFrequency[day] || 0) + 1;
      });

      const optimalDay = Object.keys(dayFrequency).reduce((a, b) => 
        dayFrequency[a] > dayFrequency[b] ? a : b
      );

      return {
        day: parseInt(optimalDay),
        reasoning: `Votre pattern habituel: jour ${optimalDay} du mois`
      };
    } catch (error) {
      return { day: 1, reasoning: 'Début de mois par défaut' };
    }
  }

  static async generatePersonalRecommendations(userId, userSols) {
    const recommendations = [];

    const avgAmount = userSols.length > 0 ? 
      userSols.reduce((sum, s) => sum + s.contributionAmount, 0) / userSols.length : 0;
    const completionRate = this.calculateSuccessRate(userSols, userId);

    if (avgAmount < 1000) {
      recommendations.push({
        type: 'amount_optimization',
        title: 'Augmenter montant contribution',
        description: 'Vos contributions moyennes sont faibles.',
        confidence: 0.7,
        actionable: true
      });
    }

    if (completionRate < 80) {
      recommendations.push({
        type: 'commitment_improvement',
        title: 'Améliorer engagement',
        description: 'Choisir des montants adaptés améliorerait votre taux de réussite.',
        confidence: 0.9,
        actionable: true
      });
    }

    return recommendations;
  }

  static assessDataQuality(sols, transactions) {
    let score = 0;
    
    if (sols.length >= 3) score += 30;
    if (transactions.length >= 10) score += 30;
    if (sols.some(s => s.status === 'completed')) score += 20;
    if (transactions.length >= 20) score += 20;

    return Math.min(score, 100);
  }

  static calculateRelevanceScore(sol, userSols, user) {
    let score = 0;

    const userTypes = userSols.map(s => s.type);
    if (userTypes.includes(sol.type)) score += 30;

    if (sol.participants.length > sol.maxParticipants * 0.5) score += 20;
    if (sol.currency === 'HTG') score += 15;
    if (!sol.isPrivate) score += 10;

    return Math.min(score, 100);
  }

  // Méthodes stubs
  static async schedulePaymentNotifications(sol) {
    console.log('Planning notifications pour sol:', sol.name);
  }

  static async collectCreationAnalytics(userId, sol) {
    console.log('Creation analytics pour:', userId);
  }

  static async collectJoinAnalytics(userId, sol) {
    console.log('Join analytics pour:', userId);
  }

  static async collectLeaveAnalytics(userId, sol, reason) {
    console.log('Leave analytics pour:', userId);
  }

  static async collectPaymentAnalytics(userId, sol, round, amount) {
    console.log('Payment analytics pour:', userId);
  }

  static async collectViewAnalytics(userId, solId) {
    console.log('View analytics pour:', userId);
  }

  static async collectDiscoveryAnalytics(userId, filter, results) {
    console.log('Discovery analytics pour:', userId);
  }

  static async storeAnalyticsForIA(userId, analytics) {
    console.log('Storing IA analytics pour:', userId);
  }

  static async generateSolRecommendations(sol, userId) {
    return [{
      type: 'timing_optimization',
      title: 'Optimiser timing paiements',
      description: 'Payer en début de mois améliore votre score',
      confidence: 0.8
    }];
  }

  static async generateDiscoveryRecommendations(userId, userSols) {
    return [{
      type: 'diversification',
      title: 'Diversifier types de sols',
      description: 'Essayer différents types peut optimiser vos rendements',
      confidence: 0.7
    }];
  }

  static regenerateRounds(sol) {
    return this.generateRounds(sol.participants.length, sol.startDate, sol.frequency);
  }

  static estimateStartDate(sol) {
    const spotsLeft = sol.maxParticipants - sol.participants.length;
    const estimatedDays = spotsLeft * 2;
    const estimatedDate = new Date();
    estimatedDate.setDate(estimatedDate.getDate() + estimatedDays);
    return estimatedDate;
  }

  static calculateCompatibility(sol, userSols) {
    if (userSols.length === 0) return 'nouveau';
    
    const avgAmount = userSols.reduce((sum, s) => sum + s.contributionAmount, 0) / userSols.length;
    const amountDiff = Math.abs(sol.contributionAmount - avgAmount) / avgAmount;
    
    if (amountDiff < 0.2) return 'élevée';
    if (amountDiff < 0.5) return 'moyenne';
    return 'faible';
  }

  static assessRiskLevel(sol) {
    let riskScore = 0;
    
    if (sol.participants.length < sol.maxParticipants * 0.5) riskScore += 2;
    if (sol.contributionAmount > 5000) riskScore += 1;
    if (sol.isPrivate) riskScore += 1;
    
    if (riskScore >= 3) return 'élevé';
    if (riskScore === 2) return 'moyen';
    return 'faible';
  }

  static async getAvailableTypes() {
    const types = await Sol.distinct('type', { status: 'recruiting', isPrivate: false });
    return types.map(type => ({ value: type, label: type }));
  }

  static async getAmountRanges(currency) {
    const amounts = await Sol.find({ 
      status: 'recruiting', 
      currency: currency,
      isPrivate: false 
    }).select('contributionAmount');
    
    if (amounts.length === 0) return [];
    
    const values = amounts.map(a => a.contributionAmount).sort((a, b) => a - b);
    const min = values[0];
    const max = values[values.length - 1];
    const mid = Math.round((min + max) / 2);
    
    return [
      { min: min, max: mid, label: `${min} - ${mid} ${currency}` },
      { min: mid, max: max, label: `${mid} - ${max} ${currency}` }
    ];
  }

  static async getPopularRegions() {
    return [{ region: 'Port-au-Prince', count: 5 }];
  }
}

// ===================================================================
// VALIDATIONS MIDDLEWARE
// ===================================================================

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

SolController.validateJoinSol = [
  body('accessCode')
    .isLength({ min: 6, max: 6 })
    .isAlphanumeric()
    .withMessage('Code d\'accès invalide (6 caractères alphanumériques)')
];

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