/**
 * ============================================================================
 * DEBT NOTIFICATIONS INTEGRATION
 * ============================================================================
 * 
 * Ce module connecte le système de gestion des dettes avec les notifications
 * pour alerter automatiquement sur les échéances, retards et paiements.
 * 
 * DÉCLENCHEURS AUTOMATIQUES :
 * - Nouvelle dette créée → Confirmation + plan remboursement
 * - Échéance approche (7/3/1 jours) → Rappels progressifs
 * - Paiement en retard → Alerte urgente
 * - Paiement effectué → Confirmation + progression
 * - Dette soldée → Félicitations
 * - Dette annulée → Notification
 * 
 * APPELÉ PAR : debtController lors des actions sur dettes
 * 
 * @module integrations/debtNotifications
 */

const NotificationService = require('../services/notificationService');

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  // Délais de rappel avant échéance (en jours)
  REMINDER_DAYS: {
    first: 7,        // Premier rappel 7 jours avant
    second: 3,       // Deuxième rappel 3 jours avant
    final: 1         // Rappel final 1 jour avant
  },

  // Activer/désactiver types de notifications
  ENABLED_NOTIFICATIONS: {
    created: true,
    reminder: true,
    late: true,
    payment: true,
    settled: true,
    cancelled: true
  },

  // Seuils d'alerte
  ALERT_THRESHOLDS: {
    highAmount: 10000,     // Dette élevée > 10000 HTG
    criticalDelay: 7,      // Retard critique > 7 jours
    warningDelay: 3        // Retard warning > 3 jours
  },

  // Messages contextuels Haiti
  MESSAGES: {
    reminder_htg: "Ou gen dèt pou peye. Pa bliye!",
    late_htg: "Ou an reta! Peye dèt ou kounye a.",
    settled_htg: "Felisitasyon! Ou fini peye dèt ou."
  }
};

// =============================================================================
// CRÉATION DETTE
// =============================================================================

/**
 * Notifie l'utilisateur qu'une nouvelle dette a été créée
 * 
 * @param {String} userId - ID de l'utilisateur
 * @param {Object} debt - Dette créée
 * @returns {Object} Notification créée
 */
async function notifyDebtCreated(userId, debt) {
  try {
    if (!CONFIG.ENABLED_NOTIFICATIONS.created) {
      return null;
    }

    console.log(`💳 [Debt Notifications] Nouvelle dette "${debt.description}" créée`);

    const { description, amount, currency, dueDate, type, lender } = debt;

    // Calculer jours jusqu'à échéance
    const daysUntilDue = Math.ceil((new Date(dueDate) - new Date()) / (1000 * 60 * 60 * 24));

    // Déterminer priorité selon montant et délai
    let priority = 'normal';
    if (amount > CONFIG.ALERT_THRESHOLDS.highAmount) priority = 'high';
    if (daysUntilDue <= 7) priority = 'high';

    const notification = await NotificationService.create(userId, {
      type: 'debt_created',
      title: `Dette enregistrée : ${description}`,
      message: `Montant: ${amount.toLocaleString()} ${currency}. Échéance: ${new Date(dueDate).toLocaleDateString('fr-FR')} (dans ${daysUntilDue} jours). ${type === 'borrowed' ? `Prêteur: ${lender || 'Non spécifié'}` : 'Dette personnelle'}`,
      priority: priority,
      category: 'debt',
      data: {
        debtId: debt._id,
        description: description,
        amount: amount,
        currency: currency,
        dueDate: dueDate,
        daysUntilDue: daysUntilDue,
        type: type,
        lender: lender
      },
      actionable: true,
      actions: [
        {
          label: 'Voir Dette',
          type: 'navigate',
          value: `/debts/${debt._id}`
        },
        {
          label: 'Créer Plan Remboursement',
          type: 'navigate',
          value: `/debts/${debt._id}/plan`
        },
        {
          label: 'Enregistrer Paiement',
          type: 'navigate',
          value: `/debts/${debt._id}/pay`
        }
      ]
    });

    console.log(`✅ Notification création dette envoyée`);
    return notification;

  } catch (error) {
    console.error('❌ Erreur notifyDebtCreated:', error);
    return null;
  }
}

