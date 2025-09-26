// src/services/mlService.js
// Service Machine Learning avec TensorFlow - FinApp Haiti
// Phase 7 IA Foundation

const tf = require('@tensorflow/tfjs-node');
const stats = require('simple-statistics');
const kmeans = require('ml-kmeans');
const Transaction = require('../models/Transaction');
const MLHelpers = require('../utils/mlHelpers');
const { TRANSACTION_CATEGORIES } = require('../utils/constants');

/**
 * Service Machine Learning avancé avec TensorFlow
 * Gère classification, prédictions, clustering, détection anomalies
 */
class MLService {

  // ===================================================================
  // 1. CLASSIFICATION AUTOMATIQUE TRANSACTIONS
  // ===================================================================

  /**
   * Classifier transaction automatiquement basée sur description
   * @param {String} description - Description transaction
   * @param {Number} amount - Montant
   * @param {Object} metadata - Méta-données additionnelles
   * @returns {Object} - {category, confidence, alternatives}
   */
  static async classifyTransaction(description, amount, metadata = {}) {
    try {
      // Méthode rule-based pour MVP (avant entraînement modèle)
      const categoryScores = this.calculateCategoryScores(description, amount, metadata);
      
      // Trier par score
      const sorted = Object.entries(categoryScores)
        .sort((a, b) => b[1] - a[1]);

      const topCategory = sorted[0];
      const confidence = topCategory[1];

      // Alternatives si confidence faible
      const alternatives = sorted.slice(1, 4).map(([cat, score]) => ({
        category: cat,
        confidence: score
      }));

      return {
        category: topCategory[0],
        confidence: parseFloat(confidence.toFixed(2)),
        alternatives: confidence < 0.7 ? alternatives : [],
        method: 'rule_based' // Plus tard : 'tensorflow_model'
      };

    } catch (error) {
      console.error('Erreur classification:', error);
      throw error;
    }
  }

  /**
   * Calculer scores par catégorie (rule-based)
   */
  static calculateCategoryScores(description, amount, metadata) {
    const scores = {};
    const desc = description.toLowerCase();

    // Keywords par catégorie
    const keywords = {
      transport: ['tap-tap', 'taxi', 'moto', 'bus', 'transport', 'carburant', 'essence', 'diesel'],
      alimentation: ['food', 'lunch', 'dinner', 'restaurant', 'marché', 'market', 'nourriture', 'manger', 'cafe'],
      logement: ['loyer', 'rent', 'maison', 'appartement', 'electricity', 'water', 'internet'],
      factures: ['facture', 'bill', 'electricité', 'eau', 'telephone', 'internet', 'cable'],
      sante: ['hopital', 'docteur', 'pharmacie', 'medicament', 'health', 'medical'],
      education: ['ecole', 'school', 'universite', 'livre', 'cours', 'formation'],
      loisirs: ['cinema', 'sport', 'gym', 'entertainment', 'sortie', 'vacances'],
      vetements: ['vetement', 'clothes', 'chaussure', 'shoe', 'fashion'],
      sols: ['sol', 'tontine', 'contribution', 'epargne'],
      autres: []
    };

    // Calculer score par catégorie
    Object.entries(keywords).forEach(([category, words]) => {
      let score = 0;

      // Score basé sur keywords
      words.forEach(word => {
        if (desc.includes(word)) {
          score += 0.3;
        }
      });

      // Score basé sur montant typique
      const typicalRanges = {
        transport: [25, 500],
        alimentation: [50, 300],
        logement: [3000, 15000],
        factures: [500, 3000],
        sante: [200, 5000],
        education: [500, 10000],
        loisirs: [100, 2000],
        vetements: [200, 5000],
        sols: [500, 10000]
      };

      const range = typicalRanges[category];
      if (range && amount >= range[0] && amount <= range[1]) {
        score += 0.4;
      }

      // Score basé sur metadata
      if (metadata.timeOfDay && category === 'alimentation') {
        if (['morning', 'afternoon'].includes(metadata.timeOfDay)) {
          score += 0.2;
        }
      }

      scores[category] = Math.min(score, 1.0);
    });

    // Si aucun match, category 'autres'
    const maxScore = Math.max(...Object.values(scores));
    if (maxScore < 0.3) {
      scores.autres = 0.5;
    }

    return scores;
  }

