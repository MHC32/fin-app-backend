// src/routes/users.js - Routes utilisateurs FinApp Haiti
const express = require('express');
const rateLimit = require('express-rate-limit');

// Import controllers et middleware
const userController = require('../controllers/userController');
const { 
  authenticate,
  requireRole,
  requireVerified,
  standardAuth,
  strictAuth,
  adminAuth,
  generalAuthLimiter,
  strictAuthLimiter,
  adminLimiter
} = require('../middleware/auth');

// ✅ NOUVEAU : Import validation centralisée
const { validate, validateObjectId } = require('../middleware/validation');

const router = express.Router();

/**
 * Routes utilisateurs FinApp Haiti
 * 
 * Structure :
 * - Routes utilisateur (auth requis) : profil, mise à jour, préférences, suppression
 * - Routes admin (admin uniquement) : liste utilisateurs, statistiques, gestion
 * - Routes utilitaires : validation email/phone
 * 
 * Sécurité :
 * - Authentification obligatoire pour toutes les routes
 * - Rate limiting adapté par type d'opération
 * - Validation Joi centralisée (validation.js) ✅
 * - Permissions granulaires (user vs admin)
 */

// ===================================================================
// RATE LIMITING SPÉCIALISÉ POUR USERS
// ===================================================================

/**
 * Rate limiter pour opérations utilisateur normales
 */
const userOperationsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 opérations par utilisateur par fenêtre
  message: {
    success: false,
    message: 'Trop d\'opérations utilisateur. Réessayez dans 15 minutes.',
    error: 'user_operations_rate_limit_exceeded',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.userId || req.ip
});

/**
 * Rate limiter pour mises à jour profil (plus restrictif)
 */
const profileUpdateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 10, // 10 mises à jour par utilisateur par heure
  message: {
    success: false,
    message: 'Trop de mises à jour de profil. Réessayez dans 1 heure.',
    error: 'profile_update_rate_limit_exceeded',
    retryAfter: '1 hour'
  },
  keyGenerator: (req) => req.user?.userId || req.ip
});

/**
 * Rate limiter pour suppression compte (très restrictif)
 */
const accountDeletionLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 heures
  max: 3, // 3 tentatives par utilisateur par jour
  message: {
    success: false,
    message: 'Trop de tentatives de suppression. Réessayez dans 24 heures.',
    error: 'account_deletion_rate_limit_exceeded',
    retryAfter: '24 hours'
  },
  keyGenerator: (req) => req.user?.userId || req.ip
});

// ===================================================================
// ROUTES UTILISATEUR (AUTHENTIFICATION REQUISE)
// ===================================================================

/**
 * @route   GET /api/users/profile
 * @desc    Récupérer profil utilisateur connecté
 * @access  Private
 */
router.get('/profile',
  ...standardAuth, // authenticate + generalAuthLimiter + logging + monitoring
  userController.getUserProfile
);

/**
 * @route   PUT /api/users/profile
 * @desc    Mettre à jour profil utilisateur
 * @access  Private
 */
router.put('/profile',
  authenticate,
  profileUpdateLimiter,
  validate('user', 'updateProfile'), // ✅ Validation centralisée
  userController.updateUserProfile
);

/**
 * @route   GET /api/users/profile/stats
 * @desc    Récupérer statistiques utilisateur
 * @access  Private
 */
router.get('/profile/stats',
  authenticate,
  generalAuthLimiter,
  userController.getProfileStats
);

/**
 * @route   PUT /api/users/preferences
 * @desc    Mettre à jour préférences utilisateur
 * @access  Private
 */
router.put('/preferences',
  authenticate,
  userOperationsLimiter,
  validate('user', 'updatePreferences'), // ✅ Validation centralisée
  userController.updatePreferences
);

/**
 * @route   PUT /api/users/notification-preferences
 * @desc    Mettre à jour préférences notifications
 * @access  Private
 */
router.put('/notification-preferences',
  authenticate,
  userOperationsLimiter,
  validate('user', 'updateNotificationPreferences'), // ✅ Validation centralisée
  userController.updateNotificationPreferences
);

/**
 * @route   DELETE /api/users/profile
 * @desc    Supprimer compte utilisateur (soft delete)
 * @access  Private
 */
router.delete('/profile',
  authenticate,
  accountDeletionLimiter,
  validate('user', 'deleteAccount'), // ✅ Validation centralisée
  userController.deleteUserAccount
);

// ===================================================================
// ROUTES ADMIN (ADMIN UNIQUEMENT)
// ===================================================================

/**
 * @route   GET /api/users/admin/list
 * @desc    Lister tous les utilisateurs avec pagination et filtres
 * @access  Private (admin uniquement)
 */
router.get('/admin/list',
  ...adminAuth, // authenticate + requireRole('admin') + adminLimiter + logging
  validate('user', 'adminFilter', 'query'), // ✅ Validation centralisée
  userController.getAllUsers
);

