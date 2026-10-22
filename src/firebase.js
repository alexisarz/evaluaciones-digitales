import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyAYx1_kf_5Fnt2Wma2iv57OuJ6x1xFXhH8',
  authDomain: 'evaluacion-digital-uade.firebaseapp.com',
  projectId: 'evaluacion-digital-uade',
  storageBucket: 'evaluacion-digital-uade.firebasestorage.app',
  messagingSenderId: '1097293136739',
  appId: '1:1097293136739:web:323f8b7f8d4977f226c956',
  measurementId: 'G-7TYCFMMMBL',
}

const app = initializeApp(firebaseConfig)

export const db = getFirestore(app)
