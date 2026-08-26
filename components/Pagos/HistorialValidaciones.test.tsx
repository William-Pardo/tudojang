// components/Pagos/HistorialValidaciones.test.tsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, jest, beforeEach, afterEach, expect } from '@jest/globals';
import HistorialValidaciones from './HistorialValidaciones';
import { useAuth } from '../../context/AuthContext';
import { useEstudiantes } from '../../context/DataContext';
import { useNotificacion } from '../../context/NotificacionContext';
import { obtenerHistorialReportes } from '../../servicios/pagosEstudiantesApi';
import { EstadoValidacion, type ReportePagoEstudiante, type Estudiante } from '../../tipos';

jest.mock('../../context/AuthContext', () => ({
    useAuth: jest.fn(),
}));

jest.mock('../../context/DataContext', () => ({
    useEstudiantes: jest.fn(),
}));

jest.mock('../../context/NotificacionContext', () => ({
    useNotificacion: jest.fn(),
}));

jest.mock('../../servicios/pagosEstudiantesApi', () => ({
    obtenerHistorialReportes: jest.fn(),
}));

const useAuthMock = useAuth as jest.Mock;
const useEstudiantesMock = useEstudiantes as jest.Mock;
const useNotificacionMock = useNotificacion as jest.Mock;
const obtenerHistorialReportesMock = obtenerHistorialReportes as jest.Mock<() => Promise<ReportePagoEstudiante[]>>;

const usuarioMock = { id: 'admin-1', tenantId: 'tenant-1' };

const crearReporte = (overrides: Partial<ReportePagoEstudiante> = {}): ReportePagoEstudiante => ({
    id: 'rep-1',
    tenantId: 'tenant-1',
    estudianteId: 'est-1',
    estudianteNombre: 'Ana García',
    montoInformado: 50000,
    fechaReporte: '2026-08-01T00:00:00.000Z',
    comprobanteUrl: 'https://example.com/x.jpg',
    estado: EstadoValidacion.Aprobado,
    fechaValidacion: '2026-08-02T00:00:00.000Z',
    validadoPor: 'admin-1',
    ...overrides,
});

const crearEstudianteContexto = (overrides: Partial<Estudiante> = {}): Partial<Estudiante> & { id: string } => ({
    id: 'est-1',
    tutor: { nombres: 'Carlos', apellidos: 'García', numeroIdentificacion: '1', telefono: '3000000000', correo: 'carlos@test.com' },
    ...overrides,
});

