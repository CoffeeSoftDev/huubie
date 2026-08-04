<?php
// Launcher de aplicaciones del encabezado. Se incluye igual en visor, playground,
// forge y studio: una sola copia del markup para que las cuatro paginas tengan la
// misma rejilla. La logica de abrir/cerrar esta en src/js/launcher.js y cada app
// escucha el evento launcher:launch con su nombre (data-launch).
//
// Bandeja de aplicaciones: rejilla de celdas con el icono en una pastilla plana de
// color y el nombre debajo. Cada app trae su propio tono (data-tone) para que la
// rejilla se reconozca por color, no por leer las etiquetas.
?>
<div class="vsr-launcher">
    <button id="btnLauncher" class="vsr-launcher-trigger" type="button" title="Aplicaciones" aria-label="Abrir aplicaciones" aria-haspopup="menu" aria-expanded="false">
        <i data-lucide="layout-grid" class="w-4 h-4"></i>
    </button>
    <div id="launcherPanel" class="vsr-launcher-panel" role="menu" aria-label="Aplicaciones" hidden>
        <span class="vsr-launcher-title">Aplicaciones</span>
        <div class="vsr-launcher-grid">
            <button type="button" class="vsr-launcher-item" data-launch="todo" data-tone="sky" role="menuitem" title="Tus listas de pendientes">
                <span class="vsr-launcher-badge"><i data-lucide="list-checks"></i></span>
                <span class="vsr-launcher-name">TODO</span>
            </button>
            <button type="button" class="vsr-launcher-item" data-launch="drive" data-tone="violet" role="menuitem" title="Explorar las carpetas de Drive compartidas">
                <span class="vsr-launcher-badge"><i data-lucide="hard-drive"></i></span>
                <span class="vsr-launcher-name">Drive</span>
            </button>
            <button type="button" class="vsr-launcher-item" data-launch="agents" data-tone="amber" role="menuitem" title="Prompt, reglas y memoria de cada agente">
                <span class="vsr-launcher-badge"><i data-lucide="bot"></i></span>
                <span class="vsr-launcher-name">Agentes</span>
            </button>
            <button type="button" class="vsr-launcher-item" data-launch="lab" data-tone="emerald" role="menuitem" title="Afina a un agente probándolo en vivo">
                <span class="vsr-launcher-badge"><i data-lucide="microscope"></i></span>
                <span class="vsr-launcher-name">Lab</span>
            </button>
        </div>
    </div>
</div>
