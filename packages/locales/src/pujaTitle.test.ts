import { describe, expect, it } from "vitest";
import { formatPujaTitleText, stripPujaTitleMarks } from "./pujaTitle";

describe("puja title display marks", () => {
  it("leaves the stored name untouched and wraps it for display", () => {
    expect(formatPujaTitleText("Ganapathi Puja")).toBe("ॐ Ganapathi Puja 卐");
    expect(stripPujaTitleMarks("Ganapathi Puja")).toBe("Ganapathi Puja");
  });

  it("does not double-wrap names that already include the marks", () => {
    expect(stripPujaTitleMarks("ॐ Ganapathi Puja 卐")).toBe("Ganapathi Puja");
    expect(formatPujaTitleText("ॐ Ganapathi Puja 卐")).toBe("ॐ Ganapathi Puja 卐");
  });
});
