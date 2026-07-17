// Aislado en su propio módulo porque usa `import.meta.url` (sintaxis ESM que ts-jest/CommonJS
// no puede parsear) -- en tests, jest.config.js mapea este import a un no-op
// (components/academico/pdfWorkerConfig.mock.ts) vía moduleNameMapper.
import { pdfjs } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();
