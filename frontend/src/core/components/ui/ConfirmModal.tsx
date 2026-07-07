import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  isDestructive = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm transition-opacity duration-200" 
        onClick={onCancel}
      />
      
      {/* Modal Card */}
      <div className="bg-white border border-slate-200 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl z-10 p-6 md:p-8 space-y-6 animate-modal-in">
        <div className="flex items-start space-x-4">
          {isDestructive && (
            <div className="w-10 h-10 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
            </div>
          )}
          <div className="space-y-1.5 flex-1">
            <h3 className="text-lg font-bold text-slate-900 leading-tight">{title}</h3>
            <p className="text-sm text-slate-500 leading-relaxed whitespace-pre-line">{message}</p>
          </div>
        </div>
        
        <div className="flex space-x-3 pt-2">
          {/* Swapped order of action buttons per premium guidelines: Confirmation first, cancel second */}
          <button
            onClick={onConfirm}
            className={`flex-1 py-2.5 px-4 text-white text-sm font-bold rounded-xl transition-all duration-150 active:scale-[0.97] shadow-sm ${
              isDestructive 
                ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-100' 
                : 'bg-purple-650 hover:bg-purple-750 shadow-purple-100'
            }`}
          >
            {confirmText}
          </button>
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-bold rounded-xl transition-colors active:scale-[0.97] duration-150 text-center"
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
};
