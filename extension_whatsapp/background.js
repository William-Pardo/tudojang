const DEFAULT_SETTINGS = {
  batchSize: 10,
  maxSessionMessages: 100,
  delayBetweenMessagesMinMs: 8000,
  delayBetweenMessagesMaxMs: 15000,
  delayBetweenBatchesMinMs: 45000,
  delayBetweenBatchesMaxMs: 90000
};

const INITIAL_STATE = {
  status: "idle",
  queue: [],
  currentIndex: 0,
  sent: 0,
  failed: 0,
  skipped: 0,
  currentMessage: null,
  lastError: "",
  currentBatchNumber: 0,
  totalBatches: 0,
  nextActionAt: null,
  startedAt: null,
  finishedAt: null,
  settings: DEFAULT_SETTINGS,
  results: []
};

let runtimeTimer = null;
const NEXT_ALARM = "tudojangRelayNextMessage";

chrome.runtime.onInstalled.addListener(async () => {
  const { relayState } = await chrome.storage.local.get("relayState");
  if (!relayState) {
    await chrome.storage.local.set({ relayState: INITIAL_STATE });
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== NEXT_ALARM) return;
  runNextMessage().catch(async (error) => {
    const state = await getState();
    await setState({ ...state, status: "paused", lastError: error.message || "Error ejecutando Relay" });
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMessage(request, sender)
    .then(sendResponse)
    .catch((error) => {
      console.error("[Tudojang Relay]", error);
      sendResponse({ ok: false, error: error.message || "Error desconocido" });
    });
  return true;
});

async function handleMessage(request, sender) {
  switch (request?.action) {
    case "RELAY_START_BATCH":
    case "START_SENDING":
      return startBatch(request.payload || request.data || {});
    case "RELAY_GET_STATE":
      return { ok: true, state: await getState() };
    case "RELAY_PAUSE":
      return pauseRelay();
    case "RELAY_RESUME":
      return resumeRelay();
    case "RELAY_CANCEL":
      return cancelRelay();
    case "RELAY_SKIP_CURRENT":
      return skipCurrent();
    case "RELAY_MESSAGE_RESULT":
    case "MESSAGE_SENT":
      return recordMessageResult(request.result || request);
    case "RELAY_OPEN_WHATSAPP":
      await getOrCreateWhatsAppTab(true);
      return { ok: true };
    default:
      return { ok: false, error: "Accion no soportada" };
  }
}

async function startBatch(payload) {
  const rawMessages = Array.isArray(payload.messages) ? payload.messages : [];
  const settings = normalizeSettings(payload.settings || {});
  const messages = rawMessages
    .map(normalizeMessage)
    .filter((message) => message.phone && message.phone.length >= 12 && message.text)
    .slice(0, settings.maxSessionMessages);

  if (!messages.length) {
    throw new Error("No hay mensajes validos para Tudojang Relay.");
  }

  const state = {
    ...INITIAL_STATE,
    status: "running",
    queue: messages,
    settings,
    totalBatches: Math.ceil(messages.length / settings.batchSize),
    startedAt: new Date().toISOString()
  };

  await setState(state);
  scheduleNext(500);
  return { ok: true, state };
}

async function pauseRelay() {
  clearRuntimeTimer();
  const state = await getState();
  if (state.status !== "running" && state.status !== "waiting") return { ok: true, state };
  const nextState = { ...state, status: "paused", nextActionAt: null };
  await setState(nextState);
  return { ok: true, state: nextState };
}

async function resumeRelay() {
  const state = await getState();
  if (state.status !== "paused") return { ok: true, state };
  const nextState = { ...state, status: "running", lastError: "", nextActionAt: null };
  await setState(nextState);
  scheduleNext(500);
  return { ok: true, state: nextState };
}

async function cancelRelay() {
  clearRuntimeTimer();
  const state = await getState();
  const nextState = {
    ...state,
    status: "cancelled",
    currentMessage: null,
    nextActionAt: null,
    finishedAt: new Date().toISOString()
  };
  await setState(nextState);
  return { ok: true, state: nextState };
}

async function skipCurrent() {
  clearRuntimeTimer();
  const state = await getState();
  if (!state.currentMessage) {
    scheduleNext(500);
    return { ok: true, state };
  }

  const nextState = appendResult(state, {
    ...state.currentMessage,
    status: "skipped",
    error: "Omitido por el usuario",
    finishedAt: new Date().toISOString()
  });
  nextState.skipped += 1;
  nextState.currentIndex += 1;
  nextState.currentMessage = null;
  nextState.status = "running";
  await setState(nextState);
  scheduleNext(500);
  return { ok: true, state: nextState };
}

async function runNextMessage() {
  const state = await getState();
  if (state.status !== "running" && state.status !== "waiting") return;

  if (state.currentIndex >= state.queue.length) {
    const finished = {
      ...state,
      status: "done",
      currentMessage: null,
      nextActionAt: null,
      finishedAt: new Date().toISOString()
    };
    await setState(finished);
    return;
  }

  const currentMessage = state.queue[state.currentIndex];
  const currentBatchNumber = Math.floor(state.currentIndex / state.settings.batchSize) + 1;
  const nextState = {
    ...state,
    status: "running",
    currentMessage,
    currentBatchNumber,
    nextActionAt: null,
    lastError: ""
  };
  await setState(nextState);

  const tab = await getOrCreateWhatsAppTab(true);
  await chrome.storage.local.set({ relayActiveMessage: currentMessage });
  const url = buildWhatsAppUrl(currentMessage);
  await chrome.tabs.update(tab.id, { active: true, url });
}

async function recordMessageResult(result) {
  const state = await getState();
  if (!state.currentMessage) return { ok: true, state };

  const succeeded = result.status === "sent" || result.success === true || result.action === "MESSAGE_SENT";
  const resultRecord = {
    ...state.currentMessage,
    status: succeeded ? "sent" : "failed",
    error: succeeded ? "" : (result.error || "No se pudo confirmar el envio"),
    finishedAt: new Date().toISOString()
  };

  const nextState = appendResult(state, resultRecord);
  nextState.sent += succeeded ? 1 : 0;
  nextState.failed += succeeded ? 0 : 1;
  nextState.currentIndex += 1;
  nextState.currentMessage = null;
  nextState.lastError = resultRecord.error;

  if (nextState.currentIndex >= nextState.queue.length) {
    nextState.status = "done";
    nextState.finishedAt = new Date().toISOString();
    nextState.nextActionAt = null;
    await setState(nextState);
    return { ok: true, state: nextState };
  }

  const completedGroup = nextState.currentIndex % nextState.settings.batchSize === 0;
  const delay = completedGroup
    ? randomBetween(nextState.settings.delayBetweenBatchesMinMs, nextState.settings.delayBetweenBatchesMaxMs)
    : randomBetween(nextState.settings.delayBetweenMessagesMinMs, nextState.settings.delayBetweenMessagesMaxMs);

  nextState.status = "waiting";
  nextState.nextActionAt = new Date(Date.now() + delay).toISOString();
  await setState(nextState);
  scheduleNext(delay);
  return { ok: true, state: nextState };
}

function scheduleNext(delayMs) {
  clearRuntimeTimer();
  chrome.alarms.clear(NEXT_ALARM).catch(() => {});

  if (delayMs >= 30000) {
    chrome.alarms.create(NEXT_ALARM, { when: Date.now() + delayMs });
    return;
  }

  runtimeTimer = setTimeout(() => {
    runtimeTimer = null;
    runNextMessage().catch(async (error) => {
      const state = await getState();
      await setState({ ...state, status: "paused", lastError: error.message || "Error ejecutando Relay" });
    });
  }, Math.max(250, delayMs));
}

function clearRuntimeTimer() {
  if (runtimeTimer) {
    clearTimeout(runtimeTimer);
    runtimeTimer = null;
  }
  chrome.alarms.clear(NEXT_ALARM).catch(() => {});
}

async function getOrCreateWhatsAppTab(active) {
  const tabs = await chrome.tabs.query({ url: "https://web.whatsapp.com/*" });
  if (tabs.length) {
    if (active) await chrome.tabs.update(tabs[0].id, { active: true });
    return tabs[0];
  }
  return chrome.tabs.create({ url: "https://web.whatsapp.com/", active });
}

function buildWhatsAppUrl(message) {
  const phone = encodeURIComponent(message.phone);
  const text = encodeURIComponent(message.text);
  return `https://web.whatsapp.com/send?phone=${phone}&text=${text}`;
}

function normalizeMessage(message, index) {
  const phone = String(message.phone || message.telefono || "").replace(/[^\d]/g, "");
  const normalizedPhone = phone ? (phone.startsWith("57") ? phone : `57${phone}`) : "";
  return {
    id: String(message.id || `relay-${Date.now()}-${index}`),
    phone: normalizedPhone,
    text: String(message.text || message.mensaje || "").trim(),
    studentName: String(message.studentName || message.estudiante || ""),
    tutorName: String(message.tutorName || message.tutor || ""),
    type: String(message.type || message.tipo || "Mensaje")
  };
}

function normalizeSettings(settings) {
  const merged = { ...DEFAULT_SETTINGS, ...settings };
  return {
    batchSize: clampNumber(merged.batchSize, 1, 25, DEFAULT_SETTINGS.batchSize),
    maxSessionMessages: clampNumber(merged.maxSessionMessages, 1, 100, DEFAULT_SETTINGS.maxSessionMessages),
    delayBetweenMessagesMinMs: clampNumber(merged.delayBetweenMessagesMinMs, 3000, 120000, DEFAULT_SETTINGS.delayBetweenMessagesMinMs),
    delayBetweenMessagesMaxMs: clampNumber(merged.delayBetweenMessagesMaxMs, 3000, 180000, DEFAULT_SETTINGS.delayBetweenMessagesMaxMs),
    delayBetweenBatchesMinMs: clampNumber(merged.delayBetweenBatchesMinMs, 10000, 300000, DEFAULT_SETTINGS.delayBetweenBatchesMinMs),
    delayBetweenBatchesMaxMs: clampNumber(merged.delayBetweenBatchesMaxMs, 10000, 300000, DEFAULT_SETTINGS.delayBetweenBatchesMaxMs)
  };
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function randomBetween(min, max) {
  const floor = Math.min(min, max);
  const ceiling = Math.max(min, max);
  return Math.floor(floor + Math.random() * (ceiling - floor + 1));
}

function appendResult(state, result) {
  return {
    ...state,
    results: [...(state.results || []), result].slice(-250)
  };
}

async function getState() {
  const { relayState } = await chrome.storage.local.get("relayState");
  return { ...INITIAL_STATE, ...(relayState || {}), settings: { ...DEFAULT_SETTINGS, ...(relayState?.settings || {}) } };
}

async function setState(state) {
  await chrome.storage.local.set({ relayState: state });
  chrome.runtime.sendMessage({ action: "RELAY_STATE_CHANGED", state }).catch(() => {});
}
