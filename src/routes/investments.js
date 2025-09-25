// src/routes/investments.js
// Routes pour gestion investissements - FinApp Haiti
// Version complète avec rate limiting et validations

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { body, param, query } = require('express-validator');
const InvestmentController = require('../controllers/investmentController');
const { authenticate } = require('../middleware/auth');

// ===================================================================
// RATE LIMITERS SPÉCIFIQUES
// ===================================================================

// Rate limiting pour création investissement
const investmentCreationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Max 10 créations par 15 min
  message: {
    success: false,
    message: 'Trop de créations d\'investissements. Réessayez dans 15 minutes.',
    error: 'rate_limit_exceeded'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiting pour opérations normales
const investmentOperationsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Max 100 requêtes par 15 min
  message: {
    success: false,
    message: 'Trop de requêtes. Réessayez dans quelques minutes.',
    error: 'rate_limit_exceeded'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiting pour ajout revenus/dépenses
const financialOperationsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Max 50 opérations financières par 15 min
  message: {
    success: false,
    message: 'Trop d\'opérations financières. Réessayez dans 15 minutes.',
    error: 'rate_limit_exceeded'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiting pour analytics
const analyticsLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 30, // Max 30 requêtes analytics par 5 min
  message: {
    success: false,
    message: 'Trop de requêtes analytics. Réessayez dans quelques minutes.',
    error: 'rate_limit_exceeded'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// ===================================================================
// VALIDATION PARAMS
// ===================================================================

const investmentIdValidation = [
  param('investmentId')
    .isMongoId()
    .withMessage('ID d\'investissement invalide')
];

// ===================================================================
// ROUTES CRUD INVESTISSEMENTS
// ===================================================================

/**
 * @route   POST /api/investments/
 * @desc    Créer un nouvel investissement
 * @access  Private (utilisateur authentifié)
 * @middleware authenticate + investmentCreationLimiter + validation
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Body: {
 *   name: string (3-100 chars, requis),
 *   description?: string (max 500 chars),
 *   type: "real_estate"|"agriculture"|"commerce"|"livestock"|"transport"|"services"|"technology"|"education"|"other",
 *   category?: "small"|"medium"|"large",
 *   initialInvestment: number (min 0, requis),
 *   currency?: "HTG"|"USD" (default HTG),
 *   location?: {
 *     region?: string,
 *     city?: string,
 *     address?: string
 *   },
 *   expectedDuration?: number (mois),
 *   projections?: {
 *     expectedROI?: number,
 *     targetValue?: number,
 *     breakEvenMonths?: number
 *   },
 *   partners?: Array,
 *   risks?: Array,
 *   goals?: Object
 * }
 * 
 * Response: {
 *   success: true,
 *   message: "Investissement créé avec succès",
 *   data: {
 *     investment: InvestmentObject,
 *     nextSteps: string[]
 *   }
 * }
 */
router.post('/',
  authenticate,
  investmentCreationLimiter,
  InvestmentController.validateCreateInvestment,
  InvestmentController.createInvestment
);

/**
 * @route   GET /api/investments/
 * @desc    Récupérer tous les investissements de l'utilisateur
 * @access  Private (utilisateur authentifié)
 * @middleware authenticate + investmentOperationsLimiter
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Query Parameters: {
 *   status?: "all"|"planning"|"active"|"profitable"|"break_even"|"loss"|"on_hold"|"completed"|"failed",
 *   type?: "real_estate"|"agriculture"|"commerce"|...,
 *   isActive?: boolean,
 *   page?: number (default 1),
 *   limit?: number (default 20, max 50),
 *   sortBy?: "name"|"startDate"|"lastUpdateDate"|"totalInvested"|"actualROI",
 *   sortOrder?: "asc"|"desc",
 *   includeAnalytics?: boolean
 * }
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     investments: [InvestmentObject],
 *     pagination: PaginationObject,
 *     summary: {
 *       totalInvestments: number,
 *       activeInvestments: number,
 *       totalInvested: number,
 *       totalCurrentValue: number,
 *       totalProfit: number
 *     },
 *     analytics?: AnalyticsObject
 *   }
 * }
 */
router.get('/',
  authenticate,
  investmentOperationsLimiter,
  [
    query('status').optional().isIn(['all', 'planning', 'active', 'profitable', 'break_even', 'loss', 'on_hold', 'completed', 'failed']),
    query('type').optional().isIn(['real_estate', 'agriculture', 'commerce', 'livestock', 'transport', 'services', 'technology', 'education', 'other']),
    query('isActive').optional().isBoolean(),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
    query('sortBy').optional().isIn(['name', 'startDate', 'lastUpdateDate', 'totalInvested', 'actualROI']),
    query('sortOrder').optional().isIn(['asc', 'desc']),
    query('includeAnalytics').optional().isBoolean()
  ],
  InvestmentController.getUserInvestments
);

/**
 * @route   GET /api/investments/:investmentId
 * @desc    Récupérer un investissement spécifique avec détails complets
 * @access  Private (propriétaire de l'investissement uniquement)
 * @middleware authenticate + investmentOperationsLimiter + validation
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Params: {
 *   investmentId: ObjectId (Investment ID)
 * }
 * 
 * Query Parameters: {
 *   includeHistory?: boolean (inclure historique transactions liées)
 * }
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     investment: InvestmentObject,
 *     transactionHistory?: [TransactionObject]
 *   }
 * }
 */
router.get('/:investmentId',
  authenticate,
  investmentOperationsLimiter,
  investmentIdValidation,
  [
    query('includeHistory').optional().isBoolean()
  ],
  InvestmentController.getInvestmentById
);

/**
 * @route   PUT /api/investments/:investmentId
 * @desc    Mettre à jour un investissement
 * @access  Private (propriétaire uniquement)
 * @middleware authenticate + investmentOperationsLimiter + validation
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Params: {
 *   investmentId: ObjectId
 * }
 * 
 * Body: {
 *   name?: string,
 *   description?: string,
 *   category?: string,
 *   location?: Object,
 *   expectedDuration?: number,
 *   projections?: Object,
 *   goals?: Object,
 *   status?: string
 * }
 * 
 * Response: {
 *   success: true,
 *   message: "Investissement mis à jour avec succès",
 *   data: {
 *     investment: InvestmentObject
 *   }
 * }
 */
router.put('/:investmentId',
  authenticate,
  investmentOperationsLimiter,
  investmentIdValidation,
  [
    body('name').optional().isLength({ min: 3, max: 100 }),
    body('description').optional().isLength({ max: 500 }),
    body('status').optional().isIn(['planning', 'active', 'profitable', 'break_even', 'loss', 'on_hold', 'completed', 'failed'])
  ],
  InvestmentController.updateInvestment
);

// ===================================================================
// ROUTES GESTION FINANCIÈRE
// ===================================================================

/**
 * @route   POST /api/investments/:investmentId/revenue
 * @desc    Ajouter un revenu à un investissement
 * @access  Private (propriétaire uniquement)
 * @middleware authenticate + financialOperationsLimiter + validation
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Params: {
 *   investmentId: ObjectId
 * }
 * 
 * Body: {
 *   amount: number (min 0.01, requis),
 *   description: string (max 200 chars, requis),
 *   source?: "sales"|"interest"|"dividends"|"rent"|"commission"|"other",
 *   date?: ISO8601 date,
 *   isRecurring?: boolean,
 *   recurringFrequency?: "daily"|"weekly"|"monthly"|"yearly"
 * }
 * 
 * Response: {
 *   success: true,
 *   message: "Revenu ajouté avec succès",
 *   data: {
 *     investment: InvestmentObject,
 *     newRevenue: RevenueObject
 *   }
 * }
 */
router.post('/:investmentId/revenue',
  authenticate,
  financialOperationsLimiter,
  investmentIdValidation,
  InvestmentController.validateAddRevenue,
  InvestmentController.addRevenue
);

/**
 * @route   POST /api/investments/:investmentId/expense
 * @desc    Ajouter une dépense à un investissement
 * @access  Private (propriétaire uniquement)
 * @middleware authenticate + financialOperationsLimiter + validation
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Params: {
 *   investmentId: ObjectId
 * }
 * 
 * Body: {
 *   amount: number (min 0.01, requis),
 *   description: string (max 200 chars, requis),
 *   category?: "operational"|"maintenance"|"marketing"|"salaries"|"supplies"|"utilities"|"other",
 *   date?: ISO8601 date,
 *   isRecurring?: boolean,
 *   recurringFrequency?: "daily"|"weekly"|"monthly"|"yearly"
 * }
 * 
 * Response: {
 *   success: true,
 *   message: "Dépense ajoutée avec succès",
 *   data: {
 *     investment: InvestmentObject,
 *     newExpense: ExpenseObject
 *   }
 * }
 */
router.post('/:investmentId/expense',
  authenticate,
  financialOperationsLimiter,
  investmentIdValidation,
  InvestmentController.validateAddExpense,
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
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Params: {
 *   investmentId: ObjectId
 * }
 * 
 * Body: {
 *   userId: ObjectId (requis),
 *   percentage: number (0-100, requis),
 *   role?: "investor"|"operator"|"advisor"|"silent_partner",
 *   investmentAmount?: number,
 *   joinDate?: ISO8601 date
 * }
 * 
 * Response: {
 *   success: true,
 *   message: "Partenaire ajouté avec succès",
 *   data: {
 *     investment: InvestmentObject
 *   }
 * }
 */
router.post('/:investmentId/partner',
  authenticate,
  investmentOperationsLimiter,
  investmentIdValidation,
  [
    body('userId').notEmpty().isMongoId().withMessage('ID utilisateur invalide'),
    body('percentage').notEmpty().isFloat({ min: 0, max: 100 }).withMessage('Pourcentage invalide (0-100)'),
    body('role').optional().isIn(['investor', 'operator', 'advisor', 'silent_partner']),
    body('investmentAmount').optional().isFloat({ min: 0 })
  ],
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
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     analytics: {
 *       overview: {
 *         totalInvestments: number,
 *         totalInvested: number,
 *         totalCurrentValue: number,
 *         totalRevenue: number,
 *         totalExpenses: number,
 *         netProfit: number,
 *         avgROI: number,
 *         profitableCount: number,
 *         profitablePercentage: number
 *       },
 *       byType: [TypeAnalyticsObject],
 *       diversification: {
 *         typesCount: number,
 *         dominantType: string,
 *         diversificationScore: number (0-100)
 *       }
 *     }
 *   }
 * }
 */
router.get('/analytics/portfolio',
  authenticate,
  analyticsLimiter,
  InvestmentController.getPortfolioAnalytics
);

/**
 * @route   GET /api/investments/analytics/by-type
 * @desc    Analytics des investissements par type
 * @access  Private (utilisateur authentifié)
 * @middleware authenticate + analyticsLimiter
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     analyticsByType: [
 *       {
 *         _id: string (type),
 *         count: number,
 *         totalInvested: number,
 *         totalRevenue: number,
 *         avgROI: number
 *       }
 *     ],
 *     totalTypes: number
 *   }
 * }
 */
router.get('/analytics/by-type',
  authenticate,
  analyticsLimiter,
  InvestmentController.getAnalyticsByType
);

/**
 * @route   GET /api/investments/analytics/needing-attention
 * @desc    Investissements nécessitant attention (risques, ROI négatif, etc.)
 * @access  Private (utilisateur authentifié)
 * @middleware authenticate + analyticsLimiter
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     totalNeedingAttention: number,
 *     categorized: {
 *       highRisk: [InvestmentObject],
 *       negativeROI: [InvestmentObject],
 *       outdated: [InvestmentObject]
 *     },
 *     allInvestments: [InvestmentObject]
 *   }
 * }
 */
router.get('/analytics/needing-attention',
  authenticate,
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
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Params: {
 *   investmentId: ObjectId
 * }
 * 
 * Body: {
 *   reason?: "completed"|"failed" (default "completed"),
 *   notes?: string
 * }
 * 
 * Response: {
 *   success: true,
 *   message: "Investissement archivé avec succès",
 *   data: {
 *     investment: InvestmentObject,
 *     finalStats: {
 *       totalInvested: number,
 *       finalValue: number,
 *       totalProfit: number,
 *       roi: number,
 *       duration: number (mois)
 *     }
 *   }
 * }
 */
router.put('/:investmentId/archive',
  authenticate,
  investmentOperationsLimiter,
  investmentIdValidation,
  [
    body('reason').optional().isIn(['completed', 'failed']),
    body('notes').optional().isLength({ max: 500 })
  ],
  InvestmentController.archiveInvestment
);

// ===================================================================
// HEALTH CHECK ROUTE
// ===================================================================

/**
 * @route   GET /api/investments/health
 * @desc    Vérifier santé du module investments
 * @access  Public
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Module Investments opérationnel',
    timestamp: new Date().toISOString(),
    endpoints: {
      total: 11,
      categories: {
        crud: 4,
        financial: 2,
        partners: 1,
        analytics: 3,
        actions: 1
      }
    }
  });
});

module.exports = router;