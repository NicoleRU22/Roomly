import React, { useEffect, useState } from 'react';
import api from '../../../core/services/api';
import { useAuthStore } from '../../../features/auth/store/useAuthStore';
import { Plus, CheckCircle, AlertTriangle, Clock, Hammer, DollarSign, Image as ImageIcon, Phone, UserCog } from 'lucide-react';
import { Pagination } from '../../../core/components/ui/Pagination';

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
  proveedorId?: number;
  proveedorName?: string;
  proveedorSpecialty?: string;
  proveedorPhone?: string;
  dueDate?: string;
  isOverdue?: boolean;
  createdAt: string;
}

interface Proveedor {
  id: number;
  name: string;
  specialty: string;
  phone: string;
}

const PAGE_SIZE = 8;
const MAX_IMAGE_SIZE_BYTES = 6 * 1024 * 1024;

const getRequestErrorMessage = (err: any, fallback: string) => {
  if (err?.response?.data?.error) return err.response.data.error;
  if (typeof err?.response?.data === 'string') return err.response.data;
  if (err?.response?.status === 413) return 'La imagen adjunta es demasiado grande. Sube una foto menor a 6 MB.';
  if (err?.code === 'ERR_NETWORK') return 'No se pudo conectar con la API. Revisa que el backend este activo y que VITE_API_URL/CORS_ORIGIN apunten al dominio correcto.';
  return fallback;
};

