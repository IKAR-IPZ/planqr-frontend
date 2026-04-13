import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
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

type SortDirection = NonNullable<DeviceSortState["direction"]>;
type MobileSortValue = "default" | `${DeviceSortColumn}:${SortDirection}`;

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
  onViewDevice: (device: Device) => void;
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

interface DeviceMobileCardProps {
  row: DeviceGridRow;
  themeMutationDeviceId: number | null;
  blackScreenMutationDeviceId: number | null;
  batchThemeUpdating: boolean;
  batchBlackScreenUpdating: boolean;
  onToggleDeviceSelection: (deviceId: number) => void;
  onViewDevice: (device: Device) => void;
  onEditDevice: (device: Device) => void;
  onPreviewDevice: (device: Device) => void;
  onDeviceThemeChange: (device: Device, theme: Device["displayTheme"]) => void;
  onDeviceBlackScreenModeChange: (
    device: Device,
    blackScreenMode: Device["blackScreenMode"],
  ) => void;
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

const sortableColumns: Array<{ column: DeviceSortColumn; label: string }> = [
  { column: ROOM_COLUMN_ID, label: "Sala" },
  { column: "faculty", label: "Wydział" },
  { column: "deviceId", label: "Device ID" },
  { column: "status", label: "Status" },
  { column: "lastSeen", label: "Ostatni heartbeat" },
  { column: "displayTheme", label: "Tryb" },
  { column: "blackScreen", label: "Czarny ekran" },
];

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

const handleCardKeyDown = (event: KeyboardEvent<HTMLElement>, onOpen: () => void) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    onOpen();
  }
};

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

const getMobileSortValue = (sortState: DeviceSortState): MobileSortValue =>
  sortState.column && sortState.direction
    ? `${sortState.column}:${sortState.direction}`
    : "default";

