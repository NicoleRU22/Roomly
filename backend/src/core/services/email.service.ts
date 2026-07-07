import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'Roomly <onboarding@resend.dev>';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// El cliente se crea al primer uso (no al importar el módulo) para no tumbar el
// servidor si RESEND_API_KEY todavía no está configurada en el entorno.
let resend: Resend | null = null;
const getResendClient = (): Resend => {
  if (!resend) {
    resend = new Resend(RESEND_API_KEY);
  }
  return resend;
};

export const sendVerificationEmail = async (to: string, firstName: string, token: string): Promise<void> => {
  const verifyUrl = `${FRONTEND_URL}/verify-email?token=${token}`;

  if (!RESEND_API_KEY) {
    // Sin API key (típico en desarrollo local) se imprime el enlace para poder probar el flujo igualmente.
    console.warn(`RESEND_API_KEY no configurada. Enlace de verificación para ${to}: ${verifyUrl}`);
    return;
  }

  const { error } = await getResendClient().emails.send({
    from: EMAIL_FROM,
    to,
    subject: 'Confirma tu correo en Roomly',
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

  // El SDK de Resend no lanza excepción en errores de la API (dominio no verificado, etc.),
  // los devuelve en `error`. Los propagamos para que el llamador los registre.
  if (error) {
    throw new Error(`Resend rechazó el envío: ${error.message}`);
  }
};
