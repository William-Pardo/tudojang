import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FormularioUsuario, { crearEsquemaValidacion } from './FormularioUsuario';
import { RolUsuario } from '../tipos';

const reset = jest.fn();
const register = jest.fn((name: string) => ({ name }));
let errors: Record<string, { message: string }> = {};
let isValid = true;
let selectedRole: RolUsuario | undefined = RolUsuario.Asistente;
let submittedData: any = { nombreUsuario: 'Carlos' };

jest.mock('../context/DataContext', () => ({
  useSedes: () => ({
    sedesVisibles: [
      { id: 'principal', nombre: 'Sede Principal Mock', esVisible: true },
      { id: '2', nombre: 'Sede Norte', esVisible: true },
    ],
  }),
}));

jest.mock('react-hook-form', () => ({
  useForm: () => ({
    register,
    reset,
    watch: () => selectedRole,
    formState: { errors, isValid },
    handleSubmit: (callback: (data: any) => void) => () => callback(submittedData),
  }),
}));

jest.mock('@hookform/resolvers/yup', () => ({
  yupResolver: () => jest.fn(),
}));

jest.mock('./FormInputError', () => ({ mensaje }: { mensaje?: string }) =>
  mensaje ? <span data-testid="input-error">{mensaje}</span> : null,
);

jest.mock('./Iconos', () => {
  const Icon = ({ className }: { className?: string }) => <svg className={className} />;
  return {
    IconoCerrar: Icon,
    IconoCandado: Icon,
    IconoUsuario: Icon,
    IconoGuardar: Icon,
    IconoEmail: Icon,
    IconoInformacion: Icon,
    IconoCasa: Icon,
    IconoOjoAbierto: Icon,
    IconoOjoCerrado: Icon,
    IconoWhatsApp: Icon,
  };
});

const baseProps = {
  abierto: true,
  onCerrar: jest.fn(),
  onGuardar: jest.fn(),
  usuarioActual: null,
  cargando: false,
};

const existingUser: any = {
  id: 'user-1',
  nombreUsuario: 'Ana Ruiz',
  numeroIdentificacion: '123',
  whatsapp: '3001234567',
  email: 'ana@test.com',
  rol: RolUsuario.Tutor,
  sedeId: '2',
  contrato: {
    sueldoBase: 2000,
    duracionMeses: 6,
    tipoVinculacion: 'Mes',
    fechaInicio: '2026-01-01',
    lugarEjecucion: 'Sede Norte',
  },
};

