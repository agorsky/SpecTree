import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LoginPage } from "../login";

const mockNavigate = vi.fn();
const mockLogin = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("@/stores/auth-store", () => ({
  useAuthStore: () => ({
    login: mockLogin,
  }),
}));

function renderLogin() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders title and subtitle", () => {
    renderLogin();
    expect(screen.getByText("SpecTree")).toBeDefined();
    expect(screen.getByText("Enter passphrase to continue")).toBeDefined();
  });

  it("renders a passphrase input and submit button", () => {
    renderLogin();
    expect(screen.getByPlaceholderText("Passphrase")).toBeDefined();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeDefined();
  });

  it("does not render email, password, register, or forgot password elements", () => {
    renderLogin();
    expect(screen.queryByLabelText("Email")).toBeNull();
    expect(screen.queryByLabelText("Password")).toBeNull();
    expect(screen.queryByText(/register/i)).toBeNull();
    expect(screen.queryByText(/forgot/i)).toBeNull();
    expect(screen.queryByText(/activate/i)).toBeNull();
  });

  it("calls login with passphrase and navigates on success", async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    renderLogin();

    fireEvent.change(screen.getByPlaceholderText("Passphrase"), {
      target: { value: "my-secret-passphrase" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith("my-secret-passphrase");
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("shows error message on login failure", async () => {
    mockLogin.mockRejectedValueOnce(new Error("Unauthorized"));
    renderLogin();

    fireEvent.change(screen.getByPlaceholderText("Passphrase"), {
      target: { value: "wrong-passphrase" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(screen.getByText("Invalid passphrase")).toBeDefined();
    });
  });

  it("disables the button while loading", async () => {
    mockLogin.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    );
    renderLogin();

    fireEvent.change(screen.getByPlaceholderText("Passphrase"), {
      target: { value: "test" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    const button = screen.getByRole("button", { name: "Signing in..." });
    expect(button.hasAttribute("disabled")).toBe(true);

    await waitFor(() => {
      const btn = screen.getByRole("button", { name: "Sign in" });
      expect(btn.hasAttribute("disabled")).toBe(false);
    });
  });

  it("clears previous error on new submit", async () => {
    mockLogin.mockRejectedValueOnce(new Error("fail"));
    renderLogin();

    fireEvent.change(screen.getByPlaceholderText("Passphrase"), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(screen.getByText("Invalid passphrase")).toBeDefined();
    });

    mockLogin.mockResolvedValueOnce(undefined);
    fireEvent.change(screen.getByPlaceholderText("Passphrase"), {
      target: { value: "correct" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(screen.queryByText("Invalid passphrase")).toBeNull();
    });
  });
});
