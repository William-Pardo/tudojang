import { crearBibliotecaService, clearMockRecursos } from './bibliotecaService';

const bibliotecaService = crearBibliotecaService({ isFirebaseConfigured: false });

const TENANT_ID = 'tenant-test';
const ADMIN_UID = 'admin-001';

async function crearRecursoEnMock(overrides: {
  nombre?: string;
  ficha?: Record<string, unknown> | null;
} = {}): Promise<string> {
  const recurso = await bibliotecaService.importFromDrive(
    TENANT_ID,
    `file-${Date.now()}`,
    overrides.nombre ?? 'Recurso de prueba',
    'application/pdf',
    ADMIN_UID
  );
  if (overrides.ficha !== undefined) {
    await bibliotecaService.updateFicha(TENANT_ID, recurso.id, overrides.ficha as any);
  }
  return recurso.id;
}

describe('bibliotecaService.approveRecurso', () => {
  beforeEach(() => {
    clearMockRecursos();
  });

  it('rechaza aprobar un recurso sin ficha academica (ficha: null)', async () => {
    const recursoId = await crearRecursoEnMock({ ficha: null });
    await expect(
      bibliotecaService.approveRecurso(TENANT_ID, recursoId, ADMIN_UID)
    ).rejects.toThrow(/ficha acad.mica clasificada/i);
  });

  it('aprueba correctamente un recurso con ficha completa', async () => {
    const recursoId = await crearRecursoEnMock({
      ficha: {
        disciplina: 'Taekwondo',
        tipo: 'pdf',
        usos: ['estudio'],
        tags: ['fundamentos'],
      } as any,
    });

    await expect(
      bibliotecaService.approveRecurso(TENANT_ID, recursoId, ADMIN_UID)
    ).resolves.toBeUndefined();
  });

  it('approveRecurso es idempotente para un recurso ya aprobado', async () => {
    const recursoId = await crearRecursoEnMock({
      ficha: { disciplina: 'Taekwondo', tipo: 'pdf', usos: ['estudio'] } as any,
    });

    await bibliotecaService.approveRecurso(TENANT_ID, recursoId, ADMIN_UID);
    await expect(
      bibliotecaService.approveRecurso(TENANT_ID, recursoId, ADMIN_UID)
    ).resolves.toBeUndefined();
  });

  it('rechaza aprobar un recurso en estado archivado', async () => {
    const recursoId = await crearRecursoEnMock({
      ficha: { disciplina: 'Taekwondo', tipo: 'pdf', usos: ['estudio'] } as any,
    });

    await bibliotecaService.approveRecurso(TENANT_ID, recursoId, ADMIN_UID);
    await bibliotecaService.archiveRecurso(TENANT_ID, recursoId);

    await expect(
      bibliotecaService.approveRecurso(TENANT_ID, recursoId, ADMIN_UID)
    ).rejects.toThrow(/transici.n inv.lida/i);
  });
});
