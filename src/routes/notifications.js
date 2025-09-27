// src/routes/notifications.js
// Routes pour gestion des notifications - FinApp Haiti
// Endpoints REST API pour système de notifications

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const NotificationController = require('../controllers/notificationController');
const rateLimit = require('express-rate-limit');
const { query, body, param } = require('express-validator');

// ===================================================================
// RATE LIMITERS SPÉCIFIQUES
// ===================================================================

/**
 * Rate limiter pour lecture notifications (généreux)
 */
const readNotificationsLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requêtes par minute
  message: {
    success: false,
    message: 'Trop de requêtes. Réessayez dans 1 minute.',
    error: 'read_notifications_rate_limit_exceeded',
    retryAfter: '1 minute'
  },
  keyGenerator: (req) => req.user?.userId || req.ip
});

/**
 * Rate limiter pour actions notifications (modéré)
 */
const actionNotificationsLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 actions par minute
  message: {
    success: false,
    message: 'Trop d\'actions sur notifications. Réessayez dans 1 minute.',
    error: 'action_notifications_rate_limit_exceeded',
    retryAfter: '1 minute'
  },
  keyGenerator: (req) => req.user?.userId || req.ip
});

/**
 * Rate limiter pour préférences (restrictif)
 */
const preferencesLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 modifications par 15 min
  message: {
    success: false,
    message: 'Trop de modifications de préférences. Réessayez dans 15 minutes.',
    error: 'preferences_rate_limit_exceeded',
    retryAfter: '15 minutes'
  },
  keyGenerator: (req) => req.user?.userId || req.ip
});

/**
 * Rate limiter pour tests (très restrictif)
 */
const testLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 10, // 10 tests par heure
  message: {
    success: false,
    message: 'Trop de notifications test. Réessayez dans 1 heure.',
    error: 'test_rate_limit_exceeded',
    retryAfter: '1 hour'
  },
  keyGenerator: (req) => req.user?.userId || req.ip
});

// ===================================================================
// MIDDLEWARE DE VALIDATION
// ===================================================================

/**
 * Validation pour pagination
 */
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page doit être un entier positif')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit doit être entre 1 et 100')
    .toInt()
];

/**
 * Validation pour filtres notifications
 */
const validateFilters = [
  query('status')
    .optional()
    .isIn(['pending', 'sent', 'delivered', 'read', 'acted', 'dismissed', 'failed'])
    .withMessage('Status invalide'),
  query('source')
    .optional()
    .isIn(['ai_advice', 'ai_anomaly', 'ai_prediction', 'budget_alert', 'sol_reminder', 'sol_turn', 'debt_reminder', 'transaction', 'account', 'system'])
    .withMessage('Source invalide'),
  query('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Priorité invalide')
];

/**
 * Validation ID MongoDB
 */
const validateMongoId = [
  param('id')
    .isMongoId()
    .withMessage('ID de notification invalide')
];

/**
 * Validation priorité
 */
const validatePriority = [
  param('priority')
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Priorité invalide')
];

/**
 * Validation préférences
 */
const validatePreferences = [
  body('aiAdvice')
    .optional()
    .isBoolean()
    .withMessage('aiAdvice doit être un booléen'),
  body('aiAlerts')
    .optional()
    .isBoolean()
    .withMessage('aiAlerts doit être un booléen'),
  body('budgetAlerts')
    .optional()
    .isBoolean()
    .withMessage('budgetAlerts doit être un booléen'),
  body('solReminders')
    .optional()
    .isBoolean()
    .withMessage('solReminders doit être un booléen'),
  body('debtReminders')
    .optional()
    .isBoolean()
    .withMessage('debtReminders doit être un booléen'),
  body('push')
    .optional()
    .isBoolean()
    .withMessage('push doit être un booléen'),
  body('email')
    .optional()
    .isBoolean()
    .withMessage('email doit être un booléen'),
  body('sms')
    .optional()
    .isBoolean()
    .withMessage('sms doit être un booléen')
];

