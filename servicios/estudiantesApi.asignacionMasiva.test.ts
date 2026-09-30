/**
 * Asignación masiva (grupo de entrenamiento / grado) desde el Directorio.
 * Contrato de seguridad: cada write es un updateDoc PARCIAL de UN SOLO campo por estudiante
 * (nunca setDoc ni el documento completo), los fallos se reportan por estudiante y el
 * reintento sobre los fallidos es idempotente.
 */
import { aplicarCambioEstudiante, aplicarCambioMasivoEstudiantes } from './estudiantesApi';
import { db } from '../firebase/config';
import { doc, updateDoc, setDoc, writeBatch } from 'firebase/firestore';
import { GradoTKD } from '../tipos';

jest.mock('firebase/firestore', () => ({
    collection: jest.fn(),
    getDocs: jest.fn(),
    doc: jest.fn((_db: unknown, _col: string, id: string) => ({ id })),
    getDoc: jest.fn(),
    updateDoc: jest.fn(),
    setDoc: jest.fn(),
    deleteDoc: jest.fn(),
    deleteField: jest.fn(() => 'DELETE_FIELD_SENTINEL'),
    query: jest.fn(),
    where: jest.fn(),
    limit: jest.fn(),
    writeBatch: jest.fn(),
}));
jest.mock('firebase/functions', () => ({ getFunctions: jest.fn(), httpsCallable: jest.fn() }));
jest.mock('firebase/storage', () => ({ getStorage: jest.fn(), ref: jest.fn(), uploadString: jest.fn(), getDownloadURL: jest.fn() }));
jest.mock('../firebase/config', () => ({ db: {}, isFirebaseConfigured: true }));

const updateDocMock = updateDoc as jest.Mock;

describe('asignación masiva de estudiantes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (require('../firebase/config') as any).isFirebaseConfigured = true;
        updateDocMock.mockResolvedValue(undefined);
    });

    describe('aplicarCambioEstudiante', () => {
        it('asignar grado escribe SOLO el campo grado con updateDoc', async () => {
            await aplicarCambioEstudiante('est-1', { campo: 'grado', valor: GradoTKD.Verde });

            expect(doc).toHaveBeenCalledWith(db, 'estudiantes', 'est-1');
            expect(updateDocMock).toHaveBeenCalledTimes(1);
            const payload = updateDocMock.mock.calls[0][1];
            expect(Object.keys(payload)).toEqual(['grado']);
            expect(payload).toEqual({ grado: GradoTKD.Verde });
            expect(setDoc).not.toHaveBeenCalled();
            expect(writeBatch).not.toHaveBeenCalled();
        });

        it('asignar grupo de entrenamiento escribe SOLO grupoEntrenamientoId', async () => {
            await aplicarCambioEstudiante('est-1', { campo: 'grupoEntrenamientoId', valor: 'grp-a' });

            const payload = updateDocMock.mock.calls[0][1];
            expect(Object.keys(payload)).toEqual(['grupoEntrenamientoId']);
            expect(payload).toEqual({ grupoEntrenamientoId: 'grp-a' });
        });

        it('"Sin grupo" (null) borra solo el campo grupoEntrenamientoId', async () => {
            await aplicarCambioEstudiante('est-1', { campo: 'grupoEntrenamientoId', valor: null });

            expect(updateDocMock.mock.calls[0][1]).toEqual({ grupoEntrenamientoId: 'DELETE_FIELD_SENTINEL' });
        });

        it('en modo simulado (sin Firebase) no escribe nada', async () => {
            (require('../firebase/config') as any).isFirebaseConfigured = false;
            await aplicarCambioEstudiante('est-1', { campo: 'grado', valor: GradoTKD.Azul });
            expect(updateDocMock).not.toHaveBeenCalled();
        });
    });

    describe('aplicarCambioMasivoEstudiantes', () => {
        it('hace un updateDoc parcial por estudiante y reporta todos como exitosos', async () => {
            const resultado = await aplicarCambioMasivoEstudiantes(['a', 'b', 'c'], { campo: 'grado', valor: GradoTKD.Rojo });

            expect(resultado).toEqual({ exitosos: ['a', 'b', 'c'], fallidos: [] });
            expect(updateDocMock).toHaveBeenCalledTimes(3);
            updateDocMock.mock.calls.forEach(([, payload]) => expect(payload).toEqual({ grado: GradoTKD.Rojo }));
            expect(updateDocMock.mock.calls.map(([ref]) => ref.id)).toEqual(['a', 'b', 'c']);
        });

        it('un fallo parcial no frena al resto y se reporta por estudiante con su motivo', async () => {
            updateDocMock.mockImplementation(async (ref: { id: string }) => {
                if (ref.id === 'b') throw new Error('permission-denied');
                if (ref.id === 'd') throw 'timeout';
            });

            const resultado = await aplicarCambioMasivoEstudiantes(['a', 'b', 'c', 'd'], { campo: 'grupoEntrenamientoId', valor: 'grp-x' });

            expect(resultado.exitosos).toEqual(['a', 'c']);
            expect(resultado.fallidos).toEqual([
                { id: 'b', error: 'permission-denied' },
                { id: 'd', error: 'timeout' },
            ]);
            expect(updateDocMock).toHaveBeenCalledTimes(4);
        });

        it('reintentar solo los fallidos vuelve a escribir el mismo valor únicamente sobre ellos (idempotente)', async () => {
            updateDocMock.mockImplementationOnce(async () => undefined) // a
                .mockImplementationOnce(async () => { throw new Error('red'); }); // b
            const cambio = { campo: 'grado' as const, valor: GradoTKD.Azul };

            const primero = await aplicarCambioMasivoEstudiantes(['a', 'b'], cambio);
            expect(primero.fallidos.map(f => f.id)).toEqual(['b']);

            updateDocMock.mockClear();
            updateDocMock.mockResolvedValue(undefined);
            const reintento = await aplicarCambioMasivoEstudiantes(primero.fallidos.map(f => f.id), cambio);

            expect(reintento).toEqual({ exitosos: ['b'], fallidos: [] });
            expect(updateDocMock).toHaveBeenCalledTimes(1);
            expect(updateDocMock.mock.calls[0][0].id).toBe('b');
            expect(updateDocMock.mock.calls[0][1]).toEqual({ grado: GradoTKD.Azul });
        });

        it('ignora ids repetidos (un solo write por estudiante)', async () => {
            const resultado = await aplicarCambioMasivoEstudiantes(['a', 'a', 'b'], { campo: 'grado', valor: GradoTKD.Blanco });
            expect(resultado.exitosos).toEqual(['a', 'b']);
            expect(updateDocMock).toHaveBeenCalledTimes(2);
        });
    });
});
