import type { KeyboardEvent } from "react";
import AdminPanelSearchField from "./AdminPanelSearchField";
import AdminPanelSection from "./AdminPanelSection";
import AdminPanelTable from "./AdminPanelTable";
import {
  formatLastSeen,
  getConnectionLabel,
  getConnectionTone,
  getDeviceDisplayName,
  getDeviceSecondaryName,
} from "./helpers";
import type { Device, DeviceSortOption } from "./types";

const sortOptions: Array<{ value: DeviceSortOption; label: string }> = [
  { value: "status", label: "Status" },
  { value: "name", label: "Sala / nazwa" },
  { value: "lastSeen", label: "Ostatni heartbeat" },
];

interface DeviceCounts {
  all: number;
  online: number;
  offline: number;
  pending: number;
}

interface DevicesViewProps {
  activeDevices: Device[];
  pendingDevices: Device[];
  counts: DeviceCounts;
  loading: boolean;
  manualRefreshing: boolean;
  reloadingTablets: boolean;
  searchTerm: string;
  sortBy: DeviceSortOption;
  onSearchTermChange: (value: string) => void;
  onSortChange: (value: DeviceSortOption) => void;
  onRefresh: () => void;
  onReloadTablets: () => void;
  onViewDevice: (device: Device) => void;
  onEditDevice: (device: Device) => void;
  onAuthorizeDevice: (device: Device) => void;
  onDeleteDevice: (device: Device) => void;
}

const handleRowKeyDown = (
  event: KeyboardEvent<HTMLTableRowElement>,
  onOpen: () => void,
) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    onOpen();
  }
};

