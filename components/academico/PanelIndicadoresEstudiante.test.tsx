// components/academico/PanelIndicadoresEstudiante.test.tsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, jest, beforeEach, expect } from '@jest/globals';
import PanelIndicadoresEstudiante from './PanelIndicadoresEstudiante';
import { useAuth } from '../../context/AuthContext';
import { useNotificacion } from '../../context/NotificacionContext';
import { useEstudiantes } from '../../context/DataContext';
import { obtenerIndicadoresPendientes, resolverHallazgo } from '../../servicios/academico/indicadoresEstudianteApi';
import type { IndicadorEstudiante } from '../../tipos';

jest.mock('../../context/AuthContext', () => ({
    useAuth: jest.fn(),
}));
jest.mock('../../context/NotificacionContext', () => ({
    useNotificacion: jest.fn(),
}));
jest.mock('../../context/DataContext', () => ({
    useEstudiantes: jest.fn(),
}));
jest.mock('../../servicios/academico/indicadoresEstudianteApi', () => ({
    obtenerIndicadoresPendientes: jest.fn(),
    resolverHallazgo: jest.fn(),
}));

const useAuthMock = useAuth as jest.Mock;
const useNotificacionMock = useNotificacion as jest.Mock;
const useEstudiantesMock = useEstudiantes as jest.Mock;
const obtenerIndicadoresPendientesMock = obtenerIndicadoresPendientes as jest.Mock<() => Promise<IndicadorEstudiante[]>>;
const resolverHallazgoMock = resolverHallazgo as jest.Mock<(...args: unknown[]) => Promise<void>>;

const usuarioMock = { id: 'admin-1', tenantId: 'tenant-1', rol: 'Admin' };
const estudianteMock = { id: 'est-1', nombres: 'Ana', apellidos: 'García' };

const crearIndicador = (overrides: Partial<IndicadorEstudiante> = {}): IndicadorEstudiante => ({
    estudianteId: 'est-1',
    tenantId: 'tenant-1',
    ultimaEvaluacion: '2026-09-08T06:00:00.000Z',
    hallazgos: [{
        id: 'riesgo_desercion-2026-08-20',
        tipo: 'riesgo_desercion',
        severidad: 'media',
        fechaDeteccion: '2026-08-20T06:00:00.000Z',
        fechaActualizacion: '2026-09-08T06:00:00.000Z',
        metricas: { porcentajeAsistencia4Semanas: 0.4, clasesEsperadas4Semanas: 10, tardanzas2Semanas: 0 },
        resuelto: false,
    }],
    ...overrides,
});

