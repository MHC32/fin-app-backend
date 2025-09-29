/**
 * Service de calculs financiers
 * FinApp Haiti - Backend MVP
 */

const { roundNumber } = require('../utils/helpers');

/**
 * Convertit HTG vers USD
 * @param {number} amount - Montant en HTG
 * @param {number} exchangeRate - Taux de change (défaut: 130)
 * @returns {number} Montant en USD
 */
const convertHTGtoUSD = (amount, exchangeRate = 130) => {
  return roundNumber(amount / exchangeRate, 2);
};

/**
 * Convertit USD vers HTG
 * @param {number} amount - Montant en USD
 * @param {number} exchangeRate - Taux de change (défaut: 130)
 * @returns {number} Montant en HTG
 */
const convertUSDtoHTG = (amount, exchangeRate = 130) => {
  return roundNumber(amount * exchangeRate, 2);
};

/**
 * Convertit un montant entre devises
 * @param {number} amount - Montant
 * @param {string} from - Devise source
 * @param {string} to - Devise cible
 * @param {number} exchangeRate - Taux de change
 * @returns {number} Montant converti
 */
const convertCurrency = (amount, from, to, exchangeRate = 130) => {
  if (from === to) return amount;
  
  if (from === 'HTG' && to === 'USD') {
    return convertHTGtoUSD(amount, exchangeRate);
  }
  
  if (from === 'USD' && to === 'HTG') {
    return convertUSDtoHTG(amount, exchangeRate);
  }
  
  return amount;
};

/**
 * Calcule le pourcentage d'un montant
 * @param {number} amount - Montant
 * @param {number} percentage - Pourcentage
 * @returns {number} Résultat
 */
const calculatePercentageAmount = (amount, percentage) => {
  return roundNumber((amount * percentage) / 100, 2);
};

/**
 * Calcule le pourcentage entre deux montants
 * @param {number} partialAmount - Montant partiel
 * @param {number} totalAmount - Montant total
 * @returns {number} Pourcentage
 */
const calculatePercentage = (partialAmount, totalAmount) => {
  if (totalAmount === 0) return 0;
  return roundNumber((partialAmount / totalAmount) * 100, 2);
};

/**
 * Calcule la variation en pourcentage
 * @param {number} oldValue - Ancienne valeur
 * @param {number} newValue - Nouvelle valeur
 * @returns {number} Variation en %
 */
const calculatePercentageChange = (oldValue, newValue) => {
  if (oldValue === 0) return newValue > 0 ? 100 : 0;
  return roundNumber(((newValue - oldValue) / oldValue) * 100, 2);
};

/**
 * Calcule les intérêts simples
 * @param {number} principal - Capital
 * @param {number} rate - Taux annuel (%)
 * @param {number} time - Durée (années)
 * @returns {object} { interest, total }
 */
const calculateSimpleInterest = (principal, rate, time) => {
  const interest = roundNumber((principal * rate * time) / 100, 2);
  const total = roundNumber(principal + interest, 2);
  
  return { interest, total };
};

/**
 * Calcule les intérêts composés
 * @param {number} principal - Capital
 * @param {number} rate - Taux annuel (%)
 * @param {number} time - Durée (années)
 * @param {number} frequency - Fréquence de composition par an (défaut: 12)
 * @returns {object} { interest, total }
 */
const calculateCompoundInterest = (principal, rate, time, frequency = 12) => {
  const rateDecimal = rate / 100;
  const total = principal * Math.pow((1 + rateDecimal / frequency), frequency * time);
  const interest = total - principal;
  
  return {
    interest: roundNumber(interest, 2),
    total: roundNumber(total, 2)
  };
};

/**
 * Calcule le paiement mensuel d'un prêt (formule amortissement)
 * @param {number} principal - Montant du prêt
 * @param {number} annualRate - Taux annuel (%)
 * @param {number} months - Durée en mois
 * @returns {number} Paiement mensuel
 */
