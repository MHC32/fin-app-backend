// src/controllers/transactionController.js - CRUD Transactions FinApp Haiti
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const Budget = require('../models/Budget');
const { 
  TRANSACTION_CATEGORIES, 
  TRANSACTION_TYPES, 
  CURRENCIES,
  QUICK_TRANSACTION_TEMPLATES,
  DEFAULTS 
} = require('../utils/constants');

/**
 * Controllers CRUD transactions avec analytics intégrés
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
 * Nettoyer les données transaction pour la réponse
 * @param {Object} transaction - Objet transaction MongoDB
 * @returns {Object} - Données transaction nettoyées
 */
const sanitizeTransactionData = (transaction) => {
  const transactionData = transaction.toObject ? transaction.toObject() : transaction;
  
  // Ajouter données enrichies
  transactionData.categoryInfo = TRANSACTION_CATEGORIES[transactionData.category] || {};
  transactionData.displayAmount = transactionData.displayAmount;
  transactionData.formattedDate = transactionData.formattedDate;
  
  return transactionData;
};

/**
 * Mettre à jour solde compte après transaction
 * @param {Object} account - Compte à mettre à jour
 * @param {Number} amount - Montant (positif pour crédit, négatif pour débit)
 * @param {String} description - Description pour historique
 */
const updateAccountBalance = async (account, amount, description) => {
  try {
    await account.updateBalance(amount, description);
  } catch (error) {
    console.error('❌ Erreur mise à jour solde:', error.message);
    throw new Error('Erreur lors de la mise à jour du solde du compte');
  }
};

/**
 * Mettre à jour budget après transaction
 * @param {String} userId - ID utilisateur
 * @param {String} category - Catégorie transaction
 * @param {Number} amount - Montant dépense
 */
const updateBudgetTracking = async (userId, category, amount) => {
  try {
    // Trouver budget actif pour cette catégorie
    const activeBudget = await Budget.findOne({
      user: userId,
      isActive: true,
      'categories.category': category
    });
    
    if (activeBudget) {
      const alertResult = await activeBudget.addExpense(category, amount);
      return alertResult;
    }
    
    return null;
  } catch (error) {
    console.error('❌ Erreur mise à jour budget:', error.message);
    // Ne pas faire échouer la transaction si le budget fail
    return null;
  }
};

// ===================================================================
// RÈGLES DE VALIDATION
// ===================================================================

/**
 * Règles validation création transaction
 */
const createTransactionValidation = [
  body('amount')
    .notEmpty()
    .withMessage('Le montant est requis')
    .isFloat({ min: 0.01 })
    .withMessage('Le montant doit être positif'),
    
  body('type')
    .notEmpty()
    .withMessage('Le type de transaction est requis')
    .isIn(Object.values(TRANSACTION_TYPES))
    .withMessage('Type de transaction invalide'),
    
  body('description')
    .notEmpty()
    .withMessage('La description est requise')
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('La description doit contenir entre 2 et 200 caractères'),
    
  body('category')
    .notEmpty()
    .withMessage('La catégorie est requise')
    .isIn(Object.keys(TRANSACTION_CATEGORIES))
    .withMessage('Catégorie non valide'),
    
  body('account')
    .notEmpty()
    .withMessage('Le compte est requis')
    .isMongoId()
    .withMessage('ID de compte invalide'),
    
  body('date')
    .optional()
    .isISO8601()
    .withMessage('Format de date invalide'),
    
  body('toAccount')
    .optional()
    .isMongoId()
    .withMessage('ID compte destinataire invalide'),
    
  body('subcategory')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('La sous-catégorie ne peut pas dépasser 50 caractères')
];

/**
 * Règles validation mise à jour transaction
 */
const updateTransactionValidation = [
  body('amount')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Le montant doit être positif'),
    
  body('description')
    .optional()
    .trim()
    .isLength({ min: 2, max: 200 })
    .withMessage('La description doit contenir entre 2 et 200 caractères'),
    
  body('category')
    .optional()
    .isIn(Object.keys(TRANSACTION_CATEGORIES))
    .withMessage('Catégorie non valide'),
    
  body('date')
    .optional()
    .isISO8601()
    .withMessage('Format de date invalide')
];