describe('PanelIndicadoresEstudiante', () => {
    let mostrarNotificacion: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        useAuthMock.mockReturnValue({ usuario: usuarioMock });
        mostrarNotificacion = jest.fn();
        useNotificacionMock.mockReturnValue({ mostrarNotificacion });
        useEstudiantesMock.mockReturnValue({ estudiantes: [estudianteMock], actualizarEstudiante: jest.fn() });
    });

    it('muestra el estado de carga mientras resuelve la consulta', () => {
        obtenerIndicadoresPendientesMock.mockReturnValue(new Promise(() => { }));
        render(<PanelIndicadoresEstudiante />);
        expect(screen.getByText(/Analizando Indicadores/i)).toBeInTheDocument();
    });

    it('muestra el estado vacío cuando no hay hallazgos pendientes', async () => {
        obtenerIndicadoresPendientesMock.mockResolvedValue([]);
        render(<PanelIndicadoresEstudiante />);
        expect(await screen.findByText('Sin Hallazgos Pendientes')).toBeInTheDocument();
    });

    it('si la consulta falla, notifica el error y no crashea (queda en estado vacío)', async () => {
        obtenerIndicadoresPendientesMock.mockRejectedValue(new Error('Firestore caído'));
        render(<PanelIndicadoresEstudiante />);
        await waitFor(() => expect(mostrarNotificacion).toHaveBeenCalledWith('Error al cargar los indicadores de estudiantes.', 'error'));
        expect(screen.getByText('Sin Hallazgos Pendientes')).toBeInTheDocument();
    });

    it('renderiza el nombre del estudiante, el tipo, la severidad y las métricas del hallazgo', async () => {
        obtenerIndicadoresPendientesMock.mockResolvedValue([crearIndicador()]);
        render(<PanelIndicadoresEstudiante />);

        expect(await screen.findByText('Ana García')).toBeInTheDocument();
        expect(screen.getByText('Riesgo de Deserción')).toBeInTheDocument();
        expect(screen.getByText('media')).toBeInTheDocument();
        expect(screen.getByText('porcentajeAsistencia4Semanas')).toBeInTheDocument();
        expect(screen.getByText('0.4')).toBeInTheDocument();
    });

    it('agrupa riesgo_desercion antes que candidato_fidelizacion', async () => {
        const riesgo = crearIndicador({ estudianteId: 'est-1' });
        const fidelizacion = crearIndicador({
            estudianteId: 'est-2',
            hallazgos: [{
                id: 'candidato_fidelizacion-2026-07-01',
                tipo: 'candidato_fidelizacion',
                severidad: 'media',
                fechaDeteccion: '2026-07-01T06:00:00.000Z',
                fechaActualizacion: '2026-09-08T06:00:00.000Z',
                metricas: { porcentajeAsistencia3Meses: 0.95, antiguedadDias: 200, tardanzasUltimoMes: 0 },
                resuelto: false,
            }],
        });
        useEstudiantesMock.mockReturnValue({
            estudiantes: [estudianteMock, { id: 'est-2', nombres: 'Luis', apellidos: 'Pérez' }],
            actualizarEstudiante: jest.fn(),
        });
        obtenerIndicadoresPendientesMock.mockResolvedValue([fidelizacion, riesgo]); // orden de llegada invertido a propósito

        render(<PanelIndicadoresEstudiante />);
        await screen.findByText('Ana García');

        const titulos = screen.getAllByText(/Riesgo de Deserción|Candidato a Fidelización/);
        expect(titulos[0]).toHaveTextContent('Riesgo de Deserción');
        expect(titulos[1]).toHaveTextContent('Candidato a Fidelización');
    });

    it('no incluye hallazgos ya resueltos del mismo indicador', async () => {
        const indicador = crearIndicador({
            hallazgos: [
                { ...crearIndicador().hallazgos[0], id: 'riesgo_desercion-2026-01-01', resuelto: true, resueltoEn: 'x', resueltoPor: 'admin-0' },
            ],
        });
        obtenerIndicadoresPendientesMock.mockResolvedValue([indicador]);
        render(<PanelIndicadoresEstudiante />);
        expect(await screen.findByText('Sin Hallazgos Pendientes')).toBeInTheDocument();
    });

    it('Marcar como resuelto llama a resolverHallazgo con la nota escrita y quita el hallazgo de la lista', async () => {
        obtenerIndicadoresPendientesMock.mockResolvedValue([crearIndicador()]);
        resolverHallazgoMock.mockResolvedValue(undefined);
        const user = userEvent.setup();
        render(<PanelIndicadoresEstudiante />);

        await screen.findByText('Ana García');
        await user.type(screen.getByPlaceholderText(/Nota opcional/i), 'Hablé con la mamá');
        await user.click(screen.getByRole('button', { name: /Marcar como resuelto/i }));

        await waitFor(() => expect(resolverHallazgoMock).toHaveBeenCalledWith(
            'tenant-1', 'est-1', 'riesgo_desercion-2026-08-20', 'Hablé con la mamá'
        ));
        expect(mostrarNotificacion).toHaveBeenCalledWith('Hallazgo marcado como resuelto.', 'success');
        await waitFor(() => expect(screen.queryByText('Ana García')).not.toBeInTheDocument());
    });

    it('si resolverHallazgo falla, notifica error y el hallazgo NO se quita de la lista', async () => {
        obtenerIndicadoresPendientesMock.mockResolvedValue([crearIndicador()]);
        resolverHallazgoMock.mockRejectedValue(new Error('permission-denied'));
        const user = userEvent.setup();
        render(<PanelIndicadoresEstudiante />);

        await user.click(await screen.findByRole('button', { name: /Marcar como resuelto/i }));

        await waitFor(() => expect(mostrarNotificacion).toHaveBeenCalledWith('Error al resolver el hallazgo.', 'error'));
        expect(screen.getByText('Ana García')).toBeInTheDocument();
    });

    // Bug real (review-readability, 2026-09-08): hallazgo.id (tipo-fecha) es único SOLO dentro
    // del documento de un estudiante -- si dos estudiantes distintos disparan el MISMO patrón
    // el MISMO día (caso normal del cron, no un borde raro), ambos terminan con el mismo id en
    // esta lista aplanada. Resolver el de uno filtraba también el del otro de la vista, y
    // ambos compartían la misma nota en el textarea.
    it('dos estudiantes distintos con el mismo hallazgo.id (mismo tipo y fecha) se resuelven de forma independiente', async () => {
        const idCompartido = 'riesgo_desercion-2026-08-20';
        const indicadorAna = crearIndicador({ estudianteId: 'est-1', hallazgos: [{ ...crearIndicador().hallazgos[0], id: idCompartido }] });
        const indicadorLuis = crearIndicador({ estudianteId: 'est-2', hallazgos: [{ ...crearIndicador().hallazgos[0], id: idCompartido }] });
        useEstudiantesMock.mockReturnValue({
            estudiantes: [estudianteMock, { id: 'est-2', nombres: 'Luis', apellidos: 'Pérez' }],
            actualizarEstudiante: jest.fn(),
        });
        obtenerIndicadoresPendientesMock.mockResolvedValue([indicadorAna, indicadorLuis]);
        resolverHallazgoMock.mockResolvedValue(undefined);
        const user = userEvent.setup();
        render(<PanelIndicadoresEstudiante />);

        await screen.findByText('Ana García');
        const notas = screen.getAllByPlaceholderText(/Nota opcional/i);
        await user.type(notas[0], 'Nota solo de Ana');

        const botones = screen.getAllByRole('button', { name: /Marcar como resuelto/i });
        await user.click(botones[0]);

        await waitFor(() => expect(resolverHallazgoMock).toHaveBeenCalledWith('tenant-1', 'est-1', idCompartido, 'Nota solo de Ana'));
        // El hallazgo de Ana desaparece, pero el de Luis (mismo id, otro estudiante) sigue.
        await waitFor(() => expect(screen.queryByText('Ana García')).not.toBeInTheDocument());
        expect(screen.getByText('Luis Pérez')).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/Nota opcional/i)).toHaveValue('');
    });

    it('muestra "Estudiante" cuando no encuentra el nombre en el contexto (dato inconsistente)', async () => {
        useEstudiantesMock.mockReturnValue({ estudiantes: [], actualizarEstudiante: jest.fn() });
        obtenerIndicadoresPendientesMock.mockResolvedValue([crearIndicador()]);
        render(<PanelIndicadoresEstudiante />);
        expect(await screen.findByText('Estudiante')).toBeInTheDocument();
    });
});
