
// components/FormularioEstudiante.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificacionProvider } from '../context/NotificacionContext';
// FIX: Added 'expect' to the import from '@jest/globals' to resolve type inference issues with jest-dom matchers.
import { describe, it, jest, beforeEach, expect } from '@jest/globals';
import FormularioEstudiante from './FormularioEstudiante';
// Added GradoTKD to imports to fix missing properties in Estudiante mock object
import { GrupoEdad, EstadoPago, GradoTKD, type Estudiante } from '../tipos';
// Added DataProvider to provide necessary context for useSedes hook in FormularioEstudiante
import { DataProvider } from '../context/DataContext';

// Mock del hook de autosave
jest.mock('../hooks/useAutosave', () => ({
  useAutosave: () => ({
    status: 'idle',
    hasDraft: false,
    restoreDraft: jest.fn(),
    clearDraft: jest.fn(),
  }),
}));

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
  });

  it('renderiza el formulario para un nuevo estudiante', () => {
    renderComponent();
    expect(screen.getByText('Agregar Nuevo Estudiante')).toBeInTheDocument();
    expect(screen.getByLabelText(/Nombres/i)).toHaveValue('');
  });

  it('renderiza el formulario con los datos de un estudiante existente', () => {
    const estudianteActual: Estudiante = {
      id: '1',
      // Added fix: Include required 'tenantId' property in mock student.
      tenantId: 'escuela-gajog-001',
      nombres: 'Ana',
      apellidos: 'García',
      numeroIdentificacion: '12345',
      fechaNacimiento: '2010-01-01',
      // Added missing grado, horasAcumuladasGrado and sedeId properties to satisfy Estudiante type
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
      // Added carnetGenerado fix: carnetGenerado is required by Estudiante interface
      carnetGenerado: false,
    };
    renderComponent({ estudianteActual });
    
    expect(screen.getByText('Editar Estudiante')).toBeInTheDocument();
    expect(screen.getByLabelText(/Nombres/i)).toHaveValue('Ana');
    expect(screen.getByLabelText(/Apellidos/i)).toHaveValue('García');
  });

  it('muestra la sección del tutor si el estudiante es menor de edad', async () => {
    const user = userEvent.setup();
    renderComponent();
    
    const fechaNacimientoInput = screen.getByLabelText(/Fecha de Nacimiento/i);
    // Fecha que lo hace menor de 18
    await user.clear(fechaNacimientoInput);
    await user.type(fechaNacimientoInput, '2015-01-01');

    await waitFor(() => {
        expect(screen.getByText(/Datos del Tutor \(Obligatorio\)/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Nombres del Tutor/i)).toBeInTheDocument();
    });
  });

  it('valida campos requeridos y habilita el botón de guardar', async () => {
    const user = userEvent.setup();
    renderComponent();
    
    const guardarBtn = screen.getByRole('button', { name: /Guardar Estudiante/i });
    expect(guardarBtn).toBeDisabled();

    // Llenar campos requeridos para un mayor de edad
    await user.type(screen.getByLabelText(/Nombres/i), 'Juan');
    await user.type(screen.getByLabelText(/Apellidos/i), 'Perez');
    await user.type(screen.getByLabelText(/Número de Identificación/i), '123456');
    await user.type(screen.getByLabelText(/Fecha de Nacimiento/i), '2000-01-01');
    await user.type(screen.getByLabelText(/Correo Electrónico/i), 'juan.perez@test.com');
    // Select Sede which is now required in schema
    await user.selectOptions(screen.getByLabelText(/Sede/i), '1');
    
    await waitFor(() => {
        expect(guardarBtn).toBeEnabled();
    });
  });

  it('llama a onGuardar con los datos correctos al enviar el formulario', async () => {
    const user = userEvent.setup();
    renderComponent();
    
    await user.type(screen.getByLabelText(/Nombres/i), 'Carlos');
    await user.type(screen.getByLabelText(/Apellidos/i), 'Ruiz');
    await user.type(screen.getByLabelText(/Número de Identificación/i), '78910');
    await user.type(screen.getByLabelText(/Fecha de Nacimiento/i), '2001-01-01');
    await user.type(screen.getByLabelText(/Correo Electrónico/i), 'carlos.ruiz@test.com');
    // Select Sede which is now required in schema
    await user.selectOptions(screen.getByLabelText(/Sede/i), '1');


    const guardarBtn = screen.getByRole('button', { name: /Guardar Estudiante/i });
    
    await waitFor(() => expect(guardarBtn).toBeEnabled());
    await user.click(guardarBtn);

    await waitFor(() => {
      expect(onGuardarMock).toHaveBeenCalledTimes(1);
      expect(onGuardarMock).toHaveBeenCalledWith(
        expect.objectContaining({
          nombres: 'Carlos',
          apellidos: 'Ruiz',
          numeroIdentificacion: '78910',
        })
      );
    });
  });
});
