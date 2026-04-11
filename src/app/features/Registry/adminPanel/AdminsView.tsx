import AdminPanelSection from "./AdminPanelSection";
import AdminPanelTable from "./AdminPanelTable";
import { formatAdminDate, getAdminSourceLabel } from "./helpers";
import type { AdminRecord, Tone } from "./types";

interface AdminsViewProps {
  admins: AdminRecord[];
  adminsLoading: boolean;
  adminMutationLoading: boolean;
  newAdminUsername: string;
  adminFeedback: string | null;
  adminFeedbackTone: Tone;
  onUsernameChange: (value: string) => void;
  onAddAdmin: () => void;
  onRefreshAdmins: () => void;
  onRemoveAdmin: (admin: AdminRecord) => void;
}

const AdminsView = ({
  admins,
  adminsLoading,
  adminMutationLoading,
  newAdminUsername,
  adminFeedback,
  adminFeedbackTone,
  onUsernameChange,
  onAddAdmin,
  onRefreshAdmins,
  onRemoveAdmin,
}: AdminsViewProps) => (
  <AdminPanelSection
    title="Administratorzy"
    actions={
      <button
        type="button"
        className="admin-button admin-button--secondary admin-button--small"
        onClick={onRefreshAdmins}
        disabled={adminsLoading || adminMutationLoading}
      >
        <i className={`fas fa-sync-alt ${adminsLoading ? "fa-spin" : ""}`} aria-hidden="true" />
        {adminsLoading ? "Odświeżanie" : "Odśwież"}
      </button>
    }
  >
    <div className="admin-toolbar">
      <label className="admin-form-field admin-form-field--grow">
        <span className="admin-form-field__label">Login LDAP</span>
        <input
          className="admin-form-field__input"
          type="text"
          placeholder="np. gr55764"
          value={newAdminUsername}
          onChange={(event) => onUsernameChange(event.target.value)}
          autoComplete="off"
        />
      </label>
      <div className="admin-toolbar__actions">
        <button
          type="button"
          className="admin-button admin-button--primary"
          onClick={onAddAdmin}
          disabled={adminMutationLoading || !newAdminUsername.trim()}
        >
          <i className="fas fa-user-plus" aria-hidden="true" />
          {adminMutationLoading ? "Zapisywanie" : "Dodaj"}
        </button>
      </div>
    </div>

    {adminFeedback ? (
      <p className={`admin-feedback admin-feedback--${adminFeedbackTone}`}>
        {adminFeedback}
      </p>
    ) : null}

    {adminsLoading ? (
      <div className="admin-empty-state">
        <h3>Ładowanie</h3>
        <p>Trwa pobieranie listy administratorów.</p>
      </div>
    ) : admins.length === 0 ? (
      <div className="admin-empty-state">
        <h3>Brak administratorów</h3>
        <p>Dodaj konto LDAP, aby umieścić je na liście administratorów.</p>
      </div>
    ) : (
      <AdminPanelTable
        caption="Lista administratorów"
        wrapperClassName="admin-table__wrapper--full-width admin-table__wrapper--list"
        columns={["Login", "Źródło", "Utworzono", "Ostatnia zmiana", "Akcje"]}
      >
        {admins.map((admin) => (
          <tr key={admin.id} className="admin-table__row">
            <td data-label="Login">
              <div className="admin-table__primary">
                <strong>{admin.username}</strong>
                {admin.isCurrentUser ? (
                  <span className="admin-table__secondary">Bieżąca sesja</span>
                ) : null}
              </div>
            </td>
            <td data-label="Źródło">
              <span className="admin-status-pill admin-status-pill--neutral">
                {getAdminSourceLabel(admin.adminSource)}
              </span>
            </td>
            <td data-label="Utworzono">
              <span className="admin-table__secondary">
                {formatAdminDate(admin.createdAt) || "brak danych"}
              </span>
            </td>
            <td data-label="Ostatnia zmiana">
              <span className="admin-table__secondary">
                {formatAdminDate(admin.updatedAt) || "brak danych"}
              </span>
            </td>
            <td data-label="Akcje">
              {admin.adminSource === "panel" ? (
                <button
                  type="button"
                  className="admin-button admin-button--danger admin-button--small"
                  onClick={() => onRemoveAdmin(admin)}
                  disabled={
                    adminMutationLoading ||
                    !admin.canBeRemovedFromPanel ||
                    admins.length <= 1
                  }
                  title={
                    admin.isCurrentUser
                      ? "Nie możesz usunąć samemu sobie uprawnień administratora."
                      : admins.length <= 1
                        ? "Nie można usunąć ostatniego administratora."
                        : "Usuń administratora"
                  }
                >
                  Usuń
                </button>
              ) : (
                <span className="admin-table__secondary">Poza panelem</span>
              )}
            </td>
          </tr>
        ))}
      </AdminPanelTable>
    )}
  </AdminPanelSection>
);

export default AdminsView;
