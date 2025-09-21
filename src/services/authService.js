// src/services/authService.js - Service d'authentification FinApp Haiti
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const {
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
  extractBearerToken,
  generateTemporaryToken,
  isTokenExpiringSoon
} = require('../config/jwt');

/**
 * Service d'authentification intégré avec User.js sessions
 * Gestion complète : register, login, refresh, logout, security
 */

// ===================================================================
// ENREGISTREMENT UTILISATEUR
// ===================================================================

/**
 * Enregistrer un nouvel utilisateur
 * @param {Object} userData - Données utilisateur
 * @param {Object} deviceInfo - Informations device/IP
 * @returns {Object} - Utilisateur créé + tokens
 */
const registerUser = async (userData, deviceInfo = {}) => {
  try {
    const { email, password, firstName, lastName, phone, region, city } = userData;

    // 1. Vérifier si utilisateur existe déjà
    const existingUser = await User.findOne({
      $or: [
        { email: email.toLowerCase() },
        { phone: phone }
      ]
    });

    if (existingUser) {
      throw new Error('Un utilisateur avec cet email ou téléphone existe déjà');
    }

    // 2. Hash du mot de passe
    const saltRounds = 12;


    // 3. Créer utilisateur
    const user = new User({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.toLowerCase().trim(),
      password: password,
      phone: phone.trim(),
      region: region.toLowerCase(),
      city: city.trim(),
      registrationDate: new Date(),
      lastLogin: new Date()
    });

    await user.save();

    // 4. Générer tokens et session
    const tokens = generateTokenPair(user, deviceInfo);

    // 5. Ajouter session à User.js
    await user.addSession({
      sessionId: tokens.sessionId,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      deviceInfo: {
        userAgent: deviceInfo.userAgent || '',
        ip: deviceInfo.ip || '',
        device: deviceInfo.device || 'unknown',
        browser: deviceInfo.browser || '',
        os: deviceInfo.os || '',
        location: deviceInfo.location || ''
      },
      expiresAt: new Date(tokens.refreshExpiresIn)
    });

    // 6. Ajouter refresh token
    await user.addRefreshToken({
      token: tokens.refreshToken,
      expiresAt: new Date(tokens.refreshExpiresIn),
      deviceInfo: deviceInfo
    });

    // 7. Retourner données (sans password)
    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.refreshTokens;
    delete userResponse.activeSessions;

    return {
      success: true,
      message: 'Utilisateur créé avec succès',
      user: userResponse,
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenType: tokens.tokenType,
        expiresIn: tokens.accessExpiresIn
      },
      session: {
        sessionId: tokens.sessionId,
        deviceId: tokens.deviceId
      }
    };

  } catch (error) {
    throw new Error(`Erreur enregistrement: ${error.message}`);
  }
};

// ===================================================================
// CONNEXION UTILISATEUR
// ===================================================================

/**
 * Connexion utilisateur
 * @param {Object} credentials - Email/phone + password
 * @param {Object} deviceInfo - Informations device
 * @returns {Object} - Utilisateur + tokens + session
 */
