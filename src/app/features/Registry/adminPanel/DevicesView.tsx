import AdminPanelSearchField from "./AdminPanelSearchField";
import AdminPanelSection from "./AdminPanelSection";
import AdminPanelTable from "./AdminPanelTable";
import {
  formatLastSeen,
  getConnectionLabel,
  getConnectionTone,
} from "./helpers";
import type { Device, DeviceSortOption } from "./types";

const sortOptions: Array<{ value: DeviceSortOption; label: string }> = [
  { value: "status", label: "Status" },
  { value: "name", label: "Nazwa / sala" },
  { value: "lastSeen", label: "Ostatni heartbeat" },
];

interface DevicesViewProps {
  activeDevices: Device[];
  pendingDevices: Device[];
  loading: boolean;
  searchTerm: string;
  sortBy: DeviceSortOption;
  onSearchTermChange: (value: string) => void;
  onSortChange: (value: DeviceSortOption) => void;
  onRefresh: () => void;
  onViewDevice: (device: Device) => void;
  onEditDevice: (device: Device) => void;
  onAuthorizeDevice: (device: Device) => void;
  onRejectDevice: (device: Device) => void;
}

const DevicesView = ({
  activeDevices,
  pendingDevices,
  loading,
  searchTerm,
  sortBy,
  onSearchTermChange,
  onSortChange,
  onRefresh,
  onViewDevice,
  onEditDevice,
  onAuthorizeDevice,
  onRejectDevice,
}: DevicesViewProps) => {
  const hasSearchFilter = searchTerm.trim().length > 0;

  return (
    <>
      <AdminPanelSection
        eyebrow="Operacje"
        title="Lista tabletów"
        description="Szukaj po nazwie, sali, identyfikatorze lub statusie. Widok jest zoptymalizowany pod większą liczbę urządzeń."
        actions={
          <button
            type="button"
            className="admin-button admin-button--secondary admin-button--small"
            onClick={onRefresh}
            disabled={loading}
          >
            <i className={`fas fa-sync-alt ${loading ? "fa-spin" : ""}`} aria-hidden="true" />
            {loading ? "Odświeżanie..." : "Odśwież"}
          </button>
        }
      >
        <div className="admin-toolbar">
          <AdminPanelSearchField
            label="Wyszukiwarka"
            placeholder="Szukaj po sali, nazwie lub ID tabletu"
            value={searchTerm}
            onChange={onSearchTermChange}
          />
          <label className="admin-form-field admin-form-field--compact">
            <span className="admin-form-field__label">Sortowanie</span>
            <select
              className="admin-form-field__input"
              value={sortBy}
              onChange={(event) => onSortChange(event.target.value as DeviceSortOption)}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="admin-toolbar__meta">
          <span>{activeDevices.length} sparowanych urządzeń w bieżącym widoku</span>
          <span>{pendingDevices.length} oczekujących na akceptację</span>
        </div>
      </AdminPanelSection>

      <AdminPanelSection
        eyebrow="Akceptacja"
        title="Nowe urządzenia"
        description="Kolejka oczekujących tabletów do autoryzacji i przypisania do sal."
      >
        {pendingDevices.length === 0 ? (
          <div className="admin-empty-state">
            <h3>Brak nowych urządzeń</h3>
            <p>Nowe tablety pojawią się tutaj automatycznie po zgłoszeniu do rejestru.</p>
          </div>
        ) : (
          <AdminPanelTable
            caption="Kolejka oczekujących urządzeń"
            columns={["Tablet", "Stan", "Opis", "Akcje"]}
          >
            {pendingDevices.map((device) => (
              <tr key={device.id}>
                <td data-label="Tablet">
                  <div className="admin-table__primary">
                    <strong>{device.deviceName || "Nowy tablet"}</strong>
                    <span className="admin-table__meta-code">{device.deviceId}</span>
                  </div>
                </td>
                <td data-label="Stan">
                  <span className="admin-status-pill admin-status-pill--warning">
                    {getConnectionLabel(device)}
                  </span>
                </td>
                <td data-label="Opis">
                  <span className="admin-table__secondary">
                    Urządzenie nie ma jeszcze przypisanej sali i wymaga decyzji operatora.
                  </span>
                </td>
                <td data-label="Akcje">
                  <div className="admin-table__actions">
                    <button
                      type="button"
                      className="admin-button admin-button--primary admin-button--small"
                      onClick={() => onAuthorizeDevice(device)}
                    >
                      Autoryzuj
                    </button>
                    <button
                      type="button"
                      className="admin-button admin-button--ghost admin-button--small"
                      onClick={() => onViewDevice(device)}
                    >
                      Szczegóły
                    </button>
                    <button
                      type="button"
                      className="admin-button admin-button--danger admin-button--small"
                      onClick={() => onRejectDevice(device)}
                    >
                      Odrzuć
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </AdminPanelTable>
        )}
      </AdminPanelSection>

      <AdminPanelSection
        eyebrow="Rejestr"
        title="Zarejestrowane tablety"
        description="Widok operacyjny do codziennej pracy z aktywnymi urządzeniami."
      >
        {activeDevices.length === 0 ? (
          <div className="admin-empty-state">
            <h3>{hasSearchFilter ? "Brak wyników" : "Brak sparowanych urządzeń"}</h3>
            <p>
              {hasSearchFilter
                ? "Zmień lub wyczyść filtr, aby zobaczyć więcej urządzeń."
                : "Po sparowaniu tabletu pojawi się on w tej liście."}
            </p>
          </div>
        ) : (
          <AdminPanelTable
            caption="Lista aktywnych urządzeń"
            columns={["Tablet", "Status", "Lokalizacja", "Ostatni heartbeat", "Akcje"]}
          >
            {activeDevices.map((device) => {
              const roomLabel =
                device.deviceClassroom || device.deviceName || device.deviceId;
              const department = roomLabel.split(" ")[0] || "WI";

              return (
                <tr key={device.id}>
                  <td data-label="Tablet">
                    <div className="admin-table__primary">
                      <strong>
                        {device.deviceName || device.deviceClassroom || "Tablet bez nazwy"}
                      </strong>
                      <span className="admin-table__meta-code">{device.deviceId}</span>
                    </div>
                  </td>
                  <td data-label="Status">
                    <span
                      className={`admin-status-pill admin-status-pill--${getConnectionTone(device)}`}
                    >
                      {getConnectionLabel(device)}
                    </span>
                  </td>
                  <td data-label="Lokalizacja">
                    <span className="admin-table__secondary">
                      {device.deviceClassroom || "Brak przypisanej sali"}
                    </span>
                  </td>
                  <td data-label="Ostatni heartbeat">
                    <span className="admin-table__secondary">
                      {formatLastSeen(device.lastSeen)}
                    </span>
                  </td>
                  <td data-label="Akcje">
                    <div className="admin-table__actions">
                      <button
                        type="button"
                        className="admin-button admin-button--ghost admin-button--small"
                        onClick={() => onViewDevice(device)}
                      >
                        Szczegóły
                      </button>
                      <button
                        type="button"
                        className="admin-button admin-button--secondary admin-button--small"
                        onClick={() => onEditDevice(device)}
                      >
                        Edytuj
                      </button>
                      <a
                        className="admin-button admin-button--primary admin-button--small"
                        href={`/room/${encodeURIComponent(department)}/${encodeURIComponent(
                          roomLabel,
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Plan sali
                      </a>
                    </div>
                  </td>
                </tr>
              );
            })}
          </AdminPanelTable>
        )}
      </AdminPanelSection>
    </>
  );
};

export default DevicesView;
