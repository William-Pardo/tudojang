import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AsignacionesView from './AsignacionesView';
import type { RecursoAcademico } from '../../models/academico/recurso';
import type { AsignacionAcademica } from '../../models/academico/asignacion';
import type { JornadaRepository } from '../../servicios/academico/jornadaRepository';
import type { ProgramaRepository } from '../../servicios/academico/programaRepository';
import type { InscripcionRepository } from '../../servicios/academico/inscripcionRepository';
import { GradoTKD, GrupoEdad, type Estudiante } from '../../tipos';

// ---------------------------------------------------------------------------
// Fase 4 (rewrite completo, ver "CIERRE SDD CLAUDE CODE - CENTRO ESTUDIOS.md"
// seccion 3.4 y "CIERRE CENTRO DE ESTUDIOS.md" 11.7): este archivo reemplaza
// por completo la version anterior (~1017 lineas), que probaba dos flujos que
// la Fase 3 elimino del componente real: el carrusel plano "Clase activa" (no
// embebido) y la "Publicacion en lote" por `gruposPublicacion[]` (checkboxes
// de material + clase + "Publicar todo"). Ninguno de los dos existe hoy en
// `AsignacionesView.tsx`: la produccion SIEMPRE lo renderiza con `embedded`
// (ver `vistas/CentroEstudios.tsx`), y el unico flujo para publicar material
// es el asistente de 3 pasos `AsignarMaterialWizard` via "+ Agregar material".
//
// Decision de consolidacion (pedida explicitamente para esta reescritura):
// existen 3 archivos de test aislados, creados junto a este durante las Fases
// 3/3.5/3.6 para no tocar este archivo (que seguia roto a proposito):
//   - `AsignacionesView.wizard.test.tsx` (Fase 3): punto de entrada unico,
//     crear/exclusion/editar/eliminar/tema. ABSORBIDO aqui: su cobertura es
//     exactamente el alcance central de esta Fase 4 (ver describes de mas
//     abajo). Se ELIMINA ese archivo para no duplicar las mismas aserciones.
//   - `AsignacionesView.instructorSeleccion.test.tsx` (Fase 3.5): gating de
//     rol Admin/Editor en el selector de Instructor del modal de Programa.
//     SE MANTIENE separado: es un sub-flujo distinto (seleccion de instructor
//     dentro del formulario de Programa) con sus propias regresiones
//     documentadas (slug vs UID real); no se solapa con nada de lo que cubre
//     este archivo.
//   - `AsignacionesView.claseActivaHeader.test.tsx` (Fase 3.6): detalle visual
//     del header de navegacion de clase (botones icono-only, ausencia de la
//     linea Instructor/Grupo). SE MANTIENE separado: es una regresion de
//     estructura DOM/accesibilidad puramente cosmetica, sin relacion con el
//     comportamiento funcional que cubre este archivo.
jest.setTimeout(15000);

jest.mock('../../servicios/academico/bibliotecaService', () => ({
  listarRecursosAprobados: jest.fn(),
}));

// Se mantiene real todo lo demas del servicio (en particular `publishAsignacion`,
// que valida el recurso aprobado y arma la asignacion final; se llama
// directamente desde AsignacionesView.tsx, no via prop inyectable) y solo se
// reemplaza `listarAsignacionesPorTenant`, que es la unica llamada de este
// servicio sin DI por props, para poder simular hidratacion real tras un
// "reload" (remount) sin depender de Firebase real.
jest.mock('../../servicios/academico/asignacionService', () => ({
  ...jest.requireActual('../../servicios/academico/asignacionService'),
  listarAsignacionesPorTenant: jest.fn(),
}));

import { listarRecursosAprobados } from '../../servicios/academico/bibliotecaService';
import { listarAsignacionesPorTenant } from '../../servicios/academico/asignacionService';

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

