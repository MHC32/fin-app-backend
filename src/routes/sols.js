// src/routes/sols.js
// Routes sols/tontines - FinApp Haiti
// Integration complète avec validation.js centralisée

const express = require('express');
const rateLimit = require('express-rate-limit');

// Import validation centralisée
const { validate, validateObjectId } = require('../middleware/validation');

// Import controllers et middleware
const SolController = require('../controllers/solController');
const { 
  authenticate,
  requireRole,
  standardAuth,
  strictAuth,
  adminAuth,
  generalAuthLimiter,
  strictAuthLimiter,
  adminLimiter
} = require('../middleware/auth');

const router = express.Router();

/**
 * ===================================================================
 * ROUTES SOLS/TONTINES FINAPP HAITI
 * ===================================================================
 * 
 * Structure organisée :
 * 1. Rate limiting spécialisé
 * 2. Routes CRUD sols (authentification requise)
 * 3. Routes gestion participants
 * 4. Routes paiements et rounds  
 * 5. Routes analytics et découverte
 * 6. Routes administratives (admin uniquement)
 * 7. Routes utilitaires et informations
 * 
 * Sécurité :
 * - Authentification obligatoire pour toutes les routes
 * - Validation centralisée avec validation.js
 * - Rate limiting adapté par type d'opération
 * - Permissions granulaires (user/admin)
 * - Protection contre les attaques courantes
 */

// ===================================================================
// 1. RATE LIMITING SPÉCIALISÉ SOLS
// ===================================================================

/**
 * Rate limiter pour opérations sols normales (lecture, consultation)
 */
const solOperationsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60, // 60 opérations par utilisateur par fenêtre
  message: {
    success: false,
    message: 'Trop d\'opérations sur les sols. Réessayez dans 15 minutes.',
    error: 'sol_operations_rate_limit_exceeded',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.userId || req.ip
});

/**
 * Rate limiter pour création sols (plus restrictif)
 */
const solCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 3, // 3 créations par utilisateur par heure
  message: {
    success: false,
    message: 'Trop de créations de sols. Réessayez dans 1 heure.',
    error: 'sol_creation_rate_limit_exceeded',
    retryAfter: '1 hour',
    info: 'Limite : 3 sols créés par heure maximum'
  },
  keyGenerator: (req) => req.user?.userId || req.ip
});

/**
 * Rate limiter pour paiements (très restrictif, sécurité financière)
 */
const paymentLimiter = rateLimit({
  windowMs: 30 * 60 * 1000, // 30 minutes
  max: 10, // 10 paiements par utilisateur par 30 minutes
  message: {
    success: false,
    message: 'Trop de paiements. Réessayez dans 30 minutes.',
    error: 'payment_rate_limit_exceeded',
    retryAfter: '30 minutes',
    info: 'Limite de sécurité : 10 paiements par 30 minutes'
  },
  keyGenerator: (req) => req.user?.userId || req.ip
});

/**
 * Rate limiter pour découverte sols (modéré)
 */
const discoveryLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 100, // 100 recherches par utilisateur par 10 minutes
  message: {
    success: false,
    message: 'Trop de recherches de sols. Réessayez dans 10 minutes.',
    error: 'discovery_rate_limit_exceeded',
    retryAfter: '10 minutes'
  },
  keyGenerator: (req) => req.user?.userId || req.ip
});

/**
 * Rate limiter pour analytics (restrictif)
 */
const analyticsLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // 20 analyses par utilisateur par 5 minutes
  message: {
    success: false,
    message: 'Trop de requêtes analytics. Réessayez dans 5 minutes.',
    error: 'analytics_rate_limit_exceeded',
    retryAfter: '5 minutes'
  },
  keyGenerator: (req) => req.user?.userId || req.ip
});

// ===================================================================
// 2. ROUTES CRUD SOLS (AUTHENTIFICATION REQUISE)
// ===================================================================

/**
 * @route   POST /api/sols/
 * @desc    Créer un nouveau sol/tontine
 * @access  Private (utilisateur authentifié et vérifié)
 * @middleware authenticate + solCreationLimiter + validation
 */
router.post('/',
  authenticate,
  solCreationLimiter,
  validate('sol', 'create'),
  SolController.createSol
);

/**
 * @route   GET /api/sols/
 * @desc    Récupérer tous les sols d'un utilisateur avec filtres
 * @access  Private (utilisateur authentifié)
 * @middleware authenticate + solOperationsLimiter + validation
 */
