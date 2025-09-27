// src/services/adviceEngine.js
// Moteur de conseils financiers personnalisés - Contexte Haïti
// Phase 7 IA Avancée - Version Complète

const HabitAnalysisService = require('./habitAnalysisService');
const MLService = require('./mlService');
const PredictionService = require('./predictionService');
const HabitInsight = require('../models/HabitInsight');
const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const Sol = require('../models/Sol');
const Debt = require('../models/Debt');
const Account = require('../models/Account');
const { 
  TRANSACTION_CATEGORIES,
  CURRENCIES,
  HAITI_BANKS 
} = require('../utils/constants');

class AdviceEngine {

  /**
   * Générer tous les conseils personnalisés pour un utilisateur
   */
  static async generateComprehensiveAdvice(userId, days = 90) {
    try {
      const [
        spendingPatterns,
        financialHealth,
        habits,
        anomalies,
        budgets,
        debts,
        sols,
        accounts,
        futurePredictions
      ] = await Promise.all([
        HabitAnalysisService.analyzeSpendingPatterns(userId, days),
        HabitAnalysisService.calculateFinancialHealth(userId),
        HabitAnalysisService.identifyHabits(userId, days),
        HabitAnalysisService.detectAnomalies(userId, days),
        Budget.find({ user: userId, isActive: true }),
        Debt.find({ user: userId, status: { $in: ['active', 'overdue'] } }),
        Sol.find({ 'participants.user': userId, status: { $in: ['active', 'pending'] } }),
        Account.find({ user: userId, isActive: true }),
        PredictionService.predictFutureExpenses(userId, 1).catch(() => null)
      ]);

      const insights = [];

      // Générer tous les types de conseils
      if (spendingPatterns.hasData) {
        insights.push(...await this._generateSpendingAdvice(userId, spendingPatterns));
      }

      insights.push(...await this._generateHealthAdvice(userId, financialHealth, accounts));

      if (habits.hasData) {
        insights.push(...await this._generateHabitAdvice(userId, habits));
      }

      if (anomalies.hasData && anomalies.anomalies.length > 0) {
        insights.push(...await this._generateAnomalyAlerts(userId, anomalies));
      }

      if (budgets.length > 0) {
        insights.push(...await this._generateBudgetAdvice(userId, budgets));
      }

      if (debts.length > 0) {
        insights.push(...await this._generateDebtReminders(userId, debts));
      }

      if (sols.length > 0) {
        insights.push(...await this._generateSolRecommendations(userId, sols, spendingPatterns));
      }

      insights.push(...await this._generateSavingsOpportunities(userId, spendingPatterns, financialHealth));

      if (futurePredictions && futurePredictions.success) {
        insights.push(...await this._generatePredictiveAdvice(userId, futurePredictions));
      }

      const savedInsights = await this._saveInsights(userId, insights);

      return {
        success: true,
        totalInsights: savedInsights.length,
        insights: savedInsights,
        summary: {
          urgent: savedInsights.filter(i => i.priority === 'urgent').length,
          high: savedInsights.filter(i => i.priority === 'high').length,
          medium: savedInsights.filter(i => i.priority === 'medium').length,
          low: savedInsights.filter(i => i.priority === 'low').length
        },
        generatedAt: new Date()
      };

    } catch (error) {
      console.error('Erreur generateComprehensiveAdvice:', error);
      throw error;
    }
  }

  /**
   * CONSEILS BASÉS SUR PATTERNS DE DÉPENSES
   */
  static async _generateSpendingAdvice(userId, patterns) {
    const insights = [];

    if (patterns.categoryBreakdown && patterns.categoryBreakdown.length > 0) {
      const topCategory = patterns.categoryBreakdown[0];
      
      if (parseFloat(topCategory.percentage) > 40) {
        const reductionAmount = Math.round(topCategory.total * 0.15);
        const newBudget = Math.round(topCategory.total * 0.85);

        insights.push({
          insightType: 'category_optimization',
          category: topCategory.category,
          priority: 'high',
          title: `Optimiser vos dépenses en ${topCategory.name}`,
          message: `${topCategory.name} représente ${topCategory.percentage}% de vos dépenses (${topCategory.total} HTG). En réduisant de 15%, vous économiserez ${reductionAmount} HTG par mois.`,
          recommendations: [
            `Analyser les dépenses en ${topCategory.name} et identifier les non-essentiels`,
            `Fixer un budget mensuel de ${newBudget} HTG pour ${topCategory.name}`,
            ...this.getHaitiContextualAdvice(topCategory.category, topCategory.total).slice(0, 2)
          ],
          dataSnapshot: {
            amount: topCategory.total,
            percentage: parseFloat(topCategory.percentage),
            trend: 'stable'
          },
          validUntil: this._getValidityDate(30),
          relevanceScore: 90,
          impactScore: 85
        });
      }
    }

    if (patterns.overview && patterns.overview.avgDaily > 1000) {
      const dailyReduction = 200;
      const monthlySavings = dailyReduction * 30;

      insights.push({
        insightType: 'spending_pattern',
        category: 'general',
        priority: 'medium',
        title: 'Vos dépenses quotidiennes sont élevées',
        message: `Vous dépensez en moyenne ${patterns.overview.avgDaily} HTG par jour. En réduisant de seulement ${dailyReduction} HTG/jour, vous économiserez ${monthlySavings} HTG par mois.`,
        recommendations: [
          'Suivre vos dépenses quotidiennes pendant 1 semaine',
          'Identifier les petites dépenses récurrentes à éliminer',
          `Préparer un budget quotidien de ${patterns.overview.avgDaily - dailyReduction} HTG maximum`,
          'Utiliser uniquement du cash pour mieux contrôler'
        ],
        dataSnapshot: {
          amount: patterns.overview.avgDaily,
          comparisonValue: patterns.overview.avgDaily - dailyReduction,
          trend: 'stable'
        },
        validUntil: this._getValidityDate(15),
        relevanceScore: 75,
        impactScore: 70
      });
    }

    const avgHaitiMonthly = 25000;
    if (patterns.overview && patterns.overview.avgMonthly > avgHaitiMonthly * 1.5) {
      const excessPercent = Math.round((patterns.overview.avgMonthly / avgHaitiMonthly - 1) * 100);

      insights.push({
        insightType: 'spending_pattern',
        category: 'general',
        priority: 'high',
        title: 'Vous dépensez plus que la moyenne haïtienne',
        message: `Vos dépenses mensuelles (${patterns.overview.avgMonthly} HTG) sont ${excessPercent}% plus élevées que la moyenne haïtienne.`,
        recommendations: [
          'Revoir toutes vos dépenses mensuelles fixes',
          'Négocier vos contrats (téléphone, internet, services)',
          'Chercher des alternatives locales moins chères',
          'Comparer systématiquement les prix avant d\'acheter'
        ],
        dataSnapshot: {
          amount: patterns.overview.avgMonthly,
          comparisonValue: avgHaitiMonthly,
          percentage: excessPercent
        },
        validUntil: this._getValidityDate(30),
        relevanceScore: 85,
        impactScore: 90
      });
    }

    return insights;
  }

