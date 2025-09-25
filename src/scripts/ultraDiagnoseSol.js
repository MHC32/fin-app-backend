// src/scripts/ultraDiagnoseSol.js
// 🔬 DIAGNOSTIC ULTRA-PRÉCIS DES BUGS SOL
// Ce script simule EXACTEMENT le comportement du contrôleur

const mongoose = require('mongoose');
const Sol = require('../models/Sol');
const User = require('../models/User');
const Account = require('../models/Account');
require('dotenv').config({ path: '.env.local' });

// Configuration
const CONFIG = {
  SOL_ID: '68d4a49ba83fa0d4c1fbe151', // Depuis vos tests
  USER_EMAIL: 'hantzmichaelchery6@gmail.com'
};

// ===================================================================
// FONCTION DE COMPARAISON ACTUELLE (COPIÉE DU CONTRÔLEUR)
// ===================================================================
function compareUserIdsOriginal(id1, id2) {
  try {
    if (!id1 || !id2) return false;
    
    const str1 = id1.toString ? id1.toString() : String(id1);
    const str2 = id2.toString ? id2.toString() : String(id2);
    
    return str1 === str2;
  } catch (error) {
    console.error('❌ Erreur comparaison IDs:', error);
    return false;
  }
}

// ===================================================================
// TEST 1: DIAGNOSTIC getSolById
// ===================================================================
async function diagnoseGetSolById() {
  console.log('═'.repeat(80));
  console.log('🔬 TEST 1: DIAGNOSTIC getSolById');
  console.log('═'.repeat(80));
  
  try {
    // Récupérer l'utilisateur
    const user = await User.findOne({ email: CONFIG.USER_EMAIL });
    if (!user) {
      console.log('❌ Utilisateur non trouvé');
      return { success: false, error: 'user_not_found' };
    }
    
    console.log('\n1️⃣ UTILISATEUR RÉCUPÉRÉ:');
    console.log(`   ID: ${user._id}`);
    console.log(`   Type: ${typeof user._id} (${user._id.constructor.name})`);
    console.log(`   Email: ${user.email}`);
    
    // Simuler req.user.userId (comme dans le middleware authenticate)
    const reqUserId = user._id.toString(); // C'est ce que le middleware fait
    console.log(`\n   req.user.userId (simulé): ${reqUserId}`);
    console.log(`   Type: ${typeof reqUserId}`);
    
    // Récupérer le sol AVEC populate (comme getSolById)
    console.log('\n2️⃣ RÉCUPÉRATION SOL AVEC POPULATE:');
    const sol = await Sol.findById(CONFIG.SOL_ID)
      .populate('creator', 'firstName lastName email phone')
      .populate('participants.user', 'firstName lastName email phone');
    
    if (!sol) {
      console.log('❌ Sol non trouvé');
      return { success: false, error: 'sol_not_found' };
    }
    
    console.log(`   Sol trouvé: ${sol.name}`);
    console.log(`   Statut: ${sol.status}`);
    
    // Analyser le créateur
    console.log('\n3️⃣ ANALYSE CRÉATEUR:');
    console.log(`   Creator: ${sol.creator}`);
    console.log(`   Creator type: ${typeof sol.creator} (${sol.creator.constructor.name})`);
    console.log(`   Creator._id: ${sol.creator._id}`);
    console.log(`   Creator._id type: ${typeof sol.creator._id} (${sol.creator._id.constructor.name})`);
    
    // TEST COMPARAISON CRÉATEUR (EXACTEMENT comme dans le code)
    console.log('\n4️⃣ TEST COMPARAISON CRÉATEUR:');
    console.log(`   Formule: compareUserIds(sol.creator._id, req.user.userId)`);
    console.log(`   Valeur 1: sol.creator._id = ${sol.creator._id}`);
    console.log(`   Valeur 2: req.user.userId = ${reqUserId}`);
    
    const isCreatorCheck = compareUserIdsOriginal(sol.creator._id, reqUserId);
    console.log(`   Résultat: ${isCreatorCheck}`);
    
    if (!isCreatorCheck) {
      console.log('\n   ⚠️ PROBLÈME DÉTECTÉ AVEC CRÉATEUR:');
      console.log(`   - sol.creator._id.toString(): "${sol.creator._id.toString()}"`);
      console.log(`   - reqUserId: "${reqUserId}"`);
      console.log(`   - Comparaison directe: ${sol.creator._id.toString() === reqUserId}`);
    }
    
    // Analyser les participants
    console.log('\n5️⃣ ANALYSE PARTICIPANTS:');
    console.log(`   Nombre: ${sol.participants.length}`);
    
    sol.participants.forEach((p, index) => {
      console.log(`\n   Participant ${index + 1}:`);
      console.log(`     user: ${p.user}`);
      console.log(`     user type: ${typeof p.user} (${p.user.constructor.name})`);
      console.log(`     user._id: ${p.user._id}`);
      console.log(`     user._id type: ${typeof p.user._id} (${p.user._id.constructor.name})`);
      console.log(`     Position: ${p.position}`);
    });
    
    // TEST COMPARAISON PARTICIPANTS (EXACTEMENT comme dans le code)
    console.log('\n6️⃣ TEST COMPARAISON PARTICIPANTS:');
    console.log(`   Formule: sol.participants.some(p => p.user && compareUserIds(p.user._id, req.user.userId))`);
    
    const isParticipantCheck = sol.participants.some(p => {
      console.log(`\n   Test participant:"`);
      console.log(`     p.user existe: ${!!p.user}`);
      if (p.user) {
        console.log(`     p.user._id: ${p.user._id}`);
        console.log(`     req.user.userId: ${reqUserId}`);
        const match = compareUserIdsOriginal(p.user._id, reqUserId);
        console.log(`     Match: ${match}`);
        return match;
      }
      return false;
    });
    
    console.log(`\n   Résultat final isParticipant: ${isParticipantCheck}`);
    
    // Logique d'accès finale
    console.log('\n7️⃣ LOGIQUE D\'ACCÈS FINALE:');
    const hasAccess = isCreatorCheck || isParticipantCheck;
    console.log(`   isCreator: ${isCreatorCheck}`);
    console.log(`   isParticipant: ${isParticipantCheck}`);
    console.log(`   hasAccess: ${hasAccess}`);
    
    if (!hasAccess) {
      console.log('\n   ❌ ACCÈS REFUSÉ - ERREUR 403 REPRODUITE!');
      console.log('\n   🔍 CAUSE DU BUG:');
      
      // Diagnostic approfondi
      const creatorMatch = sol.creator._id.toString() === reqUserId;
      console.log(`   - Créateur match manuel: ${creatorMatch}`);
      
      const participantManualCheck = sol.participants.some(p => 
        p.user && p.user._id.toString() === reqUserId
      );
      console.log(`   - Participant match manuel: ${participantManualCheck}`);
      
      if (creatorMatch || participantManualCheck) {
        console.log('\n   💡 DIAGNOSTIC: La fonction compareUserIds a un BUG!');
        console.log('   La comparaison manuelle fonctionne, mais pas la fonction.');
      }
    } else {
      console.log('\n   ✅ ACCÈS AUTORISÉ - PAS DE BUG');
    }
    
    return { 
      success: hasAccess,
      isCreator: isCreatorCheck,
      isParticipant: isParticipantCheck 
    };
    
  } catch (error) {
    console.error('\n❌ ERREUR:', error.message);
    console.error('Stack:', error.stack);
    return { success: false, error: error.message };
  }
}

