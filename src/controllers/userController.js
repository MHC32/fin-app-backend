// src/controllers/userController.js - CRUD Utilisateurs FinApp Haiti
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { HAITI_REGIONS, USER_ROLES } = require('../utils/constants');

/**
 * Controllers CRUD utilisateurs avec authentification intégrée
 * Utilise middleware auth pour protection routes et req.user injection
 */

// ===================================================================
// UTILITAIRES & VALIDATION
// ===================================================================

/**
 * Formater response d'erreur validation
 * @param {Array} errors - Erreurs de validation express-validator
 * @returns {Object} - Erreurs formatées
 */
const formatValidationErrors = (errors) => {
  const formattedErrors = {};
  
  errors.forEach(error => {
    if (!formattedErrors[error.path]) {
      formattedErrors[error.path] = [];
    }
    formattedErrors[error.path].push(error.msg);
  });
  
  return formattedErrors;
};

/**
 * Middleware validation des résultats
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Erreurs de validation',
      errors: formatValidationErrors(errors.array()),
      timestamp: new Date().toISOString()
    });
  }
  
  next();
};

/**
 * Nettoyer les données utilisateur pour la réponse
 * @param {Object} user - Objet utilisateur MongoDB
 * @returns {Object} - Données utilisateur nettoyées
 */
const sanitizeUserData = (user) => {
  const userData = user.toObject ? user.toObject() : user;
  
  // Supprimer les champs sensibles
  delete userData.password;
  delete userData.refreshTokens;
  delete userData.activeSessions;
  delete userData.verificationToken;
  delete userData.resetPasswordToken;
  delete userData.verificationTokenExpires;
  delete userData.resetPasswordExpires;
  delete userData.__v;
  
  return userData;
};

// ===================================================================
// RÈGLES DE VALIDATION
// ===================================================================

/**
 * Règles validation mise à jour profil
 */
