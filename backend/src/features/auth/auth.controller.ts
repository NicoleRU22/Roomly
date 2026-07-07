import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import prisma from '../../core/db/prisma';
import { sendVerificationEmail, sendPasswordResetEmail, sendPasswordChangedEmail } from '../../core/services/email.service';

const JWT_SECRET = process.env.JWT_SECRET || 'roomly-super-secret-key';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);
const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora

const signToken = (user: { id: number; email: string; role: string; tenantId: number | null }, tenantSlug: string | null) =>
  jwt.sign(
    { userId: user.id, email: user.email, role: user.role, tenantId: user.tenantId, tenantSlug },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

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
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpiry = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);

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
          tenantId: tenant.id,
          verificationToken,
          verificationTokenExpiry
        }
      });

      return { tenant, user };
    });

    // Si el envío del correo falla, no se revierte el registro (la cuenta ya quedó creada);
    // el usuario puede pedir un reenvío desde el frontend.
    try {
      await sendVerificationEmail(result.user.email, result.user.firstName, verificationToken);
    } catch (emailError) {
      console.error('Error enviando correo de verificación:', emailError);
    }

    res.status(201).json({
      message: 'Registro exitoso. Revisa tu correo para confirmar tu cuenta.',
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

    // Verificar contraseña (las cuentas creadas vía Google no tienen contraseña local)
    if (!user.password) {
      res.status(401).json({ error: 'Esta cuenta fue creada con Google. Inicia sesión con Google.' });
      return;
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      res.status(401).json({ error: 'Credenciales inválidas.' });
      return;
    }

    if (!user.emailVerified) {
      res.status(403).json({ error: 'Debes confirmar tu correo electrónico antes de iniciar sesión.', code: 'EMAIL_NOT_VERIFIED' });
      return;
    }

    const token = signToken(user, user.tenant?.slug ?? null);

    await prisma.usuario.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      },
      tenant: user.tenant
        ? { id: user.tenant.id, slug: user.tenant.slug, companyName: user.tenant.companyName }
        : null
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

// Login/registro con Google. Si el correo ya existe, inicia sesión (y vincula el googleId).
// Si no existe, crea el Tenant + Usuario a partir de companyName/slug, igual que el registro clásico.
export const googleAuth = async (req: Request, res: Response): Promise<void> => {
  const { idToken, companyName, slug } = req.body;

  if (!idToken) {
    res.status(400).json({ error: 'El token de Google es requerido.' });
    return;
  }

  try {
    const ticket = await googleClient.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();

    if (!payload?.email) {
      res.status(401).json({ error: 'No se pudo verificar la cuenta de Google.' });
      return;
    }

    const { email, given_name, family_name, sub: googleId } = payload;

    const existingUser = await prisma.usuario.findUnique({
      where: { email },
      include: { tenant: true }
    });

    // Cuenta existente: iniciar sesión y vincular el googleId si aún no lo tiene.
    // Google ya verificó la propiedad del correo, así que también marcamos emailVerified.
    if (existingUser) {
      if (!existingUser.tenant) {
        res.status(401).json({ error: 'Las cuentas de administrador no admiten inicio de sesión con Google.' });
        return;
      }

      const user = existingUser.googleId && existingUser.emailVerified
        ? existingUser
        : await prisma.usuario.update({
            where: { id: existingUser.id },
            data: { googleId, emailVerified: true },
            include: { tenant: true }
          });

      const token = signToken(user, user.tenant!.slug);

      await prisma.usuario.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

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
          id: user.tenant!.id,
          slug: user.tenant!.slug,
          companyName: user.tenant!.companyName
        }
      });
      return;
    }

    // Cuenta nueva: se requiere nombre de empresa y slug para crear el workspace
    if (!companyName || !slug) {
      res.status(404).json({ error: 'Cuenta no encontrada. Completa el nombre de la empresa y el workspace para crear tu cuenta.' });
      return;
    }

    const normalizedSlug = slug.toLowerCase().replace(/\s+/g, '').trim();

    const existingTenant = await prisma.tenant.findUnique({ where: { slug: normalizedSlug } });
    if (existingTenant) {
      res.status(400).json({ error: `El slug del tenant '${normalizedSlug}' ya está en uso.` });
      return;
    }

    const result = await prisma.$transaction(async (tx: any) => {
      const tenant = await tx.tenant.create({
        data: { slug: normalizedSlug, companyName }
      });

      const user = await tx.usuario.create({
        data: {
          email,
          googleId,
          emailVerified: true, // Google ya verificó este correo
          firstName: given_name || 'Usuario',
          lastName: family_name || null,
          role: 'PROPIETARIO',
          tenantId: tenant.id,
          lastLoginAt: new Date()
        }
      });

      return { tenant, user };
    });

    const token = signToken(result.user, result.tenant.slug);

    res.status(201).json({
      token,
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        role: result.user.role
      },
      tenant: {
        id: result.tenant.id,
        slug: result.tenant.slug,
        companyName: result.tenant.companyName
      }
    });

  } catch (error) {
    console.error('Error en googleAuth:', error);
    res.status(500).json({ error: 'Error al autenticar con Google.' });
  }
};

