// src/controllers/aiController.js
// Controller pour endpoints Intelligence Artificielle - VERSION REFACTORISÉE
// Intégration: HabitAnalysisService + MLService + AdviceEngine + PredictionService
// FICHIER COMPLET

const HabitAnalysisService = require('../services/habitAnalysisService');
const MLService = require('../services/mlService');
const AdviceEngine = require('../services/adviceEngine');
const PredictionService = require('../services/predictionService');
const aiNotifications = require('../integrations/aiNotifications');

// ===================================================================
// IMPORT errorHandler.js INTÉGRÉ
// ===================================================================
const { catchAsync } = require('../middleware/errorHandler');

class AIController {

  // ===================================================================
  // ANALYSES PERSONNELLES
  // ===================================================================

  /**
   * GET /api/ai/analysis/personal
   * Analyse complète personnelle de l'utilisateur
   */
  static getPersonalAnalysis = catchAsync(async (req, res) => {
    const { userId } = req.user;
    const days = parseInt(req.query.days) || 90;

    // Analyses parallèles pour performance
    const [patterns, anomalies, health, habits, timing] = await Promise.all([
      HabitAnalysisService.analyzeSpendingPatterns(userId, days),
      HabitAnalysisService.detectAnomalies(userId, days),
      HabitAnalysisService.calculateFinancialHealth(userId),
      HabitAnalysisService.identifyHabits(userId, days),
      HabitAnalysisService.analyzeTimingPatterns(userId, days)
    ]);

    // Créer notifications pour insights importants
    const notifResult = await aiNotifications.notifyAIInsights(userId, {
      insights: habits.habits || [],
      analysisType: 'personal_analysis'
    });

    res.json({
      success: true,
      data: {
        spendingPatterns: patterns,
        anomalies: {
          detected: anomalies.anomalies?.length || 0,
          details: anomalies
        },
        financialHealth: health,
        habits: habits,
        timingPatterns: timing,
        period: {
          days,
          analyzedAt: new Date()
        },
        notificationsCreated: notifResult.created
      }
    });
  });

  /**
   * GET /api/ai/anomalies
   * Détection anomalies dans dépenses
   */
  static getAnomalies = catchAsync(async (req, res) => {
    const { userId } = req.user;
    const days = parseInt(req.query.days) || 90;

    const anomalies = await HabitAnalysisService.detectAnomalies(userId, days);

    // Notifier les anomalies critiques
    if (anomalies.anomalies && anomalies.anomalies.length > 0) {
      const criticalAnomalies = anomalies.anomalies.filter(a => 
        a.severity === 'critical' || a.severity === 'high'
      );

      for (const anomaly of criticalAnomalies) {
        await aiNotifications.notifyAnomaly(userId, anomaly);
      }
    }

    res.json({
      success: true,
      data: {
        hasData: anomalies.hasData,
        anomalies: anomalies.anomalies || [],
        totalAnomalies: anomalies.anomalies?.length || 0,
        period: { days },
        analyzedAt: new Date()
      }
    });
  });

  /**
   * GET /api/ai/health
   * Score santé financière
   */
  static getHealthScore = catchAsync(async (req, res) => {
    const { userId } = req.user;

    const health = await HabitAnalysisService.calculateFinancialHealth(userId);

    res.json({
      success: true,
      data: {
        score: health.score,
        level: health.level,
        factors: health.factors,
        recommendations: health.recommendations,
        calculatedAt: new Date()
      }
    });
  });

  /**
   * GET /api/ai/habits
   * Habitudes financières détectées
   */
  static getHabits = catchAsync(async (req, res) => {
    const { userId } = req.user;
    const days = parseInt(req.query.days) || 90;

    const habits = await HabitAnalysisService.identifyHabits(userId, days);

    // Créer notifications pour habitudes importantes
    if (habits.habits && habits.habits.length > 0) {
      const notifResult = await aiNotifications.notifyAIInsights(userId, {
        insights: habits.habits,
        analysisType: 'habit_analysis'
      });
    }

    res.json({
      success: true,
      data: {
        hasData: habits.hasData,
        habits: habits.habits || [],
        totalHabits: habits.totalHabits || 0,
        period: { days },
        analyzedAt: new Date()
      }
    });
  });

  /**
   * GET /api/ai/patterns/temporal
   * Patterns temporels (heures, jours)
   */
  static getTemporalPatterns = catchAsync(async (req, res) => {
    const { userId } = req.user;
    const days = parseInt(req.query.days) || 90;

    const patterns = await HabitAnalysisService.analyzeTimingPatterns(userId, days);

    res.json({
      success: true,
      data: {
        hasData: patterns.hasData,
        patterns: patterns.patterns || {},
        insights: patterns.insights || [],
        period: { days },
        analyzedAt: new Date()
      }
    });
  });

  /**
   * GET /api/ai/patterns/location
   * Patterns de localisation
   */
  static getLocationPatterns = catchAsync(async (req, res) => {
    const { userId } = req.user;
    const days = parseInt(req.query.days) || 90;

    const patterns = await HabitAnalysisService.analyzeLocationPatterns(userId, days);

    res.json({
      success: true,
      data: {
        hasData: patterns.hasData,
        patterns: patterns.patterns || [],
        topLocations: patterns.topLocations || [],
        period: { days },
        analyzedAt: new Date()
      }
    });
  });

