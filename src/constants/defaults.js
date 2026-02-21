import { uuid } from "../utils/helpers";

// ─── DEFAULT DATA ───

export const DEFAULT_SETTINGS = {
    id: uuid(),
    default_net_pay: 2847.5,
    pay_frequency: "biweekly",
    first_pay_date: "2026-01-09",
};

export const DEFAULT_BILLS = [
    { id: uuid(), name: "Rent", bill_type: "fixed", amount: 1450, due_day: 1, frequency: "monthly", quarter_months: "", annual_month: 1, is_active: true },
    { id: uuid(), name: "Electric", bill_type: "variable", amount: 89.5, due_day: 5, frequency: "monthly", quarter_months: "", annual_month: 1, is_active: true },
    { id: uuid(), name: "Internet", bill_type: "fixed", amount: 65, due_day: 8, frequency: "monthly", quarter_months: "", annual_month: 1, is_active: true },
    { id: uuid(), name: "Phone", bill_type: "fixed", amount: 45, due_day: 12, frequency: "monthly", quarter_months: "", annual_month: 1, is_active: true },
    { id: uuid(), name: "Car Insurance", bill_type: "fixed", amount: 142, due_day: 15, frequency: "monthly", quarter_months: "", annual_month: 1, is_active: true },
    { id: uuid(), name: "Visa Card", bill_type: "variable", amount: 500, due_day: 20, frequency: "monthly", quarter_months: "", annual_month: 1, is_active: true },
];

export const DEFAULT_GOALS = [
    { id: uuid(), name: "Emergency Fund", icon: "🛡️", target_amount: 10000, current_balance: 4200, per_check_amount: 200, is_active: true },
    { id: uuid(), name: "Vacation", icon: "✈️", target_amount: 3000, current_balance: 1850, per_check_amount: 150, is_active: true },
    { id: uuid(), name: "New Laptop", icon: "💻", target_amount: 2000, current_balance: 800, per_check_amount: 100, is_active: true },
];

// ─── LOCAL PERSISTENCE ───
export const STORAGE_KEY = "paycheck-planner-data";
