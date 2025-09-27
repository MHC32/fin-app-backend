// src/services/mlService.js - Mise à jour avec classification améliorée

const Transaction = require('../models/Transaction');
const User = require('../models/User');
const MLHelpers = require('../utils/mlHelpers');
const classificationPatterns = require('../config/classificationPatterns');

class MLService {
  
  /**
   * Classifier automatiquement une transaction (VERSION AMÉLIORÉE)
   */
  static async classifyTransaction(description, amount, metadata = {}) {
    try {
      const desc = description.toLowerCase().trim();
      
      // Scores par catégorie
      const scores = {};
      
      // Parcourir tous les patterns
      for (const [category, config] of Object.entries(classificationPatterns)) {
        // Ignorer les exports spéciaux
        if (category === 'TELECOM_OPERATORS' || category === 'PUBLIC_SERVICES') continue;
        
        let score = 0;
        let matchedKeywords = [];
        
        for (const keyword of config.keywords) {
          if (desc.includes(keyword.toLowerCase())) {
            score += config.confidence;
            matchedKeywords.push(keyword);
          }
        }
        
        if (score > 0) {
          scores[category] = {
            score: score / config.keywords.length,
            confidence: Math.min(score, 1),
            matchedKeywords
          };
        }
      }

      // Si aucun match par mots-clés, classifier par montant
      if (Object.keys(scores).length === 0) {
        const normalized = MLHelpers.normalizeAmount(amount, metadata.currency || 'HTG');
        
        if (normalized < 100) {
          return {
            category: 'transport',
            confidence: 0.4,
            method: 'amount_based',
            note: 'Petit montant - probablement transport'
          };
        } else if (normalized < 500) {
          return {
            category: 'alimentation',
            confidence: 0.4,
            method: 'amount_based',
            note: 'Montant moyen - probablement alimentation'
          };
        } else {
          return {
            category: 'autre',
            confidence: 0.3,
            method: 'amount_based',
            note: 'Classification incertaine'
          };
        }
      }

      // Trier par confiance décroissante
      const sortedCategories = Object.entries(scores)
        .sort((a, b) => b[1].confidence - a[1].confidence);

      const [topCategory, topData] = sortedCategories[0];
      
      // Alternatives (2ème et 3ème choix avec confiance > 50%)
      const alternatives = sortedCategories
        .slice(1, 3)
        .filter(([_, data]) => data.confidence > 0.5)
        .map(([cat, data]) => ({
          category: cat,
          confidence: parseFloat(data.confidence.toFixed(2))
        }));

      return {
        category: topCategory,
        confidence: parseFloat(topData.confidence.toFixed(2)),
        matchedKeywords: topData.matchedKeywords,
        alternatives: alternatives.length > 0 ? alternatives : undefined,
        method: 'keyword_based'
      };

    } catch (error) {
      console.error('Erreur classifyTransaction:', error);
      return {
        category: 'autre',
        confidence: 0.2,
        error: error.message
      };
    }
  }

