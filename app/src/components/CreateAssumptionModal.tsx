import { useState } from 'react';

interface CreateAssumptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (sentence: string, tags: string[]) => void;
}

/**
 * Modal for creating a new assumption
 */
export function CreateAssumptionModal({
  isOpen,
  onClose,
  onCreate,
}: CreateAssumptionModalProps) {
  const [sentence, setSentence] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!sentence.trim()) return;

    const parsedTags = tagsInput
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    setIsSubmitting(true);
    try {
      onCreate(sentence.trim(), parsedTags);
      setSentence('');
      setTagsInput('');
      onClose();
    } catch (error) {
      console.error('Failed to create assumption:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg mb-4">Create New Assumption</h3>

        <form onSubmit={handleSubmit}>
          <div className="form-control w-full">
            <label className="label">
              <span className="label-text">Statement *</span>
            </label>
            <input
              type="text"
              placeholder="Enter a single-sentence assumption"
              className="input input-bordered w-full"
              value={sentence}
              onChange={(e) => setSentence(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-control w-full mt-4">
            <label className="label">
              <span className="label-text">Tags (comma separated)</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              placeholder="e.g. climate, policy, energy"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
            />
            <label className="label">
              <span className="label-text-alt opacity-60">
                Separate tags with commas; new tags are created automatically.
              </span>
            </label>
          </div>

          <div className="modal-action">
            <button
              type="button"
              className="btn"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!sentence.trim() || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  Creating...
                </>
              ) : (
                'Create'
              )}
            </button>
          </div>
        </form>
      </div>
      <div className="modal-backdrop" onClick={onClose}></div>
    </div>
  );
}
