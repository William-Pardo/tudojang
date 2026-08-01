// servicios/geminiService.test.ts
import { describe, it, expect } from '@jest/globals';
import { generarMensajePersonalizado } from './geminiService';
import { TipoNotificacion, EstadoPago, GradoTKD, GrupoEdad, type Estudiante, type ConfiguracionClub } from '../tipos';

// Estas pruebas se enfocan exclusivamente en la lógica de armado de `medios`/`mediosPago`
// que alimenta el placeholder {{MEDIOS_PAGO}} (líneas 41-46 de geminiService.ts). Se usa
// TipoNotificacion.AvisoVencimiento porque sus 3 plantillas en PLANTILLAS_NOTIFICACIONES
// incluyen {{MEDIOS_PAGO}} y, a diferencia de RecordatorioPago, no requiere datosAdicionales
// con programas/sedes para calcular montos (esa rama es una lógica no relacionada con este
// cambio). La plantilla se elige con Math.random() dentro de la función -- no hay seam para
// fijar el índice sin modificar el código de producción -- por eso se afirma sobre el
// contenido de {{MEDIOS_PAGO}} vía regex, que es estable sin importar cuál de las 3
// plantillas se eligió.

const estudianteBase: Estudiante = {
    id: '1',
    tenantId: 'test-tenant',
    nombres: 'Ana',
    apellidos: 'García',
    numeroIdentificacion: '12345',
    fechaNacimiento: '2010-01-01',
    grado: GradoTKD.Blanco,
    grupo: GrupoEdad.Precadetes,
    horasAcumuladasGrado: 0,
    sedeId: '1',
    estadoPago: EstadoPago.Pendiente,
    fechaIngreso: '2022-01-01',
    saldoDeudor: 50000,
    historialPagos: [],
    consentimientoInformado: false,
    contratoServiciosFirmado: false,
    consentimientoImagenFirmado: false,
    consentimientoFotosVideos: false,
    telefono: '3001234567',
    correo: 'ana@test.com',
    carnetGenerado: false,
    estadoMatricula: 'activo', // requerido en Estudiante (SDD pricing-cupo-real, Bloque 1)
    tutor: {
        nombres: 'Carlos García',
    } as Estudiante['tutor'],
};

const configClubBase: Partial<ConfiguracionClub> = {
    tenantId: 'test-tenant',
    nombreClub: 'Test Club',
};

describe('generarMensajePersonalizado - medios de pago ({{MEDIOS_PAGO}})', () => {
    it('incluye "Nequi (...)" cuando configClub solo tiene pagoNequi definido', async () => {
        const configClub = { ...configClubBase, pagoNequi: '300 111 2222' } as ConfiguracionClub;

        const mensaje = await generarMensajePersonalizado(TipoNotificacion.AvisoVencimiento, estudianteBase, configClub);

        expect(mensaje).toContain('Nequi (300 111 2222)');
        expect(mensaje).not.toContain('Daviplata');
        expect(mensaje).not.toContain('Bre-B');
    });

    it('incluye Nequi, Daviplata, Bre-B y el banco crudo separados por coma en ese orden cuando los 4 están definidos', async () => {
        const configClub = {
            ...configClubBase,
            pagoNequi: '300 111 2222',
            pagoDaviplata: '300 333 4444',
            pagoBreB: 'club@brebank.co',
            pagoBanco: 'Bancolombia Ahorros #987-654321-01',
        } as ConfiguracionClub;

        const mensaje = await generarMensajePersonalizado(TipoNotificacion.AvisoVencimiento, estudianteBase, configClub);

        expect(mensaje).toContain(
            'Nequi (300 111 2222), Daviplata (300 333 4444), Bre-B (club@brebank.co), Bancolombia Ahorros #987-654321-01'
        );
    });

    it('no incluye ningún texto de medios de pago cuando los 4 campos están vacíos', async () => {
        const configClub = {
            ...configClubBase,
            pagoNequi: '',
            pagoDaviplata: '',
            pagoBreB: '',
            pagoBanco: '',
        } as ConfiguracionClub;

        const mensaje = await generarMensajePersonalizado(TipoNotificacion.AvisoVencimiento, estudianteBase, configClub);

        expect(mensaje).not.toContain('Nequi');
        expect(mensaje).not.toContain('Daviplata');
        expect(mensaje).not.toContain('Bre-B');
        // El placeholder {{MEDIOS_PAGO}} debe resolver a cadena vacía, no quedar sin reemplazar.
        expect(mensaje).not.toContain('{{MEDIOS_PAGO}}');
    });
});
