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

const router = express.Router();

/**
 * Routes utilisateurs FinApp Haiti
 * 
 * Structure :
 * - Routes utilisateur (auth requis) : profil, mise à jour, préférences, suppression
 * - Routes admin (admin uniquement) : liste utilisateurs, statistiques, gestion
 * 
 * Sécurité :
 * - Authentification obligatoire pour toutes les routes
 * - Rate limiting adapté par type d'opération
 * - Permissions granulaires (user vs admin)
 * - Validation express-validator dans controllers
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
 * @access  Private (authentification requise)
 * @middleware standardAuth (auth + logging + monitoring)
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Response: {
 *   success: true,
 *   message: "Profil récupéré avec succès",
 *   data: {
 *     user: UserObject,
 *     stats: {
 *       accountAge: number,
 *       lastLoginDays: number,
 *       activeSessions: number
 *     }
 *   }
 * }
 */
router.get('/profile',
  ...standardAuth, // authenticate + generalAuthLimiter + logging + monitoring
  userController.getUserProfile
);

/**
 * @route   PUT /api/users/profile
 * @desc    Mettre à jour profil utilisateur
 * @access  Private (authentification requise)
 * @middleware authenticate + profileUpdateLimiter + validation
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Body: {
 *   firstName?: string,
 *   lastName?: string,
 *   phone?: string,
 *   region?: string,
 *   city?: string,
 *   bio?: string,
 *   defaultCurrency?: string,
 *   language?: string,
 *   theme?: string
 * }
 * 
 * Response: {
 *   success: true,
 *   message: "Profil mis à jour avec succès",
 *   data: {
 *     user: UserObject
 *   }
 * }
 */
router.put('/profile',
  authenticate,
  profileUpdateLimiter,
  userController.updateUserProfile // Includes validation middleware
);

/**
 * @route   PUT /api/users/notification-preferences
 * @desc    Mettre à jour préférences notifications
 * @access  Private (authentification requise)
 * @middleware standardAuth + userOperationsLimiter
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Body: {
 *   email?: boolean,
 *   push?: boolean,
 *   budgetAlerts?: boolean,
 *   solReminders?: boolean,
 *   investmentUpdates?: boolean,
 *   reminderDaysBefore?: number
 * }
 * 
 * Response: {
 *   success: true,
 *   message: "Préférences de notification mises à jour avec succès",
 *   data: {
 *     notificationPreferences: Object
 *   }
 * }
 */
router.put('/notification-preferences',
  authenticate,
  userOperationsLimiter,
  userController.updateNotificationPreferences // Includes validation
);

/**
 * @route   DELETE /api/users/profile
 * @desc    Supprimer compte utilisateur (soft delete)
 * @access  Private (authentification requise)
 * @middleware authenticate + accountDeletionLimiter
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Body: {
 *   confirmDelete: boolean,
 *   reason?: string
 * }
 * 
 * Response: {
 *   success: true,
 *   message: "Compte supprimé avec succès",
 *   data: {
 *     deletedAt: Date,
 *     reason: string
 *   }
 * }
 */
router.delete('/profile',
  authenticate,
  accountDeletionLimiter,
  userController.deleteUserAccount
);

// ===================================================================
// ROUTES ADMINISTRATIVES (ADMIN SEULEMENT)
// ===================================================================

/**
 * @route   GET /api/users/admin/list
 * @desc    Lister tous les utilisateurs avec pagination et filtres
 * @access  Private (admin seulement)
 * @middleware adminAuth (auth + admin role + admin rate limiting)
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Query Parameters: {
 *   page?: number,
 *   limit?: number,
 *   search?: string,
 *   region?: string,
 *   role?: string,
 *   isActive?: boolean,
 *   sortBy?: string,
 *   sortOrder?: 'asc'|'desc'
 * }
 * 
 * Response: {
 *   success: true,
 *   message: "Utilisateurs récupérés avec succès",
 *   data: {
 *     users: [UserObject],
 *     pagination: PaginationObject,
 *     stats: StatsObject
 *   }
 * }
 */
router.get('/admin/list',
  ...adminAuth, // authenticate + requireRole('admin') + adminLimiter + logging
  userController.getAllUsers
);

/**
 * @route   GET /api/users/admin/stats/regions
 * @desc    Statistiques utilisateurs par région haïtienne
 * @access  Private (admin seulement)
 * @middleware adminAuth
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Response: {
 *   success: true,
 *   message: "Statistiques par région récupérées avec succès",
 *   data: {
 *     regionStats: [
 *       { _id: "ouest", count: number },
 *       { _id: "nord", count: number },
 *       ...
 *     ],
 *     totalRegions: number
 *   }
 * }
 */
