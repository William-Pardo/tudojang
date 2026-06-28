# Registro de Cobertura por Vertical

| Vertical | Cobertura líneas % | Fecha ISO | Commit SHA |
|----------|-------------------|-----------|------------|

Servicios — usuariosApi	100 % (statements, branches, functions, lines)	2026‑06‑22	16cedc5 (working tree)
Componentes — EstadoPagoBadge	100 % (statements, branches, functions, lines)	2026‑06‑22	Este commit
Vistas	90.45%

 PASS  vistas/Finanzas.test.tsx (13.387 s)
---------------------|---------|----------|---------|---------|--------------------------------File                 | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s              
---------------------|---------|----------|---------|---------|--------------------------------All files            |    90.3 |     94.8 |   66.12 |   94.51 |                                
 Tudojang            |     100 |      100 |     100 |     100 |                                
  constantes.ts      |     100 |      100 |     100 |     100 |                                
  tipos.ts           |     100 |      100 |     100 |     100 |                                
 Tudojang/components |   77.97 |       50 |   32.07 |   86.07 |                                
  FormInputError.tsx |   85.71 |      100 |     100 |   83.33 | 11                             
  Iconos.tsx         |   77.07 |        0 |   29.41 |   85.71 | ...0,92,99,141,147,153,159,169 
  LogoOficialSVG.tsx |     100 |      100 |     100 |     100 |                                
 Tudojang/utils      |   53.84 |        0 |   33.33 |   44.44 |                                
  formatters.ts      |   53.84 |        0 |   33.33 |   44.44 | 10-12,24-28                    
 Tudojang/vistas     |   97.67 |    96.63 |   92.45 |   97.44 |                                
  Estudiantes.tsx    |     100 |      100 |     100 |     100 |                                
  Finanzas.tsx       |     100 |      100 |     100 |     100 |                                
  Login.tsx          |      80 |    66.66 |   33.33 |   79.16 | 33-34,73-100 


Refactors Estudiantes	98%

File                       | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s        
---------------------------|---------|----------|---------|---------|--------------------------All files                  |   91.79 |    92.89 |   74.56 |   94.48 |                          
 Tudojang                  |     100 |      100 |     100 |     100 |                          
  constantes.ts            |     100 |      100 |     100 |     100 |                          
  tipos.ts                 |     100 |      100 |     100 |     100 |                          
 Tudojang/components       |   89.34 |    97.18 |      66 |   94.85 |                          
  EstadoPagoBadge.tsx      |     100 |    66.66 |     100 |     100 | 13                       
  FilaEstudiante.tsx       |     100 |      100 |     100 |     100 |                          
  FiltrosEstudiantes.tsx   |     100 |      100 |     100 |     100 |                          
  FormInputError.tsx       |     100 |      100 |     100 |     100 |                          
  FormularioEstudiante.tsx |     100 |      100 |     100 |     100 |                          
  Iconos.tsx               |   78.34 |        0 |   33.33 |   84.28 | ...9,141,147,153,159,169 
  LogoOficialSVG.tsx       |     100 |      100 |     100 |     100 |                          
  TablaEstudiantes.tsx     |     100 |      100 |     100 |     100 |                          
 Tudojang/context          |   47.82 |        0 |    12.5 |      50 |                          
  NotificacionContext.tsx  |   47.82 |        0 |    12.5 |      50 | 26,30-35,49-53           
 Tudojang/hooks            |     100 |       25 |     100 |     100 |                          
  useEstadoPago.ts         |     100 |       25 |     100 |     100 | 38-39                    
 Tudojang/servicios        |   98.57 |    96.29 |     100 |   98.29 |                          
  estudiantesApi.ts        |   98.07 |    94.44 |     100 |   97.64 | 30-31                    
  pagosEstudiantesApi.ts   |     100 |      100 |     100 |     100 |                          
 Tudojang/utils            |   73.17 |    46.15 |   72.72 |   68.96 |                          
  calculations.ts          |   76.19 |       50 |   83.33 |   73.33 | 26,41-43                 
  finanzas.ts              |     100 |      100 |     100 |     100 |                          
  formatters.ts            |   53.84 |        0 |   33.33 |   44.44 | 10-12,24-28              
 Tudojang/vistas           |     100 |      100 |     100 |     100 |                          
  Estudiantes.tsx          |     100 |      100 |     100 |     100 |                          
