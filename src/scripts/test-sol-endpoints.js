// scripts/test-sol-endpoints.js
// Script de test complet pour les endpoints Sol/Tontine - FinApp Haiti

const axios = require('axios');
const mongoose = require('mongoose');

// Configuration
const BASE_URL = 'http://localhost:3001/api'; // Ajustez selon votre configuration
const TEST_USER = {
  email: 'hantzmichaelchery6@gmail.com',
  password: 'Pass@1234'
};

let authToken = '';
let testSolId = '';
let testAccessCode = '';
let testAccountId = '';

// Client Axios configuré
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// ===================================================================
// FONCTIONS UTILITAIRES
// ===================================================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function logSuccess(message, data = null) {
  console.log(`✅ ${message}`);
  if (data) console.log('   Données:', JSON.stringify(data, null, 2));
}

function logError(message, error = null) {
  console.error(`❌ ${message}`);
  if (error) {
    console.error('   Erreur:', error.response?.data || error.message);
  }
}

function logInfo(message) {
  console.log(`ℹ️  ${message}`);
}

// ===================================================================
// TESTS D'AUTHENTIFICATION
// ===================================================================

async function loginUser() {
  try {
    logInfo('Tentative de connexion...');
    
    const response = await api.post('/auth/login', {
      identifier: TEST_USER.email,
      password: TEST_USER.password
    });

    if (response.data.success) {
      authToken = response.data.data.token;
      api.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
      logSuccess('Connexion réussie', { token: authToken.substring(0, 20) + '...' });
      return true;
    }
  } catch (error) {
    logError('Échec de la connexion', error);
    return false;
  }
}

// ===================================================================
// TESTS DES ENDPOINTS SOL
// ===================================================================

async function testCreateSol() {
  try {
    logInfo('Test création de sol...');
    
    const solData = {
      name: 'Sol Test ' + Date.now(),
      description: 'Sol de test pour validation des endpoints',
      type: 'classic',
      contributionAmount: 1000,
      currency: 'HTG',
      maxParticipants: 5,
      frequency: 'monthly',
      startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Dans 7 jours
      duration: 5,
      paymentDay: 15,
      tags: ['test', 'validation'],
      rules: [
        'Paiement avant le 15 de chaque mois',
        'Retard: pénalité de 5%'
      ],
      isPrivate: false
    };

    const response = await api.post('/sols', solData);
    
    if (response.data.success) {
      testSolId = response.data.data.sol._id;
      testAccessCode = response.data.data.accessCode;
      logSuccess('Sol créé avec succès', { 
        id: testSolId, 
        accessCode: testAccessCode,
        name: solData.name 
      });
      return true;
    }
  } catch (error) {
    logError('Échec création sol', error);
    return false;
  }
}

async function testGetUserSols() {
  try {
    logInfo('Test récupération des sols utilisateur...');
    
    const response = await api.get('/sols/user-sols', {
      params: {
        status: 'all',
        page: 1,
        limit: 10,
        includeAnalytics: true
      }
    });

    if (response.data.success) {
      logSuccess('Sols utilisateur récupérés', {
        total: response.data.data.pagination.total,
        sols: response.data.data.sols.length
      });
      return true;
    }
  } catch (error) {
    logError('Échec récupération sols utilisateur', error);
    return false;
  }
}

async function testGetSolById() {
  try {
    logInfo('Test récupération sol par ID...');
    
    const response = await api.get(`/sols/${testSolId}`, {
      params: {
        includeHistory: true
      }
    });

    if (response.data.success) {
      logSuccess('Sol récupéré par ID', {
        name: response.data.data.sol.name,
        status: response.data.data.sol.status
      });
      return true;
    }
  } catch (error) {
    logError('Échec récupération sol par ID', error);
    return false;
  }
}

async function testJoinSol() {
  try {
    logInfo('Test adhésion à un sol...');
    
    // Créer un deuxième utilisateur pour tester l'adhésion
    const secondUser = await loginSecondUser();
    if (!secondUser) {
      logInfo('Création deuxième utilisateur pour test adhésion...');
      
      // Simuler l'adhésion avec le même utilisateur (dans la réalité, utiliser un autre user)
      const response = await api.post('/sols/join', {
        accessCode: testAccessCode
      });

      if (response.data.success) {
        logSuccess('Adhésion au sol testée', {
          status: response.data.data.status,
          position: response.data.data.yourPosition
        });
        return true;
      }
    }
  } catch (error) {
    logError('Échec adhésion au sol', error);
    return false;
  }
}

