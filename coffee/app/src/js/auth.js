(function ($) {
    'use strict';

    // Usuario recordado en ESTE navegador: correo, nombre y avatar para saludar, mas
    // el metodo con el que suele entrar. Nunca la contrasena ni el PIN — recordar al
    // usuario es ahorrarle escribir su correo, no saltarse el acceso.
    const REMEMBER_KEY = 'coffee:auth:remember:v1';

    function loadRemembered() {
        try {
            const raw = localStorage.getItem(REMEMBER_KEY);
            const val = raw ? JSON.parse(raw) : null;
            return (val && val.email) ? val : null;
        } catch (e) { return null; }
    }

    function saveRemembered(user, email, method) {
        try {
            localStorage.setItem(REMEMBER_KEY, JSON.stringify({
                email:    (user && user.email) || email || '',
                name:     (user && user.name) || '',
                initials: (user && user.initials) || '',
                avatar:   (user && user.avatar_url) || '',
                method:   method === 'pin' ? 'pin' : 'password'
            }));
        } catch (e) { /* modo privado o sin cuota: se entra igual, solo no se recuerda */ }
    }

    function clearRemembered() {
        try { localStorage.removeItem(REMEMBER_KEY); } catch (e) {}
    }

    // Iniciales de respaldo cuando el servidor todavia no dijo el nombre (p.ej. se
    // recordo antes de que el login devolviera la ficha del usuario).
    function initialsOf(user) {
        if (user.initials) return user.initials;
        const src = (user.name || user.email || '').trim();
        return src ? src.slice(0, 2).toUpperCase() : 'US';
    }

    // Pinta (o quita) la tarjeta del usuario recordado. Con tarjeta visible el campo
    // de correo se oculta pero conserva su valor: el POST sigue llevando el correo.
    function applyRemembered() {
        const user = loadRemembered();
        const $card = $('#rememberedUser');

        if (!user) {
            $card.prop('hidden', true);
            $('#loginForm [data-email-field]').prop('hidden', false);
            $('#rememberMe').prop('checked', true);
            return;
        }

        $('#loginForm input[name="email"]').val(user.email);
        $('#loginForm [data-email-field]').prop('hidden', true);
        $('#rememberedName').text(user.name || user.email);
        $('#rememberedEmail').text(user.email);
        const $avatar = $('#rememberedAvatar');
        if (user.avatar) $avatar.empty().append($('<img>').attr({ src: user.avatar, alt: '' }));
        else             $avatar.text(initialsOf(user));
        $card.prop('hidden', false);
        $('#rememberMe').prop('checked', true);

        switchMethod(user.method === 'pin' ? 'pin' : 'password');
    }

    // "Usar otra cuenta": olvida al usuario y devuelve el formulario a cero.
    function forgetUser() {
        clearRemembered();
        $('#loginForm input[name="email"]').val('');
        $('#loginForm input[name="password"], #loginForm input[name="pin"]').val('');
        applyRemembered();
        $('#loginForm input[name="email"]').trigger('focus');
    }

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
        // El login vuelve a contraseña, salvo que este equipo recuerde a alguien que
        // entra con PIN: ahi se respeta su método.
        if (tab === 'login') {
            const user = loadRemembered();
            switchMethod(user && user.method === 'pin' ? 'pin' : 'password');
        }
    }

    // Alterna el metodo de acceso del login: 'password' o 'pin'. Solo cambia que
    // campo se muestra; el correo es comun a ambos.
    function switchMethod(method) {
        clearError();
        hidePasswords();
        $('.auth-method-btn').removeClass('active').filter('[data-method="' + method + '"]').addClass('active');
        $('[data-method-field]').prop('hidden', true).filter('[data-method-field="' + method + '"]').prop('hidden', false);
        $('[data-method-field="' + method + '"]').find('.auth-input').trigger('focus');
    }
    function activeMethod() {
        return $('#loginForm .auth-method-btn.active').data('method') || 'password';
    }

    // Un acceso correcto es lo unico que actualiza (o borra) al usuario recordado: si
    // la casilla esta desmarcada se olvida, para que desmarcarla surta efecto tambien
    // cuando ya habia alguien recordado.
    function rememberFromResponse(res, email, method) {
        if ($('#rememberMe').is(':checked')) saveRemembered(res.user, email, method);
        else clearRemembered();
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
                    rememberFromResponse(res, data.email, action === 'login_pin' ? 'pin' : 'password');
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
                    rememberFromResponse(res, (res.user && res.user.email) || '', 'password');
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
        applyRemembered();

        // Delegado: cubre los campos de los dos formularios (login y registro).
        $(document).on('click', '.auth-pass-toggle', togglePassword);

        $('#forgetUserBtn').on('click', forgetUser);

        $('.auth-tab').on('click', function () {
            switchTab($(this).data('tab'));
        });

        $('.auth-method-btn').on('click', function () {
            switchMethod($(this).data('method'));
        });

        // Registro: el campo "Confirmar PIN" solo aparece cuando se escribe un PIN.
        $('#registerForm input[name="pin"]').on('input', function () {
            $('#registerForm [data-pin-confirm]').prop('hidden', $(this).val().length === 0);
        });

        $('#loginForm').on('submit', function (e) {
            e.preventDefault();
            submitForm($(this), activeMethod() === 'pin' ? 'login_pin' : 'login');
        });

        $('#registerForm').on('submit', function (e) {
            e.preventDefault();
            submitForm($(this), 'register');
        });
    });
})(jQuery);
