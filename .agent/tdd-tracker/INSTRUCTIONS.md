# TDD Tracker — Guía para Kilo Code / VS Studio

## Propósito

Este directorio contiene un sistema de prompts autocontenidos para dar continuidad al proceso de refactorización y TDD del proyecto Tudojang. Cada prompt puede ser ejecutado de forma independiente por cualquier AI assistant (Kilo Code, Codex, Cursor, etc.) sin necesidad de contexto previo.

## Modelo Recomendado para Kilo Code

> **Hardware del dev**: i5 1ª gen, 16GB DDR3, GTX 1660 Super (6GB VRAM)
> Modelos locales de calidad NO son viables con 6GB VRAM.

| Modelo | Costo | Proveedor | Cómo usarlo en Kilo Code |
|--------|-------|-----------|--------------------------|
| **DeepSeek V3 (Recomendado)** | ~$0.27/M input, $1.10/M output | API DeepSeek o via OpenRouter | Configurar como "Custom OpenAI-compatible" con base URL `https://api.deepseek.com/v1` |
| **Gemini 2.5 Flash** | FREE (1M tokens/día) | Google AI Studio / OpenRouter | Excelente para TDD guiado. Free tier muy generoso |
| **Claude 3.5 Haiku** | $0.25/M input, $1.25/M output | Anthropic / OpenRouter | Rápido, barato, buen razonamiento |
| **DeepSeek R1** | ~$0.55/M input, $2.19/M output | API DeepSeek / OpenRouter | Chain-of-thought profundo. Usar para refactors complejos |

**Configuración en Kilo Code**: Settings → Models → Add Provider → OpenRouter (o Custom). API key desde https://openrouter.ai/keys

## Flujo de Trabajo

### 1. Leer Estado Actual
Antes de empezar, lee `tdd-state.md` para saber en qué punto del proceso estamos.

### 2. Seleccionar el Siguiente Prompt
Busca el primer item con estado `⬜ Pendiente` en `tdd-state.md`. El archivo de prompt correspondiente estará en la carpeta `prompts/`.

### 3. Ejecutar el Prompt
Copia el contenido del prompt al chat de Kilo Code. El prompt incluye:
- Contexto completo del archivo a testear
- Patrones de mock a seguir
- Comando de ejecución con coverage
- Instrucción de mostrar resultados en el chat

### 4. Actualizar Estado
Después de completar exitosamente un prompt:
1. Cambiar el estado en `tdd-state.md` de `⬜` a `✅`
2. Anotar la cobertura obtenida
3. Hacer commit: `git commit -am "test(módulo): add tests for X - coverage Y%"`

### 5. Si Kilo Code está ejecutando directamente (no copy-paste)
Cargar este archivo como contexto del agente y decirle:
```
Lee .agent/tdd-tracker/tdd-state.md, identifica el siguiente item pendiente,
abre el prompt correspondiente de .agent/tdd-tracker/prompts/ y ejecútalo.
Al terminar, actualiza tdd-state.md con el resultado.
```

## Estructura de Archivos

```
.agent/tdd-tracker/
├── INSTRUCTIONS.md          ← Este archivo
├── tdd-state.md             ← Estado global (qué falta, qué está hecho)
├── kilo-code-rules.md       ← Reglas de contexto para Kilo Code
└── prompts/
    ├── fase-1-servicios-sin-tests.md
    ├── fase-2-servicios-mejorar-cobertura.md
    ├── fase-3-componentes-sin-tests.md
    ├── fase-4-vistas-sin-tests.md
    └── fase-5-refactors-estudiantes.md
```

## Convenciones de Testing del Proyecto

### Stack
- **Test runner**: Jest 29 + ts-jest
- **DOM**: jest-environment-jsdom
- **React testing**: @testing-library/react + @testing-library/user-event
- **Assertions**: @testing-library/jest-dom
- **CSS**: identity-obj-proxy (mock)

### Patrón de Mock para Firebase/Firestore
```typescript
jest.mock('firebase/firestore', () => ({
  collection: jest.fn((...args) => ({ args })),
  addDoc: jest.fn(), query: jest.fn((...args) => ({ args })),
  where: jest.fn(), getDocs: jest.fn(), getDoc: jest.fn(),
  updateDoc: jest.fn(), deleteDoc: jest.fn(),
  doc: jest.fn((...args) => ({ args })), Timestamp: {},
  orderBy: jest.fn(), limit: jest.fn(), onSnapshot: jest.fn(),
}));
jest.mock('../firebase/config', () => ({ db: {}, isFirebaseConfigured: true }));
```

### Patrón de Mock para Contextos React
```typescript
jest.mock('../context/DataContext', () => ({
  useSedes: () => ({ sedes: [], sedesVisibles: [] }),
  useConfiguracion: () => ({ configClub: { diasSuspension: 15 } }),
  useProgramas: () => ({ programas: [] }),
}));
jest.mock('../context/NotificacionContext', () => ({
  useNotificacion: () => ({ mostrarNotificacion: jest.fn() }),
}));
jest.mock('../servicios/geminiService');
```

### Patrón de Mock para framer-motion
```typescript
jest.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: any) => <>{children}</>,
  motion: { div: (props: any) => <div {...props} />, tr: (props: any) => <tr {...props} /> },
}));
```

### Comando de Coverage
```bash
npx jest <ruta-al-test> --coverage --coverageReporters=text --collectCoverageFrom="<ruta-al-source>"
```

Ejemplo:
```bash
npx jest servicios/configuracionApi.test.ts --coverage --coverageReporters=text --collectCoverageFrom="servicios/configuracionApi.ts"
```
