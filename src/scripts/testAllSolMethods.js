// src/scripts/testAllSolMethods.js
// 🧪 TEST COMPLET CONTRÔLEUR SOL - FINAPP HAITI
// Ce script teste toutes les méthodes pour identifier les incohérences d'accès
// Usage: node src/scripts/testAllSolMethods.js

const axios = require('axios');
const mongoose = require('mongoose');
const User = require('../models/User');
const Sol = require('../models/Sol');
const { verifyAccessToken } = require('../config/jwt');
require('dotenv').config({ path: '.env.local' });

const testAllSolMethods = async () => {
  let mongooseConnection = null;
  
  try {
    console.log('🧪 TEST COMPLET CONTRÔLEUR SOL - FINAPP HAITI\n');
    console.log('='.repeat(60));
    
    // Configuration
    const userEmail = 'hantzmichaelchery6@gmail.com';
    const baseURL = 'http://localhost:3001';
    
    // Connexion MongoDB
    console.log('🔗 Connexion à MongoDB...');
    mongooseConnection = await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connecté');
    
    // Récupérer token valide
    console.log('🔑 Recherche de l\'utilisateur et token valide...');
    const user = await User.findOne({ email: userEmail });
    
    if (!user) {
      console.log('❌ Utilisateur non trouvé');
      return;
    }
    
    console.log(`✅ Utilisateur trouvé: ${user.firstName} ${user.lastName}`);
    
    const validSession = user.activeSessions.find(session => {
      if (!session.accessToken) return false;
      if (session.expiresAt < new Date()) return false;
      
      try {
        const verification = verifyAccessToken(session.accessToken);
        return verification.isValid && !verification.expired;
      } catch (e) {
        return false;
      }
    });
    
    if (!validSession) {
      console.log('❌ Aucun token valide trouvé');
      return;
    }
    
    const token = validSession.accessToken;
    console.log('✅ Token valide récupéré');
    
    // Récupérer un sol existant pour les tests
    console.log('🔍 Recherche d\'un sol existant pour les tests...');
    const existingSol = await Sol.findOne({
      $or: [
        { creator: user._id },
        { 'participants.user': user._id }
      ],
      status: { $in: ['recruiting', 'active'] }
    }).populate('participants.user');
    
    let testSolId = null;
    let testAccessCode = null;
    
    if (existingSol) {
      testSolId = existingSol._id.toString();
      testAccessCode = existingSol.accessCode;
      console.log(`✅ Sol trouvé: ${existingSol.name} (${testSolId})`);
      console.log(`✅ Code d'accès: ${testAccessCode}`);
      console.log(`✅ Statut: ${existingSol.status}`);
      console.log(`✅ Participants: ${existingSol.participants.length}/${existingSol.maxParticipants}`);
    } else {
      console.log('ℹ️  Aucun sol existant trouvé, création d\'un sol de test...');
      
      // Créer un sol de test
      const newSol = new Sol({
        creator: user._id,
        name: 'Sol de Test - ' + Date.now(),
        description: 'Sol créé pour tests automatiques',
        type: 'classic',
        contributionAmount: 1000,
        currency: 'HTG',
        maxParticipants: 5,
        frequency: 'monthly',
        startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Dans 7 jours
        participants: [{
          user: user._id,
          position: 1,
          role: 'creator',
          paymentStatus: 'pending'
        }],
        status: 'recruiting'
      });
      
      await newSol.save();
      testSolId = newSol._id.toString();
      testAccessCode = newSol.accessCode;
      console.log(`✅ Nouveau sol créé: ${newSol.name} (${testSolId})`);
      console.log(`✅ Code d'accès: ${testAccessCode}`);
    }
    
    // Configuration axios
    const apiClient = axios.create({
      baseURL: baseURL,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('🚀 DÉBUT DES TESTS DES ENDPOINTS SOL');
    console.log('='.repeat(60));
    
    const testResults = [];
    
    // ===================================================================
    // TEST 1: getUserSols (devrait fonctionner)
    // ===================================================================
    console.log('\n🎯 TEST 1: GET /api/sols/ (getUserSols)');
    try {
      const startTime = Date.now();
      const response = await apiClient.get('/api/sols/');
      const duration = Date.now() - startTime;
      
      console.log(`✅ Status: ${response.status}`);
      console.log(`✅ Durée: ${duration}ms`);
      console.log(`✅ Sols trouvés: ${response.data.data?.sols?.length || 0}`);
      
      if (response.data.data?.sols?.length > 0) {
        const sol = response.data.data.sols[0];
        console.log(`✅ Premier sol: ${sol.name}`);
        console.log(`✅ Votre rôle: ${sol.userRole}`);
        console.log(`✅ Statut: ${sol.status}`);
      }
      
      testResults.push({ name: 'getUserSols', passed: true, duration });
    } catch (error) {
      console.log(`❌ ERREUR: ${error.response?.status || error.code}`);
      console.log(`❌ Message: ${error.response?.data?.message || error.message}`);
      testResults.push({ name: 'getUserSols', passed: false, error: error.message });
    }
    
    // ===================================================================
    // TEST 2: getSolById (test d'accès détaillé)
    // ===================================================================
    console.log('\n🎯 TEST 2: GET /api/sols/:id (getSolById)');
    try {
      const startTime = Date.now();
      const response = await apiClient.get(`/api/sols/${testSolId}`);
      const duration = Date.now() - startTime;
      
      console.log(`✅ Status: ${response.status}`);
      console.log(`✅ Durée: ${duration}ms`);
      console.log(`✅ Sol: ${response.data.data?.sol?.name}`);
      console.log(`✅ Votre rôle: ${response.data.data?.sol?.userRole}`);
      console.log(`✅ Progression: ${response.data.data?.sol?.progress?.percentage || 0}%`);
      
      // Vérification détaillée de l'accès
      const solData = response.data.data?.sol;
      if (solData) {
        const hasAccess = solData.userRole === 'creator' || solData.userRole === 'participant';
        console.log(`✅ Accès vérifié: ${hasAccess ? 'OK' : 'PROBLÈME'}`);
      }
      
      testResults.push({ name: 'getSolById', passed: true, duration });
    } catch (error) {
      console.log(`❌ ERREUR: ${error.response?.status || error.code}`);
      console.log(`❌ Message: ${error.response?.data?.message || error.message}`);
      console.log(`❌ Error code: ${error.response?.data?.error}`);
      
      if (error.response?.data?.error === 'unauthorized_sol_access') {
        console.log('🔍 BUG D\'ACCÈS DÉTECTÉ dans getSolById !');
      }
      
      testResults.push({ name: 'getSolById', passed: false, error: error.message });
    }
    
    // ===================================================================
    // TEST 3: joinSol avec code existant (test d'accès)
    // ===================================================================
    console.log('\n🎯 TEST 3: POST /api/sols/join (joinSol)');
    try {
      const startTime = Date.now();
      const joinData = {
        accessCode: testAccessCode
      };
      
      const response = await apiClient.post('/api/sols/join', joinData);
      const duration = Date.now() - startTime;
      
      console.log(`✅ Status: ${response.status}`);
      console.log(`✅ Durée: ${duration}ms`);
      console.log(`✅ Message: ${response.data.message}`);
      
      if (response.data.data?.yourPosition) {
        console.log(`✅ Position: ${response.data.data.yourPosition}`);
      }
      
      testResults.push({ name: 'joinSol', passed: true, duration });
    } catch (error) {
      console.log(`❌ ERREUR: ${error.response?.status || error.code}`);
      console.log(`❌ Message: ${error.response?.data?.message || error.message}`);
      console.log(`❌ Error code: ${error.response?.data?.error}`);
      
      if (error.response?.data?.error === 'already_participant') {
        console.log('✅ Comportement attendu - Déjà participant');
        testResults.push({ name: 'joinSol', passed: true, warning: 'already_participant' });
      } else if (error.response?.data?.error === 'invalid_access_code') {
        console.log('🔍 Problème avec le code d\'accès');
        testResults.push({ name: 'joinSol', passed: false, error: error.message });
      } else {
        testResults.push({ name: 'joinSol', passed: false, error: error.message });
      }
    }
    
    // ===================================================================
    // TEST 4: makePayment (test de logique de paiement)
    // ===================================================================
    console.log('\n🎯 TEST 4: POST /api/sols/:id/payment (makePayment)');
    try {
      const startTime = Date.now();
      
      // Récupérer les comptes de l'utilisateur d'abord
      const accountsResponse = await apiClient.get('/api/accounts/user-accounts');
      const userAccounts = accountsResponse.data.data?.accounts || [];
      
      let paymentResponse = null;
      
      if (userAccounts.length > 0) {
        const testAccount = userAccounts[0];
        const paymentData = {
          accountId: testAccount._id,
          amount: 1000,
          notes: 'Test de paiement automatique'
        };
        
        paymentResponse = await apiClient.post(`/api/sols/${testSolId}/payment`, paymentData);
        console.log(`✅ Status: ${paymentResponse.status}`);
        console.log(`✅ Paiement effectué: ${paymentResponse.data.success}`);
      } else {
        console.log('ℹ️  Aucun compte trouvé, test avec compte fictif...');
        const paymentData = {
          accountId: '507f1f77bcf86cd799439011', // ID fictif
          amount: 1000,
          notes: 'Test avec compte fictif'
        };
        
        paymentResponse = await apiClient.post(`/api/sols/${testSolId}/payment`, paymentData);
      }
      
      const duration = Date.now() - startTime;
      console.log(`✅ Durée: ${duration}ms`);
      
      testResults.push({ name: 'makePayment', passed: true, duration });
    } catch (error) {
      console.log(`❌ ERREUR: ${error.response?.status || error.code}`);
      console.log(`❌ Message: ${error.response?.data?.message || error.message}`);
      console.log(`❌ Error code: ${error.response?.data?.error}`);
      
      if (error.response?.data?.error === 'unauthorized_sol_access') {
        console.log('🔍 BUG D\'ACCÈS CONFIRMÉ dans makePayment !');
      } else if (error.response?.data?.error === 'not_participant') {
        console.log('🔍 BUG DE RECHERCHE PARTICIPANT dans makePayment !');
      } else if (error.response?.data?.error === 'account_not_found') {
        console.log('✅ Logique d\'accès OK - Erreur attendue (compte fictif)');
        testResults.push({ name: 'makePayment', passed: true, warning: 'account_not_found' });
      } else if (error.response?.data?.error === 'no_active_round') {
        console.log('✅ Logique OK - Pas de round actif (sol en recrutement)');
        testResults.push({ name: 'makePayment', passed: true, warning: 'no_active_round' });
      } else {
        testResults.push({ name: 'makePayment', passed: false, error: error.message });
      }
    }
    
    // ===================================================================
    // TEST 5: leaveSol (test de départ)
    // ===================================================================
    console.log('\n🎯 TEST 5: DELETE /api/sols/:id/leave (leaveSol)');
    try {
      const startTime = Date.now();
      const leaveData = {
        reason: 'Test de départ automatique'
      };
      
      const response = await apiClient.delete(`/api/sols/${testSolId}/leave`, { data: leaveData });
      const duration = Date.now() - startTime;
      
      console.log(`✅ Status: ${response.status}`);
      console.log(`✅ Durée: ${duration}ms`);
      console.log(`✅ Message: ${response.data.message}`);
      
      testResults.push({ name: 'leaveSol', passed: true, duration });
    } catch (error) {
      console.log(`❌ ERREUR: ${error.response?.status || error.code}`);
      console.log(`❌ Message: ${error.response?.data?.message || error.message}`);
      console.log(`❌ Error code: ${error.response?.data?.error}`);
      
      if (error.response?.data?.error === 'not_participant') {
        console.log('🔍 POSSIBLE BUG DE RECHERCHE PARTICIPANT dans leaveSol !');
      } else if (error.response?.data?.error === 'creator_cannot_leave_active_sol') {
        console.log('✅ Logique correcte - Créateur ne peut pas quitter un sol actif');
        testResults.push({ name: 'leaveSol', passed: true, warning: 'creator_cannot_leave' });
      }
      
      testResults.push({ name: 'leaveSol', passed: false, error: error.message });
    }
    
    // ===================================================================
    // TEST 6: getPersonalAnalytics (test analytics)
    // ===================================================================
    console.log('\n🎯 TEST 6: GET /api/sols/analytics/personal (getPersonalAnalytics)');
    try {
      const startTime = Date.now();
      const response = await apiClient.get('/api/sols/analytics/personal', {
        params: { timeframe: 90 }
      });
      const duration = Date.now() - startTime;
      
      console.log(`✅ Status: ${response.status}`);
      console.log(`✅ Durée: ${duration}ms`);
      console.log(`✅ Total sols: ${response.data.data?.analytics?.overview?.totalSols || 0}`);
      
      testResults.push({ name: 'getPersonalAnalytics', passed: true, duration });
    } catch (error) {
      console.log(`❌ ERREUR: ${error.response?.status || error.code}`);
      console.log(`❌ Message: ${error.response?.data?.message || error.message}`);
      testResults.push({ name: 'getPersonalAnalytics', passed: false, error: error.message });
    }
    
    // ===================================================================
    // TEST 7: discoverSols (test découverte)
    // ===================================================================
    console.log('\n🎯 TEST 7: GET /api/sols/discover (discoverSols)');
    try {
      const startTime = Date.now();
      const response = await apiClient.get('/api/sols/discover', {
        params: { 
          type: 'classic',
          currency: 'HTG',
          limit: 5 
        }
      });
      const duration = Date.now() - startTime;
      
      console.log(`✅ Status: ${response.status}`);
      console.log(`✅ Durée: ${duration}ms`);
      console.log(`✅ Sols découverts: ${response.data.data?.sols?.length || 0}`);
      
      testResults.push({ name: 'discoverSols', passed: true, duration });
    } catch (error) {
      console.log(`❌ ERREUR: ${error.response?.status || error.code}`);
      console.log(`❌ Message: ${error.response?.data?.message || error.message}`);
      testResults.push({ name: 'discoverSols', passed: false, error: error.message });
    }
    
    // ===================================================================
    // RAPPORT FINAL DÉTAILLÉ
    // ===================================================================
    console.log('\n' + '='.repeat(60));
    console.log('📊 RAPPORT FINAL DES TESTS SOL');
    console.log('='.repeat(60));
    
    const totalTests = testResults.length;
    const passedTests = testResults.filter(r => r.passed).length;
    const successRate = (passedTests / totalTests) * 100;
    
    console.log(`\n📈 STATISTIQUES GLOBALES:`);
    console.log(`   Tests exécutés: ${totalTests}`);
    console.log(`   Tests réussis: ${passedTests}`);
    console.log(`   Taux de succès: ${successRate.toFixed(1)}%`);
    
    console.log(`\n🔍 DÉTAIL DES TESTS:`);
    testResults.forEach((result, index) => {
      const status = result.passed ? '✅' : '❌';
      const durationInfo = result.duration ? ` (${result.duration}ms)` : '';
      const warningInfo = result.warning ? ` [⚠️ ${result.warning}]` : '';
      
      console.log(`   ${index + 1}. ${status} ${result.name}${durationInfo}${warningInfo}`);
      
      if (!result.passed && result.error) {
        console.log(`      Erreur: ${result.error}`);
      }
    });
    
    console.log(`\n🐛 BUGS IDENTIFIÉS:`);
    
    const accessBugs = testResults.filter(test => 
      !test.passed && test.error && test.error.includes('unauthorized')
    );
    
    const participantBugs = testResults.filter(test =>
      !test.passed && test.error && (
        test.error.includes('not_participant') || 
        test.error.includes('already_participant')
      )
    );
    
    if (accessBugs.length > 0) {
      console.log('   🔍 Problèmes d\'accès détectés dans:');
      accessBugs.forEach(bug => {
        console.log(`      - ${bug.name}: Comparaison ObjectId défectueuse`);
      });
    }
    
    if (participantBugs.length > 0) {
      console.log('   🔍 Problèmes de recherche participant dans:');
      participantBugs.forEach(bug => {
        console.log(`      - ${bug.name}: Méthode find/findIndex avec .toString()`);
      });
    }
    
    if (accessBugs.length === 0 && participantBugs.length === 0) {
      console.log('   ✅ Aucun bug critique identifié');
    }
    
    console.log(`\n🔧 RECOMMANDATIONS:`);
    
    if (successRate === 100) {
      console.log('   🎉 Excellent! Tous les tests passent');
      console.log('   Le contrôleur Sol est fonctionnel');
    } else if (successRate >= 80) {
      console.log('   ⚠️  Bon état, quelques ajustements nécessaires');
      console.log('   Vérifiez les endpoints en échec');
    } else if (successRate >= 50) {
      console.log('   ❗ Problèmes modérés détectés');
      console.log('   Révision recommandée des méthodes problématiques');
    } else {
      console.log('   🚨 État critique! Révision urgente nécessaire');
      console.log('   Vérifiez la logique d\'accès et les comparaisons ObjectId');
    }
    
    console.log(`\n💡 CORRECTIONS SUGGÉRÉES:`);
    console.log('   1. Utiliser .toString() sur req.user.userId dans toutes les comparaisons');
    console.log('   2. Vérifier les méthodes find/findIndex sur les tableaux participants');
    console.log('   3. Tester avec différents types d\'ObjectId (string vs ObjectId)');
    
    console.log('\n' + '='.repeat(60));
    
  } catch (error) {
    console.error('❌ Erreur générale lors des tests:', error.message);
    console.error(error.stack);
  } finally {
    // Nettoyage
    if (mongooseConnection) {
      await mongooseConnection.connection.close();
      console.log('\n🔒 Connexion MongoDB fermée');
    }
  }
};

// Vérification des dépendances
try {
  require('axios');
  require('mongoose');
} catch (e) {
  console.log('❌ Dépendances manquantes. Installez avec:');
  console.log('   npm install axios mongoose dotenv');
  process.exit(1);
}

// Point d'entrée
if (require.main === module) {
  console.log('🚀 Lancement des tests complets du contrôleur Sol...');
  testAllSolMethods();
}

module.exports = { testAllSolMethods };