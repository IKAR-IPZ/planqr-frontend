import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../../assets/ZUT_Logo.png";
import ThemeToggle from "./ThemeToggle";
import { fetchSession, getPreferredRoute } from "../services/authService";


export default function LoginPanel() {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const checkLoginStatus = async () => {
      const session = await fetchSession();
      const preferredRoute = getPreferredRoute(session);

      if (preferredRoute) {
        navigate(preferredRoute);
      }
    };

    void checkLoginStatus();
  }, [navigate]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage("");

    try {
      const response = await fetch('/api/auth/login', {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username: login, password }),
        credentials: "include",
      });

      const data = await response.json().catch(() => null);

      if (response.ok) {
        const preferredRoute = getPreferredRoute(data);
        if (preferredRoute) {
          navigate(preferredRoute);
          return;
        }

        setErrorMessage("Konto nie ma przypisanego panelu PlanQR.");
        return;
      }

      if (response.status === 403) {
        setErrorMessage(data?.message || "To konto nie ma dostepu do PlanQR.");
      } else {
        setErrorMessage(data?.message || "Nieprawidlowy login lub haslo.");
      }
    } catch (error) {
      console.error("Error during login:", error);
      setErrorMessage("Wystapil blad podczas logowania. Sprobuj ponownie.");
    }
  };

  return (
    <div className="login-panel">
      <div className="login-panel__theme-toggle">
        <ThemeToggle />
      </div>
      <form className="login-panel__form" onSubmit={handleSubmit}>
        <div className="login-panel__header">
          <img src={logo} alt="ZUT Logo" className="login-panel__logo" />
        </div>
        <div className="login-panel__input-group-wrapper">
          <div className="login-panel__input-group">
            <span className="login-panel__icon">
              <i className="fas fa-envelope"></i>
            </span>
            <input
              type="text"
              className="login-panel__input"
              placeholder="Twój login"
              required
              value={login}
              onChange={(e) => setLogin(e.target.value)}
            />
          </div>
          <div className="login-panel__input-group">
            <span className="login-panel__icon">
              <i className="fas fa-lock"></i>
            </span>
            <input
              type="password"
              className="login-panel__input"
              placeholder="Hasło"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>
        <button type="submit" className="login-panel__btn">Zaloguj</button>
        {errorMessage ? (
          <p style={{ marginTop: '1rem', color: '#dc2626', textAlign: 'center' }}>{errorMessage}</p>
        ) : null}
      </form>
    </div>
  );
}
