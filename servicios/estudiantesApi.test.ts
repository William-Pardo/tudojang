/**
 * estudiantesApi.test.ts
 *
 * Suite completa de pruebas para el módulo estudiantesApi.
 * Cubre: unitarios, integración, excepciones y triangulación de saldos/grupos.
 */

import {
    obtenerEstudiantes,
    obtenerEstudiantePorId,
    obtenerEstudiantePorNumIdentificacion,
    agregarEstudiante,
    actualizarEstudiante,
    eliminarEstudiante,
    marcarCarnetsComoGenerados,
    guardarFirmaConsentimiento,
    guardarFirmaContrato,
    guardarFirmaImagen,
} from './estudiantesApi';
import { db, isFirebaseConfigured } from '../firebase/config';
import {
    collection,
    getDocs,
    doc,
    getDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    writeBatch,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import { GrupoEdad, EstadoPago, GradoTKD, type Estudiante } from '../tipos';

// ─── Mocks de Firebase ──────────────────────────────────────────────────────

jest.mock('firebase/firestore', () => ({
    collection: jest.fn(),
    getDocs: jest.fn(),
    doc: jest.fn(),
    getDoc: jest.fn(),
    updateDoc: jest.fn(),
    deleteDoc: jest.fn(),
    query: jest.fn(),
    where: jest.fn(),
    writeBatch: jest.fn(),
}));

// agregarEstudiante ya NO escribe directo a Firestore (fix seguridad 2026-07-18, mismo
// patrón que sedesApi/agregarSede): pasa por la Cloud Function `crearEstudiante`, que
// revalida el límite del plan server-side. Mismo mock que servicios/sedesApi.test.ts.
const mockCallable = jest.fn();
jest.mock('firebase/functions', () => ({
    getFunctions: jest.fn(() => 'functions-mock'),
    httpsCallable: jest.fn(() => mockCallable),
}));

jest.mock('firebase/storage', () => ({
    getStorage: jest.fn(() => ({})),
    ref: jest.fn(),
    uploadString: jest.fn(),
    getDownloadURL: jest.fn(),
}));

jest.mock('../firebase/config', () => ({
    db: {},
    isFirebaseConfigured: true,
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const buildEstudiante = (overrides: Partial<Estudiante> = {}): Estudiante => ({
    id: 'est-1',
    tenantId: 't-1',
    nombres: 'Juan',
    apellidos: 'Pérez',
    numeroIdentificacion: '10101',
    fechaNacimiento: '2015-05-10',
    grado: GradoTKD.Blanco,
    grupo: GrupoEdad.Infantil,
    horasAcumuladasGrado: 0,
    sedeId: 'sede-1',
    telefono: '3001',
    correo: 'juan@test.com',
    fechaIngreso: '2024-01-10',
    estadoPago: EstadoPago.AlDia,
    historialPagos: [],
    saldoDeudor: 0,
    consentimientoInformado: false,
    contratoServiciosFirmado: false,
    consentimientoImagenFirmado: false,
    consentimientoFotosVideos: false,
    carnetGenerado: false,
    ...overrides,
});

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('estudiantesApi — Suite completa (unitarios + integración + excepción + triangulación)', () => {
    let mockBatch: { update: jest.Mock; commit: jest.Mock };

    beforeEach(() => {
        jest.clearAllMocks();

        mockBatch = {
            update: jest.fn(),
            commit: jest.fn().mockResolvedValue(undefined),
        };
        (writeBatch as jest.Mock).mockReturnValue(mockBatch);

        // Por defecto: Firebase configurado
        (require('../firebase/config') as any).isFirebaseConfigured = true;
    });

    // ════════════════════════════════════════════════════════════════════════
    // 1. obtenerEstudiantes
    // ════════════════════════════════════════════════════════════════════════
    describe('obtenerEstudiantes', () => {
        it('[Integración] retorna lista de estudiantes mapeada desde Firestore', async () => {
            const mockSnap = {
                docs: [
                    {
                        id: 'est-1',
                        data: () => ({ nombres: 'Ana', apellidos: 'García', tenantId: 't-1' }),
                    },
                    {
                        id: 'est-2',
                        data: () => ({ nombres: 'Luis', apellidos: 'Torres', tenantId: 't-1' }),
                    },
                ],
            };
            (getDocs as jest.Mock).mockResolvedValue(mockSnap);

            const resultado = await obtenerEstudiantes();

            expect(getDocs).toHaveBeenCalledTimes(1);
            expect(resultado).toHaveLength(2);
            expect(resultado[0]).toMatchObject({ id: 'est-1', nombres: 'Ana', carnetGenerado: false });
            expect(resultado[1]).toMatchObject({ id: 'est-2', nombres: 'Luis', carnetGenerado: false });
        });

        it('[Unitario — Modo simulado] retorna datos mock cuando Firebase no está configurado', async () => {
            (require('../firebase/config') as any).isFirebaseConfigured = false;
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

            const resultado = await obtenerEstudiantes();

            expect(getDocs).not.toHaveBeenCalled();
            expect(resultado).toHaveLength(2);
            expect(resultado[0].nombres).toBe('Juan');
            expect(resultado[1].nombres).toBe('Maria');
            consoleSpy.mockRestore();
        });

        it('[Excepción] propaga errores de Firestore', async () => {
            (getDocs as jest.Mock).mockRejectedValue(new Error('Red caída'));

            await expect(obtenerEstudiantes()).rejects.toThrow('Red caída');
        });
    });

    // ════════════════════════════════════════════════════════════════════════
    // 2. obtenerEstudiantePorId
    // ════════════════════════════════════════════════════════════════════════
    describe('obtenerEstudiantePorId', () => {
        it('[Integración] retorna el estudiante cuando existe', async () => {
            const mockRef = { id: 'est-1' };
            (doc as jest.Mock).mockReturnValue(mockRef);
            (getDoc as jest.Mock).mockResolvedValue({
                exists: () => true,
                id: 'est-1',
                data: () => ({ nombres: 'Ana', tenantId: 't-1' }),
            });

            const resultado = await obtenerEstudiantePorId('est-1');

            expect(doc).toHaveBeenCalledWith(db, 'estudiantes', 'est-1');
            expect(resultado).toMatchObject({ id: 'est-1', nombres: 'Ana' });
        });

        it('[Excepción] lanza error cuando el estudiante no existe en Firestore', async () => {
            const mockRef = { id: 'no-existe' };
            (doc as jest.Mock).mockReturnValue(mockRef);
            (getDoc as jest.Mock).mockResolvedValue({
                exists: () => false,
                id: 'no-existe',
                data: () => null,
            });

            await expect(obtenerEstudiantePorId('no-existe')).rejects.toThrow('Estudiante no encontrado.');
        });

        it('[Unitario — Modo simulado] busca en datos mock correctamente', async () => {
            (require('../firebase/config') as any).isFirebaseConfigured = false;
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
            // Mock getDocs para el modo simulado (llama a obtenerEstudiantes internamente)
            const mockSnap = {
                docs: [
                    {
                        id: '1',
                        data: () => ({ id: '1', nombres: 'Juan', numeroIdentificacion: '10101', tenantId: 't-1' }),
                    },
                ],
            };
            (getDocs as jest.Mock).mockResolvedValue(mockSnap);

            const resultado = await obtenerEstudiantePorId('1');
            expect(resultado.id).toBe('1');
            consoleSpy.mockRestore();
        });

        it('[Excepción — Modo simulado] lanza error si id no existe en mock', async () => {
            (require('../firebase/config') as any).isFirebaseConfigured = false;
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
            const mockSnap = { docs: [] };
            (getDocs as jest.Mock).mockResolvedValue(mockSnap);

            await expect(obtenerEstudiantePorId('inexistente')).rejects.toThrow('Estudiante no encontrado.');
            consoleSpy.mockRestore();
        });
    });

    // ════════════════════════════════════════════════════════════════════════
    // 3. obtenerEstudiantePorNumIdentificacion
    // ════════════════════════════════════════════════════════════════════════
    describe('obtenerEstudiantePorNumIdentificacion', () => {
        it('[Integración] retorna estudiante cuando la query tiene resultados', async () => {
            const mockRef = {};
            (query as jest.Mock).mockReturnValue(mockRef);
            (where as jest.Mock).mockReturnValue({});
            (getDocs as jest.Mock).mockResolvedValue({
                empty: false,
                docs: [
                    {
                        id: 'est-1',
                        data: () => ({ nombres: 'Carlos', numeroIdentificacion: '99999', tenantId: 't-1' }),
                    },
                ],
            });

            const resultado = await obtenerEstudiantePorNumIdentificacion('99999');
            expect(resultado).toMatchObject({ id: 'est-1', nombres: 'Carlos' });
        });

        it('[Excepción] lanza error cuando la query está vacía', async () => {
            (query as jest.Mock).mockReturnValue({});
            (where as jest.Mock).mockReturnValue({});
            (getDocs as jest.Mock).mockResolvedValue({ empty: true, docs: [] });

            await expect(obtenerEstudiantePorNumIdentificacion('X')).rejects.toThrow(
                'No se encontró un estudiante con ese número de identificación.'
            );
        });

        it('[Unitario — Modo simulado] busca por documento en datos mock', async () => {
            (require('../firebase/config') as any).isFirebaseConfigured = false;
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
            // la función llama a obtenerEstudiantes(), que en modo simulado devuelve datos locales
            // pero getDocs es mock, así que devolvemos vacío → irá al mock interno
            (getDocs as jest.Mock).mockResolvedValue({ docs: [] });

            // El mock interno de obtenerEstudiantes devuelve Juan con '10101'
            const resultado = await obtenerEstudiantePorNumIdentificacion('10101');
            expect(resultado.numeroIdentificacion).toBe('10101');
            consoleSpy.mockRestore();
        });

        it('[Excepción — Modo simulado] lanza error si documento no existe en mock', async () => {
            (require('../firebase/config') as any).isFirebaseConfigured = false;
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
            (getDocs as jest.Mock).mockResolvedValue({ docs: [] });

            await expect(obtenerEstudiantePorNumIdentificacion('NOPE')).rejects.toThrow(
                'No se encontró un estudiante con ese número de identificación.'
            );
            consoleSpy.mockRestore();
        });
    });

    // ════════════════════════════════════════════════════════════════════════
    // 4. agregarEstudiante — via Cloud Function crearEstudiante
    // ════════════════════════════════════════════════════════════════════════
    // Fix seguridad (2026-07-18, mismo patrón ya resuelto para sedes/agregarSede):
    // agregarEstudiante YA NO escribe directo a Firestore (`addDoc`) -- pasa por la Cloud
    // Function `crearEstudiante`, que revalida server-side el límite del plan
    // (`tenant.limiteEstudiantes`) antes de crear. Antes, ese límite SOLO se chequeaba en
    // el botón de la UI (hooks/useGestionEstudiantes.ts), bypaseable con un write directo
    // o vía la importación masiva (ModalImportacionMasiva.tsx), que llama a esta misma
    // función en loop.
    describe('agregarEstudiante (Triangulación grupos/estado, via Cloud Function)', () => {
        const baseEstudiante = buildEstudiante();
        const { id, historialPagos, ...sinId } = baseEstudiante;

        it('[Integración] invoca la Cloud Function crearEstudiante con el payload y retorna el estudiante creado', async () => {
            const estudianteCreado: Estudiante = { ...baseEstudiante, id: 'nuevo-id-123' };
            mockCallable.mockResolvedValue({ data: estudianteCreado });

            const resultado = await agregarEstudiante(sinId);

            expect(httpsCallable).toHaveBeenCalledWith('functions-mock', 'crearEstudiante');
            expect(mockCallable).toHaveBeenCalledWith(
                expect.objectContaining({ nombres: 'Juan' })
            );
            expect(resultado).toEqual(estudianteCreado);
        });

        it('[Triangulación — Caso 1] estudiante Infantil (< 9 años) se persiste con GrupoEdad.Infantil', async () => {
            const infantil = { ...sinId, grupo: GrupoEdad.Infantil, fechaNacimiento: '2018-01-01' };
            mockCallable.mockResolvedValue({ data: { ...infantil, id: 'tri-infantil', historialPagos: [] } });

            const resultado = await agregarEstudiante(infantil);

            expect(resultado.grupo).toBe(GrupoEdad.Infantil);
        });

        it('[Triangulación — Caso 2] estudiante Precadet (9-12 años) se persiste con GrupoEdad.Precadetes', async () => {
            const precadet = { ...sinId, grupo: GrupoEdad.Precadetes, fechaNacimiento: '2014-06-01' };
            mockCallable.mockResolvedValue({ data: { ...precadet, id: 'tri-precadet', historialPagos: [] } });

            const resultado = await agregarEstudiante(precadet);

            expect(resultado.grupo).toBe(GrupoEdad.Precadetes);
        });

        it('[Triangulación — Caso 3] estudiante Cadete (13-17 años) se persiste con GrupoEdad.Cadetes', async () => {
            const cadet = { ...sinId, grupo: GrupoEdad.Cadetes, fechaNacimiento: '2009-03-15' };
            mockCallable.mockResolvedValue({ data: { ...cadet, id: 'tri-cadet', historialPagos: [] } });

            const resultado = await agregarEstudiante(cadet);

            expect(resultado.grupo).toBe(GrupoEdad.Cadetes);
        });

        it('[Triangulación — Caso 4] estudiante Adulto (≥ 18 años) se persiste con GrupoEdad.Adultos', async () => {
            const adulto = { ...sinId, grupo: GrupoEdad.Adultos, fechaNacimiento: '1990-12-31' };
            mockCallable.mockResolvedValue({ data: { ...adulto, id: 'tri-adulto', historialPagos: [] } });

            const resultado = await agregarEstudiante(adulto);

            expect(resultado.grupo).toBe(GrupoEdad.Adultos);
        });

        it('[Unitario — Modo simulado] retorna estudiante con id generado localmente, sin invocar la Cloud Function', async () => {
            (require('../firebase/config') as any).isFirebaseConfigured = false;

            const resultado = await agregarEstudiante(sinId);

            expect(httpsCallable).not.toHaveBeenCalled();
            expect(mockCallable).not.toHaveBeenCalled();
            expect(resultado.id).toMatch(/^mock-/);
            expect(resultado.historialPagos).toEqual([]);
        });

        it('[Excepción] propaga el error si la Cloud Function rechaza (ej. límite del plan alcanzado)', async () => {
            mockCallable.mockRejectedValue(new Error('Límite del plan superado (50 alumnos)'));

            await expect(agregarEstudiante(sinId)).rejects.toThrow(/límite del plan/i);
        });
    });

    // ════════════════════════════════════════════════════════════════════════
    // 5. actualizarEstudiante
    // ════════════════════════════════════════════════════════════════════════
    describe('actualizarEstudiante', () => {
        it('[Integración] llama a updateDoc con los datos separando el id', async () => {
            const mockRef = { id: 'est-1' };
            (doc as jest.Mock).mockReturnValue(mockRef);
            (updateDoc as jest.Mock).mockResolvedValue(undefined);

            const estudiante = buildEstudiante({ nombres: 'Ana Actualizada' });
            const resultado = await actualizarEstudiante(estudiante);

            expect(doc).toHaveBeenCalledWith(db, 'estudiantes', 'est-1');
            expect(updateDoc).toHaveBeenCalledWith(
                mockRef,
                expect.not.objectContaining({ id: expect.anything() })
            );
            expect(resultado.nombres).toBe('Ana Actualizada');
        });

        it('[Unitario — Modo simulado] retorna el mismo objeto sin llamar Firestore', async () => {
            (require('../firebase/config') as any).isFirebaseConfigured = false;

            const estudiante = buildEstudiante();
            const resultado = await actualizarEstudiante(estudiante);

            expect(updateDoc).not.toHaveBeenCalled();
            expect(resultado).toBe(estudiante);
        });

        it('[Excepción] propaga error de Firestore al actualizar', async () => {
            const mockRef = { id: 'est-1' };
            (doc as jest.Mock).mockReturnValue(mockRef);
            (updateDoc as jest.Mock).mockRejectedValue(new Error('Permiso denegado'));

            await expect(actualizarEstudiante(buildEstudiante())).rejects.toThrow('Permiso denegado');
        });
    });

    // ════════════════════════════════════════════════════════════════════════
    // 6. eliminarEstudiante
    // ════════════════════════════════════════════════════════════════════════
    describe('eliminarEstudiante', () => {
        it('[Integración] llama a deleteDoc con la referencia correcta', async () => {
            const mockRef = { id: 'est-del' };
            (doc as jest.Mock).mockReturnValue(mockRef);
            (deleteDoc as jest.Mock).mockResolvedValue(undefined);

            await eliminarEstudiante('est-del');

            expect(doc).toHaveBeenCalledWith(db, 'estudiantes', 'est-del');
            expect(deleteDoc).toHaveBeenCalledWith(mockRef);
        });

        it('[Unitario — Modo simulado] no llama a deleteDoc', async () => {
            (require('../firebase/config') as any).isFirebaseConfigured = false;

            await eliminarEstudiante('est-del');

            expect(deleteDoc).not.toHaveBeenCalled();
        });

        it('[Excepción] propaga error si Firestore falla al eliminar', async () => {
            const mockRef = { id: 'est-del' };
            (doc as jest.Mock).mockReturnValue(mockRef);
            (deleteDoc as jest.Mock).mockRejectedValue(new Error('No autorizado'));

            await expect(eliminarEstudiante('est-del')).rejects.toThrow('No autorizado');
        });
    });

    // ════════════════════════════════════════════════════════════════════════
    // 7. marcarCarnetsComoGenerados
    // ════════════════════════════════════════════════════════════════════════
    describe('marcarCarnetsComoGenerados', () => {
        it('[Integración] llama a batch.update por cada id y hace commit', async () => {
            const mockRef1 = { id: 'a' };
            const mockRef2 = { id: 'b' };
            (doc as jest.Mock)
                .mockReturnValueOnce(mockRef1)
                .mockReturnValueOnce(mockRef2);

            await marcarCarnetsComoGenerados(['a', 'b']);

            expect(mockBatch.update).toHaveBeenCalledTimes(2);
            expect(mockBatch.update).toHaveBeenCalledWith(mockRef1, { carnetGenerado: true });
            expect(mockBatch.update).toHaveBeenCalledWith(mockRef2, { carnetGenerado: true });
            expect(mockBatch.commit).toHaveBeenCalled();
        });

        it('[Triangulación] con lista vacía no llama update pero sí commit', async () => {
            await marcarCarnetsComoGenerados([]);

            expect(mockBatch.update).not.toHaveBeenCalled();
            expect(mockBatch.commit).toHaveBeenCalled();
        });

        it('[Unitario — Modo simulado] no ejecuta batch cuando Firebase no está configurado', async () => {
            (require('../firebase/config') as any).isFirebaseConfigured = false;
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

            await marcarCarnetsComoGenerados(['x']);

            expect(writeBatch).not.toHaveBeenCalled();
            consoleSpy.mockRestore();
        });

        it('[Excepción] propaga error si el batch falla', async () => {
            (doc as jest.Mock).mockReturnValue({ id: 'a' });
            mockBatch.commit.mockRejectedValue(new Error('Fallo batch'));

            await expect(marcarCarnetsComoGenerados(['a'])).rejects.toThrow('Fallo batch');
        });
    });

    // ════════════════════════════════════════════════════════════════════════
    // 8. guardarFirmaConsentimiento
    // ════════════════════════════════════════════════════════════════════════
    describe('guardarFirmaConsentimiento', () => {
        it('[Integración] sube la firma y actualiza el documento', async () => {
            const mockStorageRef = {};
            const mockSnapshot = { ref: {} };
            (ref as jest.Mock).mockReturnValue(mockStorageRef);
            (uploadString as jest.Mock).mockResolvedValue(mockSnapshot);
            (getDownloadURL as jest.Mock).mockResolvedValue('https://url-firma.com/firma.png');
            const mockDocRef = { id: 'est-1' };
            (doc as jest.Mock).mockReturnValue(mockDocRef);
            (updateDoc as jest.Mock).mockResolvedValue(undefined);

            await guardarFirmaConsentimiento('est-1', 't-1', 'data:image/png;base64,abc');

            expect(ref).toHaveBeenCalledWith(
                expect.anything(),
                expect.stringContaining('tenants/t-1/firmas/est-1/consentimiento_')
            );
            expect(uploadString).toHaveBeenCalledWith(
                mockStorageRef,
                'data:image/png;base64,abc',
                'data_url'
            );
            expect(updateDoc).toHaveBeenCalledWith(
                mockDocRef,
                expect.objectContaining({
                    consentimientoInformado: true,
                    'tutor.firmaDigital': 'https://url-firma.com/firma.png',
                })
            );
        });

        it('[Integración] agrega prefijo data:image si la firma no lo tiene', async () => {
            const mockStorageRef = {};
            const mockSnapshot = { ref: {} };
            (ref as jest.Mock).mockReturnValue(mockStorageRef);
            (uploadString as jest.Mock).mockResolvedValue(mockSnapshot);
            (getDownloadURL as jest.Mock).mockResolvedValue('https://url.com/f.png');
            (doc as jest.Mock).mockReturnValue({});
            (updateDoc as jest.Mock).mockResolvedValue(undefined);

            await guardarFirmaConsentimiento('est-1', 't-1', 'base64purosinprefijo');

            expect(uploadString).toHaveBeenCalledWith(
                mockStorageRef,
                'data:image/png;base64,base64purosinprefijo',
                'data_url'
            );
        });

        it('[Unitario — Modo simulado] no hace nada si Firebase no está configurado', async () => {
            (require('../firebase/config') as any).isFirebaseConfigured = false;

            await guardarFirmaConsentimiento('est-1', 't-1', 'firma');

            expect(uploadString).not.toHaveBeenCalled();
            expect(updateDoc).not.toHaveBeenCalled();
        });

        it('[Excepción] propaga error si uploadString falla', async () => {
            (ref as jest.Mock).mockReturnValue({});
            (uploadString as jest.Mock).mockRejectedValue(new Error('Storage lleno'));

            await expect(guardarFirmaConsentimiento('est-1', 't-1', 'firma')).rejects.toThrow(
                'Storage lleno'
            );
        });
    });

    // ════════════════════════════════════════════════════════════════════════
    // 9. guardarFirmaContrato
    // ════════════════════════════════════════════════════════════════════════
    describe('guardarFirmaContrato', () => {
        it('[Integración] sube el contrato y actualiza el campo correcto', async () => {
            const mockStorageRef = {};
            const mockSnapshot = { ref: {} };
            (ref as jest.Mock).mockReturnValue(mockStorageRef);
            (uploadString as jest.Mock).mockResolvedValue(mockSnapshot);
            (getDownloadURL as jest.Mock).mockResolvedValue('https://url.com/contrato.png');
            const mockDocRef = { id: 'est-2' };
            (doc as jest.Mock).mockReturnValue(mockDocRef);
            (updateDoc as jest.Mock).mockResolvedValue(undefined);

            await guardarFirmaContrato('est-2', 't-1', 'data:image/png;base64,xyz');

            expect(ref).toHaveBeenCalledWith(
                expect.anything(),
                expect.stringContaining('contrato_')
            );
            expect(updateDoc).toHaveBeenCalledWith(
                mockDocRef,
                expect.objectContaining({
                    contratoServiciosFirmado: true,
                    'tutor.firmaContratoDigital': 'https://url.com/contrato.png',
                })
            );
        });

        it('[Unitario — Modo simulado] no ejecuta nada', async () => {
            (require('../firebase/config') as any).isFirebaseConfigured = false;

            await guardarFirmaContrato('est-1', 't-1', 'firma');

            expect(uploadString).not.toHaveBeenCalled();
        });

        it('[Excepción] propaga error si getDownloadURL falla', async () => {
            (ref as jest.Mock).mockReturnValue({});
            (uploadString as jest.Mock).mockResolvedValue({ ref: {} });
            (getDownloadURL as jest.Mock).mockRejectedValue(new Error('URL inaccesible'));

            await expect(guardarFirmaContrato('est-1', 't-1', 'firma')).rejects.toThrow(
                'URL inaccesible'
            );
        });
    });

    // ════════════════════════════════════════════════════════════════════════
    // 10. guardarFirmaImagen — Triangulación autorizaFotos
    // ════════════════════════════════════════════════════════════════════════
    describe('guardarFirmaImagen (Triangulación autorizaFotos)', () => {
        const setupStorageMock = (url: string) => {
            (ref as jest.Mock).mockReturnValue({});
            (uploadString as jest.Mock).mockResolvedValue({ ref: {} });
            (getDownloadURL as jest.Mock).mockResolvedValue(url);
            (doc as jest.Mock).mockReturnValue({ id: 'est-3' });
            (updateDoc as jest.Mock).mockResolvedValue(undefined);
        };

        it('[Triangulación — Autoriza fotos = true] persiste consentimientoFotosVideos: true', async () => {
            setupStorageMock('https://url.com/imagen.png');

            await guardarFirmaImagen('est-3', 't-1', 'data:image/png;base64,abc', true);

            expect(updateDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    consentimientoImagenFirmado: true,
                    consentimientoFotosVideos: true,
                    'tutor.firmaImagenDigital': 'https://url.com/imagen.png',
                })
            );
        });

        it('[Triangulación — Autoriza fotos = false] persiste consentimientoFotosVideos: false', async () => {
            setupStorageMock('https://url.com/imagen2.png');

            await guardarFirmaImagen('est-3', 't-1', 'data:image/png;base64,abc', false);

            expect(updateDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    consentimientoImagenFirmado: true,
                    consentimientoFotosVideos: false,
                })
            );
        });

        it('[Unitario — Modo simulado] no ejecuta nada', async () => {
            (require('../firebase/config') as any).isFirebaseConfigured = false;

            await guardarFirmaImagen('est-1', 't-1', 'firma', true);

            expect(uploadString).not.toHaveBeenCalled();
        });

        it('[Excepción] propaga error si updateDoc falla al guardar imagen', async () => {
            (ref as jest.Mock).mockReturnValue({});
            (uploadString as jest.Mock).mockResolvedValue({ ref: {} });
            (getDownloadURL as jest.Mock).mockResolvedValue('https://url.com/img.png');
            (doc as jest.Mock).mockReturnValue({ id: 'est-3' });
            (updateDoc as jest.Mock).mockRejectedValue(new Error('updateDoc falló'));

            await expect(guardarFirmaImagen('est-3', 't-1', 'firma', true)).rejects.toThrow(
                'updateDoc falló'
            );
        });
    });
});
