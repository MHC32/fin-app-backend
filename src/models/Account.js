// src/models/Account.js - Modèle comptes bancaires FinApp Haiti
const mongoose = require('mongoose');

// Import des constantes
const { 
  HAITI_BANKS, 
  CURRENCIES, 
  ACCOUNT_TYPES, 
  DEFAULTS,
  VALIDATION_PATTERNS,
  LIMITS 
} = require('../utils/constants');

/**
 * Schéma compte bancaire adapté au contexte haïtien
 */
const accountSchema = new mongoose.Schema({
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
  // INFORMATIONS COMPTE
  // ===================================================================
  name: {
    type: String,
    required: [true, 'Le nom du compte est requis'],
    trim: true,
    minlength: [2, 'Le nom doit contenir au moins 2 caractères'],
    maxlength: [100, 'Le nom ne peut pas dépasser 100 caractères']
  },
  
  type: {
    type: String,
    required: [true, 'Le type de compte est requis'],
    enum: {
      values: Object.keys(ACCOUNT_TYPES),
      message: 'Type de compte non valide'
    },
    default: DEFAULTS.ACCOUNT_TYPE
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
  
  description: {
    type: String,
    trim: true,
    maxlength: [255, 'La description ne peut pas dépasser 255 caractères']
  },
  
  // ===================================================================
  // BANQUE HAÏTIENNE
  // ===================================================================
  bankName: {
    type: String,
    enum: {
      values: Object.keys(HAITI_BANKS),
      message: 'Banque haïtienne non reconnue'
    },
    default: 'cash'
  },
  
  accountNumber: {
    type: String,
    sparse: true, // Permet null pour comptes cash
    validate: {
      validator: function(v) {
        // Optionnel pour cash et other
        if (['cash', 'other'].includes(this.bankName)) return true;
        if (!v) return false;
        return VALIDATION_PATTERNS.ACCOUNT_NUMBER.test(v);
      },
      message: 'Numéro de compte invalide (6-16 chiffres)'
    }
  },
  
  // ===================================================================
  // SOLDES ET FINANCES
  // ===================================================================
  initialBalance: {
    type: Number,
    default: 0,
    validate: {
      validator: function(v) {
        return v >= 0;
      },
      message: 'Le solde initial doit être positif'
    }
  },
  
  currentBalance: {
    type: Number,
    default: function() {
      return this.initialBalance || 0;
    },
    required: true
  },
  
  availableBalance: {
    type: Number,
    default: function() {
      return this.currentBalance || 0;
    }
  },
  
  creditLimit: {
    type: Number,
    default: 0,
    min: [0, 'La limite de crédit doit être positive']
  },
  
  minimumBalance: {
    type: Number,
    default: 0,
    validate: {
      validator: function(v) {
        return v >= 0;
      },
      message: 'Le solde minimum doit être positif'
    }
  },
  
  // ===================================================================
  // CONFIGURATION COMPTE
  // ===================================================================
  isDefault: {
    type: Boolean,
    default: false
  },
  
  isActive: {
    type: Boolean,
    default: true
  },
  
  includeInTotal: {
    type: Boolean,
    default: true
  },
  
  allowNegativeBalance: {
    type: Boolean,
    default: false
  },
  
  // ===================================================================
  // PERSONNALISATION UI
  // ===================================================================
  color: {
    type: String,
    default: function() {
      return HAITI_BANKS[this.bankName]?.color || '#667eea';
    }
  },
  
  icon: {
    type: String,
    default: function() {
      return ACCOUNT_TYPES[this.type]?.icon || 'account_balance';
    }
  },
  
  // ===================================================================
  // SÉCURITÉ ET CONFIDENTIALITÉ
  // ===================================================================
  isHidden: {
    type: Boolean,
    default: false
  },
  
  requirePinForView: {
    type: Boolean,
    default: false
  },
  
  // ===================================================================
  // SYNCHRONISATION BANCAIRE (futur)
  // ===================================================================
  syncEnabled: {
    type: Boolean,
    default: false
  },
  
  lastSyncDate: {
    type: Date
  },
  
  syncError: {
    type: String
  },
  
  // ===================================================================
  // MÉTADONNÉES
  // ===================================================================
  notes: {
    type: String,
    maxlength: [500, 'Les notes ne peuvent pas dépasser 500 caractères'],
    trim: true
  },
  
  tags: [{
    type: String,
    trim: true,
    maxlength: [30, 'Un tag ne peut pas dépasser 30 caractères']
  }],
  
  // ===================================================================
  // HISTORIQUE SOLDES
  // ===================================================================
  balanceHistory: [{
    date: {
      type: Date,
      default: Date.now
    },
    balance: {
      type: Number,
      required: true
    },
    change: {
      type: Number,
      required: true
    },
    reason: {
      type: String,
      enum: ['transaction', 'adjustment', 'sync', 'correction'],
      default: 'transaction'
    },
    description: String
  }],
  
  // ===================================================================
  // ARCHIVAGE
  // ===================================================================
  isArchived: {
    type: Boolean,
    default: false
  },
  
  archivedAt: {
    type: Date
  },
  
  archiveReason: {
    type: String,
    enum: ['closed', 'consolidated', 'inactive', 'user_request']
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
accountSchema.virtual('bankInfo').get(function() {
  return HAITI_BANKS[this.bankName] || HAITI_BANKS.other;
});

accountSchema.virtual('typeInfo').get(function() {
  return ACCOUNT_TYPES[this.type] || ACCOUNT_TYPES.checking;
});

accountSchema.virtual('currencyInfo').get(function() {
  return CURRENCIES[this.currency] || CURRENCIES[DEFAULTS.CURRENCY];
});

accountSchema.virtual('totalBalance').get(function() {
  return this.currentBalance + this.creditLimit;
});

accountSchema.virtual('usedCredit').get(function() {
  if (this.currentBalance >= 0) return 0;
  return Math.abs(this.currentBalance);
});

accountSchema.virtual('balanceStatus').get(function() {
  if (this.currentBalance < this.minimumBalance) return 'critical';
  if (this.currentBalance < this.minimumBalance * 2) return 'low';
  return 'healthy';
});

accountSchema.virtual('displayName').get(function() {
  const bankInfo = this.bankInfo;
  return `${this.name} (${bankInfo.name})`;
});

// ===================================================================
// INDEX POUR PERFORMANCE
// ===================================================================
accountSchema.index({ user: 1, isActive: 1 });
accountSchema.index({ user: 1, type: 1 });
accountSchema.index({ user: 1, currency: 1 });
accountSchema.index({ user: 1, isDefault: 1 });
accountSchema.index({ bankName: 1 });
accountSchema.index({ createdAt: -1 });

// Index composé pour requêtes complexes
accountSchema.index({ user: 1, isActive: 1, includeInTotal: 1 });

// ===================================================================
// MIDDLEWARE PRE-SAVE
// ===================================================================

// Validation soldes cohérents
accountSchema.pre('save', function(next) {
  // Availabe balance ne peut pas être supérieur au current balance
  if (this.availableBalance > this.currentBalance) {
    this.availableBalance = this.currentBalance;
  }
  
  // Si balance négative non autorisée
  if (!this.allowNegativeBalance && this.currentBalance < 0) {
    return next(new Error('Solde négatif non autorisé pour ce compte'));
  }
  
  next();
});

// Gérer compte par défaut unique
accountSchema.pre('save', async function(next) {
  if (this.isDefault && this.isModified('isDefault')) {
    // Retirer le statut default des autres comptes du même utilisateur
    await this.constructor.updateMany(
      { user: this.user, _id: { $ne: this._id } },
      { isDefault: false }
    );
  }
  next();
});

// Historique des soldes
accountSchema.pre('save', function(next) {
  if (this.isModified('currentBalance') && !this.isNew) {
    const change = this.currentBalance - (this.constructor.findById(this._id)?.currentBalance || 0);
    
    this.balanceHistory.push({
      balance: this.currentBalance,
      change: change,
      reason: 'adjustment',
      description: 'Mise à jour manuelle du solde'
    });
    
    // Garder seulement les 50 dernières entrées
    if (this.balanceHistory.length > 50) {
      this.balanceHistory = this.balanceHistory.slice(-50);
    }
  }
  next();
});

// ===================================================================
// MÉTHODES D'INSTANCE
// ===================================================================

// Mettre à jour le solde
accountSchema.methods.updateBalance = function(amount, description = 'Transaction') {
  const previousBalance = this.currentBalance;
  this.currentBalance += amount;
  this.availableBalance = Math.min(this.availableBalance + amount, this.currentBalance);
  
  // Ajouter à l'historique
  this.balanceHistory.push({
    balance: this.currentBalance,
    change: amount,
    reason: 'transaction',
    description
  });
  
  return this.save();
};

// Vérifier si transaction possible
accountSchema.methods.canProcessTransaction = function(amount) {
  if (amount >= 0) return true; // Dépôt toujours possible
  
  const newBalance = this.currentBalance + amount;
  
  // Vérifier limite négative
  if (!this.allowNegativeBalance && newBalance < 0) return false;
  
  // Vérifier limite de crédit
  if (newBalance < -this.creditLimit) return false;
  
  return true;
};

// Définir comme compte par défaut
accountSchema.methods.setAsDefault = async function() {
  // Retirer default des autres comptes
  await this.constructor.updateMany(
    { user: this.user, _id: { $ne: this._id } },
    { isDefault: false }
  );
  
  this.isDefault = true;
  return this.save();
};

// Archiver le compte
accountSchema.methods.archive = function(reason = 'user_request') {
  this.isArchived = true;
  this.isActive = false;
  this.archivedAt = new Date();
  this.archiveReason = reason;
  
  return this.save();
};

// Désarchiver le compte
accountSchema.methods.unarchive = function() {
  this.isArchived = false;
  this.isActive = true;
  this.archivedAt = undefined;
  this.archiveReason = undefined;
  
  return this.save();
};

// Obtenir historique récent
accountSchema.methods.getRecentHistory = function(days = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  return this.balanceHistory.filter(entry => entry.date >= cutoffDate);
};

// ===================================================================
// MÉTHODES STATIQUES
// ===================================================================

// Trouver comptes actifs d'un utilisateur
accountSchema.statics.findActiveByUser = function(userId) {
  return this.find({
    user: userId,
    isActive: true,
    isArchived: false
  }).sort({ isDefault: -1, createdAt: -1 });
};

// Trouver compte par défaut d'un utilisateur
accountSchema.statics.findDefaultByUser = function(userId) {
  return this.findOne({
    user: userId,
    isDefault: true,
    isActive: true
  });
};

// Calculer total par devise pour un utilisateur
accountSchema.statics.getTotalsByUser = function(userId) {
  return this.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        isActive: true,
        includeInTotal: true
      }
    },
    {
      $group: {
        _id: '$currency',
        totalBalance: { $sum: '$currentBalance' },
        accountCount: { $sum: 1 }
      }
    }
  ]);
};

// Statistiques par banque
accountSchema.statics.getBankStats = function() {
  return this.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: '$bankName', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
};

// Comptes avec solde critique
accountSchema.statics.findCriticalBalances = function(userId) {
  return this.find({
    user: userId,
    isActive: true,
    $expr: { $lt: ['$currentBalance', '$minimumBalance'] }
  });
};

// Recherche comptes par nom ou numéro
accountSchema.statics.searchByUser = function(userId, searchTerm) {
  const regex = new RegExp(searchTerm, 'i');
  
  return this.find({
    user: userId,
    isActive: true,
    $or: [
      { name: regex },
      { description: regex },
      { accountNumber: regex },
      { tags: { $in: [regex] } }
    ]
  });
};

// ===================================================================
// EXPORT DU MODÈLE
// ===================================================================
const Account = mongoose.model('Account', accountSchema);

module.exports = Account;