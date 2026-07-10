import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  type Firestore,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../firebase/config';
import type { JornadaInstruccion } from '../../models/academico/jornada';
import type { EjecucionPrograma } from '../../models/academico/programa';
import type { EstadoJornada } from '../../models/academico';
import type { RolUsuario } from '../../tipos';

interface FirestoreBatchLike {
  set: (ref: unknown, data: unknown) => unknown;
  delete: (ref: unknown) => unknown;
  commit: () => Promise<void>;
}

interface JornadaRepositoryDeps {
  collection?: (...path: any[]) => unknown;
  doc: (...path: any[]) => unknown;
  getDoc?: (ref: unknown) => Promise<{ exists: () => boolean; data?: () => unknown }>;
  getDocs?: (queryRef: unknown) => Promise<{ docs: Array<{ id: string; data: () => unknown }> }>;
  query?: (...args: unknown[]) => unknown;
  setDoc: (ref: unknown, data: unknown, options?: unknown) => Promise<void>;
  where?: (...args: unknown[]) => unknown;
  writeBatch?: (db: Firestore) => FirestoreBatchLike;
}

// Subtarea 12.5: auditoria completa por cambio (seccion 19 del documento de mejora del
// modulo Agenda). El diagnostico (12.1) encontro 4 gaps sobre la auditoria ya wireada:
// (1) no guardaba el rol de quien hizo el cambio, solo el usuarioId; (2) `cambios` era el
// estado resultante, sin el valor anterior por campo; (3) no guardaba desde que vista se
// origino el cambio; (4) un fallo al registrar auditoria se silenciaba con console.warn.
// Este archivo resuelve (1)-(3) en el shape de abajo; (4) se resuelve en cada vista (ver
// MENSAJE_ADVERTENCIA_AUDITORIA mas abajo): el guardado principal ya se aplico y no se
// revierte (no hay transaccion/rollback), pero el fallo de auditoria deja de ser silencioso.
export interface CambioAuditoriaJornada {
  campo: string;
  anterior: unknown;
  nuevo: unknown;
}

// Vistas reales del codebase vigente que hoy escriben auditoria de jornada: JornadasView
// (flujo standalone de plan/cierre), MisClasesView (gestion de clases del maestro, embebida
// en AsignacionesView) y AsignacionesView (publicacion de material -- solo referencia una
// jornada ya existente, sin mutar sus campos). No se incluye 'agenda': esa vista no existe
// en este codebase todavia (ver subtarea 12.8 del documento de mejora).
export type FuenteAuditoriaJornada = 'jornadas' | 'mis_clases' | 'asignaciones';

export interface AuditoriaJornadaInput {
  tenantId: string;
  jornadaId: string;
  usuarioId: string;
  // Subtarea 12.5: rol de quien hizo el cambio (requisito de negocio, seccion 19).
  rol: RolUsuario;
  // Subtarea 12.5: vista de origen del cambio (requisito de negocio, seccion 19).
  fuente: FuenteAuditoriaJornada;
  accion: 'crear' | 'confirmar' | 'iniciar' | 'cerrar' | 'cancelar' | 'actualizar';
  // Subtarea 12.5: diff por campo (valor anterior y nuevo). Antes era el estado resultante
  // plano (p.ej. `{ estado: 'confirmada' }`), sin el valor anterior -- ver diffCambiosJornada.
  cambios: CambioAuditoriaJornada[];
}

// Subtarea 12.5: campos "de negocio" de JornadaInstruccion que tiene sentido auditar.
// Se excluyen id/tenantId (identifican el documento, no son "cambios") y creadoEn/
// actualizadoEn (bookkeeping: actualizadoEn cambia en CADA guardado, y meterlo en el diff
// ensuciaria cada entrada con ruido de timestamp en vez de señal util).
const CAMPOS_AUDITABLES_JORNADA: Array<keyof JornadaInstruccion> = [
  'programaId',
  'ejecucionProgramaId',
  'grupoId',
  'sedeId',
  'espacioId',
  'instructorId',
  'bloqueRecurrenteId',
  'fecha',
  'horaInicio',
  'horaFin',
  'estado',
  'objetivosPlaneados',
  'objetivosImpartidos',
  'asistenciaRegistrada',
  'motivoCancelacion',
  'tema',
];

function valoresDistintos(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    return JSON.stringify(a ?? null) !== JSON.stringify(b ?? null);
  }
  return a !== b;
}

