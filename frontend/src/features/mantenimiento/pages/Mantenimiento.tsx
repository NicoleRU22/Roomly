import React, { useEffect, useState } from 'react';
import api from '../../../core/services/api';
import { useAuthStore } from '../../../features/auth/store/useAuthStore';
import { Plus, CheckCircle, AlertTriangle, Clock, Hammer, DollarSign, Image as ImageIcon } from 'lucide-react';

interface Ticket {
  id: number;
  inquilinoName: string;
  propertyName: string;
  roomNumber?: string;
  propertyId: number;
  roomId?: number;
  title: string;
  description: string;
  imageUrl?: string;
  priority: string;
  status: string;
  comments?: string;
  cost?: number;
  createdAt: string;
}

export const Mantenimiento: React.FC = () => {
  const { user } = useAuthStore();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Datos de inquilino para auto-llenar propiedades
  const [inquilinoInfo, setInquilinoInfo] = useState<any>(null);

  // Estados del modal de Inquilino
  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('MEDIA');
  const [selectedFileBase64, setSelectedFileBase64] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Estados del modal de Propietario (Gestión)
  const [showManageModal, setShowManageModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [statusUpdate, setStatusUpdate] = useState('PENDIENTE');
  const [priorityUpdate, setPriorityUpdate] = useState('MEDIA');
  const [commentsUpdate, setCommentsUpdate] = useState('');
  const [costUpdate, setCostUpdate] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchTickets = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/mantenimiento');
      setTickets(res.data);

      if (user?.role === 'INQUILINO') {
        const infoRes = await api.get('/inquilinos/me');
        setInquilinoInfo(infoRes.data);
      }
    } catch (err: any) {
      console.error('Error al cargar tickets:', err);
      setError('No se pudieron cargar las solicitudes de mantenimiento.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  // Leer foto y convertir a Base64
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedFileBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description || !inquilinoInfo?.propertyId) return;

    setSubmitting(true);
    try {
      await api.post('/mantenimiento', {
        title,
        description,
        priority,
        propertyId: inquilinoInfo.propertyId,
        roomId: inquilinoInfo.roomId,
        image: selectedFileBase64
      });
      setShowAddModal(false);
      setTitle('');
      setDescription('');
      setPriority('MEDIA');
      setSelectedFileBase64(null);
      fetchTickets();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al reportar el problema.');
    } finally {
      setSubmitting(false);
    }
  };

  const openManageModal = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setStatusUpdate(ticket.status);
    setPriorityUpdate(ticket.priority);
    setCommentsUpdate(ticket.comments || '');
    setCostUpdate(ticket.cost ? ticket.cost.toString() : '');
    setShowManageModal(true);
  };

  const handleUpdateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;

    setSaving(true);
    try {
      await api.put(`/mantenimiento/${selectedTicket.id}/status`, {
        status: statusUpdate,
        priority: priorityUpdate,
        comments: commentsUpdate,
        cost: costUpdate ? parseFloat(costUpdate) : null
      });
      setShowManageModal(false);
      fetchTickets();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al actualizar el ticket.');
    } finally {
      setSaving(false);
    }
  };

  const getPriorityBadgeClass = (p: string) => {
    switch (p) {
      case 'ALTA':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'MEDIA':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getStatusBadgeClass = (s: string) => {
    switch (s) {
      case 'RESUELTO':
        return 'bg-emerald-50 text-emerald-700 border-emerald-250';
      case 'EN_PROGRESO':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      default:
        return 'bg-amber-50 text-amber-700 border-amber-200';
    }
  };

  const getStatusIcon = (s: string) => {
    switch (s) {
      case 'RESUELTO':
        return <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />;
      case 'EN_PROGRESO':
        return <Clock className="w-4 h-4 text-indigo-650 shrink-0" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />;
    }
  };

  if (loading && tickets.length === 0) {
    return (
      <div className="flex items-center justify-center h-[50vh] text-slate-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mr-3" />
        Cargando incidencias y solicitudes...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Subheader */}
      <div className="flex justify-between items-center mb-6">
        <p className="text-xs text-slate-500">
          {user?.role === 'INQUILINO' 
            ? 'Reporta averías o problemas técnicos en tu habitación y sigue el estado de tu ticket.'
            : 'Supervisa, asigna prioridades y gestiona los costos de reparación para las solicitudes de los inquilinos.'}
        </p>

        {user?.role === 'INQUILINO' && (
          <button
            onClick={() => setShowAddModal(true)}
            disabled={!inquilinoInfo?.propertyId}
            className="flex items-center py-2.5 px-4 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-purple-100"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Reportar Avería
          </button>
        )}
      </div>

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
          {error}
        </div>
      )}

      {/* LISTADO DE TICKETS */}
      <div className="grid grid-cols-1 gap-6">
        {tickets.length === 0 ? (
          <div className="text-center py-12 bg-white border border-slate-200 rounded-3xl text-slate-400">
            No se han reportado solicitudes de mantenimiento en este espacio.
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-[#DFCEFC] text-[10px] font-bold text-slate-800 uppercase tracking-wider">
                    <th className="px-6 py-4">Asunto / Solicitud</th>
                    <th className="px-6 py-4">Ubicación</th>
                    {user?.role !== 'INQUILINO' && <th className="px-6 py-4">Inquilino</th>}
                    <th className="px-6 py-4">Prioridad</th>
                    <th className="px-6 py-4">Estado</th>
                    <th className="px-6 py-4">Seguimiento / Costos</th>
                    <th className="px-6 py-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {tickets.map((ticket) => (
                    <tr key={ticket.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-900">{ticket.title}</span>
                          {ticket.imageUrl && (
                            <a 
                              href={`${api.defaults.baseURL?.replace('/api', '')}${ticket.imageUrl}`} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="text-purple-600 hover:text-purple-700"
                              title="Ver foto adjunta"
                            >
                              <ImageIcon className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                        <p className="text-slate-500 max-w-sm line-clamp-2">{ticket.description}</p>
                        <p className="text-[10px] text-slate-450 font-mono mt-0.5">Reportado: {new Date(ticket.createdAt).toLocaleDateString()}</p>
                      </td>
                      <td className="px-6 py-4 text-slate-650 font-medium">
                        <span className="font-bold text-slate-800 block">{ticket.propertyName}</span>
                        {ticket.roomNumber ? `Habitación ${ticket.roomNumber}` : 'Propiedad completa'}
                      </td>
                      {user?.role !== 'INQUILINO' && (
                        <td className="px-6 py-4 font-semibold text-slate-700">{ticket.inquilinoName}</td>
                      )}
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-0.5 text-[9px] font-extrabold border rounded-full ${getPriorityBadgeClass(ticket.priority)}`}>
                          {ticket.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-1.5">
                          {getStatusIcon(ticket.status)}
                          <span className={`px-2 py-0.5 text-[9px] font-extrabold border rounded-full ${getStatusBadgeClass(ticket.status)}`}>
                            {ticket.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 space-y-1">
                        {ticket.comments ? (
                          <p className="text-slate-600 italic bg-slate-50 p-2 border border-slate-100 rounded-xl max-w-xs">
                            "{ticket.comments}"
                          </p>
                        ) : (
                          <span className="text-slate-400 italic">Sin comentarios de seguimiento.</span>
                        )}
                        {ticket.cost !== undefined && ticket.cost !== null && (
                          <p className="text-[10px] font-bold text-emerald-600 flex items-center">
                            <DollarSign className="w-3 h-3 mr-0.5" />
                            Costo Reparación: S/. {ticket.cost.toFixed(2)}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {user?.role !== 'INQUILINO' ? (
                          <button
                            onClick={() => openManageModal(ticket)}
                            className="inline-flex items-center px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold rounded-lg transition-all"
                          >
                            <Hammer className="w-3 h-3 mr-1" />
                            Gestionar
                          </button>
                        ) : (
                          <span className="text-slate-400 font-semibold text-[10px]">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: INQUILINO - AGREGAR TICKET */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl z-10 p-6 md:p-8 space-y-6 animate-modal-in">
            <div className="space-y-1">
              <h3 className="text-md font-extrabold text-slate-900 leading-tight">Reportar Avería</h3>
              <p className="text-xs text-slate-400">Describe el problema técnico para programar su reparación.</p>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Título / Breve Asunto</label>
                <input
                  type="text"
                  required
                  placeholder="ej: Tubo de agua roto en baño"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-purple-650"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Descripción Detallada</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Explica qué está fallando y dónde se encuentra..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-purple-650 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Prioridad</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-purple-650"
                  >
                    <option value="BAJA">Baja</option>
                    <option value="MEDIA">Media</option>
                    <option value="ALTA">Alta</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Foto de Avería (Opcional)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-[10px] file:font-bold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                  />
                </div>
              </div>

              {selectedFileBase64 && (
                <div className="border border-slate-100 p-2 rounded-xl text-center">
                  <span className="text-[10px] font-semibold text-slate-500 block">Vista previa de imagen cargada</span>
                  <img src={selectedFileBase64} alt="Preview" className="h-20 mx-auto object-contain mt-2.5 rounded-lg border" />
                </div>
              )}

              <div className="flex space-x-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
                >
                  {submitting ? 'Enviando...' : 'Reportar Avería'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-all"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PROPIETARIO - GESTIONAR TICKET */}
      {showManageModal && selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={() => setShowManageModal(false)} />
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl z-10 p-6 md:p-8 space-y-6 animate-modal-in">
            <div className="space-y-1">
              <h3 className="text-md font-extrabold text-slate-900 leading-tight">Gestionar Ticket de Reparación</h3>
              <p className="text-xs text-slate-400">Asigna estado, prioridad, costos y deja comentarios de seguimiento.</p>
            </div>

            <form onSubmit={handleUpdateTicket} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Estado</label>
                  <select
                    value={statusUpdate}
                    onChange={(e) => setStatusUpdate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-purple-650"
                  >
                    <option value="PENDIENTE">Pendiente</option>
                    <option value="EN_PROGRESO">En Progreso</option>
                    <option value="RESUELTO">Resuelto</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Prioridad</label>
                  <select
                    value={priorityUpdate}
                    onChange={(e) => setPriorityUpdate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-purple-650"
                  >
                    <option value="BAJA">Baja</option>
                    <option value="MEDIA">Media</option>
                    <option value="ALTA">Alta</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Costo de Reparación (S/.)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="ej: 120.00"
                  value={costUpdate}
                  onChange={(e) => setCostUpdate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-purple-650"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Mensaje de Seguimiento (Se muestra al Inquilino)</label>
                <textarea
                  rows={2}
                  placeholder="ej: El plomero irá mañana entre las 9am y 12pm..."
                  value={commentsUpdate}
                  onChange={(e) => setCommentsUpdate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-purple-650 resize-none"
                />
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
                >
                  {saving ? 'Guardando...' : 'Actualizar Ticket'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowManageModal(false)}
                  className="flex-1 py-2.5 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-all"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
