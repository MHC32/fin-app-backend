/**
 * Formatage des données
 * FinApp Haiti - Backend MVP
 */

/**
 * Formate un montant en devise
 * @param {number} amount - Montant
 * @param {string} currency - Devise (HTG ou USD)
 * @param {object} options - Options
 * @returns {string} Montant formaté
 */
const formatCurrency = (amount, currency = 'HTG', options = {}) => {
  const {
    decimals = 2,
    thousandsSeparator = ',',
    decimalSeparator = '.',
    showSymbol = true
  } = options;
  
  // Arrondir le montant
  const rounded = Math.round(amount * Math.pow(10, decimals)) / Math.pow(10, decimals);
  
  // Séparer partie entière et décimale
  const [integerPart, decimalPart = ''] = rounded.toFixed(decimals).split('.');
  
  // Ajouter séparateurs de milliers
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSeparator);
  
  // Construire le résultat
  let result = formattedInteger;
  if (decimals > 0) {
    result += decimalSeparator + decimalPart;
  }
  
  // Ajouter symbole devise
  if (showSymbol) {
    const symbols = {
      HTG: 'G',
      USD: '$'
    };
    const symbol = symbols[currency] || currency;
    result = currency === 'USD' ? `${symbol}${result}` : `${result} ${symbol}`;
  }
  
  return result;
};

/**
 * Formate un montant HTG
 * @param {number} amount - Montant
 * @param {object} options - Options
 * @returns {string} Montant formaté
 */
const formatHTG = (amount, options = {}) => {
  return formatCurrency(amount, 'HTG', options);
};

/**
 * Formate un montant USD
 * @param {number} amount - Montant
 * @param {object} options - Options
 * @returns {string} Montant formaté
 */
const formatUSD = (amount, options = {}) => {
  return formatCurrency(amount, 'USD', options);
};

/**
 * Formate un pourcentage
 * @param {number} value - Valeur
 * @param {number} decimals - Décimales (défaut: 2)
 * @returns {string} Pourcentage formaté
 */
const formatPercentage = (value, decimals = 2) => {
  return `${value.toFixed(decimals)}%`;
};

/**
 * Formate un numéro de téléphone haïtien
 * @param {string} phone - Téléphone
 * @param {string} format - Format (default: '+509 XXXX-XXXX')
 * @returns {string} Téléphone formaté
 */
const formatHaitianPhone = (phone, format = 'international') => {
  // Nettoyer le numéro
  const cleaned = phone.replace(/\D/g, '');
  
  // Extraire les parties
  let countryCode = '509';
  let number = cleaned;
  
  if (cleaned.startsWith('509')) {
    number = cleaned.slice(3);
  } else if (cleaned.length === 8) {
    number = cleaned;
  }
  
  // Formater selon le format demandé
  if (format === 'international') {
    // +509 XXXX-XXXX
    return `+${countryCode} ${number.slice(0, 4)}-${number.slice(4)}`;
  } else if (format === 'national') {
    // XXXX-XXXX
    return `${number.slice(0, 4)}-${number.slice(4)}`;
  } else if (format === 'compact') {
    // 509XXXXXXXX
    return `${countryCode}${number}`;
  }
  
  return phone;
};

/**
 * Formate une date en français
 * @param {Date|string} date - Date
 * @param {string} format - Format (short, long, full)
 * @returns {string} Date formatée
 */
const formatDate = (date, format = 'short') => {
  const dateObj = new Date(date);
  
  const options = {
    short: { day: '2-digit', month: '2-digit', year: 'numeric' },
    long: { day: 'numeric', month: 'long', year: 'numeric' },
    full: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
  };
  
  return dateObj.toLocaleDateString('fr-HT', options[format] || options.short);
};

/**
 * Formate une heure
 * @param {Date|string} date - Date
 * @param {boolean} includeSeconds - Inclure secondes
 * @returns {string} Heure formatée
 */
const formatTime = (date, includeSeconds = false) => {
  const dateObj = new Date(date);
  
  const options = {
    hour: '2-digit',
    minute: '2-digit',
    ...(includeSeconds && { second: '2-digit' })
  };
  
  return dateObj.toLocaleTimeString('fr-HT', options);
};

/**
 * Formate une date avec heure
 * @param {Date|string} date - Date
 * @returns {string} DateTime formaté
 */
