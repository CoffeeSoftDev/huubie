(function ($) {
    'use strict';

    function showError(msg) {
        $('#authError').text(msg).prop('hidden', false);
    }
    function clearError() {
        $('#authError').prop('hidden', true).text('');
    }
    function setBusy($form, busy) {
        $form.find('.auth-btn-primary').prop('disabled', busy);
        $form.find('.auth-spin').prop('hidden', !busy);
    }

    // Vuelve a ocultar las contraseñas que se hayan dejado visibles.
    function hidePasswords() {
        $('.auth-pass .auth-input').attr('type', 'password');
        $('.auth-pass-toggle')
            .attr({ 'aria-label': 'Mostrar contraseña', title: 'Mostrar contraseña' })
            .html('<i data-lucide="eye"></i>');
        if (window.lucide) window.lucide.createIcons();
    }

    function switchTab(tab) {
        clearError();
        hidePasswords();   // no dejar una contraseña a la vista al cambiar de pestaña
        $('.auth-tab').removeClass('active').filter('[data-tab="' + tab + '"]').addClass('active');
        $('#loginForm').prop('hidden', tab !== 'login');
        $('#registerForm').prop('hidden', tab !== 'register');
    }

    function submitForm($form, action) {
        clearError();
        setBusy($form, true);
        const data = $form.serializeArray().reduce(function (acc, f) {
            acc[f.name] = f.value;
            return acc;
        }, { action: action });

        $.post('ctrl/ctrl-auth.php', data)
            .done(function (res) {
                if (res.success) {
                    window.location.href = res.redirect;
                } else {
                    showError(res.message || 'Ocurrió un error');
                }
            })
            .fail(function () {
                showError('No se pudo conectar con el servidor');
            })
            .always(function () {
                setBusy($form, false);
            });
    }

    window.handleGoogleCredential = function (response) {
        clearError();
        $.post('ctrl/ctrl-auth.php', { action: 'google', credential: response.credential })
            .done(function (res) {
                if (res.success) {
                    window.location.href = res.redirect;
                } else {
                    showError(res.message || 'No se pudo iniciar sesión con Google');
                }
            })
            .fail(function () {
                showError('No se pudo conectar con el servidor');
            });
    };

    function initGoogle() {
        if (!window.GOOGLE_CLIENT_ID) {
            $('#googleUnavailable').prop('hidden', false);
            return;
        }
        if (!window.google || !window.google.accounts || !window.google.accounts.id) {
            setTimeout(initGoogle, 150);
            return;
        }
        window.google.accounts.id.initialize({
            client_id: window.GOOGLE_CLIENT_ID,
            callback: window.handleGoogleCredential
        });
        window.google.accounts.id.renderButton(document.getElementById('gsiButton'), {
            theme: 'outline',
            size: 'large',
            width: 320,
            text: 'continue_with'
        });
        $('#googleWrap').prop('hidden', false);
    }

    // Mostrar/ocultar la contraseña. El boton vive DENTRO del <label>, y un clic en
    // el label reenvia el foco al input: por eso se corta la propagacion (si no, el
    // input recupera el foco y el cursor salta al final del texto).
    function togglePassword(e) {
        e.preventDefault();
        e.stopPropagation();

        var $btn   = $(this);
        var $input = $btn.siblings('.auth-input');
        if (!$input.length) return;

        var show = $input.attr('type') === 'password';
        $input.attr('type', show ? 'text' : 'password');

        var label = show ? 'Ocultar contraseña' : 'Mostrar contraseña';
        $btn.attr({ 'aria-label': label, title: label })
            .html('<i data-lucide="' + (show ? 'eye-off' : 'eye') + '"></i>');
        if (window.lucide) window.lucide.createIcons();

        // Devuelve el foco al campo, con el cursor al final del texto.
        var el = $input[0];
        var end = el.value.length;
        el.focus();
        try { el.setSelectionRange(end, end); } catch (_) { /* type=text ya lo permite */ }
    }

    $(function () {
        if (window.lucide) window.lucide.createIcons();
        initGoogle();

        // Delegado: cubre los campos de los dos formularios (login y registro).
        $(document).on('click', '.auth-pass-toggle', togglePassword);

        $('.auth-tab').on('click', function () {
            switchTab($(this).data('tab'));
        });

        $('#loginForm').on('submit', function (e) {
            e.preventDefault();
            submitForm($(this), 'login');
        });

        $('#registerForm').on('submit', function (e) {
            e.preventDefault();
            submitForm($(this), 'register');
        });
    });
})(jQuery);
