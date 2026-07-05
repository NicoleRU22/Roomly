import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ArrowRight, ArrowLeft, X, Sparkles } from 'lucide-react';

export interface OnboardingStep {
  label: string;
  description: string;
  done: boolean;
  path: string;
}

interface OnboardingGuideProps {
  steps: OnboardingStep[];
  storageKey: string; // clave localStorage para recordar si el usuario ya cerró la guía
}

export const OnboardingGuide: React.FC<OnboardingGuideProps> = ({ steps, storageKey }) => {
  const navigate = useNavigate();
  const allDone = steps.every(s => s.done);
  const firstPendingIndex = steps.findIndex(s => !s.done);
  const completedCount = steps.filter(s => s.done).length;

  const [modalOpen, setModalOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(Math.max(0, firstPendingIndex));
  const [dismissedForever, setDismissedForever] = useState(() => localStorage.getItem(storageKey) === 'dismissed');

  // Auto-abrir la guía la primera vez que el propietario entra con pasos pendientes
  useEffect(() => {
    if (!allDone && !dismissedForever && localStorage.getItem(`${storageKey}_seen`) !== 'true') {
      setStepIndex(Math.max(0, firstPendingIndex));
      setModalOpen(true);
      localStorage.setItem(`${storageKey}_seen`, 'true');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDone]);

  if (allDone || dismissedForever) return null;

  const current = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;
  const isFirst = stepIndex === 0;

  const handleOpen = () => {
    setStepIndex(Math.max(0, firstPendingIndex));
    setModalOpen(true);
  };

  const handleDismissForever = () => {
    localStorage.setItem(storageKey, 'dismissed');
    setDismissedForever(true);
    setModalOpen(false);
  };

  const handleGoToStep = () => {
    setModalOpen(false);
    navigate(current.path);
  };

  return (
    <>
      {/* Pastilla flotante para reabrir la guía */}
      <button
        onClick={handleOpen}
        className="w-full flex items-center justify-between gap-3 bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-2xl px-5 py-3 shadow-md hover:shadow-lg transition-shadow"
      >
        <span className="flex items-center gap-2 text-xs font-bold">
          <Sparkles className="w-4 h-4" />
          Configuración inicial: {completedCount}/{steps.length} pasos completados
        </span>
        <span className="text-xs font-bold underline">Continuar guía →</span>
      </button>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setModalOpen(false)} />

          <div className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl z-10 overflow-hidden">
            {/* Barra de progreso */}
            <div className="flex">
              {steps.map((s, idx) => (
                <div
                  key={s.label}
                  className={`h-1.5 flex-1 ${idx <= (s.done ? idx : stepIndex) && (s.done || idx <= stepIndex) ? 'bg-purple-600' : 'bg-slate-150'} ${idx > 0 ? 'ml-0.5' : ''}`}
                />
              ))}
            </div>

            <div className="p-7 space-y-5">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-bold text-purple-650 uppercase tracking-wider">
                    Paso {stepIndex + 1} de {steps.length}
                  </span>
                  <h3 className="text-lg font-black text-slate-900 mt-1">{current.label}</h3>
                </div>
                <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-sm text-slate-500 leading-relaxed">{current.description}</p>

              {current.done ? (
                <div className="flex items-center gap-2 text-emerald-650 bg-emerald-50 border border-emerald-150 rounded-xl px-4 py-3 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  ¡Ya completaste este paso!
                </div>
              ) : (
                <button
                  onClick={handleGoToStep}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-purple-650 hover:bg-purple-700 text-white text-sm font-bold rounded-xl shadow-sm transition-colors"
                >
                  Ir a hacerlo ahora
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <button
                  onClick={() => setStepIndex(i => Math.max(0, i - 1))}
                  disabled={isFirst}
                  className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Anterior
                </button>

                <button onClick={handleDismissForever} className="text-[11px] text-slate-400 hover:underline">
                  No volver a mostrar
                </button>

                <button
                  onClick={() => setStepIndex(i => Math.min(steps.length - 1, i + 1))}
                  disabled={isLast}
                  className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Siguiente
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