const loginUser = async (credentials, deviceInfo = {}) => {
  try {
    const { identifier, password } = credentials; // identifier = email ou phone

    // 1. Trouver utilisateur par email ou téléphone
    const user = await User.findByEmailOrPhone(identifier);

    if (!user) {
      throw new Error('Email/téléphone ou mot de passe incorrect');
    }

    // 2. Vérifier si compte verrouillé
    if (user.isLocked()) {
      throw new Error(`Compte temporairement verrouillé. Réessayez dans ${Math.ceil((user.lockUntil - Date.now()) / (1000 * 60))} minutes.`);
    }

    // 3. Vérifier mot de passe
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      // Incrémenter tentatives de connexion
      await user.incLoginAttempts();
      throw new Error('Email/téléphone ou mot de passe incorrect');
    }

    // 4. Réinitialiser tentatives de connexion
    user.loginAttempts = 0;
    user.lockUntil = undefined;

    // 5. Mettre à jour dernière connexion
    await user.updateLastLogin();

    // 6. Générer tokens et session
    const tokens = generateTokenPair(user, deviceInfo);

    // 7. Nettoyer anciennes sessions si trop nombreuses (garde 5 max)
    if (user.activeSessions.length >= 5) {
      // Garder les 4 plus récentes + nouvelle
      user.activeSessions = user.activeSessions
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 4);
    }

    // 8. Ajouter nouvelle session
    await user.addSession({
      sessionId: tokens.sessionId,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      deviceInfo: {
        userAgent: deviceInfo.userAgent || '',
        ip: deviceInfo.ip || '',
        device: deviceInfo.device || 'unknown',
        browser: deviceInfo.browser || '',
        os: deviceInfo.os || '',
        location: deviceInfo.location || ''
      },
      expiresAt: new Date(tokens.refreshExpiresIn)
    });

    // 9. Ajouter refresh token
    await user.addRefreshToken({
      token: tokens.refreshToken,
      expiresAt: new Date(tokens.refreshExpiresIn),
      deviceInfo: deviceInfo
    });

    // 10. Retourner données
    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.refreshTokens;
    delete userResponse.activeSessions;
    delete userResponse.verificationToken;
    delete userResponse.resetPasswordToken;

    return {
      success: true,
      message: 'Connexion réussie',
      user: userResponse,
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenType: tokens.tokenType,
        expiresIn: tokens.accessExpiresIn
      },
      session: {
        sessionId: tokens.sessionId,
        deviceId: tokens.deviceId,
        deviceInfo: deviceInfo
      }
    };

  } catch (error) {
    throw new Error(`Erreur connexion: ${error.message}`);
  }
};

// ===================================================================
// REFRESH TOKEN
// ===================================================================

/**
 * Renouveler access token avec refresh token
 * @param {string} refreshToken - Refresh token JWT
 * @param {Object} deviceInfo - Informations device
 * @returns {Object} - Nouveaux tokens
 */
const refreshTokens = async (refreshToken, deviceInfo = {}) => {
  try {
    // 1. Vérifier format et validité refresh token
    const verification = verifyRefreshToken(refreshToken);

    if (!verification.isValid) {
      throw new Error(verification.error || 'Refresh token invalide');
    }

    const { userId, sessionId } = verification.payload;

    // 2. Trouver utilisateur avec ce refresh token
    const user = await User.findByRefreshToken(refreshToken);

    if (!user) {
      throw new Error('Refresh token non trouvé ou expiré');
    }

    // 3. Vérifier que l'utilisateur correspond
    if (user._id.toString() !== userId) {
      throw new Error('Refresh token invalide pour cet utilisateur');
    }

    // 4. Trouver la session correspondante
    const session = user.activeSessions.find(s => s.sessionId === sessionId);

    if (!session || !session.isActive) {
      throw new Error('Session invalide ou expirée');
    }

    // 5. Générer nouveaux tokens
    const newTokens = generateTokenPair(user, deviceInfo);

    // 6. Mettre à jour session existante
    session.accessToken = newTokens.accessToken;
    session.refreshToken = newTokens.refreshToken;
    session.expiresAt = new Date(newTokens.refreshExpiresIn);
    session.lastActivity = new Date();

    // 7. Invalider ancien refresh token et ajouter nouveau
    user.refreshTokens.forEach(rt => {
      if (rt.token === refreshToken) {
        rt.isActive = false;
      }
    });

    await user.addRefreshToken({
      token: newTokens.refreshToken,
      expiresAt: new Date(newTokens.refreshExpiresIn),
      deviceInfo: deviceInfo
    });

    await user.save();

    return {
      success: true,
      message: 'Tokens renouvelés avec succès',
      tokens: {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        tokenType: newTokens.tokenType,
        expiresIn: newTokens.accessExpiresIn
      },
      session: {
        sessionId: newTokens.sessionId,
        deviceId: newTokens.deviceId
      }
    };

  } catch (error) {
    throw new Error(`Erreur refresh token: ${error.message}`);
  }
};

// ===================================================================
// DÉCONNEXION
// ===================================================================

/**
 * Déconnexion utilisateur (session spécifique)
 * @param {string} userId - ID utilisateur
 * @param {string} sessionId - ID session à fermer
 * @returns {Object} - Résultat déconnexion
 */
