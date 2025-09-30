// src/routes/debts.js
// Routes pour gestion dettes et créances - FinApp Haiti
// Integration complète avec validation.js centralisée

const express = require('express');
const router = express.Router();

// Import validation centralisée
const { validate, validateObjectId } = require('../middleware/validation');

// Import controllers et middleware
const DebtController = require('../controllers/debtController');
const { authenticate } = require('../middleware/auth');

/**
 * ===================================================================
 * ROUTES DEBTS/LOANS - FINAPP HAITI
 * ===================================================================
 * 
 * Architecture :
 * - Gestion complète dettes et créances
 * - Validation centralisée avec validation.js
 * - Intégrations notifications automatiques
 * - Suivi paiements et rappels
 * - Analytics et résumés financiers
 * 
 * Sécurité :
 * - Authentification obligatoire pour toutes les routes
 * - Validation Joi centralisée pour toutes les entrées
 * - Protection ownership (utilisateur propriétaire uniquement)
 * - Middleware de gestion d'erreurs
 * 
 * Features Haiti :
 * - Support multi-devises HTG/USD
 * - Gestion priorités adaptées au contexte local
 * - Intégration système bancaire haïtien
 * - Notifications intelligentes automatiques
 */

// Middleware auth pour toutes les routes
router.use(authenticate);

// ===================================================================
// ROUTES CRUD DETTES/CRÉANCES
// ===================================================================

/**
 * @route   POST /api/debts
 * @desc    Créer une nouvelle dette/créance
 * @access  Private (utilisateur authentifié)
 * @middleware authenticate + validation
 * 
 * Body: {
 *   type: "debt"|"loan",
 *   contact: { name, phone?, email? },
 *   amount: number,
 *   currency: "HTG"|"USD",
 *   description: string,
 *   dueDate?: ISO8601 date,
 *   priority?: "low"|"medium"|"high"|"urgent",
 *   paymentTerms?: { installments, frequency },
 *   notes?: string
 * }
 */
router.post(
  '/',
  validate('debt', 'create'),
  DebtController.createDebt
);

/**
 * @route   GET /api/debts
 * @desc    Liste toutes les dettes/créances de l'utilisateur
 * @access  Private (utilisateur authentifié)
 * @middleware authenticate + validation
 * 
 * Query: {
 *   type?: "debt"|"loan",
 *   status?: "active"|"partially_paid"|"paid"|"overdue"|"cancelled",
 *   priority?: "low"|"medium"|"high"|"urgent",
 *   includeArchived?: boolean
 * }
 */
router.get(
  '/',
  validate('debt', 'filter', 'query'),
  DebtController.getDebts
);

/**
 * @route   GET /api/debts/summary
 * @desc    Résumé financier des dettes/créances
 * @access  Private (utilisateur authentifié)
 * @middleware authenticate
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     totalDebts: { amount, currency, count },
 *     totalLoans: { amount, currency, count },
 *     netPosition: { amount, currency },
 *     byStatus: { ... },
 *     byPriority: { ... },
 *     upcomingPayments: [...],
 *     alerts: [...]
 *   }
 * }
 */
router.get('/summary', DebtController.getSummary);

/**
 * @route   GET /api/debts/:id
 * @desc    Détails d'une dette/créance spécifique
 * @access  Private (propriétaire uniquement)
 * @middleware authenticate + validation
 */
router.get(
  '/:id',
  validateObjectId('id'),
  DebtController.getDebtById
);

/**
 * @route   PUT /api/debts/:id
 * @desc    Modifier une dette/créance
 * @access  Private (propriétaire uniquement)
 * @middleware authenticate + validation
 * 
 * Body: {
 *   amount?: number,
 *   description?: string,
 *   dueDate?: ISO8601 date,
 *   priority?: "low"|"medium"|"high"|"urgent",
 *   status?: "active"|"partially_paid"|"paid"|"overdue"|"cancelled",
 *   notes?: string
 * }
 */
router.put(
  '/:id',
  validateObjectId('id'),
  validate('debt', 'update'),
  DebtController.updateDebt
);

/**
 * @route   DELETE /api/debts/:id
 * @desc    Supprimer une dette/créance
 * @access  Private (propriétaire uniquement)
 * @middleware authenticate + validation
 */
router.delete(
  '/:id',
  validateObjectId('id'),
  DebtController.deleteDebt
);

// ===================================================================
// ROUTES PAIEMENTS
// ===================================================================

/**
 * @route   POST /api/debts/:id/payment
 * @desc    Enregistrer un paiement sur une dette/créance
 * @access  Private (propriétaire uniquement)
 * @middleware authenticate + validation
 * 
 * Body: {
 *   amount: number,
 *   paymentDate?: ISO8601 date,
 *   paymentMethod?: string,
 *   transactionReference?: ObjectId,
 *   notes?: string
 * }
 */
router.post(
  '/:id/payment',
  validateObjectId('id'),
  validate('debt', 'recordPayment'),
  DebtController.addPayment
);

/**
 * @route   GET /api/debts/:id/payments
 * @desc    Historique des paiements d'une dette/créance
 * @access  Private (propriétaire uniquement)
 * @middleware authenticate + validation
 */
router.get(
  '/:id/payments',
  validateObjectId('id'),
  DebtController.getPayments
);

// ===================================================================
// ROUTES RAPPELS ET NOTIFICATIONS
// ===================================================================

/**
 * @route   POST /api/debts/:id/reminder
 * @desc    Créer un rappel manuel pour une dette/créance
 * @access  Private (propriétaire uniquement)
 * @middleware authenticate + validation
 * 
 * Body: {
 *   reminderDate: ISO8601 date,
 *   message?: string,
 *   sendNotification?: boolean
 * }
 */
