import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../../core/services/api';
import { Plus, Trash2, MapPin, Building, Settings } from 'lucide-react';
import { ConfirmModal } from '../../../core/components/ui/ConfirmModal';

interface Property {
  id: number;
  name: string;
  address: string;
  price: number | null;
  services?: string;
  rooms?: any[];
  inquilinos?: any[];
}

const AVAILABLE_SERVICES = [
  { id: 'wifi', label: 'WiFi' },
  { id: 'Estacionamiento', label: 'Estacionamiento' },
  { id: 'Gimnasio', label: 'Gimnasio' },
  { id: 'Piscina', label: 'Piscina' }
];

export const Propiedades: React.FC = () => {
  const { tenant } = useParams();
  
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletePropId, setDeletePropId] = useState<number | null>(null);

  // Estados Modal Creación/Edición Tradicional (para Edición rápida)
  const [showModal, setShowModal] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [price, setPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Estados del 3-Step Wizard de Creación (Figma)
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [roomsCountInput, setRoomsCountInput] = useState('2');
  const [bathroomsCountInput, setBathroomsCountInput] = useState('2');
  const [roomsList, setRoomsList] = useState<{ roomNumber: string; floor: string; price: string; status: string }[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  const fetchProperties = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/properties');
      setProperties(res.data);
    } catch (err: any) {
      console.error('Error fetching properties:', err);
      setError('No se pudieron cargar las propiedades.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProperties();
  }, []);

  const openCreateModal = () => {
    setEditingProperty(null);
    setName('');
    setAddress('');
    setPrice('');
    setRoomsCountInput('2');
    setBathroomsCountInput('2');
    setRoomsList([]);
    setSelectedServices([]);
    setWizardStep(1);
    setShowWizard(true);
  };

  const openEditModal = (prop: Property) => {
    setEditingProperty(prop);
    setName(prop.name);
    setAddress(prop.address);
    setPrice(prop.price ? String(prop.price) : '');
    setSelectedServices(prop.services ? prop.services.split(',').map(s => s.trim()).filter(Boolean) : []);
    setShowModal(true);
  };

  // Guardar Edición Rápida
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !address) return;
    setSubmitting(true);
    setError(null);

    const payload = {
      name,
      address,
      price: price ? parseFloat(price) : null,
      services: selectedServices.join(',')
    };

    try {
      if (editingProperty) {
        await api.put(`/properties/${editingProperty.id}`, payload);
      }
      setShowModal(false);
      fetchProperties();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al guardar la propiedad.');
    } finally {
      setSubmitting(false);
    }
  };

  // Manejo de Flujo del Wizard
  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !address) return;
    
    // Inicializar la lista de cuartos según la cantidad del paso 1
    const count = parseInt(roomsCountInput) || 0;
    const initialRooms = [];
    for (let i = 1; i <= count; i++) {
      const floor = Math.floor((i - 1) / 4) + 1;
      initialRooms.push({
        roomNumber: `Habitacion ${i}`,
        floor: String(floor),
        price: '1200',
        status: 'Disponible'
      });
    }
    setRoomsList(initialRooms);
    setWizardStep(2);
  };

  const handleAddRoomToWizard = () => {
    const floor = Math.floor(roomsList.length / 4) + 1;
    setRoomsList([
      ...roomsList,
      {
        roomNumber: `Habitacion ${roomsList.length + 1}`,
        floor: String(floor),
        price: '1200',
        status: 'Disponible'
      }
    ]);
  };

  const handleRemoveRoomFromWizard = (index: number) => {
    const updated = roomsList.filter((_, idx) => idx !== index);
    setRoomsList(updated);
  };

  const handleUpdateRoomInWizard = (index: number, field: string, value: string) => {
    const updated = roomsList.map((room, idx) => {
      if (idx === index) {
        return { ...room, [field]: value };
      }
      return room;
    });
    setRoomsList(updated);
  };

  const handleCreatePropertyWizard = async () => {
    setSubmitting(true);
    setError(null);
    try {
      // 1. Crear propiedad
      const res = await api.post('/properties', {
        name,
        address,
        price: null,
        services: selectedServices.join(',')
      });
      const newProperty = res.data;

      // 2. Crear habitaciones vinculadas en paralelo
      await Promise.all(
        roomsList.map(room => 
          api.post('/rooms', {
            propertyId: newProperty.id,
            roomNumber: room.roomNumber,
            price: parseFloat(room.price) || 0,
            status: room.status
          })
        )
      );

      setShowWizard(false);
      fetchProperties();
    } catch (err: any) {
      console.error('Error en wizard de creación:', err);
      setError(err.response?.data?.error || 'Error al registrar la propiedad y sus habitaciones.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    setDeletePropId(id);
  };

  const confirmDelete = async () => {
    if (deletePropId === null) return;
    try {
      await api.delete(`/properties/${deletePropId}`);
      setDeletePropId(null);
      fetchProperties();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al eliminar la propiedad.');
    }
  };

  if (loading && properties.length === 0) {
    return (
      <div className="flex items-center justify-center h-[50vh] text-slate-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mr-3" />
        Cargando propiedades...
      </div>
    );
  }

  // VISTA DEL 3-STEP WIZARD (MUESTRA EL FORMULARIO COMPLETO INLINE)
  if (showWizard) {
    return (
      <div className="space-y-6 bg-slate-50 min-h-screen">
        
        {/* Header del Wizard */}
        <div className="pb-4 mb-6 border-b border-slate-200/80 flex justify-between items-center bg-slate-50">
          <h2 className="text-xl font-bold text-slate-900">Crear nueva propiedad</h2>
          <button 
            type="button" 
            onClick={() => setShowWizard(false)}
            className="text-xs font-bold text-slate-450 hover:text-slate-900 transition-colors"
          >
            ✕ Cancelar y salir
          </button>
        </div>

        {/* Indicador de Pasos */}
        <div className="flex items-center justify-center space-x-12 py-4 mb-8">
          <div className="flex items-center space-x-3">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              wizardStep >= 1 ? 'bg-[#A855F7] text-white shadow-md shadow-purple-100' : 'bg-slate-200 text-slate-500'
            }`}>
              1
            </div>
            <span className={`text-xs font-bold ${wizardStep >= 1 ? 'text-slate-800' : 'text-slate-400'}`}>Información</span>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              wizardStep >= 2 ? 'bg-[#A855F7] text-white shadow-md shadow-purple-100' : 'bg-slate-200 text-slate-500'
            }`}>
              2
            </div>
            <span className={`text-xs font-bold ${wizardStep >= 2 ? 'text-slate-800' : 'text-slate-400'}`}>Cuartos</span>
          </div>

          <div className="flex items-center space-x-3">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              wizardStep >= 3 ? 'bg-[#A855F7] text-white shadow-md shadow-purple-100' : 'bg-slate-200 text-slate-500'
            }`}>
              3
            </div>
            <span className={`text-xs font-bold ${wizardStep >= 3 ? 'text-slate-800' : 'text-slate-400'}`}>Resumen</span>
          </div>
        </div>

        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 max-w-xl mx-auto">
            {error}
          </div>
        )}

        {/* PASO 1: INFORMACIÓN BÁSICA */}
        {wizardStep === 1 && (
          <form onSubmit={handleStep1Submit} className="max-w-xl mx-auto bg-white border border-slate-200 p-8 rounded-3xl space-y-6 shadow-sm">
            <div className="pb-1 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Información básica</h3>
              <p className="text-xs text-slate-500 mt-1">Ingresa información básica de tu propiedad</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Nombre de Propiedad</label>
                <input
                  type="text"
                  placeholder="ej: Departamento centro - Edificio B"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-650 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-505 mb-1.5">Dirección</label>
                <input
                  type="text"
                  placeholder="ej: Av. Larco 453, Miraflores, Lima, Perú"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-650 transition-colors"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">Cuartos</label>
                  <input
                    type="number"
                    value={roomsCountInput}
                    onChange={(e) => setRoomsCountInput(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-650 transition-colors"
                    min="1"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-505 mb-1.5">Baños</label>
                  <input
                    type="number"
                    value={bathroomsCountInput}
                    onChange={(e) => setBathroomsCountInput(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-650 transition-colors"
                    min="1"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2">Servicios ofrecidos (Selección múltiple)</label>
                <div className="grid grid-cols-2 gap-2.5">
                  {AVAILABLE_SERVICES.map((service) => {
                    const isSelected = selectedServices.includes(service.id);
                    return (
                      <button
                        type="button"
                        key={service.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedServices(selectedServices.filter(s => s !== service.id));
                          } else {
                            setSelectedServices([...selectedServices, service.id]);
                          }
                        }}
                        className={`flex items-center space-x-2.5 p-3 rounded-xl border text-xs font-bold transition-all text-left ${
                          isSelected 
                            ? 'bg-[#FAF4FF] text-[#A855F7] border-[#A855F7] shadow-sm shadow-purple-50' 
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50/50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          readOnly
                          className="w-3.5 h-3.5 text-purple-600 border-slate-300 rounded focus:ring-purple-500 pointer-events-none"
                        />
                        <span>{service.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowWizard(false)}
                className="flex-1 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-colors shadow-sm text-center"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-[#A855F7] hover:bg-[#9333EA] text-white text-xs font-bold rounded-xl shadow-md transition-colors text-center"
              >
                Siguiente
              </button>
            </div>
          </form>
        )}

        {/* PASO 2: CUARTOS CONFIGURACIÓN */}
        {wizardStep === 2 && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="pb-1 border-b border-slate-200/60">
              <h3 className="text-lg font-bold text-slate-900">Cuartos</h3>
              <p className="text-xs text-slate-500 mt-1">Agrega y configura cada cuarto de tu propiedad</p>
            </div>

            <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-2">
              {roomsList.map((room, index) => (
                <div key={index} className="bg-white border border-slate-200 p-5 rounded-2xl relative space-y-4 shadow-sm">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                    <span className="text-sm font-bold text-slate-800">Cuarto {index + 1}</span>
                    {roomsList.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveRoomFromWizard(index)}
                        className="text-slate-450 hover:text-red-655 transition-colors"
                        title="Eliminar cuarto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">Numero de cuarto</label>
                      <input
                        type="text"
                        placeholder="ej. 101"
                        value={room.roomNumber}
                        onChange={(e) => handleUpdateRoomInWizard(index, 'roomNumber', e.target.value)}
                        className="w-full px-2.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-purple-655 transition-colors"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">Piso</label>
                      <input
                        type="text"
                        placeholder="ej. 1"
                        value={room.floor}
                        onChange={(e) => handleUpdateRoomInWizard(index, 'floor', e.target.value)}
                        className="w-full px-2.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-purple-655 transition-colors"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">Precio mensual</label>
                      <input
                        type="text"
                        placeholder="ej. 1200"
                        value={room.price}
                        onChange={(e) => handleUpdateRoomInWizard(index, 'price', e.target.value)}
                        className="w-full px-2.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-purple-655 transition-colors"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">Estado</label>
                      <select
                        value={room.status}
                        onChange={(e) => handleUpdateRoomInWizard(index, 'status', e.target.value)}
                        className="w-full px-2.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-purple-655"
                      >
                        <option value="Disponible">Disponible</option>
                        <option value="Ocupado">Ocupado</option>
                        <option value="Mantenimiento">Mantenimiento</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleAddRoomToWizard}
              className="w-full py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 text-xs font-semibold rounded-xl transition-colors shadow-sm"
            >
              + Agregar nuevo cuarto
            </button>

            <div className="flex space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setWizardStep(1)}
                className="flex-1 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition-colors shadow-sm text-center"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={() => setWizardStep(3)}
                className="flex-1 py-2.5 bg-[#A855F7] hover:bg-[#9333EA] text-white text-xs font-semibold rounded-xl transition-colors shadow-md text-center"
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {/* PASO 3: RESUMEN */}
        {wizardStep === 3 && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="pb-1 border-b border-slate-200/60">
              <h3 className="text-lg font-bold text-slate-900">Resumen</h3>
              <p className="text-xs text-slate-505 mt-1">Verifica todos los detalles antes de crear tu propiedad</p>
            </div>

            <div className="bg-white border border-slate-200 p-6 rounded-3xl space-y-5 shadow-sm">
              <div>
                <h4 className="text-xl font-bold text-slate-900">{name}</h4>
                <p className="text-xs text-slate-500 mt-1.5">
                  {address}
                </p>
              </div>

              {/* Cuartos y Baños metrics */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#FAF4FF] border border-purple-100 p-4 rounded-2xl text-center">
                  <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Cuartos</span>
                  <p className="text-3xl font-black text-[#A855F7] mt-1">{roomsList.length}</p>
                </div>

                <div className="bg-[#FAF4FF] border border-purple-100 p-4 rounded-2xl text-center">
                  <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Baños</span>
                  <p className="text-3xl font-black text-[#A855F7] mt-1">{bathroomsCountInput}</p>
                </div>
              </div>

              {/* Servicios */}
              <div className="space-y-1.5">
                <p className="text-xs font-bold text-slate-700">Servicios</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedServices.length === 0 ? (
                    <span className="text-[10px] text-slate-400 font-medium italic">Ningún servicio seleccionado</span>
                  ) : (
                    selectedServices.map(srvId => {
                      const srv = AVAILABLE_SERVICES.find(s => s.id === srvId);
                      return (
                        <span key={srvId} className="px-2.5 py-0.5 bg-[#FAF4FF] text-[#A855F7] border border-purple-100 text-[10px] font-bold rounded-full">
                          {srv ? srv.label : srvId}
                        </span>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Habitaciones List */}
              <div className="space-y-2 border-t border-slate-100 pt-4">
                <p className="text-xs font-bold text-slate-700">Habitaciones</p>
                <div className="space-y-2 max-h-[30vh] overflow-y-auto pr-1">
                  {roomsList.map((room, index) => (
                    <div key={index} className="flex justify-between items-center p-3.5 bg-white border border-slate-200 rounded-2xl text-xs">
                      <div>
                        <p className="font-bold text-slate-800">{room.roomNumber} - Piso {room.floor}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">Estado: {room.status}</p>
                      </div>
                      <span className="font-bold text-[#A855F7] text-sm">
                        S/ {room.price}/mes
                      </span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            <div className="flex space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setWizardStep(2)}
                className="flex-1 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition-colors shadow-sm text-center"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleCreatePropertyWizard}
                disabled={submitting}
                className="flex-1 py-2.5 bg-[#A855F7] hover:bg-[#9333EA] text-white text-xs font-bold rounded-xl transition-colors shadow-md text-center disabled:opacity-50"
              >
                {submitting ? 'Creando...' : 'Crear propiedad'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // VISTA TRADICIONAL DE LISTADO
  return (
    <div className="space-y-6">
      
      {/* Subheader */}
      <div className="flex justify-between items-center mb-6">
        <p className="text-xs text-slate-500">Gestiona todos los inquilinos en tus propiedades</p>
        <button
          onClick={openCreateModal}
          className="flex items-center py-2.5 px-4 bg-[#9333ea] hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-purple-100"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Nueva propiedad
        </button>
      </div>

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
          {error}
        </div>
      )}

      {properties.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white border border-slate-100 rounded-2xl text-center shadow-sm">
          <Building className="w-12 h-12 text-slate-300 mb-3" />
          <p className="text-sm font-semibold text-slate-700">No tienes propiedades creadas</p>
          <p className="text-xs text-slate-400 mt-1 mb-4 max-w-sm">Comienza registrando tu primera propiedad o edificio para añadir cuartos.</p>
          <button
            onClick={openCreateModal}
            className="py-2.5 px-4 bg-[#9333ea] hover:bg-purple-700 text-xs font-semibold text-white rounded-xl transition-colors shadow-md shadow-purple-100"
          >
            Registrar Propiedad
          </button>
        </div>
      ) : (
        /* GRID DE PROPIEDADES */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {properties.map((prop) => {
            const roomsCount = prop.rooms?.length || 0;
            const occupiedRoomsCount = prop.rooms?.filter((r: any) => r.status === 'Ocupado').length || 0;
            const occupancyRate = roomsCount > 0 ? Math.round((occupiedRoomsCount / roomsCount) * 100) : 0;
            const inquilinosCount = prop.inquilinos?.length || 0;
            const monthlyRevenue = prop.rooms?.filter((r: any) => r.status === 'Ocupado').reduce((sum: number, r: any) => sum + r.price, 0) || 0;

            return (
              <div 
                key={prop.id}
                className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all duration-200 space-y-5"
              >
                {/* Header Card */}
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 leading-tight">{prop.name}</h3>
                    <div className="flex items-center text-slate-500 text-xs mt-1.5 font-medium">
                      <MapPin className="w-3.5 h-3.5 mr-1 text-slate-400 shrink-0" />
                      <span>{prop.address}</span>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleDelete(prop.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-655 transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Métricas con fondo suave */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-[#FAF7FD] border border-purple-100/30 p-3 rounded-2xl">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Habitaciones</p>
                    <p className="text-xl font-extrabold text-slate-900 mt-1">{roomsCount}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{occupiedRoomsCount} ocupados</p>
                  </div>
                  <div className="bg-[#FAF7FD] border border-purple-100/30 p-3 rounded-2xl">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Ocupación</p>
                    <p className="text-xl font-extrabold text-slate-900 mt-1">{occupancyRate}%</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{inquilinosCount} inquilinos</p>
                  </div>
                  <div className="bg-[#FAF7FD] border border-purple-100/30 p-3 rounded-2xl">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Ingresos</p>
                    <p className="text-xl font-extrabold text-slate-900 mt-1">S/. {monthlyRevenue}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5 font-sans">mensual</p>
                  </div>
                </div>

                {/* Servicios */}
                <div className="space-y-1.5">
                  <p className="text-xs font-bold text-slate-700">Servicios</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(!prop.services || prop.services.trim() === '') ? (
                      <span className="text-[10px] text-slate-400 font-medium italic">Sin servicios asignados</span>
                    ) : (
                      prop.services.split(',').map((srvId: string) => srvId.trim()).filter(Boolean).map((srvId: string) => {
                        const srv = AVAILABLE_SERVICES.find(s => s.id === srvId);
                        return (
                          <span key={srvId} className="px-2.5 py-0.5 bg-purple-50 text-purple-600 border border-purple-100 text-[10px] font-semibold rounded-full">
                            {srv ? srv.label : srvId}
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Botones de acción */}
                <div className="flex space-x-3 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => openEditModal(prop)}
                    className="flex-1 flex items-center justify-center py-2 px-4 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-all"
                  >
                    <Settings className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                    Configuración
                  </button>
                  <Link
                    to={`/${tenant}/propiedades/${prop.id}`}
                    className="flex-1 flex items-center justify-center py-2 px-4 bg-[#9333ea] hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm shadow-purple-100 text-center"
                  >
                    Ver detalles
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL CREACIÓN / EDICIÓN TRADICIONAL (para Edición rápida) */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl z-10 p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-md font-bold text-slate-900">
                Editar Propiedad
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-900">✕</button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-505 mb-1.5">Nombre de la propiedad / Edificio</label>
                <input
                  type="text"
                  placeholder="ej: Edificio Central o Condominio Norte"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-505 mb-1.5">Dirección de la locación</label>
                <input
                  type="text"
                  placeholder="ej: Av. Larco 456, Miraflores"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-600"
                  required
                />
              </div>

              {/* Servicios quick edit */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-500 mb-2">Servicios ofrecidos</label>
                <div className="grid grid-cols-2 gap-2">
                  {AVAILABLE_SERVICES.map((service) => {
                    const isSelected = selectedServices.includes(service.id);
                    return (
                      <button
                        type="button"
                        key={service.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedServices(selectedServices.filter(s => s !== service.id));
                          } else {
                            setSelectedServices([...selectedServices, service.id]);
                          }
                        }}
                        className={`flex items-center space-x-2 p-2.5 rounded-xl border text-xs font-bold transition-all text-left ${
                          isSelected 
                            ? 'bg-[#FAF4FF] text-[#A855F7] border-[#A855F7]' 
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50/50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          readOnly
                          className="w-3.5 h-3.5 text-purple-600 border-slate-300 rounded focus:ring-purple-500 pointer-events-none"
                        />
                        <span>{service.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="py-2 px-4 bg-transparent border border-slate-200 hover:bg-slate-50 text-slate-550 text-xs font-semibold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="py-2 px-4 bg-[#9333ea] hover:bg-purple-700 text-white text-xs font-semibold rounded-xl shadow-md shadow-purple-100 disabled:opacity-50"
                >
                  {submitting ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={deletePropId !== null}
        title="Eliminar Propiedad"
        message="¿Está seguro de que desea eliminar esta propiedad? Esto eliminará también todas sus habitaciones y contratos asociados de forma permanente."
        isDestructive
        confirmText="Eliminar"
        cancelText="Cancelar"
        onConfirm={confirmDelete}
        onCancel={() => setDeletePropId(null)}
      />
    </div>
  );
};
