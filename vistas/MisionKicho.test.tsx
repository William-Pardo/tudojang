// vistas/MisionKicho.test.tsx
// Cobertura de la INTEGRACIÓN de UI agregada en el PR #71 (validaciones "preguntar y
// confirmar"): el gating del ModalConfirmacion sobre los DOS caminos de aprobación --
// handleValidar (tabla "Aspirantes Detectados", ligada a una misión activa) y
// handleGuardarAprobacion (flujo "revisar y aprobar" vía FormularioEstudiante, sobre
// "Solicitudes Pendientes"). detectarInconsistencias (utils/censoInconsistencias.ts) se
// mockea entero para controlar determinísticamente si "hay alertas" en cada caso -- su lógica
// interna no es parte de este PR y no se re-testea acá.

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VistaMisionKicho from './MisionKicho';
import { RolUsuario, type RegistroTemporal, type MisionKicho } from '../tipos';
import { MISION_ID_DIRECTO } from '../constantes';
import {
  obtenerMisionActivaTenant, obtenerRegistrosMision, validarRegistroTemporal,
  obtenerRegistrosPendientesTenant, eliminarRegistroTemporal,
} from '../servicios/censoApi';
import { detectarInconsistencias } from '../utils/censoInconsistencias';

let mockUsuario: any = { id: 'admin-1', tenantId: 'tenant-1', rol: RolUsuario.Admin, nombreUsuario: 'Admin Test', email: 'admin@test.com' };
let mockEstudiantes: any[] = [];
let mockSedesVisibles: any[] = [];
let mockConfigClub: any = { slug: 'test-club' };
const mockMostrarNotificacion = jest.fn();

jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ usuario: mockUsuario }) }));
jest.mock('../context/NotificacionContext', () => ({ useNotificacion: () => ({ mostrarNotificacion: mockMostrarNotificacion }) }));
jest.mock('../context/DataContext', () => ({
  useEstudiantes: () => ({ estudiantes: mockEstudiantes }),
  useSedes: () => ({ sedesVisibles: mockSedesVisibles }),
  useConfiguracion: () => ({ configClub: mockConfigClub }),
}));

jest.mock('../servicios/censoApi', () => ({
  obtenerMisionActivaTenant: jest.fn(),
  obtenerRegistrosMision: jest.fn(),
  validarRegistroTemporal: jest.fn(),
  legalizarLoteKicho: jest.fn(),
  crearMisionKicho: jest.fn(),
  obtenerRegistrosPendientesTenant: jest.fn(),
  eliminarRegistroTemporal: jest.fn(),
  obtenerTodosRegistrosTenant: jest.fn(),
  actualizarDatosRegistroTemporal: jest.fn(),
}));

jest.mock('../servicios/soporteApi', () => ({ crearTicketSoporte: jest.fn() }));
jest.mock('../utils/kichoSimulator', () => ({ simularRegistrosMasivos: jest.fn() }));

// detectarInconsistencias se mockea entero: cada test decide si "hay alertas" devolviendo un
// array vacío o no, sin depender de la heurística real (ya cubierta aparte).
jest.mock('../utils/censoInconsistencias', () => ({
  detectarInconsistencias: jest.fn(),
}));

// Stub de FormularioEstudiante para aislar el gating de MisionKicho del formulario completo
// (que ya tiene su propia suite en components/FormularioEstudiante.test.tsx). El botón invoca
// el mismo onGuardar que MisionKicho.tsx le pasa de verdad (handleGuardarAprobacion).
jest.mock('../components/FormularioEstudiante', () => ({
  __esModule: true,
  default: (props: any) => (
    <button onClick={() => props.onGuardar({ nombres: 'Stub', apellidos: 'Datos' })}>guardar-stub</button>
  ),
}));

jest.mock('qrcode.react', () => ({ QRCodeSVG: (p: any) => <div data-testid="qr">{p.value}</div> }));

const obtenerMisionActivaTenantMock = obtenerMisionActivaTenant as jest.Mock;
const obtenerRegistrosMisionMock = obtenerRegistrosMision as jest.Mock;
const validarRegistroTemporalMock = validarRegistroTemporal as jest.Mock;
const obtenerRegistrosPendientesTenantMock = obtenerRegistrosPendientesTenant as jest.Mock;
const eliminarRegistroTemporalMock = eliminarRegistroTemporal as jest.Mock;
const detectarInconsistenciasMock = detectarInconsistencias as jest.Mock;

