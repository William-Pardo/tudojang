// Fixture: app-rutas/App.tsx
// Arbol reducido -- NO el App.tsx real -- que reproduce los patrones concretos que
// leerRutasApp() debe resolver (ver design.md, "Escaneo de App.tsx"):
//   - paths literales (`path="/simple"`)
//   - comodin "*" excluido explicitamente
//   - ruta de layout sin `path` (se salta, igual que la l.634 del App.tsx real)
//   - `element` con ternario: el subarbol COMPLETO debe recolectarse, no solo la
//     primera rama (analogo a /jornadas, /agenda, /configuracion, /login reales)
//   - dos rutas -> mismo archivo (relacion N:M real, analogo a FirmaImagen.tsx)
//   - componente declarado localmente (sin ImportDeclaration) -> debe mapear a este
//     mismo archivo, igual que RutaInicial/AppLayout en el App.tsx real
// Deliberadamente solo este archivo (sin arbol de vistas/ que lo acompane, por
// alcance de la Fase 1 -- andamiaje puro): los specifiers de import de abajo no
// resuelven a archivos reales en este fixture. Si leerRutasApp() termina necesitando
// resolucion real via existsSync sobre archivos que existen, la Fase 2 (RED de
// scripts/rutas-app.test.js) debe agregar los stubs que le falten.
import React from 'react';
import * as ReactRouterDOM from 'react-router-dom';

import VistaSimple from './vistas/VistaSimple';
import VistaConTernario from './vistas/VistaConTernario';
import VistaCompartida from './vistas/VistaCompartida';

// Componente local: no tiene ImportDeclaration asociada, debe mapear a este archivo.
const ComponenteLocal: React.FC = () => <div>Componente local de fixture</div>;

const AppRoutes: React.FC = () => {
    const autenticado = true;

    return (
        <ReactRouterDOM.Routes>
            <ReactRouterDOM.Route path="/" element={<ComponenteLocal />} />
            <ReactRouterDOM.Route path="/simple" element={<VistaSimple />} />
            {/* Ternario: element resuelve a VistaConTernario o a un Navigate, segun
                autenticado. leerRutasApp() debe recolectar AMBOS tags JSX del
                subarbol, no solo el primero. */}
            <ReactRouterDOM.Route
                path="/con-ternario"
                element={autenticado ? <VistaConTernario /> : <ReactRouterDOM.Navigate to="/" />}
            />
            {/* Dos rutas distintas -> mismo archivo. */}
            <ReactRouterDOM.Route path="/compartida" element={<VistaCompartida />} />
            <ReactRouterDOM.Route path="/compartida-alias" element={<VistaCompartida />} />
            {/* Ruta de layout sin `path`: se salta (no es una ruta enrutable en si
                misma, solo envuelve a sus hijas). */}
            <ReactRouterDOM.Route element={autenticado ? <ComponenteLocal /> : <ReactRouterDOM.Navigate to="/simple" />}>
                <ReactRouterDOM.Route path="/anidada" element={<VistaSimple />} />
            </ReactRouterDOM.Route>
            {/* Comodin: excluido explicitamente, nunca se reporta como ruta real. */}
            <ReactRouterDOM.Route path="*" element={<ReactRouterDOM.Navigate to="/" />} />
        </ReactRouterDOM.Routes>
    );
};

export default AppRoutes;
