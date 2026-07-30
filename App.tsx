
// App.tsx
import React, { useState, useEffect, useRef } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { motion } from 'framer-motion';

import { isFirebaseConfigured } from './firebase/config';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider, useEventos } from './context/DataContext';
import { NotificacionProvider } from './context/NotificacionContext';
import { AnalyticsProvider, useAnalytics } from './context/AnalyticsContext';
import { useNotificacion } from './context/NotificacionContext';
import BrandingProvider, { useTenant } from './components/BrandingProvider';
import { RolUsuario, type Usuario } from './tipos';

import PublicLanding from './vistas/PublicLanding';
import Login from './vistas/Login';
import RegistroEscuela from './vistas/RegistroEscuela';
import PasarelaInscripcion from './vistas/PasarelaInscripcion'; // Importación nueva
import VistaConfiguracion from './vistas/Configuracion';
import VistaAdministracion from './vistas/Administracion';
import { VistaEstudiantes } from './vistas/Estudiantes';
import { VistaEventos } from './vistas/Eventos';
import VistaTienda from './vistas/Tienda';
import VistaMisionKicho from './vistas/MisionKicho';
import MasterAccess from './vistas/MasterAccess';
import VistaNotificaciones from './vistas/Notificaciones';
import VistaBuzonNotificaciones from './vistas/BuzonNotificaciones';
import VistaMiPerfil from './vistas/MiPerfil';
import VistaCentroEstudios from './vistas/CentroEstudios';
import VistaJornadas from './vistas/admin/JornadasView';
import VistaAgenda from './vistas/admin/AgendaView';
import { ClaseEnVivoView } from './vistas/ClaseEnVivoView';
import Vista404 from './vistas/404';
import VistaActivarCuenta from './vistas/ActivarCuenta';
import VistaRestablecerClave from './vistas/RestablecerClave';
import VistaSalidaPublica from './vistas/SalidaPublica';
import VistaAyudaPqrs from './vistas/AyudaPqrs';
import VistaMasterDashboard from './vistas/MasterDashboard';
import LicenciaSuspendida from './vistas/LicenciaSuspendida';
import { useEstadoLicencia } from './hooks/useEstadoLicencia';
import { useVentanaClaseEnVivo } from './hooks/useVentanaClaseEnVivo';
import { driveService } from './services/storage/driveService';

import VistaFirmaConsentimiento from './vistas/FirmaConsentimiento';
import VistaFirmaContrato from './vistas/FirmaContrato';
import VistaFirmaImagen from './vistas/FirmaImagen';
import CensoPublico from './vistas/CensoPublico';
import ReportarPagoPublico from './vistas/ReportarPagoPublico';
import EventoPublico from './vistas/EventoPublico';

import Footer from './components/Footer';
import NotificacionToast from './components/NotificacionToast';
import BotonVolverArriba from './components/BotonVolverArriba';
import ModalBusquedaGlobal from './components/ModalBusquedaGlobal';
import LogoDinamico from './components/LogoDinamico';
import AsistenteVirtual from './components/AsistenteVirtual';
import HeatmapOverlay from './components/HeatmapOverlay';
import {
    IconoAgenda, IconoConfiguracion, IconoEstudiantes, IconoEventos,
    IconoLogout, IconoLuna, IconoMenu, IconoSol, IconoTienda,
    IconoBuscar, IconoUsuario, IconoAprobar, IconoInformacion,
    IconoAdministracion, IconoAlertas, IconoCentroEstudios, IconoControlAsistencia
} from './components/Iconos';

