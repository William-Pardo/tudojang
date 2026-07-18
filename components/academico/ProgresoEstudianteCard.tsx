// components/academico/ProgresoEstudianteCard.tsx
// Fila de progreso académico de UN estudiante, dentro de la lista de
// PanelMetricasEstudiantes. Rediseño 2026-07-17 (pedido explícito del usuario, ver
// "ux progreso estudio.jpeg"): pasa de tarjeta individual con contenedor propio a fila
// limpia sin contenedor, separada de la siguiente por una línea gris clara -- pensado
// para que un maestro lea rápido a todo su grupo sin que cada estudiante compita
// visualmente por atención (tarjetas con sombra/borde propio).

import React from 'react';
import type { MetricasEstudiante } from '../../models/academico/actividad';
import {
  IconoEstudiantes,
  IconoImagen,
  IconoQuiz,
  IconoContrato,
  IconoFirma,
  IconoCerrar,
} from '../Iconos';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatearFecha(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Umbral (días) a partir del cual "última actividad" se marca como alerta -- un
// estudiante con % bajo Y muchos días sin tocar nada necesita una intervención
// distinta que uno que simplemente arrancó tarde. Ver boceto "ux progreso estudio".
const DIAS_ALERTA_INACTIVIDAD = 14;

function formatearActividadRelativa(iso?: string): { texto: string; alerta: boolean } {
  if (!iso) return { texto: 'Sin actividad', alerta: false };

  const diffMs = Date.now() - new Date(iso).getTime();
  const minutos = Math.floor(diffMs / 60000);
  const horas = Math.floor(diffMs / 3600000);
  const dias = Math.floor(diffMs / 86400000);
  const semanas = Math.floor(dias / 7);
  const alerta = dias >= DIAS_ALERTA_INACTIVIDAD;

  if (minutos < 1) return { texto: 'Recién', alerta };
  if (horas < 1) return { texto: `Hace ${minutos}min`, alerta };
  if (dias < 1) return { texto: `Hace ${horas}h`, alerta };
  if (dias === 1) return { texto: 'Ayer', alerta };
  if (dias < 7) return { texto: `Hace ${dias} días`, alerta };
  return { texto: `Hace ${semanas} semana${semanas > 1 ? 's' : ''}`, alerta };
}

// Mismo mapeo de tipo -> ícono ya establecido en AsignarMaterialWizard.tsx
// (IconoTipoRecurso), para que el ícono de una asignación se vea igual en todo el
// módulo académico, ya sea al asignarla o al ver el progreso sobre ella. Todos siguen
// la convención BaseIcon (trazo, sin relleno), por eso alcanza con heredar el color.
export function IconoPorTipo({ tipo, className }: { tipo: string; className?: string }) {
  switch (tipo) {
    case 'imagen':
      return <IconoImagen className={className} />;
    case 'quiz':
      return <IconoQuiz className={className} />;
    case 'video':
    case 'presentacion':
      return <IconoFirma className={className} />;
    default:
      return <IconoContrato className={className} />;
  }
}

function colorBarraConsumo(pct: number): string {
  if (pct >= 80) return 'bg-green-500';
  if (pct >= 40) return 'bg-yellow-400';
  return 'bg-red-400';
}

// ---------------------------------------------------------------------------
// Modal "Ver asignaciones": detalle de actividad por material, una fila vertical
// por asignación (nombre, fecha, % de consumo).
// ---------------------------------------------------------------------------

interface ModalVerAsignacionesProps {
  estudianteNombre: string;
  avancePorAsignacion: MetricasEstudiante['avancePorAsignacion'];
  onCerrar: () => void;
}

const ModalVerAsignaciones: React.FC<ModalVerAsignacionesProps> = ({
  estudianteNombre,
  avancePorAsignacion,
  onCerrar,
}) => (
  <div
    className="fixed inset-0 z-[150] flex items-center justify-center bg-tkd-dark/90 p-4 animate-fade-in backdrop-blur-sm"
    onClick={onCerrar}
  >
    <div
      className="bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-4 p-6 border-b border-gray-100 dark:border-white/10 shrink-0">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Ver asignaciones</p>
          <h3 className="text-lg font-black text-tkd-dark dark:text-white truncate">{estudianteNombre}</h3>
        </div>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar"
          className="text-gray-400 hover:text-tkd-red transition-colors shrink-0"
        >
          <IconoCerrar className="w-5 h-5" />
        </button>
      </div>

      <ul className="overflow-y-auto p-6 space-y-4">
        {avancePorAsignacion.map((avance) => (
          <li
            key={avance.asignacionId}
            className="flex flex-col gap-1.5 pb-4 border-b border-gray-100 dark:border-white/10 last:border-0 last:pb-0"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white truncate">
                <IconoPorTipo tipo={avance.tipoRecurso} className="w-4 h-4 text-tkd-blue shrink-0" />
                {avance.tituloRecurso || '(Sin título)'}
              </span>
              <span className="text-[10px] font-black uppercase text-gray-400 shrink-0">
                {formatearFecha(avance.ultimaActividadEn)}
              </span>
            </div>
            <div className="relative h-1.5 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${colorBarraConsumo(avance.porcentajeConsumo)}`}
                style={{ width: `${avance.porcentajeConsumo}%` }}
                role="progressbar"
                aria-valuenow={avance.porcentajeConsumo}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${avance.porcentajeConsumo}% de consumo`}
              />
            </div>
            <span className="text-[10px] font-semibold text-tkd-blue">
              {avance.porcentajeConsumo}% consumido
            </span>
          </li>
        ))}
      </ul>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Sub-componente: iconos de asignaciones (máximo 3 + "...")
// ---------------------------------------------------------------------------

const MAX_ICONOS_VISIBLES = 3;

interface IconosAsignacionesProps {
  avancePorAsignacion: MetricasEstudiante['avancePorAsignacion'];
  onAbrir: () => void;
}

// Ancho FIJO (no depende de cuántos íconos haya) -- si este ancho variara por fila
// (ej. con un simple `flex gap`), el bloque Iniciado/Completo/Evaluación de al lado
// (que reparte el espacio restante) terminaría con un ancho distinto en cada fila y los
// valores dejarían de alinearse verticalmente entre estudiantes. Ver nota en el render
// principal: TODAS las columnas de esta fila usan ancho fijo por el mismo motivo.
const ANCHO_COLUMNA_ASIGNACIONES = 'w-20';

const IconosAsignaciones: React.FC<IconosAsignacionesProps> = ({ avancePorAsignacion, onAbrir }) => {
  if (avancePorAsignacion.length === 0) {
    return (
      <span className={`${ANCHO_COLUMNA_ASIGNACIONES} shrink-0 text-xs font-bold text-gray-300`}>—</span>
    );
  }

  const visibles = avancePorAsignacion.slice(0, MAX_ICONOS_VISIBLES);
  const hayMas = avancePorAsignacion.length > MAX_ICONOS_VISIBLES;

  return (
    <button
      type="button"
      onClick={onAbrir}
      className={`${ANCHO_COLUMNA_ASIGNACIONES} shrink-0 flex items-center gap-1.5 hover:opacity-70 transition-opacity`}
      aria-label={`Ver asignaciones (${avancePorAsignacion.length})`}
    >
      {visibles.map((avance) => (
        <IconoPorTipo key={avance.asignacionId} tipo={avance.tipoRecurso} className="w-4 h-4 text-tkd-blue" />
      ))}
      {hayMas && <span className="text-xs font-semibold text-tkd-blue leading-none">...</span>}
    </button>
  );
};

// ---------------------------------------------------------------------------
// Componente principal: fila de progreso de un estudiante
// ---------------------------------------------------------------------------

export interface ProgresoEstudianteCardProps {
  metricas: MetricasEstudiante;
  /** Badge de estado (Al día / En progreso / Atrasado / Sin iniciar), ya resuelto por el panel. */
  estado: { texto: string; className: string };
  /** Grado TKD del estudiante (cruzado por el panel contra el registro real de Estudiante). */
  grado?: string;
}

const ProgresoEstudianteCard: React.FC<ProgresoEstudianteCardProps> = ({ metricas, estado, grado }) => {
  const [modalAbierto, setModalAbierto] = React.useState(false);

  const {
    estudianteNombre,
    porcentajeGlobalConsumo,
    totalAsignaciones,
    asignacionesIniciadas,
    asignacionesCompletadas,
    avancePorAsignacion,
  } = metricas;

  const asignacionesQuiz = avancePorAsignacion.filter((a) => a.tipoRecurso === 'quiz');
  const evaluacionesHechas = asignacionesQuiz.filter((a) => (a.vecesEvaluado ?? 0) > 0).length;

  const nombre = estudianteNombre ?? metricas.estudianteId;
  const actividad = formatearActividadRelativa(metricas.ultimaActividadEn);

  return (
    // Rediseño 2026-07-17 (ajuste tras feedback visual): TODAS las columnas usan ancho
    // FIJO (w-*, nunca flex-1/grid con "lo que sobre"). Antes el bloque Iniciado/Completo/
    // Evaluación era flex-1 -- pero el ancho "restante" varía por fila según cuántos
    // íconos de asignación hay y qué tan largo es el texto del pill de estado ("Al día" vs
    // "Sin asignaciones"), así que cada fila terminaba con columnas de ancho distinto y los
    // valores no alineaban verticalmente entre estudiantes. Con ancho fijo en cada columna
    // (nombre, grado, iniciado, completo, evaluación, asignaciones, global, pill) el
    // alineado es exacto sin importar el contenido de cada fila.
    //
    // La animación de hover fue reducida de 5% a 1.5% (5% en una fila de tabla ancha son
    // muchos píxeles reales) y se sacó `position: relative` (alternar de static a relative
    // en cada hover producía el salto vertical de toda la vista).
    <div
      className="flex items-center gap-2 py-3 border-b border-gray-100 dark:border-white/10 last:border-0 rounded-xl transition-transform duration-150 ease-out hover:scale-[1.015]"
      aria-label={`Progreso académico de ${nombre}`}
    >
      <IconoEstudiantes className="w-4 h-4 text-tkd-blue shrink-0" aria-hidden />

      <p className="shrink-0 w-28 sm:w-36 truncate text-sm font-light text-black dark:text-white">
        {nombre}
      </p>

      <span className="hidden sm:inline shrink-0 w-14 truncate text-[10px] font-bold uppercase text-gray-400">
        {grado ?? ''}
      </span>

      <div className="hidden sm:flex items-center gap-2 shrink-0">
        <span className="w-12 text-xs font-semibold text-tkd-blue text-center whitespace-nowrap">
          {asignacionesIniciadas}/{totalAsignaciones}
        </span>
        <span className="w-12 text-xs font-semibold text-tkd-blue text-center whitespace-nowrap">
          {asignacionesCompletadas}/{totalAsignaciones}
        </span>
        <span className="w-14 text-xs font-semibold text-tkd-blue text-center whitespace-nowrap">
          {evaluacionesHechas}/{asignacionesQuiz.length}
        </span>
      </div>

      <IconosAsignaciones avancePorAsignacion={avancePorAsignacion} onAbrir={() => setModalAbierto(true)} />

      <span
        className={`hidden md:inline shrink-0 w-24 text-[11px] font-semibold whitespace-nowrap ${
          actividad.alerta ? 'text-tkd-red' : 'text-gray-400'
        }`}
      >
        {actividad.texto}
      </span>

      <div className="flex items-center gap-2 w-36 shrink-0">
        <span className="w-10 text-sm font-semibold text-tkd-blue whitespace-nowrap">
          {porcentajeGlobalConsumo}%
        </span>
        <span
          className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full whitespace-nowrap ${estado.className}`}
        >
          {estado.texto}
        </span>
      </div>

      {modalAbierto && (
        <ModalVerAsignaciones
          estudianteNombre={nombre}
          avancePorAsignacion={avancePorAsignacion}
          onCerrar={() => setModalAbierto(false)}
        />
      )}
    </div>
  );
};

export default ProgresoEstudianteCard;
