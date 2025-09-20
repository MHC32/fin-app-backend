// src/utils/constants.js - Constantes FinApp Haiti
// Données spécifiques au contexte haïtien

// ===================================================================
// DEVISES SUPPORTÉES
// ===================================================================
const CURRENCIES = {
  HTG: {
    code: 'HTG',
    name: 'Gourde Haïtienne',
    symbol: 'G',
    decimal: 2,
    default: true
  },
  USD: {
    code: 'USD', 
    name: 'Dollar Américain',
    symbol: '$',
    decimal: 2,
    default: false
  }
};

// ===================================================================
// BANQUES HAÏTIENNES
// ===================================================================
const HAITI_BANKS = {
  sogebank: {
    id: 'sogebank',
    name: 'Sogebank',
    fullName: 'Société Générale Haïtienne de Banque',
    code: 'SOGEBANK',
    color: '#0066CC',
    logo: '/images/banks/sogebank.png',
    popular: true,
    type: 'bank'
  },
  unibank: {
    id: 'unibank', 
    name: 'Unibank',
    fullName: 'Union Bank of Haiti',
    code: 'UNIBANK',
    color: '#FF6600',
    logo: '/images/banks/unibank.png',
    popular: true,
    type: 'bank'
  },
  bnc: {
    id: 'bnc',
    name: 'BNC',
    fullName: 'Banque Nationale de Crédit',
    code: 'BNC',
    color: '#006633',
    logo: '/images/banks/bnc.png',
    popular: true,
    type: 'bank'
  },
  buh: {
    id: 'buh',
    name: 'BUH',
    fullName: 'Banque de l\'Union Haïtienne',
    code: 'BUH',
    color: '#CC0000',
    logo: '/images/banks/buh.png',
    popular: true,
    type: 'bank'
  },
  capital_bank: {
    id: 'capital_bank',
    name: 'Capital Bank',
    fullName: 'Capital Bank Haiti',
    code: 'CAPITAL',
    color: '#330066',
    logo: '/images/banks/capital.png',
    popular: true,
    type: 'bank'
  },
  moncash: {
    id: 'moncash',
    name: 'MonCash',
    fullName: 'MonCash - Digicel Money Transfer',
    code: 'MONCASH',
    color: '#FF3300',
    logo: '/images/banks/moncash.png',
    popular: true,
    type: 'mobile'
  },
  natcash: {
    id: 'natcash',
    name: 'NatCash',
    fullName: 'NatCash - Natcom Money Transfer',
    code: 'NATCASH',
    color: '#0099CC',
    logo: '/images/banks/natcash.png',
    popular: true,
    type: 'mobile'
  },
  rb: {
    id: 'rb',
    name: 'Banque de la République d\'Haïti',
    fullName: 'Banque de la République d\'Haïti',
    code: 'BRH',
    color: '#ea580c',
    logo: '/images/banks/brh.png',
    popular: false,
    type: 'central'
  },
  cash: {
    id: 'cash',
    name: 'Liquide',
    fullName: 'Argent liquide',
    code: 'CASH',
    color: '#16a34a',
    logo: '/images/banks/cash.png',
    popular: true,
    type: 'cash'
  },
  other: {
    id: 'other',
    name: 'Autre',
    fullName: 'Autre institution financière',
    code: 'OTHER',
    color: '#6b7280',
    logo: '/images/banks/other.png',
    popular: false,
    type: 'other'
  }
};

// ===================================================================
// RÉGIONS D'HAÏTI
// ===================================================================
const HAITI_REGIONS = {
  ouest: {
    id: 'ouest',
    name: 'Ouest',
    capital: 'Port-au-Prince',
    popular: true
  },
  nord: {
    id: 'nord',
    name: 'Nord',
    capital: 'Cap-Haïtien',
    popular: true
  },
  sud: {
    id: 'sud',
    name: 'Sud', 
    capital: 'Les Cayes',
    popular: true
  },
  artibonite: {
    id: 'artibonite',
    name: 'Artibonite',
    capital: 'Gonaïves',
    popular: true
  },
  centre: {
    id: 'centre',
    name: 'Centre',
    capital: 'Hinche',
    popular: false
  },
  grand_anse: {
    id: 'grand_anse',
    name: 'Grand\'Anse',
    capital: 'Jérémie',
    popular: false
  },
  nippes: {
    id: 'nippes',
    name: 'Nippes',
    capital: 'Miragoâne', 
    popular: false
  },
  nord_est: {
    id: 'nord_est',
    name: 'Nord-Est',
    capital: 'Fort-Liberté',
    popular: false
  },
  nord_ouest: {
    id: 'nord_ouest',
    name: 'Nord-Ouest',
    capital: 'Port-de-Paix',
    popular: false
  },
  sud_est: {
    id: 'sud_est',
    name: 'Sud-Est',
    capital: 'Jacmel',
    popular: true
  }
};

