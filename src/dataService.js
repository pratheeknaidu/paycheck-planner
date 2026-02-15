// ─── Data Service Layer ───
// Abstraction between the app and storage backend.
// Currently uses Firebase Firestore. To switch to your own API,
// just replace the implementations in this file — App.jsx stays untouched.

import { db, auth, googleProvider } from "./firebase";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { signInWithRedirect, getRedirectResult, signOut as firebaseSignOut, onAuthStateChanged } from "firebase/auth";

// ─── AUTH ───

/** Listen for auth state changes. Calls onUser(user) or onUser(null). */
export function initAuth(onUser) {
    // Check for redirect result first (returning from Google sign-in)
    getRedirectResult(auth).catch((e) => console.error("Redirect result error:", e));
    return onAuthStateChanged(auth, (user) => {
        onUser(user ? { uid: user.uid, displayName: user.displayName, email: user.email, photoURL: user.photoURL } : null);
    });
}

/** Sign in with Google (full-page redirect — no iframes). */
export async function signIn() {
    return signInWithRedirect(auth, googleProvider);
}

/** Sign out. */
export async function signOut() {
    return firebaseSignOut(auth);
}

// ─── DATA ───

const getUserDocRef = (uid) => doc(db, "users", uid);

/** Load all user data from Firestore. Returns null if no data exists. */
export async function loadUserData(uid) {
    try {
        const snap = await getDoc(getUserDocRef(uid));
        if (snap.exists()) return snap.data();
        return null;
    } catch (e) {
        console.error("loadUserData error:", e);
        return null;
    }
}

/** Save all user data to Firestore. */
export async function saveUserData(uid, data) {
    try {
        await setDoc(getUserDocRef(uid), data, { merge: true });
    } catch (e) {
        console.error("saveUserData error:", e);
    }
}

/** Subscribe to real-time data changes (for cross-device sync).
 *  Returns an unsubscribe function. */
export function subscribeToData(uid, callback) {
    return onSnapshot(getUserDocRef(uid), (snap) => {
        if (snap.exists()) {
            callback(snap.data());
        }
    }, (error) => {
        console.error("subscribeToData error:", error);
    });
}