const calculateLoanPayment = (principal, annualRate, months) => {
  if (annualRate === 0) {
    return roundNumber(principal / months, 2);
  }
  
  const monthlyRate = (annualRate / 100) / 12;
  const payment = principal * (monthlyRate * Math.pow(1 + monthlyRate, months)) / 
                  (Math.pow(1 + monthlyRate, months) - 1);
  
  return roundNumber(payment, 2);
};

/**
 * Calcule le calendrier d'amortissement d'un prêt
 * @param {number} principal - Montant du prêt
 * @param {number} annualRate - Taux annuel (%)
 * @param {number} months - Durée en mois
 * @returns {Array} Calendrier détaillé
 */
const calculateAmortizationSchedule = (principal, annualRate, months) => {
  const monthlyPayment = calculateLoanPayment(principal, annualRate, months);
  const monthlyRate = (annualRate / 100) / 12;
  
  let balance = principal;
  const schedule = [];
  
  for (let month = 1; month <= months; month++) {
    const interestPayment = roundNumber(balance * monthlyRate, 2);
    const principalPayment = roundNumber(monthlyPayment - interestPayment, 2);
    balance = roundNumber(balance - principalPayment, 2);
    
    // Correction du dernier paiement pour éviter les erreurs d'arrondi
    if (month === months && balance !== 0) {
      principalPayment += balance;
      balance = 0;
    }
    
    schedule.push({
      month,
      payment: monthlyPayment,
      principal: principalPayment,
      interest: interestPayment,
      balance: Math.max(0, balance)
    });
  }
  
  return schedule;
};

/**
 * Calcule le coût total d'un prêt
 * @param {number} principal - Montant du prêt
 * @param {number} annualRate - Taux annuel (%)
 * @param {number} months - Durée en mois
 * @returns {object} { totalPaid, totalInterest }
 */
const calculateTotalLoanCost = (principal, annualRate, months) => {
  const monthlyPayment = calculateLoanPayment(principal, annualRate, months);
  const totalPaid = roundNumber(monthlyPayment * months, 2);
  const totalInterest = roundNumber(totalPaid - principal, 2);
  
  return { totalPaid, totalInterest };
};

/**
 * Calcule le retour sur investissement (ROI)
 * @param {number} initialInvestment - Investissement initial
 * @param {number} finalValue - Valeur finale
 * @returns {number} ROI en %
 */
const calculateROI = (initialInvestment, finalValue) => {
  if (initialInvestment === 0) return 0;
  return roundNumber(((finalValue - initialInvestment) / initialInvestment) * 100, 2);
};

/**
 * Calcule le taux de croissance annuel composé (CAGR)
 * @param {number} beginningValue - Valeur initiale
 * @param {number} endingValue - Valeur finale
 * @param {number} years - Nombre d'années
 * @returns {number} CAGR en %
 */
const calculateCAGR = (beginningValue, endingValue, years) => {
  if (beginningValue === 0 || years === 0) return 0;
  const cagr = (Math.pow(endingValue / beginningValue, 1 / years) - 1) * 100;
  return roundNumber(cagr, 2);
};

/**
 * Calcule la valeur future d'un investissement
 * @param {number} presentValue - Valeur actuelle
 * @param {number} rate - Taux de rendement annuel (%)
 * @param {number} years - Nombre d'années
 * @returns {number} Valeur future
 */
const calculateFutureValue = (presentValue, rate, years) => {
  const futureValue = presentValue * Math.pow(1 + (rate / 100), years);
  return roundNumber(futureValue, 2);
};

/**
 * Calcule la valeur actuelle d'un montant futur
 * @param {number} futureValue - Valeur future
 * @param {number} rate - Taux d'actualisation (%)
 * @param {number} years - Nombre d'années
 * @returns {number} Valeur actuelle
 */
const calculatePresentValue = (futureValue, rate, years) => {
  const presentValue = futureValue / Math.pow(1 + (rate / 100), years);
  return roundNumber(presentValue, 2);
};

