
// components/HeatmapOverlay.tsx
import React, { useEffect, useRef } from 'react';

import { PuntoCalor } from '../tipos';

interface Props {
    puntos: PuntoCalor[];
    activo: boolean;
}

const HeatmapOverlay: React.FC<Props> = ({ puntos, activo }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!activo || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Ajustar resolución del canvas al tamaño real de la ventana
        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            render();
        };

        const render = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            puntos.forEach(p => {
                const absX = (p.x / 100) * canvas.width;
                const absY = (p.y / 100) * canvas.height;
                const radio = p.tipo === 'click' ? 40 : 25;

                // Crear gradiente radial para efecto de "calor"
                const grad = ctx.createRadialGradient(absX, absY, 0, absX, absY, radio);

                if (p.tipo === 'click') {
                    // Clics: Rojo intenso a transparente
                    grad.addColorStop(0, 'rgba(255, 0, 0, 0.6)');
                    grad.addColorStop(0.5, 'rgba(255, 100, 0, 0.2)');
                    grad.addColorStop(1, 'rgba(255, 0, 0, 0)');
                } else {
                    // Movimiento: Azul/Cian a transparente
                    grad.addColorStop(0, 'rgba(0, 200, 255, 0.3)');
                    grad.addColorStop(1, 'rgba(0, 150, 255, 0)');
                }

                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(absX, absY, radio, 0, Math.PI * 2);
                ctx.fill();
            });
        };

        window.addEventListener('resize', resize);
        resize();

        return () => window.removeEventListener('resize', resize);
    }, [puntos, activo]);

    if (!activo) return null;

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 z-[9999] pointer-events-none opacity-80"
            style={{ mixBlendMode: 'screen' }}
        />
    );
};

export default HeatmapOverlay;
