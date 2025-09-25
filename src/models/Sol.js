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
    min: [100, 'Montant de contribution trop faible'], // Utilisation valeur directe pour éviter erreur
    validate: {
      validator: function(v) {
        const maxAmount = this.currency === 'HTG' ? 50000 : 1000; // Valeurs directes
        return v <= maxAmount;
      },
      message: 'Montant de contribution trop élevé'
    }
  },
  
  currency: {
    type: String,
    required: [true, 'La devise est requise'],
    enum: {
      values: ['HTG', 'USD'], // Valeurs directes pour éviter erreur
      message: 'Devise non supportée'
    },
    default: 'HTG'
  },
  
  frequency: {
    type: String,
    required: [true, 'La fréquence est requise'],
    enum: {
      values: ['weekly', 'biweekly', 'monthly', 'quarterly'], // Valeurs directes
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
    min: [3, 'Minimum 3 participants'],
    max: [20, 'Maximum 20 participants']
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
    joinedAt: {
      type: Date,
      default: Date.now
    },
    role: {
      type: String,
      enum: ['creator', 'participant'],
      default: 'participant'
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'current', 'overdue'],
      default: 'pending'
    },
    hasReceived: {
      type: Boolean,
      default: false
    },
    receivedDate: Date,
    receivedAmount: Number,
    
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
  // STRUCTURE ROUNDS/TOURS - CORRECTION PRINCIPALE
  // ===================================================================
  rounds: [{
    roundNumber: {
      type: Number,
      required: true,
      min: 1
    },
    
    startDate: {
      type: Date,
      required: true
    },
    
    endDate: {
      type: Date,
      required: true
    },
    
    status: {
      type: String,
      enum: ['scheduled', 'pending', 'active', 'completed', 'cancelled'],
      default: 'scheduled'
    },
    
    // RÉFÉRENCE AU BÉNÉFICIAIRE DU TOUR - CORRECTION ERREUR POPULATE
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      sparse: true
    },
    
    // PAIEMENTS POUR CE TOUR
    payments: [{
      payer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      amount: {
        type: Number,
        required: true,
        min: 0
      },
      date: {
        type: Date,
        default: Date.now
      },
      status: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'refunded'],
        default: 'completed'
      },
      transactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction'
      },
      notes: {
        type: String,
        maxlength: 200
      }
    }],
    
    // INFORMATIONS TOUR
    totalCollected: {
      type: Number,
      default: 0
    },
    
    completedDate: {
      type: Date
    },
    
    transferTransaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction'
    },
    
    notes: {
      type: String,
      maxlength: 500
    }
  }],
  
  // ===================================================================
  // CALENDRIER ET DATES
  // ===================================================================
  startDate: {
    type: Date,
    required: [true, 'La date de début est requise'],
    validate: {
      validator: function(v) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return v >= tomorrow;
      },
      message: 'La date de début doit être au moins demain'
    }
  },
  
  actualStartDate: {
    type: Date
  },
  
  duration: {
    type: Number,
    min: [1, 'Durée minimum 1 mois'],
    max: [24, 'Durée maximum 24 mois']
  },
  
  paymentDay: {
    type: Number,
    min: [1, 'Jour de paiement entre 1 et 31'],
    max: [31, 'Jour de paiement entre 1 et 31'],
    default: 1
  },
  
  nextPaymentDate: {
    type: Date
  },
  
  completedDate: {
    type: Date
  },
  
  // ===================================================================
  // STATUTS ET CONFIGURATION
  // ===================================================================
  status: {
    type: String,
    enum: ['recruiting', 'active', 'completed', 'cancelled', 'paused'],
    default: 'recruiting',
    index: true
  },
  
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  
  interestRate: {
    type: Number,
    min: [0, 'Taux d\'intérêt minimum 0%'],
    max: [10, 'Taux d\'intérêt maximum 10%'],
    default: 0
  },
  
  rules: [{
    type: String,
    trim: true,
    maxlength: 200
  }],
  
  // ===================================================================
  // CODE D'ACCÈS ET SÉCURITÉ
  // ===================================================================
  accessCode: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    minlength: 6,
    maxlength: 8
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
  // MÉTRIQUES POUR IA - CORRECTION ERREUR ANALYTICS
  // ===================================================================
  metrics: {
    totalRounds: {
      type: Number,
      default: 0
    },
    completedRounds: {
      type: Number,
      default: 0
    },
    successRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    avgPaymentDelay: {
      type: Number,
      default: 0
    },
    participantRetention: {
      type: Number,
      default: 100,
      min: 0,
      max: 100
    },
    totalCollected: {
      type: Number,
      default: 0
    }
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
solSchema.virtual('currentParticipantCount').get(function() {
  return this.participants.filter(p => p.isActive).length;
});

solSchema.virtual('totalAmount').get(function() {
  return this.contributionAmount * this.currentParticipantCount;
});

solSchema.virtual('isFull').get(function() {
  return this.currentParticipantCount >= this.maxParticipants;
});

solSchema.virtual('isCompleted').get(function() {
  return this.status === 'completed';
});

solSchema.virtual('progressPercentage').get(function() {
  if (!this.rounds || this.rounds.length === 0) return 0;
  const completedRounds = this.rounds.filter(r => r.status === 'completed').length;
  return Math.round((completedRounds / this.rounds.length) * 100);
});

// ===================================================================
// MÉTHODES INSTANCE
// ===================================================================

// Méthode pour obtenir prochaine date de paiement
solSchema.methods.getNextPaymentDate = function() {
  if (!this.rounds || this.rounds.length === 0) return null;
  
  const activeRound = this.rounds.find(r => r.status === 'active' || r.status === 'pending');
  return activeRound ? activeRound.endDate : null;
};

// Méthode pour calculer date de fin
solSchema.methods.calculateEndDate = function() {
  if (!this.rounds || this.rounds.length === 0) return null;
  
  const lastRound = this.rounds[this.rounds.length - 1];
  return lastRound ? lastRound.endDate : null;
};

// Méthode pour calculer jours restants
solSchema.methods.calculateDaysRemaining = function() {
  const endDate = this.calculateEndDate();
  if (!endDate) return null;
  
  const now = new Date();
  const diffTime = endDate.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

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
    joinedAt: new Date(),
    contactInfo: userData.contactInfo || {}
  };
  
  this.participants.push(participant);
  
  // Auto-start si configuré et conditions remplies
  if (this.isFull && this.status === 'recruiting') {
    this.status = 'active';
  }
  
  return this.save();
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
    status: 'active',
    nextPaymentDate: { $lte: today }
  });
};

// Rechercher sol par code
solSchema.statics.findByAccessCode = function(accessCode) {
  return this.findOne({ 
    accessCode: accessCode.toUpperCase(),
    status: { $in: ['recruiting', 'active'] }
  }).populate('creator', 'firstName lastName');
};

// Sols ouverts pour rejoindre
solSchema.statics.findOpenSols = function(filters = {}) {
  const query = {
    status: 'recruiting',
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
// INDEX POUR PERFORMANCE
// ===================================================================
solSchema.index({ creator: 1, status: 1 });
solSchema.index({ 'participants.user': 1, status: 1 });
solSchema.index({ accessCode: 1 });
solSchema.index({ status: 1, isPrivate: 1 });
solSchema.index({ lastActivityDate: -1 });

// ===================================================================
// EXPORT DU MODÈLE
// ===================================================================
const Sol = mongoose.model('Sol', solSchema);

module.exports = Sol;