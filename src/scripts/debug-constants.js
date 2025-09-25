// debug-constants.js - Script de diagnostic pour identifier le problème exact
console.log("=== 🔍 DIAGNOSTIC CONSTANTS DEBUG ===");
console.log("Date:", new Date().toISOString());
console.log("Node.js version:", process.version);

try {
  // 1. TEST IMPORT DES CONSTANTES
  console.log("\n1️⃣ === TEST IMPORT CONSTANTS ===");
  const { HAITI_BANKS, CURRENCIES, ACCOUNT_TYPES } = require('./src/utils/constants');
  
  console.log("✅ Import des constantes réussi");
  console.log("HAITI_BANKS type:", typeof HAITI_BANKS);
  console.log("ACCOUNT_TYPES type:", typeof ACCOUNT_TYPES);
  console.log("CURRENCIES type:", typeof CURRENCIES);

  // 2. TEST STRUCTURE DES CONSTANTES
  console.log("\n2️⃣ === TEST STRUCTURE CONSTANTES ===");
  
  console.log("ACCOUNT_TYPES keys:", Object.keys(ACCOUNT_TYPES));
  console.log("ACCOUNT_TYPES.checking exists:", !!ACCOUNT_TYPES.checking);
  console.log("ACCOUNT_TYPES.checking structure:", ACCOUNT_TYPES.checking);
  
  console.log("HAITI_BANKS keys:", Object.keys(HAITI_BANKS));
  console.log("HAITI_BANKS.buh exists:", !!HAITI_BANKS.buh);
  console.log("HAITI_BANKS.buh structure:", HAITI_BANKS.buh);
  
  console.log("HAITI_BANKS is Array?", Array.isArray(HAITI_BANKS));
  console.log("HAITI_BANKS has .map method?", typeof HAITI_BANKS.map);
  
  // 3. TEST DES VALIDATIONS
  console.log("\n3️⃣ === TEST VALIDATIONS ===");
  
  const testPayload = {
    type: "checking",
    bankName: "buh", 
    currency: "HTG"
  };
  
  console.log("Test payload:", testPayload);
  
  // Test Object.keys vs Object.values
  console.log("✅ Object.keys(ACCOUNT_TYPES).includes('checking'):", 
    Object.keys(ACCOUNT_TYPES).includes(testPayload.type));
  console.log("❌ Object.values(ACCOUNT_TYPES).includes('checking'):", 
    Object.values(ACCOUNT_TYPES).includes(testPayload.type));
  
  console.log("✅ Object.keys(HAITI_BANKS).includes('buh'):", 
    Object.keys(HAITI_BANKS).includes(testPayload.bankName));
    
  console.log("✅ Object.keys(CURRENCIES).includes('HTG'):", 
    Object.keys(CURRENCIES).includes(testPayload.currency));

  // 4. TEST DES ERREURS POTENTIELLES
  console.log("\n4️⃣ === TEST ERREURS POTENTIELLES ===");
  
  try {
    console.log("❌ Test: HAITI_BANKS.map()");
    const result = HAITI_BANKS.map(x => x.code);
    console.log("ERREUR: .map() ne devrait pas fonctionner!", result);
  } catch (error) {
    console.log("✅ Erreur attendue:", error.message);
  }

  // 5. TEST IMPORT CONTROLLER
  console.log("\n5️⃣ === TEST IMPORT CONTROLLER ===");
  
  try {
    const accountController = require('./src/controllers/accountController');
    console.log("✅ Import accountController réussi");
    console.log("Controller functions:", Object.keys(accountController));
  } catch (error) {
    console.log("❌ Erreur import controller:", error.message);
  }

  // 6. VÉRIFICATION DU CODE EN COURS D'EXECUTION
  console.log("\n6️⃣ === VÉRIFICATION CODE ACTUEL ===");
  
  const fs = require('fs');
  const path = require('path');
  
  try {
    const controllerPath = path.join(__dirname, 'src/controllers/accountController.js');
    const controllerCode = fs.readFileSync(controllerPath, 'utf8');
    
    // Chercher les patterns problématiques
    const hasOldTypeValidation = controllerCode.includes('Object.values(ACCOUNT_TYPES)');
    const hasOldBankValidation = controllerCode.includes('HAITI_BANKS.map(');
    const hasOldCurrencyValidation = controllerCode.includes('Object.values(CURRENCIES).map(');
    const hasOldFindPattern = controllerCode.includes('HAITI_BANKS.find(');
    
    console.log("📁 Fichier analysé:", controllerPath);
    console.log("❌ Ancien pattern type (Object.values):", hasOldTypeValidation);
    console.log("❌ Ancien pattern bank (.map):", hasOldBankValidation);
    console.log("❌ Ancien pattern currency:", hasOldCurrencyValidation);  
    console.log("❌ Ancien pattern find:", hasOldFindPattern);
    
    if (hasOldTypeValidation || hasOldBankValidation || hasOldCurrencyValidation || hasOldFindPattern) {
      console.log("\n🚨 PROBLÈME IDENTIFIÉ: Le fichier contient encore les anciens patterns!");
      console.log("   → Les corrections n'ont pas été appliquées correctement");
    } else {
      console.log("\n✅ Le fichier semble corrigé");
      console.log("   → Problème probable: cache Node.js ou serveur pas redémarré");
    }
    
  } catch (error) {
    console.log("❌ Erreur lecture fichier:", error.message);
  }

} catch (error) {
  console.log("❌ ERREUR GLOBALE:", error.message);
  console.log("Stack:", error.stack);
}

console.log("\n=== 🎯 RECOMMANDATIONS ===");
console.log("1. Redémarrer complètement le serveur Node.js");
console.log("2. Vider le cache Node.js: rm -rf node_modules/.cache");  
console.log("3. Vérifier que les corrections sont dans le bon fichier");
console.log("4. Vérifier les imports et les chemins");
console.log("5. Ajouter des console.log temporaires pour debug");

// EXPORT pour usage en tant que module
module.exports = {
  testConstants: () => {
    const { HAITI_BANKS, CURRENCIES, ACCOUNT_TYPES } = require('./src/utils/constants');
    return {
      accountTypesKeys: Object.keys(ACCOUNT_TYPES),
      haitiBanksKeys: Object.keys(HAITI_BANKS),
      currenciesKeys: Object.keys(CURRENCIES),
      validations: {
        checking: Object.keys(ACCOUNT_TYPES).includes('checking'),
        buh: Object.keys(HAITI_BANKS).includes('buh'),
        HTG: Object.keys(CURRENCIES).includes('HTG')
      }
    };
  }
};