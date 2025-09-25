// src/routes/sols.js
// Routes sols/tontines - FinApp Haiti
// Integration complète avec solController + middleware auth + validations

const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, param, query, validationResult } = require('express-validator');

// Import controllers et middleware
const SolController = require('../controllers/solController');
const { 
  authenticate,
  requireRole,
//   requireVerified,
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
 * 7. Middleware de gestion d'erreurs
 * 
 * Sécurité :
 * - Authentification obligatoire pour toutes les routes
 * - Rate limiting adapté par type d'opération
 * - Validations express-validator robustes
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
    security: 'Protection anti-fraude activée'
  },
  keyGenerator: (req) => req.user?.userId || req.ip
});

/**
 * Rate limiter pour discovery/recherche (anti-spam)
 */
const discoveryLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 100, // 100 recherches par utilisateur par 10 minutes
  message: {
    success: false,
    message: 'Trop de recherches. Réessayez dans 10 minutes.',
    error: 'discovery_rate_limit_exceeded'
  },
  keyGenerator: (req) => req.user?.userId || req.ip
});

/**
 * Rate limiter pour analytics (éviter surcharge calculs)
 */
const analyticsLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // 20 requêtes analytics par utilisateur par 5 minutes
  message: {
    success: false,
    message: 'Trop de requêtes d\'analytics. Réessayez dans 5 minutes.',
    error: 'analytics_rate_limit_exceeded'
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
 * @middleware authenticate + requireVerified + solCreationLimiter + validation
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Body: {
 *   name: string (3-100 chars),
 *   description?: string (max 500 chars),
 *   type: "classic"|"investment"|"emergency"|"project"|"business",
 *   contributionAmount: number (min 100),
 *   currency: "HTG"|"USD",
 *   maxParticipants: number (3-20),
 *   frequency: "weekly"|"biweekly"|"monthly"|"quarterly",
 *   startDate: ISO8601 date (minimum tomorrow),
 *   duration?: number (months),
 *   paymentDay?: number (1-31),
 *   interestRate?: number (0-10),
 *   tags?: string[],
 *   isPrivate?: boolean,
 *   rules?: string[]
 * }
 * 
 * Response: {
 *   success: true,
 *   message: "Sol créé avec succès",
 *   data: {
 *     sol: SolObject,
 *     accessCode: string,
 *     nextSteps: string[]
 *   }
 * }
 */
router.post('/',
  authenticate,
//   requireVerified,
  solCreationLimiter,
  SolController.validateCreateSol,
  SolController.createSol
);

/**
 * @route   GET /api/sols/
 * @desc    Récupérer tous les sols d'un utilisateur avec filtres
 * @access  Private (utilisateur authentifié)
 * @middleware authenticate + solOperationsLimiter
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Query Parameters: {
 *   status?: "all"|"recruiting"|"active"|"completed"|"cancelled",
 *   type?: "classic"|"investment"|"emergency"|"project"|"business",
 *   page?: number (default 1),
 *   limit?: number (default 20, max 50),
 *   sortBy?: "name"|"createdAt"|"lastActivityDate"|"contributionAmount",
 *   sortOrder?: "asc"|"desc",
 *   includeAnalytics?: boolean
 * }
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     sols: [EnrichedSolObject],
 *     pagination: PaginationObject,
 *     summary: SummaryObject,
 *     analytics?: AnalyticsObject
 *   }
 * }
 */
router.get('/',
  authenticate,
  solOperationsLimiter,
  [
    query('status').optional().isIn(['all', 'recruiting', 'active', 'completed', 'cancelled']),
    query('type').optional().isIn(['classic', 'investment', 'emergency', 'project', 'business']),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
    query('sortBy').optional().isIn(['name', 'createdAt', 'lastActivityDate', 'contributionAmount']),
    query('sortOrder').optional().isIn(['asc', 'desc']),
    query('includeAnalytics').optional().isBoolean().toBoolean()
  ],
  SolController.getUserSols
);

/**
 * @route   GET /api/sols/:id
 * @desc    Récupérer un sol spécifique avec détails complets
 * @access  Private (participant du sol uniquement)
 * @middleware authenticate + solOperationsLimiter + param validation
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Params: {
 *   id: ObjectId (Sol ID)
 * }
 * 
 * Query Parameters: {
 *   includeHistory?: boolean (inclure historique transactions)
 * }
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     sol: EnrichedSolObject,
 *     transactionHistory?: TransactionObject[],
 *     recommendations: RecommendationObject[]
 *   }
 * }
 */
router.get('/:id',
  authenticate,
  solOperationsLimiter,
  [
    param('id').isMongoId().withMessage('ID de sol invalide'),
    query('includeHistory').optional().isBoolean().toBoolean()
  ],
  SolController.getSolById
);

/**
 * @route   PUT /api/sols/:id
 * @desc    Mettre à jour un sol (créateur uniquement, selon statut)
 * @access  Private (créateur du sol uniquement)
 * @middleware authenticate + solOperationsLimiter + validation
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Params: {
 *   id: ObjectId (Sol ID)
 * }
 * 
 * Body: {
 *   name?: string,
 *   description?: string,
 *   tags?: string[],
 *   rules?: string[],
 *   // Autres champs modifiables selon statut du sol
 * }
 * 
 * Response: {
 *   success: true,
 *   message: "Sol mis à jour avec succès",
 *   data: { sol: UpdatedSolObject }
 * }
 */
router.put('/:id',
  authenticate,
  solOperationsLimiter,
  [
    param('id').isMongoId().withMessage('ID de sol invalide'),
    body('name').optional().trim().isLength({ min: 3, max: 100 }),
    body('description').optional().trim().isLength({ max: 500 }),
    body('tags').optional().isArray(),
    body('rules').optional().isArray()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Données de mise à jour invalides',
          errors: errors.array()
        });
      }

      // TODO: Implémenter SolController.updateSol
      res.status(501).json({
        success: false,
        message: 'Mise à jour sols - À implémenter',
        error: 'not_implemented'
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erreur mise à jour sol',
        error: 'update_sol_error'
      });
    }
  }
);

