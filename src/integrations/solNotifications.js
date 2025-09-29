/**
 * ============================================================================
 * SOL NOTIFICATIONS INTEGRATION
 * ============================================================================
 * 
 * Ce module connecte le système de sols/tontines avec les notifications pour
 * alerter automatiquement les participants sur les tours, paiements, etc.
 * 
 * DÉCLENCHEURS AUTOMATIQUES :
 * - Nouveau sol créé → Notification organisateur
 * - Participant rejoint sol → Notification tous participants
 * - Tour de sol arrivé → Rappel bénéficiaire + participants
 * - Paiement reçu → Confirmation bénéficiaire
 * - Paiement en retard → Alerte urgente
 * - Sol complété → Félicitations tous participants
 * 
 * APPELÉ PAR : solController lors des actions sur sols
 * 
 * @module integrations/solNotifications
 */

const NotificationService = require('../services/notificationService');

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  // Délais de rappel avant tour de sol (en jours)
  REMINDER_DAYS: {
    first: 7,        // Premier rappel 7 jours avant
    second: 3,       // Deuxième rappel 3 jours avant
    final: 1         // Rappel final 1 jour avant
  },

  // Activer/désactiver types de notifications
  ENABLED_NOTIFICATIONS: {
    created: true,
    joined: true,
    turn: true,
    payment: true,
    late: true,
    completed: true
  },

  // Messages contextuels Haiti
  MESSAGES: {
    turn_reminder_htg: "Se tou ou! Prepare kòb la pou peye nan sol la.",
    payment_received_htg: "Ou resevwa lajan sol ou! Itilize li byen.",
    late_payment_htg: "Ou an reta! Voye kòb sol la kounye a."
  }
};

// =============================================================================
// CRÉATION SOL
// =============================================================================

/**
 * Notifie l'organisateur qu'un nouveau sol a été créé
 * 
 * @param {String} userId - ID de l'organisateur
 * @param {Object} sol - Sol créé
 * @returns {Object} Notification créée
 */
async function notifySolCreated(userId, sol) {
  try {
    if (!CONFIG.ENABLED_NOTIFICATIONS.created) {
      return null;
    }

    console.log(`👥 [Sol Notifications] Nouveau sol "${sol.name}" créé`);

    const { name, totalAmount, frequency, participants } = sol;

    const notification = await NotificationService.create(userId, {
      type: 'sol_created',
      title: `Sol "${name}" créé avec succès`,
      message: `Votre sol de ${totalAmount.toLocaleString()} HTG (${frequency}) est maintenant actif. Invitez ${participants} participants pour démarrer !`,
      priority: 'normal',
      category: 'sol',
      data: {
        solId: sol._id,
        solName: name,
        totalAmount: totalAmount,
        frequency: frequency,
        participantsNeeded: participants
      },
      actionable: true,
      actions: [
        {
          label: 'Voir Sol',
          type: 'navigate',
          value: `/sols/${sol._id}`
        },
        {
          label: 'Inviter Participants',
          type: 'navigate',
          value: `/sols/${sol._id}/invite`
        }
      ]
    });

    console.log(`✅ Notification création sol envoyée`);
    return notification;

  } catch (error) {
    console.error('❌ Erreur notifySolCreated:', error);
    return null;
  }
}

// =============================================================================
// PARTICIPANT REJOINT SOL
// =============================================================================

/**
 * Notifie tous les participants qu'un nouveau membre a rejoint
 * 
 * @param {Object} sol - Sol concerné
 * @param {Object} newParticipant - Nouveau participant
 * @returns {Object} Résumé des notifications créées
 */