const DevicesView = ({
  activeDevices,
  pendingDevices,
  counts,
  loading,
  manualRefreshing,
  reloadingTablets,
  searchTerm,
  sortBy,
  onSearchTermChange,
  onSortChange,
  onRefresh,
  onReloadTablets,
  onViewDevice,
  onEditDevice,
  onAuthorizeDevice,
  onDeleteDevice,
}: DevicesViewProps) => {
  const hasSearchFilter = searchTerm.trim().length > 0;
  const statusItems = [
    { label: "Wszystkie", value: counts.all, tone: "neutral" },
    { label: "Online", value: counts.online, tone: "success" },
    { label: "Offline", value: counts.offline, tone: "danger" },
    { label: "Oczekujące", value: counts.pending, tone: "warning" },
  ] as const;

  return (
    <>
      <AdminPanelSection title="Tablety">
        <div className="admin-toolbar">
          <AdminPanelSearchField
            label="Szukaj"
            placeholder="Sala, nazwa, ID lub status"
            value={searchTerm}
            onChange={onSearchTermChange}
          />
          <label className="admin-form-field admin-form-field--compact">
            <span className="admin-form-field__label">Sortuj</span>
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
          <div className="admin-toolbar__actions">
            <button
              type="button"
              className="admin-button admin-button--secondary"
              onClick={onRefresh}
              disabled={manualRefreshing}
            >
              <i
                className={`fas fa-sync-alt ${manualRefreshing ? "fa-spin" : ""}`}
                aria-hidden="true"
              />
              Odśwież
            </button>
            <button
              type="button"
              className="admin-button admin-button--primary"
              onClick={onReloadTablets}
              disabled={reloadingTablets}
            >
              <i
                className={`fas fa-bolt ${reloadingTablets ? "fa-spin" : ""}`}
                aria-hidden="true"
              />
              {reloadingTablets ? "Wysyłanie" : "Przeładuj tablety"}
            </button>
          </div>
        </div>

        <div className="admin-status-strip" aria-label="Status urządzeń">
          {statusItems.map((item) => (
            <div
              key={item.label}
              className={`admin-status-strip__item admin-status-strip__item--${item.tone}`}
            >
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      </AdminPanelSection>

      {pendingDevices.length > 0 ? (
        <AdminPanelSection title="Oczekujące">
          <AdminPanelTable
            caption="Lista oczekujących urządzeń"
            columns={["Tablet", "Device ID", "Status", "Akcje"]}
          >
            {pendingDevices.map((device) => (
              <tr
                key={device.id}
                className="admin-table__row admin-table__row--interactive"
                onClick={() => onViewDevice(device)}
                onKeyDown={(event) => handleRowKeyDown(event, () => onViewDevice(device))}
                tabIndex={0}
                role="button"
              >
                <td data-label="Tablet">
                  <div className="admin-table__primary">
                    <strong>{getDeviceDisplayName(device)}</strong>
                  </div>
                </td>
                <td data-label="Device ID">
                  <span className="admin-table__meta-code">{device.deviceId}</span>
                </td>
                <td data-label="Status">
                  <span className="admin-status-pill admin-status-pill--warning">
                    {getConnectionLabel(device)}
                  </span>
                </td>
                <td data-label="Akcje">
                  <div className="admin-table__actions">
                    <button
                      type="button"
                      className="admin-button admin-button--ghost admin-button--small"
                      onClick={(event) => {
                        event.stopPropagation();
                        onViewDevice(device);
                      }}
                    >
                      Szczegóły
                    </button>
                    <button
                      type="button"
                      className="admin-button admin-button--primary admin-button--small"
                      onClick={(event) => {
                        event.stopPropagation();
                        onAuthorizeDevice(device);
                      }}
                    >
                      Autoryzuj
                    </button>
                    <button
                      type="button"
                      className="admin-button admin-button--danger admin-button--small"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDeleteDevice(device);
                      }}
                    >
                      Odrzuć
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </AdminPanelTable>
        </AdminPanelSection>
      ) : null}

      <AdminPanelSection title="Aktywne">
        {activeDevices.length === 0 ? (
          <div className="admin-empty-state">
            <h3>
              {loading && !hasSearchFilter
                ? "Ładowanie urządzeń"
                : hasSearchFilter
                  ? "Brak wyników"
                  : "Brak urządzeń"}
            </h3>
            <p>
              {loading && !hasSearchFilter
                ? "Trwa pobieranie listy tabletów."
                : hasSearchFilter
                ? "Zmień filtr, aby zobaczyć urządzenia."
                : "Po sparowaniu tabletów pojawią się tutaj."}
            </p>
          </div>
        ) : (
          <AdminPanelTable
            caption="Lista aktywnych tabletów"
            columns={["Sala / nazwa", "Device ID", "Status", "Ostatni heartbeat", "Akcje"]}
          >
            {activeDevices.map((device) => {
              const displayName = getDeviceDisplayName(device);
              const secondaryName = getDeviceSecondaryName(device);

              return (
                <tr
                  key={device.id}
                  className="admin-table__row admin-table__row--interactive"
                  onClick={() => onViewDevice(device)}
                  onKeyDown={(event) => handleRowKeyDown(event, () => onViewDevice(device))}
                  tabIndex={0}
                  role="button"
                >
                  <td data-label="Sala / nazwa">
                    <div className="admin-table__primary">
                      <strong>{displayName}</strong>
                      {secondaryName ? (
                        <span className="admin-table__secondary">{secondaryName}</span>
                      ) : null}
                    </div>
                  </td>
                  <td data-label="Device ID">
                    <span className="admin-table__meta-code">{device.deviceId}</span>
                  </td>
                  <td data-label="Status">
                    <span
                      className={`admin-status-pill admin-status-pill--${getConnectionTone(device)}`}
                    >
                      {getConnectionLabel(device)}
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
                        onClick={(event) => {
                          event.stopPropagation();
                          onViewDevice(device);
                        }}
                      >
                        Szczegóły
                      </button>
                      <button
                        type="button"
                        className="admin-button admin-button--secondary admin-button--small"
                        onClick={(event) => {
                          event.stopPropagation();
                          onEditDevice(device);
                        }}
                      >
                        Edytuj
                      </button>
                      <a
                        className="admin-button admin-button--secondary admin-button--small"
                        href={`/room/${encodeURIComponent(
                          (device.deviceClassroom || device.deviceName || "WI").split(" ")[0] || "WI",
                        )}/${encodeURIComponent(device.deviceClassroom || device.deviceName || device.deviceId)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(event) => event.stopPropagation()}
                      >
                        Plan
                      </a>
                      <button
                        type="button"
                        className="admin-button admin-button--danger admin-button--small"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDeleteDevice(device);
                        }}
                      >
                        Usuń
                      </button>
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
