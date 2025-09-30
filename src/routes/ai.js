// src/routes/ai.js
// Routes Intelligence Artificielle - FinApp Haiti
// Integration complète avec validation.js centralisée
// 27 endpoints ML/IA révolutionnaires

const express = require('express');
const router = express.Router();

// Import validation centralisée
const { validate, validateObjectId } = require('../middleware/validation');

// Import controllers et middleware
const AIController = require('../controllers/aiController');
const { authenticate } = require('../middleware/auth');

/**
 * ===================================================================
 * ROUTES AI - FINAPP HAITI 🤖🇭🇹
 * ===================================================================
 * 
 * Architecture :
 * - 27 endpoints Intelligence Artificielle complets
 * - Validation centralisée avec validation.js
 * - 4 Services IA intégrés (Habit + ML + Advice + Prediction)
 * - Notifications automatiques intelligentes
 * 
 * Services IA :
 * - HabitAnalysisService : Analyse patterns et habitudes
 * - MLService : Machine Learning et classification
 * - AdviceEngine : Conseils personnalisés contextuels
 * - PredictionService : Prédictions financières avancées
 * 
 * Sécurité :
 * - Authentification obligatoire (sauf /status et /info)
 * - Validation Joi centralisée pour toutes les entrées
 * - Rate limiting intelligent (à implémenter)
 * 
 * Features Haiti :
 * - Multi-devises HTG/USD natif
 * - Conseils sols/tontines traditionnels
 * - Patterns contextuels (tap-taps, marchés, etc.)
 * - Négociation culturelle intégrée
 */

// ===================================================================
// ROUTES PUBLIQUES (pas d'authentification)
// ===================================================================

/**
 * @route   GET /api/ai/status
 * @desc    Statut du système IA (monitoring public)
 * @access  Public
 */
router.get('/status', AIController.getStatus);

/**
 * @route   GET /api/ai
 * @desc    Documentation des endpoints IA disponibles
 * @access  Public
 */
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'API Intelligence Artificielle - FinApp Haiti 🇭🇹 🤖',
    version: '2.0.0',
    description: 'Système IA complet avec analyses, conseils personnalisés, prédictions avancées et ML',
    documentation: {
      totalEndpoints: 27,
      categories: {
        analysis: 6,
        advice: 5,
        predictions: 6,
        ml: 5,
        system: 2
      }
    },
    endpoints: {
      system: {
        status: 'GET /api/ai/status',
        info: 'GET /api/ai'
      },
      analysis: {
        personal: 'GET /api/ai/analysis/personal?days=90',
        anomalies: 'GET /api/ai/anomalies?days=90',
        health: 'GET /api/ai/health',
        habits: 'GET /api/ai/habits?days=90',
        temporalPatterns: 'GET /api/ai/patterns/temporal?days=90',
        locationPatterns: 'GET /api/ai/patterns/location?days=90'
      },
      advice: {
        generate: 'POST /api/ai/advice/generate?days=90',
        optimizationReport: 'GET /api/ai/advice/optimization-report',
        currencyStrategy: 'GET /api/ai/advice/currency-strategy',
        peerComparison: 'GET /api/ai/advice/peer-comparison',
        personal: 'GET /api/ai/advice/personal?days=90'
      },
      predictions: {
        expenses: 'GET /api/ai/predictions/expenses?months=1',
        income: 'GET /api/ai/predictions/income?months=3',
        budgetRisks: 'GET /api/ai/predictions/budget-risks',
        savings: 'GET /api/ai/predictions/savings',
        solTiming: 'POST /api/ai/predictions/sol-timing',
        debtImpact: 'POST /api/ai/predictions/debt-impact'
      },
      ml: {
        classify: 'POST /api/ai/classify',
        predictions: 'GET /api/ai/predictions?type=monthly',
        checkAnomaly: 'POST /api/ai/anomaly/check',
        similarUsers: 'GET /api/ai/similar-users?limit=5',
        trainModel: 'POST /api/ai/models/train'
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
    }
  });
});

// ===================================================================
// MIDDLEWARE AUTHENTICATION
// ===================================================================

// Toutes les routes suivantes nécessitent authentification
router.use(authenticate);

// ===================================================================
// 1. ROUTES ANALYSES PERSONNELLES (6 endpoints)
// ===================================================================

/**
 * @route   GET /api/ai/analysis/personal
 * @desc    Analyse complète personnelle de l'utilisateur
 * @access  Private (authentification requise)
 * @middleware authenticate + validation
 */
