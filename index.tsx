// index.tsx
// Este es el punto de entrada principal para la aplicación de React.
// Se encarga de renderizar el componente `App` en el DOM.

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Buscamos el elemento raíz en el `index.html`.
const rootElement = document.getElementById('root');

// Es una buena práctica asegurarse de que el elemento raíz exista antes de intentar renderizar.
if (!rootElement) {
  throw new Error("No se pudo encontrar el elemento raíz ('root') en el DOM.");
}

// Utilizamos la API `createRoot` de React 18 para la renderización.
const root = ReactDOM.createRoot(rootElement);

// Renderizamos el componente principal `App` dentro de `React.StrictMode`
// para obtener advertencias adicionales sobre posibles problemas en la aplicación.
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);