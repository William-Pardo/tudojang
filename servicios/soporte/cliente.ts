import { httpsCallable } from 'firebase/functions';
import { getAppFunctions } from '../../firebase/functions';
import { CATALOGO_SOPORTE_V1 } from '../../shared/soporte/catalogo.v1';
import type { HistorialSoporteInput, RolSoporte } from '../../shared/soporte/tipos';
import { prepararContextoSoporte } from './contexto';
import { resolverConsultaLocal } from './matcher';
import { obtenerBanderasAsistente } from './flags';

export interface ResultadoConsultaSoporte {
    state: 'answer' | 'clarify' | 'quota_exhausted' | 'unavailable';
    source: 'local' | 'ai' | 'human';
    answer: string;
    catalogVersion?: string;
    confidence?: number;
    remaining?: { user: number | null; tenant: number | null; global: number | null } | null;
    canEscalate?: boolean;
}

interface ConsultaSoporteInput {
    question: string;
    role: RolSoporte;
    context: HistorialSoporteInput;
}

const codigosCuota = new Set(['functions/resource-exhausted', 'resource-exhausted']);

export async function consultarSoporte(input: ConsultaSoporteInput): Promise<ResultadoConsultaSoporte> {
    const flags = obtenerBanderasAsistente();
    const context = prepararContextoSoporte(input.context);
    const local = resolverConsultaLocal({
        question: input.question,
        role: input.role,
        context,
        catalog: CATALOGO_SOPORTE_V1,
    });

    if (flags.catalogEnabled && local.state !== 'fallback') {
        return {
            state: local.state,
            source: 'local',
            answer: local.answer,
            catalogVersion: local.catalogVersion,
            confidence: local.confidence,
            remaining: null,
        };
    }

    if (!flags.aiEnabled) {
        return {
            state: 'unavailable',
            source: 'human',
            answer: 'La IA está desactivada temporalmente. El manual local continúa disponible.',
            canEscalate: flags.escalationEnabled,
        };
    }

    const intentIds = local.candidates?.map(candidate => candidate.intentId) ?? [];
    if (intentIds.length === 0) {
        intentIds.push(
            ...CATALOGO_SOPORTE_V1.entries
                .filter(entry => entry.status === 'active' && entry.roles.includes(input.role))
                .slice(0, 3)
                .map(entry => entry.id),
        );
    }

    try {
        const localAssistantUrl = process.env.VITE_ASSISTANT_LOCAL_URL;
        if (localAssistantUrl) {
            const response = await fetch(`${localAssistantUrl.replace(/\/$/, '')}/consultarAsistenteIa`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    data: {
                        question: input.question,
                        context: context.turns,
                        intentIds,
                        role: input.role,
                    },
                }),
            });
            const payload = await response.json();
            if (!response.ok) throw payload?.error ?? new Error('Local assistant failed');
            const data = payload.data ?? payload.result;
            return {
                ...data,
                state: data.source === 'ai' ? 'answer' : 'unavailable',
                canEscalate: data.source === 'human',
            };
        }

        const callable = httpsCallable<
            { question: string; context: unknown[]; intentIds: string[] },
            Omit<ResultadoConsultaSoporte, 'state'> & { source: 'ai' | 'human' }
        >(getAppFunctions(), 'consultarAsistenteIa');
        const response = await callable({
            question: input.question,
            context: context.turns,
            intentIds,
        });
        const data = response.data;
        return {
            ...data,
            state: data.source === 'ai' ? 'answer' : 'unavailable',
            canEscalate: data.source === 'human',
        };
    } catch (error: any) {
        if (codigosCuota.has(error?.code)) {
            return {
                state: 'quota_exhausted',
                source: 'human',
                answer: 'La cuota de IA está agotada. El manual local continúa disponible y puedes solicitar soporte humano.',
                remaining: { user: 0, tenant: null, global: null },
                canEscalate: true,
            };
        }
        return {
            state: 'unavailable',
            source: 'human',
            answer: 'La IA no está disponible en este momento. Puedo seguir orientándote con el manual o escalar tu solicitud.',
            canEscalate: true,
        };
    }
}
