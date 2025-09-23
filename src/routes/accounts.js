// src/routes/accounts.js - Routes comptes bancaires FinApp Haiti
const express = require('express');
const rateLimit = require('express-rate-limit');

// Import controllers et middleware
const accountController = require('../controllers/accountController');
const { 
  authenticate,
  requireRole,
  requireVerified,
  standardAuth,
  strictAuth,
  adminAuth,
  generalAuthLimiter,
  strictAuthLimiter,
  adminLimiter
} = require('../middleware/auth');

const router = express.Router();

/**
 * Routes comptes bancaires FinApp Haiti
 * 
 * Structure :
 * - Routes compte (auth requis) : CRUD, gestion solde, archivage
 * - Routes admin (admin uniquement) : statistiques globales
 * 
 * Sécurité :
 * - Authentification obligatoire pour toutes les routes
 * - Rate limiting adapté par type d'opération
 * - Ownership automatique (req.user.userId)
 * - Validation express-validator dans controllers
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
// DOCUMENTATION API ACCOUNTS
// ===================================================================

/**
 * @route   GET /api/accounts
 * @desc    Documentation et informations sur l'API Accounts
 * @access  Public
 */
router.get('/', (req, res) => {
  res.json({
    message: 'API Accounts FinApp Haiti 🏦',
    description: 'Gestion des comptes bancaires haïtiens',
    version: '1.0.0',
    endpoints: {
      // CRUD Principal
      'POST /': 'Créer un nouveau compte',
      'GET /list': 'Lister mes comptes',
      'GET /:accountId': 'Détails d\'un compte',
      'PUT /:accountId': 'Modifier un compte',
      
      // Actions spéciales
      'PUT /:accountId/set-default': 'Définir compte par défaut',
      'PUT /:accountId/archive': 'Archiver un compte',
      'PUT /:accountId/unarchive': 'Désarchiver un compte',
      'PUT /:accountId/adjust-balance': 'Ajuster le solde',
      
      // Admin
      'GET /admin/stats': 'Statistiques comptes (admin)'
    },
    rateLimits: {
      accountOperations: '30 requêtes / 15 minutes',
      accountCreation: '5 créations / heure',
      balanceAdjustment: '10 ajustements / heure'
    },
    supportedBanks: [
      'BUH', 'BNC', 'SOGEBANK', 'CAPITAL', 'UNIBANK', 'SOGEBEL', 'FONKOZE'
    ],
    supportedCurrencies: ['HTG', 'USD'],
    authentication: 'Bearer token requis'
  });
});

// ===================================================================
// ROUTES CRUD COMPTES
// ===================================================================

/**
 * @route   POST /api/accounts
 * @desc    Créer un nouveau compte bancaire
 * @access  Private (authentification requise)
 * @middleware authenticate + accountCreationLimiter + accountOperationsLimiter
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Body: {
 *   name: string (requis),
 *   type: string (requis) - checking|savings|credit|investment|moncash,
 *   bankName: string (requis) - Code banque Haiti,
 *   currency: string (requis) - HTG|USD,
 *   accountNumber?: string,
 *   initialBalance?: number,
 *   minimumBalance?: number,
 *   creditLimit?: number,
 *   description?: string,
 *   tags?: string[],
 *   isDefault?: boolean
 * }
 * 
 * Response: {
 *   success: true,
 *   message: "Compte créé avec succès",
 *   data: {
 *     account: AccountObject
 *   }
 * }
 */
router.post('/',
  authenticate,
  accountCreationLimiter,
  accountOperationsLimiter,
  accountController.createAccount
);

/**
 * @route   GET /api/accounts/list
 * @desc    Lister tous les comptes de l'utilisateur
 * @access  Private (authentification requise)
 * @middleware authenticate + accountOperationsLimiter
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Query Parameters: {
 *   includeArchived?: boolean,
 *   currency?: string,
 *   type?: string
 * }
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     accounts: [AccountObject],
 *     totals: [TotalByCurrency],
 *     summary: {
 *       totalAccounts: number,
 *       activeAccounts: number,
 *       currencies: string[]
 *     }
 *   }
 * }
 */
router.get('/list',
  authenticate,
  accountOperationsLimiter,
  accountController.getUserAccounts
);

/**
 * @route   GET /api/accounts/:accountId
 * @desc    Obtenir détails d'un compte spécifique
 * @access  Private (authentification requise + ownership)
 * @middleware authenticate + accountOperationsLimiter
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Query Parameters: {
 *   includeHistory?: boolean
 * }
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     account: AccountObject (with stats and history if requested)
 *   }
 * }
 */
router.get('/:accountId',
  authenticate,
  accountOperationsLimiter,
  accountController.getAccountById
);

