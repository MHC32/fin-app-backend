// src/cron/solReminders.js
// Cron job pour rappels automatiques des paiements de sols/tontines
// S'exécute tous les jours à 9h pour alerter les participants

const Sol = require('../models/Sol');
const NotificationService = require('../services/notificationService');
const mongoose = require('mongoose');

// ===================================================================
// CONFIGURATION
// ===================================================================

/**
 * Configuration des rappels sols
 */
const CONFIG = {
  // Nombre de jours à l'avance pour rappeler
  REMINDER_DAYS: [3, 1], // 3 jours avant + 1 jour avant
  
  // Statuts des sols à traiter
  ACTIVE_SOL_STATUSES: ['recruiting', 'active'],
  
  // Types de notifications par jours restants
  NOTIFICATION_TYPES: {
    3: { type: 'info', priority: 'medium' },    // 3 jours = info
    2: { type: 'warning', priority: 'high' },   // 2 jours = warning
    1: { type: 'urgent', priority: 'urgent' }   // 1 jour = urgent
  },
  
  // Messages personnalisés selon contexte Haiti
  MESSAGES: {
    3: 'Votre paiement sol approche dans 3 jours',
    2: 'Votre paiement sol est dans 2 jours',
    1: 'Votre paiement sol est DÛ DEMAIN !',
    0: 'Votre paiement sol est DÛ AUJOURD\'HUI !'
  }
};

// ===================================================================
// FONCTION PRINCIPALE
// ===================================================================

/**
 * Fonction principale exécutée par le cron job
 * Trouve tous les sols avec paiements à venir et crée des notifications
 */
async function processSolReminders() {
  console.log('\n🔔 DÉBUT - Traitement rappels paiements sols'.cyan.bold);
  console.log('⏰ Heure d\'exécution:', new Date().toLocaleString('fr-HT'));
  
  const stats = {
    solsAnalyzed: 0,
    remindersCreated: 0,
    errors: 0,
    participantsNotified: 0,
    solsWithReminders: []
  };

  try {
    // 1. Récupérer tous les sols actifs avec paiements à venir
    const solsToCheck = await getSolsWithUpcomingPayments();
    stats.solsAnalyzed = solsToCheck.length;
    
    console.log(`📊 Sols à analyser: ${solsToCheck.length}`);

    if (solsToCheck.length === 0) {
      console.log('ℹ️  Aucun sol avec paiement à venir trouvé');
      return stats;
    }

    // 2. Traiter chaque sol
    for (const sol of solsToCheck) {
      try {
        const reminders = await processSingleSol(sol);
        stats.remindersCreated += reminders.count;
        stats.participantsNotified += reminders.participants;
        
        if (reminders.count > 0) {
          stats.solsWithReminders.push({
            id: sol._id,
            name: sol.name,
            reminders: reminders.count,
            daysUntilPayment: reminders.daysUntil
          });
        }
        
      } catch (error) {
        console.error(`❌ Erreur traitement sol ${sol._id}:`, error.message);
        stats.errors++;
      }
    }

    // 3. Afficher résumé
    displaySummary(stats);
    
    return stats;

  } catch (error) {
    console.error('❌ ERREUR CRITIQUE - processSolReminders:', error.message);
    stats.errors++;
    throw error;
  } finally {
    console.log('🏁 FIN - Traitement rappels sols\n'.cyan.bold);
  }
}

// ===================================================================
// RÉCUPÉRATION SOLS
// ===================================================================

/**
 * Récupère tous les sols actifs avec des paiements dans les prochains jours
 * @returns {Array} Liste des sols avec nextPaymentDate proche
 */
async function getSolsWithUpcomingPayments() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Début de journée
    
    const maxDays = Math.max(...CONFIG.REMINDER_DAYS);
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + maxDays);
    
    console.log(`🔍 Recherche sols avec paiements entre ${today.toLocaleDateString('fr-HT')} et ${futureDate.toLocaleDateString('fr-HT')}`);
    
    const sols = await Sol.find({
      status: { $in: CONFIG.ACTIVE_SOL_STATUSES },
      nextPaymentDate: {
        $gte: today,
        $lte: futureDate
      },
      isActive: true
    })
    .populate('participants.user', 'firstName lastName email phone notificationPreferences')
    .populate('creator', 'firstName lastName')
    .sort({ nextPaymentDate: 1 }); // Trier par date croissante

    console.log(`✅ ${sols.length} sols trouvés`);
    
    return sols;

  } catch (error) {
    console.error('❌ Erreur getSolsWithUpcomingPayments:', error.message);
    throw error;
  }
}

