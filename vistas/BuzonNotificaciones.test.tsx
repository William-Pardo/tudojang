// vistas/BuzonNotificaciones.test.tsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, jest, beforeEach, expect } from '@jest/globals';
import VistaBuzonNotificaciones from './BuzonNotificaciones';
import { useAuth } from '../context/AuthContext';
import { useConfiguracion } from '../context/DataContext';
import { resolveStudentsForConsultor } from '../servicios/academico/tutorStudentResolver';
import {
    obtenerNotificacionesPorEstudiantes,
    marcarNotificacionComoLeida,
} from '../servicios/notificacionesApi';
import { RolUsuario, TipoNotificacion, type Estudiante, type NotificacionHistorial } from '../tipos';

jest.mock('../context/AuthContext', () => ({
    useAuth: jest.fn(),
}));

jest.mock('../context/DataContext', () => ({
    useConfiguracion: jest.fn(),
}));

jest.mock('../servicios/academico/tutorStudentResolver', () => ({
    resolveStudentsForConsultor: jest.fn(),
}));

jest.mock('../servicios/notificacionesApi', () => ({
    obtenerNotificacionesPorEstudiantes: jest.fn(),
    marcarNotificacionComoLeida: jest.fn(),
}));

const navigateMock = jest.fn();
jest.mock('react-router-dom', () => ({
    useNavigate: () => navigateMock,
}));

const useAuthMock = useAuth as jest.Mock;
const useConfiguracionMock = useConfiguracion as jest.Mock;
const resolveStudentsForConsultorMock = resolveStudentsForConsultor as jest.Mock<() => Promise<Estudiante[]>>;
const obtenerNotificacionesPorEstudiantesMock = obtenerNotificacionesPorEstudiantes as jest.Mock<() => Promise<NotificacionHistorial[]>>;
const marcarNotificacionComoLeidaMock = marcarNotificacionComoLeida as jest.Mock<() => Promise<void>>;

const usuarioTutorMock = {
    id: 'tutor-1',
    email: 'tutor@test.com',
    nombreUsuario: 'Tutor Test',
    numeroIdentificacion: '999',
    whatsapp: '3000000000',
    rol: RolUsuario.Tutor,
    tenantId: 'test-tenant',
};

const estudianteMock: Partial<Estudiante> = { id: 'est-1', tenantId: 'test-tenant' };

const crearNotificacion = (overrides: Partial<NotificacionHistorial> = {}): NotificacionHistorial => ({
    id: 'n1',
    tenantId: 'test-tenant',
    fecha: new Date().toISOString(),
    estudianteId: 'est-1',
    estudianteNombre: 'Ana García',
    tutorNombre: 'Tutor Test',
    destinatario: 'tutor@test.com',
    canal: 'Email',
    tipo: TipoNotificacion.RecordatorioPago,
    mensaje: 'Mensaje de prueba',
    leida: false,
    ...overrides,
});

