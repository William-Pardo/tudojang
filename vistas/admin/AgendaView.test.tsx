import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AgendaView, { ROLES_CON_ACCESO_AGENDA } from './AgendaView';
import { RolUsuario } from '../../tipos';
import type { JornadaInstruccion } from '../../models/academico/jornada';
import type { AsignacionAcademica } from '../../models/academico/asignacion';
import { obtenerRangoSemana, formatearFechaIso } from '../../servicios/academico/agendaSemanalService';
import { EliminacionNoPermitidaError } from '../../servicios/academico/jornadaRepository';

jest.mock('../../servicios/academico/asignacionService', () => ({
  listarAsignacionesPorTenant: jest.fn(),
}));

jest.mock('../../servicios/academico/jornadaContextService', () => ({
  obtenerContextoJornada: jest.fn(),
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

// Fix tutor-role-end-to-end (change de otra sesion concurrente): AgendaView ahora resuelve
// el/los estudiante(s) del consultor (Tutor/Estudiante) via este servicio para filtrar la
// parrilla a sus clases. Sin mockearlo, la implementacion real (mock-mode de Firebase) no
// encuentra ningun estudiante y la parrilla queda vacia para Estudiante -- se mockea aca
// para no depender de esa integracion real en un test unitario de AgendaView.
jest.mock('../../servicios/academico/tutorStudentResolver', () => ({
  resolveStudentsForConsultor: jest.fn(),
}));

import { listarAsignacionesPorTenant } from '../../servicios/academico/asignacionService';
import { obtenerContextoJornada } from '../../servicios/academico/jornadaContextService';
import { useAuth } from '../../context/AuthContext';
import { resolveStudentsForConsultor } from '../../servicios/academico/tutorStudentResolver';
import { GrupoEdad, GradoTKD, EstadoPago, type Estudiante } from '../../tipos';

function crearEstudianteConsultor(overrides: Partial<Estudiante> = {}): Estudiante {
  return {
    id: 'estudiante-1',
    tenantId: 'tenant-1',
    nombres: 'Estudiante',
    apellidos: 'De Prueba',
    numeroIdentificacion: '000',
    fechaNacimiento: '2015-01-01',
    grado: GradoTKD.Blanco,
    grupo: GrupoEdad.Infantil,
    horasAcumuladasGrado: 0,
    sedeId: 'sede-principal',
    telefono: '',
    correo: 'maestro@test.com',
    fechaIngreso: '2024-01-01',
    estadoPago: EstadoPago.AlDia,
    saldoDeudor: 0,
    ...overrides,
  } as Estudiante;
}

function crearJornada(overrides: Partial<JornadaInstruccion> = {}): JornadaInstruccion {
  const ahora = '2026-06-01T00:00:00.000Z';
  return {
    id: 'jornada-1',
    tenantId: 'tenant-1',
    programaId: 'programa-1',
    ejecucionProgramaId: 'ejecucion-1',
    grupoId: 'grupo-infantil',
    sedeId: 'sede-principal',
    espacioId: 'tatami-1',
    instructorId: 'maestro-1',
    fecha: '2026-07-07',
    horaInicio: '08:00',
    horaFin: '09:00',
    estado: 'confirmada',
    objetivosPlaneados: ['obj-1'],
    objetivosImpartidos: [],
    asistenciaRegistrada: false,
    creadoEn: ahora,
    actualizadoEn: ahora,
    ...overrides,
  };
}

function crearAsignacion(overrides: Partial<AsignacionAcademica> = {}): AsignacionAcademica {
  const ahora = '2026-06-01T00:00:00.000Z';
  return {
    id: 'asig-1',
    tenantId: 'tenant-1',
    recursoId: 'recurso-1',
    titulo: 'Material tecnico',
    destinatario: { tipo: 'grupo', grupo: 'Infantil' },
    uso: 'estudio',
    momento: 'preparacion',
    obligatoria: true,
    fechaApertura: ahora,
    estado: 'publicada',
    creadoPorUid: 'maestro-1',
    creadoEn: ahora,
    actualizadoEn: ahora,
    ...overrides,
  };
}

const contextoVacio = {
  programas: [{ id: 'programa-1', nombre: 'Fundamentos Taekwondo' }],
  grupos: [{ id: 'grupo-infantil', nombre: 'Grupo Infantil' }],
  sedes: [{ id: 'sede-principal', nombre: 'Sede Principal' }],
  espacios: [],
  instructores: [{ id: 'maestro-1', nombre: 'Maestro Juan' }],
};

function mockUsuario(overrides: Partial<{ id: string; tenantId: string; rol: string; permisoEdicionAgenda: boolean }> = {}) {
  (useAuth as jest.Mock).mockReturnValue({
    usuario: {
      id: 'maestro-1',
      tenantId: 'tenant-1',
      rol: 'Editor',
      email: 'maestro@test.com',
      ...overrides,
    },
  });
}

// Fija "hoy" dentro de la misma semana (lunes 2026-07-06 a domingo 2026-07-12) que usan
// los fixtures de este archivo (`crearJornada()` hardcodea fecha: '2026-07-07'). AgendaView
// calcula la semana visible con `new Date()` real -- sin fijar el reloj, estos tests dejan
// de pasar apenas el reloj del sistema avanza a otra semana calendario (encontrado en vivo:
// el reloj real llego a 2026-07-15 durante esta sesion y los tests que dependen de que se
// renderice algun bloque de clase empezaron a fallar, aunque la logica de AgendaView.tsx
// nunca cambio). Se sobreescribe el constructor `Date` directamente (no `jest.useFakeTimers`)
// para no interferir con la deteccion interna de fake timers de `waitFor`/`findBy` de
// Testing Library, que cambia de estrategia de polling cuando detecta timers falsos y puede
// dejar de resolver aunque la promesa real ya haya resuelto.
const AHORA_FIJO_ISO = '2026-07-08T10:00:00.000Z';
const RealDate = global.Date;
class FechaFija extends RealDate {
  constructor(...args: ConstructorParameters<typeof Date> | []) {
    if (args.length === 0) {
      super(AHORA_FIJO_ISO);
    } else {
      super(...args);
    }
  }
  static now() {
    return new RealDate(AHORA_FIJO_ISO).getTime();
  }
}

describe('AgendaView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.Date = FechaFija as unknown as DateConstructor;
    (listarAsignacionesPorTenant as jest.Mock).mockResolvedValue([]);
    (obtenerContextoJornada as jest.Mock).mockResolvedValue(contextoVacio);
    mockUsuario();
  });

  afterEach(() => {
    global.Date = RealDate;
  });

  it('muestra columnas Lunes a Domingo', async () => {
    const repository = { listarJornadasPorRangoFechas: jest.fn().mockResolvedValue([]) };
    render(<AgendaView repository={repository as any} />);

    await waitFor(() => expect(repository.listarJornadasPorRangoFechas).toHaveBeenCalled());

    for (const dia of ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']) {
      expect(screen.getByText(dia)).toBeInTheDocument();
    }
  });

  // Rediseño 2026-07-17 (segunda vuelta): la grilla ya NO usa un eje continuo fijo de
  // 7:00 a 22:00 con marcas de hora -- ahora es un conjunto de filas discretas, una por
  // cada franja horaria EXACTA que tiene alguna jornada activa esa semana (ver
  // agendaSemanalService.ts / calcularFilasHorarioAgenda). Una semana sin jornadas no debe
  // mostrar ninguna marca de hora fija, sino el estado vacio.
  it('sin jornadas esa semana, no muestra marcas de hora fijas sino el estado vacio', async () => {
    const repository = { listarJornadasPorRangoFechas: jest.fn().mockResolvedValue([]) };
    render(<AgendaView repository={repository as any} />);

    await waitFor(() => expect(repository.listarJornadasPorRangoFechas).toHaveBeenCalled());

    expect(screen.queryByText('07:00')).not.toBeInTheDocument();
    expect(screen.queryByText('22:00')).not.toBeInTheDocument();
    expect(screen.getByText(/no hay clases activas programadas esta semana/i)).toBeInTheDocument();
  });

  it('muestra en el encabezado el rango de fechas de la semana actual al montar', async () => {
    const repository = { listarJornadasPorRangoFechas: jest.fn().mockResolvedValue([]) };
    render(<AgendaView repository={repository as any} />);

    const hoyIso = formatearFechaIso(new Date());
    const rangoEsperado = obtenerRangoSemana(hoyIso);

    await waitFor(() => {
      expect(screen.getByText(new RegExp(`${rangoEsperado.inicioIso}.*${rangoEsperado.finIso}`))).toBeInTheDocument();
    });
  });

  it('muestra los botones de navegacion semana anterior/siguiente/hoy', async () => {
    const repository = { listarJornadasPorRangoFechas: jest.fn().mockResolvedValue([]) };
    render(<AgendaView repository={repository as any} />);

    await waitFor(() => expect(repository.listarJornadasPorRangoFechas).toHaveBeenCalled());

    expect(screen.getByRole('button', { name: /semana anterior/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /semana siguiente/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /semana actual|^hoy$/i })).toBeInTheDocument();
  });

  it('al montar, carga la semana actual con el rango de fechas correcto', async () => {
    const repository = { listarJornadasPorRangoFechas: jest.fn().mockResolvedValue([]) };
    render(<AgendaView repository={repository as any} />);

    const hoyIso = formatearFechaIso(new Date());
    const rangoEsperado = obtenerRangoSemana(hoyIso);

    await waitFor(() => {
      expect(repository.listarJornadasPorRangoFechas).toHaveBeenCalledWith(
        'tenant-1',
        rangoEsperado.inicioIso,
        rangoEsperado.finIso,
      );
    });
  });

  it('click en semana siguiente dispara una nueva carga con el rango de fechas correcto', async () => {
    const user = userEvent.setup();
    const repository = { listarJornadasPorRangoFechas: jest.fn().mockResolvedValue([]) };
    render(<AgendaView repository={repository as any} />);

    const hoyIso = formatearFechaIso(new Date());
    const rangoActual = obtenerRangoSemana(hoyIso);
    await waitFor(() => {
      expect(repository.listarJornadasPorRangoFechas).toHaveBeenCalledWith(
        'tenant-1',
        rangoActual.inicioIso,
        rangoActual.finIso,
      );
    });

    await user.click(screen.getByRole('button', { name: /semana siguiente/i }));

    const siguienteInicio = obtenerRangoSemana(
      formatearFechaIso(new Date(new Date(`${rangoActual.inicioIso}T00:00:00`).getTime() + 7 * 24 * 60 * 60 * 1000)),
    );

    await waitFor(() => {
      expect(repository.listarJornadasPorRangoFechas).toHaveBeenCalledWith(
        'tenant-1',
        siguienteInicio.inicioIso,
        siguienteInicio.finIso,
      );
    });
  });

  it('click en semana anterior y luego en hoy vuelve a la semana actual', async () => {
    const user = userEvent.setup();
    const repository = { listarJornadasPorRangoFechas: jest.fn().mockResolvedValue([]) };
    render(<AgendaView repository={repository as any} />);

    const hoyIso = formatearFechaIso(new Date());
    const rangoActual = obtenerRangoSemana(hoyIso);
    await waitFor(() => expect(repository.listarJornadasPorRangoFechas).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole('button', { name: /semana anterior/i }));
    await waitFor(() => expect(repository.listarJornadasPorRangoFechas).toHaveBeenCalledTimes(2));

    await user.click(screen.getByRole('button', { name: /semana actual|^hoy$/i }));
    await waitFor(() => {
      expect(repository.listarJornadasPorRangoFechas).toHaveBeenLastCalledWith(
        'tenant-1',
        rangoActual.inicioIso,
        rangoActual.finIso,
      );
    });
  });

  it('un bloque de clase muestra los campos minimos requeridos', async () => {
    const jornada = crearJornada({ id: 'jornada-1', fecha: '2026-07-07' });
    const repository = { listarJornadasPorRangoFechas: jest.fn().mockResolvedValue([jornada]) };
    (listarAsignacionesPorTenant as jest.Mock).mockResolvedValue([
      crearAsignacion({ jornadaId: 'jornada-1', titulo: 'Fundamentos tecnicos' }),
    ]);

    render(<AgendaView repository={repository as any} />);

    expect(await screen.findByText(/fundamentos taekwondo/i)).toBeInTheDocument();
    // Rediseño 2026-07-17: "08:00 - 09:00" aparece DOS veces (la etiqueta de la fila
    // horaria a la izquierda, mas la tarjeta de la clase) -- se escopea al bloque via su
    // data-testid para no ambiguar (mismo patron que el test de "clase cancelada").
    const bloque = await screen.findByTestId('bloque-jornada-jornada-1');
    expect(within(bloque).getByText('08:00 - 09:00')).toBeInTheDocument();
    expect(screen.getByText(/sede principal/i)).toBeInTheDocument();
    expect(screen.getByText(/maestro juan/i)).toBeInTheDocument();
    // Simplificacion 2026-07-16: el estado academico crudo ("Confirmada") ya no se muestra
    // en la grilla -- el unico badge visible es el indicador de Clase en Vivo (4 estados).
    // "ahora" esta fijado a 2026-07-08T10:00Z (AHORA_FIJO_ISO) y esta jornada es del
    // 2026-07-07 08:00-09:00, ya bien pasada la ventana -> "Finalizada".
    expect(await screen.findByTestId('indicador-clase-en-vivo-jornada-1')).toHaveTextContent('Finalizada');
    expect(screen.getByText(/fundamentos tecnicos/i)).toBeInTheDocument();
    // Checklist 12.8 (seccion 3 del documento de mejora): "Indicador de grados asociados".
    // El modelo real (JornadaInstruccion) no tiene un campo `grados`, sino `grupoId`
    // (mismo mapeo ya establecido en 12.7 -- ver PestanaProgramaJornada.tsx, campo "Grupo").
    expect(screen.getByText(/grupo infantil/i)).toBeInTheDocument();
  });

  it('muestra un indicador de material pendiente cuando la clase no tiene material asignado', async () => {
    const jornada = crearJornada({ id: 'jornada-1', fecha: '2026-07-07' });
    const repository = { listarJornadasPorRangoFechas: jest.fn().mockResolvedValue([jornada]) };
    (listarAsignacionesPorTenant as jest.Mock).mockResolvedValue([]);

    render(<AgendaView repository={repository as any} />);

    expect(await screen.findByText(/material pendiente/i)).toBeInTheDocument();
  });

  it('marca una clase cancelada como atenuada/con badge, sin mostrarla como bloque activo normal', async () => {
    const jornada = crearJornada({ id: 'jornada-1', fecha: '2026-07-07', estado: 'cancelada' });
    const repository = { listarJornadasPorRangoFechas: jest.fn().mockResolvedValue([jornada]) };

    render(<AgendaView repository={repository as any} />);

    // Subtarea 12.10: agrego un SEGUNDO badge ("Cancelada") ademas del de estado academico ya
    // cubierto por este test -- ambos comparten texto, se escopea al bloque via su
    // data-testid (`bloque-jornada-{id}`) para no ambiguar entre los dos.
    const bloque = await screen.findByTestId('bloque-jornada-jornada-1');
    expect(within(bloque).getAllByText(/cancelada/i).length).toBeGreaterThanOrEqual(1);
  });

  it('muestra el icono de edicion cuando el usuario es el maestro asignado', async () => {
    const jornada = crearJornada({ id: 'jornada-1', fecha: '2026-07-07', instructorId: 'maestro-1' });
    const repository = { listarJornadasPorRangoFechas: jest.fn().mockResolvedValue([jornada]) };
    mockUsuario({ id: 'maestro-1', rol: 'Editor' });

    render(<AgendaView repository={repository as any} />);

    expect(await screen.findByRole('button', { name: /editar clase/i })).toBeInTheDocument();
  });

  it('oculta el icono de edicion cuando el usuario no es el maestro asignado ni admin', async () => {
    const jornada = crearJornada({ id: 'jornada-1', fecha: '2026-07-07', instructorId: 'maestro-1' });
    const repository = { listarJornadasPorRangoFechas: jest.fn().mockResolvedValue([jornada]) };
    mockUsuario({ id: 'otro-maestro', rol: 'Editor' });

    render(<AgendaView repository={repository as any} />);

    await screen.findByText(/fundamentos taekwondo/i);
    expect(screen.queryByRole('button', { name: /editar clase/i })).not.toBeInTheDocument();
  });

  it('muestra el icono de edicion para un admin aunque no sea el maestro asignado', async () => {
    const jornada = crearJornada({ id: 'jornada-1', fecha: '2026-07-07', instructorId: 'maestro-1' });
    const repository = { listarJornadasPorRangoFechas: jest.fn().mockResolvedValue([jornada]) };
    mockUsuario({ id: 'otro-admin', rol: 'Admin' });

    render(<AgendaView repository={repository as any} />);

    expect(await screen.findByRole('button', { name: /editar clase/i })).toBeInTheDocument();
  });

  // Subtarea 12.9: click en el lapiz abre el modal de edicion singular DENTRO de la misma
  // vista (sin navegar a otra ruta, sin perder la semana visible -- secciones 4/5 del
  // documento de mejora).
  // Rediseño post-cierre modulo 12 (ver CIERRE CENTRO DE ESTUDIOS.md): la barra de tabs
  // "Programa"/"Materiales" desaparece del modal -- ahora es una sola vista con un boton
  // "+ Agregar material". Este test reemplaza la aserción de tabs por la del nuevo boton.
  it('click en el lapiz abre el modal de edicion (una sola vista, sin tabs), sin salir de la vista semanal', async () => {
    const user = userEvent.setup();
    const jornada = crearJornada({ id: 'jornada-1', fecha: '2026-07-07', instructorId: 'maestro-1' });
    const repository = { listarJornadasPorRangoFechas: jest.fn().mockResolvedValue([jornada]) };

    render(<AgendaView repository={repository as any} />);

    const boton = await screen.findByRole('button', { name: /editar clase/i });
    await user.click(boton);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /programa/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /materiales/i })).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /\+ agregar material/i })).toBeInTheDocument();
    // Sigue mostrando la parrilla semanal detras del modal: no hubo navegacion de ruta.
    expect(screen.getByText('Lunes')).toBeInTheDocument();
  });

  it('cerrar el modal de edicion vuelve a la parrilla sin el dialogo', async () => {
    const user = userEvent.setup();
    const jornada = crearJornada({ id: 'jornada-1', fecha: '2026-07-07', instructorId: 'maestro-1' });
    const repository = { listarJornadasPorRangoFechas: jest.fn().mockResolvedValue([jornada]) };

    render(<AgendaView repository={repository as any} />);

    const boton = await screen.findByRole('button', { name: /editar clase/i });
    await user.click(boton);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^cancelar$/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('guardar en el modal refresca la semana visible (vuelve a llamar listarJornadasPorRangoFechas) sin perder la semana', async () => {
    const user = userEvent.setup();
    const jornada = crearJornada({ id: 'jornada-1', fecha: '2026-07-07', instructorId: 'maestro-1' });
    const repository = {
      listarJornadasPorRangoFechas: jest.fn().mockResolvedValue([jornada]),
      guardarJornada: jest.fn().mockResolvedValue(undefined),
      registrarAuditoria: jest.fn().mockResolvedValue(undefined),
      existeConflictoHorario: jest.fn().mockResolvedValue({ hayConflicto: false }),
    };

    render(<AgendaView repository={repository as any} />);

    const boton = await screen.findByRole('button', { name: /editar clase/i });
    await user.click(boton);
    await user.click(screen.getByRole('button', { name: /guardar cambios/i }));

    await waitFor(() => expect(repository.listarJornadasPorRangoFechas).toHaveBeenCalledTimes(2));
    // Ambas llamadas usan el mismo rango (la semana actual sigue siendo la visible).
    const [primeraLlamada, segundaLlamada] = repository.listarJornadasPorRangoFechas.mock.calls;
    expect(segundaLlamada).toEqual(primeraLlamada);
  });
});

