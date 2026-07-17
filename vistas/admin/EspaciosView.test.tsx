import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('../../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../servicios/academico/espacioRepository', () => ({
  espacioRepository: {
    listarEspaciosPorTenant: jest.fn(),
    guardarEspacio: jest.fn(),
  },
}));

import EspaciosView from './EspaciosView';
import { useAuth } from '../../context/AuthContext';
import { espacioRepository } from '../../servicios/academico/espacioRepository';
import type { EspacioFisico } from '../../models/academico/espacio';

const mockUseAuth = useAuth as jest.Mock;
const mockListar = espacioRepository.listarEspaciosPorTenant as jest.Mock;
const mockGuardar = espacioRepository.guardarEspacio as jest.Mock;

function espacioBase(overrides: Partial<EspacioFisico> = {}): EspacioFisico {
  const ahora = '2026-07-01T00:00:00.000Z';
  return {
    id: 'espacio-1',
    tenantId: 'tenant-x',
    sedeId: 'sede-x',
    nombre: 'Tatami principal',
    capacidad: 30,
    disciplinasPermitidas: ['taekwondo'],
    activo: true,
    creadoEn: ahora,
    actualizadoEn: ahora,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue({ usuario: { id: 'u1', tenantId: 'tenant-x', sedeId: 'sede-x' } });
  mockListar.mockResolvedValue([]);
  mockGuardar.mockResolvedValue(undefined);
});

describe('EspaciosView', () => {
  it('renderiza gestion de espacios por sede', async () => {
    render(<EspaciosView />);

    expect(await screen.findByRole('heading', { name: /espacios fisicos/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/nombre del espacio/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/capacidad/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /crear espacio/i })).toBeInTheDocument();
  });

  it('carga los espacios reales del tenant al montar (no un demo local)', async () => {
    mockListar.mockResolvedValue([espacioBase({ nombre: 'Tatami cargado', capacidad: 25 })]);

    render(<EspaciosView />);

    expect(await screen.findByText('Tatami cargado')).toBeInTheDocument();
    expect(screen.getByText(/capacidad: 25/i)).toBeInTheDocument();
    // Debe usar el tenant real del usuario autenticado, no 'tenant-demo'.
    expect(mockListar).toHaveBeenCalledWith('tenant-x');
  });

  it('crea y PERSISTE un espacio con el tenant y la sede del usuario', async () => {
    const store: EspacioFisico[] = [];
    mockGuardar.mockImplementation(async (e: EspacioFisico) => { store.push(e); });
    mockListar.mockImplementation(async () => [...store]);

    const user = userEvent.setup();
    render(<EspaciosView />);

    await user.clear(screen.getByLabelText(/nombre del espacio/i));
    await user.type(screen.getByLabelText(/nombre del espacio/i), 'Tatami auxiliar');
    await user.clear(screen.getByLabelText(/capacidad/i));
    await user.type(screen.getByLabelText(/capacidad/i), '15');
    await user.click(screen.getByRole('button', { name: /crear espacio/i }));

    // El espacio aparece porque se persistio y se recargo la lista real (no setState demo).
    expect(await screen.findByText('Tatami auxiliar')).toBeInTheDocument();
    expect(screen.getByText(/capacidad: 15/i)).toBeInTheDocument();

    expect(mockGuardar).toHaveBeenCalledTimes(1);
    const guardado = mockGuardar.mock.calls[0][0] as EspacioFisico;
    expect(guardado.tenantId).toBe('tenant-x');
    expect(guardado.sedeId).toBe('sede-x');
    expect(guardado.nombre).toBe('Tatami auxiliar');
    expect(guardado.capacidad).toBe(15);
  });

  it('muestra conflicto visual cuando hay reserva superpuesta', async () => {
    const user = userEvent.setup();
    render(<EspaciosView />);

    await user.click(screen.getByRole('button', { name: /probar horario con conflicto/i }));

    expect(screen.getByText(/conflicto detectado/i)).toBeInTheDocument();
    expect(screen.getByText(/jornada existente/i)).toBeInTheDocument();
  });
});
