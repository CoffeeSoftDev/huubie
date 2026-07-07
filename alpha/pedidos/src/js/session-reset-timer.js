(function () {
    // ---------------------------------------------------------------------------
    // Timer flotante TEMPORAL: fuerza un reinicio de sesion (logout -> login) para
    // que los usuarios tomen los cambios recientes del modulo. Una vez reiniciado,
    // NO vuelve a aparecer (marca en localStorage).
    //
    // Para RETIRARLO por completo: borrar este archivo y su <script> en index.php.
    // Para RE-FORZAR un nuevo reinicio a futuro: cambiar VERSION por una fecha nueva.
    // ---------------------------------------------------------------------------

    const VERSION      = '2026-07-07';                     // marca de esta ronda de reinicio
    const MINUTES      = 20;                                // duracion de la cuenta regresiva
    const LOGOUT_URL   = '/alpha/salir/';                  // reinicio de sesion (igual que el navbar)
    const SEEN_KEY     = 'huubieSessionReset';             // "ya reinicio esta version"
    const DEADLINE_KEY = 'huubieSessionResetDeadline';     // instante limite (persiste entre recargas)

    // Si ya reinicio con esta version, no mostrar nunca mas.
    if (localStorage.getItem(SEEN_KEY) === VERSION) return;

    // Deadline persistente: si recarga la pagina, la cuenta regresiva continua desde
    // donde iba (no se puede evadir recargando). Si ya vencio, reinicia de inmediato.
    let deadline = parseInt(localStorage.getItem(DEADLINE_KEY) || '0', 10);
    if (!deadline || isNaN(deadline)) {
        deadline = Date.now() + MINUTES * 60 * 1000;
        localStorage.setItem(DEADLINE_KEY, String(deadline));
    }

    let intervalId = null;

    function remainingSeconds() {
        return Math.max(0, Math.round((deadline - Date.now()) / 1000));
    }

    function fmt(total) {
        const m = Math.floor(total / 60);
        const s = total % 60;
        return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }

    function doReset() {
        if (intervalId) clearInterval(intervalId);
        // Marcar ANTES de salir para que al re-loguear ya no reaparezca.
        localStorage.setItem(SEEN_KEY, VERSION);
        localStorage.removeItem(DEADLINE_KEY);
        window.location.href = LOGOUT_URL;
    }

    const CLOCK = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';

    function build() {
        if (document.getElementById('sessionResetTimer')) return;

        // Si el deadline ya vencio (p.ej. pestana reabierta tarde), reiniciar ya.
        if (remainingSeconds() <= 0) { doReset(); return; }

        const box = document.createElement('div');
        box.id = 'sessionResetTimer';
        box.className = 'fixed bottom-4 right-4 z-[99999] flex items-center gap-3 bg-[#1F2A37] border border-amber-500 text-white rounded-xl shadow-2xl px-4 py-3 max-w-sm';
        box.style.animation = 'sessionResetIn .35s ease';
        box.innerHTML = `
            <div class="w-9 h-9 rounded-full flex items-center justify-center text-white flex-shrink-0" style="background-color:#F59E0B">
                ${CLOCK}
            </div>
            <div class="flex-1">
                <p class="text-sm font-semibold leading-tight">Reinicio de sesión requerido</p>
                <p class="text-xs text-gray-400 leading-tight mt-0.5">Tu sesión se reiniciará en <span id="sessionResetCount" class="font-mono font-semibold text-amber-400">${fmt(remainingSeconds())}</span></p>
            </div>
            <button id="sessionResetNow" class="text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">Reiniciar ahora</button>
        `;
        document.body.appendChild(box);

        document.getElementById('sessionResetNow').addEventListener('click', doReset);

        intervalId = setInterval(tick, 1000);
    }

    function tick() {
        const rem = remainingSeconds();
        const el = document.getElementById('sessionResetCount');
        if (el) el.textContent = fmt(rem);
        if (rem <= 0) doReset();
    }

    const style = document.createElement('style');
    style.textContent = '@keyframes sessionResetIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }';
    document.head.appendChild(style);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', build);
    } else {
        build();
    }
})();
