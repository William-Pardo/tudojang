// vistas/PasarelaPagos.test.tsx
// SDD pricing-cupo-real (Bloque 4b): no existía test file para esta vista antes de este
// cambio. PasarelaPagos.tsx se renderiza DENTRO de BrandingProvider, ANTES de que monte
// DataProvider (estado==='vencido') -- no puede reusar useEstudiantes()/useConfiguracion()
// via contexto. Por eso el monto en vivo se resuelve acá con piezas ya construidas y
// probadas, sin inventar una fórmula nueva: obtenerEstudiantes(tenantId) (standalone,
// servicios/estudiantesApi.ts) + esFacturable + calcularFacturacionMensual
// (utils/facturacion.ts, Bloque 2, misma función que usa el cobro real -- spec
// precio-publico-calculadora: "Calculadora y cobro coinciden").
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VistaPasarelaPagos from './PasarelaPagos';
import { useTenant } from '../components/BrandingProvider';
import { obtenerEstudiantes } from '../servicios/estudiantesApi';
import { construirUrlCheckoutWompi } from '../servicios/wompiApi';
import { calcularFacturacionMensual } from '../utils/facturacion';
import { EstadoPago, GradoTKD, GrupoEdad, type Estudiante } from '../tipos';

jest.mock('../components/BrandingProvider', () => ({ useTenant: jest.fn() }));
jest.mock('../servicios/estudiantesApi', () => ({ obtenerEstudiantes: jest.fn() }));
jest.mock('../servicios/wompiApi', () => ({ construirUrlCheckoutWompi: jest.fn() }));
jest.mock('../components/LogoDinamico', () => () => <div>Logo</div>);

const useTenantMock = useTenant as jest.MockedFunction<typeof useTenant>;
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

describe('PasarelaPagos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useTenantMock.mockReturnValue({
      tenant: {
        tenantId: 'tenant-1',
        nombreClub: 'Academia Test',
        sedesExtraContratadas: 1,
        equipoTecnicoExtraContratado: 0,
      } as any,
      estaCargado: true,
      cargarTenant: jest.fn(),
    });
    construirUrlCheckoutWompiMock.mockResolvedValue('https://checkout.wompi.co/p/?ref=test');
  });

  it('Scenario "Calculadora y cobro coinciden": calcula el monto en vivo con calcularFacturacionMensual, excluyendo estudiantes retirados', async () => {
    obtenerEstudiantesMock.mockResolvedValue([
      crearEstudiante('1', 'activo'),
      crearEstudiante('2', 'activo'),
      crearEstudiante('3', 'retirado'), // NO debe contar
    ]);

    render(<VistaPasarelaPagos />);

    const resultadoEsperado = calcularFacturacionMensual({
      estudiantesFacturables: 2, // solo los 2 activos -- el retirado no factura
      sedesExtraContratadas: 1,
      equipoTecnicoExtraContratado: 0,
    });

    await waitFor(() => {
      expect(screen.getByTestId('monto-renovacion').textContent?.replace(/\s/g, '')).toBe(
        new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })
          .format(resultadoEsperado.totalPesos).replace(/\s/g, '')
      );
    });

    expect(obtenerEstudiantesMock).toHaveBeenCalledWith('tenant-1');
  });

  it('el botón de pago envía el monto en vivo calculado a Wompi, no un precio de plan fijo', async () => {
    const user = userEvent.setup();
    obtenerEstudiantesMock.mockResolvedValue([crearEstudiante('1', 'activo')]);

    render(<VistaPasarelaPagos />);

    const resultadoEsperado = calcularFacturacionMensual({
      estudiantesFacturables: 1,
      sedesExtraContratadas: 1,
      equipoTecnicoExtraContratado: 0,
    });

    await waitFor(() => expect(screen.getByTestId('monto-renovacion')).not.toHaveTextContent('...'));
    await user.click(screen.getByRole('button', { name: /pagar/i }));

    await waitFor(() => {
      expect(construirUrlCheckoutWompiMock).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          montoEnPesos: resultadoEsperado.totalPesos,
        })
      );
    });
  });

  it('deshabilita el botón de pago mientras calcula el monto en vivo', async () => {
    let resolverPromesa: (v: Estudiante[]) => void = () => {};
    obtenerEstudiantesMock.mockReturnValue(new Promise((resolve) => { resolverPromesa = resolve; }));

    render(<VistaPasarelaPagos />);

    expect(screen.getByRole('button', { name: /pagar/i })).toBeDisabled();
    resolverPromesa([]);
    await waitFor(() => expect(screen.getByRole('button', { name: /pagar/i })).not.toBeDisabled());
  });
});