  /**
   * CONSEILS BASÉS SUR SANTÉ FINANCIÈRE
   */
  static async _generateHealthAdvice(userId, health, accounts) {
    const insights = [];

    if (health.score < 50) {
      insights.push({
        insightType: 'financial_milestone',
        category: 'health',
        priority: 'urgent',
        title: '⚠️ Votre santé financière nécessite attention urgente',
        message: `Votre score de santé financière est de ${health.score}/100 (${health.level}). Prenez des mesures immédiates.`,
        recommendations: [
          'URGENT: Réduire les dépenses non-essentielles de 30%',
          'Créer un budget strict et le respecter rigoureusement',
          'Éviter toutes nouvelles dettes',
          'Chercher des sources de revenus supplémentaires'
        ],
        dataSnapshot: {
          amount: health.score,
          trend: 'decreasing'
        },
        validUntil: this._getValidityDate(7),
        relevanceScore: 100,
        impactScore: 100
      });
    } else if (health.score >= 70) {
      insights.push({
        insightType: 'financial_milestone',
        category: 'health',
        priority: 'low',
        title: '✅ Excellente santé financière !',
        message: `Félicitations ! Votre score de ${health.score}/100 indique une bonne gestion financière.`,
        recommendations: [
          'Maintenir vos bonnes habitudes actuelles',
          'Augmenter votre épargne de 10% supplémentaires',
          'Explorer des opportunités d\'investissement sûres',
          'Rejoindre un sol pour faire croître votre capital'
        ],
        dataSnapshot: {
          amount: health.score,
          trend: 'stable'
        },
        validUntil: this._getValidityDate(30),
        relevanceScore: 70,
        impactScore: 60
      });
    }

    const lowBalanceAccounts = accounts.filter(acc => acc.balance < 1000 && acc.balance > 0);
    if (lowBalanceAccounts.length > 0) {
      const totalLowBalance = lowBalanceAccounts.reduce((sum, acc) => sum + acc.balance, 0);

      insights.push({
        insightType: 'budget_alert',
        category: 'accounts',
        priority: 'high',
        title: 'Soldes de comptes faibles détectés',
        message: `${lowBalanceAccounts.length} compte(s) ont un solde inférieur à 1,000 HTG (total: ${totalLowBalance} HTG).`,
        recommendations: [
          'Transférer des fonds vers ces comptes immédiatement',
          'Consolider vos comptes si vous en avez trop',
          'Configurer des alertes de solde minimum',
          'Vérifier les frais bancaires sur comptes inactifs'
        ],
        dataSnapshot: {
          affectedAccounts: lowBalanceAccounts.map(a => a._id),
          amount: totalLowBalance
        },
        validUntil: this._getValidityDate(7),
        relevanceScore: 80,
        impactScore: 75
      });
    }

    const usdAccounts = accounts.filter(acc => acc.currency === 'USD');
    const htgAccounts = accounts.filter(acc => acc.currency === 'HTG');
    
    if (usdAccounts.length > 0 && htgAccounts.length > 0) {
      const usdBalance = usdAccounts.reduce((sum, a) => sum + a.balance, 0);
      const htgBalance = htgAccounts.reduce((sum, a) => sum + a.balance, 0);
      const totalInHTG = htgBalance + (usdBalance * 130);
      const usdRatio = totalInHTG > 0 ? (usdBalance * 130) / totalInHTG * 100 : 0;

      if (usdRatio < 15) {
        insights.push({
          insightType: 'saving_opportunity',
          category: 'accounts',
          priority: 'medium',
          title: 'Optimiser votre allocation HTG/USD',
          message: `Seulement ${usdRatio.toFixed(1)}% de vos fonds sont en USD. Gardez 20-30% en USD pour vous protéger.`,
          recommendations: [
            `Convertir ${Math.round((totalInHTG * 0.25 - usdBalance * 130) / 130)} USD pour atteindre 25%`,
            'Privilégier USD pour épargne long terme',
            'Garder HTG uniquement pour dépenses courantes',
            'Surveiller le taux de change pour conversions optimales'
          ],
          dataSnapshot: {
            amount: usdBalance,
            percentage: usdRatio,
            comparisonValue: 25
          },
          validUntil: this._getValidityDate(30),
          relevanceScore: 75,
          impactScore: 70
        });
      }
    }

    return insights;
  }

