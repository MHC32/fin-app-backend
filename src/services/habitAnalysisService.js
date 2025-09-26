// src/services/habitAnalysisService.js
// Service d'analyse des habitudes financières - FinApp Haiti
// Version MVP - Phase 7 IA Foundation

const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const Sol = require('../models/Sol');
const { TRANSACTION_CATEGORIES } = require('../utils/constants');

/**
 * Service d'analyse des patterns comportementaux utilisateur
 * Utilise les données réelles collectées pour générer insights authentiques
 */
class HabitAnalysisService {

  // ===================================================================
  // 1. ANALYSE PATTERNS DÉPENSES
  // ===================================================================

  /**
   * Analyser patterns de dépenses utilisateur
   * @param {String} userId - ID utilisateur
   * @param {Number} daysBack - Nombre de jours à analyser (défaut 90)
   * @returns {Object} - Analyse complète patterns dépenses
   */
  static async analyzeSpendingPatterns(userId, daysBack = 90) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      // Récupérer transactions période
      const transactions = await Transaction.find({
        user: userId,
        date: { $gte: startDate },
        type: 'expense',
        isConfirmed: true
      }).sort({ date: -1 });

      if (transactions.length === 0) {
        return {
          hasData: false,
          message: 'Pas assez de données pour analyse',
          recommendedAction: 'Continuer à enregistrer vos transactions'
        };
      }

      // Calculs de base
      const totalSpent = transactions.reduce((sum, t) => sum + t.amount, 0);
      const avgDaily = totalSpent / daysBack;
      const avgMonthly = avgDaily * 30;

      // Analyse par catégorie
      const categoryBreakdown = this.analyzeCategoryBreakdown(transactions);