describe('FormularioUsuario', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    errors = {};
    isValid = true;
    selectedRole = RolUsuario.Asistente;
    submittedData = { nombreUsuario: 'Carlos' };
  });

  afterEach(() => jest.useRealTimers());

  it('renders nothing when closed', () => {
    const { container } = render(<FormularioUsuario {...baseProps} abierto={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('initializes and renders create mode with sede options and role description', () => {
    render(<FormularioUsuario {...baseProps} />);

    expect(screen.getByText('Nuevo Miembro de Equipo')).toBeInTheDocument();
    expect(screen.getByText(/Apoyo en Sede/i)).toBeInTheDocument();
    expect(screen.getByText('Sede de Trabajo')).toBeInTheDocument();
    expect(screen.getAllByRole('option', { name: 'Sede Norte' })).toHaveLength(2);
    expect(screen.getByRole('combobox', { name: 'Sede de Trabajo' })).toHaveAttribute('name', 'sedeId');
    expect(reset).toHaveBeenCalledWith(expect.objectContaining({
      rol: RolUsuario.Asistente,
      sedeId: 'principal',
      duracionContratoMeses: 12,
    }));
  });

  it.each([
    [RolUsuario.Admin, /Acceso total/i],
    [RolUsuario.Editor, /Gesti.*n de alumnos/i],
    [RolUsuario.Tutor, /Sabonim/i],
  ])('renders the description for role %s', (role, description) => {
    selectedRole = role;
    render(<FormularioUsuario {...baseProps} />);
    expect(screen.getAllByText(description).length).toBeGreaterThan(0);
  });

  it('hides role information and workplace sede when no role is selected', () => {
    selectedRole = undefined;
    render(<FormularioUsuario {...baseProps} />);
    expect(screen.queryByText('Sede de Trabajo')).not.toBeInTheDocument();
    expect(screen.queryByText(/Acceso total/i)).not.toBeInTheDocument();
  });

  it('renders edit mode, initializes existing values, and submits with the user id', async () => {
    selectedRole = RolUsuario.Tutor;
    const onGuardar = jest.fn();
    render(
      <FormularioUsuario
        {...baseProps}
        usuarioActual={existingUser}
        onGuardar={onGuardar}
      />,
    );

    expect(screen.getByText('Editar Perfil')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('ejemplo@email.com')).toBeDisabled();
    expect(screen.getByPlaceholderText(/Dejar vac/i)).toBeInTheDocument();
    expect(reset).toHaveBeenCalledWith(expect.objectContaining({
      nombreUsuario: 'Ana Ruiz',
      sueldoBase: 2000,
      duracionContratoMeses: 6,
    }));

    fireEvent.click(screen.getByText('Guardar Cambios'));
    expect(onGuardar).toHaveBeenCalledWith(submittedData, 'user-1');
  });

  it('uses edit fallbacks when optional user and contract values are absent', () => {
    const sparseUser: any = {
      ...existingUser,
      numeroIdentificacion: undefined,
      whatsapp: undefined,
      sedeId: undefined,
      contrato: undefined,
    };
    render(<FormularioUsuario {...baseProps} usuarioActual={sparseUser} />);

    expect(reset).toHaveBeenCalledWith(expect.objectContaining({
      numeroIdentificacion: '',
      whatsapp: '',
      sedeId: '',
      sueldoBase: 0,
      duracionContratoMeses: 12,
      tipoVinculacion: '',
      lugarEjecucion: '',
    }));
  });

  it('submits a new user without an id', () => {
    const onGuardar = jest.fn();
    render(<FormularioUsuario {...baseProps} onGuardar={onGuardar} />);
    fireEvent.click(screen.getByText('Guardar Cambios'));
    expect(onGuardar).toHaveBeenCalledWith(submittedData, undefined);
  });

  it('toggles password visibility and resets it when closing', () => {
    jest.useFakeTimers();
    const onCerrar = jest.fn();
    render(<FormularioUsuario {...baseProps} onCerrar={onCerrar} />);
    const password = screen.getByPlaceholderText(/M.*nimo 6 caracteres/i);
    const toggle = password.parentElement!.querySelector('button')!;

    expect(password).toHaveAttribute('type', 'password');
    fireEvent.click(toggle);
    expect(password).toHaveAttribute('type', 'text');
    fireEvent.click(toggle);
    expect(password).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByText('Cancelar'));
    act(() => jest.advanceTimersByTime(200));
    expect(reset).toHaveBeenCalled();
    expect(onCerrar).toHaveBeenCalled();
  });

  it('only closes through an explicit close action, not by clicking the content or backdrop', () => {
    jest.useFakeTimers();
    const onCerrar = jest.fn();
    const { rerender } = render(<FormularioUsuario {...baseProps} onCerrar={onCerrar} />);

    fireEvent.click(screen.getByText('Nuevo Miembro de Equipo'));
    act(() => jest.advanceTimersByTime(200));
    expect(onCerrar).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('dialog'));
    act(() => jest.advanceTimersByTime(200));
    expect(onCerrar).not.toHaveBeenCalled();

    rerender(<FormularioUsuario {...baseProps} onCerrar={onCerrar} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar formulario' }));
    act(() => jest.advanceTimersByTime(200));
    expect(onCerrar).toHaveBeenCalledTimes(1);
  });

  it('shows every validation error and disables an invalid form', () => {
    errors = Object.fromEntries([
      'nombreUsuario', 'numeroIdentificacion', 'whatsapp', 'sedeId', 'email',
      'contrasena', 'sueldoBase', 'duracionContratoMeses', 'tipoVinculacion',
      'fechaInicio', 'lugarEjecucion',
    ].map(field => [field, { message: `Error ${field}` }]));
    isValid = false;
    render(<FormularioUsuario {...baseProps} />);

    expect(screen.getAllByTestId('input-error')).toHaveLength(11);
    expect(screen.getByText('Guardar Cambios').closest('button')).toBeDisabled();
    expect(screen.getByPlaceholderText('Ej: Sabonim Carlos Ruiz')).toHaveClass('border-red-500');
  });

  it('shows processing state and disables submit while loading', () => {
    render(<FormularioUsuario {...baseProps} cargando />);
    expect(screen.getByText('Procesando...').closest('button')).toBeDisabled();
  });

  it('runs and clears the opening animation timer on unmount', () => {
    jest.useFakeTimers();
    const clearTimeoutSpy = jest.spyOn(window, 'clearTimeout');
    const { unmount } = render(<FormularioUsuario {...baseProps} />);
    unmount();
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  describe('validation schema', () => {
    const validData = {
      nombreUsuario: 'Carlos',
      numeroIdentificacion: '123',
      whatsapp: '3001234567',
      email: 'carlos@test.com',
      rol: RolUsuario.Admin,
      sedeId: '',
      contrasena: '123456',
      sueldoBase: 1000,
      duracionContratoMeses: 12,
      tipoVinculacion: 'Mes',
      fechaInicio: '2026-01-01',
      lugarEjecucion: 'Sede Principal',
    };

    it('validates creation data and transforms empty numeric fields to zero', async () => {
      const result = await crearEsquemaValidacion(false).validate({
        ...validData,
        sueldoBase: '',
        duracionContratoMeses: '',
      });
      expect(result).toEqual(expect.objectContaining({
        sueldoBase: 0,
        duracionContratoMeses: 0,
      }));
    });

    it('requires a sede for Tutor and Asistente roles', async () => {
      await expect(crearEsquemaValidacion(false).validate({
        ...validData,
        rol: RolUsuario.Tutor,
        sedeId: '',
      })).rejects.toThrow(/sede asignada/i);

      await expect(crearEsquemaValidacion(false).validate({
        ...validData,
        rol: RolUsuario.Asistente,
        sedeId: '',
      })).rejects.toThrow(/sede asignada/i);
    });

    it('requires and validates a new password', async () => {
      await expect(crearEsquemaValidacion(false).validate({
        ...validData,
        contrasena: '',
      })).rejects.toThrow(/6 caracteres/i);

      await expect(crearEsquemaValidacion(false).validate({
        ...validData,
        contrasena: '123',
      })).rejects.toThrow(/6 caracteres/i);
    });

    it('allows an empty password when editing but validates a supplied one', async () => {
      const emptyPassword = await crearEsquemaValidacion(true).validate({
        ...validData,
        contrasena: '',
      });
      expect(emptyPassword.contrasena).toBeUndefined();

      await expect(crearEsquemaValidacion(true).validate({
        ...validData,
        contrasena: '123',
      })).rejects.toThrow(/6 caracteres/i);
    });

    it.each([
      ['nombreUsuario', '', /nombre es obligatorio/i],
      ['numeroIdentificacion', '', /documento de identidad/i],
      ['whatsapp', '123', /10 d.*gitos/i],
      ['email', 'incorrecto', /correo v.*lido/i],
      ['rol', 'Desconocido', /rol/i],
      ['tipoVinculacion', '', /vinculaci.*n es obligatorio/i],
      ['fechaInicio', '', /fecha de inicio/i],
      ['lugarEjecucion', '', /sede de ejecuci.*n/i],
      ['sueldoBase', 'abc', /valor num.*rico/i],
      ['duracionContratoMeses', 'abc', /debe ser n.*mero/i],
    ])('rejects invalid %s', async (field, value, message) => {
      await expect(crearEsquemaValidacion(false).validate({
        ...validData,
        [field]: value,
      })).rejects.toThrow(message);
    });
  });
});