/**
 * @route   PUT /api/accounts/:accountId
 * @desc    Mettre à jour un compte
 * @access  Private (authentification requise + ownership)
 * @middleware authenticate + accountOperationsLimiter
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Body: {
 *   name?: string,
 *   description?: string,
 *   minimumBalance?: number,
 *   creditLimit?: number,
 *   isActive?: boolean,
 *   includeInTotal?: boolean,
 *   tags?: string[],
 *   allowNegativeBalance?: boolean
 * }
 * 
 * Response: {
 *   success: true,
 *   message: "Compte mis à jour avec succès",
 *   data: {
 *     account: AccountObject
 *   }
 * }
 */
router.put('/:accountId',
  authenticate,
  accountOperationsLimiter,
  accountController.updateAccount
);

// ===================================================================
// ROUTES ACTIONS SPÉCIALES
// ===================================================================

/**
 * @route   PUT /api/accounts/:accountId/set-default
 * @desc    Définir un compte comme compte par défaut
 * @access  Private (authentification requise + ownership)
 * @middleware authenticate + accountOperationsLimiter
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Response: {
 *   success: true,
 *   message: "Compte défini comme défaut avec succès",
 *   data: {
 *     account: AccountObject
 *   }
 * }
 */
router.put('/:accountId/set-default',
  authenticate,
  accountOperationsLimiter,
  accountController.setDefaultAccount
);

/**
 * @route   PUT /api/accounts/:accountId/archive
 * @desc    Archiver un compte (soft delete)
 * @access  Private (authentification requise + ownership)
 * @middleware authenticate + accountOperationsLimiter
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Body: {
 *   reason?: string - Raison de l'archivage
 * }
 * 
 * Response: {
 *   success: true,
 *   message: "Compte archivé avec succès",
 *   data: {
 *     account: AccountObject
 *   }
 * }
 */
router.put('/:accountId/archive',
  authenticate,
  accountOperationsLimiter,
  accountController.archiveAccount
);

/**
 * @route   PUT /api/accounts/:accountId/unarchive
 * @desc    Désarchiver un compte
 * @access  Private (authentification requise + ownership)
 * @middleware authenticate + accountOperationsLimiter
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Response: {
 *   success: true,
 *   message: "Compte désarchivé avec succès",
 *   data: {
 *     account: AccountObject
 *   }
 * }
 */
router.put('/:accountId/unarchive',
  authenticate,
  accountOperationsLimiter,
  accountController.unarchiveAccount
);

/**
 * @route   PUT /api/accounts/:accountId/adjust-balance
 * @desc    Ajuster manuellement le solde d'un compte
 * @access  Private (authentification requise + ownership)
 * @middleware authenticate + balanceAdjustmentLimiter + accountOperationsLimiter
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Body: {
 *   amount: number (requis) - Montant d'ajustement (+ ou -),
 *   description: string (requis) - Raison de l'ajustement
 * }
 * 
 * Response: {
 *   success: true,
 *   message: "Solde ajusté avec succès",
 *   data: {
 *     account: AccountObject,
 *     adjustment: {
 *       amount: number,
 *       previousBalance: number,
 *       newBalance: number,
 *       description: string
 *     }
 *   }
 * }
 */
router.put('/:accountId/adjust-balance',
  authenticate,
  balanceAdjustmentLimiter,
  accountOperationsLimiter,
  accountController.adjustBalance
);

// ===================================================================
// ROUTES UTILITAIRES
// ===================================================================

/**
 * @route   GET /api/accounts/validate/bank/:bankCode
 * @desc    Valider un code banque haïtienne
 * @access  Private (authentification requise)
 * @middleware authenticate + generalAuthLimiter
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     isValid: boolean,
 *     bank?: BankObject
 *   }
 * }
 */
