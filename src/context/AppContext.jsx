import { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from "react";
import { initAuth, signIn, signOut, loadUserData, saveUserData, subscribeToData } from "../dataService";
import { DEFAULT_SETTINGS, DEFAULT_BILLS, DEFAULT_GOALS, STORAGE_KEY } from "../constants/defaults";
import { debounce } from "../utils/helpers";

const AppContext = createContext(null);

// ─── LOCAL PERSISTENCE (offline fallback) ───
function loadLocalData() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw);
    } catch (_e) {
        /* ignore corrupted data */
    }
    return null;
}

function saveLocalData(data) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (_e) {
        /* ignore quota errors */
    }
}

export function AppProvider({ children }) {
    // Auth state
    const [user, setUser] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [authError, setAuthError] = useState(null);

    // Save status for user feedback
    const [saveError, setSaveError] = useState(null);

    // App data — initialize from local storage as fallback
    const saved = useMemo(() => loadLocalData(), []);
    const [settings, setSettings] = useState(saved?.settings || DEFAULT_SETTINGS);
    const [bills, setBills] = useState(saved?.bills || DEFAULT_BILLS);
    const [goals, setGoals] = useState(saved?.goals || DEFAULT_GOALS);
    const [allocations, setAllocations] = useState(saved?.allocations || {});
    const [periodHistory, setPeriodHistory] = useState(saved?.periodHistory || []);
    const [screen, setScreen] = useState("dashboard");
    const [dataLoaded, setDataLoaded] = useState(false);

    // Guard to prevent save loops from remote sync updates
    const dataSource = useRef("local"); // 'local' | 'remote'
    const isInitialLoad = useRef(true);

    // Debounced save to Firestore (500ms) — prevents save-on-every-keystroke
    const debouncedSaveRef = useRef(null);
    useEffect(() => {
        debouncedSaveRef.current = debounce(async (uid, data) => {
            try {
                setSaveError(null);
                await saveUserData(uid, data);
            } catch (e) {
                console.error("Save failed:", e);
                setSaveError("Failed to save — your changes are saved locally and will sync when connection is restored.");
            }
        }, 500);
        return () => debouncedSaveRef.current?.cancel();
    }, []);

    // Listen for auth state changes
    useEffect(() => {
        const unsub = initAuth((u) => {
            setUser(u);
            setAuthLoading(false);
        });
        return unsub;
    }, []);

    // Load data from Firestore when user signs in, then subscribe to real-time updates
    useEffect(() => {
        if (!user) {
            setDataLoaded(false);
            isInitialLoad.current = true;
            return;
        }

        let unsubscribe = null;

        (async () => {
            try {
                const remote = await loadUserData(user.uid);
                if (remote) {
                    dataSource.current = "remote";
                    setSettings(remote.settings || DEFAULT_SETTINGS);
                    setBills(remote.bills || DEFAULT_BILLS);
                    setGoals(remote.goals || DEFAULT_GOALS);
                    setAllocations(remote.allocations || {});
                    setPeriodHistory(remote.periodHistory || []);
                } else {
                    // First sign-in: push local data to Firestore
                    await saveUserData(user.uid, { settings, bills, goals, allocations, periodHistory });
                }
            } catch (e) {
                console.error("Initial data load failed:", e);
                setSaveError("Could not load cloud data — using local data.");
            }
            setDataLoaded(true);
            isInitialLoad.current = false;

            // Subscribe to real-time changes (cross-device sync)
            unsubscribe = subscribeToData(user.uid, (data) => {
                if (data) {
                    dataSource.current = "remote";
                    setSettings(data.settings || DEFAULT_SETTINGS);
                    setBills(data.bills || DEFAULT_BILLS);
                    setGoals(data.goals || DEFAULT_GOALS);
                    setAllocations(data.allocations || {});
                    setPeriodHistory(data.periodHistory || []);
                }
            });
        })();

        return () => {
            if (unsubscribe) unsubscribe();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    // Persist on every change — localStorage immediately, Firestore debounced
    useEffect(() => {
        if (isInitialLoad.current) return;
        const data = { settings, bills, goals, allocations, periodHistory };

        // Always save locally immediately
        saveLocalData(data);

        // Skip Firestore save if data came from remote subscription
        if (dataSource.current === "remote") {
            dataSource.current = "local";
            return;
        }

        // Debounced save to Firestore
        if (user && debouncedSaveRef.current) {
            debouncedSaveRef.current(user.uid, data);
        }
    }, [settings, bills, goals, allocations, periodHistory, user]);

    const handleSignIn = useCallback(async () => {
        setAuthError(null);
        setAuthLoading(true);
        try {
            await signIn();
        } catch (e) {
            setAuthError(e.message || "Sign-in failed. Please try again.");
            setAuthLoading(false);
        }
    }, []);

    const handleSignOut = useCallback(async () => {
        // Flush any pending saves before signing out
        debouncedSaveRef.current?.flush(user?.uid, { settings, bills, goals, allocations, periodHistory });
        await signOut();
        setUser(null);
        setScreen("dashboard");
    }, [user, settings, bills, goals, allocations, periodHistory]);

    const handleReset = useCallback(() => {
        if (window.confirm("Reset all data to defaults? This cannot be undone.")) {
            setSettings(DEFAULT_SETTINGS);
            setBills(DEFAULT_BILLS);
            setGoals(DEFAULT_GOALS);
            setAllocations({});
            setPeriodHistory([]);
            localStorage.removeItem(STORAGE_KEY);
        }
    }, []);

    const dismissSaveError = useCallback(() => setSaveError(null), []);

    const value = useMemo(
        () => ({
            // Auth
            user,
            authLoading,
            authError,
            handleSignIn,
            handleSignOut,
            // Data
            settings,
            setSettings,
            bills,
            setBills,
            goals,
            setGoals,
            allocations,
            setAllocations,
            periodHistory,
            setPeriodHistory,
            // Navigation
            screen,
            setScreen,
            // Flags
            dataLoaded,
            // Save status
            saveError,
            dismissSaveError,
            // Actions
            handleReset,
        }),
        [
            user, authLoading, authError, handleSignIn, handleSignOut,
            settings, bills, goals, allocations, periodHistory,
            screen, dataLoaded, saveError, dismissSaveError, handleReset,
        ],
    );

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
    const ctx = useContext(AppContext);
    if (!ctx) throw new Error("useApp must be used within AppProvider");
    return ctx;
}

export default AppContext;