// Coincide con el id hardcodeado de `programaInicial` en AsignacionesView.tsx:
// es el unico programa disponible por defecto cuando
// `repositoryPrograma.listarProgramasPorTenant` resuelve vacio (el caso por
// defecto de `crearRepoProgramaFake`). `generarJornadasLocalesPrograma` deriva
// de este id una jornada sintetica determinista (`jornada-{id}-referencia`)
// cuando el programa todavia no tiene jornadas reales persistidas — se usa
// para anclar el `jornadaId` de una asignacion "hidratada" a la clase activa.
const PROGRAMA_ID_DEMO = 'programa-infantil-iniciacion-jul-sep-2026';
const JORNADA_SINTETICA_ID = `jornada-${PROGRAMA_ID_DEMO}-referencia`;

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

const materialB: RecursoAcademico = {
  id: 'recurso-b',
  tenantId: 'tenant-real',
  proveedor: 'google_drive',
  externalFileId: 'drive-b',
  nombre: 'Material B refuerzo',
  mimeType: 'video/mp4',
  ficha: { disciplina: 'Taekwondo', tipo: 'video', usos: ['refuerzo'], tags: ['combate'] },
  estado: 'aprobado',
  creadoPorUid: 'admin',
  creadoEn: '2026-06-27T00:00:00.000Z',
  actualizadoEn: '2026-06-27T00:00:00.000Z',
};

const crearRepoJornadaFake = (overrides: Partial<JornadaRepository> = {}): JornadaRepository => ({
  guardarJornada: jest.fn().mockResolvedValue(undefined),
  guardarEjecucion: jest.fn().mockResolvedValue(undefined),
  registrarAuditoria: jest.fn().mockResolvedValue(undefined),
  existeConflictoHorario: jest.fn().mockResolvedValue(false),
  listarJornadasPorTenant: jest.fn().mockResolvedValue([]),
  guardarJornadasEnLote: jest.fn().mockResolvedValue(undefined),
  actualizarTemaJornada: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

const crearRepoProgramaFake = (overrides: Partial<ProgramaRepository> = {}): ProgramaRepository => ({
  guardarPrograma: jest.fn().mockResolvedValue(undefined),
  listarProgramasPorTenant: jest.fn().mockResolvedValue([]),
  ...overrides,
} as unknown as ProgramaRepository);

const renderVista = (overrides: Record<string, unknown> = {}) => {
  const publicarAsignacionFn = jest.fn().mockResolvedValue({ ok: true, id: '' });
  const actualizarAsignacionFn = jest.fn().mockResolvedValue({ ok: true });
  const eliminarAsignacionFn = jest.fn().mockResolvedValue({ ok: true });
  const repositoryJornada = crearRepoJornadaFake();
  const repositoryPrograma = crearRepoProgramaFake();
  const utils = render(
    <AsignacionesView
      embedded
      recursos={[materialA, materialB]}
      publicarAsignacionFn={publicarAsignacionFn}
      actualizarAsignacionFn={actualizarAsignacionFn}
      eliminarAsignacionFn={eliminarAsignacionFn}
      repositoryJornada={repositoryJornada}
      repositoryPrograma={repositoryPrograma}
      {...overrides}
    />
  );
  return { ...utils, publicarAsignacionFn, actualizarAsignacionFn, eliminarAsignacionFn, repositoryJornada, repositoryPrograma };
};

// Recorre el asistente de punta a punta creando una asignacion para el
// material indicado, con un unico grado seleccionado en el Paso 3.
const crearAsignacion = async (
  user: ReturnType<typeof userEvent.setup>,
  nombreMaterial: RegExp,
  grado: RegExp = /^Blanco$/,
) => {
  await user.click(screen.getByRole('button', { name: /\+ agregar material/i }));
  await user.click(await screen.findByRole('button', { name: nombreMaterial }));
  await user.click(screen.getByRole('button', { name: /continuar/i }));
  await user.click(screen.getByRole('button', { name: /continuar/i }));
  await user.click(screen.getByRole('button', { name: grado }));
  await user.click(screen.getByRole('button', { name: /^asignar$/i }));
};

// Completa lo minimo indispensable para que "Aceptar" quede habilitado en el
// modal de Programa (programaFormularioValido): tema, un dia de horario y un
// tag. El resto (nombre, fechas, sede, grupo, instructor) ya viene pre-cargado
// por `abrirCrearPrograma()`/`abrirEditarPrograma()`.
const completarFormularioMinimo = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText(/^tema$/i), 'Tema de prueba');
  await user.click(screen.getByRole('button', { name: /^lun$/i }));
  await user.click(screen.getByRole('button', { name: /^infantil$/i }));
};

