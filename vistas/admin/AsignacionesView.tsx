import React from 'react';
import type { AsignacionAcademica, DestinatarioAsignacion } from '../../models/academico/asignacion';
import type { MomentoAsignacion } from '../../models/academico';
import type { RecursoAcademico } from '../../models/academico/recurso';
import { useAuth } from '../../context/AuthContext';
import { listarRecursosAprobados } from '../../servicios/academico/bibliotecaService';
import { obtenerContextoJornada, type OpcionJornada } from '../../servicios/academico/jornadaContextService';
import {
  jornadaRepository,
  MENSAJE_ADVERTENCIA_AUDITORIA,
  esJornadaOperada,
  detectarConflictosEnLote,
  type JornadaRepository,
} from '../../servicios/academico/jornadaRepository';
import { programaRepository, type ProgramaRepository } from '../../servicios/academico/programaRepository';
import MisClasesView from './MisClasesView';
import {
  createPrograma,
  publishPrograma,
  assignProgramaToGrupo,
  generarJornadasDeEjecucion,
} from '../../servicios/academico/programaService';
import type { BloqueRecurrente, JornadaInstruccion } from '../../models/academico/jornada';
import {
  publicarAsignacion,
  publicarAsignacionesBatch,
  publishAsignacion,
  actualizarAsignacion,
  eliminarAsignacion,
  listarAsignacionesPorTenant,
  type PublicarAsignacionResponse,
} from '../../servicios/academico/asignacionService';
import { GradoTKD, RolUsuario } from '../../tipos';
import AsignarMaterialWizard, {
  type AsignacionDraft,
  familiaDeGrado,
  PALETA_FAMILIAS_GRADO,
} from '../../components/academico/AsignarMaterialWizard';
import type {
  AsignacionSalteada,
} from '../../models/academico/asignacionService.types';
import {
  IconoAgregar,
  IconoContrato,
  IconoEditar,
  IconoEliminar,
  IconoFirma,
  IconoFlechaDerecha,
  IconoFlechaIzquierda,
  IconoImagen,
} from '../../components/Iconos';
import ModalConfirmacion from '../../components/ModalConfirmacion';

const recursosAprobados: RecursoAcademico[] = [
  {
    id: 'recurso-pdf',
    tenantId: 'tenant-demo',
    proveedor: 'google_drive',
    externalFileId: 'drive-pdf-1',
    nombre: 'Fundamentos tecnicos',
    mimeType: 'application/pdf',
    ficha: {
      disciplina: 'Taekwondo',
      tipo: 'pdf',
      usos: ['estudio', 'preparacion'],
    },
    estado: 'aprobado',
    creadoPorUid: 'admin-demo',
    creadoEn: '2026-06-27T00:00:00.000Z',
    actualizadoEn: '2026-06-27T00:00:00.000Z',
  },
  {
    id: 'recurso-video',
    tenantId: 'tenant-demo',
    proveedor: 'google_drive',
    externalFileId: 'drive-video-1',
    nombre: 'Refuerzo patada frontal',
    mimeType: 'video/mp4',
    ficha: {
      disciplina: 'Taekwondo',
      tipo: 'video',
      usos: ['refuerzo'],
    },
    estado: 'aprobado',
    creadoPorUid: 'admin-demo',
    creadoEn: '2026-06-27T00:00:00.000Z',
    actualizadoEn: '2026-06-27T00:00:00.000Z',
  },
];

function crearDestinatario(tipo: DestinatarioAsignacion['tipo'], grupo: string, grados: string): DestinatarioAsignacion {
  if (tipo === 'estudiante') {
    return {
      tipo,
      estudianteIds: grupo.split(',').map((item) => item.trim()).filter(Boolean),
    };
  }

  // 'grado' y 'grupo' comparten la poblacion de grados: el asistente unificado
  // recolecta grados en el Paso 3 para ambos destinatarios (el mockup dividio
  // destinatario=grupo|estudiante y trata grados como campo aparte).
  if (tipo === 'grado' || tipo === 'grupo') {
    return {
      tipo,
      grupo: grupo.trim(),
      grados: grados.split(',').map((item) => item.trim()).filter(Boolean),
    };
  }

  return {
    tipo,
    grupo: grupo.trim(),
  };
}

function etiquetaDestinatario(destinatario: DestinatarioAsignacion) {
  if (destinatario.tipo === 'estudiante') {
    return `Estudiante: ${(destinatario.estudianteIds ?? []).join(', ')}`;
  }
  if (destinatario.tipo === 'grado') {
    return `Grado: ${destinatario.grupo}`;
  }
  return `Grupo: ${destinatario.grupo}`;
}

function mapearCriterioAUso(criterio: 'estudio' | 'repaso' | 'refuerzo' | 'evaluacion' | 'quiz') {
  if (criterio === 'quiz') return 'evaluacion';
  if (criterio === 'repaso') return 'estudio';
  return criterio;
}

function obtenerNombreSedeActiva(sedeActual: string, sedesActivas: OpcionJornada[], fallback = 'Sede principal') {
  const sedeExiste = sedesActivas.some((sede) => sede.nombre === sedeActual);
  if (sedeExiste) return sedeActual;
  return sedesActivas[0]?.nombre ?? fallback;
}

function normalizarSedePrograma<T extends { sede: string }>(programa: T, sedesActivas: OpcionJornada[], fallback = 'Sede principal'): T {
  const sedeNormalizada = obtenerNombreSedeActiva(programa.sede, sedesActivas, fallback);
  return sedeNormalizada === programa.sede ? programa : { ...programa, sede: sedeNormalizada };
}

const IconoRecursoAsignacion: React.FC<{ mimeType: string; className?: string }> = ({ mimeType, className = 'h-5 w-5' }) => {
  if (mimeType.startsWith('image/')) return <IconoImagen className={className} />;
  if (mimeType.startsWith('video/') || mimeType.includes('presentation')) return <IconoFirma className={className} />;
  return <IconoContrato className={className} />;
};

const parsearTagsAsignacion = (entrada: string): string[] => (
  entrada
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .filter((tag, index, todos) => todos.findIndex((actual) => actual.toLowerCase() === tag.toLowerCase()) === index)
);

const TAGS_ACADEMICOS_ESTANDAR = [
  {
    grupo: 'Etapa',
    tags: ['infantil', 'precadetes', 'cadetes', 'adultos', 'todos'],
  },
  {
    grupo: 'Nivel',
    tags: ['iniciacion', 'fundamentos', 'intermedio', 'avanzado', 'competencia', 'alto rendimiento'],
  },
  {
    grupo: 'Tecnica',
    tags: ['patada frontal', 'patada lateral', 'patada circular', 'bloqueos', 'defensa', 'combate', 'poomsae', 'kyorugi', 'rompimiento'],
  },
  {
    grupo: 'Capacidad',
    tags: ['coordinacion', 'equilibrio', 'flexibilidad', 'fuerza', 'velocidad', 'resistencia', 'control postural'],
  },
  {
    grupo: 'Uso',
    tags: ['estudio', 'practica', 'repaso', 'refuerzo', 'evaluacion', 'quiz', 'tarea', 'planeacion', 'demostracion'],
  },
  {
    grupo: 'Formato',
    tags: ['pdf', 'imagen', 'video', 'documento', 'presentacion', 'hoja de calculo'],
  },
  {
    grupo: 'Momento',
    tags: ['antes de clase', 'durante clase', 'despues de clase'],
  },
  {
    grupo: 'Operacion',
    tags: ['asistencia', 'trazabilidad', 'programa', 'ciclo', 'sede', 'instructor'],
  },
] as const;

const normalizarTagComparacion = (tag: string) => tag.trim().toLowerCase();

// Cuenta cuantos tags del recurso coinciden con los del programa. El asistente
// (Paso 1) usa el conteo para su badge; la priorizacion de la lista sigue
// usando el booleano derivado (coincideTagsConPrograma).
function contarTagsCoincidentesConPrograma(recurso: RecursoAcademico, tagsPrograma: string[]): number {
  if (tagsPrograma.length === 0) return 0;
  const tagsProgramaNormalizados = tagsPrograma.map(normalizarTagComparacion);
  return (recurso.ficha?.tags ?? []).filter((tag) => tagsProgramaNormalizados.includes(normalizarTagComparacion(tag))).length;
}

function coincideTagsConPrograma(recurso: RecursoAcademico, tagsPrograma: string[]): boolean {
  return contarTagsCoincidentesConPrograma(recurso, tagsPrograma) > 0;
}

const alternarTagNormalizado = (tagsActuales: string[], tag: string) => {
  const yaExiste = tagsActuales.some((actual) => actual.toLowerCase() === tag.toLowerCase());
  return yaExiste
    ? tagsActuales.filter((actual) => actual.toLowerCase() !== tag.toLowerCase())
    : [...tagsActuales, tag];
};

const serializarProgramaParaCambios = (programa: ProgramaAcademicoAsignacion | null | undefined) => {
  if (!programa) return '';
  return JSON.stringify({
    nombre: programa.nombre,
    fechaInicio: programa.fechaInicio,
    fechaFin: programa.fechaFin,
    instructor: programa.instructor,
    instructorId: programa.instructorId,
    sede: programa.sede,
    grupoObjetivo: programa.grupoObjetivo,
    tema: programa.tema,
    objetivoClase: programa.objetivoClase,
    observaciones: programa.observaciones,
    tags: [...programa.tags].sort(),
    diasHorario: [...(programa.diasHorario ?? [])].sort((a, b) => a.dia.localeCompare(b.dia)),
  });
};

interface ProgramaAcademicoAsignacion {
  id: string;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  instructor: string;
  /**
   * UID real de Firebase Auth del instructor (Fix 1, post-prueba-manual):
   * antes solo existia `instructor` (nombre libre) y se slugificaba para
   * `BloqueRecurrente.instructorId`, lo que nunca coincidia con el UID real
   * que valida `publishAsignacion` en Cloud Functions. Admin/SuperAdmin puede
   * elegir cualquier instructor real del tenant; Editor queda bloqueado a su
   * propio `usuario.id`.
   */
  instructorId: string;
  sede: string;
  grupoObjetivo: string;
  tema: string;
  objetivoClase: string;
  observaciones: string;
  tags: string[];
  // Horario recurrente para generar jornadas
  diasHorario?: { dia: string; horaInicio: string; horaFin: string }[];
}

type AsignacionPublicadaLocal = AsignacionAcademica & {
  jornadaId?: string;
  clavePublicacion?: string;
  criterioPublicacion?: 'estudio' | 'repaso' | 'refuerzo' | 'evaluacion' | 'quiz';
};

interface JornadaPublicacionLocal {
  id: string;
  fecha: string;
  dia: string;
  horaInicio: string;
  horaFin: string;
  sede: string;
  instructor: string;
  grupo: string;
  temaDia: string;
}

function crearClavePublicacionAsignacion(input: {
  recursoId: string;
  jornadaId: string;
  tipoDestinatario: DestinatarioAsignacion['tipo'];
  grupo: string;
  grados: string;
  momento: MomentoAsignacion;
  criterio: 'estudio' | 'repaso' | 'refuerzo' | 'evaluacion' | 'quiz';
}) {
  const grupoNormalizado = input.grupo.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const gradosNormalizados = input.grados.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return [
    input.recursoId,
    input.jornadaId,
    input.tipoDestinatario,
    grupoNormalizado || 'sin-grupo',
    gradosNormalizados || 'sin-grados',
    input.momento,
    input.criterio,
  ].join('|');
}

const DIA_SEMANA_A_INDICE: Record<string, number> = {
  Domingo: 0, Lunes: 1, Martes: 2, Miércoles: 3, Jueves: 4, Viernes: 5, Sábado: 6,
};
const INDICE_A_DIA_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const slugificar = (valor: string) => valor.toLowerCase().replace(/[^a-z0-9]+/g, '-');

// Fix 2026-07-16 (bug reportado: Tutor/Estudiante nunca ven ninguna clase en su Agenda):
// jornada.sedeId se guardaba como slugificar(nombreDeSede) -- un slug del NOMBRE ("sede-principal")
// -- mientras que Estudiante.sedeId (FormularioEstudiante.tsx) es el ID real del documento
// `sedes/{id}` de Firestore. Nunca podian coincidir en `j.sedeId === hijo.sedeId`
// (AgendaView.tsx), asi que la Agenda del consultor quedaba SIEMPRE vacia. Se resuelve el
// ID real buscando la sede por nombre en el catalogo ya cargado (sedesActivas); si por algun
// motivo no se encuentra (dato inconsistente), cae al slug como ultimo recurso defensivo.
function resolverSedeIdPorNombre(nombreSede: string, sedesActivas: OpcionJornada[]): string {
  return sedesActivas.find((sede) => sede.nombre === nombreSede)?.id ?? slugificar(nombreSede);
}

function contarJornadasARealizar(fechaInicio?: string, fechaFin?: string, diasHorario?: { dia: string }[]): number {
  if (!fechaInicio || !fechaFin || !diasHorario?.length) return 0;
  
  const diasMap: Record<string, number> = {
    Domingo: 0,
    Lunes: 1,
    Martes: 2,
    Miércoles: 3,
    'MiÃ©rcoles': 3,
    Jueves: 4,
    Viernes: 5,
    Sábado: 6,
    'SÃ¡bado': 6,
  };

  const inicio = new Date(`${fechaInicio}T12:00:00Z`);
  const fin = new Date(`${fechaFin}T12:00:00Z`);
  if (isNaN(inicio.getTime()) || isNaN(fin.getTime()) || fin < inicio) return 0;
  
  let contador = 0;
  const indicesDia = diasHorario.map((h) => diasMap[h.dia]).filter((v) => v !== undefined);
  
  for (let fecha = new Date(inicio); fecha <= fin; fecha.setUTCDate(fecha.getUTCDate() + 1)) {
    if (indicesDia.includes(fecha.getUTCDay())) {
      contador++;
    }
  }
  return contador;
}

