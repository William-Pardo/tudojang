import {
  resolveLinkedStudent,
  setMockEstudiantes,
  clearMockData
} from './tutorStudentResolver';
import { getDocs } from 'firebase/firestore';
import type { Estudiante } from '../../tipos';
import { GradoTKD, GrupoEdad, EstadoPago } from '../../tipos';

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => ({})),
  getDocs: jest.fn(),
  query: jest.fn(() => ({})),
  where: jest.fn()
}));

jest.mock('../../firebase/config', () => ({
  db: {},
  isFirebaseConfigured: true
}));

const baseEstudiante = (over: Partial<Estudiante>): Estudiante => ({
  id: 'est-1',
  tenantId: 'tenant-123',
  nombres: 'Alejandro',
  apellidos: 'Tester',
  numeroIdentificacion: '111',
  fechaNacimiento: '2015-01-01',
  grado: GradoTKD.Blanco,
  grupo: GrupoEdad.Infantil,
  horasAcumuladasGrado: 0,
  sedeId: 'sede-1',
  telefono: '3000000',
  correo: 'alejandro@test.com',
  fechaIngreso: '2024-01-01',
  estadoPago: EstadoPago.AlDia,
  saldoDeudor: 0,
  historialPagos: [],
  consentimientoInformado: true,
  contratoServiciosFirmado: true,
  consentimientoImagenFirmado: true,
  consentimientoFotosVideos: true,
  carnetGenerado: false,
  estadoMatricula: 'activo', // requerido en Estudiante (SDD pricing-cupo-real, Bloque 1)
  tutor: {
    nombres: 'Padre',
    apellidos: 'Tester',
    numeroIdentificacion: '999',
    telefono: '3195653135',
    correo: 'papa@test.com'
  },
  ...over
});

describe('tutorStudentResolver (resolución por email del tutor)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearMockData();
    (require('../../firebase/config') as any).isFirebaseConfigured = true;
  });

  describe('modo mock', () => {
    beforeEach(() => {
      (require('../../firebase/config') as any).isFirebaseConfigured = false;
    });

    it('resuelve el/los estudiante(s) donde tutor.correo == email del tutor', async () => {
      setMockEstudiantes([
        baseEstudiante({ id: 'est-1', tutor: { ...baseEstudiante({}).tutor!, correo: 'papa@test.com' } }),
        baseEstudiante({ id: 'est-2', tutor: { ...baseEstudiante({}).tutor!, correo: 'otro@test.com' } })
      ]);

      const res = await resolveLinkedStudent('tenant-123', 'papa@test.com');

      expect(res).toHaveLength(1);
      expect(res[0].id).toBe('est-1');
    });

    it('es case-insensitive en el email', async () => {
      setMockEstudiantes([
        baseEstudiante({ id: 'est-1', tutor: { ...baseEstudiante({}).tutor!, correo: 'Papa@Test.com' } })
      ]);

      const res = await resolveLinkedStudent('tenant-123', 'PAPA@test.COM');

      expect(res).toHaveLength(1);
      expect(res[0].id).toBe('est-1');
    });

    it('resuelve múltiples hijos del mismo tutor', async () => {
      setMockEstudiantes([
        baseEstudiante({ id: 'est-1', tutor: { ...baseEstudiante({}).tutor!, correo: 'papa@test.com' } }),
        baseEstudiante({ id: 'est-2', tutor: { ...baseEstudiante({}).tutor!, correo: 'papa@test.com' } })
      ]);

      const res = await resolveLinkedStudent('tenant-123', 'papa@test.com');

      expect(res).toHaveLength(2);
    });

    it('no cruza tenants', async () => {
      setMockEstudiantes([
        baseEstudiante({ id: 'est-1', tenantId: 'otro-tenant', tutor: { ...baseEstudiante({}).tutor!, correo: 'papa@test.com' } })
      ]);

      const res = await resolveLinkedStudent('tenant-123', 'papa@test.com');

      expect(res).toHaveLength(0);
    });

    it('retorna array vacío si el tutor no es acudiente de nadie (sin throw)', async () => {
      setMockEstudiantes([
        baseEstudiante({ id: 'est-1', tutor: { ...baseEstudiante({}).tutor!, correo: 'otro@test.com' } })
      ]);

      const res = await resolveLinkedStudent('tenant-123', 'papa@test.com');

      expect(res).toHaveLength(0);
    });
  });

  describe('modo Firebase', () => {
    it('consulta estudiantes por tutor.correo y filtra por tenant en cliente', async () => {
      (getDocs as jest.Mock).mockResolvedValue({
        empty: false,
        docs: [
          { id: 'est-1', data: () => baseEstudiante({ id: 'est-1', tenantId: 'tenant-123' }) },
          { id: 'est-9', data: () => baseEstudiante({ id: 'est-9', tenantId: 'otro-tenant' }) }
        ]
      });

      const res = await resolveLinkedStudent('tenant-123', 'papa@test.com');

      expect(res).toHaveLength(1);
      expect(res[0].id).toBe('est-1');
    });

    it('retorna vacío cuando la query no trae docs', async () => {
      (getDocs as jest.Mock).mockResolvedValue({ empty: true, docs: [] });

      const res = await resolveLinkedStudent('tenant-123', 'papa@test.com');

      expect(res).toHaveLength(0);
    });

    it('nunca lanza: ante un error de query retorna []', async () => {
      (getDocs as jest.Mock).mockRejectedValue(new Error('permission-denied'));

      const res = await resolveLinkedStudent('tenant-123', 'papa@test.com');

      expect(res).toHaveLength(0);
    });
  });

  it('retorna [] si falta tenantId o email', async () => {
    expect(await resolveLinkedStudent('', 'papa@test.com')).toHaveLength(0);
    expect(await resolveLinkedStudent('tenant-123', '')).toHaveLength(0);
  });
});
