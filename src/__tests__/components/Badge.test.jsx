import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Badge from "../../components/Badge";

describe("Badge", () => {
    it("renders the text", () => {
        render(<Badge text="v2.0" color="#fff" bg="#333" />);
        expect(screen.getByText("v2.0")).toBeInTheDocument();
    });

    it("applies color and background styles", () => {
        render(<Badge text="Status" color="red" bg="pink" />);
        const el = screen.getByText("Status");
        expect(el.style.color).toBe("red");
        expect(el.style.background).toBe("pink");
    });

    it("renders with minimal props", () => {
        render(<Badge text="Min" />);
        expect(screen.getByText("Min")).toBeInTheDocument();
    });
});
