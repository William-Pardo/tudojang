import { registrarAsistenciaClase } from './asistenciaClaseService';

jest.mock('firebase/functions', () => ({
  getFunctions: jest.fn(() => 'functions-mock'),
  httpsCallable: jest.fn(),
}));

jest.mock('../../firebase/config', () => ({
  isFirebaseConfigured: true,
  db: 'db-mock',
}));

import { httpsCallable } from 'firebase/functions';

describe('asistenciaClaseService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('invoca el callable registrarAsistenciaJornada cuando Firebase esta configurado (check-in)', async () => {
    const callable = jest.fn().mockResolvedValue({
      data: { ok: true, tipo: 'entrada', hora: '2026-07-09T10:00:00.000Z' },
    });
    (httpsCallable as jest.Mock).mockReturnValue(callable);

    await expect(registrarAsistenciaClase({
      tenantId: 'tenant-1',
      jornadaId: 'jornada-1',
      estudianteId: 'estudiante-1',
    })).resolves.toEqual({ ok: true, tipo: 'entrada', hora: '2026-07-09T10:00:00.000Z' });

    expect(httpsCallable).toHaveBeenCalledWith('functions-mock', 'registrarAsistenciaJornada');
    expect(callable).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      jornadaId: 'jornada-1',
      estudianteId: 'estudiante-1',
    });
  });

  it('invoca el callable y devuelve minutosAsistidos en el check-out', async () => {
    const callable = jest.fn().mockResolvedValue({
      data: { ok: true, tipo: 'salida', hora: '2026-07-09T10:45:00.000Z', minutosAsistidos: 45 },
    });
    (httpsCallable as jest.Mock).mockReturnValue(callable);

    await expect(registrarAsistenciaClase({
      tenantId: 'tenant-1',
      jornadaId: 'jornada-1',
      estudianteId: 'estudiante-1',
    })).resolves.toEqual({ ok: true, tipo: 'salida', hora: '2026-07-09T10:45:00.000Z', minutosAsistidos: 45 });
  });

  it('propaga el error del callable (p.ej. estudiante no matriculado, fuera de ventana, etc.)', async () => {
    const callable = jest.fn().mockRejectedValue(new Error('permission-denied'));
    (httpsCallable as jest.Mock).mockReturnValue(callable);

    await expect(registrarAsistenciaClase({
      tenantId: 'tenant-1',
      jornadaId: 'jornada-1',
      estudianteId: 'estudiante-2',
    })).rejects.toThrow('permission-denied');
  });
});
