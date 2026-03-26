import AdminPanelSection from "./AdminPanelSection";
import AdminPanelTable from "./AdminPanelTable";
import { formatAdminDate, getAdminSourceLabel } from "./helpers";
import type { AdminRecord } from "./types";

interface AdminsViewProps {
  admins: AdminRecord[];
  adminsLoading: boolean;
  adminMutationLoading: boolean;
  newAdminUsername: string;
  adminFeedback: string | null;
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
  onUsernameChange,
  onAddAdmin,
  onRefreshAdmins,
  onRemoveAdmin,
}: AdminsViewProps) => (
  <>
    <AdminPanelSection
      eyebrow="Dostępy"
      title="Dodaj administratora"
      description="Nadaj dostęp do panelu na podstawie loginu LDAP. Uprawnienie zapisuje się w bazie i działa po zalogowaniu użytkownika."
    >
      <div className="admin-card admin-card--form">
        <div className="admin-inline-form">
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
          <button
            type="button"
            className="admin-button admin-button--primary"
            onClick={onAddAdmin}
            disabled={adminMutationLoading || !newAdminUsername.trim()}
          >
            <i className="fas fa-user-plus" aria-hidden="true" />
            {adminMutationLoading ? "Zapisywanie..." : "Nadaj uprawnienia"}
          </button>
        </div>
        <p className="admin-card__hint">
          Użytkownicy dodani z panelu mogą być później usunięci bezpośrednio z tej samej sekcji.
        </p>
        {adminFeedback ? <p className="admin-feedback">{adminFeedback}</p> : null}
      </div>
    </AdminPanelSection>

    <AdminPanelSection
      eyebrow="Lista"
      title="Aktualni administratorzy"
      description="Pełny wykaz kont z rozróżnieniem źródła uprawnienia oraz możliwością usunięcia pozycji dodanych z panelu."
      actions={
        <button
          type="button"
          className="admin-button admin-button--secondary admin-button--small"
          onClick={onRefreshAdmins}
          disabled={adminsLoading || adminMutationLoading}
        >
          <i className={`fas fa-sync-alt ${adminsLoading ? "fa-spin" : ""}`} aria-hidden="true" />
          {adminsLoading ? "Odświeżanie..." : "Odśwież listę"}
        </button>
      }
    >
      {adminsLoading ? (
        <div className="admin-empty-state">
          <h3>Trwa pobieranie administratorów</h3>
          <p>Lista uprawnień jest aktualizowana z backendu.</p>
        </div>
      ) : admins.length === 0 ? (
        <div className="admin-empty-state">
          <h3>Brak administratorów</h3>
          <p>Dodaj pierwsze konto administracyjne, aby udostępnić panel kolejnym operatorom.</p>
        </div>
      ) : (
        <AdminPanelTable
          caption="Lista administratorów"
          columns={["Administrator", "Źródło", "Utworzono", "Ostatnia zmiana", "Akcje"]}
        >
          {admins.map((admin) => (
            <tr key={admin.id}>
              <td data-label="Administrator">
                <div className="admin-table__primary">
                  <strong>{admin.username}</strong>
                  <span className="admin-table__secondary">
                    {admin.isCurrentUser ? "Bieżąca sesja" : admin.role}
                  </span>
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
                  <span className="admin-table__secondary">Zarządzane poza panelem</span>
                )}
              </td>
            </tr>
          ))}
        </AdminPanelTable>
      )}
    </AdminPanelSection>
  </>
);

export default AdminsView;