router.get('/validate/bank/:bankCode',
  authenticate,
  generalAuthLimiter,
  async (req, res) => {
    try {
      const { bankCode } = req.params;
      const { HAITI_BANKS } = require('../utils/constants');
      
      const bank = HAITI_BANKS.find(b => b.code === bankCode.toUpperCase());
      
      res.status(200).json({
        success: true,
        data: {
          isValid: !!bank,
          bank: bank || null
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erreur validation banque',
        error: 'bank_validation_error'
      });
    }
  }
);

/**
 * @route   GET /api/accounts/supported/banks
 * @desc    Lister toutes les banques supportées en Haïti
 * @access  Private (authentification requise)
 * @middleware authenticate + generalAuthLimiter
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     banks: [BankObject],
 *     totalBanks: number
 *   }
 * }
 */
router.get('/supported/banks',
  authenticate,
  generalAuthLimiter,
  async (req, res) => {
    try {
      const { HAITI_BANKS } = require('../utils/constants');
      
      res.status(200).json({
        success: true,
        data: {
          banks: HAITI_BANKS,
          totalBanks: HAITI_BANKS.length
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erreur récupération banques',
        error: 'banks_fetch_error'
      });
    }
  }
);

/**
 * @route   GET /api/accounts/supported/currencies
 * @desc    Lister toutes les devises supportées
 * @access  Private (authentification requise)
 * @middleware authenticate + generalAuthLimiter
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     currencies: [CurrencyObject],
 *     totalCurrencies: number
 *   }
 * }
 */
router.get('/supported/currencies',
  authenticate,
  generalAuthLimiter,
  async (req, res) => {
    try {
      const { CURRENCIES } = require('../utils/constants');
      
      res.status(200).json({
        success: true,
        data: {
          currencies: Object.values(CURRENCIES),
          totalCurrencies: Object.keys(CURRENCIES).length
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erreur récupération devises',
        error: 'currencies_fetch_error'
      });
    }
  }
);

// ===================================================================
// ROUTES ADMINISTRATIVES (ADMIN SEULEMENT)
// ===================================================================

/**
 * @route   GET /api/accounts/admin/stats
 * @desc    Statistiques globales des comptes (admin seulement)
 * @access  Private (admin uniquement)
 * @middleware authenticate + requireRole('admin') + adminLimiter
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     overview: {
 *       totalAccounts: number,
 *       totalBalance: [BalanceByCurrency],
 *       criticalAccounts: number,
 *       recentAccounts: number
 *     },
 *     bankStats: [BankStatObject]
 *   }
 * }
 */
router.get('/admin/stats',
  authenticate,
  requireRole('admin'),
  adminLimiter,
  accountController.getAccountsStats
);

/**
 * @route   GET /api/accounts/admin/critical-balances
 * @desc    Lister comptes avec soldes critiques (admin seulement)
 * @access  Private (admin uniquement)
 * @middleware authenticate + requireRole('admin') + adminLimiter
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Query Parameters: {
 *   limit?: number,
 *   page?: number
 * }
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     criticalAccounts: [AccountObject],
 *     totalCritical: number,
 *     affectedUsers: number
 *   }
 * }
 */
router.get('/admin/critical-balances',
  authenticate,
  requireRole('admin'),
  adminLimiter,
  async (req, res) => {
    try {
      const { limit = 50, page = 1 } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      // Trouver comptes avec solde critique
      const criticalAccounts = await require('../models/Account').aggregate([
        {
          $match: {
            isActive: true,
            $expr: { $lt: ['$currentBalance', '$minimumBalance'] }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'user',
            foreignField: '_id',
            as: 'userInfo'
          }
        },
        {
          $project: {
            name: 1,
            bankName: 1,
            currentBalance: 1,
            minimumBalance: 1,
            currency: 1,
            deficit: { $subtract: ['$minimumBalance', '$currentBalance'] },
            'userInfo.firstName': 1,
            'userInfo.lastName': 1,
            'userInfo.email': 1,
            'userInfo.region': 1
          }
        },
        { $sort: { deficit: -1 } },
        { $skip: skip },
        { $limit: parseInt(limit) }
      ]);
      
      // Compter total et utilisateurs affectés
      const [totalStats] = await require('../models/Account').aggregate([
        {
          $match: {
            isActive: true,
            $expr: { $lt: ['$currentBalance', '$minimumBalance'] }
          }
        },
        {
          $group: {
            _id: null,
            totalCritical: { $sum: 1 },
            affectedUsers: { $addToSet: '$user' }
          }
        },
        {
          $project: {
            totalCritical: 1,
            affectedUsers: { $size: '$affectedUsers' }
          }
        }
      ]);
      
      res.status(200).json({
        success: true,
        data: {
          criticalAccounts,
          totalCritical: totalStats?.totalCritical || 0,
          affectedUsers: totalStats?.affectedUsers || 0,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: totalStats?.totalCritical || 0
          }
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Erreur admin critical balances:', error.message);
      
      res.status(500).json({
        success: false,
        message: 'Erreur récupération comptes critiques',
        error: 'admin_critical_balances_error'
      });
    }
  }
);

// ===================================================================
// MIDDLEWARE D'ERREUR SPÉCIALISÉ
// ===================================================================

/**
 * Middleware de gestion d'erreurs spécifique aux comptes
 */
router.use((err, req, res, next) => {
  console.error('❌ Erreur Route Accounts:', err.message);
  
  // Erreurs MongoDB spécifiques
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'ID de compte invalide',
      error: 'invalid_account_id',
      timestamp: new Date().toISOString()
    });
  }
  
  // Erreurs de validation
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Erreur de validation',
      error: 'account_validation_error',
      details: err.message,
      timestamp: new Date().toISOString()
    });
  }
  
  // Erreur générique
  res.status(500).json({
    success: false,
    message: 'Erreur interne des comptes',
    error: 'accounts_internal_error',
    timestamp: new Date().toISOString()
  });
});

// ===================================================================
// EXPORT ROUTER
// ===================================================================
module.exports = router;