// ===================================================================
// CONTROLLERS TRANSACTIONS
// ===================================================================

/**
 * Créer une nouvelle transaction
 * POST /api/transactions
 * @access Private (authentification requise)
 */
const createTransaction = [
  ...createTransactionValidation,
  handleValidationErrors,
  async (req, res) => {
    try {
      const userId = req.user.userId;
      const {
        amount,
        type,
        description,
        category,
        subcategory,
        account: accountId,
        toAccount: toAccountId,
        date,
        tags,
        notes,
        location,
        templateUsed
      } = req.body;

      // 1. Vérifier que le compte appartient à l'utilisateur
      const account = await Account.findOne({
        _id: accountId,
        user: userId,
        isActive: true
      });

      if (!account) {
        return res.status(404).json({
          success: false,
          message: 'Compte non trouvé ou inactif',
          error: 'account_not_found',
          timestamp: new Date().toISOString()
        });
      }

      // 2. Vérifier limites de transaction selon le type
      const transactionAmount = type === TRANSACTION_TYPES.EXPENSE ? -amount : amount;
      
      if (type === TRANSACTION_TYPES.EXPENSE && !account.canProcessTransaction(transactionAmount)) {
        return res.status(400).json({
          success: false,
          message: 'Transaction refusée : solde insuffisant ou limites dépassées',
          error: 'insufficient_funds',
          currentBalance: account.currentBalance,
          creditLimit: account.creditLimit,
          timestamp: new Date().toISOString()
        });
      }

      // 3. Traitement spécial pour les transferts
      let toAccount = null;
      if (type === TRANSACTION_TYPES.TRANSFER) {
        if (!toAccountId) {
          return res.status(400).json({
            success: false,
            message: 'Compte destinataire requis pour un transfert',
            error: 'missing_destination_account',
            timestamp: new Date().toISOString()
          });
        }

        toAccount = await Account.findOne({
          _id: toAccountId,
          user: userId,
          isActive: true
        });

        if (!toAccount) {
          return res.status(404).json({
            success: false,
            message: 'Compte destinataire non trouvé',
            error: 'destination_account_not_found',
            timestamp: new Date().toISOString()
          });
        }

        if (accountId === toAccountId) {
          return res.status(400).json({
            success: false,
            message: 'Impossible de transférer vers le même compte',
            error: 'same_account_transfer',
            timestamp: new Date().toISOString()
          });
        }
      }

      // 4. Créer la transaction
      const newTransactionData = {
        user: userId,
        account: accountId,
        amount,
        type,
        description: description.trim(),
        category,
        subcategory: subcategory?.trim(),
        date: date ? new Date(date) : new Date(),
        tags: tags || [],
        notes: notes?.trim(),
        location,
        templateUsed,
        isConfirmed: true // Auto-confirmer pour l'instant
      };

      if (toAccount) {
        newTransactionData.toAccount = toAccountId;
      }

      const transaction = new Transaction(newTransactionData);
      await transaction.save();

      // 5. Mettre à jour le solde du compte source
      await updateAccountBalance(
        account, 
        transactionAmount, 
        `Transaction: ${description}`
      );

      // 6. Pour les transferts, créer transaction inverse et mettre à jour compte destinataire
      if (type === TRANSACTION_TYPES.TRANSFER && toAccount) {
        await transaction.createTransferCounterpart({ name: account.name });
        await updateAccountBalance(
          toAccount, 
          amount, 
          `Transfert depuis ${account.name}`
        );
      }

      // 7. Mettre à jour tracking budget (pour les dépenses seulement)
      if (type === TRANSACTION_TYPES.EXPENSE) {
        await updateBudgetTracking(userId, category, amount);
      }

      // 8. Populer la transaction pour la réponse
      const populatedTransaction = await Transaction.findById(transaction._id)
        .populate('account', 'name bankName type')
        .populate('toAccount', 'name bankName type');

      const transactionData = sanitizeTransactionData(populatedTransaction);

      res.status(201).json({
        success: true,
        message: 'Transaction créée avec succès',
        data: {
          transaction: transactionData
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur createTransaction:', error.message);

      // Gestion erreurs spécifiques
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Erreur de validation des données',
          error: 'validation_error',
          details: error.message,
          timestamp: new Date().toISOString()
        });
      }

      res.status(500).json({
        success: false,
        message: 'Erreur lors de la création de la transaction',
        error: 'transaction_creation_error',
        timestamp: new Date().toISOString()
      });
    }
  }
];

