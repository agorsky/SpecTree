import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Header } from "../components/layout/header";

vi.mock("@/components/layout/theme-toggle", () => ({
  ThemeToggle: () => <button>Toggle theme</button>,
}));

describe("Header navigation", () => {
  it("does not render Home or About nav links", () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    );

    expect(screen.queryByText("Home")).toBeNull();
    expect(screen.queryByText("About")).toBeNull();
  });

  it("renders the SpecTree brand link", () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    );

    expect(screen.getByText("SpecTree")).toBeDefined();
  });
});