// =============================================================================
// RAPPELS ÉCHÉANCE
// =============================================================================

/**
 * Crée des rappels pour échéance de dette approchante
 * 
 * @param {String} userId - ID de l'utilisateur
 * @param {Object} debt - Dette concernée
 * @param {Number} daysUntilDue - Jours restants avant échéance
 * @returns {Object} Notification créée
 */
async function notifyDebtReminder(userId, debt, daysUntilDue) {
  try {
    if (!CONFIG.ENABLED_NOTIFICATIONS.reminder) {
      return null;
    }

    console.log(`💳 [Debt Notifications] Rappel dette "${debt.description}" (${daysUntilDue} jours)`);

    const { description, amount, currency, dueDate, remainingAmount } = debt;

    // Déterminer priorité selon jours restants
    let priority = 'normal';
    let urgency = '';
    
    if (daysUntilDue <= 1) {
      priority = 'urgent';
      urgency = 'URGENT - ';
    } else if (daysUntilDue <= 3) {
      priority = 'high';
      urgency = 'Important - ';
    }

    const notification = await NotificationService.create(userId, {
      type: 'debt_reminder',
      title: `${urgency}Échéance dette : ${description}`,
      message: `${daysUntilDue > 0 ? `Dans ${daysUntilDue} jour(s)` : 'AUJOURD\'HUI'} ! Montant restant: ${remainingAmount.toLocaleString()} ${currency}. Date limite: ${new Date(dueDate).toLocaleDateString('fr-FR')}.`,
      priority: priority,
      category: 'debt',
      data: {
        debtId: debt._id,
        description: description,
        amount: amount,
        remainingAmount: remainingAmount,
        currency: currency,
        dueDate: dueDate,
        daysUntilDue: daysUntilDue,
        reminderType: daysUntilDue <= 1 ? 'final' : daysUntilDue <= 3 ? 'second' : 'first'
      },
      actionable: true,
      actions: [
        {
          label: 'Payer Maintenant',
          type: 'navigate',
          value: `/debts/${debt._id}/pay`
        },
        {
          label: 'Voir Détails',
          type: 'navigate',
          value: `/debts/${debt._id}`
        },
        {
          label: 'Reporter Échéance',
          type: 'navigate',
          value: `/debts/${debt._id}/reschedule`
        }
      ]
    });

    console.log(`✅ Notification rappel dette envoyée (priorité: ${priority})`);
    return notification;

  } catch (error) {
    console.error('❌ Erreur notifyDebtReminder:', error);
    return null;
  }
}

// =============================================================================
// PAIEMENT EN RETARD
// =============================================================================

/**
 * Alerte pour paiement dette en retard
 * 
 * @param {String} userId - ID de l'utilisateur
 * @param {Object} debt - Dette en retard
 * @param {Number} daysLate - Nombre de jours de retard
 * @returns {Object} Notification créée
 */
