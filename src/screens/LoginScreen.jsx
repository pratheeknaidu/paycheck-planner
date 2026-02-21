import T, { FONT_LINK } from "../constants/theme";

export default function LoginScreen({ onSignIn, loading, error }) {
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
                    alignItems: "center",
                }}
            >
                <main style={{ width: "100%", maxWidth: 360, padding: "0 24px", textAlign: "center" }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }} aria-hidden="true">💰</div>
                    <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>Paycheck Planner</h1>
                    <p style={{ color: T.textMuted, fontSize: 13, marginBottom: 32, lineHeight: 1.5 }}>
                        Budget paycheck-to-paycheck.<br />Sync across all your devices.
                    </p>
                    <button
                        onClick={onSignIn}
                        disabled={loading}
                        style={{
                            width: "100%",
                            padding: "14px 20px",
                            borderRadius: T.radius,
                            background: loading ? T.surface : "#fff",
                            color: loading ? T.textMuted : "#333",
                            border: `1px solid ${T.border}`,
                            cursor: loading ? "wait" : "pointer",
                            fontFamily: T.font,
                            fontSize: 14,
                            fontWeight: 600,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 10,
                            transition: "all 0.15s",
                        }}
                    >
                        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                        </svg>
                        {loading ? "Signing in..." : "Continue with Google"}
                    </button>
                    {error && <div role="alert" style={{ color: T.red, fontSize: 12, marginTop: 12 }}>{error}</div>}
                    <p style={{ color: T.textDim, fontSize: 11, marginTop: 24 }}>
                        Your data is stored securely in Firebase and syncs across devices.
                    </p>
                </main>
            </div>
        </>
    );
}
