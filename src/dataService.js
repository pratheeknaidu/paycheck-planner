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
    let redirectChecked = false;

    // Wait for redirect result before reporting null user
    getRedirectResult(auth)
        .then((result) => {
            redirectChecked = true;
            // If redirect returned a user, onAuthStateChanged will handle it
        })
        .catch((e) => {
            redirectChecked = true;
            console.error("Redirect result error:", e);
        });

    return onAuthStateChanged(auth, (user) => {
        if (user) {
            // User is signed in — always report immediately
            onUser({ uid: user.uid, displayName: user.displayName, email: user.email, photoURL: user.photoURL });
        } else if (redirectChecked) {
            // No user AND redirect already checked — truly not signed in
            onUser(null);
        } else {
            // No user but redirect hasn't been checked yet — wait for it
            const interval = setInterval(() => {
                if (redirectChecked) {
                    clearInterval(interval);
                    // Re-check auth state after redirect resolves
                    if (!auth.currentUser) {
                        onUser(null);
                    }
                }
            }, 100);
        }
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
