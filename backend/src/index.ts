import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import propertyRoutes from './routes/property.routes';
import inquilinoRoutes from './routes/inquilino.routes';
import paymentRoutes from './routes/payment.routes';
import servicioRoutes from './routes/servicio.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configurar CORS para permitir comunicación con el frontend
app.use(cors({
  origin: '*', // En producción limitar a dominios específicos
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Slug']
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
