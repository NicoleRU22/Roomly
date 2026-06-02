import React, { useEffect, useState } from 'react';
import api from '../../../core/services/api';
import { useAuthStore } from '../../../features/auth/store/useAuthStore';
import { User, Key, Mail, Shield, Smartphone } from 'lucide-react';

export const Perfil: React.FC = () => {
  const { user, tenant } = useAuthStore();
  const [phone, setPhone] = useState('-');
  const [document, setDocument] = useState('-');
  const [loading, setLoading] = useState(true);

  // Estados para cambio de contraseña
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passLoading, setPassLoading] = useState(false);
  const [passSuccess, setPassSuccess] = useState<string | null>(null);
  const [passError, setPassError] = useState<string | null>(null);

  const fetchProfileInfo = async () => {
    setLoading(true);
    try {
      if (user?.role === 'INQUILINO') {
        const res = await api.get('/inquilinos/me');
        setPhone(res.data.phone || 'No registrado');
        setDocument(res.data.document || 'No registrado');
      } else {
        // Los datos del propietario son del tenant/admin
        setDocument('N/A (Propietario)');
        setPhone('No registrado');
      }
    } catch (err) {
      console.error('Error al cargar info de perfil:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileInfo();
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassSuccess(null);
    setPassError(null);

    if (newPassword.length < 6) {
      setPassError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPassError('Las contraseñas no coinciden.');
      return;
    }

    setPassLoading(true);
    try {
      if (user?.role === 'INQUILINO') {
        // Endpoint del inquilino
        await api.put('/inquilinos/change-password', { password: newPassword });
      } else {
        // En el caso del propietario, podemos usar un endpoint general o reutilizar el mismo.
        // Dado que en el back changeInquilinoPassword busca por el req.userId de la sesión sin importar el rol:
        // podemos llamarlo igual!
        await api.put('/inquilinos/change-password', { password: newPassword });
      }
      setPassSuccess('¡Contraseña actualizada con éxito!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error('Error actualizando contraseña:', err);
      setPassError(err.response?.data?.error || 'No se pudo actualizar la contraseña.');
    } finally {
      setPassLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh] text-slate-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mr-3" />
        Cargando perfil...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Subheader */}
      <div className="flex justify-between items-center mb-6">
        <p className="text-xs text-slate-500">Visualiza tu información personal y actualiza las credenciales de tu cuenta.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* COLUMNA 1: DATOS GENERALES */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6 md:col-span-1">
          <div className="text-center space-y-3">
            <div className="w-20 h-20 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mx-auto border border-purple-100 shadow-sm">
              <User className="w-10 h-10" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 leading-tight">{user?.firstName} {user?.lastName || ''}</h3>
              <span className="px-2.5 py-0.5 mt-1.5 inline-block bg-purple-50 text-purple-600 border border-purple-100 text-[9px] font-extrabold rounded-full uppercase tracking-wider">
                {user?.role === 'INQUILINO' ? 'Inquilino / Residente' : 'Administrador / Propietario'}
              </span>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-4 text-xs text-slate-600">
            <div className="flex items-center space-x-3">
              <Mail className="w-4 h-4 text-slate-400 shrink-0" />
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Correo Electrónico</p>
                <p className="font-semibold text-slate-800">{user?.email}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Shield className="w-4 h-4 text-slate-400 shrink-0" />
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Documento (DNI/CE)</p>
                <p className="font-semibold text-slate-800">{document}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Smartphone className="w-4 h-4 text-slate-400 shrink-0" />
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Teléfono de contacto</p>
                <p className="font-semibold text-slate-800">{phone}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <User className="w-4 h-4 text-slate-400 shrink-0" />
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Workspace / Empresa</p>
                <p className="font-bold text-purple-600">{tenant?.companyName} ({tenant?.slug})</p>
              </div>
            </div>
          </div>
        </div>

        {/* COLUMNA 2-3: CAMBIO DE CONTRASEÑA */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6 md:col-span-2">
          <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-100">
            <Key className="w-5 h-5 text-purple-600" />
            <h3 className="text-sm font-bold text-slate-900">Seguridad y Acceso</h3>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
            {passError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
                {passError}
              </div>
            )}
            {passSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-600">
                {passSuccess}
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nueva Contraseña</label>
              <input
                type="password"
                required
                placeholder="Mínimo 6 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-purple-650"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Confirmar Nueva Contraseña</label>
              <input
                type="password"
                required
                placeholder="Repite la contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-purple-650"
              />
            </div>

            <button
              type="submit"
              disabled={passLoading}
              className="py-2.5 px-6 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-purple-100 disabled:opacity-50"
            >
              {passLoading ? 'Actualizando...' : 'Actualizar Contraseña'}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};
