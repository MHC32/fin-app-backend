/**
 * Fonctions utilitaires générales
 * FinApp Haiti - Backend MVP
 */

const crypto = require('crypto');

/**
 * Génère un ID unique aléatoire
 * @param {number} length - Longueur de l'ID (défaut: 16)
 * @returns {string} ID unique
 */
const generateUniqueId = (length = 16) => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Génère un code numérique aléatoire
 * @param {number} digits - Nombre de chiffres (défaut: 6)
 * @returns {string} Code numérique
 */
const generateNumericCode = (digits = 6) => {
  const min = Math.pow(10, digits - 1);
  const max = Math.pow(10, digits) - 1;
  return Math.floor(Math.random() * (max - min + 1) + min).toString();
};

/**
 * Génère un slug à partir d'un texte
 * @param {string} text - Texte à convertir
 * @returns {string} Slug formaté
 */
const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')        // Espaces → tirets
    .replace(/[^\w\-]+/g, '')    // Caractères non-alphanumériques
    .replace(/\-\-+/g, '-')      // Tirets multiples → simple
    .replace(/^-+/, '')          // Tirets début
    .replace(/-+$/, '');         // Tirets fin
};

/**
 * Nettoie un objet en supprimant les valeurs nulles/undefined
 * @param {object} obj - Objet à nettoyer
 * @returns {object} Objet nettoyé
 */
const cleanObject = (obj) => {
  return Object.entries(obj).reduce((acc, [key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      acc[key] = value;
    }
    return acc;
  }, {});
};

/**
 * Masque des informations sensibles
 * @param {string} value - Valeur à masquer
 * @param {number} visibleChars - Nombre de caractères visibles au début (défaut: 4)
 * @returns {string} Valeur masquée
 */
const maskSensitiveData = (value, visibleChars = 4) => {
  if (!value || value.length <= visibleChars) return value;
  
  const visible = value.slice(0, visibleChars);
  const masked = '*'.repeat(value.length - visibleChars);
  return visible + masked;
};

/**
 * Masque un email
 * @param {string} email - Email à masquer
 * @returns {string} Email masqué
 */
const maskEmail = (email) => {
  if (!email || !email.includes('@')) return email;
  
  const [local, domain] = email.split('@');
  const maskedLocal = local.charAt(0) + '*'.repeat(local.length - 2) + local.charAt(local.length - 1);
  return `${maskedLocal}@${domain}`;
};

/**
 * Masque un numéro de téléphone
 * @param {string} phone - Téléphone à masquer
 * @returns {string} Téléphone masqué
 */
const maskPhone = (phone) => {
  if (!phone || phone.length < 4) return phone;
  
  const visible = phone.slice(-4);
  const masked = '*'.repeat(phone.length - 4);
  return masked + visible;
};

/**
 * Arrondit un nombre à N décimales
 * @param {number} value - Valeur à arrondir
 * @param {number} decimals - Nombre de décimales (défaut: 2)
 * @returns {number} Valeur arrondie
 */
const roundNumber = (value, decimals = 2) => {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
};

/**
 * Calcule un pourcentage
 * @param {number} value - Valeur
 * @param {number} total - Total
 * @param {number} decimals - Décimales (défaut: 2)
 * @returns {number} Pourcentage
 */
const calculatePercentage = (value, total, decimals = 2) => {
  if (total === 0) return 0;
  return roundNumber((value / total) * 100, decimals);
};

/**
 * Vérifie si une valeur est un objet
 * @param {*} value - Valeur à vérifier
 * @returns {boolean}
 */
const isObject = (value) => {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
};

/**
 * Deep clone d'un objet
 * @param {*} obj - Objet à cloner
 * @returns {*} Clone de l'objet
 */
const deepClone = (obj) => {
  if (obj === null || typeof obj !== 'object') return obj;
  
  if (obj instanceof Date) return new Date(obj);
  if (obj instanceof Array) return obj.map(item => deepClone(item));
  
  if (obj instanceof Object) {
    const clone = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clone[key] = deepClone(obj[key]);
      }
    }
    return clone;
  }
  
  return obj;
};

/**
 * Merge profond de deux objets
 * @param {object} target - Objet cible
 * @param {object} source - Objet source
 * @returns {object} Objet mergé
 */
const deepMerge = (target, source) => {
  const output = { ...target };
  
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  
  return output;
};

/**
 * Récupère une valeur nested dans un objet
 * @param {object} obj - Objet
 * @param {string} path - Chemin (ex: 'user.profile.name')
 * @param {*} defaultValue - Valeur par défaut
 * @returns {*} Valeur trouvée ou défaut
 */
const getNestedValue = (obj, path, defaultValue = null) => {
  const keys = path.split('.');
  let value = obj;
  
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return defaultValue;
    }
  }
  
  return value;
};

/**
 * Définit une valeur nested dans un objet
 * @param {object} obj - Objet
 * @param {string} path - Chemin
 * @param {*} value - Valeur
 * @returns {object} Objet modifié
 */
