import { act, renderHook } from '@testing-library/react';
import { useGestionEstudiantes } from './useGestionEstudiantes';
import { EstadoPago, GradoTKD, GrupoEdad, type Estudiante } from '../tipos';
import { FILTRO_SIN_GRUPO_ENTRENAMIENTO } from '../utils/gruposEntrenamiento';

const mockActualizarEstudiante = jest.fn();
const mockAgregarEstudiante = jest.fn();
let mockEstudiantes: Estudiante[] = [];

jest.mock('react-router-dom', () => ({ useLocation: () => ({ search: '' }) }));
jest.mock('../servicios/api', () => ({ enviarNotificacion: jest.fn() }));
jest.mock('../servicios/geminiService', () => ({ generarMensajePersonalizado: jest.fn() }));
jest.mock('../servicios/academico/invitacionService', () => ({ createInvitation: jest.fn() }));
jest.mock('../context/NotificacionContext', () => ({ useNotificacion: () => ({ mostrarNotificacion: jest.fn() }) }));
jest.mock('../context/DataContext', () => ({
    useEstudiantes: () => ({
        estudiantes: mockEstudiantes, cargando: false, error: null,
        agregarEstudiante: mockAgregarEstudiante, actualizarEstudiante: mockActualizarEstudiante,
        eliminarEstudiante: jest.fn(), retirarEstudiante: jest.fn(), reactivarEstudiante: jest.fn(),
        cargarEstudiantes: jest.fn(), aplicarCambioMasivoEstudiantes: jest.fn(),
    }),
    useConfiguracion: () => ({
        configClub: { tenantId: 't-1', nombreClub: 'Club', gruposEntrenamiento: [{ id: 'grp-a', nombre: 'Avanzados' }, { id: 'grp-b', nombre: 'Infantil' }] },
    }),
    useSedes: () => ({ sedesVisibles: [] }),
}));

const crear = (id: string, grupoEntrenamientoId?: string): Estudiante => ({
    id, tenantId: 't-1', nombres: `N${id}`, apellidos: 'A', numeroIdentificacion: id, telefono: '', correo: '',
    fechaNacimiento: '2010-01-01', grado: GradoTKD.Blanco, grupo: GrupoEdad.Cadetes, horasAcumuladasGrado: 0,
    sedeId: 's', fechaIngreso: '2024-01-01', estadoPago: EstadoPago.AlDia, saldoDeudor: 0, historialPagos: [],
    consentimientoInformado: false, contratoServiciosFirmado: false, consentimientoImagenFirmado: false,
    consentimientoFotosVideos: false, carnetGenerado: false, estadoMatricula: 'activo',
    ...(grupoEntrenamientoId !== undefined ? { grupoEntrenamientoId } : {}),
});

describe('useGestionEstudiantes — grupo de entrenamiento', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockEstudiantes = [crear('1', 'grp-a'), crear('2', 'grp-b'), crear('3'), crear('4', 'grp-eliminado'), crear('5', 'grp-a')];
    });

    it('expone el catálogo del club y filtra por grupo / "sin grupo"; limpiar filtros lo resetea', () => {
        const { result } = renderHook(() => useGestionEstudiantes());
        expect(result.current.gruposEntrenamiento.map(g => g.id)).toEqual(['grp-a', 'grp-b']);
        expect(result.current.estudiantesFiltrados).toHaveLength(5);

        act(() => result.current.setFiltroGrupoEntrenamiento('grp-a'));
        expect(result.current.estudiantesFiltrados.map(e => e.id)).toEqual(['1', '5']);
        expect(result.current.filtrosActivos).toBe(true);

        act(() => result.current.setFiltroGrupoEntrenamiento(FILTRO_SIN_GRUPO_ENTRENAMIENTO));
        expect(result.current.estudiantesFiltrados.map(e => e.id)).toEqual(['3', '4']);

        act(() => result.current.limpiarFiltros());
        expect(result.current.filtroGrupoEntrenamiento).toBe('todos');
        expect(result.current.estudiantesFiltrados).toHaveLength(5);
        expect(result.current.filtrosActivos).toBe(false);
    });

    it('edición con "Sin grupo" conserva grupoEntrenamientoId: \'\' para limpiar el campo en Firestore', async () => {
        mockActualizarEstudiante.mockResolvedValue(undefined);
        const { result } = renderHook(() => useGestionEstudiantes());

        await act(async () => { await result.current.guardarEstudiante({ ...crear('1', 'grp-a'), grupoEntrenamientoId: '' }); });

        expect(mockActualizarEstudiante).toHaveBeenCalledWith(expect.objectContaining({ id: '1', grupoEntrenamientoId: '' }));
    });

    it('alta sin grupo no envía la clave vacía; alta con grupo sí la envía', async () => {
        mockAgregarEstudiante.mockImplementation(async (d: any) => ({ ...d, id: 'nuevo' }));
        const { result } = renderHook(() => useGestionEstudiantes());
        const { id: _sinId, ...base } = crear('x');

        await act(async () => { await result.current.guardarEstudiante({ ...base, grupoEntrenamientoId: '' } as any); });
        expect(mockAgregarEstudiante.mock.calls[0][0]).not.toHaveProperty('grupoEntrenamientoId');

        await act(async () => { await result.current.guardarEstudiante({ ...base, grupoEntrenamientoId: 'grp-b' } as any); });
        expect(mockAgregarEstudiante.mock.calls[1][0]).toHaveProperty('grupoEntrenamientoId', 'grp-b');
    });
});
