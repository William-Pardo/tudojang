// Fixture: marcador-sin-selfref
// La entrada declara sourceFiles apuntando a OTRO archivo, nunca a este mismo
// (VistaSinSelfref.tsx). D9 exige que el propio archivo del marcador este en su
// sourceFiles -- esto cierra de raiz la clase de bug de vistas/Horarios.tsx (entrada
// huerfana apuntando a un archivo que ya no es el que la declara, ver proposal.md).
// Usado por scripts/catalogo-marcadores.test.js para el caso de falla del chequeo de
// autorreferencia.
import React from 'react';
import type { MarcadorSoporte } from '../../../../shared/soporte/tipos';

export const soporteMeta: MarcadorSoporte[] = [
    {
        id: 'fixture.sinSelfref',
        inventoryId: 'fixture.sinSelfref',
        module: 'fixture',
        label: 'Vista sin autorreferencia de fixture',
        intent: 'Orientar sobre la vista sin autorreferencia de fixture.',
        aliases: ['vista sin selfref'],
        actions: ['consultar'],
        negativeTerms: [],
        roles: ['Admin'],
        steps: ['Abre la vista sin autorreferencia de fixture.'],
        route: '/fixture-sin-selfref',
        sensitivity: 'internal',
        escalationReason: 'Escalar si la pantalla no coincide con estos pasos.',
        sourceFiles: ['OtraVistaQueNoEsEsta.tsx'],
        authorizationRef: 'Visibilidad de UI inventariada; autorizacion backend/reglas no verificada.',
        owner: 'Fixture catalogo-gate',
        lastVerifiedAt: '2026-07-30',
        status: 'active',
    },
];

const VistaSinSelfref: React.FC = () => <div>Vista sin autorreferencia de fixture</div>;

export default VistaSinSelfref;
