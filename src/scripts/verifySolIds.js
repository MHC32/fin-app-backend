// src/scripts/verifySolIds.js
// 🔍 VÉRIFIER LES VRAIS IDs DES SOLS

const mongoose = require('mongoose');
const Sol = require('../models/Sol');
const User = require('../models/User');
require('dotenv').config({ path: '.env.local' });

const verifySolIds = async () => {
  try {
    console.log('🔍 VÉRIFICATION DES IDs DE SOL\n');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connecté\n');
    
    const userEmail = 'hantzmichaelchery6@gmail.com';
    const user = await User.findOne({ email: userEmail });
    
    if (!user) {
      console.log('❌ Utilisateur non trouvé');
      return;
    }
    
    console.log(`👤 UTILISATEUR: ${user.firstName} ${user.lastName}`);
    console.log(`🆔 USER ID: ${user._id}\n`);
    
    // Récupérer TOUS les sols de l'utilisateur
    const sols = await Sol.find({
      $or: [
        { creator: user._id },
        { 'participants.user': user._id }
      ]
    }).sort({ createdAt: -1 });
    
    console.log(`📊 NOMBRE DE SOLS: ${sols.length}\n`);
    console.log('═'.repeat(80));
    
    sols.forEach((sol, index) => {
      const isCreator = sol.creator.toString() === user._id.toString();
      const participantIndex = sol.participants.findIndex(p => 
        p.user.toString() === user._id.toString()
      );
      
      console.log(`\n🏷️ SOL ${index + 1}:`);
      console.log(`   🆔 ID RÉEL:     ${sol._id}`);
      console.log(`   📝 Nom:         ${sol.name}`);
      console.log(`   📊 Statut:      ${sol.status}`);
      console.log(`   👑 Créateur:    ${isCreator ? '✅ Vous' : '❌ Non'}`);
      console.log(`   👥 Participant: ${participantIndex !== -1 ? `✅ Oui (position ${participantIndex + 1})` : '❌ Non'}`);
      console.log(`   🔑 Code accès:  ${sol.accessCode}`);
      console.log(`   👥 Membres:     ${sol.participants.length}/${sol.maxParticipants}`);
    });
    
    console.log('\n' + '═'.repeat(80));
    console.log('\n🔧 CORRECTION POUR testAllSolMethods.js:');
    
    if (sols.length > 0) {
      const mainSol = sols[0];
      console.log(`\n// Remplacez dans testAllSolMethods.js:`);
      console.log(`const testSolId = '${mainSol._id}'; // ✅ ID CORRECT`);
      console.log(`const testAccessCode = '${mainSol.accessCode}'; // ✅ CODE CORRECT`);
    } else {
      console.log('\n⚠️ Aucun sol trouvé. Créez-en un d\'abord!');
    }
    
    // Vérifier le sol du test actuel
    console.log('\n\n🔍 VÉRIFICATION DU SOL DU TEST:');
    const testSolId = '68d4a49ba83fa0d4c1fbe151';
    
    try {
      const testSol = await Sol.findById(testSolId);
      
      if (!testSol) {
        console.log(`❌ Le Sol ID ${testSolId} N'EXISTE PAS dans la base!`);
        console.log('💡 C\'est pour ça que les tests échouent!');
      } else {
        console.log(`✅ Sol trouvé: ${testSol.name}`);
        
        const hasAccess = testSol.creator.toString() === user._id.toString() ||
          testSol.participants.some(p => p.user.toString() === user._id.toString());
        
        console.log(`   Accès: ${hasAccess ? '✅ Autorisé' : '❌ REFUSÉ'}`);
        
        if (!hasAccess) {
          console.log('\n💡 PROBLÈME: Vous n\'avez PAS accès à ce sol!');
          console.log('   C\'est pour ça que vous avez l\'erreur 403!');
        }
      }
    } catch (error) {
      console.log(`❌ Erreur: ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Vérification terminée');
  }
};

verifySolIds();