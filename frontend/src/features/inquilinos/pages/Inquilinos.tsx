import React, { useEffect, useState } from 'react';
import api from '../../../core/services/api';
import { Plus, MessageSquare, FileText, Search, Filter, Edit, AlertTriangle, CheckCircle, LogOut, ArrowRightLeft, History } from 'lucide-react';
import { AsYouType, parsePhoneNumberFromString } from 'libphonenumber-js';
import { Pagination } from '../../../core/components/ui/Pagination';
import { useAuthStore } from '../../../features/auth/store/useAuthStore';

interface Inquilino {
  id: number;
  name: string;
  document: string;
  email: string;
  phone?: string;
  status: string; // ACTIVO, INACTIVO, MOROSO
  propertyId?: number;
  propertyName?: string;
  roomId?: number;
  roomNumber?: string;
  roomPrice?: number;
  moveOutDate?: string;
  moveOutReason?: string;
}

interface HistorialEvento {
  id: number;
  type: string;
  fromPropertyName?: string;
  fromRoomNumber?: string;
  toPropertyName?: string;
  toRoomNumber?: string;
  reason?: string;
  eventDate: string;
}

interface Property {
  id: number;
  name: string;
}

interface Room {
  id: number;
  roomNumber: string;
  status: string;
  price: number;
}

interface Payment {
  id: number;
  inquilinoId: number;
  amount: number;
  amountPaid: number;
  delayPenalty: number;
  status: string;
}

interface Contrato {
  id: number;
  inquilinoId: number;
  inquilinoName: string;
  roomNumber: string;
  propertyName: string;
  startDate: string;
  endDate: string;
  amount: number;
  status: string;
  propertyServices?: string;
  signatureUrl?: string;
  landlordSignatureUrl?: string;
}

const PAGE_SIZE = 8;
const CREDENTIALS_CACHE_KEY = 'roomly_inquilino_credentials';
const SERVICE_LABELS: Record<string, string> = {
  wifi: 'WiFi',
  WiFi: 'WiFi',
  Estacionamiento: 'Estacionamiento',
  Gimnasio: 'Gimnasio',
  Piscina: 'Piscina'
};

