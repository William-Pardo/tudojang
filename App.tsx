// App.tsx
import React, { useState, useEffect, useRef } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { motion } from 'framer-motion';

import './src/config';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { NotificacionProvider } from './context/NotificacionContext';
import { AnalyticsProvider, useAnalytics } from './context/AnalyticsContext';
import BrandingProvider, { useTenant } from './components/BrandingProvider';
import { RolUsuario, type Usuario } from './tipos';

import PublicLanding from './vistas/PublicLanding'; // Importar la nueva Landing
import Login from './vistas/Login';
import RegistroEscuela from './vistas/RegistroEscuela';
import CambiarPasswordObligatorio from './vistas/CambiarPasswordObligatorio';
import VistaConfiguracion from './vistas/Configuracion';
import VistaAdministracion from './vistas/Administracion';
import { VistaEstudiantes } from './vistas/Estudiantes';
import { VistaEventos } from './vistas/Eventos';
import VistaTienda from './vistas/Tienda';
import VistaNotificaciones from './vistas/Notificaciones';
import VistaMiPerfil from './vistas/MiPerfil';
import Vista404 from './vistas/404';
import VistaSalidaPublica from './vistas/SalidaPublica';
import VistaAyudaPqrs from './vistas/AyudaPqrs';
import VistaMasterDashboard from './vistas/MasterDashboard';

// Vistas de Firma de Documentos
import VistaFirmaConsentimiento from './vistas/FirmaConsentimiento';
import VistaFirmaContrato from './vistas/FirmaContrato';
import VistaFirmaImagen from './vistas/FirmaImagen';
import PasarelaInscripcion from './vistas/PasarelaInscripcion';

import Footer from './components/Footer';
import NotificacionToast from './components/NotificacionToast';
import BotonVolverArriba from './components/BotonVolverArriba';
import ModalBusquedaGlobal from './components/ModalBusquedaGlobal';
import LogoDinamico from './components/LogoDinamico';
import AsistenteVirtual from './components/AsistenteVirtual';
import HeatmapOverlay from './components/HeatmapOverlay';
import {
    IconoCampana, IconoConfiguracion, IconoDashboard, IconoEstudiantes, IconoEventos,
    IconoLogout, IconoLuna, IconoMenu, IconoSol, IconoTienda,
    IconoBuscar, IconoUsuario, IconoAprobar
} from './components/Iconos';

