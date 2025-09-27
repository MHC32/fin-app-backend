// src/routes/debts.js
// Routes pour gestion dettes et créances

const express = require('express');
const router = express.Router();
const DebtController = require('../controllers/debtController');
const { authenticate } = require('../middleware/auth');
const { body, param, query } = require('express-validator');

// Middleware auth pour toutes les routes
router.use(authenticate);

/**
 * POST /api/debts
 * Créer une nouvelle dette/créance
 */
router.post(
  '/',
  [
    body('type')
      .isIn(['debt', 'loan'])
      .withMessage('Type doit être "debt" ou "loan"'),
    body('contact.name')
      .notEmpty()
      .withMessage('Nom du contact requis')
      .trim(),
    body('amount')
      .isNumeric()
      .withMessage('Montant doit être un nombre')
      .isFloat({ min: 0 })
      .withMessage('Montant doit être positif'),
    body('currency')
      .optional()
      .isIn(['HTG', 'USD'])
      .withMessage('Devise doit être HTG ou USD'),
    body('dueDate')
      .optional()
      .isISO8601()
      .withMessage('Date d\'échéance invalide'),
    body('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'urgent'])
      .withMessage('Priorité invalide')
  ],
  DebtController.createDebt
);

/**
 * GET /api/debts
 * Liste toutes les dettes/créances
 */
router.get(
  '/',
  [
    query('type')
      .optional()
      .isIn(['debt', 'loan'])
      .withMessage('Type doit être "debt" ou "loan"'),
    query('status')
      .optional()
      .isIn(['active', 'partially_paid', 'paid', 'overdue', 'cancelled'])
      .withMessage('Statut invalide'),
    query('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'urgent'])
      .withMessage('Priorité invalide')
  ],
  DebtController.getDebts
);

/**
 * GET /api/debts/summary
 * Résumé financier
 */
router.get('/summary', DebtController.getSummary);

/**
 * GET /api/debts/:id
 * Détails d'une dette/créance
 */
router.get(
  '/:id',
  [
    param('id')
      .isMongoId()
      .withMessage('ID invalide')
  ],
  DebtController.getDebtById
);

/**
 * PUT /api/debts/:id
 * Modifier une dette/créance
 */
router.put(
  '/:id',
  [
    param('id')
      .isMongoId()
      .withMessage('ID invalide'),
    body('amount')
      .optional()
      .isNumeric()
      .withMessage('Montant doit être un nombre'),
    body('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'urgent'])
      .withMessage('Priorité invalide'),
    body('status')
      .optional()
      .isIn(['active', 'partially_paid', 'paid', 'overdue', 'cancelled'])
      .withMessage('Statut invalide')
  ],
  DebtController.updateDebt
);

/**
 * DELETE /api/debts/:id
 * Supprimer une dette/créance
 */
router.delete(
  '/:id',
  [
    param('id')
      .isMongoId()
      .withMessage('ID invalide')
  ],
  DebtController.deleteDebt
);

/**
 * POST /api/debts/:id/payment
 * Enregistrer un paiement
 */
router.post(
  '/:id/payment',
  [
    param('id')
      .isMongoId()
      .withMessage('ID invalide'),
    body('amount')
      .isNumeric()
      .withMessage('Montant requis')
      .isFloat({ min: 0.01 })
      .withMessage('Montant doit être positif'),
    body('date')
      .optional()
      .isISO8601()
      .withMessage('Date invalide'),
    body('paymentMethod')
      .optional()
      .isIn(['cash', 'moncash', 'bank_transfer', 'check', 'other'])
      .withMessage('Méthode de paiement invalide'),
    body('createTransaction')
      .optional()
      .isBoolean()
      .withMessage('createTransaction doit être boolean')
  ],
  DebtController.addPayment
);

/**
 * GET /api/debts/:id/payments
 * Historique des paiements
 */
router.get(
  '/:id/payments',
  [
    param('id')
      .isMongoId()
      .withMessage('ID invalide')
  ],
  DebtController.getPayments
);

/**
 * POST /api/debts/:id/reminder
 * Créer un rappel
 */
router.post(
  '/:id/reminder',
  [
    param('id')
      .isMongoId()
      .withMessage('ID invalide'),
    body('date')
      .isISO8601()
      .withMessage('Date de rappel requise'),
    body('type')
      .isIn(['payment_due', 'overdue', 'custom'])
      .withMessage('Type de rappel invalide'),
    body('message')
      .optional()
      .trim()
  ],
  DebtController.createReminder
);

/**
 * PUT /api/debts/:id/archive
 * Archiver/Désarchiver
 */
router.put(
  '/:id/archive',
  [
    param('id')
      .isMongoId()
      .withMessage('ID invalide')
  ],
  DebtController.toggleArchive
);

/**
 * POST /api/debts/:id/calculate-interest
 * Calculer et appliquer intérêts
 */
router.post(
  '/:id/calculate-interest',
  [
    param('id')
      .isMongoId()
      .withMessage('ID invalide')
  ],
  DebtController.calculateInterest
);

module.exports = router;