import type { ReactNode } from "react";

interface AdminPanelTableProps {
  caption: string;
  columns: ReactNode[];
  className?: string;
  wrapperClassName?: string;
  columnGroup?: ReactNode;
  children: ReactNode;
}

const AdminPanelTable = ({
  caption,
  columns,
  className,
  wrapperClassName,
  columnGroup,
  children,
}: AdminPanelTableProps) => (
  <div className={["admin-table__wrapper", wrapperClassName].filter(Boolean).join(" ")}>
    <table className={["admin-table", className].filter(Boolean).join(" ")}>
      <caption className="admin-table__caption">{caption}</caption>
      {columnGroup}
      <thead>
        <tr>
          {columns.map((column, index) => (
            <th key={index} scope="col">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  </div>
);

export default AdminPanelTable;
