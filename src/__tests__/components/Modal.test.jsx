import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Modal from "../../components/Modal";

describe("Modal", () => {
    it("renders children when open", () => {
        render(<Modal open={true} onClose={() => { }} title="Test Modal"><p>Content</p></Modal>);
        expect(screen.getByText("Content")).toBeInTheDocument();
    });

    it("renders the title", () => {
        render(<Modal open={true} onClose={() => { }} title="My Modal"><p>Body</p></Modal>);
        expect(screen.getByText("My Modal")).toBeInTheDocument();
    });

    it("does not render when closed", () => {
        render(<Modal open={false} onClose={() => { }} title="Hidden"><p>Hidden Content</p></Modal>);
        expect(screen.queryByText("Hidden Content")).not.toBeInTheDocument();
    });

    it("calls onClose when close button is clicked", async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        render(<Modal open={true} onClose={onClose} title="Closeable"><p>Content</p></Modal>);
        const closeBtn = screen.getByLabelText("Close dialog");
        await user.click(closeBtn);
        expect(onClose).toHaveBeenCalledOnce();
    });

    it("has role=dialog and aria-modal", () => {
        render(<Modal open={true} onClose={() => { }} title="Accessible"><p>A11y</p></Modal>);
        const dialog = screen.getByRole("dialog");
        expect(dialog).toBeInTheDocument();
        expect(dialog.getAttribute("aria-modal")).toBe("true");
    });

    it("has aria-label matching title", () => {
        render(<Modal open={true} onClose={() => { }} title="Settings"><p>Form</p></Modal>);
        const dialog = screen.getByRole("dialog");
        expect(dialog.getAttribute("aria-label")).toBe("Settings");
    });
});
