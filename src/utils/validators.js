/**
 * Validations custom avancées
 * FinApp Haiti - Backend MVP
 */

const mongoose = require('mongoose');

/**
 * Valide un ObjectId MongoDB
 * @param {string} id - ID à valider
 * @returns {boolean}
 */
const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

/**
 * Valide un email
 * @param {string} email - Email à valider
 * @returns {boolean}
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Valide un numéro de téléphone haïtien
 * Formats acceptés: +50937123456, 50937123456, 37123456, 3712-3456
 * @param {string} phone - Téléphone à valider
 * @returns {boolean}
 */
const isValidHaitianPhone = (phone) => {
  // Retire espaces et tirets
  const cleaned = phone.replace(/[\s-]/g, '');
  
  // Formats valides:
  // +50937123456 (12 chars)
  // 50937123456 (11 chars)
  // 37123456 (8 chars)
  const patterns = [
    /^\+509[2-4][0-9]{7}$/,  // +509 + indicatif opérateur + 7 chiffres
    /^509[2-4][0-9]{7}$/,     // 509 + indicatif opérateur + 7 chiffres
    /^[2-4][0-9]{7}$/         // Indicatif opérateur + 7 chiffres
  ];
  
  return patterns.some(pattern => pattern.test(cleaned));
};

/**
 * Valide un mot de passe fort
 * Règles: Min 8 chars, 1 majuscule, 1 minuscule, 1 chiffre, 1 caractère spécial
 * @param {string} password - Mot de passe
 * @returns {object} { valid: boolean, errors: string[] }
 */
const validateStrongPassword = (password) => {
  const errors = [];
  
  if (password.length < 8) {
    errors.push('Le mot de passe doit contenir au moins 8 caractères');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Le mot de passe doit contenir au moins une majuscule');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Le mot de passe doit contenir au moins une minuscule');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Le mot de passe doit contenir au moins un chiffre');
  }
  
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Le mot de passe doit contenir au moins un caractère spécial');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Valide une URL
 * @param {string} url - URL à valider
 * @returns {boolean}
 */
const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Valide un montant financier
 * @param {number} amount - Montant
 * @param {object} options - Options (min, max)
 * @returns {object} { valid: boolean, error: string }
 */
const validateAmount = (amount, options = {}) => {
  const { min = 0, max = Infinity } = options;
  
  if (typeof amount !== 'number' || isNaN(amount)) {
    return { valid: false, error: 'Le montant doit être un nombre valide' };
  }
  
  if (amount < min) {
    return { valid: false, error: `Le montant doit être supérieur ou égal à ${min}` };
  }
  
  if (amount > max) {
    return { valid: false, error: `Le montant doit être inférieur ou égal à ${max}` };
  }
  
  return { valid: true };
};

/**
 * Valide une devise (HTG ou USD)
 * @param {string} currency - Devise
 * @returns {boolean}
 */
const isValidCurrency = (currency) => {
  return ['HTG', 'USD'].includes(currency);
};

/**
 * Valide une date
 * @param {*} date - Date à valider
 * @param {object} options - Options (allowFuture, allowPast)
 * @returns {object} { valid: boolean, error: string }
 */
const validateDate = (date, options = {}) => {
  const { allowFuture = true, allowPast = true } = options;
  
  const dateObj = new Date(date);
  
  if (isNaN(dateObj.getTime())) {
    return { valid: false, error: 'Date invalide' };
  }
  
  const now = new Date();
  
  if (!allowFuture && dateObj > now) {
    return { valid: false, error: 'La date ne peut pas être dans le futur' };
  }
  
  if (!allowPast && dateObj < now) {
    return { valid: false, error: 'La date ne peut pas être dans le passé' };
  }
  
  return { valid: true };
};

/**
 * Valide une plage de dates
 * @param {Date} startDate - Date début
 * @param {Date} endDate - Date fin
 * @returns {object} { valid: boolean, error: string }
 */
const validateDateRange = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (isNaN(start.getTime())) {
    return { valid: false, error: 'Date de début invalide' };
  }
  
  if (isNaN(end.getTime())) {
    return { valid: false, error: 'Date de fin invalide' };
  }
  
  if (start > end) {
    return { valid: false, error: 'La date de début doit être antérieure à la date de fin' };
  }
  
  return { valid: true };
};

/**
 * Valide un pourcentage (0-100)
 * @param {number} percentage - Pourcentage
 * @returns {object} { valid: boolean, error: string }
 */
const validatePercentage = (percentage) => {
  if (typeof percentage !== 'number' || isNaN(percentage)) {
    return { valid: false, error: 'Le pourcentage doit être un nombre valide' };
  }
  
  if (percentage < 0 || percentage > 100) {
    return { valid: false, error: 'Le pourcentage doit être entre 0 et 100' };
  }
  
  return { valid: true };
};