const planSortTransitions = (
  currentSort: DeviceSortState,
  targetColumn: DeviceSortColumn | null,
  targetDirection: SortDirection | null,
) => {
  if (!targetColumn || !targetDirection) {
    if (!currentSort.column || !currentSort.direction) {
      return [] as DeviceSortColumn[];
    }

    return currentSort.direction === "desc"
      ? [currentSort.column, currentSort.column]
      : [currentSort.column];
  }

  if (currentSort.column !== targetColumn || !currentSort.direction) {
    return targetDirection === "desc" ? [targetColumn] : [targetColumn, targetColumn];
  }

  if (currentSort.direction === targetDirection) {
    return [] as DeviceSortColumn[];
  }

  return currentSort.direction === "desc" ? [targetColumn] : [targetColumn, targetColumn];
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

const DeviceMobileCard = ({
  row,
  themeMutationDeviceId,
  blackScreenMutationDeviceId,
  batchThemeUpdating,
  batchBlackScreenUpdating,
  onToggleDeviceSelection,
  onViewDevice,
  onEditDevice,
  onPreviewDevice,
  onDeviceThemeChange,
  onDeviceBlackScreenModeChange,
  onDeleteDevice,
}: DeviceMobileCardProps) => {
  const facultyLabel = row.facultyCode || "Brak";

  return (
    <article
      className={`admin-device-card${row.isSelected ? " admin-device-card--selected" : ""}`}
      onClick={() => onViewDevice(row.device)}
      onKeyDown={(event) => handleCardKeyDown(event, () => onViewDevice(row.device))}
      tabIndex={0}
      role="button"
      aria-label={`Otwórz szczegóły tabletu ${row.displayName}`}
    >
      <div className="admin-device-card__header">
        <div className="admin-device-card__title-wrap">
          <strong>{row.roomLabel}</strong>
          <span className="admin-table__secondary">{row.connectionLabel}</span>
        </div>
        <label className="admin-device-card__select">
          <span>Zaznacz</span>
          <input
            type="checkbox"
            className="admin-table__checkbox"
            aria-label={`Zaznacz tablet ${row.displayName}`}
            checked={row.isSelected}
            onChange={() => onToggleDeviceSelection(row.id)}
            onClick={stopGridEventPropagation}
            onMouseDown={stopGridEventPropagation}
            onKeyDown={stopGridEventPropagation}
          />
        </label>
      </div>

      <div className="admin-device-card__meta-grid">
        <div className="admin-device-card__meta">
          <span>Wydział</span>
          <strong>{facultyLabel}</strong>
        </div>
        <div className="admin-device-card__meta">
          <span>Device ID</span>
          <strong>
            <span className="admin-table__meta-code">{row.formattedDeviceId}</span>
          </strong>
        </div>
        <div className="admin-device-card__meta">
          <span>Status</span>
          <strong>
            <span className={`admin-status-pill admin-status-pill--${row.connectionTone}`}>
              {row.connectionLabel}
            </span>
          </strong>
        </div>
        <div className="admin-device-card__meta">
          <span>Ostatni heartbeat</span>
          <strong>{row.formattedLastSeen}</strong>
        </div>
        <div className="admin-device-card__meta">
          <span>Tryb</span>
          <strong>
            <select
              className="admin-form-field__input admin-table__theme-select"
              value={row.device.displayTheme}
              disabled={themeMutationDeviceId === row.id || batchThemeUpdating}
              onChange={(event) =>
                onDeviceThemeChange(row.device, event.target.value as Device["displayTheme"])
              }
              onClick={stopGridEventPropagation}
              onMouseDown={stopGridEventPropagation}
              onKeyDown={stopGridEventPropagation}
            >
              <option value="dark">Ciemny</option>
              <option value="light">Jasny</option>
            </select>
          </strong>
        </div>
        <div className="admin-device-card__meta">
          <span>Czarny ekran</span>
          <strong>
            <select
              className="admin-form-field__input admin-table__mode-select"
              aria-label={`Czarny ekran ${row.displayName}`}
              value={row.device.blackScreenMode}
              disabled={
                blackScreenMutationDeviceId === row.id || batchBlackScreenUpdating
              }
              onChange={(event) =>
                onDeviceBlackScreenModeChange(
                  row.device,
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
          </strong>
        </div>
      </div>

      <div className="admin-device-card__actions admin-device-card__actions--inline">
        <button
          type="button"
          className="admin-button admin-button--secondary admin-button--small admin-button--icon"
          aria-label={`Edytuj tablet ${row.displayName}`}
          title="Edytuj"
          onClick={(event) => {
            stopGridEventPropagation(event);
            onEditDevice(row.device);
          }}
          onMouseDown={stopGridEventPropagation}
        >
          <i className="fas fa-pen" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="admin-button admin-button--secondary admin-button--small admin-button--icon"
          aria-label={`Podgląd tabletu ${row.displayName}`}
          title="Podgląd"
          onClick={(event) => {
            stopGridEventPropagation(event);
            onPreviewDevice(row.device);
          }}
          onMouseDown={stopGridEventPropagation}
        >
          <i className="fas fa-eye" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="admin-button admin-button--danger admin-button--small admin-button--icon"
          aria-label={`Usuń tablet ${row.displayName}`}
          title="Usuń"
          onClick={(event) => {
            stopGridEventPropagation(event);
            onDeleteDevice(row.device);
          }}
          onMouseDown={stopGridEventPropagation}
        >
          <i className="fas fa-trash-alt" aria-hidden="true" />
        </button>
      </div>
    </article>
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
  onViewDevice,
  onEditDevice,
  onPreviewDevice,
  onDeviceThemeChange,
  onDeviceBlackScreenModeChange,
  onDeleteDevice,
}: AdminDevicesTableProps) => {
  const isMobile = useIsMobileViewport();
  const mobileSortValue = getMobileSortValue(sortState);
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
    if (isMobile || !gridApiRef.current) {
      return;
    }

    scheduleRoomColumnResize(gridApiRef.current);
  }, [isMobile, scheduleRoomColumnResize, widestRoomLabel]);

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
        pinned: "left",
        lockPinned: true,
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
        pinned: "left",
        lockPinned: true,
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
        minWidth: 144,
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
      onPreviewDevice,
      onSortColumn,
      onToggleAllActiveDevices,
      onToggleDeviceSelection,
      selectAllRef,
      sortState,
      themeMutationDeviceId,
    ],
  );

  const handleRowClicked = (event: RowClickedEvent<DeviceGridRow>) => {
    if (!event.data || isInteractiveTarget(event.event?.target ?? null)) {
      return;
    }

    onViewDevice(event.data.device);
  };

  const handleCellKeyDown = (event: CellKeyDownEvent<DeviceGridRow>) => {
    if (!event.data || (event.event.key !== "Enter" && event.event.key !== " ")) {
      return;
    }

    if (isInteractiveTarget(event.event.target)) {
      return;
    }

    event.event.preventDefault();
    onViewDevice(event.data.device);
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

  const handleMobileSortChange = (nextValue: MobileSortValue) => {
    const [targetColumn, targetDirection] =
      nextValue === "default"
        ? [null, null]
        : (nextValue.split(":") as [DeviceSortColumn, SortDirection]);

    planSortTransitions(sortState, targetColumn, targetDirection).forEach((column) =>
      onSortColumn(column),
    );
  };

  if (isMobile) {
    return (
      <div className="admin-device-cards admin-devices-view__mobile">
        <span className="admin-table__caption">{caption}</span>

        <div className="admin-table__mobile-batch">
          <label className="admin-device-card__select admin-device-card__select--batch">
            <span>Zaznacz wszystkie</span>
            <input
              ref={selectAllRef}
              type="checkbox"
              className="admin-table__checkbox"
              aria-label="Zaznacz wszystkie widoczne tablety"
              checked={allActiveSelected}
              onChange={(event) => onToggleAllActiveDevices(event.target.checked)}
            />
          </label>

          <label className="admin-form-field admin-form-field--compact">
            <span className="admin-form-field__label">Sortowanie</span>
            <select
              className="admin-form-field__input"
              value={mobileSortValue}
              onChange={(event) =>
                handleMobileSortChange(event.target.value as MobileSortValue)
              }
              aria-label="Sortowanie listy sparowanych tabletów"
            >
              <option value="default">Domyślne</option>
              {sortableColumns.flatMap(({ column, label }) => [
                <option key={`${column}:desc`} value={`${column}:desc`}>
                  {label} malejąco
                </option>,
                <option key={`${column}:asc`} value={`${column}:asc`}>
                  {label} rosnąco
                </option>,
              ])}
            </select>
          </label>
        </div>

        <div className="admin-device-cards__list">
          {rows.map((row) => (
            <DeviceMobileCard
              key={row.id}
              row={row}
              themeMutationDeviceId={themeMutationDeviceId}
              blackScreenMutationDeviceId={blackScreenMutationDeviceId}
              batchThemeUpdating={batchThemeUpdating}
              batchBlackScreenUpdating={batchBlackScreenUpdating}
              onToggleDeviceSelection={onToggleDeviceSelection}
              onViewDevice={onViewDevice}
              onEditDevice={onEditDevice}
              onPreviewDevice={onPreviewDevice}
              onDeviceThemeChange={onDeviceThemeChange}
              onDeviceBlackScreenModeChange={onDeviceBlackScreenModeChange}
              onDeleteDevice={onDeleteDevice}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="admin-devices-grid">
      <span className="admin-table__caption">{caption}</span>
      {desktopBatchActions ? (
        <div className="admin-devices-grid__batch-shell">
          <div
            className="admin-devices-grid__batch-pinned"
            style={{ width: `${desktopGridChrome.pinnedLeftWidth}px` }}
          >
            <div className="admin-devices-grid__batch-title">{desktopPinnedTitle}</div>
          </div>
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
          getRowClass={({ data }) =>
            data?.isSelected
              ? "admin-devices-grid__row admin-devices-grid__row--selected"
              : "admin-devices-grid__row"
          }
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
