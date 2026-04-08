import type { AdminPanelView } from "./types";

type AdminNavigationKey = AdminPanelView | "pairing" | "lecturer-preview";

interface NavigationItem {
  key: AdminNavigationKey;
  label: string;
  icon: string;
  active?: boolean;
}

interface AdminPanelSidebarProps {
  navigationItems: NavigationItem[];
  onItemSelect: (key: AdminNavigationKey) => void;
  className?: string;
}

const AdminPanelSidebar = ({
  navigationItems,
  onItemSelect,
  className,
}: AdminPanelSidebarProps) => (
  <nav
    className={["admin-nav", className].filter(Boolean).join(" ")}
    aria-label="Widoki panelu administracyjnego"
  >
    <ul className="admin-nav__list">
      {navigationItems.map((item) => (
        <li key={item.key} className="admin-nav__item">
          <button
            type="button"
            className={`admin-nav__button${
              item.active ? " admin-nav__button--active" : ""
            }`}
            onClick={() => onItemSelect(item.key)}
            aria-current={item.active ? "page" : undefined}
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
