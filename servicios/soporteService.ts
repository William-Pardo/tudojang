
// servicios/soporteService.ts
import { GoogleGenAI } from "@google/genai";
import { MANUAL_TUDOJANG } from "./baseConocimiento";

const LIMIT_KEY = 'tkd_sabonim_usage';
const MAX_REQUESTS_PER_HOUR = 15; // Aumentado para pruebas de flujo premium

interface UsageData {
    count: number;
    lastReset: number;
}

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
        return "Has alcanzado el límite de consultas por esta hora. Por favor, intenta más tarde.";
    }

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Historial: ${historialPrevio}\nUsuario: ${pregunta}`,
            config: {
                systemInstruction: `Eres el "Sabonim Virtual" de la app Taekwondo Ga Jog. 
                TU MISIÓN: Responder dudas del personal sobre cómo usar la aplicación basándote EXCLUSIVAMENTE en el manual.
                TU FUENTE DE VERDAD: \n${MANUAL_TUDOJANG}\n
                REGLAS CRÍTICAS:
                1. Responde en máximo 2 oraciones breves.
                2. Si la duda no está en el manual, o el usuario parece frustrado, o pide hablar con un humano, DEBES incluir exactamente la etiqueta: [ESCALAR_SOPORTE_MASTER].
                3. Usa un tono marcial.
                4. Ejemplo de escalado: "Lo siento Sabonim, esa configuración requiere intervención técnica avanzada. [ESCALAR_SOPORTE_MASTER]"`,
                temperature: 0.1,
            },
        });

        incrementUsage();
        return response.text || "No pude procesar tu consulta, Sabonim.";
    } catch (error) {
        console.error("Error en Sabonim Virtual:", error);
        return "Error de conexión con el Sabonim Virtual. Intenta más tarde.";
    }
};

export const getRemainingQueries = (): number => {
    const { remaining } = checkRateLimit();
    return remaining;
};
