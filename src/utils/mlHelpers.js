// src/utils/mlHelpers.js
// Fonctions ML réutilisables - FinApp Haiti
// Phase 7 IA Foundation

const { CURRENCIES } = require('./constants');

/**
 * Utilitaires Machine Learning pour analyses financières
 */
class MLHelpers {

  // ===================================================================
  // 1. NORMALISATION & CONVERSION
  // ===================================================================

  /**
   * Normaliser montant dans devise commune (HTG)
   * @param {Number} amount - Montant
   * @param {String} currency - Devise (HTG/USD)
   * @param {Number} exchangeRate - Taux de change (défaut 130)
   * @returns {Number} - Montant normalisé en HTG
   */
  static normalizeAmount(amount, currency = 'HTG', exchangeRate = 130) {
    if (currency === 'USD') {
      return amount * exchangeRate;
    }
    return amount;
  }

  /**
   * Convertir montant vers devise cible
   * @param {Number} amount - Montant
   * @param {String} fromCurrency - Devise source
   * @param {String} toCurrency - Devise cible
   * @param {Number} exchangeRate - Taux de change
   * @returns {Number} - Montant converti
   */
  static convertCurrency(amount, fromCurrency, toCurrency, exchangeRate = 130) {
    if (fromCurrency === toCurrency) return amount;

    if (fromCurrency === 'USD' && toCurrency === 'HTG') {
      return amount * exchangeRate;
    }

    if (fromCurrency === 'HTG' && toCurrency === 'USD') {
      return amount / exchangeRate;
    }

    return amount;
  }

  // ===================================================================
  // 2. STATISTIQUES DE BASE
  // ===================================================================

  /**
   * Calculer moyenne
   * @param {Array} numbers - Tableau de nombres
   * @returns {Number} - Moyenne
   */
  static mean(numbers) {
    if (numbers.length === 0) return 0;
    return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  }

  /**
   * Calculer médiane
   * @param {Array} numbers - Tableau de nombres
   * @returns {Number} - Médiane
   */
  static median(numbers) {
    if (numbers.length === 0) return 0;
    
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
  }

  /**
   * Calculer écart-type
   * @param {Array} numbers - Tableau de nombres
   * @returns {Number} - Écart-type
   */
  static standardDeviation(numbers) {
    if (numbers.length === 0) return 0;
    
    const avg = this.mean(numbers);
    const squareDiffs = numbers.map(n => Math.pow(n - avg, 2));
    const avgSquareDiff = this.mean(squareDiffs);
    
    return Math.sqrt(avgSquareDiff);
  }

  /**
   * Calculer variance
   * @param {Array} numbers - Tableau de nombres
   * @returns {Number} - Variance
   */
  static variance(numbers) {
    if (numbers.length === 0) return 0;
    
    const avg = this.mean(numbers);
    return numbers.reduce((sum, n) => sum + Math.pow(n - avg, 2), 0) / numbers.length;
  }

  // ===================================================================
  // 3. MOYENNE PONDÉRÉE & WEIGHTED AVERAGE
  // ===================================================================

  /**
   * Calculer moyenne pondérée
   * @param {Array} data - [{value, weight}]
   * @returns {Number} - Moyenne pondérée
   */
  static calculateWeightedAverage(data) {
    if (data.length === 0) return 0;
    
    const totalWeight = data.reduce((sum, d) => sum + d.weight, 0);
    if (totalWeight === 0) return 0;
    
    const weightedSum = data.reduce((sum, d) => sum + (d.value * d.weight), 0);
    return weightedSum / totalWeight;
  }

  /**
   * Calculer moyenne mobile (moving average)
   * @param {Array} numbers - Données temporelles
   * @param {Number} window - Taille fenêtre
   * @returns {Array} - Moyennes mobiles
   */
  static movingAverage(numbers, window = 7) {
    const result = [];
    
    for (let i = 0; i < numbers.length; i++) {
      const start = Math.max(0, i - window + 1);
      const subset = numbers.slice(start, i + 1);
      result.push(this.mean(subset));
    }
    
    return result;
  }

  // ===================================================================
  // 4. DÉTECTION OUTLIERS
  // ===================================================================

  /**
   * Trouver valeurs aberrantes (outliers)
   * @param {Array} numbers - Données
   * @param {Number} threshold - Seuil (défaut 2 = 2 écarts-types)
   * @returns {Object} - {outliers, indices, statistics}
   */
  static findOutliers(numbers, threshold = 2) {
    if (numbers.length === 0) {
      return { outliers: [], indices: [], statistics: null };
    }

    const avg = this.mean(numbers);
    const stdDev = this.standardDeviation(numbers);
    const lowerBound = avg - (threshold * stdDev);
    const upperBound = avg + (threshold * stdDev);

    const outliers = [];
    const indices = [];

    numbers.forEach((num, index) => {
      if (num < lowerBound || num > upperBound) {
        outliers.push(num);
        indices.push(index);
      }
    });

    return {
      outliers,
      indices,
      statistics: {
        mean: avg,
        stdDev,
        lowerBound,
        upperBound,
        outlierCount: outliers.length,
        outlierPercentage: ((outliers.length / numbers.length) * 100).toFixed(1)
      }
    };
  }

