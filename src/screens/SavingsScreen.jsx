import { useState } from "react";
import { useApp } from "../context/AppContext";
import T from "../constants/theme";
import { fmt, pct, uuid, validateGoalForm } from "../utils/helpers";
import Card from "../components/Card";
import Btn from "../components/Btn";
import Input from "../components/Input";
import Modal from "../components/Modal";
import ProgressBar from "../components/ProgressBar";

export default function SavingsScreen() {
    const { goals, setGoals } = useApp();
    const [modal, setModal] = useState(null);
    const [form, setForm] = useState({ name: "", icon: "🎯", target_amount: "", current_balance: "", per_check_amount: "" });
    const [errors, setErrors] = useState({});

    const openAdd = () => {
        setForm({ name: "", icon: "🎯", target_amount: "", current_balance: "0", per_check_amount: "" });
        setErrors({});
        setModal("add");
    };

    const openEdit = (g) => {
        setForm({
            ...g,
            target_amount: String(g.target_amount),
            current_balance: String(g.current_balance),
            per_check_amount: String(g.per_check_amount),
        });
        setErrors({});
        setModal(g.id);
    };

    const save = () => {
        const fieldErrors = validateGoalForm(form);
        if (Object.keys(fieldErrors).length > 0) {
            setErrors(fieldErrors);
            return;
        }
        const data = {
            ...form,
            target_amount: Number(form.target_amount),
            current_balance: Number(form.current_balance || 0),
            per_check_amount: Number(form.per_check_amount),
            is_active: true,
        };
        if (modal === "add") {
            setGoals((prev) => [...prev, { ...data, id: uuid() }]);
        } else {
            setGoals((prev) => prev.map((g) => (g.id === modal ? { ...g, ...data } : g)));
        }
        setModal(null);
    };

    const remove = (id) => {
        setGoals((prev) => prev.filter((g) => g.id !== id));
        setModal(null);
    };

    const totalPerCheck = goals.filter((g) => g.is_active).reduce((s, g) => s + g.per_check_amount, 0);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ color: T.text, fontSize: 18, fontWeight: 600, margin: 0 }}>Savings Goals</h2>
                <Btn color={T.green} onClick={openAdd}>+ Add Goal</Btn>
            </div>

            <Card style={{ background: T.greenDim, border: "1px solid rgba(74,222,128,0.2)" }}>
                <div style={{ textAlign: "center" }}>
                    <div style={{ color: T.textMuted, fontSize: 11, marginBottom: 2 }}>Per Paycheck</div>
                    <span style={{ color: T.green, fontSize: 24, fontWeight: 700, fontFamily: T.mono }}>{fmt(totalPerCheck)}</span>
                </div>
            </Card>

            {goals.filter((g) => g.is_active).map((goal) => {
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
                <Input label="NAME" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="e.g. Emergency Fund" error={errors.name} />
                <Input label="ICON (emoji)" value={form.icon} onChange={(v) => setForm((f) => ({ ...f, icon: v }))} placeholder="🎯" />
                <Input label="TARGET AMOUNT" type="number" value={form.target_amount}
                    onChange={(v) => setForm((f) => ({ ...f, target_amount: v }))} placeholder="10000" error={errors.target_amount} />
                <Input label="CURRENT BALANCE" type="number" value={form.current_balance}
                    onChange={(v) => setForm((f) => ({ ...f, current_balance: v }))} placeholder="0" />
                <Input label="PER PAYCHECK CONTRIBUTION" type="number" value={form.per_check_amount}
                    onChange={(v) => setForm((f) => ({ ...f, per_check_amount: v }))} placeholder="200" error={errors.per_check_amount} />
                <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                    <Btn full color="#fff" bg={T.green} onClick={save}>Save</Btn>
                    {modal !== "add" && <Btn color={T.red} onClick={() => remove(modal)}>Delete</Btn>}
                </div>
            </Modal>
        </div>
    );
}
