import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AsignacionesView from './AsignacionesView';
import type { JornadaRepository } from '../../servicios/academico/jornadaRepository';
import type { ProgramaRepository } from '../../servicios/academico/programaRepository';
import type { JornadaInstruccion } from '../../models/academico/jornada';

// Los tests de regresion completan el formulario del modal Programa y esperan
// varios awaits encadenados (guardarPrograma -> repos). Mismo ajuste que ya
// usa AsignacionesView.test.tsx (jest.setTimeout(15000)) para no quedar al
// limite del timeout default de 5000ms cuando corre junto a otras suites.
jest.setTimeout(15000);

// Fix 1 (correccion post-prueba-manual, ver "CIERRE SDD CLAUDE CODE - CENTRO
// ESTUDIOS.md" seccion 3.3.1): antes de esta correccion, `instructorId` de la
// jornada se derivaba de `slugificar(programa.instructor)` (un slug del
// nombre libre), nunca del UID real de Firebase Auth. La funcion Cloud
// `publishAsignacion` valida `jornada.instructorId === auth.uid`, asi que
// publicar material estaba roto para cualquier usuario real. Este archivo
// prueba, de forma aislada del resto de AsignacionesView.test.tsx (que sigue
// roto a proposito hasta la Fase 4), que:
//  1. Admin/SuperAdmin ve un <select> real con las opciones reales del tenant
//     y puede elegir cualquier instructor.
//  2. Editor ve el campo bloqueado a si mismo (no puede elegir otro).
//  3. El instructorId que termina en la jornada generada es siempre un UID
//     real (el propio, para Editor), nunca un slug del nombre.

jest.mock('../../servicios/academico/bibliotecaService', () => ({
  listarRecursosAprobados: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../servicios/academico/jornadaContextService', () => ({
  obtenerContextoJornada: jest.fn(),
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
import { obtenerContextoJornada } from '../../servicios/academico/jornadaContextService';
import { useAuth } from '../../context/AuthContext';

const instructoresReales = [
  { id: 'uid-editor-real', nombre: 'Profe Editor' },
  { id: 'uid-admin-real', nombre: 'Admin Uno' },
  { id: 'uid-otro-editor', nombre: 'Otro Maestro' },
];

function crearRepositorioJornadaFake(): JornadaRepository {
  return {
    guardarJornada: jest.fn().mockResolvedValue(undefined),
    guardarEjecucion: jest.fn().mockResolvedValue(undefined),
    registrarAuditoria: jest.fn().mockResolvedValue(undefined),
    existeConflictoHorario: jest.fn().mockResolvedValue(false),
    listarJornadasPorTenant: jest.fn().mockResolvedValue([]),
    guardarJornadasEnLote: jest.fn().mockResolvedValue(undefined),
    actualizarTemaJornada: jest.fn().mockResolvedValue(undefined),
  };
}

function crearRepositorioProgramaFake(): ProgramaRepository {
  return {
    guardarPrograma: jest.fn().mockResolvedValue(undefined),
    listarProgramasPorTenant: jest.fn().mockResolvedValue([]),
  };
}

const mockUseAuth = (usuario: Record<string, unknown>) => {
  (useAuth as jest.Mock).mockReturnValue({ usuario });
};

const abrirModalPrograma = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: /crear programa/i }));
};

// Completa lo minimo indispensable para que "Aceptar" quede habilitado
// (programaFormularioValido): tema, un tag y un dia de horario. El resto
// (nombre, fechas, sede, grupo, instructor) ya viene pre-cargado por
// abrirCrearPrograma().
const completarFormularioMinimo = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText(/^tema$/i), 'Tema de prueba');
  await user.click(screen.getByRole('button', { name: /^lun$/i }));
  await user.click(screen.getByRole('button', { name: /^infantil$/i }));
};

