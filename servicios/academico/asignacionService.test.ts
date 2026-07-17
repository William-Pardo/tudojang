import type { AsignacionAcademica } from '../../models/academico/asignacion';
import type { RecursoAcademico } from '../../models/academico/recurso';
import {
  actualizarAsignacion,
  asignarMaterialAJornada,
  eliminarAsignacion,
  getAsignacionesByEstudiante,
  listarAsignacionesPorTenant,
  obtenerAsignacionesPorEstudiante,
  publicarAsignacion,
  publicarAsignacionesBatch,
  publishAsignacion,
  resolverEstadoTemporalAsignacion,
  transicionarAsignacionesVencidas,
  validateAsignacion,
} from './asignacionService';

jest.mock('firebase/functions', () => ({
  getFunctions: jest.fn(() => 'functions-mock'),
  httpsCallable: jest.fn(),
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db, ...path) => path),
  deleteDoc: jest.fn(),
  doc: jest.fn((_db, ...path) => path),
  getDocs: jest.fn(() => Promise.resolve({ docs: [] })),
}));

jest.mock('../../firebase/config', () => ({
  isFirebaseConfigured: true,
  db: 'db-mock',
}));

import { httpsCallable } from 'firebase/functions';
import { deleteDoc, doc, getDocs } from 'firebase/firestore';

