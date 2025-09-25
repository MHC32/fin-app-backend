// 🔍 SCRIPT DE DIAGNOSTIC ACCÈS SOL - FINAPP HAITI
// Créer ce fichier: src/scripts/debugSolAccess.js
// 
// Ce script diagnostique complètement pourquoi l'erreur "Accès non autorisé à ce sol" se produit
// Usage: node src/scripts/debugSolAccess.js [SOL_ID] [USER_EMAIL]

const mongoose = require('mongoose');
const Sol = require('../models/Sol');
const User = require('../models/User');
const authService = require('../services/authService');
const { verifyAccessToken, extractBearerToken } = require('../config/jwt');
require('dotenv').config({ path: '.env.local' });

// ===================================================================
// CONFIGURATION DU DEBUG
// ===================================================================

const DEBUG_CONFIG = {
  // ID du sol problématique (récupéré depuis votre screenshot)
  SOL_ID: process.argv[2] || '66d4a49ba83fa0d4c1fbe152', // ID visible dans votre interface
  
  // Email de votre utilisateur
  USER_EMAIL: process.argv[3] || 'hantzmichaelchery6@gmail.com', // Remplacez par votre email
  
  // Options de debug détaillé
  VERBOSE: true,
  SHOW_FULL_OBJECTS: false,
  SIMULATE_TOKEN_VALIDATION: true
};

console.log('🔍 === DIAGNOSTIC ACCÈS SOL FINAPP HAITI ===');
console.log(`🎯 Sol ID: ${DEBUG_CONFIG.SOL_ID}`);
console.log(`👤 User Email: ${DEBUG_CONFIG.USER_EMAIL}\n`);

// ===================================================================
// 1. CONNEXION BASE DE DONNÉES
// ===================================================================

const connectDatabase = async () => {
  try {
    console.log('1️⃣ CONNEXION BASE DE DONNÉES:');
    
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/finapp_haiti_dev';
    console.log(`🔗 URI: ${mongoURI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);
    
    await mongoose.connect(mongoURI);
    
    console.log('✅ MongoDB connecté avec succès');
    console.log(`✅ Database: ${mongoose.connection.name}`);
    console.log(`✅ Host: ${mongoose.connection.host}`);
    console.log('');
    
    return true;
  } catch (error) {
    console.error('❌ ERREUR Connexion MongoDB:', error.message);
    return false;
  }
};

// ===================================================================
// 2. ANALYSE UTILISATEUR
// ===================================================================

const analyzeUser = async () => {
  try {
    console.log('2️⃣ ANALYSE UTILISATEUR:');
    
    const user = await User.findOne({ email: DEBUG_CONFIG.USER_EMAIL });
    
    if (!user) {
      console.log('❌ UTILISATEUR NON TROUVÉ');
      console.log(`❌ Email recherché: ${DEBUG_CONFIG.USER_EMAIL}`);
      
      // Chercher des utilisateurs similaires
      const allUsers = await User.find({}, { email: 1, firstName: 1, lastName: 1 }).limit(10);
      console.log('\n📋 Utilisateurs disponibles en base:');
      allUsers.forEach(u => {
        console.log(`  - ${u.email} (${u.firstName} ${u.lastName})`);
      });
      
      return null;
    }
    
    console.log('✅ UTILISATEUR TROUVÉ:');
    console.log(`  📧 Email: ${user.email}`);
    console.log(`  🆔 User ID: ${user._id}`);
    console.log(`  👤 Nom: ${user.firstName} ${user.lastName}`);
    console.log(`  🔐 Actif: ${user.isActive}`);
    console.log(`  ✅ Vérifié: ${user.isVerified}`);
    console.log(`  👑 Rôle: ${user.role || 'user'}`);
    console.log(`  📱 Téléphone: ${user.phone || 'Non défini'}`);
    console.log(`  📅 Créé le: ${user.createdAt}`);
    console.log(`  🔄 Sessions actives: ${user.activeSessions?.length || 0}`);
    console.log(`  🔑 Refresh tokens: ${user.refreshTokens?.length || 0}`);
    
    // Analyse des sessions actives
    if (user.activeSessions?.length > 0) {
      console.log('\n🔍 DÉTAIL DES SESSIONS:');
      user.activeSessions.forEach((session, index) => {
        console.log(`  Session ${index + 1}:`);
        console.log(`    🆔 ID: ${session.sessionId}`);
        console.log(`    ✅ Active: ${session.isActive}`);
        console.log(`    ⏰ Expire: ${session.expiresAt}`);
        console.log(`    ❌ Expiré: ${session.expiresAt < new Date()}`);
        console.log(`    📱 Device: ${session.deviceInfo?.device || 'inconnu'}`);
        console.log(`    🌐 IP: ${session.deviceInfo?.ip || 'inconnue'}`);
        console.log(`    🔍 User-Agent: ${session.deviceInfo?.userAgent?.substring(0, 50) || 'inconnu'}...`);
        
        // Test du token si présent
        if (session.accessToken) {
          try {
            const verification = verifyAccessToken(session.accessToken);
            console.log(`    🎫 Token valide: ${verification.isValid}`);
            console.log(`    ⏳ Token expiré: ${verification.expired}`);
            if (!verification.isValid) {
              console.log(`    ❌ Erreur token: ${verification.error}`);
            }
          } catch (e) {
            console.log(`    ❌ Erreur test token: ${e.message}`);
          }
        } else {
          console.log(`    ⚠️ Pas de token d'accès`);
        }
        console.log('');
      });
    }
    
    console.log('');
    return user;
  } catch (error) {
    console.error('❌ ERREUR Analyse utilisateur:', error.message);
    return null;
  }
};

