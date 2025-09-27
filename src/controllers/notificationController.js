// src/controllers/notificationController.js
// Controller pour gestion des notifications - FinApp Haiti
// Gère les requêtes HTTP pour le système de notifications

const NotificationService = require('../services/notificationService');
const Notification = require('../models/Notification');
const mongoose = require('mongoose');

class NotificationController {

  // ===================================================================
  // RÉCUPÉRATION NOTIFICATIONS
  // ===================================================================

  /**
   * Récupérer toutes les notifications de l'utilisateur
   * GET /api/notifications
   * @access Private (authentification requise)
   */
  static async getUserNotifications(req, res) {
    try {
      const userId = req.user.userId;
      const {
        status,
        source,
        priority,
        limit = 50,
        page = 1
      } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const result = await NotificationService.getUserNotifications(userId, {
        status,
        source,
        priority,
        limit: parseInt(limit),
        skip
      });

      res.status(200).json({
        success: true,
        message: 'Notifications récupérées avec succès',
        data: {
          notifications: result.notifications,
          pagination: {
            total: result.total,
            unreadCount: result.unreadCount,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(result.total / parseInt(limit))
          }
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur getUserNotifications:', error.message);

      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des notifications',
        error: 'notifications_fetch_error',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Récupérer une notification spécifique
   * GET /api/notifications/:id
   * @access Private (authentification requise + ownership)
   */
  static async getNotificationById(req, res) {
    try {
      const userId = req.user.userId;
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: 'ID de notification invalide',
          error: 'invalid_notification_id',
          timestamp: new Date().toISOString()
        });
      }

      const notification = await Notification.findOne({
        _id: id,
        user: userId
      });

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification non trouvée',
          error: 'notification_not_found',
          timestamp: new Date().toISOString()
        });
      }

      res.status(200).json({
        success: true,
        message: 'Notification récupérée avec succès',
        data: { notification },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur getNotificationById:', error.message);

      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération de la notification',
        error: 'notification_fetch_error',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Récupérer notifications non lues
   * GET /api/notifications/unread
   * @access Private (authentification requise)
   */
  static async getUnreadNotifications(req, res) {
    try {
      const userId = req.user.userId;
      const { limit = 50 } = req.query;

      const notifications = await Notification.getUnread(userId, parseInt(limit));

      res.status(200).json({
        success: true,
        message: 'Notifications non lues récupérées avec succès',
        data: {
          notifications,
          count: notifications.length
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur getUnreadNotifications:', error.message);

      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des notifications non lues',
        error: 'unread_notifications_error',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Compter notifications non lues par type
   * GET /api/notifications/unread/count-by-type
   * @access Private (authentification requise)
   */
  static async countUnreadByType(req, res) {
    try {
      const userId = req.user.userId;

      const counts = await Notification.countUnreadByType(userId);

      // Transformer résultat aggregation en objet
      const countsByType = {};
      counts.forEach(item => {
        countsByType[item._id] = item.count;
      });

      const totalUnread = counts.reduce((sum, item) => sum + item.count, 0);

      res.status(200).json({
        success: true,
        message: 'Compteurs récupérés avec succès',
        data: {
          byType: countsByType,
          total: totalUnread
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur countUnreadByType:', error.message);

      res.status(500).json({
        success: false,
        message: 'Erreur lors du comptage des notifications',
        error: 'count_notifications_error',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Récupérer notifications par priorité
   * GET /api/notifications/priority/:priority
   * @access Private (authentification requise)
   */
  static async getByPriority(req, res) {
    try {
      const userId = req.user.userId;
      const { priority } = req.params;

      const validPriorities = ['low', 'medium', 'high', 'urgent'];
      if (!validPriorities.includes(priority)) {
        return res.status(400).json({
          success: false,
          message: 'Priorité invalide',
          error: 'invalid_priority',
          validPriorities,
          timestamp: new Date().toISOString()
        });
      }

      const notifications = await Notification.getByPriority(userId, priority);

      res.status(200).json({
        success: true,
        message: `Notifications ${priority} récupérées avec succès`,
        data: {
          notifications,
          count: notifications.length,
          priority
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur getByPriority:', error.message);

      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération par priorité',
        error: 'priority_fetch_error',
        timestamp: new Date().toISOString()
      });
    }
  }

  // ===================================================================
  // ACTIONS SUR NOTIFICATIONS
  // ===================================================================

  /**
   * Marquer une notification comme lue
   * PUT /api/notifications/:id/read
   * @access Private (authentification requise + ownership)
   */
  static async markAsRead(req, res) {
    try {
      const userId = req.user.userId;
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: 'ID de notification invalide',
          error: 'invalid_notification_id',
          timestamp: new Date().toISOString()
        });
      }

      const notification = await NotificationService.markAsRead(id, userId);

      res.status(200).json({
        success: true,
        message: 'Notification marquée comme lue',
        data: { notification },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur markAsRead:', error.message);

      if (error.message === 'Notification non trouvée') {
        return res.status(404).json({
          success: false,
          message: 'Notification non trouvée',
          error: 'notification_not_found',
          timestamp: new Date().toISOString()
        });
      }

      res.status(500).json({
        success: false,
        message: 'Erreur lors du marquage comme lu',
        error: 'mark_read_error',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Marquer toutes les notifications comme lues
   * PUT /api/notifications/read-all
   * @access Private (authentification requise)
   */
  static async markAllAsRead(req, res) {
    try {
      const userId = req.user.userId;

      const result = await NotificationService.markAllAsRead(userId);

      res.status(200).json({
        success: true,
        message: 'Toutes les notifications ont été marquées comme lues',
        data: {
          modifiedCount: result.modifiedCount
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur markAllAsRead:', error.message);

      res.status(500).json({
        success: false,
        message: 'Erreur lors du marquage global comme lu',
        error: 'mark_all_read_error',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Marquer notification comme actionnée
   * PUT /api/notifications/:id/acted
   * @access Private (authentification requise + ownership)
   */
  static async markAsActed(req, res) {
    try {
      const userId = req.user.userId;
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: 'ID de notification invalide',
          error: 'invalid_notification_id',
          timestamp: new Date().toISOString()
        });
      }

      const notification = await Notification.findOne({
        _id: id,
        user: userId
      });

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification non trouvée',
          error: 'notification_not_found',
          timestamp: new Date().toISOString()
        });
      }

      await notification.markAsActed();

      res.status(200).json({
        success: true,
        message: 'Notification marquée comme actionnée',
        data: { notification },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur markAsActed:', error.message);

      res.status(500).json({
        success: false,
        message: 'Erreur lors du marquage comme actionné',
        error: 'mark_acted_error',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Rejeter/Supprimer une notification
   * DELETE /api/notifications/:id
   * @access Private (authentification requise + ownership)
   */
  static async dismissNotification(req, res) {
    try {
      const userId = req.user.userId;
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: 'ID de notification invalide',
          error: 'invalid_notification_id',
          timestamp: new Date().toISOString()
        });
      }

      const notification = await Notification.findOne({
        _id: id,
        user: userId
      });

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification non trouvée',
          error: 'notification_not_found',
          timestamp: new Date().toISOString()
        });
      }

      await notification.dismiss();

      res.status(200).json({
        success: true,
        message: 'Notification rejetée avec succès',
        data: { notification },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur dismissNotification:', error.message);

      res.status(500).json({
        success: false,
        message: 'Erreur lors du rejet de la notification',
        error: 'dismiss_notification_error',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Supprimer toutes les notifications lues
   * DELETE /api/notifications/read
   * @access Private (authentification requise)
   */
  static async deleteAllRead(req, res) {
    try {
      const userId = req.user.userId;

      const result = await Notification.deleteMany({
        user: userId,
        status: 'read'
      });

      res.status(200).json({
        success: true,
        message: 'Notifications lues supprimées avec succès',
        data: {
          deletedCount: result.deletedCount
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur deleteAllRead:', error.message);

      res.status(500).json({
        success: false,
        message: 'Erreur lors de la suppression des notifications lues',
        error: 'delete_read_error',
        timestamp: new Date().toISOString()
      });
    }
  }

  // ===================================================================
  // PARAMÈTRES & PRÉFÉRENCES
  // ===================================================================

  /**
   * Récupérer préférences de notifications
   * GET /api/notifications/preferences
   * @access Private (authentification requise)
   */
  static async getPreferences(req, res) {
    try {
      const userId = req.user.userId;
      const User = require('../models/User');

      const user = await User.findById(userId).select('notificationPreferences');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé',
          error: 'user_not_found',
          timestamp: new Date().toISOString()
        });
      }

      res.status(200).json({
        success: true,
        message: 'Préférences récupérées avec succès',
        data: {
          preferences: user.notificationPreferences || {}
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur getPreferences:', error.message);

      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des préférences',
        error: 'preferences_fetch_error',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Mettre à jour préférences de notifications
   * PUT /api/notifications/preferences
   * @access Private (authentification requise)
   */
  static async updatePreferences(req, res) {
    try {
      const userId = req.user.userId;
      const preferences = req.body;
      const User = require('../models/User');

      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé',
          error: 'user_not_found',
          timestamp: new Date().toISOString()
        });
      }

      // Mettre à jour préférences
      user.notificationPreferences = {
        ...user.notificationPreferences,
        ...preferences
      };

      await user.save();

      res.status(200).json({
        success: true,
        message: 'Préférences mises à jour avec succès',
        data: {
          preferences: user.notificationPreferences
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur updatePreferences:', error.message);

      res.status(500).json({
        success: false,
        message: 'Erreur lors de la mise à jour des préférences',
        error: 'preferences_update_error',
        timestamp: new Date().toISOString()
      });
    }
  }

  // ===================================================================
  // ANALYTICS & STATISTIQUES
  // ===================================================================

  /**
   * Obtenir statistiques notifications
   * GET /api/notifications/stats
   * @access Private (authentification requise)
   */
  static async getStats(req, res) {
    try {
      const userId = req.user.userId;

      const stats = await Notification.aggregate([
        {
          $match: {
            user: new mongoose.Types.ObjectId(userId)
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            unread: {
              $sum: {
                $cond: [
                  { $in: ['$status', ['pending', 'sent', 'delivered']] },
                  1,
                  0
                ]
              }
            },
            read: {
              $sum: {
                $cond: [{ $eq: ['$status', 'read'] }, 1, 0]
              }
            },
            acted: {
              $sum: {
                $cond: [{ $eq: ['$status', 'acted'] }, 1, 0]
              }
            },
            dismissed: {
              $sum: {
                $cond: [{ $eq: ['$status', 'dismissed'] }, 1, 0]
              }
            },
            byPriority: {
              $push: '$priority'
            },
            bySource: {
              $push: '$source'
            }
          }
        }
      ]);

      const result = stats[0] || {
        total: 0,
        unread: 0,
        read: 0,
        acted: 0,
        dismissed: 0
      };

      // Compter par priorité et source
      const priorityCounts = {};
      const sourceCounts = {};

      if (result.byPriority) {
        result.byPriority.forEach(p => {
          priorityCounts[p] = (priorityCounts[p] || 0) + 1;
        });
      }

      if (result.bySource) {
        result.bySource.forEach(s => {
          sourceCounts[s] = (sourceCounts[s] || 0) + 1;
        });
      }

      res.status(200).json({
        success: true,
        message: 'Statistiques récupérées avec succès',
        data: {
          total: result.total,
          unread: result.unread,
          read: result.read,
          acted: result.acted,
          dismissed: result.dismissed,
          byPriority: priorityCounts,
          bySource: sourceCounts,
          actionRate: result.total > 0 
            ? ((result.acted / result.total) * 100).toFixed(2) + '%'
            : '0%',
          readRate: result.total > 0 
            ? ((result.read / result.total) * 100).toFixed(2) + '%'
            : '0%'
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur getStats:', error.message);

      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des statistiques',
        error: 'stats_error',
        timestamp: new Date().toISOString()
      });
    }
  }

  // ===================================================================
  // MAINTENANCE & SYSTÈME
  // ===================================================================

  /**
   * Tester création notification (développement seulement)
   * POST /api/notifications/test
   * @access Private (authentification requise + dev mode)
   */
  static async testNotification(req, res) {
    try {
      // Sécurité: seulement en développement
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({
          success: false,
          message: 'Endpoint non disponible en production',
          error: 'forbidden',
          timestamp: new Date().toISOString()
        });
      }

      const userId = req.user.userId;
      const { type = 'info', priority = 'medium', title, message } = req.body;

      const notification = await NotificationService.create({
        user: userId,
        source: 'system',
        type,
        title: title || 'Notification Test',
        message: message || 'Ceci est une notification de test',
        priority,
        actionable: true,
        actionUrl: '/dashboard',
        actionLabel: 'Voir',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h
      });

      res.status(201).json({
        success: true,
        message: 'Notification test créée avec succès',
        data: { notification },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur testNotification:', error.message);

      res.status(500).json({
        success: false,
        message: 'Erreur lors de la création de la notification test',
        error: 'test_notification_error',
        timestamp: new Date().toISOString()
      });
    }
  }
}

module.exports = NotificationController;