/**
 * Simula el envío de correos electrónicos y SMS imprimiendo logs legibles en el servidor.
 */

export function sendSimulatedCredentialsEmail(
  email: string,
  name: string,
  passwordPlain: string,
  tenantSlug: string
): void {
  console.log('\n========================================================================');
  console.log(`📨 [EMAIL SIMULADO] Enviando credenciales de acceso al inquilino`);
  console.log(`Para: ${name} (${email})`);
  console.log(`URL de Acceso: http://localhost:5173/login`);
  console.log(`Workspace (Tenant Slug): ${tenantSlug}`);
  console.log(`Usuario (Correo): ${email}`);
  console.log(`Contraseña: ${passwordPlain}`);
  console.log('========================================================================\n');
}

export function sendSimulatedPaymentReminder(
  email: string,
  name: string,
  amount: number,
  dueDate: string,
  propertyName: string,
  roomNumber: string
): void {
  console.log('\n========================================================================');
  console.log(`📱 [SMS/EMAIL SIMULADO] Recordatorio de Pago Vencido o Próximo`);
  console.log(`Para: ${name} (${email})`);
  console.log(`Mensaje: Estimado(a) ${name}, le recordamos que su cobro por S/. ${amount.toFixed(2)} ` +
    `para la Habitación ${roomNumber} en ${propertyName} vence el ${dueDate}. ` +
    `Por favor, registre su comprobante de Yape o transferencia a la brevedad.`);
  console.log('========================================================================\n');
}
