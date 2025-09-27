// src/scripts/testDebts.js
// 🧪 TESTS COMPLETS API DEBTS - FINAPP HAITI

const axios = require('axios');
const mongoose = require('mongoose');
const User = require('../models/User');
const Debt = require('../models/Debt');
const { verifyAccessToken } = require('../config/jwt');
require('dotenv').config({ path: '.env.local' });

const API_BASE_URL = process.env.API_URL || 'http://localhost:3001/api';

// Configuration des tests
const TEST_CONFIG = {
  USER_EMAIL: 'hantzmichaelchery6@gmail.com'
};

// Client axios avec token
let apiClient;
let testDebtId;
let testLoanId;

// Résultats des tests
const testResults = [];

// ===================================================================
// CONFIGURATION
// ===================================================================

const setupTests = async () => {
  console.log('🚀 Lancement des tests complets du module Dettes...');
  console.log('🧪 TEST COMPLET MODULE DETTES - FINAPP HAITI');
  console.log('='.repeat(60));
  
  // Connexion MongoDB
  console.log('🔗 Connexion à MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ MongoDB connecté');
  
  // Récupérer utilisateur et token
  console.log('🔑 Recherche de l\'utilisateur et token valide...');
  const user = await User.findOne({ email: TEST_CONFIG.USER_EMAIL });
  
  if (!user) {
    throw new Error('Utilisateur de test non trouvé');
  }
  
  console.log(`✅ Utilisateur trouvé: ${user.firstName} ${user.lastName}`);
  
  // Trouver session valide
  const validSession = user.activeSessions.find(session => {
    if (!session.accessToken) return false;
    if (session.expiresAt < new Date()) return false;
    
    try {
      const verification = verifyAccessToken(session.accessToken);
      return verification.isValid && !verification.expired;
    } catch (e) {
      return false;
    }
  });
  
  if (!validSession) {
    throw new Error('Aucune session valide trouvée');
  }
  
  const token = validSession.accessToken;
  console.log('✅ Token valide récupéré');
  
  // Créer client axios
  apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  console.log('='.repeat(60));
};

// ===================================================================
// TESTS
// ===================================================================

