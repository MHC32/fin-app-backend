const rateLimit = require('express-rate-limit');
const mongoStore = require('rate-limit-mongo');

/**
 * MIDDLEWARE DE RATE LIMITING
 * Protection contre les abus et attaques DDoS
 * Limites différentes selon les endpoints
 */

// ==========================================
// CONFIGURATION STORE
// ==========================================

/**
 * Store MongoDB pour partager les limites entre instances
 * Utile pour production avec plusieurs serveurs
 */
const createMongoStore = () => {
  if (process.env.MONGODB_URI) {
    return mongoStore({
      uri: process.env.MONGODB_URI,
      collectionName: 'rateLimits',
      expireTimeMs: 15 * 60 * 1000, // 15 minutes
      errorHandler: (err) => {
        console.error('Rate limit store error:', err);
      }
    });
  }
  return undefined; // Utiliser le store en mémoire par défaut
};

// ==========================================
// MESSAGES D'ERREUR
// ==========================================

const rateLimitMessage = {
  default: {
    success: false,
    message: 'Trop de requêtes, veuillez réessayer dans quelques minutes',
    retryAfter: 'Voir header Retry-After'
  },
  
  auth: {
    success: false,
    message: 'Trop de tentatives de connexion, veuillez attendre 15 minutes',
    hint: 'Mot de passe oublié ? Utilisez la réinitialisation.'
  },

  api: {
    success: false,
    message: 'Limite d\'API atteinte, veuillez ralentir vos requêtes',
    limit: 'Voir headers X-RateLimit-*'
  },

  sensitive: {
    success: false,
    message: 'Action sensible limitée, veuillez attendre avant de réessayer',
    security: 'Cette limite protège votre compte'
  }
};

// ==========================================
// HANDLER PERSONNALISÉ
// ==========================================

/**
 * Handler appelé quand la limite est atteinte
 */
const rateLimitHandler = (req, res, options) => {
  const messageType = options.messageType || 'default';
  
  res.status(options.statusCode).json({
    ...rateLimitMessage[messageType],
    retryAfter: Math.ceil(options.windowMs / 1000 / 60) + ' minutes'
  });
};

// ==========================================
// SKIP CONDITIONS
// ==========================================

/**
 * Skip rate limit pour certaines conditions
 */
const skipRateLimit = (req, res) => {
  // Skip en développement (optionnel)
  if (process.env.NODE_ENV === 'development' && process.env.SKIP_RATE_LIMIT === 'true') {
    return true;
  }

  // Skip pour les admins (optionnel)
  if (req.user?.role === 'admin') {
    return true;
  }

  // Skip pour les IPs whitelistées
  const whitelist = (process.env.RATE_LIMIT_WHITELIST || '').split(',');
  if (whitelist.includes(req.ip)) {
    return true;
  }

  return false;
};

// ==========================================
// RATE LIMITERS PRÉDÉFINIS
// ==========================================

/**
 * Rate limiter général (protection basique)
 * 100 requêtes / 15 minutes par IP
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requêtes max
  message: rateLimitMessage.default,
  standardHeaders: true, // Retourne info dans headers `RateLimit-*`
  legacyHeaders: false, // Désactive headers `X-RateLimit-*`
  store: createMongoStore(),
  skip: skipRateLimit,
  handler: (req, res, next, options) => rateLimitHandler(req, res, { ...options, messageType: 'default' })
});

/**
 * Rate limiter strict pour authentification
 * 5 tentatives / 15 minutes par IP
 * Protection contre brute force
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 tentatives max
  skipSuccessfulRequests: true, // Ne compte que les échecs
  message: rateLimitMessage.auth,
  standardHeaders: true,
  legacyHeaders: false,
  store: createMongoStore(),
  skip: skipRateLimit,
  handler: (req, res, next, options) => rateLimitHandler(req, res, { ...options, messageType: 'auth' })
});

/**
 * Rate limiter pour enregistrement
 * 3 comptes / heure par IP
 * Protection contre spam d'inscriptions
 */
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 3, // 3 créations max
  message: {
    success: false,
    message: 'Trop de créations de compte, réessayez dans 1 heure',
    hint: 'Avez-vous déjà un compte ? Essayez de vous connecter.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createMongoStore(),
  skip: skipRateLimit
});

/**
 * Rate limiter pour reset password
 * 3 demandes / heure par IP
 */
const resetPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 3, // 3 demandes max
  message: {
    success: false,
    message: 'Trop de demandes de réinitialisation, réessayez dans 1 heure',
    hint: 'Vérifiez vos emails, un lien a peut-être déjà été envoyé.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createMongoStore(),
  skip: skipRateLimit
});

