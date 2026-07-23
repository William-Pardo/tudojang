/**
 * PRUEBAS DE INTEGRACION — Clase en Vivo, junta #1: escaner QR -> callable -> repositorio.
 *
 * Esta es la junta de mayor riesgo de toda la cadena, y la que ningun test cubria:
 *
 *   components/academico/EscanerAsistenciaClase.tsx        (escaneo del QR)
 *     -> servicios/academico/asistenciaClaseService.ts     (wrapper del callable)
 *     -> functions/academico/asistencia.js                 ESCRIBE con firebase-admin
 *          tenants/{t}/jornadas/{j}/asistencias/{estudianteId}
 *     -> servicios/academico/asistenciaRepository.ts       LEE con firebase/firestore
 *     -> contarCheckIns -> MisClasesView cierra la jornada
 *
 * DOS SDK DISTINTOS SOBRE LA MISMA SUBCOLECCION, sin tipos compartidos: el callable vive
 * en `functions/` (CommonJS, corrido por node:test) y el lector en la app (TypeScript,
 * corrido por Jest). Si alguien renombra un campo de un lado, el otro se entera en
 * produccion. Esa brecha estaba documentada como #14 en ACCIONES_PENDIENTES.md.
 *
 * Aca se cruzan los dos lados REALES contra el mismo store en memoria:
 *   - el callable corre con `crearFirestoreAdminFake()`  (snap.exists es PROPIEDAD)
 *   - el repositorio lee con `crearApiFirestoreFake()`    (snap.exists() es METODO)
 *
 * Ademas se ejercitan las precondiciones del callable, que hasta ahora solo se probaban
 * contra un firestore mockeado dentro de `functions/`: rol, tenant, instructor asignado,
 * estado de la jornada, matricula automatica y el toggle entrada/salida/rechazo.
 */

import type { RegistroAsistencia } from '../../models/academico/asistencia';

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

import { sembrarDoc, leerDoc, limpiarFirestoreFake, crearFirestoreAdminFake } from '../../test-utils/fakeFirestore';
import { crearAsistenciaRepository } from './asistenciaRepository';
import { contarCheckIns, calcularMinutosAsistidos } from './asistenciaService';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { crearServicioRegistrarAsistencia } = require('../../functions/academico/asistencia');

const TENANT = 'tenant-gajog';
const JORNADA = 'jornada-1';
const EJECUCION = 'ejecucion-1';
const MAESTRO_UID = 'uid-maestro-1';

// El repositorio REAL del front, apuntado al mismo store via el fake de cliente.
const repositorioLectura = crearAsistenciaRepository({ isFirebaseConfigured: true });

const contexto = (over: Record<string, any> = {}) => ({
  auth: {
    uid: MAESTRO_UID,
    token: { rol: 'Maestro', tenantId: TENANT, ...(over.token ?? {}) },
    ...over,
  },
});

const sembrarEscenarioCompleto = () => {
  sembrarDoc(`tenants/${TENANT}/jornadas/${JORNADA}`, {
    tenantId: TENANT,
    ejecucionProgramaId: EJECUCION,
    instructorId: MAESTRO_UID,
    estado: 'en_curso',
    fecha: '2026-07-22',
    horaInicio: '10:00',
    horaFin: '11:00',
  });
  sembrarDoc(`tenants/${TENANT}/ejecucionesPrograma/${EJECUCION}`, {
    grupoId: 'infantil',
    sedeId: 'sede-1',
  });
  sembrarDoc('estudiantes/est-sofia', {
    tenantId: TENANT,
    nombres: 'Sofia',
    grupo: 'Infantil',
    grado: 'Blanco',
    sedeId: 'sede-1',
    estadoPago: 'Al día',
  });
};

let registrarAsistenciaJornada: (data: any, context: any) => Promise<any>;

// Reloj fijo DENTRO de la ventana de la jornada sembrada (10:00-11:00 hora Bogota => ventana
// [15:45Z, 16:15Z]). Necesario desde que el callable valida la ventana en la ENTRADA
// (brecha 4-bis-C): sin un `ahora` inyectado, usaria la hora real y rechazaria todo por estar
// fuera de la ventana de una clase con fecha fija en el pasado.
const AHORA_EN_VENTANA = new Date('2026-07-22T15:30:00.000Z');

beforeEach(() => {
  limpiarFirestoreFake();
  registrarAsistenciaJornada = crearServicioRegistrarAsistencia({
    firestore: crearFirestoreAdminFake(),
    ahora: () => AHORA_EN_VENTANA,
  });
});

const datos = (estudianteId = 'est-sofia') => ({ tenantId: TENANT, jornadaId: JORNADA, estudianteId });

// --- El contrato entre quien escribe y quien lee -----------------------------------

