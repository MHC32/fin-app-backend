// src/routes/notifications.js
// Routes pour gestion des notifications - FinApp Haiti
// Integration complète avec validation.js centralisée

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

// Import validation centralisée
const { validate, validateObjectId } = require('../middleware/validation');

// Import controllers et middleware
const { authenticate } = require('../middleware/auth');
const NotificationController = require('../controllers/notificationController');

/**
 * ===================================================================
 * ROUTES NOTIFICATIONS - FINAPP HAITI
 * ===================================================================
 * 
 * Architecture :
 * - 14 endpoints REST complets
 * - Validation centralisée avec validation.js
 * - Rate limiting adapté par type d'opération
 * - Gestion complète notifications système
 * 
 * Sécurité :
 * - Authentification JWT obligatoire
 * - Validation Joi centralisée pour toutes les entrées
 * - Rate limiting anti-spam (4 niveaux)
 * - Vérification ownership dans controller
 * 
 * Features :
 * - CRUD notifications complet
 * - Filtrage et pagination
 * - Actions (read, acted, dismiss)
 * - Préférences utilisateur
 * - Statistics et analytics
 */

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
// ROUTES NOTIFICATIONS - RÉCUPÉRATION
// ===================================================================

/**
 * @route   GET /api/notifications
 * @desc    Récupérer toutes les notifications de l'utilisateur
 * @access  Private (authentification requise)
 * @middleware authenticate + readNotificationsLimiter + validation
 */
router.get('/',
  authenticate,
  readNotificationsLimiter,
  validate('notification', 'filter', 'query'),
  NotificationController.getUserNotifications
);

/**
 * @route   GET /api/notifications/unread
 * @desc    Récupérer uniquement les notifications non lues
 * @access  Private (authentification requise)
 * @middleware authenticate + readNotificationsLimiter + validation
 */
router.get('/unread',
  authenticate,
  readNotificationsLimiter,
  validate('notification', 'unread', 'query'),
  NotificationController.getUnreadNotifications
);

/**
 * @route   GET /api/notifications/stats
 * @desc    Statistiques des notifications de l'utilisateur
 * @access  Private (authentification requise)
 * @middleware authenticate + readNotificationsLimiter
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
 */
router.get('/priority/:priority',
  authenticate,
  readNotificationsLimiter,
  validate('notification', 'priority', 'params'),
  NotificationController.getByPriority
);

/**
 * @route   GET /api/notifications/:id
 * @desc    Récupérer une notification spécifique
 * @access  Private (authentification requise + ownership)
 * @middleware authenticate + readNotificationsLimiter + validation
 */
router.get('/:id',
  authenticate,
  readNotificationsLimiter,
  validateObjectId('id'),
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
 */
router.put('/:id/read',
  authenticate,
  actionNotificationsLimiter,
  validateObjectId('id'),
  NotificationController.markAsRead
);

/**
 * @route   PUT /api/notifications/:id/acted
 * @desc    Marquer notification comme actionnée
 * @access  Private (authentification requise + ownership)
 * @middleware authenticate + actionNotificationsLimiter + validation
 */
router.put('/:id/acted',
  authenticate,
  actionNotificationsLimiter,
  validateObjectId('id'),
  NotificationController.markAsActed
);

/**
 * @route   DELETE /api/notifications/read
 * @desc    Supprimer toutes les notifications lues
 * @access  Private (authentification requise)
 * @middleware authenticate + actionNotificationsLimiter
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
 */
router.delete('/:id',
  authenticate,
  actionNotificationsLimiter,
  validateObjectId('id'),
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
 */
router.put('/preferences',
  authenticate,
  preferencesLimiter,
  validate('notification', 'updatePreferences'),
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
 */
router.post('/test',
  authenticate,
  testLimiter,
  validate('notification', 'test'),
  NotificationController.testNotification
);

// ===================================================================
// ROUTES UTILITAIRES
// ===================================================================

/**
 * @route   GET /api/notifications/info
 * @desc    Informations sur l'API notifications
 * @access  Public
 */
router.get('/info', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      version: '1.0.0',
      description: 'API Notifications - FinApp Haiti',
      features: [
        'Système de notifications temps réel',
        'Filtrage et pagination avancés',
        'Actions multiples (read, acted, dismiss)',
        'Préférences personnalisables',
        'Statistics et analytics',
        'Rate limiting intelligent',
        'Support multi-sources (AI, Budget, Sol, Debt)'
      ],
      endpoints: {
        list: 'GET /api/notifications/',
        unread: 'GET /api/notifications/unread',
        stats: 'GET /api/notifications/stats',
        byPriority: 'GET /api/notifications/priority/:priority',
        details: 'GET /api/notifications/:id',
        markAllRead: 'PUT /api/notifications/read-all',
        markAsRead: 'PUT /api/notifications/:id/read',
        markAsActed: 'PUT /api/notifications/:id/acted',
        deleteRead: 'DELETE /api/notifications/read',
        dismiss: 'DELETE /api/notifications/:id',
        preferences: 'GET/PUT /api/notifications/preferences',
        test: 'POST /api/notifications/test'
      },
      rateLimits: {
        read: '100 requests / minute',
        actions: '30 requests / minute',
        preferences: '10 requests / 15 minutes',
        test: '10 requests / hour'
      },
      sources: [
        'ai_advice', 'ai_alert', 'budget_alert', 'budget_overspending',
        'sol_reminder', 'sol_round', 'sol_payment', 'debt_reminder',
        'debt_overdue', 'investment_milestone', 'system', 'other'
      ],
      priorities: ['low', 'medium', 'high', 'urgent'],
      statuses: ['pending', 'sent', 'delivered', 'read', 'acted', 'dismissed', 'failed']
    },
    timestamp: new Date().toISOString()
  });
});