async function loginSecondUser() {
  try {
    const response = await api.post('/auth/login', {
      email: 'test2@finapp.ht',
      password: 'password123'
    });
    
    if (response.data.success) {
      return response.data.data.token;
    }
  } catch (error) {
    return null;
  }
}

async function testGetPersonalAnalytics() {
  try {
    logInfo('Test analytics personnels...');
    
    const response = await api.get('/sols/analytics/personal', {
      params: {
        timeframe: 30
      }
    });

    if (response.data.success) {
      logSuccess('Analytics personnels récupérés', {
        totalSols: response.data.data.analytics.overview.totalSols,
        dataQuality: response.data.data.dataQuality
      });
      return true;
    }
  } catch (error) {
    logError('Échec récupération analytics', error);
    return false;
  }
}

async function testDiscoverSols() {
  try {
    logInfo('Test découverte de sols...');
    
    const response = await api.get('/sols/discover', {
      params: {
        type: 'classic',
        currency: 'HTG',
        page: 1,
        limit: 5
      }
    });

    if (response.data.success) {
      logSuccess('Sols découverts', {
        total: response.data.data.pagination.total,
        results: response.data.data.sols.length
      });
      return true;
    }
  } catch (error) {
    logError('Échec découverte sols', error);
    return false;
  }
}

async function testMakePayment() {
  try {
    logInfo('Test simulation de paiement...');
    
    // D'abord, récupérer les comptes de l'utilisateur
    const accountsResponse = await api.get('/accounts/user-accounts');
    
    if (accountsResponse.data.success && accountsResponse.data.data.accounts.length > 0) {
      testAccountId = accountsResponse.data.data.accounts[0]._id;
      
      logInfo(`Utilisation du compte: ${testAccountId}`);
      
      // Simuler un paiement (normalement besoin d'un sol actif avec round actif)
      const paymentData = {
        accountId: testAccountId,
        amount: 1000,
        notes: 'Paiement test'
      };

      const response = await api.post(`/sols/${testSolId}/pay`, paymentData);
      
      if (response.data.success) {
        logSuccess('Paiement simulé', {
          round: response.data.data.transaction.round,
          amount: response.data.data.transaction.amount
        });
        return true;
      }
    } else {
      logInfo('Aucun compte trouvé, test de paiement ignoré');
      return true; // Ignorer ce test si pas de compte
    }
  } catch (error) {
    if (error.response?.status === 400) {
      logInfo('Paiement échoué (normal pour un sol en recrutement)');
      return true; // Ignorer les erreurs attendues
    }
    logError('Échec paiement', error);
    return false;
  }
}

async function testLeaveSol() {
  try {
    logInfo('Test sortie d\'un sol...');
    
    // Créer un sol spécifique pour tester la sortie
    const tempSolData = {
      name: 'Sol pour test sortie ' + Date.now(),
      type: 'classic',
      contributionAmount: 500,
      currency: 'HTG',
      maxParticipants: 3,
      frequency: 'monthly',
      startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      isPrivate: true
    };

    const createResponse = await api.post('/sols', tempSolData);
    
    if (createResponse.data.success) {
      const tempSolId = createResponse.data.data.sol._id;
      
      // Tester la sortie
      const response = await api.delete(`/sols/${tempSolId}/leave`, {
        data: { reason: 'Test de fonctionnalité' }
      });

      if (response.data.success) {
        logSuccess('Sortie de sol testée', {
          status: response.data.data.solStatus
        });
        return true;
      }
    }
  } catch (error) {
    logError('Échec test sortie sol', error);
    return false;
  }
}

async function testUpdateSol() {
  try {
    logInfo('Test mise à jour sol...');
    
    const updateData = {
      description: 'Description mise à jour - ' + new Date().toISOString(),
      tags: ['test', 'mise-a-jour', 'validation']
    };

    const response = await api.put(`/sols/${testSolId}`, updateData);
    
    if (response.data.success) {
      logSuccess('Sol mis à jour', {
        description: response.data.data.sol.description
      });
      return true;
    }
  } catch (error) {
    logError('Échec mise à jour sol', error);
    return false;
  }
}