// Confirma el correo a partir del token enviado por email e inicia sesión automáticamente
export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  const { token } = req.query;

  if (!token || typeof token !== 'string') {
    res.status(400).json({ error: 'El token de verificación es requerido.' });
    return;
  }

  try {
    const user = await prisma.usuario.findUnique({
      where: { verificationToken: token },
      include: { tenant: true }
    });

    if (!user || !user.verificationTokenExpiry || user.verificationTokenExpiry < new Date()) {
      res.status(400).json({ error: 'El enlace de verificación es inválido o ha expirado.' });
      return;
    }

    const verifiedUser = await prisma.usuario.update({
      where: { id: user.id },
      data: { emailVerified: true, verificationToken: null, verificationTokenExpiry: null, lastLoginAt: new Date() },
      include: { tenant: true }
    });

    // Este flujo solo aplica a cuentas creadas vía register(), que siempre tienen tenant (los ADMIN se crean ya verificados, aparte).
    const jwtToken = signToken(verifiedUser, verifiedUser.tenant!.slug);

    res.json({
      message: 'Correo verificado correctamente.',
      token: jwtToken,
      user: {
        id: verifiedUser.id,
        email: verifiedUser.email,
        firstName: verifiedUser.firstName,
        lastName: verifiedUser.lastName,
        role: verifiedUser.role
      },
      tenant: {
        id: verifiedUser.tenant!.id,
        slug: verifiedUser.tenant!.slug,
        companyName: verifiedUser.tenant!.companyName
      }
    });

  } catch (error) {
    console.error('Error en verifyEmail:', error);
    res.status(500).json({ error: 'Error al verificar el correo.' });
  }
};

// Reenvía el correo de verificación. Responde igual exista o no la cuenta, para no filtrar correos registrados.
export const resendVerification = async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;
  const genericResponse = { message: 'Si el correo está registrado y pendiente de verificación, te enviamos un nuevo enlace.' };

  if (!email) {
    res.status(400).json({ error: 'El correo es requerido.' });
    return;
  }

  try {
    const user = await prisma.usuario.findUnique({ where: { email } });

    if (!user || user.emailVerified) {
      res.json(genericResponse);
      return;
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpiry = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);

    await prisma.usuario.update({
      where: { id: user.id },
      data: { verificationToken, verificationTokenExpiry }
    });

    try {
      await sendVerificationEmail(user.email, user.firstName, verificationToken);
    } catch (emailError) {
      console.error('Error reenviando correo de verificación:', emailError);
    }

    res.json(genericResponse);

  } catch (error) {
    console.error('Error en resendVerification:', error);
    res.status(500).json({ error: 'Error al reenviar el correo de verificación.' });
  }
};

// Solicita el restablecimiento de contraseña. Responde igual exista o no la cuenta,
// para no filtrar qué correos están registrados.
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;
  const genericResponse = { message: 'Si el correo está registrado, te enviamos un enlace para restablecer tu contraseña.' };

  if (!email) {
    res.status(400).json({ error: 'El correo es requerido.' });
    return;
  }

  try {
    const user = await prisma.usuario.findUnique({ where: { email: String(email).trim().toLowerCase() } });

    // Las cuentas solo-Google no tienen contraseña que restablecer
    if (!user || !user.password) {
      res.json(genericResponse);
      return;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await prisma.usuario.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpiry }
    });

    try {
      await sendPasswordResetEmail(user.email, user.firstName, resetToken);
    } catch (emailError) {
      console.error('Error enviando correo de restablecimiento:', emailError);
    }

    res.json(genericResponse);

  } catch (error) {
    console.error('Error en forgotPassword:', error);
    res.status(500).json({ error: 'Error al solicitar el restablecimiento de contraseña.' });
  }
};

// Aplica la nueva contraseña a partir del token recibido por correo.
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  const { token, password } = req.body;

  if (!token || typeof token !== 'string') {
    res.status(400).json({ error: 'El token de restablecimiento es requerido.' });
    return;
  }

  if (!password || password.length < 6) {
    res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    return;
  }

  try {
    const user = await prisma.usuario.findUnique({ where: { resetToken: token } });

    if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
      res.status(400).json({ error: 'El enlace de restablecimiento es inválido o ha expirado. Solicita uno nuevo.' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.usuario.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
        // Restablecer por correo demuestra la propiedad del email, así que
        // también desbloquea cuentas que quedaron pendientes de verificación.
        emailVerified: true
      }
    });

    try {
      await sendPasswordChangedEmail(user.email, user.firstName);
    } catch (emailError) {
      console.error('Error enviando aviso de cambio de contraseña:', emailError);
    }

    res.json({ message: 'Contraseña restablecida con éxito. Ya puedes iniciar sesión.' });

  } catch (error) {
    console.error('Error en resetPassword:', error);
    res.status(500).json({ error: 'Error al restablecer la contraseña.' });
  }
};
