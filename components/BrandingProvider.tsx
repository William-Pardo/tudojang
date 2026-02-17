
// components/BrandingProvider.tsx
import React, { useEffect, useState, createContext, useContext } from 'react';
import { buscarTenantPorSlug, obtenerConfiguracionClub } from '../servicios/configuracionApi';
import type { ConfiguracionClub } from '../tipos';
import { CONFIGURACION_CLUB_POR_DEFECTO } from '../constantes';
import Loader from './Loader';
import { IconoAlertaTriangulo } from './Iconos';
import VistaPasarelaPagos from '../vistas/PasarelaPagos';
import { useAuth } from '../context/AuthContext';

interface TenantContextType {
    tenant: ConfiguracionClub | null;
    estaCargado: boolean;
    cargarTenant: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType>({
    tenant: null,
    estaCargado: false,
    cargarTenant: async () => { }
});

const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { usuario } = useAuth();
    const [tenant, setTenant] = useState<ConfiguracionClub | null>(null);
    const [estado, setEstado] = useState<'cargando' | 'error' | 'vencido' | 'ok'>('cargando');
    const [bypassDev, setBypassDev] = useState(false);
    const [mensajeError, setMensajeError] = useState('');

    const cargarTenant = async () => {
        // PRIORIDAD SAAS: Si hay un usuario autenticado, usamos SU configuración
        if (usuario?.tenantId) {
            try {
                const config = await obtenerConfiguracionClub(usuario.tenantId);
                aplicarEstilos(config);
                validarSuscripcion(config);
                return;
            } catch (err) {
                console.error("[BrandingProvider] Error cargando config por usuario:", err);
                // Si falla, seguimos con la lógica de slug como fallback
            }
        }

        const host = window.location.hostname;
        let slug = host.split('.')[0];
        const isRoot = host.includes('tudojang.com') || host.includes('web.app') || host.includes('firebaseapp.com') || host === 'localhost' || host === '127.0.0.1';

        if (isRoot && (slug === 'tudojang' || slug === 'www' || slug === 'localhost' || slug === '127')) {
            setTenant(CONFIGURACION_CLUB_POR_DEFECTO as ConfiguracionClub);
            aplicarEstilos(CONFIGURACION_CLUB_POR_DEFECTO as ConfiguracionClub);
            setEstado('ok');
            return;
        }

        try {
            const config = await buscarTenantPorSlug(slug);
            if (!config) {
                setEstado('error');
                setMensajeError(`Academia "${slug}" no registrada.`);
                return;
            }
            aplicarEstilos(config);
            validarSuscripcion(config);
        } catch (e) {
            setEstado('error');
            setMensajeError("Error de conexión.");
        }
    };

    const aplicarEstilos = (config: ConfiguracionClub) => {
        if (!config) return;
        const p = (!config.colorPrimario || config.colorPrimario === '#000000') ? '#111111' : config.colorPrimario;
        const s = (!config.colorSecundario || config.colorSecundario === '#000000') ? '#0047A0' : config.colorSecundario;
        const a = (!config.colorAcento || config.colorAcento === '#000000') ? '#CD2E3A' : config.colorAcento;

        document.documentElement.style.setProperty('--color-primario', p);
        document.documentElement.style.setProperty('--color-secundario', s);
        document.documentElement.style.setProperty('--color-acento', a);
    };

    const validarSuscripcion = (config: ConfiguracionClub) => {
        const hoy = new Date();
        const vencimiento = new Date(config.fechaVencimiento);

        if (config.estadoSuscripcion === 'suspendido' || vencimiento < hoy) {
            setEstado('vencido');
            setMensajeError(`Suscripción expirada.`);
        } else {
            setEstado('ok');
        }
        setTenant(config);
    };

    useEffect(() => {
        cargarTenant();
    }, [usuario?.tenantId]);

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
            <TenantContext.Provider value={{ tenant, estaCargado: true, cargarTenant }}>
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
        <TenantContext.Provider value={{ tenant, estaCargado: true, cargarTenant }}>
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