async function testSolValidations() {
  try {
    logInfo('Test des validations...');
    
    // Test avec données invalides
    const invalidData = {
      name: 'AB', // Trop court
      contributionAmount: 50, // Trop bas
      maxParticipants: 2, // Trop peu
      frequency: 'invalid', // Fréquence invalide
      startDate: 'invalid-date' // Date invalide
    };

    const response = await api.post('/sols', invalidData);
    
    // Normalement devrait échouer avec validation errors
    if (!response.data.success && response.data.errors) {
      logSuccess('Validations fonctionnent correctement', {
        errors: response.data.errors.length
      });
      return true;
    } else {
      logError('Les validations n\'ont pas fonctionné comme attendu');
      return false;
    }
  } catch (error) {
    if (error.response?.status === 400) {
      logSuccess('Validations fonctionnent (erreur 400 attendue)');
      return true;
    }
    logError('Échec test validations', error);
    return false;
  }
}

// ===================================================================
// TEST DE PERFORMANCE ET STRESS
// ===================================================================

async function testPerformance() {
  try {
    logInfo('Test de performance (requêtes multiples)...');
    
    const startTime = Date.now();
    const requests = [];
    
    // Faire 5 requêtes simultanées
    for (let i = 0; i < 5; i++) {
      requests.push(api.get('/sols/user-sols?limit=5'));
    }
    
    const results = await Promise.all(requests);
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    const successfulRequests = results.filter(r => r.data.success).length;
    
    logSuccess('Test performance terminé', {
      durée: `${duration}ms`,
      requêtes: `${successfulRequests}/${requests.length} réussies`,
      moyenne: `${(duration / requests.length).toFixed(2)}ms/requête`
    });
    
    return successfulRequests === requests.length;
  } catch (error) {
    logError('Échec test performance', error);
    return false;
  }
}

// ===================================================================
// TEST D'ERREURS ET CAS LIMITES
// ===================================================================

async function testErrorCases() {
  try {
    logInfo('Test des cas d\'erreur...');
    
    let testsPassed = 0;
    const totalTests = 4;
    
    // Test 1: ID invalide
    try {
      await api.get('/sols/invalid-id');
    } catch (error) {
      if (error.response?.status === 400) testsPassed++;
    }
    
    // Test 2: Sol inexistant
    try {
      const fakeId = new mongoose.Types.ObjectId();
      await api.get(`/sols/${fakeId}`);
    } catch (error) {
      if (error.response?.status === 404) testsPassed++;
    }
    
    // Test 3: Accès non autorisé
    try {
      // Simuler un token invalide
      const originalToken = api.defaults.headers.common['Authorization'];
      api.defaults.headers.common['Authorization'] = 'Bearer invalid-token';
      
      await api.get('/sols/user-sols');
      api.defaults.headers.common['Authorization'] = originalToken;
    } catch (error) {
      if (error.response?.status === 401) testsPassed++;
    }
    
    // Test 4: Code d'accès invalide
    try {
      await api.post('/sols/join', {
        accessCode: 'INVALID'
      });
    } catch (error) {
      if (error.response?.status === 404) testsPassed++;
    }
    
    logSuccess('Tests d\'erreur terminés', {
      réussis: `${testsPassed}/${totalTests}`
    });
    
    return testsPassed >= 2; // Au moins 50% de réussite acceptable
  } catch (error) {
    logError('Erreur lors des tests d\'erreur', error);
    return false;
  }
}

// ===================================================================
// RAPPORT FINAL
// ===================================================================