  /**
   * CONSEILS BASÉS SUR HABITUDES
   */
  static async _generateHabitAdvice(userId, habits) {
    const insights = [];

    if (habits.habits && habits.habits.length > 0) {
      const expensiveHabits = habits.habits.filter(h => 
        h.totalAmount > 5000 && h.type === 'expense'
      );

      for (const habit of expensiveHabits) {
        const dailyCost = Math.round(habit.totalAmount / 30);
        const potentialSavings = Math.round(habit.totalAmount * 0.3);

        insights.push({
          insightType: 'recurring_expense',
          category: habit.category,
          priority: 'medium',
          title: `Dépense récurrente coûteuse: ${habit.description}`,
          message: `Vous avez dépensé ${habit.totalAmount} HTG en "${habit.description}" (${habit.frequency} fois). Cette habitude coûte ${dailyCost} HTG par jour.`,
          recommendations: [
            `Évaluer si cette dépense est vraiment nécessaire`,
            `Chercher des alternatives moins chères`,
            `Fixer une limite mensuelle de ${habit.totalAmount - potentialSavings} HTG`,
            ...this.getHaitiContextualAdvice(habit.category, habit.totalAmount).slice(0, 1)
          ],
          dataSnapshot: {
            amount: habit.totalAmount,
            comparisonValue: habit.frequency,
            trend: 'stable'
          },
          validUntil: this._getValidityDate(30),
          relevanceScore: 75,
          impactScore: 70
        });
      }

      const positiveHabits = habits.habits.filter(h => 
        h.type === 'income' || (h.category === 'epargne' && h.type === 'expense')
      );

      if (positiveHabits.length > 0) {
        const mainPositive = positiveHabits[0];
        
        insights.push({
          insightType: 'financial_milestone',
          category: mainPositive.category,
          priority: 'low',
          title: `✅ Excellente habitude: ${mainPositive.description}`,
          message: `Vous avez une habitude financière positive ! ${mainPositive.description} (${mainPositive.frequency} fois, ${mainPositive.totalAmount} HTG).`,
          recommendations: [
            'Maintenir cette bonne habitude',
            `Augmenter de 10% le mois prochain (${Math.round(mainPositive.totalAmount * 1.1)} HTG)`,
            'Automatiser cette action si possible',
            'Partager votre stratégie avec d\'autres'
          ],
          dataSnapshot: {
            amount: mainPositive.totalAmount,
            comparisonValue: mainPositive.frequency
          },
          validUntil: this._getValidityDate(45),
          relevanceScore: 65,
          impactScore: 70
        });
      }
    }

    return insights;
  }

  /**
   * ALERTES ANOMALIES
   */
  static async _generateAnomalyAlerts(userId, anomalies) {
    const insights = [];

    for (const anomaly of anomalies.anomalies) {
      const categoryName = TRANSACTION_CATEGORIES[anomaly.category]?.name || anomaly.category;
      const deviationPercent = Math.round(anomaly.deviationPercent || 0);

      insights.push({
        insightType: 'spending_pattern',
        category: anomaly.category,
        priority: 'high',
        title: `⚠️ Anomalie détectée: ${categoryName}`,
        message: `Une dépense inhabituelle de ${anomaly.amount} HTG a été détectée en ${categoryName}. C'est ${deviationPercent}% plus élevé que votre moyenne.`,
        recommendations: [
          'Vérifier que cette transaction est correcte et autorisée',
          'Analyser pourquoi cette dépense a été si élevée',
          'Si erreur, signaler immédiatement',
          'Si légitime, ajuster votre budget pour ce mois',
          'Mettre en place des alertes pour transactions élevées'
        ],
        dataSnapshot: {
          amount: anomaly.amount,
          comparisonValue: anomaly.avgAmount,
          percentage: deviationPercent,
          relatedTransactions: [anomaly.transactionId]
        },
        validUntil: this._getValidityDate(14),
        relevanceScore: 90,
        impactScore: 85
      });
    }

    return insights;
  }

  /**
   * CONSEILS BUDGETS
   */
  static async _generateBudgetAdvice(userId, budgets) {
    const insights = [];

    for (const budget of budgets) {
      const percentUsed = (budget.spent / budget.amount) * 100;
      const remaining = budget.amount - budget.spent;
      const daysRemaining = Math.ceil((budget.endDate - new Date()) / (1000 * 60 * 60 * 24));

      if (budget.spent > budget.amount) {
        const excess = budget.spent - budget.amount;
        const excessPercent = Math.round(percentUsed - 100);

        insights.push({
          insightType: 'budget_alert',
          category: budget.category,
          priority: 'urgent',
          title: `🚨 Budget "${budget.name}" dépassé !`,
          message: `URGENT: Vous avez dépassé votre budget ${budget.name} de ${excess} HTG (${excessPercent}% au-dessus).`,
          recommendations: [
            'STOPPER toutes dépenses non-essentielles dans cette catégorie',
            'Réviser et augmenter votre budget si nécessaire',
            'Analyser pourquoi le budget a été dépassé',
            'Compenser en réduisant autres catégories'
          ],
          dataSnapshot: {
            amount: budget.spent,
            comparisonValue: budget.amount,
            percentage: Math.round(percentUsed)
          },
          validUntil: this._getValidityDate(7),
          relevanceScore: 100,
          impactScore: 95
        });
      } else if (percentUsed > 80 && daysRemaining > 0) {
        const dailyAllowance = Math.round(remaining / daysRemaining);

        insights.push({
          insightType: 'budget_alert',
          category: budget.category,
          priority: 'medium',
          title: `⚠️ Budget "${budget.name}" bientôt atteint`,
          message: `Vous avez utilisé ${Math.round(percentUsed)}% de votre budget ${budget.name}. Il vous reste ${remaining} HTG pour ${daysRemaining} jours.`,
          recommendations: [
            `Limiter à ${dailyAllowance} HTG par jour dans cette catégorie`,
            'Prioriser uniquement les dépenses essentielles',
            'Reporter les achats non-urgents au mois prochain',
            'Chercher des alternatives moins chères'
          ],
          dataSnapshot: {
            amount: budget.spent,
            comparisonValue: budget.amount,
            percentage: Math.round(percentUsed)
          },
          validUntil: this._getValidityDate(14),
          relevanceScore: 85,
          impactScore: 80
        });
      } else if (percentUsed < 50 && daysRemaining < 10) {
        insights.push({
          insightType: 'financial_milestone',
          category: budget.category,
          priority: 'low',
          title: `✅ Excellente gestion: Budget "${budget.name}"`,
          message: `Félicitations ! Vous n'avez utilisé que ${Math.round(percentUsed)}% de votre budget ${budget.name}. Vous économisez ${remaining} HTG ce mois-ci.`,
          recommendations: [
            'Continuer cette excellente gestion',
            'Transférer l\'excédent vers épargne',
            'Maintenir ces bonnes habitudes le mois prochain',
            'Considérer réduire ce budget si systématiquement sous-utilisé'
          ],
          dataSnapshot: {
            amount: budget.spent,
            comparisonValue: budget.amount,
            percentage: Math.round(percentUsed)
          },
          validUntil: this._getValidityDate(30),
          relevanceScore: 60,
          impactScore: 65
        });
      }
    }

    return insights;
  }

