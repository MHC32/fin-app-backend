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
 *   type: string (requis) - 'checking', 'savings', etc.,
 *   bankName: string (requis) - Code banque haïtienne,
 *   currency: string (requis) - 'HTG' ou 'USD',
 *   accountNumber?: string,
 *   initialBalance?: number,
 *   description?: string,
 *   tags?: string[]
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
 * @route   GET /api/accounts
 * @desc    Lister tous les comptes de l'utilisateur
 * @access  Private (authentification requise)
 * @middleware authenticate + generalAuthLimiter
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Query Parameters: {
 *   includeInactive?: boolean - Inclure comptes inactifs,
 *   includeArchived?: boolean - Inclure comptes archivés,
 *   type?: string - Filtrer par type,
 *   currency?: string - Filtrer par devise,
 *   bankName?: string - Filtrer par banque
 * }
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     accounts: AccountObject[],
 *     totals: { HTG: number, USD: number },
 *     totalAccounts: number,
 *     activeAccounts: number
 *   }
 * }
 */
router.get('/',
  authenticate,
  generalAuthLimiter,
  accountController.getAccounts
);

/**
 * @route   GET /api/accounts/:accountId
 * @desc    Récupérer un compte spécifique
 * @access  Private (authentification requise + ownership)
 * @middleware authenticate + generalAuthLimiter
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     account: AccountObject
 *   }
 * }
 */
