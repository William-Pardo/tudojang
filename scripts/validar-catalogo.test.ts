import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { CATALOGO_SOPORTE_V1 } from '../shared/soporte/catalogo.v1';
import {
    calcularChecksumCatalogo,
    serializarCatalogoSoporte,
    validarCatalogoSoporte,
} from '../shared/soporte/validacion';
import type { CatalogoSoporte } from '../shared/soporte/tipos';

const cloneCatalog = (): CatalogoSoporte => JSON.parse(JSON.stringify(CATALOGO_SOPORTE_V1));

describe('validación y generación del catálogo', () => {
    it('acepta el catálogo canónico completo', () => {
        expect(validarCatalogoSoporte(CATALOGO_SOPORTE_V1)).toEqual([]);
        expect(CATALOGO_SOPORTE_V1.entries).toHaveLength(59);
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
        const outputRoot = mkdtempSync(path.join(tmpdir(), 'catalogo-soporte-'));
        const script = path.resolve('scripts/generar-catalogo.mjs');

        try {
            const generate = spawnSync(process.execPath, [script, '--output-root', outputRoot], {
                encoding: 'utf8',
            });
            expect(generate.status).toBe(0);

            const clientJson = path.join(outputRoot, 'public/generated/soporte/catalogo.v1.json');
            const functionJson = path.join(outputRoot, 'functions/generated/soporte/catalogo.v1.json');
            const checksumFile = path.join(outputRoot, 'public/generated/soporte/catalogo.v1.sha256');
            const expectedJson = serializarCatalogoSoporte(CATALOGO_SOPORTE_V1);

            expect(readFileSync(clientJson, 'utf8')).toBe(expectedJson);
            expect(readFileSync(functionJson, 'utf8')).toBe(expectedJson);
            expect(readFileSync(checksumFile, 'utf8').trim()).toBe(
                calcularChecksumCatalogo(CATALOGO_SOPORTE_V1),
            );

            const check = spawnSync(process.execPath, [script, '--check', '--output-root', outputRoot], {
                encoding: 'utf8',
            });
            expect(check.status).toBe(0);

            writeFileSync(clientJson, `${expectedJson}\n{"drift":true}`, 'utf8');
            const drift = spawnSync(process.execPath, [script, '--check', '--output-root', outputRoot], {
                encoding: 'utf8',
            });
            expect(drift.status).toBe(1);
            expect(drift.stderr).toContain('drift');
        } finally {
            rmSync(outputRoot, { recursive: true, force: true });
        }
    });
});