describe('AsignacionesView - punto de entrada unico del asistente unificado (Fase 4)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (listarRecursosAprobados as jest.Mock).mockResolvedValue([materialA, materialB]);
    (listarAsignacionesPorTenant as jest.Mock).mockResolvedValue([]);
  });

  it('el unico flujo para publicar material es "+ Agregar material", que abre el asistente', async () => {
    const user = userEvent.setup();
    renderVista();

    // Nada de los flujos viejos que la Fase 3 elimino: ni el boton de lote, ni
    // los grupos de publicacion, ni el select de Destinatario del formulario
    // plano, ni la tabla "Material publicado".
    expect(screen.queryByRole('button', { name: /publicar todo/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/publicaci[oó]n en lote/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /grupo 1/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^destinatario$/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /material publicado/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /\+ agregar material/i }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /material a fundamentos/i })).toBeInTheDocument();
  });

  it('crear: recorre el asistente completo y publica via publicarAsignacionFn; la fila aparece en Materiales asignados', async () => {
    const user = userEvent.setup();
    const { publicarAsignacionFn } = renderVista();

    await crearAsignacion(user, /material a fundamentos/i);

    await waitFor(() => expect(publicarAsignacionFn).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/material a fundamentos/i)).toBeInTheDocument();
  });
});

describe('exclusion de duplicados en el picker del asistente', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (listarRecursosAprobados as jest.Mock).mockResolvedValue([materialA, materialB]);
    (listarAsignacionesPorTenant as jest.Mock).mockResolvedValue([]);
  });

  it('un material ya asignado a la clase activa no vuelve a ofrecerse en el Paso 1; el resto sigue disponible', async () => {
    const user = userEvent.setup();
    renderVista();

    await crearAsignacion(user, /material a fundamentos/i);
    await screen.findByText(/material a fundamentos/i);

    await user.click(screen.getByRole('button', { name: /\+ agregar material/i }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).queryByRole('button', { name: /material a fundamentos/i })).not.toBeInTheDocument();
    expect(within(dialogo).getByRole('button', { name: /material b refuerzo/i })).toBeInTheDocument();
  });

  it('al editar una asignacion, su propio material actual no se excluye contra si mismo', async () => {
    const user = userEvent.setup();
    renderVista();

    await crearAsignacion(user, /material a fundamentos/i);
    await screen.findByText(/material a fundamentos/i);

    await user.click(screen.getByRole('button', { name: /editar material a fundamentos/i }));
    const dialogo = await screen.findByRole('dialog');
    // El material propio de la asignacion en edicion debe seguir mostrando su
    // titulo real en el chip del Paso 2, no un placeholder generico: antes de
    // este fix se excluia de `materialesDisponiblesWizard` como si fuera un
    // duplicado de OTRA asignacion, aunque fuera la misma que se esta editando.
    expect(within(dialogo).getByText(/material a fundamentos/i)).toBeInTheDocument();
    expect(within(dialogo).queryByText(/^material asignado$/i)).not.toBeInTheDocument();
  });
});

