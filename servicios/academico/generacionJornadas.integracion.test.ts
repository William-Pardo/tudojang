/**
 * PRUEBAS DE INTEGRACION — Centro de Estudios, cadena PROGRAMA -> JORNADAS.
 *
 * Es la FUENTE de todo lo demas y no tenia cobertura de integracion:
 *
 *   createPrograma -> publishPrograma
 *     -> assignProgramaToGrupo()        crea la EjecucionPrograma con bloques recurrentes
 *     -> generarJornadasDeEjecucion()   expande cada bloque a jornadas con fecha concreta
 *     -> jornadaRepository.guardarJornadasEnLote()   persiste (writeBatch real)
 *     -> jornadaRepository.listarJornadasPorTenant() las lee de vuelta
 *     -> AgendaView / MisClasesView / Clase en Vivo operan sobre ellas
 *
 * Por que importa mas que otras cadenas: las 39 pruebas de Clase en Vivo y las 9 de cierre
 * de jornada asumen jornadas bien formadas. Si la generacion produce basura, todas ellas
 * estarian validando operaciones sobre datos incorrectos y seguirian en verde.
 *
 * Se mockea unicamente el SDK de Firestore. El repositorio, los servicios de programa y los
 * de jornada corren de verdad, incluido el `writeBatch` del guardado en lote.
 */

import type { ProgramaAcademico, EjecucionPrograma } from '../../models/academico/programa';

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

import { limpiarFirestoreFake, listarPaths } from '../../test-utils/fakeFirestore';
import {
  createPrograma,
  publishPrograma,
  assignProgramaToGrupo,
  generarJornadasDeEjecucion,
  advanceCiclo,
} from './programaService';
import { crearJornadaRepository } from './jornadaRepository';
import { estaJornadaEnVentana } from './ventanaClaseEnVivoService';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { debeIniciar, fechaHoraBogota } = require('../../functions/academico/jornadasScheduler');

const TENANT = 'tenant-gajog';
const MAESTRO = 'uid-maestro-1';

// Repositorio REAL, contra el fake de cliente.
const repositorio = crearJornadaRepository({ isFirebaseConfigured: true });

const programaPublicado = (): ProgramaAcademico => {
  const borrador = createPrograma({
    tenantId: TENANT,
    nombre: 'Taeguk Infantil',
    unidades: [
      {
        id: 'unidad-1',
        nombre: 'Fundamentos',
        objetivos: [
          { id: 'obj-1', descripcion: 'Postura basica' },
          { id: 'obj-2', descripcion: 'Taeguk 1' },
        ],
      },
    ],
  } as any);
  return publishPrograma(borrador);
};

// 2026-07-20 es LUNES; 2026-07-31 es viernes. Rango de 12 dias => 2 lunes (20 y 27).
const bloqueLunes = {
  id: 'bloque-lunes',
  tenantId: TENANT,
  diaSemana: 1,
  horaInicio: '10:00',
  horaFin: '11:00',
  grupoId: 'infantil',
  sedeId: 'sede-1',
  espacioId: 'tatami-1',
  instructorId: MAESTRO,
  activo: true,
};

const ejecucionCon = (bloques: any[], over: Record<string, any> = {}): EjecucionPrograma =>
  assignProgramaToGrupo(programaPublicado(), {
    id: 'ejecucion-1',
    grupoId: 'infantil',
    sedeId: 'sede-1',
    fechaInicio: '2026-07-20',
    fechaFin: '2026-07-31',
    bloques,
    ...over,
  } as any);

beforeEach(() => limpiarFirestoreFake());

// --- Generación --------------------------------------------------------------------

