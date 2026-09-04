// components/Pagos/PanelValidacionPagos.test.tsx
import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, jest, beforeEach, expect } from '@jest/globals';
import PanelValidacionPagos from './PanelValidacionPagos';
import { useAuth } from '../../context/AuthContext';
import { useNotificacion } from '../../context/NotificacionContext';
import { obtenerReportesPendientes, gestionarReportePago, aprobarReportesEnLote } from '../../servicios/pagosEstudiantesApi';
import { EstadoValidacion, type ReportePagoEstudiante } from '../../tipos';

jest.mock('../../context/AuthContext', () => ({
    useAuth: jest.fn(),
}));

jest.mock('../../context/NotificacionContext', () => ({
    useNotificacion: jest.fn(),
}));

jest.mock('../../servicios/pagosEstudiantesApi', () => ({
    obtenerReportesPendientes: jest.fn(),
    gestionarReportePago: jest.fn(),
    aprobarReportesEnLote: jest.fn(),
}));

const useAuthMock = useAuth as jest.Mock;
const useNotificacionMock = useNotificacion as jest.Mock;
const obtenerReportesPendientesMock = obtenerReportesPendientes as jest.Mock<() => Promise<ReportePagoEstudiante[]>>;
const gestionarReportePagoMock = gestionarReportePago as jest.Mock<(...args: unknown[]) => Promise<void>>;
const aprobarReportesEnLoteMock = aprobarReportesEnLote as jest.Mock<() => Promise<{ exitosos: string[]; fallidos: { id: string; error: string }[] }>>;

const usuarioMock = { id: 'admin-1', tenantId: 'tenant-1', rol: 'Admin' };

const crearReporte = (overrides: Partial<ReportePagoEstudiante> = {}): ReportePagoEstudiante => ({
    id: 'rep-1',
    tenantId: 'tenant-1',
    estudianteId: 'est-1',
    estudianteNombre: 'Ana García',
    montoInformado: 50000,
    fechaReporte: '2026-08-01T00:00:00.000Z',
    comprobanteUrl: 'https://example.com/comprobante.jpg',
    estado: EstadoValidacion.ValidadoIA,
    ...overrides,
});

