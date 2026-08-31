import { renderHook, waitFor } from '@testing-library/react';
import type { ConfiguracionClub, Estudiante, Sede } from '../tipos';
import * as api from '../servicios/api';
import { useNotificacion } from '../context/NotificacionContext';
import {
    generarTextoDocumentoFirma,
    guardarFirmaDocumento,
    usePaginaFirma,
} from './usePaginaFirma';

jest.mock('../servicios/api', () => ({
    guardarFirmaConsentimiento: jest.fn(),
    guardarFirmaContrato: jest.fn(),
    guardarFirmaImagen: jest.fn(),
    obtenerEstudiantePorId: jest.fn(),
    obtenerConfiguracionClub: jest.fn(),
    obtenerSedes: jest.fn(),
}));
jest.mock('../context/NotificacionContext', () => ({ useNotificacion: jest.fn() }));

const estudiante = {
    id: 'est-1',
    tenantId: 'tenant-1',
    nombres: 'Ana',
    apellidos: 'Pérez',
    tutor: {
        nombres: 'Laura',
        apellidos: 'Pérez',
        numeroIdentificacion: '123',
        telefono: '3001234567',
        correo: 'laura@example.com',
    },
} as Estudiante;

const configClub = {
    nombreClub: 'Dojang Central',
    nit: '900123',
    representanteLegal: 'Representante',
    ccRepresentante: '456',
    valorMensualidad: 100000,
    diasSuspension: 30,
    duracionContratoMeses: 12,
    lugarFirma: 'Bogotá',
} as ConfiguracionClub;

const sede = {
    id: 'sede-1',
    nombre: 'Norte',
    valorMensualidad: 120000,
} as Sede;

describe('documentos legales de firma pública', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('selecciona una plantilla de riesgos distinta de la autorización de imagen', () => {
        const riesgos = generarTextoDocumentoFirma('consentimiento', estudiante, configClub, sede);
        const imagen = generarTextoDocumentoFirma('imagen', estudiante, configClub, sede);

        expect(riesgos).toContain('CONSENTIMIENTO INFORMADO DE RIESGOS');
        expect(riesgos).toContain('actividad deportiva');
        expect(riesgos).not.toContain('AUTORIZACIÓN DE USO DE IMAGEN');
        expect(imagen).toContain('AUTORIZACIÓN DE USO DE IMAGEN');
        expect(imagen).not.toContain('CONSENTIMIENTO INFORMADO DE RIESGOS');
    });

    it('guarda el consentimiento de riesgos mediante su operación legal específica', async () => {
        await guardarFirmaDocumento('consentimiento', estudiante, 'firma-riesgos');

        expect(api.guardarFirmaConsentimiento).toHaveBeenCalledWith(
            'est-1',
            'tenant-1',
            'firma-riesgos',
        );
        expect(api.guardarFirmaImagen).not.toHaveBeenCalled();
    });

    it.each([true, false])(
        'guarda la autorización de imagen y su decisión explícita (%s)',
        async autorizacionFotos => {
            await guardarFirmaDocumento('imagen', estudiante, 'firma-imagen', autorizacionFotos);

            expect(api.guardarFirmaImagen).toHaveBeenCalledWith(
                'est-1',
                'tenant-1',
                'firma-imagen',
                autorizacionFotos,
            );
            expect(api.guardarFirmaConsentimiento).not.toHaveBeenCalled();
        },
    );

    it('rechaza guardar imagen sin una decisión explícita', async () => {
        await expect(
            guardarFirmaDocumento('imagen', estudiante, 'firma-imagen'),
        ).rejects.toThrow('Se requiere una elección de autorización.');
    });
});

// Bug real (reporte del tenant, contrato mostraba "ADMINISTRADOR DE PLATAFORMA" / C.C.
// 00.000.000 / mensualidad $0): obtenerConfiguracionClub()/obtenerSedes() se llamaban sin
// tenantId dentro de cargarDatos -- quedaban a merced de resolver el tenant por el subdominio
// de la URL, y si eso fallaba (link fuera de {slug}.tudojang.com) caían en silencio al objeto
// de configuración por defecto. El fix pasa el tenantId real del estudiante ya resuelto.
describe('usePaginaFirma — carga de datos scoped por tenant (bug real)', () => {
    const useNotificacionMock = useNotificacion as jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        useNotificacionMock.mockReturnValue({ mostrarNotificacion: jest.fn() });
        (api.obtenerEstudiantePorId as jest.Mock).mockResolvedValue(estudiante);
        (api.obtenerConfiguracionClub as jest.Mock).mockResolvedValue(configClub);
        (api.obtenerSedes as jest.Mock).mockResolvedValue([sede]);
    });

    it('pide la configuración del club y las sedes con el tenantId del estudiante ya resuelto, no sin argumentos', async () => {
        const { result } = renderHook(() => usePaginaFirma({ idEstudiante: 'est-1', tipo: 'contrato' }));
        await waitFor(() => expect(result.current.cargando).toBe(false));

        expect(api.obtenerConfiguracionClub).toHaveBeenCalledWith('tenant-1');
        expect(api.obtenerSedes).toHaveBeenCalledWith('tenant-1');
    });

    it('el texto del contrato refleja los datos reales del club, no queda en blanco/undefined', async () => {
        const { result } = renderHook(() => usePaginaFirma({ idEstudiante: 'est-1', tipo: 'contrato' }));
        await waitFor(() => expect(result.current.cargando).toBe(false));

        expect(result.current.textoDocumento).toContain('DOJANG CENTRAL');
        expect(result.current.textoDocumento).toContain(configClub.nit);
        expect(result.current.textoDocumento).toContain(configClub.ccRepresentante);
    });
});
