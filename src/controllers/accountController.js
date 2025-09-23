// src/controllers/accountController.js - CRUD Comptes Bancaires FinApp Haiti
const { body, validationResult } = require('express-validator');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const { HAITI_BANKS, CURRENCIES, ACCOUNT_TYPES } = require('../utils/constants');

/**
 * Controllers CRUD comptes bancaires avec authentification intégrée
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
 * Nettoyer les données compte pour la réponse
 * @param {Object} account - Objet compte MongoDB
 * @returns {Object} - Données compte nettoyées
 */
const sanitizeAccountData = (account) => {
  const accountData = account.toObject ? account.toObject() : account;
  
  // Ajouter données enrichies
  accountData.bankInfo = HAITI_BANKS.find(bank => bank.code === accountData.bankName) || {};
  accountData.currencyInfo = CURRENCIES.find(curr => curr.code === accountData.currency) || {};
  
  return accountData;
};

// ===================================================================
// RÈGLES DE VALIDATION
// ===================================================================

/**
 * Règles validation création compte
 */
const createAccountValidation = [
  body('name')
    .notEmpty()
    .withMessage('Le nom du compte est requis')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Le nom doit contenir entre 2 et 100 caractères'),
    
  body('type')
    .notEmpty()
    .withMessage('Le type de compte est requis')
    .isIn(Object.values(ACCOUNT_TYPES))
    .withMessage('Type de compte invalide'),
    
  body('bankName')
    .notEmpty()
    .withMessage('La banque est requise')
    .custom(value => {
      const validBanks = HAITI_BANKS.map(bank => bank.code);
      if (!validBanks.includes(value)) {
        throw new Error('Banque non supportée en Haïti');
      }
      return true;
    }),
    
  body('currency')
    .notEmpty()
    .withMessage('La devise est requise')
    .isIn(Object.values(CURRENCIES).map(curr => curr.code))
    .withMessage('Devise non supportée'),
    
  body('accountNumber')
    .optional()
    .trim()
    .isLength({ min: 5, max: 30 })
    .withMessage('Le numéro de compte doit contenir entre 5 et 30 caractères'),
    
  body('initialBalance')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Le solde initial doit être positif'),
    
  body('minimumBalance')
    .optional()
    .isFloat()
    .withMessage('Le solde minimum doit être un nombre'),
    
  body('creditLimit')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('La limite de crédit doit être positive'),
    
  body('description')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('La description ne peut pas dépasser 200 caractères')
];

/**
 * Règles validation mise à jour compte
 */
const updateAccountValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Le nom doit contenir entre 2 et 100 caractères'),
    
  body('description')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('La description ne peut pas dépasser 200 caractères'),
    
  body('minimumBalance')
    .optional()
    .isFloat()
    .withMessage('Le solde minimum doit être un nombre'),
    
  body('creditLimit')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('La limite de crédit doit être positive'),
    
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('Le statut actif doit être un booléen'),
    
  body('includeInTotal')
    .optional()
    .isBoolean()
    .withMessage('L\'inclusion dans le total doit être un booléen')
];

// ===================================================================
// CONTROLLERS COMPTES
// ===================================================================

/**
 * Créer un nouveau compte
 * POST /api/accounts
 * @access Private (authentification requise)
 */
const createAccount = [
  ...createAccountValidation,
  handleValidationErrors,
  async (req, res) => {
    try {
      const userId = req.user.userId;
      const {
        name,
        type,
        bankName,
        currency,
        accountNumber,
        initialBalance = 0,
        minimumBalance = 0,
        creditLimit = 0,
        description,
        tags,
        isDefault = false
      } = req.body;

      // Vérifier si c'est le premier compte (sera automatiquement par défaut)
      const existingAccounts = await Account.countDocuments({ user: userId, isActive: true });
      const shouldBeDefault = existingAccounts === 0 || isDefault;

      // Créer le compte
      const account = new Account({
        user: userId,
        name: name.trim(),
        type,
        bankName,
        currency,
        accountNumber: accountNumber?.trim(),
        currentBalance: initialBalance,
        availableBalance: initialBalance,
        minimumBalance,
        creditLimit,
        description: description?.trim(),
        tags: tags || [],
        isDefault: shouldBeDefault,
        createdAt: new Date()
      });

      // Ajouter solde initial à l'historique
      if (initialBalance > 0) {
        account.balanceHistory.push({
          balance: initialBalance,
          change: initialBalance,
          reason: 'initial',
          description: 'Solde initial du compte'
        });
      }

      await account.save();

      // Populer les données pour la réponse
      const populatedAccount = await Account.findById(account._id);
      const accountData = sanitizeAccountData(populatedAccount);

      res.status(201).json({
        success: true,
        message: 'Compte créé avec succès',
        data: {
          account: accountData
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur createAccount:', error.message);

      // Gestion erreurs spécifiques
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'Un compte avec ce numéro existe déjà',
          error: 'duplicate_account_number',
          timestamp: new Date().toISOString()
        });
      }

      res.status(500).json({
        success: false,
        message: 'Erreur lors de la création du compte',
        error: 'account_creation_error',
        timestamp: new Date().toISOString()
      });
    }
  }
];

