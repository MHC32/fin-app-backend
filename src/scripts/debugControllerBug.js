// 🐛 DEBUG BUG CONTRÔLEUR getSolById - FINAPP HAITI
// Créer ce fichier: src/scripts/debugControllerBug.js
// 
// Ce script reproduit exactement la logique du contrôleur pour identifier le bug
// Usage: node src/scripts/debugControllerBug.js

const mongoose = require('mongoose');
const Sol = require('../models/Sol');
const User = require('../models/User');
const { verifyAccessToken } = require('../config/jwt');
const authService = require('../services/authService');
require('dotenv').config({ path: '.env.local' });

const debugControllerBug = async () => {
  try {
    console.log('🐛 DEBUG BUG CONTRÔLEUR getSolById...\n');
    
    // Connexion MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connecté\n');
    
    const userEmail = 'hantzmichaelchery6@gmail.com';
    const solId = '68d4a49ba83fa0d4c1fbe151';
    
    // 1. SIMULER L'AUTHENTIFICATION MIDDLEWARE
    console.log('1️⃣ SIMULATION MIDDLEWARE AUTHENTICATE:');
    
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
    
    const token = validSession.accessToken;
    const authHeader = `Bearer ${token}`;
    
    // Validation comme le middleware
    const validation = await authService.validateAccessToken(authHeader);
    
    console.log('✅ Middleware simulation:');
    console.log(`  Success: ${validation.success}`);
    console.log(`  User ID: ${validation.user.id}`);
    console.log(`  Email: ${validation.user.email}`);
    
    // Créer req.user comme le middleware
    const reqUser = {
      userId: validation.user.id,
      email: validation.user.email,
      firstName: validation.user.firstName,
      lastName: validation.user.lastName,
      role: validation.user.role,
      isVerified: validation.user.isVerified,
      sessionId: validation.session.sessionId
    };
    
    console.log('\n2️⃣ SIMULATION CONTRÔLEUR getSolById:');
    console.log(`  Sol ID demandé: ${solId}`);
    console.log(`  req.user.userId: ${reqUser.userId}`);
    
    // REPRODUIRE EXACTEMENT LA LOGIQUE DU CONTRÔLEUR
    const includeHistory = true; // ?includeHistory=true
    
    // Étape 1: Récupérer le sol (comme dans le contrôleur)
    console.log('\n🔍 Étape 1: Récupération du sol...');
    
    const sol = await Sol.findById(solId)
      .populate('creator', 'firstName lastName email phone')
      .populate('participants.user', 'firstName lastName email phone')
      .populate('rounds.recipient', 'firstName lastName')
      .populate('rounds.payments.payer', 'firstName lastName');
      
    if (!sol) {
      console.log('❌ Sol non trouvé');
      return;
    }
    
    console.log('✅ Sol trouvé');
    console.log(`  Sol creator: ${sol.creator}`);
    console.log(`  Sol creator type: ${typeof sol.creator}`);
    console.log(`  Sol creator._id: ${sol.creator?._id}`);
    console.log(`  Sol participants: ${sol.participants.length}`);
    
    // Étape 2: Vérifier l'accès (EXACTEMENT comme dans le contrôleur)
    console.log('\n🔍 Étape 2: Vérification accès...');
    
    console.log('📋 DÉTAILS DE VÉRIFICATION:');
    console.log(`  sol.creator: ${sol.creator}`);
    console.log(`  sol.creator._id: ${sol.creator._id}`);
    console.log(`  sol.creator._id.toString(): ${sol.creator._id.toString()}`);
    console.log(`  req.user.userId: ${reqUser.userId}`);
    console.log(`  typeof req.user.userId: ${typeof reqUser.userId}`);
    
    // Test créateur (exactement comme dans le contrôleur)
    const isCreatorCheck = sol.creator._id.toString() === reqUser.userId;
    console.log(`  🔍 Test créateur: ${sol.creator._id.toString()} === ${reqUser.userId} → ${isCreatorCheck}`);
    
    // Test participants (exactement comme dans le contrôleur)
    console.log('\n📋 TEST PARTICIPANTS:');
    console.log(`  Nombre de participants: ${sol.participants.length}`);
    
    const participantCheck = sol.participants.some(p => {
      console.log(`    Participant: ${p.user._id}`);
      console.log(`    Participant type: ${typeof p.user._id}`);
      console.log(`    p.user._id.toString(): ${p.user._id.toString()}`);
      console.log(`    req.user.userId: ${reqUser.userId}`);
      
      const match = p.user._id.toString() === reqUser.userId;
      console.log(`    Match: ${match}`);
      
      return match;
    });
    
    console.log(`  🔍 Test participants: ${participantCheck}`);
    
    // Logique finale (exactement comme dans le contrôleur)
    const hasAccess = isCreatorCheck || participantCheck;
    console.log(`\n🎯 LOGIQUE FINALE:`);
    console.log(`  isCreator: ${isCreatorCheck}`);
    console.log(`  isParticipant: ${participantCheck}`);
    console.log(`  hasAccess: ${hasAccess}`);
    
    if (!hasAccess) {
      console.log('\n❌ ACCÈS REFUSÉ - COMME DANS LE CONTRÔLEUR');
      console.log('🔍 CAUSES POSSIBLES:');
      
      // Analyse détaillée des types
      console.log('\n📊 ANALYSE DES TYPES:');
      console.log(`  sol.creator._id type: ${typeof sol.creator._id}`);
      console.log(`  sol.creator._id constructor: ${sol.creator._id.constructor.name}`);
      console.log(`  req.user.userId type: ${typeof reqUser.userId}`);
      
      // Vérifier si c'est un problème de type ObjectId vs String
      const creatorIdString = sol.creator._id.toString();
      const userIdString = reqUser.userId.toString();
      
      console.log('\n🔍 COMPARAISON FORCÉE STRING:');
      console.log(`  creatorIdString: "${creatorIdString}"`);
      console.log(`  userIdString: "${userIdString}"`);
      console.log(`  Match forcé string: ${creatorIdString === userIdString}`);
      
      // Vérifier les longueurs
      console.log('\n📏 LONGUEURS:');
      console.log(`  creatorIdString length: ${creatorIdString.length}`);
      console.log(`  userIdString length: ${userIdString.length}`);
      
      // Comparer caractère par caractère si différent
      if (creatorIdString !== userIdString) {
        console.log('\n🔍 DIFFÉRENCES CARACTÈRE PAR CARACTÈRE:');
        for (let i = 0; i < Math.max(creatorIdString.length, userIdString.length); i++) {
          const char1 = creatorIdString[i] || 'UNDEFINED';
          const char2 = userIdString[i] || 'UNDEFINED';
          if (char1 !== char2) {
            console.log(`    Position ${i}: "${char1}" vs "${char2}"`);
          }
        }
      }
      
      // Vérifier avec mongoose.Types.ObjectId
      console.log('\n🔍 TEST AVEC MONGOOSE ObjectId:');
      try {
        const creatorObjectId = new mongoose.Types.ObjectId(sol.creator._id);
        const userObjectId = new mongoose.Types.ObjectId(reqUser.userId);
        
        console.log(`  Creator ObjectId: ${creatorObjectId}`);
        console.log(`  User ObjectId: ${userObjectId}`);
        console.log(`  ObjectId equals: ${creatorObjectId.equals(userObjectId)}`);
      } catch (e) {
        console.log(`  ❌ Erreur ObjectId: ${e.message}`);
      }
      
    } else {
      console.log('\n✅ ACCÈS AUTORISÉ - PAS DE BUG DÉTECTÉ');
    }
    
    // 3. COMPARAISON AVEC getUserSols
    console.log('\n3️⃣ COMPARAISON AVEC getUserSols:');
    
    // Test de la logique getUserSols
    const getUserSolsFilter = {
      $or: [
        { creator: reqUser.userId },
        { 'participants.user': reqUser.userId }
      ]
    };
    
    console.log('🔍 Filtre getUserSols:');
    console.log(JSON.stringify(getUserSolsFilter, null, 2));
    
    const solsFromGetUserSols = await Sol.find(getUserSolsFilter)
      .populate('creator', 'firstName lastName email')
      .populate('participants.user', 'firstName lastName email');
    
    console.log(`📊 Résultats getUserSols: ${solsFromGetUserSols.length} sol(s)`);
    
    if (solsFromGetUserSols.length > 0) {
      solsFromGetUserSols.forEach((s, index) => {
        console.log(`  Sol ${index + 1}: ${s._id} - ${s.name}`);
      });
    }
    
    // Recommandations finales
    console.log('\n🛠️ RECOMMANDATIONS:');
    
    if (!hasAccess) {
      console.log('❌ BUG CONFIRMÉ dans getSolById');
      console.log('💡 Problèmes possibles:');
      console.log('  1. Types incompatibles (ObjectId vs String)');
      console.log('  2. req.user.userId corrompu par le middleware');
      console.log('  3. Population des données incorrecte');
      console.log('  4. Différence de logique entre getUserSols et getSolById');
      
      console.log('\n🔧 SOLUTIONS:');
      console.log('  1. Utiliser mongoose.Types.ObjectId.equals() dans getSolById');
      console.log('  2. Vérifier le middleware authenticate');
      console.log('  3. Uniformiser la logique entre getUserSols et getSolById');
    } else {
      console.log('✅ Logique correcte détectée');
      console.log('💡 Le bug pourrait venir d\'ailleurs');
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Debug terminé');
  }
};

debugControllerBug();