const formatDateTime = (date) => {
  return `${formatDate(date, 'long')} à ${formatTime(date)}`;
};

/**
 * Formate une date relative (il y a X temps)
 * @param {Date|string} date - Date
 * @returns {string} Date relative
 */
const formatRelativeDate = (date) => {
  const dateObj = new Date(date);
  const now = new Date();
  const diffMs = now - dateObj;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);
  
  if (diffSeconds < 60) return 'à l\'instant';
  if (diffMinutes < 60) return `il y a ${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}`;
  if (diffHours < 24) return `il y a ${diffHours} heure${diffHours > 1 ? 's' : ''}`;
  if (diffDays < 7) return `il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`;
  if (diffWeeks < 4) return `il y a ${diffWeeks} semaine${diffWeeks > 1 ? 's' : ''}`;
  if (diffMonths < 12) return `il y a ${diffMonths} mois`;
  return `il y a ${diffYears} an${diffYears > 1 ? 's' : ''}`;
};

/**
 * Formate une durée (secondes → texte)
 * @param {number} seconds - Durée en secondes
 * @returns {string} Durée formatée
 */
const formatDuration = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}min`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
  
  return parts.join(' ');
};

/**
 * Formate une taille de fichier
 * @param {number} bytes - Taille en octets
 * @param {number} decimals - Décimales
 * @returns {string} Taille formatée
 */
const formatFileSize = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Octets';
  
  const k = 1024;
  const sizes = ['Octets', 'Ko', 'Mo', 'Go', 'To'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
};

/**
 * Formate un nombre (avec séparateurs)
 * @param {number} number - Nombre
 * @param {object} options - Options
 * @returns {string} Nombre formaté
 */
const formatNumber = (number, options = {}) => {
  const {
    decimals = 0,
    thousandsSeparator = ',',
    decimalSeparator = '.'
  } = options;
  
  const rounded = Math.round(number * Math.pow(10, decimals)) / Math.pow(10, decimals);
  const [integerPart, decimalPart = ''] = rounded.toFixed(decimals).split('.');
  
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSeparator);
  
  if (decimals > 0) {
    return formattedInteger + decimalSeparator + decimalPart;
  }
  
  return formattedInteger;
};

/**
 * Formate un nom complet
 * @param {string} firstName - Prénom
 * @param {string} lastName - Nom
 * @param {string} format - Format (full, initials, last_first)
 * @returns {string} Nom formaté
 */
const formatName = (firstName, lastName, format = 'full') => {
  if (!firstName && !lastName) return '';
  
  if (format === 'full') {
    return `${firstName || ''} ${lastName || ''}`.trim();
  }
  
  if (format === 'initials') {
    const firstInitial = firstName ? firstName.charAt(0).toUpperCase() : '';
    const lastInitial = lastName ? lastName.charAt(0).toUpperCase() : '';
    return `${firstInitial}${lastInitial}`;
  }
  
  if (format === 'last_first') {
    return `${lastName || ''}, ${firstName || ''}`.trim();
  }
  
  return `${firstName || ''} ${lastName || ''}`.trim();
};

/**
 * Formate une adresse
 * @param {object} address - Objet adresse
 * @returns {string} Adresse formatée
 */
const formatAddress = (address) => {
  const parts = [];
  
  if (address.street) parts.push(address.street);
  if (address.city) parts.push(address.city);
  if (address.department) parts.push(address.department);
  if (address.postalCode) parts.push(address.postalCode);
  if (address.country) parts.push(address.country);
  
  return parts.join(', ');
};

/**
 * Formate une liste (avec séparateurs)
 * @param {Array} items - Liste
 * @param {string} separator - Séparateur (défaut: ', ')
 * @param {string} lastSeparator - Dernier séparateur (défaut: ' et ')
 * @returns {string} Liste formatée
 */
const formatList = (items, separator = ', ', lastSeparator = ' et ') => {
  if (!items || items.length === 0) return '';
  if (items.length === 1) return items[0];
  
  const allButLast = items.slice(0, -1).join(separator);
  const last = items[items.length - 1];
  
  return `${allButLast}${lastSeparator}${last}`;
};

/**
 * Formate un statut (avec emoji)
 * @param {string} status - Statut
 * @returns {string} Statut formaté avec emoji
 */
const formatStatus = (status) => {
  const statusMap = {
    active: '🟢 Actif',
    pending: '🟡 En attente',
    completed: '✅ Terminé',
    cancelled: '🔴 Annulé',
    expired: '⏰ Expiré',
    overdue: '⚠️ En retard',
    paid: '💰 Payé',
    unpaid: '💸 Non payé',
    processing: '⏳ En cours'
  };
  
  return statusMap[status] || status;
};

/**
 * Formate un type de transaction
 * @param {string} type - Type
 * @returns {string} Type formaté
 */
const formatTransactionType = (type) => {
  const typeMap = {
    income: 'Revenu',
    expense: 'Dépense'
  };
  
  return typeMap[type] || type;
};

/**
 * Formate une catégorie
 * @param {string} category - Catégorie
 * @returns {string} Catégorie formatée
 */
const formatCategory = (category) => {
  const categoryMap = {
    // Revenus
    salary: 'Salaire',
    business: 'Business',
    investment: 'Investissement',
    gift: 'Cadeau',
    other_income: 'Autre revenu',
    
    // Dépenses
    food: 'Alimentation',
    transport: 'Transport',
    housing: 'Logement',
    utilities: 'Factures',
    health: 'Santé',
    education: 'Éducation',
    entertainment: 'Loisirs',
    shopping: 'Shopping',
    debt_payment: 'Remboursement dette',
    savings: 'Épargne',
    other_expense: 'Autre dépense'
  };
  
  return categoryMap[category] || category;
};

/**
 * Formate une fréquence de sol
 * @param {string} frequency - Fréquence
 * @returns {string} Fréquence formatée
 */
const formatSolFrequency = (frequency) => {
  const frequencyMap = {
    daily: 'Quotidien',
    weekly: 'Hebdomadaire',
    monthly: 'Mensuel'
  };
  
  return frequencyMap[frequency] || frequency;
};

/**
 * Formate un JSON en string lisible
 * @param {object} obj - Objet
 * @param {number} indent - Indentation
 * @returns {string} JSON formaté
 */
const formatJson = (obj, indent = 2) => {
  return JSON.stringify(obj, null, indent);
};

/**
 * Formate un ID MongoDB (courte version)
 * @param {string} id - ID MongoDB
 * @returns {string} ID court
 */
const formatShortId = (id) => {
  if (!id) return '';
  return `${id.slice(0, 4)}...${id.slice(-4)}`;
};

/**
 * Formate un taux d'intérêt
 * @param {number} rate - Taux
 * @param {string} period - Période (annual, monthly)
 * @returns {string} Taux formaté
 */
const formatInterestRate = (rate, period = 'annual') => {
  const periodMap = {
    annual: '/an',
    monthly: '/mois',
    daily: '/jour'
  };
  
  return `${rate.toFixed(2)}%${periodMap[period] || ''}`;
};

/**
 * Formate un score (sur 100)
 * @param {number} score - Score
 * @returns {string} Score formaté avec évaluation
 */
const formatScore = (score) => {
  let evaluation = '';
  
  if (score >= 90) evaluation = '🌟 Excellent';
  else if (score >= 75) evaluation = '✅ Très bon';
  else if (score >= 60) evaluation = '👍 Bon';
  else if (score >= 40) evaluation = '⚠️ Moyen';
  else evaluation = '❌ Faible';
  
  return `${score}/100 - ${evaluation}`;
};

/**
 * Formate un niveau de priorité
 * @param {string} priority - Priorité
 * @returns {string} Priorité formatée
 */
const formatPriority = (priority) => {
  const priorityMap = {
    low: '🔵 Faible',
    medium: '🟡 Moyenne',
    high: '🔴 Haute',
    urgent: '🚨 Urgente'
  };
  
  return priorityMap[priority] || priority;
};

module.exports = {
  // Monétaire
  formatCurrency,
  formatHTG,
  formatUSD,
  formatPercentage,
  formatInterestRate,
  
  // Dates & Temps
  formatDate,
  formatTime,
  formatDateTime,
  formatRelativeDate,
  formatDuration,
  
  // Nombres & Tailles
  formatNumber,
  formatFileSize,
  formatScore,
  
  // Texte & Identité
  formatName,
  formatAddress,
  formatHaitianPhone,
  formatList,
  formatShortId,
  
  // Status & Types
  formatStatus,
  formatTransactionType,
  formatCategory,
  formatSolFrequency,
  formatPriority,
  
  // Technique
  formatJson
};