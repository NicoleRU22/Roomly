import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
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

  // Login directo
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(false);
    setLoading(true);
    setError(null);

    try {
      const res = await axios.post(`http://localhost:3001/api/auth/login`, {
        email,
        password
      });

      const { token, user, tenant } = res.data;
      
      // Guardar en store
      loginStore(token, user, tenant);

      // Redirigir al dashboard del tenant
      navigate(`/${tenant.slug}/dashboard`);
    } catch (err: any) {
      console.error('Error logging in:', err);
      setError(err.response?.data?.error || 'Credenciales inválidas o correo no registrado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
          {error}
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
          <input
            type="password"
            placeholder="*********"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-600 transition-colors"
            required
          />
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