const BarraLateral: React.FC<{ estaAbierta: boolean; onCerrar: () => void; onLogout: () => void, usuario: Usuario }> = ({ estaAbierta, onCerrar, onLogout, usuario }) => {
    const location = ReactRouterDOM.useLocation();
    const esMaster = usuario?.email.toLowerCase() === 'aliantlab@gmail.com';

    // Fase 4 (clase-en-vivo-checkin-trigger-agenda, Bloque A): ventana horaria dinamica real,
    // reemplaza el placeholder `showClaseEnVivo=true` (siempre visible). El link solo se activa
    // si hay al menos una jornada real del usuario (segun rol/asignacion, ver
    // `hooks/useVentanaClaseEnVivo.ts`) dentro de `[horaInicio-15min, horaFin+15min]` ahora mismo.
    // Recalculado cada 60s (mismo intervalo que tenia el placeholder).
    // WS-6 (§4, selector multi-clase): con 2+ jornadas activas a la vez el link ya NO apunta
    // directo a la mas cercana -- va a la ruta generica `/clase-en-vivo`, donde ClaseEnVivoView
    // ofrece el selector. Con exactamente 1, se preserva el link directo de siempre.
    const { jornadaActiva, jornadasEnVentana } = useVentanaClaseEnVivo();
    const rutaClaseEnVivo = jornadasEnVentana.length > 1
        ? '/clase-en-vivo'
        : (jornadaActiva ? `/clase-en-vivo/${jornadaActiva.id}` : '/clase-en-vivo');

    // Fix tutor-role-end-to-end (2026-07-14): el link "Eventos" se muestra al Tutor SOLO
    // cuando existe un evento con inscripción abierta hoy (al que puede inscribir a su hijo).
    // Para el resto de roles la visibilidad no depende de esto.
    const { eventos } = useEventos();
    const hoyIsoNav = new Date().toISOString().slice(0, 10);
    const hayEventoAplicable = eventos.some(
        (ev) => ev.fechaInicioInscripcion <= hoyIsoNav && hoyIsoNav <= ev.fechaFinInscripcion
    );

    const todosLosEnlaces = [
        { ruta: "/", texto: "Administración", icono: IconoAdministracion, roles: [RolUsuario.Admin, RolUsuario.Editor, RolUsuario.Asistente, RolUsuario.SuperAdmin] },
        // Fix tutor-role-end-to-end (2026-07-14): "Estudiantes" es el roster de recepcion
        // (staff), no una vista de padre -> Tutor removido. El Tutor ve su experiencia por
        // Centro de Estudios (materiales del hijo) + Alertas.
        { ruta: "/estudiantes", texto: "Estudiantes", icono: IconoEstudiantes, roles: [RolUsuario.Admin, RolUsuario.Editor, RolUsuario.Asistente] },
        { ruta: "/centro-estudios", texto: "Centro Estudios", icono: IconoCentroEstudios, roles: [RolUsuario.Admin, RolUsuario.Editor, RolUsuario.Asistente, RolUsuario.Tutor, RolUsuario.Estudiante] },
        // Pedido explicito del usuario (post-cierre modulo 12): el diseno nuevo de Agenda ya
        // quedo embebido en la pestana "Agenda" de Administracion.tsx ("Agenda Maestro"), asi
        // que Admin/Editor/Asistente/SuperAdmin lo alcanzan desde ahi -- se les quita esta
        // entrada de menu duplicada. Maestro/Estudiante (y Tutor, ya habilitado por el fix
        // tutor-role-end-to-end) NO tienen acceso a Administracion, asi que necesitan seguir
        // llegando a su agenda por este link. La ruta /agenda en si NO se elimina (sigue
        // gateada igual mas abajo), solo se recorta a quien realmente la necesita en el menu.
        { ruta: "/agenda", texto: "Agenda", icono: IconoAgenda, roles: [RolUsuario.Maestro, RolUsuario.Estudiante, RolUsuario.Tutor] },
        { ruta: "/tienda", texto: "Tienda", icono: IconoTienda, roles: [RolUsuario.Admin, RolUsuario.Editor, RolUsuario.Tutor] },
        { ruta: "/eventos", texto: "Eventos", icono: IconoEventos, roles: [RolUsuario.Admin, RolUsuario.Editor, RolUsuario.Tutor, RolUsuario.Estudiante] },
        { ruta: rutaClaseEnVivo, texto: "Control de Asistencia", icono: IconoControlAsistencia, roles: [RolUsuario.Admin, RolUsuario.Editor, RolUsuario.Asistente] },
        { ruta: "/notificaciones", texto: "Alertas", icono: IconoAlertas, roles: [RolUsuario.Admin, RolUsuario.Editor] },
        // Fix tutor-role-end-to-end (2026-07-14): buzón del consultor (Tutor/Estudiante) — cola
        // de notificaciones de su estudiante (pagos, avances, eventos). Distinto del módulo de
        // gestión de Alertas del staff.
        { ruta: "/buzon", texto: "Notificaciones", icono: IconoAlertas, roles: [RolUsuario.Tutor, RolUsuario.Estudiante] },
        { ruta: "/configuracion", texto: "Configuración", icono: IconoConfiguracion, roles: [RolUsuario.Admin] },
    ];

    const enlacesVisibles = todosLosEnlaces.filter(enlace => {
        if (enlace.texto === 'Control de Asistencia') {
            // Fuera de la ventana horaria, el link queda oculto (Módulo Clase en Vivo.txt §3:
            // "Fuera de esa ventana, el acceso debe estar bloqueado, oculto o deshabilitado").
            return enlace.roles.includes(usuario.rol) && !!jornadaActiva;
        }
        // Fix tutor-role-end-to-end (2026-07-14): para consultores (Tutor/Estudiante), "Eventos"
        // solo aparece cuando hay un evento con inscripción abierta al que puede aplicar.
        if (enlace.texto === 'Eventos' && (usuario.rol === RolUsuario.Tutor || usuario.rol === RolUsuario.Estudiante)) {
            return enlace.roles.includes(usuario.rol) && hayEventoAplicable;
        }
        return enlace.roles.includes(usuario.rol);
    });
    const sidebarWidthClass = estaAbierta ? 'w-64' : 'w-20';

    const getButtonStyle = (ruta: string, isLogout: boolean = false) => {
        const isActive = location.pathname === ruta;
        const isPC = window.innerWidth >= 768;
        let baseClasses = `flex items-center transition-all duration-300 uppercase font-black text-[11px] tracking-[0.2em] w-full text-white`;

        if (isPC) {
            return `${baseClasses} py-5 border-r-4 ${estaAbierta ? 'px-8 gap-4' : 'px-0 justify-center'} ${isActive ? 'bg-white/10 border-tkd-red' : 'bg-transparent border-transparent hover:bg-white/5 opacity-80 hover:opacity-100'}`;
        } else {
            return `${baseClasses} px-6 py-4 my-2 rounded-2xl mx-4 border gap-5 justify-start ${isActive ? 'bg-white/20 border-white/30' : 'bg-white/5 border-white/5 opacity-80'}`;
        }
    };

    return (
        <aside className={`bg-tkd-blue text-white flex flex-col fixed inset-y-0 left-0 z-40 h-screen transition-all duration-500 ease-in-out md:relative md:translate-x-0 ${sidebarWidthClass} ${estaAbierta ? 'translate-x-0' : '-translate-x-full shadow-2xl'}`}>
            <div className={`flex items-center justify-center h-28 border-b border-white/10 transition-all ${estaAbierta ? 'p-8' : 'p-2'}`}>
                <LogoDinamico className={estaAbierta ? "h-16 w-auto" : "h-10 w-10"} />
            </div>
            <nav className="flex-grow mt-6 overflow-y-auto no-scrollbar">
                {enlacesVisibles.map((enlace) => (
                    <ReactRouterDOM.Link key={enlace.ruta} to={enlace.ruta} onClick={onCerrar} className={getButtonStyle(enlace.ruta)}>
                        <enlace.icono className="w-10 h-10 flex-shrink-0" />
                        <span className={`${estaAbierta ? 'block' : 'hidden'}`}>{enlace.texto}</span>
                    </ReactRouterDOM.Link>
                ))}
            </nav>
            <div className="border-t border-white/10 flex flex-col">
                {esMaster && (
                    <ReactRouterDOM.Link to="/aliant-control" onClick={onCerrar} className={getButtonStyle('/aliant-control')}>
                        <IconoAprobar className="w-5 h-5 flex-shrink-0" />
                        <span className={`${estaAbierta ? 'block' : 'hidden'}`}>Consola Aliant</span>
                    </ReactRouterDOM.Link>
                )}
                <ReactRouterDOM.Link to="/mi-perfil" onClick={onCerrar} className={getButtonStyle('/mi-perfil')}>
                    <IconoUsuario className="w-10 h-10 flex-shrink-0" />
                    <span className={`${estaAbierta ? 'block' : 'hidden'}`}>Mi Perfil</span>
                </ReactRouterDOM.Link>
                <button onClick={onLogout} className={getButtonStyle('/logout', true)}>
                    <IconoLogout className="w-5 h-5 flex-shrink-0" />
                    <span className={`${estaAbierta ? 'block' : 'hidden'}`}>Cerrar Sesión</span>
                </button>
            </div>
        </aside>
    );
};

