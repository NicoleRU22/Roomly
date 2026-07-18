import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prismaMock, resetPrismaMock } from '../../test-utils/prisma-mock';
import { mockRequest, mockResponse } from '../../test-utils/express-mocks';

vi.mock('../../core/db/prisma', () => ({ default: prismaMock, prisma: prismaMock }));
vi.mock('../../core/services/email.service', () => ({
  sendVerificationEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  sendPasswordChangedEmail: vi.fn()
}));
vi.mock('../../core/services/audit.service', () => ({ logEvent: vi.fn() }));
vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn().mockResolvedValue('hashed-password'), compare: vi.fn() }
}));

import bcrypt from 'bcryptjs';
import { register, login, resetPassword } from './auth.controller';
import { sendVerificationEmail, sendPasswordChangedEmail } from '../../core/services/email.service';
import { logEvent } from '../../core/services/audit.service';

describe('register', () => {
  beforeEach(() => {
    resetPrismaMock();
    vi.mocked(sendVerificationEmail).mockReset();
  });

  it('rechaza si faltan campos obligatorios', async () => {
    const req = mockRequest({ body: { email: 'a@a.com' } });
    const res = mockResponse();

    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('rechaza si el slug del tenant ya está en uso', async () => {
    const req = mockRequest({
      body: { email: 'a@a.com', password: 'secret123', firstName: 'Ana', companyName: 'ACME', slug: 'acme' }
    });
    const res = mockResponse();
    prismaMock.tenant.findUnique.mockResolvedValue({ id: 1, slug: 'acme' } as any);

    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('acme') }));
  });

  it('rechaza si el correo ya está registrado', async () => {
    const req = mockRequest({
      body: { email: 'a@a.com', password: 'secret123', firstName: 'Ana', companyName: 'ACME', slug: 'acme' }
    });
    const res = mockResponse();
    prismaMock.tenant.findUnique.mockResolvedValue(null);
    prismaMock.usuario.findUnique.mockResolvedValue({ id: 1, email: 'a@a.com' } as any);

    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('crea el tenant y el usuario, y envía el correo de verificación', async () => {
    const req = mockRequest({
      body: { email: 'a@a.com', password: 'secret123', firstName: 'Ana', companyName: 'ACME', slug: 'ACME Corp' }
    });
    const res = mockResponse();
    prismaMock.tenant.findUnique.mockResolvedValue(null);
    prismaMock.usuario.findUnique.mockResolvedValue(null);
    prismaMock.$transaction.mockImplementation((async (cb: any) =>
      cb({
        tenant: { create: vi.fn().mockResolvedValue({ id: 1, slug: 'acmecorp', companyName: 'ACME' }) },
        usuario: { create: vi.fn().mockResolvedValue({ id: 1, email: 'a@a.com', firstName: 'Ana', role: 'PROPIETARIO' }) }
      })) as any);

    await register(req, res);

    expect(bcrypt.hash).toHaveBeenCalledWith('secret123', 10);
    expect(sendVerificationEmail).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('normaliza el slug quitando espacios y mayúsculas', async () => {
    const req = mockRequest({
      body: { email: 'a@a.com', password: 'secret123', firstName: 'Ana', companyName: 'ACME', slug: '  My Company  ' }
    });
    const res = mockResponse();
    prismaMock.tenant.findUnique.mockResolvedValue(null);

    await register(req, res);

    expect(prismaMock.tenant.findUnique).toHaveBeenCalledWith({ where: { slug: 'mycompany' } });
  });
});

describe('login', () => {
  beforeEach(() => {
    resetPrismaMock();
    vi.mocked(logEvent).mockReset();
    vi.mocked(bcrypt.compare).mockReset();
  });

  it('rechaza si faltan credenciales', async () => {
    const req = mockRequest({ body: { email: 'a@a.com' } });
    const res = mockResponse();

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('responde 401 y audita si el usuario no existe', async () => {
    const req = mockRequest({ body: { email: 'a@a.com', password: 'x' } });
    const res = mockResponse();
    prismaMock.usuario.findUnique.mockResolvedValue(null);

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ action: 'LOGIN_FAILED' }));
  });

  it('responde 401 si la cuenta fue creada solo con Google (sin password local)', async () => {
    const req = mockRequest({ body: { email: 'a@a.com', password: 'x' } });
    const res = mockResponse();
    prismaMock.usuario.findUnique.mockResolvedValue({ id: 1, email: 'a@a.com', password: null } as any);

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('responde 401 si la contraseña es incorrecta', async () => {
    const req = mockRequest({ body: { email: 'a@a.com', password: 'wrong' } });
    const res = mockResponse();
    prismaMock.usuario.findUnique.mockResolvedValue({ id: 1, email: 'a@a.com', password: 'hashed' } as any);
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('responde 403 con código EMAIL_NOT_VERIFIED si el correo no está confirmado', async () => {
    const req = mockRequest({ body: { email: 'a@a.com', password: 'right' } });
    const res = mockResponse();
    prismaMock.usuario.findUnique.mockResolvedValue({ id: 1, email: 'a@a.com', password: 'hashed', emailVerified: false } as any);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'EMAIL_NOT_VERIFIED' }));
  });

  it('inicia sesión con éxito, crea la Session y actualiza lastLoginAt', async () => {
    const req = mockRequest({ body: { email: 'a@a.com', password: 'right' }, ip: '127.0.0.1', headers: {} });
    const res = mockResponse();
    prismaMock.usuario.findUnique.mockResolvedValue({
      id: 1, email: 'a@a.com', password: 'hashed', emailVerified: true,
      firstName: 'Ana', lastName: 'Ruiz', role: 'PROPIETARIO', tenantId: 1,
      tenant: { id: 1, slug: 'acme', companyName: 'ACME' }
    } as any);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
    prismaMock.session.create.mockResolvedValue({} as any);
    prismaMock.usuario.update.mockResolvedValue({} as any);

    await login(req, res);

    expect(prismaMock.session.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.usuario.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1 }, data: expect.objectContaining({ lastLoginAt: expect.any(Date) }) })
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ token: expect.any(String) }));
  });
});

