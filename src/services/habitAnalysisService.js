// src/services/habitAnalysisService.js
// Service d'analyse des habitudes financières personnelles

const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const Budget = require('../models/Budget');
const Sol = require('../models/Sol');
const MLHelpers = require('../utils/mlHelpers');

class HabitAnalysisService {
  
  /**
   * Analyser les patterns de dépenses d'un utilisateur
   */
  static async analyzeSpendingPatterns(userId, days = 90) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Récupérer transactions avec .lean() pour éviter erreur forEach
      const transactions = await Transaction.find({
        user: userId,
        date: { $gte: startDate }
      }).lean();

      if (!transactions || transactions.length === 0) {
        return {
          hasData: false,
          message: 'Pas assez de transactions pour analyser les patterns'
        };
      }

      // Calculer totaux et moyennes
      const totalSpent = transactions
        .filter(tx => tx.type === 'expense')
        .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

      const avgDaily = Math.round(totalSpent / days);
      const avgMonthly = Math.round(avgDaily * 30);
      const avgPerTransaction = Math.round(totalSpent / transactions.length);

      // Grouper par catégorie
      const categoryMap = {};
      transactions.forEach(tx => {
        if (tx.type === 'expense') {
          const cat = tx.category || 'autre';
          if (!categoryMap[cat]) {
            categoryMap[cat] = { total: 0, count: 0, transactions: [] };
          }
          categoryMap[cat].total += Math.abs(tx.amount);
          categoryMap[cat].count++;
          categoryMap[cat].transactions.push(tx);
        }
      });

      // Formater breakdown par catégorie
      const categoryBreakdown = Object.entries(categoryMap)
        .map(([category, data]) => ({
          category,
          name: this._getCategoryName(category),
          total: data.total,
          percentage: ((data.total / totalSpent) * 100).toFixed(1),
          count: data.count,
          avgAmount: Math.round(data.total / data.count).toString()
        }))
        .sort((a, b) => b.total - a.total);

      // Patterns temporels
      const timingPatterns = this._analyzeTimingFromTransactions(transactions);

      // Fréquence
      const uniqueDays = new Set(
        transactions.map(tx => new Date(tx.date).toDateString())
      ).size;

      const frequency = {
        daysWithTransactions: uniqueDays,
        totalDays: days,
        avgPerDay: (transactions.length / days).toFixed(2),
        level: this._getFrequencyLevel(transactions.length / days),
        consistency: `${((uniqueDays / days) * 100).toFixed(1)}%`
      };

      // Insights automatiques
      const insights = [];

      // Insight catégorie dominante
      if (categoryBreakdown.length > 0) {
        const topCategory = categoryBreakdown[0];
        insights.push({
          type: 'dominant_category',
          title: `${topCategory.name} domine vos dépenses`,
          description: `${topCategory.percentage}% de vos dépenses totales (${topCategory.total.toLocaleString()} HTG)`,
          impact: 'high',
          category: topCategory.category
        });
      }

      // Insight timing
      if (timingPatterns.mostActiveTime) {
        const timeCount = timingPatterns.timeOfDay[timingPatterns.mostActiveTime];
        insights.push({
          type: 'timing_pattern',
          title: `Vous dépensez principalement le ${timingPatterns.mostActiveTime}`,
          description: `${timeCount} transactions en ${timingPatterns.mostActiveTime}`,
          impact: 'medium'
        });
      }