describe('Integracion: un programa publicado genera jornadas con fecha concreta', () => {
  it('expande un bloque semanal a una jornada por cada dia que corresponde', () => {
    const programa = programaPublicado();
    const ejecucion = ejecucionCon([bloqueLunes]);

    const jornadas = generarJornadasDeEjecucion(programa, ejecucion);

    expect(jornadas.map((j) => j.fecha)).toEqual(['2026-07-20', '2026-07-27']);
    expect(jornadas.every((j) => j.horaInicio === '10:00' && j.horaFin === '11:00')).toBe(true);
  });

  it('las jornadas nacen confirmadas y heredan los objetivos del programa', () => {
    const programa = programaPublicado();
    const jornadas = generarJornadasDeEjecucion(programa, ejecucionCon([bloqueLunes]));

    // Rediseño 2026-07-12: nacen 'confirmada', sin paso manual de borrador.
    expect(jornadas.every((j) => j.estado === 'confirmada')).toBe(true);
    expect(jornadas[0].objetivosPlaneados).toEqual(['obj-1', 'obj-2']);
    expect(jornadas[0].objetivosImpartidos).toEqual([]);
    expect(jornadas[0].asistenciaRegistrada).toBe(false);
  });

  it('varios bloques producen todas sus jornadas, cada una con su horario', () => {
    const programa = programaPublicado();
    const miercoles = { ...bloqueLunes, id: 'bloque-miercoles', diaSemana: 3, horaInicio: '16:00', horaFin: '17:00' };

    const jornadas = generarJornadasDeEjecucion(programa, ejecucionCon([bloqueLunes, miercoles]));

    expect(jornadas).toHaveLength(4); // 2 lunes + 2 miercoles
    expect(jornadas.filter((j) => j.horaInicio === '16:00').map((j) => j.fecha))
      .toEqual(['2026-07-22', '2026-07-29']);
  });

  it('un bloque inactivo no genera nada', () => {
    const programa = programaPublicado();
    const jornadas = generarJornadasDeEjecucion(programa, ejecucionCon([{ ...bloqueLunes, activo: false }]));
    expect(jornadas).toEqual([]);
  });

  it('sin fechaFin o sin bloques no genera nada (no revienta)', () => {
    const programa = programaPublicado();
    expect(generarJornadasDeEjecucion(programa, ejecucionCon([]))).toEqual([]);
    expect(generarJornadasDeEjecucion(programa, ejecucionCon([bloqueLunes], { fechaFin: undefined }))).toEqual([]);
  });

  it('un programa NO publicado no se puede asignar a un grupo', () => {
    const borrador = createPrograma({ tenantId: TENANT, nombre: 'Sin publicar', unidades: [] } as any);
    expect(() => assignProgramaToGrupo(borrador, { grupoId: 'infantil', sedeId: 'sede-1', fechaInicio: '2026-07-20' } as any))
      .toThrow(/publicado/i);
  });
});

// --- Persistencia y lectura ---------------------------------------------------------

describe('Integracion: las jornadas generadas se persisten y se leen igual', () => {
  it('guardarJornadasEnLote las escribe y listarJornadasPorTenant las devuelve', async () => {
    const programa = programaPublicado();
    const jornadas = generarJornadasDeEjecucion(programa, ejecucionCon([bloqueLunes]));

    await repositorio.guardarJornadasEnLote(jornadas);

    // Quedaron en la subcoleccion correcta del tenant.
    expect(listarPaths(`tenants/${TENANT}/jornadas`)).toHaveLength(2);

    const leidas = await repositorio.listarJornadasPorTenant(TENANT);
    expect(leidas).toHaveLength(2);
    expect(leidas.map((j) => j.fecha).sort()).toEqual(['2026-07-20', '2026-07-27']);
    // Los campos que el resto del modulo necesita sobreviven el viaje.
    expect(leidas[0].instructorId).toBe(MAESTRO);
    expect(leidas[0].ejecucionProgramaId).toBe('ejecucion-1');
    expect(leidas[0].objetivosPlaneados).toEqual(['obj-1', 'obj-2']);
  });

  it('el guardado en lote soporta mas jornadas que el tamaño maximo de un batch', async () => {
    const programa = programaPublicado();
    // Un año de clases semanales: fuerza varios lotes.
    const jornadas = generarJornadasDeEjecucion(
      programa,
      ejecucionCon([bloqueLunes], { fechaInicio: '2026-01-05', fechaFin: '2026-12-28' })
    );
    expect(jornadas.length).toBeGreaterThan(50);

    await repositorio.guardarJornadasEnLote(jornadas);

    const leidas = await repositorio.listarJornadasPorTenant(TENANT);
    expect(leidas).toHaveLength(jornadas.length);
  });

  it('aisla por tenant: no devuelve jornadas de otro club', async () => {
    const programa = programaPublicado();
    const propias = generarJornadasDeEjecucion(programa, ejecucionCon([bloqueLunes]));
    const ajenas = propias.map((j) => ({ ...j, id: `ajena-${j.id}`, tenantId: 'tenant-ajeno' }));

    await repositorio.guardarJornadasEnLote([...propias, ...ajenas]);

    expect(await repositorio.listarJornadasPorTenant(TENANT)).toHaveLength(2);
    expect(await repositorio.listarJornadasPorTenant('tenant-ajeno')).toHaveLength(2);
  });
});

