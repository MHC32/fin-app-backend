// src/models/Notification.js

const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  // ===================================================================
  // DESTINATAIRE & SOURCE
  // ===================================================================
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Source de la notification (quel module l'a générée)
  source: {
    type: String,
    required: true,
    enum: [
      'ai_advice',        // Conseils IA
      'ai_anomaly',       // Anomalies détectées
      'ai_prediction',    // Prédictions
      'budget_alert',     // Alertes budget
      'sol_reminder',     // Rappels sols
      'sol_turn',         // Tour de sol
      'debt_reminder',    // Rappels dettes
      'transaction',      // Transactions
      'account',          // Comptes
      'system'            // Système
    ],
    index: true
  },

  // ===================================================================
  // CONTENU NOTIFICATION
  // ===================================================================
  type: {
    type: String,
    required: true,
    enum: [
      'info',
      'success', 
      'warning',
      'error',
      'urgent'
    ],
    default: 'info'
  },

  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },

  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },

  // ===================================================================
  // PRIORITÉ & ACTIONS
  // ===================================================================
  priority: {
    type: String,
    required: true,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
    index: true
  },

  actionable: {
    type: Boolean,
    default: false
  },

  actionUrl: {
    type: String,
    trim: true
  },

  actionLabel: {
    type: String,
    trim: true,
    maxlength: 50
  },

  // ===================================================================
  // DONNÉES CONTEXTUELLES
  // ===================================================================
  metadata: {
    // Données flexibles selon le type
    amount: Number,
    percentage: Number,
    entityId: mongoose.Schema.Types.ObjectId,
    entityType: String,
    relatedData: mongoose.Schema.Types.Mixed
  },

  // ===================================================================
  // CANAUX DE DIFFUSION
  // ===================================================================
  channels: {
    inApp: {
      type: Boolean,
      default: true
    },
    push: {
      type: Boolean,
      default: false
    },
    email: {
      type: Boolean,
      default: false
    },
    sms: {
      type: Boolean,
      default: false
    }
  },

  // ===================================================================
  // STATUT & TRACKING
  // ===================================================================
  status: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'read', 'acted', 'dismissed', 'failed'],
    default: 'pending',
    index: true
  },

  readAt: {
    type: Date,
    index: true
  },

  actedAt: Date,
  dismissedAt: Date,

  // Tentatives d'envoi
  deliveryAttempts: {
    type: Number,
    default: 0
  },

  deliveredAt: Date,
  failureReason: String,

  // ===================================================================
  // VALIDITÉ & EXPIRATION
  // ===================================================================
  expiresAt: {
    type: Date,
    index: true
  },

  scheduledFor: {
    type: Date,
    index: true
  },

  // ===================================================================
  // GROUPEMENT
  // ===================================================================
  groupKey: {
    type: String,
    index: true
  },

  batchId: {
    type: String,
    index: true
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ===================================================================
// INDEX POUR PERFORMANCE
// ===================================================================
notificationSchema.index({ user: 1, status: 1, createdAt: -1 });
notificationSchema.index({ user: 1, priority: 1, status: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // Auto-delete
notificationSchema.index({ scheduledFor: 1, status: 1 }); // Notifications programmées
notificationSchema.index({ groupKey: 1, user: 1 }); // Groupement

// ===================================================================
// VIRTUALS
// ===================================================================
notificationSchema.virtual('isExpired').get(function() {
  return this.expiresAt && this.expiresAt < new Date();
});

notificationSchema.virtual('isUnread').get(function() {
  return !this.readAt && this.status !== 'read';
});

notificationSchema.virtual('isScheduled').get(function() {
  return this.scheduledFor && this.scheduledFor > new Date();
});

// ===================================================================
// MIDDLEWARE
// ===================================================================

// Auto-expirer les notifications périmées
notificationSchema.pre('save', function(next) {
  if (this.expiresAt && this.expiresAt < new Date() && this.status !== 'failed') {
    this.status = 'failed';
    this.failureReason = 'Expired before delivery';
  }
  next();
});

// ===================================================================
// MÉTHODES D'INSTANCE
// ===================================================================

notificationSchema.methods.markAsRead = function() {
  this.status = 'read';
  this.readAt = new Date();
  return this.save();
};

notificationSchema.methods.markAsActed = function() {
  this.status = 'acted';
  this.actedAt = new Date();
  return this.save();
};

notificationSchema.methods.dismiss = function() {
  this.status = 'dismissed';
  this.dismissedAt = new Date();
  return this.save();
};

notificationSchema.methods.markAsDelivered = function() {
  this.status = 'delivered';
  this.deliveredAt = new Date();
  return this.save();
};

// ===================================================================
// MÉTHODES STATIQUES
// ===================================================================

// Récupérer notifications non lues
notificationSchema.statics.getUnread = function(userId, limit = 50) {
  return this.find({
    user: userId,
    status: { $in: ['pending', 'sent', 'delivered'] },
    $or: [
      { expiresAt: { $gt: new Date() } },
      { expiresAt: null }
    ]
  })
  .sort({ priority: -1, createdAt: -1 })
  .limit(limit);
};

// Récupérer par priorité
notificationSchema.statics.getByPriority = function(userId, priority) {
  return this.find({
    user: userId,
    priority: priority,
    status: { $ne: 'read' }
  })
  .sort({ createdAt: -1 });
};

// Marquer plusieurs comme lues
notificationSchema.statics.markManyAsRead = function(userId, notificationIds) {
  return this.updateMany(
    {
      _id: { $in: notificationIds },
      user: userId
    },
    {
      $set: {
        status: 'read',
        readAt: new Date()
      }
    }
  );
};

// Nettoyer anciennes notifications
notificationSchema.statics.cleanupOld = function(daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  return this.deleteMany({
    createdAt: { $lt: cutoffDate },
    status: 'read'
  });
};

// Compter non lues par type
notificationSchema.statics.countUnreadByType = function(userId) {
  return this.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        status: { $in: ['pending', 'sent', 'delivered'] }
      }
    },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 }
      }
    }
  ]);
};

// ===================================================================
// EXPORT
// ===================================================================
const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;