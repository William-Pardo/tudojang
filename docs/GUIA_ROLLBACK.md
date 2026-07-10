# Guía Final de Rollback – Centro de Estudios

Versión: 1.0 | Fecha: 2026-06-29 | Responsable: Antigravity/Gemini (A3.2)

---

## 1. Cuándo ejecutar rollback

Ejecutar rollback del Centro de Estudios si se detecta alguna de estas condiciones en producción:

- Error crítico en el flujo OAuth de Google Drive que impide a todos los admins conectar cuentas.
- Fuga de datos entre tenants (un tenant ve recursos de otro).
- URL temporales de acceso a archivos no expiran o son accesibles sin autenticación.
- Falla masiva de App Check que bloquea el módulo para usuarios legítimos.
- Bug en la lógica de permisos que permite a un estudiante ver la Biblioteca global o las jornadas.

---

## 2. Apagar el módulo por feature flag

El Centro de Estudios está controlado por la feature flag `features.centroEstudios`.

### 2.1 Desactivar en Firestore (tenant específico)

`
// En la colección de configuración del tenant:
tenants/{tenantId}/config
{
  "features": {
    "centroEstudios": false
  }
}
`

**Efecto inmediato:** la UI oculta el módulo para todos los usuarios de ese tenant. No se eliminan datos.

### 2.2 Desactivar globalmente (todos los tenants)

Si el problema afecta a todos los tenants, actualizar el documento de configuración global:

`
// config/global
{
  "features": {
    "centroEstudios": false
  }
}
`

**Importante:** la UI debe leer esta flag en cada carga de ruta protegida. Verificar que CentroEstudiosGuard o equivalente evalúe la flag antes de renderizar.

---

## 3. Impacto de datos ya creados

Al desactivar la feature flag **no se eliminan datos**. Los datos persisten en Firestore:

| Colección | Datos en riesgo | Impacto del rollback |
| :--- | :--- | :--- |
| `tenants/{id}/conexionesDrive` | Token OAuth del tenant | Sin impacto; se reactiva al encender la flag. |
| `tenants/{id}/recursos` | Recursos importados y aprobados | Sin impacto; permanecen en Firestore. |
| `tenants/{id}/jornadas` | Jornadas creadas y confirmadas | Sin impacto; se recuperan al reactivar. |
| `tenants/{id}/asignaciones` | Asignaciones publicadas | Los estudiantes no las ven si el módulo está apagado. |
| `usuarios/{id}/progreso` | Progreso guardado del estudiante | Sin impacto; se mantiene para cuando se reactive. |

**No ejecutar eliminación de datos durante rollback.** Evaluar el bug primero.

---

## 4. Restauración de acceso previo

Si el rollback implica revertir un bug en roles o permisos:

1. Verificar que los custom claims de Firebase Auth (`rol`, `tenantId`) son los correctos para cada usuario.
2. Si un usuario quedó con claims incorrectos, forzar re-login o actualizar claims desde Firebase Console o desde la Function `assignRole`.
3. Verificar en Firestore Rules que las reglas del módulo centroEstudios no permiten lectura cruzada entre tenants.
4. Ejecutar el test de aislamiento cross-tenant del checklist de staging antes de reactivar.

---

## 5. Pasos de rollback paso a paso

| # | Paso | Responsable | Verificación |
| :--- | :--- | :--- | :--- |
| 1 | Detectar el bug y clasificar severidad (crítico/mayor/menor). | Devops / Codex | Issue creado con severidad. |
| 2 | Comunicar a los tenants afectados (email o in-app). | Admin del producto | Mensaje enviado. |
| 3 | Desactivar feature flag en tenant afectado o globalmente. | Devops | Módulo oculto en UI. |
| 4 | Reproducir el bug en staging con los mismos datos. | Codex | Bug reproducido y documentado. |
| 5 | Aplicar fix en rama aislada. | Codex | PR con tests que fallan antes del fix y pasan después. |
| 6 | Ejecutar suite completa: unit, Firestore rules, Functions, build. | Codex | Todas las suites en verde. |
| 7 | Deployar fix a staging y validar manualmente. | Codex + QA | Checklist staging firmado. |
| 8 | Reactivar feature flag en tenant piloto. | Devops | Monitorear 24 h. |
| 9 | Reactivar feature flag globalmente si no hay regresiones. | Devops | Flag global en true. |
| 10 | Registrar el incidente y la solución en el historial del CIERRE. | Antigravity / Codex | Registro de incidente en CIERRE CENTRO DE ESTUDIOS.md. |

---

## 6. Criterio de rollback completo

El rollback se considera completo cuando:

- [ ] Feature flag desactivada en el scope afectado.
- [ ] Bug reproducido y documentado en staging.
- [ ] Fix aplicado con tests que lo cubren.
- [ ] Suite completa pasando en CI.
- [ ] Staging validado manualmente.
- [ ] Feature flag reactivada.
- [ ] Incidente registrado en CIERRE CENTRO DE ESTUDIOS.md.
