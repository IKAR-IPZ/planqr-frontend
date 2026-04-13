import { useEffect, useRef } from "react";
import AdminPanelSearchField from "./AdminPanelSearchField";
import AdminDevicesTable from "./AdminDevicesTable";
import AdminPanelSection from "./AdminPanelSection";
import PendingDeviceAssignmentSection from "./PendingDeviceAssignmentSection";
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
  batchBlackScreenUpdating: boolean;
  themeMutationDeviceId: number | null;
  blackScreenMutationDeviceId: number | null;
  batchThemeValue: Device["displayTheme"];
  batchBlackScreenValue: Device["blackScreenMode"];
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
  onSearchTermChange: (value: string) => void;
  onSortColumn: (column: DeviceSortColumn) => void;
  onDeleteSelectedDevices: () => void;
  onBatchThemeValueChange: (value: Device["displayTheme"]) => void;
  onBatchBlackScreenValueChange: (value: Device["blackScreenMode"]) => void;
  onApplyBatchTheme: () => void;
  onApplyBatchBlackScreen: () => void;
  onClearSelectedDevices: () => void;
  onToggleAllActiveDevices: (checked: boolean) => void;
  onToggleDeviceSelection: (deviceId: number) => void;
  onRefresh: () => void;
  onReloadTablets: () => void;
  onViewDevice: (device: Device) => void;
  onEditDevice: (device: Device) => void;
  onPreviewDevice: (device: Device) => void;
  onDeviceThemeChange: (device: Device, theme: Device["displayTheme"]) => void;
  onDeviceBlackScreenModeChange: (
    device: Device,
    blackScreenMode: Device["blackScreenMode"],
  ) => void;
  onDeleteDevice: (device: Device) => void;
  onPairingCodeChange: (value: string) => void;
  onPairingSuggestionSelect: (device: Device) => void;
  onLookupPairingDevice: () => void;
  onResetPairing: () => void;
  onPairingRoomChange: (value: string) => void;
  onPairingRoomSuggestionSelect: (room: string) => void;
  onAssignPairingDevice: () => void;
}

const DevicesView = ({
  activeDevices,
  pendingDevices,
  counts,
  loading,
  manualRefreshing,
  reloadingTablets,
  batchUpdating,
  batchThemeUpdating,
  batchBlackScreenUpdating,
  themeMutationDeviceId,
  blackScreenMutationDeviceId,
  batchThemeValue,
  batchBlackScreenValue,
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
  onSearchTermChange,
  onSortColumn,
  onDeleteSelectedDevices,
  onBatchThemeValueChange,
  onBatchBlackScreenValueChange,
  onApplyBatchTheme,
  onApplyBatchBlackScreen,
  onClearSelectedDevices,
  onToggleAllActiveDevices,
  onToggleDeviceSelection,
  onRefresh,
  onReloadTablets,
  onViewDevice,
  onEditDevice,
  onPreviewDevice,
  onDeviceThemeChange,
  onDeviceBlackScreenModeChange,
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
  const hasPairedDevices = counts.online + counts.offline > 0;
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

  const pairedDevicesTitle =
    selectedCount > 0 ? `Sparowane tablety (${selectedCount})` : "Sparowane tablety";

  const batchActionsContent = hasPairedDevices ? (
    <>
      <label className="admin-form-field admin-form-field--compact admin-table__header-field">
        <select
          className="admin-form-field__input"
          aria-label="Batchowa zmiana trybu tabletu"
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
      <label className="admin-form-field admin-form-field--compact admin-table__header-field">
        <select
          className="admin-form-field__input"
          aria-label="Batchowa zmiana czarnego ekranu"
          value={batchBlackScreenValue}
          onChange={(event) =>
            onBatchBlackScreenValueChange(event.target.value as Device["blackScreenMode"])
          }
          disabled={batchBlackScreenUpdating}
        >
          <option value="on">Włączony</option>
          <option value="off">Wyłączony</option>
          <option value="follow">Harmonogram</option>
        </select>
      </label>
      <button
        type="button"
        className="admin-button admin-button--secondary admin-button--small"
        onClick={onApplyBatchBlackScreen}
        disabled={batchBlackScreenUpdating || selectedCount === 0}
      >
        {batchBlackScreenUpdating ? "Zapisywanie" : "Ustaw czarny ekran"}
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
    </>
  ) : null;

  return (
    <div className="admin-devices-view">
      <div className="admin-devices-view__overview">
        <AdminPanelSection title="Tablety">
          <div className="admin-toolbar admin-toolbar--devices">
            <AdminPanelSearchField
              label="Szukaj"
              placeholder="Sala, wydział, ID lub status"
              value={searchTerm}
              onChange={onSearchTermChange}
            />
            <div className="admin-toolbar__actions">
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
              <button
                type="button"
                className="admin-button admin-button--primary admin-button--small"
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
          onCodeChange={onPairingCodeChange}
          onCodeSuggestionSelect={onPairingSuggestionSelect}
          onLookup={onLookupPairingDevice}
          onReset={onResetPairing}
          onRoomChange={onPairingRoomChange}
          onRoomSuggestionSelect={onPairingRoomSuggestionSelect}
          onAssign={onAssignPairingDevice}
        />
      </div>

      <AdminPanelSection
        className="admin-devices-view__list"
        title={pairedDevicesTitle}
        actions={
          hasPairedDevices ? (
            <div className="admin-table__batch-actions">{batchActionsContent}</div>
          ) : undefined
        }
      >
        {activeDevices.length === 0 ? (
          <div className="admin-empty-state">
            <h3>{emptyStateTitle}</h3>
            <p>{emptyStateDescription}</p>
          </div>
        ) : (
          <AdminDevicesTable
            caption="Lista aktywnych tabletów"
            devices={activeDevices}
            sortState={sortState}
            desktopBatchActions={batchActionsContent}
            desktopPinnedTitle={pairedDevicesTitle}
            selectAllRef={selectAllRef}
            allActiveSelected={allActiveSelected}
            selectedIds={selectedIds}
            themeMutationDeviceId={themeMutationDeviceId}
            blackScreenMutationDeviceId={blackScreenMutationDeviceId}
            batchThemeUpdating={batchThemeUpdating}
            batchBlackScreenUpdating={batchBlackScreenUpdating}
            onSortColumn={onSortColumn}
            onToggleAllActiveDevices={onToggleAllActiveDevices}
            onToggleDeviceSelection={onToggleDeviceSelection}
            onViewDevice={onViewDevice}
            onEditDevice={onEditDevice}
            onPreviewDevice={onPreviewDevice}
            onDeviceThemeChange={onDeviceThemeChange}
            onDeviceBlackScreenModeChange={onDeviceBlackScreenModeChange}
            onDeleteDevice={onDeleteDevice}
          />
        )}
      </AdminPanelSection>
    </div>
  );
};

export default DevicesView;