  /**
   * Détecter anomalies par méthode IQR (Interquartile Range)
   * @param {Array} numbers - Données
   * @returns {Object} - Anomalies détectées
   */
  static detectAnomaliesIQR(numbers) {
    if (numbers.length === 0) {
      return { anomalies: [], indices: [] };
    }

    const sorted = [...numbers].sort((a, b) => a - b);
    const q1Index = Math.floor(sorted.length * 0.25);
    const q3Index = Math.floor(sorted.length * 0.75);
    
    const q1 = sorted[q1Index];
    const q3 = sorted[q3Index];
    const iqr = q3 - q1;
    
    const lowerBound = q1 - (1.5 * iqr);
    const upperBound = q3 + (1.5 * iqr);

    const anomalies = [];
    const indices = [];

    numbers.forEach((num, index) => {
      if (num < lowerBound || num > upperBound) {
        anomalies.push(num);
        indices.push(index);
      }
    });

    return {
      anomalies,
      indices,
      q1,
      q3,
      iqr,
      lowerBound,
      upperBound
    };
  }

  // ===================================================================
  // 5. CORRÉLATION & PATTERNS
  // ===================================================================

  /**
   * Calculer corrélation entre deux variables
   * @param {Array} x - Variable X
   * @param {Array} y - Variable Y
   * @returns {Number} - Coefficient corrélation (-1 à 1)
   */
  static calculateCorrelation(x, y) {
    if (x.length !== y.length || x.length === 0) return 0;

    const n = x.length;
    const meanX = this.mean(x);
    const meanY = this.mean(y);

    let numerator = 0;
    let denomX = 0;
    let denomY = 0;

    for (let i = 0; i < n; i++) {
      const diffX = x[i] - meanX;
      const diffY = y[i] - meanY;
      
      numerator += diffX * diffY;
      denomX += diffX * diffX;
      denomY += diffY * diffY;
    }

    if (denomX === 0 || denomY === 0) return 0;

    return numerator / Math.sqrt(denomX * denomY);
  }

  // ===================================================================
  // 6. GROUPEMENT & FRÉQUENCE
  // ===================================================================

  /**
   * Grouper transactions par fréquence
   * @param {Array} transactions - Transactions avec dates
   * @returns {Object} - Patterns fréquence
   */
  static groupByFrequency(transactions) {
    if (transactions.length === 0) {
      return { daily: [], weekly: [], monthly: [], rare: [] };
    }

    // Créer map de dates
    const dateMap = {};
    transactions.forEach(t => {
      const dateKey = new Date(t.date).toISOString().split('T')[0];
      if (!dateMap[dateKey]) {
        dateMap[dateKey] = [];
      }
      dateMap[dateKey].push(t);
    });

    // Calculer nombre de jours avec transactions
    const daysWithTransactions = Object.keys(dateMap).length;
    const totalDays = this.daysBetween(
      new Date(transactions[transactions.length - 1].date),
      new Date(transactions[0].date)
    );

    const avgPerDay = transactions.length / totalDays;

    // Classifier
    const classified = {
      daily: avgPerDay >= 1 ? transactions : [],
      weekly: avgPerDay >= 0.5 && avgPerDay < 1 ? transactions : [],
      monthly: avgPerDay >= 0.1 && avgPerDay < 0.5 ? transactions : [],
      rare: avgPerDay < 0.1 ? transactions : []
    };

    return {
      ...classified,
      statistics: {
        daysWithTransactions,
        totalDays,
        avgPerDay: avgPerDay.toFixed(2),
        consistency: ((daysWithTransactions / totalDays) * 100).toFixed(1) + '%'
      }
    };
  }

