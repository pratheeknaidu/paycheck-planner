import { useState, useEffect, useMemo, useCallback } from "react";
import { useApp } from "../context/AppContext";
import { getPayPeriods, billFallsInPeriod } from "../utils/helpers";

/**
 * Custom hook that encapsulates all pay-period and bill calculation logic.
 * Returns derived data (totals, period bills, flags) from raw state.
 *
 * Includes previous-period lookback so that deferred, split, and prepaid
 * bills carry over correctly when a new period becomes current.
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
    const prevPeriodAlloc = prevPeriodKey ? allocations[prevPeriodKey] || {} : {};

    // Base bills for each period (before split/defer/payEarly adjustments)
    const basePeriodBills = useMemo(
        () => bills.filter((b) => b.is_active && billFallsInPeriod(b, currentPeriod.start, currentPeriod.end)),
        [bills, currentPeriod],
    );

    const baseNextPeriodBills = useMemo(
        () => (nextPeriod ? bills.filter((b) => b.is_active && billFallsInPeriod(b, nextPeriod.start, nextPeriod.end)) : []),
        [bills, nextPeriod],
    );

    // ─── CARRYOVER FROM PREVIOUS PERIOD ───
    // Bills that were deferred / split / partially prepaid from the previous period
    // and should appear in the current period even if they don't naturally fall here.
    const carriedOverBills = useMemo(() => {
        if (!prevPeriodKey) return [];
        const carried = [];
        const activeBills = bills.filter((b) => b.is_active);
        for (const bill of activeBills) {
            const pa = prevPeriodAlloc[bill.id];
            if (!pa) continue;
            // Already naturally in this period? Skip — we handle amount adjustment below.
            const alreadyInPeriod = basePeriodBills.some((b) => b.id === bill.id);

            if (pa.deferred && !alreadyInPeriod) {
                carried.push({ ...bill, _carryoverType: "deferred" });
            } else if (pa.splitAmount != null && !alreadyInPeriod) {
                carried.push({ ...bill, _carryoverType: "split", _splitRemainder: bill.amount - pa.splitAmount });
            }
            // Full paidEarly from prev period — bill was already paid, don't carry over
            // Partial prepay — the bill naturally falls in current period; amount adjustment handled in getBillAmount
        }
        return carried;
    }, [prevPeriodKey, prevPeriodAlloc, bills, basePeriodBills]);

    // Effective current period bills: exclude deferred, include paidEarly from next period, include carryovers
    const paidEarlyBills = baseNextPeriodBills.filter((b) => periodAlloc[b.id]?.paidEarly);
    const periodBills = useMemo(() => {
        const nonDeferred = basePeriodBills.filter((b) => !periodAlloc[b.id]?.deferred);
        // Exclude bills that were fully paid early from the previous period
        const nonPaidEarlyFromPrev = nonDeferred.filter((b) => {
            const pa = prevPeriodAlloc[b.id];
            return !(pa?.paidEarly && pa?.prepayAmount == null);
        });
        const extras = paidEarlyBills.filter((b) => !nonPaidEarlyFromPrev.some((nb) => nb.id === b.id));
        // Add carried-over bills (deferred/split from prev period, not already present)
        const carryExtras = carriedOverBills.filter((b) => !nonPaidEarlyFromPrev.some((nb) => nb.id === b.id));
        return [...nonPaidEarlyFromPrev, ...extras, ...carryExtras];
    }, [basePeriodBills, periodAlloc, paidEarlyBills, carriedOverBills, prevPeriodAlloc]);

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

        // Handle carryover bills from previous period
        if (bill._carryoverType === "deferred") {
            // Deferred bill: full amount, unless current period has its own override
            if (a?.actual != null) return Number(a.actual);
            return bill.amount;
        }
        if (bill._carryoverType === "split") {
            // Split remainder from previous period
            if (a?.actual != null) return Number(a.actual);
            return bill._splitRemainder;
        }

        // Handle bills that naturally fall in this period but were partially prepaid from prev period
        const pa = prevPeriodAlloc[bill.id];
        if (pa?.paidEarly && pa?.prepayAmount != null) {
            // Partial prepay: reduce by the prepaid amount
            const base = a?.actual != null ? Number(a.actual) : bill.amount;
            return base - pa.prepayAmount;
        }

        if (!a) return bill.amount;
        if (a.deferred) return 0;
        if (a.splitAmount != null) return a.splitAmount;
        if (a.paidEarly && a.prepayAmount != null) return a.prepayAmount;
        return a.actual ?? a.planned ?? bill.amount;
    }, [periodAlloc, prevPeriodAlloc]);

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
        periodAlloc, nextPeriodAlloc, prevPeriodAlloc,
        basePeriodBills, baseNextPeriodBills, carriedOverBills,
        periodBills, displayNextPeriodBills,
        getBillAmount, getNextBillAmount,
        billsTotal, savingsTotal, adjustments, adjustmentsTotal,
        netPay, hasPayOverride, remaining, isOver,
        paidCount, isClosed, nextBillsTotal,
    };
}
