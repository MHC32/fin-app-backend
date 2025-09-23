// 🔍 SCRIPT DE DIAGNOSTIC AUTHENTIFICATION FINAPP HAITI
// Créer ce fichier: src/scripts/diagAuthDebug.js

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const authService = require('../services/authService');
const { 
  verifyAccessToken, 
  extractBearerToken, 
  generateTokenPair,
  JWT_CONFIG 
} = require('../config/jwt');
require('dotenv').config({ path: '.env.local' });

/**
 * DIAGNOSTIC COMPLET AUTHENTIFICATION
 * 
 * Ce script teste TOUS les points de défaillance possible :
 * 1. Configuration JWT
 * 2. Génération tokens
 * 3. Vérification tokens
 * 4. Sessions utilisateurs
 * 5. Base de données User
 * 
 * Usage: node src/scripts/diagAuthDebug.js
 */

console.log('🔍 === DIAGNOSTIC AUTHENTIFICATION FINAPP HAITI ===\n');

// ===================================================================
// 1. DIAGNOSTIC CONFIGURATION JWT
// ===================================================================

const diagJWTConfig = () => {
  console.log('1️⃣ DIAGNOSTIC CONFIGURATION JWT:');
  
  try {
    console.log('✅ JWT_CONFIG exists:', !!JWT_CONFIG);
    console.log('✅ ACCESS_SECRET length:', JWT_CONFIG?.ACCESS_SECRET?.length || 'UNDEFINED');
    console.log('✅ REFRESH_SECRET length:', JWT_CONFIG?.REFRESH_SECRET?.length || 'UNDEFINED');
    console.log('✅ ACCESS_EXPIRES_IN:', JWT_CONFIG?.ACCESS_EXPIRES_IN || 'UNDEFINED');
    console.log('✅ REFRESH_EXPIRES_IN:', JWT_CONFIG?.REFRESH_EXPIRES_IN || 'UNDEFINED');
    console.log('✅ ALGORITHM:', JWT_CONFIG?.ALGORITHM || 'UNDEFINED');
    console.log('✅ ISSUER:', JWT_CONFIG?.ISSUER || 'UNDEFINED');
    console.log('✅ AUDIENCE:', JWT_CONFIG?.AUDIENCE || 'UNDEFINED');
    
    // Vérifier si les secrets sont des placeholders
    if (JWT_CONFIG?.ACCESS_SECRET?.includes('dev_secret') || JWT_CONFIG?.ACCESS_SECRET?.length < 32) {
      console.log('⚠️  WARNING: ACCESS_SECRET semble être un placeholder ou trop court');
    }
    
    console.log('✅ Configuration JWT: OK\n');
    return true;
  } catch (error) {
    console.log('❌ ERREUR Configuration JWT:', error.message);
    return false;
  }
};

// ===================================================================
// 2. DIAGNOSTIC GÉNÉRATION TOKENS
// ===================================================================

const diagTokenGeneration = () => {
  console.log('2️⃣ DIAGNOSTIC GÉNÉRATION TOKENS:');
  
  try {
    // Test utilisateur fictif
    const testUser = {
      _id: '507f1f77bcf86cd799439011',
      email: 'test@example.com',
      role: 'user'
    };
    
    const testDeviceInfo = {
      userAgent: 'Test-Agent',
      ip: '127.0.0.1',
      device: 'desktop'
    };
    
    console.log('📝 Génération tokens de test...');
    const tokens = generateTokenPair(testUser, testDeviceInfo);
    
    console.log('✅ Access Token généré:', !!tokens.accessToken);
    console.log('✅ Refresh Token généré:', !!tokens.refreshToken);
    console.log('✅ Session ID:', tokens.sessionId);
    console.log('✅ Device ID:', tokens.deviceId);
    console.log('✅ Access Expires:', new Date(tokens.accessExpiresIn).toISOString());
    console.log('✅ Refresh Expires:', new Date(tokens.refreshExpiresIn).toISOString());
    
    // Test décodage
    const decoded = jwt.decode(tokens.accessToken, { complete: true });
    console.log('✅ Token décodable:', !!decoded);
    console.log('✅ Payload userId:', decoded?.payload?.userId);
    console.log('✅ Payload sessionId:', decoded?.payload?.sessionId);
    console.log('✅ Token expiration:', new Date(decoded?.payload?.exp * 1000).toISOString());
    
    console.log('✅ Génération Tokens: OK\n');
    return { tokens, decoded };
  } catch (error) {
    console.log('❌ ERREUR Génération Tokens:', error.message);
    console.log('❌ Stack:', error.stack);
    return null;
  }
};

// ===================================================================
// 3. DIAGNOSTIC VÉRIFICATION TOKENS
// ===================================================================

