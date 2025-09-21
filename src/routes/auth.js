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

const router = express.Router();

/**
 * Routes d'authentification FinApp Haiti
 * 
 * Structure :
 * - Routes publiques (pas d'auth) : register, login, refresh, forgot-password, reset-password
 * - Routes protégées (auth requis) : logout, logout-all, change-password, sessions, cleanup
 * - Health check : service status
 * 
 * Sécurité :
 * - Rate limiting adapté par endpoint
 * - Validation express-validator dans controllers
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
  keyGenerator: (req) => {
    // Rate limit par IP pour register/login
    return req.ip;
  }
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
 * @rateLimit 10 tentatives / 15 minutes par IP
 * 
 * Body: {
 *   firstName: string,
 *   lastName: string, 
 *   email: string,
 *   password: string,
 *   phone?: string,
 *   region: string,
 *   city: string,
 *   agreeToTerms: boolean
 * }
 * 
 * Response: {
 *   success: true,
 *   message: string,
 *   data: {
 *     user: UserObject,
 *     tokens: { accessToken, tokenType, expiresIn },
 *     session: { sessionId, deviceId }
 *   }
 * }
 */
router.post('/register', 
  authAttemptLimiter,
  authController.register
);

/**
 * @route   POST /api/auth/login
 * @desc    Connexion utilisateur
 * @access  Public
 * @rateLimit 10 tentatives / 15 minutes par IP
 * 
 * Body: {
 *   identifier: string, // email ou téléphone
 *   password: string,
 *   rememberMe?: boolean
 * }
 * 
 * Response: {
 *   success: true,
 *   message: string,
 *   data: {
 *     user: UserObject,
 *     tokens: { accessToken, tokenType, expiresIn },
 *     session: { sessionId, deviceId, deviceInfo }
 *   }
 * }
 */
router.post('/login', 
  authAttemptLimiter,
  authController.login
);

/**
 * @route   POST /api/auth/refresh
 * @desc    Renouveler access token avec refresh token
 * @access  Public
 * @rateLimit 20 tentatives / 5 minutes par IP
 * 
 * Body: {
 *   refreshToken: string
 * }
 * 
 * Response: {
 *   success: true,
 *   message: string,
 *   data: {
 *     tokens: { accessToken, tokenType, expiresIn },
 *     session: { sessionId, deviceId }
 *   }
 * }
 */
router.post('/refresh', 
  refreshTokenLimiter,
  authController.refreshToken
);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Demander réinitialisation mot de passe
 * @access  Public
 * @rateLimit 5 tentatives / 1 heure par IP
 * 
 * Body: {
 *   email: string
 * }
 * 
 * Response: {
 *   success: true,
 *   message: "Si cet email existe, un lien de réinitialisation a été envoyé"
 * }
 */
router.post('/forgot-password', 
  passwordResetLimiter,
  authController.forgotPassword
);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Réinitialiser mot de passe avec token
 * @access  Public
 * @rateLimit 5 tentatives / 1 heure par IP
 * 
 * Body: {
 *   resetToken: string,
 *   newPassword: string,
 *   confirmPassword: string
 * }
 * 
 * Response: {
 *   success: true,
 *   message: "Mot de passe réinitialisé avec succès"
 * }
 */
router.post('/reset-password', 
  passwordResetLimiter,
  authController.resetPassword
);

// ===================================================================
// ROUTES PROTÉGÉES (AUTHENTIFICATION REQUISE)
// ===================================================================

/**
 * @route   POST /api/auth/logout
 * @desc    Déconnexion session courante
 * @access  Private (authentification requise)
 * @middleware authenticate + generalAuthLimiter
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Response: {
 *   success: true,
 *   message: "Déconnexion réussie. À bientôt! 👋"
 * }
 */
router.post('/logout', 
  authenticate,
  generalAuthLimiter,
  authController.logout
);

/**
 * @route   POST /api/auth/logout-all
 * @desc    Déconnexion de toutes les sessions
 * @access  Private (authentification requise)
 * @middleware strictAuth (auth + strict rate limiting + logging)
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Response: {
 *   success: true,
 *   message: "Déconnexion de toutes les sessions réussie"
 * }
 */
router.post('/logout-all', 
  ...strictAuth, // authenticate + strictAuthLimiter + requireVerified + logging
  authController.logoutAll
);

/**
 * @route   POST /api/auth/change-password
 * @desc    Changer mot de passe (utilisateur connecté)
 * @access  Private (authentification + compte vérifié)
 * @middleware strictAuth (sécurité renforcée pour changement password)
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Body: {
 *   currentPassword: string,
 *   newPassword: string,
 *   confirmPassword: string
 * }
 * 
 * Response: {
 *   success: true,
 *   message: "Mot de passe modifié avec succès"
 * }
 */
