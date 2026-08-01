// utils/facturacion.ts — mirrored exactly by functions/facturacion.js (CJS). Ver
// openspec/changes/pricing-cupo-real/design.md D1: el contrato de calculo es JSON versionado
// (functions/facturacion-config.json) + DOS implementaciones delgadas que iteran el mismo
// archivo de vectores dorados (functions/facturacion-vectores.json), NO un modulo compartido
// -- el repo raiz es ESM ("type":"module"), tsconfig.json excluye `functions/` con
// allowJs:false, y jest.config.js solo transforma `.tsx?`. Cualquier cambio aca DEBE
// reflejarse en functions/facturacion.js o las dos suites (facturacion.test.ts /
// functions/facturacion.test.js) divergen -- esa divergencia ES la senal que este diseno
// busca, no un bug a esconder.
//
// El import cross-boundary del JSON dentro de `functions/` (excluido en tsconfig.json) sigue
// el mismo patron ya probado en constantes.ts:4 -> ./functions/planes-config.json.
//
// Ambas funciones son PURAS: nunca tocan Firestore. Eso es lo que permite que el cron de
// cobro (functions/wompiCobroAutomatico.js, Bloque 3) y la calculadora publica
// (components/PrecioCalculadora.tsx, Bloque 4) compartan exactamente el mismo contrato sin
// reimplementarlo.
import type { ConfiguracionClub, Estudiante } from '../tipos';
import facturacionConfig from '../functions/facturacion-config.json';

export interface EntradaFacturacion {
    estudiantesFacturables: number;        // conteo, NO una lista de docs -- mantiene la fn pura
    sedesExtraContratadas: number;         // mas alla de incluido.sedes + bono
    equipoTecnicoExtraContratado: number;  // mas alla de incluido.equipoTecnico
}

export interface TramoFacturado {
    desde: number;
    hasta: number | null;
    cantidad: number;
    tarifa: number;
    subtotal: number;
}

export interface ResultadoFacturacion {
    estudiantes: { cantidad: number; subtotal: number; tramos: TramoFacturado[] };
    sedesExtra: { cantidad: number; subtotal: number };
    equipoTecnicoExtra: { cantidad: number; subtotal: number };
    totalPesos: number;
}

export interface CapacidadTenant {
    sedes: number;
    equipoTecnico: number;
    estudiantes: null; // null = sin tope (capacidad-tenant: "Sin tope duro de matricula")
}

type TenantParaCapacidad = Pick<ConfiguracionClub, 'sedeBonusOtorgada' | 'sedesExtraContratadas' | 'equipoTecnicoExtraContratado'>;
type EstudianteParaFacturable = Pick<Estudiante, 'estadoMatricula'>;

// El JSON infiere `hasta` como `number | null` a traves de los 4 elementos del array; se
// castea explicitamente para no depender de como ts-jest/tsc unifiquen el tipo estructural.
type TramoConfig = { desde: number; hasta: number | null; tarifa: number };
const tramosEstudiantes = facturacionConfig.tramosEstudiantes as TramoConfig[];

/**
 * Decide el `estadoMatricula` efectivo de un documento de estudiante. Ausencia TOTAL de
 * valor (documento legacy sin backfill, o documento no provisto) => 'activo' -- unico lugar
 * del repo donde vive esta regla de default (D3, design.md). Cualquier valor explicito
 * DISTINTO de 'retirado' tambien cae a 'activo': esta funcion nunca inventa un tercer estado.
 */
export function normalizarEstadoMatricula(doc?: EstudianteParaFacturable | null): 'activo' | 'retirado' {
    return doc && doc.estadoMatricula === 'retirado' ? 'retirado' : 'activo';
}

/**
 * Definicion de "facturable" (matricula-estado-estudiante): un estudiante es facturable si y
 * solo si su estadoMatricula normalizado es 'activo', sin importar estadoPago ni asistencia.
 * Absent ⇒ true (D3).
 */
export function esFacturable(estudiante?: EstudianteParaFacturable | null): boolean {
    return normalizarEstadoMatricula(estudiante) === 'activo';
}

/**
 * Capacidad de sede/equipo tecnico de un tenant (capacidad-tenant: fuente unica de verdad).
 * Pura: NUNCA recibe ni lee un conteo de estudiantes -- el bono de sede se otorga una sola
 * vez, vive en un flag persistido (`sedeBonusOtorgada`), y esta funcion solo LEE ese flag;
 * jamas lo recalcula desde un conteo en vivo (D4, design.md). Los 3 campos de entrada son
 * ADITIVOS/opcionales en ConfiguracionClub -- ausentes en un tenant legacy => false/0.
 */
export function calcularCapacidad(tenant: TenantParaCapacidad): CapacidadTenant {
    const bono = tenant.sedeBonusOtorgada === true ? facturacionConfig.bonoSede.sedesOtorgadas : 0;
    const sedesExtra = Number(tenant.sedesExtraContratadas) || 0;
    const equipoExtra = Number(tenant.equipoTecnicoExtraContratado) || 0;

    return {
        sedes: facturacionConfig.incluido.sedes + bono + sedesExtra,
        equipoTecnico: facturacionConfig.incluido.equipoTecnico + equipoExtra,
        estudiantes: null,
    };
}

/**
 * Monto mensual medido (facturacion-metered). Marginal/progresivo por tramo: cada
 * estudiante paga la tarifa de SU propio tramo y los tramos ya cruzados nunca se
 * recalculan a la tarifa nueva (spec Scenario "Tenant que cruza un tramo"). Extras de sede
 * y equipo tecnico se suman sin descuento por volumen, independientes de los tramos.
 */
export function calcularFacturacionMensual(entrada: EntradaFacturacion): ResultadoFacturacion {
    const totalEstudiantes = Number(entrada.estudiantesFacturables) || 0;
    const sedesExtra = Number(entrada.sedesExtraContratadas) || 0;
    const equipoExtra = Number(entrada.equipoTecnicoExtraContratado) || 0;

    const tramos: TramoFacturado[] = [];
    let restantes = totalEstudiantes;
    let subtotalEstudiantes = 0;

    for (const tramo of tramosEstudiantes) {
        if (restantes <= 0) break;
        const tope = tramo.hasta === null ? Infinity : tramo.hasta;
        const capacidadTramo = tope - tramo.desde + 1;
        const cantidad = Math.min(restantes, capacidadTramo);
        const subtotal = cantidad * tramo.tarifa;

        tramos.push({ desde: tramo.desde, hasta: tramo.hasta, cantidad, tarifa: tramo.tarifa, subtotal });
        subtotalEstudiantes += subtotal;
        restantes -= cantidad;
    }

    const sedesExtraSubtotal = sedesExtra * facturacionConfig.extras.sede;
    const equipoExtraSubtotal = equipoExtra * facturacionConfig.extras.equipoTecnico;

    return {
        estudiantes: { cantidad: totalEstudiantes, subtotal: subtotalEstudiantes, tramos },
        sedesExtra: { cantidad: sedesExtra, subtotal: sedesExtraSubtotal },
        equipoTecnicoExtra: { cantidad: equipoExtra, subtotal: equipoExtraSubtotal },
        totalPesos: subtotalEstudiantes + sedesExtraSubtotal + equipoExtraSubtotal,
    };
}
