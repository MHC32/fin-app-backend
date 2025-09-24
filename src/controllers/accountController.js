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
  
  // ✅ CORRECTION: Accès direct aux propriétés d'objet au lieu de .find()
  accountData.bankInfo = HAITI_BANKS[accountData.bankName] || HAITI_BANKS.other;
  accountData.currencyInfo = CURRENCIES[accountData.currency] || CURRENCIES.HTG;
  
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
    .isIn(Object.keys(ACCOUNT_TYPES))  // ✅ CORRECTION: Object.keys() au lieu de Object.values()
    .withMessage('Type de compte invalide'),
    
  body('bankName')
    .notEmpty()
    .withMessage('La banque est requise')
    .custom(value => {
      const validBanks = Object.keys(HAITI_BANKS);  // ✅ CORRECTION: Object.keys() au lieu de .map()
      if (!validBanks.includes(value)) {
        throw new Error('Banque non supportée en Haïti');
      }
      return true;
    }),
    
  body('currency')
    .notEmpty()
    .withMessage('La devise est requise')
    .isIn(Object.keys(CURRENCIES))  // ✅ CORRECTION: Object.keys() au lieu de Object.values().map()
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
        initialBalance
      });

      await account.save();

      // Réponse avec données nettoyées
      const accountData = sanitizeAccountData(account);

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

      // Gestion des erreurs de validation Mongoose
      if (error.name === 'ValidationError') {
        const mongooseErrors = {};
        
        Object.keys(error.errors).forEach(key => {
          mongooseErrors[key] = [error.errors[key].message];
        });

        return res.status(400).json({
          success: false,
          message: 'Erreurs de validation',
          errors: mongooseErrors,
          timestamp: new Date().toISOString()
        });
      }

      // Gestion erreur duplicate (si index unique sur accountNumber)
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'Ce numéro de compte existe déjà',
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
 * Lister tous les comptes de l'utilisateur
 * GET /api/accounts
 * @access Private (authentification requise)
 */