  /**
   * Calculer jours entre deux dates
   * @param {Date} date1 - Date 1
   * @param {Date} date2 - Date 2
   * @returns {Number} - Nombre de jours
   */
  static daysBetween(date1, date2) {
    const diffTime = Math.abs(date2 - date1);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  // ===================================================================
  // 7. SAISONNALITÉ & TENDANCES
  // ===================================================================

  /**
   * Calculer saisonnalité (patterns mensuels)
   * @param {Array} data - [{date, value}]
   * @returns {Object} - Patterns saisonniers
   */
  static calculateSeasonality(data) {
    if (data.length === 0) {
      return { monthly: {}, trend: 'insufficient_data' };
    }

    // Grouper par mois
    const monthlyData = {};
    data.forEach(d => {
      const month = new Date(d.date).getMonth(); // 0-11
      if (!monthlyData[month]) {
        monthlyData[month] = [];
      }
      monthlyData[month].push(d.value);
    });

    // Calculer moyennes mensuelles
    const monthlyAverages = {};
    Object.entries(monthlyData).forEach(([month, values]) => {
      monthlyAverages[month] = this.mean(values);
    });

    // Identifier mois hauts/bas
    const sortedMonths = Object.entries(monthlyAverages)
      .sort((a, b) => b[1] - a[1]);

    const monthNames = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];

    return {
      monthly: monthlyAverages,
      highestMonth: {
        month: monthNames[sortedMonths[0][0]],
        average: sortedMonths[0][1]
      },
      lowestMonth: {
        month: monthNames[sortedMonths[sortedMonths.length - 1][0]],
        average: sortedMonths[sortedMonths.length - 1][1]
      },
      seasonalVariation: this.calculateSeasonalVariation(Object.values(monthlyAverages))
    };
  }

  /**
   * Calculer variation saisonnière
   */
  static calculateSeasonalVariation(monthlyAverages) {
    if (monthlyAverages.length === 0) return 0;
    
    const max = Math.max(...monthlyAverages);
    const min = Math.min(...monthlyAverages);
    const avg = this.mean(monthlyAverages);
    
    if (avg === 0) return 0;
    return (((max - min) / avg) * 100).toFixed(1);
  }

  /**
   * Détecter tendance (hausse/baisse/stable)
   * @param {Array} values - Valeurs temporelles
   * @param {Number} window - Fenêtre comparaison (défaut 30)
   * @returns {Object} - Tendance détectée
   */
  static detectTrend(values, window = 30) {
    if (values.length < window * 2) {
      return {
        trend: 'insufficient_data',
        confidence: 0
      };
    }

    // Comparer première moitié vs seconde moitié
    const firstHalf = values.slice(0, window);
    const secondHalf = values.slice(-window);

    const avgFirst = this.mean(firstHalf);
    const avgSecond = this.mean(secondHalf);

    const percentChange = ((avgSecond - avgFirst) / avgFirst) * 100;

    let trend;
    let confidence;

    if (percentChange > 10) {
      trend = 'increasing';
      confidence = Math.min(percentChange / 20, 1); // Max 1
    } else if (percentChange < -10) {
      trend = 'decreasing';
      confidence = Math.min(Math.abs(percentChange) / 20, 1);
    } else {
      trend = 'stable';
      confidence = 1 - (Math.abs(percentChange) / 10);
    }

    return {
      trend,
      confidence: parseFloat(confidence.toFixed(2)),
      percentChange: percentChange.toFixed(1),
      avgFirst: avgFirst.toFixed(0),
      avgSecond: avgSecond.toFixed(0)
    };
  }

  // ===================================================================
  // 8. NORMALISATION DONNÉES ML
  // ===================================================================

  /**
   * Normaliser données entre 0 et 1 (min-max normalization)
   * @param {Array} numbers - Données
   * @returns {Array} - Données normalisées
   */
  static minMaxNormalize(numbers) {
    if (numbers.length === 0) return [];

    const min = Math.min(...numbers);
    const max = Math.max(...numbers);
    
    if (max === min) return numbers.map(() => 0.5);

    return numbers.map(n => (n - min) / (max - min));
  }

  /**
   * Normaliser données par z-score
   * @param {Array} numbers - Données
   * @returns {Array} - Z-scores
   */
  static zScoreNormalize(numbers) {
    if (numbers.length === 0) return [];

    const avg = this.mean(numbers);
    const stdDev = this.standardDeviation(numbers);

    if (stdDev === 0) return numbers.map(() => 0);

    return numbers.map(n => (n - avg) / stdDev);
  }

  // ===================================================================
  // 9. CLASSIFICATION & BINNING
  // ===================================================================

  /**
   * Classifier montant en catégorie (petit/moyen/grand)
   * @param {Number} amount - Montant
   * @param {Array} thresholds - [petit, moyen] seuils
   * @returns {String} - Catégorie
   */
  static classifyAmount(amount, thresholds = [500, 2000]) {
    if (amount <= thresholds[0]) return 'petit';
    if (amount <= thresholds[1]) return 'moyen';
    return 'grand';
  }

