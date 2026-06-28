import type { ContextoSoporte, HistorialSoporteInput, TurnoSoporte } from '../../shared/soporte/tipos';

const CONTINUITY_WORDS = /\b(eso|esa|ese|esto|esta|este|ahi|alli|lo|la|los|las|mismo|anterior)\b/i;

export function normalizarTextoSoporte(value: string): string {
    return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .replace(/\s+/g, ' ');
}

export function redactarTextoSoporte(value: string): string {
    return value
        .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[EMAIL]')
        .replace(/\b(?:\+?57\s*)?3\d{9}\b/g, '[TELEFONO]')
        .replace(/\b(CC|c[eé]dula|documento)\s*[:#-]?\s*\d{6,12}\b/gi, (_match, label: string) => `${label} [DOCUMENTO]`);
}

function parseLegacyHistory(history: string): TurnoSoporte[] {
    return history
        .split('|')
        .map(text => text.trim())
        .filter(Boolean)
        .map((text, index) => ({
            role: index % 2 === 0 ? 'user' : 'assistant',
            text,
        }));
}

export function prepararContextoSoporte(history: HistorialSoporteInput): ContextoSoporte {
    const turns = (typeof history === 'string' ? parseLegacyHistory(history) : history)
        .slice(-4)
        .map(turn => ({ ...turn, text: redactarTextoSoporte(turn.text).slice(0, 400) }));
    const normalizedText = normalizarTextoSoporte(turns.map(turn => turn.text).join(' '));

    return {
        turns,
        normalizedText,
    };
}

export function preguntaUsaContinuidad(question: string): boolean {
    return CONTINUITY_WORDS.test(normalizarTextoSoporte(question));
}
