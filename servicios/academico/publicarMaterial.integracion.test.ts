/**
 * PRUEBAS DE INTEGRACION — Centro de Estudios, cadena de PUBLICACION de material.
 *
 * Es la columna vertebral del modulo y hasta ahora no tenia una sola prueba de integracion:
 *
 *   AsignarMaterialWizard / PestanaMaterialesJornada
 *     -> asignacionService.publicarAsignacion()          (wrapper del callable)
 *     -> functions/academico/asignaciones.js             ESCRIBE con firebase-admin
 *          tenants/{t}/asignaciones/{asignacionId}
 *     -> centroEstudiosRepository                        LEE con firebase/firestore
 *     -> aplicaAlEstudiante() -> AsignacionCard
 *
 * Lo que ya estaba probado era la MITAD DE LECTURA: que el consultor ve lo que le
 * asignaron (`CentroEstudios.integracion.test.tsx`). Nunca se probo que el staff lo
 * asigne BIEN. Si esta mitad tiene un defecto, aquellos 12 tests estarian validando el
 * consumo de datos mal creados.
 *
 * Mismo patron que `checkInQr.integracion.test.ts`: el callable corre con el fake de
 * Admin SDK y el repositorio con el de cliente, ambos sobre EL MISMO store, de modo que
 * el contrato entre quien escribe y quien lee queda fijado.
 */

import type { AsignacionAcademica } from '../../models/academico/asignacion';

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
import { FirestoreCentroEstudiosRepository } from './centroEstudiosRepository';
import { aplicaAlEstudiante, publishAsignacion as enriquecerConRecurso } from './asignacionService';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { crearServicioPublishAsignacion } = require('../../functions/academico/asignaciones');

const TENANT = 'tenant-gajog';
const JORNADA = 'jornada-1';
const MAESTRO = 'uid-maestro-1';

// Repositorio REAL del front, contra el mismo store via el fake de cliente.
import * as firestoreCliente from 'firebase/firestore';
const repositorioLectura = new FirestoreCentroEstudiosRepository({
  db: {},
  doc: (firestoreCliente as any).doc,
  getDoc: (firestoreCliente as any).getDoc,
  collection: (firestoreCliente as any).collection,
  query: (firestoreCliente as any).query,
  where: (firestoreCliente as any).where,
  getDocs: (firestoreCliente as any).getDocs,
});

let publishAsignacion: (data: any, context: any) => Promise<any>;

const contexto = (over: Record<string, any> = {}) => ({
  auth: { uid: MAESTRO, token: { rol: 'Maestro', tenantId: TENANT, ...(over.token ?? {}) }, ...over },
});

const sembrarEscenario = () => {
  sembrarDoc(`tenants/${TENANT}/recursos/recurso-1`, {
    id: 'recurso-1',
    tenantId: TENANT,
    titulo: 'Video Taeguk 1',
    estado: 'aprobado',
    externalFileId: 'drive-abc123',
    youtubeVideoId: 'yt-xyz',
  });
  sembrarDoc(`tenants/${TENANT}/jornadas/${JORNADA}`, {
    tenantId: TENANT,
    instructorId: MAESTRO,
    estado: 'en_curso',
    fecha: '2026-07-22',
    horaInicio: '10:00',
    horaFin: '11:00',
  });
  sembrarDoc('estudiantes/est-sofia', {
    tenantId: TENANT,
    nombres: 'Sofia',
    apellidos: 'Ramirez',
    correo: 'sofia@gajog.com',
    grupo: 'Infantil',
    grado: 'Blanco',
    sedeId: 'sede-1',
  });
};

/**
 * Reproduce el flujo REAL de la UI (`AsignacionesView.tsx:979` y `:1460`), que tiene DOS
 * pasos y no uno:
 *   1. `publishAsignacion(...)` -- funcion PURA del cliente que valida contra el recurso y
 *      copia de el `externalFileId` y `youtubeVideoId`.
 *   2. `publicarAsignacion(...)` -- manda esa asignacion ya enriquecida al callable.
 *
 * El callable hace `{...asignacion}` y NO vuelve a leer esos campos del recurso: confia en
 * que el cliente los mando. Saltearse el paso 1 en un test da un falso negativo -- fue
 * exactamente lo que paso al escribir esta suite.
 */
