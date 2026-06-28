export interface BanderasAsistente {
    catalogEnabled: boolean;
    aiEnabled: boolean;
    escalationEnabled: boolean;
}

const activa = (value: string | undefined, defaultValue: boolean) =>
    value === undefined ? defaultValue : value === 'true';

export function obtenerBanderasAsistente(): BanderasAsistente {
    const overrides = typeof window !== 'undefined'
        ? (window as typeof window & { __ASSISTANT_FLAGS__?: Partial<BanderasAsistente> }).__ASSISTANT_FLAGS__
        : undefined;
    return {
        catalogEnabled: overrides?.catalogEnabled
            ?? activa(process.env.VITE_ASSISTANT_CATALOG_V1, true),
        aiEnabled: overrides?.aiEnabled
            ?? activa(process.env.VITE_ASSISTANT_AI_ENABLED, false),
        escalationEnabled: overrides?.escalationEnabled
            ?? activa(process.env.VITE_ASSISTANT_ESCALATION_ENABLED, true),
    };
}