const BarraLateral: React.FC<{ estaAbierta: boolean; onCerrar: () => void; onLogout: () => void, usuario: Usuario }> = ({ estaAbierta, onCerrar, onLogout, usuario }) => {
    const location = ReactRouterDOM.useLocation();
    const esMaster = usuario?.email.toLowerCase() === 'aliantlab@gmail.com';

    const todosLosEnlaces = [
        { ruta: "/", texto: "Administración", icono: IconoDashboard, roles: [RolUsuario.Admin, RolUsuario.Editor, RolUsuario.Asistente, RolUsuario.SuperAdmin] },
        { ruta: "/estudiantes", texto: "Estudiantes", icono: IconoEstudiantes, roles: [RolUsuario.Admin, RolUsuario.Editor, RolUsuario.Asistente, RolUsuario.Tutor] },
        { ruta: "/tienda", texto: "Tienda", icono: IconoTienda, roles: [RolUsuario.Admin, RolUsuario.Editor] },
        { ruta: "/eventos", texto: "Eventos", icono: IconoEventos, roles: [RolUsuario.Admin, RolUsuario.Editor] },
        { ruta: "/notificaciones", texto: "Alertas", icono: IconoCampana, roles: [RolUsuario.Admin, RolUsuario.Editor] },
        { ruta: "/configuracion", texto: "Configuración", icono: IconoConfiguracion, roles: [RolUsuario.Admin] },
    ];

    const enlacesVisibles = todosLosEnlaces.filter(enlace => enlace.roles.includes(usuario.rol));
    const sidebarWidthClass = estaAbierta ? 'w-64' : 'w-20'; // Ancho reducido para PC colapsado

    // Estilo adaptativo para PC: centrado perfecto si está cerrado
    const getButtonStyle = (ruta: string, isLogout: boolean = false) => {
        const isActive = location.pathname === ruta;
        const isPC = window.innerWidth >= 768;

        let baseClasses = `flex items-center transition-all duration-300 uppercase font-black text-[11px] tracking-[0.2em] w-full text-white`;

        if (isPC) {
            // DISEÑO PC: Ocupa todo el ancho, borde rojo si activo, sin padding lateral si cerrado para centrar icono
            return `${baseClasses} py-5 border-r-4 ${estaAbierta ? 'px-8 gap-4' : 'px-0 justify-center'} ${isActive
                ? 'bg-white/10 border-tkd-red'
                : 'bg-transparent border-transparent hover:bg-white/5 opacity-80 hover:opacity-100'}`;
        } else {
            // DISEÑO MÓVIL: Mantiene burbujas
            return `${baseClasses} px-6 py-4 my-2 rounded-2xl mx-4 border ${isActive
                ? 'bg-white/20 border-white/30'
                : 'bg-white/5 border-white/5 opacity-80'}`;
        }
    };

    return (
        <aside className={`bg-tkd-blue text-white flex flex-col fixed inset-y-0 left-0 z-40 h-screen transition-all duration-500 ease-in-out md:relative md:translate-x-0 ${sidebarWidthClass} ${estaAbierta ? 'translate-x-0' : '-translate-x-full shadow-2xl'}`}>
            {/* Header: Logo ajustable */}
            <div className={`flex items-center justify-center h-28 border-b border-white/10 transition-all ${estaAbierta ? 'p-8' : 'p-2'}`}>
                <LogoDinamico className={estaAbierta ? "h-16 w-auto" : "h-10 w-10"} />
            </div>

            {/* Navegación Principal: Solo Iconos si está cerrado en PC */}
            <nav className="flex-grow mt-6 overflow-y-auto no-scrollbar">
                {enlacesVisibles.map((enlace) => (
                    <ReactRouterDOM.Link
                        key={enlace.ruta}
                        to={enlace.ruta}
                        onClick={onCerrar}
                        className={getButtonStyle(enlace.ruta)}
                        title={!estaAbierta ? enlace.texto : undefined}
                    >
                        <enlace.icono className="w-5 h-5 flex-shrink-0" />
                        <span className={`${estaAbierta ? 'block' : 'hidden'}`}>{enlace.texto}</span>
                    </ReactRouterDOM.Link>
                ))}
            </nav>

            {/* Acciones Inferiores: Mi Perfil arriba, Logout abajo */}
            <div className="border-t border-white/10 flex flex-col">
                {esMaster && (
                    <ReactRouterDOM.Link to="/aliant-control" onClick={onCerrar} className={getButtonStyle('/aliant-control')} title={!estaAbierta ? 'Consola Aliant' : undefined}>
                        <IconoAprobar className="w-5 h-5 flex-shrink-0" />
                        <span className={`${estaAbierta ? 'block' : 'hidden'}`}>Consola Aliant</span>
                    </ReactRouterDOM.Link>
                )}

                {/* MI PERFIL */}
                <ReactRouterDOM.Link to="/mi-perfil" onClick={onCerrar} className={getButtonStyle('/mi-perfil')} title={!estaAbierta ? 'Mi Perfil' : undefined}>
                    <IconoUsuario className="w-5 h-5 flex-shrink-0" />
                    <span className={`${estaAbierta ? 'block' : 'hidden'}`}>Mi Perfil</span>
                </ReactRouterDOM.Link>

                {/* CERRAR SESIÓN */}
                <button
                    onClick={onLogout}
                    className={getButtonStyle('/logout', true)}
                    title={!estaAbierta ? 'Cerrar Sesión' : undefined}
                >
                    <IconoLogout className="w-5 h-5 flex-shrink-0" />
                    <span className={`${estaAbierta ? 'block' : 'hidden'}`}>Cerrar Sesión</span>
                </button>
            </div>
        </aside>
    );
};

const AppLayout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
    const { usuario, logout } = useAuth();
    const { puntos, heatmapActivo } = useAnalytics();
    const [menuAbierto, setMenuAbierto] = useState(window.innerWidth >= 1024);
    const [busquedaAbierta, setBusquedaAbierta] = useState(false);
    const scrollableContainerRef = useRef<HTMLDivElement>(null);
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        const storedTheme = localStorage.getItem('theme');
        if (storedTheme === 'light' || storedTheme === 'dark') return storedTheme;
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    });

    useEffect(() => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        localStorage.setItem('theme', theme);
    }, [theme]);

    if (!usuario) return null;

    if (usuario.requiereCambioPassword) {
        return <CambiarPasswordObligatorio />;
    }

    const toggleMenu = () => setMenuAbierto(!menuAbierto);
    const cerrarMenuSiMovil = () => {
        if (window.innerWidth < 1024) setMenuAbierto(false);
    };

    return (
        <div className="relative md:flex h-screen bg-tkd-gray dark:bg-gray-950">
            <HeatmapOverlay puntos={puntos} activo={heatmapActivo} />

            {menuAbierto && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={cerrarMenuSiMovil}></div>}
            <BarraLateral usuario={usuario} onLogout={logout} estaAbierta={menuAbierto} onCerrar={cerrarMenuSiMovil} />

            <main className="flex-1 flex flex-col overflow-hidden">
                <header className="flex items-center justify-between h-20 px-8 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-white/5 z-20">
                    <button onClick={toggleMenu} className="p-3 rounded-2xl text-gray-400 hover:text-tkd-dark focus:outline-none dark:hover:text-white transition-all hover:bg-gray-50 dark:hover:bg-white/5">
                        <IconoMenu className="w-6 h-6" />
                    </button>
                    <div className="flex items-center space-x-4">
                        {usuario.rol !== RolUsuario.Tutor && (
                            <button onClick={() => setBusquedaAbierta(true)} className="p-3 rounded-2xl text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition-all">
                                <IconoBuscar className="w-5 h-5" />
                            </button>
                        )}
                        <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="p-3 rounded-2xl text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition-all">
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
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                        className="h-full"
                    >
                        {children || <ReactRouterDOM.Outlet />}
                    </motion.div>
                </div>
                <Footer />
            </main>
            <BotonVolverArriba scrollContainerRef={scrollableContainerRef as any} />
            <ModalBusquedaGlobal abierto={busquedaAbierta} onCerrar={() => setBusquedaAbierta(false)} />
            <AsistenteVirtual />
        </div>
    );
};

