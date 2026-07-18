import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Sube una imagen en base64 a Cloudinary y retorna su URL pública.
 * Reemplaza el guardado en disco local, que no persiste entre despliegues.
 * @param base64Str Imagen codificada en Base64 (con o sin prefijo data:image/...)
 * @param folderName Carpeta destino dentro de Cloudinary (ej: 'signatures', 'tickets', 'receipts')
 */
export async function saveBase64Image(base64Str: string, folderName: string = 'general'): Promise<string> {
  if (!base64Str) {
    throw new Error('Contenido de imagen base64 vacío.');
  }

  const dataUri = base64Str.startsWith('data:') ? base64Str : `data:image/png;base64,${base64Str}`;

  const result = await cloudinary.uploader.upload(dataUri, {
    folder: `roomly/${folderName}`,
  });

  return result.secure_url;
}