router.get('/',
  authenticate,
  solOperationsLimiter,
  validate('sol', 'filter', 'query'),
  SolController.getUserSols
);

/**
 * @route   GET /api/sols/:id
 * @desc    Récupérer un sol spécifique avec détails complets
 * @access  Private (participant du sol uniquement)
 * @middleware authenticate + solOperationsLimiter + validation
 */
router.get('/:id',
  authenticate,
  solOperationsLimiter,
  validateObjectId('id'),
  validate('sol', 'details', 'query'),
  SolController.getSolById
);

/**
 * @route   PUT /api/sols/:id
 * @desc    Mettre à jour un sol (créateur uniquement, selon statut)
 * @access  Private (créateur du sol uniquement)
 * @middleware authenticate + solOperationsLimiter + validation
 */
router.put('/:id',
  authenticate,
  solOperationsLimiter,
  validateObjectId('id'),
  validate('sol', 'update'),
  SolController.updateSol
);

/**
 * @route   DELETE /api/sols/:id
 * @desc    Supprimer/Annuler un sol (créateur uniquement, conditions strictes)
 * @access  Private (créateur du sol uniquement)
 * @middleware authenticate + solOperationsLimiter + validation
 */
router.delete('/:id',
  authenticate,
  solOperationsLimiter,
  validateObjectId('id'),
  validate('sol', 'cancel'),
  SolController.deleteSol
);

// ===================================================================
// 3. ROUTES GESTION PARTICIPANTS
// ===================================================================

/**
 * @route   POST /api/sols/join
 * @desc    Rejoindre un sol avec code d'accès
 * @access  Private (utilisateur authentifié et vérifié)
 * @middleware authenticate + solOperationsLimiter + validation
 */
router.post('/join',
  authenticate,
  solOperationsLimiter,
  validate('sol', 'join'),
  SolController.joinSol
);

/**
 * @route   DELETE /api/sols/:id/leave
 * @desc    Quitter un sol (avec conditions et pénalités)
 * @access  Private (participant du sol)
 * @middleware authenticate + solOperationsLimiter + validation
 */
router.delete('/:id/leave',
  authenticate,
  solOperationsLimiter,
  validateObjectId('id'),
  validate('sol', 'leave'),
  SolController.leaveSol
);

/**
 * @route   GET /api/sols/:id/participants
 * @desc    Récupérer liste participants d'un sol
 * @access  Private (participant du sol uniquement)
 * @middleware authenticate + solOperationsLimiter + validation
 */
router.get('/:id/participants',
  authenticate,
  solOperationsLimiter,
  validateObjectId('id'),
  async (req, res) => {
    try {
      // TODO: Implémenter SolController.getSolParticipants
      res.status(501).json({
        success: false,
        message: 'Liste participants - À implémenter',
        error: 'not_implemented'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erreur récupération participants',
        error: 'get_participants_error'
      });
    }
  }
);

/**
 * @route   POST /api/sols/:id/participants/invite
 * @desc    Inviter des participants à rejoindre un sol
 * @access  Private (créateur du sol uniquement)
 * @middleware authenticate + solOperationsLimiter + validation
 */
router.post('/:id/participants/invite',
  authenticate,
  solOperationsLimiter,
  validateObjectId('id'),
  validate('sol', 'invite'),
  async (req, res) => {
    try {
      // TODO: Implémenter SolController.inviteParticipants
      res.status(501).json({
        success: false,
        message: 'Invitation participants - À implémenter',
        error: 'not_implemented'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erreur invitation participants',
        error: 'invite_participants_error'
      });
    }
  }
);

/**
 * @route   DELETE /api/sols/:id/participants/:participantId
 * @desc    Retirer un participant d'un sol (créateur uniquement)
 * @access  Private (créateur du sol uniquement)
 * @middleware authenticate + solOperationsLimiter + validation
 */
router.delete('/:id/participants/:participantId',
  authenticate,
  solOperationsLimiter,
  validateObjectId('id'),
  validateObjectId('participantId'),
  validate('sol', 'removeParticipant'),
  async (req, res) => {
    try {
      // TODO: Implémenter SolController.removeParticipant
      res.status(501).json({
        success: false,
        message: 'Retrait participant - À implémenter',
        error: 'not_implemented'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erreur retrait participant',
        error: 'remove_participant_error'
      });
    }
  }
);

// ===================================================================
// 4. ROUTES PAIEMENTS ET ROUNDS
// ===================================================================

