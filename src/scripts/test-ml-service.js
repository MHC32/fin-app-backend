// test-ml-service.js
// Script de test pour mlService

require('dotenv').config();
const mongoose = require('mongoose');
const MLService = require('../services/mlService');
const Transaction = require('../models/Transaction');
const User = require('../models/User');

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

async function testMLService() {
  try {
    log('blue', '\n========================================');
    log('blue', '🤖 TEST ML SERVICE');
    log('blue', '========================================\n');

    // Connexion MongoDB
    log('yellow', '📡 Connexion à MongoDB...');
    await mongoose.connect('mongodb://localhost:27017/finapp_haiti_dev');
    log('green', '✅ Connecté à MongoDB\n');

    // Trouver utilisateur
    const user = await User.findOne();
    if (!user) {
      log('red', '❌ Aucun utilisateur trouvé');
      process.exit(1);
    }
    log('green', `✅ Utilisateur: ${user.email}\n`);

    // TEST 1: Classification Transaction
    log('blue', '📝 TEST 1: Classification Automatique');
    log('yellow', '⏳ Test classification transactions...\n');

    const testDescriptions = [
      { desc: "Tap-tap delmas 50", amount: 50 },
      { desc: "Lunch restaurant", amount: 150 },
      { desc: "Sol paiement", amount: 500 },
      { desc: "Marché courses", amount: 200 },
      { desc: "Internet digicel", amount: 300 }
    ];

    for (const test of testDescriptions) {
      const result = await MLService.classifyTransaction(test.desc, test.amount);
      
      const icon = result.confidence > 0.8 ? '✅' : result.confidence > 0.6 ? '⚠️' : '❌';
      log('green', `${icon} "${test.desc}" → ${result.category}`);
      log('green', `   Confiance: ${(result.confidence * 100).toFixed(0)}%`);
      
      if (result.alternatives && result.alternatives.length > 0) {
        log('yellow', `   Alternatives: ${result.alternatives.join(', ')}`);
      }
      console.log('');
    }

    // TEST 2: Prédiction Mois Prochain
    log('blue', '\n📈 TEST 2: Prédiction Dépenses Mois Prochain');
    log('yellow', '⏳ Calcul prédiction...\n');

    const prediction = await MLService.predictNextMonthExpenses(user._id);
    
    if (prediction.prediction) {
      log('green', '✅ Prédiction générée:');
      log('green', `\n💰 Prédiction: ${prediction.prediction} HTG`);
      log('green', `📊 Confiance: ${(prediction.confidence * 100).toFixed(0)}%`);
      
      if (prediction.breakdown) {
        log('green', '\n📊 Détails:');
        log('green', `  Base: ${prediction.breakdown.basePrediction} HTG`);
        log('green', `  Ajustement tendance: ${prediction.breakdown.trendAdjustment}`);
        if (prediction.breakdown.seasonalFactor) {
          log('green', `  Facteur saisonnier: ${prediction.breakdown.seasonalFactor}`);
        }
      }
      
      if (prediction.historicalData) {
        log('yellow', '\n📅 Historique:');
        log('yellow', `  Mois analysés: ${prediction.historicalData.months}`);
        log('yellow', `  Moyenne mensuelle: ${prediction.historicalData.avgMonthly} HTG`);
        log('yellow', `  Tendance: ${prediction.historicalData.trend}`);
      }
    } else {
      log('yellow', '⚠️  Pas assez de données pour prédiction');
    }

    // TEST 3: Détection Anomalies
    log('blue', '\n\n🚨 TEST 3: Détection Anomalies ML');
    log('yellow', '⏳ Test anomalies sur différents montants...\n');

    const testAmounts = [100, 500, 2000, 8000];
    
    for (const amount of testAmounts) {
      const anomaly = await MLService.detectAnomaly(user._id, amount, 'transport');
      
      const icon = anomaly.isAnomaly ? '🚨' : '✅';
      const color = anomaly.isAnomaly ? 'red' : 'green';
      
      log(color, `${icon} ${amount} HTG - ${anomaly.isAnomaly ? 'ANOMALIE' : 'Normal'}`);
      
      if (anomaly.isAnomaly) {
        log('red', `   Sévérité: ${anomaly.severity.toUpperCase()}`);
        log('red', `   ${anomaly.recommendation}`);
        if (anomaly.details) {
          log('red', `   Facteur déviation: ${anomaly.details.deviationFactor}`);
        }
      }
      console.log('');
    }

    // TEST 4: Clustering Users Similaires
    log('blue', '\n👥 TEST 4: Clustering Users Similaires');
    log('yellow', '⏳ Recherche utilisateurs similaires...\n');

    const similar = await MLService.findSimilarUsers(user._id, 5);
    
    if (similar.similarUsers && similar.similarUsers.length > 0) {
      log('green', `✅ ${similar.similarUsers.length} utilisateurs similaires trouvés:`);
      log('green', `\n📊 Cluster ${similar.cluster} (${similar.clusterSize} membres)\n`);
      
      similar.similarUsers.forEach((simUser, i) => {
        log('green', `  ${i + 1}. User ${simUser.userId.substring(0, 8)}...`);
        log('green', `     Similarité: ${(simUser.similarity * 100).toFixed(0)}%`);
        if (simUser.patterns) {
          log('green', `     Dépenses moyennes: ${simUser.patterns.avgMonthly} HTG/mois`);
          log('green', `     Catégorie top: ${simUser.patterns.topCategory}`);
        }
        console.log('');
      });
      
      if (similar.recommendations && similar.recommendations.length > 0) {
        log('yellow', '💡 Recommandations basées sur peers:');
        similar.recommendations.forEach(rec => {
          log('yellow', `  - ${rec.message}`);
        });
      }
    } else {
      log('yellow', '⚠️  Pas assez d\'utilisateurs pour clustering');
    }

    // TEST 5: Prédiction par Catégorie
    log('blue', '\n\n📊 TEST 5: Prédiction par Catégorie');
    log('yellow', '⏳ Prédiction catégorie transport...\n');

    const catPrediction = await MLService.predictCategoryExpense(user._id, 'transport');
    
    if (catPrediction.prediction) {
      log('green', '✅ Prédiction transport:');
      log('green', `\n💰 Prévu: ${catPrediction.prediction} HTG`);
      log('green', `📊 Confiance: ${(catPrediction.confidence * 100).toFixed(0)}%`);
      log('green', `📈 Tendance: ${catPrediction.trend}`);
      log('green', `📅 Moyenne historique: ${catPrediction.historicalAvg} HTG`);
    }

    // TEST 6: Patterns Temporels ML
    log('blue', '\n\n⏰ TEST 6: Analyse Patterns Temporels ML');
    log('yellow', '⏳ Analyse patterns temporels...\n');

    const temporal = await MLService.analyzeTemporalPatterns(user._id);
    
    if (temporal.patterns) {
      if (temporal.patterns.dayOfWeek && temporal.patterns.dayOfWeek.length > 0) {
        log('green', '✅ Patterns jour de semaine:');
        temporal.patterns.dayOfWeek.slice(0, 3).forEach((day, i) => {
          log('green', `  ${i + 1}. ${day.day}: ${day.avgAmount} HTG (${day.frequency} fois)`);
        });
      }
      
      if (temporal.patterns.peakHour) {
        log('green', `\n⏰ Heure peak: ${temporal.patterns.peakHour.hour}h (${temporal.patterns.peakHour.count} transactions)`);
      }
      
      if (temporal.patterns.consistency) {
        log('yellow', '\n📊 Consistance:');
        log('yellow', `  Jours actifs: ${temporal.patterns.consistency.daysWithActivity}/${temporal.patterns.consistency.totalDays}`);
        log('yellow', `  Taux consistance: ${temporal.patterns.consistency.consistencyRate}`);
      }
    }

    // Résumé
    log('blue', '\n========================================');
    log('green', '✅ TESTS ML SERVICE TERMINÉS !');
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
testMLService();