import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

// Firebase's web config is meant to be public — it identifies the project, it isn't a
// secret. Access control is enforced by Firestore/Storage security rules, not by hiding
// this. Safe to expose via Vite's VITE_ prefix like any other client-visible value.
const firebaseConfig = {
  apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY || '',
  authDomain: (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: (import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: (import.meta as any).env?.VITE_FIREBASE_APP_ID || '',
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
let storageInstance: FirebaseStorage | null = null;

const ensureApp = (): FirebaseApp => {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase is not configured. Set VITE_FIREBASE_* env vars.');
  }
  if (!app) app = initializeApp(firebaseConfig);
  return app;
};

export const getFirebaseAuth = (): Auth => (authInstance ||= getAuth(ensureApp()));
export const getFirebaseDb = (): Firestore => (dbInstance ||= getFirestore(ensureApp()));
export const getFirebaseStorage = (): FirebaseStorage => (storageInstance ||= getStorage(ensureApp()));
