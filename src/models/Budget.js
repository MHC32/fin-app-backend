// src/models/Budget.js - Modèle budgets FinApp Haiti
const mongoose = require('mongoose');

// Import des constantes
const { 
  TRANSACTION_CATEGORIES,
  BUDGET_PERIODS,
  BUDGET_TEMPLATES,
  CURRENCIES,
  DEFAULTS,
  LIMITS
} = require('../utils/constants');

/**
 * Schéma budget adapté au contexte haïtien
 */
const budgetSchema = new mongoose.Schema({
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
  // INFORMATIONS BUDGET
  // ===================================================================
  name: {
    type: String,
    required: [true, 'Le nom du budget est requis'],
    trim: true,
    minlength: [2, 'Le nom doit contenir au moins 2 caractères'],
    maxlength: [100, 'Le nom ne peut pas dépasser 100 caractères']
  },
  
  description: {
    type: String,
    trim: true,
    maxlength: [255, 'La description ne peut pas dépasser 255 caractères']
  },
  
  currency: {
    type: String,
    required: [true, 'La devise est requise'],
    enum: {
      values: Object.keys(CURRENCIES),
      message: 'Devise non supportée'
    },
    default: DEFAULTS.CURRENCY
  },
  
  // ===================================================================
  // PÉRIODE ET TIMING
  // ===================================================================
  period: {
    type: String,
    required: [true, 'La période est requise'],
    enum: {
      values: Object.keys(BUDGET_PERIODS),
      message: 'Période de budget non valide'
    },
    default: DEFAULTS.BUDGET_PERIOD
  },
  
  startDate: {
    type: Date,
    required: [true, 'La date de début est requise'],
    index: true
  },
  
  endDate: {
    type: Date,
    required: [true, 'La date de fin est requise'],
    validate: {
      validator: function(v) {
        return v > this.startDate;
      },
      message: 'La date de fin doit être postérieure à la date de début'
    }
  },
  
  // ===================================================================
  // REVENUS ET OBJECTIFS
  // ===================================================================
  expectedIncome: {
    type: Number,
    required: [true, 'Les revenus attendus sont requis'],
    min: [LIMITS.BUDGET.MIN_AMOUNT, `Les revenus doivent être supérieurs à ${LIMITS.BUDGET.MIN_AMOUNT}`],
    validate: {
      validator: function(v) {
        const maxAmount = this.currency === 'HTG' ? LIMITS.BUDGET.MAX_AMOUNT_HTG : LIMITS.BUDGET.MAX_AMOUNT_USD;
        return v <= maxAmount;
      },
      message: 'Revenus attendus trop élevés'
    }
  },
  
  totalBudgeted: {
    type: Number,
    default: 0,
    min: [0, 'Le total budgété doit être positif']
  },
  
  // ===================================================================
  // CATÉGORIES BUDGÉTAIRES HAÏTIENNES
  // ===================================================================
  categories: [{
    category: {
      type: String,
      required: [true, 'La catégorie est requise'],
      enum: {
        values: Object.keys(TRANSACTION_CATEGORIES),
        message: 'Catégorie non valide'
      }
    },
    budgetedAmount: {
      type: Number,
      required: [true, 'Le montant budgété est requis'],
      min: [0, 'Le montant budgété doit être positif']
    },
    spentAmount: {
      type: Number,
      default: 0,
      min: [0, 'Le montant dépensé doit être positif']
    },
    priority: {
      type: String,
      enum: ['high', 'medium', 'low'],
      default: 'medium'
    },
    isFlexible: {
      type: Boolean,
      default: true
    },
    notes: {
      type: String,
      maxlength: [200, 'Les notes ne peuvent pas dépasser 200 caractères']
    }
  }],
  
  // ===================================================================
  // TEMPLATE ET PRÉDÉFINIS
  // ===================================================================
  isFromTemplate: {
    type: Boolean,
    default: false
  },
  
  templateUsed: {
    type: String,
    enum: [...Object.keys(BUDGET_TEMPLATES), 'custom'],
    default: 'custom'
  },
  
  // ===================================================================
  // ALERTES ET NOTIFICATIONS
  // ===================================================================
  alertSettings: {
    enableAlerts: {
      type: Boolean,
      default: true
    },
    warningThreshold: {
      type: Number,
      default: 80,
      min: [50, 'Seuil d\'alerte minimum 50%'],
      max: [95, 'Seuil d\'alerte maximum 95%']
    },
    criticalThreshold: {
      type: Number,
      default: 95,
      min: [80, 'Seuil critique minimum 80%'],
      max: [100, 'Seuil critique maximum 100%']
    },
    emailNotifications: {
      type: Boolean,
      default: true
    },
    pushNotifications: {
      type: Boolean,
      default: true
    }
  },
  
  // ===================================================================
  // OBJECTIFS D'ÉPARGNE
  // ===================================================================
  savingsGoal: {
    targetAmount: {
      type: Number,
      min: [0, 'L\'objectif d\'épargne doit être positif']
    },
    currentAmount: {
      type: Number,
      default: 0,
      min: [0, 'Le montant épargné doit être positif']
    },
    priority: {
      type: String,
      enum: ['emergency', 'goal', 'investment', 'leisure'],
      default: 'goal'
    },
    deadline: Date,
    description: String
  },
  
  // ===================================================================
  // STATUT ET PROGRESSION
  // ===================================================================
  status: {
    type: String,
    enum: ['draft', 'active', 'completed', 'exceeded', 'paused'],
    default: 'draft'
  },
  
  isActive: {
    type: Boolean,
    default: true
  },
  
  isArchived: {
    type: Boolean,
    default: false
  },
  
  // ===================================================================
  // ANALYTICS ET HISTORIQUE
  // ===================================================================
  monthlySnapshots: [{
    date: {
      type: Date,
      required: true
    },
    totalSpent: {
      type: Number,
      required: true
    },
    categoriesSnapshot: [{
      category: String,
      budgeted: Number,
      spent: Number,
      remaining: Number,
      percentage: Number
    }],
    notes: String
  }],
  
  achievements: [{
    type: {
      type: String,
      enum: ['under_budget', 'savings_goal_met', 'category_perfect', 'streak'],
      required: true
    },
    description: String,
    achievedDate: {
      type: Date,
      default: Date.now
    },
    value: Number // Pour les streaks par exemple
  }],
  
  // ===================================================================
  // COLLABORATION (futur)
  // ===================================================================
  sharedWith: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String,
      enum: ['view', 'edit', 'admin'],
      default: 'view'
    },
    addedDate: {
      type: Date,
      default: Date.now
    }
  }],
  
  // ===================================================================
  // MÉTADONNÉES
  // ===================================================================
  tags: [{
    type: String,
    trim: true,
    maxlength: [30, 'Un tag ne peut pas dépasser 30 caractères']
  }],
  
  lastCalculated: {
    type: Date,
    default: Date.now
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
// VIRTUELS (champs calculés)
// ===================================================================
budgetSchema.virtual('periodInfo').get(function() {
  return BUDGET_PERIODS[this.period] || BUDGET_PERIODS.monthly;
});

budgetSchema.virtual('currencyInfo').get(function() {
  return CURRENCIES[this.currency] || CURRENCIES[DEFAULTS.CURRENCY];
});

budgetSchema.virtual('totalSpent').get(function() {
  return this.categories.reduce((total, cat) => total + cat.spentAmount, 0);
});

budgetSchema.virtual('totalRemaining').get(function() {
  return this.totalBudgeted - this.totalSpent;
});

budgetSchema.virtual('spentPercentage').get(function() {
  if (this.totalBudgeted === 0) return 0;
  return Math.round((this.totalSpent / this.totalBudgeted) * 100);
});

budgetSchema.virtual('remainingDays').get(function() {
  const now = new Date();
  const endDate = new Date(this.endDate);
  const diffTime = endDate - now;
  return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
});

budgetSchema.virtual('daysElapsed').get(function() {
  const now = new Date();
  const startDate = new Date(this.startDate);
  const diffTime = now - startDate;
  return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
});

budgetSchema.virtual('isOverBudget').get(function() {
  return this.totalSpent > this.totalBudgeted;
});

budgetSchema.virtual('savingsProgress').get(function() {
  if (!this.savingsGoal.targetAmount) return 0;
  return Math.min(100, Math.round((this.savingsGoal.currentAmount / this.savingsGoal.targetAmount) * 100));
});

budgetSchema.virtual('healthScore').get(function() {
  let score = 100;
  
  // Pénalité pour dépassement
  if (this.isOverBudget) {
    score -= Math.min(50, (this.spentPercentage - 100) * 2);
  }
  
  // Bonus pour épargne
  if (this.savingsProgress > 0) {
    score += Math.min(20, this.savingsProgress / 5);
  }
  
  return Math.max(0, Math.round(score));
});

// ===================================================================
// INDEX POUR PERFORMANCE
// ===================================================================
budgetSchema.index({ user: 1, isActive: 1 });
budgetSchema.index({ user: 1, period: 1 });
budgetSchema.index({ user: 1, startDate: -1 });
budgetSchema.index({ user: 1, status: 1 });
budgetSchema.index({ 'categories.category': 1 });
budgetSchema.index({ templateUsed: 1 });
budgetSchema.index({ endDate: 1, isActive: 1 });

// ===================================================================
// MIDDLEWARE PRE-SAVE
// ===================================================================

// Calculer totalBudgeted automatiquement
budgetSchema.pre('save', function(next) {
  this.totalBudgeted = this.categories.reduce((total, cat) => total + cat.budgetedAmount, 0);
  this.lastCalculated = new Date();
  next();
});

// Calculer endDate selon period si pas spécifiée
budgetSchema.pre('save', function(next) {
  if (this.isNew && !this.endDate) {
    const periodInfo = BUDGET_PERIODS[this.period];
    if (periodInfo) {
      const endDate = new Date(this.startDate);
      endDate.setDate(endDate.getDate() + periodInfo.days);
      this.endDate = endDate;
    }
  }
  next();
});

// Mettre à jour le statut automatiquement
budgetSchema.pre('save', function(next) {
  const now = new Date();
  
  if (now > this.endDate) {
    this.status = this.isOverBudget ? 'exceeded' : 'completed';
    this.isActive = false;
  } else if (this.isOverBudget && this.status === 'active') {
    this.status = 'exceeded';
  }
  
  next();
});

// ===================================================================
// MÉTHODES D'INSTANCE
// ===================================================================

// Ajouter dépense à une catégorie
budgetSchema.methods.addExpense = function(category, amount) {
  const categoryBudget = this.categories.find(cat => cat.category === category);
  
  if (categoryBudget) {
    categoryBudget.spentAmount += amount;
    
    // Vérifier les seuils d'alerte
    const percentage = (categoryBudget.spentAmount / categoryBudget.budgetedAmount) * 100;
    
    if (percentage >= this.alertSettings.criticalThreshold) {
      // Déclencher alerte critique
      return { alert: 'critical', percentage };
    } else if (percentage >= this.alertSettings.warningThreshold) {
      // Déclencher alerte warning
      return { alert: 'warning', percentage };
    }
  }
  
  return this.save();
};

// Ajuster budget d'une catégorie
budgetSchema.methods.adjustCategoryBudget = function(category, newAmount, reason = '') {
  const categoryBudget = this.categories.find(cat => cat.category === category);
  
  if (categoryBudget) {
    const oldAmount = categoryBudget.budgetedAmount;
    categoryBudget.budgetedAmount = newAmount;
    
    // Ajouter note si fournie
    if (reason) {
      categoryBudget.notes = reason;
    }
    
    return this.save();
  }
  
  throw new Error('Catégorie non trouvée dans ce budget');
};

// Créer snapshot mensuel
budgetSchema.methods.createMonthlySnapshot = function() {
  const snapshot = {
    date: new Date(),
    totalSpent: this.totalSpent,
    categoriesSnapshot: this.categories.map(cat => ({
      category: cat.category,
      budgeted: cat.budgetedAmount,
      spent: cat.spentAmount,
      remaining: cat.budgetedAmount - cat.spentAmount,
      percentage: Math.round((cat.spentAmount / cat.budgetedAmount) * 100)
    }))
  };
  
  this.monthlySnapshots.push(snapshot);
  
  // Garder seulement les 12 derniers snapshots
  if (this.monthlySnapshots.length > 12) {
    this.monthlySnapshots = this.monthlySnapshots.slice(-12);
  }
  
  return this.save();
};

// Ajouter achievement
budgetSchema.methods.addAchievement = function(type, description, value = null) {
  const achievement = {
    type,
    description,
    achievedDate: new Date(),
    value
  };
  
  this.achievements.push(achievement);
  return this.save();
};

// Vérifier objectifs d'épargne
budgetSchema.methods.checkSavingsGoals = function() {
  if (this.savingsGoal.targetAmount && this.savingsGoal.currentAmount >= this.savingsGoal.targetAmount) {
    this.addAchievement('savings_goal_met', `Objectif d'épargne de ${this.savingsGoal.targetAmount} atteint!`);
    return true;
  }
  return false;
};

// Archiver budget
budgetSchema.methods.archive = function() {
  this.isArchived = true;
  this.isActive = false;
  return this.save();
};

// ===================================================================
// MÉTHODES STATIQUES
// ===================================================================

// Budgets actifs d'un utilisateur
budgetSchema.statics.findActiveByUser = function(userId) {
  return this.find({
    user: userId,
    isActive: true,
    isArchived: false
  }).sort({ startDate: -1 });
};

// Créer budget depuis template
budgetSchema.statics.createFromTemplate = function(userId, templateName, customData = {}) {
  const template = BUDGET_TEMPLATES[templateName];
  if (!template) {
    throw new Error('Template de budget non trouvé');
  }
  
  const categories = Object.entries(template.categories).map(([category, amount]) => ({
    category,
    budgetedAmount: amount,
    spentAmount: 0,
    priority: TRANSACTION_CATEGORIES[category]?.popular ? 'high' : 'medium'
  }));
  
  const budgetData = {
    user: userId,
    name: customData.name || `Budget ${template.name}`,
    description: template.description,
    expectedIncome: template.targetIncome,
    categories,
    isFromTemplate: true,
    templateUsed: templateName,
    startDate: customData.startDate || new Date(),
    period: customData.period || 'monthly',
    currency: customData.currency || DEFAULTS.CURRENCY,
    ...customData
  };
  
  return this.create(budgetData);
};

// Analytics par période
budgetSchema.statics.getAnalyticsByUser = function(userId, startDate, endDate) {
  const matchStage = {
    user: new mongoose.Types.ObjectId(userId),
    isActive: true
  };
  
  if (startDate || endDate) {
    matchStage.startDate = {};
    if (startDate) matchStage.startDate.$gte = startDate;
    if (endDate) matchStage.startDate.$lte = endDate;
  }
  
  return this.aggregate([
    { $match: matchStage },
    { $unwind: '$categories' },
    {
      $group: {
        _id: '$categories.category',
        totalBudgeted: { $sum: '$categories.budgetedAmount' },
        totalSpent: { $sum: '$categories.spentAmount' },
        avgBudgeted: { $avg: '$categories.budgetedAmount' },
        count: { $sum: 1 }
      }
    },
    { $sort: { totalBudgeted: -1 } }
  ]);
};

// Budgets nécessitant attention
budgetSchema.statics.findNeedingAttention = function(userId) {
  const now = new Date();
  
  return this.find({
    user: userId,
    isActive: true,
    $or: [
      { 'categories.spentAmount': { $gt: { $multiply: ['$categories.budgetedAmount', 0.9] } } },
      { endDate: { $lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) } } // 7 jours
    ]
  });
};

// Statistiques globales utilisateur
budgetSchema.statics.getUserStats = function(userId) {
  return this.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: null,
        totalBudgets: { $sum: 1 },
        activeBudgets: {
          $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
        },
        totalBudgeted: { $sum: '$totalBudgeted' },
        totalSpent: { $sum: '$totalSpent' },
        avgHealthScore: { $avg: '$healthScore' }
      }
    }
  ]);
};

// ===================================================================
// EXPORT DU MODÈLE
// ===================================================================
const Budget = mongoose.model('Budget', budgetSchema);

module.exports = Budget;