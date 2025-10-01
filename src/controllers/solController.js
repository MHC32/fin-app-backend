// src/controllers/solController.js
// Controller pour gestion sols/tontines - FinApp Haiti
// Version refactorisée avec errorHandler.js intégré
// FICHIER COMPLET

const Sol = require('../models/Sol');
const User = require('../models/User');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const mongoose = require('mongoose');
const solNotifications = require('../integrations/solNotifications');

// ===================================================================
// IMPORT errorHandler.js INTÉGRÉ
// ===================================================================
const { catchAsync, NotFoundError, ValidationError, BusinessLogicError } = require('../middleware/errorHandler');

class SolController {

  // ===================================================================
  // MÉTHODE UTILITAIRE POUR COMPARAISON SÉCURISÉE DES IDs
  // ===================================================================

  static compareUserIds(id1, id2) {
    try {
      if (!id1 || !id2) return false;
      const str1 = id1.toString ? id1.toString() : String(id1);
      const str2 = id2.toString ? id2.toString() : String(id2);
      return str1 === str2;
    } catch (error) {
      console.error('❌ Erreur comparaison IDs:', error);
      return false;
    }
  }

  // ===================================================================
  // 1. CRÉATION SOL
  // ===================================================================

  static createSol = catchAsync(async (req, res) => {
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
      throw new BusinessLogicError('Limite de 5 sols actifs simultanés atteinte');
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

    // Notifier création sol
    await solNotifications.notifySolCreated(req.user.userId, newSol);
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
  });

  // ===================================================================
  // 2. LECTURE SOLS UTILISATEUR
  // ===================================================================

  static getUserSols = catchAsync(async (req, res) => {
    const {
      status = 'all',
      type,
      page = 1,
      limit = 20,
      sortBy = 'lastActivityDate',
      sortOrder = 'desc',
      includeAnalytics = false
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
        this.compareUserIds(p.user._id, req.user.userId)
      );
      const nextRound = sol.rounds.find(r => r.status === 'pending');
      const nextPaymentDue = sol.getNextPaymentDate ? sol.getNextPaymentDate() : null;

      return {
        ...sol.toJSON(),
        userRole: this.compareUserIds(sol.creator._id, req.user.userId) ? 'creator' : 'participant',
        userPosition: userParticipation?.position,
        nextRoundIndex: nextRound ? sol.rounds.indexOf(nextRound) + 1 : null,
        daysUntilNextPayment: nextPaymentDue ?
          Math.ceil((nextPaymentDue - new Date()) / (1000 * 60 * 60 * 24)) : null,
        turnsUntilMe: this.calculateTurnsUntilUser(sol, req.user.userId)
      };
    });

