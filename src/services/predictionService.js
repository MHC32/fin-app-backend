// src/services/predictionService.js
// Service de prédictions financières avancées - FinApp Haiti
// Phase 7 IA Avancée

const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const Account = require('../models/Account');
const Sol = require('../models/Sol');
const MLModel = require('../models/MLModel');
const MLHelpers = require('../utils/mlHelpers');
const HabitAnalysisService = require('./habitAnalysisService');

class PredictionService {

  /**
   * Prédire dépenses futures avec séries temporelles avancées
   * @param {ObjectId} userId - ID utilisateur
   * @param {Number} months - Nombre de mois à prédire (1-12)
   * @returns {Object} - Prédictions détaillées
   */
  static async predictFutureExpenses(userId, months = 1) {
    try {
      // Récupérer historique transactions (12 derniers mois minimum)
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 12);

      const transactions = await Transaction.find({
        user: userId,
        type: 'expense',
        date: { $gte: startDate }
      }).sort({ date: 1 }).lean();

      if (transactions.length < 10) {
        return {
          success: false,
          message: 'Pas assez de données historiques (minimum 10 transactions)',
          dataPoints: transactions.length
        };
      }

      // Organiser données par mois
      const monthlyData = this._aggregateByMonth(transactions);

      // Calculer tendance avec régression linéaire
      const trend = this._calculateTrend(monthlyData);

      // Détecter saisonnalité
      const seasonality = this._detectSeasonality(monthlyData);

      // Générer prédictions pour N mois
      const predictions = [];
      let lastMonthIndex = monthlyData.length - 1;

      for (let i = 1; i <= months; i++) {
        const basePrediction = this._linearPrediction(lastMonthIndex + i, trend);
        const seasonalAdjustment = this._applySeasonality(i, seasonality);
        const finalPrediction = Math.round(basePrediction * seasonalAdjustment);

        predictions.push({
          month: i,
          date: this._getMonthDate(i),
          prediction: finalPrediction,
          basePrediction: Math.round(basePrediction),
          seasonalFactor: seasonalAdjustment.toFixed(2),
          confidence: this._calculateConfidence(monthlyData.length, i)
        });
      }

      // Calculer intervalles de confiance
      const stdDev = MLHelpers.standardDeviation(monthlyData.map(m => m.total));
      predictions.forEach(pred => {
        pred.lowerBound = Math.max(0, Math.round(pred.prediction - stdDev));
        pred.upperBound = Math.round(pred.prediction + stdDev);
      });

      return {
        success: true,
        predictions,
        analysis: {
          trend: trend.direction,
          trendStrength: trend.strength,
          seasonalityDetected: seasonality.detected,
          historicalMonths: monthlyData.length,
          avgMonthly: Math.round(MLHelpers.mean(monthlyData.map(m => m.total))),
          volatility: this._calculateVolatility(monthlyData)
        },
        recommendations: this._generatePredictionRecommendations(predictions, trend)
      };

    } catch (error) {
      console.error('Erreur predictFutureExpenses:', error);
      throw error;
    }
  }

  /**
   * Prédire revenus futurs basés sur patterns
   * @param {ObjectId} userId - ID utilisateur
   * @param {Number} months - Nombre de mois à prédire
   * @returns {Object} - Prédictions revenus
   */
  static async predictFutureIncome(userId, months = 3) {
    try {
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 12);

      const incomeTransactions = await Transaction.find({
        user: userId,
        type: 'income',
        date: { $gte: startDate }
      }).sort({ date: 1 }).lean();

      if (incomeTransactions.length < 3) {
        return {
          success: false,
          message: 'Pas assez de données revenus',
          dataPoints: incomeTransactions.length
        };
      }

      // Analyser patterns revenus
      const monthlyIncome = this._aggregateByMonth(incomeTransactions);
      const incomePattern = this._analyzeIncomePattern(monthlyIncome);

      // Générer prédictions
      const predictions = [];

      for (let i = 1; i <= months; i++) {
        let prediction;

        if (incomePattern.type === 'regular') {
          // Revenu régulier (salaire)
          prediction = Math.round(incomePattern.avgAmount * (1 + incomePattern.growthRate));
        } else if (incomePattern.type === 'variable') {
          // Revenu variable (business)
          const trend = this._calculateTrend(monthlyIncome);
          prediction = Math.round(this._linearPrediction(monthlyIncome.length + i, trend));
        } else {
          // Revenu mixte
          prediction = Math.round(incomePattern.avgAmount);
        }

        predictions.push({
          month: i,
          date: this._getMonthDate(i),
          prediction,
          type: incomePattern.type,
          confidence: incomePattern.type === 'regular' ? 0.85 : 0.65
        });
      }

      return {
        success: true,
        predictions,
        pattern: incomePattern,
        recommendations: this._generateIncomeRecommendations(incomePattern)
      };

    } catch (error) {
      console.error('Erreur predictFutureIncome:', error);
      throw error;
    }
  }

  /**
   * Prédire risques de dépassement budget
   * @param {ObjectId} userId - ID utilisateur
   * @returns {Object} - Analyse risques budget
   */
  static async predictBudgetRisks(userId) {
    try {
      // Récupérer budgets actifs
      const budgets = await Budget.find({
        user: userId,
        isActive: true
      });

      if (budgets.length === 0) {
        return {
          success: false,
          message: 'Aucun budget actif trouvé'
        };
      }

      const risks = [];

      for (const budget of budgets) {
        const percentUsed = (budget.spent / budget.amount) * 100;
        const daysRemaining = Math.ceil((budget.endDate - new Date()) / (1000 * 60 * 60 * 24));
        
        if (daysRemaining <= 0) continue;

        // Calculer taux de dépense quotidien
        const daysElapsed = Math.ceil((new Date() - budget.startDate) / (1000 * 60 * 60 * 24));
        const dailyRate = budget.spent / daysElapsed;
        
        // Projeter dépenses futures
        const projectedTotal = budget.spent + (dailyRate * daysRemaining);
        const projectedPercent = (projectedTotal / budget.amount) * 100;

        // Calculer risque
        let riskLevel = 'low';
        let riskScore = 0;

        if (projectedPercent >= 100) {
          riskLevel = 'high';
          riskScore = Math.min(100, Math.round((projectedPercent - 100) * 2 + 70));
        } else if (projectedPercent >= 90) {
          riskLevel = 'medium';
          riskScore = Math.round(50 + (projectedPercent - 90) * 2);
        } else {
          riskLevel = 'low';
          riskScore = Math.round(projectedPercent / 2);
        }

        risks.push({
          budgetId: budget._id,
          budgetName: budget.name,
          category: budget.category,
          currentSpent: budget.spent,
          budgetAmount: budget.amount,
          percentUsed: Math.round(percentUsed),
          daysRemaining,
          dailyRate: Math.round(dailyRate),
          projectedTotal: Math.round(projectedTotal),
          projectedPercent: Math.round(projectedPercent),
          riskLevel,
          riskScore,
          recommendation: this._getBudgetRiskRecommendation(riskLevel, projectedPercent, budget)
        });
      }

      // Trier par risque décroissant
      risks.sort((a, b) => b.riskScore - a.riskScore);

      return {
        success: true,
        totalBudgets: budgets.length,
        highRisk: risks.filter(r => r.riskLevel === 'high').length,
        mediumRisk: risks.filter(r => r.riskLevel === 'medium').length,
        lowRisk: risks.filter(r => r.riskLevel === 'low').length,
        risks,
        overallRisk: this._calculateOverallBudgetRisk(risks)
      };

    } catch (error) {
      console.error('Erreur predictBudgetRisks:', error);
      throw error;
    }
  }

  /**
   * Calculer capacité d'épargne optimale
   * @param {ObjectId} userId - ID utilisateur
   * @returns {Object} - Analyse capacité épargne
   */
  static async predictSavingsCapacity(userId) {
    try {
      // Analyser patterns dépenses et revenus (3 derniers mois)
      const patterns = await HabitAnalysisService.analyzeSpendingPatterns(userId, 90);

      if (!patterns.hasData) {
        return {
          success: false,
          message: 'Pas assez de données pour analyser capacité épargne'
        };
      }

      const monthlyIncome = patterns.overview.totalIncome || 0;
      const monthlyExpenses = patterns.overview.totalSpent || 0;
      const currentSavings = monthlyIncome - monthlyExpenses;

      // Identifier dépenses compressibles
      const compressibleExpenses = this._identifyCompressibleExpenses(patterns);
      const potentialSavings = compressibleExpenses.reduce((sum, cat) => sum + cat.savingsPotential, 0);

      // Calculer capacité épargne optimale (règle 50/30/20)
      const optimalSavingsRate = 0.20; // 20% revenus
      const optimalSavings = Math.round(monthlyIncome * optimalSavingsRate);

      // Recommander étapes progressives
      const savingsSteps = [
        {
          level: 'beginner',
          target: Math.round(monthlyIncome * 0.05), // 5%
          timeframe: '1 mois',
          difficulty: 'facile'
        },
        {
          level: 'intermediate',
          target: Math.round(monthlyIncome * 0.10), // 10%
          timeframe: '3 mois',
          difficulty: 'modéré'
        },
        {
          level: 'advanced',
          target: Math.round(monthlyIncome * 0.15), // 15%
          timeframe: '6 mois',
          difficulty: 'exigeant'
        },
        {
          level: 'expert',
          target: optimalSavings, // 20%
          timeframe: '12 mois',
          difficulty: 'optimal'
        }
      ];

      return {
        success: true,
        currentSituation: {
          monthlyIncome,
          monthlyExpenses,
          currentSavings,
          savingsRate: monthlyIncome > 0 ? Math.round((currentSavings / monthlyIncome) * 100) : 0
        },
        potential: {
          compressibleExpenses,
          potentialMonthlySavings: potentialSavings,
          potentialAnnualSavings: potentialSavings * 12
        },
        optimal: {
          monthlySavings: optimalSavings,
          annualSavings: optimalSavings * 12,
          savingsRate: Math.round(optimalSavingsRate * 100)
        },
        roadmap: savingsSteps,
        recommendations: this._generateSavingsRecommendations(currentSavings, optimalSavings, compressibleExpenses)
      };

    } catch (error) {
      console.error('Erreur predictSavingsCapacity:', error);
      throw error;
    }
  }

  /**
   * Prédire meilleur moment pour rejoindre un sol
   * @param {ObjectId} userId - ID utilisateur
   * @param {Object} solDetails - Détails du sol à analyser
   * @returns {Object} - Analyse timing sol
   */
  static async predictOptimalSolTiming(userId, solDetails) {
    try {
      const { amount, frequency, participants } = solDetails;

      // Analyser flux de trésorerie utilisateur
      const cashFlowAnalysis = await this._analyzeCashFlow(userId);

      // Calculer charge mensuelle sol
      const monthlyCharge = frequency === 'weekly' 
        ? amount * 4 
        : frequency === 'biweekly' 
        ? amount * 2 
        : amount;

      // Vérifier capacité paiement
      const canAfford = cashFlowAnalysis.averageSurplus >= monthlyCharge;
      const comfortMargin = cashFlowAnalysis.averageSurplus - monthlyCharge;

      // Calculer meilleur moment dans le mois
      const bestDay = this._calculateBestPaymentDay(cashFlowAnalysis, frequency);

      // Simuler ROI du sol
      const totalInput = amount * participants;
      const totalReceived = totalInput; // Simplifié, à ajuster selon règles
      const roi = ((totalReceived - totalInput) / totalInput) * 100;

      return {
        success: true,
        feasibility: {
          canAfford,
          monthlyCharge,
          availableSurplus: Math.round(cashFlowAnalysis.averageSurplus),
          comfortMargin: Math.round(comfortMargin),
          recommendation: canAfford 
            ? comfortMargin > monthlyCharge * 0.2 
              ? 'Excellent timing, vous avez une marge confortable'
              : 'Possible mais serré, surveillez vos dépenses'
            : 'Déconseillé pour le moment, augmentez d\'abord vos revenus'
        },
        timing: {
          bestPaymentDay: bestDay,
          reasoning: this._explainPaymentTiming(bestDay, cashFlowAnalysis)
        },
        simulation: {
          totalToInvest: amount * participants,
          expectedReturn: totalReceived,
          estimatedROI: Math.round(roi),
          duration: `${participants} ${frequency === 'monthly' ? 'mois' : 'semaines'}`
        },
        risks: this._assessSolRisks(solDetails, cashFlowAnalysis)
      };

    } catch (error) {
      console.error('Erreur predictOptimalSolTiming:', error);
      throw error;
    }
  }

  /**
   * Prédire impact d'une nouvelle dette
   * @param {ObjectId} userId - ID utilisateur
   * @param {Object} debtDetails - Détails de la dette
   * @returns {Object} - Analyse impact dette
   */
  static async predictDebtImpact(userId, debtDetails) {
    try {
      const { amount, interestRate = 0, duration, monthlyPayment } = debtDetails;

      // Analyser situation financière actuelle
      const patterns = await HabitAnalysisService.analyzeSpendingPatterns(userId, 90);
      const health = await HabitAnalysisService.calculateFinancialHealth(userId);

      if (!patterns.hasData) {
        return {
          success: false,
          message: 'Pas assez de données pour analyser impact'
        };
      }

      const monthlyIncome = patterns.overview.totalIncome || 0;
      const monthlyExpenses = patterns.overview.totalSpent || 0;
      const currentSurplus = monthlyIncome - monthlyExpenses;

      // Calculer impact sur budget
      const newSurplus = currentSurplus - monthlyPayment;
      const debtToIncomeRatio = (monthlyPayment / monthlyIncome) * 100;

      // Calculer nouveau score santé (estimation)
      let newHealthScore = health.score;
      if (debtToIncomeRatio > 30) newHealthScore -= 20;
      else if (debtToIncomeRatio > 20) newHealthScore -= 10;
      else if (debtToIncomeRatio > 10) newHealthScore -= 5;

      // Simuler remboursement
      const totalInterest = (amount * interestRate * duration) / 100;
      const totalRepayment = amount + totalInterest;

      // Évaluer risque
      let riskLevel = 'low';
      if (debtToIncomeRatio > 30 || newSurplus < 0) riskLevel = 'high';
      else if (debtToIncomeRatio > 20 || newSurplus < monthlyExpenses * 0.1) riskLevel = 'medium';

      return {
        success: true,
        impact: {
          monthlyPayment,
          currentSurplus: Math.round(currentSurplus),
          newSurplus: Math.round(newSurplus),
          debtToIncomeRatio: Math.round(debtToIncomeRatio),
          currentHealthScore: health.score,
          projectedHealthScore: Math.max(0, Math.round(newHealthScore)),
          healthImpact: Math.round(health.score - newHealthScore)
        },
        repayment: {
          principal: amount,
          interest: Math.round(totalInterest),
          total: Math.round(totalRepayment),
          duration,
          effectiveRate: interestRate
        },
        risk: {
          level: riskLevel,
          factors: this._identifyDebtRiskFactors(debtToIncomeRatio, newSurplus, health.score),
          recommendation: this._getDebtRecommendation(riskLevel, debtDetails, currentSurplus)
        },
        alternatives: this._suggestDebtAlternatives(amount, monthlyPayment, currentSurplus)
      };

    } catch (error) {
      console.error('Erreur predictDebtImpact:', error);
      throw error;
    }
  }

  // ===================================================================
  // MÉTHODES PRIVÉES - CALCULS
  // ===================================================================

  /**
   * Agréger transactions par mois
   */
  static _aggregateByMonth(transactions) {
    const monthlyMap = {};

    transactions.forEach(tx => {
      const monthKey = `${tx.date.getFullYear()}-${tx.date.getMonth() + 1}`;
      if (!monthlyMap[monthKey]) {
        monthlyMap[monthKey] = {
          month: monthKey,
          total: 0,
          count: 0,
          transactions: []
        };
      }
      monthlyMap[monthKey].total += tx.amount;
      monthlyMap[monthKey].count++;
      monthlyMap[monthKey].transactions.push(tx);
    });

    return Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month));
  }

  /**
   * Calculer tendance avec régression linéaire
   */
  static _calculateTrend(monthlyData) {
    const n = monthlyData.length;
    const xValues = Array.from({ length: n }, (_, i) => i);
    const yValues = monthlyData.map(m => m.total);

    const sumX = xValues.reduce((a, b) => a + b, 0);
    const sumY = yValues.reduce((a, b) => a + b, 0);
    const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
    const sumX2 = xValues.reduce((sum, x) => sum + x * x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return {
      slope,
      intercept,
      direction: slope > 5 ? 'increasing' : slope < -5 ? 'decreasing' : 'stable',
      strength: Math.abs(slope)
    };
  }

  /**
   * Détecter saisonnalité
   */
  static _detectSeasonality(monthlyData) {
    if (monthlyData.length < 12) {
      return { detected: false, pattern: null };
    }

    // Extraire patterns mensuels (simplifiée)
    const monthlyAvg = monthlyData.map(m => m.total);
    const overallAvg = MLHelpers.mean(monthlyAvg);
    
    const seasonalFactors = monthlyAvg.map(val => val / overallAvg);
    const avgDeviation = MLHelpers.mean(seasonalFactors.map(f => Math.abs(f - 1)));

    return {
      detected: avgDeviation > 0.15, // 15% déviation = saisonnalité
      pattern: seasonalFactors,
      strength: avgDeviation
    };
  }

  /**
   * Prédiction linéaire
   */
  static _linearPrediction(x, trend) {
    return trend.slope * x + trend.intercept;
  }

  /**
   * Appliquer ajustement saisonnier
   */
  static _applySeasonality(monthOffset, seasonality) {
    if (!seasonality.detected || !seasonality.pattern) {
      return 1.0;
    }

    const monthIndex = (new Date().getMonth() + monthOffset) % 12;
    return seasonality.pattern[monthIndex] || 1.0;
  }

  /**
   * Calculer confiance prédiction
   */
  static _calculateConfidence(dataPoints, monthsAhead) {
    const baseConfidence = Math.min(0.95, dataPoints / 12 * 0.8);
    const decayFactor = Math.pow(0.9, monthsAhead - 1);
    return Math.round(baseConfidence * decayFactor * 100) / 100;
  }

  /**
   * Calculer volatilité
   */
  static _calculateVolatility(monthlyData) {
    const values = monthlyData.map(m => m.total);
    const mean = MLHelpers.mean(values);
    const stdDev = MLHelpers.standardDeviation(values);
    const cv = (stdDev / mean) * 100; // Coefficient de variation

    if (cv < 15) return 'low';
    if (cv < 30) return 'medium';
    return 'high';
  }

  /**
   * Générer date future
   */
  static _getMonthDate(monthsAhead) {
    const date = new Date();
    date.setMonth(date.getMonth() + monthsAhead);
    return date;
  }

  /**
   * Analyser pattern revenus
   */
  static _analyzeIncomePattern(monthlyIncome) {
    const amounts = monthlyIncome.map(m => m.total);
    const avgAmount = MLHelpers.mean(amounts);
    const stdDev = MLHelpers.standardDeviation(amounts);
    const cv = (stdDev / avgAmount) * 100;

    // Calculer taux de croissance
    const trend = this._calculateTrend(monthlyIncome);
    const growthRate = trend.slope / avgAmount;

    let type;
    if (cv < 10) type = 'regular'; // Revenu stable (salaire)
    else if (cv < 30) type = 'mixed'; // Mixte
    else type = 'variable'; // Variable (business)

    return {
      type,
      avgAmount: Math.round(avgAmount),
      volatility: cv,
      growthRate,
      consistency: cv < 10 ? 'high' : cv < 30 ? 'medium' : 'low'
    };
  }

  /**
   * Analyser flux de trésorerie
   */
  static async _analyzeCashFlow(userId) {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 3);

    const transactions = await Transaction.find({
      user: userId,
      date: { $gte: startDate }
    }).sort({ date: 1 }).lean();

    const dailyCashFlow = {};

    transactions.forEach(tx => {
      const day = tx.date.getDate();
      if (!dailyCashFlow[day]) {
        dailyCashFlow[day] = { income: 0, expense: 0 };
      }

      if (tx.type === 'income') dailyCashFlow[day].income += tx.amount;
      else if (tx.type === 'expense') dailyCashFlow[day].expense += tx.amount;
    });

    const dailySurplus = Object.entries(dailyCashFlow).map(([day, flow]) => ({
      day: parseInt(day),
      surplus: flow.income - flow.expense
    }));

    const avgSurplus = dailySurplus.length > 0
      ? dailySurplus.reduce((sum, d) => sum + d.surplus, 0) / dailySurplus.length
      : 0;

    return {
      dailyCashFlow,
      dailySurplus,
      averageSurplus: avgSurplus,
      bestDays: dailySurplus.filter(d => d.surplus > avgSurplus).map(d => d.day)
    };
  }

  /**
   * Calculer meilleur jour de paiement
   */
  static _calculateBestPaymentDay(cashFlowAnalysis, frequency) {
    if (cashFlowAnalysis.bestDays.length === 0) {
      return frequency === 'monthly' ? 5 : 15; // Défaut
    }

    // Retourner jour avec meilleur surplus
    const sorted = cashFlowAnalysis.dailySurplus.sort((a, b) => b.surplus - a.surplus);
    return sorted[0].day;
  }

  /**
   * Identifier dépenses compressibles
   */
  static _identifyCompressibleExpenses(patterns) {
    if (!patterns.categoryBreakdown) return [];

    const compressible = ['transport', 'divertissement', 'alimentation', 'services'];
    
    return patterns.categoryBreakdown
      .filter(cat => compressible.includes(cat.category))
      .map(cat => ({
        category: cat.category,
        name: cat.name,
        current: cat.total,
        savingsPotential: Math.round(cat.total * 0.15), // 15% réduction réaliste
        percentage: 15
      }));
  }

  // ===================================================================
  // MÉTHODES PRIVÉES - RECOMMANDATIONS
  // ===================================================================

  /**
   * Générer recommandations prédictions
   */
  static _generatePredictionRecommendations(predictions, trend) {
    const recommendations = [];

    if (trend.direction === 'increasing') {
      recommendations.push({
        type: 'alert',
        message: `Vos dépenses augmentent de ${Math.round(trend.strength)} HTG/mois. Prenez des mesures correctives.`
      });
    }

    const avgPrediction = MLHelpers.mean(predictions.map(p => p.prediction));
    if (avgPrediction > predictions[0].prediction * 1.1) {
      recommendations.push({
        type: 'warning',
        message: `Augmentation de ${Math.round(((avgPrediction / predictions[0].prediction) - 1) * 100)}% prévue. Ajustez vos budgets.`
      });
    }

    return recommendations;
  }

  /**
   * Générer recommandations revenus
   */
  static _generateIncomeRecommendations(pattern) {
    const recommendations = [];

    if (pattern.type === 'variable') {
      recommendations.push({
        priority: 'high',
        message: 'Revenus variables détectés. Constituez un fonds d\'urgence de 3-6 mois de dépenses.'
      });
    }

    if (pattern.growthRate < 0) {
      recommendations.push({
        priority: 'urgent',
        message: `Vos revenus diminuent de ${Math.round(Math.abs(pattern.growthRate) * 100)}%. Diversifiez vos sources de revenus.`
      });
    }

    return recommendations;
  }

  /**
   * Recommandation risque budget
   */
  static _getBudgetRiskRecommendation(riskLevel, projectedPercent, budget) {
    if (riskLevel === 'high') {
      return `URGENT: Réduisez immédiatement vos dépenses en ${budget.name}. Dépassement de ${Math.round(projectedPercent - 100)}% prévu.`;
    } else if (riskLevel === 'medium') {
      return `ATTENTION: Ralentissez vos dépenses en ${budget.name}. Vous approchez la limite.`;
    } else {
      return `Situation stable pour ${budget.name}. Maintenez le rythme actuel.`;
    }
  }

  /**
   * Calculer risque budget global
   */
  static _calculateOverallBudgetRisk(risks) {
    if (risks.length === 0) return 'none';

    const avgRiskScore = MLHelpers.mean(risks.map(r => r.riskScore));
    
    if (avgRiskScore >= 70) return 'critical';
    if (avgRiskScore >= 50) return 'high';
    if (avgRiskScore >= 30) return 'medium';
    return 'low';
  }

  /**
   * Générer recommandations épargne
   */
  static _generateSavingsRecommendations(current, optimal, compressible) {
    const recommendations = [];
    const gap = optimal - current;

    if (gap > 0) {
      recommendations.push({
        priority: 'high',
        message: `Pour atteindre l'épargne optimale, économisez ${gap} HTG de plus par mois.`
      });

      if (compressible.length > 0) {
        const topSaving = compressible[0];
        recommendations.push({
          priority: 'medium',
          message: `Commencez par réduire ${topSaving.name} de ${topSaving.percentage}% pour économiser ${topSaving.savingsPotential} HTG/mois.`
        });
      }
    } else {
      recommendations.push({
        priority: 'low',
        message: `Excellent ! Vous épargnez déjà ${Math.abs(gap)} HTG de plus que l'objectif optimal.`
      });
    }

    return recommendations;
  }

  /**
   * Expliquer timing paiement sol
   */
  static _explainPaymentTiming(bestDay, cashFlowAnalysis) {
    if (bestDay >= 1 && bestDay <= 5) {
      return 'Début de mois recommandé car vous avez généralement plus de liquidités après réception du salaire.';
    } else if (bestDay >= 25) {
      return 'Fin de mois recommandé car votre flux de trésorerie est meilleur à cette période.';
    } else {
      return 'Mi-mois recommandé pour équilibrer votre trésorerie tout au long du mois.';
    }
  }

  /**
   * Évaluer risques sol
   */
  static _assessSolRisks(solDetails, cashFlowAnalysis) {
    const risks = [];
    const { amount, participants, frequency } = solDetails;

    // Risque liquidité
    const monthlyCharge = frequency === 'weekly' ? amount * 4 : amount;
    if (monthlyCharge > cashFlowAnalysis.averageSurplus * 0.5) {
      risks.push({
        type: 'liquidity',
        level: 'high',
        message: 'Le paiement sol représente plus de 50% de votre surplus mensuel'
      });
    }

    // Risque participants
    if (participants > 20) {
      risks.push({
        type: 'duration',
        level: 'medium',
        message: `Durée longue (${participants} ${frequency === 'monthly' ? 'mois' : 'semaines'}). Risque d\'abandon augmenté.`
      });
    }

    // Risque défaut
    risks.push({
      type: 'default',
      level: 'medium',
      message: 'Risque de non-paiement d\'autres participants. Vérifiez la réputation de l\'organisateur.'
    });

    if (risks.length === 0) {
      risks.push({
        type: 'general',
        level: 'low',
        message: 'Niveau de risque acceptable pour ce sol'
      });
    }

    return risks;
  }

  /**
   * Identifier facteurs risque dette
   */
  static _identifyDebtRiskFactors(debtToIncomeRatio, newSurplus, healthScore) {
    const factors = [];

    if (debtToIncomeRatio > 30) {
      factors.push({
        factor: 'Ratio dette/revenu élevé',
        impact: 'critique',
        description: `${Math.round(debtToIncomeRatio)}% de vos revenus iront au remboursement`
      });
    }

    if (newSurplus < 0) {
      factors.push({
        factor: 'Surplus négatif',
        impact: 'critique',
        description: 'Vous ne pourrez pas couvrir vos dépenses actuelles'
      });
    }

    if (healthScore < 50) {
      factors.push({
        factor: 'Santé financière fragile',
        impact: 'élevé',
        description: 'Votre situation financière est déjà précaire'
      });
    }

    if (factors.length === 0) {
      factors.push({
        factor: 'Situation gérable',
        impact: 'faible',
        description: 'Cette dette semble gérable avec votre situation actuelle'
      });
    }

    return factors;
  }

  /**
   * Recommandation dette
   */
  static _getDebtRecommendation(riskLevel, debtDetails, currentSurplus) {
    const { amount, monthlyPayment, duration } = debtDetails;

    if (riskLevel === 'high') {
      return {
        action: 'DÉCONSEILLÉ',
        message: `Ne prenez pas cette dette maintenant. Votre situation financière ne le permet pas.`,
        alternatives: [
          'Réduire le montant emprunté',
          'Négocier une durée plus longue pour réduire les mensualités',
          'Attendre d\'améliorer vos revenus',
          'Chercher des alternatives sans dette'
        ]
      };
    } else if (riskLevel === 'medium') {
      return {
        action: 'AVEC PRÉCAUTION',
        message: `Possible mais risqué. Assurez-vous d'avoir un plan de remboursement solide.`,
        alternatives: [
          'Négocier un taux d\'intérêt plus bas',
          'Réduire vos dépenses non-essentielles de 15%',
          'Constituer d\'abord un fonds d\'urgence',
          'Envisager une durée plus courte si possible'
        ]
      };
    } else {
      return {
        action: 'ACCEPTABLE',
        message: `Cette dette semble gérable avec votre situation actuelle.`,
        alternatives: [
          'Comparer plusieurs offres pour le meilleur taux',
          'Rembourser par anticipation si possible',
          'Maintenir votre épargne d\'urgence',
          'Programmer des paiements automatiques'
        ]
      };
    }
  }

  /**
   * Suggérer alternatives dette
   */
  static _suggestDebtAlternatives(amount, monthlyPayment, currentSurplus) {
    const alternatives = [];

    // Alternative 1: Épargne progressive
    if (currentSurplus > 0) {
      const monthsToSave = Math.ceil(amount / currentSurplus);
      if (monthsToSave <= 12) {
        alternatives.push({
          type: 'savings',
          title: 'Épargner progressivement',
          description: `Économisez ${Math.round(currentSurplus)} HTG/mois pendant ${monthsToSave} mois au lieu d'emprunter`,
          advantage: 'Aucun intérêt à payer',
          timeframe: `${monthsToSave} mois`
        });
      }
    }

    // Alternative 2: Sol/Tontine
    const solMonthly = Math.round(amount / 10); // Sol sur 10 mois
    if (solMonthly < currentSurplus * 0.5) {
      alternatives.push({
        type: 'sol',
        title: 'Rejoindre un sol',
        description: `Participez à un sol avec cotisation de ${solMonthly} HTG/mois`,
        advantage: 'Épargne forcée + intérêts potentiels (8-12%)',
        timeframe: '10 mois'
      });
    }

    // Alternative 3: Prêt personnel avec meilleur taux
    alternatives.push({
      type: 'better_loan',
      title: 'Négocier un meilleur prêt',
      description: 'Comparer 3-5 institutions pour obtenir le meilleur taux',
      advantage: 'Réduction potentielle de 2-5% du taux d\'intérêt',
      timeframe: 'Immédiat'
    });

    // Alternative 4: Aide familiale
    alternatives.push({
      type: 'family',
      title: 'Prêt familial sans intérêt',
      description: 'Demander aide à la famille avec plan de remboursement clair',
      advantage: 'Pas d\'intérêts + conditions flexibles',
      timeframe: 'Selon accord familial'
    });

    return alternatives;
  }

  // ===================================================================
  // MÉTHODES AVANCÉES - ML
  // ===================================================================

  /**
   * Entraîner et sauvegarder modèle prédictif personnalisé
   * @param {ObjectId} userId - ID utilisateur
   * @param {String} modelType - Type de modèle
   * @returns {Object} - Modèle entraîné
   */
  static async trainPredictionModel(userId, modelType = 'spending_prediction') {
    try {
      // Récupérer données historiques
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 12);

      const transactions = await Transaction.find({
        user: userId,
        date: { $gte: startDate }
      }).lean();

      if (transactions.length < 30) {
        return {
          success: false,
          message: 'Pas assez de données pour entraîner un modèle (minimum 30 transactions)'
        };
      }

      // Préparer données d'entraînement
      const trainingData = this._prepareTrainingData(transactions, modelType);

      // Entraîner modèle (régression linéaire simplifiée)
      const model = this._trainLinearRegression(trainingData);

      // Évaluer performance
      const metrics = this._evaluateModel(model, trainingData);

      // Sauvegarder modèle dans DB
      const savedModel = await MLModel.create({
        user: userId,
        modelType,
        name: `Modèle ${modelType} personnalisé`,
        trainingData: {
          dataPoints: trainingData.length,
          featureNames: this._getFeatureNames(modelType),
          stats: {
            totalSamples: trainingData.length,
            featureCount: trainingData[0].features.length,
            dateRange: {
              start: new Date(Math.min(...transactions.map(t => t.date))),
              end: new Date(Math.max(...transactions.map(t => t.date)))
            },
            dataQuality: this._assessDataQuality(trainingData)
          }
        },
        parameters: {
          algorithm: 'linear-regression',
          hyperparameters: model.parameters
        },
        accuracy: metrics.accuracy,
        metrics: {
          mse: metrics.mse,
          rmse: metrics.rmse,
          mae: metrics.mae,
          r2Score: metrics.r2Score
        },
        lastTrained: new Date(),
        status: 'trained'
      });

      return {
        success: true,
        model: savedModel,
        performance: metrics,
        recommendations: this._getModelRecommendations(metrics)
      };

    } catch (error) {
      console.error('Erreur trainPredictionModel:', error);
      throw error;
    }
  }

  /**
   * Préparer données d'entraînement
   */
  static _prepareTrainingData(transactions, modelType) {
    const trainingData = [];

    // Grouper par semaine
    const weeklyGroups = {};
    
    transactions.forEach(tx => {
      const weekKey = this._getWeekKey(tx.date);
      if (!weeklyGroups[weekKey]) {
        weeklyGroups[weekKey] = [];
      }
      weeklyGroups[weekKey].push(tx);
    });

    // Créer features et labels
    Object.entries(weeklyGroups).forEach(([week, txs]) => {
      const features = this._extractFeatures(txs, modelType);
      const label = txs.reduce((sum, t) => sum + (t.type === 'expense' ? t.amount : 0), 0);

      trainingData.push({ features, label });
    });

    return trainingData;
  }

  /**
   * Extraire features pour ML
   */
  static _extractFeatures(transactions, modelType) {
    const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);
    const avgAmount = totalAmount / transactions.length;
    const txCount = transactions.length;
    const dayOfMonth = new Date(transactions[0].date).getDate();
    const dayOfWeek = new Date(transactions[0].date).getDay();

    // Comptage par catégorie
    const categories = {};
    transactions.forEach(t => {
      categories[t.category] = (categories[t.category] || 0) + 1;
    });

    return [
      totalAmount / 1000, // Normaliser
      avgAmount / 1000,
      txCount,
      dayOfMonth / 31,
      dayOfWeek / 7,
      Object.keys(categories).length
    ];
  }

  /**
   * Entraîner régression linéaire
   */
  static _trainLinearRegression(trainingData) {
    const X = trainingData.map(d => d.features);
    const y = trainingData.map(d => d.label);

    // Régression linéaire multiple simplifiée
    const n = X.length;
    const m = X[0].length;

    // Initialiser poids
    const weights = new Array(m).fill(0);
    let bias = 0;

    const learningRate = 0.01;
    const epochs = 100;

    // Gradient descent
    for (let epoch = 0; epoch < epochs; epoch++) {
      for (let i = 0; i < n; i++) {
        const prediction = X[i].reduce((sum, x, j) => sum + x * weights[j], bias);
        const error = prediction - y[i];

        // Update weights
        for (let j = 0; j < m; j++) {
          weights[j] -= learningRate * error * X[i][j];
        }
        bias -= learningRate * error;
      }
    }

    return {
      weights,
      bias,
      parameters: {
        learningRate,
        epochs,
        featureCount: m
      }
    };
  }

  /**
   * Évaluer performance modèle
   */
  static _evaluateModel(model, trainingData) {
    const predictions = trainingData.map(d => {
      return d.features.reduce((sum, x, i) => sum + x * model.weights[i], model.bias);
    });

    const actuals = trainingData.map(d => d.label);

    // Calculer métriques
    const errors = predictions.map((pred, i) => pred - actuals[i]);
    const squaredErrors = errors.map(e => e * e);
    
    const mse = MLHelpers.mean(squaredErrors);
    const rmse = Math.sqrt(mse);
    const mae = MLHelpers.mean(errors.map(e => Math.abs(e)));

    // R² Score
    const meanActual = MLHelpers.mean(actuals);
    const totalSS = actuals.reduce((sum, y) => sum + Math.pow(y - meanActual, 2), 0);
    const residualSS = squaredErrors.reduce((sum, e) => sum + e, 0);
    const r2Score = 1 - (residualSS / totalSS);

    // Accuracy (percentage de prédictions dans 20% de la valeur réelle)
    const accurateCount = predictions.filter((pred, i) => {
      const percentError = Math.abs((pred - actuals[i]) / actuals[i]) * 100;
      return percentError <= 20;
    }).length;

    const accuracy = (accurateCount / predictions.length) * 100;

    return {
      mse: Math.round(mse),
      rmse: Math.round(rmse),
      mae: Math.round(mae),
      r2Score: Math.round(r2Score * 100) / 100,
      accuracy: Math.round(accuracy)
    };
  }

  /**
   * Obtenir noms features
   */
  static _getFeatureNames(modelType) {
    return [
      'total_amount',
      'avg_amount',
      'tx_count',
      'day_of_month',
      'day_of_week',
      'category_count'
    ];
  }

  /**
   * Évaluer qualité données
   */
  static _assessDataQuality(trainingData) {
    if (trainingData.length < 10) return 40;
    if (trainingData.length < 30) return 60;
    if (trainingData.length < 50) return 80;
    return 95;
  }

  /**
   * Obtenir clé semaine
   */
  static _getWeekKey(date) {
    const year = date.getFullYear();
    const week = Math.ceil((date.getDate() + new Date(year, date.getMonth(), 1).getDay()) / 7);
    return `${year}-${date.getMonth() + 1}-W${week}`;
  }

  /**
   * Recommandations modèle
   */
  static _getModelRecommendations(metrics) {
    const recommendations = [];

    if (metrics.accuracy < 70) {
      recommendations.push({
        priority: 'high',
        message: 'Précision du modèle faible. Collectez plus de données (3+ mois supplémentaires).'
      });
    }

    if (metrics.r2Score < 0.6) {
      recommendations.push({
        priority: 'medium',
        message: 'Le modèle explique moins de 60% des variations. Ajoutez plus de features.'
      });
    }

    if (metrics.mae > 5000) {
      recommendations.push({
        priority: 'medium',
        message: `Erreur moyenne élevée (${metrics.mae} HTG). Affinez les paramètres du modèle.`
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        priority: 'low',
        message: 'Modèle performant ! Continuez à l\'entraîner avec de nouvelles données.'
      });
    }

    return recommendations;
  }
}

module.exports = PredictionService;