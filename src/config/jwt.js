// src/config/jwt.js - Configuration JWT FinApp Haiti
const jwt = require('jsonwebtoken');

/**
 * Configuration JWT pour authentification FinApp Haiti
 * Intégration avec User.js sessions multi-device
 */

// ===================================================================
// CONFIGURATION JWT
// ===================================================================
const JWT_CONFIG = {
  // Secrets depuis variables environnement
  ACCESS_SECRET: process.env.JWT_SECRET || 'finapp_haiti_dev_secret_change_in_production',
  REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'finapp_haiti_refresh_dev_secret_change_in_production',
  
  // Durées des tokens
  ACCESS_EXPIRES_IN: process.env.JWT_EXPIRE || '15m',  // 15 minutes
  REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRE || '7d',  // 7 jours
  
  // Configuration avancée
  ALGORITHM: 'HS256',
  ISSUER: 'finapp-haiti',
  AUDIENCE: 'finapp-haiti-users'
};

// ===================================================================
// GÉNÉRATION TOKENS
// ===================================================================

/**
 * Générer Access Token JWT
 * @param {Object} payload - Données utilisateur à inclure
 * @param {Object} options - Options supplémentaires
 * @returns {string} - JWT access token
 */
const generateAccessToken = (payload, options = {}) => {
  try {
    const tokenPayload = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role || 'user',
      sessionId: payload.sessionId, // Pour tracking session User.js
      deviceInfo: payload.deviceInfo || {},
      // Pas d'infos sensibles dans access token
      iat: Math.floor(Date.now() / 1000)
    };
    
    const jwtOptions = {
      expiresIn: options.expiresIn || JWT_CONFIG.ACCESS_EXPIRES_IN,
      algorithm: JWT_CONFIG.ALGORITHM,
      issuer: JWT_CONFIG.ISSUER,
      audience: JWT_CONFIG.AUDIENCE,
      ...options
    };
    
    return jwt.sign(tokenPayload, JWT_CONFIG.ACCESS_SECRET, jwtOptions);
    
  } catch (error) {
    throw new Error(`Erreur génération access token: ${error.message}`);
  }
};

/**
 * Générer Refresh Token JWT
 * @param {Object} payload - Données utilisateur minimales
 * @param {Object} options - Options supplémentaires
 * @returns {string} - JWT refresh token
 */
const generateRefreshToken = (payload, options = {}) => {
  try {
    const tokenPayload = {
      userId: payload.userId,
      sessionId: payload.sessionId,
      tokenVersion: payload.tokenVersion || 1, // Pour invalidation
      deviceId: payload.deviceId, // Device fingerprint
      iat: Math.floor(Date.now() / 1000)
    };
    
    const jwtOptions = {
      expiresIn: options.expiresIn || JWT_CONFIG.REFRESH_EXPIRES_IN,
      algorithm: JWT_CONFIG.ALGORITHM,
      issuer: JWT_CONFIG.ISSUER,
      audience: JWT_CONFIG.AUDIENCE,
      ...options
    };
    
    return jwt.sign(tokenPayload, JWT_CONFIG.REFRESH_SECRET, jwtOptions);
    
  } catch (error) {
    throw new Error(`Erreur génération refresh token: ${error.message}`);
  }
};

/**
 * Générer paire de tokens (access + refresh)
 * @param {Object} user - Objet utilisateur User.js
 * @param {Object} deviceInfo - Informations device
 * @returns {Object} - { accessToken, refreshToken, expiresIn }
 */
const generateTokenPair = (user, deviceInfo = {}) => {
  try {
    const crypto = require('crypto');
    const sessionId = crypto.randomUUID();
    const deviceId = generateDeviceId(deviceInfo);
    
    const payload = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      sessionId,
      deviceId,
      deviceInfo
    };
    
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);
    
    // Calculer expiration en timestamp
    const accessExpiresIn = parseExpiration(JWT_CONFIG.ACCESS_EXPIRES_IN);
    const refreshExpiresIn = parseExpiration(JWT_CONFIG.REFRESH_EXPIRES_IN);
    
    return {
      accessToken,
      refreshToken,
      accessExpiresIn,
      refreshExpiresIn,
      sessionId,
      deviceId,
      tokenType: 'Bearer'
    };
    
  } catch (error) {
    throw new Error(`Erreur génération paire tokens: ${error.message}`);
  }
};

// ===================================================================
// VÉRIFICATION TOKENS
// ===================================================================

/**
 * Vérifier Access Token
 * @param {string} token - JWT access token
 * @returns {Object} - Payload décodé ou null si invalide
 */
const verifyAccessToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_CONFIG.ACCESS_SECRET, {
      algorithms: [JWT_CONFIG.ALGORITHM],
      issuer: JWT_CONFIG.ISSUER,
      audience: JWT_CONFIG.AUDIENCE
    });
    
    return {
      isValid: true,
      payload: decoded,
      expired: false
    };
    
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return {
        isValid: false,
        payload: null,
        expired: true,
        error: 'Token expiré'
      };
    }
    
    if (error.name === 'JsonWebTokenError') {
      return {
        isValid: false,
        payload: null,
        expired: false,
        error: 'Token invalide'
      };
    }
    
    return {
      isValid: false,
      payload: null,
      expired: false,
      error: error.message
    };
  }
};

/**
 * Vérifier Refresh Token
 * @param {string} token - JWT refresh token
 * @returns {Object} - Payload décodé ou null si invalide
 */
const verifyRefreshToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_CONFIG.REFRESH_SECRET, {
      algorithms: [JWT_CONFIG.ALGORITHM],
      issuer: JWT_CONFIG.ISSUER,
      audience: JWT_CONFIG.AUDIENCE
    });
    
    return {
      isValid: true,
      payload: decoded,
      expired: false
    };
    
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return {
        isValid: false,
        payload: null,
        expired: true,
        error: 'Refresh token expiré'
      };
    }
    
    return {
      isValid: false,
      payload: null,
      expired: false,
      error: error.message
    };
  }
};

/**
 * Décoder token sans vérification (pour debug)
 * @param {string} token - JWT token
 * @returns {Object} - Payload décodé ou null
 */
const decodeToken = (token) => {
  try {
    return jwt.decode(token, { complete: true });
  } catch (error) {
    return null;
  }
};

// ===================================================================
// UTILITAIRES
// ===================================================================

/**
 * Générer Device ID basé sur informations device
 * @param {Object} deviceInfo - User agent, IP, etc.
 * @returns {string} - Device ID unique
 */
const generateDeviceId = (deviceInfo) => {
  const crypto = require('crypto');
  
  const deviceString = [
    deviceInfo.userAgent || '',
    deviceInfo.ip || '',
    deviceInfo.platform || '',
    deviceInfo.browser || ''
  ].join('|');
  
  return crypto.createHash('sha256').update(deviceString).digest('hex').substring(0, 16);
};

/**
 * Parser durée expiration en millisecondes
 * @param {string} duration - Durée format JWT (15m, 7d, etc.)
 * @returns {number} - Timestamp expiration
 */
const parseExpiration = (duration) => {
  const now = Date.now();
  
  // Parse format JWT (15m, 7d, 1h, etc.)
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) return now + (15 * 60 * 1000); // Default 15 minutes
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  const multipliers = {
    s: 1000,           // seconds
    m: 60 * 1000,      // minutes
    h: 60 * 60 * 1000, // hours
    d: 24 * 60 * 60 * 1000 // days
  };
  
  return now + (value * multipliers[unit]);
};

/**
 * Vérifier si token expire bientôt
 * @param {Object} payload - Payload JWT décodé
 * @param {number} thresholdMinutes - Seuil en minutes
 * @returns {boolean} - True si expire bientôt
 */
const isTokenExpiringSoon = (payload, thresholdMinutes = 5) => {
  if (!payload.exp) return false;
  
  const expirationTime = payload.exp * 1000; // Convert to milliseconds
  const thresholdTime = Date.now() + (thresholdMinutes * 60 * 1000);
  
  return expirationTime <= thresholdTime;
};

/**
 * Extraire infos utilisateur du token
 * @param {string} token - JWT token
 * @returns {Object} - Infos utilisateur ou null
 */
const extractUserFromToken = (token) => {
  const verification = verifyAccessToken(token);
  
  if (!verification.isValid) return null;
  
  return {
    userId: verification.payload.userId,
    email: verification.payload.email,
    role: verification.payload.role,
    sessionId: verification.payload.sessionId,
    deviceInfo: verification.payload.deviceInfo
  };
};

/**
 * Valider format token Bearer
 * @param {string} authHeader - Header Authorization
 * @returns {string|null} - Token extrait ou null
 */
const extractBearerToken = (authHeader) => {
  if (!authHeader) return null;
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  
  return parts[1];
};

/**
 * Générer token temporaire (pour reset password, email verification)
 * @param {Object} payload - Données à inclure
 * @param {string} duration - Durée (ex: '1h', '24h')
 * @returns {string} - Token temporaire
 */
const generateTemporaryToken = (payload, duration = '1h') => {
  try {
    const tokenPayload = {
      ...payload,
      type: 'temporary',
      iat: Math.floor(Date.now() / 1000)
    };
    
    return jwt.sign(tokenPayload, JWT_CONFIG.ACCESS_SECRET, {
      expiresIn: duration,
      algorithm: JWT_CONFIG.ALGORITHM,
      issuer: JWT_CONFIG.ISSUER,
      audience: JWT_CONFIG.AUDIENCE
    });
    
  } catch (error) {
    throw new Error(`Erreur génération token temporaire: ${error.message}`);
  }
};

/**
 * Health check configuration JWT
 * @returns {Object} - Status configuration
 */
const getJWTHealthCheck = () => {
  return {
    status: 'OK',
    config: {
      algorithm: JWT_CONFIG.ALGORITHM,
      issuer: JWT_CONFIG.ISSUER,
      audience: JWT_CONFIG.AUDIENCE,
      accessExpiration: JWT_CONFIG.ACCESS_EXPIRES_IN,
      refreshExpiration: JWT_CONFIG.REFRESH_EXPIRES_IN
    },
    secrets: {
      accessSecretConfigured: !!JWT_CONFIG.ACCESS_SECRET,
      refreshSecretConfigured: !!JWT_CONFIG.REFRESH_SECRET,
      usingDefaults: JWT_CONFIG.ACCESS_SECRET.includes('dev_secret')
    }
  };
};

// ===================================================================
// EXPORTS
// ===================================================================
module.exports = {
  // Configuration
  JWT_CONFIG,
  
  // Génération tokens
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,
  generateTemporaryToken,
  
  // Vérification tokens
  verifyAccessToken,
  verifyRefreshToken,
  decodeToken,
  
  // Utilitaires
  generateDeviceId,
  parseExpiration,
  isTokenExpiringSoon,
  extractUserFromToken,
  extractBearerToken,
  getJWTHealthCheck
};