describe('HistorialValidaciones', () => {
    let mostrarNotificacion: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        useAuthMock.mockReturnValue({ usuario: usuarioMock });
        useEstudiantesMock.mockReturnValue({ estudiantes: [crearEstudianteContexto()] });
        mostrarNotificacion = jest.fn();
        useNotificacionMock.mockReturnValue({ mostrarNotificacion });
    });

    it('muestra el estado de carga mientras resuelve el historial', () => {
        obtenerHistorialReportesMock.mockReturnValue(new Promise(() => { }));
        render(<HistorialValidaciones />);
        expect(screen.getByText(/Cargando Historial/i)).toBeInTheDocument();
    });

    it('muestra el estado vacío cuando no hay reportes resueltos', async () => {
        obtenerHistorialReportesMock.mockResolvedValue([]);
        render(<HistorialValidaciones />);
        expect(await screen.findByText('Sin Historial')).toBeInTheDocument();
    });

    it('si la consulta falla, notifica el error y cae al estado vacío sin crashear', async () => {
        obtenerHistorialReportesMock.mockRejectedValue(new Error('Firestore caído'));
        render(<HistorialValidaciones />);
        await waitFor(() => expect(mostrarNotificacion).toHaveBeenCalledWith('Error al cargar el historial de validaciones.', 'error'));
        expect(screen.getByText('Sin Historial')).toBeInTheDocument();
    });

    it('resuelve el tutor desde el contexto de estudiantes cuando lo encuentra', async () => {
        obtenerHistorialReportesMock.mockResolvedValue([crearReporte({ datosIA: { entidad: 'Nequi' } })]);
        render(<HistorialValidaciones />);
        expect(await screen.findByText('Ana García')).toBeInTheDocument();
        expect(screen.getByText('Carlos García')).toBeInTheDocument();
        expect(screen.getByText('Nequi')).toBeInTheDocument();
    });

    it('si el estudiante del reporte no está en el contexto (o no tiene tutor), muestra "—" para el tutor en vez de crashear', async () => {
        useEstudiantesMock.mockReturnValue({ estudiantes: [] });
        obtenerHistorialReportesMock.mockResolvedValue([crearReporte({ datosIA: { entidad: 'Nequi' } })]);
        render(<HistorialValidaciones />);
        await screen.findByText('Ana García');
        expect(screen.getByText('Nequi')).toBeInTheDocument();
        expect(screen.getByText('—')).toBeInTheDocument();
    });

    it('distingue visualmente Aprobado (verde) de Rechazado (rojo) en el badge de estado', async () => {
        obtenerHistorialReportesMock.mockResolvedValue([
            crearReporte({ id: 'rep-ok', estudianteNombre: 'Reporte Aprobado', estado: EstadoValidacion.Aprobado }),
            crearReporte({ id: 'rep-no', estudianteNombre: 'Reporte Rechazado', estado: EstadoValidacion.Rechazado }),
        ]);
        render(<HistorialValidaciones />);
        await screen.findByText('Reporte Aprobado');

        const badgeAprobado = screen.getByText(EstadoValidacion.Aprobado);
        const badgeRechazado = screen.getByText(EstadoValidacion.Rechazado);
        expect(badgeAprobado.className).toMatch(/green/);
        expect(badgeRechazado.className).toMatch(/tkd-red/);
    });

    describe('exportación a CSV', () => {
        let createObjectURLMock: jest.Mock;
        let clickSpy: jest.SpiedFunction<typeof HTMLAnchorElement.prototype.click>;
        let capturedBlobParts: unknown[];
        const OriginalBlob = global.Blob;

        beforeEach(() => {
            createObjectURLMock = jest.fn().mockReturnValue('blob:mock-url');
            capturedBlobParts = [];
            // jsdom no implementa createObjectURL/revokeObjectURL, y su Blob no trae .text() --
            // se intercepta el constructor para leer las partes crudas que arma el componente.
            (window.URL as any).createObjectURL = createObjectURLMock;
            (window.URL as any).revokeObjectURL = jest.fn();
            (global as any).Blob = jest.fn((parts: unknown[], options: unknown) => {
                capturedBlobParts = parts;
                return new OriginalBlob(parts as BlobPart[], options as BlobPropertyBag);
            });
            clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => { });
        });

        afterEach(() => {
            clickSpy.mockRestore();
            global.Blob = OriginalBlob;
        });

        it('arma el CSV con los campos esperados y escapa correctamente una coma dentro de un nombre', async () => {
            useEstudiantesMock.mockReturnValue({
                estudiantes: [crearEstudianteContexto({ tutor: { nombres: 'García, Ana', apellidos: '', numeroIdentificacion: '1', telefono: '', correo: '' } })],
            });
            obtenerHistorialReportesMock.mockResolvedValue([crearReporte({ datosIA: { entidad: 'Daviplata' } })]);
            const user = userEvent.setup();
            render(<HistorialValidaciones />);
            await screen.findByText('Ana García');

            await user.click(screen.getByRole('button', { name: /Exportar CSV/i }));

            expect(createObjectURLMock).toHaveBeenCalledTimes(1);
            const contenido = capturedBlobParts.join('');

            expect(contenido).toContain('Estudiante,Tutor,Monto,Canal,FechaReportada,FechaValidada,Estado,ValidadoPor');
            // El nombre con coma debe quedar entre comillas para no partir la columna en el CSV.
            expect(contenido).toContain('"García, Ana"');
            expect(contenido).toContain('Ana García');
            expect(contenido).toContain('Daviplata');
            expect(clickSpy).toHaveBeenCalledTimes(1);
        });
    });
});