  // ===================================================================
  // 2. PRÉDICTIONS DÉPENSES FUTURES
  // ===================================================================

  /**
   * Prédire dépenses mois prochain
   * @param {String} userId - ID utilisateur
   * @param {Object} options - Options prédiction
   * @returns {Object} - Prédiction avec confidence
   */
  static async predictNextMonthExpenses(userId, options = {}) {
    try {
      // Récupérer historique 6 mois
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const transactions = await Transaction.find({
        user: userId,
        type: 'expense',
        date: { $gte: sixMonthsAgo },
        isConfirmed: true
      }).sort({ date: 1 });

      if (transactions.length < 10) {
        return {
          prediction: null,
          confidence: 0,
          message: 'Pas assez de données (minimum 10 transactions)'
        };
      }

      // Grouper par mois
      const monthlyExpenses = this.groupByMonth(transactions);
      
      // Méthode 1: Régression linéaire simple
      const months = Object.keys(monthlyExpenses).map(Number);
      const amounts = Object.values(monthlyExpenses);
      
      const regression = MLHelpers.simpleLinearRegression(
        months,
        amounts
      );

      // Prédiction mois prochain
      const nextMonth = Math.max(...months) + 1;
      let prediction = regression.predict(nextMonth);

      // Méthode 2: Ajuster avec tendance
      const trend = MLHelpers.detectTrend(amounts);
      if (trend.trend === 'increasing') {
        prediction *= (1 + parseFloat(trend.percentChange) / 100);
      }

      // Méthode 3: Ajuster avec saisonnalité
      const seasonality = MLHelpers.calculateSeasonality(
        transactions.map(t => ({
          date: t.date,
          value: t.amount
        }))
      );

      const currentMonth = new Date().getMonth();
      if (seasonality.monthly[currentMonth]) {
        const avgMonthly = MLHelpers.mean(Object.values(seasonality.monthly));
        const seasonalFactor = seasonality.monthly[currentMonth] / avgMonthly;
        prediction *= seasonalFactor;
      }

      // Calculer confidence basée sur R²
      const confidence = Math.max(regression.r2, 0.5);

      return {
        prediction: Math.round(prediction),
        confidence: parseFloat(confidence.toFixed(2)),
        breakdown: {
          basePrediction: Math.round(regression.predict(nextMonth)),
          trendAdjustment: trend.percentChange + '%',
          seasonalFactor: seasonality.monthly[currentMonth] || 1,
          r2: regression.r2
        },
        historicalData: {
          months: months.length,
          avgMonthly: Math.round(MLHelpers.mean(amounts)),
          trend: trend.trend
        }
      };

    } catch (error) {
      console.error('Erreur prédiction:', error);
      throw error;
    }
  }

  /**
   * Grouper transactions par mois
   */
  static groupByMonth(transactions) {
    const grouped = {};

    transactions.forEach(t => {
      const monthKey = t.date.getMonth() + (t.date.getFullYear() * 12);
      if (!grouped[monthKey]) {
        grouped[monthKey] = 0;
      }
      grouped[monthKey] += t.amount;
    });

    return grouped;
  }

  // ===================================================================
  // 3. DÉTECTION ANOMALIES AVANCÉE
  // ===================================================================

