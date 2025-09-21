// src/controllers/authController.js - Controllers authentification FinApp Haiti
const { body, validationResult } = require('express-validator');
const authService = require('../services/authService');

/**
 * Controllers d'authentification utilisant authService.js
 * Gestion complète : register, login, refresh, logout, password management
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
    
    // Extraire infos device
    const deviceInfo = extractDeviceInfo(req);
    
    // Appeler service d'authentification
    const result = await authService.registerUser({
      firstName,
      lastName,
      email,
      password,
      phone,
      region,
      city
    }, deviceInfo);
    
    // Set refresh token en cookie sécurisé (optionnel)
    res.cookie('refreshToken', result.tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 jours
    });
    
    res.status(201).json({
      success: true,
      message: 'Compte créé avec succès! Bienvenue dans FinApp Haiti! 🇭🇹',
      data: {
        user: result.user,
        tokens: {
          accessToken: result.tokens.accessToken,
          tokenType: result.tokens.tokenType,
          expiresIn: result.tokens.expiresIn
        },
        session: result.session
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Erreur register:', error.message);
    
    res.status(400).json({
      success: false,
      message: error.message,
      error: 'register_failed',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Connexion utilisateur
 * POST /api/auth/login
 */
const login = async (req, res) => {
  try {
    const { identifier, password, rememberMe = false } = req.body;
    
    // Extraire infos device
    const deviceInfo = extractDeviceInfo(req);
    
    // Appeler service d'authentification
    const result = await authService.loginUser({
      identifier,
      password
    }, deviceInfo);
    
    // Set refresh token en cookie si remember me
    if (rememberMe) {
      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 jours
      });
    }
    
    res.status(200).json({
      success: true,
      message: `Bon retour ${result.user.firstName}! 👋`,
      data: {
        user: result.user,
        tokens: {
          accessToken: result.tokens.accessToken,
          tokenType: result.tokens.tokenType,
          expiresIn: result.tokens.expiresIn
        },
        session: result.session
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Erreur login:', error.message);
    
    // Distinction erreurs pour sécurité
    const isCredentialError = error.message.includes('mot de passe') || 
                              error.message.includes('email') ||
                              error.message.includes('téléphone');
    
    const statusCode = error.message.includes('verrouillé') ? 429 : 401;
    
    res.status(statusCode).json({
      success: false,
      message: error.message,
      error: isCredentialError ? 'invalid_credentials' : 'login_failed',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Renouveler access token
 * POST /api/auth/refresh
 */
const refreshToken = async (req, res) => {
  try {
    let refreshToken = req.body.refreshToken;
    
    // Fallback sur cookie si pas dans body
    if (!refreshToken) {
      refreshToken = req.cookies.refreshToken;
    }
    
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token requis',
        error: 'no_refresh_token',
        timestamp: new Date().toISOString()
      });
    }
    
    // Extraire infos device
    const deviceInfo = extractDeviceInfo(req);
    
    // Appeler service refresh
    const result = await authService.refreshTokens(refreshToken, deviceInfo);
    
    // Mettre à jour cookie si existant
    if (req.cookies.refreshToken) {
      res.cookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Tokens renouvelés avec succès',
      data: {
        tokens: {
          accessToken: result.tokens.accessToken,
          tokenType: result.tokens.tokenType,
          expiresIn: result.tokens.expiresIn
        },
        session: result.session
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Erreur refresh token:', error.message);
    
    // Supprimer cookie invalide
    res.clearCookie('refreshToken');
    
    res.status(401).json({
      success: false,
      message: error.message,
      error: 'refresh_failed',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Déconnexion utilisateur (session courante)
 * POST /api/auth/logout
 */
const logout = async (req, res) => {
  try {
    const { userId, sessionId } = req.user; // Ajouté par middleware auth
    
    // Appeler service logout
    const result = await authService.logoutUser(userId, sessionId);
    
    // Supprimer cookie refresh token
    res.clearCookie('refreshToken');
    
    res.status(200).json({
      success: true,
      message: 'Déconnexion réussie. À bientôt! 👋',
      data: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Erreur logout:', error.message);
    
    res.status(400).json({
      success: false,
      message: error.message,
      error: 'logout_failed',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Déconnexion de toutes les sessions
 * POST /api/auth/logout-all
 */
const logoutAll = async (req, res) => {
  try {
    const { userId } = req.user; // Ajouté par middleware auth
    
    // Appeler service logout global
    const result = await authService.logoutAllSessions(userId);
    
    // Supprimer cookie refresh token
    res.clearCookie('refreshToken');
    
    res.status(200).json({
      success: true,
      message: 'Déconnexion de toutes les sessions réussie',
      data: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Erreur logout all:', error.message);
    
    res.status(400).json({
      success: false,
      message: error.message,
      error: 'logout_all_failed',
      timestamp: new Date().toISOString()
    });
  }
};

// ===================================================================
// GESTION MOTS DE PASSE
// ===================================================================

/**
 * Demander reset mot de passe
 * POST /api/auth/forgot-password
 */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    
    // Appeler service reset password
    const result = await authService.generatePasswordResetToken(email);
    
    // TODO: Envoyer email avec token reset (service email)
    // await emailService.sendPasswordResetEmail(result);
    
    res.status(200).json({
      success: true,
      message: 'Si cet email existe, un lien de réinitialisation a été envoyé',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Erreur forgot password:', error.message);
    
    res.status(400).json({
      success: false,
      message: 'Erreur lors de la demande de réinitialisation',
      error: 'forgot_password_failed',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Réinitialiser mot de passe
 * POST /api/auth/reset-password
 */
const resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;
    
    // Appeler service reset
    const result = await authService.resetPassword(resetToken, newPassword);
    
    res.status(200).json({
      success: true,
      message: 'Mot de passe réinitialisé avec succès',
      data: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Erreur reset password:', error.message);
    
    res.status(400).json({
      success: false,
      message: error.message,
      error: 'reset_password_failed',
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
    const { userId } = req.user; // Ajouté par middleware auth
    const { currentPassword, newPassword } = req.body;
    
    // Appeler service changement
    const result = await authService.changePassword(userId, currentPassword, newPassword);
    
    res.status(200).json({
      success: true,
      message: 'Mot de passe modifié avec succès',
      data: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Erreur change password:', error.message);
    
    res.status(400).json({
      success: false,
      message: error.message,
      error: 'change_password_failed',
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
    
    res.status(400).json({
      success: false,
      message: error.message,
      error: 'get_sessions_failed',
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
    
    res.status(400).json({
      success: false,
      message: error.message,
      error: 'cleanup_sessions_failed',
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
          cleanup: 'DELETE /api/auth/sessions/cleanup'
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
  // Controllers principaux
  register: [registerValidation, handleValidationErrors, register],
  login: [loginValidation, handleValidationErrors, login],
  refreshToken: [refreshValidation, handleValidationErrors, refreshToken],
  logout,
  logoutAll,
  
  // Gestion mots de passe
  forgotPassword: [resetPasswordValidation, handleValidationErrors, forgotPassword],
  resetPassword: [newPasswordValidation, handleValidationErrors, resetPassword],
  changePassword: [changePasswordValidation, handleValidationErrors, changePassword],
  
  // Gestion sessions
  getSessions,
  cleanupSessions,
  
  // Utilitaires
  healthCheck,
  
  // Middleware validation (pour usage externe)
  handleValidationErrors,
  extractDeviceInfo
};