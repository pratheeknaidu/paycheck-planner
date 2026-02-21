import { useCallback } from "react";
import { useApp } from "../context/AppContext";

/**
 * Custom hook that provides all allocation mutation actions.
 * Keeps DashboardScreen focused on rendering.
 */
export function useAllocationActions(periodKey) {
    const { setAllocations, setPeriodHistory } = useApp();

    const togglePaid = useCallback((billId, targetPK = periodKey) => {
        setAllocations((prev) => {
            const pk = { ...prev };
            const pa = { ...(pk[targetPK] || {}) };
            pa[billId] = { ...pa[billId], paid: !pa[billId]?.paid };
            pk[targetPK] = pa;
            return pk;
        });
    }, [periodKey, setAllocations]);

    const updateActual = useCallback((billId, val, targetPK = periodKey) => {
        setAllocations((prev) => {
            const pk = { ...prev };
            const pa = { ...(pk[targetPK] || {}) };
            pa[billId] = { ...pa[billId], actual: val === "" ? null : Number(val) };
            pk[targetPK] = pa;
            return pk;
        });
    }, [periodKey, setAllocations]);

    const deferBill = useCallback((billId, targetPK = periodKey) => {
        setAllocations((prev) => {
            const pk = { ...prev };
            const pa = { ...(pk[targetPK] || {}) };
            pa[billId] = { ...pa[billId], deferred: true, paid: false, splitAmount: undefined };
            pk[targetPK] = pa;
            return pk;
        });
    }, [periodKey, setAllocations]);

    const undoDefer = useCallback((billId, targetPK = periodKey) => {
        setAllocations((prev) => {
            const pk = { ...prev };
            const pa = { ...(pk[targetPK] || {}) };
            pa[billId] = { ...pa[billId], deferred: false };
            pk[targetPK] = pa;
            return pk;
        });
    }, [periodKey, setAllocations]);

    const splitBill = useCallback((billId, splitAmount, targetPK = periodKey) => {
        setAllocations((prev) => {
            const pk = { ...prev };
            const pa = { ...(pk[targetPK] || {}) };
            pa[billId] = { ...pa[billId], splitAmount: Number(splitAmount), deferred: false };
            pk[targetPK] = pa;
            return pk;
        });
    }, [periodKey, setAllocations]);

    const undoSplit = useCallback((billId, targetPK = periodKey) => {
        setAllocations((prev) => {
            const pk = { ...prev };
            const pa = { ...(pk[targetPK] || {}) };
            const updated = { ...pa[billId] };
            delete updated.splitAmount;
            pa[billId] = updated;
            pk[targetPK] = pa;
            return pk;
        });
    }, [periodKey, setAllocations]);

    const payEarly = useCallback((billId, bill, prepayAmount = null) => {
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
    }, [periodKey, setAllocations]);

    const undoPayEarly = useCallback((billId) => {
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
    }, [periodKey, setAllocations]);

    // ─── ADJUSTMENTS ───
    const addAdjustment = useCallback((label, amount) => {
        setAllocations((prev) => {
            const pk = { ...prev };
            const pa = { ...(pk[periodKey] || {}) };
            const adjs = [...(pa._adjustments || []), { id: Date.now().toString(), label, amount }];
            pa._adjustments = adjs;
            pk[periodKey] = pa;
            return pk;
        });
    }, [periodKey, setAllocations]);

    const removeAdjustment = useCallback((adjId) => {
        setAllocations((prev) => {
            const pk = { ...prev };
            const pa = { ...(pk[periodKey] || {}) };
            pa._adjustments = (pa._adjustments || []).filter((a) => a.id !== adjId);
            pk[periodKey] = pa;
            return pk;
        });
    }, [periodKey, setAllocations]);

    // ─── NET PAY OVERRIDE ───
    const setNetPayOverride = useCallback((val) => {
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
    }, [periodKey, setAllocations]);

    // ─── CLOSE / REOPEN PERIOD ───
    const closePeriod = useCallback((currentPeriod, netPay, billsTotal, savingsTotal, adjustmentsTotal, adjustments, remaining) => {
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
    }, [periodKey, setAllocations, setPeriodHistory]);

    const reopenPeriod = useCallback(() => {
        setPeriodHistory((prev) => prev.filter((h) => h.periodKey !== periodKey));
        setAllocations((prev) => {
            const pk = { ...prev };
            const pa = { ...(pk[periodKey] || {}) };
            delete pa._closed;
            pk[periodKey] = pa;
            return pk;
        });
    }, [periodKey, setAllocations, setPeriodHistory]);

    return {
        togglePaid, updateActual,
        deferBill, undoDefer,
        splitBill, undoSplit,
        payEarly, undoPayEarly,
        addAdjustment, removeAdjustment,
        setNetPayOverride,
        closePeriod, reopenPeriod,
    };
}
