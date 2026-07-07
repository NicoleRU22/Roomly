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

export const sendVerificationEmail = async (to: string, firstName: string, token: string): Promise<void> => {
  const verifyUrl = `${FRONTEND_URL}/verify-email?token=${token}`;

  if (!MAILJET_API_KEY || !MAILJET_SECRET_KEY) {
    // Sin credenciales (típico en desarrollo local) se imprime el enlace para poder probar el flujo igualmente.
    console.warn(`Mailjet no configurado. Enlace de verificación para ${to}: ${verifyUrl}`);
    return;
  }

  const result = await getMailjetClient().post('send', { version: 'v3.1' }).request({
    Messages: [
      {
        From: { Email: EMAIL_FROM, Name: EMAIL_FROM_NAME },
        To: [{ Email: to, Name: firstName }],
        Subject: 'Confirma tu correo en Roomly',
        HTMLPart: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #1e293b;">¡Hola ${firstName}!</h2>
            <p style="color: #475569;">Gracias por registrarte en Roomly. Confirma tu correo electrónico para activar tu cuenta:</p>
            <a href="${verifyUrl}" style="display: inline-block; padding: 12px 24px; background-color: #1e293b; color: white; text-decoration: none; border-radius: 12px; font-weight: bold; margin: 16px 0;">
              Confirmar mi correo
            </a>
            <p style="color: #94a3b8; font-size: 12px;">Si no creaste esta cuenta, puedes ignorar este mensaje. Este enlace expira en 24 horas.</p>
          </div>
        `
      }
    ]
  });

  const status = (result.body as any)?.Messages?.[0]?.Status;
  if (status !== 'success') {
    throw new Error(`Mailjet rechazó el envío: ${JSON.stringify(result.body)}`);
  }
};
