/**
 * PRUEBAS DE INTEGRACION — Centro de Estudios, cadena de cierre de jornada con asistencia real.
 *
 * `MisClasesView` se monta dentro de `AsignacionesView`, que a su vez se monta dentro de
 * `CentroEstudios` (ruta /centro-estudios): es la pantalla de PRODUCCION donde se cierran
 * las jornadas reales disparadas por Agenda.
 *
 * A diferencia de `MisClasesView.test.tsx` (unitario, que inyecta un `repository` y un
 * `asistenciaRepository` falsos por props), aca NO se inyecta ninguno: corren los
 * singletons reales `jornadaRepository` y `asistenciaRepository` contra el Firestore falso
 * en memoria. La cadena ejercida de punta a punta es:
 *
 *   tenants/{t}/jornadas/{j}/asistencias  (check-ins QR, escritos server-side)
 *     -> asistenciaRepository.listarPorJornada()
 *     -> contarCheckIns()                  (servicios/academico/asistenciaService)
 *     -> MisClasesView deriva `asistenciaRegistrada`
 *     -> marcarPendienteCierre() / cerrarJornada()  (servicios/academico/jornadaService)
 *     -> jornadaRepository.guardarJornada() con bloqueo optimista
 *     -> el documento persistido en tenants/{t}/jornadas/{j}
 *
 * Por que importa: el gap #5 de la auditoria de integracion (2026-07-18) era que esta
 * pantalla cerraba jornadas con un CHECKBOX MANUAL, no con la asistencia real. Una jornada
 * con check-ins reales via QR se podia cerrar igual sin que nadie hubiera asistido, y al
 * reves. Ningun test unitario lo detectaba porque cada capa se probaba contra un mock de
 * la de al lado. Estas pruebas fijan el contrato entre las capas.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RolUsuario } from '../../tipos';
import type { RegistroAsistencia } from '../../models/academico/asistencia';

jest.mock('firebase/firestore', () => require('../../test-utils/fakeFirestore').crearApiFirestoreFake());

jest.mock('../../firebase/config', () => ({
  db: {},
  auth: {},
  storage: {},
  messaging: null,
  app: {},
  appCheck: null,
  isFirebaseConfigured: true,
}));

import { sembrarDoc, leerDoc, limpiarFirestoreFake } from '../../test-utils/fakeFirestore';
import MisClasesView from './MisClasesView';

const TENANT = 'tenant-gajog';
const PROGRAMA = 'programa-taeguk';
const MAESTRO = 'maestro-1';

// --- Fixtures --------------------------------------------------------------------

const sembrarJornada = (id: string, over: Record<string, any> = {}) =>
  sembrarDoc(`tenants/${TENANT}/jornadas/${id}`, {
    tenantId: TENANT,
    programaId: PROGRAMA,
    ejecucionProgramaId: `ejecucion-${PROGRAMA}`,
    grupoId: 'grupo-infantil',
    sedeId: 'sede-1',
    espacioId: 'tatami-1',
    instructorId: MAESTRO,
    fecha: '2026-07-20',
    horaInicio: '10:00',
    horaFin: '11:00',
    estado: 'en_curso',
    objetivosPlaneados: ['Taeguk 1', 'Patadas basicas'],
    objetivosImpartidos: [],
    asistenciaRegistrada: false,
    tema: 'Clase de prueba',
    creadoEn: '2026-07-01T00:00:00.000Z',
    actualizadoEn: '2026-07-01T00:00:00.000Z',
    ...over,
  });

/**
 * Simula un check-in QR ya registrado server-side por el callable `registrarAsistenciaJornada`.
 *
 * El tipo `RegistroAsistencia` es el contrato entre quien ESCRIBE
 * (functions/academico/asistencia.js, Admin SDK -- la subcoleccion tiene `allow write: if
 * false` para el cliente) y quien LEE (asistenciaRepository).
 *
 * La primera version de este fixture sembraba `entradaEn`/`estado` (campos que NO existen)
 * en vez de `horaEntrada`, y los 9 tests pasaban igual, porque `contarCheckIns()` es
 * `registros.length` y no mira ni un campo. Un fixture sin tipar puede mentir sobre la
 * forma del dato sin que nada falle.
 *
 * ATENCION — el `satisfies` de abajo NO se esta verificando hoy. `tsconfig.json` tiene
 * `isolatedModules: true`, asi que ts-jest transpila SIN chequear tipos: un campo inventado
 * aca no rompe `npm test` (comprobado con `tsc --noEmit` aparte, que si lo reporta como
 * TS2353). O sea que el `satisfies` documenta la intencion y protege a quien corra `tsc`,
 * pero no es una red automatica. Ver ACCIONES_PENDIENTES.md #13.
 *
 * Brecha relacionada, tambien abierta: nada verifica que lo que el callable REALMENTE
 * escribe coincida con este tipo -- vive en `functions/` (CommonJS, corrido por node:test)
 * y no comparte tipos con el front. Ver ACCIONES_PENDIENTES.md #14.
 */
