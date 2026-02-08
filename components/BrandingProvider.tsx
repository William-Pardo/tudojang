
// components/BrandingProvider.tsx
import React, { useEffect, useState, createContext, useContext, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { buscarTenantPorSlug, obtenerConfiguracionClub } from '../servicios/configuracionApi';
import { obtenerSolicitudInscripcion } from '../servicios/censoApi';
import { useAuth } from '../context/AuthContext';
import type { ConfiguracionClub } from '../tipos';
import Loader from './Loader';
import { IconoAlertaTriangulo } from './Iconos';
import VistaPasarelaPagos from '../vistas/PasarelaPagos';

interface TenantContextType {
    tenant: ConfiguracionClub | null;
    estaCargado: boolean;
    actualizarBranding: (tenantId: string) => Promise<void>;
}

const TenantContext = createContext<TenantContextType>({
    tenant: null,
    estaCargado: false,
    actualizarBranding: async () => { }
});

const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { usuario } = useAuth();
    const location = useLocation();
    const [tenant, setTenant] = useState<ConfiguracionClub | null>(null);
    const [estado, setEstado] = useState<'cargando' | 'error' | 'vencido' | 'ok'>('cargando');
    const [bypassDev, setBypassDev] = useState(false);
    const [mensajeError, setMensajeError] = useState('');

    const aplicarConfiguracion = useCallback((config: ConfiguracionClub) => {
        setTenant(config);
        // Inyectar CSS Variables
        document.documentElement.style.setProperty('--color-primario', config.colorPrimario);
        document.documentElement.style.setProperty('--color-secundario', config.colorSecundario);
        document.documentElement.style.setProperty('--color-acento', config.colorAcento);

        const hoy = new Date();
        const vencimiento = new Date(config.fechaVencimiento);

        if (config.estadoSuscripcion === 'suspendido' || vencimiento < hoy) {
            setEstado('vencido');
            setMensajeError(`Suscripción expirada.`);
        } else {
            setEstado('ok');
        }
    }, []);

    const actualizarBranding = useCallback(async (tenantIdOrSlug: string) => {
        setEstado('cargando');
        try {
            // Primero intentamos buscarlo como slug
            let config = await buscarTenantPorSlug(tenantIdOrSlug);

            // Si no es un slug válido, intentamos como tenantId directo
            if (!config && tenantIdOrSlug.startsWith('tnt-')) {
                config = await obtenerConfiguracionClub(tenantIdOrSlug);
            }

            if (config) {
                aplicarConfiguracion(config);
            } else {
                setEstado('error');
                setMensajeError(`Academia "${tenantIdOrSlug}" no encontrada.`);
            }
        } catch (e) {
            setEstado('error');
            setMensajeError("Error al actualizar branding.");
        }
    }, [aplicarConfiguracion]);

    useEffect(() => {
        const inicializarSaaS = async () => {
            // 1. PRIORIDAD: Usuario Autenticado
            if (usuario?.tenantId) {
                try {
                    const config = await obtenerConfiguracionClub(usuario.tenantId);
                    if (config) {
                        aplicarConfiguracion(config);
                        return;
                    }
                } catch (e) {
                    console.error("Error cargando branding de usuario:", e);
                }
            }

            // 2. SEGUNDA PRIORIDAD: Contexto de Ruta (Public Pages con ID)
            const path = location.pathname;
            const matchSolicitud = path.match(/\/(unete|contrato|firma|imagen)\/([^/]+)/);
            if (matchSolicitud) {
                const id = matchSolicitud[2];
                try {
                    // Para estas rutas, el ID suele ser de un registro temporal
                    const solicitud = await obtenerSolicitudInscripcion(id);
                    if (solicitud?.tenantId) {
                        const config = await obtenerConfiguracionClub(solicitud.tenantId);
                        if (config) {
                            aplicarConfiguracion(config);
                            return;
                        }
                    }
                } catch (e) {
                    console.warn("No se pudo cargar branding por contexto de ruta.");
                }
            }

            // 3. TERCERA PRIORIDAD: Slug/Hostname (Legacy & Subdomains)
            const host = window.location.hostname;
            let slug = host.split('.')[0];
            const params = new URLSearchParams(window.location.search);
            const slugParam = params.get('s');
            if (slugParam) slug = slugParam;

            const isRoot = host === 'tudojang.com' || host === 'www.tudojang.com' || host === 'tudojang.web.app' || host === 'localhost' || host === '127.0.0.1';

            if (isRoot && (slug === 'tudojang' || slug === 'www' || slug === 'localhost' || slug === '127')) {
                // Fallback para Landing Page o Login Centralizado
                try {
                    const config = await buscarTenantPorSlug('gajog'); // Usamos Ga Jog como branding por defecto
                    if (config) {
                        aplicarConfiguracion(config);
                        return;
                    }
                } catch (e) {
                    setEstado('ok');
                    return;
                }
            }

            // Si llegamos aquí, intentamos con el slug detectado
            try {
                const config = await buscarTenantPorSlug(slug);
                if (config) {
                    aplicarConfiguracion(config);
                } else {
                    setEstado('error');
                    setMensajeError(`Academia "${slug}" no registrada.`);
                }
            } catch (e) {
                setEstado('error');
                setMensajeError("Error de conexión.");
            }
        };

        inicializarSaaS();
    }, [usuario, location.pathname, aplicarConfiguracion]);

    if (estado === 'cargando') {
        return <div className="h-screen flex items-center justify-center bg-tkd-dark"><Loader texto="Personalizando..." /></div>;
    }

    if (estado === 'error') return (
        <div className="h-screen flex flex-col items-center justify-center bg-tkd-dark p-6 text-center">
            <IconoAlertaTriangulo className="w-16 h-16 text-red-500 mb-4" />
            <h1 className="text-white font-black uppercase">Academia No Encontrada</h1>
            <p className="text-gray-400">{mensajeError}</p>
            <button
                onClick={() => window.location.href = '/'}
                className="mt-6 bg-white/10 text-white px-6 py-2 rounded-xl font-black uppercase text-xs"
            >
                Ir al Inicio
            </button>
        </div>
    );

    if (estado === 'vencido' && !bypassDev) {
        return (
            <TenantContext.Provider value={{ tenant, estaCargado: true, actualizarBranding }}>
                <div className="min-h-screen bg-white dark:bg-tkd-dark flex flex-col">
                    <div className="bg-tkd-red text-white py-2 px-4 flex justify-between items-center z-[100] shadow-md">
                        <div className="flex items-center gap-2">
                            <IconoAlertaTriangulo className="w-4 h-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Aviso del Sistema: Suscripción Vencida o Cuenta Suspendida</span>
                        </div>
                        <button
                            onClick={() => setBypassDev(true)}
                            className="bg-white/20 hover:bg-white/40 px-3 py-1 rounded text-[9px] font-black uppercase transition-all"
                        >
                            Ignorar (Debug)
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        <VistaPasarelaPagos />
                    </div>
                </div>
            </TenantContext.Provider>
        );
    }

    return (
        <TenantContext.Provider value={{ tenant, estaCargado: true, actualizarBranding }}>
            {children}
            {bypassDev && (
                <div className="fixed bottom-4 left-4 z-[200] bg-orange-500 text-white px-3 py-1 rounded-full text-[9px] font-black uppercase shadow-lg animate-bounce">
                    Development Bypass Active
                </div>
            )}
        </TenantContext.Provider>
    );
};

export const useTenant = () => useContext(TenantContext);
export default BrandingProvider;
