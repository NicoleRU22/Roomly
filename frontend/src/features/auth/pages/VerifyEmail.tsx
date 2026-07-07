import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import api from '../../../core/services/api';
import { useAuthStore } from '../store/useAuthStore';

export const VerifyEmail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const loginStore = useAuthStore(state => state.login);

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setStatus('error');
      setError('Enlace de verificación inválido.');
      return;
    }

    const verify = async () => {
      try {
        const res = await api.get('/auth/verify-email', { params: { token } });
        const { token: jwtToken, user, tenant } = res.data;

        loginStore(jwtToken, user, tenant);
        setStatus('success');

        setTimeout(() => navigate(`/${tenant.slug}/dashboard`), 1500);
      } catch (err: any) {
        console.error('Error verificando correo:', err);
        setStatus('error');
        setError(err.response?.data?.error || 'No pudimos verificar tu correo.');
      }
    };

    verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6 text-center">
      {status === 'loading' && (
        <p className="text-sm text-slate-600">Verificando tu correo...</p>
      )}

      {status === 'success' && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
          <p className="text-sm font-semibold text-slate-800">¡Correo confirmado!</p>
          <p className="text-xs text-slate-600 mt-2">Redirigiéndote a tu panel...</p>
        </div>
      )}

      {status === 'error' && (
        <div className="space-y-4">
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-sm font-semibold text-slate-800">No pudimos verificar tu correo</p>
            <p className="text-xs text-red-600 mt-2">{error}</p>
          </div>
          <Link to="/login" className="text-xs text-purple-600 hover:text-purple-500 font-bold transition-colors">
            Volver a inicio de sesión
          </Link>
        </div>
      )}
    </div>
  );
};
