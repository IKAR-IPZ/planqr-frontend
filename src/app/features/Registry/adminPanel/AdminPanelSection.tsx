import type { ReactNode } from "react";

interface AdminPanelSectionProps {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}

const AdminPanelSection = ({
  title,
  actions,
  children,
}: AdminPanelSectionProps) => (
  <section className="admin-surface">
    <header className="admin-surface__header">
      <h2 className="admin-surface__title">{title}</h2>
      {actions ? <div className="admin-section__actions">{actions}</div> : null}
    </header>
    {children}
  </section>
);

export default AdminPanelSection;
