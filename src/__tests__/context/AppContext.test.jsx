import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Firebase to prevent initialization
vi.mock("../../firebase", () => ({
    db: "mock-db",
    auth: "mock-auth",
    googleProvider: "mock-provider",
}));
vi.mock("firebase/firestore", () => ({
    doc: vi.fn(),
    getDoc: vi.fn(),
    setDoc: vi.fn(),
    onSnapshot: vi.fn(() => vi.fn()),
    getFirestore: vi.fn(),
}));
vi.mock("firebase/auth", () => ({
    signInWithPopup: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChanged: vi.fn((_auth, cb) => { cb(null); return vi.fn(); }),
    getAuth: vi.fn(),
    GoogleAuthProvider: vi.fn(),
}));
vi.mock("firebase/app", () => ({
    initializeApp: vi.fn(),
}));
vi.mock("../../dataService", () => ({
    initAuth: vi.fn((cb) => { cb(null); return vi.fn(); }),
    signIn: vi.fn(),
    signOut: vi.fn(),
    loadUserData: vi.fn(),
    saveUserData: vi.fn(),
    subscribeToData: vi.fn(() => vi.fn()),
}));

import { renderHook, act } from "@testing-library/react";
import { AppProvider, useApp } from "../../context/AppContext";
import { DEFAULT_SETTINGS, DEFAULT_BILLS, DEFAULT_GOALS } from "../../constants/defaults";

function wrapper({ children }) {
    return <AppProvider>{children}</AppProvider>;
}

describe("AppContext", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Mock localStorage for jsdom
        const store = {};
        vi.stubGlobal("localStorage", {
            getItem: vi.fn((key) => store[key] || null),
            setItem: vi.fn((key, val) => { store[key] = val; }),
            removeItem: vi.fn((key) => { delete store[key]; }),
            clear: vi.fn(() => { Object.keys(store).forEach((k) => delete store[k]); }),
        });
    });

    it("provides default data when no local data exists", () => {
        const { result } = renderHook(() => useApp(), { wrapper });
        expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
        expect(result.current.bills).toEqual(DEFAULT_BILLS);
        expect(result.current.goals).toEqual(DEFAULT_GOALS);
    });

    it("provides navigation state", () => {
        const { result } = renderHook(() => useApp(), { wrapper });
        expect(result.current.screen).toBe("dashboard");
        act(() => result.current.setScreen("bills"));
        expect(result.current.screen).toBe("bills");
    });

    it("provides save error state", () => {
        const { result } = renderHook(() => useApp(), { wrapper });
        expect(result.current.saveError).toBeNull();
    });

    it("dismissSaveError clears saveError", () => {
        const { result } = renderHook(() => useApp(), { wrapper });
        act(() => result.current.dismissSaveError());
        expect(result.current.saveError).toBeNull();
    });

    it("throws when used outside provider", () => {
        expect(() => {
            renderHook(() => useApp());
        }).toThrow("useApp must be used within AppProvider");
    });

    it("handleReset resets data to defaults", () => {
        window.confirm = vi.fn(() => true);
        const { result } = renderHook(() => useApp(), { wrapper });

        // Modify settings first
        act(() => result.current.setSettings({ ...DEFAULT_SETTINGS, default_net_pay: 9999 }));
        expect(result.current.settings.default_net_pay).toBe(9999);

        // Reset
        act(() => result.current.handleReset());
        expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
        expect(result.current.bills).toEqual(DEFAULT_BILLS);
    });

    it("handleReset does nothing when cancelled", () => {
        window.confirm = vi.fn(() => false);
        const { result } = renderHook(() => useApp(), { wrapper });
        act(() => result.current.setSettings({ ...DEFAULT_SETTINGS, default_net_pay: 5000 }));
        act(() => result.current.handleReset());
        expect(result.current.settings.default_net_pay).toBe(5000);
    });
});
