import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { AsyncLocalStorage } from 'async_hooks';

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/roomly?schema=public';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

// Almacenamiento local asíncrono para el contexto del inquilino (tenantId)
export interface TenantContext {
  tenantId: number;
  inTransaction?: boolean;
}
export const tenantStorage = new AsyncLocalStorage<TenantContext>();

const basePrisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

// Prisma Client extendido para inyectar automáticamente la variable de sesión para RLS
export const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ args, query }) {
        const store = tenantStorage.getStore();
        
        // Si hay un tenantId activo y no estamos dentro de una transacción interactiva manual
        if (store && store.tenantId !== undefined && !store.inTransaction) {
          // Ejecutar dentro de una transacción implícita que inicializa el parámetro RLS
          return await basePrisma.$transaction([
            basePrisma.$executeRawUnsafe(`SELECT set_config('app.current_tenant_id', '${store.tenantId}', true)`),
            query(args),
          ]).then((results) => results[1]);
        }
        
        // Ejecución normal (rutas públicas, o consultas que ya están dentro de una transacción)
        return query(args);
      },
    },
  },
});

// Helper para envolver transacciones interactivas, aplicando RLS al inicio
export async function runInTransaction<T>(
  callback: (tx: any) => Promise<T>
): Promise<T> {
  const store = tenantStorage.getStore();
  
  return await prisma.$transaction(async (tx) => {
    if (store && store.tenantId !== undefined) {
      // Establecer el tenant en la sesión de esta transacción
      await tx.$executeRawUnsafe(`SELECT set_config('app.current_tenant_id', '${store.tenantId}', true)`);
      // Ejecutar el callback del usuario con inTransaction: true
      return await tenantStorage.run({ ...store, inTransaction: true }, () => callback(tx));
    }
    return await callback(tx);
  });
}

export default prisma;