// ===================================================================
// CATÉGORIES DE TRANSACTIONS
// ===================================================================
const TRANSACTION_CATEGORIES = {
  // Dépenses
  alimentation: {
    id: 'alimentation',
    name: 'Alimentation',
    type: 'expense',
    icon: 'restaurant',
    color: '#ef4444',
    description: 'Nourriture, épicerie, restaurants',
    haitiExample: 'Manje, makèt, restoran',
    popular: true
  },
  transport: {
    id: 'transport',
    name: 'Transport',
    type: 'expense', 
    icon: 'directions_car',
    color: '#3b82f6',
    description: 'Taxi, tap-tap, essence, réparation véhicule',
    haitiExample: 'Taksi, tap-tap, gazolin',
    popular: true
  },
  logement: {
    id: 'logement',
    name: 'Logement',
    type: 'expense',
    icon: 'home',
    color: '#8b5cf6',
    description: 'Loyer, électricité, eau, maintenance',
    haitiExample: 'Lwaye, kouran, dlo',
    popular: true
  },
  sante: {
    id: 'sante',
    name: 'Santé',
    type: 'expense',
    icon: 'local_hospital',
    color: '#10b981',
    description: 'Médecin, médicaments, hôpital',
    haitiExample: 'Doktè, medikaman, lopital',
    popular: true
  },
  education: {
    id: 'education',
    name: 'Éducation',
    type: 'expense',
    icon: 'school',
    color: '#f59e0b',
    description: 'École, université, livres, formation',
    haitiExample: 'Lekòl, inivèsite, liv',
    popular: true
  },
  loisirs: {
    id: 'loisirs',
    name: 'Loisirs',
    type: 'expense',
    icon: 'sports_esports',
    color: '#ec4899',
    description: 'Sorties, sports, divertissement',
    haitiExample: 'Soti, jwèt, divètisман',
    popular: false
  },
  vetements: {
    id: 'vetements',
    name: 'Vêtements',
    type: 'expense',
    icon: 'checkroom',
    color: '#06b6d4',
    description: 'Habits, chaussures, accessoires',
    haitiExample: 'Rad, soulye, akseswa',
    popular: false
  },
  factures: {
    id: 'factures',
    name: 'Factures',
    type: 'expense',
    icon: 'receipt',
    color: '#64748b',
    description: 'Téléphone, internet, abonnements',
    haitiExample: 'Telefòn, entènèt, abònman',
    popular: true
  },
  
  // Revenus
  salaire: {
    id: 'salaire',
    name: 'Salaire',
    type: 'income',
    icon: 'work',
    color: '#22c55e',
    description: 'Salaire mensuel, prime, bonus',
    haitiExample: 'Salè, prim, bonus',
    popular: true
  },
  business: {
    id: 'business',
    name: 'Business',
    type: 'income',
    icon: 'business',
    color: '#16a34a',
    description: 'Commerce, vente, profit business',
    haitiExample: 'Komès, lavant, biznis',
    popular: true
  },
  freelance: {
    id: 'freelance',
    name: 'Freelance',
    type: 'income',
    icon: 'laptop',
    color: '#059669',
    description: 'Travail indépendant, consultation',
    haitiExample: 'Travay endepandan, konsèy',
    popular: false
  },
  investissement: {
    id: 'investissement',
    name: 'Investissement',
    type: 'income',
    icon: 'trending_up',
    color: '#0d9488',
    description: 'Retour investissement, dividendes',
    haitiExample: 'Envestisman, dividann',
    popular: false
  },
  
  // Spécial Haiti
  sol: {
    id: 'sol',
    name: 'Sol/Tontine',
    type: 'both',
    icon: 'group',
    color: '#7c3aed',
    description: 'Participation sols, réception tour',
    haitiExample: 'Patisipasyon sòl, resepsyon tou',
    popular: true
  },
  transfert: {
    id: 'transfert',
    name: 'Transfert',
    type: 'both',
    icon: 'swap_horiz',
    color: '#6366f1',
    description: 'Transfert entre comptes',
    haitiExample: 'Transfè ant kont',
    popular: true
  },
  other: {
    id: 'other',
    name: 'Autre',
    type: 'both',
    icon: 'category',
    color: '#6b7280',
    description: 'Autres transactions',
    haitiExample: 'Lòt tranzaksyon',
    popular: false
  }
};