// Fix bug: rol Maestro excluido de la ruta /agenda (2026-07-11). El gate REAL de la ruta
// vive en App.tsx (ternario inline sobre `usuario?.rol`, sin exports desde App.tsx contra
// los que testear directamente -- ver nota en el registro de cierre de este fix en
// "CIERRE CENTRO DE ESTUDIOS.md"). `ROLES_CON_ACCESO_AGENDA` es la lista exportada y pura
// que este mismo archivo documenta como "el mismo set de roles" que usa esa ruta (ver
// comentario junto a su definicion), asi que es el punto de verificacion mas cercano
// posible sin mockear toda la arbol de <App/> (AuthContext/DataContext/Analytics/
// Branding/useEstadoLicencia/useVentanaClaseEnVivo -- ninguno mockeado hoy para un mount
// completo en este repo). RolUsuario.Maestro es el rol docente real del dominio (ver
// utils/roles.ts) y `isInstructor()` en firestore.rules YA lo reconoce como instructor
// valido; antes de este fix, un maestro real con permisos de escritura en Firestore no
// podia ni cargar la pantalla.
describe('Fix bug: rol Maestro excluido de la ruta /agenda', () => {
  it('incluye a RolUsuario.Maestro entre los roles con acceso a Agenda', () => {
    expect(ROLES_CON_ACCESO_AGENDA).toContain(RolUsuario.Maestro);
  });

  it('mantiene los roles operativos existentes (Admin/Editor/Asistente/SuperAdmin)', () => {
    expect(ROLES_CON_ACCESO_AGENDA).toEqual(
      expect.arrayContaining([
        RolUsuario.Admin,
        RolUsuario.Editor,
        RolUsuario.Asistente,
        RolUsuario.SuperAdmin,
      ])
    );
  });

  it('no otorga acceso a Tutor (padre/acudiente, ver utils/roles.ts) -- Agenda sigue sin ser un modulo de Tutor', () => {
    expect(ROLES_CON_ACCESO_AGENDA).not.toContain(RolUsuario.Tutor);
  });
});

