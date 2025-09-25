// 🔑 EXTRACTION TOKEN VALIDE - FINAPP HAITI
// Créer ce fichier: src/scripts/extractValidToken.js
// 
// Ce script extrait votre token JWT valide pour utilisation dans Postman
// Usage: node src/scripts/extractValidToken.js

const mongoose = require('mongoose');
const User = require('../models/User');
const { verifyAccessToken } = require('../config/jwt');
require('dotenv').config({ path: '.env.local' });

const extractValidToken = async () => {
  try {
    console.log('🔑 EXTRACTION TOKEN VALIDE...\n');
    
    // Connexion MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connecté\n');
    
    const userEmail = 'hantzmichaelchery6@gmail.com';
    
    // Récupérer l'utilisateur
    const user = await User.findOne({ email: userEmail });
    if (!user) {
      console.log('❌ Utilisateur non trouvé:', userEmail);
      return;
    }
    
    console.log('👤 UTILISATEUR:', user.firstName, user.lastName);
    console.log('🔄 Sessions actives:', user.activeSessions.length);
    console.log('');
    
    // Chercher le token valide (comme identifié dans le diagnostic)
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
      console.log('💡 Reconnectez-vous à l\'application pour générer un nouveau token');
      return;
    }
    
    console.log('✅ TOKEN VALIDE TROUVÉ:');
    console.log('🆔 Session ID:', validSession.sessionId);
    console.log('⏰ Expire le:', validSession.expiresAt);
    console.log('📱 Device:', validSession.deviceInfo?.device);
    console.log('');
    
    console.log('🔑 TOKEN JWT (pour Postman):');
    console.log('━'.repeat(80));
    console.log(validSession.accessToken);
    console.log('━'.repeat(80));
    console.log('');
    
    console.log('📋 INSTRUCTIONS POSTMAN:');
    console.log('1. Copiez le token ci-dessus');
    console.log('2. Dans Postman, allez dans l\'onglet "Authorization"');
    console.log('3. Sélectionnez "Bearer Token"');
    console.log('4. Collez le token dans le champ "Token"');
    console.log('5. Envoyez votre requête GET');
    console.log('');
    
    console.log('🧪 REQUÊTE POSTMAN COMPLÈTE:');
    console.log('Method: GET');
    console.log('URL: http://localhost:3001/api/sols/68d4a49ba83fa0d4c1fbe151?includeHistory=true');
    console.log('Headers:');
    console.log('  Authorization: Bearer ' + validSession.accessToken.substring(0, 50) + '...');
    console.log('  Content-Type: application/json');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Extraction terminée');
  }
};

extractValidToken();