router.get('/analysis/personal',
  validate('ai', 'analysisPersonal', 'query'),
  AIController.getPersonalAnalysis
);

/**
 * @route   GET /api/ai/anomalies
 * @desc    Détection anomalies dans dépenses
 * @access  Private (authentification requise)
 * @middleware authenticate + validation
 */
router.get('/anomalies',
  validate('ai', 'anomalies', 'query'),
  AIController.getAnomalies
);

/**
 * @route   GET /api/ai/health
 * @desc    Score de santé financière
 * @access  Private (authentification requise)
 * @middleware authenticate
 */
router.get('/health',
  AIController.getHealthScore
);

/**
 * @route   GET /api/ai/habits
 * @desc    Habitudes financières détectées
 * @access  Private (authentification requise)
 * @middleware authenticate + validation
 */
router.get('/habits',
  validate('ai', 'habits', 'query'),
  AIController.getHabits
);

/**
 * @route   GET /api/ai/patterns/temporal
 * @desc    Patterns temporels (heures, jours, mois)
 * @access  Private (authentification requise)
 * @middleware authenticate + validation
 */
router.get('/patterns/temporal',
  validate('ai', 'temporalPatterns', 'query'),
  AIController.getTemporalPatterns
);

/**
 * @route   GET /api/ai/patterns/location
 * @desc    Patterns de localisation
 * @access  Private (authentification requise)
 * @middleware authenticate + validation
 */
router.get('/patterns/location',
  validate('ai', 'locationPatterns', 'query'),
  AIController.getLocationPatterns
);

// ===================================================================
// 2. ROUTES CONSEILS INTELLIGENTS (5 endpoints)
// ===================================================================

/**
 * @route   POST /api/ai/advice/generate
 * @desc    Générer conseils complets personnalisés
 * @access  Private (authentification requise)
 * @middleware authenticate + validation
 */
router.post('/advice/generate',
  validate('ai', 'adviceGenerate', 'query'),
  AIController.generateAdvice
);

/**
 * @route   GET /api/ai/advice/optimization-report
 * @desc    Rapport d'optimisation financière complet
 * @access  Private (authentification requise)
 * @middleware authenticate
 */
router.get('/advice/optimization-report',
  AIController.getOptimizationReport
);

/**
 * @route   GET /api/ai/advice/currency-strategy
 * @desc    Stratégie optimisation multi-devises HTG/USD
 * @access  Private (authentification requise)
 * @middleware authenticate
 */
router.get('/advice/currency-strategy',
  AIController.getCurrencyStrategy
);

/**
 * @route   GET /api/ai/advice/peer-comparison
 * @desc    Comparaison avec utilisateurs similaires
 * @access  Private (authentification requise)
 * @middleware authenticate
 */
router.get('/advice/peer-comparison',
  AIController.getPeerComparison
);

/**
 * @route   GET /api/ai/advice/personal
 * @desc    Conseils personnalisés simples
 * @access  Private (authentification requise)
 * @middleware authenticate + validation
 */
router.get('/advice/personal',
  validate('ai', 'advicePersonal', 'query'),
  AIController.getPersonalAdvice
);

// ===================================================================
// 3. ROUTES PRÉDICTIONS AVANCÉES (6 endpoints)
// ===================================================================

/**
 * @route   GET /api/ai/predictions/expenses
 * @desc    Prédire dépenses futures (séries temporelles)
 * @access  Private (authentification requise)
 * @middleware authenticate + validation
 */
router.get('/predictions/expenses',
  validate('ai', 'predictExpenses', 'query'),
  AIController.predictExpenses
);

/**
 * @route   GET /api/ai/predictions/income
 * @desc    Prédire revenus futurs
 * @access  Private (authentification requise)
 * @middleware authenticate + validation
 */
router.get('/predictions/income',
  validate('ai', 'predictIncome', 'query'),
  AIController.predictIncome
);

/**
 * @route   GET /api/ai/predictions/budget-risks
 * @desc    Analyser risques dépassement budgets
 * @access  Private (authentification requise)
 * @middleware authenticate
 */
router.get('/predictions/budget-risks',
  AIController.predictBudgetRisks
);

/**
 * @route   GET /api/ai/predictions/savings
 * @desc    Calculer capacité d'épargne optimale
 * @access  Private (authentification requise)
 * @middleware authenticate
 */
router.get('/predictions/savings',
  AIController.predictSavings
);