const diagTokenVerification = (testTokens) => {
  console.log('3️⃣ DIAGNOSTIC VÉRIFICATION TOKENS:');
  
  if (!testTokens) {
    console.log('❌ Pas de tokens de test disponibles\n');
    return false;
  }
  
  try {
    // Test vérification access token
    console.log('📝 Vérification access token...');
    const verification = verifyAccessToken(testTokens.tokens.accessToken);
    
    console.log('✅ Token valide:', verification.isValid);
    console.log('✅ Token expiré:', verification.expired);
    console.log('✅ Payload userId:', verification.payload?.userId);
    console.log('✅ Payload sessionId:', verification.payload?.sessionId);
    
    if (!verification.isValid) {
      console.log('❌ Erreur vérification:', verification.error);
    }
    
    // Test extraction Bearer
    const authHeader = `Bearer ${testTokens.tokens.accessToken}`;
    const extractedToken = extractBearerToken(authHeader);
    console.log('✅ Extraction Bearer:', extractedToken === testTokens.tokens.accessToken);
    
    console.log('✅ Vérification Tokens: OK\n');
    return true;
  } catch (error) {
    console.log('❌ ERREUR Vérification Tokens:', error.message);
    return false;
  }
};

// ===================================================================
// 4. DIAGNOSTIC DATABASE & USER MODEL
// ===================================================================

const diagDatabase = async () => {
  console.log('4️⃣ DIAGNOSTIC DATABASE & USER MODEL:');
  
  try {
    const mongoose = require('mongoose');
    
    // Test connexion
    console.log('📝 Test connexion MongoDB...');
    console.log('✅ MongoDB état:', mongoose.connection.readyState); // 0=disconnected, 1=connected
    
    if (mongoose.connection.readyState !== 1) {
      console.log('⚠️  MongoDB pas connecté, connexion...');
      await mongoose.connect(process.env.MONGODB_URI);
    }
    
    // Test User model
    console.log('📝 Test User model...');
    const userCount = await User.countDocuments();
    console.log('✅ Nombre d\'utilisateurs:', userCount);
    
    // Test utilisateur récent avec sessions
    const recentUser = await User.findOne().sort({ createdAt: -1 });
    if (recentUser) {
      console.log('✅ Utilisateur récent trouvé:', recentUser.email);
      console.log('✅ Sessions actives:', recentUser.activeSessions?.length || 0);
      console.log('✅ Refresh tokens:', recentUser.refreshTokens?.length || 0);
      console.log('✅ Account actif:', recentUser.isActive);
      
      // Analyser sessions
      if (recentUser.activeSessions?.length > 0) {
        const session = recentUser.activeSessions[0];
        console.log('✅ Session sample ID:', session.sessionId);
        console.log('✅ Session active:', session.isActive);
        console.log('✅ Session expires:', session.expiresAt);
        console.log('✅ Session expired?:', session.expiresAt < new Date());
      }
    } else {
      console.log('⚠️  Aucun utilisateur trouvé en base');
    }
    
    console.log('✅ Database: OK\n');
    return true;
  } catch (error) {
    console.log('❌ ERREUR Database:', error.message);
    return false;
  }
};

// ===================================================================
// 5. DIAGNOSTIC AUTHSERVICE COMPLET
// ===================================================================

const diagAuthService = async () => {
  console.log('5️⃣ DIAGNOSTIC AUTHSERVICE:');
  
  try {
    // Test avec vraie données utilisateur de la DB
    const testUser = await User.findOne().sort({ createdAt: -1 });
    
    if (!testUser) {
      console.log('⚠️  Pas d\'utilisateur pour test authService');
      return false;
    }
    
    console.log('📝 Test authService avec utilisateur:', testUser.email);
    
    // Générer un vrai token pour cet utilisateur
    const tokens = generateTokenPair(testUser, { 
      userAgent: 'Debug-Test',
      ip: '127.0.0.1',
      device: 'desktop'
    });
    
    // Ajouter session à l'utilisateur
    await testUser.addSession({
      sessionId: tokens.sessionId,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      deviceInfo: {
        userAgent: 'Debug-Test',
        ip: '127.0.0.1',
        device: 'desktop'
      },
      expiresAt: new Date(tokens.refreshExpiresIn)
    });
    
    console.log('✅ Session ajoutée à l\'utilisateur');
    
    // Test validateAccessToken
    const authHeader = `Bearer ${tokens.accessToken}`;
    console.log('📝 Test validateAccessToken...');
    
    const result = await authService.validateAccessToken(authHeader);
    
    console.log('✅ Validation success:', result.success);
    if (!result.success) {
      console.log('❌ Erreur validation:', result.error);
    } else {
      console.log('✅ User ID:', result.user?.id);
      console.log('✅ Session ID:', result.session?.sessionId);
      console.log('✅ Token expiring soon:', result.tokenInfo?.expiringSoon);
    }
    
    console.log('✅ AuthService: OK\n');
    return true;
  } catch (error) {
    console.log('❌ ERREUR AuthService:', error.message);
    console.log('❌ Stack:', error.stack);
    return false;
  }
};

