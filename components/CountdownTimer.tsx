
// components/CountdownTimer.tsx
import React, { useState, useEffect } from 'react';

// Extraído de vistas/MisionKicho.tsx para reutilizarlo también en el formulario público
// (vistas/CensoPublico.tsx) -- tutores/estudiantes necesitan ver el mismo plazo que el
// tenant, no solo el Admin. Formato con días explícitos porque la ventana de Misión KICHO
// pasó de 72h a 5 días (ver MISION_KICHO_DURACION_DIAS en constantes.ts): mostrar solo
// HH:MM:SS habría llegado hasta "120:00:00", ilegible a simple vista.
const CountdownTimer: React.FC<{ fechaExpiracion: string }> = ({ fechaExpiracion }) => {
    const [tiempo, setTiempo] = useState('');
    const [urgencia, setUrgencia] = useState<'normal' | 'media' | 'critica'>('normal');

    useEffect(() => {
        const interval = setInterval(() => {
            const now = new Date().getTime();
            const target = new Date(fechaExpiracion).getTime();
            const diff = target - now;

            if (diff <= 0) {
                setTiempo("EXPIRADO");
                clearInterval(interval);
                return;
            }

            const d = Math.floor(diff / (1000 * 60 * 60 * 24));
            const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((diff % (1000 * 60)) / 1000);

            const horasTotales = diff / (1000 * 60 * 60);
            if (horasTotales < 6) setUrgencia('critica');
            else if (horasTotales < 24) setUrgencia('media');
            else setUrgencia('normal');

            const hhmmss = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
            setTiempo(d > 0 ? `${d}D ${hhmmss}` : hhmmss);
        }, 1000);
        return () => clearInterval(interval);
    }, [fechaExpiracion]);

    const colors = {
        normal: 'text-tkd-blue bg-tkd-blue/10 border-tkd-blue/20',
        media: 'text-orange-500 bg-orange-500/10 border-orange-500/20',
        critica: 'text-tkd-red bg-tkd-red/10 border-tkd-red/20 animate-pulse'
    };

    return (
        <div className={`px-4 py-2 rounded-xl border font-black text-sm tracking-widest flex items-center gap-2 ${colors[urgencia]}`}>
            <span className="text-[10px] opacity-60">CIERRE EN:</span> {tiempo}
        </div>
    );
};

export default CountdownTimer;