// Subtarea 12.5: compara una jornada antes/despues de una operacion y devuelve solo los
// campos que efectivamente cambiaron, con su valor anterior y nuevo -- para que la
// auditoria tenga el detalle que pide el documento de mejora (seccion 19), sin que cada
// vista tenga que armar el diff a mano campo por campo.
export function diffCambiosJornada(
  anterior: JornadaInstruccion,
  nueva: JornadaInstruccion,
): CambioAuditoriaJornada[] {
  const cambios: CambioAuditoriaJornada[] = [];
  for (const campo of CAMPOS_AUDITABLES_JORNADA) {
    const valorAnterior = anterior[campo];
    const valorNuevo = nueva[campo];
    if (valoresDistintos(valorAnterior, valorNuevo)) {
      cambios.push({ campo, anterior: valorAnterior, nuevo: valorNuevo });
    }
  }
  return cambios;
}

// Subtarea 12.5: antes, si registrarAuditoria fallaba, las vistas solo hacian
// console.warn -- el fallo quedaba invisible para el usuario y sin ninguna constancia mas
// alla de la consola del navegador. Decision: NO revertir el guardado principal (ya se
// escribio en Firestore; revertirlo requeriria una transaccion que no existe hoy y
// agregarla ahora es mas riesgo operativo del que vale para este alcance), pero SI mostrar
// este mensaje en la UI para que quede constancia real de que la auditoria no se pudo
// registrar, en vez de un log silencioso que se pierde.
export const MENSAJE_ADVERTENCIA_AUDITORIA =
  'La clase se guardó, pero no se pudo registrar la auditoría del cambio. Si el problema persiste, avisá a soporte.';

// Subtarea 12.3: motivo del choque para que la UI pueda mostrar un mensaje especifico
// ("el maestro ya tiene clase" vs. "la sede no esta disponible") en vez de un generico
// "conflicto de horario". Si coincide instructor Y espacio a la vez (el caso mas comun,
// mismo maestro repitiendo sede/espacio), se prioriza 'instructor' por ser el motivo mas
// accionable para quien esta agendando.
export type MotivoConflictoHorario = 'instructor' | 'espacio';

export interface ResultadoConflictoHorario {
  hayConflicto: boolean;
  motivo?: MotivoConflictoHorario;
}

// Subtarea 12.4: bloqueo optimista al guardar una jornada. Cuando otro usuario grabo la
// misma jornada entre que esta vista la leyo y la vuelve a escribir, no debemos pisar su
// cambio en silencio (seccion 17 del documento de mejora del modulo Agenda). El texto es
// el sugerido por ese documento; la UI lo muestra tal cual via `err.message`.
export const MENSAJE_CONFLICTO_CONCURRENCIA =
  'La clase fue modificada por otro usuario. Actualiza la información antes de guardar.';

export class ConflictoConcurrenciaError extends Error {
  constructor(message: string = MENSAJE_CONFLICTO_CONCURRENCIA) {
    super(message);
    this.name = 'ConflictoConcurrenciaError';
  }
}

// Subtarea 12.6: guardas de eliminacion/desactivacion segura (seccion 8 del documento de
// mejora del modulo Agenda). Regla de negocio: por defecto eliminar una clase es una accion
// SOFT (cancelacion/desactivacion, ya cubierta por cancelarJornada en jornadaService.ts ->
// estado 'cancelada'). El borrado FISICO solo es aceptable para jornadas que nunca llegaron
// a operarse; si una clase ya se opero realmente, borrarla perderia trazabilidad historica
// (asistencia, cierre, Clase en Vivo). "Ya se opero" se determina por DOS señales:
//   1. `asistenciaRegistrada === true` (senal explicita del modelo).
//   2. El `estado` implica que la clase se dicto / esta cerrando / cerro / cerro parcial.
// El resto del ciclo de vida (borrador, pendiente_confirmacion, confirmada, cancelada,
// reprogramada, pendiente_sustitucion) corresponde a clases planificadas o descartadas SIN
// historia que preservar -> su borrado fisico es seguro. `pendiente_sustitucion` se trata
// como NO operada a proposito: es un estado PREVIO a dictar la clase (falta cubrir al
// maestro), no una clase ya dictada.
export type MotivoBloqueoEliminacion = 'asistencia_registrada' | 'clase_operada';