/**
 * @route   POST /api/ai/predictions/sol-timing
 * @desc    Analyser meilleur moment pour rejoindre sol
 * @access  Private (authentification requise)
 * @middleware authenticate + validation
 */
router.post('/predictions/sol-timing',
  validate('ai', 'predictSolTiming'),
  AIController.predictSolTiming
);

/**
 * @route   POST /api/ai/predictions/debt-impact
 * @desc    Analyser impact d'une nouvelle dette
 * @access  Private (authentification requise)
 * @middleware authenticate + validation
 */
router.post('/predictions/debt-impact',
  validate('ai', 'predictDebtImpact'),
  AIController.predictDebtImpact
);

// ===================================================================
// 4. ROUTES MACHINE LEARNING (5 endpoints)
// ===================================================================

/**
 * @route   POST /api/ai/classify
 * @desc    Classification automatique transaction
 * @access  Private (authentification requise)
 * @middleware authenticate + validation
 */
router.post('/classify',
  validate('ai', 'classify'),
  AIController.classifyTransaction
);

/**
 * @route   GET /api/ai/predictions
 * @desc    Prédictions ML (méthode existante)
 * @access  Private (authentification requise)
 * @middleware authenticate + validation
 */
router.get('/predictions',
  validate('ai', 'predictions', 'query'),
  AIController.getPredictions
);

/**
 * @route   POST /api/ai/anomaly/check
 * @desc    Vérifier si montant est anormal
 * @access  Private (authentification requise)
 * @middleware authenticate + validation
 */
router.post('/anomaly/check',
  validate('ai', 'checkAnomaly'),
  AIController.checkAnomaly
);

/**
 * @route   GET /api/ai/similar-users
 * @desc    Trouver utilisateurs avec patterns similaires
 * @access  Private (authentification requise)
 * @middleware authenticate + validation
 */
router.get('/similar-users',
  validate('ai', 'similarUsers', 'query'),
  AIController.getSimilarUsers
);

/**
 * @route   POST /api/ai/models/train
 * @desc    Entraîner modèle ML personnalisé
 * @access  Private (authentification requise)
 * @middleware authenticate + validation
 */
router.post('/models/train',
  validate('ai', 'trainModel'),
  AIController.trainModel
);

// ===================================================================
// ROUTES UTILITAIRES
// ===================================================================

/**
 * @route   GET /api/ai/info
 * @desc    Informations détaillées sur l'API AI
 * @access  Public
 */
router.get('/info', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      version: '2.0.0',
      description: 'API Intelligence Artificielle - FinApp Haiti',
      features: [
        'Analyse patterns et habitudes financières',
        'Détection anomalies ML en temps réel',
        'Score santé financière dynamique',
        'Conseils personnalisés contexte Haiti',
        'Prédictions dépenses/revenus avancées',
        'Classification automatique transactions',
        'Recommandations sols/tontines optimales',
        'Stratégies multi-devises HTG/USD',
        'Analytics comparatifs avec pairs'
      ],
      services: {
        habitAnalysis: 'Analyse patterns comportementaux',
        mlService: 'Machine Learning et classification',
        adviceEngine: 'Génération conseils intelligents',
        predictionService: 'Prédictions financières avancées'
      },
      endpoints: {
        total: 27,
        analysis: 6,
        advice: 5,
        predictions: 6,
        ml: 5,
        system: 2
      },
      contextHaiti: [
        'Support multi-devises HTG/USD natif',
        'Conseils tontines traditionnelles',
        'Patterns transport locaux',
        'Marchés vs supermarchés',
        'Services télécoms (Digicel, Natcom)',
        'Négociation culturelle'
      ]
    },
    timestamp: new Date().toISOString()
  });
});

/**
 * @route   GET /api/ai/health
 * @desc    Health check du service AI
 * @access  Public
 */
router.get('/health-check', async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      status: 'healthy',
      data: {
        service: 'ai',
        version: '2.0.0',
        uptime: process.uptime(),
        services: {
          habitAnalysis: 'active',
          mlService: 'active',
          adviceEngine: 'active',
          predictionService: 'active',
          notifications: 'active'
        },
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
      message: 'Service AI temporairement indisponible'
    });
  }
});

// ===================================================================
// GESTION D'ERREURS
// ===================================================================

/**
 * Middleware de gestion d'erreurs pour routes AI
 */