describe('AsignacionesView - seleccion de instructor por rol (Fix 1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (obtenerContextoJornada as jest.Mock).mockResolvedValue({
      programas: [],
      grupos: [],
      sedes: [{ id: 'sede-real', nombre: 'Sede Real' }],
      espacios: [],
      instructores: instructoresReales,
    });
  });

  it('Admin ve un selector real de instructor con las opciones reales del tenant y puede elegir cualquiera', async () => {
    mockUseAuth({ id: 'uid-admin-real', tenantId: 'tenant-x', rol: 'Admin', nombreUsuario: 'Admin Uno', email: 'admin@test.com' });
    const user = userEvent.setup();
    render(
      <AsignacionesView
        embedded
        recursos={[]}
        repositoryPrograma={crearRepositorioProgramaFake()}
        repositoryJornada={crearRepositorioJornadaFake()}
      />
    );

    await abrirModalPrograma(user);

    const selector = (await screen.findByLabelText(/^instructor$/i)) as HTMLSelectElement;
    expect(selector.tagName).toBe('SELECT');

    await waitFor(() => {
      const valores = Array.from(selector.options).map((opcion) => opcion.value);
      expect(valores).toEqual(expect.arrayContaining(['uid-editor-real', 'uid-admin-real', 'uid-otro-editor']));
    });

    await user.selectOptions(selector, 'uid-otro-editor');
    expect(selector).toHaveValue('uid-otro-editor');
  });

  it('Editor ve el instructor bloqueado a si mismo, sin poder elegir otro', async () => {
    mockUseAuth({ id: 'uid-editor-real', tenantId: 'tenant-x', rol: 'Editor', nombreUsuario: 'Profe Editor', email: 'editor@test.com' });
    const user = userEvent.setup();
    render(
      <AsignacionesView
        embedded
        recursos={[]}
        repositoryPrograma={crearRepositorioProgramaFake()}
        repositoryJornada={crearRepositorioJornadaFake()}
      />
    );

    await abrirModalPrograma(user);

    const campo = (await screen.findByLabelText(/^instructor$/i)) as HTMLInputElement;
    expect(campo.tagName).toBe('INPUT');
    expect(campo).toBeDisabled();
    expect(campo).toHaveValue('Profe Editor');
  });

  it('regresion: Editor autoasignado -> la jornada generada usa su UID real, no un slug del nombre', async () => {
    mockUseAuth({ id: 'uid-editor-real', tenantId: 'tenant-x', rol: 'Editor', nombreUsuario: 'Profe Editor', email: 'editor@test.com' });
    const user = userEvent.setup();
    const repoJornada = crearRepositorioJornadaFake();
    render(
      <AsignacionesView
        embedded
        recursos={[]}
        repositoryPrograma={crearRepositorioProgramaFake()}
        repositoryJornada={repoJornada}
      />
    );

    await abrirModalPrograma(user);
    await completarFormularioMinimo(user);

    await user.click(screen.getByRole('button', { name: /^aceptar$/i }));
    await user.click(await screen.findByRole('button', { name: /^confirmar$/i }));

    await waitFor(() => expect(repoJornada.guardarJornadasEnLote).toHaveBeenCalled());
    const jornadasGuardadas = (repoJornada.guardarJornadasEnLote as jest.Mock).mock.calls[0][0] as JornadaInstruccion[];
    expect(jornadasGuardadas.length).toBeGreaterThan(0);
    jornadasGuardadas.forEach((jornada) => {
      expect(jornada.instructorId).toBe('uid-editor-real');
      expect(jornada.instructorId).not.toMatch(/profe|editor-actual/i);
    });
  });

  it('regresion: Admin elige a otro instructor -> la jornada generada usa el UID real elegido, no un slug', async () => {
    mockUseAuth({ id: 'uid-admin-real', tenantId: 'tenant-x', rol: 'Admin', nombreUsuario: 'Admin Uno', email: 'admin@test.com' });
    const user = userEvent.setup();
    const repoJornada = crearRepositorioJornadaFake();
    render(
      <AsignacionesView
        embedded
        recursos={[]}
        repositoryPrograma={crearRepositorioProgramaFake()}
        repositoryJornada={repoJornada}
      />
    );

    await abrirModalPrograma(user);
    const selector = (await screen.findByLabelText(/^instructor$/i)) as HTMLSelectElement;
    await waitFor(() => {
      const valores = Array.from(selector.options).map((opcion) => opcion.value);
      expect(valores).toContain('uid-otro-editor');
    });
    await user.selectOptions(selector, 'uid-otro-editor');

    await completarFormularioMinimo(user);
    await user.click(screen.getByRole('button', { name: /^aceptar$/i }));
    await user.click(await screen.findByRole('button', { name: /^confirmar$/i }));

    await waitFor(() => expect(repoJornada.guardarJornadasEnLote).toHaveBeenCalled());
    const jornadasGuardadas = (repoJornada.guardarJornadasEnLote as jest.Mock).mock.calls[0][0] as JornadaInstruccion[];
    expect(jornadasGuardadas.length).toBeGreaterThan(0);
    jornadasGuardadas.forEach((jornada) => {
      expect(jornada.instructorId).toBe('uid-otro-editor');
    });
  });
});
