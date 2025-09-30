// src/routes/auth.js - Routes d'authentification FinApp Haiti
const express = require('express');
const rateLimit = require('express-rate-limit');

// Import controllers et middleware
const authController = require('../controllers/authController');
const { 
  authenticate,
  optionalAuth,
  requireRole,
  requireVerified,
  standardAuth,
  strictAuth,
  generalAuthLimiter,
  strictAuthLimiter
} = require('../middleware/auth');

// ✅ NOUVEAU : Import validation centralisée
const { validate } = require('../middleware/validation');

const router = express.Router();

/**
 * Routes d'authentification FinApp Haiti
 * 
 * Structure :
 * - Routes publiques (pas d'auth) : register, login, refresh, forgot-password, reset-password
 * - Routes protégées (auth requis) : logout, logout-all, change-password, sessions, cleanup
 * - Routes admin (admin requis) : users-sessions
 * - Utilitaires : health, me, verify-token
 * 
 * Sécurité :
 * - Rate limiting adapté par endpoint
 * - Validation Joi centralisée (validation.js) ✅
 * - Middleware auth pour protection routes
 */

// ===================================================================
// RATE LIMITING SPÉCIALISÉ POUR AUTH
// ===================================================================

/**
 * Rate limiter pour register/login (anti-spam)
 */
const authAttemptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 tentatives par IP par fenêtre
  message: {
    success: false,
    message: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.',
    error: 'auth_rate_limit_exceeded',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip
});

/**
 * Rate limiter pour reset password (anti-abuse)
 */
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 5, // 5 tentatives par IP par heure
  message: {
    success: false,
    message: 'Trop de demandes de réinitialisation. Réessayez dans 1 heure.',
    error: 'password_reset_rate_limit_exceeded',
    retryAfter: '1 hour'
  },
  keyGenerator: (req) => req.ip
});

/**
 * Rate limiter pour refresh token (éviter spam refresh)
 */
const refreshTokenLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // 20 refresh par IP par 5 minutes
  message: {
    success: false,
    message: 'Trop de demandes de renouvellement de token.',
    error: 'refresh_rate_limit_exceeded'
  },
  keyGenerator: (req) => req.ip
});

// ===================================================================
// ROUTES PUBLIQUES (PAS D'AUTHENTIFICATION REQUISE)
// ===================================================================

/**
 * @route   POST /api/auth/register
 * @desc    Enregistrer un nouvel utilisateur
 * @access  Public
 */
router.post('/register', 
  authAttemptLimiter,
  validate('auth', 'register'), // ✅ Validation centralisée
  authController.register
);

/**
 * @route   POST /api/auth/login
 * @desc    Connexion utilisateur
 * @access  Public
 */
router.post('/login', 
  authAttemptLimiter,
  validate('auth', 'login'), // ✅ Validation centralisée
  authController.login
);

/**
 * @route   POST /api/auth/refresh
 * @desc    Renouveler access token avec refresh token
 * @access  Public
 */
router.post('/refresh', 
  refreshTokenLimiter,
  validate('auth', 'refreshToken'), // ✅ Validation centralisée
  authController.refreshToken
);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Demander réinitialisation mot de passe
 * @access  Public
 */
router.post('/forgot-password', 
  passwordResetLimiter,
  validate('auth', 'forgotPassword'), // ✅ Validation centralisée
  authController.forgotPassword
);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Réinitialiser mot de passe avec token
 * @access  Public
 */
router.post('/reset-password', 
  passwordResetLimiter,
  validate('auth', 'resetPassword'), // ✅ Validation centralisée
  authController.resetPassword
);

// ===================================================================
// ROUTES PROTÉGÉES (AUTHENTIFICATION REQUISE)
// ===================================================================

/**
 * @route   POST /api/auth/logout
 * @desc    Déconnexion session courante
 * @access  Private
 */
router.post('/logout', 
  authenticate,
  generalAuthLimiter,
  authController.logout
);

/**
 * @route   POST /api/auth/logout-all
 * @desc    Déconnexion de toutes les sessions
 * @access  Private
 */
router.post('/logout-all', 
  ...strictAuth, // authenticate + strictAuthLimiter + requireVerified + logging
  authController.logoutAll
);

/**
 * @route   POST /api/auth/change-password
 * @desc    Changer mot de passe (utilisateur connecté)
 * @access  Private
 */
router.post('/change-password', 
  ...strictAuth, // Sécurité maximale pour changement password
  validate('auth', 'changePassword'), // ✅ Validation centralisée
  authController.changePassword
);

