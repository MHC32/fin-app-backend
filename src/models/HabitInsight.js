// src/models/HabitInsight.js - Modèle insights IA FinApp Haiti
const mongoose = require('mongoose');

/**
 * Schéma pour stocker les insights générés par l'IA
 * Analyse les habitudes financières et génère des recommandations contextuelles Haiti
 */
const habitInsightSchema = new mongoose.Schema({
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
  // TYPE ET CATÉGORIE INSIGHT
  // ===================================================================
  insightType: {
    type: String,
    required: [true, 'Le type d\'insight est requis'],
    enum: {
      values: [
        'spending_pattern',      // Pattern de dépenses détecté
        'budget_alert',          // Alerte dépassement budget
        'saving_opportunity',    // Opportunité d'épargne
        'sol_recommendation',    // Recommandation sol/tontine
        'debt_reminder',         // Rappel dette/créance
        'category_optimization', // Optimisation catégorie
        'recurring_expense',     // Dépense récurrente détectée
        'income_fluctuation',    // Fluctuation revenus
        'investment_opportunity',// Opportunité investissement
        'financial_milestone'    // Jalon financier atteint
      ],
      message: 'Type d\'insight non valide'
    },
    index: true
  },
  
  category: {
    type: String,
    required: [true, 'La catégorie est requise'],
    trim: true,
    maxlength: [50, 'La catégorie ne peut pas dépasser 50 caractères']
  },
  
  // ===================================================================
  // CONTENU INSIGHT
  // ===================================================================
  title: {
    type: String,
    required: [true, 'Le titre est requis'],
    trim: true,
    minlength: [5, 'Le titre doit contenir au moins 5 caractères'],
    maxlength: [150, 'Le titre ne peut pas dépasser 150 caractères']
  },
  
  message: {
    type: String,
    required: [true, 'Le message est requis'],
    trim: true,
    minlength: [10, 'Le message doit contenir au moins 10 caractères'],
    maxlength: [1000, 'Le message ne peut pas dépasser 1000 caractères']
  },
  
  // ===================================================================
  // PRIORITÉ ET ACTIONS
  // ===================================================================
  priority: {
    type: String,
    required: [true, 'La priorité est requise'],
    enum: {
      values: ['low', 'medium', 'high', 'urgent'],
      message: 'Priorité non valide'
    },
    default: 'medium',
    index: true
  },
  
  actionable: {
    type: Boolean,
    default: true,
    index: true
  },
  
  recommendations: [{
    type: String,
    maxlength: [500, 'Une recommandation ne peut pas dépasser 500 caractères']
  }],
  
  // ===================================================================
  // DONNÉES CONTEXTUELLES
  // ===================================================================
  dataSnapshot: {
    // Données brutes utilisées pour générer l'insight
    amount: Number,
    percentage: Number,
    comparisonValue: Number,
    trend: {
      type: String,
      enum: ['increasing', 'decreasing', 'stable', 'volatile']
    },
    timeframe: {
      start: Date,
      end: Date
    },
    affectedAccounts: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account'
    }],
    relatedTransactions: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction'
    }],
    metadata: mongoose.Schema.Types.Mixed
  },
  
  // ===================================================================
  // VALIDITÉ ET STATUT
  // ===================================================================
  validUntil: {
    type: Date,
    required: [true, 'La date de validité est requise'],
    index: true
  },
  
  status: {
    type: String,
    required: [true, 'Le statut est requis'],
    enum: {
      values: ['new', 'viewed', 'acted', 'dismissed', 'expired'],
      message: 'Statut non valide'
    },
    default: 'new',
    index: true
  },
  
  viewedAt: {
    type: Date,
    sparse: true
  },
  
  actedAt: {
    type: Date,
    sparse: true
  },
  
  dismissedAt: {
    type: Date,
    sparse: true
  },
  
  // ===================================================================
  // SCORING ET PERTINENCE
  // ===================================================================
  relevanceScore: {
    type: Number,
    min: [0, 'Le score ne peut pas être négatif'],
    max: [100, 'Le score ne peut pas dépasser 100'],
    default: 50
  },
  
  impactScore: {
    type: Number,
    min: [0, 'L\'impact ne peut pas être négatif'],
    max: [100, 'L\'impact ne peut pas dépasser 100'],
    default: 50
  },
  
  // ===================================================================
  // FEEDBACK UTILISATEUR
  // ===================================================================
  userFeedback: {
    isHelpful: Boolean,
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: {
      type: String,
      maxlength: [500, 'Le commentaire ne peut pas dépasser 500 caractères']
    },
    feedbackDate: Date
  }
  
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// ===================================================================
// INDEX COMPOSÉS POUR PERFORMANCE
// ===================================================================
habitInsightSchema.index({ user: 1, status: 1, priority: 1 });
habitInsightSchema.index({ user: 1, insightType: 1, createdAt: -1 });
habitInsightSchema.index({ validUntil: 1, status: 1 });
habitInsightSchema.index({ user: 1, actionable: 1, status: 1 });