// ===================================================================
// 6. DIAGNOSTIC AVEC TOKEN UTILISATEUR RÉEL
// ===================================================================

const diagRealUserToken = async () => {
  console.log('6️⃣ DIAGNOSTIC TOKEN UTILISATEUR RÉEL:');
  
  try {
    // Trouver utilisateur avec email de test
    const testEmail = 'hantzmichaelchery6@gmail.com';
    const user = await User.findOne({ email: testEmail });
    
    if (!user) {
      console.log('❌ Utilisateur test non trouvé:', testEmail);
      return false;
    }
    
    console.log('✅ Utilisateur trouvé:', user.email);
    console.log('✅ User ID:', user._id);
    console.log('✅ Account actif:', user.isActive);
    console.log('✅ Sessions actives:', user.activeSessions?.length || 0);
    
    // Analyser sessions existantes
    if (user.activeSessions?.length > 0) {
      console.log('\n📋 ANALYSE SESSIONS EXISTANTES:');
      user.activeSessions.forEach((session, index) => {
        console.log(`Session ${index + 1}:`);
        console.log(`  - ID: ${session.sessionId}`);
        console.log(`  - Active: ${session.isActive}`);
        console.log(`  - Expires: ${session.expiresAt}`);
        console.log(`  - Expired: ${session.expiresAt < new Date()}`);
        console.log(`  - Device: ${session.deviceInfo?.device || 'unknown'}`);
        
        // Test si ce token est valide
        if (session.accessToken) {
          try {
            const verification = verifyAccessToken(session.accessToken);
            console.log(`  - Token valid: ${verification.isValid}`);
            console.log(`  - Token expired: ${verification.expired}`);
            if (!verification.isValid) {
              console.log(`  - Error: ${verification.error}`);
            }
          } catch (e) {
            console.log(`  - Token test error: ${e.message}`);
          }
        }
        console.log('');
      });
    }
    
    console.log('✅ Diagnostic utilisateur réel: OK\n');
    return true;
  } catch (error) {
    console.log('❌ ERREUR Diagnostic utilisateur réel:', error.message);
    return false;
  }
};

// ===================================================================
// LANCEMENT DIAGNOSTIC COMPLET
// ===================================================================

const runFullDiagnostic = async () => {
  console.log('🚀 DÉMARRAGE DIAGNOSTIC COMPLET...\n');
  
  const results = {
    jwtConfig: false,
    tokenGeneration: false,
    tokenVerification: false,
    database: false,
    authService: false,
    realUser: false
  };
  
  try {
    // Connexion DB d'abord
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('✅ Connexion MongoDB établie\n');
    }
    
    // Diagnostic étape par étape
    results.jwtConfig = diagJWTConfig();
    
    const tokenTest = diagTokenGeneration();
    results.tokenGeneration = !!tokenTest;
    
    results.tokenVerification = diagTokenVerification(tokenTest);
    results.database = await diagDatabase();
    results.authService = await diagAuthService();
    results.realUser = await diagRealUserToken();
    
    // Résumé final
    console.log('📊 === RÉSUMÉ DIAGNOSTIC ===');
    console.log('Configuration JWT:', results.jwtConfig ? '✅ OK' : '❌ ERREUR');
    console.log('Génération Tokens:', results.tokenGeneration ? '✅ OK' : '❌ ERREUR');
    console.log('Vérification Tokens:', results.tokenVerification ? '✅ OK' : '❌ ERREUR');
    console.log('Database/User Model:', results.database ? '✅ OK' : '❌ ERREUR');
    console.log('AuthService:', results.authService ? '✅ OK' : '❌ ERREUR');
    console.log('Utilisateur Réel:', results.realUser ? '✅ OK' : '❌ ERREUR');
    
    const successCount = Object.values(results).filter(Boolean).length;
    console.log(`\n🎯 SCORE: ${successCount}/6 tests réussis`);
    
    if (successCount === 6) {
      console.log('🎉 TOUS LES TESTS PASSENT - Le problème est ailleurs');
    } else {
      console.log('🔍 PROBLÈMES DÉTECTÉS - Voir détails ci-dessus');
    }
    
  } catch (error) {
    console.log('❌ ERREUR DIAGNOSTIC GLOBAL:', error.message);
    console.log('❌ Stack:', error.stack);
  }
  
  process.exit(0);
};

// Lancer le diagnostic
runFullDiagnostic();