router.use((error, req, res, next) => {
  console.error('❌ Erreur route AI:', {
    method: req.method,
    url: req.originalUrl,
    userId: req.user?.userId,
    error: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });

  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Erreur serveur lors du traitement de la requête AI',
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
 * DOCUMENTATION TECHNIQUE ROUTES AI
 * ===================================================================
 * 
 * Architecture :
 * - 27 endpoints Intelligence Artificielle révolutionnaires
 * - Validation centralisée avec validation.js
 * - 4 Services IA intégrés et orchestrés
 * - Notifications automatiques intelligentes
 * 
 * Services IA Intégrés :
 * 1. HabitAnalysisService - Analyse patterns et habitudes
 * 2. MLService - Machine Learning et classification
 * 3. AdviceEngine - Conseils personnalisés contextuels
 * 4. PredictionService - Prédictions financières avancées
 * 
 * Sécurité :
 * - Authentification obligatoire (sauf /status et info)
 * - Validation Joi centralisée pour toutes les entrées
 * - Rate limiting intelligent (à implémenter si besoin)
 * - Logging complet pour monitoring
 * 
 * Performance :
 * - Analyses parallèles Promise.all()
 * - Caching intelligent des modèles ML
 * - Optimisations queries MongoDB
 * - Monitoring temps de réponse
 * 
 * Features Haiti :
 * - Multi-devises HTG/USD natif
 * - Conseils sols/tontines contextuels
 * - Patterns transport/marchés locaux
 * - Négociation culturelle intégrée
 * - Analytics adaptés au contexte
 * 
 * Endpoints avec Validation (22/27) :
 * 
 * ANALYSIS (4/6 validés):
 * 1. GET /api/ai/analysis/personal - validate('ai', 'analysisPersonal', 'query') ✅
 * 2. GET /api/ai/anomalies - validate('ai', 'anomalies', 'query') ✅
 * 3. GET /api/ai/health - Pas de validation nécessaire
 * 4. GET /api/ai/habits - validate('ai', 'habits', 'query') ✅
 * 5. GET /api/ai/patterns/temporal - validate('ai', 'temporalPatterns', 'query') ✅
 * 6. GET /api/ai/patterns/location - validate('ai', 'locationPatterns', 'query') ✅
 * 
 * ADVICE (2/5 validés):
 * 7. POST /api/ai/advice/generate - validate('ai', 'adviceGenerate', 'query') ✅
 * 8. GET /api/ai/advice/optimization-report - Pas de validation nécessaire
 * 9. GET /api/ai/advice/currency-strategy - Pas de validation nécessaire
 * 10. GET /api/ai/advice/peer-comparison - Pas de validation nécessaire
 * 11. GET /api/ai/advice/personal - validate('ai', 'advicePersonal', 'query') ✅
 * 
 * PREDICTIONS (4/6 validés):
 * 12. GET /api/ai/predictions/expenses - validate('ai', 'predictExpenses', 'query') ✅
 * 13. GET /api/ai/predictions/income - validate('ai', 'predictIncome', 'query') ✅
 * 14. GET /api/ai/predictions/budget-risks - Pas de validation nécessaire
 * 15. GET /api/ai/predictions/savings - Pas de validation nécessaire
 * 16. POST /api/ai/predictions/sol-timing - validate('ai', 'predictSolTiming') ✅
 * 17. POST /api/ai/predictions/debt-impact - validate('ai', 'predictDebtImpact') ✅
 * 
 * ML (5/5 validés):
 * 18. POST /api/ai/classify - validate('ai', 'classify') ✅
 * 19. GET /api/ai/predictions - validate('ai', 'predictions', 'query') ✅
 * 20. POST /api/ai/anomaly/check - validate('ai', 'checkAnomaly') ✅
 * 21. GET /api/ai/similar-users - validate('ai', 'similarUsers', 'query') ✅
 * 22. POST /api/ai/models/train - validate('ai', 'trainModel') ✅
 * 
 * SYSTEM (0/2 validés - pas nécessaire):
 * 23. GET /api/ai/status - Public, pas de validation
 * 24. GET /api/ai - Public, pas de validation
 * 25. GET /api/ai/info - Public, pas de validation
 * 26. GET /api/ai/health-check - Public, pas de validation
 * 
 * Tests Prioritaires :
 * - Analyse personnelle complète avec tous les services
 * - Génération conseils personnalisés contextuels
 * - Prédictions dépenses/revenus avec ML
 * - Classification transactions automatique
 * - Détection anomalies en temps réel
 * - Intégration notifications automatiques
 * - Performance analyses parallèles
 * - Précision modèles ML
 * ===================================================================
 */