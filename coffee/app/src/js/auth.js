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

    function switchTab(tab) {
        clearError();
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

    $(function () {
        if (window.lucide) window.lucide.createIcons();
        initGoogle();

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
