
// components/navegacion/menuMobileHijos.tsx
//
// Mapeo idEnlace -> subitems del acordeon mobile de BarraLateral (App.tsx). Espeja
// EXACTAMENTE los arrays de tabs internos de las 4 vistas que hoy resuelven su propia
// sub-navegacion con una barra de tabs horizontal (Administracion, Estudiantes,
// CentroEstudios, Configuracion) -- mismos labels textuales, mismos iconos, mismas
// condiciones de rol/config -- para que el drawer mobile pueda listarlos como hijos
// navegables sin duplicar la logica de negocio real, que sigue viviendo unicamente en
// cada vista (App.tsx / BarraLateral solo LEE este mapeo, no decide nada de negocio).
//
// Riesgo abierto documentado (plan aprobado "menu mobile acordeon", no se resuelve aca):
// las condiciones de rol / esDemoComercial estan DUPLICADAS entre este archivo y cada
// vista -- si una vista cambia su array de tabs (ids, labels, visibilidad), este archivo
// debe actualizarse a mano. Cada funcion de abajo tiene un comentario cruzado apuntando al
// archivo real que espeja.
//
// El `id` de cada subitem coincide 1:1 con el id de tab real que cada vista valida al leer
// `?tab=` (ver utils/navegacion/resolverTabInicial.ts y el useState de cada vista) -- ese
// es el contrato de deep-linking entre este mapeo y las vistas destino.

import React from 'react';
import { RolUsuario, type Usuario, type ConfiguracionClub } from '../../tipos';
import {
    IconoResumenAdministracion, IconoTesoreria, IconoValidarPagos, IconoHistorial, IconoAgenda, IconoAnalisis,
    IconoCampana, IconoEstudiantes, IconoControlAsistencia, IconoCertificados, IconoCarnets,
    IconoFlujoAcademico, IconoProgresoEstudiante,
    IconoImagen, IconoUsuario, IconoEmail, IconoCasa, IconoProgramasExtra, IconoConfiguracionAlertas, IconoAprobar,
} from '../Iconos';

export interface SubitemMenuMobile {
    /** Coincide 1:1 con el id de tab real que valida la vista destino (ver `?tab=`). */
    id: string;
    label: string;
    icono: React.FC<React.SVGProps<SVGSVGElement>>;
    /** Ruta completa (incluye el query `?tab=`), lista para <Link to={...}>. */
    ruta: string;
}

export interface ContextoMenuMobile {
    usuario: Pick<Usuario, 'rol'> | null | undefined;
    configClub?: Pick<ConfiguracionClub, 'esDemoComercial'> | null;
}

// --- Administracion ("/") ---------------------------------------------------------------
// Espejo exacto de vistas/Administracion.tsx (const tabs). Sin condiciones de
// rol/visibilidad adicionales: quien llega a "/" (roles ya filtrados en todosLosEnlaces) ve
// las 6 pestañas completas, igual que hoy en la barra de tabs de esa vista.
function hijosAdministracion(_ctx: ContextoMenuMobile): SubitemMenuMobile[] {
    return [
        { id: 'resumen', label: 'Resumen', icono: IconoResumenAdministracion, ruta: '/?tab=resumen' },
        { id: 'tesoreria', label: 'Tesorería', icono: IconoTesoreria, ruta: '/?tab=tesoreria' },
        { id: 'validar', label: 'Validar Pagos', icono: IconoValidarPagos, ruta: '/?tab=validar' },
        { id: 'historial', label: 'Historial de Validaciones', icono: IconoHistorial, ruta: '/?tab=historial' },
        { id: 'horarios', label: 'Agenda', icono: IconoAgenda, ruta: '/?tab=horarios' },
        { id: 'analisis', label: 'Análisis', icono: IconoAnalisis, ruta: '/?tab=analisis' },
    ];
}

// --- Estudiantes ("/estudiantes") --------------------------------------------------------
// Espejo exacto de vistas/Estudiantes.tsx (const tabs + flags esTutor/rol/esDemoComercial).
// NOTA (regla del plan aprobado): el subitem "asistencia" de aca (-> /estudiantes?tab=asistencia)
// es una feature DISTINTA del leaf top-level "Control de Asistencia" (rutaClaseEnVivo,
// gateado por jornadaActiva) -- no se fusionan, aunque compartan icono y texto similar.
function hijosEstudiantes(ctx: ContextoMenuMobile): SubitemMenuMobile[] {
    const rol = ctx.usuario?.rol;
    const esTutor = rol === RolUsuario.Tutor;
    const items: SubitemMenuMobile[] = [];

    if (rol === RolUsuario.Admin || rol === RolUsuario.Editor) {
        items.push({ id: 'kicho', label: 'Misión KICHO', icono: IconoCampana, ruta: '/estudiantes?tab=kicho' });
    }
    if (!esTutor) {
        items.push({ id: 'directorio', label: 'Directorio', icono: IconoEstudiantes, ruta: '/estudiantes?tab=directorio' });
    }
    // Siempre visible (mismo criterio que la vista real: `visible: true`).
    items.push({ id: 'asistencia', label: 'Control de Asistencia', icono: IconoControlAsistencia, ruta: '/estudiantes?tab=asistencia' });
    if (!esTutor) {
        items.push({ id: 'certificados', label: 'Certificaciones', icono: IconoCertificados, ruta: '/estudiantes?tab=certificados' });
    }
    // Modo demo comercial (marketing, ver tipos.ts ConfiguracionClub.esDemoComercial):
    // Carnetización se reserva como valor agregado -- no se muestra en la demo.
    if (!esTutor && rol !== RolUsuario.Asistente && !ctx.configClub?.esDemoComercial) {
        items.push({ id: 'carnets', label: 'Carnetización', icono: IconoCarnets, ruta: '/estudiantes?tab=carnets' });
    }
    return items;
}