router.post(
  '/:id/reminder',
  validateObjectId('id'),
  validate('debt', 'createReminder'),
  DebtController.createReminder
);

/**
 * @route   GET /api/debts/overdue
 * @desc    Liste toutes les dettes/créances en retard
 * @access  Private (utilisateur authentifié)
 * @middleware authenticate
 */
router.get('/overdue', DebtController.getOverdueDebts);

/**
 * @route   GET /api/debts/upcoming
 * @desc    Liste des paiements à venir (prochaines 30 jours)
 * @access  Private (utilisateur authentifié)
 * @middleware authenticate + validation
 * 
 * Query: {
 *   days?: number (default 30)
 * }
 */
router.get(
  '/upcoming',
  validate('debt', 'upcoming', 'query'),
  DebtController.getUpcomingDebts
);

// ===================================================================
// ROUTES UTILITAIRES
// ===================================================================

/**
 * @route   GET /api/debts/info
 * @desc    Informations sur l'API debts
 * @access  Public
 */
router.get('/info', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      version: '1.0.0',
      description: 'API Dettes et Créances - FinApp Haiti',
      features: [
        'Gestion complète dettes et créances',
        'Suivi paiements avec historique détaillé',
        'Rappels automatiques intelligents',
        'Support multi-devises HTG/USD',
        'Analytics et résumés financiers',
        'Intégration notifications automatiques',
        'Gestion priorités et échéances'
      ],
      endpoints: {
        create: 'POST /api/debts/',
        list: 'GET /api/debts/',
        summary: 'GET /api/debts/summary',
        details: 'GET /api/debts/:id',
        update: 'PUT /api/debts/:id',
        delete: 'DELETE /api/debts/:id',
        payment: 'POST /api/debts/:id/payment',
        payments: 'GET /api/debts/:id/payments',
        reminder: 'POST /api/debts/:id/reminder',
        overdue: 'GET /api/debts/overdue',
        upcoming: 'GET /api/debts/upcoming'
      },
      validations: {
        types: ['debt', 'loan'],
        currencies: ['HTG', 'USD'],
        statuses: ['active', 'partially_paid', 'paid', 'overdue', 'cancelled'],
        priorities: ['low', 'medium', 'high', 'urgent']
      }
    },
    timestamp: new Date().toISOString()
  });
});

/**
 * @route   GET /api/debts/health
 * @desc    Health check du service debts
 * @access  Public
 */
router.get('/health', async (req, res) => {
  try {
    const Debt = require('../models/Debt');
    const stats = {
      totalDebts: await Debt.estimatedDocumentCount(),
      activeDebts: await Debt.countDocuments({ status: 'active' }),
      timestamp: new Date().toISOString()
    };

    res.status(200).json({
      success: true,
      status: 'healthy',
      data: {
        service: 'debts',
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
      message: 'Service debts temporairement indisponible'
    });
  }
});

// ===================================================================
// GESTION D'ERREURS
// ===================================================================

/**
 * Middleware de gestion d'erreurs pour routes debts
 */
router.use((error, req, res, next) => {
  console.error('❌ Erreur route debts:', {
    method: req.method,
    url: req.originalUrl,
    userId: req.user?.userId,
    error: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });

  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Erreur serveur lors du traitement de la requête debts',
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
 * DOCUMENTATION TECHNIQUE ROUTES DEBTS
 * ===================================================================
 * 
 * Architecture :
 * - 11+ endpoints dettes/créances
 * - Validation centralisée avec validation.js
 * - Intégrations notifications automatiques
 * - Gestion paiements avec historique
 * - Analytics et résumés financiers
 * 
 * Sécurité :
 * - Authentification obligatoire
 * - Validation Joi centralisée pour toutes les entrées
 * - Protection ownership (propriétaire uniquement)
 * - Logging des erreurs pour monitoring
 * 
 * Performance :
 * - Queries MongoDB optimisées
 * - Calculs efficaces des statistiques
 * - Cache-ready headers
 * - Monitoring avec health checks
 * 
 * Features Haiti :
 * - Support multi-devises HTG/USD
 * - Gestion priorités adaptées contexte local
 * - Intégration système bancaire haïtien
 * - Notifications intelligentes automatiques
 * - Analytics comportementaux
 * 
 * Endpoints avec Validation :
 * 1. POST /api/debts/ - validate('debt', 'create') ✅
 * 2. GET /api/debts/ - validate('debt', 'filter', 'query') ✅
 * 3. GET /api/debts/:id - validateObjectId('id') ✅
 * 4. PUT /api/debts/:id - validateObjectId + validate('debt', 'update') ✅
 * 5. DELETE /api/debts/:id - validateObjectId('id') ✅
 * 6. POST /api/debts/:id/payment - validateObjectId + validate('debt', 'recordPayment') ✅
 * 7. GET /api/debts/:id/payments - validateObjectId('id') ✅
 * 8. POST /api/debts/:id/reminder - validateObjectId + validate('debt', 'createReminder') ✅
 * 9. GET /api/debts/upcoming - validate('debt', 'upcoming', 'query') ✅
 * 10. GET /api/debts/summary - Pas de validation nécessaire
 * 11. GET /api/debts/overdue - Pas de validation nécessaire
 * 
 * Tests Prioritaires :
 * - CRUD dettes/créances complet
 * - Enregistrement paiements avec calculs
 * - Rappels automatiques et manuels
 * - Analytics et résumés financiers
 * - Intégrations notifications
 * ===================================================================
 */