import type {
    EntradaCatalogoSoporte,
    ResolverConsultaLocalInput,
    ResultadoSoporteLocal,
} from '../../shared/soporte/tipos';
import { normalizarTextoSoporte, preguntaUsaContinuidad } from './contexto';

export const LOCAL_ANSWER_THRESHOLD = 0.78;
export const LOCAL_CLARIFY_THRESHOLD = 0.55;

interface ScoredEntry {
    entry: EntradaCatalogoSoporte;
    score: number;
}

const roundConfidence = (value: number) => Math.round(Math.max(0, Math.min(1, value)) * 10000) / 10000;
const STOP_WORDS = new Set(['como', 'con', 'del', 'esta', 'este', 'hacer', 'hago', 'ayuda', 'necesito', 'para', 'por', 'quiero', 'una', 'uno', 'unos', 'unas']);
const VERB_STEMS: Array<[RegExp, string]> = [
    [/^agreg/, 'agregar'],
    [/^activ/, 'activar'],
    [/^borr/, 'borrar'],
    [/^crea|^creo/, 'crear'],
    [/^edit/, 'editar'],
    [/^elimin/, 'eliminar'],
    [/^marc/, 'marcar'],
    [/^registr/, 'registrar'],
];

function canonicalToken(token: string): string {
    const verb = VERB_STEMS.find(([pattern]) => pattern.test(token));
    if (verb) return verb[1];
    if (token.length > 4 && token.endsWith('s')) return token.slice(0, -1);
    return token;
}

function canonicalTokens(value: string): string[] {
    return normalizarTextoSoporte(value)
        .split(' ')
        .filter(token => token.length > 2 && !STOP_WORDS.has(token))
        .map(canonicalToken);
}

function includesPhrase(text: string, phrase: string): boolean {
    const normalizedPhrase = normalizarTextoSoporte(phrase);
    if (text.includes(normalizedPhrase)) return true;
    const textTokens = new Set(canonicalTokens(text));
    const phraseTokens = canonicalTokens(phrase);
    return phraseTokens.length > 0 && phraseTokens.every(token => textTokens.has(token));
}

function tokenOverlap(text: string, values: string[]): number {
    const textTokens = new Set(canonicalTokens(text));
    const valueTokens = new Set(values.flatMap(canonicalTokens));
    if (textTokens.size === 0) return 0;
    const matches = [...textTokens].filter(token => valueTokens.has(token)).length;
    return matches / textTokens.size;
}

function scoreEntry(text: string, entry: EntradaCatalogoSoporte): number {
    const aliases = entry.aliases.filter(alias => includesPhrase(text, alias));
    const aliasScore = aliases.reduce((best, alias) => {
        const words = normalizarTextoSoporte(alias).split(' ').length;
        return Math.max(best, words > 1 ? 0.68 : 0.42);
    }, 0);
    const actionScore = entry.actions.some(action => includesPhrase(text, action)) ? 0.24 : 0;
    const moduleScore = includesPhrase(text, entry.module) ? 0.12 : 0;
    const descriptiveScore = tokenOverlap(text, [entry.label, entry.intent, ...entry.aliases]) * 0.24;
    const negativeScore = entry.negativeTerms.some(term => includesPhrase(text, term)) ? 0.55 : 0;

    return roundConfidence(aliasScore + actionScore + moduleScore + descriptiveScore - negativeScore);
}

function buildAnswer(entry: EntradaCatalogoSoporte): string {
    const steps = entry.steps.map((step, index) => `${index + 1}. ${step}`).join(' ');
    const permissionNote = entry.sensitivity === 'privileged'
        ? ' La acción depende de permisos vigentes y no debe asumirse autorizada solo porque aparezca en la interfaz.'
        : '';
    return `${steps} Ruta: ${entry.route}.${permissionNote}`;
}

function scoreAllowedEntries(input: ResolverConsultaLocalInput, text: string): ScoredEntry[] {
    if (input.catalog.roles[input.role]?.status !== 'active') return [];
    return input.catalog.entries
        .filter(entry => entry.status === 'active' && entry.roles.includes(input.role))
        .map(entry => ({ entry, score: scoreEntry(text, entry) }))
        .sort((left, right) => right.score - left.score || left.entry.id.localeCompare(right.entry.id));
}

export function resolverConsultaLocal(input: ResolverConsultaLocalInput): ResultadoSoporteLocal {
    const question = normalizarTextoSoporte(input.question);
    const directScores = scoreAllowedEntries(input, question);
    const directBest = directScores[0];
    let ranked = directScores;

    if ((!directBest || directBest.score < LOCAL_ANSWER_THRESHOLD) && preguntaUsaContinuidad(input.question)) {
        const contextScores = scoreAllowedEntries(input, input.context.normalizedText);
        const contextById = new Map(contextScores.map(item => [item.entry.id, item.score]));
        ranked = directScores
            .map(item => ({
                entry: item.entry,
                score: roundConfidence(Math.max(item.score, (contextById.get(item.entry.id) ?? 0) * 0.9)),
            }))
            .sort((left, right) => right.score - left.score || left.entry.id.localeCompare(right.entry.id));
    }

    const best = ranked[0];
    const candidates = ranked
        .filter(item => item.score >= 0.2)
        .slice(0, 3)
        .map(item => ({
            intentId: item.entry.id,
            label: item.entry.label,
            confidence: item.score,
        }));
    const confidence = best?.score ?? 0;

    if (best && confidence >= LOCAL_ANSWER_THRESHOLD) {
        return {
            state: 'answer',
            source: 'local',
            catalogVersion: input.catalog.catalogVersion,
            confidence,
            intentId: best.entry.id,
            answer: buildAnswer(best.entry),
            route: best.entry.route,
            candidates,
        };
    }

    if (best && confidence >= LOCAL_CLARIFY_THRESHOLD) {
        return {
            state: 'clarify',
            source: 'local',
            catalogVersion: input.catalog.catalogVersion,
            confidence,
            answer: `Encontré varias opciones. Indica la pantalla y la acción exacta: ${candidates.map(item => item.label).join(', ')}.`,
            candidates,
        };
    }

    return {
        state: 'fallback',
        source: 'local',
        catalogVersion: input.catalog.catalogVersion,
        confidence,
        answer: 'No encontré una coincidencia segura. Indica el nombre del módulo, la pantalla y la acción exacta.',
        candidates,
    };
}
