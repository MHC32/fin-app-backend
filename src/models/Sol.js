// src/models/Sol.js - Modèle tontines/sols FinApp Haiti
const mongoose = require('mongoose');

// Import des constantes
const { 
  SOL_FREQUENCIES,
  SOL_TYPES,
  SOL_STATUSES,
  PAYMENT_STATUSES,
  CURRENCIES,
  DEFAULTS,
  LIMITS,
  VALIDATION_PATTERNS
} = require('../utils/constants');

/**
 * Schéma Sol/Tontine adapté au contexte haïtien
 */
const solSchema = new mongoose.Schema({
  // ===================================================================
  // RELATION CRÉATEUR
  // ===================================================================
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Le créateur est requis'],
    index: true
  },
  
  // ===================================================================
  // INFORMATIONS SOL
  // ===================================================================
  name: {
    type: String,
    required: [true, 'Le nom du sol est requis'],
    trim: true,
    minlength: [3, 'Le nom doit contenir au moins 3 caractères'],
    maxlength: [100, 'Le nom ne peut pas dépasser 100 caractères']
  },
  
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'La description ne peut pas dépasser 500 caractères']
  },
  
  type: {
    type: String,
    required: [true, 'Le type de sol est requis'],
    enum: {
      values: Object.keys(SOL_TYPES),
      message: 'Type de sol non valide'
    },
    default: 'classic'
  },
  
  // ===================================================================
  // CONFIGURATION FINANCIÈRE
  // ===================================================================
  contributionAmount: {
    type: Number,
    required: [true, 'Le montant de contribution est requis'],
    min: [LIMITS.SOL.MIN_AMOUNT_HTG, 'Montant de contribution trop faible'],
    validate: {
      validator: function(v) {
        const maxAmount = this.currency === 'HTG' ? LIMITS.SOL.MAX_AMOUNT_HTG : LIMITS.SOL.MAX_AMOUNT_USD;
        return v <= maxAmount;
      },
      message: 'Montant de contribution trop élevé'
    }
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
  
  frequency: {
    type: String,
    required: [true, 'La fréquence est requise'],
    enum: {
      values: Object.keys(SOL_FREQUENCIES),
      message: 'Fréquence non valide'
    },
    default: 'monthly'
  },
  
  // ===================================================================
  // PARTICIPANTS
  // ===================================================================
  maxParticipants: {
    type: Number,
    required: [true, 'Le nombre maximum de participants est requis'],
    min: [LIMITS.SOL.MIN_PARTICIPANTS, `Minimum ${LIMITS.SOL.MIN_PARTICIPANTS} participants`],
    max: [LIMITS.SOL.MAX_PARTICIPANTS, `Maximum ${LIMITS.SOL.MAX_PARTICIPANTS} participants`]
  },
  
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    position: {
      type: Number,
      required: true,
      min: 1
    },
    joinedDate: {
      type: Date,
      default: Date.now
    },
    hasReceived: {
      type: Boolean,
      default: false
    },
    receivedDate: Date,
    receivedAmount: Number,
    
    // Historique paiements
    paymentHistory: [{
      round: {
        type: Number,
        required: true
      },
      amount: {
        type: Number,
        required: true
      },
      datePaid: {
        type: Date,
        default: Date.now
      },
      status: {
        type: String,
        enum: Object.values(PAYMENT_STATUSES),
        default: 'paid'
      },
      paymentMethod: {
        type: String,
        enum: ['cash', 'moncash', 'natcash', 'bank_transfer'],
        default: 'cash'
      },
      notes: String
    }],
    
    // Statut participant
    isActive: {
      type: Boolean,
      default: true
    },
    
    warningCount: {
      type: Number,
      default: 0
    },
    
    lastWarningDate: Date,
    
    // Contact info pour ce sol
    contactInfo: {
      phone: String,
      alternatePhone: String,
      address: String
    }
  }],
  
  // ===================================================================
  // CALENDRIER ET TOURS
  // ===================================================================
  startDate: {
    type: Date,
    required: [true, 'La date de début est requise'],
    index: true
  },
  
  endDate: {
    type: Date,
    validate: {
      validator: function(v) {
        return !v || v > this.startDate;
      },
      message: 'La date de fin doit être postérieure à la date de début'
    }
  },
  
  currentRound: {
    type: Number,
    default: 1,
    min: 1
  },
  
  totalRounds: {
    type: Number,
    default: function() {
      return this.maxParticipants;
    }
  },
  
  nextPaymentDate: {
    type: Date,
    index: true
  },
  
  nextRecipientPosition: {
    type: Number,
    min: 1
  },
  
  // ===================================================================
  // RÈGLES ET CONFIGURATION
  // ===================================================================
  rules: {
    requiresApproval: {
      type: Boolean,
      default: true
    },
    
    allowLatePayments: {
      type: Boolean,
      default: true
    },
    
    latePaymentGraceDays: {
      type: Number,
      default: 3,
      min: 0,
      max: 30
    },
    
    penaltyAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    
    penaltyType: {
      type: String,
      enum: ['fixed', 'percentage'],
      default: 'fixed'
    },
    
    requireGuarantor: {
      type: Boolean,
      default: false
    },
    
    minimumParticipants: {
      type: Number,
      default: function() {
        return SOL_TYPES[this.type]?.minParticipants || 3;
      }
    },
    
    autoStartWhenFull: {
      type: Boolean,
      default: true
    },
    
    allowPartialPayments: {
      type: Boolean,
      default: false
    }
  },
  
  // ===================================================================
  // STATUT ET GESTION
  // ===================================================================
  status: {
    type: String,
    enum: Object.values(SOL_STATUSES),
    default: SOL_STATUSES.DRAFT
  },
  
  isActive: {
    type: Boolean,
    default: true
  },
  
  isPaused: {
    type: Boolean,
    default: false
  },
  
  pauseReason: {
    type: String,
    enum: ['late_payments', 'dispute', 'insufficient_participants', 'creator_request', 'other']
  },
  
  pausedDate: Date,
  
  // ===================================================================
  // ACCÈS ET SÉCURITÉ
  // ===================================================================
  accessCode: {
    type: String,
    unique: true,
    sparse: true,
    validate: {
      validator: function(v) {
        return !v || VALIDATION_PATTERNS.SOL_CODE.test(v);
      },
      message: 'Code d\'accès invalide (6-8 caractères alphanumériques)'
    }
  },
  
  isPrivate: {
    type: Boolean,
    default: false
  },
  
  requiresInvitation: {
    type: Boolean,
    default: false
  },
  
  invitationCode: {
    type: String,
    sparse: true
  },
  
  // ===================================================================
  // NOTIFICATIONS ET RAPPELS
  // ===================================================================
  notificationSettings: {
    enabled: {
      type: Boolean,
      default: true
    },
    
    reminderDaysBefore: {
      type: Number,
      default: 3,
      min: 1,
      max: 7
    },
    
    notifyOnJoin: {
      type: Boolean,
      default: true
    },
    
    notifyOnPayment: {
      type: Boolean,
      default: true
    },
    
    notifyOnLatePayment: {
      type: Boolean,
      default: true
    }
  },
  
  // ===================================================================
  // HISTORIQUE ET ANALYTICS
  // ===================================================================
  roundHistory: [{
    round: {
      type: Number,
      required: true
    },
    recipientPosition: {
      type: Number,
      required: true
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    totalCollected: {
      type: Number,
      required: true
    },
    dateCompleted: {
      type: Date,
      default: Date.now
    },
    paymentsSummary: {
      onTime: Number,
      late: Number,
      partial: Number,
      missing: Number
    },
    notes: String
  }],
  
  // ===================================================================
  // DISPUTES ET PROBLÈMES
  // ===================================================================
  disputes: [{
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    againstParticipant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    type: {
      type: String,
      enum: ['late_payment', 'no_payment', 'wrong_amount', 'behavior', 'other'],
      required: true
    },
    description: {
      type: String,
      required: true,
      maxlength: 1000
    },
    status: {
      type: String,
      enum: ['open', 'investigating', 'resolved', 'closed'],
      default: 'open'
    },
    createdDate: {
      type: Date,
      default: Date.now
    },
    resolvedDate: Date,
    resolution: String
  }],
  
  // ===================================================================
  // MÉTADONNÉES
  // ===================================================================
  tags: [{
    type: String,
    trim: true,
    maxlength: [30, 'Un tag ne peut pas dépasser 30 caractères']
  }],
  
  notes: {
    type: String,
    maxlength: [1000, 'Les notes ne peuvent pas dépasser 1000 caractères']
  },
  
  lastActivityDate: {
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
solSchema.virtual('typeInfo').get(function() {
  return SOL_TYPES[this.type] || SOL_TYPES.classic;
});

solSchema.virtual('frequencyInfo').get(function() {
  return SOL_FREQUENCIES[this.frequency] || SOL_FREQUENCIES.monthly;
});

solSchema.virtual('currencyInfo').get(function() {
  return CURRENCIES[this.currency] || CURRENCIES[DEFAULTS.CURRENCY];
});

solSchema.virtual('currentParticipantCount').get(function() {
  return this.participants.filter(p => p.isActive).length;
});

solSchema.virtual('totalAmount').get(function() {
  return this.contributionAmount * this.currentParticipantCount;
});

solSchema.virtual('isFull').get(function() {
  return this.currentParticipantCount >= this.maxParticipants;
});

solSchema.virtual('canStart').get(function() {
  return this.currentParticipantCount >= this.rules.minimumParticipants;
});

solSchema.virtual('isCompleted').get(function() {
  return this.currentRound > this.totalRounds || this.status === SOL_STATUSES.COMPLETED;
});

solSchema.virtual('remainingRounds').get(function() {
  return Math.max(0, this.totalRounds - this.currentRound + 1);
});

solSchema.virtual('progressPercentage').get(function() {
  if (this.totalRounds === 0) return 0;
  return Math.round(((this.currentRound - 1) / this.totalRounds) * 100);
});

solSchema.virtual('nextRecipient').get(function() {
  if (!this.nextRecipientPosition) return null;
  return this.participants.find(p => p.position === this.nextRecipientPosition);
});

solSchema.virtual('averagePaymentRate').get(function() {
  const totalPayments = this.participants.reduce((sum, p) => sum + p.paymentHistory.length, 0);
  const expectedPayments = this.currentParticipantCount * (this.currentRound - 1);
  
  if (expectedPayments === 0) return 100;
  return Math.round((totalPayments / expectedPayments) * 100);
});

// ===================================================================
// INDEX POUR PERFORMANCE
// ===================================================================
solSchema.index({ creator: 1, status: 1 });
solSchema.index({ status: 1, nextPaymentDate: 1 });
solSchema.index({ accessCode: 1 });
solSchema.index({ 'participants.user': 1 });
solSchema.index({ type: 1, isActive: 1 });
solSchema.index({ frequency: 1, nextPaymentDate: 1 });
solSchema.index({ startDate: -1 });
solSchema.index({ lastActivityDate: -1 });

// Index géospatial si location ajoutée plus tard
// solSchema.index({ location: '2dsphere' });

// ===================================================================
// MIDDLEWARE PRE-SAVE
// ===================================================================

// Générer code d'accès automatiquement
solSchema.pre('save', function(next) {
  if (this.isNew && !this.accessCode) {
    const crypto = require('crypto');
    this.accessCode = crypto.randomBytes(4).toString('hex').toUpperCase();
  }
  next();
});

// Calculer prochaine date de paiement
solSchema.pre('save', function(next) {
  if (this.isModified('startDate') || this.isModified('frequency') || this.isModified('currentRound')) {
    const frequencyDays = {
      weekly: 7,
      biweekly: 14,
      monthly: 30,
      quarterly: 90
    };
    
    const days = frequencyDays[this.frequency] || 30;
    const roundsElapsed = this.currentRound - 1;
    
    this.nextPaymentDate = new Date(this.startDate);
    this.nextPaymentDate.setDate(this.nextPaymentDate.getDate() + (days * roundsElapsed));
  }
  next();
});

// Calculer date de fin
solSchema.pre('save', function(next) {
  if (!this.endDate && this.startDate && this.frequency && this.totalRounds) {
    const frequencyDays = {
      weekly: 7,
      biweekly: 14,
      monthly: 30
    };
    
    const days = (frequencyDays[this.frequency] || 30) * this.totalRounds;
    this.endDate = new Date(this.startDate);
    this.endDate.setDate(this.endDate.getDate() + days);
  }
  next();
});

// Mettre à jour statut automatiquement
solSchema.pre('save', function(next) {
  if (this.status === SOL_STATUSES.ACTIVE && this.isCompleted) {
    this.status = SOL_STATUSES.COMPLETED;
    this.isActive = false;
  }
  
  this.lastActivityDate = new Date();
  next();
});

// ===================================================================
// MÉTHODES D'INSTANCE
// ===================================================================

// Ajouter participant
solSchema.methods.addParticipant = async function(userData, position = null) {
  if (this.isFull) {
    throw new Error('Le sol est complet');
  }
  
  // Vérifier si l'utilisateur est déjà participant
  const existingParticipant = this.participants.find(p => p.user.toString() === userData.userId.toString());
  if (existingParticipant) {
    throw new Error('L\'utilisateur participe déjà à ce sol');
  }
  
  // Assigner position automatiquement si pas spécifiée
  if (!position) {
    const usedPositions = this.participants.map(p => p.position);
    for (let i = 1; i <= this.maxParticipants; i++) {
      if (!usedPositions.includes(i)) {
        position = i;
        break;
      }
    }
  }
  
  const participant = {
    user: userData.userId,
    position: position,
    joinedDate: new Date(),
    contactInfo: userData.contactInfo || {}
  };
  
  this.participants.push(participant);
  
  // Auto-start si configuré et conditions remplies
  if (this.rules.autoStartWhenFull && this.isFull && this.status === SOL_STATUSES.RECRUITING) {
    this.status = SOL_STATUSES.ACTIVE;
    this.nextRecipientPosition = 1;
  }
  
  return this.save();
};

// Enregistrer paiement
solSchema.methods.recordPayment = function(participantUserId, paymentData) {
  const participant = this.participants.find(p => p.user.toString() === participantUserId.toString());
  
  if (!participant) {
    throw new Error('Participant non trouvé');
  }
  
  const payment = {
    round: this.currentRound,
    amount: paymentData.amount,
    datePaid: paymentData.datePaid || new Date(),
    status: paymentData.status || 'paid',
    paymentMethod: paymentData.paymentMethod || 'cash',
    notes: paymentData.notes
  };
  
  participant.paymentHistory.push(payment);
  
  return this.save();
};

// Avancer au tour suivant
solSchema.methods.advanceToNextRound = async function() {
  if (this.currentRound >= this.totalRounds) {
    this.status = SOL_STATUSES.COMPLETED;
    this.isActive = false;
    return this.save();
  }
  
  // Créer historique du tour actuel
  const currentRecipient = this.participants.find(p => p.position === this.nextRecipientPosition);
  
  if (currentRecipient) {
    const roundRecord = {
      round: this.currentRound,
      recipientPosition: this.nextRecipientPosition,
      recipient: currentRecipient.user,
      totalCollected: this.totalAmount,
      dateCompleted: new Date(),
      paymentsSummary: this.calculatePaymentsSummary()
    };
    
    this.roundHistory.push(roundRecord);
    
    // Marquer le participant comme ayant reçu
    currentRecipient.hasReceived = true;
    currentRecipient.receivedDate = new Date();
    currentRecipient.receivedAmount = this.totalAmount;
  }
  
  // Avancer au tour suivant
  this.currentRound += 1;
  this.nextRecipientPosition = this.getNextRecipientPosition();
  
  return this.save();
};

// Calculer résumé des paiements
solSchema.methods.calculatePaymentsSummary = function() {
  const currentRoundPayments = this.participants.map(p => {
    const payment = p.paymentHistory.find(ph => ph.round === this.currentRound);
    return payment?.status || 'missing';
  });
  
  return {
    onTime: currentRoundPayments.filter(s => s === 'paid').length,
    late: currentRoundPayments.filter(s => s === 'overdue').length,
    partial: currentRoundPayments.filter(s => s === 'partial').length,
    missing: currentRoundPayments.filter(s => s === 'missing').length
  };
};

// Obtenir prochaine position bénéficiaire
solSchema.methods.getNextRecipientPosition = function() {
  const hasReceivedPositions = this.participants
    .filter(p => p.hasReceived)
    .map(p => p.position);
  
  // Trouver la prochaine position qui n'a pas encore reçu
  for (let i = 1; i <= this.maxParticipants; i++) {
    if (!hasReceivedPositions.includes(i) && this.participants.find(p => p.position === i)) {
      return i;
    }
  }
  
  return null; // Sol terminé
};

// Supprimer participant
solSchema.methods.removeParticipant = function(participantUserId, reason = 'user_request') {
  const participantIndex = this.participants.findIndex(p => p.user.toString() === participantUserId.toString());
  
  if (participantIndex === -1) {
    throw new Error('Participant non trouvé');
  }
  
  const participant = this.participants[participantIndex];
  
  // Vérifier si le participant a déjà reçu
  if (participant.hasReceived) {
    throw new Error('Impossible de supprimer un participant qui a déjà reçu');
  }
  
  this.participants.splice(participantIndex, 1);
  
  return this.save();
};

// Suspendre sol
solSchema.methods.pause = function(reason) {
  this.isPaused = true;
  this.pauseReason = reason;
  this.pausedDate = new Date();
  this.status = SOL_STATUSES.PAUSED;
  
  return this.save();
};

// Reprendre sol
solSchema.methods.resume = function() {
  this.isPaused = false;
  this.pauseReason = undefined;
  this.pausedDate = undefined;
  this.status = SOL_STATUSES.ACTIVE;
  
  return this.save();
};

// ===================================================================
// MÉTHODES STATIQUES
// ===================================================================

// Sols d'un utilisateur (créés ou participant)
solSchema.statics.findByUser = function(userId) {
  return this.find({
    $or: [
      { creator: userId },
      { 'participants.user': userId }
    ],
    isActive: true
  }).populate('creator', 'firstName lastName')
    .populate('participants.user', 'firstName lastName phone')
    .sort({ lastActivityDate: -1 });
};

// Sols nécessitant paiement
solSchema.statics.findDuePayments = function(userId) {
  const today = new Date();
  
  return this.find({
    'participants.user': userId,
    status: SOL_STATUSES.ACTIVE,
    nextPaymentDate: { $lte: today }
  });
};

// Rechercher sol par code
solSchema.statics.findByAccessCode = function(accessCode) {
  return this.findOne({ 
    accessCode: accessCode.toUpperCase(),
    status: { $in: [SOL_STATUSES.RECRUITING, SOL_STATUSES.ACTIVE] }
  }).populate('creator', 'firstName lastName');
};

// Sols ouverts pour rejoindre
solSchema.statics.findOpenSols = function(filters = {}) {
  const query = {
    status: SOL_STATUSES.RECRUITING,
    isActive: true,
    isPrivate: false
  };
  
  if (filters.type) query.type = filters.type;
  if (filters.currency) query.currency = filters.currency;
  if (filters.maxAmount) query.contributionAmount = { $lte: filters.maxAmount };
  
  return this.find(query)
    .populate('creator', 'firstName lastName region')
    .sort({ createdAt: -1 });
};

// Analytics sols utilisateur
solSchema.statics.getUserSolStats = function(userId) {
  return this.aggregate([
    {
      $match: {
        $or: [
          { creator: new mongoose.Types.ObjectId(userId) },
          { 'participants.user': new mongoose.Types.ObjectId(userId) }
        ]
      }
    },
    {
      $group: {
        _id: null,
        totalSols: { $sum: 1 },
        activeSols: {
          $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
        },
        completedSols: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        totalContributed: { $sum: '$contributionAmount' },
        avgContribution: { $avg: '$contributionAmount' }
      }
    }
  ]);
};

// ===================================================================
// EXPORT DU MODÈLE
// ===================================================================
const Sol = mongoose.model('Sol', solSchema);

module.exports = Sol;