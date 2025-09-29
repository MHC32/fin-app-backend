const cors = require('cors');

/**
 * MIDDLEWARE CORS (Cross-Origin Resource Sharing)
 * Gère les requêtes cross-origin de manière sécurisée
 * Configuration différente dev vs production
 */

// ==========================================
// WHITELIST ORIGINS
// ==========================================

/**
 * Liste des origines autorisées
 * À mettre à jour selon les environnements
 */
const getAllowedOrigins = () => {
  const env = process.env.NODE_ENV || 'development';

  // Production - Origines strictes
  if (env === 'production') {
    return [
      process.env.FRONTEND_URL || 'https://finapp-haiti.com',
      'https://www.finapp-haiti.com',
      'https://app.finapp-haiti.com',
      'https://api.finapp-haiti.com'
    ].filter(Boolean); // Retirer les undefined
  }

  // Staging
  if (env === 'staging') {
    return [
      'https://staging.finapp-haiti.com',
      'https://staging-app.finapp-haiti.com',
      'http://localhost:3000',
      'http://localhost:3001'
    ];
  }

  // Development - Permissif
  return [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173', // Vite
    'http://localhost:5174',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173'
  ];
};

// ==========================================
// CONFIGURATION CORS
// ==========================================

/**
 * Options CORS principales
 */
const corsOptions = {
  /**
   * Vérifie si l'origine est autorisée
   */
  origin: (origin, callback) => {
    const allowedOrigins = getAllowedOrigins();

    // Autoriser requests sans origin (mobile apps, curl, Postman)
    if (!origin) {
      return callback(null, true);
    }

    // Vérifier si l'origin est dans la whitelist
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error(`Origin ${origin} not allowed by CORS policy`));
    }
  },

  /**
   * Headers autorisés dans les requêtes
   */
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-API-Key',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers',
    // Headers custom pour l'app
    'X-App-Version',
    'X-Device-Id',
    'X-Platform',
    'X-Region',
    'X-City'
  ],

  /**
   * Headers exposés dans les réponses
   * Permet au frontend d'y accéder
   */
  exposedHeaders: [
    'Content-Length',
    'Content-Type',
    'X-Total-Count',
    'X-Page',
    'X-Limit',
    'X-Request-Id',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'Retry-After'
  ],

  /**
   * Méthodes HTTP autorisées
   */
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

  /**
   * Autoriser les credentials (cookies, auth headers)
   */
  credentials: true,

  /**
   * Durée du preflight cache (en secondes)
   * 24 heures = 86400 secondes
   */
  maxAge: 86400,

  /**
   * Status pour les requêtes OPTIONS réussies
   */
  optionsSuccessStatus: 204,

  /**
   * Preflight continue (false = stoppe après OPTIONS)
   */
  preflightContinue: false
};

/**
 * Configuration CORS permissive (développement uniquement)
 */
const corsOptionsPermissive = {
  origin: true, // Autoriser toutes les origines
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: '*',
  exposedHeaders: corsOptions.exposedHeaders,
  maxAge: 86400,
  optionsSuccessStatus: 204
};

// ==========================================
// MIDDLEWARE CORS
// ==========================================

/**
 * Middleware CORS principal
 * Utilise la config stricte ou permissive selon l'env
 */
const corsMiddleware = () => {
  const env = process.env.NODE_ENV || 'development';

  // En dev, autoriser mode permissif si configuré
  if (env === 'development' && process.env.CORS_PERMISSIVE === 'true') {
    console.log('⚠️  CORS permissive mode enabled (development only)');
    return cors(corsOptionsPermissive);
  }

  // Sinon, utiliser config stricte
  return cors(corsOptions);
};

/**
 * Middleware CORS pour routes publiques
 * Plus permissif (ex: landing page, docs)
 */
const corsPublic = cors({
  origin: '*',
  methods: ['GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept'],
  credentials: false,
  maxAge: 86400
});

/**
 * Middleware CORS pour webhooks
 * Autorise des origines externes spécifiques
 */
