import { useState, useEffect, useCallback, useMemo } from "react";

// ─── FONTS ───
const fontLink = "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=DM+Mono:wght@400;500&display=swap";

// ─── TOKENS ───
const T = {
  bg: "#0F1117", surface: "#151820", card: "#1A1D27", cardHover: "#1E2230",
  border: "#252836", borderLight: "#2E3244",
  accent: "#6C9CFC", accentDim: "rgba(108,156,252,0.10)", accentSoft: "rgba(108,156,252,0.20)",
  green: "#4ADE80", greenDim: "rgba(74,222,128,0.10)",
  amber: "#FBBF24", amberDim: "rgba(251,191,36,0.10)",
  red: "#F87171", redDim: "rgba(248,113,113,0.10)",
  purple: "#A78BFA", purpleDim: "rgba(167,139,250,0.10)",
  text: "#E8EAF0", textMuted: "#8B8FA3", textDim: "#5A5E72",
  font: "'DM Sans', sans-serif", mono: "'DM Mono', monospace",
  radius: "12px", radiusSm: "8px",
};

// ─── PERSISTENCE ───
const STORAGE_KEY = "paycheck-planner-data";

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return null;
}

function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) { /* ignore */ }
}

// ─── UTILS ───
const uuid = () => crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
const fmt = (n) => {
  const num = Number(n) || 0;
  return num.toLocaleString("en-US", { style: "currency", currency: "USD" });
};
const pct = (c, t) => t > 0 ? Math.min(100, Math.round((c / t) * 100)) : 0;

