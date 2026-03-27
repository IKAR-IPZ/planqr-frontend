import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../../assets/ZUT_Logo.png";
import ThemeToggle from "./ThemeToggle";
import { fetchSession, getPreferredRoute } from "../services/authService";

type LoginErrorPayload = {
  code?: string;
  message?: string;
};

const getLoginErrorMessage = (status: number, data: LoginErrorPayload | null) => {
  switch (data?.code) {
    case "INVALID_CREDENTIALS":
      return "Nieprawidłowy login lub hasło.";
    case "LDAP_TIMEOUT":
      return "Serwer LDAP nie odpowiedział na czas. Spróbuj ponownie za chwilę.";
    case "LDAP_UNAVAILABLE":
      return "Serwer LDAP jest obecnie niedostępny. Spróbuj ponownie za chwilę.";
    case "AUTH_ERROR":
      return "Wystąpił błąd podczas logowania. Spróbuj ponownie.";
    default:
      break;
  }

  if (status === 401) {
    return "Nieprawidłowy login lub hasło.";
  }

  if (status === 403) {
    return data?.message || "To konto nie ma dostępu do PlanQR.";
  }

  if (typeof data?.message === "string" && data.message.trim()) {
    return data.message;
  }

  return "Wystąpił błąd podczas logowania. Spróbuj ponownie.";
};

export default function LoginPanel() {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
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

  useEffect(() => {
    document.documentElement.classList.add("login-scroll-root");
    document.body.classList.add("login-scroll-root");

    return () => {
      document.documentElement.classList.remove("login-scroll-root");
      document.body.classList.remove("login-scroll-root");
    };
  }, []);

  useEffect(() => {
    if (!isEditing) {
      return;
    }

    let scrollTimeout = 0;

    const scrollActiveFieldIntoView = () => {
      window.clearTimeout(scrollTimeout);
      scrollTimeout = window.setTimeout(() => {
        const activeElement = document.activeElement;

        if (!(activeElement instanceof HTMLElement)) {
          return;
        }

        if (!formRef.current?.contains(activeElement)) {
          return;
        }

        activeElement.scrollIntoView({
          block: "center",
          inline: "nearest",
        });
      }, 250);
    };

    const viewport = window.visualViewport;

    scrollActiveFieldIntoView();
    viewport?.addEventListener("resize", scrollActiveFieldIntoView);

    return () => {
      window.clearTimeout(scrollTimeout);
      viewport?.removeEventListener("resize", scrollActiveFieldIntoView);
    };
  }, [isEditing]);

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
        setErrorMessage(getLoginErrorMessage(response.status, data));
        return;
      }

      setErrorMessage(getLoginErrorMessage(response.status, data));
    } catch (error) {
      console.error("Error during login:", error);
      setErrorMessage("Wystąpił błąd podczas logowania. Spróbuj ponownie.");
    }
  };

  return (
    <div className={`login-panel${isEditing ? " login-panel--editing" : ""}`}>
      <div className="login-panel__theme-toggle">
        <ThemeToggle />
      </div>
      <form
        ref={formRef}
        className="login-panel__form"
        onSubmit={handleSubmit}
        onFocusCapture={() => setIsEditing(true)}
        onBlurCapture={() => {
          window.requestAnimationFrame(() => {
            if (!formRef.current?.contains(document.activeElement)) {
              setIsEditing(false);
            }
          });
        }}
      >
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
