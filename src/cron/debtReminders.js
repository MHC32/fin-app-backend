// src/cron/debtReminders.js
// Cron job pour rappels automatiques des dettes et créances
// S'exécute tous les jours à 10h pour alerter sur paiements dus et retards

const Debt = require('../models/Debt');
const NotificationService = require('../services/notificationService');
const mongoose = require('mongoose');

// ===================================================================
// CONFIGURATION
// ===================================================================

/**
 * Configuration des rappels dettes
 */
const CONFIG = {
  // Jours d'avance pour rappels préventifs
  PREVIEW_REMINDER_DAYS: [3, 1], // 3 jours + 1 jour avant échéance
  
  // Escalade des alertes selon jours de retard
  OVERDUE_ESCALATION: {
    1: { type: 'warning', priority: 'high', frequency: 'daily' },
    3: { type: 'urgent', priority: 'urgent', frequency: 'daily' },
    7: { type: 'urgent', priority: 'urgent', frequency: 'daily', critical: true },
    14: { type: 'urgent', priority: 'urgent', frequency: 'daily', critical: true },
    30: { type: 'urgent', priority: 'urgent', frequency: 'weekly', critical: true }
  },
  
  // Types de dettes à traiter
  ACTIVE_DEBT_STATUSES: ['active', 'overdue'],
  DEBT_TYPES_TO_REMIND: ['debt', 'loan'], // debt = je dois, loan = on me doit
  
  // Messages contextuels Haiti
  MESSAGES: {
    PREVIEW: {
      3: 'Rappel : Paiement dû dans 3 jours',
      1: 'Important : Paiement dû demain'
    },
    OVERDUE: {
      1: 'Paiement en retard de 1 jour',
      3: 'URGENT : 3 jours de retard',
      7: 'CRITIQUE : 1 semaine de retard',
      14: 'ALERTE : 2 semaines de retard',
      30: 'ESCALADE : 1 mois de retard'
    }
  }
};

// ===================================================================
// FONCTION PRINCIPALE
// ===================================================================

/**
 * Fonction principale exécutée par le cron job
 * Traite les rappels préventifs ET les alertes de retard
 */
async function processDebtReminders() {
  console.log('\n💳 DÉBUT - Traitement rappels dettes et créances'.cyan.bold);
  console.log('⏰ Heure d\'exécution:', new Date().toLocaleString('fr-HT'));
  
  const stats = {
    debtsAnalyzed: 0,
    previewReminders: 0,
    overdueAlerts: 0,
    usersNotified: 0,
    errors: 0,
    criticalCases: 0,
    totalReminders: 0,
    debtDetails: []
  };

  try {
    // Traitement en 2 phases
    console.log('\n📋 PHASE 1: Rappels préventifs (paiements à venir)');
    const previewStats = await processPreviewReminders();
    
    console.log('\n🚨 PHASE 2: Alertes retards (paiements en retard)');
    const overdueStats = await processOverdueAlerts();
    
    // Consolider statistiques
    stats.debtsAnalyzed = previewStats.analyzed + overdueStats.analyzed;
    stats.previewReminders = previewStats.reminders;
    stats.overdueAlerts = overdueStats.alerts;
    stats.usersNotified = previewStats.users + overdueStats.users;
    stats.errors = previewStats.errors + overdueStats.errors;
    stats.criticalCases = overdueStats.critical;
    stats.totalReminders = stats.previewReminders + stats.overdueAlerts;
    stats.debtDetails = [...previewStats.details, ...overdueStats.details];
    
    // Afficher résumé
    displaySummary(stats);
    
    return stats;

  } catch (error) {
    console.error('❌ ERREUR CRITIQUE - processDebtReminders:', error.message);
    stats.errors++;
    throw error;
  } finally {
    console.log('🏁 FIN - Traitement rappels dettes\n'.cyan.bold);
  }
}

// ===================================================================
// RAPPELS PRÉVENTIFS (PAIEMENTS À VENIR)
// ===================================================================

/**
 * Traite les rappels préventifs pour paiements à venir
 * @returns {Object} Statistiques du traitement
 */
