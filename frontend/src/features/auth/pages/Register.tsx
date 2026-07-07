import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import api from '../../../core/services/api';
import { useAuthStore } from '../store/useAuthStore';

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
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
      // Registrar Tenant y Propietario. La cuenta queda pendiente hasta confirmar el correo.
      await api.post(`/auth/register`, {
        firstName,
        lastName,
        email,
        password,
        companyName,
        slug
      });

      setRegisteredEmail(email);

    } catch (err: any) {
      console.error('Registration error:', err);
      setError(err.response?.data?.error || 'Error al registrar la cuenta. El slug o correo ya podrían estar en uso.');
    } finally {
      setLoading(false);
    }
  };

  // Registro con Google: como Google no provee empresa/slug, se exige llenarlos antes de continuar
  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) return;

    if (!companyName || !slug) {
      setError('Completa el nombre de la empresa y el slug del workspace antes de continuar con Google.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.post('/auth/google', {
        idToken: credentialResponse.credential,
        companyName,
        slug
      });

      const { token, user, tenant } = res.data;
      loginStore(token, user, tenant);
      navigate(`/${tenant.slug}/dashboard`);
    } catch (err: any) {
      console.error('Google registration error:', err);
      setError(err.response?.data?.error || 'Error al registrar la cuenta con Google.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!registeredEmail) return;
    setLoading(true);
    try {
      await api.post('/auth/resend-verification', { email: registeredEmail });
    } catch (err) {
      console.error('Error al reenviar verificación:', err);
    } finally {
      setLoading(false);
    }
  };

  // Pantalla de confirmación tras un registro clásico exitoso: la cuenta queda pendiente de verificar el correo
  if (registeredEmail) {
    return (
      <div className="space-y-6 text-center">
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl">
          <p className="text-sm font-semibold text-slate-800">¡Ya casi! Confirma tu correo</p>
          <p className="text-xs text-slate-600 mt-2">
            Enviamos un enlace de confirmación a <span className="font-semibold">{registeredEmail}</span>.
            Ábrelo para activar tu cuenta e iniciar sesión.
          </p>
        </div>
        <button
          type="button"
          onClick={handleResendVerification}
          disabled={loading}
          className="text-xs text-purple-600 hover:text-purple-500 font-bold transition-colors disabled:opacity-50"
        >
          {loading ? 'Enviando...' : '¿No te llegó? Reenviar correo'}
        </button>
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
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="******"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-600 pr-10"
              required
              minLength={6}
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

        {/* CONFIRMAR CONTRASEÑA */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Confirmar contraseña
          </label>
          <div className="relative">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="******"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-600 pr-10"
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors flex items-center justify-center"
            >
              {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
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

      {/* SEPARADOR Y REGISTRO CON GOOGLE */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-[11px] text-slate-400 uppercase tracking-wide">o</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>
        <p className="text-center text-[11px] text-slate-400">
          Completa "Nombre Empresa" y "Slug" arriba para registrarte con Google
        </p>
        <div className="flex justify-center">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => setError('No pudimos registrar la cuenta con Google.')}
            text="signup_with"
            shape="pill"
            width="320"
          />
        </div>
      </div>

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
