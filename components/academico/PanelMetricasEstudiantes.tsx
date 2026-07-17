// components/academico/PanelMetricasEstudiantes.tsx
// Panel de métricas académicas de todos los estudiantes del tenant.
// Visible SOLO para Admin, Editor y SuperAdmin.
// Permite buscar, filtrar y ver el detalle de cada estudiante.

import React from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { actividadService } from '../../servicios/academico/actividadService';
import type { MetricasEstudiante } from '../../models/academico/actividad';
import ProgresoEstudianteCard from './ProgresoEstudianteCard';

// Prefijo usado por functions/academico/datosDemoProgreso.js para identificar (y poder
// limpiar) los registros sembrados por "Generar datos demo" — no son estudiantes reales.
const PREFIJO_DEMO = 'demo-progreso-';

// ---------------------------------------------------------------------------
// Helper: estado de badge de avance global
// ---------------------------------------------------------------------------

function estadoGlobal(m: MetricasEstudiante): { texto: string; className: string } {
  if (m.totalAsignaciones === 0) return { texto: 'Sin asignaciones', className: 'bg-gray-100 text-gray-500' };
  if (m.porcentajeGlobalConsumo >= 80) return { texto: 'Al día', className: 'bg-green-100 text-green-700' };
  if (m.porcentajeGlobalConsumo >= 40) return { texto: 'En progreso', className: 'bg-yellow-100 text-yellow-700' };
  if (m.asignacionesIniciadas === 0) return { texto: 'Sin iniciar', className: 'bg-red-100 text-red-600' };
  return { texto: 'Atrasado', className: 'bg-orange-100 text-orange-700' };
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export interface PanelMetricasEstudiantesProps {
  tenantId: string;
}

const PanelMetricasEstudiantes: React.FC<PanelMetricasEstudiantesProps> = ({ tenantId }) => {
  const [metricas, setMetricas] = React.useState<MetricasEstudiante[]>([]);
  const [cargando, setCargando] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busqueda, setBusqueda] = React.useState('');
  const [filtroEstado, setFiltroEstado] = React.useState<'todos' | 'al_dia' | 'en_progreso' | 'atrasado' | 'sin_iniciar'>('todos');
  const [expandidoId, setExpandidoId] = React.useState<string | null>(null);
  const [accionDemo, setAccionDemo] = React.useState<'generando' | 'limpiando' | null>(null);
  const [mensajeDemo, setMensajeDemo] = React.useState<string | null>(null);

  const cargarMetricas = React.useCallback(async () => {
    if (!tenantId) return;
    setCargando(true);
    setError(null);
    try {
      const { metricas: datos } = await actividadService.obtenerMetricas({ tenantId });
      setMetricas(datos.sort((a, b) =>
        (a.estudianteNombre ?? a.estudianteId).localeCompare(b.estudianteNombre ?? b.estudianteId)
      ));
    } catch (err: unknown) {
      setError('No se pudieron cargar las métricas de estudiantes.');
      console.error('[PanelMetricasEstudiantes]', err);
    } finally {
      setCargando(false);
    }
  }, [tenantId]);

  React.useEffect(() => {
    cargarMetricas();
  }, [cargarMetricas]);

  // ---- Datos demo (temporal, para presentaciones) ----
  const hayDatosDemo = metricas.some((m) => m.estudianteId.startsWith(PREFIJO_DEMO));

  const handleGenerarDemo = React.useCallback(async () => {
    setAccionDemo('generando');
    setMensajeDemo(null);
    try {
      const generar = httpsCallable<{ tenantId: string }, { ok: boolean; generados: number }>(
        getFunctions(),
        'generarDatosDemoProgreso'
      );
      const { data } = await generar({ tenantId });
      setMensajeDemo(`Se generaron ${data.generados} estudiantes de ejemplo.`);
      await cargarMetricas();
    } catch (err: unknown) {
      setMensajeDemo('No se pudieron generar los datos demo.');
      console.error('[PanelMetricasEstudiantes] generarDatosDemoProgreso', err);
    } finally {
      setAccionDemo(null);
    }
  }, [tenantId, cargarMetricas]);

  const handleLimpiarDemo = React.useCallback(async () => {
    setAccionDemo('limpiando');
    setMensajeDemo(null);
    try {
      const limpiar = httpsCallable<{ tenantId: string }, { ok: boolean; eliminados: number }>(
        getFunctions(),
        'limpiarDatosDemoProgreso'
      );
      const { data } = await limpiar({ tenantId });
      setMensajeDemo(`Se eliminaron ${data.eliminados} estudiantes de ejemplo.`);
      await cargarMetricas();
    } catch (err: unknown) {
      setMensajeDemo('No se pudieron eliminar los datos demo.');
      console.error('[PanelMetricasEstudiantes] limpiarDatosDemoProgreso', err);
    } finally {
      setAccionDemo(null);
    }
  }, [tenantId, cargarMetricas]);

  // ---- Filtrado ----
  const metricasFiltradas = React.useMemo(() => {
    let lista = metricas;

    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      lista = lista.filter((m) =>
        (m.estudianteNombre ?? m.estudianteId).toLowerCase().includes(q)
      );
    }

    if (filtroEstado !== 'todos') {
      lista = lista.filter((m) => {
        const { texto } = estadoGlobal(m);
        const mapa: Record<string, string> = {
          al_dia: 'Al día',
          en_progreso: 'En progreso',
          atrasado: 'Atrasado',
          sin_iniciar: 'Sin iniciar',
        };
        return texto === mapa[filtroEstado];
      });
    }

    return lista;
  }, [metricas, busqueda, filtroEstado]);

  // ---- Estadísticas de resumen del panel ----
  const resumen = React.useMemo(() => {
    const total = metricas.length;
    const alDia = metricas.filter((m) => m.porcentajeGlobalConsumo >= 80).length;
    const sinIniciar = metricas.filter((m) => m.asignacionesIniciadas === 0 && m.totalAsignaciones > 0).length;
    const promedioConsumo = total > 0
      ? Math.round(metricas.reduce((s, m) => s + m.porcentajeGlobalConsumo, 0) / total)
      : 0;
    return { total, alDia, sinIniciar, promedioConsumo };
  }, [metricas]);

  // ---- Render ----
  if (cargando) {
    return (
      <div className="rounded-[2rem] border border-gray-100 dark:border-white/10 p-8 text-sm text-gray-400 text-center">
        Cargando métricas de estudiantes...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[2rem] border border-red-100 dark:border-red-900 bg-red-50 dark:bg-red-900/20 p-6 text-sm text-red-600 dark:text-red-300">
        {error}
      </div>
    );
  }

  return (
    <section
      className="space-y-5"
      aria-label="Panel de métricas académicas por estudiante"
    >
      {/* Encabezado del panel */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-400">Métricas académicas</p>
          <h2 className="text-2xl font-black uppercase text-tkd-dark dark:text-white">
            Progreso por Estudiante
          </h2>
        </div>
        {hayDatosDemo && (
          <button
            type="button"
            onClick={handleLimpiarDemo}
            disabled={accionDemo !== null}
            className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50 self-start sm:self-auto"
          >
            {accionDemo === 'limpiando' ? 'Eliminando datos demo...' : '✕ Limpiar datos demo'}
          </button>
        )}
      </div>

      {mensajeDemo && (
        <p className="text-xs font-bold text-tkd-blue">{mensajeDemo}</p>
      )}

      {/* KPIs del panel */}
      {metricas.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" aria-label="Resumen de métricas">
          <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/10 p-4 text-center">
            <p className="text-2xl font-black text-tkd-blue">{resumen.total}</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Estudiantes</p>
          </div>
          <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/10 p-4 text-center">
            <p className="text-2xl font-black text-green-600">{resumen.alDia}</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Al día (≥80%)</p>
          </div>
          <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/10 p-4 text-center">
            <p className="text-2xl font-black text-red-500">{resumen.sinIniciar}</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Sin iniciar</p>
          </div>
          <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/10 p-4 text-center">
            <p className="text-2xl font-black text-gray-700 dark:text-gray-200">{resumen.promedioConsumo}%</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Consumo promedio</p>
          </div>
        </div>
      )}

      {/* Filtros */}
      {metricas.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="search"
            placeholder="Buscar estudiante..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="flex-1 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-bold text-gray-700 dark:text-gray-200 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-tkd-blue"
            aria-label="Buscar estudiante por nombre"
            id="buscar-estudiante-metricas"
          />
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value as typeof filtroEstado)}
            className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-bold text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-tkd-blue"
            aria-label="Filtrar por estado de progreso"
            id="filtro-estado-metricas"
          >
            <option value="todos">Todos los estados</option>
            <option value="al_dia">Al día</option>
            <option value="en_progreso">En progreso</option>
            <option value="atrasado">Atrasado</option>
            <option value="sin_iniciar">Sin iniciar</option>
          </select>
        </div>
      )}

      {/* Lista de tarjetas */}
      {metricas.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 p-10 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-tkd-blue">
            Sin actividad registrada
          </p>
          <h3 className="mt-3 text-xl font-black uppercase text-tkd-dark dark:text-white">
            Aún no hay interacciones de estudiantes
          </h3>
          <p className="mt-3 text-sm font-bold text-gray-400">
            Las métricas aparecerán aquí cuando los estudiantes empiecen a consumir el material asignado.
          </p>
          <p className="mt-2 text-xs font-bold text-gray-400">
            Asignar material a una clase no genera actividad por sí solo: cada estudiante
            debe abrirlo desde su propio Centro de Estudios.
          </p>
          <button
            type="button"
            onClick={handleGenerarDemo}
            disabled={accionDemo !== null}
            className="mt-5 rounded-2xl bg-tkd-blue px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {accionDemo === 'generando' ? 'Generando...' : 'Generar datos demo'}
          </button>
        </div>
      ) : metricasFiltradas.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 dark:border-white/10 p-6 text-sm text-gray-400 text-center">
          No hay estudiantes que coincidan con los filtros.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {metricasFiltradas.map((m) => {
            const badge = estadoGlobal(m);
            return (
              <div key={m.estudianteId} className="relative">
                {/* Badge de estado */}
                <span
                  className={`absolute top-4 right-4 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full z-10 ${badge.className}`}
                >
                  {badge.texto}
                </span>
                <ProgresoEstudianteCard
                  metricas={m}
                  expandido={expandidoId === m.estudianteId}
                  onToggleExpandido={() =>
                    setExpandidoId((prev) =>
                      prev === m.estudianteId ? null : m.estudianteId
                    )
                  }
                />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default PanelMetricasEstudiantes;