/**
 * Rate limiter API standard
 * 200 requêtes / 15 minutes par utilisateur
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 requêtes max
  message: rateLimitMessage.api,
  standardHeaders: true,
  legacyHeaders: false,
  store: createMongoStore(),
  skip: skipRateLimit,
  keyGenerator: (req) => {
    // Utiliser userId si authentifié, sinon IP
    return req.user?.id || req.ip;
  },
  handler: (req, res, next, options) => rateLimitHandler(req, res, { ...options, messageType: 'api' })
});

/**
 * Rate limiter pour actions sensibles
 * 10 requêtes / heure (delete, transfer, etc.)
 */
const sensitiveLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 10, // 10 actions max
  message: rateLimitMessage.sensitive,
  standardHeaders: true,
  legacyHeaders: false,
  store: createMongoStore(),
  skip: skipRateLimit,
  keyGenerator: (req) => req.user?.id || req.ip,
  handler: (req, res, next, options) => rateLimitHandler(req, res, { ...options, messageType: 'sensitive' })
});

/**
 * Rate limiter pour uploads
 * 20 uploads / heure
 */
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 20, // 20 uploads max
  message: {
    success: false,
    message: 'Trop d\'uploads, réessayez dans 1 heure',
    limit: '20 fichiers maximum par heure'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createMongoStore(),
  skip: skipRateLimit,
  keyGenerator: (req) => req.user?.id || req.ip
});

/**
 * Rate limiter pour recherches
 * 50 recherches / 15 minutes
 */
const searchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 recherches max
  message: {
    success: false,
    message: 'Trop de recherches, ralentissez un peu',
    limit: '50 recherches par 15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createMongoStore(),
  skip: skipRateLimit,
  keyGenerator: (req) => req.user?.id || req.ip
});

/**
 * Rate limiter pour notifications
 * 100 requêtes / 15 minutes
 */
const notificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    success: false,
    message: 'Trop de requêtes notifications',
    limit: '100 requêtes par 15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createMongoStore(),
  skip: skipRateLimit,
  keyGenerator: (req) => req.user?.id || req.ip
});

/**
 * Rate limiter pour IA/ML endpoints
 * 30 analyses / 15 minutes (coûteux en calcul)
 */
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 analyses max
  message: {
    success: false,
    message: 'Trop d\'analyses IA, veuillez patienter',
    hint: 'Les analyses IA sont limitées pour optimiser les performances'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createMongoStore(),
  skip: skipRateLimit,
  keyGenerator: (req) => req.user?.id || req.ip
});

// ==========================================
// FACTORY POUR LIMITERS CUSTOM
// ==========================================

/**
 * Crée un rate limiter personnalisé
 * @param {Object} options - Options du limiter
 * @returns {Function} Middleware rate limiter
 */
const createRateLimiter = (options = {}) => {
  const defaults = {
    windowMs: 15 * 60 * 1000, // 15 minutes par défaut
    max: 100, // 100 requêtes par défaut
    message: rateLimitMessage.default,
    standardHeaders: true,
    legacyHeaders: false,
    store: createMongoStore(),
    skip: skipRateLimit,
    handler: rateLimitHandler
  };

  return rateLimit({ ...defaults, ...options });
};

/**
 * Crée un rate limiter par utilisateur
 * @param {number} max - Nombre max de requêtes
 * @param {number} windowMinutes - Fenêtre en minutes
 */
const createUserRateLimiter = (max = 100, windowMinutes = 15) => {
  return createRateLimiter({
    windowMs: windowMinutes * 60 * 1000,
    max,
    keyGenerator: (req) => req.user?.id || req.ip,
    message: {
      success: false,
      message: `Limite de ${max} requêtes / ${windowMinutes} minutes atteinte`
    }
  });
};

/**
 * Crée un rate limiter par IP
 * @param {number} max - Nombre max de requêtes
 * @param {number} windowMinutes - Fenêtre en minutes
 */
const createIPRateLimiter = (max = 100, windowMinutes = 15) => {
  return createRateLimiter({
    windowMs: windowMinutes * 60 * 1000,
    max,
    keyGenerator: (req) => req.ip,
    message: {
      success: false,
      message: `Limite de ${max} requêtes / ${windowMinutes} minutes atteinte par IP`
    }
  });
};

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  // Limiters prédéfinis
  generalLimiter,
  authLimiter,
  registerLimiter,
  resetPasswordLimiter,
  apiLimiter,
  sensitiveLimiter,
  uploadLimiter,
  searchLimiter,
  notificationLimiter,
  aiLimiter,

  // Factory functions
  createRateLimiter,
  createUserRateLimiter,
  createIPRateLimiter,

  // Helpers
  skipRateLimit,
  rateLimitHandler
};