/**
 * sedesApi.test.ts
 *
 * Regresion critica 2026-07-16: el ID real del documento de Firestore (`doc.id`) SIEMPRE
 * debe ganar sobre cualquier campo `id` guardado dentro de la data del documento. El orden
 * de spread invertido (`{ id: doc.id, ...doc.data() }`) dejaba que un `id` vacio/corrupto
 * dentro de la data pisara el ID real, produciendo sedes sin ID valido -- eso rompia
 * `resolverSedeIdPorNombre` (AsignacionesView.tsx) al guardar un Programa academico, que
 * caia al fallback de slug en vez del ID real, dejando la Agenda de Tutor/Estudiante vacia
 * para siempre (`jornada.sedeId` nunca calzaba con `estudiante.sedeId`), sin importar
 * cuantas veces se reguardara el programa. Ver hallazgo completo en consola
 * ([AgendaView][diag], "10 de 11 sedes corruptas (ID: N/A)").
 */
import { obtenerSedes, agregarSede, actualizarSede, eliminarSede } from './sedesApi';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import type { Sede } from '../tipos';

jest.mock('firebase/firestore', () => ({
    collection: jest.fn(),
    getDocs: jest.fn(),
    addDoc: jest.fn(),
    updateDoc: jest.fn(),
    deleteDoc: jest.fn(),
    doc: jest.fn(),
    query: jest.fn(),
    where: jest.fn(),
}));

const mockCallable = jest.fn();
jest.mock('firebase/functions', () => ({
    getFunctions: jest.fn(() => 'functions-mock'),
    httpsCallable: jest.fn(() => mockCallable),
}));

jest.mock('../firebase/config', () => ({
    db: {},
    isFirebaseConfigured: true,
}));

describe('sedesApi.obtenerSedes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (require('../firebase/config') as any).isFirebaseConfigured = true;
        (collection as jest.Mock).mockReturnValue('sedes-collection');
        (query as jest.Mock).mockReturnValue('sedes-query');
        (where as jest.Mock).mockReturnValue('where-clause');
    });

    it('usa el doc.id real de Firestore, no un campo `id` corrupto guardado dentro de la data', async () => {
        const mockSnap = {
            docs: [
                {
                    id: 'X5Ty5p1CTY2Zx00jwIKj',
                    // Documento legacy/corrupto: trae su PROPIO campo `id` vacio dentro de la
                    // data (posible resabio de un seed/migracion vieja). El doc.id real (arriba)
                    // es el unico ID valido -- no debe perderse.
                    data: () => ({ id: '', nombre: 'Cocodrilos', tenantId: 'escuela-gajog-001' }),
                },
            ],
        };
        (getDocs as jest.Mock).mockResolvedValue(mockSnap);

        const resultado = await obtenerSedes('escuela-gajog-001');

        expect(resultado).toHaveLength(1);
        expect(resultado[0].id).toBe('X5Ty5p1CTY2Zx00jwIKj');
        expect(resultado[0].nombre).toBe('Cocodrilos');
    });

    it('tambien gana el doc.id real cuando la data trae un id string no vacio distinto (nunca confiar en el campo guardado)', async () => {
        const mockSnap = {
            docs: [
                {
                    id: 'id-real-de-firestore',
                    data: () => ({ id: 'id-viejo-obsoleto', nombre: 'Sede Norte', tenantId: 'tenant-1' }),
                },
            ],
        };
        (getDocs as jest.Mock).mockResolvedValue(mockSnap);

        const resultado = await obtenerSedes('tenant-1');

        expect(resultado[0].id).toBe('id-real-de-firestore');
    });

    it('retorna varias sedes sin colisionar cuando ninguna trae un id corrupto', async () => {
        const mockSnap = {
            docs: [
                { id: 'sede-a', data: () => ({ nombre: 'Sede A', tenantId: 'tenant-1' }) },
                { id: 'sede-b', data: () => ({ nombre: 'Sede B', tenantId: 'tenant-1' }) },
            ],
        };
        (getDocs as jest.Mock).mockResolvedValue(mockSnap);

        const resultado = await obtenerSedes('tenant-1');

        expect(resultado.map((s) => s.id)).toEqual(['sede-a', 'sede-b']);
    });

    it('filtra sedes con deletedAt (soft delete)', async () => {
        const mockSnap = {
            docs: [
                { id: 'sede-activa', data: () => ({ nombre: 'Activa', tenantId: 'tenant-1' }) },
                { id: 'sede-borrada', data: () => ({ nombre: 'Borrada', tenantId: 'tenant-1', deletedAt: '2026-01-01T00:00:00.000Z' }) },
            ],
        };
        (getDocs as jest.Mock).mockResolvedValue(mockSnap);

        const resultado = await obtenerSedes('tenant-1');

        expect(resultado.map((s) => s.id)).toEqual(['sede-activa']);
    });
});

