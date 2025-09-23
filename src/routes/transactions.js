// src/routes/transactions.js - Routes transactions FinApp Haiti
const express = require('express');
const rateLimit = require('express-rate-limit');

// Import controllers et middleware
const transactionController = require('../controllers/transactionController');
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
 * - Ownership automatique (req.user.userId)
 * - Validation express-validator dans controllers
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
// DOCUMENTATION API TRANSACTIONS
// ===================================================================

/**
 * @route   GET /api/transactions
 * @desc    Documentation et informations sur l'API Transactions
 * @access  Public
 */
router.get('/', (req, res) => {
  res.json({
    message: 'API Transactions FinApp Haiti 💰',
    description: 'Gestion complète des transactions financières haïtiennes',
    version: '1.0.0',
    endpoints: {
      // CRUD Principal
      'POST /': 'Créer une nouvelle transaction',
      'GET /list': 'Lister mes transactions',
      'GET /:transactionId': 'Détails d\'une transaction',
      'PUT /:transactionId': 'Modifier une transaction',
      'DELETE /:transactionId': 'Supprimer une transaction',
      
      // Analytics & Stats
      'GET /analytics/categories': 'Analytics par catégorie',
      'GET /analytics/monthly': 'Statistiques mensuelles',
      'GET /search': 'Recherche avancée',
      
      // Actions spéciales
      'POST /:transactionId/duplicate': 'Dupliquer transaction',
      'PUT /:transactionId/confirm': 'Confirmer transaction',
      'POST /:transactionId/receipt': 'Ajouter reçu',
      'PUT /:transactionId/location': 'Ajouter localisation',
      
      // Utilitaires
      'GET /suggestions': 'Suggestions basées sur historique',
      
      // Admin
      'GET /admin/stats': 'Statistiques globales (admin)'
    },
    rateLimits: {
      transactionOperations: '100 requêtes / 15 minutes',
      transactionCreation: '50 créations / heure',
      analytics: '200 requêtes / heure',
      search: '60 recherches / 15 minutes'
    },
    supportedTypes: ['income', 'expense', 'transfer'],
    supportedCategories: [
      'alimentation', 'transport', 'logement', 'sante', 'education',
      'loisirs', 'shopping', 'services', 'transfert', 'autre'
    ],
    authentication: 'Bearer token requis'
  });
});

// ===================================================================
// ROUTES CRUD TRANSACTIONS
// ===================================================================

/**
 * @route   POST /api/transactions
 * @desc    Créer une nouvelle transaction
 * @access  Private (authentification requise)
 * @middleware authenticate + transactionCreationLimiter + transactionOperationsLimiter
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Body: {
 *   amount: number (requis),
 *   type: string (requis) - income|expense|transfer,
 *   description: string (requis),
 *   category: string (requis),
 *   account: string (requis) - ID du compte,
 *   subcategory?: string,
 *   toAccount?: string - ID compte destinataire (requis pour transfer),
 *   date?: string - ISO date,
 *   tags?: string[],
 *   notes?: string,
 *   location?: {
 *     name?: string,
 *     address?: string,
 *     latitude?: number,
 *     longitude?: number
 *   },
 *   templateUsed?: string
 * }
 * 
 * Response: {
 *   success: true,
 *   message: "Transaction créée avec succès",
 *   data: {
 *     transaction: TransactionObject
 *   }
 * }
 */
router.post('/',
  authenticate,
  transactionCreationLimiter,
  transactionOperationsLimiter,
  transactionController.createTransaction
);

/**
 * @route   GET /api/transactions/list
 * @desc    Lister toutes les transactions de l'utilisateur
 * @access  Private (authentification requise)
 * @middleware authenticate + transactionOperationsLimiter
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Query Parameters: {
 *   page?: number,
 *   limit?: number,
 *   account?: string - ID du compte,
 *   category?: string,
 *   type?: string - income|expense|transfer,
 *   startDate?: string - ISO date,
 *   endDate?: string - ISO date,
 *   search?: string,
 *   sortBy?: string - date|amount|description,
 *   sortOrder?: string - asc|desc
 * }
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     transactions: [TransactionObject],
 *     pagination: PaginationObject,
 *     stats: {
 *       totalIncome: number,
 *       totalExpense: number,
 *       totalTransactions: number,
 *       avgTransactionAmount: number
 *     },
 *     filters: FilterObject
 *   }
 * }
 */
router.get('/list',
  authenticate,
  transactionOperationsLimiter,
  transactionController.getUserTransactions
);

/**
 * @route   GET /api/transactions/:transactionId
 * @desc    Obtenir détails d'une transaction spécifique
 * @access  Private (authentification requise + ownership)
 * @middleware authenticate + transactionOperationsLimiter
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     transaction: TransactionObject (with relatedTransactions)
 *   }
 * }
 */
