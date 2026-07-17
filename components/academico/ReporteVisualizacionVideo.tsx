// components/academico/ReporteVisualizacionVideo.tsx
// Paso 7: reporte para el staff (Admin/Editor/Asistente/Maestro) de quién realmente miró
// un material de video de YouTube -- antes de este cambio no existía ninguna forma de
// saber si un alumno vio un video de Drive, solo que el proxy sirvió el archivo una vez.
// Lee servicios/academico/visualizacionRepository.ts (colección
// tenants/{tenantId}/visualizaciones/{recursoId}/alumnos/{uid}).

import React from 'react';
import {
  visualizacionRepository as defaultVisualizacionRepository,
  type VisualizacionRepository,
  type VisualizacionVideo,
} from '../../servicios/academico/visualizacionRepository';
import { IconoCerrar } from '../Iconos';

export interface ReporteVisualizacionVideoProps {
  tenantId: string;
  recursoId: string;
  tituloRecurso: string;
  onCerrar: () => void;
  repository?: Pick<VisualizacionRepository, 'listarPorRecurso'>;
}

function formatearFecha(iso?: string): string {
  if (!iso) return '--';
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '--';
  return fecha.toLocaleString();
}

const ReporteVisualizacionVideo: React.FC<ReporteVisualizacionVideoProps> = ({
  tenantId,
  recursoId,
  tituloRecurso,
  onCerrar,
  repository = defaultVisualizacionRepository,
}) => {
  const [visualizaciones, setVisualizaciones] = React.useState<VisualizacionVideo[]>([]);
  const [cargando, setCargando] = React.useState(true);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    let activo = true;
    setCargando(true);
    setError('');

    repository.listarPorRecurso(tenantId, recursoId)
      .then((datos) => {
        if (!activo) return;
        const ordenados = [...datos].sort((a, b) =>
          (a.estudianteNombre ?? a.estudianteId).localeCompare(b.estudianteNombre ?? b.estudianteId)
        );
        setVisualizaciones(ordenados);
      })
      .catch((err) => {
        if (!activo) return;
        console.warn('[ReporteVisualizacionVideo] No se pudo cargar el reporte', err);
        setError('No se pudo cargar el reporte de visualización.');
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => { activo = false; };
  }, [repository, tenantId, recursoId]);

  const resumen = React.useMemo(() => {
    const total = visualizaciones.length;
    const completados = visualizaciones.filter((v) => v.completado).length;
    const promedioVisto = total > 0
      ? Math.round(visualizaciones.reduce((s, v) => s + v.porcentajeVisto, 0) / total)
      : 0;
    return { total, completados, promedioVisto };
  }, [visualizaciones]);

  return (
    <div
      className="fixed inset-0 z-[130] flex items-start justify-center overflow-y-auto bg-black/40 p-4 py-12 sm:py-16"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-reporte-visualizacion"
    >
      <div className="max-h-[calc(100dvh-8rem)] w-full max-w-3xl overflow-y-auto rounded-[2rem] bg-white p-6 shadow-2xl dark:bg-gray-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-tkd-red">Reporte de visualización</p>
            <h3 id="modal-reporte-visualizacion" className="mt-2 text-2xl font-black uppercase text-tkd-dark dark:text-white">
              {tituloRecurso}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar reporte de visualización"
            className="shrink-0 w-10 h-10 rounded-2xl bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-300 hover:bg-tkd-red hover:text-white transition-all flex items-center justify-center"
          >
            <IconoCerrar className="w-5 h-5" />
          </button>
        </div>

        {cargando ? (
          <p className="mt-6 text-sm font-bold text-gray-400">Cargando reporte de visualización...</p>
        ) : error ? (
          <div className="mt-6 rounded-2xl bg-red-50 text-red-700 p-4 text-sm font-bold">{error}</div>
        ) : visualizaciones.length === 0 ? (
          <div className="mt-6 rounded-[1.5rem] border border-dashed border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-8 text-center">
            <p className="text-sm font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">
              Todavía nadie miró este video
            </p>
            <p className="mt-2 text-xs font-bold text-gray-400">
              Este reporte se completa a medida que los alumnos reproducen el video desde su Centro de Estudios.
            </p>
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            <div className="grid grid-cols-3 gap-3" aria-label="Resumen del reporte">
              <div className="rounded-2xl bg-gray-50 dark:bg-white/5 p-4 text-center">
                <p className="text-2xl font-black text-tkd-blue">{resumen.total}</p>
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Alumnos</p>
              </div>
              <div className="rounded-2xl bg-gray-50 dark:bg-white/5 p-4 text-center">
                <p className="text-2xl font-black text-green-600">{resumen.completados}</p>
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Completaron</p>
              </div>
              <div className="rounded-2xl bg-gray-50 dark:bg-white/5 p-4 text-center">
                <p className="text-2xl font-black text-tkd-dark dark:text-white">{resumen.promedioVisto}%</p>
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Promedio visto</p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-white/10">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 dark:bg-white/5 text-[10px] font-black uppercase tracking-widest text-gray-400">
                  <tr>
                    <th scope="col" className="px-4 py-3">Alumno</th>
                    <th scope="col" className="px-4 py-3">% visto</th>
                    <th scope="col" className="px-4 py-3">Completado</th>
                    <th scope="col" className="px-4 py-3">Última vez visto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/10">
                  {visualizaciones.map((v) => (
                    <tr key={v.estudianteId}>
                      <td className="px-4 py-3 font-bold text-tkd-dark dark:text-white">
                        {v.estudianteNombre ?? v.estudianteId}
                      </td>
                      <td className="px-4 py-3 font-bold text-tkd-blue">{v.porcentajeVisto}%</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${
                            v.completado
                              ? 'bg-green-100 text-green-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {v.completado ? 'Sí' : 'No'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                        {formatearFecha(v.actualizadoEn)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReporteVisualizacionVideo;
