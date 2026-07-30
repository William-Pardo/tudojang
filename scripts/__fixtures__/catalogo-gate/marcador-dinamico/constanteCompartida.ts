// Fixture: marcador-dinamico (constante compartida)
// Constante importada que VistaDinamica.tsx desparrama (spread) dentro de su
// soporteMeta. D3 no evalua imports -- el evaluador estatico del escaneo nunca ejecuta
// el modulo, asi que no puede "ver" el valor real de este identificador. Por eso el
// caso debe fallar duro con archivo:linea:columna en vez de perder el campo en
// silencio.
export const ENTRADA_BASE = {
    module: 'fixture',
    label: 'Vista dinamica de fixture',
    intent: 'Orientar sobre la vista dinamica de fixture.',
    aliases: ['vista dinamica'],
    actions: ['consultar'],
    negativeTerms: [],
    roles: ['Admin'],
    steps: ['Abre la vista dinamica de fixture.'],
    sensitivity: 'internal',
    escalationReason: 'Escalar si la pantalla no coincide con estos pasos.',
    authorizationRef: 'Visibilidad de UI inventariada; autorizacion backend/reglas no verificada.',
    owner: 'Fixture catalogo-gate',
    lastVerifiedAt: '2026-07-30',
    status: 'active',
};