// ===================================================================
// TYPES DE COMPTES
// ===================================================================
const ACCOUNT_TYPES = {
  checking: {
    id: 'checking',
    name: 'Compte courant',
    description: 'Compte courant pour dépenses quotidiennes',
    icon: 'account_balance',
    color: '#3b82f6'
  },
  savings: {
    id: 'savings',
    name: 'Épargne',
    description: 'Compte d\'épargne pour économies',
    icon: 'savings',
    color: '#10b981'
  },
  cash: {
    id: 'cash',
    name: 'Liquide',
    description: 'Argent liquide en poche',
    icon: 'payments',
    color: '#16a34a'
  },
  investment: {
    id: 'investment',
    name: 'Investissement',
    description: 'Compte pour projets d\'investissement',
    icon: 'trending_up',
    color: '#8b5cf6'
  },
  debt: {
    id: 'debt',
    name: 'Dette',
    description: 'Suivi des dettes et emprunts',
    icon: 'money_off',
    color: '#ef4444'
  }
};

// ===================================================================
// STATUTS ET ÉTATS
// ===================================================================
const STATUSES = {
  ACTIVE: 'active',
  INACTIVE: 'inactive', 
  PENDING: 'pending',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  PAUSED: 'paused'
};

const TRANSACTION_TYPES = {
  INCOME: 'income',
  EXPENSE: 'expense',
  TRANSFER: 'transfer'
};

const USER_ROLES = {
  USER: 'user',
  ADMIN: 'admin'
};

// ===================================================================
// PÉRIODES BUDGETS
// ===================================================================
const BUDGET_PERIODS = {
  weekly: {
    id: 'weekly',
    name: 'Hebdomadaire',
    days: 7
  },
  monthly: {
    id: 'monthly', 
    name: 'Mensuel',
    days: 30
  },
  yearly: {
    id: 'yearly',
    name: 'Annuel',
    days: 365
  }
};

// ===================================================================
// FRÉQUENCES SOLS
// ===================================================================
const SOL_FREQUENCIES = {
  weekly: {
    id: 'weekly',
    name: 'Hebdomadaire',
    description: 'Chaque semaine'
  },
  biweekly: {
    id: 'biweekly',
    name: 'Bi-hebdomadaire', 
    description: 'Toutes les 2 semaines'
  },
  monthly: {
    id: 'monthly',
    name: 'Mensuel',
    description: 'Chaque mois'
  }
};

// ===================================================================
// MESSAGES D'ERREUR CONTEXTUELS
// ===================================================================
const ERROR_MESSAGES = {
  INVALID_CURRENCY: 'Devise non supportée. Utilisez HTG ou USD.',
  INVALID_REGION: 'Région haïtienne non valide.',
  INVALID_BANK: 'Banque haïtienne non reconnue.',
  INVALID_CATEGORY: 'Catégorie de transaction non valide.',
  INSUFFICIENT_BALANCE: 'Solde insuffisant pour cette transaction.',
  INVALID_SOL_FREQUENCY: 'Fréquence de sol non supportée.',
  DUPLICATE_EMAIL: 'Cette adresse email est déjà utilisée.',
  DUPLICATE_PHONE: 'Ce numéro de téléphone est déjà utilisé.',
  INVALID_PHONE_FORMAT: 'Format de téléphone haïtien invalide (ex: +50932123456).',
  WEAK_PASSWORD: 'Mot de passe trop faible. Minimum 8 caractères.'
};