const asignacionEnriquecida = (over: Record<string, any> = {}) => {
  const recurso = leerDoc(`tenants/${TENANT}/recursos/recurso-1`) as any;
  return enriquecerConRecurso({
    asignacion: {
      id: over.id ?? 'asig-1',
      tenantId: TENANT,
      recursoId: 'recurso-1',
      titulo: 'Video Taeguk 1',
      descripcion: 'Forma completa',
      destinatario: { tipo: 'grupo', grupo: 'Infantil' },
      uso: 'estudio',
      momento: 'preparacion',
      obligatoria: true,
      estado: 'borrador',
      creadoPorUid: MAESTRO,
      creadoEn: '2026-07-01T00:00:00.000Z',
      actualizadoEn: '2026-07-01T00:00:00.000Z',
      ...over,
    } as any,
    recurso,
    publicadoPorUid: MAESTRO,
  });
};

const peticion = (over: Record<string, any> = {}) => ({
  tenantId: TENANT,
  jornadaId: over.jornadaId ?? JORNADA,
  asignacion: over.asignacionCruda ?? asignacionEnriquecida(over.asignacion ?? {}),
});

beforeEach(() => {
  limpiarFirestoreFake();
  publishAsignacion = crearServicioPublishAsignacion({ firestore: crearFirestoreAdminFake() });
});

// --- El material publicado llega al estudiante ---------------------------------------

describe('Integracion: publicar material -> el consultor lo ve', () => {
  it('lo que el callable escribe es legible por el repositorio y aplica al estudiante', async () => {
    sembrarEscenario();

    const respuesta = await publishAsignacion(peticion(), contexto());
    expect(respuesta.ok).toBe(true);

    // Lectura con el repositorio REAL del front (otro SDK, mismo documento).
    const { asignaciones } = await repositorioLectura.obtenerAsignaciones({
      tenantId: TENANT,
      estudianteId: 'est-sofia',
    });

    expect(asignaciones).toHaveLength(1);
    expect(asignaciones[0].titulo).toBe('Video Taeguk 1');
    expect(asignaciones[0].estado).toBe('publicada');
    // Campos que el callable copia del recurso y que el reproductor necesita.
    expect(asignaciones[0].externalFileId).toBe('drive-abc123');
    expect(asignaciones[0].youtubeVideoId).toBe('yt-xyz');
    // Campos derivados que agrega el lector (no los escribe el callable).
    expect(asignaciones[0].estadoProgreso).toBe('disponible');
    expect(asignaciones[0].porcentajeProgreso).toBe(0);
  });

  it('el destinatario decide quien lo ve: otro grupo no lo recibe', async () => {
    sembrarEscenario();
    sembrarDoc('estudiantes/est-cadete', {
      tenantId: TENANT, nombres: 'Ana', apellidos: 'Ruiz', correo: 'ana@gajog.com',
      grupo: 'Cadetes', grado: 'Azul', sedeId: 'sede-1',
    });

    await publishAsignacion(peticion(), contexto());

    const infantil = await repositorioLectura.obtenerAsignaciones({ tenantId: TENANT, estudianteId: 'est-sofia' });
    const cadete = await repositorioLectura.obtenerAsignaciones({ tenantId: TENANT, estudianteId: 'est-cadete' });

    expect(infantil.asignaciones).toHaveLength(1);
    expect(cadete.asignaciones).toHaveLength(0);
  });

  it('publicar a un estudiante puntual usa su docId real', async () => {
    sembrarEscenario();

    await publishAsignacion(
      peticion({ asignacion: { destinatario: { tipo: 'estudiante', estudianteIds: ['est-sofia'] } } }),
      contexto()
    );

    const { asignaciones } = await repositorioLectura.obtenerAsignaciones({
      tenantId: TENANT, estudianteId: 'est-sofia',
    });
    expect(asignaciones).toHaveLength(1);
    // El helper de dominio coincide con lo que decidio el repositorio.
    expect(aplicaAlEstudiante(asignaciones[0] as AsignacionAcademica, { id: 'est-sofia', grupo: 'Infantil' } as any)).toBe(true);
  });

  it('republicar la misma asignacion no la duplica: sobrescribe el mismo documento', async () => {
    sembrarEscenario();

    await publishAsignacion(peticion({ asignacion: { id: 'asig-fija' } }), contexto());
    await publishAsignacion(
      peticion({ asignacion: { id: 'asig-fija', titulo: 'Video Taeguk 1 (corregido)' } }),
      contexto()
    );

    const { asignaciones } = await repositorioLectura.obtenerAsignaciones({
      tenantId: TENANT, estudianteId: 'est-sofia',
    });
    expect(asignaciones).toHaveLength(1);
    expect(asignaciones[0].titulo).toBe('Video Taeguk 1 (corregido)');
  });

  it('no pisa el estado de una asignacion ya cerrada al republicar', async () => {
    sembrarEscenario();
    sembrarDoc(`tenants/${TENANT}/asignaciones/asig-cerrada`, {
      id: 'asig-cerrada', tenantId: TENANT, recursoId: 'recurso-1', estado: 'cerrada',
      titulo: 'Vieja', destinatario: { tipo: 'grupo', grupo: 'Infantil' },
      uso: 'estudio', momento: 'preparacion', obligatoria: true,
      creadoPorUid: MAESTRO, creadoEn: '2026-07-01T00:00:00.000Z', actualizadoEn: '2026-07-01T00:00:00.000Z',
    });

    await publishAsignacion(peticion({ asignacion: { id: 'asig-cerrada' } }), contexto());

    // Estado terminal preservado: el callable no lo devuelve a 'publicada'.
    expect(leerDoc(`tenants/${TENANT}/asignaciones/asig-cerrada`)?.estado).toBe('cerrada');
    // Y por lo tanto el consultor NO la ve (solo lee 'publicada').
    const { asignaciones } = await repositorioLectura.obtenerAsignaciones({
      tenantId: TENANT, estudianteId: 'est-sofia',
    });
    expect(asignaciones).toHaveLength(0);
  });
});