function getPayPeriods(firstPayDate, count = 6) {
  const periods = [];
  const anchor = new Date(firstPayDate + "T00:00:00");
  const now = new Date();
  let start = new Date(anchor);
  while (start > now) { start.setDate(start.getDate() - 14); }
  while (start <= now) {
    const end = new Date(start);
    end.setDate(end.getDate() + 13);
    if (end >= now) break;
    start.setDate(start.getDate() + 14);
  }
  start.setDate(start.getDate() - 28);
  for (let i = 0; i < count; i++) {
    const end = new Date(start);
    end.setDate(end.getDate() + 13);
    periods.push({
      start: new Date(start),
      end: new Date(end),
      label: `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
      isCurrent: start <= now && end >= now,
    });
    start.setDate(start.getDate() + 14);
  }
  return periods;
}

function billFallsInPeriod(bill, periodStart, periodEnd) {
  if (!bill.is_active) return false;
  const dueDay = bill.due_day;

  if (bill.frequency === "quarterly") {
    const months = (bill.quarter_months || "1,4,7,10").split(",").map(Number);
    for (let m of months) {
      const dueDate = new Date(periodStart.getFullYear(), m - 1, Math.min(dueDay, 28));
      if (dueDate >= periodStart && dueDate <= periodEnd) return true;
    }
    return false;
  }
  if (bill.frequency === "annual") {
    const m = bill.annual_month || 1;
    const dueDate = new Date(periodStart.getFullYear(), m - 1, Math.min(dueDay, 28));
    return dueDate >= periodStart && dueDate <= periodEnd;
  }
  let dueDate = new Date(periodStart.getFullYear(), periodStart.getMonth(), Math.min(dueDay, 28));
  if (dueDate >= periodStart && dueDate <= periodEnd) return true;
  dueDate = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), Math.min(dueDay, 28));
  if (dueDate >= periodStart && dueDate <= periodEnd) return true;
  return false;
}

// ─── INITIAL DATA ───
const DEFAULT_SETTINGS = {
  id: uuid(), default_net_pay: 2847.50, pay_frequency: "biweekly", first_pay_date: "2026-01-09",
};

const DEFAULT_BILLS = [
  { id: uuid(), name: "Rent", bill_type: "fixed", amount: 1450, due_day: 1, frequency: "monthly", quarter_months: "", annual_month: 1, is_active: true },
  { id: uuid(), name: "Electric", bill_type: "variable", amount: 89.50, due_day: 5, frequency: "monthly", quarter_months: "", annual_month: 1, is_active: true },
  { id: uuid(), name: "Internet", bill_type: "fixed", amount: 65, due_day: 8, frequency: "monthly", quarter_months: "", annual_month: 1, is_active: true },
  { id: uuid(), name: "Phone", bill_type: "fixed", amount: 45, due_day: 12, frequency: "monthly", quarter_months: "", annual_month: 1, is_active: true },
  { id: uuid(), name: "Car Insurance", bill_type: "fixed", amount: 142, due_day: 15, frequency: "monthly", quarter_months: "", annual_month: 1, is_active: true },
  { id: uuid(), name: "Visa Card", bill_type: "variable", amount: 500, due_day: 20, frequency: "monthly", quarter_months: "", annual_month: 1, is_active: true },
];

const DEFAULT_GOALS = [
  { id: uuid(), name: "Emergency Fund", icon: "🛡️", target_amount: 10000, current_balance: 4200, per_check_amount: 200, is_active: true },
  { id: uuid(), name: "Vacation", icon: "✈️", target_amount: 3000, current_balance: 1850, per_check_amount: 150, is_active: true },
  { id: uuid(), name: "New Laptop", icon: "💻", target_amount: 2000, current_balance: 800, per_check_amount: 100, is_active: true },
];

// ─── SHARED COMPONENTS ───
const Card = ({ children, style, onClick }) => (
  <div onClick={onClick} style={{
    background: T.card, borderRadius: T.radius, border: `1px solid ${T.border}`,
    padding: "16px 18px", transition: "all 0.2s", cursor: onClick ? "pointer" : "default", ...style,
  }}>{children}</div>
);

const Badge = ({ text, color, bg }) => (
  <span style={{
    background: bg, color, fontSize: 10, fontWeight: 600, fontFamily: T.font,
    padding: "2px 10px", borderRadius: 20, letterSpacing: 0.5, textTransform: "uppercase",
  }}>{text}</span>
);

const ProgressBar = ({ value, color, height = 6 }) => (
  <div style={{ background: T.border, borderRadius: 20, height, overflow: "hidden", width: "100%" }}>
    <div style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: "100%", borderRadius: 20, background: color, transition: "width 0.5s cubic-bezier(0.4,0,0.2,1)" }} />
  </div>
);

const Btn = ({ children, color = T.accent, bg, onClick, full, style: s }) => (
  <button onClick={onClick} style={{
    background: bg || `${color}18`, color, border: "none", borderRadius: T.radiusSm,
    padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer",
    fontFamily: T.font, width: full ? "100%" : "auto", transition: "opacity 0.15s", ...s,
  }}>{children}</button>
);

const Input = ({ label, value, onChange, type = "text", placeholder, small }) => (
  <div style={{ marginBottom: 12 }}>
    {label && <div style={{ color: T.textMuted, fontSize: 11, fontWeight: 600, marginBottom: 6, fontFamily: T.mono, letterSpacing: 0.5 }}>{label}</div>}
    <input value={value} onChange={e => onChange(e.target.value)} type={type} placeholder={placeholder}
      style={{
        width: "100%", boxSizing: "border-box", background: T.surface, border: `1px solid ${T.border}`,
        borderRadius: T.radiusSm, padding: small ? "8px 12px" : "10px 14px", color: T.text,
        fontSize: 14, fontFamily: T.font, outline: "none", transition: "border-color 0.15s",
      }}
      onFocus={e => e.target.style.borderColor = T.accent}
      onBlur={e => e.target.style.borderColor = T.border}
    />
  </div>
);

const Select = ({ label, value, onChange, options }) => (
  <div style={{ marginBottom: 12 }}>
    {label && <div style={{ color: T.textMuted, fontSize: 11, fontWeight: 600, marginBottom: 6, fontFamily: T.mono, letterSpacing: 0.5 }}>{label}</div>}
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{
        width: "100%", boxSizing: "border-box", background: T.surface, border: `1px solid ${T.border}`,
        borderRadius: T.radiusSm, padding: "10px 14px", color: T.text,
        fontSize: 14, fontFamily: T.font, outline: "none", appearance: "none",
      }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: T.card, borderRadius: 16, border: `1px solid ${T.border}`,
        width: "100%", maxWidth: 400, maxHeight: "85vh", overflow: "auto", padding: "24px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ color: T.text, fontSize: 18, fontWeight: 600 }}>{title}</span>
          <span onClick={onClose} style={{ color: T.textDim, fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</span>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── SCREEN: DASHBOARD ───
function DashboardScreen({ settings, bills, goals, allocations, setAllocations, periodHistory, setPeriodHistory }) {
  const periods = useMemo(() => getPayPeriods(settings.first_pay_date, 6), [settings.first_pay_date]);
  const currentPeriod = periods.find(p => p.isCurrent) || periods[2];
  const currentIdx = periods.indexOf(currentPeriod);
  const nextPeriod = currentIdx < periods.length - 1 ? periods[currentIdx + 1] : null;

  const periodKey = currentPeriod.start.toISOString().slice(0, 10);
  const nextPeriodKey = nextPeriod ? nextPeriod.start.toISOString().slice(0, 10) : null;
  const periodAlloc = allocations[periodKey] || {};
  const nextPeriodAlloc = nextPeriodKey ? (allocations[nextPeriodKey] || {}) : {};

  // Base bills for each period (before split/defer/payEarly adjustments)
  const basePeriodBills = useMemo(() =>
    bills.filter(b => b.is_active && billFallsInPeriod(b, currentPeriod.start, currentPeriod.end)),
    [bills, currentPeriod]
  );

  const baseNextPeriodBills = useMemo(() =>
    nextPeriod ? bills.filter(b => b.is_active && billFallsInPeriod(b, nextPeriod.start, nextPeriod.end)) : [],
    [bills, nextPeriod]
  );

  // Effective current period bills: exclude deferred, include paidEarly from next period
  const paidEarlyBills = baseNextPeriodBills.filter(b => periodAlloc[b.id]?.paidEarly);
  const periodBills = useMemo(() => {
    const nonDeferred = basePeriodBills.filter(b => !periodAlloc[b.id]?.deferred);
    const earlyIds = new Set(paidEarlyBills.map(b => b.id));
    // Add paidEarly bills that aren't already in current period
    const extras = paidEarlyBills.filter(b => !nonDeferred.some(nb => nb.id === b.id));
    return [...nonDeferred, ...extras];
  }, [basePeriodBills, periodAlloc, paidEarlyBills]);

  // Effective next period bills: exclude paidEarly, include deferred + split remainders from current
  const deferredBills = basePeriodBills.filter(b => periodAlloc[b.id]?.deferred);
  const splitBills = basePeriodBills.filter(b => periodAlloc[b.id]?.splitAmount != null);
  const displayNextPeriodBills = useMemo(() => {
    const nonPaidEarly = baseNextPeriodBills.filter(b => !(periodAlloc[b.id]?.paidEarly && periodAlloc[b.id]?.prepayAmount == null));
    // Add deferred bills that aren't already in next period
    const deferredExtras = deferredBills.filter(b => !nonPaidEarly.some(nb => nb.id === b.id));
    // Add split remainder bills that aren't already in next period
    const splitExtras = splitBills.filter(b => !nonPaidEarly.some(nb => nb.id === b.id) && !deferredBills.some(db => db.id === b.id));
    return [...nonPaidEarly, ...deferredExtras, ...splitExtras];
  }, [baseNextPeriodBills, periodAlloc, deferredBills, splitBills]);

  // Init allocations for base period bills
  useEffect(() => {
    const existing = allocations[periodKey] || {};
    const updated = { ...existing };
    let changed = false;
    basePeriodBills.forEach(bill => {
      if (!updated[bill.id]) {
        updated[bill.id] = { planned: bill.amount, actual: bill.bill_type === "fixed" ? bill.amount : null, paid: false };
        changed = true;
      }
    });
    if (changed) setAllocations(prev => ({ ...prev, [periodKey]: updated }));
  }, [basePeriodBills, periodKey, allocations, setAllocations]);

  // Init allocations for next period bills
  useEffect(() => {
    if (!nextPeriodKey) return;
    const existing = allocations[nextPeriodKey] || {};
    const updated = { ...existing };
    let changed = false;
    baseNextPeriodBills.forEach(bill => {
      if (!updated[bill.id]) {
        updated[bill.id] = { planned: bill.amount, actual: bill.bill_type === "fixed" ? bill.amount : null, paid: false };
        changed = true;
      }
    });
    if (changed) setAllocations(prev => ({ ...prev, [nextPeriodKey]: updated }));
  }, [baseNextPeriodBills, nextPeriodKey, allocations, setAllocations]);

  // ─── TOTALS ───
  const getBillAmount = (bill) => {
    const a = periodAlloc[bill.id];
    if (!a) return bill.amount;
    if (a.deferred) return 0;
    if (a.splitAmount != null) return a.splitAmount;
    if (a.paidEarly && a.prepayAmount != null) return a.prepayAmount; // partial prepay
    return a.actual ?? a.planned ?? bill.amount;
  };

  const billsTotal = periodBills.reduce((s, b) => s + getBillAmount(b), 0);
  const savingsTotal = goals.filter(g => g.is_active).reduce((s, g) => s + g.per_check_amount, 0);
  const adjustments = periodAlloc._adjustments || [];
  const adjustmentsTotal = adjustments.reduce((s, a) => s + a.amount, 0);
  const netPay = periodAlloc._netPayOverride ?? settings.default_net_pay;
  const hasPayOverride = periodAlloc._netPayOverride != null;
  const remaining = netPay - billsTotal - savingsTotal + adjustmentsTotal;
  const isOver = remaining < 0;
  const paidCount = periodBills.filter(b => periodAlloc[b.id]?.paid).length;
  const isClosed = !!periodAlloc._closed;

  // Next period totals (accounting for splits, defers, paidEarly, prepay, and edited actuals)
  const getNextBillAmount = (bill) => {
    const a = periodAlloc[bill.id];
    if (a?.paidEarly && a?.prepayAmount == null) return 0; // fully paid early
    if (a?.paidEarly && a?.prepayAmount != null) {
      const na = nextPeriodAlloc[bill.id];
      const base = na?.actual != null ? Number(na.actual) : bill.amount;
      return base - a.prepayAmount; // partial prepay remainder
    }
    if (a?.deferred) return bill.amount; // full amount deferred here
    if (a?.splitAmount != null) return bill.amount - a.splitAmount; // remainder
    // Check if user has edited the actual amount for next period
    const na = nextPeriodAlloc[bill.id];
    if (na?.actual != null) return na.actual;
    return bill.amount;
  };
  const nextBillsTotal = displayNextPeriodBills.reduce((s, b) => s + getNextBillAmount(b), 0);

  // ─── ACTIONS (parameterized by period key) ───
  const togglePaid = (billId, targetPK = periodKey) => {
    setAllocations(prev => {
      const pk = { ...prev };
      const pa = { ...(pk[targetPK] || {}) };
      pa[billId] = { ...pa[billId], paid: !pa[billId]?.paid };
      pk[targetPK] = pa;
      return pk;
    });
  };

  const updateActual = (billId, val, targetPK = periodKey) => {
    setAllocations(prev => {
      const pk = { ...prev };
      const pa = { ...(pk[targetPK] || {}) };
      pa[billId] = { ...pa[billId], actual: val === "" ? null : Number(val) };
      pk[targetPK] = pa;
      return pk;
    });
  };

  const deferBill = (billId, targetPK = periodKey) => {
    setAllocations(prev => {
      const pk = { ...prev };
      const pa = { ...(pk[targetPK] || {}) };
      pa[billId] = { ...pa[billId], deferred: true, paid: false, splitAmount: undefined };
      pk[targetPK] = pa;
      return pk;
    });
  };

  const undoDefer = (billId, targetPK = periodKey) => {
    setAllocations(prev => {
      const pk = { ...prev };
      const pa = { ...(pk[targetPK] || {}) };
      pa[billId] = { ...pa[billId], deferred: false };
      pk[targetPK] = pa;
      return pk;
    });
  };

  const splitBill = (billId, splitAmount, targetPK = periodKey) => {
    setAllocations(prev => {
      const pk = { ...prev };
      const pa = { ...(pk[targetPK] || {}) };
      pa[billId] = { ...pa[billId], splitAmount: Number(splitAmount), deferred: false };
      pk[targetPK] = pa;
      return pk;
    });
  };

  const undoSplit = (billId, targetPK = periodKey) => {
    setAllocations(prev => {
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
    setAllocations(prev => {
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
    setAllocations(prev => {
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
    setAllocations(prev => {
      const pk = { ...prev };
      const pa = { ...(pk[periodKey] || {}) };
      const adjs = [...(pa._adjustments || []), { id: Date.now().toString(), label, amount }];
      pa._adjustments = adjs;
      pk[periodKey] = pa;
      return pk;
    });
  };

  const removeAdjustment = (adjId) => {
    setAllocations(prev => {
      const pk = { ...prev };
      const pa = { ...(pk[periodKey] || {}) };
      pa._adjustments = (pa._adjustments || []).filter(a => a.id !== adjId);
      pk[periodKey] = pa;
      return pk;
    });
  };

  // ─── NET PAY OVERRIDE ───
  const setNetPayOverride = (val) => {
    setAllocations(prev => {
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
    setPeriodHistory(prev => {
      const filtered = prev.filter(h => h.periodKey !== periodKey);
      return [...filtered, entry].sort((a, b) => a.periodKey.localeCompare(b.periodKey));
    });
    setAllocations(prev => {
      const pk = { ...prev };
      const pa = { ...(pk[periodKey] || {}) };
      pa._closed = true;
      pk[periodKey] = pa;
      return pk;
    });
  };

  const reopenPeriod = () => {
    // Remove from history
    setPeriodHistory(prev => prev.filter(h => h.periodKey !== periodKey));
    // Clear closed flag
    setAllocations(prev => {
      const pk = { ...prev };
      const pa = { ...(pk[periodKey] || {}) };
      delete pa._closed;
      pk[periodKey] = pa;
      return pk;
    });
  };

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
  const [prepayBill, setPrepayBill] = useState(null); // bill object for prepay modal
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
        <span onClick={() => undoDefer(billId, targetPK)} style={{
          color: T.amber, fontSize: 10, cursor: "pointer", padding: "2px 8px",
          background: T.amberDim, borderRadius: 12, fontWeight: 600, fontFamily: T.font,
        }}>DEFERRED ↩</span>
      );
    }
    if (hasSplit) {
      return (
        <span onClick={() => undoSplit(billId, targetPK)} style={{
          color: T.purple, fontSize: 10, cursor: "pointer", padding: "2px 8px",
          background: T.purpleDim, borderRadius: 12, fontWeight: 600, fontFamily: T.font,
        }}>SPLIT ↩</span>
      );
    }

    return (
      <div style={{ position: "relative" }}>
        <span onClick={(e) => { e.stopPropagation(); setActionMenu(isMenuOpen ? null : billId); }}
          style={{ color: T.textDim, fontSize: 18, cursor: "pointer", padding: "0 4px", lineHeight: 1, userSelect: "none" }}>⋯</span>
        {isMenuOpen && (
          <div onClick={(e) => e.stopPropagation()} style={{
            position: "absolute", right: 0, top: 24, zIndex: 10,
            background: T.card, border: `1px solid ${T.border}`, borderRadius: T.radiusSm,
            padding: 4, minWidth: 110, boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}>
            <div onClick={() => { openSplit(bill, targetPK, targetAlloc); }} style={{
              padding: "8px 12px", fontSize: 12, color: T.purple, cursor: "pointer",
              borderRadius: 6, fontWeight: 500,
            }}
              onMouseEnter={e => e.target.style.background = T.purpleDim}
              onMouseLeave={e => e.target.style.background = "transparent"}
            >✂️ Split</div>
            {isDeferrable && (
              <div onClick={() => { deferBill(billId, targetPK); setActionMenu(null); }} style={{
                padding: "8px 12px", fontSize: 12, color: T.amber, cursor: "pointer",
                borderRadius: 6, fontWeight: 500,
              }}
                onMouseEnter={e => e.target.style.background = T.amberDim}
                onMouseLeave={e => e.target.style.background = "transparent"}
              >⏩ Defer</div>
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
              onChange={e => setNetPayInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && Number(netPayInput) > 0) {
                  setNetPayOverride(netPayInput);
                  setEditingNetPay(false);
                } else if (e.key === "Escape") {
                  setEditingNetPay(false);
                }
              }}
              placeholder={String(settings.default_net_pay)}
              style={{
                width: "100%", padding: "8px 12px", border: `1px solid ${T.accent}`,
                borderRadius: T.radiusSm, background: T.surface, color: T.text,
                fontSize: 24, fontWeight: 700, fontFamily: T.mono, textAlign: "center",
                outline: "none",
              }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "center" }}>
              <span onClick={() => {
                if (Number(netPayInput) > 0) { setNetPayOverride(netPayInput); setEditingNetPay(false); }
              }} style={{
                color: "#fff", fontSize: 11, cursor: "pointer", padding: "4px 14px",
                background: T.accent, borderRadius: 10, fontWeight: 600, fontFamily: T.font,
              }}>Save</span>
              {hasPayOverride && (
                <span onClick={() => { setNetPayOverride(""); setEditingNetPay(false); }} style={{
                  color: T.textDim, fontSize: 11, cursor: "pointer", padding: "4px 14px",
                  background: T.border, borderRadius: 10, fontWeight: 600, fontFamily: T.font,
                }}>Reset</span>
              )}
              <span onClick={() => setEditingNetPay(false)} style={{
                color: T.textDim, fontSize: 11, cursor: "pointer", padding: "4px 14px",
                background: T.border, borderRadius: 10, fontWeight: 600, fontFamily: T.font,
              }}>Cancel</span>
            </div>
          </div>
        ) : (
          <div onClick={() => { setNetPayInput(String(netPay)); setEditingNetPay(true); }}
            style={{ cursor: "pointer", position: "relative", display: "inline-block" }}>
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
            { label: isClosed ? "Saved" : "Remaining", value: remaining, color: isClosed ? T.green : (isOver ? T.red : T.amber) },
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
        <Card style={{ border: `1px solid rgba(248,113,113,0.3)`, background: T.redDim }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
          <div style={{
            background: T.surface, borderRadius: T.radiusSm, padding: "16px",
            border: `1px solid ${T.border}`, marginBottom: 14,
          }}>
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
            <span onClick={reopenPeriod} style={{
              color: T.amber, fontSize: 11, cursor: "pointer", padding: "6px 16px",
              background: T.amberDim, borderRadius: 12, fontWeight: 600, fontFamily: T.font,
              transition: "opacity 0.15s",
            }}
              onMouseEnter={e => e.target.style.opacity = "0.7"}
              onMouseLeave={e => e.target.style.opacity = "1"}
            >Reopen for Edits ↩</span>
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
            {periodBills.map(bill => {
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
                    <div onClick={() => !isDeferred && togglePaid(bill.id)} style={{
                      width: 22, height: 22, borderRadius: 6, flexShrink: 0, cursor: isDeferred ? "default" : "pointer",
                      border: alloc.paid ? "none" : `2px solid ${T.textDim}`,
                      background: alloc.paid ? T.green : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {alloc.paid && <span style={{ color: "#000", fontSize: 12, fontWeight: 700 }}>✓</span>}
                    </div>
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
                      <span onClick={() => setEditingBill(bill.id)} style={{
                        color: T.amber, fontSize: 14, cursor: "pointer", padding: "2px 4px",
                      }}>✏️</span>
                    )}
                    {isPaidEarly && (
                      <span onClick={() => undoPayEarly(bill.id)} style={{
                        color: T.textDim, fontSize: 10, cursor: "pointer", padding: "2px 6px",
                        background: T.border, borderRadius: 10, fontWeight: 500, fontFamily: T.font,
                      }}>↩</span>
                    )}
                    {!isPaidEarly && !isDeferred && <ActionDot billId={bill.id} bill={bill} />}
                    {isDeferred && (
                      <span onClick={() => undoDefer(bill.id)} style={{
                        color: T.amber, fontSize: 10, cursor: "pointer", padding: "2px 8px",
                        background: T.amberDim, borderRadius: 12, fontWeight: 600, fontFamily: T.font,
                      }}>DEFERRED ↩</span>
                    )}
                    <div style={{ textAlign: "right", minWidth: 70 }}>
                      <div style={{
                        color: alloc.paid ? T.textMuted : isDeferred ? T.textDim : T.text, fontSize: 14, fontWeight: 600, fontFamily: T.mono,
                        textDecoration: isDeferred ? "line-through" : "none"
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
                <button onClick={closePeriod} style={{
                  width: "100%", padding: "10px 0", border: "none", borderRadius: T.radiusSm,
                  background: T.greenDim, color: T.green, fontSize: 13, fontWeight: 600,
                  fontFamily: T.font, cursor: "pointer", transition: "opacity 0.15s",
                }}
                  onMouseEnter={e => e.target.style.opacity = "0.8"}
                  onMouseLeave={e => e.target.style.opacity = "1"}
                >✓ Close Period</button>
              </div>
            )}
          </Card>

          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: adjustments.length > 0 || showAdjForm ? 10 : 0 }}>
              <span style={{ color: T.textMuted, fontSize: 11, fontWeight: 600, letterSpacing: 0.5 }}>ADJUSTMENTS</span>
              {!showAdjForm && (
                <span onClick={() => setShowAdjForm(true)} style={{
                  color: T.accent, fontSize: 11, cursor: "pointer", padding: "2px 10px",
                  background: T.accentDim, borderRadius: 10, fontWeight: 600, fontFamily: T.font,
                }}>+ Add</span>
              )}
            </div>
            {adjustments.map(adj => (
              <div key={adj.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "8px 4px", borderBottom: `1px solid ${T.border}`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14 }}>{adj.amount > 0 ? "💵" : "💸"}</span>
                  <span style={{ color: T.text, fontSize: 13 }}>{adj.label}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{
                    color: adj.amount > 0 ? T.green : T.red, fontSize: 13, fontWeight: 600, fontFamily: T.mono,
                  }}>{adj.amount > 0 ? "+" : ""}{fmt(adj.amount)}</span>
                  <span onClick={() => removeAdjustment(adj.id)} style={{
                    color: T.textDim, fontSize: 12, cursor: "pointer", padding: "2px 6px",
                    borderRadius: 6, transition: "color 0.15s",
                  }}
                    onMouseEnter={e => e.target.style.color = T.red}
                    onMouseLeave={e => e.target.style.color = T.textDim}
                  >✕</span>
                </div>
              </div>
            ))}
            {adjustments.length === 0 && !showAdjForm && (
              <div style={{ color: T.textDim, fontSize: 12, textAlign: "center", padding: "8px 0" }}>No adjustments — add unexpected income or expenses</div>
            )}
            {showAdjForm && (
              <div style={{
                background: T.surface, borderRadius: T.radiusSm, padding: 14,
                border: `1px solid ${T.border}`, marginTop: 8,
              }}>
                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                  {["expense", "income"].map(t => (
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
            {goals.filter(g => g.is_active).map(goal => (
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
                  <span style={{
                    color: T.textMuted, fontSize: 13,
                    textDecoration: isPaidEarly ? "line-through" : "none"
                  }}>{bill.name}</span>
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
                    <span onClick={() => { setEditingBill(bill.id); setEditingBillPK(nextPeriodKey); }}
                      style={{ color: T.amber, fontSize: 14, cursor: "pointer", padding: "2px 4px" }}
                    >✏️</span>
                  )}
                  {nAlloc.actual != null && isVariable && !isFromCurrentDefer && !isFromCurrentSplit && !isPaidEarly && (
                    <span onClick={() => updateActual(bill.id, "", nextPeriodKey)}
                      style={{
                        color: T.textDim, fontSize: 10, cursor: "pointer", padding: "2px 6px",
                        background: T.border, borderRadius: 10, fontWeight: 500, fontFamily: T.font,
                      }}>↩</span>
                  )}
                  {hasPrepay && (
                    <span onClick={() => undoPayEarly(bill.id)}
                      style={{
                        color: T.textDim, fontSize: 10, cursor: "pointer", padding: "2px 6px",
                        background: T.border, borderRadius: 10, fontWeight: 500, fontFamily: T.font,
                      }}>↩</span>
                  )}
                  {!isPaidEarly && !isFromCurrentDefer && !isFromCurrentSplit && !periodAlloc[bill.id]?.prepayAmount && (
                    <span onClick={(e) => { e.stopPropagation(); setPrepayBill(bill); setPrepayValue(""); }}
                      style={{
                        color: T.green, fontSize: 10, cursor: "pointer", padding: "3px 8px",
                        background: T.greenDim, borderRadius: 12, fontWeight: 600, fontFamily: T.font,
                        transition: "opacity 0.15s", whiteSpace: "nowrap",
                      }}
                      onMouseEnter={e => e.target.style.opacity = "0.7"}
                      onMouseLeave={e => e.target.style.opacity = "1"}
                    >← Pay Early</span>
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
                  {fmt(Math.max(...periodHistory.map(h => h.saved)))}
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
              <span style={{ color: T.green, fontSize: 14, fontWeight: 600, fontFamily: T.mono }}>
                +{fmt(entry.saved)}
              </span>
            </div>
          ))}
        </Card>
      )}

      <Modal open={!!editingBill} onClose={() => setEditingBill(null)} title="Update Actual Amount">
        {editingBill && (() => {
          const bill = bills.find(b => b.id === editingBill);
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
        {splittingBill && (() => {
          const remainder = (splittingBill.amount - (Number(splitValue) || 0));
          return (
            <div>
              <div style={{ color: T.textMuted, fontSize: 12, marginBottom: 16 }}>
                Split <strong style={{ color: T.text }}>{splittingBill.name}</strong> ({fmt(splittingBill.amount)}) across two pay periods.
              </div>
              <Input label="PAY THIS PERIOD" type="number" placeholder="0.00"
                value={splitValue} onChange={(v) => setSplitValue(v)} />
              <div style={{
                background: T.surface, borderRadius: T.radiusSm, padding: "12px 14px",
                border: `1px solid ${T.border}`, marginBottom: 16,
              }}>
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
        {prepayBill && (() => {
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
              <Input label="PAY A PARTIAL AMOUNT NOW" type="number" placeholder="0.00"
                value={prepayValue} onChange={(v) => setPrepayValue(v)} />
              <div style={{
                background: T.surface, borderRadius: T.radiusSm, padding: "12px 14px",
                border: `1px solid ${T.border}`, marginBottom: 16,
              }}>
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

// ─── SCREEN: BILLS ───
function BillsScreen({ bills, setBills }) {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name: "", bill_type: "fixed", amount: "", due_day: "", frequency: "monthly", quarter_months: "1,4,7,10", annual_month: "1" });

  const openAdd = () => { setForm({ name: "", bill_type: "fixed", amount: "", due_day: "", frequency: "monthly", quarter_months: "1,4,7,10", annual_month: "1" }); setModal("add"); };
  const openEdit = (bill) => { setForm({ ...bill, amount: String(bill.amount), due_day: String(bill.due_day), annual_month: String(bill.annual_month) }); setModal(bill.id); };

  const save = () => {
    if (!form.name || !form.amount || !form.due_day) return;
    const data = { ...form, amount: Number(form.amount), due_day: Number(form.due_day), annual_month: Number(form.annual_month), is_active: true };
    if (modal === "add") {
      setBills(prev => [...prev, { ...data, id: uuid() }]);
    } else {
      setBills(prev => prev.map(b => b.id === modal ? { ...b, ...data } : b));
    }
    setModal(null);
  };

  const remove = (id) => { setBills(prev => prev.filter(b => b.id !== id)); setModal(null); };
  const monthlyTotal = bills.filter(b => b.is_active && b.frequency === "monthly").reduce((s, b) => s + b.amount, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ color: T.text, fontSize: 18, fontWeight: 600 }}>Bills</div>
        <Btn onClick={openAdd}>+ Add Bill</Btn>
      </div>

      <Card style={{ background: T.accentDim, border: `1px solid ${T.accentSoft}` }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ color: T.textMuted, fontSize: 11, marginBottom: 2 }}>Monthly Total</div>
          <span style={{ color: T.accent, fontSize: 24, fontWeight: 700, fontFamily: T.mono }}>{fmt(monthlyTotal)}</span>
        </div>
      </Card>

      {bills.filter(b => b.is_active).map(bill => (
        <Card key={bill.id} onClick={() => openEdit(bill)} style={{ cursor: "pointer" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: T.text, fontSize: 14, fontWeight: 500 }}>{bill.name}</span>
                {bill.bill_type === "variable" && <Badge text="Variable" color={T.amber} bg={T.amberDim} />}
              </div>
              <div style={{ color: T.textDim, fontSize: 11, marginTop: 3 }}>
                Due day {bill.due_day} · {bill.frequency}
                {bill.frequency === "quarterly" && ` · Months: ${bill.quarter_months}`}
                {bill.frequency === "annual" && ` · Month ${bill.annual_month}`}
              </div>
            </div>
            <div style={{ color: T.text, fontSize: 16, fontWeight: 600, fontFamily: T.mono }}>{fmt(bill.amount)}</div>
          </div>
        </Card>
      ))}

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === "add" ? "Add Bill" : "Edit Bill"}>
        <Input label="NAME" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="e.g. Rent" />
        <Select label="TYPE" value={form.bill_type} onChange={v => setForm(f => ({ ...f, bill_type: v }))}
          options={[{ value: "fixed", label: "Fixed (same every time)" }, { value: "variable", label: "Variable (estimated)" }]} />
        <Input label={form.bill_type === "variable" ? "ESTIMATED AMOUNT" : "AMOUNT"} type="number" value={form.amount} onChange={v => setForm(f => ({ ...f, amount: v }))} placeholder="0.00" />
        <Input label="DUE DAY OF MONTH" type="number" value={form.due_day} onChange={v => setForm(f => ({ ...f, due_day: v }))} placeholder="1-31" />
        <Select label="FREQUENCY" value={form.frequency} onChange={v => setForm(f => ({ ...f, frequency: v }))}
          options={[{ value: "monthly", label: "Monthly" }, { value: "quarterly", label: "Quarterly" }, { value: "annual", label: "Annual" }]} />
        {form.frequency === "quarterly" && (
          <Input label="QUARTER MONTHS (comma-separated)" value={form.quarter_months} onChange={v => setForm(f => ({ ...f, quarter_months: v }))} placeholder="1,4,7,10" />
        )}
        {form.frequency === "annual" && (
          <Input label="ANNUAL MONTH (1-12)" type="number" value={form.annual_month} onChange={v => setForm(f => ({ ...f, annual_month: v }))} placeholder="1" />
        )}
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <Btn full color="#fff" bg={T.accent} onClick={save}>Save</Btn>
          {modal !== "add" && <Btn color={T.red} onClick={() => remove(modal)}>Delete</Btn>}
        </div>
      </Modal>
    </div>
  );
}

// ─── SCREEN: SAVINGS ───
function SavingsScreen({ goals, setGoals }) {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name: "", icon: "🎯", target_amount: "", current_balance: "", per_check_amount: "" });

  const openAdd = () => { setForm({ name: "", icon: "🎯", target_amount: "", current_balance: "0", per_check_amount: "" }); setModal("add"); };
  const openEdit = (g) => { setForm({ ...g, target_amount: String(g.target_amount), current_balance: String(g.current_balance), per_check_amount: String(g.per_check_amount) }); setModal(g.id); };

  const save = () => {
    if (!form.name || !form.target_amount || !form.per_check_amount) return;
    const data = { ...form, target_amount: Number(form.target_amount), current_balance: Number(form.current_balance || 0), per_check_amount: Number(form.per_check_amount), is_active: true };
    if (modal === "add") {
      setGoals(prev => [...prev, { ...data, id: uuid() }]);
    } else {
      setGoals(prev => prev.map(g => g.id === modal ? { ...g, ...data } : g));
    }
    setModal(null);
  };

  const remove = (id) => { setGoals(prev => prev.filter(g => g.id !== id)); setModal(null); };
  const totalPerCheck = goals.filter(g => g.is_active).reduce((s, g) => s + g.per_check_amount, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ color: T.text, fontSize: 18, fontWeight: 600 }}>Savings Goals</div>
        <Btn color={T.green} onClick={openAdd}>+ Add Goal</Btn>
      </div>

      <Card style={{ background: T.greenDim, border: `1px solid rgba(74,222,128,0.2)` }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ color: T.textMuted, fontSize: 11, marginBottom: 2 }}>Per Paycheck</div>
          <span style={{ color: T.green, fontSize: 24, fontWeight: 700, fontFamily: T.mono }}>{fmt(totalPerCheck)}</span>
        </div>
      </Card>

      {goals.filter(g => g.is_active).map(goal => {
        const p = pct(goal.current_balance, goal.target_amount);
        const left = goal.target_amount - goal.current_balance;
        const checks = goal.per_check_amount > 0 ? Math.ceil(left / goal.per_check_amount) : Infinity;
        return (
          <Card key={goal.id} onClick={() => openEdit(goal)} style={{ cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <div>
                <span style={{ fontSize: 22, marginRight: 8 }}>{goal.icon}</span>
                <span style={{ color: T.text, fontSize: 15, fontWeight: 600 }}>{goal.name}</span>
                <div style={{ color: T.textDim, fontSize: 11, marginTop: 3 }}>{fmt(goal.per_check_amount)}/check</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: T.text, fontSize: 18, fontWeight: 700, fontFamily: T.mono }}>{fmt(goal.current_balance)}</div>
                <div style={{ color: T.textDim, fontSize: 11 }}>of {fmt(goal.target_amount)}</div>
              </div>
            </div>
            <ProgressBar value={p} color={T.green} height={8} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
              <span style={{ color: T.textDim, fontSize: 10 }}>{p}% complete</span>
              <span style={{ color: T.textDim, fontSize: 10 }}>{checks === Infinity ? "—" : `~${checks} paychecks to go`}</span>
            </div>
          </Card>
        );
      })}

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === "add" ? "Add Goal" : "Edit Goal"}>
        <Input label="NAME" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="e.g. Emergency Fund" />
        <Input label="ICON (emoji)" value={form.icon} onChange={v => setForm(f => ({ ...f, icon: v }))} placeholder="🎯" />
        <Input label="TARGET AMOUNT" type="number" value={form.target_amount} onChange={v => setForm(f => ({ ...f, target_amount: v }))} placeholder="10000" />
        <Input label="CURRENT BALANCE" type="number" value={form.current_balance} onChange={v => setForm(f => ({ ...f, current_balance: v }))} placeholder="0" />
        <Input label="PER PAYCHECK CONTRIBUTION" type="number" value={form.per_check_amount} onChange={v => setForm(f => ({ ...f, per_check_amount: v }))} placeholder="200" />
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <Btn full color="#fff" bg={T.green} onClick={save}>Save</Btn>
          {modal !== "add" && <Btn color={T.red} onClick={() => remove(modal)}>Delete</Btn>}
        </div>
      </Modal>
    </div>
  );
}

// ─── SCREEN: CALENDAR ───
function CalendarScreen({ settings, bills }) {
  const periods = useMemo(() => getPayPeriods(settings.first_pay_date, 6), [settings.first_pay_date]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ color: T.text, fontSize: 18, fontWeight: 600 }}>Pay Period Calendar</div>
      <div style={{ color: T.textMuted, fontSize: 12 }}>Bills mapped to upcoming pay periods.</div>

      {periods.map((period, pi) => {
        const pBills = bills.filter(b => b.is_active && billFallsInPeriod(b, period.start, period.end));
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

// ─── SCREEN: SETTINGS ───
function SettingsScreen({ settings, setSettings, onReset }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ color: T.text, fontSize: 18, fontWeight: 600 }}>Settings</div>
      <Card>
        <Input label="NET PAY (per paycheck)" type="number" value={String(settings.default_net_pay)}
          onChange={v => setSettings(s => ({ ...s, default_net_pay: Number(v) || 0 }))} />
        <Input label="FIRST PAY DATE (anchor)" type="date" value={settings.first_pay_date}
          onChange={v => setSettings(s => ({ ...s, first_pay_date: v }))} />
        <div style={{ color: T.textDim, fontSize: 11, marginTop: 4, lineHeight: 1.5 }}>
          The anchor date is used to calculate all pay periods. Set it to any past or future payday — the system computes every 14-day cycle from this date.
        </div>
      </Card>
      <Card>
        <div style={{ color: T.textMuted, fontSize: 11, fontWeight: 600, letterSpacing: 0.5, marginBottom: 8 }}>DATA</div>
        <div style={{ color: T.textDim, fontSize: 12, lineHeight: 1.6, marginBottom: 12 }}>
          All data is stored in your browser's localStorage. It persists between sessions but is tied to this browser.
        </div>
        <Btn color={T.red} onClick={onReset}>Reset All Data</Btn>
      </Card>
      <Card>
        <div style={{ color: T.textMuted, fontSize: 11, fontWeight: 600, letterSpacing: 0.5, marginBottom: 8 }}>ABOUT</div>
        <div style={{ color: T.textDim, fontSize: 12, lineHeight: 1.6 }}>
          Paycheck Planner v1.0 MVP. Built with React + Vite.
        </div>
      </Card>
    </div>
  );
}

// ─── MAIN APP ───
export default function App() {
  const saved = useMemo(() => loadData(), []);
  const [settings, setSettings] = useState(saved?.settings || DEFAULT_SETTINGS);
  const [bills, setBills] = useState(saved?.bills || DEFAULT_BILLS);
  const [goals, setGoals] = useState(saved?.goals || DEFAULT_GOALS);
  const [allocations, setAllocations] = useState(saved?.allocations || {});
  const [periodHistory, setPeriodHistory] = useState(saved?.periodHistory || []);
  const [screen, setScreen] = useState("dashboard");

  // Persist on every change
  useEffect(() => {
    saveData({ settings, bills, goals, allocations, periodHistory });
  }, [settings, bills, goals, allocations, periodHistory]);

  const handleReset = () => {
    if (window.confirm("Reset all data to defaults? This cannot be undone.")) {
      setSettings(DEFAULT_SETTINGS);
      setBills(DEFAULT_BILLS);
      setGoals(DEFAULT_GOALS);
      setAllocations({});
      setPeriodHistory([]);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const screens = {
    dashboard: { icon: "📊", label: "Payday" },
    bills: { icon: "📋", label: "Bills" },
    savings: { icon: "🎯", label: "Savings" },
    calendar: { icon: "📅", label: "Calendar" },
    settings: { icon: "⚙️", label: "Settings" },
  };

  return (
    <>
      <link href={fontLink} rel="stylesheet" />
      <style>{`
        * { box-sizing: border-box; margin: 0; }
        body { background: ${T.bg}; margin: 0; }
        input::-webkit-outer-spin-button, input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 4px; }
      `}</style>
      <div style={{
        fontFamily: T.font, background: T.bg, color: T.text,
        minHeight: "100vh", display: "flex", justifyContent: "center",
      }}>
        <div style={{ width: "100%", maxWidth: 440, position: "relative", paddingBottom: 72 }}>
          <div style={{
            padding: "16px 20px 12px", display: "flex", justifyContent: "space-between",
            alignItems: "center", position: "sticky", top: 0, background: T.bg, zIndex: 20,
            borderBottom: `1px solid ${T.border}`,
          }}>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.3 }}>Paycheck Planner</div>
            <Badge text="v1.0" color={T.accent} bg={T.accentDim} />
          </div>

          <div style={{ padding: "16px 18px 20px" }}>
            {screen === "dashboard" && <DashboardScreen settings={settings} bills={bills} goals={goals} allocations={allocations} setAllocations={setAllocations} periodHistory={periodHistory} setPeriodHistory={setPeriodHistory} />}
            {screen === "bills" && <BillsScreen bills={bills} setBills={setBills} />}
            {screen === "savings" && <SavingsScreen goals={goals} setGoals={setGoals} />}
            {screen === "calendar" && <CalendarScreen settings={settings} bills={bills} />}
            {screen === "settings" && <SettingsScreen settings={settings} setSettings={setSettings} onReset={handleReset} />}
          </div>

          <div style={{
            position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
            width: "100%", maxWidth: 440, background: T.card,
            borderTop: `1px solid ${T.border}`, display: "flex",
            justifyContent: "space-around", padding: "6px 0 10px", zIndex: 20,
          }}>
            {Object.entries(screens).map(([key, { icon, label }]) => (
              <button key={key} onClick={() => setScreen(key)} style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                background: "none", border: "none", cursor: "pointer", padding: "6px 12px",
                color: screen === key ? T.accent : T.textDim, fontFamily: T.font,
                fontSize: 10, fontWeight: screen === key ? 600 : 400, transition: "color 0.15s",
              }}>
                <span style={{ fontSize: 18 }}>{icon}</span>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