describe('pildora de tema: editable inline, persiste sin abrir el asistente', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (listarRecursosAprobados as jest.Mock).mockResolvedValue([materialA, materialB]);
    (listarAsignacionesPorTenant as jest.Mock).mockResolvedValue([]);
  });

  it('muestra el tema actual de la clase activa', async () => {
    renderVista();
    expect(await screen.findByRole('button', { name: /tema de la clase/i })).toHaveTextContent(/iniciaci[oó]n t[eé]cnica/i);
  });

  it('al perder el foco (blur), persiste el nuevo tema via actualizarTemaJornada sin abrir el asistente', async () => {
    const user = userEvent.setup();
    const { repositoryJornada } = renderVista();

    const pildoraTema = await screen.findByRole('button', { name: /tema de la clase/i });
    await user.click(pildoraTema);

    const inputTema = screen.getByLabelText(/tema de la clase/i);
    await user.clear(inputTema);
    await user.type(inputTema, 'Patadas frontales');
    await user.tab();

    await waitFor(() => expect(repositoryJornada.actualizarTemaJornada).toHaveBeenCalled());
    const [tenantArg, jornadaArg, temaArg] = (repositoryJornada.actualizarTemaJornada as jest.Mock).mock.calls[0];
    expect(tenantArg).toBe('tenant-real');
    expect(typeof jornadaArg).toBe('string');
    expect(temaArg).toBe('Patadas frontales');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('al presionar Enter, tambien persiste el tema sin abrir el asistente', async () => {
    const user = userEvent.setup();
    const { repositoryJornada } = renderVista();

    const pildoraTema = await screen.findByRole('button', { name: /tema de la clase/i });
    await user.click(pildoraTema);

    const inputTema = screen.getByLabelText(/tema de la clase/i);
    await user.clear(inputTema);
    await user.type(inputTema, 'Bloqueos y defensa{Enter}');

    await waitFor(() => expect(repositoryJornada.actualizarTemaJornada).toHaveBeenCalledWith(
      'tenant-real',
      expect.any(String),
      'Bloqueos y defensa',
    ));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('hidratacion real de asignaciones tras un reload (listarAsignacionesPorTenant)', () => {
  const asignacionHidratada: AsignacionAcademica = {
    id: 'asignacion-real-hidratada-1',
    tenantId: 'tenant-real',
    recursoId: materialA.id,
    jornadaId: JORNADA_SINTETICA_ID,
    titulo: materialA.nombre,
    destinatario: { tipo: 'grupo', grupo: 'Infantil', grados: ['Blanco'] },
    uso: 'estudio',
    momento: 'preparacion',
    obligatoria: true,
    fechaApertura: '2026-07-01T00:00:00.000Z',
    fechaCierre: '2026-09-30T23:59:59.000Z',
    estado: 'publicada',
    creadoPorUid: 'maestro-real',
    creadoEn: '2026-07-01T00:00:00.000Z',
    actualizadoEn: '2026-07-01T00:00:00.000Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (listarRecursosAprobados as jest.Mock).mockResolvedValue([materialA, materialB]);
  });

  it('hidrata asignaciones publicadas reales del tenant al montar, sin necesidad de crear nada en esta sesion', async () => {
    (listarAsignacionesPorTenant as jest.Mock).mockResolvedValue([asignacionHidratada]);
    renderVista();

    expect(await screen.findByText(materialA.nombre)).toBeInTheDocument();
    expect(listarAsignacionesPorTenant).toHaveBeenCalledWith('tenant-real');
  });

  it('permite editar una asignacion hidratada real: abre el asistente prellenado y llama actualizarAsignacionFn con su id real', async () => {
    (listarAsignacionesPorTenant as jest.Mock).mockResolvedValue([asignacionHidratada]);
    const user = userEvent.setup();
    const { actualizarAsignacionFn } = renderVista();

    await screen.findByText(materialA.nombre);
    await user.click(screen.getByRole('button', { name: new RegExp(`editar ${materialA.nombre}`, 'i') }));

    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText(/editar asignaci[oó]n/i)).toBeInTheDocument();

    await user.click(within(dialogo).getByRole('button', { name: /continuar/i }));
    // Snapshot inicial trae grados: ['Blanco']; agregar 'Amarillo' habilita "Asignar".
    await user.click(within(dialogo).getByRole('button', { name: /^Amarillo$/ }));
    await user.click(within(dialogo).getByRole('button', { name: /^asignar$/i }));

    await waitFor(() => expect(actualizarAsignacionFn).toHaveBeenCalledWith(
      expect.objectContaining({
        asignacion: expect.objectContaining({ id: asignacionHidratada.id }),
      }),
    ));
  });

  it('permite eliminar una asignacion hidratada real: llama eliminarAsignacionFn con su id real y la fila desaparece', async () => {
    (listarAsignacionesPorTenant as jest.Mock).mockResolvedValue([asignacionHidratada]);
    const user = userEvent.setup();
    const { eliminarAsignacionFn } = renderVista();

    await screen.findByText(materialA.nombre);
    await user.click(screen.getByRole('button', { name: new RegExp(`eliminar ${materialA.nombre}`, 'i') }));
    await user.click(await screen.findByRole('button', { name: /^eliminar$/i }));

    await waitFor(() => expect(eliminarAsignacionFn).toHaveBeenCalledWith({
      tenantId: 'tenant-real',
      asignacionId: asignacionHidratada.id,
    }));
    await waitFor(() => expect(screen.queryByText(materialA.nombre)).not.toBeInTheDocument());
  });
});

describe('destinatario, grupo y grados: extremo a extremo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (listarRecursosAprobados as jest.Mock).mockResolvedValue([materialA, materialB]);
    (listarAsignacionesPorTenant as jest.Mock).mockResolvedValue([]);
  });

  it('el draft siempre resuelve destinatario "grupo" y persiste el grupo objetivo y los grados elegidos', async () => {
    const user = userEvent.setup();
    const { publicarAsignacionFn } = renderVista();

    await user.click(screen.getByRole('button', { name: /\+ agregar material/i }));
    await user.click(await screen.findByRole('button', { name: /material a fundamentos/i }));
    await user.click(screen.getByRole('button', { name: /continuar/i }));

    const dialogo = screen.getByRole('dialog');
    await user.selectOptions(within(dialogo).getByLabelText(/grupo objetivo/i), 'Precadetes');
    await user.click(within(dialogo).getByRole('button', { name: /continuar/i }));

    await user.click(within(dialogo).getByRole('button', { name: /^Blanco$/ }));
    await user.click(within(dialogo).getByRole('button', { name: /^Amarillo$/ }));
    await user.click(within(dialogo).getByRole('button', { name: /^asignar$/i }));

    await waitFor(() => expect(publicarAsignacionFn).toHaveBeenCalled());
    const llamada = publicarAsignacionFn.mock.calls[0][0];
    expect(llamada.asignacion.destinatario).toEqual({
      tipo: 'grupo',
      grupo: 'Precadetes',
      grados: ['Blanco', 'Amarillo'],
    });
  });

  it('"Todos los grados" selecciona los 13 grados reales de una vez', async () => {
    const user = userEvent.setup();
    const { publicarAsignacionFn } = renderVista();

    await crearAsignacion(user, /material a fundamentos/i, /^todos los grados$/i);

    await waitFor(() => expect(publicarAsignacionFn).toHaveBeenCalled());
    const llamada = publicarAsignacionFn.mock.calls[0][0];
    expect(llamada.asignacion.destinatario.grados).toHaveLength(13);
  });
});

