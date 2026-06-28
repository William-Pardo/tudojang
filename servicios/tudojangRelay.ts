export interface TudojangRelayMessage {
  id?: string;
  phone: string;
  text: string;
  studentName?: string;
  tutorName?: string;
  type?: string;
}

export interface TudojangRelaySettings {
  batchSize?: number;
  maxSessionMessages?: number;
  delayBetweenMessagesMinMs?: number;
  delayBetweenMessagesMaxMs?: number;
  delayBetweenBatchesMinMs?: number;
  delayBetweenBatchesMaxMs?: number;
}

interface RelayResponse {
  ok: boolean;
  error?: string;
  state?: unknown;
}

const WEB_APP_SOURCE = "TUDOJANG_WEB_APP";
const EXTENSION_SOURCE = "TUDOJANG_RELAY_EXTENSION";

let requestCounter = 0;

export const iniciarTudojangRelay = (
  messages: TudojangRelayMessage[],
  settings?: TudojangRelaySettings
): Promise<RelayResponse> => {
  return enviarComandoRelay("TUDOJANG_RELAY_START", { messages, settings });
};

export const obtenerEstadoTudojangRelay = (): Promise<RelayResponse> => {
  return enviarComandoRelay("TUDOJANG_RELAY_GET_STATE");
};

export const pausarTudojangRelay = (): Promise<RelayResponse> => {
  return enviarComandoRelay("TUDOJANG_RELAY_PAUSE");
};

export const continuarTudojangRelay = (): Promise<RelayResponse> => {
  return enviarComandoRelay("TUDOJANG_RELAY_RESUME");
};

export const cancelarTudojangRelay = (): Promise<RelayResponse> => {
  return enviarComandoRelay("TUDOJANG_RELAY_CANCEL");
};

export const abrirWhatsAppRelay = (): Promise<RelayResponse> => {
  return enviarComandoRelay("TUDOJANG_RELAY_OPEN_WHATSAPP");
};

export const escucharEstadoTudojangRelay = (callback: (state: unknown) => void): (() => void) => {
  const handler = (event: MessageEvent) => {
    if (event.source !== window) return;
    if (event.data?.source !== EXTENSION_SOURCE) return;
    if (event.data?.type !== "TUDOJANG_RELAY_STATE_CHANGED") return;
    callback(event.data.state);
  };

  window.addEventListener("message", handler);
  return () => window.removeEventListener("message", handler);
};

function enviarComandoRelay(type: string, payload?: unknown, timeoutMs = 8000): Promise<RelayResponse> {
  if (typeof window === "undefined") {
    return Promise.resolve({ ok: false, error: "Tudojang Relay requiere navegador." });
  }

  const requestId = `relay-${Date.now()}-${requestCounter++}`;

  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener("message", handler);
      resolve({ ok: false, error: "Tudojang Relay no respondio. Verifica que la extension este instalada." });
    }, timeoutMs);

    const handler = (event: MessageEvent) => {
      if (event.source !== window) return;
      if (event.data?.source !== EXTENSION_SOURCE) return;
      if (event.data?.type !== "TUDOJANG_RELAY_RESPONSE") return;
      if (event.data?.requestId !== requestId) return;

      window.clearTimeout(timeout);
      window.removeEventListener("message", handler);
      resolve(event.data.response || { ok: false, error: "Respuesta invalida de Tudojang Relay." });
    };

    window.addEventListener("message", handler);
    window.postMessage({ source: WEB_APP_SOURCE, type, payload, requestId }, window.location.origin);
  });
}
