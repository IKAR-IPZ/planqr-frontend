import type { ReactNode } from "react";

interface AdminPanelSectionProps {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

const AdminPanelSection = ({
  eyebrow,
  title,
  description,
  actions,
  children,
}: AdminPanelSectionProps) => (
  <section className="admin-section">
    <header className="admin-section__header">
      <div className="admin-section__copy">
        <span className="admin-section__eyebrow">{eyebrow}</span>
        <h2 className="admin-section__title">{title}</h2>
        {description ? (
          <p className="admin-section__description">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="admin-section__actions">{actions}</div> : null}
    </header>
    {children}
  </section>
);

export default AdminPanelSection;
