
// components/FormularioEstudiante.test.tsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificacionProvider } from '../context/NotificacionContext';
import { describe, it, jest, beforeEach, expect } from '@jest/globals';
import FormularioEstudiante from './FormularioEstudiante';
import { GrupoEdad, EstadoPago, GradoTKD, type Estudiante } from '../tipos';
import { DataProvider } from '../context/DataContext';
import { useTenant } from '../components/BrandingProvider';

// Mock del contexto de Branding
jest.mock('../components/BrandingProvider', () => ({
  useTenant: jest.fn(),
}));

// Mock del hook de autosave
jest.mock('../hooks/useAutosave', () => ({
  useAutosave: () => ({
    status: 'idle',
    hasDraft: false,
    restoreDraft: jest.fn(),
    clearDraft: jest.fn(),
  }),
}));

const useTenantMock = useTenant as jest.Mock;

describe('FormularioEstudiante', () => {
  const onGuardarMock = jest.fn<(estudiante: Estudiante) => Promise<void>>().mockResolvedValue();
  const onCerrarMock = jest.fn();

  const renderComponent = (props: Partial<React.ComponentProps<typeof FormularioEstudiante>> = {}) => {
    const defaultProps: React.ComponentProps<typeof FormularioEstudiante> = {
      abierto: true,
      onCerrar: onCerrarMock,
      onGuardar: onGuardarMock,
      estudianteActual: null,
      cargando: false,
    };
    return render(
      <NotificacionProvider>
        <DataProvider>
          <FormularioEstudiante {...defaultProps} {...props} />
        </DataProvider>
      </NotificacionProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useTenantMock.mockReturnValue({
      tenant: {
        tenantId: 'test-tenant',
        nombreClub: 'Test Club',
        valorMensualidad: 50000,
        diasSuspension: 30
      },
      estaCargado: true
    });
  });

  it('renderiza el formulario para un nuevo estudiante', () => {
    renderComponent();
    expect(screen.getByText('Nuevo Registro Técnico')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('NOMBRES')).toHaveValue('');
  });

  it('renderiza el formulario con los datos de un estudiante existente', () => {
    const estudianteActual: Estudiante = {
      id: '1',
      tenantId: 'test-tenant',
      nombres: 'Ana',
      apellidos: 'García',
      numeroIdentificacion: '12345',
      fechaNacimiento: '2010-01-01',
      grado: GradoTKD.Blanco,
      grupo: GrupoEdad.Precadetes,
      horasAcumuladasGrado: 0,
      sedeId: '1',
      estadoPago: EstadoPago.AlDia,
      fechaIngreso: '2022-01-01',
      saldoDeudor: 0,
      historialPagos: [],
      consentimientoInformado: false,
      contratoServiciosFirmado: false,
      consentimientoImagenFirmado: false,
      consentimientoFotosVideos: false,
      telefono: '',
      correo: '',
      carnetGenerado: false,
    };
    renderComponent({ estudianteActual });

    expect(screen.getByText('Editar Ficha')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('NOMBRES')).toHaveValue('Ana');
    expect(screen.getByPlaceholderText('APELLIDOS')).toHaveValue('García');
  });

  it('valida campos requeridos y habilita el botón de finalizar', async () => {
    const user = userEvent.setup();
    renderComponent();

    const guardarBtn = screen.getByRole('button', { name: /Finalizar y Registrar/i });
    expect(guardarBtn).toBeDisabled();

    // Llenar campos requeridos
    await user.type(screen.getByPlaceholderText('NOMBRES'), 'Juan');
    await user.type(screen.getByPlaceholderText('APELLIDOS'), 'Perez');
    await user.type(screen.getByPlaceholderText('ID / DOCUMENTO'), '123456');
    await user.type(screen.getByLabelText('Nacimiento'), '2000-01-01');
    await user.selectOptions(screen.getByLabelText('Sede de Entrenamiento'), '1');

    await waitFor(() => {
      expect(guardarBtn).toBeEnabled();
    });
  });

  it('llama a onGuardar con los datos correctos al enviar el formulario', async () => {
    const user = userEvent.setup();
    renderComponent();

    await user.type(screen.getByPlaceholderText('NOMBRES'), 'Carlos');
    await user.type(screen.getByPlaceholderText('APELLIDOS'), 'Ruiz');
    await user.type(screen.getByPlaceholderText('ID / DOCUMENTO'), '78910');
    await user.type(screen.getByLabelText('Nacimiento'), '2001-01-01');
    await user.selectOptions(screen.getByLabelText('Sede de Entrenamiento'), '1');

    const guardarBtn = screen.getByRole('button', { name: /Finalizar y Registrar/i });

    await waitFor(() => expect(guardarBtn).toBeEnabled());
    await user.click(guardarBtn);

    await waitFor(() => {
      expect(onGuardarMock).toHaveBeenCalled();
    });
  });
});