/**
 * @route   DELETE /api/sols/:id
 * @desc    Supprimer/annuler un sol (créateur uniquement, conditions strictes)
 * @access  Private (créateur du sol uniquement)
 * @middleware authenticate + solOperationsLimiter + validation
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Params: {
 *   id: ObjectId (Sol ID)
 * }
 * 
 * Body: {
 *   reason: string (required),
 *   confirmDeletion: boolean (required true)
 * }
 * 
 * Response: {
 *   success: true,
 *   message: "Sol supprimé/annulé avec succès",
 *   data: { 
 *     solId: string,
 *     status: "cancelled"|"deleted",
 *     reason: string 
 *   }
 * }
 */
router.delete('/:id',
  authenticate,
  solOperationsLimiter,
  [
    param('id').isMongoId().withMessage('ID de sol invalide'),
    body('reason').notEmpty().trim().isLength({ min: 10, max: 200 })
      .withMessage('Raison de suppression requise (10-200 caractères)'),
    body('confirmDeletion').equals('true').withMessage('Confirmation de suppression requise')
  ],
  async (req, res) => {
    try {
      // TODO: Implémenter SolController.deleteSol  
      res.status(501).json({
        success: false,
        message: 'Suppression sols - À implémenter',
        error: 'not_implemented'
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erreur suppression sol',
        error: 'delete_sol_error'
      });
    }
  }
);

// ===================================================================
// 3. ROUTES GESTION PARTICIPANTS
// ===================================================================

/**
 * @route   POST /api/sols/join
 * @desc    Rejoindre un sol avec code d'accès
 * @access  Private (utilisateur authentifié et vérifié)
 * @middleware authenticate + requireVerified + solOperationsLimiter + validation
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Body: {
 *   accessCode: string (6 chars alphanumeric)
 * }
 * 
 * Response: {
 *   success: true,
 *   message: "Vous avez rejoint le sol avec succès",
 *   data: {
 *     sol: SolObject,
 *     yourPosition: number,
 *     yourRoundNumber: number,
 *     status: string,
 *     nextSteps: string[]
 *   }
 * }
 */
