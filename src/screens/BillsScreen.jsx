import { useState } from "react";
import { useApp } from "../context/AppContext";
import T from "../constants/theme";
import { fmt, uuid, validateBillForm } from "../utils/helpers";
import Card from "../components/Card";
import Badge from "../components/Badge";
import Btn from "../components/Btn";
import Input from "../components/Input";
import Select from "../components/Select";
import Modal from "../components/Modal";

export default function BillsScreen() {
    const { bills, setBills } = useApp();
    const [modal, setModal] = useState(null);
    const [form, setForm] = useState({
        name: "", bill_type: "fixed", amount: "", due_day: "",
        frequency: "monthly", quarter_months: "1,4,7,10", annual_month: "1",
    });
    const [errors, setErrors] = useState({});

    const openAdd = () => {
        setForm({ name: "", bill_type: "fixed", amount: "", due_day: "", frequency: "monthly", quarter_months: "1,4,7,10", annual_month: "1" });
        setErrors({});
        setModal("add");
    };

    const openEdit = (bill) => {
        setForm({ ...bill, amount: String(bill.amount), due_day: String(bill.due_day), annual_month: String(bill.annual_month) });
        setErrors({});
        setModal(bill.id);
    };

    const save = () => {
        const fieldErrors = validateBillForm(form);
        if (Object.keys(fieldErrors).length > 0) {
            setErrors(fieldErrors);
            return;
        }
        const data = {
            ...form,
            amount: Number(form.amount),
            due_day: Math.min(31, Math.max(1, Math.round(Number(form.due_day)))),
            annual_month: Number(form.annual_month),
            is_active: true,
        };
        if (modal === "add") {
            setBills((prev) => [...prev, { ...data, id: uuid() }]);
        } else {
            setBills((prev) => prev.map((b) => (b.id === modal ? { ...b, ...data } : b)));
        }
        setModal(null);
    };

    const remove = (id) => {
        setBills((prev) => prev.filter((b) => b.id !== id));
        setModal(null);
    };

    const monthlyTotal = bills.filter((b) => b.is_active && b.frequency === "monthly").reduce((s, b) => s + b.amount, 0);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ color: T.text, fontSize: 18, fontWeight: 600, margin: 0 }}>Bills</h2>
                <Btn onClick={openAdd}>+ Add Bill</Btn>
            </div>

            <Card style={{ background: T.accentDim, border: `1px solid ${T.accentSoft}` }}>
                <div style={{ textAlign: "center" }}>
                    <div style={{ color: T.textMuted, fontSize: 11, marginBottom: 2 }}>Monthly Total</div>
                    <span style={{ color: T.accent, fontSize: 24, fontWeight: 700, fontFamily: T.mono }}>{fmt(monthlyTotal)}</span>
                </div>
            </Card>

            {bills.filter((b) => b.is_active).map((bill) => (
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
                <Input label="NAME" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="e.g. Rent" error={errors.name} />
                <Select label="TYPE" value={form.bill_type} onChange={(v) => setForm((f) => ({ ...f, bill_type: v }))}
                    options={[{ value: "fixed", label: "Fixed (same every time)" }, { value: "variable", label: "Variable (estimated)" }]} />
                <Input label={form.bill_type === "variable" ? "ESTIMATED AMOUNT" : "AMOUNT"} type="number"
                    value={form.amount} onChange={(v) => setForm((f) => ({ ...f, amount: v }))} placeholder="0.00" error={errors.amount} />
                <Input label="DUE DAY OF MONTH (1-31)" type="number" value={form.due_day}
                    onChange={(v) => setForm((f) => ({ ...f, due_day: v }))} placeholder="1-31" error={errors.due_day} />
                <Select label="FREQUENCY" value={form.frequency} onChange={(v) => setForm((f) => ({ ...f, frequency: v }))}
                    options={[{ value: "monthly", label: "Monthly" }, { value: "quarterly", label: "Quarterly" }, { value: "annual", label: "Annual" }]} />
                {form.frequency === "quarterly" && (
                    <Input label="QUARTER MONTHS (comma-separated)" value={form.quarter_months}
                        onChange={(v) => setForm((f) => ({ ...f, quarter_months: v }))} placeholder="1,4,7,10" />
                )}
                {form.frequency === "annual" && (
                    <Input label="ANNUAL MONTH (1-12)" type="number" value={form.annual_month}
                        onChange={(v) => setForm((f) => ({ ...f, annual_month: v }))} placeholder="1" />
                )}
                <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                    <Btn full color="#fff" bg={T.accent} onClick={save}>Save</Btn>
                    {modal !== "add" && <Btn color={T.red} onClick={() => remove(modal)}>Delete</Btn>}
                </div>
            </Modal>
        </div>
    );
}