async function notifyDebtOverdue(userId, debt, daysLate) {
  try {
    if (!CONFIG.ENABLED_NOTIFICATIONS.late) {
      return null;
    }

    console.log(`💳 [Debt Notifications] Dette en retard "${debt.description}" (${daysLate} jours)`);

    const { description, amount, currency, remainingAmount, dueDate, lender } = debt;

    // Déterminer sévérité selon retard
    let priority = 'urgent';
    let severity = 'warning';
    
    if (daysLate >= CONFIG.ALERT_THRESHOLDS.criticalDelay) {
      severity = 'critical';
    }

    const notification = await NotificationService.create(userId, {
      type: 'debt_overdue',
      title: `⚠️ RETARD - Dette : ${description}`,
      message: `Paiement en retard de ${daysLate} jour(s) ! Montant dû: ${remainingAmount.toLocaleString()} ${currency}. ${lender ? `Prêteur: ${lender}. ` : ''}Agissez immédiatement pour éviter complications.`,
      priority: priority,
      category: 'debt',
      data: {
        debtId: debt._id,
        description: description,
        amount: amount,
        remainingAmount: remainingAmount,
        currency: currency,
        dueDate: dueDate,
        daysLate: daysLate,
        severity: severity,
        lender: lender
      },
      actionable: true,
      actions: [
        {
          label: 'Payer URGENT',
          type: 'navigate',
          value: `/debts/${debt._id}/pay`
        },
        {
          label: 'Contacter Prêteur',
          type: 'navigate',
          value: `/debts/${debt._id}/contact`
        },
        {
          label: 'Voir Dette',
          type: 'navigate',
          value: `/debts/${debt._id}`
        }
      ]
    });

    console.log(`✅ Notification retard dette envoyée (${daysLate} jours)`);
    return notification;

  } catch (error) {
    console.error('❌ Erreur notifyDebtOverdue:', error);
    return null;
  }
}

// =============================================================================
// PAIEMENT EFFECTUÉ
// =============================================================================

/**
 * Confirme qu'un paiement a été effectué et affiche progression
 * 
 * @param {String} userId - ID de l'utilisateur
 * @param {Object} debt - Dette mise à jour
 * @param {Object} payment - Détails du paiement
 * @returns {Object} Notification créée
 */
async function notifyDebtPayment(userId, debt, payment) {
  try {
    if (!CONFIG.ENABLED_NOTIFICATIONS.payment) {
      return null;
    }

    console.log(`💳 [Debt Notifications] Paiement dette "${debt.description}"`);

    const { description, amount, remainingAmount, currency } = debt;
    const { amount: paidAmount } = payment;

    // Calculer progression
    const totalPaid = amount - remainingAmount;
    const percentage = Math.round((totalPaid / amount) * 100);

    // Déterminer si dette soldée
    const isSettled = remainingAmount <= 0;

    const notification = await NotificationService.create(userId, {
      type: isSettled ? 'debt_payment_final' : 'debt_payment',
      title: isSettled ? `🎉 Dette soldée : ${description}` : `Paiement enregistré : ${description}`,
      message: isSettled 
        ? `Félicitations ! Vous avez terminé de rembourser cette dette de ${amount.toLocaleString()} ${currency}. Dette complètement soldée !`
        : `Paiement de ${paidAmount.toLocaleString()} ${currency} enregistré. Progression: ${percentage}% (${totalPaid.toLocaleString()} / ${amount.toLocaleString()} ${currency}). Reste à payer: ${remainingAmount.toLocaleString()} ${currency}.`,
      priority: isSettled ? 'high' : 'normal',
      category: 'debt',
      data: {
        debtId: debt._id,
        description: description,
        totalAmount: amount,
        paidAmount: paidAmount,
        totalPaid: totalPaid,
        remainingAmount: remainingAmount,
        percentage: percentage,
        currency: currency,
        isSettled: isSettled
      },
      actionable: true,
      actions: isSettled ? [
        {
          label: 'Voir Historique',
          type: 'navigate',
          value: `/debts/${debt._id}/history`
        },
        {
          label: 'Archiver Dette',
          type: 'navigate',
          value: `/debts/${debt._id}/archive`
        }
      ] : [
        {
          label: 'Voir Dette',
          type: 'navigate',
          value: `/debts/${debt._id}`
        },
        {
          label: 'Nouveau Paiement',
          type: 'navigate',
          value: `/debts/${debt._id}/pay`
        }
      ]
    });

    console.log(`✅ Notification paiement dette envoyée (${percentage}%)`);
    return notification;

  } catch (error) {
    console.error('❌ Erreur notifyDebtPayment:', error);
    return null;
  }
}

// =============================================================================
// DETTE SOLDÉE
// =============================================================================

