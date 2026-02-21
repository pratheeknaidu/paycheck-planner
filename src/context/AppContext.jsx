import { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from "react";
import { initAuth, signIn, signOut, loadUserData, saveUserData, subscribeToData } from "../dataService";
import { DEFAULT_SETTINGS, DEFAULT_BILLS, DEFAULT_GOALS, STORAGE_KEY } from "../constants/defaults";

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
    const skipNextSave = useRef(false);
    const isInitialLoad = useRef(true);

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
            const remote = await loadUserData(user.uid);
            if (remote) {
                skipNextSave.current = true;
                setSettings(remote.settings || DEFAULT_SETTINGS);
                setBills(remote.bills || DEFAULT_BILLS);
                setGoals(remote.goals || DEFAULT_GOALS);
                setAllocations(remote.allocations || {});
                setPeriodHistory(remote.periodHistory || []);
            } else {
                // First sign-in: push local data to Firestore
                await saveUserData(user.uid, { settings, bills, goals, allocations, periodHistory });
            }
            setDataLoaded(true);
            isInitialLoad.current = false;

            // Subscribe to real-time changes (cross-device sync)
            unsubscribe = subscribeToData(user.uid, (data) => {
                if (data) {
                    skipNextSave.current = true;
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

    // Persist on every change — to both Firestore and localStorage
    useEffect(() => {
        if (isInitialLoad.current) return;
        const data = { settings, bills, goals, allocations, periodHistory };
        saveLocalData(data);
        if (skipNextSave.current) {
            skipNextSave.current = false;
            return;
        }
        if (user) {
            saveUserData(user.uid, data);
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
        await signOut();
        setUser(null);
        setScreen("dashboard");
    }, []);

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
            // Actions
            handleReset,
        }),
        [
            user, authLoading, authError, handleSignIn, handleSignOut,
            settings, bills, goals, allocations, periodHistory,
            screen, dataLoaded, handleReset,
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
