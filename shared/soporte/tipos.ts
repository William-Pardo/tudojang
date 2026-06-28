export type RolSoporte =
    | 'Admin'
    | 'Editor'
    | 'Asistente'
    | 'Tutor'
    | 'SuperAdmin'
    | 'Estudiante'
    | 'Publico';

export type EstadoRolSoporte = 'active' | 'reserved';
export type SensibilidadSoporte = 'public' | 'internal' | 'sensitive' | 'privileged';

export interface DefinicionRolSoporte {
    status: EstadoRolSoporte;
    description: string;
}

export interface EntradaCatalogoSoporte {
    id: string;
    inventoryId: string;
    module: string;
    label: string;
    intent: string;
    aliases: string[];
    actions: string[];
    negativeTerms: string[];
    roles: RolSoporte[];
    steps: string[];
    route: string;
    sensitivity: SensibilidadSoporte;
    escalationReason: string;
    sourceFiles: string[];
    authorizationRef: string;
    owner: string;
    introducedIn: string;
    lastVerifiedAt: string;
    status: 'active' | 'reserved';
}

export interface CatalogoSoporte {
    schemaVersion: number;
    catalogVersion: string;
    lastVerifiedAt: string;
    roles: Record<RolSoporte, DefinicionRolSoporte>;
    routes: string[];
    entries: EntradaCatalogoSoporte[];
}

export interface TurnoSoporte {
    role: 'user' | 'assistant';
    text: string;
}

export type HistorialSoporteInput = string | TurnoSoporte[];

export interface ContextoSoporte {
    turns: TurnoSoporte[];
    normalizedText: string;
}

export interface CandidatoSoporte {
    intentId: string;
    label: string;
    confidence: number;
}

export interface ResultadoSoporteLocal {
    state: 'answer' | 'clarify' | 'fallback';
    source: 'local';
    catalogVersion: string;
    confidence: number;
    intentId?: string;
    answer: string;
    route?: string;
    candidates?: CandidatoSoporte[];
}

export interface ResolverConsultaLocalInput {
    question: string;
    role: RolSoporte;
    context: ContextoSoporte;
    catalog: CatalogoSoporte;
}