describe('MisionKicho', () => {
  const guardarEstudianteMock = jest.fn().mockResolvedValue(undefined);

  const misionMock: MisionKicho = {
    id: 'mision-1',
    tenantId: 'tenant-1',
    nombreMision: 'PROTOCOLO DE CARGA INICIAL (5D)',
    fechaExpiracion: new Date(Date.now() + 5 * 86400000).toISOString(),
    activa: true,
    registrosRecibidos: 1,
    estadoLote: 'captura',
  };

  const registroBase: RegistroTemporal = {
    id: 'reg-1',
    tenantId: 'tenant-1',
    misionId: 'mision-1',
    fechaRegistro: '2026-01-01T00:00:00.000Z',
    estado: 'pendiente',
    datos: {
      nombres: 'Carlos',
      apellidos: 'Ruiz',
      email: 'carlos@test.com',
      telefono: '3001112233',
      fechaNacimiento: '1990-01-01',
    },
  };

  const registroDirectoBase: RegistroTemporal = {
    id: 'regd-1',
    tenantId: 'tenant-1',
    misionId: MISION_ID_DIRECTO,
    fechaRegistro: '2026-01-01T00:00:00.000Z',
    estado: 'pendiente',
    datos: {
      nombres: 'Laura',
      apellidos: 'Gómez',
      email: 'laura@test.com',
      telefono: '3002223344',
      fechaNacimiento: '1995-01-01',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUsuario = { id: 'admin-1', tenantId: 'tenant-1', rol: RolUsuario.Admin, nombreUsuario: 'Admin Test', email: 'admin@test.com' };
    mockEstudiantes = [];
    mockSedesVisibles = [];
    mockConfigClub = { slug: 'test-club' };
    guardarEstudianteMock.mockClear().mockResolvedValue(undefined);
    obtenerMisionActivaTenantMock.mockResolvedValue(null);
    obtenerRegistrosMisionMock.mockResolvedValue([]);
    obtenerRegistrosPendientesTenantMock.mockResolvedValue([]);
    validarRegistroTemporalMock.mockResolvedValue(undefined);
    eliminarRegistroTemporalMock.mockResolvedValue(undefined);
    detectarInconsistenciasMock.mockReturnValue([]);
  });

  const renderMisionKicho = () => render(
    <VistaMisionKicho guardarEstudiante={guardarEstudianteMock} cargandoAccion={false} />
  );

  describe('handleValidar (tabla "Aspirantes Detectados", requiere misión activa)', () => {
    beforeEach(() => {
      obtenerMisionActivaTenantMock.mockResolvedValue(misionMock);
      obtenerRegistrosMisionMock.mockResolvedValue([registroBase]);
    });

    it('aprobar con alertas muestra el modal antes de validar; confirmando, llama a validarRegistroTemporal(id, "verificado")', async () => {
      detectarInconsistenciasMock.mockReturnValue([{ campo: 'telefono', mensaje: 'Teléfono con formato raro' }]);
      renderMisionKicho();
      const user = userEvent.setup({ delay: null });

      const aprobarBtn = await screen.findByRole('button', { name: 'Aprobar para Inyección' });
      await user.click(aprobarBtn);

      await waitFor(() => expect(screen.getByText('Confirmar Aprobación')).toBeInTheDocument());
      expect(validarRegistroTemporalMock).not.toHaveBeenCalled();

      await user.click(screen.getByRole('button', { name: /Aprobar de todas formas/i }));

      await waitFor(() => expect(validarRegistroTemporalMock).toHaveBeenCalledWith('reg-1', 'verificado'));
    });

    it('rechazar nunca muestra el modal aunque haya alertas -- llama a validarRegistroTemporal(id, "rechazado") directo', async () => {
      detectarInconsistenciasMock.mockReturnValue([{ campo: 'telefono', mensaje: 'Teléfono con formato raro' }]);
      renderMisionKicho();
      const user = userEvent.setup({ delay: null });

      const rechazarBtn = await screen.findByRole('button', { name: 'Rechazar Registro' });
      await user.click(rechazarBtn);

      await waitFor(() => expect(validarRegistroTemporalMock).toHaveBeenCalledWith('reg-1', 'rechazado'));
      expect(screen.queryByText('Confirmar Aprobación')).not.toBeInTheDocument();
    });

    it('sin alertas, aprobar llama a validarRegistroTemporal directo, sin modal', async () => {
      detectarInconsistenciasMock.mockReturnValue([]);
      renderMisionKicho();
      const user = userEvent.setup({ delay: null });

      const aprobarBtn = await screen.findByRole('button', { name: 'Aprobar para Inyección' });
      await user.click(aprobarBtn);

      await waitFor(() => expect(validarRegistroTemporalMock).toHaveBeenCalledWith('reg-1', 'verificado'));
      expect(screen.queryByText('Confirmar Aprobación')).not.toBeInTheDocument();
    });
  });

  describe('handleGuardarAprobacion (flujo "revisar y aprobar" desde Solicitudes Pendientes)', () => {
    beforeEach(() => {
      // No requiere misión activa -- seccionCompartirDirecta (con "Solicitudes Pendientes")
      // se renderiza tanto en el branch de onboarding como en el branch con misión.
      obtenerMisionActivaTenantMock.mockResolvedValue(null);
      obtenerRegistrosPendientesTenantMock.mockResolvedValue([registroDirectoBase]);
    });

    it('con alertas, muestra el modal antes de crear el estudiante; confirmando, se ejecuta (guarda y limpia la solicitud)', async () => {
      detectarInconsistenciasMock.mockReturnValue([{ campo: 'email', mensaje: 'Posible duplicado' }]);
      renderMisionKicho();
      const user = userEvent.setup({ delay: null });

      const revisarBtn = await screen.findByRole('button', { name: 'Revisar y Aprobar' });
      await user.click(revisarBtn);

      const guardarStubBtn = await screen.findByText('guardar-stub');
      await user.click(guardarStubBtn);

      await waitFor(() => expect(screen.getByText('Confirmar Aprobación')).toBeInTheDocument());
      expect(guardarEstudianteMock).not.toHaveBeenCalled();

      await user.click(screen.getByRole('button', { name: /Aprobar de todas formas/i }));

      await waitFor(() => expect(guardarEstudianteMock).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(eliminarRegistroTemporalMock).toHaveBeenCalledWith('regd-1'));
    });

    it('sin alertas, guardar desde el flujo de aprobación llama a guardarEstudiante directo, sin modal', async () => {
      detectarInconsistenciasMock.mockReturnValue([]);
      renderMisionKicho();
      const user = userEvent.setup({ delay: null });

      const revisarBtn = await screen.findByRole('button', { name: 'Revisar y Aprobar' });
      await user.click(revisarBtn);

      const guardarStubBtn = await screen.findByText('guardar-stub');
      await user.click(guardarStubBtn);

      await waitFor(() => expect(guardarEstudianteMock).toHaveBeenCalledTimes(1));
      expect(screen.queryByText('Confirmar Aprobación')).not.toBeInTheDocument();
    });
  });
});
