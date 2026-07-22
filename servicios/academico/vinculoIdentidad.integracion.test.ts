/**
 * PRUEBAS DE INTEGRACION — Centro de Estudios, cadena de IDENTIDAD DEL ACUDIENTE.
 *
 * Esta es la cadena que decide si un padre, al entrar, ve a sus hijos o ve una pantalla
 * vacia. Ya fallo antes en produccion (ver "Tutor role broken end-to-end"), y la causa
 * raiz de aquella vez fue justamente una junta de identidad, no un bug de UI.
 *
 *   alta del estudiante  -> estudiantes/{id}.tutor.correo
 *   createInvitation()   -> normaliza el email A MINUSCULAS y crea la cuenta Auth
 *   login del acudiente  -> usuario.email (minusculas, viene de Auth)
 *   resolveLinkedStudent -> where('tutor.correo', '==', emailNormalizado)
 *
 * La junta critica es la ultima: la consulta de Firestore es de IGUALDAD EXACTA y
 * SENSIBLE A MAYUSCULAS. Si el doc del estudiante guardo "Papa@Gmail.com" y el login
 * resuelve "papa@gmail.com", no hay match posible -- para siempre, en silencio, sin error.
 *
 * Se mockea unicamente el SDK de Firestore: el resolver real corre contra el store.
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
import { resolveLinkedStudent, resolveStudentsForConsultor } from './tutorStudentResolver';

const TENANT = 'tenant-gajog';
const CORREO_TUTOR = 'papa@gajog.com';

/**
 * Siembra un estudiante tal cual lo deja el alta real: coleccion RAIZ `estudiantes`
 * (no una subcoleccion del tenant), con el tenant como campo.
 */
const sembrarEstudiante = (id: string, over: Record<string, any> = {}) => {
  sembrarDoc(`estudiantes/${id}`, {
    id,
    tenantId: TENANT,
    nombres: 'JUAN',
    apellidos: 'PEREZ',
    correo: 'juan@gajog.com',
    tutor: {
      nombres: 'MARIA',
      apellidos: 'PEREZ',
      correo: CORREO_TUTOR,
    },
    ...over,
  });
};

beforeEach(() => limpiarFirestoreFake());

// --- El camino feliz --------------------------------------------------------------------

describe('Integracion: el acudiente resuelve a sus hijos por su propio email de login', () => {
  it('encuentra al hijo cuando el correo guardado coincide con el del login', async () => {
    sembrarEstudiante('est-1');

    const hijos = await resolveLinkedStudent(TENANT, CORREO_TUTOR);

    expect(hijos.map((h) => h.id)).toEqual(['est-1']);
  });

  it('resuelve VARIOS hijos del mismo acudiente', async () => {
    sembrarEstudiante('est-1', { nombres: 'JUAN' });
    sembrarEstudiante('est-2', { nombres: 'ANA' });
    sembrarEstudiante('est-3', { tutor: { correo: 'otro-papa@gajog.com' } });

    const hijos = await resolveLinkedStudent(TENANT, CORREO_TUTOR);

    expect(hijos.map((h) => h.id).sort()).toEqual(['est-1', 'est-2']);
  });

  it('normaliza el email del LOGIN: mayusculas y espacios no rompen la resolucion', async () => {
    sembrarEstudiante('est-1');

    const hijos = await resolveLinkedStudent(TENANT, '  PAPA@GAJOG.COM  ');

    expect(hijos.map((h) => h.id)).toEqual(['est-1']);
  });

  it('aisla por tenant: un acudiente no ve alumnos de otro club', async () => {
    sembrarEstudiante('est-ajeno', { tenantId: 'tenant-otro-club' });

    expect(await resolveLinkedStudent(TENANT, CORREO_TUTOR)).toHaveLength(0);
  });

  it('un acudiente sin hijos recibe [] y NO una excepcion', async () => {
    sembrarEstudiante('est-1');

    await expect(resolveLinkedStudent(TENANT, 'desconocido@gajog.com')).resolves.toEqual([]);
  });

  it('sin tenantId o sin email devuelve [] sin consultar', async () => {
    sembrarEstudiante('est-1');

    expect(await resolveLinkedStudent('', CORREO_TUTOR)).toEqual([]);
    expect(await resolveLinkedStudent(TENANT, '')).toEqual([]);
  });
});

