import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  AllCommunityModule,
  ModuleRegistry,
  type CellKeyDownEvent,
  type ColDef,
  type GridApi,
  type GridReadyEvent,
  type GridSizeChangedEvent,
  type ICellRendererParams,
  type IHeaderParams,
  type RowClickedEvent,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";
import {
  formatLastSeen,
  formatPairingDeviceId,
  getConnectionLabel,
  getConnectionTone,
  getDeviceDisplayName,
  splitDeviceClassroom,
} from "./helpers";
import EnumOptionsFilter, { type EnumOptionsFilterOption } from "./EnumOptionsFilter";
import type { Device, DeviceSortColumn, DeviceSortState } from "./types";

ModuleRegistry.registerModules([AllCommunityModule]);

const MOBILE_BREAKPOINT_PX = 720;
const ROOM_COLUMN_ID = "room";
const ROOM_COLUMN_MIN_WIDTH = 80;
const ROOM_COLUMN_MAX_WIDTH = 280;
const ROOM_COLUMN_EXTRA_WIDTH = 32;
const DISPLAY_THEME_COLUMN_MIN_WIDTH = 132;
const DISPLAY_THEME_COLUMN_MAX_WIDTH = 152;
const BLACK_SCREEN_COLUMN_MIN_WIDTH = 156;
const BLACK_SCREEN_COLUMN_MAX_WIDTH = 182;
const PRIORITY_MESSAGE_COLUMN_MIN_WIDTH = 160;
const ACTIONS_COLUMN_MIN_WIDTH = 144;

interface AdminDevicesTableProps {
  caption: string;
  devices: Device[];
  sortState: DeviceSortState;
  quickFilterText: string;
  selectAllRef: RefObject<HTMLInputElement | null>;
  allActiveSelected: boolean;
  selectedIds: ReadonlySet<number>;
  themeMutationDeviceId: number | null;
  blackScreenMutationDeviceId: number | null;
  batchThemeUpdating: boolean;
  batchBlackScreenUpdating: boolean;
  onVisibleDeviceIdsChange: (ids: number[]) => void;
  onSortColumn: (column: DeviceSortColumn) => void;
  onToggleAllActiveDevices: (checked: boolean) => void;
  onToggleDeviceSelection: (deviceId: number) => void;
  onEditDevice: (device: Device) => void;
  onPreviewDevice: (device: Device) => void;
  onDeviceThemeChange: (device: Device, theme: Device["displayTheme"]) => void;
  onDeviceBlackScreenModeChange: (
    device: Device,
    blackScreenMode: Device["blackScreenMode"],
  ) => void;
  onDeleteDevice: (device: Device) => void;
}

interface DeviceGridRow {
  id: number;
  device: Device;
  displayName: string;
  roomLabel: string;
  facultyCode: string;
  formattedDeviceId: string;
  connectionLabel: string;
  connectionTone: string;
  formattedLastSeen: string;
  displayThemeLabel: string;
  blackScreenModeLabel: string;
  priorityMessageLabel: string;
  isSelected: boolean;
}

interface SortableHeaderProps extends IHeaderParams<DeviceGridRow> {
  label: string;
  columnKey: DeviceSortColumn;
  sortState: DeviceSortState;
  onSortColumn: (column: DeviceSortColumn) => void;
  align?: "left" | "center";
}

interface SelectAllHeaderProps extends IHeaderParams<DeviceGridRow> {
  selectAllRef: RefObject<HTMLInputElement | null>;
  allActiveSelected: boolean;
  onToggleAllActiveDevices: (checked: boolean) => void;
}

interface DeviceCheckboxCellProps extends ICellRendererParams<DeviceGridRow> {
  onToggleDeviceSelection: (deviceId: number) => void;
}

interface DeviceThemeCellProps extends ICellRendererParams<DeviceGridRow> {
  themeMutationDeviceId: number | null;
  batchThemeUpdating: boolean;
  onDeviceThemeChange: (device: Device, theme: Device["displayTheme"]) => void;
}

