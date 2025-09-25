// src/scripts/testRealApiAuth.js
// 🔬 TEST AUTHENTIFICATION API RÉELLE

const axios = require('axios');
const mongoose = require('mongoose');
const User = require('../models/User');
const { verifyAccessToken } = require('../config/jwt');
require('dotenv').config({ path: '.env.local' });

const API_BASE_URL = 'http://localhost:3001/api';

const testRealApiAuth = async () => {
  try {
    console.log('🔬 TEST AUTHENTIFICATION API RÉELLE\n');
    
    // Connexion MongoDB pour récupérer un token valide
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connecté\n');
    
    // Récupérer l'utilisateur et son token
    const user = await User.findOne({ email: 'hantzmichaelchery6@gmail.com' });
    
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
      console.log('❌ Aucune session valide trouvée');
      return;
    }
    
    const token = validSession.accessToken;
    console.log('✅ Token récupéré\n');
    
    // Décoder le token pour voir son contenu
    const jwt = require('jsonwebtoken');
    const decoded = jwt.decode(token);
    console.log('📋 CONTENU DU TOKEN:');
    console.log(JSON.stringify(decoded, null, 2));
    console.log('');
    
    // TEST 1: Vérifier le token via l'API
    console.log('1️⃣ TEST /api/auth/verify-token:');
    try {
      const verifyResponse = await axios.get(`${API_BASE_URL}/auth/verify-token`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('✅ Status:', verifyResponse.status);
      console.log('✅ Success:', verifyResponse.data.success);
      console.log('✅ User ID reçu:', verifyResponse.data.data?.user?.userId);
      console.log('✅ User ID du token:', decoded.userId);
      console.log('✅ Match:', verifyResponse.data.data?.user?.userId === decoded.userId);
      console.log('');
    } catch (error) {
      console.log('❌ Erreur:', error.response?.status, error.response?.data?.message);
      console.log('');
    }
    
    // TEST 2: Accéder au sol spécifique
    const testSolId = '68d4a49ba83fa0d4c1fbe151';
    console.log(`2️⃣ TEST /api/sols/${testSolId}:`);
    
    try {
      const solResponse = await axios.get(`${API_BASE_URL}/sols/${testSolId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('✅ Status:', solResponse.status);
      console.log('✅ Sol trouvé:', solResponse.data.data?.sol?.name);
      console.log('✅ Votre rôle:', solResponse.data.data?.sol?.userRole);
      console.log('');
    } catch (error) {
      console.log('❌ Status:', error.response?.status);
      console.log('❌ Message:', error.response?.data?.message);
      console.log('❌ Error code:', error.response?.data?.error);
      
      // Debug approfondi si 403
      if (error.response?.status === 403) {
        console.log('\n🔍 DEBUG DÉTAILLÉ ERREUR 403:');
        console.log('Token userId:', decoded.userId);
        console.log('Token userId type:', typeof decoded.userId);
        
        // Vérifier avec la base de données
        const Sol = require('../models/Sol');
        const sol = await Sol.findById(testSolId)
          .populate('creator', '_id')
          .populate('participants.user', '_id');
        
        if (sol) {
          console.log('Sol creator._id:', sol.creator._id.toString());
          console.log('Match créateur:', sol.creator._id.toString() === decoded.userId);
          
          const participantMatch = sol.participants.some(p => 
            p.user._id.toString() === decoded.userId
          );
          console.log('Match participant:', participantMatch);
          
          if (!participantMatch && sol.creator._id.toString() !== decoded.userId) {
            console.log('\n💡 PROBLÈME: req.user.userId dans le contrôleur ne correspond pas!');
            console.log('Possible cause: Le middleware n\'injecte pas correctement userId');
          }
        }
      }
      console.log('');
    }
    
    // TEST 3: Lister les sols (pour comparer)
    console.log('3️⃣ TEST /api/sols/ (getUserSols):');
    try {
      const solsResponse = await axios.get(`${API_BASE_URL}/sols/`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('✅ Status:', solsResponse.status);
      console.log('✅ Nombre de sols:', solsResponse.data.data?.sols?.length);
      
      if (solsResponse.data.data?.sols?.length > 0) {
        const firstSol = solsResponse.data.data.sols[0];
        console.log('✅ Premier sol ID:', firstSol._id);
        console.log('✅ Votre rôle:', firstSol.userRole);
      }
      console.log('');
    } catch (error) {
      console.log('❌ Erreur:', error.response?.status, error.response?.data?.message);
      console.log('');
    }
    
    // TEST 4: Ajouter des logs dans le middleware (suggestion)
    console.log('💡 RECOMMANDATIONS:');
    console.log('1. Ajoutez des console.log dans authenticate middleware:');
    console.log('   console.log("req.user.userId:", req.user.userId)');
    console.log('   console.log("req.user.userId type:", typeof req.user.userId)');
    console.log('');
    console.log('2. Ajoutez des console.log dans getSolById:');
    console.log('   console.log("sol.creator._id:", sol.creator._id)');
    console.log('   console.log("req.user.userId:", req.user.userId)');
    console.log('');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('✅ Test terminé');
  }
};

testRealApiAuth();