const RELAY_PREFIX = "[Tudojang Relay]";
const SEND_LOCK_KEY = "tudojangRelaySendLock";

log("WhatsApp bridge cargado.");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request?.action === "RELAY_PING_WHATSAPP") {
    sendResponse({ ok: true });
  }
  return false;
});

runWhenReady().catch((error) => {
  reportResult("failed", error.message || "Error iniciando Relay en WhatsApp Web");
});

async function runWhenReady() {
  const params = new URLSearchParams(window.location.search);
  const phone = params.get("phone");
  const text = params.get("text");
  if (!phone || !text) return;

  const lockId = `${phone}:${text}`;
  if (sessionStorage.getItem(SEND_LOCK_KEY) === lockId) return;
  sessionStorage.setItem(SEND_LOCK_KEY, lockId);

  const { relayActiveMessage } = await chrome.storage.local.get("relayActiveMessage");
  if (!relayActiveMessage || relayActiveMessage.phone !== phone) {
    sessionStorage.removeItem(SEND_LOCK_KEY);
    return;
  }

  log(`Preparando envio a ${phone}.`);

  const ready = await waitForWhatsAppReady();
  if (!ready.ok) {
    sessionStorage.removeItem(SEND_LOCK_KEY);
    await reportResult("failed", ready.error);
    return;
  }

  await sleep(1200);

  const invalidNumber = findInvalidNumberMessage();
  if (invalidNumber) {
    sessionStorage.removeItem(SEND_LOCK_KEY);
    await reportResult("failed", "Numero invalido o sin WhatsApp");
    return;
  }

  const sendButton = await waitForSendButton();
  if (!sendButton) {
    sessionStorage.removeItem(SEND_LOCK_KEY);
    await reportResult("failed", "No se encontro el boton de envio");
    return;
  }

  sendButton.click();
  log("Click de envio ejecutado.");
  await sleep(1500);
  await reportResult("sent", "");
}

async function waitForWhatsAppReady() {
  const loginText = await waitForAny([
    () => document.querySelector("canvas[aria-label*='Scan']"),
    () => findText("Use WhatsApp on your computer"),
    () => findText("Usa WhatsApp en tu computadora")
  ], 2500);

  if (loginText) {
    return { ok: false, error: "WhatsApp Web requiere iniciar sesion" };
  }

  const footer = await waitForAny([
    () => document.querySelector("footer"),
    () => document.querySelector("[contenteditable='true'][role='textbox']")
  ], 30000);

  if (!footer) {
    return { ok: false, error: "WhatsApp Web no cargo el chat a tiempo" };
  }

  return { ok: true };
}

async function waitForSendButton() {
  return waitForAny([
    () => buttonFromIcon("send"),
    () => document.querySelector("button[aria-label='Send']"),
    () => document.querySelector("button[aria-label='Enviar']"),
    () => findButtonBySvgTitle("send"),
    () => findButtonBySvgTitle("Enviar")
  ], 20000);
}

function buttonFromIcon(iconName) {
  const icon = document.querySelector(`span[data-icon='${iconName}']`);
  if (!icon) return null;
  return icon.closest("button") || icon.parentElement?.closest("button") || icon.parentElement;
}

function findButtonBySvgTitle(text) {
  const titles = Array.from(document.querySelectorAll("svg title"));
  const title = titles.find((item) => (item.textContent || "").toLowerCase().includes(text.toLowerCase()));
  return title?.closest("button") || null;
}

function findInvalidNumberMessage() {
  const bodyText = (document.body?.innerText || "").toLowerCase();
  const signals = [
    "phone number shared via url is invalid",
    "numero de telefono compartido a traves de la url no es valido",
    "número de teléfono compartido a través de la url no es válido",
    "el numero de telefono no esta en whatsapp",
    "el número de teléfono no está en whatsapp"
  ];
  return signals.some((signal) => bodyText.includes(signal));
}

function findText(text) {
  const bodyText = document.body?.innerText || "";
  return bodyText.includes(text) ? document.body : null;
}

function waitForAny(finders, timeoutMs) {
  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      for (const finder of finders) {
        const found = finder();
        if (found) {
          resolve(found);
          return;
        }
      }

      if (Date.now() - started >= timeoutMs) {
        resolve(null);
        return;
      }

      setTimeout(tick, 400);
    };
    tick();
  });
}

async function reportResult(status, error) {
  await chrome.runtime.sendMessage({
    action: "RELAY_MESSAGE_RESULT",
    result: { status, error }
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(message) {
  console.log(`%c${RELAY_PREFIX}%c ${message}`, "color:#D32126;font-weight:bold", "color:inherit");
}