router.get('/:transactionId',
  authenticate,
  transactionOperationsLimiter,
  transactionController.getTransactionById
);

/**
 * @route   PUT /api/transactions/:transactionId
 * @desc    Mettre à jour une transaction
 * @access  Private (authentification requise + ownership)
 * @middleware authenticate + transactionOperationsLimiter
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Body: {
 *   amount?: number,
 *   description?: string,
 *   category?: string,
 *   subcategory?: string,
 *   date?: string,
 *   tags?: string[],
 *   notes?: string
 * }
 * 
 * Response: {
 *   success: true,
 *   message: "Transaction mise à jour avec succès",
 *   data: {
 *     transaction: TransactionObject
 *   }
 * }
 */
router.put('/:transactionId',
  authenticate,
  transactionOperationsLimiter,
  transactionController.updateTransaction
);

/**
 * @route   DELETE /api/transactions/:transactionId
 * @desc    Supprimer une transaction
 * @access  Private (authentification requise + ownership)
 * @middleware authenticate + transactionOperationsLimiter
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Body: {
 *   reason?: string - Raison de la suppression,
 *   permanent?: boolean - Suppression définitive (admin seulement)
 * }
 * 
 * Response: {
 *   success: true,
 *   message: "Transaction supprimée avec succès",
 *   data: {
 *     deletedTransaction: TransactionObject
 *   }
 * }
 */
router.delete('/:transactionId',
  authenticate,
  transactionOperationsLimiter,
  transactionController.deleteTransaction
);

// ===================================================================
// ROUTES ANALYTICS & STATISTICS
// ===================================================================

/**
 * @route   GET /api/transactions/analytics/categories
 * @desc    Analytics des transactions par catégorie
 * @access  Private (authentification requise)
 * @middleware authenticate + analyticsLimiter
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Query Parameters: {
 *   startDate?: string - ISO date,
 *   endDate?: string - ISO date,
 *   type?: string - income|expense (défaut: expense),
 *   limit?: number - Nombre de catégories (défaut: 10)
 * }
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     analytics: [CategoryAnalyticsObject],
 *     summary: {
 *       totalAmount: number,
 *       totalCategories: number,
 *       period: { startDate, endDate },
 *       type: string
 *     }
 *   }
 * }
 */
router.get('/analytics/categories',
  authenticate,
  analyticsLimiter,
  transactionController.getCategoryAnalytics
);

/**
 * @route   GET /api/transactions/analytics/monthly
 * @desc    Statistiques mensuelles des transactions
 * @access  Private (authentification requise)
 * @middleware authenticate + analyticsLimiter
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Query Parameters: {
 *   year?: number - Année (défaut: année courante),
 *   months?: number - Nombre de mois à inclure (défaut: 12)
 * }
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     monthlyStats: [MonthlyStatsObject],
 *     summary: {
 *       totalMonths: number,
 *       avgMonthlyIncome: number,
 *       avgMonthlyExpense: number,
 *       totalNet: number
 *     }
 *   }
 * }
 */
router.get('/analytics/monthly',
  authenticate,
  analyticsLimiter,
  transactionController.getMonthlyStats
);

/**
 * @route   GET /api/transactions/search
 * @desc    Recherche avancée dans les transactions
 * @access  Private (authentification requise)
 * @middleware authenticate + searchLimiter
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Query Parameters: {
 *   q: string (requis) - Terme de recherche,
 *   limit?: number - Nombre de résultats (défaut: 20),
 *   includeDeleted?: boolean - Inclure transactions supprimées
 * }
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     searchTerm: string,
 *     totalResults: number,
 *     transactions: [TransactionObject],
 *     groupedByCategory: [GroupedResultsObject],
 *     searchStats: {
 *       categories: number,
 *       dateRange: { oldest, newest }
 *     }
 *   }
 * }
 */
router.get('/search',
  authenticate,
  searchLimiter,
  transactionController.searchTransactions
);

// ===================================================================
// ROUTES ACTIONS SPÉCIALES
// ===================================================================

/**
 * @route   POST /api/transactions/:transactionId/duplicate
 * @desc    Dupliquer une transaction existante
 * @access  Private (authentification requise + ownership)
 * @middleware authenticate + transactionOperationsLimiter
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Body: {
 *   adjustments?: {
 *     amount?: number,
 *     description?: string,
 *     category?: string
 *   },
 *   newDate?: string - ISO date,
 *   newDescription?: string
 * }
 * 
 * Response: {
 *   success: true,
 *   message: "Transaction dupliquée avec succès",
 *   data: {
 *     originalTransaction: TransactionObject,
 *     duplicatedTransaction: TransactionObject
 *   }
 * }
 */
router.post('/:transactionId/duplicate',
  authenticate,
  transactionOperationsLimiter,
  transactionController.duplicateTransaction
);

