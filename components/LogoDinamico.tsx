
// components/LogoDinamico.tsx
import React from 'react';
import { useTenant } from './BrandingProvider';
import { IconoLogoOficial } from './Iconos';

interface Props {
    className?: string;
}

const LogoDinamico: React.FC<Props> = ({ className = "w-12 h-12" }) => {
    const { tenant } = useTenant();

    // 1. Intentar usar el logo del tenant cargado en el contexto
    if (tenant?.logoUrl) {
        return (
            <img
                src={tenant.logoUrl}
                alt={tenant?.nombreClub || "Logo"}
                className={`${className} object-contain animate-fade-in`}
            />
        );
    }

    // 2. Fallback: Intentar recuperar del cache de branding (localStorage) para evitar flickering
    const cachedBranding = localStorage.getItem('tkd_branding_cache');
    if (cachedBranding) {
        try {
            const cache = JSON.parse(cachedBranding);
            if (cache.l) {
                return (
                    <img
                        src={cache.l}
                        alt="Logo Cache"
                        className={`${className} object-contain opacity-50`}
                    />
                );
            }
        } catch (e) { /* ignore */ }
    }

    // 3. Respaldo final: Logo oficial de Tudojang
    return <IconoLogoOficial className={className} />;
};

export default LogoDinamico;
