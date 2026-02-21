import { describe, it, expect } from "vitest";
import { DEFAULT_SETTINGS, DEFAULT_BILLS, DEFAULT_GOALS, STORAGE_KEY } from "../constants/defaults";

describe("DEFAULT_SETTINGS", () => {
    it("has a static ID", () => {
        expect(DEFAULT_SETTINGS.id).toBe("default-settings-001");
    });

    it("has required fields", () => {
        expect(DEFAULT_SETTINGS.default_net_pay).toBeGreaterThan(0);
        expect(DEFAULT_SETTINGS.pay_frequency).toBe("biweekly");
        expect(DEFAULT_SETTINGS.first_pay_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
});

describe("DEFAULT_BILLS", () => {
    it("has 6 default bills", () => {
        expect(DEFAULT_BILLS).toHaveLength(6);
    });

    it("all have static IDs (not random)", () => {
        for (const bill of DEFAULT_BILLS) {
            expect(bill.id).toMatch(/^bill-/);
        }
    });

    it("all have unique IDs", () => {
        const ids = DEFAULT_BILLS.map((b) => b.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it("all bills are active by default", () => {
        for (const bill of DEFAULT_BILLS) {
            expect(bill.is_active).toBe(true);
        }
    });

    it("all have required fields", () => {
        for (const bill of DEFAULT_BILLS) {
            expect(bill.name).toBeTruthy();
            expect(bill.amount).toBeGreaterThan(0);
            expect(bill.due_day).toBeGreaterThanOrEqual(1);
            expect(bill.due_day).toBeLessThanOrEqual(31);
            expect(["fixed", "variable"]).toContain(bill.bill_type);
            expect(["monthly", "quarterly", "annual"]).toContain(bill.frequency);
        }
    });

    it("IDs remain stable across imports (no uuid() at import time)", () => {
        // ID should be a static string, not dynamically generated
        expect(DEFAULT_BILLS[0].id).toBe("bill-rent-001");
        expect(DEFAULT_BILLS[1].id).toBe("bill-electric-002");
    });
});

describe("DEFAULT_GOALS", () => {
    it("has 3 default goals", () => {
        expect(DEFAULT_GOALS).toHaveLength(3);
    });

    it("all have static IDs", () => {
        for (const goal of DEFAULT_GOALS) {
            expect(goal.id).toMatch(/^goal-/);
        }
    });

    it("all have unique IDs", () => {
        const ids = DEFAULT_GOALS.map((g) => g.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it("all goals are active", () => {
        for (const g of DEFAULT_GOALS) {
            expect(g.is_active).toBe(true);
        }
    });

    it("all have required numeric fields", () => {
        for (const g of DEFAULT_GOALS) {
            expect(g.target_amount).toBeGreaterThan(0);
            expect(g.per_check_amount).toBeGreaterThan(0);
            expect(g.current_balance).toBeGreaterThanOrEqual(0);
        }
    });
});

describe("STORAGE_KEY", () => {
    it("is a non-empty string", () => {
        expect(typeof STORAGE_KEY).toBe("string");
        expect(STORAGE_KEY.length).toBeGreaterThan(0);
    });
});
