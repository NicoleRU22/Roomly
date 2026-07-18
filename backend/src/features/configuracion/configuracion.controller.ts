import { Request, Response } from 'express';
import prisma from '../../core/db/prisma';
import { saveBase64Image } from '../../core/utils/upload';

export const getConfiguracion = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const userId = req.userId!;

  try {
    const [tenant, owner] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: tenantId } }),
      prisma.usuario.findUnique({ where: { id: userId } })
    ]);

    if (!tenant) {
      res.status(404).json({ error: 'Workspace no encontrado.' });
      return;
    }

    res.json({
      companyName: tenant.companyName,
      landlordRuc: tenant.landlordRuc || '',
      landlordAddress: tenant.landlordAddress || '',
      landlordSignatureUrl: tenant.landlordSignatureUrl || '',
      lateFeePerDay: tenant.lateFeePerDay,
      graceDays: tenant.graceDays,
      contractExpirationWarningDays: tenant.contractExpirationWarningDays,
      defaultBillingDay: tenant.defaultBillingDay || null,
      whatsappTemplate: tenant.whatsappTemplate || '',
      notifyComprobantePendiente: tenant.notifyComprobantePendiente,
      notifyContratoFirmado: tenant.notifyContratoFirmado,
      notifyTicketCreado: tenant.notifyTicketCreado,
      ownerFirstName: owner?.firstName || '',
      ownerLastName: owner?.lastName || '',
      ownerEmail: owner?.email || '',
      ownerPhone: owner?.phone || '',
      ownerDocument: owner?.document || ''
    });
  } catch (error) {
    console.error('Error en getConfiguracion:', error);
    res.status(500).json({ error: 'Error al obtener la configuración.' });
  }
};

export const updateConfiguracion = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const userId = req.userId!;
  const userRole = req.userRole;

  if (userRole === 'INQUILINO') {
    res.status(403).json({ error: 'Acceso denegado. No tienes permisos para editar la configuración del negocio.' });
    return;
  }

  const {
    companyName,
    landlordRuc,
    landlordAddress,
    lateFeePerDay,
    graceDays,
    contractExpirationWarningDays,
    defaultBillingDay,
    whatsappTemplate,
    notifyComprobantePendiente,
    notifyContratoFirmado,
    notifyTicketCreado,
    ownerFirstName,
    ownerLastName,
    ownerEmail,
    ownerPhone,
    ownerDocument
  } = req.body;

  if (defaultBillingDay !== undefined && defaultBillingDay !== null && defaultBillingDay !== '') {
    const parsedDay = parseInt(defaultBillingDay);
    if (isNaN(parsedDay) || parsedDay < 1 || parsedDay > 31) {
      res.status(400).json({ error: 'El día de cobro por defecto debe ser un número entre 1 y 31.' });
      return;
    }
  }

  if (ownerFirstName !== undefined && !String(ownerFirstName).trim()) {
    res.status(400).json({ error: 'El nombre del propietario no puede estar vacío.' });
    return;
  }

  let normalizedEmail: string | undefined;
  if (ownerEmail !== undefined) {
    normalizedEmail = String(ownerEmail).trim().toLowerCase();
    if (!normalizedEmail) {
      res.status(400).json({ error: 'El correo del propietario no puede estar vacío.' });
      return;
    }

    const emailInUse = await prisma.usuario.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' }, NOT: { id: userId } }
    });
    if (emailInUse) {
      res.status(400).json({ error: 'Ese correo ya está en uso por otra cuenta.' });
      return;
    }
  }

  try {
    const [updated, updatedOwner] = await Promise.all([
      prisma.tenant.update({
        where: { id: tenantId },
        data: {
          companyName: companyName || undefined,
          landlordRuc: landlordRuc ?? undefined,
          landlordAddress: landlordAddress ?? undefined,
          lateFeePerDay: lateFeePerDay !== undefined && lateFeePerDay !== null ? parseFloat(lateFeePerDay) : undefined,
          graceDays: graceDays !== undefined && graceDays !== null ? parseInt(graceDays) : undefined,
          contractExpirationWarningDays: contractExpirationWarningDays !== undefined && contractExpirationWarningDays !== null ? parseInt(contractExpirationWarningDays) : undefined,
          defaultBillingDay: defaultBillingDay !== undefined ? (defaultBillingDay === null || defaultBillingDay === '' ? null : parseInt(defaultBillingDay)) : undefined,
          whatsappTemplate: whatsappTemplate ?? undefined,
          notifyComprobantePendiente: notifyComprobantePendiente !== undefined ? Boolean(notifyComprobantePendiente) : undefined,
          notifyContratoFirmado: notifyContratoFirmado !== undefined ? Boolean(notifyContratoFirmado) : undefined,
          notifyTicketCreado: notifyTicketCreado !== undefined ? Boolean(notifyTicketCreado) : undefined
        }
      }),
      prisma.usuario.update({
        where: { id: userId },
        data: {
          firstName: ownerFirstName !== undefined ? String(ownerFirstName).trim() : undefined,
          lastName: ownerLastName !== undefined ? String(ownerLastName).trim() || null : undefined,
          email: normalizedEmail,
          phone: ownerPhone !== undefined ? String(ownerPhone).trim() || null : undefined,
          document: ownerDocument !== undefined ? String(ownerDocument).trim() || null : undefined
        }
      })
    ]);

    res.json({
      companyName: updated.companyName,
      landlordRuc: updated.landlordRuc || '',
      landlordAddress: updated.landlordAddress || '',
      landlordSignatureUrl: updated.landlordSignatureUrl || '',
      lateFeePerDay: updated.lateFeePerDay,
      graceDays: updated.graceDays,
      contractExpirationWarningDays: updated.contractExpirationWarningDays,
      defaultBillingDay: updated.defaultBillingDay || null,
      whatsappTemplate: updated.whatsappTemplate || '',
      notifyComprobantePendiente: updated.notifyComprobantePendiente,
      notifyContratoFirmado: updated.notifyContratoFirmado,
      notifyTicketCreado: updated.notifyTicketCreado,
      ownerFirstName: updatedOwner.firstName || '',
      ownerLastName: updatedOwner.lastName || '',
      ownerEmail: updatedOwner.email || '',
      ownerPhone: updatedOwner.phone || '',
      ownerDocument: updatedOwner.document || ''
    });
  } catch (error) {
    console.error('Error en updateConfiguracion:', error);
    res.status(500).json({ error: 'Error al actualizar la configuración.' });
  }
};

// Sube/reemplaza la firma del propietario, reutilizada automáticamente en todos los contratos nuevos.
export const uploadLandlordSignature = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId!;
  const userRole = req.userRole;
  const { signatureImage } = req.body;

  if (userRole === 'INQUILINO') {
    res.status(403).json({ error: 'Acceso denegado. No tienes permisos para editar la configuración del negocio.' });
    return;
  }

  if (!signatureImage) {
    res.status(400).json({ error: 'La imagen de la firma es requerida.' });
    return;
  }

  try {
    const landlordSignatureUrl = await saveBase64Image(signatureImage, 'landlord-signatures');

    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: { landlordSignatureUrl }
    });

    res.json({ landlordSignatureUrl: updated.landlordSignatureUrl });
  } catch (error) {
    console.error('Error en uploadLandlordSignature:', error);
    res.status(500).json({ error: 'Error al guardar la firma del propietario.' });
  }
};
