// vistas/LicenciaSuspendida.test.tsx
// SDD pricing-cupo-real (Bloque 4b): no existía test file para esta vista antes de este
// cambio. Mismo criterio que vistas/PasarelaPagos.tsx (ver ese archivo para el razonamiento
// completo): el monto de renovación se calcula EN VIVO con calcularFacturacionMensual
// (Bloque 2) alimentada por el conteo real de estudiantes facturables
// (obtenerEstudiantes + esFacturable), no con un precio de plan fijo.
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LicenciaSuspendida from './LicenciaSuspendida';
import { useEstadoLicencia } from '../hooks/useEstadoLicencia';
import { obtenerEstudiantes } from '../servicios/estudiantesApi';
import { construirUrlCheckoutWompi } from '../servicios/wompiApi';
import { calcularFacturacionMensual } from '../utils/facturacion';
import { EstadoPago, GradoTKD, GrupoEdad, type Estudiante } from '../tipos';

jest.mock('../hooks/useEstadoLicencia', () => ({ useEstadoLicencia: jest.fn() }));
jest.mock('../servicios/estudiantesApi', () => ({ obtenerEstudiantes: jest.fn() }));
jest.mock('../servicios/wompiApi', () => ({ construirUrlCheckoutWompi: jest.fn() }));

const useEstadoLicenciaMock = useEstadoLicencia as jest.MockedFunction<typeof useEstadoLicencia>;
const obtenerEstudiantesMock = obtenerEstudiantes as jest.MockedFunction<typeof obtenerEstudiantes>;
const construirUrlCheckoutWompiMock = construirUrlCheckoutWompi as jest.MockedFunction<typeof construirUrlCheckoutWompi>;

const crearEstudiante = (id: string, estadoMatricula: 'activo' | 'retirado'): Estudiante => ({
  id, tenantId: 'tenant-1', nombres: `Est${id}`, apellidos: 'Prueba', numeroIdentificacion: id,
  telefono: '3000000000', correo: `${id}@test.com`, fechaNacimiento: '2010-01-01',
  grado: GradoTKD.Blanco, grupo: GrupoEdad.Precadetes, horasAcumuladasGrado: 0, sedeId: 'sede-1',
  fechaIngreso: '2024-01-01', estadoPago: EstadoPago.AlDia, saldoDeudor: 0, historialPagos: [],
  consentimientoInformado: false, contratoServiciosFirmado: false, consentimientoImagenFirmado: false,
  consentimientoFotosVideos: false, carnetGenerado: false, estadoMatricula,
});

describe('LicenciaSuspendida', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useEstadoLicenciaMock.mockReturnValue({
      diasRestantes: -5,
      fechaVencimiento: '2026-07-01',
      diasGracia: 5,
      esDemo: false,
      cargando: false,
      configClub: {
        tenantId: 'tenant-1',
        sedesExtraContratadas: 0,
        equipoTecnicoExtraContratado: 1,
      } as any,
    } as any);
    construirUrlCheckoutWompiMock.mockResolvedValue('https://checkout.wompi.co/p/?ref=test');
  });

  it('calcula el monto en vivo con calcularFacturacionMensual, sin depender de un plan', async () => {
    obtenerEstudiantesMock.mockResolvedValue([
      crearEstudiante('1', 'activo'),
      crearEstudiante('2', 'retirado'),
    ]);

    render(<LicenciaSuspendida />);

    const resultadoEsperado = calcularFacturacionMensual({
      estudiantesFacturables: 1,
      sedesExtraContratadas: 0,
      equipoTecnicoExtraContratado: 1,
    });

    await waitFor(() => {
      expect(screen.getByTestId('monto-renovacion').textContent?.replace(/\s/g, '')).toBe(
        new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })
          .format(resultadoEsperado.totalPesos).replace(/\s/g, '')
      );
    });
    expect(obtenerEstudiantesMock).toHaveBeenCalledWith('tenant-1');
  });

  it('el botón de pago envía el monto en vivo a Wompi', async () => {
    const user = userEvent.setup();
    obtenerEstudiantesMock.mockResolvedValue([crearEstudiante('1', 'activo')]);
    render(<LicenciaSuspendida />);

    const resultadoEsperado = calcularFacturacionMensual({
      estudiantesFacturables: 1,
      sedesExtraContratadas: 0,
      equipoTecnicoExtraContratado: 1,
    });

    await waitFor(() => expect(screen.getByTestId('monto-renovacion')).not.toHaveTextContent('...'));
    await user.click(screen.getByText(/Pagar & Activar Ahora/i));

    await waitFor(() => {
      expect(construirUrlCheckoutWompiMock).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'tenant-1', montoEnPesos: resultadoEsperado.totalPesos })
      );
    });
  });
});
