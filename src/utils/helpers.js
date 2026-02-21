// ─── UTILITY FUNCTIONS ───

/** Generate a unique ID. */
export const uuid = () =>
    crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);

/** Format a number as USD currency. */
export const fmt = (n) => {
    const num = Number(n) || 0;
    return num.toLocaleString("en-US", { style: "currency", currency: "USD" });
};

/** Calculate percentage (capped at 100). */
export const pct = (c, t) =>
    t > 0 ? Math.min(100, Math.round((c / t) * 100)) : 0;

/** Compute pay periods based on an anchor date. */
export function getPayPeriods(firstPayDate, count = 6) {
    const periods = [];
    const anchor = new Date(firstPayDate + "T00:00:00");
    const now = new Date();
    let start = new Date(anchor);
    while (start > now) start.setDate(start.getDate() - 14);
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

/** Check whether a bill's due date falls within a pay period. */
export function billFallsInPeriod(bill, periodStart, periodEnd) {
    if (!bill.is_active) return false;
    const dueDay = bill.due_day;

    if (bill.frequency === "quarterly") {
        const months = (bill.quarter_months || "1,4,7,10").split(",").map(Number);
        for (const m of months) {
            const dueDate = new Date(
                periodStart.getFullYear(),
                m - 1,
                Math.min(dueDay, 28),
            );
            if (dueDate >= periodStart && dueDate <= periodEnd) return true;
        }
        return false;
    }
    if (bill.frequency === "annual") {
        const m = bill.annual_month || 1;
        const dueDate = new Date(
            periodStart.getFullYear(),
            m - 1,
            Math.min(dueDay, 28),
        );
        return dueDate >= periodStart && dueDate <= periodEnd;
    }
    let dueDate = new Date(
        periodStart.getFullYear(),
        periodStart.getMonth(),
        Math.min(dueDay, 28),
    );
    if (dueDate >= periodStart && dueDate <= periodEnd) return true;
    dueDate = new Date(
        periodEnd.getFullYear(),
        periodEnd.getMonth(),
        Math.min(dueDay, 28),
    );
    if (dueDate >= periodStart && dueDate <= periodEnd) return true;
    return false;
}

/** Validate bill form fields. Returns an object of field → error message. */
export function validateBillForm(form) {
    const errors = {};
    if (!form.name || !form.name.trim()) errors.name = "Name is required";
    const amount = Number(form.amount);
    if (!form.amount || amount <= 0) errors.amount = "Amount must be greater than 0";
    const dueDay = Number(form.due_day);
    if (!form.due_day || dueDay < 1 || dueDay > 31 || !Number.isInteger(dueDay))
        errors.due_day = "Due day must be 1–31";
    return errors;
}

/** Validate savings goal form fields. */
export function validateGoalForm(form) {
    const errors = {};
    if (!form.name || !form.name.trim()) errors.name = "Name is required";
    if (!form.target_amount || Number(form.target_amount) <= 0)
        errors.target_amount = "Target must be greater than 0";
    if (!form.per_check_amount || Number(form.per_check_amount) <= 0)
        errors.per_check_amount = "Per-check amount must be greater than 0";
    return errors;
}

/** Debounce a function by `delay` milliseconds. */
export function debounce(fn, delay) {
    let timer = null;
    const debounced = (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
    debounced.cancel = () => clearTimeout(timer);
    debounced.flush = (...args) => {
        clearTimeout(timer);
        fn(...args);
    };
    return debounced;
}