// --- La junta con Clase en Vivo -----------------------------------------------------

describe('Integracion: una jornada generada es operable por Clase en Vivo', () => {
  it('el scheduler la reconoce y la ventana la habilita en su horario real', async () => {
    const programa = programaPublicado();
    const jornadas = generarJornadasDeEjecucion(programa, ejecucionCon([bloqueLunes]));
    await repositorio.guardarJornadasEnLote(jornadas);

    // OJO: `listarJornadasPorTenant` ordena por id de documento, que es aleatorio -- NO por
    // fecha. Tomar `[0]` hacia este test FLAKY: pasaba o fallaba segun el id que tocara.
    // Se selecciona explicitamente la jornada del dia que interesa.
    const leidas = await repositorio.listarJornadasPorTenant(TENANT);
    const primera = leidas.find((j) => j.fecha === '2026-07-20')!;
    expect(primera).toBeDefined();

    // 10:30 hora de Colombia del lunes 2026-07-20, que es 15:30 UTC.
    const durante = '2026-07-20T15:30:00.000Z';
    const { fecha, hora } = fechaHoraBogota(new Date(durante));

    // Cierra el circulo: lo que GENERA el programa es exactamente lo que el cron arranca
    // y lo que la ventana habilita. Si la generacion produjera fechas u horas en otra
    // zona, estas dos afirmaciones se contradirian.
    expect(debeIniciar(primera, fecha, hora)).toBe(true);
    expect(estaJornadaEnVentana(primera, durante)).toBe(true);
  });

  it('fuera del horario del bloque, ni el scheduler ni la ventana la activan', async () => {
    const programa = programaPublicado();
    await repositorio.guardarJornadasEnLote(generarJornadasDeEjecucion(programa, ejecucionCon([bloqueLunes])));
    // Idem: seleccion explicita por fecha, no por posicion.
    const leidas = await repositorio.listarJornadasPorTenant(TENANT);
    const primera = leidas.find((j) => j.fecha === '2026-07-20')!;

    const madrugada = '2026-07-20T09:00:00.000Z'; // 04:00 en Colombia
    const { fecha, hora } = fechaHoraBogota(new Date(madrugada));

    expect(debeIniciar(primera, fecha, hora)).toBe(false);
    expect(estaJornadaEnVentana(primera, madrugada)).toBe(false);
  });
});

// --- Avance del ciclo ---------------------------------------------------------------

describe('Integracion: el ciclo del programa avanza con los objetivos impartidos', () => {
  it('marca el objetivo dictado y apunta al siguiente', () => {
    const programa = programaPublicado();
    const ejecucion = ejecucionCon([bloqueLunes]);
    expect(ejecucion.objetivoActualId).toBe('obj-1');

    const avanzada = advanceCiclo(programa, ejecucion, ['obj-1']);

    expect(avanzada.objetivosCompletados).toEqual(['obj-1']);
    expect(avanzada.objetivoActualId).toBe('obj-2');
    expect(avanzada.estado).toBe('activo');
  });

  it('al dictar el ultimo objetivo la ejecucion queda completada', () => {
    const programa = programaPublicado();
    const avanzada = advanceCiclo(programa, ejecucionCon([bloqueLunes]), ['obj-1', 'obj-2']);

    expect(avanzada.estado).toBe('completado');
    expect(avanzada.objetivoActualId).toBeNull();
  });

  it('ignora objetivos que no pertenecen al programa', () => {
    const programa = programaPublicado();
    const avanzada = advanceCiclo(programa, ejecucionCon([bloqueLunes]), ['obj-inventado']);

    expect(avanzada.objetivosCompletados).toEqual([]);
    expect(avanzada.objetivoActualId).toBe('obj-1');
  });
});
