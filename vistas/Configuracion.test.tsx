// vistas/Configuracion.test.tsx
import React from 'react';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, jest, beforeEach, expect } from '@jest/globals';
import VistaConfiguracion from './Configuracion';
import { useConfiguracion, useProgramas, useEstudiantes, useSedes } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useNotificacion } from '../context/NotificacionContext';
import type { ConfiguracionClub } from '../tipos';

// Este test se limita a los 4 campos nuevos de medios de pago (pagoNequi/pagoDaviplata/
// pagoBreB/pagoBanco) dentro de la pestaña "branding" (tab por defecto de la vista, ver
// vistas/Configuracion.tsx líneas 632-737). No se ejercitan otras pestañas ni el flujo de
// guardado/persistencia -- eso ya está cubierto por hooks/useGestionConfiguracion.ts
// (fuera de alcance de este cambio, confirmado funcionando por spread+setDoc incondicional).
//
// Se mockean los hooks de contexto de los que depende useGestionConfiguracion (DataContext,
// AuthContext, NotificacionContext) en vez de mockear useGestionConfiguracion directamente,
// para que el estado controlado real de los inputs (setLocalConfigClub) siga funcionando y
// el test de "escribir y ver el valor actualizado" sea representativo.
jest.mock('../context/DataContext', () => ({
    useConfiguracion: jest.fn(),
    useProgramas: jest.fn(),
    useEstudiantes: jest.fn(),
    useSedes: jest.fn(),
}));

jest.mock('../context/AuthContext', () => ({
    useAuth: jest.fn(),
}));

jest.mock('../context/NotificacionContext', () => ({
    useNotificacion: jest.fn(),
}));

const useConfiguracionMock = useConfiguracion as jest.Mock;
const useProgramasMock = useProgramas as jest.Mock;
const useEstudiantesMock = useEstudiantes as jest.Mock;
const useSedesMock = useSedes as jest.Mock;
const useAuthMock = useAuth as jest.Mock;
const useNotificacionMock = useNotificacion as jest.Mock;

const configClubBase: ConfiguracionClub = {
    tenantId: 'test-tenant',
    slug: 'test-club',
    nombreClub: 'Test Club',
    nit: '900123456-1',
    representanteLegal: 'Carlos Pardo',
    ccRepresentante: '123456789',
    lugarFirma: 'Bogotá',
    duracionContratoMeses: 12,
    valorMensualidad: 50000,
    valorInscripcion: 20000,
    moraPorcentaje: 5,
    valorMatricula: 10000,
    activarMatriculaAnual: false,
    metodoPago: 'manual',
    pagoNequi: '',
    pagoDaviplata: '',
    pagoBreB: '',
    pagoBanco: '',
    diasSuspension: 30,
    direccionClub: 'Calle 123',
    colorPrimario: '#111111',
    colorSecundario: '#0047A0',
    colorAcento: '#CD2E3A',
    estadoSuscripcion: 'activo',
    fechaVencimiento: '2027-01-01',
    plan: 'starter',
    limiteEstudiantes: 100,
    limiteUsuarios: 5,
    limiteSedes: 1,
    onboardingStep: 5,
    activarFormularioInscripcion: true,
};

describe('Configuracion - medios de pago (pagoNequi/pagoDaviplata/pagoBreB/pagoBanco)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        useConfiguracionMock.mockReturnValue({
            usuarios: [],
            configNotificaciones: {},
            configClub: configClubBase,
            cargando: false,
            error: null,
            guardarConfiguraciones: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
            agregarUsuario: jest.fn(),
            actualizarUsuario: jest.fn(),
            eliminarUsuario: jest.fn(),
            cargarConfiguracion: jest.fn(),
        });
        useProgramasMock.mockReturnValue({
            programas: [],
            eliminarPrograma: jest.fn(),
            agregarPrograma: jest.fn(),
            actualizarPrograma: jest.fn(),
        });
        useEstudiantesMock.mockReturnValue({ estudiantes: [] });
        useSedesMock.mockReturnValue({
            sedes: [],
            sedesVisibles: [],
            totalSedesActivas: 1,
            eliminarSede: jest.fn(),
            agregarSede: jest.fn(),
            actualizarSede: jest.fn(),
        });
        useAuthMock.mockReturnValue({
            usuario: { id: 'admin-1', tenantId: 'test-tenant', rol: 'Admin', email: 'admin@test.com' },
        });
        useNotificacionMock.mockReturnValue({
            toasts: [],
            mostrarNotificacion: jest.fn(),
            ocultarNotificacion: jest.fn(),
        });
    });

    it('renderiza los 4 inputs de medios de pago vacíos y refleja lo escrito en pagoNequi (comportamiento de input controlado)', async () => {
        const user = userEvent.setup();
        const { container } = render(<VistaConfiguracion />);

        // Los labels de estos 4 campos (vistas/Configuracion.tsx líneas 685-708) son <label>
        // sin `htmlFor`, hermanos del <input> dentro del mismo <div> -- sin asociación
        // programática, por lo que getByLabelText no los encuentra. Se consulta por el
        // atributo `name`, tal como lo pide la tarea explícitamente.
        const inputNequi = container.querySelector('input[name="pagoNequi"]') as HTMLInputElement;
        const inputDaviplata = container.querySelector('input[name="pagoDaviplata"]') as HTMLInputElement;
        const inputBreB = container.querySelector('input[name="pagoBreB"]') as HTMLInputElement;
        const inputBanco = container.querySelector('input[name="pagoBanco"]') as HTMLInputElement;

        expect(inputNequi).toBeInTheDocument();
        expect(inputDaviplata).toBeInTheDocument();
        expect(inputBreB).toBeInTheDocument();
        expect(inputBanco).toBeInTheDocument();

        expect(inputNequi).toHaveValue('');
        expect(inputDaviplata).toHaveValue('');
        expect(inputBreB).toHaveValue('');
        expect(inputBanco).toHaveValue('');

        await user.type(inputNequi, '300 111 2222');

        expect(inputNequi).toHaveValue('300 111 2222');
    });
});
