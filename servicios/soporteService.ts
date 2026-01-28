
// servicios/soporteService.ts
import { GoogleGenAI } from "@google/genai";
import { MANUAL_TUDOJANG } from "./baseConocimiento";
import { BASE_CONOCIMIENTO_PQRS } from "../constantes";

/**
 * Stage 1: Búsqueda Local (Costo Cero)
 * Busca coincidencias por palabras clave en la base de datos local.
 */
export const buscarRespuestaLocal = (pregunta: string): string | null => {
    const p = pregunta.toLowerCase();
    const match = BASE_CONOCIMIENTO_PQRS.find(item =>
        p.includes(item.pregunta.toLowerCase()) ||
        item.pregunta.toLowerCase().split(' ').some(word => word.length > 4 && p.includes(word))
    );
    return match ? match.respuesta : null;
};

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

const TOTAL_QUOTA_KEY = 'tkd_gemini_daily_audit';

const getDailyAuditCount = (): number => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const stored = localStorage.getItem(TOTAL_QUOTA_KEY);
    const data = stored ? JSON.parse(stored) : { date: today, count: 0 };

    if (data.date !== today) return 0;
    return data.count;
};

const incrementDailyAudit = () => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const current = getDailyAuditCount();
    localStorage.setItem(TOTAL_QUOTA_KEY, JSON.stringify({ date: today, count: current + 1 }));
    console.log(`[AUDIT] Petición exitosa a Gemini API. Total diario acumulado (estimado local): ${current + 1}/50`);
};

export const consultarSabonimVirtual = async (pregunta: string, historialPrevio: string): Promise<string> => {
    const { allowed } = checkRateLimit();
    if (!allowed) {
        return "Tudojang ha alcanzado su límite de cortesía diario. El servicio se restablecerá mañana. (Límite local por hora)";
    }

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: `MANUAL:\n${MANUAL_TUDOJANG}\n\nHISTORIAL:\n${historialPrevio.slice(-1000)}\n\nPREGUNTA:\n${pregunta}`,
            config: {
                systemInstruction: "Eres el Sabonim Virtual. Responde breve (máx 2 oraciones) usando el manual. Tono marcial. Si no sabes o hay queja usa: [ESCALAR_SOPORTE_MASTER].",
                maxOutputTokens: 300,
                temperature: 0.7,
                topP: 0.95,
            },
        });

        const responseText = response.text;

        incrementDailyAudit();
        return responseText || "No pude procesar tu consulta, Sabonim.";
    } catch (error: any) {
        console.error("Error en Sabonim Virtual:", error);

        // Detección específica de error 429 (Límite de cuota)
        if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('Quota')) {
            return "Tudojang ha alcanzado su límite de cortesía diario. El servicio se restablecerá mañana.";
        }

        return "Error de conexión con el Sabonim Virtual. Intenta más tarde.";
    }
};

export const getRemainingQueries = (): number => {
    const { remaining } = checkRateLimit();
    return remaining;
};
