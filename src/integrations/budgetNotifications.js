/**
 * ============================================================================
 * BUDGET NOTIFICATIONS INTEGRATION
 * ============================================================================
 * 
 * Ce module connecte le système de budgets avec les notifications pour alerter
 * automatiquement les utilisateurs sur l'état de leurs budgets.
 * 
 * DÉCLENCHEURS AUTOMATIQUES :
 * - Budget atteint 75% → Alerte préventive
 * - Budget atteint 90% → Alerte urgente
 * - Budget dépassé → Notification critique
 * - Nouveau budget créé → Confirmation
 * - Budget complété → Félicitations
 * 
 * APPELÉ PAR : budgetController lors des mises à jour budget
 * 
 * @module integrations/budgetNotifications
 */

const NotificationService = require('../services/notificationService');

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  // Seuils d'alerte budget (en pourcentage)
  ALERT_THRESHOLDS: {
    warning: 75,      // Avertissement à 75%
    critical: 90,     // Critique à 90%
    exceeded: 100     // Dépassement à 100%
  },

  // Cooldown entre notifications similaires (en heures)
  NOTIFICATION_COOLDOWN: {
    warning: 12,      // Max 1 alerte warning/12h
    critical: 6,      // Max 1 alerte critical/6h
    exceeded: 24      // Max 1 alerte dépassement/24h
  },

  // Activer/désactiver types de notifications
  ENABLED_NOTIFICATIONS: {
    created: true,
    warning: true,
    critical: true,
    exceeded: true,
    completed: true,
    reset: true
  },

  // Messages personnalisés selon contexte Haiti
  MESSAGES: {
    warning_htg: "Ou preske rive nan limit bidjè ou! Fè atansyon.",
    critical_htg: "Atansyon! Ou preske depase bidjè ou.",
    exceeded_htg: "Ou depase bidjè ou! Fòk ou diminye depans yo."
  }
};

// =============================================================================
// FONCTION PRINCIPALE - ALERTE BUDGET
// =============================================================================

/**
 * Crée une notification d'alerte budget basée sur le pourcentage utilisé
 * 
 * @param {String} userId - ID de l'utilisateur
 * @param {Object} budget - Objet budget avec données complètes
 * @param {Number} budget.spent - Montant dépensé
 * @param {Number} budget.limit - Limite du budget
 * @param {Number} budget.percentage - Pourcentage utilisé
 * @param {String} budget.name - Nom du budget
 * @param {String} budget.category - Catégorie du budget
 * @returns {Object} Notification créée (ou null si pas nécessaire)
 * 
 * @example
 * await notifyBudgetAlert(userId, {
 *   name: 'Restaurant',
 *   spent: 4500,
 *   limit: 5000,
 *   percentage: 90,
 *   category: 'food'
 * });
 */
