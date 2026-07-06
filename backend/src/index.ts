import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import authRoutes from './features/auth/auth.routes';
import propertyRoutes from './features/propiedades/property.routes';
import inquilinoRoutes from './features/inquilinos/inquilino.routes';
import paymentRoutes from './features/pagos/payment.routes';
import servicioRoutes from './features/servicios/servicio.routes';
import contractRoutes from './features/contratos/contract.routes';
import maintenanceRoutes from './features/mantenimiento/maintenance.routes';
import notificationRoutes from './features/notificaciones/notification.routes';
import configuracionRoutes from './features/configuracion/configuracion.routes';
import mensajeRoutes from './features/mensajes/mensaje.routes';
import { generateRecurringInvoices } from './features/pagos/recurring.service';
import { checkContractExpirations } from './features/contratos/contract-expiration.service';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT || '10mb';

// Registrar cabeceras de seguridad con Helmet
app.use(helmet());

// Configurar CORS seguro con lista blanca dinámica
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.replace(/['"]/g, '').split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    // Permitir requests sin origen (p. ej., aplicaciones móviles o curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      console.warn(`[CORS Blocked] Origin "${origin}" is not allowed. Allowed origins:`, allowedOrigins);
      callback(new Error('No permitido por CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Slug'],
  credentials: true
}));

app.use(express.json({ limit: JSON_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: JSON_BODY_LIMIT }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Logger simple para debug
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Rutas Públicas (Auth, Registro, Validaciones)
app.use('/api/auth', authRoutes);

// Rutas del Negocio (Propiedades, Inquilinos, Pagos, Servicios)
// Todas estas rutas están protegidas internamente en sus routers mediante:
// tenantMiddleware y authMiddleware
app.use('/api', propertyRoutes);
app.use('/api', inquilinoRoutes);
app.use('/api', paymentRoutes);
app.use('/api', servicioRoutes);
app.use('/api', contractRoutes);
app.use('/api', maintenanceRoutes);
app.use('/api', notificationRoutes);
app.use('/api', configuracionRoutes);
app.use('/api', mensajeRoutes);

// Ruta de Salud/Prueba
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Roomly API running successfully' });
});

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err?.type === 'entity.too.large' || err?.status === 413) {
    res.status(413).json({
      error: 'La imagen adjunta es demasiado grande. Sube una foto menor a 6 MB.'
    });
    return;
  }

  if (err?.message === 'No permitido por CORS') {
    res.status(403).json({
      error: 'Origen no permitido por CORS. Revisa CORS_ORIGIN en el backend.'
    });
    return;
  }

  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'El cuerpo de la solicitud no es un JSON valido.' });
    return;
  }

  console.error('Error no controlado:', err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor Roomly API iniciado en http://localhost:${PORT}`);

  // Generación automática de recibos de alquiler recurrentes: al iniciar y luego cada 24h
  const DAY_MS = 24 * 60 * 60 * 1000;
  const runRecurringInvoicesJob = () => {
    generateRecurringInvoices()
      .then(({ created }) => {
        if (created > 0) console.log(`[Cron] Recibos recurrentes generados automáticamente: ${created}`);
      })
      .catch((err) => console.error('[Cron] Error generando recibos recurrentes:', err));
  };
  runRecurringInvoicesJob();
  setInterval(runRecurringInvoicesJob, DAY_MS);

  // Chequeo de vencimiento de contratos: avisa próximos a vencer y finaliza los vencidos
  const runContractExpirationJob = () => {
    checkContractExpirations()
      .then(({ finalizados, avisos }) => {
        if (finalizados > 0 || avisos > 0) {
          console.log(`[Cron] Contratos finalizados: ${finalizados}, avisos de vencimiento enviados: ${avisos}`);
        }
      })
      .catch((err) => console.error('[Cron] Error revisando vencimiento de contratos:', err));
  };
  runContractExpirationJob();
  setInterval(runContractExpirationJob, DAY_MS);
});

// Trigger reload for Prisma client update