describe('VistaBuzonNotificaciones', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        useAuthMock.mockReturnValue({ usuario: usuarioTutorMock });
        resolveStudentsForConsultorMock.mockResolvedValue([estudianteMock as Estudiante]);
        marcarNotificacionComoLeidaMock.mockResolvedValue(undefined);
    });

    it('muestra el panel de Medios de Pago Disponibles cuando hay un recordatorio de pago y un medio de pago configurado', async () => {
        useConfiguracionMock.mockReturnValue({
            configClub: { pagoBanco: 'Bancolombia Ahorros #987-654321-01' },
        });
        obtenerNotificacionesPorEstudiantesMock.mockResolvedValue([
            crearNotificacion({ tipo: TipoNotificacion.RecordatorioPago }),
        ]);

        render(<VistaBuzonNotificaciones />);

        expect(await screen.findByText('Medios de Pago Disponibles')).toBeInTheDocument();
        expect(screen.getByText('Bancolombia Ahorros #987-654321-01')).toBeInTheDocument();
    });

    it('no muestra el panel cuando solo hay notificaciones no relacionadas con pagos', async () => {
        useConfiguracionMock.mockReturnValue({
            configClub: { pagoBanco: 'Bancolombia Ahorros #987-654321-01' },
        });
        obtenerNotificacionesPorEstudiantesMock.mockResolvedValue([
            crearNotificacion({ tipo: TipoNotificacion.AvanceAcademico, mensaje: 'Avance académico' }),
        ]);

        render(<VistaBuzonNotificaciones />);

        await waitFor(() => {
            expect(screen.getByText('Avance académico')).toBeInTheDocument();
        });
        expect(screen.queryByText('Medios de Pago Disponibles')).not.toBeInTheDocument();
    });

    it('no muestra el panel cuando hay aviso de vencimiento pero no hay medios de pago configurados', async () => {
        useConfiguracionMock.mockReturnValue({
            configClub: { pagoNequi: '', pagoDaviplata: '', pagoBreB: '', pagoBanco: '' },
        });
        obtenerNotificacionesPorEstudiantesMock.mockResolvedValue([
            crearNotificacion({ tipo: TipoNotificacion.AvisoVencimiento, mensaje: 'Tu pago está por vencer' }),
        ]);

        render(<VistaBuzonNotificaciones />);

        await waitFor(() => {
            expect(screen.getByText('Tu pago está por vencer')).toBeInTheDocument();
        });
        expect(screen.queryByText('Medios de Pago Disponibles')).not.toBeInTheDocument();
    });

    // El buzón ya detectaba el pago pendiente y mostraba CÓMO pagar, pero terminaba ahí: el
    // tutor no sabía DÓNDE reportar el comprobante después (el módulo vive en /mi-perfil) y
    // tenía que salir a buscarlo. Este CTA cierra el circuito avisar -> pagar -> reportar.
    describe('CTA de reporte de comprobante', () => {
        const textoCta = /Ya pagué: reportar comprobante/i;

        it('ofrece el CTA cuando hay un recordatorio de pago', async () => {
            useConfiguracionMock.mockReturnValue({ configClub: { pagoNequi: '300 111 2222' } });
            obtenerNotificacionesPorEstudiantesMock.mockResolvedValue([
                crearNotificacion({ tipo: TipoNotificacion.RecordatorioPago }),
            ]);

            render(<VistaBuzonNotificaciones />);

            expect(await screen.findByRole('button', { name: textoCta })).toBeInTheDocument();
        });

        // R2: la acción "ya pagué, quiero reportarlo" es válida sin importar CÓMO pagó
        // (efectivo, transferencia manual, link). Antes todo el panel se condicionaba a que
        // el tenant tuviera medios configurados, así que este tutor no veía absolutamente nada.
        it('ofrece el CTA aunque el tenant no tenga ningún medio de pago configurado', async () => {
            useConfiguracionMock.mockReturnValue({
                configClub: { pagoNequi: '', pagoDaviplata: '', pagoBreB: '', pagoBanco: '' },
            });
            obtenerNotificacionesPorEstudiantesMock.mockResolvedValue([
                crearNotificacion({ tipo: TipoNotificacion.AvisoVencimiento, mensaje: 'Tu pago está por vencer' }),
            ]);

            render(<VistaBuzonNotificaciones />);

            expect(await screen.findByRole('button', { name: textoCta })).toBeInTheDocument();
            expect(screen.queryByText('Medios de Pago Disponibles')).not.toBeInTheDocument();
        });

        it('no ofrece el CTA cuando ninguna notificación es de pago', async () => {
            useConfiguracionMock.mockReturnValue({ configClub: { pagoNequi: '300 111 2222' } });
            obtenerNotificacionesPorEstudiantesMock.mockResolvedValue([
                crearNotificacion({ tipo: TipoNotificacion.AvanceAcademico, mensaje: 'Avance académico' }),
            ]);

            render(<VistaBuzonNotificaciones />);

            await waitFor(() => expect(screen.getByText('Avance académico')).toBeInTheDocument());
            expect(screen.queryByRole('button', { name: textoCta })).not.toBeInTheDocument();
        });

        it('lleva a /mi-perfil, donde vive el módulo de reporte', async () => {
            useConfiguracionMock.mockReturnValue({ configClub: { pagoNequi: '300 111 2222' } });
            obtenerNotificacionesPorEstudiantesMock.mockResolvedValue([
                crearNotificacion({ tipo: TipoNotificacion.RecordatorioPago }),
            ]);
            const user = userEvent.setup();

            render(<VistaBuzonNotificaciones />);
            await user.click(await screen.findByRole('button', { name: textoCta }));

            expect(navigateMock).toHaveBeenCalledWith('/mi-perfil');
        });
    });
});
