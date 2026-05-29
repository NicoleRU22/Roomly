import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../services/api';
import { Plus, Edit2, Trash2, ChevronLeft, BedDouble } from 'lucide-react';
import { ConfirmModal } from '../../components/ui/ConfirmModal';

interface Room {
  id: number;
  roomNumber: string;
  price: number;
  status: string; // "Disponible", "Ocupado", "Mantenimiento"
  propertyId: number;
}

export const Rooms: React.FC = () => {
  const { tenant, id } = useParams<{ tenant: string; id: string }>();
  const propertyId = parseInt(id || '0');

  const [rooms, setRooms] = useState<Room[]>([]);
  const [propertyName, setPropertyName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados Modal
  const [showModal, setShowModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [deleteRoomId, setDeleteRoomId] = useState<number | null>(null);
  const [roomNumber, setRoomNumber] = useState('');
  const [price, setPrice] = useState('');
  const [status, setStatus] = useState('Disponible');
  const [submitting, setSubmitting] = useState(false);

  const fetchRoomsAndProperty = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Obtener habitaciones de la propiedad
      const roomsRes = await api.get(`/properties/${propertyId}/rooms`);
      setRooms(roomsRes.data);

      // 2. Buscar el nombre de la propiedad actual
      const propsRes = await api.get('/properties');
      const currentProp = propsRes.data.find((p: any) => p.id === propertyId);
      if (currentProp) {
        setPropertyName(currentProp.name);
      }
    } catch (err: any) {
      console.error('Error fetching rooms:', err);
      setError('No se pudieron cargar las habitaciones de esta propiedad.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoomsAndProperty();
  }, [propertyId]);

  const openCreateModal = () => {
    setEditingRoom(null);
    setRoomNumber('');
    setPrice('');
    setStatus('Disponible');
    setShowModal(true);
  };

  const openEditModal = (room: Room) => {
    setEditingRoom(room);
    setRoomNumber(room.roomNumber);
    setPrice(String(room.price));
    setStatus(room.status);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomNumber || !price) return;
    setSubmitting(true);
    setError(null);

    const payload = {
      propertyId,
      roomNumber,
      price: parseFloat(price),
      status
    };

    try {
      if (editingRoom) {
        await api.put(`/rooms/${editingRoom.id}`, payload);
      } else {
        await api.post('/rooms', payload);
      }
      setShowModal(false);
      fetchRoomsAndProperty();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al guardar la habitación.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (roomId: number) => {
    setDeleteRoomId(roomId);
  };

  const confirmDeleteRoom = async () => {
    if (deleteRoomId === null) return;
    try {
      await api.delete(`/rooms/${deleteRoomId}`);
      setDeleteRoomId(null);
      fetchRoomsAndProperty();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al eliminar la habitación.');
    }
  };

  if (loading && rooms.length === 0) {
    return (
      <div className="flex items-center justify-center h-[50vh] text-slate-505">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mr-3" />
        Cargando habitaciones...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Botón Atrás + Título */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
        <div className="flex items-center space-x-3">
          <Link
            to={`/${tenant}/propiedades`}
            className="p-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-500 hover:text-slate-900 transition-colors shadow-sm"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Habitaciones de {propertyName || 'Propiedad'}</h2>
            <p className="text-xs text-slate-500 mt-1">Administra los cuartos individuales, precios y disponibilidad de esta locación.</p>
          </div>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center py-2.5 px-4 bg-[#9333ea] hover:bg-purple-700 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-purple-200 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Nueva Habitación
        </button>
      </div>

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
          {error}
        </div>
      )}

      {rooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white border border-slate-100 rounded-2xl text-center shadow-sm">
          <BedDouble className="w-12 h-12 text-slate-300 mb-3" />
          <p className="text-sm font-semibold text-slate-700">Esta propiedad aún no tiene cuartos</p>
          <p className="text-xs text-slate-400 mt-1 mb-4">Comienza registrando la primera habitación o departamento individual.</p>
          <button
            onClick={openCreateModal}
            className="py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-xs font-semibold text-white rounded-xl transition-colors shadow-md shadow-purple-100"
          >
            Registrar Habitación
          </button>
        </div>
      ) : (
        /* GRID DE HABITACIONES */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {rooms.map((room) => {
            let statusColor = 'bg-blue-50 text-blue-600 border-blue-100';
            if (room.status === 'Ocupado') statusColor = 'bg-emerald-50 text-emerald-600 border-emerald-100';
            if (room.status === 'Mantenimiento') statusColor = 'bg-amber-50 text-amber-600 border-amber-100';

            return (
              <div 
                key={room.id}
                className="bg-white border border-slate-150 rounded-2xl p-5 hover:border-purple-200 transition-all duration-200 shadow-sm flex flex-col justify-between group"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-md font-bold text-slate-800">Cuarto {room.roomNumber}</h3>
                    <span className={`inline-block mt-2.5 text-[10px] font-bold border px-2 py-0.5 rounded-lg ${statusColor}`}>
                      {room.status}
                    </span>
                  </div>
                  
                  {/* Acciones */}
                  <div className="flex space-x-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEditModal(room)}
                      className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors"
                      title="Editar"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(room.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="border-t border-slate-100 mt-4 pt-3 flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-medium">Alquiler sugerido:</span>
                  <span className="font-extrabold text-slate-800">${room.price.toFixed(2)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL CREACIÓN / EDICIÓN */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          
          <div className="bg-white border border-slate-200 w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl z-10 p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-md font-bold text-slate-900">
                {editingRoom ? 'Editar Habitación' : 'Registrar Habitación'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-900">✕</button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Número de Cuarto</label>
                <input
                  type="text"
                  placeholder="ej: 101, A-1"
                  value={roomNumber}
                  onChange={(e) => setRoomNumber(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Precio Renta Mensual ($)</label>
                <input
                  type="number"
                  placeholder="ej: 120.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-600"
                  step="0.01"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Estado de Ocupación</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-600"
                >
                  <option value="Disponible">Disponible</option>
                  <option value="Ocupado">Ocupado</option>
                  <option value="Mantenimiento">Mantenimiento</option>
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="py-2 px-4 bg-transparent border border-slate-200 hover:bg-slate-50 text-slate-505 text-xs font-semibold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl shadow-md shadow-purple-100 disabled:opacity-50"
                >
                  {submitting ? 'Guardando...' : 'Guardar Habitación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={deleteRoomId !== null}
        title="Eliminar Habitación"
        message="¿Está seguro de que desea eliminar esta habitación de la propiedad?"
        isDestructive
        confirmText="Eliminar"
        cancelText="Cancelar"
        onConfirm={confirmDeleteRoom}
        onCancel={() => setDeleteRoomId(null)}
      />
    </div>
  );
};
