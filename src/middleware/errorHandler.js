/**
 * MIDDLEWARE DE GESTION D'ERREURS GLOBALE
 * Centralise toutes les erreurs de l'application
 * Format consistant, logging, et messages appropriés
 */

// ==========================================
// CLASSES D'ERREURS PERSONNALISÉES
// ==========================================

/**
 * Erreur de base personnalisée
 */
class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Erreur de validation (400)
 */
class ValidationError extends AppError {
  constructor(message = 'Erreur de validation', errors = []) {
    super(message, 400);
    this.errors = errors;
  }
}

/**
 * Erreur d'authentification (401)
 */
class AuthenticationError extends AppError {
  constructor(message = 'Non authentifié') {
    super(message, 401);
  }
}

/**
 * Erreur d'autorisation (403)
 */
class AuthorizationError extends AppError {
  constructor(message = 'Accès refusé') {
    super(message, 403);
  }
}

/**
 * Erreur ressource non trouvée (404)
 */
class NotFoundError extends AppError {
  constructor(resource = 'Ressource', id = '') {
    const message = id 
      ? `${resource} avec l'ID ${id} introuvable`
      : `${resource} introuvable`;
    super(message, 404);
  }
}

/**
 * Erreur de conflit (409)
 */
class ConflictError extends AppError {
  constructor(message = 'Conflit détecté') {
    super(message, 409);
  }
}

/**
 * Erreur de logique métier (422)
 */
class BusinessLogicError extends AppError {
  constructor(message = 'Erreur de logique métier') {
    super(message, 422);
  }
}

/**
 * Erreur trop de requêtes (429)
 */
class RateLimitError extends AppError {
  constructor(message = 'Trop de requêtes, réessayez plus tard') {
    super(message, 429);
  }
}

// ==========================================
// HANDLERS D'ERREURS SPÉCIFIQUES
// ==========================================

/**
 * Gère les erreurs de validation Mongoose
 */
const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map(el => ({
    field: el.path,
    message: el.message
  }));

  return new ValidationError('Erreur de validation des données', errors);
};

/**
 * Gère les erreurs de duplication MongoDB
 */
const handleDuplicateFieldsDB = (err) => {
  const field = Object.keys(err.keyValue)[0];
  const value = err.keyValue[field];
  
  return new ConflictError(
    `La valeur "${value}" existe déjà pour le champ "${field}"`
  );
};

/**
 * Gère les erreurs de cast MongoDB (ID invalide)
 */
const handleCastErrorDB = (err) => {
  return new ValidationError(`ID invalide: ${err.value}`);
};

/**
 * Gère les erreurs JWT invalides
 */
const handleJWTError = () => {
  return new AuthenticationError('Token invalide, veuillez vous reconnecter');
};

/**
 * Gère les erreurs JWT expirés
 */
const handleJWTExpiredError = () => {
  return new AuthenticationError('Token expiré, veuillez vous reconnecter');
};

/**
 * Gère les erreurs Multer (upload)
 */
const handleMulterError = (err) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return new ValidationError('Fichier trop volumineux (max: 5MB)');
  }
  if (err.code === 'LIMIT_FILE_COUNT') {
    return new ValidationError('Trop de fichiers (max: 10)');
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return new ValidationError('Type de fichier non autorisé');
  }
  return new ValidationError(`Erreur d'upload: ${err.message}`);
};

// ==========================================
// FORMATAGE DES RÉPONSES D'ERREUR
// ==========================================

/**
 * Envoie une erreur en développement (détails complets)
 */
const sendErrorDev = (err, req, res) => {
  // API
  if (req.originalUrl.startsWith('/api')) {
    return res.status(err.statusCode).json({
      success: false,
      status: err.status,
      message: err.message,
      errors: err.errors || undefined,
      error: err,
      stack: err.stack
    });
  }

  // Rendered website (si frontend SSR plus tard)
  console.error('ERROR 💥', err);
  return res.status(err.statusCode).json({
    success: false,
    message: err.message
  });
};

/**
 * Envoie une erreur en production (sécurisé)
 */
