// src/controllers/authController.js - Controllers authentification FinApp Haiti
const { body, validationResult } = require('express-validator');
const authService = require('../services/authService');

/**
 * Controllers d'authentification utilisant authService.js
 * Gestion complète : register, login, refresh, logout, password management
 * 
 * CORRECTIONS APPORTÉES:
 * - Appels authService avec paramètres corrects (pas d'objets imbriqués)
 * - Gestion d'erreur robuste avec success/failure
 * - Validation express-validator intégrée
 * - Headers sécurisés et cookies
 */

// ===================================================================
// UTILITAIRES & VALIDATION
// ===================================================================

/**
 * Extraire informations device de la requête
 * @param {Object} req - Requête Express
 * @returns {Object} - Informations device formatées
 */
const extractDeviceInfo = (req) => {
  const userAgent = req.get('User-Agent') || '';
  const forwarded = req.get('X-Forwarded-For');
  const ip = forwarded ? forwarded.split(',')[0] : req.connection.remoteAddress;
  
  // Parse User-Agent basique
  const deviceInfo = {
    userAgent,
    ip: ip || 'unknown',
    device: 'unknown',
    browser: 'unknown',
    os: 'unknown',
    location: req.get('X-User-Location') || ''
  };
  
  // Détection basique device
  if (userAgent) {
    if (/Mobile|Android|iPhone|iPad/i.test(userAgent)) {
      deviceInfo.device = 'mobile';
    } else if (/Tablet|iPad/i.test(userAgent)) {
      deviceInfo.device = 'tablet';
    } else {
      deviceInfo.device = 'desktop';
    }
    
    // Détection browser
    if (/Chrome/i.test(userAgent)) deviceInfo.browser = 'Chrome';
    else if (/Firefox/i.test(userAgent)) deviceInfo.browser = 'Firefox';
    else if (/Safari/i.test(userAgent)) deviceInfo.browser = 'Safari';
    else if (/Edge/i.test(userAgent)) deviceInfo.browser = 'Edge';
    
    // Détection OS
    if (/Windows/i.test(userAgent)) deviceInfo.os = 'Windows';
    else if (/Mac/i.test(userAgent)) deviceInfo.os = 'macOS';
    else if (/Linux/i.test(userAgent)) deviceInfo.os = 'Linux';
    else if (/Android/i.test(userAgent)) deviceInfo.os = 'Android';
    else if (/iOS|iPhone|iPad/i.test(userAgent)) deviceInfo.os = 'iOS';
  }
  
  return deviceInfo;
};

/**
 * Formater response d'erreur validation
 * @param {Array} errors - Erreurs de validation express-validator
 * @returns {Object} - Erreurs formatées
 */
const formatValidationErrors = (errors) => {
  const formattedErrors = {};
  
  errors.forEach(error => {
    if (!formattedErrors[error.path]) {
      formattedErrors[error.path] = [];
    }
    formattedErrors[error.path].push(error.msg);
  });
  
  return formattedErrors;
};

/**
 * Middleware validation des résultats
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express  
 * @param {Function} next - Next middleware
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Erreurs de validation',
      errors: formatValidationErrors(errors.array()),
      timestamp: new Date().toISOString()
    });
  }
  
  next();
};

// ===================================================================
// VALIDATIONS RÈGLES
// ===================================================================

/**
 * Règles validation enregistrement
 */
