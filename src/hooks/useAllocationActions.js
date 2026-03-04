import { useCallback } from "react";
import { useApp } from "../context/AppContext";

/**
 * Custom hook that provides all allocation mutation actions.
 * Keeps DashboardScreen focused on rendering.
 *
 * When a bill is deferred, split, or paid early, this hook also writes
 * the carryover data into nextPeriodKey's allocation so it persists
 * through Firestore/localStorage and survives period transitions.
 */
export function useAllocationActions(periodKey, nextPeriodKey) {
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

    // ─── DEFER: move bill to next period ───
    const deferBill = useCallback((billId, bill, targetPK = periodKey) => {
        setAllocations((prev) => {
            const pk = { ...prev };
            // Mark as deferred in current period
            const pa = { ...(pk[targetPK] || {}) };
            pa[billId] = { ...pa[billId], deferred: true, paid: false, splitAmount: undefined };
            pk[targetPK] = pa;
            // Write carryover entry into next period so it persists across transitions
            if (nextPeriodKey) {
                const na = { ...(pk[nextPeriodKey] || {}) };
                na[billId] = {
                    ...(na[billId] || {}),
                    planned: bill.amount,
                    actual: bill.bill_type === "fixed" ? bill.amount : null,
                    paid: false,
                    _deferredFrom: targetPK,
                };
                pk[nextPeriodKey] = na;
            }
            return pk;
        });
    }, [periodKey, nextPeriodKey, setAllocations]);

    const undoDefer = useCallback((billId, targetPK = periodKey) => {
        setAllocations((prev) => {
            const pk = { ...prev };
            const pa = { ...(pk[targetPK] || {}) };
            pa[billId] = { ...pa[billId], deferred: false };
            pk[targetPK] = pa;
            // Clean up the carryover entry in next period
            if (nextPeriodKey && pk[nextPeriodKey]?.[billId]?._deferredFrom) {
                const na = { ...(pk[nextPeriodKey] || {}) };
                const updated = { ...na[billId] };
                delete updated._deferredFrom;
                // If this entry only existed because of the deferral, remove it entirely
                if (!updated.paid && !updated._splitRemainder && !updated._paidEarlyFrom) {
                    delete na[billId];
                } else {
                    na[billId] = updated;
                }
                pk[nextPeriodKey] = na;
            }
            return pk;
        });
    }, [periodKey, nextPeriodKey, setAllocations]);

    // ─── SPLIT: pay part now, remainder next period ───
    const splitBill = useCallback((billId, splitAmount, bill, targetPK = periodKey) => {
        const remainder = bill.amount - Number(splitAmount);
        setAllocations((prev) => {
            const pk = { ...prev };
            // Set split amount in current period
            const pa = { ...(pk[targetPK] || {}) };
            pa[billId] = { ...pa[billId], splitAmount: Number(splitAmount), deferred: false };
            pk[targetPK] = pa;
            // Write remainder into next period
            if (nextPeriodKey) {
                const na = { ...(pk[nextPeriodKey] || {}) };
                na[billId] = {
                    ...(na[billId] || {}),
                    planned: remainder,
                    actual: bill.bill_type === "fixed" ? remainder : null,
                    paid: false,
                    _splitRemainder: remainder,
                    _splitFrom: targetPK,
                };
                pk[nextPeriodKey] = na;
            }
            return pk;
        });
    }, [periodKey, nextPeriodKey, setAllocations]);

    const undoSplit = useCallback((billId, targetPK = periodKey) => {
        setAllocations((prev) => {
            const pk = { ...prev };
            const pa = { ...(pk[targetPK] || {}) };
            const updated = { ...pa[billId] };
            delete updated.splitAmount;
            pa[billId] = updated;
            pk[targetPK] = pa;
            // Clean up the carryover entry in next period
            if (nextPeriodKey && pk[nextPeriodKey]?.[billId]?._splitFrom) {
                const na = { ...(pk[nextPeriodKey] || {}) };
                const nUpdated = { ...na[billId] };
                delete nUpdated._splitRemainder;
                delete nUpdated._splitFrom;
                if (!nUpdated.paid && !nUpdated._deferredFrom && !nUpdated._paidEarlyFrom) {
                    delete na[billId];
                } else {
                    na[billId] = nUpdated;
                }
                pk[nextPeriodKey] = na;
            }
            return pk;
        });
    }, [periodKey, nextPeriodKey, setAllocations]);

    // ─── PAY EARLY: pay a next-period bill from this period ───
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
            // Write into next period so it knows about the prepayment
            if (nextPeriodKey) {
                const na = { ...(pk[nextPeriodKey] || {}) };
                if (prepayAmount != null && prepayAmount < bill.amount) {
                    // Partial prepay: next period owes the remainder
                    const remainder = bill.amount - Number(prepayAmount);
                    na[billId] = {
                        ...(na[billId] || {}),
                        planned: remainder,
                        actual: bill.bill_type === "fixed" ? remainder : null,
                        paid: false,
                        _paidEarlyFrom: periodKey,
                        _prepaidAmount: Number(prepayAmount),
                    };
                } else {
                    // Full prepay: mark as already paid in next period
                    na[billId] = {
                        ...(na[billId] || {}),
                        planned: 0,
                        actual: 0,
                        paid: true,
                        _paidEarlyFull: true,
                        _paidEarlyFrom: periodKey,
                    };
                }
                pk[nextPeriodKey] = na;
            }
            return pk;
        });
    }, [periodKey, nextPeriodKey, setAllocations]);

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
            // Clean up next period entry
            if (nextPeriodKey && pk[nextPeriodKey]?.[billId]?._paidEarlyFrom) {
                const na = { ...(pk[nextPeriodKey] || {}) };
                const nUpdated = { ...na[billId] };
                delete nUpdated._paidEarlyFull;
                delete nUpdated._paidEarlyFrom;
                delete nUpdated._prepaidAmount;
                // Restore to natural bill amount
                nUpdated.planned = nUpdated._originalPlanned || nUpdated.planned;
                nUpdated.paid = false;
                if (!nUpdated._deferredFrom && !nUpdated._splitFrom) {
                    // Reset to default
                    delete na[billId];
                } else {
                    na[billId] = nUpdated;
                }
                pk[nextPeriodKey] = na;
            }
            return pk;
        });
    }, [periodKey, nextPeriodKey, setAllocations]);

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

