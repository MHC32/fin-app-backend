// src/routes/ai.js
// Routes pour endpoints Intelligence Artificielle - VERSION COMPLÈTE
// Intégration: HabitAnalysis + ML + AdviceEngine + PredictionService

const express = require('express');
const router = express.Router();
const AIController = require('../controllers/aiController');
const { authenticate } = require('../middleware/auth');
const { body, query } = require('express-validator');

// ===================================================================
// ROUTES PUBLIQUES
// ===================================================================

/**
 * GET /api/ai/status
 * Statut du système IA (monitoring public)
 */
router.get('/status', AIController.getStatus);

// ===================================================================
// MIDDLEWARE AUTHENTICATION
// ===================================================================

// Toutes les routes suivantes nécessitent authentication
router.use(authenticate);

// ===================================================================
// 1. ANALYSES PERSONNELLES
// ===================================================================

/**
 * GET /api/ai/analysis/personal
 * Analyse complète personnelle
 * Query: ?days=90
 */
router.get('/analysis/personal', 
  [
    query('days')
      .optional()
      .isInt({ min: 7, max: 365 })
      .withMessage('Days doit être entre 7 et 365')
  ],
  AIController.getPersonalAnalysis
);

/**
 * GET /api/ai/anomalies
 * Détection anomalies dans dépenses
 * Query: ?days=90
 */
router.get('/anomalies',
  [
    query('days')
      .optional()
      .isInt({ min: 7, max: 365 })
      .withMessage('Days doit être entre 7 et 365')
  ],
  AIController.getAnomalies
);

/**
 * GET /api/ai/health
 * Score de santé financière
 */
router.get('/health', AIController.getHealthScore);

/**
 * GET /api/ai/habits
 * Habitudes financières détectées
 * Query: ?days=90
 */
router.get('/habits',
  [
    query('days')
      .optional()
      .isInt({ min: 7, max: 365 })
      .withMessage('Days doit être entre 7 et 365')
  ],
  AIController.getHabits
);

/**
 * GET /api/ai/patterns/temporal
 * Patterns temporels (heures, jours, mois)
 * Query: ?days=90
 */
router.get('/patterns/temporal',
  [
    query('days')
      .optional()
      .isInt({ min: 7, max: 365 })
      .withMessage('Days doit être entre 7 et 365')
  ],
  AIController.getTemporalPatterns
);

/**
 * GET /api/ai/patterns/location
 * Patterns de localisation
 * Query: ?days=90
 */
router.get('/patterns/location',
  [
    query('days')
      .optional()
      .isInt({ min: 7, max: 365 })
      .withMessage('Days doit être entre 7 et 365')
  ],
  AIController.getLocationPatterns
);

// ===================================================================
// 2. CONSEILS INTELLIGENTS (AdviceEngine)
// ===================================================================

/**
 * POST /api/ai/advice/generate
 * Générer conseils complets personnalisés
 * Query: ?days=90
 */
router.post('/advice/generate',
  [
    query('days')
      .optional()
      .isInt({ min: 30, max: 365 })
      .withMessage('Days doit être entre 30 et 365')
  ],
  AIController.generateAdvice
);

/**
 * GET /api/ai/advice/optimization-report
 * Rapport d'optimisation financière complet
 */
router.get('/advice/optimization-report', AIController.getOptimizationReport);

/**
 * GET /api/ai/advice/currency-strategy
 * Stratégie optimisation multi-devises HTG/USD
 */
router.get('/advice/currency-strategy', AIController.getCurrencyStrategy);

/**
 * GET /api/ai/advice/peer-comparison
 * Comparaison avec utilisateurs similaires
 */
router.get('/advice/peer-comparison', AIController.getPeerComparison);

/**
 * GET /api/ai/advice/personal
 * Conseils personnalisés simples
 * Query: ?days=90
 */
router.get('/advice/personal',
  [
    query('days')
      .optional()
      .isInt({ min: 7, max: 365 })
      .withMessage('Days doit être entre 7 et 365')
  ],
  AIController.getPersonalAdvice
);

// ===================================================================
// 3. PRÉDICTIONS AVANCÉES (PredictionService)
// ===================================================================

