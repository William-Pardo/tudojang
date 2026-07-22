/**
 * PRUEBAS DE INTEGRACION — Centro de Estudios, cadena de BIBLIOTECA (Centro de recursos).
 *
 * Es el paso 1 y 2 del flujo que la propia UI muestra como stepper, y alimenta todo lo demas:
 *
 *   importFromDrive()          indexa el archivo de Drive como RecursoAcademico
 *     -> updateFicha()         clasifica (ficha academica, titulo visible, youtubeVideoId)
 *     -> approveRecurso()      lo pasa a 'aprobado'
 *     -> listarRecursosAprobados()
 *     -> publishAsignacion() lo exige aprobado para poder publicarlo
 *
 * Ese ultimo eslabon es la junta que interesa: un recurso solo sirve si la publicacion lo
 * acepta. Probar Biblioteca en aislamiento dejaria sin verificar que su salida encaja con
 * la entrada de `publicarMaterial.integracion.test.ts`.
 *
 * Se mockea unicamente el SDK de Firestore: el servicio real corre contra el store en
 * memoria, incluyendo sus queries de deduplicacion.
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

import { limpiarFirestoreFake, leerDoc, listarPaths } from '../../test-utils/fakeFirestore';
import { crearBibliotecaService } from './bibliotecaService';
import { publishAsignacion } from './asignacionService';

const TENANT = 'tenant-gajog';
const ADMIN = 'uid-admin-1';

// Servicio REAL contra el fake de cliente.
const biblioteca = crearBibliotecaService({ isFirebaseConfigured: true });

const importar = (over: Record<string, any> = {}) =>
  biblioteca.importFromDrive(
    TENANT,
    over.fileId ?? 'drive-abc123',
    over.nombre ?? 'Taeguk 1.mp4',
    over.mimeType ?? 'video/mp4',
    ADMIN
  );

const fichaMinima = {
  categoria: 'Formas',
  nivel: 'Infantil',
  descripcion: 'Video de la forma completa',
};

beforeEach(() => limpiarFirestoreFake());

// --- Importación desde Drive ---------------------------------------------------------

describe('Integracion: importar un archivo de Drive lo indexa como recurso', () => {
  it('crea el recurso en la subcoleccion del tenant y lo deja recuperable', async () => {
    const recurso = await importar();

    expect(recurso.tenantId).toBe(TENANT);
    expect(recurso.externalFileId).toBe('drive-abc123');
    // Nace sin aprobar: la aprobacion es un paso explicito.
    expect(recurso.estado).not.toBe('aprobado');

    expect(listarPaths(`tenants/${TENANT}/recursos`)).toHaveLength(1);
    expect(leerDoc(`tenants/${TENANT}/recursos/${recurso.id}`)?.externalFileId).toBe('drive-abc123');
  });

  it('NO duplica: reimportar el mismo archivo devuelve el recurso ya indexado', async () => {
    const primero = await importar();
    const segundo = await importar();

    expect(segundo.id).toBe(primero.id);
    expect(listarPaths(`tenants/${TENANT}/recursos`)).toHaveLength(1);
  });

  it('deduplica tambien por nombre normalizado, aunque cambie el id de Drive', async () => {
    const primero = await importar({ nombre: 'Taeguk 1.mp4' });
    // Mismo archivo resubido a Drive: id nuevo, nombre equivalente.
    const segundo = await importar({ fileId: 'drive-otro-id', nombre: '  TAEGUK 1.MP4  ' });

    expect(segundo.id).toBe(primero.id);
    expect(listarPaths(`tenants/${TENANT}/recursos`)).toHaveLength(1);
  });

  it('archivos distintos producen recursos distintos', async () => {
    await importar({ fileId: 'drive-1', nombre: 'Taeguk 1.mp4' });
    await importar({ fileId: 'drive-2', nombre: 'Taeguk 2.mp4' });

    expect(listarPaths(`tenants/${TENANT}/recursos`)).toHaveLength(2);
  });
});

// --- Clasificación y aprobación ------------------------------------------------------

describe('Integracion: un recurso solo se aprueba despues de clasificarlo', () => {
  it('rechaza aprobar un recurso sin ficha academica', async () => {
    const recurso = await importar();

    await expect(biblioteca.approveRecurso(TENANT, recurso.id, ADMIN))
      .rejects.toThrow(/sin ficha/i);

    expect(leerDoc(`tenants/${TENANT}/recursos/${recurso.id}`)?.estado).not.toBe('aprobado');
  });

  it('con ficha, la aprobacion persiste estado, autor y fecha', async () => {
    const recurso = await importar();
    await biblioteca.updateFicha(TENANT, recurso.id, fichaMinima as any);

    await biblioteca.approveRecurso(TENANT, recurso.id, ADMIN);

    const persistido = leerDoc(`tenants/${TENANT}/recursos/${recurso.id}`)!;
    expect(persistido.estado).toBe('aprobado');
    expect(persistido.aprobadoPorUid).toBe(ADMIN);
    expect(typeof persistido.aprobadoEn).toBe('string');
  });

  it('aprobar dos veces es idempotente: no falla ni reescribe el aprobador', async () => {
    const recurso = await importar();
    await biblioteca.updateFicha(TENANT, recurso.id, fichaMinima as any);
    await biblioteca.approveRecurso(TENANT, recurso.id, ADMIN);
    const primeraAprobacion = leerDoc(`tenants/${TENANT}/recursos/${recurso.id}`)!.aprobadoEn;

    await expect(biblioteca.approveRecurso(TENANT, recurso.id, 'otro-admin')).resolves.toBeUndefined();

    const persistido = leerDoc(`tenants/${TENANT}/recursos/${recurso.id}`)!;
    expect(persistido.aprobadoPorUid).toBe(ADMIN);
    expect(persistido.aprobadoEn).toBe(primeraAprobacion);
  });

  it('un recurso archivado ya no puede volver a aprobarse', async () => {
    const recurso = await importar();
    await biblioteca.updateFicha(TENANT, recurso.id, fichaMinima as any);
    // Regla de dominio: solo se archiva lo que ya estaba APROBADO
    // (bibliotecaService.archiveRecurso rechaza cualquier otro estado).
    await biblioteca.approveRecurso(TENANT, recurso.id, ADMIN);
    await biblioteca.archiveRecurso(TENANT, recurso.id);

    await expect(biblioteca.approveRecurso(TENANT, recurso.id, ADMIN))
      .rejects.toThrow(/Transición inválida|archivado/i);
  });

  it('aprobar un recurso inexistente falla explicitamente', async () => {
    await expect(biblioteca.approveRecurso(TENANT, 'recurso-fantasma', ADMIN))
      .rejects.toThrow(/no encontrado/i);
  });
});

// --- Listado de aprobados -------------------------------------------------------------

describe('Integracion: el listado de aprobados es lo que ve el flujo de publicacion', () => {
  it('solo devuelve los aprobados, no los pendientes ni los archivados', async () => {
    const aprobado = await importar({ fileId: 'drive-1', nombre: 'Aprobado.mp4' });
    await biblioteca.updateFicha(TENANT, aprobado.id, fichaMinima as any);
    await biblioteca.approveRecurso(TENANT, aprobado.id, ADMIN);

    const pendiente = await importar({ fileId: 'drive-2', nombre: 'Pendiente.mp4' });
    await biblioteca.updateFicha(TENANT, pendiente.id, fichaMinima as any);

    const archivado = await importar({ fileId: 'drive-3', nombre: 'Archivado.mp4' });
    await biblioteca.updateFicha(TENANT, archivado.id, fichaMinima as any);
    await biblioteca.approveRecurso(TENANT, archivado.id, ADMIN); // requisito para archivar
    await biblioteca.archiveRecurso(TENANT, archivado.id);

    const aprobados = await biblioteca.listarRecursosAprobados(TENANT);

    expect(aprobados.map((r) => r.id)).toEqual([aprobado.id]);
  });

  it('aisla por tenant', async () => {
    const propio = await importar();
    await biblioteca.updateFicha(TENANT, propio.id, fichaMinima as any);
    await biblioteca.approveRecurso(TENANT, propio.id, ADMIN);

    expect(await biblioteca.listarRecursosAprobados('tenant-ajeno')).toHaveLength(0);
    expect(await biblioteca.listarRecursosAprobados(TENANT)).toHaveLength(1);
  });
});

// --- La junta con la publicación de material -------------------------------------------

describe('Integracion: la salida de Biblioteca encaja con la entrada de la publicacion', () => {
  const asignacionBase = (recursoId: string) => ({
    id: 'asig-1',
    tenantId: TENANT,
    recursoId,
    titulo: 'Video Taeguk 1',
    destinatario: { tipo: 'grupo' as const, grupo: 'Infantil' },
    uso: 'estudio' as const,
    momento: 'preparacion' as const,
    obligatoria: true,
    estado: 'borrador' as const,
    creadoPorUid: ADMIN,
    creadoEn: '2026-07-01T00:00:00.000Z',
    actualizadoEn: '2026-07-01T00:00:00.000Z',
  });

  it('un recurso recien aprobado por Biblioteca es publicable', async () => {
    const recurso = await importar();
    // `youtubeVideoId` viaja como 5to parametro, separado de la ficha (igual que
    // `tituloVisible`) -- ver la firma de updateFicha.
    await biblioteca.updateFicha(TENANT, recurso.id, fichaMinima as any, 'Taeguk 1', 'yt-xyz');
    await biblioteca.approveRecurso(TENANT, recurso.id, ADMIN);

    const [aprobado] = await biblioteca.listarRecursosAprobados(TENANT);

    // publishAsignacion exige `recurso.estado === 'aprobado'` y copia sus identificadores.
    const publicada = publishAsignacion({
      asignacion: asignacionBase(aprobado.id) as any,
      recurso: aprobado,
      publicadoPorUid: ADMIN,
    });

    expect(publicada.estado).toBe('publicada');
    expect(publicada.externalFileId).toBe('drive-abc123');
    expect(publicada.youtubeVideoId).toBe('yt-xyz');
  });

  it('un recurso NO aprobado es rechazado por la publicacion', async () => {
    const recurso = await importar();
    await biblioteca.updateFicha(TENANT, recurso.id, fichaMinima as any);
    const sinAprobar = leerDoc(`tenants/${TENANT}/recursos/${recurso.id}`)!;

    expect(() => publishAsignacion({
      asignacion: asignacionBase(recurso.id) as any,
      recurso: { ...sinAprobar, id: recurso.id } as any,
      publicadoPorUid: ADMIN,
    })).toThrow(/recurso aprobado/i);
  });
});
