import { useMemo } from "react";
import AdminPanelSearchField from "./AdminPanelSearchField";
import AdminPanelSection from "./AdminPanelSection";
import AdminPanelTable from "./AdminPanelTable";
import {
  formatLastSeen,
  formatPairingDeviceId,
  getConnectionLabel,
  getConnectionTone,
} from "./helpers";
import type { Device } from "./types";

interface PendingTabletsViewProps {
  devices: Device[];
  loading: boolean;
  manualRefreshing: boolean;
  banningDeviceId: number | null;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onRefresh: () => void;
  onPairDevice: (device: Device) => void;
  onDeleteDevice: (device: Device) => void;
  onBanDeviceIp: (device: Device) => void;
}

const getDeviceIpLabel = (device: Device) => device.lastIpAddress?.trim() || "brak danych";

const PendingTabletsView = ({
  devices,
  loading,
  manualRefreshing,
  banningDeviceId,
  searchTerm,
  onSearchTermChange,
  onRefresh,
  onPairDevice,
  onDeleteDevice,
  onBanDeviceIp,
}: PendingTabletsViewProps) => {
  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const visibleDevices = useMemo(() => {
    const sortedDevices = [...devices].sort(
      (left, right) => new Date(right.lastSeen).getTime() - new Date(left.lastSeen).getTime(),
    );

    if (!normalizedSearchTerm) {
      return sortedDevices;
    }

    return sortedDevices.filter((device) => {
      const searchableValue = [
        device.deviceId,
        formatPairingDeviceId(device.deviceId),
        getDeviceIpLabel(device),
        getConnectionLabel(device),
        formatLastSeen(device.lastSeen),
      ]
        .join(" ")
        .toLowerCase();

      return searchableValue.includes(normalizedSearchTerm);
    });
  }, [devices, normalizedSearchTerm]);

  const emptyStateTitle = loading ? "Ładowanie oczekujących tabletów" : "Brak oczekujących tabletów";
  const emptyStateDescription = loading
    ? "Trwa pobieranie listy urządzeń."
    : "Nowe tablety pojawią się tutaj po pierwszym połączeniu z rejestrem.";

  return (
    <div className="admin-pending-tablets-view">
      <AdminPanelSection
        className="admin-pending-tablets-view__list"
        title="Oczekujące tablety"
        actions={
          <div className="admin-table__header-actions">
            <span className="admin-table__header-count">
              W kolejce: <strong>{devices.length}</strong>
            </span>
            <AdminPanelSearchField
              label="Szukaj"
              placeholder="Kod, IP lub status"
              value={searchTerm}
              onChange={onSearchTermChange}
              compact
            />
            <button
              type="button"
              className="admin-button admin-button--secondary admin-button--small"
              onClick={onRefresh}
              disabled={manualRefreshing}
            >
              <i
                className={`fas fa-sync-alt ${manualRefreshing ? "fa-spin" : ""}`}
                aria-hidden="true"
              />
              Odśwież
            </button>
          </div>
        }
      >
        {visibleDevices.length === 0 ? (
          <div className="admin-empty-state">
            <h3>{normalizedSearchTerm ? "Brak wyników" : emptyStateTitle}</h3>
            <p>
              {normalizedSearchTerm
                ? "Zmień wyszukiwanie, aby zobaczyć inne oczekujące tablety."
                : emptyStateDescription}
            </p>
          </div>
        ) : (
          <AdminPanelTable
            caption="Lista tabletów oczekujących na sparowanie"
            className="admin-table--pending admin-table--pending-tablets"
            wrapperClassName="admin-table__wrapper--pending"
            columns={[
              { content: "Kod parowania", className: "admin-table__col--device-id" },
              { content: "IP tabletu", className: "admin-table__col--ip" },
              { content: "Status", className: "admin-table__col--status" },
              { content: "Ostatni heartbeat", className: "admin-table__col--heartbeat" },
              { content: "Akcje", className: "admin-table__col--actions" },
            ]}
          >
            {visibleDevices.map((device) => {
              const ipAddress = getDeviceIpLabel(device);
              const canBanIp = ipAddress !== "brak danych" && ipAddress !== "unknown";
              const isBanning = banningDeviceId === device.id;

              return (
                <tr key={device.id}>
                  <td data-label="Kod parowania" className="admin-table__cell--center">
                    <span className="admin-table__meta-code">
                      {formatPairingDeviceId(device.deviceId)}
                    </span>
                  </td>
                  <td data-label="IP tabletu" className="admin-table__cell--center">
                    <span className="admin-table__secondary">{ipAddress}</span>
                  </td>
                  <td data-label="Status" className="admin-table__cell--center">
                    <span className={`admin-status-pill admin-status-pill--${getConnectionTone(device)}`}>
                      {getConnectionLabel(device)}
                    </span>
                  </td>
                  <td data-label="Ostatni heartbeat" className="admin-table__cell--center">
                    <span className="admin-table__secondary">
                      {formatLastSeen(device.lastSeen)}
                    </span>
                  </td>
                  <td data-label="Akcje" className="admin-table__cell--actions">
                    <div className="admin-table__actions admin-table__actions--inline">
                      <button
                        type="button"
                        className="admin-button admin-button--primary admin-button--small admin-button--icon"
                        aria-label={`Sparuj tablet ${formatPairingDeviceId(device.deviceId)}`}
                        title="Sparuj"
                        onClick={() => onPairDevice(device)}
                      >
                        <i className="fas fa-link" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="admin-button admin-button--danger admin-button--small admin-button--icon"
                        aria-label={`Usuń tablet ${formatPairingDeviceId(device.deviceId)}`}
                        title="Usuń"
                        onClick={() => onDeleteDevice(device)}
                      >
                        <i className="fas fa-trash-alt" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="admin-button admin-button--danger admin-button--small admin-button--icon"
                        aria-label={`Zbanuj IP tabletu ${formatPairingDeviceId(device.deviceId)}`}
                        title="Zbanuj IP"
                        onClick={() => onBanDeviceIp(device)}
                        disabled={!canBanIp || isBanning}
                      >
                        <i
                          className={isBanning ? "fas fa-spinner fa-spin" : "fas fa-ban"}
                          aria-hidden="true"
                        />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </AdminPanelTable>
        )}
      </AdminPanelSection>
    </div>
  );
};

export default PendingTabletsView;