/**
 * Félicite l'utilisateur pour dette complètement remboursée
 * 
 * @param {String} userId - ID de l'utilisateur
 * @param {Object} debt - Dette soldée
 * @returns {Object} Notification créée
 */
async function notifyDebtSettled(userId, debt) {
  try {
    if (!CONFIG.ENABLED_NOTIFICATIONS.settled) {
      return null;
    }

    console.log(`💳 [Debt Notifications] Dette soldée "${debt.description}"`);

    const { description, amount, currency, createdAt, payments } = debt;

    // Calculer durée remboursement
    const daysTaken = Math.ceil((new Date() - new Date(createdAt)) / (1000 * 60 * 60 * 24));
    const monthsTaken = Math.round(daysTaken / 30);

    const notification = await NotificationService.create(userId, {
      type: 'debt_settled',
      title: `🎉 Félicitations ! Dette "${description}" soldée`,
      message: `Vous avez terminé de rembourser ${amount.toLocaleString()} ${currency} en ${monthsTaken} mois (${payments.length} paiements). Excellente gestion financière ! Continuez comme ça.`,
      priority: 'high',
      category: 'debt',
      data: {
        debtId: debt._id,
        description: description,
        amount: amount,
        currency: currency,
        daysTaken: daysTaken,
        monthsTaken: monthsTaken,
        paymentsCount: payments.length,
        settledDate: new Date()
      },
      actionable: true,
      actions: [
        {
          label: 'Voir Historique Complet',
          type: 'navigate',
          value: `/debts/${debt._id}/history`
        },
        {
          label: 'Voir Statistiques Dettes',
          type: 'navigate',
          value: '/debts/stats'
        },
        {
          label: 'Archiver Dette',
          type: 'navigate',
          value: `/debts/${debt._id}/archive`
        }
      ]
    });

    console.log(`✅ Notification dette soldée envoyée`);
    return notification;

  } catch (error) {
    console.error('❌ Erreur notifyDebtSettled:', error);
    return null;
  }
}

// =============================================================================
// DETTE ANNULÉE
// =============================================================================

/**
 * Notifie l'annulation d'une dette
 * 
 * @param {String} userId - ID de l'utilisateur
 * @param {Object} debt - Dette annulée
 * @param {String} reason - Raison de l'annulation
 * @returns {Object} Notification créée
 */
async function notifyDebtCancelled(userId, debt, reason) {
  try {
    if (!CONFIG.ENABLED_NOTIFICATIONS.cancelled) {
      return null;
    }

    console.log(`💳 [Debt Notifications] Dette annulée "${debt.description}"`);

    const { description, amount, currency, remainingAmount } = debt;

    const notification = await NotificationService.create(userId, {
      type: 'debt_cancelled',
      title: `Dette annulée : ${description}`,
      message: `Dette de ${amount.toLocaleString()} ${currency} annulée. Montant restant: ${remainingAmount.toLocaleString()} ${currency}. ${reason ? `Raison: ${reason}` : ''}`,
      priority: 'normal',
      category: 'debt',
      data: {
        debtId: debt._id,
        description: description,
        amount: amount,
        remainingAmount: remainingAmount,
        currency: currency,
        reason: reason,
        cancelledDate: new Date()
      },
      actionable: true,
      actions: [
        {
          label: 'Voir Dettes Actives',
          type: 'navigate',
          value: '/debts'
        }
      ]
    });

    console.log(`✅ Notification dette annulée envoyée`);
    return notification;

  } catch (error) {
    console.error('❌ Erreur notifyDebtCancelled:', error);
    return null;
  }
}

// =============================================================================
// ANALYSE MULTIPLE DETTES
// =============================================================================

/**
 * Analyse plusieurs dettes et crée notifications appropriées
 * 
 * @param {String} userId - ID de l'utilisateur
 * @param {Array} debts - Liste des dettes à analyser
 * @returns {Object} Résumé des notifications créées
 */