/**
 * @route   GET /api/users/admin/:userId
 * @desc    Récupérer utilisateur par ID (admin)
 * @access  Private (admin uniquement)
 */
router.get('/admin/:userId',
  authenticate,
  requireRole('admin'),
  adminLimiter,
  validateObjectId('userId'), // ✅ Validation ID
  userController.getUserById
);

/**
 * @route   PUT /api/users/admin/:userId
 * @desc    Mettre à jour utilisateur (admin)
 * @access  Private (admin uniquement)
 */
router.put('/admin/:userId',
  authenticate,
  requireRole('admin'),
  strictAuthLimiter,
  validateObjectId('userId'), // ✅ Validation ID
  validate('user', 'adminUpdate'), // ✅ Validation centralisée
  userController.updateUserByAdmin
);

/**
 * @route   PUT /api/users/admin/:userId/activate
 * @desc    Activer compte utilisateur (admin)
 * @access  Private (admin uniquement)
 */
router.put('/admin/:userId/activate',
  authenticate,
  requireRole('admin'),
  adminLimiter,
  validateObjectId('userId'), // ✅ Validation ID
  userController.activateUser
);

/**
 * @route   PUT /api/users/admin/:userId/deactivate
 * @desc    Désactiver compte utilisateur (admin)
 * @access  Private (admin uniquement)
 */
router.put('/admin/:userId/deactivate',
  authenticate,
  requireRole('admin'),
  adminLimiter,
  validateObjectId('userId'), // ✅ Validation ID
  userController.deactivateUser
);

/**
 * @route   GET /api/users/admin/stats/regions
 * @desc    Statistiques utilisateurs par région haïtienne
 * @access  Private (admin uniquement)
 */
router.get('/admin/stats/regions',
  ...adminAuth,
  userController.getUserStatsByRegion
);

/**
 * @route   GET /api/users/admin/stats/overview
 * @desc    Vue d'ensemble statistiques utilisateurs (admin)
 * @access  Private (admin uniquement)
 */
router.get('/admin/stats/overview',
  ...adminAuth,
  userController.getAdminStatsOverview
);

// ===================================================================
// ROUTES UTILITAIRES & VALIDATION
// ===================================================================

/**
 * @route   GET /api/users/validate/email/:email
 * @desc    Vérifier disponibilité email (pour formulaires)
 * @access  Private
 */
router.get('/validate/email/:email',
  authenticate,
  userOperationsLimiter,
  userController.validateEmailAvailability
);

/**
 * @route   GET /api/users/validate/phone/:phone
 * @desc    Vérifier disponibilité téléphone (pour formulaires)
 * @access  Private
 */
router.get('/validate/phone/:phone',
  authenticate,
  userOperationsLimiter,
  userController.validatePhoneAvailability
);

// ===================================================================
// ROUTE INFO & DOCUMENTATION
// ===================================================================

/**
 * @route   GET /api/users
 * @desc    Information sur les endpoints utilisateurs disponibles
 * @access  Private
 */
router.get('/',
  authenticate,
  generalAuthLimiter,
  (req, res) => {
    const userRole = req.user.role;
    
    res.status(200).json({
      success: true,
      message: 'Service utilisateurs FinApp Haiti 🇭🇹',
      data: {
        service: 'users',
        version: '1.0.0',
        description: 'Gestion complète des profils utilisateurs avec sécurité enterprise',
        user: {
          userId: req.user.userId,
          role: userRole,
          region: req.user.region
        },
        endpoints: {
          user: {
            profile: 'GET /api/users/profile',
            profileStats: 'GET /api/users/profile/stats',
            updateProfile: 'PUT /api/users/profile',
            updatePreferences: 'PUT /api/users/preferences',
            notificationPreferences: 'PUT /api/users/notification-preferences',
            deleteAccount: 'DELETE /api/users/profile',
            validateEmail: 'GET /api/users/validate/email/:email',
            validatePhone: 'GET /api/users/validate/phone/:phone'
          },
          ...(userRole === 'admin' && {
            admin: {
              listUsers: 'GET /api/users/admin/list',
              getUser: 'GET /api/users/admin/:userId',
              updateUser: 'PUT /api/users/admin/:userId',
              activateUser: 'PUT /api/users/admin/:userId/activate',
              deactivateUser: 'PUT /api/users/admin/:userId/deactivate',
              regionStats: 'GET /api/users/admin/stats/regions',
              overview: 'GET /api/users/admin/stats/overview'
            }
          })
        },
        rateLimits: {
          operations: '50 / 15 minutes',
          profileUpdate: '10 / 1 hour',
          accountDeletion: '3 / 24 hours',
          adminOperations: '100 / 5 minutes'
        },
        security: {
          authentication: 'JWT required',
          permissions: 'Role-based (user/admin)',
          validation: 'Joi centralized validation', // ✅ Mise à jour
          rateLimit: 'IP and user-based limiting'
        }
      },
      timestamp: new Date().toISOString()
    });
  }
);

// ===================================================================
// EXPORTS
// ===================================================================
module.exports = router;