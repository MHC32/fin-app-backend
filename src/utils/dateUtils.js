/**
 * Utilitaires manipulation dates
 * FinApp Haiti - Backend MVP
 */

/**
 * Ajoute des jours à une date
 * @param {Date} date - Date
 * @param {number} days - Nombre de jours
 * @returns {Date} Nouvelle date
 */
const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

/**
 * Soustrait des jours d'une date
 * @param {Date} date - Date
 * @param {number} days - Nombre de jours
 * @returns {Date} Nouvelle date
 */
const subtractDays = (date, days) => {
  return addDays(date, -days);
};

/**
 * Ajoute des mois à une date
 * @param {Date} date - Date
 * @param {number} months - Nombre de mois
 * @returns {Date} Nouvelle date
 */
const addMonths = (date, months) => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
};

/**
 * Soustrait des mois d'une date
 * @param {Date} date - Date
 * @param {number} months - Nombre de mois
 * @returns {Date} Nouvelle date
 */
const subtractMonths = (date, months) => {
  return addMonths(date, -months);
};

/**
 * Ajoute des années à une date
 * @param {Date} date - Date
 * @param {number} years - Nombre d'années
 * @returns {Date} Nouvelle date
 */
const addYears = (date, years) => {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return result;
};

/**
 * Soustrait des années d'une date
 * @param {Date} date - Date
 * @param {number} years - Nombre d'années
 * @returns {Date} Nouvelle date
 */
const subtractYears = (date, years) => {
  return addYears(date, -years);
};

/**
 * Début du jour (00:00:00)
 * @param {Date} date - Date
 * @returns {Date} Début du jour
 */
const startOfDay = (date) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

/**
 * Fin du jour (23:59:59)
 * @param {Date} date - Date
 * @returns {Date} Fin du jour
 */
const endOfDay = (date) => {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
};

/**
 * Début de la semaine (lundi)
 * @param {Date} date - Date
 * @returns {Date} Début de semaine
 */
const startOfWeek = (date) => {
  const result = new Date(date);
  const day = result.getDay();
  const diff = result.getDate() - day + (day === 0 ? -6 : 1); // Lundi = jour 1
  result.setDate(diff);
  return startOfDay(result);
};

/**
 * Fin de la semaine (dimanche)
 * @param {Date} date - Date
 * @returns {Date} Fin de semaine
 */
const endOfWeek = (date) => {
  const result = startOfWeek(date);
  result.setDate(result.getDate() + 6);
  return endOfDay(result);
};

/**
 * Début du mois
 * @param {Date} date - Date
 * @returns {Date} Début du mois
 */
const startOfMonth = (date) => {
  const result = new Date(date);
  result.setDate(1);
  return startOfDay(result);
};

/**
 * Fin du mois
 * @param {Date} date - Date
 * @returns {Date} Fin du mois
 */
const endOfMonth = (date) => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + 1, 0);
  return endOfDay(result);
};

/**
 * Début de l'année
 * @param {Date} date - Date
 * @returns {Date} Début de l'année
 */
const startOfYear = (date) => {
  const result = new Date(date);
  result.setMonth(0, 1);
  return startOfDay(result);
};

/**
 * Fin de l'année
 * @param {Date} date - Date
 * @returns {Date} Fin de l'année
 */
const endOfYear = (date) => {
  const result = new Date(date);
  result.setMonth(11, 31);
  return endOfDay(result);
};

/**
 * Différence en jours entre deux dates
 * @param {Date} date1 - Date 1
 * @param {Date} date2 - Date 2
 * @returns {number} Nombre de jours
 */
const daysBetween = (date1, date2) => {
  const oneDay = 24 * 60 * 60 * 1000;
  const diff = Math.abs(new Date(date1) - new Date(date2));
  return Math.round(diff / oneDay);
};