const getAccounts = async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      includeInactive = 'false',
      includeArchived = 'false',
      type,
      currency,
      bankName
    } = req.query;

    // Construction du filtre de recherche
    const filter = { user: userId };

    if (includeInactive !== 'true') {
      filter.isActive = true;
    }

    if (includeArchived !== 'true') {
      filter.isArchived = { $ne: true };
    }

    if (type) {
      filter.type = type;
    }

    if (currency) {
      filter.currency = currency;
    }

    if (bankName) {
      filter.bankName = bankName;
    }

    const accounts = await Account.find(filter)
      .sort({ isDefault: -1, createdAt: -1 });

    const accountsData = accounts.map(account => sanitizeAccountData(account));

    // Calculer les totaux par devise
    const totals = accountsData.reduce((acc, account) => {
      if (account.includeInTotal && account.isActive) {
        if (!acc[account.currency]) {
          acc[account.currency] = 0;
        }
        acc[account.currency] += account.currentBalance;
      }
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      data: {
        accounts: accountsData,
        totals,
        totalAccounts: accountsData.length,
        activeAccounts: accountsData.filter(acc => acc.isActive).length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erreur getAccounts:', error.message);

    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des comptes',
      error: 'accounts_fetch_error',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Récupérer un compte spécifique
 * GET /api/accounts/:accountId
 * @access Private (authentification requise + ownership)
 */
const getAccountById = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { accountId } = req.params;

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

    const accountData = sanitizeAccountData(account);

    // Ajouter des informations supplémentaires
    accountData.recentChange = account.balanceHistory?.length > 0 ? 
      account.currentBalance - (account.balanceHistory[0]?.balance || account.currentBalance) : 0;

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
        'isActive', 'includeInTotal', 'tags', 'allowNegativeBalance',
        'color', 'icon', 'notes'
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

      if (error.name === 'ValidationError') {
        const mongooseErrors = {};
        
        Object.keys(error.errors).forEach(key => {
          mongooseErrors[key] = [error.errors[key].message];
        });

        return res.status(400).json({
          success: false,
          message: 'Erreurs de validation',
          errors: mongooseErrors,
          timestamp: new Date().toISOString()
        });
      }

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
 * Supprimer/désactiver un compte
 * DELETE /api/accounts/:accountId
 * @access Private (authentification requise + ownership)
 */
const deleteAccount = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { accountId } = req.params;
    const { permanent = false } = req.query;

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

    // Vérifier s'il y a des transactions liées
    const transactionCount = await Transaction.countDocuments({
      account: accountId
    });

    if (transactionCount > 0 && permanent === 'true') {
      return res.status(400).json({
        success: false,
        message: 'Impossible de supprimer définitivement un compte avec des transactions',
        error: 'account_has_transactions',
        timestamp: new Date().toISOString()
      });
    }

    if (permanent === 'true') {
      // Suppression définitive
      await Account.findByIdAndDelete(accountId);

      res.status(200).json({
        success: true,
        message: 'Compte supprimé définitivement',
        timestamp: new Date().toISOString()
      });
    } else {
      // Désactivation (soft delete)
      account.isActive = false;
      account.isDefault = false;
      await account.save();

      res.status(200).json({
        success: true,
        message: 'Compte désactivé avec succès',
        data: {
          account: sanitizeAccountData(account)
        },
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('❌ Erreur deleteAccount:', error.message);

    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du compte',
      error: 'account_deletion_error',
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
    .isFloat({ min: -1000000, max: 1000000 })
    .withMessage('Montant invalide (entre -1M et 1M)'),
  
  body('description')
    .notEmpty()
    .withMessage('La description est requise')
    .trim()
    .isLength({ min: 2, max: 255 })
    .withMessage('La description doit contenir entre 2 et 255 caractères'),

  handleValidationErrors,
  
  async (req, res) => {
    try {
      const userId = req.user.userId;
      const { accountId } = req.params;
      const { amount, description } = req.body;

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

      const previousBalance = account.currentBalance;
      account.currentBalance += amount;
      account.availableBalance = account.currentBalance;

      // Ajouter à l'historique
      account.balanceHistory.push({
        date: new Date(),
        balance: account.currentBalance,
        change: amount,
        reason: 'adjustment',
        description: description
      });

      await account.save();

      const accountData = sanitizeAccountData(account);

      res.status(200).json({
        success: true,
        message: 'Solde ajusté avec succès',
        data: {
          account: accountData,
          adjustment: {
            previousBalance,
            newBalance: account.currentBalance,
            amount: amount,
            description: description
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

/**
 * Définir un compte comme compte par défaut
 * PUT /api/accounts/:accountId/set-default
 * @access Private (authentification requise + ownership)
 */
const setDefaultAccount = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { accountId } = req.params;

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

    // Désactiver le défaut sur tous les autres comptes
    await Account.updateMany(
      { user: userId, _id: { $ne: accountId } },
      { isDefault: false }
    );

    // Activer le défaut sur ce compte
    account.isDefault = true;
    await account.save();

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

    // Vérifier si c'est le seul compte actif
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
    }

    account.isArchived = true;
    account.isActive = false;
    account.isDefault = false;
    account.archivedAt = new Date();
    account.archiveReason = reason;

    await account.save();

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
    console.error('❌ Erreur archiveAccount:', error);

    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'archivage du compte',
      error: 'archive_error',
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

    account.isArchived = false;
    account.isActive = true;
    account.archivedAt = null;
    account.archiveReason = null;

    await account.save();

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
    console.error('❌ Erreur unarchiveAccount:', error);

    res.status(500).json({
      success: false,
      message: 'Erreur lors du désarchivage du compte',
      error: 'unarchive_error',
      timestamp: new Date().toISOString()
    });
  }
};

// ===================================================================
// EXPORTS
// ===================================================================

module.exports = {
  // Validation middleware
  createAccountValidation,
  updateAccountValidation,
  handleValidationErrors,
  
  // CRUD operations
  createAccount,
  getAccounts,
  getAccountById,
  updateAccount,
  deleteAccount,
  
  // Special operations
  adjustBalance,
  setDefaultAccount,
  archiveAccount,
  unarchiveAccount,
  
  // Utilities
  sanitizeAccountData,
  formatValidationErrors
};