// src/routes/budgets.js - Routes budgets FinApp Haiti
const express = require('express');
const router = express.Router();
const BudgetController = require('../controllers/budgetController');
const authMiddleware = require('../middleware/auth');
const rateLimit = require('express-rate-limit');
const { body, query, param } = require('express-validator');

// ===================================================================
// RATE LIMITING ADAPTATIF
// ===================================================================

// Rate limiting pour opérations normales
const normalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requêtes par IP
  message: {
    success: false,
    message: 'Trop de requêtes, réessayez dans 15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiting pour création/modification
const writeRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes  
  max: 20, // 20 créations/modifications par IP
  message: {
    success: false,
    message: 'Trop de créations/modifications, réessayez dans 15 minutes'
  }
});

// Rate limiting pour analytics
const analyticsRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 30, // 30 requêtes analytics par IP
  message: {
    success: false,
    message: 'Trop de requêtes analytics, réessayez dans 5 minutes'
  }
});

// Rate limiting pour admin
const adminRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 50, // 50 requêtes admin par IP
  message: {
    success: false,
    message: 'Trop de requêtes admin, réessayez dans 10 minutes'
  }
});

// ===================================================================
// MIDDLEWARE D'AUTHENTIFICATION
// ===================================================================

// Tous les endpoints nécessitent une authentification
router.use(authMiddleware.authenticate);

// ===================================================================
// VALIDATIONS RÉUTILISABLES
// ===================================================================

const budgetValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Le nom doit contenir entre 2 et 100 caractères'),
    
  body('description')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('La description ne peut pas dépasser 255 caractères'),
    
  body('currency')
    .isIn(['HTG', 'USD'])
    .withMessage('Devise non supportée (HTG ou USD uniquement)'),
    
  body('period')
    .isIn(['weekly', 'monthly', 'quarterly', 'yearly'])
    .withMessage('Période non valide'),
    
  body('expectedIncome')
    .isFloat({ min: 100 })
    .withMessage('Les revenus attendus doivent être supérieurs à 100'),
    
  body('categories')
    .isArray({ min: 1 })
    .withMessage('Au moins une catégorie est requise'),
    
  body('categories.*.category')
    .isIn([
      'alimentation', 'transport', 'logement', 'sante', 'education',
      'loisirs', 'factures', 'carburant', 'vetements', 'commerce',
      'epargne', 'investment', 'sol', 'other'
    ])
    .withMessage('Catégorie non valide'),
    
  body('categories.*.budgetedAmount')
    .isFloat({ min: 0 })
    .withMessage('Le montant budgété doit être positif'),
    
  body('startDate')
    .isISO8601()
    .withMessage('Date de début invalide'),
    
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('Date de fin invalide')
];

const updateBudgetValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Le nom doit contenir entre 2 et 100 caractères'),
    
  body('description')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('La description ne peut pas dépasser 255 caractères'),
    
  body('expectedIncome')
    .optional()
    .isFloat({ min: 100 })
    .withMessage('Les revenus attendus doivent être supérieurs à 100'),
    
  body('categories')
    .optional()
    .isArray({ min: 1 })
    .withMessage('Au moins une catégorie est requise si spécifiée'),
    
  body('categories.*.budgetedAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Le montant budgété doit être positif')
];

const idValidation = [
  param('id')
    .isMongoId()
    .withMessage('ID de budget invalide')
];

const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Le numéro de page doit être un entier positif'),
    
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('La limite doit être entre 1 et 100'),
    
  query('sort')
    .optional()
    .matches(/^-?(name|startDate|totalBudgeted|status|createdAt)$/)
    .withMessage('Tri invalide')
];

// ===================================================================
// ROUTES CRUD BUDGETS
// ===================================================================

/**
 * @route   POST /api/budgets
 * @desc    Créer un nouveau budget
 * @access  Private
 * @rateLimit 20/15min
 */