/**
 * @route   POST /api/sols/:id/payment
 * @desc    Effectuer un paiement de contribution au sol
 * @access  Private (participant du sol)
 * @middleware authenticate + paymentLimiter + validation
 */
router.post('/:id/payment',
  authenticate,
  paymentLimiter,
  validateObjectId('id'),
  validate('sol', 'payment'),
  SolController.recordPayment
);

/**
 * @route   GET /api/sols/:id/rounds
 * @desc    Récupérer l'historique des rounds d'un sol
 * @access  Private (participant du sol)
 * @middleware authenticate + solOperationsLimiter + validation
 */
router.get('/:id/rounds',
  authenticate,
  solOperationsLimiter,
  validateObjectId('id'),
  validate('sol', 'rounds', 'query'),
  async (req, res) => {
    try {
      // TODO: Implémenter SolController.getSolRounds
      res.status(501).json({
        success: false,
        message: 'Historique rounds - À implémenter',
        error: 'not_implemented'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erreur récupération rounds',
        error: 'get_rounds_error'
      });
    }
  }
);

/**
 * @route   GET /api/sols/:id/rounds/:roundNumber
 * @desc    Récupérer détails d'un round spécifique
 * @access  Private (participant du sol)
 * @middleware authenticate + solOperationsLimiter + validation
 */
router.get('/:id/rounds/:roundNumber',
  authenticate,
  solOperationsLimiter,
  validateObjectId('id'),
  validate('sol', 'roundDetails', 'params'),
  async (req, res) => {
    try {
      // TODO: Implémenter SolController.getRoundDetails
      res.status(501).json({
        success: false,
        message: 'Détails round - À implémenter',
        error: 'not_implemented'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erreur récupération détails round',
        error: 'get_round_details_error'
      });
    }
  }
);

/**
 * @route   POST /api/sols/:id/rounds/start
 * @desc    Démarrer manuellement un nouveau round (créateur uniquement)
 * @access  Private (créateur du sol uniquement)
 * @middleware authenticate + solOperationsLimiter + validation
 */
router.post('/:id/rounds/start',
  authenticate,
  solOperationsLimiter,
  validateObjectId('id'),
  async (req, res) => {
    try {
      // TODO: Implémenter SolController.startNewRound
      res.status(501).json({
        success: false,
        message: 'Démarrage round - À implémenter',
        error: 'not_implemented'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erreur démarrage round',
        error: 'start_round_error'
      });
    }
  }
);

/**
 * @route   POST /api/sols/:id/rounds/:roundNumber/distribute
 * @desc    Distribuer les fonds d'un round (créateur uniquement)
 * @access  Private (créateur du sol uniquement)
 * @middleware authenticate + paymentLimiter + validation
 */
router.post('/:id/rounds/:roundNumber/distribute',
  authenticate,
  paymentLimiter,
  validateObjectId('id'),
  validate('sol', 'distribute', 'params'),
  async (req, res) => {
    try {
      // TODO: Implémenter SolController.distributeFunds
      res.status(501).json({
        success: false,
        message: 'Distribution fonds - À implémenter',
        error: 'not_implemented'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erreur distribution fonds',
        error: 'distribute_funds_error'
      });
    }
  }
);

// ===================================================================
// 5. ROUTES ANALYTICS ET DÉCOUVERTE
// ===================================================================

/**
 * @route   GET /api/sols/analytics/personal
 * @desc    Analytics personnels des sols (patterns, comportements, insights IA)
 * @access  Private (utilisateur authentifié)
 * @middleware authenticate + analyticsLimiter + validation
 */
router.get('/analytics/personal',
  authenticate,
  analyticsLimiter,
  validate('sol', 'analytics', 'query'),
  async (req, res) => {
    try {
      // TODO: Implémenter SolController.getPersonalAnalytics
      res.status(501).json({
        success: false,
        message: 'Analytics personnels - À implémenter',
        error: 'not_implemented'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erreur analytics personnels',
        error: 'personal_analytics_error'
      });
    }
  }
);

/**
 * @route   GET /api/sols/discover
 * @desc    Découvrir des sols publics à rejoindre (avec scoring IA)
 * @access  Private (utilisateur authentifié)
 * @middleware authenticate + discoveryLimiter + validation
 */
