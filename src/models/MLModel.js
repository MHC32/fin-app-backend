// src/models/MLModel.js - Modèle ML personnalisés FinApp Haiti
const mongoose = require('mongoose');

/**
 * Schéma pour stocker les modèles Machine Learning personnalisés par utilisateur
 * Permet d'entraîner et sauvegarder des modèles de prédiction personnalisés
 */
const mlModelSchema = new mongoose.Schema({
  // ===================================================================
  // RELATION UTILISATEUR
  // ===================================================================
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'L\'utilisateur est requis'],
    index: true
  },
  
  // ===================================================================
  // TYPE ET CONFIGURATION MODÈLE
  // ===================================================================
  modelType: {
    type: String,
    required: [true, 'Le type de modèle est requis'],
    enum: {
      values: [
        'spending_prediction',     // Prédiction dépenses futures
        'income_forecast',         // Prévision revenus
        'budget_optimization',     // Optimisation budget
        'sol_recommendation',      // Recommandation sols
        'category_classification', // Classification automatique
        'anomaly_detection',       // Détection anomalies
        'savings_potential',       // Potentiel épargne
        'debt_risk_assessment',    // Évaluation risque dettes
        'investment_scoring'       // Scoring investissements
      ],
      message: 'Type de modèle non valide'
    },
    index: true
  },
  
  name: {
    type: String,
    required: [true, 'Le nom du modèle est requis'],
    trim: true,
    minlength: [3, 'Le nom doit contenir au moins 3 caractères'],
    maxlength: [100, 'Le nom ne peut pas dépasser 100 caractères']
  },
  
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'La description ne peut pas dépasser 500 caractères']
  },
  
  // ===================================================================
  // DONNÉES D'ENTRAÎNEMENT
  // ===================================================================
  trainingData: {
    dataPoints: [{
      features: mongoose.Schema.Types.Mixed,
      label: mongoose.Schema.Types.Mixed,
      timestamp: Date,
      weight: {
        type: Number,
        default: 1.0
      }
    }],
    
    featureNames: [String],
    
    stats: {
      totalSamples: {
        type: Number,
        default: 0
      },
      featureCount: {
        type: Number,
        default: 0
      },
      dateRange: {
        start: Date,
        end: Date
      },
      dataQuality: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
      }
    },
    
    preprocessing: {
      normalization: {
        type: String,
        enum: ['none', 'min-max', 'z-score', 'log'],
        default: 'none'
      },
      encoding: {
        type: String,
        enum: ['none', 'one-hot', 'label'],
        default: 'none'
      },
      missingValues: {
        type: String,
        enum: ['drop', 'mean', 'median', 'mode', 'forward-fill'],
        default: 'drop'
      }
    }
  },
  
  // ===================================================================
  // PARAMÈTRES DU MODÈLE
  // ===================================================================
  parameters: {
    algorithm: {
      type: String,
      enum: ['linear-regression', 'logistic-regression', 'decision-tree', 'random-forest', 'neural-network', 'clustering'],
      default: 'linear-regression'
    },
    
    hyperparameters: mongoose.Schema.Types.Mixed,
    
    trainTestSplit: {
      type: Number,
      min: 0.1,
      max: 0.9,
      default: 0.8
    },
    
    crossValidationFolds: {
      type: Number,
      min: 2,
      max: 10,
      default: 5
    },
    
    learningRate: {
      type: Number,
      min: 0.0001,
      max: 1.0,
      default: 0.01
    },
    
    epochs: {
      type: Number,
      min: 1,
      max: 1000,
      default: 100
    },
    
    batchSize: {
      type: Number,
      min: 1,
      max: 512,
      default: 32
    }
  },
  
  // ===================================================================
  // MÉTRIQUES DE PERFORMANCE
  // ===================================================================
  accuracy: {
    type: Number,
    min: [0, 'L\'accuracy ne peut pas être négative'],
    max: [100, 'L\'accuracy ne peut pas dépasser 100%'],
    default: 0,
    index: true
  },
  
  metrics: {
    mse: Number,        // Mean Squared Error
    rmse: Number,       // Root Mean Squared Error
    mae: Number,        // Mean Absolute Error
    r2Score: Number,    // R² Score
    precision: Number,  // Précision
    recall: Number,     // Rappel
    f1Score: Number,    // F1 Score
    auc: Number,        // Area Under Curve
    confusionMatrix: [[Number]]
  },
  
  // ===================================================================
  // ENTRAÎNEMENT ET VERSIONS
  // ===================================================================
  lastTrained: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  trainingDuration: {
    type: Number, // en secondes
    min: 0
  },
  
  version: {
    type: Number,
    required: [true, 'La version est requise'],
    default: 1,
    min: 1
  },
  
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  
  status: {
    type: String,
    enum: ['training', 'trained', 'deployed', 'deprecated', 'failed'],
    default: 'training',
    index: true
  },
  
  // ===================================================================
  // PRÉDICTIONS
  // ===================================================================
  predictions: [{
    input: mongoose.Schema.Types.Mixed,
    output: mongoose.Schema.Types.Mixed,
    confidence: {
      type: Number,
      min: 0,
      max: 100
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    actualValue: mongoose.Schema.Types.Mixed,
    error: Number
  }],
  
  predictionStats: {
    totalPredictions: {
      type: Number,
      default: 0
    },
    avgConfidence: {
      type: Number,
      default: 0
    },
    avgError: {
      type: Number,
      default: 0
    }
  },
  
  // ===================================================================
  // MÉTADONNÉES
  // ===================================================================
  metadata: {
    createdBy: {
      type: String,
      enum: ['system', 'user', 'auto'],
      default: 'system'
    },
    
    tags: [{
      type: String,
      maxlength: 30
    }],
    
    environment: {
      type: String,
      enum: ['development', 'staging', 'production'],
      default: 'development'
    },
    
    computeResources: {
      cpuTime: Number,
      memoryUsed: Number,
      gpuUsed: Boolean
    }
  }
  
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.__v;
      // Ne pas exposer les données d'entraînement complètes dans les réponses
      if (ret.trainingData && ret.trainingData.dataPoints) {
        ret.trainingData.dataPointsCount = ret.trainingData.dataPoints.length;
        delete ret.trainingData.dataPoints;
      }
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// ===================================================================
// INDEX COMPOSÉS
// ===================================================================
mlModelSchema.index({ user: 1, modelType: 1, isActive: 1 });
mlModelSchema.index({ user: 1, status: 1, accuracy: -1 });
mlModelSchema.index({ modelType: 1, accuracy: -1 });
mlModelSchema.index({ lastTrained: -1 });

// ===================================================================
// VIRTUELS
// ===================================================================
mlModelSchema.virtual('needsRetraining').get(function() {
  const daysSinceTraining = (Date.now() - this.lastTrained) / (1000 * 60 * 60 * 24);
  return daysSinceTraining > 30 || this.accuracy < 70;
});

mlModelSchema.virtual('performanceGrade').get(function() {
  if (this.accuracy >= 90) return 'A';
  if (this.accuracy >= 80) return 'B';
  if (this.accuracy >= 70) return 'C';
  if (this.accuracy >= 60) return 'D';
  return 'F';
});

mlModelSchema.virtual('isDeployed').get(function() {
  return this.status === 'deployed' && this.isActive;
});

// ===================================================================
// MIDDLEWARE PRÉ-SAVE
// ===================================================================

// Auto-incrémenter version si réentraîné
mlModelSchema.pre('save', function(next) {
  if (this.isModified('lastTrained') && !this.isNew) {
    this.version += 1;
  }
  next();
});

// Calculer stats prédictions
mlModelSchema.pre('save', function(next) {
  if (this.predictions && this.predictions.length > 0) {
    this.predictionStats.totalPredictions = this.predictions.length;
    
    const confidences = this.predictions
      .filter(p => p.confidence)
      .map(p => p.confidence);
    this.predictionStats.avgConfidence = 
      confidences.length > 0 
        ? confidences.reduce((a, b) => a + b, 0) / confidences.length 
        : 0;
    
    const errors = this.predictions
      .filter(p => p.error !== undefined)
      .map(p => Math.abs(p.error));
    this.predictionStats.avgError = 
      errors.length > 0 
        ? errors.reduce((a, b) => a + b, 0) / errors.length 
        : 0;
  }
  next();
});

// ===================================================================
// MÉTHODES D'INSTANCE
// ===================================================================

// Ajouter une prédiction
mlModelSchema.methods.addPrediction = function(input, output, confidence = null) {
  this.predictions.push({
    input,
    output,
    confidence,
    timestamp: new Date()
  });
  
  // Limiter à 1000 dernières prédictions
  if (this.predictions.length > 1000) {
    this.predictions = this.predictions.slice(-1000);
  }
  
  return this.save();
};

// Mettre à jour métriques
mlModelSchema.methods.updateMetrics = function(newMetrics) {
  this.metrics = { ...this.metrics, ...newMetrics };
  this.accuracy = newMetrics.accuracy || this.accuracy;
  return this.save();
};

// Déployer le modèle
mlModelSchema.methods.deploy = function() {
  if (this.accuracy < 60) {
    throw new Error('Accuracy trop faible pour déploiement (minimum 60%)');
  }
  this.status = 'deployed';
  this.isActive = true;
  return this.save();
};

// Déprécier le modèle
mlModelSchema.methods.deprecate = function(reason = '') {
  this.status = 'deprecated';
  this.isActive = false;
  if (reason) {
    this.metadata.deprecationReason = reason;
  }
  return this.save();
};

// ===================================================================
// MÉTHODES STATIQUES
// ===================================================================

// Récupérer modèles actifs par utilisateur
mlModelSchema.statics.getActiveModels = function(userId, modelType = null) {
  const query = {
    user: userId,
    isActive: true,
    status: 'deployed'
  };
  
  if (modelType) query.modelType = modelType;
  
  return this.find(query).sort({ accuracy: -1, lastTrained: -1 });
};

// Meilleur modèle par type
mlModelSchema.statics.getBestModel = function(userId, modelType) {
  return this.findOne({
    user: userId,
    modelType,
    isActive: true,
    status: 'deployed'
  }).sort({ accuracy: -1, lastTrained: -1 });
};

// Modèles nécessitant réentraînement
mlModelSchema.statics.getNeedRetraining = function(userId, daysThreshold = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysThreshold);
  
  return this.find({
    user: userId,
    isActive: true,
    $or: [
      { lastTrained: { $lt: cutoffDate } },
      { accuracy: { $lt: 70 } }
    ]
  });
};