export interface ResultadoEliminacionSegura {
  permitido: boolean;
  motivo?: MotivoBloqueoEliminacion;
}

// Estados que implican que la clase YA se opero. Se derivan del ciclo de vida de EstadoJornada
// (ver models/academico/index.ts): en_curso = Clase en Vivo activa; pendiente_cierre = ya se
// dicto y falta cerrar; cerrada = dictada y cerrada; parcial = cierre parcial.
const ESTADOS_JORNADA_OPERADA: EstadoJornada[] = [
  'en_curso',
  'pendiente_cierre',
  'cerrada',
  'parcial',
];

// Mensaje de negocio por motivo de bloqueo. Lo consume la UI via `err.message`/`err.motivo`
// (mismo patron que ConflictoConcurrenciaError) para explicar por que no se puede borrar y
// sugerir la alternativa soft (cancelar / cierre administrativo).
export const MENSAJE_ELIMINACION_NO_PERMITIDA: Record<MotivoBloqueoEliminacion, string> = {
  asistencia_registrada:
    'No se puede eliminar esta clase porque ya tiene asistencia registrada. Para conservar el historial, cancelala en lugar de eliminarla.',
  clase_operada:
    'No se puede eliminar esta clase porque ya tuvo operación en Clase en Vivo. Solo se permite cancelarla o cerrarla administrativamente.',
};

// Subtarea 12.6: copy sugerido por el documento de mejora (seccion 8) para el modal de
// CONFIRMACION de eliminacion. NO se usa todavia: el modal/boton de "eliminar clase" vive en
// la subtarea 12.9 (modal de edicion singular de Agenda, aun no implementado). Se exporta y
// documenta aca para que 12.9 lo consuma sin re-inventar el texto.
export const MENSAJE_CONFIRMACION_ELIMINAR_CLASE =
  '¿Está seguro de eliminar esta clase? Esta acción afectará la programación visible en Agenda, Hub Estudiantes y Clase en Vivo. Los materiales asociados no serán eliminados, solo se quitará la relación con esta clase.';

export class EliminacionNoPermitidaError extends Error {
  readonly motivo: MotivoBloqueoEliminacion;
  constructor(motivo: MotivoBloqueoEliminacion, message: string = MENSAJE_ELIMINACION_NO_PERMITIDA[motivo]) {
    super(message);
    this.name = 'EliminacionNoPermitidaError';
    this.motivo = motivo;
  }
}

// Helper puro exportado: decide si una jornada puede borrarse FISICAMENTE. `asistencia_registrada`
// se prioriza sobre `clase_operada` cuando ambas condiciones aplican (es la señal mas concreta
// del modelo y la que el documento de mejora nombra primero). Fuente unica de verdad: tanto
// `eliminarJornadaSegura` como `esJornadaOperada` (abajo) se derivan de esta funcion, para no
// repetir las dos condiciones de "ya operada" en dos lugares distintos.
export function evaluarEliminacionSegura(jornada: JornadaInstruccion): ResultadoEliminacionSegura {
  if (jornada.asistenciaRegistrada === true) {
    return { permitido: false, motivo: 'asistencia_registrada' };
  }
  if (ESTADOS_JORNADA_OPERADA.includes(jornada.estado)) {
    return { permitido: false, motivo: 'clase_operada' };
  }
  return { permitido: true };
}

// Helper puro exportado: true si la jornada ya se opero realmente (no se puede borrar fisico).
// Version booleana de evaluarEliminacionSegura, para call sites que solo necesitan saber
// "se puede tocar fisico si/no" sin el detalle del motivo (p.ej. deshabilitar un boton en UI).
export function esJornadaOperada(jornada: JornadaInstruccion): boolean {
  return !evaluarEliminacionSegura(jornada).permitido;
}

export interface GuardarJornadaOpciones {
  // Valor de `actualizadoEn` que la vista tenia en memoria cuando cargo la jornada (antes
  // de mutarla). Si el documento en Firestore ya tiene otro `actualizadoEn` al momento de
  // escribir, otro usuario grabo primero y se rechaza con ConflictoConcurrenciaError en
  // vez de sobrescribir. Si se omite, `guardarJornada` se comporta como antes (sin lock),
  // para no afectar seeding/lote ni el resto de call sites que no necesitan el chequeo.
  actualizadoEnEsperado?: string;
}