/**
 * Différence en heures entre deux dates
 * @param {Date} date1 - Date 1
 * @param {Date} date2 - Date 2
 * @returns {number} Nombre d'heures
 */
const hoursBetween = (date1, date2) => {
  const oneHour = 60 * 60 * 1000;
  const diff = Math.abs(new Date(date1) - new Date(date2));
  return Math.round(diff / oneHour);
};

/**
 * Différence en minutes entre deux dates
 * @param {Date} date1 - Date 1
 * @param {Date} date2 - Date 2
 * @returns {number} Nombre de minutes
 */
const minutesBetween = (date1, date2) => {
  const oneMinute = 60 * 1000;
  const diff = Math.abs(new Date(date1) - new Date(date2));
  return Math.round(diff / oneMinute);
};

/**
 * Différence en mois entre deux dates
 * @param {Date} date1 - Date 1
 * @param {Date} date2 - Date 2
 * @returns {number} Nombre de mois
 */
const monthsBetween = (date1, date2) => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  
  let months = (d2.getFullYear() - d1.getFullYear()) * 12;
  months -= d1.getMonth();
  months += d2.getMonth();
  
  return Math.abs(months);
};

/**
 * Vérifie si une date est aujourd'hui
 * @param {Date} date - Date
 * @returns {boolean}
 */
const isToday = (date) => {
  const today = new Date();
  const dateObj = new Date(date);
  
  return dateObj.getDate() === today.getDate() &&
         dateObj.getMonth() === today.getMonth() &&
         dateObj.getFullYear() === today.getFullYear();
};

/**
 * Vérifie si une date est hier
 * @param {Date} date - Date
 * @returns {boolean}
 */
const isYesterday = (date) => {
  const yesterday = subtractDays(new Date(), 1);
  const dateObj = new Date(date);
  
  return dateObj.getDate() === yesterday.getDate() &&
         dateObj.getMonth() === yesterday.getMonth() &&
         dateObj.getFullYear() === yesterday.getFullYear();
};

/**
 * Vérifie si une date est demain
 * @param {Date} date - Date
 * @returns {boolean}
 */
const isTomorrow = (date) => {
  const tomorrow = addDays(new Date(), 1);
  const dateObj = new Date(date);
  
  return dateObj.getDate() === tomorrow.getDate() &&
         dateObj.getMonth() === tomorrow.getMonth() &&
         dateObj.getFullYear() === tomorrow.getFullYear();
};

/**
 * Vérifie si une date est dans le passé
 * @param {Date} date - Date
 * @returns {boolean}
 */
const isPast = (date) => {
  return new Date(date) < new Date();
};

/**
 * Vérifie si une date est dans le futur
 * @param {Date} date - Date
 * @returns {boolean}
 */
const isFuture = (date) => {
  return new Date(date) > new Date();
};

/**
 * Vérifie si une date est un week-end
 * @param {Date} date - Date
 * @returns {boolean}
 */
const isWeekend = (date) => {
  const day = new Date(date).getDay();
  return day === 0 || day === 6;
};

/**
 * Vérifie si une date est dans la même semaine
 * @param {Date} date1 - Date 1
 * @param {Date} date2 - Date 2
 * @returns {boolean}
 */
const isSameWeek = (date1, date2) => {
  const start1 = startOfWeek(date1);
  const start2 = startOfWeek(date2);
  
  return start1.getTime() === start2.getTime();
};

/**
 * Vérifie si une date est dans le même mois
 * @param {Date} date1 - Date 1
 * @param {Date} date2 - Date 2
 * @returns {boolean}
 */
const isSameMonth = (date1, date2) => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  
  return d1.getMonth() === d2.getMonth() &&
         d1.getFullYear() === d2.getFullYear();
};

/**
 * Vérifie si une date est dans la même année
 * @param {Date} date1 - Date 1
 * @param {Date} date2 - Date 2
 * @returns {boolean}
 */
const isSameYear = (date1, date2) => {
  return new Date(date1).getFullYear() === new Date(date2).getFullYear();
};

