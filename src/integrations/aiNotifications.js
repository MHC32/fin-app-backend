/**
 * ============================================================================
 * AI NOTIFICATIONS INTEGRATION
 * ============================================================================
 * 
 * Ce module connecte le système IA avec les notifications pour créer
 * automatiquement des alertes quand l'IA détecte des patterns importants.
 * 
 * DÉCLENCHEURS AUTOMATIQUES :
 * - Analyse d'habitudes complétée → Insights disponibles
 * - Prédiction budget alarmante → Alerte préventive
 * - Anomalie détectée → Notification urgente
 * - Conseil personnalisé → Notification actionnable
 * 
 * APPELÉ PAR : aiController après chaque analyse
 * 
 * @module integrations/aiNotifications
 */

const NotificationService = require('../services/notificationService');

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  // Seuils de priorité pour les insights IA
  PRIORITY_THRESHOLDS: {
    critical: 0.9,    // 90%+ de confiance → Urgent
    high: 0.75,       // 75%+ de confiance → Important
    medium: 0.5,      // 50%+ de confiance → Normal
    low: 0.25         // 25%+ de confiance → Info
  },

  // Types d'insights qui génèrent des notifications
  NOTIFIABLE_TYPES: [
    'spending_spike',      // Pic de dépenses anormal
    'budget_risk',         // Risque de dépassement budget
    'savings_opportunity', // Opportunité d'épargne
    'debt_concern',        // Préoccupation dette
    'investment_alert',    // Alerte investissement
    'sol_timing'           // Timing optimal sol
  ],

  // Délai minimum entre notifications similaires (en heures)
  NOTIFICATION_COOLDOWN: 24,

  // Activer/désactiver types de notifications
  ENABLED_NOTIFICATIONS: {
    insights: true,
    predictions: true,
    anomalies: true,
    recommendations: true
  }
};

// =============================================================================
// FONCTION PRINCIPALE - INSIGHTS IA
// =============================================================================

/**
 * Crée des notifications pour les insights IA détectés
 * 
 * @param {String} userId - ID de l'utilisateur
 * @param {Object} analysisResult - Résultat complet de l'analyse IA
 * @param {Array} analysisResult.insights - Liste des insights détectés
 * @param {String} analysisResult.analysisType - Type d'analyse (habits/predictions/etc)
 * @returns {Object} Résumé des notifications créées
 * 
 * @example
 * const result = await notifyAIInsights('user123', {
 *   insights: [
 *     { type: 'spending_spike', priority: 'urgent', confidence: 0.95 },
 *     { type: 'savings_opportunity', priority: 'normal', confidence: 0.70 }
 *   ],
 *   analysisType: 'habit_analysis'
 * });
 */
