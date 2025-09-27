// test-habit-analysis.js
// Script de test pour habitAnalysisService

require('dotenv').config();
const mongoose = require('mongoose');
const HabitAnalysisService = require('../services/habitAnalysisService')
const Transaction = require('../models/Transaction');;
const User = require('../models/User');

// Couleurs pour console
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testHabitAnalysis() {
  try {
    log('blue', '\n========================================');
    log('blue', '🧪 TEST HABIT ANALYSIS SERVICE');
    log('blue', '========================================\n');

    // Connexion MongoDB
    log('yellow', '📡 Connexion à MongoDB...');
    await mongoose.connect('mongodb://localhost:27017/finapp_haiti_dev');
    log('green', '✅ Connecté à MongoDB\n');

    // 1. Trouver un utilisateur avec des transactions
    log('yellow', '🔍 Recherche utilisateur avec transactions...');
    const user = await User.findOne();
    
    if (!user) {
      log('red', '❌ Aucun utilisateur trouvé. Créez des données d\'abord.');
      process.exit(1);
    }

    const transactionCount = await Transaction.countDocuments({ user: user._id });
    log('green', `✅ Utilisateur trouvé: ${user.email}`);
    log('green', `✅ ${transactionCount} transactions disponibles\n`);

    if (transactionCount === 0) {
      log('red', '❌ Aucune transaction. Créez des transactions d\'abord.');
      process.exit(1);
    }

    // 2. Test analyzeSpendingPatterns
    log('blue', '\n📊 TEST 1: Analyse Patterns Dépenses');
    log('yellow', '⏳ Exécution analyzeSpendingPatterns...');
    
    const patterns = await HabitAnalysisService.analyzeSpendingPatterns(user._id, 90);
    
    log('green', '✅ Patterns récupérés:');
    console.log(JSON.stringify(patterns, null, 2));
    
    if (patterns.hasData) {
      log('green', `\n📈 Total dépensé: ${patterns.overview.totalSpent} HTG`);
      log('green', `📅 Moyenne journalière: ${patterns.overview.avgDaily} HTG`);
      log('green', `📅 Moyenne mensuelle: ${patterns.overview.avgMonthly} HTG`);
      
      if (patterns.categoryBreakdown.length > 0) {
        log('green', '\n🏷️ Top 3 catégories:');
        patterns.categoryBreakdown.slice(0, 3).forEach((cat, i) => {
          log('green', `  ${i + 1}. ${cat.category}: ${cat.total} HTG (${cat.percentage})`);
        });
      }
    }

    // 3. Test detectAnomalies
    log('blue', '\n\n🚨 TEST 2: Détection Anomalies');
    log('yellow', '⏳ Exécution detectAnomalies...');
    
    const anomalies = await HabitAnalysisService.detectAnomalies(user._id);
    
    log('green', '✅ Anomalies détectées:');
    
    if (anomalies.hasData) {
      log('green', `\n📊 Statistiques:`);
      log('green', `  Moyenne: ${anomalies.statistics.mean} HTG`);
      log('green', `  Écart-type: ${anomalies.statistics.stdDev} HTG`);
      log('green', `  Seuil: ${anomalies.statistics.threshold} HTG`);
      
      if (anomalies.anomalies.length > 0) {
        log('red', `\n⚠️  ${anomalies.anomalies.length} anomalies trouvées:`);
        anomalies.anomalies.forEach((anom, i) => {
          log('red', `  ${i + 1}. ${anom.transaction.amount} HTG - ${anom.severity.toUpperCase()}`);
          log('red', `     ${anom.message}`);
        });
      } else {
        log('green', '\n✅ Aucune anomalie détectée (dépenses normales)');
      }
    }

    // 4. Test calculateFinancialHealth
    log('blue', '\n\n💪 TEST 3: Score Santé Financière');
    log('yellow', '⏳ Exécution calculateFinancialHealth...');
    
    const health = await HabitAnalysisService.calculateFinancialHealth(user._id);
    
    log('green', '✅ Score santé calculé:');
    log('green', `\n🎯 SCORE: ${health.score}/100 - ${health.level}`);
    
    if (health.factors && health.factors.length > 0) {
      log('green', '\n📊 Facteurs contributeurs:');
      health.factors.forEach(factor => {
        const icon = factor.status === 'positive' ? '✅' : '⚠️';
        log(factor.status === 'positive' ? 'green' : 'yellow', 
          `  ${icon} ${factor.name}: +${factor.points} points`);
      });
    }
    
    if (health.recommendations && health.recommendations.length > 0) {
      log('yellow', '\n💡 Recommandations:');
      health.recommendations.forEach((rec, i) => {
        log('yellow', `  ${i + 1}. ${rec}`);
      });
    }

    // 5. Test identifyHabits
    log('blue', '\n\n🔄 TEST 4: Identification Habitudes');
    log('yellow', '⏳ Exécution identifyHabits...');
    
    const habits = await HabitAnalysisService.identifyHabits(user._id);
    
    log('green', '✅ Habitudes identifiées:');
    
    if (habits.hasData && habits.habits.length > 0) {
      log('green', `\n📋 ${habits.habits.length} habitudes détectées:\n`);
      habits.habits.forEach((habit, i) => {
        log('green', `  ${i + 1}. ${habit.type.toUpperCase()}: ${habit.description}`);
        log('green', `     Confiance: ${(habit.confidence * 100).toFixed(0)}%`);
        log('green', `     Fréquence: ${habit.frequency}`);
        if (habit.avgAmount) {
          log('green', `     Montant moyen: ${habit.avgAmount} HTG`);
        }
        console.log('');
      });
    }

    // 6. Test analyzeTimingPatterns
    log('blue', '\n📅 TEST 5: Patterns Temporels');
    log('yellow', '⏳ Exécution analyzeTimingPatterns...');
    
    const timing = await HabitAnalysisService.analyzeTimingPatterns(user._id);
    
    if (timing.hasData) {
      log('green', '✅ Patterns temporels:');
      
      if (timing.patterns.byHour && timing.patterns.byHour.length > 0) {
        const peakHour = timing.patterns.byHour[0];
        log('green', `\n⏰ Heure peak: ${peakHour.hour}h (${peakHour.count} transactions)`);
      }
      
      if (timing.patterns.byDayOfWeek && timing.patterns.byDayOfWeek.length > 0) {
        log('green', '\n📅 Top 3 jours:');
        timing.patterns.byDayOfWeek.slice(0, 3).forEach((day, i) => {
          log('green', `  ${i + 1}. ${day.dayName}: ${day.avgAmount} HTG (${day.count} transactions)`);
        });
      }
      
      if (timing.insights && timing.insights.length > 0) {
        log('yellow', '\n💡 Insights temporels:');
        timing.insights.forEach(insight => {
          log('yellow', `  - ${insight}`);
        });
      }
    }

    // 7. Test analyzeLocationPatterns
    log('blue', '\n\n📍 TEST 6: Patterns Localisation');
    log('yellow', '⏳ Exécution analyzeLocationPatterns...');
    
    const location = await HabitAnalysisService.analyzeLocationPatterns(user._id);
    
    if (location.hasData && location.patterns.length > 0) {
      log('green', `✅ ${location.patterns.length} locations identifiées:\n`);
      location.patterns.slice(0, 5).forEach((loc, i) => {
        log('green', `  ${i + 1}. ${loc.location}`);
        log('green', `     Fréquence: ${loc.frequency} visites`);
        log('green', `     Total dépensé: ${loc.totalAmount} HTG`);
        console.log('');
      });
    } else {
      log('yellow', '⚠️  Pas de données de localisation disponibles');
    }

    // Résumé final
    log('blue', '\n========================================');
    log('green', '✅ TOUS LES TESTS RÉUSSIS !');
    log('blue', '========================================\n');

  } catch (error) {
    log('red', `\n❌ ERREUR: ${error.message}`);
    console.error(error);
  } finally {
    await mongoose.connection.close();
    log('yellow', '\n👋 Déconnexion MongoDB\n');
  }
}

// Exécuter tests
testHabitAnalysis();