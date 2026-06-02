import { Tenant } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      tenantId?: number;
      userId?: number;
      userRole?: string;
    }
  }
}
