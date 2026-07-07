import React from 'react';

interface GrowthPoint {
  weekStart: string;
  newTenants: number;
  newUsuarios: number;
}

const formatWeekLabel = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });

export const GrowthChart: React.FC<{ series: GrowthPoint[] }> = ({ series }) => {
  const maxValue = Math.max(1, ...series.map((p) => Math.max(p.newTenants, p.newUsuarios)));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-xs font-semibold text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-purple-650 inline-block" />
          Tenants nuevos
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />
          Usuarios nuevos
        </span>
      </div>

      <div className="flex items-end gap-2.5 h-40">
        {series.map((point) => (
          <div key={point.weekStart} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group">
            <div className="flex items-end gap-0.5 h-full w-full justify-center">
              <div
                className="w-1/2 max-w-[10px] rounded-t bg-purple-650/80 group-hover:bg-purple-650 transition-colors"
                style={{ height: `${(point.newTenants / maxValue) * 100}%`, minHeight: point.newTenants > 0 ? '3px' : '0' }}
                title={`${point.newTenants} tenants nuevos`}
              />
              <div
                className="w-1/2 max-w-[10px] rounded-t bg-emerald-600/80 group-hover:bg-emerald-600 transition-colors"
                style={{ height: `${(point.newUsuarios / maxValue) * 100}%`, minHeight: point.newUsuarios > 0 ? '3px' : '0' }}
                title={`${point.newUsuarios} usuarios nuevos`}
              />
            </div>
            <span className="text-[9px] text-muted-foreground whitespace-nowrap rotate-0">
              {formatWeekLabel(point.weekStart)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
