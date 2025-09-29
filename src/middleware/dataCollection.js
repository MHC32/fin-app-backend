/**
 * MIDDLEWARE DE COLLECTE DE DONNÉES
 * Collecte anonymisée pour améliorer l'IA
 * Analytics, patterns, et insights utilisateurs
 */

const mongoose = require('mongoose');

// ==========================================
// MODÈLE DE COLLECTE
// ==========================================

/**
 * Schema pour stocker les données collectées
 */
const dataCollectionSchema = new mongoose.Schema({
  // Identification
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Type de données
  eventType: {
    type: String,
    enum: [
      'transaction_created',
      'budget_updated',
      'sol_payment',
      'debt_payment',
      'account_created',
      'ai_analysis',
      'notification_received',
      'search_performed',
      'error_occurred',
      'feature_used'
    ],
    required: true,
    index: true
  },

  // Catégorie pour regroupement
  category: {
    type: String,
    enum: ['financial', 'user_behavior', 'ai_interaction', 'error', 'performance'],
    default: 'user_behavior'
  },

  // Données collectées (anonymisées)
  data: {
    // Infos financières (montants anonymisés)
    amount: Number,
    currency: String,
    category: String,
    
    // Comportement utilisateur
    action: String,
    feature: String,
    duration: Number, // Temps passé (ms)
    
    // Contexte
    deviceType: String,
    platform: String,
    appVersion: String,
    
    // Erreurs
    errorType: String,
    errorMessage: String,
    
    // IA
    aiFeature: String,
    accuracy: Number,
    confidence: Number,
    
    // Métadonnées additionnelles
    metadata: mongoose.Schema.Types.Mixed
  },

  // Contexte géographique Haiti
  context: {
    region: String,
    city: String,
    timezone: { type: String, default: 'America/Port-au-Prince' }
  },

  // Timestamps
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },

  // Pour analytics temporels
  hour: { type: Number, min: 0, max: 23 },
  dayOfWeek: { type: Number, min: 0, max: 6 },
  dayOfMonth: { type: Number, min: 1, max: 31 },
  month: { type: Number, min: 0, max: 11 },
  year: Number
}, {
  timestamps: true,
  collection: 'dataCollection'
});

// Index composites pour requêtes fréquentes
dataCollectionSchema.index({ userId: 1, eventType: 1, timestamp: -1 });
dataCollectionSchema.index({ eventType: 1, category: 1, timestamp: -1 });
dataCollectionSchema.index({ timestamp: -1 });

const DataCollection = mongoose.model('DataCollection', dataCollectionSchema);

// ==========================================
// HELPERS DE COLLECTE
// ==========================================

/**
 * Extrait les infos du device/platform depuis req
 */
const extractDeviceInfo = (req) => {
  const userAgent = req.headers['user-agent'] || '';
  
  return {
    deviceType: userAgent.includes('Mobile') ? 'mobile' : 'desktop',
    platform: userAgent.includes('iPhone') ? 'ios' :
              userAgent.includes('Android') ? 'android' :
              userAgent.includes('Windows') ? 'windows' :
              userAgent.includes('Mac') ? 'mac' : 'other',
    appVersion: req.headers['app-version'] || '1.0.0'
  };
};

/**
 * Extrait le contexte géographique
 */
const extractGeoContext = (req) => {
  return {
    region: req.headers['x-region'] || 'Ouest',
    city: req.headers['x-city'] || 'Port-au-Prince',
    timezone: 'America/Port-au-Prince'
  };
};

/**
 * Extrait les composantes temporelles
 */
const extractTimeComponents = (date = new Date()) => {
  return {
    hour: date.getHours(),
    dayOfWeek: date.getDay(),
    dayOfMonth: date.getDate(),
    month: date.getMonth(),
    year: date.getFullYear()
  };
};

/**
 * Anonymise les montants sensibles
 * Garde les ranges pour patterns sans exposer les vraies valeurs
 */