async function notifyParticipantJoined(sol, newParticipant) {
  try {
    if (!CONFIG.ENABLED_NOTIFICATIONS.joined) {
      return { created: 0 };
    }

    console.log(`👥 [Sol Notifications] ${newParticipant.name} a rejoint "${sol.name}"`);

    const notifications = [];

    // Notifier tous les autres participants
    for (const participant of sol.participants) {
      // Ne pas notifier le nouveau participant
      if (participant.user.toString() === newParticipant.user.toString()) {
        continue;
      }

      try {
        const notification = await NotificationService.create(participant.user, {
          type: 'sol_participant_joined',
          title: `${newParticipant.name} a rejoint "${sol.name}"`,
          message: `Nouveau membre ! ${sol.participants.length}/${sol.totalParticipants} participants. ${sol.isReady ? 'Le sol peut démarrer !' : `Encore ${sol.totalParticipants - sol.participants.length} places disponibles.`}`,
          priority: 'low',
          category: 'sol',
          data: {
            solId: sol._id,
            solName: sol.name,
            newParticipantName: newParticipant.name,
            currentParticipants: sol.participants.length,
            totalParticipants: sol.totalParticipants,
            isReady: sol.isReady
          },
          actionable: true,
          actions: [
            {
              label: 'Voir Sol',
              type: 'navigate',
              value: `/sols/${sol._id}`
            }
          ]
        });

        notifications.push(notification._id);

      } catch (error) {
        console.error(`❌ Erreur notification participant ${participant.user}:`, error.message);
      }
    }

    console.log(`✅ ${notifications.length} notifications envoyées`);
    return { created: notifications.length, notificationIds: notifications };

  } catch (error) {
    console.error('❌ Erreur notifyParticipantJoined:', error);
    return { created: 0 };
  }
}

// =============================================================================
// TOUR DE SOL (RAPPELS)
// =============================================================================

/**
 * Crée des rappels pour le prochain tour de sol
 * 
 * @param {Object} sol - Sol concerné
 * @param {Object} nextTurn - Données du prochain tour
 * @param {Number} daysUntil - Jours restants avant le tour
 * @returns {Object} Résumé des notifications créées
 */
async function notifySolTurnReminder(sol, nextTurn, daysUntil) {
  try {
    if (!CONFIG.ENABLED_NOTIFICATIONS.turn) {
      return { created: 0 };
    }

    console.log(`👥 [Sol Notifications] Rappel tour de sol "${sol.name}" (${daysUntil} jours)`);

    const notifications = [];
    const { participant: beneficiary, dueDate, amountPerParticipant } = nextTurn;

    // Déterminer priorité selon jours restants
    let priority = 'normal';
    if (daysUntil <= 1) priority = 'high';
    if (daysUntil <= 0) priority = 'urgent';

    // 1. Notifier le BÉNÉFICIAIRE
    try {
      const beneficiaryNotif = await NotificationService.create(beneficiary.user, {
        type: 'sol_turn_beneficiary',
        title: `🎉 C'est votre tour de recevoir "${sol.name}"`,
        message: `Vous recevrez ${sol.totalAmount.toLocaleString()} HTG ${daysUntil > 0 ? `dans ${daysUntil} jour(s)` : 'aujourd\'hui'} ! Total: ${(sol.participants.length * amountPerParticipant).toLocaleString()} HTG.`,
        priority: priority,
        category: 'sol',
        data: {
          solId: sol._id,
          solName: sol.name,
          turnNumber: nextTurn.turnNumber,
          amountToReceive: sol.totalAmount,
          dueDate: dueDate,
          daysUntil: daysUntil,
          role: 'beneficiary'
        },
        actionable: true,
        actions: [
          {
            label: 'Voir Sol',
            type: 'navigate',
            value: `/sols/${sol._id}`
          },
          {
            label: 'Confirmer Réception',
            type: 'navigate',
            value: `/sols/${sol._id}/confirm-payment`
          }
        ]
      });

      notifications.push(beneficiaryNotif._id);
      console.log(`✅ Notification bénéficiaire envoyée`);

    } catch (error) {
      console.error(`❌ Erreur notification bénéficiaire:`, error.message);
    }

    // 2. Notifier tous les PAYEURS
    for (const participant of sol.participants) {
      // Skip le bénéficiaire
      if (participant.user.toString() === beneficiary.user.toString()) {
        continue;
      }

      try {
        const payerNotif = await NotificationService.create(participant.user, {
          type: 'sol_turn_payer',
          title: `💰 Paiement sol "${sol.name}" ${daysUntil > 0 ? `dans ${daysUntil} jour(s)` : 'DÛ AUJOURD\'HUI'}`,
          message: `Tour de ${beneficiary.name}. Vous devez payer ${amountPerParticipant.toLocaleString()} HTG ${daysUntil > 0 ? `avant le ${new Date(dueDate).toLocaleDateString('fr-FR')}` : 'aujourd\'hui'}.`,
          priority: priority,
          category: 'sol',
          data: {
            solId: sol._id,
            solName: sol.name,
            turnNumber: nextTurn.turnNumber,
            amountToPay: amountPerParticipant,
            beneficiaryName: beneficiary.name,
            dueDate: dueDate,
            daysUntil: daysUntil,
            role: 'payer'
          },
          actionable: true,
          actions: [
            {
              label: 'Voir Sol',
              type: 'navigate',
              value: `/sols/${sol._id}`
            },
            {
              label: 'Enregistrer Paiement',
              type: 'navigate',
              value: `/sols/${sol._id}/pay`
            }
          ]
        });

        notifications.push(payerNotif._id);

      } catch (error) {
        console.error(`❌ Erreur notification payeur ${participant.user}:`, error.message);
      }
    }

    console.log(`✅ ${notifications.length} notifications tour créées`);
    return { created: notifications.length, notificationIds: notifications };

  } catch (error) {
    console.error('❌ Erreur notifySolTurnReminder:', error);
    return { created: 0 };
  }
}