async function processPreviewReminders() {
  const stats = { analyzed: 0, reminders: 0, users: 0, errors: 0, details: [] };
  
  try {
    // Récupérer dettes avec paiements dans les prochains jours
    const upcomingDebts = await getUpcomingDebts();
    stats.analyzed = upcomingDebts.length;
    
    console.log(`📊 Dettes avec paiements à venir: ${upcomingDebts.length}`);

    if (upcomingDebts.length === 0) {
      console.log('ℹ️  Aucun paiement à venir dans les 3 prochains jours');
      return stats;
    }

    // Traiter chaque dette
    for (const debt of upcomingDebts) {
      try {
        const result = await processUpcomingDebt(debt);
        
        if (result.reminderSent) {
          stats.reminders++;
          stats.users++;
          stats.details.push({
            id: debt._id,
            description: debt.description,
            type: 'preview',
            daysUntil: result.daysUntil,
            amount: debt.nextPaymentAmount
          });
        }
        
      } catch (error) {
        console.error(`❌ Erreur dette ${debt._id}:`, error.message);
        stats.errors++;
      }
    }
    
  } catch (error) {
    console.error('❌ Erreur processPreviewReminders:', error.message);
    stats.errors++;
  }
  
  return stats;
}

/**
 * Récupère les dettes avec paiements dans les prochains jours
 */
async function getUpcomingDebts() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const maxDays = Math.max(...CONFIG.PREVIEW_REMINDER_DAYS);
  const futureDate = new Date(today);
  futureDate.setDate(today.getDate() + maxDays);
  
  return await Debt.find({
    status: { $in: CONFIG.ACTIVE_DEBT_STATUSES },
    type: { $in: CONFIG.DEBT_TYPES_TO_REMIND },
    nextPaymentDate: { $gte: today, $lte: futureDate },
    isActive: true
  })
  .populate('user', 'firstName lastName email notificationPreferences')
  .sort({ nextPaymentDate: 1 });
}

/**
 * Traite une dette avec paiement à venir
 */
async function processUpcomingDebt(debt) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const paymentDate = new Date(debt.nextPaymentDate);
  paymentDate.setHours(0, 0, 0, 0);
  
  const daysUntilPayment = Math.ceil((paymentDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  console.log(`  💳 "${debt.description}" - Paiement dans ${daysUntilPayment} jour(s)`);
  
  // Vérifier si rappel nécessaire pour ce timing
  if (!CONFIG.PREVIEW_REMINDER_DAYS.includes(daysUntilPayment)) {
    console.log(`    ⏭️ Pas de rappel programmé pour ${daysUntilPayment} jour(s)`);
    return { reminderSent: false, daysUntil: daysUntilPayment };
  }
  
  // Vérifier préférences utilisateur
  if (!shouldSendDebtReminder(debt.user, 'preview')) {
    console.log(`    🔕 Rappels désactivés pour ${debt.user.firstName}`);
    return { reminderSent: false, daysUntil: daysUntilPayment };
  }
  
  // Créer rappel préventif
  await NotificationService.createDebtReminder(debt.user._id, debt, 0); // 0 = pas encore en retard
  console.log(`    ✅ Rappel préventif créé (${daysUntilPayment} jour(s))`);
  
  return { reminderSent: true, daysUntil: daysUntilPayment };
}

// ===================================================================
// ALERTES RETARDS (PAIEMENTS EN RETARD)
// ===================================================================

/**
 * Traite les alertes pour paiements en retard
 * @returns {Object} Statistiques du traitement
 */
async function processOverdueAlerts() {
  const stats = { analyzed: 0, alerts: 0, users: 0, errors: 0, critical: 0, details: [] };
  
  try {
    // Récupérer dettes en retard
    const overdueDebts = await getOverdueDebts();
    stats.analyzed = overdueDebts.length;
    
    console.log(`🚨 Dettes en retard: ${overdueDebts.length}`);

    if (overdueDebts.length === 0) {
      console.log('✅ Aucune dette en retard - Félicitations !');
      return stats;
    }

    // Traiter chaque dette en retard
    for (const debt of overdueDebts) {
      try {
        const result = await processOverdueDebt(debt);
        
        if (result.alertSent) {
          stats.alerts++;
          stats.users++;
          
          if (result.critical) {
            stats.critical++;
          }
          
          stats.details.push({
            id: debt._id,
            description: debt.description,
            type: 'overdue',
            daysOverdue: result.daysOverdue,
            amount: debt.nextPaymentAmount,
            critical: result.critical
          });
        }
        
      } catch (error) {
        console.error(`❌ Erreur dette retard ${debt._id}:`, error.message);
        stats.errors++;
      }
    }
    
  } catch (error) {
    console.error('❌ Erreur processOverdueAlerts:', error.message);
    stats.errors++;
  }
  
  return stats;
}

/**
 * Récupère les dettes en retard
 */
async function getOverdueDebts() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return await Debt.find({
    status: { $in: CONFIG.ACTIVE_DEBT_STATUSES },
    type: { $in: CONFIG.DEBT_TYPES_TO_REMIND },
    nextPaymentDate: { $lt: today }, // Paiement dû avant aujourd'hui
    isActive: true
  })
  .populate('user', 'firstName lastName email notificationPreferences')
  .sort({ nextPaymentDate: 1 }); // Plus anciens d'abord
}

