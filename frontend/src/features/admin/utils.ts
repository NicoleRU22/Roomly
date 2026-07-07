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
