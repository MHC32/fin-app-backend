// src/routes/investments.js
// Routes pour gestion investissements - FinApp Haiti
// Integration complète avec validation.js centralisée

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

// Import validation centralisée
const { validate, validateObjectId } = require('../middleware/validation');

// Import controllers et middleware
const InvestmentController = require('../controllers/investmentController');
const { authenticate } = require('../middleware/auth');

/**
 * ===================================================================
 * ROUTES INVESTMENTS - FINAPP HAITI
 * ===================================================================
 * 
 * Architecture :
 * - Gestion complète des investissements
 * - Validation centralisée avec validation.js
 * - Suivi revenus/dépenses avec calculs ROI
 * - Gestion partenaires et participations
 * - Analytics et performance tracking
 * 
 * Sécurité :
 * - Authentification obligatoire pour toutes les routes
 * - Validation Joi centralisée pour toutes les entrées
 * - Rate limiting adapté par type d'opération
 * - Protection ownership (propriétaire uniquement)
 * 
 * Features Haiti :
 * - Support multi-devises HTG/USD
 * - Types investissements contextuels (agriculture, commerce, etc.)
 * - Tracking performance adapté au contexte local
 * - Intégration avec système bancaire haïtien
 */

// ===================================================================
// RATE LIMITING SPÉCIALISÉ INVESTMENTS
// ===================================================================

/**
 * Rate limiter pour opérations investments normales
 */
const investmentOperationsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60,
  message: {
    success: false,
    message: 'Trop d\'opérations sur les investissements. Réessayez dans 15 minutes.',
    error: 'investment_operations_rate_limit_exceeded'
  },
  keyGenerator: (req) => req.user?.userId || req.ip
});

/**
 * Rate limiter pour création investments (plus restrictif)
 */
const investmentCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 5,
  message: {
    success: false,
    message: 'Trop de créations d\'investissements. Réessayez dans 1 heure.',
    error: 'investment_creation_rate_limit_exceeded'
  },
  keyGenerator: (req) => req.user?.userId || req.ip
});

/**
 * Rate limiter pour opérations financières (revenus/dépenses)
 */
const financialOperationsLimiter = rateLimit({
  windowMs: 30 * 60 * 1000, // 30 minutes
  max: 20,
  message: {
    success: false,
    message: 'Trop d\'opérations financières. Réessayez dans 30 minutes.',
    error: 'financial_operations_rate_limit_exceeded'
  },
  keyGenerator: (req) => req.user?.userId || req.ip
});

/**
 * Rate limiter pour analytics
 */
const analyticsLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20,
  message: {
    success: false,
    message: 'Trop de requêtes analytics. Réessayez dans 5 minutes.',
    error: 'analytics_rate_limit_exceeded'
  },
  keyGenerator: (req) => req.user?.userId || req.ip
});

// Middleware auth pour toutes les routes
router.use(authenticate);

// ===================================================================
// ROUTES CRUD INVESTMENTS
// ===================================================================

/**
 * @route   POST /api/investments/
 * @desc    Créer un nouvel investissement
 * @access  Private (utilisateur authentifié)
 * @middleware authenticate + investmentCreationLimiter + validation
 */
router.post('/',
  investmentCreationLimiter,
  validate('investment', 'create'),
  InvestmentController.createInvestment
);

/**
 * @route   GET /api/investments/
 * @desc    Récupérer tous les investissements de l'utilisateur
 * @access  Private (utilisateur authentifié)
 * @middleware authenticate + investmentOperationsLimiter + validation
 */
router.get('/',
  investmentOperationsLimiter,
  validate('investment', 'filter', 'query'),
  InvestmentController.getUserInvestments
);

/**
 * @route   GET /api/investments/:investmentId
 * @desc    Récupérer un investissement spécifique avec détails complets
 * @access  Private (propriétaire uniquement)
 * @middleware authenticate + investmentOperationsLimiter + validation
 */
router.get('/:investmentId',
  investmentOperationsLimiter,
  validateObjectId('investmentId'),
  validate('investment', 'details', 'query'),
  InvestmentController.getInvestmentById
);

