import React from 'react';
import { GradoTKD } from '../../tipos';
import type { MomentoAsignacion } from '../../models/academico';
import type { RecursoAcademico } from '../../models/academico/recurso';
import { IconoAprobar, IconoCerrar, IconoContrato, IconoFirma, IconoImagen } from '../Iconos';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type DestinatarioWizard = 'grupo' | 'estudiante';
export type CriterioAsignacionWizard = 'estudio' | 'repaso' | 'refuerzo' | 'evaluacion' | 'quiz';

export interface AsignacionDraft {
  recursoId: string;
  destinatario: DestinatarioWizard;
  grupoObjetivo: string;
  momento: MomentoAsignacion;
  criterio: CriterioAsignacionWizard;
  fechaApertura: string;
  fechaCierre: string;
  grados: GradoTKD[];
}

interface AsignarMaterialWizardProps {
  modo: 'crear' | 'editar';
  /** Ya excluidos (duplicados de la clase activa) y priorizados por tags por el padre. */
  materialesDisponibles: RecursoAcademico[];
  tagsPrograma: string[];
  gruposObjetivo: string[];
  draftInicial: AsignacionDraft | null;
  onCancelar: () => void;
  onConfirmar: (draft: AsignacionDraft) => Promise<void>;
}

type PasoAsistente = 1 | 2 | 3;

const PASOS_ASISTENTE: { numero: PasoAsistente; etiqueta: string }[] = [
  { numero: 1, etiqueta: 'Material' },
  { numero: 2, etiqueta: 'Configurar' },
  { numero: 3, etiqueta: 'Grados' },
];

const crearDraftVacio = (gruposObjetivo: string[]): AsignacionDraft => ({
  recursoId: '',
  destinatario: 'grupo',
  grupoObjetivo: gruposObjetivo[0] ?? '',
  momento: 'preparacion',
  criterio: 'estudio',
  fechaApertura: new Date().toISOString().slice(0, 10),
  fechaCierre: '',
  grados: [],
});

// Serializa los campos editables del draft para comparar snapshots. Mismo
// patron que serializarProgramaParaCambios/programaTieneCambiosSinGuardar en
// AsignacionesView.tsx: JSON.stringify de un objeto con los campos
// relevantes, con `grados` ordenado para que el orden de los clicks no
// cuente como "cambio".
function serializarDraftParaCambios(draft: AsignacionDraft | null): string {
  if (!draft) return '';
  return JSON.stringify({
    recursoId: draft.recursoId,
    destinatario: draft.destinatario,
    grupoObjetivo: draft.grupoObjetivo,
    momento: draft.momento,
    criterio: draft.criterio,
    fechaApertura: draft.fechaApertura,
    fechaCierre: draft.fechaCierre,
    grados: [...draft.grados].sort(),
  });
}

const normalizarTag = (tag: string) => tag.trim().toLowerCase();

/**
 * Cuenta cuantos tags de la ficha del recurso coinciden con los tags del
 * programa activo. Equivalente (en conteo, no booleano) a
 * `coincideTagsConPrograma` de AsignacionesView.tsx; se reimplementa aqui
 * porque ese helper no esta exportado y este componente debe ser autonomo.
 */
function contarTagsCoincidentes(recurso: RecursoAcademico, tagsPrograma: string[]): number {
  if (tagsPrograma.length === 0) return 0;
  const tagsProgramaNormalizados = tagsPrograma.map(normalizarTag);
  return (recurso.ficha?.tags ?? []).filter((tag) => tagsProgramaNormalizados.includes(normalizarTag(tag))).length;
}

// Misma cadena de respaldo que usa AsignacionesView.tsx (tituloVisible || nombre).
function tituloRecurso(recurso: RecursoAcademico): string {
  return recurso.tituloVisible || recurso.nombre;
}

const IconoTipoRecurso: React.FC<{ mimeType?: string; className?: string }> = ({ mimeType = '', className = 'h-4 w-4' }) => {
  if (mimeType.startsWith('image/')) return <IconoImagen className={className} />;
  if (mimeType.startsWith('video/') || mimeType.includes('presentation')) return <IconoFirma className={className} />;
  return <IconoContrato className={className} />;
};

// ---------------------------------------------------------------------------
// StepBar
// ---------------------------------------------------------------------------

