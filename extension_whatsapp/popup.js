const els = {
  status: document.getElementById("status"),
  openWhatsapp: document.getElementById("openWhatsapp"),
  batch: document.getElementById("batch"),
  batchNumber: document.getElementById("batchNumber"),
  bar: document.getElementById("bar"),
  sent: document.getElementById("sent"),
  failed: document.getElementById("failed"),
  skipped: document.getElementById("skipped"),
  nextAction: document.getElementById("nextAction"),
  currentName: document.getElementById("currentName"),
  currentMeta: document.getElementById("currentMeta"),
  pause: document.getElementById("pause"),
  resume: document.getElementById("resume"),
  skip: document.getElementById("skip"),
  cancel: document.getElementById("cancel"),
  failedList: document.getElementById("failedList")
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindActions();
  await refreshState();

  chrome.runtime.onMessage.addListener((request) => {
    if (request?.action === "RELAY_STATE_CHANGED") {
      render(request.state);
    }
  });

  setInterval(refreshState, 1000);
}

function bindActions() {
  els.openWhatsapp.addEventListener("click", () => send("RELAY_OPEN_WHATSAPP"));
  els.pause.addEventListener("click", () => send("RELAY_PAUSE"));
  els.resume.addEventListener("click", () => send("RELAY_RESUME"));
  els.skip.addEventListener("click", () => send("RELAY_SKIP_CURRENT"));
  els.cancel.addEventListener("click", () => send("RELAY_CANCEL"));
}

async function refreshState() {
  const response = await send("RELAY_GET_STATE", {}, false);
  if (response?.ok) render(response.state);
}

async function send(action, payload = {}, rerender = true) {
  try {
    const response = await chrome.runtime.sendMessage({ action, payload });
    if (rerender && response?.state) render(response.state);
    return response;
  } catch (error) {
    setStatus("error", "Error de conexion");
    return { ok: false, error: error.message };
  }
}

function render(state) {
  const total = state.queue?.length || 0;
  const completed = (state.sent || 0) + (state.failed || 0) + (state.skipped || 0);
  const percentage = total ? Math.round((completed / total) * 100) : 0;

  setStatus(state.status, statusLabel(state.status));
  els.batch.textContent = `${completed} de ${total}`;
  els.batchNumber.textContent = `${state.currentBatchNumber || 0} / ${state.totalBatches || 0}`;
  els.bar.style.width = `${percentage}%`;
  els.sent.textContent = state.sent || 0;
  els.failed.textContent = state.failed || 0;
  els.skipped.textContent = state.skipped || 0;
  els.nextAction.textContent = nextActionText(state);

  const current = state.currentMessage;
  if (current) {
    els.currentName.textContent = current.studentName || current.tutorName || current.phone;
    els.currentMeta.textContent = `${current.type || "Mensaje"} | ${current.tutorName || "Tutor"} | +${current.phone}`;
  } else if (state.status === "waiting") {
    els.currentName.textContent = "Pausa entre envios";
    els.currentMeta.textContent = "Relay continuara automaticamente.";
  } else {
    els.currentName.textContent = "Sin mensaje en curso";
    els.currentMeta.textContent = state.lastError || "Genera un lote desde Tudojang para iniciar Relay.";
  }

  renderFailedList(state.results || []);
  updateButtons(state.status, Boolean(current));
}

function setStatus(status, label) {
  els.status.className = `status ${status || "idle"}`;
  els.status.querySelector("span:last-child").textContent = label;
}

function statusLabel(status) {
  const labels = {
    idle: "Sin lote activo",
    running: "Relay enviando",
    waiting: "Pausa automatica",
    paused: "Relay en pausa",
    done: "Relay finalizado",
    cancelled: "Relay cancelado",
    error: "Error"
  };
  return labels[status] || "Sin lote activo";
}

function nextActionText(state) {
  if (state.status !== "waiting" || !state.nextActionAt) return "";
  const ms = new Date(state.nextActionAt).getTime() - Date.now();
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `Siguiente envio en ${seconds} segundos.`;
}

function renderFailedList(results) {
  const failed = results.filter((item) => item.status === "failed").slice(-8).reverse();
  els.failedList.innerHTML = "";

  if (!failed.length) {
    const li = document.createElement("li");
    li.textContent = "Sin fallidos recientes.";
    els.failedList.appendChild(li);
    return;
  }

  failed.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = `${item.studentName || item.phone}: ${item.error || "Fallido"}`;
    els.failedList.appendChild(li);
  });
}

function updateButtons(status, hasCurrent) {
  const canPause = status === "running" || status === "waiting";
  const canResume = status === "paused";
  const canCancel = ["running", "waiting", "paused"].includes(status);

  els.pause.disabled = !canPause;
  els.resume.disabled = !canResume;
  els.skip.disabled = !hasCurrent;
  els.cancel.disabled = !canCancel;
}
