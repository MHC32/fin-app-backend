// src/routes/budgets.js - Routes budgets FinApp Haiti
const express = require('express');
const rateLimit = require('express-rate-limit');

// Import controllers et middleware
const BudgetController = require('../controllers/budgetController');
const { 
  authenticate,
  requireRole,
  generalAuthLimiter,
  adminLimiter
} = require('../middleware/auth');

// ✅ NOUVEAU : Import validation centralisée
const { validate, validateObjectId } = require('../middleware/validation');

const router = express.Router();

/**
 * Routes budgets FinApp Haiti
 * 
 * Structure :
 * - Routes CRUD (auth requis) : création, liste, modification, suppression
 * - Routes actions spéciales : ajustement catégorie, snapshot, archivage
 * - Routes analytics : progression, tendances, alertes
 * - Routes templates & utils : templates, statistiques
 * - Routes admin (admin uniquement) : statistiques globales
 * 
 * Sécurité :
 * - Authentification obligatoire pour toutes les routes
 * - Rate limiting adapté par type d'opération
 * - Validation Joi centralisée (validation.js) ✅
 * - Ownership automatique (req.user.userId)
 */

// ===================================================================
// RATE LIMITING ADAPTATIF
// ===================================================================

/**
 * Rate limiting pour opérations normales
 */
const normalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requêtes par IP
  message: {
    success: false,
    message: 'Trop de requêtes, réessayez dans 15 minutes',
    error: 'normal_rate_limit_exceeded'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.userId || req.ip
});

/**
 * Rate limiting pour création/modification
 */
const writeRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes  
  max: 20, // 20 créations/modifications par IP
  message: {
    success: false,
    message: 'Trop de créations/modifications, réessayez dans 15 minutes',
    error: 'write_rate_limit_exceeded'
  },
  keyGenerator: (req) => req.user?.userId || req.ip
});

/**
 * Rate limiting pour analytics
 */
const analyticsRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 30, // 30 requêtes analytics par IP
  message: {
    success: false,
    message: 'Trop de requêtes analytics, réessayez dans 5 minutes',
    error: 'analytics_rate_limit_exceeded'
  },
  keyGenerator: (req) => req.user?.userId || req.ip
});

/**
 * Rate limiting pour admin
 */
const adminRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 50, // 50 requêtes admin par IP
  message: {
    success: false,
    message: 'Trop de requêtes admin, réessayez dans 10 minutes',
    error: 'admin_rate_limit_exceeded'
  },
  keyGenerator: (req) => req.user?.userId || req.ip
});

// ===================================================================
// MIDDLEWARE D'AUTHENTIFICATION
// ===================================================================

// Tous les endpoints nécessitent une authentification
router.use(authenticate);

// ===================================================================
// ROUTES CRUD BUDGETS
// ===================================================================

/**
 * @route   POST /api/budgets
 * @desc    Créer un nouveau budget
 * @access  Private
 */
router.post('/',
  writeRateLimit,
  validate('budget', 'create'), // ✅ Validation centralisée
  BudgetController.createBudget
);

/**
 * @route   POST /api/budgets/from-template
 * @desc    Créer budget depuis template
 * @access  Private
 */
router.post('/from-template',
  writeRateLimit,
  validate('budget', 'createFromTemplate'), // ✅ Validation centralisée
  BudgetController.createFromTemplate
);

/**
 * @route   GET /api/budgets/list
 * @desc    Lister les budgets de l'utilisateur
 * @access  Private
 */
router.get('/list',
  normalRateLimit,
  validate('budget', 'filter', 'query'), // ✅ Validation centralisée
  BudgetController.listBudgets
);

/**
 * @route   GET /api/budgets/:id
 * @desc    Obtenir détails d'un budget
 * @access  Private
 */
router.get('/:id',
  normalRateLimit,
  validateObjectId('id'), // ✅ Validation ID
  BudgetController.getBudgetDetails
);

/**
 * @route   PUT /api/budgets/:id
 * @desc    Modifier un budget
 * @access  Private
 */
router.put('/:id',
  writeRateLimit,
  validateObjectId('id'), // ✅ Validation ID
  validate('budget', 'update'), // ✅ Validation centralisée
  BudgetController.updateBudget
);

/**
 * @route   DELETE /api/budgets/:id
 * @desc    Supprimer un budget
 * @access  Private
 */
router.delete('/:id',
  writeRateLimit,
  validateObjectId('id'), // ✅ Validation ID
  BudgetController.deleteBudget
);

// ===================================================================
// ROUTES ACTIONS SPÉCIALES
// ===================================================================

/**
 * @route   PUT /api/budgets/:id/adjust-category
 * @desc    Ajuster budget d'une catégorie
 * @access  Private
 */
router.put('/:id/adjust-category',
  writeRateLimit,
  validateObjectId('id'), // ✅ Validation ID
  validate('budget', 'adjustCategory'), // ✅ Validation centralisée
  BudgetController.adjustCategoryBudget
);

