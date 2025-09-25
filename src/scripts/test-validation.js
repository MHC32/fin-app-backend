// test-validation.js - À placer à la racine du projet et exécuter avec: node test-validation.js

console.log("🧪 === TEST SIMPLE DE VALIDATION ===");
console.log("Exécuté à:", new Date().toISOString());

try {
  // Import exact comme dans le controller
  const { HAITI_BANKS, CURRENCIES, ACCOUNT_TYPES } = require('./src/utils/constants');
  
  console.log("\n✅ Constants importées avec succès");
  
  // TEST 1: Structure des objets
  console.log("\n📋 STRUCTURE DES OBJETS:");
  console.log("- ACCOUNT_TYPES:", Object.keys(ACCOUNT_TYPES));
  console.log("- HAITI_BANKS:", Object.keys(HAITI_BANKS)); 
  console.log("- CURRENCIES:", Object.keys(CURRENCIES));
  
  // TEST 2: Le payload qui échoue
  const payload = {
    type: "checking",
    bankName: "buh",
    currency: "HTG"
  };
  
  console.log("\n🎯 PAYLOAD DE TEST:", payload);
  
  // TEST 3: Validations exactes du controller
  console.log("\n🔍 TESTS DE VALIDATION:");
  
  // Type validation (ligne ~87 du controller)
  const typeValidation = Object.keys(ACCOUNT_TYPES).includes(payload.type);
  console.log(`✅ Type '${payload.type}' valide:`, typeValidation);
  
  // Bank validation (ligne ~96 du controller) 
  const validBanks = Object.keys(HAITI_BANKS);
  const bankValidation = validBanks.includes(payload.bankName);
  console.log(`✅ Bank '${payload.bankName}' valide:`, bankValidation);
  console.log("   Valid banks:", validBanks);
  
  // Currency validation (ligne ~105 du controller)
  const currencyValidation = Object.keys(CURRENCIES).includes(payload.currency);
  console.log(`✅ Currency '${payload.currency}' valide:`, currencyValidation);
  
  // TEST 4: Les anciennes méthodes qui causent les erreurs
  console.log("\n❌ TESTS DES ANCIENNES MÉTHODES (doivent échouer):");
  
  try {
    const oldTypeValidation = Object.values(ACCOUNT_TYPES).includes(payload.type);
    console.log("❌ Object.values(ACCOUNT_TYPES) includes 'checking':", oldTypeValidation);
  } catch (e) {
    console.log("❌ Object.values(ACCOUNT_TYPES) error:", e.message);
  }
  
  try {
    const oldBankValidation = HAITI_BANKS.map(bank => bank.code);
    console.log("❌ HAITI_BANKS.map() result:", oldBankValidation);
  } catch (e) {
    console.log("❌ HAITI_BANKS.map() error (attendu):", e.message);
  }
  
  // TEST 5: sanitizeAccountData function test
  console.log("\n🧹 TEST SANITIZE FUNCTION:");
  const mockAccount = {
    toObject: () => ({
      bankName: 'buh',
      currency: 'HTG',
      name: 'Test Account'
    })
  };
  
  try {
    // Test ancien pattern
    const accountData = mockAccount.toObject();
    // accountData.bankInfo = HAITI_BANKS.find(bank => bank.code === accountData.bankName); // ❌ ANCIEN
    accountData.bankInfo = HAITI_BANKS[accountData.bankName] || HAITI_BANKS.other; // ✅ NOUVEAU
    console.log("✅ Nouvelle méthode sanitize:", !!accountData.bankInfo);
  } catch (e) {
    console.log("❌ Erreur sanitize:", e.message);
  }
  
  // RÉSUMÉ
  console.log("\n📊 === RÉSUMÉ ===");
  const allValid = typeValidation && bankValidation && currencyValidation;
  
  if (allValid) {
    console.log("✅ TOUTES LES VALIDATIONS PASSENT!");
    console.log("   → Le problème vient probablement du cache ou du serveur pas redémarré");
    console.log("   → Solution: Redémarrer complètement votre serveur Node.js");
  } else {
    console.log("❌ Certaines validations échouent");
    console.log("   → Vérifier la structure des constantes");
  }
  
} catch (error) {
  console.log("❌ ERREUR D'IMPORT:", error.message);
  console.log("   → Vérifier le chemin: ./src/utils/constants");
  console.log("   → Vérifier que le fichier existe");
  console.log("   → Stack:", error.stack);
}

console.log("\n🔧 === ACTIONS À PRENDRE ===");
console.log("1. Si ce test passe → Redémarrer le serveur");
console.log("2. Si ce test échoue → Vérifier les constantes");
console.log("3. Ajouter des console.log dans le vrai controller");
console.log("4. Vérifier qu'on modifie le bon fichier");