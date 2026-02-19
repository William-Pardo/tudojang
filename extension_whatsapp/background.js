
// Background script - Service Worker (Manifest v3)
// Recibe mensajes desde la aplicación web (Tudojang) y coordina acciones.

// Por ahora, actuará como intermediario simple para demostrar la conexión.
// En un futuro, aquí podrías recibir la lista completa de 90 números desde tu SaaS
// y orquestar el envío uno por uno para no bloquear el navegador.

chrome.runtime.onInstalled.addListener(() => {
    console.log('Tudojang Sender instalado correctamente.');
});

// Escucha mensajes desde el popup o desde content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "START_SENDING") {
        console.log("Iniciando envío masivo...", request.data);
        // Aquí lógica futura de cola
        sendResponse({ status: "started" });
    }
    return true;
});
