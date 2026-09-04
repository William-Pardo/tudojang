// components/Pagos/ReportarPagoTutor.test.tsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, jest, beforeEach, expect } from '@jest/globals';
import ReportarPagoTutor from './ReportarPagoTutor';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../BrandingProvider';
import { useNotificacion } from '../../context/NotificacionContext';
import { obtenerEstudiantesDelTutor, reportarPagoEstudiante } from '../../servicios/pagosEstudiantesApi';
import { EstadoPago, GradoTKD, GrupoEdad, type Estudiante } from '../../tipos';

jest.mock('../../context/AuthContext', () => ({
    useAuth: jest.fn(),
}));

jest.mock('../BrandingProvider', () => ({
    useTenant: jest.fn(),
}));

jest.mock('../../context/NotificacionContext', () => ({
    useNotificacion: jest.fn(),
}));

jest.mock('../../servicios/pagosEstudiantesApi', () => ({
    obtenerEstudiantesDelTutor: jest.fn(),
    reportarPagoEstudiante: jest.fn(),
}));

const useAuthMock = useAuth as jest.Mock;
const useTenantMock = useTenant as jest.Mock;
const useNotificacionMock = useNotificacion as jest.Mock;
const obtenerEstudiantesDelTutorMock = obtenerEstudiantesDelTutor as jest.Mock<() => Promise<Estudiante[]>>;
const reportarPagoEstudianteMock = reportarPagoEstudiante as jest.Mock<(...args: unknown[]) => Promise<string>>;

const usuarioMock = { id: 'tutor-1', tenantId: 'tenant-1', email: 'tutor@test.com' };

const crearEstudiante = (overrides: Partial<Estudiante> = {}): Estudiante => ({
    id: 'est-1',
    tenantId: 'tenant-1',
    nombres: 'Ana',
    apellidos: 'García',
    numeroIdentificacion: '12345',
    fechaNacimiento: '2010-01-01',
    grado: GradoTKD.Blanco,
    grupo: GrupoEdad.Precadetes,
    horasAcumuladasGrado: 0,
    sedeId: '1',
    estadoPago: EstadoPago.Pendiente,
    fechaIngreso: '2022-01-01',
    saldoDeudor: 50000,
    historialPagos: [],
    consentimientoInformado: false,
    contratoServiciosFirmado: false,
    consentimientoImagenFirmado: false,
    consentimientoFotosVideos: false,
    telefono: '3001234567',
    correo: 'ana@test.com',
    carnetGenerado: false,
    estadoMatricula: 'activo',
    ...overrides,
});

const adjuntarComprobante = async (user: ReturnType<typeof userEvent.setup>) => {
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['contenido'], 'comprobante.png', { type: 'image/png' });
    await user.upload(input, file);
};