      return {
        hasData: true,
        period: {
          days,
          startDate,
          endDate: new Date()
        },
        overview: {
          totalTransactions: transactions.length,
          totalSpent,
          avgDaily,
          avgMonthly,
          avgPerTransaction
        },
        categoryBreakdown,
        timingPatterns,
        frequency,
        insights
      };

    } catch (error) {
      console.error('Erreur analyzeSpendingPatterns:', error);
      throw error;
    }
  }

  /**
   * Détecter les anomalies dans les dépenses
   */
  static async detectAnomalies(userId, days = 90) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const transactions = await Transaction.find({
        user: userId,
        date: { $gte: startDate },
        type: 'expense'
      }).lean();

      if (!transactions || transactions.length === 0) {
        return {
          hasData: false,
          message: 'Pas assez de transactions pour détecter des anomalies'
        };
      }

      // Calculer statistiques
      const amounts = transactions.map(tx => Math.abs(tx.amount));
      const mean = MLHelpers.mean(amounts);
      const stdDev = MLHelpers.standardDeviation(amounts);

      // Seuil anomalie : 2 écarts-types
      const threshold = mean + (2 * stdDev);

      // Détecter anomalies
      const anomalies = [];
      transactions.forEach(tx => {
        const amount = Math.abs(tx.amount);
        if (amount > threshold) {
          const deviationFactor = (amount / mean).toFixed(1);
          const severity = amount > mean + (3 * stdDev) ? 'critical' : 'high';

          anomalies.push({
            transaction: tx,
            severity,
            deviationFactor: `${deviationFactor}x`,
            message: `${deviationFactor}× votre dépense moyenne (${Math.round(mean)} HTG)`
          });
        }
      });

      return {
        hasData: true,
        statistics: {
          mean: Math.round(mean),
          stdDev: Math.round(stdDev),
          threshold: Math.round(threshold)
        },
        anomalies: anomalies.sort((a, b) => 
          Math.abs(b.transaction.amount) - Math.abs(a.transaction.amount)
        )
      };

    } catch (error) {
      console.error('Erreur detectAnomalies:', error);
      throw error;
    }
  }

  /**
   * Calculer le score de santé financière
   */
  static async calculateFinancialHealth(userId) {
    try {
      let score = 0;
      const factors = [];

      // 1. Suivi des transactions (20 points)
      const txCount = await Transaction.countDocuments({ user: userId });
      if (txCount > 0) {
        const txPoints = Math.min(20, txCount);
        score += txPoints;
        factors.push({
          name: 'Suivi transactions',
          points: txPoints,
          status: 'positive'
        });
      }

      // 2. Utilisation budgets (25 points)
      const budgetCount = await Budget.countDocuments({ user: userId });
      if (budgetCount > 0) {
        const budgetPoints = Math.min(25, budgetCount * 5);
        score += budgetPoints;
        factors.push({
          name: 'Gestion budget',
          points: budgetPoints,
          status: 'positive'
        });
      }

      // 3. Participation sols (20 points)
      const solCount = await Sol.countDocuments({
        'participants.user': userId,
        status: 'active'
      });
      if (solCount > 0) {
        const solPoints = Math.min(20, solCount * 10);
        score += solPoints;
        factors.push({
          name: 'Épargne collective (sols)',
          points: solPoints,
          status: 'positive'
        });
      }

      // 4. Ratio épargne/dépenses (35 points)
      const last30Days = new Date();
      last30Days.setDate(last30Days.getDate() - 30);

      const expenses = await Transaction.aggregate([
        { 
          $match: { 
            user: userId, 
            type: 'expense',
            date: { $gte: last30Days }
          } 
        },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);

      const income = await Transaction.aggregate([
        { 
          $match: { 
            user: userId, 
            type: 'income',
            date: { $gte: last30Days }
          } 
        },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);

      const totalExpenses = expenses[0]?.total || 0;
      const totalIncome = income[0]?.total || 0;

      if (totalIncome > 0) {
        const savingsRate = ((totalIncome - Math.abs(totalExpenses)) / totalIncome) * 100;
        let savingsPoints = 0;
        
        if (savingsRate >= 20) {
          savingsPoints = 35;
        } else if (savingsRate >= 10) {
          savingsPoints = 25;
        } else if (savingsRate >= 5) {
          savingsPoints = 15;
        } else {
          savingsPoints = 5;
        }

        score += savingsPoints;
        factors.push({
          name: 'Excellent ratio épargne',
          points: savingsPoints,
          status: savingsRate >= 10 ? 'positive' : 'warning'
        });
      }

      // Niveau de santé
      const level = 
        score >= 80 ? 'Excellente' :
        score >= 60 ? 'Bonne' :
        score >= 40 ? 'Moyenne' :
        'À améliorer';

      // Recommandations
      const recommendations = [];
      if (budgetCount === 0) {
        recommendations.push('Créez des budgets pour mieux contrôler vos dépenses');
      }
      if (solCount === 0) {
        recommendations.push('Rejoignez un sol pour épargner collectivement');
      }
      if (txCount < 10) {
        recommendations.push('Suivez vos dépenses quotidiennes pour de meilleurs insights');
      }

      return {
        score,
        level,
        factors,
        recommendations
      };

    } catch (error) {
      console.error('Erreur calculateFinancialHealth:', error);
      throw error;
    }
  }

  /**
   * Identifier les habitudes récurrentes
   */
  static async identifyHabits(userId, days = 90) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // FIX: Ajouter .lean()
      const transactions = await Transaction.find({
        user: userId,
        date: { $gte: startDate }
      }).lean();

      if (!transactions || transactions.length === 0) {
        return {
          hasData: false,
          message: 'Pas assez de transactions pour identifier des habitudes'
        };
      }

      const habits = [];

      // 1. Habitudes de catégories récurrentes
      const categoryFrequency = {};
      transactions.forEach(tx => {
        const cat = tx.category || 'autre';
        categoryFrequency[cat] = (categoryFrequency[cat] || 0) + 1;
      });

      Object.entries(categoryFrequency).forEach(([category, count]) => {
        if (count >= 5) {
          const categoryTxs = transactions.filter(tx => tx.category === category);
          const avgAmount = categoryTxs.reduce((sum, tx) => sum + Math.abs(tx.amount), 0) / count;
          
          habits.push({
            type: 'category',
            category,
            description: `Dépenses régulières en ${this._getCategoryName(category)}`,
            frequency: count >= 20 ? 'très_fréquent' : count >= 10 ? 'fréquent' : 'régulier',
            count,
            avgAmount: Math.round(avgAmount),
            confidence: Math.min(count / 20, 1)
          });
        }
      });

      // 2. Habitudes de marchands récurrents
      const merchantFrequency = {};
      transactions.forEach(tx => {
        if (tx.description) {
          const merchant = tx.description.toLowerCase();
          merchantFrequency[merchant] = (merchantFrequency[merchant] || 0) + 1;
        }
      });

      Object.entries(merchantFrequency).forEach(([merchant, count]) => {
        if (count >= 3) {
          habits.push({
            type: 'merchant',
            merchant,
            description: `Achats récurrents: ${merchant}`,
            frequency: count >= 10 ? 'très_fréquent' : count >= 5 ? 'fréquent' : 'régulier',
            count,
            confidence: Math.min(count / 10, 1)
          });
        }
      });

      // 3. Habitudes temporelles
      const dayOfWeekFrequency = {};
      transactions.forEach(tx => {
        const dayOfWeek = new Date(tx.date).getDay();
        dayOfWeekFrequency[dayOfWeek] = (dayOfWeekFrequency[dayOfWeek] || 0) + 1;
      });

      const maxDay = Object.entries(dayOfWeekFrequency)
        .sort((a, b) => b[1] - a[1])[0];

      if (maxDay && maxDay[1] >= 5) {
        const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
        habits.push({
          type: 'timing',
          description: `Vous dépensez souvent le ${dayNames[maxDay[0]]}`,
          frequency: maxDay[1] >= 15 ? 'très_fréquent' : 'régulier',
          count: maxDay[1],
          confidence: Math.min(maxDay[1] / 15, 1)
        });
      }

      return {
        hasData: true,
        habits: habits.sort((a, b) => b.confidence - a.confidence),
        totalHabits: habits.length
      };

    } catch (error) {
      console.error('Erreur identifyHabits:', error);
      throw error;
    }
  }

  /**
   * Analyser les patterns temporels
   */
  static async analyzeTimingPatterns(userId, days = 90) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // FIX: Ajouter .lean()
      const transactions = await Transaction.find({
        user: userId,
        date: { $gte: startDate }
      }).lean();

      if (!transactions || transactions.length === 0) {
        return {
          hasData: false,
          message: 'Pas assez de transactions pour analyser patterns temporels'
        };
      }

      // Analyse par heure
      const hourlyPattern = {};
      for (let i = 0; i < 24; i++) {
        hourlyPattern[i] = { count: 0, total: 0 };
      }

      // Analyse par jour de semaine
      const weekdayPattern = {};
      const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
      
      transactions.forEach(tx => {
        const date = new Date(tx.date);
        const hour = date.getHours();
        const dayOfWeek = date.getDay();

        // Patterns horaires
        hourlyPattern[hour].count++;
        hourlyPattern[hour].total += Math.abs(tx.amount);

        // Patterns jour de semaine
        if (!weekdayPattern[dayOfWeek]) {
          weekdayPattern[dayOfWeek] = { count: 0, total: 0, day: dayNames[dayOfWeek] };
        }
        weekdayPattern[dayOfWeek].count++;
        weekdayPattern[dayOfWeek].total += Math.abs(tx.amount);
      });

      // Transformer en tableaux triés
      const byHour = Object.entries(hourlyPattern)
        .filter(([_, data]) => data.count > 0)
        .map(([hour, data]) => ({
          hour,
          count: data.count,
          avgAmount: Math.round(data.total / data.count)
        }))
        .sort((a, b) => b.count - a.count);

      const byDayOfWeek = Object.values(weekdayPattern)
        .filter(data => data.count > 0)
        .map(data => ({
          dayName: data.day,
          count: data.count,
          avgAmount: Math.round(data.total / data.count)
        }))
        .sort((a, b) => b.count - a.count);

      // Consistance
      const uniqueDays = new Set(
        transactions.map(tx => new Date(tx.date).toDateString())
      ).size;

      const patterns = {
        byHour,
        byDayOfWeek,
        peakHour: byHour.length > 0 ? byHour[0] : null,
        peakDay: byDayOfWeek.length > 0 ? byDayOfWeek[0] : null,
        consistency: {
          daysWithActivity: uniqueDays,
          totalDays: days,
          consistencyRate: `${((uniqueDays / days) * 100).toFixed(1)}%`
        }
      };

      // Insights
      const insights = [];
      
      if (patterns.peakHour) {
        insights.push(
          `Vous êtes plus actif à ${patterns.peakHour.hour}h (${patterns.peakHour.count} transactions)`
        );
      }
      
      if (patterns.peakDay) {
        insights.push(
          `${patterns.peakDay.dayName} est votre jour le plus actif (${patterns.peakDay.count} transactions)`
        );
      }
      
      if (uniqueDays / days < 0.3) {
        insights.push('Essayez de suivre vos dépenses plus régulièrement pour de meilleurs insights');
      }

      return {
        hasData: true,
        period: { days, startDate, endDate: new Date() },
        patterns,
        insights
      };

    } catch (error) {
      console.error('Erreur analyzeTimingPatterns:', error);
      throw error;
    }
  }

  /**
   * Analyser les patterns de localisation
   */
  static async analyzeLocationPatterns(userId, days = 90) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const transactions = await Transaction.find({
        user: userId,
        date: { $gte: startDate },
        'location.name': { $exists: true, $ne: null }
      }).lean();

      if (!transactions || transactions.length === 0) {
        return {
          hasData: false,
          message: 'Pas de données de localisation disponibles'
        };
      }

      // Grouper par localisation
      const locationMap = {};
      transactions.forEach(tx => {
        const loc = tx.location.name;
        if (!locationMap[loc]) {
          locationMap[loc] = { 
            frequency: 0, 
            totalAmount: 0, 
            transactions: [] 
          };
        }
        locationMap[loc].frequency++;
        locationMap[loc].totalAmount += Math.abs(tx.amount);
        locationMap[loc].transactions.push(tx);
      });

      const patterns = Object.entries(locationMap)
        .map(([location, data]) => ({
          location,
          frequency: data.frequency,
          totalAmount: data.totalAmount,
          avgAmount: Math.round(data.totalAmount / data.frequency)
        }))
        .sort((a, b) => b.frequency - a.frequency);

      return {
        hasData: true,
        patterns,
        topLocations: patterns.slice(0, 5)
      };

    } catch (error) {
      console.error('Erreur analyzeLocationPatterns:', error);
      throw error;
    }
  }

  // ============ MÉTHODES UTILITAIRES PRIVÉES ============

  static _getCategoryName(category) {
    const names = {
      alimentation: 'Alimentation',
      transport: 'Transport',
      logement: 'Logement',
      sante: 'Santé',
      education: 'Éducation',
      divertissement: 'Divertissement',
      services: 'Services',
      sols: 'Sols/Tontines',
      autre: 'Autre'
    };
    return names[category] || category;
  }

  static _analyzeTimingFromTransactions(transactions) {
    const timeOfDay = { morning: 0, afternoon: 0, evening: 0, night: 0 };
    const dayOfWeek = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    const weekendVsWeekday = { weekend: 0, weekday: 0 };

    transactions.forEach(tx => {
      const date = new Date(tx.date);
      const hour = date.getHours();
      const day = date.getDay();

      // Time of day
      if (hour >= 6 && hour < 12) timeOfDay.morning++;
      else if (hour >= 12 && hour < 18) timeOfDay.afternoon++;
      else if (hour >= 18 && hour < 22) timeOfDay.evening++;
      else timeOfDay.night++;

      // Day of week
      dayOfWeek[day]++;

      // Weekend vs weekday
      if (day === 0 || day === 6) weekendVsWeekday.weekend++;
      else weekendVsWeekday.weekday++;
    });

    const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const mostActiveDay = Object.entries(dayOfWeek)
      .sort((a, b) => b[1] - a[1])[0];

    const mostActiveTime = Object.entries(timeOfDay)
      .sort((a, b) => b[1] - a[1])[0][0];

    const totalTx = transactions.length;
    const weekendPercentage = ((weekendVsWeekday.weekend / totalTx) * 100).toFixed(1);

    return {
      timeOfDay,
      mostActiveTime,
      dayOfWeek,
      mostActiveDay: dayNames[mostActiveDay[0]],
      weekendVsWeekday,
      weekendPercentage
    };
  }

  static _getFrequencyLevel(avgPerDay) {
    if (avgPerDay < 0.1) return 'très_faible';
    if (avgPerDay < 0.5) return 'faible';
    if (avgPerDay < 1) return 'modérée';
    if (avgPerDay < 3) return 'élevée';
    return 'très_élevée';
  }
}

module.exports = HabitAnalysisService;