// Comparer performances modèles
mlModelSchema.statics.compareModels = function(modelIds) {
  return this.aggregate([
    {
      $match: {
        _id: { $in: modelIds.map(id => new mongoose.Types.ObjectId(id)) }
      }
    },
    {
      $project: {
        modelType: 1,
        version: 1,
        accuracy: 1,
        'metrics.rmse': 1,
        'metrics.f1Score': 1,
        lastTrained: 1,
        'predictionStats.totalPredictions': 1,
        'predictionStats.avgConfidence': 1
      }
    },
    { $sort: { accuracy: -1 } }
  ]);
};

// Analytics modèles utilisateur
mlModelSchema.statics.getUserModelAnalytics = function(userId) {
  return this.aggregate([
    {
      $match: { user: new mongoose.Types.ObjectId(userId) }
    },
    {
      $group: {
        _id: '$modelType',
        totalModels: { $sum: 1 },
        activeModels: {
          $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
        },
        avgAccuracy: { $avg: '$accuracy' },
        bestAccuracy: { $max: '$accuracy' },
        totalPredictions: { $sum: '$predictionStats.totalPredictions' }
      }
    },
    { $sort: { avgAccuracy: -1 } }
  ]);
};

// Nettoyer anciens modèles dépréciés
mlModelSchema.statics.cleanupDeprecated = function(daysOld = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  return this.deleteMany({
    status: 'deprecated',
    updatedAt: { $lt: cutoffDate }
  });
};

// ===================================================================
// EXPORT DU MODÈLE
// ===================================================================
const MLModel = mongoose.model('MLModel', mlModelSchema);

module.exports = MLModel;