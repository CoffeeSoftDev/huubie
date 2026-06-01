<?php
/**
 * Test rapido del OpenRouterClient.
 * Abrir en navegador:
 *   http://localhost/huubie/coffee/app/visor/ctrl/test-openrouter.php
 *   http://localhost/huubie/coffee/app/visor/ctrl/test-openrouter.php?prompt=Hola%20como%20estas
 *   http://localhost/huubie/coffee/app/visor/ctrl/test-openrouter.php?json=1&model=openai/gpt-4o-mini
 */

header('Cache-Control: no-store');
require_once __DIR__ . '/openrouter-client.php';

$prompt = $_GET['prompt'] ?? 'En una frase: que es PHP?';
$model  = $_GET['model']  ?? null;   // ej openai/gpt-4o-mini, anthropic/claude-sonnet-4
$asJson = isset($_GET['json']);

try {
    $t0 = microtime(true);
    $or = new OpenRouterClient();

    $resp = $or->chat(
        [
            ['role' => 'system', 'content' => 'Responde corto y directo en espanol.'],
            ['role' => 'user',   'content' => $prompt],
        ],
        $model
    );

    $tookMs  = round((microtime(true) - $t0) * 1000);
    $content = $resp['message']['content'] ?? '(sin contenido)';

    if ($asJson) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'ok'      => true,
            'took_ms' => $tookMs,
            'model'   => $resp['model'] ?? null,
            'reply'   => $content,
            'usage'   => $resp['usage'] ?? null,
        ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        exit;
    }

    header('Content-Type: text/html; charset=utf-8');
    ?>
    <!doctype html>
    <html lang="es">
    <head>
        <meta charset="utf-8">
        <title>Test OpenRouter</title>
        <style>
            body { font-family: system-ui, sans-serif; max-width: 760px; margin: 40px auto; padding: 0 16px; background: #0f172a; color: #e2e8f0; }
            h1 { color: #a78bfa; }
            .meta { color: #94a3b8; font-size: 13px; margin-bottom: 16px; }
            .card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px 20px; margin: 12px 0; }
            .prompt { color: #fbbf24; }
            .reply  { white-space: pre-wrap; line-height: 1.55; }
            form { margin-top: 24px; display: flex; gap: 8px; }
            input[type=text] { flex: 1; padding: 10px; border-radius: 6px; border: 1px solid #475569; background: #0f172a; color: #e2e8f0; }
            button { padding: 10px 18px; border-radius: 6px; border: 0; background: #a78bfa; color: #0f172a; font-weight: 600; cursor: pointer; }
        </style>
    </head>
    <body>
        <h1>OpenRouter OK</h1>
        <div class="meta">
            modelo: <b><?= htmlspecialchars($resp['model'] ?? '-') ?></b> &middot;
            tiempo: <b><?= $tookMs ?> ms</b> &middot;
            tokens: <b><?= htmlspecialchars((string)($resp['usage']['completion_tokens'] ?? '-')) ?></b>
        </div>

        <div class="card">
            <div class="prompt">&gt; <?= htmlspecialchars($prompt) ?></div>
        </div>
        <div class="card reply"><?= htmlspecialchars($content) ?></div>

        <form method="get">
            <input type="text" name="prompt" placeholder="Otra pregunta..." value="<?= htmlspecialchars($prompt) ?>">
            <button type="submit">Enviar</button>
        </form>
    </body>
    </html>
    <?php

} catch (Throwable $e) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    echo "ERROR: " . $e->getMessage();
}
