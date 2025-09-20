// src/config/database.js - Configuration MongoDB basique
const mongoose = require('mongoose');

/**
 * Connexion simple à MongoDB
 * Version basique - sera étendue progressivement
 */
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/finapp_haiti_dev';
    
    console.log('🔄 Connexion à MongoDB...');
    
    // Options simplifiées pour Mongoose 7+
    const conn = await mongoose.connect(mongoURI);
    
    console.log(`✅ MongoDB connecté: ${conn.connection.host}`);
    console.log(`📂 Database: ${conn.connection.name}`);
    
  } catch (error) {
    console.error('❌ Erreur connexion MongoDB:', error.message);
    process.exit(1);
  }
};

/**
 * Vérifier si connecté
 */
const isConnected = () => {
  return mongoose.connection.readyState === 1;
};

/**
 * Fermeture propre
 */
const closeConnection = async () => {
  try {
    await mongoose.connection.close();
    console.log('✅ Connexion MongoDB fermée');
  } catch (error) {
    console.error('❌ Erreur fermeture MongoDB:', error.message);
  }
};

// Event listeners basiques
mongoose.connection.on('error', (err) => {
  console.error('❌ Erreur MongoDB:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB déconnecté');
});

// Fermeture propre au exit
process.on('SIGINT', async () => {
  console.log('\n⏳ Fermeture de la connexion MongoDB...');
  await closeConnection();
  process.exit(0);
});

module.exports = {
  connectDB,
  isConnected,
  closeConnection
};