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
 * 
 * IMPORTANT: Toutes les fonctions retournent des objets {success: boolean}
 * au lieu de lancer des exceptions pour une gestion d'erreur cohérente
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
      return {
        success: false,
        error: 'Un utilisateur avec cet email ou téléphone existe déjà'
      };
    }

    // 2. Créer utilisateur (le hashing du password est fait dans User.js pre-save)
    const user = new User({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.toLowerCase().trim(),
      password: password, // Sera hashé automatiquement par User.js
      phone: phone.trim(),
      region: region.toLowerCase(),
      city: city.trim(),
      registrationDate: new Date(),
      lastLogin: new Date()
    });

    await user.save();

    // 3. Générer tokens et session
    const tokens = generateTokenPair(user, deviceInfo);

    // 4. Ajouter session à User.js
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

    // 5. Ajouter refresh token
    await user.addRefreshToken({
      token: tokens.refreshToken,
      expiresAt: new Date(tokens.refreshExpiresIn),
      deviceInfo: deviceInfo
    });

    // 6. Préparer réponse utilisateur (sans données sensibles)
    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.refreshTokens;
    delete userResponse.activeSessions;
    delete userResponse.verificationToken;
    delete userResponse.resetPasswordToken;

    return {
      success: true,
      message: 'Inscription réussie',
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
    console.error('❌ Erreur enregistrement:', error.message);
    return {
      success: false,
      error: `Erreur enregistrement: ${error.message}`
    };
  }
};

// ===================================================================
// CONNEXION UTILISATEUR
// ===================================================================

/**
 * Connecter un utilisateur
 * @param {string} identifier - Email ou téléphone
 * @param {string} password - Mot de passe
 * @param {Object} deviceInfo - Informations device/IP
 * @returns {Object} - Utilisateur connecté + tokens
 */
const loginUser = async (identifier, password, deviceInfo = {}) => {
  try {
    // 1. Trouver utilisateur par email ou téléphone
    const user = await User.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { phone: identifier }
      ]
    }).select('+password +loginAttempts +lockUntil');

    if (!user) {
      return {
        success: false,
        error: 'Email/téléphone ou mot de passe incorrect'
      };
    }

    // 2. Vérifier si compte verrouillé
    if (user.isAccountLocked) {
      return {
        success: false,
        error: 'Compte temporairement verrouillé. Réessayez plus tard.'
      };
    }

    // 3. Vérifier mot de passe
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      // Incrémenter tentatives de connexion
      await user.incrementLoginAttempts();
      
      return {
        success: false,
        error: 'Email/téléphone ou mot de passe incorrect'
      };
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

    // 10. Préparer réponse utilisateur (sans données sensibles)
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
    console.error('❌ Erreur connexion:', error.message);
    return {
      success: false,
      error: `Erreur connexion: ${error.message}`
    };
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
      return {
        success: false,
        error: verification.error || 'Refresh token invalide'
      };
    }

    const { userId, sessionId } = verification.payload;

    // 2. Trouver utilisateur avec ce refresh token
    const user = await User.findByRefreshToken(refreshToken);

    if (!user) {
      return {
        success: false,
        error: 'Refresh token non trouvé ou expiré'
      };
    }

    // 3. Vérifier que l'utilisateur correspond
    if (user._id.toString() !== userId) {
      return {
        success: false,
        error: 'Refresh token invalide pour cet utilisateur'
      };
    }

    // 4. Trouver la session correspondante
    const session = user.activeSessions.find(s => s.sessionId === sessionId);

    if (!session || !session.isActive) {
      return {
        success: false,
        error: 'Session invalide ou expirée'
      };
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
    console.error('❌ Erreur refresh token:', error.message);
    return {
      success: false,
      error: `Erreur refresh token: ${error.message}`
    };
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
      return {
        success: false,
        error: 'Utilisateur non trouvé'
      };
    }

    // Supprimer session spécifique
    await user.removeSession(sessionId);

    return {
      success: true,
      message: 'Déconnexion réussie'
    };

  } catch (error) {
    console.error('❌ Erreur déconnexion:', error.message);
    return {
      success: false,
      error: `Erreur déconnexion: ${error.message}`
    };
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
      return {
        success: false,
        error: 'Utilisateur non trouvé'
      };
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
    console.error('❌ Erreur déconnexion globale:', error.message);
    return {
      success: false,
      error: `Erreur déconnexion globale: ${error.message}`
    };
  }
};

