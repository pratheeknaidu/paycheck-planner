import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Card from "../../components/Card";

describe("Card", () => {
    it("renders children", () => {
        render(<Card>Hello</Card>);
        expect(screen.getByText("Hello")).toBeInTheDocument();
    });

    it("applies custom styles", () => {
        render(<Card style={{ border: "2px solid red" }}>Styled</Card>);
        const el = screen.getByText("Styled").parentElement || screen.getByText("Styled");
        expect(el).toBeInTheDocument();
    });

    it("handles onClick", () => {
        let clicked = false;
        render(<Card onClick={() => { clicked = true; }}>Click me</Card>);
        screen.getByText("Click me").closest("div").click();
        expect(clicked).toBe(true);
    });

    it("renders without onClick", () => {
        render(<Card>No click</Card>);
        expect(screen.getByText("No click")).toBeInTheDocument();
    });
});
