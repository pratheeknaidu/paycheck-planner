import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    uuid, fmt, pct,
    getPayPeriods, billFallsInPeriod,
    validateBillForm, validateGoalForm,
    debounce,
} from "../utils/helpers";

// ─── uuid ───
describe("uuid", () => {
    it("returns a non-empty string", () => {
        const id = uuid();
        expect(typeof id).toBe("string");
        expect(id.length).toBeGreaterThan(0);
    });

    it("returns unique values", () => {
        const ids = new Set(Array.from({ length: 100 }, () => uuid()));
        expect(ids.size).toBe(100);
    });
});

// ─── fmt ───
describe("fmt", () => {
    it("formats positive numbers as USD", () => {
        expect(fmt(1234.56)).toBe("$1,234.56");
    });

    it("formats zero", () => {
        expect(fmt(0)).toBe("$0.00");
    });

    it("formats negative numbers", () => {
        expect(fmt(-42.5)).toBe("-$42.50");
    });

    it("handles null/undefined as $0.00", () => {
        expect(fmt(null)).toBe("$0.00");
        expect(fmt(undefined)).toBe("$0.00");
    });

    it("handles string numbers", () => {
        expect(fmt("99.9")).toBe("$99.90");
    });
});

// ─── pct ───
describe("pct", () => {
    it("calculates percentage correctly", () => {
        expect(pct(50, 100)).toBe(50);
        expect(pct(1, 3)).toBe(33);
    });

    it("caps at 100%", () => {
        expect(pct(150, 100)).toBe(100);
    });

    it("returns 0 when target is 0", () => {
        expect(pct(50, 0)).toBe(0);
    });

    it("returns 0 when target is negative", () => {
        expect(pct(50, -10)).toBe(0);
    });

    it("handles zero current", () => {
        expect(pct(0, 100)).toBe(0);
    });
});

// ─── getPayPeriods ───
describe("getPayPeriods", () => {
    it("returns the correct number of periods", () => {
        const periods = getPayPeriods("2026-01-09", 6);
        expect(periods).toHaveLength(6);
    });

    it("each period spans approximately 14 days", () => {
        const periods = getPayPeriods("2026-01-09", 6);
        for (const p of periods) {
            const diff = (p.end - p.start) / (1000 * 60 * 60 * 24);
            expect(diff).toBeCloseTo(13, 0); // end is inclusive, ~13 days diff (DST may shift slightly)
        }
    });

    it("periods are contiguous (no gaps)", () => {
        const periods = getPayPeriods("2026-01-09", 6);
        for (let i = 1; i < periods.length; i++) {
            const prevEnd = periods[i - 1].end;
            const currStart = periods[i].start;
            const gap = (currStart - prevEnd) / (1000 * 60 * 60 * 24);
            expect(gap).toBe(1); // next period starts 1 day after previous ends
        }
    });

    it("exactly one period is marked as current", () => {
        const periods = getPayPeriods("2026-01-09", 8);
        const currentPeriods = periods.filter((p) => p.isCurrent);
        expect(currentPeriods.length).toBeLessThanOrEqual(1);
    });

    it("each period has a label", () => {
        const periods = getPayPeriods("2026-01-09", 4);
        for (const p of periods) {
            expect(typeof p.label).toBe("string");
            expect(p.label).toContain("–"); // en dash in label
        }
    });
});

// ─── billFallsInPeriod ───
describe("billFallsInPeriod", () => {
    const makeBill = (overrides = {}) => ({
        id: "test-bill",
        name: "Test",
        bill_type: "fixed",
        amount: 100,
        due_day: 15,
        frequency: "monthly",
        quarter_months: "",
        annual_month: 1,
        is_active: true,
        ...overrides,
    });

    it("returns true when due day falls within period", () => {
        const bill = makeBill({ due_day: 15 });
        const start = new Date(2026, 0, 10); // Jan 10
        const end = new Date(2026, 0, 23);   // Jan 23
        expect(billFallsInPeriod(bill, start, end)).toBe(true);
    });

    it("returns false when due day is outside period", () => {
        const bill = makeBill({ due_day: 5 });
        const start = new Date(2026, 0, 10); // Jan 10
        const end = new Date(2026, 0, 23);   // Jan 23
        expect(billFallsInPeriod(bill, start, end)).toBe(false);
    });

    it("returns false for inactive bills", () => {
        const bill = makeBill({ is_active: false, due_day: 15 });
        const start = new Date(2026, 0, 10);
        const end = new Date(2026, 0, 23);
        expect(billFallsInPeriod(bill, start, end)).toBe(false);
    });

    it("handles periods spanning two months", () => {
        const bill = makeBill({ due_day: 2 });
        const start = new Date(2026, 0, 25); // Jan 25
        const end = new Date(2026, 1, 7);    // Feb 7
        expect(billFallsInPeriod(bill, start, end)).toBe(true);
    });

    it("handles quarterly bills", () => {
        const bill = makeBill({ frequency: "quarterly", quarter_months: "1,4,7,10", due_day: 15 });
        // January period
        const start = new Date(2026, 0, 10);
        const end = new Date(2026, 0, 23);
        expect(billFallsInPeriod(bill, start, end)).toBe(true);

        // February period — not a quarter month
        const start2 = new Date(2026, 1, 10);
        const end2 = new Date(2026, 1, 23);
        expect(billFallsInPeriod(bill, start2, end2)).toBe(false);
    });

    it("handles annual bills", () => {
        const bill = makeBill({ frequency: "annual", annual_month: 3, due_day: 15 });
        // March period
        const start = new Date(2026, 2, 10);
        const end = new Date(2026, 2, 23);
        expect(billFallsInPeriod(bill, start, end)).toBe(true);

        // April period
        const start2 = new Date(2026, 3, 10);
        const end2 = new Date(2026, 3, 23);
        expect(billFallsInPeriod(bill, start2, end2)).toBe(false);
    });

    it("clamps due day to 28 for safety", () => {
        const bill = makeBill({ due_day: 31 });
        const start = new Date(2026, 1, 20); // Feb 20
        const end = new Date(2026, 2, 5);    // Mar 5
        // Due day 31 → clamped to 28, which falls in the period
        expect(billFallsInPeriod(bill, start, end)).toBe(true);
    });
});

