// Estado compartido para los mocks (accesible dentro de jest.mock factories)
const mockState = {
  sedesVisibles: [{ id: '1', nombre: 'Sede Test', ciudad: 'Ciudad Test', esVisible: true }] as any[],
  programas: [] as any[],
  configClub: {
    tenantId: 'test-tenant',
    nombreClub: 'Test Club',
    valorMensualidad: 50000,
    diasSuspension: 30,
    valorMatricula: 10000,
    activarMatriculaAnual: true,
  } as any,
  usuario: null as any,
};

// Mock del contexto de DataContext para evitar llamadas reales a Firebase y proveer sedes mockeadas
jest.mock('../context/DataContext', () => ({
  DataProvider: ({ children }: any) => <>{children}</>,
  useSedes: () => ({
    sedes: mockState.sedesVisibles,
    sedesVisibles: mockState.sedesVisibles,
    totalSedesActivas: 1,
    eliminarSede: jest.fn(),
    agregarSede: jest.fn(),
    actualizarSede: jest.fn()
  }),
  useProgramas: () => ({
    programas: mockState.programas
  }),
  useConfiguracion: () => ({
    configClub: mockState.configClub
  })
}));

// Mock del contexto de Branding
jest.mock('../components/BrandingProvider', () => ({
  useTenant: jest.fn(),
}));

// Mock del contexto de Auth para evitar dependencia de Firebase Auth. `usuario` es dinámico
// (via mockState) porque el chequeo de duplicados en blur (handleBlurDuplicado) exige
// usuario.tenantId -- los tests preexistentes dependen de usuario:null, así que se resetea en
// cada beforeEach y solo se sobreescribe en los tests nuevos que necesitan sesión real.
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    usuario: mockState.usuario,
    login: jest.fn(),
    logout: jest.fn(),
    enviarEnlaceRecuperacion: jest.fn(),
    error: null,
    isSubmitting: false,
    cargandoSesion: false,
  }),
  AuthProvider: ({ children }: any) => <>{children}</>,
}));

// Mock de estudiantesApi para controlar buscarEstudianteDuplicado (chequeo de duplicados en
// blur) sin pegarle a Firestore real -- FormularioEstudiante.tsx solo importa esta función de
// este módulo.
jest.mock('../servicios/estudiantesApi', () => ({
  buscarEstudianteDuplicado: jest.fn(),
}));

import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FormularioEstudiante, { calcularEdadYGrupo } from './FormularioEstudiante';
import { GrupoEdad, EstadoPago, GradoTKD, RolUsuario, type Estudiante } from '../tipos';
import { DataProvider } from '../context/DataContext';
import { useTenant } from '../components/BrandingProvider';
import { buscarEstudianteDuplicado } from '../servicios/estudiantesApi';
import React from 'react';
import { describe, it, jest, beforeEach, afterEach, expect } from '@jest/globals';

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
// jest.Mock (sin generics) resuelve el tipo de retorno como `unknown` -- ResolveType<T> (el
// tipo que exige mockResolvedValue/mockResolvedValueOnce) da `never` cuando T no envuelve un
// Promise explícito. jest.MockedFunction<typeof fn> preserva la firma real (Promise<Estudiante
// | null>) para que esos métodos tipen correctamente.
const buscarEstudianteDuplicadoMock = buscarEstudianteDuplicado as jest.MockedFunction<typeof buscarEstudianteDuplicado>;

