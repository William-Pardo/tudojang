/**
 * PRUEBAS DE INTEGRACION — Clase en Vivo, checkpoint de materiales (WS-4a, §9).
 *
 * Los materiales de una jornada son las `asignaciones` con ese `jornadaId`. El servicio los
 * lista, marca su estado (planeado/usado/practicado/…) y los relee para el resumen de cierre.
 * Se mockea solo el SDK de Firestore: el servicio real corre contra el store en memoria.
 */

jest.mock('firebase/firestore', () => require('../../test-utils/fakeFirestore').crearApiFirestoreFake());

jest.mock('../../firebase/config', () => ({
  db: {}, auth: {}, storage: {}, messaging: null, app: {}, appCheck: null, isFirebaseConfigured: true,
}));

import { limpiarFirestoreFake, sembrarDoc, leerDoc, listarPaths } from '../../test-utils/fakeFirestore';
import { crearCheckpointMaterialService } from './checkpointMaterialService';
import { resumirCoberturaClase } from '../../models/academico/checkpointMaterial';

const TENANT = 'tenant-gajog';
const JORNADA = 'jor-1';
const MAESTRO = 'uid-maestro-1';

const servicio = crearCheckpointMaterialService({ isFirebaseConfigured: true });

// OJO: `jornadaId` opcional armado a mano (NO como default param) porque pasar `undefined` a un
// parametro con default dispara el default -- justo lo contrario de "material sin jornada".
const sembrarMaterial = (id: string, titulo: string, jornadaId?: string) => {
  const material: Record<string, unknown> = { id, tenantId: TENANT, titulo, recursoId: `rec-${id}`, estado: 'publicada' };
  if (jornadaId !== undefined) material.jornadaId = jornadaId;
  sembrarDoc(`tenants/${TENANT}/asignaciones/${id}`, material);
};

beforeEach(() => limpiarFirestoreFake());

describe('Integracion: listar los materiales asignados a la jornada', () => {
  it('devuelve solo las asignaciones con ESTE jornadaId', async () => {
    sembrarMaterial('asig-1', 'Taeguk 1', JORNADA);
    sembrarMaterial('asig-2', 'Patada frontal', JORNADA);
    sembrarMaterial('asig-otra', 'De otra clase', 'jor-otra');
    sembrarMaterial('asig-directa', 'Sin jornada');

    const materiales = await servicio.listarMaterialesDeJornada(TENANT, JORNADA);

    expect(materiales.map((m) => m.asignacionId).sort()).toEqual(['asig-1', 'asig-2']);
    expect(materiales.find((m) => m.asignacionId === 'asig-1')?.titulo).toBe('Taeguk 1');
  });
});

describe('Integracion: marcar y releer checkpoints', () => {
  it('guarda el estado y lo persiste en la subcoleccion de la jornada', async () => {
    await servicio.guardarCheckpoint(TENANT, JORNADA, { asignacionId: 'asig-1', estado: 'practicado' }, MAESTRO);

    const doc = leerDoc(`tenants/${TENANT}/jornadas/${JORNADA}/checkpointMateriales/asig-1`)!;
    expect(doc.estado).toBe('practicado');
    expect(doc.registradoPorUid).toBe(MAESTRO);
    expect(typeof doc.actualizadoEn).toBe('string');
  });

  it('re-marcar el MISMO material sobrescribe, no acumula', async () => {
    await servicio.guardarCheckpoint(TENANT, JORNADA, { asignacionId: 'asig-1', estado: 'planeado' }, MAESTRO);
    await servicio.guardarCheckpoint(TENANT, JORNADA, { asignacionId: 'asig-1', estado: 'usado' }, MAESTRO);

    expect(listarPaths(`tenants/${TENANT}/jornadas/${JORNADA}/checkpointMateriales`)).toHaveLength(1);
    const checkpoints = await servicio.listarCheckpoints(TENANT, JORNADA);
    expect(checkpoints).toHaveLength(1);
    expect(checkpoints[0].estado).toBe('usado');
  });

  it('trunca la nota corta al limite de caracteres', async () => {
    const notaLarga = 'a'.repeat(500);
    await servicio.guardarCheckpoint(TENANT, JORNADA, { asignacionId: 'asig-1', estado: 'parcial', notaCorta: notaLarga }, MAESTRO);

    const doc = leerDoc(`tenants/${TENANT}/jornadas/${JORNADA}/checkpointMateriales/asig-1`)!;
    expect(doc.notaCorta.length).toBe(280);
  });

  it('aisla por jornada: los checkpoints de una no aparecen en otra', async () => {
    await servicio.guardarCheckpoint(TENANT, JORNADA, { asignacionId: 'asig-1', estado: 'usado' }, MAESTRO);
    await servicio.guardarCheckpoint(TENANT, 'jor-2', { asignacionId: 'asig-9', estado: 'usado' }, MAESTRO);

    expect(await servicio.listarCheckpoints(TENANT, JORNADA)).toHaveLength(1);
    expect(await servicio.listarCheckpoints(TENANT, 'jor-2')).toHaveLength(1);
  });
});

describe('Integracion: el resumen de cierre cruza materiales asignados con checkpoints', () => {
  it('un material asignado SIN checkpoint aparece como sin_marcar (no cubierto)', async () => {
    sembrarMaterial('asig-1', 'Taeguk 1', JORNADA);
    sembrarMaterial('asig-2', 'Combate', JORNADA);
    await servicio.guardarCheckpoint(TENANT, JORNADA, { asignacionId: 'asig-1', estado: 'practicado' }, MAESTRO);

    const materiales = await servicio.listarMaterialesDeJornada(TENANT, JORNADA);
    const checkpoints = await servicio.listarCheckpoints(TENANT, JORNADA);
    const resumen = resumirCoberturaClase(materiales, checkpoints);

    expect(resumen.total).toBe(2);
    const asig2 = resumen.detalle.find((d) => d.asignacionId === 'asig-2');
    expect(asig2?.estado).toBe('sin_marcar');
    // 1 practicado (peso 1) + 1 sin_marcar (0) sobre 2 aplicables = 50%.
    expect(resumen.coberturaPorcentaje).toBe(50);
  });
});