describe('ReportarPagoTutor', () => {
    let mostrarNotificacion: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        useAuthMock.mockReturnValue({ usuario: usuarioMock });
        useTenantMock.mockReturnValue({ tenant: {} });
        mostrarNotificacion = jest.fn();
        useNotificacionMock.mockReturnValue({ mostrarNotificacion });
    });

    it('muestra el estado de carga mientras resuelve los estudiantes del tutor', () => {
        obtenerEstudiantesDelTutorMock.mockReturnValue(new Promise(() => { }));
        render(<ReportarPagoTutor />);
        expect(screen.getByText(/Buscando tus estudiantes/i)).toBeInTheDocument();
    });

    it('sin estudiantes vinculados, muestra el estado vacío y no crashea', async () => {
        obtenerEstudiantesDelTutorMock.mockResolvedValue([]);
        render(<ReportarPagoTutor />);
        expect(await screen.findByText('Sin Estudiantes Vinculados')).toBeInTheDocument();
    });

    it('si la carga de estudiantes falla, notifica el error y cae al estado vacío sin crashear', async () => {
        obtenerEstudiantesDelTutorMock.mockRejectedValue(new Error('permission-denied'));
        render(<ReportarPagoTutor />);
        await waitFor(() => expect(mostrarNotificacion).toHaveBeenCalledWith('Error al cargar tus estudiantes vinculados.', 'error'));
        expect(screen.getByText('Sin Estudiantes Vinculados')).toBeInTheDocument();
    });

    it('con exactamente un estudiante, lo autoselecciona y pre-llena el monto con el saldo deudor', async () => {
        obtenerEstudiantesDelTutorMock.mockResolvedValue([crearEstudiante({ saldoDeudor: 75000 })]);
        render(<ReportarPagoTutor />);
        expect(await screen.findByText('Ana García')).toBeInTheDocument();
        expect(screen.getByRole('spinbutton')).toHaveValue(75000);
        // Un solo estudiante -> no hay nada entre qué "Cambiar".
        expect(screen.queryByText('Cambiar')).not.toBeInTheDocument();
    });

    // Bug real (2026-09-03, reportado vía WhatsApp/iPhone): con saldoDeudor 0 y sin
    // valorMensualidad configurado en el tenant, el monto queda vacío -- el botón se queda
    // deshabilitado por `!monto` aunque el tutor ya haya adjuntado el comprobante, y sin ningún
    // aviso visible no hay forma de que note qué le falta. La ayuda visible y escribir el monto
    // a mano deben desbloquear el envío.
    it('con saldo deudor en 0 y sin mensualidad configurada, el monto queda vacío pero muestra ayuda visible; escribirlo y adjuntar comprobante habilita el envío', async () => {
        obtenerEstudiantesDelTutorMock.mockResolvedValue([crearEstudiante({ saldoDeudor: 0 })]);
        const user = userEvent.setup();
        render(<ReportarPagoTutor />);
        await screen.findByText('Ana García');
        expect(screen.getByRole('spinbutton')).toHaveValue(null);
        expect(screen.getByText(/Escrib.* el monto que transferiste/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /REPORTAR PAGO AHORA/i })).toBeDisabled();

        await adjuntarComprobante(user);
        expect(screen.getByRole('button', { name: /REPORTAR PAGO AHORA/i })).toBeDisabled();

        await user.type(screen.getByRole('spinbutton'), '30000');
        expect(screen.queryByText(/Escrib.* el monto que transferiste/i)).not.toBeInTheDocument();
        await waitFor(() => expect(screen.getByRole('button', { name: /REPORTAR PAGO AHORA/i })).toBeEnabled());
    });

    it('con saldo deudor en 0 y mensualidad configurada en el tenant, pre-llena el monto y no requiere que el tutor lo escriba', async () => {
        useTenantMock.mockReturnValue({ tenant: { valorMensualidad: 45000 } });
        obtenerEstudiantesDelTutorMock.mockResolvedValue([crearEstudiante({ saldoDeudor: 0 })]);
        const user = userEvent.setup();
        render(<ReportarPagoTutor />);
        await screen.findByText('Ana García');
        expect(screen.getByRole('spinbutton')).toHaveValue(45000);

        await adjuntarComprobante(user);
        await waitFor(() => expect(screen.getByRole('button', { name: /REPORTAR PAGO AHORA/i })).toBeEnabled());
    });

    it('con más de un estudiante, no autoselecciona ninguno y muestra la lista para elegir', async () => {
        obtenerEstudiantesDelTutorMock.mockResolvedValue([
            crearEstudiante({ id: 'est-1', nombres: 'Ana', apellidos: 'García', saldoDeudor: 50000 }),
            crearEstudiante({ id: 'est-2', nombres: 'Luis', apellidos: 'Pérez', saldoDeudor: 30000 }),
        ]);
        render(<ReportarPagoTutor />);
        expect(await screen.findByText('Ana García')).toBeInTheDocument();
        expect(screen.getByText('Luis Pérez')).toBeInTheDocument();
        expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    });

    it('elegir un estudiante de la lista lo selecciona, pre-llena su saldo y habilita "Cambiar"', async () => {
        obtenerEstudiantesDelTutorMock.mockResolvedValue([
            crearEstudiante({ id: 'est-1', nombres: 'Ana', apellidos: 'García', saldoDeudor: 50000 }),
            crearEstudiante({ id: 'est-2', nombres: 'Luis', apellidos: 'Pérez', saldoDeudor: 30000 }),
        ]);
        const user = userEvent.setup();
        render(<ReportarPagoTutor />);
        await user.click(await screen.findByText('Luis Pérez'));

        expect(screen.getByRole('spinbutton')).toHaveValue(30000);
        expect(screen.getByText('Cambiar')).toBeInTheDocument();

        await user.click(screen.getByText('Cambiar'));
        expect(await screen.findByText('Ana García')).toBeInTheDocument();
        expect(screen.getByText('Luis Pérez')).toBeInTheDocument();
    });

    it('el botón de envío está deshabilitado sin comprobante adjunto, incluso con monto', async () => {
        obtenerEstudiantesDelTutorMock.mockResolvedValue([crearEstudiante()]);
        render(<ReportarPagoTutor />);
        await screen.findByText('Ana García');
        expect(screen.getByRole('button', { name: /REPORTAR PAGO AHORA/i })).toBeDisabled();
    });

    it('adjuntar un comprobante habilita el envío, y al enviar llama a reportarPagoEstudiante con tutorUsuarioId', async () => {
        obtenerEstudiantesDelTutorMock.mockResolvedValue([crearEstudiante({ saldoDeudor: 60000 })]);
        reportarPagoEstudianteMock.mockResolvedValue('reporte-nuevo-1');
        const user = userEvent.setup();
        render(<ReportarPagoTutor />);
        await screen.findByText('Ana García');

        await adjuntarComprobante(user);
        await waitFor(() => expect(screen.getByRole('button', { name: /REPORTAR PAGO AHORA/i })).toBeEnabled());

        await user.click(screen.getByRole('button', { name: /REPORTAR PAGO AHORA/i }));

        await waitFor(() => expect(reportarPagoEstudianteMock).toHaveBeenCalled());
        const args = reportarPagoEstudianteMock.mock.calls[0];
        expect(args[0]).toBe('tenant-1');
        expect(args[1]).toBe('est-1');
        expect(args[2]).toBe('Ana García');
        expect(args[3]).toBe(60000);
        expect(typeof args[4]).toBe('string');
        expect(args[5]).toBe('tutor-1');

        expect(await screen.findByText('¡Reporte Enviado!')).toBeInTheDocument();
    });

    // SDD notificaciones-pagos (Requirement "Honest Success Copy in ReportarPagoTutor", spec.md):
    // la pantalla de éxito ya NO puede prometer un WhatsApp automático que el sistema nunca
    // envía (Fase A es únicamente in-app) -- debe dirigir al tutor a su buzón en la app.
    it('tras reportar el pago, la pantalla de éxito NO promete WhatsApp y dirige al buzón de la app', async () => {
        obtenerEstudiantesDelTutorMock.mockResolvedValue([crearEstudiante({ saldoDeudor: 60000 })]);
        reportarPagoEstudianteMock.mockResolvedValue('reporte-nuevo-1');
        const user = userEvent.setup();
        render(<ReportarPagoTutor />);
        await screen.findByText('Ana García');

        await adjuntarComprobante(user);
        await waitFor(() => expect(screen.getByRole('button', { name: /REPORTAR PAGO AHORA/i })).toBeEnabled());
        await user.click(screen.getByRole('button', { name: /REPORTAR PAGO AHORA/i }));

        expect(await screen.findByText('¡Reporte Enviado!')).toBeInTheDocument();
        expect(screen.queryByText(/WhatsApp/i)).not.toBeInTheDocument();
        expect(screen.getByText(/buz[oó]n/i)).toBeInTheDocument();
    });

    it('si el envío falla, notifica el error y NO pasa al estado de éxito', async () => {
        obtenerEstudiantesDelTutorMock.mockResolvedValue([crearEstudiante()]);
        reportarPagoEstudianteMock.mockRejectedValue(new Error('network error'));
        const user = userEvent.setup();
        render(<ReportarPagoTutor />);
        await screen.findByText('Ana García');
        await adjuntarComprobante(user);
        await waitFor(() => expect(screen.getByRole('button', { name: /REPORTAR PAGO AHORA/i })).toBeEnabled());

        await user.click(screen.getByRole('button', { name: /REPORTAR PAGO AHORA/i }));

        await waitFor(() => expect(mostrarNotificacion).toHaveBeenCalledWith('No se pudo enviar el reporte. Intenta de nuevo.', 'error'));
        expect(screen.queryByText('¡Reporte Enviado!')).not.toBeInTheDocument();
    });

    it('sin ningún medio de pago configurado en el tenant, no muestra "Pagar en Línea" ni "Medios de Pago Directo"', async () => {
        useTenantMock.mockReturnValue({ tenant: {} });
        obtenerEstudiantesDelTutorMock.mockResolvedValue([crearEstudiante()]);
        render(<ReportarPagoTutor />);
        await screen.findByText('Ana García');
        expect(screen.queryByText('Pagar en Línea')).not.toBeInTheDocument();
        expect(screen.queryByText('Medios de Pago Directo')).not.toBeInTheDocument();
    });

    it('con linkPagoMensualidad configurado, muestra "Pagar en Línea" y lo abre en una pestaña nueva', async () => {
        const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
        useTenantMock.mockReturnValue({ tenant: { linkPagoMensualidad: 'https://pago.example.com/x' } });
        obtenerEstudiantesDelTutorMock.mockResolvedValue([crearEstudiante()]);
        const user = userEvent.setup();
        render(<ReportarPagoTutor />);
        await user.click(await screen.findByText('Pagar en Línea'));
        expect(openSpy).toHaveBeenCalledWith('https://pago.example.com/x', '_blank', 'noopener,noreferrer');
        openSpy.mockRestore();
    });
});
