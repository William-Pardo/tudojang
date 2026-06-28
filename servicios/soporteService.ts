// servicios/soporteService.ts
import { GoogleGenAI } from "@google/genai";
import { MANUAL_TUDOJANG } from "./baseConocimiento";

const LIMIT_KEY = 'tkd_sabonim_usage';
const MAX_REQUESTS_PER_HOUR = 15;

interface UsageData {
    count: number;
    lastReset: number;
}

const respuestasManual: Array<{ claves: string[]; respuesta: string }> = [
    {
        claves: ['relay', 'whatsapp', 'recordatorio', 'alerta', 'mensaje'],
        respuesta: 'Sabonim, ingresa a Alertas y usa "Enviar con Tudojang Relay" para preparar recordatorios por WhatsApp. Manten WhatsApp Web abierto y la extension activa antes de iniciar el lote.'
    },
    {
        claves: ['estudiante', 'alumno', 'ficha', 'eps', 'rh', 'lesion'],
        respuesta: 'Sabonim, en Estudiantes puedes consultar o editar la ficha tecnica: datos medicos, acudientes, grado, sede y estado de pago.'
    },
    {
        claves: ['pago', 'deuda', 'cartera', 'mensualidad', 'saldo'],
        respuesta: 'Sabonim, el modulo de Tesoreria controla cartera, saldos pendientes y pagos registrados. Para cobros, usa Alertas y el enlace de reporte de pago.'
    },
    {
        claves: ['kicho', 'censo', 'carga', 'masiva', 'registro'],
        respuesta: 'Sabonim, la Mision Kicho permite generar un enlace publico de censo, revisar aspirantes y legalizar el lote antes de inyectarlo a estudiantes.'
    },
    {
        claves: ['asistencia', 'clase', 'qr', 'entrada', 'salida'],
        respuesta: 'Sabonim, en Clase en Vivo puedes registrar entrada por QR, marcar al alumno listo y controlar la entrega con personas autorizadas.'
    },
    {
        claves: ['carnet', 'carnetizacion', 'pdf', 'impresion'],
        respuesta: 'Sabonim, Carnetizacion genera PDFs listos para impresion con contraste automatico, formatos Carta, Oficio y CR80.'
    },
    {
        claves: ['configuracion', 'logo', 'color', 'sede', 'licencia'],
        respuesta: 'Sabonim, en Configuracion puedes ajustar branding, sedes y parametros del club. Los limites dependen del plan activo.'
    }
];

const checkRateLimit = (): { allowed: boolean; remaining: number } => {
    const now = Date.now();
    const stored = localStorage.getItem(LIMIT_KEY);
    let usage: UsageData = stored ? JSON.parse(stored) : { count: 0, lastReset: now };

    if (now - usage.lastReset > 3600000) {
        usage = { count: 0, lastReset: now };
    }

    if (usage.count >= MAX_REQUESTS_PER_HOUR) {
        return { allowed: false, remaining: 0 };
    }

    return { allowed: true, remaining: MAX_REQUESTS_PER_HOUR - usage.count };
};

const incrementUsage = () => {
    const stored = localStorage.getItem(LIMIT_KEY);
    let usage: UsageData = stored ? JSON.parse(stored) : { count: 0, lastReset: Date.now() };
    usage.count += 1;
    localStorage.setItem(LIMIT_KEY, JSON.stringify(usage));
};

export const consultarSabonimVirtual = async (pregunta: string, historialPrevio: string): Promise<string> => {
    const { allowed } = checkRateLimit();
    if (!allowed) {
        return "Has alcanzado el limite de consultas por esta hora. Por favor, intenta mas tarde.";
    }

    try {
        if (!process.env.API_KEY) {
            incrementUsage();
            return responderDesdeManual(pregunta);
        }

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: `Historial: ${historialPrevio}\nUsuario: ${pregunta}`,
            config: {
                systemInstruction: `Eres el "Sabonim Virtual" de la app Taekwondo Ga Jog.
                TU MISION: Responder dudas del personal sobre como usar la aplicacion basandote EXCLUSIVAMENTE en el manual.
                TU FUENTE DE VERDAD:\n${MANUAL_TUDOJANG}\n
                REGLAS CRITICAS:
                1. Responde en maximo 2 oraciones breves.
                2. Si la duda no esta en el manual, o el usuario parece frustrado, o pide hablar con un humano, DEBES incluir exactamente la etiqueta: [ESCALAR_SOPORTE_MASTER].
                3. Usa un tono marcial.
                4. Ejemplo de escalado: "Lo siento Sabonim, esa configuracion requiere intervencion tecnica avanzada. [ESCALAR_SOPORTE_MASTER]"`,
                temperature: 0.1,
            },
        });

        incrementUsage();
        return response.text || responderDesdeManual(pregunta);
    } catch (error) {
        console.error("Error en Sabonim Virtual:", error);
        incrementUsage();
        return responderDesdeManual(pregunta);
    }
};

export const getRemainingQueries = (): number => {
    const { remaining } = checkRateLimit();
    return remaining;
};

function responderDesdeManual(pregunta: string): string {
    const texto = normalizar(pregunta);
    const encontrada = respuestasManual.find(item => item.claves.some(clave => texto.includes(clave)));

    if (encontrada) return encontrada.respuesta;

    return 'Sabonim, puedo orientarte sobre estudiantes, pagos, alertas, Tudojang Relay, Mision Kicho, asistencia, carnets y configuracion. Si la duda es tecnica avanzada, solicita soporte Master. [ESCALAR_SOPORTE_MASTER]';
}

function normalizar(valor: string): string {
    return valor
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}
