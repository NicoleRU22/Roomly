import React, { useEffect, useState, useRef } from 'react';
import api from '../../../core/services/api';
import { useAuthStore } from '../../../features/auth/store/useAuthStore';
import { Plus, Trash2, FileText, Check, Clock, DollarSign, Download, Upload, Eye, Printer, AlertTriangle, CheckCircle, XCircle, Search, RefreshCw } from 'lucide-react';
import { ConfirmModal } from '../../../core/components/ui/ConfirmModal';
import { Pagination } from '../../../core/components/ui/Pagination';
import * as XLSX from 'xlsx';

interface Payment {
  id: number;
  inquilinoId: number;
  inquilinoName: string;
  roomId?: number;
  roomNumber?: string;
  amount: number;
  amountPaid: number;
  delayPenalty: number;
  dueDate: string;
  lastPaymentDate?: string;
  status: string; // PENDIENTE, PAGADO, PAGADO_PARCIAL, VENCIDO, CANCELADO
  paymentType: string; // ALQUILER, SERVICIO
  description?: string;
  receiptReference?: string;
  receiptImageUrl?: string;
  receiptStatus?: string; // PENDIENTE, APROBADO, RECHAZADO
  rejectionReason?: string;
}

interface Inquilino {
  id: number;
  name: string;
  roomId?: number;
  roomNumber?: string;
  roomPrice?: number;
}

interface Servicio {
  id: number;
  name: string;
  cost: number;
  tipo: string;
}

const PAGE_SIZE = 8;

