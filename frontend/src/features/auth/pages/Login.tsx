import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import api from '../../../core/services/api';
import { useAuthStore } from '../store/useAuthStore';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const loginStore = useAuthStore(state => state.login);

  // Estados del formulario
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  // Estados de carga y error
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResend, setShowResend] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  const [showPassword, setShowPassword] = useState(false);

  // Login directo
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError(null);
    setShowResend(false);
    setResendSent(false);

    try {
      const res = await api.post(`/auth/login`, {
        email,
        password
      });

      const { token, user, tenant } = res.data;

      // Guardar en store
      loginStore(token, user, tenant);

      // El ADMIN de plataforma no pertenece a ningún tenant: va a su propio panel.
      if (!tenant) {
        navigate('/admin/dashboard');
        return;
      }

      // Redirigir al dashboard del tenant
      navigate(`/${tenant.slug}/dashboard`);
    } catch (err: any) {
      console.error('Error logging in:', err);
      setError(err.response?.data?.error || 'Credenciales inválidas o correo no registrado.');
      if (err.response?.data?.code === 'EMAIL_NOT_VERIFIED') {
        setShowResend(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setLoading(true);
    try {
      await api.post('/auth/resend-verification', { email });
      setResendSent(true);
    } catch (err) {
      console.error('Error al reenviar verificación:', err);
    } finally {
      setLoading(false);
    }
  };

  // Login con Google: se envía el idToken al backend, que busca la cuenta existente
  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) return;
    setLoading(true);
    setError(null);

    try {
      const res = await api.post('/auth/google', {
        idToken: credentialResponse.credential
      });

      const { token, user, tenant } = res.data;
      loginStore(token, user, tenant);
      navigate(`/${tenant.slug}/dashboard`);
    } catch (err: any) {
      console.error('Error logging in with Google:', err);
      setError(err.response?.data?.error || 'No pudimos iniciar sesión con Google. ¿Ya tienes una cuenta creada?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 space-y-2">
          <p>{error}</p>
          {showResend && (
            resendSent ? (
              <p className="text-slate-500">Te enviamos un nuevo enlace de confirmación.</p>
            ) : (
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={loading}
                className="font-bold text-red-700 hover:text-red-800 transition-colors disabled:opacity-50"
              >
                Reenviar correo de confirmación
              </button>
            )
          )}
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        {/* CORREO ELECTRONICO */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Correo electronico
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

        {/* CONTRASEÑA */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Contraseña
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="*********"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-600 transition-colors pr-10"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors flex items-center justify-center"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* CHECKBOX RECORDAR CONTRASEÑA */}
        <div className="flex items-center">
          <input
            id="remember-me"
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="w-4 h-4 text-purple-600 border-slate-300 rounded focus:ring-purple-500"
          />
          <label htmlFor="remember-me" className="ml-2 block text-xs font-medium text-slate-700 select-none">
            Recordar contraseña
          </label>
        </div>

        {/* BOTÓN INICIAR SESIÓN */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 px-4 border border-transparent rounded-xl text-sm font-semibold text-white bg-slate-800 hover:bg-slate-700 active:bg-slate-900 transition-colors disabled:opacity-50 mt-2"
        >
          {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
        </button>
      </form>

      {/* SEPARADOR Y LOGIN CON GOOGLE */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-[11px] text-slate-400 uppercase tracking-wide">o</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>
        <div className="flex justify-center">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => setError('No pudimos iniciar sesión con Google.')}
            text="signin_with"
            shape="pill"
            width="320"
          />
        </div>
      </div>

      {/* Enlace de Registro */}
      <div className="text-center text-xs text-slate-400 border-t border-slate-100 pt-4">
        ¿Aún no tienes un espacio para tu empresa?{' '}
        <Link to="/register" className="text-purple-600 hover:text-purple-500 font-bold transition-colors">
          Crea tu cuenta aquí
        </Link>
      </div>
    </div>
  );
};
