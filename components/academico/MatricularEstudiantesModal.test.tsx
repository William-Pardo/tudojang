import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MatricularEstudiantesModal from './MatricularEstudiantesModal';
import { GradoTKD, GrupoEdad, type Estudiante } from '../../tipos';
import type { EjecucionPrograma } from '../../models/academico/programa';
import type { InscripcionEjecucionPrograma } from '../../models/academico/inscripcion';
import type { InscripcionRepository } from '../../servicios/academico/inscripcionRepository';

function crearEstudiante(overrides: Partial<Estudiante> = {}): Estudiante {
  return {
    id: 'estudiante-1',
    tenantId: 'tenant-1',
    nombres: 'Ana',
    apellidos: 'Gomez',
    numeroIdentificacion: '123',
    fechaNacimiento: '2015-01-01',
    grado: GradoTKD.Blanco,
    grupo: GrupoEdad.Cadetes,
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
    ...overrides,
  } as Estudiante;
}

const ejecucion: EjecucionPrograma = {
  id: 'ejecucion-1',
  tenantId: 'tenant-1',
  programaId: 'programa-1',
  grupoId: 'cadetes',
  sedeId: 'sede-principal',
  estado: 'activo',
  fechaInicio: '2026-07-01',
  unidadActualId: null,
  objetivoActualId: null,
  objetivosCompletados: [],
  creadoEn: '2026-07-01T00:00:00.000Z',
  actualizadoEn: '2026-07-01T00:00:00.000Z',
};

const estudianteCadete = crearEstudiante({ id: 'est-cadete', nombres: 'Cadete', grupo: GrupoEdad.Cadetes });
const estudianteInfantil = crearEstudiante({ id: 'est-infantil', nombres: 'Infantil', grupo: GrupoEdad.Infantil });

function crearRepositoryFake(overrides: Partial<InscripcionRepository> = {}): InscripcionRepository {
  return {
    matricular: jest.fn().mockResolvedValue(undefined),
    retirar: jest.fn().mockResolvedValue(undefined),
    listarPorEjecucion: jest.fn().mockResolvedValue([] as InscripcionEjecucionPrograma[]),
    estaInscritoEnEjecucion: jest.fn().mockResolvedValue(false),
    ...overrides,
  };
}

