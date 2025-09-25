// src/controllers/accountController.js - VERSION DEBUG COMPLÈTE
const { body, validationResult } = require('express-validator');

// 🚨 DEBUG: Import avec logs
console.log("🔍 [ACCOUNT-DEBUG] Importing modules and models...");
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');

// 🚨 DEBUG: Import des constantes avec logs
console.log("🔍 [ACCOUNT-DEBUG] Importing constants...");
const { HAITI_BANKS, CURRENCIES, ACCOUNT_TYPES } = require('../utils/constants');
console.log("🔍 [ACCOUNT-DEBUG] Constants imported successfully");
console.log("🔍 [ACCOUNT-DEBUG] HAITI_BANKS type:", typeof HAITI_BANKS);
console.log("🔍 [ACCOUNT-DEBUG] HAITI_BANKS is array:", Array.isArray(HAITI_BANKS));
console.log("🔍 [ACCOUNT-DEBUG] HAITI_BANKS keys:", Object.keys(HAITI_BANKS));
console.log("🔍 [ACCOUNT-DEBUG] ACCOUNT_TYPES keys:", Object.keys(ACCOUNT_TYPES));
console.log("🔍 [ACCOUNT-DEBUG] CURRENCIES keys:", Object.keys(CURRENCIES));

/**
 * Controllers CRUD comptes bancaires avec authentification intégrée
 * VERSION DEBUG avec logs détaillés pour diagnostiquer les erreurs
 */

// ===================================================================
// UTILITAIRES & VALIDATION AVEC DEBUG
// ===================================================================

/**
 * Formater response d'erreur validation
 */
const formatValidationErrors = (errors) => {
  console.log("🔍 [ACCOUNT-DEBUG] Formatting validation errors:", errors.length);
  
  const formattedErrors = {};
  
  errors.forEach(error => {
    console.log("🚨 [ACCOUNT-DEBUG] Validation Error:", error.path, "->", error.msg);
    if (!formattedErrors[error.path]) {
      formattedErrors[error.path] = [];
    }
    formattedErrors[error.path].push(error.msg);
  });
  
  console.log("🔍 [ACCOUNT-DEBUG] Final formatted errors:", formattedErrors);
  return formattedErrors;
};

/**
 * Middleware validation des résultats
 */
const handleValidationErrors = (req, res, next) => {
  console.log("🔍 [ACCOUNT-DEBUG] Checking validation results...");
  
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    console.log("🚨 [ACCOUNT-DEBUG] Validation errors found:", errors.array());
    console.log("🚨 [ACCOUNT-DEBUG] Request body was:", req.body);
    
    return res.status(400).json({
      success: false,
      message: 'Erreurs de validation',
      errors: formatValidationErrors(errors.array()),
      timestamp: new Date().toISOString()
    });
  }
  
  console.log("✅ [ACCOUNT-DEBUG] Validation passed successfully");
  next();
};

/**
 * Nettoyer les données compte pour la réponse
 */
const sanitizeAccountData = (account) => {
  console.log("🔍 [ACCOUNT-DEBUG] Sanitizing account data...");
  console.log("🔍 [ACCOUNT-DEBUG] Account bankName:", account.bankName);
  console.log("🔍 [ACCOUNT-DEBUG] Account currency:", account.currency);
  
  const accountData = account.toObject ? account.toObject() : account;
  
  // 🚨 DEBUG: Test des méthodes anciennes vs nouvelles
  console.log("🔍 [ACCOUNT-DEBUG] Testing old vs new methods...");
  
  try {
    console.log("❌ [ACCOUNT-DEBUG] Testing old method: HAITI_BANKS.find()");
    const oldResult = HAITI_BANKS.find(bank => bank.code === accountData.bankName);
    console.log("❌ [ACCOUNT-DEBUG] Old method unexpectedly worked:", oldResult);
  } catch (error) {
    console.log("✅ [ACCOUNT-DEBUG] Old method failed as expected:", error.message);
  }
  
  // ✅ NOUVELLE MÉTHODE (corrigée)
  console.log("🔍 [ACCOUNT-DEBUG] Using new method: HAITI_BANKS[key]");
  accountData.bankInfo = HAITI_BANKS[accountData.bankName] || HAITI_BANKS.other;
  accountData.currencyInfo = CURRENCIES[accountData.currency] || CURRENCIES.HTG;
  
  console.log("✅ [ACCOUNT-DEBUG] bankInfo found:", !!accountData.bankInfo);
  console.log("✅ [ACCOUNT-DEBUG] currencyInfo found:", !!accountData.currencyInfo);
  
  return accountData;
};

