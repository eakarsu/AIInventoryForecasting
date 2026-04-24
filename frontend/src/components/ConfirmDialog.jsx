import { createContext, useContext, useState, useCallback } from 'react';
import DetailModal from './DetailModal';

const ConfirmContext = createContext(null);

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) throw new Error('useConfirm must be used within ConfirmProvider');
  return context;
}

export function ConfirmProvider({ children }) {
  const [state, setState] = useState({ isOpen: false, title: '', message: '', resolve: null });

  const confirm = useCallback((title, message) => {
    return new Promise((resolve) => {
      setState({ isOpen: true, title, message, resolve });
    });
  }, []);

  const handleClose = (result) => {
    state.resolve?.(result);
    setState({ isOpen: false, title: '', message: '', resolve: null });
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <DetailModal
        isOpen={state.isOpen}
        onClose={() => handleClose(false)}
        title={state.title}
        size="sm"
        actions={
          <>
            <button onClick={() => handleClose(false)} className="btn-secondary">
              Cancel
            </button>
            <button
              onClick={() => handleClose(true)}
              className="font-medium py-2 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors"
            >
              Confirm
            </button>
          </>
        }
      >
        <p className="text-gray-600">{state.message}</p>
      </DetailModal>
    </ConfirmContext.Provider>
  );
}
