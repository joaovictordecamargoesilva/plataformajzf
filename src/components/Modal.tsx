import React, { ReactNode } from 'react';
import Icon from './Icon';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  size?: 'md' | 'lg' | 'xl';
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children, size = 'md' }) => {
  if (!isOpen) return null;

  const sizeClasses: Record<string, string> = {
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-lg shadow-xl w-full ${sizeClasses[size]} transform transition-all relative`}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 z-10 p-2 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Fechar modal"
        >
          <Icon path="M6 18L18 6M6 6l12 12" className="w-6 h-6" />
        </button>
        <div className="max-h-[85vh] overflow-y-auto p-8">
            {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;