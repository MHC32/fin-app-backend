// src/services/notificationService.js

const Notification = require('../models/Notification');
const User = require('../models/User');
const { NOTIFICATION_TYPES } = require('../utils/constants');

class NotificationService {

  /**
   * Créer et envoyer une notification
   */
  static async create(notificationData) {
    try {
      // Vérifier préférences utilisateur
      const user = await User.findById(notificationData.user);
      
      if (!user) {
        throw new Error('Utilisateur non trouvé');
      }

      // Appliquer préférences utilisateur
      const channels = this._applyUserPreferences(
        notificationData.channels || {},
        user.notificationPreferences,
        notificationData.source
      );

      // Créer notification
      const notification = await Notification.create({
        ...notificationData,
        channels,
        status: 'pending'
      });

      // Envoyer selon les canaux activés
      await this._sendToChannels(notification, user);

      return notification;

    } catch (error) {
      console.error('Erreur création notification:', error);
      throw error;
    }
  }

  /**
   * Créer notification IA (conseils)
   */
  static async createAIAdvice(userId, advice) {
    return this.create({
      user: userId,
      source: 'ai_advice',
      type: advice.priority === 'urgent' ? 'urgent' : 'info',
      title: advice.title,
      message: advice.description,
      priority: advice.priority || 'medium',
      actionable: true,
      actionUrl: '/dashboard/ai/advice',
      actionLabel: 'Voir détails',
      metadata: {
        adviceType: advice.type,
        relatedData: advice.actions
      },
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 jours
    });
  }

  /**
   * Créer notification anomalie IA
   */
  static async createAIAnomaly(userId, anomaly) {
    return this.create({
      user: userId,
      source: 'ai_anomaly',
      type: anomaly.severity === 'high' ? 'urgent' : 'warning',
      title: '🚨 Anomalie Détectée',
      message: anomaly.message,
      priority: anomaly.severity === 'high' ? 'urgent' : 'high',
      actionable: true,
      actionUrl: `/transactions/${anomaly.transactionId}`,
      actionLabel: 'Vérifier transaction',
      metadata: {
        anomalyType: anomaly.type,
        amount: anomaly.amount,
        entityId: anomaly.transactionId,
        entityType: 'transaction'
      },
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 jours
    });
  }

  /**
   * Créer notification budget
   */
  static async createBudgetAlert(userId, budget, alert) {
    return this.create({
      user: userId,
      source: 'budget_alert',
      type: alert.type, // 'warning' ou 'error'
      title: alert.title,
      message: alert.message,
      priority: alert.percentage >= 100 ? 'urgent' : 'high',
      actionable: true,
      actionUrl: `/budgets/${budget._id}`,
      actionLabel: 'Voir budget',
      metadata: {
        budgetId: budget._id,
        percentage: alert.percentage,
        amount: alert.spent,
        limit: budget.totalBudgeted
      },
      expiresAt: budget.endDate
    });
  }

  /**
   * Créer notification sol (rappel paiement)
   */
  static async createSolReminder(userId, sol, daysUntilPayment) {
    const urgency = daysUntilPayment <= 1 ? 'urgent' : 
                   daysUntilPayment <= 3 ? 'high' : 'medium';

    return this.create({
      user: userId,
      source: 'sol_reminder',
      type: urgency === 'urgent' ? 'urgent' : 'warning',
      title: `💰 Paiement Sol: ${sol.name}`,
      message: `Votre paiement de ${sol.contributionAmount} ${sol.currency} est dû dans ${daysUntilPayment} jour(s)`,
      priority: urgency,
      actionable: true,
      actionUrl: `/sols/${sol._id}/payment`,
      actionLabel: 'Payer maintenant',
      metadata: {
        solId: sol._id,
        amount: sol.contributionAmount,
        currency: sol.currency,
        dueDate: sol.nextPaymentDate
      },
      scheduledFor: sol.nextPaymentDate,
      expiresAt: new Date(sol.nextPaymentDate.getTime() + 24 * 60 * 60 * 1000)
    });
  }