router.get('/:accountId',
  authenticate,
  generalAuthLimiter,
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
 *   tags?: string[]
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

/**
 * @route   DELETE /api/accounts/:accountId
 * @desc    Supprimer/désactiver un compte
 * @access  Private (authentification requise + ownership)
 * @middleware authenticate + accountOperationsLimiter
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Query Parameters: {
 *   permanent?: boolean - Suppression définitive (si aucune transaction)
 * }
 * 
 * Response: {
 *   success: true,
 *   message: "Compte supprimé/désactivé avec succès",
 *   data?: {
 *     account: AccountObject (si désactivation)
 *   }
 * }
 */
router.delete('/:accountId',
  authenticate,
  accountOperationsLimiter,
  accountController.deleteAccount
);

// ===================================================================
// ROUTES GESTION SOLDE
// ===================================================================

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
// ROUTES GESTION COMPTES
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
 * @desc    Archiver un compte
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
      
      // ✅ CORRECTION: Object.values().find() au lieu de HAITI_BANKS.find()
      const bank = Object.values(HAITI_BANKS).find(b => b.code === bankCode.toUpperCase());
      
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
          // ✅ CORRECTION: Object.values() pour retourner un tableau et Object.keys().length pour le count
          banks: Object.values(HAITI_BANKS),
          totalBanks: Object.keys(HAITI_BANKS).length
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

/**
 * @route   GET /api/accounts/supported/types
 * @desc    Lister tous les types de comptes supportés
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
 *     accountTypes: [AccountTypeObject],
 *     totalTypes: number
 *   }
 * }
 */
router.get('/supported/types',
  authenticate,
  generalAuthLimiter,
  async (req, res) => {
    try {
      const { ACCOUNT_TYPES } = require('../utils/constants');
      
      res.status(200).json({
        success: true,
        data: {
          accountTypes: Object.values(ACCOUNT_TYPES),
          totalTypes: Object.keys(ACCOUNT_TYPES).length
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erreur récupération types de comptes',
        error: 'account_types_fetch_error'
      });
    }
  }
);

// ===================================================================
// ROUTES ADMIN (Statistiques globales)
// ===================================================================

/**
 * @route   GET /api/accounts/admin/stats
 * @desc    Statistiques globales des comptes (admin uniquement)
 * @access  Private (admin uniquement)
 * @middleware authenticate + requireRole('admin') + adminLimiter
 * 
 * Headers: {
 *   Authorization: "Bearer <adminAccessToken>"
 * }
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     totalAccounts: number,
 *     activeAccounts: number,
 *     accountsByType: Object,
 *     accountsByCurrency: Object,
 *     accountsByBank: Object,
 *     totalBalanceHTG: number,
 *     totalBalanceUSD: number
 *   }
 * }
 */
router.get('/admin/stats',
  authenticate,
  requireRole('admin'),
  adminLimiter,
  async (req, res) => {
    try {
      const Account = require('../models/Account');
      
      // Statistiques de base
      const totalAccounts = await Account.countDocuments({});
      const activeAccounts = await Account.countDocuments({ isActive: true });
      
      // Statistiques par type
      const accountsByType = await Account.aggregate([
        { $group: { _id: '$type', count: { $sum: 1 } } },
        { $project: { type: '$_id', count: 1, _id: 0 } }
      ]);
      
      // Statistiques par devise
      const accountsByCurrency = await Account.aggregate([
        { $group: { _id: '$currency', count: { $sum: 1 } } },
        { $project: { currency: '$_id', count: 1, _id: 0 } }
      ]);
      
      // Statistiques par banque
      const accountsByBank = await Account.aggregate([
        { $group: { _id: '$bankName', count: { $sum: 1 } } },
        { $project: { bankName: '$_id', count: 1, _id: 0 } }
      ]);
      
      // Totaux des soldes
      const balanceTotals = await Account.aggregate([
        { $match: { isActive: true, includeInTotal: true } },
        { 
          $group: { 
            _id: '$currency',
            totalBalance: { $sum: '$currentBalance' },
            averageBalance: { $avg: '$currentBalance' },
            count: { $sum: 1 }
          } 
        }
      ]);
      
      const formatBalanceTotals = (totals) => {
        const result = {};
        totals.forEach(item => {
          result[item._id] = {
            total: item.totalBalance,
            average: item.averageBalance,
            accounts: item.count
          };
        });
        return result;
      };
      
      res.status(200).json({
        success: true,
        data: {
          totalAccounts,
          activeAccounts,
          inactiveAccounts: totalAccounts - activeAccounts,
          accountsByType,
          accountsByCurrency,
          accountsByBank,
          balanceTotals: formatBalanceTotals(balanceTotals)
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Erreur admin stats:', error);
      
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des statistiques',
        error: 'admin_stats_error',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * @route   GET /api/accounts/admin/users/:userId/accounts
 * @desc    Lister les comptes d'un utilisateur spécifique (admin uniquement)
 * @access  Private (admin uniquement)
 * @middleware authenticate + requireRole('admin') + adminLimiter
 * 
 * Headers: {
 *   Authorization: "Bearer <adminAccessToken>"
 * }
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     accounts: AccountObject[],
 *     totalAccounts: number,
 *     user: UserObject
 *   }
 * }
 */
router.get('/admin/users/:userId/accounts',
  authenticate,
  requireRole('admin'),
  adminLimiter,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const Account = require('../models/Account');
      const User = require('../models/User');
      
      // Vérifier que l'utilisateur existe
      const user = await User.findById(userId).select('-password -refreshTokens');
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé',
          error: 'user_not_found',
          timestamp: new Date().toISOString()
        });
      }
      
      // Récupérer tous les comptes de l'utilisateur
      const accounts = await Account.find({ user: userId })
        .sort({ isDefault: -1, createdAt: -1 });
      
      const accountsData = accounts.map(account => 
        accountController.sanitizeAccountData(account)
      );
      
      res.status(200).json({
        success: true,
        data: {
          accounts: accountsData,
          totalAccounts: accountsData.length,
          user: {
            _id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            region: user.region,
            isActive: user.isActive
          }
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Erreur admin user accounts:', error);
      
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des comptes utilisateur',
        error: 'admin_user_accounts_error',
        timestamp: new Date().toISOString()
      });
    }
  }
);

// ===================================================================
// EXPORT ROUTER
// ===================================================================

module.exports = router;