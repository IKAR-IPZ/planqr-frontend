import type { ReactNode } from "react";

interface AdminPanelTableProps {
  caption: string;
  columns: string[];
  children: ReactNode;
}

const AdminPanelTable = ({
  caption,
  columns,
  children,
}: AdminPanelTableProps) => (
  <div className="admin-table__wrapper">
    <table className="admin-table">
      <caption className="admin-table__caption">{caption}</caption>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column} scope="col">
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