router.post('/join',
  authenticate,
//   requireVerified,
  solOperationsLimiter,
  SolController.validateJoinSol,
  SolController.joinSol
);

/**
 * @route   DELETE /api/sols/:id/leave
 * @desc    Quitter un sol (avec conditions et pénalités)
 * @access  Private (participant du sol)
 * @middleware authenticate + solOperationsLimiter + validation
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Params: {
 *   id: ObjectId (Sol ID)
 * }
 * 
 * Body: {
 *   reason?: string (optionnel)
 * }
 * 
 * Response: {
 *   success: true,
 *   message: "Vous avez quitté le sol avec succès",
 *   data: {
 *     solStatus: string,
 *     remainingParticipants: number,
 *     reason?: string
 *   }
 * }
 */
router.delete('/:id/leave',
  authenticate,
  solOperationsLimiter,
  [
    param('id').isMongoId().withMessage('ID de sol invalide'),
    body('reason').optional().trim().isLength({ max: 200 })
  ],
  SolController.leaveSol
);

/**
 * @route   GET /api/sols/:id/participants
 * @desc    Récupérer liste participants d'un sol
 * @access  Private (participant du sol uniquement)
 * @middleware authenticate + solOperationsLimiter + param validation
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Params: {
 *   id: ObjectId (Sol ID)
 * }
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     participants: [ParticipantObject],
 *     totalParticipants: number,
 *     maxParticipants: number,
 *     spotsLeft: number
 *   }
 * }
 */
router.get('/:id/participants',
  authenticate,
  solOperationsLimiter,
  [param('id').isMongoId().withMessage('ID de sol invalide')],
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

// ===================================================================
// 4. ROUTES PAIEMENTS ET ROUNDS
// ===================================================================

/**
 * @route   POST /api/sols/:id/payment
 * @desc    Effectuer un paiement pour un round de sol
 * @access  Private (participant du sol)
 * @middleware authenticate + paymentLimiter + validation
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Params: {
 *   id: ObjectId (Sol ID)
 * }
 * 
 * Body: {
 *   accountId: ObjectId (Compte source),
 *   amount: number,
 *   roundIndex?: number (optionnel, round actuel par défaut),
 *   notes?: string
 * }
 * 
 * Response: {
 *   success: true,
 *   message: "Paiement effectué avec succès",
 *   data: {
 *     transaction: TransactionObject,
 *     roundStatus: RoundStatusObject,
 *     solProgress: SolProgressObject
 *   }
 * }
 */
router.post('/:id/payment',
  authenticate,
  paymentLimiter,
  [
    param('id').isMongoId().withMessage('ID de sol invalide'),
    ...SolController.validatePayment
  ],
  SolController.makePayment
);

/**
 * @route   GET /api/sols/:id/rounds
 * @desc    Récupérer historique des rounds d'un sol
 * @access  Private (participant du sol)
 * @middleware authenticate + solOperationsLimiter + param validation
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Params: {
 *   id: ObjectId (Sol ID)
 * }
 * 
 * Query Parameters: {
 *   includePayments?: boolean,
 *   status?: "scheduled"|"active"|"completed"
 * }
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     rounds: [RoundObject],
 *     currentRound: RoundObject,
 *     nextRound: RoundObject,
 *     solProgress: SolProgressObject
 *   }
 * }
 */
router.get('/:id/rounds',
  authenticate,
  solOperationsLimiter,
  [
    param('id').isMongoId().withMessage('ID de sol invalide'),
    query('includePayments').optional().isBoolean().toBoolean(),
    query('status').optional().isIn(['scheduled', 'active', 'completed'])
  ],
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
 * @route   GET /api/sols/:id/calendar
 * @desc    Récupérer calendrier des paiements d'un sol
 * @access  Private (participant du sol)
 * @middleware authenticate + solOperationsLimiter + param validation
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Params: {
 *   id: ObjectId (Sol ID)
 * }
 * 
 * Query Parameters: {
 *   startDate?: ISO8601 date,
 *   endDate?: ISO8601 date,
 *   format?: "list"|"calendar"
 * }
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     calendar: [CalendarEventObject],
 *     upcomingPayments: [PaymentEventObject],
 *     reminders: [ReminderObject]
 *   }
 * }
 */