/**
 * @route   PUT /api/transactions/:transactionId/confirm
 * @desc    Confirmer une transaction en attente
 * @access  Private (authentification requise + ownership)
 * @middleware authenticate + transactionOperationsLimiter
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Response: {
 *   success: true,
 *   message: "Transaction confirmée avec succès",
 *   data: {
 *     transaction: TransactionObject
 *   }
 * }
 */
router.put('/:transactionId/confirm',
  authenticate,
  transactionOperationsLimiter,
  transactionController.confirmTransaction
);

/**
 * @route   POST /api/transactions/:transactionId/receipt
 * @desc    Ajouter un reçu à une transaction
 * @access  Private (authentification requise + ownership)
 * @middleware authenticate + transactionOperationsLimiter
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Body: {
 *   receiptUrl: string (requis) - URL du reçu uploadé,
 *   originalName?: string,
 *   size?: number,
 *   publicId?: string - ID Cloudinary
 * }
 * 
 * Response: {
 *   success: true,
 *   message: "Reçu ajouté avec succès",
 *   data: {
 *     transaction: TransactionObject
 *   }
 * }
 */
router.post('/:transactionId/receipt',
  authenticate,
  transactionOperationsLimiter,
  transactionController.addReceipt
);

/**
 * @route   PUT /api/transactions/:transactionId/location
 * @desc    Ajouter une localisation à une transaction
 * @access  Private (authentification requise + ownership)
 * @middleware authenticate + transactionOperationsLimiter
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Body: {
 *   latitude: number (requis),
 *   longitude: number (requis),
 *   name?: string,
 *   address?: string,
 *   accuracy?: number
 * }
 * 
 * Response: {
 *   success: true,
 *   message: "Localisation ajoutée avec succès",
 *   data: {
 *     transaction: TransactionObject
 *   }
 * }
 */
router.put('/:transactionId/location',
  authenticate,
  transactionOperationsLimiter,
  transactionController.addLocation
);

// ===================================================================
// ROUTES UTILITAIRES
// ===================================================================

/**
 * @route   GET /api/transactions/suggestions
 * @desc    Obtenir suggestions de transactions basées sur l'historique
 * @access  Private (authentification requise)
 * @middleware authenticate + transactionOperationsLimiter
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Query Parameters: {
 *   category?: string - Filtrer par catégorie,
 *   description?: string - Filtrer par description,
 *   limit?: number - Nombre de suggestions (défaut: 5)
 * }
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     personalSuggestions: [SuggestionObject],
 *     quickTemplates: [TemplateObject],
 *     totalSuggestions: number
 *   }
 * }
 */
router.get('/suggestions',
  authenticate,
  transactionOperationsLimiter,
  transactionController.getTransactionSuggestions
);

/**
 * @route   GET /api/transactions/templates
 * @desc    Lister templates de transactions rapides
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
 *     templates: [TemplateObject],
 *     categories: [CategoryObject]
 *   }
 * }
 */
