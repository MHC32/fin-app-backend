const Joi = require('joi');

/**
 * MIDDLEWARE DE VALIDATION CENTRALISÉE
 * Valide les données entrantes avec Joi
 * Support validation body, query, params
 */

// ==========================================
// SCHEMAS DE VALIDATION RÉUTILISABLES
// ==========================================

const schemas = {
  // MongoDB ObjectId
  objectId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).messages({
    'string.pattern.base': 'ID invalide'
  }),

  // Email
  email: Joi.string().email().lowercase().trim(),

  // Téléphone Haiti (+509)
  phone: Joi.string().regex(/^(\+509)?[0-9]{8}$/).messages({
    'string.pattern.base': 'Numéro de téléphone invalide (format: +509XXXXXXXX ou XXXXXXXX)'
  }),

  // Montant financier
  amount: Joi.number().positive().precision(2).messages({
    'number.positive': 'Le montant doit être positif',
    'number.base': 'Montant invalide'
  }),

  // Devise
  currency: Joi.string().valid('HTG', 'USD').uppercase(),

  // Date
  date: Joi.date().iso(),

  // Pagination
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),

  // Recherche
  search: Joi.string().trim().min(2).max(100),

  // Catégories Haiti
  category: Joi.string().valid(
    'alimentation',
    'transport',
    'logement',
    'santé',
    'éducation',
    'divertissement',
    'services',
    'carburant',
    'électricité',
    'eau',
    'internet',
    'téléphone',
    'autre'
  ),

  // Types de comptes
  accountType: Joi.string().valid(
    'courant',
    'epargne',
    'moncash',
    'natcash',
    'cash'
  ),

  // Statuts
  status: Joi.string().valid('active', 'inactive', 'pending', 'completed', 'cancelled'),

  // Priorités
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent')
};

// ==========================================
// SCHEMAS COMPLETS PAR MODULE
// ==========================================

const validationSchemas = {
  // AUTH
  auth: {
    register: Joi.object({
      firstName: Joi.string().trim().min(2).max(50).required(),
      lastName: Joi.string().trim().min(2).max(50).required(),
      email: schemas.email.required(),
      password: Joi.string().min(8).max(100).required()
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .messages({
          'string.pattern.base': 'Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre'
        }),
      phone: schemas.phone.optional()
    }),

    login: Joi.object({
      email: schemas.email.required(),
      password: Joi.string().required()
    }),

    resetPassword: Joi.object({
      email: schemas.email.required()
    }),

    updatePassword: Joi.object({
      currentPassword: Joi.string().required(),
      newPassword: Joi.string().min(8).max(100).required()
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    })
  },

  // ACCOUNTS
  account: {
    create: Joi.object({
      name: Joi.string().trim().min(2).max(100).required(),
      type: schemas.accountType.required(),
      currency: schemas.currency.default('HTG'),
      balance: schemas.amount.default(0),
      description: Joi.string().max(500).optional()
    }),

    update: Joi.object({
      name: Joi.string().trim().min(2).max(100).optional(),
      type: schemas.accountType.optional(),
      description: Joi.string().max(500).optional()
    })
  },

  // TRANSACTIONS
  transaction: {
    create: Joi.object({
      accountId: schemas.objectId.required(),
      type: Joi.string().valid('income', 'expense', 'transfer').required(),
      amount: schemas.amount.required(),
      currency: schemas.currency.default('HTG'),
      category: schemas.category.required(),
      description: Joi.string().max(500).optional(),
      date: schemas.date.default(() => new Date()),
      tags: Joi.array().items(Joi.string().trim()).max(10).optional(),
      toAccountId: Joi.when('type', {
        is: 'transfer',
        then: schemas.objectId.required(),
        otherwise: Joi.forbidden()
      })
    }),

    update: Joi.object({
      category: schemas.category.optional(),
      description: Joi.string().max(500).optional(),
      tags: Joi.array().items(Joi.string().trim()).max(10).optional()
    }),

    filter: Joi.object({
      accountId: schemas.objectId.optional(),
      type: Joi.string().valid('income', 'expense', 'transfer').optional(),
      category: schemas.category.optional(),
      startDate: schemas.date.optional(),
      endDate: schemas.date.optional(),
      minAmount: schemas.amount.optional(),
      maxAmount: schemas.amount.optional(),
      page: schemas.page,
      limit: schemas.limit
    })
  },

  // BUDGETS
  budget: {
    create: Joi.object({
      name: Joi.string().trim().min(2).max(100).required(),
      category: schemas.category.required(),
      amount: schemas.amount.required(),
      currency: schemas.currency.default('HTG'),
      period: Joi.string().valid('weekly', 'monthly', 'yearly').required(),
      startDate: schemas.date.default(() => new Date()),
      endDate: schemas.date.optional(),
      alertThreshold: Joi.number().min(50).max(100).default(90)
    }),

    update: Joi.object({
      name: Joi.string().trim().min(2).max(100).optional(),
      amount: schemas.amount.optional(),
      alertThreshold: Joi.number().min(50).max(100).optional()
    })
  },

  // SOLS
  sol: {
    create: Joi.object({
      name: Joi.string().trim().min(2).max(100).required(),
      amount: schemas.amount.required(),
      currency: schemas.currency.default('HTG'),
      frequency: Joi.string().valid('daily', 'weekly', 'biweekly', 'monthly').required(),
      participants: Joi.number().integer().min(2).max(100).required(),
      startDate: schemas.date.default(() => new Date()),
      endDate: schemas.date.optional(),
      description: Joi.string().max(500).optional()
    }),

    addParticipant: Joi.object({
      name: Joi.string().trim().min(2).max(100).required(),
      phone: schemas.phone.optional(),
      position: Joi.number().integer().min(1).required()
    }),

    recordPayment: Joi.object({
      participantId: schemas.objectId.required(),
      amount: schemas.amount.required(),
      date: schemas.date.default(() => new Date()),
      notes: Joi.string().max(200).optional()
    })
  },

  // DEBTS
  debt: {
    create: Joi.object({
      type: Joi.string().valid('lent', 'borrowed').required(),
      amount: schemas.amount.required(),
      currency: schemas.currency.default('HTG'),
      personName: Joi.string().trim().min(2).max(100).required(),
      personPhone: schemas.phone.optional(),
      description: Joi.string().max(500).optional(),
      dueDate: schemas.date.optional(),
      interestRate: Joi.number().min(0).max(100).default(0)
    }),

    recordPayment: Joi.object({
      amount: schemas.amount.required(),
      date: schemas.date.default(() => new Date()),
      notes: Joi.string().max(200).optional()
    })
  },

  // INVESTMENTS
  investment: {
    create: Joi.object({
      name: Joi.string().trim().min(2).max(100).required(),
      type: Joi.string().valid('stock', 'bond', 'real_estate', 'business', 'crypto', 'other').required(),
      amount: schemas.amount.required(),
      currency: schemas.currency.default('HTG'),
      expectedReturn: Joi.number().min(-100).max(1000).optional(),
      startDate: schemas.date.default(() => new Date()),
      description: Joi.string().max(500).optional()
    }),

    update: Joi.object({
      currentValue: schemas.amount.optional(),
      expectedReturn: Joi.number().min(-100).max(1000).optional(),
      status: schemas.status.optional()
    })
  },

  // NOTIFICATIONS
  notification: {
    filter: Joi.object({
      type: Joi.string().valid('info', 'warning', 'error', 'success').optional(),
      priority: schemas.priority.optional(),
      isRead: Joi.boolean().optional(),
      page: schemas.page,
      limit: schemas.limit
    })
  }
};