/**
 * Valide un taux d'intérêt
 * @param {number} rate - Taux
 * @returns {object} { valid: boolean, error: string }
 */
const validateInterestRate = (rate) => {
  if (typeof rate !== 'number' || isNaN(rate)) {
    return { valid: false, error: 'Le taux doit être un nombre valide' };
  }
  
  if (rate < 0) {
    return { valid: false, error: 'Le taux ne peut pas être négatif' };
  }
  
  if (rate > 100) {
    return { valid: false, error: 'Le taux ne peut pas dépasser 100%' };
  }
  
  return { valid: true };
};

/**
 * Valide une fréquence de sol
 * @param {string} frequency - Fréquence
 * @returns {boolean}
 */
const isValidSolFrequency = (frequency) => {
  return ['daily', 'weekly', 'monthly'].includes(frequency);
};

/**
 * Valide un statut de sol
 * @param {string} status - Statut
 * @returns {boolean}
 */
const isValidSolStatus = (status) => {
  return ['active', 'completed', 'cancelled'].includes(status);
};

/**
 * Valide un type de transaction
 * @param {string} type - Type
 * @returns {boolean}
 */
const isValidTransactionType = (type) => {
  return ['income', 'expense'].includes(type);
};

/**
 * Valide une catégorie de transaction
 * @param {string} category - Catégorie
 * @returns {boolean}
 */
const isValidTransactionCategory = (category) => {
  const validCategories = [
    // Revenus
    'salary', 'business', 'investment', 'gift', 'other_income',
    // Dépenses
    'food', 'transport', 'housing', 'utilities', 'health', 'education',
    'entertainment', 'shopping', 'debt_payment', 'savings', 'other_expense'
  ];
  
  return validCategories.includes(category);
};

/**
 * Valide un type d'investissement
 * @param {string} type - Type
 * @returns {boolean}
 */
const isValidInvestmentType = (type) => {
  return ['stock', 'bond', 'real_estate', 'business', 'crypto', 'other'].includes(type);
};

/**
 * Valide un type de dette
 * @param {string} type - Type
 * @returns {boolean}
 */
const isValidDebtType = (type) => {
  return ['personal', 'credit_card', 'mortgage', 'student', 'business', 'other'].includes(type);
};

/**
 * Valide une période de budget
 * @param {string} period - Période
 * @returns {boolean}
 */
const isValidBudgetPeriod = (period) => {
  return ['weekly', 'monthly', 'yearly'].includes(period);
};

/**
 * Valide un fichier (taille et type)
 * @param {object} file - Fichier
 * @param {object} options - Options (maxSize, allowedTypes)
 * @returns {object} { valid: boolean, error: string }
 */
const validateFile = (file, options = {}) => {
  const {
    maxSize = 5 * 1024 * 1024, // 5MB par défaut
    allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
  } = options;
  
  if (!file) {
    return { valid: false, error: 'Aucun fichier fourni' };
  }
  
  if (file.size > maxSize) {
    const maxSizeMB = maxSize / (1024 * 1024);
    return { valid: false, error: `La taille du fichier ne peut pas dépasser ${maxSizeMB}MB` };
  }
  
  if (!allowedTypes.includes(file.mimetype)) {
    return { valid: false, error: `Type de fichier non autorisé. Types acceptés: ${allowedTypes.join(', ')}` };
  }
  
  return { valid: true };
};

/**
 * Valide un array (longueur)
 * @param {Array} arr - Array
 * @param {object} options - Options (min, max)
 * @returns {object} { valid: boolean, error: string }
 */
const validateArray = (arr, options = {}) => {
  const { min = 0, max = Infinity } = options;
  
  if (!Array.isArray(arr)) {
    return { valid: false, error: 'Doit être un tableau' };
  }
  
  if (arr.length < min) {
    return { valid: false, error: `Le tableau doit contenir au moins ${min} élément(s)` };
  }
  
  if (arr.length > max) {
    return { valid: false, error: `Le tableau ne peut pas contenir plus de ${max} élément(s)` };
  }
  
  return { valid: true };
};

/**
 * Valide un champ requis
 * @param {*} value - Valeur
 * @param {string} fieldName - Nom du champ
 * @returns {object} { valid: boolean, error: string }
 */
const validateRequired = (value, fieldName) => {
  if (value === undefined || value === null || value === '') {
    return { valid: false, error: `${fieldName} est requis` };
  }
  
  return { valid: true };
};

/**
 * Valide une longueur de string
 * @param {string} str - String
 * @param {object} options - Options (min, max)
 * @returns {object} { valid: boolean, error: string }
 */