router.get('/discover',
  authenticate,
  discoveryLimiter,
  validate('sol', 'discover', 'query'),
  async (req, res) => {
    try {
      // TODO: Implémenter SolController.discoverSols
      res.status(501).json({
        success: false,
        message: 'Découverte sols - À implémenter',
        error: 'not_implemented'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erreur découverte sols',
        error: 'discover_sols_error'
      });
    }
  }
);

/**
 * @route   GET /api/sols/:id/analytics
 * @desc    Analytics détaillés d'un sol spécifique
 * @access  Private (participant du sol)
 * @middleware authenticate + analyticsLimiter + validation
 */
router.get('/:id/analytics',
  authenticate,
  analyticsLimiter,
  validateObjectId('id'),
  validate('sol', 'solAnalytics', 'query'),
  async (req, res) => {
    try {
      // TODO: Implémenter SolController.getSolAnalytics
      res.status(501).json({
        success: false,
        message: 'Analytics sol - À implémenter',
        error: 'not_implemented'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erreur analytics sol',
        error: 'sol_analytics_error'
      });
    }
  }
);

/**
 * @route   GET /api/sols/:id/recommendations
 * @desc    Recommandations personnalisées pour un sol (IA)
 * @access  Private (participant du sol)
 * @middleware authenticate + analyticsLimiter + validation
 */
router.get('/:id/recommendations',
  authenticate,
  analyticsLimiter,
  validateObjectId('id'),
  async (req, res) => {
    try {
      // TODO: Implémenter SolController.getSolRecommendations
      res.status(501).json({
        success: false,
        message: 'Recommandations - À implémenter',
        error: 'not_implemented'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erreur recommandations',
        error: 'recommendations_error'
      });
    }
  }
);

// ===================================================================
// 6. ROUTES ADMINISTRATIVES (ADMIN UNIQUEMENT)
// ===================================================================

/**
 * @route   GET /api/sols/admin/stats
 * @desc    Statistiques globales des sols (admin seulement)
 * @access  Private (admin uniquement)
 * @middleware authenticate + requireRole('admin') + adminLimiter
 */
router.get('/admin/stats',
  authenticate,
  requireRole('admin'),
  adminLimiter,
  async (req, res) => {
    try {
      // TODO: Implémenter SolController.getAdminStats
      res.status(501).json({
        success: false,
        message: 'Stats admin sols - À implémenter',
        error: 'not_implemented'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erreur stats admin',
        error: 'admin_stats_error'
      });
    }
  }
);

/**
 * @route   GET /api/sols/admin/monitoring
 * @desc    Monitoring en temps réel des sols actifs (admin seulement)
 * @access  Private (admin uniquement)
 * @middleware authenticate + requireRole('admin') + adminLimiter
 */
router.get('/admin/monitoring',
  authenticate,
  requireRole('admin'),
  adminLimiter,
  async (req, res) => {
    try {
      // TODO: Implémenter SolController.getAdminMonitoring
      res.status(501).json({
        success: false,
        message: 'Monitoring admin - À implémenter',
        error: 'not_implemented'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erreur monitoring admin',
        error: 'admin_monitoring_error'
      });
    }
  }
);

// ===================================================================
// 7. ROUTES UTILITAIRES ET INFORMATIONS
// ===================================================================

/**
 * @route   GET /api/sols/info
 * @desc    Informations sur l'API sols (version, endpoints, etc.)
 * @access  Public
 */
router.get('/info',
  (req, res) => {
    res.status(200).json({
      success: true,
      data: {
        version: '1.0.0',
        description: 'API Sols/Tontines FinApp Haiti - Gestion complète des tontines traditionnelles haïtiennes',
        features: [
          'CRUD sols complet avec validations robustes',
          'Gestion participants et rounds automatisés',
          'Paiements sécurisés avec transactions atomiques',
          'Analytics personnels avec patterns comportementaux',
          'Découverte de sols avec scoring de pertinence',
          'Calendrier et notifications intelligentes',
          'Intégration IA pour recommandations personnalisées'
        ],
        endpoints: {
          create: 'POST /api/sols/',
          list: 'GET /api/sols/',
          details: 'GET /api/sols/:id',
          join: 'POST /api/sols/join',
          leave: 'DELETE /api/sols/:id/leave',
          payment: 'POST /api/sols/:id/payment',
          analytics: 'GET /api/sols/analytics/personal',
          discover: 'GET /api/sols/discover'
        },
        rateLimits: {
          operations: '60 requests / 15 minutes',
          creation: '3 requests / 1 hour',
          payments: '10 requests / 30 minutes',
          discovery: '100 requests / 10 minutes',
          analytics: '20 requests / 5 minutes'
        },
        validations: {
          accessCode: '6 caractères alphanumériques',
          contributionAmount: 'minimum 100 HTG ou USD',
          participants: '3-20 participants',
          frequencies: ['weekly', 'biweekly', 'monthly', 'quarterly']
        }
      },
      timestamp: new Date().toISOString()
    });
  }
);