// ==========================================
// MIDDLEWARE DE VALIDATION
// ==========================================

/**
 * Valide les données selon le schema spécifié
 * @param {string} module - Module (auth, account, transaction, etc.)
 * @param {string} action - Action (create, update, filter, etc.)
 * @param {string} source - Source des données (body, query, params)
 */
const validate = (module, action, source = 'body') => {
  return (req, res, next) => {
    // Récupérer le schema
    const schema = validationSchemas[module]?.[action];

    if (!schema) {
      return res.status(500).json({
        success: false,
        message: `Schema de validation introuvable: ${module}.${action}`
      });
    }

    // Récupérer les données à valider
    const data = req[source];

    // Valider
    const { error, value } = schema.validate(data, {
      abortEarly: false, // Retourner toutes les erreurs
      stripUnknown: true, // Supprimer les champs non définis
      convert: true // Convertir les types
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        message: 'Erreur de validation',
        errors
      });
    }

    // Remplacer les données par les données validées
    req[source] = value;
    next();
  };
};

/**
 * Valide un ObjectId MongoDB dans les params
 * @param {string} paramName - Nom du paramètre (ex: 'id', 'accountId')
 */
const validateObjectId = (paramName = 'id') => {
  return (req, res, next) => {
    const id = req.params[paramName];

    const { error } = schemas.objectId.validate(id);

    if (error) {
      return res.status(400).json({
        success: false,
        message: `ID invalide: ${paramName}`
      });
    }

    next();
  };
};

/**
 * Valide plusieurs ObjectIds dans les params
 */
const validateObjectIds = (...paramNames) => {
  return (req, res, next) => {
    const errors = [];

    for (const paramName of paramNames) {
      const id = req.params[paramName];
      const { error } = schemas.objectId.validate(id);

      if (error) {
        errors.push(`ID invalide: ${paramName}`);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Erreurs de validation',
        errors
      });
    }

    next();
  };
};

/**
 * Valide des query params pour pagination
 */
const validatePagination = () => {
  return (req, res, next) => {
    const schema = Joi.object({
      page: schemas.page,
      limit: schemas.limit,
      sort: Joi.string().valid('asc', 'desc').default('desc'),
      sortBy: Joi.string().default('createdAt')
    });

    const { error, value } = schema.validate(req.query, {
      stripUnknown: true,
      convert: true
    });

    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Paramètres de pagination invalides',
        errors: error.details.map(d => d.message)
      });
    }

    req.pagination = value;
    next();
  };
};

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  validate,
  validateObjectId,
  validateObjectIds,
  validatePagination,
  schemas,
  validationSchemas
};