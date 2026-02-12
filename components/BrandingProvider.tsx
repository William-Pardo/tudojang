
// components/BrandingProvider.tsx
import React, { useEffect, useState, createContext, useContext } from 'react';
import { useAuth } from '../context/AuthContext';
import { obtenerConfiguracionClub } from '../servicios/configuracionApi';
import type { ConfiguracionClub } from '../tipos';
import Loader from './Loader';
import { IconoAlertaTriangulo } from './Iconos';

interface TenantContextType {
    tenant: ConfiguracionClub | null;
    estaCargado: boolean;
    cargarTenant: (targetId?: string) => Promise<void>;
}

const TenantContext = createContext<TenantContextType>({ tenant: null, estaCargado: false, cargarTenant: async () => { } });

const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [tenant, setTenant] = useState<ConfiguracionClub | null>(null);
    const [estado, setEstado] = useState<'cargando' | 'error' | 'vencido' | 'ok'>('cargando');
    const [mensajeError, setMensajeError] = useState('');

    const { usuario } = useAuth(); // Added useAuth hook

    const cargarTenant = async (targetId?: string) => {
        const host = window.location.hostname;
        let slug = host.split('.')[0];
        if (slug === 'localhost' || slug === '127' || slug === 'www') slug = 'gajog';

        // Detección ESTRICTA de dominio raíz (para evitar que subdominios se tomen como root)
        const isRoot = host === 'tudojang.com' ||
            host === 'www.tudojang.com' ||
            host === 'tudojang.web.app' ||
            host === 'tudojang.firebaseapp.com' ||
            host === 'localhost' ||
            host === '127.0.0.1';

        try {
            // AISLAMIENTO DE BRANDING: Si es el dominio raíz y no hay usuario, forzamos branding corporativo
            if (isRoot && !usuario && !targetId) {
                document.documentElement.style.setProperty('--color-primario', '#111111');
                document.documentElement.style.setProperty('--color-secundario', '#0047A0');
                document.documentElement.style.setProperty('--color-acento', '#CD2E3A');
                setTenant(null); // No hay academia activa en el home
                setEstado('ok');
                return;
            }

            // Usamos obtenerConfiguracionClub que es más robusto y admite tenantId directo
            const config = await obtenerConfiguracionClub(targetId || slug);

            if (!config) {
                // Si falla y es root, forzamos los corporativos por seguridad
                if (isRoot) {
                    document.documentElement.style.setProperty('--color-primario', '#111111');
                    document.documentElement.style.setProperty('--color-secundario', '#0047A0');
                    document.documentElement.style.setProperty('--color-acento', '#CD2E3A');
                }
                setEstado('error');
                setMensajeError(`Academia no registrada.`);
                return;
            }

            // Inyectar CSS Variables para el Branding Dinámico
            const p = config.colorPrimario || '#111111';
            const s = config.colorSecundario || '#0047A0';
            const a = config.colorAcento || '#CD2E3A';

            document.documentElement.style.setProperty('--color-primario', p);
            document.documentElement.style.setProperty('--color-secundario', s);
            document.documentElement.style.setProperty('--color-acento', a);

            // Guardar en cache para evitar flickering en el siguiente F5
            localStorage.setItem('tkd_branding_cache', JSON.stringify({
                p, s, a,
                l: config.logoUrl || ''
            }));

            const hoy = new Date();
            const vencimiento = new Date(config.fechaVencimiento);

            if (config.estadoSuscripcion === 'suspendido' || (config.fechaVencimiento && vencimiento < hoy)) {
                setEstado('vencido');
                setMensajeError(`Suscripción expirada.`);
                setTenant(config);
            } else {
                setTenant(config);
                setEstado('ok');
            }

        } catch (e) {
            console.error("[BrandingProvider] Error loading identity:", e);
            setEstado('error');
            setMensajeError("Error de conexión al cargar identidad.");
        }
    };

    useEffect(() => {
        // Al montar, intentamos cargar por dominio
        cargarTenant();
    }, []);

    useEffect(() => {
        // Si el usuario cambia (login/logout), forzamos la carga de su tenant específico
        if (usuario?.tenantId) {
            cargarTenant(usuario.tenantId);
        } else if (!usuario) {
            // Si el usuario se va y estamos en root, volvemos a gajog
            cargarTenant();
        }
    }, [usuario]); // Added usuario to dependency array

    if (estado === 'cargando') return <div className="h-screen flex items-center justify-center bg-tkd-dark"><Loader texto="Sincronizando..." /></div>;

    if (estado === 'error') return (
        <div className="h-screen flex flex-col items-center justify-center bg-tkd-dark p-6 text-center">
            <IconoAlertaTriangulo className="w-16 h-16 text-red-500 mb-4" />
            <h1 className="text-white font-black uppercase">Escuela No Encontrada</h1>
            <p className="text-gray-400">{mensajeError}</p>
        </div>
    );

    // MODO SUSCRIPCIÓN VENCIDA: Ya no bloqueamos la renderización completa aquí.
    // El App.tsx se encargará de mostrar banners o redirigir según el estado.

    return (
        <TenantContext.Provider value={{ tenant, estaCargado: true, cargarTenant }}>
            {children}
        </TenantContext.Provider>
    );
};

export const useTenant = () => useContext(TenantContext);
export default BrandingProvider;
