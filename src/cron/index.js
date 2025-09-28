// src/cron/index.js
// Orchestrateur des tâches automatiques programmées (Cron Jobs)
// FinApp Haiti - Système de rappels et maintenance automatique

const cron = require('node-cron');
const colors = require('colors');

// Import des tâches cron
const solReminders = require('./solReminders');
const debtReminders = require('./debtReminders');
const cleanupNotifications = require('./cleanupNotifications');

// ===================================================================
// CONFIGURATION CRON JOBS
// ===================================================================

/**
 * Configuration des tâches automatiques
 * Chaque tâche a une expression cron qui définit quand elle s'exécute
 */
const CRON_JOBS = {
  // Rappels paiements sols - Tous les jours à 9h du matin
  solReminders: {
    schedule: '0 9 * * *',  // minute heure jour mois jour-semaine
    task: solReminders,
    name: 'Rappels Paiements Sols',
    description: 'Envoie des notifications de rappel pour paiements sols à venir',
    enabled: true
  },

  // Rappels dettes - Tous les jours à 10h du matin
  debtReminders: {
    schedule: '0 10 * * *',
    task: debtReminders,
    name: 'Rappels Dettes en Retard',
    description: 'Alerte les utilisateurs sur dettes en retard ou à venir',
    enabled: true
  },

  // Nettoyage notifications - Tous les dimanches à 2h du matin
  cleanupNotifications: {
    schedule: '0 2 * * 0',  // 0 = Dimanche
    task: cleanupNotifications,
    name: 'Nettoyage Notifications',
    description: 'Supprime les anciennes notifications lues',
    enabled: true
  }
};

// ===================================================================
// INITIALISATION CRON JOBS
// ===================================================================

/**
 * Initialise et démarre tous les cron jobs configurés
 * Appelé au démarrage du serveur
 */
function initializeCronJobs() {
  console.log('\n' + '='.repeat(60).cyan);
  console.log('🕐 INITIALISATION CRON JOBS'.bold.cyan);
  console.log('='.repeat(60).cyan);

  // Vérifier si les cron jobs sont activés
  if (process.env.CRON_ENABLED === 'false') {
    console.log('⚠️  Cron jobs désactivés via CRON_ENABLED=false'.yellow);
    console.log('='.repeat(60).cyan + '\n');
    return;
  }

  // Démarrer chaque cron job
  Object.entries(CRON_JOBS).forEach(([key, config]) => {
    if (config.enabled) {
      try {
        // Créer et démarrer le cron job
        const job = cron.schedule(config.schedule, async () => {
          console.log(`\n⏰ [${new Date().toLocaleString('fr-HT')}] Exécution: ${config.name}`.cyan);
          
          try {
            // Exécuter la tâche
            await config.task();
            console.log(`✅ [${config.name}] Terminé avec succès`.green);
          } catch (error) {
            console.error(`❌ [${config.name}] Erreur:`.red, error.message);
          }
        });

        console.log(`✅ ${config.name}`.green);
        console.log(`   📅 Planning: ${config.schedule}`.gray);
        console.log(`   📝 ${config.description}`.gray);
        
      } catch (error) {
        console.error(`❌ Erreur initialisation ${config.name}:`.red, error.message);
      }
    } else {
      console.log(`⏸️  ${config.name} (désactivé)`.yellow);
    }
  });

  console.log('\n' + '='.repeat(60).cyan);
  console.log(`✅ ${Object.values(CRON_JOBS).filter(j => j.enabled).length} cron jobs actifs`.green.bold);
  console.log('='.repeat(60).cyan + '\n');
}

// ===================================================================
// EXÉCUTION MANUELLE (pour tests)
// ===================================================================

/**
 * Exécute manuellement un cron job spécifique
 * Utile pour tester sans attendre l'heure programmée
 * 
 * @param {string} jobName - Nom du job à exécuter
 * @returns {Promise<void>}
 */
