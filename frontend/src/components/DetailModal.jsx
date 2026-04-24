import { useEffect } from 'react';

export default function DetailModal({
  isOpen,
  onClose,
  title,
  children,
  actions,
  size = 'md',
}) {
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div
          className={`relative inline-block w-full ${sizeClasses[size]} bg-white rounded-xl text-left overflow-hidden shadow-xl transform transition-all my-8`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-500 rounded-full hover:bg-gray-100"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">{children}</div>

          {/* Actions */}
          {actions && (
            <div className="flex justify-end space-x-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
              {actions}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Detail Row component for displaying key-value pairs
export function DetailRow({ label, value, className = '' }) {
  return (
    <div className={`py-3 sm:grid sm:grid-cols-3 sm:gap-4 ${className}`}>
      <dt className="text-sm font-medium text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{value || '-'}</dd>
    </div>
  );
}

// Detail Section component
export function DetailSection({ title, children }) {
  return (
    <div className="mb-6">
      {title && (
        <h4 className="text-sm font-medium text-gray-900 uppercase tracking-wider mb-3 pb-2 border-b">
          {title}
        </h4>
      )}
      <dl className="divide-y divide-gray-100">{children}</dl>
    </div>
  );
}

// Confirmation Modal
export function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', confirmStyle = 'danger' }) {
  const buttonStyles = {
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    primary: 'bg-primary-600 hover:bg-primary-700 text-white',
  };

  return (
    <DetailModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      actions={
        <>
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`font-medium py-2 px-4 rounded-lg transition-colors ${buttonStyles[confirmStyle]}`}
          >
            {confirmText}
          </button>
        </>
      }
    >
      <p className="text-gray-600">{message}</p>
    </DetailModal>
  );
}
