/**
 * ContentModal - Generic modal component for content-area overlays
 *
 * This modal renders ONLY over the content area, leaving the navbar accessible.
 * Use this for all modals that should not block the entire screen.
 *
 * Key features:
 * - Absolute positioning (requires parent with `position: relative`)
 * - z-index 1000 (above Leaflet maps ~400-900, below navbar ~1100)
 * - Configurable backdrop and close behavior
 * - Max-height with overflow for long content
 */

import { useEffect } from 'react';

export interface ContentModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal should close (backdrop click, escape key) */
  onClose?: () => void;
  /** Modal content */
  children: React.ReactNode;
  /** Max width preset */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  /** Additional classes for the modal box */
  className?: string;
  /** Show semi-transparent backdrop (default: true) */
  showBackdrop?: boolean;
  /** Close modal when clicking backdrop (default: true) */
  closeOnBackdropClick?: boolean;
  /** Close modal on Escape key (default: true) */
  closeOnEscape?: boolean;
}

const maxWidthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  full: 'max-w-full mx-4',
};

export function ContentModal({
  isOpen,
  onClose,
  children,
  maxWidth = 'md',
  className = '',
  showBackdrop = true,
  closeOnBackdropClick = true,
  closeOnEscape = true,
}: ContentModalProps) {
  // Handle escape key
  useEffect(() => {
    if (!isOpen || !closeOnEscape || !onClose) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, closeOnEscape, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = () => {
    if (closeOnBackdropClick && onClose) {
      onClose();
    }
  };

  return (
    <div className="absolute inset-0 z-[1000] flex items-center justify-center overflow-hidden">
      {/* Backdrop - only covers content area */}
      {showBackdrop && (
        <div
          className="absolute inset-0 bg-black/50"
          onClick={handleBackdropClick}
          aria-hidden="true"
        />
      )}
      {/* Modal Box */}
      <div
        className={`
          relative z-10
          bg-base-100 rounded-box shadow-xl
          max-h-[calc(100%-2rem)] overflow-y-auto
          w-full
          ${maxWidthClasses[maxWidth]}
          ${className}
        `}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>
  );
}
