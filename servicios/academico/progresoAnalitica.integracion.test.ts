/**
 * PRUEBAS DE INTEGRACION — Centro de Estudios, cadena de PROGRESO / METRICAS (analitica).
 *
 * Es la ultima cadena y la que el acudiente (y el admin) MIRA: el panel de progreso. La
 * escritura de las metricas ya esta cubierta por `quiz.integracion` (responder -> log ->
 * metricasEstudiante). Lo que falta, y es lo que un unitario de `analisisProgresoService`
 * NO puede cubrir, es el CRUCE REAL entre tres repositorios distintos:
 *
 *   metricasEstudiante.avancePorAsignacion[].asignacionId
 *     -> asignaciones/{id}.jornadaId
 *        -> jornadas/{id}.programaId
 *           -> programasAcademicos/{id}.nombre
 *
 * El unitario arma ese mapa a mano (`construirMapaAsignacionPrograma(asig, jor, prog)` con
 * arrays literales), asi que nunca verifica que los IDs GUARDADOS en cada coleccion
 * realmente encajen a traves del camino de lectura real. Si una asignacion apunta a una
 * jornada que ya no existe, o el programaId no matchea, el filtro por programa del panel
 * queda vacio en silencio -- el mismo tipo de falla muda que ya mordio en identidad.
 *
 * Se mockea unicamente el SDK de Firestore: los servicios/repositorios reales leen del store.
 */

jest.mock('firebase/firestore', () => require('../../test-utils/fakeFirestore').crearApiFirestoreFake());

jest.mock('../../firebase/config', () => ({
  db: {},
  auth: {},
  storage: {},
  messaging: null,
  app: {},
  appCheck: null,
  isFirebaseConfigured: true,
}));

import { limpiarFirestoreFake, sembrarDoc } from '../../test-utils/fakeFirestore';
import { crearActividadService } from './actividadService';
import { listarAsignacionesPorTenant } from './asignacionService';
import { crearJornadaRepository } from './jornadaRepository';
import { crearProgramaRepository } from './programaRepository';
import {
  construirMapaAsignacionPrograma,
  escalarMetricasAPrograma,
  listarProgramasConAsignaciones,
  calcularMetricasPorMaterial,
} from './analisisProgresoService';

const TENANT = 'tenant-gajog';

const actividad = crearActividadService({ isFirebaseConfigured: true });
const jornadaRepo = crearJornadaRepository({ isFirebaseConfigured: true });
const programaRepo = crearProgramaRepository({ isFirebaseConfigured: true });

// --- Sembradores: escriben en las MISMAS colecciones que leen los servicios reales -------

const sembrarPrograma = (id: string, nombre: string) =>
  sembrarDoc(`tenants/${TENANT}/programasAcademicos/${id}`, { id, tenantId: TENANT, nombre });

const sembrarJornada = (id: string, programaId: string) =>
  sembrarDoc(`tenants/${TENANT}/jornadas/${id}`, {
    id, tenantId: TENANT, programaId, sedeId: 's', espacioId: 'e', instructorId: 'i',
    fecha: '2026-07-25', horaInicio: '18:00', horaFin: '19:00', estado: 'confirmada',
    asistenciaRegistrada: false, actualizadoEn: '2026-07-22T10:00:00.000Z',
  });

const sembrarAsignacion = (id: string, over: Record<string, any> = {}) =>
  sembrarDoc(`tenants/${TENANT}/asignaciones/${id}`, {
    id, tenantId: TENANT, estado: 'publicada', fechaApertura: '2026-07-20T08:00:00.000Z', ...over,
  });

const sembrarMetrica = (estudianteId: string, avance: any[]) =>
  sembrarDoc(`tenants/${TENANT}/metricasEstudiante/${estudianteId}`, {
    estudianteId, tenantId: TENANT, estudianteNombre: `Alumno ${estudianteId}`,
    avancePorAsignacion: avance, porcentajeGlobalConsumo: 0, promedioScoreEvaluaciones: 0,
    totalAsignaciones: avance.length, asignacionesIniciadas: 0, asignacionesCompletadas: 0,
    totalEvaluacionesRealizadas: 0, actualizadoEn: '2026-07-22T12:00:00.000Z',
  });

const avance = (over: Record<string, any> = {}) => ({
  asignacionId: 'asig-1', tituloRecurso: 'Taeguk 1', tipoRecurso: 'quiz',
  porcentajeConsumo: 100, scoreUltimaEvaluacion: 90, vecesEvaluado: 1,
  primeraAperturaEn: '2026-07-20T10:00:00.000Z', ultimaActividadEn: '2026-07-20T10:30:00.000Z',
  ...over,
});

