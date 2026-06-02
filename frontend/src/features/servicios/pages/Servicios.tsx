import React, { useEffect, useState } from 'react';
import api from '../../../core/services/api';
import { Plus, Edit2, Trash2, Layers, Home } from 'lucide-react';
import { ConfirmModal } from '../../../core/components/ui/ConfirmModal';

interface Servicio {
  id: number;
  name: string;
  description?: string;
  cost: number;
  tipo: string; // INCLUIDO, ADICIONAL
  propertyId?: number;
  propertyName?: string;
  roomId?: number;
  roomNumber?: string;
}

interface Property {
  id: number;
  name: string;
}

interface Room {
  id: number;
  roomNumber: string;
  status: string;
}

export const Servicios: React.FC = () => {
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados Modal
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  // Campos Formulario
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState('');
  const [tipo, setTipo] = useState('ADICIONAL');
  const [targetType, setTargetType] = useState<'propiedad' | 'cuarto'>('propiedad');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [deleteServiceId, setDeleteServiceId] = useState<number | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [serRes, propRes] = await Promise.all([
        api.get('/servicios'),
        api.get('/properties')
      ]);
      setServicios(serRes.data);
      setProperties(propRes.data);
    } catch (err: any) {
      console.error('Error fetching services:', err);
      setError('No se pudieron cargar los servicios.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Cargar cuartos correspondientes cuando cambia la propiedad seleccionada
  useEffect(() => {
    if (selectedPropertyId && targetType === 'cuarto') {
      const fetchRooms = async () => {
        setLoadingRooms(true);
        try {
          const res = await api.get(`/properties/${selectedPropertyId}/rooms`);
          setRooms(res.data);
        } catch (err) {
          console.error('Error loading rooms:', err);
        } finally {
          setLoadingRooms(false);
        }
      };
      fetchRooms();
    } else {
      setRooms([]);
      setSelectedRoomId('');
    }
  }, [selectedPropertyId, targetType]);

  const openCreateModal = () => {
    setEditingId(null);
    setName('');
    setDescription('');
    setCost('');
    setTipo('ADICIONAL');
    setTargetType('propiedad');
    setSelectedPropertyId('');
    setSelectedRoomId('');
    setShowModal(true);
  };

  const openEditModal = (s: Servicio) => {
    setEditingId(s.id);
    setName(s.name);
    setDescription(s.description || '');
    setCost(String(s.cost));
    setTipo(s.tipo);
    setTargetType(s.roomId ? 'cuarto' : 'propiedad');
    setSelectedPropertyId(s.propertyId ? String(s.propertyId) : '');
    setSelectedRoomId(s.roomId ? String(s.roomId) : '');
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !cost || !tipo) return;
    setSubmitting(true);
    setError(null);

    const payload = {
      name,
      description,
      cost: parseFloat(cost),
      tipo,
      propertyId: selectedPropertyId ? parseInt(selectedPropertyId) : null,
      roomId: targetType === 'cuarto' && selectedRoomId ? parseInt(selectedRoomId) : null
    };

    try {
      if (editingId) {
        await api.put(`/servicios/${editingId}`, payload);
      } else {
        await api.post('/servicios', payload);
      }
      setShowModal(false);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al guardar el servicio.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    setDeleteServiceId(id);
  };

  const confirmDeleteService = async () => {
    if (deleteServiceId === null) return;
    try {
      await api.delete(`/servicios/${deleteServiceId}`);
      setDeleteServiceId(null);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al eliminar el servicio.');
    }
  };

  if (loading && servicios.length === 0) {
    return (
      <div className="flex items-center justify-center h-[50vh] text-slate-505">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-650 mr-3" />
        Cargando catálogo...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Subheader */}
      <div className="flex justify-between items-center mb-6">
        <p className="text-sm text-slate-500 font-medium">Configura cobros de luz, agua, internet o mantenimientos recurrentes.</p>
        <button
          onClick={openCreateModal}
          className="flex items-center py-2.5 px-4 bg-[#9333ea] hover:bg-purple-700 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-purple-200"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Registrar Servicio
        </button>
      </div>

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-650">
          {error}
        </div>
      )}

      {/* TABLA DE SERVICIOS */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse border border-slate-200">
            <thead>
              <tr className="bg-[#DFCEFC] text-sm text-slate-909 font-bold border-b border-slate-200">
                <th className="px-6 py-4 font-bold border-r border-slate-200">Servicio</th>
                <th className="px-6 py-4 font-bold border-r border-slate-200">Descripción</th>
                <th className="px-6 py-4 font-bold border-r border-slate-200">Costo ($)</th>
                <th className="px-6 py-4 font-bold border-r border-slate-200">Tipo</th>
                <th className="px-6 py-4 font-bold border-r border-slate-200">Alcance / Locación</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm text-slate-707">
              {servicios.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    No tienes servicios configurados.
                  </td>
                </tr>
              ) : (
                servicios.map((ser) => {
                  let badgeColor = 'bg-slate-50 text-slate-600 border-slate-200';
                  if (ser.tipo === 'ADICIONAL') badgeColor = 'bg-purple-50 text-purple-600 border-purple-100';
                  if (ser.tipo === 'INCLUIDO') badgeColor = 'bg-emerald-50 text-emerald-600 border-emerald-100';

                  return (
                    <tr key={ser.id} className="hover:bg-slate-50/30 transition-colors border-b border-slate-200 last:border-0">
                      {/* Servicio */}
                      <td className="px-6 py-4 border-r border-slate-200">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                            <Layers className="w-3.5 h-3.5" />
                          </div>
                          <span className="font-semibold text-slate-800">{ser.name}</span>
                        </div>
                      </td>

                      {/* Descripción */}
                      <td className="px-6 py-4 text-xs text-slate-500 max-w-[200px] truncate border-r border-slate-200" title={ser.description}>
                        {ser.description || <span className="italic text-slate-400">Sin descripción</span>}
                      </td>

                      {/* Costo */}
                      <td className="px-6 py-4 font-semibold text-slate-800 border-r border-slate-200">
                        ${ser.cost.toFixed(2)}
                      </td>

                      {/* Tipo */}
                      <td className="px-6 py-4 border-r border-slate-200">
                        <span className={`inline-block text-[10px] font-bold border px-2 py-0.5 rounded-lg ${badgeColor}`}>
                          {ser.tipo}
                        </span>
                      </td>

                      {/* Alcance */}
                      <td className="px-6 py-4 text-xs border-r border-slate-200">
                        {ser.propertyName ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center text-purple-600 font-semibold">
                              <Home className="w-3 h-3 mr-1 shrink-0" />
                              {ser.propertyName}
                            </span>
                            {ser.roomNumber && (
                              <p className="text-[10px] text-slate-400 pl-4 font-mono">
                                Cuarto {ser.roomNumber}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Global</span>
                        )}
                      </td>

                      {/* Acciones */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end space-x-1.5">
                          <button
                            onClick={() => openEditModal(ser)}
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(ser.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-650 transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL CREACIÓN / EDICIÓN */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl z-10 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-md font-bold text-slate-905">
                {editingId ? 'Editar Servicio' : 'Registrar Servicio'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-900">✕</button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-505 mb-1.5">Nombre del Servicio</label>
                <input
                  type="text"
                  placeholder="ej: Internet Fibra, Consumo Luz Eléctrica"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-909 focus:outline-none focus:border-purple-650"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-505 mb-1.5">Descripción / Nota</label>
                <input
                  type="text"
                  placeholder="ej: Compartido entre todos los cuartos del piso 1"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-909 focus:outline-none focus:border-purple-650"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-505 mb-1.5">Costo Mensual ($)</label>
                  <input
                    type="number"
                    placeholder="ej: 15.00"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-909 focus:outline-none focus:border-purple-650"
                    step="0.01"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-505 mb-1.5">Tipo de Servicio</label>
                  <select
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-909 focus:outline-none focus:border-purple-650"
                  >
                    <option value="ADICIONAL">ADICIONAL (Cobro extra)</option>
                    <option value="INCLUIDO">INCLUIDO (En el arriendo)</option>
                  </select>
                </div>
              </div>

              {/* ALCANCE */}
              <div className="border-t border-slate-100 pt-4 space-y-4">
                <p className="text-[10px] font-bold text-purple-600 uppercase tracking-widest">Alcance del Cobro</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-505 mb-1.5">Alcance</label>
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={() => { setTargetType('propiedad'); setSelectedRoomId(''); }}
                        className={`flex-1 py-2 text-xs font-semibold border rounded-xl transition-all ${
                          targetType === 'propiedad'
                            ? 'bg-purple-50 text-purple-600 border-purple-200'
                            : 'bg-transparent border-slate-200 text-slate-400 hover:bg-slate-50'
                        }`}
                      >
                        Propiedad
                      </button>
                      <button
                        type="button"
                        onClick={() => setTargetType('cuarto')}
                        className={`flex-1 py-2 text-xs font-semibold border rounded-xl transition-all ${
                          targetType === 'cuarto'
                            ? 'bg-purple-50 text-purple-600 border-purple-200'
                            : 'bg-transparent border-slate-200 text-slate-400 hover:bg-slate-50'
                        }`}
                      >
                        Cuarto
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-505 mb-1.5">Propiedad / Edificio</label>
                    <select
                      value={selectedPropertyId}
                      onChange={(e) => setSelectedPropertyId(e.target.value)}
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-909 focus:outline-none focus:border-purple-650"
                    >
                      <option value="">-- Global / Sin asignar --</option>
                      {properties.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {targetType === 'cuarto' && selectedPropertyId && (
                  <div className="mt-3">
                    <label className="block text-xs font-bold text-slate-505 mb-1.5">Seleccionar Habitación</label>
                    <select
                      value={selectedRoomId}
                      onChange={(e) => setSelectedRoomId(e.target.value)}
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-909 focus:outline-none focus:border-purple-650"
                      disabled={loadingRooms}
                    >
                      <option value="">-- Seleccionar cuarto --</option>
                      {rooms.map(r => (
                        <option key={r.id} value={r.id}>Cuarto {r.roomNumber} ({r.status})</option>
                      ))}
                    </select>
                    {loadingRooms && <p className="text-[10px] text-slate-450 mt-1">Cargando cuartos...</p>}
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="py-2 px-4 bg-transparent border border-slate-200 hover:bg-slate-50 text-slate-500 text-xs font-semibold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="py-2 px-4 bg-purple-650 hover:bg-purple-750 text-white text-xs font-semibold rounded-xl shadow-md shadow-purple-100 disabled:opacity-50"
                >
                  {submitting ? 'Guardando...' : 'Guardar Servicio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={deleteServiceId !== null}
        title="Eliminar Servicio"
        message="¿Está seguro de que desea eliminar este servicio? Se desvinculará de las propiedades/cuartos correspondientes."
        isDestructive
        confirmText="Eliminar"
        cancelText="Cancelar"
        onConfirm={confirmDeleteService}
        onCancel={() => setDeleteServiceId(null)}
      />
    </div>
  );
};
