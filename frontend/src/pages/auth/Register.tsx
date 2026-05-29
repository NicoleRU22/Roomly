import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const loginStore = useAuthStore(state => state.login);

  // Estados del Formulario
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [slug, setSlug] = useState('');

  // Estados de carga y error
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-sugerir slug al escribir el nombre de la compañía
  const handleCompanyNameChange = (val: string) => {
    setCompanyName(val);
    const suggested = val
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
      .replace(/[^a-z0-9]/g, ''); // Mantener solo letras y números
    setSlug(suggested);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !firstName || !companyName || !slug) {
      setError('Por favor, rellena todos los campos obligatorios.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Registrar Tenant y Propietario
      await axios.post(`http://localhost:3001/api/auth/register`, {
        firstName,
        lastName,
        email,
        password,
        companyName,
        slug
      });

      // 2. Hacer login automático inmediatamente tras registrar
      const loginRes = await axios.post(`http://localhost:3001/api/auth/login`, {
        email,
        password
      });

      const { token, user, tenant } = loginRes.data;
      loginStore(token, user, tenant);

      // Redirigir al dashboard del nuevo tenant
      navigate(`/${tenant.slug}/dashboard`);

    } catch (err: any) {
      console.error('Registration error:', err);
      setError(err.response?.data?.error || 'Error al registrar la cuenta. El slug o correo ya podrían estar en uso.');
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

      <form onSubmit={handleRegister} className="space-y-4">
        
        {/* NOMBRES Y APELLIDOS */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Nombres
            </label>
            <input
              type="text"
              placeholder="Nicole"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-600"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Apellidos
            </label>
            <input
              type="text"
              placeholder="García"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-600"
            />
          </div>
        </div>

        {/* CORREO ELECTRÓNICO */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Correo electrónico
          </label>
          <input
            type="email"
            placeholder="nicole@gmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-600"
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
            placeholder="******"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-600"
            required
            minLength={6}
          />
        </div>

        {/* CONFIRMAR CONTRASEÑA */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Confirmar contraseña
          </label>
          <input
            type="password"
            placeholder="******"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-600"
            required
          />
        </div>

        {/* DATOS DE LA EMPRESA (Requeridos para el SaaS de Roomly) */}
        <div className="border-t border-slate-100 pt-4 mt-2 space-y-4">
          <p className="text-[10px] font-bold text-purple-600 uppercase tracking-widest">Configura tu espacio SaaS</p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Nombre Empresa / Edificio
              </label>
              <input
                type="text"
                placeholder="ej: Edificio Central"
                value={companyName}
                onChange={(e) => handleCompanyNameChange(e.target.value)}
                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-600"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Slug (Workspace)
              </label>
              <input
                type="text"
                placeholder="ej: edificiocentral"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-600"
                required
              />
            </div>
          </div>
        </div>

        {/* BOTÓN REGISTRARSE */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 px-4 border border-transparent rounded-xl text-sm font-semibold text-white bg-slate-800 hover:bg-slate-700 active:bg-slate-900 transition-colors disabled:opacity-50 mt-2"
        >
          {loading ? 'Creando cuenta...' : 'Registrarse'}
        </button>
      </form>

      {/* Enlace de Regreso */}
      <div className="text-center text-xs text-slate-400 border-t border-slate-100 pt-4">
        ¿Ya tienes un espacio creado?{' '}
        <Link to="/login" className="text-purple-600 hover:text-purple-500 font-bold transition-colors">
          Inicia sesión aquí
        </Link>
      </div>
    </div>
  );
};
