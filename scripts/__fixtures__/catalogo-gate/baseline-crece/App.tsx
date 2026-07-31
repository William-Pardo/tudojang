// Fixture: baseline-crece/App.tsx
// Sin rutas: este fixture solo existe para que scripts/verificar-rutas-soporte.test.js pueda
// invocar el gate CLI completo (--source-root apuntando aca) y ejercitar el chequeo de
// crecimiento de la linea base (D6, escenario 'f') sin que ningun otro chequeo (cobertura,
// roles, rutas de marcador) interfiera -- no hay <Route> ni marcadores que evaluar.
import React from 'react';
import * as ReactRouterDOM from 'react-router-dom';

const AppRoutes: React.FC = () => <ReactRouterDOM.Routes />;

export default AppRoutes;