const registerValidation = [
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('Le prénom est requis')
    .isLength({ min: 2, max: 50 })
    .withMessage('Le prénom doit contenir entre 2 et 50 caractères')
    .matches(/^[a-zA-ZÀ-ÿ\s-']+$/)
    .withMessage('Le prénom ne peut contenir que des lettres, espaces, tirets et apostrophes'),
    
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Le nom de famille est requis')
    .isLength({ min: 2, max: 50 })
    .withMessage('Le nom doit contenir entre 2 et 50 caractères')
    .matches(/^[a-zA-ZÀ-ÿ\s-']+$/)
    .withMessage('Le nom ne peut contenir que des lettres, espaces, tirets et apostrophes'),
    
  body('email')
    .trim()
    .normalizeEmail()
    .isEmail()
    .withMessage('Format d\'email invalide')
    .isLength({ max: 100 })
    .withMessage('L\'email ne peut pas dépasser 100 caractères'),
    
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Le mot de passe doit contenir entre 8 et 128 caractères')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).*$/)
    .withMessage('Le mot de passe doit contenir au moins : 1 minuscule, 1 majuscule, 1 chiffre et 1 caractère spécial'),
    
  body('phone')
    .optional()
    .trim()
    .matches(/^(\+509)?[0-9]{8}$/)
    .withMessage('Format de téléphone haïtien invalide (ex: +50932123456 ou 32123456)'),
    
  body('region')
    .notEmpty()
    .withMessage('La région est requise')
    .isIn(['ouest', 'nord', 'sud', 'artibonite', 'centre', 'nord-est', 'nord-ouest', 'sud-est', 'grande-anse', 'nippes'])
    .withMessage('Région haïtienne invalide'),
    
  body('city')
    .trim()
    .notEmpty()
    .withMessage('La ville est requise')
    .isLength({ min: 2, max: 50 })
    .withMessage('La ville doit contenir entre 2 et 50 caractères'),
    
  body('agreeToTerms')
    .isBoolean()
    .withMessage('L\'acceptation des conditions doit être un booléen')
    .custom(value => {
      if (!value) {
        throw new Error('Vous devez accepter les conditions d\'utilisation');
      }
      return true;
    })
];

/**
 * Règles validation connexion
 */
const loginValidation = [
  body('identifier')
    .trim()
    .notEmpty()
    .withMessage('Email ou téléphone requis')
    .isLength({ min: 3, max: 100 })
    .withMessage('Identifiant invalide'),
    
  body('password')
    .notEmpty()
    .withMessage('Mot de passe requis')
    .isLength({ min: 1, max: 128 })
    .withMessage('Mot de passe invalide'),
    
  body('rememberMe')
    .optional()
    .isBoolean()
    .withMessage('Remember me doit être un booléen')
];

/**
 * Règles validation refresh token
 */
const refreshValidation = [
  body('refreshToken')
    .notEmpty()
    .withMessage('Refresh token requis')
    .isLength({ min: 10 })
    .withMessage('Format refresh token invalide')
];

/**
 * Règles validation reset password
 */
const resetPasswordValidation = [
  body('email')
    .trim()
    .normalizeEmail()
    .isEmail()
    .withMessage('Format d\'email invalide')
    .isLength({ max: 100 })
    .withMessage('Email trop long')
];

/**
 * Règles validation nouveau mot de passe
 */
const newPasswordValidation = [
  body('resetToken')
    .notEmpty()
    .withMessage('Token de réinitialisation requis')
    .isLength({ min: 10 })
    .withMessage('Format token invalide'),
    
  body('newPassword')
    .isLength({ min: 8, max: 128 })
    .withMessage('Le mot de passe doit contenir entre 8 et 128 caractères')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).*$/)
    .withMessage('Le mot de passe doit contenir au moins : 1 minuscule, 1 majuscule, 1 chiffre et 1 caractère spécial'),
    
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('La confirmation ne correspond pas au nouveau mot de passe');
      }
      return true;
    })
];

/**
 * Règles validation changement mot de passe
 */
const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Mot de passe actuel requis'),
    
  body('newPassword')
    .isLength({ min: 8, max: 128 })
    .withMessage('Le mot de passe doit contenir entre 8 et 128 caractères')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).*$/)
    .withMessage('Le mot de passe doit contenir au moins : 1 minuscule, 1 majuscule, 1 chiffre et 1 caractère spécial'),
    
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('La confirmation ne correspond pas au nouveau mot de passe');
      }
      return true;
    })
];

// ===================================================================
// CONTROLLERS D'AUTHENTIFICATION
// ===================================================================

/**
 * Enregistrer un nouvel utilisateur
 * POST /api/auth/register
 */
