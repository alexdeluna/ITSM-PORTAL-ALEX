import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";

import {
    getAuth,
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

import {
    getFirestore,
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

import { firebaseConfig } from "./firebase-config.js";

const firebaseApp = initializeApp(firebaseConfig);

const auth = getAuth(firebaseApp);

const db = getFirestore(firebaseApp);

const googleProvider = new GoogleAuthProvider();

export {
    auth,
    db,
    googleProvider,
    doc,
    getDoc,
    signInWithEmailAndPassword,
    signInWithPopup,
    onAuthStateChanged,
    signOut
};