/**
 * Calcule l'épargne nécessaire pour atteindre un objectif
 * @param {number} targetAmount - Montant cible
 * @param {number} months - Durée en mois
 * @param {number} annualRate - Taux de rendement annuel (%)
 * @param {number} initialAmount - Montant initial (défaut: 0)
 * @returns {number} Épargne mensuelle nécessaire
 */
const calculateSavingsNeeded = (targetAmount, months, annualRate = 0, initialAmount = 0) => {
  if (annualRate === 0) {
    return roundNumber((targetAmount - initialAmount) / months, 2);
  }
  
  const monthlyRate = (annualRate / 100) / 12;
  const futureValueInitial = initialAmount * Math.pow(1 + monthlyRate, months);
  const remainingAmount = targetAmount - futureValueInitial;
  
  const monthlySavings = remainingAmount * monthlyRate / 
                        (Math.pow(1 + monthlyRate, months) - 1);
  
  return roundNumber(monthlySavings, 2);
};

/**
 * Calcule le ratio dette/revenu
 * @param {number} totalDebt - Dette totale mensuelle
 * @param {number} monthlyIncome - Revenu mensuel
 * @returns {number} Ratio en %
 */
const calculateDebtToIncomeRatio = (totalDebt, monthlyIncome) => {
  if (monthlyIncome === 0) return 0;
  return roundNumber((totalDebt / monthlyIncome) * 100, 2);
};

/**
 * Calcule le taux d'épargne
 * @param {number} savings - Épargne
 * @param {number} income - Revenu
 * @returns {number} Taux en %
 */
const calculateSavingsRate = (savings, income) => {
  if (income === 0) return 0;
  return roundNumber((savings / income) * 100, 2);
};

/**
 * Calcule le revenu disponible
 * @param {number} totalIncome - Revenu total
 * @param {number} totalExpenses - Dépenses totales
 * @returns {number} Revenu disponible
 */
const calculateDisposableIncome = (totalIncome, totalExpenses) => {
  return roundNumber(totalIncome - totalExpenses, 2);
};

/**
 * Calcule le cash flow net
 * @param {number} inflows - Entrées d'argent
 * @param {number} outflows - Sorties d'argent
 * @returns {number} Cash flow net
 */
const calculateNetCashFlow = (inflows, outflows) => {
  return roundNumber(inflows - outflows, 2);
};

/**
 * Calcule le break-even point
 * @param {number} fixedCosts - Coûts fixes
 * @param {number} pricePerUnit - Prix unitaire
 * @param {number} variableCostPerUnit - Coût variable unitaire
 * @returns {number} Nombre d'unités nécessaires
 */
const calculateBreakEven = (fixedCosts, pricePerUnit, variableCostPerUnit) => {
  const contributionMargin = pricePerUnit - variableCostPerUnit;
  if (contributionMargin === 0) return 0;
  return Math.ceil(fixedCosts / contributionMargin);
};

/**
 * Calcule la marge bénéficiaire
 * @param {number} revenue - Revenu
 * @param {number} costs - Coûts
 * @returns {number} Marge en %
 */
const calculateProfitMargin = (revenue, costs) => {
  if (revenue === 0) return 0;
  const profit = revenue - costs;
  return roundNumber((profit / revenue) * 100, 2);
};

/**
 * Calcule le rendement d'un sol
 * @param {number} contribution - Contribution par participant
 * @param {number} frequency - Fréquence (daily=365, weekly=52, monthly=12)
 * @param {number} participants - Nombre de participants
 * @returns {object} { totalContributed, totalReceived, gain }
 */
const calculateSolReturn = (contribution, frequency, participants) => {
  const frequencyMap = {
    daily: 365,
    weekly: 52,
    monthly: 12
  };
  
  const periodsPerYear = frequencyMap[frequency] || 12;
  const totalContributed = contribution * participants;
  const totalReceived = totalContributed;
  
  // Gain = accès immédiat à la somme totale quand c'est votre tour
  const gain = roundNumber((totalReceived - contribution) / contribution * 100, 2);
  
  return {
    totalContributed: roundNumber(totalContributed, 2),
    totalReceived: roundNumber(totalReceived, 2),
    gain
  };
};