// ===================================================================
// TRAITEMENT SOL INDIVIDUEL
// ===================================================================

/**
 * Traite un sol spécifique et crée les rappels nécessaires
 * @param {Object} sol - Document Sol MongoDB
 * @returns {Object} Statistiques du traitement
 */
async function processSingleSol(sol) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const paymentDate = new Date(sol.nextPaymentDate);
  paymentDate.setHours(0, 0, 0, 0);
  
  // Calculer jours restants
  const diffTime = paymentDate.getTime() - today.getTime();
  const daysUntilPayment = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  console.log(`\n🏦 Sol: "${sol.name}" (${sol.participants.length} participants)`);
  console.log(`📅 Paiement prévu: ${paymentDate.toLocaleDateString('fr-HT')}`);
  console.log(`⏳ Jours restants: ${daysUntilPayment}`);

  // Vérifier si on doit envoyer rappel pour ce nombre de jours
  if (!CONFIG.REMINDER_DAYS.includes(daysUntilPayment) && daysUntilPayment !== 0) {
    console.log(`ℹ️  Pas de rappel programmé pour ${daysUntilPayment} jour(s)`);
    return { count: 0, participants: 0, daysUntil: daysUntilPayment };
  }

  let remindersCount = 0;
  let participantsCount = 0;

  // Traiter chaque participant
  for (const participant of sol.participants) {
    try {
      // Vérifier si participant a besoin d'un rappel
      if (await shouldSendReminder(participant, sol, daysUntilPayment)) {
        
        await createSolReminder(participant, sol, daysUntilPayment);
        remindersCount++;
        participantsCount++;
        
        console.log(`  ✅ Rappel créé pour ${participant.user.firstName} ${participant.user.lastName}`);
      } else {
        console.log(`  ⏭️  Rappel ignoré pour ${participant.user.firstName} ${participant.user.lastName}`);
      }
      
    } catch (error) {
      console.error(`  ❌ Erreur participant ${participant.user._id}:`, error.message);
    }
  }

  console.log(`📊 Sol "${sol.name}": ${remindersCount} rappels créés`);
  
  return { 
    count: remindersCount, 
    participants: participantsCount, 
    daysUntil: daysUntilPayment 
  };
}

// ===================================================================
// LOGIQUE RAPPELS
// ===================================================================

/**
 * Détermine si un participant doit recevoir un rappel
 * @param {Object} participant - Participant du sol
 * @param {Object} sol - Document Sol
 * @param {number} daysUntilPayment - Jours restants avant paiement
 * @returns {boolean} True si rappel nécessaire
 */
async function shouldSendReminder(participant, sol, daysUntilPayment) {
  // Vérifier si utilisateur a activé les rappels sols
  const userPrefs = participant.user.notificationPreferences;
  if (userPrefs && userPrefs.solReminders === false) {
    return false;
  }

  // Vérifier si participant est actif
  if (participant.status === 'inactive' || participant.status === 'left') {
    return false;
  }

  // Vérifier si paiement déjà effectué pour ce round
  if (participant.paymentStatus === 'paid' || participant.paymentStatus === 'exempt') {
    return false;
  }

  // TODO: Ajouter logique pour éviter spam (pas plus d'1 rappel/jour)
  // Cela nécessiterait de stocker les rappels envoyés

  return true;
}

/**
 * Crée une notification de rappel pour un participant
 * @param {Object} participant - Participant du sol
 * @param {Object} sol - Document Sol
 * @param {number} daysUntilPayment - Jours restants
 */
async function createSolReminder(participant, sol, daysUntilPayment) {
  try {
    // Déterminer type et priorité selon jours restants
    const notifConfig = CONFIG.NOTIFICATION_TYPES[daysUntilPayment] || 
                       CONFIG.NOTIFICATION_TYPES[1]; // Fallback urgent

    // Message personnalisé selon contexte Haiti
    const baseMessage = CONFIG.MESSAGES[daysUntilPayment] || CONFIG.MESSAGES[1];
    const detailedMessage = buildDetailedMessage(sol, daysUntilPayment, participant);

    // Créer notification via service
    await NotificationService.createSolReminder(
      participant.user._id,
      sol,
      daysUntilPayment
    );

    console.log(`    📱 Notification ${notifConfig.type} créée`);

  } catch (error) {
    console.error(`    ❌ Erreur création notification:`, error.message);
    throw error;
  }
}

