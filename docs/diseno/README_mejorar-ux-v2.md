# Mejorar UX V2.0 — Referencia de diseño Figma

Origen: exportacion de codigo real de Figma Make ("Mejorar UX V2.0.zip"), provista por el usuario el 2026-07-07.

## Que contiene

`mejorar-ux-v2-figma-source.tsx.txt` es el `App.tsx` completo (580 lineas) del mockup exportado, guardado con extension `.txt` a proposito para que Vite/tsc no lo procesen como codigo fuente del proyecto — es solo referencia de diseno, no se importa ni se compila.

El mockup completo describe **un unico flujo**: la vista de "Clase activa" (una clase a la vez, con navegacion prev/next) mas el asistente de 3 pasos para asignar material (Material -> Configurar -> Grados), con tag-matching contra el programa, selects de destinatario/grupo/momento/criterio, y seleccion de grados por color de familia.

**Importante para cualquier IA que continue este trabajo**: este archivo **NO contiene** ningun diseno de grilla paginada para "Mis Clases" (listado con gestion de ciclo de vida: confirmar/iniciar/cerrar/cancelar/reprogramar). Esa grilla de 9 tarjetas por pagina fue una extension propia del usuario, usando el mismo lenguaje visual de este mockup (tarjetas `rounded-2xl`, badges de color, iconografia) pero aplicada a un componente que el mockup no cubre. Ver seccion 11 de `CIERRE CENTRO DE ESTUDIOS.md` para el detalle de que se implemento y donde.

## Estado de implementacion

Ver seccion **"11. Rediseno UX unificado: Programa, Publicar material y Mis Clases (Figma)"** en `CIERRE CENTRO DE ESTUDIOS.md` (raiz del repo) para el registro obligatorio de avance, fase por fase, con evidencia de tests. Ver tambien `openspec/changes/archive/2026-07-08-unificar-flujo-publicar-material/` (change archivada) para el detalle tarea-por-tarea (proposal/specs/design/tasks) y `CIERRE SDD CLAUDE CODE - CENTRO ESTUDIOS.md` (raiz del repo) para el resumen de alto nivel del flujo SDD usado por Claude Code en este trabajo.
