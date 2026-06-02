import fs from 'fs';
import path from 'path';

/**
 * Guarda una imagen en base64 en el disco local y retorna la URL relativa.
 * @param base64Str Imagen codificada en Base64 (con o sin prefijo data:image/...)
 * @param folderName Carpeta destino dentro de uploads/ (ej: 'signatures', 'tickets', 'receipts')
 */
export function saveBase64Image(base64Str: string, folderName: string = 'general'): string {
  if (!base64Str) {
    throw new Error('Contenido de imagen base64 vacío.');
  }

  // Encontrar el tipo mime y los datos limpios
  const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  let ext = 'png';
  let buffer: Buffer;

  if (matches && matches.length === 3) {
    const mimeType = matches[1];
    buffer = Buffer.from(matches[2], 'base64');
    
    // Extraer extensión del tipo mime (ej: image/jpeg -> jpeg)
    const parts = mimeType.split('/');
    ext = parts[1] || 'png';
    if (ext === 'jpeg') ext = 'jpg';
  } else {
    // Si no contiene el prefijo del data URL, asumimos base64 crudo
    buffer = Buffer.from(base64Str, 'base64');
  }

  // Definir la ruta física y crear el directorio si no existe
  const uploadsDir = path.join(__dirname, '../../../uploads', folderName);
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Nombre de archivo único
  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
  const filePath = path.join(uploadsDir, filename);

  // Escribir el buffer binario en disco
  fs.writeFileSync(filePath, buffer);

  // Retornar la URL relativa para consumo HTTP
  return `/uploads/${folderName}/${filename}`;
}
