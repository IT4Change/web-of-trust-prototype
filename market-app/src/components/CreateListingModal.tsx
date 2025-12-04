import { useState } from 'react';
import type { ListingType, CategoryId } from '../schema';
import { CATEGORIES } from '../schema';

interface CreateListingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    type: ListingType;
    title: string;
    description: string;
    categoryId: CategoryId;
    location?: string;
  }) => void;
}

export function CreateListingModal({
  isOpen,
  onClose,
  onSubmit,
}: CreateListingModalProps) {
  const [type, setType] = useState<ListingType>('offer');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<CategoryId>('other');
  const [location, setLocation] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    onSubmit({
      type,
      title: title.trim(),
      description: description.trim(),
      categoryId,
      location: location.trim() || undefined,
    });

    // Reset form
    setType('offer');
    setTitle('');
    setDescription('');
    setCategoryId('other');
    setLocation('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-lg">
        <h3 className="font-bold text-lg mb-4">Neues Inserat erstellen</h3>

        <form onSubmit={handleSubmit}>
          {/* Type Toggle */}
          <div className="form-control mb-4">
            <label className="label">
              <span className="label-text font-medium">Art des Inserats</span>
            </label>
            <div className="join w-full">
              <button
                type="button"
                className={`join-item btn flex-1 ${type === 'offer' ? 'btn-success' : 'btn-outline'}`}
                onClick={() => setType('offer')}
              >
                🤲 Ich biete
              </button>
              <button
                type="button"
                className={`join-item btn flex-1 ${type === 'need' ? 'btn-warning' : 'btn-outline'}`}
                onClick={() => setType('need')}
              >
                🙋 Ich suche
              </button>
            </div>
          </div>

          {/* Title */}
          <div className="form-control mb-4">
            <label className="label">
              <span className="label-text font-medium">Titel</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              placeholder={type === 'offer' ? 'Was bietest du an?' : 'Was suchst du?'}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              required
            />
          </div>

          {/* Category */}
          <div className="form-control mb-4">
            <label className="label">
              <span className="label-text font-medium">Kategorie</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value as CategoryId)}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div className="form-control mb-4">
            <label className="label">
              <span className="label-text font-medium">Beschreibung</span>
            </label>
            <textarea
              className="textarea textarea-bordered w-full h-24"
              placeholder="Beschreibe dein Angebot oder deinen Bedarf..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              required
            />
          </div>

          {/* Location */}
          <div className="form-control mb-6">
            <label className="label">
              <span className="label-text font-medium">Ort (optional)</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              placeholder="z.B. Berlin-Kreuzberg"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              maxLength={100}
            />
          </div>

          {/* Actions */}
          <div className="modal-action">
            <button type="button" className="btn" onClick={onClose}>
              Abbrechen
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!title.trim() || !description.trim()}
            >
              Erstellen
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}
