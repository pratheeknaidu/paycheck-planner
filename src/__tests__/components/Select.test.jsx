import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Select from "../../components/Select";

describe("Select", () => {
    const options = [
        { value: "monthly", label: "Monthly" },
        { value: "quarterly", label: "Quarterly" },
        { value: "annual", label: "Annual" },
    ];

    it("renders all options", () => {
        render(<Select label="Frequency" value="monthly" onChange={() => { }} options={options} />);
        expect(screen.getByText("Monthly")).toBeInTheDocument();
        expect(screen.getByText("Quarterly")).toBeInTheDocument();
        expect(screen.getByText("Annual")).toBeInTheDocument();
    });

    it("renders the label", () => {
        render(<Select label="Type" value="monthly" onChange={() => { }} options={options} />);
        expect(screen.getByText("Type")).toBeInTheDocument();
    });

    it("calls onChange when selection changes", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<Select label="Freq" value="monthly" onChange={onChange} options={options} />);
        const select = screen.getByRole("combobox");
        await user.selectOptions(select, "quarterly");
        expect(onChange).toHaveBeenCalledWith("quarterly");
    });

    it("has aria-label matching label text", () => {
        render(<Select label="Billing" value="monthly" onChange={() => { }} options={options} />);
        const select = screen.getByRole("combobox");
        expect(select.getAttribute("aria-label")).toBe("Billing");
    });
});
