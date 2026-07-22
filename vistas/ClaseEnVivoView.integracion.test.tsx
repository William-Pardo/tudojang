/**
 * PRUEBAS DE INTEGRACION — Clase en Vivo, junta #2: ventana horaria -> habilitacion del escaner.
 *
 * Cierra la ultima de las tres juntas de la cadena. A diferencia de
 * `ClaseEnVivoView.test.tsx` (unitario, que inyecta `repository` y `asistenciaRepository`
 * falsos por props), aca NO se inyecta ninguno: corren los singletons reales contra el
 * Firestore falso en memoria. La cadena ejercida es:
 *
 *   tenants/{t}/jornadas/{j}                      -> jornadaRepository.listarJornadasPorTenant
 *   tenants/{t}/jornadas/{j}/asistencias/{e}      -> asistenciaRepository.listarPorJornada
 *     -> ClaseEnVivoView decide si habilita el escaner y que check-ins lista
 *
 * HALLAZGO QUE DOCUMENTA ESTA SUITE (ver ACCIONES_PENDIENTES.md): la ventana horaria
 * `[horaInicio-15, horaFin+15]` gatea el BOTON DE ENTRADA ("Iniciar Clase en Vivo" en
 * Horarios/App, via `estaJornadaEnVentana`/`useVentanaClaseEnVivo`), pero NO esta
 * chequeada dentro de esta vista: `ClaseEnVivoView` habilita el escaner mirando
 * unicamente `estado === 'en_curso'`. El callable server-side tampoco valida ventana
 * (`functions/academico/asistencia.js` solo exige `estado === 'en_curso'`).
 *
 * O sea: la ventana es una AYUDA DE UI, no un limite real. Los tests de abajo fijan ese
 * comportamiento tal como es hoy, con el caso limite marcado explicitamente para que la
 * decision de cerrarlo (o no) sea consciente y no un descubrimiento en produccion.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RolUsuario } from '../tipos';
import type { RegistroAsistencia } from '../models/academico/asistencia';

jest.mock('firebase/firestore', () => require('../test-utils/fakeFirestore').crearApiFirestoreFake());

jest.mock('../firebase/config', () => ({
  db: {},
  auth: {},
  storage: {},
  messaging: null,
  app: {},
  appCheck: null,
  isFirebaseConfigured: true,
}));

jest.mock('react-router-dom', () => ({
  useParams: () => ({}),
}));

const usuarioLogueado: { valor: any } = { valor: null };
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ usuario: usuarioLogueado.valor }),
}));

const notificaciones: Array<{ mensaje: string; tipo: string }> = [];
jest.mock('../context/NotificacionContext', () => ({
  useNotificacion: () => ({
    mostrarNotificacion: (mensaje: string, tipo: string) => { notificaciones.push({ mensaje, tipo }); },
  }),
}));

// El escaner real depende de camara y BarcodeDetector, fuera del alcance de esta junta:
// se reemplaza por un boton que dispara la deteccion, conservando el resto de la cadena.
jest.mock('../components/academico/EscanerQR', () => ({
  __esModule: true,
  default: ({ onDetectarEstudiante, onClose, titulo }: any) => (
    <div data-testid="escaner-qr">
      <span>{titulo}</span>
      <button onClick={() => onDetectarEstudiante('est-sofia')}>simular escaneo</button>
      <button onClick={onClose}>cerrar escaner</button>
    </div>
  ),
}));

const registrosCallable: Array<{ tenantId: string; jornadaId: string; estudianteId: string }> = [];
jest.mock('../servicios/academico/asistenciaClaseService', () => ({
  registrarAsistenciaClase: async (peticion: any) => {
    registrosCallable.push(peticion);
    const ruta = `tenants/${peticion.tenantId}/jornadas/${peticion.jornadaId}/asistencias/${peticion.estudianteId}`;
    require('../test-utils/fakeFirestore').sembrarDoc(ruta, {
      estudianteId: peticion.estudianteId,
      horaEntrada: '2026-07-22T15:05:00.000Z',
    });
    return { ok: true, tipo: 'entrada', hora: '2026-07-22T15:05:00.000Z' };
  },
}));

import { sembrarDoc, limpiarFirestoreFake } from '../test-utils/fakeFirestore';
import { ClaseEnVivoView } from './ClaseEnVivoView';
import { estaJornadaEnVentana } from '../servicios/academico/ventanaClaseEnVivoService';

const TENANT = 'tenant-gajog';
const JORNADA = 'jornada-1';

// Clase de 10:00-11:00 hora de Colombia (ver fix de zona horaria del 2026-07-22).
const DURANTE_LA_CLASE = '2026-07-22T15:30:00.000Z'; // 10:30 Bogota
const MUY_DESPUES = '2026-07-23T20:00:00.000Z'; // dia siguiente, 15:00 Bogota

const sembrarJornada = (over: Record<string, any> = {}) =>
  sembrarDoc(`tenants/${TENANT}/jornadas/${JORNADA}`, {
    tenantId: TENANT,
    programaId: 'programa-1',
    ejecucionProgramaId: 'ejecucion-1',
    grupoId: 'grupo-infantil',
    sedeId: 'sede-1',
    espacioId: 'tatami-1',
    instructorId: 'maestro-1',
    fecha: '2026-07-22',
    horaInicio: '10:00',
    horaFin: '11:00',
    estado: 'en_curso',
    tema: 'Taeguk 1',
    objetivosPlaneados: ['Taeguk 1'],
    objetivosImpartidos: [],
    asistenciaRegistrada: false,
    creadoEn: '2026-07-01T00:00:00.000Z',
    actualizadoEn: '2026-07-01T00:00:00.000Z',
    ...over,
  });

const sembrarCheckIn = (estudianteId: string, over: Partial<RegistroAsistencia> = {}) =>
  sembrarDoc(`tenants/${TENANT}/jornadas/${JORNADA}/asistencias/${estudianteId}`, {
    estudianteId,
    horaEntrada: '2026-07-22T15:05:00.000Z',
    ...over,
  } satisfies RegistroAsistencia);

beforeEach(() => {
  limpiarFirestoreFake();
  notificaciones.length = 0;
  registrosCallable.length = 0;
  usuarioLogueado.valor = { id: 'maestro-1', tenantId: TENANT, rol: RolUsuario.Maestro };
});

// --- Habilitacion del escaner -------------------------------------------------------

describe('Integracion: la vista habilita el escaner segun el estado real de la jornada', () => {
  it('con la jornada en curso muestra el escaner y los check-ins ya registrados', async () => {
    sembrarJornada();
    sembrarCheckIn('est-sofia');
    sembrarCheckIn('est-diego', { horaSalida: '2026-07-22T16:00:00.000Z', minutosAsistidos: 55 });

    render(<ClaseEnVivoView jornadaId={JORNADA} />);

    expect(await screen.findByRole('button', { name: /escanear asistencia/i })).toBeInTheDocument();
    expect(screen.getByText(/Check-ins registrados \(2\)/i)).toBeInTheDocument();
    // El estado por check-in sale de `horaSalida`, que escribe el callable.
    expect(screen.getByText(/est-sofia — En curso/)).toBeInTheDocument();
    expect(screen.getByText(/est-diego — Completo/)).toBeInTheDocument();
  });

  it('no habilita el escaner si la jornada no esta en curso', async () => {
    sembrarJornada({ estado: 'confirmada' });

    render(<ClaseEnVivoView jornadaId={JORNADA} />);

    expect(await screen.findByText(/La jornada no está en curso/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /escanear asistencia/i })).not.toBeInTheDocument();
  });

  it('no habilita el escaner sobre una jornada cancelada', async () => {
    sembrarJornada({ estado: 'cancelada' });

    render(<ClaseEnVivoView jornadaId={JORNADA} />);

    expect(await screen.findByText(/Estado actual: cancelada/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /escanear asistencia/i })).not.toBeInTheDocument();
  });

  it('una jornada de otro tenant no es alcanzable', async () => {
    sembrarDoc(`tenants/tenant-ajeno/jornadas/${JORNADA}`, {
      tenantId: 'tenant-ajeno', estado: 'en_curso', fecha: '2026-07-22',
      horaInicio: '10:00', horaFin: '11:00', id: JORNADA,
    });

    render(<ClaseEnVivoView jornadaId={JORNADA} />);

    expect(await screen.findByText(/No se encontró la jornada solicitada/i)).toBeInTheDocument();
  });
});

// --- Escaneo -> refresco de la lista ------------------------------------------------

describe('Integracion: un escaneo refresca la lista leyendo del repositorio real', () => {
  it('tras escanear, el contador sube porque se releen los check-ins persistidos', async () => {
    const usuario = userEvent.setup();
    sembrarJornada();

    render(<ClaseEnVivoView jornadaId={JORNADA} />);

    expect(await screen.findByText(/Check-ins registrados \(0\)/i)).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: /escanear asistencia/i }));
    await usuario.click(await screen.findByRole('button', { name: /simular escaneo/i }));

    await waitFor(() => {
      expect(screen.getByText(/Check-ins registrados \(1\)/i)).toBeInTheDocument();
    });
    expect(registrosCallable).toEqual([
      { tenantId: TENANT, jornadaId: JORNADA, estudianteId: 'est-sofia' },
    ]);
    expect(notificaciones).toEqual([{ mensaje: 'Check-in registrado', tipo: 'success' }]);
  });

  it('el escaner queda abierto tras un registro (una clase espera varios estudiantes)', async () => {
    const usuario = userEvent.setup();
    sembrarJornada();

    render(<ClaseEnVivoView jornadaId={JORNADA} />);
    await usuario.click(await screen.findByRole('button', { name: /escanear asistencia/i }));
    await usuario.click(await screen.findByRole('button', { name: /simular escaneo/i }));

    await waitFor(() => expect(screen.getByText(/Check-ins registrados \(1\)/i)).toBeInTheDocument());
    expect(screen.getByTestId('escaner-qr')).toBeInTheDocument();
  });
});

// --- La ventana horaria NO limita esta vista ----------------------------------------

describe('Integracion: alcance real de la ventana horaria sobre el escaner', () => {
  it('la ventana esta cerrada mucho despues de la clase (contexto del caso siguiente)', () => {
    const jornada = { fecha: '2026-07-22', horaInicio: '10:00', horaFin: '11:00' };
    expect(estaJornadaEnVentana(jornada, DURANTE_LA_CLASE)).toBe(true);
    expect(estaJornadaEnVentana(jornada, MUY_DESPUES)).toBe(false);
  });

  it('BRECHA CONOCIDA: con la ventana ya cerrada, una jornada que quedo en_curso sigue permitiendo escanear', async () => {
    // Nada mueve automaticamente una jornada fuera de 'en_curso': el scheduler solo hace
    // confirmada -> en_curso, y la salida es el cierre MANUAL desde MisClasesView. Una
    // jornada que el maestro nunca cerro queda escaneable por URL directa (bookmark, boton
    // atras, link compartido) dias despues, porque ni esta vista ni el callable validan la
    // ventana horaria -- solo el estado academico.
    //
    // Este test fija el comportamiento ACTUAL a proposito. Si se decide cerrar la brecha
    // (validar ventana en ClaseEnVivoView y/o en el callable), va a fallar y hay que
    // invertir la expectativa: eso es exactamente lo que se busca.
    sembrarJornada({ fecha: '2026-07-20' }); // clase de hace dos dias, nunca cerrada

    render(<ClaseEnVivoView jornadaId={JORNADA} />);

    expect(await screen.findByRole('button', { name: /escanear asistencia/i })).toBeInTheDocument();
    expect(estaJornadaEnVentana({ fecha: '2026-07-20', horaInicio: '10:00', horaFin: '11:00' }, MUY_DESPUES))
      .toBe(false);
  });
});
