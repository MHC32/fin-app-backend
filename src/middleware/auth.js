// src/middleware/auth.js - Middleware d'authentification FinApp Haiti
const rateLimit = require('express-rate-limit');
const authService = require('../services/authService'); // IMPORT CRITIQUE AJOUTÉ

/**
 * Middleware d'authentification FinApp Haiti
 * 
 * Ce fichier contient les middleware d'authentification et de permissions
 * pour sécuriser les routes API.
 * 
 * Dépendances:
 * - authService pour validation JWT + sessions
 * - express-rate-limit pour limitations requêtes
 * - User.js modèle pour sessions multi-device
 * 
 * Middleware principaux:
 * - authenticate: authentification obligatoire
 * - optionalAuth: authentification optionnelle
 * - requireRole: vérification rôles
 * - requireVerified: compte vérifié requis
 */

// ===================================================================
// UTILITAIRES
// ===================================================================

/**
 * Extraire token Bearer de l'Authorization header
 * @param {string} authHeader - Header Authorization
 * @returns {string|null} - Token extrait ou null
 */
const extractBearerToken = (authHeader) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7); // Retirer "Bearer "
};

// ===================================================================
// RATE LIMITING CONFIGURATIONS
// ===================================================================

/**
 * Rate limiter général pour authentification
 */
const generalAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requêtes par IP par fenêtre
  message: {
    success: false,
    message: 'Trop de requêtes d\'authentification. Réessayez dans 15 minutes.',
    error: 'auth_rate_limit_exceeded',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Rate limiter strict pour opérations sensibles
 */
const strictAuthLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 20, // 20 requêtes par IP par heure
  message: {
    success: false,
    message: 'Trop de requêtes sensibles. Réessayez dans 1 heure.',
    error: 'strict_rate_limit_exceeded',
    retryAfter: '1 hour'
  },
  keyGenerator: (req) => req.user?.userId || req.ip
});

/**
 * Rate limiter admin pour opérations administratives
 */
const adminLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50, // 50 opérations admin par fenêtre
  message: {
    success: false,
    message: 'Trop d\'opérations administratives. Réessayez dans 5 minutes.',
    error: 'admin_rate_limit_exceeded',
    retryAfter: '5 minutes'
  },
  keyGenerator: (req) => req.user?.userId || req.ip
});

// ===================================================================
// MIDDLEWARE AUTHENTIFICATION PRINCIPAL
// ===================================================================

/**
 * Middleware d'authentification principal
 * Vérifier token JWT + session User.js + injection req.user
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 * @param {Function} next - Next middleware
 */
const authenticate = async (req, res, next) => {
  try {
    // 1. Extraire token Authorization header
    const authHeader = req.get('Authorization');
    
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Token d\'authentification requis',
        error: 'missing_auth_token',
        hint: 'Ajoutez "Authorization: Bearer <token>" dans les headers',
        timestamp: new Date().toISOString()
      });
    }
    
    const token = extractBearerToken(authHeader);
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Format de token invalide',
        error: 'invalid_token_format',
        hint: 'Format attendu: "Bearer <token>"',
        timestamp: new Date().toISOString()
      });
    }
    
    // 2. Valider token via authService (JWT + session User.js)
    const validation = await authService.validateAccessToken(authHeader);
    
    if (!validation.success) {
      // Distinction erreurs pour debugging
      const errorCode = validation.error?.includes('expiré') ? 'token_expired' :
                       validation.error?.includes('invalide') ? 'token_invalid' :
                       validation.error?.includes('session') ? 'session_invalid' :
                       'auth_failed';
      
      return res.status(401).json({
        success: false,
        message: validation.error || 'Token d\'authentification invalide',
        error: errorCode,
        timestamp: new Date().toISOString()
      });
    }
    
    // 3. Injecter utilisateur dans req.user
    req.user = {
      userId: validation.user.id,
      email: validation.user.email,
      firstName: validation.user.firstName,
      lastName: validation.user.lastName,
      role: validation.user.role,
      region: validation.user.region,
      isVerified: validation.user.isVerified,
      
      // Infos session
      sessionId: validation.session.sessionId,
      deviceInfo: validation.session.deviceInfo,
      lastActivity: validation.session.lastActivity,
      
      // Infos token
      tokenPayload: validation.tokenInfo.payload,
      tokenExpiringSoon: validation.tokenInfo.expiringSoon
    };
    
    // 4. Headers informatifs pour frontend
    if (validation.tokenInfo.expiringSoon) {
      res.set('X-Token-Expires-Soon', 'true');
      res.set('X-Token-Refresh-Recommended', 'true');
    }
    
    // 5. Tracking activité utilisateur (optionnel)
    res.set('X-User-Session', validation.session.sessionId);
    res.set('X-User-Device', validation.session.deviceInfo?.device || 'unknown');
    
    next();
    
  } catch (error) {
    console.error('❌ Erreur middleware auth:', error.message);
    console.error('❌ Stack trace:', error.stack); // Debug supplémentaire
    
    return res.status(500).json({
      success: false,
      message: 'Erreur interne d\'authentification',
      error: 'auth_internal_error',
      debug: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp: new Date().toISOString()
    });
  }

   console.log("req.user.userId:", req.user.userId)
   console.log("req.user.userId type:", typeof req.user.userId)
};

