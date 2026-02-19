
// content.js - Se inyecta SOLAMENTE EN https://web.whatsapp.com/
// Este script tiene acceso al DOM del chat y es el "robot" que escribe.

function log(msg) {
    console.log("%c[Tudojang Sender]%c " + msg, "color:#D32126;font-weight:bold", "color:black");
}

// Escucha comandos (Mensajes)
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.action === "SEND_MESSAGE") {
        const { telefono, mensaje, imagenBase64 } = request.params;

        // 1. Simulación de abrir chat (La forma más segura y estable es por URL)
        // Redirige o navega al chat. Nota: WhatsApp es una SPA (Single Page App).

        // Si queremos hacerlo sin recargar, debemos interactuar con el DOM.
        // ESTRATEGIA: Usar la URL `web.whatsapp.com/send?phone=...&text=...` 
        // Es la API oficial de "Click to Chat" que funciona perfecto en Web.

        // Pero si queremos enviar MASIVO, redirigir recarga la página cada vez (lento).
        // Para masivo, lo ideal es inyectar eventos de teclado.

        // DEMOSTRACIÓN CONCEPTUAL (Versión 1 - Segura): Redirección.
        // Esto garantiza que funcione siempre, aunque WhatsApp cambie sus clases CSS.
        log(`Preparando envío a ${telefono}...`);

        // Si estamos en medio de un chat, intentaremos navegar.
        const url = `https://web.whatsapp.com/send?phone=${telefono}&text=${encodeURIComponent(mensaje)}`;

        // Cambiamos la URL y esperamos a que cargue el botón
        window.location.href = url;

        // Aquí el script moriría al cambiar de página si fuera una navegación completa.
        // Pero en SPAs a veces se mantiene. 
        // Si se recarga, el script se reinicia y debe saber qué hacer (Estado en Storage).
    }
});

// Lógica de "Auto-Click Enviar" al cargar la página
// Si la URL tiene ?phone=... y &text=..., significa que estamos listos para enviar.
window.onload = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const phone = urlParams.get('phone');
    const text = urlParams.get('text');

    if (phone && text) {
        log("Detectado intento de envío automático. Esperando carga de interfaz...");

        // Esperar a que aparezca el botón de enviar (o el input de texto cargado)
        await esperarElemento('footer[class*="_"]'); // Selector genérico de footer

        log("Interfaz cargada. Buscando botón de envío...");

        // INTENTO 1: Buscar botón de enviar (el avioncito)
        // Las clases de WhatsApp cambian semanalmente. Buscamos por atributos ARIA o iconos SVG.
        const botonEnviar = await encontrarBotonEnviar();

        if (botonEnviar) {
            log("Botón encontrado. Enviando en 3 segundos...");
            setTimeout(() => {
                botonEnviar.click();
                log("¡Click realizado! Mensaje enviado.");

                // Notificar al background que terminamos para que mande el siguiente
                chrome.runtime.sendMessage({ action: "MESSAGE_SENT", phone });

                // Opcional: Cerrar pestaña o volver al dashboard
            }, 3000); // Retardo humano para evitar ban
        } else {
            log("Error: No se encontró el botón de enviar. Puede que el número no tenga WhatsApp.");
        }
    }
};

// Helper: Esperar a que un elemento exista en el DOM
function esperarElemento(selector, timeout = 15000) {
    return new Promise((resolve, reject) => {
        const el = document.querySelector(selector);
        if (el) return resolve(el);

        const observer = new MutationObserver((mutations) => {
            const el = document.querySelector(selector);
            if (el) {
                resolve(el);
                observer.disconnect();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        setTimeout(() => {
            observer.disconnect();
            // Resolvemos null para no romper flujos, pero logueamos
            console.warn(`Timeout esperando selector: ${selector}`);
            resolve(null);
        }, timeout);
    });
}

// Helper: Encontrar botón de enviar de forma robusta
async function encontrarBotonEnviar() {
    // Estrategia: Buscar botón que contenga el icono de envío
    // El icono suele tener un path específico d="M1...". 
    // O buscar `span[data-icon="send"]` (funciona en 2024-2025)

    let btn = document.querySelector('span[data-icon="send"]');
    if (btn) return btn.closest('button') || btn.parentElement;

    return null;
}
