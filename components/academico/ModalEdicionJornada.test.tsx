import React from 'react';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ModalEdicionJornada from './ModalEdicionJornada';
import type { JornadaInstruccion } from '../../models/academico/jornada';
import type { RecursoAcademico } from '../../models/academico/recurso';
import type { AsignacionAcademica } from '../../models/academico/asignacion';
import type { ProgramaAcademico } from '../../models/academico/programa';
import { RolUsuario } from '../../tipos';
import {
  ConflictoConcurrenciaError,
  EliminacionNoPermitidaError,
  MENSAJE_CONFLICTO_CONCURRENCIA,
} from '../../servicios/academico/jornadaRepository';

// Subtarea 12.9: modal de edicion singular de Agenda. Todas las dependencias externas
// (repository de jornadas, carga de recursos/asignaciones/programas, persistencia de
// material) se inyectan por prop con default real -- mismo patron ya usado en
// AgendaView/JornadasView/MisClasesView -- para no tener que mockear modulos completos.

function crearJornada(overrides: Partial<JornadaInstruccion> = {}): JornadaInstruccion {
  const ahora = '2026-07-01T00:00:00.000Z';
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
    objetivosPlaneados: [],
    objetivosImpartidos: [],
    asistenciaRegistrada: false,
    creadoEn: ahora,
    actualizadoEn: ahora,
    ...overrides,
  };
}

const opciones = {
  programas: [{ id: 'programa-1', nombre: 'Fundamentos Taekwondo' }],
  grupos: [{ id: 'grupo-infantil', nombre: 'Grupo infantil' }],
  sedes: [{ id: 'sede-principal', nombre: 'Sede Principal' }],
  espacios: [{ id: 'tatami-1', nombre: 'Tatami 1' }],
  instructores: [{ id: 'maestro-1', nombre: 'Maestro Juan' }, { id: 'maestro-2', nombre: 'Maestro Pedro' }],
};

function crearRepository(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    guardarJornada: jest.fn().mockResolvedValue(undefined),
    guardarEjecucion: jest.fn().mockResolvedValue(undefined),
    registrarAuditoria: jest.fn().mockResolvedValue(undefined),
    existeConflictoHorario: jest.fn().mockResolvedValue({ hayConflicto: false }),
    listarJornadasPorTenant: jest.fn().mockResolvedValue([]),
    listarJornadasPorRangoFechas: jest.fn().mockResolvedValue([]),
    guardarJornadasEnLote: jest.fn().mockResolvedValue(undefined),
    actualizarTemaJornada: jest.fn().mockResolvedValue(undefined),
    eliminarJornadasEnLote: jest.fn().mockResolvedValue(undefined),
    eliminarJornadaSegura: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as any;
}

const recursoDisponible: RecursoAcademico = {
  id: 'recurso-1',
  tenantId: 'tenant-1',
  proveedor: 'google_drive',
  externalFileId: 'drive-1',
  nombre: 'Fundamentos tecnicos',
  mimeType: 'application/pdf',
  ficha: { disciplina: 'Taekwondo', tipo: 'pdf', usos: ['estudio'], tags: [] },
  estado: 'aprobado',
  creadoPorUid: 'admin-1',
  creadoEn: '2026-07-01T00:00:00.000Z',
  actualizadoEn: '2026-07-01T00:00:00.000Z',
};

const programaConTags: ProgramaAcademico = {
  id: 'programa-1',
  tenantId: 'tenant-1',
  nombre: 'Fundamentos Taekwondo',
  descripcion: '',
  version: 1,
  estado: 'publicado',
  unidades: [],
  creadoEn: '2026-06-01T00:00:00.000Z',
  actualizadoEn: '2026-06-01T00:00:00.000Z',
  tags: ['infantil'],
};