    let analytics = null;
    if (includeAnalytics === 'true') {
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
  });

  // ===================================================================
  // 3. LECTURE SOL PAR ID
  // ===================================================================

  static getSolById = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { includeHistory = false } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError('ID de sol invalide');
    }

    const sol = await Sol.findById(id)
      .populate('creator', 'firstName lastName email phone')
      .populate('participants.user', 'firstName lastName email phone')
      .populate('rounds.recipient', 'firstName lastName')
      .populate('rounds.payments.payer', 'firstName lastName');

    if (!sol) {
      throw new NotFoundError('Sol introuvable');
    }

    // Vérifier accès
    const hasAccess = this.compareUserIds(sol.creator._id, req.user.userId) ||
      sol.participants.some(p =>
        p.user && this.compareUserIds(p.user._id, req.user.userId)
      );

    if (!hasAccess) {
      throw new BusinessLogicError('Accès non autorisé à ce sol');
    }

    const completedRounds = sol.rounds ? sol.rounds.filter(r => r.status === 'completed').length : 0;
    const totalRounds = sol.rounds ? sol.rounds.length : 0;

    const enrichedSol = {
      ...sol.toJSON(),
      userRole: this.compareUserIds(sol.creator._id, req.user.userId) ? 'creator' : 'participant',
      progress: {
        completedRounds: completedRounds,
        totalRounds: totalRounds,
        percentage: totalRounds > 0 ? Math.round((completedRounds / totalRounds) * 100) : 0
      },
      financial: {
        totalContributed: sol.contributionAmount * completedRounds,
        expectedTotal: sol.contributionAmount * totalRounds,
        pendingAmount: sol.contributionAmount * (totalRounds - completedRounds)
      },
      timeline: {
        nextPaymentDate: sol.getNextPaymentDate ? sol.getNextPaymentDate() : null,
        estimatedEndDate: sol.calculateEndDate ? sol.calculateEndDate() : null,
        daysRemaining: sol.calculateDaysRemaining ? sol.calculateDaysRemaining() : null
      }
    };

    let transactionHistory = null;
    if (includeHistory === 'true') {
      transactionHistory = await Transaction.find({
        'metadata.solId': sol._id,
        user: req.user.userId
      }).sort({ date: -1 }).limit(50);
    }

    res.status(200).json({
      success: true,
      data: {
        sol: enrichedSol,
        transactionHistory: transactionHistory
      },
      timestamp: new Date().toISOString()
    });
  });

  // ===================================================================
  // 4. MISE À JOUR SOL
  // ===================================================================

  static updateSol = catchAsync(async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError('ID de sol invalide');
    }

    const sol = await Sol.findById(id);

    if (!sol) {
      throw new NotFoundError('Sol introuvable');
    }

    // Vérifier que l'utilisateur est le créateur
    if (!this.compareUserIds(sol.creator, req.user.userId)) {
      throw new BusinessLogicError('Seul le créateur peut modifier ce sol');
    }

    // Vérifier que le sol peut être modifié
    if (sol.status === 'active' || sol.status === 'completed') {
      throw new BusinessLogicError('Impossible de modifier un sol actif ou terminé');
    }

    // TODO: Implémenter la logique de mise à jour
    res.status(501).json({
      success: false,
      message: 'Mise à jour sol - À implémenter',
      error: 'not_implemented'
    });
  });

  // ===================================================================
  // 5. SUPPRESSION/ANNULATION SOL
  // ===================================================================

  static deleteSol = catchAsync(async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError('ID de sol invalide');
    }

    const sol = await Sol.findById(id);

    if (!sol) {
      throw new NotFoundError('Sol introuvable');
    }

    // Vérifier que l'utilisateur est le créateur
    if (!this.compareUserIds(sol.creator, req.user.userId)) {
      throw new BusinessLogicError('Seul le créateur peut supprimer ce sol');
    }

    // Vérifier que le sol peut être supprimé
    if (sol.status === 'active') {
      throw new BusinessLogicError('Impossible de supprimer un sol actif. Utilisez l\'annulation.');
    }

    // TODO: Implémenter la logique de suppression/annulation
    res.status(501).json({
      success: false,
      message: 'Suppression sol - À implémenter',
      error: 'not_implemented'
    });
  });

  // ===================================================================
  // 6. REJOINDRE UN SOL
  // ===================================================================

  static joinSol = catchAsync(async (req, res) => {
    const { accessCode } = req.body;

    // Trouver le sol avec le code d'accès
    const sol = await Sol.findOne({
      accessCode: accessCode.toUpperCase(),
      status: 'recruiting'
    })
      .populate('participants.user', 'firstName lastName')
      .populate('creator', 'firstName lastName');

    if (!sol) {
      throw new NotFoundError('Code d\'accès invalide ou sol non disponible');
    }

    if (sol.status !== 'recruiting') {
      throw new BusinessLogicError('Ce sol n\'accepte plus de nouveaux participants');
    }

    if (sol.participants.length >= sol.maxParticipants) {
      throw new BusinessLogicError('Ce sol est complet');
    }

    // Vérifier si l'utilisateur est déjà membre
    const alreadyMember = sol.participants.some(p =>
      this.compareUserIds(p.user._id, req.user.userId)
    );

    if (alreadyMember) {
      throw new BusinessLogicError('Vous participez déjà à ce sol');
    }

    const newPosition = sol.participants.length + 1;

    if (newPosition > sol.maxParticipants) {
      throw new ValidationError('Erreur: position invalide');
    }

    // Ajouter le participant
    sol.participants.push({
      user: req.user.userId,
      position: newPosition,
      joinedAt: new Date(),
      role: 'participant',
      paymentStatus: 'pending'
    });

    // Assigner le bénéficiaire au round correspondant
    if (sol.rounds && sol.rounds.length >= newPosition) {
      sol.rounds[newPosition - 1].recipient = req.user.userId;
    }

    // Vérifier si le sol est complet
    if (sol.participants.length === sol.maxParticipants) {
      sol.status = 'active';
      sol.actualStartDate = new Date();
      await this.schedulePaymentNotifications(sol);
      
      // Notifier démarrage sol
      await solNotifications.notifySolStarted(sol);
    } else {
      // Notifier nouveau participant
      const newParticipant = sol.participants[sol.participants.length - 1];
      await sol.populate('participants.user', 'firstName lastName');
      
      const participantData = {
        user: newParticipant.user._id || req.user.userId,
        name: newParticipant.user.firstName + ' ' + newParticipant.user.lastName
      };
      
      await solNotifications.notifyParticipantJoined(sol, participantData);
    }

    sol.lastActivityDate = new Date();
    await sol.save();

    // Re-peupler pour avoir les données fraîches
    await sol.populate([
      { path: 'creator', select: 'firstName lastName' },
      { path: 'participants.user', select: 'firstName lastName' }
    ]);

    await this.collectJoinAnalytics(req.user.userId, sol);

    res.status(200).json({
      success: true,
      message: 'Vous avez rejoint le sol avec succès',
      data: {
        sol: {
          _id: sol._id,
          name: sol.name,
          status: sol.status,
          participants: sol.participants
        },
        yourPosition: newPosition,
        yourRoundNumber: newPosition,
        status: sol.status,
        nextSteps: sol.status === 'active' ?
          ['Le sol a démarré !', 'Préparez votre premier paiement'] :
          [`En attente de ${sol.maxParticipants - sol.participants.length} participant(s)`]
      },
      timestamp: new Date().toISOString()
    });
  });

  // ===================================================================
  // 7. QUITTER UN SOL
  // ===================================================================

  static leaveSol = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError('ID de sol invalide');
    }

    const sol = await Sol.findById(id);

    if (!sol) {
      throw new NotFoundError('Sol introuvable');
    }

    // Trouver l'index du participant (SANS populate pour éviter les bugs)
    const participantIndex = sol.participants.findIndex(p =>
      this.compareUserIds(p.user, req.user.userId)
    );

    if (participantIndex === -1) {
      throw new BusinessLogicError('Vous ne participez pas à ce sol');
    }

    const participant = sol.participants[participantIndex];

    // Vérifier si c'est le créateur
    const isCreator = this.compareUserIds(sol.creator, req.user.userId);

    // Restrictions pour sol actif
    if (sol.status === 'active') {
      if (isCreator) {
        throw new BusinessLogicError('Le créateur ne peut pas quitter un sol actif');
      }

      // Vérifier si le participant a des paiements en cours
      const hasPayments = sol.rounds.some(r =>
        r.payments.some(p => this.compareUserIds(p.payer, req.user.userId))
      );

      if (hasPayments) {
        throw new BusinessLogicError('Vous avez des paiements en cours. Annulation impossible.');
      }
    }

    // Retirer le participant
    sol.participants.splice(participantIndex, 1);

    // Réorganiser les positions des participants restants
    sol.participants.forEach((p, index) => {
      p.position = index + 1;
    });

    // Regénérer les rounds avec le nouveau nombre de participants
    if (sol.participants.length > 0) {
      sol.rounds = this.regenerateRounds(sol);
    }

    // Vérifier si le sol doit être annulé (moins de 3 participants)
    if (sol.participants.length < 3) {
      sol.status = 'cancelled';
      sol.cancellationReason = 'Nombre insuffisant de participants';
      sol.cancelledDate = new Date();
    }

    sol.lastActivityDate = new Date();
    await sol.save();

    await this.collectLeaveAnalytics(req.user.userId, sol, reason);

    res.status(200).json({
      success: true,
      message: 'Vous avez quitté le sol avec succès',
      data: {
        solStatus: sol.status,
        remainingParticipants: sol.participants.length,
        reason: reason,
        cancellation: sol.status === 'cancelled' ? {
          reason: sol.cancellationReason,
          date: sol.cancelledDate
        } : null
      },
      timestamp: new Date().toISOString()
    });
  });

  // ===================================================================
  // 8. ENREGISTRER UN PAIEMENT
  // ===================================================================

  static recordPayment = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { accountId, amount, notes } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError('ID de sol invalide');
    }

    if (!mongoose.Types.ObjectId.isValid(accountId)) {
      throw new ValidationError('ID de compte invalide');
    }

    const sol = await Sol.findById(id)
      .populate('participants.user', 'firstName lastName')
      .populate('rounds.recipient', 'firstName lastName');

    if (!sol) {
      throw new NotFoundError('Sol introuvable');
    }

    if (sol.status !== 'active') {
      throw new BusinessLogicError('Le sol n\'est pas actif');
    }

    // Vérifier que l'utilisateur est participant
    const participant = sol.participants.find(p =>
      this.compareUserIds(p.user._id, req.user.userId)
    );

    if (!participant) {
      throw new BusinessLogicError('Vous ne participez pas à ce sol');
    }

    // Trouver le round actif
    const activeRound = sol.rounds.find(r => r.status === 'active');
    if (!activeRound) {
      throw new BusinessLogicError('Aucun round actif pour ce sol');
    }

    const targetRound = activeRound;

    // Vérifier si l'utilisateur a déjà payé pour ce round
    const alreadyPaid = targetRound.payments.some(p =>
      this.compareUserIds(p.payer, req.user.userId)
    );

    if (alreadyPaid) {
      throw new BusinessLogicError('Vous avez déjà payé pour ce round');
    }

    // Vérifier le montant
    if (amount < sol.contributionAmount) {
      throw new ValidationError(`Le montant minimum est ${sol.contributionAmount} ${sol.currency}`);
    }

    // Vérifier le compte
    const account = await Account.findOne({
      _id: accountId,
      user: req.user.userId,
      isActive: true
    });

    if (!account) {
      throw new NotFoundError('Compte introuvable ou inactif');
    }

    if (account.balance < amount) {
      throw new BusinessLogicError('Solde insuffisant');
    }

    // Transaction MongoDB pour atomicité
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Débiter le compte
      account.balance -= amount;
      await account.save({ session });

      // Enregistrer le paiement dans le round
      targetRound.payments.push({
        payer: req.user.userId,
        amount: amount,
        date: new Date(),
        status: 'completed',
        notes: notes || ''
      });

      // Créer la transaction
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

      // Vérifier si le round est terminé
      if (targetRound.payments.length === sol.participants.length) {
        targetRound.status = 'completed';
        targetRound.completedDate = new Date();

        const totalAmount = targetRound.payments.reduce((sum, p) => sum + p.amount, 0);
        await this.transferToRecipient(sol, targetRound, totalAmount, session);

        // Notifier bénéficiaire - paiements complets
        await solNotifications.notifyPaymentReceived(targetRound.recipient, {
          solId: sol._id,
          solName: sol.name,
          amount: totalAmount,
          payerName: 'Tous les participants',
          turnNumber: targetRound.roundNumber,
          totalReceived: totalAmount,
          totalExpected: totalAmount
        });

        // Activer le round suivant ou terminer le sol
        const nextRoundIndex = sol.rounds.indexOf(targetRound) + 1;
        if (sol.rounds[nextRoundIndex]) {
          sol.rounds[nextRoundIndex].status = 'active';
          sol.rounds[nextRoundIndex].startDate = new Date();
        } else {
          sol.status = 'completed';
          sol.completedDate = new Date();
          
          // Notifier sol complété
          await solNotifications.notifySolCompleted(sol);
        }
      } else {
        // Notifier bénéficiaire - paiement partiel
        const payer = sol.participants.find(p => 
          this.compareUserIds(p.user, req.user.userId)
        );
        
        const totalReceived = targetRound.payments.reduce((sum, p) => sum + p.amount, 0);
        const totalExpected = sol.contributionAmount * sol.participants.length;
        
        await solNotifications.notifyPaymentReceived(targetRound.recipient, {
          solId: sol._id,
          solName: sol.name,
          amount: amount,
          payerName: payer.user.firstName + ' ' + payer.user.lastName,
          turnNumber: targetRound.roundNumber,
          totalReceived: totalReceived,
          totalExpected: totalExpected
        });
      }

      // Mettre à jour les métriques du sol
      if (!sol.metrics) {
        sol.metrics = {
          totalCollected: 0,
          completedRounds: 0,
          successRate: 0,
          avgPaymentDelay: 0,
          participantRetention: 100
        };
      }

      sol.metrics.totalCollected = (sol.metrics.totalCollected || 0) + amount;
      sol.lastActivityDate = new Date();
      await sol.save({ session });

      await session.commitTransaction();

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
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  });

  // ===================================================================
  // 9. ANALYTICS PERSONNELS
  // ===================================================================

  static getPersonalAnalytics = catchAsync(async (req, res) => {
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
        creation_tendency: userSols.filter(s => this.compareUserIds(s.creator, req.user.userId)).length,
        joining_tendency: userSols.filter(s => !this.compareUserIds(s.creator, req.user.userId)).length,
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
  });

  // ===================================================================
  // 10. DÉCOUVERTE DE SOLS
  // ===================================================================

  static discoverSols = catchAsync(async (req, res) => {
    const { page = 1, limit = 10, type, minAmount, maxAmount } = req.query;

    // TODO: Implémenter la découverte de sols avec scoring IA
    res.status(501).json({
      success: false,
      message: 'Découverte sols - À implémenter',
      error: 'not_implemented'
    });
  });

  // ===================================================================
  // 11. NOTIFICATIONS AUTOMATIQUES - PAIEMENTS EN RETARD
  // ===================================================================

  static checkAndNotifyLatePayments = catchAsync(async (req, res) => {
    const now = new Date();
    
    // Trouver tous les sols actifs avec rounds actifs
    const activeSols = await Sol.find({
      status: 'active'
    }).populate('participants.user', 'firstName lastName');

    let notificationsCreated = 0;

    for (const sol of activeSols) {
      const activeRound = sol.rounds.find(r => r.status === 'active');
      
      if (!activeRound) continue;

      // Vérifier si la date d'échéance est dépassée
      if (new Date(activeRound.endDate) < now) {
        // Trouver participants qui n'ont pas payé
        for (const participant of sol.participants) {
          const hasPaid = activeRound.payments.some(p =>
            this.compareUserIds(p.payer, participant.user._id)
          );

          if (!hasPaid) {
            const daysLate = Math.ceil((now - new Date(activeRound.endDate)) / (1000 * 60 * 60 * 24));
            
            // Notifier retard
            await solNotifications.notifyLatePayment(participant.user._id, {
              solId: sol._id,
              solName: sol.name,
              amount: sol.contributionAmount,
              daysLate: daysLate,
              beneficiaryName: activeRound.recipient.firstName + ' ' + activeRound.recipient.lastName,
              turnNumber: activeRound.roundNumber
            });
            
            notificationsCreated++;
          }
        }
      }
    }

    res.json({
      success: true,
      message: 'Vérification paiements en retard terminée',
      data: {
        solsChecked: activeSols.length,
        notificationsCreated: notificationsCreated
      }
    });
  });

  // ===================================================================
  // 12. NOTIFICATIONS AUTOMATIQUES - TOURS À VENIR
  // ===================================================================

  static notifyUpcomingTurns = catchAsync(async (req, res) => {
    const now = new Date();
    
    // Trouver tous les sols actifs
    const activeSols = await Sol.find({
      status: 'active'
    }).populate('participants.user', 'firstName lastName')
      .populate('rounds.recipient', 'firstName lastName');

    let notificationsCreated = 0;

    for (const sol of activeSols) {
      // Trouver le prochain round (pending ou active)
      const nextRound = sol.rounds.find(r => 
        r.status === 'pending' || r.status === 'active'
      );
      
      if (!nextRound || !nextRound.startDate) continue;

      // Calculer jours restants
      const daysUntil = Math.ceil((new Date(nextRound.startDate) - now) / (1000 * 60 * 60 * 24));

      // Vérifier si on doit envoyer un rappel
      const shouldNotify = 
        daysUntil === 7 ||  // 1 semaine avant
        daysUntil === 3 ||  // 3 jours avant
        daysUntil === 1 ||  // 1 jour avant
        daysUntil === 0;    // Le jour même

      if (shouldNotify) {
        // Créer rappels tour de sol
        const result = await solNotifications.notifySolTurnReminder(
          sol,
          nextRound,
          daysUntil
        );
        
        notificationsCreated += result.created;
      }
    }

    res.json({
      success: true,
      message: 'Rappels tours de sol envoyés',
      data: {
        solsChecked: activeSols.length,
        notificationsCreated: notificationsCreated
      }
    });
  });

  // ===================================================================
  // MÉTHODES UTILITAIRES PRIVÉES
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
      this.compareUserIds(p.user, userId)
    );

    if (!userParticipant) return null;

    const currentRound = sol.rounds.findIndex(r => r.status === 'active' || r.status === 'pending');
    const userRound = userParticipant.position - 1;

    if (currentRound === -1) return userRound + 1;

    return userRound >= currentRound ?
      userRound - currentRound :
      sol.rounds.length - currentRound + userRound;
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

  static calculateSuccessRate(sols, userId) {
    const completedSols = sols.filter(s => s.status === 'completed');
    if (completedSols.length === 0) return 0;
    return Math.round((completedSols.length / sols.length) * 100);
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

  static regenerateRounds(sol) {
    return this.generateRounds(sol.participants.length, sol.startDate, sol.frequency);
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

    timingData.avgHour = Math.round(hours.reduce((a, b) => a + b, 0) / hours.length);

    const dayCount = {};
    days.forEach(d => dayCount[d] = (dayCount[d] || 0) + 1);
    timingData.preferredDays = Object.entries(dayCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([day]) => parseInt(day));

    return timingData;
  }

  static analyzeParticipationPatterns(userSols, userId) {
    return {
      asCreator: userSols.filter(s => this.compareUserIds(s.creator, userId)).length,
      asParticipant: userSols.filter(s => !this.compareUserIds(s.creator, userId)).length,
      preferredTypes: this.analyzeSolTypePreferences(userSols).slice(0, 2)
    };
  }

  static calculateMonthlyCommitment(userSols) {
    const activeSols = userSols.filter(s => s.status === 'active');
    
    return activeSols.reduce((total, sol) => {
      const monthlyAmount = sol.frequency === 'monthly' ? sol.contributionAmount :
                           sol.frequency === 'weekly' ? sol.contributionAmount * 4 :
                           sol.frequency === 'biweekly' ? sol.contributionAmount * 2 :
                           sol.contributionAmount;
      return total + monthlyAmount;
    }, 0);
  }

  static calculateROI(userSols, userId) {
    const completedSols = userSols.filter(s => s.status === 'completed');
    
    if (completedSols.length === 0) return 0;

    let totalInvested = 0;
    let totalReceived = 0;

    completedSols.forEach(sol => {
      const userParticipant = sol.participants.find(p => 
        this.compareUserIds(p.user, userId)
      );
      
      if (userParticipant) {
        totalInvested += sol.contributionAmount * sol.rounds.length;
        totalReceived += sol.contributionAmount * sol.rounds.length;
      }
    });

    return totalInvested > 0 ? 
      Math.round(((totalReceived - totalInvested) / totalInvested) * 100) : 0;
  }

  static analyzeCashFlowImpact(transactions) {
    const monthlyFlow = {};
    
    transactions.forEach(t => {
      const month = new Date(t.date).toISOString().slice(0, 7);
      if (!monthlyFlow[month]) monthlyFlow[month] = 0;
      
      monthlyFlow[month] += t.type === 'expense' ? -t.amount : t.amount;
    });

    return {
      months: Object.keys(monthlyFlow).sort(),
      values: Object.values(monthlyFlow)
    };
  }

  static calculateCompletionRate(userSols, userId) {
    if (userSols.length === 0) return 0;
    
    const completed = userSols.filter(s => s.status === 'completed').length;
    return Math.round((completed / userSols.length) * 100);
  }

  static calculatePunctualityScore(transactions) {
    // Simplified - would need more context about due dates
    return 85; // Default score
  }

  static calculateRiskProfile(userSols) {
    const avgAmount = userSols.reduce((sum, s) => sum + s.contributionAmount, 0) / 
                     (userSols.length || 1);
    
    if (avgAmount < 1000) return 'conservative';
    if (avgAmount < 5000) return 'moderate';
    return 'aggressive';
  }

  static async predictNextContribution(userId, userSols) {
    const avgContribution = userSols.length > 0 ?
      userSols.reduce((sum, s) => sum + s.contributionAmount, 0) / userSols.length : 0;
    
    return Math.round(avgContribution * 1.1); // 10% increase prediction
  }

  static predictCompletionProbability(userSols, userId) {
    const completionRate = this.calculateCompletionRate(userSols, userId);
    return completionRate;
  }

  static suggestOptimalTiming(transactions) {
    if (transactions.length === 0) return null;
    
    const hours = transactions.map(t => new Date(t.date).getHours());
    const avgHour = Math.round(hours.reduce((a, b) => a + b, 0) / hours.length);
    
    return {
      suggestedHour: avgHour,
      suggestedDay: 'début du mois',
      reason: 'Basé sur vos habitudes de paiement'
    };
  }

  static async generatePersonalRecommendations(userId, userSols) {
    const recommendations = [];
    
    const completionRate = this.calculateCompletionRate(userSols, userId);
    
    if (completionRate > 90) {
      recommendations.push({
        type: 'excellent_behavior',
        title: 'Excellent historique',
        description: 'Votre taux de complétion est excellent. Vous pouvez envisager des sols à montants plus élevés.',
        confidence: 0.9,
        actionable: true
      });
    }

    if (userSols.length < 2) {
      recommendations.push({
        type: 'diversification',
        title: 'Diversifier vos sols',
        description: 'Participer à plusieurs types de sols peut optimiser vos rendements.',
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

  // ===================================================================
  // STUBS POUR ANALYTICS ET NOTIFICATIONS
  // ===================================================================

  static async schedulePaymentNotifications(sol) {
    console.log('Planning notifications pour sol:', sol.name);
  }

  static async collectCreationAnalytics(userId, sol) {
    console.log('Creation analytics pour:', userId);
  }

  static async collectViewAnalytics(userId, solId) {
    console.log('View analytics pour:', userId);
  }

  static async collectJoinAnalytics(userId, sol) {
    console.log('Join analytics pour:', userId);
  }

  static async collectLeaveAnalytics(userId, sol, reason) {
    console.log('Leave analytics pour:', userId, 'Raison:', reason);
  }

  static async collectPaymentAnalytics(userId, sol, round, amount) {
    console.log('Payment analytics pour:', userId, 'Montant:', amount);
  }

  static async storeAnalyticsForIA(userId, analytics) {
    console.log('Storing IA analytics pour:', userId);
  }

  // ===================================================================
  // VALIDATIONS EXPRESS-VALIDATOR (pour compatibilité)
  // ===================================================================

  static validateCreateSol = [
    // Ces validations sont maintenant gérées par validation.js centralisé
    // Garder pour compatibilité avec l'ancien code
  ];

  static validateJoinSol = [
    // Géré par validation.js
  ];

  static validatePayment = [
    // Géré par validation.js
  ];

  static validateCheckLatePayments = [
    // Admin only - pas de validation spécifique
  ];

  static validateNotifyUpcomingTurns = [
    // Admin only - pas de validation spécifique
  ];
}

// ===================================================================
// EXPORT
// ===================================================================

module.exports = SolController;

// ===================================================================
// FIN DU FICHIER solController.js
// ===================================================================