const AppRoutes: React.FC = () => {
    const { usuario, cargandoSesion } = useAuth();
    const { tenant } = useTenant();
    const location = ReactRouterDOM.useLocation();

    // Logger de navegación maestro y corrección de desincronización
    React.useEffect(() => {
        const hashLimpio = window.location.hash.replace('#', '') || '/';
        console.log(`%c[NAV] Cambio detectado: Hash=${hashLimpio} | Pathname=${location.pathname}`, "color: #CD2E3A; font-weight: bold;");

        // Corrección de emergencia si el router se queda pegado en la raíz pero el hash dice que estamos en otro lado
        if (hashLimpio !== location.pathname && hashLimpio !== '/') {
            console.warn("⚠️ Desincronización de ruta detectada. Intentando corregir...");
            // No hacemos nada drástico aún, el HashRouter debería manejarlo, pero logueamos.
        }
    }, [location, window.location.hash]);

    if (cargandoSesion) {
        return <div className="flex items-center justify-center h-screen bg-tkd-dark text-white"><div className="w-12 h-12 border-4 border-tkd-blue border-t-transparent rounded-full animate-spin"></div></div>;
    }

    const host = window.location.hostname;
    const isRootDomain = host === 'tudojang.com' || host === 'www.tudojang.com' || host === 'tudojang.web.app' || host === 'localhost' || host === '127.0.0.1';
    const esMaster = usuario?.email.toLowerCase() === 'aliantlab@gmail.com';
    const isLanding = isRootDomain && (!tenant || tenant.slug === 'gajog');

    return (
        <ReactRouterDOM.Routes>
            {/* RUTA RAÍZ DINÁMICA */}
            <ReactRouterDOM.Route
                path="/"
                element={isLanding ? <PublicLanding /> : (usuario?.rol === RolUsuario.Tutor ? <ReactRouterDOM.Navigate to="/mi-perfil" replace /> : <AppLayout><VistaAdministracion /></AppLayout>)}
            />

            {/* RUTAS PÚBLICAS (ACCESIBLES DESDE CUALQUIER LUGAR) */}
            <ReactRouterDOM.Route path="/login" element={usuario ? <ReactRouterDOM.Navigate to="/" replace /> : <Login />} />
            <ReactRouterDOM.Route path="/registro" element={<RegistroEscuela />} />
            <ReactRouterDOM.Route path="/registro-escuela" element={<RegistroEscuela />} />
            <ReactRouterDOM.Route path="/salida" element={<VistaSalidaPublica />} />
            <ReactRouterDOM.Route path="/ayuda" element={<VistaAyudaPqrs />} />
            <ReactRouterDOM.Route path="/contrato/:idEstudiante" element={<VistaFirmaContrato />} />
            <ReactRouterDOM.Route path="/firma/:idEstudiante" element={<VistaFirmaConsentimiento />} />
            <ReactRouterDOM.Route path="/imagen/:idEstudiante" element={<VistaFirmaImagen />} />
            <ReactRouterDOM.Route path="/unete/:solicitudId" element={<PasarelaInscripcion />} />

            {/* ÁREA PRIVADA */}
            <ReactRouterDOM.Route element={usuario ? <AppLayout /> : <ReactRouterDOM.Navigate to="/login" replace />}>
                <ReactRouterDOM.Route path="/estudiantes" element={<VistaEstudiantes />} />
                <ReactRouterDOM.Route path="/tienda" element={<VistaTienda />} />
                <ReactRouterDOM.Route path="/eventos" element={<VistaEventos />} />
                <ReactRouterDOM.Route path="/notificaciones" element={<VistaNotificaciones />} />
                <ReactRouterDOM.Route path="/mi-perfil" element={<VistaMiPerfil />} />
                <ReactRouterDOM.Route path="/configuracion" element={usuario?.rol === RolUsuario.Admin ? <VistaConfiguracion /> : <ReactRouterDOM.Navigate to="/" />} />
                <ReactRouterDOM.Route path="/aliant-control" element={esMaster ? <VistaMasterDashboard /> : <ReactRouterDOM.Navigate to="/" />} />
            </ReactRouterDOM.Route>

            <ReactRouterDOM.Route path="*" element={<Vista404 />} />
        </ReactRouterDOM.Routes>
    );
};

const App: React.FC = () => {
    return (
        <ReactRouterDOM.HashRouter>
            <NotificacionProvider>
                <BrandingProvider>
                    <AuthProvider>
                        <AnalyticsProvider>
                            <DataProvider>
                                <NotificacionToast />
                                <AppRoutes />
                            </DataProvider>
                        </AnalyticsProvider>
                    </AuthProvider>
                </BrandingProvider>
            </NotificacionProvider>
        </ReactRouterDOM.HashRouter>
    );
};

export default App;