/**
 * GET /api/ai/predictions/expenses
 * Prédire dépenses futures (séries temporelles)
 * Query: ?months=1
 */
router.get('/predictions/expenses',
  [
    query('months')
      .optional()
      .isInt({ min: 1, max: 12 })
      .withMessage('Months doit être entre 1 et 12')
  ],
  AIController.predictExpenses
);

/**
 * GET /api/ai/predictions/income
 * Prédire revenus futurs
 * Query: ?months=3
 */
router.get('/predictions/income',
  [
    query('months')
      .optional()
      .isInt({ min: 1, max: 12 })
      .withMessage('Months doit être entre 1 et 12')
  ],
  AIController.predictIncome
);

/**
 * GET /api/ai/predictions/budget-risks
 * Analyser risques dépassement budgets
 */
router.get('/predictions/budget-risks', AIController.predictBudgetRisks);

/**
 * GET /api/ai/predictions/savings
 * Calculer capacité d'épargne optimale
 */
router.get('/predictions/savings', AIController.predictSavings);

/**
 * POST /api/ai/predictions/sol-timing
 * Analyser meilleur moment pour rejoindre sol
 * Body: { amount, frequency, participants }
 */
router.post('/predictions/sol-timing',
  [
    body('amount')
      .isNumeric()
      .withMessage('Amount doit être un nombre')
      .notEmpty()
      .withMessage('Amount requis'),
    body('frequency')
      .isIn(['weekly', 'biweekly', 'monthly'])
      .withMessage('Frequency doit être: weekly, biweekly ou monthly')
      .notEmpty()
      .withMessage('Frequency requis'),
    body('participants')
      .isInt({ min: 3, max: 50 })
      .withMessage('Participants doit être entre 3 et 50')
      .notEmpty()
      .withMessage('Participants requis')
  ],
  AIController.predictSolTiming
);

/**
 * POST /api/ai/predictions/debt-impact
 * Analyser impact d'une nouvelle dette
 * Body: { amount, interestRate?, duration, monthlyPayment }
 */
router.post('/predictions/debt-impact',
  [
    body('amount')
      .isNumeric()
      .withMessage('Amount doit être un nombre')
      .notEmpty()
      .withMessage('Amount requis'),
    body('interestRate')
      .optional()
      .isNumeric()
      .withMessage('InterestRate doit être un nombre'),
    body('duration')
      .isInt({ min: 1, max: 60 })
      .withMessage('Duration doit être entre 1 et 60 mois')
      .notEmpty()
      .withMessage('Duration requis'),
    body('monthlyPayment')
      .isNumeric()
      .withMessage('MonthlyPayment doit être un nombre')
      .notEmpty()
      .withMessage('MonthlyPayment requis')
  ],
  AIController.predictDebtImpact
);

// ===================================================================
// 4. MACHINE LEARNING
// ===================================================================

/**
 * POST /api/ai/classify
 * Classification automatique transaction
 * Body: { description, amount, currency? }
 */
router.post('/classify',
  [
    body('description')
      .notEmpty()
      .withMessage('Description requise')
      .trim()
      .isLength({ min: 2, max: 255 })
      .withMessage('Description doit contenir entre 2 et 255 caractères'),
    body('amount')
      .isNumeric()
      .withMessage('Amount doit être un nombre')
      .notEmpty()
      .withMessage('Amount requis'),
    body('currency')
      .optional()
      .isIn(['HTG', 'USD'])
      .withMessage('Currency doit être HTG ou USD')
  ],
  AIController.classifyTransaction
);

/**
 * GET /api/ai/predictions
 * Prédictions ML (méthode existante)
 * Query: ?type=monthly ou ?type=category&category=transport
 */
router.get('/predictions',
  [
    query('type')
      .optional()
      .isIn(['monthly', 'category'])
      .withMessage('Type doit être: monthly ou category'),
    query('category')
      .optional()
      .isString()
      .trim()
  ],
  AIController.getPredictions
);

/**
 * POST /api/ai/anomaly/check
 * Vérifier si montant est anormal
 * Body: { amount, category? }
 */