async function runJobManually(jobName) {
  const job = CRON_JOBS[jobName];
  
  if (!job) {
    console.error(`❌ Job "${jobName}" non trouvé`.red);
    console.log('Jobs disponibles:', Object.keys(CRON_JOBS).join(', '));
    return;
  }

  console.log(`\n🔧 Exécution manuelle: ${job.name}`.cyan.bold);
  console.log('='.repeat(60).cyan);

  try {
    await job.task();
    console.log(`✅ ${job.name} terminé`.green.bold);
  } catch (error) {
    console.error(`❌ Erreur ${job.name}:`.red, error.message);
    throw error;
  }
}

// ===================================================================
// STATISTIQUES CRON JOBS
// ===================================================================

/**
 * Affiche les statistiques des cron jobs
 * Utile pour monitoring et debugging
 * 
 * @returns {Object} Stats des cron jobs
 */
function getCronStats() {
  const stats = {
    total: Object.keys(CRON_JOBS).length,
    enabled: Object.values(CRON_JOBS).filter(j => j.enabled).length,
    disabled: Object.values(CRON_JOBS).filter(j => !j.enabled).length,
    jobs: {}
  };

  Object.entries(CRON_JOBS).forEach(([key, config]) => {
    stats.jobs[key] = {
      name: config.name,
      schedule: config.schedule,
      enabled: config.enabled,
      nextRun: getNextRunTime(config.schedule)
    };
  });

  return stats;
}

/**
 * Calcule la prochaine exécution d'un cron job
 * Basé sur l'expression cron
 * 
 * @param {string} cronExpression - Expression cron (ex: '0 9 * * *')
 * @returns {string} Date/heure prochaine exécution
 */
function getNextRunTime(cronExpression) {
  try {
    // Parser l'expression cron (simplifié)
    const [minute, hour, , , dayOfWeek] = cronExpression.split(' ');
    const now = new Date();
    const next = new Date();

    // Cas spéciaux
    if (cronExpression === '0 9 * * *') {
      next.setHours(9, 0, 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);
      return next.toLocaleString('fr-HT');
    }
    
    if (cronExpression === '0 10 * * *') {
      next.setHours(10, 0, 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);
      return next.toLocaleString('fr-HT');
    }
    
    if (cronExpression === '0 2 * * 0') {
      // Dimanche à 2h
      next.setHours(2, 0, 0, 0);
      const daysUntilSunday = (7 - now.getDay()) % 7;
      next.setDate(next.getDate() + (daysUntilSunday || 7));
      return next.toLocaleString('fr-HT');
    }

    return 'Calcul en cours...';
  } catch (error) {
    return 'N/A';
  }
}

// ===================================================================
// GESTION GRACEFUL SHUTDOWN
// ===================================================================

/**
 * Arrête proprement tous les cron jobs
 * Appelé lors de l'arrêt du serveur
 */
function stopAllCronJobs() {
  console.log('\n🛑 Arrêt des cron jobs...'.yellow);
  
  // Note: node-cron ne nécessite pas d'arrêt explicite
  // Les jobs s'arrêtent automatiquement quand le process se termine
  
  console.log('✅ Cron jobs arrêtés proprement'.green);
}

// Gérer les signaux d'arrêt
process.on('SIGINT', () => {
  stopAllCronJobs();
  process.exit(0);
});

process.on('SIGTERM', () => {
  stopAllCronJobs();
  process.exit(0);
});

// ===================================================================
// EXPORT
// ===================================================================

module.exports = {
  initializeCronJobs,
  runJobManually,
  getCronStats,
  stopAllCronJobs,
  CRON_JOBS
};

