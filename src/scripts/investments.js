// test-investments.js
// Script de tests automatisés pour module Investments - FinApp Haiti
// Usage: node test-investments.js

const axios = require('axios');
const colors = require('colors'); // npm install colors (optionnel)

// ===================================================================
// CONFIGURATION
// ===================================================================

const BASE_URL = 'http://localhost:3001';
const TEST_USER = {
  email: 'hantzmichaelchery6@gmail.com',
  password: 'Pass@1234',
  firstName: 'Jean-Claude',
  lastName: 'Chery',
  phone: '+50933340014',
  region: 'ouest'
};

let authToken = null;
let testInvestmentId = null;
let testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: []
};

// ===================================================================
// UTILITAIRES
// ===================================================================

function logSuccess(message) {
  console.log('✅'.green, message.green);
  testResults.passed++;
  testResults.total++;
}

function logError(message, error = null) {
  console.log('❌'.red, message.red);
  if (error) {
    console.log('   Error:', error.message || error);
    testResults.errors.push({ message, error: error.message || error });
  }
  testResults.failed++;
  testResults.total++;
}

function logInfo(message) {
  console.log('ℹ️ '.blue, message.blue);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60).cyan);
  console.log(title.toUpperCase().cyan.bold);
  console.log('='.repeat(60).cyan + '\n');
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ===================================================================
// TESTS PRÉPARATOIRES
// ===================================================================

async function testServerHealth() {
  logSection('Test 0: Santé du Serveur');
  
  try {
    const response = await axios.get(`${BASE_URL}/api/health`);
    
    if (response.status === 200 && response.data.status === 'OK') {
      logSuccess('Serveur opérationnel');
    } else {
      logError('Serveur ne répond pas correctement');
    }
  } catch (error) {
    logError('Serveur inaccessible', error);
    throw new Error('Le serveur doit être démarré pour exécuter les tests');
  }
}

async function testModuleHealth() {
  logSection('Test 1: Santé Module Investments');
  
  try {
    const response = await axios.get(`${BASE_URL}/api/investments/health`);
    
    if (response.status === 200) {
      logSuccess('Module Investments opérationnel');
      logInfo(`Endpoints disponibles: ${response.data.endpoints.total}`);
    } else {
      logError('Module Investments ne répond pas correctement');
    }
  } catch (error) {
    logError('Module Investments inaccessible - Route probablement non activée dans app.js', error);
    throw new Error('Veuillez activer la route investments dans src/app.js');
  }
}

async function setupTestUser() {
  logSection('Test 2: Configuration Utilisateur Test');
  
  try {
    // Essayer de se connecter
    try {
      const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
        email: TEST_USER.email,
        password: TEST_USER.password
      });
      
      authToken = loginResponse.data.data.accessToken;
      logSuccess('Connexion utilisateur test réussie');
      return;
    } catch (loginError) {
      // Si login échoue, créer le compte
      logInfo('Utilisateur test inexistant, création en cours...');
    }
    
    // Créer utilisateur
    const registerResponse = await axios.post(`${BASE_URL}/api/auth/register`, TEST_USER);
    
    if (registerResponse.status === 201) {
      authToken = registerResponse.data.data.accessToken;
      logSuccess('Utilisateur test créé et connecté');
    }
  } catch (error) {
    logError('Échec configuration utilisateur test', error);
    throw error;
  }
}

// ===================================================================
// TESTS CRUD INVESTMENTS
// ===================================================================

async function testCreateInvestment() {
  logSection('Test 3: Création Investissement');
  
  const investmentData = {
    name: 'Test Élevage Porcs - Croix-des-Bouquets',
    description: 'Investissement test pour élevage porcin',
    type: 'livestock',
    category: 'medium',
    initialInvestment: 150000,
    currency: 'HTG',
    location: {
      region: 'ouest',
      city: 'Croix-des-Bouquets',
      address: 'Route Nationale #3'
    },
    expectedDuration: 24,
    projections: {
      expectedROI: 35,
      targetValue: 200000,
      breakEvenMonths: 12
    },
    goals: {
      targetROI: 35,
      targetROITimeframe: '2_years',
      monthlyIncomeTarget: 15000,
      exitStrategy: 'scale'
    },
    risks: [
      {
        type: 'market',
        description: 'Fluctuation prix du porc',
        severity: 'medium',
        likelihood: 'likely',
        mitigation: 'Diversifier points de vente'
      }
    ]
  };
  
  try {
    const response = await axios.post(
      `${BASE_URL}/api/investments/`,
      investmentData,
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );
    
    if (response.status === 201 && response.data.success) {
      testInvestmentId = response.data.data.investment._id;
      logSuccess(`Investissement créé (ID: ${testInvestmentId})`);
      logInfo(`Nom: ${response.data.data.investment.name}`);
      logInfo(`Type: ${response.data.data.investment.type}`);
      logInfo(`Montant: ${response.data.data.investment.totalInvested} HTG`);
    } else {
      logError('Réponse de création incorrecte');
    }
  } catch (error) {
    logError('Échec création investissement', error.response?.data || error);
  }
}