// =============================================================================
// PAIEMENT REÇU
// =============================================================================

/**
 * Notifie le bénéficiaire qu'un paiement a été effectué
 * 
 * @param {String} beneficiaryId - ID du bénéficiaire
 * @param {Object} payment - Détails du paiement
 * @returns {Object} Notification créée
 */
async function notifyPaymentReceived(beneficiaryId, payment) {
  try {
    if (!CONFIG.ENABLED_NOTIFICATIONS.payment) {
      return null;
    }

    console.log(`👥 [Sol Notifications] Paiement reçu pour sol "${payment.solName}"`);

    const { solId, solName, amount, payerName, turnNumber, totalReceived, totalExpected } = payment;

    const percentage = Math.round((totalReceived / totalExpected) * 100);
    const remaining = totalExpected - totalReceived;

    const notification = await NotificationService.create(beneficiaryId, {
      type: 'sol_payment_received',
      title: `💰 Paiement reçu pour "${solName}"`,
      message: `${payerName} a payé ${amount.toLocaleString()} HTG. Total reçu: ${totalReceived.toLocaleString()} HTG / ${totalExpected.toLocaleString()} HTG (${percentage}%). ${remaining > 0 ? `Reste ${remaining.toLocaleString()} HTG à recevoir.` : 'Tous les paiements reçus !'}`,
      priority: remaining > 0 ? 'normal' : 'high',
      category: 'sol',
      data: {
        solId: solId,
        solName: solName,
        turnNumber: turnNumber,
        payerName: payerName,
        amount: amount,
        totalReceived: totalReceived,
        totalExpected: totalExpected,
        percentage: percentage,
        remaining: remaining,
        isComplete: remaining <= 0
      },
      actionable: true,
      actions: [
        {
          label: 'Voir Sol',
          type: 'navigate',
          value: `/sols/${solId}`
        },
        {
          label: 'Voir Paiements',
          type: 'navigate',
          value: `/sols/${solId}/payments`
        }
      ]
    });

    console.log(`✅ Notification paiement reçu envoyée`);
    return notification;

  } catch (error) {
    console.error('❌ Erreur notifyPaymentReceived:', error);
    return null;
  }
}

// =============================================================================
// PAIEMENT EN RETARD
// =============================================================================

/**
 * Alerte pour paiement sol en retard
 * 
 * @param {String} userId - ID du participant en retard
 * @param {Object} latePayment - Détails du paiement en retard
 * @returns {Object} Notification créée
 */
