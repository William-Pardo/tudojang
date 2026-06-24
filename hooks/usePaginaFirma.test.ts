import type { ConfiguracionClub, Estudiante, Sede } from '../tipos';
import * as api from '../servicios/api';
import {
    generarTextoDocumentoFirma,
    guardarFirmaDocumento,
} from './usePaginaFirma';

jest.mock('../servicios/api', () => ({
    guardarFirmaConsentimiento: jest.fn(),
    guardarFirmaContrato: jest.fn(),
    guardarFirmaImagen: jest.fn(),
}));

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
