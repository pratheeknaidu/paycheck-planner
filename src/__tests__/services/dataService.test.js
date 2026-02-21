import { describe, it, expect, vi, beforeEach } from "vitest";

// Need to mock the entire firebase module chain
vi.mock("../../firebase", () => ({
    db: "mock-db",
    auth: "mock-auth",
    googleProvider: "mock-provider",
}));

vi.mock("firebase/firestore", () => ({
    doc: vi.fn(() => "mock-doc-ref"),
    getDoc: vi.fn(),
    setDoc: vi.fn(),
    onSnapshot: vi.fn(() => vi.fn()),
    getFirestore: vi.fn(),
    initializeFirestore: vi.fn(),
}));

vi.mock("firebase/auth", () => ({
    signInWithPopup: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChanged: vi.fn(() => vi.fn()),
    getAuth: vi.fn(),
    GoogleAuthProvider: vi.fn(),
}));

vi.mock("firebase/app", () => ({
    initializeApp: vi.fn(),
}));

import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged } from "firebase/auth";
import { initAuth, signIn, signOut, loadUserData, saveUserData, subscribeToData } from "../../dataService";

describe("dataService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("initAuth", () => {
        it("calls onAuthStateChanged with a callback", () => {
            const callback = vi.fn();
            initAuth(callback);
            expect(onAuthStateChanged).toHaveBeenCalledOnce();
        });

        it("returns an unsubscribe function", () => {
            const unsub = initAuth(vi.fn());
            expect(typeof unsub).toBe("function");
        });
    });

    describe("signIn", () => {
        it("calls signInWithPopup", async () => {
            signInWithPopup.mockResolvedValue({ user: { uid: "123" } });
            await signIn();
            expect(signInWithPopup).toHaveBeenCalledOnce();
        });
    });

    describe("signOut", () => {
        it("calls firebaseSignOut", async () => {
            firebaseSignOut.mockResolvedValue();
            await signOut();
            expect(firebaseSignOut).toHaveBeenCalledOnce();
        });
    });

    describe("loadUserData", () => {
        it("returns data when document exists", async () => {
            getDoc.mockResolvedValue({ exists: () => true, data: () => ({ settings: { net_pay: 100 } }) });
            const data = await loadUserData("user-123");
            expect(data).toEqual({ settings: { net_pay: 100 } });
        });

        it("returns null when document does not exist", async () => {
            getDoc.mockResolvedValue({ exists: () => false });
            const data = await loadUserData("user-123");
            expect(data).toBeNull();
        });
    });

    describe("saveUserData", () => {
        it("calls setDoc with merge: true", async () => {
            setDoc.mockResolvedValue();
            const data = { bills: [] };
            await saveUserData("user-123", data);
            expect(setDoc).toHaveBeenCalledWith("mock-doc-ref", data, { merge: true });
        });

        it("propagates errors (no silent catch)", async () => {
            setDoc.mockRejectedValue(new Error("Network error"));
            await expect(saveUserData("user-123", {})).rejects.toThrow("Network error");
        });
    });

    describe("subscribeToData", () => {
        it("calls onSnapshot", () => {
            subscribeToData("user-123", vi.fn());
            expect(onSnapshot).toHaveBeenCalledOnce();
        });

        it("returns an unsubscribe function", () => {
            const unsub = subscribeToData("user-123", vi.fn());
            expect(typeof unsub).toBe("function");
        });
    });
});
