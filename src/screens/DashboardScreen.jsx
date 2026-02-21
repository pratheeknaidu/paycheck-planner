import { useState, useEffect, useMemo } from "react";
import { useApp } from "../context/AppContext";
import T from "../constants/theme";
import { fmt, pct, getPayPeriods, billFallsInPeriod } from "../utils/helpers";
import Card from "../components/Card";
import Badge from "../components/Badge";
import ProgressBar from "../components/ProgressBar";
import Btn from "../components/Btn";
import Input from "../components/Input";
import Modal from "../components/Modal";

export default function DashboardScreen() {
    const { settings, bills, goals, allocations, setAllocations, periodHistory, setPeriodHistory } = useApp();

    const periods = useMemo(() => getPayPeriods(settings.first_pay_date, 6), [settings.first_pay_date]);
    const currentPeriod = periods.find((p) => p.isCurrent) || periods[2];
    const currentIdx = periods.indexOf(currentPeriod);
    const nextPeriod = currentIdx < periods.length - 1 ? periods[currentIdx + 1] : null;

    const periodKey = currentPeriod.start.toISOString().slice(0, 10);
    const nextPeriodKey = nextPeriod ? nextPeriod.start.toISOString().slice(0, 10) : null;
    const periodAlloc = allocations[periodKey] || {};
    const nextPeriodAlloc = nextPeriodKey ? allocations[nextPeriodKey] || {} : {};

    // Base bills for each period (before split/defer/payEarly adjustments)
    const basePeriodBills = useMemo(
        () => bills.filter((b) => b.is_active && billFallsInPeriod(b, currentPeriod.start, currentPeriod.end)),
        [bills, currentPeriod],
    );

    const baseNextPeriodBills = useMemo(
        () => (nextPeriod ? bills.filter((b) => b.is_active && billFallsInPeriod(b, nextPeriod.start, nextPeriod.end)) : []),
        [bills, nextPeriod],
    );

    // Effective current period bills: exclude deferred, include paidEarly from next period
    const paidEarlyBills = baseNextPeriodBills.filter((b) => periodAlloc[b.id]?.paidEarly);
    const periodBills = useMemo(() => {
        const nonDeferred = basePeriodBills.filter((b) => !periodAlloc[b.id]?.deferred);
        const extras = paidEarlyBills.filter((b) => !nonDeferred.some((nb) => nb.id === b.id));
        return [...nonDeferred, ...extras];
    }, [basePeriodBills, periodAlloc, paidEarlyBills]);

    // Effective next period bills: exclude paidEarly, include deferred + split remainders
    const deferredBills = basePeriodBills.filter((b) => periodAlloc[b.id]?.deferred);
    const splitBills = basePeriodBills.filter((b) => periodAlloc[b.id]?.splitAmount != null);
    const displayNextPeriodBills = useMemo(() => {
        const nonPaidEarly = baseNextPeriodBills.filter(
            (b) => !(periodAlloc[b.id]?.paidEarly && periodAlloc[b.id]?.prepayAmount == null),
        );
        const deferredExtras = deferredBills.filter((b) => !nonPaidEarly.some((nb) => nb.id === b.id));
        const splitExtras = splitBills.filter(
            (b) => !nonPaidEarly.some((nb) => nb.id === b.id) && !deferredBills.some((db) => db.id === b.id),
        );
        return [...nonPaidEarly, ...deferredExtras, ...splitExtras];
    }, [baseNextPeriodBills, periodAlloc, deferredBills, splitBills]);

    // Init allocations for base period bills
    useEffect(() => {
        const existing = allocations[periodKey] || {};
        const updated = { ...existing };
        let changed = false;
        basePeriodBills.forEach((bill) => {
            if (!updated[bill.id]) {
                updated[bill.id] = { planned: bill.amount, actual: bill.bill_type === "fixed" ? bill.amount : null, paid: false };
                changed = true;
            }
        });
        if (changed) setAllocations((prev) => ({ ...prev, [periodKey]: updated }));
    }, [basePeriodBills, periodKey]); // eslint-disable-line react-hooks/exhaustive-deps

    // Init allocations for next period bills
    useEffect(() => {
        if (!nextPeriodKey) return;
        const existing = allocations[nextPeriodKey] || {};
        const updated = { ...existing };
        let changed = false;
        baseNextPeriodBills.forEach((bill) => {
            if (!updated[bill.id]) {
                updated[bill.id] = { planned: bill.amount, actual: bill.bill_type === "fixed" ? bill.amount : null, paid: false };
                changed = true;
            }
        });
        if (changed) setAllocations((prev) => ({ ...prev, [nextPeriodKey]: updated }));
    }, [baseNextPeriodBills, nextPeriodKey]); // eslint-disable-line react-hooks/exhaustive-deps

    // ─── TOTALS ───
    const getBillAmount = (bill) => {
        const a = periodAlloc[bill.id];
        if (!a) return bill.amount;
        if (a.deferred) return 0;
        if (a.splitAmount != null) return a.splitAmount;
        if (a.paidEarly && a.prepayAmount != null) return a.prepayAmount;
        return a.actual ?? a.planned ?? bill.amount;
    };

    const billsTotal = periodBills.reduce((s, b) => s + getBillAmount(b), 0);
    const savingsTotal = goals.filter((g) => g.is_active).reduce((s, g) => s + g.per_check_amount, 0);
    const adjustments = periodAlloc._adjustments || [];
    const adjustmentsTotal = adjustments.reduce((s, a) => s + a.amount, 0);
    const netPay = periodAlloc._netPayOverride ?? settings.default_net_pay;
    const hasPayOverride = periodAlloc._netPayOverride != null;
    const remaining = netPay - billsTotal - savingsTotal + adjustmentsTotal;
    const isOver = remaining < 0;
    const paidCount = periodBills.filter((b) => periodAlloc[b.id]?.paid).length;
    const isClosed = !!periodAlloc._closed;

    // Next period totals
    const getNextBillAmount = (bill) => {
        const a = periodAlloc[bill.id];
        if (a?.paidEarly && a?.prepayAmount == null) return 0;
        if (a?.paidEarly && a?.prepayAmount != null) {
            const na = nextPeriodAlloc[bill.id];
            const base = na?.actual != null ? Number(na.actual) : bill.amount;
            return base - a.prepayAmount;
        }
        if (a?.deferred) return bill.amount;
        if (a?.splitAmount != null) return bill.amount - a.splitAmount;
        const na = nextPeriodAlloc[bill.id];
        if (na?.actual != null) return na.actual;
        return bill.amount;
    };
    const nextBillsTotal = displayNextPeriodBills.reduce((s, b) => s + getNextBillAmount(b), 0);

    // ─── ACTIONS ───
    const togglePaid = (billId, targetPK = periodKey) => {
        setAllocations((prev) => {
            const pk = { ...prev };
            const pa = { ...(pk[targetPK] || {}) };
            pa[billId] = { ...pa[billId], paid: !pa[billId]?.paid };
            pk[targetPK] = pa;
            return pk;
        });
    };

    const updateActual = (billId, val, targetPK = periodKey) => {
        setAllocations((prev) => {
            const pk = { ...prev };
            const pa = { ...(pk[targetPK] || {}) };
            pa[billId] = { ...pa[billId], actual: val === "" ? null : Number(val) };
            pk[targetPK] = pa;
            return pk;
        });
    };

    const deferBill = (billId, targetPK = periodKey) => {
        setAllocations((prev) => {
            const pk = { ...prev };
            const pa = { ...(pk[targetPK] || {}) };
            pa[billId] = { ...pa[billId], deferred: true, paid: false, splitAmount: undefined };
            pk[targetPK] = pa;
            return pk;
        });
    };

    const undoDefer = (billId, targetPK = periodKey) => {
        setAllocations((prev) => {
            const pk = { ...prev };
            const pa = { ...(pk[targetPK] || {}) };
            pa[billId] = { ...pa[billId], deferred: false };
            pk[targetPK] = pa;
            return pk;
        });
    };

    const splitBill = (billId, splitAmount, targetPK = periodKey) => {
        setAllocations((prev) => {
            const pk = { ...prev };
            const pa = { ...(pk[targetPK] || {}) };
            pa[billId] = { ...pa[billId], splitAmount: Number(splitAmount), deferred: false };
            pk[targetPK] = pa;
            return pk;
        });
    };

    const undoSplit = (billId, targetPK = periodKey) => {
        setAllocations((prev) => {
            const pk = { ...prev };
            const pa = { ...(pk[targetPK] || {}) };
            const updated = { ...pa[billId] };
            delete updated.splitAmount;
            pa[billId] = updated;
            pk[targetPK] = pa;
            return pk;
        });
    };

    const payEarly = (billId, bill, prepayAmount = null) => {
        setAllocations((prev) => {
            const pk = { ...prev };
            const pa = { ...(pk[periodKey] || {}) };
            const entry = { planned: bill.amount, actual: bill.bill_type === "fixed" ? bill.amount : null, paid: false, paidEarly: true };
            if (prepayAmount != null && prepayAmount < bill.amount) {
                entry.prepayAmount = Number(prepayAmount);
                entry.actual = Number(prepayAmount);
            }
            pa[billId] = entry;
            pk[periodKey] = pa;
            return pk;
        });
    };

    const undoPayEarly = (billId) => {
        setAllocations((prev) => {
            const pk = { ...prev };
            const pa = { ...(pk[periodKey] || {}) };
            const updated = { ...pa[billId] };
            delete updated.paidEarly;
            delete updated.prepayAmount;
            delete updated.actual;
            delete updated.planned;
            pa[billId] = updated;
            pk[periodKey] = pa;
            return pk;
        });
    };

    // ─── ADJUSTMENTS ───
    const addAdjustment = (label, amount) => {
        setAllocations((prev) => {
            const pk = { ...prev };
            const pa = { ...(pk[periodKey] || {}) };
            const adjs = [...(pa._adjustments || []), { id: Date.now().toString(), label, amount }];
            pa._adjustments = adjs;
            pk[periodKey] = pa;
            return pk;
        });
    };

    const removeAdjustment = (adjId) => {
        setAllocations((prev) => {
            const pk = { ...prev };
            const pa = { ...(pk[periodKey] || {}) };
            pa._adjustments = (pa._adjustments || []).filter((a) => a.id !== adjId);
            pk[periodKey] = pa;
            return pk;
        });
    };

    // ─── NET PAY OVERRIDE ───
    const setNetPayOverride = (val) => {
        setAllocations((prev) => {
            const pk = { ...prev };
            const pa = { ...(pk[periodKey] || {}) };
            if (val === "" || val == null) {
                delete pa._netPayOverride;
            } else {
                pa._netPayOverride = Number(val);
            }
            pk[periodKey] = pa;
            return pk;
        });
    };

    // ─── CLOSE / REOPEN PERIOD ───
    const closePeriod = () => {
        const entry = {
            periodKey,
            label: currentPeriod.label,
            closedAt: new Date().toISOString(),
            netPay,
            billsTotal,
            savingsGoalsTotal: savingsTotal,
            adjustmentsTotal,
            adjustments: [...adjustments],
            saved: remaining,
        };
        setPeriodHistory((prev) => {
            const filtered = prev.filter((h) => h.periodKey !== periodKey);
            return [...filtered, entry].sort((a, b) => a.periodKey.localeCompare(b.periodKey));
        });
        setAllocations((prev) => {
            const pk = { ...prev };
            const pa = { ...(pk[periodKey] || {}) };
            pa._closed = true;
            pk[periodKey] = pa;
            return pk;
        });
    };

    const reopenPeriod = () => {
        setPeriodHistory((prev) => prev.filter((h) => h.periodKey !== periodKey));
        setAllocations((prev) => {
            const pk = { ...prev };
            const pa = { ...(pk[periodKey] || {}) };
            delete pa._closed;
            pk[periodKey] = pa;
            return pk;
        });
    };

    // ─── LOCAL UI STATE ───
    const [editingNetPay, setEditingNetPay] = useState(false);
    const [netPayInput, setNetPayInput] = useState("");
    const [editingBill, setEditingBill] = useState(null);
    const [editingBillPK, setEditingBillPK] = useState(periodKey);
    const [splittingBill, setSplittingBill] = useState(null);
    const [splittingBillPK, setSplittingBillPK] = useState(periodKey);
    const [splitValue, setSplitValue] = useState("");
    const [actionMenu, setActionMenu] = useState(null);
    const [showAdjForm, setShowAdjForm] = useState(false);
    const [adjLabel, setAdjLabel] = useState("");
    const [adjAmount, setAdjAmount] = useState("");
    const [adjType, setAdjType] = useState("expense");
    const [prepayBill, setPrepayBill] = useState(null);
    const [prepayValue, setPrepayValue] = useState("");

    const openSplit = (bill, targetPK = periodKey, targetAlloc = periodAlloc) => {
        setSplittingBill(bill);
        setSplittingBillPK(targetPK);
        const existing = targetAlloc[bill.id]?.splitAmount;
        setSplitValue(existing != null ? String(existing) : String(Math.round(bill.amount / 2)));
        setActionMenu(null);
    };

    const confirmSplit = () => {
        if (splittingBill && splitValue) {
            splitBill(splittingBill.id, splitValue, splittingBillPK);
            setSplittingBill(null);
        }
    };

    // ─── ACTION BUTTON COMPONENT ───
    const ActionDot = ({ billId, bill, isDeferrable = true, targetPK = periodKey, targetAlloc = periodAlloc }) => {
        const alloc = targetAlloc[billId] || {};
        const isMenuOpen = actionMenu === billId;
        const hasSplit = alloc.splitAmount != null;
        const isDeferred = alloc.deferred;

        if (isDeferred) {
            return (
                <button
                    onClick={() => undoDefer(billId, targetPK)}
                    aria-label={`Undo defer for ${bill.name}`}
                    style={{
                        color: T.amber, fontSize: 10, cursor: "pointer", padding: "2px 8px",
                        background: T.amberDim, borderRadius: 12, fontWeight: 600, fontFamily: T.font,
                        border: "none",
                    }}
                >
                    DEFERRED ↩
                </button>
            );
        }
        if (hasSplit) {
            return (
                <button
                    onClick={() => undoSplit(billId, targetPK)}
                    aria-label={`Undo split for ${bill.name}`}
                    style={{
                        color: T.purple, fontSize: 10, cursor: "pointer", padding: "2px 8px",
                        background: T.purpleDim, borderRadius: 12, fontWeight: 600, fontFamily: T.font,
                        border: "none",
                    }}
                >
                    SPLIT ↩
                </button>
            );
        }

        return (
            <div style={{ position: "relative" }}>
                <button
                    onClick={(e) => { e.stopPropagation(); setActionMenu(isMenuOpen ? null : billId); }}
                    aria-label={`Actions for ${bill.name}`}
                    aria-expanded={isMenuOpen}
                    style={{
                        color: T.textDim, fontSize: 18, cursor: "pointer", padding: "0 4px",
                        lineHeight: 1, userSelect: "none", background: "none", border: "none",
                    }}
                >
                    ⋯
                </button>
                {isMenuOpen && (
                    <div
                        onClick={(e) => e.stopPropagation()}
                        role="menu"
                        style={{
                            position: "absolute", right: 0, top: 24, zIndex: 10,
                            background: T.card, border: `1px solid ${T.border}`, borderRadius: T.radiusSm,
                            padding: 4, minWidth: 110, boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                        }}
                    >
                        <button
                            role="menuitem"
                            onClick={() => openSplit(bill, targetPK, targetAlloc)}
                            style={{
                                display: "block", width: "100%", textAlign: "left",
                                padding: "8px 12px", fontSize: 12, color: T.purple, cursor: "pointer",
                                borderRadius: 6, fontWeight: 500, background: "transparent", border: "none",
                                fontFamily: T.font,
                            }}
                            onMouseEnter={(e) => (e.target.style.background = T.purpleDim)}
                            onMouseLeave={(e) => (e.target.style.background = "transparent")}
                        >
                            ✂️ Split
                        </button>
                        {isDeferrable && (
                            <button
                                role="menuitem"
                                onClick={() => { deferBill(billId, targetPK); setActionMenu(null); }}
                                style={{
                                    display: "block", width: "100%", textAlign: "left",
                                    padding: "8px 12px", fontSize: 12, color: T.amber, cursor: "pointer",
                                    borderRadius: 6, fontWeight: 500, background: "transparent", border: "none",
                                    fontFamily: T.font,
                                }}
                                onMouseEnter={(e) => (e.target.style.background = T.amberDim)}
                                onMouseLeave={(e) => (e.target.style.background = "transparent")}
                            >
                                ⏩ Defer
                            </button>
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }} onClick={() => setActionMenu(null)}>
            <div style={{ textAlign: "center", padding: "4px 0" }}>
                <div style={{ color: T.textMuted, fontSize: 12 }}>{currentPeriod.label}</div>
                {editingNetPay ? (
                    <div style={{ margin: "8px auto", maxWidth: 200 }}>
                        <input
                            autoFocus
                            type="number"
                            value={netPayInput}
                            onChange={(e) => setNetPayInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && Number(netPayInput) > 0) {
                                    setNetPayOverride(netPayInput);
                                    setEditingNetPay(false);
                                } else if (e.key === "Escape") {
                                    setEditingNetPay(false);
                                }
                            }}
                            placeholder={String(settings.default_net_pay)}
                            aria-label="Override net pay amount"
                            style={{
                                width: "100%", padding: "8px 12px", border: `1px solid ${T.accent}`,
                                borderRadius: T.radiusSm, background: T.surface, color: T.text,
                                fontSize: 24, fontWeight: 700, fontFamily: T.mono, textAlign: "center",
                                outline: "none",
                            }}
                        />
                        <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "center" }}>
                            <button
                                onClick={() => {
                                    if (Number(netPayInput) > 0) { setNetPayOverride(netPayInput); setEditingNetPay(false); }
                                }}
                                style={{
                                    color: "#fff", fontSize: 11, cursor: "pointer", padding: "4px 14px",
                                    background: T.accent, borderRadius: 10, fontWeight: 600, fontFamily: T.font,
                                    border: "none",
                                }}
                            >
                                Save
                            </button>
                            {hasPayOverride && (
                                <button
                                    onClick={() => { setNetPayOverride(""); setEditingNetPay(false); }}
                                    style={{
                                        color: T.textDim, fontSize: 11, cursor: "pointer", padding: "4px 14px",
                                        background: T.border, borderRadius: 10, fontWeight: 600, fontFamily: T.font,
                                        border: "none",
                                    }}
                                >
                                    Reset
                                </button>
                            )}
                            <button
                                onClick={() => setEditingNetPay(false)}
                                style={{
                                    color: T.textDim, fontSize: 11, cursor: "pointer", padding: "4px 14px",
                                    background: T.border, borderRadius: 10, fontWeight: 600, fontFamily: T.font,
                                    border: "none",
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <div
                        onClick={() => { setNetPayInput(String(netPay)); setEditingNetPay(true); }}
                        style={{ cursor: "pointer", position: "relative", display: "inline-block" }}
                        role="button"
                        tabIndex={0}
                        aria-label="Edit net pay"
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { setNetPayInput(String(netPay)); setEditingNetPay(true); } }}
                    >
                        <div style={{ color: T.text, fontSize: 38, fontWeight: 700, fontFamily: T.mono, letterSpacing: -1, margin: "4px 0" }}>
                            {fmt(netPay)}
                        </div>
                        <span style={{ position: "absolute", top: 4, right: -20, fontSize: 14, opacity: 0.5 }}>✏️</span>
                    </div>
                )}
                <div style={{ color: T.textDim, fontSize: 11 }}>
                    {hasPayOverride ? "Adjusted Net Pay" : "Net Pay"}
                    {hasPayOverride && (
                        <span style={{ color: T.textDim, fontSize: 10, marginLeft: 4 }}>(default: {fmt(settings.default_net_pay)})</span>
                    )}
                </div>
            </div>

            <Card>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                    <span style={{ color: T.textMuted, fontSize: 11, fontWeight: 600, letterSpacing: 0.5 }}>ALLOCATION</span>
                    {isClosed && <Badge text="Closed ✓" color={T.green} bg={T.greenDim} />}
                    {!isClosed && isOver && <Badge text="Over Budget" color={T.red} bg={T.redDim} />}
                    {!isClosed && !isOver && remaining < 200 && <Badge text="Tight" color={T.amber} bg={T.amberDim} />}
                    {!isClosed && !isOver && remaining >= 200 && <Badge text="On Track" color={T.green} bg={T.greenDim} />}
                </div>
                <div style={{ display: "flex", height: 10, borderRadius: 20, overflow: "hidden", background: T.border }}>
                    <div style={{ width: `${(billsTotal / netPay) * 100}%`, background: T.accent, transition: "width 0.4s" }} />
                    <div style={{ width: `${(savingsTotal / netPay) * 100}%`, background: T.green, transition: "width 0.4s" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, gap: 6 }}>
                    {[
                        { label: "Bills", value: billsTotal, color: T.accent },
                        { label: "Savings", value: savingsTotal, color: T.green },
                        { label: isClosed ? "Saved" : "Remaining", value: remaining, color: isClosed ? T.green : isOver ? T.red : T.amber },
                    ].map(({ label, value, color }) => (
                        <div key={label} style={{ flex: 1, textAlign: "center" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, marginBottom: 2 }}>
                                <div style={{ width: 7, height: 7, borderRadius: 2, background: color }} />
                                <span style={{ color: T.textMuted, fontSize: 10 }}>{label}</span>
                            </div>
                            <div style={{ color, fontSize: 17, fontWeight: 700, fontFamily: T.mono }}>{fmt(value)}</div>
                        </div>
                    ))}
                </div>
            </Card>

            {!isClosed && isOver && (
                <Card style={{ border: "1px solid rgba(248,113,113,0.3)", background: T.redDim }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }} role="alert">
                        <span style={{ fontSize: 20 }}>⚠️</span>
                        <div>
                            <div style={{ color: T.red, fontSize: 13, fontWeight: 600 }}>Over budget by {fmt(Math.abs(remaining))}</div>
                            <div style={{ color: T.textMuted, fontSize: 12, marginTop: 2 }}>Split or defer a bill to the next period.</div>
                        </div>
                    </div>
                </Card>
            )}

            {isClosed ? (
                <Card style={{ border: `1px solid ${T.greenDim}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                        <span style={{ color: T.textMuted, fontSize: 11, fontWeight: 600, letterSpacing: 0.5 }}>PERIOD CLOSED</span>
                        <Badge text="✓ Complete" color={T.green} bg={T.greenDim} />
                    </div>
                    <div style={{ background: T.surface, borderRadius: T.radiusSm, padding: "16px", border: `1px solid ${T.border}`, marginBottom: 14 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                            <span style={{ color: T.textMuted, fontSize: 12 }}>Bills paid ({paidCount}/{periodBills.length})</span>
                            <span style={{ color: T.text, fontSize: 13, fontWeight: 600, fontFamily: T.mono }}>{fmt(billsTotal)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                            <span style={{ color: T.textMuted, fontSize: 12 }}>Savings goals</span>
                            <span style={{ color: T.text, fontSize: 13, fontWeight: 600, fontFamily: T.mono }}>{fmt(savingsTotal)}</span>
                        </div>
                        {adjustments.length > 0 && (
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                                <span style={{ color: T.textMuted, fontSize: 12 }}>Adjustments ({adjustments.length})</span>
                                <span style={{ color: adjustmentsTotal >= 0 ? T.green : T.red, fontSize: 13, fontWeight: 600, fontFamily: T.mono }}>
                                    {adjustmentsTotal >= 0 ? "+" : ""}{fmt(adjustmentsTotal)}
                                </span>
                            </div>
                        )}
                        <div style={{ height: 1, background: T.border, margin: "4px 0 8px" }} />
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ color: T.green, fontSize: 14, fontWeight: 600 }}>💰 Saved this check</span>
                            <span style={{ color: T.green, fontSize: 20, fontWeight: 700, fontFamily: T.mono }}>{fmt(remaining)}</span>
                        </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "center" }}>
                        <button
                            onClick={reopenPeriod}
                            style={{
                                color: T.amber, fontSize: 11, cursor: "pointer", padding: "6px 16px",
                                background: T.amberDim, borderRadius: 12, fontWeight: 600, fontFamily: T.font,
                                transition: "opacity 0.15s", border: "none",
                            }}
                            onMouseEnter={(e) => (e.target.style.opacity = "0.7")}
                            onMouseLeave={(e) => (e.target.style.opacity = "1")}
                        >
                            Reopen for Edits ↩
                        </button>
                    </div>
                </Card>
            ) : (
                <>
                    <Card>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                            <span style={{ color: T.textMuted, fontSize: 11, fontWeight: 600, letterSpacing: 0.5 }}>BILLS THIS PERIOD</span>
                            <span style={{ color: T.textDim, fontSize: 11 }}>{paidCount}/{periodBills.length} paid</span>
                        </div>
                        {periodBills.length === 0 && <div style={{ color: T.textDim, fontSize: 13, textAlign: "center", padding: 16 }}>No bills due this period</div>}
                        {periodBills.map((bill) => {
                            const alloc = periodAlloc[bill.id] || {};
                            const isDeferred = alloc.deferred;
                            const hasSplit = alloc.splitAmount != null;
                            const isPaidEarly = alloc.paidEarly;
                            const displayAmt = hasSplit ? alloc.splitAmount : (alloc.actual ?? alloc.planned ?? bill.amount);
                            const isVariable = bill.bill_type === "variable";
                            const needsConfirm = isVariable && alloc.actual == null && !hasSplit && !isDeferred;
                            return (
                                <div key={bill.id} style={{
                                    display: "flex", alignItems: "center", justifyContent: "space-between",
                                    padding: "10px 6px", borderRadius: T.radiusSm,
                                    background: alloc.paid ? "rgba(74,222,128,0.03)" : isDeferred ? "rgba(251,191,36,0.03)" : "transparent",
                                    opacity: isDeferred ? 0.5 : 1, transition: "opacity 0.2s",
                                }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                                        <button
                                            onClick={() => !isDeferred && togglePaid(bill.id)}
                                            aria-label={`Mark ${bill.name} as ${alloc.paid ? "unpaid" : "paid"}`}
                                            disabled={isDeferred}
                                            style={{
                                                width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                                                cursor: isDeferred ? "default" : "pointer",
                                                border: alloc.paid ? "none" : `2px solid ${T.textDim}`,
                                                background: alloc.paid ? T.green : "transparent",
                                                display: "flex", alignItems: "center", justifyContent: "center",
                                                padding: 0,
                                            }}
                                        >
                                            {alloc.paid && <span style={{ color: "#000", fontSize: 12, fontWeight: 700 }}>✓</span>}
                                        </button>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                                <span style={{
                                                    color: alloc.paid ? T.textMuted : T.text, fontSize: 13, fontWeight: 500,
                                                    textDecoration: alloc.paid ? "line-through" : "none",
                                                }}>{bill.name}</span>
                                                {isVariable && !hasSplit && !isDeferred && <Badge text="Variable" color={T.amber} bg={T.amberDim} />}
                                                {isPaidEarly && <Badge text="Early" color={T.green} bg={T.greenDim} />}
                                                {hasSplit && <Badge text={`Split · ${fmt(bill.amount - alloc.splitAmount)} next`} color={T.purple} bg={T.purpleDim} />}
                                            </div>
                                            <div style={{ color: T.textDim, fontSize: 11 }}>Due day {bill.due_day} · {bill.frequency}</div>
                                        </div>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        {needsConfirm && (
                                            <button onClick={() => setEditingBill(bill.id)} aria-label={`Edit amount for ${bill.name}`}
                                                style={{ color: T.amber, fontSize: 14, cursor: "pointer", padding: "2px 4px", background: "none", border: "none" }}>
                                                ✏️
                                            </button>
                                        )}
                                        {isPaidEarly && (
                                            <button onClick={() => undoPayEarly(bill.id)} aria-label={`Undo pay early for ${bill.name}`}
                                                style={{
                                                    color: T.textDim, fontSize: 10, cursor: "pointer", padding: "2px 6px",
                                                    background: T.border, borderRadius: 10, fontWeight: 500, fontFamily: T.font, border: "none",
                                                }}>↩</button>
                                        )}
                                        {!isPaidEarly && !isDeferred && <ActionDot billId={bill.id} bill={bill} />}
                                        {isDeferred && (
                                            <button onClick={() => undoDefer(bill.id)} aria-label={`Undo defer for ${bill.name}`}
                                                style={{
                                                    color: T.amber, fontSize: 10, cursor: "pointer", padding: "2px 8px",
                                                    background: T.amberDim, borderRadius: 12, fontWeight: 600, fontFamily: T.font, border: "none",
                                                }}>DEFERRED ↩</button>
                                        )}
                                        <div style={{ textAlign: "right", minWidth: 70 }}>
                                            <div style={{
                                                color: alloc.paid ? T.textMuted : isDeferred ? T.textDim : T.text,
                                                fontSize: 14, fontWeight: 600, fontFamily: T.mono,
                                                textDecoration: isDeferred ? "line-through" : "none",
                                            }}>
                                                {fmt(isDeferred ? bill.amount : displayAmt)}
                                            </div>
                                            {needsConfirm && <div style={{ color: T.amber, fontSize: 9, fontFamily: T.mono }}>EST</div>}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {periodBills.length > 0 && (
                            <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
                                <button
                                    onClick={closePeriod}
                                    style={{
                                        width: "100%", padding: "10px 0", border: "none", borderRadius: T.radiusSm,
                                        background: T.greenDim, color: T.green, fontSize: 13, fontWeight: 600,
                                        fontFamily: T.font, cursor: "pointer", transition: "opacity 0.15s",
                                    }}
                                    onMouseEnter={(e) => (e.target.style.opacity = "0.8")}
                                    onMouseLeave={(e) => (e.target.style.opacity = "1")}
                                >
                                    ✓ Close Period
                                </button>
                            </div>
                        )}
                    </Card>

                    <Card>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: adjustments.length > 0 || showAdjForm ? 10 : 0 }}>
                            <span style={{ color: T.textMuted, fontSize: 11, fontWeight: 600, letterSpacing: 0.5 }}>ADJUSTMENTS</span>
                            {!showAdjForm && (
                                <button onClick={() => setShowAdjForm(true)} style={{
                                    color: T.accent, fontSize: 11, cursor: "pointer", padding: "2px 10px",
                                    background: T.accentDim, borderRadius: 10, fontWeight: 600, fontFamily: T.font, border: "none",
                                }}>+ Add</button>
                            )}
                        </div>
                        {adjustments.map((adj) => (
                            <div key={adj.id} style={{
                                display: "flex", justifyContent: "space-between", alignItems: "center",
                                padding: "8px 4px", borderBottom: `1px solid ${T.border}`,
                            }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontSize: 14 }}>{adj.amount > 0 ? "💵" : "💸"}</span>
                                    <span style={{ color: T.text, fontSize: 13 }}>{adj.label}</span>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ color: adj.amount > 0 ? T.green : T.red, fontSize: 13, fontWeight: 600, fontFamily: T.mono }}>
                                        {adj.amount > 0 ? "+" : ""}{fmt(adj.amount)}
                                    </span>
                                    <button
                                        onClick={() => removeAdjustment(adj.id)}
                                        aria-label={`Remove adjustment ${adj.label}`}
                                        style={{
                                            color: T.textDim, fontSize: 12, cursor: "pointer", padding: "2px 6px",
                                            borderRadius: 6, transition: "color 0.15s", background: "none", border: "none",
                                        }}
                                        onMouseEnter={(e) => (e.target.style.color = T.red)}
                                        onMouseLeave={(e) => (e.target.style.color = T.textDim)}
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                        ))}
                        {adjustments.length === 0 && !showAdjForm && (
                            <div style={{ color: T.textDim, fontSize: 12, textAlign: "center", padding: "8px 0" }}>No adjustments — add unexpected income or expenses</div>
                        )}
                        {showAdjForm && (
                            <div style={{ background: T.surface, borderRadius: T.radiusSm, padding: 14, border: `1px solid ${T.border}`, marginTop: 8 }}>
                                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                                    {["expense", "income"].map((t) => (
                                        <button key={t} onClick={() => setAdjType(t)} style={{
                                            flex: 1, padding: "6px 0", border: "none", borderRadius: T.radiusSm, fontSize: 12,
                                            fontWeight: 600, fontFamily: T.font, cursor: "pointer",
                                            background: adjType === t ? (t === "income" ? T.greenDim : T.redDim) : T.border,
                                            color: adjType === t ? (t === "income" ? T.green : T.red) : T.textDim,
                                            transition: "all 0.15s",
                                        }}>{t === "income" ? "+ Income" : "− Expense"}</button>
                                    ))}
                                </div>
                                <Input label="DESCRIPTION" value={adjLabel} onChange={setAdjLabel} placeholder="e.g. Freelance payment" />
                                <Input label="AMOUNT" type="number" value={adjAmount} onChange={setAdjAmount} placeholder="0.00" />
                                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                                    <Btn full color="#fff" bg={adjType === "income" ? T.green : T.red}
                                        onClick={() => {
                                            const val = Number(adjAmount);
                                            if (adjLabel.trim() && val > 0) {
                                                addAdjustment(adjLabel.trim(), adjType === "income" ? val : -val);
                                                setAdjLabel(""); setAdjAmount(""); setShowAdjForm(false);
                                            }
                                        }}
                                        style={{ opacity: (adjLabel.trim() && Number(adjAmount) > 0) ? 1 : 0.4 }}
                                    >Add {adjType === "income" ? "Income" : "Expense"}</Btn>
                                    <Btn full color={T.textDim} onClick={() => { setShowAdjForm(false); setAdjLabel(""); setAdjAmount(""); }}>Cancel</Btn>
                                </div>
                            </div>
                        )}
                    </Card>

                    <Card>
                        <div style={{ color: T.textMuted, fontSize: 11, fontWeight: 600, letterSpacing: 0.5, marginBottom: 12 }}>SAVINGS THIS CHECK</div>
                        {goals.filter((g) => g.is_active).map((goal) => (
                            <div key={goal.id} style={{ marginBottom: 12 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                                    <span style={{ color: T.text, fontSize: 13 }}>{goal.icon} {goal.name}</span>
                                    <span style={{ color: T.green, fontSize: 13, fontWeight: 600, fontFamily: T.mono }}>+{fmt(goal.per_check_amount)}</span>
                                </div>
                                <ProgressBar value={pct(goal.current_balance, goal.target_amount)} color={T.green} />
                                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
                                    <span style={{ color: T.textDim, fontSize: 10 }}>{fmt(goal.current_balance)} / {fmt(goal.target_amount)}</span>
                                    <span style={{ color: T.textDim, fontSize: 10 }}>{pct(goal.current_balance, goal.target_amount)}%</span>
                                </div>
                            </div>
                        ))}
                    </Card>
                </>
            )}

            {nextPeriod && (
                <Card style={{ border: `1px solid ${T.purpleDim}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: displayNextPeriodBills.length > 0 ? 10 : 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ color: T.textMuted, fontSize: 11, fontWeight: 600, letterSpacing: 0.5 }}>COMING UP NEXT</span>
                            <Badge text={nextPeriod.label} color={T.purple} bg={T.purpleDim} />
                        </div>
                        <span style={{ color: T.purple, fontSize: 14, fontWeight: 600, fontFamily: T.mono }}>{fmt(nextBillsTotal)}</span>
                    </div>
                    {displayNextPeriodBills.length === 0 && <div style={{ color: T.textDim, fontSize: 12, textAlign: "center", padding: 8 }}>No bills due next period</div>}
                    {displayNextPeriodBills.map((bill, i) => {
                        const isFromCurrentDefer = periodAlloc[bill.id]?.deferred;
                        const isFromCurrentSplit = periodAlloc[bill.id]?.splitAmount != null;
                        const isPaidEarly = periodAlloc[bill.id]?.paidEarly && !periodAlloc[bill.id]?.prepayAmount;
                        const hasPrepay = periodAlloc[bill.id]?.prepayAmount != null;
                        const prepayAmt = periodAlloc[bill.id]?.prepayAmount;
                        const nAlloc = nextPeriodAlloc[bill.id] || {};
                        const effectiveBillAmt = nAlloc.actual != null ? Number(nAlloc.actual) : bill.amount;
                        const nextAmt = isFromCurrentSplit ? (bill.amount - periodAlloc[bill.id].splitAmount)
                            : isFromCurrentDefer ? bill.amount
                                : hasPrepay ? (effectiveBillAmt - prepayAmt)
                                    : (nAlloc.actual ?? nAlloc.planned ?? bill.amount);
                        const isVariable = bill.bill_type === "variable";
                        const canEdit = isVariable && nAlloc.actual == null && !isFromCurrentDefer && !isFromCurrentSplit && !isPaidEarly && !hasPrepay;
                        return (
                            <div key={bill.id} style={{
                                display: "flex", justifyContent: "space-between", alignItems: "center",
                                padding: "8px 4px", borderTop: i > 0 ? `1px solid ${T.border}` : "none",
                                opacity: isPaidEarly ? 0.4 : 1, transition: "opacity 0.2s",
                            }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
                                    <span style={{ color: T.textMuted, fontSize: 13, textDecoration: isPaidEarly ? "line-through" : "none" }}>{bill.name}</span>
                                    {hasPrepay && <Badge text={`Prepaid ${fmt(prepayAmt)}`} color={T.green} bg={T.greenDim} />}
                                    {isVariable && !isFromCurrentDefer && !isFromCurrentSplit && !hasPrepay && (
                                        nAlloc.actual != null
                                            ? <Badge text="Updated" color={T.green} bg={T.greenDim} />
                                            : <Badge text="~EST" color={T.amber} bg={T.amberDim} />
                                    )}
                                    {isFromCurrentDefer && <Badge text="Deferred" color={T.amber} bg={T.amberDim} />}
                                    {isFromCurrentSplit && <Badge text="Split remainder" color={T.purple} bg={T.purpleDim} />}
                                    {isPaidEarly && <Badge text="Paid Early" color={T.green} bg={T.greenDim} />}
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    {canEdit && (
                                        <button onClick={() => { setEditingBill(bill.id); setEditingBillPK(nextPeriodKey); }}
                                            aria-label={`Edit amount for ${bill.name}`}
                                            style={{ color: T.amber, fontSize: 14, cursor: "pointer", padding: "2px 4px", background: "none", border: "none" }}>
                                            ✏️
                                        </button>
                                    )}
                                    {nAlloc.actual != null && isVariable && !isFromCurrentDefer && !isFromCurrentSplit && !isPaidEarly && (
                                        <button onClick={() => updateActual(bill.id, "", nextPeriodKey)}
                                            aria-label={`Reset estimate for ${bill.name}`}
                                            style={{
                                                color: T.textDim, fontSize: 10, cursor: "pointer", padding: "2px 6px",
                                                background: T.border, borderRadius: 10, fontWeight: 500, fontFamily: T.font, border: "none",
                                            }}>↩</button>
                                    )}
                                    {hasPrepay && (
                                        <button onClick={() => undoPayEarly(bill.id)}
                                            aria-label={`Undo prepay for ${bill.name}`}
                                            style={{
                                                color: T.textDim, fontSize: 10, cursor: "pointer", padding: "2px 6px",
                                                background: T.border, borderRadius: 10, fontWeight: 500, fontFamily: T.font, border: "none",
                                            }}>↩</button>
                                    )}
                                    {!isPaidEarly && !isFromCurrentDefer && !isFromCurrentSplit && !periodAlloc[bill.id]?.prepayAmount && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setPrepayBill(bill); setPrepayValue(""); }}
                                            aria-label={`Pay ${bill.name} early`}
                                            style={{
                                                color: T.green, fontSize: 10, cursor: "pointer", padding: "3px 8px",
                                                background: T.greenDim, borderRadius: 12, fontWeight: 600, fontFamily: T.font,
                                                transition: "opacity 0.15s", whiteSpace: "nowrap", border: "none",
                                            }}
                                            onMouseEnter={(e) => (e.target.style.opacity = "0.7")}
                                            onMouseLeave={(e) => (e.target.style.opacity = "1")}
                                        >
                                            ← Pay Early
                                        </button>
                                    )}
                                    <span style={{ color: T.textMuted, fontSize: 13, fontFamily: T.mono, minWidth: 60, textAlign: "right" }}>{fmt(nextAmt)}</span>
                                </div>
                            </div>
                        );
                    })}
                    {displayNextPeriodBills.length > 0 && (
                        <div style={{ marginTop: 10 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.textDim }}>
                                <span>Est. remaining after bills + savings</span>
                                <span style={{ fontFamily: T.mono, color: (netPay - nextBillsTotal - savingsTotal) < 0 ? T.red : T.amber, fontWeight: 600 }}>
                                    {fmt(netPay - nextBillsTotal - savingsTotal)}
                                </span>
                            </div>
                        </div>
                    )}
                </Card>
            )}

            {periodHistory.length > 0 && (
                <Card style={{ border: `1px solid ${T.greenDim}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <span style={{ color: T.textMuted, fontSize: 11, fontWeight: 600, letterSpacing: 0.5 }}>SAVINGS SO FAR</span>
                        <span style={{ color: T.green, fontSize: 16, fontWeight: 700, fontFamily: T.mono }}>
                            {fmt(periodHistory.reduce((s, h) => s + h.saved, 0))}
                        </span>
                    </div>
                    {periodHistory.length > 1 && (
                        <div style={{
                            background: T.surface, borderRadius: T.radiusSm, padding: "10px 14px",
                            border: `1px solid ${T.border}`, marginBottom: 12, display: "flex", justifyContent: "space-between",
                        }}>
                            <div style={{ textAlign: "center" }}>
                                <div style={{ color: T.textDim, fontSize: 10, marginBottom: 2 }}>Paychecks</div>
                                <div style={{ color: T.text, fontSize: 14, fontWeight: 600, fontFamily: T.mono }}>{periodHistory.length}</div>
                            </div>
                            <div style={{ textAlign: "center" }}>
                                <div style={{ color: T.textDim, fontSize: 10, marginBottom: 2 }}>Avg / Check</div>
                                <div style={{ color: T.green, fontSize: 14, fontWeight: 600, fontFamily: T.mono }}>
                                    {fmt(periodHistory.reduce((s, h) => s + h.saved, 0) / periodHistory.length)}
                                </div>
                            </div>
                            <div style={{ textAlign: "center" }}>
                                <div style={{ color: T.textDim, fontSize: 10, marginBottom: 2 }}>Best Check</div>
                                <div style={{ color: T.green, fontSize: 14, fontWeight: 600, fontFamily: T.mono }}>
                                    {fmt(Math.max(...periodHistory.map((h) => h.saved)))}
                                </div>
                            </div>
                        </div>
                    )}
                    {periodHistory.slice().reverse().map((entry, i) => (
                        <div key={entry.periodKey} style={{
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            padding: "8px 0", borderTop: i > 0 ? `1px solid ${T.border}` : "none",
                        }}>
                            <div>
                                <div style={{ color: T.text, fontSize: 12, fontWeight: 500 }}>{entry.label}</div>
                                <div style={{ color: T.textDim, fontSize: 10, marginTop: 2 }}>Bills: {fmt(entry.billsTotal)}</div>
                            </div>
                            <span style={{ color: T.green, fontSize: 14, fontWeight: 600, fontFamily: T.mono }}>+{fmt(entry.saved)}</span>
                        </div>
                    ))}
                </Card>
            )}

            {/* ─── MODALS ─── */}
            <Modal open={!!editingBill} onClose={() => setEditingBill(null)} title="Update Actual Amount">
                {editingBill &&
                    (() => {
                        const bill = bills.find((b) => b.id === editingBill);
                        const editAlloc = (allocations[editingBillPK] || {})[editingBill] || {};
                        return (
                            <div>
                                <div style={{ color: T.textMuted, fontSize: 12, marginBottom: 12 }}>
                                    Enter the actual amount for <strong style={{ color: T.text }}>{bill?.name}</strong>. Estimated: {fmt(bill?.amount)}
                                </div>
                                <Input label="ACTUAL AMOUNT" type="number" placeholder={String(bill?.amount)}
                                    value={editAlloc.actual ?? ""} onChange={(v) => updateActual(editingBill, v, editingBillPK)} />
                                <Btn full color="#fff" bg={T.accent} onClick={() => {
                                    if (editAlloc.actual == null) updateActual(editingBill, bill?.amount, editingBillPK);
                                    setEditingBill(null);
                                }}>Confirm</Btn>
                            </div>
                        );
                    })()}
            </Modal>

            <Modal open={!!splittingBill} onClose={() => setSplittingBill(null)} title="Split Payment">
                {splittingBill &&
                    (() => {
                        const remainder = splittingBill.amount - (Number(splitValue) || 0);
                        return (
                            <div>
                                <div style={{ color: T.textMuted, fontSize: 12, marginBottom: 16 }}>
                                    Split <strong style={{ color: T.text }}>{splittingBill.name}</strong> ({fmt(splittingBill.amount)}) across two pay periods.
                                </div>
                                <Input label="PAY THIS PERIOD" type="number" placeholder="0.00" value={splitValue} onChange={(v) => setSplitValue(v)} />
                                <div style={{ background: T.surface, borderRadius: T.radiusSm, padding: "12px 14px", border: `1px solid ${T.border}`, marginBottom: 16 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <span style={{ color: T.textMuted, fontSize: 11, fontWeight: 600, fontFamily: T.mono }}>REMAINING NEXT PERIOD</span>
                                        <span style={{ color: remainder >= 0 ? T.purple : T.red, fontSize: 18, fontWeight: 700, fontFamily: T.mono }}>{fmt(remainder)}</span>
                                    </div>
                                </div>
                                <Btn full color="#fff" bg={T.purple} onClick={confirmSplit}
                                    style={{ opacity: (Number(splitValue) > 0 && remainder >= 0) ? 1 : 0.4 }}>
                                    Confirm Split
                                </Btn>
                            </div>
                        );
                    })()}
            </Modal>

            <Modal open={!!prepayBill} onClose={() => setPrepayBill(null)} title="Pay Early">
                {prepayBill &&
                    (() => {
                        const nAlloc = nextPeriodAlloc[prepayBill.id] || {};
                        const effectiveAmt = nAlloc.actual != null ? Number(nAlloc.actual) : prepayBill.amount;
                        const remainder = effectiveAmt - (Number(prepayValue) || 0);
                        return (
                            <div>
                                <div style={{ color: T.textMuted, fontSize: 12, marginBottom: 16 }}>
                                    Pay <strong style={{ color: T.text }}>{prepayBill.name}</strong> ({fmt(effectiveAmt)}) from this paycheck.
                                </div>
                                <Btn full color="#fff" bg={T.green} style={{ marginBottom: 8 }} onClick={() => {
                                    payEarly(prepayBill.id, { ...prepayBill, amount: effectiveAmt });
                                    setPrepayBill(null);
                                }}>Pay Full Amount · {fmt(effectiveAmt)}</Btn>
                                <div style={{ color: T.textDim, fontSize: 10, textAlign: "center", margin: "8px 0", fontWeight: 600 }}>— OR —</div>
                                <Input label="PAY A PARTIAL AMOUNT NOW" type="number" placeholder="0.00" value={prepayValue} onChange={(v) => setPrepayValue(v)} />
                                <div style={{ background: T.surface, borderRadius: T.radiusSm, padding: "12px 14px", border: `1px solid ${T.border}`, marginBottom: 16 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <span style={{ color: T.textMuted, fontSize: 11, fontWeight: 600, fontFamily: T.mono }}>REMAINING NEXT PERIOD</span>
                                        <span style={{ color: remainder >= 0 ? T.purple : T.red, fontSize: 18, fontWeight: 700, fontFamily: T.mono }}>{fmt(remainder)}</span>
                                    </div>
                                </div>
                                <Btn full color="#fff" bg={T.accent}
                                    style={{ opacity: (Number(prepayValue) > 0 && remainder > 0) ? 1 : 0.4 }}
                                    onClick={() => {
                                        if (Number(prepayValue) > 0 && remainder > 0) {
                                            payEarly(prepayBill.id, { ...prepayBill, amount: effectiveAmt }, Number(prepayValue));
                                            setPrepayBill(null);
                                        }
                                    }}>Prepay {prepayValue ? fmt(Number(prepayValue)) : "$0.00"}</Btn>
                            </div>
                        );
                    })()}
            </Modal>
        </div>
    );
}
