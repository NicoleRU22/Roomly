import React, { useEffect, useState } from 'react';
import api from '../../../core/services/api';
import { Building2, User, Percent, MessageCircle, Bell, Save } from 'lucide-react';
import { useAuthStore } from '../../auth/store/useAuthStore';

interface ConfiguracionData {
  companyName: string;
  landlordRuc: string;
  landlordAddress: string;
  lateFeePerDay: number;
  graceDays: number;
  contractExpirationWarningDays: number;
  defaultBillingDay: number | null;
  whatsappTemplate: string;
  notifyComprobantePendiente: boolean;
  notifyContratoFirmado: boolean;
  notifyTicketCreado: boolean;
  ownerFirstName: string;
  ownerLastName: string;
  ownerEmail: string;
}

type Tab = 'perfil' | 'cobros' | 'notificaciones';

const TABS: { id: Tab; label: string }[] = [
  { id: 'perfil', label: 'Perfil' },
  { id: 'cobros', label: 'Cobros' },
  { id: 'notificaciones', label: 'Notificaciones' }
];

export const Configuracion: React.FC = () => {
  const updateUser = useAuthStore((state) => state.updateUser);
  const [data, setData] = useState<ConfiguracionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('perfil');

  const fetchConfiguracion = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/configuracion');
      setData(res.data);
    } catch (err: any) {
      console.error('Error cargando configuración:', err);
      setError('No se pudo cargar la configuración del negocio.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfiguracion();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await api.put('/configuracion', data);
      setData(res.data);
      updateUser({ firstName: res.data.ownerFirstName, lastName: res.data.ownerLastName, email: res.data.ownerEmail });
      setSuccess('Configuración guardada con éxito.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'No se pudo guardar la configuración.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-[50vh] text-slate-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-650 mr-3" />
        Cargando configuración...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Configuración</h2>
        <p className="text-sm text-slate-500 font-medium">Define los datos, reglas de cobro y notificaciones de tu workspace.</p>
      </div>

      {/* TABS */}
      <div className="flex items-center gap-6 border-b border-slate-200">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`pb-3 text-sm font-bold transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'text-purple-600 border-purple-600'
                : 'text-slate-450 border-transparent hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-600">
          {success}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* TAB: PERFIL (datos del propietario + datos del negocio) */}
        {activeTab === 'perfil' && (
          <>
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-100">
                <User className="w-5 h-5 text-purple-600" />
                <h3 className="text-sm font-bold text-slate-900">Datos del propietario</h3>
              </div>
              <p className="text-[11px] text-slate-450">
                Los registraste al crear tu cuenta. Aquí puedes actualizarlos.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">Nombres</label>
                  <input
                    type="text"
                    value={data.ownerFirstName}
                    onChange={(e) => setData({ ...data, ownerFirstName: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-650"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">Apellidos</label>
                  <input
                    type="text"
                    value={data.ownerLastName}
                    onChange={(e) => setData({ ...data, ownerLastName: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-650"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Correo electrónico</label>
                <input
                  type="email"
                  value={data.ownerEmail}
                  onChange={(e) => setData({ ...data, ownerEmail: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-650"
                  required
                />
                <p className="text-[10px] text-slate-400 mt-1">Este es también tu usuario de acceso a la plataforma.</p>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-100">
                <Building2 className="w-5 h-5 text-purple-600" />
                <h3 className="text-sm font-bold text-slate-900">Datos del negocio</h3>
              </div>
              <p className="text-[11px] text-slate-450">
                Se usan como valores por defecto al generar nuevos contratos de arrendamiento.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">Razón social / Empresa</label>
                  <input
                    type="text"
                    value={data.companyName}
                    onChange={(e) => setData({ ...data, companyName: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-650"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">RUC</label>
                  <input
                    type="text"
                    maxLength={11}
                    value={data.landlordRuc}
                    onChange={(e) => setData({ ...data, landlordRuc: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                    placeholder="11 dígitos"
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-650 font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Dirección fiscal</label>
                <input
                  type="text"
                  value={data.landlordAddress}
                  onChange={(e) => setData({ ...data, landlordAddress: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-650"
                />
              </div>
            </div>
          </>
        )}

        {/* TAB: COBROS (reglas de mora/vencimiento + plantilla whatsapp) */}
        {activeTab === 'cobros' && (
          <>
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-100">
                <Percent className="w-5 h-5 text-purple-600" />
                <h3 className="text-sm font-bold text-slate-900">Reglas de cobro</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">Penalización por mora (S/. por día)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={data.lateFeePerDay}
                    onChange={(e) => setData({ ...data, lateFeePerDay: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-650 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">Días de gracia antes de aplicar mora</label>
                  <input
                    type="number"
                    min="0"
                    value={data.graceDays}
                    onChange={(e) => setData({ ...data, graceDays: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-650 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">Aviso de contrato por vencer (días antes)</label>
                  <input
                    type="number"
                    min="1"
                    value={data.contractExpirationWarningDays}
                    onChange={(e) => setData({ ...data, contractExpirationWarningDays: parseInt(e.target.value) || 1 })}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-650 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">Día de cobro por defecto</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    placeholder="ej. 5"
                    value={data.defaultBillingDay ?? ''}
                    onChange={(e) => setData({ ...data, defaultBillingDay: e.target.value ? parseInt(e.target.value) : null })}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-650 font-mono"
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-450">
                Día del mes (1-31) en que se generará automáticamente el cobro a todos tus inquilinos que no tengan un día de cobro propio configurado en su contrato. Si un contrato tiene su propio día de cobro, ese valor tiene prioridad.
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-100">
                <MessageCircle className="w-5 h-5 text-purple-600" />
                <h3 className="text-sm font-bold text-slate-900">Plantilla de recordatorio por WhatsApp</h3>
              </div>
              <p className="text-[11px] text-slate-450">
                Usa <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">{'{nombre}'}</code> para insertar el nombre del inquilino automáticamente.
              </p>
              <textarea
                rows={3}
                value={data.whatsappTemplate}
                onChange={(e) => setData({ ...data, whatsappTemplate: e.target.value })}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-650 resize-none"
              />
            </div>
          </>
        )}

        {/* TAB: NOTIFICACIONES */}
        {activeTab === 'notificaciones' && (
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-100">
              <Bell className="w-5 h-5 text-purple-600" />
              <h3 className="text-sm font-bold text-slate-900">Notificaciones al propietario</h3>
            </div>
            <div className="space-y-3">
              <label className="flex items-center justify-between text-xs font-semibold text-slate-700 cursor-pointer">
                <span>Comprobante de pago pendiente de validación</span>
                <input
                  type="checkbox"
                  checked={data.notifyComprobantePendiente}
                  onChange={(e) => setData({ ...data, notifyComprobantePendiente: e.target.checked })}
                  className="w-4 h-4 text-purple-600 border-slate-300 rounded focus:ring-purple-500"
                />
              </label>
              <label className="flex items-center justify-between text-xs font-semibold text-slate-700 cursor-pointer">
                <span>Contrato firmado por un inquilino</span>
                <input
                  type="checkbox"
                  checked={data.notifyContratoFirmado}
                  onChange={(e) => setData({ ...data, notifyContratoFirmado: e.target.checked })}
                  className="w-4 h-4 text-purple-600 border-slate-300 rounded focus:ring-purple-500"
                />
              </label>
              <label className="flex items-center justify-between text-xs font-semibold text-slate-700 cursor-pointer">
                <span>Nuevo ticket de mantenimiento reportado</span>
                <input
                  type="checkbox"
                  checked={data.notifyTicketCreado}
                  onChange={(e) => setData({ ...data, notifyTicketCreado: e.target.checked })}
                  className="w-4 h-4 text-purple-600 border-slate-300 rounded focus:ring-purple-500"
                />
              </label>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="flex items-center py-2.5 px-6 bg-[#A855F7] hover:bg-purple-600 text-white text-xs font-bold rounded-xl transition-all shadow-sm disabled:opacity-50"
        >
          <Save className="w-4 h-4 mr-1.5" />
          {saving ? 'Guardando...' : 'Guardar configuración'}
        </button>
      </form>
    </div>
  );
};
