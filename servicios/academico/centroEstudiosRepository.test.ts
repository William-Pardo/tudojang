import {
  CentroEstudiosDemoRepository,
  prepararAsignacionesCentroEstudios,
} from './centroEstudiosRepository';
import { guardarProgresoQuizLocal } from '../../utils/academico/progresoLocal';
import type { AsignacionCentroEstudios } from '../../models/academico/asignacionService.types';

jest.mock('./asignacionService', () => {
  const actual = jest.requireActual('./asignacionService');
  return {
    ...actual,
    obtenerAsignacionesPorEstudiante: jest.fn(),
  };
});

import { obtenerAsignacionesPorEstudiante } from './asignacionService';

const mockObtenerAsignaciones = obtenerAsignacionesPorEstudiante as jest.Mock;

const base: AsignacionCentroEstudios = {
  id: 'base',
  tenantId: 'tenant-1',
  recursoId: 'recurso-1',
  titulo: 'Base',
  destinatario: { tipo: 'grupo', grupo: 'Infantil' },
  uso: 'estudio',
  momento: 'preparacion',
  obligatoria: true,
  fechaApertura: '2026-06-26T00:00:00.000Z',
  estado: 'publicada',
  creadoPorUid: 'admin',
  creadoEn: '2026-06-26T00:00:00.000Z',
  actualizadoEn: '2026-06-26T00:00:00.000Z',
  estadoProgreso: 'disponible',
  porcentajeProgreso: 0,
  urgencia: 'baja',
};

describe('centroEstudiosRepository', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  it('prepara asignaciones ordenadas y con progreso local aplicado', () => {
    guardarProgresoQuizLocal({
      tenantId: 'tenant-1',
      asignacionId: 'quiz-1',
      puntaje: 100,
      aprobado: true,
      intentosUsados: 1,
      estadoPostQuiz: 'aprobado',
      actualizadoEn: '2026-06-26T00:00:00.000Z',
    });

    const resultado = prepararAsignacionesCentroEstudios([
      { ...base, id: 'baja', titulo: 'Baja', urgencia: 'baja' },
      { ...base, id: 'quiz-1', titulo: 'Quiz', uso: 'evaluacion', urgencia: 'alta' },
    ]);

    expect(resultado.map((a) => a.id)).toEqual(['quiz-1', 'baja']);
    expect(resultado[0]).toMatchObject({
      estadoProgreso: 'aprobado',
      porcentajeProgreso: 100,
    });
  });

  it('usa el servicio actual como fuente de datos mientras se migra a Firestore', async () => {
    mockObtenerAsignaciones.mockResolvedValue({
      asignaciones: [{ ...base, id: 'a1', titulo: 'Asignación' }],
    });

    const repository = new CentroEstudiosDemoRepository();
    const respuesta = await repository.obtenerAsignaciones({
      tenantId: 'tenant-1',
      estudianteId: 'est-1',
    });

    expect(mockObtenerAsignaciones).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      estudianteId: 'est-1',
    });
    expect(respuesta.asignaciones).toHaveLength(1);
  });
});