async function notifyLatePayment(userId, latePayment) {
  try {
    if (!CONFIG.ENABLED_NOTIFICATIONS.late) {
      return null;
    }

    console.log(`👥 [Sol Notifications] Paiement en retard pour "${latePayment.solName}"`);

    const { solId, solName, amount, daysLate, beneficiaryName, turnNumber } = latePayment;

    const notification = await NotificationService.create(userId, {
      type: 'sol_late_payment',
      title: `⚠️ RETARD - Paiement sol "${solName}"`,
      message: `Votre paiement de ${amount.toLocaleString()} HTG est en retard de ${daysLate} jour(s) ! Tour de ${beneficiaryName}. Payez immédiatement pour maintenir votre réputation dans le sol.`,
      priority: 'urgent',
      category: 'sol',
      data: {
        solId: solId,
        solName: solName,
        turnNumber: turnNumber,
        amount: amount,
        daysLate: daysLate,
        beneficiaryName: beneficiaryName
      },
      actionable: true,
      actions: [
        {
          label: 'Payer Maintenant',
          type: 'navigate',
          value: `/sols/${solId}/pay`
        },
        {
          label: 'Voir Sol',
          type: 'navigate',
          value: `/sols/${solId}`
        }
      ]
    });

    console.log(`✅ Notification retard envoyée`);
    return notification;

  } catch (error) {
    console.error('❌ Erreur notifyLatePayment:', error);
    return null;
  }
}

// =============================================================================
// SOL COMPLÉTÉ
// =============================================================================

/**
 * Félicite tous les participants pour sol terminé avec succès
 * 
 * @param {Object} sol - Sol terminé
 * @returns {Object} Résumé des notifications créées
 */
async function notifySolCompleted(sol) {
  try {
    if (!CONFIG.ENABLED_NOTIFICATIONS.completed) {
      return { created: 0 };
    }

    console.log(`👥 [Sol Notifications] Sol "${sol.name}" complété avec succès`);

    const notifications = [];
    const { name, totalAmount, participants, turns } = sol;

    // Notifier tous les participants
    for (const participant of participants) {
      try {
        const notification = await NotificationService.create(participant.user, {
          type: 'sol_completed',
          title: `🎉 Sol "${name}" terminé avec succès !`,
          message: `Félicitations ! Tous les ${turns.length} tours ont été complétés. Total géré: ${(totalAmount * turns.length).toLocaleString()} HTG. Merci pour votre participation ! Voulez-vous créer un nouveau sol ?`,
          priority: 'normal',
          category: 'sol',
          data: {
            solId: sol._id,
            solName: name,
            totalTurns: turns.length,
            totalAmountManaged: totalAmount * turns.length,
            participantCount: participants.length,
            yourContribution: totalAmount,
            yourReception: totalAmount
          },
          actionable: true,
          actions: [
            {
              label: 'Voir Historique',
              type: 'navigate',
              value: `/sols/${sol._id}/history`
            },
            {
              label: 'Créer Nouveau Sol',
              type: 'navigate',
              value: '/sols/create'
            },
            {
              label: 'Inviter pour Sol',
              type: 'navigate',
              value: '/sols/invite'
            }
          ]
        });

        notifications.push(notification._id);

      } catch (error) {
        console.error(`❌ Erreur notification participant ${participant.user}:`, error.message);
      }
    }

    console.log(`✅ ${notifications.length} notifications félicitations envoyées`);
    return { created: notifications.length, notificationIds: notifications };

  } catch (error) {
    console.error('❌ Erreur notifySolCompleted:', error);
    return { created: 0 };
  }
}

// =============================================================================
// SOL DÉMARRÉ
// =============================================================================

/**
 * Notifie tous les participants que le sol démarre
 * 
 * @param {Object} sol - Sol qui démarre
 * @returns {Object} Résumé des notifications créées
 */
