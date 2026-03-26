import ThemeToggle from "../../../layout/ThemeToggle";
import type { AdminPanelView, Tone } from "./types";

interface NavigationItem {
  key: AdminPanelView;
  label: string;
  description: string;
}

interface SummaryItem {
  label: string;
  value: number;
  tone?: Tone;
}

interface AdminPanelSidebarProps {
  activeView: AdminPanelView;
  navigationItems: NavigationItem[];
  summaryItems: SummaryItem[];
  loading: boolean;
  reloadingTablets: boolean;
  reloadFeedback: string | null;
  onRefreshDevices: () => void;
  onReloadTablets: () => void;
  onLogout: () => void;
  onViewChange: (view: AdminPanelView) => void;
}

const AdminPanelSidebar = ({
  activeView,
  navigationItems,
  summaryItems,
  loading,
  reloadingTablets,
  reloadFeedback,
  onRefreshDevices,
  onReloadTablets,
  onLogout,
  onViewChange,
}: AdminPanelSidebarProps) => (
  <aside className="admin-workspace__sidebar">
    <div className="admin-workspace__brand">
      <div>
        <span className="admin-workspace__eyebrow">Panel administracyjny</span>
        <h1 className="admin-workspace__brand-title">PlanQR Admin</h1>
      </div>
      <ThemeToggle />
    </div>

    <nav className="admin-workspace__nav" aria-label="Widoki panelu administracyjnego">
      {navigationItems.map((item) => (
        <button
          key={item.key}
          type="button"
          className={`admin-workspace__nav-button${
            item.key === activeView ? " admin-workspace__nav-button--active" : ""
          }`}
          onClick={() => onViewChange(item.key)}
        >
          <span className="admin-workspace__nav-label">{item.label}</span>
          <span className="admin-workspace__nav-description">{item.description}</span>
        </button>
      ))}
    </nav>

    <section className="admin-workspace__summary" aria-label="Podsumowanie systemu">
      <div className="admin-workspace__summary-header">
        <span className="admin-workspace__eyebrow">Podsumowanie</span>
        <span className="admin-workspace__summary-caption">Stan bieżący</span>
      </div>
      <div className="admin-workspace__summary-list">
        {summaryItems.map((item) => (
          <div
            key={item.label}
            className={`admin-workspace__summary-item${
              item.tone ? ` admin-workspace__summary-item--${item.tone}` : ""
            }`}
          >
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
    </section>

    <section className="admin-workspace__actions" aria-label="Akcje globalne">
      <span className="admin-workspace__eyebrow">Akcje globalne</span>
      <button
        type="button"
        className="admin-button admin-button--secondary admin-button--full"
        onClick={onRefreshDevices}
        disabled={loading}
      >
        <i className={`fas fa-sync-alt ${loading ? "fa-spin" : ""}`} aria-hidden="true" />
        {loading ? "Odświeżanie..." : "Odśwież urządzenia"}
      </button>
      <button
        type="button"
        className="admin-button admin-button--secondary admin-button--full"
        onClick={onReloadTablets}
        disabled={reloadingTablets}
      >
        <i
          className={`fas fa-bolt ${reloadingTablets ? "fa-spin" : ""}`}
          aria-hidden="true"
        />
        {reloadingTablets ? "Wysyłanie..." : "Przeładuj tablety"}
      </button>
      <button
        type="button"
        className="admin-button admin-button--danger admin-button--full"
        onClick={onLogout}
      >
        <i className="fas fa-sign-out-alt" aria-hidden="true" />
        Wyloguj
      </button>
      {reloadFeedback ? (
        <p className="admin-workspace__feedback">{reloadFeedback}</p>
      ) : null}
      <a className="admin-workspace__back-link" href="/">
        Powrót do strony głównej
      </a>
    </section>
  </aside>
);

export default AdminPanelSidebar;
