// src/app.js - Serveur Express FinApp Haiti
// ✅ AVEC ERRORHANDLER.JS INTÉGRÉ

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
require('dotenv').config();

// ===================================================================
// ✅ NOUVEAU : IMPORT ERROR HANDLER MIDDLEWARE
// ===================================================================
const { 
  globalErrorHandler, 
  notFoundHandler,
  handleUncaughtException,
  handleUnhandledRejection,
  handleSIGTERM 
} = require('./middleware/errorHandler');

// ===================================================================
// ✅ IMPORTANT : HANDLER UNCAUGHT EXCEPTIONS (AU TOUT DÉBUT)
// ===================================================================
handleUncaughtException();

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
// ROUTES API (préparées pour les phases suivantes)
// =============================================================================

// Routes Auth
app.use('/api/auth', require('./routes/auth'));

// Routes Users  
app.use('/api/users', require('./routes/users'));

// Routes Accounts
app.use('/api/accounts', require('./routes/accounts'));

// Routes Transactions
app.use('/api/transactions', require('./routes/transactions'));

// Routes Budgets
app.use('/api/budgets', require('./routes/budgets'));

// Routes Sols
app.use('/api/sols', require('./routes/sols'));

// Routes Investments
app.use('/api/investments', require('./routes/investments'));

// Routes Debts
app.use('/api/debts', require('./routes/debts'));

// Routes Notifications
app.use('/api/notifications', require('./routes/notifications'));

// Routes AI
app.use('/api/ai', require('./routes/ai'));

// TODO Phase 7: Routes Uploads
// app.use('/api/uploads', require('./routes/uploads'));

// =============================================================================
// ✅ NOUVEAU : ERROR HANDLING AVEC ERRORHANDLER.JS
// =============================================================================

/**
 * 404 - Route non trouvée
 * ✅ Utilise notFoundHandler du middleware errorHandler.js
 * À placer AVANT le globalErrorHandler
 */
app.use(notFoundHandler);

/**
 * Global Error Handler
 * ✅ Utilise globalErrorHandler du middleware errorHandler.js
 * Doit être le DERNIER middleware
 * 
 * Gère automatiquement :
 * - Erreurs opérationnelles (AppError et dérivées)
 * - Erreurs MongoDB (CastError, ValidationError, duplicates)
 * - Erreurs JWT (JsonWebTokenError, TokenExpiredError)
 * - Erreurs génériques avec stack trace en dev
 * - Logging centralisé
 */
app.use(globalErrorHandler);

// =============================================================================
// DÉMARRAGE SERVEUR
// =============================================================================
const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, () => {
  console.log('🚀 ================================');
  console.log('🚀 FinApp Haiti API démarrée!');
  console.log(`🚀 Port: ${PORT}`);
  console.log(`🚀 Environnement: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🚀 URL: http://localhost:${PORT}`);
  console.log(`🚀 Health: http://localhost:${PORT}/api/health`);
  console.log('🚀 ================================');
});

// =============================================================================
// ✅ NOUVEAU : PROCESS ERROR HANDLERS
// =============================================================================

/**
 * Gère les rejets de promesses non gérés (async errors)
 * ✅ Utilise handleUnhandledRejection du middleware errorHandler.js
 */
handleUnhandledRejection(server);

/**
 * Gère SIGTERM pour shutdown propre
 * ✅ Utilise handleSIGTERM du middleware errorHandler.js
 */
handleSIGTERM(server);

// =============================================================================
// EXPORT
// =============================================================================
module.exports = app;

/**
 * ===================================================================
 * DOCUMENTATION INTÉGRATION ERRORHANDLER.JS
 * ===================================================================
 * 
 * Modifications effectuées dans ce fichier :
 * 
 * 1. ✅ IMPORTS (ligne 15-22)
 *    - Ajout des imports errorHandler middleware
 *    - globalErrorHandler, notFoundHandler
 *    - handleUncaughtException, handleUnhandledRejection, handleSIGTERM
 * 
 * 2. ✅ UNCAUGHT EXCEPTIONS (ligne 27)
 *    - handleUncaughtException() appelé au tout début
 *    - Capture les erreurs synchrones non catchées
 * 
 * 3. ✅ 404 HANDLER (ligne 153)
 *    - app.use(notFoundHandler) après toutes les routes
 *    - Capture les routes inexistantes
 * 
 * 4. ✅ GLOBAL ERROR HANDLER (ligne 166)
 *    - app.use(globalErrorHandler) en dernier middleware
 *    - Gère toutes les erreurs de l'application
 * 
 * 5. ✅ UNHANDLED REJECTIONS (ligne 193)
 *    - handleUnhandledRejection(server) après server.listen
 *    - Capture les promesses rejetées non gérées
 * 
 * 6. ✅ SIGTERM HANDLER (ligne 199)
 *    - handleSIGTERM(server) pour shutdown propre
 *    - Ferme le serveur proprement lors de l'arrêt
 * 
 * Bénéfices :
 * - ✅ Gestion d'erreurs centralisée et cohérente
 * - ✅ Pas de crashes inattendus
 * - ✅ Logging centralisé de toutes les erreurs
 * - ✅ Messages d'erreurs clairs en dev, sécurisés en prod
 * - ✅ Recovery automatique des erreurs récupérables
 * - ✅ Shutdown propre du serveur
 * 
 * Prochaine étape :
 * - Refactorer les 10 controllers pour utiliser catchAsync
 * - Remplacer les try/catch par catchAsync wrapper
 * - Utiliser les classes d'erreurs (NotFoundError, etc.)
 * ===================================================================
 */