  /**
   * Créer notification tour de sol
   */
  static async createSolTurnNotification(userId, sol, round) {
    return this.create({
      user: userId,
      source: 'sol_turn',
      type: 'success',
      title: '🎉 C\'est votre tour!',
      message: `Vous recevez ${sol.contributionAmount * sol.participants.length} ${sol.currency} aujourd'hui!`,
      priority: 'high',
      actionable: true,
      actionUrl: `/sols/${sol._id}`,
      actionLabel: 'Voir détails',
      metadata: {
        solId: sol._id,
        roundNumber: round.roundNumber,
        amount: sol.contributionAmount * sol.participants.length
      }
    });
  }

  /**
   * Créer notification dette
   */
  static async createDebtReminder(userId, debt, daysOverdue = 0) {
    const isOverdue = daysOverdue > 0;
    
    return this.create({
      user: userId,
      source: 'debt_reminder',
      type: isOverdue ? 'urgent' : 'warning',
      title: isOverdue ? '⚠️ Dette en Retard' : '📅 Rappel Dette',
      message: isOverdue 
        ? `Votre paiement de ${debt.nextPaymentAmount} ${debt.currency} est en retard de ${daysOverdue} jour(s)`
        : `Paiement de ${debt.nextPaymentAmount} ${debt.currency} dû le ${debt.nextPaymentDate.toLocaleDateString()}`,
      priority: isOverdue ? 'urgent' : 'high',
      actionable: true,
      actionUrl: `/debts/${debt._id}/payment`,
      actionLabel: 'Payer',
      metadata: {
        debtId: debt._id,
        amount: debt.nextPaymentAmount,
        daysOverdue: daysOverdue
      }
    });
  }

  /**
   * Appliquer préférences utilisateur
   */
  static _applyUserPreferences(channels, userPrefs, source) {
    // Si l'utilisateur a désactivé ce type de notification
    const prefMap = {
      'ai_advice': userPrefs?.aiAdvice !== false,
      'ai_anomaly': userPrefs?.aiAlerts !== false,
      'budget_alert': userPrefs?.budgetAlerts !== false,
      'sol_reminder': userPrefs?.solReminders !== false,
      'debt_reminder': userPrefs?.debtReminders !== false
    };

    const isEnabled = prefMap[source] !== false;

    return {
      inApp: channels.inApp !== false && isEnabled, // Toujours in-app si enabled
      push: channels.push && userPrefs?.push && isEnabled,
      email: channels.email && userPrefs?.email && isEnabled,
      sms: channels.sms && userPrefs?.sms && isEnabled
    };
  }

  /**
   * Envoyer aux différents canaux
   */
  static async _sendToChannels(notification, user) {
    const promises = [];

    // In-app: toujours prêt (juste stocké en DB)
    if (notification.channels.inApp) {
      notification.status = 'sent';
      promises.push(notification.save());
    }

    // Push: TODO - Intégration FCM
    if (notification.channels.push && user.pushTokens?.length > 0) {
      // promises.push(this._sendPush(notification, user));
    }

    // Email: TODO - Intégration service email
    if (notification.channels.email && user.email) {
      // promises.push(this._sendEmail(notification, user));
    }

    // SMS: TODO - Intégration Twilio
    if (notification.channels.sms && user.phone) {
      // promises.push(this._sendSMS(notification, user));
    }

    await Promise.all(promises);
  }

  /**
   * Récupérer notifications utilisateur
   */
  static async getUserNotifications(userId, options = {}) {
    const {
      status,
      source,
      priority,
      limit = 50,
      skip = 0
    } = options;

    const query = { user: userId };
    
    if (status) query.status = status;
    if (source) query.source = source;
    if (priority) query.priority = priority;

    const notifications = await Notification.find(query)
      .sort({ priority: -1, createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const unreadCount = await Notification.countDocuments({
      user: userId,
      status: { $in: ['pending', 'sent', 'delivered'] }
    });

    return {
      notifications,
      unreadCount,
      total: await Notification.countDocuments(query)
    };
  }

  /**
   * Marquer comme lue
   */
  static async markAsRead(notificationId, userId) {
    const notification = await Notification.findOne({
      _id: notificationId,
      user: userId
    });

    if (!notification) {
      throw new Error('Notification non trouvée');
    }

    return notification.markAsRead();
  }

  /**
   * Marquer toutes comme lues
   */
  static async markAllAsRead(userId) {
    return Notification.updateMany(
      {
        user: userId,
        status: { $in: ['pending', 'sent', 'delivered'] }
      },
      {
        $set: {
          status: 'read',
          readAt: new Date()
        }
      }
    );
  }
}

module.exports = NotificationService;