/** Lee del store con los servicios reales y arma el cruce, tal cual lo hace el panel. */
async function cargarCruce() {
  const [{ metricas }, asignaciones, jornadas, programas] = await Promise.all([
    actividad.obtenerMetricas({ tenantId: TENANT }),
    listarAsignacionesPorTenant(TENANT),
    jornadaRepo.listarJornadasPorTenant(TENANT),
    programaRepo.listarProgramasPorTenant(TENANT),
  ]);
  const mapa = construirMapaAsignacionPrograma(asignaciones, jornadas, programas);
  return { metricas, mapa };
}

beforeEach(() => limpiarFirestoreFake());

// --- El cruce completo, con datos que realmente encajan ---------------------------------

describe('Integracion: el filtro por programa cruza metricas -> asignacion -> jornada -> programa', () => {
  it('atribuye la asignacion al programa siguiendo la cadena real de IDs', async () => {
    sembrarPrograma('prog-formas', 'Formas Basicas');
    sembrarJornada('jor-1', 'prog-formas');
    sembrarAsignacion('asig-1', { jornadaId: 'jor-1' });
    sembrarMetrica('est-1', [avance({ asignacionId: 'asig-1' })]);

    const { metricas, mapa } = await cargarCruce();

    expect(mapa.get('asig-1')).toEqual({ programaId: 'prog-formas', programaNombre: 'Formas Basicas' });

    const escalado = escalarMetricasAPrograma(metricas[0], mapa, 'prog-formas');
    expect(escalado).not.toBeNull();
    expect(escalado!.totalAsignaciones).toBe(1);
    expect(escalado!.promedioScoreEvaluaciones).toBe(90);
  });

  it('el filtro RECORTA a las asignaciones del programa elegido, no muestra el resto', async () => {
    sembrarPrograma('prog-formas', 'Formas');
    sembrarPrograma('prog-combate', 'Combate');
    sembrarJornada('jor-formas', 'prog-formas');
    sembrarJornada('jor-combate', 'prog-combate');
    sembrarAsignacion('asig-forma', { jornadaId: 'jor-formas' });
    sembrarAsignacion('asig-combate', { jornadaId: 'jor-combate' });
    sembrarMetrica('est-1', [
      avance({ asignacionId: 'asig-forma', scoreUltimaEvaluacion: 100 }),
      avance({ asignacionId: 'asig-combate', scoreUltimaEvaluacion: 40 }),
    ]);

    const { metricas, mapa } = await cargarCruce();

    const soloFormas = escalarMetricasAPrograma(metricas[0], mapa, 'prog-formas')!;
    expect(soloFormas.totalAsignaciones).toBe(1);
    // Solo el score de Formas (100), no el promedio de ambos (70).
    expect(soloFormas.promedioScoreEvaluaciones).toBe(100);
    expect(soloFormas.avancePorAsignacion.map((a) => a.asignacionId)).toEqual(['asig-forma']);
  });

  it('el selector de programas del panel lista solo los que tienen asignacion real', async () => {
    sembrarPrograma('prog-con', 'Con Material');
    sembrarPrograma('prog-sin', 'Sin Material');
    sembrarJornada('jor-1', 'prog-con');
    sembrarAsignacion('asig-1', { jornadaId: 'jor-1' });
    sembrarMetrica('est-1', [avance({ asignacionId: 'asig-1' })]);

    const { mapa } = await cargarCruce();
    const programas = listarProgramasConAsignaciones(mapa);

    // 'Sin Material' existe pero no tiene asignaciones -> no ensucia el filtro.
    expect(programas.map((p) => p.programaNombre)).toEqual(['Con Material']);
  });
});

// --- Los caminos rotos que rompen el panel en SILENCIO ----------------------------------