describe('Step1 del asistente: badge de coincidencia de tags con el programa', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (listarRecursosAprobados as jest.Mock).mockResolvedValue([materialA, materialB]);
    (listarAsignacionesPorTenant as jest.Mock).mockResolvedValue([]);
  });

  it('muestra cuantos materiales coinciden con los tags del programa y permite revelar los que no matchean', async () => {
    const user = userEvent.setup();
    renderVista();

    await user.click(screen.getByRole('button', { name: /\+ agregar material/i }));
    const dialogo = await screen.findByRole('dialog');

    // El programa inicial trae tags: ['infantil', 'iniciación', 'patada frontal'].
    // Material A (tags: ['infantil']) matchea; Material B (tags: ['combate']) no.
    const textoConteo = within(dialogo).getByText(/materiales coinciden con los tags del programa/i);
    expect(textoConteo.textContent).toMatch(/^1\s+materiales coinciden/i);
    expect(within(dialogo).getByRole('button', { name: /material a fundamentos/i })).toBeInTheDocument();
    expect(within(dialogo).queryByRole('button', { name: /material b refuerzo/i })).not.toBeInTheDocument();

    await user.click(within(dialogo).getByText(/ver 1 sin match/i));
    expect(within(dialogo).getByRole('button', { name: /material b refuerzo/i })).toBeInTheDocument();
  });

  it('cada material coincidente muestra el badge con su cantidad de tags coincidentes', async () => {
    const user = userEvent.setup();
    renderVista();

    await user.click(screen.getByRole('button', { name: /\+ agregar material/i }));
    const dialogo = await screen.findByRole('dialog');
    const botonMaterialA = within(dialogo).getByRole('button', { name: /material a fundamentos/i });
    expect(within(botonMaterialA).getByText(/^1 tag$/)).toBeInTheDocument();
  });
});