// ===================================================================
// 3. ANALYSE DU SOL
// ===================================================================

const analyzeSol = async () => {
  try {
    console.log('3️⃣ ANALYSE DU SOL:');
    
    // Vérifier format de l'ID
    if (!mongoose.Types.ObjectId.isValid(DEBUG_CONFIG.SOL_ID)) {
      console.log('❌ ID SOL INVALIDE');
      console.log(`❌ ID fourni: ${DEBUG_CONFIG.SOL_ID}`);
      console.log('❌ L\'ID doit être un ObjectId MongoDB valide (24 caractères hexadécimaux)');
      return null;
    }
    
    const sol = await Sol.findById(DEBUG_CONFIG.SOL_ID)
      .populate('creator', 'firstName lastName email phone')
      .populate('participants.user', 'firstName lastName email phone')
      .populate('rounds.recipient', 'firstName lastName')
      .populate('rounds.payments.payer', 'firstName lastName');
    
    if (!sol) {
      console.log('❌ SOL NON TROUVÉ');
      console.log(`❌ ID recherché: ${DEBUG_CONFIG.SOL_ID}`);
      
      // Chercher des sols similaires
      const allSols = await Sol.find({}, { _id: 1, name: 1, creator: 1, status: 1 })
        .populate('creator', 'firstName lastName email')
        .limit(10)
        .sort({ createdAt: -1 });
        
      console.log('\n📋 Sols disponibles en base:');
      allSols.forEach(s => {
        console.log(`  - ${s._id} | ${s.name} | ${s.creator.email} | ${s.status}`);
      });
      
      return null;
    }
    
    console.log('✅ SOL TROUVÉ:');
    console.log(`  🆔 ID: ${sol._id}`);
    console.log(`  📝 Nom: ${sol.name}`);
    console.log(`  📄 Description: ${sol.description || 'Aucune'}`);
    console.log(`  🏷️ Type: ${sol.type}`);
    console.log(`  💰 Montant: ${sol.contributionAmount} ${sol.currency}`);
    console.log(`  👥 Max participants: ${sol.maxParticipants}`);
    console.log(`  📊 Statut: ${sol.status}`);
    console.log(`  🔒 Privé: ${sol.isPrivate}`);
    console.log(`  📅 Date création: ${sol.createdAt}`);
    console.log(`  📅 Date modification: ${sol.updatedAt}`);
    console.log(`  🔑 Code d'accès: ${sol.accessCode}`);
    
    console.log('\n👤 CRÉATEUR:');
    if (sol.creator) {
      console.log(`  🆔 Creator ID: ${sol.creator._id}`);
      console.log(`  📧 Email: ${sol.creator.email}`);
      console.log(`  👤 Nom: ${sol.creator.firstName} ${sol.creator.lastName}`);
      console.log(`  📱 Téléphone: ${sol.creator.phone || 'Non défini'}`);
    } else {
      console.log('  ❌ Créateur non populé ou inexistant');
    }
    
    console.log('\n👥 PARTICIPANTS:');
    console.log(`  📊 Total: ${sol.participants.length}/${sol.maxParticipants}`);
    
    if (sol.participants.length > 0) {
      sol.participants.forEach((participant, index) => {
        console.log(`  Participant ${index + 1}:`);
        console.log(`    🆔 User ID: ${participant.user._id}`);
        console.log(`    📧 Email: ${participant.user.email}`);
        console.log(`    👤 Nom: ${participant.user.firstName} ${participant.user.lastName}`);
        console.log(`    📱 Téléphone: ${participant.user.phone || 'Non défini'}`);
        console.log(`    🎯 Position: ${participant.position}`);
        console.log(`    👑 Rôle: ${participant.role || 'participant'}`);
        console.log(`    📅 Rejoint le: ${participant.joinedAt}`);
        console.log(`    💳 Statut paiement: ${participant.paymentStatus || 'pending'}`);
        console.log(`    💰 A reçu: ${participant.hasReceived || false}`);
        console.log('');
      });
    } else {
      console.log('  ⚠️ Aucun participant trouvé');
    }
    
    console.log('📊 ROUNDS:');
    console.log(`  🔄 Total rounds: ${sol.rounds?.length || 0}`);
    if (sol.rounds?.length > 0) {
      sol.rounds.slice(0, 3).forEach((round, index) => {
        console.log(`  Round ${index + 1}:`);
        console.log(`    📊 Statut: ${round.status}`);
        console.log(`    🎯 Bénéficiaire: ${round.recipient?.firstName} ${round.recipient?.lastName}`);
        console.log(`    📅 Début: ${round.startDate}`);
        console.log(`    📅 Fin: ${round.endDate}`);
        console.log(`    💰 Montant: ${round.totalAmount} ${sol.currency}`);
        console.log(`    💳 Paiements: ${round.payments?.length || 0}`);
      });
      if (sol.rounds.length > 3) {
        console.log(`    ... et ${sol.rounds.length - 3} autres rounds`);
      }
    }
    
    console.log('');
    return sol;
  } catch (error) {
    console.error('❌ ERREUR Analyse sol:', error.message);
    console.error('❌ Stack:', error.stack);
    return null;
  }
};