const updateProfileValidation = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Le prénom doit contenir entre 2 et 50 caractères')
    .matches(/^[a-zA-ZÀ-ÿ\s-']+$/)
    .withMessage('Le prénom ne peut contenir que des lettres, espaces, tirets et apostrophes'),
    
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Le nom doit contenir entre 2 et 50 caractères')
    .matches(/^[a-zA-ZÀ-ÿ\s-']+$/)
    .withMessage('Le nom ne peut contenir que des lettres, espaces, tirets et apostrophes'),
    
  body('phone')
    .optional()
    .trim()
    .matches(/^(\+509)?[0-9]{8}$/)
    .withMessage('Format de téléphone haïtien invalide (ex: +50932123456 ou 32123456)'),
    
  body('region')
    .optional()
    .isIn(Object.keys(HAITI_REGIONS))
    .withMessage('Région haïtienne invalide'),
    
  body('city')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('La ville doit contenir entre 2 et 50 caractères'),
    
  body('bio')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('La bio ne peut pas dépasser 200 caractères'),
    
  body('defaultCurrency')
    .optional()
    .isIn(['HTG', 'USD', 'EUR'])
    .withMessage('Devise non supportée'),
    
  body('language')
    .optional()
    .isIn(['fr', 'ht', 'en'])
    .withMessage('Langue non supportée'),
    
  body('theme')
    .optional()
    .isIn(['light', 'dark'])
    .withMessage('Thème invalide')
];

/**
 * Règles validation préférences notifications
 */
const updateNotificationPreferencesValidation = [
  body('email')
    .optional()
    .isBoolean()
    .withMessage('La préférence email doit être un booléen'),
    
  body('push')
    .optional()
    .isBoolean()
    .withMessage('La préférence push doit être un booléen'),
    
  body('budgetAlerts')
    .optional()
    .isBoolean()
    .withMessage('La préférence alertes budget doit être un booléen'),
    
  body('solReminders')
    .optional()
    .isBoolean()
    .withMessage('La préférence rappels sol doit être un booléen'),
    
  body('investmentUpdates')
    .optional()
    .isBoolean()
    .withMessage('La préférence mises à jour investissement doit être un booléen'),
    
  body('reminderDaysBefore')
    .optional()
    .isInt({ min: 1, max: 7 })
    .withMessage('Les jours de rappel doivent être entre 1 et 7')
];

/**
 * Règles validation recherche utilisateurs (admin)
 */
const searchUsersValidation = [
  body('search')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('La recherche doit contenir entre 2 et 100 caractères'),
    
  body('region')
    .optional()
    .isIn(Object.keys(HAITI_REGIONS))
    .withMessage('Région invalide'),
    
  body('role')
    .optional()
    .isIn(Object.values(USER_ROLES))
    .withMessage('Rôle invalide'),
    
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('Le statut actif doit être un booléen'),
    
  body('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('La page doit être un entier positif'),
    
  body('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('La limite doit être entre 1 et 100')
];

// ===================================================================
// CONTROLLERS UTILISATEURS
// ===================================================================

/**
 * Récupérer profil utilisateur connecté
 * GET /api/users/profile
 * @access Private (authentification requise)
 */
const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Récupérer utilisateur avec toutes les informations (sans champs sensibles)
    const user = await User.findById(userId)
      .select('-password -refreshTokens -activeSessions -verificationToken -resetPasswordToken');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé',
        error: 'user_not_found',
        timestamp: new Date().toISOString()
      });
    }
    
    // Calculer statistiques utilisateur
    const stats = {
      accountAge: Math.floor((Date.now() - user.createdAt) / (1000 * 60 * 60 * 24)), // jours
      lastLoginDays: user.lastLogin ? Math.floor((Date.now() - user.lastLogin) / (1000 * 60 * 60 * 24)) : null,
      activeSessions: user.activeSessions ? user.activeSessions.length : 0
    };
    
    res.status(200).json({
      success: true,
      message: 'Profil récupéré avec succès',
      data: {
        user: sanitizeUserData(user),
        stats: stats
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Erreur getUserProfile:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du profil',
      error: 'profile_fetch_error',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Mettre à jour profil utilisateur
 * PUT /api/users/profile
 * @access Private (authentification requise)
 */
const updateUserProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const updateData = req.body;
    
    // Vérifier que l'utilisateur existe
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé',
        error: 'user_not_found',
        timestamp: new Date().toISOString()
      });
    }
    
    // Vérifier unicité email/téléphone si modifiés
    if (updateData.email && updateData.email !== user.email) {
      const emailExists = await User.emailExists(updateData.email);
      if (emailExists) {
        return res.status(400).json({
          success: false,
          message: 'Cet email est déjà utilisé',
          error: 'email_already_exists',
          timestamp: new Date().toISOString()
        });
      }
    }
    
    if (updateData.phone && updateData.phone !== user.phone) {
      const phoneExists = await User.phoneExists(updateData.phone);
      if (phoneExists) {
        return res.status(400).json({
          success: false,
          message: 'Ce téléphone est déjà utilisé',
          error: 'phone_already_exists',
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Mettre à jour les champs autorisés
    const allowedFields = [
      'firstName', 'lastName', 'phone', 'region', 'city', 
      'bio', 'defaultCurrency', 'language', 'theme'
    ];
    
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        user[field] = updateData[field];
      }
    });
    
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Profil mis à jour avec succès',
      data: {
        user: sanitizeUserData(user)
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Erreur updateUserProfile:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du profil',
      error: 'profile_update_error',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Mettre à jour préférences notifications
 * PUT /api/users/notification-preferences
 * @access Private (authentification requise)
 */
const updateNotificationPreferences = async (req, res) => {
  try {
    const userId = req.user.userId;
    const preferences = req.body;
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé',
        error: 'user_not_found',
        timestamp: new Date().toISOString()
      });
    }
    
    // Mettre à jour les préférences notifications
    Object.keys(preferences).forEach(key => {
      if (user.notificationPreferences[key] !== undefined) {
        user.notificationPreferences[key] = preferences[key];
      }
    });
    
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Préférences de notification mises à jour avec succès',
      data: {
        notificationPreferences: user.notificationPreferences
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Erreur updateNotificationPreferences:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour des préférences',
      error: 'preferences_update_error',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Supprimer compte utilisateur
 * DELETE /api/users/profile
 * @access Private (authentification requise)
 */
const deleteUserAccount = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { reason = 'user_request', confirmDelete } = req.body;
    
    if (!confirmDelete) {
      return res.status(400).json({
        success: false,
        message: 'Confirmation de suppression requise',
        error: 'confirmation_required',
        timestamp: new Date().toISOString()
      });
    }
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé',
        error: 'user_not_found',
        timestamp: new Date().toISOString()
      });
    }
    
    // Soft delete (marquer comme supprimé)
    user.isDeleted = true;
    user.isActive = false;
    user.deleteReason = reason;
    user.deletedAt = new Date();
    
    // Nettoyer les sessions actives
    user.activeSessions = [];
    user.refreshTokens = [];
    
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Compte supprimé avec succès',
      data: {
        deletedAt: user.deletedAt,
        reason: reason
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Erreur deleteUserAccount:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du compte',
      error: 'account_deletion_error',
      timestamp: new Date().toISOString()
    });
  }
};