export const Pagos: React.FC = () => {
  const { user } = useAuthStore();
  const isTenant = user?.role === 'INQUILINO';

  const [payments, setPayments] = useState<Payment[]>([]);
  const [inquilinos, setInquilinos] = useState<Inquilino[]>([]);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pestañas Propietario: 'recibos' | 'validaciones' | 'deudas'
  const [activeTab, setActiveTab] = useState<'recibos' | 'validaciones' | 'deudas'>('recibos');

  // Estados Modal Registrar Pago Manual (Propietario)
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [amountToAdd, setAmountToAdd] = useState('');
  const [receiptReference, setReceiptReference] = useState('');

  // Estados Modal Registrar Pago por Inquilino (Subir Comprobante)
  const [showTenantUploadModal, setShowTenantUploadModal] = useState(false);
  const [tenantPaymentToPay, setTenantPaymentToPay] = useState<Payment | null>(null);
  const [uploadReference, setUploadReference] = useState('');
  const [uploadImageBase64, setUploadImageBase64] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados Modal Generar Factura/Cobro (Propietario)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedInquilinoId, setSelectedInquilinoId] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [paymentType, setPaymentType] = useState('ALQUILER');
  const [description, setDescription] = useState('');
  
  // Servicios Adicionales en Modal de Generación
  const [selectedServiceIds, setSelectedServiceIds] = useState<number[]>([]);
  const [showServicesList, setShowServicesList] = useState(false);

  // Estado Drawer/Modal de Historial (Timeline)
  const [showTimelineDrawer, setShowTimelineDrawer] = useState(false);
  const [timelineTenantId, setTimelineTenantId] = useState<number | null>(null);
  const [timelineTenantName, setTimelineTenantName] = useState('');

  // Estado Lightbox / Visualizar Comprobante
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);

  // Estados Modal de Rechazo Comprobante (Propietario)
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectPaymentId, setRejectPaymentId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [deletePaymentId, setDeletePaymentId] = useState<number | null>(null);
  const [tenantPaymentsPage, setTenantPaymentsPage] = useState(1);
  const [ownerPaymentsPage, setOwnerPaymentsPage] = useState(1);
  const [debtsPage, setDebtsPage] = useState(1);

  // Estados de Filtro/Búsqueda de Pagos (Propietario)
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');

  // Estados de Selección/Acciones Masivas (Propietario)
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<Set<number>>(new Set());
  const [selectedValidationIds, setSelectedValidationIds] = useState<Set<number>>(new Set());
  const [selectedDebtIds, setSelectedDebtIds] = useState<Set<number>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [runningRecurring, setRunningRecurring] = useState(false);

  const toggleSelection = (setFn: React.Dispatch<React.SetStateAction<Set<number>>>, id: number) => {
    setFn(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (setFn: React.Dispatch<React.SetStateAction<Set<number>>>, ids: number[], allSelected: boolean) => {
    setFn(allSelected ? new Set() : new Set(ids));
  };

  const getApiUrl = () => {
    return import.meta.env.VITE_API_URL || 'http://localhost:3001';
  };

  const getImageUrl = (path?: string) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `${getApiUrl()}${path}`;
  };

  const fetchPaymentsAndInquilinos = async () => {
    setLoading(true);
    setError(null);
    try {
      const [payRes, inqRes, servRes] = await Promise.all([
        api.get('/payments'),
        isTenant ? Promise.resolve({ data: [] }) : api.get('/inquilinos'),
        isTenant ? Promise.resolve({ data: [] }) : api.get('/servicios')
      ]);
      setPayments(payRes.data);
      if (!isTenant) {
        setInquilinos(inqRes.data);
        setServicios(servRes.data);
      }
    } catch (err: any) {
      console.error('Error fetching payments data:', err);
      setError('No se pudo cargar la información de pagos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPaymentsAndInquilinos();
  }, []);

  // Autocompletado inteligente del Monto al seleccionar Inquilino
  const handleInquilinoSelect = (idStr: string) => {
    setSelectedInquilinoId(idStr);
    setSelectedServiceIds([]); // reset servicios
    if (idStr) {
      const inq = inquilinos.find(i => i.id === parseInt(idStr));
      if (inq && inq.roomPrice) {
        setAmount(String(inq.roomPrice));
        setPaymentType('ALQUILER');
      } else {
        setAmount('');
      }
    } else {
      setAmount('');
    }
  };

  // Toggle servicio adicional
  const handleToggleService = (id: number) => {
    setSelectedServiceIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Suma de servicios adicionales seleccionados
  const getSelectedServicesCost = () => {
    return servicios
      .filter(s => selectedServiceIds.includes(s.id))
      .reduce((sum, s) => sum + s.cost, 0);
  };

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInquilinoId || !amount || !dueDate) return;
    setSubmitting(true);
    setError(null);

    const inq = inquilinos.find(i => i.id === parseInt(selectedInquilinoId));
    
    // Sumar servicios al monto final
    const baseAmountValue = parseFloat(amount);
    const servicesCost = getSelectedServicesCost();
    const finalAmount = baseAmountValue + servicesCost;

    // Generar descripción combinada
    const chosenServices = servicios.filter(s => selectedServiceIds.includes(s.id));
    let finalDescription = description;
    if (chosenServices.length > 0) {
      const servicesStr = chosenServices.map(s => s.name).join(', ');
      finalDescription = finalDescription 
        ? `${finalDescription} (Incluye: ${servicesStr})`
        : `Renta + Servicios (${servicesStr})`;
    }

    const payload = {
      inquilinoId: parseInt(selectedInquilinoId),
      roomId: inq?.roomId || null,
      amount: finalAmount,
      dueDate,
      paymentType,
      description: finalDescription || undefined
    };

    try {
      await api.post('/payments', payload);
      setShowCreateModal(false);
      setSelectedInquilinoId('');
      setAmount('');
      setDueDate('');
      setPaymentType('ALQUILER');
      setDescription('');
      setSelectedServiceIds([]);
      setShowServicesList(false);
      fetchPaymentsAndInquilinos();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al crear la orden de cobro.');
    } finally {
      setSubmitting(false);
    }
  };

  const openCollectModal = (pay: Payment) => {
    setSelectedPayment(pay);
    const pending = (pay.amount - pay.amountPaid) + pay.delayPenalty;
    setAmountToAdd(String(pending));
    setReceiptReference(pay.receiptReference || '');
    setShowCollectModal(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayment || !amountToAdd) return;
    setSubmitting(true);
    setError(null);

    try {
      await api.put(`/payments/${selectedPayment.id}/record`, {
        amountToAdd: parseFloat(amountToAdd),
        receiptReference
      });
      setShowCollectModal(false);
      fetchPaymentsAndInquilinos();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al registrar el cobro.');
    } finally {
      setSubmitting(false);
    }
  };

  const openTenantUploadModal = (pay: Payment) => {
    setTenantPaymentToPay(pay);
    setUploadReference(pay.receiptReference || '');
    setUploadImageBase64(null);
    setShowTenantUploadModal(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadImageBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTenantUploadReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantPaymentToPay || !uploadImageBase64) return;
    setSubmitting(true);
    setError(null);

    try {
      await api.put(`/payments/${tenantPaymentToPay.id}/record`, {
        receiptReference: uploadReference,
        receiptImage: uploadImageBase64
      });
      setShowTenantUploadModal(false);
      fetchPaymentsAndInquilinos();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al subir el comprobante.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprovePayment = async (id: number) => {
    setError(null);
    try {
      await api.put(`/payments/${id}/approve`);
      fetchPaymentsAndInquilinos();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al aprobar el pago.');
    }
  };

  const openRejectModal = (id: number) => {
    setRejectPaymentId(id);
    setRejectReason('');
    setShowRejectModal(true);
  };

  const handleRejectPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rejectPaymentId === null) return;
    setSubmitting(true);
    setError(null);

    try {
      await api.put(`/payments/${rejectPaymentId}/reject`, {
        reason: rejectReason
      });
      setShowRejectModal(false);
      fetchPaymentsAndInquilinos();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al rechazar el pago.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    setDeletePaymentId(id);
  };

  const confirmDeletePayment = async () => {
    if (deletePaymentId === null) return;
    try {
      await api.delete(`/payments/${deletePaymentId}`);
      setDeletePaymentId(null);
      fetchPaymentsAndInquilinos();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al eliminar el cobro.');
    }
  };

  const formatDate = (dateStr: string | Date | undefined) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const getFechaPago = (pay: Payment) => {
    if (pay.status !== 'PAGADO') return '-';
    if (pay.lastPaymentDate) return formatDate(pay.lastPaymentDate);
    const d = new Date(pay.dueDate);
    d.setDate(d.getDate() - 4);
    return formatDate(d);
  };

  // Helper de Impresión del Recibo
  const handlePrintReceipt = (pay: Payment) => {
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) return;
    const html = `
      <html>
        <head>
          <title>Recibo de Pago #${pay.id}</title>
          <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
          <style>
            body { font-family: 'Inter', sans-serif; padding: 40px; color: #1e293b; }
            .receipt-container { border: 2px solid #e2e8f0; border-radius: 16px; padding: 32px; max-width: 600px; margin: 0 auto; }
            .stamp { border: 3px solid #10b981; color: #10b981; font-weight: 800; text-transform: uppercase; font-size: 24px; padding: 8px 16px; display: inline-block; transform: rotate(-5deg); border-radius: 8px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="receipt-container">
            <div class="flex justify-between items-center border-b pb-6">
              <div>
                <h1 class="text-2xl font-black text-purple-600">Roomly</h1>
                <p class="text-xs text-slate-500 font-medium">Gestión de Alquileres Inteligente</p>
              </div>
              <div class="text-right">
                <h2 class="text-lg font-bold text-slate-900">RECIBO DE PAGO</h2>
                <p class="text-xs text-slate-500 font-mono">Nro: #R-${pay.id}</p>
              </div>
            </div>
            <div class="my-6 space-y-3">
              <p class="text-sm"><span class="font-semibold text-slate-700">Inquilino:</span> ${pay.inquilinoName}</p>
              <p class="text-sm"><span class="font-semibold text-slate-700">Habitación:</span> ${pay.roomNumber || 'N/A'}</p>
              <p class="text-sm"><span class="font-semibold text-slate-700">Concepto:</span> ${pay.paymentType} - ${pay.description || 'Renta regular'}</p>
              <p class="text-sm"><span class="font-semibold text-slate-700">Fecha Vencimiento:</span> ${formatDate(pay.dueDate)}</p>
              <p class="text-sm"><span class="font-semibold text-slate-700">Fecha de Pago:</span> ${getFechaPago(pay)}</p>
              ${pay.receiptReference ? `<p class="text-sm"><span class="font-semibold text-slate-700">Referencia:</span> ${pay.receiptReference}</p>` : ''}
            </div>
            <div class="border-t border-b py-4 my-6">
              <div class="flex justify-between text-sm py-1">
                <span class="text-slate-500">Monto Base:</span>
                <span class="font-mono font-semibold">S/. ${pay.amount.toFixed(2)}</span>
              </div>
              ${pay.delayPenalty > 0 ? `
              <div class="flex justify-between text-sm py-1 text-red-650">
                <span class="text-red-500 font-semibold">Mora por Retraso:</span>
                <span class="font-mono text-red-600 font-semibold">+S/. ${pay.delayPenalty.toFixed(2)}</span>
              </div>
              ` : ''}
              <div class="flex justify-between text-base font-bold pt-2 border-t mt-2">
                <span class="text-slate-800">Total Cancelado:</span>
                <span class="font-mono text-purple-700 text-lg">S/. ${pay.amountPaid.toFixed(2)}</span>
              </div>
            </div>
            <div class="text-center pt-4">
              <div class="stamp">PAGADO</div>
              <p class="text-[10px] text-slate-400 mt-6">Gracias por su pago. Comprobante de pago verificado digitalmente.</p>
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Exportar reporte de pagos como archivo Excel (todos, o solo los seleccionados si se pasa una lista)
  const handleExportPayments = (list: Payment[] = payments) => {
    const rows = list.map(p => ({
      ID: p.id,
      Inquilino: p.inquilinoName,
      Habitacion: p.roomNumber || 'N/A',
      Concepto: p.paymentType,
      Descripcion: p.description || '',
      'Monto Base': p.amount,
      Mora: p.delayPenalty,
      Pagado: p.amountPaid,
      Vencimiento: formatDate(p.dueDate),
      'Fecha Pago': p.status === 'PAGADO' ? getFechaPago(p) : 'N/A',
      Estado: p.status,
      'Estado Comprobante': p.receiptStatus || ''
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Pagos');
    XLSX.writeFile(workbook, `reporte-pagos-roomly-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Agrupamiento por inquilino para deudas
  const getTenantDebts = () => {
    const map = new Map<number, {
      id: number;
      name: string;
      roomNumber?: string;
      unpaidCount: number;
      totalDebt: number;
      status: string;
    }>();

    inquilinos.forEach(inq => {
      map.set(inq.id, {
        id: inq.id,
        name: inq.name,
        roomNumber: inq.roomNumber,
        unpaidCount: 0,
        totalDebt: 0,
        status: 'ACTIVO'
      });
    });

    payments.forEach(pay => {
      if (pay.status !== 'PAGADO' && pay.status !== 'CANCELADO') {
        const debt = (pay.amount - pay.amountPaid) + pay.delayPenalty;
        const record = map.get(pay.inquilinoId);
        if (record) {
          record.unpaidCount += 1;
          record.totalDebt += debt;
          if (pay.status === 'VENCIDO') {
            record.status = 'MOROSO';
          }
        }
      }
    });

    return Array.from(map.values());
  };

  // Abrir historial timeline drawer
  const handleOpenTimeline = (inqId: number, inqName: string) => {
    setTimelineTenantId(inqId);
    setTimelineTenantName(inqName);
    setShowTimelineDrawer(true);
  };

  // KPIs
  const paymentsPaid = payments.filter(p => p.status === 'PAGADO');
  const totalCobrado = paymentsPaid.reduce((sum, p) => sum + p.amountPaid, 0);
  const pagosCobradosCount = paymentsPaid.length;

  const paymentsPending = payments.filter(p => p.status !== 'PAGADO' && p.status !== 'CANCELADO');
  const totalPendiente = paymentsPending.reduce((sum, p) => sum + ((p.amount - p.amountPaid) + p.delayPenalty), 0);
  const pagosPendientesCount = paymentsPending.length;

  const totalSum = totalCobrado + totalPendiente;
  const tasaCobranza = totalSum > 0 ? Math.round((totalCobrado / totalSum) * 100) : 0;

  // KPIs Inquilino
  const myPaidPayments = payments.filter(p => p.status === 'PAGADO');
  const tenantTotalPaid = myPaidPayments.reduce((sum, p) => sum + p.amountPaid, 0);
  const tenantPaidCount = myPaidPayments.length;

  const myPendingPayments = payments.filter(p => p.status !== 'PAGADO' && p.status !== 'CANCELADO');
  const tenantTotalPending = myPendingPayments.reduce((sum, p) => sum + ((p.amount - p.amountPaid) + p.delayPenalty), 0);
  const tenantPendingCount = myPendingPayments.length;
  const tenantTotalPenalty = myPendingPayments.reduce((sum, p) => sum + p.delayPenalty, 0);

  const pendingValidationsCount = payments.filter(p => p.receiptStatus === 'PENDIENTE' && p.receiptImageUrl).length;
  const tenantDebts = getTenantDebts();

  // Filtrado de Pagos para Propietario
  const filteredPayments = payments.filter(p => {
    const matchesSearch = p.inquilinoName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (p.roomNumber && p.roomNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (p.receiptReference && p.receiptReference.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (p.paymentType && p.paymentType.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = filterStatus === '' || p.status === filterStatus;
    const matchesType = filterType === '' || p.paymentType === filterType;
    return matchesSearch && matchesStatus && matchesType;
  });

  const filteredValidations = filteredPayments.filter(p => p.receiptStatus === 'PENDIENTE' && p.receiptImageUrl);

  const filteredDebts = tenantDebts.filter(d => {
    const matchesSearch = d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (d.roomNumber && d.roomNumber.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesSearch;
  });

  const tenantPaymentsTotalPages = Math.max(1, Math.ceil(payments.length / PAGE_SIZE));
  const ownerPaymentsTotalPages = Math.max(
    1, 
    Math.ceil((activeTab === 'recibos' ? filteredPayments.length : activeTab === 'validaciones' ? filteredValidations.length : filteredDebts.length) / PAGE_SIZE)
  );
  const debtsTotalPages = Math.max(1, Math.ceil(filteredDebts.length / PAGE_SIZE));

  const paginatedTenantPayments = payments.slice((tenantPaymentsPage - 1) * PAGE_SIZE, tenantPaymentsPage * PAGE_SIZE);
  
  const paginatedOwnerPayments = activeTab === 'recibos'
    ? filteredPayments.slice((ownerPaymentsPage - 1) * PAGE_SIZE, ownerPaymentsPage * PAGE_SIZE)
    : filteredValidations.slice((ownerPaymentsPage - 1) * PAGE_SIZE, ownerPaymentsPage * PAGE_SIZE);
    
  const paginatedTenantDebts = filteredDebts.slice((debtsPage - 1) * PAGE_SIZE, debtsPage * PAGE_SIZE);

  useEffect(() => {
    if (tenantPaymentsPage > tenantPaymentsTotalPages) setTenantPaymentsPage(tenantPaymentsTotalPages);
    if (ownerPaymentsPage > ownerPaymentsTotalPages) setOwnerPaymentsPage(ownerPaymentsTotalPages);
    if (debtsPage > debtsTotalPages) setDebtsPage(debtsTotalPages);
  }, [tenantPaymentsPage, tenantPaymentsTotalPages, ownerPaymentsPage, ownerPaymentsTotalPages, debtsPage, debtsTotalPages]);

  useEffect(() => {
    setOwnerPaymentsPage(1);
    setDebtsPage(1);
    setSelectedPaymentIds(new Set());
    setSelectedValidationIds(new Set());
    setSelectedDebtIds(new Set());
  }, [activeTab]);

  // Marcar como pagado completo (mora + saldo) los recibos seleccionados
  const handleBulkMarkPaid = async () => {
    if (selectedPaymentIds.size === 0) return;
    setBulkProcessing(true);
    try {
      await Promise.all(Array.from(selectedPaymentIds).map(id => {
        const pay = payments.find(p => p.id === id);
        if (!pay || pay.status === 'PAGADO' || pay.status === 'CANCELADO') return Promise.resolve();
        const pending = (pay.amount - pay.amountPaid) + pay.delayPenalty;
        return api.put(`/payments/${id}/record`, { amountToAdd: pending });
      }));
      setSelectedPaymentIds(new Set());
      fetchPaymentsAndInquilinos();
    } catch (err: any) {
      setError('Error al marcar los recibos seleccionados como pagados.');
    } finally {
      setBulkProcessing(false);
    }
  };

  // Aprobar en bloque los comprobantes seleccionados
  const handleBulkApproveValidations = async () => {
    if (selectedValidationIds.size === 0) return;
    setBulkProcessing(true);
    try {
      await Promise.all(Array.from(selectedValidationIds).map(id => api.put(`/payments/${id}/approve`)));
      setSelectedValidationIds(new Set());
      fetchPaymentsAndInquilinos();
    } catch (err: any) {
      setError('Error al aprobar los comprobantes seleccionados.');
    } finally {
      setBulkProcessing(false);
    }
  };

  // Forzar la generación de recibos de alquiler recurrentes (normalmente corre solo, 1 vez al día)
  const handleRunRecurring = async () => {
    setRunningRecurring(true);
    try {
      const res = await api.post('/payments/generate-recurring');
      alert(res.data.message);
      fetchPaymentsAndInquilinos();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al generar los cobros recurrentes.');
    } finally {
      setRunningRecurring(false);
    }
  };

  // Enviar recordatorio de deuda a los inquilinos seleccionados
  const handleBulkRemindDebts = async () => {
    if (selectedDebtIds.size === 0) return;
    setBulkProcessing(true);
    try {
      await Promise.all(Array.from(selectedDebtIds).map(id => api.post(`/payments/remind-debt/${id}`)));
      setSelectedDebtIds(new Set());
      alert('Recordatorios enviados con éxito.');
    } catch (err: any) {
      setError('Error al enviar los recordatorios seleccionados.');
    } finally {
      setBulkProcessing(false);
    }
  };

  if (loading && payments.length === 0) {
    return (
      <div className="flex items-center justify-center h-[50vh] text-slate-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-650 mr-3" />
        Cargando pagos...
      </div>
    );
  }

  // --- VISTA DEL INQUILINO ---
  if (isTenant) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center mb-2">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Mis Pagos y Facturas</h2>
            <p className="text-sm text-slate-500 font-medium">Sube tus comprobantes Yape o Transferencia y visualiza el historial de recibos.</p>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-650 flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* METRICAS INQUILINO */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-200 p-6 rounded-3xl flex items-center justify-between shadow-sm">
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Pagado</p>
              <h3 className="text-3xl font-extrabold text-slate-900">S/. {tenantTotalPaid.toFixed(2)}</h3>
              <p className="text-[11px] text-slate-400 font-semibold">En {tenantPaidCount} cuotas completadas</p>
            </div>
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center border border-emerald-100 shadow-sm">
              <CheckCircle className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white border border-slate-200 p-6 rounded-3xl flex items-center justify-between shadow-sm">
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Deuda Pendiente</p>
              <h3 className="text-3xl font-extrabold text-red-650">S/. {tenantTotalPending.toFixed(2)}</h3>
              <p className="text-[11px] text-slate-400 font-semibold">{tenantPendingCount} recibos pendientes</p>
            </div>
            <div className="w-12 h-12 bg-red-50 text-red-650 rounded-2xl flex items-center justify-center border border-red-100 shadow-sm">
              <Clock className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white border border-slate-200 p-6 rounded-3xl flex items-center justify-between shadow-sm">
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mora Acumulada</p>
              <h3 className="text-3xl font-extrabold text-slate-900">S/. {tenantTotalPenalty.toFixed(2)}</h3>
              <p className="text-[11px] text-slate-400 font-semibold">Recargos aplicados</p>
            </div>
            <div className="w-12 h-12 bg-purple-50 text-[#A855F7] rounded-2xl flex items-center justify-center border border-purple-100 shadow-sm">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* LISTADO DE PAGOS (INQUILINO) */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse border border-slate-200">
              <thead>
                <tr className="bg-[#DFCEFC] text-sm text-slate-800 font-bold border-b border-slate-200">
                  <th className="px-6 py-4 border-r border-slate-200">Concepto</th>
                  <th className="px-6 py-4 border-r border-slate-200">Monto</th>
                  <th className="px-6 py-4 border-r border-slate-200">Mora</th>
                  <th className="px-6 py-4 border-r border-slate-200">Vencimiento</th>
                  <th className="px-6 py-4 border-r border-slate-200">Estado</th>
                  <th className="px-6 py-4 border-r border-slate-200">Validación</th>
                  <th className="px-6 py-4">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm text-slate-700 bg-white">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      No tienes recibos generados asignados.
                    </td>
                  </tr>
                ) : (
                  paginatedTenantPayments.map((pay) => {
                    let statusLabel = 'Pendiente';
                    if (pay.status === 'PAGADO') statusLabel = 'Pagado';
                    else if (pay.status === 'VENCIDO') statusLabel = 'Vencido';
                    else if (pay.status === 'PAGADO_PARCIAL') statusLabel = 'Pago Parcial';

                    let receiptBadge = (
                      <span className="text-[10px] text-slate-400 bg-slate-50 border border-slate-100 rounded px-1.5 py-0.5">
                        Sin subir
                      </span>
                    );
                    if (pay.status === 'PAGADO') {
                      receiptBadge = (
                        <span className="text-[10px] text-emerald-650 bg-emerald-50 border border-emerald-150 rounded px-1.5 py-0.5 font-bold">
                          Aprobado
                        </span>
                      );
                    } else if (pay.receiptStatus === 'PENDIENTE') {
                      receiptBadge = (
                        <span className="text-[10px] text-indigo-650 bg-indigo-50 border border-indigo-150 rounded px-1.5 py-0.5 font-bold animate-pulse">
                          En validación
                        </span>
                      );
                    } else if (pay.receiptStatus === 'RECHAZADO') {
                      receiptBadge = (
                        <span className="text-[10px] text-red-650 bg-red-50 border border-red-150 rounded px-1.5 py-0.5 font-bold" title={pay.rejectionReason}>
                          Rechazado
                        </span>
                      );
                    }

                    return (
                      <tr key={pay.id} className="hover:bg-slate-50/30 transition-colors">
                        <td className="px-6 py-4 border-r border-slate-200">
                          <p className="font-bold text-slate-800">{pay.paymentType}</p>
                          {pay.description && <p className="text-[10px] text-slate-400 mt-0.5">{pay.description}</p>}
                          {pay.receiptStatus === 'RECHAZADO' && pay.rejectionReason && (
                            <p className="text-[9px] text-red-650 bg-red-50 p-1 border border-red-100 rounded-lg mt-1 font-semibold">
                              Motivo: {pay.rejectionReason}
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-4 font-mono font-bold text-slate-800 border-r border-slate-200">
                          S/. {pay.amount.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 font-mono text-slate-500 border-r border-slate-200 text-xs">
                          {pay.delayPenalty > 0 ? (
                            <span className="text-red-600 font-bold">+S/. {pay.delayPenalty.toFixed(2)}</span>
                          ) : 'S/. 0.00'}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-slate-500 border-r border-slate-200">
                          {formatDate(pay.dueDate)}
                        </td>
                        <td className="px-6 py-4 font-bold border-r border-slate-200 text-slate-700">
                          {statusLabel}
                        </td>
                        <td className="px-6 py-4 border-r border-slate-200">
                          {receiptBadge}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-2">
                            {pay.status !== 'PAGADO' && pay.receiptStatus !== 'PENDIENTE' && (
                              <button
                                onClick={() => openTenantUploadModal(pay)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#A855F7] hover:bg-purple-650 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                              >
                                <Upload className="w-3.5 h-3.5" />
                                Subir Comprobante
                              </button>
                            )}

                            {pay.receiptImageUrl && (
                              <button
                                onClick={() => setLightboxImageUrl(getImageUrl(pay.receiptImageUrl))}
                                className="p-1.5 text-slate-400 hover:text-purple-650 transition-colors border border-slate-200 rounded-lg bg-slate-50"
                                title="Ver comprobante"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {pay.status === 'PAGADO' && (
                              <button
                                onClick={() => handlePrintReceipt(pay)}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-650 border border-slate-250 rounded-xl text-xs font-bold transition-all"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                Imprimir Recibo
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
            currentPage={tenantPaymentsPage}
            totalItems={payments.length}
            pageSize={PAGE_SIZE}
            onPageChange={setTenantPaymentsPage}
            itemLabel="recibos"
          />
        </div>

        {/* MODAL INQUILINO: UPLOAD COMPROBANTE */}
        {showTenantUploadModal && tenantPaymentToPay && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowTenantUploadModal(false)} />
            <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl z-10 p-6 space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h3 className="text-md font-bold text-slate-900">Registrar Pago / Subir Comprobante</h3>
                <button onClick={() => setShowTenantUploadModal(false)} className="text-slate-400 hover:text-slate-900">✕</button>
              </div>

              <div className="text-xs space-y-1.5 p-3.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-600">
                <p><span className="font-semibold text-slate-800">Concepto:</span> {tenantPaymentToPay.paymentType}</p>
                <p><span className="font-semibold text-slate-800">Monto Base:</span> S/. {tenantPaymentToPay.amount.toFixed(2)}</p>
                {tenantPaymentToPay.delayPenalty > 0 && (
                  <p className="text-red-650 font-semibold"><span className="font-semibold">Mora:</span> +S/. {tenantPaymentToPay.delayPenalty.toFixed(2)}</p>
                )}
                <p className="font-bold text-purple-700 text-xs border-t pt-1.5 mt-1">
                  Monto a Pagar Total: S/. {(tenantPaymentToPay.amount - tenantPaymentToPay.amountPaid + tenantPaymentToPay.delayPenalty).toFixed(2)}
                </p>
              </div>

              <form onSubmit={handleTenantUploadReceipt} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">Foto del Comprobante (Yape / Transferencia)</label>
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    required={!uploadImageBase64}
                  />
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-200 hover:border-purple-300 rounded-xl p-6 text-center cursor-pointer transition-all bg-slate-50/50 hover:bg-slate-50 flex flex-col items-center justify-center gap-2"
                  >
                    <Upload className="w-6 h-6 text-slate-400" />
                    <span className="text-xs font-bold text-purple-600 hover:text-purple-700">Seleccionar Imagen</span>
                    <span className="text-[10px] text-slate-400">PNG, JPG, JPEG</span>
                  </div>

                  {uploadImageBase64 && (
                    <div className="mt-3 relative border border-slate-200 rounded-xl overflow-hidden max-h-48 bg-slate-50 flex items-center justify-center p-2">
                      <img 
                        src={uploadImageBase64} 
                        alt="Comprobante Seleccionado" 
                        className="max-h-44 object-contain rounded-lg"
                      />
                      <button 
                        type="button" 
                        onClick={() => setUploadImageBase64(null)} 
                        className="absolute top-2 right-2 bg-red-650 hover:bg-red-700 text-white rounded-full p-1.5 text-xs shadow-md"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">Referencia de Pago (Opcional)</label>
                  <input
                    type="text"
                    placeholder="ej: Yape Operación #987654 o Nro Operación BCP"
                    value={uploadReference}
                    onChange={(e) => setUploadReference(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-650"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowTenantUploadModal(false)}
                    className="py-2 px-4 bg-transparent border border-slate-200 hover:bg-slate-50 text-slate-500 text-xs font-semibold rounded-xl"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !uploadImageBase64}
                    className="py-2 px-4 bg-[#A855F7] hover:bg-purple-700 text-white text-xs font-semibold rounded-xl shadow-md disabled:opacity-50"
                  >
                    {submitting ? 'Subiendo...' : 'Registrar Pago'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* LIGHTBOX COMPROBANTE */}
        {lightboxImageUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setLightboxImageUrl(null)} />
            <div className="bg-white p-3 rounded-2xl max-w-2xl w-full relative z-10 flex flex-col items-center">
              <button 
                onClick={() => setLightboxImageUrl(null)} 
                className="absolute top-3 right-3 bg-slate-900/80 hover:bg-slate-900 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm shadow-md"
              >
                ✕
              </button>
              <img 
                src={lightboxImageUrl} 
                alt="Comprobante" 
                className="max-h-[80vh] w-auto object-contain rounded-lg shadow-inner"
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- VISTA DEL PROPIETARIO ---
  return (
    <div className="space-y-6">
      {/* Subheader */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-2">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Control Financiero y Pagos</h2>
          <p className="text-sm text-slate-500 font-medium">Genera recibos, valida vouchers de inquilinos y controla moras y deudas de habitaciones.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRunRecurring}
            disabled={runningRecurring}
            title="Los recibos de alquiler se generan solos cada día; usa esto para forzarlo ahora"
            className="flex items-center py-2 px-4 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${runningRecurring ? 'animate-spin' : ''}`} />
            {runningRecurring ? 'Generando...' : 'Generar Cobros del Mes'}
          </button>
          <button
            onClick={() => handleExportPayments()}
            className="flex items-center py-2 px-4 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all shadow-sm"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Exportar Excel
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center py-2.5 px-6 bg-[#A855F7] hover:bg-purple-650 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Generar Cobro
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-650 flex items-center space-x-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* MÉTRICAS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white border border-slate-200 p-6 rounded-3xl flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Recaudado</p>
            <h3 className="text-2xl font-extrabold text-slate-900">S/. {totalCobrado.toFixed(2)}</h3>
            <p className="text-[11px] text-slate-400 font-semibold">De {pagosCobradosCount} recibos cobrados</p>
          </div>
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center border border-emerald-100 shadow-sm">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-6 rounded-3xl flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pendiente</p>
            <h3 className="text-2xl font-extrabold text-slate-900">S/. {totalPendiente.toFixed(2)}</h3>
            <p className="text-[11px] text-slate-400 font-semibold">De {pagosPendientesCount} recibos pendientes</p>
          </div>
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center border border-amber-100 shadow-sm">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-6 rounded-3xl flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tasa de Cobranza</p>
            <h3 className="text-2xl font-extrabold text-[#A855F7]">{tasaCobranza}%</h3>
            <p className="text-[11px] text-slate-400 font-semibold">Rendimiento mensual</p>
          </div>
          <div className="w-12 h-12 bg-purple-50 text-[#A855F7] rounded-2xl flex items-center justify-center border border-purple-100 shadow-sm">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-6 rounded-3xl flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Vouchers pendientes</p>
            <h3 className={`text-2xl font-extrabold ${pendingValidationsCount > 0 ? 'text-indigo-650' : 'text-slate-900'}`}>{pendingValidationsCount}</h3>
            <p className="text-[11px] text-slate-400 font-semibold">Esperando aprobación</p>
          </div>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-sm ${pendingValidationsCount > 0 ? 'bg-indigo-50 border-indigo-100 text-indigo-600 animate-pulse' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
            <Upload className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* PESTAÑAS */}
      <div className="flex border-b border-slate-200 gap-6 text-sm">
        <button
          onClick={() => setActiveTab('recibos')}
          className={`pb-3 font-bold transition-all relative ${activeTab === 'recibos' ? 'text-purple-650 border-b-2 border-purple-650' : 'text-slate-500 hover:text-slate-800'}`}
        >
          Todos los Recibos
        </button>
        <button
          onClick={() => setActiveTab('validaciones')}
          className={`pb-3 font-bold transition-all relative flex items-center gap-1.5 ${activeTab === 'validaciones' ? 'text-purple-650 border-b-2 border-purple-650' : 'text-slate-500 hover:text-slate-800'}`}
        >
          Validación de Comprobantes
          {pendingValidationsCount > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] bg-indigo-600 text-white rounded-full font-bold">
              {pendingValidationsCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('deudas')}
          className={`pb-3 font-bold transition-all relative ${activeTab === 'deudas' ? 'text-purple-650 border-b-2 border-purple-650' : 'text-slate-500 hover:text-slate-800'}`}
        >
          Deuda por Inquilino
        </button>
      </div>

      {/* SECCIÓN DE FILTROS BÚSQUEDA DE PAGOS */}
      {!isTenant && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1.5">Búsqueda General</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar Inquilino, Habitación, Ref..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setOwnerPaymentsPage(1);
                  setDebtsPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-purple-650"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1.5">Estado Pago</label>
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setOwnerPaymentsPage(1);
              }}
              className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-purple-650"
            >
              <option value="">Todos los estados</option>
              <option value="PENDIENTE">PENDIENTE</option>
              <option value="PAGADO">PAGADO</option>
              <option value="PAGADO_PARCIAL">PAGADO_PARCIAL</option>
              <option value="VENCIDO">VENCIDO</option>
              <option value="CANCELADO">CANCELADO</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1.5">Tipo de Pago</label>
            <select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value);
                setOwnerPaymentsPage(1);
              }}
              className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-purple-650"
            >
              <option value="">Todos los tipos</option>
              <option value="ALQUILER">ALQUILER</option>
              <option value="SERVICIO">SERVICIO</option>
            </select>
          </div>

          <div>
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterStatus('');
                setFilterType('');
                setOwnerPaymentsPage(1);
                setDebtsPage(1);
              }}
              className="w-full py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
            >
              Limpiar Filtros
            </button>
          </div>
        </div>
      )}

      {/* CONTENIDO DE TAB RECIBOS (PROPIETARIO) */}
      {activeTab === 'recibos' && (
        <div className="space-y-3">
          {selectedPaymentIds.size > 0 && (
            <div className="flex items-center justify-between gap-3 bg-purple-50 border border-purple-150 rounded-2xl px-5 py-3">
              <span className="text-xs font-bold text-purple-700">{selectedPaymentIds.size} recibo(s) seleccionado(s)</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExportPayments(payments.filter(p => selectedPaymentIds.has(p.id)))}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  Exportar seleccionados
                </button>
                <button
                  onClick={handleBulkMarkPaid}
                  disabled={bulkProcessing}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  {bulkProcessing ? 'Procesando...' : 'Marcar como pagado'}
                </button>
                <button
                  onClick={() => setSelectedPaymentIds(new Set())}
                  className="text-xs font-bold text-slate-500 hover:underline px-2"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse border border-slate-200">
              <thead>
                <tr className="bg-[#DFCEFC] text-sm text-slate-800 font-bold border-b border-slate-200">
                  <th className="px-4 py-4 border-r border-slate-200 w-10">
                    <input
                      type="checkbox"
                      checked={paginatedOwnerPayments.length > 0 && paginatedOwnerPayments.every(p => selectedPaymentIds.has(p.id))}
                      onChange={() => toggleSelectAll(setSelectedPaymentIds, paginatedOwnerPayments.map(p => p.id), paginatedOwnerPayments.length > 0 && paginatedOwnerPayments.every(p => selectedPaymentIds.has(p.id)))}
                      className="w-4 h-4 accent-purple-650 cursor-pointer"
                    />
                  </th>
                  <th className="px-6 py-4 border-r border-slate-200">Inquilino</th>
                  <th className="px-6 py-4 border-r border-slate-200">Monto</th>
                  <th className="px-6 py-4 border-r border-slate-200">Mora</th>
                  <th className="px-6 py-4 border-r border-slate-200">Estado</th>
                  <th className="px-6 py-4 border-r border-slate-200">Comprobante</th>
                  <th className="px-6 py-4 border-r border-slate-200">Fecha Venc.</th>
                  <th className="px-6 py-4">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm text-slate-700 bg-white">
                {filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-slate-400">
                      No hay recibos de pagos que coincidan con la búsqueda.
                    </td>
                  </tr>
                ) : (
                  paginatedOwnerPayments.map((pay) => {
                    let statusClass = 'text-slate-700 font-bold';
                    let statusText = 'Pendiente';
                    if (pay.status === 'PAGADO') {
                      statusClass = 'text-emerald-600 font-bold';
                      statusText = 'Pagado';
                    } else if (pay.status === 'VENCIDO') {
                      statusClass = 'text-rose-600 font-bold';
                      statusText = 'Vencido';
                    } else if (pay.status === 'PAGADO_PARCIAL') {
                      statusClass = 'text-blue-600 font-bold';
                      statusText = 'Pago Parcial';
                    }

                    return (
                      <tr key={pay.id} className="hover:bg-slate-50/30 transition-colors border-b border-slate-200 last:border-0">
                        <td className="px-4 py-4 border-r border-slate-200">
                          <input
                            type="checkbox"
                            checked={selectedPaymentIds.has(pay.id)}
                            onChange={() => toggleSelection(setSelectedPaymentIds, pay.id)}
                            className="w-4 h-4 accent-purple-650 cursor-pointer"
                          />
                        </td>
                        {/* Inquilino (Clickeable abre timeline) */}
                        <td className="px-6 py-4 border-r border-slate-200 font-bold text-purple-650 hover:underline cursor-pointer" onClick={() => handleOpenTimeline(pay.inquilinoId, pay.inquilinoName)}>
                          {pay.inquilinoName}
                          {pay.roomNumber && <span className="block text-[10px] text-slate-400 font-normal">Cuarto: {pay.roomNumber}</span>}
                        </td>

                        {/* Monto */}
                        <td className="px-6 py-4 font-mono font-bold text-slate-800 border-r border-slate-200">
                          S/. {pay.amount.toFixed(2)}
                        </td>

                        {/* Mora */}
                        <td className="px-6 py-4 font-mono text-slate-500 border-r border-slate-200 text-xs">
                          {pay.delayPenalty > 0 ? (
                            <span className="text-rose-600 font-bold">+S/. {pay.delayPenalty.toFixed(2)}</span>
                          ) : 'S/. 0.00'}
                        </td>

                        {/* Estado */}
                        <td className="px-6 py-4 border-r border-slate-200">
                          <span className={statusClass}>{statusText}</span>
                        </td>

                        {/* Comprobante */}
                        <td className="px-6 py-4 border-r border-slate-200">
                          {pay.receiptImageUrl ? (
                            <div className="flex flex-col gap-1 items-start">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                pay.receiptStatus === 'PENDIENTE' ? 'bg-indigo-50 text-indigo-650 animate-pulse' :
                                pay.receiptStatus === 'APROBADO' ? 'bg-emerald-50 text-emerald-650' :
                                'bg-red-50 text-red-650'
                              }`}>
                                {pay.receiptStatus}
                              </span>
                              <button
                                onClick={() => setLightboxImageUrl(getImageUrl(pay.receiptImageUrl))}
                                className="text-[10px] text-purple-600 hover:text-purple-700 underline font-bold"
                              >
                                Ver Comprobante
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 bg-slate-50 border border-slate-100 rounded px-1.5 py-0.5">
                              Sin subir
                            </span>
                          )}
                        </td>

                        {/* Vencimiento */}
                        <td className="px-6 py-4 text-slate-550 font-mono text-xs border-r border-slate-200">
                          {formatDate(pay.dueDate)}
                        </td>

                        {/* Acciones */}
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-2">
                            {pay.status !== 'PAGADO' && pay.status !== 'CANCELADO' && (
                              <button
                                onClick={() => openCollectModal(pay)}
                                className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-150 rounded-lg text-[10px] font-bold transition-all shadow-sm"
                              >
                                Cobrar
                              </button>
                            )}
                            {pay.status === 'PAGADO' && (
                              <button
                                onClick={() => handlePrintReceipt(pay)}
                                className="p-1.5 text-slate-500 hover:text-purple-600 hover:bg-purple-50 transition-colors border border-slate-250 rounded-lg"
                                title="Imprimir Recibo"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(pay.id)}
                              className="p-1.5 text-slate-455 text-slate-400 hover:text-red-600 hover:bg-red-50 border border-slate-200 rounded-lg transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
          <Pagination
            currentPage={ownerPaymentsPage}
            totalItems={activeTab === 'recibos' ? filteredPayments.length : filteredValidations.length}
            pageSize={PAGE_SIZE}
            onPageChange={setOwnerPaymentsPage}
            itemLabel="recibos"
          />
          </div>
        </div>
      )}

      {/* VALIDACION DE COMPROBANTES */}
      {activeTab === 'validaciones' && (
        <div className="space-y-4">
          {selectedValidationIds.size > 0 && (
            <div className="flex items-center justify-between gap-3 bg-purple-50 border border-purple-150 rounded-2xl px-5 py-3">
              <span className="text-xs font-bold text-purple-700">{selectedValidationIds.size} comprobante(s) seleccionado(s)</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleBulkApproveValidations}
                  disabled={bulkProcessing}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  {bulkProcessing ? 'Procesando...' : 'Aprobar seleccionados'}
                </button>
                <button
                  onClick={() => setSelectedValidationIds(new Set())}
                  className="text-xs font-bold text-slate-500 hover:underline px-2"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
          {filteredValidations.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400">
              <CheckCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="font-bold text-slate-500 text-sm">No hay comprobantes pendientes de validación que coincidan.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredValidations.map((pay) => (
                <div key={pay.id} className={`bg-white border rounded-2xl shadow-sm p-5 flex flex-col md:flex-row gap-5 relative ${selectedValidationIds.has(pay.id) ? 'border-purple-400 ring-1 ring-purple-200' : 'border-slate-200'}`}>
                  <input
                    type="checkbox"
                    checked={selectedValidationIds.has(pay.id)}
                    onChange={() => toggleSelection(setSelectedValidationIds, pay.id)}
                    className="absolute top-4 right-4 w-4 h-4 accent-purple-650 cursor-pointer z-10"
                  />
                  <div
                    onClick={() => setLightboxImageUrl(getImageUrl(pay.receiptImageUrl))}
                    className="w-full md:w-32 h-44 bg-slate-50 border border-slate-200 rounded-xl overflow-hidden cursor-pointer relative group flex items-center justify-center flex-shrink-0"
                  >
                    <img 
                      src={getImageUrl(pay.receiptImageUrl)} 
                      alt="Voucher" 
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Eye className="w-6 h-6 text-white" />
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex justify-between items-start">
                        <h4 className="font-bold text-slate-800 text-base">{pay.inquilinoName}</h4>
                        <span className="text-xs px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-100 rounded-lg font-semibold font-mono">
                          Habit: {pay.roomNumber || 'N/A'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">Concepto: {pay.paymentType} - {pay.description || 'Renta regular'}</p>
                      
                      <div className="mt-2.5 space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-550">Monto Base:</span>
                          <span className="font-mono font-semibold text-slate-800">S/. {pay.amount.toFixed(2)}</span>
                        </div>
                        {pay.delayPenalty > 0 && (
                          <div className="flex justify-between text-red-650">
                            <span>Mora:</span>
                            <span className="font-mono font-bold">+S/. {pay.delayPenalty.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold border-t pt-1 mt-1 text-purple-700">
                          <span>Total por Validar:</span>
                          <span className="font-mono text-sm">S/. {(pay.amount + pay.delayPenalty).toFixed(2)}</span>
                        </div>
                      </div>

                      {pay.receiptReference && (
                        <div className="mt-3 px-2 py-1.5 bg-slate-50 border border-slate-100 text-[11px] text-slate-650 rounded-lg font-semibold font-mono">
                          REF: {pay.receiptReference}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => handleApprovePayment(pay.id)}
                        className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        Aprobar Pago
                      </button>
                      <button
                        onClick={() => openRejectModal(pay.id)}
                        className="py-2 px-3 bg-red-50 hover:bg-red-100 text-red-650 border border-red-150 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Rechazar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* DEUDAS POR INQUILINO */}
      {activeTab === 'deudas' && (
        <div className="space-y-3">
          {selectedDebtIds.size > 0 && (
            <div className="flex items-center justify-between gap-3 bg-purple-50 border border-purple-150 rounded-2xl px-5 py-3">
              <span className="text-xs font-bold text-purple-700">{selectedDebtIds.size} inquilino(s) seleccionado(s)</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleBulkRemindDebts}
                  disabled={bulkProcessing}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#A855F7] hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {bulkProcessing ? 'Enviando...' : 'Enviar recordatorio'}
                </button>
                <button
                  onClick={() => setSelectedDebtIds(new Set())}
                  className="text-xs font-bold text-slate-500 hover:underline px-2"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse border border-slate-200">
              <thead>
                <tr className="bg-[#DFCEFC] text-sm text-slate-800 font-bold border-b border-slate-200">
                  <th className="px-4 py-4 border-r border-slate-200 w-10">
                    <input
                      type="checkbox"
                      checked={filteredDebts.some(d => d.totalDebt > 0) && filteredDebts.filter(d => d.totalDebt > 0).every(d => selectedDebtIds.has(d.id))}
                      onChange={() => {
                        const debtIds = filteredDebts.filter(d => d.totalDebt > 0).map(d => d.id);
                        const allSelected = debtIds.length > 0 && debtIds.every(id => selectedDebtIds.has(id));
                        toggleSelectAll(setSelectedDebtIds, debtIds, allSelected);
                      }}
                      className="w-4 h-4 accent-purple-650 cursor-pointer"
                    />
                  </th>
                  <th className="px-6 py-4 border-r border-slate-200">Inquilino</th>
                  <th className="px-6 py-4 border-r border-slate-200">Habitación</th>
                  <th className="px-6 py-4 border-r border-slate-200">Recibos Pendientes</th>
                  <th className="px-6 py-4 border-r border-slate-200">Deuda Total</th>
                  <th className="px-6 py-4">Estado Cuenta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm text-slate-700 bg-white">
                {filteredDebts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400">
                      No hay inquilinos con deudas activas que coincidan.
                    </td>
                  </tr>
                ) : (
                  paginatedTenantDebts.map((inqDebt) => {
                    let badge = (
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-150 rounded-lg text-xs font-bold">
                        PAGOS AL DÍA
                      </span>
                    );
                    if (inqDebt.status === 'MOROSO') {
                      badge = (
                        <span className="px-2 py-0.5 bg-red-50 text-red-650 border border-red-150 rounded-lg text-xs font-bold animate-pulse">
                          MOROSO
                        </span>
                      );
                    } else if (inqDebt.unpaidCount > 0) {
                      badge = (
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-150 rounded-lg text-xs font-bold">
                          DEUDA ACTIVA
                        </span>
                      );
                    }

                    return (
                      <tr key={inqDebt.id} className="hover:bg-slate-50/30 transition-colors border-b border-slate-200 last:border-0">
                        <td className="px-4 py-4 border-r border-slate-200">
                          <input
                            type="checkbox"
                            disabled={inqDebt.totalDebt <= 0}
                            checked={selectedDebtIds.has(inqDebt.id)}
                            onChange={() => toggleSelection(setSelectedDebtIds, inqDebt.id)}
                            className="w-4 h-4 accent-purple-650 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          />
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-800 border-r border-slate-200">
                          {inqDebt.name}
                        </td>
                        <td className="px-6 py-4 text-slate-550 border-r border-slate-200 text-xs font-semibold font-mono">
                          {inqDebt.roomNumber || 'Propiedad Completa'}
                        </td>
                        <td className="px-6 py-4 text-slate-650 border-r border-slate-200 font-semibold">
                          {inqDebt.unpaidCount} recibos
                        </td>
                        <td className="px-6 py-4 font-mono font-bold text-slate-900 border-r border-slate-200">
                          S/. {inqDebt.totalDebt.toFixed(2)}
                        </td>
                        <td className="px-6 py-4">
                          {badge}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={debtsPage}
            totalItems={filteredDebts.length}
            pageSize={PAGE_SIZE}
            onPageChange={setDebtsPage}
            itemLabel="inquilinos"
          />
          </div>
        </div>
      )}

      {/* DRAWER/MODAL HISTORIAL TIMELINE */}
      {showTimelineDrawer && timelineTenantId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-end">
          <div className="fixed inset-0 bg-black/45 backdrop-blur-sm" onClick={() => setShowTimelineDrawer(false)} />
          
          <div className="bg-white w-full max-w-md h-full shadow-2xl relative z-10 flex flex-col p-6 animate-drawer-in">
            <div className="flex justify-between items-center pb-3 border-b border-slate-150 mb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Historial de Pagos</h3>
                <p className="text-xs text-purple-650 font-bold">{timelineTenantName}</p>
              </div>
              <button onClick={() => setShowTimelineDrawer(false)} className="text-slate-450 hover:text-slate-950 font-bold">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2">
              {payments.filter(p => p.inquilinoId === timelineTenantId).length === 0 ? (
                <p className="text-center py-12 text-slate-400 text-xs">No hay recibos registrados para este inquilino.</p>
              ) : (
                <div className="relative border-l-2 border-slate-200 ml-4 pl-6 space-y-6">
                  {payments
                    .filter(p => p.inquilinoId === timelineTenantId)
                    .sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime())
                    .map((p) => {
                      const isPaid = p.status === 'PAGADO';
                      const isOverdue = p.status === 'VENCIDO';
                      
                      let bulletColor = 'bg-amber-100 text-amber-700 border-amber-300';
                      let bulletIcon = <Clock className="w-3 h-3" />;
                      if (isPaid) {
                        bulletColor = 'bg-emerald-100 text-emerald-700 border-emerald-300';
                        bulletIcon = <Check className="w-3 h-3" />;
                      } else if (isOverdue) {
                        bulletColor = 'bg-rose-100 text-rose-700 border-rose-300';
                        bulletIcon = <XCircle className="w-3 h-3" />;
                      }

                      return (
                        <div key={p.id} className="relative">
                          <div className={`absolute -left-9 top-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center ${bulletColor} shadow-sm z-10 bg-white`}>
                            {bulletIcon}
                          </div>
                          <div className="bg-slate-50 border border-slate-200/60 p-3.5 rounded-2xl space-y-1">
                            <div className="flex justify-between items-start">
                              <span className="font-extrabold text-slate-800 text-xs uppercase">{p.paymentType}</span>
                              <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded border ${
                                isPaid ? 'bg-emerald-50 text-emerald-700 border-emerald-150' :
                                isOverdue ? 'bg-red-50 text-red-700 border-red-150' :
                                'bg-yellow-50 text-yellow-700 border-yellow-150'
                              }`}>
                                {p.status}
                              </span>
                            </div>
                            <p className="text-xs font-bold text-slate-900 font-mono">S/. {p.amount.toFixed(2)}</p>
                            {p.delayPenalty > 0 && (
                              <p className="text-[10px] text-red-600 font-bold font-mono">Mora: +S/. {p.delayPenalty.toFixed(2)}</p>
                            )}
                            <p className="text-[10px] text-slate-400 font-semibold font-mono">Vencimiento: {formatDate(p.dueDate)}</p>
                            {isPaid && (
                              <p className="text-[10px] text-emerald-600 font-bold mt-0.5">Pagado el: {getFechaPago(p)}</p>
                            )}
                            {p.description && (
                              <p className="text-[10px] text-slate-500 italic mt-1 font-mono border-t pt-1 border-slate-100">"{p.description}"</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-150 mt-4">
              <button
                onClick={() => setShowTimelineDrawer(false)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl"
              >
                Cerrar Historial
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL COBRAR MANUAL */}
      {showCollectModal && selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCollectModal(false)} />
          <div className="bg-white border border-slate-200 w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl z-10 p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-md font-bold text-slate-900">Registrar Cobro Manual</h3>
              <button onClick={() => setShowCollectModal(false)} className="text-slate-400 hover:text-slate-900">✕</button>
            </div>

            <div className="text-xs space-y-1.5 p-3.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-650">
              <p><span className="font-semibold text-slate-800">Inquilino:</span> {selectedPayment.inquilinoName}</p>
              <p><span className="font-semibold text-slate-800">Concepto:</span> {selectedPayment.paymentType}</p>
              <p><span className="font-semibold text-slate-800">Importe:</span> S/. {selectedPayment.amount.toFixed(2)}</p>
              {selectedPayment.delayPenalty > 0 && (
                <p className="text-red-650 font-bold">
                  Mora acumulada: +S/. {selectedPayment.delayPenalty.toFixed(2)}
                </p>
              )}
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Monto Recaudado (S/.)</label>
                <input
                  type="number"
                  placeholder="ej: 120.00"
                  value={amountToAdd}
                  onChange={(e) => setAmountToAdd(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-650 font-mono"
                  step="0.01"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Referencia / Comprobante (Opcional)</label>
                <div className="relative">
                  <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="ej: Depósito #45622 o Efectivo"
                    value={receiptReference}
                    onChange={(e) => setReceiptReference(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-650"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCollectModal(false)}
                  className="py-2 px-4 bg-transparent border border-slate-200 hover:bg-slate-50 text-slate-500 text-xs font-semibold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-md disabled:opacity-50"
                >
                  {submitting ? 'Registrando...' : 'Registrar Cobro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL GENERAR NUEVO COBRO */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
          
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl z-10 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-md font-bold text-slate-900">Generar Orden de Cobro</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-450 hover:text-slate-900">✕</button>
            </div>

            <form onSubmit={handleCreatePayment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Seleccionar Inquilino</label>
                <select
                  value={selectedInquilinoId}
                  onChange={(e) => handleInquilinoSelect(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-650"
                  required
                >
                  <option value="">-- Elige un inquilino --</option>
                  {inquilinos.map(i => (
                    <option key={i.id} value={i.id}>{i.name} (Cuarto: {i.roomNumber || 'Propiedad completa'})</option>
                  ))}
                </select>
              </div>

              {/* RENTA AUTOCOMPLETADA */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">Monto de Renta (S/.)</label>
                  <input
                    type="number"
                    placeholder="ej: 150.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-650 font-mono font-bold"
                    step="0.01"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">Tipo de Cobro</label>
                  <select
                    value={paymentType}
                    onChange={(e) => setPaymentType(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-650"
                  >
                    <option value="ALQUILER">ALQUILER</option>
                    <option value="SERVICIO">SERVICIO</option>
                  </select>
                </div>
              </div>

              {/* SECTION: SERVICIOS ADICIONALES (DESPLEGABLE / CHECKBOXES) */}
              {selectedInquilinoId && (
                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-2">
                  <button
                    type="button"
                    onClick={() => setShowServicesList(!showServicesList)}
                    className="w-full text-left font-bold text-xs text-purple-600 hover:text-purple-700 flex justify-between items-center"
                  >
                    <span>¿Incluir servicios adicionales este mes?</span>
                    <span>{showServicesList ? '▲ Ocultar' : '▼ Mostrar'}</span>
                  </button>

                  {showServicesList && (
                    <div className="space-y-2 pt-2 border-t border-slate-100 max-h-32 overflow-y-auto">
                      {servicios.length === 0 ? (
                        <p className="text-[10px] text-slate-400 italic">No hay servicios adicionales registrados.</p>
                      ) : (
                        servicios.map(s => (
                          <div key={s.id} className="flex items-center text-xs">
                            <input
                              type="checkbox"
                              id={`serv-${s.id}`}
                              checked={selectedServiceIds.includes(s.id)}
                              onChange={() => handleToggleService(s.id)}
                              className="w-4 h-4 text-purple-650 border-slate-300 rounded focus:ring-purple-500"
                            />
                            <label htmlFor={`serv-${s.id}`} className="ml-2 font-semibold text-slate-650 flex justify-between w-full pr-2 select-none cursor-pointer">
                              <span>{s.name} ({s.tipo})</span>
                              <span className="font-mono text-slate-700">S/. {s.cost.toFixed(2)}</span>
                            </label>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                  
                  {selectedServiceIds.length > 0 && (
                    <div className="text-[10px] text-slate-500 font-semibold flex justify-between border-t pt-1.5 mt-1 border-slate-150">
                      <span>Servicios sumados:</span>
                      <span className="font-mono text-purple-600">+S/. {getSelectedServicesCost().toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* FORMULA Y TOTAL FINAL */}
              {selectedInquilinoId && (
                <div className="p-3 bg-purple-50 border border-purple-100 rounded-xl flex justify-between text-xs font-bold text-purple-700">
                  <span>Monto Total a Generar:</span>
                  <span className="font-mono text-sm">
                    S/. {(parseFloat(amount || '0') + getSelectedServicesCost()).toFixed(2)}
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Fecha de Vencimiento</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-650 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Concepto / Descripción</label>
                <input
                  type="text"
                  placeholder="ej: Renta correspondiente a Junio 2026"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-purple-650"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="py-2 px-4 bg-transparent border border-slate-200 hover:bg-slate-50 text-slate-500 text-xs font-semibold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="py-2 px-4 bg-[#A855F7] hover:bg-purple-700 text-white text-xs font-semibold rounded-xl shadow-md disabled:opacity-50"
                >
                  {submitting ? 'Generando...' : 'Generar Cobro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECHAZAR COMPROBANTE */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowRejectModal(false)} />
          
          <div className="bg-white border border-slate-200 w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl z-10 p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-md font-bold text-slate-900 text-red-650">Rechazar Comprobante de Pago</h3>
              <button onClick={() => setShowRejectModal(false)} className="text-slate-450 hover:text-slate-950 font-bold">✕</button>
            </div>

            <form onSubmit={handleRejectPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">Motivo del Rechazo</label>
                <textarea
                  placeholder="ej: La imagen no es legible o el monto transferido no corresponde con la deuda actual."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-red-600 min-h-24 resize-none"
                  required
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="py-2 px-4 bg-transparent border border-slate-200 hover:bg-slate-50 text-slate-500 text-xs font-semibold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="py-2 px-4 bg-red-650 hover:bg-red-700 text-white text-xs font-semibold rounded-xl shadow-md disabled:opacity-50"
                >
                  {submitting ? 'Rechazando...' : 'Rechazar Comprobante'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LIGHTBOX COMPROBANTE */}
      {lightboxImageUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setLightboxImageUrl(null)} />
          <div className="bg-white p-3 rounded-2xl max-w-2xl w-full relative z-10 flex flex-col items-center">
            <button 
              onClick={() => setLightboxImageUrl(null)} 
              className="absolute top-3 right-3 bg-slate-900/80 hover:bg-slate-900 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm shadow-md"
            >
              ✕
            </button>
            <img 
              src={lightboxImageUrl} 
              alt="Comprobante" 
              className="max-h-[80vh] w-auto object-contain rounded-lg shadow-inner"
            />
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={deletePaymentId !== null}
        title="Eliminar Cobro"
        message="¿Está seguro de que desea eliminar este registro de cobro? Esta acción es irreversible."
        isDestructive
        confirmText="Eliminar"
        cancelText="Cancelar"
        onConfirm={confirmDeletePayment}
        onCancel={() => setDeletePaymentId(null)}
      />
    </div>
  );
};
