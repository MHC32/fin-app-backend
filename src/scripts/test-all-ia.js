// test-all-ia.js
// Script combiné pour tester TOUS les services IA

require('dotenv').config();
const mongoose = require('mongoose');
const HabitAnalysisService = require('../services/habitAnalysisService');
const MLService = require('../services/mlService');
const MLHelpers = require('../utils/mlHelpers');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  reset: '\x1b[0m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title) {
  console.log('\n');
  log('cyan', '═'.repeat(60));
  log('cyan', `  ${title}`);
  log('cyan', '═'.repeat(60));
  console.log('');
}

async function testAllIA() {
  const startTime = Date.now();
  let testsPass = 0;
  let testsFail = 0;

  try {
    log('magenta', '\n\n');
    log('magenta', '╔══════════════════════════════════════════════════════════╗');
    log('magenta', '║         🤖 FINAPP HAITI - TESTS COMPLETS IA 🇭🇹         ║');
    log('magenta', '╚══════════════════════════════════════════════════════════╝');
    
    // Connexion
    section('📡 CONNEXION MONGODB');
    await mongoose.connect('mongodb://localhost:27017/finapp_haiti_dev');
    log('green', '✅ MongoDB connecté');
    testsPass++;

    // Récupérer données
    section('📊 PRÉPARATION DONNÉES TEST');
    const user = await User.findOne();
    const transactionCount = await Transaction.countDocuments({ user: user._id });
    
    if (!user) {
      log('red', '❌ Aucun utilisateur trouvé');
      testsFail++;
      process.exit(1);
    }
    
    log('green', `✅ Utilisateur: ${user.email}`);
    log('green', `✅ ${transactionCount} transactions disponibles`);
    testsPass++;

    // ==================== TESTS ML HELPERS ====================
    section('🔧 TESTS ML HELPERS');
    
    try {
      // Test normalisation
      const normalized = MLHelpers.normalizeAmount(100, 'USD');
      log('green', `✅ Normalisation: 100 USD = ${normalized} HTG`);
      testsPass++;

      // Test statistiques
      const numbers = [100, 200, 300, 400, 5000];
      const mean = MLHelpers.mean(numbers);
      const stdDev = MLHelpers.standardDeviation(numbers);
      log('green', `✅ Stats: Mean=${mean}, StdDev=${stdDev.toFixed(2)}`);
      testsPass++;

      // Test outliers
      const outliers = MLHelpers.findOutliers(numbers, 2);
      log('green', `✅ Outliers: ${outliers.outliers.length} détectés (${outliers.outliers.join(', ')})`);
      testsPass++;

      // Test contexte Haiti
      const context = MLHelpers.formatAmountWithContext(50, 'HTG');
      log('green', `✅ Contexte Haiti: 50 HTG = ${context.category} (${context.context.join(', ')})`);
      testsPass++;

    } catch (error) {
      log('red', `❌ Erreur ML Helpers: ${error.message}`);
      testsFail++;
    }

    // ==================== TESTS HABIT ANALYSIS ====================
    section('🧠 TESTS HABIT ANALYSIS SERVICE');
    
    try {
      // Patterns dépenses
      const patterns = await HabitAnalysisService.analyzeSpendingPatterns(user._id, 90);
      if (patterns.hasData) {
        log('green', `✅ Patterns: ${patterns.overview.totalTransactions} transactions analysées`);
        log('green', `   Total: ${patterns.overview.totalSpent} HTG`);
        testsPass++;
      } else {
        log('yellow', '⚠️  Pas assez de données pour patterns');
      }

      // Anomalies
      const anomalies = await HabitAnalysisService.detectAnomalies(user._id);
      if (anomalies.hasData) {
        log('green', `✅ Anomalies: ${anomalies.anomalies.length} détectées`);
        testsPass++;
      }

      // Santé financière
      const health = await HabitAnalysisService.calculateFinancialHealth(user._id);
      log('green', `✅ Santé: Score ${health.score}/100 (${health.level})`);
      testsPass++;

      // Habitudes
      const habits = await HabitAnalysisService.identifyHabits(user._id);
      if (habits.hasData) {
        log('green', `✅ Habitudes: ${habits.habits.length} identifiées`);
        testsPass++;
      }

      // Patterns temporels
      const timing = await HabitAnalysisService.analyzeTimingPatterns(user._id);
      if (timing.hasData) {
        log('green', `✅ Timing: Patterns temporels analysés`);
        testsPass++;
      }

    } catch (error) {
      log('red', `❌ Erreur Habit Analysis: ${error.message}`);
      testsFail++;
    }

    // ==================== TESTS ML SERVICE ====================
    section('🤖 TESTS ML SERVICE');
    
    try {
      // Classification
      const classif = await MLService.classifyTransaction("Tap-tap 50", 50);
      log('green', `✅ Classification: "Tap-tap 50" → ${classif.category} (${(classif.confidence * 100).toFixed(0)}%)`);
      testsPass++;

      // Prédiction
      const prediction = await MLService.predictNextMonthExpenses(user._id);
      if (prediction.prediction) {
        log('green', `✅ Prédiction: ${prediction.prediction} HTG mois prochain (${(prediction.confidence * 100).toFixed(0)}%)`);
        testsPass++;
      } else {
        log('yellow', '⚠️  Pas assez de données pour prédiction');
      }

      // Anomalie
      const anomaly = await MLService.detectAnomaly(user._id, 8000);
      const anomStatus = anomaly.isAnomaly ? 'ANOMALIE' : 'Normal';
      log('green', `✅ Détection: 8000 HTG → ${anomStatus}`);
      testsPass++;

      // Clustering
      const similar = await MLService.findSimilarUsers(user._id, 3);
      if (similar.similarUsers && similar.similarUsers.length > 0) {
        log('green', `✅ Clustering: ${similar.similarUsers.length} users similaires`);
        testsPass++;
      } else {
        log('yellow', '⚠️  Pas assez d\'users pour clustering');
      }

      // Prédiction catégorie
      const catPred = await MLService.predictCategoryExpense(user._id, 'transport');
      if (catPred.prediction) {
        log('green', `✅ Catégorie: Transport prévu à ${catPred.prediction} HTG`);
        testsPass++;
      }

      // Patterns temporels ML
      const temporal = await MLService.analyzeTemporalPatterns(user._id);
      if (temporal.patterns) {
        log('green', `✅ Patterns ML: Analyse temporelle complète`);
        testsPass++;
      }

    } catch (error) {
      log('red', `❌ Erreur ML Service: ${error.message}`);
      testsFail++;
    }

    // ==================== TESTS INTÉGRATION ====================
    section('🔗 TESTS INTÉGRATION');
    
    try {
      // Workflow complet
      log('yellow', 'Test workflow complet classification → anomalie → conseil...');
      
      const testTx = {
        description: "Achat courses marché",
        amount: 250
      };
      
      // 1. Classifier
      const category = await MLService.classifyTransaction(testTx.description, testTx.amount);
      
      // 2. Vérifier anomalie
      const isAnomaly = await MLService.detectAnomaly(user._id, testTx.amount, category.category);
      
      // 3. Récupérer patterns
      const userPatterns = await HabitAnalysisService.analyzeSpendingPatterns(user._id);
      
      log('green', `✅ Workflow: ${testTx.description} → ${category.category}`);
      log('green', `   Anomalie: ${isAnomaly.isAnomaly ? 'OUI' : 'NON'}`);
      log('green', `   Données patterns: ${userPatterns.hasData ? 'DISPONIBLES' : 'INSUFFISANTES'}`);
      testsPass++;

    } catch (error) {
      log('red', `❌ Erreur Intégration: ${error.message}`);
      testsFail++;
    }

    // ==================== RÉSUMÉ FINAL ====================
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    section('📊 RÉSUMÉ TESTS');
    
    log('green', `✅ Tests réussis: ${testsPass}`);
    if (testsFail > 0) {
      log('red', `❌ Tests échoués: ${testsFail}`);
    }
    log('cyan', `⏱️  Durée totale: ${duration}s`);
    
    const successRate = ((testsPass / (testsPass + testsFail)) * 100).toFixed(1);
    log('cyan', `📈 Taux de réussite: ${successRate}%`);

    // Verdict
    console.log('\n');
    if (testsFail === 0) {
      log('green', '╔══════════════════════════════════════════════════════════╗');
      log('green', '║              🎉 TOUS LES TESTS PASSENT ! 🎉              ║');
      log('green', '║         Services IA prêts pour production ! ✅           ║');
      log('green', '╚══════════════════════════════════════════════════════════╝');
    } else {
      log('yellow', '╔══════════════════════════════════════════════════════════╗');
      log('yellow', '║          ⚠️  QUELQUES TESTS ONT ÉCHOUÉ ⚠️                ║');
      log('yellow', '║         Vérifier les erreurs ci-dessus                   ║');
      log('yellow', '╚══════════════════════════════════════════════════════════╝');
    }
    console.log('\n');

  } catch (error) {
    log('red', `\n\n❌ ERREUR CRITIQUE: ${error.message}`);
    console.error(error);
    testsFail++;
  } finally {
    await mongoose.connection.close();
    log('yellow', '\n👋 Tests terminés - Déconnexion MongoDB\n');
    process.exit(testsFail > 0 ? 1 : 0);
  }
}

// Exécuter tous les tests
testAllIA();