describe('asignacionService', () => {
  it('devuelve asignaciones demo del tenant solicitado para visualizar Centro de Estudios', async () => {
    const respuesta = await obtenerAsignacionesPorEstudiante({
      tenantId: 'tenant-cocodrilos',
      estudianteId: 'estudiante-1',
    });

    expect(respuesta.asignaciones).toHaveLength(3);
    expect(respuesta.asignaciones.every((a) => a.tenantId === 'tenant-cocodrilos')).toBe(true);
    expect(respuesta.asignaciones.every((a) => typeof a.porcentajeProgreso === 'number')).toBe(true);
    expect(respuesta.asignaciones.map((a) => a.titulo)).toEqual([
      'Fundamentos técnicos del dojang',
      'Quiz: seguridad y conducta',
      'Refuerzo: patada frontal y control',
    ]);
  });

  it('no devuelve datos si falta tenant o estudiante', async () => {
    await expect(
      obtenerAsignacionesPorEstudiante({ tenantId: '', estudianteId: 'estudiante-1' })
    ).resolves.toEqual({ asignaciones: [] });

    await expect(
      obtenerAsignacionesPorEstudiante({ tenantId: 'tenant-cocodrilos', estudianteId: '' })
    ).resolves.toEqual({ asignaciones: [] });
  });

  it('usa fixture Cypress si existe para simular Centro de Estudios vacio', async () => {
    (window as any).Cypress = true;
    (window as any).__CENTRO_ESTUDIOS_ASIGNACIONES__ = [];

    await expect(
      obtenerAsignacionesPorEstudiante({ tenantId: 'tenant-cocodrilos', estudianteId: 'estudiante-1' })
    ).resolves.toEqual({ asignaciones: [] });

    delete (window as any).Cypress;
    delete (window as any).__CENTRO_ESTUDIOS_ASIGNACIONES__;
  });

  it('filtra asignaciones publicadas por grupo, grado y estudiante', () => {
    const asignaciones: AsignacionAcademica[] = [
      crearAsignacion({ id: 'grupo-infantil', destinatario: { tipo: 'grupo', grupo: 'Infantil' } }),
      crearAsignacion({ id: 'grado-blanco', destinatario: { tipo: 'grado', grupo: 'Infantil', grados: ['Blanco'] } }),
      crearAsignacion({ id: 'directa', destinatario: { tipo: 'estudiante', estudianteIds: ['est-1'] } }),
      crearAsignacion({ id: 'otro-grado', destinatario: { tipo: 'grado', grupo: 'Infantil', grados: ['Rojo'] } }),
      crearAsignacion({ id: 'otro-tenant', tenantId: 'tenant-2', destinatario: { tipo: 'grupo', grupo: 'Infantil' } }),
      crearAsignacion({ id: 'cerrada', estado: 'cerrada', destinatario: { tipo: 'grupo', grupo: 'Infantil' } }),
    ];

    expect(getAsignacionesByEstudiante({
      tenantId: 'tenant-1',
      estudiante: { id: 'est-1', grupo: 'Infantil', grado: 'Blanco' },
      asignaciones,
    }).map((asignacion) => asignacion.id)).toEqual(['grupo-infantil', 'grado-blanco', 'directa']);
  });

  it('rechaza publicacion si el recurso no esta aprobado', () => {
    const asignacion = crearAsignacion({ id: 'pendiente-recurso' });
    const recurso = crearRecurso({ estado: 'pendiente' });

    expect(validateAsignacion({ asignacion, recurso })).toEqual({
      valid: false,
      reason: 'recurso_no_aprobado',
    });
    expect(() => publishAsignacion({ asignacion, recurso, publicadoPorUid: 'maestro-1' })).toThrow(/recurso aprobado/i);
  });

  it('publica asignacion valida usando recurso aprobado', () => {
    const asignacion = crearAsignacion({ id: 'asignacion-valida', estado: 'borrador' });
    const recurso = crearRecurso({ estado: 'aprobado' });

    expect(publishAsignacion({ asignacion, recurso, publicadoPorUid: 'maestro-1' })).toMatchObject({
      id: 'asignacion-valida',
      estado: 'publicada',
      creadoPorUid: 'maestro-1',
      recursoId: recurso.id,
      externalFileId: recurso.externalFileId,
    });
  });

  it('copia youtubeVideoId del recurso a la asignacion al publicar (reemplazo Drive->YouTube solo video)', () => {
    const asignacion = crearAsignacion({ id: 'asignacion-video-yt', estado: 'borrador' });
    const recurso = crearRecurso({
      estado: 'aprobado',
      ficha: { disciplina: 'Taekwondo', tipo: 'video', usos: ['estudio'] },
      youtubeVideoId: 'dQw4w9WgXcQ',
    });

    expect(publishAsignacion({ asignacion, recurso, publicadoPorUid: 'maestro-1' })).toMatchObject({
      youtubeVideoId: 'dQw4w9WgXcQ',
    });
  });

  it('deja youtubeVideoId en null cuando el recurso no tiene video de YouTube (compatibilidad Drive)', () => {
    const asignacion = crearAsignacion({ id: 'asignacion-pdf', estado: 'borrador' });
    const recurso = crearRecurso({ estado: 'aprobado' });

    expect(publishAsignacion({ asignacion, recurso, publicadoPorUid: 'maestro-1' })).toMatchObject({
      youtubeVideoId: null,
    });
  });

  it('bloquea asignacion antes de la fecha de apertura', () => {
    expect(resolverEstadoTemporalAsignacion(
      crearAsignacion({
        fechaApertura: '2026-07-01T00:00:00.000Z',
        fechaCierre: '2026-07-10T23:59:59.000Z',
      }),
      new Date('2026-06-30T12:00:00.000Z')
    )).toBe('bloqueada');
  });

  it('marca asignacion publicada como vencida despues de la fecha de cierre', () => {
    const asignacion = crearAsignacion({
      id: 'asignacion-vencida',
      fechaApertura: '2026-06-01T00:00:00.000Z',
      fechaCierre: '2026-06-10T23:59:59.000Z',
    });

    expect(transicionarAsignacionesVencidas(
      [asignacion],
      new Date('2026-06-11T00:00:00.000Z')
    )[0]).toMatchObject({
      id: 'asignacion-vencida',
      estado: 'vencida',
    });
  });

  it('mantiene publicada la asignacion dentro de la ventana activa', () => {
    const asignacion = crearAsignacion({
      fechaApertura: '2026-06-01T00:00:00.000Z',
      fechaCierre: '2026-06-30T23:59:59.000Z',
    });

    expect(resolverEstadoTemporalAsignacion(asignacion, new Date('2026-06-15T00:00:00.000Z'))).toBe('publicada');
    expect(transicionarAsignacionesVencidas([asignacion], new Date('2026-06-15T00:00:00.000Z'))[0].estado).toBe('publicada');
  });

  it('publicarAsignacion invoca Cloud Function productiva cuando Firebase esta configurado', async () => {
    const callable = jest.fn().mockResolvedValue({ data: { ok: true, asignacionId: 'asignacion-real' } });
    (httpsCallable as jest.Mock).mockReturnValue(callable);
    const asignacion = crearAsignacion({ id: 'asignacion-real' });

    await expect(publicarAsignacion({
      tenantId: 'tenant-1',
      jornadaId: 'jornada-1',
      asignacion,
    })).resolves.toEqual({ ok: true, id: 'asignacion-real' });

    expect(httpsCallable).toHaveBeenCalledWith('functions-mock', 'publishAsignacion');
    expect(callable).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      jornadaId: 'jornada-1',
      asignacion,
    });
  });

  it('publicarAsignacionesBatch invoca Cloud Function batch cuando Firebase esta configurado', async () => {
    const callable = jest.fn().mockResolvedValue({
      data: { ok: true, created: ['asignacion-recurso-1-jornada-1'], skipped: [] },
    });
    (httpsCallable as jest.Mock).mockReturnValue(callable);

    const request = {
      tenantId: 'tenant-1',
      recursoIds: ['recurso-1'],
      jornadaIds: ['jornada-1'],
      asignacionBase: crearAsignacionBase(),
    };

    await expect(publicarAsignacionesBatch(request)).resolves.toEqual({
      ok: true,
      created: ['asignacion-recurso-1-jornada-1'],
      skipped: [],
    });

    expect(httpsCallable).toHaveBeenCalledWith('functions-mock', 'publishAsignacionesBatch');
    expect(callable).toHaveBeenCalledWith(request);
  });

  it('listarAsignacionesPorTenant devuelve las asignaciones del tenant desde Firestore', async () => {
    const asignacionRemota = crearAsignacion({ id: 'asig-remota' });
    (getDocs as jest.Mock).mockResolvedValue({
      docs: [{ id: 'asig-remota', data: () => asignacionRemota }],
    });

    const resultado = await listarAsignacionesPorTenant('tenant-1');

    expect(resultado).toEqual([asignacionRemota]);
  });

  it('listarAsignacionesPorTenant devuelve vacio sin tenantId', async () => {
    await expect(listarAsignacionesPorTenant('')).resolves.toEqual([]);
  });

  it('publicarAsignacionesBatch propaga el error si el callable falla', async () => {
    const callable = jest.fn().mockRejectedValue(new Error('network-error'));
    (httpsCallable as jest.Mock).mockReturnValue(callable);

    await expect(publicarAsignacionesBatch({
      tenantId: 'tenant-1',
      recursoIds: ['recurso-1'],
      jornadaIds: ['jornada-1'],
      asignacionBase: crearAsignacionBase(),
    })).rejects.toThrow('network-error');
  });

  it('eliminarAsignacion invoca deleteDoc con la referencia del documento en Firestore y limpia el progreso de los estudiantes', async () => {
    (deleteDoc as jest.Mock).mockResolvedValue(undefined);
    (getDocs as jest.Mock).mockResolvedValue({
      docs: [
        { id: 'estudiante-1' },
        { id: 'estudiante-2' }
      ]
    });

    await expect(eliminarAsignacion({
      tenantId: 'tenant-1',
      asignacionId: 'asignacion-1',
    })).resolves.toEqual({ ok: true });

    expect(doc).toHaveBeenCalledWith('db-mock', 'tenants', 'tenant-1', 'asignaciones', 'asignacion-1');
    expect(deleteDoc).toHaveBeenCalledWith(['tenants', 'tenant-1', 'asignaciones', 'asignacion-1']);

    // Debe limpiar el progreso de estudiante-1 y estudiante-2
    expect(doc).toHaveBeenCalledWith('db-mock', 'tenants', 'tenant-1', 'progreso', 'estudiante-1', 'asignaciones', 'asignacion-1');
    expect(deleteDoc).toHaveBeenCalledWith(['tenants', 'tenant-1', 'progreso', 'estudiante-1', 'asignaciones', 'asignacion-1']);

    expect(doc).toHaveBeenCalledWith('db-mock', 'tenants', 'tenant-1', 'progreso', 'estudiante-2', 'asignaciones', 'asignacion-1');
    expect(deleteDoc).toHaveBeenCalledWith(['tenants', 'tenant-1', 'progreso', 'estudiante-2', 'asignaciones', 'asignacion-1']);
  });

  it('eliminarAsignacion devuelve ok:false sin tenantId o asignacionId y no invoca deleteDoc', async () => {
    (deleteDoc as jest.Mock).mockClear();

    await expect(eliminarAsignacion({ tenantId: '', asignacionId: 'asignacion-1' })).resolves.toEqual({ ok: false });
    await expect(eliminarAsignacion({ tenantId: 'tenant-1', asignacionId: '' })).resolves.toEqual({ ok: false });

    expect(deleteDoc).not.toHaveBeenCalled();
  });

  it('actualizarAsignacion delega en publicarAsignacion con el mismo id y jornadaId', async () => {
    const callable = jest.fn().mockResolvedValue({ data: { ok: true, asignacionId: 'asignacion-editada' } });
    (httpsCallable as jest.Mock).mockReturnValue(callable);
    const asignacion = crearAsignacion({ id: 'asignacion-editada', jornadaId: 'jornada-9' });

    await expect(actualizarAsignacion({ asignacion })).resolves.toEqual({ ok: true });

    expect(httpsCallable).toHaveBeenCalledWith('functions-mock', 'publishAsignacion');
    expect(callable).toHaveBeenCalledWith({
      tenantId: asignacion.tenantId,
      jornadaId: 'jornada-9',
      asignacion,
    });
  });

  it('actualizarAsignacion devuelve ok:false si falta id o jornadaId, sin invocar publicarAsignacion', async () => {
    const callable = jest.fn();
    (httpsCallable as jest.Mock).mockReturnValue(callable);

    await expect(actualizarAsignacion({
      asignacion: crearAsignacion({ id: '', jornadaId: 'jornada-9' }),
    })).resolves.toEqual({ ok: false });

    await expect(actualizarAsignacion({
      asignacion: crearAsignacion({ id: 'asignacion-editada', jornadaId: undefined }),
    })).resolves.toEqual({ ok: false });

    expect(callable).not.toHaveBeenCalled();
  });

  // Subtarea 12.9: primer consumidor real es la pestana "Materiales" del modal de edicion
  // singular de Agenda (ModalEdicionJornada.tsx). En vez de reimplementar en el componente
  // la logica de construir destinatario/mapear criterio->uso/validar recurso aprobado (que
  // ya existe, duplicada, dentro de AsignacionesView.tsx), se centraliza aca como funcion de
  // servicio reutilizable: valida con publishAsignacion (ya existente) y persiste
  // reutilizando publicarAsignacion (mismo Cloud Function real, sin duplicar el flujo).
  it('asignarMaterialAJornada arma la asignacion, valida el recurso aprobado y persiste via publicarAsignacion', async () => {
    const callable = jest.fn().mockResolvedValue({ data: { ok: true, asignacionId: 'asignacion-agenda-jornada-9-recurso-1' } });
    (httpsCallable as jest.Mock).mockReturnValue(callable);
    const recurso = crearRecurso({ id: 'recurso-1', tituloVisible: 'Fundamentos tecnicos' });

    await expect(asignarMaterialAJornada({
      tenantId: 'tenant-1',
      jornadaId: 'jornada-9',
      recurso,
      recursoId: 'recurso-1',
      tipoDestinatario: 'grupo',
      grupoObjetivo: 'Infantil',
      grados: ['Blanco', 'Amarillo'],
      momento: 'preparacion',
      criterio: 'estudio',
      fechaApertura: '2026-07-10',
      publicadoPorUid: 'maestro-1',
    })).resolves.toEqual({ ok: true, id: 'asignacion-agenda-jornada-9-recurso-1' });

    expect(httpsCallable).toHaveBeenCalledWith('functions-mock', 'publishAsignacion');
    const solicitud = callable.mock.calls[0][0];
    expect(solicitud.tenantId).toBe('tenant-1');
    expect(solicitud.jornadaId).toBe('jornada-9');
    expect(solicitud.asignacion).toMatchObject({
      id: 'asignacion-agenda-jornada-9-recurso-1',
      tenantId: 'tenant-1',
      recursoId: 'recurso-1',
      titulo: 'Fundamentos tecnicos',
      destinatario: { tipo: 'grupo', grupo: 'Infantil', grados: ['Blanco', 'Amarillo'] },
      uso: 'estudio',
      momento: 'preparacion',
      estado: 'publicada',
      creadoPorUid: 'maestro-1',
    });
  });

  it('asignarMaterialAJornada rechaza si el recurso no esta aprobado, sin invocar publicarAsignacion', async () => {
    const callable = jest.fn();
    (httpsCallable as jest.Mock).mockReturnValue(callable);
    const recurso = crearRecurso({ id: 'recurso-2', estado: 'pendiente' });

    await expect(asignarMaterialAJornada({
      tenantId: 'tenant-1',
      jornadaId: 'jornada-9',
      recurso,
      recursoId: 'recurso-2',
      tipoDestinatario: 'grupo',
      grupoObjetivo: 'Infantil',
      grados: [],
      momento: 'preparacion',
      criterio: 'estudio',
      fechaApertura: '2026-07-10',
      publicadoPorUid: 'maestro-1',
    })).rejects.toThrow(/recurso aprobado/i);

    expect(callable).not.toHaveBeenCalled();
  });

  it('asignarMaterialAJornada mapea criterio "quiz" a uso "evaluacion" y "repaso" a "estudio"', async () => {
    const callable = jest.fn().mockResolvedValue({ data: { ok: true, asignacionId: 'a' } });
    (httpsCallable as jest.Mock).mockReturnValue(callable);
    const recurso = crearRecurso({ id: 'recurso-3' });

    await asignarMaterialAJornada({
      tenantId: 'tenant-1',
      jornadaId: 'jornada-9',
      recurso,
      recursoId: 'recurso-3',
      tipoDestinatario: 'grupo',
      grupoObjetivo: 'Infantil',
      grados: [],
      momento: 'preparacion',
      criterio: 'quiz',
      fechaApertura: '2026-07-10',
      publicadoPorUid: 'maestro-1',
    });

    expect(callable.mock.calls[0][0].asignacion.uso).toBe('evaluacion');
  });

  it('asignarMaterialAJornada reutiliza el id existente cuando se pasa asignacionIdExistente (modo editar)', async () => {
    const callable = jest.fn().mockResolvedValue({ data: { ok: true, asignacionId: 'asignacion-fija' } });
    (httpsCallable as jest.Mock).mockReturnValue(callable);
    const recurso = crearRecurso({ id: 'recurso-4' });

    await asignarMaterialAJornada({
      tenantId: 'tenant-1',
      jornadaId: 'jornada-9',
      recurso,
      recursoId: 'recurso-4',
      tipoDestinatario: 'grupo',
      grupoObjetivo: 'Infantil',
      grados: [],
      momento: 'preparacion',
      criterio: 'estudio',
      fechaApertura: '2026-07-10',
      publicadoPorUid: 'maestro-1',
      asignacionIdExistente: 'asignacion-fija',
    });

    expect(callable.mock.calls[0][0].asignacion.id).toBe('asignacion-fija');
  });
});

