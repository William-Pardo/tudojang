
let mockSedesVisibles = [{ id: '1', nombre: 'Sede Test', ciudad: 'Ciudad Test', esVisible: true }];
let mockProgramas: any[] = [];
let mockConfigClub: any = {
  tenantId: 'test-tenant',
  nombreClub: 'Test Club',
  valorMensualidad: 50000,
  diasSuspension: 30,
  valorMatricula: 10000,
  activarMatriculaAnual: true
};

// Mock del contexto de DataContext para evitar llamadas reales a Firebase y proveer sedes mockeadas
jest.mock('../context/DataContext', () => ({
  DataProvider: ({ children }: any) => <>{children}</>,
  useSedes: () => ({
    sedes: mockSedesVisibles,
    sedesVisibles: mockSedesVisibles,
    totalSedesActivas: 1,
    eliminarSede: jest.fn(),
    agregarSede: jest.fn(),
    actualizarSede: jest.fn()
  }),
  useProgramas: () => ({
    programas: mockProgramas
  }),
  useConfiguracion: () => ({
    configClub: mockConfigClub
  })
}));

// Mock del contexto de Branding
jest.mock('../components/BrandingProvider', () => ({
  useTenant: jest.fn(),
}));

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificacionProvider } from '../context/NotificacionContext';
import { describe, it, jest, beforeEach, expect } from '@jest/globals';
import FormularioEstudiante, { calcularEdadYGrupo } from './FormularioEstudiante';
import { GrupoEdad, EstadoPago, GradoTKD, type Estudiante } from '../tipos';
import { DataProvider } from '../context/DataContext';
import { useTenant } from '../components/BrandingProvider';

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
    mockSedesVisibles = [{ id: '1', nombre: 'Sede Test', ciudad: 'Ciudad Test', esVisible: true }];
    mockProgramas = [];
    mockConfigClub = {
      tenantId: 'test-tenant',
      nombreClub: 'Test Club',
      valorMensualidad: 50000,
      diasSuspension: 30,
      valorMatricula: 10000,
      activarMatriculaAnual: true
    };
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
    await user.selectOptions(screen.getByLabelText(/Sede de Entrenamiento/i), '1');

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
    await user.selectOptions(screen.getByLabelText(/Sede de Entrenamiento/i), '1');

    const guardarBtn = screen.getByRole('button', { name: /Finalizar y Registrar/i });

    await waitFor(() => expect(guardarBtn).toBeEnabled());
    await user.click(guardarBtn);

    await waitFor(() => {
      expect(onGuardarMock).toHaveBeenCalled();
    });
  });

  it.each([
    [5, GrupoEdad.Infantil],
    [10, GrupoEdad.Precadetes],
    [15, GrupoEdad.Cadetes],
    [30, GrupoEdad.Adultos],
  ])('actualiza automáticamente el grupo para una edad de %i años', async (edad, grupoEsperado) => {
    const user = userEvent.setup();
    renderComponent();
    const hoy = new Date();
    const fecha = `${hoy.getFullYear() - edad}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;

    await user.type(screen.getByLabelText('Nacimiento'), fecha);

    await waitFor(() => expect(screen.getByLabelText(/Grupo T/i)).toHaveValue(grupoEsperado));
  });

  it('restablece el grupo cuando la fecha de nacimiento queda vacía', async () => {
    const user = userEvent.setup();
    renderComponent();
    const nacimiento = screen.getByLabelText('Nacimiento');

    await user.type(nacimiento, '2010-01-01');
    await user.clear(nacimiento);

    await waitFor(() => expect(screen.getByLabelText(/Grupo T/i)).toHaveValue(GrupoEdad.NoAsignado));
  });

  it('el selector de sedes oculta los paréntesis vacíos', () => {
    mockSedesVisibles = [
      { id: '1', nombre: 'Sede Central', ciudad: 'Bogotá', esVisible: true },
      { id: '2', nombre: 'Sede Norte', ciudad: undefined, esVisible: true },
    ];
    renderComponent();

    expect(screen.getByRole('option', { name: 'Sede Central (Bogotá)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Sede Norte' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Sede Norte ()' })).not.toBeInTheDocument();
  });

  it('asigna No Asignado a menores de tres años', async () => {
    const user = userEvent.setup();
    renderComponent();
    const hoy = new Date();
    const fecha = `${hoy.getFullYear() - 2}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;

    await user.type(screen.getByLabelText('Nacimiento'), fecha);

    await waitFor(() => expect(screen.getByLabelText(/Grupo T/i)).toHaveValue(GrupoEdad.NoAsignado));
  });

  it('agrega y retira un programa recurrente', async () => {
    const user = userEvent.setup();
    mockProgramas = [{ id: 'programa-1', nombre: 'Combate', tipoCobro: 'Mensual', valor: 25000 }];
    renderComponent();
    const programa = screen.getByText('Combate').closest('div[class*="cursor-pointer"]')!;

    await user.click(programa);
    expect(programa).toHaveClass('border-tkd-blue');

    await user.click(programa);
    await waitFor(() => expect(programa).toHaveClass('opacity-60'));
  });

  it('muestra el estado crítico cuando no existen sedes', () => {
    mockSedesVisibles = [];
    renderComponent();

    expect(screen.getByText(/Error Crítico/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Sede de Entrenamiento/i)).not.toBeInTheDocument();
  });

  it('no renderiza contenido cuando está cerrado', () => {
    const { container } = renderComponent({ abierto: false });
    expect(container).toBeEmptyDOMElement();
  });

  it('permite cerrar el formulario desde el encabezado', async () => {
    const user = userEvent.setup();
    renderComponent();

    await user.click(screen.getAllByRole('button')[0]);

    expect(onCerrarMock).toHaveBeenCalledTimes(1);
  });

  it('cubre fechas inválidas y cumpleaños aún no cumplidos', () => {
    const hoy = new Date();
    const mesFuturo = hoy.getMonth() === 11 ? 11 : hoy.getMonth() + 1;
    const fechaMesPosterior = `${hoy.getFullYear() - 5}-${String(mesFuturo + 1).padStart(2, '0')}-01`;
    const fechaDiaPosterior = `${hoy.getFullYear() - 5}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(Math.min(hoy.getDate() + 1, 28)).padStart(2, '0')}`;

    expect(calcularEdadYGrupo('fecha-invalida').grupo).toBe(GrupoEdad.NoAsignado);
    expect(calcularEdadYGrupo(fechaMesPosterior).grupo).toBe(GrupoEdad.Infantil);
    expect(calcularEdadYGrupo(fechaDiaPosterior).grupo).toBe(GrupoEdad.Infantil);
  });

  it('usa valores alternativos de configuración y muestra el estado cargando', () => {
    mockConfigClub = { valorMensualidad: 50000, diasSuspension: 0, activarMatriculaAnual: false };
    renderComponent({ cargando: true });

    expect(screen.queryByText('(ANUAL)')).not.toBeInTheDocument();
    expect(screen.getByText(/cada día 5 de mes/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Finalizar y Registrar/i })).toBeDisabled();
  });
});