// ===================================================================
// 4. TEST D'ACCÈS AU SOL
// ===================================================================

const testSolAccess = async (user, sol) => {
  try {
    console.log('4️⃣ TEST D\'ACCÈS AU SOL:');
    
    if (!user || !sol) {
      console.log('❌ Utilisateur ou sol manquant pour le test d\'accès');
      return false;
    }
    
    console.log(`🔍 Test d'accès pour l'utilisateur: ${user.email}`);
    console.log(`🔍 Au sol: ${sol.name} (${sol._id})`);
    
    // Test 1: Vérifier si l'utilisateur est le créateur
    const isCreator = sol.creator._id.toString() === user._id.toString();
    console.log(`\n1️⃣ EST CRÉATEUR:`);
    console.log(`  🔍 Creator ID: ${sol.creator._id}`);
    console.log(`  🔍 User ID:    ${user._id}`);
    console.log(`  ✅ Match:      ${isCreator}`);
    
    // Test 2: Vérifier si l'utilisateur est participant
    console.log(`\n2️⃣ EST PARTICIPANT:`);
    const participantMatch = sol.participants.find(p => {
      const match = p.user._id.toString() === user._id.toString();
      console.log(`  🔍 Participant ${p.position}: ${p.user._id} → ${match ? '✅' : '❌'}`);
      return match;
    });
    
    const isParticipant = !!participantMatch;
    console.log(`  📊 Résultat: ${isParticipant ? '✅ PARTICIPANT TROUVÉ' : '❌ PAS PARTICIPANT'}`);
    
    if (participantMatch) {
      console.log(`  🎯 Position: ${participantMatch.position}`);
      console.log(`  👑 Rôle: ${participantMatch.role || 'participant'}`);
      console.log(`  📅 Rejoint: ${participantMatch.joinedAt}`);
    }
    
    // Test 3: Logique d'accès finale (comme dans le code)
    const hasAccess = isCreator || isParticipant;
    console.log(`\n3️⃣ LOGIQUE D'ACCÈS FINALE:`);
    console.log(`  🔍 Est créateur: ${isCreator}`);
    console.log(`  🔍 Est participant: ${isParticipant}`);
    console.log(`  ✅ Accès autorisé: ${hasAccess ? '✅ OUI' : '❌ NON'}`);
    
    // Test 4: Problèmes potentiels de population
    console.log(`\n4️⃣ VÉRIFICATION POPULATION:`);
    console.log(`  🔍 Creator populé: ${sol.creator && sol.creator._id ? '✅' : '❌'}`);
    console.log(`  🔍 Participants populés: ${sol.participants.every(p => p.user && p.user._id) ? '✅' : '❌'}`);
    
    // Identifier les participants non populés
    const unpopulatedParticipants = sol.participants.filter(p => !p.user || !p.user._id);
    if (unpopulatedParticipants.length > 0) {
      console.log(`  ⚠️ Participants non populés: ${unpopulatedParticipants.length}`);
      unpopulatedParticipants.forEach((p, index) => {
        console.log(`    ${index + 1}: ${JSON.stringify(p.user)}`);
      });
    }
    
    console.log('');
    return hasAccess;
  } catch (error) {
    console.error('❌ ERREUR Test accès sol:', error.message);
    return false;
  }
};

