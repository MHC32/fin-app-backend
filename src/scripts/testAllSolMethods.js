// 🧪 TEST COMPLET CONTRÔLEUR SOL - FINAPP HAITI
// Créer ce fichier: src/scripts/testAllSolMethods.js
// 
// Ce script teste toutes les méthodes pour identifier les incohérences d'accès
// Usage: node src/scripts/testAllSolMethods.js

const axios = require('axios');
const mongoose = require('mongoose');
const User = require('../models/User');
const { verifyAccessToken } = require('../config/jwt');
require('dotenv').config({ path: '.env.local' });

const testAllSolMethods = async () => {
  try {
    console.log('🧪 TEST COMPLET CONTRÔLEUR SOL...\n');
    
    // Configuration
    const userEmail = 'hantzmichaelchery6@gmail.com';
    const solId = '68d4a49ba83fa0d4c1fbe151';
    const baseURL = 'http://localhost:3001';
    
    // Récupérer token valide
    await mongoose.connect(process.env.MONGODB_URI);
    const user = await User.findOne({ email: userEmail });
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
    await mongoose.connection.close();
    
    // Configuration axios
    const apiClient = axios.create({
      baseURL: baseURL,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log('✅ Token récupéré, début des tests...\n');
    
    // ===================================================================
    // TEST 1: getUserSols (devrait fonctionner)
    // ===================================================================
    console.log('🎯 TEST 1: GET /api/sols/ (getUserSols)');
    try {
      const response = await apiClient.get('/api/sols/');
      console.log(`✅ Status: ${response.status}`);
      console.log(`✅ Sols trouvés: ${response.data.data?.sols?.length || 0}`);
      
      if (response.data.data?.sols?.length > 0) {
        const sol = response.data.data.sols[0];
        console.log(`✅ Premier sol: ${sol.name} (${sol._id})`);
        console.log(`✅ Votre rôle: ${sol.userRole}`);
      }
    } catch (error) {
      console.log(`❌ ERREUR: ${error.response?.status} - ${error.response?.data?.message}`);
    }
    
    // ===================================================================
    // TEST 2: getSolById (devrait maintenant fonctionner)
    // ===================================================================
    console.log('\n🎯 TEST 2: GET /api/sols/:id (getSolById)');
    try {
      const response = await apiClient.get(`/api/sols/${solId}`);
      console.log(`✅ Status: ${response.status}`);
      console.log(`✅ Sol: ${response.data.data?.sol?.name}`);
      console.log(`✅ Votre rôle: ${response.data.data?.sol?.userRole}`);
    } catch (error) {
      console.log(`❌ ERREUR: ${error.response?.status} - ${error.response?.data?.message}`);
      console.log(`❌ Error code: ${error.response?.data?.error}`);
    }
    
    // ===================================================================
    // TEST 3: makePayment (va probablement échouer)
    // ===================================================================
    console.log('\n🎯 TEST 3: POST /api/sols/:id/payment (makePayment)');
    try {
      const paymentData = {
        accountId: '507f1f77bcf86cd799439011', // ID fictif pour test
        amount: 2000,
        notes: 'Test payment'
      };
      
      const response = await apiClient.post(`/api/sols/${solId}/payment`, paymentData);
      console.log(`✅ Status: ${response.status}`);
      console.log(`✅ Paiement: ${response.data.success}`);
    } catch (error) {
      console.log(`❌ ERREUR: ${error.response?.status} - ${error.response?.data?.message}`);
      console.log(`❌ Error code: ${error.response?.data?.error}`);
      
      if (error.response?.data?.error === 'unauthorized_sol_access') {
        console.log('🔍 BUG D\'ACCÈS CONFIRMÉ dans makePayment !');
      } else if (error.response?.data?.error === 'not_participant') {
        console.log('🔍 BUG DE RECHERCHE PARTICIPANT dans makePayment !');
      } else if (error.response?.data?.error === 'account_not_found') {
        console.log('✅ Logique d\'accès OK - Erreur attendue (compte fictif)');
      }
    }
    
    // ===================================================================
    // TEST 4: joinSol avec code existant (test d'accès)
    // ===================================================================
    console.log('\n🎯 TEST 4: POST /api/sols/join (joinSol)');
    try {
      const joinData = {
        accessCode: 'A1KZPD' // Code du sol existant
      };
      
      const response = await apiClient.post('/api/sols/join', joinData);
      console.log(`✅ Status: ${response.status}`);
    } catch (error) {
      console.log(`❌ ERREUR: ${error.response?.status} - ${error.response?.data?.message}`);
      console.log(`❌ Error code: ${error.response?.data?.error}`);
      
      if (error.response?.data?.error === 'already_participant') {
        console.log('✅ Logique correcte - Déjà participant');
      }
    }
    
    // ===================================================================
    // TEST 5: leaveSol (test d'accès)
    // ===================================================================
    console.log('\n🎯 TEST 5: DELETE /api/sols/:id/leave (leaveSol)');
    try {
      const leaveData = {
        reason: 'Test de départ'
      };
      
      const response = await apiClient.delete(`/api/sols/${solId}/leave`, { data: leaveData });
      console.log(`✅ Status: ${response.status}`);
    } catch (error) {
      console.log(`❌ ERREUR: ${error.response?.status} - ${error.response?.data?.message}`);
      console.log(`❌ Error code: ${error.response?.data?.error}`);
      
      if (error.response?.data?.error === 'not_participant') {
        console.log('🔍 POSSIBLE BUG DE RECHERCHE PARTICIPANT dans leaveSol !');
      } else if (error.response?.data?.error === 'creator_cannot_leave_active_sol') {
        console.log('✅ Logique correcte - Créateur ne peut pas quitter');
      }
    }
    
    // ===================================================================
    // RÉSUMÉ DES TESTS
    // ===================================================================
    console.log('\n📊 ========== RÉSUMÉ DES TESTS ==========');
    console.log('TEST 1 (getUserSols): Devrait fonctionner ✅');
    console.log('TEST 2 (getSolById): Devrait fonctionner après fix ✅'); 
    console.log('TEST 3 (makePayment): Probablement buggé ❌');
    console.log('TEST 4 (joinSol): À vérifier 🔍');
    console.log('TEST 5 (leaveSol): À vérifier 🔍');
    
    console.log('\n🔧 FIXES NÉCESSAIRES:');
    console.log('1. makePayment: Ajouter hasAccess + fix comparaisons ObjectId');
    console.log('2. leaveSol: Vérifier la logique findIndex participant');
    console.log('3. joinSol: Vérifier la logique alreadyMember');
    
    console.log('\n💡 PATTERN DU BUG:');
    console.log('Toutes les méthodes qui comparent req.user.userId avec des ObjectId');
    console.log('doivent utiliser .toString() sur req.user.userId');
    
  } catch (error) {
    console.error('❌ Erreur générale:', error.message);
  }
};

// Vérifier si axios est installé
try {
  require('axios');
} catch (e) {
  console.log('❌ Axios non installé. Installez avec: npm install axios');
  process.exit(1);
}

testAllSolMethods();