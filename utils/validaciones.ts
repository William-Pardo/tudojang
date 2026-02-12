
import { ConfiguracionClub, Usuario, RolUsuario } from '../tipos';

/**
 * Valida si la academia tiene los datos legales necesarios para emitir contratos.
 */
export const validarIntegridadLegalTenant = (config: ConfiguracionClub | null): {
    valido: boolean;
    faltantes: string[]
} => {
    if (!config) return { valido: false, faltantes: ['No hay configuración disponible'] };

    const faltantes: string[] = [];
    if (!config.nit?.trim()) faltantes.push('NIT / Registro');
    if (!config.representanteLegal?.trim()) faltantes.push('Representante Legal');
    if (!config.ccRepresentante?.trim()) faltantes.push('Documento Representante');
    if (!config.lugarFirma?.trim()) faltantes.push('Ciudad de Firma');
    if (!config.direccionClub?.trim()) faltantes.push('Dirección de la Academia');

    return {
        valido: faltantes.length === 0,
        faltantes
    };
};

/**
 * Valida si un usuario técnico tiene los datos de contrato mínimos para ser emitido.
 */
export const validarIntegridadContratoUsuario = (usuario: Usuario): {
    valido: boolean;
    faltantes: string[]
} => {
    const rolesTecnicos = [RolUsuario.Admin, RolUsuario.Editor, RolUsuario.Asistente, RolUsuario.Tutor];
    if (!rolesTecnicos.includes(usuario.rol)) return { valido: true, faltantes: [] };

    const faltantes: string[] = [];
    if (!usuario.numeroIdentificacion?.trim()) faltantes.push('Documento de Identidad del Colaborador');
    if (!usuario.contrato) {
        faltantes.push('Configuración de Contrato');
    } else {
        if (!usuario.contrato.valorPago || usuario.contrato.valorPago <= 0) faltantes.push('Valor de Pago');
        if (!usuario.contrato.fechaInicio) faltantes.push('Fecha de Inicio');
        if (!usuario.contrato.lugarEjecucion?.trim()) faltantes.push('Lugar de Ejecución');
    }

    return {
        valido: faltantes.length === 0,
        faltantes
    };
};