// ===================================================================
// TEST 2: DIAGNOSTIC leaveSol
// ===================================================================
async function diagnoseLeaveSol() {
  console.log('\n\n═'.repeat(80));
  console.log('🔬 TEST 2: DIAGNOSTIC leaveSol');
  console.log('═'.repeat(80));
  
  try {
    const user = await User.findOne({ email: CONFIG.USER_EMAIL });
    const reqUserId = user._id.toString();
    
    // Récupérer le sol SANS populate (comme leaveSol)
    console.log('\n1️⃣ RÉCUPÉRATION SOL SANS POPULATE:');
    const sol = await Sol.findById(CONFIG.SOL_ID);
    
    if (!sol) {
      console.log('❌ Sol non trouvé');
      return { success: false, error: 'sol_not_found' };
    }
    
    console.log(`   Sol trouvé: ${sol.name}`);
    
    // Analyser les participants (NON POPULÉS)
    console.log('\n2️⃣ ANALYSE PARTICIPANTS (NON POPULÉS):');
    console.log(`   Nombre: ${sol.participants.length}`);
    
    sol.participants.forEach((p, index) => {
      console.log(`\n   Participant ${index + 1}:`);
      console.log(`     p.user: ${p.user}`);
      console.log(`     p.user type: ${typeof p.user} (${p.user.constructor.name})`);
      console.log(`     Position: ${p.position}`);
    });
    
    // TEST RECHERCHE PARTICIPANT (EXACTEMENT comme dans leaveSol)
    console.log('\n3️⃣ TEST RECHERCHE PARTICIPANT:');
    console.log(`   Formule: sol.participants.findIndex(p => compareUserIds(p.user, req.user.userId))`);
    
    const participantIndex = sol.participants.findIndex(p => {
      console.log(`\n   Test participant:`);
      console.log(`     p.user: ${p.user}`);
      console.log(`     req.user.userId: ${reqUserId}`);
      const match = compareUserIdsOriginal(p.user, reqUserId);
      console.log(`     Match: ${match}`);
      return match;
    });
    
    console.log(`\n   Index trouvé: ${participantIndex}`);
    
    if (participantIndex === -1) {
      console.log('\n   ❌ PARTICIPANT NON TROUVÉ - ERREUR 400 REPRODUITE!');
      console.log('\n   🔍 CAUSE DU BUG:');
      
      // Test manuel
      const manualIndex = sol.participants.findIndex(p => 
        p.user.toString() === reqUserId
      );
      console.log(`   - Index manuel: ${manualIndex}`);
      
      if (manualIndex !== -1) {
        console.log('\n   💡 DIAGNOSTIC: La fonction compareUserIds ne gère pas les ObjectId non populés!');
        console.log('   p.user est un ObjectId pur, pas un objet avec _id');
      }
    } else {
      console.log('\n   ✅ PARTICIPANT TROUVÉ - PAS DE BUG');
    }
    
    return { 
      success: participantIndex !== -1,
      participantIndex 
    };
    
  } catch (error) {
    console.error('\n❌ ERREUR:', error.message);
    return { success: false, error: error.message };
  }
}