async function notifySolStarted(sol) {
  try {
    if (!CONFIG.ENABLED_NOTIFICATIONS.created) {
      return { created: 0 };
    }

    console.log(`👥 [Sol Notifications] Sol "${sol.name}" démarre`);

    const notifications = [];
    const { name, totalAmount, frequency, participants, turns } = sol;

    // Notifier tous les participants
    for (const participant of participants) {
      try {
        const participantTurn = turns.find(t => t.participant.toString() === participant.user.toString());
        const turnPosition = participantTurn ? participantTurn.turnNumber : 'TBD';

        const notification = await NotificationService.create(participant.user, {
          type: 'sol_started',
          title: `🚀 Sol "${name}" démarré !`,
          message: `Le sol est maintenant actif avec ${participants.length} participants. Montant: ${totalAmount.toLocaleString()} HTG (${frequency}). Votre tour: #${turnPosition}. Consultez le calendrier des paiements !`,
          priority: 'high',
          category: 'sol',
          data: {
            solId: sol._id,
            solName: name,
            totalAmount: totalAmount,
            frequency: frequency,
            participantCount: participants.length,
            yourTurnNumber: turnPosition,
            totalTurns: turns.length
          },
          actionable: true,
          actions: [
            {
              label: 'Voir Calendrier',
              type: 'navigate',
              value: `/sols/${sol._id}/calendar`
            },
            {
              label: 'Voir Sol',
              type: 'navigate',
              value: `/sols/${sol._id}`
            }
          ]
        });

        notifications.push(notification._id);

      } catch (error) {
        console.error(`❌ Erreur notification participant ${participant.user}:`, error.message);
      }
    }

    console.log(`✅ ${notifications.length} notifications démarrage envoyées`);
    return { created: notifications.length, notificationIds: notifications };

  } catch (error) {
    console.error('❌ Erreur notifySolStarted:', error);
    return { created: 0 };
  }
}

// =============================================================================
// UTILITAIRES
// =============================================================================

/**
 * Calcule les rappels nécessaires pour un tour de sol
 * 
 * @param {Date} dueDate - Date d'échéance du tour
 * @returns {Object} Liste des rappels à créer
 */
function calculateReminders(dueDate) {
  const now = new Date();
  const daysUntil = Math.ceil((new Date(dueDate) - now) / (1000 * 60 * 60 * 24));

  const reminders = [];

  // Premier rappel (7 jours avant)
  if (daysUntil <= CONFIG.REMINDER_DAYS.first && daysUntil > CONFIG.REMINDER_DAYS.second) {
    reminders.push({ type: 'first', daysUntil });
  }

  // Deuxième rappel (3 jours avant)
  if (daysUntil <= CONFIG.REMINDER_DAYS.second && daysUntil > CONFIG.REMINDER_DAYS.final) {
    reminders.push({ type: 'second', daysUntil });
  }

  // Rappel final (1 jour avant ou le jour même)
  if (daysUntil <= CONFIG.REMINDER_DAYS.final) {
    reminders.push({ type: 'final', daysUntil });
  }

  return reminders;
}

/**
 * Vérifie si un participant a des paiements en retard
 * 
 * @param {Object} participant - Participant à vérifier
 * @param {Array} turns - Tous les tours du sol
 * @returns {Array} Liste des paiements en retard
 */
function checkLatePayments(participant, turns) {
  const now = new Date();
  const latePayments = [];

  turns.forEach(turn => {
    if (turn.status === 'active' && new Date(turn.dueDate) < now) {
      const payment = turn.payments.find(p => 
        p.from.toString() === participant.user.toString()
      );

      if (!payment || payment.status !== 'completed') {
        latePayments.push({
          turnNumber: turn.turnNumber,
          dueDate: turn.dueDate,
          daysLate: Math.ceil((now - new Date(turn.dueDate)) / (1000 * 60 * 60 * 24)),
          amount: turn.amountPerParticipant
        });
      }
    }
  });

  return latePayments;
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  // Fonctions principales
  notifySolCreated,
  notifyParticipantJoined,
  notifySolTurnReminder,
  notifyPaymentReceived,
  notifyLatePayment,
  notifySolCompleted,
  notifySolStarted,
  
  // Utilitaires
  calculateReminders,
  checkLatePayments,
  
  // Configuration (pour tests/personnalisation)
  CONFIG
};