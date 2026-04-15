import { useId, type ReactNode } from "react";

interface AdminPanelSectionProps {
  title: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

const AdminPanelSection = ({
  title,
  actions,
  className,
  children,
  collapsible = false,
  collapsed = false,
  onToggleCollapsed,
}: AdminPanelSectionProps) => {
  const contentId = useId();
  const isCollapsible = collapsible && typeof onToggleCollapsed === "function";

  return (
    <section
      className={[
        "admin-surface",
        className,
        isCollapsible ? "admin-surface--collapsible" : "",
        isCollapsible && collapsed ? "admin-surface--collapsed" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <header className="admin-surface__header">
        {isCollapsible ? (
          <h2 className="admin-surface__title">
            <button
              type="button"
              className="admin-surface__toggle"
              aria-expanded={!collapsed}
              aria-controls={contentId}
              aria-label={`${collapsed ? "Rozwiń" : "Zwiń"} sekcję ${title}`}
              onClick={onToggleCollapsed}
            >
              <span className="admin-surface__title-text">{title}</span>
              <i className="fas fa-chevron-down admin-surface__toggle-icon" aria-hidden="true" />
            </button>
          </h2>
        ) : (
          <h2 className="admin-surface__title">{title}</h2>
        )}
        {actions ? <div className="admin-section__actions">{actions}</div> : null}
      </header>
      {isCollapsible ? (
        <div id={contentId} className="admin-surface__body" hidden={collapsed}>
          {children}
        </div>
      ) : (
        children
      )}
    </section>
  );
};

export default AdminPanelSection;