/**
 * Obtenir tous les comptes de l'utilisateur
 * GET /api/accounts
 * @access Private (authentification requise)
 */
const getUserAccounts = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { includeArchived = false, currency, type } = req.query;

    // Construire la query
    const query = { user: userId };
    
    if (!includeArchived) {
      query.isActive = true;
      query.isArchived = false;
    }
    
    if (currency) query.currency = currency;
    if (type) query.type = type;

    // Récupérer les comptes
    const accounts = await Account.find(query)
      .sort({ isDefault: -1, createdAt: -1 });

    // Calculer les totaux par devise
    const totals = await Account.getTotalsByUser(userId);

    // Sanitiser les données
    const accountsData = accounts.map(account => sanitizeAccountData(account));

    res.status(200).json({
      success: true,
      data: {
        accounts: accountsData,
        totals: totals,
        summary: {
          totalAccounts: accounts.length,
          activeAccounts: accounts.filter(acc => acc.isActive).length,
          currencies: [...new Set(accounts.map(acc => acc.currency))]
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erreur getUserAccounts:', error.message);

    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des comptes',
      error: 'accounts_fetch_error',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Obtenir un compte spécifique
 * GET /api/accounts/:accountId
 * @access Private (authentification requise + ownership)
 */
const getAccountById = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { accountId } = req.params;
    const { includeHistory = false } = req.query;

    // Trouver le compte
    const account = await Account.findOne({
      _id: accountId,
      user: userId
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Compte non trouvé',
        error: 'account_not_found',
        timestamp: new Date().toISOString()
      });
    }

    // Préparer les données
    const accountData = sanitizeAccountData(account);

    // Ajouter historique si demandé
    if (includeHistory) {
      accountData.recentHistory = account.getRecentHistory(30);
    }

    // Ajouter statistiques du compte
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const transactionStats = await Transaction.aggregate([
      {
        $match: {
          account: account._id,
          date: { $gte: thirtyDaysAgo },
          isConfirmed: true
        }
      },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    accountData.stats = {
      transactionStats,
      balanceChange30Days: account.balanceHistory.length > 0 ? 
        account.currentBalance - (account.balanceHistory[0]?.balance || account.currentBalance) : 0
    };

    res.status(200).json({
      success: true,
      data: {
        account: accountData
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erreur getAccountById:', error.message);

    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du compte',
      error: 'account_fetch_error',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Mettre à jour un compte
 * PUT /api/accounts/:accountId
 * @access Private (authentification requise + ownership)
 */
const updateAccount = [
  ...updateAccountValidation,
  handleValidationErrors,
  async (req, res) => {
    try {
      const userId = req.user.userId;
      const { accountId } = req.params;
      const updateData = req.body;

      // Trouver le compte
      const account = await Account.findOne({
        _id: accountId,
        user: userId
      });

      if (!account) {
        return res.status(404).json({
          success: false,
          message: 'Compte non trouvé',
          error: 'account_not_found',
          timestamp: new Date().toISOString()
        });
      }

      // Mettre à jour les champs autorisés
      const allowedFields = [
        'name', 'description', 'minimumBalance', 'creditLimit',
        'isActive', 'includeInTotal', 'tags', 'allowNegativeBalance'
      ];

      allowedFields.forEach(field => {
        if (updateData[field] !== undefined) {
          account[field] = updateData[field];
        }
      });

      await account.save();

      // Récupérer le compte mis à jour
      const updatedAccount = sanitizeAccountData(account);

      res.status(200).json({
        success: true,
        message: 'Compte mis à jour avec succès',
        data: {
          account: updatedAccount
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur updateAccount:', error.message);

      res.status(500).json({
        success: false,
        message: 'Erreur lors de la mise à jour du compte',
        error: 'account_update_error',
        timestamp: new Date().toISOString()
      });
    }
  }
];

/**
 * Définir compte par défaut
 * PUT /api/accounts/:accountId/set-default
 * @access Private (authentification requise + ownership)
 */
const setDefaultAccount = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { accountId } = req.params;

    // Trouver le compte
    const account = await Account.findOne({
      _id: accountId,
      user: userId,
      isActive: true
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Compte non trouvé',
        error: 'account_not_found',
        timestamp: new Date().toISOString()
      });
    }

    // Utiliser la méthode du modèle
    await account.setAsDefault();

    const accountData = sanitizeAccountData(account);

    res.status(200).json({
      success: true,
      message: 'Compte défini comme défaut avec succès',
      data: {
        account: accountData
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erreur setDefaultAccount:', error.message);

    res.status(500).json({
      success: false,
      message: 'Erreur lors de la définition du compte par défaut',
      error: 'set_default_error',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Archiver un compte
 * PUT /api/accounts/:accountId/archive
 * @access Private (authentification requise + ownership)
 */
const archiveAccount = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { accountId } = req.params;
    const { reason = 'user_request' } = req.body;

    // Trouver le compte
    const account = await Account.findOne({
      _id: accountId,
      user: userId
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Compte non trouvé',
        error: 'account_not_found',
        timestamp: new Date().toISOString()
      });
    }

    // Vérifier si c'est le compte par défaut
    if (account.isDefault) {
      const otherActiveAccounts = await Account.countDocuments({
        user: userId,
        isActive: true,
        _id: { $ne: accountId }
      });

      if (otherActiveAccounts === 0) {
        return res.status(400).json({
          success: false,
          message: 'Impossible d\'archiver le seul compte actif',
          error: 'cannot_archive_only_account',
          timestamp: new Date().toISOString()
        });
      }

      // Si c'est le compte par défaut, en définir un autre
      const newDefaultAccount = await Account.findOne({
        user: userId,
        isActive: true,
        _id: { $ne: accountId }
      });

      if (newDefaultAccount) {
        await newDefaultAccount.setAsDefault();
      }
    }

    // Archiver le compte
    await account.archive(reason);

    const accountData = sanitizeAccountData(account);

    res.status(200).json({
      success: true,
      message: 'Compte archivé avec succès',
      data: {
        account: accountData
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erreur archiveAccount:', error.message);

    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'archivage du compte',
      error: 'account_archive_error',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Désarchiver un compte
 * PUT /api/accounts/:accountId/unarchive
 * @access Private (authentification requise + ownership)
 */
const unarchiveAccount = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { accountId } = req.params;

    // Trouver le compte
    const account = await Account.findOne({
      _id: accountId,
      user: userId,
      isArchived: true
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Compte archivé non trouvé',
        error: 'archived_account_not_found',
        timestamp: new Date().toISOString()
      });
    }

    // Désarchiver le compte
    await account.unarchive();

    const accountData = sanitizeAccountData(account);

    res.status(200).json({
      success: true,
      message: 'Compte désarchivé avec succès',
      data: {
        account: accountData
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erreur unarchiveAccount:', error.message);

    res.status(500).json({
      success: false,
      message: 'Erreur lors du désarchivage du compte',
      error: 'account_unarchive_error',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Ajuster le solde d'un compte
 * PUT /api/accounts/:accountId/adjust-balance
 * @access Private (authentification requise + ownership)
 */
const adjustBalance = [
  body('amount')
    .notEmpty()
    .withMessage('Le montant est requis')
    .isFloat()
    .withMessage('Le montant doit être un nombre'),
    
  body('description')
    .notEmpty()
    .withMessage('La description est requise')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('La description doit contenir entre 5 et 200 caractères'),
    
  handleValidationErrors,
  async (req, res) => {
    try {
      const userId = req.user.userId;
      const { accountId } = req.params;
      const { amount, description } = req.body;

      // Trouver le compte
      const account = await Account.findOne({
        _id: accountId,
        user: userId,
        isActive: true
      });

      if (!account) {
        return res.status(404).json({
          success: false,
          message: 'Compte actif non trouvé',
          error: 'account_not_found',
          timestamp: new Date().toISOString()
        });
      }

      // Vérifier si l'ajustement est possible
      if (!account.canProcessTransaction(amount)) {
        return res.status(400).json({
          success: false,
          message: 'Ajustement impossible : dépassement des limites du compte',
          error: 'balance_adjustment_forbidden',
          timestamp: new Date().toISOString()
        });
      }

      const previousBalance = account.currentBalance;

      // Utiliser la méthode du modèle
      await account.updateBalance(amount, description);

      const accountData = sanitizeAccountData(account);

      res.status(200).json({
        success: true,
        message: 'Solde ajusté avec succès',
        data: {
          account: accountData,
          adjustment: {
            amount,
            previousBalance,
            newBalance: account.currentBalance,
            description
          }
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur adjustBalance:', error.message);

      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'ajustement du solde',
        error: 'balance_adjustment_error',
        timestamp: new Date().toISOString()
      });
    }
  }
];

// ===================================================================
// CONTROLLERS ADMIN
// ===================================================================

/**
 * Statistiques comptes pour admin
 * GET /api/accounts/admin/stats
 * @access Private (admin seulement)
 */
const getAccountsStats = async (req, res) => {
  try {
    // Statistiques générales
    const totalAccounts = await Account.countDocuments({ isActive: true });
    const totalBalance = await Account.aggregate([
      { $match: { isActive: true, includeInTotal: true } },
      { $group: { _id: '$currency', total: { $sum: '$currentBalance' } } }
    ]);

    // Statistiques par banque
    const bankStats = await Account.getBankStats();

    // Comptes avec solde critique
    const criticalAccounts = await Account.aggregate([
      {
        $match: {
          isActive: true,
          $expr: { $lt: ['$currentBalance', '$minimumBalance'] }
        }
      },
      { $count: 'total' }
    ]);

    // Tendances (créations derniers 30 jours)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentAccounts = await Account.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalAccounts,
          totalBalance,
          criticalAccounts: criticalAccounts[0]?.total || 0,
          recentAccounts
        },
        bankStats,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Erreur getAccountsStats:', error.message);

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
  createAccount,
  getUserAccounts,
  getAccountById,
  updateAccount,
  
  // Actions spéciales
  setDefaultAccount,
  archiveAccount,
  unarchiveAccount,
  adjustBalance,
  
  // Admin
  getAccountsStats
};