const register = async (req, res) => {
  try {
    // 1. Validation d'entrée déjà faite par middleware
    const { 
      firstName, 
      lastName, 
      email, 
      password, 
      phone, 
      region, 
      city,
      agreeToTerms 
    } = req.body;
    
    // 2. Extraire infos device
    const deviceInfo = extractDeviceInfo(req);
    
    // 3. Appeler service d'authentification
    const result = await authService.registerUser({
      firstName,
      lastName,
      email,
      password,
      phone,
      region,
      city
    }, deviceInfo);
    
    // 4. Vérifier résultat du service
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error,
        error: 'register_failed',
        timestamp: new Date().toISOString()
      });
    }
    
    // 5. Set refresh token en cookie sécurisé
    if (result.tokens?.refreshToken) {
      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 jours
      });
    }
    
    // 6. Réponse succès
    res.status(201).json({
      success: true,
      message: `Bienvenue dans FinApp Haiti! 🇭🇹`,
      data: {
        user: result.user,
        tokens: {
          accessToken: result.tokens.accessToken,
          refreshToken: result.tokens.refreshToken,
          tokenType: result.tokens.tokenType,
          expiresIn: result.tokens.expiresIn
        },
        session: result.session
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Erreur register:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'Erreur interne lors de l\'inscription',
      error: 'register_internal_error',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Connexion utilisateur - CORRECTION PRINCIPALE
 * POST /api/auth/login
 */
const login = async (req, res) => {
  try {
    // 1. Validation d'entrée déjà faite par middleware
    const { identifier, password, rememberMe = false } = req.body;
    
    // 2. Extraire infos device
    const deviceInfo = extractDeviceInfo(req);
    
    // 3. Appeler service d'authentification - CORRECTION ICI
    const result = await authService.loginUser(identifier, password, deviceInfo);
    
    // 4. Vérifier résultat du service
    if (!result.success) {
      return res.status(401).json({
        success: false,
        message: result.error,
        error: 'login_failed',
        timestamp: new Date().toISOString()
      });
    }
    
    // 5. Set refresh token en cookie si remember me
    if (rememberMe && result.tokens?.refreshToken) {
      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 jours
      });
    }
    
    // 6. Réponse succès
    res.status(200).json({
      success: true,
      message: `Bon retour ${result.user?.firstName || 'utilisateur'}! 👋`,
      data: {
        user: result.user,
        tokens: {
          accessToken: result.tokens.accessToken,
          refreshToken: result.tokens.refreshToken,
          tokenType: result.tokens.tokenType,
          expiresIn: result.tokens.expiresIn
        },
        session: result.session
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Erreur login:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'Erreur interne lors de la connexion',
      error: 'login_internal_error',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Refresh token
 * POST /api/auth/refresh
 */
const refreshToken = async (req, res) => {
  try {
    // 1. Validation d'entrée déjà faite par middleware
    const { refreshToken } = req.body;
    const deviceInfo = extractDeviceInfo(req);
    
    // 2. Appeler service refresh
    const result = await authService.refreshTokens(refreshToken, deviceInfo);
    
    // 3. Vérifier résultat du service
    if (!result.success) {
      return res.status(401).json({
        success: false,
        message: result.error,
        error: 'refresh_failed',
        timestamp: new Date().toISOString()
      });
    }
    
    // 4. Réponse succès
    res.status(200).json({
      success: true,
      message: 'Token renouvelé avec succès',
      data: {
        tokens: result.tokens,
        session: result.session
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Erreur refresh token:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'Erreur interne lors du renouvellement',
      error: 'refresh_internal_error',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Déconnexion session courante
 * POST /api/auth/logout
 */
const logout = async (req, res) => {
  try {
    const { userId, sessionId } = req.user; // Ajouté par middleware auth
    
    // Appeler service déconnexion
    const result = await authService.logoutUser(userId, sessionId);
    
    // Vérifier résultat du service
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error,
        error: 'logout_failed',
        timestamp: new Date().toISOString()
      });
    }
    
    // Supprimer refresh token cookie
    res.clearCookie('refreshToken');
    
    res.status(200).json({
      success: true,
      message: 'Déconnexion réussie. À bientôt! 👋',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Erreur logout:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'Erreur interne lors de la déconnexion',
      error: 'logout_internal_error',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Déconnexion toutes sessions
 * POST /api/auth/logout-all
 */
const logoutAll = async (req, res) => {
  try {
    const { userId } = req.user; // Ajouté par middleware auth
    
    // Appeler service déconnexion globale
    const result = await authService.logoutAllSessions(userId);
    
    // Vérifier résultat du service
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error,
        error: 'logout_all_failed',
        timestamp: new Date().toISOString()
      });
    }
    
    // Supprimer refresh token cookie
    res.clearCookie('refreshToken');
    
    res.status(200).json({
      success: true,
      message: 'Déconnexion de tous les appareils réussie',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Erreur logout all:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'Erreur interne lors de la déconnexion globale',
      error: 'logout_all_internal_error',
      timestamp: new Date().toISOString()
    });
  }
};

// ===================================================================
// GESTION MOTS DE PASSE
// ===================================================================

/**
 * Demander réinitialisation mot de passe
 * POST /api/auth/forgot-password
 */
const forgotPassword = async (req, res) => {
  try {
    // 1. Validation d'entrée déjà faite par middleware
    const { email } = req.body;
    
    // 2. Appeler service reset password
    const result = await authService.generatePasswordResetToken(email);
    
    // 3. Toujours répondre succès pour sécurité (ne pas révéler si email existe)
    res.status(200).json({
      success: true,
      message: 'Si cet email existe, un lien de réinitialisation a été envoyé',
      timestamp: new Date().toISOString()
    });
    
    // 4. TODO: Envoyer email si result.success et result.resetToken existe
    // emailService.sendPasswordReset(result.email, result.resetToken);
    
  } catch (error) {
    console.error('❌ Erreur forgot password:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'Erreur interne lors de la demande de réinitialisation',
      error: 'forgot_password_internal_error',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Réinitialiser mot de passe avec token
 * POST /api/auth/reset-password
 */
const resetPassword = async (req, res) => {
  try {
    // 1. Validation d'entrée déjà faite par middleware
    const { resetToken, newPassword } = req.body;
    
    // 2. Appeler service reset password
    const result = await authService.resetPassword(resetToken, newPassword);
    
    // 3. Vérifier résultat du service
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error,
        error: 'reset_password_failed',
        timestamp: new Date().toISOString()
      });
    }
    
    // 4. Réponse succès
    res.status(200).json({
      success: true,
      message: 'Mot de passe réinitialisé avec succès',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Erreur reset password:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'Erreur interne lors de la réinitialisation',
      error: 'reset_password_internal_error',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Changer mot de passe (utilisateur connecté)
 * POST /api/auth/change-password
 */
const changePassword = async (req, res) => {
  try {
    // 1. Validation d'entrée déjà faite par middleware
    const { currentPassword, newPassword } = req.body;
    const { userId } = req.user; // Ajouté par middleware auth
    
    // 2. Appeler service change password
    const result = await authService.changePassword(userId, currentPassword, newPassword);
    
    // 3. Vérifier résultat du service
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error,
        error: 'change_password_failed',
        timestamp: new Date().toISOString()
      });
    }
    
    // 4. Réponse succès
    res.status(200).json({
      success: true,
      message: 'Mot de passe modifié avec succès',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Erreur change password:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'Erreur interne lors du changement de mot de passe',
      error: 'change_password_internal_error',
      timestamp: new Date().toISOString()
    });
  }
};

// ===================================================================
// GESTION SESSIONS
// ===================================================================

/**
 * Lister sessions actives
 * GET /api/auth/sessions
 */
const getSessions = async (req, res) => {
  try {
    const { userId, sessionId } = req.user; // Ajouté par middleware auth
    
    // Appeler service sessions
    const result = await authService.getUserSessions(userId);
    
    // Vérifier résultat du service
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error,
        error: 'get_sessions_failed',
        timestamp: new Date().toISOString()
      });
    }
    
    // Marquer session courante
    const sessions = result.sessions.map(session => ({
      ...session,
      isCurrent: session.sessionId === sessionId
    }));
    
    res.status(200).json({
      success: true,
      message: 'Sessions récupérées avec succès',
      data: {
        sessions,
        totalSessions: result.totalSessions
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Erreur get sessions:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'Erreur interne lors de la récupération des sessions',
      error: 'get_sessions_internal_error',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Nettoyer sessions expirées
 * DELETE /api/auth/sessions/cleanup
 */
const cleanupSessions = async (req, res) => {
  try {
    const { userId } = req.user; // Ajouté par middleware auth
    
    // Appeler service nettoyage
    const result = await authService.cleanExpiredSessions(userId);
    
    // Vérifier résultat du service
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error,
        error: 'cleanup_sessions_failed',
        timestamp: new Date().toISOString()
      });
    }
    
    res.status(200).json({
      success: true,
      message: result.message,
      data: {
        sessionsRemoved: result.sessionsRemoved,
        activeSessions: result.activeSessions
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Erreur cleanup sessions:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'Erreur interne lors du nettoyage des sessions',
      error: 'cleanup_sessions_internal_error',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Profil utilisateur depuis token
 * GET /api/auth/me
 */
const getMe = async (req, res) => {
  try {
    // Utilisateur déjà injecté par middleware auth
    res.status(200).json({
      success: true,
      message: 'Profil utilisateur récupéré',
      data: {
        user: {
          userId: req.user.userId,
          email: req.user.email,
          firstName: req.user.firstName,
          lastName: req.user.lastName,
          role: req.user.role,
          region: req.user.region,
          isVerified: req.user.isVerified
        },
        authenticated: !req.user,
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
};

/**
 * Vérifier validité token
 * GET /api/auth/verify-token
 */
const verifyToken = async (req, res) => {
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
};

/**
 * Health check authentification
 * GET /api/auth/health
 */
const healthCheck = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Service d\'authentification opérationnel',
      data: {
        service: 'auth',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        endpoints: {
          register: 'POST /api/auth/register',
          login: 'POST /api/auth/login',
          refresh: 'POST /api/auth/refresh',
          logout: 'POST /api/auth/logout',
          logoutAll: 'POST /api/auth/logout-all',
          forgotPassword: 'POST /api/auth/forgot-password',
          resetPassword: 'POST /api/auth/reset-password',
          changePassword: 'POST /api/auth/change-password',
          sessions: 'GET /api/auth/sessions',
          cleanup: 'DELETE /api/auth/sessions/cleanup',
          me: 'GET /api/auth/me',
          verifyToken: 'GET /api/auth/verify-token'
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Service d\'authentification indisponible',
      error: error.message
    });
  }
};

// ===================================================================
// EXPORTS
// ===================================================================
module.exports = {
  // Controllers principaux avec validation
  register: [registerValidation, handleValidationErrors, register],
  login: [loginValidation, handleValidationErrors, login],
  refreshToken: [refreshValidation, handleValidationErrors, refreshToken],
  logout,
  logoutAll,
  
  // Gestion mots de passe avec validation
  forgotPassword: [resetPasswordValidation, handleValidationErrors, forgotPassword],
  resetPassword: [newPasswordValidation, handleValidationErrors, resetPassword],
  changePassword: [changePasswordValidation, handleValidationErrors, changePassword],
  
  // Gestion sessions
  getSessions,
  cleanupSessions,
  getMe,
  verifyToken,
  
  // Utilitaires
  healthCheck,
  
  // Middleware validation (pour usage externe)
  handleValidationErrors,
  extractDeviceInfo,
  formatValidationErrors,
  
  // Validations (pour usage externe dans routes)
  registerValidation,
  loginValidation,
  refreshValidation,
  resetPasswordValidation,
  newPasswordValidation,
  changePasswordValidation
};