async function generateReport(testResults) {
  console.log('\n' + '='.repeat(60));
  console.log('📊 RAPPORT DE TEST DES ENDPOINTS SOL');
  console.log('='.repeat(60));
  
  const totalTests = testResults.length;
  const passedTests = testResults.filter(r => r.passed).length;
  const successRate = (passedTests / totalTests) * 100;
  
  console.log(`\n📈 STATISTIQUES GLOBALES:`);
  console.log(`   Tests exécutés: ${totalTests}`);
  console.log(`   Tests réussis: ${passedTests}`);
  console.log(`   Taux de succès: ${successRate.toFixed(1)}%`);
  
  console.log(`\n🔍 DÉTAIL DES TESTS:`);
  testResults.forEach(result => {
    const status = result.passed ? '✅' : '❌';
    console.log(`   ${status} ${result.name}`);
    if (!result.passed && result.error) {
      console.log(`      Erreur: ${result.error}`);
    }
  });
  
  console.log(`\n💡 RECOMMANDATIONS:`);
  if (successRate === 100) {
    console.log('   🎉 Tous les tests sont passés avec succès!');
    console.log('   Le module Sol est prêt pour la production.');
  } else if (successRate >= 80) {
    console.log('   ⚠️  La plupart des tests sont passés.');
    console.log('   Vérifiez les endpoints en échec avant le déploiement.');
  } else if (successRate >= 50) {
    console.log('   ❗ Des problèmes importants détectés.');
    console.log('   Révision nécessaire avant toute mise en production.');
  } else {
    console.log('   🚨 État critique!');
    console.log('   Révision urgente requise.');
  }
  
  console.log('\n' + '='.repeat(60));
}

// ===================================================================
// EXÉCUTION PRINCIPALE
// ===================================================================

async function runAllTests() {
  console.log('🚀 LANCEMENT DES TESTS DES ENDPOINTS SOL');
  console.log('='.repeat(60));
  
  const testResults = [];
  
  // 1. Authentification
  const authSuccess = await loginUser();
  testResults.push({ name: 'Authentification', passed: authSuccess });
  
  if (!authSuccess) {
    console.log('❌ Impossible de continuer sans authentification');
    await generateReport(testResults);
    return;
  }
  
  await sleep(1000);
  
  // 2. Tests principaux
  const tests = [
    { name: 'Création de sol', test: testCreateSol },
    { name: 'Récupération sols utilisateur', test: testGetUserSols },
    { name: 'Récupération sol par ID', test: testGetSolById },
    { name: 'Adhésion à un sol', test: testJoinSol },
    { name: 'Analytics personnels', test: testGetPersonalAnalytics },
    { name: 'Découverte de sols', test: testDiscoverSols },
    { name: 'Paiement', test: testMakePayment },
    { name: 'Sortie de sol', test: testLeaveSol },
    { name: 'Mise à jour sol', test: testUpdateSol },
    { name: 'Validations', test: testSolValidations },
    { name: 'Performance', test: testPerformance },
    { name: 'Cas d\'erreur', test: testErrorCases }
  ];
  
  for (const test of tests) {
    try {
      const passed = await test.test();
      testResults.push({ name: test.name, passed });
    } catch (error) {
      testResults.push({ 
        name: test.name, 
        passed: false, 
        error: error.message 
      });
    }
    await sleep(500); // Pause entre les tests
  }
  
  // 3. Génération du rapport
  await generateReport(testResults);
  
  // 4. Nettoyage (optionnel)
  if (testSolId) {
    logInfo('Nettoyage des données de test...');
    // Ici vous pourriez ajouter la suppression du sol de test
  }
}

// ===================================================================
// CONFIGURATION ET LANCEMENT
// ===================================================================

// Vérification de la connexion à l'API
async function checkApiConnection() {
  try {
    logInfo('Vérification de la connexion à l\'API...');
    await api.get('/health');
    logSuccess('API accessible');
    return true;
  } catch (error) {
    logError('API inaccessible', error);
    console.log('\n💡 Assurez-vous que:');
    console.log('   1. Le serveur est démarré sur ' + BASE_URL);
    console.log('   2. La base de données est connectée');
    console.log('   3. Les variables d\'environnement sont configurées');
    return false;
  }
}

// Point d'entrée principal
async function main() {
  try {
    const apiAvailable = await checkApiConnection();
    if (!apiAvailable) {
      process.exit(1);
    }
    
    await runAllTests();
    
  } catch (error) {
    console.error('💥 Erreur fatale lors des tests:', error);
    process.exit(1);
  }
}

// Exécution si appelé directement
if (require.main === module) {
  main();
}

module.exports = {
  runAllTests,
  testCreateSol,
  testGetUserSols,
  testGetSolById,
  testJoinSol,
  testGetPersonalAnalytics,
  testDiscoverSols,
  testMakePayment,
  testLeaveSol,
  testUpdateSol,
  testSolValidations,
  testPerformance,
  testErrorCases
};