// ─── agregarSede / actualizarSede / eliminarSede ────────────────────────────
// Fix 2026-07-16 (puerta trasera del limite de sedes): estas tres funciones YA NO
// escriben directo a Firestore -- pasan por createSede/updateSede/deleteSede
// (Cloud Functions que re-validan limite de plan y unicidad de nombre server-side).
describe('sedesApi.agregarSede / actualizarSede / eliminarSede (via Cloud Functions)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (require('../firebase/config') as any).isFirebaseConfigured = true;
    });

    it('agregarSede invoca la Cloud Function createSede con el payload completo', async () => {
        const sedeCreada: Sede = { id: 'sede-nueva', tenantId: 'tenant-1', nombre: 'Sede Norte', direccion: '', ciudad: '', telefono: '' };
        mockCallable.mockResolvedValue({ data: sedeCreada });

        const resultado = await agregarSede({ tenantId: 'tenant-1', nombre: 'Sede Norte', direccion: '', ciudad: '', telefono: '' });

        expect(httpsCallable).toHaveBeenCalledWith('functions-mock', 'createSede');
        expect(mockCallable).toHaveBeenCalledWith(
            expect.objectContaining({ tenantId: 'tenant-1', nombre: 'Sede Norte' })
        );
        expect(resultado).toEqual(sedeCreada);
    });

    it('agregarSede propaga el error si la Cloud Function rechaza (ej. limite de plan alcanzado)', async () => {
        mockCallable.mockRejectedValue(new Error('Límite de sedes alcanzado (2)'));

        await expect(
            agregarSede({ tenantId: 'tenant-1', nombre: 'Sede 3', direccion: '', ciudad: '', telefono: '' })
        ).rejects.toThrow(/límite de sedes/i);
    });

    it('actualizarSede invoca updateSede con sedeId + cambios, sin mandar id/tenantId dentro de cambios', async () => {
        const sedeActualizada: Sede = { id: 'sede-1', tenantId: 'tenant-1', nombre: 'Sede Renombrada', direccion: '', ciudad: '', telefono: '' };
        mockCallable.mockResolvedValue({ data: sedeActualizada });

        const resultado = await actualizarSede({ id: 'sede-1', tenantId: 'tenant-1', nombre: 'Sede Renombrada', direccion: '', ciudad: '', telefono: '' });

        expect(httpsCallable).toHaveBeenCalledWith('functions-mock', 'updateSede');
        expect(mockCallable).toHaveBeenCalledWith({
            tenantId: 'tenant-1',
            sedeId: 'sede-1',
            cambios: { nombre: 'Sede Renombrada', direccion: '', ciudad: '', telefono: '' },
        });
        expect(resultado).toEqual(sedeActualizada);
    });

    it('actualizarSede rechaza localmente si la sede no tiene id, sin llamar a la Cloud Function', async () => {
        await expect(
            actualizarSede({ tenantId: 'tenant-1', nombre: 'Sin id' } as Sede)
        ).rejects.toThrow(/id de sede inválido/i);

        expect(mockCallable).not.toHaveBeenCalled();
    });

    it('eliminarSede invoca deleteSede solo con sedeId (el servidor deriva el tenant del propio documento)', async () => {
        mockCallable.mockResolvedValue({ data: { ok: true, id: 'sede-1' } });

        await eliminarSede('sede-1');

        expect(httpsCallable).toHaveBeenCalledWith('functions-mock', 'deleteSede');
        expect(mockCallable).toHaveBeenCalledWith({ sedeId: 'sede-1' });
    });

    it('eliminarSede rechaza localmente sin id, sin llamar a la Cloud Function', async () => {
        await expect(eliminarSede('')).rejects.toThrow(/id de sede inválido/i);
        expect(mockCallable).not.toHaveBeenCalled();
    });
});