describe('Integracion: lo que el callable ESCRIBE es exactamente lo que el repositorio LEE', () => {
  it('un check-in real queda legible por asistenciaRepository con la forma de RegistroAsistencia', async () => {
    sembrarEscenarioCompleto();

    const respuesta = await registrarAsistenciaJornada(datos(), contexto());
    expect(respuesta).toMatchObject({ ok: true, tipo: 'entrada' });

    // Lectura con el repositorio REAL del front (otro SDK, otro lenguaje, mismo doc).
    const registros = await repositorioLectura.listarPorJornada(TENANT, JORNADA);

    expect(registros).toHaveLength(1);
    expect(registros[0].estudianteId).toBe('est-sofia');
    expect(typeof registros[0].horaEntrada).toBe('string');
    expect(new Date(registros[0].horaEntrada).toString()).not.toBe('Invalid Date');
    expect(contarCheckIns(registros)).toBe(1);
  });

  it('el check-out agrega horaSalida y minutosAsistidos, y el front los lee sin adaptador', async () => {
    sembrarEscenarioCompleto();

    await registrarAsistenciaJornada(datos(), contexto());
    // Se fuerza la entrada 30 min ANTES del reloj inyectado (no `Date.now()` real) para que el
    // calculo de minutos sea observable y determinista: salida (15:30Z) - entrada (15:00Z) = 30.
    const ruta = `tenants/${TENANT}/jornadas/${JORNADA}/asistencias/est-sofia`;
    sembrarDoc(ruta, { ...leerDoc(ruta), horaEntrada: new Date(AHORA_EN_VENTANA.getTime() - 30 * 60_000).toISOString() });

    const salida = await registrarAsistenciaJornada(datos(), contexto());
    expect(salida).toMatchObject({ ok: true, tipo: 'salida' });

    const registros = await repositorioLectura.listarPorJornada(TENANT, JORNADA);
    expect(registros[0].horaSalida).toBeDefined();
    expect(registros[0].minutosAsistidos).toBe(30);
    // `calcularMinutosAsistidos` (front) suma lo que el callable (backend) calculo.
    expect(calcularMinutosAsistidos(registros)).toBe(30);
  });

  it('WS-2: el check-out acumula las horas reales en metricasAsistencia del estudiante', async () => {
    sembrarEscenarioCompleto();

    await registrarAsistenciaJornada(datos(), contexto()); // entrada
    const ruta = `tenants/${TENANT}/jornadas/${JORNADA}/asistencias/est-sofia`;
    sembrarDoc(ruta, { ...leerDoc(ruta), horaEntrada: new Date(AHORA_EN_VENTANA.getTime() - 45 * 60_000).toISOString() });
    await registrarAsistenciaJornada(datos(), contexto()); // salida (45 min)

    const metrica = leerDoc(`tenants/${TENANT}/metricasAsistencia/est-sofia`)!;
    expect(metrica.minutosTotales).toBe(45);
    expect(metrica.clasesAsistidas).toBe(1);
    expect(metrica.estudianteId).toBe('est-sofia');
  });

  it('el documento persistido no tiene campos fuera del contrato RegistroAsistencia', async () => {
    sembrarEscenarioCompleto();
    await registrarAsistenciaJornada(datos(), contexto());
    await registrarAsistenciaJornada(datos(), contexto()); // entrada + salida = doc completo

    const persistido = leerDoc(`tenants/${TENANT}/jornadas/${JORNADA}/asistencias/est-sofia`)!;
    const permitidos: Array<keyof RegistroAsistencia> = [
      'estudianteId',
      'horaEntrada',
      'horaSalida',
      'minutosAsistidos',
      // WS-1 (auditoria + puntualidad):
      'checkedInBy',
      'checkedOutBy',
      'isLate',
      'minutesLate',
    ];

    // Si el callable empieza a escribir un campo nuevo, este test lo señala y obliga a
    // actualizar `models/academico/asistencia.ts` en el mismo cambio.
    expect(Object.keys(persistido).sort()).toEqual([...permitidos].sort());
  });

  it('varios estudiantes producen un doc por estudiante y el conteo del front los ve todos', async () => {
    sembrarEscenarioCompleto();
    sembrarDoc('estudiantes/est-diego', {
      tenantId: TENANT, nombres: 'Diego', grupo: 'Infantil', grado: 'Blanco',
      sedeId: 'sede-1', estadoPago: 'Al día',
    });

    await registrarAsistenciaJornada(datos('est-sofia'), contexto());
    await registrarAsistenciaJornada(datos('est-diego'), contexto());

    const registros = await repositorioLectura.listarPorJornada(TENANT, JORNADA);
    expect(contarCheckIns(registros)).toBe(2);
    expect(registros.map((r) => r.estudianteId).sort()).toEqual(['est-diego', 'est-sofia']);
  });
});

// --- Toggle entrada / salida / rechazo ---------------------------------------------