export const Mantenimiento: React.FC = () => {
  const { user } = useAuthStore();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);

  // Datos de inquilino para auto-llenar propiedades
  const [inquilinoInfo, setInquilinoInfo] = useState<any>(null);

  // Estados del modal de Inquilino
  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('MEDIA');
  const [selectedFileBase64, setSelectedFileBase64] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Estados del modal de Propietario (Gestión)
  const [showManageModal, setShowManageModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [statusUpdate, setStatusUpdate] = useState('PENDIENTE');
  const [priorityUpdate, setPriorityUpdate] = useState('MEDIA');
  const [commentsUpdate, setCommentsUpdate] = useState('');
  const [costUpdate, setCostUpdate] = useState('');
  const [proveedorIdUpdate, setProveedorIdUpdate] = useState('');
  const [saving, setSaving] = useState(false);

  // Proveedores (directorio de plomeros, electricistas, etc.)
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [showNewProveedorForm, setShowNewProveedorForm] = useState(false);
  const [newProveedorName, setNewProveedorName] = useState('');
  const [newProveedorSpecialty, setNewProveedorSpecialty] = useState('');
  const [newProveedorPhone, setNewProveedorPhone] = useState('');
  const [savingProveedor, setSavingProveedor] = useState(false);

  const fetchProveedores = async () => {
    try {
      const res = await api.get('/proveedores');
      setProveedores(res.data);
    } catch (err) {
      console.error('Error al cargar proveedores:', err);
    }
  };

  const fetchTickets = async (page: number = currentPage) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/mantenimiento', { params: { page, limit: PAGE_SIZE } });
      setTickets(res.data.data);
      setTotal(res.data.total);

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
    fetchTickets(currentPage);
    if (user?.role !== 'INQUILINO') {
      fetchProveedores();
    }
  }, [currentPage]);

  // Si se resuelve/elimina el último ticket de una página, retrocede a la anterior
  useEffect(() => {
    if (!loading && tickets.length === 0 && currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  }, [loading, tickets.length, currentPage]);

  // Leer foto y convertir a Base64
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFormError(null);

    if (!file) {
      setSelectedFileBase64(null);
      return;
    }

    if (!file.type.startsWith('image/')) {
      setSelectedFileBase64(null);
      e.target.value = '';
      setFormError('Selecciona un archivo de imagen valido.');
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setSelectedFileBase64(null);
      e.target.value = '';
      setFormError('La imagen es demasiado grande. Sube una foto menor a 6 MB.');
      return;
    }

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
    setFormError(null);
    setSuccessMessage(null);

    if (!title.trim() || !description.trim()) {
      setFormError('Completa el titulo y la descripcion del problema.');
      return;
    }

    if (!inquilinoInfo?.propertyId) {
      setFormError('No se encontro una propiedad asociada a tu usuario inquilino.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/mantenimiento', {
        title: title.trim(),
        description: description.trim(),
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
      setSuccessMessage('Reporte enviado correctamente.');
      await fetchTickets();
    } catch (err: any) {
      const message = getRequestErrorMessage(err, 'Error al reportar el problema.');
      setFormError(message);
      alert(message);
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
    setProveedorIdUpdate(ticket.proveedorId ? ticket.proveedorId.toString() : '');
    setShowNewProveedorForm(false);
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
        cost: costUpdate ? parseFloat(costUpdate) : null,
        proveedorId: proveedorIdUpdate || null
      });
      setShowManageModal(false);
      fetchTickets();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al actualizar el ticket.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateProveedor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProveedorName.trim() || !newProveedorSpecialty.trim() || !newProveedorPhone.trim()) {
      alert('Completa nombre, especialidad y teléfono del proveedor.');
      return;
    }
    setSavingProveedor(true);
    try {
      const res = await api.post('/proveedores', {
        name: newProveedorName.trim(),
        specialty: newProveedorSpecialty.trim(),
        phone: newProveedorPhone.trim()
      });
      setProveedores((prev) => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
      setProveedorIdUpdate(res.data.id.toString());
      setNewProveedorName('');
      setNewProveedorSpecialty('');
      setNewProveedorPhone('');
      setShowNewProveedorForm(false);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al registrar el proveedor.');
    } finally {
      setSavingProveedor(false);
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
            onClick={() => {
              setFormError(null);
              setSuccessMessage(null);
              setShowAddModal(true);
            }}
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

      {successMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700">
          {successMessage}
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
                  <tr className="border-b border-slate-200 bg-purple-600 text-[10px] font-bold text-white uppercase tracking-wider">
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
                        {ticket.dueDate && (
                          <p className={`text-[10px] font-mono font-bold ${ticket.isOverdue ? 'text-red-600' : 'text-slate-450'}`}>
                            {ticket.isOverdue ? 'SLA vencido: ' : 'SLA vence: '}
                            {new Date(ticket.dueDate).toLocaleDateString()}
                          </p>
                        )}
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
                        {ticket.proveedorName ? (
                          <p className="text-[10px] font-bold text-purple-700 flex items-center flex-wrap gap-x-1">
                            <UserCog className="w-3 h-3 shrink-0" />
                            {ticket.proveedorName} ({ticket.proveedorSpecialty})
                            {ticket.proveedorPhone && (
                              <a href={`tel:${ticket.proveedorPhone}`} className="text-emerald-600 hover:underline inline-flex items-center ml-1">
                                <Phone className="w-2.5 h-2.5 mr-0.5" />{ticket.proveedorPhone}
                              </a>
                            )}
                          </p>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Sin proveedor asignado.</span>
                        )}
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
            <Pagination
              currentPage={currentPage}
              totalItems={total}
              pageSize={PAGE_SIZE}
              onPageChange={setCurrentPage}
              itemLabel="tickets"
            />
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

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
                {formError}
              </div>
            )}

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
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Proveedor Asignado</label>
                  <button
                    type="button"
                    onClick={() => setShowNewProveedorForm((v) => !v)}
                    className="text-[10px] font-bold text-purple-600 hover:underline"
                  >
                    {showNewProveedorForm ? 'Cancelar' : '+ Nuevo proveedor'}
                  </button>
                </div>

                {showNewProveedorForm ? (
                  <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <input
                      type="text"
                      placeholder="Nombre (ej: Juan Pérez)"
                      value={newProveedorName}
                      onChange={(e) => setNewProveedorName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-purple-650"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Especialidad (ej: Plomería)"
                        value={newProveedorSpecialty}
                        onChange={(e) => setNewProveedorSpecialty(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-purple-650"
                      />
                      <input
                        type="text"
                        placeholder="Teléfono"
                        value={newProveedorPhone}
                        onChange={(e) => setNewProveedorPhone(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-purple-650"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleCreateProveedor}
                      disabled={savingProveedor}
                      className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold rounded-lg transition-all"
                    >
                      {savingProveedor ? 'Guardando...' : 'Guardar Proveedor'}
                    </button>
                  </div>
                ) : (
                  <select
                    value={proveedorIdUpdate}
                    onChange={(e) => setProveedorIdUpdate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-purple-650"
                  >
                    <option value="">Sin asignar</option>
                    {proveedores.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} — {p.specialty} ({p.phone})</option>
                    ))}
                  </select>
                )}
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
