// src/routes/accounts.js - Routes comptes bancaires FinApp Haiti
const express = require('express');
const rateLimit = require('express-rate-limit');

// Import controllers et middleware
const accountController = require('../controllers/accountController');
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
 * Routes comptes bancaires FinApp Haiti
 * 
 * Structure :
 * - Routes CRUD (auth requis) : création, liste, modification, suppression
 * - Routes gestion solde : ajustement, consultation
 * - Routes gestion : archivage, compte par défaut
 * - Routes utilitaires : validation banque, résumé
 * - Routes admin : comptes par utilisateur
 * 
 * Sécurité :
 * - Authentification obligatoire pour toutes les routes
 * - Rate limiting adapté par type d'opération
 * - Validation Joi centralisée (validation.js) ✅
 * - Ownership automatique (req.user.userId)
 */

// ===================================================================
// RATE LIMITING SPÉCIALISÉ POUR ACCOUNTS
// ===================================================================

/**
 * Rate limiter pour opérations compte normales
 */
const accountOperationsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 opérations par utilisateur par fenêtre
  message: {
    success: false,
    message: 'Trop d\'opérations sur les comptes. Réessayez dans 15 minutes.',
    error: 'account_operations_rate_limit_exceeded',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.userId || req.ip
});

/**
 * Rate limiter pour création de comptes (plus restrictif)
 */
const accountCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 5, // 5 créations par utilisateur par heure
  message: {
    success: false,
    message: 'Trop de créations de comptes. Réessayez dans 1 heure.',
    error: 'account_creation_rate_limit_exceeded',
    retryAfter: '1 hour'
  },
  keyGenerator: (req) => req.user?.userId || req.ip
});

/**
 * Rate limiter pour ajustements de solde (très restrictif)
 */
const balanceAdjustmentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 10, // 10 ajustements par utilisateur par heure
  message: {
    success: false,
    message: 'Trop d\'ajustements de solde. Réessayez dans 1 heure.',
    error: 'balance_adjustment_rate_limit_exceeded',
    retryAfter: '1 hour'
  },
  keyGenerator: (req) => req.user?.userId || req.ip
});

// ===================================================================
// ROUTES CRUD COMPTES
// ===================================================================

/**
 * @route   POST /api/accounts
 * @desc    Créer nouveau compte
 * @access  Private
 */
router.post('/',
  authenticate,
  accountCreationLimiter,
  validate('account', 'create'), // ✅ Validation centralisée
  accountController.createAccount
);

/**
 * @route   GET /api/accounts
 * @desc    Récupérer tous les comptes utilisateur
 * @access  Private
 */
router.get('/',
  authenticate,
  generalAuthLimiter,
  validate('account', 'filter', 'query'), // ✅ Validation centralisée
  accountController.getAccounts
);

/**
 * @route   GET /api/accounts/:accountId
 * @desc    Récupérer compte spécifique
 * @access  Private
 */
router.get('/:accountId',
  authenticate,
  generalAuthLimiter,
  validateObjectId('accountId'), // ✅ Validation ID
  accountController.getAccountById
);

/**
 * @route   PUT /api/accounts/:accountId
 * @desc    Mettre à jour compte
 * @access  Private
 */
router.put('/:accountId',
  authenticate,
  accountOperationsLimiter,
  validateObjectId('accountId'), // ✅ Validation ID
  validate('account', 'update'), // ✅ Validation centralisée
  accountController.updateAccount
);

/**
 * @route   DELETE /api/accounts/:accountId
 * @desc    Supprimer/désactiver compte
 * @access  Private
 */
router.delete('/:accountId',
  authenticate,
  accountOperationsLimiter,
  validateObjectId('accountId'), // ✅ Validation ID
  accountController.deleteAccount
);

// ===================================================================
// ROUTES GESTION SOLDE
// ===================================================================

/**
 * @route   PUT /api/accounts/:accountId/adjust-balance
 * @desc    Ajuster manuellement le solde d'un compte
 * @access  Private
 */
router.put('/:accountId/adjust-balance',
  authenticate,
  balanceAdjustmentLimiter,
  accountOperationsLimiter,
  validateObjectId('accountId'), // ✅ Validation ID
  validate('account', 'adjustBalance'), // ✅ Validation centralisée
  accountController.adjustBalance
);

/**
 * @route   POST /api/accounts/:accountId/transfer
 * @desc    Transférer entre comptes
 * @access  Private
 */
router.post('/:accountId/transfer',
  authenticate,
  accountOperationsLimiter,
  validateObjectId('accountId'), // ✅ Validation ID
  validate('account', 'transfer'), // ✅ Validation centralisée
  accountController.transferBetweenAccounts
);

