// src/models/Investment.js - Modèle investissements FinApp Haiti
const mongoose = require('mongoose');

// Import des constantes
const { 
  INVESTMENT_TYPES,
  CURRENCIES,
  DEFAULTS,
  LIMITS
} = require('../utils/constants');

/**
 * Schéma Investment adapté au contexte haïtien
 */
const investmentSchema = new mongoose.Schema({
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
  // INFORMATIONS PROJET
  // ===================================================================
  name: {
    type: String,
    required: [true, 'Le nom du projet est requis'],
    trim: true,
    minlength: [3, 'Le nom doit contenir au moins 3 caractères'],
    maxlength: [150, 'Le nom ne peut pas dépasser 150 caractères']
  },
  
  description: {
    type: String,
    required: [true, 'La description est requise'],
    trim: true,
    minlength: [10, 'La description doit contenir au moins 10 caractères'],
    maxlength: [1000, 'La description ne peut pas dépasser 1000 caractères']
  },
  
  type: {
    type: String,
    required: [true, 'Le type d\'investissement est requis'],
    enum: {
      values: Object.keys(INVESTMENT_TYPES),
      message: 'Type d\'investissement non valide'
    }
  },
  
  category: {
    type: String,
    enum: ['agriculture', 'commerce', 'immobilier', 'technologie', 'services', 'industrie', 'autre'],
    default: 'autre'
  },
  
  // ===================================================================
  // FINANCES ET MONTANTS
  // ===================================================================
  currency: {
    type: String,
    required: [true, 'La devise est requise'],
    enum: {
      values: Object.keys(CURRENCIES),
      message: 'Devise non supportée'
    },
    default: DEFAULTS.CURRENCY
  },
  
  initialInvestment: {
    type: Number,
    required: [true, 'L\'investissement initial est requis'],
    min: [LIMITS.BUDGET.MIN_AMOUNT, 'Investissement initial trop faible']
  },
  
  additionalInvestments: {
    type: Number,
    default: 0,
    min: [0, 'Les investissements additionnels doivent être positifs']
  },
  
  totalInvested: {
    type: Number,
    default: function() {
      return this.initialInvestment + this.additionalInvestments;
    }
  },
  
  currentValue: {
    type: Number,
    default: function() {
      return this.initialInvestment;
    }
  },
  
  expectedReturn: {
    type: Number,
    min: [0, 'Le retour attendu doit être positif']
  },
  
  expectedReturnPercentage: {
    type: Number,
    min: [0, 'Le pourcentage de retour doit être positif'],
    max: [1000, 'Pourcentage de retour trop élevé']
  },
  
  // ===================================================================
  // DATES ET TIMING
  // ===================================================================
  startDate: {
    type: Date,
    required: [true, 'La date de début est requise'],
    default: Date.now,
    index: true
  },
  
  expectedEndDate: {
    type: Date,
    validate: {
      validator: function(v) {
        return !v || v > this.startDate;
      },
      message: 'La date de fin attendue doit être postérieure à la date de début'
    }
  },
  
  actualEndDate: {
    type: Date
  },
  
  lastUpdateDate: {
    type: Date,
    default: Date.now
  },
  
  // ===================================================================
  // PARTENAIRES ET CO-INVESTISSEURS
  // ===================================================================
  partners: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    percentage: {
      type: Number,
      required: true,
      min: [0, 'Le pourcentage doit être positif'],
      max: [100, 'Le pourcentage ne peut pas dépasser 100%']
    },
    investmentAmount: {
      type: Number,
      required: true,
      min: [0, 'Le montant d\'investissement doit être positif']
    },
    role: {
      type: String,
      enum: ['co_investor', 'advisor', 'manager', 'silent_partner'],
      default: 'co_investor'
    },
    joinedDate: {
      type: Date,
      default: Date.now
    },
    contactInfo: {
      phone: String,
      email: String,
      address: String
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  
  // ===================================================================
  // LOCALISATION HAÏTI
  // ===================================================================
  location: {
    region: {
      type: String,
      enum: ['ouest', 'nord', 'sud', 'artibonite', 'centre', 'grand_anse', 'nippes', 'nord_est', 'nord_ouest', 'sud_est']
    },
    city: String,
    address: String,
    coordinates: {
      latitude: {
        type: Number,
        min: [-90, 'Latitude invalide'],
        max: [90, 'Latitude invalide']
      },
      longitude: {
        type: Number,
        min: [-180, 'Longitude invalide'],
        max: [180, 'Longitude invalide']
      }
    }
  },
  
  // ===================================================================
  // TRACKING REVENUS ET DÉPENSES
  // ===================================================================
  revenues: [{
    amount: {
      type: Number,
      required: true,
      min: [0, 'Le montant du revenu doit être positif']
    },
    date: {
      type: Date,
      required: true,
      default: Date.now
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    source: {
      type: String,
      enum: ['sales', 'rent', 'dividend', 'interest', 'profit_share', 'other'],
      default: 'sales'
    },
    isRecurring: {
      type: Boolean,
      default: false
    },
    recurringFrequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly']
    },
    transactionRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction'
    }
  }],
  
  expenses: [{
    amount: {
      type: Number,
      required: true,
      min: [0, 'Le montant de la dépense doit être positif']
    },
    date: {
      type: Date,
      required: true,
      default: Date.now
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: String,
      enum: ['maintenance', 'supplies', 'labor', 'marketing', 'equipment', 'utilities', 'rent', 'insurance', 'taxes', 'other'],
      default: 'other'
    },
    isRecurring: {
      type: Boolean,
      default: false
    },
    recurringFrequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly']
    },
    transactionRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction'
    }
  }],
  
  // ===================================================================
  // ÉVALUATIONS ET MISES À JOUR
  // ===================================================================
  valuations: [{
    value: {
      type: Number,
      required: true,
      min: [0, 'La valeur doit être positive']
    },
    date: {
      type: Date,
      required: true,
      default: Date.now
    },
    method: {
      type: String,
      enum: ['market_value', 'book_value', 'estimated', 'professional_appraisal', 'comparable_sales'],
      default: 'estimated'
    },
    notes: {
      type: String,
      maxlength: [500, 'Les notes ne peuvent pas dépasser 500 caractères']
    },
    valuedBy: {
      type: String,
      enum: ['owner', 'partner', 'professional', 'third_party'],
      default: 'owner'
    }
  }],
  
  // ===================================================================
  // OBJECTIFS ET PERFORMANCE
  // ===================================================================
  goals: {
    targetROI: {
      type: Number,
      min: [0, 'Le ROI cible doit être positif']
    },
    targetROITimeframe: {
      type: String,
      enum: ['1_year', '2_years', '3_years', '5_years', '10_years', 'long_term']
    },
    monthlyIncomeTarget: {
      type: Number,
      min: [0, 'L\'objectif de revenu mensuel doit être positif']
    },
    exitStrategy: {
      type: String,
      enum: ['sell', 'scale', 'maintain', 'liquidate', 'transfer', 'undecided'],
      default: 'undecided'
    },
    exitTimeframe: {
      type: String,
      enum: ['1_year', '2_years', '3_years', '5_years', '10_years', 'never']
    }
  },
  
  // ===================================================================
  // RISQUES ET DÉFIS
  // ===================================================================
  risks: [{
    type: {
      type: String,
      enum: ['market', 'financial', 'operational', 'regulatory', 'environmental', 'political', 'currency', 'other'],
      required: true
    },
    description: {
      type: String,
      required: true,
      maxlength: [300, 'La description du risque ne peut pas dépasser 300 caractères']
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    likelihood: {
      type: String,
      enum: ['unlikely', 'possible', 'likely', 'certain'],
      default: 'possible'
    },
    mitigation: {
      type: String,
      maxlength: [300, 'La stratégie d\'atténuation ne peut pas dépasser 300 caractères']
    },
    dateIdentified: {
      type: Date,
      default: Date.now
    }
  }],
  
  // ===================================================================
  // STATUT ET GESTION
  // ===================================================================
  status: {
    type: String,
    enum: ['planning', 'active', 'profitable', 'break_even', 'loss', 'on_hold', 'completed', 'failed'],
    default: 'planning'
  },
  
  isActive: {
    type: Boolean,
    default: true
  },
  
  isConfidential: {
    type: Boolean,
    default: false
  },
  
  // ===================================================================
  // DOCUMENTS ET ATTACHMENTS
  // ===================================================================
  documents: [{
    name: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['contract', 'receipt', 'invoice', 'report', 'photo', 'legal', 'insurance', 'other'],
      default: 'other'
    },
    url: String,
    publicId: String, // Cloudinary
    uploadDate: {
      type: Date,
      default: Date.now
    },
    size: Number
  }],
  
  // ===================================================================
  // NOTES ET JOURNAL
  // ===================================================================
  notes: [{
    content: {
      type: String,
      required: true,
      maxlength: [1000, 'Une note ne peut pas dépasser 1000 caractères']
    },
    date: {
      type: Date,
      default: Date.now
    },
    type: {
      type: String,
      enum: ['general', 'meeting', 'decision', 'issue', 'opportunity', 'milestone'],
      default: 'general'
    },
    isPrivate: {
      type: Boolean,
      default: false
    }
  }],
  
  // ===================================================================
  // MÉTADONNÉES
  // ===================================================================
  tags: [{
    type: String,
    trim: true,
    maxlength: [30, 'Un tag ne peut pas dépasser 30 caractères']
  }]
  
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
// VIRTUELS (champs calculés)
// ===================================================================
investmentSchema.virtual('typeInfo').get(function() {
  return INVESTMENT_TYPES[this.type] || INVESTMENT_TYPES.business;
});