  /**
   * Détecter anomalies avec méthodes multiples
   * @param {String} userId - ID utilisateur
   * @param {Number} newAmount - Nouveau montant à vérifier
   * @returns {Object} - Résultat détection
   */
  static async detectAnomaly(userId, newAmount, category = null) {
    try {
      // Récupérer historique catégorie ou global
      const query = {
        user: userId,
        type: 'expense',
        isConfirmed: true
      };

      if (category) {
        query.category = category;
      }

      const transactions = await Transaction.find(query)
        .sort({ date: -1 })
        .limit(100);

      if (transactions.length < 10) {
        return {
          isAnomaly: false,
          confidence: 0,
          message: 'Pas assez de données historiques'
        };
      }

      const amounts = transactions.map(t => t.amount);

      // Méthode 1: Écart-type (2σ)
      const outliers1 = MLHelpers.findOutliers(amounts, 2);
      const isOutlier1 = newAmount > outliers1.statistics.upperBound;

      // Méthode 2: IQR
      const outliers2 = MLHelpers.detectAnomaliesIQR(amounts);
      const isOutlier2 = newAmount > outliers2.upperBound;

      // Méthode 3: Z-score
      const mean = MLHelpers.mean(amounts);
      const stdDev = MLHelpers.standardDeviation(amounts);
      const zScore = (newAmount - mean) / stdDev;
      const isOutlier3 = Math.abs(zScore) > 2;

      // Consensus: anomalie si 2+ méthodes détectent
      const detectionCount = [isOutlier1, isOutlier2, isOutlier3]
        .filter(Boolean).length;

      const isAnomaly = detectionCount >= 2;
      const confidence = detectionCount / 3;

      // Calcul facteur déviation
      const deviationFactor = (newAmount / mean).toFixed(1);

      return {
        isAnomaly,
        confidence: parseFloat(confidence.toFixed(2)),
        severity: this.calculateSeverity(deviationFactor),
        details: {
          amount: newAmount,
          average: Math.round(mean),
          deviationFactor: deviationFactor + 'x',
          zScore: zScore.toFixed(2),
          methods: {
            stdDev: isOutlier1,
            iqr: isOutlier2,
            zScore: isOutlier3
          }
        },
        recommendation: isAnomaly 
          ? `Cette dépense est ${deviationFactor}x votre moyenne. Vérifiez si c'est correct.`
          : 'Dépense dans la normale'
      };

    } catch (error) {
      console.error('Erreur détection anomalie:', error);
      throw error;
    }
  }

  /**
   * Calculer sévérité anomalie
   */
  static calculateSeverity(deviationFactor) {
    const factor = parseFloat(deviationFactor);
    if (factor > 5) return 'critical';
    if (factor > 3) return 'high';
    if (factor > 2) return 'medium';
    return 'low';
  }

  // ===================================================================
  // 4. CLUSTERING USERS SIMILAIRES
  // ===================================================================

  /**
   * Trouver users similaires par patterns dépenses
   * @param {String} userId - ID utilisateur
   * @param {Number} k - Nombre de clusters
   * @returns {Object} - Cluster et users similaires
   */
  static async findSimilarUsers(userId, k = 5) {
    try {
      // Récupérer tous les users avec leurs patterns
      const allUsers = await this.getUserSpendingPatterns();

      if (allUsers.length < k) {
        return {
          cluster: null,
          similarUsers: [],
          message: 'Pas assez d\'utilisateurs pour clustering'
        };
      }

      // Extraire features pour clustering
      const features = allUsers.map(u => [
        u.avgMonthly,
        u.transportRatio,
        u.foodRatio,
        u.frequency
      ]);

      // Normaliser features
      const normalized = features.map(f => 
        MLHelpers.minMaxNormalize(f)
      );

      // K-means clustering
      const result = kmeans(normalized, k);

      // Trouver cluster de l'utilisateur
      const userIndex = allUsers.findIndex(u => u.userId.toString() === userId.toString());
      const userCluster = result.clusters[userIndex];

      // Trouver users dans même cluster
      const similarUsers = allUsers
        .filter((u, i) => result.clusters[i] === userCluster && i !== userIndex)
        .slice(0, 10)
        .map(u => ({
          userId: u.userId,
          similarity: this.calculateSimilarity(
            features[userIndex],
            features[allUsers.indexOf(u)]
          ),
          patterns: {
            avgMonthly: u.avgMonthly,
            topCategory: u.topCategory
          }
        }));

      return {
        cluster: userCluster,
        clusterSize: result.clusters.filter(c => c === userCluster).length,
        similarUsers: similarUsers.sort((a, b) => b.similarity - a.similarity),
        recommendations: this.generateClusterRecommendations(similarUsers)
      };

    } catch (error) {
      console.error('Erreur clustering:', error);
      throw error;
    }
  }

  /**
   * Extraire patterns tous users (version simplifiée MVP)
   */
  static async getUserSpendingPatterns() {
    // TODO: En production, utiliser aggregation MongoDB optimisée
    // Pour MVP, retourner données mock ou limiter à 100 users
    return [];
  }

  /**
   * Calculer similarité entre deux vecteurs features
   */
  static calculateSimilarity(vector1, vector2) {
    return MLHelpers.cosineSimilarity(vector1, vector2);
  }

