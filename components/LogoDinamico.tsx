
// components/LogoDinamico.tsx
import React from 'react';
import { useTenant } from './BrandingProvider';
import { IconoLogoOficial } from './Iconos';

interface Props {
    className?: string;
}

const LogoDinamico: React.FC<Props> = ({ className = "w-12 h-12" }) => {
    const { tenant } = useTenant();

    // Si el club tiene un logo configurado en el branding, lo usamos.
    if (tenant?.logoUrl) {
        return (
            <img 
                src={tenant.logoUrl} 
                alt={tenant.nombreClub} 
                className={`${className} object-contain`} 
            />
        );
    }

    // Si no hay logo, usamos el logo oficial de Tudojang/Ga Jog como respaldo
    return <IconoLogoOficial className={className} />;
};

export default LogoDinamico;
