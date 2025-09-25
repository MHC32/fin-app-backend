// models/Sol.js
// Modèle Mongoose pour la gestion des Sols/Tontines - FinApp Haiti
// Version complète avec toutes les méthodes nécessaires

const mongoose = require('mongoose');

// ===================================================================
// SOUS-SCHEMAS
// ===================================================================

const participantSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  position: { 
    type: Number, 
    required: true,
    min: 1,
    max: 20
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
    enum: ['pending', 'paid', 'overdue', 'exempt'], 
    default: 'pending' 
  },
  receivedAmount: { 
    type: Number, 
    default: 0 
  },
  totalPaid: {
    type: Number,
    default: 0
  },
  lastPaymentDate: Date,
  paymentHistory: [{
    roundNumber: Number,
    amount: Number,
    date: Date,
    status: String
  }]
}, { _id: false });

const paymentSchema = new mongoose.Schema({
  payer: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  amount: { 
    type: Number, 
    required: true,
    min: 1
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
  paymentMethod: {
    type: String,
    enum: ['wallet', 'bank_transfer', 'mobile_money', 'cash'],
    default: 'wallet'
  },
  transactionId: String,
  notes: { 
    type: String, 
    maxlength: 200 
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verificationDate: Date
}, { _id: false });

const roundSchema = new mongoose.Schema({
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
  dueDate: {
    type: Date,
    required: true
  },
  status: { 
    type: String, 
    enum: ['scheduled', 'pending', 'active', 'completed', 'cancelled'], 
    default: 'scheduled' 
  },
  recipient: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  expectedAmount: {
    type: Number,
    required: true
  },
  actualAmount: {
    type: Number,
    default: 0
  },
  payments: [paymentSchema],
  completedDate: Date,
  transferTransaction: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Transaction' 
  },
  notes: {
    type: String,
    maxlength: 500
  },
  isDistributed: {
    type: Boolean,
    default: false
  },
  distributionDate: Date
}, { _id: false });

const metricsSchema = new mongoose.Schema({
  totalCollected: { 
    type: Number, 
    default: 0 
  },
  totalDistributed: { 
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
  onTimePayments: {
    type: Number,
    default: 0
  },
  latePayments: {
    type: Number,
    default: 0
  },
  totalFees: {
    type: Number,
    default: 0
  },
  averageRoundDuration: {
    type: Number,
    default: 0
  }
}, { _id: false });

const ruleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    maxlength: 100
  },
  description: {
    type: String,
    required: true,
    maxlength: 500
  },
  isEnforced: {
    type: Boolean,
    default: true
  },
  penaltyAmount: {
    type: Number,
    default: 0
  },
  penaltyDescription: {
    type: String,
    maxlength: 200
  }
}, { _id: false });

// ===================================================================
// SCHEMA PRINCIPAL
// ===================================================================

