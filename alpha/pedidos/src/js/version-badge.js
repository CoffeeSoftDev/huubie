(function () {

    const APP_VERSION = '2026.06.21';

    const KEY = 'huubieAppVersion';
    const seen = localStorage.getItem(KEY);

    if (seen === APP_VERSION) return;

    const ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>`;
    const CLOSE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;

    function dismiss() {
        localStorage.setItem(KEY, APP_VERSION);
        const b = document.getElementById('updateBadge');
        if (b) b.remove();
    }

    function showBadge() {
        if (document.getElementById('updateBadge')) return;

        const badge = document.createElement('div');
        badge.id = 'updateBadge';
        badge.className = 'fixed bottom-4 right-4 z-[99999] flex items-center gap-3 bg-[#1F2A37] border border-[#7C3AED] text-white rounded-xl shadow-2xl px-4 py-3 max-w-sm';
        badge.style.animation = 'updateBadgeIn .35s ease';
        badge.innerHTML = `
            <div class="w-9 h-9 rounded-full flex items-center justify-center text-white flex-shrink-0" style="background-color:#7C3AED">
                ${ICON}
            </div>
            <div class="flex-1">
                <p class="text-sm font-semibold leading-tight">Nueva actualización</p>
                <p class="text-xs text-gray-400 leading-tight mt-0.5">Presiona <kbd class="px-1 py-0.5 rounded bg-[#111928] border border-gray-600 text-[10px]">Ctrl</kbd> + <kbd class="px-1 py-0.5 rounded bg-[#111928] border border-gray-600 text-[10px]">F5</kbd> para ver los cambios</p>
            </div>
            <button id="updateBadgeReload" class="text-xs font-semibold bg-[#1C64F2] hover:bg-[#1a53d4] text-white px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">Recargar</button>
            <button id="updateBadgeClose" class="text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0">${CLOSE}</button>
        `;

        document.body.appendChild(badge);

        document.getElementById('updateBadgeReload').addEventListener('click', function () {
            localStorage.setItem(KEY, APP_VERSION);
            location.reload(true);
        });
        document.getElementById('updateBadgeClose').addEventListener('click', dismiss);
    }

    const style = document.createElement('style');
    style.textContent = `@keyframes updateBadgeIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }`;
    document.head.appendChild(style);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', showBadge);
    } else {
        showBadge();
    }

})();
