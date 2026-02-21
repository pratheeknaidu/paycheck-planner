import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Input from "../../components/Input";

describe("Input", () => {
    it("renders with a label", () => {
        render(<Input label="Name" value="" onChange={() => { }} />);
        expect(screen.getByText("Name")).toBeInTheDocument();
    });

    it("calls onChange with the new value", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<Input label="Amount" value="" onChange={onChange} />);
        const input = screen.getByRole("textbox") || screen.getByLabelText("Amount");
        await user.type(input, "hello");
        expect(onChange).toHaveBeenCalled();
    });

    it("renders with a placeholder", () => {
        render(<Input label="Test" value="" onChange={() => { }} placeholder="Enter value" />);
        expect(screen.getByPlaceholderText("Enter value")).toBeInTheDocument();
    });

    it("displays error text", () => {
        render(<Input label="Email" value="" onChange={() => { }} error="Required" />);
        expect(screen.getByText("Required")).toBeInTheDocument();
    });

    it("renders number input type", () => {
        const { container } = render(<Input label="Amount" type="number" value="42" onChange={() => { }} />);
        const input = container.querySelector("input");
        expect(input.type).toBe("number");
    });

    it("applies aria-label matching label text", () => {
        const { container } = render(<Input label="Description" value="" onChange={() => { }} />);
        const input = container.querySelector("input");
        expect(input.getAttribute("aria-label")).toBe("Description");
    });
});
