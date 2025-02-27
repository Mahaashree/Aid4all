import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue } from "firebase/database";


const firebaseConfig = {
    apiKey: "AIzaSyBhJCnsaNXs76foQPVER4_rI26YDzDgMJE",
    authDomain: "aid4all.firebaseapp.com",
    databaseURL: "https://aid4all-default-rtdb.firebaseio.com",
    projectId: "aid4all",
    storageBucket: "aid4all.firebasestorage.app",
    messagingSenderId: "166366148408",
    appId: "1:166366148408:web:69f2bd104063dbbc4df3cd"
};
  


const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

export { database, ref, onValue };