const validateStringLength = (str, options = {}) => {
  const { min = 0, max = Infinity } = options;
  
  if (typeof str !== 'string') {
    return { valid: false, error: 'Doit être une chaîne de caractères' };
  }
  
  if (str.length < min) {
    return { valid: false, error: `Doit contenir au moins ${min} caractère(s)` };
  }
  
  if (str.length > max) {
    return { valid: false, error: `Ne peut pas dépasser ${max} caractère(s)` };
  }
  
  return { valid: true };
};

/**
 * Valide un format de code postal (Haiti)
 * @param {string} postalCode - Code postal
 * @returns {boolean}
 */
const isValidHaitianPostalCode = (postalCode) => {
  // Format Haiti: HT + 4 chiffres (ex: HT6110)
  return /^HT\d{4}$/.test(postalCode);
};

/**
 * Sanitize HTML (retire les tags)
 * @param {string} str - String à nettoyer
 * @returns {string} String nettoyée
 */
const sanitizeHtml = (str) => {
  if (typeof str !== 'string') return str;
  return str.replace(/<[^>]*>/g, '');
};

/**
 * Valide un numéro NIF (Numéro d'Identification Fiscale - Haiti)
 * Format: 9 chiffres
 * @param {string} nif - NIF
 * @returns {boolean}
 */
const isValidNIF = (nif) => {
  return /^\d{9}$/.test(nif);
};

/**
 * Valide une coordonnée géographique
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {object} { valid: boolean, error: string }
 */
const validateCoordinates = (lat, lng) => {
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return { valid: false, error: 'Les coordonnées doivent être des nombres' };
  }
  
  if (lat < -90 || lat > 90) {
    return { valid: false, error: 'La latitude doit être entre -90 et 90' };
  }
  
  if (lng < -180 || lng > 180) {
    return { valid: false, error: 'La longitude doit être entre -180 et 180' };
  }
  
  return { valid: true };
};

/**
 * Valide un username
 * @param {string} username - Username
 * @returns {object} { valid: boolean, error: string }
 */
const validateUsername = (username) => {
  if (typeof username !== 'string') {
    return { valid: false, error: 'Le username doit être une chaîne de caractères' };
  }
  
  if (username.length < 3 || username.length > 30) {
    return { valid: false, error: 'Le username doit contenir entre 3 et 30 caractères' };
  }
  
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return { valid: false, error: 'Le username ne peut contenir que des lettres, chiffres, tirets et underscores' };
  }
  
  return { valid: true };
};

/**
 * Valide un JSON string
 * @param {string} str - JSON string
 * @returns {object} { valid: boolean, error: string, data: object }
 */
const validateJson = (str) => {
  try {
    const data = JSON.parse(str);
    return { valid: true, data };
  } catch (error) {
    return { valid: false, error: 'JSON invalide', data: null };
  }
};

/**
 * Valide un hex color
 * @param {string} color - Couleur hex
 * @returns {boolean}
 */
const isValidHexColor = (color) => {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
};

/**
 * Valide une durée (en secondes)
 * @param {number} duration - Durée
 * @param {object} options - Options (min, max)
 * @returns {object} { valid: boolean, error: string }
 */
const validateDuration = (duration, options = {}) => {
  const { min = 0, max = Infinity } = options;
  
  if (typeof duration !== 'number' || isNaN(duration)) {
    return { valid: false, error: 'La durée doit être un nombre valide' };
  }
  
  if (duration < min) {
    return { valid: false, error: `La durée doit être d'au moins ${min} seconde(s)` };
  }
  
  if (duration > max) {
    return { valid: false, error: `La durée ne peut pas dépasser ${max} seconde(s)` };
  }
  
  return { valid: true };
};

module.exports = {
  // IDs & Basic
  isValidObjectId,
  isValidEmail,
  isValidUrl,
  
  // Phone & Location
  isValidHaitianPhone,
  isValidHaitianPostalCode,
  isValidNIF,
  validateCoordinates,
  
  // Security
  validateStrongPassword,
  validateUsername,
  sanitizeHtml,
  
  // Finance
  validateAmount,
  isValidCurrency,
  validatePercentage,
  validateInterestRate,
  
  // Dates
  validateDate,
  validateDateRange,
  validateDuration,
  
  // Sol specific
  isValidSolFrequency,
  isValidSolStatus,
  
  // Transactions
  isValidTransactionType,
  isValidTransactionCategory,
  
  // Investments & Debts
  isValidInvestmentType,
  isValidDebtType,
  
  // Budget
  isValidBudgetPeriod,
  
  // Files & Data
  validateFile,
  validateArray,
  validateJson,
  
  // Generic
  validateRequired,
  validateStringLength,
  isValidHexColor
};