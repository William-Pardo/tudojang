// hooks/useEstadoLicencia.ts
import { useConfiguracion } from '../context/DataContext';

export const useEstadoLicencia = () => {
    const { configClub, configNotificaciones } = useConfiguracion();

    // Si no hay configuración cargada todavía, no podemos determinar el estado
    if (!configClub || !configClub.tenantId) {
        return {
            suspendido: false,
            cargando: true,
            diasRestantes: 0,
            fechaVencimiento: '',
            diasGracia: 5,
            plan: 'starter',
            esDemo: false
        };
    }

    const hoy = new Date();
    // Normalizar a medianoche para comparaciones precisas de fechas
    hoy.setHours(0, 0, 0, 0);

    const fechaVencimiento = configClub.fechaVencimiento ? new Date(configClub.fechaVencimiento) : null;
    const diasGracia = configNotificaciones?.diasGraciaSuspension || 5;

    if (!fechaVencimiento) {
        return {
            suspendido: false,
            diasRestantes: 30,
            fechaVencimiento: '',
            diasGracia,
            plan: configClub.plan,
            esDemo: configClub.estadoSuscripcion === 'demo',
            cargando: false
        };
    }

    // Calcular fecha límite (vencimiento + gracia)
    const fechaLimite = new Date(fechaVencimiento);
    fechaLimite.setDate(fechaLimite.getDate() + diasGracia);
    fechaLimite.setHours(23, 59, 59, 999); // Al final del día de gracia

    // Un club está suspendido si:
    // 1. El estado administrativo es explícitamente 'suspendido'
    // 2. Hoy es posterior a la fecha límite (vencimiento + gracia)
    const suspendido = hoy > fechaLimite || configClub.estadoSuscripcion === 'suspendido';

    // Cálculo de días restantes (puede ser negativo si está vencido)
    const diffTime = fechaVencimiento.getTime() - hoy.getTime();
    const diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return {
        suspendido,
        diasRestantes,
        fechaVencimiento: configClub.fechaVencimiento,
        diasGracia,
        plan: configClub.plan,
        esDemo: configClub.estadoSuscripcion === 'demo',
        configClub,
        cargando: false
    };
};
