import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ErrorBoundary from "../components/ErrorBoundary";

function ThrowingComponent({ shouldThrow = true }) {
    if (shouldThrow) throw new Error("Test error");
    return <div>Working</div>;
}

describe("ErrorBoundary", () => {
    beforeEach(() => {
        // Suppress console.error noise from React error boundary logging
        vi.spyOn(console, "error").mockImplementation(() => { });
    });

    it("renders children when there is no error", () => {
        render(
            <ErrorBoundary>
                <ThrowingComponent shouldThrow={false} />
            </ErrorBoundary>,
        );
        expect(screen.getByText("Working")).toBeInTheDocument();
    });

    it("renders fallback UI when a child throws", () => {
        render(
            <ErrorBoundary>
                <ThrowingComponent shouldThrow={true} />
            </ErrorBoundary>,
        );
        expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });

    it("shows a reload button in fallback", () => {
        render(
            <ErrorBoundary>
                <ThrowingComponent shouldThrow={true} />
            </ErrorBoundary>,
        );
        expect(screen.getByText(/refresh page/i)).toBeInTheDocument();
    });
});