describe('Integracion: toggle server-side del escaneo (1ro entrada, 2do salida, 3ro rechazado)', () => {
  it('el tercer escaneo del mismo estudiante se rechaza sin corromper el registro', async () => {
    sembrarEscenarioCompleto();

    await registrarAsistenciaJornada(datos(), contexto());
    await registrarAsistenciaJornada(datos(), contexto());

    await expect(registrarAsistenciaJornada(datos(), contexto())).rejects.toMatchObject({
      code: 'failed-precondition',
    });

    // El doc sigue completo y legible: el rechazo no dejo basura.
    const registros = await repositorioLectura.listarPorJornada(TENANT, JORNADA);
    expect(registros).toHaveLength(1);
    expect(registros[0].horaEntrada).toBeDefined();
    expect(registros[0].horaSalida).toBeDefined();
  });
});

// --- Precondiciones del callable ---------------------------------------------------

describe('Integracion: precondiciones que bloquean el escaneo', () => {
  it('rechaza si la jornada no esta en curso', async () => {
    sembrarEscenarioCompleto();
    sembrarDoc(`tenants/${TENANT}/jornadas/${JORNADA}`, {
      ...leerDoc(`tenants/${TENANT}/jornadas/${JORNADA}`),
      estado: 'confirmada',
    });

    await expect(registrarAsistenciaJornada(datos(), contexto())).rejects.toMatchObject({
      code: 'failed-precondition',
    });
    expect(await repositorioLectura.listarPorJornada(TENANT, JORNADA)).toHaveLength(0);
  });

  it('rechaza a un rol no docente (Tutor/Estudiante nunca escanean)', async () => {
    sembrarEscenarioCompleto();

    for (const rol of ['Tutor', 'Estudiante']) {
      await expect(
        registrarAsistenciaJornada(datos(), contexto({ token: { rol } }))
      ).rejects.toMatchObject({ code: 'permission-denied' });
    }
    expect(await repositorioLectura.listarPorJornada(TENANT, JORNADA)).toHaveLength(0);
  });

  it('rechaza a un maestro que no es el instructor asignado, pero deja pasar a un Admin', async () => {
    sembrarEscenarioCompleto();

    await expect(
      registrarAsistenciaJornada(datos(), { auth: { uid: 'otro-maestro', token: { rol: 'Maestro', tenantId: TENANT } } })
    ).rejects.toMatchObject({ code: 'permission-denied' });

    // Admin si puede operar cualquier jornada del tenant.
    const respuesta = await registrarAsistenciaJornada(
      datos(),
      { auth: { uid: 'uid-admin', token: { rol: 'Admin', tenantId: TENANT } } }
    );
    expect(respuesta.tipo).toBe('entrada');
  });

  it('rechaza cross-tenant aunque el rol sea valido', async () => {
    sembrarEscenarioCompleto();

    await expect(
      registrarAsistenciaJornada(datos(), contexto({ token: { rol: 'Admin', tenantId: 'tenant-ajeno' } }))
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('rechaza a un estudiante que no pertenece a la ejecucion (otro grupo)', async () => {
    sembrarEscenarioCompleto();
    sembrarDoc('estudiantes/est-cadete', {
      tenantId: TENANT, nombres: 'Ana', grupo: 'Cadetes', grado: 'Azul',
      sedeId: 'sede-1', estadoPago: 'Al día',
    });

    await expect(
      registrarAsistenciaJornada(datos('est-cadete'), contexto())
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('rechaza a un estudiante con pago Vencido (matricula automatica lo excluye)', async () => {
    sembrarEscenarioCompleto();
    sembrarDoc('estudiantes/est-sofia', {
      ...leerDoc('estudiantes/est-sofia'),
      estadoPago: 'Vencido',
    });

    await expect(registrarAsistenciaJornada(datos(), contexto())).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  it('una inscripcion explicita "activa" habilita a un estudiante que la matricula automatica excluiria', async () => {
    sembrarEscenarioCompleto();
    sembrarDoc('estudiantes/est-invitado', {
      tenantId: TENANT, nombres: 'Invitado', grupo: 'Adultos', grado: 'Negro',
      sedeId: 'otra-sede', estadoPago: 'Al día',
    });
    sembrarDoc(`tenants/${TENANT}/ejecucionesPrograma/${EJECUCION}/inscripciones/est-invitado`, {
      estado: 'activa',
    });

    const respuesta = await registrarAsistenciaJornada(datos('est-invitado'), contexto());
    expect(respuesta.tipo).toBe('entrada');
    expect(contarCheckIns(await repositorioLectura.listarPorJornada(TENANT, JORNADA))).toBe(1);
  });

  it('una inscripcion explicita "retirada" excluye a un estudiante que si coincidiria por atributos', async () => {
    sembrarEscenarioCompleto();
    sembrarDoc(`tenants/${TENANT}/ejecucionesPrograma/${EJECUCION}/inscripciones/est-sofia`, {
      estado: 'retirada',
    });

    await expect(registrarAsistenciaJornada(datos(), contexto())).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  it('rechaza sin autenticacion', async () => {
    sembrarEscenarioCompleto();
    await expect(registrarAsistenciaJornada(datos(), {})).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });
});
