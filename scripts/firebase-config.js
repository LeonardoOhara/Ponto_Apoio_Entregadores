// 🔑 COLOQUE SUAS CONFIGURAÇÕES DO FIREBASE AQUI!
// Para obter essas informações:
// 1. Acesse https://console.firebase.google.com/
// 2. Crie/Abra seu projeto
// 3. Clique no ícone de engrenagem (⚙️) > Project Settings
// 4. Na aba "General", abaixo de "Your apps", clique em "Add app" > Web (</>)
// 5. Copie a configuração do Firebase e cole aqui!
const firebaseConfig = {
  apiKey: "AIzaSyDkkRgIf9-c6gml3-YNcRQXl4rNPQ27vdo",
  authDomain: "pontoapoio-3fb92.firebaseapp.com",
  projectId: "pontoapoio-3fb92",
  storageBucket: "pontoapoio-3fb92.firebasestorage.app",
  messagingSenderId: "352436776318",
  appId: "1:352436776318:web:209eeca43f09950e4e172f",
  measurementId: "G-FQJB4YKX29"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database(); // Referência ao Realtime Database
