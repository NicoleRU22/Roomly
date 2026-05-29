import prisma from './prisma';

async function main() {
  console.log('Iniciando limpieza y generación de datos de prueba...');

  // 1. Obtener el tenant existente. Si no hay ninguno, creamos uno por defecto.
  let tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        slug: 'casanovedades',
        companyName: 'Casa Novedades S.A.C.'
      }
    });
    console.log(`Tenant creado: ${tenant.companyName} (${tenant.slug})`);
  } else {
    console.log(`Tenant encontrado: ${tenant.companyName} (${tenant.slug})`);
  }

  // 2. Limpiar datos existentes (para evitar conflictos de FK, limpiamos en orden)
  await prisma.payment.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.servicio.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.inquilino.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.room.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.property.deleteMany({ where: { tenantId: tenant.id } });

  console.log('Base de datos limpiada para el tenant.');

  // 3. Crear 10 edificios
  const buildingNames = [
    'Torre Alfa', 'Torre Beta', 'Edificio Miraflores', 'Residencial San Isidro',
    'Condominio Los Olivos', 'Edificio Central', 'Torre del Sol', 'Residencial El Parque',
    'Edificio La Marina', 'Condominio Primavera'
  ];

  const addresses = [
    'Av. Larco 456, Miraflores', 'Av. Arenales 1020, Lince', 'Calle Las Flores 123, San Isidro',
    'Av. Universitaria 3400, Los Olivos', 'Jr. Carabaya 567, Cercado de Lima', 'Av. Arequipa 2400, San Isidro',
    'Av. La Marina 1500, San Miguel', 'Calle El Sol 290, Barranco', 'Av. Javier Prado 890, San Borja',
    'Av. Primavera 1200, Santiago de Surco'
  ];

  const properties = [];
  for (let i = 0; i < 10; i++) {
    const prop = await prisma.property.create({
      data: {
        name: buildingNames[i],
        address: addresses[i],
        price: null,
        tenantId: tenant.id
      }
    });
    properties.push(prop);
    console.log(`Edificio creado: ${prop.name}`);
  }

  // 4. Generar habitaciones para cada edificio (entre 40 y 100 habitaciones)
  let inquilinoCount = 0;
  
  const inquilinoNames = [
    'Nicole Alexandra García', 'Juan Carlos Mendoza', 'Ana María Torres', 'Diego Alonzo Ramos',
    'Sofia Valentina Paz', 'Luis Alberto Guerrero', 'Gabriela Inés Castro', 'Carlos Eduardo Rojas',
    'Camila Alejandra Silva', 'Mateo Ignacio Flores', 'Valeria Sofia Cruz', 'Sebastian David Ortiz',
    'Mariana Isabel Rivas', 'Joaquín Andrés Ruiz', 'Luciana Belén Morales', 'Felipe Antonio Vega'
  ];

  for (let pIdx = 0; pIdx < properties.length; pIdx++) {
    const prop = properties[pIdx];
    const roomCount = Math.floor(Math.random() * (100 - 40 + 1)) + 40;
    console.log(`Generando ${roomCount} habitaciones para ${prop.name}...`);

    const roomsData = [];
    for (let r = 1; r <= roomCount; r++) {
      const floor = Math.floor((r - 1) / 20) + 1;
      const numInFloor = ((r - 1) % 20) + 1;
      const roomNumber = `${floor}${numInFloor < 10 ? '0' : ''}${numInFloor}`;
      const price = [400, 500, 600, 750, 900][(floor - 1) % 5];
      
      const rand = Math.random();
      const status = rand < 0.7 ? 'Ocupado' : rand < 0.95 ? 'Disponible' : 'Mantenimiento';

      roomsData.push({
        roomNumber,
        price,
        status,
        propertyId: prop.id,
        tenantId: tenant.id
      });
    }

    await prisma.room.createMany({ data: roomsData });
    
    const createdRooms = await prisma.room.findMany({
      where: { propertyId: prop.id }
    });

    for (const room of createdRooms) {
      if (room.status === 'Ocupado') {
        inquilinoCount++;
        const randomName = inquilinoNames[inquilinoCount % inquilinoNames.length] + ' ' + (Math.floor(inquilinoCount / inquilinoNames.length) + 1);
        const dni = String(10000000 + Math.floor(Math.random() * 89999999));
        const email = `inquilino${inquilinoCount}@roomly.com`;
        const phone = '9' + String(10000000 + Math.floor(Math.random() * 89999999));
        
        const inqStatus = Math.random() < 0.1 ? 'MOROSO' : 'ACTIVO';

        const inquilino = await prisma.inquilino.create({
          data: {
            name: randomName,
            document: dni,
            email,
            phone,
            status: inqStatus,
            propertyId: prop.id,
            roomId: room.id,
            tenantId: tenant.id
          }
        });

        const prevMonthDate = new Date();
        prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
        await prisma.payment.create({
          data: {
            inquilinoId: inquilino.id,
            roomId: room.id,
            amount: room.price,
            amountPaid: room.price,
            delayPenalty: 0,
            dueDate: prevMonthDate,
            lastPaymentDate: prevMonthDate,
            status: 'PAGADO',
            paymentType: 'ALQUILER',
            description: `Alquiler correspondiente al mes anterior - Habitación ${room.roomNumber}`,
            tenantId: tenant.id
          }
        });

        const currentDueDate = new Date();
        currentDueDate.setDate(5);
        
        const isPaid = inqStatus === 'ACTIVO' ? Math.random() < 0.6 : false;
        const statusPay = isPaid ? 'PAGADO' : (inqStatus === 'MOROSO' ? 'VENCIDO' : 'PENDIENTE');
        const amountPaid = isPaid ? room.price : 0;
        const penalty = inqStatus === 'MOROSO' ? 50 : 0;

        await prisma.payment.create({
          data: {
            inquilinoId: inquilino.id,
            roomId: room.id,
            amount: room.price,
            amountPaid,
            delayPenalty: penalty,
            dueDate: currentDueDate,
            status: statusPay,
            paymentType: 'ALQUILER',
            description: `Alquiler mensual - Habitación ${room.roomNumber}`,
            tenantId: tenant.id
          }
        });
      }
    }
  }

  console.log(`\n¡Sembrado exitoso!`);
  console.log(`Propiedades generadas: 10`);
  console.log(`Inquilinos generados: ${inquilinoCount}`);
  
  const totalRooms = await prisma.room.count();
  console.log(`Habitaciones totales generadas: ${totalRooms}`);
}

main()
  .catch(e => {
    console.error('Error sembrando la base de datos:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
