import { useState } from "react";
import AdminPanelSection from "./AdminPanelSection";
import { formatAdminDate } from "./helpers";
import type { PriorityMessageTemplate } from "./types";

interface PriorityMessageGalleryViewProps {
  templates: PriorityMessageTemplate[];
  loading: boolean;
  creating: boolean;
  uploading: boolean;
  mutatingTemplateId: string | null;
  onRefresh: () => void;
  onCreate: (payload: {
    name: string;
    file: File | null;
  }) => Promise<boolean>;
  onUpdate: (
    template: PriorityMessageTemplate,
    payload: { name: string },
  ) => Promise<boolean>;
  onDelete: (template: PriorityMessageTemplate) => Promise<boolean>;
}

const getFileNameWithoutExtension = (fileName: string) =>
  fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();

const PriorityMessageGalleryView = ({
  templates,
  loading,
  creating,
  uploading,
  mutatingTemplateId,
  onRefresh,
  onCreate,
  onUpdate,
  onDelete,
}: PriorityMessageGalleryViewProps) => {
  const [newName, setNewName] = useState("");
  const [newFile, setNewFile] = useState<File | null>(null);
  const [createFormVersion, setCreateFormVersion] = useState(0);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const isCreating = creating || uploading;

  const startEditing = (template: PriorityMessageTemplate) => {
    setEditingTemplateId(template.id);
    setEditName(template.name);
  };

  const resetCreateForm = () => {
    setNewName("");
    setNewFile(null);
    setCreateFormVersion((current) => current + 1);
  };

  const handleCreate = async () => {
    const created = await onCreate({
      name: newName,
      file: newFile,
    });

    if (created) {
      resetCreateForm();
    }
  };

  const handleUpdate = async (template: PriorityMessageTemplate) => {
    const updated = await onUpdate(template, {
      name: editName,
    });

    if (updated) {
      setEditingTemplateId(null);
    }
  };

  return (
    <div className="admin-priority-gallery-view">
      <AdminPanelSection
        title="Galeria komunikatów"
        actions={
          <button
            type="button"
            className="admin-button admin-button--secondary admin-button--small"
            onClick={onRefresh}
            disabled={loading}
          >
            <i className={`fas fa-sync-alt ${loading ? "fa-spin" : ""}`} aria-hidden="true" />
            Odśwież
          </button>
        }
      >
        <div className="admin-priority-gallery">
          <div className="admin-priority-gallery__create">
            <label className="admin-form-field">
              <span className="admin-form-field__label">Nazwa</span>
              <input
                className="admin-form-field__input"
                type="text"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                disabled={isCreating}
              />
            </label>

            <label className="admin-form-field">
              <span className="admin-form-field__label">Plik (maks. 50 MB)</span>
              <input
                key={createFormVersion}
                className="admin-form-field__input"
                type="file"
                accept="image/gif,image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setNewFile(file);
                  if (file && !newName.trim()) {
                    setNewName(getFileNameWithoutExtension(file.name));
                  }
                }}
                disabled={isCreating}
              />
            </label>

            <button
              type="button"
              className="admin-button admin-button--primary"
              onClick={() => void handleCreate()}
              disabled={isCreating}
            >
              <i className="fas fa-plus" aria-hidden="true" />
              {uploading ? "Wgrywanie" : creating ? "Dodawanie" : "Dodaj komunikat"}
            </button>
          </div>

          {templates.length === 0 ? (
            <div className="admin-empty-state">
              <h3>{loading ? "Ładowanie galerii" : "Brak komunikatów"}</h3>
              <p>{loading ? "Trwa pobieranie komunikatów." : "Dodaj pierwszy komunikat."}</p>
            </div>
          ) : (
            <div className="admin-priority-gallery__grid">
              {templates.map((template) => {
                const isEditing = editingTemplateId === template.id;
                const isMutating = mutatingTemplateId === template.id;

                return (
                  <article
                    key={template.id}
                    className={`admin-priority-gallery__item ${
                      isEditing ? "admin-priority-gallery__item--editing" : ""
                    }`}
                  >
                    <div className="admin-priority-gallery__preview">
                      <img src={template.imageUrl} alt={template.name} loading="lazy" />
                    </div>

                    <div className="admin-priority-gallery__details">
                      {isEditing ? (
                        <>
                          <label className="admin-form-field">
                            <span className="admin-form-field__label">Nazwa</span>
                            <input
                              className="admin-form-field__input"
                              type="text"
                              value={editName}
                              onChange={(event) => setEditName(event.target.value)}
                              disabled={isMutating}
                            />
                          </label>
                        </>
                      ) : (
                        <>
                          <div className="admin-priority-gallery__title-row">
                            <strong>{template.name}</strong>
                            <span>{template.mediaType === "gif" ? "GIF" : "Grafika"}</span>
                          </div>
                          <span className="admin-priority-gallery__meta">
                            {template.isBuiltin ? "Systemowy" : "Dodany w panelu"}
                            {template.updatedAt ? ` - ${formatAdminDate(template.updatedAt)}` : ""}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="admin-priority-gallery__actions">
                      <a
                        className="admin-button admin-button--ghost admin-button--small"
                        href={template.imageUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <i className="fas fa-eye" aria-hidden="true" />
                        Podgląd
                      </a>

                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            className="admin-button admin-button--primary admin-button--small"
                            onClick={() => void handleUpdate(template)}
                            disabled={isMutating}
                          >
                            {isMutating ? "Zapisywanie" : "Zapisz"}
                          </button>
                          <button
                            type="button"
                            className="admin-button admin-button--ghost admin-button--small"
                            onClick={() => setEditingTemplateId(null)}
                            disabled={isMutating}
                          >
                            Anuluj
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="admin-button admin-button--secondary admin-button--small"
                            onClick={() => startEditing(template)}
                            disabled={template.isBuiltin || isMutating}
                          >
                            <i className="fas fa-pen" aria-hidden="true" />
                            Zmień nazwę
                          </button>
                          <button
                            type="button"
                            className="admin-button admin-button--danger admin-button--small"
                            onClick={() => void onDelete(template)}
                            disabled={template.isBuiltin || isMutating}
                          >
                            <i className="fas fa-trash-alt" aria-hidden="true" />
                            Usuń
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </AdminPanelSection>
    </div>
  );
};

export default PriorityMessageGalleryView;