/**
 * @route   POST /api/budgets/:id/snapshot
 * @desc    Créer snapshot mensuel
 * @access  Private
 */
router.post('/:id/snapshot',
  writeRateLimit,
  validateObjectId('id'), // ✅ Validation ID
  BudgetController.createSnapshot
);

/**
 * @route   PUT /api/budgets/:id/archive
 * @desc    Archiver/désarchiver budget
 * @access  Private
 */
router.put('/:id/archive',
  writeRateLimit,
  validateObjectId('id'), // ✅ Validation ID
  validate('budget', 'archive'), // ✅ Validation centralisée
  BudgetController.toggleArchive
);

// ===================================================================
// ROUTES ANALYTICS
// ===================================================================

/**
 * @route   GET /api/budgets/analytics/progress
 * @desc    Analytics de progression des budgets
 * @access  Private
 */
router.get('/analytics/progress',
  analyticsRateLimit,
  validate('budget', 'analyticsProgress', 'query'), // ✅ Validation centralisée
  BudgetController.getBudgetProgress
);

/**
 * @route   GET /api/budgets/analytics/trends
 * @desc    Analytics par période et tendances
 * @access  Private
 */
router.get('/analytics/trends',
  analyticsRateLimit,
  validate('budget', 'analyticsTrends', 'query'), // ✅ Validation centralisée
  BudgetController.getBudgetTrends
);

/**
 * @route   GET /api/budgets/alerts
 * @desc    Budgets nécessitant attention
 * @access  Private
 */
router.get('/alerts',
  analyticsRateLimit,
  BudgetController.getBudgetAlerts
);

// ===================================================================
// ROUTES TEMPLATES & UTILS
// ===================================================================

/**
 * @route   GET /api/budgets/templates
 * @desc    Obtenir templates disponibles
 * @access  Private
 */
router.get('/templates',
  normalRateLimit,
  BudgetController.getTemplates
);

/**
 * @route   GET /api/budgets/stats
 * @desc    Statistiques utilisateur globales
 * @access  Private
 */
router.get('/stats',
  analyticsRateLimit,
  BudgetController.getUserStats
);

// ===================================================================
// ROUTES ADMIN
// ===================================================================

/**
 * @route   GET /api/budgets/admin/stats
 * @desc    Statistiques admin globales
 * @access  Admin
 */
router.get('/admin/stats',
  adminRateLimit,
  requireRole('admin'),
  BudgetController.getAdminStats
);

// ===================================================================
// ROUTE INFO/DOCUMENTATION
// ===================================================================

/**
 * @route   GET /api/budgets
 * @desc    Documentation endpoints budgets
 * @access  Private
 */
router.get('/',
  normalRateLimit,
  (req, res) => {
    res.json({
      success: true,
      message: 'API Budgets FinApp Haiti 🇭🇹',
      data: {
        service: 'budgets',
        version: '1.0.0',
        description: 'Gestion complète des budgets personnels et familiaux',
        endpoints: {
          crud: {
            create: 'POST /api/budgets',
            createFromTemplate: 'POST /api/budgets/from-template',
            list: 'GET /api/budgets/list',
            getById: 'GET /api/budgets/:id',
            update: 'PUT /api/budgets/:id',
            delete: 'DELETE /api/budgets/:id'
          },
          actions: {
            adjustCategory: 'PUT /api/budgets/:id/adjust-category',
            snapshot: 'POST /api/budgets/:id/snapshot',
            archive: 'PUT /api/budgets/:id/archive'
          },
          analytics: {
            progress: 'GET /api/budgets/analytics/progress',
            trends: 'GET /api/budgets/analytics/trends',
            alerts: 'GET /api/budgets/alerts'
          },
          utils: {
            templates: 'GET /api/budgets/templates',
            stats: 'GET /api/budgets/stats'
          },
          admin: {
            stats: 'GET /api/budgets/admin/stats'
          }
        },
        rateLimits: {
          normal: '100 req/15min',
          write: '20 req/15min',
          analytics: '30 req/5min',
          admin: '50 req/10min'
        },
        supportedCategories: [
          'alimentation', 'transport', 'logement', 'sante', 'education',
          'loisirs', 'factures', 'carburant', 'vetements', 'commerce',
          'epargne', 'investment', 'sol', 'other'
        ],
        supportedPeriods: ['weekly', 'monthly', 'quarterly', 'yearly'],
        supportedCurrencies: ['HTG', 'USD'],
        security: {
          authentication: 'JWT required',
          ownership: 'Automatic user isolation',
          validation: 'Joi centralized validation', // ✅ Mise à jour
          rateLimit: 'Operation-based limiting'
        }
      },
      timestamp: new Date().toISOString()
    });
  }
);

// ===================================================================
// EXPORT DU ROUTER
// ===================================================================
module.exports = router;