/**
 * Calcule le budget recommandé par catégorie (règle 50/30/20)
 * @param {number} monthlyIncome - Revenu mensuel
 * @returns {object} Budget recommandé
 */
const calculateRecommendedBudget = (monthlyIncome) => {
  return {
    necessities: roundNumber(monthlyIncome * 0.5, 2),      // 50% besoins essentiels
    wants: roundNumber(monthlyIncome * 0.3, 2),            // 30% loisirs/désirs
    savings: roundNumber(monthlyIncome * 0.2, 2),          // 20% épargne
    total: monthlyIncome
  };
};

/**
 * Calcule le ratio d'endettement optimal
 * @param {number} monthlyIncome - Revenu mensuel
 * @returns {object} Ratios d'endettement
 */
const calculateDebtRatios = (monthlyIncome) => {
  return {
    maxTotal: roundNumber(monthlyIncome * 0.36, 2),        // 36% max total
    maxHousing: roundNumber(monthlyIncome * 0.28, 2),      // 28% max logement
    comfortable: roundNumber(monthlyIncome * 0.25, 2)      // 25% confortable
  };
};

/**
 * Calcule le fonds d'urgence recommandé
 * @param {number} monthlyExpenses - Dépenses mensuelles
 * @param {number} months - Nombre de mois (défaut: 6)
 * @returns {number} Montant recommandé
 */
const calculateEmergencyFund = (monthlyExpenses, months = 6) => {
  return roundNumber(monthlyExpenses * months, 2);
};

/**
 * Calcule le montant de retraite nécessaire
 * @param {number} currentAge - Âge actuel
 * @param {number} retirementAge - Âge de retraite
 * @param {number} desiredMonthlyIncome - Revenu mensuel désiré
 * @param {number} yearsInRetirement - Années en retraite (défaut: 25)
 * @returns {object} Calculs retraite
 */
const calculateRetirementNeeds = (currentAge, retirementAge, desiredMonthlyIncome, yearsInRetirement = 25) => {
  const yearsUntilRetirement = retirementAge - currentAge;
  const totalNeeded = desiredMonthlyIncome * 12 * yearsInRetirement;
  const monthlySavings = calculateSavingsNeeded(totalNeeded, yearsUntilRetirement * 12, 5, 0);
  
  return {
    totalNeeded: roundNumber(totalNeeded, 2),
    yearsUntilRetirement,
    monthlySavingsNeeded: monthlySavings,
    annualSavingsNeeded: roundNumber(monthlySavings * 12, 2)
  };
};

/**
 * Calcule le temps nécessaire pour doubler un investissement (règle de 72)
 * @param {number} annualRate - Taux de rendement annuel (%)
 * @returns {number} Années nécessaires
 */
const calculateDoublingTime = (annualRate) => {
  if (annualRate === 0) return Infinity;
  return roundNumber(72 / annualRate, 1);
};

/**
 * Calcule la rentabilité d'un investissement locatif
 * @param {number} purchasePrice - Prix d'achat
 * @param {number} monthlyRent - Loyer mensuel
 * @param {number} monthlyExpenses - Charges mensuelles
 * @returns {object} Analyse de rentabilité
 */
const calculateRentalYield = (purchasePrice, monthlyRent, monthlyExpenses) => {
  const annualRent = monthlyRent * 12;
  const annualExpenses = monthlyExpenses * 12;
  const netAnnualIncome = annualRent - annualExpenses;
  
  const grossYield = roundNumber((annualRent / purchasePrice) * 100, 2);
  const netYield = roundNumber((netAnnualIncome / purchasePrice) * 100, 2);
  
  return {
    grossYield,
    netYield,
    monthlyNetIncome: roundNumber(netAnnualIncome / 12, 2),
    annualNetIncome: roundNumber(netAnnualIncome, 2)
  };
};