// ===================================================================
// ROUTES GESTION COMPTES
// ===================================================================

/**
 * @route   PUT /api/accounts/:accountId/set-default
 * @desc    Définir un compte comme compte par défaut
 * @access  Private
 */
router.put('/:accountId/set-default',
  authenticate,
  accountOperationsLimiter,
  validateObjectId('accountId'), // ✅ Validation ID
  accountController.setDefaultAccount
);

/**
 * @route   PUT /api/accounts/:accountId/archive
 * @desc    Archiver un compte
 * @access  Private
 */
router.put('/:accountId/archive',
  authenticate,
  accountOperationsLimiter,
  validateObjectId('accountId'), // ✅ Validation ID
  validate('account', 'archive'), // ✅ Validation centralisée
  accountController.archiveAccount
);

/**
 * @route   PUT /api/accounts/:accountId/unarchive
 * @desc    Désarchiver un compte
 * @access  Private
 */
router.put('/:accountId/unarchive',
  authenticate,
  accountOperationsLimiter,
  validateObjectId('accountId'), // ✅ Validation ID
  accountController.unarchiveAccount
);

// ===================================================================
// ROUTES UTILITAIRES & RÉSUMÉ
// ===================================================================

/**
 * @route   GET /api/accounts/summary/all
 * @desc    Résumé de tous les comptes
 * @access  Private
 */
router.get('/summary/all',
  authenticate,
  generalAuthLimiter,
  accountController.getAccountsSummary
);

/**
 * @route   GET /api/accounts/validate/bank/:bankCode
 * @desc    Valider un code banque haïtienne
 * @access  Private
 */
router.get('/validate/bank/:bankCode',
  authenticate,
  generalAuthLimiter,
  accountController.validateBankCode
);

// ===================================================================
// ROUTES ADMIN
// ===================================================================

/**
 * @route   GET /api/accounts/admin/users/:userId/accounts
 * @desc    Comptes d'un utilisateur (admin)
 * @access  Private (admin uniquement)
 */
router.get('/admin/users/:userId/accounts',
  authenticate,
  requireRole('admin'),
  adminLimiter,
  validateObjectId('userId'), // ✅ Validation ID
  accountController.getUserAccountsAdmin
);

// ===================================================================
// ROUTE INFO & DOCUMENTATION
// ===================================================================

/**
 * @route   GET /api/accounts
 * @desc    Information sur les endpoints comptes disponibles
 * @access  Private
 */
router.get('/info',
  authenticate,
  generalAuthLimiter,
  (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Service comptes bancaires FinApp Haiti 🇭🇹',
      data: {
        service: 'accounts',
        version: '1.0.0',
        description: 'Gestion complète des comptes bancaires HTG/USD',
        endpoints: {
          crud: {
            create: 'POST /api/accounts',
            list: 'GET /api/accounts',
            getById: 'GET /api/accounts/:accountId',
            update: 'PUT /api/accounts/:accountId',
            delete: 'DELETE /api/accounts/:accountId'
          },
          balance: {
            adjust: 'PUT /api/accounts/:accountId/adjust-balance',
            transfer: 'POST /api/accounts/:accountId/transfer'
          },
          management: {
            setDefault: 'PUT /api/accounts/:accountId/set-default',
            archive: 'PUT /api/accounts/:accountId/archive',
            unarchive: 'PUT /api/accounts/:accountId/unarchive'
          },
          utilities: {
            summary: 'GET /api/accounts/summary/all',
            validateBank: 'GET /api/accounts/validate/bank/:bankCode'
          },
          admin: {
            userAccounts: 'GET /api/accounts/admin/users/:userId/accounts'
          }
        },
        rateLimits: {
          operations: '30 / 15 minutes',
          creation: '5 / 1 hour',
          balanceAdjustment: '10 / 1 hour'
        },
        security: {
          authentication: 'JWT required',
          ownership: 'Automatic user isolation',
          validation: 'Joi centralized validation', // ✅ Mise à jour
          rateLimit: 'Operation-based limiting'
        },
        supportedBanks: [
          'BRH', 'BUH', 'SOGEBANK', 'CAPITAL_BANK', 'UNIBANK',
          'BNC', 'SCOTIABANK', 'CITIBANK', 'BPH'
        ],
        currencies: ['HTG', 'USD']
      },
      timestamp: new Date().toISOString()
    });
  }
);

// ===================================================================
// EXPORTS
// ===================================================================
module.exports = router;