describe('bridge con Biblioteca: recursoIdsParaLote abre el asistente con material preseleccionado', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (listarRecursosAprobados as jest.Mock).mockResolvedValue([materialA, materialB]);
    (listarAsignacionesPorTenant as jest.Mock).mockResolvedValue([]);
  });

  it('al recibir recursoIdsParaLote, abre el asistente en el Paso 1 con ese material ya seleccionado', async () => {
    renderVista({ recursoIdsParaLote: [materialA.id] });

    const dialogo = await screen.findByRole('dialog');
    const botonMaterialA = within(dialogo).getByRole('button', { name: /material a fundamentos/i });
    expect(botonMaterialA).toHaveAttribute('aria-pressed', 'true');
    // La preseleccion ya deja habilitado "Continuar" sin necesidad de elegir nada mas.
    expect(within(dialogo).getByRole('button', { name: /continuar/i })).toBeEnabled();
  });

  it('el resto del material sigue disponible y seleccionable, sin perder la preseleccion entrante', async () => {
    const user = userEvent.setup();
    renderVista({ recursoIdsParaLote: [materialA.id] });

    const dialogo = await screen.findByRole('dialog');
    await user.click(within(dialogo).getByText(/ver 1 sin match/i));
    const botonMaterialB = within(dialogo).getByRole('button', { name: /material b refuerzo/i });
    await user.click(botonMaterialB);

    expect(botonMaterialB).toHaveAttribute('aria-pressed', 'true');
    expect(within(dialogo).getByRole('button', { name: /material a fundamentos/i })).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('Programa academico: crear, validar y editar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (listarRecursosAprobados as jest.Mock).mockResolvedValue([materialA, materialB]);
    (listarAsignacionesPorTenant as jest.Mock).mockResolvedValue([]);
  });

  it('renderiza el modal de Programa con los campos contractuales', async () => {
    const user = userEvent.setup();
    renderVista();

    await user.click(screen.getByRole('button', { name: /editar programa/i }));
    const dialog = screen.getByRole('dialog', { name: /editar programa/i });

    expect(within(dialog).getByLabelText(/nombre del programa/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/fecha inicio/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/fecha fin/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/instructor/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/^sede$/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/grupo objetivo/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/^tema$/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/^tags$/i)).toBeInTheDocument();
  });

  it('bloquea Aceptar si falta el nombre del programa', async () => {
    const user = userEvent.setup();
    renderVista();

    await user.click(screen.getByRole('button', { name: /crear programa/i }));
    await user.clear(screen.getByLabelText(/nombre del programa/i));

    expect(screen.getByRole('button', { name: /^aceptar$/i })).toBeDisabled();
  });

  it('bloquea Aceptar si no tiene dias de horario o tags academicos', async () => {
    const user = userEvent.setup();
    renderVista();

    await user.click(screen.getByRole('button', { name: /editar programa/i }));
    expect(screen.getByRole('button', { name: /^aceptar$/i })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /^lun$/i }));
    expect(screen.getByRole('button', { name: /^aceptar$/i })).toBeEnabled();

    await user.clear(within(screen.getByRole('dialog', { name: /editar programa/i })).getByLabelText(/^tags$/i));
    expect(screen.getByRole('button', { name: /^aceptar$/i })).toBeDisabled();
  });

  it('pide confirmacion al cerrar el modal con cambios sin guardar', async () => {
    const user = userEvent.setup();
    renderVista();

    await user.click(screen.getByRole('button', { name: /editar programa/i }));
    await user.type(within(screen.getByRole('dialog', { name: /editar programa/i })).getByLabelText(/nombre del programa/i), ' actualizado');
    await user.click(screen.getByRole('button', { name: /cerrar formulario de programa/i }));

    expect(screen.getByRole('heading', { name: /descartar cambios/i })).toBeInTheDocument();
  });

  it('crea un programa nuevo, genera y persiste sus jornadas reales al confirmar', async () => {
    const user = userEvent.setup();
    const { repositoryJornada, repositoryPrograma } = renderVista();

    await user.click(screen.getByRole('button', { name: /crear programa/i }));
    await completarFormularioMinimo(user);
    await user.click(screen.getByRole('button', { name: /^aceptar$/i }));
    const dialogConfirmar = screen.getByText('Confirmar programa').closest('[role="dialog"]') as HTMLElement;
    await user.click(within(dialogConfirmar).getByRole('button', { name: /^confirmar$/i }));

    await waitFor(() => expect(repositoryJornada.guardarJornadasEnLote).toHaveBeenCalledTimes(1));
    const jornadasGeneradas = (repositoryJornada.guardarJornadasEnLote as jest.Mock).mock.calls[0][0];
    expect(jornadasGeneradas.length).toBeGreaterThan(0);
    expect(repositoryPrograma.guardarPrograma).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-real',
      tags: ['infantil'],
      estado: 'publicado',
    }));
  });

  it('al editar un programa existente, se reutiliza su ID de programa, se reutiliza su ID de ejecucion, y se eliminan las jornadas no cerradas anteriores', async () => {
    const user = userEvent.setup();
    const programaReal = {
      id: 'programa-real-1',
      tenantId: 'tenant-real',
      nombre: 'Programa ya guardado',
      descripcion: 'Desc',
      version: 1,
      estado: 'publicado' as const,
      unidades: [],
      creadoEn: '2026-01-01T00:00:00.000Z',
      actualizadoEn: '2026-01-01T00:00:00.000Z',
      tags: ['grados-superiores'],
    };

    const jornadaAntiguaBorrador = {
      id: 'jornada-vieja-borrador',
      tenantId: 'tenant-real',
      programaId: 'programa-real-1',
      ejecucionProgramaId: 'ejecucion-programa-real-1',
      grupoId: 'infantil',
      sedeId: 'sede-principal',
      espacioId: 'tatami-1',
      instructorId: 'maestro-1',
      fecha: '2026-07-06',
      horaInicio: '08:00',
      horaFin: '09:00',
      estado: 'borrador' as const,
      objetivosPlaneados: ['obj-1'],
      objetivosImpartidos: [],
      asistenciaRegistrada: false,
      creadoEn: '2026-07-01T00:00:00.000Z',
      actualizadoEn: '2026-07-01T00:00:00.000Z',
    };

    const jornadaAntiguaCerrada = {
      ...jornadaAntiguaBorrador,
      id: 'jornada-vieja-cerrada',
      estado: 'cerrada' as const,
      asistenciaRegistrada: true,
      objetivosImpartidos: ['obj-1'],
    };

    const repositoryJornada = crearRepoJornadaFake({
      listarJornadasPorTenant: jest.fn().mockResolvedValue([jornadaAntiguaBorrador, jornadaAntiguaCerrada]),
      eliminarJornadasEnLote: jest.fn().mockResolvedValue(undefined),
    });

    const repositoryPrograma = crearRepoProgramaFake({
      listarProgramasPorTenant: jest.fn().mockResolvedValue([programaReal]),
      guardarPrograma: jest.fn().mockResolvedValue(undefined),
    });

    renderVista({
      repositoryJornada,
      repositoryPrograma,
    });

    // Seleccionar el programa
    const select = await screen.findByRole('combobox', { name: /programa/i });
    await user.selectOptions(select, 'programa-real-1');

    // Clic en Editar programa
    await user.click(screen.getByRole('button', { name: /editar programa/i }));
    
    // Rellenar lo minimo (tema y dia)
    await completarFormularioMinimo(user);

    // Clic en Aceptar y Confirmar
    await user.click(screen.getByRole('button', { name: /^aceptar$/i }));
    const dialogConfirmar = screen.getByText('Confirmar programa').closest('[role="dialog"]') as HTMLElement;
    await user.click(within(dialogConfirmar).getByRole('button', { name: /^confirmar$/i }));

    // Debe eliminar solo la jornada borrador (no la cerrada)
    await waitFor(() => {
      expect(repositoryJornada.eliminarJornadasEnLote).toHaveBeenCalledWith(
        'tenant-real',
        ['jornada-vieja-borrador']
      );
    });

    // Debe guardar la ejecucion con el ID derivado
    expect(repositoryJornada.guardarEjecucion).toHaveBeenCalledWith(expect.objectContaining({
      id: 'ejecucion-programa-real-1',
      programaId: 'programa-real-1',
    }));

    // Debe guardar el programa con su ID original
    expect(repositoryPrograma.guardarPrograma).toHaveBeenCalledWith(expect.objectContaining({
      id: 'programa-real-1',
    }));
  });

  it('al montar, lee los programas reales del tenant y los agrega a la bandeja', async () => {
    const programaReal = {
      id: 'programa-real-1',
      tenantId: 'tenant-real',
      nombre: 'Programa ya guardado',
      descripcion: 'Desc',
      version: 1,
      estado: 'publicado' as const,
      unidades: [],
      creadoEn: '2026-01-01T00:00:00.000Z',
      actualizadoEn: '2026-01-01T00:00:00.000Z',
      tags: ['grados-superiores'],
    };

    renderVista({
      repositoryPrograma: crearRepoProgramaFake({
        listarProgramasPorTenant: jest.fn().mockResolvedValue([programaReal]),
      }),
    });

    expect(await screen.findByRole('option', { name: /programa ya guardado/i })).toBeInTheDocument();
  });
});

