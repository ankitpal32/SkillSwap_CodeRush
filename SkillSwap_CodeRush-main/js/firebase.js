// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
	apiKey: "AIzaSyCTUTPau9MdDjUTTLVEBjzB4Ypv3ViV13k",
	authDomain: "skillswap-7b293.firebaseapp.com",
	projectId: "skillswap-7b293",
	storageBucket: "skillswap-7b293.firebasestorage.app",
	messagingSenderId: "146099094164",
	appId: "1:146099094164:web:b7afffb6fcdddd063dea81"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

    