router.post('/',
  writeRateLimit,
  budgetValidation,
  BudgetController.createBudget
);

/**
 * @route   POST /api/budgets/from-template
 * @desc    Créer budget depuis template
 * @access  Private
 * @rateLimit 20/15min
 */
router.post('/from-template',
  writeRateLimit,
  [
    body('templateName')
      .isString()
      .isLength({ min: 1 })
      .withMessage('Nom de template requis'),
      
    body('customData')
      .optional()
      .isObject()
      .withMessage('Les données personnalisées doivent être un objet')
  ],
  BudgetController.createFromTemplate
);

/**
 * @route   GET /api/budgets/list
 * @desc    Lister les budgets de l'utilisateur
 * @access  Private
 * @rateLimit 100/15min
 */
router.get('/list',
  normalRateLimit,
  paginationValidation,
  [
    query('status')
      .optional()
      .isIn(['active', 'completed', 'exceeded', 'paused', 'archived', 'all'])
      .withMessage('Statut invalide'),
      
    query('period')
      .optional()
      .isIn(['weekly', 'monthly', 'quarterly', 'yearly'])
      .withMessage('Période invalide'),
      
    query('includeArchived')
      .optional()
      .isBoolean()
      .withMessage('includeArchived doit être un booléen')
  ],
  BudgetController.listBudgets
);

/**
 * @route   GET /api/budgets/:id
 * @desc    Obtenir détails d'un budget
 * @access  Private
 * @rateLimit 100/15min
 */
router.get('/:id',
  normalRateLimit,
  idValidation,
  BudgetController.getBudgetDetails
);

/**
 * @route   PUT /api/budgets/:id
 * @desc    Modifier un budget
 * @access  Private
 * @rateLimit 20/15min
 */
router.put('/:id',
  writeRateLimit,
  idValidation,
  updateBudgetValidation,
  BudgetController.updateBudget
);

/**
 * @route   DELETE /api/budgets/:id
 * @desc    Supprimer un budget
 * @access  Private
 * @rateLimit 20/15min
 */
router.delete('/:id',
  writeRateLimit,
  idValidation,
  BudgetController.deleteBudget
);

// ===================================================================
// ROUTES ACTIONS SPÉCIALES
// ===================================================================

/**
 * @route   PUT /api/budgets/:id/adjust-category
 * @desc    Ajuster budget d'une catégorie
 * @access  Private
 * @rateLimit 20/15min
 */
router.put('/:id/adjust-category',
  writeRateLimit,
  idValidation,
  [
    body('category')
      .isIn([
        'alimentation', 'transport', 'logement', 'sante', 'education',
        'loisirs', 'factures', 'carburant', 'vetements', 'commerce',
        'epargne', 'investment', 'sol', 'other'
      ])
      .withMessage('Catégorie non valide'),
      
    body('newAmount')
      .isFloat({ min: 0 })
      .withMessage('Le nouveau montant doit être positif'),
      
    body('reason')
      .optional()
      .trim()
      .isLength({ max: 200 })
      .withMessage('La raison ne peut pas dépasser 200 caractères')
  ],
  BudgetController.adjustCategoryBudget
);

/**
 * @route   POST /api/budgets/:id/snapshot
 * @desc    Créer snapshot mensuel
 * @access  Private
 * @rateLimit 20/15min
 */
router.post('/:id/snapshot',
  writeRateLimit,
  idValidation,
  BudgetController.createSnapshot
);

/**
 * @route   PUT /api/budgets/:id/archive
 * @desc    Archiver/désarchiver budget
 * @access  Private
 * @rateLimit 20/15min
 */
router.put('/:id/archive',
  writeRateLimit,
  idValidation,
  [
    body('archive')
      .optional()
      .isBoolean()
      .withMessage('archive doit être un booléen')
  ],
  BudgetController.toggleArchive
);

// ===================================================================
// ROUTES ANALYTICS
// ===================================================================

