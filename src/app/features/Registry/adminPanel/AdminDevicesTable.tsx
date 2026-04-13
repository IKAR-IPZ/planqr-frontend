import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  AllCommunityModule,
  ModuleRegistry,
  type BodyScrollEvent,
  type CellKeyDownEvent,
  type ColDef,
  type ColumnResizedEvent,
  type DisplayedColumnsChangedEvent,
  type GridApi,
  type GridSizeChangedEvent,
  type GridReadyEvent,
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
import type { Device, DeviceSortColumn, DeviceSortState } from "./types";

ModuleRegistry.registerModules([AllCommunityModule]);

const MOBILE_BREAKPOINT_PX = 720;
const ROOM_COLUMN_ID = "room";
const ROOM_COLUMN_MIN_WIDTH = 180;
const ROOM_COLUMN_EXTRA_WIDTH = 32;
const BLACK_SCREEN_COLUMN_MIN_WIDTH = 190;
const ACTIONS_COLUMN_MIN_WIDTH = 144;

interface AdminDevicesTableProps {
  caption: string;
  devices: Device[];
  sortState: DeviceSortState;
  desktopBatchActions?: ReactNode;
  desktopPinnedTitle?: string;
  selectAllRef: RefObject<HTMLInputElement | null>;
  allActiveSelected: boolean;
  selectedIds: ReadonlySet<number>;
  themeMutationDeviceId: number | null;
  blackScreenMutationDeviceId: number | null;
  batchThemeUpdating: boolean;
  batchBlackScreenUpdating: boolean;
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
    columnLimits: [{ colId: ROOM_COLUMN_ID, minWidth: ROOM_COLUMN_MIN_WIDTH }],
  });

  const roomColumn = api.getColumn(ROOM_COLUMN_ID);

  if (!roomColumn) {
    return;
  }

  api.setColumnWidths(
    [
      {
        key: ROOM_COLUMN_ID,
        newWidth: Math.max(
          roomColumn.getActualWidth() + ROOM_COLUMN_EXTRA_WIDTH,
          ROOM_COLUMN_MIN_WIDTH,
        ),
      },
    ],
    true,
    "api",
  );
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
  label,
  columnKey,
  sortState,
  onSortColumn,
  align = "left",
}: SortableHeaderProps) => {
  const sortButtonState = getSortButtonState(sortState, columnKey);

  return (
    <div className={`admin-devices-grid__header admin-devices-grid__header--${align}`}>
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

const AdminDevicesTable = ({
  caption,
  devices,
  sortState,
  desktopBatchActions,
  desktopPinnedTitle,
  selectAllRef,
  allActiveSelected,
  selectedIds,
  themeMutationDeviceId,
  blackScreenMutationDeviceId,
  batchThemeUpdating,
  batchBlackScreenUpdating,
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
  const [desktopGridChrome, setDesktopGridChrome] = useState({
    pinnedLeftWidth: 0,
    centerWidth: 0,
    scrollLeft: 0,
  });

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
          isSelected: selectedIds.has(device.id),
        };
      }),
    [devices, selectedIds],
  );
  const partiallySelected =
    rows.some((row) => row.isSelected) && !allActiveSelected;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = partiallySelected;
    }
  }, [partiallySelected, selectAllRef]);

  const widestRoomLabel = useMemo(
    () =>
      rows.reduce(
        (widestLabel, row) =>
          row.roomLabel.length > widestLabel.length ? row.roomLabel : widestLabel,
        "",
      ),
    [rows],
  );

  const updateDesktopGridChrome = useCallback(
    (api: GridApi<DeviceGridRow>, nextScrollLeft?: number) => {
      const visibleColumns = (api.getColumns() ?? []).filter((column) => column.isVisible());
      const pinnedLeftWidth = visibleColumns.reduce(
        (total, column) =>
          column.getPinned() === "left" || column.getPinned() === true
            ? total + column.getActualWidth()
            : total,
        0,
      );
      const pinnedRightWidth = visibleColumns.reduce(
        (total, column) =>
          column.getPinned() === "right" ? total + column.getActualWidth() : total,
        0,
      );
      const totalWidth = visibleColumns.reduce(
        (total, column) => total + column.getActualWidth(),
        0,
      );
      const centerWidth = Math.max(totalWidth - pinnedLeftWidth - pinnedRightWidth, 0);

      setDesktopGridChrome((current) => {
        const scrollLeft = nextScrollLeft ?? current.scrollLeft;

        if (
          current.pinnedLeftWidth === pinnedLeftWidth &&
          current.centerWidth === centerWidth &&
          current.scrollLeft === scrollLeft
        ) {
          return current;
        }

        return {
          pinnedLeftWidth,
          centerWidth,
          scrollLeft,
        };
      });
    },
    [],
  );

  const scheduleRoomColumnResize = useCallback(
    (api: GridApi<DeviceGridRow>) => {
      if (typeof window === "undefined") {
        sizeRoomColumnToContent(api);
        updateDesktopGridChrome(api);
        return;
      }

      window.requestAnimationFrame(() => {
        sizeRoomColumnToContent(api);
        updateDesktopGridChrome(api);
      });
    },
    [updateDesktopGridChrome],
  );

  useEffect(() => {
    if (!gridApiRef.current) {
      return;
    }

    scheduleRoomColumnResize(gridApiRef.current);
  }, [scheduleRoomColumnResize, widestRoomLabel]);

  const defaultColDef = useMemo<ColDef<DeviceGridRow>>(
    () => ({
      sortable: false,
      resizable: false,
      suppressMovable: true,
      suppressHeaderMenuButton: true,
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
        minWidth: ROOM_COLUMN_MIN_WIDTH,
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
      },
      {
        colId: "deviceId",
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
      },
      {
        colId: "lastSeen",
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
        minWidth: 160,
        flex: 1,
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
      },
      {
        colId: "blackScreen",
        minWidth: BLACK_SCREEN_COLUMN_MIN_WIDTH,
        width: BLACK_SCREEN_COLUMN_MIN_WIDTH,
        flex: 0.95,
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
      onDeleteDevice,
      onDeviceBlackScreenModeChange,
      onDeviceThemeChange,
      onEditDevice,
      isMobile,
      onPreviewDevice,
      onSortColumn,
      onToggleAllActiveDevices,
      onToggleDeviceSelection,
      selectAllRef,
      sortState,
      themeMutationDeviceId,
    ],
  );

  const showPinnedBatchTitle = !isMobile && Boolean(desktopPinnedTitle);

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
    scheduleRoomColumnResize(event.api);
  };

  const handleBodyScroll = (event: BodyScrollEvent<DeviceGridRow>) => {
    updateDesktopGridChrome(event.api, event.left);
  };

  const handleGridChromeChange = (
    event:
      | ColumnResizedEvent<DeviceGridRow>
      | DisplayedColumnsChangedEvent<DeviceGridRow>
      | GridSizeChangedEvent<DeviceGridRow>,
  ) => {
    updateDesktopGridChrome(event.api);
  };

  return (
    <div className="admin-devices-grid">
      <span className="admin-table__caption">{caption}</span>
      {desktopBatchActions ? (
        <div className="admin-devices-grid__batch-shell">
          {showPinnedBatchTitle ? (
            <div
              className="admin-devices-grid__batch-pinned"
              style={{ width: `${desktopGridChrome.pinnedLeftWidth}px` }}
            >
              <div className="admin-devices-grid__batch-title">{desktopPinnedTitle}</div>
            </div>
          ) : null}
          <div className="admin-devices-grid__batch-viewport">
            <div
              className="admin-devices-grid__batch-scroll"
              style={{
                width: `${desktopGridChrome.centerWidth}px`,
                transform: `translateX(-${desktopGridChrome.scrollLeft}px)`,
              }}
            >
              <div className="admin-table__batch-actions admin-table__batch-actions--grid">
                {desktopBatchActions}
              </div>
            </div>
          </div>
        </div>
      ) : null}
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
          rowClass="admin-devices-grid__row"
          rowClassRules={{
            "admin-devices-grid__row--selected": ({ data }) => Boolean(data?.isSelected),
          }}
          onGridReady={handleGridReady}
          onBodyScroll={handleBodyScroll}
          onColumnResized={handleGridChromeChange}
          onDisplayedColumnsChanged={handleGridChromeChange}
          onGridSizeChanged={handleGridChromeChange}
          onRowClicked={handleRowClicked}
          onCellKeyDown={handleCellKeyDown}
        />
      </div>
    </div>
  );
};

export default AdminDevicesTable;
