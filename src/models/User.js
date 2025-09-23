// src/models/User.js - Modèle utilisateur FinApp Haiti
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Import des constantes
const { 
  HAITI_REGIONS, 
  CURRENCIES, 
  USER_ROLES, 
  DEFAULTS,
  VALIDATION_PATTERNS 
} = require('../utils/constants');

/**
 * Schéma utilisateur adapté au contexte haïtien
 */
const userSchema = new mongoose.Schema({
  // ===================================================================
  // INFORMATIONS PERSONNELLES
  // ===================================================================
  firstName: {
    type: String,
    required: [true, 'Le prénom est requis'],
    trim: true,
    minlength: [2, 'Le prénom doit contenir au moins 2 caractères'],
    maxlength: [50, 'Le prénom ne peut pas dépasser 50 caractères']
  },
  
  lastName: {
    type: String,
    required: [true, 'Le nom de famille est requis'],
    trim: true,
    minlength: [2, 'Le nom doit contenir au moins 2 caractères'],
    maxlength: [50, 'Le nom ne peut pas dépasser 50 caractères']
  },
  
  email: {
    type: String,
    required: [true, 'L\'adresse email est requise'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [VALIDATION_PATTERNS.EMAIL, 'Format d\'email invalide']
  },
  
  password: {
    type: String,
    required: [true, 'Le mot de passe est requis'],
    minlength: [8, 'Le mot de passe doit contenir au moins 8 caractères'],
    select: false // Ne pas inclure le password dans les requêtes par défaut
  },
  
  phone: {
    type: String,
    unique: true,
    sparse: true, // Permet des valeurs null multiples
    validate: {
      validator: function(v) {
        if (!v) return true; // Optionnel
        return VALIDATION_PATTERNS.HAITI_PHONE.test(v) || 
               VALIDATION_PATTERNS.HAITI_PHONE_LOCAL.test(v);
      },
      message: 'Format de téléphone haïtien invalide (ex: +50932123456)'
    }
  },
  
  // ===================================================================
  // LOCALISATION HAÏTI
  // ===================================================================
  region: {
    type: String,
    enum: {
      values: Object.keys(HAITI_REGIONS),
      message: 'Région haïtienne non valide'
    },
    default: DEFAULTS.REGION
  },
  
  city: {
    type: String,
    default: function() {
      return HAITI_REGIONS[this.region]?.capital || 'Port-au-Prince';
    }
  },
  
  // ===================================================================
  // PRÉFÉRENCES FINAPP
  // ===================================================================
  defaultCurrency: {
    type: String,
    enum: {
      values: Object.keys(CURRENCIES),
      message: 'Devise non supportée'
    },
    default: DEFAULTS.CURRENCY
  },
  
  language: {
    type: String,
    enum: ['fr', 'ht', 'en'],
    default: DEFAULTS.LANGUAGE
  },
  
  theme: {
    type: String,
    enum: ['light', 'dark'],
    default: DEFAULTS.THEME
  },
  
  // ===================================================================
  // PRÉFÉRENCES NOTIFICATIONS
  // ===================================================================
  notificationPreferences: {
    email: {
      type: Boolean,
      default: true
    },
    push: {
      type: Boolean,
      default: true
    },
    budgetAlerts: {
      type: Boolean,
      default: true
    },
    solReminders: {
      type: Boolean,
      default: true
    },
    investmentUpdates: {
      type: Boolean,
      default: false
    },
    reminderDaysBefore: {
      type: Number,
      default: 3,
      min: 1,
      max: 7
    }
  },
  
  // ===================================================================
  // SÉCURITÉ & AUTHENTIFICATION
  // ===================================================================
  role: {
    type: String,
    enum: Object.values(USER_ROLES),
    default: USER_ROLES.USER
  },
  
  isVerified: {
    type: Boolean,
    default: false
  },
  
  verificationToken: {
    type: String,
    select: false
  },
  
  verificationTokenExpires: {
    type: Date,
    select: false
  },
  
  resetPasswordToken: {
    type: String,
    select: false
  },
  
  resetPasswordExpires: {
    type: Date,
    select: false
  },
  
  lastLogin: {
    type: Date
  },
  
  loginAttempts: {
    type: Number,
    default: 0
  },
  
  lockUntil: {
    type: Date
  },
  
  // ===================================================================
  // GESTION SESSIONS & TOKENS
  // ===================================================================
  refreshTokens: [{
    token: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    expiresAt: {
      type: Date,
      required: true
    },
    deviceInfo: {
      userAgent: String,
      ip: String,
      device: String,
      browser: String,
      os: String
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  
  activeSessions: [{
    sessionId: {
      type: String,
      required: true
    },
    accessToken: {
      type: String,
      required: true
    },
    refreshToken: {
      type: String,
      required: true
    },
    deviceInfo: {
      userAgent: String,
      ip: String,
      device: String,
      browser: String,
      os: String,
      location: String
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    lastActivity: {
      type: Date,
      default: Date.now
    },
    expiresAt: {
      type: Date,
      required: true
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  
  // ===================================================================
  // PROFIL & PERSONNALISATION
  // ===================================================================
  profileImage: {
    url: String,
    publicId: String // Pour Cloudinary
  },
  
  bio: {
    type: String,
    maxlength: [200, 'La bio ne peut pas dépasser 200 caractères'],
    trim: true
  },
  
  // ===================================================================
  // STATUT COMPTE
  // ===================================================================
  isActive: {
    type: Boolean,
    default: true
  },
  
  isDeleted: {
    type: Boolean,
    default: false
  },
  
  deleteReason: {
    type: String,
    enum: ['user_request', 'violation', 'inactivity', 'other']
  },
  
  deletedAt: {
    type: Date
  }
  
}, {
  timestamps: true, // Ajoute createdAt et updatedAt automatiquement
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.verificationToken;
      delete ret.resetPasswordToken;
      delete ret.__v;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// ===================================================================
// VIRTUELS (champs calculés)
// ===================================================================
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

userSchema.virtual('isAccountLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

userSchema.virtual('regionInfo').get(function() {
  return HAITI_REGIONS[this.region] || HAITI_REGIONS[DEFAULTS.REGION];
});

userSchema.virtual('currencyInfo').get(function() {
  return CURRENCIES[this.defaultCurrency] || CURRENCIES[DEFAULTS.CURRENCY];
});

// ===================================================================
// INDEX POUR PERFORMANCE
// ===================================================================
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ phone: 1 }, { unique: true, sparse: true });
userSchema.index({ region: 1 });
userSchema.index({ isActive: 1, isDeleted: 1 });
userSchema.index({ createdAt: -1 });

// ===================================================================
// MIDDLEWARE PRE-SAVE
// ===================================================================

// Hash du password avant sauvegarde
userSchema.pre('save', async function(next) {
  // Ne hasher que si le password a été modifié
  if (!this.isModified('password')) return next();
  
  try {
    // Hash avec cost de 12 (sécurisé)
    this.password = await bcrypt.hash(this.password, 12);
    next();
  } catch (error) {
    next(error);
  }
});

// Normaliser le téléphone
userSchema.pre('save', function(next) {
  if (this.phone && !this.phone.startsWith('+509')) {
    // Ajouter +509 si c'est un numéro local
    if (this.phone.length === 8) {
      this.phone = '+509' + this.phone;
    }
  }
  next();
});

// Définir la ville par défaut selon la région
userSchema.pre('save', function(next) {
  if (this.isModified('region') && !this.isModified('city')) {
    this.city = HAITI_REGIONS[this.region]?.capital || 'Port-au-Prince';
  }
  next();
});

// ===================================================================
// MÉTHODES D'INSTANCE
// ===================================================================

// Vérifier le mot de passe
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Erreur lors de la vérification du mot de passe');
  }
};

// ✅ FIX: Vérifier si le compte est verrouillé
userSchema.methods.isLocked = function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Incrémenter les tentatives de connexion
userSchema.methods.incLoginAttempts = function() {
  // Si on a un verrou et qu'il a expiré, reset
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Si on atteint 5 tentatives, verrouiller pour 2 heures
  if (this.loginAttempts + 1 >= 5 && !this.isAccountLocked) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 heures
  }
  
  return this.updateOne(updates);
};

// Reset des tentatives de connexion
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
};

// Générer token de vérification
userSchema.methods.generateVerificationToken = function() {
  const crypto = require('crypto');
  const token = crypto.randomBytes(32).toString('hex');
  
  this.verificationToken = token;
  this.verificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 heures
  
  return token;
};

// Générer token reset password
userSchema.methods.generateResetPasswordToken = function() {
  const crypto = require('crypto');
  const token = crypto.randomBytes(32).toString('hex');
  
  this.resetPasswordToken = token;
  this.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 heure
  
  return token;
};

// Mettre à jour dernière connexion
userSchema.methods.updateLastLogin = function() {
  this.lastLogin = new Date();
  return this.save();
};

// ===================================================================
// MÉTHODES GESTION SESSIONS
// ===================================================================

// Ajouter une nouvelle session
// ===================================================================
// MÉTHODES GESTION SESSIONS - CORRECTED
// ===================================================================

// Ajouter une nouvelle session - FIXÉ
userSchema.methods.addSession = function(sessionData) {
  const crypto = require('crypto');
  
  // CORRECTION: Utiliser le sessionId fourni OU générer si absent
  const sessionId = sessionData.sessionId || crypto.randomUUID();
  
  const session = {
    sessionId, // Maintenant utilise le bon sessionId
    accessToken: sessionData.accessToken,
    refreshToken: sessionData.refreshToken,
    deviceInfo: sessionData.deviceInfo || {},
    expiresAt: sessionData.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 jours
  };
  
  this.activeSessions.push(session);
  return this.save();
};

// Ajouter refresh token
userSchema.methods.addRefreshToken = function(tokenData) {
  const refreshToken = {
    token: tokenData.token,
    expiresAt: tokenData.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 jours
    deviceInfo: tokenData.deviceInfo || {}
  };
  
  this.refreshTokens.push(refreshToken);
  
  // Garder seulement les 5 derniers refresh tokens
  if (this.refreshTokens.length > 5) {
    this.refreshTokens = this.refreshTokens.slice(-5);
  }
  
  return this.save();
};

// Mettre à jour activité session
userSchema.methods.updateSessionActivity = function(sessionId) {
  const session = this.activeSessions.id(sessionId);
  if (session) {
    session.lastActivity = new Date();
    return this.save();
  }
  return Promise.resolve();
};

// Supprimer une session spécifique
userSchema.methods.removeSession = function(sessionId) {
  this.activeSessions = this.activeSessions.filter(
    session => session.sessionId !== sessionId
  );
  return this.save();
};

// Supprimer refresh token
userSchema.methods.removeRefreshToken = function(token) {
  this.refreshTokens = this.refreshTokens.filter(
    rt => rt.token !== token
  );
  return this.save();
};

// Supprimer toutes les sessions (logout global)
userSchema.methods.removeAllSessions = function() {
  this.activeSessions = [];
  this.refreshTokens = [];
  return this.save();
};

// Supprimer sessions expirées
userSchema.methods.cleanExpiredSessions = function() {
  const now = new Date();
  
  // Nettoyer sessions expirées
  this.activeSessions = this.activeSessions.filter(
    session => session.expiresAt > now && session.isActive
  );
  
  // Nettoyer refresh tokens expirés
  this.refreshTokens = this.refreshTokens.filter(
    rt => rt.expiresAt > now && rt.isActive
  );
  
  return this.save();
};

// Vérifier si refresh token existe et est valide
userSchema.methods.hasValidRefreshToken = function(token) {
  const refreshToken = this.refreshTokens.find(
    rt => rt.token === token && rt.isActive && rt.expiresAt > new Date()
  );
  return !!refreshToken;
};

// Obtenir sessions actives avec infos
userSchema.methods.getActiveSessions = function() {
  const now = new Date();
  return this.activeSessions.filter(
    session => session.expiresAt > now && session.isActive
  ).map(session => ({
    sessionId: session.sessionId,
    device: session.deviceInfo.device || 'Inconnu',
    browser: session.deviceInfo.browser || 'Inconnu',
    os: session.deviceInfo.os || 'Inconnu',
    location: session.deviceInfo.location || 'Inconnue',
    lastActivity: session.lastActivity,
    createdAt: session.createdAt
  }));
};

// ===================================================================
// MÉTHODES STATIQUES
// ===================================================================

// Trouver par email ou téléphone
userSchema.statics.findByEmailOrPhone = function(identifier) {
  const isEmail = VALIDATION_PATTERNS.EMAIL.test(identifier);
  const query = isEmail ? { email: identifier } : { phone: identifier };
  
  return this.findOne(query).select('+password');
};

// Vérifier si email existe
userSchema.statics.emailExists = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

// Vérifier si téléphone existe
userSchema.statics.phoneExists = function(phone) {
  return this.findOne({ phone });
};

// Statistiques utilisateurs par région
userSchema.statics.getRegionStats = function() {
  return this.aggregate([
    { $match: { isActive: true, isDeleted: false } },
    { $group: { _id: '$region', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
};

// Nettoyer sessions expirées globalement
userSchema.statics.cleanAllExpiredSessions = function() {
  const now = new Date();
  
  return this.updateMany(
    {},
    {
      $pull: {
        activeSessions: { expiresAt: { $lt: now } },
        refreshTokens: { expiresAt: { $lt: now } }
      }
    }
  );
};

// Trouver utilisateur par refresh token
userSchema.statics.findByRefreshToken = function(token) {
  return this.findOne({
    'refreshTokens.token': token,
    'refreshTokens.isActive': true,
    'refreshTokens.expiresAt': { $gt: new Date() }
  });
};

// Statistiques sessions actives
userSchema.statics.getSessionStats = function() {
  return this.aggregate([
    { $match: { isActive: true } },
    { $project: { 
      sessionCount: { $size: '$activeSessions' },
      region: 1
    }},
    { $group: {
      _id: '$region',
      totalSessions: { $sum: '$sessionCount' },
      activeUsers: { $sum: 1 }
    }},
    { $sort: { totalSessions: -1 } }
  ]);
};

// ===================================================================
// EXPORT DU MODÈLE
// ===================================================================
const User = mongoose.model('User', userSchema);

module.exports = User;