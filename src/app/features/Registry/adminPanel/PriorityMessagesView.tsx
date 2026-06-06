import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  AllCommunityModule,
  ModuleRegistry,
  type ColDef,
  type ICellRendererParams,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";
import AdminPanelSection from "./AdminPanelSection";
import PriorityMessageGalleryView from "./PriorityMessageGalleryView";
import {
  formatAdminDate,
  formatPairingDeviceId,
  splitDeviceClassroom,
} from "./helpers";
import type {
  AdminPanelTheme,
  Device,
  PriorityMessagePreset,
  PriorityMessagePresetPayload,
  PriorityMessageSchedule,
  PriorityMessageSchedulePayload,
  PriorityMessageTemplate,
} from "./types";

ModuleRegistry.registerModules([AllCommunityModule]);

interface PriorityMessagesViewProps {
  adminTheme: AdminPanelTheme;
  templates: PriorityMessageTemplate[];
  devices: Device[];
  schedules: PriorityMessageSchedule[];
  presets: PriorityMessagePreset[];
  templatesLoading: boolean;
  schedulesLoading: boolean;
  presetsLoading: boolean;
  scheduleMutationId: string | null;
  presetMutationId: string | null;
  creatingSchedule: boolean;
  creatingTemplate: boolean;
  uploadingTemplate: boolean;
  mutatingTemplateId: string | null;
  onRefreshTemplates: () => void;
  onRefreshSchedules: () => void;
  onRefreshPresets: () => void;
  onSaveSchedule: (
    scheduleId: string | null,
    payload: PriorityMessageSchedulePayload,
  ) => Promise<boolean>;
  onDeleteSchedule: (schedule: PriorityMessageSchedule) => Promise<boolean>;
  onSavePreset: (
    presetId: string | null,
    payload: PriorityMessagePresetPayload,
  ) => Promise<boolean>;
  onDeletePreset: (preset: PriorityMessagePreset) => Promise<boolean>;
  onCreateTemplate: (payload: { name: string; file: File | null }) => Promise<boolean>;
  onUpdateTemplate: (
    template: PriorityMessageTemplate,
    payload: { name: string },
  ) => Promise<boolean>;
  onDeleteTemplate: (template: PriorityMessageTemplate) => Promise<boolean>;
}

interface ScheduleFormState {
  templateId: string;
  priority: number;
  targetType: "devices" | "faculty";
  deviceIds: number[];
  facultyCode: string;
  startsAt: string;
  endsAt: string;
}

interface PresetFormState {
  name: string;
  templateId: string;
  priority: number;
  startOffsetDays: number;
  durationDays: number;
}

interface SelectOption {
  value: string;
  label: string;
  meta?: string;
  imageUrl?: string;
}

