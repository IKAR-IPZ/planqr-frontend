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
} from "./helpers";
import type { Device, DeviceSortColumn, DeviceSortState, Tone } from "./types";

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
  batchThemeUpdating: boolean;
  themeMutationDeviceId: number | null;
  batchThemeValue: Device["displayTheme"];
  selectedDeviceIds: number[];
  searchTerm: string;
  sortState: DeviceSortState;
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
  onSortColumn: (column: DeviceSortColumn) => void;
  onDeleteSelectedDevices: () => void;
  onBatchThemeValueChange: (value: Device["displayTheme"]) => void;
  onApplyBatchTheme: () => void;
  onClearSelectedDevices: () => void;
  onToggleAllActiveDevices: (checked: boolean) => void;
  onToggleDeviceSelection: (deviceId: number) => void;
  onRefresh: () => void;
  onReloadTablets: () => void;
  onViewDevice: (device: Device) => void;
  onEditDevice: (device: Device) => void;
  onPreviewDevice: (device: Device) => void;
  onDeviceThemeChange: (device: Device, theme: Device["displayTheme"]) => void;
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
  batchThemeUpdating,
  themeMutationDeviceId,
  batchThemeValue,
  selectedDeviceIds,
  searchTerm,
  sortState,
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
  onSortColumn,
  onDeleteSelectedDevices,
  onBatchThemeValueChange,
  onApplyBatchTheme,
  onClearSelectedDevices,
  onToggleAllActiveDevices,
  onToggleDeviceSelection,
  onRefresh,
  onReloadTablets,
  onViewDevice,
  onEditDevice,
  onPreviewDevice,
  onDeviceThemeChange,
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

  const getSortButtonState = (column: DeviceSortColumn) => {
    if (sortState.column !== column || !sortState.direction) {
      return {
        icon: "fas fa-sort",
        label: "Brak aktywnego sortowania",
        ariaSort: "none" as const,
        active: false,
      };
    }

    return {
      icon: sortState.direction === "desc" ? "fas fa-sort-down" : "fas fa-sort-up",
      label:
        sortState.direction === "desc" ? "Sortowanie malejące" : "Sortowanie rosnące",
      ariaSort: sortState.direction === "desc" ? ("descending" as const) : ("ascending" as const),
      active: true,
    };
  };

  const renderSortableHeader = (label: string, column: DeviceSortColumn) => {
    const sortButtonState = getSortButtonState(column);

    return {
      content: (
        <button
          type="button"
          className={`admin-table__sort-button${
            sortButtonState.active ? " admin-table__sort-button--active" : ""
          }`}
          onClick={() => onSortColumn(column)}
          aria-label={`${label}. ${sortButtonState.label}. Kliknij, aby zmienić sortowanie.`}
        >
          <span>{label}</span>
          <i className={sortButtonState.icon} aria-hidden="true" />
        </button>
      ),
      ariaSort: sortButtonState.ariaSort,
    };
  };

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
              placeholder="Sala, ID lub status"
              value={searchTerm}
              onChange={onSearchTermChange}
            />
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
                <col className="admin-table__col admin-table__col--theme" />
                <col className="admin-table__col admin-table__col--black-screen" />
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
              renderSortableHeader("Sala", "room"),
              renderSortableHeader("Device ID", "deviceId"),
              renderSortableHeader("Status", "status"),
              renderSortableHeader("Ostatni heartbeat", "lastSeen"),
              renderSortableHeader("Tryb", "displayTheme"),
              renderSortableHeader("Czarny ekran", "blackScreen"),
              <div className="admin-table__header-actions" key="actions">
                <span className="admin-table__header-count">
                  Zaznaczone: <strong>{selectedCount}</strong>
                </span>
                <label className="admin-form-field admin-form-field--compact admin-table__header-field">
                  <span className="admin-form-field__label">Batch tryb</span>
                  <select
                    className="admin-form-field__input"
                    value={batchThemeValue}
                    onChange={(event) =>
                      onBatchThemeValueChange(event.target.value as Device["displayTheme"])
                    }
                    disabled={batchThemeUpdating}
                  >
                    <option value="dark">Ciemny</option>
                    <option value="light">Jasny</option>
                  </select>
                </label>
                <button
                  type="button"
                  className="admin-button admin-button--secondary admin-button--small"
                  onClick={onApplyBatchTheme}
                  disabled={batchThemeUpdating || selectedCount === 0}
                >
                  {batchThemeUpdating ? "Zapisywanie" : "Zmień tryb"}
                </button>
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
                  <td data-label="Sala" className="admin-table__cell--name">
                    <div className="admin-table__primary">
                      <strong>{displayName}</strong>
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
                  <td data-label="Tryb" className="admin-table__cell--center">
                    <select
                      className="admin-form-field__input admin-table__theme-select"
                      value={device.displayTheme}
                      disabled={themeMutationDeviceId === device.id || batchThemeUpdating}
                      onChange={(event) =>
                        onDeviceThemeChange(
                          device,
                          event.target.value as Device["displayTheme"],
                        )
                      }
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <option value="dark">Ciemny</option>
                      <option value="light">Jasny</option>
                    </select>
                  </td>
                  <td data-label="Czarny ekran" className="admin-table__cell--center">
                    <span
                      className={`admin-status-pill admin-status-pill--${
                        device.forceBlackScreen ? "warning" : "neutral"
                      }`}
                    >
                      {device.forceBlackScreen ? "Włączony" : "Wyłączony"}
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
