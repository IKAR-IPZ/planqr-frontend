import type { AdminPanelView } from "./types";

interface NavigationItem {
  key: AdminPanelView;
  label: string;
  icon: string;
}

interface AdminPanelSidebarProps {
  activeView: AdminPanelView;
  navigationItems: NavigationItem[];
  onViewChange: (view: AdminPanelView) => void;
}

const AdminPanelSidebar = ({
  activeView,
  navigationItems,
  onViewChange,
}: AdminPanelSidebarProps) => (
  <nav className="admin-nav" aria-label="Widoki panelu administracyjnego">
    <ul className="admin-nav__list">
      {navigationItems.map((item) => (
        <li key={item.key} className="admin-nav__item">
          <button
            type="button"
            className={`admin-nav__button${
              item.key === activeView ? " admin-nav__button--active" : ""
            }`}
            onClick={() => onViewChange(item.key)}
            aria-current={item.key === activeView ? "page" : undefined}
          >
            <i className={item.icon} aria-hidden="true" />
            <span>{item.label}</span>
          </button>
        </li>
      ))}
    </ul>
  </nav>
);

export default AdminPanelSidebar;
