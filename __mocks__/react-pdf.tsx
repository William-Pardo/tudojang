import React from 'react';

// Mock global (jest recoge automáticamente __mocks__/<paquete-de-node_modules> sin
// necesidad de jest.mock() explícito por archivo -- mismo patrón que framer-motion.tsx).
// pdfjs-dist no corre en jsdom (necesita worker real + canvas), así que en tests
// simulamos un documento de 5 páginas fijo y no renderizamos contenido real.

export const pdfjs = {
  GlobalWorkerOptions: { workerSrc: '' },
};

const NUM_PAGINAS_MOCK = 5;

export const Document: React.FC<{
  file?: string;
  onLoadSuccess?: (info: { numPages: number }) => void;
  onLoadError?: (err: Error) => void;
  children?: React.ReactNode;
}> = ({ file, onLoadSuccess, children }) => {
  React.useEffect(() => {
    if (file) onLoadSuccess?.({ numPages: NUM_PAGINAS_MOCK });
  }, [file, onLoadSuccess]);

  return <div data-testid="mock-pdf-document">{children}</div>;
};

export const Page: React.FC<{ pageNumber?: number }> = ({ pageNumber }) => (
  <div data-testid="mock-pdf-page">Pagina mock {pageNumber}</div>
);