// --- Centro Estudios ("/centro-estudios") -------------------------------------------------
// Espejo exacto de vistas/CentroEstudios.tsx (flag puedeGestionarJornadas). Si el rol no
// puede gestionar jornadas (Tutor/Estudiante), esta funcion devuelve [] -- BarraLateral debe
// entonces renderizar "Centro Estudios" como leaf directo, SIN chevron/hijos (regla 6 del
// plan aprobado: mismo criterio que ya usa esa vista para no mostrarles tabs).
function hijosCentroEstudios(ctx: ContextoMenuMobile): SubitemMenuMobile[] {
    const rol = ctx.usuario?.rol;
    const puedeGestionarJornadas = rol === RolUsuario.Admin || rol === RolUsuario.SuperAdmin || rol === RolUsuario.Editor;
    if (!puedeGestionarJornadas) return [];
    return [
        { id: 'flujo', label: 'Flujo Académico', icono: IconoFlujoAcademico, ruta: '/centro-estudios?tab=flujo' },
        { id: 'metricas', label: 'Progreso Estudiantes', icono: IconoProgresoEstudiante, ruta: '/centro-estudios?tab=metricas' },
    ];
}

// --- Configuracion ("/configuracion", solo Admin) -----------------------------------------
// Espejo exacto de vistas/Configuracion.tsx (array de tabs que se muestra cuando
// !isWizardMode). Durante el wizard de onboarding la propia vista ignora `?tab=` (cada
// seccion del wizard se gatea por currentStep, no por activeTab) -- ver el useState de
// activeTab en ese archivo -- asi que no hace falta replicar esa condicion aca.
function hijosConfiguracion(ctx: ContextoMenuMobile): SubitemMenuMobile[] {
    const items: SubitemMenuMobile[] = [
        { id: 'branding', label: 'Identidad & Pagos', icono: IconoImagen, ruta: '/configuracion?tab=branding' },
        { id: 'equipo', label: 'Equipo Técnico', icono: IconoUsuario, ruta: '/configuracion?tab=equipo' },
        { id: 'accesos', label: 'Cuentas Externas', icono: IconoEmail, ruta: '/configuracion?tab=accesos' },
        { id: 'sedes', label: 'Sedes Adicionales', icono: IconoCasa, ruta: '/configuracion?tab=sedes' },
        { id: 'programas', label: 'Programas Extra', icono: IconoProgramasExtra, ruta: '/configuracion?tab=programas' },
        { id: 'alertas', label: 'Alertas', icono: IconoConfiguracionAlertas, ruta: '/configuracion?tab=alertas' },
        { id: 'licencia', label: 'Licencia', icono: IconoAprobar, ruta: '/configuracion?tab=licencia' },
    ];
    // Modo demo comercial: mismo filtro que la vista real (tab.id !== 'programas' || !esDemoComercial).
    return items.filter((item) => item.id !== 'programas' || !ctx.configClub?.esDemoComercial);
}

// idEnlace debe coincidir con el `id` agregado a cada entrada de `todosLosEnlaces` en
// App.tsx. Las entradas sin tabs internas (agenda, tienda, eventos, controlAsistencia,
// alertas, buzon) intencionalmente NO tienen entrada aca -- BarraLateral las trata como
// leaf porque `HIJOS_POR_ID_ENLACE[idEnlace]` es `undefined` para ellas.
export const HIJOS_POR_ID_ENLACE: Record<string, (ctx: ContextoMenuMobile) => SubitemMenuMobile[]> = {
    administracion: hijosAdministracion,
    estudiantes: hijosEstudiantes,
    centroEstudios: hijosCentroEstudios,
    configuracion: hijosConfiguracion,
};

// Pura y testeable (ver App.routing.test.ts): calcula, para un idEnlace + contexto dados,
// si ese enlace debe renderizarse como parent-con-acordeon (hijos.length > 0) o como leaf
// directo. Extraida para no repetir `HIJOS_POR_ID_ENLACE[id]?.(ctx) ?? []` en BarraLateral.
export function obtenerHijosDeEnlace(idEnlace: string, ctx: ContextoMenuMobile): SubitemMenuMobile[] {
    const resolver = HIJOS_POR_ID_ENLACE[idEnlace];
    return resolver ? resolver(ctx) : [];
}
