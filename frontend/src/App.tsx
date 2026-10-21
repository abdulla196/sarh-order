
import {  useState, type FormEvent } from "react";
import { LockKeyhole, Mail, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { apiRequest } from "./services/api";
import OrdersDashboard from "./components/OrdersDashboard";
import "./App.css";

type LoginResponse = {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  user: {
    id: string;
    name: string;
    email: string;
    role: "ADMIN" | "AGENT";
  };
};

function App() {
  const [email, setEmail] = useState("agent@sarh.local");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loggedIn, setLoggedIn] = useState(
    Boolean(sessionStorage.getItem("accessToken")),
  );

  if (loggedIn) {
    return (
      <OrdersDashboard
        onLogout={() => {
          sessionStorage.removeItem("accessToken");
          sessionStorage.removeItem("currentUser");
          setLoggedIn(false);
        }}
      />
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await apiRequest<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      sessionStorage.setItem("accessToken", result.accessToken);
      sessionStorage.setItem("currentUser", JSON.stringify(result.user));
      setLoggedIn(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to sign in. Try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-visual">
        <div className="visual-content">
          <div className="brand-mark">S</div>
          <p className="eyebrow">SARH OPERATIONS</p>
          <h1>Every order.<br />Under control.</h1>
          <p className="visual-description">
            A clearer view of your orders, your customers, and your operations.
          </p>
          <div className="visual-footer">
            ORDER MANAGEMENT PLATFORM <span>•</span> SECURE ACCESS
          </div>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-form-wrapper">
          <div className="mobile-brand">
            <div className="brand-mark">S</div>
            <span>SARH</span>
          </div>

          <div className="form-heading">
            <span className="welcome-label">WELCOME BACK</span>
            <h2>Sign in to SARH</h2>
            <p>Enter your credentials to access your workspace.</p>
          </div>

          <form onSubmit={handleSubmit}>
            <label htmlFor="email">Email address</label>
            <div className="input-wrapper">
              <Mail size={18} aria-hidden="true" />
              <input
                id="email"
                type="email"
                autoComplete="username"
                placeholder="you@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <label htmlFor="password">Password</label>
            <div className="input-wrapper">
              <LockKeyhole size={18} aria-hidden="true" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <button
                className="password-toggle"
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {error && (
              <div className="error-message" role="alert">
                {error}
              </div>
            )}

            <button className="login-button" type="submit" disabled={loading}>
              {loading ? (
                <>
                  <LoaderCircle size={18} className="spinner" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          <p className="security-note">
            Protected workspace · Authorized users only
          </p>
        </div>
      </section>
    </main>
  );
}

export default App;