router.get('/templates',
  authenticate,
  generalAuthLimiter,
  async (req, res) => {
    try {
      const { QUICK_TRANSACTION_TEMPLATES, TRANSACTION_CATEGORIES } = require('../utils/constants');
      
      const templates = Object.entries(QUICK_TRANSACTION_TEMPLATES).map(([key, template]) => ({
        id: key,
        ...template,
        categoryInfo: TRANSACTION_CATEGORIES[template.category] || {}
      }));

      const categories = Object.entries(TRANSACTION_CATEGORIES).map(([key, category]) => ({
        id: key,
        ...category
      }));

      res.status(200).json({
        success: true,
        data: {
          templates,
          categories,
          totalTemplates: templates.length,
          totalCategories: categories.length
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erreur récupération templates',
        error: 'templates_fetch_error'
      });
    }
  }
);

/**
 * @route   GET /api/transactions/validate/amount/:amount
 * @desc    Valider un montant de transaction
 * @access  Private (authentification requise)
 * @middleware authenticate + generalAuthLimiter
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Query Parameters: {
 *   accountId?: string - ID du compte pour vérifier limites,
 *   type?: string - Type de transaction
 * }
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     isValid: boolean,
 *     amount: number,
 *     issues?: string[],
 *     suggestions?: string[]
 *   }
 * }
 */
router.get('/validate/amount/:amount',
  authenticate,
  generalAuthLimiter,
  async (req, res) => {
    try {
      const { amount } = req.params;
      const { accountId, type = 'expense' } = req.query;
      const userId = req.user.userId;
      
      const numAmount = parseFloat(amount);
      const issues = [];
      const suggestions = [];

      // Validation de base
      if (isNaN(numAmount) || numAmount <= 0) {
        issues.push('Le montant doit être un nombre positif');
      }

      // Vérification limites si compte fourni
      if (accountId && !issues.length) {
        const Account = require('../models/Account');
        const account = await Account.findOne({
          _id: accountId,
          user: userId,
          isActive: true
        });

        if (account) {
          const transactionAmount = type === 'expense' ? -numAmount : numAmount;
          
          if (type === 'expense' && !account.canProcessTransaction(transactionAmount)) {
            issues.push('Solde insuffisant ou limites dépassées');
            suggestions.push(`Solde actuel: ${account.currentBalance} ${account.currency}`);
            
            if (account.creditLimit > 0) {
              suggestions.push(`Limite de crédit: ${account.creditLimit} ${account.currency}`);
            }
          }
        }
      }

      // Suggestions contextuelles
      if (numAmount > 10000) {
        suggestions.push('Montant élevé - vérifiez deux fois');
      }

      res.status(200).json({
        success: true,
        data: {
          isValid: issues.length === 0,
          amount: numAmount,
          issues: issues.length > 0 ? issues : undefined,
          suggestions: suggestions.length > 0 ? suggestions : undefined
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erreur validation montant',
        error: 'amount_validation_error'
      });
    }
  }
);

// ===================================================================
// ROUTES ADMINISTRATIVES (ADMIN SEULEMENT)
// ===================================================================

/**
 * @route   GET /api/transactions/admin/stats
 * @desc    Statistiques globales des transactions (admin seulement)
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
 *       totalTransactions: number,
 *       totalAmount: [AmountByTypeObject],
 *       recentTransactions: number,
 *       pendingTransactions: number
 *     },
 *     topCategories: [CategoryStatsObject]
 *   }
 * }
 */
router.get('/admin/stats',
  authenticate,
  requireRole('admin'),
  adminLimiter,
  transactionController.getTransactionsStats
);

/**
 * @route   GET /api/transactions/admin/pending
 * @desc    Lister transactions en attente de confirmation (admin seulement)
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
 *     pendingTransactions: [TransactionObject],
 *     totalPending: number,
 *     oldestPending: date
 *   }
 * }
 */
router.get('/admin/pending',
  authenticate,
  requireRole('admin'),
  adminLimiter,
  async (req, res) => {
    try {
      const { limit = 50, page = 1 } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      const Transaction = require('../models/Transaction');
      
      // Transactions en attente
      const [pendingTransactions, totalPending] = await Promise.all([
        Transaction.find({ isConfirmed: false })
          .populate('user', 'firstName lastName email')
          .populate('account', 'name bankName')
          .sort({ createdAt: 1 }) // Plus anciennes en premier
          .skip(skip)
          .limit(parseInt(limit)),
        Transaction.countDocuments({ isConfirmed: false })
      ]);
      
      // Plus ancienne transaction en attente
      const oldestPending = pendingTransactions.length > 0 ? 
        pendingTransactions[0].createdAt : null;
      
      res.status(200).json({
        success: true,
        data: {
          pendingTransactions: pendingTransactions.map(t => ({
            id: t._id,
            amount: t.amount,
            type: t.type,
            description: t.description,
            category: t.category,
            date: t.date,
            createdAt: t.createdAt,
            user: {
              id: t.user._id,
              name: `${t.user.firstName} ${t.user.lastName}`,
              email: t.user.email
            },
            account: {
              id: t.account._id,
              name: t.account.name,
              bank: t.account.bankName
            }
          })),
          totalPending,
          oldestPending,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: totalPending,
            pages: Math.ceil(totalPending / parseInt(limit))
          }
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Erreur admin pending transactions:', error.message);
      
      res.status(500).json({
        success: false,
        message: 'Erreur récupération transactions en attente',
        error: 'admin_pending_error'
      });
    }
  }
);

// ===================================================================
// MIDDLEWARE D'ERREUR SPÉCIALISÉ
// ===================================================================

/**
 * Middleware de gestion d'erreurs spécifique aux transactions
 */
router.use((err, req, res, next) => {
  console.error('❌ Erreur Route Transactions:', err.message);
  
  // Erreurs MongoDB spécifiques
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'ID de transaction invalide',
      error: 'invalid_transaction_id',
      timestamp: new Date().toISOString()
    });
  }
  
  // Erreurs de validation
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Erreur de validation',
      error: 'transaction_validation_error',
      details: err.message,
      timestamp: new Date().toISOString()
    });
  }
  
  // Erreurs de solde insuffisant
  if (err.message.includes('insufficient')) {
    return res.status(400).json({
      success: false,
      message: 'Solde insuffisant pour cette transaction',
      error: 'insufficient_funds',
      timestamp: new Date().toISOString()
    });
  }
  
  // Erreur générique
  res.status(500).json({
    success: false,
    message: 'Erreur interne des transactions',
    error: 'transactions_internal_error',
    timestamp: new Date().toISOString()
  });
});

// ===================================================================
// EXPORT ROUTER
// ===================================================================
module.exports = router;