// ===================================================================
// VIRTUELS
// ===================================================================
habitInsightSchema.virtual('isActive').get(function() {
  return this.status === 'new' && this.validUntil > new Date();
});

habitInsightSchema.virtual('isExpired').get(function() {
  return this.validUntil <= new Date();
});

habitInsightSchema.virtual('daysUntilExpiry').get(function() {
  const diff = this.validUntil - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

// ===================================================================
// MIDDLEWARE PRÉ-SAVE
// ===================================================================

// Auto-expirer les insights périmés
habitInsightSchema.pre('save', function(next) {
  if (this.validUntil <= new Date() && this.status !== 'expired') {
    this.status = 'expired';
  }
  next();
});

// ===================================================================
// MÉTHODES D'INSTANCE
// ===================================================================

// Marquer comme vu
habitInsightSchema.methods.markAsViewed = function() {
  this.status = 'viewed';
  this.viewedAt = new Date();
  return this.save();
};

// Marquer comme agi
habitInsightSchema.methods.markAsActed = function() {
  this.status = 'acted';
  this.actedAt = new Date();
  return this.save();
};

// Rejeter l'insight
habitInsightSchema.methods.dismiss = function(reason = '') {
  this.status = 'dismissed';
  this.dismissedAt = new Date();
  if (reason) {
    this.userFeedback = this.userFeedback || {};
    this.userFeedback.comment = reason;
  }
  return this.save();
};

// Ajouter feedback utilisateur
habitInsightSchema.methods.addFeedback = function(feedback) {
  this.userFeedback = {
    ...this.userFeedback,
    ...feedback,
    feedbackDate: new Date()
  };
  return this.save();
};

// ===================================================================
// MÉTHODES STATIQUES
// ===================================================================

// Récupérer insights actifs par utilisateur
habitInsightSchema.statics.getActiveInsights = function(userId, options = {}) {
  const { priority, insightType, limit = 10 } = options;
  
  const query = {
    user: userId,
    status: 'new',
    validUntil: { $gt: new Date() }
  };
  
  if (priority) query.priority = priority;
  if (insightType) query.insightType = insightType;
  
  return this.find(query)
    .sort({ priority: -1, relevanceScore: -1, createdAt: -1 })
    .limit(limit)
    .populate('dataSnapshot.affectedAccounts', 'name type')
    .populate('dataSnapshot.relatedTransactions', 'description amount date');
};

// Compter insights par statut
habitInsightSchema.statics.countByStatus = function(userId) {
  return this.aggregate([
    {
      $match: { user: new mongoose.Types.ObjectId(userId) }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
};

// Nettoyer insights expirés
habitInsightSchema.statics.cleanupExpired = function(daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  return this.deleteMany({
    status: 'expired',
    validUntil: { $lt: cutoffDate }
  });
};

// Analytics insights par type
habitInsightSchema.statics.getTypeAnalytics = function(userId, startDate, endDate) {
  const matchStage = {
    user: new mongoose.Types.ObjectId(userId)
  };
  
  if (startDate || endDate) {
    matchStage.createdAt = {};
    if (startDate) matchStage.createdAt.$gte = startDate;
    if (endDate) matchStage.createdAt.$lte = endDate;
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$insightType',
        count: { $sum: 1 },
        actedCount: {
          $sum: { $cond: [{ $eq: ['$status', 'acted'] }, 1, 0] }
        },
        avgRelevanceScore: { $avg: '$relevanceScore' },
        avgImpactScore: { $avg: '$impactScore' }
      }
    },
    { $sort: { count: -1 } }
  ]);
};

// Taux d'action sur insights
habitInsightSchema.statics.getActionRate = function(userId) {
  return this.aggregate([
    {
      $match: { 
        user: new mongoose.Types.ObjectId(userId),
        status: { $in: ['acted', 'viewed', 'dismissed'] }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        acted: {
          $sum: { $cond: [{ $eq: ['$status', 'acted'] }, 1, 0] }
        }
      }
    },
    {
      $project: {
        actionRate: { 
          $multiply: [
            { $divide: ['$acted', '$total'] },
            100
          ]
        }
      }
    }
  ]);
};

// ===================================================================
// EXPORT DU MODÈLE
// ===================================================================
const HabitInsight = mongoose.model('HabitInsight', habitInsightSchema);

module.exports = HabitInsight;