// hooks/useGestionConfiguracion.test.ts
// SDD pricing-cupo-real (Bloque 4, tarea 4.10, D8 design.md): `limiteUsuariosPermitido`
// pasa de `obtenerLimiteEquipoTecnico` (utils/limitesSaas.ts, borrado en este bloque --
// hacía `limitePlan + 1 + cuposAdicionales`, el owner como "extra gratis" oculto) a
// `calcularCapacidad(configClub).equipoTecnico` (utils/facturacion.ts, Bloque 2 -- el owner
// ya cuenta DENTRO de los 3 incluidos, D8: "Proposal is explicit (owner counted inside the
// 3)"). Este test NO reabre calcularCapacidad -- solo confirma que el hook la consume.
import { renderHook } from '@testing-library/react';
import { useGestionConfiguracion } from './useGestionConfiguracion';
import { useConfiguracion } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useNotificacion } from '../context/NotificacionContext';
import type { ConfiguracionClub } from '../tipos';

jest.mock('../context/DataContext', () => ({ useConfiguracion: jest.fn() }));
jest.mock('../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../context/NotificacionContext', () => ({ useNotificacion: jest.fn() }));

const useConfiguracionMock = useConfiguracion as jest.Mock;
const useAuthMock = useAuth as jest.Mock;
const useNotificacionMock = useNotificacion as jest.Mock;

const configClubBase = {
    tenantId: 'tenant-1',
    equipoTecnicoExtraContratado: 2,
} as Partial<ConfiguracionClub> as ConfiguracionClub;

describe('useGestionConfiguracion — limiteUsuariosPermitido (D8)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        useConfiguracionMock.mockReturnValue({
            usuarios: [],
            configNotificaciones: {},
            configClub: configClubBase,
            cargando: false,
            error: null,
            guardarConfiguraciones: jest.fn(),
            agregarUsuario: jest.fn(),
            actualizarUsuario: jest.fn(),
            eliminarUsuario: jest.fn(),
            cargarConfiguracion: jest.fn(),
        });
        useAuthMock.mockReturnValue({ usuario: { tenantId: 'tenant-1' } });
        useNotificacionMock.mockReturnValue({ mostrarNotificacion: jest.fn() });
    });

    it('D8: el owner cuenta DENTRO de los 3 incluidos -- no hay +1 extra oculto (calcularCapacidad, no plan)', () => {
        // Sin `plan` en configClub: si el hook todavía leyera obtenerLimiteEquipoTecnico
        // (basado en PLANES_SAAS[configClub.plan]) daría 0 + 1 + 0 = 1. calcularCapacidad
        // ignora `plan` por completo: incluido.equipoTecnico(3) + equipoTecnicoExtraContratado(2) = 5.
        const { result } = renderHook(() => useGestionConfiguracion());
        expect(result.current.limiteUsuariosPermitido).toBe(5);
    });
});