// ===================================================================
// VALEURS PAR DÉFAUT
// ===================================================================
const DEFAULTS = {
  CURRENCY: 'HTG',
  REGION: 'ouest',
  LANGUAGE: 'fr',
  THEME: 'light',
  ACCOUNT_TYPE: 'checking',
  BUDGET_PERIOD: 'monthly',
  SOL_FREQUENCY: 'monthly'
};

// ===================================================================
// MODÈLES BUDGETS PRÉ-DÉFINIS (depuis frontend)
// ===================================================================
const BUDGET_TEMPLATES = {
  student: {
    id: 'student',
    name: 'Étudiant',
    description: 'Budget pour étudiant universitaire',
    targetIncome: 15000,
    categories: {
      alimentation: 5000,
      transport: 3000,
      education: 4000,
      loisirs: 2000,
      factures: 1000
    }
  },
  young_professional: {
    id: 'young_professional',
    name: 'Jeune professionnel',
    description: 'Premier emploi, vie autonome',
    targetIncome: 35000,
    categories: {
      alimentation: 12000,
      transport: 8000,
      logement: 10000,
      sante: 2000,
      loisirs: 2000,
      factures: 1000
    }
  },
  family: {
    id: 'family',
    name: 'Famille',
    description: 'Couple avec enfants',
    targetIncome: 60000,
    categories: {
      alimentation: 20000,
      transport: 12000,
      logement: 18000,
      sante: 5000,
      education: 3000,
      loisirs: 2000
    }
  },
  entrepreneur: {
    id: 'entrepreneur',
    name: 'Entrepreneur',
    description: 'Revenus variables, besoin flexibilité',
    targetIncome: 50000,
    categories: {
      alimentation: 15000,
      transport: 10000,
      logement: 15000,
      sante: 3000,
      education: 2000,
      loisirs: 3000,
      factures: 2000
    }
  }
};

// ===================================================================
// TYPES DE SOLS/TONTINES SPÉCIALISÉS
// ===================================================================
const SOL_TYPES = {
  classic: {
    id: 'classic',
    name: 'Sol Classique',
    description: 'Sol traditionnel avec tour fixe',
    minParticipants: 3,
    maxParticipants: 20,
    defaultParticipants: 8,
    allowedFrequencies: ['weekly', 'monthly'],
    requiresGuarantor: false
  },
  business: {
    id: 'business',
    name: 'Sol Business',
    description: 'Sol pour entrepreneurs et commerce',
    minParticipants: 5,
    maxParticipants: 15,
    defaultParticipants: 10,
    allowedFrequencies: ['monthly'],
    requiresGuarantor: true
  },
  family: {
    id: 'family',
    name: 'Sol Familial',
    description: 'Sol entre membres de famille',
    minParticipants: 3,
    maxParticipants: 12,
    defaultParticipants: 6,
    allowedFrequencies: ['weekly', 'biweekly', 'monthly'],
    requiresGuarantor: false
  },
  savings: {
    id: 'savings',
    name: 'Sol Épargne',
    description: 'Sol pour objectifs d\'épargne',
    minParticipants: 5,
    maxParticipants: 25,
    defaultParticipants: 12,
    allowedFrequencies: ['monthly'],
    requiresGuarantor: false
  }
};

// ===================================================================
// STATUTS SPÉCIALISÉS SELON CONTEXTE
// ===================================================================
const SOL_STATUSES = {
  DRAFT: 'draft',
  RECRUITING: 'recruiting',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  PAUSED: 'paused'
};

const PAYMENT_STATUSES = {
  PAID: 'paid',
  PENDING: 'pending',
  OVERDUE: 'overdue',
  PARTIAL: 'partial',
  CANCELLED: 'cancelled'
};

const INVESTMENT_TYPES = {
  business: {
    id: 'business',
    name: 'Business',
    description: 'Investissement commercial',
    icon: 'business',
    color: '#1e40af',
    riskLevel: 'medium'
  },
  agriculture: {
    id: 'agriculture', 
    name: 'Agriculture',
    description: 'Élevage, plantation, agriculture',
    icon: 'agriculture',
    color: '#16a34a',
    riskLevel: 'low'
  },
  immobilier: {
    id: 'immobilier',
    name: 'Immobilier',
    description: 'Achat, construction, location',
    icon: 'home',
    color: '#7c3aed',
    riskLevel: 'low'
  },
  crypto: {
    id: 'crypto',
    name: 'Crypto',
    description: 'Cryptomonnaies, trading',
    icon: 'currency_bitcoin',
    color: '#f59e0b',
    riskLevel: 'high'
  },
  education: {
    id: 'education',
    name: 'Éducation',
    description: 'Formation, certification, études',
    icon: 'school',
    color: '#0891b2',
    riskLevel: 'low'
  }
};

