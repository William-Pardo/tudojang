const RELAY_BRIDGE_SOURCE = "TUDOJANG_WEB_APP";
const RELAY_EXTENSION_SOURCE = "TUDOJANG_RELAY_EXTENSION";

window.postMessage({
  source: RELAY_EXTENSION_SOURCE,
  type: "TUDOJANG_RELAY_READY",
  extension: "Tudojang Relay",
  version: "1.1.0"
}, window.location.origin);

window.addEventListener("message", async (event) => {
  if (event.source !== window) return;
  if (event.data?.source !== RELAY_BRIDGE_SOURCE) return;

  if (event.data?.type === "TUDOJANG_RELAY_DIAGNOSTIC") {
    window.postMessage({
      source: RELAY_EXTENSION_SOURCE,
      type: "TUDOJANG_RELAY_DIAGNOSTIC_RESPONSE",
      requestId: event.data.requestId,
      response: { ok: true, extension: "Tudojang Relay", bridge: "active" }
    }, window.location.origin);
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage(mapWebAppMessage(event.data));
    window.postMessage({
      source: RELAY_EXTENSION_SOURCE,
      type: "TUDOJANG_RELAY_RESPONSE",
      requestId: event.data.requestId,
      response
    }, window.location.origin);
  } catch (error) {
    window.postMessage({
      source: RELAY_EXTENSION_SOURCE,
      type: "TUDOJANG_RELAY_RESPONSE",
      requestId: event.data.requestId,
      response: { ok: false, error: error.message || "No se pudo conectar con Tudojang Relay" }
    }, window.location.origin);
  }
});

chrome.runtime.onMessage.addListener((request) => {
  if (request?.action !== "RELAY_STATE_CHANGED") return;

  window.postMessage({
    source: RELAY_EXTENSION_SOURCE,
    type: "TUDOJANG_RELAY_STATE_CHANGED",
    state: request.state
  }, window.location.origin);
});

function mapWebAppMessage(data) {
  const actionMap = {
    TUDOJANG_RELAY_START: "RELAY_START_BATCH",
    TUDOJANG_RELAY_GET_STATE: "RELAY_GET_STATE",
    TUDOJANG_RELAY_PAUSE: "RELAY_PAUSE",
    TUDOJANG_RELAY_RESUME: "RELAY_RESUME",
    TUDOJANG_RELAY_CANCEL: "RELAY_CANCEL",
    TUDOJANG_RELAY_OPEN_WHATSAPP: "RELAY_OPEN_WHATSAPP"
  };

  return {
    action: actionMap[data.type] || data.type,
    payload: data.payload
  };
}
