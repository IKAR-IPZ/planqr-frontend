import type { AdminPanelTheme } from "./types";

interface AdminPanelThemeToggleProps {
  theme: AdminPanelTheme;
  onChange: (theme: AdminPanelTheme) => void;
}

const AdminPanelThemeToggle = ({
  theme,
  onChange,
}: AdminPanelThemeToggleProps) => (
  <div className="admin-theme-switch" role="group" aria-label="Motyw adminpanelu">
    <button
      type="button"
      className={`admin-theme-switch__button${
        theme === "light" ? " admin-theme-switch__button--active" : ""
      }`}
      onClick={() => onChange("light")}
      aria-pressed={theme === "light"}
    >
      Jasny
    </button>
    <button
      type="button"
      className={`admin-theme-switch__button${
        theme === "dark" ? " admin-theme-switch__button--active" : ""
      }`}
      onClick={() => onChange("dark")}
      aria-pressed={theme === "dark"}
    >
      Ciemny
    </button>
  </div>
);

export default AdminPanelThemeToggle;
