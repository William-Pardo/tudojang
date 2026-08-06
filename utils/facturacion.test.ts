// utils/facturacion.test.ts — Jest, mirror exacto de functions/facturacion.test.js (node:test).
// Ambas suites iteran functions/facturacion-vectores.json (SDD pricing-cupo-real, Bloque 2, D1
// design.md): la paridad entre esta implementacion y functions/facturacion.js es un contrato
// de datos verificado por 2 suites independientes, no una promesa de revision manual.
import facturacionVectoresRaw from '../functions/facturacion-vectores.json';
import type { ConfiguracionClub, Estudiante } from '../tipos';
import {
    calcularFacturacionMensual,
    calcularCapacidad,
    esFacturable,
    normalizarEstadoMatricula,
    type EntradaFacturacion,
    type ResultadoFacturacion,
    type CapacidadTenant,
} from './facturacion';

type TenantParaCapacidad = Pick<ConfiguracionClub, 'sedeBonusOtorgada' | 'sedesExtraContratadas' | 'equipoTecnicoExtraContratado'>;
type EstudianteParaFacturable = Pick<Estudiante, 'estadoMatricula'>;

interface VectorFacturacion {
    nombre: string;
    entrada: EntradaFacturacion;
    esperado: ResultadoFacturacion;
}
interface VectorCapacidad {
    nombre: string;
    entrada: TenantParaCapacidad;
    esperado: CapacidadTenant;
}
interface VectorBooleano {
    nombre: string;
    entrada: EstudianteParaFacturable | null;
    esperado: boolean;
}
interface VectorEstado {
    nombre: string;
    entrada: EstudianteParaFacturable | null;
    esperado: 'activo' | 'retirado';
}
interface FacturacionVectoresFile {
    version: number;
    calcularFacturacionMensual: VectorFacturacion[];
    calcularCapacidad: VectorCapacidad[];
    esFacturable: VectorBooleano[];
    normalizarEstadoMatricula: VectorEstado[];
}

// El JSON se importa tal cual (resolveJsonModule) y se castea a la forma exacta que usan los
// tests -- mismo patron cross-boundary ya probado en constantes.ts:4 (functions/ esta en
// tsconfig `exclude`, pero un import explicito SI se resuelve; ver D1, design.md).
const vectores = facturacionVectoresRaw as unknown as FacturacionVectoresFile;

describe('facturacion-vectores.json', () => {
    it('expone las 4 listas de vectores esperadas', () => {
        expect(typeof vectores.version).toBe('number');
        expect(vectores.calcularFacturacionMensual.length).toBeGreaterThan(0);
        expect(vectores.calcularCapacidad.length).toBeGreaterThan(0);
        expect(vectores.esFacturable.length).toBeGreaterThan(0);
        expect(vectores.normalizarEstadoMatricula.length).toBeGreaterThan(0);
    });
});

describe('calcularFacturacionMensual', () => {
    it.each(vectores.calcularFacturacionMensual.map((v): [string, VectorFacturacion] => [v.nombre, v]))(
        '%s',
        (_nombre, vector) => {
            expect(calcularFacturacionMensual(vector.entrada)).toEqual(vector.esperado);
        },
    );

    // Continuidad exacta en cada limite de tramo (spec facturacion-metered) -- la pieza mas
    // sensible a bugs sutiles de todo el cambio (design.md). Explicito como delta, no solo
    // implicito por comparacion manual de dos vectores.
    const sinExtras = (estudiantesFacturables: number): EntradaFacturacion => ({
        estudiantesFacturables,
        sedesExtraContratadas: 0,
        equipoTecnicoExtraContratado: 0,
    });

    it('continuidad exacta: 70 -> 71 suma exactamente la tarifa del tramo 71-150 ($3.600)', () => {
        const en70 = calcularFacturacionMensual(sinExtras(70));
        const en71 = calcularFacturacionMensual(sinExtras(71));
        expect(en71.totalPesos - en70.totalPesos).toBe(3600);
    });

    it('continuidad exacta: 150 -> 151 suma exactamente la tarifa del tramo 151-350 ($3.400)', () => {
        const en150 = calcularFacturacionMensual(sinExtras(150));
        const en151 = calcularFacturacionMensual(sinExtras(151));
        expect(en151.totalPesos - en150.totalPesos).toBe(3400);
    });

    it('continuidad exacta: 350 -> 351 suma exactamente la tarifa del tramo 351+ ($3.000)', () => {
        const en350 = calcularFacturacionMensual(sinExtras(350));
        const en351 = calcularFacturacionMensual(sinExtras(351));
        expect(en351.totalPesos - en350.totalPesos).toBe(3000);
    });
});

describe('calcularCapacidad', () => {
    it.each(vectores.calcularCapacidad.map((v): [string, VectorCapacidad] => [v.nombre, v]))(
        '%s',
        (_nombre, vector) => {
            expect(calcularCapacidad(vector.entrada)).toEqual(vector.esperado);
        },
    );

    // Pura (D4, design.md): el bono se lee de un flag ya persistido, JAMAS de un conteo en
    // vivo. Agregar un campo espurio de conteo al input no debe cambiar nada.
    it('nunca lee un conteo de estudiantes del input (pureza, D4)', () => {
        const base: TenantParaCapacidad = { sedeBonusOtorgada: true, sedesExtraContratadas: 2, equipoTecnicoExtraContratado: 1 };
        const conEstudiantesEspurios = { ...base, estudiantesFacturables: 999999 } as TenantParaCapacidad;
        expect(calcularCapacidad(conEstudiantesEspurios)).toEqual(calcularCapacidad(base));
    });
});

describe('esFacturable', () => {
    it.each(vectores.esFacturable.map((v): [string, VectorBooleano] => [v.nombre, v]))(
        '%s',
        (_nombre, vector) => {
            expect(esFacturable(vector.entrada)).toBe(vector.esperado);
        },
    );
});

describe('normalizarEstadoMatricula', () => {
    it.each(vectores.normalizarEstadoMatricula.map((v): [string, VectorEstado] => [v.nombre, v]))(
        '%s',
        (_nombre, vector) => {
            expect(normalizarEstadoMatricula(vector.entrada)).toBe(vector.esperado);
        },
    );
});