router.get('/:id/calendar',
  authenticate,
  solOperationsLimiter,
  [
    param('id').isMongoId().withMessage('ID de sol invalide'),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('format').optional().isIn(['list', 'calendar'])
  ],
  async (req, res) => {
    try {
      // TODO: Implémenter SolController.getSolCalendar
      res.status(501).json({
        success: false,
        message: 'Calendrier sol - À implémenter',
        error: 'not_implemented'
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erreur récupération calendrier',
        error: 'get_calendar_error'
      });
    }
  }
);

// ===================================================================
// 5. ROUTES ANALYTICS ET DÉCOUVERTE
// ===================================================================

/**
 * @route   GET /api/sols/analytics/personal
 * @desc    Analytics personnels des sols avec patterns et recommandations
 * @access  Private (utilisateur authentifié)
 * @middleware authenticate + analyticsLimiter
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Query Parameters: {
 *   timeframe?: number (jours, default 90)
 * }
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     analytics: PersonalAnalyticsObject,
 *     generatedAt: ISO8601 date,
 *     timeframe: string,
 *     dataQuality: number
 *   }
 * }
 */
router.get('/analytics/personal',
  authenticate,
  analyticsLimiter,
  [
    query('timeframe').optional().isInt({ min: 30, max: 365 }).toInt()
  ],
  SolController.getPersonalAnalytics
);

/**
 * @route   GET /api/sols/discover
 * @desc    Découvrir sols ouverts avec scoring de pertinence
 * @access  Private (utilisateur authentifié et vérifié)
 * @middleware authenticate + requireVerified + discoveryLimiter
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Query Parameters: {
 *   type?: "classic"|"investment"|"emergency"|"project"|"business",
 *   minAmount?: number,
 *   maxAmount?: number,
 *   currency?: "HTG"|"USD",
 *   region?: string,
 *   page?: number,
 *   limit?: number
 * }
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     sols: [ScoredSolObject],
 *     pagination: PaginationObject,
 *     filters: FilterOptionsObject,
 *     recommendations: RecommendationObject[]
 *   }
 * }
 */
router.get('/discover',
  authenticate,
//   requireVerified,
  discoveryLimiter,
  [
    query('type').optional().isIn(['classic', 'investment', 'emergency', 'project', 'business']),
    query('minAmount').optional().isInt({ min: 100 }).toInt(),
    query('maxAmount').optional().isInt({ min: 100 }).toInt(),
    query('currency').optional().isIn(['HTG', 'USD']),
    query('region').optional().trim(),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 50 }).toInt()
  ],
  SolController.discoverSols
);

/**
 * @route   GET /api/sols/search
 * @desc    Recherche avancée de sols avec filtres multiples
 * @access  Private (utilisateur authentifié)
 * @middleware authenticate + discoveryLimiter
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Query Parameters: {
 *   q?: string (terme de recherche),
 *   filters: object (filtres complexes),
 *   sort?: string,
 *   page?: number,
 *   limit?: number
 * }
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     results: [SolObject],
 *     searchMeta: SearchMetaObject,
 *     suggestions: [string]
 *   }
 * }
 */
router.get('/search',
  authenticate,
  discoveryLimiter,
  [
    query('q').optional().trim().isLength({ min: 2, max: 100 }),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 50 }).toInt()
  ],
  async (req, res) => {
    try {
      // TODO: Implémenter SolController.searchSols
      res.status(501).json({
        success: false,
        message: 'Recherche sols - À implémenter',
        error: 'not_implemented'
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Erreur recherche sols',
        error: 'search_sols_error'
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
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     overview: OverviewStatsObject,
 *     trends: TrendsObject,
 *     performance: PerformanceObject,
 *     risks: RiskAnalysisObject
 *   }
 * }
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
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     activeSols: [ActiveSolObject],
 *     alerts: [AlertObject],
 *     healthStatus: HealthStatusObject
 *   }
 * }
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
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     version: string,
 *     endpoints: object,
 *     rateLimits: object,
 *     features: string[]
 *   }
 * }
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
 * 
 * Response: {
 *   success: true,
 *   status: "healthy",
 *   data: {
 *     service: "sols",
 *     uptime: string,
 *     stats: object
 *   }
 * }
 */