/**
 * Obtenir les transactions de l'utilisateur
 * GET /api/transactions
 * @access Private (authentification requise)
 */
const getUserTransactions = async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      page = 1,
      limit = 50,
      account: accountId,
      category,
      type,
      startDate,
      endDate,
      search,
      sortBy = 'date',
      sortOrder = 'desc'
    } = req.query;

    // Construire la query
    const query = { user: userId };
    
    if (accountId) query.account = accountId;
    if (category) query.category = category;
    if (type) query.type = type;
    
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }
    
    if (search) {
      query.$or = [
        { description: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    // Exécuter requêtes en parallèle
    const [transactions, totalCount] = await Promise.all([
      Transaction.find(query)
        .populate('account', 'name bankName type currency')
        .populate('toAccount', 'name bankName type')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      Transaction.countDocuments(query)
    ]);

    // Calculer statistiques pour la période
    const stats = await Transaction.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
          avgAmount: { $avg: '$amount' }
        }
      }
    ]);

    // Sanitiser les données
    const transactionsData = transactions.map(transaction => 
      sanitizeTransactionData(transaction)
    );

    res.status(200).json({
      success: true,
      data: {
        transactions: transactionsData,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount: totalCount,
          limit: parseInt(limit),
          hasNext: skip + parseInt(limit) < totalCount,
          hasPrev: parseInt(page) > 1
        },
        stats: {
          totalIncome: stats.find(s => s._id === 'income')?.total || 0,
          totalExpense: stats.find(s => s._id === 'expense')?.total || 0,
          totalTransactions: totalCount,
          avgTransactionAmount: stats.reduce((acc, s) => acc + (s.avgAmount || 0), 0) / (stats.length || 1)
        },
        filters: {
          account: accountId,
          category,
          type,
          startDate,
          endDate,
          search
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erreur getUserTransactions:', error.message);

    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des transactions',
      error: 'transactions_fetch_error',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Obtenir une transaction spécifique
 * GET /api/transactions/:transactionId
 * @access Private (authentification requise + ownership)
 */
const getTransactionById = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { transactionId } = req.params;

    // Trouver la transaction
    const transaction = await Transaction.findOne({
      _id: transactionId,
      user: userId
    })
    .populate('account', 'name bankName type currency currentBalance')
    .populate('toAccount', 'name bankName type currency')
    .populate('originalTransaction', 'description amount date');

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction non trouvée',
        error: 'transaction_not_found',
        timestamp: new Date().toISOString()
      });
    }

    // Trouver transactions liées (corrections, transferts)
    const relatedTransactions = await Transaction.find({
      $or: [
        { originalTransaction: transactionId },
        { transferId: transaction.transferId, _id: { $ne: transactionId } }
      ]
    }).populate('account', 'name bankName');

    const transactionData = sanitizeTransactionData(transaction);
    transactionData.relatedTransactions = relatedTransactions.map(t => 
      sanitizeTransactionData(t)
    );

    res.status(200).json({
      success: true,
      data: {
        transaction: transactionData
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erreur getTransactionById:', error.message);

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'ID de transaction invalide',
        error: 'invalid_transaction_id',
        timestamp: new Date().toISOString()
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la transaction',
      error: 'transaction_fetch_error',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Mettre à jour une transaction
 * PUT /api/transactions/:transactionId
 * @access Private (authentification requise + ownership)
 */
const updateTransaction = [
  ...updateTransactionValidation,
  handleValidationErrors,
  async (req, res) => {
    try {
      const userId = req.user.userId;
      const { transactionId } = req.params;
      const updateData = req.body;

      // Trouver la transaction
      const transaction = await Transaction.findOne({
        _id: transactionId,
        user: userId
      }).populate('account');

      if (!transaction) {
        return res.status(404).json({
          success: false,
          message: 'Transaction non trouvée',
          error: 'transaction_not_found',
          timestamp: new Date().toISOString()
        });
      }

      // Empêcher modification de certains champs critiques
      const forbiddenFields = ['user', 'account', 'type', 'transferId'];
      forbiddenFields.forEach(field => delete updateData[field]);

      // Gestion spéciale pour changement de montant
      if (updateData.amount && updateData.amount !== transaction.amount) {
        const oldAmount = transaction.type === TRANSACTION_TYPES.EXPENSE ? 
          -transaction.amount : transaction.amount;
        const newAmount = transaction.type === TRANSACTION_TYPES.EXPENSE ? 
          -updateData.amount : updateData.amount;
        
        const difference = newAmount - oldAmount;
        
        // Mettre à jour solde compte
        await updateAccountBalance(
          transaction.account,
          difference,
          `Correction transaction: ${transaction.description}`
        );
      }

      // Mettre à jour la transaction
      Object.assign(transaction, updateData);
      if (updateData.description) transaction.description = updateData.description.trim();
      if (updateData.subcategory) transaction.subcategory = updateData.subcategory.trim();
      if (updateData.notes) transaction.notes = updateData.notes.trim();

      await transaction.save();

      // Populer pour la réponse
      const updatedTransaction = await Transaction.findById(transaction._id)
        .populate('account', 'name bankName type')
        .populate('toAccount', 'name bankName type');

      const transactionData = sanitizeTransactionData(updatedTransaction);

      res.status(200).json({
        success: true,
        message: 'Transaction mise à jour avec succès',
        data: {
          transaction: transactionData
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur updateTransaction:', error.message);

      res.status(500).json({
        success: false,
        message: 'Erreur lors de la mise à jour de la transaction',
        error: 'transaction_update_error',
        timestamp: new Date().toISOString()
      });
    }
  }
];

/**
 * Supprimer une transaction
 * DELETE /api/transactions/:transactionId
 * @access Private (authentification requise + ownership)
 */
const deleteTransaction = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { transactionId } = req.params;
    const { reason = 'user_request', permanent = false } = req.body;

    // Trouver la transaction
    const transaction = await Transaction.findOne({
      _id: transactionId,
      user: userId
    }).populate('account');

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction non trouvée',
        error: 'transaction_not_found',
        timestamp: new Date().toISOString()
      });
    }

    if (permanent) {
      // Suppression définitive (admin seulement en production)
      // Reverser le solde du compte
      const reversalAmount = transaction.type === TRANSACTION_TYPES.EXPENSE ? 
        transaction.amount : -transaction.amount;
      
      await updateAccountBalance(
        transaction.account,
        reversalAmount,
        `Suppression transaction: ${transaction.description}`
      );

      await Transaction.findByIdAndDelete(transactionId);

      res.status(200).json({
        success: true,
        message: 'Transaction supprimée définitivement',
        data: {
          deletedTransaction: sanitizeTransactionData(transaction)
        },
        timestamp: new Date().toISOString()
      });
    } else {
      // Soft delete
      transaction.isDeleted = true;
      transaction.deletedAt = new Date();
      transaction.deleteReason = reason;
      
      await transaction.save();

      res.status(200).json({
        success: true,
        message: 'Transaction supprimée avec succès',
        data: {
          deletedTransaction: sanitizeTransactionData(transaction)
        },
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('❌ Erreur deleteTransaction:', error.message);

    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de la transaction',
      error: 'transaction_delete_error',
      timestamp: new Date().toISOString()
    });
  }
};

// ===================================================================
// ANALYTICS & STATISTICS
// ===================================================================

/**
 * Analytics par catégorie
 * GET /api/transactions/analytics/categories
 * @access Private (authentification requise)
 */
const getCategoryAnalytics = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { 
      startDate, 
      endDate, 
      type = 'expense',
      limit = 10 
    } = req.query;

    const matchStage = {
      user: new mongoose.Types.ObjectId(userId),
      isConfirmed: true,
      type: type
    };

    if (startDate || endDate) {
      matchStage.date = {};
      if (startDate) matchStage.date.$gte = new Date(startDate);
      if (endDate) matchStage.date.$lte = new Date(endDate);
    }

    const analytics = await Transaction.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$category',
          totalAmount: { $sum: '$amount' },
          transactionCount: { $sum: 1 },
          avgAmount: { $avg: '$amount' },
          lastTransaction: { $max: '$date' }
        }
      },
      {
        $lookup: {
          from: 'transactions',
          let: { category: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$category', '$$category'] },
                    { $eq: ['$user', new mongoose.Types.ObjectId(userId)] }
                  ]
                }
              }
            },
            { $sort: { date: -1 } },
            { $limit: 1 },
            { $project: { description: 1, amount: 1, date: 1 } }
          ],
          as: 'recentTransaction'
        }
      },
      { $sort: { totalAmount: -1 } },
      { $limit: parseInt(limit) }
    ]);

    // Enrichir avec infos catégories
    const enrichedAnalytics = analytics.map(item => ({
      ...item,
      categoryInfo: TRANSACTION_CATEGORIES[item._id] || {},
      recentTransaction: item.recentTransaction[0] || null,
      percentage: 0 // Calculé côté client ou dans une seconde passe
    }));

    // Calculer total pour pourcentages
    const total = analytics.reduce((sum, item) => sum + item.totalAmount, 0);
    enrichedAnalytics.forEach(item => {
      item.percentage = total > 0 ? (item.totalAmount / total) * 100 : 0;
    });

    res.status(200).json({
      success: true,
      data: {
        analytics: enrichedAnalytics,
        summary: {
          totalAmount: total,
          totalCategories: analytics.length,
          period: { startDate, endDate },
          type
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erreur getCategoryAnalytics:', error.message);

    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des analytics',
      error: 'analytics_error',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Statistiques mensuelles
 * GET /api/transactions/analytics/monthly
 * @access Private (authentification requise)
 */
const getMonthlyStats = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { year = new Date().getFullYear(), months = 12 } = req.query;

    // Calculer date de début
    const startDate = new Date(year, new Date().getMonth() - months + 1, 1);
    const endDate = new Date(year, new Date().getMonth() + 1, 0);

    const monthlyStats = await Transaction.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(userId),
          date: { $gte: startDate, $lte: endDate },
          isConfirmed: true
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' },
            type: '$type'
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Restructurer les données par mois
    const monthlyData = {};
    monthlyStats.forEach(stat => {
      const key = `${stat._id.year}-${stat._id.month.toString().padStart(2, '0')}`;
      if (!monthlyData[key]) {
        monthlyData[key] = {
          year: stat._id.year,
          month: stat._id.month,
          income: 0,
          expense: 0,
          transfer: 0,
          incomeCount: 0,
          expenseCount: 0,
          transferCount: 0
        };
      }
      
      monthlyData[key][stat._id.type] = stat.total;
      monthlyData[key][`${stat._id.type}Count`] = stat.count;
    });

    // Calculer net et tendances
    const orderedData = Object.values(monthlyData).map(month => ({
      ...month,
      net: month.income - month.expense,
      totalTransactions: month.incomeCount + month.expenseCount + month.transferCount
    }));

    res.status(200).json({
      success: true,
      data: {
        monthlyStats: orderedData,
        summary: {
          totalMonths: orderedData.length,
          avgMonthlyIncome: orderedData.reduce((sum, m) => sum + m.income, 0) / orderedData.length,
          avgMonthlyExpense: orderedData.reduce((sum, m) => sum + m.expense, 0) / orderedData.length,
          totalNet: orderedData.reduce((sum, m) => sum + m.net, 0)
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erreur getMonthlyStats:', error.message);

    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques mensuelles',
      error: 'monthly_stats_error',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Recherche transactions avancée
 * GET /api/transactions/search
 * @access Private (authentification requise)
 */
const searchTransactions = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { 
      q, 
      limit = 20,
      includeDeleted = false 
    } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Terme de recherche requis (minimum 2 caractères)',
        error: 'invalid_search_term',
        timestamp: new Date().toISOString()
      });
    }

    const searchQuery = {
      user: userId,
      $or: [
        { description: { $regex: q, $options: 'i' } },
        { notes: { $regex: q, $options: 'i' } },
        { tags: { $in: [new RegExp(q, 'i')] } },
        { 'merchant.name': { $regex: q, $options: 'i' } }
      ]
    };

    if (!includeDeleted) {
      searchQuery.isDeleted = { $ne: true };
    }

    // Recherche avec score de pertinence
    const results = await Transaction.find(searchQuery)
      .populate('account', 'name bankName type')
      .sort({ date: -1 })
      .limit(parseInt(limit));

    // Grouper par catégorie pour faciliter la navigation
    const groupedResults = results.reduce((acc, transaction) => {
      const category = transaction.category;
      if (!acc[category]) {
        acc[category] = {
          category,
          categoryInfo: TRANSACTION_CATEGORIES[category] || {},
          transactions: [],
          count: 0,
          totalAmount: 0
        };
      }
      
      acc[category].transactions.push(sanitizeTransactionData(transaction));
      acc[category].count++;
      acc[category].totalAmount += transaction.amount;
      
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      data: {
        searchTerm: q,
        totalResults: results.length,
        transactions: results.map(t => sanitizeTransactionData(t)),
        groupedByCategory: Object.values(groupedResults),
        searchStats: {
          categories: Object.keys(groupedResults).length,
          dateRange: results.length > 0 ? {
            oldest: results[results.length - 1].date,
            newest: results[0].date
          } : null
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erreur searchTransactions:', error.message);

    res.status(500).json({
      success: false,
      message: 'Erreur lors de la recherche',
      error: 'search_error',
      timestamp: new Date().toISOString()
    });
  }
};

// ===================================================================
// ACTIONS SPÉCIALES
// ===================================================================

/**
 * Dupliquer une transaction
 * POST /api/transactions/:transactionId/duplicate
 * @access Private (authentification requise + ownership)
 */
const duplicateTransaction = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { transactionId } = req.params;
    const { 
      adjustments = {}, 
      newDate = new Date(),
      newDescription 
    } = req.body;

    // Trouver transaction originale
    const originalTransaction = await Transaction.findOne({
      _id: transactionId,
      user: userId
    });

    if (!originalTransaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction originale non trouvée',
        error: 'original_transaction_not_found',
        timestamp: new Date().toISOString()
      });
    }

    // Créer copie avec ajustements
    const duplicateData = {
      ...originalTransaction.toObject(),
      _id: undefined,
      createdAt: undefined,
      updatedAt: undefined,
      date: new Date(newDate),
      description: newDescription || `${originalTransaction.description} (copie)`,
      isConfirmed: false, // Nécessite confirmation
      ...adjustments
    };

    // Supprimer champs non dupliquables
    delete duplicateData.transferId;
    delete duplicateData.isReconciled;
    delete duplicateData.reconciledDate;

    const newTransaction = new Transaction(duplicateData);
    await newTransaction.save();

    // Populer pour la réponse
    const populatedTransaction = await Transaction.findById(newTransaction._id)
      .populate('account', 'name bankName type');

    res.status(201).json({
      success: true,
      message: 'Transaction dupliquée avec succès',
      data: {
        originalTransaction: sanitizeTransactionData(originalTransaction),
        duplicatedTransaction: sanitizeTransactionData(populatedTransaction)
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erreur duplicateTransaction:', error.message);

    res.status(500).json({
      success: false,
      message: 'Erreur lors de la duplication',
      error: 'duplicate_error',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Confirmer une transaction en attente
 * PUT /api/transactions/:transactionId/confirm
 * @access Private (authentification requise + ownership)
 */
const confirmTransaction = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { transactionId } = req.params;

    const transaction = await Transaction.findOne({
      _id: transactionId,
      user: userId,
      isConfirmed: false
    }).populate('account');

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction en attente non trouvée',
        error: 'pending_transaction_not_found',
        timestamp: new Date().toISOString()
      });
    }

    // Confirmer et mettre à jour le solde
    await transaction.confirm();
    
    const transactionAmount = transaction.type === TRANSACTION_TYPES.EXPENSE ? 
      -transaction.amount : transaction.amount;
    
    await updateAccountBalance(
      transaction.account,
      transactionAmount,
      `Confirmation: ${transaction.description}`
    );

    res.status(200).json({
      success: true,
      message: 'Transaction confirmée avec succès',
      data: {
        transaction: sanitizeTransactionData(transaction)
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erreur confirmTransaction:', error.message);

    res.status(500).json({
      success: false,
      message: 'Erreur lors de la confirmation',
      error: 'confirm_error',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Ajouter un reçu à une transaction
 * POST /api/transactions/:transactionId/receipt
 * @access Private (authentification requise + ownership)
 */
const addReceipt = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { transactionId } = req.params;
    const { receiptUrl, originalName, size, publicId } = req.body;

    if (!receiptUrl) {
      return res.status(400).json({
        success: false,
        message: 'URL du reçu requise',
        error: 'missing_receipt_url',
        timestamp: new Date().toISOString()
      });
    }

    const transaction = await Transaction.findOne({
      _id: transactionId,
      user: userId
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction non trouvée',
        error: 'transaction_not_found',
        timestamp: new Date().toISOString()
      });
    }

    // Ajouter le reçu
    await transaction.addReceipt({
      url: receiptUrl,
      publicId,
      originalName,
      size
    });

    res.status(200).json({
      success: true,
      message: 'Reçu ajouté avec succès',
      data: {
        transaction: sanitizeTransactionData(transaction)
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erreur addReceipt:', error.message);

    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'ajout du reçu',
      error: 'receipt_error',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Ajouter localisation à une transaction
 * PUT /api/transactions/:transactionId/location
 * @access Private (authentification requise + ownership)
 */
const addLocation = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { transactionId } = req.params;
    const { name, address, latitude, longitude, accuracy } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Coordonnées GPS requises',
        error: 'missing_coordinates',
        timestamp: new Date().toISOString()
      });
    }

    const transaction = await Transaction.findOne({
      _id: transactionId,
      user: userId
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction non trouvée',
        error: 'transaction_not_found',
        timestamp: new Date().toISOString()
      });
    }

    // Ajouter la localisation
    await transaction.addLocation({
      name: name || 'Localisation',
      address,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      accuracy: accuracy ? parseFloat(accuracy) : null
    });

    res.status(200).json({
      success: true,
      message: 'Localisation ajoutée avec succès',
      data: {
        transaction: sanitizeTransactionData(transaction)
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erreur addLocation:', error.message);

    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'ajout de la localisation',
      error: 'location_error',
      timestamp: new Date().toISOString()
    });
  }
};

// ===================================================================
// TEMPLATES & SUGGESTIONS
// ===================================================================

/**
 * Obtenir suggestions basées sur l'historique
 * GET /api/transactions/suggestions
 * @access Private (authentification requise)
 */
const getTransactionSuggestions = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { category, description, limit = 5 } = req.query;

    let matchStage = {
      user: new mongoose.Types.ObjectId(userId),
      isConfirmed: true
    };

    if (category) matchStage.category = category;
    if (description) {
      matchStage.description = { $regex: description, $options: 'i' };
    }

    // Suggestions basées sur fréquence et récence
    const suggestions = await Transaction.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            description: '$description',
            category: '$category',
            amount: '$amount'
          },
          frequency: { $sum: 1 },
          lastUsed: { $max: '$date' },
          avgAmount: { $avg: '$amount' },
          accounts: { $addToSet: '$account' }
        }
      },
      {
        $addFields: {
          score: {
            $add: [
              { $multiply: ['$frequency', 2] }, // Pondération fréquence
              { 
                $divide: [
                  { $subtract: [new Date(), '$lastUsed'] },
                  1000 * 60 * 60 * 24 * 7 // Divisé par semaines
                ]
              }
            ]
          }
        }
      },
      { $sort: { score: -1 } },
      { $limit: parseInt(limit) }
    ]);

    // Enrichir avec infos catégories
    const enrichedSuggestions = suggestions.map(suggestion => ({
      description: suggestion._id.description,
      category: suggestion._id.category,
      categoryInfo: TRANSACTION_CATEGORIES[suggestion._id.category] || {},
      suggestedAmount: Math.round(suggestion.avgAmount),
      frequency: suggestion.frequency,
      lastUsed: suggestion.lastUsed,
      score: suggestion.score,
      commonAccounts: suggestion.accounts
    }));

    // Templates rapides disponibles
    const quickTemplates = Object.entries(QUICK_TRANSACTION_TEMPLATES).map(([key, template]) => ({
      id: key,
      ...template,
      categoryInfo: TRANSACTION_CATEGORIES[template.category] || {}
    }));

    res.status(200).json({
      success: true,
      data: {
        personalSuggestions: enrichedSuggestions,
        quickTemplates: quickTemplates,
        totalSuggestions: enrichedSuggestions.length + quickTemplates.length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erreur getTransactionSuggestions:', error.message);

    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des suggestions',
      error: 'suggestions_error',
      timestamp: new Date().toISOString()
    });
  }
};

// ===================================================================
// CONTROLLERS ADMIN
// ===================================================================

/**
 * Statistiques transactions pour admin
 * GET /api/transactions/admin/stats
 * @access Private (admin seulement)
 */
const getTransactionsStats = async (req, res) => {
  try {
    // Statistiques générales
    const totalTransactions = await Transaction.countDocuments({ isConfirmed: true });
    const totalAmount = await Transaction.aggregate([
      { $match: { isConfirmed: true } },
      { $group: { _id: '$type', total: { $sum: '$amount' } } }
    ]);

    // Top catégories
    const topCategories = await Transaction.aggregate([
      { $match: { isConfirmed: true, type: 'expense' } },
      { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
      { $limit: 10 }
    ]);

    // Tendances (derniers 30 jours)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentTransactions = await Transaction.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
      isConfirmed: true
    });

    // Transactions en attente
    const pendingTransactions = await Transaction.countDocuments({
      isConfirmed: false
    });

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalTransactions,
          totalAmount,
          recentTransactions,
          pendingTransactions
        },
        topCategories: topCategories.map(cat => ({
          ...cat,
          categoryInfo: TRANSACTION_CATEGORIES[cat._id] || {}
        })),
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Erreur getTransactionsStats:', error.message);

    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques',
      error: 'admin_stats_error',
      timestamp: new Date().toISOString()
    });
  }
};

// ===================================================================
// EXPORTS
// ===================================================================
module.exports = {
  // CRUD principal
  createTransaction,
  getUserTransactions,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
  
  // Analytics
  getCategoryAnalytics,
  getMonthlyStats,
  searchTransactions,
  
  // Actions spéciales
  duplicateTransaction,
  confirmTransaction,
  addReceipt,
  addLocation,
  
  // Suggestions & Templates
  getTransactionSuggestions,
  
  // Admin
  getTransactionsStats
};