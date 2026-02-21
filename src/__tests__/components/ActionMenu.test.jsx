import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ActionMenu from "../../components/ActionMenu";

const makeBill = (overrides = {}) => ({
    id: "bill-1",
    name: "Test Bill",
    bill_type: "fixed",
    amount: 100,
    due_day: 15,
    frequency: "monthly",
    ...overrides,
});

describe("ActionMenu", () => {
    const defaultProps = {
        billId: "bill-1",
        bill: makeBill(),
        alloc: {},
        onOpenSplit: vi.fn(),
        onDefer: vi.fn(),
        onUndoDefer: vi.fn(),
        onUndoSplit: vi.fn(),
        actionMenu: null,
        setActionMenu: vi.fn(),
    };

    it("renders the ⋯ action button", () => {
        render(<ActionMenu {...defaultProps} />);
        expect(screen.getByLabelText("Actions for Test Bill")).toBeInTheDocument();
    });

    it("shows Split and Defer options when menu is open", () => {
        render(<ActionMenu {...defaultProps} actionMenu="bill-1" />);
        expect(screen.getByText(/Split/)).toBeInTheDocument();
        expect(screen.getByText(/Defer/)).toBeInTheDocument();
    });

    it("does not show menu items when menu is closed", () => {
        render(<ActionMenu {...defaultProps} actionMenu={null} />);
        expect(screen.queryByText(/Split/)).not.toBeInTheDocument();
    });

    it("shows DEFERRED badge when alloc is deferred", () => {
        render(<ActionMenu {...defaultProps} alloc={{ deferred: true }} />);
        expect(screen.getByText(/DEFERRED/)).toBeInTheDocument();
    });

    it("shows SPLIT badge when alloc has splitAmount", () => {
        render(<ActionMenu {...defaultProps} alloc={{ splitAmount: 50 }} />);
        expect(screen.getByText(/SPLIT/)).toBeInTheDocument();
    });

    it("calls onUndoDefer when DEFERRED button is clicked", async () => {
        const user = userEvent.setup();
        const onUndoDefer = vi.fn();
        render(<ActionMenu {...defaultProps} alloc={{ deferred: true }} onUndoDefer={onUndoDefer} />);
        await user.click(screen.getByText(/DEFERRED/));
        expect(onUndoDefer).toHaveBeenCalledWith("bill-1");
    });

    it("calls onUndoSplit when SPLIT button is clicked", async () => {
        const user = userEvent.setup();
        const onUndoSplit = vi.fn();
        render(<ActionMenu {...defaultProps} alloc={{ splitAmount: 50 }} onUndoSplit={onUndoSplit} />);
        await user.click(screen.getByText(/SPLIT/));
        expect(onUndoSplit).toHaveBeenCalledWith("bill-1");
    });

    it("calls setActionMenu when ⋯ is clicked", async () => {
        const user = userEvent.setup();
        const setActionMenu = vi.fn();
        render(<ActionMenu {...defaultProps} setActionMenu={setActionMenu} />);
        await user.click(screen.getByLabelText("Actions for Test Bill"));
        expect(setActionMenu).toHaveBeenCalledWith("bill-1");
    });

    it("hides Defer option when isDeferrable is false", () => {
        render(<ActionMenu {...defaultProps} actionMenu="bill-1" isDeferrable={false} />);
        expect(screen.getByText(/Split/)).toBeInTheDocument();
        expect(screen.queryByText(/Defer/)).not.toBeInTheDocument();
    });
});