/**
 * Traite une dette en retard
 */
async function processOverdueDebt(debt) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const paymentDate = new Date(debt.nextPaymentDate);
  paymentDate.setHours(0, 0, 0, 0);
  
  const daysOverdue = Math.ceil((today.getTime() - paymentDate.getTime()) / (1000 * 60 * 60 * 24));
  
  console.log(`  🚨 "${debt.description}" - ${daysOverdue} jour(s) de retard`);
  
  // Vérifier si alerte nécessaire selon escalade
  const escalation = getEscalationLevel(daysOverdue);
  if (!escalation) {
    console.log(`    ⏭️ Pas d'alerte pour ${daysOverdue} jour(s) de retard`);
    return { alertSent: false, daysOverdue, critical: false };
  }
  
  // Vérifier fréquence (éviter spam)
  if (!shouldSendAlertToday(debt, daysOverdue, escalation)) {
    console.log(`    🔕 Alerte déjà envoyée récemment`);
    return { alertSent: false, daysOverdue, critical: escalation.critical || false };
  }
  
  // Vérifier préférences utilisateur
  if (!shouldSendDebtReminder(debt.user, 'overdue')) {
    console.log(`    🔕 Alertes désactivées pour ${debt.user.firstName}`);
    return { alertSent: false, daysOverdue, critical: false };
  }
  
  // Créer alerte retard
  await NotificationService.createDebtReminder(debt.user._id, debt, daysOverdue);
  
  const alertLevel = escalation.critical ? 'CRITIQUE' : 'NORMALE';
  console.log(`    ✅ Alerte ${alertLevel} créée (${daysOverdue} jour(s) retard)`);
  
  return { 
    alertSent: true, 
    daysOverdue, 
    critical: escalation.critical || false 
  };
}

// ===================================================================
// LOGIQUE MÉTIER
// ===================================================================

/**
 * Détermine le niveau d'escalade selon jours de retard
 */
function getEscalationLevel(daysOverdue) {
  // Chercher le niveau d'escalade approprié
  const escalationDays = Object.keys(CONFIG.OVERDUE_ESCALATION)
    .map(Number)
    .sort((a, b) => b - a); // Tri descendant
  
  for (const days of escalationDays) {
    if (daysOverdue >= days) {
      return CONFIG.OVERDUE_ESCALATION[days];
    }
  }
  
  return null; // Pas d'escalade nécessaire
}

/**
 * Vérifie si on doit envoyer l'alerte aujourd'hui (évite spam)
 */
function shouldSendAlertToday(debt, daysOverdue, escalation) {
  // Logique simplifiée : toujours envoyer pour l'instant
  // TODO: Ajouter logique anti-spam basée sur dernière notification envoyée
  
  if (escalation.frequency === 'daily') {
    return true; // Quotidien
  }
  
  if (escalation.frequency === 'weekly') {
    // Hebdomadaire : seulement le lundi
    const today = new Date();
    return today.getDay() === 1; // 1 = Lundi
  }
  
  return true;
}

/**
 * Vérifie si utilisateur accepte les rappels de dettes
 */
function shouldSendDebtReminder(user, reminderType) {
  const prefs = user.notificationPreferences;
  
  if (!prefs) return true; // Pas de préférences = accepte tout
  
  // Vérifier préférence générale dettes
  if (prefs.debtReminders === false) {
    return false;
  }
  
  // Préférences spécifiques selon type
  if (reminderType === 'preview' && prefs.debtPreviewReminders === false) {
    return false;
  }
  
  if (reminderType === 'overdue' && prefs.debtOverdueAlerts === false) {
    return false;
  }
  
  return true;
}

