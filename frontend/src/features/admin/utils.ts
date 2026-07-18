import api from '../../core/services/api';

export const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });

// Última actividad relativa (login más reciente). null/undefined = nunca inició sesión.
export const formatLastActivity = (dateStr: string | null | undefined): string => {
  if (!dateStr) return 'Nunca';

  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Ahora';
  if (diffMin < 60) return `Hace ${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Hace ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return `Hace ${diffD}d`;
  return formatDate(dateStr);
};

// Descarga la respuesta CSV de un endpoint de exportación como archivo.
export const downloadCsv = async (path: string, filename: string) => {
  const res = await api.get(path, { responseType: 'blob' });
  const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