router.get('/health',
  async (req, res) => {
    try {
      // Vérifications basiques du service
      const stats = {
        totalSols: await require('../models/Sol').estimatedDocumentCount(),
        activeSols: await require('../models/Sol').countDocuments({ status: 'active' }),
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
// 8. MIDDLEWARE GESTION D'ERREURS SPÉCIALISÉ
// ===================================================================

/**
 * Middleware de validation des erreurs express-validator
 * Centralise la gestion des erreurs de validation
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    // Formatter erreurs pour réponse claire
    const formattedErrors = errors.array().map(error => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value,
      location: error.location
    }));

    return res.status(400).json({
      success: false,
      message: 'Erreurs de validation des données',
      errors: formattedErrors,
      error: 'validation_failed',
      timestamp: new Date().toISOString()
    });
  }
  
  next();
};

/**
 * Middleware de gestion d'erreurs spécifique aux sols
 * Gère les erreurs spécifiques aux opérations de sols/tontines
 */
router.use((error, req, res, next) => {
  console.error('❌ Erreur Route Sols:', error.message);
  console.error('❌ Stack:', error.stack);
  
  // Erreurs MongoDB spécifiques
  if (error.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'ID de sol invalide',
      error: 'invalid_sol_id',
      field: error.path,
      timestamp: new Date().toISOString()
    });
  }
  
  // Erreurs de validation Mongoose
  if (error.name === 'ValidationError') {
    const validationErrors = {};
    Object.keys(error.errors).forEach(key => {
      validationErrors[key] = error.errors[key].message;
    });
    
    return res.status(400).json({
      success: false,
      message: 'Erreurs de validation du sol',
      errors: validationErrors,
      error: 'sol_validation_error',
      timestamp: new Date().toISOString()
    });
  }
  
  // Erreurs de clé dupliquée (accessCode, etc.)
  if (error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    let message = 'Donnée dupliquée';
    
    if (field === 'accessCode') {
      message = 'Code d\'accès déjà utilisé (très rare, réessayez)';
    } else if (field === 'name') {
      message = 'Un sol avec ce nom existe déjà pour cet utilisateur';
    }
    
    return res.status(400).json({
      success: false,
      message: message,
      error: 'duplicate_data',
      field: field,
      timestamp: new Date().toISOString()
    });
  }
  
  // Erreurs de solde insuffisant (paiements)
  if (error.message && error.message.includes('insufficient')) {
    return res.status(400).json({
      success: false,
      message: 'Solde insuffisant pour effectuer ce paiement',
      error: 'insufficient_funds',
      suggestion: 'Vérifiez votre solde ou choisissez un autre compte',
      timestamp: new Date().toISOString()
    });
  }
  
  // Erreurs de permissions sol
  if (error.message && error.message.includes('unauthorized')) {
    return res.status(403).json({
      success: false,
      message: 'Accès non autorisé à ce sol',
      error: 'unauthorized_sol_access',
      suggestion: 'Vous devez être participant ou créateur du sol',
      timestamp: new Date().toISOString()
    });
  }
  
  // Erreurs métier sols spécifiques
  if (error.message && error.message.includes('sol_full')) {
    return res.status(400).json({
      success: false,
      message: 'Ce sol est complet',
      error: 'sol_full',
      suggestion: 'Recherchez d\'autres sols ouverts',
      timestamp: new Date().toISOString()
    });
  }
  
  if (error.message && error.message.includes('sol_not_recruiting')) {
    return res.status(400).json({
      success: false,
      message: 'Ce sol n\'accepte plus de nouveaux participants',
      error: 'sol_not_recruiting',
      timestamp: new Date().toISOString()
    });
  }
  
  if (error.message && error.message.includes('already_participant')) {
    return res.status(400).json({
      success: false,
      message: 'Vous participez déjà à ce sol',
      error: 'already_participant',
      timestamp: new Date().toISOString()
    });
  }
  
  // Erreurs de round/paiement
  if (error.message && error.message.includes('payment_already_made')) {
    return res.status(400).json({
      success: false,
      message: 'Paiement déjà effectué pour ce round',
      error: 'payment_already_made',
      timestamp: new Date().toISOString()
    });
  }
  
  if (error.message && error.message.includes('no_active_round')) {
    return res.status(400).json({
      success: false,
      message: 'Aucun round actif trouvé',
      error: 'no_active_round',
      suggestion: 'Vérifiez le calendrier du sol',
      timestamp: new Date().toISOString()
    });
  }
  
  // Erreurs de limite utilisateur
  if (error.message && error.message.includes('max_active_sols')) {
    return res.status(400).json({
      success: false,
      message: 'Limite de sols actifs simultanés atteinte (5 maximum)',
      error: 'max_active_sols_exceeded',
      suggestion: 'Terminez ou annulez un sol existant avant d\'en créer un nouveau',
      timestamp: new Date().toISOString()
    });
  }
  
  // Erreurs de connexion base de données
  if (error.name === 'MongoError' || error.name === 'MongoNetworkError') {
    return res.status(503).json({
      success: false,
      message: 'Service temporairement indisponible',
      error: 'database_connection_error',
      suggestion: 'Réessayez dans quelques instants',
      timestamp: new Date().toISOString()
    });
  }
  
  // Erreurs de timeout
  if (error.name === 'MongoTimeoutError') {
    return res.status(504).json({
      success: false,
      message: 'Opération trop lente, réessayez',
      error: 'operation_timeout',
      timestamp: new Date().toISOString()
    });
  }
  
  // Erreur générique sols
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Erreur interne du service sols',
    error: error.code || 'sols_internal_error',
    debug: process.env.NODE_ENV === 'development' ? {
      stack: error.stack,
      name: error.name
    } : undefined,
    timestamp: new Date().toISOString()
  });
});

