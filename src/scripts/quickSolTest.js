// 🚀 TEST RAPIDE ACCÈS SOL - FINAPP HAITI
// Créer ce fichier: src/scripts/quickSolTest.js
// 
// Test rapide pour identifier le problème d'accès au sol
// Usage: node src/scripts/quickSolTest.js

const mongoose = require('mongoose');
const Sol = require('../models/Sol');
const User = require('../models/User');
require('dotenv').config({ path: '.env.local' });

// Configuration (modifiez selon vos besoins)
const CONFIG = {
  SOL_ID: '66d4a49ba83fa0d4c1fbe152', // ID du sol depuis votre interface
  USER_EMAIL: 'hantzmichaelchery6@gmail.com' // Votre email
};

const quickTest = async () => {
  try {
    console.log('🚀 Test rapide accès sol...\n');
    
    // Connexion MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connecté\n');
    
    // Récupérer l'utilisateur
    const user = await User.findOne({ email: CONFIG.USER_EMAIL });
    if (!user) {
      console.log('❌ Utilisateur non trouvé:', CONFIG.USER_EMAIL);
      return;
    }
    console.log('✅ Utilisateur trouvé:', user.email);
    
    // Récupérer le sol
    const sol = await Sol.findById(CONFIG.SOL_ID)
      .populate('creator', 'firstName lastName email')
      .populate('participants.user', 'firstName lastName email');
      
    if (!sol) {
      console.log('❌ Sol non trouvé:', CONFIG.SOL_ID);
      return;
    }
    console.log('✅ Sol trouvé:', sol.name);
    
    // Test accès
    const isCreator = sol.creator._id.toString() === user._id.toString();
    const isParticipant = sol.participants.some(p => 
      p.user._id.toString() === user._id.toString()
    );
    
    console.log('\n🔍 RÉSULTATS:');
    console.log(`Creator ID: ${sol.creator._id}`);
    console.log(`User ID:    ${user._id}`);
    console.log(`Est créateur: ${isCreator ? '✅' : '❌'}`);
    console.log(`Est participant: ${isParticipant ? '✅' : '❌'}`);
    console.log(`Accès autorisé: ${isCreator || isParticipant ? '✅' : '❌'}`);
    
    if (isParticipant) {
      const participant = sol.participants.find(p => 
        p.user._id.toString() === user._id.toString()
      );
      console.log(`Position: ${participant.position}`);
      console.log(`Rôle: ${participant.role || 'participant'}`);
    }
    
    // Afficher tous les participants
    console.log('\n👥 PARTICIPANTS:');
    sol.participants.forEach((p, index) => {
      const match = p.user._id.toString() === user._id.toString() ? '🎯' : '  ';
      console.log(`${match} ${index + 1}. ${p.user.email} (${p.user._id})`);
    });
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Test terminé');
  }
};

quickTest();