export interface JornadaRepository {
  guardarJornada(jornada: JornadaInstruccion, opciones?: GuardarJornadaOpciones): Promise<void>;
  guardarEjecucion(ejecucion: EjecucionPrograma): Promise<void>;
  registrarAuditoria(input: AuditoriaJornadaInput): Promise<void>;
  existeConflictoHorario(jornada: JornadaInstruccion): Promise<ResultadoConflictoHorario>;
  listarJornadasPorTenant(tenantId: string): Promise<JornadaInstruccion[]>;
  // Subtarea 12.8: fuente de datos de la parrilla semanal de Agenda. A diferencia de
  // `listarJornadasPorTenant` (sin filtro de fecha, trae TODO el tenant),
  // `listarJornadasPorRangoFechas` filtra por tenant + rango [fechaInicio, fechaFin]
  // (ambos limites inclusive) para cumplir el requisito de rendimiento de la seccion 21
  // del documento de mejora del modulo Agenda ("Cargar solo la semana visible... usar
  // filtros por tenant, rango de fechas y estado").
  listarJornadasPorRangoFechas(tenantId: string, fechaInicio: string, fechaFin: string): Promise<JornadaInstruccion[]>;
  guardarJornadasEnLote(jornadas: JornadaInstruccion[]): Promise<void>;
  actualizarTemaJornada(tenantId: string, jornadaId: string, tema: string): Promise<void>;
  // ATENCION (subtarea 12.6): HARD DELETE SIN GUARDAS. Es una primitiva de limpieza masiva,
  // hoy usada SOLO para descartar jornadas sinteticas de preview al regenerar el horario de un
  // programa (AsignacionesView.tsx). NO reutilizar para "eliminar clase" desde Agenda: borraria
  // fisicamente clases ya operadas (con asistencia / Clase en Vivo) perdiendo trazabilidad. Para
  // ese flujo (12.9) usar `eliminarJornadaSegura`, que aplica la guarda antes de borrar.
  eliminarJornadasEnLote(tenantId: string, ids: string[]): Promise<void>;
  // Subtarea 12.6: borrado fisico GUARDADO de una unica jornada, pensado para el futuro flujo
  // de "eliminar clase" de Agenda (12.9). Aplica evaluarEliminacionSegura ANTES de borrar: si la
  // jornada ya se opero, lanza EliminacionNoPermitidaError y NO borra nada (el llamador debe
  // ofrecer cancelarJornada en su lugar). Es la unica via segura para borrar una clase real.
  eliminarJornadaSegura(jornada: JornadaInstruccion): Promise<void>;
  // Fix 3 (persistencia/seleccion de Programa academico): lectura puntual de una
  // EjecucionPrograma por id, usada por AsignacionesView para reconstruir
  // horario/sede/instructor/fechas de un programa real al hidratarlo, en vez de dejar
  // esos campos en blanco/default (ver ProgramaAcademico, que no los guarda). Opcional
  // para no romper los fakes de test existentes que construyen un JornadaRepository
  // parcial sin este metodo.
  obtenerEjecucion?(tenantId: string, ejecucionId: string): Promise<EjecucionPrograma | null>;
}

// Subtarea 12.3: helper puro compartido por las vistas (JornadasView, MisClasesView) para
// traducir el resultado de existeConflictoHorario a un mensaje especifico por motivo, en
// vez de repetir el mismo texto generico en cada call site.
export function mensajeConflictoHorario(resultado: ResultadoConflictoHorario, jornada: JornadaInstruccion): string {
  if (resultado.motivo === 'instructor') {
    return 'El maestro ya tiene una clase asignada en este horario.';
  }
  if (resultado.motivo === 'espacio') {
    return `La sede seleccionada no esta disponible entre ${jornada.horaInicio} y ${jornada.horaFin}.`;
  }
  return 'Ya existe una jornada confirmada en esa sede, espacio y horario.';
}

const TAMANO_MAXIMO_LOTE = 400;

function trocear<T>(items: T[], tamano: number): T[][] {
  const lotes: T[][] = [];
  for (let indice = 0; indice < items.length; indice += tamano) {
    lotes.push(items.slice(indice, indice + tamano));
  }
  return lotes;
}

export interface CrearJornadaRepositoryOptions {
  db?: Firestore;
  isFirebaseConfigured?: boolean;
  deps?: JornadaRepositoryDeps;
}