investmentSchema.virtual('currencyInfo').get(function() {
  return CURRENCIES[this.currency] || CURRENCIES[DEFAULTS.CURRENCY];
});

investmentSchema.virtual('totalRevenue').get(function() {
  return this.revenues.reduce((total, rev) => total + rev.amount, 0);
});

investmentSchema.virtual('totalExpenses').get(function() {
  return this.expenses.reduce((total, exp) => total + exp.amount, 0);
});

investmentSchema.virtual('netProfit').get(function() {
  return this.totalRevenue - this.totalExpenses;
});

investmentSchema.virtual('actualROI').get(function() {
  if (this.totalInvested === 0) return 0;
  return ((this.currentValue + this.netProfit - this.totalInvested) / this.totalInvested) * 100;
});

investmentSchema.virtual('actualROIAmount').get(function() {
  return this.currentValue + this.netProfit - this.totalInvested;
});

investmentSchema.virtual('monthlyAverageRevenue').get(function() {
  const monthsActive = this.ageInMonths;
  if (monthsActive === 0) return 0;
  return this.totalRevenue / monthsActive;
});

investmentSchema.virtual('monthlyAverageExpenses').get(function() {
  const monthsActive = this.ageInMonths;
  if (monthsActive === 0) return 0;
  return this.totalExpenses / monthsActive;
});

