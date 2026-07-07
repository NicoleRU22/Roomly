import Mailjet from 'node-mailjet';

const MAILJET_API_KEY = process.env.MAILJET_API_KEY;
const MAILJET_SECRET_KEY = process.env.MAILJET_SECRET_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'roomly.company@gmail.com';
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || 'Roomly';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// El cliente se crea al primer uso (no al importar el módulo) para no tumbar el
// servidor si las credenciales de Mailjet todavía no están configuradas en el entorno.
let mailjet: Mailjet | null = null;
const getMailjetClient = (): Mailjet => {
  if (!mailjet) {
    mailjet = new Mailjet({ apiKey: MAILJET_API_KEY, apiSecret: MAILJET_SECRET_KEY });
  }
  return mailjet;
};

interface SendParams {
  to: string;
  toName: string;
  subject: string;
  html: string;
  fallbackLogMessage: string;
}

const send = async ({ to, toName, subject, html, fallbackLogMessage }: SendParams): Promise<void> => {
  if (!MAILJET_API_KEY || !MAILJET_SECRET_KEY) {
    // Sin credenciales (típico en desarrollo local) se imprime el mensaje para poder probar el flujo igualmente.
    console.warn(fallbackLogMessage);
    return;
  }

  const result = await getMailjetClient().post('send', { version: 'v3.1' }).request({
    Messages: [
      {
        From: { Email: EMAIL_FROM, Name: EMAIL_FROM_NAME },
        To: [{ Email: to, Name: toName }],
        Subject: subject,
        HTMLPart: html
      }
    ]
  });

  const status = (result.body as any)?.Messages?.[0]?.Status;
  if (status !== 'success') {
    throw new Error(`Mailjet rechazó el envío: ${JSON.stringify(result.body)}`);
  }
};

export const sendVerificationEmail = async (to: string, firstName: string, token: string): Promise<void> => {
  const verifyUrl = `${FRONTEND_URL}/verify-email?token=${token}`;

  await send({
    to,
    toName: firstName,
    subject: 'Confirma tu correo en Roomly',
    fallbackLogMessage: `Mailjet no configurado. Enlace de verificación para ${to}: ${verifyUrl}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #1e293b;">¡Hola ${firstName}!</h2>
        <p style="color: #475569;">Gracias por registrarte en Roomly. Confirma tu correo electrónico para activar tu cuenta:</p>
        <a href="${verifyUrl}" style="display: inline-block; padding: 12px 24px; background-color: #1e293b; color: white; text-decoration: none; border-radius: 12px; font-weight: bold; margin: 16px 0;">
          Confirmar mi correo
        </a>
        <p style="color: #94a3b8; font-size: 12px;">Si no creaste esta cuenta, puedes ignorar este mensaje. Este enlace expira en 24 horas.</p>
      </div>
    `
  });
};

export const sendCredentialsEmail = async (
  to: string,
  name: string,
  passwordPlain: string,
  tenantSlug: string
): Promise<void> => {
  const loginUrl = `${FRONTEND_URL}/login`;

  await send({
    to,
    toName: name,
    subject: 'Tus credenciales de acceso a Roomly',
    fallbackLogMessage: `Mailjet no configurado. Credenciales para ${to}: usuario=${to} contraseña=${passwordPlain} workspace=${tenantSlug}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #1e293b;">¡Bienvenido(a) a Roomly, ${name}!</h2>
        <p style="color: #475569;">Tu propietario te dio de alta en la plataforma. Estas son tus credenciales de acceso:</p>
        <p style="color: #1e293b; background: #f1f5f9; padding: 12px 16px; border-radius: 12px;">
          <strong>Usuario:</strong> ${to}<br/>
          <strong>Contraseña temporal:</strong> ${passwordPlain}
        </p>
        <a href="${loginUrl}" style="display: inline-block; padding: 12px 24px; background-color: #1e293b; color: white; text-decoration: none; border-radius: 12px; font-weight: bold; margin: 16px 0;">
          Iniciar sesión
        </a>
        <p style="color: #94a3b8; font-size: 12px;">Te recomendamos cambiar esta contraseña desde tu perfil después de iniciar sesión.</p>
      </div>
    `
  });
};

export const sendPasswordResetEmail = async (to: string, name: string, token: string): Promise<void> => {
  const resetUrl = `${FRONTEND_URL}/reset-password?token=${token}`;

  await send({
    to,
    toName: name,
    subject: 'Restablece tu contraseña de Roomly',
    fallbackLogMessage: `Mailjet no configurado. Enlace de restablecimiento para ${to}: ${resetUrl}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #1e293b;">Hola ${name},</h2>
        <p style="color: #475569;">Recibimos una solicitud para restablecer la contraseña de tu cuenta en Roomly. Haz clic en el botón para elegir una nueva:</p>
        <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #1e293b; color: white; text-decoration: none; border-radius: 12px; font-weight: bold; margin: 16px 0;">
          Restablecer contraseña
        </a>
        <p style="color: #94a3b8; font-size: 12px;">Si no solicitaste este cambio, puedes ignorar este mensaje y tu contraseña seguirá siendo la misma. Este enlace expira en 1 hora.</p>
      </div>
    `
  });
};

export const sendPasswordChangedEmail = async (to: string, name: string): Promise<void> => {
  await send({
    to,
    toName: name,
    subject: 'Tu contraseña de Roomly fue actualizada',
    fallbackLogMessage: `Mailjet no configurado. Aviso de cambio de contraseña para ${to}.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #1e293b;">Hola ${name},</h2>
        <p style="color: #475569;">Te confirmamos que la contraseña de tu cuenta en Roomly fue actualizada correctamente.</p>
        <p style="color: #94a3b8; font-size: 12px;">Si no fuiste tú quien hizo este cambio, contacta de inmediato a tu propietario o administrador para asegurar tu cuenta.</p>
      </div>
    `
  });
};