function renderModal(overrides: Partial<React.ComponentProps<typeof ModalEdicionJornada>> = {}) {
  const onCerrar = jest.fn();
  const onGuardado = jest.fn();
  const onEliminada = jest.fn();
  const repository = overrides.repository ?? crearRepository();
  const cargarRecursosDisponibles = overrides.cargarRecursosDisponibles ?? jest.fn().mockResolvedValue([recursoDisponible]);
  const cargarAsignacionesTenant = overrides.cargarAsignacionesTenant ?? jest.fn().mockResolvedValue([] as AsignacionAcademica[]);
  const cargarProgramasTenant = overrides.cargarProgramasTenant ?? jest.fn().mockResolvedValue([programaConTags]);
  const asignarMaterial = overrides.asignarMaterial ?? jest.fn().mockResolvedValue({ ok: true, id: 'asignacion-x' });

  const utils = render(
    <ModalEdicionJornada
      jornada={crearJornada()}
      tenantId="tenant-1"
      usuarioId="maestro-1"
      esAdmin={false}
      rol={RolUsuario.Editor}
      opciones={opciones}
      onCerrar={onCerrar}
      onGuardado={onGuardado}
      onEliminada={onEliminada}
      {...overrides}
      repository={repository}
      cargarRecursosDisponibles={cargarRecursosDisponibles}
      cargarAsignacionesTenant={cargarAsignacionesTenant}
      cargarProgramasTenant={cargarProgramasTenant}
      asignarMaterial={asignarMaterial}
    />
  );

  return { ...utils, onCerrar, onGuardado, onEliminada, repository, cargarRecursosDisponibles, cargarAsignacionesTenant, cargarProgramasTenant, asignarMaterial };
}

