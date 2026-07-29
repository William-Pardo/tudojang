import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { RolUsuario } from '../tipos';

jest.mock('../servicios/academico/agendaAcademicaService', () => ({
  obtenerClasesAcademicasDelTenant: jest.fn(),
}));

import { obtenerClasesAcademicasDelTenant } from '../servicios/academico/agendaAcademicaService';

const bloqueComercial = {
  id: 'bloque-comercial-1',
  dia: 'Lunes' as const,
  horaInicio: '08:00',
  horaFin: '09:00',
  sedeId: 'sede-1',
  instructorId: 'maestro-1',
  grupo: 'Infantil' as any,
  nombrePrograma: 'Programa comercial',
  programaId: 'programa-comercial-1',
};

jest.mock('../context/DataContext', () => ({
  useProgramas: () => ({
    programas: [{ id: 'programa-comercial-1', bloquesHorarios: [bloqueComercial] }],
    agendaCompleta: [bloqueComercial],
    actualizarPrograma: jest.fn(),
    agregarPrograma: jest.fn(),
  }),
  useSedes: () => ({ sedesVisibles: [{ id: 'sede-1', nombre: 'Sede Principal' }] }),
  useConfiguracion: () => ({ usuarios: [{ id: 'maestro-1', nombreUsuario: 'Maestro Uno' }] }),
}));

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ usuario: { id: 'maestro-1', tenantId: 'tenant-1', rol: RolUsuario.Admin } }),
}));

jest.mock('../context/NotificacionContext', () => ({
  useNotificacion: () => ({ mostrarNotificacion: jest.fn() }),
}));

import VistaHorarios from './Horarios';