interface StyledSelectProps {
  value: string;
  options: SelectOption[];
  placeholder: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

const StyledSelect = ({
  value,
  options,
  placeholder,
  disabled = false,
  onChange,
}: StyledSelectProps) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (
        rootRef.current &&
        event.target instanceof Node &&
        !rootRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  return (
    <div className="admin-priority-select" ref={rootRef}>
      <button
        type="button"
        className="admin-priority-select__trigger"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        disabled={disabled}
      >
        <span className="admin-priority-select__value">
          {selected?.imageUrl ? <img src={selected.imageUrl} alt="" /> : null}
          <span>
            <strong>{selected?.label || placeholder}</strong>
            {selected?.meta ? <small>{selected.meta}</small> : null}
          </span>
        </span>
        <i className="fas fa-chevron-down" aria-hidden="true" />
      </button>
      {open ? (
        <div className="admin-priority-select__menu">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={
                option.value === value
                  ? "admin-priority-select__option admin-priority-select__option--selected"
                  : "admin-priority-select__option"
              }
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.imageUrl ? <img src={option.imageUrl} alt="" /> : null}
              <span>
                <strong>{option.label}</strong>
                {option.meta ? <small>{option.meta}</small> : null}
              </span>
              {option.value === value ? (
                <i className="fas fa-check" aria-hidden="true" />
              ) : null}
            </button>
          ))}
          {options.length === 0 ? (
            <p className="admin-priority-select__empty">Brak dostępnych opcji.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

const toDateTimeLocalValue = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const getRoundedNow = () => {
  const date = new Date();
  date.setSeconds(0, 0);
  date.setMinutes(Math.ceil(date.getMinutes() / 5) * 5);
  return date;
};

const getDefaultDates = () => {
  const startsAt = getRoundedNow();
  const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
  return {
    startsAt: toDateTimeLocalValue(startsAt),
    endsAt: toDateTimeLocalValue(endsAt),
  };
};

const getPresetDates = (startOffsetDays: number, durationDays: number) => {
  const startsAt = getRoundedNow();
  if (startOffsetDays > 0) {
    startsAt.setDate(startsAt.getDate() + startOffsetDays);
    startsAt.setHours(0, 0, 0, 0);
  }

  const endsAt = new Date(startsAt);
  endsAt.setHours(0, 0, 0, 0);
  endsAt.setDate(endsAt.getDate() + durationDays);

  return {
    startsAt: toDateTimeLocalValue(startsAt),
    endsAt: toDateTimeLocalValue(endsAt),
  };
};

const createInitialForm = (templates: PriorityMessageTemplate[]): ScheduleFormState => ({
  templateId: templates[0]?.id ?? "",
  priority: 5,
  targetType: "devices",
  deviceIds: [],
  facultyCode: "",
  ...getDefaultDates(),
});

const createInitialPresetForm = (
  templates: PriorityMessageTemplate[],
): PresetFormState => ({
  name: "",
  templateId: templates[0]?.id ?? "",
  priority: 5,
  startOffsetDays: 0,
  durationDays: 1,
});

const getDeviceLabel = (device: Device) =>
  device.deviceClassroom || formatPairingDeviceId(device.deviceId);

const getRecipientsLabel = (schedule: PriorityMessageSchedule) => {
  if (schedule.targetType === "faculty") {
    return `Wydział ${schedule.facultyCode || "-"}`;
  }

  const labels = schedule.devices.map(
    (device) => device.room || formatPairingDeviceId(device.deviceId),
  );
  return labels.length <= 2
    ? labels.join(", ") || "Brak tabletów"
    : `${labels.length} tabletów`;
};

const getPresetStartLabel = (startOffsetDays: number) =>
  ["Od dziś", "Od jutra", "Za 2 dni", "Za 3 dni"][startOffsetDays] ?? "Od dziś";

const getPresetDurationLabel = (durationDays: number) =>
  `Przez ${durationDays} ${durationDays === 1 ? "dzień" : "dni"}`;

const ScheduleStatusCell = ({
  data,
}: ICellRendererParams<PriorityMessageSchedule>) => (
  <span
    className={`admin-priority-schedule__status admin-priority-schedule__status--${
      data?.status ?? "scheduled"
    }`}
  >
    {data?.status === "active" ? "Aktywny" : "Zaplanowany"}
  </span>
);

const ScheduleMessageCell = ({
  data,
}: ICellRendererParams<PriorityMessageSchedule>) => (
  <div className="admin-priority-schedule__message-cell">
    <img src={data?.template.imageUrl} alt="" />
    <span>{data?.template.name}</span>
  </div>
);

const ScheduleRecipientsCell = ({
  data,
}: ICellRendererParams<PriorityMessageSchedule>) => (
  <span className="admin-priority-schedule__truncate">
    {data ? getRecipientsLabel(data) : ""}
  </span>
);

interface ScheduleActionsCellParams
  extends ICellRendererParams<PriorityMessageSchedule> {
  mutatingId: string | null;
  onDetails: (schedule: PriorityMessageSchedule) => void;
  onEdit: (schedule: PriorityMessageSchedule) => void;
  onDelete: (schedule: PriorityMessageSchedule) => void;
}

const ScheduleActionsCell = ({
  data,
  mutatingId,
  onDetails,
  onEdit,
  onDelete,
}: ScheduleActionsCellParams) => {
  if (!data) {
    return null;
  }

  const disabled = mutatingId === data.id;
  return (
    <div className="admin-priority-schedule__actions">
      <button
        type="button"
        className="admin-button admin-button--ghost admin-button--small"
        onClick={() => onDetails(data)}
        disabled={disabled}
      >
        <i className="fas fa-eye" aria-hidden="true" />
        Szczegóły
      </button>
      <button
        type="button"
        className="admin-button admin-button--secondary admin-button--small"
        onClick={() => onEdit(data)}
        disabled={disabled}
      >
        <i className="fas fa-pen" aria-hidden="true" />
        Edytuj
      </button>
      <button
        type="button"
        className="admin-icon-button admin-icon-button--danger"
        onClick={() => onDelete(data)}
        disabled={disabled}
        title="Usuń"
        aria-label={`Usuń komunikat ${data.template.name}`}
      >
        <i className="fas fa-trash-alt" aria-hidden="true" />
      </button>
    </div>
  );
};

interface ModalShellProps {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: ReactNode;
}

const ModalShell = ({
  title,
  subtitle,
  onClose,
  children,
}: ModalShellProps) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="admin-priority-details__overlay" onClick={onClose}>
      <section
        className="admin-priority-details__dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`${title}: ${subtitle}`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="admin-priority-details__header">
          <div>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button
            type="button"
            className="admin-icon-button"
            onClick={onClose}
            aria-label="Zamknij"
          >
            <i className="fas fa-times" aria-hidden="true" />
          </button>
        </header>
        <div className="admin-priority-details__body">{children}</div>
      </section>
    </div>
  );
};

const ScheduleDetailsModal = ({
  schedule,
  onClose,
}: {
  schedule: PriorityMessageSchedule;
  onClose: () => void;
}) => (
  <ModalShell
    title="Szczegóły komunikatu"
    subtitle={schedule.template.name}
    onClose={onClose}
  >
    <div className="admin-priority-details__summary">
      <img
        className="admin-priority-details__preview"
        src={schedule.template.imageUrl}
        alt={schedule.template.name}
      />
      <div className="admin-detail-list">
        <div className="admin-detail-list__row">
          <span>Status</span>
          <strong>{schedule.status === "active" ? "Aktywny" : "Zaplanowany"}</strong>
        </div>
        <div className="admin-detail-list__row">
          <span>Priorytet</span>
          <strong>{schedule.priority}/10</strong>
        </div>
        <div className="admin-detail-list__row">
          <span>Odbiorcy</span>
          <strong>{getRecipientsLabel(schedule)}</strong>
        </div>
        <div className="admin-detail-list__row">
          <span>Od</span>
          <strong>{formatAdminDate(schedule.startsAt)}</strong>
        </div>
        <div className="admin-detail-list__row">
          <span>Do</span>
          <strong>{formatAdminDate(schedule.endsAt)}</strong>
        </div>
        <div className="admin-detail-list__row">
          <span>Autor</span>
          <strong>{schedule.createdBy || "brak danych"}</strong>
        </div>
      </div>
    </div>
    <div className="admin-priority-details__devices">
      <h3>Tablety ({schedule.devices.length})</h3>
      {schedule.devices.length > 0 ? (
        <ul>
          {schedule.devices.map((device) => (
            <li key={device.id}>
              <strong>{device.room || formatPairingDeviceId(device.deviceId)}</strong>
              <span>{formatPairingDeviceId(device.deviceId)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p>Brak aktualnie przypisanych tabletów.</p>
      )}
    </div>
  </ModalShell>
);

const PresetDetailsModal = ({
  preset,
  onClose,
}: {
  preset: PriorityMessagePreset;
  onClose: () => void;
}) => (
  <ModalShell title="Szczegóły presetu" subtitle={preset.name} onClose={onClose}>
    <div className="admin-priority-details__summary">
      <img
        className="admin-priority-details__preview"
        src={preset.template.imageUrl}
        alt={preset.template.name}
      />
      <div className="admin-detail-list">
        <div className="admin-detail-list__row">
          <span>Komunikat</span>
          <strong>{preset.template.name}</strong>
        </div>
        <div className="admin-detail-list__row">
          <span>Priorytet</span>
          <strong>{preset.priority}/10</strong>
        </div>
        <div className="admin-detail-list__row">
          <span>Czas</span>
          <strong>
            {getPresetStartLabel(preset.startOffsetDays)},{" "}
            {getPresetDurationLabel(preset.durationDays).toLocaleLowerCase("pl")}
          </strong>
        </div>
        <div className="admin-detail-list__row">
          <span>Autor</span>
          <strong>{preset.createdBy || "systemowy"}</strong>
        </div>
      </div>
    </div>
  </ModalShell>
);

const PriorityMessagesView = ({
  adminTheme,
  templates,
  devices,
  schedules,
  presets,
  templatesLoading,
  schedulesLoading,
  presetsLoading,
  scheduleMutationId,
  presetMutationId,
  creatingSchedule,
  creatingTemplate,
  uploadingTemplate,
  mutatingTemplateId,
  onRefreshTemplates,
  onRefreshSchedules,
  onRefreshPresets,
  onSaveSchedule,
  onDeleteSchedule,
  onSavePreset,
  onDeletePreset,
  onCreateTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
}: PriorityMessagesViewProps) => {
  const activeDevices = useMemo(
    () => devices.filter((device) => device.status === "ACTIVE"),
    [devices],
  );
  const faculties = useMemo(
    () =>
      Array.from(
        new Set(
          activeDevices
            .map((device) => splitDeviceClassroom(device.deviceClassroom).facultyCode)
            .filter(Boolean),
        ),
      ).sort((left, right) => left.localeCompare(right, "pl", { numeric: true })),
    [activeDevices],
  );
  const templateOptions = useMemo<SelectOption[]>(
    () =>
      templates.map((template) => ({
        value: template.id,
        label: template.name,
        meta: template.mediaType === "gif" ? "GIF" : "Grafika",
        imageUrl: template.imageUrl,
      })),
    [templates],
  );
  const facultyOptions = useMemo<SelectOption[]>(
    () =>
      faculties.map((faculty) => ({
        value: faculty,
        label: faculty,
        meta: `${
          activeDevices.filter(
            (device) =>
              splitDeviceClassroom(device.deviceClassroom).facultyCode === faculty,
          ).length
        } tabletów`,
      })),
    [activeDevices, faculties],
  );
  const presetStartOptions: SelectOption[] = [
    { value: "0", label: "Od dziś" },
    { value: "1", label: "Od jutra" },
    { value: "2", label: "Za 2 dni" },
    { value: "3", label: "Za 3 dni" },
  ];
  const presetDurationOptions: SelectOption[] = [
    { value: "1", label: "Przez 1 dzień" },
    { value: "2", label: "Przez 2 dni" },
    { value: "3", label: "Przez 3 dni" },
  ];

  const [form, setForm] = useState<ScheduleFormState>(() => createInitialForm(templates));
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [deviceSearch, setDeviceSearch] = useState("");
  const [devicePickerOpen, setDevicePickerOpen] = useState(false);
  const [detailsSchedule, setDetailsSchedule] =
    useState<PriorityMessageSchedule | null>(null);
  const [presetEditorOpen, setPresetEditorOpen] = useState(false);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [presetForm, setPresetForm] = useState<PresetFormState>(() =>
    createInitialPresetForm(templates),
  );
  const [presetError, setPresetError] = useState("");
  const [detailsPreset, setDetailsPreset] =
    useState<PriorityMessagePreset | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!form.templateId && templates[0]) {
      setForm((current) => ({ ...current, templateId: templates[0].id }));
    }
    if (!presetForm.templateId && templates[0]) {
      setPresetForm((current) => ({ ...current, templateId: templates[0].id }));
    }
  }, [form.templateId, presetForm.templateId, templates]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (
        pickerRef.current &&
        event.target instanceof Node &&
        !pickerRef.current.contains(event.target)
      ) {
        setDevicePickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const filteredDevices = useMemo(() => {
    const query = deviceSearch.trim().toLocaleLowerCase("pl");
    if (!query) {
      return activeDevices;
    }

    return activeDevices.filter((device) =>
      [
        device.deviceClassroom,
        device.deviceId,
        splitDeviceClassroom(device.deviceClassroom).facultyCode,
      ]
        .filter(Boolean)
        .some((value) => value?.toLocaleLowerCase("pl").includes(query)),
    );
  }, [activeDevices, deviceSearch]);

  const resetForm = () => {
    setForm(createInitialForm(templates));
    setEditingScheduleId(null);
    setFormError("");
    setDeviceSearch("");
    setDevicePickerOpen(false);
  };

  const resetPresetForm = () => {
    setPresetForm(createInitialPresetForm(templates));
    setEditingPresetId(null);
    setPresetError("");
    setPresetEditorOpen(false);
  };

  const startEditingSchedule = (schedule: PriorityMessageSchedule) => {
    setForm({
      templateId: schedule.template.id,
      priority: schedule.priority,
      targetType: schedule.targetType,
      deviceIds: schedule.deviceIds,
      facultyCode: schedule.facultyCode ?? "",
      startsAt: toDateTimeLocalValue(new Date(schedule.startsAt)),
      endsAt: toDateTimeLocalValue(new Date(schedule.endsAt)),
    });
    setEditingScheduleId(schedule.id);
    setFormError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const startEditingPreset = (preset: PriorityMessagePreset) => {
    setPresetForm({
      name: preset.name,
      templateId: preset.template.id,
      priority: preset.priority,
      startOffsetDays: preset.startOffsetDays,
      durationDays: preset.durationDays,
    });
    setEditingPresetId(preset.id);
    setPresetError("");
    setPresetEditorOpen(true);
  };

  const applyPreset = (preset: PriorityMessagePreset) => {
    setForm((current) => ({
      ...current,
      templateId: preset.template.id,
      priority: preset.priority,
      ...getPresetDates(preset.startOffsetDays, preset.durationDays),
    }));
    setFormError("");
  };

  const handleSubmit = async () => {
    if (!form.templateId) {
      setFormError("Wybierz komunikat.");
      return;
    }
    if (form.targetType === "devices" && form.deviceIds.length === 0) {
      setFormError("Wybierz co najmniej jeden tablet.");
      return;
    }
    if (form.targetType === "faculty" && !form.facultyCode) {
      setFormError("Wybierz wydział.");
      return;
    }

    const startsAt = new Date(form.startsAt);
    const endsAt = new Date(form.endsAt);
    if (
      Number.isNaN(startsAt.getTime()) ||
      Number.isNaN(endsAt.getTime()) ||
      endsAt <= startsAt
    ) {
      setFormError("Data zakończenia musi być późniejsza niż data rozpoczęcia.");
      return;
    }

    setFormError("");
    const saved = await onSaveSchedule(editingScheduleId, {
      templateId: form.templateId,
      priority: form.priority,
      targetType: form.targetType,
      facultyCode: form.targetType === "faculty" ? form.facultyCode : null,
      deviceIds: form.targetType === "devices" ? form.deviceIds : [],
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    });
    if (saved) {
      resetForm();
    }
  };

  const handlePresetSubmit = async () => {
    if (!presetForm.name.trim()) {
      setPresetError("Podaj nazwę presetu.");
      return;
    }
    if (!presetForm.templateId) {
      setPresetError("Wybierz komunikat.");
      return;
    }

    setPresetError("");
    const saved = await onSavePreset(editingPresetId, {
      name: presetForm.name.trim(),
      templateId: presetForm.templateId,
      priority: presetForm.priority,
      startOffsetDays: presetForm.startOffsetDays,
      durationDays: presetForm.durationDays,
    });
    if (saved) {
      resetPresetForm();
    }
  };

  const columnDefs = useMemo<ColDef<PriorityMessageSchedule>[]>(
    () => [
      {
        headerName: "Status",
        field: "status",
        width: 118,
        minWidth: 118,
        cellRenderer: ScheduleStatusCell,
      },
      {
        headerName: "Komunikat",
        field: "template.name",
        minWidth: 190,
        flex: 1.1,
        cellRenderer: ScheduleMessageCell,
      },
      {
        headerName: "Priorytet",
        field: "priority",
        width: 100,
        minWidth: 100,
      },
      {
        headerName: "Odbiorcy",
        minWidth: 170,
        flex: 1,
        cellRenderer: ScheduleRecipientsCell,
      },
      {
        headerName: "Od",
        field: "startsAt",
        minWidth: 140,
        valueFormatter: ({ value }) => formatAdminDate(value) ?? "",
      },
      {
        headerName: "Do",
        field: "endsAt",
        minWidth: 140,
        valueFormatter: ({ value }) => formatAdminDate(value) ?? "",
      },
      {
        headerName: "Akcje",
        minWidth: 300,
        width: 300,
        cellRenderer: ScheduleActionsCell,
        cellRendererParams: {
          mutatingId: scheduleMutationId,
          onDetails: setDetailsSchedule,
          onEdit: startEditingSchedule,
          onDelete: (schedule: PriorityMessageSchedule) => {
            void onDeleteSchedule(schedule);
          },
        },
      },
    ],
    [onDeleteSchedule, scheduleMutationId],
  );

  const visibleScheduleRows = Math.max(2, Math.min(schedules.length, 7));
  const gridHeight = 42 + visibleScheduleRows * 44 + 28;
  const gridStyle = { "--priority-grid-height": `${gridHeight}px` } as CSSProperties;
  const selectedDeviceLabels = activeDevices
    .filter((device) => form.deviceIds.includes(device.id))
    .map(getDeviceLabel);

  return (
    <div className="admin-priority-messages-view">
      <div className="admin-priority-top-grid">
        <AdminPanelSection
          title={editingScheduleId ? "Edytuj komunikat" : "Utwórz komunikat"}
          className="admin-priority-composer-section"
        >
          <div className="admin-priority-composer">
            <div className="admin-priority-composer__columns">
              <div className="admin-priority-composer__primary">
                <label className="admin-form-field">
                  <span className="admin-form-field__label">Komunikat</span>
                  <StyledSelect
                    value={form.templateId}
                    options={templateOptions}
                    placeholder="Wybierz komunikat"
                    disabled={creatingSchedule || templatesLoading}
                    onChange={(templateId) =>
                      setForm((current) => ({ ...current, templateId }))
                    }
                  />
                </label>
                <div className="admin-priority-composer__dates">
                  <label className="admin-form-field">
                    <span className="admin-form-field__label">Od</span>
                    <input
                      className="admin-form-field__input"
                      type="datetime-local"
                      value={form.startsAt}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          startsAt: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="admin-form-field">
                    <span className="admin-form-field__label">Do</span>
                    <input
                      className="admin-form-field__input"
                      type="datetime-local"
                      value={form.endsAt}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          endsAt: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                <label className="admin-form-field admin-priority-composer__priority">
                  <span className="admin-form-field__label">Priorytet</span>
                  <input
                    className="admin-form-field__input"
                    type="number"
                    min={1}
                    max={10}
                    value={form.priority}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        priority: Math.min(
                          10,
                          Math.max(1, Number(event.target.value) || 1),
                        ),
                      }))
                    }
                    disabled={creatingSchedule}
                  />
                </label>
              </div>

              <div className="admin-priority-composer__recipients">
                <div className="admin-form-field admin-priority-composer__target-mode">
                  <span className="admin-form-field__label">Odbiorcy</span>
                  <div className="admin-segmented-control">
                    <button
                      type="button"
                      className={
                        form.targetType === "devices"
                          ? "admin-segmented-control__button admin-segmented-control__button--active"
                          : "admin-segmented-control__button"
                      }
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          targetType: "devices",
                        }))
                      }
                    >
                      <i className="fas fa-tablet-alt" aria-hidden="true" />
                      Tablety
                    </button>
                    <button
                      type="button"
                      className={
                        form.targetType === "faculty"
                          ? "admin-segmented-control__button admin-segmented-control__button--active"
                          : "admin-segmented-control__button"
                      }
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          targetType: "faculty",
                        }))
                      }
                    >
                      <i className="fas fa-building" aria-hidden="true" />
                      Wydział
                    </button>
                  </div>
                </div>

                {form.targetType === "devices" ? (
                  <div
                    className="admin-form-field admin-priority-device-picker"
                    ref={pickerRef}
                  >
                    <span className="admin-form-field__label">Lista tabletów</span>
                    <button
                      type="button"
                      className="admin-priority-device-picker__trigger"
                      onClick={() => setDevicePickerOpen((current) => !current)}
                      aria-expanded={devicePickerOpen}
                    >
                      <span>
                        {selectedDeviceLabels.length === 0
                          ? "Wybierz tablety"
                          : selectedDeviceLabels.length <= 2
                            ? selectedDeviceLabels.join(", ")
                            : `${selectedDeviceLabels.length} tabletów`}
                      </span>
                      <i className="fas fa-chevron-down" aria-hidden="true" />
                    </button>
                    {devicePickerOpen ? (
                      <div className="admin-priority-device-picker__menu">
                        <div className="admin-priority-device-picker__search">
                          <i className="fas fa-search" aria-hidden="true" />
                          <input
                            type="search"
                            value={deviceSearch}
                            onChange={(event) => setDeviceSearch(event.target.value)}
                            placeholder="Szukaj sali lub tabletu"
                            autoFocus
                          />
                        </div>
                        <div className="admin-priority-device-picker__options">
                          {filteredDevices.map((device) => (
                            <label key={device.id}>
                              <input
                                type="checkbox"
                                checked={form.deviceIds.includes(device.id)}
                                onChange={(event) =>
                                  setForm((current) => ({
                                    ...current,
                                    deviceIds: event.target.checked
                                      ? [...current.deviceIds, device.id]
                                      : current.deviceIds.filter(
                                          (id) => id !== device.id,
                                        ),
                                  }))
                                }
                              />
                              <span>
                                <strong>{getDeviceLabel(device)}</strong>
                                <small>{formatPairingDeviceId(device.deviceId)}</small>
                              </span>
                            </label>
                          ))}
                          {filteredDevices.length === 0 ? (
                            <p>Brak pasujących tabletów.</p>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <label className="admin-form-field">
                    <span className="admin-form-field__label">Wydział</span>
                    <StyledSelect
                      value={form.facultyCode}
                      options={facultyOptions}
                      placeholder="Wybierz wydział"
                      onChange={(facultyCode) =>
                        setForm((current) => ({ ...current, facultyCode }))
                      }
                    />
                  </label>
                )}
              </div>
            </div>

            <div className="admin-priority-composer__footer">
              <div className="admin-priority-composer__feedback" role="status">
                {formError}
              </div>
              <div className="admin-priority-composer__actions">
                <button
                  type="button"
                  className="admin-button admin-button--ghost"
                  onClick={resetForm}
                  disabled={creatingSchedule}
                >
                  Anuluj
                </button>
                <button
                  type="button"
                  className="admin-button admin-button--primary"
                  onClick={() => void handleSubmit()}
                  disabled={creatingSchedule}
                >
                  <i
                    className={
                      creatingSchedule ? "fas fa-spinner fa-spin" : "fas fa-check"
                    }
                    aria-hidden="true"
                  />
                  {creatingSchedule ? "Zapisywanie" : "Zatwierdź"}
                </button>
              </div>
            </div>
          </div>
        </AdminPanelSection>

        <AdminPanelSection
          title="Presety"
          className="admin-priority-presets-section"
          actions={
            <div className="admin-priority-presets__header-actions">
              <button
                type="button"
                className="admin-icon-button"
                onClick={onRefreshPresets}
                disabled={presetsLoading}
                title="Odśwież presety"
                aria-label="Odśwież presety"
              >
                <i
                  className={`fas fa-sync-alt ${presetsLoading ? "fa-spin" : ""}`}
                  aria-hidden="true"
                />
              </button>
              <button
                type="button"
                className="admin-icon-button admin-icon-button--primary"
                onClick={() => {
                  if (presetEditorOpen && !editingPresetId) {
                    resetPresetForm();
                  } else {
                    setPresetForm(createInitialPresetForm(templates));
                    setEditingPresetId(null);
                    setPresetError("");
                    setPresetEditorOpen(true);
                  }
                }}
                title="Dodaj preset"
                aria-label="Dodaj preset"
              >
                <i className="fas fa-plus" aria-hidden="true" />
              </button>
            </div>
          }
        >
          <div className="admin-priority-presets">
            {presetEditorOpen ? (
              <div className="admin-priority-preset-form">
                <div className="admin-priority-preset-form__heading">
                  <strong>{editingPresetId ? "Edytuj preset" : "Nowy preset"}</strong>
                  <button
                    type="button"
                    className="admin-icon-button"
                    onClick={resetPresetForm}
                    aria-label="Zamknij kreator presetu"
                  >
                    <i className="fas fa-times" aria-hidden="true" />
                  </button>
                </div>
                <label className="admin-form-field">
                  <span className="admin-form-field__label">Nazwa</span>
                  <input
                    className="admin-form-field__input"
                    value={presetForm.name}
                    onChange={(event) =>
                      setPresetForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="Np. Ewakuacja"
                  />
                </label>
                <label className="admin-form-field">
                  <span className="admin-form-field__label">Komunikat</span>
                  <StyledSelect
                    value={presetForm.templateId}
                    options={templateOptions}
                    placeholder="Wybierz komunikat"
                    onChange={(templateId) =>
                      setPresetForm((current) => ({ ...current, templateId }))
                    }
                  />
                </label>
                <div className="admin-priority-preset-form__row">
                  <label className="admin-form-field">
                    <span className="admin-form-field__label">Początek</span>
                    <StyledSelect
                      value={String(presetForm.startOffsetDays)}
                      options={presetStartOptions}
                      placeholder="Wybierz początek"
                      onChange={(startOffsetDays) =>
                        setPresetForm((current) => ({
                          ...current,
                          startOffsetDays: Number(startOffsetDays),
                        }))
                      }
                    />
                  </label>
                  <label className="admin-form-field">
                    <span className="admin-form-field__label">Czas trwania</span>
                    <StyledSelect
                      value={String(presetForm.durationDays)}
                      options={presetDurationOptions}
                      placeholder="Wybierz czas"
                      onChange={(durationDays) =>
                        setPresetForm((current) => ({
                          ...current,
                          durationDays: Number(durationDays),
                        }))
                      }
                    />
                  </label>
                  <label className="admin-form-field">
                    <span className="admin-form-field__label">Priorytet</span>
                    <input
                      className="admin-form-field__input"
                      type="number"
                      min={1}
                      max={10}
                      value={presetForm.priority}
                      onChange={(event) =>
                        setPresetForm((current) => ({
                          ...current,
                          priority: Math.min(
                            10,
                            Math.max(1, Number(event.target.value) || 1),
                          ),
                        }))
                      }
                    />
                  </label>
                </div>
                <div className="admin-priority-preset-form__footer">
                  <span>{presetError}</span>
                  <button
                    type="button"
                    className="admin-button admin-button--primary admin-button--small"
                    onClick={() => void handlePresetSubmit()}
                    disabled={presetMutationId !== null}
                  >
                    {presetMutationId ? "Zapisywanie" : "Zapisz preset"}
                  </button>
                </div>
              </div>
            ) : null}

            <div className="admin-priority-presets__list">
              {presets.map((preset) => {
                const mutating = presetMutationId === preset.id;
                return (
                  <div key={preset.id} className="admin-priority-preset-row">
                    <button
                      type="button"
                      className="admin-priority-preset-row__main"
                      onClick={() => applyPreset(preset)}
                      disabled={mutating}
                      title="Zastosuj preset"
                    >
                      <img src={preset.template.imageUrl} alt="" />
                      <span>
                        <strong>{preset.name}</strong>
                        <small>
                          {getPresetStartLabel(preset.startOffsetDays)} ·{" "}
                          {getPresetDurationLabel(preset.durationDays).toLocaleLowerCase(
                            "pl",
                          )}{" "}
                          · priorytet {preset.priority}
                        </small>
                      </span>
                    </button>
                    <div className="admin-priority-preset-row__actions">
                      <button
                        type="button"
                        className="admin-icon-button"
                        onClick={() => setDetailsPreset(preset)}
                        disabled={mutating}
                        title="Szczegóły"
                        aria-label={`Szczegóły presetu ${preset.name}`}
                      >
                        <i className="fas fa-eye" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="admin-icon-button"
                        onClick={() => startEditingPreset(preset)}
                        disabled={mutating}
                        title="Edytuj"
                        aria-label={`Edytuj preset ${preset.name}`}
                      >
                        <i className="fas fa-pen" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="admin-icon-button admin-icon-button--danger"
                        onClick={() => void onDeletePreset(preset)}
                        disabled={mutating}
                        title="Usuń"
                        aria-label={`Usuń preset ${preset.name}`}
                      >
                        <i className="fas fa-trash-alt" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                );
              })}
              {presets.length === 0 ? (
                <div className="admin-priority-presets__empty">
                  {presetsLoading ? "Ładowanie presetów..." : "Brak presetów."}
                </div>
              ) : null}
            </div>
          </div>
        </AdminPanelSection>
      </div>

      <AdminPanelSection
        title="Zaplanowane i aktywne komunikaty"
        actions={
          <button
            type="button"
            className="admin-button admin-button--secondary admin-button--small"
            onClick={onRefreshSchedules}
            disabled={schedulesLoading}
          >
            <i
              className={`fas fa-sync-alt ${schedulesLoading ? "fa-spin" : ""}`}
              aria-hidden="true"
            />
            Odśwież
          </button>
        }
      >
        <div className="admin-priority-schedule-list" style={gridStyle}>
          <div
            className={`admin-priority-schedule-list__grid ${
              adminTheme === "dark" ? "ag-theme-quartz-dark" : "ag-theme-quartz"
            }`}
          >
            <AgGridReact<PriorityMessageSchedule>
              theme="legacy"
              rowData={schedules}
              columnDefs={columnDefs}
              defaultColDef={{
                sortable: true,
                resizable: true,
                suppressMovable: true,
              }}
              getRowId={({ data }) => data.id}
              headerHeight={42}
              rowHeight={44}
              animateRows={false}
              ensureDomOrder
              suppressCellFocus={false}
              overlayNoRowsTemplate={
                schedulesLoading
                  ? '<span class="admin-priority-schedule__overlay">Ładowanie komunikatów...</span>'
                  : '<span class="admin-priority-schedule__overlay">Brak aktywnych i zaplanowanych komunikatów.</span>'
              }
            />
          </div>
        </div>
      </AdminPanelSection>

      <PriorityMessageGalleryView
        templates={templates}
        loading={templatesLoading}
        creating={creatingTemplate}
        uploading={uploadingTemplate}
        mutatingTemplateId={mutatingTemplateId}
        onRefresh={onRefreshTemplates}
        onCreate={onCreateTemplate}
        onUpdate={onUpdateTemplate}
        onDelete={onDeleteTemplate}
      />

      {detailsSchedule ? (
        <ScheduleDetailsModal
          schedule={detailsSchedule}
          onClose={() => setDetailsSchedule(null)}
        />
      ) : null}
      {detailsPreset ? (
        <PresetDetailsModal
          preset={detailsPreset}
          onClose={() => setDetailsPreset(null)}
        />
      ) : null}
    </div>
  );
};

export default PriorityMessagesView;