async function notifyAIInsights(userId, analysisResult) {
  try {
    console.log(`🤖 [AI Notifications] Traitement insights pour user ${userId}`);

    if (!CONFIG.ENABLED_NOTIFICATIONS.insights) {
      console.log('ℹ️  Notifications insights désactivées dans config');
      return { created: 0, skipped: 0 };
    }

    const { insights = [], analysisType } = analysisResult;
    const notifications = {
      created: [],
      skipped: []
    };

    // Filtrer les insights qui méritent une notification
    const notifiableInsights = insights.filter(insight => {
      // 1. Type doit être dans la liste des types notifiables
      if (!CONFIG.NOTIFIABLE_TYPES.includes(insight.type)) {
        return false;
      }

      // 2. Priorité doit être suffisamment élevée
      if (insight.priority === 'low' || insight.priority === 'info') {
        return false;
      }

      // 3. Confiance doit être au-dessus du seuil
      const minConfidence = CONFIG.PRIORITY_THRESHOLDS[insight.priority] || 0.5;
      if (insight.confidence < minConfidence) {
        return false;
      }

      return true;
    });

    console.log(`📊 ${notifiableInsights.length}/${insights.length} insights à notifier`);

    // Créer une notification pour chaque insight important
    for (const insight of notifiableInsights) {
      try {
        // Vérifier cooldown (éviter spam)
        const recentSimilar = await checkRecentSimilarNotification(
          userId,
          insight.type,
          CONFIG.NOTIFICATION_COOLDOWN
        );

        if (recentSimilar) {
          console.log(`⏰ Cooldown actif pour ${insight.type} - Skip`);
          notifications.skipped.push(insight.type);
          continue;
        }

        // Créer la notification via le service
        const notification = await NotificationService.createAIAdvice(userId, {
          type: insight.type,
          title: insight.title || formatInsightTitle(insight),
          message: insight.message || formatInsightMessage(insight),
          priority: mapPriorityToNotification(insight.priority),
          category: determineCategory(insight.type),
          data: {
            insightId: insight.id,
            analysisType: analysisType,
            confidence: insight.confidence,
            detectedAt: new Date(),
            metrics: insight.metrics || {}
          },
          actionable: true,
          actions: generateInsightActions(insight)
        });

        notifications.created.push(notification._id);
        console.log(`✅ Notification créée : ${insight.type}`);

      } catch (error) {
        console.error(`❌ Erreur création notification ${insight.type}:`, error.message);
        notifications.skipped.push(insight.type);
      }
    }

    console.log(`🎉 Résumé : ${notifications.created.length} créées, ${notifications.skipped.length} skippées`);

    return {
      created: notifications.created.length,
      skipped: notifications.skipped.length,
      notificationIds: notifications.created
    };

  } catch (error) {
    console.error('❌ [AI Notifications] Erreur notifyAIInsights:', error);
    throw error;
  }
}

// =============================================================================
// PRÉDICTIONS BUDGET
// =============================================================================

/**
 * Crée des notifications pour les prédictions budget alarmantes
 * 
 * @param {String} userId - ID de l'utilisateur
 * @param {Object} prediction - Prédiction IA du budget
 * @returns {Object} Notification créée (ou null)
 */
async function notifyBudgetPrediction(userId, prediction) {
  try {
    if (!CONFIG.ENABLED_NOTIFICATIONS.predictions) {
      return null;
    }

    console.log(`📊 [AI Notifications] Prédiction budget pour user ${userId}`);

    // Seuils d'alerte
    const { predictedPercentage, confidence, timeframe } = prediction;

    // Créer notification seulement si prédiction alarmante
    if (predictedPercentage < 90 || confidence < 0.7) {
      console.log('ℹ️  Prédiction pas assez critique - Skip notification');
      return null;
    }

    const priority = predictedPercentage >= 100 ? 'urgent' : 'high';
    const message = `L'IA prédit que vous dépasserez votre budget de ${Math.round(predictedPercentage - 100)}% dans ${timeframe}. Agissez maintenant pour éviter cela !`;

    const notification = await NotificationService.createAIAdvice(userId, {
      type: 'budget_prediction',
      title: '⚠️ Alerte Prédiction Budget',
      message: message,
      priority: priority,
      category: 'budget',
      data: {
        predictedPercentage: predictedPercentage,
        confidence: confidence,
        timeframe: timeframe,
        prediction: prediction
      },
      actionable: true,
      actions: [
        {
          label: 'Voir Détails',
          type: 'navigate',
          value: '/budgets'
        },
        {
          label: 'Ajuster Budget',
          type: 'navigate',
          value: '/budgets/adjust'
        }
      ]
    });

    console.log(`✅ Notification prédiction créée`);
    return notification;

  } catch (error) {
    console.error('❌ Erreur notifyBudgetPrediction:', error);
    return null;
  }
}

// =============================================================================
// ANOMALIES DÉTECTÉES
// =============================================================================

/**
 * Crée des notifications pour les anomalies détectées par l'IA
 * 
 * @param {String} userId - ID de l'utilisateur
 * @param {Object} anomaly - Anomalie détectée
 * @returns {Object} Notification créée
 */
