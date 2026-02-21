import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Btn from "../../components/Btn";

describe("Btn", () => {
    it("renders children text", () => {
        render(<Btn>Click Me</Btn>);
        expect(screen.getByText("Click Me")).toBeInTheDocument();
    });

    it("calls onClick when clicked", async () => {
        const user = userEvent.setup();
        const onClick = vi.fn();
        render(<Btn onClick={onClick}>Go</Btn>);
        await user.click(screen.getByText("Go"));
        expect(onClick).toHaveBeenCalledOnce();
    });

    it("applies color and background", () => {
        render(<Btn color="white" bg="blue">Styled</Btn>);
        const btn = screen.getByText("Styled");
        expect(btn.style.color).toBe("white");
        expect(btn.style.background).toBe("blue");
    });

    it("applies full width when full prop is set", () => {
        render(<Btn full>Full Width</Btn>);
        const btn = screen.getByText("Full Width");
        expect(btn.style.width).toBe("100%");
    });

    it("merges custom styles", () => {
        render(<Btn style={{ opacity: "0.5" }}>Custom</Btn>);
        const btn = screen.getByText("Custom");
        expect(btn.style.opacity).toBe("0.5");
    });
});
