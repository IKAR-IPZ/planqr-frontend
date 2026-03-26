interface AdminPanelSearchFieldProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}

const AdminPanelSearchField = ({
  label,
  placeholder,
  value,
  onChange,
}: AdminPanelSearchFieldProps) => (
  <label className="admin-form-field admin-form-field--search">
    <span className="admin-form-field__label">{label}</span>
    <span className="admin-form-field__input-wrap">
      <i className="fas fa-search admin-form-field__icon" aria-hidden="true" />
      <input
        className="admin-form-field__input"
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </span>
  </label>
);

export default AdminPanelSearchField;