router.get('/admin/stats/regions',
  ...adminAuth,
  userController.getUserStatsByRegion
);

/**
 * @route   PUT /api/users/admin/:userId
 * @desc    Mettre à jour utilisateur (admin uniquement)
 * @access  Private (admin seulement)
 * @middleware adminAuth + strict rate limiting
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Params: {
 *   userId: string
 * }
 * 
 * Body: {
 *   firstName?: string,
 *   lastName?: string,
 *   phone?: string,
 *   region?: string,
 *   city?: string,
 *   role?: string,
 *   isVerified?: boolean,
 *   isActive?: boolean,
 *   bio?: string
 * }
 * 
 * Response: {
 *   success: true,
 *   message: "Utilisateur mis à jour avec succès par admin",
 *   data: {
 *     user: UserObject
 *   }
 * }
 */
router.put('/admin/:userId',
  authenticate,
  requireRole('admin'),
  strictAuthLimiter, // Rate limiting strict pour modifications admin
  userController.updateUserByAdmin
);

/**
 * @route   GET /api/users/admin/stats/overview
 * @desc    Vue d'ensemble statistiques utilisateurs (admin)
 * @access  Private (admin seulement)
 * @middleware adminAuth
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Response: {
 *   success: true,
 *   message: "Statistiques générales récupérées avec succès",
 *   data: {
 *     totalUsers: number,
 *     activeUsers: number,
 *     verifiedUsers: number,
 *     newUsersThisMonth: number,
 *     usersByRegion: Array,
 *     userGrowthTrend: Array
 *   }
 * }
 */
router.get('/admin/stats/overview',
  ...adminAuth,
  async (req, res) => {
    try {
      const User = require('../models/User');
      
      // Statistiques générales
      const [generalStats, regionStats] = await Promise.all([
        User.aggregate([
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
        ]),
        User.getRegionStats()
      ]);
      
      // Tendance de croissance (derniers 6 mois)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      const growthTrend = await User.aggregate([
        { $match: { createdAt: { $gte: sixMonthsAgo }, isDeleted: false } },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]);
      
      res.status(200).json({
        success: true,
        message: 'Statistiques générales récupérées avec succès',
        data: {
          ...(generalStats[0] || {
            totalUsers: 0,
            activeUsers: 0,
            verifiedUsers: 0,
            newUsersThisMonth: 0
          }),
          usersByRegion: regionStats,
          userGrowthTrend: growthTrend
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Erreur stats overview:', error.message);
      
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des statistiques',
        error: 'stats_overview_error',
        timestamp: new Date().toISOString()
      });
    }
  }
);

// ===================================================================
// ROUTES UTILITAIRES & VALIDATION
// ===================================================================

/**
 * @route   GET /api/users/validate/email/:email
 * @desc    Vérifier disponibilité email (pour formulaires)
 * @access  Private (authentification requise)
 * @middleware authenticate + userOperationsLimiter
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Params: {
 *   email: string
 * }
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     available: boolean,
 *     email: string
 *   }
 * }
 */
