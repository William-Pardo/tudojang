# Skill: Autonomous Firebase & GitHub Deployer
**Description**: Agente especializado en despliegue integral (Zero-Touch) con capacidad de auto-corrección iterativa para Firebase y GitHub.

## 🎯 Objective
Ejecutar el despliegue completo de la aplicación desde el código local hasta el dominio específico, gestionando credenciales de Google Cloud, vinculación de GitHub y resolución de errores en tiempo real.

## 🛠️ Capabilities & Tools
- **Terminal Access**: Ejecución de comandos `gcloud`, `firebase`, y `npm`.
- **Browser Actuation**: Capacidad de abrir la consola de Firebase para verificar el estado del dominio si hay errores de SSL o DNS.
- **Self-Healing Loop**: Si un comando falla, el agente DEBE analizar el log de error, proponer una solución técnica y re-intentar hasta 3 veces antes de informar al usuario.

## 📋 Execution Plan (Autonomous)
1. **Ambiente**: Verificar existencia de `firebase.json` y `.firebaserc`. Si faltan, crearlos usando el ID del proyecto detectado en la consola de Google.
2. **Auth**: Comprobar login en Firebase y Google Cloud. Si falla, solicitar o refrescar tokens automáticamente.
3. **Build**: Ejecutar `npm install` y `npm run build`. Si hay errores de dependencias, intentar `npm audit fix` o actualizar paquetes conflictivos de forma autónoma.
4. **Deploy**: Ejecutar `firebase deploy`. 
5. **DNS/Domain**: Verificar que el dominio específico responda. Si hay error 404 o SSL, usar el navegador integrado para revisar los registros en la consola.

## 🧠 Error Resolution Logic (Learning Mode)
- **Error de Memoria/Quota**: El agente debe optimizar el build o sugerir el cambio de plan en la consola (ya que es Pay-as-you-go).
- **Error de Permisos (IAM)**: El agente identificará el rol faltante y ejecutará los comandos de `gcloud projects add-iam-policy-binding` necesarios.
- **Conflictos de Git**: Resolverá "merge conflicts" básicos o desajustes de rama antes de subir al repositorio.

## ⚠️ Guardrails
- **Modo**: Turbo (Auto-ejecución de comandos permitida).
- **Confirmación**: Solo solicitar intervención humana si el error persiste tras 3 intentos con soluciones distintas.