/**
 * Calcule le coût d'opportunité
 * @param {number} amount - Montant
 * @param {number} alternativeRate - Taux de rendement alternatif (%)
 * @param {number} years - Nombre d'années
 * @returns {object} Analyse coût d'opportunité
 */
const calculateOpportunityCost = (amount, alternativeRate, years) => {
  const potentialValue = calculateFutureValue(amount, alternativeRate, years);
  const opportunityCost = potentialValue - amount;
  
  return {
    currentAmount: amount,
    potentialValue: roundNumber(potentialValue, 2),
    opportunityCost: roundNumber(opportunityCost, 2),
    lostGain: roundNumber(opportunityCost / amount * 100, 2)
  };
};

/**
 * Calcule la valeur nette (net worth)
 * @param {number} totalAssets - Actifs totaux
 * @param {number} totalLiabilities - Passifs totaux
 * @returns {number} Valeur nette
 */
const calculateNetWorth = (totalAssets, totalLiabilities) => {
  return roundNumber(totalAssets - totalLiabilities, 2);
};

/**
 * Calcule le ratio actif/passif
 * @param {number} totalAssets - Actifs totaux
 * @param {number} totalLiabilities - Passifs totaux
 * @returns {number} Ratio
 */
const calculateAssetToDebtRatio = (totalAssets, totalLiabilities) => {
  if (totalLiabilities === 0) return Infinity;
  return roundNumber(totalAssets / totalLiabilities, 2);
};

/**
 * Calcule le taux d'inflation effectif sur un montant
 * @param {number} amount - Montant
 * @param {number} inflationRate - Taux d'inflation annuel (%)
 * @param {number} years - Nombre d'années
 * @returns {object} Impact inflation
 */
const calculateInflationImpact = (amount, inflationRate, years) => {
  const realValue = amount / Math.pow(1 + (inflationRate / 100), years);
  const purchasingPowerLoss = amount - realValue;
  
  return {
    originalAmount: amount,
    realValue: roundNumber(realValue, 2),
    purchasingPowerLoss: roundNumber(purchasingPowerLoss, 2),
    lossPercentage: roundNumber((purchasingPowerLoss / amount) * 100, 2)
  };
};

/**
 * Calcule le ratio de liquidité
 * @param {number} liquidAssets - Actifs liquides
 * @param {number} monthlyExpenses - Dépenses mensuelles
 * @returns {object} Analyse liquidité
 */
const calculateLiquidityRatio = (liquidAssets, monthlyExpenses) => {
  const monthsCovered = monthlyExpenses > 0 ? liquidAssets / monthlyExpenses : 0;
  
  return {
    ratio: roundNumber(monthsCovered, 1),
    status: monthsCovered >= 6 ? 'Excellent' : 
            monthsCovered >= 3 ? 'Bon' : 
            monthsCovered >= 1 ? 'Moyen' : 'Faible'
  };
};

/**
 * Calcule les taxes (TVA Haiti = 10%)
 * @param {number} amount - Montant HT
 * @param {number} taxRate - Taux de taxe (défaut: 10%)
 * @returns {object} { ht, tax, ttc }
 */
const calculateTax = (amount, taxRate = 10) => {
  const tax = roundNumber((amount * taxRate) / 100, 2);
  const ttc = roundNumber(amount + tax, 2);
  
  return {
    ht: amount,
    tax,
    ttc,
    taxRate
  };
};

/**
 * Calcule le montant HT depuis le TTC
 * @param {number} ttc - Montant TTC
 * @param {number} taxRate - Taux de taxe (défaut: 10%)
 * @returns {object} { ht, tax, ttc }
 */
const calculateFromTTC = (ttc, taxRate = 10) => {
  const ht = roundNumber(ttc / (1 + taxRate / 100), 2);
  const tax = roundNumber(ttc - ht, 2);
  
  return {
    ht,
    tax,
    ttc,
    taxRate
  };
};

