// src/models/Transaction.js - Modèle transactions FinApp Haiti
const mongoose = require('mongoose');

// Import des constantes
const { 
  TRANSACTION_CATEGORIES, 
  TRANSACTION_TYPES, 
  CURRENCIES, 
  QUICK_TRANSACTION_TEMPLATES,
  LIMITS,
  DEFAULTS 
} = require('../utils/constants');

/**
 * Schéma transaction adapté au contexte haïtien
 */
const transactionSchema = new mongoose.Schema({
  // ===================================================================
  // RELATIONS
  // ===================================================================
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'L\'utilisateur est requis'],
    index: true
  },
  
  account: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account',
    required: [true, 'Le compte est requis'],
    index: true
  },
  
  // ===================================================================
  // INFORMATIONS TRANSACTION
  // ===================================================================
  amount: {
    type: Number,
    required: [true, 'Le montant est requis'],
    validate: {
      validator: function(v) {
        return v > 0 && v >= LIMITS.TRANSACTION.MIN_AMOUNT;
      },
      message: `Le montant doit être supérieur à ${LIMITS.TRANSACTION.MIN_AMOUNT}`
    }
  },
  
  type: {
    type: String,
    required: [true, 'Le type de transaction est requis'],
    enum: {
      values: Object.values(TRANSACTION_TYPES),
      message: 'Type de transaction non valide'
    }
  },
  
  description: {
    type: String,
    required: [true, 'La description est requise'],
    trim: true,
    minlength: [2, 'La description doit contenir au moins 2 caractères'],
    maxlength: [LIMITS.TRANSACTION.MAX_DESCRIPTION_LENGTH, `La description ne peut pas dépasser ${LIMITS.TRANSACTION.MAX_DESCRIPTION_LENGTH} caractères`]
  },
  
  date: {
    type: Date,
    required: [true, 'La date est requise'],
    default: Date.now,
    index: true
  },
  
  // ===================================================================
  // CATÉGORISATION HAÏTIENNE
  // ===================================================================
  category: {
    type: String,
    required: [true, 'La catégorie est requise'],
    enum: {
      values: Object.keys(TRANSACTION_CATEGORIES),
      message: 'Catégorie non valide'
    }
  },
  
  subcategory: {
    type: String,
    trim: true,
    maxlength: [50, 'La sous-catégorie ne peut pas dépasser 50 caractères']
  },
  
  // ===================================================================
  // TRANSFERTS ENTRE COMPTES
  // ===================================================================
  toAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account',
    validate: {
      validator: function(v) {
        // Requis seulement pour les transferts
        if (this.type === TRANSACTION_TYPES.TRANSFER) {
          return !!v;
        }
        return true;
      },
      message: 'Le compte de destination est requis pour les transferts'
    }
  },
  
  transferId: {
    type: String,
    sparse: true, // Pour lier les 2 transactions d'un transfert
    index: true
  },
  
  exchangeRate: {
    type: Number,
    min: [0, 'Le taux de change doit être positif'],
    validate: {
      validator: function(v) {
        // Requis pour transferts entre devises différentes
        return true; // Validation custom dans le controller
      }
    }
  },
  
  // ===================================================================
  // RÉCURRENCE
  // ===================================================================
  isRecurring: {
    type: Boolean,
    default: false
  },
  
  recurringType: {
    type: String,
    enum: ['daily', 'weekly', 'biweekly', 'monthly', 'yearly'],
    validate: {
      validator: function(v) {
        // Requis si récurrent
        if (this.isRecurring) return !!v;
        return true;
      },
      message: 'Type de récurrence requis pour les transactions récurrentes'
    }
  },
  
  recurringEndDate: {
    type: Date,
    validate: {
      validator: function(v) {
        // Si récurrent, end date doit être après date de début
        if (this.isRecurring && v) {
          return v > this.date;
        }
        return true;
      },
      message: 'La date de fin doit être postérieure à la date de début'
    }
  },
  
  parentRecurring: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
    sparse: true
  },
  
  // ===================================================================
  // PIÈCES JOINTES ET REÇUS
  // ===================================================================
  receipt: {
    url: String,
    publicId: String, // Cloudinary public_id
    originalName: String,
    size: {
      type: Number,
      max: [LIMITS.UPLOAD.MAX_FILE_SIZE, 'Fichier trop volumineux']
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  },
  
  // ===================================================================
  // GÉOLOCALISATION (optionnel)
  // ===================================================================
  location: {
    name: String,
    address: String,
    latitude: {
      type: Number,
      min: [-90, 'Latitude invalide'],
      max: [90, 'Latitude invalide']
    },
    longitude: {
      type: Number,
      min: [-180, 'Longitude invalide'],
      max: [180, 'Longitude invalide']
    },
    accuracy: Number // En mètres
  },
  
  // ===================================================================
  // CONTEXTE HAÏTIEN SPÉCIAL
  // ===================================================================
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'moncash', 'natcash', 'bank_transfer', 'check', 'other'],
    default: 'cash'
  },
  
  merchant: {
    name: String,
    category: String, // Ex: 'supermarket', 'gas_station', 'restaurant'
    phone: String
  },
  
  // Spécial pour Haiti - référence sol/tontine
  solReference: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sol',
    sparse: true
  },
  
  // ===================================================================
  // MÉTADONNÉES ET TAGS
  // ===================================================================
  tags: [{
    type: String,
    trim: true,
    maxlength: [30, 'Un tag ne peut pas dépasser 30 caractères']
  }],
  
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Les notes ne peuvent pas dépasser 500 caractères']
  },
  
  // ===================================================================
  // STATUT ET VALIDATION
  // ===================================================================
  isConfirmed: {
    type: Boolean,
    default: true
  },
  
  isPending: {
    type: Boolean,
    default: false
  },
  
  isReconciled: {
    type: Boolean,
    default: false
  },
  
  reconciledDate: {
    type: Date
  },
  
  // ===================================================================
  // BUDGETS ET PLANNING
  // ===================================================================
  budgetCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Budget',
    sparse: true
  },
  
  exceedsBudget: {
    type: Boolean,
    default: false
  },
  
  // ===================================================================
  // TEMPLATE ET HISTORIQUE
  // ===================================================================
  isFromTemplate: {
    type: Boolean,
    default: false
  },
  
  templateUsed: {
    type: String,
    enum: [...Object.keys(QUICK_TRANSACTION_TEMPLATES), 'custom']
  },
  
  // ===================================================================
  // CORRECTIONS ET AJUSTEMENTS
  // ===================================================================
  originalTransaction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
    sparse: true
  },
  
  isCorrection: {
    type: Boolean,
    default: false
  },
  
  correctionReason: {
    type: String,
    enum: ['amount_error', 'category_error', 'duplicate', 'date_error', 'other']
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
transactionSchema.virtual('categoryInfo').get(function() {
  return TRANSACTION_CATEGORIES[this.category] || TRANSACTION_CATEGORIES.other;
});

transactionSchema.virtual('displayAmount').get(function() {
  const sign = this.type === TRANSACTION_TYPES.EXPENSE ? '-' : '+';
  const currency = CURRENCIES[DEFAULTS.CURRENCY];
  return `${sign}${this.amount.toLocaleString()} ${currency.symbol}`;
});

transactionSchema.virtual('isTransfer').get(function() {
  return this.type === TRANSACTION_TYPES.TRANSFER;
});

transactionSchema.virtual('hasReceipt').get(function() {
  return !!(this.receipt && this.receipt.url);
});

transactionSchema.virtual('hasLocation').get(function() {
  return !!(this.location && this.location.latitude && this.location.longitude);
});

transactionSchema.virtual('formattedDate').get(function() {
  return this.date.toLocaleDateString('fr-HT', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

transactionSchema.virtual('ageInDays').get(function() {
  const now = new Date();
  const diffTime = Math.abs(now - this.date);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// ===================================================================
// INDEX POUR PERFORMANCE
// ===================================================================
transactionSchema.index({ user: 1, date: -1 });
transactionSchema.index({ user: 1, account: 1, date: -1 });
transactionSchema.index({ user: 1, category: 1 });
transactionSchema.index({ user: 1, type: 1, date: -1 });
transactionSchema.index({ transferId: 1 });
transactionSchema.index({ solReference: 1 });
transactionSchema.index({ isRecurring: 1, recurringType: 1 });
transactionSchema.index({ createdAt: -1 });

// Index composé pour analytics
transactionSchema.index({ user: 1, category: 1, date: -1 });
transactionSchema.index({ user: 1, type: 1, category: 1 });

// Index géospatial pour location
transactionSchema.index({ 'location.latitude': 1, 'location.longitude': 1 });

// ===================================================================
// MIDDLEWARE PRE-SAVE
// ===================================================================

// Validation montant selon devise et type
transactionSchema.pre('save', function(next) {
  // Validation limites selon devise (à implémenter via Account)
  if (this.type === TRANSACTION_TYPES.EXPENSE) {
    this.amount = Math.abs(this.amount); // S'assurer que expense est positif
  }
  
  next();
});

// Auto-assignation sous-catégorie selon catégorie
transactionSchema.pre('save', function(next) {
  if (!this.subcategory && this.category) {
    const categoryInfo = TRANSACTION_CATEGORIES[this.category];
    if (categoryInfo && categoryInfo.subcategories) {
      // Prendre la première sous-catégorie par défaut
      this.subcategory = categoryInfo.subcategories[0];
    }
  }
  next();
});

// Génération transferId pour transferts
transactionSchema.pre('save', function(next) {
  if (this.type === TRANSACTION_TYPES.TRANSFER && !this.transferId) {
    const crypto = require('crypto');
    this.transferId = crypto.randomUUID();
  }
  next();
});

// ===================================================================
// MÉTHODES D'INSTANCE
// ===================================================================

// Créer transaction opposée pour transfert
transactionSchema.methods.createTransferCounterpart = async function(toAccountData) {
  const counterpart = new this.constructor({
    user: this.user,
    account: this.toAccount,
    amount: this.amount,
    type: TRANSACTION_TYPES.INCOME, // Opposé
    description: `Transfert depuis ${toAccountData.name}`,
    date: this.date,
    category: 'transfert',
    transferId: this.transferId,
    isConfirmed: this.isConfirmed
  });
  
  return counterpart.save();
};

// Ajouter reçu
transactionSchema.methods.addReceipt = function(receiptData) {
  this.receipt = {
    url: receiptData.url,
    publicId: receiptData.publicId,
    originalName: receiptData.originalName,
    size: receiptData.size,
    uploadedAt: new Date()
  };
  
  return this.save();
};

// Ajouter localisation
transactionSchema.methods.addLocation = function(locationData) {
  this.location = {
    name: locationData.name,
    address: locationData.address,
    latitude: locationData.latitude,
    longitude: locationData.longitude,
    accuracy: locationData.accuracy
  };
  
  return this.save();
};

// Confirmer transaction
transactionSchema.methods.confirm = function() {
  this.isConfirmed = true;
  this.isPending = false;
  return this.save();
};

// Créer correction
transactionSchema.methods.createCorrection = function(correctionData) {
  const correction = new this.constructor({
    ...correctionData,
    user: this.user,
    account: this.account,
    originalTransaction: this._id,
    isCorrection: true,
    correctionReason: correctionData.reason || 'other'
  });
  
  return correction.save();
};

// Réconcilier transaction
transactionSchema.methods.reconcile = function() {
  this.isReconciled = true;
  this.reconciledDate = new Date();
  return this.save();
};

// ===================================================================
// MÉTHODES STATIQUES
// ===================================================================

// Transactions par utilisateur avec filtres
transactionSchema.statics.findByUser = function(userId, options = {}) {
  const {
    accountId,
    category,
    type,
    startDate,
    endDate,
    limit = 50,
    page = 1
  } = options;
  
  const query = { user: userId };
  
  if (accountId) query.account = accountId;
  if (category) query.category = category;
  if (type) query.type = type;
  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = startDate;
    if (endDate) query.date.$lte = endDate;
  }
  
  return this.find(query)
    .populate('account', 'name bankName type')
    .sort({ date: -1 })
    .limit(limit)
    .skip((page - 1) * limit);
};

// Analytics par catégorie
transactionSchema.statics.getCategoryAnalytics = function(userId, startDate, endDate) {
  const matchStage = {
    user: new mongoose.Types.ObjectId(userId),
    isConfirmed: true
  };
  
  if (startDate || endDate) {
    matchStage.date = {};
    if (startDate) matchStage.date.$gte = startDate;
    if (endDate) matchStage.date.$lte = endDate;
  }
  
  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: { category: '$category', type: '$type' },
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 },
        avgAmount: { $avg: '$amount' }
      }
    },
    { $sort: { totalAmount: -1 } }
  ]);
};