let mockJornadas: JornadaInstruccion[] = [];
let mockEjecuciones: EjecucionPrograma[] = [];
let mockAuditoria: Array<AuditoriaJornadaInput & { id: string; creadoEn: string }> = [];

export const clearMockJornadas = () => {
  mockJornadas = [];
  mockEjecuciones = [];
  mockAuditoria = [];
};

export const getMockJornadas = () => mockJornadas;
export const getMockEjecuciones = () => mockEjecuciones;
export const getMockAuditoriaJornadas = () => mockAuditoria;

const estadosActivos = ['confirmada', 'en_curso', 'pendiente_cierre'];

function minutosDesdeHora(hora: string): number {
  const [horas, minutos] = hora.split(':').map(Number);
  return (horas * 60) + minutos;
}

function horariosSeSolapan(a: JornadaInstruccion, b: JornadaInstruccion): boolean {
  const inicioA = minutosDesdeHora(a.horaInicio);
  const finA = minutosDesdeHora(a.horaFin);
  const inicioB = minutosDesdeHora(b.horaInicio);
  const finB = minutosDesdeHora(b.horaFin);

  return inicioA < finB && inicioB < finA;
}

// Devuelve el motivo del choque ('instructor' tiene prioridad sobre 'espacio' cuando
// ambos coinciden) o null si `existente` no choca con `jornada`.
function motivoConflictoHorario(existente: JornadaInstruccion, jornada: JornadaInstruccion): MotivoConflictoHorario | null {
  if (existente.id === jornada.id) return null;
  if (existente.tenantId !== jornada.tenantId) return null;
  if (!estadosActivos.includes(existente.estado)) return null;
  if (existente.fecha !== jornada.fecha) return null;
  if (!horariosSeSolapan(existente, jornada)) return null;

  const coincideEspacio = existente.sedeId === jornada.sedeId && existente.espacioId === jornada.espacioId;
  const coincideInstructor = existente.instructorId === jornada.instructorId;

  if (coincideInstructor) return 'instructor';
  if (coincideEspacio) return 'espacio';
  return null;
}

// Recorre las candidatas en orden y devuelve el resultado con el motivo de la primera
// que choque contra `jornada` (o { hayConflicto: false } si ninguna choca).
function construirResultadoConflicto(candidatas: JornadaInstruccion[], jornada: JornadaInstruccion): ResultadoConflictoHorario {
  for (const candidata of candidatas) {
    const motivo = motivoConflictoHorario(candidata, jornada);
    if (motivo) return { hayConflicto: true, motivo };
  }
  return { hayConflicto: false };
}

function upsertById<T extends { id: string }>(items: T[], value: T): T[] {
  const index = items.findIndex((item) => item.id === value.id);
  if (index === -1) return [...items, value];
  return items.map((item) => (item.id === value.id ? value : item));
}

