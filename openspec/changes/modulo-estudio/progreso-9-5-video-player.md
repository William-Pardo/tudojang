# Progreso 9.5 - VideoPlayer con tracking de segundos unicos

Fecha: 2026-06-27

## Alcance cerrado

- Se completo `components/academico/VideoPlayer.tsx`.
- El componente esta conectado a `useProgressSync` con `tipo: 'video'`.
- Mantiene sincronizacion manual mediante `flush`.
- Permite cargar progreso guardado para reanudacion.
- Registra segundos desde eventos `timeupdate`.
- Ignora eventos `timeupdate` mientras el video esta en `seeking`.
- Reanuda el registro normal despues de `seeked`.

## Evidencia TDD

| Paso | Evidencia |
| --- | --- |
| RED | `npm run test:app -- components/academico/VideoPlayer.test.tsx` fallo porque `timeupdate` no registraba segundos ni ignoraba seeking. |
| GREEN | El mismo comando paso con 5/5 tests. |
| REFACTOR | Se agrego `buscandoRef` para distinguir reproduccion normal de seeking sin introducir estado React innecesario. |

## Verificacion

```powershell
npm run test:app -- components/academico/VideoPlayer.test.tsx
npm run build
```

Resultado:

```text
PASS components/academico/VideoPlayer.test.tsx
Tests: 5 passed, 5 total
✓ built
```

Notas:

- El build conserva advertencias no bloqueantes existentes de Vite sobre directivas `use client`, imports dinamicos y tamano de chunk.