  /**
   * ALERTES DETTES
   */
  static async _generateDebtReminders(userId, debts) {
    const insights = [];

    for (const debt of debts) {
      const daysUntilDue = Math.ceil((debt.dueDate - new Date()) / (1000 * 60 * 60 * 24));
      const debtType = debt.type === 'debt' ? 'dette' : 'créance';

      if (debt.status === 'overdue') {
        const daysLate = Math.abs(daysUntilDue);

        insights.push({
          insightType: 'debt_reminder',
          category: 'debts',
          priority: 'urgent',
          title: `🚨 ${debtType.toUpperCase()} EN RETARD: ${debt.description}`,
          message: `URGENT: Votre ${debtType} de ${debt.amountRemaining} HTG est en retard de ${daysLate} jour(s) !`,
          recommendations: [
            'Contacter le créditeur/débiteur DÈS AUJOURD\'HUI',
            'Expliquer votre situation et présenter excuses',
            'Négocier un nouveau plan de paiement si nécessaire',
            'Prioriser absolument cette dette dans votre budget'
          ],
          dataSnapshot: {
            amount: debt.amountRemaining
          },
          validUntil: this._getValidityDate(3),
          relevanceScore: 100,
          impactScore: 100
        });
      } else if (daysUntilDue <= 7 && daysUntilDue > 0) {
        insights.push({
          insightType: 'debt_reminder',
          category: 'debts',
          priority: 'high',
          title: `⏰ ${debtType.charAt(0).toUpperCase() + debtType.slice(1)} arrive à échéance: ${debt.description}`,
          message: `Votre ${debtType} de ${debt.amountRemaining} HTG arrive à échéance dans ${daysUntilDue} jour(s).`,
          recommendations: [
            debt.type === 'debt' 
              ? 'Vérifier que vous avez les fonds disponibles'
              : 'Rappeler au débiteur l\'échéance proche',
            debt.type === 'debt'
              ? 'Programmer le paiement dès maintenant'
              : 'Confirmer modalités de paiement avec débiteur',
            'Marquer dans votre calendrier',
            'Garder preuve de transaction'
          ],
          dataSnapshot: {
            amount: debt.amountRemaining,
            comparisonValue: daysUntilDue
          },
          validUntil: debt.dueDate,
          relevanceScore: 95,
          impactScore: 90
        });
      } else if (debt.type === 'loan' && daysUntilDue > 30 && !debt.reminders?.length) {
        insights.push({
          insightType: 'debt_reminder',
          category: 'debts',
          priority: 'medium',
          title: `💰 Relancer créance: ${debt.description}`,
          message: `Votre créance de ${debt.amountRemaining} HTG n'a jamais été relancée. Contactez le débiteur.`,
          recommendations: [
            'Appeler ou envoyer message de rappel amical',
            'Proposer plan de paiement échelonné si difficultés',
            'Fixer nouvelle échéance claire',
            'Documenter tous les échanges'
          ],
          dataSnapshot: {
            amount: debt.amountRemaining
          },
          validUntil: this._getValidityDate(30),
          relevanceScore: 75,
          impactScore: 70
        });
      }
    }

    return insights;
  }