---------------------------|---------|----------|---------|---------|-------------------------

          |                     ^
      256 |             root.unmount();
      257 |             if (document.body.contains(contenedor)) document.body.removeChild(contenedor);
      258 |             return null;

      at error (components/ComprobantesPago.tsx:255:21)
      at Object.compartirPorWhatsApp (components/ComprobantesPago.tsx:288:25)

 PASS  servicios/estudiantesApi.test.ts
 PASS  vistas/Login.test.tsx (5.753 s)
 PASS  components/GeneradorQR.test.tsx
 PASS  servicios/leadsEventosApi.test.ts
 PASS  servicios/pagosEstudiantesApi.test.ts
 PASS  servicios/pagosApi.complementaria.test.ts
  ● Console

    console.error
      Error cargando evento ev2

      127 |             }
      128 |         } catch (e) {
    > 129 |             console.error("Error cargando evento", evId);
          |                     ^
      130 |         }
      131 |     }));
      132 |

      at error (servicios/pagosApi.ts:129:21)
          at async Promise.all (index 1)
      at obtenerDeudasEstudiante (servicios/pagosApi.ts:121:5)
      at Object.<anonymous> (servicios/pagosApi.complementaria.test.ts:42:17)

    console.error
      Error al procesar pago: Error: Estudiante no encontrado
          at procesarPagoEfectivo (E:\Apps\Tudojang\servicios\pagosApi.ts:198:38)
          at processTicksAndRejections (node:internal/process/task_queues:104:5)
          at Object.<anonymous> (E:\Apps\Tudojang\servicios\pagosApi.complementaria.test.ts:78:12)

      280 |
      281 |     } catch (error: any) {
    > 282 |         console.error("Error al procesar pago:", error);
          |                 ^
      283 |         return { exito: false, mensaje: error.message };
      284 |     }
      285 | };

      at error (servicios/pagosApi.ts:282:17)
      at Object.<anonymous> (servicios/pagosApi.complementaria.test.ts:78:12)

    console.error
      Error al procesar pago: Error: Escritura falló
          at Object.<anonymous> (E:\Apps\Tudojang\servicios\pagosApi.complementaria.test.ts:80:40)
          at processTicksAndRejections (node:internal/process/task_queues:104:5)

      280 |
      281 |     } catch (error: any) {
    > 282 |         console.error("Error al procesar pago:", error);
          |                 ^
      283 |         return { exito: false, mensaje: error.message };
      284 |     }
      285 | };

      at error (servicios/pagosApi.ts:282:17)
      at Object.<anonymous> (servicios/pagosApi.complementaria.test.ts:81:12)

    console.error
      Error al anular pago: Error: Transacción no encontrada
          at anularPagoEfectivo (E:\Apps\Tudojang\servicios\pagosApi.ts:306:19)
          at processTicksAndRejections (node:internal/process/task_queues:104:5)
          at Object.<anonymous> (E:\Apps\Tudojang\servicios\pagosApi.complementaria.test.ts:97:12)

      364 |
      365 |     } catch (error: any) {
    > 366 |         console.error("Error al anular pago:", error);
          |                 ^
      367 |         return { exito: false, mensaje: error.message };
      368 |     }
      369 | };

      at error (servicios/pagosApi.ts:366:17)
      at Object.<anonymous> (servicios/pagosApi.complementaria.test.ts:97:12)

    console.error
      Error al anular pago: Error: Commit falló
          at Object.<anonymous> (E:\Apps\Tudojang\servicios\pagosApi.complementaria.test.ts:101:40)
          at processTicksAndRejections (node:internal/process/task_queues:104:5)

      364 |
      365 |     } catch (error: any) {
    > 366 |         console.error("Error al anular pago:", error);
          |                 ^
      367 |         return { exito: false, mensaje: error.message };
      368 |     }
      369 | };

      at error (servicios/pagosApi.ts:366:17)
      at Object.<anonymous> (servicios/pagosApi.complementaria.test.ts:102:12)

    console.error
      Error al anular pago: Error: Transacción no encontrada
          at anularPagoEfectivo (E:\Apps\Tudojang\servicios\pagosApi.ts:306:19)
          at processTicksAndRejections (node:internal/process/task_queues:104:5)
          at anularUltimoPagoEfectivo (E:\Apps\Tudojang\servicios\pagosApi.ts:401:16)
          at Object.<anonymous> (E:\Apps\Tudojang\servicios\pagosApi.complementaria.test.ts:110:12)

      364 |
      365 |     } catch (error: any) {
    > 366 |         console.error("Error al anular pago:", error);
          |                 ^
      367 |         return { exito: false, mensaje: error.message };
      368 |     }
      369 | };

      at error (servicios/pagosApi.ts:366:17)
      at anularUltimoPagoEfectivo (servicios/pagosApi.ts:401:16)
      at Object.<anonymous> (servicios/pagosApi.complementaria.test.ts:110:12)

    console.error
      Error al buscar último pago: Error: No hay pagos recientes para anular.
          at anularUltimoPagoEfectivo (E:\Apps\Tudojang\servicios\pagosApi.ts:392:19)
          at processTicksAndRejections (node:internal/process/task_queues:104:5)
          at Object.<anonymous> (E:\Apps\Tudojang\servicios\pagosApi.complementaria.test.ts:112:12)

      402 |         
      403 |     } catch (error: any) {
    > 404 |         console.error("Error al buscar último pago:", error);
          |                 ^
      405 |         return { exito: false, mensaje: error.message };
      406 |     }
      407 | };

      at error (servicios/pagosApi.ts:404:17)
      at Object.<anonymous> (servicios/pagosApi.complementaria.test.ts:112:12)

    console.error
      Error al buscar último pago: Error: Consulta falló
          at Object.<anonymous> (E:\Apps\Tudojang\servicios\pagosApi.complementaria.test.ts:113:50)
          at processTicksAndRejections (node:internal/process/task_queues:104:5)

      402 |         
      403 |     } catch (error: any) {
    > 404 |         console.error("Error al buscar último pago:", error);
          |                 ^
      405 |         return { exito: false, mensaje: error.message };
      406 |     }
      407 | };

      at error (servicios/pagosApi.ts:404:17)
      at Object.<anonymous> (servicios/pagosApi.complementaria.test.ts:114:12)

 PASS  components/TablaEstudiantes.test.tsx
 PASS  servicios/asistenciaApi.test.ts
 PASS  servicios/pagosApi.test.ts
  ● Console

    console.error
      Error al procesar pago: Error: Fallo de red simulado
          at Object.<anonymous> (E:\Apps\Tudojang\servicios\pagosApi.test.ts:95:53)
          at Promise.then.completed (E:\Apps\Tudojang\node_modules\jest-circus\build\utils.js:298:28)
          at new Promise (<anonymous>)
          at callAsyncCircusFn (E:\Apps\Tudojang\node_modules\jest-circus\build\utils.js:231:10)
          at _callCircusTest (E:\Apps\Tudojang\node_modules\jest-circus\build\run.js:316:40)
          at processTicksAndRejections (node:internal/process/task_queues:104:5)
          at _runTest (E:\Apps\Tudojang\node_modules\jest-circus\build\run.js:252:3)
          at _runTestsForDescribeBlock (E:\Apps\Tudojang\node_modules\jest-circus\build\run.js:126:9)
          at _runTestsForDescribeBlock (E:\Apps\Tudojang\node_modules\jest-circus\build\run.js:121:9)
          at _runTestsForDescribeBlock (E:\Apps\Tudojang\node_modules\jest-circus\build\run.js:121:9)
          at run (E:\Apps\Tudojang\node_modules\jest-circus\build\run.js:71:3)
          at runAndTransformResultsToJestFormat (E:\Apps\Tudojang\node_modules\jest-circus\build\legacy-code-todo-rewrite\jestAdapterInit.js:122:21)
          at jestAdapter (E:\Apps\Tudojang\node_modules\jest-circus\build\legacy-code-todo-rewrite\jestAdapter.js:79:19)
          at runTestInternal (E:\Apps\Tudojang\node_modules\jest-runner\build\runTest.js:367:16)
          at runTest (E:\Apps\Tudojang\node_modules\jest-runner\build\runTest.js:444:34)
          at Object.worker (E:\Apps\Tudojang\node_modules\jest-runner\build\testWorker.js:106:12)

      280 |
      281 |     } catch (error: any) {
    > 282 |         console.error("Error al procesar pago:", error);
          |                 ^
      283 |         return { exito: false, mensaje: error.message };
      284 |     }
      285 | };

      at error (servicios/pagosApi.ts:282:17)
      at Object.<anonymous> (servicios/pagosApi.test.ts:97:25)

    console.error
      Error al anular pago: Error: La transacción ya se encuentra anulada
          at anularPagoEfectivo (E:\Apps\Tudojang\servicios\pagosApi.ts:312:19)
          at processTicksAndRejections (node:internal/process/task_queues:104:5)
          at Object.<anonymous> (E:\Apps\Tudojang\servicios\pagosApi.test.ts:157:25)

      364 |
      365 |     } catch (error: any) {
    > 366 |         console.error("Error al anular pago:", error);
          |                 ^
      367 |         return { exito: false, mensaje: error.message };
      368 |     }
      369 | };

      at error (servicios/pagosApi.ts:366:17)
      at Object.<anonymous> (servicios/pagosApi.test.ts:157:25)