const corsWebhooks = cors({
  origin: (origin, callback) => {
    // Liste des services externes autorisés
    const webhookOrigins = [
      'https://moncash.digicelgroup.com',
      'https://natcash.natcom.ht',
      // Ajouter d'autres services de paiement Haiti
    ];

    if (!origin || webhookOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Webhook origin not allowed'));
    }
  },
  methods: ['POST', 'OPTIONS'],
  credentials: false
});

// ==========================================
// HEADERS DE SÉCURITÉ ADDITIONNELS
// ==========================================

/**
 * Middleware de sécurité headers
 * Complète CORS avec headers de sécurité
 */
const securityHeaders = (req, res, next) => {
  // Prévenir clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Prévenir MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // XSS Protection (browsers plus anciens)
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Référer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Content Security Policy (strict en production)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https:; " +
      "font-src 'self' data:; " +
      "connect-src 'self' https://api.finapp-haiti.com"
    );
  }

  // Permissions Policy (ex-Feature Policy)
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=()'
  );

  // HSTS (HTTPS strict) - Production seulement
  if (process.env.NODE_ENV === 'production') {
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  next();
};

// ==========================================
// HELPERS
// ==========================================

/**
 * Vérifie si une origine est autorisée
 * @param {string} origin - L'origine à vérifier
 * @returns {boolean}
 */
const isOriginAllowed = (origin) => {
  if (!origin) return true;
  return getAllowedOrigins().includes(origin);
};

/**
 * Ajoute une origine à la whitelist dynamiquement
 * @param {string} origin - L'origine à ajouter
 */
const addAllowedOrigin = (origin) => {
  if (!origin) return;
  
  const allowedOrigins = getAllowedOrigins();
  if (!allowedOrigins.includes(origin)) {
    allowedOrigins.push(origin);
    console.log(`✅ Origin added to whitelist: ${origin}`);
  }
};

/**
 * Retire une origine de la whitelist
 * @param {string} origin - L'origine à retirer
 */
const removeAllowedOrigin = (origin) => {
  const allowedOrigins = getAllowedOrigins();
  const index = allowedOrigins.indexOf(origin);
  
  if (index > -1) {
    allowedOrigins.splice(index, 1);
    console.log(`❌ Origin removed from whitelist: ${origin}`);
  }
};

/**
 * Récupère la liste actuelle des origines autorisées
 * @returns {string[]}
 */
const getWhitelist = () => {
  return getAllowedOrigins();
};

/**
 * Log les infos CORS pour debugging
 */
const logCorsInfo = (req) => {
  const origin = req.headers.origin;
  const method = req.method;
  const allowed = isOriginAllowed(origin);

  console.log(`
    CORS Request:
    Origin: ${origin || 'none'}
    Method: ${method}
    Allowed: ${allowed ? '✅' : '❌'}
    Headers: ${JSON.stringify(req.headers)}
  `);
};

/**
 * Middleware de debug CORS
 * Active en dev pour troubleshoot
 */
const corsDebug = (req, res, next) => {
  if (process.env.CORS_DEBUG === 'true') {
    logCorsInfo(req);
  }
  next();
};

// ==========================================
// CONFIGURATION PAR ENVIRONNEMENT
// ==========================================

/**
 * Récupère la config CORS selon l'environnement
 */
const getCorsConfig = () => {
  const env = process.env.NODE_ENV || 'development';

  return {
    environment: env,
    allowedOrigins: getAllowedOrigins(),
    permissive: env === 'development' && process.env.CORS_PERMISSIVE === 'true',
    credentials: true,
    debug: process.env.CORS_DEBUG === 'true'
  };
};

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  // Middleware principal
  corsMiddleware,
  
  // Middleware spécialisés
  corsPublic,
  corsWebhooks,
  securityHeaders,
  corsDebug,

  // Helpers
  isOriginAllowed,
  addAllowedOrigin,
  removeAllowedOrigin,
  getWhitelist,
  getAllowedOrigins,
  getCorsConfig,
  logCorsInfo,

  // Options (pour usage custom)
  corsOptions,
  corsOptionsPermissive
};