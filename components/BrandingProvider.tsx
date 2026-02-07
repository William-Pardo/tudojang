
// components/BrandingProvider.tsx
import React, { useEffect, useState, createContext, useContext } from 'react';
import { buscarTenantPorSlug } from '../servicios/configuracionApi';
import type { ConfiguracionClub } from '../tipos';
import Loader from './Loader';
import { IconoAlertaTriangulo } from './Iconos';
import VistaPasarelaPagos from '../vistas/PasarelaPagos';

interface TenantContextType {
    tenant: ConfiguracionClub | null;
    estaCargado: boolean;
}

const TenantContext = createContext<TenantContextType>({ tenant: null, estaCargado: false });

const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [tenant, setTenant] = useState<ConfiguracionClub | null>(null);
    const [estado, setEstado] = useState<'cargando' | 'error' | 'vencido' | 'ok'>('cargando');
    const [bypassDev, setBypassDev] = useState(false);
    const [mensajeError, setMensajeError] = useState('');

    useEffect(() => {
        const inicializarSaaS = async () => {
            const host = window.location.hostname;
            let slug = host.split('.')[0];

            // SOPORTE PARA FALLBACK DE SSL (Parámetro ?s=slug)
            const params = new URLSearchParams(window.location.search);
            const slugParam = params.get('s');
            if (slugParam) slug = slugParam;

            // Detección de dominio raíz (Landing Page tudojang.com)
            const isRoot = host === 'tudojang.com' || host === 'www.tudojang.com' || host === 'tudojang.web.app' || host === 'localhost' || host === '127.0.0.1';

            if (isRoot && (slug === 'tudojang' || slug === 'www' || slug === 'localhost' || slug === '127')) {
                // Si es la landing, usamos la configuración de gajog como fallback visual pero marcamos OK
                try {
                    const config = await buscarTenantPorSlug('gajog');
                    setTenant(config);
                    setEstado('ok');
                    return;
                } catch (e) {
                    setEstado('ok'); // Fallback silencioso para la landing
                    return;
                }
            }

            try {
                const config = await buscarTenantPorSlug(slug);

                if (!config) {
                    setEstado('error');
                    setMensajeError(`Academia "${slug}" no registrada.`);
                    return;
                }

                // Inyectar CSS Variables
                document.documentElement.style.setProperty('--color-primario', config.colorPrimario);
                document.documentElement.style.setProperty('--color-secundario', config.colorSecundario);
                document.documentElement.style.setProperty('--color-acento', config.colorAcento);

                const hoy = new Date();
                const vencimiento = new Date(config.fechaVencimiento);

                if (config.estadoSuscripcion === 'suspendido' || vencimiento < hoy) {
                    setEstado('vencido');
                    setMensajeError(`Suscripción expirada.`);
                    setTenant(config);
                } else {
                    setTenant(config);
                    setEstado('ok');
                }

            } catch (e) {
                setEstado('error');
                setMensajeError("Error de conexión.");
            }
        };

        inicializarSaaS();
    }, []);

    if (estado === 'cargando') return <div className="h-screen flex items-center justify-center bg-tkd-dark"><Loader texto="Sincronizando..." /></div>;

    if (estado === 'error') return (
        <div className="h-screen flex flex-col items-center justify-center bg-tkd-dark p-6 text-center">
            <IconoAlertaTriangulo className="w-16 h-16 text-red-500 mb-4" />
            <h1 className="text-white font-black uppercase">Escuela No Encontrada</h1>
            <p className="text-gray-400">{mensajeError}</p>
        </div>
    );

    // MODO SUSCRIPCIÓN VENCIDA: Fondo Blanco Forzado
    if (estado === 'vencido' && !bypassDev) {
        return (
            <TenantContext.Provider value={{ tenant, estaCargado: true }}>
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
                            Omitir para Desarrollo (Debug)
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
        <TenantContext.Provider value={{ tenant, estaCargado: true }}>
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