/**
 * Construit un message détaillé personnalisé pour Haiti
 * @param {Object} sol - Sol concerné
 * @param {number} daysUntil - Jours restants
 * @param {Object} participant - Participant concerné
 * @returns {string} Message personnalisé
 */
function buildDetailedMessage(sol, daysUntil, participant) {
  const amount = `${sol.contributionAmount} ${sol.currency}`;
  const solName = sol.name;
  
  let message = '';
  
  if (daysUntil === 0) {
    message = `🚨 AUJOURD'HUI : Paiement sol "${solName}" de ${amount} dû`;
  } else if (daysUntil === 1) {
    message = `⚠️ DEMAIN : Paiement sol "${solName}" de ${amount} dû`;
  } else {
    message = `💰 Dans ${daysUntil} jours : Paiement sol "${solName}" de ${amount}`;
  }

  // Ajouter détails selon statut participant
  if (participant.paymentHistory?.length > 0) {
    const lastPayment = participant.paymentHistory[participant.paymentHistory.length - 1];
    message += `\n📊 Dernier paiement : ${new Date(lastPayment.date).toLocaleDateString('fr-HT')}`;
  }

  // Ajouter encouragement contextuel Haiti
  if (daysUntil <= 1) {
    message += `\n💪 N'oubliez pas votre engagement envers le groupe !`;
  } else {
    message += `\n📝 Préparez votre paiement à l'avance.`;
  }

  return message;
}

// ===================================================================
// AFFICHAGE RÉSULTATS
// ===================================================================

/**
 * Affiche un résumé détaillé du traitement
 * @param {Object} stats - Statistiques du traitement
 */
function displaySummary(stats) {
  console.log('\n' + '='.repeat(60).green);
  console.log('📊 RÉSUMÉ - RAPPELS SOLS'.bold.green);
  console.log('='.repeat(60).green);
  
  console.log(`📈 Sols analysés: ${stats.solsAnalyzed}`.cyan);
  console.log(`🔔 Rappels créés: ${stats.remindersCreated}`.green);
  console.log(`👥 Participants notifiés: ${stats.participantsNotified}`.blue);
  console.log(`❌ Erreurs: ${stats.errors}`.red);

  if (stats.solsWithReminders.length > 0) {
    console.log('\n📋 DÉTAILS SOLS AVEC RAPPELS:'.bold.cyan);
    stats.solsWithReminders.forEach(sol => {
      console.log(`  • "${sol.name}" - ${sol.reminders} rappels (${sol.daysUntilPayment} jours)`);
    });
  }

  console.log('\n' + '='.repeat(60).green);
  
  if (stats.remindersCreated > 0) {
    console.log(`✅ ${stats.remindersCreated} utilisateurs ont été alertés !`.bold.green);
  } else {
    console.log('ℹ️  Aucun rappel nécessaire aujourd\'hui.'.yellow);
  }
}

// ===================================================================
// UTILITAIRES
// ===================================================================

/**
 * Calcule statistiques rapides pour monitoring
 * @returns {Object} Stats système
 */
async function getQuickStats() {
  try {
    const today = new Date();
    const in7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    const upcomingSols = await Sol.countDocuments({
      status: { $in: CONFIG.ACTIVE_SOL_STATUSES },
      nextPaymentDate: { $gte: today, $lte: in7Days },
      isActive: true
    });

    const totalParticipants = await Sol.aggregate([
      { $match: { status: { $in: CONFIG.ACTIVE_SOL_STATUSES }, isActive: true } },
      { $group: { _id: null, total: { $sum: { $size: '$participants' } } } }
    ]);

    return {
      upcomingSolsNext7Days: upcomingSols,
      totalActiveParticipants: totalParticipants[0]?.total || 0,
      timestamp: new Date()
    };
    
  } catch (error) {
    console.error('Erreur getQuickStats:', error.message);
    return null;
  }
}

// ===================================================================
// EXPORT
// ===================================================================

module.exports = processSolReminders;

// Export fonctions utilitaires pour tests
module.exports.utils = {
  getSolsWithUpcomingPayments,
  processSingleSol,
  shouldSendReminder,
  getQuickStats,
  CONFIG
};