const AppLayout: React.FC = () => {
    const { usuario, logout } = useAuth();
    const { puntos, heatmapActivo } = useAnalytics();
    const { suspendido, cargando: cargandoLicencia } = useEstadoLicencia();
    const { mostrarNotificacion } = useNotificacion();
    const navigate = ReactRouterDOM.useNavigate();
    const location = ReactRouterDOM.useLocation();
    const [menuAbierto, setMenuAbierto] = useState(window.innerWidth >= 1024);
    const [busquedaAbierta, setBusquedaAbierta] = useState(false);
    const scrollableContainerRef = useRef<HTMLDivElement>(null);
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        const storedTheme = localStorage.getItem('theme');
        if (storedTheme === 'light' || storedTheme === 'dark') return storedTheme;
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    });

    // Fix tutor-role-end-to-end (2026-07-14): el Tutor (consultor) ahora SÍ accede a Tienda
    // y Eventos, así que se retiró el guard que lo redirigía de esas rutas. La visibilidad
    // se controla desde el menú (Eventos solo con inscripción abierta).

    useEffect(() => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        localStorage.setItem('theme', theme);
    }, [theme]);

    // Fix scroll-reset-en-navegacion (2026-07-29): el contenido ruteado vive en este div
    // interno con `overflow-y-auto` (NO document.body/window -- ver BotonVolverArriba, que
    // ya escucha el scroll de esta misma ref), así que un cambio de ruta no reseteaba el
    // scroll nativo del navegador. Se reinicia a 0 en cada cambio de `location.pathname`
    // (SOLO rutas reales, no pestañas internas como el stepper de Centro de Estudios, que
    // usan `useState` propio y no tocan el pathname).
    useEffect(() => {
        scrollableContainerRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }, [location.pathname]);

    // Fix persistencia-de-ruta (2026-07-29): guarda la última ruta real visitada para poder
    // restaurarla en un reinicio total de la app (F5, logout+login, cerrar y reabrir el
    // navegador -- ver `resolverRutaInicial`/lectura en el Route "/" más abajo). Se guarda acá
    // (dentro de AppLayout, que SOLO monta para rutas autenticadas del interior de la app) para
    // que /login, /logout y demás rutas públicas/transitorias nunca se persistan sin necesidad
    // de listarlas a mano.
    useEffect(() => {
        if (debePersistirRuta(location.pathname)) {
            localStorage.setItem(ULTIMA_RUTA_VISITADA_STORAGE_KEY, location.pathname);
        }
    }, [location.pathname]);

    if (!usuario) return null;

    const { tenant, estaCargado } = useTenant();
    const esSuperAdmin = usuario?.email.toLowerCase() === 'aliantlab@gmail.com';

    // SPINNER DE CARGA INICIAL
    if (!estaCargado) {
        return (
            <div className="h-screen flex items-center justify-center bg-tkd-dark text-white">
                <div className="w-12 h-12 border-4 border-tkd-blue border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    // ONBOARDING GUARD: Si el club no ha terminado configuración obligatoria
    // Paso 5 = Completo. Si es menor, y es Admin, forzar Configuración.
    // Si no es Admin, mostrar pantalla de espera.
    if (tenant && (tenant.onboardingStep || 0) < 5 && !esSuperAdmin) {
        if (usuario.rol === RolUsuario.Admin) {
            // Si el Admin intenta ir a otro lado, redirigir a config
            if (location.pathname !== '/configuracion') {
                return <ReactRouterDOM.Navigate to="/configuracion" replace />;
            }
            // Si ya está en /configuracion, dejarlo pasar (el componente VistaConfiguracion manejará el wizard)
        } else {
            return (
                <div className="h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 text-center p-10">
                    <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mb-6 animate-pulse">
                        <IconoConfiguracion className="w-10 h-10 text-yellow-600" />
                    </div>
                    <h1 className="text-3xl font-black uppercase text-gray-900 dark:text-white mb-2">Plataforma en Configuración</h1>
                    <p className="text-gray-500 max-w-md mx-auto">El administrador está terminando de configurar los parámetros iniciales del Dojang.</p>
                    <button onClick={logout} className="mt-8 text-tkd-blue text-xs font-black uppercase tracking-widest hover:underline">Cerrar Sesión</button>
                </div>
            );
        }
    }

    return (
        <div className="relative flex flex-col md:flex-row h-screen md:h-screen bg-tkd-gray dark:bg-gray-950 overflow-hidden" style={{ height: '100dvh' }}>
            <HeatmapOverlay puntos={puntos} activo={heatmapActivo} />
            {menuAbierto && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setMenuAbierto(false)}></div>}
            <BarraLateral usuario={usuario} onLogout={logout} estaAbierta={menuAbierto} onCerrar={() => setMenuAbierto(false)} />

            <main className="flex-1 flex flex-col min-w-0 bg-white dark:bg-gray-900 md:rounded-l-[3rem] shadow-2xl relative overflow-hidden">
                {/* Banner de Estado de Licencia (Solo se muestra si está vencida o suspendida) */}
                {suspendido && !esSuperAdmin && !cargandoLicencia && (
                    <div className="bg-tkd-red text-white py-2.5 px-6 flex justify-between items-center z-[100] animate-pulse">
                        <div className="flex items-center gap-2">
                            <IconoInformacion className="w-4 h-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Suscripción Vencida - Acceso Restringido (Modo Demo Activo)</span>
                        </div>
                        <ReactRouterDOM.Link
                            to="/renovar-licencia"
                            className="bg-white text-tkd-red px-4 py-1.5 rounded-full text-[9px] font-black uppercase hover:bg-gray-100 transition-all shadow-lg"
                        >
                            Pagar & Activar Ahora
                        </ReactRouterDOM.Link>
                    </div>
                )}

                <header className="flex items-center justify-between h-20 px-8 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-white/5 z-20">
                    <button onClick={() => setMenuAbierto(!menuAbierto)} className="p-3 rounded-2xl text-gray-400 hover:text-tkd-dark transition-all hover:bg-gray-50 dark:hover:bg-white/5">
                        <IconoMenu className="w-6 h-6" />
                    </button>
                    <div className="flex items-center space-x-4">
                        {usuario.rol !== RolUsuario.Tutor && (
                            <button onClick={() => setBusquedaAbierta(true)} className="p-3 rounded-2xl text-gray-400 hover:bg-gray-50 transition-all">
                                <IconoBuscar className="w-5 h-5" />
                            </button>
                        )}
                        <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="p-3 rounded-2xl text-gray-400 hover:bg-gray-50 transition-all">
                            {theme === 'light' ? <IconoLuna className="w-5 h-5" /> : <IconoSol className="w-5 h-5" />}
                        </button>
                        <div className="h-8 w-px bg-gray-100 dark:bg-white/10 mx-2"></div>
                        <div className="text-right hidden sm:block">
                            <div className="font-black text-tkd-dark dark:text-white text-sm uppercase tracking-tight leading-none">{usuario.nombreUsuario}</div>
                            <div className="text-[9px] text-tkd-red font-black uppercase tracking-[0.2em] mt-1">{usuario.rol}</div>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto" ref={scrollableContainerRef}>
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="min-h-full">
                        <ReactRouterDOM.Outlet />
                    </motion.div>
                </div>
                <Footer />
            </main>
            <BotonVolverArriba scrollContainerRef={scrollableContainerRef} />
            <ModalBusquedaGlobal abierto={busquedaAbierta} onCerrar={() => setBusquedaAbierta(false)} />
            <AsistenteVirtual />
        </div>
    );
};

