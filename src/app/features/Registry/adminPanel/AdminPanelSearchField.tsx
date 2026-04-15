interface AdminPanelSearchFieldProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}

const AdminPanelSearchField = ({
  label,
  placeholder,
  value,
  onChange,
  compact = false,
}: AdminPanelSearchFieldProps) => (
  <label
    className={[
      "admin-form-field",
      "admin-form-field--search",
      compact ? "admin-form-field--search-inline" : "",
    ]
      .filter(Boolean)
      .join(" ")}
  >
    {!compact ? <span className="admin-form-field__label">{label}</span> : null}
    <span className="admin-form-field__input-wrap">
      <i className="fas fa-search admin-form-field__icon" aria-hidden="true" />
      <input
        className="admin-form-field__input"
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </span>
  </label>
);

export default AdminPanelSearchField;