  // ===================================================================
  // MACHINE LEARNING
  // ===================================================================

  /**
   * POST /api/ai/ml/train
   * Entraîner modèles personnalisés
   */
  static trainModel = catchAsync(async (req, res) => {
    const { userId } = req.user;

    const result = await MLService.trainUserModel(userId);

    res.json({
      success: true,
      data: result
    });
  });

  /**
   * POST /api/ai/ml/classify
   * Classifier transaction automatiquement
   */
  static classifyTransaction = catchAsync(async (req, res) => {
    const { userId } = req.user;
    const { description, amount } = req.body;

    const classification = await MLService.classifyTransaction(userId, description, amount);

    res.json({
      success: true,
      data: classification
    });
  });

  /**
   * GET /api/ai/ml/clusters
   * Obtenir clusters utilisateurs
   */
  static getUserClusters = catchAsync(async (req, res) => {
    const clusters = await MLService.getUserClusters();

    res.json({
      success: true,
      data: {
        clusters,
        totalClusters: clusters.length,
        generatedAt: new Date()
      }
    });
  });

  /**
   * POST /api/ai/anomaly/check
   * Vérifier si un montant est anormal
   */
  static checkAnomaly = catchAsync(async (req, res) => {
    const { userId } = req.user;
    const { amount, category } = req.body;

    const result = await MLService.detectAnomaly(userId, amount, category);

    res.json({
      success: true,
      data: {
        input: { amount, category },
        result,
        checkedAt: new Date()
      }
    });
  });

  /**
   * GET /api/ai/similar-users
   * Trouver utilisateurs avec patterns similaires
   */
  static getSimilarUsers = catchAsync(async (req, res) => {
    const { userId } = req.user;
    const limit = parseInt(req.query.limit) || 5;

    const similar = await MLService.findSimilarUsers(userId, limit);

    res.json({
      success: true,
      data: similar
    });
  });

  // ===================================================================
  // CONSEILS INTELLIGENTS (AdviceEngine)
  // ===================================================================

  /**
   * POST /api/ai/advice/generate
   * Générer conseils complets personnalisés
   */
  static generateAdvice = catchAsync(async (req, res) => {
    const { userId } = req.user;
    const days = parseInt(req.query.days) || 90;

    const advice = await AdviceEngine.generateComprehensiveAdvice(userId, days);

    // Notifier les recommandations importantes
    if (advice.recommendations && advice.recommendations.length > 0) {
      const notifResult = await aiNotifications.notifyRecommendations(
        userId,
        advice.recommendations
      );
    }

    res.json({
      success: true,
      data: advice
    });
  });

  /**
   * GET /api/ai/advice/optimization-report
   * Rapport d'optimisation financière complet
   */
  static getOptimizationReport = catchAsync(async (req, res) => {
    const { userId } = req.user;

    const report = await AdviceEngine.generateOptimizationReport(userId);

    res.json({
      success: true,
      data: report
    });
  });

  /**
   * GET /api/ai/advice/currency-strategy
   * Stratégie optimisation HTG/USD
   */
  static getCurrencyStrategy = catchAsync(async (req, res) => {
    const { userId } = req.user;

    const strategy = await AdviceEngine.analyzeCurrencyStrategy(userId);

    res.json({
      success: true,
      data: strategy
    });
  });

  /**
   * GET /api/ai/advice/peer-comparison
   * Comparaison avec utilisateurs similaires
   */
  static getPeerComparison = catchAsync(async (req, res) => {
    const { userId } = req.user;

    const comparison = await AdviceEngine.generatePeerComparison(userId);

    res.json({
      success: true,
      data: comparison
    });
  });

  /**
   * GET /api/ai/advice/personal
   * Conseils personnalisés basés sur patterns (simple)
   */
  static getPersonalAdvice = catchAsync(async (req, res) => {
    const { userId } = req.user;
    const days = parseInt(req.query.days) || 90;

    // Version simplifiée avec moins d'insights
    const [patterns, health] = await Promise.all([
      HabitAnalysisService.analyzeSpendingPatterns(userId, days),
      HabitAnalysisService.calculateFinancialHealth(userId)
    ]);

    const advice = [];

    // Conseil basé sur catégorie dominante
    if (patterns.hasData && patterns.categoryBreakdown?.length > 0) {
      const topCategory = patterns.categoryBreakdown[0];
      
      if (topCategory.percentage > 40) {
        advice.push({
          type: 'category_optimization',
          priority: 'high',
          title: `Optimiser vos dépenses en ${topCategory.name}`,
          description: `${topCategory.name} représente ${topCategory.percentage}% de vos dépenses (${topCategory.total} HTG). Réduisez de 15% pour économiser ${Math.round(topCategory.total * 0.15)} HTG/mois.`,
          actions: [
            `Analyser les dépenses en ${topCategory.name}`,
            'Identifier les non-essentiels',
            `Fixer budget de ${Math.round(topCategory.total * 0.85)} HTG`
          ]
        });
      }
    }

    // Conseil santé financière
    if (health.score < 50) {
      advice.push({
        type: 'health_improvement',
        priority: 'urgent',
        title: 'Améliorer votre santé financière',
        description: `Score actuel: ${health.score}/100 (${health.level}). Actions urgentes nécessaires.`,
        actions: [
          'Réduire dépenses non-essentielles de 30%',
          'Créer budget strict',
          'Éviter nouvelles dettes'
        ]
      });
    }

    res.json({
      success: true,
      data: {
        advice,
        totalAdvice: advice.length,
        basedOn: {
          spendingPatterns: patterns.hasData,
          financialHealth: true,
          period: days
        },
        generatedAt: new Date()
      }
    });
  });