// ===================================================================
// RÈGLES DE VALIDATION AVEC DEBUG COMPLET
// ===================================================================

console.log("🔍 [ACCOUNT-DEBUG] Setting up validation rules...");

/**
 * Règles validation création compte - VERSION DEBUG COMPLÈTE
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
    .custom((value) => {
      // 🚨 DEBUG ULTRA-COMPLET
      console.log("🔍 [ACCOUNT-DEBUG] ===== TYPE VALIDATION DEBUG =====");
      console.log("🔍 [ACCOUNT-DEBUG] Input type value:", value, typeof value);
      console.log("🔍 [ACCOUNT-DEBUG] ACCOUNT_TYPES object:", ACCOUNT_TYPES);
      console.log("🔍 [ACCOUNT-DEBUG] ACCOUNT_TYPES type:", typeof ACCOUNT_TYPES);
      console.log("🔍 [ACCOUNT-DEBUG] ACCOUNT_TYPES keys:", Object.keys(ACCOUNT_TYPES));
      console.log("🔍 [ACCOUNT-DEBUG] ACCOUNT_TYPES values:", Object.values(ACCOUNT_TYPES));
      
      // Test méthode ancienne (problématique)
      try {
        console.log("❌ [ACCOUNT-DEBUG] Testing OLD method: Object.values(ACCOUNT_TYPES).includes()");
        const oldResult = Object.values(ACCOUNT_TYPES).includes(value);
        console.log("❌ [ACCOUNT-DEBUG] Old method result:", oldResult);
        console.log("❌ [ACCOUNT-DEBUG] Old method values are:", Object.values(ACCOUNT_TYPES).map(v => typeof v + ":" + (v.id || v)));
      } catch (error) {
        console.log("❌ [ACCOUNT-DEBUG] Old method error:", error.message);
      }
      
      // ✅ NOUVELLE MÉTHODE (corrigée)
      console.log("✅ [ACCOUNT-DEBUG] Testing NEW method: Object.keys(ACCOUNT_TYPES).includes()");
      const validTypes = Object.keys(ACCOUNT_TYPES);
      const isValid = validTypes.includes(value);
      
      console.log("✅ [ACCOUNT-DEBUG] Valid types available:", validTypes);
      console.log("✅ [ACCOUNT-DEBUG] Type '" + value + "' is valid:", isValid);
      console.log("🔍 [ACCOUNT-DEBUG] ===== END TYPE VALIDATION DEBUG =====");
      
      if (!isValid) {
        console.log("❌ [ACCOUNT-DEBUG] Type validation FAILED!");
        throw new Error('Type de compte invalide');
      }
      
      console.log("✅ [ACCOUNT-DEBUG] Type validation PASSED!");
      return true;
    }),
    
  body('bankName')
    .notEmpty()
    .withMessage('La banque est requise')
    .custom(value => {
      // 🚨 DEBUG ULTRA-COMPLET
      console.log("🔍 [ACCOUNT-DEBUG] ===== BANK VALIDATION DEBUG =====");
      console.log("🔍 [ACCOUNT-DEBUG] Input bankName value:", value, typeof value);
      console.log("🔍 [ACCOUNT-DEBUG] HAITI_BANKS object:", HAITI_BANKS);
      console.log("🔍 [ACCOUNT-DEBUG] HAITI_BANKS type:", typeof HAITI_BANKS);
      console.log("🔍 [ACCOUNT-DEBUG] HAITI_BANKS is array:", Array.isArray(HAITI_BANKS));
      console.log("🔍 [ACCOUNT-DEBUG] HAITI_BANKS keys:", Object.keys(HAITI_BANKS));
      console.log("🔍 [ACCOUNT-DEBUG] HAITI_BANKS has .map method:", typeof HAITI_BANKS.map);
      
      // Test méthode ancienne (problématique)
      try {
        console.log("❌ [ACCOUNT-DEBUG] Testing OLD method: HAITI_BANKS.map()");
        const oldResult = HAITI_BANKS.map(bank => bank.code);
        console.log("❌ [ACCOUNT-DEBUG] Old method unexpectedly worked:", oldResult);
      } catch (error) {
        console.log("✅ [ACCOUNT-DEBUG] Old method failed as expected:", error.message);
      }
      
      // ✅ NOUVELLE MÉTHODE (corrigée)
      console.log("✅ [ACCOUNT-DEBUG] Testing NEW method: Object.keys(HAITI_BANKS)");
      const validBanks = Object.keys(HAITI_BANKS);
      const isValid = validBanks.includes(value);
      
      console.log("✅ [ACCOUNT-DEBUG] Valid banks available:", validBanks);
      console.log("✅ [ACCOUNT-DEBUG] Bank '" + value + "' is valid:", isValid);
      console.log("🔍 [ACCOUNT-DEBUG] ===== END BANK VALIDATION DEBUG =====");
      
      if (!isValid) {
        console.log("❌ [ACCOUNT-DEBUG] Bank validation FAILED!");
        throw new Error('Banque non supportée en Haïti');
      }
      
      console.log("✅ [ACCOUNT-DEBUG] Bank validation PASSED!");
      return true;
    }),
    
  body('currency')
    .notEmpty()
    .withMessage('La devise est requise')
    .custom(value => {
      // 🚨 DEBUG ULTRA-COMPLET
      console.log("🔍 [ACCOUNT-DEBUG] ===== CURRENCY VALIDATION DEBUG =====");
      console.log("🔍 [ACCOUNT-DEBUG] Input currency value:", value, typeof value);
      console.log("🔍 [ACCOUNT-DEBUG] CURRENCIES object:", CURRENCIES);
      console.log("🔍 [ACCOUNT-DEBUG] CURRENCIES type:", typeof CURRENCIES);
      console.log("🔍 [ACCOUNT-DEBUG] CURRENCIES keys:", Object.keys(CURRENCIES));
      console.log("🔍 [ACCOUNT-DEBUG] CURRENCIES values:", Object.values(CURRENCIES));
      
      // Test méthode ancienne (problématique)
      try {
        console.log("❌ [ACCOUNT-DEBUG] Testing OLD method: Object.values(CURRENCIES).map()");
        const oldResult = Object.values(CURRENCIES).map(curr => curr.code);
        console.log("❌ [ACCOUNT-DEBUG] Old method result:", oldResult);
      } catch (error) {
        console.log("❌ [ACCOUNT-DEBUG] Old method error:", error.message);
      }
      
      // ✅ NOUVELLE MÉTHODE (corrigée)
      console.log("✅ [ACCOUNT-DEBUG] Testing NEW method: Object.keys(CURRENCIES)");
      const validCurrencies = Object.keys(CURRENCIES);
      const isValid = validCurrencies.includes(value);
      
      console.log("✅ [ACCOUNT-DEBUG] Valid currencies available:", validCurrencies);
      console.log("✅ [ACCOUNT-DEBUG] Currency '" + value + "' is valid:", isValid);
      console.log("🔍 [ACCOUNT-DEBUG] ===== END CURRENCY VALIDATION DEBUG =====");
      
      if (!isValid) {
        console.log("❌ [ACCOUNT-DEBUG] Currency validation FAILED!");
        throw new Error('Devise non supportée');
      }
      
      console.log("✅ [ACCOUNT-DEBUG] Currency validation PASSED!");
      return true;
    }),
    
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

console.log("✅ [ACCOUNT-DEBUG] Validation rules setup complete");

// ===================================================================
// CONTROLLERS COMPTES AVEC DEBUG
// ===================================================================

/**
 * Créer un nouveau compte - VERSION DEBUG COMPLÈTE
 */
