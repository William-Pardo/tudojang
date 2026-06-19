## 1. Configuración de Firebase y Reglas

- [x] 1.1 Crear el archivo `storage.rules` en la raíz del proyecto con las reglas de acceso aislado por `tenantId` para `/tenants/{tenantId}/eventos/...`
- [x] 1.2 Modificar el archivo `firebase.json` para incluir la configuración de `"storage": { "rules": "storage.rules" }`

## 2. Implementación en el Frontend

- [x] 2.1 Identificar la función de subida de imágenes: `procesarImagenEvento` en `servicios/eventosApi.ts`
- [x] 2.2 El `tenantId` ya se inyecta desde el `DataContext` al crear/actualizar eventos (`tenant.tenantId`)
- [x] 2.3 Modificar `procesarImagenEvento` para aceptar `tenantId` y usar la ruta `tenants/{tenantId}/eventos/{eventId}/{imageName}`

## 3. Pruebas y Verificación

- [ ] 3.1 Confirmar que una escuela (tenant) puede crear eventos y subir imágenes sin fallos de autorización
- [ ] 3.2 Validar que las imágenes se guarden en la ruta estructurada con el namespace del tenant correspondiente
- [ ] 3.3 Comprobar desde la consola de Firebase que los intentos de subida a rutas de otros tenants o sin autenticación sean bloqueados de forma efectiva
