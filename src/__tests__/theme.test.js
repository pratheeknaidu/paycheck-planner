import { describe, it, expect } from "vitest";
import T, { FONT_LINK } from "../constants/theme";

describe("theme tokens", () => {
    it("exports a default object with color tokens", () => {
        expect(T).toBeDefined();
        expect(typeof T.bg).toBe("string");
        expect(typeof T.text).toBe("string");
        expect(typeof T.accent).toBe("string");
        expect(typeof T.card).toBe("string");
        expect(typeof T.border).toBe("string");
    });

    it("exports color variants for status", () => {
        expect(T.green).toBeDefined();
        expect(T.greenDim).toBeDefined();
        expect(T.red).toBeDefined();
        expect(T.redDim).toBeDefined();
        expect(T.amber).toBeDefined();
        expect(T.amberDim).toBeDefined();
        expect(T.purple).toBeDefined();
        expect(T.purpleDim).toBeDefined();
    });

    it("exports font and radius tokens", () => {
        expect(typeof T.font).toBe("string");
        expect(typeof T.mono).toBe("string");
        expect(typeof T.radius).toBe("string");
        expect(typeof T.radiusSm).toBe("string");
    });
});

describe("FONT_LINK", () => {
    it("is a valid Google Fonts URL", () => {
        expect(typeof FONT_LINK).toBe("string");
        expect(FONT_LINK).toContain("fonts.googleapis.com");
    });
});