// ===================================================================
// VALIDATION & VÉRIFICATION - CORRECTION PRINCIPALE
// ===================================================================

/**
 * Valider access token et récupérer utilisateur
 * @param {string} authHeader - Header Authorization
 * @returns {Object} - Résultat validation avec success boolean
 */
const validateAccessToken = async (authHeader) => {
  try {
    // 1. Extraire token du header Bearer
    const token = extractBearerToken(authHeader);

    if (!token) {
      return {
        success: false,
        error: 'Token d\'authentification requis'
      };
    }

    // 2. Vérifier token JWT
    const verification = verifyAccessToken(token);

    if (!verification.isValid) {
      return {
        success: false,
        error: verification.error || 'Token invalide'
      };
    }

    const { userId, sessionId } = verification.payload;

    // 3. Trouver utilisateur
    const user = await User.findById(userId);

    if (!user) {
      return {
        success: false,
        error: 'Utilisateur non trouvé'
      };
    }

    if (!user.isActive) {
      return {
        success: false,
        error: 'Compte utilisateur inactif'
      };
    }

    // 4. Vérifier session active
    const session = user.activeSessions.find(s => s.sessionId === sessionId && s.isActive);

    if (!session) {
      return {
        success: false,
        error: 'Session invalide ou expirée'
      };
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
    console.error('❌ Erreur validation token:', error.message);
    
    return {
      success: false,
      error: `Erreur validation token: ${error.message}`
    };
  }
};

/**
 * Vérifier permissions utilisateur
 * @param {Object} user - Utilisateur à vérifier
 * @param {string|Array} requiredRoles - Rôles requis
 * @returns {boolean} - True si autorisé
 */
const checkUserPermissions = (user, requiredRoles) => {
  try {
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
  } catch (error) {
    console.error('❌ Erreur vérification permissions:', error.message);
    return false;
  }
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
      // Ne pas révéler si email existe pour sécurité
      return {
        success: true,
        message: 'Si cet email existe, un lien de réinitialisation a été envoyé'
      };
    }

    // Générer token temporaire
    const resetToken = generateTemporaryToken();
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 heure

    // Sauvegarder token dans utilisateur
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetExpires;
    await user.save();

    return {
      success: true,
      message: 'Token de réinitialisation généré',
      resetToken: resetToken,
      email: user.email,
      expiresAt: resetExpires
    };

  } catch (error) {
    console.error('❌ Erreur génération token reset:', error.message);
    return {
      success: false,
      error: `Erreur génération token reset: ${error.message}`
    };
  }
};

/**
 * Réinitialiser mot de passe avec token
 * @param {string} resetToken - Token de réinitialisation
 * @param {string} newPassword - Nouveau mot de passe
 * @returns {Object} - Résultat réinitialisation
 */
const resetPassword = async (resetToken, newPassword) => {
  try {
    const user = await User.findOne({
      resetPasswordToken: resetToken,
      resetPasswordExpires: { $gt: Date.now() }
    }).select('+resetPasswordToken +resetPasswordExpires');

    if (!user) {
      return {
        success: false,
        error: 'Token de réinitialisation invalide ou expiré'
      };
    }

    // Hash nouveau mot de passe
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

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
    console.error('❌ Erreur réinitialisation mot de passe:', error.message);
    return {
      success: false,
      error: `Erreur réinitialisation mot de passe: ${error.message}`
    };
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
      return {
        success: false,
        error: 'Utilisateur non trouvé'
      };
    }

    // Vérifier mot de passe actuel
    const isCurrentValid = await bcrypt.compare(currentPassword, user.password);

    if (!isCurrentValid) {
      return {
        success: false,
        error: 'Mot de passe actuel incorrect'
      };
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
    console.error('❌ Erreur changement mot de passe:', error.message);
    return {
      success: false,
      error: `Erreur changement mot de passe: ${error.message}`
    };
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
      return {
        success: false,
        error: 'Utilisateur non trouvé'
      };
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
    console.error('❌ Erreur récupération sessions:', error.message);
    return {
      success: false,
      error: `Erreur récupération sessions: ${error.message}`
    };
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
      return {
        success: false,
        error: 'Utilisateur non trouvé'
      };
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
    console.error('❌ Erreur nettoyage sessions:', error.message);
    return {
      success: false,
      error: `Erreur nettoyage sessions: ${error.message}`
    };
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