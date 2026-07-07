import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../../core/services/api';

export const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError(null);

    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err: any) {
      console.error('Error solicitando restablecimiento:', err);
      setError(err.response?.data?.error || 'No pudimos procesar la solicitud. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="space-y-6 text-center">
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl">
          <p className="text-sm font-semibold text-slate-800">Revisa tu correo</p>
          <p className="text-xs text-slate-600 mt-2">
            Si <span className="font-semibold">{email}</span> está registrado, te enviamos un enlace
            para restablecer tu contraseña. El enlace expira en 1 hora.
          </p>
        </div>
        <div className="text-center text-xs text-slate-400 border-t border-slate-100 pt-4">
          <Link to="/login" className="text-purple-600 hover:text-purple-500 font-bold transition-colors">
            Volver a inicio de sesión
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-bold text-slate-900">¿Olvidaste tu contraseña?</h2>
        <p className="text-xs text-slate-500 mt-1.5">
          Escribe el correo con el que te registraste y te enviaremos un enlace para elegir una nueva.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Correo electrónico
          </label>
          <input
            type="email"
            placeholder="nicole@gmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-600 transition-colors"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 px-4 border border-transparent rounded-xl text-sm font-semibold text-white bg-slate-800 hover:bg-slate-700 active:bg-slate-900 transition-colors disabled:opacity-50"
        >
          {loading ? 'Enviando...' : 'Enviar enlace de restablecimiento'}
        </button>
      </form>

      <div className="text-center text-xs text-slate-400 border-t border-slate-100 pt-4">
        ¿La recordaste?{' '}
        <Link to="/login" className="text-purple-600 hover:text-purple-500 font-bold transition-colors">
          Inicia sesión aquí
        </Link>
      </div>
    </div>
  );
};
