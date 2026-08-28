import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  GoogleAuthProvider,
  type User,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseDb } from './firebaseConfig';

const googleProvider = new GoogleAuthProvider();

const upsertUserProfile = async (user: User) => {
  const db = getFirebaseDb();
  await setDoc(
    doc(db, 'users', user.uid),
    {
      email: user.email || null,
      displayName: user.displayName || null,
      photoURL: user.photoURL || null,
      lastSignInAt: serverTimestamp(),
    },
    { merge: true },
  );
};

export const signUpWithEmail = async (email: string, password: string, displayName?: string): Promise<User> => {
  const auth = getFirebaseAuth();
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) {
    await updateProfile(credential.user, { displayName });
  }
  await upsertUserProfile(credential.user);
  return credential.user;
};

export const signInWithEmail = async (email: string, password: string): Promise<User> => {
  const auth = getFirebaseAuth();
  const credential = await signInWithEmailAndPassword(auth, email, password);
  await upsertUserProfile(credential.user);
  return credential.user;
};

export const signInWithGoogle = async (): Promise<User> => {
  const auth = getFirebaseAuth();
  const credential = await signInWithPopup(auth, googleProvider);
  await upsertUserProfile(credential.user);
  return credential.user;
};

export const signOut = async (): Promise<void> => {
  const auth = getFirebaseAuth();
  await firebaseSignOut(auth);
};

export const watchAuthState = (callback: (user: User | null) => void): (() => void) => {
  const auth = getFirebaseAuth();
  return onAuthStateChanged(auth, callback);
};

export const getFirebaseAuthErrorMessage = (error: any): string => {
  const code = String(error?.code || '');
  switch (code) {
    case 'auth/email-already-in-use':
      return 'That email is already registered — try signing in instead.';
    case 'auth/invalid-email':
      return 'That email address looks invalid.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in was cancelled.';
    case 'auth/too-many-requests':
      return 'Too many attempts — please wait a moment and try again.';
    default:
      return error?.message || 'Something went wrong. Please try again.';
  }
};