// ===================================================================
// MIDDLEWARE AUTHENTIFICATION OPTIONNEL
// ===================================================================

/**
 * Middleware d'authentification optionnel
 * Injecte req.user si token valide, mais continue si pas de token
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 * @param {Function} next - Next middleware
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.get('Authorization');
    
    // Pas de token = continuer sans authentification
    if (!authHeader) {
      req.user = null;
      return next();
    }
    
    const token = extractBearerToken(authHeader);
    
    if (!token) {
      req.user = null;
      return next();
    }
    
    // Tenter validation
    try {
      const validation = await authService.validateAccessToken(authHeader);
      
      if (validation.success) {
        // Injecter utilisateur si token valide
        req.user = {
          userId: validation.user.id,
          email: validation.user.email,
          firstName: validation.user.firstName,
          lastName: validation.user.lastName,
          role: validation.user.role,
          region: validation.user.region,
          isVerified: validation.user.isVerified,
          sessionId: validation.session.sessionId,
          tokenExpiringSoon: validation.tokenInfo.expiringSoon
        };
        
        if (validation.tokenInfo.expiringSoon) {
          res.set('X-Token-Expires-Soon', 'true');
        }
      } else {
        req.user = null;
      }
    } catch (validationError) {
      // Token invalide = continuer sans auth
      req.user = null;
    }
    
    next();
    
  } catch (error) {
    console.error('❌ Erreur optional auth:', error.message);
    req.user = null;
    next();
  }
};

// ===================================================================
// MIDDLEWARE PERMISSIONS & RÔLES
// ===================================================================

/**
 * Middleware vérification rôles utilisateur
 * @param {string|Array} requiredRoles - Rôle(s) requis
 * @returns {Function} - Middleware Express
 */
const requireRole = (requiredRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentification requise',
        error: 'auth_required',
        timestamp: new Date().toISOString()
      });
    }
    
    // Vérifier rôles via authService
    const hasPermission = authService.checkUserPermissions(req.user, requiredRoles);
    
    if (!hasPermission) {
      const rolesList = Array.isArray(requiredRoles) ? requiredRoles.join(', ') : requiredRoles;
      
      return res.status(403).json({
        success: false,
        message: `Accès refusé. Rôle(s) requis: ${rolesList}`,
        error: 'insufficient_permissions',
        userRole: req.user.role,
        requiredRoles: requiredRoles,
        timestamp: new Date().toISOString()
      });
    }
    
    next();
  };
};

/**
 * Middleware vérification compte vérifié
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 * @param {Function} next - Next middleware
 */
const requireVerified = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentification requise',
      error: 'auth_required',
      timestamp: new Date().toISOString()
    });
  }
  
  if (!req.user.isVerified) {
    return res.status(403).json({
      success: false,
      message: 'Compte non vérifié. Vérifiez votre email.',
      error: 'account_not_verified',
      userId: req.user.userId,
      timestamp: new Date().toISOString()
    });
  }
  
  next();
};

/**
 * Middleware vérification propriété ressource
 * Vérifie que l'utilisateur peut accéder à ses propres données uniquement
 * @param {string} userIdParam - Nom du paramètre contenant l'ID utilisateur
 * @returns {Function} - Middleware Express
 */
const requireOwnership = (userIdParam = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentification requise',
        error: 'auth_required',
        timestamp: new Date().toISOString()
      });
    }
    
    const resourceUserId = req.params[userIdParam] || req.body[userIdParam] || req.query[userIdParam];
    
    // Admin peut accéder à tout
    if (req.user.role === 'admin') {
      return next();
    }
    
    // Utilisateur peut accéder uniquement à ses données
    if (resourceUserId && resourceUserId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Vous ne pouvez accéder qu\'à vos propres données.',
        error: 'resource_access_denied',
        timestamp: new Date().toISOString()
      });
    }
    
    next();
  };
};

// ===================================================================
// MIDDLEWARE SÉCURITÉ AVANCÉE
// ===================================================================

/**
 * Middleware détection sessions suspectes
 * Vérifie les changements d'IP ou device suspects
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 * @param {Function} next - Next middleware
 */