// ===================================================================
// TEMPLATES TRANSACTIONS RAPIDES (depuis frontend)
// ===================================================================
const QUICK_TRANSACTION_TEMPLATES = [
  { label: 'Tap-tap', amount: 25, currency: 'HTG', category: 'transport' },
  { label: 'Lunch', amount: 150, currency: 'HTG', category: 'alimentation' },
  { label: 'Essence', amount: 500, currency: 'HTG', category: 'transport' },
  { label: 'Recharge téléphone', amount: 100, currency: 'HTG', category: 'factures' },
  { label: 'Café/Boisson', amount: 50, currency: 'HTG', category: 'alimentation' },
  { label: 'Photocopie', amount: 25, currency: 'HTG', category: 'education' },
  { label: 'Moto-taxi', amount: 50, currency: 'HTG', category: 'transport' },
  { label: 'Pain/Petit-déjeuner', amount: 75, currency: 'HTG', category: 'alimentation' }
];

// ===================================================================
// VALIDATION PATTERNS
// ===================================================================
const VALIDATION_PATTERNS = {
  HAITI_PHONE: /^\+509[0-9]{8}$/,
  HAITI_PHONE_LOCAL: /^[0-9]{8}$/,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PASSWORD_STRONG: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
  ACCOUNT_NUMBER: /^[0-9]{6,16}$/,
  SOL_CODE: /^[A-Z0-9]{6,8}$/
};

// ===================================================================
// LIMITES ET CONTRAINTES
// ===================================================================
const LIMITS = {
  TRANSACTION: {
    MIN_AMOUNT: 1,
    MAX_AMOUNT_HTG: 1000000,
    MAX_AMOUNT_USD: 10000,
    MAX_DESCRIPTION_LENGTH: 255
  },
  SOL: {
    MIN_PARTICIPANTS: 3,
    MAX_PARTICIPANTS: 50,
    MIN_AMOUNT_HTG: 500,
    MAX_AMOUNT_HTG: 100000,
    MIN_AMOUNT_USD: 5,
    MAX_AMOUNT_USD: 1000
  },
  BUDGET: {
    MIN_AMOUNT: 100,
    MAX_AMOUNT_HTG: 500000,
    MAX_AMOUNT_USD: 5000
  },
  UPLOAD: {
    MAX_FILE_SIZE: 5242880, // 5MB
    ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif'],
    ALLOWED_DOCUMENT_TYPES: ['application/pdf'],
    MAX_FILES_PER_REQUEST: 5
  }
};

// ===================================================================
// NOTIFICATIONS TYPES
// ===================================================================
const NOTIFICATION_TYPES = {
  SOL_PAYMENT_DUE: 'sol_payment_due',
  SOL_TURN_RECEIVED: 'sol_turn_received',
  BUDGET_EXCEEDED: 'budget_exceeded',
  INVESTMENT_UPDATE: 'investment_update',
  ACCOUNT_LOW_BALANCE: 'account_low_balance',
  SYSTEM_MAINTENANCE: 'system_maintenance'
};

// ===================================================================
// EXPORTS
// ===================================================================
module.exports = {
  CURRENCIES,
  HAITI_BANKS,
  HAITI_REGIONS,
  TRANSACTION_CATEGORIES,
  ACCOUNT_TYPES,
  STATUSES,
  TRANSACTION_TYPES,
  USER_ROLES,
  BUDGET_PERIODS,
  SOL_FREQUENCIES,
  ERROR_MESSAGES,
  DEFAULTS,
  
  // Nouvelles constantes ajoutées
  BUDGET_TEMPLATES,
  SOL_TYPES,
  SOL_STATUSES,
  PAYMENT_STATUSES,
  INVESTMENT_TYPES,
  QUICK_TRANSACTION_TEMPLATES,
  VALIDATION_PATTERNS,
  LIMITS,
  NOTIFICATION_TYPES
};