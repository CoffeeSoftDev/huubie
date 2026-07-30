/* Launcher del encabezado: la rejilla de aplicaciones que abre el boton de cuadros.
 *
 * Vive aparte porque el launcher es el mismo en las cuatro paginas (visor,
 * playground, forge, studio) y su markup viene del partial partials/launcher.php.
 * Aqui solo se abre y se cierra el panel; cada app decide que hace al pulsarla
 * (el TODO lo recoge todo-hub.js con su propio listener). */
(function (global) {
    'use strict';

    $(function () {
        const $btn   = $('#btnLauncher');
        const $panel = $('#launcherPanel');
        if (!$btn.length || !$panel.length) return;

        function close() {
            $panel.prop('hidden', true);
            $btn.attr('aria-expanded', 'false').removeClass('is-open');
        }

        $btn.on('click', function (e) {
            e.stopPropagation();
            const willOpen = $panel.prop('hidden');
            close();
            if (!willOpen) return;
            $panel.prop('hidden', false);
            $btn.attr('aria-expanded', 'true').addClass('is-open');
            if (global.lucide) global.lucide.createIcons();
        });

        // Elegir una app cierra la rejilla y anuncia cual se pidio. Se avisa por
        // evento y no por burbujeo del clic porque el panel corta la propagacion
        // (ver abajo), asi que una app no puede escuchar en document.
        $panel.on('click', '[data-launch]', function () {
            const name = $(this).data('launch');
            close();
            $(document).trigger('launcher:launch', [name]);
        });

        // Un clic en el hueco del panel no debe cerrarlo (se pincha al fallar el
        // tiro), pero cualquier clic fuera si.
        $panel.on('click', function (e) { e.stopPropagation(); });
        $(document).on('click.vsrLauncher', close);
        $(document).on('keydown.vsrLauncher', function (e) {
            if (e.key === 'Escape' && !$panel.prop('hidden')) close();
        });
    });
})(window);