async function notifyAnomaly(userId, anomaly) {
  try {
    if (!CONFIG.ENABLED_NOTIFICATIONS.anomalies) {
      return null;
    }

    console.log(`🚨 [AI Notifications] Anomalie détectée pour user ${userId}`);

    const { type, severity, description, detectedAt } = anomaly;

    // Mapper sévérité → priorité
    const priorityMap = {
      critical: 'urgent',
      high: 'high',
      medium: 'normal',
      low: 'low'
    };

    const notification = await NotificationService.create(userId, {
      type: 'ai_anomaly',
      title: `🚨 Anomalie Détectée : ${type}`,
      message: description || `Une anomalie inhabituelle a été détectée dans vos finances.`,
      priority: priorityMap[severity] || 'normal',
      category: 'alert',
      data: {
        anomalyType: type,
        severity: severity,
        detectedAt: detectedAt,
        fullAnomaly: anomaly
      },
      actionable: true,
      actions: [
        {
          label: 'Voir Détails',
          type: 'navigate',
          value: '/dashboard'
        },
        {
          label: 'Analyser',
          type: 'api_call',
          value: '/api/ai/analyze-anomaly'
        }
      ]
    });

    console.log(`✅ Notification anomalie créée : ${type}`);
    return notification;

  } catch (error) {
    console.error('❌ Erreur notifyAnomaly:', error);
    return null;
  }
}

// =============================================================================
// RECOMMANDATIONS PERSONNALISÉES
// =============================================================================

/**
 * Crée des notifications pour les recommandations IA personnalisées
 * 
 * @param {String} userId - ID de l'utilisateur
 * @param {Array} recommendations - Liste des recommandations IA
 * @returns {Object} Résumé des notifications créées
 */
async function notifyRecommendations(userId, recommendations) {
  try {
    if (!CONFIG.ENABLED_NOTIFICATIONS.recommendations) {
      return { created: 0 };
    }

    console.log(`💡 [AI Notifications] ${recommendations.length} recommandations pour user ${userId}`);

    const notificationsCreated = [];

    // Filtrer et créer notifications pour recommandations importantes
    const importantRecommendations = recommendations.filter(rec => 
      rec.priority === 'high' || rec.impact > 0.7
    );

    for (const recommendation of importantRecommendations) {
      try {
        const notification = await NotificationService.createAIAdvice(userId, {
          type: 'ai_recommendation',
          title: recommendation.title || '💡 Recommandation Personnalisée',
          message: recommendation.message,
          priority: recommendation.priority === 'high' ? 'high' : 'normal',
          category: recommendation.category || 'advice',
          data: {
            recommendationId: recommendation.id,
            impact: recommendation.impact,
            confidence: recommendation.confidence,
            tags: recommendation.tags || []
          },
          actionable: true,
          actions: recommendation.actions || []
        });

        notificationsCreated.push(notification._id);
        console.log(`✅ Notification recommandation créée`);

      } catch (error) {
        console.error(`❌ Erreur création notification recommandation:`, error.message);
      }
    }

    console.log(`🎉 ${notificationsCreated.length} recommandations notifiées`);

    return {
      created: notificationsCreated.length,
      notificationIds: notificationsCreated
    };

  } catch (error) {
    console.error('❌ Erreur notifyRecommendations:', error);
    return { created: 0 };
  }
}

// =============================================================================
// FONCTIONS UTILITAIRES
// =============================================================================

/**
 * Vérifie si une notification similaire récente existe (cooldown)
 */
async function checkRecentSimilarNotification(userId, insightType, hoursAgo) {
  try {
    const Notification = require('../models/Notification');
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - hoursAgo);

    const recentNotification = await Notification.findOne({
      user: userId,
      'data.insightType': insightType,
      createdAt: { $gte: cutoffDate }
    });

    return recentNotification !== null;

  } catch (error) {
    console.error('❌ Erreur checkRecentSimilarNotification:', error);
    return false; // En cas d'erreur, autoriser la notification
  }
}