async function notifyBudgetAlert(userId, budget) {
  try {
    console.log(`💰 [Budget Notifications] Analyse budget "${budget.name}" pour user ${userId}`);

    const { percentage, spent, limit, name, category, _id } = budget;

    // Déterminer le type d'alerte nécessaire
    let alertType = null;
    let priority = 'normal';

    if (percentage >= CONFIG.ALERT_THRESHOLDS.exceeded) {
      alertType = 'exceeded';
      priority = 'urgent';
    } else if (percentage >= CONFIG.ALERT_THRESHOLDS.critical) {
      alertType = 'critical';
      priority = 'high';
    } else if (percentage >= CONFIG.ALERT_THRESHOLDS.warning) {
      alertType = 'warning';
      priority = 'normal';
    }

    // Si aucun seuil atteint, pas de notification
    if (!alertType) {
      console.log(`✅ Budget ${name} à ${percentage}% - Pas de notification nécessaire`);
      return null;
    }

    // Vérifier si notification désactivée
    if (!CONFIG.ENABLED_NOTIFICATIONS[alertType]) {
      console.log(`ℹ️  Notifications ${alertType} désactivées dans config`);
      return null;
    }

    // Vérifier cooldown pour éviter spam
    const cooldownHours = CONFIG.NOTIFICATION_COOLDOWN[alertType];
    const recentNotification = await checkRecentBudgetNotification(
      userId,
      budget._id,
      alertType,
      cooldownHours
    );

    if (recentNotification) {
      console.log(`⏰ Cooldown actif pour budget ${name} (${alertType}) - Skip`);
      return null;
    }

    // Calculer montant restant
    const remaining = limit - spent;
    const overspent = spent - limit;

    // Créer notification via le service
    const notification = await NotificationService.createBudgetAlert(userId, {
      budgetId: _id,
      budgetName: name,
      category: category,
      spent: spent,
      limit: limit,
      percentage: percentage,
      remaining: remaining > 0 ? remaining : 0,
      overspent: overspent > 0 ? overspent : 0,
      alertType: alertType
    }, {
      title: formatBudgetAlertTitle(alertType, name, percentage),
      message: formatBudgetAlertMessage(alertType, budget),
      priority: priority,
      actions: generateBudgetActions(alertType, _id, category)
    });

    console.log(`✅ Notification ${alertType} créée pour budget ${name}`);
    return notification;

  } catch (error) {
    console.error('❌ [Budget Notifications] Erreur notifyBudgetAlert:', error);
    return null;
  }
}

// =============================================================================
// CRÉATION BUDGET
// =============================================================================

/**
 * Notifie l'utilisateur qu'un nouveau budget a été créé
 * 
 * @param {String} userId - ID de l'utilisateur
 * @param {Object} budget - Budget créé
 * @returns {Object} Notification créée
 */
async function notifyBudgetCreated(userId, budget) {
  try {
    if (!CONFIG.ENABLED_NOTIFICATIONS.created) {
      return null;
    }

    console.log(`💰 [Budget Notifications] Nouveau budget "${budget.name}" créé`);

    const { name, limit, period, category } = budget;

    const notification = await NotificationService.create(userId, {
      type: 'budget_created',
      title: `Budget "${name}" créé avec succès`,
      message: `Votre budget ${name} de ${limit.toLocaleString()} HTG pour ${period} est maintenant actif. Suivez vos dépenses pour rester dans les limites !`,
      priority: 'normal',
      category: 'budget',
      data: {
        budgetId: budget._id,
        budgetName: name,
        limit: limit,
        period: period,
        category: category
      },
      actionable: true,
      actions: [
        {
          label: 'Voir Budget',
          type: 'navigate',
          value: `/budgets/${budget._id}`
        },
        {
          label: 'Voir Tous Budgets',
          type: 'navigate',
          value: '/budgets'
        }
      ]
    });

    console.log(`✅ Notification création budget créée`);
    return notification;

  } catch (error) {
    console.error('❌ Erreur notifyBudgetCreated:', error);
    return null;
  }
}

// =============================================================================
// BUDGET COMPLÉTÉ
// =============================================================================

/**
 * Félicite l'utilisateur qui a respecté son budget
 * 
 * @param {String} userId - ID de l'utilisateur
 * @param {Object} budget - Budget complété
 * @returns {Object} Notification créée
 */
async function notifyBudgetCompleted(userId, budget) {
  try {
    if (!CONFIG.ENABLED_NOTIFICATIONS.completed) {
      return null;
    }

    console.log(`💰 [Budget Notifications] Budget "${budget.name}" complété avec succès`);

    const { name, spent, limit, percentage } = budget;
    const saved = limit - spent;
    const savingsPercentage = Math.round((saved / limit) * 100);

    const notification = await NotificationService.create(userId, {
      type: 'budget_completed',
      title: `🎉 Félicitations ! Budget "${name}" respecté`,
      message: `Bravo ! Vous avez terminé la période avec ${percentage}% de votre budget utilisé. Vous avez économisé ${saved.toLocaleString()} HTG (${savingsPercentage}%) !`,
      priority: 'normal',
      category: 'budget',
      data: {
        budgetId: budget._id,
        budgetName: name,
        spent: spent,
        limit: limit,
        saved: saved,
        percentage: percentage
      },
      actionable: true,
      actions: [
        {
          label: 'Voir Détails',
          type: 'navigate',
          value: `/budgets/${budget._id}`
        },
        {
          label: 'Épargner Économies',
          type: 'navigate',
          value: '/accounts/savings'
        }
      ]
    });

    console.log(`✅ Notification félicitations budget créée`);
    return notification;

  } catch (error) {
    console.error('❌ Erreur notifyBudgetCompleted:', error);
    return null;
  }
}