/**
 * Calcule le taux effectif global (TEG) d'un prêt
 * @param {number} principal - Montant emprunté
 * @param {number} totalRepaid - Total remboursé
 * @param {number} months - Durée en mois
 * @returns {number} TEG en %
 */
const calculateEffectiveRate = (principal, totalRepaid, months) => {
  const totalInterest = totalRepaid - principal;
  const years = months / 12;
  return roundNumber((totalInterest / principal / years) * 100, 2);
};

/**
 * Calcule la valeur moyenne pondérée
 * @param {Array} items - [{value, weight}]
 * @returns {number} Moyenne pondérée
 */
const calculateWeightedAverage = (items) => {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  
  if (totalWeight === 0) return 0;
  
  const weightedSum = items.reduce((sum, item) => sum + (item.value * item.weight), 0);
  
  return roundNumber(weightedSum / totalWeight, 2);
};

/**
 * Calcule des statistiques sur un array de nombres
 * @param {Array<number>} numbers - Array de nombres
 * @returns {object} Statistiques
 */
const calculateStatistics = (numbers) => {
  if (!numbers || numbers.length === 0) {
    return { min: 0, max: 0, mean: 0, median: 0, sum: 0 };
  }
  
  const sorted = [...numbers].sort((a, b) => a - b);
  const sum = numbers.reduce((acc, val) => acc + val, 0);
  const mean = sum / numbers.length;
  
  let median;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    median = (sorted[mid - 1] + sorted[mid]) / 2;
  } else {
    median = sorted[mid];
  }
  
  return {
    min: roundNumber(sorted[0], 2),
    max: roundNumber(sorted[sorted.length - 1], 2),
    mean: roundNumber(mean, 2),
    median: roundNumber(median, 2),
    sum: roundNumber(sum, 2),
    count: numbers.length
  };
};

/**
 * Calcule le taux de croissance moyen
 * @param {Array<number>} values - Valeurs chronologiques
 * @returns {number} Taux de croissance moyen en %
 */
const calculateAverageGrowthRate = (values) => {
  if (values.length < 2) return 0;
  
  const growthRates = [];
  for (let i = 1; i < values.length; i++) {
    if (values[i - 1] !== 0) {
      const rate = ((values[i] - values[i - 1]) / values[i - 1]) * 100;
      growthRates.push(rate);
    }
  }
  
  const avgGrowth = growthRates.reduce((sum, rate) => sum + rate, 0) / growthRates.length;
  return roundNumber(avgGrowth, 2);
};

module.exports = {
  // Conversion devises
  convertHTGtoUSD,
  convertUSDtoHTG,
  convertCurrency,
  
  // Pourcentages
  calculatePercentageAmount,
  calculatePercentage,
  calculatePercentageChange,
  
  // Intérêts
  calculateSimpleInterest,
  calculateCompoundInterest,
  
  // Prêts
  calculateLoanPayment,
  calculateAmortizationSchedule,
  calculateTotalLoanCost,
  calculateEffectiveRate,
  
  // Investissements
  calculateROI,
  calculateCAGR,
  calculateFutureValue,
  calculatePresentValue,
  calculateSavingsNeeded,
  calculateDoublingTime,
  calculateRentalYield,
  calculateOpportunityCost,
  
  // Ratios financiers
  calculateDebtToIncomeRatio,
  calculateSavingsRate,
  calculateDisposableIncome,
  calculateNetCashFlow,
  calculateBreakEven,
  calculateProfitMargin,
  calculateNetWorth,
  calculateAssetToDebtRatio,
  calculateLiquidityRatio,
  
  // Budget & Planning
  calculateRecommendedBudget,
  calculateDebtRatios,
  calculateEmergencyFund,
  calculateRetirementNeeds,
  
  // Inflation & Taxes
  calculateInflationImpact,
  calculateTax,
  calculateFromTTC,
  
  // Spécial Haiti
  calculateSolReturn,
  
  // Statistiques
  calculateWeightedAverage,
  calculateStatistics,
  calculateAverageGrowthRate
};