// Extraída como función pura exportada (antes vivía inline en el JSX de la ruta "/")
// para que App.routing.test.ts pueda testearla sin renderizar todo el árbol de rutas.
// Fix tutor-role-end-to-end (2026-07-14) + fix Estudiante (línea de uso más abajo):
// Tutor/Estudiante (consultores) van a Centro de Estudios como inicio operativo en vez
// de VistaAdministracion (pantalla de gestión de staff que no deberían ver).
export function obtenerRutaInicioUsuario(usuario: { rol?: RolUsuario } | null | undefined): string {
    if (usuario?.rol === RolUsuario.Tutor || usuario?.rol === RolUsuario.Estudiante) {
        return '/centro-estudios';
    }
    return '/';
}

// --- Persistencia de la última ruta visitada (fix 2026-07-29) ------------------------
// Bug reportado: al refrescar la página, cerrar sesión y volver a entrar, o cerrar y
// reabrir el navegador, el usuario no vuelve a donde estaba -- en el caso observado
// aterrizaba en /configuracion. Investigación: ese aterrizaje en /configuracion es en
// muchos casos el GUARD DE ONBOARDING legítimo (líneas ~220-226, más arriba en este
// archivo), que fuerza a los Admin con onboarding incompleto a /configuracion sin
// importar la ruta guardada -- eso NO se toca ni se puede saltar acá.
// El bug real y separado: con HashRouter, cerrar el navegador entero (no solo
// refrescar) no deja ningún hash en la barra de direcciones, así que la próxima
// visita cae siempre en el path "/" por defecto -- y ese "/" no tenía memoria de la
// sección que el usuario venía usando. Se persiste la ruta real en localStorage
// (sobrevive a un refresh, a un logout/login y a cerrar el navegador -- a diferencia
// de sessionStorage) y solo se consulta para el caso en que el enrutado aterrizaría en
// el "/" genérico (ver Route path="/" en AppRoutes, y `resolverRutaInicial` abajo).
export const ULTIMA_RUTA_VISITADA_STORAGE_KEY = 'tudojang:ultimaRutaVisitada';