Summary of all failing tests
 FAIL  servicios/configuracionApi.test.ts (5.798 s)
  ● configuracionApi › obtenerConfiguracionNotificaciones › debería retornar la configuración por defecto si el documento no existe

    TypeError: jest.mocked(...).mockReturnValue is not a function

      27 |   beforeEach(() => {
      28 |     jest.clearAllMocks();
    > 29 |     (jest.mocked(require('../firebase/config').isFirebaseConfigured as jest.Mock) as jest.Mock).mockReturnValue(true);
         |                                                                                                 ^
      30 |     Object.defineProperty(window, 'localStorage', {
      31 |       value: {
      32 |         getItem: jest.fn(),

      at Object.<anonymous> (servicios/configuracionApi.test.ts:29:97)

  ● configuracionApi › obtenerConfiguracionNotificaciones › debería retornar la configuración existente si el documento existe

    TypeError: jest.mocked(...).mockReturnValue is not a function

      27 |   beforeEach(() => {
      28 |     jest.clearAllMocks();
    > 29 |     (jest.mocked(require('../firebase/config').isFirebaseConfigured as jest.Mock) as jest.Mock).mockReturnValue(true);
         |                                                                                                 ^
      30 |     Object.defineProperty(window, 'localStorage', {
      31 |       value: {
      32 |         getItem: jest.fn(),

      at Object.<anonymous> (servicios/configuracionApi.test.ts:29:97)

  ● configuracionApi › obtenerConfiguracionNotificaciones › debería usar localStorage si isFirebaseConfigured es falso

    TypeError: jest.mocked(...).mockReturnValue is not a function

      27 |   beforeEach(() => {
      28 |     jest.clearAllMocks();
    > 29 |     (jest.mocked(require('../firebase/config').isFirebaseConfigured as jest.Mock) as jest.Mock).mockReturnValue(true);
         |                                                                                                 ^
      30 |     Object.defineProperty(window, 'localStorage', {
      31 |       value: {
      32 |         getItem: jest.fn(),

      at Object.<anonymous> (servicios/configuracionApi.test.ts:29:97)

  ● configuracionApi › obtenerConfiguracionNotificaciones › debería usar CONFIGURACION_POR_DEFECTO si localStorage está vacío y isFirebaseConfigured es falso

    TypeError: jest.mocked(...).mockReturnValue is not a function

      27 |   beforeEach(() => {
      28 |     jest.clearAllMocks();
    > 29 |     (jest.mocked(require('../firebase/config').isFirebaseConfigured as jest.Mock) as jest.Mock).mockReturnValue(true);
         |                                                                                                 ^
      30 |     Object.defineProperty(window, 'localStorage', {
      31 |       value: {
      32 |         getItem: jest.fn(),

      at Object.<anonymous> (servicios/configuracionApi.test.ts:29:97)

  ● configuracionApi › guardarConfiguracionNotificaciones › debería guardar la configuración en Firestore

    TypeError: jest.mocked(...).mockReturnValue is not a function

      27 |   beforeEach(() => {
      28 |     jest.clearAllMocks();
    > 29 |     (jest.mocked(require('../firebase/config').isFirebaseConfigured as jest.Mock) as jest.Mock).mockReturnValue(true);
         |                                                                                                 ^
      30 |     Object.defineProperty(window, 'localStorage', {
      31 |       value: {
      32 |         getItem: jest.fn(),

      at Object.<anonymous> (servicios/configuracionApi.test.ts:29:97)

  ● configuracionApi › guardarConfiguracionNotificaciones › debería lanzar un error si no hay tenantId

    TypeError: jest.mocked(...).mockReturnValue is not a function

      27 |   beforeEach(() => {
      28 |     jest.clearAllMocks();
    > 29 |     (jest.mocked(require('../firebase/config').isFirebaseConfigured as jest.Mock) as jest.Mock).mockReturnValue(true);
         |                                                                                                 ^
      30 |     Object.defineProperty(window, 'localStorage', {
      31 |       value: {
      32 |         getItem: jest.fn(),

      at Object.<anonymous> (servicios/configuracionApi.test.ts:29:97)

  ● configuracionApi › guardarConfiguracionNotificaciones › debería guardar en localStorage si isFirebaseConfigured es falso

    TypeError: jest.mocked(...).mockReturnValue is not a function

      27 |   beforeEach(() => {
      28 |     jest.clearAllMocks();
    > 29 |     (jest.mocked(require('../firebase/config').isFirebaseConfigured as jest.Mock) as jest.Mock).mockReturnValue(true);
         |                                                                                                 ^
      30 |     Object.defineProperty(window, 'localStorage', {
      31 |       value: {
      32 |         getItem: jest.fn(),

      at Object.<anonymous> (servicios/configuracionApi.test.ts:29:97)

  ● configuracionApi › buscarTenantPorSlug › debería retornar null si no se encuentra el slug

    TypeError: jest.mocked(...).mockReturnValue is not a function

      27 |   beforeEach(() => {
      28 |     jest.clearAllMocks();
    > 29 |     (jest.mocked(require('../firebase/config').isFirebaseConfigured as jest.Mock) as jest.Mock).mockReturnValue(true);
         |                                                                                                 ^
      30 |     Object.defineProperty(window, 'localStorage', {
      31 |       value: {
      32 |         getItem: jest.fn(),

      at Object.<anonymous> (servicios/configuracionApi.test.ts:29:97)

  ● configuracionApi › buscarTenantPorSlug › debería retornar el tenant si se encuentra el slug
    TypeError: jest.mocked(...).mockReturnValue is not a function

      27 |   beforeEach(() => {
      28 |     jest.clearAllMocks();
    > 29 |     (jest.mocked(require('../firebase/config').isFirebaseConfigured as jest.Mock) as jest.Mock).mockReturnValue(true);
         |                                                                                                 ^
      30 |     Object.defineProperty(window, 'localStorage', {
      31 |       value: {
      32 |         getItem: jest.fn(),

      at Object.<anonymous> (servicios/configuracionApi.test.ts:29:97)

  ● configuracionApi › buscarTenantPorSlug › debería usar el modo mock si isFirebaseConfigured es falso

    TypeError: jest.mocked(...).mockReturnValue is not a function

      27 |   beforeEach(() => {
      28 |     jest.clearAllMocks();
    > 29 |     (jest.mocked(require('../firebase/config').isFirebaseConfigured as jest.Mock) as jest.Mock).mockReturnValue(true);
         |                                                                                                 ^
      30 |     Object.defineProperty(window, 'localStorage', {
      31 |       value: {
      32 |         getItem: jest.fn(),

      at Object.<anonymous> (servicios/configuracionApi.test.ts:29:97)

  ● configuracionApi › buscarTenantPorSlug › debería retornar null en modo mock si el slug no es tudojang ni dragones

    TypeError: jest.mocked(...).mockReturnValue is not a function

      27 |   beforeEach(() => {
      28 |     jest.clearAllMocks();
    > 29 |     (jest.mocked(require('../firebase/config').isFirebaseConfigured as jest.Mock) as jest.Mock).mockReturnValue(true);
         |                                                                                                 ^
      30 |     Object.defineProperty(window, 'localStorage', {
      31 |       value: {
      32 |         getItem: jest.fn(),

      at Object.<anonymous> (servicios/configuracionApi.test.ts:29:97)

  ● configuracionApi › registrarNuevaEscuela › debería registrar una nueva escuela con los datos proporcionados

    TypeError: jest.mocked(...).mockReturnValue is not a function

      27 |   beforeEach(() => {
      28 |     jest.clearAllMocks();
    > 29 |     (jest.mocked(require('../firebase/config').isFirebaseConfigured as jest.Mock) as jest.Mock).mockReturnValue(true);
         |                                                                                                 ^
      30 |     Object.defineProperty(window, 'localStorage', {
      31 |       value: {
      32 |         getItem: jest.fn(),

      at Object.<anonymous> (servicios/configuracionApi.test.ts:29:97)

  ● configuracionApi › registrarNuevaEscuela › debería generar un tenantId si no se proporciona uno

    TypeError: jest.mocked(...).mockReturnValue is not a function

      27 |   beforeEach(() => {
      28 |     jest.clearAllMocks();
    > 29 |     (jest.mocked(require('../firebase/config').isFirebaseConfigured as jest.Mock) as jest.Mock).mockReturnValue(true);
         |                                                                                                 ^
      30 |     Object.defineProperty(window, 'localStorage', {
      31 |       value: {
      32 |         getItem: jest.fn(),

      at Object.<anonymous> (servicios/configuracionApi.test.ts:29:97)

  ● configuracionApi › registrarNuevaEscuela › debería retornar string vacío si isFirebaseConfigured es falso

    TypeError: jest.mocked(...).mockReturnValue is not a function

      27 |   beforeEach(() => {
      28 |     jest.clearAllMocks();
    > 29 |     (jest.mocked(require('../firebase/config').isFirebaseConfigured as jest.Mock) as jest.Mock).mockReturnValue(true);
         |                                                                                                 ^
      30 |     Object.defineProperty(window, 'localStorage', {
      31 |       value: {
      32 |         getItem: jest.fn(),

      at Object.<anonymous> (servicios/configuracionApi.test.ts:29:97)

  ● configuracionApi › obtenerConfiguracionClub › debería retornar CONFIGURACION_CLUB_POR_DEFECTO si no se encuentra el tenantId

    TypeError: jest.mocked(...).mockReturnValue is not a function

      27 |   beforeEach(() => {
      28 |     jest.clearAllMocks();
    > 29 |     (jest.mocked(require('../firebase/config').isFirebaseConfigured as jest.Mock) as jest.Mock).mockReturnValue(true);
         |                                                                                                 ^
      30 |     Object.defineProperty(window, 'localStorage', {
      31 |       value: {
      32 |         getItem: jest.fn(),

      at Object.<anonymous> (servicios/configuracionApi.test.ts:29:97)

  ● configuracionApi › obtenerConfiguracionClub › debería retornar la configuración del club por tenantId

    TypeError: jest.mocked(...).mockReturnValue is not a function

      27 |   beforeEach(() => {
      28 |     jest.clearAllMocks();
    > 29 |     (jest.mocked(require('../firebase/config').isFirebaseConfigured as jest.Mock) as jest.Mock).mockReturnValue(true);
         |                                                                                                 ^
      30 |     Object.defineProperty(window, 'localStorage', {
      31 |       value: {
      32 |         getItem: jest.fn(),

      at Object.<anonymous> (servicios/configuracionApi.test.ts:29:97)

  ● configuracionApi › obtenerConfiguracionClub › debería buscar por slug si no se proporciona tenantId

    TypeError: jest.mocked(...).mockReturnValue is not a function

      27 |   beforeEach(() => {
      28 |     jest.clearAllMocks();
    > 29 |     (jest.mocked(require('../firebase/config').isFirebaseConfigured as jest.Mock) as jest.Mock).mockReturnValue(true);
         |                                                                                                 ^
      30 |     Object.defineProperty(window, 'localStorage', {
      31 |       value: {
      32 |         getItem: jest.fn(),

      at Object.<anonymous> (servicios/configuracionApi.test.ts:29:97)

  ● configuracionApi › obtenerConfiguracionClub › debería usar el modo mock si isFirebaseConfigured es falso

    TypeError: jest.mocked(...).mockReturnValue is not a function

      27 |   beforeEach(() => {
      28 |     jest.clearAllMocks();
    > 29 |     (jest.mocked(require('../firebase/config').isFirebaseConfigured as jest.Mock) as jest.Mock).mockReturnValue(true);
         |                                                                                                 ^
      30 |     Object.defineProperty(window, 'localStorage', {
      31 |       value: {
      32 |         getItem: jest.fn(),

      at Object.<anonymous> (servicios/configuracionApi.test.ts:29:97)

  ● configuracionApi › guardarConfiguracionClub › debería guardar la configuración del club en Firestore

    TypeError: jest.mocked(...).mockReturnValue is not a function

      27 |   beforeEach(() => {
      28 |     jest.clearAllMocks();
    > 29 |     (jest.mocked(require('../firebase/config').isFirebaseConfigured as jest.Mock) as jest.Mock).mockReturnValue(true);
         |                                                                                                 ^
      30 |     Object.defineProperty(window, 'localStorage', {
      31 |       value: {
      32 |         getItem: jest.fn(),

      at Object.<anonymous> (servicios/configuracionApi.test.ts:29:97)

  ● configuracionApi › guardarConfiguracionClub › debería lanzar un error si no hay tenantId

    TypeError: jest.mocked(...).mockReturnValue is not a function

      27 |   beforeEach(() => {
      28 |     jest.clearAllMocks();
    > 29 |     (jest.mocked(require('../firebase/config').isFirebaseConfigured as jest.Mock) as jest.Mock).mockReturnValue(true);
         |                                                                                                 ^
      30 |     Object.defineProperty(window, 'localStorage', {
      31 |       value: {
      32 |         getItem: jest.fn(),

      at Object.<anonymous> (servicios/configuracionApi.test.ts:29:97)

  ● configuracionApi › guardarConfiguracionClub › no debería hacer nada si isFirebaseConfigured es falso

    TypeError: jest.mocked(...).mockReturnValue is not a function

      27 |   beforeEach(() => {
      28 |     jest.clearAllMocks();
    > 29 |     (jest.mocked(require('../firebase/config').isFirebaseConfigured as jest.Mock) as jest.Mock).mockReturnValue(true);
         |                                                                                                 ^
      30 |     Object.defineProperty(window, 'localStorage', {
      31 |       value: {
      32 |         getItem: jest.fn(),

      at Object.<anonymous> (servicios/configuracionApi.test.ts:29:97)

  ● configuracionApi › actualizarCapacidadClub › debería actualizar la capacidad del club en Firestore

    TypeError: jest.mocked(...).mockReturnValue is not a function

      27 |   beforeEach(() => {
      28 |     jest.clearAllMocks();
    > 29 |     (jest.mocked(require('../firebase/config').isFirebaseConfigured as jest.Mock) as jest.Mock).mockReturnValue(true);
         |                                                                                                 ^
      30 |     Object.defineProperty(window, 'localStorage', {
      31 |       value: {
      32 |         getItem: jest.fn(),

      at Object.<anonymous> (servicios/configuracionApi.test.ts:29:97)

  ● configuracionApi › actualizarCapacidadClub › no debería hacer nada si isFirebaseConfigured es falso

    TypeError: jest.mocked(...).mockReturnValue is not a function

      27 |   beforeEach(() => {
      28 |     jest.clearAllMocks();
    > 29 |     (jest.mocked(require('../firebase/config').isFirebaseConfigured as jest.Mock) as jest.Mock).mockReturnValue(true);
         |                                                                                                 ^
      30 |     Object.defineProperty(window, 'localStorage', {
      31 |       value: {
      32 |         getItem: jest.fn(),

      at Object.<anonymous> (servicios/configuracionApi.test.ts:29:97)

  ● configuracionApi › actualizarPlanClub › debería actualizar el plan del club en Firestore

    TypeError: jest.mocked(...).mockReturnValue is not a function

      27 |   beforeEach(() => {
      28 |     jest.clearAllMocks();
    > 29 |     (jest.mocked(require('../firebase/config').isFirebaseConfigured as jest.Mock) as jest.Mock).mockReturnValue(true);
         |                                                                                                 ^
      30 |     Object.defineProperty(window, 'localStorage', {
      31 |       value: {
      32 |         getItem: jest.fn(),

      at Object.<anonymous> (servicios/configuracionApi.test.ts:29:97)

  ● configuracionApi › actualizarPlanClub › no debería hacer nada si isFirebaseConfigured es falso

    TypeError: jest.mocked(...).mockReturnValue is not a function

      27 |   beforeEach(() => {
      28 |     jest.clearAllMocks();
    > 29 |     (jest.mocked(require('../firebase/config').isFirebaseConfigured as jest.Mock) as jest.Mock).mockReturnValue(true);
         |                                                                                                 ^
      30 |     Object.defineProperty(window, 'localStorage', {
      31 |       value: {
      32 |         getItem: jest.fn(),

      at Object.<anonymous> (servicios/configuracionApi.test.ts:29:97)

  ● configuracionApi › obtenerTodosLosTenants › debería retornar todos los tenants de Firestore
    TypeError: jest.mocked(...).mockReturnValue is not a function

      27 |   beforeEach(() => {
      28 |     jest.clearAllMocks();
    > 29 |     (jest.mocked(require('../firebase/config').isFirebaseConfigured as jest.Mock) as jest.Mock).mockReturnValue(true);
         |                                                                                                 ^
      30 |     Object.defineProperty(window, 'localStorage', {
      31 |       value: {
      32 |         getItem: jest.fn(),

      at Object.<anonymous> (servicios/configuracionApi.test.ts:29:97)

  ● configuracionApi › obtenerTodosLosTenants › debería retornar datos mock si isFirebaseConfigured es falso

    TypeError: jest.mocked(...).mockReturnValue is not a function

      27 |   beforeEach(() => {
      28 |     jest.clearAllMocks();
    > 29 |     (jest.mocked(require('../firebase/config').isFirebaseConfigured as jest.Mock) as jest.Mock).mockReturnValue(true);
         |                                                                                                 ^
      30 |     Object.defineProperty(window, 'localStorage', {
      31 |       value: {
      32 |         getItem: jest.fn(),

      at Object.<anonymous> (servicios/configuracionApi.test.ts:29:97)

  ● configuracionApi › cambiarEstadoSuscripcionTenant › debería actualizar el estado de suscripción del tenant en Firestore

    TypeError: jest.mocked(...).mockReturnValue is not a function

      27 |   beforeEach(() => {
      28 |     jest.clearAllMocks();
    > 29 |     (jest.mocked(require('../firebase/config').isFirebaseConfigured as jest.Mock) as jest.Mock).mockReturnValue(true);
         |                                                                                                 ^
      30 |     Object.defineProperty(window, 'localStorage', {
      31 |       value: {
      32 |         getItem: jest.fn(),

      at Object.<anonymous> (servicios/configuracionApi.test.ts:29:97)

  ● configuracionApi › cambiarEstadoSuscripcionTenant › no debería hacer nada si isFirebaseConfigured es falso

    TypeError: jest.mocked(...).mockReturnValue is not a function

      27 |   beforeEach(() => {
      28 |     jest.clearAllMocks();
    > 29 |     (jest.mocked(require('../firebase/config').isFirebaseConfigured as jest.Mock) as jest.Mock).mockReturnValue(true);
         |                                                                                                 ^
      30 |     Object.defineProperty(window, 'localStorage', {
      31 |       value: {
      32 |         getItem: jest.fn(),

      at Object.<anonymous> (servicios/configuracionApi.test.ts:29:97)

 FAIL  servicios/censoApi.test.ts (5.759 s)
  ● censoApi › crearMisionKicho › debería crear una nueva misión Kicho en Firestore

    TypeError: jest.mocked(...).mockReturnValue is not a function

      32 |   beforeEach(() => {
      33 |     jest.clearAllMocks();
    > 34 |     (jest.mocked(require('../firebase/config').isFirebaseConfigured as jest.Mock) as jest.Mock).mockReturnValue(true);
         |                                                                                                 ^
      35 |   });
      36 |
      37 |   describe('crearMisionKicho', () => {

      at Object.<anonymous> (servicios/censoApi.test.ts:34:97)

  ● censoApi › crearMisionKicho › no debería hacer nada si isFirebaseConfigured es falso

    TypeError: jest.mocked(...).mockReturnValue is not a function

      32 |   beforeEach(() => {
      33 |     jest.clearAllMocks();
    > 34 |     (jest.mocked(require('../firebase/config').isFirebaseConfigured as jest.Mock) as jest.Mock).mockReturnValue(true);
         |                                                                                                 ^
      35 |   });
      36 |
      37 |   describe('crearMisionKicho', () => {

      at Object.<anonymous> (servicios/censoApi.test.ts:34:97)

  ● censoApi › obtenerMisiones › debería retornar todas las misiones de Firestore

    TypeError: jest.mocked(...).mockReturnValue is not a function

      32 |   beforeEach(() => {
      33 |     jest.clearAllMocks();
    > 34 |     (jest.mocked(require('../firebase/config').isFirebaseConfigured as jest.Mock) as jest.Mock).mockReturnValue(true);
         |                                                                                                 ^
      35 |   });
      36 |
      37 |   describe('crearMisionKicho', () => {

      at Object.<anonymous> (servicios/censoApi.test.ts:34:97)

  ● censoApi › obtenerMisiones › debería retornar un array vacío si isFirebaseConfigured es falso

    TypeError: jest.mocked(...).mockReturnValue is not a function

      32 |   beforeEach(() => {
      33 |     jest.clearAllMocks();
    > 34 |     (jest.mocked(require('../firebase/config').isFirebaseConfigured as jest.Mock) as jest.Mock).mockReturnValue(true);
         |                                                                                                 ^
      35 |   });
      36 |
      37 |   describe('crearMisionKicho', () => {

      at Object.<anonymous> (servicios/censoApi.test.ts:34:97)

  ● censoApi › obtenerMisionActivaTenant › debería retornar la misión activa para un tenant

    TypeError: jest.mocked(...).mockReturnValue is not a function

      32 |   beforeEach(() => {
      33 |     jest.clearAllMocks();
    > 34 |     (jest.mocked(require('../firebase/config').isFirebaseConfigured as jest.Mock) as jest.Mock).mockReturnValue(true);
         |                                                                                                 ^
      35 |   });
      36 |
      37 |   describe('crearMisionKicho', () => {

      at Object.<anonymous> (servicios/censoApi.test.ts:34:97)

  ● censoApi › obtenerMisionActivaTenant › debería retornar null si no hay misión activa para el tenant

    TypeError: jest.mocked(...).mockReturnValue is not a function

      32 |   beforeEach(() => {
      33 |     jest.clearAllMocks();
    > 34 |     (jest.mocked(require('../firebase/config').isFirebaseConfigured as jest.Mock) as jest.Mock).mockReturnValue(true);
         |                                                                                                 ^
      35 |   });
      36 |
      37 |   describe('crearMisionKicho', () => {

      at Object.<anonymous> (servicios/censoApi.test.ts:34:97)

  ● censoApi › obtenerMisionActivaTenant › debería usar el modo mock si isFirebaseConfigured es falso

    TypeError: jest.mocked(...).mockReturnValue is not a function

      32 |   beforeEach(() => {
      33 |     jest.clearAllMocks();
    > 34 |     (jest.mocked(require('../firebase/config').isFirebaseConfigured as jest.Mock) as jest.Mock).mockReturnValue(true);
         |                                                                                                 ^
      35 |   });
      36 |
      37 |   describe('crearMisionKicho', () => {

      at Object.<anonymous> (servicios/censoApi.test.ts:34:97)

  ● censoApi › registrarAspirantePublico › debería registrar un aspirante y actualizar el contador de la misión

    TypeError: jest.mocked(...).mockReturnValue is not a function

      32 |   beforeEach(() => {
      33 |     jest.clearAllMocks();
    > 34 |     (jest.mocked(require('../firebase/config').isFirebaseConfigured as jest.Mock) as jest.Mock).mockReturnValue(true);
         |                                                                                                 ^
      35 |   });
      36 |
      37 |   describe('crearMisionKicho', () => {

      at Object.<anonymous> (servicios/censoApi.test.ts:34:97)

  ● censoApi › registrarAspirantePublico › no debería hacer nada si isFirebaseConfigured es falso

    TypeError: jest.mocked(...).mockReturnValue is not a function

      32 |   beforeEach(() => {
      33 |     jest.clearAllMocks();
    > 34 |     (jest.mocked(require('../firebase/config').isFirebaseConfigured as jest.Mock) as jest.Mock).mockReturnValue(true);
         |                                                                                                 ^
      35 |   });
      36 |
      37 |   describe('crearMisionKicho', () => {

      at Object.<anonymous> (servicios/censoApi.test.ts:34:97)

  ● censoApi › validarRegistroTemporal › debería actualizar el estado de un registro temporal

    TypeError: jest.mocked(...).mockReturnValue is not a function

      32 |   beforeEach(() => {
      33 |     jest.clearAllMocks();
    > 34 |     (jest.mocked(require('../firebase/config').isFirebaseConfigured as jest.Mock) as jest.Mock).mockReturnValue(true);
         |                                                                                                 ^
      35 |   });
      36 |
      37 |   describe('crearMisionKicho', () => {

      at Object.<anonymous> (servicios/censoApi.test.ts:34:97)

  ● censoApi › validarRegistroTemporal › no debería hacer nada si isFirebaseConfigured es falso
    TypeError: jest.mocked(...).mockReturnValue is not a function

      32 |   beforeEach(() => {
      33 |     jest.clearAllMocks();
    > 34 |     (jest.mocked(require('../firebase/config').isFirebaseConfigured as jest.Mock) as jest.Mock).mockReturnValue(true);
         |                                                                                                 ^
      35 |   });
      36 |
      37 |   describe('crearMisionKicho', () => {

      at Object.<anonymous> (servicios/censoApi.test.ts:34:97)

  ● censoApi › legalizarLoteKicho › debería legalizar un lote Kicho

    TypeError: jest.mocked(...).mockReturnValue is not a function

      32 |   beforeEach(() => {
      33 |     jest.clearAllMocks();
    > 34 |     (jest.mocked(require('../firebase/config').isFirebaseConfigured as jest.Mock) as jest.Mock).mockReturnValue(true);
         |                                                                                                 ^
      35 |   });
      36 |
      37 |   describe('crearMisionKicho', () => {

      at Object.<anonymous> (servicios/censoApi.test.ts:34:97)

  ● censoApi › legalizarLoteKicho › no debería hacer nada si isFirebaseConfigured es falso

    TypeError: jest.mocked(...).mockReturnValue is not a function

      32 |   beforeEach(() => {
      33 |     jest.clearAllMocks();
    > 34 |     (jest.mocked(require('../firebase/config').isFirebaseConfigured as jest.Mock) as jest.Mock).mockReturnValue(true);
         |                                                                                                 ^
      35 |   });
      36 |
      37 |   describe('crearMisionKicho', () => {

      at Object.<anonymous> (servicios/censoApi.test.ts:34:97)

  ● censoApi › inyectarEstudiantesKicho › debería inyectar estudiantes y actualizar la misión y registros

    TypeError: jest.mocked(...).mockReturnValue is not a function

      32 |   beforeEach(() => {
      33 |     jest.clearAllMocks();
    > 34 |     (jest.mocked(require('../firebase/config').isFirebaseConfigured as jest.Mock) as jest.Mock).mockReturnValue(true);
         |                                                                                                 ^
      35 |   });
      36 |
      37 |   describe('crearMisionKicho', () => {

      at Object.<anonymous> (servicios/censoApi.test.ts:34:97)

  ● censoApi › inyectarEstudiantesKicho › no debería hacer nada si isFirebaseConfigured es falso

    TypeError: jest.mocked(...).mockReturnValue is not a function

      32 |   beforeEach(() => {
      33 |     jest.clearAllMocks();
    > 34 |     (jest.mocked(require('../firebase/config').isFirebaseConfigured as jest.Mock) as jest.Mock).mockReturnValue(true);
         |                                                                                                 ^
      35 |   });
      36 |
      37 |   describe('crearMisionKicho', () => {

      at Object.<anonymous> (servicios/censoApi.test.ts:34:97)

  ● censoApi › obtenerRegistrosMision › debería retornar los registros de una misión

    TypeError: jest.mocked(...).mockReturnValue is not a function

      32 |   beforeEach(() => {
      33 |     jest.clearAllMocks();
    > 34 |     (jest.mocked(require('../firebase/config').isFirebaseConfigured as jest.Mock) as jest.Mock).mockReturnValue(true);
         |                                                                                                 ^
      35 |   });
      36 |
      37 |   describe('crearMisionKicho', () => {

      at Object.<anonymous> (servicios/censoApi.test.ts:34:97)

  ● censoApi › obtenerRegistrosMision › debería retornar un array vacío si isFirebaseConfigured es falso

    TypeError: jest.mocked(...).mockReturnValue is not a function

      32 |   beforeEach(() => {
      33 |     jest.clearAllMocks();
    > 34 |     (jest.mocked(require('../firebase/config').isFirebaseConfigured as jest.Mock) as jest.Mock).mockReturnValue(true);
         |                                                                                                 ^
      35 |   });
      36 |
      37 |   describe('crearMisionKicho', () => {

      at Object.<anonymous> (servicios/censoApi.test.ts:34:97)

 FAIL  servicios/eventosApi.test.ts (6.069 s)
  ● eventosApi storage isolation › sube imagen a la ruta correcta del tenant

    ReferenceError: ref is not defined

      141 |     (getDownloadURL as jest.Mock).mockResolvedValue('https://storage/ev42');
      142 |     await expect(agregarEvento(eventoConImagen)).resolves.toEqual(expect.objectContaining({ id: 'ev42', imagenUrl: 'https://storage/ev42' }));
    > 143 |     expect(ref).toHaveBeenCalledWith(expect.anything(), `tenants/${eventoConImagen.tenantId}/eventos/ev42/imagen_${expect.any(Number)}`);
          |            ^
      144 |   });
      145 | });
      146 |

      at Object.<anonymous> (servicios/eventosApi.test.ts:143:12)

 FAIL  vistas/Dashboard.test.tsx
  ● Test suite failed to run

    ReferenceError: TextEncoder is not defined

      3 | import { render, screen } from '@testing-library/react';
      4 | // FIX: Changed to namespace import to fix module resolution issues.
    > 5 | import * as ReactRouterDOM from 'react-router-dom';
        | ^
      6 | // FIX: Added 'expect' to the import from '@jest/globals' to resolve type inference issues with jest-dom matchers.
      7 | import { describe, it, jest, expect } from '@jest/globals';
      8 | import VistaDashboard from './Dashboard';

      at Object.<anonymous> (node_modules/react-router/dist/development/index.js:342:31)
      at Object.<anonymous> (node_modules/react-router/dist/development/dom-export.js:40:20)
      at Object.<anonymous> (node_modules/react-router-dom/dist/index.js:38:18)
      at Object.<anonymous> (vistas/Dashboard.test.tsx:5:1)


Test Suites: 4 failed, 23 passed, 27 total
Tests:       47 failed, 240 passed, 287 total
Snapshots:   0 total
Time:        71.4 s
Ran all test suites.
Test results written to: coverage\coverage-summary.json

Últimas 1 claves:
 Ctrl+v

Excepción:
System.ArgumentOutOfRangeException: El valor debe ser mayor que o igual a cero y menor que el tamaño de búfer de consola en dicha dimensión.
Nombre del parámetro: top
Valor actual -8.
   en System.Console.SetCursorPosition(Int32 left, Int32 top)
   en Microsoft.PowerShell.PSConsoleReadLine.ReallyRender(RenderData renderData, String defaultColor)
   en Microsoft.PowerShell.PSConsoleReadLine.ForceRender()
   en Microsoft.PowerShell.PSConsoleReadLine.Paste(Nullable`1 key, Object arg)
   en Microsoft.PowerShell.PSConsoleReadLine.ProcessOneKey(ConsoleKeyInfo key, Dictionary`2 dispatchTable, Boolean ignoreIfNoAction, Object arg)
   en Microsoft.PowerShell.PSConsoleReadLine.InputLoop()
   en Microsoft.PowerShell.PSConsoleReadLine.ReadLine(Runspace runspace, EngineIntrinsics engineIntrinsics)
---------------------# ?? Gemini?2.5 - Orquestación de pruebas + Refactor/TDD
>> gemini run \jang> # ?? Gemini?2.5 - Orquestación de pruebas + Refactor/TDD    
>>   --project "Tudojang" \
>>   --stage "tdd-refactor" \
>>   --test-file "servicios/usuariosApi.test.ts" \
>>   --exec "codex" \vicios/usuariosApi.test.ts" \
>>   --token-budget 15000 \
>>   --log-level "info" \ \
>>   --output "reports/tdd-refactor-report.json"
>> /goalutput "reports/tdd-refactor-report.json"
>> 
En línea: 3 Carácter: 5
+   --project "Tudojang" \
+     ~
Falta una expresión después del operador unario '--'.
En línea: 3 Carácter: 5
+   --project "Tudojang" \
+     ~~~~~~~
Token 'project' inesperado en la expresión o la instrucción.
En línea: 4 Carácter: 5
+   --stage "tdd-refactor" \
+     ~
Falta una expresión después del operador unario '--'.
En línea: 4 Carácter: 5
+   --stage "tdd-refactor" \
+     ~~~~~
Token 'stage' inesperado en la expresión o la instrucción.
En línea: 5 Carácter: 5
+   --test-file "servicios/usuariosApi.test.ts" \
+     ~
Falta una expresión después del operador unario '--'.
En línea: 5 Carácter: 5
+   --test-file "servicios/usuariosApi.test.ts" \
+     ~~~~~~~~~
Token 'test-file' inesperado en la expresión o la instrucción.
En línea: 6 Carácter: 5
+   --exec "codex" \
+     ~
Falta una expresión después del operador unario '--'.
En línea: 6 Carácter: 5
+   --exec "codex" \
+     ~~~~
Token 'exec' inesperado en la expresión o la instrucción.
En línea: 7 Carácter: 5
+   --token-budget 15000 \
+     ~
Falta una expresión después del operador unario '--'.
En línea: 7 Carácter: 5
+   --token-budget 15000 \
+     ~~~~~~~~~~~~
Token 'token-budget' inesperado en la expresión o la instrucción.
No se notificaron todos los errores de análisis. Corrija los errores notificados e inténtelo 
de nuevo.
    + CategoryInfo          : ParserError: (:) [], ParentContainsErrorRecordException
    + FullyQualifiedErrorId : MissingExpressionAfterOperator
 
PS E:\Apps\Tudojang> gemini run \
>>   --project "Tudojang" \
>>   --stage "tdd-refactor" \
>>   --test-file "servicios/usuariosApi.test.ts" \
>>   --exec "codex" \
>>   --token-budget 15000 \
>>   --log-level "info" \
>>   --output "reports/tdd-refactor-report.json"
>> 
 *  History restored 

PS E:\Apps\Tudojang> npm run test -- --coverage --testPathPattern=vistas
>> 
npm : No se puede cargar el archivo C:\Program Files\nodejs\npm.ps1 porque la ejecución de 
scripts está deshabilitada en este sistema. Para obtener más información, consulta el tema 
about_Execution_Policies en https:/go.microsoft.com/fwlink/?LinkID=135170.
En línea: 1 Carácter: 1
+ npm run test -- --coverage --testPathPattern=vistas
+ ~~~
    + CategoryInfo          : SecurityError: (:) [], PSSecurityException
    + FullyQualifiedErrorId : UnauthorizedAccess
PS E:\Apps\Tudojang> npm run test -- --coverage --testPathPattern=vistas
>> 
npm : No se puede cargar el archivo C:\Program Files\nodejs\npm.ps1 porque la ejecución de 
scripts está deshabilitada en este sistema. Para obtener más información, consulta el tema 
about_Execution_Policies en https:/go.microsoft.com/fwlink/?LinkID=135170.
En línea: 1 Carácter: 1
+ npm run test -- --coverage --testPathPattern=vistas
+ ~~~
    + CategoryInfo          : SecurityError: (:) [], PSSecurityException
    + FullyQualifiedErrorId : UnauthorizedAccess
PS E:\Apps\Tudojang> npm.cmd run test -- --coverage --testPathPattern=vistas
>> 

> tudojang-gestion@0.0.0 test
> jest --coverage --testPathPattern=vistas

 PASS  vistas/Login.test.tsx (10.343 s)
 PASS  vistas/Estudiantes.test.tsx (13.594 s)
  ● Console

    console.error
      An update to VistaEstudiantes inside a test was not wrapped in act(...).
      
      When testing, code that causes React state updates should be wrapped into act(...):
      
      act(() => {
        /* fire events that update state */
      });
      /* assert on the output */
      
      This ensures that you're testing the behavior the user would see in the browser. Learn more at https://react.dev/link/wrap-tests-with-act

      at node_modules/react-dom/cjs/react-dom-client.development.js:18758:19
      at runWithFiberInDEV (node_modules/react-dom/cjs/react-dom-client.development.js:874:13)
      at warnIfUpdatesNotWrappedWithActDEV (node_modules/react-dom/cjs/react-dom-client.development.js:18757:9)
      at scheduleUpdateOnFiber (node_modules/react-dom/cjs/react-dom-client.development.js:16409:11)
      at dispatchSetStateInternal (node_modules/react-dom/cjs/react-dom-client.development.js:9170:13)
      at dispatchSetState (node_modules/react-dom/cjs/react-dom-client.development.js:9127:7)

 FAIL  vistas/Dashboard.test.tsx
  ● Test suite failed to run

    ReferenceError: TextEncoder is not defined

      3 | import { render, screen } from '@testing-library/react';
      4 | // FIX: Changed to namespace import to fix module resolution issues.
    > 5 | import * as ReactRouterDOM from 'react-router-dom';
        | ^
      6 | // FIX: Added 'expect' to the import from '@jest/globals' to resolve type inference issues with jest-dom matchers.
      7 | import { describe, it, jest, expect } from '@jest/globals';
      8 | import VistaDashboard from './Dashboard';

      at Object.<anonymous> (node_modules/react-router/dist/development/index.js:342:31)
      at Object.<anonymous> (node_modules/react-router/dist/development/dom-export.js:40:20)
      at Object.<anonymous> (node_modules/react-router-dom/dist/index.js:38:18)
      at Object.<anonymous> (vistas/Dashboard.test.tsx:5:1)

 PASS  vistas/Finanzas.test.tsx (13.387 s)
---------------------|---------|----------|---------|---------|--------------------------------File                 | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s              
---------------------|---------|----------|---------|---------|--------------------------------All files            |    90.3 |     94.8 |   66.12 |   94.51 |                                
 Tudojang            |     100 |      100 |     100 |     100 |                                
  constantes.ts      |     100 |      100 |     100 |     100 |                                
  tipos.ts           |     100 |      100 |     100 |     100 |                                
 Tudojang/components |   77.97 |       50 |   32.07 |   86.07 |                                
  FormInputError.tsx |   85.71 |      100 |     100 |   83.33 | 11                             
  Iconos.tsx         |   77.07 |        0 |   29.41 |   85.71 | ...0,92,99,141,147,153,159,169 
  LogoOficialSVG.tsx |     100 |      100 |     100 |     100 |                                
 Tudojang/utils      |   53.84 |        0 |   33.33 |   44.44 |                                
  formatters.ts      |   53.84 |        0 |   33.33 |   44.44 | 10-12,24-28                    
 Tudojang/vistas     |   97.67 |    96.63 |   92.45 |   97.44 |                                
  Estudiantes.tsx    |     100 |      100 |     100 |     100 |                                
  Finanzas.tsx       |     100 |      100 |     100 |     100 |                                
  Login.tsx          |      80 |    66.66 |   33.33 |   79.16 | 33-34,73-100                   
---------------------|---------|----------|---------|---------|--------------------------------
Test Suites: 1 failed, 3 passed, 4 total
Tests:       29 passed, 29 total
Snapshots:   0 total
Time:        21.985 s
Ran all test suites matching /vistas/i.

Microsoft Windows [Versión 10.0.19045.6456]
(c) Microsoft Corporation. Todos los derechos reservados.

E:\Apps\Tudojang>npm.cmd run test -- --coverage --testPathPattern=Estudiante

> tudojang-gestion@0.0.0 test
> jest --coverage --testPathPattern=Estudiante

 PASS  components/FilaEstudiante.test.tsx (34.418 s)
 PASS  vistas/Estudiantes.test.tsx (32.815 s)
  ● Console

    console.error
      An update to VistaEstudiantes inside a test was not wrapped in act(...).
      
      When testing, code that causes React state updates should be wrapped into act(...):
      
      act(() => {
        /* fire events that update state */
      });
      /* assert on the output */
      
      This ensures that you're testing the behavior the user would see in the browser. Learn more at https://react.dev/link/wrap-tests-with-act

      at node_modules/react-dom/cjs/react-dom-client.development.js:18758:19
      at runWithFiberInDEV (node_modules/react-dom/cjs/react-dom-client.development.js:874:13)
      at warnIfUpdatesNotWrappedWithActDEV (node_modules/react-dom/cjs/react-dom-client.development.js:18757:9)
      at scheduleUpdateOnFiber (node_modules/react-dom/cjs/react-dom-client.development.js:16409:11)
      at dispatchSetStateInternal (node_modules/react-dom/cjs/react-dom-client.development.js:9170:13)
      at dispatchSetState (node_modules/react-dom/cjs/react-dom-client.development.js:9127:7)

 PASS  servicios/estudiantesApi.test.ts (7.056 s)
 FAIL  components/FormularioEstudiante.test.tsx (49.191 s)
  ● Console

    console.error
      An update to FormularioEstudiante inside a test was not wrapped in act(...).
      
      When testing, code that causes React state updates should be wrapped into act(...):
      
      act(() => {
        /* fire events that update state */
      });
      /* assert on the output */
      
      This ensures that you're testing the behavior the user would see in the browser. Learn more at https://react.dev/link/wrap-tests-with-act

      at node_modules/react-dom/cjs/react-dom-client.development.js:18758:19
      at runWithFiberInDEV (node_modules/react-dom/cjs/react-dom-client.development.js:874:13)
      at warnIfUpdatesNotWrappedWithActDEV (node_modules/react-dom/cjs/react-dom-client.development.js:18757:9)
      at scheduleUpdateOnFiber (node_modules/react-dom/cjs/react-dom-client.development.js:16409:11)
      at dispatchSetStateInternal (node_modules/react-dom/cjs/react-dom-client.development.js:9170:13)
      at dispatchSetState (node_modules/react-dom/cjs/react-dom-client.development.js:9127:7)
      at Object.control [as callback] (node_modules/react-hook-form/src/useForm.ts:113:7)
      at Object.name (node_modules/react-hook-form/src/logic/createFormControl.ts:1088:58)
      at Object.next (node_modules/react-hook-form/src/utils/extractFormValues.ts:3:15)
      at errors (node_modules/react-hook-form/src/logic/createFormControl.ts:935:7)

    console.error
      An update to FormularioEstudiante inside a test was not wrapped in act(...).
      
      When testing, code that causes React state updates should be wrapped into act(...):
      
      act(() => {
        /* fire events that update state */
      });
      /* assert on the output */
      
      This ensures that you're testing the behavior the user would see in the browser. Learn more at https://react.dev/link/wrap-tests-with-act

      at node_modules/react-dom/cjs/react-dom-client.development.js:18758:19
      at runWithFiberInDEV (node_modules/react-dom/cjs/react-dom-client.development.js:874:13)
      at warnIfUpdatesNotWrappedWithActDEV (node_modules/react-dom/cjs/react-dom-client.development.js:18757:9)
      at scheduleUpdateOnFiber (node_modules/react-dom/cjs/react-dom-client.development.js:16409:11)
      at dispatchSetStateInternal (node_modules/react-dom/cjs/react-dom-client.development.js:9170:13)
      at dispatchSetState (node_modules/react-dom/cjs/react-dom-client.development.js:9127:7)
      at Object.control [as callback] (node_modules/react-hook-form/src/useForm.ts:113:7)
      at Object.name (node_modules/react-hook-form/src/logic/createFormControl.ts:1088:58)
      at Object.next (node_modules/react-hook-form/src/utils/extractFormValues.ts:3:15)
      at Object.validatingFields [as _setValid] (node_modules/react-hook-form/src/logic/createFormControl.ts:218:34)

    console.error
      An update to FormularioEstudiante inside a test was not wrapped in act(...).
      
      When testing, code that causes React state updates should be wrapped into act(...):
      
      act(() => {
        /* fire events that update state */
      });
      /* assert on the output */
      
      This ensures that you're testing the behavior the user would see in the browser. Learn more at https://react.dev/link/wrap-tests-with-act

      at node_modules/react-dom/cjs/react-dom-client.development.js:18758:19
      at runWithFiberInDEV (node_modules/react-dom/cjs/react-dom-client.development.js:874:13)
      at warnIfUpdatesNotWrappedWithActDEV (node_modules/react-dom/cjs/react-dom-client.development.js:18757:9)
      at scheduleUpdateOnFiber (node_modules/react-dom/cjs/react-dom-client.development.js:16409:11)
      at dispatchSetStateInternal (node_modules/react-dom/cjs/react-dom-client.development.js:9170:13)
      at dispatchSetState (node_modules/react-dom/cjs/react-dom-client.development.js:9127:7)
      at Object.control [as callback] (node_modules/react-hook-form/src/useForm.ts:113:7)
      at Object.name (node_modules/react-hook-form/src/logic/createFormControl.ts:1088:58)
      at Object.next (node_modules/react-hook-form/src/utils/extractFormValues.ts:3:15)
      at errors (node_modules/react-hook-form/src/logic/createFormControl.ts:935:7)

    console.error
      An update to FormularioEstudiante inside a test was not wrapped in act(...).
      
      When testing, code that causes React state updates should be wrapped into act(...):
      
      act(() => {
        /* fire events that update state */
      });
      /* assert on the output */
      
      This ensures that you're testing the behavior the user would see in the browser. Learn more at https://react.dev/link/wrap-tests-with-act

      at node_modules/react-dom/cjs/react-dom-client.development.js:18758:19
      at runWithFiberInDEV (node_modules/react-dom/cjs/react-dom-client.development.js:874:13)
      at warnIfUpdatesNotWrappedWithActDEV (node_modules/react-dom/cjs/react-dom-client.development.js:18757:9)
      at scheduleUpdateOnFiber (node_modules/react-dom/cjs/react-dom-client.development.js:16409:11)
      at dispatchSetStateInternal (node_modules/react-dom/cjs/react-dom-client.development.js:9170:13)
      at dispatchSetState (node_modules/react-dom/cjs/react-dom-client.development.js:9127:7)
      at Object.control [as callback] (node_modules/react-hook-form/src/useForm.ts:113:7)
      at Object.name (node_modules/react-hook-form/src/logic/createFormControl.ts:1088:58)
      at Object.next (node_modules/react-hook-form/src/utils/extractFormValues.ts:3:15)
      at errors (node_modules/react-hook-form/src/logic/createFormControl.ts:935:7)

  ● FormularioEstudiante › valida campos requeridos y habilita el botón de finalizar

    thrown: "Exceeded timeout of 5000 ms for a test.
    Add a timeout value to this test to increase the timeout, if this is a long-running test. See https://jestjs.io/docs/api#testname-fn-timeout."

      138 |   });
      139 |
    > 140 |   it('valida campos requeridos y habilita el botón de finalizar', async () => {
          |     ^
      141 |     const user = userEvent.setup();
      142 |     renderComponent();
      143 |

      at components/FormularioEstudiante.test.tsx:140:5
      at Object.<anonymous> (components/FormularioEstudiante.test.tsx:59:9)

 PASS  components/FiltrosEstudiantes.test.tsx (15.955 s)
 PASS  servicios/pagosEstudiantesApi.test.ts (8.712 s)
 PASS  components/TablaEstudiantes.test.tsx (10.366 s)
---------------------------|---------|----------|---------|---------|--------------------------File                       | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s        
---------------------------|---------|----------|---------|---------|--------------------------All files                  |   91.79 |    92.89 |   74.56 |   94.48 |                          
 Tudojang                  |     100 |      100 |     100 |     100 |                          
  constantes.ts            |     100 |      100 |     100 |     100 |                          
  tipos.ts                 |     100 |      100 |     100 |     100 |                          
 Tudojang/components       |   89.34 |    97.18 |      66 |   94.85 |                          
  EstadoPagoBadge.tsx      |     100 |    66.66 |     100 |     100 | 13                       
  FilaEstudiante.tsx       |     100 |      100 |     100 |     100 |                          
  FiltrosEstudiantes.tsx   |     100 |      100 |     100 |     100 |                          
  FormInputError.tsx       |     100 |      100 |     100 |     100 |                          
  FormularioEstudiante.tsx |     100 |      100 |     100 |     100 |                          
  Iconos.tsx               |   78.34 |        0 |   33.33 |   84.28 | ...9,141,147,153,159,169 
  LogoOficialSVG.tsx       |     100 |      100 |     100 |     100 |                          
  TablaEstudiantes.tsx     |     100 |      100 |     100 |     100 |                          
 Tudojang/context          |   47.82 |        0 |    12.5 |      50 |                          
  NotificacionContext.tsx  |   47.82 |        0 |    12.5 |      50 | 26,30-35,49-53           
 Tudojang/hooks            |     100 |       25 |     100 |     100 |                          
  useEstadoPago.ts         |     100 |       25 |     100 |     100 | 38-39                    
 Tudojang/servicios        |   98.57 |    96.29 |     100 |   98.29 |                          
  estudiantesApi.ts        |   98.07 |    94.44 |     100 |   97.64 | 30-31                    
  pagosEstudiantesApi.ts   |     100 |      100 |     100 |     100 |                          
 Tudojang/utils            |   73.17 |    46.15 |   72.72 |   68.96 |                          
  calculations.ts          |   76.19 |       50 |   83.33 |   73.33 | 26,41-43                 
  finanzas.ts              |     100 |      100 |     100 |     100 |                          
  formatters.ts            |   53.84 |        0 |   33.33 |   44.44 | 10-12,24-28              
 Tudojang/vistas           |     100 |      100 |     100 |     100 |                          
  Estudiantes.tsx          |     100 |      100 |     100 |     100 |                          
---------------------------|---------|----------|---------|---------|--------------------------
Test Suites: 1 failed, 6 passed, 7 total
Tests:       1 failed, 104 passed, 105 total
Snapshots:   0 total
Time:        93.353 s