/**
 * @route   GET /api/budgets/analytics/progress
 * @desc    Analytics de progression des budgets
 * @access  Private
 * @rateLimit 30/5min
 */
router.get('/analytics/progress',
  analyticsRateLimit,
  [
    query('period')
      .optional()
      .isIn(['current', 'last_month', 'last_quarter', 'custom'])
      .withMessage('Période analytics invalide'),
      
    query('category')
      .optional()
      .isIn([
        'alimentation', 'transport', 'logement', 'sante', 'education',
        'loisirs', 'factures', 'carburant', 'vetements', 'commerce',
        'epargne', 'investment', 'sol', 'other'
      ])
      .withMessage('Catégorie invalide')
  ],
  BudgetController.getBudgetProgress
);

/**
 * @route   GET /api/budgets/analytics/trends
 * @desc    Analytics par période et tendances
 * @access  Private
 * @rateLimit 30/5min
 */
router.get('/analytics/trends',
  analyticsRateLimit,
  [
    query('months')
      .optional()
      .isInt({ min: 1, max: 24 })
      .withMessage('Le nombre de mois doit être entre 1 et 24')
  ],
  BudgetController.getBudgetTrends
);

/**
 * @route   GET /api/budgets/alerts
 * @desc    Budgets nécessitant attention
 * @access  Private
 * @rateLimit 30/5min
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
 * @rateLimit 100/15min
 */
router.get('/templates',
  normalRateLimit,
  BudgetController.getTemplates
);

/**
 * @route   GET /api/budgets/stats
 * @desc    Statistiques utilisateur globales
 * @access  Private
 * @rateLimit 30/5min
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
 * @rateLimit 50/10min
 */
router.get('/admin/stats',
  adminRateLimit,
  authMiddleware.requireRole('admin'),
  BudgetController.getAdminStats
);

// ===================================================================
// ROUTE INFO/DOCUMENTATION
// ===================================================================

/**
 * @route   GET /api/budgets
 * @desc    Documentation endpoints budgets
 * @access  Private
 * @rateLimit 100/15min
 */
router.get('/',
  normalRateLimit,
  (req, res) => {
    res.json({
      success: true,
      message: 'API Budgets FinApp Haiti 🇭🇹',
      version: '1.0.0',
      endpoints: {
        crud: {
          'POST /': 'Créer nouveau budget',
          'POST /from-template': 'Créer depuis template',
          'GET /list': 'Lister budgets utilisateur',
          'GET /:id': 'Détails budget',
          'PUT /:id': 'Modifier budget',
          'DELETE /:id': 'Supprimer budget'
        },
        actions: {
          'PUT /:id/adjust-category': 'Ajuster budget catégorie',
          'POST /:id/snapshot': 'Créer snapshot mensuel',
          'PUT /:id/archive': 'Archiver/désarchiver'
        },
        analytics: {
          'GET /analytics/progress': 'Progression budgets',
          'GET /analytics/trends': 'Tendances temporelles',
          'GET /alerts': 'Alertes et notifications'
        },
        utils: {
          'GET /templates': 'Templates disponibles',
          'GET /stats': 'Statistiques utilisateur'
        },
        admin: {
          'GET /admin/stats': 'Statistiques globales (admin)'
        }
      },
      rate_limits: {
        normal: '100 req/15min',
        write: '20 req/15min',
        analytics: '30 req/5min',
        admin: '50 req/10min'
      },
      supported_categories: [
        'alimentation', 'transport', 'logement', 'sante', 'education',
        'loisirs', 'factures', 'carburant', 'vetements', 'commerce',
        'epargne', 'investment', 'sol', 'other'
      ],
      supported_periods: ['weekly', 'monthly', 'quarterly', 'yearly'],
      supported_currencies: ['HTG', 'USD']
    });
  }
);

// ===================================================================
// EXPORT DU ROUTER
// ===================================================================
module.exports = router;