// --- LA JUNTA QUE ROMPE: mayusculas en el dato GUARDADO ---------------------------------

describe('Caracterizacion: un correo GUARDADO con mayusculas deja al padre sin ver a su hijo', () => {
  // Esto NO dice que el comportamiento este bien: fija POR QUE la normalizacion tiene que
  // pasar si o si en la ESCRITURA.
  //
  // `resolveLinkedStudent` consulta `where('tutor.correo', '==', emailNormalizado)`. Una
  // consulta de igualdad de Firestore es EXACTA y SENSIBLE A MAYUSCULAS: no existe forma de
  // hacerla case-insensitive del lado de la lectura sin guardar un campo ya normalizado.
  // Por eso el arreglo va en el alta (Cloud Function `crearEstudiante`, que normaliza
  // `correo` y `tutor.correo` desde 2026-07-22) y NO aca.
  //
  // Consecuencia que estas pruebas dejan por escrito: los documentos que YA se guardaron con
  // mayusculas siguen rotos hasta que se corra una migracion de datos.
  // Registrado en ACCIONES_PENDIENTES.md.
  it('con el correo del acudiente guardado en mayusculas NO lo encuentra', async () => {
    sembrarEstudiante('est-1', {
      tutor: { nombres: 'MARIA', apellidos: 'PEREZ', correo: 'Papa@Gajog.com' },
    });

    // El padre entra con su email de Auth (minusculas) y no ve absolutamente nada.
    // Sin excepcion, sin mensaje de error: una pantalla vacia.
    expect(await resolveLinkedStudent(TENANT, CORREO_TUTOR)).toEqual([]);
  });

  it('un espacio al final del correo guardado produce el mismo silencio', async () => {
    sembrarEstudiante('est-1', {
      tutor: { nombres: 'MARIA', apellidos: 'PEREZ', correo: 'papa@gajog.com ' },
    });

    expect(await resolveLinkedStudent(TENANT, CORREO_TUTOR)).toEqual([]);
  });

  it('el correo del propio ESTUDIANTE tiene exactamente el mismo problema', async () => {
    sembrarEstudiante('est-1', { correo: 'Juan@Gajog.com' });

    expect(await resolveStudentsForConsultor(TENANT, 'juan@gajog.com', false)).toEqual([]);
  });
});

// --- Resolucion por rol (Tutor vs Estudiante) -------------------------------------------

describe('Integracion: resolveStudentsForConsultor distingue Tutor de Estudiante', () => {
  it('como TUTOR resuelve por tutor.correo (sus hijos)', async () => {
    sembrarEstudiante('est-1');

    const res = await resolveStudentsForConsultor(TENANT, CORREO_TUTOR, true);

    expect(res.map((e) => e.id)).toEqual(['est-1']);
  });

  it('como ESTUDIANTE resuelve por su propio correo, no por el del tutor', async () => {
    sembrarEstudiante('est-1');

    const propio = await resolveStudentsForConsultor(TENANT, 'juan@gajog.com', false);
    expect(propio.map((e) => e.id)).toEqual(['est-1']);

    // Con el correo del acudiente y esTutor=false NO debe resolver nada.
    expect(await resolveStudentsForConsultor(TENANT, CORREO_TUTOR, false)).toHaveLength(0);
  });

  it('aisla por tenant tambien en la resolucion por rol', async () => {
    sembrarEstudiante('est-1', { tenantId: 'tenant-otro-club' });

    expect(await resolveStudentsForConsultor(TENANT, CORREO_TUTOR, true)).toHaveLength(0);
  });
});