// ===================================================================
// AFFICHAGE RÉSULTATS
// ===================================================================

/**
 * Affiche un résumé détaillé du traitement
 */
function displaySummary(stats) {
  console.log('\n' + '='.repeat(60).green);
  console.log('📊 RÉSUMÉ - RAPPELS DETTES'.bold.green);
  console.log('='.repeat(60).green);
  
  console.log(`📈 Dettes analysées: ${stats.debtsAnalyzed}`.cyan);
  console.log(`📅 Rappels préventifs: ${stats.previewReminders}`.blue);
  console.log(`🚨 Alertes retards: ${stats.overdueAlerts}`.orange);
  console.log(`⚠️  Cas critiques: ${stats.criticalCases}`.red);
  console.log(`👥 Utilisateurs notifiés: ${stats.usersNotified}`.green);
  console.log(`❌ Erreurs: ${stats.errors}`.red);

  if (stats.debtDetails.length > 0) {
    console.log('\n📋 DÉTAILS NOTIFICATIONS:'.bold.cyan);
    
    // Grouper par type
    const preview = stats.debtDetails.filter(d => d.type === 'preview');
    const overdue = stats.debtDetails.filter(d => d.type === 'overdue');
    
    if (preview.length > 0) {
      console.log('\n  📅 RAPPELS PRÉVENTIFS:'.blue);
      preview.forEach(debt => {
        console.log(`    • "${debt.description}" - ${debt.daysUntil} jour(s) (${debt.amount} HTG)`);
      });
    }
    
    if (overdue.length > 0) {
      console.log('\n  🚨 ALERTES RETARDS:'.red);
      overdue.forEach(debt => {
        const indicator = debt.critical ? '⚠️ ' : '• ';
        console.log(`    ${indicator}"${debt.description}" - ${debt.daysOverdue} jour(s) retard (${debt.amount} HTG)`);
      });
    }
  }

  console.log('\n' + '='.repeat(60).green);
  
  if (stats.totalReminders > 0) {
    console.log(`✅ ${stats.totalReminders} rappels envoyés !`.bold.green);
    if (stats.criticalCases > 0) {
      console.log(`⚠️  ${stats.criticalCases} cas critique(s) nécessitent attention immédiate !`.bold.red);
    }
  } else {
    console.log('ℹ️  Aucun rappel nécessaire - Situation financière saine !'.yellow);
  }
}

// ===================================================================
// UTILITAIRES
// ===================================================================

/**
 * Calcule statistiques rapides pour monitoring
 */