// /* ===================================================================
//  * 📚 DOCUMENTATION TECHNIQUE - CRON INDEX
//  * ===================================================================
//  * 
//  * RÔLE DU FICHIER :
//  * - Orchestrateur principal de tous les cron jobs
//  * - Initialise et démarre les tâches automatiques
//  * - Gère le cycle de vie des jobs (start/stop)
//  * - Fournit des outils de monitoring et debug
//  * 
//  * ===================================================================
//  * 
//  * 🕐 EXPRESSION CRON - FORMAT :
//  * 
//  *  ┌─────────────── minute (0 - 59)
//  *  │ ┌───────────── heure (0 - 23)
//  *  │ │ ┌─────────── jour du mois (1 - 31)
//  *  │ │ │ ┌───────── mois (1 - 12)
//  *  │ │ │ │ ┌─────── jour de la semaine (0 - 6) (0 = Dimanche)
//  *  │ │ │ │ │
//  *  * * * * *
//  * 
//  * EXEMPLES :
//  * '0 9 * * *'   → Tous les jours à 9h00
//  * '0 10 * * *'  → Tous les jours à 10h00
//  * '0 2 * * 0'   → Tous les dimanches à 2h00
//  * '30 8 * * 1'  → Tous les lundis à 8h30
//  * '0 */6 * * *' → Toutes les 6 heures
//  * '*/15 * * * *'→ Toutes les 15 minutes
//  * 
//  * ===================================================================
//  * 
//  * 🚀 UTILISATION :
//  * 
//  * 1. Démarrage automatique au lancement serveur :
//  *    const { initializeCronJobs } = require('./cron');
//  *    initializeCronJobs();
//  * 
//  * 2. Exécution manuelle pour tests :
//  *    const { runJobManually } = require('./cron');
//  *    await runJobManually('solReminders');
//  * 
//  * 3. Voir statistiques :
//  *    const { getCronStats } = require('./cron');
//  *    console.log(getCronStats());
//  * 
//  * ===================================================================
//  * 
//  * ⚙️ CONFIGURATION ENVIRONNEMENT :
//  * 
//  * Dans .env :
//  * CRON_ENABLED=true   # Active/désactive tous les cron jobs
//  * NODE_ENV=production # Environnement
//  * 
//  * En développement : CRON_ENABLED=false (évite spam notifs test)
//  * En production : CRON_ENABLED=true (activer automatisation)
//  * 
//  * ===================================================================
//  * 
//  * 📊 JOBS CONFIGURÉS :
//  * 
//  * 1. solReminders (9h/jour)
//  *    - Trouve sols avec paiement dans 1-3 jours
//  *    - Crée notifications rappel pour participants
//  *    - Envoie selon préférences utilisateur
//  * 
//  * 2. debtReminders (10h/jour)
//  *    - Détecte dettes en retard
//  *    - Calcule jours de retard
//  *    - Crée notifications urgentes
//  * 
//  * 3. cleanupNotifications (2h/dimanche)
//  *    - Supprime notifications lues > 30 jours
//  *    - Optimise base de données
//  *    - Libère espace stockage
//  * 
//  * ===================================================================
//  * 
//  * 🔧 MONITORING & DEBUG :
//  * 
//  * Logs automatiques :
//  * - Démarrage : "✅ [Job] démarré"
//  * - Exécution : "⏰ [Date] Exécution: [Job]"
//  * - Succès : "✅ [Job] Terminé avec succès"
//  * - Erreur : "❌ [Job] Erreur: [message]"
//  * 
//  * Commandes utiles :
//  * - Voir stats : getCronStats()
//  * - Test manuel : runJobManually('solReminders')
//  * - Arrêt propre : stopAllCronJobs()
//  * 
//  * ===================================================================
//  * 
//  * 🚨 GESTION ERREURS :
//  * 
//  * - Chaque job a son try/catch individuel
//  * - Erreur dans un job n'affecte pas les autres
//  * - Logs détaillés pour debugging
//  * - Graceful shutdown sur SIGINT/SIGTERM
//  * 
//  * ===================================================================
//  * 
//  * 📈 ÉVOLUTIONS FUTURES :
//  * 
//  * v2.0 :
//  * - Analyse IA hebdomadaire (lundis 8h)
//  * - Rapports mensuels automatiques (1er du mois)
//  * - Backup DB automatique (quotidien)
//  * - Envoi emails résumés (configurable)
//  * 
//  * ===================================================================
//  */