  /**
   * RECOMMANDATIONS SOLS
   */
  static async _generateSolRecommendations(userId, userSols, spendingPatterns) {
    const insights = [];

    for (const sol of userSols) {
      const userParticipation = sol.participants.find(p => p.user.toString() === userId.toString());
      
      if (userParticipation && userParticipation.paymentStatus === 'pending') {
        const currentRound = sol.rounds.find(r => r.status === 'active' || r.status === 'pending');
        
        if (currentRound) {
          const daysUntilPayment = Math.ceil((currentRound.dueDate - new Date()) / (1000 * 60 * 60 * 24));
          
          if (daysUntilPayment <= 5 && daysUntilPayment > 0) {
            insights.push({
              insightType: 'sol_recommendation',
              category: 'sols',
              priority: 'high',
              title: `💰 Paiement sol "${sol.name}" bientôt dû`,
              message: `Le paiement de votre sol "${sol.name}" (${sol.amount} HTG) est dû dans ${daysUntilPayment} jour(s).`,
              recommendations: [
                'Vérifier le solde de votre compte principal',
                'Programmer le paiement maintenant pour ne pas oublier',
                'Contacter l\'organisateur si vous avez un problème',
                'Préparer l\'argent liquide si paiement en cash'
              ],
              dataSnapshot: {
                amount: sol.amount,
                comparisonValue: daysUntilDue
              },
              validUntil: currentRound.dueDate,
              relevanceScore: 95,
              impactScore: 90
            });
          }
        }
      }
    }

    if (spendingPatterns.hasData && spendingPatterns.overview) {
      const monthlyIncome = spendingPatterns.overview.totalIncome || 0;
      const monthlyExpenses = spendingPatterns.overview.totalSpent || 0;
      const potentialSavings = monthlyIncome - monthlyExpenses;

      if (potentialSavings > 2000 && userSols.length < 3) {
        const recommendedAmount = Math.round(potentialSavings * 0.3);
        const annualGain = Math.round(recommendedAmount * 12 * 0.10);

        insights.push({
          insightType: 'sol_recommendation',
          category: 'sols',
          priority: 'medium',
          title: '💡 Opportunité: Rejoindre un sol pour épargner',
          message: `Votre capacité d'épargne mensuelle (${potentialSavings} HTG) vous permet de rejoindre un sol.`,
          recommendations: [
            `Chercher un sol avec cotisation de ${recommendedAmount} HTG/mois`,
            'Privilégier les sols avec des participants que vous connaissez',
            'Vérifier la réputation de l\'organisateur',
            'Demander règles écrites du sol avant de rejoindre'
          ],
          dataSnapshot: {
            amount: potentialSavings,
            comparisonValue: recommendedAmount
          },
          validUntil: this._getValidityDate(30),
          relevanceScore: 80,
          impactScore: 75
        });
      }
    }

    if (userSols.length >= 3) {
      const totalSolCommitment = userSols.reduce((sum, sol) => {
        const userPart = sol.participants.find(p => p.user.toString() === userId.toString());
        return sum + (userPart ? sol.amount : 0);
      }, 0);

      insights.push({
        insightType: 'sol_recommendation',
        category: 'sols',
        priority: 'low',
        title: '✅ Bonne diversification de sols',
        message: `Vous participez à ${userSols.length} sols (engagement total: ${totalSolCommitment} HTG/mois).`,
        recommendations: [
          'Maintenir cette diversification',
          'Éviter de rejoindre trop de sols simultanément',
          'Garder un fonds d\'urgence en dehors des sols',
          'Évaluer performance de chaque sol annuellement'
        ],
        dataSnapshot: {
          amount: totalSolCommitment,
          comparisonValue: userSols.length
        },
        validUntil: this._getValidityDate(60),
        relevanceScore: 65,
        impactScore: 60
      });
    }

    return insights;
  }

  /**
   * OPPORTUNITÉS ÉPARGNE
   */
  static async _generateSavingsOpportunities(userId, spendingPatterns, financialHealth) {
    const insights = [];

    if (spendingPatterns.hasData && spendingPatterns.categoryBreakdown) {
      const optimizableCategories = spendingPatterns.categoryBreakdown.filter(cat => 
        ['transport', 'divertissement', 'alimentation', 'services'].includes(cat.category) &&
        parseFloat(cat.percentage) > 15
      );

      for (const cat of optimizableCategories.slice(0, 2)) {
        const potentialSavings = Math.round(cat.total * 0.20);
        const annualSavings = potentialSavings * 12;

        insights.push({
          insightType: 'saving_opportunity',
          category: cat.category,
          priority: 'medium',
          title: `💰 Économisez ${potentialSavings} HTG/mois sur ${cat.name}`,
          message: `En réduisant vos dépenses en ${cat.name} de 20%, vous économiserez ${potentialSavings} HTG par mois.`,
          recommendations: [
            `Comparer les prix avant chaque achat en ${cat.name}`,
            'Chercher des alternatives moins chères',
            `Fixer une limite mensuelle stricte de ${cat.total - potentialSavings} HTG`,
            'Suivre vos économies chaque semaine',
            ...this.getHaitiContextualAdvice(cat.category, cat.total).slice(0, 2)
          ],
          dataSnapshot: {
            amount: cat.total,
            comparisonValue: potentialSavings,
            percentage: 20
          },
          validUntil: this._getValidityDate(30),
          relevanceScore: 75,
          impactScore: 80
        });
      }
    }

    if (financialHealth.score >= 60) {
      const recommendedRate = financialHealth.score >= 75 ? 20 : 15;
      const monthlyIncome = spendingPatterns.overview?.totalIncome || 0;
      const targetSavings = Math.round(monthlyIncome * (recommendedRate / 100));

      if (targetSavings > 0) {
        insights.push({
          insightType: 'saving_opportunity',
          category: 'savings',
          priority: 'low',
          title: '🎯 Mettez en place une épargne automatique',
          message: `Votre situation financière vous permet de mettre en place une épargne automatique de ${recommendedRate}% (${targetSavings} HTG/mois).`,
          recommendations: [
            'Créer un compte épargne dédié',
            'Programmer un transfert automatique juste après réception salaire',
            `Commencer avec ${recommendedRate}% de vos revenus (${targetSavings} HTG/mois)`,
            'Augmenter progressivement de 2-5% chaque trimestre'
          ],
          dataSnapshot: {
            amount: targetSavings,
            percentage: recommendedRate,
            comparisonValue: targetSavings * 12
          },
          validUntil: this._getValidityDate(60),
          relevanceScore: 70,
          impactScore: 85
        });
      }
    }

    const currentSavings = spendingPatterns.overview?.totalIncome - spendingPatterns.overview?.totalSpent || 0;
    const monthlyExpenses = spendingPatterns.overview?.totalSpent || 0;
    const emergencyFundTarget = monthlyExpenses * 3;

    if (currentSavings < emergencyFundTarget && financialHealth.score >= 50) {
      const monthlyContribution = Math.round(emergencyFundTarget / 12);

      insights.push({
        insightType: 'saving_opportunity',
        category: 'emergency_fund',
        priority: 'high',
        title: '🚨 Constituez un fonds d\'urgence',
        message: `Vous n'avez pas de fonds d'urgence suffisant. Objectif: ${emergencyFundTarget} HTG (3 mois de dépenses).`,
        recommendations: [
          `Épargner ${monthlyContribution} HTG/mois pendant 12 mois`,
          'Garder cet argent dans un compte accessible mais séparé',
          'N\'utiliser QUE pour vraies urgences',
          'Reconstituer immédiatement après utilisation'
        ],
        dataSnapshot: {
          amount: currentSavings,
          comparisonValue: emergencyFundTarget,
          percentage: Math.round((currentSavings / emergencyFundTarget) * 100)
        },
        validUntil: this._getValidityDate(90),
        relevanceScore: 90,
        impactScore: 95
      });
    }

    return insights;
  }