router.post('/anomaly/check',
  [
    body('amount')
      .isNumeric()
      .withMessage('Amount doit être un nombre')
      .notEmpty()
      .withMessage('Amount requis'),
    body('category')
      .optional()
      .isString()
      .trim()
  ],
  AIController.checkAnomaly
);

/**
 * GET /api/ai/similar-users
 * Trouver utilisateurs avec patterns similaires
 * Query: ?limit=5
 */
router.get('/similar-users',
  [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 20 })
      .withMessage('Limit doit être entre 1 et 20')
  ],
  AIController.getSimilarUsers
);

/**
 * POST /api/ai/models/train
 * Entraîner modèle ML personnalisé
 * Body: { modelType }
 */
router.post('/models/train',
  [
    body('modelType')
      .isIn([
        'spending_prediction',
        'income_forecast',
        'budget_optimization',
        'sol_recommendation',
        'category_classification',
        'anomaly_detection',
        'savings_potential',
        'debt_risk_assessment',
        'investment_scoring'
      ])
      .withMessage('Type de modèle invalide')
      .notEmpty()
      .withMessage('ModelType requis')
  ],
  AIController.trainModel
);

// ===================================================================
// ROUTE INFO - Documentation endpoints
// ===================================================================

/**
 * GET /api/ai
 * Documentation des endpoints IA disponibles
 */
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'API Intelligence Artificielle - FinApp Haiti 🇭🇹 🤖',
    version: '2.0.0',
    description: 'Système IA complet avec analyses, conseils personnalisés, prédictions avancées et ML',
    documentation: {
      totalEndpoints: 25,
      categories: {
        analysis: 6,
        advice: 5,
        predictions: 6,
        ml: 5,
        system: 1
      }
    },
    endpoints: {
      system: {
        status: {
          method: 'GET',
          path: '/api/ai/status',
          auth: false,
          description: 'Statut système IA'
        },
        info: {
          method: 'GET',
          path: '/api/ai',
          auth: false,
          description: 'Documentation endpoints'
        }
      },
      analysis: {
        personal: {
          method: 'GET',
          path: '/api/ai/analysis/personal',
          auth: true,
          query: '?days=90',
          description: 'Analyse complète personnelle'
        },
        anomalies: {
          method: 'GET',
          path: '/api/ai/anomalies',
          auth: true,
          query: '?days=90',
          description: 'Détection anomalies dépenses'
        },
        health: {
          method: 'GET',
          path: '/api/ai/health',
          auth: true,
          description: 'Score santé financière'
        },
        habits: {
          method: 'GET',
          path: '/api/ai/habits',
          auth: true,
          query: '?days=90',
          description: 'Habitudes financières détectées'
        },
        temporalPatterns: {
          method: 'GET',
          path: '/api/ai/patterns/temporal',
          auth: true,
          query: '?days=90',
          description: 'Patterns temporels (heures, jours)'
        },
        locationPatterns: {
          method: 'GET',
          path: '/api/ai/patterns/location',
          auth: true,
          query: '?days=90',
          description: 'Patterns de localisation'
        }
      },
      advice: {
        generate: {
          method: 'POST',
          path: '/api/ai/advice/generate',
          auth: true,
          query: '?days=90',
          description: 'Générer conseils complets personnalisés (AdviceEngine)'
        },
        optimizationReport: {
          method: 'GET',
          path: '/api/ai/advice/optimization-report',
          auth: true,
          description: 'Rapport optimisation financière complet'
        },
        currencyStrategy: {
          method: 'GET',
          path: '/api/ai/advice/currency-strategy',
          auth: true,
          description: 'Stratégie optimisation HTG/USD'
        },
        peerComparison: {
          method: 'GET',
          path: '/api/ai/advice/peer-comparison',
          auth: true,
          description: 'Comparaison avec utilisateurs similaires'
        },
        personal: {
          method: 'GET',
          path: '/api/ai/advice/personal',
          auth: true,
          query: '?days=90',
          description: 'Conseils personnalisés simples'
        }
      },
      predictions: {
        expenses: {
          method: 'GET',
          path: '/api/ai/predictions/expenses',
          auth: true,
          query: '?months=1',
          description: 'Prédire dépenses futures (séries temporelles)'
        },
        income: {
          method: 'GET',
          path: '/api/ai/predictions/income',
          auth: true,
          query: '?months=3',
          description: 'Prédire revenus futurs'
        },
        budgetRisks: {
          method: 'GET',
          path: '/api/ai/predictions/budget-risks',
          auth: true,
          description: 'Analyser risques dépassement budgets'
        },
        savings: {
          method: 'GET',
          path: '/api/ai/predictions/savings',
          auth: true,
          description: 'Calculer capacité épargne optimale'
        },
        solTiming: {
          method: 'POST',
          path: '/api/ai/predictions/sol-timing',
          auth: true,
          body: '{ amount, frequency, participants }',
          description: 'Analyser meilleur moment rejoindre sol'
        },
        debtImpact: {
          method: 'POST',
          path: '/api/ai/predictions/debt-impact',
          auth: true,
          body: '{ amount, interestRate?, duration, monthlyPayment }',
          description: 'Analyser impact nouvelle dette'
        }
      },
      ml: {
        classify: {
          method: 'POST',
          path: '/api/ai/classify',
          auth: true,
          body: '{ description, amount, currency? }',
          description: 'Classification automatique transaction'
        },
        predictions: {
          method: 'GET',
          path: '/api/ai/predictions',
          auth: true,
          query: '?type=monthly ou ?type=category&category=transport',
          description: 'Prédictions ML basiques'
        },
        checkAnomaly: {
          method: 'POST',
          path: '/api/ai/anomaly/check',
          auth: true,
          body: '{ amount, category? }',
          description: 'Vérifier si montant anormal'
        },
        similarUsers: {
          method: 'GET',
          path: '/api/ai/similar-users',
          auth: true,
          query: '?limit=5',
          description: 'Trouver utilisateurs similaires'
        },
        trainModel: {
          method: 'POST',
          path: '/api/ai/models/train',
          auth: true,
          body: '{ modelType }',
          description: 'Entraîner modèle ML personnalisé'
        }
      }
    },
    features: {
      analysis: [
        '📊 Analyse patterns dépenses personnels',
        '🚨 Détection anomalies en temps réel',
        '❤️ Score santé financière dynamique',
        '🔄 Identification habitudes récurrentes',
        '⏰ Patterns temporels (jour, heure, mois)',
        '📍 Patterns localisation et géographiques'
      ],
      advice: [
        '💡 Conseils personnalisés contexte Haïti',
        '📋 Rapport optimisation financière complet',
        '💱 Stratégie multi-devises HTG/USD',
        '👥 Comparaison avec utilisateurs similaires',
        '🎯 Quick wins et actions prioritaires'
      ],
      predictions: [
        '📈 Prédictions dépenses futures (ML avancé)',
        '💰 Prévisions revenus avec patterns',
        '⚠️ Risques dépassement budgets proactifs',
        '💎 Capacité épargne optimale calculée',
        '🤝 Timing optimal pour rejoindre sols',
        '💳 Impact dettes avant engagement'
      ],
      ml: [
        '🤖 Classification automatique transactions',
        '🔍 Détection anomalies ML sophistiquée',
        '👥 Clustering utilisateurs similaires',
        '🎓 Entraînement modèles personnalisés',
        '📊 Prédictions catégories spécifiques'
      ]
    },
    contextHaiti: {
      specializations: [
        'Gestion multi-devises HTG/USD native',
        'Conseils tontines/sols traditionnelles',
        'Patterns transport (tap-taps, taxis)',
        'Alimentation (marchés vs supermarchés)',
        'Services (Digicel, Natcom, etc.)',
        'Négociation culturelle intégrée'
      ]
    },
    usage: {
      authentication: 'Bearer token dans header Authorization (sauf /status)',
      rateLimit: 'Consulter documentation rate limiting',
      errors: 'Format standard { success: false, error: "...", message: "..." }'
    },
    contact: {
      support: 'support@finapp-haiti.com',
      docs: 'https://docs.finapp-haiti.com/api/ai'
    }
  });
});

module.exports = router;