const detectSuspiciousSession = (req, res, next) => {
  try {
    if (!req.user || !req.user.deviceInfo) {
      return next();
    }
    
    const currentIP = req.ip;
    const currentUserAgent = req.get('User-Agent');
    const sessionDeviceInfo = req.user.deviceInfo;
    
    // Vérifier changement d'IP (warning seulement)
    if (sessionDeviceInfo.ip && sessionDeviceInfo.ip !== currentIP) {
      console.warn(`⚠️ IP change detected: User ${req.user.userId} | Session: ${sessionDeviceInfo.ip} → Current: ${currentIP}`);
      res.set('X-IP-Change-Detected', 'true');
    }
    
    // Vérifier changement User-Agent (warning seulement)
    if (sessionDeviceInfo.userAgent && sessionDeviceInfo.userAgent !== currentUserAgent) {
      console.warn(`⚠️ User-Agent change detected: User ${req.user.userId}`);
      res.set('X-User-Agent-Change-Detected', 'true');
    }
    
    next();
    
  } catch (error) {
    console.error('❌ Erreur détection session suspecte:', error.message);
    next(); // Continuer malgré l'erreur
  }
};

/**
 * Middleware validation région utilisateur
 * Vérifie que l'utilisateur accède aux données de sa région (optionnel)
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 * @param {Function} next - Next middleware
 */
const validateUserRegion = (req, res, next) => {
  if (!req.user) {
    return next();
  }
  
  const requestedRegion = req.params.region || req.query.region || req.body.region;
  
  // Si une région est spécifiée et différente de celle de l'utilisateur
  if (requestedRegion && 
      requestedRegion !== req.user.region && 
      req.user.role !== 'admin') {
    
    return res.status(403).json({
      success: false,
      message: `Accès refusé. Vous ne pouvez accéder qu'aux données de votre région (${req.user.region}).`,
      error: 'region_access_denied',
      userRegion: req.user.region,
      requestedRegion: requestedRegion,
      timestamp: new Date().toISOString()
    });
  }
  
  next();
};

// ===================================================================
// MIDDLEWARE LOGGING & ANALYTICS
// ===================================================================

/**
 * Middleware logging activité utilisateur
 * Log des actions importantes pour analytics
 * @param {Array} actions - Actions à logger
 * @returns {Function} - Middleware Express
 */
const logUserActivity = (actions = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return next();
    }
    
    const action = `${req.method} ${req.route?.path || req.path}`;
    
    // Logger si action dans la liste OU si actions vide (log tout)
    if (actions.length === 0 || actions.some(a => action.includes(a))) {
      console.log(`📊 User Activity: ${req.user.userId} | ${action} | ${req.ip} | ${new Date().toISOString()}`);
      
      // TODO: Envoyer vers service analytics
      // analyticsService.trackUserActivity({
      //   userId: req.user.userId,
      //   action: action,
      //   ip: req.ip,
      //   userAgent: req.get('User-Agent'),
      //   timestamp: new Date()
      // });
    }
    
    next();
  };
};

/**
 * Middleware métriques performance
 * Mesure temps de réponse pour endpoints protégés
 * @param {Object} req - Requête Express
 * @param {Object} res - Réponse Express
 * @param {Function} next - Next middleware
 */
const trackPerformance = (req, res, next) => {
  if (!req.user) {
    return next();
  }
  
  const startTime = Date.now();
  
  // Hook sur fin de réponse
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    if (duration > 1000) { // Log si > 1 seconde
      console.warn(`⚡ Slow request: ${req.method} ${req.path} | ${duration}ms | User: ${req.user.userId}`);
    }
    
    // Headers performance pour monitoring
    res.set('X-Response-Time', `${duration}ms`);
  });
  
  next();
};

// ===================================================================
// MIDDLEWARE COMPOSITIONS (STANDARD/STRICT/ADMIN)
// ===================================================================

/**
 * Authentification standard (la plupart des routes)
 */
const standardAuth = [
  authenticate,
  generalAuthLimiter,
  detectSuspiciousSession,
  logUserActivity(),
];

/**
 * Authentification stricte (opérations sensibles)
 */
const strictAuth = [
  authenticate,
  strictAuthLimiter,
  requireVerified,
  detectSuspiciousSession,
  logUserActivity(['POST', 'PUT', 'DELETE']),
];

/**
 * Authentification admin (opérations administratives)
 */
const adminAuth = [
  authenticate,
  requireRole('admin'),
  adminLimiter,
  detectSuspiciousSession,
  logUserActivity(),
];

/**
 * Authentification optionnelle avec protection de base
 */
const optionalAuthStack = [
  optionalAuth,
  generalAuthLimiter,
];

// ===================================================================
// EXPORT
// ===================================================================

module.exports = {
  // Middleware principaux
  authenticate,
  optionalAuth,
  
  // Permissions et rôles
  requireRole,
  requireVerified,
  requireOwnership,
  
  // Sécurité avancée
  detectSuspiciousSession,
  validateUserRegion,
  
  // Rate limiting
  generalAuthLimiter,
  strictAuthLimiter,
  adminLimiter,
  
  // Logging et analytics
  logUserActivity,
  
  // Stacks préconfigurées
  standardAuth,
  strictAuth,
  adminAuth,
  optionalAuthStack,
  
  // Utilitaires
  extractBearerToken
};