// Extension posterior al cierre del modulo 12 (matriz de roles + iconos de la parrilla,
// decision explicita del usuario documentada en CIERRE CENTRO DE ESTUDIOS.md): Estudiante
// ahora SI ve Agenda, pero en modo SOLO LECTURA -- reemplaza el test previo que afirmaba lo
// contrario ("no otorga acceso a Estudiante ni Tutor"), ya que esa restriccion para
// Estudiante fue anulada explicitamente. Tutor sigue excluido (test arriba, sin cambios).
describe('Extension: Estudiante ve Agenda en modo solo lectura', () => {
  // Bug encontrado en vivo (post-cierre): este describe es HERMANO del describe principal
  // ('AgendaView', linea 117), no anidado dentro -- el beforeEach de ese bloque NO aplica
  // aca. Sin este beforeEach propio, `obtenerContextoJornada`/`listarAsignacionesPorTenant`
  // quedan como `jest.fn()` sin implementacion (devuelven `undefined`), y el codigo de
  // produccion que hace `.then()` sobre esos resultados explota con
  // "Cannot read properties of undefined (reading 'then')". Mismo patron ya usado por el
  // describe de la Subtarea 12.10 (linea 618) para los tests que SI renderizan el componente.
  beforeEach(() => {
    jest.clearAllMocks();
    // Mismo fix de reloj que el describe principal (linea 91): fixture hardcodea
    // fecha: '2026-07-07', hay que fijar "hoy" en esa misma semana o el bloque de clase
    // nunca aparece en la semana visible (real bug encontrado, no solo el de los mocks).
    global.Date = FechaFija as unknown as DateConstructor;
    (listarAsignacionesPorTenant as jest.Mock).mockResolvedValue([]);
    (obtenerContextoJornada as jest.Mock).mockResolvedValue(contextoVacio);
    // El Estudiante es un "consultor" (fix tutor-role-end-to-end): AgendaView filtra su
    // vista a las clases de SU sede+grupo via `resolveStudentsForConsultor`. Se mockea con
    // un estudiante que matchea sede/grupo del fixture por defecto (sede-principal /
    // grupo-infantil) para que la parrilla muestre el bloque esperado por estos tests.
    (resolveStudentsForConsultor as jest.Mock).mockResolvedValue([crearEstudianteConsultor()]);
  });

  afterEach(() => {
    global.Date = RealDate;
  });

  it('incluye a RolUsuario.Estudiante entre los roles con acceso a Agenda', () => {
    expect(ROLES_CON_ACCESO_AGENDA).toContain(RolUsuario.Estudiante);
  });

  it('un Estudiante ve la parrilla semanal (columnas de dias) igual que cualquier otro rol con acceso', async () => {
    const jornada = crearJornada({ id: 'jornada-1', fecha: '2026-07-07' });
    const repository = { listarJornadasPorRangoFechas: jest.fn().mockResolvedValue([jornada]) };
    mockUsuario({ id: 'estudiante-1', rol: 'Estudiante' });

    render(<AgendaView repository={repository as any} />);

    expect(await screen.findByText(/fundamentos taekwondo/i)).toBeInTheDocument();
    expect(screen.getByText('Lunes')).toBeInTheDocument();
  });

  it('un Estudiante NUNCA ve el icono de editar, aunque por error de datos coincida con el instructorId de la jornada', async () => {
    const jornada = crearJornada({ id: 'jornada-1', fecha: '2026-07-07', instructorId: 'estudiante-1' });
    const repository = { listarJornadasPorRangoFechas: jest.fn().mockResolvedValue([jornada]) };
    mockUsuario({ id: 'estudiante-1', rol: 'Estudiante' });

    render(<AgendaView repository={repository as any} />);

    await screen.findByText(/fundamentos taekwondo/i);
    expect(screen.queryByRole('button', { name: /editar clase/i })).not.toBeInTheDocument();
  });

  it('un Estudiante NUNCA ve el icono de eliminar', async () => {
    const jornada = crearJornada({ id: 'jornada-1', fecha: '2026-07-07' });
    const repository = { listarJornadasPorRangoFechas: jest.fn().mockResolvedValue([jornada]) };
    mockUsuario({ id: 'estudiante-1', rol: 'Estudiante' });

    render(<AgendaView repository={repository as any} />);

    await screen.findByText(/fundamentos taekwondo/i);
    expect(screen.queryByRole('button', { name: /eliminar clase/i })).not.toBeInTheDocument();
  });

  it('sin icono de editar visible, no hay forma de abrir el modal de edicion (el bloque en si no dispara ninguna accion)', async () => {
    const user = userEvent.setup();
    const jornada = crearJornada({ id: 'jornada-1', fecha: '2026-07-07' });
    const repository = { listarJornadasPorRangoFechas: jest.fn().mockResolvedValue([jornada]) };
    mockUsuario({ id: 'estudiante-1', rol: 'Estudiante' });

    render(<AgendaView repository={repository as any} />);

    const bloque = await screen.findByTestId('bloque-jornada-jornada-1');
    await user.click(bloque);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});

// Extension posterior al cierre del modulo 12: icono de eliminar (caneca) directo en el
// bloque de la parrilla, ademas del lapiz de editar ya existente (12.9).
//
// Ampliacion posterior al cierre inicial de esta extension (decision de producto explicita
// del usuario, ver CIERRE CENTRO DE ESTUDIOS.md): el icono de eliminar ya NO se restringe a
// esAdmin -- usa la MISMA matriz completa que el icono de editar (`puedeEditarJornada`):
// Maestro solo su propia clase asignada, Asistente/Editor solo con permisoEdicionAgenda.
describe('Extension: icono de eliminar en el bloque de la parrilla', () => {
  // Mismo bug/fix que el describe "Extension: Estudiante..." de arriba: este describe
  // tambien es HERMANO del describe principal, no hereda su beforeEach (ni los mocks de
  // contexto/asignaciones ni el fix de reloj).
  beforeEach(() => {
    jest.clearAllMocks();
    global.Date = FechaFija as unknown as DateConstructor;
    (listarAsignacionesPorTenant as jest.Mock).mockResolvedValue([]);
    (obtenerContextoJornada as jest.Mock).mockResolvedValue(contextoVacio);
  });

  afterEach(() => {
    global.Date = RealDate;
  });

  it('muestra el icono de eliminar para un Admin', async () => {
    const jornada = crearJornada({ id: 'jornada-1', fecha: '2026-07-07', instructorId: 'maestro-1' });
    const repository = { listarJornadasPorRangoFechas: jest.fn().mockResolvedValue([jornada]) };
    mockUsuario({ id: 'admin-1', rol: 'Admin' });

    render(<AgendaView repository={repository as any} />);

    expect(await screen.findByRole('button', { name: /eliminar clase/i })).toBeInTheDocument();
  });

  it('muestra el icono de eliminar para el maestro asignado a la clase', async () => {
    const jornada = crearJornada({ id: 'jornada-1', fecha: '2026-07-07', instructorId: 'maestro-1' });
    const repository = { listarJornadasPorRangoFechas: jest.fn().mockResolvedValue([jornada]) };
    mockUsuario({ id: 'maestro-1', rol: 'Maestro' });

    render(<AgendaView repository={repository as any} />);

    await screen.findByRole('button', { name: /editar clase/i });
    expect(screen.getByRole('button', { name: /eliminar clase/i })).toBeInTheDocument();
  });

  it('oculta el icono de eliminar para un maestro NO asignado a la clase', async () => {
    const jornada = crearJornada({ id: 'jornada-1', fecha: '2026-07-07', instructorId: 'maestro-1' });
    const repository = { listarJornadasPorRangoFechas: jest.fn().mockResolvedValue([jornada]) };
    mockUsuario({ id: 'otro-maestro', rol: 'Maestro' });

    render(<AgendaView repository={repository as any} />);

    await screen.findByText(/fundamentos taekwondo/i);
    expect(screen.queryByRole('button', { name: /editar clase/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /eliminar clase/i })).not.toBeInTheDocument();
  });

  it('muestra el icono de eliminar para Asistente/Editor NO asignados con permisoEdicionAgenda=true', async () => {
    const jornada = crearJornada({ id: 'jornada-1', fecha: '2026-07-07', instructorId: 'maestro-1' });
    const repository = { listarJornadasPorRangoFechas: jest.fn().mockResolvedValue([jornada]) };
    mockUsuario({ id: 'asistente-1', rol: 'Asistente', permisoEdicionAgenda: true });

    render(<AgendaView repository={repository as any} />);

    await screen.findByRole('button', { name: /editar clase/i });
    expect(screen.getByRole('button', { name: /eliminar clase/i })).toBeInTheDocument();
  });

  it('oculta el icono de eliminar para Asistente/Editor sin permisoEdicionAgenda (false o ausente)', async () => {
    const jornada = crearJornada({ id: 'jornada-1', fecha: '2026-07-07', instructorId: 'maestro-1' });
    const repository = { listarJornadasPorRangoFechas: jest.fn().mockResolvedValue([jornada]) };
    mockUsuario({ id: 'editor-1', rol: 'Editor', permisoEdicionAgenda: false });

    render(<AgendaView repository={repository as any} />);

    await screen.findByText(/fundamentos taekwondo/i);
    expect(screen.queryByRole('button', { name: /editar clase/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /eliminar clase/i })).not.toBeInTheDocument();
  });

  it('click en el icono de eliminar muestra la confirmacion (alertdialog) SIN abrir el modal de edicion completo', async () => {
    const user = userEvent.setup();
    const jornada = crearJornada({ id: 'jornada-1', fecha: '2026-07-07' });
    const repository = { listarJornadasPorRangoFechas: jest.fn().mockResolvedValue([jornada]) };
    mockUsuario({ id: 'admin-1', rol: 'Admin' });

    render(<AgendaView repository={repository as any} />);

    await user.click(await screen.findByRole('button', { name: /eliminar clase/i }));

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText(/seguro de eliminar esta clase/i)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('confirmar eliminacion llama a eliminarJornadaSegura + registrarAuditoria (fuente agenda, accion eliminar) y refresca la parrilla', async () => {
    const user = userEvent.setup();
    const jornada = crearJornada({ id: 'jornada-1', fecha: '2026-07-07' });
    const repository = {
      listarJornadasPorRangoFechas: jest.fn().mockResolvedValue([jornada]),
      eliminarJornadaSegura: jest.fn().mockResolvedValue(undefined),
      registrarAuditoria: jest.fn().mockResolvedValue(undefined),
    };
    mockUsuario({ id: 'admin-1', rol: 'Admin' });

    render(<AgendaView repository={repository as any} />);

    await user.click(await screen.findByRole('button', { name: /eliminar clase/i }));
    await user.click(screen.getByRole('button', { name: /confirmar eliminacion/i }));

    await waitFor(() => expect(repository.eliminarJornadaSegura).toHaveBeenCalledWith(expect.objectContaining({ id: 'jornada-1' })));
    expect(repository.registrarAuditoria).toHaveBeenCalledWith(
      expect.objectContaining({ fuente: 'agenda', accion: 'eliminar' }),
    );
    await waitFor(() => expect(repository.listarJornadasPorRangoFechas).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('si la jornada ya se opero, ofrece cancelar la clase en lugar de eliminarla, sin cerrar la confirmacion', async () => {
    const user = userEvent.setup();
    const jornada = crearJornada({ id: 'jornada-1', fecha: '2026-07-07', estado: 'en_curso' });
    const repository = {
      listarJornadasPorRangoFechas: jest.fn().mockResolvedValue([jornada]),
      eliminarJornadaSegura: jest.fn().mockRejectedValue(new EliminacionNoPermitidaError('clase_operada')),
    };
    mockUsuario({ id: 'admin-1', rol: 'Admin' });

    render(<AgendaView repository={repository as any} />);

    await user.click(await screen.findByRole('button', { name: /eliminar clase/i }));
    await user.click(screen.getByRole('button', { name: /confirmar eliminacion/i }));

    expect(await screen.findByRole('button', { name: /cancelar la clase en su lugar/i })).toBeInTheDocument();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('el boton Volver cierra la confirmacion sin eliminar nada', async () => {
    const user = userEvent.setup();
    const jornada = crearJornada({ id: 'jornada-1', fecha: '2026-07-07' });
    const repository = {
      listarJornadasPorRangoFechas: jest.fn().mockResolvedValue([jornada]),
      eliminarJornadaSegura: jest.fn().mockResolvedValue(undefined),
    };
    mockUsuario({ id: 'admin-1', rol: 'Admin' });

    render(<AgendaView repository={repository as any} />);

    await user.click(await screen.findByRole('button', { name: /eliminar clase/i }));
    await user.click(screen.getByRole('button', { name: /^volver$/i }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(repository.eliminarJornadaSegura).not.toHaveBeenCalled();
  });
});

// Subtarea 12.10 (Agenda, seccion 14 de "Mejora del módulo Agenda.txt" — "Relación con Clase
// en Vivo"), simplificado 2026-07-16 (pedido explicito del usuario: dos badges por bloque --
// estado academico de 10 valores + este indicador -- se sentia sobrecargado). El badge de
// estado academico se retiro de la grilla (sigue completo en ModalEdicionJornada); la
// parrilla ahora muestra SOLO este indicador de Clase en Vivo, simplificado a 4 valores
// (Proxima/Activa/Finalizada/Cancelada), cruzando `estado` con la ventana horaria ya
// existente (`ventanaClaseEnVivoService.ts`, `LIVE_CLASS_OPEN_BEFORE_MINUTES`/
// `LIVE_CLASS_CLOSE_AFTER_MINUTES` = 15/15, implementadas por el change
// `clase-en-vivo-checkin-trigger-agenda`, NO reinventadas aca). Se identifica con
// `data-testid="indicador-clase-en-vivo-{id}"`.
describe('Subtarea 12.10: indicador de estado de Clase en Vivo en el bloque de la parrilla', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mismo fix de reloj que el describe principal: este bloque tambien es HERMANO, no
    // hereda el override de Date. Ademas, aca "ahora" no es solo para que el bloque caiga
    // en la semana visible -- el indicador de Clase en Vivo compara horarios reales contra
    // "ahora", asi que fijarlo es doblemente necesario.
    global.Date = FechaFija as unknown as DateConstructor;
    (listarAsignacionesPorTenant as jest.Mock).mockResolvedValue([]);
    (obtenerContextoJornada as jest.Mock).mockResolvedValue(contextoVacio);
    mockUsuario();
  });

  afterEach(() => {
    global.Date = RealDate;
  });

  it('una jornada cancelada muestra el indicador "Cancelada"', async () => {
    const jornada = crearJornada({ id: 'jornada-1', fecha: '2026-07-07', estado: 'cancelada' });
    const repository = { listarJornadasPorRangoFechas: jest.fn().mockResolvedValue([jornada]) };

    render(<AgendaView repository={repository as any} />);

    const indicador = await screen.findByTestId('indicador-clase-en-vivo-jornada-1');
    expect(indicador).toHaveTextContent('Cancelada');
  });

  it('una jornada con estado academico "en_curso" muestra el indicador "Clase activa"', async () => {
    const jornada = crearJornada({ id: 'jornada-1', fecha: '2026-07-07', estado: 'en_curso' });
    const repository = { listarJornadasPorRangoFechas: jest.fn().mockResolvedValue([jornada]) };

    render(<AgendaView repository={repository as any} />);

    const indicador = await screen.findByTestId('indicador-clase-en-vivo-jornada-1');
    expect(indicador).toHaveTextContent('Clase activa');
  });

  it('una jornada con estado academico "cerrada" muestra el indicador "Finalizada"', async () => {
    const jornada = crearJornada({ id: 'jornada-1', fecha: '2026-07-07', estado: 'cerrada' });
    const repository = { listarJornadasPorRangoFechas: jest.fn().mockResolvedValue([jornada]) };

    render(<AgendaView repository={repository as any} />);

    const indicador = await screen.findByTestId('indicador-clase-en-vivo-jornada-1');
    expect(indicador).toHaveTextContent('Finalizada');
  });

  it('una jornada dentro de la ventana [horaInicio-15, horaFin+15] (y sin estado en_curso/cerrada/cancelada) muestra "Clase activa" (fusion de la vieja "Disponible para operación")', async () => {
    const ahora = new Date();
    const inicio = new Date(ahora.getTime() - 5 * 60 * 1000);
    const fin = new Date(ahora.getTime() + 30 * 60 * 1000);
    const jornada = crearJornada({
      id: 'jornada-1',
      fecha: ahora.toISOString().slice(0, 10),
      horaInicio: inicio.toISOString().slice(11, 16),
      horaFin: fin.toISOString().slice(11, 16),
      estado: 'confirmada',
    });
    const repository = { listarJornadasPorRangoFechas: jest.fn().mockResolvedValue([jornada]) };

    render(<AgendaView repository={repository as any} />);

    const indicador = await screen.findByTestId('indicador-clase-en-vivo-jornada-1');
    expect(indicador).toHaveTextContent('Clase activa');
  });

  it('una jornada futura del MISMO dia, aun fuera de la ventana, muestra "Próxima"', async () => {
    const ahora = new Date();
    const inicio = new Date(ahora.getTime() + 60 * 60 * 1000);
    const fin = new Date(ahora.getTime() + 120 * 60 * 1000);
    const jornada = crearJornada({
      id: 'jornada-1',
      fecha: ahora.toISOString().slice(0, 10),
      horaInicio: inicio.toISOString().slice(11, 16),
      horaFin: fin.toISOString().slice(11, 16),
      estado: 'confirmada',
    });
    const repository = { listarJornadasPorRangoFechas: jest.fn().mockResolvedValue([jornada]) };

    render(<AgendaView repository={repository as any} />);

    const indicador = await screen.findByTestId('indicador-clase-en-vivo-jornada-1');
    expect(indicador).toHaveTextContent('Próxima');
  });

  it('una jornada futura de OTRO dia tambien muestra "Próxima" (fusion de la vieja "Programada" -- ya no se distingue por dia)', async () => {
    const user = userEvent.setup();
    // La semana visible al montar es la ACTUAL (hoy puede ser Domingo, el ultimo dia de esa
    // semana, sin ningun dia futuro dentro del mismo rango) -- se navega explicitamente a la
    // semana siguiente (mismo patron que el test preexistente "click en semana siguiente...")
    // y se usa el Lunes de esa semana como fecha, que siempre es estrictamente futuro respecto
    // de "hoy" real sin importar que dia de la semana sea hoy.
    const hoyIso = formatearFechaIso(new Date());
    const rangoActual = obtenerRangoSemana(hoyIso);
    const siguienteInicio = obtenerRangoSemana(
      formatearFechaIso(new Date(new Date(`${rangoActual.inicioIso}T00:00:00`).getTime() + 7 * 24 * 60 * 60 * 1000)),
    );
    const jornada = crearJornada({
      id: 'jornada-1',
      fecha: siguienteInicio.inicioIso,
      horaInicio: '10:00',
      horaFin: '11:00',
      estado: 'confirmada',
    });
    const repository = { listarJornadasPorRangoFechas: jest.fn().mockResolvedValue([jornada]) };

    render(<AgendaView repository={repository as any} />);
    await user.click(screen.getByRole('button', { name: /semana siguiente/i }));

    const indicador = await screen.findByTestId('indicador-clase-en-vivo-jornada-1');
    expect(indicador).toHaveTextContent('Próxima');
  });

  it('la grilla ya NO muestra un badge separado de estado academico (solo el indicador de Clase en Vivo)', async () => {
    const jornada = crearJornada({ id: 'jornada-1', fecha: '2026-07-07', estado: 'confirmada' });
    const repository = { listarJornadasPorRangoFechas: jest.fn().mockResolvedValue([jornada]) };

    render(<AgendaView repository={repository as any} />);

    const bloque = await screen.findByTestId('bloque-jornada-jornada-1');
    // "Confirmada" ya no aparece en ningun lado del bloque -- ni como badge de estado
    // academico (retirado) ni por casualidad del indicador de Clase en Vivo (que en este
    // horario/estado muestra "Próxima", no "Confirmada").
    expect(bloque).not.toHaveTextContent('Confirmada');
  });
});
