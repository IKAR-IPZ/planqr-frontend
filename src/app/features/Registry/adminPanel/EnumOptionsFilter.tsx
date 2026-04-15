import { useEffect, useMemo, useState } from "react";
import type { IDoesFilterPassParams } from "ag-grid-community";
import { type CustomFilterProps, useGridFilter } from "ag-grid-react";

export interface EnumOptionsFilterOption {
  value: string;
  label?: string;
  group?: string;
  description?: string;
}

export interface EnumOptionsFilterModel {
  values: string[];
}

export interface EnumOptionsFilterParams {
  options?: EnumOptionsFilterOption[];
  searchPlaceholder?: string;
  emptyStateLabel?: string;
  searchable?: boolean;
}

const EMPTY_OPTIONS: EnumOptionsFilterOption[] = [];

type EnumOptionsFilterProps<TData = unknown> = CustomFilterProps<
  TData,
  unknown,
  EnumOptionsFilterModel
> &
  EnumOptionsFilterParams;

const areValueListsEqual = (left: string[], right: string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const orderValues = (values: Iterable<string>, optionValues: string[]) => {
  const selectedValueSet = new Set(values);

  return optionValues.filter((value) => selectedValueSet.has(value));
};

const EnumOptionsFilter = <TData,>({
  model,
  getValue,
  onModelChange,
  onUiChange,
  api,
  colDef,
  options: providedOptions,
  searchPlaceholder: providedSearchPlaceholder,
  emptyStateLabel: providedEmptyStateLabel,
  searchable: providedSearchable,
}: EnumOptionsFilterProps<TData>) => {
  const filterParams = (colDef.filterParams ?? {}) as EnumOptionsFilterParams;
  const options = useMemo(
    () => providedOptions ?? filterParams.options ?? EMPTY_OPTIONS,
    [providedOptions, filterParams.options],
  );
  const optionValues = useMemo(() => options.map((option) => option.value), [options]);
  const optionValuesKey = useMemo(() => optionValues.join("\u001f"), [optionValues]);
  const appliedValues = useMemo(
    () => model?.values ?? optionValues,
    [model?.values, optionValues],
  );
  const [draftValues, setDraftValues] = useState<string[]>(appliedValues);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    setDraftValues(appliedValues);
  }, [appliedValues, optionValuesKey]);

  const searchPlaceholder =
    providedSearchPlaceholder ?? filterParams.searchPlaceholder ?? "Szukaj opcji";
  const emptyStateLabel =
    providedEmptyStateLabel ?? filterParams.emptyStateLabel ?? "Brak pasujących opcji.";
  const searchable = providedSearchable ?? filterParams.searchable ?? options.length >= 8;

  const visibleOptions = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();
    return normalizedSearchTerm
      ? options.filter((option) => {
          const label = option.label ?? option.value;
          const group = option.group ?? "";

          return `${label} ${group}`.toLowerCase().includes(normalizedSearchTerm);
        })
      : options;
  }, [options, searchTerm]);

  const isDirty = !areValueListsEqual(draftValues, appliedValues);
  const allSelected = draftValues.length === optionValues.length;
  const noneSelected = draftValues.length === 0;
  useGridFilter({
    doesFilterPass: ({ node }: IDoesFilterPassParams<TData>) => {
      if (!model?.values) {
        return true;
      }

      const cellValue = getValue(node);

      if (cellValue == null) {
        return model.values.includes("");
      }

      return model.values.includes(String(cellValue));
    },
  });

  const updateDraftValues = (nextValues: string[]) => {
    setDraftValues(nextValues);
    onUiChange();
  };

  const handleToggleValue = (value: string) => {
    const nextValueSet = new Set(draftValues);

    if (nextValueSet.has(value)) {
      nextValueSet.delete(value);
    } else {
      nextValueSet.add(value);
    }

    updateDraftValues(orderValues(nextValueSet, optionValues));
  };

  const applyCurrentSelection = () => {
    const normalizedValues = orderValues(draftValues, optionValues);
    const nextModel =
      normalizedValues.length === optionValues.length
        ? null
        : {
            values: normalizedValues,
          };

    onModelChange(nextModel);
    api.hideColumnFilter();
  };

  const resetAndClose = () => {
    const nextValues = [...optionValues];

    setDraftValues(nextValues);
    setSearchTerm("");
    onModelChange(null);
    api.hideColumnFilter();
  };

  return (
    <div
      className="admin-enum-filter"
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          applyCurrentSelection();
        }
      }}
    >
      {searchable ? (
        <label className="admin-form-field admin-enum-filter__search">
          <span className="admin-form-field__label">Szukaj opcji</span>
          <span className="admin-form-field__input-wrap">
            <i className="fas fa-search admin-form-field__icon" aria-hidden="true" />
            <input
              className="admin-form-field__input"
              type="search"
              value={searchTerm}
              placeholder={searchPlaceholder}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </span>
        </label>
      ) : null}

      <div className="admin-enum-filter__toolbar">
        <div className="admin-enum-filter__toolbar-buttons">
          <button
            type="button"
            className={`admin-enum-filter__chip${allSelected ? " admin-enum-filter__chip--active" : ""}`}
            onClick={() => updateDraftValues([...optionValues])}
          >
            Wszystkie
          </button>
          <button
            type="button"
            className={`admin-enum-filter__chip${noneSelected ? " admin-enum-filter__chip--active" : ""}`}
            onClick={() => updateDraftValues([])}
          >
            Wyczyść wybór
          </button>
        </div>
        <span className="admin-enum-filter__count">
          {draftValues.length}/{optionValues.length}
        </span>
      </div>

      <div className="admin-enum-filter__list" role="group" aria-label="Opcje filtra">
        {visibleOptions.length === 0 ? (
          <div className="admin-enum-filter__empty">{emptyStateLabel}</div>
        ) : (
          <div className="admin-enum-filter__group-items">
            {visibleOptions.map((option) => {
              const checked = draftValues.includes(option.value);

              return (
                <label key={option.value} className="admin-enum-filter__option">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => handleToggleValue(option.value)}
                  />
                  <span className="admin-enum-filter__option-label">
                    <strong>{option.label ?? option.value}</strong>
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      <div className="admin-enum-filter__actions">
        <button
          type="button"
          className="admin-button admin-button--ghost admin-button--small"
          onClick={resetAndClose}
        >
          Resetuj
        </button>
        <button
          type="button"
          className="admin-button admin-button--secondary admin-button--small"
          onClick={applyCurrentSelection}
          disabled={!isDirty}
        >
          Filtruj
        </button>
      </div>
    </div>
  );
};

export default EnumOptionsFilter;
