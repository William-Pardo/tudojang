import React from 'react';
import { render, screen } from '@testing-library/react';
import AsignacionesView from './AsignacionesView';
import type { RecursoAcademico } from '../../models/academico/recurso';
import type { JornadaRepository } from '../../servicios/academico/jornadaRepository';
import type { ProgramaRepository } from '../../servicios/academico/programaRepository';

// Fase 3.6 (rediseno minimalista del header "Clase activa" de "Publicar
// material", ver "CIERRE SDD CLAUDE CODE - CENTRO ESTUDIOS.md"): el usuario
// confirmo via screenshot anotado ("MANTENER ESTE MISMO DISENO") que el
// mockup de Figma para esta fila de navegacion de clase es: boton icono-only
// "<" (Clase anterior) -- "CLASE N DE M" centrado -- boton icono-only ">"
// (Clase siguiente), SIN la linea "Instructor: X . Grupo: Y". Este archivo
// es nuevo y aislado: no toca AsignacionesView.test.tsx (1017 lineas, sigue
// roto a proposito hasta la Fase 4).
jest.setTimeout(15000);

jest.mock('../../servicios/academico/bibliotecaService', () => ({
  listarRecursosAprobados: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    usuario: {
      id: 'maestro-real',
      tenantId: 'tenant-real',
      rol: 'Editor',
      email: 'maestro@test.com',
    },
  }),
}));

const materialA: RecursoAcademico = {
  id: 'recurso-a',
  tenantId: 'tenant-real',
  proveedor: 'google_drive',
  externalFileId: 'drive-a',
  nombre: 'Material A fundamentos',
  mimeType: 'application/pdf',
  ficha: { disciplina: 'Taekwondo', tipo: 'pdf', usos: ['estudio'], tags: ['infantil'] },
  estado: 'aprobado',
  creadoPorUid: 'admin',
  creadoEn: '2026-06-27T00:00:00.000Z',
  actualizadoEn: '2026-06-27T00:00:00.000Z',
};

// Fix 2026-07-21 (`npm run typecheck`): estas factories declaran devolver el repositorio
// COMPLETO pero implementan solo los metodos que la vista ejerce. Se cambia la anotacion
// por un cast explicito: documenta que es un fake parcial deliberado, en vez de mentir
// sobre cumplir la interfaz entera.
const crearRepoJornadaFake = () => ({
  guardarJornada: jest.fn().mockResolvedValue(undefined),
  guardarEjecucion: jest.fn().mockResolvedValue(undefined),
  registrarAuditoria: jest.fn().mockResolvedValue(undefined),
  existeConflictoHorario: jest.fn().mockResolvedValue(false),
  listarJornadasPorTenant: jest.fn().mockResolvedValue([]),
  guardarJornadasEnLote: jest.fn().mockResolvedValue(undefined),
  actualizarTemaJornada: jest.fn().mockResolvedValue(undefined),
} as unknown as JornadaRepository);

const crearRepoProgramaFake = (): ProgramaRepository => ({
  guardarPrograma: jest.fn().mockResolvedValue(undefined),
  listarProgramasPorTenant: jest.fn().mockResolvedValue([]),
} as unknown as ProgramaRepository);

const renderVista = () => render(
  <AsignacionesView
    embedded
    recursos={[materialA]}
    repositoryJornada={crearRepoJornadaFake()}
    repositoryPrograma={crearRepoProgramaFake()}
  />
);

describe('AsignacionesView - header "Clase activa" minimalista (Fase 3.6)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('muestra botones icono-only "Clase anterior"/"Clase siguiente" (sin texto visible) con "Clase N de M" centrado', async () => {
    renderVista();

    const botonAnterior = await screen.findByRole('button', { name: /^clase anterior$/i });
    const botonSiguiente = screen.getByRole('button', { name: /^clase siguiente$/i });

    // Icono-only: sin texto visible dentro del boton, con un svg adentro.
    expect(botonAnterior.textContent?.trim()).toBe('');
    expect(botonAnterior.querySelector('svg')).not.toBeNull();
    expect(botonSiguiente.textContent?.trim()).toBe('');
    expect(botonSiguiente.querySelector('svg')).not.toBeNull();

    expect(screen.getByText(/clase 1 de/i)).toBeInTheDocument();
  });

  it('ya no muestra la linea "Instructor: X . Grupo: Y" en el header de Clase activa', async () => {
    renderVista();

    await screen.findByRole('button', { name: /^clase anterior$/i });
    expect(screen.queryByText(/instructor:/i)).not.toBeInTheDocument();
  });
});