function crearBloquesDesdePrograma(
  programa: ProgramaAcademicoAsignacion,
  tenantId: string,
  sedeId: string
): BloqueRecurrente[] {
  return (programa.diasHorario ?? []).map((bloque) => ({
    id: `bloque-${slugificar(programa.id)}-${slugificar(bloque.dia)}`,
    tenantId,
    grupoId: slugificar(programa.grupoObjetivo),
    sedeId,
    espacioId: 'tatami-1',
    // Fix 1: UID real, no un slug del nombre (ver comentario en
    // ProgramaAcademicoAsignacion.instructorId).
    instructorId: programa.instructorId,
    diaSemana: DIA_SEMANA_A_INDICE[bloque.dia] ?? 0,
    horaInicio: bloque.horaInicio,
    horaFin: bloque.horaFin,
    activo: true,
  }));
}

function mapearJornadaAPreview(
  jornada: JornadaInstruccion,
  opciones: { sedes: OpcionJornada[]; instructores: OpcionJornada[]; temaFallback: string }
): JornadaPublicacionLocal {
  return {
    id: jornada.id,
    fecha: jornada.fecha,
    dia: INDICE_A_DIA_SEMANA[new Date(`${jornada.fecha}T12:00:00Z`).getUTCDay()],
    horaInicio: jornada.horaInicio,
    horaFin: jornada.horaFin,
    sede: opciones.sedes.find((item) => item.id === jornada.sedeId)?.nombre ?? jornada.sedeId,
    instructor: opciones.instructores.find((item) => item.id === jornada.instructorId)?.nombre ?? jornada.instructorId,
    grupo: jornada.grupoId,
    temaDia: opciones.temaFallback,
  };
}