/**
 * Vérifie si une date est entre deux dates
 * @param {Date} date - Date à vérifier
 * @param {Date} start - Date début
 * @param {Date} end - Date fin
 * @returns {boolean}
 */
const isBetween = (date, start, end) => {
  const dateObj = new Date(date);
  const startObj = new Date(start);
  const endObj = new Date(end);
  
  return dateObj >= startObj && dateObj <= endObj;
};

/**
 * Retourne le nombre de jours dans un mois
 * @param {number} month - Mois (0-11)
 * @param {number} year - Année
 * @returns {number} Nombre de jours
 */
const daysInMonth = (month, year) => {
  return new Date(year, month + 1, 0).getDate();
};

/**
 * Retourne le nombre de jours dans une année
 * @param {number} year - Année
 * @returns {number} Nombre de jours (365 ou 366)
 */
const daysInYear = (year) => {
  return isLeapYear(year) ? 366 : 365;
};

/**
 * Vérifie si une année est bissextile
 * @param {number} year - Année
 * @returns {boolean}
 */
const isLeapYear = (year) => {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
};

/**
 * Retourne le nom du jour de la semaine
 * @param {Date} date - Date
 * @param {string} locale - Locale (défaut: 'fr-HT')
 * @returns {string} Nom du jour
 */
const getDayName = (date, locale = 'fr-HT') => {
  return new Date(date).toLocaleDateString(locale, { weekday: 'long' });
};

/**
 * Retourne le nom du mois
 * @param {Date} date - Date
 * @param {string} locale - Locale (défaut: 'fr-HT')
 * @returns {string} Nom du mois
 */
const getMonthName = (date, locale = 'fr-HT') => {
  return new Date(date).toLocaleDateString(locale, { month: 'long' });
};

/**
 * Retourne le numéro de semaine dans l'année
 * @param {Date} date - Date
 * @returns {number} Numéro de semaine (1-53)
 */
