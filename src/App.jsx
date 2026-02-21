import { useApp } from "./context/AppContext";
import T, { FONT_LINK } from "./constants/theme";
import Badge from "./components/Badge";
import DashboardScreen from "./screens/DashboardScreen";
import BillsScreen from "./screens/BillsScreen";
import SavingsScreen from "./screens/SavingsScreen";
import CalendarScreen from "./screens/CalendarScreen";
import SettingsScreen from "./screens/SettingsScreen";
import LoginScreen from "./screens/LoginScreen";

const SCREENS = {
  dashboard: { icon: "📊", label: "Payday", Component: DashboardScreen },
  bills: { icon: "📋", label: "Bills", Component: BillsScreen },
  savings: { icon: "🎯", label: "Savings", Component: SavingsScreen },
  calendar: { icon: "📅", label: "Calendar", Component: CalendarScreen },
  settings: { icon: "⚙️", label: "Settings", Component: SettingsScreen },
};

function LoadingView({ message = "Loading..." }) {
  return (
    <div
      style={{
        fontFamily: T.font,
        background: T.bg,
        color: T.text,
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 36, marginBottom: 12 }} aria-hidden="true">💰</div>
        <div style={{ color: T.textMuted, fontSize: 13 }}>{message}</div>
      </div>
    </div>
  );
}

export default function App() {
  const { user, authLoading, authError, handleSignIn, screen, setScreen, dataLoaded } = useApp();

  // Auth loading spinner
  if (authLoading) {
    return (
      <>
        <link href={FONT_LINK} rel="stylesheet" />
        <LoadingView />
      </>
    );
  }

  // Login screen
  if (!user) {
    return <LoginScreen onSignIn={handleSignIn} loading={authLoading} error={authError} />;
  }

  // Data loading spinner
  if (!dataLoaded) {
    return (
      <>
        <link href={FONT_LINK} rel="stylesheet" />
        <LoadingView message="Syncing your data..." />
      </>
    );
  }

  const ActiveScreen = SCREENS[screen]?.Component || DashboardScreen;

  return (
    <>
      <link href={FONT_LINK} rel="stylesheet" />
      <div
        style={{
          fontFamily: T.font,
          background: T.bg,
          color: T.text,
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div style={{ width: "100%", maxWidth: 440, position: "relative", paddingBottom: 72 }}>
          {/* Header */}
          <header
            style={{
              padding: "16px 20px 12px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              position: "sticky",
              top: 0,
              background: T.bg,
              zIndex: 20,
              borderBottom: `1px solid ${T.border}`,
            }}
          >
            <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.3, margin: 0 }}>Paycheck Planner</h1>
            <Badge text="v2.0" color={T.accent} bg={T.accentDim} />
          </header>

          {/* Content */}
          <main style={{ padding: "16px 18px 20px" }}>
            <ActiveScreen />
          </main>

          {/* Bottom Navigation */}
          <nav
            aria-label="Main navigation"
            style={{
              position: "fixed",
              bottom: 0,
              left: "50%",
              transform: "translateX(-50%)",
              width: "100%",
              maxWidth: 440,
              background: T.card,
              borderTop: `1px solid ${T.border}`,
              display: "flex",
              justifyContent: "space-around",
              padding: "6px 0 10px",
              zIndex: 20,
            }}
          >
            {Object.entries(SCREENS).map(([key, { icon, label }]) => (
              <button
                key={key}
                onClick={() => setScreen(key)}
                aria-label={label}
                aria-current={screen === key ? "page" : undefined}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 2,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "6px 12px",
                  color: screen === key ? T.accent : T.textDim,
                  fontFamily: T.font,
                  fontSize: 10,
                  fontWeight: screen === key ? 600 : 400,
                  transition: "color 0.15s",
                }}
              >
                <span style={{ fontSize: 18 }} aria-hidden="true">{icon}</span>
                {label}
              </button>
            ))}
          </nav>
        </div>
      </div>
    </>
  );
}
