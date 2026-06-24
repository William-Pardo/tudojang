import { CATALOGO_SOPORTE_V1 } from "../shared/soporte/catalogo.v1";
import type { HistorialSoporteInput, RolSoporte } from "../shared/soporte/tipos";
import type { RolUsuario } from "../tipos";
import { prepararContextoSoporte } from "./soporte/contexto";
import { resolverConsultaLocal } from "./soporte/matcher";

const REMOTE_QUERY_COMPATIBILITY_VALUE = 0;

export const consultarSabonimVirtual = async (
    pregunta: string,
    historialPrevio: HistorialSoporteInput = [],
    rol: RolSoporte | RolUsuario = 'Publico',
): Promise<string> => {
    if (solicitaSoporteHumano(pregunta)) {
        return 'Puedo abrir una solicitud para que un asesor de la app revise tu caso. [ESCALAR_SOPORTE_MASTER]';
    }

    const contexto = prepararContextoSoporte(historialPrevio);
    const resultadoLocal = resolverConsultaLocal({
        question: pregunta,
        role: rol as RolSoporte,
        context: contexto,
        catalog: CATALOGO_SOPORTE_V1,
    });
    if (resultadoLocal.state !== 'fallback') return resultadoLocal.answer;

    return resultadoLocal.answer;
};

export const getRemainingQueries = (): number => REMOTE_QUERY_COMPATIBILITY_VALUE;

function solicitaSoporteHumano(pregunta: string): boolean {
    const texto = normalizar(pregunta);
    return ['soporte humano', 'soporte tecnico', 'mesa de ayuda', 'hablar con alguien', 'hablar con una persona', 'asesor']
        .some(frase => texto.includes(frase));
}

function normalizar(valor: string): string {
    return valor
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}
