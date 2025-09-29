// src/controllers/aiController.js
// Controller pour endpoints Intelligence Artificielle - VERSION COMPLÈTE
// Intégration: HabitAnalysisService + MLService + AdviceEngine + PredictionService

const HabitAnalysisService = require('../services/habitAnalysisService');
const MLService = require('../services/mlService');
const AdviceEngine = require('../services/adviceEngine');
const PredictionService = require('../services/predictionService');
const aiNotifications = require('../integrations/aiNotifications'); // ✅ Intégration ajoutée

class AIController {

  // ===================================================================
  // ANALYSES PERSONNELLES
  // ===================================================================

  /**
   * GET /api/ai/analysis/personal
   * Analyse complète personnelle de l'utilisateur
   * ✨ AVEC NOTIFICATIONS AUTOMATIQUES
   */
  static async getPersonalAnalysis(req, res) {
    try {
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

      // ✨ NOUVEAU : Créer notifications pour insights importants
      const notifResult = await aiNotifications.notifyAIInsights(userId, {
        insights: habits.habits || [],
        analysisType: 'personal_analysis'
      });

      console.log(`✅ ${notifResult.created} notifications AI créées`);

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
          notificationsCreated: notifResult.created // ✨ Ajouté
        }
      });

    } catch (error) {
      console.error('Erreur getPersonalAnalysis:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de l\'analyse personnelle',
        message: error.message
      });
    }
  }

  /**
   * GET /api/ai/anomalies
   * Détection anomalies dans dépenses
   * ✨ AVEC NOTIFICATIONS AUTOMATIQUES
   */
  static async getAnomalies(req, res) {
    try {
      const { userId } = req.user;
      const days = parseInt(req.query.days) || 90;

      const anomalies = await HabitAnalysisService.detectAnomalies(userId, days);

      // ✨ NOUVEAU : Notifier les anomalies critiques
      if (anomalies.anomalies && anomalies.anomalies.length > 0) {
        const criticalAnomalies = anomalies.anomalies.filter(a => 
          a.severity === 'critical' || a.severity === 'high'
        );

        for (const anomaly of criticalAnomalies) {
          await aiNotifications.notifyAnomaly(userId, anomaly);
        }
        
        console.log(`✅ ${criticalAnomalies.length} anomalies critiques notifiées`);
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

    } catch (error) {
      console.error('Erreur getAnomalies:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la détection d\'anomalies',
        message: error.message
      });
    }
  }

  /**
   * GET /api/ai/health
   * Score santé financière
   */
  static async getHealthScore(req, res) {
    try {
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

    } catch (error) {
      console.error('Erreur getHealthScore:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors du calcul de santé',
        message: error.message
      });
    }
  }

  /**
   * GET /api/ai/habits
   * Habitudes financières détectées
   * ✨ AVEC NOTIFICATIONS AUTOMATIQUES
   */
  static async getHabits(req, res) {
    try {
      const { userId } = req.user;
      const days = parseInt(req.query.days) || 90;

      const habits = await HabitAnalysisService.identifyHabits(userId, days);

      // ✨ NOUVEAU : Créer notifications pour habitudes importantes
      if (habits.habits && habits.habits.length > 0) {
        const notifResult = await aiNotifications.notifyAIInsights(userId, {
          insights: habits.habits,
          analysisType: 'habit_analysis'
        });

        console.log(`✅ ${notifResult.created} notifications habitudes créées`);
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

    } catch (error) {
      console.error('Erreur getHabits:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de l\'identification des habitudes',
        message: error.message
      });
    }
  }

  /**
   * GET /api/ai/patterns/temporal
   * Patterns temporels (heures, jours)
   */
  static async getTemporalPatterns(req, res) {
    try {
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

    } catch (error) {
      console.error('Erreur getTemporalPatterns:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de l\'analyse des patterns temporels',
        message: error.message
      });
    }
  }

  /**
   * GET /api/ai/patterns/location
   * Patterns de localisation
   */
  static async getLocationPatterns(req, res) {
    try {
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

    } catch (error) {
      console.error('Erreur getLocationPatterns:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de l\'analyse des patterns de localisation',
        message: error.message
      });
    }
  }

  // ===================================================================
  // CONSEILS INTELLIGENTS (AdviceEngine)
  // ===================================================================

  /**
   * POST /api/ai/advice/generate
   * Générer conseils complets personnalisés
   * ✨ AVEC NOTIFICATIONS AUTOMATIQUES
   */
  static async generateAdvice(req, res) {
    try {
      const { userId } = req.user;
      const days = parseInt(req.query.days) || 90;

      const advice = await AdviceEngine.generateComprehensiveAdvice(userId, days);

      // ✨ NOUVEAU : Notifier les recommandations importantes
      if (advice.recommendations && advice.recommendations.length > 0) {
        const notifResult = await aiNotifications.notifyRecommendations(
          userId,
          advice.recommendations
        );

        console.log(`✅ ${notifResult.created} recommandations notifiées`);
      }

      res.json({
        success: true,
        data: advice
      });

    } catch (error) {
      console.error('Erreur generateAdvice:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la génération des conseils',
        message: error.message
      });
    }
  }

  /**
   * GET /api/ai/advice/optimization-report
   * Rapport d'optimisation financière complet
   */
  static async getOptimizationReport(req, res) {
    try {
      const { userId } = req.user;

      const report = await AdviceEngine.generateOptimizationReport(userId);

      res.json({
        success: true,
        data: report
      });

    } catch (error) {
      console.error('Erreur getOptimizationReport:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la génération du rapport',
        message: error.message
      });
    }
  }

  /**
   * GET /api/ai/advice/currency-strategy
   * Stratégie optimisation HTG/USD
   */
  static async getCurrencyStrategy(req, res) {
    try {
      const { userId } = req.user;

      const strategy = await AdviceEngine.analyzeCurrencyStrategy(userId);

      res.json({
        success: true,
        data: strategy
      });

    } catch (error) {
      console.error('Erreur getCurrencyStrategy:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de l\'analyse de stratégie devises',
        message: error.message
      });
    }
  }

  /**
   * GET /api/ai/advice/peer-comparison
   * Comparaison avec utilisateurs similaires
   */
  static async getPeerComparison(req, res) {
    try {
      const { userId } = req.user;

      const comparison = await AdviceEngine.generatePeerComparison(userId);

      res.json({
        success: true,
        data: comparison
      });

    } catch (error) {
      console.error('Erreur getPeerComparison:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la comparaison avec pairs',
        message: error.message
      });
    }
  }

  /**
   * GET /api/ai/advice/personal
   * Conseils personnalisés basés sur patterns (simple)
   */
  static async getPersonalAdvice(req, res) {
    try {
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

    } catch (error) {
      console.error('Erreur getPersonalAdvice:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la génération des conseils',
        message: error.message
      });
    }
  }

  // ===================================================================
  // PRÉDICTIONS AVANCÉES (PredictionService)
  // ===================================================================

  /**
   * GET /api/ai/predictions/expenses
   * Prédire dépenses futures
   */
  static async predictExpenses(req, res) {
    try {
      const { userId } = req.user;
      const months = parseInt(req.query.months) || 1;

      const predictions = await PredictionService.predictFutureExpenses(userId, months);

      res.json({
        success: true,
        data: predictions
      });

    } catch (error) {
      console.error('Erreur predictExpenses:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la prédiction des dépenses',
        message: error.message
      });
    }
  }

  /**
   * GET /api/ai/predictions/income
   * Prédire revenus futurs
   */
  static async predictIncome(req, res) {
    try {
      const { userId } = req.user;
      const months = parseInt(req.query.months) || 3;

      const predictions = await PredictionService.predictFutureIncome(userId, months);

      res.json({
        success: true,
        data: predictions
      });

    } catch (error) {
      console.error('Erreur predictIncome:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la prédiction des revenus',
        message: error.message
      });
    }
  }

  /**
   * GET /api/ai/predictions/budget-risks
   * Analyser risques dépassement budgets
   * ✨ AVEC NOTIFICATIONS AUTOMATIQUES
   */
  static async predictBudgetRisks(req, res) {
    try {
      const { userId } = req.user;

      const risks = await PredictionService.predictBudgetRisks(userId);

      // ✨ NOUVEAU : Notifier les risques de budget élevés
      if (risks.budgets && risks.budgets.length > 0) {
        const highRiskBudgets = risks.budgets.filter(b => 
          b.riskLevel === 'high' || b.riskLevel === 'critical'
        );

        for (const budget of highRiskBudgets) {
          await aiNotifications.notifyBudgetPrediction(userId, {
            predictedPercentage: budget.predictedPercentage,
            confidence: budget.confidence,
            timeframe: '30 jours',
            budgetName: budget.name
          });
        }

        console.log(`✅ ${highRiskBudgets.length} risques budget notifiés`);
      }

      res.json({
        success: true,
        data: risks
      });

    } catch (error) {
      console.error('Erreur predictBudgetRisks:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de l\'analyse des risques budgets',
        message: error.message
      });
    }
  }

  /**
   * GET /api/ai/predictions/savings
   * Calculer capacité d'épargne optimale
   */
  static async predictSavings(req, res) {
    try {
      const { userId } = req.user;

      const savings = await PredictionService.predictSavingsCapacity(userId);

      res.json({
        success: true,
        data: savings
      });

    } catch (error) {
      console.error('Erreur predictSavings:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors du calcul de capacité d\'épargne',
        message: error.message
      });
    }
  }

  /**
   * POST /api/ai/predictions/sol-timing
   * Analyser meilleur moment pour rejoindre sol
   */
  static async predictSolTiming(req, res) {
    try {
      const { userId } = req.user;
      const { amount, frequency, participants } = req.body;

      if (!amount || !frequency || !participants) {
        return res.status(400).json({
          success: false,
          error: 'Paramètres manquants: amount, frequency, participants requis'
        });
      }

      const timing = await PredictionService.predictOptimalSolTiming(userId, {
        amount,
        frequency,
        participants
      });

      res.json({
        success: true,
        data: timing
      });

    } catch (error) {
      console.error('Erreur predictSolTiming:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de l\'analyse du timing sol',
        message: error.message
      });
    }
  }

  /**
   * POST /api/ai/predictions/debt-impact
   * Analyser impact d'une nouvelle dette
   */
  static async predictDebtImpact(req, res) {
    try {
      const { userId } = req.user;
      const { amount, interestRate, duration, monthlyPayment } = req.body;

      if (!amount || !duration || !monthlyPayment) {
        return res.status(400).json({
          success: false,
          error: 'Paramètres manquants: amount, duration, monthlyPayment requis'
        });
      }

      const impact = await PredictionService.predictDebtImpact(userId, {
        amount,
        interestRate: interestRate || 0,
        duration,
        monthlyPayment
      });

      res.json({
        success: true,
        data: impact
      });

    } catch (error) {
      console.error('Erreur predictDebtImpact:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de l\'analyse d\'impact dette',
        message: error.message
      });
    }
  }

  // ===================================================================
  // MACHINE LEARNING
  // ===================================================================

  /**
   * POST /api/ai/classify
   * Classification automatique transaction
   */
  static async classifyTransaction(req, res) {
    try {
      const { description, amount, currency } = req.body;

      if (!description || !amount) {
        return res.status(400).json({
          success: false,
          error: 'Description et montant requis'
        });
      }

      const classification = await MLService.classifyTransaction(description, amount, currency);

      res.json({
        success: true,
        data: {
          input: { description, amount, currency },
          result: classification,
          suggestion: classification.confidence > 0.7 
            ? `Nous suggérons la catégorie "${classification.category}" avec ${Math.round(classification.confidence * 100)}% de confiance`
            : 'Classification incertaine, veuillez choisir manuellement'
        }
      });

    } catch (error) {
      console.error('Erreur classifyTransaction:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la classification',
        message: error.message
      });
    }
  }

  /**
   * GET /api/ai/predictions
   * Prédictions dépenses (ML Service - méthode existante)
   */
  static async getPredictions(req, res) {
    try {
      const { userId } = req.user;
      const type = req.query.type || 'monthly';

      let prediction;

      if (type === 'monthly') {
        prediction = await MLService.predictNextMonthExpenses(userId);
      } else if (type === 'category' && req.query.category) {
        prediction = await MLService.predictCategoryExpense(userId, req.query.category);
      } else {
        return res.status(400).json({
          success: false,
          error: 'Type de prédiction invalide. Utilisez: monthly ou category'
        });
      }

      res.json({
        success: true,
        data: {
          type,
          prediction,
          generatedAt: new Date()
        }
      });

    } catch (error) {
      console.error('Erreur getPredictions:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la prédiction',
        message: error.message
      });
    }
  }

  /**
   * POST /api/ai/anomaly/check
   * Vérifier si un montant est anormal
   */
  static async checkAnomaly(req, res) {
    try {
      const { userId } = req.user;
      const { amount, category } = req.body;

      if (!amount) {
        return res.status(400).json({
          success: false,
          error: 'Montant requis'
        });
      }

      const result = await MLService.detectAnomaly(userId, amount, category);

      res.json({
        success: true,
        data: {
          input: { amount, category },
          result,
          checkedAt: new Date()
        }
      });

    } catch (error) {
      console.error('Erreur checkAnomaly:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la vérification d\'anomalie',
        message: error.message
      });
    }
  }

  /**
   * GET /api/ai/similar-users
   * Trouver utilisateurs avec patterns similaires
   */
  static async getSimilarUsers(req, res) {
    try {
      const { userId } = req.user;
      const limit = parseInt(req.query.limit) || 5;

      const similar = await MLService.findSimilarUsers(userId, limit);

      res.json({
        success: true,
        data: similar
      });

    } catch (error) {
      console.error('Erreur getSimilarUsers:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la recherche d\'utilisateurs similaires',
        message: error.message
      });
    }
  }

  /**
   * POST /api/ai/models/train
   * Entraîner modèle ML personnalisé
   */
  static async trainModel(req, res) {
    try {
      const { userId } = req.user;
      const { modelType } = req.body;

      if (!modelType) {
        return res.status(400).json({
          success: false,
          error: 'Type de modèle requis (ex: spending_prediction)'
        });
      }

      const model = await PredictionService.trainPredictionModel(userId, modelType);

      res.json({
        success: true,
        data: model
      });

    } catch (error) {
      console.error('Erreur trainModel:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de l\'entraînement du modèle',
        message: error.message
      });
    }
  }

  // ===================================================================
  // SYSTÈME
  // ===================================================================

  /**
   * GET /api/ai/status
   * Statut du système IA
   */
  static async getStatus(req, res) {
    try {
      res.json({
        success: true,
        data: {
          status: 'operational',
          version: '2.0.0',
          services: {
            habitAnalysis: 'active',
            mlService: 'active',
            adviceEngine: 'active',
            predictionService: 'active',
            notifications: 'active' // ✨ Ajouté
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
            notifications: [ // ✨ Ajouté
              'Notifications insights automatiques',
              'Alertes anomalies',
              'Recommandations personnalisées',
              'Prédictions budget'
            ]
          },
          endpoints: {
            total: 27, // Mis à jour
            analysis: 6,
            advice: 4,
            predictions: 6,
            ml: 5,
            system: 1
          },
          timestamp: new Date()
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Erreur système IA',
        message: error.message
      });
    }
  }
}

module.exports = AIController;