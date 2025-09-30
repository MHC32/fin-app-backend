// src/routes/transactions.js - Routes transactions FinApp Haiti
const express = require('express');
const rateLimit = require('express-rate-limit');

// Import controllers et middleware
const transactionController = require('../controllers/transactionController');
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
 * Routes transactions FinApp Haiti
 * 
 * Structure :
 * - Routes CRUD (auth requis) : création, liste, modification, suppression
 * - Routes analytics (auth requis) : statistiques, recherche
 * - Routes actions spéciales : duplication, confirmation, reçus, localisation
 * - Routes admin (admin uniquement) : statistiques globales
 * 
 * Sécurité :
 * - Authentification obligatoire pour toutes les routes
 * - Rate limiting adapté par type d'opération
 * - Validation Joi centralisée (validation.js) ✅
 * - Ownership automatique (req.user.userId)
 */

// ===================================================================
// RATE LIMITING SPÉCIALISÉ POUR TRANSACTIONS
// ===================================================================

/**
 * Rate limiter pour opérations transaction normales
 */
const transactionOperationsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 opérations par utilisateur par fenêtre
  message: {
    success: false,
    message: 'Trop d\'opérations sur les transactions. Réessayez dans 15 minutes.',
    error: 'transaction_operations_rate_limit_exceeded',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.userId || req.ip
});

/**
 * Rate limiter pour création de transactions (plus restrictif)
 */
const transactionCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 50, // 50 créations par utilisateur par heure
  message: {
    success: false,
    message: 'Trop de créations de transactions. Réessayez dans 1 heure.',
    error: 'transaction_creation_rate_limit_exceeded',
    retryAfter: '1 hour'
  },
  keyGenerator: (req) => req.user?.userId || req.ip
});

/**
 * Rate limiter pour analytics (modéré)
 */
const analyticsLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 200, // 200 requêtes analytics par utilisateur par heure
  message: {
    success: false,
    message: 'Trop de requêtes analytics. Réessayez dans 1 heure.',
    error: 'analytics_rate_limit_exceeded',
    retryAfter: '1 hour'
  },
  keyGenerator: (req) => req.user?.userId || req.ip
});

/**
 * Rate limiter pour recherche (léger)
 */
const searchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60, // 60 recherches par utilisateur par fenêtre
  message: {
    success: false,
    message: 'Trop de recherches. Réessayez dans 15 minutes.',
    error: 'search_rate_limit_exceeded',
    retryAfter: '15 minutes'
  },
  keyGenerator: (req) => req.user?.userId || req.ip
});

// ===================================================================
// ROUTES CRUD TRANSACTIONS
// ===================================================================

/**
 * @route   POST /api/transactions
 * @desc    Créer une nouvelle transaction
 * @access  Private
 */
router.post('/',
  authenticate,
  transactionCreationLimiter,
  transactionOperationsLimiter,
  validate('transaction', 'create'), // ✅ Validation centralisée
  transactionController.createTransaction
);

/**
 * @route   GET /api/transactions/list
 * @desc    Lister toutes les transactions de l'utilisateur
 * @access  Private
 */
router.get('/list',
  authenticate,
  transactionOperationsLimiter,
  validate('transaction', 'filter', 'query'), // ✅ Validation centralisée
  transactionController.getUserTransactions
);

/**
 * @route   GET /api/transactions/:transactionId
 * @desc    Obtenir détails d'une transaction spécifique
 * @access  Private
 */
router.get('/:transactionId',
  authenticate,
  transactionOperationsLimiter,
  validateObjectId('transactionId'), // ✅ Validation ID
  transactionController.getTransactionById
);

/**
 * @route   PUT /api/transactions/:transactionId
 * @desc    Mettre à jour une transaction
 * @access  Private
 */
router.put('/:transactionId',
  authenticate,
  transactionOperationsLimiter,
  validateObjectId('transactionId'), // ✅ Validation ID
  validate('transaction', 'update'), // ✅ Validation centralisée
  transactionController.updateTransaction
);

/**
 * @route   DELETE /api/transactions/:transactionId
 * @desc    Supprimer une transaction
 * @access  Private
 */
router.delete('/:transactionId',
  authenticate,
  transactionOperationsLimiter,
  validateObjectId('transactionId'), // ✅ Validation ID
  transactionController.deleteTransaction
);

// ===================================================================
// ROUTES ANALYTICS & STATISTICS
// ===================================================================

/**
 * @route   GET /api/transactions/analytics/categories
 * @desc    Analytics des transactions par catégorie
 * @access  Private
 */
router.get('/analytics/categories',
  authenticate,
  analyticsLimiter,
  validate('transaction', 'analytics', 'query'), // ✅ Validation centralisée
  transactionController.getCategoryAnalytics
);

/**
 * @route   GET /api/transactions/analytics/monthly
 * @desc    Statistiques mensuelles des transactions
 * @access  Private
 */
