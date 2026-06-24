import { readFileSync } from 'node:fs';
import { consultarSabonimVirtual, getRemainingQueries } from './soporteService';
import { RolUsuario } from '../tipos';

describe('soporteService por capas', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('responde desde el manual sin consumir consultas de IA', async () => {
        const antes = getRemainingQueries();
        const respuesta = await consultarSabonimVirtual('Como registro la asistencia por QR', '', RolUsuario.Tutor);

        expect(respuesta).toMatch(/Clase en Vivo/i);
        expect(respuesta).not.toContain('[ESCALAR_SOPORTE_MASTER]');
        expect(getRemainingQueries()).toBe(antes);
    });

    it('explica paso a paso como agregar un estudiante', async () => {
        const respuesta = await consultarSabonimVirtual('Como agrego un estudiante', '', RolUsuario.Admin);

        expect(respuesta).toContain('Abre Estudiantes');
        expect(respuesta).toContain('Agregar Estudiante');
        expect(respuesta).toContain('Guardar Estudiante');
        expect(respuesta).not.toContain('[ESCALAR_SOPORTE_MASTER]');
    });

    it('explica como activar el pago anual del formulario desde la configuracion real', async () => {
        const respuesta = await consultarSabonimVirtual(
            'como activo pago anual de formulario',
            '',
            RolUsuario.Admin,
        );

        expect(respuesta).toContain('Configuración > Identidad & Pagos');
        expect(respuesta).toContain('Valor Matrícula / Formulario');
        expect(respuesta).toContain('¿Cobro Anual?');
        expect(respuesta).toContain('establece el valor');
        expect(respuesta).toContain('Guardar Cambios');
        expect(respuesta).not.toContain('Tesorería');
    });

    it('resuelve una pregunta de seguimiento usando el contexto anterior', async () => {
        const respuesta = await consultarSabonimVirtual(
            'como lo ingreso',
            'Usuario: quiero crear un alumno | Asistente: puedo ayudarte con estudiantes',
            RolUsuario.Admin,
        );

        expect(respuesta).toContain('Agregar Estudiante');
        expect(respuesta).toContain('Guardar Estudiante');
    });

    it('pide contexto y no escala automaticamente cuando no hay API de IA', async () => {
        const respuesta = await consultarSabonimVirtual('Como hago esta cosa especial', '', RolUsuario.Admin);

        expect(respuesta).toMatch(/nombre del m[oó]dulo/i);
        expect(respuesta).not.toContain('[ESCALAR_SOPORTE_MASTER]');
    });

    it('mantiene el fallback completamente local aunque exista una API key en el entorno', async () => {
        const apiKeyAnterior = process.env.API_KEY;
        process.env.API_KEY = 'no-debe-usarse';

        try {
            const respuesta = await consultarSabonimVirtual(
                'Como sincronizo el cinturon cuantico',
                '',
                RolUsuario.Admin,
            );

            expect(respuesta).toMatch(/nombre del m[oó]dulo/i);
            expect(respuesta).not.toContain('[ESCALAR_SOPORTE_MASTER]');
        } finally {
            if (apiKeyAnterior === undefined) delete process.env.API_KEY;
            else process.env.API_KEY = apiKeyAnterior;
        }
    });

    it('no contiene SDK, API keys ni llamadas de IA en el servicio del navegador', () => {
        const source = readFileSync('servicios/soporteService.ts', 'utf8');

        expect(source).not.toContain('@google/genai');
        expect(source).not.toMatch(/API_KEY|GoogleGenAI|generateContent/);
    });

    it('ofrece escalamiento cuando el usuario solicita soporte humano', async () => {
        const respuesta = await consultarSabonimVirtual('Quiero hablar con soporte tecnico', '', RolUsuario.Admin);

        expect(respuesta).toContain('[ESCALAR_SOPORTE_MASTER]');
    });

    it('informa cero consultas remotas sin tocar almacenamiento local', () => {
        localStorage.setItem('tkd_sabonim_usage', '{invalido');

        expect(getRemainingQueries()).toBe(0);
        expect(localStorage.getItem('tkd_sabonim_usage')).toBe('{invalido');
    });
});