// =============================================================================
// RESET BUDGET
// =============================================================================

/**
 * Notifie que le budget a été réinitialisé pour une nouvelle période
 * 
 * @param {String} userId - ID de l'utilisateur
 * @param {Object} budget - Budget réinitialisé
 * @param {Object} previousPeriod - Données période précédente
 * @returns {Object} Notification créée
 */
async function notifyBudgetReset(userId, budget, previousPeriod = {}) {
  try {
    if (!CONFIG.ENABLED_NOTIFICATIONS.reset) {
      return null;
    }

    console.log(`💰 [Budget Notifications] Budget "${budget.name}" réinitialisé`);

    const { name, limit, period } = budget;
    const { spent: previousSpent, percentage: previousPercentage } = previousPeriod;

    let message = `Votre budget ${name} a été réinitialisé pour ${period}. Nouvelle limite : ${limit.toLocaleString()} HTG.`;
    
    if (previousSpent) {
      message += ` Période précédente : ${previousSpent.toLocaleString()} HTG dépensés (${previousPercentage}%).`;
    }

    const notification = await NotificationService.create(userId, {
      type: 'budget_reset',
      title: `Budget "${name}" réinitialisé`,
      message: message,
      priority: 'low',
      category: 'budget',
      data: {
        budgetId: budget._id,
        budgetName: name,
        limit: limit,
        period: period,
        previousPeriod: previousPeriod
      },
      actionable: true,
      actions: [
        {
          label: 'Voir Budget',
          type: 'navigate',
          value: `/budgets/${budget._id}`
        }
      ]
    });

    console.log(`✅ Notification reset budget créée`);
    return notification;

  } catch (error) {
    console.error('❌ Erreur notifyBudgetReset:', error);
    return null;
  }
}

// =============================================================================
// ANALYSE MULTIPLE BUDGETS
// =============================================================================

/**
 * Analyse plusieurs budgets et crée notifications appropriées
 * 
 * @param {String} userId - ID de l'utilisateur
 * @param {Array} budgets - Liste des budgets à analyser
 * @returns {Object} Résumé des notifications créées
 */
async function notifyBudgetsStatus(userId, budgets) {
  try {
    console.log(`💰 [Budget Notifications] Analyse ${budgets.length} budgets pour user ${userId}`);

    const notifications = {
      created: [],
      skipped: []
    };

    for (const budget of budgets) {
      try {
        const notification = await notifyBudgetAlert(userId, budget);
        
        if (notification) {
          notifications.created.push(notification._id);
        } else {
          notifications.skipped.push(budget._id);
        }

      } catch (error) {
        console.error(`❌ Erreur notification budget ${budget.name}:`, error.message);
        notifications.skipped.push(budget._id);
      }
    }

    console.log(`🎉 Résumé : ${notifications.created.length} notifications, ${notifications.skipped.length} skippées`);

    return {
      created: notifications.created.length,
      skipped: notifications.skipped.length,
      notificationIds: notifications.created
    };

  } catch (error) {
    console.error('❌ Erreur notifyBudgetsStatus:', error);
    return { created: 0, skipped: 0 };
  }
}

// =============================================================================
// FONCTIONS UTILITAIRES
// =============================================================================

/**
 * Vérifie si une notification budget similaire récente existe (cooldown)
 */