const logoutUser = async (userId, sessionId) => {
  try {
    const user = await User.findById(userId);

    if (!user) {
      throw new Error('Utilisateur non trouvé');
    }

    // Supprimer session spécifique
    await user.removeSession(sessionId);

    return {
      success: true,
      message: 'Déconnexion réussie'
    };

  } catch (error) {
    throw new Error(`Erreur déconnexion: ${error.message}`);
  }
};

/**
 * Déconnexion de toutes les sessions
 * @param {string} userId - ID utilisateur
 * @returns {Object} - Résultat déconnexion globale
 */
const logoutAllSessions = async (userId) => {
  try {
    const user = await User.findById(userId);

    if (!user) {
      throw new Error('Utilisateur non trouvé');
    }

    // Invalider toutes les sessions et refresh tokens
    user.activeSessions = [];
    user.refreshTokens = user.refreshTokens.map(rt => ({ ...rt, isActive: false }));

    await user.save();

    return {
      success: true,
      message: 'Déconnexion de toutes les sessions réussie'
    };

  } catch (error) {
    throw new Error(`Erreur déconnexion globale: ${error.message}`);
  }
};

// ===================================================================
// VALIDATION & VÉRIFICATION
// ===================================================================

/**
 * Valider access token et récupérer utilisateur
 * @param {string} authHeader - Header Authorization
 * @returns {Object} - Utilisateur + infos session
 */
const validateAccessToken = async (authHeader) => {
  try {
    // 1. Extraire token du header Bearer
    const token = extractBearerToken(authHeader);

    if (!token) {
      throw new Error('Token d\'authentification requis');
    }

    // 2. Vérifier token JWT
    const verification = verifyAccessToken(token);

    if (!verification.isValid) {
      throw new Error(verification.error || 'Token invalide');
    }

    const { userId, sessionId } = verification.payload;

    // 3. Trouver utilisateur
    const user = await User.findById(userId);

    if (!user || !user.isActive) {
      throw new Error('Utilisateur non trouvé ou inactif');
    }

    // 4. Vérifier session active
    const session = user.activeSessions.find(s => s.sessionId === sessionId && s.isActive);

    if (!session) {
      throw new Error('Session invalide ou expirée');
    }

    // 5. Vérifier si token expire bientôt
    const expiringSoon = isTokenExpiringSoon(verification.payload, 5);

    return {
      success: true,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        region: user.region,
        isVerified: user.isVerified
      },
      session: {
        sessionId: session.sessionId,
        deviceInfo: session.deviceInfo,
        lastActivity: session.lastActivity
      },
      tokenInfo: {
        payload: verification.payload,
        expiringSoon: expiringSoon
      }
    };

  } catch (error) {
    throw new Error(`Erreur validation token: ${error.message}`);
  }
};

/**
 * Vérifier permissions utilisateur
 * @param {Object} user - Utilisateur à vérifier
 * @param {string|Array} requiredRoles - Rôles requis
 * @returns {boolean} - True si autorisé
 */
const checkUserPermissions = (user, requiredRoles) => {
  if (!user || !user.role) {
    return false;
  }

  if (typeof requiredRoles === 'string') {
    return user.role === requiredRoles;
  }

  if (Array.isArray(requiredRoles)) {
    return requiredRoles.includes(user.role);
  }

  return false;
};

// ===================================================================
// GESTION MOTS DE PASSE
// ===================================================================

/**
 * Générer token reset password
 * @param {string} email - Email utilisateur
 * @returns {Object} - Token et infos reset
 */
const generatePasswordResetToken = async (email) => {
  try {
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      // Ne pas révéler si email existe
      return {
        success: true,
        message: 'Si cet email existe, un lien de réinitialisation a été envoyé'
      };
    }

    // Générer token reset
    const resetToken = user.generateResetPasswordToken();
    await user.save();

    // Générer JWT temporaire pour sécurité supplémentaire
    const tempToken = generateTemporaryToken({
      userId: user._id.toString(),
      email: user.email,
      type: 'password_reset'
    }, '1h');

    return {
      success: true,
      resetToken: resetToken,
      tempToken: tempToken,
      expiresIn: '1h',
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName
      }
    };

  } catch (error) {
    throw new Error(`Erreur génération token reset: ${error.message}`);
  }
};