// ===================================================================
// 5. SIMULATION AUTHENTIFICATION
// ===================================================================

const simulateAuthentication = async (user) => {
  try {
    console.log('5️⃣ SIMULATION AUTHENTIFICATION:');
    
    if (!user) {
      console.log('❌ Pas d\'utilisateur pour simuler l\'authentification');
      return null;
    }
    
    // Chercher une session valide
    const validSession = user.activeSessions?.find(session => {
      if (!session.accessToken) return false;
      if (session.expiresAt < new Date()) return false;
      
      try {
        const verification = verifyAccessToken(session.accessToken);
        return verification.isValid;
      } catch (e) {
        return false;
      }
    });
    
    if (!validSession) {
      console.log('⚠️ Aucune session valide trouvée');
      console.log('💡 Suggestions:');
      console.log('  - Reconnectez-vous à l\'application');
      console.log('  - Vérifiez que votre token n\'est pas expiré');
      console.log('  - Videz le cache de votre navigateur');
      
      return null;
    }
    
    console.log('✅ SESSION VALIDE TROUVÉE:');
    console.log(`  🆔 Session ID: ${validSession.sessionId}`);
    console.log(`  ⏰ Expire: ${validSession.expiresAt}`);
    console.log(`  📱 Device: ${validSession.deviceInfo?.device}`);
    
    // Simuler la validation comme le ferait le middleware authenticate
    try {
      const authHeader = `Bearer ${validSession.accessToken}`;
      const validation = await authService.validateAccessToken(authHeader);
      
      console.log('\n🔐 VALIDATION TOKEN:');
      console.log(`  ✅ Succès: ${validation.success}`);
      
      if (validation.success) {
        console.log(`  🆔 User ID: ${validation.user.id}`);
        console.log(`  📧 Email: ${validation.user.email}`);
        console.log(`  👤 Nom: ${validation.user.firstName} ${validation.user.lastName}`);
        console.log(`  👑 Rôle: ${validation.user.role}`);
        console.log(`  ✅ Vérifié: ${validation.user.isVerified}`);
        console.log(`  🔄 Session: ${validation.session.sessionId}`);
        console.log(`  ⏳ Token expire bientôt: ${validation.tokenInfo.expiringSoon}`);
        
        return {
          userId: validation.user.id,
          email: validation.user.email,
          firstName: validation.user.firstName,
          lastName: validation.user.lastName,
          role: validation.user.role,
          isVerified: validation.user.isVerified,
          sessionId: validation.session.sessionId
        };
      } else {
        console.log(`  ❌ Erreur: ${validation.error}`);
      }
    } catch (e) {
      console.log(`  ❌ Erreur validation: ${e.message}`);
    }
    
    console.log('');
    return null;
  } catch (error) {
    console.error('❌ ERREUR Simulation authentification:', error.message);
    return null;
  }
};

// ===================================================================
// 6. DIAGNOSTIC COMPLET
// ===================================================================