const getWeekNumber = (date) => {
  const dateObj = new Date(date);
  dateObj.setHours(0, 0, 0, 0);
  dateObj.setDate(dateObj.getDate() + 3 - (dateObj.getDay() + 6) % 7);
  
  const week1 = new Date(dateObj.getFullYear(), 0, 4);
  
  return 1 + Math.round(((dateObj - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
};

/**
 * Retourne le trimestre d'une date
 * @param {Date} date - Date
 * @returns {number} Trimestre (1-4)
 */
const getQuarter = (date) => {
  const month = new Date(date).getMonth();
  return Math.floor(month / 3) + 1;
};

/**
 * Retourne la prochaine date d'un jour spécifique
 * @param {number} dayOfWeek - Jour (0=dimanche, 1=lundi, etc.)
 * @param {Date} fromDate - Date de départ (défaut: aujourd'hui)
 * @returns {Date} Prochaine occurrence
 */
const getNextDayOfWeek = (dayOfWeek, fromDate = new Date()) => {
  const result = new Date(fromDate);
  result.setDate(result.getDate() + ((7 + dayOfWeek - result.getDay()) % 7 || 7));
  return result;
};

/**
 * Retourne le dernier jour du mois
 * @param {Date} date - Date
 * @returns {Date} Dernier jour du mois
 */
const getLastDayOfMonth = (date) => {
  return endOfMonth(date);
};

/**
 * Retourne le premier jour du mois
 * @param {Date} date - Date
 * @returns {Date} Premier jour du mois
 */
const getFirstDayOfMonth = (date) => {
  return startOfMonth(date);
};

/**
 * Parse une date depuis différents formats
 * @param {string|Date} dateString - Date à parser
 * @returns {Date|null} Date parsée ou null
 */
const parseDate = (dateString) => {
  if (!dateString) return null;
  if (dateString instanceof Date) return dateString;
  
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? null : date;
};

/**
 * Formate une date en ISO (YYYY-MM-DD)
 * @param {Date} date - Date
 * @returns {string} Date ISO
 */
const toISODate = (date) => {
  const dateObj = new Date(date);
  return dateObj.toISOString().split('T')[0];
};

/**
 * Formate une date en ISO avec heure (YYYY-MM-DDTHH:mm:ss)
 * @param {Date} date - Date
 * @returns {string} DateTime ISO
 */
const toISODateTime = (date) => {
  return new Date(date).toISOString();
};

/**
 * Calcule l'âge depuis une date de naissance
 * @param {Date} birthDate - Date de naissance
 * @returns {number} Âge en années
 */
const calculateAge = (birthDate) => {
  const today = new Date();
  const birth = new Date(birthDate);
  
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return age;
};

/**
 * Génère un tableau de dates entre deux dates
 * @param {Date} start - Date début
 * @param {Date} end - Date fin
 * @param {string} step - Pas ('day', 'week', 'month')
 * @returns {Array<Date>} Tableau de dates
 */
const getDateRange = (start, end, step = 'day') => {
  const dates = [];
  let current = new Date(start);
  const endDate = new Date(end);
  
  while (current <= endDate) {
    dates.push(new Date(current));
    
    if (step === 'day') {
      current = addDays(current, 1);
    } else if (step === 'week') {
      current = addDays(current, 7);
    } else if (step === 'month') {
      current = addMonths(current, 1);
    }
  }
  
  return dates;
};

/**
 * Calcule la date d'échéance selon une fréquence
 * @param {Date} startDate - Date début
 * @param {string} frequency - Fréquence ('daily', 'weekly', 'monthly')
 * @param {number} occurrences - Nombre d'occurrences
 * @returns {Date} Date d'échéance
 */
const calculateDueDate = (startDate, frequency, occurrences = 1) => {
  const start = new Date(startDate);
  
  if (frequency === 'daily') {
    return addDays(start, occurrences);
  } else if (frequency === 'weekly') {
    return addDays(start, occurrences * 7);
  } else if (frequency === 'monthly') {
    return addMonths(start, occurrences);
  }
  
  return start;
};

/**
 * Vérifie si une date est expirée
 * @param {Date} date - Date à vérifier
 * @returns {boolean}
 */
const isExpired = (date) => {
  return isPast(date);
};

/**
 * Retourne le timestamp Unix
 * @param {Date} date - Date (défaut: maintenant)
 * @returns {number} Timestamp en secondes
 */
const getTimestamp = (date = new Date()) => {
  return Math.floor(new Date(date).getTime() / 1000);
};

/**
 * Convertit un timestamp Unix en Date
 * @param {number} timestamp - Timestamp en secondes
 * @returns {Date} Date
 */
const fromTimestamp = (timestamp) => {
  return new Date(timestamp * 1000);
};

module.exports = {
  // Ajout/Soustraction
  addDays,
  subtractDays,
  addMonths,
  subtractMonths,
  addYears,
  subtractYears,
  
  // Début/Fin périodes
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  
  // Différences
  daysBetween,
  hoursBetween,
  minutesBetween,
  monthsBetween,
  
  // Vérifications temporelles
  isToday,
  isYesterday,
  isTomorrow,
  isPast,
  isFuture,
  isWeekend,
  isExpired,
  
  // Comparaisons
  isSameWeek,
  isSameMonth,
  isSameYear,
  isBetween,
  
  // Informations dates
  daysInMonth,
  daysInYear,
  isLeapYear,
  getDayName,
  getMonthName,
  getWeekNumber,
  getQuarter,
  calculateAge,
  
  // Manipulation
  getNextDayOfWeek,
  getLastDayOfMonth,
  getFirstDayOfMonth,
  parseDate,
  getDateRange,
  calculateDueDate,
  
  // Formats
  toISODate,
  toISODateTime,
  getTimestamp,
  fromTimestamp
};