// Rutas que nunca son un "destino" real del usuario -- son pasos de autenticación
// transitorios, así que no deben quedar guardadas como última ruta visitada.
const RUTAS_NO_PERSISTIBLES = new Set(['/login', '/logout']);

export function debePersistirRuta(pathname: string): boolean {
    return typeof pathname === 'string' && pathname.length > 0 && !RUTAS_NO_PERSISTIBLES.has(pathname);
}

// Pura y testeable (mismo patrón que obtenerRutaInicioUsuario): decide a qué ruta debe
// aterrizar el usuario cuando el enrutado normal lo mandaría al "/" genérico.
// - Tutor/Estudiante: sin cambios, siempre van a /centro-estudios (ruta ya "significativa",
//   no es el caso que este fix cubre).
// - Resto de roles: si hay una ruta guardada distinta de "/" y persistible, se usa esa en
//   vez de VistaAdministracion. Si no hay nada guardado (primera visita) o la ruta guardada
//   no es válida, se mantiene el comportamiento de siempre ("/").
// Nota de seguridad: si la ruta restaurada ya no es válida para el rol actual (p.ej. quedó
// guardada /configuracion pero el usuario ya no es Admin), el propio Route de destino tiene
// su guard de rol y redirige de vuelta -- ver Route path="/configuracion" más abajo. Ese
// fallback existente es intencional y no se pelea acá.
export function resolverRutaInicial(
    usuario: { rol?: RolUsuario } | null | undefined,
    rutaGuardada: string | null,
): string {
    const rutaPorRol = obtenerRutaInicioUsuario(usuario);
    if (rutaPorRol === '/centro-estudios') return rutaPorRol;
    if (rutaGuardada && rutaGuardada !== '/' && debePersistirRuta(rutaGuardada)) {
        return rutaGuardada;
    }
    return rutaPorRol;
}