const sembrarCheckIn = (
  jornadaId: string,
  estudianteId: string,
  over: Partial<RegistroAsistencia> = {}
) =>
  sembrarDoc(`tenants/${TENANT}/jornadas/${jornadaId}/asistencias/${estudianteId}`, {
    estudianteId,
    horaEntrada: '2026-07-20T10:02:00.000Z',
    ...over,
  } satisfies RegistroAsistencia);

const renderVista = () =>
  render(
    <MisClasesView
      tenantId={TENANT}
      programaId={PROGRAMA}
      usuarioId={MAESTRO}
      rol={RolUsuario.Maestro}
    />
  );

beforeEach(() => {
  limpiarFirestoreFake();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// --- Derivacion de asistencia -----------------------------------------------------

describe('Integracion: asistencia derivada de check-ins reales (no de un checkbox)', () => {
  it('refleja el conteo real de check-ins de la subcoleccion de la jornada', async () => {
    sembrarJornada('jornada-1');
    sembrarCheckIn('jornada-1', 'est-sofia');
    sembrarCheckIn('jornada-1', 'est-diego');

    renderVista();

    expect(await screen.findByText('Asistencia registrada (2 check-ins)')).toBeInTheDocument();
  });

  it('singulariza el texto con un unico check-in', async () => {
    sembrarJornada('jornada-1');
    sembrarCheckIn('jornada-1', 'est-sofia');

    renderVista();

    expect(await screen.findByText('Asistencia registrada (1 check-in)')).toBeInTheDocument();
  });

  it('sin check-ins reales lo dice explicitamente, y NO ofrece marcar asistencia a mano', async () => {
    sembrarJornada('jornada-1');

    renderVista();

    expect(await screen.findByText('Sin check-ins registrados aún')).toBeInTheDocument();
    // El checkbox manual de asistencia fue eliminado (gap #5). El unico checkbox que
    // sobrevive en la tarjeta es el de objetivos impartidos.
    expect(screen.queryByLabelText(/Asistencia registrada/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Objetivos impartidos/i)).toBeInTheDocument();
  });

  it('no cuenta check-ins de OTRA jornada (aislamiento por subcoleccion)', async () => {
    sembrarJornada('jornada-1');
    sembrarJornada('jornada-2', { fecha: '2026-07-21' });
    sembrarCheckIn('jornada-2', 'est-sofia');
    sembrarCheckIn('jornada-2', 'est-diego');
    sembrarCheckIn('jornada-2', 'est-ana');

    renderVista();

    expect(await screen.findByText('Sin check-ins registrados aún')).toBeInTheDocument();
    expect(screen.getByText('Asistencia registrada (3 check-ins)')).toBeInTheDocument();
  });

  it('una jornada ya cerrada no expone el panel de cierre', async () => {
    sembrarJornada('jornada-1', {
      estado: 'cerrada',
      asistenciaRegistrada: true,
      objetivosImpartidos: ['Taeguk 1'],
    });
    sembrarCheckIn('jornada-1', 'est-sofia');

    renderVista();

    await screen.findByText('Clase de prueba');
    expect(screen.queryByText(/check-in/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Sin check-ins registrados aún')).not.toBeInTheDocument();
  });
});

// --- Cierre persistido -------------------------------------------------------------

describe('Integracion: cierre de jornada persiste la asistencia real', () => {
  it('cierra la jornada y persiste asistenciaRegistrada derivada de los check-ins', async () => {
    const usuario = userEvent.setup();
    sembrarJornada('jornada-1');
    sembrarCheckIn('jornada-1', 'est-sofia');
    sembrarCheckIn('jornada-1', 'est-diego');

    renderVista();

    await screen.findByText('Asistencia registrada (2 check-ins)');
    await usuario.click(screen.getByLabelText(/Objetivos impartidos/i));
    await usuario.click(screen.getByRole('button', { name: 'Cerrar' }));

    await waitFor(() => {
      expect(leerDoc('tenants/tenant-gajog/jornadas/jornada-1')?.estado).toBe('cerrada');
    });

    const persistida = leerDoc('tenants/tenant-gajog/jornadas/jornada-1');
    expect(persistida?.asistenciaRegistrada).toBe(true);
    expect(persistida?.objetivosImpartidos).toEqual(['Taeguk 1', 'Patadas basicas']);
  });

  it('SIN check-ins reales el cierre se rechaza y la jornada no cambia de estado', async () => {
    const usuario = userEvent.setup();
    sembrarJornada('jornada-1');

    renderVista();

    await screen.findByText('Sin check-ins registrados aún');
    await usuario.click(screen.getByLabelText(/Objetivos impartidos/i));
    await usuario.click(screen.getByRole('button', { name: 'Cerrar' }));

    expect(
      await screen.findByText('No se puede cerrar una jornada sin asistencia registrada.')
    ).toBeInTheDocument();
    expect(leerDoc('tenants/tenant-gajog/jornadas/jornada-1')?.estado).toBe('en_curso');
    expect(leerDoc('tenants/tenant-gajog/jornadas/jornada-1')?.asistenciaRegistrada).toBe(false);
  });

  it('con check-ins pero sin objetivos impartidos tampoco cierra', async () => {
    const usuario = userEvent.setup();
    sembrarJornada('jornada-1');
    sembrarCheckIn('jornada-1', 'est-sofia');

    renderVista();

    await screen.findByText('Asistencia registrada (1 check-in)');
    await usuario.click(screen.getByRole('button', { name: 'Cerrar' }));

    expect(
      await screen.findByText('No se puede cerrar una jornada sin objetivos impartidos.')
    ).toBeInTheDocument();
    expect(leerDoc('tenants/tenant-gajog/jornadas/jornada-1')?.estado).toBe('en_curso');
  });

  it('respeta el bloqueo optimista: si otro usuario grabo entremedio, no pisa el cambio', async () => {
    const usuario = userEvent.setup();
    sembrarJornada('jornada-1');
    sembrarCheckIn('jornada-1', 'est-sofia');

    renderVista();

    await screen.findByText('Asistencia registrada (1 check-in)');
    await usuario.click(screen.getByLabelText(/Objetivos impartidos/i));

    // Otra sesion graba la misma jornada despues de que esta vista la leyo.
    sembrarDoc('tenants/tenant-gajog/jornadas/jornada-1', {
      ...leerDoc('tenants/tenant-gajog/jornadas/jornada-1'),
      tema: 'Editado por otro usuario',
      actualizadoEn: '2026-07-20T23:59:00.000Z',
    });

    await usuario.click(screen.getByRole('button', { name: 'Cerrar' }));

    await waitFor(() => {
      expect(screen.getByText(/modificada por otro usuario/i)).toBeInTheDocument();
    });
    const persistida = leerDoc('tenants/tenant-gajog/jornadas/jornada-1');
    expect(persistida?.estado).toBe('en_curso');
    expect(persistida?.tema).toBe('Editado por otro usuario');
  });
});