function generarJornadasLocalesPrograma(programa: ProgramaAcademicoAsignacion): JornadaPublicacionLocal[] {
  const horario = programa.diasHorario ?? [];
  if (!programa.fechaInicio || !programa.fechaFin || horario.length === 0) {
    return [{
      id: `jornada-${programa.id}-referencia`,
      fecha: programa.fechaInicio || new Date().toISOString().slice(0, 10),
      dia: 'Referencia',
      horaInicio: '08:00',
      horaFin: '09:00',
      sede: programa.sede,
      instructor: programa.instructor,
      grupo: programa.grupoObjetivo,
      temaDia: programa.tema,
    }];
  }

  const diasMap: Record<string, number> = {
    Domingo: 0,
    Lunes: 1,
    Martes: 2,
    Miércoles: 3,
    'MiÃ©rcoles': 3,
    Jueves: 4,
    Viernes: 5,
    Sábado: 6,
    'SÃ¡bado': 6,
  };
  const inicio = new Date(`${programa.fechaInicio}T12:00:00Z`);
  const fin = new Date(`${programa.fechaFin}T12:00:00Z`);
  const jornadas: JornadaPublicacionLocal[] = [];

  for (let fecha = new Date(inicio); fecha <= fin && jornadas.length < 60; fecha.setUTCDate(fecha.getUTCDate() + 1)) {
    const bloque = horario.find((item) => diasMap[item.dia] === fecha.getUTCDay());
    if (!bloque) continue;
    const fechaIso = fecha.toISOString().slice(0, 10);
    jornadas.push({
      id: `jornada-${programa.id}-${fechaIso}-${bloque.horaInicio}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      fecha: fechaIso,
      dia: bloque.dia,
      horaInicio: bloque.horaInicio,
      horaFin: bloque.horaFin,
      sede: programa.sede,
      instructor: programa.instructor,
      grupo: programa.grupoObjetivo,
      temaDia: programa.tema,
    });
  }

  return jornadas;
}

interface AsignacionesViewProps {
  recursos?: RecursoAcademico[];
  tenantId?: string;
  jornadaId?: string;
  usuarioId?: string;
  refreshTrigger?: number;
  embedded?: boolean;
  recursoIdsParaLote?: string[];
  onFlujoEstadoChange?: (estado: {
    recursosAprobados: number;
    recursoSeleccionado: boolean;
    pasoPublicacion: number;
    jornadaConfirmada: boolean;
    materialPublicado: boolean;
  }) => void;
  publicarAsignacionFn?: typeof publicarAsignacion;
  publicarAsignacionesBatchFn?: typeof publicarAsignacionesBatch;
  actualizarAsignacionFn?: typeof actualizarAsignacion;
  eliminarAsignacionFn?: typeof eliminarAsignacion;
  repositoryJornada?: JornadaRepository;
  repositoryPrograma?: ProgramaRepository;
}

const AsignacionesView: React.FC<AsignacionesViewProps> = ({
  recursos,
  jornadaId,
  refreshTrigger = 0,
  embedded = false,
  recursoIdsParaLote,
  onFlujoEstadoChange,
  publicarAsignacionFn = publicarAsignacion,
  publicarAsignacionesBatchFn = publicarAsignacionesBatch,
  actualizarAsignacionFn = actualizarAsignacion,
  eliminarAsignacionFn = eliminarAsignacion,
  repositoryJornada = jornadaRepository,
  repositoryPrograma = programaRepository,
}) => {
  const { usuario } = useAuth();
  const tenantId = usuario?.tenantId ?? 'tenant-local';
  const usuarioId = usuario?.id ?? 'maestro-local';
  const [recursosDisponibles, setRecursosDisponibles] = React.useState<RecursoAcademico[]>(recursos ?? []);
  const [recursoId, setRecursoId] = React.useState(recursos?.[0]?.id ?? '');
  const [tipoDestinatario, setTipoDestinatario] = React.useState<DestinatarioAsignacion['tipo']>('grupo');
  const [grupo, setGrupo] = React.useState('');
  const [grados, setGrados] = React.useState('');
  const [fechaApertura, setFechaApertura] = React.useState('2026-06-27');
  const [fechaCierre, setFechaCierre] = React.useState('');
  const [momento, setMomento] = React.useState<MomentoAsignacion>('preparacion');
  const [criterio, setCriterio] = React.useState<'estudio' | 'repaso' | 'refuerzo' | 'evaluacion' | 'quiz'>('estudio');
  const [tituloPersonalizado, setTituloPersonalizado] = React.useState('');
  const [tagsAsignacion, setTagsAsignacion] = React.useState('');
  const [publicada, setPublicada] = React.useState<AsignacionPublicadaLocal | null>(null);
  const [resultadoPublicacion, setResultadoPublicacion] = React.useState<PublicarAsignacionResponse | null>(null);
  const [publicando, setPublicando] = React.useState(false);
  const [guardandoPrograma, setGuardandoPrograma] = React.useState(false);
  const [error, setError] = React.useState('');
  const [pasoPublicacion, setPasoPublicacion] = React.useState<1 | 2 | 3 | 4>(1);
  const [jornadaLocalId, setJornadaLocalId] = React.useState('');
  const [confirmandoJornada, setConfirmandoJornada] = React.useState(false);
  const gruposObjetivo = ['Infantil', 'Precadetes', 'Cadetes', 'Adultos', 'Todos'];
  const nombreInstructorActual = (
    (usuario as { nombre?: string; nombreUsuario?: string } | null)?.nombre
    || (usuario as { nombre?: string; nombreUsuario?: string } | null)?.nombreUsuario
    || usuario?.email
    || 'Instructor actual'
  );
  // Fix 1: solo Admin/SuperAdmin puede elegir un instructor distinto de si
  // mismo; Editor (el "Maestro" de la app) queda bloqueado a su propio uid.
  const puedeElegirInstructor = usuario?.rol === RolUsuario.Admin || usuario?.rol === RolUsuario.SuperAdmin;
  const opcionesJornadaFallback = React.useMemo(() => ({
    instructores: [{ id: usuarioId, nombre: nombreInstructorActual }],
    sedes: [{ id: 'sede-principal', nombre: 'Sede principal' }],
  }), [nombreInstructorActual, usuarioId]);
  const [opcionesPrograma, setOpcionesPrograma] = React.useState<{
    instructores: OpcionJornada[];
    sedes: OpcionJornada[];
  }>(opcionesJornadaFallback);
  const programaInicial: ProgramaAcademicoAsignacion = React.useMemo(() => ({
    id: 'programa-infantil-iniciacion-jul-sep-2026',
    nombre: 'Infantil Iniciación - Ciclo Jul/Sep 2026',
    fechaInicio: '2026-07-01',
    fechaFin: '2026-09-30',
    instructor: nombreInstructorActual,
    instructorId: usuarioId,
    sede: 'Sede principal',
    grupoObjetivo: 'Infantil',
    tema: 'Iniciación técnica',
    objetivoClase: 'Desarrollar bases técnicas, coordinación y control postural para etapa infantil.',
    observaciones: 'Programa base para materiales de iniciación y fundamentos.',
    tags: ['infantil', 'iniciación', 'patada frontal'],
  }), [nombreInstructorActual, usuarioId]);
  const [programas, setProgramas] = React.useState<ProgramaAcademicoAsignacion[]>([programaInicial]);
  const [programaSeleccionadoId, setProgramaSeleccionadoId] = React.useState(programaInicial.id);
  // Opciones vigentes (sedes/instructores) accesibles desde efectos async sin sumar
  // deps que re-disparen la hidratacion. Se actualiza en cada render.
  const opcionesProgramaRef = React.useRef<{ instructores: OpcionJornada[]; sedes: OpcionJornada[] }>(opcionesJornadaFallback);
  opcionesProgramaRef.current = opcionesPrograma;

  React.useEffect(() => {
    let activo = true;

    repositoryPrograma.listarProgramasPorTenant(tenantId).then(async (programasReales) => {
      if (!activo || programasReales.length === 0) return;

      // Fix 3 (persistencia de Programa academico): ProgramaAcademico (persistido) no
      // guarda horario/sede/instructor — esos viven en EjecucionPrograma (id determinista
      // `ejecucion-${programa.id}`, el mismo que usa guardarPrograma). Antes se hidrataban
      // en blanco/default (la nota original admitia el hueco: "queda para una iteracion
      // futura") y cada remount pisaba en silencio el horario real del programa. Ahora se
      // lee la ejecucion persistida y se reconstruyen diasHorario/sede/grupo/fechas/
      // instructor. Si la ejecucion no existe (programa guardado sin horario) o el
      // repositorio inyectado no implementa obtenerEjecucion (fakes de test viejos), se
      // degrada al comportamiento anterior sin romperse.
      const ejecuciones = await Promise.all(programasReales.map(async (real) => {
        try {
          return (await repositoryJornada.obtenerEjecucion?.(tenantId, `ejecucion-${real.id}`)) ?? null;
        } catch {
          return null;
        }
      }));
      if (!activo) return;

      const opcionesVigentes = opcionesProgramaRef.current;
      const hidratados = programasReales.map((real, indice): ProgramaAcademicoAsignacion => {
        const ejecucion = ejecuciones[indice];
        const bloquesActivos = (ejecucion?.bloques ?? []).filter((bloque) => bloque.activo !== false);
        const instructorIdReal = bloquesActivos[0]?.instructorId ?? '';
        const instructorNombre = opcionesVigentes.instructores.find((opcion) => opcion.id === instructorIdReal)?.nombre;
        const grupoReconstruido = ejecucion
          ? gruposObjetivo.find((grupo) => slugificar(grupo) === ejecucion.grupoId)
          : undefined;
        const sedeReconstruida = ejecucion
          ? opcionesVigentes.sedes.find((opcion) => slugificar(opcion.nombre) === ejecucion.sedeId)?.nombre
          : undefined;
        return {
          ...programaInicial,
          id: real.id,
          nombre: real.nombre,
          observaciones: real.descripcion,
          // Tags reales del documento persistido: sin esto, el programa
          // recargado heredaria en silencio los tags hardcodeados del demo
          // y la priorizacion de materiales correria contra tags ajenos.
          tags: real.tags ?? [],
          // Tema/objetivo reales: guardarPrograma los persiste como unidades[0]
          // del ProgramaAcademico; antes se heredaban del demo.
          tema: real.unidades?.[0]?.nombre ?? programaInicial.tema,
          objetivoClase: real.unidades?.[0]?.objetivos?.[0]?.descripcion ?? programaInicial.objetivoClase,
          ...(ejecucion ? {
            fechaInicio: ejecucion.fechaInicio || programaInicial.fechaInicio,
            fechaFin: ejecucion.fechaFin || programaInicial.fechaFin,
            grupoObjetivo: grupoReconstruido ?? programaInicial.grupoObjetivo,
            sede: sedeReconstruida ?? programaInicial.sede,
            ...(instructorIdReal ? {
              instructorId: instructorIdReal,
              instructor: instructorNombre
                ?? (instructorIdReal === usuarioId ? nombreInstructorActual : instructorIdReal),
            } : {}),
            diasHorario: bloquesActivos.map((bloque) => ({
              dia: INDICE_A_DIA_SEMANA[bloque.diaSemana] ?? 'Lunes',
              horaInicio: bloque.horaInicio,
              horaFin: bloque.horaFin,
            })),
          } : {}),
        };
      });

      setProgramas((actuales) => {
        // Solo se AGREGAN programas nuevos: una entrada ya presente en esta sesion
        // (posiblemente con ediciones locales del usuario en curso) nunca se pisa
        // con la copia hidratada.
        const nuevos = hidratados.filter((real) => !actuales.some((programa) => programa.id === real.id));
        return nuevos.length ? [...actuales, ...nuevos] : actuales;
      });

      // Fix 2 (duplicados al editar): tras un remount la seleccion volvia SIEMPRE al
      // placeholder demo, aunque hubiera programas reales hidratados. Como esEdicion
      // compara contra el id demo, cada "editar y guardar" del usuario corria como
      // creacion nueva -> un ProgramaAcademico duplicado por ciclo. Si la seleccion
      // sigue en el demo y hay al menos un programa real, se apunta al primero real.
      setProgramaSeleccionadoId((actual) => (
        actual === programaInicial.id && hidratados.length > 0 ? hidratados[0].id : actual
      ));
    });

    return () => {
      activo = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, repositoryPrograma, repositoryJornada, programaInicial, usuarioId, nombreInstructorActual]);

  const programaSeleccionado = programas.find((programa) => programa.id === programaSeleccionadoId) ?? programas[0];
  const [modalProgramaAbierto, setModalProgramaAbierto] = React.useState(false);
  const [confirmacionProgramaAbierta, setConfirmacionProgramaAbierta] = React.useState(false);
  const [confirmacionCierreProgramaAbierta, setConfirmacionCierreProgramaAbierta] = React.useState(false);
  // Fix 1: confirmacion + estado en vuelo del borrado real de un programa academico.
  const [confirmacionEliminarProgramaAbierta, setConfirmacionEliminarProgramaAbierta] = React.useState(false);
  const [eliminandoPrograma, setEliminandoPrograma] = React.useState(false);
  // Fix 4: contador incrementado tras guardar/eliminar un programa para que el
  // <MisClasesView> embebido recargue sus jornadas sin remount (mismo patron
  // refreshTrigger que ya usa este archivo con los recursos de Biblioteca).
  const [refrescoMisClases, setRefrescoMisClases] = React.useState(0);
  const [programaEditando, setProgramaEditando] = React.useState<ProgramaAcademicoAsignacion>(programaInicial);
  const [programaSnapshotAlAbrir, setProgramaSnapshotAlAbrir] = React.useState<ProgramaAcademicoAsignacion>(programaInicial);
  const [programaJornada, setProgramaJornada] = React.useState(programaInicial.nombre);
  // Dias del horario recurrente del programa (para vincular agenda)
  const DIAS_SEMANA_OPCIONES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const toggleDiaHorario = (dia: string) => {
    setProgramaEditando((actual) => {
      const actuales = actual.diasHorario ?? [];
      const existe = actuales.find((d) => d.dia === dia);
      return {
        ...actual,
        diasHorario: existe
          ? actuales.filter((d) => d.dia !== dia)
          : [...actuales, { dia, horaInicio: '08:00', horaFin: '09:00' }],
      };
    });
  };
  const actualizarHoraDia = (dia: string, campo: 'horaInicio' | 'horaFin', valor: string) => {
    setProgramaEditando((actual) => ({
      ...actual,
      diasHorario: (actual.diasHorario ?? []).map((d) =>
        d.dia === dia ? { ...d, [campo]: valor } : d
      ),
    }));
  };
  // Preview de jornadas generadas (máximo 5 para visualización)
  const jornadasPreview = React.useMemo(() => {
    const inicio = programaEditando.fechaInicio;
    const fin = programaEditando.fechaFin;
    const horario = programaEditando.diasHorario ?? [];
    if (!inicio || !fin || horario.length === 0) return [];
    const jornadas: { fecha: string; dia: string; horaInicio: string; horaFin: string }[] = [];
    const fechaInicio = new Date(inicio + 'T12:00:00Z');
    const fechaFin = new Date(fin + 'T12:00:00Z');
    const diasMap: Record<string, number> = {
      'Domingo': 0, 'Lunes': 1, 'Martes': 2, 'Miércoles': 3,
      'Jueves': 4, 'Viernes': 5, 'Sábado': 6,
    };
    for (let d = new Date(fechaInicio); d <= fechaFin && jornadas.length < 5; d.setDate(d.getDate() + 1)) {
      const diaNombre = DIAS_SEMANA_OPCIONES[d.getUTCDay()];
      const bloque = horario.find((h) => h.dia === diaNombre);
      if (bloque) {
        jornadas.push({
          fecha: d.toISOString().split('T')[0],
          dia: diaNombre,
          horaInicio: bloque.horaInicio,
          horaFin: bloque.horaFin,
        });
      }
    }
    return jornadas;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programaEditando.fechaInicio, programaEditando.fechaFin, programaEditando.diasHorario]);
  const [sedeJornada, setSedeJornada] = React.useState(programaInicial.sede);
  // Espacio operativo: Tatami principal. Se conserva para agenda y trazabilidad.
  // Si la sede tiene varios espacios, luego puede habilitarse como selector.
  const [espacioJornada, setEspacioJornada] = React.useState('Tatami principal');
  // Grupo operativo: Grupo infantil. Se autocompleta por la jornada para mantener programacion y trazabilidad.
  const [grupoJornada, setGrupoJornada] = React.useState(programaInicial.grupoObjetivo);
  const [instructorJornada, setInstructorJornada] = React.useState(nombreInstructorActual);
  const [asignacionesPublicadas, setAsignacionesPublicadas] = React.useState<AsignacionPublicadaLocal[]>([]);
  const [asignacionEditandoId, setAsignacionEditandoId] = React.useState('');
  const bloqueJornadaRef = React.useRef<HTMLElement | null>(null);
  const [jornadaActivaIndex, setJornadaActivaIndex] = React.useState(0);
  const [temaDiaActivo, setTemaDiaActivo] = React.useState(programaInicial.tema);
  // Asistente unificado (AsignarMaterialWizard): unico punto de entrada para
  // crear o editar una asignacion. El padre posee draft/modo; el wizard solo
  // renderiza pasos y llama de vuelta.
  const [wizardAbierto, setWizardAbierto] = React.useState(false);
  const [wizardModo, setWizardModo] = React.useState<'crear' | 'editar'>('crear');
  const [draftInicialWizard, setDraftInicialWizard] = React.useState<AsignacionDraft | null>(null);
  const [asignacionEditandoWizard, setAsignacionEditandoWizard] = React.useState<AsignacionPublicadaLocal | null>(null);
  // Fila de asignacion expandida (colapsado/expandido en AssignmentRow).
  const [filaExpandidaId, setFilaExpandidaId] = React.useState('');
  // Pildora de tema editable en linea (sin abrir el asistente).
  const [temaEditando, setTemaEditando] = React.useState(false);
  const [temaBorrador, setTemaBorrador] = React.useState('');
  // Confirmacion de borrado real de una asignacion.
  const [asignacionEliminando, setAsignacionEliminando] = React.useState<AsignacionPublicadaLocal | null>(null);
  const [eliminandoAsignacion, setEliminandoAsignacion] = React.useState(false);
  const [jornadasProgramaActivas, setJornadasProgramaActivas] = React.useState<JornadaPublicacionLocal[]>(
    () => generarJornadasLocalesPrograma(programaSeleccionado)
  );

  React.useEffect(() => {
    let activo = true;

    repositoryJornada.listarJornadasPorTenant(tenantId).then((jornadas) => {
      if (!activo) return;
      const delPrograma = [...jornadas]
        .filter((jornada) => jornada.programaId === programaSeleccionado.id)
        .sort((a, b) => a.fecha.localeCompare(b.fecha));

      if (delPrograma.length === 0) {
        setJornadasProgramaActivas(generarJornadasLocalesPrograma(programaSeleccionado));
        return;
      }

      const sedes = opcionesPrograma.sedes.length ? opcionesPrograma.sedes : opcionesJornadaFallback.sedes;
      const instructores = opcionesPrograma.instructores.length ? opcionesPrograma.instructores : opcionesJornadaFallback.instructores;
      setJornadasProgramaActivas(delPrograma.map((jornada) => mapearJornadaAPreview(jornada, {
        sedes,
        instructores,
        temaFallback: programaSeleccionado.tema,
      })));
    });

    return () => {
      activo = false;
    };
  }, [programaSeleccionado, tenantId, repositoryJornada, opcionesPrograma, opcionesJornadaFallback]);
  // Prioriza (no filtra) los materiales cuyo ficha.tags interseca con los tags
  // del programa seleccionado: matches primero, el resto sigue visible y
  // seleccionable. Sin tags de programa, se conserva el orden por defecto.
  const recursosPriorizadosPorTag = React.useMemo(() => {
    const tagsPrograma = programaSeleccionado?.tags ?? [];
    if (tagsPrograma.length === 0) return recursosDisponibles;
    return [...recursosDisponibles].sort((a, b) => {
      const aCoincide = coincideTagsConPrograma(a, tagsPrograma);
      const bCoincide = coincideTagsConPrograma(b, tagsPrograma);
      if (aCoincide === bCoincide) return 0;
      return aCoincide ? -1 : 1;
    });
  }, [recursosDisponibles, programaSeleccionado]);
  // Hidratacion real (3.5): lee las asignaciones persistidas del tenant al
  // montar / cambiar de tenant, para que "Materiales asignados" sobreviva a un
  // recargo y editar/eliminar operen sobre ids reales. Conserva cualquier patch
  // optimista local (merge por id) hecho antes de que resuelva la lectura.
  React.useEffect(() => {
    let activo = true;
    listarAsignacionesPorTenant(tenantId)
      .then((reales) => {
        if (!activo || reales.length === 0) return;
        setAsignacionesPublicadas((locales) => {
          const idsLocales = new Set(locales.map((item) => item.id));
          const nuevas = reales
            .filter((real) => !idsLocales.has(real.id))
            .map((real) => real as AsignacionPublicadaLocal);
          return nuevas.length ? [...locales, ...nuevas] : locales;
        });
      })
      .catch(() => {});
    return () => {
      activo = false;
    };
  }, [tenantId]);

  const jornadaActiva = jornadasProgramaActivas[Math.min(jornadaActivaIndex, Math.max(jornadasProgramaActivas.length - 1, 0))];
  const cerrarModalPrograma = () => {
    setConfirmacionProgramaAbierta(false);
    setConfirmacionCierreProgramaAbierta(false);
    setModalProgramaAbierto(false);
  };
  const programaTieneCambiosSinGuardar = modalProgramaAbierto
    && serializarProgramaParaCambios(programaEditando) !== serializarProgramaParaCambios(programaSnapshotAlAbrir);
  const solicitarCerrarModalPrograma = () => {
    if (programaTieneCambiosSinGuardar) {
      setConfirmacionCierreProgramaAbierta(true);
      return;
    }
    cerrarModalPrograma();
  };
  const programaFormularioValido = Boolean(
    programaEditando.nombre.trim()
    && programaEditando.fechaInicio
    && programaEditando.fechaFin
    && programaEditando.instructor
    && programaEditando.instructorId
    && programaEditando.sede
    && programaEditando.grupoObjetivo
    && programaEditando.tema.trim()
    && programaEditando.tags.length > 0
    && (programaEditando.diasHorario ?? []).length > 0
    && (programaEditando.diasHorario ?? []).every((bloque) => bloque.horaInicio && bloque.horaFin)
  );
  const programaExisteEnBandeja = Boolean(programaSeleccionado?.id && programas.some((programa) => programa.id === programaSeleccionado.id));

  React.useEffect(() => {
    setOpcionesPrograma((actuales) => ({
      instructores: actuales.instructores.length ? actuales.instructores : opcionesJornadaFallback.instructores,
      sedes: actuales.sedes.length ? actuales.sedes : opcionesJornadaFallback.sedes,
    }));
  }, [opcionesJornadaFallback]);

  React.useEffect(() => {
    let activo = true;
    obtenerContextoJornada(tenantId)
      .then((contexto) => {
        if (!activo) return;
        setOpcionesPrograma({
          instructores: contexto.instructores.length ? contexto.instructores : opcionesJornadaFallback.instructores,
          sedes: contexto.sedes.length ? contexto.sedes : opcionesJornadaFallback.sedes,
        });
      })
      .catch(() => {
        if (activo) {
          setOpcionesPrograma(opcionesJornadaFallback);
        }
      });

    return () => {
      activo = false;
    };
  }, [opcionesJornadaFallback, tenantId]);

  React.useEffect(() => {
    setProgramas((actuales) => actuales.map((programa) => (
      programa.instructor === 'Instructor actual'
        ? { ...programa, instructor: nombreInstructorActual }
        : programa
    )));
  }, [nombreInstructorActual]);

  React.useEffect(() => {
    const sedesActivas = opcionesPrograma.sedes.length ? opcionesPrograma.sedes : opcionesJornadaFallback.sedes;
    const fallbackSede = sedesActivas[0]?.nombre ?? 'Sede principal';

    setProgramas((actuales) => actuales.map((programa) => normalizarSedePrograma(programa, sedesActivas, fallbackSede)));
    setProgramaEditando((actual) => normalizarSedePrograma(actual, sedesActivas, fallbackSede));
  }, [opcionesJornadaFallback.sedes, opcionesPrograma.sedes]);

  React.useEffect(() => {
    if (!programaSeleccionado) return;
    setProgramaJornada(programaSeleccionado.nombre);
    setSedeJornada(obtenerNombreSedeActiva(
      programaSeleccionado.sede,
      opcionesPrograma.sedes,
      opcionesJornadaFallback.sedes[0]?.nombre ?? 'Sede principal',
    ));
    setInstructorJornada(programaSeleccionado.instructor);
    setGrupoJornada(programaSeleccionado.grupoObjetivo);
    if (embedded) {
      setGrupo((actual) => actual || programaSeleccionado.grupoObjetivo);
      setFechaApertura((actual) => actual || programaSeleccionado.fechaInicio);
      setFechaCierre((actual) => actual || programaSeleccionado.fechaFin);
    }
  }, [embedded, opcionesJornadaFallback.sedes, opcionesPrograma.sedes, programaSeleccionado]);

  React.useEffect(() => {
    setJornadaActivaIndex(0);
    setTemaDiaActivo(programaSeleccionado?.tema ?? '');
  }, [programaSeleccionado?.id, programaSeleccionado?.tema]);

  React.useEffect(() => {
    if (!jornadaActiva || !embedded) return;
    setFechaApertura(jornadaActiva.fecha);
    setSedeJornada(jornadaActiva.sede);
    setInstructorJornada(jornadaActiva.instructor);
    setGrupoJornada(jornadaActiva.grupo);
    setGrupo((actual) => actual || jornadaActiva.grupo);
  }, [embedded, jornadaActiva]);

  React.useEffect(() => {
    if (recursos) {
      setRecursosDisponibles(recursos);
      setRecursoId((actual) => actual || recursos[0]?.id || '');
      return;
    }

    let activo = true;
    listarRecursosAprobados(tenantId)
      .then((recursosAprobadosTenant) => {
        if (!activo) return;
        if (recursosAprobadosTenant.length === 0) {
          setRecursosDisponibles([]);
          setRecursoId('');
          return;
        }
        setRecursosDisponibles(recursosAprobadosTenant);
        setRecursoId((actual) => (
          recursosAprobadosTenant.some((recurso) => recurso.id === actual)
            ? actual
            : recursosAprobadosTenant[0].id
        ));
      })
      .catch(() => {
        if (activo) {
          setRecursosDisponibles([]);
          setRecursoId('');
        }
      });

    return () => {
      activo = false;
    };
  }, [recursos, tenantId, refreshTrigger]);

  const recursoSeleccionado = recursosDisponibles.find((item) => item.id === recursoId) ?? recursosDisponibles[0];
  const jornadaEfectivaId = jornadaId || jornadaLocalId;
  const tieneJornadaSeleccionada = Boolean(jornadaEfectivaId);
  const razonBloqueoPublicacion = !tieneJornadaSeleccionada
    ? 'Confirma primero la jornada de referencia en el bloque anterior.'
    : recursosDisponibles.length === 0
      ? 'Aprueba primero un recurso en la biblioteca para poder asignarlo.'
      : '';
  const recurso = React.useMemo(
    () => ({ ...recursoSeleccionado, tenantId }),
    [recursoSeleccionado, tenantId]
  );

  React.useEffect(() => {
    if (recursoSeleccionado) {
      // La spec exige tituloVisible sobre nombre en todo flujo que titule una
      // asignacion publicada (individual o en lote).
      setTituloPersonalizado(recursoSeleccionado.tituloVisible || recursoSeleccionado.nombre);
      setTagsAsignacion(recursoSeleccionado.ficha?.tags?.join(', ') ?? '');
    }
  }, [recursoSeleccionado]);

  const publicar = async () => {
    setError('');
    if (!recursoSeleccionado) {
      setError('Selecciona un recurso aprobado para publicar la asignacion.');
      return;
    }
    if (embedded && !programaSeleccionado) {
      setError('Selecciona o crea un programa antes de publicar el material.');
      return;
    }
    if (!embedded && !jornadaEfectivaId) {
      setError('Selecciona una jornada para conservar la trazabilidad de la asignacion.');
      return;
    }
    const jornadaIdPublicacion = embedded
      ? await asegurarJornadaPrograma()
      : jornadaEfectivaId;
    if (!jornadaIdPublicacion) return;
    const clavePublicacion = crearClavePublicacionAsignacion({
      recursoId: recurso.id,
      jornadaId: jornadaIdPublicacion,
      tipoDestinatario,
      grupo,
      grados,
      momento,
      criterio,
    });
    const asignacionBaseId = `asignacion-${clavePublicacion.replace(/[^a-z0-9]+/gi, '-')}`;
    if (!asignacionEditandoId && asignacionesPublicadas.some((item) => item.clavePublicacion === clavePublicacion)) {
      setError('Este material ya fue publicado con la misma jornada, destinatario y criterio. Edita el registro existente o cambia la configuracion.');
      return;
    }
    setPublicando(true);
    const tags = parsearTagsAsignacion(tagsAsignacion);
    const destinatario = crearDestinatario(tipoDestinatario, grupo || 'Infantil', grados);
    try {
      const asignacion = publishAsignacion({
        asignacion: {
          id: asignacionEditandoId || asignacionBaseId,
          tenantId,
          recursoId: recurso.id,
          titulo: tituloPersonalizado.trim() || recurso.tituloVisible || recurso.nombre,
          descripcion: `Asignacion academica para ${recurso.ficha?.disciplina ?? 'disciplina general'}`,
          tags,
          destinatario,
          uso: mapearCriterioAUso(criterio),
          momento,
          obligatoria: true,
          fechaApertura: `${fechaApertura}T00:00:00.000Z`,
          fechaCierre: fechaCierre ? `${fechaCierre}T23:59:59.000Z` : undefined,
          estado: 'borrador',
          creadoPorUid: usuarioId,
          creadoEn: new Date().toISOString(),
          actualizadoEn: new Date().toISOString(),
        },
        recurso,
        publicadoPorUid: usuarioId,
      });
      const resultado = await publicarAsignacionFn({
        tenantId: asignacion.tenantId,
        jornadaId: jornadaIdPublicacion,
        asignacion,
      });

      setResultadoPublicacion(resultado);
      const asignacionPublicada: AsignacionPublicadaLocal = {
        ...asignacion,
        id: resultado.id || asignacion.id,
        jornadaId: jornadaIdPublicacion,
        clavePublicacion,
        criterioPublicacion: criterio,
      };
      setPublicada(asignacionPublicada);
      setAsignacionesPublicadas((actuales) => {
        const sinDuplicado = actuales.filter((item) => (
          item.id !== asignacionPublicada.id
          && item.clavePublicacion !== asignacionPublicada.clavePublicacion
        ));
        return [asignacionPublicada, ...sinDuplicado];
      });
      setAsignacionEditandoId('');
      setPasoPublicacion(4);
      // Fix 5: mismo mecanismo que Fix 4 (guardar/eliminar programa) -- sin esto
      // "Mis clases" no reflejaba el material recien publicado hasta navegar
      // afuera y volver.
      setRefrescoMisClases((actual) => actual + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo publicar la asignacion.');
    } finally {
      setPublicando(false);
    }
  };

  const abrirCrearPrograma = () => {
    const sedesActivas = opcionesPrograma.sedes.length ? opcionesPrograma.sedes : opcionesJornadaFallback.sedes;
    const nuevo: ProgramaAcademicoAsignacion = {
      ...programaInicial,
      id: `programa-${Date.now()}`,
      nombre: 'Nuevo programa',
      fechaInicio: fechaApertura,
      fechaFin: fechaCierre || programaInicial.fechaFin,
      instructor: instructorJornada || nombreInstructorActual,
      // Fix 1: por defecto se autoasigna quien crea (Admin puede cambiarlo
      // luego en el selector; Editor queda bloqueado a este mismo valor).
      instructorId: usuarioId,
      sede: obtenerNombreSedeActiva(sedeJornada, sedesActivas, sedesActivas[0]?.nombre ?? 'Sede principal'),
      grupoObjetivo: grupo || programaInicial.grupoObjetivo,
      tema: '',
      objetivoClase: '',
      observaciones: '',
      tags: [],
    };
    setProgramaEditando(nuevo);
    setProgramaSnapshotAlAbrir(nuevo);
    setModalProgramaAbierto(true);
  };

  const abrirEditarPrograma = () => {
    if (!programaSeleccionado) return;
    const sedesActivas = opcionesPrograma.sedes.length ? opcionesPrograma.sedes : opcionesJornadaFallback.sedes;
    const programaNormalizado = normalizarSedePrograma(programaSeleccionado, sedesActivas, sedesActivas[0]?.nombre ?? 'Sede principal');
    setProgramaEditando(programaNormalizado);
    setProgramaSnapshotAlAbrir(programaNormalizado);
    setModalProgramaAbierto(true);
  };

  const guardarPrograma = async () => {
    if (guardandoPrograma) return;
    setGuardandoPrograma(true);
    try {
      const sedesActivas = opcionesPrograma.sedes.length ? opcionesPrograma.sedes : opcionesJornadaFallback.sedes;
      const nombreNormalizado = programaEditando.nombre.trim() || 'Programa sin nombre';
      const instructorFinal = puedeElegirInstructor
        ? {
          instructor: programaEditando.instructor || nombreInstructorActual,
          instructorId: programaEditando.instructorId || usuarioId,
        }
        : {
          instructor: nombreInstructorActual,
          instructorId: usuarioId,
        };
      const programaNormalizado = {
        ...programaEditando,
        nombre: nombreNormalizado,
        grupoObjetivo: programaEditando.grupoObjetivo || 'Infantil',
        sede: obtenerNombreSedeActiva(programaEditando.sede, sedesActivas, sedesActivas[0]?.nombre ?? 'Sede principal'),
        ...instructorFinal,
        tags: programaEditando.tags.map((tag) => tag.trim()).filter(Boolean),
      };

      let idReal = programaNormalizado.id;

      if (programaNormalizado.diasHorario?.length && programaNormalizado.fechaFin) {
        try {
          const esEdicion = idReal && idReal !== 'programa-infantil-iniciacion-jul-sep-2026';
          const programaRealInput: any = {
            tenantId,
            nombre: programaNormalizado.nombre,
            descripcion: programaNormalizado.observaciones || programaNormalizado.tema,
            tags: programaNormalizado.tags,
            unidades: [{
              id: `unidad-${slugificar(programaNormalizado.tema || programaNormalizado.nombre)}`,
              nombre: programaNormalizado.tema || programaNormalizado.nombre,
              orden: 1,
              objetivos: [{
                id: `objetivo-${slugificar(programaNormalizado.objetivoClase || programaNormalizado.tema || 'general')}`,
                descripcion: programaNormalizado.objetivoClase || programaNormalizado.tema || 'Objetivo general',
                orden: 1,
              }],
            }],
          };
          if (esEdicion) {
            programaRealInput.id = idReal;
          }

          const programaReal = publishPrograma(createPrograma(programaRealInput));
          const ejecucionId = `ejecucion-${programaReal.id}`;
          const sedeIdReal = resolverSedeIdPorNombre(programaNormalizado.sede, sedesActivas);
          const bloques = crearBloquesDesdePrograma(programaNormalizado, tenantId, sedeIdReal);
          const ejecucion = assignProgramaToGrupo(programaReal, {
            id: ejecucionId,
            grupoId: slugificar(programaNormalizado.grupoObjetivo),
            sedeId: sedeIdReal,
            fechaInicio: programaNormalizado.fechaInicio,
            bloques,
            fechaFin: programaNormalizado.fechaFin,
          });

          // Obtener jornadas existentes para limpiar duplicados Y para chequear conflictos
          // antes de guardar el nuevo horario.
          // Fix 2026-07-16 (mismo bug real de jornadas huerfanas que en eliminarProgramaSeleccionado
          // -- ver comentario extenso ahi): matchear tambien por `j.programaId`, no solo por
          // `ejecucionProgramaId`, para no dejar huerfanas jornadas de una ejecucion anterior que
          // no haya seguido la convencion determinista de ID.
          const todasJornadas = await repositoryJornada.listarJornadasPorTenant(tenantId);
          const jornadasViejasNoCerradas = todasJornadas
            .filter((j) => (j.programaId === programaReal.id || j.ejecucionProgramaId === ejecucionId) && j.estado !== 'cerrada');

          const jornadasGeneradas = generarJornadasDeEjecucion(programaReal, ejecucion);

          // Fix 2026-07-16 (bug real reportado: dar de alta un programa generaba TODA su
          // agenda semanal recurrente sin revisar si el maestro o la sede ya estaban ocupados
          // en ese horario por OTRO programa -- el unico chequeo de conflicto que existia
          // [existeConflictoHorario, subtarea 12.3] solo corria al editar UNA jornada a mano
          // desde ModalEdicionJornada, nunca en esta alta masiva). Se compara contra las
          // jornadas activas del tenant EXCLUYENDO las que este mismo guardado va a
          // reemplazar (las jornadas viejas de ESTE programa no deben chocar contra si
          // mismas al reguardar). Si hay conflicto, se aborta ANTES de borrar nada o
          // escribir el programa nuevo -- mismo criterio "bloquear, no solo avisar" que ya
          // usa ModalEdicionJornada.
          const idsAReemplazar = new Set(jornadasViejasNoCerradas.map((j) => j.id));
          const jornadasParaChequeoConflicto = todasJornadas.filter((j) => !idsAReemplazar.has(j.id));
          const conflictos = detectarConflictosEnLote(jornadasGeneradas, jornadasParaChequeoConflicto);
          if (conflictos.length > 0) {
            const primero = conflictos[0];
            const motivoTexto = primero.motivo === 'instructor'
              ? 'el maestro ya tiene otra clase asignada'
              : 'la sede ya tiene otra clase asignada';
            setError(
              `No se puede guardar: ${motivoTexto} el ${primero.jornadaNueva.fecha} de ${primero.jornadaNueva.horaInicio} a ${primero.jornadaNueva.horaFin}. Ajustá el horario, sede o instructor del programa antes de guardar.`
            );
            return;
          }

          if (jornadasViejasNoCerradas.length > 0) {
            await repositoryJornada.eliminarJornadasEnLote(
              tenantId,
              jornadasViejasNoCerradas.map((j) => j.id)
            );
          }

          await repositoryPrograma.guardarPrograma(programaReal);
          await repositoryJornada.guardarEjecucion(ejecucion);
          await repositoryJornada.guardarJornadasEnLote(jornadasGeneradas);
          idReal = programaReal.id;
          // Fix 4: las jornadas del programa cambiaron -> recargar "Mis clases"
          // sin exigir navegar afuera y volver.
          setRefrescoMisClases((actual) => actual + 1);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'No se pudo generar las clases reales del programa.');
        }
      }

      const programaGuardado = { ...programaNormalizado, id: idReal };

      setProgramas((actuales) => {
        const existe = actuales.some((programa) => programa.id === programaGuardado.id || programa.id === programaEditando.id);
        return existe
          ? actuales.map((programa) => (
            (programa.id === programaGuardado.id || programa.id === programaEditando.id) ? programaGuardado : programa
          ))
          : [...actuales, programaGuardado];
      });
      setProgramaSeleccionadoId(programaGuardado.id);
      setJornadaLocalId('');
      setProgramaSnapshotAlAbrir(programaGuardado);
      setModalProgramaAbierto(false);
      setPasoPublicacion((actual) => (actual < 2 ? 2 : actual));
    } finally {
      setGuardandoPrograma(false);
    }
  };

  // Fix 1: borrado real de un programa academico. Antes no existia ninguna via para
  // eliminar un programa (ni funcion de servicio ni boton). Ademas de borrar el
  // documento ProgramaAcademico, limpia las jornadas asociadas que aun no se operaron
  // (mismo criterio de trazabilidad de la subtarea 12.6: una jornada cerrada/operada
  // o con asistencia registrada NUNCA se borra fisicamente; se conserva como historial
  // aunque su programa desaparezca). El placeholder demo local nunca se persistio, asi
  // que para el solo se limpia el estado local.
  const eliminarProgramaSeleccionado = async () => {
    if (!programaSeleccionado || eliminandoPrograma) return;
    setEliminandoPrograma(true);
    setError('');
    const programaId = programaSeleccionado.id;
    try {
      // Fix 2026-07-16 (bug real: jornadas huerfanas -- "programa-xxxx" crudo en Agenda
      // para programas que ya NO existen en la lista). Antes esto matcheaba SOLO por
      // `jornada.ejecucionProgramaId === \`ejecucion-${programaId}\`` -- un match indirecto
      // que depende de que la ejecucion siga esa convencion exacta de ID. `jornada.programaId`
      // es un campo DIRECTO que `generarJornadasDeEjecucion` siempre setea al ID real del
      // programa (programaService.ts), sin pasar por el nombre de la ejecucion -- matchear
      // por ahi es mas confiable y no deja huerfanos si alguna ejecucion vieja no siguio la
      // convencion determinista (datos de pruebas, ediciones repetidas, etc.).
      const ejecucionId = `ejecucion-${programaId}`;
      const todasJornadas = await repositoryJornada.listarJornadasPorTenant(tenantId);
      const jornadasEliminables = todasJornadas.filter(
        (jornada) =>
          (jornada.programaId === programaId || jornada.ejecucionProgramaId === ejecucionId) &&
          !esJornadaOperada(jornada),
      );
      if (jornadasEliminables.length > 0) {
        await repositoryJornada.eliminarJornadasEnLote(
          tenantId,
          jornadasEliminables.map((jornada) => jornada.id),
        );
      }

      if (programaId !== programaInicial.id) {
        await repositoryPrograma.eliminarPrograma(tenantId, programaId);
      }

      setProgramas((actuales) => {
        const restantes = actuales.filter((programa) => programa.id !== programaId);
        // La vista asume que siempre hay al menos un programa en bandeja
        // (programaSeleccionado.id se usa sin guarda): si se borro el ultimo,
        // se restaura el placeholder local.
        return restantes.length ? restantes : [programaInicial];
      });
      setProgramaSeleccionadoId((actual) => {
        if (actual !== programaId) return actual;
        const restantes = programas.filter((programa) => programa.id !== programaId);
        return restantes[0]?.id ?? programaInicial.id;
      });
      setJornadaLocalId('');
      // Fix 4: las jornadas del programa borrado ya no existen -> refrescar "Mis clases".
      setRefrescoMisClases((actual) => actual + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el programa.');
    } finally {
      setEliminandoPrograma(false);
      setConfirmacionEliminarProgramaAbierta(false);
    }
  };

  const editarAsignacionPublicada = (asignacion: AsignacionPublicadaLocal) => {
    setAsignacionEditandoId(asignacion.id);
    setRecursoId(asignacion.recursoId);
    setTituloPersonalizado(asignacion.titulo);
    setTipoDestinatario(asignacion.destinatario.tipo);
    setGrupo(
      asignacion.destinatario.tipo === 'estudiante'
        ? asignacion.destinatario.estudianteIds?.join(', ') ?? ''
        : asignacion.destinatario.grupo ?? ''
    );
    setGrados(asignacion.destinatario.grados?.join(', ') ?? '');
    setFechaApertura(asignacion.fechaApertura.slice(0, 10));
    setFechaCierre(asignacion.fechaCierre?.slice(0, 10) ?? '');
    setMomento(asignacion.momento);
    setCriterio(asignacion.uso === 'evaluacion' ? 'evaluacion' : asignacion.uso === 'refuerzo' ? 'refuerzo' : 'estudio');
    setTagsAsignacion(asignacion.tags?.join(', ') ?? '');
    setPasoPublicacion(2);
    setError('');
    window.setTimeout(() => {
      if (typeof bloqueJornadaRef.current?.scrollIntoView === 'function') {
        bloqueJornadaRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 80);
  };

  // Publicar material NUNCA crea ni elimina una clase — solo selecciona una jornada
  // ya generada de antemano (al guardar el programa con su horario) y le agrega
  // detalles de asignacion/grado/criterio. Si no hay una jornada real, la publicacion
  // debe fallar en vez de crear una silenciosamente.
  const asegurarJornadaPrograma = async (): Promise<string> => {
    if (jornadaEfectivaId) return jornadaEfectivaId;
    if (!jornadaActiva?.id) {
      setError('No hay una clase real generada para este programa todavia. Guarda el programa con su horario primero.');
      return '';
    }

    try {
      // Subtarea 12.5: esta operacion no muta ningun campo de JornadaInstruccion (solo
      // asocia una jornada ya existente a la publicacion de material), asi que no hay
      // diff campo por campo que reportar -- cambios queda vacio. El "origen" que antes
      // se stuffeaba a mano dentro de `cambios` ahora es el campo dedicado `fuente`.
      await repositoryJornada.registrarAuditoria({
        tenantId,
        jornadaId: jornadaActiva.id,
        usuarioId,
        rol: usuario?.rol ?? RolUsuario.Editor,
        fuente: 'asignaciones',
        accion: 'actualizar',
        cambios: [],
      });
    } catch (auditError) {
      console.warn(
        '[CentroEstudios] No se pudo registrar auditoria de publicacion de material',
        auditError,
      );
      // Subtarea 12.5: el guardado principal (asociar la jornada) ya se aplico y no se
      // revierte (no hay transaccion/rollback), pero el fallo de auditoria ya no queda
      // silencioso.
      setError(MENSAJE_ADVERTENCIA_AUDITORIA);
    }

    setJornadaLocalId(jornadaActiva.id);
    setPasoPublicacion((actual) => (actual < 3 ? 3 : actual));
    return jornadaActiva.id;
  };

  // -------------------------------------------------------------------------
  // Asistente unificado: derivaciones y handlers
  // -------------------------------------------------------------------------
  const tagsProgramaActivo = programaSeleccionado?.tags ?? [];

  // Asignaciones de la clase activa (por jornadaId real). Alimenta el listado
  // de "Materiales asignados" y la exclusion de duplicados del Paso 1.
  const asignacionesClaseActiva = React.useMemo(() => (
    jornadaActiva
      ? asignacionesPublicadas.filter((asignacion) => asignacion.jornadaId === jornadaActiva.id)
      : []
  ), [asignacionesPublicadas, jornadaActiva]);

  // Exclusion de duplicados (3.8): los materiales ya asignados a la clase
  // activa no se ofrecen en el Paso 1; el wizard recibe la lista ya filtrada y
  // priorizada, quedando agnostico de la exclusion.
  // Fase 4: al editar una asignacion existente, su PROPIO recurso no debe
  // excluirse contra si mismo (antes se calculaba sobre TODAS las asignaciones
  // de la clase activa, incluida la que se estaba editando, lo que dejaba a
  // AsignarMaterialWizard sin el recurso real en `materialesDisponibles` y
  // forzaba el chip generico "Material asignado" en vez del titulo real).
  const materialesDisponiblesWizard = React.useMemo(() => {
    const idsAsignados = new Set(
      asignacionesClaseActiva
        .filter((asignacion) => asignacion.id !== asignacionEditandoWizard?.id)
        .map((asignacion) => asignacion.recursoId)
    );
    return recursosPriorizadosPorTag.filter((recurso) => !idsAsignados.has(recurso.id));
  }, [recursosPriorizadosPorTag, asignacionesClaseActiva, asignacionEditandoWizard]);

  const draftBaseCrear = (): AsignacionDraft => ({
    recursoId: '',
    destinatario: 'grupo',
    grupoObjetivo: programaSeleccionado?.grupoObjetivo || gruposObjetivo[0],
    momento: 'preparacion',
    criterio: 'estudio',
    fechaApertura: programaSeleccionado?.fechaInicio || new Date().toISOString().slice(0, 10),
    fechaCierre: programaSeleccionado?.fechaFin || '',
    grados: [],
  });

  const draftDesdeAsignacion = (asignacion: AsignacionPublicadaLocal): AsignacionDraft => ({
    recursoId: asignacion.recursoId,
    // Fix 2: el wizard ya no deja elegir destinatario (siempre 'grupo'); el
    // propio componente lo fuerza igual al abrir (ver override en su
    // useState), pero se deja explicito aqui tambien para que la intencion
    // sea clara desde el punto de partida, sin depender del tipo original de
    // la asignacion (que podia ser 'estudiante' de antes de este fix).
    destinatario: 'grupo',
    grupoObjetivo: asignacion.destinatario.grupo || gruposObjetivo[0],
    momento: asignacion.momento,
    criterio: asignacion.criterioPublicacion
      ?? (asignacion.uso === 'evaluacion' ? 'evaluacion' : asignacion.uso === 'refuerzo' ? 'refuerzo' : 'estudio'),
    fechaApertura: asignacion.fechaApertura.slice(0, 10),
    fechaCierre: asignacion.fechaCierre?.slice(0, 10) ?? '',
    grados: (asignacion.destinatario.grados ?? []) as GradoTKD[],
  });

  const abrirWizardCrear = (preseleccionRecursoId?: string) => {
    setWizardModo('crear');
    setAsignacionEditandoWizard(null);
    setDraftInicialWizard(preseleccionRecursoId ? { ...draftBaseCrear(), recursoId: preseleccionRecursoId } : null);
    setError('');
    setWizardAbierto(true);
  };

  const abrirWizardEditar = (asignacion: AsignacionPublicadaLocal) => {
    setWizardModo('editar');
    setAsignacionEditandoWizard(asignacion);
    setDraftInicialWizard(draftDesdeAsignacion(asignacion));
    setError('');
    setWizardAbierto(true);
  };

  const cerrarWizard = () => {
    setWizardAbierto(false);
    setAsignacionEditandoWizard(null);
    setDraftInicialWizard(null);
  };

  // Rediseño 2026-07-11: el icono editar de la tarjeta de Mis Clases (MisClasesView)
  // delega la jornada clickeada aca. Si esa jornada ya tiene material, se edita
  // preservando su configuracion (mismo camino que el lapiz de "Materiales asignados").
  // Si no tiene, se abre el wizard en modo crear -- pero antes hay que sincronizar
  // `jornadaActivaIndex` (el wizard resuelve el jornadaId de destino via jornadaActiva/
  // asegurarJornadaPrograma, no recibe la jornada por parametro).
  const handleEditarMaterialDesdeClase = (jornada: JornadaInstruccion) => {
    const existente = asignacionesPublicadas.find((item) => item.jornadaId === jornada.id);
    if (existente) {
      abrirWizardEditar(existente);
      return;
    }
    const indice = jornadasProgramaActivas.findIndex((item) => item.id === jornada.id);
    if (indice >= 0) {
      setJornadaActivaIndex(indice);
    }
    abrirWizardCrear();
  };

  // Confirmacion del asistente: crea (publicarAsignacionFn) o edita
  // (actualizarAsignacionFn, upsert con mismo id). Reutiliza publishAsignacion
  // para validar recurso aprobado y armar la asignacion, igual que publicar().
  const confirmarWizard = async (draft: AsignacionDraft) => {
    const recursoDraft = recursosDisponibles.find((item) => item.id === draft.recursoId);
    if (!recursoDraft) {
      throw new Error('Selecciona un material valido para asignar.');
    }
    const jornadaIdPublicacion = embedded ? await asegurarJornadaPrograma() : jornadaEfectivaId;
    if (!jornadaIdPublicacion) {
      throw new Error('No hay una clase real generada para este programa. Guarda el programa con su horario primero.');
    }
    const gradosTexto = draft.grados.join(', ');
    const destinatario = crearDestinatario(draft.destinatario, draft.grupoObjetivo || 'Infantil', gradosTexto);
    const clavePublicacion = crearClavePublicacionAsignacion({
      recursoId: draft.recursoId,
      jornadaId: jornadaIdPublicacion,
      tipoDestinatario: draft.destinatario,
      grupo: draft.grupoObjetivo,
      grados: gradosTexto,
      momento: draft.momento,
      criterio: draft.criterio,
    });
    const asignacionId = wizardModo === 'editar' && asignacionEditandoWizard
      ? asignacionEditandoWizard.id
      : `asignacion-${clavePublicacion.replace(/[^a-z0-9]+/gi, '-')}`;
    const recursoConTenant = { ...recursoDraft, tenantId };
    const asignacion = publishAsignacion({
      asignacion: {
        id: asignacionId,
        tenantId,
        recursoId: draft.recursoId,
        titulo: recursoDraft.tituloVisible || recursoDraft.nombre,
        descripcion: `Asignacion academica para ${recursoDraft.ficha?.disciplina ?? 'disciplina general'}`,
        tags: recursoDraft.ficha?.tags ?? [],
        destinatario,
        uso: mapearCriterioAUso(draft.criterio),
        momento: draft.momento,
        obligatoria: true,
        fechaApertura: `${draft.fechaApertura}T00:00:00.000Z`,
        fechaCierre: draft.fechaCierre ? `${draft.fechaCierre}T23:59:59.000Z` : undefined,
        estado: 'publicada',
        creadoPorUid: usuarioId,
        creadoEn: new Date().toISOString(),
        actualizadoEn: new Date().toISOString(),
      },
      recurso: recursoConTenant,
      publicadoPorUid: usuarioId,
    });

    if (wizardModo === 'editar') {
      await actualizarAsignacionFn({ asignacion: { ...asignacion, jornadaId: jornadaIdPublicacion } });
    } else {
      await publicarAsignacionFn({ tenantId, jornadaId: jornadaIdPublicacion, asignacion });
    }

    const asignacionPublicada: AsignacionPublicadaLocal = {
      ...asignacion,
      jornadaId: jornadaIdPublicacion,
      clavePublicacion,
      criterioPublicacion: draft.criterio,
    };
    setAsignacionesPublicadas((actuales) => {
      const sinDuplicado = actuales.filter((item) => item.id !== asignacionPublicada.id);
      return [asignacionPublicada, ...sinDuplicado];
    });
    // Fix 5: mismo mecanismo que Fix 4 -- sin esto "Mis clases" no reflejaba el
    // material recien publicado/editado hasta navegar afuera y volver.
    setRefrescoMisClases((actual) => actual + 1);
    cerrarWizard();
  };

  const confirmarEliminarAsignacion = async () => {
    if (!asignacionEliminando) return;
    setEliminandoAsignacion(true);
    try {
      await eliminarAsignacionFn({ tenantId, asignacionId: asignacionEliminando.id });
      setAsignacionesPublicadas((actuales) => actuales.filter((item) => item.id !== asignacionEliminando.id));
      // Fix 5: idem -- "Mis clases" seguia mostrando el material ya eliminado.
      setRefrescoMisClases((actual) => actual + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la asignacion.');
    } finally {
      setEliminandoAsignacion(false);
      setAsignacionEliminando(null);
    }
  };

  // Pildora de tema editable en linea (3.7): al confirmar persiste con
  // actualizarTemaJornada, sin abrir el asistente. La jornada puede ser una
  // preview sintetica nunca persistida, por eso el error no rompe la UI.
  const abrirEdicionTema = () => {
    setTemaBorrador(temaDiaActivo);
    setTemaEditando(true);
  };

  const guardarTema = async () => {
    setTemaEditando(false);
    const nuevoTema = temaBorrador.trim();
    setTemaDiaActivo(nuevoTema);
    if (!jornadaActiva?.id) return;
    try {
      await repositoryJornada.actualizarTemaJornada(tenantId, jornadaActiva.id, nuevoTema);
    } catch (err) {
      console.warn('[CentroEstudios] No se pudo guardar el tema de la jornada', err);
    }
  };

  // Bridge de Biblioteca (3.9): la seleccion entrante abre el asistente en el
  // Paso 1 con el primer recurso preseleccionado; el resto queda visible y
  // seleccionable en la lista (ya excluida de duplicados de la clase activa).
  React.useEffect(() => {
    if (!recursoIdsParaLote || recursoIdsParaLote.length === 0) return;
    abrirWizardCrear(recursoIdsParaLote[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recursoIdsParaLote]);

  const puedePublicarEmbebido = Boolean(
    recursoSeleccionado
    && (embedded ? programaSeleccionado : jornadaEfectivaId)
    && tipoDestinatario
    && grupo.trim()
    && fechaApertura
    && fechaCierre
    && criterio
    && momento
  );

  // Fix 1: se compara/agrega por id (uid real), no por nombre. Si el
  // instructor actual del programa no esta en la lista real del tenant (p.ej.
  // quedo huerfano porque el usuario se dio de baja), se antepone igual para
  // no perder la seleccion vigente, usando su propio id como key.
  const instructoresProgramaVisibles = React.useMemo(() => {
    const base = opcionesPrograma.instructores.map((opcion) => [opcion.id, opcion] as const);
    if (programaEditando.instructorId && !base.some(([id]) => id === programaEditando.instructorId)) {
      base.unshift([
        programaEditando.instructorId,
        { id: programaEditando.instructorId, nombre: programaEditando.instructor || programaEditando.instructorId },
      ]);
    }
    return base.map(([, opcion]) => opcion);
  }, [opcionesPrograma.instructores, programaEditando.instructorId, programaEditando.instructor]);
  const sedesProgramaVisibles = React.useMemo(() => {
    return opcionesPrograma.sedes.length ? opcionesPrograma.sedes : opcionesJornadaFallback.sedes;
  }, [opcionesJornadaFallback.sedes, opcionesPrograma.sedes]);
  React.useEffect(() => {
    onFlujoEstadoChange?.({
      recursosAprobados: recursosDisponibles.filter((item) => item.estado === 'aprobado').length,
      recursoSeleccionado: Boolean(recursoSeleccionado),
      pasoPublicacion,
      jornadaConfirmada: Boolean(jornadaEfectivaId),
      materialPublicado: asignacionesPublicadas.length > 0,
    });
  }, [
    asignacionesPublicadas.length,
    jornadaEfectivaId,
    onFlujoEstadoChange,
    pasoPublicacion,
    recursoSeleccionado,
    recursosDisponibles,
  ]);
  const claseIconoDocumentoCentroEstudios = 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-tkd-red';
  const claseBotonIconoDocumentoCentroEstudios = 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-tkd-red transition hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-100';
  const renderTagSelector = (
    tagsSeleccionados: string[],
    onToggle: (tag: string) => void,
  ) => (
    <div className="max-h-44 overflow-y-auto rounded-2xl border border-gray-100 bg-gray-50 p-3 dark:border-white/10 dark:bg-white/5">
      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-400">Tags estandarizados</p>
      <div className="space-y-3">
        {TAGS_ACADEMICOS_ESTANDAR.map((grupo) => (
          <div key={grupo.grupo}>
            <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-tkd-blue">{grupo.grupo}</p>
            <div className="flex flex-wrap gap-2">
              {grupo.tags.map((tag) => {
                const seleccionado = tagsSeleccionados.some((actual) => actual.toLowerCase() === tag.toLowerCase());
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => onToggle(tag)}
                    className={`rounded-full border px-3 py-1 text-[10px] font-bold transition ${
                      seleccionado
                        ? 'border-tkd-blue bg-blue-50 text-tkd-blue'
                        : 'border-gray-200 bg-white text-gray-500 hover:border-tkd-blue hover:text-tkd-blue'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
  if (embedded) {
    return (
      <div className="grid gap-5 xl:contents">
        <div className="min-w-0 space-y-5">

        <article ref={bloqueJornadaRef} className="relative overflow-hidden rounded-[2rem] border border-gray-100 bg-white shadow-sm dark:border-white/10 dark:bg-gray-900">
          <section className="p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-tkd-red">3. Programa</p>
            <p className="mt-2 max-w-xs text-xs font-bold text-gray-400">
              Los tags del programa deben coincidir con los tags del material.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto_auto] sm:items-end">
              <label className="grid gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
                <span className="sr-only">Programa</span>
                <select
                  aria-label="Programa"
                  value={programaSeleccionadoId}
                  onChange={(event) => {
                    setProgramaSeleccionadoId(event.target.value);
                    setJornadaLocalId('');
                    setPasoPublicacion((actual) => (actual < 2 ? 2 : actual));
                  }}
                  className="h-[52px] rounded-2xl border border-gray-200 px-4 py-3 text-sm font-medium normal-case tracking-normal text-tkd-dark"
                >
                  {programas.map((programa) => (
                    <option key={programa.id} value={programa.id}>{programa.nombre}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={abrirCrearPrograma}
                className="inline-flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-red-50 text-tkd-red transition hover:bg-red-100"
                aria-label="Crear programa"
                title="Crear programa"
              >
                <IconoAgregar className="h-5 w-5" />
              </button>
              {programaExisteEnBandeja && (
                <button
                  type="button"
                  onClick={abrirEditarPrograma}
                  className="inline-flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-red-50 text-tkd-red transition hover:bg-red-100"
                  aria-label="Editar programa"
                  title="Editar programa"
                >
                  <IconoEditar className="h-5 w-5" />
                </button>
              )}
              {programaExisteEnBandeja && (
                <button
                  type="button"
                  onClick={() => setConfirmacionEliminarProgramaAbierta(true)}
                  className="inline-flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-red-50 text-tkd-red transition hover:bg-red-100"
                  aria-label="Eliminar programa"
                  title="Eliminar programa"
                >
                  <IconoEliminar className="h-5 w-5" />
                </button>
              )}
            </div>

            {programaSeleccionado && (
              <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-gray-950/30">
                <div className="grid gap-4 text-xs font-bold text-tkd-dark sm:grid-cols-3">
                  <p><span className="block text-[9px] font-black uppercase tracking-widest text-gray-400">Grupo objetivo</span>{programaSeleccionado.grupoObjetivo}</p>
                  <p><span className="block text-[9px] font-black uppercase tracking-widest text-gray-400">Instructor</span>{programaSeleccionado.instructor}</p>
                  <p><span className="block text-[9px] font-black uppercase tracking-widest text-gray-400">Sede</span>{programaSeleccionado.sede}</p>
                  <p className="sm:col-span-2">
                    <span className="block text-[9px] font-black uppercase tracking-widest text-gray-400">Tags</span>
                    <span className="mt-1 flex flex-wrap gap-2">
                      {programaSeleccionado.tags.length === 0 ? (
                        <span className="text-gray-400">Sin tags</span>
                      ) : programaSeleccionado.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-black text-tkd-blue">{tag}</span>
                      ))}
                    </span>
                  </p>
                </div>
              </div>
            )}
          </section>

          <section className="border-t border-gray-100 p-5 dark:border-white/10">
            <div className="mb-4">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-tkd-red">Publicar material</p>
              <h3 className="mt-2 text-2xl font-black uppercase text-tkd-dark dark:text-white">Clase activa</h3>
            </div>

            <div className="mb-5 rounded-[1.5rem] border border-gray-100 bg-gray-50 p-4 dark:border-white/10 dark:bg-gray-950/30">
              <div className="mb-4">
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setJornadaActivaIndex((actual) => Math.max(0, actual - 1))}
                    disabled={jornadaActivaIndex === 0}
                    className="inline-flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl bg-red-50 text-tkd-red transition hover:bg-red-100 disabled:opacity-40"
                    aria-label="Clase anterior"
                    title="Clase anterior"
                  >
                    <IconoFlechaIzquierda className="h-5 w-5" />
                  </button>
                  <p className="text-center text-[10px] font-medium uppercase tracking-widest text-gray-400">
                    Clase {Math.min(jornadaActivaIndex + 1, jornadasProgramaActivas.length)} de {jornadasProgramaActivas.length}
                  </p>
                  <button
                    type="button"
                    onClick={() => setJornadaActivaIndex((actual) => Math.min(jornadasProgramaActivas.length - 1, actual + 1))}
                    disabled={jornadaActivaIndex >= jornadasProgramaActivas.length - 1}
                    className="inline-flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl bg-red-50 text-tkd-red transition hover:bg-red-100 disabled:opacity-40"
                    aria-label="Clase siguiente"
                    title="Clase siguiente"
                  >
                    <IconoFlechaDerecha className="h-5 w-5" />
                  </button>
                </div>
                <p className="mt-2 text-center text-sm font-bold text-tkd-dark dark:text-white">
                  {jornadaActiva?.fecha ?? fechaApertura} · {jornadaActiva?.horaInicio ?? '08:00'} - {jornadaActiva?.horaFin ?? '09:00'} · {jornadaActiva?.sede ?? sedeJornada}
                </p>
              </div>

              <div className="mb-4 flex flex-wrap gap-2" aria-label="Navegacion de jornadas">
                {jornadasProgramaActivas.map((jornada, index) => {
                  const tieneMaterial = asignacionesPublicadas.some((asignacion) => asignacion.jornadaId === jornada.id || asignacion.fechaApertura.slice(0, 10) === jornada.fecha);
                  const vencida = jornada.fecha < new Date().toISOString().slice(0, 10);
                  const claseEstado = index === jornadaActivaIndex
                    ? 'bg-tkd-blue text-white'
                    : tieneMaterial
                      ? 'bg-green-50 text-green-700'
                      : vencida
                        ? 'bg-red-50 text-tkd-red'
                        : 'bg-gray-100 text-gray-500';
                  return (
                    <button
                      key={jornada.id}
                      type="button"
                      onClick={() => setJornadaActivaIndex(index)}
                      className={`h-8 min-w-8 rounded-full px-3 text-[10px] font-black ${claseEstado}`}
                      aria-label={`Clase ${index + 1}: ${jornada.fecha}`}
                    >
                      {index + 1}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Tema de la clase</span>
                {temaEditando ? (
                  <input
                    autoFocus
                    aria-label="Tema de la clase"
                    value={temaBorrador}
                    onChange={(event) => setTemaBorrador(event.target.value)}
                    onBlur={guardarTema}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') { event.preventDefault(); guardarTema(); }
                      if (event.key === 'Escape') { setTemaEditando(false); }
                    }}
                    className="min-w-[12rem] rounded-full border border-tkd-blue bg-white px-4 py-1.5 text-sm font-bold text-tkd-dark focus:outline-none focus:ring-2 focus:ring-tkd-blue/30"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={abrirEdicionTema}
                    aria-label="Tema de la clase"
                    className="rounded-full border border-gray-200 bg-white px-4 py-1.5 text-sm font-bold text-tkd-dark transition hover:border-tkd-blue dark:bg-gray-900 dark:text-white"
                  >
                    {temaDiaActivo?.trim() ? temaDiaActivo : 'Agregar tema'}
                  </button>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => abrirWizardCrear()}
              className="w-full rounded-2xl border border-dashed border-tkd-blue px-5 py-3 text-[11px] font-black uppercase tracking-widest text-tkd-blue transition hover:bg-blue-50 dark:hover:bg-white/5"
            >
              + Agregar material
            </button>

            <div className="mt-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Materiales asignados</p>
              {asignacionesClaseActiva.length === 0 ? (
                <p className="mt-3 rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm font-bold text-gray-400 dark:border-white/10">
                  Aún no hay material asignado a esta clase.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {asignacionesClaseActiva.map((asignacion) => {
                    const expandido = filaExpandidaId === asignacion.id;
                    const gradosAsignacion = asignacion.destinatario.grados ?? [];
                    const mimeTypeAsignacion = recursosDisponibles.find((item) => item.id === asignacion.recursoId)?.mimeType ?? 'application/pdf';
                    return (
                      <li key={asignacion.id} className="rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-gray-900">
                        <div className="flex items-center gap-3 p-3">
                          <button
                            type="button"
                            onClick={() => setFilaExpandidaId(expandido ? '' : asignacion.id)}
                            aria-expanded={expandido}
                            className="flex min-w-0 flex-1 items-center gap-3 text-left"
                          >
                            <span className={claseIconoDocumentoCentroEstudios}>
                              <IconoRecursoAsignacion mimeType={mimeTypeAsignacion} className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-bold text-tkd-dark dark:text-white">{asignacion.titulo}</span>
                              <span className="mt-1 flex flex-wrap items-center gap-1">
                                {gradosAsignacion.length === 0 ? (
                                  <span className="text-[10px] font-bold text-gray-400">Sin grados</span>
                                ) : gradosAsignacion.map((grado) => {
                                  const estilo = PALETA_FAMILIAS_GRADO[familiaDeGrado(grado as GradoTKD)] ?? PALETA_FAMILIAS_GRADO.Blanco;
                                  return <span key={grado} title={grado} className={`h-2.5 w-2.5 rounded-full ${estilo.punto}`} />;
                                })}
                              </span>
                            </span>
                          </button>
                          <div className="flex shrink-0 gap-2">
                            <button
                              type="button"
                              onClick={() => abrirWizardEditar(asignacion)}
                              className={claseBotonIconoDocumentoCentroEstudios}
                              aria-label={`Editar ${asignacion.titulo}`}
                              title="Editar"
                            >
                              <IconoEditar className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setAsignacionEliminando(asignacion)}
                              className={claseBotonIconoDocumentoCentroEstudios}
                              aria-label={`Eliminar ${asignacion.titulo}`}
                              title="Eliminar"
                            >
                              <IconoEliminar className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        {expandido && (
                          <dl className="grid gap-2 border-t border-gray-100 p-3 text-xs font-bold text-gray-500 dark:border-white/10 sm:grid-cols-2">
                            <div><dt className="text-[9px] font-black uppercase tracking-widest text-gray-400">Momento</dt><dd>{asignacion.momento}</dd></div>
                            <div><dt className="text-[9px] font-black uppercase tracking-widest text-gray-400">Criterio</dt><dd>{asignacion.criterioPublicacion ?? asignacion.uso}</dd></div>
                            <div><dt className="text-[9px] font-black uppercase tracking-widest text-gray-400">Destinatario</dt><dd>{etiquetaDestinatario(asignacion.destinatario)}</dd></div>
                            <div><dt className="text-[9px] font-black uppercase tracking-widest text-gray-400">Fechas</dt><dd>{asignacion.fechaApertura.slice(0, 10)} → {asignacion.fechaCierre?.slice(0, 10) ?? 'Sin cierre'}</dd></div>
                            {gradosAsignacion.length > 0 && (
                              <div className="sm:col-span-2"><dt className="text-[9px] font-black uppercase tracking-widest text-gray-400">Grados</dt><dd>{gradosAsignacion.join(', ')}</dd></div>
                            )}
                          </dl>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          <section className="border-t border-gray-100 p-5 dark:border-white/10">
            <MisClasesView
              tenantId={tenantId}
              programaId={programaSeleccionado.id}
              usuarioId={usuarioId}
              esAdmin={usuario?.rol === RolUsuario.Admin || usuario?.rol === RolUsuario.SuperAdmin}
              rol={usuario?.rol}
              permisoEdicionAgenda={usuario?.permisoEdicionAgenda}
              repository={repositoryJornada}
              refreshTrigger={refrescoMisClases}
              onEditarMaterial={handleEditarMaterialDesdeClase}
            />
          </section>
        </article>

        {modalProgramaAbierto && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 py-12 sm:py-16" role="dialog" aria-modal="true" aria-labelledby="modal-programa">
            <div className="relative max-h-[calc(100dvh-8rem)] w-full max-w-2xl overflow-y-auto rounded-[2rem] bg-white p-6 shadow-2xl dark:bg-gray-900">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-tkd-red">Programa académico</p>
              <h3 id="modal-programa" className="mt-2 text-2xl font-black uppercase text-tkd-dark dark:text-white">
                {programas.some((programa) => programa.id === programaEditando.id) ? 'Editar programa' : 'Crear programa'}
              </h3>
              <button
                type="button"
                onClick={solicitarCerrarModalPrograma}
                className="absolute right-8 top-16 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-gray-200 bg-white text-xl font-black text-gray-400 transition hover:border-tkd-red hover:text-tkd-red dark:bg-gray-900"
                aria-label="Cerrar formulario de programa"
                title="Cerrar"
              >
                ×
              </button>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400 md:col-span-2">
                  Nombre del programa
                  <input value={programaEditando.nombre} onChange={(event) => setProgramaEditando((actual) => ({ ...actual, nombre: event.target.value }))} className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-normal normal-case tracking-normal text-tkd-dark" />
                </label>
                <label className="grid gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
                  Fecha inicio
                  <input type="date" value={programaEditando.fechaInicio} onChange={(event) => setProgramaEditando((actual) => ({ ...actual, fechaInicio: event.target.value }))} className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-normal normal-case tracking-normal text-tkd-dark" />
                </label>
                <label className="grid gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
                  Fecha fin
                  <input type="date" value={programaEditando.fechaFin} onChange={(event) => setProgramaEditando((actual) => ({ ...actual, fechaFin: event.target.value }))} className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-normal normal-case tracking-normal text-tkd-dark" />
                </label>
                <label className="grid gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
                  Instructor
                  {puedeElegirInstructor ? (
                    <select
                      value={programaEditando.instructorId}
                      onChange={(event) => {
                        const idSeleccionado = event.target.value;
                        const nombreSeleccionado = instructoresProgramaVisibles.find((opcion) => opcion.id === idSeleccionado)?.nombre ?? idSeleccionado;
                        setProgramaEditando((actual) => ({ ...actual, instructorId: idSeleccionado, instructor: nombreSeleccionado }));
                      }}
                      className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-normal normal-case tracking-normal text-tkd-dark"
                    >
                      {instructoresProgramaVisibles.map((instructor) => (
                        <option key={instructor.id} value={instructor.id}>{instructor.nombre}</option>
                      ))}
                    </select>
                  ) : (
                    // Editor ("Maestro"): solo puede autoasignarse. Se ignora
                    // a proposito cualquier instructor/instructorId que ya
                    // tuviera el programa (ver guardarPrograma) para que la
                    // UI nunca insinue que puede quedar asignado otro.
                    <input
                      value={nombreInstructorActual}
                      disabled
                      readOnly
                      title="Solo un Admin puede asignar un instructor distinto de vos"
                      className="cursor-not-allowed rounded-2xl border border-gray-200 bg-gray-100 px-4 py-3 text-sm font-normal normal-case tracking-normal text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                    />
                  )}
                </label>
                <label className="grid gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
                  Sede
                  <select
                    value={programaEditando.sede}
                    onChange={(event) => setProgramaEditando((actual) => ({ ...actual, sede: event.target.value }))}
                    className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-normal normal-case tracking-normal text-tkd-dark"
                  >
                    {sedesProgramaVisibles.map((sede) => (
                      <option key={sede.id} value={sede.nombre}>{sede.nombre}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
                  Grupo objetivo
                  <select value={programaEditando.grupoObjetivo} onChange={(event) => setProgramaEditando((actual) => ({ ...actual, grupoObjetivo: event.target.value }))} className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-normal normal-case tracking-normal text-tkd-dark">
                    {gruposObjetivo.map((opcion) => <option key={opcion} value={opcion}>{opcion}</option>)}
                  </select>
                </label>
                {/* ─── COHORTE OPERATIVA + VINCULACIÓN DE AGENDA ─── */}
                <div className="rounded-2xl border-2 border-tkd-blue/30 bg-blue-50/60 dark:bg-blue-900/10 p-4 md:col-span-2 space-y-4">
                  {/* Resumen cohorte */}
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-tkd-blue">Cohorte operativa</p>
                    <p className="mt-1 text-sm font-black text-tkd-dark dark:text-white">
                      {programaEditando.grupoObjetivo || 'Grupo'}
                      <span className="mx-1 text-gray-400">·</span>
                      {programaEditando.sede || 'Sede'}
                      <span className="mx-1 text-gray-400">·</span>
                      {programaEditando.instructor || 'Instructor'}
                    </p>
                  </div>

                  {/* Días y horarios */}
                  <div>
                    <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-500">Días de clase (horario recurrente)</p>
                    <div className="flex flex-wrap gap-2">
                      {DIAS_SEMANA_OPCIONES.map((dia) => {
                        const seleccionado = (programaEditando.diasHorario ?? []).some((d) => d.dia === dia);
                        return (
                          <button
                            key={dia}
                            type="button"
                            onClick={() => toggleDiaHorario(dia)}
                            className={`rounded-xl px-3 py-1.5 text-[10px] font-black uppercase tracking-wide transition ${
                              seleccionado
                                ? 'bg-tkd-blue text-white shadow-md'
                                : 'border border-gray-300 bg-white text-gray-500 hover:border-tkd-blue hover:text-tkd-blue dark:bg-gray-800'
                            }`}
                          >
                            {dia.slice(0, 3)}
                          </button>
                        );
                      })}
                    </div>

                    {/* Horas por día seleccionado */}
                    {(programaEditando.diasHorario ?? []).length > 0 && (
                      <div className="mt-3 space-y-2">
                        {(programaEditando.diasHorario ?? []).map((bloque) => (
                          <div key={bloque.dia} className="flex items-center gap-3">
                            <span className="w-24 text-[10px] font-black uppercase text-gray-500">{bloque.dia}</span>
                            <input
                              type="time"
                              value={bloque.horaInicio}
                              onChange={(e) => actualizarHoraDia(bloque.dia, 'horaInicio', e.target.value)}
                              className="rounded-xl border border-gray-200 px-2 py-1 text-xs"
                            />
                            <span className="text-gray-400">→</span>
                            <input
                              type="time"
                              value={bloque.horaFin}
                              onChange={(e) => actualizarHoraDia(bloque.dia, 'horaFin', e.target.value)}
                              className="rounded-xl border border-gray-200 px-2 py-1 text-xs"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Vista previa de jornadas */}
                  {jornadasPreview.length > 0 && (
                    <div>
                      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-500">Vista previa de jornadas (primeras 5)</p>
                      <ul className="space-y-1">
                        {jornadasPreview.map((j, i) => (
                          <li key={i} className="flex items-center gap-3 rounded-xl bg-white dark:bg-gray-800 px-3 py-2 text-xs font-bold text-tkd-dark dark:text-white shadow-sm">
                            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-tkd-blue text-[9px] font-black text-white">{i + 1}</span>
                            <span>{j.dia}</span>
                            <span className="text-gray-400">·</span>
                            <span>{new Date(j.fecha + 'T12:00:00Z').toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                            <span className="text-gray-400">·</span>
                            <span>{j.horaInicio} – {j.horaFin}</span>
                          </li>
                        ))}
                      </ul>
                      {programaEditando.fechaInicio && programaEditando.fechaFin && (
                        <p className="mt-2 text-[10px] font-bold text-gray-400">
                          Al confirmar se generará el calendario completo de jornadas entre {programaEditando.fechaInicio} y {programaEditando.fechaFin}.
                        </p>
                      )}
                    </div>
                  )}

                  {(programaEditando.diasHorario ?? []).length === 0 && (
                    <p className="text-xs font-bold text-gray-400">
                      Seleccioná al menos un día para vincular el programa a la agenda y generar jornadas.
                    </p>
                  )}
                </div>
                <label className="grid gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400 md:col-span-2">
                  Tema
                  <input value={programaEditando.tema} onChange={(event) => setProgramaEditando((actual) => ({ ...actual, tema: event.target.value }))} className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-normal normal-case tracking-normal text-tkd-dark" />
                </label>
                <label className="grid gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400 md:col-span-2">
                  Objetivo clase
                  <textarea value={programaEditando.objetivoClase} onChange={(event) => setProgramaEditando((actual) => ({ ...actual, objetivoClase: event.target.value }))} className="min-h-[84px] rounded-2xl border border-gray-200 px-4 py-3 text-sm font-normal normal-case tracking-normal text-tkd-dark" />
                </label>
                <label className="grid gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400 md:col-span-2">
                  Tags
                  <input value={programaEditando.tags.join(', ')} onChange={(event) => setProgramaEditando((actual) => ({ ...actual, tags: parsearTagsAsignacion(event.target.value) }))} placeholder="infantil, iniciación, patada frontal" className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-normal normal-case tracking-normal text-tkd-dark" />
                </label>
                <div className="md:col-span-2">
                  <p className="mb-2 text-xs font-normal text-gray-400">
                    Estos tags definen que materiales hacen match con el programa.
                  </p>
                  {renderTagSelector(programaEditando.tags, (tag) => {
                    setProgramaEditando((actual) => ({
                      ...actual,
                      tags: alternarTagNormalizado(actual.tags, tag),
                    }));
                  })}
                </div>
                <label className="grid gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400 md:col-span-2">
                  Observaciones
                  <textarea value={programaEditando.observaciones} onChange={(event) => setProgramaEditando((actual) => ({ ...actual, observaciones: event.target.value }))} className="min-h-[84px] rounded-2xl border border-gray-200 px-4 py-3 text-sm font-normal normal-case tracking-normal text-tkd-dark" />
                </label>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => setConfirmacionProgramaAbierta(true)}
                  disabled={!programaFormularioValido}
                  className="rounded-2xl bg-tkd-blue px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
                >
                  Aceptar
                </button>
              </div>
            </div>
          </div>
        )}

        <ModalConfirmacion
          abierto={confirmacionProgramaAbierta}
          titulo="Confirmar programa"
          mensaje={((): string => {
            const count = contarJornadasARealizar(programaEditando.fechaInicio, programaEditando.fechaFin, programaEditando.diasHorario ?? []);
            const avisoClases = programaEditando.diasHorario?.length && programaEditando.fechaFin
              ? `Esto generará y guardará de inmediato las ${count} clases reales de su horario para todo el período.`
              : 'Todavía no tiene días de horario y fecha fin definidos, así que no se generarán clases hasta que los completes.';
            const avisoAdvertencia = count > 150 
              ? `\n\n⚠️ ¡ADVERTENCIA! Vas a generar un volumen alto (${count} clases) en un solo paso. Confirmá solo si estás seguro de que el rango de fechas es el correcto.`
              : '';
            return `Confirma que deseas ${programas.some((programa) => programa.id === programaEditando.id) ? 'actualizar' : 'crear'} la base del programa "${programaEditando.nombre.trim() || 'Programa sin nombre'}". ${avisoClases}${avisoAdvertencia}`;
          })()}
          onCerrar={() => !guardandoPrograma && setConfirmacionProgramaAbierta(false)}
          onConfirmar={() => {
            if (guardandoPrograma) return;
            setConfirmacionProgramaAbierta(false);
            guardarPrograma();
          }}
          cargando={guardandoPrograma}
          textoBotonConfirmar="Confirmar"
        />

        <ModalConfirmacion
          abierto={confirmacionCierreProgramaAbierta}
          titulo="Descartar cambios"
          mensaje="Tienes cambios sin guardar en el programa academico. Si cierras ahora, se perderan los ajustes no guardados."
          onCerrar={() => setConfirmacionCierreProgramaAbierta(false)}
          onConfirmar={cerrarModalPrograma}
          cargando={false}
          textoBotonConfirmar="Descartar"
        />

        <ModalConfirmacion
          abierto={confirmacionEliminarProgramaAbierta}
          titulo="Eliminar programa"
          mensaje={`Se eliminará el programa "${programaSeleccionado?.nombre ?? ''}" y sus clases que aún no se dictaron. Las clases ya cerradas u operadas se conservan como historial. Esta acción no se puede deshacer.`}
          onCerrar={() => !eliminandoPrograma && setConfirmacionEliminarProgramaAbierta(false)}
          onConfirmar={eliminarProgramaSeleccionado}
          cargando={eliminandoPrograma}
          textoBotonConfirmar="Eliminar"
        />

        {wizardAbierto && (
          <AsignarMaterialWizard
            modo={wizardModo}
            materialesDisponibles={materialesDisponiblesWizard}
            tagsPrograma={tagsProgramaActivo}
            gruposObjetivo={gruposObjetivo}
            draftInicial={draftInicialWizard}
            onCancelar={cerrarWizard}
            onConfirmar={confirmarWizard}
          />
        )}

        <ModalConfirmacion
          abierto={Boolean(asignacionEliminando)}
          titulo="Eliminar asignación"
          mensaje={`Se eliminará "${asignacionEliminando?.titulo ?? ''}" de esta clase. Esta acción no se puede deshacer.`}
          onCerrar={() => setAsignacionEliminando(null)}
          onConfirmar={confirmarEliminarAsignacion}
          cargando={eliminandoAsignacion}
          textoBotonConfirmar="Eliminar"
        />

        </div>

        {error && (
          <article className="rounded-[2rem] border border-red-100 bg-red-50 p-6 text-sm font-bold text-red-700 xl:col-span-3">
            {error}
          </article>
        )}
      </div>
    );
  };

  return (
    <section className={embedded ? 'space-y-6' : 'p-6 sm:p-10 space-y-8'}>
      {!embedded && (
        <header>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-tkd-red">
            Paso 3
          </p>
          <h1 className="text-3xl font-black uppercase text-tkd-dark dark:text-white">
            Asignar recurso academico
          </h1>
          <p className="mt-2 text-sm font-bold text-gray-400">
            Publica el recurso para una clase, grupo o estudiante con criterio, fechas y trazabilidad.
          </p>
        </header>
      )}

      <article className="rounded-[2rem] border border-gray-100 dark:border-white/10 bg-white dark:bg-gray-900 p-6 grid gap-4">
        {embedded && (
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-tkd-red">
              Paso 3B · Envío
            </p>
            <h2 className="mt-2 text-2xl font-black uppercase text-tkd-dark dark:text-white">
              Publicar material
            </h2>
            <p className="mt-2 text-sm font-bold text-gray-400">
              El recurso aprobado se publica contra la clase seleccionada y conserva trazabilidad por jornada.
            </p>
          </div>
        )}
        <div className="grid gap-3 rounded-[1.5rem] border border-blue-100 bg-blue-50/50 p-5 dark:border-blue-400/20 dark:bg-blue-400/5 text-sm font-bold text-gray-600 dark:text-gray-300">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-tkd-blue/10 text-tkd-blue">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </span>
            <p className="flex-1 truncate">
              Clase activa: <span className="block text-xs font-black text-tkd-dark dark:text-white mt-0.5">{jornadaEfectivaId || 'Pendiente de seleccionar'}</span>
            </p>
          </div>
          <div className="flex items-center gap-3 border-t border-blue-100/50 pt-3 dark:border-blue-400/10">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-tkd-blue/10 text-tkd-blue">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </span>
            <p className="flex-1">
              Materiales aprobados: <span className="block text-xs font-black text-tkd-dark dark:text-white mt-0.5">{recursosDisponibles.length} disponibles</span>
            </p>
          </div>
          {razonBloqueoPublicacion && (
            <p className="text-xs font-black uppercase text-tkd-red mt-1 border-t border-red-100/50 pt-2">{razonBloqueoPublicacion}</p>
          )}
        </div>

        <label htmlFor="asignacion-recurso" className="text-[10px] font-black uppercase tracking-widest text-gray-400">
          Recurso aprobado
        </label>
        <select
          id="asignacion-recurso"
          value={recursoId}
          onChange={(event) => setRecursoId(event.target.value)}
          className="rounded-2xl border border-gray-200 bg-gray-50/50 dark:bg-gray-950/40 dark:border-white/10 px-4 py-3 text-sm font-bold text-tkd-dark dark:text-white focus:border-tkd-blue focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-400/20 focus:outline-none transition duration-200"
        >
          {recursosDisponibles.map((item) => (
            <option key={item.id} value={item.id}>{item.nombre}</option>
          ))}
        </select>

        <label htmlFor="asignacion-titulo" className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-2">
          Título visible para el alumno
        </label>
        <input
          id="asignacion-titulo"
          value={tituloPersonalizado}
          onChange={(event) => setTituloPersonalizado(event.target.value)}
          placeholder="Ej: Material de estudio"
          className="rounded-2xl border border-gray-200 bg-gray-50/50 dark:bg-gray-950/40 dark:border-white/10 px-4 py-3 text-sm font-normal text-tkd-dark dark:text-white focus:border-tkd-blue focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-400/20 focus:outline-none transition duration-200"
        />

        <label htmlFor="asignacion-tags" className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-2">
          Tags para reutilizacion
        </label>
        <textarea
          id="asignacion-tags"
          value={tagsAsignacion}
          onChange={(event) => setTagsAsignacion(event.target.value)}
          placeholder="infantil, precadetes, fundamentos, evaluacion"
          className="min-h-[80px] rounded-2xl border border-gray-200 bg-gray-50/50 dark:bg-gray-950/40 dark:border-white/10 px-4 py-3 text-sm font-normal text-tkd-dark dark:text-white focus:border-tkd-blue focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-400/20 focus:outline-none transition duration-200"
        />
        {renderTagSelector(parsearTagsAsignacion(tagsAsignacion), (tag) => {
          setTagsAsignacion(alternarTagNormalizado(parsearTagsAsignacion(tagsAsignacion), tag).join(', '));
        })}

        <div className="space-y-1 mt-2">
          <label htmlFor="asignacion-destinatario" className="text-[10px] font-black uppercase tracking-widest text-gray-400">
            Destinatario
          </label>
          <p className="text-[11px] font-bold text-gray-400">
            Elige el alcance: grupo completo, grado específico o estudiantes puntuales.
          </p>
        </div>
        <select
          id="asignacion-destinatario"
          value={tipoDestinatario}
          onChange={(event) => setTipoDestinatario(event.target.value as DestinatarioAsignacion['tipo'])}
          className="rounded-2xl border border-gray-200 bg-gray-50/50 dark:bg-gray-950/40 dark:border-white/10 px-4 py-3 text-sm font-bold text-tkd-dark dark:text-white focus:border-tkd-blue focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-400/20 focus:outline-none transition duration-200"
        >
          <option value="grupo">Grupo</option>
          <option value="grado">Grado</option>
          <option value="estudiante">Estudiante</option>
        </select>

        <div className="space-y-1 mt-2">
          <label htmlFor="asignacion-grupo" className="text-[10px] font-black uppercase tracking-widest text-gray-400">
            {tipoDestinatario === 'estudiante' ? 'Estudiantes objetivo' : 'Grupo objetivo'}
          </label>
          <p className="text-[11px] font-bold text-gray-400">
            {tipoDestinatario === 'estudiante'
              ? 'Escribe los IDs de estudiantes separados por coma. Ejemplo: estudiante-1, estudiante-2.'
              : 'Debe coincidir con un grupo de la escuela. Ej: Infantil, Precadetes, Cadetes, Adultos o Todos.'}
          </p>
        </div>
        <input
          id="asignacion-grupo"
          value={grupo}
          onChange={(event) => setGrupo(event.target.value)}
          placeholder={tipoDestinatario === 'estudiante' ? 'Ej: estudiante-1, estudiante-2' : 'Ej: Infantil, Precadetes, Cadetes, Adultos o Todos'}
          list={tipoDestinatario === 'estudiante' ? undefined : 'asignacion-grupos-sugeridos'}
          className="rounded-2xl border border-gray-200 bg-gray-50/50 dark:bg-gray-950/40 dark:border-white/10 px-4 py-3 text-sm font-bold text-tkd-dark dark:text-white focus:border-tkd-blue focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-400/20 focus:outline-none transition duration-200"
        />
        {tipoDestinatario !== 'estudiante' && (
          <datalist id="asignacion-grupos-sugeridos">
            <option value="Infantil" />
            <option value="Precadetes" />
            <option value="Cadetes" />
            <option value="Adultos" />
            <option value="Todos" />
          </datalist>
        )}

        {tipoDestinatario === 'grado' && (
          <>
            <label htmlFor="asignacion-grados" className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-2">
              Grados objetivo
            </label>
            <input
              id="asignacion-grados"
              value={grados}
              onChange={(event) => setGrados(event.target.value)}
              placeholder="Blanco, Amarillo"
              className="rounded-2xl border border-gray-200 bg-gray-50/50 dark:bg-gray-950/40 dark:border-white/10 px-4 py-3 text-sm font-bold text-tkd-dark dark:text-white focus:border-tkd-blue focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-400/20 focus:outline-none transition duration-200"
            />
          </>
        )}

        <div className="grid gap-4 sm:grid-cols-2 mt-2">
          <div className="grid gap-2">
            <label htmlFor="asignacion-apertura" className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              Fecha de apertura
            </label>
            <input
              id="asignacion-apertura"
              type="date"
              value={fechaApertura}
              onChange={(event) => setFechaApertura(event.target.value)}
              className="rounded-2xl border border-gray-200 bg-gray-50/50 dark:bg-gray-950/40 dark:border-white/10 px-4 py-3 text-sm font-bold text-tkd-dark dark:text-white focus:border-tkd-blue focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-400/20 focus:outline-none transition duration-200"
            />
          </div>

          <div className="grid gap-2">
            <label htmlFor="asignacion-cierre" className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              Fecha de cierre
            </label>
            <input
              id="asignacion-cierre"
              type="date"
              value={fechaCierre}
              onChange={(event) => setFechaCierre(event.target.value)}
              className="rounded-2xl border border-gray-200 bg-gray-50/50 dark:bg-gray-950/40 dark:border-white/10 px-4 py-3 text-sm font-bold text-tkd-dark dark:text-white focus:border-tkd-blue focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-400/20 focus:outline-none transition duration-200"
            />
          </div>
        </div>

        <label htmlFor="asignacion-criterio" className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-2">
          Criterio de asignacion
        </label>
        <select
          id="asignacion-criterio"
          value={criterio}
          onChange={(event) => setCriterio(event.target.value as typeof criterio)}
          className="rounded-2xl border border-gray-200 bg-gray-50/50 dark:bg-gray-950/40 dark:border-white/10 px-4 py-3 text-sm font-bold text-tkd-dark dark:text-white focus:border-tkd-blue focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-400/20 focus:outline-none transition duration-200"
        >
          <option value="estudio">Estudio</option>
          <option value="repaso">Repaso</option>
          <option value="refuerzo">Refuerzo</option>
          <option value="evaluacion">Evaluacion</option>
          <option value="quiz">Quiz</option>
        </select>

        <div className="space-y-1 mt-2">
          <label htmlFor="asignacion-momento" className="text-[10px] font-black uppercase tracking-widest text-gray-400">
            Momento de uso del recurso
          </label>
          <p className="text-[11px] font-bold text-gray-400">
            Solo ordena la intención del material dentro de la clase.
          </p>
        </div>
        <select
          id="asignacion-momento"
          value={momento}
          onChange={(event) => setMomento(event.target.value as MomentoAsignacion)}
          className="rounded-2xl border border-gray-200 bg-gray-50/50 dark:bg-gray-950/40 dark:border-white/10 px-4 py-3 text-sm font-bold text-tkd-dark dark:text-white focus:border-tkd-blue focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-400/20 focus:outline-none transition duration-200"
        >
          <option value="preparacion">Antes de la clase</option>
          <option value="durante">Durante la jornada</option>
          <option value="refuerzo_posterior">Despues de la clase</option>
        </select>

        <button
          type="button"
          onClick={publicar}
          disabled={publicando || recursosDisponibles.length === 0 || !tieneJornadaSeleccionada}
          className="w-full mt-4 rounded-2xl bg-gradient-to-r from-tkd-red to-red-600 hover:from-red-600 hover:to-red-700 text-white font-black uppercase tracking-widest text-[10px] py-4 shadow-md hover:shadow-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
        >
          {publicando ? 'Publicando...' : 'Publicar material'}
        </button>
      </article>

      {error && (
        <article className="rounded-[2rem] border border-red-100 bg-red-50 p-6 text-sm font-bold text-red-700">
          {error}
        </article>
      )}

      {publicada && (
        <article className="rounded-[2rem] border border-green-100 bg-green-50 p-6 space-y-2 text-green-800">
          <p className="text-[10px] font-black uppercase tracking-widest">Asignacion publicada</p>
          <h2 className="text-2xl font-black uppercase">{publicada.titulo}</h2>
          {resultadoPublicacion?.id && (
            <p className="text-xs font-black uppercase">ID: {resultadoPublicacion.id}</p>
          )}
          <p className="text-sm font-bold">{etiquetaDestinatario(publicada.destinatario)}</p>
          {publicada.destinatario.grados?.length ? (
            <p className="text-sm font-bold">{publicada.destinatario.grados.join(', ')}</p>
          ) : null}
          <p className="text-xs font-black uppercase">Momento: {publicada.momento}</p>
        </article>
      )}
    </section>
  );
};

export default AsignacionesView;