interface DeviceBlackScreenCellProps extends ICellRendererParams<DeviceGridRow> {
  blackScreenMutationDeviceId: number | null;
  batchBlackScreenUpdating: boolean;
  onDeviceBlackScreenModeChange: (
    device: Device,
    blackScreenMode: Device["blackScreenMode"],
  ) => void;
}

interface DeviceActionsCellProps extends ICellRendererParams<DeviceGridRow> {
  onEditDevice: (device: Device) => void;
  onPreviewDevice: (device: Device) => void;
  onDeleteDevice: (device: Device) => void;
}

const sizeRoomColumnToContent = (api: GridApi<DeviceGridRow>) => {
  api.autoSizeColumns({
    colIds: [ROOM_COLUMN_ID],
    skipHeader: true,
    columnLimits: [
      {
        colId: ROOM_COLUMN_ID,
        minWidth: ROOM_COLUMN_MIN_WIDTH,
        maxWidth: ROOM_COLUMN_MAX_WIDTH,
      },
    ],
  });

  const roomColumn = api.getColumn(ROOM_COLUMN_ID);

  if (!roomColumn) {
    return;
  }

  api.setColumnWidths(
    [
      {
        key: ROOM_COLUMN_ID,
        newWidth: Math.min(
          Math.max(roomColumn.getActualWidth() + ROOM_COLUMN_EXTRA_WIDTH, ROOM_COLUMN_MIN_WIDTH),
          ROOM_COLUMN_MAX_WIDTH,
        ),
      },
    ],
    true,
    "api",
  );
};

const getDisplayThemeLabel = (theme: Device["displayTheme"]) =>
  theme === "light" ? "Jasny" : "Ciemny";

const getBlackScreenModeLabel = (mode: Device["blackScreenMode"]) => {
  if (mode === "follow") {
    return "Harmonogram";
  }

  return mode === "on" ? "Włączony" : "Wyłączony";
};

const stopGridEventPropagation = (
  event:
    | React.MouseEvent<HTMLElement>
    | React.KeyboardEvent<HTMLElement>
    | React.ChangeEvent<HTMLElement>,
) => {
  event.stopPropagation();
};

const isInteractiveTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  Boolean(target.closest("button, input, select, textarea, a, [role='button']"));

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

const getSortButtonState = (sortState: DeviceSortState, column: DeviceSortColumn) => {
  if (sortState.column !== column || !sortState.direction) {
    return {
      icon: "fas fa-sort",
      label: "Brak aktywnego sortowania",
      active: false,
    };
  }

  return {
    icon: sortState.direction === "desc" ? "fas fa-sort-down" : "fas fa-sort-up",
    label: sortState.direction === "desc" ? "Sortowanie malejące" : "Sortowanie rosnące",
    active: true,
  };
};

