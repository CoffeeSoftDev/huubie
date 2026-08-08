<?php
/**
 * Cliente de OpenCode (Zen y Go). Habla el mismo dialecto OpenAI que OpenRouter,
 * asi que hereda TODO el motor de OpenRouterClient (adaptacion de imagenes a
 * content[], parseo del SSE, tool_calls, reasoning) y solo cambia dos cosas:
 *
 *  - el destino: base URL + key propias (la key puede ir vacia en el tier free).
 *  - el id del modelo: en el frontend viaja con prefijo ('opencode/glm-5.2') para
 *    distinguirlo de Ollama Cloud ('glm-5.2:cloud'); al gateway hay que mandarlo
 *    pelon ('glm-5.2'), que es como lo publica GET /models.
 */

require_once __DIR__ . '/opencode-config.php';
require_once __DIR__ . '/openrouter-client.php';

class OpencodeClient extends OpenRouterClient {

    public function __construct() {
        parent::__construct([
            'apiKey'       => OPENCODE_API_KEY,
            'baseUrl'      => OPENCODE_BASE_URL,
            'defaultModel' => self::bareModel(OPENCODE_DEFAULT_MODEL),
            'timeout'      => OPENCODE_TIMEOUT,
            'caBundle'     => OPENCODE_CA_BUNDLE,
            'appTitle'     => OPENCODE_APP_TITLE,
        ]);
    }

    /** Quita el prefijo 'opencode/' si viene. Tolera null y el id ya pelon. */
    public static function bareModel($model) {
        $model = (string) $model;
        if (strncmp($model, OPENCODE_PREFIX, strlen(OPENCODE_PREFIX)) === 0) {
            return substr($model, strlen(OPENCODE_PREFIX));
        }
        return $model;
    }

    public function chat(array $messages, $model = null, array $opts = []) {
        return parent::chat($messages, $model ? self::bareModel($model) : null, $opts);
    }

    public function chatStream(array $messages, $model = null, array $opts = [], callable $onChunk = null) {
        return parent::chatStream($messages, $model ? self::bareModel($model) : null, $opts, $onChunk);
    }
}