describe('Matricular estudiantes (Fase 0: roster explicito de matricula)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (listarRecursosAprobados as jest.Mock).mockResolvedValue([materialA, materialB]);
    (listarAsignacionesPorTenant as jest.Mock).mockResolvedValue([]);
  });

  const estudianteDemo: Estudiante = {
    id: 'estudiante-1',
    tenantId: 'tenant-real',
    nombres: 'Ana',
    apellidos: 'Gomez',
    numeroIdentificacion: '123',
    fechaNacimiento: '2015-01-01',
    grado: GradoTKD.Blanco,
    grupo: GrupoEdad.Infantil,
    horasAcumuladasGrado: 0,
    sedeId: 'sede-principal',
    telefono: '',
    correo: '',
    fechaIngreso: '2026-01-01',
    estadoPago: 'Al día' as any,
    saldoDeudor: 0,
    historialPagos: [],
    consentimientoInformado: true,
    contratoServiciosFirmado: true,
    consentimientoImagenFirmado: true,
    consentimientoFotosVideos: true,
    carnetGenerado: true,
  };

  const crearRepoInscripcionFake = (overrides: Partial<InscripcionRepository> = {}): InscripcionRepository => ({
    matricular: jest.fn().mockResolvedValue(undefined),
    retirar: jest.fn().mockResolvedValue(undefined),
    listarPorEjecucion: jest.fn().mockResolvedValue([]),
    estaInscritoEnEjecucion: jest.fn().mockResolvedValue(false),
    ...overrides,
  });

  it('el boton "Matricular estudiantes" abre el modal con la ejecucion derivada del programa seleccionado', async () => {
    const user = userEvent.setup();
    const repositoryInscripcion = crearRepoInscripcionFake();
    renderVista({ estudiantes: [estudianteDemo], repositoryInscripcion });

    expect(screen.queryByRole('dialog', { name: /matricular estudiantes/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /matricular estudiantes/i }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(PROGRAMA_ID_DEMO, { exact: false })).toBeInTheDocument();
    await waitFor(() => expect(repositoryInscripcion.listarPorEjecucion).toHaveBeenCalledWith(
      'tenant-real',
      `ejecucion-${PROGRAMA_ID_DEMO}`,
    ));
    expect(screen.getByRole('checkbox', { name: /ana gomez/i })).toBeInTheDocument();
  });

  it('cerrar el modal de matricula no persiste inscripciones', async () => {
    const user = userEvent.setup();
    const repositoryInscripcion = crearRepoInscripcionFake();
    renderVista({ estudiantes: [estudianteDemo], repositoryInscripcion });

    await user.click(screen.getByRole('button', { name: /matricular estudiantes/i }));
    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: /cancelar/i }));

    expect(repositoryInscripcion.matricular).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
