// components/academico/PanelMetricasEstudiantes.tsx
// Panel de métricas académicas de todos los estudiantes del tenant.
// Visible SOLO para Admin, Editor y SuperAdmin.
// Permite buscar, filtrar y ver el detalle de cada estudiante.

import React from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { actividadService } from '../../servicios/academico/actividadService';
import { listarAsignacionesPorTenant } from '../../servicios/academico/asignacionService';
import { jornadaRepository } from '../../servicios/academico/jornadaRepository';
import { programaRepository } from '../../servicios/academico/programaRepository';
import {
  construirMapaAsignacionPrograma,
  listarProgramasConAsignaciones,
  escalarMetricasAPrograma,
} from '../../servicios/academico/analisisProgresoService';
import type { ActividadLog, MetricasEstudiante } from '../../models/academico/actividad';
import { useEstudiantes } from '../../context/DataContext';
import ProgresoEstudianteCard from './ProgresoEstudianteCard';
import PanelMetricasPorMaterial from './PanelMetricasPorMaterial';
import PanelMetricasPorHorario from './PanelMetricasPorHorario';

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
  const [filtroPrograma, setFiltroPrograma] = React.useState('todos');
  const [vista, setVista] = React.useState<'estudiante' | 'material' | 'horario'>('estudiante');
  const [logs, setLogs] = React.useState<ActividadLog[]>([]);
  const [logsCargando, setLogsCargando] = React.useState(false);
  const [logsCargados, setLogsCargados] = React.useState(false);
  const [accionDemo, setAccionDemo] = React.useState<'generando' | 'limpiando' | null>(null);
  const [mensajeDemo, setMensajeDemo] = React.useState<string | null>(null);

  // Datos para el cruce con Programa (filtro) y para el dashboard "Por Material":
  // asignacionId -> jornadaId -> programaId -> nombre. Ninguna colección/campo nuevo,
  // solo repositorios que ya existen (asignacionService/jornadaRepository/programaRepository).
  const [asignaciones, setAsignaciones] = React.useState<Awaited<ReturnType<typeof listarAsignacionesPorTenant>>>([]);
  const [jornadas, setJornadas] = React.useState<Awaited<ReturnType<typeof jornadaRepository.listarJornadasPorTenant>>>([]);
  const [programas, setProgramas] = React.useState<Awaited<ReturnType<typeof programaRepository.listarProgramasPorTenant>>>([]);

  React.useEffect(() => {
    if (!tenantId) return;
    Promise.all([
      listarAsignacionesPorTenant(tenantId),
      jornadaRepository.listarJornadasPorTenant(tenantId),
      programaRepository.listarProgramasPorTenant(tenantId),
    ])
      .then(([a, j, p]) => {
        setAsignaciones(a);
        setJornadas(j);
        setProgramas(p);
      })
      .catch((err) => console.error('[PanelMetricasEstudiantes] cruce de programa', err));
  }, [tenantId]);

  // Carga perezosa de ActividadLog (para la vista "Por Horario"): son potencialmente muchos
  // documentos por tenant, así que solo se traen la primera vez que el maestro entra a esa
  // pestaña, no junto con el resto de los datos del panel.
  React.useEffect(() => {
    if (vista !== 'horario' || logsCargados || !tenantId) return;
    setLogsCargando(true);
    actividadService
      .obtenerActividades({ tenantId })
      .then(({ logs: datos }) => {
        setLogs(datos);
        setLogsCargados(true);
      })
      .catch((err) => console.error('[PanelMetricasEstudiantes] carga de logs para Por Horario', err))
      .finally(() => setLogsCargando(false));
  }, [vista, logsCargados, tenantId]);

  const mapaAsignacionPrograma = React.useMemo(
    () => construirMapaAsignacionPrograma(asignaciones, jornadas, programas),
    [asignaciones, jornadas, programas]
  );
  const programasDisponibles = React.useMemo(
    () => listarProgramasConAsignaciones(mapaAsignacionPrograma),
    [mapaAsignacionPrograma]
  );
  const fechaAperturaPorAsignacion = React.useMemo(() => {
    const mapa = new Map<string, string>();
    for (const a of asignaciones) mapa.set(a.id, a.fechaApertura);
    return mapa;
  }, [asignaciones]);

  // Grado TKD por estudiante (pedido explícito 2026-07-17: mostrarlo en la fila). No vive
  // en MetricasEstudiante -- se cruza acá contra el registro real de Estudiante por id.
  const { estudiantes } = useEstudiantes();
  const gradoPorEstudianteId = React.useMemo(() => {
    const mapa = new Map<string, string>();
    for (const e of estudiantes) mapa.set(e.id, e.grado);
    return mapa;
  }, [estudiantes]);

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

  // ---- Recorte por Programa ----
  // Se aplica ANTES del resto de filtros: si hay un programa seleccionado, cada
  // estudiante se recalcula con SOLO sus asignaciones de ese programa (ver
  // escalarMetricasAPrograma) -- mostrar los números totales del estudiante filtraría la
  // lista pero seguiría mezclando el avance de otros programas, que es justo lo que un
  // filtro por programa debería evitar. Un estudiante sin ninguna asignación de ese
  // programa no aparece.
  const metricasEscaladas = React.useMemo(() => {
    if (filtroPrograma === 'todos') return metricas;
    return metricas
      .map((m) => escalarMetricasAPrograma(m, mapaAsignacionPrograma, filtroPrograma))
      .filter((m): m is MetricasEstudiante => m !== null);
  }, [metricas, filtroPrograma, mapaAsignacionPrograma]);

  // ---- Filtrado ----
  const metricasFiltradas = React.useMemo(() => {
    let lista = metricasEscaladas;

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
  }, [metricasEscaladas, busqueda, filtroEstado]);

  // ---- Estadísticas de resumen del panel ----
  // Simplificación 2026-07-17 (pedido explícito del usuario): "% de atraso" tal como se
  // pidió (iniciaron pero no revisaron material según lo planeado a la fecha) necesitaría
  // cruzar cada asignación contra su fecha de cierre real -- dato que hoy NO llega a
  // MetricasEstudiante/AvanceAsignacion (solo mide % de consumo, sin noción de "a tiempo").
  // Acordado con el usuario un proxy sin cambios de backend: "atrasado" = ya empezó
  // (asignacionesIniciadas > 0) pero su consumo global es bajo (<40%), mismo umbral que ya
  // usa estadoGlobal() para el badge "Atrasado". "Avance de estudio" NO es la resta literal
  // (al_dia - sin_iniciar - %atraso) -- eso mezcla cantidades de estudiantes con un
  // porcentaje, unidades incompatibles. Se usa en cambio el promedio de consumo global de
  // TODOS los estudiantes: un número con sentido real ("en promedio, cuánto ha avanzado el
  // grupo"), ya calculado antes como "promedioConsumo".
  const resumen = React.useMemo(() => {
    const total = metricasEscaladas.length;
    const alDia = metricasEscaladas.filter((m) => m.porcentajeGlobalConsumo >= 80).length;
    const sinIniciar = metricasEscaladas.filter((m) => m.asignacionesIniciadas === 0 && m.totalAsignaciones > 0).length;
    const atrasados = metricasEscaladas.filter(
      (m) => m.asignacionesIniciadas > 0 && m.porcentajeGlobalConsumo < 40
    ).length;
    const pctAtraso = total > 0 ? Math.round((atrasados / total) * 100) : 0;
    const avanceEstudio = total > 0
      ? Math.round(metricasEscaladas.reduce((s, m) => s + m.porcentajeGlobalConsumo, 0) / total)
      : 0;
    return { total, alDia, sinIniciar, pctAtraso, avanceEstudio };
  }, [metricasEscaladas]);

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
    // Ancho acotado (ajuste 2026-07-18 tras feedback visual): el KPI strip y la lista
    // compartían un contenedor de ancho completo, pero las columnas de cada fila tienen
    // ancho fijo (ver ProgresoEstudianteCard.tsx) -- eso dejaba un vacío visible a la
    // derecha de la lista sin ningún propósito. Se acota todo el panel al ancho real que
    // la lista necesita, en vez de estirar el KPI strip a un ancho que la lista no usa.
    <section
      className="max-w-[820px] space-y-5"
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

      {/* Selector Por Estudiante / Por Material -- misma data (metricas + cruce con
          Programa), dos lecturas distintas. Ver PanelMetricasPorMaterial.tsx. */}
      {metricas.length > 0 && (
        <div className="inline-flex w-fit bg-gray-100 dark:bg-white/5 rounded-2xl p-1 gap-1">
          <button
            type="button"
            onClick={() => setVista('estudiante')}
            className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wide transition-colors ${
              vista === 'estudiante'
                ? 'bg-white dark:bg-gray-900 text-tkd-blue shadow-sm'
                : 'text-gray-400'
            }`}
          >
            Por Estudiante
          </button>
          <button
            type="button"
            onClick={() => setVista('material')}
            className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wide transition-colors ${
              vista === 'material'
                ? 'bg-white dark:bg-gray-900 text-tkd-blue shadow-sm'
                : 'text-gray-400'
            }`}
          >
            Por Material
          </button>
          <button
            type="button"
            onClick={() => setVista('horario')}
            className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wide transition-colors ${
              vista === 'horario'
                ? 'bg-white dark:bg-gray-900 text-tkd-blue shadow-sm'
                : 'text-gray-400'
            }`}
          >
            Por Horario
          </button>
        </div>
      )}

      {/* KPIs del panel (vista Por Estudiante) */}
      {metricas.length > 0 && vista === 'estudiante' && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3" aria-label="Resumen de métricas">
          <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/10 p-4 text-center">
            <p className="text-2xl font-black text-tkd-blue">{resumen.total}</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Estudiantes</p>
          </div>
          <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/10 p-4 text-center">
            <p className="text-2xl font-black text-green-600">{resumen.alDia}</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Al día</p>
          </div>
          <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/10 p-4 text-center">
            <p className="text-2xl font-black text-red-500">{resumen.sinIniciar}</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Sin iniciar</p>
          </div>
          <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/10 p-4 text-center">
            <p className="text-2xl font-black text-orange-500">{resumen.pctAtraso}%</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Atraso</p>
          </div>
          <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/10 p-4 text-center">
            <p className="text-2xl font-black text-gray-700 dark:text-gray-200">{resumen.avanceEstudio}%</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Avance de estudio</p>
          </div>
        </div>
      )}

      {/* Filtros -- búsqueda y estado solo aplican a la vista Por Estudiante; el filtro
          de Programa es compartido por las dos vistas (misma selección en ambas). */}
      {metricas.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          {vista === 'estudiante' && (
            <>
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
            </>
          )}
          {programasDisponibles.length > 0 && (
            <select
              value={filtroPrograma}
              onChange={(e) => setFiltroPrograma(e.target.value)}
              className="rounded-2xl border border-tkd-blue/30 bg-tkd-blue/5 dark:bg-tkd-blue/10 px-4 py-2 text-sm font-bold text-tkd-blue focus:outline-none focus:ring-2 focus:ring-tkd-blue"
              aria-label="Filtrar por programa"
              id="filtro-programa-metricas"
            >
              <option value="todos">Todos los programas</option>
              {programasDisponibles.map((p) => (
                <option key={p.programaId} value={p.programaId}>{p.programaNombre}</option>
              ))}
            </select>
          )}
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
      ) : vista === 'material' ? (
        <PanelMetricasPorMaterial
          metricas={metricas}
          fechaAperturaPorAsignacion={fechaAperturaPorAsignacion}
          mapaAsignacionPrograma={mapaAsignacionPrograma}
          filtroPrograma={filtroPrograma}
        />
      ) : vista === 'horario' ? (
        logsCargando ? (
          <div className="rounded-[2rem] border border-gray-100 dark:border-white/10 p-8 text-sm text-gray-400 text-center">
            Cargando patrones de horario...
          </div>
        ) : (
          <PanelMetricasPorHorario
            logs={logs}
            mapaAsignacionPrograma={mapaAsignacionPrograma}
            filtroPrograma={filtroPrograma}
          />
        )
      ) : metricasFiltradas.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 dark:border-white/10 p-6 text-sm text-gray-400 text-center">
          No hay estudiantes que coincidan con los filtros.
        </div>
      ) : (
        <div>
          {/* Encabezado de columnas -- mismos anchos FIJOS que cada fila (ver comentario
              en ProgresoEstudianteCard.tsx) para que el título quede exactamente arriba
              de su valor, columna por columna. */}
          <div className="hidden sm:flex items-center gap-2 pb-2 border-b-2 border-gray-100 dark:border-white/10">
            <span className="w-4 shrink-0" aria-hidden />
            <span className="shrink-0 w-28 sm:w-36 text-[9px] font-black uppercase tracking-widest text-gray-400">
              Nombre
            </span>
            <span className="shrink-0 w-14 text-[9px] font-black uppercase tracking-widest text-gray-400">
              Grado
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <span className="w-12 text-center text-[9px] font-black uppercase tracking-widest text-gray-400">Iniciado</span>
              <span className="w-12 text-center text-[9px] font-black uppercase tracking-widest text-gray-400">Completo</span>
              <span className="w-14 text-center text-[9px] font-black uppercase tracking-widest text-gray-400">Evaluación</span>
            </div>
            <span className="w-20 shrink-0 text-[9px] font-black uppercase tracking-widest text-gray-400">
              Asignaciones
            </span>
            <span className="hidden md:inline shrink-0 w-24 text-[9px] font-black uppercase tracking-widest text-gray-400">
              Últ. actividad
            </span>
            <span className="w-36 shrink-0 text-[9px] font-black uppercase tracking-widest text-gray-400">Global</span>
          </div>

          {metricasFiltradas.map((m) => (
            <ProgresoEstudianteCard
              key={m.estudianteId}
              metricas={m}
              estado={estadoGlobal(m)}
              grado={gradoPorEstudianteId.get(m.estudianteId)}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default PanelMetricasEstudiantes;