investmentSchema.virtual('ageInMonths').get(function() {
  const now = new Date();
  const start = new Date(this.startDate);
  const diffTime = Math.abs(now - start);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30.44)); // Mois moyen
});

investmentSchema.virtual('ageInDays').get(function() {
  const now = new Date();
  const start = new Date(this.startDate);
  const diffTime = Math.abs(now - start);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

investmentSchema.virtual('isProfitable').get(function() {
  return this.netProfit > 0;
});

investmentSchema.virtual('breakEvenPoint').get(function() {
  const monthlyNet = this.monthlyAverageRevenue - this.monthlyAverageExpenses;
  if (monthlyNet <= 0) return null;
  return Math.ceil(this.totalInvested / monthlyNet);
});

investmentSchema.virtual('riskScore').get(function() {
  const riskWeights = { low: 1, medium: 2, high: 3, critical: 4 };
  const totalRiskScore = this.risks.reduce((total, risk) => {
    const severityScore = riskWeights[risk.severity] || 2;
    const likelihoodScore = riskWeights[risk.likelihood] || 2;
    return total + (severityScore * likelihoodScore);
  }, 0);
  
  const maxPossibleScore = this.risks.length * 16; // 4 * 4
  if (maxPossibleScore === 0) return 0;
  return Math.round((totalRiskScore / maxPossibleScore) * 100);
});

investmentSchema.virtual('partnershipInfo').get(function() {
  const totalPartnerPercentage = this.partners.reduce((total, p) => total + p.percentage, 0);
  const ownerPercentage = Math.max(0, 100 - totalPartnerPercentage);
  
  return {
    ownerPercentage,
    totalPartners: this.partners.length,
    totalPartnerPercentage
  };
});

// ===================================================================
// INDEX POUR PERFORMANCE
// ===================================================================
investmentSchema.index({ user: 1, status: 1 });
investmentSchema.index({ user: 1, type: 1 });
investmentSchema.index({ user: 1, isActive: 1 });
investmentSchema.index({ startDate: -1 });
investmentSchema.index({ 'location.region': 1 });
investmentSchema.index({ category: 1 });
investmentSchema.index({ 'partners.user': 1 });
investmentSchema.index({ lastUpdateDate: -1 });

// Index géospatial pour localisation
investmentSchema.index({ 'location.coordinates': '2dsphere' });

// ===================================================================
// MIDDLEWARE PRE-SAVE
// ===================================================================

// Calcul automatique totalInvested
investmentSchema.pre('save', function(next) {
  this.totalInvested = this.initialInvestment + this.additionalInvestments;
  this.lastUpdateDate = new Date();
  next();
});

// Validation pourcentages partenaires
investmentSchema.pre('save', function(next) {
  const totalPartnerPercentage = this.partners.reduce((total, p) => total + p.percentage, 0);
  
  if (totalPartnerPercentage > 100) {
    return next(new Error('Le total des pourcentages des partenaires ne peut pas dépasser 100%'));
  }
  
  next();
});

// Mise à jour statut automatique
investmentSchema.pre('save', function(next) {
  if (this.netProfit > 0 && this.status !== 'completed') {
    this.status = 'profitable';
  } else if (this.netProfit === 0 && this.totalRevenue > 0) {
    this.status = 'break_even';
  } else if (this.netProfit < 0 && this.totalRevenue > 0) {
    this.status = 'loss';
  }
  
  next();
});

// ===================================================================
// MÉTHODES D'INSTANCE
// ===================================================================

// Ajouter revenu
investmentSchema.methods.addRevenue = function(revenueData) {
  const revenue = {
    amount: revenueData.amount,
    date: revenueData.date || new Date(),
    description: revenueData.description,
    source: revenueData.source || 'sales',
    isRecurring: revenueData.isRecurring || false,
    recurringFrequency: revenueData.recurringFrequency,
    transactionRef: revenueData.transactionRef
  };
  
  this.revenues.push(revenue);
  return this.save();
};

// Ajouter dépense
investmentSchema.methods.addExpense = function(expenseData) {
  const expense = {
    amount: expenseData.amount,
    date: expenseData.date || new Date(),
    description: expenseData.description,
    category: expenseData.category || 'other',
    isRecurring: expenseData.isRecurring || false,
    recurringFrequency: expenseData.recurringFrequency,
    transactionRef: expenseData.transactionRef
  };
  
  this.expenses.push(expense);
  return this.save();
};

// Ajouter évaluation
investmentSchema.methods.addValuation = function(valuationData) {
  const valuation = {
    value: valuationData.value,
    date: valuationData.date || new Date(),
    method: valuationData.method || 'estimated',
    notes: valuationData.notes,
    valuedBy: valuationData.valuedBy || 'owner'
  };
  
  this.valuations.push(valuation);
  this.currentValue = valuationData.value;
  
  return this.save();
};

// Ajouter partenaire
investmentSchema.methods.addPartner = function(partnerData) {
  // Vérifier que le total ne dépasse pas 100%
  const currentTotal = this.partners.reduce((total, p) => total + p.percentage, 0);
  
  if (currentTotal + partnerData.percentage > 100) {
    throw new Error('Le total des pourcentages ne peut pas dépasser 100%');
  }
  
  const partner = {
    user: partnerData.userId,
    name: partnerData.name,
    percentage: partnerData.percentage,
    investmentAmount: partnerData.investmentAmount,
    role: partnerData.role || 'co_investor',
    contactInfo: partnerData.contactInfo || {}
  };
  
  this.partners.push(partner);
  this.additionalInvestments += partnerData.investmentAmount;
  
  return this.save();
};

// Ajouter note
investmentSchema.methods.addNote = function(noteData) {
  const note = {
    content: noteData.content,
    date: noteData.date || new Date(),
    type: noteData.type || 'general',
    isPrivate: noteData.isPrivate || false
  };
  
  this.notes.push(note);
  return this.save();
};

// Ajouter document
investmentSchema.methods.addDocument = function(documentData) {
  const document = {
    name: documentData.name,
    type: documentData.type || 'other',
    url: documentData.url,
    publicId: documentData.publicId,
    size: documentData.size
  };
  
  this.documents.push(document);
  return this.save();
};

// Calculer projection future
investmentSchema.methods.calculateProjection = function(months) {
  const monthlyNet = this.monthlyAverageRevenue - this.monthlyAverageExpenses;
  const projectedValue = this.currentValue + (monthlyNet * months);
  const projectedROI = ((projectedValue - this.totalInvested) / this.totalInvested) * 100;
  
  return {
    months,
    projectedValue,
    projectedROI,
    projectedMonthlyNet: monthlyNet,
    confidence: this.ageInMonths >= 6 ? 'high' : this.ageInMonths >= 3 ? 'medium' : 'low'
  };
};

// Archiver investissement
investmentSchema.methods.archive = function(reason = 'completed') {
  this.isActive = false;
  this.status = reason === 'failed' ? 'failed' : 'completed';
  this.actualEndDate = new Date();
  
  return this.save();
};

// ===================================================================
// MÉTHODES STATIQUES
// ===================================================================

// Investissements d'un utilisateur
investmentSchema.statics.findByUser = function(userId, filters = {}) {
  const query = { user: userId };
  
  if (filters.status) query.status = filters.status;
  if (filters.type) query.type = filters.type;
  if (filters.isActive !== undefined) query.isActive = filters.isActive;
  
  return this.find(query)
    .populate('partners.user', 'firstName lastName')
    .sort({ lastUpdateDate: -1 });
};

// Portfolio overview utilisateur
investmentSchema.statics.getPortfolioOverview = function(userId) {
  return this.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(userId), isActive: true } },
    {
      $group: {
        _id: null,
        totalInvestments: { $sum: 1 },
        totalInvested: { $sum: '$totalInvested' },
        totalCurrentValue: { $sum: '$currentValue' },
        totalRevenue: { $sum: { $sum: '$revenues.amount' } },
        totalExpenses: { $sum: { $sum: '$expenses.amount' } },
        avgROI: { $avg: '$actualROI' },
        profitableCount: {
          $sum: {
            $cond: [
              { $gt: [{ $subtract: [{ $sum: '$revenues.amount' }, { $sum: '$expenses.amount' }] }, 0] },
              1,
              0
            ]
          }
        }
      }
    }
  ]);
};

