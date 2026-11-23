import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Glossary from "./Glossary";

describe("Glossary", () => {
  it("explains calculated measures, percentage points and manual objective ratings", () => {
    render(<Glossary />);
    expect(screen.getByText("Planned completion (%)")).toBeTruthy();
    expect(screen.getByText("KPI achievement (%)")).toBeTruthy();
    expect(screen.getByText("Exception Score")).toBeTruthy();
    expect(screen.getByText("Variance")).toBeTruthy();
    expect(screen.getByText(/The displayed difference is in percentage points/)).toBeTruthy();
    expect(screen.getByText(/Ratings are assigned by a person/)).toBeTruthy();
  });
});