const SortableHeader = ({
  column,
  showFilter,
  enableFilterButton,
  label,
  columnKey,
  sortState,
  onSortColumn,
  align = "left",
}: SortableHeaderProps) => {
  const filterButtonRef = useRef<HTMLButtonElement | null>(null);
  const sortButtonState = getSortButtonState(sortState, columnKey);
  const filterActive = column.isFilterActive();

  return (
    <div className={`admin-devices-grid__header admin-devices-grid__header--${align}`}>
      <div className="admin-devices-grid__header-main">
        <button
          type="button"
          className={`admin-table__sort-button${
            sortButtonState.active ? " admin-table__sort-button--active" : ""
          }`}
          onClick={() => onSortColumn(columnKey)}
          aria-label={`${label}. ${sortButtonState.label}. Kliknij, aby zmienić sortowanie.`}
        >
          <span>{label}</span>
          <i className={sortButtonState.icon} aria-hidden="true" />
        </button>
        {enableFilterButton ? (
          <button
            ref={filterButtonRef}
            type="button"
            className={`admin-devices-grid__filter-button${
              filterActive ? " admin-devices-grid__filter-button--active" : ""
            }`}
            aria-pressed={filterActive}
            aria-label={`Filtruj kolumnę ${label}`}
            title={`Filtruj kolumnę ${label}`}
            onClick={(event) => {
              event.stopPropagation();
              if (filterButtonRef.current) {
                showFilter(filterButtonRef.current);
              }
            }}
          >
            <i className="fas fa-filter" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
};

const SelectAllHeader = ({
  selectAllRef,
  allActiveSelected,
  onToggleAllActiveDevices,
}: SelectAllHeaderProps) => (
  <div className="admin-devices-grid__header admin-devices-grid__header--center">
    <span className="admin-table__checkbox-header">
      <input
        ref={selectAllRef}
        type="checkbox"
        className="admin-table__checkbox"
        aria-label="Zaznacz wszystkie widoczne tablety"
        checked={allActiveSelected}
        onChange={(event) => onToggleAllActiveDevices(event.target.checked)}
      />
    </span>
  </div>
);

const DeviceCheckboxCell = ({
  data,
  onToggleDeviceSelection,
}: DeviceCheckboxCellProps) => {
  if (!data) {
    return null;
  }

  return (
    <div className="admin-devices-grid__cell admin-devices-grid__cell--center">
      <input
        type="checkbox"
        className="admin-table__checkbox"
        aria-label={`Zaznacz tablet ${data.displayName}`}
        checked={data.isSelected}
        onChange={() => onToggleDeviceSelection(data.id)}
        onClick={stopGridEventPropagation}
        onMouseDown={stopGridEventPropagation}
        onKeyDown={stopGridEventPropagation}
      />
    </div>
  );
};

const RoomCell = ({ data }: ICellRendererParams<DeviceGridRow>) => {
  if (!data) {
    return null;
  }

  return (
    <div className="admin-devices-grid__cell admin-table__cell--name">
      <div className="admin-table__primary">
        <strong>{data.roomLabel}</strong>
      </div>
    </div>
  );
};

const FacultyCell = ({ data }: ICellRendererParams<DeviceGridRow>) => (
  <div className="admin-devices-grid__cell admin-table__cell--center">
    <span className="admin-table__secondary">{data?.facultyCode || ""}</span>
  </div>
);

const DeviceIdCell = ({ data }: ICellRendererParams<DeviceGridRow>) => (
  <div className="admin-devices-grid__cell admin-table__cell--center">
    <span className="admin-table__meta-code">{data?.formattedDeviceId || ""}</span>
  </div>
);

const StatusCell = ({ data }: ICellRendererParams<DeviceGridRow>) => {
  if (!data) {
    return null;
  }

  return (
    <div className="admin-devices-grid__cell admin-table__cell--center">
      <span className={`admin-status-pill admin-status-pill--${data.connectionTone}`}>
        {data.connectionLabel}
      </span>
    </div>
  );
};

const LastSeenCell = ({ data }: ICellRendererParams<DeviceGridRow>) => (
  <div className="admin-devices-grid__cell admin-table__cell--center">
    <span className="admin-table__secondary">{data?.formattedLastSeen || "brak danych"}</span>
  </div>
);

const PriorityMessageCell = ({ data }: ICellRendererParams<DeviceGridRow>) => (
  <div className="admin-devices-grid__cell admin-table__cell--center">
    <span
      className={`admin-status-pill admin-status-pill--${
        data?.device.priorityMessage?.enabled ? "warning" : "neutral"
      }`}
    >
      {data?.priorityMessageLabel || "Wyłączony"}
    </span>
  </div>
);

const DeviceThemeCell = ({
  data,
  themeMutationDeviceId,
  batchThemeUpdating,
  onDeviceThemeChange,
}: DeviceThemeCellProps) => {
  if (!data) {
    return null;
  }

  return (
    <div className="admin-devices-grid__cell admin-table__cell--center">
      <select
        className="admin-form-field__input admin-table__theme-select"
        value={data.device.displayTheme}
        disabled={themeMutationDeviceId === data.id || batchThemeUpdating}
        onChange={(event) =>
          onDeviceThemeChange(data.device, event.target.value as Device["displayTheme"])
        }
        onClick={stopGridEventPropagation}
        onMouseDown={stopGridEventPropagation}
        onKeyDown={stopGridEventPropagation}
      >
        <option value="dark">Ciemny</option>
        <option value="light">Jasny</option>
      </select>
    </div>
  );
};

const DeviceBlackScreenCell = ({
  data,
  blackScreenMutationDeviceId,
  batchBlackScreenUpdating,
  onDeviceBlackScreenModeChange,
}: DeviceBlackScreenCellProps) => {
  if (!data) {
    return null;
  }

  return (
    <div className="admin-devices-grid__cell admin-table__cell--center">
      <select
        className="admin-form-field__input admin-table__mode-select"
        aria-label={`Czarny ekran ${data.displayName}`}
        value={data.device.blackScreenMode}
        disabled={blackScreenMutationDeviceId === data.id || batchBlackScreenUpdating}
        onChange={(event) =>
          onDeviceBlackScreenModeChange(
            data.device,
            event.target.value as Device["blackScreenMode"],
          )
        }
        onClick={stopGridEventPropagation}
        onMouseDown={stopGridEventPropagation}
        onKeyDown={stopGridEventPropagation}
      >
        <option value="on">Włączony</option>
        <option value="off">Wyłączony</option>
        <option value="follow">Harmonogram</option>
      </select>
    </div>
  );
};

const DeviceActionsCell = ({
  data,
  onEditDevice,
  onPreviewDevice,
  onDeleteDevice,
}: DeviceActionsCellProps) => {
  if (!data) {
    return null;
  }

  return (
    <div className="admin-devices-grid__cell admin-table__cell--actions">
      <div className="admin-table__actions admin-table__actions--inline">
        <button
          type="button"
          className="admin-button admin-button--secondary admin-button--small admin-button--icon"
          aria-label={`Edytuj tablet ${data.displayName}`}
          title="Edytuj"
          onClick={(event) => {
            stopGridEventPropagation(event);
            onEditDevice(data.device);
          }}
          onMouseDown={stopGridEventPropagation}
        >
          <i className="fas fa-pen" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="admin-button admin-button--secondary admin-button--small admin-button--icon"
          aria-label={`Podgląd tabletu ${data.displayName}`}
          title="Podgląd"
          onClick={(event) => {
            stopGridEventPropagation(event);
            onPreviewDevice(data.device);
          }}
          onMouseDown={stopGridEventPropagation}
        >
          <i className="fas fa-eye" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="admin-button admin-button--danger admin-button--small admin-button--icon"
          aria-label={`Usuń tablet ${data.displayName}`}
          title="Usuń"
          onClick={(event) => {
            stopGridEventPropagation(event);
            onDeleteDevice(data.device);
          }}
          onMouseDown={stopGridEventPropagation}
        >
          <i className="fas fa-trash-alt" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

const areIdListsEqual = (left: number[], right: number[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const enumFilterColumn = (
  options: EnumOptionsFilterOption[],
  filterParams?: Partial<{
    searchPlaceholder: string;
    emptyStateLabel: string;
    searchable: boolean;
  }>,
): Partial<ColDef<DeviceGridRow>> => ({
  filter: EnumOptionsFilter,
  filterParams: {
    options,
    ...filterParams,
  },
});

const AdminDevicesTable = ({
  caption,
  devices,
  sortState,
  quickFilterText,
  selectAllRef,
  allActiveSelected,
  selectedIds,
  themeMutationDeviceId,
  blackScreenMutationDeviceId,
  batchThemeUpdating,
  batchBlackScreenUpdating,
  onVisibleDeviceIdsChange,
  onSortColumn,
  onToggleAllActiveDevices,
  onToggleDeviceSelection,
  onEditDevice,
  onPreviewDevice,
  onDeviceThemeChange,
  onDeviceBlackScreenModeChange,
  onDeleteDevice,
}: AdminDevicesTableProps) => {
  const isMobile = useIsMobileViewport();
  const gridApiRef = useRef<GridApi<DeviceGridRow> | null>(null);
  const reportedVisibleIdsRef = useRef<number[]>([]);

  const rows = useMemo<DeviceGridRow[]>(
    () =>
      devices.map((device) => {
        const roomParts = splitDeviceClassroom(device.deviceClassroom);
        const displayName = getDeviceDisplayName(device);

        return {
          id: device.id,
          device,
          displayName,
          roomLabel: roomParts.roomLabel || roomParts.fullLabel || displayName,
          facultyCode: roomParts.facultyCode || "",
          formattedDeviceId: formatPairingDeviceId(device.deviceId),
          connectionLabel: getConnectionLabel(device),
          connectionTone: getConnectionTone(device),
          formattedLastSeen: formatLastSeen(device.lastSeen),
          displayThemeLabel: getDisplayThemeLabel(device.displayTheme),
          blackScreenModeLabel: getBlackScreenModeLabel(device.blackScreenMode),
          priorityMessageLabel: device.priorityMessage?.enabled
            ? device.priorityMessage.template?.name ?? "Aktywny"
            : "Wyłączony",
          isSelected: selectedIds.has(device.id),
        };
      }),
    [devices, selectedIds],
  );

  const widestRoomLabel = useMemo(
    () =>
      rows.reduce(
        (widestLabel, row) =>
          row.roomLabel.length > widestLabel.length ? row.roomLabel : widestLabel,
        "",
      ),
    [rows],
  );

  const facultyFilterOptions = useMemo<EnumOptionsFilterOption[]>(
    () =>
      Array.from(new Set(rows.map((row) => row.facultyCode.trim()).filter(Boolean))).map(
        (value) => ({
          value,
        }),
      ),
    [rows],
  );

  const priorityMessageFilterOptions = useMemo<EnumOptionsFilterOption[]>(
    () =>
      Array.from(
        new Set(
          devices.map((device) =>
            device.priorityMessage?.enabled
              ? device.priorityMessage.template?.name ?? "Aktywny"
              : "Wyłączony",
          ),
        ),
      ).map((value) => ({ value })),
    [devices],
  );

  const syncVisibleDeviceIds = useCallback(
    (api: GridApi<DeviceGridRow>) => {
      const nextVisibleIds: number[] = [];

      api.forEachNodeAfterFilterAndSort((node) => {
        if (typeof node.data?.id === "number") {
          nextVisibleIds.push(node.data.id);
        }
      });

      if (areIdListsEqual(reportedVisibleIdsRef.current, nextVisibleIds)) {
        return;
      }

      reportedVisibleIdsRef.current = nextVisibleIds;
      onVisibleDeviceIdsChange(nextVisibleIds);
    },
    [onVisibleDeviceIdsChange],
  );

  const scheduleRoomColumnResize = useCallback(
    (api: GridApi<DeviceGridRow>) => {
      if (typeof window === "undefined") {
        sizeRoomColumnToContent(api);
        return;
      }

      window.requestAnimationFrame(() => {
        sizeRoomColumnToContent(api);
      });
    },
    [],
  );

  useEffect(() => {
    if (!gridApiRef.current) {
      return;
    }

    scheduleRoomColumnResize(gridApiRef.current);
  }, [scheduleRoomColumnResize, widestRoomLabel]);

  useEffect(() => {
    if (!gridApiRef.current) {
      return;
    }

    gridApiRef.current.setGridOption("quickFilterText", quickFilterText);
    syncVisibleDeviceIds(gridApiRef.current);
  }, [quickFilterText, syncVisibleDeviceIds]);

  const defaultColDef = useMemo<ColDef<DeviceGridRow>>(
    () => ({
      sortable: false,
      resizable: false,
      suppressMovable: true,
      suppressHeaderMenuButton: true,
      filter: false,
    }),
    [],
  );

  const columnDefs = useMemo<ColDef<DeviceGridRow>[]>(
    () => [
      {
        colId: "select",
        width: 48,
        minWidth: 48,
        maxWidth: 48,
        pinned: isMobile ? undefined : "left",
        lockPinned: !isMobile,
        suppressMovable: true,
        suppressSizeToFit: true,
        headerClass: "admin-devices-grid__header-cell--select",
        cellRenderer: DeviceCheckboxCell,
        cellRendererParams: {
          onToggleDeviceSelection,
        },
        headerComponent: SelectAllHeader,
        headerComponentParams: {
          selectAllRef,
          allActiveSelected,
          onToggleAllActiveDevices,
        },
      },
      {
        colId: ROOM_COLUMN_ID,
        field: "roomLabel",
        minWidth: ROOM_COLUMN_MIN_WIDTH,
        maxWidth: ROOM_COLUMN_MAX_WIDTH,
        width: ROOM_COLUMN_MIN_WIDTH,
        pinned: isMobile ? undefined : "left",
        lockPinned: !isMobile,
        suppressMovable: true,
        suppressSizeToFit: true,
        headerComponent: SortableHeader,
        headerComponentParams: {
          label: "Sala",
          columnKey: "room",
          sortState,
          onSortColumn,
        },
        cellRenderer: RoomCell,
      },
      {
        colId: "faculty",
        field: "facultyCode",
        minWidth: 110,
        flex: 0.8,
        headerComponent: SortableHeader,
        headerComponentParams: {
          label: "Wydział",
          columnKey: "faculty",
          sortState,
          onSortColumn,
          align: "center",
        },
        cellRenderer: FacultyCell,
        ...enumFilterColumn(facultyFilterOptions, {
          searchPlaceholder: "Szukaj wydziału",
          emptyStateLabel: "Brak wydziałów dla bieżących danych.",
          searchable: true,
        }),
      },
      {
        colId: "deviceId",
        field: "formattedDeviceId",
        minWidth: 140,
        flex: 0.95,
        headerComponent: SortableHeader,
        headerComponentParams: {
          label: "Device ID",
          columnKey: "deviceId",
          sortState,
          onSortColumn,
          align: "center",
        },
        cellRenderer: DeviceIdCell,
      },
      {
        colId: "status",
        field: "connectionLabel",
        minWidth: 140,
        flex: 0.9,
        headerComponent: SortableHeader,
        headerComponentParams: {
          label: "Status",
          columnKey: "status",
          sortState,
          onSortColumn,
          align: "center",
        },
        cellRenderer: StatusCell,
        ...enumFilterColumn(
          [
            {
              value: "Online",
              description: "Tablety z aktywnym połączeniem",
            },
            {
              value: "Offline",
              description: "Tablety bez aktywnego połączenia",
            },
          ],
          {
            searchable: false,
          },
        ),
      },
      {
        colId: "lastSeen",
        field: "formattedLastSeen",
        minWidth: 180,
        flex: 1.2,
        headerComponent: SortableHeader,
        headerComponentParams: {
          label: "Ostatni heartbeat",
          columnKey: "lastSeen",
          sortState,
          onSortColumn,
          align: "center",
        },
        cellRenderer: LastSeenCell,
      },
      {
        colId: "displayTheme",
        field: "displayThemeLabel",
        minWidth: DISPLAY_THEME_COLUMN_MIN_WIDTH,
        maxWidth: DISPLAY_THEME_COLUMN_MAX_WIDTH,
        width: DISPLAY_THEME_COLUMN_MIN_WIDTH,
        flex: 0.72,
        headerComponent: SortableHeader,
        headerComponentParams: {
          label: "Tryb",
          columnKey: "displayTheme",
          sortState,
          onSortColumn,
          align: "center",
        },
        cellRenderer: DeviceThemeCell,
        cellRendererParams: {
          themeMutationDeviceId,
          batchThemeUpdating,
          onDeviceThemeChange,
        },
        ...enumFilterColumn(
          [
            {
              value: "Ciemny",
              description: "Interfejs w ciemnym motywie",
            },
            {
              value: "Jasny",
              description: "Interfejs w jasnym motywie",
            },
          ],
          {
            searchable: false,
          },
        ),
      },
      {
        colId: "blackScreen",
        field: "blackScreenModeLabel",
        minWidth: BLACK_SCREEN_COLUMN_MIN_WIDTH,
        maxWidth: BLACK_SCREEN_COLUMN_MAX_WIDTH,
        width: BLACK_SCREEN_COLUMN_MIN_WIDTH,
        flex: 0.84,
        headerComponent: SortableHeader,
        headerComponentParams: {
          label: "Czarny ekran",
          columnKey: "blackScreen",
          sortState,
          onSortColumn,
          align: "center",
        },
        cellRenderer: DeviceBlackScreenCell,
        cellRendererParams: {
          blackScreenMutationDeviceId,
          batchBlackScreenUpdating,
          onDeviceBlackScreenModeChange,
        },
        ...enumFilterColumn(
          [
            {
              value: "Włączony",
              group: "Sterowanie ręczne",
            },
            {
              value: "Wyłączony",
              group: "Sterowanie ręczne",
            },
            {
              value: "Harmonogram",
              group: "Automatyka",
            },
          ],
          {
            searchable: false,
          },
        ),
      },
      {
        colId: "priorityMessage",
        field: "priorityMessageLabel",
        headerName: "Komunikat",
        minWidth: PRIORITY_MESSAGE_COLUMN_MIN_WIDTH,
        flex: 0.95,
        cellRenderer: PriorityMessageCell,
        ...enumFilterColumn(
          priorityMessageFilterOptions,
          {
            searchable: true,
          },
        ),
      },
      {
        colId: "actions",
        headerName: "Akcje",
        minWidth: ACTIONS_COLUMN_MIN_WIDTH,
        width: ACTIONS_COLUMN_MIN_WIDTH,
        flex: 0.75,
        headerClass: "admin-devices-grid__header-cell--actions",
        cellRenderer: DeviceActionsCell,
        cellRendererParams: {
          onEditDevice,
          onPreviewDevice,
          onDeleteDevice,
        },
      },
    ],
    [
      allActiveSelected,
      batchBlackScreenUpdating,
      batchThemeUpdating,
      blackScreenMutationDeviceId,
      facultyFilterOptions,
      isMobile,
      onDeleteDevice,
      onDeviceBlackScreenModeChange,
      onDeviceThemeChange,
      onEditDevice,
      onPreviewDevice,
      onSortColumn,
      onToggleAllActiveDevices,
      onToggleDeviceSelection,
      priorityMessageFilterOptions,
      selectAllRef,
      sortState,
      themeMutationDeviceId,
    ],
  );

  const handleRowClicked = (event: RowClickedEvent<DeviceGridRow>) => {
    if (!event.data || isInteractiveTarget(event.event?.target ?? null)) {
      return;
    }

    onToggleDeviceSelection(event.data.id);
  };

  const handleCellKeyDown = (event: CellKeyDownEvent<DeviceGridRow>) => {
    if (!event.data || (event.event.key !== "Enter" && event.event.key !== " ")) {
      return;
    }

    if (isInteractiveTarget(event.event.target)) {
      return;
    }

    event.event.preventDefault();
    onToggleDeviceSelection(event.data.id);
  };

  const handleGridReady = (event: GridReadyEvent<DeviceGridRow>) => {
    gridApiRef.current = event.api;
    event.api.setGridOption("quickFilterText", quickFilterText);
    scheduleRoomColumnResize(event.api);
    syncVisibleDeviceIds(event.api);
  };

  const handleGridSizeChanged = (event: GridSizeChangedEvent<DeviceGridRow>) => {
    scheduleRoomColumnResize(event.api);
  };

  return (
    <div className="admin-devices-grid">
      <span className="admin-table__caption">{caption}</span>
      <div className="ag-theme-quartz admin-devices-grid__theme">
        <AgGridReact<DeviceGridRow>
          rowData={rows}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          getRowId={({ data }) => String(data.id)}
          headerHeight={64}
          rowHeight={64}
          animateRows={false}
          ensureDomOrder
          maintainColumnOrder
          suppressScrollOnNewData
          suppressMovableColumns
          suppressCellFocus={false}
          overlayNoRowsTemplate={
            '<span class="admin-devices-grid__overlay">Brak wyników dla bieżących filtrów.</span>'
          }
          rowClass="admin-devices-grid__row"
          rowClassRules={{
            "admin-devices-grid__row--selected": ({ data }) => Boolean(data?.isSelected),
          }}
          onGridReady={handleGridReady}
          onGridSizeChanged={handleGridSizeChanged}
          onFilterChanged={({ api }) => {
            api.refreshHeader();
            syncVisibleDeviceIds(api);
          }}
          onModelUpdated={({ api }) => syncVisibleDeviceIds(api)}
          onRowClicked={handleRowClicked}
          onCellKeyDown={handleCellKeyDown}
        />
      </div>
    </div>
  );
};

export default AdminDevicesTable;