describe('resetPassword', () => {
  beforeEach(() => {
    resetPrismaMock();
    vi.mocked(sendPasswordChangedEmail).mockReset();
  });

  it('rechaza si falta el token', async () => {
    const req = mockRequest({ body: { password: 'newsecret' } });
    const res = mockResponse();

    await resetPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rechaza contraseñas de menos de 6 caracteres', async () => {
    const req = mockRequest({ body: { token: 't', password: '123' } });
    const res = mockResponse();

    await resetPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rechaza si el token es inválido o expiró', async () => {
    const req = mockRequest({ body: { token: 'bad-token', password: 'newsecret' } });
    const res = mockResponse();
    prismaMock.usuario.findUnique.mockResolvedValue(null);

    await resetPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rechaza un token cuya expiración ya pasó', async () => {
    const req = mockRequest({ body: { token: 'old-token', password: 'newsecret' } });
    const res = mockResponse();
    prismaMock.usuario.findUnique.mockResolvedValue({ id: 1, resetTokenExpiry: new Date(Date.now() - 1000) } as any);

    await resetPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('restablece la contraseña, limpia el token y notifica por correo', async () => {
    const req = mockRequest({ body: { token: 'valid-token', password: 'newsecret' } });
    const res = mockResponse();
    prismaMock.usuario.findUnique.mockResolvedValue({
      id: 1, email: 'a@a.com', firstName: 'Ana', resetTokenExpiry: new Date(Date.now() + 60_000)
    } as any);
    prismaMock.usuario.update.mockResolvedValue({} as any);

    await resetPassword(req, res);

    expect(bcrypt.hash).toHaveBeenCalledWith('newsecret', 10);
    expect(prismaMock.usuario.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ password: 'hashed-password', resetToken: null, resetTokenExpiry: null, emailVerified: true })
      })
    );
    expect(sendPasswordChangedEmail).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });
});