function crearAuditId() {
  return `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function crearJornadaRepository(options: CrearJornadaRepositoryOptions = {}): JornadaRepository {
  const checkConfigured = () => (
    typeof window !== 'undefined' && (window as any).Cypress
      ? false
      :
    options.isFirebaseConfigured !== undefined
      ? options.isFirebaseConfigured
      : isFirebaseConfigured
  );
  const getDatabase = () => options.db || db;
  const deps: JornadaRepositoryDeps = options.deps || ({ collection, doc, getDoc, getDocs, query, setDoc, where, writeBatch } as unknown as JornadaRepositoryDeps);

  // Borrado fisico en lotes. Extraido para que lo compartan `eliminarJornadasEnLote`
  // (primitiva sin guardas, limpieza de previews) y `eliminarJornadaSegura` (borrado guardado
  // de una jornada), sin duplicar la logica de troceo/batch ni la rama en memoria.
  const eliminarLoteInterno = async (tenantId: string, ids: string[]) => {
    if (!checkConfigured()) {
      mockJornadas = mockJornadas.filter((jornada) => !(jornada.tenantId === tenantId && ids.includes(jornada.id)));
      return;
    }

    if (!deps.writeBatch) return;

    for (const lote of trocear(ids, TAMANO_MAXIMO_LOTE)) {
      const batch = deps.writeBatch(getDatabase());
      for (const id of lote) {
        const ref = deps.doc(getDatabase(), 'tenants', tenantId, 'jornadas', id);
        batch.delete(ref);
      }
      await batch.commit();
    }
  };

  return {
    async guardarJornada(jornada, opciones) {
      const actualizadoEnEsperado = opciones?.actualizadoEnEsperado;

      if (!checkConfigured()) {
        // Bloqueo optimista en memoria: si ya hay una copia guardada con distinto
        // actualizadoEn, otro proceso grabo primero y no debemos pisarla.
        if (actualizadoEnEsperado !== undefined) {
          const actual = mockJornadas.find(
            (item) => item.id === jornada.id && item.tenantId === jornada.tenantId,
          );
          if (actual && actual.actualizadoEn !== actualizadoEnEsperado) {
            throw new ConflictoConcurrenciaError();
          }
        }
        mockJornadas = upsertById(mockJornadas, jornada);
        return;
      }

      const ref = deps.doc(getDatabase(), 'tenants', jornada.tenantId, 'jornadas', jornada.id);

      // Subtarea 12.4 — bloqueo optimista. Leemos el documento actual y comparamos su
      // actualizadoEn contra el que la vista tenia al cargar la jornada (`actualizadoEnEsperado`).
      // Si difieren, otro usuario grabo entre la lectura y esta escritura -> no lo pisamos.
      // Se eligio getDoc+compare+setDoc en vez de runTransaction: es el mismo patron que ya
      // usa actualizarTemaJornada en este archivo y no obliga a mockear un objeto transaction
      // en cada test dado el estilo de inyeccion de deps de este repositorio. La ventana de
      // carrera entre getDoc y setDoc es aceptable para el caso de uso (dos usuarios editando
      // en escala de minutos, seccion 17 del documento de mejora); la atomicidad dura
      // (seccion 18) es un item separado, fuera del alcance de 12.4.
      if (actualizadoEnEsperado !== undefined && deps.getDoc) {
        const snap = await deps.getDoc(ref);
        if (snap.exists() && snap.data) {
          const actual = snap.data() as Partial<JornadaInstruccion>;
          if (actual.actualizadoEn !== undefined && actual.actualizadoEn !== actualizadoEnEsperado) {
            throw new ConflictoConcurrenciaError();
          }
        }
      }

      await deps.setDoc(ref, jornada, { merge: true });
    },

    async guardarEjecucion(ejecucion) {
      if (!checkConfigured()) {
        mockEjecuciones = upsertById(mockEjecuciones, ejecucion);
        return;
      }

      const ref = deps.doc(getDatabase(), 'tenants', ejecucion.tenantId, 'ejecucionesPrograma', ejecucion.id);
      await deps.setDoc(ref, ejecucion, { merge: true });
    },

    async registrarAuditoria(input) {
      const id = crearAuditId();
      const payload = {
        ...input,
        id,
        creadoEn: new Date().toISOString(),
      };

      if (!checkConfigured()) {
        mockAuditoria = [...mockAuditoria, payload];
        return;
      }

      const ref = deps.doc(getDatabase(), 'tenants', input.tenantId, 'jornadas', input.jornadaId, 'auditoria', id);
      await deps.setDoc(ref, payload);
    },

    async existeConflictoHorario(jornada) {
      if (!checkConfigured()) {
        return construirResultadoConflicto(mockJornadas, jornada);
      }

      if (!deps.collection || !deps.query || !deps.where || !deps.getDocs) {
        return { hayConflicto: false };
      }

      // Subtarea 12.3: se consulta solo por fecha (ya no ademas por sedeId+espacioId) para
      // no perder los choques del mismo instructor cuando la jornada nueva es en OTRA
      // sede/espacio a la misma hora: si el filtro fuera por sede+espacio, esos documentos
      // nunca llegarian a memoria y el choque de instructor jamas se detectaria (bug real
      // reportado en la auditoria del modulo Agenda).
      const jornadasRef = deps.collection(getDatabase(), 'tenants', jornada.tenantId, 'jornadas');
      const consulta = deps.query(
        jornadasRef,
        deps.where('fecha', '==', jornada.fecha),
      );
      const snap = await deps.getDocs(consulta);

      const candidatas = snap.docs.map((item) => ({ id: item.id, ...(item.data() as object) } as JornadaInstruccion));
      return construirResultadoConflicto(candidatas, jornada);
    },

    async listarJornadasPorTenant(tenantId) {
      if (!checkConfigured()) {
        return mockJornadas.filter((jornada) => jornada.tenantId === tenantId);
      }

      if (!deps.collection || !deps.getDocs) return [];

      const jornadasRef = deps.collection(getDatabase(), 'tenants', tenantId, 'jornadas');
      const snap = await deps.getDocs(jornadasRef);

      return snap.docs.map((item) => ({ id: item.id, ...(item.data() as object) } as JornadaInstruccion));
    },

    async listarJornadasPorRangoFechas(tenantId, fechaInicio, fechaFin) {
      if (!checkConfigured()) {
        return mockJornadas.filter(
          (jornada) => jornada.tenantId === tenantId && jornada.fecha >= fechaInicio && jornada.fecha <= fechaFin,
        );
      }

      if (!deps.collection || !deps.query || !deps.where || !deps.getDocs) return [];

      // Subtarea 12.8: filtro de rango sobre un unico campo ('fecha'), mismo patron de
      // deps.query/where que existeConflictoHorario. No requiere indice compuesto de
      // Firestore (rango sobre un solo campo dentro de una subcoleccion por tenant).
      const jornadasRef = deps.collection(getDatabase(), 'tenants', tenantId, 'jornadas');
      const consulta = deps.query(
        jornadasRef,
        deps.where('fecha', '>=', fechaInicio),
        deps.where('fecha', '<=', fechaFin),
      );
      const snap = await deps.getDocs(consulta);

      return snap.docs.map((item) => ({ id: item.id, ...(item.data() as object) } as JornadaInstruccion));
    },

    async guardarJornadasEnLote(jornadas) {
      if (!checkConfigured()) {
        for (const jornada of jornadas) {
          mockJornadas = upsertById(mockJornadas, jornada);
        }
        return;
      }

      if (!deps.writeBatch) return;

      for (const lote of trocear(jornadas, TAMANO_MAXIMO_LOTE)) {
        const batch = deps.writeBatch(getDatabase());
        for (const jornada of lote) {
          const ref = deps.doc(getDatabase(), 'tenants', jornada.tenantId, 'jornadas', jornada.id);
          batch.set(ref, jornada);
        }
        await batch.commit();
      }
    },

    async actualizarTemaJornada(tenantId, jornadaId, tema) {
      if (!checkConfigured()) {
        const index = mockJornadas.findIndex((jornada) => jornada.id === jornadaId && jornada.tenantId === tenantId);
        if (index === -1) {
          throw new Error('Jornada no encontrada');
        }
        mockJornadas[index] = { ...mockJornadas[index], tema, actualizadoEn: new Date().toISOString() };
        return;
      }

      if (!deps.getDoc) {
        throw new Error('Jornada no encontrada');
      }

      const ref = deps.doc(getDatabase(), 'tenants', tenantId, 'jornadas', jornadaId);
      const snap = await deps.getDoc(ref);
      if (!snap.exists()) {
        throw new Error('Jornada no encontrada');
      }

      await deps.setDoc(ref, { tema, actualizadoEn: new Date().toISOString() }, { merge: true });
    },

    async eliminarJornadasEnLote(tenantId, ids) {
      // Primitiva de HARD DELETE sin guardas (ver comentario en la interface): limpieza de
      // previews. El flujo de "eliminar clase" de Agenda debe usar `eliminarJornadaSegura`.
      await eliminarLoteInterno(tenantId, ids);
    },

    async eliminarJornadaSegura(jornada) {
      // Subtarea 12.6: guarda antes de borrar fisicamente. Si la jornada ya se opero, se
      // rechaza con EliminacionNoPermitidaError y no se toca Firestore (ni la copia en memoria).
      const evaluacion = evaluarEliminacionSegura(jornada);
      if (!evaluacion.permitido && evaluacion.motivo) {
        throw new EliminacionNoPermitidaError(evaluacion.motivo);
      }
      await eliminarLoteInterno(jornada.tenantId, [jornada.id]);
    },

    async obtenerEjecucion(tenantId, ejecucionId) {
      if (!checkConfigured()) {
        return mockEjecuciones.find(
          (item) => item.id === ejecucionId && item.tenantId === tenantId,
        ) ?? null;
      }

      if (!deps.getDoc) return null;

      const ref = deps.doc(getDatabase(), 'tenants', tenantId, 'ejecucionesPrograma', ejecucionId);
      const snap = await deps.getDoc(ref);
      if (!snap.exists() || !snap.data) return null;

      return { id: ejecucionId, ...(snap.data() as object) } as EjecucionPrograma;
    },
  };
}

export const jornadaRepository = crearJornadaRepository();