// Recherche transactions
transactionSchema.statics.searchByUser = function(userId, searchTerm) {
  const regex = new RegExp(searchTerm, 'i');
  
  return this.find({
    user: userId,
    $or: [
      { description: regex },
      { notes: regex },
      { 'merchant.name': regex },
      { tags: { $in: [regex] } }
    ]
  }).populate('account', 'name bankName').sort({ date: -1 });
};

// Transactions récurrentes à traiter
transactionSchema.statics.findDueRecurring = function() {
  const today = new Date();
  
  return this.find({
    isRecurring: true,
    $or: [
      { recurringEndDate: { $exists: false } },
      { recurringEndDate: { $gte: today } }
    ]
  }).populate('user account');
};

// Statistiques mensuelles
transactionSchema.statics.getMonthlyStats = function(userId, year, month) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  
  return this.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        date: { $gte: startDate, $lte: endDate },
        isConfirmed: true
      }
    },
    {
      $group: {
        _id: '$type',
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    }
  ]);
};

// Trouver doublons potentiels
transactionSchema.statics.findPotentialDuplicates = function(userId, transaction) {
  const timeDiff = 60 * 60 * 1000; // 1 heure
  const startTime = new Date(transaction.date.getTime() - timeDiff);
  const endTime = new Date(transaction.date.getTime() + timeDiff);
  
  return this.find({
    user: userId,
    account: transaction.account,
    amount: transaction.amount,
    type: transaction.type,
    date: { $gte: startTime, $lte: endTime },
    _id: { $ne: transaction._id }
  });
};

// ===================================================================
// EXPORT DU MODÈLE
// ===================================================================
const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;