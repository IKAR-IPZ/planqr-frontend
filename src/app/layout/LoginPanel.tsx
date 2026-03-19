import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../../assets/ZUT_Logo.png";



export default function LoginPanel() {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        // const token = localStorage.getItem("token");
        // if (!token) {
        //   // console.log("User is unauthorized (token is NULL)");
        //   return;
        // }
        const response = await fetch('/api/auth/check-login', {
          method: 'GET',
          credentials: 'include',
        });
        if (response.ok) {
          await response.json();
          navigate(`/lecturerPlan`);
        }
      } catch (error) {
        console.log(error);
      }
    };

    checkLoginStatus();
  }, [navigate]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      const response = await fetch('/api/auth/login', {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username: login, password }),
        credentials: "include",
      });

      if (response.ok) {
        await response.json();
        navigate(`/lecturerPlan`);
      } else {
        alert("Invalid username or password");
      }


    } catch (error) {
      console.error("Error during login:", error);
      alert("An error occurred during login. Please try again.");
      navigate("/");
    }
  };

  return (
    <div className="login-panel">
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
              placeholder="Twoje hasło"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>
        <button type="submit" className="login-panel__btn">Zaloguj</button>
      </form>
    </div>
  );
}