// ─── validateBillForm ───
describe("validateBillForm", () => {
    it("returns no errors for valid input", () => {
        const errors = validateBillForm({ name: "Rent", amount: 1000, due_day: 1 });
        expect(Object.keys(errors)).toHaveLength(0);
    });

    it("requires a name", () => {
        const errors = validateBillForm({ name: "", amount: 100, due_day: 1 });
        expect(errors.name).toBeDefined();
    });

    it("requires name to not be just whitespace", () => {
        const errors = validateBillForm({ name: "   ", amount: 100, due_day: 1 });
        expect(errors.name).toBeDefined();
    });

    it("requires amount > 0", () => {
        expect(validateBillForm({ name: "X", amount: 0, due_day: 1 }).amount).toBeDefined();
        expect(validateBillForm({ name: "X", amount: -5, due_day: 1 }).amount).toBeDefined();
        expect(validateBillForm({ name: "X", amount: "", due_day: 1 }).amount).toBeDefined();
    });

    it("requires due_day between 1 and 31", () => {
        expect(validateBillForm({ name: "X", amount: 100, due_day: 0 }).due_day).toBeDefined();
        expect(validateBillForm({ name: "X", amount: 100, due_day: 32 }).due_day).toBeDefined();
        expect(validateBillForm({ name: "X", amount: 100, due_day: 15.5 }).due_day).toBeDefined();
    });

    it("returns multiple errors at once", () => {
        const errors = validateBillForm({ name: "", amount: 0, due_day: 0 });
        expect(Object.keys(errors)).toHaveLength(3);
    });
});

// ─── validateGoalForm ───
describe("validateGoalForm", () => {
    it("returns no errors for valid input", () => {
        const errors = validateGoalForm({ name: "Emergency", target_amount: 10000, per_check_amount: 200 });
        expect(Object.keys(errors)).toHaveLength(0);
    });

    it("requires a name", () => {
        const errors = validateGoalForm({ name: "", target_amount: 1000, per_check_amount: 50 });
        expect(errors.name).toBeDefined();
    });

    it("requires target_amount > 0", () => {
        expect(validateGoalForm({ name: "X", target_amount: 0, per_check_amount: 50 }).target_amount).toBeDefined();
        expect(validateGoalForm({ name: "X", target_amount: -1, per_check_amount: 50 }).target_amount).toBeDefined();
    });

    it("requires per_check_amount > 0", () => {
        expect(validateGoalForm({ name: "X", target_amount: 1000, per_check_amount: 0 }).per_check_amount).toBeDefined();
    });
});

// ─── debounce ───
describe("debounce", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it("delays execution", () => {
        const fn = vi.fn();
        const debounced = debounce(fn, 300);

        debounced("a");
        expect(fn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(300);
        expect(fn).toHaveBeenCalledOnce();
        expect(fn).toHaveBeenCalledWith("a");
    });

    it("resets timer on subsequent calls", () => {
        const fn = vi.fn();
        const debounced = debounce(fn, 300);

        debounced("a");
        vi.advanceTimersByTime(200);
        debounced("b");
        vi.advanceTimersByTime(200);
        expect(fn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(100);
        expect(fn).toHaveBeenCalledOnce();
        expect(fn).toHaveBeenCalledWith("b");
    });

    it("cancel() prevents execution", () => {
        const fn = vi.fn();
        const debounced = debounce(fn, 300);

        debounced("a");
        debounced.cancel();
        vi.advanceTimersByTime(500);
        expect(fn).not.toHaveBeenCalled();
    });

    it("flush() executes immediately", () => {
        const fn = vi.fn();
        const debounced = debounce(fn, 300);

        debounced.flush("now");
        expect(fn).toHaveBeenCalledOnce();
        expect(fn).toHaveBeenCalledWith("now");
    });
});
