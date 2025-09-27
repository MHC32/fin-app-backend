// src/models/Debt.js
// Modèle pour gérer dettes et créances

const mongoose = require('mongoose');

const debtSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Type de dette
  type: {
    type: String,
    enum: ['debt', 'loan'], // debt = je dois, loan = on me doit
    required: true
  },

  // Personne concernée
  contact: {
    name: {
      type: String,
      required: true,
      trim: true
    },
    phone: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true
    },
    relation: {
      type: String,
      enum: ['family', 'friend', 'colleague', 'business', 'other'],
      default: 'other'
    }
  },

  // Montant et devise
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    enum: ['HTG', 'USD'],
    default: 'HTG'
  },

  // Montant déjà remboursé
  amountPaid: {
    type: Number,
    default: 0,
    min: 0
  },

  // Montant restant (calculé automatiquement)
  amountRemaining: {
    type: Number,
    default: 0
  },

  // Description et raison
  description: {
    type: String,
    trim: true
  },
  reason: {
    type: String,
    enum: ['personal', 'business', 'emergency', 'investment', 'education', 'health', 'other'],
    default: 'other'
  },

  // Dates importantes
  borrowedDate: {
    type: Date,
    default: Date.now
  },
  dueDate: {
    type: Date,
    index: true
  },
  
  // Statut
  status: {
    type: String,
    enum: ['active', 'partially_paid', 'paid', 'overdue', 'cancelled'],
    default: 'active',
    index: true
  },

  // Priorité
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },

  // Conditions de remboursement
  paymentTerms: {
    installments: {
      type: Boolean,
      default: false
    },
    installmentAmount: Number,
    installmentFrequency: {
      type: String,
      enum: ['daily', 'weekly', 'biweekly', 'monthly'],
      default: 'monthly'
    },
    numberOfInstallments: Number
  },

  // Intérêts (si applicable)
  interest: {
    hasInterest: {
      type: Boolean,
      default: false
    },
    rate: Number,
    totalInterest: {
      type: Number,
      default: 0
    }
  },

  // Historique des paiements
  payments: [{
    amount: {
      type: Number,
      required: true
    },
    date: {
      type: Date,
      default: Date.now
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'moncash', 'bank_transfer', 'check', 'other']
    },
    note: String,
    receipt: String, // URL photo reçu
    transactionReference: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction'
    }
  }],

  // Rappels et notifications
  reminders: [{
    date: Date,
    type: {
      type: String,
      enum: ['payment_due', 'overdue', 'custom']
    },
    message: String,
    sent: {
      type: Boolean,
      default: false
    }
  }],

  // Preuves et documents
  documents: [{
    type: String, // URL Cloudinary
    description: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Notes additionnelles
  notes: String,

  // Metadata
  tags: [String],
  isArchived: {
    type: Boolean,
    default: false
  },
  
  // Tracking automatique
  lastPaymentDate: Date,
  nextPaymentDue: Date,

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index composés pour performance
debtSchema.index({ user: 1, status: 1 });
debtSchema.index({ user: 1, type: 1, status: 1 });
debtSchema.index({ user: 1, dueDate: 1 });
debtSchema.index({ 'contact.name': 'text', description: 'text' });

// Virtual : Pourcentage payé
debtSchema.virtual('percentagePaid').get(function() {
  if (this.amount === 0) return 0;
  return Math.round((this.amountPaid / this.amount) * 100);
});

// Virtual : Jours restants
debtSchema.virtual('daysRemaining').get(function() {
  if (!this.dueDate) return null;
  const today = new Date();
  const diffTime = this.dueDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Virtual : Est en retard
debtSchema.virtual('isOverdue').get(function() {
  if (!this.dueDate) return false;
  return new Date() > this.dueDate && this.status !== 'paid';
});

// Middleware : Calculer montant restant avant sauvegarde
debtSchema.pre('save', function(next) {
  this.amountRemaining = this.amount - this.amountPaid;
  
  // Mettre à jour statut automatiquement
  if (this.amountPaid >= this.amount) {
    this.status = 'paid';
  } else if (this.amountPaid > 0) {
    this.status = 'partially_paid';
  } else if (this.isOverdue) {
    this.status = 'overdue';
  } else if (this.status === 'paid' && this.amountPaid < this.amount) {
    this.status = 'active';
  }
  
  next();
});

// Méthode : Ajouter paiement
debtSchema.methods.addPayment = function(paymentData) {
  this.payments.push(paymentData);
  this.amountPaid += paymentData.amount;
  this.lastPaymentDate = paymentData.date || new Date();
  
  // Calculer prochaine échéance si paiements échelonnés
  if (this.paymentTerms.installments && this.paymentTerms.installmentFrequency) {
    const nextDate = new Date(this.lastPaymentDate);
    switch (this.paymentTerms.installmentFrequency) {
      case 'daily':
        nextDate.setDate(nextDate.getDate() + 1);
        break;
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'biweekly':
        nextDate.setDate(nextDate.getDate() + 14);
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
    }
    this.nextPaymentDue = nextDate;
  }
  
  return this.save();
};

// Méthode : Calculer intérêts
debtSchema.methods.calculateInterest = function() {
  if (!this.interest.hasInterest || !this.interest.rate) return 0;
  
  const principal = this.amountRemaining;
  const rate = this.interest.rate / 100;
  const interest = principal * rate;
  
  this.interest.totalInterest += interest;
  return interest;
};

// Méthode statique : Obtenir statistiques utilisateur
debtSchema.statics.getUserStats = async function(userId) {
  const debts = await this.find({ user: userId, type: 'debt', status: { $ne: 'paid' } });
  const loans = await this.find({ user: userId, type: 'loan', status: { $ne: 'paid' } });
  
  const totalDebt = debts.reduce((sum, d) => sum + d.amountRemaining, 0);
  const totalLoans = loans.reduce((sum, l) => sum + l.amountRemaining, 0);
  
  return {
    totalDebt,
    totalLoans,
    netPosition: totalLoans - totalDebt,
    activeDebts: debts.length,
    activeLoans: loans.length,
    overdueDebts: debts.filter(d => d.isOverdue).length,
    overdueLoans: loans.filter(l => l.isOverdue).length
  };
};

const Debt = mongoose.model('Debt', debtSchema);

module.exports = Debt;