import { useState, useEffect, useMemo, useCallback } from "react";
import { useApp } from "../context/AppContext";
import { getPayPeriods, billFallsInPeriod } from "../utils/helpers";

/**
 * Custom hook that encapsulates all pay-period and bill calculation logic.
 * Returns derived data (totals, period bills, flags) from raw state.
 *
 * Carryover data (deferred, split, paid-early) is materialized into each
 * period's allocation by useAllocationActions, so this hook simply reads
 * the markers to include/exclude/adjust bills.
 */
export function usePeriodCalculations() {
    const { settings, bills, goals, allocations } = useApp();

    const periods = useMemo(() => getPayPeriods(settings.first_pay_date, 6), [settings.first_pay_date]);
    const currentPeriod = periods.find((p) => p.isCurrent) || periods[2];
    const currentIdx = periods.indexOf(currentPeriod);
    const nextPeriod = currentIdx < periods.length - 1 ? periods[currentIdx + 1] : null;
    const prevPeriod = currentIdx > 0 ? periods[currentIdx - 1] : null;

    const periodKey = currentPeriod.start.toISOString().slice(0, 10);
    const nextPeriodKey = nextPeriod ? nextPeriod.start.toISOString().slice(0, 10) : null;
    const prevPeriodKey = prevPeriod ? prevPeriod.start.toISOString().slice(0, 10) : null;
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

    // ─── CARRYOVER BILLS ───
    // Bills that have carryover markers in the current period's allocation
    // (written by useAllocationActions when defer/split/payEarly was performed in the prev period)
    const carriedOverBills = useMemo(() => {
        const carried = [];
        const activeBills = bills.filter((b) => b.is_active);
        for (const bill of activeBills) {
            const a = periodAlloc[bill.id];
            if (!a) continue;
            const alreadyInBase = basePeriodBills.some((b) => b.id === bill.id);
            if (alreadyInBase) continue;

            if (a._deferredFrom) {
                carried.push({ ...bill, _carryoverType: "deferred" });
            } else if (a._splitRemainder != null) {
                carried.push({ ...bill, _carryoverType: "split", _splitRemainder: a._splitRemainder });
            }
            // _paidEarlyFull bills are already marked as paid, they won't appear
        }
        return carried;
    }, [bills, periodAlloc, basePeriodBills]);

    // Effective current period bills: exclude deferred, include paidEarly from next period, include carryovers
    const paidEarlyBills = baseNextPeriodBills.filter((b) => periodAlloc[b.id]?.paidEarly);
    const periodBills = useMemo(() => {
        const nonDeferred = basePeriodBills.filter((b) => !periodAlloc[b.id]?.deferred);
        // Exclude bills that were fully paid early from a previous period
        const nonPaidEarlyFull = nonDeferred.filter((b) => !periodAlloc[b.id]?._paidEarlyFull);
        const extras = paidEarlyBills.filter((b) => !nonPaidEarlyFull.some((nb) => nb.id === b.id));
        // Add carried-over bills (deferred/split from prev period, not already present)
        const carryExtras = carriedOverBills.filter((b) => !nonPaidEarlyFull.some((nb) => nb.id === b.id));
        return [...nonPaidEarlyFull, ...extras, ...carryExtras];
    }, [basePeriodBills, periodAlloc, paidEarlyBills, carriedOverBills]);

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

    // ─── TOTALS ───
    const getBillAmount = useCallback((bill) => {
        const a = periodAlloc[bill.id];

        // Carryover bill from previous period — use the persisted planned/actual amounts
        if (bill._carryoverType === "split") {
            if (a?.actual != null) return Number(a.actual);
            return a?._splitRemainder ?? bill._splitRemainder;
        }
        if (bill._carryoverType === "deferred") {
            if (a?.actual != null) return Number(a.actual);
            return a?.planned ?? bill.amount;
        }

        // Bill with partial prepay from prev period
        if (a?._paidEarlyFrom && a?._prepaidAmount != null) {
            if (a.actual != null) return Number(a.actual);
            return a.planned ?? (bill.amount - a._prepaidAmount);
        }

        if (!a) return bill.amount;
        if (a.deferred) return 0;
        if (a.splitAmount != null) return a.splitAmount;
        if (a.paidEarly && a.prepayAmount != null) return a.prepayAmount;
        return a.actual ?? a.planned ?? bill.amount;
    }, [periodAlloc]);

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
    const getNextBillAmount = useCallback((bill) => {
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
    }, [periodAlloc, nextPeriodAlloc]);

    const nextBillsTotal = displayNextPeriodBills.reduce((s, b) => s + getNextBillAmount(b), 0);

    return {
        periods, currentPeriod, nextPeriod, prevPeriod,
        periodKey, nextPeriodKey, prevPeriodKey,
        periodAlloc, nextPeriodAlloc,
        basePeriodBills, baseNextPeriodBills, carriedOverBills,
        periodBills, displayNextPeriodBills,
        getBillAmount, getNextBillAmount,
        billsTotal, savingsTotal, adjustments, adjustmentsTotal,
        netPay, hasPayOverride, remaining, isOver,
        paidCount, isClosed, nextBillsTotal,
    };
}
