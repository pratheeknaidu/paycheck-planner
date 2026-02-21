import { useApp } from "../context/AppContext";
import T from "../constants/theme";
import Card from "../components/Card";
import Btn from "../components/Btn";
import Input from "../components/Input";

export default function SettingsScreen() {
    const { settings, setSettings, handleReset, user, handleSignOut } = useApp();

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <h2 style={{ color: T.text, fontSize: 18, fontWeight: 600, margin: 0 }}>Settings</h2>
            {user && (
                <Card>
                    <div style={{ color: T.textMuted, fontSize: 11, fontWeight: 600, letterSpacing: 0.5, marginBottom: 10 }}>ACCOUNT</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                        {user.photoURL && (
                            <img src={user.photoURL} alt={`${user.displayName}'s profile`}
                                style={{ width: 36, height: 36, borderRadius: "50%", border: `2px solid ${T.border}` }} />
                        )}
                        <div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{user.displayName}</div>
                            <div style={{ fontSize: 11, color: T.textMuted }}>{user.email}</div>
                        </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.green }} />
                        <span style={{ fontSize: 11, color: T.green, fontWeight: 600 }}>Synced across devices</span>
                    </div>
                    <Btn color={T.textMuted} onClick={handleSignOut}>Sign Out</Btn>
                </Card>
            )}
            <Card>
                <Input label="NET PAY (per paycheck)" type="number" value={String(settings.default_net_pay)}
                    onChange={(v) => setSettings((s) => ({ ...s, default_net_pay: Number(v) || 0 }))} />
                <Input label="FIRST PAY DATE (anchor)" type="date" value={settings.first_pay_date}
                    onChange={(v) => setSettings((s) => ({ ...s, first_pay_date: v }))} />
                <div style={{ color: T.textDim, fontSize: 11, marginTop: 4, lineHeight: 1.5 }}>
                    The anchor date is used to calculate all pay periods. Set it to any past or future payday — the system computes every 14-day cycle from this date.
                </div>
            </Card>
            <Card>
                <div style={{ color: T.textMuted, fontSize: 11, fontWeight: 600, letterSpacing: 0.5, marginBottom: 8 }}>DATA</div>
                <div style={{ color: T.textDim, fontSize: 12, lineHeight: 1.6, marginBottom: 12 }}>
                    Data syncs to the cloud via your Google account. A local copy is also kept in your browser.
                </div>
                <Btn color={T.red} onClick={handleReset}>Reset All Data</Btn>
            </Card>
            <Card>
                <div style={{ color: T.textMuted, fontSize: 11, fontWeight: 600, letterSpacing: 0.5, marginBottom: 8 }}>ABOUT</div>
                <div style={{ color: T.textDim, fontSize: 12, lineHeight: 1.6 }}>
                    Paycheck Planner v2.0. Built with React + Vite + Firebase.
                </div>
            </Card>
        </div>
    );
}
