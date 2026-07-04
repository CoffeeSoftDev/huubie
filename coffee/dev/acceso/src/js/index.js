window.link = "acceso/ctrl/ctrl-access.php";

if (new URLSearchParams(location.search).has('snap')) {
    document.documentElement.classList.add('snap');
}

const stage = document.getElementById('logo-stage');

function playLogo() {
    stage.classList.remove('play');
    void stage.offsetWidth;
    stage.classList.add('play');
}

document.getElementById('btn-replay').addEventListener('click', playLogo);
Promise.race([
    document.fonts.ready,
    new Promise((resolve) => setTimeout(resolve, 800))
]).then(playLogo);

document.getElementById('toggle-pass').addEventListener('click', () => {
    const input = document.getElementById('password');
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    document.getElementById('icon-eye').classList.toggle('hidden', show);
    document.getElementById('icon-eye-off').classList.toggle('hidden', !show);
});

function showLoginError(message) {
    document.getElementById('login-error-text').textContent = message;
    document.getElementById('login-error').classList.add('show');
    document.getElementById('usuario').classList.add('is-invalid');
    document.getElementById('password').classList.add('is-invalid');
}

function hideLoginError() {
    document.getElementById('login-error').classList.remove('show');
    document.getElementById('usuario').classList.remove('is-invalid');
    document.getElementById('password').classList.remove('is-invalid');
}

function setLoginLoading(loading) {
    const btn = document.getElementById('btn-login');
    const txt = document.getElementById('btn-login-text');
    const spinner = document.getElementById('btn-login-spinner');

    btn.disabled = loading;
    txt.textContent = loading ? 'Verificando...' : 'Iniciar sesión';
    spinner.classList.toggle('hidden', !loading);
}

document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    hideLoginError();
    setLoginLoading(true);

    const body = new URLSearchParams();
    body.append('opc', 'login');
    body.append('usuario', document.getElementById('usuario').value);
    body.append('password', document.getElementById('password').value);

    fetch(window.link, {
        method: 'POST',
        body: body
    })
    .then((response) => response.json())
    .then((data) => {
        if (data.status === 200) {
            window.location.href = 'templates/gv-modulos.html';
            return;
        }

        setLoginLoading(false);
        showLoginError(data.message || 'Usuario y/o contraseña incorrectos.');
    })
    .catch(() => {
        setLoginLoading(false);
        showLoginError('No se pudo conectar con el servidor.');
    });
});

document.getElementById('usuario').addEventListener('input', hideLoginError);
document.getElementById('password').addEventListener('input', hideLoginError);
