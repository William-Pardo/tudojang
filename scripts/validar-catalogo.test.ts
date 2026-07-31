import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { CATALOGO_SOPORTE_V1 } from '../shared/soporte/catalogo.v1';
import { validarCatalogoSoporte } from '../shared/soporte/validacion';
import type { CatalogoSoporte } from '../shared/soporte/tipos';

const fixturesRoot = path.resolve('scripts/__fixtures__/catalogo-gate');
const script = path.resolve('scripts/generar-catalogo.mjs');

const conOutputRootTemporal = <T>(prefijo: string, ejecutar: (outputRoot: string) => T): T => {
    const outputRoot = mkdtempSync(path.join(tmpdir(), prefijo));
    try {
        return ejecutar(outputRoot);
    } finally {
        rmSync(outputRoot, { recursive: true, force: true });
    }
};

const cloneCatalog = (): CatalogoSoporte => JSON.parse(JSON.stringify(CATALOGO_SOPORTE_V1));

describe('validación y generación del catálogo', () => {
    it('acepta el catálogo canónico completo', () => {
        expect(validarCatalogoSoporte(CATALOGO_SOPORTE_V1)).toEqual([]);
        expect(CATALOGO_SOPORTE_V1.entries).toHaveLength(55);
    });

    it('informa todas las ausencias obligatorias de una entrada incompleta', () => {
        const catalogoIncompleto = cloneCatalog();
        Object.assign(catalogoIncompleto.entries[0], {
            aliases: [],
            steps: [],
            sourceFiles: [],
            authorizationRef: '',
            owner: '',
        });

        expect(validarCatalogoSoporte(catalogoIncompleto)).toEqual(expect.arrayContaining([
            expect.stringContaining('aliases'),
            expect.stringContaining('steps'),
            expect.stringContaining('sourceFiles'),
            expect.stringContaining('authorizationRef'),
            expect.stringContaining('owner'),
        ]));
    });

    it('rechaza ids duplicados, roles/rutas desconocidos y versiones inválidas', () => {
        const catalogoInvalido = cloneCatalog();
        catalogoInvalido.catalogVersion = 'v1';
        catalogoInvalido.entries[1].id = catalogoInvalido.entries[0].id;
        catalogoInvalido.entries[1].roles = ['RolInventado' as never];
        catalogoInvalido.entries[1].route = '/ruta-inventada';

        expect(validarCatalogoSoporte(catalogoInvalido)).toEqual(expect.arrayContaining([
            expect.stringContaining('catalogVersion'),
            expect.stringContaining('duplicado'),
            expect.stringContaining('RolInventado'),
            expect.stringContaining('/ruta-inventada'),
        ]));
    });

    it('genera copias idénticas y detecta drift por checksum', () => {
        conOutputRootTemporal('catalogo-soporte-', (outputRoot) => {
            const generate = spawnSync(process.execPath, [script, '--output-root', outputRoot], {
                encoding: 'utf8',
            });
            expect(generate.status).toBe(0);

            const clientJson = path.join(outputRoot, 'public/generated/soporte/catalogo.v1.json');
            const functionJson = path.join(outputRoot, 'functions/generated/soporte/catalogo.v1.json');
            const checksumFile = path.join(outputRoot, 'public/generated/soporte/catalogo.v1.sha256');

            const clientContent = readFileSync(clientJson, 'utf8');
            const functionContent = readFileSync(functionJson, 'utf8');

            // Invariante: public/ y functions/ son copias byte a byte del mismo catálogo fusionado
            // (ya no un diff contra un golden estático, porque el catálogo emitido ahora es la
            // fusión núcleo+marcadores, no una copia directa de CATALOGO_SOPORTE_V1).
            expect(functionContent).toBe(clientContent);
            // Invariante: el .sha256 committeado coincide con el sha256 real del JSON emitido.
            expect(readFileSync(checksumFile, 'utf8').trim()).toBe(
                createHash('sha256').update(clientContent).digest('hex'),
            );
            // Invariante: el catálogo fusionado emitido sigue siendo un CatalogoSoporte válido.
            expect(validarCatalogoSoporte(JSON.parse(clientContent) as CatalogoSoporte)).toEqual([]);

            const check = spawnSync(process.execPath, [script, '--check', '--output-root', outputRoot], {
                encoding: 'utf8',
            });
            expect(check.status).toBe(0);

            writeFileSync(clientJson, `${clientContent}\n{"drift":true}`, 'utf8');
            const drift = spawnSync(process.execPath, [script, '--check', '--output-root', outputRoot], {
                encoding: 'utf8',
            });
            expect(drift.status).toBe(1);
            expect(drift.stderr).toContain('drift');
        });
    });

    it('--source-root: falla duro por id duplicado entre dos marcadores (fixture marcador-duplicado)', () => {
        conOutputRootTemporal('catalogo-soporte-duplicado-', (outputRoot) => {
            const sourceRoot = path.join(fixturesRoot, 'marcador-duplicado');

            const result = spawnSync(
                process.execPath,
                [script, '--source-root', sourceRoot, '--output-root', outputRoot],
                { encoding: 'utf8' },
            );

            expect(result.status).toBe(1);
            expect(result.stderr).toContain('fixture.duplicado');
            expect(result.stderr).toContain('VistaDuplicadoA.tsx');
            expect(result.stderr).toContain('VistaDuplicadoB.tsx');
        });
    });

    it('--source-root: falla duro por marcador dinámico no evaluable estáticamente (fixture marcador-dinamico, D3)', () => {
        conOutputRootTemporal('catalogo-soporte-dinamico-', (outputRoot) => {
            const sourceRoot = path.join(fixturesRoot, 'marcador-dinamico');

            const result = spawnSync(
                process.execPath,
                [script, '--source-root', sourceRoot, '--output-root', outputRoot],
                { encoding: 'utf8' },
            );

            expect(result.status).toBe(1);
            expect(result.stderr).toMatch(/VistaDinamica\.tsx:\d+:\d+/);
            expect(result.stderr).toMatch(/Spread/);
        });
    });
});