describe('ModalEdicionJornada', () => {
  // Rediseño post-cierre modulo 12 (ver CIERRE CENTRO DE ESTUDIOS.md): la barra de tabs
  // "Programa"/"Materiales" desaparece -- el modal es una sola vista. Este test reemplaza
  // al anterior ("muestra las pestanas Programa y Materiales..."), que verificaba un
  // `role="tab"` que ya no existe.
  it('muestra los campos de la pestana Programa directamente, sin tabs, y el boton + Agregar material', async () => {
    renderModal();

    expect(screen.queryByRole('tab', { name: /programa/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /materiales/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/hora de inicio/i)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /\+ agregar material/i })).toBeInTheDocument();
  });

  // Rediseño post-cierre modulo 12: la pestana Programa DENTRO de este modal se reduce a
  // Fecha/Hora inicio/Hora fin/Sede/Instructor -- Programa, Grupo y Espacio dejan de
  // editarse desde aca (siguen editandose desde JornadasView.tsx, que es otro consumidor
  // del mismo componente compartido PestanaProgramaJornada).
  it('la pestana Programa muestra hora de inicio/fin, fecha, sede e instructor -- ya NO Programa/Grupo/Espacio', async () => {
    renderModal();

    expect(screen.getByLabelText(/hora de inicio/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/hora de fin/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/fecha de la clase/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^sede$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^instructor$/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^programa$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^grupo$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^espacio$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^estado$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/grados excluidos/i)).not.toBeInTheDocument();
  });

  it('deshabilita el selector de instructor cuando el usuario NO es admin (solo admin reasigna maestro)', () => {
    renderModal({ esAdmin: false });

    expect(screen.getByLabelText(/instructor/i)).toBeDisabled();
  });

  it('habilita el selector de instructor cuando el usuario es admin', () => {
    renderModal({ esAdmin: true });

    expect(screen.getByLabelText(/instructor/i)).not.toBeDisabled();
  });

  // Rediseño post-cierre modulo 12 (punto 4, ver CIERRE CENTRO DE ESTUDIOS.md): el titulo
  // mostraba el ID crudo del programa (`opciones.programas.find(...)?.nombre ??
  // jornada.programaId`) cuando `opciones.programas` (viene de
  // `obtenerContextoJornada`/`jornadaContextService`) no incluia el programa de la
  // jornada -- confirmado en produccion por el usuario. `cargarProgramasTenant` (misma
  // fuente que Centro de Estudios usa en otros lados, via
  // `programaRepository.listarProgramasPorTenant`) pasa a ser la fuente PRIMARIA.
  describe('titulo del modal (nombre real del programa, no el ID crudo)', () => {
    it('usa el nombre resuelto por cargarProgramasTenant como fuente primaria, aunque opciones.programas tenga otro nombre', async () => {
      const opcionesConNombreDesactualizado = {
        ...opciones,
        programas: [{ id: 'programa-1', nombre: 'Nombre viejo (opciones)' }],
      };
      const cargarProgramasTenant = jest.fn().mockResolvedValue([programaConTags]);

      renderModal({ opciones: opcionesConNombreDesactualizado, cargarProgramasTenant });

      expect(await screen.findByRole('heading', { name: 'Fundamentos Taekwondo' })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Nombre viejo (opciones)' })).not.toBeInTheDocument();
    });

    it('usa opciones.programas como fallback secundario cuando cargarProgramasTenant no resuelve el programa', async () => {
      const cargarProgramasTenant = jest.fn().mockResolvedValue([]);

      renderModal({ cargarProgramasTenant });

      expect(await screen.findByRole('heading', { name: 'Fundamentos Taekwondo' })).toBeInTheDocument();
    });

    it('usa el ID crudo como ultimo recurso cuando ninguna fuente resuelve el nombre', async () => {
      const opcionesSinPrograma = { ...opciones, programas: [] };
      const cargarProgramasTenant = jest.fn().mockResolvedValue([]);

      renderModal({ opciones: opcionesSinPrograma, cargarProgramasTenant });

      expect(await screen.findByRole('heading', { name: 'programa-1' })).toBeInTheDocument();
    });
  });

  // Rediseño post-cierre modulo 12: el tab "Materiales" desaparece; el mismo flujo
  // (PestanaMaterialesJornada reemplazando el contenido, misma maquina de estados interna
  // `pestana`) ahora se dispara desde el boton "+ Agregar material".
  it('click en + Agregar material muestra el wizard de materiales (PestanaMaterialesJornada) con los recursos del tenant', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(await screen.findByRole('button', { name: /\+ agregar material/i }));

    expect(await screen.findByRole('button', { name: /fundamentos tecnicos/i })).toBeInTheDocument();
  });

  // Regresión (bug reportado: clic en "Asignar" en este flujo -- distinto del de
  // AsignacionesView.tsx -- "no hacía nada": sin error, sin cambio visible). Causa real:
  // `confirmarMaterial` en ModalEdicionJornada.tsx guardaba la asignación con éxito pero
  // nunca volvía `pestana` a 'programa', así que el wizard quedaba montado indefinidamente
  // en el mismo paso 3, dando la impresión de un botón sin acción.
  it('recorrer el asistente completo y confirmar en el Paso 3 llama a asignarMaterial y cierra el wizard (vuelve a "+ Agregar material")', async () => {
    const user = userEvent.setup();
    const { asignarMaterial } = renderModal();

    await user.click(await screen.findByRole('button', { name: /\+ agregar material/i }));
    await user.click(await screen.findByRole('button', { name: /fundamentos tecnicos/i }));
    await user.click(screen.getByRole('button', { name: /continuar/i }));
    await user.click(screen.getByRole('button', { name: /continuar/i }));
    await user.click(screen.getByRole('button', { name: /^Blanco$/ }));
    await user.click(screen.getByRole('button', { name: /^asignar$/i }));

    await waitFor(() => expect(asignarMaterial).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', jornadaId: 'jornada-1', recursoId: 'recurso-1' }),
    ));

    // El wizard se cierra (vuelve a la pestaña "programa"): reaparece el botón de entrada y
    // el material recién asignado se ve en el resumen, en vez de quedar atascado en el Paso 3.
    expect(await screen.findByRole('button', { name: /\+ agregar material/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^asignar$/i })).not.toBeInTheDocument();
    expect(screen.getByText(/fundamentos tecnicos/i)).toBeInTheDocument();
  });

  it('guardar sin cambios de horario/sede/instructor no llama a existeConflictoHorario, guarda y registra auditoria con fuente agenda', async () => {
    const user = userEvent.setup();
    const repository = crearRepository();
    const { onGuardado, onCerrar } = renderModal({ repository });

    await user.click(screen.getByRole('button', { name: /guardar cambios/i }));

    await waitFor(() => expect(repository.guardarJornada).toHaveBeenCalled());
    expect(repository.existeConflictoHorario).not.toHaveBeenCalled();
    expect(repository.registrarAuditoria).toHaveBeenCalledWith(
      expect.objectContaining({ fuente: 'agenda', accion: 'actualizar' }),
    );
    await waitFor(() => expect(onGuardado).toHaveBeenCalled());
    await waitFor(() => expect(onCerrar).toHaveBeenCalled());
  });

  it('guardar con cambio de horario valida conflicto antes de guardar y bloquea si hay choque', async () => {
    const user = userEvent.setup();
    const repository = crearRepository({
      existeConflictoHorario: jest.fn().mockResolvedValue({ hayConflicto: true, motivo: 'instructor' }),
    });
    const { onGuardado, onCerrar } = renderModal({ repository });

    // Cambia solo horaInicio (sigue siendo < horaFin '09:00') para que dispare el chequeo
    // de conflicto de horario sin disparar antes la validacion de rango invalido.
    fireEvent.change(screen.getByLabelText(/hora de inicio/i), { target: { value: '07:00' } });
    await user.click(screen.getByRole('button', { name: /guardar cambios/i }));

    await waitFor(() => expect(repository.existeConflictoHorario).toHaveBeenCalled());
    expect(await screen.findByText(/el maestro ya tiene una clase asignada en este horario/i)).toBeInTheDocument();
    expect(repository.guardarJornada).not.toHaveBeenCalled();
    expect(onGuardado).not.toHaveBeenCalled();
    expect(onCerrar).not.toHaveBeenCalled();
  });

  // 12.12 (seccion 22 del documento de mejora, caso "No se puede guardar clase sin horario
  // valido"): el chequeo `draft.horaInicio >= draft.horaFin` de `guardar()` corre ANTES que
  // `existeConflictoHorario` -- este test lo ejercita directo desde la UI (nadie lo cubria
  // todavia: los tests previos de horario solo llegan hasta el chequeo de conflicto).
  it('no permite guardar si la hora de inicio no es anterior a la hora de fin (bloquea antes de chequear conflicto)', async () => {
    const user = userEvent.setup();
    const repository = crearRepository();
    const { onGuardado, onCerrar } = renderModal({ repository });

    fireEvent.change(screen.getByLabelText(/hora de inicio/i), { target: { value: '09:00' } });
    await user.click(screen.getByRole('button', { name: /guardar cambios/i }));

    expect(await screen.findByText(/la hora de inicio debe ser anterior a la hora de finalizacion/i)).toBeInTheDocument();
    expect(repository.existeConflictoHorario).not.toHaveBeenCalled();
    expect(repository.guardarJornada).not.toHaveBeenCalled();
    expect(onGuardado).not.toHaveBeenCalled();
    expect(onCerrar).not.toHaveBeenCalled();
  });

  it('guardar muestra el mensaje de conflicto de concurrencia sin cerrar el modal', async () => {
    const user = userEvent.setup();
    const repository = crearRepository({
      guardarJornada: jest.fn().mockRejectedValue(new ConflictoConcurrenciaError()),
    });
    const { onCerrar } = renderModal({ repository });

    await user.click(screen.getByRole('button', { name: /guardar cambios/i }));

    expect(await screen.findByText(MENSAJE_CONFLICTO_CONCURRENCIA)).toBeInTheDocument();
    expect(onCerrar).not.toHaveBeenCalled();
  });

  it('boton Cancelar cierra el modal sin guardar', async () => {
    const user = userEvent.setup();
    const repository = crearRepository();
    const { onCerrar } = renderModal({ repository });

    await user.click(screen.getByRole('button', { name: /^cancelar$/i }));

    expect(repository.guardarJornada).not.toHaveBeenCalled();
    expect(onCerrar).toHaveBeenCalledTimes(1);
  });

  // Ampliacion posterior al cierre inicial de la extension de matriz de roles (decision de
  // producto explicita del usuario, ver CIERRE CENTRO DE ESTUDIOS.md): "Eliminar clase" ya
  // NO es exclusivo de Admin/SuperAdmin -- usa la MISMA matriz que `puedeEditar`
  // (`puedeEliminar = puedeEditar`, ver ModalEdicionJornada.tsx). Este test reemplaza al
  // anterior ("el boton Eliminar clase solo aparece para Admin/SuperAdmin"), que quedaba
  // desactualizado por esa ampliacion.
  it('el boton Eliminar clase aparece para Admin/SuperAdmin y para quien tenga permiso de edicion (misma matriz que Guardar)', () => {
    const primero = renderModal({ esAdmin: false, usuarioId: 'otro-maestro' });
    expect(screen.queryByRole('button', { name: /eliminar clase/i })).not.toBeInTheDocument();
    primero.unmount();

    renderModal({ esAdmin: true, usuarioId: 'otro-maestro' });
    expect(screen.getByRole('button', { name: /eliminar clase/i })).toBeInTheDocument();
  });

  it('Maestro asignado a la jornada ve el boton Eliminar clase (misma clase, sin ser admin)', () => {
    renderModal({ esAdmin: false, usuarioId: 'maestro-1', rol: RolUsuario.Maestro });
    expect(screen.getByRole('button', { name: /eliminar clase/i })).toBeInTheDocument();
  });

  it('Maestro NO asignado a la jornada no ve el boton Eliminar clase', () => {
    renderModal({ esAdmin: false, usuarioId: 'otro-maestro', rol: RolUsuario.Maestro });
    expect(screen.queryByRole('button', { name: /eliminar clase/i })).not.toBeInTheDocument();
  });

  it('Asistente/Editor NO asignado con permisoEdicionAgenda=true ve el boton Eliminar clase', () => {
    const primero = renderModal({ esAdmin: false, usuarioId: 'asistente-1', rol: RolUsuario.Asistente, permisoEdicionAgenda: true });
    expect(screen.getByRole('button', { name: /eliminar clase/i })).toBeInTheDocument();
    primero.unmount();

    renderModal({ esAdmin: false, usuarioId: 'editor-1', rol: RolUsuario.Editor, permisoEdicionAgenda: true });
    expect(screen.getByRole('button', { name: /eliminar clase/i })).toBeInTheDocument();
  });

  it('Asistente/Editor NO asignado sin permisoEdicionAgenda (false o ausente) no ve el boton Eliminar clase', () => {
    const primero = renderModal({ esAdmin: false, usuarioId: 'asistente-1', rol: RolUsuario.Asistente, permisoEdicionAgenda: false });
    expect(screen.queryByRole('button', { name: /eliminar clase/i })).not.toBeInTheDocument();
    primero.unmount();

    renderModal({ esAdmin: false, usuarioId: 'editor-1', rol: RolUsuario.Editor });
    expect(screen.queryByRole('button', { name: /eliminar clase/i })).not.toBeInTheDocument();
  });

  it('Estudiante/Tutor nunca ven el boton Eliminar clase, aunque coincidan con el instructorId', () => {
    const primero = renderModal({ esAdmin: false, usuarioId: 'maestro-1', rol: RolUsuario.Estudiante });
    expect(screen.queryByRole('button', { name: /eliminar clase/i })).not.toBeInTheDocument();
    primero.unmount();

    renderModal({ esAdmin: false, usuarioId: 'maestro-1', rol: RolUsuario.Tutor });
    expect(screen.queryByRole('button', { name: /eliminar clase/i })).not.toBeInTheDocument();
  });

  it('eliminar pide confirmacion explicita antes de ejecutar la accion', async () => {
    const user = userEvent.setup();
    const repository = crearRepository();
    renderModal({ esAdmin: true, repository });

    await user.click(screen.getByRole('button', { name: /eliminar clase/i }));

    expect(screen.getByText(/seguro de eliminar esta clase/i)).toBeInTheDocument();
    expect(repository.eliminarJornadaSegura).not.toHaveBeenCalled();
  });

  it('confirmar eliminacion llama a eliminarJornadaSegura, registra auditoria con accion eliminar y cierra el modal', async () => {
    const user = userEvent.setup();
    const repository = crearRepository();
    const { onCerrar, onEliminada } = renderModal({ esAdmin: true, repository });

    await user.click(screen.getByRole('button', { name: /eliminar clase/i }));
    await user.click(screen.getByRole('button', { name: /confirmar eliminacion/i }));

    await waitFor(() => expect(repository.eliminarJornadaSegura).toHaveBeenCalledWith(expect.objectContaining({ id: 'jornada-1' })));
    expect(repository.registrarAuditoria).toHaveBeenCalledWith(
      expect.objectContaining({ fuente: 'agenda', accion: 'eliminar' }),
    );
    await waitFor(() => expect(onEliminada).toHaveBeenCalledWith('jornada-1'));
    await waitFor(() => expect(onCerrar).toHaveBeenCalled());
  });

  it('si la jornada ya se opero, ofrece cancelar la clase en lugar de eliminarla, sin cerrar el modal', async () => {
    const user = userEvent.setup();
    const repository = crearRepository({
      eliminarJornadaSegura: jest.fn().mockRejectedValue(new EliminacionNoPermitidaError('asistencia_registrada')),
    });
    const { onCerrar } = renderModal({ esAdmin: true, repository });

    await user.click(screen.getByRole('button', { name: /eliminar clase/i }));
    await user.click(screen.getByRole('button', { name: /confirmar eliminacion/i }));

    expect(await screen.findByText(/no se puede eliminar esta clase porque ya tiene asistencia registrada/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancelar la clase en su lugar/i })).toBeInTheDocument();
    expect(onCerrar).not.toHaveBeenCalled();
  });

  it('re-chequea el permiso de edicion al abrir (defensa en profundidad): sin permiso, no muestra Guardar ni Eliminar', () => {
    renderModal({ esAdmin: false, usuarioId: 'otro-maestro' });

    expect(screen.queryByRole('button', { name: /guardar cambios/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /eliminar clase/i })).not.toBeInTheDocument();
    expect(screen.getByText(/no tenes permiso para editar esta clase/i)).toBeInTheDocument();
  });
});
