// Fixture: gate-sin-cobertura/App.tsx
// Una unica ruta real, montando un archivo SIN marcador ni entrada manual y AUSENTE de la
// linea base de deuda -- debe hacer fallar al gate (escenario 'a' de la spec
// catalogo-soporte-antideriva: "Archivo enrutado sin cobertura").
import React from 'react';
import * as ReactRouterDOM from 'react-router-dom';

import VistaHuerfana from './vistas/VistaHuerfana';

const AppRoutes: React.FC = () => (
    <ReactRouterDOM.Routes>
        <ReactRouterDOM.Route path="/huerfano" element={<VistaHuerfana />} />
    </ReactRouterDOM.Routes>
);

export default AppRoutes;