const sendErrorProd = (err, req, res) => {
  // A) API - Erreurs opérationnelles (prévues)
  if (req.originalUrl.startsWith('/api')) {
    if (err.isOperational) {
      return res.status(err.statusCode).json({
        success: false,
        status: err.status,
        message: err.message,
        errors: err.errors || undefined
      });
    }

    // B) Erreurs de programmation - Ne pas divulguer les détails
    console.error('ERROR 💥', err);
    return res.status(500).json({
      success: false,
      status: 'error',
      message: 'Une erreur est survenue, veuillez réessayer'
    });
  }

  // Rendered website
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message
    });
  }

  console.error('ERROR 💥', err);
  return res.status(500).json({
    success: false,
    message: 'Une erreur est survenue'
  });
};

// ==========================================
// MIDDLEWARE PRINCIPAL
// ==========================================

/**
 * Middleware de gestion globale des erreurs
 * Doit être le DERNIER middleware de l'app
 */
const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, req, res);
  } else if (process.env.NODE_ENV === 'production') {
    let error = { ...err };
    error.message = err.message;

    // Transformer les erreurs MongoDB
    if (err.name === 'CastError') error = handleCastErrorDB(err);
    if (err.code === 11000) error = handleDuplicateFieldsDB(err);
    if (err.name === 'ValidationError') error = handleValidationErrorDB(err);
    
    // Transformer les erreurs JWT
    if (err.name === 'JsonWebTokenError') error = handleJWTError();
    if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();
    
    // Transformer les erreurs Multer
    if (err.name === 'MulterError') error = handleMulterError(err);

    sendErrorProd(error, req, res);
  }
};

// ==========================================
// MIDDLEWARE CATCH ASYNC
// ==========================================

/**
 * Wrapper pour fonctions async/await
 * Évite les try/catch répétitifs
 * 
 * Usage:
 * router.get('/', catchAsync(async (req, res) => {
 *   const data = await Model.find();
 *   res.json({ success: true, data });
 * }));
 */
const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

// ==========================================
// MIDDLEWARE 404
// ==========================================

/**
 * Gère les routes non trouvées
 * À placer AVANT le globalErrorHandler
 */
const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError(
    `Route ${req.originalUrl} introuvable sur ce serveur`
  );
  next(error);
};

// ==========================================
// MIDDLEWARE UNCAUGHT EXCEPTIONS
// ==========================================

/**
 * Gère les exceptions non catchées (synchrones)
 * À placer au tout début du fichier server.js
 */
const handleUncaughtException = () => {
  process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION! 💥 Arrêt en cours...');
    console.error(err.name, err.message);
    console.error(err.stack);
    process.exit(1);
  });
};

/**
 * Gère les rejets de promesses non gérés
 * À placer après la création du serveur
 */
const handleUnhandledRejection = (server) => {
  process.on('unhandledRejection', (err) => {
    console.error('UNHANDLED REJECTION! 💥 Arrêt en cours...');
    console.error(err.name, err.message);
    console.error(err.stack);
    
    // Fermer le serveur proprement avant de quitter
    server.close(() => {
      process.exit(1);
    });
  });
};

/**
 * Gère SIGTERM (shutdown propre)
 */
const handleSIGTERM = (server) => {
  process.on('SIGTERM', () => {
    console.log('👋 SIGTERM reçu. Arrêt propre en cours...');
    server.close(() => {
      console.log('💥 Processus terminé!');
    });
  });
};

// ==========================================
// HELPER LOGGING
// ==========================================

/**
 * Log une erreur de manière consistante
 */
const logError = (err, req = null) => {
  const timestamp = new Date().toISOString();
  const requestInfo = req ? {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userId: req.user?.id
  } : {};

  console.error({
    timestamp,
    error: {
      name: err.name,
      message: err.message,
      statusCode: err.statusCode,
      stack: err.stack
    },
    request: requestInfo
  });

  // TODO: Intégrer avec un service de logging (Winston, Sentry, etc.)
};

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  // Classes d'erreurs
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  BusinessLogicError,
  RateLimitError,

  // Middlewares
  globalErrorHandler,
  catchAsync,
  notFoundHandler,

  // Process handlers
  handleUncaughtException,
  handleUnhandledRejection,
  handleSIGTERM,

  // Helpers
  logError
};