  /**
   * INSIGHTS PRÉDICTIFS
   */
  static async _generatePredictiveAdvice(userId, predictions) {
    const insights = [];

    if (predictions.predictions && predictions.predictions.length > 0) {
      const nextMonthPrediction = predictions.predictions[0];
      
      if (predictions.analysis?.trend === 'increasing') {
        const trendStrength = Math.round(predictions.analysis.trendStrength);

        insights.push({
          insightType: 'spending_pattern',
          category: 'general',
          priority: 'high',
          title: '📈 Vos dépenses sont en augmentation',
          message: `Nos prédictions indiquent une augmentation de vos dépenses de ${trendStrength} HTG/mois.`,
          recommendations: [
            'Identifier les causes de cette augmentation',
            'Mettre en place des mesures correctives dès maintenant',
            `Fixer un budget strict de ${Math.round(nextMonthPrediction.prediction * 0.9)} HTG max`,
            'Suivre quotidiennement vos dépenses'
          ],
          dataSnapshot: {
            amount: nextMonthPrediction.prediction,
            comparisonValue: trendStrength,
            trend: 'increasing',
            confidence: nextMonthPrediction.confidence
          },
          validUntil: this._getValidityDate(30),
          relevanceScore: 85,
          impactScore: 90
        });
      }

      if (predictions.analysis?.volatility === 'high') {
        insights.push({
          insightType: 'spending_pattern',
          category: 'general',
          priority: 'medium',
          title: '⚠️ Vos dépenses sont très irrégulières',
          message: 'Votre volatilité de dépenses est élevée. Cette irrégularité rend la planification difficile.',
          recommendations: [
            'Établir un budget mensuel fixe et s\'y tenir',
            'Lisser les grosses dépenses sur plusieurs mois',
            'Prévoir les dépenses exceptionnelles à l\'avance',
            'Constituer un fonds pour dépenses variables'
          ],
          dataSnapshot: {
            trend: 'volatile'
          },
          validUntil: this._getValidityDate(30),
          relevanceScore: 75,
          impactScore: 70
        });
      }

      if (nextMonthPrediction.confidence < 0.7) {
        insights.push({
          insightType: 'spending_pattern',
          category: 'general',
          priority: 'low',
          title: '📊 Améliorez la précision de vos prédictions',
          message: `La confiance de nos prédictions est de ${Math.round(nextMonthPrediction.confidence * 100)}%.`,
          recommendations: [
            'Enregistrer TOUTES vos transactions quotidiennement',
            'Catégoriser correctement chaque dépense',
            'Ajouter des descriptions détaillées',
            'Utiliser l\'app pendant 3+ mois pour meilleure précision'
          ],
          dataSnapshot: {
            confidence: nextMonthPrediction.confidence
          },
          validUntil: this._getValidityDate(45),
          relevanceScore: 60,
          impactScore: 65
        });
      }
    }

    return insights;
  }

  /**
   * UTILITAIRES
   */
  static async _saveInsights(userId, insights) {
    const savedInsights = [];

    for (const insight of insights) {
      try {
        const existing = await HabitInsight.findOne({
          user: userId,
          insightType: insight.insightType,
          category: insight.category,
          status: { $in: ['new', 'viewed'] },
          validUntil: { $gt: new Date() }
        });

        if (!existing) {
          const newInsight = await HabitInsight.create({
            user: userId,
            ...insight
          });
          savedInsights.push(newInsight);
        }
      } catch (error) {
        console.error('Erreur sauvegarde insight:', error);
      }
    }

    return savedInsights;
  }

  static _getValidityDate(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date;
  }

  static _getSavingsGoalExample(annualAmount) {
    if (annualAmount >= 100000) {
      return 'acheter un terrain ou investir dans un business';
    } else if (annualAmount >= 50000) {
      return 'acheter une moto ou financer des études';
    } else if (annualAmount >= 20000) {
      return 'acheter un bon téléphone ou équipement professionnel';
    } else {
      return 'constituer un fonds d\'urgence solide';
    }
  }

