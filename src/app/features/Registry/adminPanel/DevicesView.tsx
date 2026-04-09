import { useEffect, useRef, type KeyboardEvent } from "react";
import AdminPanelSearchField from "./AdminPanelSearchField";
import AdminPanelSection from "./AdminPanelSection";
import AdminPanelTable from "./AdminPanelTable";
import PendingDeviceAssignmentSection from "./PendingDeviceAssignmentSection";
import {
  formatPairingDeviceId,
  formatLastSeen,
  getConnectionLabel,
  getConnectionTone,
  getDeviceDisplayName,
  getDeviceSecondaryName,
} from "./helpers";
import type { Device, DeviceSortOption, Tone } from "./types";

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
  batchUpdating: boolean;
  selectedDeviceIds: number[];
  searchTerm: string;
  sortBy: DeviceSortOption;
  pairingCode: string;
  pairingSuggestions: Device[];
  pairingDevice: Device | null;
  pairingRoom: string;
  pairingRoomSuggestions: string[];
  pairingShowRoomSuggestions: boolean;
  pairingLookingUp: boolean;
  pairingAssigning: boolean;
  pairingSearchingRooms: boolean;
  pairingCodeTone: Tone;
  pairingRoomTone: Tone;
  pairingFeedback: string | null;
  pairingFeedbackTone: Tone;
  onSearchTermChange: (value: string) => void;
  onSortChange: (value: DeviceSortOption) => void;
  onDeleteSelectedDevices: () => void;
  onClearSelectedDevices: () => void;
  onToggleAllActiveDevices: (checked: boolean) => void;
  onToggleDeviceSelection: (deviceId: number) => void;
  onRefresh: () => void;
  onReloadTablets: () => void;
  onViewDevice: (device: Device) => void;
  onEditDevice: (device: Device) => void;
  onPreviewDevice: (device: Device) => void;
  onDeleteDevice: (device: Device) => void;
  onPairingCodeChange: (value: string) => void;
  onPairingSuggestionSelect: (device: Device) => void;
  onLookupPairingDevice: () => void;
  onResetPairing: () => void;
  onPairingRoomChange: (value: string) => void;
  onPairingRoomSuggestionSelect: (room: string) => void;
  onAssignPairingDevice: () => void;
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
  batchUpdating,
  selectedDeviceIds,
  searchTerm,
  sortBy,
  pairingCode,
  pairingSuggestions,
  pairingDevice,
  pairingRoom,
  pairingRoomSuggestions,
  pairingShowRoomSuggestions,
  pairingLookingUp,
  pairingAssigning,
  pairingSearchingRooms,
  pairingCodeTone,
  pairingRoomTone,
  pairingFeedback,
  pairingFeedbackTone,
  onSearchTermChange,
  onSortChange,
  onDeleteSelectedDevices,
  onClearSelectedDevices,
  onToggleAllActiveDevices,
  onToggleDeviceSelection,
  onRefresh,
  onReloadTablets,
  onViewDevice,
  onEditDevice,
  onPreviewDevice,
  onDeleteDevice,
  onPairingCodeChange,
  onPairingSuggestionSelect,
  onLookupPairingDevice,
  onResetPairing,
  onPairingRoomChange,
  onPairingRoomSuggestionSelect,
  onAssignPairingDevice,
}: DevicesViewProps) => {
  const hasSearchFilter = searchTerm.trim().length > 0;
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const selectedIds = new Set(selectedDeviceIds);
  const selectedCount = selectedDeviceIds.length;
  const allActiveSelected =
    activeDevices.length > 0 && activeDevices.every((device) => selectedIds.has(device.id));
  const partiallySelected =
    selectedCount > 0 &&
    activeDevices.some((device) => selectedIds.has(device.id)) &&
    !allActiveSelected;
  const statusItems = [
    { label: "Wszystkie", value: counts.all, tone: "neutral" },
    { label: "Online", value: counts.online, tone: "success" },
    { label: "Offline", value: counts.offline, tone: "danger" },
    { label: "Oczekujące", value: counts.pending, tone: "warning" },
  ] as const;

  const emptyStateTitle =
    loading && !hasSearchFilter ? "Ładowanie urządzeń" : hasSearchFilter ? "Brak wyników" : "Brak sparowanych tabletów";

  const emptyStateDescription =
    loading && !hasSearchFilter
      ? "Trwa pobieranie listy tabletów."
      : hasSearchFilter
        ? "Zmień filtr, aby zobaczyć sparowane urządzenia."
        : "Przypisz tablet kodem, aby pojawił się tutaj.";

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = partiallySelected;
    }
  }, [partiallySelected]);

  return (
    <div className="admin-devices-view">
      <div className="admin-devices-view__overview">
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

        <PendingDeviceAssignmentSection
          pendingDevicesCount={pendingDevices.length}
          codeValue={pairingCode}
          codeSuggestions={pairingSuggestions}
          selectedDevice={pairingDevice}
          roomValue={pairingRoom}
          roomSuggestions={pairingRoomSuggestions}
          showRoomSuggestions={pairingShowRoomSuggestions}
          isLookingUp={pairingLookingUp}
          isAssigning={pairingAssigning}
          isSearchingRooms={pairingSearchingRooms}
          codeTone={pairingCodeTone}
          roomTone={pairingRoomTone}
          feedback={pairingFeedback}
          feedbackTone={pairingFeedbackTone}
          onCodeChange={onPairingCodeChange}
          onCodeSuggestionSelect={onPairingSuggestionSelect}
          onLookup={onLookupPairingDevice}
          onReset={onResetPairing}
          onRoomChange={onPairingRoomChange}
          onRoomSuggestionSelect={onPairingRoomSuggestionSelect}
          onAssign={onAssignPairingDevice}
        />
      </div>

      {activeDevices.length === 0 ? (
        <div className="admin-table__wrapper admin-table__wrapper--full-width">
          <div className="admin-empty-state">
            <h3>{emptyStateTitle}</h3>
            <p>{emptyStateDescription}</p>
          </div>
        </div>
      ) : (
        <section className="admin-table-block" aria-labelledby="admin-active-devices-heading">
          <div className="admin-table-block__header">
            <h3 className="admin-table-block__title" id="admin-active-devices-heading">
              Sparowane tablety
            </h3>
          </div>

          <AdminPanelTable
            caption="Lista aktywnych tabletów"
            className="admin-table--devices admin-table--selectable"
            wrapperClassName="admin-table__wrapper--full-width admin-table__wrapper--active"
            columnGroup={
              <colgroup>
                <col className="admin-table__col admin-table__col--select" />
                <col className="admin-table__col admin-table__col--name" />
                <col className="admin-table__col admin-table__col--device-id" />
                <col className="admin-table__col admin-table__col--status" />
                <col className="admin-table__col admin-table__col--heartbeat" />
                <col className="admin-table__col admin-table__col--actions" />
              </colgroup>
            }
            columns={[
              <span className="admin-table__checkbox-header" key="select-all">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  className="admin-table__checkbox"
                  aria-label="Zaznacz wszystkie widoczne tablety"
                  checked={allActiveSelected}
                  onChange={(event) => onToggleAllActiveDevices(event.target.checked)}
                />
              </span>,
              "Sala / nazwa",
              "Device ID",
              "Status",
              "Ostatni heartbeat",
              <div className="admin-table__header-actions" key="actions">
                <span className="admin-table__header-count">
                  Zaznaczone: <strong>{selectedCount}</strong>
                </span>
                <button
                  type="button"
                  className="admin-button admin-button--danger admin-button--small"
                  onClick={onDeleteSelectedDevices}
                  disabled={batchUpdating || selectedCount === 0}
                >
                  Usuń zaznaczone
                </button>
                <button
                  type="button"
                  className="admin-button admin-button--ghost admin-button--small"
                  onClick={onClearSelectedDevices}
                  disabled={selectedCount === 0}
                >
                  Wyczyść
                </button>
              </div>,
            ]}
          >
            {activeDevices.map((device) => {
              const displayName = getDeviceDisplayName(device);
              const secondaryName = getDeviceSecondaryName(device);
              const isSelected = selectedIds.has(device.id);

              return (
                <tr
                  key={device.id}
                  className={`admin-table__row admin-table__row--interactive ${
                    isSelected ? "admin-table__row--selected" : ""
                  }`}
                  onClick={() => onViewDevice(device)}
                  onKeyDown={(event) => handleRowKeyDown(event, () => onViewDevice(device))}
                  tabIndex={0}
                  role="button"
                >
                  <td data-label="Zaznacz" className="admin-table__checkbox-cell">
                    <input
                      type="checkbox"
                      className="admin-table__checkbox"
                      aria-label={`Zaznacz tablet ${displayName}`}
                      checked={isSelected}
                      onChange={() => onToggleDeviceSelection(device.id)}
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    />
                  </td>
                  <td data-label="Sala / nazwa" className="admin-table__cell--name">
                    <div className="admin-table__primary">
                      <strong>{displayName}</strong>
                      {secondaryName ? (
                        <span className="admin-table__secondary">{secondaryName}</span>
                      ) : null}
                    </div>
                  </td>
                  <td data-label="Device ID" className="admin-table__cell--center">
                    <span className="admin-table__meta-code">
                      {formatPairingDeviceId(device.deviceId)}
                    </span>
                  </td>
                  <td data-label="Status" className="admin-table__cell--center">
                    <span
                      className={`admin-status-pill admin-status-pill--${getConnectionTone(device)}`}
                    >
                      {getConnectionLabel(device)}
                    </span>
                  </td>
                  <td data-label="Ostatni heartbeat" className="admin-table__cell--center">
                    <span className="admin-table__secondary">
                      {formatLastSeen(device.lastSeen)}
                    </span>
                  </td>
                  <td data-label="Akcje" className="admin-table__cell--actions">
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
                      <button
                        type="button"
                        className="admin-button admin-button--secondary admin-button--small"
                        onClick={(event) => {
                          event.stopPropagation();
                          onPreviewDevice(device);
                        }}
                      >
                        Podgląd
                      </button>
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
        </section>
      )}
    </div>
  );
};

export default DevicesView;
