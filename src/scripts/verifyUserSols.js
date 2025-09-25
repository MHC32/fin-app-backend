// 🔍 VÉRIFICATION SOLS UTILISATEUR - FINAPP HAITI
// Créer ce fichier: src/scripts/verifyUserSols.js
// 
// Ce script liste TOUS vos sols avec leurs vrais IDs
// Usage: node src/scripts/verifyUserSols.js

const mongoose = require('mongoose');
const Sol = require('../models/Sol');
const User = require('../models/User');
require('dotenv').config({ path: '.env.local' });

const verifyUserSols = async () => {
  try {
    console.log('🔍 VÉRIFICATION SOLS UTILISATEUR...\n');
    
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
    console.log('🆔 USER ID:', user._id);
    console.log('📧 EMAIL:', user.email);
    console.log('');
    
    // Chercher TOUS les sols de cet utilisateur (créateur OU participant)
    const sols = await Sol.find({
      $or: [
        { creator: user._id },
        { 'participants.user': user._id }
      ]
    })
    .populate('creator', 'firstName lastName email')
    .populate('participants.user', 'firstName lastName email')
    .sort({ createdAt: -1 });
    
    console.log('📊 SOLS TROUVÉS:', sols.length);
    console.log('='.repeat(80));
    
    if (sols.length === 0) {
      console.log('⚠️ Aucun sol trouvé pour cet utilisateur');
      return;
    }
    
    sols.forEach((sol, index) => {
      console.log(`\n🏷️ SOL ${index + 1}:`);
      console.log(`  🆔 ID RÉEL:        ${sol._id}`);
      console.log(`  📝 Nom:            ${sol.name}`);
      console.log(`  📄 Description:    ${sol.description || 'Aucune'}`);
      console.log(`  📊 Statut:         ${sol.status}`);
      console.log(`  🏷️ Type:           ${sol.type}`);
      console.log(`  💰 Montant:        ${sol.contributionAmount} ${sol.currency}`);
      console.log(`  👥 Participants:   ${sol.participants.length}/${sol.maxParticipants}`);
      console.log(`  🔑 Code d'accès:   ${sol.accessCode}`);
      console.log(`  📅 Créé le:        ${sol.createdAt.toLocaleDateString()}`);
      console.log(`  📅 Modifié le:     ${sol.updatedAt.toLocaleDateString()}`);
      
      // Vérifier votre rôle
      const isCreator = sol.creator._id.toString() === user._id.toString();
      const participant = sol.participants.find(p => 
        p.user._id.toString() === user._id.toString()
      );
      
      console.log(`  👑 Votre rôle:     ${isCreator ? 'CRÉATEUR' : (participant ? `PARTICIPANT (position ${participant.position})` : 'AUCUN')}`);
      
      // Créateur
      console.log(`  🏗️ Créateur:       ${sol.creator.firstName} ${sol.creator.lastName} (${sol.creator.email})`);
      
      // Liste des participants
      console.log(`  👥 Participants:`);
      sol.participants.forEach((p, pIndex) => {
        const isYou = p.user._id.toString() === user._id.toString();
        const marker = isYou ? '🎯' : '  ';
        console.log(`    ${marker} ${pIndex + 1}. ${p.user.firstName} ${p.user.lastName} - Position ${p.position}`);
      });
      
      console.log('  ' + '-'.repeat(60));
    });
    
    // Recommandations
    console.log('\n🎯 RECOMMANDATIONS:');
    console.log('1. Utilisez les IDs RÉELS ci-dessus dans votre interface');
    console.log('2. Si vous voyez un ID différent dans l\'interface, il y a un bug');
    console.log('3. Vérifiez que votre frontend utilise les bons endpoints');
    console.log('4. Videz le cache si les IDs ne correspondent pas');
    
    // Test d'accès avec le vrai ID
    if (sols.length > 0) {
      console.log('\n🧪 TEST ACCÈS AVEC LE VRAI ID:');
      const realSol = sols[0];
      console.log(`Testez avec: node src/scripts/debugSolAccess.js ${realSol._id} ${userEmail}`);
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Vérification terminée');
  }
};

verifyUserSols();