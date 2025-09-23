// SCRIPT DEBUG SESSION VALIDATION
// Créer: src/scripts/debugSession.js

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { verifyAccessToken, extractBearerToken } = require('../config/jwt');
require('dotenv').config({ path: '.env.local' });

/**
 * DEBUG PRÉCIS DE LA VALIDATION SESSION
 * Ce script va identifier exactement pourquoi la session est considérée comme invalide
 */

const debugSessionValidation = async () => {
  console.log('🔍 === DEBUG SESSION VALIDATION ===\n');
  
  try {
    // Connecter à MongoDB
    const mongoose = require('mongoose');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connecté\n');
    
    // 1. Trouver l'utilisateur de test
    const testUser = await User.findOne({ email: 'hantzmichaelchery6@gmail.com' });
    
    if (!testUser) {
      console.log('❌ Utilisateur de test non trouvé');
      return;
    }
    
    console.log('👤 UTILISATEUR TROUVÉ:');
    console.log('Email:', testUser.email);
    console.log('ID:', testUser._id);
    console.log('Sessions actives:', testUser.activeSessions?.length || 0);
    console.log('');
    
    // 2. Analyser chaque session active
    console.log('📋 ANALYSE SESSIONS EXISTANTES:');
    testUser.activeSessions.forEach((session, index) => {
      console.log(`Session ${index + 1}:`);
      console.log(`  ID: ${session.sessionId}`);
      console.log(`  Active: ${session.isActive}`);
      console.log(`  Expires: ${session.expiresAt}`);
      console.log(`  Expired: ${session.expiresAt < new Date()}`);
      
      if (session.accessToken) {
        // Décoder le token pour voir son contenu
        const decoded = jwt.decode(session.accessToken);
        console.log(`  Token sessionId: ${decoded?.sessionId}`);
        console.log(`  Token userId: ${decoded?.userId}`);
        console.log(`  Token exp: ${new Date(decoded?.exp * 1000).toISOString()}`);
        
        // Vérifier si token valide
        const verification = verifyAccessToken(session.accessToken);
        console.log(`  Token verification: ${verification.isValid}`);
        if (!verification.isValid) {
          console.log(`  Token error: ${verification.error}`);
        }
      }
      console.log('');
    });
    
    // 3. Test avec le dernier token généré (simulation)
    console.log('🧪 TEST SIMULATION VALIDATEACCESSTOKEN:');
    
    // Prendre la session la plus récente avec token valide
    const validSession = testUser.activeSessions.find(s => {
      if (!s.accessToken) return false;
      const verification = verifyAccessToken(s.accessToken);
      return verification.isValid;
    });
    
    if (!validSession) {
      console.log('❌ Aucune session avec token valide trouvée');
      return;
    }
    
    console.log('🎯 SESSION DE TEST:');
    console.log('Session ID:', validSession.sessionId);
    console.log('Token valide:', !!validSession.accessToken);
    
    // 4. Simulation exacte de validateAccessToken
    console.log('\n🔬 SIMULATION VALIDATEACCESSTOKEN:');
    
    const authHeader = `Bearer ${validSession.accessToken}`;
    
    // Étape 1: Extraire token
    const token = extractBearerToken(authHeader);
    console.log('Step 1 - Token extrait:', !!token);
    
    // Étape 2: Vérifier token JWT
    const verification = verifyAccessToken(token);
    console.log('Step 2 - Token verification:', verification.isValid);
    
    if (!verification.isValid) {
      console.log('❌ Token invalide:', verification.error);
      return;
    }
    
    const { userId, sessionId } = verification.payload;
    console.log('Step 3 - Payload userId:', userId);
    console.log('Step 3 - Payload sessionId:', sessionId);
    
    // Étape 3: Trouver utilisateur
    const user = await User.findById(userId);
    console.log('Step 4 - User trouvé:', !!user);
    console.log('Step 4 - User actif:', user?.isActive);
    
    // Étape 4: POINT CRITIQUE - Vérifier session active
    console.log('\n🎯 POINT CRITIQUE - RECHERCHE SESSION:');
    console.log('SessionId recherché:', sessionId);
    console.log('Sessions disponibles:');
    
    user.activeSessions.forEach((s, index) => {
      console.log(`  Session ${index + 1}: ${s.sessionId} (active: ${s.isActive})`);
      console.log(`    Correspond: ${s.sessionId === sessionId}`);
      console.log(`    Active: ${s.isActive}`);
      console.log(`    Match ET active: ${s.sessionId === sessionId && s.isActive}`);
    });
    
    // Test de la recherche exacte
    const session = user.activeSessions.find(s => s.sessionId === sessionId && s.isActive);
    console.log('\n🔍 RÉSULTAT RECHERCHE:');
    console.log('Session trouvée:', !!session);
    
    if (!session) {
      console.log('❌ PROBLÈME: Session non trouvée');
      console.log('Possible causes:');
      console.log('1. sessionId ne correspond pas');
      console.log('2. session.isActive = false');
      console.log('3. Type mismatch (string vs ObjectId)');
      
      // Debug approfondi
      console.log('\n🔬 DEBUG APPROFONDI:');
      const sessionIdFromToken = sessionId;
      const sessionsIds = user.activeSessions.map(s => s.sessionId);
      
      console.log('SessionId du token (type):', typeof sessionIdFromToken);
      console.log('SessionId du token (value):', sessionIdFromToken);
      console.log('Sessions en base (types):', sessionsIds.map(id => typeof id));
      console.log('Sessions en base (values):', sessionsIds);
      
      // Test de comparaison exacte
      sessionsIds.forEach((id, index) => {
        console.log(`Session ${index + 1} comparison:`);
        console.log(`  DB: "${id}" (${typeof id})`);
        console.log(`  Token: "${sessionIdFromToken}" (${typeof sessionIdFromToken})`);
        console.log(`  Equal: ${id === sessionIdFromToken}`);
        console.log(`  String equal: "${id}" === "${sessionIdFromToken}" = ${String(id) === String(sessionIdFromToken)}`);
      });
      
    } else {
      console.log('✅ Session trouvée avec succès!');
      console.log('SessionId:', session.sessionId);
      console.log('Active:', session.isActive);
    }
    
  } catch (error) {
    console.error('❌ Erreur debug:', error.message);
    console.error('Stack:', error.stack);
  }
  
  process.exit(0);
};

// Lancer le debug
debugSessionValidation();