router.get('/validate/email/:email',
  authenticate,
  userOperationsLimiter,
  async (req, res) => {
    try {
      const { email } = req.params;
      const currentUserId = req.user.userId;
      
      // Validation format email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: 'Format email invalide',
          error: 'invalid_email_format',
          timestamp: new Date().toISOString()
        });
      }
      
      const User = require('../models/User');
      const existingUser = await User.findOne({ 
        email: email.toLowerCase(),
        _id: { $ne: currentUserId }, // Exclure l'utilisateur courant
        isDeleted: false 
      });
      
      res.status(200).json({
        success: true,
        data: {
          available: !existingUser,
          email: email.toLowerCase()
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Erreur validate email:', error.message);
      
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la validation email',
        error: 'email_validation_error',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * @route   GET /api/users/validate/phone/:phone
 * @desc    Vérifier disponibilité téléphone
 * @access  Private (authentification requise)
 * @middleware authenticate + userOperationsLimiter
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Params: {
 *   phone: string
 * }
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     available: boolean,
 *     phone: string,
 *     formatted: string
 *   }
 * }
 */
router.get('/validate/phone/:phone',
  authenticate,
  userOperationsLimiter,
  async (req, res) => {
    try {
      const { phone } = req.params;
      const currentUserId = req.user.userId;
      
      // Normalisation téléphone haïtien
      let normalizedPhone = phone.trim();
      if (normalizedPhone.length === 8 && /^[0-9]{8}$/.test(normalizedPhone)) {
        normalizedPhone = '+509' + normalizedPhone;
      }
      
      // Validation format
      const phoneRegex = /^(\+509)?[0-9]{8}$/;
      if (!phoneRegex.test(normalizedPhone.replace('+509', ''))) {
        return res.status(400).json({
          success: false,
          message: 'Format téléphone haïtien invalide',
          error: 'invalid_phone_format',
          timestamp: new Date().toISOString()
        });
      }
      
      const User = require('../models/User');
      const existingUser = await User.findOne({ 
        phone: normalizedPhone,
        _id: { $ne: currentUserId },
        isDeleted: false 
      });
      
      res.status(200).json({
        success: true,
        data: {
          available: !existingUser,
          phone: phone,
          formatted: normalizedPhone
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Erreur validate phone:', error.message);
      
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la validation téléphone',
        error: 'phone_validation_error',
        timestamp: new Date().toISOString()
      });
    }
  }
);

// ===================================================================
// ROUTE INFO & DOCUMENTATION
// ===================================================================

/**
 * @route   GET /api/users
 * @desc    Information sur les endpoints utilisateurs disponibles
 * @access  Private (authentification requise)
 * @middleware authenticate + generalAuthLimiter
 * 
 * Headers: {
 *   Authorization: "Bearer <accessToken>"
 * }
 * 
 * Response: {
 *   success: true,
 *   data: {
 *     service: "users",
 *     version: "1.0.0",
 *     endpoints: Object
 *   }
 * }
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
            updateProfile: 'PUT /api/users/profile',
            notificationPreferences: 'PUT /api/users/notification-preferences',
            deleteAccount: 'DELETE /api/users/profile',
            validateEmail: 'GET /api/users/validate/email/:email',
            validatePhone: 'GET /api/users/validate/phone/:phone'
          },
          ...(userRole === 'admin' && {
            admin: {
              listUsers: 'GET /api/users/admin/list',
              regionStats: 'GET /api/users/admin/stats/regions',
              overview: 'GET /api/users/admin/stats/overview',
              updateUser: 'PUT /api/users/admin/:userId'
            }
          })
        },
        rateLimits: {
          general: '50 / 15 minutes',
          profileUpdate: '10 / 1 hour',
          accountDeletion: '3 / 24 hours',
          admin: '100 / 5 minutes'
        },
        security: {
          authentication: 'JWT Bearer token required',
          authorization: 'Role-based access control',
          rateLimit: 'User-based limiting',
          validation: 'Express-validator with Haiti context'
        }
      },
      timestamp: new Date().toISOString()
    });
  }
);

// ===================================================================
// ERROR HANDLING SPÉCIALISÉ USERS
// ===================================================================

/**
 * Middleware d'erreur spécialisé pour les routes users
 * Gère les erreurs spécifiques aux opérations utilisateurs
 */
router.use((error, req, res, next) => {
  console.error('❌ Erreur routes users:', error.message);
  
  // Erreur validation Mongoose
  if (error.name === 'ValidationError') {
    const validationErrors = {};
    Object.keys(error.errors).forEach(key => {
      validationErrors[key] = [error.errors[key].message];
    });
    
    return res.status(400).json({
      success: false,
      message: 'Erreurs de validation',
      errors: validationErrors,
      timestamp: new Date().toISOString()
    });
  }
  
  // Erreur MongoDB duplicate key
  if (error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    const fieldName = field === 'email' ? 'Email' : 'Téléphone';
    
    return res.status(400).json({
      success: false,
      message: `${fieldName} déjà utilisé`,
      error: 'duplicate_field',
      field: field,
      timestamp: new Date().toISOString()
    });
  }
  
  // Erreur ObjectId invalide
  if (error.name === 'CastError' && error.kind === 'ObjectId') {
    return res.status(400).json({
      success: false,
      message: 'ID utilisateur invalide',
      error: 'invalid_user_id',
      timestamp: new Date().toISOString()
    });
  }
  
  // Erreur générale
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Erreur interne du service utilisateurs',
    error: 'users_service_error',
    timestamp: new Date().toISOString()
  });
});

// ===================================================================
// EXPORTS
// ===================================================================
module.exports = router;