describe('FirestoreCentroEstudiosRepository (TDD - RED)', () => {
  const mockEstudianteDoc = {
    id: 'est-1',
    tenantId: 'tenant-1',
    nombres: 'Juan',
    apellidos: 'Perez',
    grupo: 'Infantil',
    grado: 'Blanco',
  };

  const mockAsignacionesDocs = [
    {
      id: 'asig-1', // Válida: publicada, grupo infantil
      tenantId: 'tenant-1',
      estado: 'publicada',
      destinatario: { tipo: 'grupo', grupo: 'Infantil' },
      titulo: 'Asignacion 1',
    },
    {
      id: 'asig-2', // Inválida: otro grupo (Adultos)
      tenantId: 'tenant-1',
      estado: 'publicada',
      destinatario: { tipo: 'grupo', grupo: 'Adultos' },
      titulo: 'Asignacion 2',
    },
    {
      id: 'asig-3', // Inválida: borrador
      tenantId: 'tenant-1',
      estado: 'borrador',
      destinatario: { tipo: 'grupo', grupo: 'Infantil' },
      titulo: 'Asignacion 3',
    },
    {
      id: 'asig-4', // Inválida: estudiante específico no coincide
      tenantId: 'tenant-1',
      estado: 'publicada',
      destinatario: { tipo: 'estudiante', estudianteIds: ['est-2'] },
      titulo: 'Asignacion 4',
    },
    {
      id: 'asig-5', // Válida: estudiante específico coincide
      tenantId: 'tenant-1',
      estado: 'publicada',
      destinatario: { tipo: 'estudiante', estudianteIds: ['est-1'] },
      titulo: 'Asignacion 5',
    },
    {
      id: 'asig-6', // Válida: grado coincide
      tenantId: 'tenant-1',
      estado: 'publicada',
      destinatario: { tipo: 'grado', grupo: 'Infantil', grados: ['Blanco'] },
      titulo: 'Asignacion 6',
    },
    {
      id: 'asig-7', // Inválida: grado no coincide
      tenantId: 'tenant-1',
      estado: 'publicada',
      destinatario: { tipo: 'grado', grupo: 'Infantil', grados: ['Amarillo'] },
      titulo: 'Asignacion 7',
    },
  ];

  let depsMock: any;

  beforeEach(() => {
    depsMock = {
      db: 'db-mock',
      doc: jest.fn((...segments: string[]) => segments.join('/')),
      getDoc: jest.fn().mockResolvedValue({
        exists: () => true,
        data: () => mockEstudianteDoc,
      }),
      collection: jest.fn((...segments: string[]) => segments.join('/')),
      query: jest.fn((colRef: string, ...queryConstraints: any[]) => ({ colRef, queryConstraints })),
      where: jest.fn((field: string, op: string, val: any) => ({ field, op, val })),
      getDocs: jest.fn().mockImplementation((q: any) => {
        let docs = mockAsignacionesDocs;
        if (q && q.queryConstraints) {
          for (const constraint of q.queryConstraints) {
            if (constraint.field === 'estado' && constraint.op === '==' && constraint.val) {
              docs = docs.filter((d) => d.estado === constraint.val);
            }
          }
        }
        return Promise.resolve({
          docs: docs.map((doc) => ({
            id: doc.id,
            data: () => doc,
          })),
        });
      }),
    };
  });

  it('obtiene únicamente las asignaciones que corresponden al estudiante (tenant, grupo/grado y estado publicada)', async () => {
    // Al importar dinámicamente o usar el creador:
    const { crearCentroEstudiosRepository } = require('./centroEstudiosRepository');
    const repository = crearCentroEstudiosRepository({
      modo: 'firestore',
      firestoreDeps: depsMock,
    });

    const respuesta = await repository.obtenerAsignaciones({
      tenantId: 'tenant-1',
      estudianteId: 'est-1',
    });

    // 1. Validar que consulte al estudiante correcto
    expect(depsMock.doc).toHaveBeenCalledWith('db-mock', 'estudiantes', 'est-1');
    expect(depsMock.getDoc).toHaveBeenCalledWith('db-mock/estudiantes/est-1');

    // 2. Validar que consulte la colección de asignaciones bajo el tenant correcto
    expect(depsMock.collection).toHaveBeenCalledWith('db-mock', 'tenants', 'tenant-1', 'asignaciones');

    // 3. Validar que filtre por estado 'publicada' en la consulta Firestore
    expect(depsMock.where).toHaveBeenCalledWith('estado', '==', 'publicada');

    // 4. Validar el filtrado en memoria por destinatario
    // Solo deberían retornar: asig-1, asig-5, asig-6
    const idsRetornados = respuesta.asignaciones.map((a: any) => a.id);
    expect(idsRetornados).toContain('asig-1');
    expect(idsRetornados).toContain('asig-5');
    expect(idsRetornados).toContain('asig-6');
    expect(idsRetornados).not.toContain('asig-2');
    expect(idsRetornados).not.toContain('asig-3');
    expect(idsRetornados).not.toContain('asig-4');
    expect(idsRetornados).not.toContain('asig-7');
  });

  it('retorna lista vacía si el estudiante no existe en la base de datos', async () => {
    depsMock.getDoc.mockResolvedValue({
      exists: () => false,
      data: () => null,
    });

    const { crearCentroEstudiosRepository } = require('./centroEstudiosRepository');
    const repository = crearCentroEstudiosRepository({
      modo: 'firestore',
      firestoreDeps: depsMock,
    });

    const respuesta = await repository.obtenerAsignaciones({
      tenantId: 'tenant-1',
      estudianteId: 'est-1',
    });

    expect(respuesta.asignaciones).toHaveLength(0);
  });

  it('regresión: completa estadoProgreso/porcentajeProgreso/urgencia con defaults seguros (bug: crasheaba MaterialPreviewModal con "Cannot read properties of undefined (reading \'replace\')" al abrir una asignación real)', async () => {
    // Los docs reales de `tenants/{tenantId}/asignaciones` (mockAsignacionesDocs) son
    // AsignacionAcademica -- NUNCA traen estadoProgreso/porcentajeProgreso/urgencia,
    // esos campos son específicos de AsignacionCentroEstudios y antes de este fix
    // quedaban `undefined`, lo que hacía crashear `asignacion.estadoProgreso.replace(...)`
    // en el primer render real (no en el fixture demo, que sí los traía hardcodeados).
    const { crearCentroEstudiosRepository } = require('./centroEstudiosRepository');
    const repository = crearCentroEstudiosRepository({
      modo: 'firestore',
      firestoreDeps: depsMock,
    });

    const respuesta = await repository.obtenerAsignaciones({
      tenantId: 'tenant-1',
      estudianteId: 'est-1',
    });

    expect(respuesta.asignaciones.length).toBeGreaterThan(0);
    for (const asignacion of respuesta.asignaciones) {
      expect(asignacion.estadoProgreso).toBeDefined();
      expect(typeof asignacion.estadoProgreso).toBe('string');
      expect(asignacion.porcentajeProgreso).toBeDefined();
      expect(asignacion.urgencia).toBeDefined();
    }

    const asig1 = respuesta.asignaciones.find((a: any) => a.id === 'asig-1');
    expect(asig1).toMatchObject({ estadoProgreso: 'disponible', porcentajeProgreso: 0, urgencia: 'sin_fecha' });
  });
});