// ===================================================================
// CONTROLLERS ADMIN
// ===================================================================

/**
 * Lister tous les utilisateurs (admin seulement)
 * GET /api/users/admin/list
 * @access Private (admin seulement)
 */
const getAllUsers = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      search, 
      region, 
      role, 
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    // Construire query de recherche
    const query = { isDeleted: false };
    
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (region) query.region = region;
    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    
    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };
    
    // Exécuter requêtes
    const [users, totalCount] = await Promise.all([
      User.find(query)
        .select('-password -refreshTokens -activeSessions -verificationToken -resetPasswordToken')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(query)
    ]);
    
    // Statistiques
    const stats = await User.aggregate([
      { $match: { isDeleted: false } },
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          activeUsers: { $sum: { $cond: ['$isActive', 1, 0] } },
          verifiedUsers: { $sum: { $cond: ['$isVerified', 1, 0] } },
          newUsersThisMonth: {
            $sum: {
              $cond: [
                { $gte: ['$createdAt', new Date(new Date().getFullYear(), new Date().getMonth(), 1)] },
                1,
                0
              ]
            }
          }
        }
      }
    ]);
    
    res.status(200).json({
      success: true,
      message: 'Utilisateurs récupérés avec succès',
      data: {
        users: users.map(sanitizeUserData),
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount: totalCount,
          limit: parseInt(limit),
          hasNext: skip + parseInt(limit) < totalCount,
          hasPrev: parseInt(page) > 1
        },
        stats: stats[0] || {
          totalUsers: 0,
          activeUsers: 0,
          verifiedUsers: 0,
          newUsersThisMonth: 0
        }
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Erreur getAllUsers:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des utilisateurs',
      error: 'users_fetch_error',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Récupérer statistiques utilisateurs par région (admin)
 * GET /api/users/admin/stats/regions
 * @access Private (admin seulement)
 */
const getUserStatsByRegion = async (req, res) => {
  try {
    const stats = await User.getRegionStats();
    
    res.status(200).json({
      success: true,
      message: 'Statistiques par région récupérées avec succès',
      data: {
        regionStats: stats,
        totalRegions: stats.length
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Erreur getUserStatsByRegion:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques',
      error: 'stats_fetch_error',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Mettre à jour utilisateur (admin seulement)
 * PUT /api/users/admin/:userId
 * @access Private (admin seulement)
 */
const updateUserByAdmin = async (req, res) => {
  try {
    const { userId } = req.params;
    const updateData = req.body;
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé',
        error: 'user_not_found',
        timestamp: new Date().toISOString()
      });
    }
    
    // Champs que l'admin peut modifier
    const adminAllowedFields = [
      'firstName', 'lastName', 'phone', 'region', 'city',
      'role', 'isVerified', 'isActive', 'bio'
    ];
    
    adminAllowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        user[field] = updateData[field];
      }
    });
    
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Utilisateur mis à jour avec succès par admin',
      data: {
        user: sanitizeUserData(user)
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Erreur updateUserByAdmin:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour utilisateur',
      error: 'admin_update_error',
      timestamp: new Date().toISOString()
    });
  }
};

// ===================================================================
// EXPORTS
// ===================================================================
module.exports = {
  // Controllers utilisateurs
  getUserProfile,
  updateUserProfile: [updateProfileValidation, handleValidationErrors, updateUserProfile],
  updateNotificationPreferences: [updateNotificationPreferencesValidation, handleValidationErrors, updateNotificationPreferences],
  deleteUserAccount,
  
  // Controllers admin
  getAllUsers,
  getUserStatsByRegion,
  updateUserByAdmin,
  
  // Middleware validation
  handleValidationErrors,
  sanitizeUserData
};