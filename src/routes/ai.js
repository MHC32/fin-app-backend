// src/routes/ai.js
// Routes pour endpoints Intelligence Artificielle

const express = require('express');
const router = express.Router();
const AIController = require('../controllers/aiController');
const { authenticate } = require('../middleware/auth');
const { body } = require('express-validator');

// ============ ROUTES PUBLIQUES (si besoin) ============

/**
 * GET /api/ai/status
 * Statut du système IA (pas besoin d'auth pour monitoring)
 */
router.get('/status', AIController.getStatus);

// ============ ROUTES PROTÉGÉES (Authentication requise) ============

// Middleware auth pour toutes les routes suivantes
router.use(authenticate);

/**
 * GET /api/ai/analysis/personal
 * Analyse complète personnelle
 * Query params: ?days=90
 */
router.get('/analysis/personal', AIController.getPersonalAnalysis);

/**
 * GET /api/ai/advice/personal
 * Conseils personnalisés basés sur données réelles
 * Query params: ?days=90
 */
router.get('/advice/personal', AIController.getPersonalAdvice);

/**
 * GET /api/ai/anomalies
 * Détection anomalies dans dépenses
 * Query params: ?days=90
 */
router.get('/anomalies', AIController.getAnomalies);

/**
 * POST /api/ai/classify
 * Classification automatique transaction
 * Body: { description, amount, currency }
 */
router.post(
  '/classify',
  [
    body('description')
      .notEmpty()
      .withMessage('Description requise')
      .trim(),
    body('amount')
      .isNumeric()
      .withMessage('Montant doit être un nombre')
      .notEmpty()
      .withMessage('Montant requis'),
    body('currency')
      .optional()
      .isIn(['HTG', 'USD'])
      .withMessage('Devise doit être HTG ou USD')
  ],
  AIController.classifyTransaction
);

/**
 * GET /api/ai/predictions
 * Prédictions dépenses futures
 * Query params: ?type=monthly ou ?type=category&category=transport
 */
router.get('/predictions', AIController.getPredictions);

/**
 * GET /api/ai/health
 * Score santé financière
 */
router.get('/health', AIController.getHealthScore);

/**
 * GET /api/ai/habits
 * Habitudes financières détectées
 * Query params: ?days=90
 */
router.get('/habits', AIController.getHabits);

/**
 * POST /api/ai/anomaly/check
 * Vérifier si montant est anormal
 * Body: { amount, category? }
 */
router.post(
  '/anomaly/check',
  [
    body('amount')
      .isNumeric()
      .withMessage('Montant doit être un nombre')
      .notEmpty()
      .withMessage('Montant requis'),
    body('category')
      .optional()
      .isString()
      .trim()
  ],
  AIController.checkAnomaly
);

/**
 * GET /api/ai/similar-users
 * Utilisateurs avec patterns similaires
 * Query params: ?limit=5
 */
router.get('/similar-users', AIController.getSimilarUsers);

/**
 * GET /api/ai/patterns/temporal
 * Patterns temporels (heures, jours)
 * Query params: ?days=90
 */
router.get('/patterns/temporal', AIController.getTemporalPatterns);

/**
 * GET /api/ai/patterns/location
 * Patterns de localisation
 * Query params: ?days=90
 */
router.get('/patterns/location', AIController.getLocationPatterns);

module.exports = router;