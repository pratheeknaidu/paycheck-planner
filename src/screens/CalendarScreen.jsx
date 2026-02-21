import { useMemo } from "react";
import { useApp } from "../context/AppContext";
import T from "../constants/theme";
import { fmt, getPayPeriods, billFallsInPeriod } from "../utils/helpers";
import Card from "../components/Card";
import Badge from "../components/Badge";

export default function CalendarScreen() {
    const { settings, bills } = useApp();
    const periods = useMemo(() => getPayPeriods(settings.first_pay_date, 6), [settings.first_pay_date]);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <h2 style={{ color: T.text, fontSize: 18, fontWeight: 600, margin: 0 }}>Pay Period Calendar</h2>
            <div style={{ color: T.textMuted, fontSize: 12 }}>Bills mapped to upcoming pay periods.</div>

            {periods.map((period, pi) => {
                const pBills = bills.filter((b) => b.is_active && billFallsInPeriod(b, period.start, period.end));
                const total = pBills.reduce((s, b) => s + b.amount, 0);
                return (
                    <Card key={pi} style={period.isCurrent ? { border: `1px solid ${T.accent}` } : {}}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: pBills.length > 0 ? 10 : 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ color: period.isCurrent ? T.accent : T.text, fontSize: 14, fontWeight: 600 }}>{period.label}</span>
                                {period.isCurrent && <Badge text="Current" color={T.accent} bg={T.accentDim} />}
                            </div>
                            <span style={{ color: T.text, fontFamily: T.mono, fontWeight: 600, fontSize: 14 }}>{fmt(total)}</span>
                        </div>
                        {pBills.map((bill, bi) => (
                            <div key={bi} style={{
                                display: "flex", justifyContent: "space-between", padding: "5px 0",
                                borderTop: bi > 0 ? `1px solid ${T.border}` : "none",
                            }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <span style={{ color: T.text, fontSize: 12 }}>{bill.name}</span>
                                    {bill.bill_type === "variable" && <span style={{ color: T.amber, fontSize: 9 }}>~</span>}
                                </div>
                                <span style={{ color: T.textMuted, fontSize: 12, fontFamily: T.mono }}>{fmt(bill.amount)}</span>
                            </div>
                        ))}
                        {pBills.length === 0 && <div style={{ color: T.textDim, fontSize: 12, marginTop: 4 }}>No bills due</div>}
                    </Card>
                );
            })}
        </div>
    );
}
