import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import authRoutes from './features/auth/auth.routes';
import propertyRoutes from './features/propiedades/property.routes';
import inquilinoRoutes from './features/inquilinos/inquilino.routes';
import paymentRoutes from './features/pagos/payment.routes';
import servicioRoutes from './features/servicios/servicio.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

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

app.use(express.json());

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

// Ruta de Salud/Prueba
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Roomly API running successfully' });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor Roomly API iniciado en http://localhost:${PORT}`);
});