router.post('/change-password', 
  ...strictAuth, // Sécurité maximale pour changement password
  authController.changePassword
);

/**
 * @route   GET /api/auth/sessions
 * @desc    Lister sessions actives utilisateur
 * @access  Private (authentification requise)
 * @middleware standardAuth (auth standard + logging + monitoring)
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Response: {
 *   success: true,
 *   message: "Sessions récupérées avec succès",
 *   data: {
 *     sessions: [SessionObject],
 *     totalSessions: number
 *   }
 * }
 */
router.get('/sessions', 
  ...standardAuth, // authenticate + generalAuthLimiter + logging + monitoring
  authController.getSessions
);

/**
 * @route   DELETE /api/auth/sessions/cleanup
 * @desc    Nettoyer sessions expirées
 * @access  Private (authentification requise)
 * @middleware standardAuth
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Response: {
 *   success: true,
 *   message: "X sessions expirées supprimées",
 *   data: {
 *     sessionsRemoved: number,
 *     activeSessions: number
 *   }
 * }
 */
router.delete('/sessions/cleanup', 
  ...standardAuth,
  authController.cleanupSessions
);

// ===================================================================
// ROUTES ADMINISTRATIVES (RÔLE ADMIN REQUIS)
// ===================================================================

/**
 * @route   GET /api/auth/admin/users-sessions
 * @desc    Lister toutes les sessions actives (admin seulement)
 * @access  Private (admin uniquement)
 * @middleware authenticate + requireRole('admin') + strictAuthLimiter
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     totalActiveSessions: number,
 *     sessionsByRegion: Array,
 *     deviceStats: Object
 *   }
 * }
 */
router.get('/admin/users-sessions', 
  authenticate,
  requireRole('admin'),
  strictAuthLimiter,
  async (req, res) => {
    try {
      // TODO: Implémenter dans authController si nécessaire
      res.status(200).json({
        success: true,
        message: 'Fonctionnalité admin en développement',
        data: {
          info: 'Statistiques sessions globales à venir'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erreur récupération statistiques',
        error: error.message
      });
    }
  }
);

// ===================================================================
// ROUTES UTILITAIRES & HEALTH CHECK
// ===================================================================

/**
 * @route   GET /api/auth/health
 * @desc    Health check service authentification
 * @access  Public
 * 
 * Response: {
 *   success: true,
 *   message: "Service d'authentification opérationnel",
 *   data: {
 *     service: "auth",
 *     version: "1.0.0",
 *     endpoints: Object
 *   }
 * }
 */
router.get('/health', authController.healthCheck);

/**
 * @route   GET /api/auth/me
 * @desc    Récupérer informations utilisateur connecté
 * @access  Private (authentification requise)
 * @middleware optionalAuth (permet auth optionnelle)
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>" (optionnel)
 * }
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     user: UserObject | null,
 *     authenticated: boolean
 *   }
 * }
 */
router.get('/me', 
  optionalAuth,
  (req, res) => {
    try {
      res.status(200).json({
        success: true,
        data: {
          user: req.user || null,
          authenticated: !!req.user,
          session: req.user ? {
            sessionId: req.user.sessionId,
            tokenExpiringSoon: req.user.tokenExpiringSoon
          } : null
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erreur récupération profil utilisateur',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * @route   GET /api/auth/verify-token
 * @desc    Vérifier validité d'un token (pour frontend)
 * @access  Private (authentification requise)
 * @middleware authenticate + generalAuthLimiter
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     valid: boolean,
 *     user: UserObject,
 *     tokenExpiringSoon: boolean
 *   }
 * }
 */
router.get('/verify-token', 
  authenticate,
  generalAuthLimiter,
  (req, res) => {
    try {
      res.status(200).json({
        success: true,
        message: 'Token valide',
        data: {
          valid: true,
          user: {
            userId: req.user.userId,
            email: req.user.email,
            firstName: req.user.firstName,
            lastName: req.user.lastName,
            role: req.user.role,
            isVerified: req.user.isVerified
          },
          session: {
            sessionId: req.user.sessionId,
            lastActivity: req.user.lastActivity
          },
          tokenExpiringSoon: req.user.tokenExpiringSoon || false
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erreur vérification token',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

// ===================================================================
// ROUTE INFO ENDPOINTS
// ===================================================================

/**
 * @route   GET /api/auth
 * @desc    Information sur les endpoints d'authentification disponibles
 * @access  Public
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     service: "authentication",
 *     version: "1.0.0",
 *     endpoints: Object
 *   }
 * }
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
        strict: '50 / 1 hour',
        admin: '100 / 5 minutes'
      },
      security: {
        jwt: 'HS256 algorithm',
        sessions: 'Multi-device session tracking',
        rateLimit: 'IP and user-based limiting',
        validation: 'Express-validator with Haiti context'
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