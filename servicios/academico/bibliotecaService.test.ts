import { crearBibliotecaService, clearMockRecursos, RecursoNoPublicadoError } from './bibliotecaService';

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

describe('bibliotecaService.archiveRecurso — solo se archiva lo que ya se usó', () => {
  beforeEach(() => {
    clearMockRecursos();
  });

  it('rechaza archivar un recurso que nunca se publicó (recursoFuePublicado -> false)', async () => {
    const servicio = crearBibliotecaService({
      isFirebaseConfigured: false,
      recursoFuePublicado: async () => false,
    });
    const recurso = await servicio.importFromDrive(TENANT_ID, 'f1', 'R', 'application/pdf', ADMIN_UID);
    await servicio.updateFicha(TENANT_ID, recurso.id, { disciplina: 'TKD', tipo: 'pdf', usos: ['estudio'] } as any);
    await servicio.approveRecurso(TENANT_ID, recurso.id, ADMIN_UID);

    await expect(servicio.archiveRecurso(TENANT_ID, recurso.id)).rejects.toBeInstanceOf(RecursoNoPublicadoError);
  });

  it('archiva un recurso que sí se publicó (recursoFuePublicado -> true)', async () => {
    const servicio = crearBibliotecaService({
      isFirebaseConfigured: false,
      recursoFuePublicado: async () => true,
    });
    const recurso = await servicio.importFromDrive(TENANT_ID, 'f2', 'R', 'application/pdf', ADMIN_UID);
    await servicio.updateFicha(TENANT_ID, recurso.id, { disciplina: 'TKD', tipo: 'pdf', usos: ['estudio'] } as any);
    await servicio.approveRecurso(TENANT_ID, recurso.id, ADMIN_UID);

    await expect(servicio.archiveRecurso(TENANT_ID, recurso.id)).resolves.toBeUndefined();
  });
});

describe('bibliotecaService.updateFicha -- youtubeVideoId', () => {
  beforeEach(() => {
    clearMockRecursos();
  });

  it('guarda youtubeVideoId como campo adicional, sin tocar externalFileId', async () => {
    const recursoId = await crearRecursoEnMock({ nombre: 'clase-1.mp4' });

    await bibliotecaService.updateFicha(
      TENANT_ID,
      recursoId,
      { disciplina: 'Taekwondo', tipo: 'video', usos: ['estudio'] } as any,
      undefined,
      'dQw4w9WgXcQ'
    );

    // approveRecurso + listarRecursosAprobados exponen el objeto completo del recurso,
    // que es donde verificamos que el campo nuevo haya quedado guardado.
    await bibliotecaService.approveRecurso(TENANT_ID, recursoId, ADMIN_UID);
    const aprobados = await bibliotecaService.listarRecursosAprobados(TENANT_ID);
    const guardado = aprobados.find((r) => r.id === recursoId);

    expect(guardado?.youtubeVideoId).toBe('dQw4w9WgXcQ');
    expect(guardado?.externalFileId).toBeTruthy();
  });

  it('no pisa youtubeVideoId existente cuando se llama updateFicha sin pasar el parametro (undefined)', async () => {
    const recursoId = await crearRecursoEnMock({ nombre: 'clase-2.mp4' });

    await bibliotecaService.updateFicha(
      TENANT_ID,
      recursoId,
      { disciplina: 'Taekwondo', tipo: 'video', usos: ['estudio'] } as any,
      undefined,
      'dQw4w9WgXcQ'
    );

    // Segundo guardado (ej. solo cambia tags) sin tocar youtubeVideoId.
    await bibliotecaService.updateFicha(
      TENANT_ID,
      recursoId,
      { disciplina: 'Taekwondo', tipo: 'video', usos: ['estudio'], tags: ['nuevo-tag'] } as any
    );

    await bibliotecaService.approveRecurso(TENANT_ID, recursoId, ADMIN_UID);
    const aprobados = await bibliotecaService.listarRecursosAprobados(TENANT_ID);
    const guardado = aprobados.find((r) => r.id === recursoId);

    expect(guardado?.youtubeVideoId).toBe('dQw4w9WgXcQ');
  });

  it('permite borrar youtubeVideoId pasando null explicito (volver a usar Drive)', async () => {
    const recursoId = await crearRecursoEnMock({ nombre: 'clase-3.mp4' });

    await bibliotecaService.updateFicha(
      TENANT_ID,
      recursoId,
      { disciplina: 'Taekwondo', tipo: 'video', usos: ['estudio'] } as any,
      undefined,
      'dQw4w9WgXcQ'
    );
    await bibliotecaService.updateFicha(
      TENANT_ID,
      recursoId,
      { disciplina: 'Taekwondo', tipo: 'video', usos: ['estudio'] } as any,
      undefined,
      null
    );

    await bibliotecaService.approveRecurso(TENANT_ID, recursoId, ADMIN_UID);
    const aprobados = await bibliotecaService.listarRecursosAprobados(TENANT_ID);
    const guardado = aprobados.find((r) => r.id === recursoId);

    expect(guardado?.youtubeVideoId).toBeNull();
  });
});