const StepBar: React.FC<{ paso: PasoAsistente }> = ({ paso }) => (
  <ol className="mb-6 flex items-center" aria-label="Progreso del asistente">
    {PASOS_ASISTENTE.map((item, index) => {
      const completado = paso > item.numero;
      const activo = paso === item.numero;
      return (
        <li key={item.numero} className="flex flex-1 items-center last:flex-none">
          <div className="flex shrink-0 items-center gap-2">
            <span
              aria-current={activo ? 'step' : undefined}
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black transition-all ${
                completado || activo ? 'bg-tkd-blue text-white' : 'bg-gray-100 text-gray-400 dark:bg-white/10'
              } ${activo ? 'ring-4 ring-tkd-blue/20' : ''}`}
            >
              {completado ? <IconoAprobar className="h-3.5 w-3.5" /> : item.numero}
            </span>
            <span className={`text-[11px] font-black uppercase tracking-widest ${activo ? 'text-tkd-dark dark:text-white' : 'text-gray-400'}`}>
              {item.etiqueta}
            </span>
          </div>
          {index < PASOS_ASISTENTE.length - 1 && (
            <div className={`mx-3 h-px flex-1 transition-colors ${completado ? 'bg-tkd-blue' : 'bg-gray-200 dark:bg-white/10'}`} />
          )}
        </li>
      );
    })}
  </ol>
);

// ---------------------------------------------------------------------------
// Step 1: seleccion de material (busqueda + badge de coincidencia de tags)
// ---------------------------------------------------------------------------

interface Step1Props {
  draft: AsignacionDraft;
  materialesDisponibles: RecursoAcademico[];
  tagsPrograma: string[];
  onActualizar: (cambios: Partial<AsignacionDraft>) => void;
  onContinuar: () => void;
}

const Step1: React.FC<Step1Props> = ({ draft, materialesDisponibles, tagsPrograma, onActualizar, onContinuar }) => {
  const [busqueda, setBusqueda] = React.useState('');
  const [mostrarTodos, setMostrarTodos] = React.useState(false);

  // materialesDisponibles ya llega excluido (duplicados) y priorizado por tags
  // desde AsignacionesView.tsx: este picker solo filtra por texto, nunca reordena,
  // para no pisar la priorizacion recibida.
  const filtrados = materialesDisponibles.filter((recurso) => (
    tituloRecurso(recurso).toLowerCase().includes(busqueda.trim().toLowerCase())
  ));

  const conMatch = filtrados.filter((recurso) => contarTagsCoincidentes(recurso, tagsPrograma) > 0);
  const sinMatch = filtrados.filter((recurso) => contarTagsCoincidentes(recurso, tagsPrograma) === 0);
  // Si nada matchea (p.ej. el programa no tiene tags), mostrar todo en vez de
  // dejar la lista vacia esperando un click en "ver sin match".
  const visibles = conMatch.length > 0 && !mostrarTodos ? conMatch : filtrados;

  return (
    <div className="space-y-3">
      <input
        type="search"
        value={busqueda}
        onChange={(event) => setBusqueda(event.target.value)}
        placeholder="Buscar material..."
        aria-label="Buscar material"
        className="w-full rounded-2xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-tkd-dark focus:outline-none focus:ring-2 focus:ring-tkd-blue/30"
      />

      <p className="px-1 text-xs font-bold text-gray-400">
        <span className="text-tkd-blue">{conMatch.length}</span> materiales coinciden con los tags del programa
        {sinMatch.length > 0 && !mostrarTodos && (
          <button
            type="button"
            onClick={() => setMostrarTodos(true)}
            className="ml-2 font-black text-tkd-blue hover:underline"
          >
            + ver {sinMatch.length} sin match
          </button>
        )}
      </p>

      <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
        {visibles.length === 0 && (
          <p className="py-6 text-center text-sm font-bold text-gray-400">Sin materiales disponibles.</p>
        )}
        {visibles.map((recurso) => {
          const seleccionado = draft.recursoId === recurso.id;
          const coincidencias = contarTagsCoincidentes(recurso, tagsPrograma);
          return (
            <button
              key={recurso.id}
              type="button"
              onClick={() => onActualizar({ recursoId: recurso.id })}
              aria-pressed={seleccionado}
              className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-all ${
                seleccionado
                  ? 'border-tkd-blue bg-blue-50 ring-2 ring-tkd-blue/20'
                  : 'border-gray-200 bg-white hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-white/5'
              }`}
            >
              <IconoTipoRecurso mimeType={recurso.mimeType} />
              <span className="flex-1 truncate text-sm font-medium text-tkd-dark dark:text-white">{tituloRecurso(recurso)}</span>
              {coincidencias > 0 && (
                <span className="shrink-0 rounded-full bg-tkd-blue/10 px-2 py-0.5 text-[10px] font-black text-tkd-blue">
                  {coincidencias} tag{coincidencias === 1 ? '' : 's'}
                </span>
              )}
              {seleccionado && <IconoAprobar className="h-4 w-4 shrink-0 text-tkd-blue" />}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        disabled={!draft.recursoId}
        onClick={onContinuar}
        className="w-full rounded-2xl bg-tkd-blue py-3 text-[11px] font-black uppercase tracking-widest text-white transition disabled:cursor-not-allowed disabled:opacity-40"
      >
        Continuar
      </button>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Step 2: configuracion (destinatario, grupo, momento, criterio, fechas)
// ---------------------------------------------------------------------------

interface MaterialChip {
  titulo: string;
  mimeType?: string;
}

interface Step2Props {
  draft: AsignacionDraft;
  materialChip: MaterialChip | null;
  gruposObjetivo: string[];
  onActualizar: (cambios: Partial<AsignacionDraft>) => void;
  onAtras?: () => void;
  onContinuar: () => void;
}

// Mismas etiquetas en espanol que ya usa AsignacionesView.tsx para MomentoAsignacion
// (linea ~1471), para no introducir una segunda traduccion del mismo enum.
const ETIQUETAS_MOMENTO: Record<MomentoAsignacion, string> = {
  preparacion: 'Antes de la clase',
  durante: 'Durante la jornada',
  refuerzo_posterior: 'Después de la clase',
};

// Mismo dominio y etiquetas que ya usa AsignacionesView.tsx para el select de
// criterio (linea ~1501), que alimenta mapearCriterioAUso() en ese archivo.
const ETIQUETAS_CRITERIO: Record<CriterioAsignacionWizard, string> = {
  estudio: 'Estudio y práctica',
  repaso: 'Repaso',
  refuerzo: 'Refuerzo',
  evaluacion: 'Evaluación',
  quiz: 'Quiz',
};

const CAMPO_SELECT_CLASE = 'h-[48px] rounded-2xl border border-gray-200 px-3 text-sm font-medium normal-case tracking-normal text-tkd-dark';
const CAMPO_LABEL_CLASE = 'grid gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-400';

const Step2: React.FC<Step2Props> = ({ draft, materialChip, gruposObjetivo, onActualizar, onAtras, onContinuar }) => (
  <div className="space-y-4">
    {materialChip && (
      <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2.5 dark:border-white/10 dark:bg-white/5">
        <IconoTipoRecurso mimeType={materialChip.mimeType} />
        <span className="truncate text-sm font-bold text-tkd-dark dark:text-white">{materialChip.titulo}</span>
      </div>
    )}

    <div className="grid gap-3 sm:grid-cols-2">
      {/*
        Fix 2 (correccion post-prueba-manual, "Sí, sacalo"): el selector de
        Destinatario (grupo|estudiante) se retiro de la UI a pedido explicito
        de producto. El draft sigue teniendo el campo `destinatario` (otro
        codigo, como crearDestinatario() en AsignacionesView.tsx, todavia lo
        lee), pero ya no es editable: queda forzado a 'grupo' sin importar lo
        que traiga draftInicial (ver override en el useState de abajo).
      */}
      <label className={CAMPO_LABEL_CLASE}>
        Grupo objetivo
        <select
          value={draft.grupoObjetivo}
          onChange={(event) => onActualizar({ grupoObjetivo: event.target.value })}
          className={CAMPO_SELECT_CLASE}
        >
          {gruposObjetivo.map((grupo) => <option key={grupo} value={grupo}>{grupo}</option>)}
        </select>
      </label>

      <label className={CAMPO_LABEL_CLASE}>
        Momento
        <select
          value={draft.momento}
          onChange={(event) => onActualizar({ momento: event.target.value as MomentoAsignacion })}
          className={CAMPO_SELECT_CLASE}
        >
          {(Object.keys(ETIQUETAS_MOMENTO) as MomentoAsignacion[]).map((valor) => (
            <option key={valor} value={valor}>{ETIQUETAS_MOMENTO[valor]}</option>
          ))}
        </select>
      </label>

      <label className={CAMPO_LABEL_CLASE}>
        Criterio
        <select
          value={draft.criterio}
          onChange={(event) => onActualizar({ criterio: event.target.value as CriterioAsignacionWizard })}
          className={CAMPO_SELECT_CLASE}
        >
          {(Object.keys(ETIQUETAS_CRITERIO) as CriterioAsignacionWizard[]).map((valor) => (
            <option key={valor} value={valor}>{ETIQUETAS_CRITERIO[valor]}</option>
          ))}
        </select>
      </label>

      <label className={CAMPO_LABEL_CLASE}>
        Apertura
        <input
          type="date"
          value={draft.fechaApertura}
          onChange={(event) => onActualizar({ fechaApertura: event.target.value })}
          className={CAMPO_SELECT_CLASE}
        />
      </label>

      <label className={CAMPO_LABEL_CLASE}>
        Cierre
        <input
          type="date"
          value={draft.fechaCierre}
          onChange={(event) => onActualizar({ fechaCierre: event.target.value })}
          className={CAMPO_SELECT_CLASE}
        />
      </label>
    </div>

    <div className="flex gap-3 pt-1">
      {onAtras && (
        <button
          type="button"
          onClick={onAtras}
          className="flex-1 rounded-2xl border border-gray-200 py-3 text-[11px] font-black uppercase tracking-widest text-tkd-dark transition hover:border-tkd-blue dark:text-white"
        >
          Atrás
        </button>
      )}
      <button
        type="button"
        onClick={onContinuar}
        className="flex-1 rounded-2xl bg-tkd-blue py-3 text-[11px] font-black uppercase tracking-widest text-white transition hover:bg-blue-800"
      >
        Continuar
      </button>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Step 3: grados objetivo (color agrupado por familia)
// ---------------------------------------------------------------------------

const TODOS_LOS_GRADOS = Object.values(GradoTKD);

export type FamiliaGrado = 'Blanco' | 'Amarillo' | 'Verde' | 'Azul' | 'Rojo' | 'Negro';

/**
 * Deriva la familia de color de un GradoTKD tomando su primera palabra
 * ("Blanco Punta Amarilla" -> "Blanco", "Negro 2do Dan" -> "Negro"). El
 * dominio real de GradoTKD tiene 13 valores pero solo 6 familias distintas;
 * el proposal dejo pendiente disenar una paleta de 13 colores, asi que
 * design.md decidio reusar esta paleta de 6 entradas para las variantes
 * "Punta"/"Dan" en vez de inventar 7 tonos intermedios nuevos.
 */
export function familiaDeGrado(grado: GradoTKD): FamiliaGrado {
  return grado.split(' ')[0] as FamiliaGrado;
}

export interface EstiloFamiliaGrado {
  punto: string;
  anillo: string;
  texto: string;
  fondo: string;
  borde: string;
}

// Blanco/Amarillo/Verde/Azul/Rojo replican los tonos de utils/beltStyles.ts.
// Esa paleta no tiene entrada para "Negro" (los tres grados Dan) porque alli
// se resuelve con gradientes por grado individual; aqui, al agrupar por
// familia, se eligio texto/anillo dorados (mismo BELT_COLORS.oro que usa
// beltStyles para nombrar Danes) sobre un punto negro solido.
export const PALETA_FAMILIAS_GRADO: Record<FamiliaGrado, EstiloFamiliaGrado> = {
  Blanco: { punto: 'bg-white border border-gray-300', anillo: 'ring-gray-300', texto: 'text-gray-600', fondo: 'bg-gray-50', borde: 'border-gray-300' },
  Amarillo: { punto: 'bg-yellow-400', anillo: 'ring-yellow-300', texto: 'text-yellow-700', fondo: 'bg-yellow-50', borde: 'border-yellow-300' },
  Verde: { punto: 'bg-emerald-500', anillo: 'ring-emerald-300', texto: 'text-emerald-700', fondo: 'bg-emerald-50', borde: 'border-emerald-300' },
  Azul: { punto: 'bg-tkd-blue', anillo: 'ring-blue-300', texto: 'text-tkd-blue', fondo: 'bg-blue-50', borde: 'border-blue-300' },
  Rojo: { punto: 'bg-tkd-red', anillo: 'ring-red-300', texto: 'text-tkd-red', fondo: 'bg-red-50', borde: 'border-red-300' },
  Negro: { punto: 'bg-gray-900', anillo: 'ring-amber-300', texto: 'text-amber-600', fondo: 'bg-gray-100', borde: 'border-gray-400' },
};

interface Step3Props {
  draft: AsignacionDraft;
  onActualizar: (cambios: Partial<AsignacionDraft>) => void;
  onAtras: () => void;
  onConfirmar: () => void;
  puedeConfirmar: boolean;
  confirmando: boolean;
}

const Step3: React.FC<Step3Props> = ({ draft, onActualizar, onAtras, onConfirmar, puedeConfirmar, confirmando }) => {
  const todosSeleccionados = TODOS_LOS_GRADOS.every((grado) => draft.grados.includes(grado));

  const alternarGrado = (grado: GradoTKD) => {
    onActualizar({
      grados: draft.grados.includes(grado)
        ? draft.grados.filter((actual) => actual !== grado)
        : [...draft.grados, grado],
    });
  };

  const alternarTodos = () => {
    onActualizar({ grados: todosSeleccionados ? [] : [...TODOS_LOS_GRADOS] });
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-gray-500 dark:text-gray-300">¿A qué grados aplica este material en esta clase?</p>

      <button
        type="button"
        onClick={alternarTodos}
        aria-pressed={todosSeleccionados}
        className={`w-full rounded-2xl border px-3 py-2.5 text-left text-[11px] font-black uppercase tracking-widest transition-all ${
          todosSeleccionados ? 'border-tkd-blue bg-blue-50 text-tkd-blue' : 'border-gray-200 text-gray-400 hover:bg-gray-50'
        }`}
      >
        Todos los grados
      </button>

      <div className="grid grid-cols-2 gap-2">
        {TODOS_LOS_GRADOS.map((grado) => {
          const estilo = PALETA_FAMILIAS_GRADO[familiaDeGrado(grado)];
          const seleccionado = draft.grados.includes(grado);
          return (
            <button
              key={grado}
              type="button"
              onClick={() => alternarGrado(grado)}
              aria-pressed={seleccionado}
              className={`flex items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition-all ${
                seleccionado ? `${estilo.fondo} ${estilo.borde} ring-2 ${estilo.anillo}` : 'border-gray-200 bg-white hover:bg-gray-50 dark:bg-gray-900'
              }`}
            >
              <span className={`h-3 w-3 shrink-0 rounded-full ${estilo.punto}`} />
              <span className={`flex-1 text-sm font-semibold ${seleccionado ? estilo.texto : 'text-gray-400'}`}>{grado}</span>
            </button>
          );
        })}
      </div>

      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={onAtras}
          className="flex-1 rounded-2xl border border-gray-200 py-3 text-[11px] font-black uppercase tracking-widest text-tkd-dark transition hover:border-tkd-blue dark:text-white"
        >
          Atrás
        </button>
        <button
          type="button"
          disabled={!puedeConfirmar || confirmando}
          onClick={onConfirmar}
          className="flex-1 rounded-2xl bg-tkd-red py-3 text-[11px] font-black uppercase tracking-widest text-white transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          {confirmando ? 'Asignando...' : 'Asignar'}
        </button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Wizard principal
// ---------------------------------------------------------------------------

const AsignarMaterialWizard: React.FC<AsignarMaterialWizardProps> = ({
  modo,
  materialesDisponibles,
  tagsPrograma,
  gruposObjetivo,
  draftInicial,
  onCancelar,
  onConfirmar,
}) => {
  // "Editar" abre el asistente directamente en Configurar: el Paso 1 (elegir
  // material) queda inaccesible porque recursoId es la mitad del id
  // deterministico del documento en Firestore (mirror de
  // editarAsignacionPublicada(), que ya hace setPasoPublicacion(2)).
  const [paso, setPaso] = React.useState<PasoAsistente>(modo === 'editar' ? 2 : 1);
  // Fix 2: `destinatario` ya no es seleccionable (ver Step2 mas abajo), asi
  // que se fuerza a 'grupo' de forma unconditional al armar el estado
  // inicial, incluso si draftInicial (p.ej. una asignacion vieja tipo
  // 'estudiante' que se abre para editar) trae otro valor.
  const [draft, setDraft] = React.useState<AsignacionDraft>(() => ({
    ...(draftInicial ?? crearDraftVacio(gruposObjetivo)),
    destinatario: 'grupo',
  }));
  const [confirmando, setConfirmando] = React.useState(false);
  const [error, setError] = React.useState('');

  // Snapshot tomado al abrir (mount), igual que programaSnapshotAlAbrir: solo
  // se usa en modo 'editar' para habilitar "Asignar" cuando algo cambio.
  const [snapshotInicial] = React.useState(() => (modo === 'editar' ? serializarDraftParaCambios(draftInicial) : ''));

  const actualizarDraft = (cambios: Partial<AsignacionDraft>) => {
    setDraft((actual) => ({ ...actual, ...cambios }));
  };

  const hayCambiosSinGuardar = modo === 'editar' && serializarDraftParaCambios(draft) !== snapshotInicial;
  // Paso 3 sin grados siempre bloquea "Asignar" (crear y editar). En editar,
  // ademas exige que algo difiera del snapshot inicial; "Atras"/"Continuar"
  // nunca dependen de este chequeo (ver Step2/Step3 mas abajo).
  const puedeConfirmar = draft.grados.length > 0 && (modo === 'crear' || hayCambiosSinGuardar);

  const recursoSeleccionado = materialesDisponibles.find((recurso) => recurso.id === draft.recursoId);
  const materialChip: MaterialChip | null = recursoSeleccionado
    ? { titulo: tituloRecurso(recursoSeleccionado), mimeType: recursoSeleccionado.mimeType }
    // En modo 'editar' el material puede no estar en materialesDisponibles:
    // el padre lo excluye como "ya asignado a esta clase" (es un duplicado de
    // si mismo). Se muestra un chip generico en vez de dejar el hueco vacio.
    : modo === 'editar' ? { titulo: 'Material asignado' } : null;

  const confirmar = async () => {
    setError('');
    setConfirmando(true);
    try {
      await onConfirmar(draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la asignación.');
    } finally {
      setConfirmando(false);
    }
  };

  const tituloPaso = PASOS_ASISTENTE.find((item) => item.numero === paso)?.etiqueta ?? '';

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-tkd-dark/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[2rem] border border-white/10 bg-white shadow-2xl dark:bg-gray-900">
        <header className="flex items-start justify-between gap-4 border-b border-gray-100 p-6 dark:border-white/10">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-tkd-red">
              {modo === 'editar' ? 'Editar asignación' : 'Asignar material'}
            </p>
            <h2 className="mt-2 text-2xl font-black uppercase leading-tight text-tkd-dark dark:text-white">{tituloPaso}</h2>
          </div>
          <button
            type="button"
            onClick={onCancelar}
            aria-label="Cerrar asistente"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gray-100 text-gray-500 transition-all hover:bg-tkd-red hover:text-white dark:bg-white/10 dark:text-gray-300"
          >
            <IconoCerrar className="h-5 w-5" />
          </button>
        </header>

        <div className="p-6">
          <StepBar paso={paso} />

          {error && <p className="mb-4 rounded-2xl bg-red-50 p-3 text-xs font-bold text-tkd-red">{error}</p>}

          {paso === 1 && (
            <Step1
              draft={draft}
              materialesDisponibles={materialesDisponibles}
              tagsPrograma={tagsPrograma}
              onActualizar={actualizarDraft}
              onContinuar={() => setPaso(2)}
            />
          )}

          {paso === 2 && (
            <Step2
              draft={draft}
              materialChip={materialChip}
              gruposObjetivo={gruposObjetivo}
              onActualizar={actualizarDraft}
              // En 'editar' el Paso 1 es inaccesible (ver comentario en el
              // useState de `paso`), asi que no hay a donde volver desde aqui.
              onAtras={modo === 'crear' ? () => setPaso(1) : undefined}
              onContinuar={() => setPaso(3)}
            />
          )}

          {paso === 3 && (
            <Step3
              draft={draft}
              onActualizar={actualizarDraft}
              onAtras={() => setPaso(2)}
              onConfirmar={confirmar}
              puedeConfirmar={puedeConfirmar}
              confirmando={confirmando}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default AsignarMaterialWizard;