/**
 * Réinitialiser mot de passe
 * @param {string} resetToken - Token de réinitialisation
 * @param {string} newPassword - Nouveau mot de passe
 * @returns {Object} - Résultat reset
 */
const resetPassword = async (resetToken, newPassword) => {
  try {
    const user = await User.findOne({
      resetPasswordToken: resetToken,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      throw new Error('Token de réinitialisation invalide ou expiré');
    }

    // Hash nouveau mot de passe
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Mettre à jour utilisateur
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    // Invalider toutes les sessions existantes pour sécurité
    user.activeSessions = [];
    user.refreshTokens = user.refreshTokens.map(rt => ({ ...rt, isActive: false }));

    await user.save();

    return {
      success: true,
      message: 'Mot de passe réinitialisé avec succès'
    };

  } catch (error) {
    throw new Error(`Erreur réinitialisation mot de passe: ${error.message}`);
  }
};

/**
 * Changer mot de passe (utilisateur connecté)
 * @param {string} userId - ID utilisateur
 * @param {string} currentPassword - Mot de passe actuel
 * @param {string} newPassword - Nouveau mot de passe
 * @returns {Object} - Résultat changement
 */
const changePassword = async (userId, currentPassword, newPassword) => {
  try {
    const user = await User.findById(userId).select('+password');

    if (!user) {
      throw new Error('Utilisateur non trouvé');
    }

    // Vérifier mot de passe actuel
    const isCurrentValid = await bcrypt.compare(currentPassword, user.password);

    if (!isCurrentValid) {
      throw new Error('Mot de passe actuel incorrect');
    }

    // Hash nouveau mot de passe
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    user.password = hashedPassword;
    await user.save();

    return {
      success: true,
      message: 'Mot de passe modifié avec succès'
    };

  } catch (error) {
    throw new Error(`Erreur changement mot de passe: ${error.message}`);
  }
};

// ===================================================================
// GESTION SESSIONS
// ===================================================================

/**
 * Lister sessions actives utilisateur
 * @param {string} userId - ID utilisateur
 * @returns {Object} - Liste sessions
 */
const getUserSessions = async (userId) => {
  try {
    const user = await User.findById(userId);

    if (!user) {
      throw new Error('Utilisateur non trouvé');
    }

    const activeSessions = user.activeSessions
      .filter(session => session.isActive && session.expiresAt > new Date())
      .map(session => ({
        sessionId: session.sessionId,
        deviceInfo: session.deviceInfo,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        expiresAt: session.expiresAt,
        isCurrent: false // À définir dans le controller
      }))
      .sort((a, b) => b.lastActivity - a.lastActivity);

    return {
      success: true,
      sessions: activeSessions,
      totalSessions: activeSessions.length
    };

  } catch (error) {
    throw new Error(`Erreur récupération sessions: ${error.message}`);
  }
};

/**
 * Nettoyer sessions expirées utilisateur
 * @param {string} userId - ID utilisateur
 * @returns {Object} - Résultat nettoyage
 */
const cleanExpiredSessions = async (userId) => {
  try {
    const user = await User.findById(userId);

    if (!user) {
      throw new Error('Utilisateur non trouvé');
    }

    const before = user.activeSessions.length;

    // Nettoyer sessions et refresh tokens expirés
    await user.cleanExpiredSessions();

    const after = user.activeSessions.length;
    const cleaned = before - after;

    return {
      success: true,
      message: `${cleaned} sessions expirées supprimées`,
      sessionsRemoved: cleaned,
      activeSessions: after
    };

  } catch (error) {
    throw new Error(`Erreur nettoyage sessions: ${error.message}`);
  }
};

// ===================================================================
// EXPORTS
// ===================================================================
module.exports = {
  // Authentification principale
  registerUser,
  loginUser,
  refreshTokens,
  logoutUser,
  logoutAllSessions,

  // Validation et permissions
  validateAccessToken,
  checkUserPermissions,

  // Gestion mots de passe
  generatePasswordResetToken,
  resetPassword,
  changePassword,

  // Gestion sessions
  getUserSessions,
  cleanExpiredSessions
};