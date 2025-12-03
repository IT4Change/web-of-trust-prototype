import { useState } from 'react';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (text: string) => Promise<void>;
}

export function ImportModal({ isOpen, onClose, onImport }: ImportModalProps) {
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');

  const handleImport = async () => {
    setImportError('');
    try {
      await onImport(importText);
      setImportText('');
      onClose();
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Import fehlgeschlagen');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-xl space-y-4">
        <h3 className="font-bold text-lg">Assumptions importieren (JSON-Array)</h3>
        <p className="text-sm text-base-content/70">
          Erwartet wird ein JSON-Array von Strings oder Objekten mit <code>{"{ sentence, tags? }"}</code>.
        </p>
        <textarea
          className="textarea textarea-bordered w-full h-40"
          placeholder='z. B. [{"sentence":"Beispiel","tags":["foo","bar"]}]'
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
        />
        {importError && <div className="text-error text-sm">{importError}</div>}
        <div className="modal-action">
          <button className="btn" onClick={onClose}>
            Abbrechen
          </button>
          <button className="btn btn-primary" onClick={handleImport}>
            Importieren
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose}></div>
    </div>
  );
}
