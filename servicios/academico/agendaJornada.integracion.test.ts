/**
 * PRUEBAS DE INTEGRACION — Centro de Estudios, cadena de AGENDA (edicion de una jornada).
 *
 * Agenda es donde el club EDITA la programacion ya existente: mover una clase de hora,
 * cambiarle el maestro, eliminarla. Las cadenas ya cubiertas tocan los extremos --
 * `generacionJornadas` crea la agenda desde el programa, `MisClasesView` la cierra -- pero
 * lo del medio, que es lo que un admin toca todos los dias, no estaba probado de punta a
 * punta.
 *
 *   AgendaView / ModalEdicionJornada
 *     -> existeConflictoHorario()   choque de instructor o de espacio
 *     -> guardarJornada(..., { actualizadoEnEsperado })   bloqueo optimista
 *     -> eliminarJornadaSegura()    se niega si la clase ya se opero
 *          -> fallback: cancelarJornada() + guardarJornada()
 *     -> registrarAuditoria()       rastro en tenants/{t}/jornadas/{j}/auditoria/{id}
 *
 * Las tres juntas de mayor riesgo, y por que:
 *
 * 1. CONFLICTO DE INSTRUCTOR ENTRE SEDES DISTINTAS. La consulta filtra SOLO por fecha, a
 *    proposito: `jornadaRepository.ts:534` documenta un bug real donde el filtro incluia
 *    sede+espacio y por eso las jornadas de otra sede nunca llegaban a memoria -- el mismo
 *    maestro podia quedar agendado en dos sedes a la misma hora sin que nadie lo notara.
 *    Un unitario del helper puro no protege eso: lo que fallaba era la CONSULTA.
 *
 * 2. BLOQUEO OPTIMISTA. Dos personas editando la misma clase; la segunda no debe pisar a la
 *    primera en silencio.
 *
 * 3. ELIMINACION SEGURA. Una clase con asistencia registrada no se borra: se cancela, para
 *    no perder el historial.
 *
 * Se mockea unicamente el SDK de Firestore: el repositorio real corre contra el store.
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

import { limpiarFirestoreFake, sembrarDoc, leerDoc, listarPaths } from '../../test-utils/fakeFirestore';
import {
  crearJornadaRepository,
  ConflictoConcurrenciaError,
  EliminacionNoPermitidaError,
} from './jornadaRepository';
import { cancelarJornada } from './jornadaService';
import type { JornadaInstruccion } from '../../models/academico/jornada';

const TENANT = 'tenant-gajog';
const ADMIN = 'uid-admin-1';

// Repositorio REAL contra el fake de cliente.
const repo = crearJornadaRepository({ isFirebaseConfigured: true });

const jornadaBase = (over: Partial<JornadaInstruccion> = {}): JornadaInstruccion =>
  ({
    id: 'jor-1',
    tenantId: TENANT,
    sedeId: 'sede-norte',
    espacioId: 'dojang-a',
    instructorId: 'maestro-kim',
    fecha: '2026-07-25',
    horaInicio: '18:00',
    horaFin: '19:00',
    estado: 'confirmada',
    asistenciaRegistrada: false,
    actualizadoEn: '2026-07-22T10:00:00.000Z',
    ...over,
  }) as JornadaInstruccion;

const sembrarJornada = (j: JornadaInstruccion) =>
  sembrarDoc(`tenants/${j.tenantId}/jornadas/${j.id}`, { ...j });

beforeEach(() => limpiarFirestoreFake());

// --- Junta 1: choque de horario ---------------------------------------------------------

describe('Integracion: la agenda detecta que el maestro o el espacio ya estan ocupados', () => {
  it('detecta el choque de INSTRUCTOR aunque la otra clase sea en OTRA SEDE', async () => {
    // La regresion que importa. La consulta filtra solo por fecha justamente para que las
    // jornadas de otra sede lleguen a memoria; si volviera a filtrar por sede+espacio, este
    // choque desapareceria y el maestro quedaria agendado en dos lugares a la vez.
    sembrarJornada(jornadaBase({ id: 'jor-existente', sedeId: 'sede-sur', espacioId: 'dojang-z' }));

    const nueva = jornadaBase({ id: 'jor-nueva', sedeId: 'sede-norte', espacioId: 'dojang-a' });
    const resultado = await repo.existeConflictoHorario(nueva);

    expect(resultado.hayConflicto).toBe(true);
    expect(resultado.motivo).toBe('instructor');
  });

  it('detecta el choque de ESPACIO cuando el maestro es otro', async () => {
    sembrarJornada(jornadaBase({ id: 'jor-existente', instructorId: 'maestro-lee' }));

    const resultado = await repo.existeConflictoHorario(
      jornadaBase({ id: 'jor-nueva', instructorId: 'maestro-kim' }),
    );

    expect(resultado.hayConflicto).toBe(true);
    expect(resultado.motivo).toBe('espacio');
  });

  it('no hay choque si los horarios no se solapan', async () => {
    sembrarJornada(jornadaBase({ id: 'jor-existente', horaInicio: '16:00', horaFin: '17:00' }));

    const resultado = await repo.existeConflictoHorario(
      jornadaBase({ id: 'jor-nueva', horaInicio: '18:00', horaFin: '19:00' }),
    );

    expect(resultado.hayConflicto).toBe(false);
  });

  it('no hay choque contra otra FECHA', async () => {
    sembrarJornada(jornadaBase({ id: 'jor-existente', fecha: '2026-07-26' }));

    expect((await repo.existeConflictoHorario(jornadaBase({ id: 'jor-nueva' }))).hayConflicto).toBe(false);
  });

  it('una jornada NO choca consigo misma al reeditarla', async () => {
    sembrarJornada(jornadaBase({ id: 'jor-1' }));

    // Mismo id: es la jornada que se esta editando, no un choque.
    expect((await repo.existeConflictoHorario(jornadaBase({ id: 'jor-1' }))).hayConflicto).toBe(false);
  });

  it('una jornada CANCELADA no bloquea el horario', async () => {
    sembrarJornada(jornadaBase({ id: 'jor-existente', estado: 'cancelada' }));

    expect((await repo.existeConflictoHorario(jornadaBase({ id: 'jor-nueva' }))).hayConflicto).toBe(false);
  });
});

// --- Junta 2: bloqueo optimista ---------------------------------------------------------

describe('Integracion: dos personas editando la misma clase', () => {
  it('guarda cuando nadie mas toco la jornada', async () => {
    const original = jornadaBase();
    sembrarJornada(original);

    const editada = { ...original, horaInicio: '19:00', actualizadoEn: '2026-07-22T11:00:00.000Z' };
    await repo.guardarJornada(editada, { actualizadoEnEsperado: original.actualizadoEn });

    expect(leerDoc(`tenants/${TENANT}/jornadas/jor-1`)?.horaInicio).toBe('19:00');
  });

  it('RECHAZA la segunda escritura si otro guardo primero', async () => {
    const original = jornadaBase();
    sembrarJornada(original);

    // Persona A guarda y mueve el reloj del documento.
    await repo.guardarJornada(
      { ...original, horaInicio: '19:00', actualizadoEn: '2026-07-22T11:00:00.000Z' },
      { actualizadoEnEsperado: original.actualizadoEn },
    );

    // Persona B tenia la version vieja en pantalla y guarda encima.
    await expect(
      repo.guardarJornada(
        { ...original, instructorId: 'maestro-lee', actualizadoEn: '2026-07-22T11:05:00.000Z' },
        { actualizadoEnEsperado: original.actualizadoEn },
      ),
    ).rejects.toBeInstanceOf(ConflictoConcurrenciaError);

    // El cambio de A sobrevive; el de B no se aplico.
    const persistida = leerDoc(`tenants/${TENANT}/jornadas/jor-1`)!;
    expect(persistida.horaInicio).toBe('19:00');
    expect(persistida.instructorId).toBe('maestro-kim');
  });

  it('sin `actualizadoEnEsperado` NO hay bloqueo: se pisa y se guarda', async () => {
    // Documenta el contrato: el lock es opt-in. Los llamadores que no lo pasan
    // (p.ej. altas nuevas) siguen escribiendo directo.
    const original = jornadaBase();
    sembrarJornada(original);

    await repo.guardarJornada({ ...original, horaInicio: '20:00', actualizadoEn: 'otro-sello' });

    expect(leerDoc(`tenants/${TENANT}/jornadas/jor-1`)?.horaInicio).toBe('20:00');
  });
});

// --- Junta 3: eliminacion segura y su fallback ------------------------------------------

describe('Integracion: eliminar una clase de la agenda', () => {
  it('una jornada sin operar se borra fisicamente', async () => {
    sembrarJornada(jornadaBase({ estado: 'confirmada', asistenciaRegistrada: false }));

    await repo.eliminarJornadaSegura(jornadaBase({ estado: 'confirmada', asistenciaRegistrada: false }));

    expect(listarPaths(`tenants/${TENANT}/jornadas`)).toHaveLength(0);
  });

  it('NO borra una jornada con asistencia registrada, y explica por que', async () => {
    const conAsistencia = jornadaBase({ asistenciaRegistrada: true });
    sembrarJornada(conAsistencia);

    await expect(repo.eliminarJornadaSegura(conAsistencia)).rejects.toBeInstanceOf(
      EliminacionNoPermitidaError,
    );

    // Lo importante: el documento SIGUE ahi. El historial no se pierde.
    expect(listarPaths(`tenants/${TENANT}/jornadas`)).toHaveLength(1);

    await expect(repo.eliminarJornadaSegura(conAsistencia)).rejects.toThrow(/asistencia registrada/i);
  });

  it.each(['en_curso', 'pendiente_cierre', 'cerrada', 'parcial'] as const)(
    'NO borra una jornada en estado %s (la clase ya se opero)',
    async (estado) => {
      const operada = jornadaBase({ estado, asistenciaRegistrada: false });
      sembrarJornada(operada);

      await expect(repo.eliminarJornadaSegura(operada)).rejects.toThrow(/Clase en Vivo|operación/i);
      expect(listarPaths(`tenants/${TENANT}/jornadas`)).toHaveLength(1);
    },
  );

  it('el fallback funciona sobre una clase EN CURSO: no se borra, se cancela', async () => {
    const operada = jornadaBase({ estado: 'en_curso' });
    sembrarJornada(operada);

    await expect(repo.eliminarJornadaSegura(operada)).rejects.toBeInstanceOf(EliminacionNoPermitidaError);

    // Camino que toma `useEliminacionJornadaSegura.cancelarEnLugarDeEliminar`.
    const cancelada = cancelarJornada(operada, 'Cancelada desde Agenda');
    await repo.guardarJornada(cancelada, { actualizadoEnEsperado: operada.actualizadoEn });

    const persistida = leerDoc(`tenants/${TENANT}/jornadas/jor-1`)!;
    expect(persistida.estado).toBe('cancelada');
    expect(listarPaths(`tenants/${TENANT}/jornadas`)).toHaveLength(1);
  });

  it('el fallback tambien funciona con asistencia registrada en estado confirmada', async () => {
    const conAsistencia = jornadaBase({ estado: 'confirmada', asistenciaRegistrada: true });
    sembrarJornada(conAsistencia);

    await expect(repo.eliminarJornadaSegura(conAsistencia)).rejects.toBeInstanceOf(EliminacionNoPermitidaError);

    const cancelada = cancelarJornada(conAsistencia, 'Cancelada desde Agenda');
    await repo.guardarJornada(cancelada, { actualizadoEnEsperado: conAsistencia.actualizadoEn });

    expect(leerDoc(`tenants/${TENANT}/jornadas/jor-1`)?.estado).toBe('cancelada');
  });
});

// --- CARACTERIZACION: cancelar NO aplica a estados operados; la salida es ARCHIVAR --------

describe('Caracterizacion: cancelar no aplica a esos estados, pero ya no es callejon sin salida', () => {
  // La maquina de estados de `jornadaService` sigue sin admitir `cancelada` desde los estados
  // ya operados -- eso es correcto y NO se toca:
  //
  //   en_curso         -> ['pendiente_cierre', 'parcial', 'cancelada']   cancelar SI
  //   pendiente_cierre -> ['cerrada', 'parcial']                          cancelar NO
  //   cerrada          -> []                                              cancelar NO
  //   parcial          -> ['cerrada']                                     cancelar NO
  //
  // Antes, en esos 3 estados el admin no podia eliminar (historial) NI cancelar (maquina de
  // estados), y `cancelarEnLugarDeEliminar` le tiraba el error crudo "Transicion invalida" a
  // la cara: un callejon sin salida.
  //
  // Decision de producto (2026-07-22): la salida es ARCHIVAR (ocultar de Agenda), cubierto
  // arriba en "archivar oculta la clase...". Este bloque fija que la maquina de estados sigue
  // rechazando `cancelada` desde esos estados (no se relajo), para que el flujo correcto sea
  // archivar y no un cambio de estado indebido.
  it.each(['pendiente_cierre', 'cerrada', 'parcial'] as const)(
    'en estado %s: eliminar falla, cancelar NO aplica -> corresponde archivar',
    async (estado) => {
      const jornada = jornadaBase({ estado });
      sembrarJornada(jornada);

      await expect(repo.eliminarJornadaSegura(jornada)).rejects.toBeInstanceOf(EliminacionNoPermitidaError);
      // La maquina de estados sigue (correctamente) sin admitir cancelar desde aca.
      expect(() => cancelarJornada(jornada, 'Cancelada desde Agenda')).toThrow(
        `Transicion invalida: ${estado} -> cancelada`,
      );

      // La salida real: archivar. Funciona y deja la jornada intacta (solo oculta).
      await repo.archivarJornada!(jornada);
      expect(leerDoc(`tenants/${TENANT}/jornadas/jor-1`)?.archivada).toBe(true);
      expect(listarPaths(`tenants/${TENANT}/jornadas`)).toHaveLength(1);
    },
  );
});

// --- Junta 3-bis: archivar, la salida del callejon sin salida ---------------------------

describe('Integracion: archivar oculta la clase de Agenda sin borrarla ni cambiar su estado', () => {
  it.each(['pendiente_cierre', 'cerrada', 'parcial'] as const)(
    'en estado %s (que no se puede eliminar ni cancelar) archivar SI funciona',
    async (estado) => {
      const operada = jornadaBase({ estado });
      sembrarJornada(operada);

      // No se puede eliminar...
      await expect(repo.eliminarJornadaSegura(operada)).rejects.toBeInstanceOf(EliminacionNoPermitidaError);
      // ...pero archivar es la salida universal.
      await repo.archivarJornada!(operada);

      const persistida = leerDoc(`tenants/${TENANT}/jornadas/jor-1`)!;
      // La jornada NO se borro: sigue existiendo, con su estado y su historial intactos.
      expect(listarPaths(`tenants/${TENANT}/jornadas`)).toHaveLength(1);
      expect(persistida.estado).toBe(estado);
      expect(persistida.asistenciaRegistrada).toBe(operada.asistenciaRegistrada);
      // Solo se prendio el flag de visibilidad.
      expect(persistida.archivada).toBe(true);
    },
  );

  it('la parrilla de Agenda (rango de fechas) NO devuelve las jornadas archivadas', async () => {
    // AgendaView filtra `archivada` sobre el resultado de listarJornadasPorRangoFechas.
    sembrarJornada(jornadaBase({ id: 'jor-visible' }));
    sembrarJornada(jornadaBase({ id: 'jor-archivada', archivada: true }));

    const semana = await repo.listarJornadasPorRangoFechas(TENANT, '2026-07-20', '2026-07-31');
    const visiblesEnAgenda = semana.filter((j) => !j.archivada);

    expect(visiblesEnAgenda.map((j) => j.id)).toEqual(['jor-visible']);
  });

  it('archivar es idempotente y no cambia el estado', async () => {
    const cerrada = jornadaBase({ estado: 'cerrada' });
    sembrarJornada(cerrada);

    await repo.archivarJornada!(cerrada);
    await repo.archivarJornada!({ ...cerrada, archivada: true });

    const persistida = leerDoc(`tenants/${TENANT}/jornadas/jor-1`)!;
    expect(persistida.archivada).toBe(true);
    expect(persistida.estado).toBe('cerrada');
    expect(listarPaths(`tenants/${TENANT}/jornadas`)).toHaveLength(1);
  });
});

// --- Junta 4: la auditoria queda donde la UI la busca ------------------------------------

describe('Integracion: cada accion sobre una jornada deja rastro', () => {
  it('la auditoria se escribe en la subcoleccion de ESA jornada', async () => {
    sembrarJornada(jornadaBase());

    await repo.registrarAuditoria({
      tenantId: TENANT,
      jornadaId: 'jor-1',
      usuarioId: ADMIN,
      rol: 'Admin' as any,
      fuente: 'agenda',
      accion: 'eliminar',
      cambios: [],
    });

    const paths = listarPaths(`tenants/${TENANT}/jornadas/jor-1/auditoria`);
    expect(paths).toHaveLength(1);

    const registro = leerDoc(paths[0])!;
    expect(registro.accion).toBe('eliminar');
    expect(registro.fuente).toBe('agenda');
    expect(registro.usuarioId).toBe(ADMIN);
    expect(typeof registro.creadoEn).toBe('string');
  });

  it('dos acciones sobre la misma jornada NO se pisan entre si', async () => {
    sembrarJornada(jornadaBase());

    const registrar = (accion: 'eliminar' | 'cancelar') =>
      repo.registrarAuditoria({
        tenantId: TENANT,
        jornadaId: 'jor-1',
        usuarioId: ADMIN,
        rol: 'Admin' as any,
        fuente: 'agenda',
        accion,
        cambios: [],
      });

    await registrar('cancelar');
    await registrar('eliminar');

    expect(listarPaths(`tenants/${TENANT}/jornadas/jor-1/auditoria`)).toHaveLength(2);
  });

  it('la auditoria de una jornada no se mezcla con la de otra', async () => {
    sembrarJornada(jornadaBase({ id: 'jor-1' }));
    sembrarJornada(jornadaBase({ id: 'jor-2' }));

    await repo.registrarAuditoria({
      tenantId: TENANT, jornadaId: 'jor-1', usuarioId: ADMIN,
      rol: 'Admin' as any, fuente: 'agenda', accion: 'cancelar', cambios: [],
    });

    expect(listarPaths(`tenants/${TENANT}/jornadas/jor-1/auditoria`)).toHaveLength(1);
    expect(listarPaths(`tenants/${TENANT}/jornadas/jor-2/auditoria`)).toHaveLength(0);
  });
});