      // Top catégories
      const topCategories = Object.entries(categoryBreakdown)
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 5)
        .map(([category, data]) => ({
          category,
          name: TRANSACTION_CATEGORIES[category]?.name || category,
          total: data.total,
          percentage: ((data.total / totalSpent) * 100).toFixed(1),
          count: data.count,
          avgAmount: (data.total / data.count).toFixed(0)
        }));

      // Patterns temporels
      const timingPatterns = this.analyzeTimingPatterns(transactions);

      // Fréquence dépenses
      const frequency = this.calculateFrequency(transactions);

      return {
        hasData: true,
        period: {
          days: daysBack,
          startDate,
          endDate: new Date()
        },
        overview: {
          totalTransactions: transactions.length,
          totalSpent,
          avgDaily: Math.round(avgDaily),
          avgMonthly: Math.round(avgMonthly),
          avgPerTransaction: Math.round(totalSpent / transactions.length)
        },
        categoryBreakdown: topCategories,
        timingPatterns,
        frequency,
        insights: this.generateSpendingInsights(
          transactions, 
          categoryBreakdown, 
          timingPatterns
        )
      };

    } catch (error) {
      console.error('❌ Erreur analyse patterns:', error);
      throw error;
    }
  }

  /**
   * Analyser breakdown par catégorie
   */
  static analyzeCategoryBreakdown(transactions) {
    const breakdown = {};

    transactions.forEach(t => {
      if (!breakdown[t.category]) {
        breakdown[t.category] = {
          total: 0,
          count: 0,
          transactions: []
        };
      }

      breakdown[t.category].total += t.amount;
      breakdown[t.category].count += 1;
      breakdown[t.category].transactions.push(t);
    });

    return breakdown;
  }

  /**
   * Analyser patterns temporels (quand user dépense)
   */
  static analyzeTimingPatterns(transactions) {
    const timeOfDay = { morning: 0, afternoon: 0, evening: 0, night: 0 };
    const dayOfWeek = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    const weekendVsWeekday = { weekend: 0, weekday: 0 };

    transactions.forEach(t => {
      const hour = t.date.getHours();
      const day = t.date.getDay();

      // Time of day
      if (hour >= 5 && hour < 12) timeOfDay.morning++;
      else if (hour >= 12 && hour < 17) timeOfDay.afternoon++;
      else if (hour >= 17 && hour < 22) timeOfDay.evening++;
      else timeOfDay.night++;

      // Day of week
      dayOfWeek[day]++;

      // Weekend vs weekday
      if (day === 0 || day === 6) weekendVsWeekday.weekend++;
      else weekendVsWeekday.weekday++;
    });

    // Trouver période la plus active
    const mostActiveTime = Object.entries(timeOfDay)
      .sort((a, b) => b[1] - a[1])[0][0];

    const mostActiveDay = Object.entries(dayOfWeek)
      .sort((a, b) => b[1] - a[1])[0][0];

    const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

    return {
      timeOfDay,
      mostActiveTime,
      dayOfWeek,
      mostActiveDay: dayNames[mostActiveDay],
      weekendVsWeekday,
      weekendPercentage: ((weekendVsWeekday.weekend / transactions.length) * 100).toFixed(1)
    };
  }

  /**
   * Calculer fréquence dépenses
   */
  static calculateFrequency(transactions) {
    const totalDays = 90;
    const daysWithTransactions = new Set(
      transactions.map(t => t.date.toISOString().split('T')[0])
    ).size;

    const avgPerDay = transactions.length / totalDays;

    let frequencyLevel;
    if (avgPerDay >= 5) frequencyLevel = 'très_élevée';
    else if (avgPerDay >= 3) frequencyLevel = 'élevée';
    else if (avgPerDay >= 1) frequencyLevel = 'moyenne';
    else if (avgPerDay >= 0.5) frequencyLevel = 'faible';
    else frequencyLevel = 'très_faible';

    return {
      daysWithTransactions,
      totalDays,
      avgPerDay: avgPerDay.toFixed(2),
      level: frequencyLevel,
      consistency: ((daysWithTransactions / totalDays) * 100).toFixed(1) + '%'
    };
  }

  // ===================================================================
  // 2. GÉNÉRATION INSIGHTS
  // ===================================================================

  /**
   * Générer insights basés sur analyse
   */
  static generateSpendingInsights(transactions, categoryBreakdown, timingPatterns) {
    const insights = [];

    // Insight 1: Catégorie dominante
    const topCategory = Object.entries(categoryBreakdown)
      .sort((a, b) => b[1].total - a[1].total)[0];

    if (topCategory) {
      const [category, data] = topCategory;
      const percentage = (data.total / transactions.reduce((sum, t) => sum + t.amount, 0)) * 100;

      insights.push({
        type: 'dominant_category',
        title: `${TRANSACTION_CATEGORIES[category]?.name || category} domine vos dépenses`,
        description: `${percentage.toFixed(0)}% de vos dépenses totales (${data.total.toLocaleString()} HTG)`,
        impact: percentage > 40 ? 'high' : percentage > 25 ? 'medium' : 'low',
        category
      });
    }

    // Insight 2: Pattern temporel
    if (timingPatterns.mostActiveTime) {
      const timeLabels = {
        morning: 'matin',
        afternoon: 'après-midi',
        evening: 'soir',
        night: 'nuit'
      };

      insights.push({
        type: 'timing_pattern',
        title: `Vous dépensez principalement le ${timeLabels[timingPatterns.mostActiveTime]}`,
        description: `${timingPatterns.timeOfDay[timingPatterns.mostActiveTime]} transactions en ${timeLabels[timingPatterns.mostActiveTime]}`,
        impact: 'medium'
      });
    }

    // Insight 3: Weekend spending
    if (parseFloat(timingPatterns.weekendPercentage) > 40) {
      insights.push({
        type: 'weekend_spending',
        title: 'Dépenses week-end élevées',
        description: `${timingPatterns.weekendPercentage}% de vos dépenses sont en week-end`,
        impact: 'medium',
        suggestion: 'Planifier un budget week-end spécifique'
      });
    }

    return insights;
  }

  // ===================================================================
  // 3. DÉTECTION ANOMALIES
  // ===================================================================

  /**
   * Détecter dépenses anormales
   * @param {String} userId - ID utilisateur
   * @param {Number} daysBack - Période analyse
   * @returns {Object} - Anomalies détectées
   */
  static async detectAnomalies(userId, daysBack = 90) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      const transactions = await Transaction.find({
        user: userId,
        date: { $gte: startDate },
        type: 'expense',
        isConfirmed: true
      });

      if (transactions.length < 10) {
        return {
          hasData: false,
          message: 'Pas assez de données pour détecter anomalies'
        };
      }

      // Calculer statistiques
      const amounts = transactions.map(t => t.amount);
      const mean = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
      const variance = amounts.reduce((sum, a) => sum + Math.pow(a - mean, 2), 0) / amounts.length;
      const stdDev = Math.sqrt(variance);

      // Détecter anomalies (> 2 écarts-types)
      const threshold = mean + (2 * stdDev);
      const anomalies = transactions.filter(t => t.amount > threshold)
        .map(t => ({
          transaction: {
            id: t._id,
            amount: t.amount,
            description: t.description,
            category: t.category,
            date: t.date
          },
          severity: t.amount > mean + (3 * stdDev) ? 'critical' : 'warning',
          deviationFactor: (t.amount / mean).toFixed(1),
          message: `${(t.amount / mean).toFixed(1)}× votre dépense moyenne`
        }));

      return {
        hasData: true,
        statistics: {
          mean: Math.round(mean),
          stdDev: Math.round(stdDev),
          threshold: Math.round(threshold)
        },
        anomalies: anomalies.slice(0, 10), // Top 10 anomalies
        anomalyCount: anomalies.length,
        anomalyPercentage: ((anomalies.length / transactions.length) * 100).toFixed(1)
      };

    } catch (error) {
      console.error('❌ Erreur détection anomalies:', error);
      throw error;
    }
  }

  // ===================================================================
  // 4. SCORE SANTÉ FINANCIÈRE
  // ===================================================================

  /**
   * Calculer score santé financière utilisateur
   * @param {String} userId - ID utilisateur
   * @returns {Object} - Score et détails
   */
  static async calculateFinancialHealth(userId) {
    try {
      const [transactions, budgets, sols] = await Promise.all([
        Transaction.find({ user: userId, isConfirmed: true }).limit(1000),
        Budget.find({ user: userId, isActive: true }),
        Sol.find({
          $or: [
            { creator: userId },
            { 'participants.user': userId }
          ],
          status: { $in: ['recruiting', 'active'] }
        })
      ]);

      let score = 0;
      const factors = [];

      // Facteur 1: A des transactions (20 points)
      if (transactions.length > 0) {
        score += 20;
        factors.push({
          name: 'Suivi transactions',
          points: 20,
          status: 'positive'
        });
      }

      // Facteur 2: Utilise budgets (25 points)
      if (budgets.length > 0) {
        score += 25;
        factors.push({
          name: 'Gestion budgets',
          points: 25,
          status: 'positive'
        });
      }

      // Facteur 3: Participe sols (20 points)
      if (sols.length > 0) {
        score += 20;
        factors.push({
          name: 'Épargne collective (sols)',
          points: 20,
          status: 'positive'
        });
      }

      // Facteur 4: Ratio revenus/dépenses (35 points)
      const last30Days = new Date();
      last30Days.setDate(last30Days.getDate() - 30);

      const recentTransactions = transactions.filter(t => t.date >= last30Days);
      const income = recentTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
      const expenses = recentTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

      if (income > 0) {
        const ratio = expenses / income;
        if (ratio < 0.7) {
          score += 35;
          factors.push({
            name: 'Excellent ratio épargne',
            points: 35,
            status: 'excellent'
          });
        } else if (ratio < 0.9) {
          score += 25;
          factors.push({
            name: 'Bon ratio épargne',
            points: 25,
            status: 'good'
          });
        } else if (ratio < 1) {
          score += 15;
          factors.push({
            name: 'Ratio épargne correct',
            points: 15,
            status: 'warning'
          });
        } else {
          factors.push({
            name: 'Dépenses > revenus',
            points: 0,
            status: 'critical'
          });
        }
      }

      // Déterminer niveau santé
      let healthLevel;
      if (score >= 80) healthLevel = 'Excellente';
      else if (score >= 60) healthLevel = 'Bonne';
      else if (score >= 40) healthLevel = 'Moyenne';
      else if (score >= 20) healthLevel = 'Faible';
      else healthLevel = 'Critique';

      return {
        score,
        maxScore: 100,
        percentage: score,
        level: healthLevel,
        factors,
        recommendations: this.generateHealthRecommendations(score, factors)
      };

    } catch (error) {
      console.error('❌ Erreur calcul santé financière:', error);
      throw error;
    }
  }

  /**
   * Générer recommandations santé financière
   */
  static generateHealthRecommendations(score, factors) {
    const recommendations = [];

    if (score < 60) {
      recommendations.push({
        priority: 'high',
        title: 'Améliorer votre santé financière',
        actions: [
          'Créer un budget mensuel',
          'Suivre vos dépenses quotidiennes',
          'Rejoindre un sol pour épargner'
        ]
      });
    }

    const hasBudget = factors.find(f => f.name === 'Gestion budgets');
    if (!hasBudget) {
      recommendations.push({
        priority: 'medium',
        title: 'Créer votre premier budget',
        description: 'Un budget vous aide à contrôler vos dépenses'
      });
    }

    const hasSol = factors.find(f => f.name === 'Épargne collective (sols)');
    if (!hasSol) {
      recommendations.push({
        priority: 'medium',
        title: 'Rejoindre un sol/tontine',
        description: 'Épargner collectivement avec d\'autres personnes'
      });
    }

    return recommendations;
  }

  // ===================================================================
  // 5. IDENTIFICATION HABITUDES
  // ===================================================================

  /**
   * Identifier habitudes récurrentes
   * @param {String} userId - ID utilisateur
   * @returns {Object} - Habitudes identifiées
   */
  static async identifyHabits(userId) {
    try {
      const transactions = await Transaction.find({
        user: userId,
        type: 'expense',
        isConfirmed: true
      }).sort({ date: -1 }).limit(500);

      if (transactions.length < 20) {
        return {
          hasData: false,
          message: 'Pas assez de transactions pour identifier habitudes'
        };
      }

      const habits = [];

      // Habitude 1: Même marchand fréquent
      const merchantFrequency = {};
      transactions.forEach(t => {
        if (t.merchant?.name) {
          merchantFrequency[t.merchant.name] = (merchantFrequency[t.merchant.name] || 0) + 1;
        }
      });

      Object.entries(merchantFrequency)
        .filter(([_, count]) => count >= 5)
        .forEach(([merchant, count]) => {
          habits.push({
            type: 'frequent_merchant',
            description: `Vous visitez souvent "${merchant}"`,
            frequency: count,
            impact: 'medium'
          });
        });

      // Habitude 2: Catégorie quotidienne
      const dailyCategories = {};
      transactions.forEach(t => {
        const dateKey = t.date.toISOString().split('T')[0];
        if (!dailyCategories[dateKey]) {
          dailyCategories[dateKey] = {};
        }
        dailyCategories[dateKey][t.category] = true;
      });

      // Trouver catégories présentes 50%+ des jours
      const categoryDays = {};
      Object.values(dailyCategories).forEach(dayCategories => {
        Object.keys(dayCategories).forEach(cat => {
          categoryDays[cat] = (categoryDays[cat] || 0) + 1;
        });
      });

      const totalDays = Object.keys(dailyCategories).length;
      Object.entries(categoryDays)
        .filter(([_, days]) => days / totalDays > 0.5)
        .forEach(([category, days]) => {
          habits.push({
            type: 'daily_category',
            description: `Dépense quotidienne : ${TRANSACTION_CATEGORIES[category]?.name || category}`,
            frequency: days,
            percentage: ((days / totalDays) * 100).toFixed(0) + '%',
            impact: 'high'
          });
        });

      return {
        hasData: true,
        habits,
        habitCount: habits.length
      };

    } catch (error) {
      console.error('❌ Erreur identification habitudes:', error);
      throw error;
    }
  }
}

module.exports = HabitAnalysisService;