const setNestedValue = (obj, path, value) => {
  const keys = path.split('.');
  const lastKey = keys.pop();
  let current = obj;
  
  for (const key of keys) {
    if (!(key in current) || !isObject(current[key])) {
      current[key] = {};
    }
    current = current[key];
  }
  
  current[lastKey] = value;
  return obj;
};

/**
 * Retire les doublons d'un array
 * @param {Array} arr - Array
 * @param {string} key - Clé pour objets (optionnel)
 * @returns {Array} Array sans doublons
 */
const removeDuplicates = (arr, key = null) => {
  if (!key) {
    return [...new Set(arr)];
  }
  
  const seen = new Set();
  return arr.filter(item => {
    const value = item[key];
    if (seen.has(value)) {
      return false;
    }
    seen.add(value);
    return true;
  });
};

/**
 * Groupe un array par clé
 * @param {Array} arr - Array d'objets
 * @param {string} key - Clé de groupement
 * @returns {object} Objets groupés
 */
const groupBy = (arr, key) => {
  return arr.reduce((acc, item) => {
    const group = item[key];
    if (!acc[group]) {
      acc[group] = [];
    }
    acc[group].push(item);
    return acc;
  }, {});
};

/**
 * Trie un array d'objets
 * @param {Array} arr - Array à trier
 * @param {string} key - Clé de tri
 * @param {string} order - 'asc' ou 'desc' (défaut: 'asc')
 * @returns {Array} Array trié
 */
const sortBy = (arr, key, order = 'asc') => {
  return [...arr].sort((a, b) => {
    const aVal = getNestedValue(a, key);
    const bVal = getNestedValue(b, key);
    
    if (aVal < bVal) return order === 'asc' ? -1 : 1;
    if (aVal > bVal) return order === 'asc' ? 1 : -1;
    return 0;
  });
};

/**
 * Pagine un array
 * @param {Array} arr - Array à paginer
 * @param {number} page - Numéro de page (commence à 1)
 * @param {number} limit - Éléments par page
 * @returns {object} Résultats paginés
 */
const paginate = (arr, page = 1, limit = 10) => {
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  
  return {
    data: arr.slice(startIndex, endIndex),
    pagination: {
      page,
      limit,
      total: arr.length,
      totalPages: Math.ceil(arr.length / limit),
      hasNext: endIndex < arr.length,
      hasPrev: page > 1
    }
  };
};

/**
 * Attend un délai (pour async/await)
 * @param {number} ms - Millisecondes
 * @returns {Promise}
 */
const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Retry une fonction avec backoff exponentiel
 * @param {Function} fn - Fonction à retry
 * @param {number} maxRetries - Nombre max de retry (défaut: 3)
 * @param {number} delay - Délai initial en ms (défaut: 1000)
 * @returns {Promise} Résultat de la fonction
 */
const retryWithBackoff = async (fn, maxRetries = 3, delay = 1000) => {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        const backoffDelay = delay * Math.pow(2, i);
        await sleep(backoffDelay);
      }
    }
  }
  
  throw lastError;
};

/**
 * Formatte un objet d'erreur
 * @param {Error} error - Erreur
 * @returns {object} Erreur formatée
 */
const formatError = (error) => {
  return {
    message: error.message,
    name: error.name,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    ...(error.statusCode && { statusCode: error.statusCode }),
    ...(error.code && { code: error.code })
  };
};

/**
 * Vérifie si une date est valide
 * @param {*} date - Date à vérifier
 * @returns {boolean}
 */
const isValidDate = (date) => {
  return date instanceof Date && !isNaN(date);
};

/**
 * Convertit une valeur en boolean
 * @param {*} value - Valeur
 * @returns {boolean}
 */
const toBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true' || value === '1';
  }
  return Boolean(value);
};

/**
 * Truncate un texte
 * @param {string} text - Texte
 * @param {number} length - Longueur max
 * @param {string} suffix - Suffixe (défaut: '...')
 * @returns {string} Texte tronqué
 */
const truncate = (text, length, suffix = '...') => {
  if (!text || text.length <= length) return text;
  return text.slice(0, length - suffix.length) + suffix;
};

/**
 * Capitalise la première lettre
 * @param {string} text - Texte
 * @returns {string} Texte capitalisé
 */
const capitalize = (text) => {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};

/**
 * Capitalise chaque mot
 * @param {string} text - Texte
 * @returns {string} Texte avec chaque mot capitalisé
 */
const titleCase = (text) => {
  if (!text) return text;
  return text.split(' ').map(word => capitalize(word)).join(' ');
};

module.exports = {
  // ID & Codes
  generateUniqueId,
  generateNumericCode,
  slugify,
  
  // Objets
  cleanObject,
  isObject,
  deepClone,
  deepMerge,
  getNestedValue,
  setNestedValue,
  
  // Sécurité
  maskSensitiveData,
  maskEmail,
  maskPhone,
  
  // Nombres
  roundNumber,
  calculatePercentage,
  
  // Arrays
  removeDuplicates,
  groupBy,
  sortBy,
  paginate,
  
  // Async
  sleep,
  retryWithBackoff,
  
  // Erreurs
  formatError,
  
  // Validation
  isValidDate,
  toBoolean,
  
  // Strings
  truncate,
  capitalize,
  titleCase
};