// ===================================================================
// TEST 3: DIAGNOSTIC makePayment
// ===================================================================
async function diagnoseMakePayment() {
  console.log('\n\n═'.repeat(80));
  console.log('🔬 TEST 3: DIAGNOSTIC makePayment');
  console.log('═'.repeat(80));
  
  try {
    const user = await User.findOne({ email: CONFIG.USER_EMAIL });
    const reqUserId = user._id.toString();
    
    // Récupérer le sol AVEC populate (comme makePayment)
    console.log('\n1️⃣ RÉCUPÉRATION SOL AVEC POPULATE:');
    const sol = await Sol.findById(CONFIG.SOL_ID)
      .populate('participants.user', 'firstName lastName');
    
    console.log(`   Sol trouvé: ${sol.name}`);
    
    // Vérification d'accès
    console.log('\n2️⃣ VÉRIFICATION ACCÈS:');
    const hasAccess = compareUserIdsOriginal(sol.creator._id, reqUserId) ||
      sol.participants.some(p => 
        p.user && compareUserIdsOriginal(p.user._id, reqUserId)
      );
    
    console.log(`   hasAccess: ${hasAccess}`);
    
    if (!hasAccess) {
      console.log('   ❌ Accès refusé - retourne 403');
      return { success: false, error: 'unauthorized_sol_access' };
    }
    
    // Recherche participant
    console.log('\n3️⃣ RECHERCHE PARTICIPANT:');
    const participant = sol.participants.find(p => 
      p.user && compareUserIdsOriginal(p.user._id, reqUserId)
    );
    
    console.log(`   Participant trouvé: ${!!participant}`);
    
    if (!participant) {
      console.log('   ❌ Participant non trouvé - retourne 400');
      return { success: false, error: 'not_participant' };
    }
    
    // Test recherche compte
    console.log('\n4️⃣ TEST RECHERCHE COMPTE:');
    
    // Récupérer les comptes de l'utilisateur
    const accounts = await Account.find({
      user: reqUserId,
      isActive: true
    });
    
    console.log(`   Comptes actifs trouvés: ${accounts.length}`);
    
    if (accounts.length === 0) {
      console.log('   ⚠️ Aucun compte actif - l\'erreur est logique');
      return { success: false, error: 'no_active_account' };
    }
    
    // Tester avec le premier compte
    const testAccountId = accounts[0]._id;
    console.log(`   Test avec compte: ${testAccountId}`);
    
    try {
      const account = await Account.findOne({
        _id: testAccountId,
        user: reqUserId,
        isActive: true
      });
      
      console.log(`   Compte trouvé: ${!!account}`);
      
      if (account) {
        console.log(`   - Nom: ${account.name}`);
        console.log(`   - Solde: ${account.currentBalance} ${account.currency}`);
      }
      
      return { success: true, hasAccount: !!account };
      
    } catch (accountError) {
      console.log(`   ❌ ERREUR lors de Account.findOne: ${accountError.message}`);
      console.log('   💡 DIAGNOSTIC: Erreur 500 - account_fetch_error reproduite!');
      return { success: false, error: 'account_fetch_error', details: accountError.message };
    }
    
  } catch (error) {
    console.error('\n❌ ERREUR:', error.message);
    return { success: false, error: error.message };
  }
}