// Resuelve el Route path="/" leyendo la ruta guardada dentro de un useEffect (no durante el
// render -- la app corre bajo <React.StrictMode> en index.tsx, que invoca el render de los
// componentes dos veces en desarrollo; mutar un ref o leer/limpiar localStorage directamente
// en el render, como en un intento anterior de este fix, produce un resultado distinto entre
// esa primera invocación descartada y la segunda que sí se comitea, rompiendo la restauración).
// Se consume (removeItem) la ruta guardada apenas se lee: eso es lo que evita el loop de
// redirects si la ruta restaurada ya no es válida para el rol actual y su propio Route la
// rebota de nuevo a "/" (ver resolverRutaInicial) -- en ese rebote, este componente se vuelve a
// montar pero localStorage ya no tiene nada guardado, así que cae directo en VistaAdministracion.
const RutaInicial: React.FC<{ usuario: Usuario | null }> = ({ usuario }) => {
    const navigate = ReactRouterDOM.useNavigate();
    React.useEffect(() => {
        const rutaGuardada = window.localStorage.getItem(ULTIMA_RUTA_VISITADA_STORAGE_KEY);
        if (rutaGuardada) {
            window.localStorage.removeItem(ULTIMA_RUTA_VISITADA_STORAGE_KEY);
        }
        const rutaInicial = resolverRutaInicial(usuario, rutaGuardada);
        if (rutaInicial !== '/') {
            navigate(rutaInicial, { replace: true });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return <VistaAdministracion />;
};

// --- Callback OAuth de Google Drive -------------------------------------------------
// Reconstruido 2026-07-21: el manejo del callback OAuth de Drive vivía en App.tsx en
// junio (funciones construirUrlCallbackDrive/obtenerCodigoCallbackDrive, ver
// docs/DEBUG_DRIVE_OAUTH_CENTRO_ESTUDIOS.md) pero se perdió sin commitear entre sesiones
// concurrentes Claude/Codex. Efecto: BibliotecaView INICIA la conexión (iniciarConexionOAuth
// -> redirect a Google) pero NADIE procesaba la vuelta con el `code`, así que la conexión
// nunca se completaba y quedaba en silencio. Este es el único responsable del callback:
// BibliotecaView ya NO lo procesa localmente (solo lee el resultado en localStorage), para
// no consumir dos veces el `code` (los códigos OAuth de Google son de un solo uso).
export const DRIVE_OAUTH_RETURN_PATH_KEY = 'tudojang:driveOAuthReturnPath';

export interface CallbackDriveParams {
    code: string | null;
    error: string | null;
    /** `state` de OAuth: connectDrive lo setea al tenantId (ver functions/academico/drive.js). */
    state: string;
}

// Extrae los parámetros del callback OAuth de Drive tanto del query string real
// (`https://tudojang.com/?state=..&code=..`, que es donde aterriza Google porque el
// redirect_uri registrado es la raíz) como de un query embebido en el hash
// (`#/centro-estudios?state=..&code=..`). Devuelve null si no es un callback de Drive.
// Un callback válido siempre trae `state` (tenantId) + `code` (éxito) o `error` (rechazo).
export function extraerCallbackDrive(search: string, hash: string): CallbackDriveParams | null {
    const fuentes: string[] = [];
    if (search && search.includes('=')) fuentes.push(search);
    if (hash) {
        const indicePregunta = hash.indexOf('?');
        if (indicePregunta >= 0) fuentes.push(hash.slice(indicePregunta));
    }

    for (const fuente of fuentes) {
        const query = fuente.startsWith('?') ? fuente : `?${fuente}`;
        const params = new URLSearchParams(query);
        const state = params.get('state');
        const code = params.get('code');
        const error = params.get('error');
        if (state && (code || error)) {
            return { code: code ?? null, error: error ?? null, state };
        }
    }
    return null;
}

export function mensajeErrorCallbackDrive(error: string | null): string {
    if (error === 'access_denied') {
        return 'No autorizaste el acceso a Google Drive. Vuelve a conectar y acepta el permiso de lectura para poder importar materiales.';
    }
    return 'Google no completó la autorización de Drive. Vuelve a intentar la conexión desde Centro de Estudios.';
}

const AppRoutes: React.FC = () => {
    const { usuario, cargandoSesion } = useAuth();
    const { tenant } = useTenant();
    const [appDebug, setAppDebug] = React.useState('App Iniciada');

    // Detección SÍNCRONA del callback OAuth de Drive (antes de cualquier return condicional,
    // para no romper el orden de hooks -> minified React error #310, ya sufrido antes en este
    // mismo flujo, ver DEBUG_DRIVE_OAUTH_CENTRO_ESTUDIOS.md §5). Se lee window.location una
    // sola vez al montar: aunque el efecto de abajo recargue la página, en ese ciclo el valor
    // es estable.
    const callbackDrive = React.useMemo(
        () => extraerCallbackDrive(window.location.search, window.location.hash),
        [],
    );
    const [procesandoDrive] = React.useState(() => !!callbackDrive);
    const callbackDriveProcesadoRef = React.useRef(false);

    React.useEffect(() => {
        if ((window as any).Cypress) {
            (window as any).setAppDebugLog = (msg: string) => {
                setAppDebug(prev => prev + " | " + msg);
            };
        }
    }, []);

    // Único responsable de completar el callback OAuth de Drive: intercambia el `code` por la
    // conexión (Cloud Function driveOAuthCallback), persiste el resultado en las MISMAS claves
    // de localStorage que BibliotecaView ya lee, y recarga a una URL hash limpia (sin `?code=`).
    React.useEffect(() => {
        if (!callbackDrive || callbackDriveProcesadoRef.current) return;
        // driveOAuthCallback exige sesión autenticada; esperar a que Firebase la restaure.
        if (cargandoSesion) return;
        callbackDriveProcesadoRef.current = true;

        const tenantId = callbackDrive.state;
        const claveConexion = `tudojang:driveConnection:${tenantId}`;
        const claveError = `tudojang:driveConnectionError:${tenantId}`;
        const returnPath = window.localStorage.getItem(DRIVE_OAUTH_RETURN_PATH_KEY) || '/centro-estudios';

        const finalizar = () => {
            window.localStorage.removeItem(DRIVE_OAUTH_RETURN_PATH_KEY);
            // Recarga completa a hash limpio: garantiza que el `code` (de un solo uso) no se
            // reprocese en un refresh y que BibliotecaView monte leyendo el resultado ya escrito.
            window.location.replace(`${window.location.origin}${window.location.pathname}#${returnPath}`);
        };

        if (callbackDrive.error || !callbackDrive.code) {
            window.localStorage.setItem(claveError, mensajeErrorCallbackDrive(callbackDrive.error));
            finalizar();
            return;
        }

        if (!usuario) {
            window.localStorage.setItem(claveError, 'Tu sesión expiró durante la conexión con Google Drive. Inicia sesión de nuevo y vuelve a conectar.');
            finalizar();
            return;
        }

        // redirectUri debe coincidir EXACTAMENTE con el que usó connectDrive (BibliotecaView
        // envía `${origin}${pathname}`); acá el pathname es el mismo de la raíz de la app.
        const redirectUri = `${window.location.origin}${window.location.pathname}`;
        driveService.procesarCallbackOAuth(tenantId, callbackDrive.code, redirectUri)
            .then((resultado) => {
                window.localStorage.setItem(claveConexion, resultado.connectionId);
                window.localStorage.removeItem(claveError);
            })
            .catch((err) => {
                const mensaje = err instanceof Error && err.message
                    ? err.message
                    : 'No se pudo completar la conexión con Google Drive.';
                window.localStorage.setItem(claveError, mensaje);
            })
            .finally(finalizar);
    }, [callbackDrive, usuario, cargandoSesion]);

    const debugDiv = (window as any).Cypress ? (
        <div id="debug-log-onboarding" className="fixed bottom-0 left-0 bg-black/80 text-white text-[10px] p-2 z-[10000] min-w-full">
            {appDebug} | Host: {window.location.hostname} | FB: {String(isFirebaseConfigured)} | Hash: {window.location.hash} | User: {usuario ? usuario.email : 'No'} | Loading: {cargandoSesion ? 'Yes' : 'No'}
        </div>
    ) : null;

    // Mientras se procesa el callback OAuth de Drive mostramos un estado dedicado (la vista se
    // recarga a /centro-estudios apenas termina): evita un parpadeo de VistaAdministracion con
    // el `?code=` todavía en la URL.
    if (procesandoDrive) return (
        <div className="flex flex-col items-center justify-center h-screen bg-tkd-dark text-white gap-4">
            <div className="w-12 h-12 border-4 border-tkd-blue border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs font-black uppercase tracking-widest">Conectando Google Drive...</p>
            {debugDiv}
        </div>
    );

    if (cargandoSesion) return (
        <div className="flex items-center justify-center h-screen bg-tkd-dark text-white">
            <div className="w-12 h-12 border-4 border-tkd-blue border-t-transparent rounded-full animate-spin"></div>
            {debugDiv}
        </div>
    );

    const host = window.location.hostname;
    const isRootDomain = host === 'tudojang.com' || host === 'www.tudojang.com' || host === 'localhost' || host === '127.0.0.1';

    // Mostrar rutas públicas SOLO si: dominio raíz + sin tenant + sin usuario autenticado
    if (isRootDomain && (!tenant || tenant.slug === 'tudojang') && !usuario) {
        return (
            <>
                <ReactRouterDOM.Routes>
                    <ReactRouterDOM.Route path="/" element={<PublicLanding />} />
                    <ReactRouterDOM.Route path="/registro-escuela" element={<RegistroEscuela />} />
                    <ReactRouterDOM.Route path="/login" element={<Login />} />
                    <ReactRouterDOM.Route path="/master-access" element={<MasterAccess />} />
                    {/* Fix 2026-07-15: alguien que llega desde el link de un correo (activar
                        cuenta / restablecer clave) casi siempre lo hace SIN sesión y SIN tenant
                        aún resuelto (pestaña nueva / incógnito) -- cae justo en este bloque
                        restringido. Faltaban acá, así que el catch-all de abajo las mandaba a
                        "/" sin completar el proceso. Ninguna de las dos depende de `tenant`
                        (ActivarCuenta usa tenantId del query string; RestablecerClave usa
                        oobCode contra Firebase Auth directo), así que son seguras acá. */}
                    <ReactRouterDOM.Route path="/activar-cuenta" element={<VistaActivarCuenta />} />
                    <ReactRouterDOM.Route path="/restablecer-clave" element={<VistaRestablecerClave />} />
                    <ReactRouterDOM.Route path="*" element={<ReactRouterDOM.Navigate to="/" />} />
                </ReactRouterDOM.Routes>
                {debugDiv}
            </>
        );
    }

    const esMaster = usuario?.email.toLowerCase() === 'aliantlab@gmail.com';

    return (
        <>
            <ReactRouterDOM.Routes>
                <ReactRouterDOM.Route
                    path="/login"
                    element={usuario ? (
                        <ReactRouterDOM.Navigate
                            to={usuario.rol === RolUsuario.Tutor
                                ? "/mi-perfil"
                                : (tenant && (tenant.onboardingStep || 0) < 5 && usuario.rol === RolUsuario.Admin
                                    ? "/configuracion"
                                    : "/")
                            }
                            replace
                        />
                    ) : <Login />}
                />
                <ReactRouterDOM.Route path="/registro-escuela" element={<RegistroEscuela />} />
                <ReactRouterDOM.Route path="/inscripcion" element={<PasarelaInscripcion />} /> {/* NUEVA RUTA */}
                <ReactRouterDOM.Route path="/censo/:mionId" element={<CensoPublico />} />
                <ReactRouterDOM.Route path="/evento/:id" element={<EventoPublico />} />
                <ReactRouterDOM.Route path="/salida" element={<VistaSalidaPublica />} />
                <ReactRouterDOM.Route path="/ayuda" element={<VistaAyudaPqrs />} />
                <ReactRouterDOM.Route path="/contrato/:idEstudiante" element={<VistaFirmaContrato />} />
                <ReactRouterDOM.Route path="/firma/:idEstudiante" element={<VistaFirmaConsentimiento />} />
                <ReactRouterDOM.Route path="/firma-imagen/:idEstudiante" element={<VistaFirmaImagen />} />
                <ReactRouterDOM.Route path="/imagen/:idEstudiante" element={<VistaFirmaImagen />} />
                <ReactRouterDOM.Route path="/reportar-pago" element={<ReportarPagoPublico />} />
                {/* Fix tutor-role-end-to-end (2026-07-14): la vista ActivarCuenta existía
                    pero nunca se ruteó — el enlace de invitación (/#/activar-cuenta) caía en
                    el catch-all. Ruta pública (sin login): el tutor/estudiante crea su
                    contraseña acá vía acceptInvitation y luego entra por /login. */}
                <ReactRouterDOM.Route path="/activar-cuenta" element={<VistaActivarCuenta />} />
                {/* Fix UX de restablecimiento de clave (2026-07-15): página propia, con marca,
                    que reemplaza la genérica de Firebase (tudojang.firebaseapp.com/__/auth/action)
                    a la que redirigía sendPasswordResetEmail() del SDK cliente. */}
                <ReactRouterDOM.Route path="/restablecer-clave" element={<VistaRestablecerClave />} />
                <ReactRouterDOM.Route path="/master-access" element={<MasterAccess />} />

                <ReactRouterDOM.Route element={usuario ? <AppLayout /> : <ReactRouterDOM.Navigate to="/login" replace />}>
                    {/* Fix (bug reportado: el login de Estudiante abría en VistaAdministracion, una
                        pantalla de gestión de staff que no debería ver): faltaba el mismo caso
                        especial que ya existía para Tutor. Se redirige a /centro-estudios (no
                        /mi-perfil) para que apenas entre vea sus materiales/clases -- justo lo
                        que este bug le impedía ver -- consistente con la intención de diseño ya
                        documentada en App.routing.test.ts ("Centro de Estudios como inicio
                        operativo" para ambos roles consultor). */}
                    <ReactRouterDOM.Route path="/" element={<RutaInicial usuario={usuario} />} />
                    <ReactRouterDOM.Route path="/estudiantes" element={<VistaEstudiantes />} />
                    <ReactRouterDOM.Route path="/centro-estudios" element={<VistaCentroEstudios />} />
                    <ReactRouterDOM.Route path="/jornadas" element={usuario?.rol === RolUsuario.Admin || usuario?.rol === RolUsuario.Editor ? <VistaJornadas /> : <ReactRouterDOM.Navigate to="/" />} />
                    {/* Subtarea 12.8: gating ampliado respecto de /jornadas -- incluye Asistente y
                        SuperAdmin (roles operativos del tenant, seccion 9 del documento de mejora de
                        Agenda: "otros maestros" pueden VER; Tutor no accede a Agenda).
                        Extension posterior al cierre del modulo 12 (matriz de roles + iconos de la
                        parrilla, decision explicita del usuario, ver CIERRE CENTRO DE ESTUDIOS.md):
                        se agrega RolUsuario.Estudiante en modo SOLO LECTURA (AgendaView.tsx nunca le
                        muestra los iconos de editar/eliminar -- ver puedeEditarJornada). Mantener este
                        set de roles en sync con ROLES_CON_ACCESO_AGENDA de AgendaView.tsx. */}
                    <ReactRouterDOM.Route path="/agenda" element={usuario?.rol === RolUsuario.Admin || usuario?.rol === RolUsuario.Editor || usuario?.rol === RolUsuario.Asistente || usuario?.rol === RolUsuario.SuperAdmin || usuario?.rol === RolUsuario.Maestro || usuario?.rol === RolUsuario.Estudiante || usuario?.rol === RolUsuario.Tutor ? <VistaAgenda /> : <ReactRouterDOM.Navigate to="/" />} />
                    <ReactRouterDOM.Route path="/clase-en-vivo/:jornadaId" element={<ClaseEnVivoView />} />
                    <ReactRouterDOM.Route path="/clase-en-vivo" element={<ClaseEnVivoView />} />
                    {/* Fix tutor-role-end-to-end (2026-07-14): el Tutor (consultor) ahora accede
                        a Tienda y Eventos (solo lectura / inscripción de su hijo). */}
                    <ReactRouterDOM.Route path="/tienda" element={<VistaTienda />} />
                    <ReactRouterDOM.Route path="/eventos" element={<VistaEventos />} />
                    <ReactRouterDOM.Route path="/notificaciones" element={<VistaNotificaciones />} />
                    <ReactRouterDOM.Route path="/buzon" element={<VistaBuzonNotificaciones />} />
                    <ReactRouterDOM.Route path="/mi-perfil" element={<VistaMiPerfil />} />
                    <ReactRouterDOM.Route path="/configuracion" element={usuario?.rol === RolUsuario.Admin ? <VistaConfiguracion /> : <ReactRouterDOM.Navigate to="/" />} />
                    <ReactRouterDOM.Route path="/aliant-control" element={esMaster ? <VistaMasterDashboard /> : <ReactRouterDOM.Navigate to="/" />} />
                    <ReactRouterDOM.Route path="/renovar-licencia" element={<LicenciaSuspendida />} />
                </ReactRouterDOM.Route>
                <ReactRouterDOM.Route path="*" element={<Vista404 />} />
            </ReactRouterDOM.Routes>
            {debugDiv}
        </>
    );
};

const App: React.FC = () => {
    return (
        <ReactRouterDOM.HashRouter>
            <NotificacionProvider>
                <AuthProvider>
                    <BrandingProvider>
                        <AnalyticsProvider>
                            <DataProvider>
                                <NotificacionToast />
                                <AppRoutes />
                            </DataProvider>
                        </AnalyticsProvider>
                    </BrandingProvider>
                </AuthProvider>
            </NotificacionProvider>
        </ReactRouterDOM.HashRouter>
    );
};

export default App;