const anonymizeAmount = (amount) => {
  if (!amount) return null;
  
  // Retourner une range au lieu du montant exact
  if (amount < 500) return 'range_0_500';
  if (amount < 1000) return 'range_500_1000';
  if (amount < 5000) return 'range_1000_5000';
  if (amount < 10000) return 'range_5000_10000';
  if (amount < 50000) return 'range_10000_50000';
  return 'range_50000_plus';
};

// ==========================================
// FONCTIONS DE COLLECTE PAR TYPE
// ==========================================

/**
 * Collecte données de transaction
 */
const collectTransactionData = async (userId, transactionData) => {
  try {
    const now = new Date();
    
    await DataCollection.create({
      userId,
      eventType: 'transaction_created',
      category: 'financial',
      data: {
        amount: anonymizeAmount(transactionData.amount),
        currency: transactionData.currency,
        category: transactionData.category,
        action: transactionData.type, // income/expense/transfer
        metadata: {
          hasDescription: !!transactionData.description,
          hasTags: transactionData.tags?.length > 0
        }
      },
      timestamp: now,
      ...extractTimeComponents(now)
    });
  } catch (error) {
    console.error('Data collection error (transaction):', error.message);
    // Ne pas bloquer la requête principale
  }
};

/**
 * Collecte données de budget
 */
const collectBudgetData = async (userId, budgetData, action = 'updated') => {
  try {
    const now = new Date();
    
    await DataCollection.create({
      userId,
      eventType: 'budget_updated',
      category: 'financial',
      data: {
        amount: anonymizeAmount(budgetData.amount),
        currency: budgetData.currency,
        category: budgetData.category,
        action,
        metadata: {
          period: budgetData.period,
          percentage: budgetData.percentage,
          alertTriggered: budgetData.percentage >= (budgetData.alertThreshold || 90)
        }
      },
      timestamp: now,
      ...extractTimeComponents(now)
    });
  } catch (error) {
    console.error('Data collection error (budget):', error.message);
  }
};

/**
 * Collecte données de sol
 */
const collectSolData = async (userId, solData, action) => {
  try {
    const now = new Date();
    
    await DataCollection.create({
      userId,
      eventType: 'sol_payment',
      category: 'financial',
      data: {
        amount: anonymizeAmount(solData.amount),
        currency: solData.currency,
        action, // created/payment/completed
        metadata: {
          frequency: solData.frequency,
          participants: solData.participants?.length,
          round: solData.currentRound
        }
      },
      timestamp: now,
      ...extractTimeComponents(now)
    });
  } catch (error) {
    console.error('Data collection error (sol):', error.message);
  }
};

/**
 * Collecte données de dette
 */
const collectDebtData = async (userId, debtData, action) => {
  try {
    const now = new Date();
    
    await DataCollection.create({
      userId,
      eventType: 'debt_payment',
      category: 'financial',
      data: {
        amount: anonymizeAmount(debtData.amount),
        currency: debtData.currency,
        action, // created/payment/completed
        metadata: {
          type: debtData.type, // lent/borrowed
          hasInterest: debtData.interestRate > 0,
          hasDueDate: !!debtData.dueDate
        }
      },
      timestamp: now,
      ...extractTimeComponents(now)
    });
  } catch (error) {
    console.error('Data collection error (debt):', error.message);
  }
};

/**
 * Collecte interactions IA
 */
const collectAIInteraction = async (userId, aiData) => {
  try {
    const now = new Date();
    
    await DataCollection.create({
      userId,
      eventType: 'ai_analysis',
      category: 'ai_interaction',
      data: {
        aiFeature: aiData.feature, // habits/predictions/advice/etc
        accuracy: aiData.accuracy,
        confidence: aiData.confidence,
        duration: aiData.duration,
        metadata: {
          insightsCount: aiData.insightsCount,
          recommendationsCount: aiData.recommendationsCount,
          dataPoints: aiData.dataPoints
        }
      },
      timestamp: now,
      ...extractTimeComponents(now)
    });
  } catch (error) {
    console.error('Data collection error (AI):', error.message);
  }
};

/**
 * Collecte erreurs
 */