/**
 * ===================================================================
 * 📚 DOCUMENTATION TECHNIQUE - SOL REMINDERS
 * ===================================================================
 * 
 * OBJECTIF :
 * Envoie automatiquement des rappels aux participants de sols
 * pour leurs paiements à venir, réduisant les retards et oublis.
 * 
 * ===================================================================
 * 
 * 🔄 FLUX D'EXÉCUTION :
 * 
 * 1. Recherche sols actifs avec paiements dans 1-3 jours
 * 2. Pour chaque sol trouvé :
 *    → Calcule jours restants avant paiement
 *    → Vérifie si rappel nécessaire pour ce timing
 *    → Pour chaque participant :
 *      - Vérifie préférences notifications
 *      - Vérifie statut participant (actif)
 *      - Vérifie statut paiement (pas déjà payé)
 *      - Crée notification si conditions OK
 * 3. Affiche résumé et statistiques
 * 
 * ===================================================================
 * 
 * ⏰ PLANNING RAPPELS :
 * 
 * • 3 jours avant : Notification INFO/MEDIUM
 *   "💰 Dans 3 jours : Paiement sol [Nom] de [Montant]"
 * 
 * • 1 jour avant : Notification URGENT/HIGH
 *   "⚠️ DEMAIN : Paiement sol [Nom] de [Montant] dû"
 * 
 * • Jour même : Notification URGENT/URGENT
 *   "🚨 AUJOURD'HUI : Paiement sol [Nom] de [Montant] dû"
 * 
 * ===================================================================
 * 
 * 🎯 LOGIQUE MÉTIER :
 * 
 * INCLUSIONS (participant reçoit rappel) :
 * ✅ Sol status = 'recruiting' ou 'active'
 * ✅ Participant status = 'active'
 * ✅ Payment status ≠ 'paid' ou 'exempt'
 * ✅ User notificationPreferences.solReminders ≠ false
 * ✅ Paiement dans 0, 1 ou 3 jours
 * 
 * EXCLUSIONS (pas de rappel) :
 * ❌ Sol inactif ou terminé
 * ❌ Participant ayant quitté le sol
 * ❌ Paiement déjà effectué pour ce round
 * ❌ User ayant désactivé rappels sols
 * 
 * ===================================================================
 * 
 * 📊 EXEMPLES SCÉNARIOS :
 * 
 * Scénario 1 - Sol Famille :
 * • 10 participants, paiement mercredi
 * • Lundi 9h : 8 reçoivent rappel "dans 2 jours"
 * • 2 exclus : 1 déjà payé, 1 notifications désactivées
 * 
 * Scénario 2 - Sol Épargne :
 * • 5 participants, paiement aujourd'hui
 * • 9h : 4 reçoivent rappel URGENT "DÛ AUJOURD'HUI"
 * • 1 exclu : déjà payé hier
 * 
 * ===================================================================
 * 
 * 🔧 PERSONNALISATION HAITI :
 * 
 * Messages adaptés au contexte :
 * • "N'oubliez pas votre engagement envers le groupe !"
 * • Dates format fr-HT
 * • Montants en HTG/USD selon sol
 * • Référence au groupe (aspect social important)
 * 
 * ===================================================================
 * 
 * 📈 MONITORING :
 * 
 * Logs détaillés :
 * • Nombre de sols analysés
 * • Rappels créés par sol
 * • Participants notifiés
 * • Erreurs rencontrées
 * • Temps d'exécution
 * 
 * Métriques utiles :
 * • Taux de rappels vs paiements effectués
 * • Sols avec le plus de retards
 * • Efficacité des rappels 3j vs 1j
 * 
 * ===================================================================
 * 
 * 🚀 TESTS & DEBUG :
 * 
 * Test manuel :
 * const { runJobManually } = require('./cron');
 * await runJobManually('solReminders');
 * 
 * Statistiques rapides :
 * const { utils } = require('./cron/solReminders');
 * const stats = await utils.getQuickStats();
 * 
 * Test sol spécifique :
 * const sol = await Sol.findById('...');
 * const result = await utils.processSingleSol(sol);
 * 
 * ===================================================================
 * 
 * ⚡ OPTIMISATIONS :
 * 
 * Performance :
 * • Query avec populate sélectif (champs nécessaires)
 * • Index sur nextPaymentDate + status
 * • Traitement asynchrone participants
 * 
 * Évolutions v2.0 :
 * • Anti-spam : max 1 rappel/jour/participant
 * • Rappels personnalisés selon historique
 * • Escalade rappels (SMS si pas lu)
 * • Analytics prédictives retards
 * 
 * ===================================================================
 */