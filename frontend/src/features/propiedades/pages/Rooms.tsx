import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../../core/services/api';
import { Plus, Edit2, Trash2, ChevronLeft, BedDouble, Calendar, ChevronRight } from 'lucide-react';
import { ConfirmModal } from '../../../core/components/ui/ConfirmModal';

interface Room {
  id: number;
  roomNumber: string;
  price: number;
  status: string; // "Disponible", "Ocupado", "Mantenimiento"
  propertyId: number;
}

interface OccupiedRange {
  contratoId: number;
  inquilinoName: string;
  startDate: string;
  endDate: string;
  status: string;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];
const WEEKDAY_LABELS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];

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

  // Estados Modal Calendario de Disponibilidad
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  const [availabilityRoom, setAvailabilityRoom] = useState<Room | null>(null);
  const [occupiedRanges, setOccupiedRanges] = useState<OccupiedRange[]>([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

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

  const openAvailabilityModal = async (room: Room) => {
    setAvailabilityRoom(room);
    setCalendarMonth(new Date());
    setShowAvailabilityModal(true);
    setLoadingAvailability(true);
    try {
      const res = await api.get(`/rooms/${room.id}/availability`);
      setOccupiedRanges(res.data.occupiedRanges || []);
    } catch (err: any) {
      setError('No se pudo cargar la disponibilidad de la habitación.');
    } finally {
      setLoadingAvailability(false);
    }
  };

  // Determina si una fecha cae dentro de algún rango de contrato ocupado
  const getOccupancyForDate = (date: Date): OccupiedRange | null => {
    const dateStr = date.toISOString().split('T')[0];
    return occupiedRanges.find(r => dateStr >= r.startDate && dateStr <= r.endDate) || null;
  };

  // Genera la matriz de días (con relleno) para el mes actual del calendario
  const getCalendarDays = (month: Date): (Date | null)[] => {
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const firstDay = new Date(year, monthIndex, 1);
    const lastDay = new Date(year, monthIndex + 1, 0);
    // Lunes = 0 ... Domingo = 6
    const leadingBlanks = (firstDay.getDay() + 6) % 7;

    const days: (Date | null)[] = [];
    for (let i = 0; i < leadingBlanks; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, monthIndex, d));
    return days;
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-650 mr-3" />
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
            className="p-2.5 bg-white hover:bg-slate-55 border border-slate-200 rounded-xl text-slate-500 hover:text-slate-905 transition-colors shadow-sm"
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
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-650">
          {error}
        </div>
      )}

      {rooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white border border-slate-100 rounded-2xl text-center shadow-sm">
          <BedDouble className="w-12 h-12 text-slate-350 mb-3" />
          <p className="text-sm font-semibold text-slate-705">Esta propiedad aún no tiene cuartos</p>
          <p className="text-xs text-slate-400 mt-1 mb-4">Comienza registrando la primera habitación o departamento individual.</p>
          <button
            onClick={openCreateModal}
            className="py-2.5 px-4 bg-purple-650 hover:bg-purple-750 text-xs font-semibold text-white rounded-xl transition-colors shadow-md shadow-purple-100"
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
                      onClick={() => openAvailabilityModal(room)}
                      className="p-1.5 rounded-lg text-slate-400 hover:bg-purple-50 hover:text-purple-650 transition-colors"
                      title="Ver calendario de disponibilidad"
                    >
                      <Calendar className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openEditModal(room)}
                      className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors"
                      title="Editar"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(room.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-650 transition-colors"
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
              <h3 className="text-md font-bold text-slate-905">
                {editingRoom ? 'Editar Habitación' : 'Registrar Habitación'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-900">✕</button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-505 mb-1.5">Número de Cuarto</label>
                <input
                  type="text"
                  placeholder="ej: 101, A-1"
                  value={roomNumber}
                  onChange={(e) => setRoomNumber(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-909 focus:outline-none focus:border-purple-650"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-505 mb-1.5">Precio Renta Mensual ($)</label>
                <input
                  type="number"
                  placeholder="ej: 120.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-909 focus:outline-none focus:border-purple-650"
                  step="0.01"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-505 mb-1.5">Estado de Ocupación</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-909 focus:outline-none focus:border-purple-650"
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
                  className="py-2 px-4 bg-purple-650 hover:bg-purple-750 text-white text-xs font-semibold rounded-xl shadow-md shadow-purple-100 disabled:opacity-50"
                >
                  {submitting ? 'Guardando...' : 'Guardar Habitación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CALENDARIO DE DISPONIBILIDAD */}
      {showAvailabilityModal && availabilityRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAvailabilityModal(false)} />

          <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl z-10 p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-md font-bold text-slate-900">Disponibilidad - Cuarto {availabilityRoom.roomNumber}</h3>
                <p className="text-[11px] text-slate-400">Basado en los contratos activos y pendientes de esta habitación.</p>
              </div>
              <button onClick={() => setShowAvailabilityModal(false)} className="text-slate-400 hover:text-slate-900">✕</button>
            </div>

            {loadingAvailability ? (
              <div className="py-10 text-center text-sm text-slate-400">Cargando disponibilidad...</div>
            ) : (
              <>
                {/* Navegación de mes */}
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm font-bold text-slate-800">
                    {MONTH_NAMES[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Grilla del calendario */}
                <div className="grid grid-cols-7 gap-1 text-center">
                  {WEEKDAY_LABELS.map(d => (
                    <span key={d} className="text-[10px] font-bold text-slate-400 uppercase pb-1">{d}</span>
                  ))}
                  {getCalendarDays(calendarMonth).map((date, idx) => {
                    if (!date) return <div key={idx} />;
                    const occupancy = getOccupancyForDate(date);
                    const isToday = date.toDateString() === new Date().toDateString();
                    return (
                      <div
                        key={idx}
                        title={occupancy ? `Ocupado: ${occupancy.inquilinoName}` : 'Disponible'}
                        className={`aspect-square flex items-center justify-center rounded-lg text-xs font-semibold cursor-default ${
                          occupancy
                            ? occupancy.status === 'VIGENTE'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-50 text-emerald-700'
                        } ${isToday ? 'ring-2 ring-purple-400' : ''}`}
                      >
                        {date.getDate()}
                      </div>
                    );
                  })}
                </div>

                {/* Leyenda */}
                <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-100 text-[10px] font-semibold">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-50 border border-emerald-200" /> Disponible</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-100 border border-rose-200" /> Ocupado (vigente)</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-100 border border-amber-200" /> Reservado (pendiente de firma)</span>
                </div>

                {/* Lista de contratos */}
                {occupiedRanges.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-100 max-h-32 overflow-y-auto">
                    {occupiedRanges.map(r => (
                      <div key={r.contratoId} className="flex justify-between text-[11px] text-slate-600">
                        <span className="font-semibold">{r.inquilinoName}</span>
                        <span className="font-mono text-slate-400">{r.startDate} → {r.endDate}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
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