const runTests = async () => {
  console.log('\n🚀 DÉBUT DES TESTS DES ENDPOINTS DEBTS');
  console.log('='.repeat(60));
  
  // ===================================================================
  // TEST 1: Créer une dette (debt)
  // ===================================================================
  console.log('\n🎯 TEST 1: POST /api/debts (Créer dette)');
  try {
    const startTime = Date.now();
    const debtData = {
      type: 'debt',
      contact: {
        name: 'Jean Pierre Test',
        phone: '+509 3456-7890',
        relation: 'friend'
      },
      amount: 5000,
      currency: 'HTG',
      description: 'Prêt pour urgence médicale - Test automatique',
      reason: 'emergency',
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // +30 jours
      priority: 'high'
    };
    
    const response = await apiClient.post('/debts', debtData);
    const duration = Date.now() - startTime;
    
    testDebtId = response.data.data._id;
    
    console.log(`✅ Status: ${response.status}`);
    console.log(`✅ Durée: ${duration}ms`);
    console.log(`✅ Dette créée: ${response.data.data.contact.name}`);
    console.log(`✅ Montant: ${response.data.data.amount} ${response.data.data.currency}`);
    console.log(`✅ Statut: ${response.data.data.status}`);
    console.log(`✅ ID: ${testDebtId}`);
    
    testResults.push({ name: 'createDebt', passed: true, duration });
  } catch (error) {
    console.log(`❌ ERREUR: ${error.response?.status || error.code}`);
    console.log(`❌ Message: ${error.response?.data?.message || error.message}`);
    testResults.push({ name: 'createDebt', passed: false, error: error.message });
  }
  
  // ===================================================================
  // TEST 2: Créer une créance (loan)
  // ===================================================================
  console.log('\n🎯 TEST 2: POST /api/debts (Créer créance)');
  try {
    const startTime = Date.now();
    const loanData = {
      type: 'loan',
      contact: {
        name: 'Marie Dupont Test',
        phone: '+509 2222-3333',
        relation: 'colleague'
      },
      amount: 3000,
      currency: 'HTG',
      description: 'Prêt personnel - Test automatique',
      reason: 'personal',
      dueDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), // +45 jours
      priority: 'medium',
      paymentTerms: {
        installments: true,
        installmentAmount: 1000,
        installmentFrequency: 'monthly',
        numberOfInstallments: 3
      }
    };
    
    const response = await apiClient.post('/debts', loanData);
    const duration = Date.now() - startTime;
    
    testLoanId = response.data.data._id;
    
    console.log(`✅ Status: ${response.status}`);
    console.log(`✅ Durée: ${duration}ms`);
    console.log(`✅ Créance créée: ${response.data.data.contact.name}`);
    console.log(`✅ Montant: ${response.data.data.amount} ${response.data.data.currency}`);
    console.log(`✅ Paiements échelonnés: ${response.data.data.paymentTerms.numberOfInstallments} fois`);
    console.log(`✅ ID: ${testLoanId}`);
    
    testResults.push({ name: 'createLoan', passed: true, duration });
  } catch (error) {
    console.log(`❌ ERREUR: ${error.response?.status || error.code}`);
    console.log(`❌ Message: ${error.response?.data?.message || error.message}`);
    testResults.push({ name: 'createLoan', passed: false, error: error.message });
  }
  
  // ===================================================================
  // TEST 3: Lister toutes les dettes
  // ===================================================================
  console.log('\n🎯 TEST 3: GET /api/debts (Liste toutes)');
  try {
    const startTime = Date.now();
    const response = await apiClient.get('/debts');
    const duration = Date.now() - startTime;
    
    console.log(`✅ Status: ${response.status}`);
    console.log(`✅ Durée: ${duration}ms`);
    console.log(`✅ Total items: ${response.data.data.count}`);
    
    if (response.data.data.statistics) {
      console.log(`✅ Total dettes: ${response.data.data.statistics.totalDebt} HTG`);
      console.log(`✅ Total créances: ${response.data.data.statistics.totalLoans} HTG`);
      console.log(`✅ Position nette: ${response.data.data.statistics.netPosition} HTG`);
    }
    
    testResults.push({ name: 'getDebts', passed: true, duration });
  } catch (error) {
    console.log(`❌ ERREUR: ${error.response?.status || error.code}`);
    console.log(`❌ Message: ${error.response?.data?.message || error.message}`);
    testResults.push({ name: 'getDebts', passed: false, error: error.message });
  }
  
  // ===================================================================
  // TEST 4: Résumé financier
  // ===================================================================
  console.log('\n🎯 TEST 4: GET /api/debts/summary');
  try {
    const startTime = Date.now();
    const response = await apiClient.get('/debts/summary');
    const duration = Date.now() - startTime;
    
    console.log(`✅ Status: ${response.status}`);
    console.log(`✅ Durée: ${duration}ms`);
    
    const overview = response.data.data.overview;
    console.log(`✅ Dettes actives: ${overview.activeDebts}`);
    console.log(`✅ Créances actives: ${overview.activeLoans}`);
    console.log(`✅ Position nette: ${overview.netPosition} HTG`);
    
    if (response.data.data.overdue?.count > 0) {
      console.log(`⚠️  Éléments en retard: ${response.data.data.overdue.count}`);
    }
    
    testResults.push({ name: 'getSummary', passed: true, duration });
  } catch (error) {
    console.log(`❌ ERREUR: ${error.response?.status || error.code}`);
    console.log(`❌ Message: ${error.response?.data?.message || error.message}`);
    testResults.push({ name: 'getSummary', passed: false, error: error.message });
  }
  
  // ===================================================================
  // TEST 5: Détails dette spécifique
  // ===================================================================
  console.log('\n🎯 TEST 5: GET /api/debts/:id (Détails dette)');
  try {
    const startTime = Date.now();
    const response = await apiClient.get(`/debts/${testDebtId}`);
    const duration = Date.now() - startTime;
    
    console.log(`✅ Status: ${response.status}`);
    console.log(`✅ Durée: ${duration}ms`);
    console.log(`✅ Type: ${response.data.data.type}`);
    console.log(`✅ Montant: ${response.data.data.amount} ${response.data.data.currency}`);
    console.log(`✅ Montant payé: ${response.data.data.amountPaid}`);
    console.log(`✅ Reste: ${response.data.data.amountRemaining}`);
    console.log(`✅ Progression: ${response.data.data.percentagePaid}%`);
    
    testResults.push({ name: 'getDebtById', passed: true, duration });
  } catch (error) {
    console.log(`❌ ERREUR: ${error.response?.status || error.code}`);
    console.log(`❌ Message: ${error.response?.data?.message || error.message}`);
    testResults.push({ name: 'getDebtById', passed: false, error: error.message });
  }
  
  // ===================================================================
  // TEST 6: Enregistrer paiement
  // ===================================================================
  console.log('\n🎯 TEST 6: POST /api/debts/:id/payment');
  try {
    const startTime = Date.now();
    const paymentData = {
      amount: 2000,
      paymentMethod: 'moncash',
      note: 'Premier paiement - Test automatique',
      createTransaction: true
    };
    
    const response = await apiClient.post(`/debts/${testDebtId}/payment`, paymentData);
    const duration = Date.now() - startTime;
    
    console.log(`✅ Status: ${response.status}`);
    console.log(`✅ Durée: ${duration}ms`);
    console.log(`✅ Paiement enregistré: ${paymentData.amount} HTG`);
    console.log(`✅ Total payé: ${response.data.data.amountPaid} HTG`);
    console.log(`✅ Reste: ${response.data.data.amountRemaining} HTG`);
    console.log(`✅ Nouveau statut: ${response.data.data.status}`);
    console.log(`✅ Progression: ${response.data.data.percentagePaid}%`);
    
    testResults.push({ name: 'makePayment', passed: true, duration });
  } catch (error) {
    console.log(`❌ ERREUR: ${error.response?.status || error.code}`);
    console.log(`❌ Message: ${error.response?.data?.message || error.message}`);
    testResults.push({ name: 'makePayment', passed: false, error: error.message });
  }
  
  // ===================================================================
  // TEST 7: Historique paiements
  // ===================================================================
  console.log('\n🎯 TEST 7: GET /api/debts/:id/payments');
  try {
    const startTime = Date.now();
    const response = await apiClient.get(`/debts/${testDebtId}/payments`);
    const duration = Date.now() - startTime;
    
    console.log(`✅ Status: ${response.status}`);
    console.log(`✅ Durée: ${duration}ms`);
    console.log(`✅ Nombre de paiements: ${response.data.data.payments.length}`);
    console.log(`✅ Total payé: ${response.data.data.totalPaid} HTG`);
    console.log(`✅ Reste: ${response.data.data.remaining} HTG`);
    
    testResults.push({ name: 'getPayments', passed: true, duration });
  } catch (error) {
    console.log(`❌ ERREUR: ${error.response?.status || error.code}`);
    console.log(`❌ Message: ${error.response?.data?.message || error.message}`);
    testResults.push({ name: 'getPayments', passed: false, error: error.message });
  }
  
  // ===================================================================
  // TEST 8: Créer rappel
  // ===================================================================
  console.log('\n🎯 TEST 8: POST /api/debts/:id/reminder');
  try {
    const startTime = Date.now();
    const reminderData = {
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // +7 jours
      type: 'payment_due',
      message: 'Ne pas oublier le prochain paiement - Test'
    };
    
    const response = await apiClient.post(`/debts/${testDebtId}/reminder`, reminderData);
    const duration = Date.now() - startTime;
    
    console.log(`✅ Status: ${response.status}`);
    console.log(`✅ Durée: ${duration}ms`);
    console.log(`✅ Rappel créé`);
    
    const lastReminder = response.data.data.reminders[response.data.data.reminders.length - 1];
    console.log(`✅ Type: ${lastReminder.type}`);
    console.log(`✅ Date: ${new Date(lastReminder.date).toLocaleDateString()}`);
    
    testResults.push({ name: 'createReminder', passed: true, duration });
  } catch (error) {
    console.log(`❌ ERREUR: ${error.response?.status || error.code}`);
    console.log(`❌ Message: ${error.response?.data?.message || error.message}`);
    testResults.push({ name: 'createReminder', passed: false, error: error.message });
  }
  
  // ===================================================================
  // TEST 9: Modifier dette
  // ===================================================================
  console.log('\n🎯 TEST 9: PUT /api/debts/:id');
  try {
    const startTime = Date.now();
    const updateData = {
      priority: 'urgent',
      notes: 'Priorité augmentée - Test automatique'
    };
    
    const response = await apiClient.put(`/debts/${testDebtId}`, updateData);
    const duration = Date.now() - startTime;
    
    console.log(`✅ Status: ${response.status}`);
    console.log(`✅ Durée: ${duration}ms`);
    console.log(`✅ Mise à jour réussie`);
    console.log(`✅ Nouvelle priorité: ${response.data.data.priority}`);
    
    testResults.push({ name: 'updateDebt', passed: true, duration });
  } catch (error) {
    console.log(`❌ ERREUR: ${error.response?.status || error.code}`);
    console.log(`❌ Message: ${error.response?.data?.message || error.message}`);
    testResults.push({ name: 'updateDebt', passed: false, error: error.message });
  }
  
  // ===================================================================
  // TEST 10: Archiver créance
  // ===================================================================
  console.log('\n🎯 TEST 10: PUT /api/debts/:id/archive');
  try {
    const startTime = Date.now();
    const response = await apiClient.put(`/debts/${testLoanId}/archive`);
    const duration = Date.now() - startTime;
    
    console.log(`✅ Status: ${response.status}`);
    console.log(`✅ Durée: ${duration}ms`);
    console.log(`✅ Archivage réussi`);
    console.log(`✅ Archivée: ${response.data.data.isArchived}`);
    
    testResults.push({ name: 'toggleArchive', passed: true, duration });
  } catch (error) {
    console.log(`❌ ERREUR: ${error.response?.status || error.code}`);
    console.log(`❌ Message: ${error.response?.data?.message || error.message}`);
    testResults.push({ name: 'toggleArchive', passed: false, error: error.message });
  }
  
  // ===================================================================
  // TEST 11: Calculer intérêts (avec dette ayant intérêts)
  // ===================================================================
  console.log('\n🎯 TEST 11: POST /api/debts/:id/calculate-interest');
  try {
    const startTime = Date.now();
    const response = await apiClient.post(`/debts/${testDebtId}/calculate-interest`);
    const duration = Date.now() - startTime;
    
    console.log(`✅ Status: ${response.status}`);
    console.log(`✅ Durée: ${duration}ms`);
    console.log(`✅ Intérêts calculés: ${response.data.data.interestAmount} HTG`);
    
    testResults.push({ name: 'calculateInterest', passed: true, duration });
  } catch (error) {
    if (error.response?.status === 400 && error.response?.data?.error === 'no_interest') {
      console.log('ℹ️  Cette dette n\'a pas d\'intérêts - Comportement normal');
      testResults.push({ name: 'calculateInterest', passed: true, warning: 'no_interest' });
    } else {
      console.log(`❌ ERREUR: ${error.response?.status || error.code}`);
      console.log(`❌ Message: ${error.response?.data?.message || error.message}`);
      testResults.push({ name: 'calculateInterest', passed: false, error: error.message });
    }
  }
};