const createAccount = [
  ...createAccountValidation,
  handleValidationErrors,
  async (req, res) => {
    try {
      console.log("🔍 [ACCOUNT-DEBUG] ===== CREATE ACCOUNT STARTED =====");
      console.log("🔍 [ACCOUNT-DEBUG] Request body:", req.body);
      console.log("🔍 [ACCOUNT-DEBUG] User ID:", req.user?.userId);
      
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

      console.log("🔍 [ACCOUNT-DEBUG] Extracted fields:");
      console.log("  - name:", name);
      console.log("  - type:", type);
      console.log("  - bankName:", bankName);
      console.log("  - currency:", currency);
      console.log("  - initialBalance:", initialBalance);

      // Vérifier si c'est le premier compte
      console.log("🔍 [ACCOUNT-DEBUG] Checking existing accounts...");
      const existingAccounts = await Account.countDocuments({ user: userId, isActive: true });
      const shouldBeDefault = existingAccounts === 0 || isDefault;
      
      console.log("🔍 [ACCOUNT-DEBUG] Existing accounts:", existingAccounts);
      console.log("🔍 [ACCOUNT-DEBUG] Should be default:", shouldBeDefault);

      // Créer le compte
      console.log("🔍 [ACCOUNT-DEBUG] Creating account object...");
      const accountData = {
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
      };
      
      console.log("🔍 [ACCOUNT-DEBUG] Account data to save:", accountData);
      
      const account = new Account(accountData);

      console.log("🔍 [ACCOUNT-DEBUG] Account object created, attempting to save...");
      await account.save();
      console.log("✅ [ACCOUNT-DEBUG] Account saved successfully!");

      // Réponse avec données nettoyées
      console.log("🔍 [ACCOUNT-DEBUG] Sanitizing account data for response...");
      const responseData = sanitizeAccountData(account);

      console.log("✅ [ACCOUNT-DEBUG] Account creation completed successfully!");
      console.log("🔍 [ACCOUNT-DEBUG] ===== CREATE ACCOUNT FINISHED =====");
      
      res.status(201).json({
        success: true,
        message: 'Compte créé avec succès',
        data: {
          account: responseData
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.log("❌ [ACCOUNT-DEBUG] ===== CREATE ACCOUNT ERROR =====");
      console.log("❌ [ACCOUNT-DEBUG] Error message:", error.message);
      console.log("❌ [ACCOUNT-DEBUG] Error name:", error.name);
      console.log("❌ [ACCOUNT-DEBUG] Error stack:", error.stack);

      // Gestion des erreurs de validation Mongoose
      if (error.name === 'ValidationError') {
        console.log("❌ [ACCOUNT-DEBUG] Mongoose validation error detected");
        console.log("❌ [ACCOUNT-DEBUG] Validation errors:", error.errors);
        
        const mongooseErrors = {};
        
        Object.keys(error.errors).forEach(key => {
          console.log("❌ [ACCOUNT-DEBUG] Field error:", key, "->", error.errors[key].message);
          mongooseErrors[key] = [error.errors[key].message];
        });

        return res.status(400).json({
          success: false,
          message: 'Erreurs de validation',
          errors: mongooseErrors,
          timestamp: new Date().toISOString()
        });
      }

      // Gestion erreur duplicate (si index unique)
      if (error.code === 11000) {
        console.log("❌ [ACCOUNT-DEBUG] Duplicate key error:", error.keyPattern);
        return res.status(400).json({
          success: false,
          message: 'Ce numéro de compte existe déjà',
          error: 'duplicate_account_number',
          timestamp: new Date().toISOString()
        });
      }

      console.log("❌ [ACCOUNT-DEBUG] Unhandled error type");
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
 * Lister tous les comptes de l'utilisateur - VERSION DEBUG
 */
const getAccounts = async (req, res) => {
  try {
    console.log("🔍 [ACCOUNT-DEBUG] Get accounts called for user:", req.user.userId);
    console.log("🔍 [ACCOUNT-DEBUG] Query params:", req.query);
    
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

    console.log("🔍 [ACCOUNT-DEBUG] MongoDB filter:", filter);

    const accounts = await Account.find(filter)
      .sort({ isDefault: -1, createdAt: -1 });

    console.log("🔍 [ACCOUNT-DEBUG] Found", accounts.length, "accounts");

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

    console.log("🔍 [ACCOUNT-DEBUG] Calculated totals:", totals);

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
    console.log("❌ [ACCOUNT-DEBUG] Get accounts error:", error.message);

    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des comptes',
      error: 'accounts_fetch_error',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Récupérer un compte spécifique - VERSION DEBUG
 */
const getAccountById = async (req, res) => {
  try {
    console.log("🔍 [ACCOUNT-DEBUG] Get account by ID:", req.params.accountId);
    console.log("🔍 [ACCOUNT-DEBUG] User ID:", req.user.userId);
    
    const userId = req.user.userId;
    const { accountId } = req.params;

    const account = await Account.findOne({
      _id: accountId,
      user: userId
    });

    if (!account) {
      console.log("❌ [ACCOUNT-DEBUG] Account not found");
      return res.status(404).json({
        success: false,
        message: 'Compte non trouvé',
        error: 'account_not_found',
        timestamp: new Date().toISOString()
      });
    }

    console.log("✅ [ACCOUNT-DEBUG] Account found:", account._id);

    const accountData = sanitizeAccountData(account);

    // Ajouter des informations supplémentaires
    accountData.recentChange = account.balanceHistory?.length > 0 ? 
      account.currentBalance - (account.balanceHistory[0]?.balance || account.currentBalance) : 0;

    console.log("✅ [ACCOUNT-DEBUG] Account data prepared");

    res.status(200).json({
      success: true,
      data: {
        account: accountData
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.log("❌ [ACCOUNT-DEBUG] Get account by ID error:", error.message);

    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du compte',
      error: 'account_fetch_error',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Fonction de test pour debug constants - VERSION DEBUG
 */
const testValidation = (req, res) => {
  console.log("🧪 [ACCOUNT-DEBUG] ===== TEST VALIDATION ENDPOINT =====");
  
  const testPayload = {
    type: "checking",
    bankName: "buh", 
    currency: "HTG"
  };
  
  console.log("🧪 [ACCOUNT-DEBUG] Testing with payload:", testPayload);
  
  // Test détaillé de chaque constante
  console.log("🧪 [ACCOUNT-DEBUG] Testing ACCOUNT_TYPES...");
  console.log("  - Keys:", Object.keys(ACCOUNT_TYPES));
  console.log("  - Values:", Object.values(ACCOUNT_TYPES));
  console.log("  - 'checking' in keys:", Object.keys(ACCOUNT_TYPES).includes('checking'));
  console.log("  - 'checking' in values:", Object.values(ACCOUNT_TYPES).includes('checking'));
  
  console.log("🧪 [ACCOUNT-DEBUG] Testing HAITI_BANKS...");
  console.log("  - Type:", typeof HAITI_BANKS);
  console.log("  - Is Array:", Array.isArray(HAITI_BANKS));
  console.log("  - Has .map:", typeof HAITI_BANKS.map);
  console.log("  - Keys:", Object.keys(HAITI_BANKS));
  console.log("  - 'buh' in keys:", Object.keys(HAITI_BANKS).includes('buh'));
  
  // Test des erreurs potentielles
  try {
    console.log("🧪 [ACCOUNT-DEBUG] Testing HAITI_BANKS.map() (should fail)...");
    const result = HAITI_BANKS.map(x => x.code);
    console.log("❌ [ACCOUNT-DEBUG] HAITI_BANKS.map() worked unexpectedly:", result);
  } catch (error) {
    console.log("✅ [ACCOUNT-DEBUG] HAITI_BANKS.map() failed as expected:", error.message);
  }
  
  const results = {
    constants: {
      accountTypesKeys: Object.keys(ACCOUNT_TYPES),
      haitiBanksKeys: Object.keys(HAITI_BANKS),
      haitiBanksType: typeof HAITI_BANKS,
      haitiBanksIsArray: Array.isArray(HAITI_BANKS),
      currenciesKeys: Object.keys(CURRENCIES)
    },
    validations: {
      type: Object.keys(ACCOUNT_TYPES).includes(testPayload.type),
      bankName: Object.keys(HAITI_BANKS).includes(testPayload.bankName),
      currency: Object.keys(CURRENCIES).includes(testPayload.currency)
    },
    errors: {
      typeWithValues: Object.values(ACCOUNT_TYPES).includes(testPayload.type),
      bankMapExists: typeof HAITI_BANKS.map !== 'undefined'
    }
  };
  
  console.log("🧪 [ACCOUNT-DEBUG] Test results:", results);
  console.log("🧪 [ACCOUNT-DEBUG] ===== END TEST VALIDATION =====");
  
  res.json({
    success: true,
    debug: true,
    results,
    message: "Test de validation des constantes",
    timestamp: new Date().toISOString()
  });
};

// Version simplifiée pour autres opérations (sans debug excessif)
const updateAccount = [
  ...updateAccountValidation,
  handleValidationErrors,
  async (req, res) => {
    try {
      console.log("🔍 [ACCOUNT-DEBUG] Update account called");
      
      const userId = req.user.userId;
      const { accountId } = req.params;
      const updateData = req.body;

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
      const updatedAccount = sanitizeAccountData(account);

      console.log("✅ [ACCOUNT-DEBUG] Account updated successfully");

      res.status(200).json({
        success: true,
        message: 'Compte mis à jour avec succès',
        data: {
          account: updatedAccount
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.log("❌ [ACCOUNT-DEBUG] Update account error:", error.message);

      res.status(500).json({
        success: false,
        message: 'Erreur lors de la mise à jour du compte',
        error: 'account_update_error',
        timestamp: new Date().toISOString()
      });
    }
  }
];

const deleteAccount = async (req, res) => {
  try {
    console.log("🔍 [ACCOUNT-DEBUG] Delete account called");
    
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

    if (permanent === 'true') {
      await Account.findByIdAndDelete(accountId);
      console.log("✅ [ACCOUNT-DEBUG] Account deleted permanently");
      
      res.status(200).json({
        success: true,
        message: 'Compte supprimé définitivement',
        timestamp: new Date().toISOString()
      });
    } else {
      account.isActive = false;
      account.isDefault = false;
      await account.save();
      
      console.log("✅ [ACCOUNT-DEBUG] Account deactivated");

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
    console.log("❌ [ACCOUNT-DEBUG] Delete account error:", error.message);

    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du compte',
      error: 'account_deletion_error',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Ajuster le solde d'un compte - VERSION DEBUG
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
      console.log("🔍 [ACCOUNT-DEBUG] Adjust balance called");
      console.log("🔍 [ACCOUNT-DEBUG] Amount:", req.body.amount);
      console.log("🔍 [ACCOUNT-DEBUG] Description:", req.body.description);
      
      const userId = req.user.userId;
      const { accountId } = req.params;
      const { amount, description } = req.body;

      const account = await Account.findOne({
        _id: accountId,
        user: userId,
        isActive: true
      });

      if (!account) {
        console.log("❌ [ACCOUNT-DEBUG] Account not found for balance adjustment");
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
      console.log("✅ [ACCOUNT-DEBUG] Balance adjusted successfully");

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
      console.log("❌ [ACCOUNT-DEBUG] Adjust balance error:", error.message);

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
 * Définir un compte comme compte par défaut - VERSION DEBUG
 */
const setDefaultAccount = async (req, res) => {
  try {
    console.log("🔍 [ACCOUNT-DEBUG] Set default account called");
    
    const userId = req.user.userId;
    const { accountId } = req.params;

    const account = await Account.findOne({
      _id: accountId,
      user: userId,
      isActive: true
    });

    if (!account) {
      console.log("❌ [ACCOUNT-DEBUG] Account not found for set default");
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

    console.log("✅ [ACCOUNT-DEBUG] Default account set successfully");

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
    console.log("❌ [ACCOUNT-DEBUG] Set default account error:", error.message);

    res.status(500).json({
      success: false,
      message: 'Erreur lors de la définition du compte par défaut',
      error: 'set_default_error',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Archiver un compte - VERSION DEBUG
 */
const archiveAccount = async (req, res) => {
  try {
    console.log("🔍 [ACCOUNT-DEBUG] Archive account called");
    
    const userId = req.user.userId;
    const { accountId } = req.params;
    const { reason = 'user_request' } = req.body;

    const account = await Account.findOne({
      _id: accountId,
      user: userId
    });

    if (!account) {
      console.log("❌ [ACCOUNT-DEBUG] Account not found for archive");
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
        console.log("❌ [ACCOUNT-DEBUG] Cannot archive only active account");
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
    console.log("✅ [ACCOUNT-DEBUG] Account archived successfully");

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
    console.log("❌ [ACCOUNT-DEBUG] Archive account error:", error.message);

    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'archivage du compte',
      error: 'archive_error',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Désarchiver un compte - VERSION DEBUG
 */
const unarchiveAccount = async (req, res) => {
  try {
    console.log("🔍 [ACCOUNT-DEBUG] Unarchive account called");
    
    const userId = req.user.userId;
    const { accountId } = req.params;

    const account = await Account.findOne({
      _id: accountId,
      user: userId,
      isArchived: true
    });

    if (!account) {
      console.log("❌ [ACCOUNT-DEBUG] Archived account not found");
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
    console.log("✅ [ACCOUNT-DEBUG] Account unarchived successfully");

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
    console.log("❌ [ACCOUNT-DEBUG] Unarchive account error:", error.message);

    res.status(500).json({
      success: false,
      message: 'Erreur lors du désarchivage du compte',
      error: 'unarchive_error',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Test complet des constantes - VERSION DEBUG AVANCÉE
 */
const testConstants = (req, res) => {
  console.log("🧪 [ACCOUNT-DEBUG] ===== ADVANCED CONSTANTS TEST =====");
  
  try {
    // Import direct des constantes pour test
    const constants = require('../utils/constants');
    console.log("🧪 [ACCOUNT-DEBUG] Direct constants import successful");
    
    // Test de structure détaillé
    const structureTest = {
      HAITI_BANKS: {
        type: typeof constants.HAITI_BANKS,
        isArray: Array.isArray(constants.HAITI_BANKS),
        hasMapMethod: typeof constants.HAITI_BANKS.map,
        keys: Object.keys(constants.HAITI_BANKS),
        keysCount: Object.keys(constants.HAITI_BANKS).length,
        sampleValues: Object.entries(constants.HAITI_BANKS).slice(0, 2)
      },
      ACCOUNT_TYPES: {
        type: typeof constants.ACCOUNT_TYPES,
        isArray: Array.isArray(constants.ACCOUNT_TYPES),
        keys: Object.keys(constants.ACCOUNT_TYPES),
        keysCount: Object.keys(constants.ACCOUNT_TYPES).length,
        sampleValues: Object.entries(constants.ACCOUNT_TYPES).slice(0, 2)
      },
      CURRENCIES: {
        type: typeof constants.CURRENCIES,
        isArray: Array.isArray(constants.CURRENCIES),
        keys: Object.keys(constants.CURRENCIES),
        keysCount: Object.keys(constants.CURRENCIES).length,
        sampleValues: Object.entries(constants.CURRENCIES)
      }
    };
    
    console.log("🧪 [ACCOUNT-DEBUG] Structure test results:", structureTest);
    
    // Test des validations problématiques
    const validationTest = {
      typeValidation: {
        inputValue: "checking",
        keysMethod: Object.keys(constants.ACCOUNT_TYPES).includes("checking"),
        valuesMethod: Object.values(constants.ACCOUNT_TYPES).includes("checking"),
        valuesActual: Object.values(constants.ACCOUNT_TYPES).map(v => v.id || v)
      },
      bankValidation: {
        inputValue: "buh",
        keysMethod: Object.keys(constants.HAITI_BANKS).includes("buh"),
        mapMethodError: null,
        availableBanks: Object.keys(constants.HAITI_BANKS)
      },
      currencyValidation: {
        inputValue: "HTG",
        keysMethod: Object.keys(constants.CURRENCIES).includes("HTG"),
        availableCurrencies: Object.keys(constants.CURRENCIES)
      }
    };
    
    // Test de la méthode .map() problématique
    try {
      const mapResult = constants.HAITI_BANKS.map(x => x);
      validationTest.bankValidation.mapMethodError = "Map method worked unexpectedly: " + JSON.stringify(mapResult);
    } catch (error) {
      validationTest.bankValidation.mapMethodError = "Map method failed as expected: " + error.message;
    }
    
    console.log("🧪 [ACCOUNT-DEBUG] Validation test results:", validationTest);
    
    // Test de simulation de payload
    const testPayload = {
      name: "Test Account Debug",
      type: "checking", 
      bankName: "buh",
      currency: "HTG",
      initialBalance: 1000
    };
    
    const payloadValidation = {
      type: Object.keys(constants.ACCOUNT_TYPES).includes(testPayload.type),
      bankName: Object.keys(constants.HAITI_BANKS).includes(testPayload.bankName),
      currency: Object.keys(constants.CURRENCIES).includes(testPayload.currency)
    };
    
    console.log("🧪 [ACCOUNT-DEBUG] Payload validation:", payloadValidation);
    
    const allValid = Object.values(payloadValidation).every(v => v === true);
    console.log("🧪 [ACCOUNT-DEBUG] All validations pass:", allValid);
    
    const response = {
      success: true,
      debug: true,
      timestamp: new Date().toISOString(),
      message: "Test complet des constantes effectué",
      results: {
        structureTest,
        validationTest,
        payloadValidation,
        allValid,
        testPayload,
        recommendation: allValid ? 
          "Les constantes sont correctes. Le problème vient probablement du cache ou du serveur." : 
          "Il y a un problème avec les constantes. Vérifiez leur structure."
      }
    };
    
    console.log("🧪 [ACCOUNT-DEBUG] Final response:", response);
    console.log("🧪 [ACCOUNT-DEBUG] ===== END ADVANCED CONSTANTS TEST =====");
    
    res.json(response);
    
  } catch (error) {
    console.log("❌ [ACCOUNT-DEBUG] Constants test error:", error.message);
    console.log("❌ [ACCOUNT-DEBUG] Error stack:", error.stack);
    
    res.status(500).json({
      success: false,
      debug: true,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
};

// ===================================================================
// EXPORTS AVEC DEBUG
// ===================================================================

console.log("🔍 [ACCOUNT-DEBUG] Setting up module exports...");

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
  
  // Debug functions
  testValidation,
  testConstants,
  
  // Utilities
  sanitizeAccountData,
  formatValidationErrors
};

console.log("✅ [ACCOUNT-DEBUG] Account controller module exports ready");
console.log("✅ [ACCOUNT-DEBUG] Available functions:", Object.keys(module.exports));
console.log("🔍 [ACCOUNT-DEBUG] ===== ACCOUNT CONTROLLER DEBUG SETUP COMPLETE =====");