const collectErrorData = async (userId, errorData, req) => {
  try {
    const now = new Date();
    const deviceInfo = extractDeviceInfo(req);
    
    await DataCollection.create({
      userId,
      eventType: 'error_occurred',
      category: 'error',
      data: {
        errorType: errorData.type,
        errorMessage: errorData.message,
        action: errorData.action,
        ...deviceInfo,
        metadata: {
          statusCode: errorData.statusCode,
          endpoint: req.originalUrl,
          method: req.method
        }
      },
      timestamp: now,
      ...extractTimeComponents(now)
    });
  } catch (error) {
    console.error('Data collection error (error):', error.message);
  }
};

/**
 * Collecte utilisation de features
 */
const collectFeatureUsage = async (userId, feature, req) => {
  try {
    const now = new Date();
    const deviceInfo = extractDeviceInfo(req);
    const geoContext = extractGeoContext(req);
    
    await DataCollection.create({
      userId,
      eventType: 'feature_used',
      category: 'user_behavior',
      data: {
        feature,
        ...deviceInfo,
        metadata: {
          endpoint: req.originalUrl,
          method: req.method
        }
      },
      context: geoContext,
      timestamp: now,
      ...extractTimeComponents(now)
    });
  } catch (error) {
    console.error('Data collection error (feature):', error.message);
  }
};

// ==========================================
// MIDDLEWARE PRINCIPAL
// ==========================================

/**
 * Middleware de collecte automatique
 * Collecte sur tous les endpoints si activé
 */
const dataCollectionMiddleware = (req, res, next) => {
  // Skip si désactivé
  if (process.env.DATA_COLLECTION_ENABLED !== 'true') {
    return next();
  }

  // Skip si pas d'utilisateur authentifié
  if (!req.user) {
    return next();
  }

  // Capturer le temps de début
  req.collectionStartTime = Date.now();

  // Hook sur la fin de la requête
  res.on('finish', async () => {
    try {
      const duration = Date.now() - req.collectionStartTime;
      const userId = req.user.id;

      // Collecte basique de feature usage
      const feature = `${req.method}_${req.route?.path || req.originalUrl}`;
      
      await collectFeatureUsage(userId, feature, req);

      // Si erreur, collecter aussi les détails
      if (res.statusCode >= 400) {
        await collectErrorData(userId, {
          type: 'http_error',
          message: `${res.statusCode} error`,
          action: feature,
          statusCode: res.statusCode
        }, req);
      }
    } catch (error) {
      console.error('Data collection middleware error:', error.message);
      // Ne pas bloquer l'app
    }
  });

  next();
};

// ==========================================
// ANALYTICS QUERIES
// ==========================================

/**
 * Récupère les patterns d'utilisation d'un user
 */
const getUserPatterns = async (userId, days = 30) => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return await DataCollection.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        timestamp: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          eventType: '$eventType',
          hour: '$hour'
        },
        count: { $sum: 1 },
        avgDuration: { $avg: '$data.duration' }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);
};

/**
 * Récupère les heures les plus actives
 */
const getPeakUsageHours = async (days = 7) => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return await DataCollection.aggregate([
    {
      $match: {
        timestamp: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$hour',
        count: { $sum: 1 }
      }
    },
    {
      $sort: { count: -1 }
    },
    {
      $limit: 5
    }
  ]);
};

/**
 * Nettoyage des vieilles données (GDPR compliance)
 */
const cleanupOldData = async (days = 90) => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const result = await DataCollection.deleteMany({
    timestamp: { $lt: cutoffDate }
  });

  console.log(`Data collection cleanup: ${result.deletedCount} documents supprimés`);
  return result;
};

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  // Middleware
  dataCollectionMiddleware,

  // Fonctions de collecte spécifiques
  collectTransactionData,
  collectBudgetData,
  collectSolData,
  collectDebtData,
  collectAIInteraction,
  collectErrorData,
  collectFeatureUsage,

  // Analytics
  getUserPatterns,
  getPeakUsageHours,
  cleanupOldData,

  // Modèle (pour queries custom)
  DataCollection
};