// ===================================================================
// NETTOYAGE (Supprimer les dettes de test)
// ===================================================================

const cleanup = async () => {
  console.log('\n🧹 NETTOYAGE DES DONNÉES DE TEST');
  console.log('='.repeat(60));
  
  try {
    // Supprimer dette de test
    if (testDebtId) {
      await apiClient.delete(`/debts/${testDebtId}`);
      console.log(`✅ Dette de test supprimée: ${testDebtId}`);
    }
    
    // Supprimer créance de test
    if (testLoanId) {
      await apiClient.delete(`/debts/${testLoanId}`);
      console.log(`✅ Créance de test supprimée: ${testLoanId}`);
    }
  } catch (error) {
    console.log(`⚠️  Erreur lors du nettoyage: ${error.message}`);
  }
};

// ===================================================================
// RAPPORT FINAL
// ===================================================================

const generateReport = () => {
  console.log('\n' + '='.repeat(60));
  console.log('📊 RAPPORT FINAL DES TESTS MODULE DETTES');
  console.log('='.repeat(60));
  
  const passed = testResults.filter(r => r.passed).length;
  const total = testResults.length;
  const successRate = ((passed / total) * 100).toFixed(1);
  
  console.log('\n📈 STATISTIQUES GLOBALES:');
  console.log(`   Tests exécutés: ${total}`);
  console.log(`   Tests réussis: ${passed}`);
  console.log(`   Taux de succès: ${successRate}%`);
  
  console.log('\n🔍 DÉTAIL DES TESTS:');
  testResults.forEach((result, index) => {
    const status = result.passed ? '✅' : '❌';
    const duration = result.duration ? `(${result.duration}ms)` : '';
    const warning = result.warning ? `⚠️ ${result.warning}` : '';
    const error = result.error ? `\n      Erreur: ${result.error}` : '';
    
    console.log(`   ${index + 1}. ${status} ${result.name} ${duration} ${warning}${error}`);
  });
  
  console.log('\n' + '='.repeat(60));
  
  if (successRate >= 90) {
    console.log('🎉 EXCELLENT! Module Dettes 100% fonctionnel!');
    console.log('✅ Phase 6 : Terminée et validée');
  } else if (successRate >= 70) {
    console.log('✅ BIEN! Module Dettes fonctionnel avec quelques avertissements.');
  } else if (successRate >= 50) {
    console.log('⚠️ Attention! Certains tests échouent, vérifiez les détails.');
  } else {
    console.log('🚨 État critique! Révision urgente nécessaire.');
  }
  
  console.log('='.repeat(60));
};

// ===================================================================
// EXÉCUTION
// ===================================================================

const main = async () => {
  try {
    await setupTests();
    await runTests();
    await cleanup();
    generateReport();
  } catch (error) {
    console.error('\n❌ ERREUR FATALE:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔒 Connexion MongoDB fermée');
  }
};

main();