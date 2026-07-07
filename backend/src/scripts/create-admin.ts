import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '../core/db/prisma';

// Crea (o reemplaza la contraseña de) el único usuario ADMIN de la plataforma.
// Uso: npx ts-node src/scripts/create-admin.ts <email> [firstName]
async function main() {
  const email = process.argv[2];
  const firstName = process.argv[3] || 'Admin';

  if (!email) {
    console.error('Uso: npx ts-node src/scripts/create-admin.ts <email> [firstName]');
    process.exit(1);
  }

  const password = crypto.randomBytes(12).toString('base64url'); // contraseña aleatoria de un solo uso
  const hashedPassword = await bcrypt.hash(password, 10);

  const existing = await prisma.usuario.findUnique({ where: { email } });

  const admin = existing
    ? await prisma.usuario.update({
        where: { email },
        data: { password: hashedPassword, role: 'ADMIN', tenantId: null, emailVerified: true }
      })
    : await prisma.usuario.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          role: 'ADMIN',
          tenantId: null,
          emailVerified: true
        }
      });

  console.log('Usuario ADMIN listo:');
  console.log(`  Email:    ${admin.email}`);
  console.log(`  Password: ${password}`);
  console.log('Guarda esta contraseña ahora: no se volverá a mostrar. Cámbiala tras el primer login.');
}

main()
  .catch((err) => {
    console.error('Error creando el admin:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