/**
 * @route   GET /api/notifications/health
 * @desc    Health check du service notifications
 * @access  Public
 */
router.get('/health', async (req, res) => {
  try {
    const Notification = require('../models/Notification');
    const stats = {
      totalNotifications: await Notification.estimatedDocumentCount(),
      pendingNotifications: await Notification.countDocuments({ status: 'pending' }),
      timestamp: new Date().toISOString()
    };

    res.status(200).json({
      success: true,
      status: 'healthy',
      data: {
        service: 'notifications',
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
      message: 'Service notifications temporairement indisponible'
    });
  }
});

// ===================================================================
// GESTION D'ERREURS
// ===================================================================

/**
 * Middleware de gestion d'erreurs pour routes notifications
 */
router.use((error, req, res, next) => {
  console.error('❌ Erreur route notifications:', {
    method: req.method,
    url: req.originalUrl,
    userId: req.user?.userId,
    error: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });

  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Erreur serveur lors du traitement de la requête notifications',
    error: process.env.NODE_ENV === 'development' ? {
      stack: error.stack,
      name: error.name
    } : undefined,
    timestamp: new Date().toISOString()
  });
});

// Export du router
module.exports = router;

/**
 * ===================================================================
 * DOCUMENTATION TECHNIQUE ROUTES NOTIFICATIONS
 * ===================================================================
 * 
 * Architecture :
 * - 14 endpoints REST complets
 * - Validation centralisée avec validation.js
 * - Rate limiting adapté par type d'opération (4 niveaux)
 * - Middleware auth systématique
 * - Documentation OpenAPI inline détaillée
 * 
 * Sécurité :
 * - Authentification JWT obligatoire
 * - Validation Joi centralisée pour toutes les entrées
 * - Rate limiting anti-spam intelligent
 * - Vérification ownership dans controller
 * - Protection contre les abus
 * 
 * Rate Limiting :
 * - Lecture : 100/min (généreux pour UX)
 * - Actions : 30/min (modéré pour actions)
 * - Préférences : 10/15min (restrictif pour sécurité)
 * - Tests : 10/heure (très restrictif, dev only)
 * 
 * Endpoints avec Validation :
 * 1. GET /api/notifications/ - validate('notification', 'filter', 'query') ✅
 * 2. GET /api/notifications/unread - validate('notification', 'unread', 'query') ✅
 * 3. GET /api/notifications/priority/:priority - validate('notification', 'priority', 'params') ✅
 * 4. GET /api/notifications/:id - validateObjectId('id') ✅
 * 5. PUT /api/notifications/:id/read - validateObjectId('id') ✅
 * 6. PUT /api/notifications/:id/acted - validateObjectId('id') ✅
 * 7. DELETE /api/notifications/:id - validateObjectId('id') ✅
 * 8. PUT /api/notifications/preferences - validate('notification', 'updatePreferences') ✅
 * 9. POST /api/notifications/test - validate('notification', 'test') ✅
 * 10-14. Pas de validation nécessaire (stats, read-all, delete-read, get-preferences)
 * 
 * Intégration :
 * - Connecté à NotificationController
 * - Prêt pour activation dans app.js
 * - Compatible avec système auth existant
 * - Extensible pour WebSocket futur
 * - Intégré avec tous les modules (AI, Budget, Sol, Debt)
 * 
 * Tests Prioritaires :
 * - CRUD notifications complet
 * - Filtrage et pagination
 * - Actions (read, acted, dismiss)
 * - Préférences utilisateur
 * - Statistics et analytics
 * - Rate limiting tous niveaux
 * ===================================================================
 */