  /**
   * Prédire dépenses mois prochain
   */
  static async predictNextMonthExpenses(userId) {
    try {
      const last6Months = new Date();
      last6Months.setMonth(last6Months.getMonth() - 6);

      const monthlyExpenses = await Transaction.aggregate([
        {
          $match: {
            user: userId,
            type: 'expense',
            date: { $gte: last6Months }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$date' },
              month: { $month: '$date' }
            },
            total: { $sum: { $abs: '$amount' } }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]);

      if (monthlyExpenses.length < 2) {
        return {
          prediction: null,
          confidence: 0,
          message: 'Pas assez de données historiques (minimum 2 mois requis)'
        };
      }

      const amounts = monthlyExpenses.map(m => m.total);
      const avgMonthly = MLHelpers.mean(amounts);
      
      // Calculer tendance (régression linéaire simple)
      const trend = this._calculateTrend(amounts);
      const prediction = Math.round(avgMonthly * (1 + trend));
      
      // Confiance basée sur régularité
      const stdDev = MLHelpers.standardDeviation(amounts);
      const coefficient_variation = stdDev / avgMonthly;
      const confidence = Math.max(0.5, 1 - coefficient_variation);

      return {
        prediction,
        confidence: parseFloat(confidence.toFixed(2)),
        breakdown: {
          basePrediction: Math.round(avgMonthly),
          trendAdjustment: `${(trend * 100).toFixed(1)}%`,
          seasonalFactor: 1.0
        },
        historicalData: {
          months: monthlyExpenses.length,
          avgMonthly: Math.round(avgMonthly),
          trend: trend > 0 ? 'increasing' : trend < 0 ? 'decreasing' : 'stable'
        }
      };

    } catch (error) {
      console.error('Erreur predictNextMonthExpenses:', error);
      throw error;
    }
  }

  /**
   * Détecter anomalie sur un montant
   */
  static async detectAnomaly(userId, amount, category = null) {
    try {
      const last90Days = new Date();
      last90Days.setDate(last90Days.getDate() - 90);

      const query = {
        user: userId,
        type: 'expense',
        date: { $gte: last90Days }
      };

      if (category) {
        query.category = category;
      }

      const transactions = await Transaction.find(query).lean();

      if (!transactions || transactions.length < 5) {
        return {
          isAnomaly: false,
          confidence: 0,
          message: 'Pas assez de données historiques pour analyse'
        };
      }

      const amounts = transactions.map(tx => Math.abs(tx.amount));
      const mean = MLHelpers.mean(amounts);
      const stdDev = MLHelpers.standardDeviation(amounts);
      
      const zScore = (amount - mean) / stdDev;
      const isAnomaly = Math.abs(zScore) > 2;

      if (!isAnomaly) {
        return {
          isAnomaly: false,
          confidence: 0.9,
          message: 'Montant dans la normale'
        };
      }

      const deviationFactor = (amount / mean).toFixed(1);
      const severity = Math.abs(zScore) > 3 ? 'critical' : 'high';

      return {
        isAnomaly: true,
        confidence: Math.min(Math.abs(zScore) / 3, 1).toFixed(2),
        severity,
        details: {
          amount,
          average: Math.round(mean),
          deviationFactor: `${deviationFactor}x`,
          zScore: zScore.toFixed(1)
        },
        recommendation: `Cette dépense est ${deviationFactor}× votre moyenne${category ? ` en ${category}` : ''}. Vérifiez si c'est intentionnel.`
      };

    } catch (error) {
      console.error('Erreur detectAnomaly:', error);
      throw error;
    }
  }

  /**
   * Trouver utilisateurs similaires (clustering)
   */
  static async findSimilarUsers(userId, limit = 5) {
    try {
      const users = await User.find().limit(100).lean();
      
      if (users.length < 3) {
        return {
          similarUsers: [],
          message: 'Pas assez d\'utilisateurs pour analyse'
        };
      }

      const userProfiles = await Promise.all(
        users.map(async (user) => {
          const transactions = await Transaction.find({ user: user._id }).lean();
          
          const totalSpent = transactions
            .filter(tx => tx.type === 'expense')
            .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
          
          const avgMonthly = totalSpent / 3;
          
          const categories = {};
          transactions.forEach(tx => {
            const cat = tx.category || 'autre';
            categories[cat] = (categories[cat] || 0) + 1;
          });
          
          const topCategory = Object.entries(categories)
            .sort((a, b) => b[1] - a[1])[0]?.[0] || 'autre';

          return {
            userId: user._id,
            avgMonthly,
            topCategory,
            transactionCount: transactions.length
          };
        })
      );

      const currentUser = userProfiles.find(p => p.userId.toString() === userId.toString());
      
      if (!currentUser) {
        return {
          similarUsers: [],
          message: 'Utilisateur actuel introuvable'
        };
      }

      const similarities = userProfiles
        .filter(p => p.userId.toString() !== userId.toString())
        .map(profile => ({
          ...profile,
          similarity: this._calculateSimilarity(currentUser, profile)
        }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

      return {
        cluster: 1,
        clusterSize: userProfiles.length,
        similarUsers: similarities.map(s => ({
          userId: s.userId.toString(),
          similarity: parseFloat(s.similarity.toFixed(2)),
          patterns: {
            avgMonthly: s.avgMonthly,
            topCategory: s.topCategory
          }
        })),
        recommendations: similarities.length > 0 ? [
          {
            type: 'peer_comparison',
            message: `Les utilisateurs similaires dépensent en moyenne ${Math.round(MLHelpers.mean(similarities.map(s => s.avgMonthly)))} HTG/mois`
          }
        ] : []
      };

    } catch (error) {
      console.error('Erreur findSimilarUsers:', error);
      throw error;
    }
  }

  /**
   * Prédire dépenses par catégorie
   */
  static async predictCategoryExpense(userId, category) {
    try {
      const last3Months = new Date();
      last3Months.setMonth(last3Months.getMonth() - 3);

      const categoryExpenses = await Transaction.find({
        user: userId,
        type: 'expense',
        category,
        date: { $gte: last3Months }
      }).lean();

      if (categoryExpenses.length < 3) {
        return {
          category,
          prediction: null,
          confidence: 0,
          message: 'Pas assez de données pour cette catégorie'
        };
      }

      const monthly = {};
      categoryExpenses.forEach(tx => {
        const monthKey = `${new Date(tx.date).getFullYear()}-${new Date(tx.date).getMonth()}`;
        monthly[monthKey] = (monthly[monthKey] || 0) + Math.abs(tx.amount);
      });

      const amounts = Object.values(monthly);
      const avgMonthly = MLHelpers.mean(amounts);
      const trend = this._calculateTrend(amounts);

      return {
        category,
        prediction: Math.round(avgMonthly * (1 + trend)),
        confidence: 0.75,
        trend: trend > 0.05 ? 'increasing' : trend < -0.05 ? 'decreasing' : 'stable',
        historicalAvg: Math.round(avgMonthly)
      };

    } catch (error) {
      console.error('Erreur predictCategoryExpense:', error);
      throw error;
    }
  }

  /**
   * Analyser patterns temporels
   */
  static async analyzeTemporalPatterns(userId) {
    try {
      const last90Days = new Date();
      last90Days.setDate(last90Days.getDate() - 90);

      const transactions = await Transaction.find({
        user: userId,
        date: { $gte: last90Days }
      }).lean();

      if (!transactions || transactions.length === 0) {
        return {
          patterns: null,
          message: 'Pas de transactions pour analyse'
        };
      }

      const dayOfWeekMap = {};
      const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

      transactions.forEach(tx => {
        const day = new Date(tx.date).getDay();
        if (!dayOfWeekMap[day]) {
          dayOfWeekMap[day] = { count: 0, total: 0, day: dayNames[day] };
        }
        dayOfWeekMap[day].count++;
        dayOfWeekMap[day].total += Math.abs(tx.amount);
      });

      const dayOfWeek = Object.values(dayOfWeekMap)
        .map(d => ({
          day: d.day,
          avgAmount: Math.round(d.total / d.count),
          frequency: d.count
        }))
        .sort((a, b) => b.frequency - a.frequency);

      const hourMap = {};
      transactions.forEach(tx => {
        const hour = new Date(tx.date).getHours();
        hourMap[hour] = (hourMap[hour] || 0) + 1;
      });

      const peakHour = Object.entries(hourMap)
        .sort((a, b) => b[1] - a[1])[0];

      const uniqueDays = new Set(
        transactions.map(tx => new Date(tx.date).toDateString())
      ).size;

      return {
        patterns: {
          dayOfWeek,
          peakHour: peakHour ? {
            hour: peakHour[0],
            count: peakHour[1]
          } : null,
          consistency: {
            daysWithActivity: uniqueDays,
            totalDays: 90,
            consistencyRate: `${((uniqueDays / 90) * 100).toFixed(1)}%`
          }
        }
      };

    } catch (error) {
      console.error('Erreur analyzeTemporalPatterns:', error);
      throw error;
    }
  }

  // ============ MÉTHODES UTILITAIRES PRIVÉES ============

  static _calculateTrend(values) {
    if (values.length < 2) return 0;
    
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * values[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const avgValue = sumY / n;
    
    return slope / avgValue;
  }

  static _calculateSimilarity(user1, user2) {
    let similarity = 0;
    
    const spendingDiff = Math.abs(user1.avgMonthly - user2.avgMonthly);
    const maxSpending = Math.max(user1.avgMonthly, user2.avgMonthly);
    const spendingSimilarity = 1 - (spendingDiff / maxSpending);
    
    similarity += spendingSimilarity * 0.6;
    
    if (user1.topCategory === user2.topCategory) {
      similarity += 0.4;
    }
    
    return Math.max(0, Math.min(1, similarity));
  }
}

module.exports = MLService;