describe('Integracion: eslabones faltantes no rompen el panel, pero dejan la asignacion sin programa', () => {
  it('una asignacion SIN jornadaId (material directo a un grupo) no se atribuye a ningun programa', async () => {
    sembrarPrograma('prog-formas', 'Formas');
    sembrarJornada('jor-1', 'prog-formas');
    sembrarAsignacion('asig-directa', { jornadaId: undefined }); // material directo, sin Agenda
    sembrarMetrica('est-1', [avance({ asignacionId: 'asig-directa' })]);

    const { metricas, mapa } = await cargarCruce();

    // Caso real del negocio, NO un error: no crashea y no aparece en ningun programa.
    expect(mapa.has('asig-directa')).toBe(false);
    expect(escalarMetricasAPrograma(metricas[0], mapa, 'prog-formas')).toBeNull();
  });

  it('una asignacion que apunta a una jornada INEXISTENTE queda sin programa (no revienta)', async () => {
    sembrarPrograma('prog-formas', 'Formas');
    // La jornada 'jor-borrada' no se siembra: simula una jornada eliminada.
    sembrarAsignacion('asig-huerfana', { jornadaId: 'jor-borrada' });
    sembrarMetrica('est-1', [avance({ asignacionId: 'asig-huerfana' })]);

    const { mapa } = await cargarCruce();

    expect(mapa.has('asig-huerfana')).toBe(false);
  });

  it('una jornada que apunta a un programa INEXISTENTE queda sin programa', async () => {
    // El programa 'prog-borrado' no se siembra.
    sembrarJornada('jor-1', 'prog-borrado');
    sembrarAsignacion('asig-1', { jornadaId: 'jor-1' });
    sembrarMetrica('est-1', [avance({ asignacionId: 'asig-1' })]);

    const { mapa } = await cargarCruce();

    expect(mapa.has('asig-1')).toBe(false);
  });
});

// --- Aislamiento por tenant en la lectura -----------------------------------------------

describe('Integracion: el panel de un club no lee metricas ni cruces de otro', () => {
  it('obtenerMetricas y el cruce se limitan al tenant', async () => {
    sembrarPrograma('prog-formas', 'Formas');
    sembrarJornada('jor-1', 'prog-formas');
    sembrarAsignacion('asig-1', { jornadaId: 'jor-1' });
    sembrarMetrica('est-propio', [avance({ asignacionId: 'asig-1' })]);
    // Metrica de OTRO tenant en la misma coleccion raiz de otro club.
    sembrarDoc('tenants/tenant-ajeno/metricasEstudiante/est-ajeno', {
      estudianteId: 'est-ajeno', tenantId: 'tenant-ajeno', avancePorAsignacion: [],
    });

    const { metricas } = await cargarCruce();

    expect(metricas.map((m) => m.estudianteId)).toEqual(['est-propio']);
  });
});

// --- Dashboard "Por Material": velocidad de reaccion + finalizacion ----------------------

describe('Integracion: el dashboard Por Material agrega a traves de todos los estudiantes', () => {
  it('categoriza un material por reaccion y finalizacion usando la fechaApertura real', async () => {
    sembrarPrograma('prog-formas', 'Formas');
    sembrarJornada('jor-1', 'prog-formas');
    sembrarAsignacion('asig-1', { jornadaId: 'jor-1', fechaApertura: '2026-07-20T08:00:00.000Z' });

    // Dos alumnos: ambos reaccionan rapido (<24h) y completan (>=80%) -> "funciona".
    sembrarMetrica('est-1', [avance({
      asignacionId: 'asig-1', porcentajeConsumo: 100,
      primeraAperturaEn: '2026-07-20T12:00:00.000Z', // +4h
    })]);
    sembrarMetrica('est-2', [avance({
      asignacionId: 'asig-1', porcentajeConsumo: 90,
      primeraAperturaEn: '2026-07-20T15:00:00.000Z', // +7h
    })]);

    const { metricas, mapa } = await cargarCruce();
    const asignaciones = await listarAsignacionesPorTenant(TENANT);
    const fechaApertura = new Map(asignaciones.map((a) => [a.id, a.fechaApertura]));

    const porMaterial = calcularMetricasPorMaterial(metricas, fechaApertura, mapa);

    expect(porMaterial).toHaveLength(1);
    const material = porMaterial[0];
    expect(material.totalEstudiantesIniciaron).toBe(2);
    expect(material.porcentajeFinalizacion).toBe(100);
    expect(material.categoria).toBe('funciona');
    // El cruce con programa tambien llega hasta aca.
    expect(material.programaNombre).toBe('Formas');
  });

  it('un material sin fechaApertura resoluble se EXCLUYE del dashboard en vez de adivinar', async () => {
    // avance apunta a una asignacion que no existe -> no hay fechaApertura.
    sembrarMetrica('est-1', [avance({ asignacionId: 'asig-fantasma', porcentajeConsumo: 100 })]);

    const { metricas, mapa } = await cargarCruce();
    const asignaciones = await listarAsignacionesPorTenant(TENANT);
    const fechaApertura = new Map(asignaciones.map((a) => [a.id, a.fechaApertura]));

    expect(calcularMetricasPorMaterial(metricas, fechaApertura, mapa)).toEqual([]);
  });
});
