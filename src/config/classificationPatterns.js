// src/config/classificationPatterns.js
// Patterns de classification pour contexte haïtien

module.exports = {
  transport: {
    keywords: [
      // Transport public Haiti
      'tap-tap', 'taptap', 'tap tap',
      'moto', 'mototaxi', 'moto-taxi',
      'taxi', 'cab',
      'bus', 'autobus',
      'transport',
      // Carburant
      'carburant', 'essence', 'diesel', 'gazoline', 'gas',
      'station', 'pompe'
    ],
    confidence: 0.9
  },

  alimentation: {
    keywords: [
      // Marchés et achats
      'marché', 'market', 'mache',
      'courses', 'shopping',
      'supermarché', 'supèmake',
      'épicerie', 'boutik',
      // Restaurants et repas
      'restaurant', 'restoran',
      'lunch', 'dinner', 'breakfast',
      'petit-déjeuner', 'dejene',
      'manger', 'food', 'nourriture', 'bouffe',
      // Produits
      'pain', 'riz', 'viande', 'légumes'
    ],
    confidence: 0.9
  },

  services: {
    keywords: [
      // Opérateurs télécom Haiti
      'digicel', 'natcom', 'teleco',
      // Internet et mobile
      'internet', 'wifi', 'wi-fi',
      'data', 'mégaoctets', 'mb', 'gb',
      'recharge', 'crédit', 'credit',
      'forfait', 'plan', 'abonnement',
      'téléphone', 'phone', 'mobile', 'cellulaire',
      // Services publics
      'électricité', 'electricity', 'courant',
      'ed\'h', 'edh', 'lumière',
      'eau', 'water', 'dlo',
      // Autres services
      'facture', 'bill', 'paiement',
      'câble', 'cable', 'tv', 'télévision',
      'banque', 'bank', 'frais bancaires'
    ],
    confidence: 0.85
  },

  sols: {
    keywords: [
      // Tontines traditionnelles
      'sol', 'sòl', 'tontine',
      'kòb', 'main', 'tour',
      'ajans', 'agence',
      'sosyete', 'société',
      'woule', 'rotation',
      'bòs', 'boss',
      // Épargne collective
      'épargne collective', 'cotisation',
      'contribution', 'participation'
    ],
    confidence: 0.95
  },

  logement: {
    keywords: [
      'loyer', 'rent', 'lwaye',
      'kay', 'maison', 'house',
      'appartement', 'apatman',
      'chambre', 'room',
      'réparation', 'reparasyon',
      'construction', 'konstriksyon'
    ],
    confidence: 0.9
  },

  sante: {
    keywords: [
      // Professionnels
      'médecin', 'doctor', 'doktè',
      'docteur', 'infirmière',
      'dentiste', 'dantis',
      // Lieux
      'hôpital', 'hospital', 'lopital',
      'clinique', 'klinik',
      'pharmacie', 'famasi',
      // Soins
      'consultation', 'konsiltasyon',
      'médicament', 'medikaman',
      'traitement', 'tretman',
      'ordonnance', 'lòdonnans',
      'vaccin', 'vaksen'
    ],
    confidence: 0.9
  },

  education: {
    keywords: [
      // Établissements
      'école', 'school', 'lekòl',
      'université', 'inivèsite',
      'collège', 'kolèj',
      'lycée', 'lise',
      // Frais
      'frais scolaires', 'scolarité',
      'inscription', 'enskrisyon',
      'écolage', 'ekolaj',
      // Fournitures
      'cours', 'kou',
      'formation', 'fòmasyon',
      'livre', 'liv',
      'cahier', 'kaye',
      'uniforme', 'inifòm'
    ],
    confidence: 0.9
  },

  divertissement: {
    keywords: [
      'cinéma', 'movie', 'sinema',
      'concert', 'konsè',
      'spectacle', 'show',
      'bar', 'nightclub',
      'fête', 'party', 'fèt',
      'sortie', 'sòti',
      'restaurant-bar',
      'loisir', 'lwazi'
    ],
    confidence: 0.8
  },

  autre: {
    keywords: ['divers', 'autre', 'other', 'lòt'],
    confidence: 0.3
  }
};

// Opérateurs télécom haïtiens (référence rapide)
module.exports.TELECOM_OPERATORS = [
  'digicel',
  'natcom', 
  'teleco'
];

// Services publics haïtiens (référence rapide)
module.exports.PUBLIC_SERVICES = [
  'ed\'h',
  'edh',
  'électricité',
  'eau'
];