  /**
   * Conseils contextuels Haïti
   */
  static getHaitiContextualAdvice(category, amount) {
    const advice = {
      transport: [
        'Privilégier les tap-taps aux taxis pour économiser 60-70%',
        'Négocier des forfaits mensuels avec chauffeurs réguliers',
        'Considérer le covoiturage avec collègues/voisins',
        'Marcher pour les courtes distances (santé + économies)'
      ],
      alimentation: [
        'Acheter au marché local plutôt qu\'en supermarché',
        'Cuisiner en grande quantité et congeler portions',
        'Privilégier les produits de saison (moins chers)',
        'Négocier les prix avec les marchandes (surtout en fin de journée)'
      ],
      logement: [
        'Comparer plusieurs options avant de louer',
        'Négocier le loyer, surtout hors saison touristique',
        'Partager un logement pour réduire les coûts de 50%',
        'Vérifier l\'accès à l\'eau et électricité avant de louer'
      ],
      sante: [
        'Utiliser les centres de santé publics (MSPP) quand possible',
        'Comparer les prix des médicaments dans 3+ pharmacies',
        'Souscrire à une assurance santé collective via employeur',
        'Prévenir plutôt que guérir - checkups réguliers moins chers'
      ],
      education: [
        'Explorer les bourses d\'études disponibles (ambassades, ONG)',
        'Acheter livres d\'occasion auprès d\'anciens étudiants',
        'Utiliser ressources gratuites en ligne (Khan Academy, etc.)',
        'Former des groupes d\'étude pour partager coûts'
      ],
      divertissement: [
        'Profiter des activités gratuites (plages, randonnées, parcs)',
        'Organiser sorties de groupe pour diviser les coûts',
        'Attendre les promotions pour restaurants (happy hour)',
        'Découvrir les événements culturels gratuits'
      ],
      services: [
        'Comparer tarifs Digicel vs Natcom chaque mois',
        'Choisir forfaits adaptés à consommation réelle',
        'Partager abonnements internet avec voisins',
        'Négocier forfaits groupés (internet + téléphone)'
      ],
      sols: [
        'Vérifier réputation organisateur avant rejoindre',
        'Privilégier sols avec règles écrites claires et signées',
        'Rejoindre sols de votre réseau de confiance',
        'Garder preuve de TOUS paiements effectués'
      ]
    };

    return advice[category] || [
      'Comparer les prix avant d\'acheter',
      'Négocier quand c\'est possible',
      'Privilégier la qualité sur la quantité',
      'Garder les reçus pour suivi'
    ];
  }

  /**
   * Générer rapport d'optimisation
   */
  static async generateOptimizationReport(userId) {
    try {
      const [patterns, health, insights, savingsCapacity] = await Promise.all([
        HabitAnalysisService.analyzeSpendingPatterns(userId, 90),
        HabitAnalysisService.calculateFinancialHealth(userId),
        HabitInsight.find({
          user: userId,
          status: { $in: ['new', 'viewed'] },
          validUntil: { $gt: new Date() }
        }).sort({ priority: -1, relevanceScore: -1 }),
        PredictionService.predictSavingsCapacity(userId).catch(() => null)
      ]);

      const potentialSavings = this._calculatePotentialSavings(patterns);
      
      const priorityActions = insights
        .filter(i => i.priority === 'urgent' || i.priority === 'high')
        .slice(0, 5)
        .map(i => ({
          title: i.title,
          action: i.recommendations[0],
          impact: `${i.impactScore}/100`,
          deadline: i.validUntil
        }));

      const quickWins = this._identifyQuickWins(patterns, insights);

      return {
        success: true,
        report: {
          summary: {
            currentHealth: health.score,
            healthLevel: health.level,
            totalInsights: insights.length,
            urgentActions: insights.filter(i => i.priority === 'urgent').length,
            potentialMonthlySavings: potentialSavings,
            potentialAnnualSavings: potentialSavings * 12
          },
          priorityActions,
          quickWins,
          savingsAnalysis: savingsCapacity?.success ? savingsCapacity : null,
          optimizationPlan: {
            shortTerm: this._getShortTermPlan(insights),
            mediumTerm: this._getMediumTermPlan(patterns, health),
            longTerm: this._getLongTermPlan(health)
          },
          haitiSpecificTips: this._getHaitiOptimizationTips(patterns)
        },
        generatedAt: new Date()
      };
    } catch (error) {
      console.error('Erreur generateOptimizationReport:', error);
      throw error;
    }
  }

  static _calculatePotentialSavings(patterns) {
    if (!patterns.hasData || !patterns.categoryBreakdown) return 0;
    
    let totalSavings = 0;
    const optimizable = {
      transport: 0.15,
      alimentation: 0.10,
      divertissement: 0.25,
      services: 0.20
    };

    for (const cat of patterns.categoryBreakdown) {
      if (optimizable[cat.category]) {
        totalSavings += Math.round(cat.total * optimizable[cat.category]);
      }
    }

    return totalSavings;
  }

  static _identifyQuickWins(patterns, insights) {
    const wins = [];

    if (patterns.hasData && patterns.categoryBreakdown?.length > 0) {
      const top = patterns.categoryBreakdown[0];
      wins.push({
        title: `Réduire ${top.name} de 10%`,
        description: `Économie potentielle: ${Math.round(top.total * 0.1)} HTG/mois`,
        effort: 'Faible',
        impact: 'Élevé',
        timeframe: '1 semaine'
      });
    }

    wins.push({
      title: 'Éliminer une dépense récurrente inutile',
      description: 'Identifiez une petite dépense quotidienne à supprimer',
      effort: 'Très faible',
      impact: 'Moyen',
      timeframe: 'Immédiat'
    });

    wins.push({
      title: 'Négocier un forfait téléphone/internet',
      description: 'Réduction potentielle de 20% sur votre facture',
      effort: 'Faible',
      impact: 'Moyen',
      timeframe: '1 jour'
    });

    return wins.slice(0, 3);
  }