  /**
   * Créer bins (intervalles) pour histogramme
   * @param {Array} numbers - Données
   * @param {Number} numBins - Nombre de bins (défaut 10)
   * @returns {Array} - Bins avec counts
   */
  static createHistogramBins(numbers, numBins = 10) {
    if (numbers.length === 0) return [];

    const min = Math.min(...numbers);
    const max = Math.max(...numbers);
    const binSize = (max - min) / numBins;

    const bins = Array(numBins).fill(0).map((_, i) => ({
      min: min + (i * binSize),
      max: min + ((i + 1) * binSize),
      count: 0,
      values: []
    }));

    numbers.forEach(num => {
      const binIndex = Math.min(
        Math.floor((num - min) / binSize),
        numBins - 1
      );
      bins[binIndex].count++;
      bins[binIndex].values.push(num);
    });

    return bins;
  }

  // ===================================================================
  // 10. SIMILARITÉ & DISTANCE
  // ===================================================================

  /**
   * Calculer distance euclidienne entre deux vecteurs
   * @param {Array} vector1 - Vecteur 1
   * @param {Array} vector2 - Vecteur 2
   * @returns {Number} - Distance
   */
  static euclideanDistance(vector1, vector2) {
    if (vector1.length !== vector2.length) {
      throw new Error('Vecteurs de tailles différentes');
    }

    let sum = 0;
    for (let i = 0; i < vector1.length; i++) {
      sum += Math.pow(vector1[i] - vector2[i], 2);
    }

    return Math.sqrt(sum);
  }

  /**
   * Calculer similarité cosinus entre deux vecteurs
   * @param {Array} vector1 - Vecteur 1
   * @param {Array} vector2 - Vecteur 2
   * @returns {Number} - Similarité (0-1)
   */
  static cosineSimilarity(vector1, vector2) {
    if (vector1.length !== vector2.length) {
      throw new Error('Vecteurs de tailles différentes');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vector1.length; i++) {
      dotProduct += vector1[i] * vector2[i];
      norm1 += vector1[i] * vector1[i];
      norm2 += vector2[i] * vector2[i];
    }

    if (norm1 === 0 || norm2 === 0) return 0;

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  // ===================================================================
  // 11. PRÉDICTIONS SIMPLES
  // ===================================================================

  /**
   * Régression linéaire simple
   * @param {Array} x - Variables indépendantes
   * @param {Array} y - Variables dépendantes
   * @returns {Object} - {slope, intercept, predict}
   */
  static simpleLinearRegression(x, y) {
    if (x.length !== y.length || x.length === 0) {
      throw new Error('Données invalides pour régression');
    }

    const n = x.length;
    const meanX = this.mean(x);
    const meanY = this.mean(y);

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (x[i] - meanX) * (y[i] - meanY);
      denominator += Math.pow(x[i] - meanX, 2);
    }

    const slope = denominator === 0 ? 0 : numerator / denominator;
    const intercept = meanY - (slope * meanX);

    return {
      slope,
      intercept,
      predict: (xValue) => slope * xValue + intercept,
      r2: this.calculateR2(x, y, slope, intercept)
    };
  }

  /**
   * Calculer R² (coefficient détermination)
   */
  static calculateR2(x, y, slope, intercept) {
    const meanY = this.mean(y);
    let ssRes = 0;
    let ssTot = 0;

    for (let i = 0; i < x.length; i++) {
      const predicted = slope * x[i] + intercept;
      ssRes += Math.pow(y[i] - predicted, 2);
      ssTot += Math.pow(y[i] - meanY, 2);
    }

    if (ssTot === 0) return 0;
    return 1 - (ssRes / ssTot);
  }

  // ===================================================================
  // 12. UTILITAIRES CONTEXTE HAITI
  // ===================================================================

  /**
   * Convertir montant avec contexte Haiti
   * @param {Number} amount - Montant
   * @param {String} currency - Devise
   * @returns {Object} - Montant avec contexte
   */
  static formatAmountWithContext(amount, currency = 'HTG') {
    const normalized = this.normalizeAmount(amount, currency);

    let category;
    if (normalized < 100) category = 'très_petit';
    else if (normalized < 500) category = 'petit';
    else if (normalized < 2000) category = 'moyen';
    else if (normalized < 10000) category = 'élevé';
    else category = 'très_élevé';

    // Équivalents contextuels Haiti
    const context = [];
    if (normalized >= 25 && normalized <= 50) {
      context.push('~1-2 tap-tap');
    }
    if (normalized >= 100 && normalized <= 200) {
      context.push('~1 lunch');
    }
    if (normalized >= 500 && normalized <= 1000) {
      context.push('~1 plein essence moto');
    }

    return {
      amount: normalized,
      currency: 'HTG',
      category,
      context: context.length > 0 ? context : ['Montant standard']
    };
  }
}

module.exports = MLHelpers;