  // ===================================================================
  // PRÉDICTIONS AVANCÉES (PredictionService)
  // ===================================================================

  /**
   * GET /api/ai/predictions/expenses
   * Prédire dépenses futures
   */
  static predictExpenses = catchAsync(async (req, res) => {
    const { userId } = req.user;
    const months = parseInt(req.query.months) || 1;

    const predictions = await PredictionService.predictFutureExpenses(userId, months);

    res.json({
      success: true,
      data: predictions
    });
  });

  /**
   * GET /api/ai/predictions/income
   * Prédire revenus futurs
   */
  static predictIncome = catchAsync(async (req, res) => {
    const { userId } = req.user;
    const months = parseInt(req.query.months) || 1;

    const predictions = await PredictionService.predictFutureIncome(userId, months);

    res.json({
      success: true,
      data: predictions
    });
  });

  /**
   * GET /api/ai/predictions/budget-risks
   * Analyser risques dépassement budgets
   */
  static predictBudgetRisks = catchAsync(async (req, res) => {
    const { userId } = req.user;

    const risks = await PredictionService.analyzeBudgetRisks(userId);

    // Notifier risques critiques
    if (risks.criticalRisks && risks.criticalRisks.length > 0) {
      for (const risk of risks.criticalRisks) {
        await aiNotifications.notifyBudgetRisk(userId, risk);
      }
    }

    res.json({
      success: true,
      data: risks
    });
  });

  /**
   * GET /api/ai/predictions/savings
   * Calculer capacité d'épargne optimale
   */
  static predictSavings = catchAsync(async (req, res) => {
    const { userId } = req.user;

    const savingsPotential = await PredictionService.calculateSavingsPotential(userId);

    res.json({
      success: true,
      data: savingsPotential
    });
  });

  /**
   * POST /api/ai/predictions/sol-timing
   * Analyser meilleur moment pour rejoindre sol
   */
  static predictSolTiming = catchAsync(async (req, res) => {
    const { userId } = req.user;
    const { solAmount, frequency } = req.body;

    const timing = await PredictionService.analyzeSolTiming(userId, solAmount, frequency);

    res.json({
      success: true,
      data: timing
    });
  });

  /**
   * POST /api/ai/predictions/debt-impact
   * Analyser impact d'une nouvelle dette
   */
  static predictDebtImpact = catchAsync(async (req, res) => {
    const { userId } = req.user;
    const { amount, interestRate, duration } = req.body;

    const impact = await PredictionService.analyzeDebtImpact(userId, {
      amount,
      interestRate,
      duration
    });

    res.json({
      success: true,
      data: impact
    });
  });

  // ===================================================================
  // SYSTÈME ET UTILITAIRES
  // ===================================================================

  /**
   * GET /api/ai/status
   * Status système IA et capabilities
   */
  static getAIStatus = catchAsync(async (req, res) => {
    res.json({
      success: true,
      data: {
        status: 'operational',
        version: '1.0.0',
        services: {
          habitAnalysis: 'active',
          mlService: 'active',
          adviceEngine: 'active',
          predictionService: 'active',
          notifications: 'active'
        },
        features: {
          analysis: [
            'Analyse patterns dépenses',
            'Détection anomalies',
            'Score santé financière',
            'Identification habitudes',
            'Patterns temporels',
            'Patterns localisation'
          ],
          advice: [
            'Conseils personnalisés complets',
            'Rapport d\'optimisation',
            'Stratégie multi-devises HTG/USD',
            'Comparaison avec pairs'
          ],
          predictions: [
            'Prédictions dépenses futures',
            'Prévisions revenus',
            'Risques budgets',
            'Capacité épargne',
            'Timing sols optimal',
            'Impact dettes'
          ],
          ml: [
            'Classification automatique',
            'Clustering utilisateurs',
            'Entraînement modèles personnalisés',
            'Détection anomalies ML'
          ],
          notifications: [
            'Notifications insights automatiques',
            'Alertes anomalies',
            'Recommandations personnalisées',
            'Prédictions budget'
          ]
        },
        endpoints: {
          total: 27,
          analysis: 6,
          advice: 5,
          predictions: 6,
          ml: 5,
          system: 1
        },
        timestamp: new Date()
      }
    });
  });
}

// ===================================================================
// EXPORT
// ===================================================================

module.exports = AIController;

// ===================================================================
// FIN DU FICHIER aiController.js
// ===================================================================