export const Inquilinos: React.FC = () => {
  const tenantSlug = useAuthStore((state) => state.tenant?.slug || '');
  const [inquilinos, setInquilinos] = useState<Inquilino[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [whatsappTemplate, setWhatsappTemplate] = useState(
    'Hola {nombre}, te saludamos de Roomly. Te recordamos que tienes cobros pendientes en la plataforma. Por favor ingresa para regularizarlos.'
  );
  const [payments, setPayments] = useState<Payment[]>([]);
  const [contracts, setContracts] = useState<Contrato[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProperty, setFilterProperty] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterProperty, filterStatus, filterDate]);

  // Estados Modal Inquilino Form
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Estados Modal Dar de Baja
  const [bajaInquilino, setBajaInquilino] = useState<Inquilino | null>(null);
  const [moveOutDate, setMoveOutDate] = useState('');
  const [moveOutReason, setMoveOutReason] = useState('');
  const [submittingBaja, setSubmittingBaja] = useState(false);

  // Estados Modal Cambiar de Habitación
  const [transferInquilino, setTransferInquilino] = useState<Inquilino | null>(null);
  const [transferPropertyId, setTransferPropertyId] = useState('');
  const [transferRoomId, setTransferRoomId] = useState('');
  const [transferRooms, setTransferRooms] = useState<Room[]>([]);
  const [loadingTransferRooms, setLoadingTransferRooms] = useState(false);
  const [transferDate, setTransferDate] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [submittingTransfer, setSubmittingTransfer] = useState(false);

  // Estados Modal Historial
  const [historialInquilino, setHistorialInquilino] = useState<Inquilino | null>(null);
  const [historialEventos, setHistorialEventos] = useState<HistorialEvento[]>([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  // Campos Formulario Inquilino
  const [name, setName] = useState('');
  const [documentVal, setDocumentVal] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [status, setStatus] = useState('ACTIVO');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [entryDate, setEntryDate] = useState<string>('');
  const [contractMonths, setContractMonths] = useState<string>('12');
  const [diaCobro, setDiaCobro] = useState<string>('');

  // Estados Modal Mostrar Credenciales Creadas
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; tempPassword?: string } | null>(null);

  // Estado Modal Visualizador de Contrato
  const [showContractModal, setShowContractModal] = useState(false);
  const [viewingContract, setViewingContract] = useState<Contrato | null>(null);
  const [viewingContracts, setViewingContracts] = useState<Contrato[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(false);
  
  const [searchingDni, setSearchingDni] = useState(false);
  const [dniError, setDniError] = useState<string | null>(null);

  const getApiUrl = () => {
    return import.meta.env.VITE_API_URL || 'http://localhost:3001';
  };

  const getImageUrl = (path?: string) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `${getApiUrl()}${path}`;
  };

  const handleBuscarDni = async (dniVal?: string) => {
    const targetDni = dniVal || documentVal;
    if (targetDni.length !== 8) return;
    setSearchingDni(true);
    setDniError(null);
    try {
      const res = await api.get(`/inquilinos/consultar-dni/${targetDni}`);
      if (res.data && res.data.name) {
        setName(res.data.name);
      }
    } catch (err: any) {
      console.error('Error al consultar DNI:', err);
      setDniError(err.response?.data?.error || 'No se pudo consultar el DNI.');
    } finally {
      setSearchingDni(false);
    }
  };

  const handleDocumentChange = (val: string) => {
    setDocumentVal(val);
    setDniError(null);
    if (val.length === 8) {
      handleBuscarDni(val);
    }
  };

  const normalizePhoneForSave = () => {
    const digits = phone.replace(/\D/g, '');
    if (!digits) return null;

    const phoneNumber = parsePhoneNumberFromString(digits, 'PE');
    if (!phoneNumber?.isValid() || digits.length !== 9) {
      setPhoneError('Ingresa un telefono peruano valido de 9 digitos.');
      return undefined;
    }

    setPhoneError(null);
    return phoneNumber.number;
  };

  const formatPhoneForDisplay = (value?: string) => {
    if (!value) return '-';
    const parsed = parsePhoneNumberFromString(value, 'PE');
    return parsed?.isValid() ? parsed.formatNational() : value;
  };

  const getContractServices = (contract: Contrato) => {
    return (contract.propertyServices || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => SERVICE_LABELS[item] || item);
  };

  const cacheCredentials = (credentials: { email: string; tempPassword?: string }) => {
    const entry = {
      tenantSlug,
      user: credentials.email,
      password: credentials.tempPassword || 'Roomly-1234',
      cachedAt: new Date().toISOString()
    };

    try {
      const cached = localStorage.getItem(CREDENTIALS_CACHE_KEY);
      const previous = cached ? JSON.parse(cached) : [];
      const filtered = Array.isArray(previous)
        ? previous.filter((item: { user?: string; tenantSlug?: string }) => item.user !== entry.user || item.tenantSlug !== entry.tenantSlug)
        : [];
      localStorage.setItem(CREDENTIALS_CACHE_KEY, JSON.stringify([entry, ...filtered].slice(0, 25)));
    } catch (err) {
      console.error('Error cacheando credenciales del inquilino:', err);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [inqRes, propRes, payRes, conRes, configRes] = await Promise.all([
        api.get('/inquilinos'),
        api.get('/properties'),
        api.get('/payments'),
        api.get('/contratos'),
        api.get('/configuracion').catch(() => ({ data: null }))
      ]);
      setInquilinos(inqRes.data);
      setProperties(propRes.data);
      setPayments(payRes.data);
      setContracts(conRes.data);
      if (configRes.data?.whatsappTemplate) {
        setWhatsappTemplate(configRes.data.whatsappTemplate);
      }
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError('No se pudo cargar la información de inquilinos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Cargar habitaciones disponibles cuando cambia la propiedad seleccionada en el formulario
  useEffect(() => {
    if (selectedPropertyId) {
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
  }, [selectedPropertyId]);

  const openCreateModal = () => {
    setEditingId(null);
    setName('');
    setDocumentVal('');
    setEmail('');
    setPhone('');
    setPhoneError(null);
    setStatus('ACTIVO');
    setSelectedPropertyId('');
    setSelectedRoomId('');
    setEntryDate(getTodayIso());
    setContractMonths('12');
    setDiaCobro('');
    setShowModal(true);
  };

  const openEditModal = (inq: Inquilino) => {
    setEditingId(inq.id);
    setName(inq.name);
    setDocumentVal(inq.document);
    setEmail(inq.email);
    // Formatear al abrir
    const digits = (inq.phone || '').replace(/\D/g, '').replace(/^51/, '').slice(0, 9);
    const formatted = new AsYouType('PE').input(digits);
    setPhone(formatted || inq.phone || '');
    setPhoneError(null);
    setStatus(inq.status);
    setSelectedPropertyId(inq.propertyId ? String(inq.propertyId) : '');
    setSelectedRoomId(inq.roomId ? String(inq.roomId) : '');
    setEntryDate(getTodayIso());
    setContractMonths('12');
    setDiaCobro('');
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !documentVal || !email || !status) return;
    const normalizedPhone = normalizePhoneForSave();
    if (phone.trim() && normalizedPhone === undefined) return;

    setSubmitting(true);
    setError(null);

    const payload = {
      name,
      document: documentVal,
      email,
      phone: normalizedPhone,
      status,
      propertyId: selectedPropertyId ? parseInt(selectedPropertyId) : null,
      roomId: selectedRoomId ? parseInt(selectedRoomId) : null,
      entryDate: entryDate || undefined,
      contractMonths: contractMonths ? parseInt(contractMonths) : undefined,
      diaCobro: diaCobro ? parseInt(diaCobro) : undefined
    };

    try {
      if (editingId) {
        await api.put(`/inquilinos/${editingId}`, payload);
        setShowModal(false);
        fetchData();
      } else {
        const res = await api.post('/inquilinos', payload);
        setCreatedCredentials({
          email: res.data.email,
          tempPassword: res.data.tempPassword
        });
        cacheCredentials({
          email: res.data.email,
          tempPassword: res.data.tempPassword
        });
        setShowModal(false);
        setShowCredentialsModal(true);
        fetchData();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al guardar el inquilino.');
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    alert(`${type} copiado al portapapeles.`);
  };

  const openBajaModal = (inq: Inquilino) => {
    setBajaInquilino(inq);
    setMoveOutDate(getTodayIso());
    setMoveOutReason('');
  };

  const handleConfirmBaja = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bajaInquilino || !moveOutDate) return;
    setSubmittingBaja(true);
    try {
      await api.put(`/inquilinos/${bajaInquilino.id}/baja`, {
        moveOutDate,
        reason: moveOutReason || undefined
      });
      setBajaInquilino(null);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al dar de baja al inquilino.');
    } finally {
      setSubmittingBaja(false);
    }
  };

  const openTransferModal = (inq: Inquilino) => {
    setTransferInquilino(inq);
    setTransferPropertyId(inq.propertyId ? String(inq.propertyId) : '');
    setTransferRoomId('');
    setTransferDate(getTodayIso());
    setTransferReason('');
  };

  useEffect(() => {
    if (transferInquilino && transferPropertyId) {
      const fetchTransferRooms = async () => {
        setLoadingTransferRooms(true);
        try {
          const res = await api.get(`/properties/${transferPropertyId}/rooms`);
          setTransferRooms(res.data);
        } catch (err) {
          console.error('Error loading rooms:', err);
        } finally {
          setLoadingTransferRooms(false);
        }
      };
      fetchTransferRooms();
    } else {
      setTransferRooms([]);
      setTransferRoomId('');
    }
  }, [transferPropertyId, transferInquilino]);

  const handleConfirmTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferInquilino || !transferRoomId) return;
    setSubmittingTransfer(true);
    try {
      await api.put(`/inquilinos/${transferInquilino.id}/cambiar-habitacion`, {
        roomId: parseInt(transferRoomId),
        transferDate: transferDate || undefined,
        reason: transferReason || undefined
      });
      setTransferInquilino(null);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al cambiar de habitación al inquilino.');
    } finally {
      setSubmittingTransfer(false);
    }
  };

  const openHistorialModal = async (inq: Inquilino) => {
    setHistorialInquilino(inq);
    setLoadingHistorial(true);
    try {
      const res = await api.get(`/inquilinos/${inq.id}/historial`);
      setHistorialEventos(res.data);
    } catch (err) {
      console.error('Error cargando historial:', err);
      setHistorialEventos([]);
    } finally {
      setLoadingHistorial(false);
    }
  };

  const historialLabel = (type: string) => {
    if (type === 'ALTA') return 'Alta de inquilino';
    if (type === 'CAMBIO_HABITACION') return 'Cambio de habitación';
    if (type === 'BAJA') return 'Salida / mudanza';
    return type;
  };

  // Formatea fechas de solo-fecha (guardadas como medianoche UTC) usando los componentes UTC,
  // para evitar que se muestre un día antes en zonas horarias detrás de UTC (ej. Perú).
  const formatDateUTC = (dateStr?: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const year = d.getUTCFullYear();
    return `${day}/${month}/${year}`;
  };

  // Fecha actual en formato YYYY-MM-DD (hora local)
  const getTodayIso = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Mapear fecha de entrada determinística
  const getFechaEntrada = (nameStr: string, idVal: number) => {
    if (nameStr.toLowerCase().includes('alex') || idVal % 7 === 1) return '28/02/2026';
    if (nameStr.toLowerCase().includes('emily') || idVal % 7 === 2) return '05/01/2026';
    return '22/04/2026';
  };

  // Calcular deuda acumulada para un inquilino
  const getDebtAmount = (inqId: number) => {
    return payments
      .filter(p => p.inquilinoId === inqId && p.status !== 'PAGADO' && p.status !== 'CANCELADO')
      .reduce((sum, p) => sum + ((p.amount - p.amountPaid) + p.delayPenalty), 0);
  };

  // Buscar contrato activo de inquilino
  const openInquilinoContract = (inqId: number) => {
    const tenantContracts = contracts
      .filter(c => c.inquilinoId === inqId)
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
    const contract = tenantContracts.find(c => c.status !== 'FINALIZADO' && c.status !== 'CANCELADO') || tenantContracts[0];
    if (contract) {
      setViewingContracts(tenantContracts);
      setViewingContract(contract);
      setShowContractModal(true);
    } else {
      alert('Este inquilino no tiene contratos registrados.');
    }
  };

  // Filtrado de Inquilinos
  const filteredInquilinos = inquilinos.filter(inq => {
    const matchesSearch = inq.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          inq.document.includes(searchTerm) || 
                          (inq.roomNumber && inq.roomNumber.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesProperty = filterProperty === '' || inq.propertyId === parseInt(filterProperty);
    
    const matchesStatus = filterStatus === '' || inq.status === filterStatus;
    
    const entryDate = getFechaEntrada(inq.name, inq.id);
    const parts = entryDate.split('/');
    const inqDateIso = `${parts[2]}-${parts[1]}-${parts[0]}`;
    const matchesDate = filterDate === '' || inqDateIso === filterDate;

    return matchesSearch && matchesProperty && matchesStatus && matchesDate;
  });

  const availableRoomsForSelection = rooms.filter(r => r.status === 'Disponible' || r.id === parseInt(selectedRoomId));
  const totalPages = Math.max(1, Math.ceil(filteredInquilinos.length / PAGE_SIZE));
  const paginatedInquilinos = filteredInquilinos.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  if (loading && inquilinos.length === 0) {
    return (
      <div className="flex items-center justify-center h-[50vh] text-slate-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-650 mr-3" />
        Cargando inquilinos...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Subheader */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-2">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Directorio de Inquilinos</h2>
          <p className="text-sm text-slate-500 font-medium">Gestiona los inquilinos de tu portafolio, visualiza sus deudas y contratos.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center py-2.5 px-6 bg-[#A855F7] hover:bg-purple-600 text-white text-xs font-bold rounded-xl transition-all shadow-sm shrink-0 self-start sm:self-center"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Agregar inquilino
        </button>
      </div>

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
          {error}
        </div>
      )}

      {/* SECCIÓN DE FILTROS AVANZADOS */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
        <div>
          <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1.5">Búsqueda General</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por Nombre, DNI, Habitación..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-purple-600"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1.5">Por Propiedad</label>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterProperty}
              onChange={(e) => setFilterProperty(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-purple-600 appearance-none"
            >
              <option value="">Todas las propiedades</option>
              {properties.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1.5">Por Estado</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-purple-600"
          >
            <option value="">Todos los estados</option>
            <option value="ACTIVO">ACTIVO</option>
            <option value="MOROSO">MOROSO</option>
            <option value="INACTIVO">INACTIVO</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1.5">Fecha de Entrada</label>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-purple-600 font-mono"
          />
        </div>
      </div>

      {/* TABLA DE INQUILINOS CON REJILLA COMPLETA DE FIGMA */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse border border-slate-200">
            <thead>
              <tr className="bg-purple-600 text-sm text-white font-bold border-b border-slate-200">
                <th className="px-6 py-4 border-r border-slate-200">Inquilino</th>
                <th className="px-6 py-4 border-r border-slate-200">Propiedad</th>
                <th className="px-6 py-4 border-r border-slate-200">Correo</th>
                <th className="px-6 py-4 border-r border-slate-200">Teléfono</th>
                <th className="px-6 py-4 border-r border-slate-200">Fecha de Entrada</th>
                <th className="px-6 py-4 border-r border-slate-200">Estado / Deuda</th>
                <th className="px-6 py-4">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm text-slate-700 bg-white">
              {filteredInquilinos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    No se encontraron inquilinos con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                paginatedInquilinos.map((inq) => {
                  const entryDate = getFechaEntrada(inq.name, inq.id);
                  const debt = getDebtAmount(inq.id);
                  
                  // Generar Iniciales
                  const nameParts = inq.name.trim().split(' ');
                  const initials = nameParts.map(p => p.charAt(0)).slice(0, 2).join('').toUpperCase();

                  // Whatsapp text encoding
                  const waText = encodeURIComponent(whatsappTemplate.replace(/\{nombre\}/g, inq.name));
                  const phoneDigits = inq.phone ? inq.phone.replace(/\D/g, '') : '';
                  const waPhone = phoneDigits.startsWith('51') ? phoneDigits : `51${phoneDigits}`;
                  const waLink = phoneDigits ? `https://wa.me/${waPhone}?text=${waText}` : null;

                  return (
                    <tr key={inq.id} className="hover:bg-slate-50/40 transition-colors border-b border-slate-200 last:border-0">
                      {/* Avatar e Inquilino */}
                      <td className="px-6 py-4 border-r border-slate-200">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-purple-50 text-[#A855F7] border border-purple-100 flex items-center justify-center text-xs font-bold shrink-0 shadow-sm">
                            {initials}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800">{inq.name}</p>
                            <p className="text-[10px] text-slate-400 font-semibold font-mono">DNI: {inq.document}</p>
                          </div>
                        </div>
                      </td>

                      {/* Propiedad */}
                      <td className="px-6 py-4 text-slate-650 text-xs font-semibold border-r border-slate-200">
                        <span className="font-bold text-slate-800 block">{inq.propertyName || 'Edificio por definir'}</span>
                        {inq.roomNumber && <span className="text-[10px] font-mono text-slate-400">Habit: {inq.roomNumber}</span>}
                      </td>

                      {/* Correo */}
                      <td className="px-6 py-4 text-slate-500 font-medium text-xs font-sans border-r border-slate-200">
                        {inq.email}
                      </td>

                      {/* Teléfono */}
                      <td className="px-6 py-4 text-slate-500 font-mono text-xs border-r border-slate-200">
                        {formatPhoneForDisplay(inq.phone)}
                      </td>

                      {/* Fecha de Entrada */}
                      <td className="px-6 py-4 text-slate-500 font-mono text-xs border-r border-slate-200">
                        {entryDate}
                      </td>

                      {/* Estado y Deuda */}
                      <td className="px-6 py-4 border-r border-slate-200">
                        <div className="flex flex-col gap-1.5 items-start">
                          <span className={`px-2.5 py-0.5 rounded-lg text-[9px] font-extrabold border ${
                            inq.status === 'ACTIVO' ? 'bg-emerald-50 text-emerald-700 border-emerald-250/20' :
                            inq.status === 'MOROSO' ? 'bg-rose-50 text-rose-700 border-rose-250/20' :
                            'bg-slate-100 text-slate-600 border border-slate-200/50'
                          }`}>
                            {inq.status}
                          </span>
                          
                          {debt > 0 && (
                            <span className="text-[10px] text-rose-650 font-bold bg-rose-50/50 border border-rose-100 px-1.5 py-0.5 rounded-lg font-mono" title="Monto adeudado actual">
                              Debe: S/. {debt.toFixed(2)}
                            </span>
                          )}

                          {inq.status === 'INACTIVO' && inq.moveOutDate && (
                            <span className="text-[10px] text-slate-500 font-semibold" title={inq.moveOutReason || undefined}>
                              Salió: {formatDateUTC(inq.moveOutDate)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Acciones */}
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2.5">
                          {/* Botón WhatsApp */}
                          {waLink ? (
                            <a
                              href={waLink}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 text-slate-400 hover:text-emerald-600 transition-colors border border-slate-200 hover:border-emerald-200 rounded-lg bg-slate-50/50 hover:bg-emerald-50/30"
                              title="Enviar recordatorio WhatsApp"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </a>
                          ) : (
                            <span className="p-1 opacity-20 border border-slate-200 rounded-lg cursor-not-allowed">
                              <MessageSquare className="w-3.5 h-3.5 text-slate-300" />
                            </span>
                          )}

                          {/* Botón Contrato */}
                          <button
                            onClick={() => openInquilinoContract(inq.id)}
                            className="p-1 text-slate-400 hover:text-purple-600 transition-colors border border-slate-200 hover:border-purple-200 rounded-lg bg-slate-50/50 hover:bg-purple-50/30"
                            title="Ver contrato vigente"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>

                          {/* Historial */}
                          <button
                            onClick={() => openHistorialModal(inq)}
                            className="p-1 text-slate-400 hover:text-indigo-600 transition-colors border border-slate-200 hover:border-indigo-200 rounded-lg bg-slate-50/50 hover:bg-indigo-50/30"
                            title="Ver historial"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>

                          {/* Cambiar de habitación (solo si está activo) */}
                          {inq.status !== 'INACTIVO' && (
                            <button
                              onClick={() => openTransferModal(inq)}
                              className="p-1 text-slate-400 hover:text-amber-600 transition-colors border border-slate-200 hover:border-amber-200 rounded-lg bg-slate-50/50 hover:bg-amber-50/30"
                              title="Cambiar de habitación"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Editar */}
                          <button
                            onClick={() => openEditModal(inq)}
                            className="p-1 text-slate-600 hover:text-purple-700 transition-colors"
                            title="Editar"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          {/* Dar de baja (solo si está activo) */}
                          {inq.status !== 'INACTIVO' && (
                            <button
                              onClick={() => openBajaModal(inq)}
                              className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                              title="Dar de baja"
                            >
                              <LogOut className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={currentPage}
          totalItems={filteredInquilinos.length}
          pageSize={PAGE_SIZE}
          onPageChange={setCurrentPage}
          itemLabel="inquilinos"
        />
      </div>

      {/* MODAL VISUALIZADOR INLINE DE CONTRATO */}
      {showContractModal && viewingContract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/45 backdrop-blur-sm" onClick={() => setShowContractModal(false)} />
          
          <div className="bg-white border border-slate-200 w-full max-w-xl rounded-3xl overflow-hidden shadow-2xl z-10 flex flex-col max-h-[85vh] relative">
            
            {/* Overlay Watermark de copia digital */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center select-none overflow-hidden opacity-5 rotate-[-25deg]">
              <span className="text-4xl md:text-5xl font-black text-slate-900 tracking-widest whitespace-nowrap">
                Copia digital - Roomly SaaS
              </span>
            </div>

            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/60 z-10">
              <div>
                <h3 className="font-bold text-slate-950 text-sm">Contrato de Arrendamiento</h3>
                <p className="text-[10px] text-slate-400 font-mono">ID: #R-${viewingContract.id}</p>
              </div>
              <button onClick={() => setShowContractModal(false)} className="text-slate-400 hover:text-slate-900">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-650 leading-relaxed font-sans z-10">
              {viewingContracts.length > 1 && (
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contrato</label>
                  <select
                    value={viewingContract.id}
                    onChange={(e) => {
                      const selected = viewingContracts.find((contract) => contract.id === parseInt(e.target.value));
                      if (selected) setViewingContract(selected);
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-purple-650"
                  >
                    {viewingContracts.map((contract) => (
                      <option key={contract.id} value={contract.id}>
                        Contrato #{1000 + contract.id} - {contract.status} ({formatDateUTC(contract.startDate)} a {formatDateUTC(contract.endDate)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Alerta de firma digitalizada */}
              {viewingContract.signatureUrl ? (
                <div className="p-3 bg-emerald-50 border border-emerald-150 rounded-xl text-emerald-800 font-semibold flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Firmado digitalmente por {viewingContract.inquilinoName} el {formatDateUTC(viewingContract.startDate)}.</span>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-150 rounded-xl text-amber-800 font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Este contrato se encuentra PENDIENTE DE FIRMA por parte del inquilino.</span>
                </div>
              )}

              <div className="border border-slate-150 p-6 rounded-2xl bg-slate-50/50 space-y-4">
                <div className="text-center font-extrabold text-slate-900 uppercase">
                  CONTRATO DE ALQUILER DE HABITACIÓN
                </div>

                <p>
                  Por el presente documento, se formaliza el arriendo de la <strong>Habitación N° {viewingContract.roomNumber}</strong> en la propiedad <strong>{viewingContract.propertyName}</strong>, celebrado entre **Roomly Group** (El Arrendador) y <strong>{viewingContract.inquilinoName}</strong> (El Arrendatario).
                </p>

                {getContractServices(viewingContract).length > 0 && (
                  <p>
                    <strong>SERVICIOS INCLUIDOS:</strong> {getContractServices(viewingContract).join(', ')}.
                  </p>
                )}

                <p>
                  <strong>VIGENCIA:</strong> Inicia el <strong>{formatDateUTC(viewingContract.startDate)}</strong> y finaliza el <strong>{formatDateUTC(viewingContract.endDate)}</strong>.
                </p>

                <p>
                  <strong>RENTA PACTADA:</strong> S/. {viewingContract.amount.toFixed(2)} mensuales, neto. Se aplican penalizaciones de morosidad a partir del 5to día de retraso.
                </p>

                {/* Firma en el visualizador */}
                <div className="grid grid-cols-2 gap-4 border-t pt-4 mt-4">
                  <div className="text-center">
                    <div className="h-10 flex items-center justify-center border-b border-dashed">
                      {viewingContract.landlordSignatureUrl ? (
                        <img
                          src={getImageUrl(viewingContract.landlordSignatureUrl)}
                          alt="Firma Arrendador"
                          className="h-full object-contain"
                        />
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">[ Firma Digital ]</span>
                      )}
                    </div>
                    <span className="text-[10px] font-bold block mt-1 text-slate-700">El Arrendador</span>
                  </div>
                  <div className="text-center">
                    <div className="h-10 flex items-center justify-center border-b border-dashed">
                      {viewingContract.signatureUrl ? (
                        <img 
                          src={getImageUrl(viewingContract.signatureUrl)}
                          alt="Firma" 
                          className="h-full object-contain"
                        />
                      ) : (
                        <span className="text-[9px] text-rose-500 font-mono italic">[ Pendiente ]</span>
                      )}
                    </div>
                    <span className="text-[10px] font-bold block mt-1 text-slate-700">El Arrendatario</span>
                  </div>
                </div>
              </div>

            </div>

            <div className="flex justify-end p-4 border-t border-slate-100 bg-slate-50/50 z-10">
              <button
                onClick={() => setShowContractModal(false)}
                className="py-2 px-5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl"
              >
                Cerrar Contrato
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL CREAR / EDITAR */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          
          <div className="bg-white border border-slate-200 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl z-10 p-8 space-y-6">
            <div>
              <h3 className="text-2xl font-bold text-slate-900">
                {editingId ? 'Editar inquilino' : 'Agregar nuevo inquilino'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Completa la información del inquilino y selecciona la propiedad y cuarto que alquilará
              </p>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {/* DNI Y ESTADO */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">N° Documento (DNI/CE)</label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      placeholder="ej. 12345678"
                      value={documentVal}
                      onChange={(e) => handleDocumentChange(e.target.value)}
                      className="flex-1 min-w-0 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-650 transition-colors"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => handleBuscarDni()}
                      disabled={searchingDni || documentVal.length !== 8}
                      className="px-4 py-2.5 bg-[#A855F7] hover:bg-purple-650 disabled:bg-slate-100 text-white disabled:text-slate-400 text-xs font-bold rounded-xl transition-all shadow-sm"
                    >
                      {searchingDni ? '...' : 'Buscar'}
                    </button>
                  </div>
                  {dniError && (
                    <p className="text-[10px] text-red-500 mt-1 font-medium">{dniError}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">Estado de inquilino</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-650"
                  >
                    <option value="ACTIVO">ACTIVO</option>
                    <option value="MOROSO">MOROSO</option>
                    <option value="INACTIVO">INACTIVO</option>
                  </select>
                </div>
              </div>

              {/* NOMBRE COMPLETO */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Nombre completo</label>
                <input
                  type="text"
                  placeholder="ej. Juan Pérez"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-650 transition-colors"
                  required
                />
              </div>

              {/* CORREO Y TELEFONO */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">Correo Electrónico</label>
                  <input
                    type="email"
                    placeholder="ej. juan.perez@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-650 transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">Teléfono</label>
                  <input
                    type="text"
                    placeholder="ej. 987 654 321"
                    value={phone}
                    maxLength={13}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 9);
                      const formatted = new AsYouType('PE').input(digits);
                      setPhoneError(null);
                      setPhone(formatted);
                    }}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-650 transition-colors"
                  />
                  {phoneError && (
                    <p className="text-[10px] text-red-500 mt-1 font-medium">{phoneError}</p>
                  )}
                </div>
              </div>

              <hr className="border-slate-100" />

              {/* SELECCIONAR PROPIEDAD */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Selecciona propiedad</label>
                <select
                  value={selectedPropertyId}
                  onChange={(e) => setSelectedPropertyId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-650"
                >
                  <option value="">-- Elige una propiedad --</option>
                  {properties.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* INFO DE LA PROPIEDAD SELECCIONADA */}
              {selectedPropertyId && (
                <div className="bg-[#FAF4FF] border border-purple-100 p-4 rounded-2xl">
                  <p className="font-extrabold text-[#A855F7] text-sm">
                    {properties.find(p => p.id === parseInt(selectedPropertyId))?.name}
                  </p>
                  <p className="text-xs text-purple-600 font-bold mt-1">
                    Cuartos disponibles: {availableRoomsForSelection.length}
                  </p>
                </div>
              )}

              {/* SELECCIONAR CUARTO Y FECHA */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">Selecciona cuarto disponible</label>
                  <select
                    value={selectedRoomId}
                    onChange={(e) => setSelectedRoomId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-650"
                    disabled={!selectedPropertyId || loadingRooms}
                  >
                    <option value="">-- Elige un cuarto --</option>
                    {availableRoomsForSelection.map(r => (
                      <option key={r.id} value={r.id}>
                        Cuarto {r.roomNumber} (S/. {r.price}/mes)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">Fecha de entrada</label>
                  <input
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-650 font-mono"
                  />
                </div>
              </div>

              {!editingId && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">Duración del contrato (meses)</label>
                    <input
                      type="number"
                      min="1"
                      placeholder="ej. 12"
                      value={contractMonths}
                      onChange={(e) => setContractMonths(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-650 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">Día de cobro (opcional)</label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      placeholder="ej. 5"
                      value={diaCobro}
                      onChange={(e) => setDiaCobro(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-650 font-mono"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Si no se especifica, se usa el día de la fecha de entrada.</p>
                  </div>
                </div>
              )}

              {/* ACCIONES */}
              <div className="grid grid-cols-2 gap-4 pt-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-[#A855F7] hover:bg-purple-650 text-white text-sm font-bold rounded-xl shadow-sm disabled:opacity-50 transition-all active:scale-[0.98]"
                >
                  {submitting ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Agregar Inquilino'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="w-full py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-bold rounded-xl transition-colors text-center"
                >
                  Cancelar
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
      {showCredentialsModal && createdCredentials && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCredentialsModal(false)} />
          
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl z-10 p-8 space-y-6">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Inquilino Registrado</h3>
                <p className="text-xs text-slate-505 mt-1">
                  Se han generado las credenciales temporales de acceso para el inquilino
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl space-y-3.5">
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Usuario (Correo)</span>
                  <div className="flex justify-between items-center bg-white border border-slate-200 rounded-xl p-3 text-xs font-mono text-slate-805">
                    <span className="truncate mr-2">{createdCredentials.email}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(createdCredentials.email, 'Usuario')}
                      className="text-purple-600 hover:text-purple-700 font-bold shrink-0 text-[10px]"
                    >
                      Copiar
                    </button>
                  </div>
                </div>

                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Contraseña Temporal</span>
                  <div className="flex justify-between items-center bg-white border border-slate-200 rounded-xl p-3 text-xs font-mono text-slate-850">
                    <span>{createdCredentials.tempPassword || 'Roomly-1234'}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(createdCredentials.tempPassword || 'Roomly-1234', 'Contraseña')}
                      className="text-purple-600 hover:text-purple-700 font-bold shrink-0 text-[10px]"
                    >
                      Copiar
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-3.5 bg-purple-50 text-purple-700 border border-purple-100 rounded-xl text-[10px] text-center font-medium leading-normal">
                Estas credenciales ya se enviaron al inquilino por mensaje interno de Roomly (sección Mensajes). También puedes compartirlas por otro medio para su primer inicio de sesión.
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowCredentialsModal(false)}
              className="w-full py-3 bg-[#A855F7] hover:bg-purple-650 text-white text-xs font-bold rounded-xl shadow-sm transition-all text-center"
            >
              Cerrar y continuar
            </button>
          </div>
        </div>
      )}

      {/* MODAL DAR DE BAJA (PROCESO DE SALIDA) */}
      {bajaInquilino && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setBajaInquilino(null)} />

          <div className="bg-white border border-slate-200 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl z-10 p-8 space-y-6">
            <div>
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <LogOut className="w-5 h-5 text-red-600" />
                Dar de baja a {bajaInquilino.name}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Se liberará su habitación y se registrará el evento en su historial. El inquilino quedará como INACTIVO, conservando sus pagos y contratos previos.
              </p>
            </div>

            <form onSubmit={handleConfirmBaja} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Fecha de mudanza / salida</label>
                <input
                  type="date"
                  value={moveOutDate}
                  onChange={(e) => setMoveOutDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-650 font-mono"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Motivo de salida</label>
                <textarea
                  rows={3}
                  value={moveOutReason}
                  onChange={(e) => setMoveOutReason(e.target.value)}
                  placeholder="Ej. fin de contrato, cambio de ciudad, incumplimiento de pago..."
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-650 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-1">
                <button
                  type="submit"
                  disabled={submittingBaja}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl shadow-sm disabled:opacity-50 transition-all active:scale-[0.98]"
                >
                  {submittingBaja ? 'Procesando...' : 'Confirmar baja'}
                </button>
                <button
                  type="button"
                  onClick={() => setBajaInquilino(null)}
                  className="w-full py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-bold rounded-xl transition-colors text-center"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CAMBIAR DE HABITACIÓN */}
      {transferInquilino && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setTransferInquilino(null)} />

          <div className="bg-white border border-slate-200 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl z-10 p-8 space-y-6">
            <div>
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-amber-600" />
                Cambiar de habitación a {transferInquilino.name}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Elige la propiedad (puede ser un edificio distinto de tu portafolio) y el cuarto destino. Se cerrará el contrato actual y se generará uno nuevo pendiente de firma.
              </p>
            </div>

            <form onSubmit={handleConfirmTransfer} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Propiedad destino</label>
                <select
                  value={transferPropertyId}
                  onChange={(e) => setTransferPropertyId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-650"
                  required
                >
                  <option value="">-- Elige una propiedad --</option>
                  {properties.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Cuarto disponible</label>
                <select
                  value={transferRoomId}
                  onChange={(e) => setTransferRoomId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-650"
                  disabled={!transferPropertyId || loadingTransferRooms}
                  required
                >
                  <option value="">-- Elige un cuarto --</option>
                  {transferRooms.filter(r => r.status === 'Disponible').map(r => (
                    <option key={r.id} value={r.id}>
                      Cuarto {r.roomNumber} (S/. {r.price}/mes)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">Fecha del cambio</label>
                  <input
                    type="date"
                    value={transferDate}
                    onChange={(e) => setTransferDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-650 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">Motivo del cambio</label>
                  <input
                    type="text"
                    value={transferReason}
                    onChange={(e) => setTransferReason(e.target.value)}
                    placeholder="Ej. solicitud del inquilino"
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-650"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-1">
                <button
                  type="submit"
                  disabled={submittingTransfer || !transferRoomId}
                  className="w-full py-3 bg-[#A855F7] hover:bg-purple-650 text-white text-sm font-bold rounded-xl shadow-sm disabled:opacity-50 transition-all active:scale-[0.98]"
                >
                  {submittingTransfer ? 'Procesando...' : 'Confirmar cambio'}
                </button>
                <button
                  type="button"
                  onClick={() => setTransferInquilino(null)}
                  className="w-full py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-bold rounded-xl transition-colors text-center"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL HISTORIAL DEL INQUILINO */}
      {historialInquilino && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setHistorialInquilino(null)} />

          <div className="bg-white border border-slate-200 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl z-10 flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/60">
              <div>
                <h3 className="font-bold text-slate-950 text-sm flex items-center gap-1.5">
                  <History className="w-4 h-4 text-indigo-600" />
                  Historial de {historialInquilino.name}
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Altas, cambios de habitación y salidas registradas</p>
              </div>
              <button onClick={() => setHistorialInquilino(null)} className="text-slate-400 hover:text-slate-900">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {loadingHistorial ? (
                <p className="text-xs text-slate-400 text-center py-8">Cargando historial...</p>
              ) : historialEventos.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">Aún no hay eventos registrados para este inquilino.</p>
              ) : (
                <ol className="space-y-4 border-l-2 border-slate-100 pl-4">
                  {historialEventos.map((evt) => (
                    <li key={evt.id} className="relative">
                      <span className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full ${
                        evt.type === 'BAJA' ? 'bg-red-500' : evt.type === 'CAMBIO_HABITACION' ? 'bg-amber-500' : 'bg-emerald-500'
                      }`} />
                      <p className="text-xs font-bold text-slate-800">{historialLabel(evt.type)}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{formatDateUTC(evt.eventDate)}</p>
                      {evt.type === 'CAMBIO_HABITACION' && (
                        <p className="text-[11px] text-slate-600 mt-1">
                          {evt.fromRoomNumber ? `Cuarto ${evt.fromRoomNumber} (${evt.fromPropertyName})` : 'Sin habitación previa'}
                          {' → '}
                          Cuarto {evt.toRoomNumber} ({evt.toPropertyName})
                        </p>
                      )}
                      {evt.type === 'BAJA' && evt.fromRoomNumber && (
                        <p className="text-[11px] text-slate-600 mt-1">
                          Salió de Cuarto {evt.fromRoomNumber} ({evt.fromPropertyName})
                        </p>
                      )}
                      {evt.reason && (
                        <p className="text-[11px] text-slate-500 italic mt-1">"{evt.reason}"</p>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div className="flex justify-end p-4 border-t border-slate-100 bg-slate-50/50">
              <button
                onClick={() => setHistorialInquilino(null)}
                className="py-2 px-5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
