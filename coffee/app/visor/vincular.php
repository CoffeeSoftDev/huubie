<?php
/* Página para vincular una aplicación externa (avatars) con esta cuenta.
 *
 * Es deliberadamente independiente y minúscula: se abre desde la otra aplicación
 * en una pestaña, se copia el código y se cierra. No toca la interfaz del visor
 * ni su menú, así que no hay nada que mantener sincronizado entre las dos.
 *
 * Exige sesión del visor por definición: el código autoriza a publicar en TU
 * biblioteca, así que solo puede pedirlo quien ya demostró ser tú aquí.
 */

require_once __DIR__ . '/../ctrl/auth-session.php';
require_once __DIR__ . '/ctrl/library-roots.php';

$userId = isset($_SESSION['user_id']) ? (int) $_SESSION['user_id'] : 0;
$logueado = $userId > 0;
?>
<!DOCTYPE html>
<html lang="es" data-theme="light">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Vincular aplicación — CoffeeIA</title>
<script src="https://code.jquery.com/jquery-3.7.0.min.js"></script>
<script src="https://unpkg.com/lucide@latest"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
<style>
    :root {
        --bg: #F3F4F6; --card: #fff; --text: #111827; --mute: #6B7280;
        --line: #E5E7EB; --sky: #0284C7; --sky-soft: rgba(2,132,199,.10);
    }
    * { box-sizing: border-box; }
    body {
        margin: 0; min-height: 100vh; display: grid; place-items: center;
        background: var(--bg); color: var(--text);
        font-family: Inter, -apple-system, "Segoe UI", sans-serif; font-size: 14px;
        padding: 24px;
    }
    .card {
        background: var(--card); border: 1px solid var(--line); border-radius: 18px;
        padding: 30px 32px; width: 100%; max-width: 460px;
        box-shadow: 0 4px 24px rgba(17,24,39,.06);
    }
    .ico {
        width: 46px; height: 46px; border-radius: 13px; display: grid; place-items: center;
        background: var(--sky-soft); color: var(--sky); margin-bottom: 16px;
    }
    h1 { font-size: 19px; margin: 0 0 6px; letter-spacing: -.01em; }
    p  { margin: 0 0 18px; color: var(--mute); font-size: 13px; line-height: 1.6; }

    .code {
        display: flex; align-items: center; gap: 12px;
        border: 2px dashed var(--line); border-radius: 12px; padding: 18px;
        background: #FAFBFC; margin-bottom: 12px;
    }
    .code b {
        flex: 1; font-family: "JetBrains Mono", monospace; font-size: 27px;
        letter-spacing: .09em; font-weight: 700; text-align: center; color: var(--text);
    }
    .code.wait b { font-size: 15px; color: var(--mute); font-weight: 500; letter-spacing: 0; }

    .btn {
        display: inline-flex; align-items: center; justify-content: center; gap: 7px;
        border: none; border-radius: 10px; padding: 11px 18px; font-size: 13.5px;
        font-weight: 600; cursor: pointer; font-family: inherit; width: 100%;
        background: var(--sky); color: #fff;
    }
    .btn:hover { filter: brightness(1.08); }
    .btn.ghost { background: #fff; color: var(--text); border: 1px solid var(--line); }
    .btn.icon  { width: auto; padding: 10px 12px; }
    .row { display: flex; gap: 9px; }

    .meta { font-size: 12px; color: var(--mute); text-align: center; margin-top: 14px; }
    .meta b { color: var(--sky); font-variant-numeric: tabular-nums; }
    .steps { margin: 18px 0 0; padding: 16px 18px; background: #FAFBFC; border-radius: 12px; font-size: 12.5px; color: var(--mute); }
    .steps ol { margin: 0; padding-left: 18px; }
    .steps li { margin-bottom: 5px; }
    .steps li:last-child { margin-bottom: 0; }
    .warn { color: #B45309; }
</style>
</head>
<body>
<div class="card">
    <div class="ico"><i data-lucide="link"></i></div>

<?php if (!$logueado): ?>
    <h1>Inicia sesión primero</h1>
    <p>Para vincular una aplicación con tu cuenta necesitas haber entrado al visor.
       El código autoriza a publicar en <b>tu</b> biblioteca, así que solo puedes pedirlo tú.</p>
    <a class="btn" href="../index.php"><i data-lucide="log-in"></i> Ir a iniciar sesión</a>
<?php else: ?>
    <h1>Vincular aplicación</h1>
    <p>Genera un código y pégalo en <b>Avatars</b>, en el panel de sincronización de Tareas.
       Tu contraseña y tu PIN no salen de aquí.</p>

    <div class="code wait" id="box"><b id="code">Pulsa «Generar código»</b>
        <button class="btn ghost icon" id="copy" style="display:none" title="Copiar"><i data-lucide="copy"></i></button>
    </div>

    <div class="row">
        <button class="btn" id="gen"><i data-lucide="refresh-cw"></i> Generar código</button>
    </div>

    <p class="meta" id="meta"></p>

    <div class="steps">
        <ol>
            <li>Copia el código de arriba.</li>
            <li>En Avatars: <b>Tareas → abre una lista → Sincronizar</b>.</li>
            <li>Pégalo en «Cuenta del visor» y pulsa <b>Vincular</b>.</li>
        </ol>
    </div>
<?php endif; ?>
</div>

<script>
lucide.createIcons();
let timer = null;

$('#gen').on('click', function () {
    const $b = $(this).prop('disabled', true);
    $.post('ctrl/ctrl-todo-link.php', { action: 'create', app: 'avatars' }, null, 'json')
        .done(res => {
            if (!res.success) { $('#meta').html('<span class="warn">' + (res.message || 'No se pudo generar') + '</span>'); return; }
            $('#box').removeClass('wait');
            $('#code').text(res.code);
            $('#copy').show();
            arranca(res.ttl || 600);
            $b.html('<i data-lucide="refresh-cw"></i> Generar otro');
            lucide.createIcons();
        })
        .fail(() => $('#meta').html('<span class="warn">No se pudo contactar al servidor</span>'))
        .always(() => $b.prop('disabled', false));
});

$('#copy').on('click', function () {
    navigator.clipboard.writeText($('#code').text().trim());
    $('#meta').prepend('<b>Copiado · </b>');
});

// El código vale 10 minutos: verlo caer evita pegar uno ya vencido y no entender
// por qué el otro lado dice que no sirve.
function arranca(segundos) {
    clearInterval(timer);
    let queda = segundos;
    const pinta = () => {
        if (queda <= 0) {
            clearInterval(timer);
            $('#meta').html('<span class="warn">El código venció · genera otro</span>');
            $('#box').addClass('wait'); $('#code').text('Vencido'); $('#copy').hide();
            return;
        }
        const m = Math.floor(queda / 60), s = queda % 60;
        $('#meta').html('Válido durante <b>' + m + ':' + String(s).padStart(2, '0') + '</b> · un solo uso');
        queda--;
    };
    pinta();
    timer = setInterval(pinta, 1000);
}
</script>
</body>
</html>