const runCompleteDiagnostic = async () => {
  try {
    console.log('🚀 DÉMARRAGE DIAGNOSTIC COMPLET...\n');
    
    // Étape 1: Connexion DB
    const dbConnected = await connectDatabase();
    if (!dbConnected) {
      console.log('❌ Impossible de continuer sans connexion DB');
      return;
    }
    
    // Étape 2: Analyse utilisateur
    const user = await analyzeUser();
    if (!user) {
      console.log('❌ Impossible de continuer sans utilisateur');
      return;
    }
    
    // Étape 3: Analyse sol
    const sol = await analyzeSol();
    if (!sol) {
      console.log('❌ Impossible de continuer sans sol');
      return;
    }
    
    // Étape 4: Test d'accès
    const hasAccess = await testSolAccess(user, sol);
    
    // Étape 5: Simulation auth
    const authenticatedUser = await simulateAuthentication(user);
    
    // RÉSUMÉ FINAL
    console.log('📊 ========== RÉSUMÉ DIAGNOSTIC ==========');
    console.log(`🎯 Sol: ${sol.name} (${sol._id})`);
    console.log(`👤 Utilisateur: ${user.firstName} ${user.lastName} (${user.email})`);
    console.log(`✅ Accès théorique: ${hasAccess ? '✅ AUTORISÉ' : '❌ REFUSÉ'}`);
    console.log(`🔐 Auth valide: ${authenticatedUser ? '✅ OUI' : '❌ NON'}`);
    
    console.log('\n🔍 DIAGNOSTIC:');
    
    if (hasAccess && authenticatedUser) {
      console.log('✅ PAS DE PROBLÈME DÉTECTÉ');
      console.log('💡 L\'erreur pourrait venir de:');
      console.log('  - Cache navigateur obsolète');
      console.log('  - Token expiré côté client');
      console.log('  - Problème de session temporaire');
      console.log('\n🛠️ SOLUTIONS:');
      console.log('  1. Déconnexion/reconnexion complète');
      console.log('  2. Vider cache navigateur');
      console.log('  3. Utiliser mode incognito');
    } else if (!hasAccess) {
      console.log('❌ PROBLÈME D\'ACCÈS DÉTECTÉ');
      console.log('💡 Causes possibles:');
      console.log('  - Vous n\'êtes ni créateur ni participant de ce sol');
      console.log('  - Problème de population des données');
      console.log('  - IDs corrompus en base');
      console.log('\n🛠️ SOLUTIONS:');
      console.log('  1. Vérifier que vous participez bien à ce sol');
      console.log('  2. Utiliser le code d\'accès pour rejoindre');
      console.log('  3. Contacter l\'admin pour vérifier les données');
    } else if (!authenticatedUser) {
      console.log('❌ PROBLÈME D\'AUTHENTIFICATION DÉTECTÉ');
      console.log('💡 Causes possibles:');
      console.log('  - Toutes vos sessions ont expiré');
      console.log('  - Tokens corrompus');
      console.log('  - Problème avec authService');
      console.log('\n🛠️ SOLUTIONS:');
      console.log('  1. Reconnexion complète');
      console.log('  2. Supprimer toutes les sessions expirées');
      console.log('  3. Vérifier la configuration JWT');
    }
    
    console.log('\n===========================================');
    
  } catch (error) {
    console.error('❌ ERREUR DIAGNOSTIC COMPLET:', error.message);
    console.error('❌ Stack:', error.stack);
  } finally {
    // Fermer la connexion DB
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('✅ Connexion MongoDB fermée');
    }
  }
};

// ===================================================================
// LANCEMENT DU SCRIPT
// ===================================================================

// Vérifier les arguments
if (process.argv.length < 4 && !DEBUG_CONFIG.SOL_ID && !DEBUG_CONFIG.USER_EMAIL) {
  console.log('Usage: node src/scripts/debugSolAccess.js [SOL_ID] [USER_EMAIL]');
  console.log('Exemple: node src/scripts/debugSolAccess.js 66d4a49ba83fa0d4c1fbe152 user@example.com');
  process.exit(1);
}

// Exécuter le diagnostic
runCompleteDiagnostic()
  .then(() => {
    console.log('\n🏁 Diagnostic terminé');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Erreur fatale:', error.message);
    process.exit(1);
  });

// ===================================================================
// EXPORT POUR UTILISATION MODULAIRE
// ===================================================================

module.exports = {
  connectDatabase,
  analyzeUser,
  analyzeSol,
  testSolAccess,
  simulateAuthentication,
  runCompleteDiagnostic,
  DEBUG_CONFIG
};