/**
 * Formate le titre d'un insight pour la notification
 */
function formatInsightTitle(insight) {
  const titles = {
    spending_spike: '📈 Pic de Dépenses Détecté',
    budget_risk: '⚠️ Risque Dépassement Budget',
    savings_opportunity: '💰 Opportunité d\'Épargne',
    debt_concern: '🚨 Alerte Dette',
    investment_alert: '📊 Alerte Investissement',
    sol_timing: '👥 Moment Optimal pour Sol'
  };

  return titles[insight.type] || '🤖 Insight IA';
}

/**
 * Formate le message d'un insight pour la notification
 */
function formatInsightMessage(insight) {
  const { type, metrics = {} } = insight;

  const messages = {
    spending_spike: `Vos dépenses ont augmenté de ${metrics.increase || '?'}% ce mois-ci. L'IA recommande de réduire les dépenses non essentielles.`,
    budget_risk: `Vous risquez de dépasser votre budget de ${metrics.overrun || '?'}% si vous continuez au rythme actuel.`,
    savings_opportunity: `L'IA a identifié une opportunité d'économiser ${metrics.amount || '?'} HTG ce mois-ci.`,
    debt_concern: `Votre niveau d'endettement approche ${metrics.percentage || '?'}% de votre revenu mensuel.`,
    investment_alert: `Performance inhabituelle détectée sur votre investissement ${metrics.name || ''}.`,
    sol_timing: `C'est le moment optimal pour rejoindre un sol basé sur votre pattern financier.`
  };

  return messages[type] || 'L\'IA a détecté un pattern important dans vos finances.';
}

/**
 * Mappe la priorité insight → priorité notification
 */
function mapPriorityToNotification(insightPriority) {
  const map = {
    critical: 'urgent',
    urgent: 'urgent',
    high: 'high',
    medium: 'normal',
    normal: 'normal',
    low: 'low'
  };

  return map[insightPriority] || 'normal';
}

/**
 * Détermine la catégorie notification selon le type d'insight
 */
function determineCategory(insightType) {
  const categoryMap = {
    spending_spike: 'transaction',
    budget_risk: 'budget',
    savings_opportunity: 'saving',
    debt_concern: 'debt',
    investment_alert: 'investment',
    sol_timing: 'sol'
  };

  return categoryMap[insightType] || 'advice';
}

/**
 * Génère les actions contextuelles pour un insight
 */
function generateInsightActions(insight) {
  const actionMap = {
    spending_spike: [
      { label: 'Voir Dépenses', type: 'navigate', value: '/transactions' },
      { label: 'Ajuster Budget', type: 'navigate', value: '/budgets' }
    ],
    budget_risk: [
      { label: 'Voir Budgets', type: 'navigate', value: '/budgets' },
      { label: 'Analyser', type: 'navigate', value: '/ai/insights' }
    ],
    savings_opportunity: [
      { label: 'Voir Détails', type: 'navigate', value: '/ai/insights' },
      { label: 'Créer Épargne', type: 'navigate', value: '/accounts/create' }
    ],
    debt_concern: [
      { label: 'Voir Dettes', type: 'navigate', value: '/debts' },
      { label: 'Plan Remboursement', type: 'navigate', value: '/debts/plan' }
    ],
    investment_alert: [
      { label: 'Voir Investissements', type: 'navigate', value: '/investments' }
    ],
    sol_timing: [
      { label: 'Explorer Sols', type: 'navigate', value: '/sols' },
      { label: 'Créer Sol', type: 'navigate', value: '/sols/create' }
    ]
  };

  return actionMap[insight.type] || [
    { label: 'Voir Détails', type: 'navigate', value: '/dashboard' }
  ];
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  // Fonctions principales
  notifyAIInsights,
  notifyBudgetPrediction,
  notifyAnomaly,
  notifyRecommendations,

  // Configuration (pour tests/personnalisation)
  CONFIG
};