async function checkRecentBudgetNotification(userId, budgetId, alertType, hoursAgo) {
  try {
    const Notification = require('../models/Notification');
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - hoursAgo);

    const recentNotification = await Notification.findOne({
      user: userId,
      'data.budgetId': budgetId,
      'data.alertType': alertType,
      createdAt: { $gte: cutoffDate }
    });

    return recentNotification !== null;

  } catch (error) {
    console.error('❌ Erreur checkRecentBudgetNotification:', error);
    return false; // En cas d'erreur, autoriser la notification
  }
}

/**
 * Formate le titre de l'alerte budget
 */
function formatBudgetAlertTitle(alertType, budgetName, percentage) {
  const titles = {
    warning: `⚠️ Budget "${budgetName}" à ${percentage}%`,
    critical: `🚨 Budget "${budgetName}" presque dépassé (${percentage}%)`,
    exceeded: `❌ Budget "${budgetName}" dépassé !`
  };

  return titles[alertType] || `Budget "${budgetName}" - ${percentage}%`;
}

/**
 * Formate le message de l'alerte budget
 */
function formatBudgetAlertMessage(alertType, budget) {
  const { name, spent, limit, percentage, remaining, overspent } = budget;

  const messages = {
    warning: `Attention ! Vous avez dépensé ${spent.toLocaleString()} HTG sur ${limit.toLocaleString()} HTG (${percentage}%). Il vous reste ${remaining.toLocaleString()} HTG pour ce budget.`,
    
    critical: `Alerte ! Vous approchez de la limite de votre budget ${name}. Dépenses : ${spent.toLocaleString()} HTG / ${limit.toLocaleString()} HTG (${percentage}%). Seulement ${remaining.toLocaleString()} HTG restants !`,
    
    exceeded: `Vous avez dépassé votre budget ${name} de ${overspent.toLocaleString()} HTG ! Dépenses totales : ${spent.toLocaleString()} HTG pour une limite de ${limit.toLocaleString()} HTG (${percentage}%). Réduisez vos dépenses immédiatement.`
  };

  return messages[alertType] || `Budget ${name} à ${percentage}%`;
}

/**
 * Génère les actions contextuelles pour l'alerte
 */
function generateBudgetActions(alertType, budgetId, category) {
  const baseActions = [
    {
      label: 'Voir Budget',
      type: 'navigate',
      value: `/budgets/${budgetId}`
    },
    {
      label: 'Voir Dépenses',
      type: 'navigate',
      value: `/transactions?category=${category}`
    }
  ];

  // Actions supplémentaires selon type d'alerte
  if (alertType === 'exceeded') {
    baseActions.push({
      label: 'Ajuster Budget',
      type: 'navigate',
      value: `/budgets/${budgetId}/edit`
    });
  } else if (alertType === 'critical' || alertType === 'warning') {
    baseActions.push({
      label: 'Analyser avec IA',
      type: 'navigate',
      value: '/ai/insights'
    });
  }

  return baseActions;
}

/**
 * Calcule statistiques globales budgets pour résumé
 */
async function calculateBudgetStatistics(userId) {
  try {
    const Budget = require('../models/Budget');
    
    const budgets = await Budget.find({ 
      user: userId, 
      isActive: true 
    });

    const stats = {
      total: budgets.length,
      healthy: 0,      // < 75%
      warning: 0,      // 75-90%
      critical: 0,     // 90-100%
      exceeded: 0      // > 100%
    };

    budgets.forEach(budget => {
      const percentage = (budget.spent / budget.limit) * 100;
      
      if (percentage >= 100) stats.exceeded++;
      else if (percentage >= 90) stats.critical++;
      else if (percentage >= 75) stats.warning++;
      else stats.healthy++;
    });

    return stats;

  } catch (error) {
    console.error('❌ Erreur calculateBudgetStatistics:', error);
    return null;
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  // Fonctions principales
  notifyBudgetAlert,
  notifyBudgetCreated,
  notifyBudgetCompleted,
  notifyBudgetReset,
  notifyBudgetsStatus,
  
  // Utilitaires
  calculateBudgetStatistics,
  
  // Configuration (pour tests/personnalisation)
  CONFIG
};