/**
 * @route   GET /api/auth/sessions
 * @desc    Lister sessions actives utilisateur
 * @access  Private
 */
router.get('/sessions', 
  ...standardAuth, // authenticate + generalAuthLimiter + logging + monitoring
  authController.getSessions
);

/**
 * @route   DELETE /api/auth/sessions/cleanup
 * @desc    Nettoyer sessions expirées
 * @access  Private
 */
router.delete('/sessions/cleanup', 
  ...standardAuth,
  authController.cleanupSessions
);

/**
 * @route   GET /api/auth/me
 * @desc    Obtenir infos utilisateur connecté
 * @access  Private
 */
router.get('/me',
  authenticate,
  generalAuthLimiter,
  authController.getCurrentUser
);

/**
 * @route   GET /api/auth/verify-token
 * @desc    Vérifier validité du token actuel
 * @access  Private
 */
router.get('/verify-token',
  authenticate,
  generalAuthLimiter,
  authController.verifyToken
);

// ===================================================================
// ROUTES ADMINISTRATIVES (RÔLE ADMIN REQUIS)
// ===================================================================

/**
 * @route   GET /api/auth/admin/users-sessions
 * @desc    Lister toutes les sessions actives (admin seulement)
 * @access  Private (admin uniquement)
 */
router.get('/admin/users-sessions', 
  authenticate,
  requireRole('admin'),
  strictAuthLimiter,
  authController.getAllUsersSessions
);

// ===================================================================
// ROUTES UTILITAIRES
// ===================================================================

/**
 * @route   GET /api/auth/health
 * @desc    Health check du service d'authentification
 * @access  Public
 */
router.get('/health', authController.healthCheck);

/**
 * @route   GET /api/auth
 * @desc    Information sur les endpoints d'authentification disponibles
 * @access  Public
 */
router.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Service d\'authentification FinApp Haiti 🇭🇹',
    data: {
      service: 'authentication',
      version: '1.0.0',
      description: 'Authentification sécurisée avec JWT et sessions multi-device',
      endpoints: {
        public: {
          register: 'POST /api/auth/register',
          login: 'POST /api/auth/login',
          refresh: 'POST /api/auth/refresh',
          forgotPassword: 'POST /api/auth/forgot-password',
          resetPassword: 'POST /api/auth/reset-password',
          health: 'GET /api/auth/health'
        },
        private: {
          logout: 'POST /api/auth/logout',
          logoutAll: 'POST /api/auth/logout-all',
          changePassword: 'POST /api/auth/change-password',
          sessions: 'GET /api/auth/sessions',
          cleanup: 'DELETE /api/auth/sessions/cleanup',
          me: 'GET /api/auth/me',
          verifyToken: 'GET /api/auth/verify-token'
        },
        admin: {
          usersSessions: 'GET /api/auth/admin/users-sessions'
        }
      },
      rateLimits: {
        register: '10 / 15 minutes',
        login: '10 / 15 minutes',
        refresh: '20 / 5 minutes',
        passwordReset: '5 / 1 hour',
        general: '1000 / 15 minutes',
        strict: '50 / 1 hour'
      },
      security: {
        jwt: 'HS256 algorithm',
        sessions: 'Multi-device session tracking',
        rateLimit: 'IP and user-based limiting',
        validation: 'Joi centralized validation' // ✅ Mise à jour
      }
    },
    timestamp: new Date().toISOString()
  });
});

// ===================================================================
// ERROR HANDLING SPÉCIALISÉ AUTH
// ===================================================================

/**
 * Middleware d'erreur spécialisé pour les routes auth
 * Gère les erreurs d'authentification avec messages adaptés
 */
router.use((error, req, res, next) => {
  console.error('❌ Erreur routes auth:', error.message);
  
  // Erreurs JWT spécifiques
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Token d\'authentification invalide',
      error: 'invalid_jwt_token',
      timestamp: new Date().toISOString()
    });
  }
  
  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token d\'authentification expiré',
      error: 'expired_jwt_token',
      hint: 'Utilisez le refresh token pour renouveler',
      timestamp: new Date().toISOString()
    });
  }
  
  // Erreurs MongoDB/Mongoose
  if (error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    return res.status(400).json({
      success: false,
      message: `${field === 'email' ? 'Email' : 'Téléphone'} déjà utilisé`,
      error: 'duplicate_field',
      field: field,
      timestamp: new Date().toISOString()
    });
  }
  
  // Erreur générale
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Erreur interne du service d\'authentification',
    error: 'auth_service_error',
    timestamp: new Date().toISOString()
  });
});

// ===================================================================
// EXPORTS
// ===================================================================
module.exports = router;