async function testGetAllInvestments() {
  logSection('Test 4: Récupération Liste Investissements');
  
  try {
    const response = await axios.get(
      `${BASE_URL}/api/investments/?includeAnalytics=true`,
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );
    
    if (response.status === 200 && response.data.success) {
      logSuccess('Liste investissements récupérée');
      logInfo(`Total investissements: ${response.data.data.summary.totalInvestments}`);
      logInfo(`Total investi: ${response.data.data.summary.totalInvested} HTG`);
      
      if (response.data.data.analytics) {
        logSuccess('Analytics inclus dans la réponse');
      }
    } else {
      logError('Réponse de liste incorrecte');
    }
  } catch (error) {
    logError('Échec récupération liste', error.response?.data || error);
  }
}

async function testGetInvestmentById() {
  logSection('Test 5: Récupération Investissement Spécifique');
  
  if (!testInvestmentId) {
    logError('Aucun investmentId disponible (test 3 a échoué)');
    return;
  }
  
  try {
    const response = await axios.get(
      `${BASE_URL}/api/investments/${testInvestmentId}?includeHistory=true`,
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );
    
    if (response.status === 200 && response.data.success) {
      logSuccess('Investissement spécifique récupéré');
      logInfo(`ID: ${response.data.data.investment._id}`);
      logInfo(`Nom: ${response.data.data.investment.name}`);
      logInfo(`Status: ${response.data.data.investment.status}`);
    } else {
      logError('Réponse de récupération incorrecte');
    }
  } catch (error) {
    logError('Échec récupération investissement', error.response?.data || error);
  }
}

async function testUpdateInvestment() {
  logSection('Test 6: Mise à Jour Investissement');
  
  if (!testInvestmentId) {
    logError('Aucun investmentId disponible');
    return;
  }
  
  const updateData = {
    description: 'Description mise à jour par script de test',
    status: 'active',
    goals: {
      targetROI: 40,
      targetROITimeframe: '2_years'
    }
  };
  
  try {
    const response = await axios.put(
      `${BASE_URL}/api/investments/${testInvestmentId}`,
      updateData,
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );
    
    if (response.status === 200 && response.data.success) {
      logSuccess('Investissement mis à jour');
      logInfo(`Nouveau status: ${response.data.data.investment.status}`);
      logInfo(`Description: ${response.data.data.investment.description}`);
    } else {
      logError('Réponse de mise à jour incorrecte');
    }
  } catch (error) {
    logError('Échec mise à jour investissement', error.response?.data || error);
  }
}

// ===================================================================
// TESTS OPÉRATIONS FINANCIÈRES
// ===================================================================

async function testAddRevenue() {
  logSection('Test 7: Ajout Revenu');
  
  if (!testInvestmentId) {
    logError('Aucun investmentId disponible');
    return;
  }
  
  const revenueData = {
    amount: 45000,
    description: 'Vente de 10 porcs au marché - Test',
    source: 'sales',
    date: new Date().toISOString(),
    isRecurring: false
  };
  
  try {
    const response = await axios.post(
      `${BASE_URL}/api/investments/${testInvestmentId}/revenue`,
      revenueData,
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );
    
    if (response.status === 200 && response.data.success) {
      logSuccess('Revenu ajouté avec succès');
      logInfo(`Montant: ${revenueData.amount} HTG`);
      logInfo(`Total revenus: ${response.data.data.investment.totalRevenue} HTG`);
    } else {
      logError('Réponse ajout revenu incorrecte');
    }
  } catch (error) {
    logError('Échec ajout revenu', error.response?.data || error);
  }
}