// Analytics par type
investmentSchema.statics.getAnalyticsByType = function(userId) {
  return this.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        totalInvested: { $sum: '$totalInvested' },
        totalRevenue: { $sum: { $sum: '$revenues.amount' } },
        avgROI: { $avg: '$actualROI' }
      }
    },
    { $sort: { totalInvested: -1 } }
  ]);
};

// Investissements nécessitant attention
investmentSchema.statics.findNeedingAttention = function(userId) {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  
  return this.find({
    user: userId,
    isActive: true,
    $or: [
      { actualROI: { $lt: -10 } }, // ROI négatif > 10%
      { 
        lastUpdateDate: { $lt: sixMonthsAgo },
        status: 'active'
      }, // Pas mis à jour depuis 6 mois
      { riskScore: { $gt: 70 } } // Score de risque élevé
    ]
  });
};

// Recherche géographique
investmentSchema.statics.findByRegion = function(region, filters = {}) {
  const query = { 'location.region': region, isActive: true };
  
  if (filters.type) query.type = filters.type;
  if (filters.minInvestment) query.totalInvested = { $gte: filters.minInvestment };
  
  return this.find(query).populate('user', 'firstName lastName');
};

// Top performers
investmentSchema.statics.getTopPerformers = function(userId, limit = 5) {
  return this.find({
    user: userId,
    isActive: true,
    actualROI: { $gt: 0 }
  })
  .sort({ actualROI: -1 })
  .limit(limit)
  .select('name type actualROI totalInvested currentValue');
};

// ===================================================================
// EXPORT DU MODÈLE
// ===================================================================
const Investment = mongoose.model('Investment', investmentSchema);

module.exports = Investment;