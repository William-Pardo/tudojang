// Fixture: marcador-dinamico
// soporteMeta NO es un literal auto-contenido: desparrama (...) una constante
// importada dentro del objeto de la entrada. D3 exige literal string/number/boolean/
// null, array u objeto -- identificador, spread, llamada, template con sustitucion o
// clave computada deben fallar duro con archivo:linea:columna y SyntaxKind. Usado por
// scripts/catalogo-marcadores.test.js para el caso de falla del evaluador AST.
import React from 'react';
import { ENTRADA_BASE } from './constanteCompartida';

// Deliberadamente sin `: MarcadorSoporte[]`: este literal invalido tampoco satisface
// el contrato tipado (le faltan campos que ENTRADA_BASE no puede completar en
// compile-time), y no queremos fingir que es un marcador valido.
export const soporteMeta = [
    {
        ...ENTRADA_BASE,
        id: 'fixture.dinamico',
        inventoryId: 'fixture.dinamico',
        route: '/fixture-dinamico',
        sourceFiles: ['VistaDinamica.tsx'],
    },
];

const VistaDinamica: React.FC = () => <div>Vista dinamica de fixture</div>;

export default VistaDinamica;
