# Registro 13.3 — regresion specs base

- [x] 13.3 Verificar que los tests existentes de `client-item`, `evento-landing-publica` y `evento-lead-capture` continuan pasando sin modificaciones regresivas.

## Comandos

```powershell
npm run test:app -- components/ClientItem.test.tsx servicios/leadsEventosApi.test.ts servicios/eventosApi.test.ts vistas/EventoPublico.test.tsx
npm run build
```

## Resultado

- Test suites: 4 passed / 4 total.
- Tests: 20 passed / 20 total.
- Build de produccion exitoso.

## Ajuste realizado

No existia test directo para `evento-landing-publica`; se agrego `vistas/EventoPublico.test.tsx` para cubrir acceso publico, render de evento demo y apertura del formulario de inscripcion.

Durante el RED del test nuevo se detecto que los labels del formulario no estaban asociados a sus inputs. Se corrigio `vistas/EventoPublico.tsx` agregando `htmlFor` e `id` en los campos:

- Nombre Completo
- Celular / WhatsApp
- Email
- Academia

Esto mejora accesibilidad sin cambiar el flujo visual.