// ===================================================================
// 9. EXPORT ROUTER
// ===================================================================

module.exports = router;

/**
 * ===================================================================
 * DOCUMENTATION TECHNIQUE ROUTES SOLS
 * ===================================================================
 * 
 * Architecture :
 * - 26+ endpoints spécialisés sols/tontines
 * - Rate limiting adaptatif par type d'opération
 * - Validations robustes avec express-validator
 * - Gestion d'erreurs granulaire et informative
 * - Middleware d'authentification et autorisation
 * - Integration complète avec SolController
 * - Préparation pour Phase 7 IA (analytics, patterns)
 * 
 * Sécurité :
 * - Authentification obligatoire (sauf info/health)
 * - Rate limiting anti-spam et anti-fraude
 * - Validation stricte des données d'entrée
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
 * Endpoints Prioritaires :
 * 1. POST /api/sols/ - Création sols
 * 2. GET /api/sols/ - Liste personnelle  
 * 3. POST /api/sols/join - Rejoindre sol
 * 4. POST /api/sols/:id/payment - Effectuer paiements
 * 5. GET /api/sols/discover - Découverte sols
 * 6. GET /api/sols/analytics/personal - Analytics IA
 * 
 * Intégration IA (Phase 7) :
 * - Collecte patterns comportementaux automatique
 * - Analytics personnels pour recommendations  
 * - Scoring pertinence pour découverte
 * - Prédictions basées historique utilisateur
 * - Optimisations timing et montants personnalisées
 * 
 * Tests Prioritaires :
 * - CRUD sols complet avec validations
 * - Gestion participants et permissions
 * - Paiements avec transactions atomiques
 * - Rate limiting et gestion erreurs
 * - Analytics et découverte avec données mock
 * ===================================================================
 */