describe('FormularioEstudiante', () => {
  const onGuardarMock = jest.fn<(estudiante: Estudiante) => Promise<void>>().mockResolvedValue();
  const onCerrarMock = jest.fn();
  const setupUser = () => userEvent.setup({ delay: null });

  const llenarCamposRequeridos = async (datos = {
    nombres: 'Juan',
    apellidos: 'Perez',
    identificacion: '123456',
    nacimiento: '2000-01-01',
  }) => {
    fireEvent.change(screen.getByPlaceholderText('NOMBRES'), { target: { value: datos.nombres } });
    fireEvent.change(screen.getByPlaceholderText('APELLIDOS'), { target: { value: datos.apellidos } });
    fireEvent.change(screen.getByPlaceholderText('ID / DOCUMENTO'), { target: { value: datos.identificacion } });
    fireEvent.change(screen.getByLabelText('Nacimiento'), { target: { value: datos.nacimiento } });
    fireEvent.change(screen.getByLabelText(/Sede de Entrenamiento/i), { target: { value: '1' } });
    await waitFor(() => {
      expect(screen.getByPlaceholderText('NOMBRES')).toHaveValue(datos.nombres);
      expect(screen.getByPlaceholderText('APELLIDOS')).toHaveValue(datos.apellidos);
      expect(screen.getByPlaceholderText('ID / DOCUMENTO')).toHaveValue(datos.identificacion);
      expect(screen.getByLabelText('Nacimiento')).toHaveValue(datos.nacimiento);
      expect(screen.getByLabelText(/Sede de Entrenamiento/i)).toHaveValue('1');
      expect(screen.getByLabelText(/Grupo T/i)).toHaveValue(GrupoEdad.Adultos);
    });
  };

  beforeEach(() => {
    // Reset mock data before each test
    mockState.sedesVisibles = [{ id: '1', nombre: 'Sede Test', ciudad: 'Ciudad Test', esVisible: true }];
    mockState.programas = [];
    mockState.configClub = {
      tenantId: 'test-tenant',
      nombreClub: 'Test Club',
      valorMensualidad: 50000,
      diasSuspension: 30,
      valorMatricula: 10000,
      activarMatriculaAnual: true,
    };
    mockState.usuario = null;
    buscarEstudianteDuplicadoMock.mockReset();
    buscarEstudianteDuplicadoMock.mockResolvedValue(null);
    // onGuardarMock/onCerrarMock son compartidos por todo el describe (nunca se resetean solos
    // -- no hay `clearMocks` en jest.config.js) -- sin este reset, un `toHaveBeenCalled()` de un
    // test de confirmación queda "contaminando" el conteo del siguiente test (ej. el de cancelar).
    onGuardarMock.mockClear();
    onCerrarMock.mockClear();
    useTenantMock.mockReturnValue({
      tenant: {
        tenantId: 'test-tenant',
        nombreClub: 'Test Club',
        valorMensualidad: 50000,
        diasSuspension: 30,
      },
      estaCargado: true,
    });
  });

  const renderComponent = (props: Partial<React.ComponentProps<typeof FormularioEstudiante>> = {}) => {
    const defaultProps: React.ComponentProps<typeof FormularioEstudiante> = {
      abierto: true,
      onCerrar: onCerrarMock,
      onGuardar: onGuardarMock,
      estudianteActual: null,
      cargando: false,
      ...props,
    };

    return render(
      <DataProvider>
        <FormularioEstudiante {...defaultProps} />
      </DataProvider>
    );
  };

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
      estadoMatricula: 'activo', // requerido en Estudiante (SDD pricing-cupo-real, Bloque 1)
    };
    renderComponent({ estudianteActual });

    expect(screen.getByText('Editar Ficha')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('NOMBRES')).toHaveValue('Ana');
    expect(screen.getByPlaceholderText('APELLIDOS')).toHaveValue('García');
  });

  // SKIP: fireEvent.change no triggerea yupResolver onChange en jsdom;
  // el botón nunca se habilita. Pre-existente, no relacionado con módulo académico.
  it.skip('valida campos requeridos y habilita el botón de finalizar', async () => {
    renderComponent();
    const guardarBtn = screen.getByRole('button', { name: /Finalizar y Registrar/i });
    expect(guardarBtn).toBeDisabled();

    await llenarCamposRequeridos();

    await waitFor(() => {
      expect(guardarBtn).toBeEnabled();
    });
  });

  // schemaEstudiante is internal to FormularioEstudiante (not exported)
  // Schema validation is covered implicitly by the form submit tests
  it.skip('acepta como válido el contrato mínimo de un estudiante', async () => {
    // Test requires exported schema — skipped until refactored
  });

  // SKIP: Mismo problema que el anterior — fireEvent.change + yupResolver en jsdom.
  it.skip('llama a onGuardar con los datos correctos al enviar el formulario', async () => {
    const user = setupUser();
    renderComponent();

    await llenarCamposRequeridos({
      nombres: 'Carlos',
      apellidos: 'Ruiz',
      identificacion: '78910',
      nacimiento: '2001-01-01',
    });

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
    renderComponent();
    const hoy = new Date();
    const fecha = `${hoy.getFullYear() - edad}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;

    fireEvent.change(screen.getByLabelText('Nacimiento'), { target: { value: fecha } });

    await waitFor(() => expect(screen.getByLabelText(/Grupo T/i)).toHaveValue(grupoEsperado));
  });

  it('restablece el grupo cuando la fecha de nacimiento queda vacía', async () => {
    renderComponent();
    const nacimiento = screen.getByLabelText('Nacimiento');

    fireEvent.change(nacimiento, { target: { value: '2010-01-01' } });
    fireEvent.change(nacimiento, { target: { value: '' } });

    await waitFor(() => expect(screen.getByLabelText(/Grupo T/i)).toHaveValue(GrupoEdad.NoAsignado));
  });

  it('el selector de sedes oculta los paréntesis vacíos', () => {
    mockState.sedesVisibles = [
      { id: '1', nombre: 'Sede Central', ciudad: 'Bogotá', esVisible: true },
      { id: '2', nombre: 'Sede Norte', ciudad: undefined, esVisible: true },
    ];
    renderComponent();

    expect(screen.getByRole('option', { name: 'Sede Central (Bogotá)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Sede Norte' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Sede Norte ()' })).not.toBeInTheDocument();
  });

  it('asigna No Asignado a menores de tres años', async () => {
    renderComponent();
    const hoy = new Date();
    const fecha = `${hoy.getFullYear() - 2}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;

    fireEvent.change(screen.getByLabelText('Nacimiento'), { target: { value: fecha } });

    await waitFor(() => expect(screen.getByLabelText(/Grupo T/i)).toHaveValue(GrupoEdad.NoAsignado));
  });

  it('agrega y retira un programa recurrente', async () => {
    const user = setupUser();
    mockState.programas = [{ id: 'programa-1', nombre: 'Combate', tipoCobro: 'Mensual', valor: 25000 }];
    renderComponent();
    const programa = screen.getByText('Combate').closest('div[class*="cursor-pointer"]')!;

    await user.click(programa);
    expect(programa).toHaveClass('border-tkd-blue');

    await user.click(programa);
    await waitFor(() => expect(programa).toHaveClass('opacity-60'));
  });

  it('muestra el estado crítico cuando no existen sedes', () => {
    mockState.sedesVisibles = [];
    renderComponent();

    expect(screen.getByText(/Error Crítico/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Sede de Entrenamiento/i)).not.toBeInTheDocument();
  });

  it('no renderiza contenido cuando está cerrado', () => {
    const { container } = renderComponent({ abierto: false });
    expect(container).toBeEmptyDOMElement();
  });

  it('permite cerrar el formulario desde el encabezado', async () => {
    const user = setupUser();
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
    mockState.configClub = { valorMensualidad: 50000, diasSuspension: 0, activarMatriculaAnual: false };
    renderComponent({ cargando: true });

    expect(screen.queryByText('(ANUAL)')).not.toBeInTheDocument();
    expect(screen.getByText(/cada día 5 de mes/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Finalizar y Registrar/i })).toBeDisabled();
  });

  // --- Validaciones asistenciales (PR #71): chequeo de duplicados en blur + gating del modal
  // de confirmación en el submit. handleBlurDuplicado exige usuario?.tenantId, así que estos
  // tests son los únicos del archivo que pisan mockState.usuario (se resetea a null en
  // beforeEach para no afectar al resto de la suite).

  it('muestra advertencia de duplicado cuando buscarEstudianteDuplicado resuelve un match en el blur de correo', async () => {
    mockState.usuario = { tenantId: 'test-tenant' };
    buscarEstudianteDuplicadoMock.mockResolvedValueOnce({ nombres: 'Pedro', apellidos: 'Gómez' } as Estudiante);
    renderComponent();

    const correoInput = screen.getByPlaceholderText('EMAIL');
    fireEvent.change(correoInput, { target: { value: 'pedro@test.com' } });
    fireEvent.blur(correoInput);

    await waitFor(() => {
      expect(screen.getByText('Ya existe un alumno con este correo: Pedro Gómez')).toBeInTheDocument();
    });
    expect(buscarEstudianteDuplicadoMock).toHaveBeenCalledWith('test-tenant', 'correo', 'pedro@test.com', undefined);
  });

  it('no muestra advertencia de duplicado cuando buscarEstudianteDuplicado resuelve null', async () => {
    mockState.usuario = { tenantId: 'test-tenant' };
    buscarEstudianteDuplicadoMock.mockResolvedValueOnce(null);
    renderComponent();

    const correoInput = screen.getByPlaceholderText('EMAIL');
    fireEvent.change(correoInput, { target: { value: 'nuevo@test.com' } });
    fireEvent.blur(correoInput);

    await waitFor(() => expect(buscarEstudianteDuplicadoMock).toHaveBeenCalled());
    expect(screen.queryByText(/Ya existe un alumno con este correo/)).not.toBeInTheDocument();
  });

  it('frena el guardado con el modal de confirmación cuando la edad calculada es implausible, y confirma al aceptar', async () => {
    const user = setupUser();
    const { container } = renderComponent();
    const hoy = new Date();

    await llenarCamposRequeridos({
      nombres: 'Rosa',
      apellidos: 'Antigua',
      identificacion: '999888',
      nacimiento: `${hoy.getFullYear() - 105}-01-01`,
    });

    fireEvent.submit(container.querySelector('form')!);

    await waitFor(() => expect(screen.getByText('Revisa antes de guardar')).toBeInTheDocument());
    expect(onGuardarMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /Guardar de todas formas/i }));

    await waitFor(() => expect(onGuardarMock).toHaveBeenCalledTimes(1));
  });

  it('cancela el modal de confirmación sin llamar nunca a onGuardar', async () => {
    const user = setupUser();
    const { container } = renderComponent();
    const hoy = new Date();

    await llenarCamposRequeridos({
      nombres: 'Rosa',
      apellidos: 'Antigua',
      identificacion: '999888',
      nacimiento: `${hoy.getFullYear() - 105}-01-01`,
    });

    fireEvent.submit(container.querySelector('form')!);

    await waitFor(() => expect(screen.getByText('Revisa antes de guardar')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onGuardarMock).not.toHaveBeenCalled();
  });

  it('con el prop borrador presente, el submit llama a onGuardar directo sin mostrar el modal aunque haya alertas', async () => {
    const hoy = new Date();
    const { container } = renderComponent({ borrador: { nombres: 'Precargado' } });

    await llenarCamposRequeridos({
      nombres: 'Rosa',
      apellidos: 'Antigua',
      identificacion: '999888',
      nacimiento: `${hoy.getFullYear() - 105}-01-01`,
    });

    fireEvent.submit(container.querySelector('form')!);

    await waitFor(() => expect(onGuardarMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Revisa antes de guardar')).not.toBeInTheDocument();
  });

  // Cobro Justo (evolución opt-in de la Regla de Fin de Mes, ver utils/calculations.ts::
  // calcularMontoCobroJusto): día 10+ del mes, solo si el tenant activó configClub.cobroJustoActivo.
  describe('Cobro Justo', () => {
    beforeEach(() => {
      mockState.usuario = { rol: RolUsuario.Admin, tenantId: 'test-tenant' };
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('con Cobro Justo activo y alta el día 15, muestra el monto prorrateado y NO el toggle viejo', () => {
      jest.useFakeTimers().setSystemTime(new Date(2026, 3, 15)); // abril, 30 días -> quedan 16
      mockState.configClub.cobroJustoActivo = true;

      renderComponent();

      expect(screen.getByText('Cobro Justo (Día 10+)')).toBeInTheDocument();
      expect(screen.getByText(/26[.,]667/)).toBeInTheDocument(); // round(50000*16/30)
      expect(screen.queryByText('Gestión de Fin de Mes (Día 26+)')).not.toBeInTheDocument();
      expect(screen.queryByText('Abonar a mes siguiente')).not.toBeInTheDocument();
    });

    it('con Cobro Justo activo pero antes del día 10, no muestra ningún bloque de fin de mes', () => {
      jest.useFakeTimers().setSystemTime(new Date(2026, 3, 5));
      mockState.configClub.cobroJustoActivo = true;

      renderComponent();

      expect(screen.queryByText('Cobro Justo (Día 10+)')).not.toBeInTheDocument();
      expect(screen.queryByText('Gestión de Fin de Mes (Día 26+)')).not.toBeInTheDocument();
    });

    it('sin Cobro Justo activo, el día 27 sigue mostrando el toggle viejo tal cual estaba', () => {
      jest.useFakeTimers().setSystemTime(new Date(2026, 3, 27));
      mockState.configClub.cobroJustoActivo = false;

      renderComponent();

      expect(screen.getByText('Gestión de Fin de Mes (Día 26+)')).toBeInTheDocument();
      expect(screen.getByText('Abonar a mes siguiente')).toBeInTheDocument();
      expect(screen.queryByText('Cobro Justo (Día 10+)')).not.toBeInTheDocument();
    });

    it('sin rol Admin, ningún bloque de fin de mes se muestra aunque el día y la config apliquen', () => {
      jest.useFakeTimers().setSystemTime(new Date(2026, 3, 15));
      mockState.configClub.cobroJustoActivo = true;
      mockState.usuario = { rol: RolUsuario.Maestro, tenantId: 'test-tenant' };

      renderComponent();

      expect(screen.queryByText('Cobro Justo (Día 10+)')).not.toBeInTheDocument();
    });
  });
});

