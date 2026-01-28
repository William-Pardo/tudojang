
// utils/beltStyles.ts
import { GradoTKD } from '../tipos';

export interface VisualStyle {
    background: string;
    color: string;
}

const BELT_COLORS = {
    blanco: '#FFFFFF',
    amarillo: '#FFD700',
    verde: '#008000',
    azul: '#0000FF',
    rojo: '#FF0000',
    negro: '#111111',
    oro: '#D4AF37' // Dorado para Dans
};

/**
 * Retorna el estilo CSS (background y color de texto) para un grado específico.
 * Utiliza gradientes para representar las "Puntas".
 */
export const getBeltStyle = (grado: GradoTKD): VisualStyle => {
    switch (grado) {
        case GradoTKD.Blanco:
            return { background: BELT_COLORS.blanco, color: '#111111' };
        case GradoTKD.BlancoPuntaAmarilla:
            return { 
                background: `linear-gradient(90deg, ${BELT_COLORS.blanco} 75%, ${BELT_COLORS.amarillo} 75%)`, 
                color: '#111111' 
            };
        case GradoTKD.Amarillo:
            return { background: BELT_COLORS.amarillo, color: '#111111' };
        case GradoTKD.AmarilloPuntaVerde:
            return { 
                background: `linear-gradient(90deg, ${BELT_COLORS.amarillo} 75%, ${BELT_COLORS.verde} 75%)`, 
                color: '#111111' 
            };
        case GradoTKD.Verde:
            return { background: BELT_COLORS.verde, color: '#FFFFFF' };
        case GradoTKD.VerdePuntaAzul:
            return { 
                background: `linear-gradient(90deg, ${BELT_COLORS.verde} 75%, ${BELT_COLORS.azul} 75%)`, 
                color: '#FFFFFF' 
            };
        case GradoTKD.Azul:
            return { background: BELT_COLORS.azul, color: '#FFFFFF' };
        case GradoTKD.AzulPuntaRoja:
            return { 
                background: `linear-gradient(90deg, ${BELT_COLORS.azul} 75%, ${BELT_COLORS.rojo} 75%)`, 
                color: '#FFFFFF' 
            };
        case GradoTKD.Rojo:
            return { background: BELT_COLORS.rojo, color: '#FFFFFF' };
        case GradoTKD.RojoPuntaNegra:
            return { 
                background: `linear-gradient(90deg, ${BELT_COLORS.rojo} 75%, ${BELT_COLORS.negro} 75%)`, 
                color: '#FFFFFF' 
            };
        case GradoTKD.Negro1Dan:
        case GradoTKD.Negro2Dan:
        case GradoTKD.Negro3Dan:
            return { background: BELT_COLORS.negro, color: BELT_COLORS.oro }; // Texto dorado para Dan
        default:
            return { background: BELT_COLORS.negro, color: '#FFFFFF' };
    }
};