/**
 * Validation notification test
 */
const validateTestNotification = [
  body('type')
    .optional()
    .isIn(['info', 'success', 'warning', 'error', 'urgent'])
    .withMessage('Type invalide'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Priorité invalide'),
  body('title')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Titre doit contenir entre 3 et 200 caractères'),
  body('message')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Message doit contenir entre 10 et 500 caractères')
];

// ===================================================================
// ROUTES NOTIFICATIONS - RÉCUPÉRATION
// ===================================================================

/**
 * @route   GET /api/notifications
 * @desc    Récupérer toutes les notifications de l'utilisateur
 * @access  Private (authentification requise)
 * @middleware authenticate + readNotificationsLimiter + validations
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Query Parameters: {
 *   status?: string (pending|sent|delivered|read|acted|dismissed|failed),
 *   source?: string (ai_advice|budget_alert|sol_reminder...),
 *   priority?: string (low|medium|high|urgent),
 *   page?: number (défaut: 1),
 *   limit?: number (défaut: 50, max: 100)
 * }
 * 
 * Response: {
 *   success: true,
 *   message: "Notifications récupérées avec succès",
 *   data: {
 *     notifications: [NotificationObject],
 *     pagination: {
 *       total: number,
 *       unreadCount: number,
 *       page: number,
 *       limit: number,
 *       totalPages: number
 *     }
 *   }
 * }
 */
router.get('/',
  authenticate,
  readNotificationsLimiter,
  validatePagination,
  validateFilters,
  NotificationController.getUserNotifications
);

/**
 * @route   GET /api/notifications/unread
 * @desc    Récupérer uniquement les notifications non lues
 * @access  Private (authentification requise)
 * @middleware authenticate + readNotificationsLimiter
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Query Parameters: {
 *   limit?: number (défaut: 50)
 * }
 * 
 * Response: {
 *   success: true,
 *   message: "Notifications non lues récupérées",
 *   data: {
 *     notifications: [NotificationObject],
 *     count: number
 *   }
 * }
 */
router.get('/unread',
  authenticate,
  readNotificationsLimiter,
  [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit doit être entre 1 et 100')
      .toInt()
  ],
  NotificationController.getUnreadNotifications
);

/**
 * @route   GET /api/notifications/unread/count-by-type
 * @desc    Compter notifications non lues par type
 * @access  Private (authentification requise)
 * @middleware authenticate + readNotificationsLimiter
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Response: {
 *   success: true,
 *   message: "Compteurs récupérés",
 *   data: {
 *     byType: {
 *       warning: 5,
 *       info: 12,
 *       urgent: 2
 *     },
 *     total: 19
 *   }
 * }
 */
router.get('/unread/count-by-type',
  authenticate,
  readNotificationsLimiter,
  NotificationController.countUnreadByType
);

/**
 * @route   GET /api/notifications/stats
 * @desc    Obtenir statistiques notifications
 * @access  Private (authentification requise)
 * @middleware authenticate + readNotificationsLimiter
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Response: {
 *   success: true,
 *   message: "Statistiques récupérées",
 *   data: {
 *     total: 45,
 *     unread: 12,
 *     read: 30,
 *     acted: 15,
 *     dismissed: 3,
 *     byPriority: { urgent: 2, high: 10, medium: 25, low: 8 },
 *     bySource: { ai_advice: 20, budget_alert: 15, sol_reminder: 10 },
 *     actionRate: "33.33%",
 *     readRate: "66.67%"
 *   }
 * }
 */
router.get('/stats',
  authenticate,
  readNotificationsLimiter,
  NotificationController.getStats
);

/**
 * @route   GET /api/notifications/priority/:priority
 * @desc    Récupérer notifications par priorité
 * @access  Private (authentification requise)
 * @middleware authenticate + readNotificationsLimiter + validation
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Params: {
 *   priority: string (low|medium|high|urgent)
 * }
 * 
 * Response: {
 *   success: true,
 *   message: "Notifications [priority] récupérées",
 *   data: {
 *     notifications: [NotificationObject],
 *     count: number,
 *     priority: string
 *   }
 * }
 */
router.get('/priority/:priority',
  authenticate,
  readNotificationsLimiter,
  validatePriority,
  NotificationController.getByPriority
);

/**
 * @route   GET /api/notifications/:id
 * @desc    Récupérer une notification spécifique
 * @access  Private (authentification requise + ownership)
 * @middleware authenticate + readNotificationsLimiter + validation
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Params: {
 *   id: string (MongoDB ObjectId)
 * }
 * 
 * Response: {
 *   success: true,
 *   message: "Notification récupérée",
 *   data: {
 *     notification: NotificationObject
 *   }
 * }
 */
router.get('/:id',
  authenticate,
  readNotificationsLimiter,
  validateMongoId,
  NotificationController.getNotificationById
);

// ===================================================================
// ROUTES NOTIFICATIONS - ACTIONS
// ===================================================================

/**
 * @route   PUT /api/notifications/read-all
 * @desc    Marquer toutes les notifications comme lues
 * @access  Private (authentification requise)
 * @middleware authenticate + actionNotificationsLimiter
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Response: {
 *   success: true,
 *   message: "Toutes les notifications marquées comme lues",
 *   data: {
 *     modifiedCount: number
 *   }
 * }
 */
router.put('/read-all',
  authenticate,
  actionNotificationsLimiter,
  NotificationController.markAllAsRead
);

/**
 * @route   PUT /api/notifications/:id/read
 * @desc    Marquer une notification comme lue
 * @access  Private (authentification requise + ownership)
 * @middleware authenticate + actionNotificationsLimiter + validation
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Params: {
 *   id: string (MongoDB ObjectId)
 * }
 * 
 * Response: {
 *   success: true,
 *   message: "Notification marquée comme lue",
 *   data: {
 *     notification: NotificationObject
 *   }
 * }
 */
router.put('/:id/read',
  authenticate,
  actionNotificationsLimiter,
  validateMongoId,
  NotificationController.markAsRead
);

/**
 * @route   PUT /api/notifications/:id/acted
 * @desc    Marquer notification comme actionnée
 * @access  Private (authentification requise + ownership)
 * @middleware authenticate + actionNotificationsLimiter + validation
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Params: {
 *   id: string (MongoDB ObjectId)
 * }
 * 
 * Response: {
 *   success: true,
 *   message: "Notification marquée comme actionnée",
 *   data: {
 *     notification: NotificationObject
 *   }
 * }
 */
router.put('/:id/acted',
  authenticate,
  actionNotificationsLimiter,
  validateMongoId,
  NotificationController.markAsActed
);

/**
 * @route   DELETE /api/notifications/read
 * @desc    Supprimer toutes les notifications lues
 * @access  Private (authentification requise)
 * @middleware authenticate + actionNotificationsLimiter
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Response: {
 *   success: true,
 *   message: "Notifications lues supprimées",
 *   data: {
 *     deletedCount: number
 *   }
 * }
 */
router.delete('/read',
  authenticate,
  actionNotificationsLimiter,
  NotificationController.deleteAllRead
);

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Rejeter/Supprimer une notification
 * @access  Private (authentification requise + ownership)
 * @middleware authenticate + actionNotificationsLimiter + validation
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Params: {
 *   id: string (MongoDB ObjectId)
 * }
 * 
 * Response: {
 *   success: true,
 *   message: "Notification rejetée",
 *   data: {
 *     notification: NotificationObject
 *   }
 * }
 */
router.delete('/:id',
  authenticate,
  actionNotificationsLimiter,
  validateMongoId,
  NotificationController.dismissNotification
);

// ===================================================================
// ROUTES PRÉFÉRENCES
// ===================================================================

/**
 * @route   GET /api/notifications/preferences
 * @desc    Récupérer préférences de notifications
 * @access  Private (authentification requise)
 * @middleware authenticate + readNotificationsLimiter
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Response: {
 *   success: true,
 *   message: "Préférences récupérées",
 *   data: {
 *     preferences: {
 *       aiAdvice: true,
 *       aiAlerts: true,
 *       budgetAlerts: true,
 *       solReminders: true,
 *       debtReminders: true,
 *       push: true,
 *       email: false,
 *       sms: false
 *     }
 *   }
 * }
 */
router.get('/preferences',
  authenticate,
  readNotificationsLimiter,
  NotificationController.getPreferences
);

/**
 * @route   PUT /api/notifications/preferences
 * @desc    Mettre à jour préférences de notifications
 * @access  Private (authentification requise)
 * @middleware authenticate + preferencesLimiter + validation
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Body: {
 *   aiAdvice?: boolean,
 *   aiAlerts?: boolean,
 *   budgetAlerts?: boolean,
 *   solReminders?: boolean,
 *   debtReminders?: boolean,
 *   push?: boolean,
 *   email?: boolean,
 *   sms?: boolean
 * }
 * 
 * Response: {
 *   success: true,
 *   message: "Préférences mises à jour",
 *   data: {
 *     preferences: PreferencesObject
 *   }
 * }
 */
router.put('/preferences',
  authenticate,
  preferencesLimiter,
  validatePreferences,
  NotificationController.updatePreferences
);

// ===================================================================
// ROUTES DÉVELOPPEMENT & TEST
// ===================================================================

/**
 * @route   POST /api/notifications/test
 * @desc    Créer notification test (développement seulement)
 * @access  Private (authentification requise + dev mode)
 * @middleware authenticate + testLimiter + validation
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Body: {
 *   type?: string (info|success|warning|error|urgent),
 *   priority?: string (low|medium|high|urgent),
 *   title?: string,
 *   message?: string
 * }
 * 
 * Response: {
 *   success: true,
 *   message: "Notification test créée",
 *   data: {
 *     notification: NotificationObject
 *   }
 * }
 */
router.post('/test',
  authenticate,
  testLimiter,
  validateTestNotification,
  NotificationController.testNotification
);

// ===================================================================
// EXPORT ROUTER
// ===================================================================

module.exports = router;

/**
 * ===================================================================
 * DOCUMENTATION TECHNIQUE ROUTES NOTIFICATIONS
 * ===================================================================
 * 
 * Architecture :
 * - 14 endpoints REST complets
 * - Rate limiting adapté par type d'opération
 * - Validation robuste avec express-validator
 * - Middleware auth systématique
 * - Documentation OpenAPI inline détaillée
 * 
 * Sécurité :
 * - Authentification JWT obligatoire
 * - Validation stricte des paramètres
 * - Rate limiting anti-spam (4 niveaux)
 * - Vérification ownership dans controller
 * 
 * Rate Limiting :
 * - Lecture : 100/min (généreux)
 * - Actions : 30/min (modéré)
 * - Préférences : 10/15min (restrictif)
 * - Tests : 10/heure (très restrictif)
 * 
 * Endpoints par Catégorie :
 * - Récupération : GET / + /unread + /stats + /:id + /priority/:p
 * - Actions : PUT /read-all + /:id/read + /:id/acted + DELETE /read + /:id
 * - Préférences : GET /preferences + PUT /preferences
 * - Test : POST /test (dev only)
 * 
 * Validations :
 * - Pagination (page, limit)
 * - Filtres (status, source, priority)
 * - MongoDB ObjectId
 * - Préférences booléennes
 * - Notification test (type, priority, contenu)
 * 
 * Intégration :
 * - Connecté à NotificationController
 * - Prêt pour activation dans app.js
 * - Compatible avec système auth existant
 * - Extensible pour WebSocket futur
 * ===================================================================
 */