// 🧪 TEST API SOL AVEC FETCH NATIF - FINAPP HAITI
// Créer ce fichier: src/scripts/testSolApiFetch.js
// 
// Version sans axios - utilise fetch natif Node.js 18+
// Usage: node src/scripts/testSolApiFetch.js

const mongoose = require('mongoose');
const User = require('../models/User');
const { verifyAccessToken } = require('../config/jwt');
require('dotenv').config({ path: '.env.local' });

const testSolApiWithFetch = async () => {
  try {
    console.log('🧪 TEST API SOL AVEC FETCH NATIF...\n');
    
    // Vérifier version Node.js
    const nodeVersion = process.version;
    console.log('📋 Node.js version:', nodeVersion);
    
    if (parseInt(nodeVersion.split('.')[0].substring(1)) < 18) {
      console.log('❌ Node.js 18+ requis pour fetch natif');
      console.log('💡 Utilisez: npm install axios (temporaire)');
      console.log('💡 Ou mettez à jour Node.js');
      return;
    }
    
    // Connexion MongoDB pour récupérer le token
    await mongoose.connect(process.env.MONGODB_URI);
    
    const userEmail = 'hantzmichaelchery6@gmail.com';
    const solId = '68d4a49ba83fa0d4c1fbe151';
    const baseURL = 'http://localhost:3001';
    
    // Récupérer le token valide
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
    console.log('✅ Token récupéré');
    
    // Fermer connexion MongoDB
    await mongoose.connection.close();
    
    // Headers par défaut
    const defaultHeaders = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'FinApp-Test-Script/1.0'
    };
    
    console.log('🎯 TEST 1: GET Sol par ID...');
    console.log(`URL: ${baseURL}/api/sols/${solId}?includeHistory=true`);
    
    try {
      const response = await fetch(`${baseURL}/api/sols/${solId}?includeHistory=true`, {
        method: 'GET',
        headers: defaultHeaders
      });
      
      console.log('📡 Status:', response.status);
      console.log('📡 Status Text:', response.statusText);
      
      const responseData = await response.json();
      
      if (response.ok) {
        console.log('✅ SUCCÈS');
        console.log('✅ Success:', responseData.success);
        
        if (responseData.success) {
          console.log('📊 DONNÉES REÇUES:');
          console.log(`  🆔 Sol ID: ${responseData.data.sol._id}`);
          console.log(`  📝 Nom: ${responseData.data.sol.name}`);
          console.log(`  👑 Votre rôle: ${responseData.data.sol.userRole}`);
          console.log(`  📊 Statut: ${responseData.data.sol.status}`);
          console.log(`  👥 Participants: ${responseData.data.sol.participants?.length || 0}`);
          
          if (responseData.data.transactionHistory) {
            console.log(`  📋 Historique inclus: ✅`);
          }
        }
        
      } else {
        console.log('❌ ERREUR API:');
        console.log('Status:', response.status);
        console.log('Message:', responseData.message);
        console.log('Error:', responseData.error);
        
        if (response.status === 403) {
          console.log('\n🔍 ANALYSE ERREUR 403:');
          console.log('- Le token est valide mais l\'accès est refusé');
          console.log('- Problème probable dans le contrôleur getSolById');
          console.log('- Vérification hasAccess qui échoue côté serveur');
          
          console.log('\n🛠️ DEBUG RECOMMANDÉ:');
          console.log('1. Ajouter des console.log dans src/controllers/solController.js');
          console.log('2. Dans la méthode getSolById, ligne ~65');
          console.log('3. Logger les variables : sol.creator._id, req.user.userId, hasAccess');
        }
        
        if (response.status === 401) {
          console.log('\n🔍 ANALYSE ERREUR 401:');
          console.log('- Problème d\'authentification');
          console.log('- Token invalide ou middleware qui échoue');
        }
      }
      
    } catch (fetchError) {
      console.log('❌ ERREUR FETCH:', fetchError.message);
      
      if (fetchError.message.includes('ECONNREFUSED')) {
        console.log('💡 Serveur non démarré. Lancez: npm run dev');
      }
    }
    
    console.log('\n🎯 TEST 2: GET Liste des sols utilisateur...');
    
    try {
      const response = await fetch(`${baseURL}/api/sols/`, {
        method: 'GET',
        headers: defaultHeaders
      });
      
      const responseData = await response.json();
      
      if (response.ok) {
        console.log('✅ SUCCÈS - Status:', response.status);
        console.log('📊 Sols trouvés:', responseData.data?.sols?.length || 0);
        
        if (responseData.data?.sols?.length > 0) {
          responseData.data.sols.forEach((sol, index) => {
            console.log(`  Sol ${index + 1}: ${sol.name} (${sol._id})`);
          });
        }
      } else {
        console.log('❌ ERREUR Liste sols - Status:', response.status);
      }
      
    } catch (fetchError) {
      console.log('❌ ERREUR Liste sols:', fetchError.message);
    }
    
    console.log('\n🎯 TEST 3: Validation token direct...');
    
    try {
      const response = await fetch(`${baseURL}/api/users/profile`, {
        method: 'GET',
        headers: defaultHeaders
      });
      
      const responseData = await response.json();
      
      if (response.ok) {
        console.log('✅ Token valide - Profile accessible');
        console.log('👤 Utilisateur:', responseData.data?.firstName, responseData.data?.lastName);
      } else {
        console.log('❌ Token invalide ou profile inaccessible - Status:', response.status);
      }
      
    } catch (fetchError) {
      console.log('❌ ERREUR Profile:', fetchError.message);
    }
    
    console.log('\n📋 RÉSUMÉ:');
    console.log('- Si Test 1 échoue (403) mais Tests 2 & 3 réussissent → Bug dans getSolById');
    console.log('- Si tous les tests échouent → Problème authentification globale');
    console.log('- Si Test 1 réussit → Le problème vient du frontend/navigateur');
    console.log('- Si ECONNREFUSED → Serveur pas démarré');
    
  } catch (error) {
    console.error('❌ Erreur générale:', error.message);
  }
};

testSolApiWithFetch();