// src/controllers/aiController.js
// Controller pour endpoints Intelligence Artificielle

const HabitAnalysisService = require('../services/habitAnalysisService');
const MLService = require('../services/mlService');

class AIController {

  /**
   * GET /api/ai/analysis/personal
   * Analyse complète personnelle de l'utilisateur
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
          }
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
   * GET /api/ai/advice/personal
   * Conseils personnalisés basés sur patterns réels
   */
  static async getPersonalAdvice(req, res) {
    try {
      const { userId } = req.user;
      const days = parseInt(req.query.days) || 90;

      // Récupérer données pour conseils
      const [patterns, health, habits] = await Promise.all([
        HabitAnalysisService.analyzeSpendingPatterns(userId, days),
        HabitAnalysisService.calculateFinancialHealth(userId),
        HabitAnalysisService.identifyHabits(userId, days)
      ]);

      const advice = [];

      // Conseils basés sur catégories dominantes
      if (patterns.hasData && patterns.categoryBreakdown?.length > 0) {
        const topCategory = patterns.categoryBreakdown[0];
        
        if (topCategory.percentage > 40) {
          advice.push({
            type: 'category_optimization',
            priority: 'high',
            title: `Optimiser vos dépenses en ${topCategory.name}`,
            description: `${topCategory.name} représente ${topCategory.percentage}% de vos dépenses (${topCategory.total} HTG). Voici des pistes d'optimisation.`,
            category: topCategory.category,
            impact: 'high',
            potentialSavings: Math.round(topCategory.total * 0.15)
          });
        }
      }

      // Conseils basés santé financière
      if (health.score < 60) {
        advice.push({
          type: 'financial_health',
          priority: 'medium',
          title: 'Améliorer votre santé financière',
          description: `Score actuel: ${health.score}/100. ${health.recommendations.join('. ')}`,
          impact: 'medium',
          actionable: true
        });
      }

      // Conseils basés habitudes
      if (habits.hasData && habits.habits?.length > 0) {
        const recurringHabit = habits.habits.find(h => h.frequency === 'très_fréquent');
        if (recurringHabit) {
          advice.push({
            type: 'habit_awareness',
            priority: 'low',
            title: 'Habitude détectée',
            description: recurringHabit.description,
            impact: 'low',
            actionable: false
          });
        }
      }

      // Conseils génériques si aucune donnée spécifique
      if (advice.length === 0) {
        advice.push({
          type: 'general',
          priority: 'low',
          title: 'Suivez vos dépenses régulièrement',
          description: 'Plus vous enregistrez de transactions, plus nos conseils seront personnalisés et pertinents.',
          impact: 'medium',
          actionable: true
        });
      }

      res.json({
        success: true,
        data: {
          advice: advice.sort((a, b) => {
            const priority = { high: 3, medium: 2, low: 1 };
            return priority[b.priority] - priority[a.priority];
          }),
          totalAdvice: advice.length,
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

  /**
   * GET /api/ai/anomalies
   * Détection des anomalies dans les dépenses
   */
  static async getAnomalies(req, res) {
    try {
      const { userId } = req.user;
      const days = parseInt(req.query.days) || 90;

      const anomalies = await HabitAnalysisService.detectAnomalies(userId, days);

      res.json({
        success: true,
        data: {
          hasData: anomalies.hasData,
          count: anomalies.anomalies?.length || 0,
          statistics: anomalies.statistics,
          anomalies: anomalies.anomalies || [],
          period: { days },
          analyzedAt: new Date()
        }
      });

    } catch (error) {
      console.error('Erreur getAnomalies:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la détection des anomalies',
        message: error.message
      });
    }
  }

  /**
   * POST /api/ai/classify
   * Classifier automatiquement une transaction
   */
  static async classifyTransaction(req, res) {
    try {
      const { description, amount, currency = 'HTG' } = req.body;

      if (!description || !amount) {
        return res.status(400).json({
          success: false,
          error: 'Description et montant requis'
        });
      }

      const classification = await MLService.classifyTransaction(
        description,
        amount,
        { currency }
      );

      res.json({
        success: true,
        data: {
          input: { description, amount, currency },
          classification: {
            category: classification.category,
            confidence: classification.confidence,
            matchedKeywords: classification.matchedKeywords,
            alternatives: classification.alternatives,
            method: classification.method
          },
          suggestion: {
            shouldUse: classification.confidence >= 0.7,
            message: classification.confidence >= 0.7 
              ? `Nous suggérons la catégorie "${classification.category}" avec ${Math.round(classification.confidence * 100)}% de confiance`
              : 'Classification incertaine, veuillez choisir manuellement'
          }
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
   * Prédictions dépenses futures
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
   * GET /api/ai/health
   * Score de santé financière
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
   */
  static async getHabits(req, res) {
    try {
      const { userId } = req.user;
      const days = parseInt(req.query.days) || 90;

      const habits = await HabitAnalysisService.identifyHabits(userId, days);

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
        data: {
          cluster: similar.cluster,
          clusterSize: similar.clusterSize,
          similarUsers: similar.similarUsers || [],
          recommendations: similar.recommendations || [],
          analyzedAt: new Date()
        }
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
   * GET /api/ai/patterns/temporal
   * Patterns temporels (heures, jours)
   */
  static async getTemporalPatterns(req, res) {
    try {
      const { userId } = req.user;
      const days = parseInt(req.query.days) || 90;

      const patterns = await MLService.analyzeTemporalPatterns(userId);

      res.json({
        success: true,
        data: {
          patterns: patterns.patterns,
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
          version: '1.0.0',
          services: {
            habitAnalysis: 'active',
            mlService: 'active',
            classification: 'active',
            predictions: 'active'
          },
          features: [
            'Analyse patterns dépenses',
            'Détection anomalies',
            'Classification automatique',
            'Prédictions ML',
            'Score santé financière',
            'Identification habitudes',
            'Clustering users',
            'Patterns temporels'
          ],
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