async function notifyDebtsStatus(userId, debts) {
  try {
    console.log(`💳 [Debt Notifications] Analyse ${debts.length} dettes pour user ${userId}`);

    const notifications = {
      reminders: [],
      overdue: [],
      skipped: []
    };

    const now = new Date();

    for (const debt of debts) {
      try {
        if (debt.status !== 'active') continue;

        const dueDate = new Date(debt.dueDate);
        const daysUntilDue = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));

        // Dette en retard
        if (daysUntilDue < 0) {
          const daysLate = Math.abs(daysUntilDue);
          const notification = await notifyDebtOverdue(userId, debt, daysLate);
          
          if (notification) {
            notifications.overdue.push(notification._id);
          }
        }
        // Dette approchante (7, 3, ou 1 jour)
        else if (
          daysUntilDue === CONFIG.REMINDER_DAYS.first ||
          daysUntilDue === CONFIG.REMINDER_DAYS.second ||
          daysUntilDue === CONFIG.REMINDER_DAYS.final ||
          daysUntilDue === 0
        ) {
          const notification = await notifyDebtReminder(userId, debt, daysUntilDue);
          
          if (notification) {
            notifications.reminders.push(notification._id);
          }
        } else {
          notifications.skipped.push(debt._id);
        }

      } catch (error) {
        console.error(`❌ Erreur notification dette ${debt._id}:`, error.message);
        notifications.skipped.push(debt._id);
      }
    }

    console.log(`🎉 Résumé : ${notifications.reminders.length} rappels, ${notifications.overdue.length} retards`);

    return {
      reminders: notifications.reminders.length,
      overdue: notifications.overdue.length,
      skipped: notifications.skipped.length,
      notificationIds: [...notifications.reminders, ...notifications.overdue]
    };

  } catch (error) {
    console.error('❌ Erreur notifyDebtsStatus:', error);
    return { reminders: 0, overdue: 0, skipped: 0 };
  }
}

// =============================================================================
// UTILITAIRES
// =============================================================================

/**
 * Calcule les rappels nécessaires pour une dette
 * 
 * @param {Date} dueDate - Date d'échéance
 * @returns {Array} Liste des rappels à créer
 */
function calculateReminders(dueDate) {
  const now = new Date();
  const daysUntil = Math.ceil((new Date(dueDate) - now) / (1000 * 60 * 60 * 24));

  const reminders = [];

  if (daysUntil === CONFIG.REMINDER_DAYS.first) {
    reminders.push({ type: 'first', daysUntil });
  }

  if (daysUntil === CONFIG.REMINDER_DAYS.second) {
    reminders.push({ type: 'second', daysUntil });
  }

  if (daysUntil === CONFIG.REMINDER_DAYS.final) {
    reminders.push({ type: 'final', daysUntil });
  }

  if (daysUntil === 0) {
    reminders.push({ type: 'today', daysUntil });
  }

  return reminders;
}

/**
 * Détermine si une dette nécessite attention urgente
 * 
 * @param {Object} debt - Dette à évaluer
 * @returns {Boolean} True si attention urgente nécessaire
 */
function requiresUrgentAttention(debt) {
  const now = new Date();
  const dueDate = new Date(debt.dueDate);
  const daysUntilDue = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));

  // Dette en retard
  if (daysUntilDue < 0) return true;

  // Dette échéance dans moins de 3 jours
  if (daysUntilDue <= 3) return true;

  // Dette montant élevé et échéance proche
  if (debt.remainingAmount > CONFIG.ALERT_THRESHOLDS.highAmount && daysUntilDue <= 7) {
    return true;
  }

  return false;
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  // Fonctions principales
  notifyDebtCreated,
  notifyDebtReminder,
  notifyDebtOverdue,
  notifyDebtPayment,
  notifyDebtSettled,
  notifyDebtCancelled,
  notifyDebtsStatus,
  
  // Utilitaires
  calculateReminders,
  requiresUrgentAttention,
  
  // Configuration (pour tests/personnalisation)
  CONFIG
};