/**
 * @route   PUT /api/investments/:investmentId
 * @desc    Mettre à jour un investissement
 * @access  Private (propriétaire uniquement)
 * @middleware authenticate + investmentOperationsLimiter + validation
 */
router.put('/:investmentId',
  investmentOperationsLimiter,
  validateObjectId('investmentId'),
  validate('investment', 'update'),
  InvestmentController.updateInvestment
);

// ===================================================================
// ROUTES GESTION FINANCIÈRE (REVENUS/DÉPENSES)
// ===================================================================

/**
 * @route   POST /api/investments/:investmentId/revenue
 * @desc    Ajouter un revenu à un investissement
 * @access  Private (propriétaire uniquement)
 * @middleware authenticate + financialOperationsLimiter + validation
 */
router.post('/:investmentId/revenue',
  financialOperationsLimiter,
  validateObjectId('investmentId'),
  validate('investment', 'addRevenue'),
  InvestmentController.addRevenue
);

/**
 * @route   POST /api/investments/:investmentId/expense
 * @desc    Ajouter une dépense à un investissement
 * @access  Private (propriétaire uniquement)
 * @middleware authenticate + financialOperationsLimiter + validation
 */
router.post('/:investmentId/expense',
  financialOperationsLimiter,
  validateObjectId('investmentId'),
  validate('investment', 'addExpense'),
  InvestmentController.addExpense
);

// ===================================================================
// ROUTES GESTION PARTENAIRES
// ===================================================================

/**
 * @route   POST /api/investments/:investmentId/partner
 * @desc    Ajouter un partenaire à un investissement
 * @access  Private (propriétaire uniquement)
 * @middleware authenticate + investmentOperationsLimiter + validation
 */
router.post('/:investmentId/partner',
  investmentOperationsLimiter,
  validateObjectId('investmentId'),
  validate('investment', 'addPartner'),
  InvestmentController.addPartner
);

// ===================================================================
// ROUTES ANALYTICS
// ===================================================================

/**
 * @route   GET /api/investments/analytics/portfolio
 * @desc    Analytics complet du portfolio d'investissements
 * @access  Private (utilisateur authentifié)
 * @middleware authenticate + analyticsLimiter
 */
router.get('/analytics/portfolio',
  analyticsLimiter,
  InvestmentController.getPortfolioAnalytics
);

/**
 * @route   GET /api/investments/analytics/by-type
 * @desc    Analytics des investissements par type
 * @access  Private (utilisateur authentifié)
 * @middleware authenticate + analyticsLimiter
 */
router.get('/analytics/by-type',
  analyticsLimiter,
  InvestmentController.getAnalyticsByType
);

/**
 * @route   GET /api/investments/analytics/needing-attention
 * @desc    Investissements nécessitant attention (risques, ROI négatif, etc.)
 * @access  Private (utilisateur authentifié)
 * @middleware authenticate + analyticsLimiter
 */
router.get('/analytics/needing-attention',
  analyticsLimiter,
  InvestmentController.getNeedingAttention
);

// ===================================================================
// ROUTES ACTIONS SPÉCIALES
// ===================================================================

/**
 * @route   PUT /api/investments/:investmentId/archive
 * @desc    Archiver/Compléter un investissement
 * @access  Private (propriétaire uniquement)
 * @middleware authenticate + investmentOperationsLimiter + validation
 */
router.put('/:investmentId/archive',
  investmentOperationsLimiter,
  validateObjectId('investmentId'),
  validate('investment', 'archive'),
  InvestmentController.archiveInvestment
);

// ===================================================================
// ROUTES UTILITAIRES
// ===================================================================

/**
 * @route   GET /api/investments/info
 * @desc    Informations sur l'API investments
 * @access  Public
 */
