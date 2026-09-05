/**
 * PRUEBAS DE INTEGRACION — Centro de Estudios, cadena del consultor (Tutor / Estudiante).
 *
 * Que distingue esto de los unitarios que ya existen: aca NO se mockea ninguna capa
 * intermedia. Lo unico simulado es el borde exterior (el SDK de Firestore, via
 * `test-utils/fakeFirestore`) y la identidad del usuario logueado (que es el INPUT del
 * escenario, no un colaborador). Todo lo del medio corre de verdad:
 *
 *   CentroEstudios.tsx
 *     -> resolveStudentsForConsultor()      (servicios/academico/tutorStudentResolver)
 *     -> FirestoreCentroEstudiosRepository  (servicios/academico/centroEstudiosRepository)
 *     -> aplicaAlEstudiante()               (servicios/academico/asignacionService)
 *     -> calcularUrgenciaAsignacion() / ordenarAsignacionesPorUrgencia()
 *     -> prepararAsignacionesCentroEstudios()
 *     -> <AsignacionCard /> / <ProgresoResumenCard />
 *
 * Por que importa: el bug historico de esta pantalla (fix-tutor-role-end-to-end,
 * 2026-07-14) fue un DESAJUSTE DE IDENTIDAD entre capas — CentroEstudios pasaba el Auth
 * UID del padre a una consulta que espera el docId de `estudiantes/{id}`. Cada capa
 * estaba bien por separado y todos los unitarios pasaban: el defecto vivia en la junta.
 * Estas pruebas cubren exactamente esa junta.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { RolUsuario, GrupoEdad, GradoTKD } from '../tipos';

jest.mock('firebase/firestore', () => require('../test-utils/fakeFirestore').crearApiFirestoreFake());

// Menú mobile acordeon (deep-link `?tab=`): CentroEstudios ahora lee useSearchParams() de
// react-router-dom para su tab inicial. Este archivo no renderiza dentro de un <Router>, asi
// que se mockea sin query params -- equivalente al comportamiento previo (fallback 'flujo').
jest.mock('react-router-dom', () => ({ useSearchParams: () => [new URLSearchParams()] }));

jest.mock('../firebase/config', () => ({
  db: {},
  auth: {},
  storage: {},
  messaging: null,
  app: {},
  appCheck: null,
  isFirebaseConfigured: true,
}));

const usuarioLogueado: { valor: any } = { valor: null };
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    usuario: usuarioLogueado.valor,
    login: jest.fn(),
    logout: jest.fn(),
    enviarEnlaceRecuperacion: jest.fn(),
    error: null,
    isSubmitting: false,
    cargandoSesion: false,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// useConfiguracion (modo demo comercial, ConfiguracionClub.esDemoComercial) es una
// preocupación transversal ajena a la cadena del consultor que documenta este archivo -- se
// mockea puntualmente (no se levanta un DataProvider real con todos sus listeners de
// usuarios/programas/eventos/etc., ajenos a este escenario) devolviendo el default (demo
// comercial apagada) para no alterar el comportamiento que ya cubren estos tests.
jest.mock('../context/DataContext', () => ({
  useConfiguracion: () => ({ configClub: { esDemoComercial: false } }),
}));

import { sembrarDoc, limpiarFirestoreFake } from '../test-utils/fakeFirestore';
import CentroEstudios from './CentroEstudios';

const TENANT = 'tenant-gajog';

// --- Fixtures --------------------------------------------------------------------

const enDias = (dias: number): string => {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  return fecha.toISOString();
};

const sembrarEstudiante = (id: string, over: Record<string, any> = {}) =>
  sembrarDoc(`estudiantes/${id}`, {
    tenantId: TENANT,
    nombres: 'Mateo',
    apellidos: 'Pardo',
    correo: 'mateo@gajog.com',
    grupo: GrupoEdad.Infantil,
    grado: GradoTKD.Blanco,
    tutor: { nombres: 'William', apellidos: 'Pardo', correo: 'padre@gajog.com' },
    ...over,
  });

const sembrarAsignacion = (id: string, over: Record<string, any> = {}) =>
  sembrarDoc(`tenants/${TENANT}/asignaciones/${id}`, {
    tenantId: TENANT,
    recursoId: `recurso-${id}`,
    titulo: 'Forma Taeguk 1',
    descripcion: 'Video de la forma completa',
    destinatario: { tipo: 'grupo', grupo: GrupoEdad.Infantil },
    uso: 'estudio',
    momento: 'preparacion',
    obligatoria: true,
    estado: 'publicada',
    creadoPorUid: 'maestro-1',
    creadoEn: enDias(-10),
    actualizadoEn: enDias(-10),
    ...over,
  });

const loguearComo = (rol: RolUsuario, email: string, authUid: string) => {
  usuarioLogueado.valor = {
    id: authUid,
    email,
    nombreUsuario: 'Usuario Logueado',
    numeroIdentificacion: '000',
    whatsapp: '300',
    rol,
    tenantId: TENANT,
  };
};

beforeEach(() => {
  limpiarFirestoreFake();
  usuarioLogueado.valor = null;
  localStorage.clear();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'debug').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// --- Cadena Tutor -----------------------------------------------------------------

describe('Integracion: Tutor -> resolucion de identidad -> asignaciones reales del hijo', () => {
  it('resuelve al hijo por tutor.correo y renderiza sus asignaciones publicadas', async () => {
    sembrarEstudiante('est-hijo-01');
    sembrarAsignacion('asig-forma', { titulo: 'Forma Taeguk 1' });

    // El Auth UID del padre NO tiene nada que ver con el docId del hijo. Ese era el bug:
    // antes se consultaba `estudiantes/uid-padre-999`, que no existe.
    loguearComo(RolUsuario.Tutor, 'padre@gajog.com', 'uid-padre-999');

    render(<CentroEstudios />);

    expect(await screen.findByText('Materiales de Mateo Pardo')).toBeInTheDocument();
    expect(await screen.findByText('Forma Taeguk 1')).toBeInTheDocument();
  });

  it('normaliza el email: el tutor loguea en mayusculas y aun asi resuelve a su hijo', async () => {
    sembrarEstudiante('est-hijo-01', { tutor: { correo: 'padre@gajog.com' } });
    sembrarAsignacion('asig-forma');

    loguearComo(RolUsuario.Tutor, '  PADRE@Gajog.com ', 'uid-padre-999');

    render(<CentroEstudios />);

    expect(await screen.findByText('Forma Taeguk 1')).toBeInTheDocument();
  });

  it('no filtra material de OTRO grupo al hijo (destinatario por grupo se respeta end-to-end)', async () => {
    sembrarEstudiante('est-hijo-01', { grupo: GrupoEdad.Infantil });
    sembrarAsignacion('asig-infantil', { titulo: 'Material Infantil' });
    sembrarAsignacion('asig-adultos', {
      titulo: 'Material Adultos',
      destinatario: { tipo: 'grupo', grupo: GrupoEdad.Adultos },
    });

    loguearComo(RolUsuario.Tutor, 'padre@gajog.com', 'uid-padre-999');

    render(<CentroEstudios />);

    expect(await screen.findByText('Material Infantil')).toBeInTheDocument();
    expect(screen.queryByText('Material Adultos')).not.toBeInTheDocument();
  });

  it('no muestra asignaciones en borrador (solo estado publicada llega al consultor)', async () => {
    sembrarEstudiante('est-hijo-01');
    sembrarAsignacion('asig-publicada', { titulo: 'Material Publicado' });
    sembrarAsignacion('asig-borrador', { titulo: 'Material Borrador', estado: 'borrador' });

    loguearComo(RolUsuario.Tutor, 'padre@gajog.com', 'uid-padre-999');

    render(<CentroEstudios />);

    expect(await screen.findByText('Material Publicado')).toBeInTheDocument();
    expect(screen.queryByText('Material Borrador')).not.toBeInTheDocument();
  });

  it('aisla por tenant: un hijo homonimo en otro tenant no resuelve', async () => {
    sembrarDoc('estudiantes/est-otro-tenant', {
      tenantId: 'tenant-ajeno',
      nombres: 'Mateo',
      apellidos: 'Impostor',
      grupo: GrupoEdad.Infantil,
      tutor: { correo: 'padre@gajog.com' },
    });
    sembrarAsignacion('asig-forma');

    loguearComo(RolUsuario.Tutor, 'padre@gajog.com', 'uid-padre-999');

    render(<CentroEstudios />);

    await waitFor(() => {
      expect(screen.queryByText(/Cargando Centro de Estudios/i)).not.toBeInTheDocument();
    });
    expect(screen.queryByText('Materiales de Mateo Impostor')).not.toBeInTheDocument();
    expect(screen.queryByText('Forma Taeguk 1')).not.toBeInTheDocument();
  });

  it('tutor sin hijo vinculado: estado vacio explicito, sin crash', async () => {
    sembrarAsignacion('asig-forma');
    loguearComo(RolUsuario.Tutor, 'padre-sin-hijos@gajog.com', 'uid-padre-999');

    render(<CentroEstudios />);

    await waitFor(() => {
      expect(screen.queryByText(/Cargando Centro de Estudios/i)).not.toBeInTheDocument();
    });
    expect(screen.getByText(/Aun no tienes materiales asignados/i)).toBeInTheDocument();
  });

  it('no expone el stepper de gestion de contenido a un Tutor', async () => {
    sembrarEstudiante('est-hijo-01');
    sembrarAsignacion('asig-forma');
    loguearComo(RolUsuario.Tutor, 'padre@gajog.com', 'uid-padre-999');

    render(<CentroEstudios />);

    await screen.findByText('Forma Taeguk 1');
    expect(screen.queryByLabelText('Flujo principal de Centro de Estudios')).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Flujo academico/i })).not.toBeInTheDocument();
  });
});

// --- Cadena Estudiante ------------------------------------------------------------

describe('Integracion: Estudiante -> resolucion por correo propio -> sus materiales', () => {
  it('resuelve por `correo` (no por tutor.correo) y renderiza sus asignaciones', async () => {
    sembrarEstudiante('est-alumno-01', {
      nombres: 'Sofia',
      apellidos: 'Ramirez',
      correo: 'sofia@gajog.com',
      tutor: { correo: 'otro-padre@gajog.com' },
    });
    sembrarAsignacion('asig-forma', { titulo: 'Forma Taeguk 2' });

    loguearComo(RolUsuario.Estudiante, 'sofia@gajog.com', 'uid-alumno-777');

    render(<CentroEstudios />);

    expect(await screen.findByText('Mis materiales')).toBeInTheDocument();
    expect(await screen.findByText('Forma Taeguk 2')).toBeInTheDocument();
  });

  it('un estudiante no ve el material de otro estudiante del mismo tenant', async () => {
    sembrarEstudiante('est-sofia', {
      nombres: 'Sofia',
      correo: 'sofia@gajog.com',
      grupo: GrupoEdad.Infantil,
    });
    sembrarEstudiante('est-diego', {
      nombres: 'Diego',
      correo: 'diego@gajog.com',
      grupo: GrupoEdad.Cadetes,
    });
    sembrarAsignacion('asig-solo-diego', {
      titulo: 'Material Solo Diego',
      destinatario: { tipo: 'estudiante', estudianteIds: ['est-diego'] },
    });

    loguearComo(RolUsuario.Estudiante, 'sofia@gajog.com', 'uid-alumno-777');

    render(<CentroEstudios />);

    await waitFor(() => {
      expect(screen.queryByText(/Cargando Centro de Estudios/i)).not.toBeInTheDocument();
    });
    expect(screen.queryByText('Material Solo Diego')).not.toBeInTheDocument();
  });

  it('destinatario por estudiante usa el docId real, no el Auth UID del login', async () => {
    sembrarEstudiante('est-sofia', { nombres: 'Sofia', correo: 'sofia@gajog.com' });
    sembrarAsignacion('asig-nominal', {
      titulo: 'Material Nominal',
      destinatario: { tipo: 'estudiante', estudianteIds: ['est-sofia'] },
    });

    loguearComo(RolUsuario.Estudiante, 'sofia@gajog.com', 'uid-alumno-777');

    render(<CentroEstudios />);

    expect(await screen.findByText('Material Nominal')).toBeInTheDocument();
  });
});

// --- Cadena de urgencia / resumen -------------------------------------------------

describe('Integracion: urgencia y resumen de progreso derivados de datos reales', () => {
  it('ordena las asignaciones por urgencia calculada desde fechaCierre', async () => {
    sembrarEstudiante('est-hijo-01');
    sembrarAsignacion('asig-lejana', { titulo: 'Entrega Lejana', fechaCierre: enDias(30) });
    sembrarAsignacion('asig-urgente', { titulo: 'Entrega Urgente', fechaCierre: enDias(1) });
    sembrarAsignacion('asig-media', { titulo: 'Entrega Media', fechaCierre: enDias(5) });

    loguearComo(RolUsuario.Tutor, 'padre@gajog.com', 'uid-padre-999');

    render(<CentroEstudios />);

    await screen.findByText('Entrega Urgente');

    const titulos = screen
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent);

    expect(titulos).toEqual(['Entrega Urgente', 'Entrega Media', 'Entrega Lejana']);
  });

  it('el resumen de progreso solo aparece cuando hay asignaciones reales', async () => {
    sembrarEstudiante('est-hijo-01');
    loguearComo(RolUsuario.Tutor, 'padre@gajog.com', 'uid-padre-999');

    const { unmount } = render(<CentroEstudios />);
    await waitFor(() => {
      expect(screen.queryByText(/Cargando Centro de Estudios/i)).not.toBeInTheDocument();
    });
    expect(screen.queryByText(/Progreso academico/i)).not.toBeInTheDocument();
    unmount();

    sembrarAsignacion('asig-forma');
    render(<CentroEstudios />);
    expect(await screen.findByText('Forma Taeguk 1')).toBeInTheDocument();
  });
});