// ===================================================================
// EXÉCUTION COMPLÈTE
// ===================================================================
async function runDiagnosis() {
  try {
    console.log('🚀 DÉBUT DIAGNOSTIC ULTRA-PRÉCIS\n');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connecté\n');
    
    const results = {};
    
    // Test 1
    results.getSolById = await diagnoseGetSolById();
    
    // Test 2
    results.leaveSol = await diagnoseLeaveSol();
    
    // Test 3
    results.makePayment = await diagnoseMakePayment();
    
    // Rapport final
    console.log('\n\n═'.repeat(80));
    console.log('📊 RAPPORT FINAL');
    console.log('═'.repeat(80));
    
    console.log('\n🔍 RÉSUMÉ DES BUGS:');
    console.log(`1. getSolById:   ${results.getSolById.success ? '✅ OK' : '❌ BUG'}`);
    console.log(`2. leaveSol:     ${results.leaveSol.success ? '✅ OK' : '❌ BUG'}`);
    console.log(`3. makePayment:  ${results.makePayment.success ? '✅ OK' : '❌ BUG'}`);
    
    console.log('\n💡 CONCLUSIONS:');
    if (!results.getSolById.success || !results.leaveSol.success) {
      console.log('❌ La fonction compareUserIds ne gère PAS correctement tous les cas:');
      console.log('   - ObjectId populé avec _id (getSolById) ✅');
      console.log('   - ObjectId NON populé sans _id (leaveSol) ❌');
      console.log('\n🔧 SOLUTION: Modifier compareUserIds pour détecter si c\'est un ObjectId pur');
    }
    
    if (!results.makePayment.success && results.makePayment.error === 'account_fetch_error') {
      console.log('❌ Erreur dans Account.findOne() - problème de schéma ou de connexion');
    }
    
  } catch (error) {
    console.error('❌ ERREUR FATALE:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Diagnostic terminé');
  }
}

runDiagnosis();