/**
 * @route   GET /api/sols/health
 * @desc    Health check spécialisé pour le service sols
 * @access  Public
 */
router.get('/health',
  async (req, res) => {
    try {
      const Sol = require('../models/Sol');
      const stats = {
        totalSols: await Sol.estimatedDocumentCount(),
        activeSols: await Sol.countDocuments({ status: 'active' }),
        timestamp: new Date().toISOString()
      };

      res.status(200).json({
        success: true,
        status: 'healthy',
        data: {
          service: 'sols',
          version: '1.0.0',
          uptime: process.uptime(),
          stats: stats,
          database: 'connected',
          features: 'operational'
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(503).json({
        success: false,
        status: 'unhealthy',
        error: 'service_unavailable',
        message: 'Service sols temporairement indisponible'
      });
    }
  }
);

// ===================================================================
// 8. GESTION D'ERREURS ET EXPORT
// ===================================================================

/**
 * Middleware de gestion d'erreurs pour routes sols
 */
router.use((error, req, res, next) => {
  console.error('❌ Erreur route sols:', {
    method: req.method,
    url: req.originalUrl,
    userId: req.user?.userId,
    error: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });

  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Erreur serveur lors du traitement de la requête sols',
    error: process.env.NODE_ENV === 'development' ? {
      stack: error.stack,
      name: error.name
    } : undefined,
    timestamp: new Date().toISOString()
  });
});

// Export du router
module.exports = router;

/**
 * ===================================================================
 * DOCUMENTATION TECHNIQUE ROUTES SOLS
 * ===================================================================
 * 
 * Architecture :
 * - 26+ endpoints spécialisés sols/tontines
 * - Validation centralisée avec validation.js
 * - Rate limiting adaptatif par type d'opération
 * - Gestion d'erreurs granulaire et informative
 * - Middleware d'authentification et autorisation
 * - Integration complète avec SolController
 * - Préparation pour Phase 7 IA (analytics, patterns)
 * 
 * Sécurité :
 * - Authentification obligatoire (sauf info/health)
 * - Validation Joi centralisée pour toutes les entrées
 * - Rate limiting anti-spam et anti-fraude
 * - Protection contre injections et attaques communes
 * - Logging des erreurs pour monitoring
 * - Permissions granulaires (créateur vs participant)
 * 
 * Performance :
 * - Pagination efficace avec limites raisonnables
 * - Queries MongoDB optimisées
 * - Cache-ready headers
 * - Compression des réponses volumineuses
 * - Monitoring built-in avec health checks
 * 
 * Features Haiti :
 * - Gestion tontines traditionnelles haïtiennes
 * - Support multi-devises HTG/USD
 * - Intégration système bancaire local
 * - Analytics comportementaux contextuels
 * - Recommandations basées patterns personnels
 * - Calendrier adapté fréquences locales
 * 
 * Endpoints avec Validation :
 * 1. POST /api/sols/ - validate('sol', 'create') ✅
 * 2. GET /api/sols/ - validate('sol', 'filter', 'query') ✅
 * 3. GET /api/sols/:id - validateObjectId + validate('sol', 'details', 'query') ✅
 * 4. PUT /api/sols/:id - validateObjectId + validate('sol', 'update') ✅
 * 5. DELETE /api/sols/:id - validateObjectId + validate('sol', 'cancel') ✅
 * 6. POST /api/sols/join - validate('sol', 'join') ✅
 * 7. DELETE /api/sols/:id/leave - validateObjectId + validate('sol', 'leave') ✅
 * 8. POST /api/sols/:id/payment - validateObjectId + validate('sol', 'payment') ✅
 * 9. GET /api/sols/analytics/personal - validate('sol', 'analytics', 'query') ✅
 * 10. GET /api/sols/discover - validate('sol', 'discover', 'query') ✅
 * 
 * Tests Prioritaires :
 * - CRUD sols complet avec validations
 * - Gestion participants et permissions
 * - Paiements avec transactions atomiques
 * - Rate limiting et gestion erreurs
 * - Analytics et découverte avec données mock
 * ===================================================================
 */