async function testAddExpense() {
  logSection('Test 8: Ajout Dépense');
  
  if (!testInvestmentId) {
    logError('Aucun investmentId disponible');
    return;
  }
  
  const expenseData = {
    amount: 12000,
    description: 'Achat nourriture et vitamines - Test',
    category: 'supplies',
    date: new Date().toISOString(),
    isRecurring: true,
    recurringFrequency: 'monthly'
  };
  
  try {
    const response = await axios.post(
      `${BASE_URL}/api/investments/${testInvestmentId}/expense`,
      expenseData,
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );
    
    if (response.status === 200 && response.data.success) {
      logSuccess('Dépense ajoutée avec succès');
      logInfo(`Montant: ${expenseData.amount} HTG`);
      logInfo(`Total dépenses: ${response.data.data.investment.totalExpenses} HTG`);
      logInfo(`Profit net: ${response.data.data.investment.netProfit} HTG`);
    } else {
      logError('Réponse ajout dépense incorrecte');
    }
  } catch (error) {
    logError('Échec ajout dépense', error.response?.data || error);
  }
}

async function testAddMultipleRevenuesExpenses() {
  logSection('Test 9: Ajout Revenus/Dépenses Multiples');
  
  if (!testInvestmentId) {
    logError('Aucun investmentId disponible');
    return;
  }
  
  const operations = [
    { type: 'revenue', amount: 30000, description: 'Vente porcelets' },
    { type: 'expense', amount: 8000, description: 'Frais vétérinaire' },
    { type: 'revenue', amount: 25000, description: 'Vente engrais organique' },
    { type: 'expense', amount: 5000, description: 'Électricité' }
  ];
  
  try {
    for (const op of operations) {
      const endpoint = op.type === 'revenue' ? 'revenue' : 'expense';
      const data = {
        amount: op.amount,
        description: op.description,
        ...(op.type === 'expense' && { category: 'operational' }),
        ...(op.type === 'revenue' && { source: 'sales' })
      };
      
      await axios.post(
        `${BASE_URL}/api/investments/${testInvestmentId}/${endpoint}`,
        data,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      
      await delay(100); // Petit délai entre requêtes
    }
    
    logSuccess('Opérations multiples ajoutées');
    logInfo(`${operations.length} opérations financières enregistrées`);
  } catch (error) {
    logError('Échec opérations multiples', error.response?.data || error);
  }
}

// ===================================================================
// TESTS ANALYTICS
// ===================================================================

async function testPortfolioAnalytics() {
  logSection('Test 10: Analytics Portfolio');
  
  try {
    const response = await axios.get(
      `${BASE_URL}/api/investments/analytics/portfolio`,
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );
    
    if (response.status === 200 && response.data.success) {
      logSuccess('Analytics portfolio récupérés');
      const analytics = response.data.data.analytics;
      
      logInfo(`Total investissements: ${analytics.overview.totalInvestments}`);
      logInfo(`Total investi: ${analytics.overview.totalInvested} HTG`);
      logInfo(`Valeur actuelle: ${analytics.overview.totalCurrentValue} HTG`);
      logInfo(`Profit net: ${analytics.overview.netProfit} HTG`);
      logInfo(`ROI moyen: ${analytics.overview.avgROI?.toFixed(2)}%`);
      logInfo(`Score diversification: ${analytics.diversification.diversificationScore}/100`);
    } else {
      logError('Réponse analytics incorrecte');
    }
  } catch (error) {
    logError('Échec analytics portfolio', error.response?.data || error);
  }
}

async function testAnalyticsByType() {
  logSection('Test 11: Analytics Par Type');
  
  try {
    const response = await axios.get(
      `${BASE_URL}/api/investments/analytics/by-type`,
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );
    
    if (response.status === 200 && response.data.success) {
      logSuccess('Analytics par type récupérés');
      logInfo(`Types d'investissements: ${response.data.data.totalTypes}`);
      
      response.data.data.analyticsByType.forEach(type => {
        logInfo(`  - ${type._id}: ${type.count} investissement(s), ROI moyen: ${type.avgROI?.toFixed(2)}%`);
      });
    } else {
      logError('Réponse analytics par type incorrecte');
    }
  } catch (error) {
    logError('Échec analytics par type', error.response?.data || error);
  }
}

async function testNeedingAttention() {
  logSection('Test 12: Investissements Nécessitant Attention');
  
  try {
    const response = await axios.get(
      `${BASE_URL}/api/investments/analytics/needing-attention`,
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );
    
    if (response.status === 200 && response.data.success) {
      logSuccess('Investissements nécessitant attention récupérés');
      const data = response.data.data;
      
      logInfo(`Total nécessitant attention: ${data.totalNeedingAttention}`);
      logInfo(`  - Risque élevé: ${data.categorized.highRisk.length}`);
      logInfo(`  - ROI négatif: ${data.categorized.negativeROI.length}`);
      logInfo(`  - Non mis à jour: ${data.categorized.outdated.length}`);
    } else {
      logError('Réponse needing attention incorrecte');
    }
  } catch (error) {
    logError('Échec needing attention', error.response?.data || error);
  }
}

// ===================================================================
// TESTS VALIDATIONS & ERREURS
// ===================================================================

async function testValidations() {
  logSection('Test 13: Validations & Gestion Erreurs');
  
  // Test 1: Création avec données invalides
  try {
    await axios.post(
      `${BASE_URL}/api/investments/`,
      { name: 'AB' }, // Nom trop court
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    logError('Validation nom trop court NON détectée');
  } catch (error) {
    if (error.response?.status === 400) {
      logSuccess('Validation nom trop court fonctionne');
    } else {
      logError('Erreur inattendue validation nom');
    }
  }
  
  await delay(100);
  
  // Test 2: Type invalide
  try {
    await axios.post(
      `${BASE_URL}/api/investments/`,
      {
        name: 'Test Validation',
        type: 'invalid_type',
        initialInvestment: 10000
      },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    logError('Validation type invalide NON détectée');
  } catch (error) {
    if (error.response?.status === 400) {
      logSuccess('Validation type invalide fonctionne');
    } else {
      logError('Erreur inattendue validation type');
    }
  }
  
  await delay(100);
  
  // Test 3: Montant négatif
  try {
    await axios.post(
      `${BASE_URL}/api/investments/`,
      {
        name: 'Test Validation',
        type: 'commerce',
        initialInvestment: -5000
      },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    logError('Validation montant négatif NON détectée');
  } catch (error) {
    if (error.response?.status === 400) {
      logSuccess('Validation montant négatif fonctionne');
    } else {
      logError('Erreur inattendue validation montant');
    }
  }
  
  await delay(100);
  
  // Test 4: ID investissement invalide
  try {
    await axios.get(
      `${BASE_URL}/api/investments/invalid_id`,
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    logError('Validation ID invalide NON détectée');
  } catch (error) {
    if (error.response?.status === 400) {
      logSuccess('Validation ID invalide fonctionne');
    } else {
      logError('Erreur inattendue validation ID');
    }
  }
}

async function testRateLimiting() {
  logSection('Test 14: Rate Limiting');
  
  logInfo('Test rate limiting (peut prendre quelques secondes)...');
  
  try {
    const requests = [];
    const limit = 12; // Au-dessus de la limite création (10/15min)
    
    for (let i = 0; i < limit; i++) {
      requests.push(
        axios.post(
          `${BASE_URL}/api/investments/`,
          {
            name: `Test Rate Limit ${i}`,
            type: 'commerce',
            initialInvestment: 1000
          },
          { headers: { Authorization: `Bearer ${authToken}` } }
        ).catch(err => err)
      );
    }
    
    const results = await Promise.all(requests);
    const blocked = results.filter(r => r.response?.status === 429);
    
    if (blocked.length > 0) {
      logSuccess(`Rate limiting fonctionne (${blocked.length} requêtes bloquées)`);
    } else {
      logError('Rate limiting ne semble pas fonctionner');
    }
  } catch (error) {
    logError('Échec test rate limiting', error);
  }
}

// ===================================================================
// TESTS NETTOYAGE
// ===================================================================

async function testArchiveInvestment() {
  logSection('Test 15: Archivage Investissement');
  
  if (!testInvestmentId) {
    logError('Aucun investmentId disponible');
    return;
  }
  
  try {
    const response = await axios.put(
      `${BASE_URL}/api/investments/${testInvestmentId}/archive`,
      {
        reason: 'completed',
        notes: 'Test terminé avec succès'
      },
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );
    
    if (response.status === 200 && response.data.success) {
      logSuccess('Investissement archivé avec succès');
      const finalStats = response.data.data.finalStats;
      logInfo(`ROI final: ${finalStats.roi?.toFixed(2)}%`);
      logInfo(`Profit total: ${finalStats.totalProfit} HTG`);
      logInfo(`Durée: ${finalStats.duration} mois`);
    } else {
      logError('Réponse archivage incorrecte');
    }
  } catch (error) {
    logError('Échec archivage investissement', error.response?.data || error);
  }
}

// ===================================================================
// RAPPORT FINAL
// ===================================================================

function generateReport() {
  logSection('RAPPORT FINAL DES TESTS');
  
  console.log('📊 RÉSULTATS GLOBAUX\n'.bold);
  console.log(`   Total tests: ${testResults.total}`);
  console.log(`   ✅ Réussis: ${testResults.passed}`.green);
  console.log(`   ❌ Échoués: ${testResults.failed}`.red);
  
  const successRate = ((testResults.passed / testResults.total) * 100).toFixed(1);
  console.log(`   📈 Taux de réussite: ${successRate}%\n`);
  
  if (testResults.failed > 0) {
    console.log('❌ ERREURS DÉTECTÉES:\n'.red.bold);
    testResults.errors.forEach((err, index) => {
      console.log(`   ${index + 1}. ${err.message}`.red);
      if (err.error) {
        console.log(`      ${err.error}`.gray);
      }
    });
    console.log('');
  }
  
  // Recommandations
  console.log('🎯 RECOMMANDATIONS\n'.cyan.bold);
  
  if (successRate >= 95) {
    console.log('   ✅ Module Investments OPÉRATIONNEL'.green.bold);
    console.log('   ✅ Prêt pour Phase 7 (IA Foundation)'.green);
    console.log('   ✅ Tous les endpoints fonctionnent correctement\n');
  } else if (successRate >= 80) {
    console.log('   ⚠️  Module Investments PARTIELLEMENT OPÉRATIONNEL'.yellow.bold);
    console.log('   📝 Corriger les erreurs ci-dessus avant Phase 7');
    console.log('   🔧 Vérifier la configuration et les validations\n');
  } else {
    console.log('   ❌ Module Investments NÉCESSITE ATTENTION'.red.bold);
    console.log('   🚨 Plusieurs tests ont échoué');
    console.log('   🔧 Vérifier:');
    console.log('      - Route activée dans app.js');
    console.log('      - Serveur démarré');
    console.log('      - MongoDB connecté');
    console.log('      - Toutes les dépendances installées\n');
  }
  
  console.log('='.repeat(60).cyan + '\n');
}

// ===================================================================
// EXÉCUTION PRINCIPALE
// ===================================================================

async function runAllTests() {
  console.log('\n' + '🚀 DÉMARRAGE TESTS MODULE INVESTMENTS'.bold.cyan);
  console.log('📅 ' + new Date().toLocaleString() + '\n');
  
  try {
    // Tests préparatoires
    await testServerHealth();
    await testModuleHealth();
    await setupTestUser();
    
    // Tests CRUD
    await testCreateInvestment();
    await delay(200);
    await testGetAllInvestments();
    await delay(200);
    await testGetInvestmentById();
    await delay(200);
    await testUpdateInvestment();
    await delay(200);
    
    // Tests financiers
    await testAddRevenue();
    await delay(200);
    await testAddExpense();
    await delay(200);
    await testAddMultipleRevenuesExpenses();
    await delay(200);
    
    // Tests analytics
    await testPortfolioAnalytics();
    await delay(200);
    await testAnalyticsByType();
    await delay(200);
    await testNeedingAttention();
    await delay(200);
    
    // Tests validations
    await testValidations();
    await delay(200);
    await testRateLimiting();
    await delay(200);
    
    // Nettoyage
    await testArchiveInvestment();
    
    // Rapport final
    generateReport();
    
    // Code de sortie
    process.exit(testResults.failed > 0 ? 1 : 0);
    
  } catch (error) {
    console.error('\n❌ ERREUR CRITIQUE:'.red.bold, error.message);
    console.error('\nLe script de test a été interrompu.\n');
    process.exit(1);
  }
}

// Lancer les tests
runAllTests();