  static _getShortTermPlan(insights) {
    const urgent = insights.filter(i =>
      i.priority === 'urgent' || i.priority === 'high'
    ).slice(0, 3);

    return urgent.map(i => ({
      action: i.title,
      steps: i.recommendations.slice(0, 2),
      deadline: '30 jours'
    }));
  }

  static _getMediumTermPlan(patterns, health) {
    const plan = [];

    if (patterns.hasData) {
      plan.push({
        action: 'Optimiser vos budgets mensuels',
        steps: [
          'Créer des budgets pour chaque catégorie principale',
          'Suivre quotidiennement vos dépenses via l\'app',
          'Ajuster les budgets après 1 mois d\'observation'
        ],
        deadline: '90 jours'
      });
    }

    if (health.score < 70) {
      plan.push({
        action: 'Améliorer votre santé financière',
        steps: [
          'Réduire dépenses non-essentielles de 15%',
          'Augmenter revenus si possible',
          'Constituer fonds d\'urgence de 10,000 HTG minimum'
        ],
        deadline: '90 jours'
      });
    }

    return plan;
  }

  static _getLongTermPlan(health) {
    const plan = [];

    plan.push({
      action: 'Construire une épargne solide',
      steps: [
        'Économiser 10-20% de vos revenus chaque mois',
        'Ouvrir un compte épargne USD dédié',
        'Atteindre 3 mois de dépenses en épargne d\'urgence'
      ],
      deadline: '12 mois'
    });

    if (health.score >= 60) {
      plan.push({
        action: 'Commencer à investir intelligemment',
        steps: [
          'Se former sur les opportunités d\'investissement en Haïti',
          'Rejoindre 1-2 sols fiables pour constituer capital',
          'Explorer investissements productifs'
        ],
        deadline: '12 mois'
      });
    }

    plan.push({
      action: 'Viser l\'indépendance financière',
      steps: [
        'Diversifier sources de revenus (minimum 2 sources)',
        'Réduire toutes dettes à zéro',
        'Créer revenus passifs'
      ],
      deadline: '12+ mois'
    });

    return plan;
  }

  static _getHaitiOptimizationTips(patterns) {
    return [
      {
        category: 'Transport',
        tip: 'Utilisez les tap-taps pour trajets réguliers au lieu des taxis. Économie moyenne: 70%',
        savingsExample: '1,000 HTG → 300 HTG par trajet'
      },
      {
        category: 'Alimentation',
        tip: 'Achetez au marché Croix-des-Bossales ou marchés locaux plutôt qu\'en supermarché',
        savingsExample: 'Économie: 30-40% sur fruits, légumes, viande'
      },
      {
        category: 'Devises',
        tip: 'Gardez 20-30% épargne en USD pour protection contre dévaluation gourde',
        savingsExample: 'Protection inflation + gain potentiel taux de change'
      }
    ];
  }

  /**
   * Analyse stratégie multi-devises
   */
  static async analyzeCurrencyStrategy(userId) {
    try {
      const [accounts, transactions] = await Promise.all([
        Account.find({ user: userId, isActive: true }),
        Transaction.find({
          user: userId,
          date: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
        })
      ]);

      const htgAccounts = accounts.filter(a => a.currency === 'HTG');
      const usdAccounts = accounts.filter(a => a.currency === 'USD');
      const htgBalance = htgAccounts.reduce((sum, a) => sum + a.balance, 0);
      const usdBalance = usdAccounts.reduce((sum, a) => sum + a.balance, 0);

      const exchangeRate = 130;
      const totalInHTG = htgBalance + (usdBalance * exchangeRate);
      const usdRatio = totalInHTG > 0 ? (usdBalance * exchangeRate) / totalInHTG * 100 : 0;

      const recommendations = [];

      if (usdRatio < 20) {
        const targetUSD = Math.round((totalInHTG * 0.25) / exchangeRate);
        const neededUSD = Math.round(targetUSD - usdBalance);

        recommendations.push({
          priority: 'medium',
          title: 'Augmentez votre réserve USD',
          message: `Seulement ${usdRatio.toFixed(1)}% de vos fonds sont en USD.`,
          action: `Convertir ${neededUSD} USD (${neededUSD * exchangeRate} HTG)`,
          reasoning: 'Protection contre inflation et dévaluation HTG'
        });
      }

      return {
        success: true,
        analysis: {
          balances: {
            htg: htgBalance,
            usd: usdBalance,
            totalInHTG,
            usdRatio: `${usdRatio.toFixed(1)}%`
          },
          recommendations,
          optimalStrategy: {
            description: 'Stratégie optimale pour contexte Haïti',
            allocation: {
              htg: '70-80% pour dépenses quotidiennes',
              usd: '20-30% comme réserve de valeur'
            }
          }
        },
        generatedAt: new Date()
      };

    } catch (error) {
      console.error('Erreur analyzeCurrencyStrategy:', error);
      throw error;
    }
  }

  /**
   * Comparaison avec pairs
   */
  static async generatePeerComparison(userId) {
    try {
      const similarUsers = await MLService.findSimilarUsers(userId, 5);
      
      if (!similarUsers.similarUsers || similarUsers.similarUsers.length === 0) {
        return {
          success: false,
          message: 'Pas assez d\'utilisateurs similaires pour comparaison'
        };
      }

      const userPatterns = await HabitAnalysisService.analyzeSpendingPatterns(userId, 90);
      
      return {
        success: true,
        comparison: {
          yourSpending: userPatterns.hasData ? userPatterns.overview.totalSpent : 0,
          peerCount: similarUsers.similarUsers.length,
          insights: []
        },
        generatedAt: new Date()
      };
    } catch (error) {
      console.error('Erreur generatePeerComparison:', error);
      throw error;
    }
  }
}

module.exports = AdviceEngine;