router.get('/info', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      version: '1.0.0',
      description: 'API Investissements - FinApp Haiti',
      features: [
        'Gestion complète investissements',
        'Suivi revenus et dépenses',
        'Calculs ROI automatiques',
        'Gestion partenaires et participations',
        'Analytics portfolio complet',
        'Support multi-devises HTG/USD',
        'Types contextualisés Haiti'
      ],
      endpoints: {
        create: 'POST /api/investments/',
        list: 'GET /api/investments/',
        details: 'GET /api/investments/:id',
        update: 'PUT /api/investments/:id',
        revenue: 'POST /api/investments/:id/revenue',
        expense: 'POST /api/investments/:id/expense',
        partner: 'POST /api/investments/:id/partner',
        portfolio: 'GET /api/investments/analytics/portfolio',
        byType: 'GET /api/investments/analytics/by-type',
        attention: 'GET /api/investments/analytics/needing-attention',
        archive: 'PUT /api/investments/:id/archive'
      },
      investmentTypes: [
        'real_estate', 'agriculture', 'commerce', 'livestock', 
        'transport', 'services', 'technology', 'education', 'other'
      ],
      statuses: [
        'planning', 'active', 'profitable', 'break_even', 
        'loss', 'on_hold', 'completed', 'failed'
      ]
    },
    timestamp: new Date().toISOString()
  });
});

/**
 * @route   GET /api/investments/health
 * @desc    Health check du service investments
 * @access  Public
 */
router.get('/health', async (req, res) => {
  try {
    const Investment = require('../models/Investment');
    const stats = {
      totalInvestments: await Investment.estimatedDocumentCount(),
      activeInvestments: await Investment.countDocuments({ isActive: true }),
      timestamp: new Date().toISOString()
    };

    res.status(200).json({
      success: true,
      status: 'healthy',
      data: {
        service: 'investments',
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
      message: 'Service investments temporairement indisponible'
    });
  }
});

// ===================================================================
// GESTION D'ERREURS
// ===================================================================

/**
 * Middleware de gestion d'erreurs pour routes investments
 */
router.use((error, req, res, next) => {
  console.error('❌ Erreur route investments:', {
    method: req.method,
    url: req.originalUrl,
    userId: req.user?.userId,
    error: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });

  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Erreur serveur lors du traitement de la requête investments',
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
 * DOCUMENTATION TECHNIQUE ROUTES INVESTMENTS
 * ===================================================================
 * 
 * Architecture :
 * - 11+ endpoints investissements
 * - Validation centralisée avec validation.js
 * - Rate limiting adaptatif par type d'opération
 * - Suivi financier complet (revenus/dépenses/ROI)
 * - Analytics et performance tracking
 * 
 * Sécurité :
 * - Authentification obligatoire
 * - Validation Joi centralisée pour toutes les entrées
 * - Rate limiting anti-spam (4 niveaux)
 * - Protection ownership (propriétaire uniquement)
 * - Logging des erreurs pour monitoring
 * 
 * Performance :
 * - Queries MongoDB optimisées
 * - Calculs ROI efficaces
 * - Pagination pour listes
 * - Cache-ready headers
 * - Monitoring avec health checks
 * 
 * Features Haiti :
 * - Support multi-devises HTG/USD
 * - Types investissements contextuels
 * - Agriculture, commerce, transport, etc.
 * - Intégration système bancaire local
 * - Analytics adaptés au contexte
 * 
 * Endpoints avec Validation :
 * 1. POST /api/investments/ - validate('investment', 'create') ✅
 * 2. GET /api/investments/ - validate('investment', 'filter', 'query') ✅
 * 3. GET /api/investments/:id - validateObjectId + validate('investment', 'details', 'query') ✅
 * 4. PUT /api/investments/:id - validateObjectId + validate('investment', 'update') ✅
 * 5. POST /api/investments/:id/revenue - validateObjectId + validate('investment', 'addRevenue') ✅
 * 6. POST /api/investments/:id/expense - validateObjectId + validate('investment', 'addExpense') ✅
 * 7. POST /api/investments/:id/partner - validateObjectId + validate('investment', 'addPartner') ✅
 * 8. PUT /api/investments/:id/archive - validateObjectId + validate('investment', 'archive') ✅
 * 9. GET /api/investments/analytics/portfolio - Pas de validation nécessaire
 * 10. GET /api/investments/analytics/by-type - Pas de validation nécessaire
 * 11. GET /api/investments/analytics/needing-attention - Pas de validation nécessaire
 * 
 * Tests Prioritaires :
 * - CRUD investissements complet
 * - Ajout revenus/dépenses avec calculs ROI
 * - Gestion partenaires et participations
 * - Analytics portfolio et par type
 * - Archivage avec statistiques finales
 * ===================================================================
 */