describe('PanelValidacionPagos', () => {
    let mostrarNotificacion: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        useAuthMock.mockReturnValue({ usuario: usuarioMock });
        mostrarNotificacion = jest.fn();
        useNotificacionMock.mockReturnValue({ mostrarNotificacion });
    });

    it('muestra el estado de carga mientras resuelve la consulta', () => {
        obtenerReportesPendientesMock.mockReturnValue(new Promise(() => { }));
        render(<PanelValidacionPagos />);
        expect(screen.getByText(/Analizando Transacciones/i)).toBeInTheDocument();
    });

    it('muestra el estado vacío cuando no hay reportes pendientes', async () => {
        obtenerReportesPendientesMock.mockResolvedValue([]);
        render(<PanelValidacionPagos />);
        expect(await screen.findByText('Sin Reportes Pendientes')).toBeInTheDocument();
    });

    it('si la consulta falla, notifica el error y no crashea (queda en estado vacío)', async () => {
        obtenerReportesPendientesMock.mockRejectedValue(new Error('Firestore caído'));
        render(<PanelValidacionPagos />);
        await waitFor(() => expect(mostrarNotificacion).toHaveBeenCalledWith('Error al cargar reportes de pago.', 'error'));
        expect(screen.getByText('Sin Reportes Pendientes')).toBeInTheDocument();
    });

    it('renderiza los datos del reporte (estudiante y monto)', async () => {
        obtenerReportesPendientesMock.mockResolvedValue([crearReporte()]);
        render(<PanelValidacionPagos />);
        expect(await screen.findByText('Ana García')).toBeInTheDocument();
        expect(screen.getByText((_, el) => el?.tagName === 'P' && !!el.textContent?.replace(/\s/g, ' ').includes('50.000'))).toBeInTheDocument();
    });

    it('muestra las advertencias de la IA cuando el reporte las tiene', async () => {
        obtenerReportesPendientesMock.mockResolvedValue([
            crearReporte({ datosIA: { referencia: 'REF-1', advertencias: ['Discrepancia de monto: Alumno dice 50000, IA detectó 45000'] } }),
        ]);
        render(<PanelValidacionPagos />);
        expect(await screen.findByText(/revisar antes de aprobar/i)).toBeInTheDocument();
        expect(screen.getByText(/Discrepancia de monto/i)).toBeInTheDocument();
    });

    it('no muestra el bloque de advertencias cuando el reporte no tiene ninguna', async () => {
        obtenerReportesPendientesMock.mockResolvedValue([crearReporte({ datosIA: { referencia: 'REF-1' } })]);
        render(<PanelValidacionPagos />);
        await screen.findByText('Ana García');
        expect(screen.queryByText(/Advertencias --/i)).not.toBeInTheDocument();
    });

    it('Rechazar llama a gestionarReportePago con el estado Rechazado y el id del admin', async () => {
        const reporte = crearReporte();
        obtenerReportesPendientesMock.mockResolvedValue([reporte]);
        gestionarReportePagoMock.mockResolvedValue(undefined);
        const user = userEvent.setup();
        render(<PanelValidacionPagos />);

        await user.click(await screen.findByRole('button', { name: /Rechazar/i }));

        await waitFor(() => expect(gestionarReportePagoMock).toHaveBeenCalledWith(reporte, EstadoValidacion.Rechazado, usuarioMock.id));
        expect(mostrarNotificacion).toHaveBeenCalledWith('Pago rechazado.', 'info');
    });

    it('Validar & Emitir Recibo aprueba, quita el reporte de la lista y notifica éxito', async () => {
        const reporte = crearReporte();
        obtenerReportesPendientesMock.mockResolvedValue([reporte]);
        gestionarReportePagoMock.mockResolvedValue(undefined);
        const user = userEvent.setup();
        render(<PanelValidacionPagos />);

        await user.click(await screen.findByRole('button', { name: /Validar & Emitir Recibo/i }));

        await waitFor(() => expect(gestionarReportePagoMock).toHaveBeenCalledWith(reporte, EstadoValidacion.Aprobado, usuarioMock.id));
        expect(mostrarNotificacion).toHaveBeenCalledWith('Pago aprobado y saldo actualizado.', 'success');
        await waitFor(() => expect(screen.queryByText('Ana García')).not.toBeInTheDocument());
    });

    it('si la aprobación individual falla, notifica error y el reporte NO se quita de la lista', async () => {
        obtenerReportesPendientesMock.mockResolvedValue([crearReporte()]);
        gestionarReportePagoMock.mockRejectedValue(new Error('permission-denied'));
        const user = userEvent.setup();
        render(<PanelValidacionPagos />);

        await user.click(await screen.findByRole('button', { name: /Validar & Emitir Recibo/i }));

        await waitFor(() => expect(mostrarNotificacion).toHaveBeenCalledWith('Error al procesar el pago.', 'error'));
        expect(screen.getByText('Ana García')).toBeInTheDocument();
    });

    it('"Seleccionar todos" NUNCA incluye reportes con advertencias, aunque los deje seleccionables a mano', async () => {
        const limpio = crearReporte({ id: 'rep-limpio', estudianteNombre: 'Estudiante Limpio' });
        const conAdvertencia = crearReporte({
            id: 'rep-advertencia',
            estudianteNombre: 'Estudiante Con Advertencia',
            datosIA: { advertencias: ['Referencia duplicada'] },
        });
        obtenerReportesPendientesMock.mockResolvedValue([limpio, conAdvertencia]);
        const user = userEvent.setup();
        render(<PanelValidacionPagos />);
        await screen.findByText('Estudiante Limpio');

        expect(screen.getByText(/Seleccionar todos \(1 sin advertencias\)/i)).toBeInTheDocument();

        await user.click(screen.getByRole('checkbox', { name: /Seleccionar todos/i }));

        const tarjetaLimpio = screen.getByText('Estudiante Limpio').closest('.group') as HTMLElement;
        const tarjetaAdvertencia = screen.getByText('Estudiante Con Advertencia').closest('.group') as HTMLElement;
        expect(within(tarjetaLimpio).getByRole('checkbox')).toBeChecked();
        expect(within(tarjetaAdvertencia).getByRole('checkbox')).not.toBeChecked();
        expect(screen.getByRole('button', { name: /Aprobar seleccionados \(1\)/i })).toBeInTheDocument();
    });

    it('el botón de aprobación en lote está deshabilitado sin selección', async () => {
        obtenerReportesPendientesMock.mockResolvedValue([crearReporte()]);
        render(<PanelValidacionPagos />);
        await screen.findByText('Ana García');
        expect(screen.getByRole('button', { name: /Aprobar seleccionados \(0\)/i })).toBeDisabled();
    });

    it('aprobación en lote: éxito parcial quita solo los exitosos y deja seleccionados los fallidos', async () => {
        const ok = crearReporte({ id: 'rep-ok', estudianteNombre: 'Reporte OK' });
        const falla = crearReporte({ id: 'rep-falla', estudianteNombre: 'Reporte Con Falla' });
        obtenerReportesPendientesMock.mockResolvedValue([ok, falla]);
        aprobarReportesEnLoteMock.mockResolvedValue({
            exitosos: ['rep-ok'],
            fallidos: [{ id: 'rep-falla', error: 'Referencia duplicada con el reporte rep-otro.' }],
        });
        const user = userEvent.setup();
        render(<PanelValidacionPagos />);
        await screen.findByText('Reporte OK');

        await user.click(screen.getByRole('checkbox', { name: /Seleccionar todos/i }));
        // Ambos reportes de este test carecen de advertencias -- "seleccionar todos" los toma a los dos.
        await user.click(screen.getByRole('button', { name: /Aprobar seleccionados \(2\)/i }));

        await waitFor(() => expect(aprobarReportesEnLoteMock).toHaveBeenCalledWith([ok, falla], usuarioMock.id));
        expect(mostrarNotificacion).toHaveBeenCalledWith('1 pago(s) aprobado(s) y saldo actualizado.', 'success');
        expect(mostrarNotificacion).toHaveBeenCalledWith(
            '1 reporte(s) no se pudieron aprobar: Referencia duplicada con el reporte rep-otro.',
            'error',
        );
        await waitFor(() => expect(screen.queryByText('Reporte OK')).not.toBeInTheDocument());
        const tarjetaFalla = screen.getByText('Reporte Con Falla').closest('.group') as HTMLElement;
        expect(within(tarjetaFalla).getByRole('checkbox')).toBeChecked();
    });

    // Bug real (2026-09-04, reportado con captura en mobile): la referencia bancaria es un
    // identificador larguísimo sin espacios -- sin control de desborde, se superponía
    // visualmente con "Monto por IA" en pantallas angostas. Y el checkbox nativo, sin fondo
    // propio, tapaba datos reales de la imagen del comprobante.
    it('la referencia larga de la IA tiene control de desborde (no invade la columna vecina) y el checkbox tiene fondo propio', async () => {
        const referenciaLarga = '649032927851716444546758905930443 50'; // ~37 caracteres, sin espacios internos reales
        obtenerReportesPendientesMock.mockResolvedValue([
            crearReporte({ datosIA: { referencia: referenciaLarga, montoExtraido: 305000 } }),
        ]);
        render(<PanelValidacionPagos />);

        const textoReferencia = await screen.findByText(referenciaLarga);
        expect(textoReferencia).toHaveClass('break-all');
        expect(textoReferencia.parentElement).toHaveClass('min-w-0');

        const tarjeta = screen.getByText('Ana García').closest('.group') as HTMLElement;
        const checkbox = within(tarjeta).getByRole('checkbox');
        expect(checkbox.parentElement).toHaveClass('bg-white/95');
    });
});
