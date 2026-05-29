import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'roomly-super-secret-key';

export const register = async (req: Request, res: Response): Promise<void> => {
  const { email, password, firstName, lastName, companyName, slug } = req.body;

  if (!email || !password || !firstName || !companyName || !slug) {
    res.status(400).json({ error: 'Todos los campos obligatorios deben ser proporcionados.' });
    return;
  }

  const normalizedSlug = slug.toLowerCase().replace(/\s+/g, '').trim();

  try {
    // 1. Verificar si el tenant ya existe
    const existingTenant = await prisma.tenant.findUnique({
      where: { slug: normalizedSlug }
    });
    if (existingTenant) {
      res.status(400).json({ error: `El slug del tenant '${normalizedSlug}' ya está en uso.` });
      return;
    }

    // 2. Verificar si el email de usuario ya existe
    const existingUser = await prisma.usuario.findUnique({
      where: { email }
    });
    if (existingUser) {
      res.status(400).json({ error: 'El correo electrónico ya está registrado.' });
      return;
    }

    // 3. Crear el Tenant y el Usuario en una transacción
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await prisma.$transaction(async (tx: any) => {
      const tenant = await tx.tenant.create({
        data: {
          slug: normalizedSlug,
          companyName
        }
      });

      const user = await tx.usuario.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          role: 'PROPIETARIO',
          tenantId: tenant.id
        }
      });

      return { tenant, user };
    });

    res.status(201).json({
      message: 'Registro exitoso.',
      tenant: {
        id: result.tenant.id,
        slug: result.tenant.slug,
        companyName: result.tenant.companyName
      },
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        role: result.user.role
      }
    });

  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ error: 'Error al registrar el propietario y la empresa.' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Correo y contraseña son requeridos.' });
    return;
  }

  try {
    // Buscar usuario y cargar su tenant
    const user = await prisma.usuario.findUnique({
      where: { email },
      include: { tenant: true }
    });

    if (!user) {
      res.status(401).json({ error: 'Credenciales inválidas.' });
      return;
    }

    // Verificar contraseña
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      res.status(401).json({ error: 'Credenciales inválidas.' });
      return;
    }

    // Generar token JWT
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        tenantSlug: user.tenant.slug
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      },
      tenant: {
        id: user.tenant.id,
        slug: user.tenant.slug,
        companyName: user.tenant.companyName
      }
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error al iniciar sesión.' });
  }
};

export const validateTenant = async (req: Request, res: Response): Promise<void> => {
  const { slug } = req.query;

  if (!slug) {
    res.status(400).json({ error: 'El slug del tenant es requerido.' });
    return;
  }

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: String(slug).toLowerCase().trim() }
    });

    if (!tenant) {
      res.status(404).json({ exists: false, message: 'Workspace no encontrado.' });
      return;
    }

    res.json({
      exists: true,
      tenant: {
        slug: tenant.slug,
        companyName: tenant.companyName
      }
    });

  } catch (error) {
    console.error('Error en validateTenant:', error);
    res.status(500).json({ error: 'Error al validar el tenant.' });
  }
};