const solSchema = new mongoose.Schema({
  // Informations de base
  creator: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  name: { 
    type: String, 
    required: true, 
    trim: true, 
    maxlength: 100 
  },
  description: { 
    type: String, 
    trim: true, 
    maxlength: 500 
  },
  
  // Type et configuration financière
  type: { 
    type: String, 
    enum: ['classic', 'investment', 'emergency', 'project', 'business'], 
    required: true 
  },
  contributionAmount: { 
    type: Number, 
    required: true, 
    min: 100 
  },
  currency: { 
    type: String, 
    enum: ['HTG', 'USD'], 
    default: 'HTG' 
  },
  maxParticipants: { 
    type: Number, 
    required: true, 
    min: 3, 
    max: 20 
  },
  
  // Calendrier et fréquence
  frequency: { 
    type: String, 
    enum: ['weekly', 'biweekly', 'monthly', 'quarterly'], 
    required: true 
  },
  startDate: { 
    type: Date, 
    required: true 
  },
  actualStartDate: Date,
  duration: {
    type: Number,
    min: 1,
    max: 36
  },
  paymentDay: { 
    type: Number, 
    min: 1, 
    max: 31, 
    default: 1 
  },
  
  // Taux et frais
  interestRate: { 
    type: Number, 
    min: 0, 
    max: 100, 
    default: 0 
  },
  serviceFee: {
    type: Number,
    min: 0,
    max: 10,
    default: 0
  },
  lateFee: {
    type: Number,
    min: 0,
    max: 20,
    default: 5
  },
  
  // Gestion accès et confidentialité
  accessCode: { 
    type: String, 
    unique: true, 
    uppercase: true,
    sparse: true
  },
  isPrivate: { 
    type: Boolean, 
    default: false 
  },
  requiresApproval: {
    type: Boolean,
    default: false
  },
  invitedUsers: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    invitedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' }
  }],
  
  // Participants et rounds
  participants: [participantSchema],
  rounds: [roundSchema],
  
  // Règles et conditions
  rules: [ruleSchema],
  tags: [String],
  
  // Statut et workflow
  status: { 
    type: String, 
    enum: ['draft', 'recruiting', 'active', 'completed', 'cancelled', 'paused'], 
    default: 'recruiting' 
  },
  statusHistory: [{
    status: String,
    date: { type: Date, default: Date.now },
    reason: String,
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],
  
  // Métriques et analytics
  metrics: metricsSchema,
  
  // Dates importantes
  lastActivityDate: { 
    type: Date, 
    default: Date.now 
  },
  completedDate: Date,
  cancelledDate: Date,
  cancellationReason: String,
  nextPaymentDate: Date,
  
  // Sécurité et modération
  isActive: {
    type: Boolean,
    default: true
  },
  moderationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'under_review'],
    default: 'approved'
  },
  moderatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  moderationNotes: String,
  
  // Métadonnées
  location: {
    city: String,
    region: String,
    country: {
      type: String,
      default: 'Haiti'
    }
  },
  preferredLanguage: {
    type: String,
    default: 'fr'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ===================================================================
// VIRTUALS
// ===================================================================

solSchema.virtual('participantCount').get(function() {
  return this.participants.length;
});

solSchema.virtual('spotsLeft').get(function() {
  return this.maxParticipants - this.participants.length;
});

solSchema.virtual('totalValue').get(function() {
  return this.contributionAmount * this.maxParticipants;
});

solSchema.virtual('progressPercentage').get(function() {
  if (!this.rounds || this.rounds.length === 0) return 0;
  const completed = this.rounds.filter(r => r.status === 'completed').length;
  return Math.round((completed / this.rounds.length) * 100);
});

solSchema.virtual('isFull').get(function() {
  return this.participants.length >= this.maxParticipants;
});

solSchema.virtual('canJoin').get(function() {
  return this.status === 'recruiting' && !this.isFull;
});

solSchema.virtual('nextRound').get(function() {
  if (!this.rounds) return null;
  return this.rounds.find(r => 
    r.status === 'pending' || r.status === 'active'
  );
});

solSchema.virtual('currentRound').get(function() {
  if (!this.rounds) return null;
  return this.rounds.find(r => r.status === 'active');
});

// ===================================================================
// MÉTHODES D'INSTANCE
// ===================================================================

/**
 * Calculer la date de fin estimée du sol
 */
solSchema.methods.calculateEndDate = function() {
  if (!this.rounds || this.rounds.length === 0) {
    return this.startDate;
  }
  
  const lastRound = this.rounds[this.rounds.length - 1];
  return lastRound.endDate || lastRound.startDate;
};

/**
 * Obtenir la date du prochain paiement
 */
solSchema.methods.getNextPaymentDate = function() {
  if (!this.rounds) return null;
  
  const activeRound = this.rounds.find(r => 
    r.status === 'active' || r.status === 'pending'
  );
  
  return activeRound ? activeRound.dueDate : null;
};

/**
 * Calculer les jours restants
 */
solSchema.methods.calculateDaysRemaining = function() {
  const endDate = this.calculateEndDate();
  if (!endDate) return 0;
  
  const now = new Date();
  const diffTime = endDate - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Calculer les jours jusqu'au prochain paiement
 */
solSchema.methods.daysUntilNextPayment = function() {
  const nextPayment = this.getNextPaymentDate();
  if (!nextPayment) return null;
  
  const now = new Date();
  const diffTime = nextPayment - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Vérifier si un utilisateur est participant
 */
solSchema.methods.isParticipant = function(userId) {
  return this.participants.some(p => 
    p.user && p.user.toString() === userId.toString()
  );
};

/**
 * Obtenir la position d'un utilisateur
 */
solSchema.methods.getUserPosition = function(userId) {
  const participant = this.participants.find(p => 
    p.user && p.user.toString() === userId.toString()
  );
  return participant ? participant.position : null;
};

/**
 * Obtenir le round d'un utilisateur
 */
solSchema.methods.getUserRound = function(userId) {
  const position = this.getUserPosition(userId);
  if (!position || !this.rounds) return null;
  
  return this.rounds[position - 1];
};

/**
 * Vérifier si un utilisateur a payé pour le round actuel
 */
solSchema.methods.hasPaidCurrentRound = function(userId) {
  const currentRound = this.currentRound;
  if (!currentRound) return false;
  
  return currentRound.payments.some(payment =>
    payment.payer && payment.payer.toString() === userId.toString() &&
    payment.status === 'completed'
  );
};

/**
 * Calculer le montant total collecté
 */
solSchema.methods.calculateTotalCollected = function() {
  if (!this.rounds) return 0;
  
  return this.rounds.reduce((total, round) => {
    if (round.status === 'completed') {
      return total + round.actualAmount;
    }
    return total;
  }, 0);
};

/**
 * Calculer le montant dû par un utilisateur
 */
solSchema.methods.calculateUserBalance = function(userId) {
  const participant = this.participants.find(p => 
    p.user && p.user.toString() === userId.toString()
  );
  
  if (!participant) return 0;
  
  const roundsPaid = this.rounds.reduce((count, round) => {
    const hasPaid = round.payments.some(payment =>
      payment.payer && payment.payer.toString() === userId.toString() &&
      payment.status === 'completed'
    );
    return hasPaid ? count + 1 : count;
  }, 0);
  
  const roundsOwed = this.rounds.filter(round => 
    round.status === 'active' || round.status === 'pending'
  ).length;
  
  const amountOwed = roundsOwed * this.contributionAmount;
  const amountPaid = roundsPaid * this.contributionAmount;
  
  return amountOwed - amountPaid;
};

/**
 * Générer le calendrier des rounds
 */
solSchema.methods.generateRounds = function() {
  const rounds = [];
  let currentDate = new Date(this.actualStartDate || this.startDate);
  
  const frequencyDays = {
    'weekly': 7,
    'biweekly': 14,
    'monthly': 30,
    'quarterly': 90
  };
  
  const daysToAdd = frequencyDays[this.frequency] || 30;
  
  for (let i = 0; i < this.maxParticipants; i++) {
    const startDate = new Date(currentDate);
    const endDate = new Date(currentDate.getTime() + (daysToAdd * 24 * 60 * 60 * 1000));
    const dueDate = new Date(startDate);
    dueDate.setDate(dueDate.getDate() + 7); // Paiement dû 7 jours après le début du round
    
    rounds.push({
      roundNumber: i + 1,
      startDate: startDate,
      endDate: endDate,
      dueDate: dueDate,
      status: i === 0 ? 'pending' : 'scheduled',
      expectedAmount: this.contributionAmount * this.maxParticipants,
      actualAmount: 0,
      recipient: this.participants[i]?.user || null,
      payments: []
    });
    
    currentDate = new Date(endDate);
  }
  
  return rounds;
};

/**
 * Activer le prochain round
 */
solSchema.methods.activateNextRound = function() {
  const pendingRound = this.rounds.find(r => r.status === 'pending');
  if (pendingRound) {
    pendingRound.status = 'active';
    this.nextPaymentDate = pendingRound.dueDate;
    return pendingRound;
  }
  return null;
};

/**
 * Marquer un round comme complété
 */
solSchema.methods.completeRound = function(roundNumber) {
  const round = this.rounds.find(r => r.roundNumber === roundNumber);
  if (round) {
    round.status = 'completed';
    round.completedDate = new Date();
    round.actualAmount = round.payments.reduce((sum, payment) => sum + payment.amount, 0);
    
    // Mettre à jour les métriques
    this.metrics.completedRounds += 1;
    this.metrics.totalCollected += round.actualAmount;
    
    return round;
  }
  return null;
};

// ===================================================================
// MÉTHODES STATIQUES
// ===================================================================

/**
 * Trouver un sol par son code d'accès
 */
solSchema.statics.findByAccessCode = function(accessCode) {
  return this.findOne({ 
    accessCode: accessCode.toUpperCase(), 
    status: 'recruiting',
    isActive: true
  });
};

/**
 * Trouver les sols actifs d'un utilisateur
 */
solSchema.statics.findUserActiveSols = function(userId) {
  return this.find({
    $or: [
      { creator: userId },
      { 'participants.user': userId }
    ],
    status: { $in: ['recruiting', 'active'] },
    isActive: true
  });
};

/**
 * Trouver les sols disponibles pour rejoindre
 */
solSchema.statics.findAvailableSols = function(filters = {}) {
  const query = {
    status: 'recruiting',
    isPrivate: false,
    isActive: true,
    moderationStatus: 'approved'
  };
  
  if (filters.type) query.type = filters.type;
  if (filters.currency) query.currency = filters.currency;
  if (filters.minAmount) query.contributionAmount = { $gte: filters.minAmount };
  if (filters.maxAmount) query.contributionAmount = { ...query.contributionAmount, $lte: filters.maxAmount };
  if (filters.region) query['location.region'] = filters.region;
  
  return this.find(query)
    .populate('creator', 'firstName lastName region rating')
    .populate('participants.user', 'firstName lastName')
    .sort({ createdAt: -1 });
};

/**
 * Générer un code d'accès unique
 */
solSchema.statics.generateUniqueAccessCode = async function() {
  let code;
  let exists = true;
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  
  while (exists) {
    code = '';
    for (let i = 0; i < 6; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    
    exists = await this.findOne({ accessCode: code });
  }
  
  return code;
};

/**
 * Obtenir les statistiques globales des sols
 */
solSchema.statics.getGlobalStats = async function() {
  const stats = await this.aggregate([
    {
      $match: { isActive: true }
    },
    {
      $group: {
        _id: null,
        totalSols: { $sum: 1 },
        totalParticipants: { $sum: { $size: '$participants' } },
        totalAmount: { $sum: { $multiply: ['$contributionAmount', '$maxParticipants'] } },
        activeSols: {
          $sum: { $cond: [{ $in: ['$status', ['recruiting', 'active']] }, 1, 0] }
        },
        completedSols: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        }
      }
    },
    {
      $project: {
        _id: 0,
        totalSols: 1,
        totalParticipants: 1,
        totalAmount: { $round: ['$totalAmount', 2] },
        activeSols: 1,
        completedSols: 1,
        averageParticipants: { $round: [{ $divide: ['$totalParticipants', '$totalSols'] }, 1] }
      }
    }
  ]);
  
  return stats.length > 0 ? stats[0] : {
    totalSols: 0,
    totalParticipants: 0,
    totalAmount: 0,
    activeSols: 0,
    completedSols: 0,
    averageParticipants: 0
  };
};

// ===================================================================
// MIDDLEWARE (HOOKS)
// ===================================================================

// Avant la sauvegarde, générer les rounds si nécessaire
solSchema.pre('save', function(next) {
  // Générer le code d'accès si nouveau sol
  if (this.isNew && !this.accessCode) {
    this.constructor.generateUniqueAccessCode()
      .then(code => {
        this.accessCode = code;
        next();
      })
      .catch(next);
    return;
  }
  
  // Générer les rounds si le sol est complet et passe en actif
  if (this.isModified('status') && this.status === 'active' && this.participants.length === this.maxParticipants) {
    if (!this.rounds || this.rounds.length === 0) {
      this.rounds = this.generateRounds();
      this.actualStartDate = new Date();
    }
  }
  
  // Mettre à jour la date de dernière activité
  if (this.isModified() && !this.isModified('lastActivityDate')) {
    this.lastActivityDate = new Date();
  }
  
  next();
});

// Après la sauvegarde, mettre à jour les métriques
solSchema.post('save', function(doc) {
  if (doc.rounds && doc.rounds.length > 0) {
    const completedRounds = doc.rounds.filter(r => r.status === 'completed').length;
    const totalRounds = doc.rounds.length;
    
    doc.metrics.completedRounds = completedRounds;
    doc.metrics.successRate = totalRounds > 0 ? Math.round((completedRounds / totalRounds) * 100) : 0;
    doc.metrics.totalCollected = doc.calculateTotalCollected();
    
    // Ne pas sauvegarder à nouveau pour éviter la recursion
    if (doc.isModified('metrics')) {
      doc.constructor.updateOne(
        { _id: doc._id },
        { $set: { metrics: doc.metrics } }
      ).exec();
    }
  }
});

// ===================================================================
// INDEXES POUR PERFORMANCE
// ===================================================================

solSchema.index({ creator: 1 });
solSchema.index({ status: 1 });
solSchema.index({ accessCode: 1 }, { unique: true, sparse: true });
solSchema.index({ 'participants.user': 1 });
solSchema.index({ createdAt: -1 });
solSchema.index({ lastActivityDate: -1 });
solSchema.index({ type: 1, status: 1 });
solSchema.index({ contributionAmount: 1 });
solSchema.index({ 'location.region': 1 });
solSchema.index({ status: 1, isPrivate: 1, moderationStatus: 1 });

// Index composé pour les recherches de disponibilité
solSchema.index({ 
  status: 1, 
  isPrivate: 1, 
  currency: 1, 
  contributionAmount: 1,
  'location.region': 1 
});

module.exports = mongoose.model('Sol', solSchema);