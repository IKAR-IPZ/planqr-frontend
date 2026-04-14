import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdminPanelSearchField from "./AdminPanelSearchField";
import AdminDevicesTable from "./AdminDevicesTable";
import AdminPanelSection from "./AdminPanelSection";
import PendingDeviceAssignmentSection from "./PendingDeviceAssignmentSection";
import { splitDeviceClassroom } from "./helpers";
import type { Device, DeviceSortColumn, DeviceSortState, Tone } from "./types";

const MOBILE_BREAKPOINT_PX = 720;

const useIsMobileViewport = () => {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= MOBILE_BREAKPOINT_PX : false,
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`);
    const handleChange = (event: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(event.matches);
    };

    handleChange(mediaQuery);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  return isMobile;
};

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
  visibleDeviceIds: number[];
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
  onVisibleDeviceIdsChange: (ids: number[]) => void;
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
  visibleDeviceIds,
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
  onVisibleDeviceIdsChange,
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
  const isMobile = useIsMobileViewport();
  const [collapsedSections, setCollapsedSections] = useState({
    assignment: false,
    stats: false,
    batch: false,
  });
  const hasPairedDevices = activeDevices.length > 0;
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const selectedIds = new Set(selectedDeviceIds);
  const selectedCount = selectedDeviceIds.length;
  const visibleDevicesCount = visibleDeviceIds.length;
  const allActiveSelected =
    visibleDevicesCount > 0 && visibleDeviceIds.every((deviceId) => selectedIds.has(deviceId));
  const partiallySelected =
    selectedCount > 0 &&
    visibleDeviceIds.some((deviceId) => selectedIds.has(deviceId)) &&
    !allActiveSelected;
  const statsColumnsClass = "admin-status-strip--cols-4";
  const statusItems = useMemo(() => {
    const lightThemeCount = activeDevices.filter((device) => device.displayTheme === "light").length;
    const darkThemeCount = activeDevices.filter((device) => device.displayTheme === "dark").length;
    const blackScreenCount = activeDevices.filter((device) => device.effectiveBlackScreen).length;
    const facultiesCount = new Set(
      activeDevices
        .map((device) => splitDeviceClassroom(device.deviceClassroom).facultyCode.trim())
        .filter(Boolean),
    ).size;

    return [
      { label: "Wszystkie", value: counts.all, tone: "neutral" },
      { label: "Online", value: counts.online, tone: "success" },
      { label: "Offline", value: counts.offline, tone: "danger" },
      { label: "Oczekujące", value: counts.pending, tone: "warning" },
      { label: "Jasny", value: lightThemeCount, tone: "neutral" },
      { label: "Ciemny", value: darkThemeCount, tone: "neutral" },
      { label: "Czarny ekran", value: blackScreenCount, tone: "warning" },
      { label: "Wydziały", value: facultiesCount, tone: "neutral" },
    ] as const;
  }, [activeDevices, counts.all, counts.offline, counts.online, counts.pending]);

  const emptyStateTitle = loading ? "Ładowanie urządzeń" : "Brak sparowanych tabletów";
  const emptyStateDescription = loading
    ? "Trwa pobieranie listy tabletów."
    : "Przypisz tablet kodem, aby pojawił się tutaj.";

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = partiallySelected;
    }
  }, [partiallySelected]);

  const pairedDevicesTitle =
    selectedCount > 0 ? `Sparowane tablety (${selectedCount})` : "Sparowane tablety";

  const toggleSection = useCallback((section: keyof typeof collapsedSections) => {
    setCollapsedSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  }, []);

  const batchActionsContent = (
    <>
      <label className="admin-form-field admin-form-field--compact admin-table__header-field">
        <select
          className="admin-form-field__input"
          aria-label="Batchowa zmiana trybu tabletu"
          value={batchThemeValue}
          onChange={(event) =>
            onBatchThemeValueChange(event.target.value as Device["displayTheme"])
          }
          disabled={batchThemeUpdating || !hasPairedDevices}
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
          disabled={batchBlackScreenUpdating || !hasPairedDevices}
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
        <i className="fas fa-trash-alt" aria-hidden="true" />
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
  );

  return (
    <div className="admin-devices-view">
      <div className="admin-devices-view__overview">
        <PendingDeviceAssignmentSection
          pendingDevicesCount={pendingDevices.length}
          collapsible={isMobile}
          collapsed={isMobile ? collapsedSections.assignment : false}
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
          onToggleCollapsed={() => toggleSection("assignment")}
          onRoomChange={onPairingRoomChange}
          onRoomSuggestionSelect={onPairingRoomSuggestionSelect}
          onAssign={onAssignPairingDevice}
        />

        <AdminPanelSection
          className="admin-devices-view__stats"
          title="Statystyki"
          collapsible={isMobile}
          collapsed={isMobile ? collapsedSections.stats : false}
          onToggleCollapsed={() => toggleSection("stats")}
          actions={
            <>
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
            </>
          }
        >
          <div
            className={`admin-status-strip ${statsColumnsClass}`}
            aria-label="Status urządzeń"
          >
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

        <AdminPanelSection
          className="admin-devices-view__batch"
          title="Operacje zbiorowe"
          collapsible={isMobile}
          collapsed={isMobile ? collapsedSections.batch : false}
          onToggleCollapsed={() => toggleSection("batch")}
          actions={
            <div className="admin-status-inline">
              <span>
                Zaznaczone: <strong>{selectedCount}</strong>
              </span>
            </div>
          }
        >
          <div className="admin-batch-panel">
            <div className="admin-table__batch-actions">{batchActionsContent}</div>
          </div>
        </AdminPanelSection>
      </div>

      <AdminPanelSection
        className="admin-devices-view__list"
        title={pairedDevicesTitle}
        actions={
          hasPairedDevices ? (
            <div className="admin-devices-view__search">
              <AdminPanelSearchField
                label="Szukaj"
                placeholder="Sala, wydział, ID lub status"
                value={searchTerm}
                onChange={onSearchTermChange}
                compact
              />
            </div>
          ) : undefined
        }
      >
        {!hasPairedDevices ? (
          <div className="admin-empty-state">
            <h3>{emptyStateTitle}</h3>
            <p>{emptyStateDescription}</p>
          </div>
        ) : (
          <AdminDevicesTable
            caption="Lista aktywnych tabletów"
            devices={activeDevices}
            sortState={sortState}
            quickFilterText={searchTerm}
            selectAllRef={selectAllRef}
            allActiveSelected={allActiveSelected}
            selectedIds={selectedIds}
            themeMutationDeviceId={themeMutationDeviceId}
            blackScreenMutationDeviceId={blackScreenMutationDeviceId}
            batchThemeUpdating={batchThemeUpdating}
            batchBlackScreenUpdating={batchBlackScreenUpdating}
            onVisibleDeviceIdsChange={onVisibleDeviceIdsChange}
            onSortColumn={onSortColumn}
            onToggleAllActiveDevices={onToggleAllActiveDevices}
            onToggleDeviceSelection={onToggleDeviceSelection}
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