function formatoFechaIso(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

function pad(numero: number): string {
  return String(numero).padStart(2, '0');
}

function formatoHoraUtc(fecha: Date): string {
  return `${pad(fecha.getUTCHours())}:${pad(fecha.getUTCMinutes())}`;
}

/**
 * Fix 2026-07-22: `horaInicio`/`horaFin` de una jornada son hora de pared del club
 * (America/Bogota, UTC-5) -- asi los interpreta `ventanaClaseEnVivoService` desde el fix del
 * desfase horario, y asi los carga el usuario. Los fixtures de la ventana de Clase en Vivo
 * deben derivarse en ESA zona, no en UTC: con `formatoHoraUtc` una clase construida como
 * "ahora - 5 min" quedaba 5 horas corrida y el boton nunca aparecia.
 */
function formatoHoraClub(fecha: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(fecha);
}

/** Fecha calendario (YYYY-MM-DD) en la zona del club, por el mismo motivo que `formatoHoraClub`. */
function formatoFechaClub(fecha: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(fecha);
}

const hoy = new Date();
const manana = new Date(hoy);
manana.setUTCDate(hoy.getUTCDate() + 1);
const ayer = new Date(hoy);
ayer.setUTCDate(hoy.getUTCDate() - 1);

const fechaFutura = formatoFechaIso(manana);
const fechaPasada = formatoFechaIso(ayer);

// Fase 4 (clase-en-vivo-checkin-trigger-agenda): la describe "Fase 4: trigger de Clase en
// Vivo" usa reloj FIJO (jest.useFakeTimers + setSystemTime), no reloj real. Motivo (bug real
// encontrado en auditoria independiente): la version anterior derivaba horaInicio/horaFin del
// reloj real via `formatoHoraUtc` (solo HH:MM, sin fecha) pero emparejaba ese HH:MM con
// `fechaHoy` (fecha de HOY fija). Si el offset cruzaba las 00:00 UTC (p.ej. "ahora" real =
// 23:57 UTC, horaFinEnVentana = ahora+30min = "00:27" del dia SIGUIENTE), el HH:MM resultante
// quedaba mal emparejado con la fecha de HOY en vez de MAÑANA, rompiendo el calculo de ventana
// `estaJornadaEnVentana` durante una ventana de ~40min/dia alrededor de medianoche UTC (flake
// transitorio real, no atribuible a `ventanaClaseEnVivoService.ts` — el bug estaba en como este
// archivo de test derivaba sus propios fixtures). Fijar el reloj a un instante lejos de
// cualquier borde de dia (mediodia UTC) elimina la clase de bug por completo sin perder
// cobertura: `jest.useFakeTimers()` intercepta el `new Date()` que usa `Horarios.tsx` para su
// `ahoraIso` (sin inyeccion de dependencia), igual patron ya probado en
// `hooks/useVentanaClaseEnVivo.test.ts`.

// Consts de las otras describes de este archivo (no relacionadas a Fase 4): siguen en reloj
// real, no tienen el bug de rollover porque comparan fecha completa (>=, <), no HH:MM aislado.

function StubClaseEnVivo() {
  const { jornadaId } = useParams<{ jornadaId: string }>();
  return <div>Clase en vivo montada: {jornadaId}</div>;
}

function renderHorarios() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<VistaHorarios />} />
        <Route path="/clase-en-vivo/:jornadaId" element={<StubClaseEnVivo />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('VistaHorarios', () => {
  it('muestra clases academicas junto a los bloques comerciales, sin boton de editar en las academicas', async () => {
    (obtenerClasesAcademicasDelTenant as jest.Mock).mockResolvedValue([
      {
        id: 'clase-academica-1',
        jornadaId: 'jornada-academica-1',
        origen: 'academico',
        dia: 'Lunes',
        horaInicio: '10:00',
        horaFin: '11:00',
        sedeId: 'sede-1',
        instructorId: 'maestro-1',
        grupo: 'Infantil',
        nombrePrograma: 'Programa academico',
        proximaFecha: '2026-06-08',
        materialAsignado: ['Fundamentos tecnicos'],
      },
    ]);

    renderHorarios();

    expect(await screen.findByText('Programa academico')).toBeInTheDocument();
    expect(screen.getByText('Programa comercial')).toBeInTheDocument();
    expect(screen.getByText(/Material: Fundamentos tecnicos/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(obtenerClasesAcademicasDelTenant).toHaveBeenCalledWith('tenant-1');
    });
  });

  it('muestra badge y atenua la tarjeta de una clase cancelada vigente (fecha >= hoy)', async () => {
    (obtenerClasesAcademicasDelTenant as jest.Mock).mockResolvedValue([
      {
        id: 'clase-cancelada-vigente',
        jornadaId: 'jornada-cancelada-vigente',
        origen: 'academico',
        dia: 'Lunes',
        horaInicio: '10:00',
        horaFin: '11:00',
        sedeId: 'sede-1',
        instructorId: 'maestro-1',
        grupo: 'Infantil',
        nombrePrograma: 'Programa cancelado vigente',
        proximaFecha: fechaFutura,
        materialAsignado: [],
        estado: 'cancelada',
      },
    ]);

    renderHorarios();

    expect(await screen.findByText('Programa cancelado vigente')).toBeInTheDocument();
    expect(screen.getByText(/^cancelada$/i)).toBeInTheDocument();
  });

  it('muestra badge para una clase reprogramada vigente (fecha >= hoy)', async () => {
    (obtenerClasesAcademicasDelTenant as jest.Mock).mockResolvedValue([
      {
        id: 'clase-reprogramada-vigente',
        jornadaId: 'jornada-reprogramada-vigente',
        origen: 'academico',
        dia: 'Lunes',
        horaInicio: '10:00',
        horaFin: '11:00',
        sedeId: 'sede-1',
        instructorId: 'maestro-1',
        grupo: 'Infantil',
        nombrePrograma: 'Programa reprogramado vigente',
        proximaFecha: fechaFutura,
        materialAsignado: [],
        estado: 'reprogramada',
      },
    ]);

    renderHorarios();

    expect(await screen.findByText('Programa reprogramado vigente')).toBeInTheDocument();
    expect(screen.getByText(/^reprogramada$/i)).toBeInTheDocument();
  });

  it('no renderiza una clase cancelada/reprogramada cuya fecha ya paso (vencida)', async () => {
    (obtenerClasesAcademicasDelTenant as jest.Mock).mockResolvedValue([
      {
        id: 'clase-control-vigente',
        jornadaId: 'jornada-control-vigente',
        origen: 'academico',
        dia: 'Lunes',
        horaInicio: '09:00',
        horaFin: '10:00',
        sedeId: 'sede-1',
        instructorId: 'maestro-1',
        grupo: 'Infantil',
        nombrePrograma: 'Programa control vigente',
        proximaFecha: fechaFutura,
        materialAsignado: [],
        estado: 'confirmada',
      },
      {
        id: 'clase-cancelada-vencida',
        jornadaId: 'jornada-cancelada-vencida',
        origen: 'academico',
        dia: 'Lunes',
        horaInicio: '10:00',
        horaFin: '11:00',
        sedeId: 'sede-1',
        instructorId: 'maestro-1',
        grupo: 'Infantil',
        nombrePrograma: 'Programa cancelado vencido',
        proximaFecha: fechaPasada,
        materialAsignado: [],
        estado: 'cancelada',
      },
    ]);

    renderHorarios();

    // Se espera primero por el control siempre-visible: garantiza que el estado
    // ya se actualizo con la respuesta resuelta antes de verificar la ausencia
    // de la tarjeta vencida (evita falsos positivos por condicion de carrera).
    expect(await screen.findByText('Programa control vigente')).toBeInTheDocument();
    expect(screen.queryByText('Programa cancelado vencido')).not.toBeInTheDocument();
  });

  describe('Fase 4: trigger de Clase en Vivo con jornadaId real', () => {
    // Instante de referencia fijo (mediodia UTC): lejos de cualquier borde de dia, elimina el
    // bug de rollover de medianoche descrito arriba. `jest.setSystemTime` hace que el
    // `new Date()` interno de `Horarios.tsx` (sin inyeccion de reloj) lea este mismo instante.
    const referenciaAhora = new Date('2026-06-06T12:00:00.000Z');
    const fechaReferencia = formatoFechaClub(referenciaAhora);
    const horaInicioEnVentanaFija = formatoHoraClub(new Date(referenciaAhora.getTime() - 5 * 60_000));
    const horaFinEnVentanaFija = formatoHoraClub(new Date(referenciaAhora.getTime() + 30 * 60_000));
    // Fuera de ventana: una clase que ya cerro hace mucho (horaFin+15 < ahora).
    const horaInicioFueraDeVentanaFija = formatoHoraClub(new Date(referenciaAhora.getTime() - 5 * 60 * 60_000));
    const horaFinFueraDeVentanaFija = formatoHoraClub(new Date(referenciaAhora.getTime() - 4 * 60 * 60_000));

    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(referenciaAhora);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('muestra "Iniciar Clase en Vivo" sobre una clase academica dentro de la ventana horaria, y navega con el jornadaId real al hacer clic', async () => {
      (obtenerClasesAcademicasDelTenant as jest.Mock).mockResolvedValue([
        {
          id: 'bloque-recurrente-sabado',
          jornadaId: 'jornada-real-hoy',
          origen: 'academico',
          dia: 'Lunes',
          horaInicio: horaInicioEnVentanaFija,
          horaFin: horaFinEnVentanaFija,
          sedeId: 'sede-1',
          instructorId: 'maestro-1',
          grupo: 'Infantil',
          nombrePrograma: 'Programa en ventana',
          proximaFecha: fechaReferencia,
          materialAsignado: [],
          estado: 'confirmada',
        },
      ]);

      renderHorarios();

      const boton = await screen.findByRole('button', { name: /iniciar asistencia/i });
      fireEvent.click(boton);

      expect(await screen.findByText('Clase en vivo montada: jornada-real-hoy')).toBeInTheDocument();
    });

    it('no muestra el boton para un bloque comercial (sin jornadaId real)', async () => {
      (obtenerClasesAcademicasDelTenant as jest.Mock).mockResolvedValue([]);

      renderHorarios();

      expect(await screen.findByText('Programa comercial')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /iniciar asistencia/i })).not.toBeInTheDocument();
    });

    it('no muestra el boton para una clase academica fuera de la ventana horaria', async () => {
      (obtenerClasesAcademicasDelTenant as jest.Mock).mockResolvedValue([
        {
          id: 'bloque-recurrente-fuera-ventana',
          jornadaId: 'jornada-fuera-ventana',
          origen: 'academico',
          dia: 'Lunes',
          horaInicio: horaInicioFueraDeVentanaFija,
          horaFin: horaFinFueraDeVentanaFija,
          sedeId: 'sede-1',
          instructorId: 'maestro-1',
          grupo: 'Infantil',
          nombrePrograma: 'Programa fuera de ventana',
          proximaFecha: fechaReferencia,
          materialAsignado: [],
          estado: 'confirmada',
        },
      ]);

      renderHorarios();

      expect(await screen.findByText('Programa fuera de ventana')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /iniciar asistencia/i })).not.toBeInTheDocument();
    });
  });
});
