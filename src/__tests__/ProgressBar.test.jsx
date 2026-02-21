import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import ProgressBar from "../components/ProgressBar";

describe("ProgressBar", () => {
    it("renders with correct width percentage", () => {
        const { container } = render(<ProgressBar value={75} color="green" />);
        // Outer div is the track, inner div is the fill
        const fill = container.firstChild.firstChild;
        expect(fill.style.width).toBe("75%");
    });

    it("clamps value to 100%", () => {
        const { container } = render(<ProgressBar value={150} color="green" />);
        const fill = container.firstChild.firstChild;
        expect(fill.style.width).toBe("100%");
    });

    it("handles 0%", () => {
        const { container } = render(<ProgressBar value={0} color="blue" />);
        const fill = container.firstChild.firstChild;
        expect(fill.style.width).toBe("0%");
    });

    it("applies color to the fill", () => {
        const { container } = render(<ProgressBar value={50} color="red" />);
        const fill = container.firstChild.firstChild;
        expect(fill.style.background).toBe("red");
    });

    it("uses default height of 6", () => {
        const { container } = render(<ProgressBar value={50} color="red" />);
        const track = container.firstChild;
        expect(track.style.height).toBe("6px");
    });

    it("accepts custom height", () => {
        const { container } = render(<ProgressBar value={50} color="red" height={12} />);
        const track = container.firstChild;
        expect(track.style.height).toBe("12px");
    });
});