async function getQuickStats() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const [upcomingCount, overdueCount, criticalCount] = await Promise.all([
      // Paiements dans les 3 prochains jours
      Debt.countDocuments({
        status: { $in: CONFIG.ACTIVE_DEBT_STATUSES },
        nextPaymentDate: { 
          $gte: today, 
          $lte: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000) 
        },
        isActive: true
      }),
      
      // Paiements en retard
      Debt.countDocuments({
        status: { $in: CONFIG.ACTIVE_DEBT_STATUSES },
        nextPaymentDate: { $lt: today },
        isActive: true
      }),
      
      // Retards critiques (>7 jours)
      Debt.countDocuments({
        status: { $in: CONFIG.ACTIVE_DEBT_STATUSES },
        nextPaymentDate: { $lt: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000) },
        isActive: true
      })
    ]);

    return {
      upcomingPayments: upcomingCount,
      overduePayments: overdueCount,
      criticalCases: criticalCount,
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

module.exports = processDebtReminders;

// Export fonctions utilitaires pour tests
module.exports.utils = {
  processPreviewReminders,
  processOverdueAlerts,
  getUpcomingDebts,
  getOverdueDebts,
  getEscalationLevel,
  shouldSendDebtReminder,
  getQuickStats,
  CONFIG
};

/**
 * ===================================================================
 * 📚 DOCUMENTATION TECHNIQUE - DEBT REMINDERS
 * ===================================================================
 * 
 * OBJECTIF :
 * Système de rappels automatiques pour dettes et créances avec
 * escalade intelligente selon niveau de retard.
 * 
 * ===================================================================
 * 
 * 🔄 FLUX D'EXÉCUTION :
 * 
 * PHASE 1 - Rappels Préventifs :
 * • Trouve dettes avec paiement dans 1-3 jours
 * • Envoie rappels "amicaux" pour éviter retards
 * • Type INFO/WARNING selon proximité échéance
 * 
 * PHASE 2 - Alertes Retards :
 * • Trouve dettes avec paiements dépassés
 * • Calcule jours de retard
 * • Applique escalade selon gravité
 * • Évite spam avec fréquence adaptée
 * 
 * ===================================================================
 * 
 * ⚡ ESCALADE ALERTES RETARD :
 * 
 * • 1 jour : WARNING/HIGH (quotidien)
 *   "Paiement en retard de 1 jour"
 * 
 * • 3 jours : URGENT/URGENT (quotidien)  
 *   "URGENT : 3 jours de retard"
 * 
 * • 7 jours : URGENT/URGENT + CRITICAL (quotidien)
 *   "CRITIQUE : 1 semaine de retard"
 * 
 * • 14 jours : URGENT/URGENT + CRITICAL (quotidien)
 *   "ALERTE : 2 semaines de retard"
 * 
 * • 30+ jours : URGENT/URGENT + CRITICAL (hebdomadaire)
 *   "ESCALADE : 1 mois de retard"
 * 
 * ===================================================================
 * 
 * 🎯 TYPES DE DETTES TRAITÉES :
 * 
 * • type='debt' : Je dois de l'argent (mes dettes)
 * • type='loan' : On me doit de l'argent (mes créances)
 * 
 * Status traités : 'active', 'overdue'
 * Status ignorés : 'paid', 'cancelled', 'archived'
 * 
 * ===================================================================
 * 
 * 📊 SCÉNARIOS D'UTILISATION :
 * 
 * Scénario 1 - Dette personnelle :
 * • User doit 5000 HTG à un ami
 * • Échéance : hier
 * • Action : Alerte WARNING "1 jour de retard"
 * 
 * Scénario 2 - Prêt professionnel :
 * • User a prêté 20000 HTG à un collègue
 * • Échéance : dans 2 jours
 * • Action : Rappel INFO "Paiement dans 2 jours"
 * 
 * Scénario 3 - Dette critique :
 * • User doit loyer depuis 10 jours
 * • Action : Alerte URGENT CRITICAL quotidienne
 * 
 * ===================================================================
 * 
 * 🛡️ ANTI-SPAM & PRÉFÉRENCES :
 * 
 * Respect préférences user :
 * • debtReminders: false → Aucun rappel
 * • debtPreviewReminders: false → Pas de préventif
 * • debtOverdueAlerts: false → Pas d'alertes retard
 * 
 * Fréquence intelligente :
 * • 1-14 jours retard : quotidien
 * • 30+ jours retard : hebdomadaire (lundis)
 * 
 * ===================================================================
 * 
 * 📈 MONITORING & MÉTRIQUES :
 * 
 * Logs détaillés :
 * • Dettes analysées (préventif + retard)
 * • Rappels créés par catégorie
 * • Cas critiques identifiés
 * • Utilisateurs notifiés
 * • Erreurs et exceptions
 * 
 * Statistiques utiles :
 * • Taux de retard par utilisateur
 * • Efficacité rappels préventifs
 * • Évolution cas critiques
 * • Temps moyen résolution retards
 * 
 * ===================================================================
 * 
 * 🚀 TESTS & DEBUG :
 * 
 * Test complet :
 * const { runJobManually } = require('./cron');
 * await runJobManually('debtReminders');
 * 
 * Test phase spécifique :
 * const { utils } = require('./cron/debtReminders');
 * const previewStats = await utils.processPreviewReminders();
 * const overdueStats = await utils.processOverdueAlerts();
 * 
 * Stats rapides :
 * const stats = await utils.getQuickStats();
 * 
 * ===================================================================
 * 
 * ⚙️ PERSONNALISATION HAITI :
 * 
 * Messages contextuels :
 * • Références culturelles appropriées
 * • Format dates fr-HT
 * • Montants HTG/USD selon dette
 * • Ton respectueux mais ferme pour retards
 * 
 * Escalade adaptée :
 * • Moins aggressive que systèmes US/EU
 * • Focus sur rappels amicaux d'abord
 * • Escalade progressive et respectueuse
 * 
 * ===================================================================
 */