router.get('/analytics/monthly',
  authenticate,
  analyticsLimiter,
  validate('transaction', 'monthlyStats', 'query'), // ✅ Validation centralisée
  transactionController.getMonthlyStats
);

/**
 * @route   GET /api/transactions/search
 * @desc    Recherche avancée dans les transactions
 * @access  Private
 */
router.get('/search',
  authenticate,
  searchLimiter,
  validate('transaction', 'search', 'query'), // ✅ Validation centralisée
  transactionController.searchTransactions
);

// ===================================================================
// ROUTES ACTIONS SPÉCIALES
// ===================================================================

/**
 * @route   POST /api/transactions/:transactionId/duplicate
 * @desc    Dupliquer une transaction existante
 * @access  Private
 */
router.post('/:transactionId/duplicate',
  authenticate,
  transactionOperationsLimiter,
  validateObjectId('transactionId'), // ✅ Validation ID
  validate('transaction', 'duplicate'), // ✅ Validation centralisée
  transactionController.duplicateTransaction
);

/**
 * @route   PUT /api/transactions/:transactionId/confirm
 * @desc    Confirmer une transaction en attente
 * @access  Private
 */
router.put('/:transactionId/confirm',
  authenticate,
  transactionOperationsLimiter,
  validateObjectId('transactionId'), // ✅ Validation ID
  transactionController.confirmTransaction
);

/**
 * @route   POST /api/transactions/:transactionId/receipt
 * @desc    Ajouter un reçu à une transaction
 * @access  Private
 */
router.post('/:transactionId/receipt',
  authenticate,
  transactionOperationsLimiter,
  validateObjectId('transactionId'), // ✅ Validation ID
  validate('transaction', 'addReceipt'), // ✅ Validation centralisée
  transactionController.addReceipt
);

/**
 * @route   PUT /api/transactions/:transactionId/location
 * @desc    Ajouter/modifier la localisation d'une transaction
 * @access  Private
 */
router.put('/:transactionId/location',
  authenticate,
  transactionOperationsLimiter,
  validateObjectId('transactionId'), // ✅ Validation ID
  validate('transaction', 'addLocation'), // ✅ Validation centralisée
  transactionController.addLocation
);

// ===================================================================
// ROUTES UTILITAIRES
// ===================================================================

/**
 * @route   GET /api/transactions/suggestions
 * @desc    Obtenir suggestions de transactions basées sur l'historique
 * @access  Private
 */
router.get('/suggestions',
  authenticate,
  transactionOperationsLimiter,
  validate('transaction', 'suggestions', 'query'), // ✅ Validation centralisée
  transactionController.getTransactionSuggestions
);

// ===================================================================
// ROUTES ADMIN
// ===================================================================

/**
 * @route   GET /api/transactions/admin/stats
 * @desc    Statistiques globales des transactions (admin)
 * @access  Private (admin uniquement)
 */
router.get('/admin/stats',
  authenticate,
  requireRole('admin'),
  adminLimiter,
  transactionController.getTransactionsStats
);

// ===================================================================
// ROUTE INFO & DOCUMENTATION
// ===================================================================

/**
 * @route   GET /api/transactions
 * @desc    Information sur les endpoints transactions disponibles
 * @access  Public
 */
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'API Transactions FinApp Haiti 💰',
    data: {
      service: 'transactions',
      version: '1.0.0',
      description: 'Gestion complète des transactions financières haïtiennes',
      endpoints: {
        crud: {
          create: 'POST /api/transactions',
          list: 'GET /api/transactions/list',
          getById: 'GET /api/transactions/:transactionId',
          update: 'PUT /api/transactions/:transactionId',
          delete: 'DELETE /api/transactions/:transactionId'
        },
        analytics: {
          categories: 'GET /api/transactions/analytics/categories',
          monthly: 'GET /api/transactions/analytics/monthly',
          search: 'GET /api/transactions/search'
        },
        actions: {
          duplicate: 'POST /api/transactions/:transactionId/duplicate',
          confirm: 'PUT /api/transactions/:transactionId/confirm',
          addReceipt: 'POST /api/transactions/:transactionId/receipt',
          addLocation: 'PUT /api/transactions/:transactionId/location'
        },
        utilities: {
          suggestions: 'GET /api/transactions/suggestions'
        },
        admin: {
          stats: 'GET /api/transactions/admin/stats'
        }
      },
      rateLimits: {
        operations: '100 / 15 minutes',
        creation: '50 / 1 hour',
        analytics: '200 / 1 hour',
        search: '60 / 15 minutes'
      },
      supportedTypes: ['income', 'expense', 'transfer'],
      supportedCategories: [
        'salary', 'business', 'investment', 'gift', 'other_income',
        'food', 'transport', 'housing', 'utilities', 'health', 'education',
        'entertainment', 'shopping', 'debt_payment', 'savings', 'other_expense'
      ],
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
});

// ===================================================================
// EXPORTS
// ===================================================================
module.exports = router;