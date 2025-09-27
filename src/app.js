// src/app.js - Serveur Express basique FinApp Haiti
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
require('dotenv').config();

// Import configuration database
const { connectDB } = require('./config/database');

const app = express();

// =============================================================================
// CONNEXION DATABASE
// =============================================================================
connectDB();

// =============================================================================
// MIDDLEWARE BASIQUES
// =============================================================================

// Sécurité headers
app.use(helmet());

// Compression responses
app.use(compression());

// CORS pour frontend React (port 3000)
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));

// Parsing JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging en développement
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// =============================================================================
// ROUTES DE BASE
// =============================================================================

// Route de bienvenue
app.get('/', (req, res) => {
  res.json({
    message: 'FinApp Haiti API 🇭🇹',
    version: '1.0.0',
    status: 'running'
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'FinApp Haiti API fonctionne!',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Route info API
app.get('/api', (req, res) => {
  res.json({
    message: 'Bienvenue sur l\'API FinApp Haiti! 🇭🇹',
    description: 'Gestion financière adaptée au contexte haïtien',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      info: '/api'
    }
  });
});

// =============================================================================
// ROUTES FUTURES (préparées pour les phases suivantes)
// =============================================================================

// TODO Phase 3: Routes Auth
app.use('/api/auth', require('./routes/auth'));

// TODO Phase 4: Routes Users  
app.use('/api/users', require('./routes/users'));

// TODO Phase 4: Routes Accounts
app.use('/api/accounts', require('./routes/accounts'));

// TODO Phase 5: Routes Transactions
app.use('/api/transactions', require('./routes/transactions'));

// TODO Phase 5: Routes Budgets
app.use('/api/budgets', require('./routes/budgets'));

// TODO Phase 6: Routes Sols
app.use('/api/sols', require('./routes/sols'));

// TODO Phase 6: Routes Investments
app.use('/api/investments', require('./routes/investments'));

app.use('/api/debts', require('./routes/debts'));

app.use('/api/ai', require('./routes/ai'));

// TODO Phase 7: Routes Uploads
// app.use('/api/uploads', require('./routes/uploads'));

// =============================================================================
// ERROR HANDLING
// =============================================================================

// Route 404 - Catch all
app.use((req, res) => {
  res.status(404).json({
    error: 'Route non trouvée',
    message: `${req.method} ${req.originalUrl} n'existe pas`,
    suggestion: 'Visitez /api pour voir les endpoints disponibles'
  });
});

// Global error handler basique
app.use((err, req, res, next) => {
  console.error('❌ Erreur:', err.message);
  
  res.status(err.status || 500).json({
    error: 'Erreur serveur',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Une erreur est survenue'
  });
});

// =============================================================================
// DÉMARRAGE SERVEUR
// =============================================================================
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log('🚀 ================================');
  console.log('🚀 FinApp Haiti API démarrée!');
  console.log(`🚀 Port: ${PORT}`);
  console.log(`🚀 Environnement: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🚀 URL: http://localhost:${PORT}`);
  console.log(`🚀 Health: http://localhost:${PORT}/api/health`);
  console.log('🚀 ================================');
});

module.exports = app;