  /**
   * Générer recommandations basées cluster
   */
  static generateClusterRecommendations(similarUsers) {
    if (similarUsers.length === 0) return [];

    const avgMonthly = MLHelpers.mean(
      similarUsers.map(u => u.patterns.avgMonthly)
    );

    return [
      {
        type: 'peer_comparison',
        message: `Les gens similaires à vous dépensent en moyenne ${Math.round(avgMonthly)} HTG/mois`,
        impact: 'medium'
      }
    ];
  }

  // ===================================================================
  // 5. PRÉDICTIONS CATÉGORIE SPÉCIFIQUE
  // ===================================================================

  /**
   * Prédire dépenses catégorie spécifique
   * @param {String} userId - ID utilisateur
   * @param {String} category - Catégorie
   * @returns {Object} - Prédiction catégorie
   */
  static async predictCategoryExpense(userId, category) {
    try {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      const transactions = await Transaction.find({
        user: userId,
        type: 'expense',
        category,
        date: { $gte: threeMonthsAgo },
        isConfirmed: true
      });

      if (transactions.length < 5) {
        return {
          prediction: null,
          confidence: 0,
          message: 'Pas assez de données pour cette catégorie'
        };
      }

      // Grouper par mois
      const monthlyByCategory = this.groupByMonth(transactions);
      const amounts = Object.values(monthlyByCategory);

      // Prédiction simple
      const avg = MLHelpers.mean(amounts);
      const trend = MLHelpers.detectTrend(amounts, Math.min(amounts.length, 3));

      let prediction = avg;
      if (trend.trend === 'increasing') {
        prediction *= (1 + parseFloat(trend.percentChange) / 100);
      }

      return {
        category,
        prediction: Math.round(prediction),
        confidence: trend.confidence,
        trend: trend.trend,
        historicalAvg: Math.round(avg)
      };

    } catch (error) {
      console.error('Erreur prédiction catégorie:', error);
      throw error;
    }
  }

  // ===================================================================
  // 6. ANALYSE PATTERNS AVANCÉE
  // ===================================================================

  /**
   * Analyser patterns temporels avec TensorFlow
   * @param {String} userId - ID utilisateur
   * @returns {Object} - Patterns détectés
   */
  static async analyzeTemporalPatterns(userId) {
    try {
      const transactions = await Transaction.find({
        user: userId,
        type: 'expense',
        isConfirmed: true
      }).sort({ date: 1 }).limit(500);

      if (transactions.length < 30) {
        return {
          patterns: [],
          message: 'Pas assez de données pour patterns temporels'
        };
      }

      // Analyser par jour de semaine
      const byDayOfWeek = {};
      transactions.forEach(t => {
        const day = t.date.getDay();
        if (!byDayOfWeek[day]) byDayOfWeek[day] = [];
        byDayOfWeek[day].push(t.amount);
      });

      const dayPatterns = Object.entries(byDayOfWeek).map(([day, amounts]) => ({
        day: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][day],
        avgAmount: Math.round(MLHelpers.mean(amounts)),
        frequency: amounts.length
      }));

      // Analyser par heure
      const byHour = {};
      transactions.forEach(t => {
        const hour = t.date.getHours();
        if (!byHour[hour]) byHour[hour] = 0;
        byHour[hour]++;
      });

      const peakHour = Object.entries(byHour)
        .sort((a, b) => b[1] - a[1])[0];

      return {
        patterns: {
          dayOfWeek: dayPatterns.sort((a, b) => b.avgAmount - a.avgAmount),
          peakHour: {
            hour: peakHour[0],
            count: peakHour[1]
          },
          consistency: this.calculateConsistency(transactions)
        }
      };

    } catch (error) {
      console.error('Erreur analyse patterns:', error);
      throw error;
    }
  }

  /**
   * Calculer consistance patterns
   */
  static calculateConsistency(transactions) {
    const dates = transactions.map(t => t.date.toISOString().split('T')[0]);
    const uniqueDates = new Set(dates);
    
    const daysSinceFirst = MLHelpers.daysBetween(
      transactions[0].date,
      transactions[transactions.length - 1].date
    );

    return {
      daysWithActivity: uniqueDates.size,
      totalDays: daysSinceFirst,
      consistencyRate: ((uniqueDates.size / daysSinceFirst) * 100).toFixed(1) + '%'
    };
  }
}

module.exports = MLService;