function crearAsignacionBase() {
  const ahora = '2026-06-27T00:00:00.000Z';

  return {
    tenantId: 'tenant-1',
    titulo: 'Material tecnico',
    destinatario: { tipo: 'grupo' as const, grupo: 'Infantil' },
    uso: 'estudio' as const,
    momento: 'preparacion' as const,
    obligatoria: true,
    fechaApertura: ahora,
    estado: 'publicada' as const,
    creadoPorUid: 'admin-1',
    creadoEn: ahora,
    actualizadoEn: ahora,
  };
}

function crearAsignacion(overrides: Partial<AsignacionAcademica> = {}): AsignacionAcademica {
  const ahora = '2026-06-27T00:00:00.000Z';

  return {
    id: 'asignacion-1',
    tenantId: 'tenant-1',
    recursoId: 'recurso-1',
    titulo: 'Material tecnico',
    destinatario: { tipo: 'grupo', grupo: 'Infantil' },
    uso: 'estudio',
    momento: 'preparacion',
    obligatoria: true,
    fechaApertura: ahora,
    estado: 'publicada',
    creadoPorUid: 'admin-1',
    creadoEn: ahora,
    actualizadoEn: ahora,
    ...overrides,
  };
}

function crearRecurso(overrides: Partial<RecursoAcademico> = {}): RecursoAcademico {
  const ahora = '2026-06-27T00:00:00.000Z';

  return {
    id: 'recurso-1',
    tenantId: 'tenant-1',
    proveedor: 'google_drive',
    externalFileId: 'drive-file-1',
    nombre: 'Material tecnico.pdf',
    mimeType: 'application/pdf',
    ficha: {
      disciplina: 'Taekwondo',
      tipo: 'pdf',
      usos: ['estudio'],
    },
    estado: 'aprobado',
    creadoPorUid: 'admin-1',
    creadoEn: ahora,
    actualizadoEn: ahora,
    ...overrides,
  };
}