// --- Precondiciones que bloquean la publicacion ---------------------------------------

describe('Integracion: precondiciones de la publicacion', () => {
  it('rechaza un recurso que no esta aprobado, y nada llega al estudiante', async () => {
    sembrarEscenario();
    sembrarDoc(`tenants/${TENANT}/recursos/recurso-1`, {
      ...leerDoc(`tenants/${TENANT}/recursos/recurso-1`), estado: 'pendiente',
    });

    // La funcion pura del cliente ya rechaza un recurso no aprobado, asi que para probar la
    // guarda DEL SERVIDOR hay que mandarle una asignacion cruda, como haria un cliente
    // malicioso que se saltea la validacion de UI.
    await expect(
      publishAsignacion(
        peticion({ asignacionCruda: { recursoId: 'recurso-1', tenantId: TENANT, destinatario: { tipo: 'grupo', grupo: 'Infantil' } } }),
        contexto()
      )
    ).rejects.toMatchObject({ code: 'failed-precondition' });
    const { asignaciones } = await repositorioLectura.obtenerAsignaciones({
      tenantId: TENANT, estudianteId: 'est-sofia',
    });
    expect(asignaciones).toHaveLength(0);
  });

  it('rechaza si el recurso no existe', async () => {
    sembrarEscenario();
    await expect(
      publishAsignacion(peticion({ asignacionCruda: { recursoId: 'recurso-fantasma', tenantId: TENANT } }), contexto())
    ).rejects.toMatchObject({ code: 'not-found' });
  });

  it('rechaza si la jornada no existe', async () => {
    sembrarEscenario();
    await expect(
      publishAsignacion(peticion({ jornadaId: 'jornada-fantasma' }), contexto())
    ).rejects.toMatchObject({ code: 'not-found' });
  });

  it('un maestro no asignado a la jornada no puede publicar; un Admin si', async () => {
    sembrarEscenario();

    await expect(
      publishAsignacion(peticion(), { auth: { uid: 'otro-maestro', token: { rol: 'Maestro', tenantId: TENANT } } })
    ).rejects.toMatchObject({ code: 'permission-denied' });

    const respuesta = await publishAsignacion(
      peticion(), { auth: { uid: 'uid-admin', token: { rol: 'Admin', tenantId: TENANT } } }
    );
    expect(respuesta.ok).toBe(true);
  });

  it('rechaza cross-tenant', async () => {
    sembrarEscenario();
    await expect(
      publishAsignacion(peticion(), contexto({ token: { rol: 'Admin', tenantId: 'tenant-ajeno' } }))
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('rechaza sin jornada y sin autenticacion', async () => {
    sembrarEscenario();
    await expect(publishAsignacion(peticion({ jornadaId: '' }), contexto())).rejects.toMatchObject({
      code: 'invalid-argument',
    });
    await expect(publishAsignacion(peticion(), {})).rejects.toMatchObject({ code: 'unauthenticated' });
  });
});