describe('MatricularEstudiantesModal', () => {
  it('explica el propósito del roster (distinto de la asignación de grados en material)', async () => {
    const repository = crearRepositoryFake();
    render(
      <MatricularEstudiantesModal
        abierto
        ejecucion={ejecucion}
        estudiantes={[estudianteCadete]}
        tenantId="tenant-1"
        usuarioId="instructor-1"
        onCerrar={jest.fn()}
        repository={repository}
      />
    );

    await screen.findByRole('checkbox', { name: /cadete/i });

    // Debe aclarar que esto matricula al roster de la ejecución (asistencia/seguimiento)
    // y que es independiente de a qué grados aplica el material asignado.
    expect(screen.getByText(/roster/i)).toBeInTheDocument();
    expect(screen.getByText(/grados?/i)).toBeInTheDocument();
  });

  it('muestra un mensaje claro (no pantalla vacía) cuando está abierto pero la ejecución aún no existe', () => {
    render(
      <MatricularEstudiantesModal
        abierto
        ejecucion={null}
        estudiantes={[estudianteCadete]}
        tenantId="tenant-1"
        usuarioId="instructor-1"
        onCerrar={jest.fn()}
      />
    );

    expect(screen.getByText(/guarda el horario del programa/i)).toBeInTheDocument();
  });

  it('si falla la carga del roster, muestra un error y deja de mostrar "Cargando..." (no queda colgado)', async () => {
    const repository = crearRepositoryFake({
      listarPorEjecucion: jest.fn().mockRejectedValue(new Error('Firestore no disponible')),
    });
    render(
      <MatricularEstudiantesModal
        abierto
        ejecucion={ejecucion}
        estudiantes={[estudianteCadete]}
        tenantId="tenant-1"
        usuarioId="instructor-1"
        onCerrar={jest.fn()}
        repository={repository}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/no se pudo cargar el roster/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/cargando roster actual/i)).not.toBeInTheDocument();
  });

  it('no renderiza nada cuando abierto es false', () => {
    const repository = crearRepositoryFake();
    const { container } = render(
      <MatricularEstudiantesModal
        abierto={false}
        ejecucion={ejecucion}
        estudiantes={[estudianteCadete]}
        tenantId="tenant-1"
        usuarioId="instructor-1"
        onCerrar={jest.fn()}
        repository={repository}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('pre-marca la sugerencia por grupo etario y deja sin marcar al resto', async () => {
    const repository = crearRepositoryFake();
    render(
      <MatricularEstudiantesModal
        abierto
        ejecucion={ejecucion}
        estudiantes={[estudianteCadete, estudianteInfantil]}
        tenantId="tenant-1"
        usuarioId="instructor-1"
        onCerrar={jest.fn()}
        repository={repository}
      />
    );

    await waitFor(() => expect(repository.listarPorEjecucion).toHaveBeenCalledWith('tenant-1', 'ejecucion-1'));

    const checkboxCadete = await screen.findByRole('checkbox', { name: /cadete/i });
    const checkboxInfantil = screen.getByRole('checkbox', { name: /infantil/i });

    expect(checkboxCadete).toBeChecked();
    expect(checkboxInfantil).not.toBeChecked();
  });

  it('permite edicion manual: desmarcar un sugerido y marcar uno no sugerido', async () => {
    const repository = crearRepositoryFake();
    const user = userEvent.setup();
    render(
      <MatricularEstudiantesModal
        abierto
        ejecucion={ejecucion}
        estudiantes={[estudianteCadete, estudianteInfantil]}
        tenantId="tenant-1"
        usuarioId="instructor-1"
        onCerrar={jest.fn()}
        repository={repository}
      />
    );

    const checkboxCadete = await screen.findByRole('checkbox', { name: /cadete/i });
    const checkboxInfantil = screen.getByRole('checkbox', { name: /infantil/i });

    await user.click(checkboxCadete);
    await user.click(checkboxInfantil);

    expect(checkboxCadete).not.toBeChecked();
    expect(checkboxInfantil).toBeChecked();
  });

  it('confirmar persiste solo lo seleccionado (matricula lo nuevo, retira lo desmarcado, no toca lo intacto)', async () => {
    const inscripcionPrevia: InscripcionEjecucionPrograma = {
      estudianteId: 'est-cadete',
      ejecucionProgramaId: 'ejecucion-1',
      tenantId: 'tenant-1',
      estado: 'activa',
      fechaInscripcion: '2026-07-01T00:00:00.000Z',
      inscritoPorUid: 'instructor-1',
    };
    const repository = crearRepositoryFake({
      listarPorEjecucion: jest.fn().mockResolvedValue([inscripcionPrevia]),
    });
    const onCerrar = jest.fn();
    const onGuardado = jest.fn();
    const user = userEvent.setup();
    render(
      <MatricularEstudiantesModal
        abierto
        ejecucion={ejecucion}
        estudiantes={[estudianteCadete, estudianteInfantil]}
        tenantId="tenant-1"
        usuarioId="instructor-1"
        onCerrar={onCerrar}
        onGuardado={onGuardado}
        repository={repository}
      />
    );

    // est-cadete ya viene inscrito (previa) y ademas sugerido -> queda marcado.
    // Lo desmarcamos (debe generar un retirar). Marcamos manualmente a infantil
    // (no sugerido, no inscrito -> debe generar un matricular).
    const checkboxCadete = await screen.findByRole('checkbox', { name: /cadete/i });
    const checkboxInfantil = screen.getByRole('checkbox', { name: /infantil/i });
    await user.click(checkboxCadete);
    await user.click(checkboxInfantil);

    await user.click(screen.getByRole('button', { name: /confirmar matr[ií]cula/i }));

    await waitFor(() => expect(onCerrar).toHaveBeenCalled());

    expect(repository.retirar).toHaveBeenCalledWith('tenant-1', 'ejecucion-1', 'est-cadete');
    expect(repository.matricular).toHaveBeenCalledWith(expect.objectContaining({
      estudianteId: 'est-infantil',
      ejecucionProgramaId: 'ejecucion-1',
      tenantId: 'tenant-1',
      inscritoPorUid: 'instructor-1',
    }));
    expect(repository.matricular).not.toHaveBeenCalledWith(expect.objectContaining({ estudianteId: 'est-cadete' }));
    expect(onGuardado).toHaveBeenCalled();
  });

  it('cancelar no persiste nada', async () => {
    const repository = crearRepositoryFake();
    const onCerrar = jest.fn();
    const user = userEvent.setup();
    render(
      <MatricularEstudiantesModal
        abierto
        ejecucion={ejecucion}
        estudiantes={[estudianteCadete, estudianteInfantil]}
        tenantId="tenant-1"
        usuarioId="instructor-1"
        onCerrar={onCerrar}
        repository={repository}
      />
    );

    const checkboxInfantil = await screen.findByRole('checkbox', { name: /infantil/i });
    await user.click(checkboxInfantil);

    await user.click(screen.getByRole('button', { name: /cancelar/i }));

    expect(repository.matricular).not.toHaveBeenCalled();
    expect(repository.retirar).not.toHaveBeenCalled();
    expect(onCerrar).toHaveBeenCalled();
  });
});
