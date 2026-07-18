<?php
/**
 * Cliente minimalista para OpenRouter (API OpenAI-compatible) usando API key.
 * Sin SDK, solo cURL. Gemelo de OllamaClient pero hablando el dialecto OpenAI.
 *
 * Diferencias clave que resuelve esta clase:
 *  - Endpoint /chat/completions (no /api/chat).
 *  - Las imagenes viajan dentro de content[] como image_url (no como images[]).
 *  - La respuesta llega en choices[0].message.content + usage.* — la
 *    NORMALIZAMOS a { message:{content}, usage } para que ctrl-coffeeia.php
 *    siga funcionando sin cambios en su lectura de la respuesta.
 *
 * Operaciones:
 *  - chat($messages, $model = null, $opts = [])
 *  - listModels()
 */

require_once __DIR__ . '/openrouter-config.php';

class OpenRouterException extends Exception {}

class OpenRouterClient {
    private $apiKey;
    private $baseUrl;
    private $defaultModel;
    // Esfuerzo de razonamiento -> se mapea al parametro 'reasoning' de OpenRouter.
    // null = no se envia (default del modelo).
    private $reasoning = null;

    public function __construct() {
        if (!defined('OPENROUTER_API_KEY') || OPENROUTER_API_KEY === '') {
            throw new OpenRouterException('OPENROUTER_API_KEY no definida. Revisa coffee/app/credentials/.env');
        }
        $this->apiKey       = OPENROUTER_API_KEY;
        $this->baseUrl      = rtrim(OPENROUTER_BASE_URL, '/');
        $this->defaultModel = OPENROUTER_DEFAULT_MODEL;
    }

    /**
     * Fija el ESFUERZO DE RAZONAMIENTO. Misma firma que OllamaClient::setThink()
     * para que el endpoint no distinga proveedor; aqui se traduce al parametro
     * 'reasoning' de OpenRouter (OpenAI-compatible):
     *  - null / '' / 'auto'  -> no se envia (default del modelo)
     *  - 'off' / false       -> reasoning:{enabled:false}
     *  - 'low'|'medium'|'high' -> reasoning:{effort:<nivel>}   ('max' se trata como 'high')
     *  - true                -> reasoning:{enabled:true}
     */
    public function setThink($level) {
        if ($level === null || $level === '' || $level === 'auto') { $this->reasoning = null; return; }
        if ($level === false || $level === 'off' || $level === 'false') { $this->reasoning = ['enabled' => false]; return; }
        if ($level === true || $level === 'true') { $this->reasoning = ['enabled' => true]; return; }
        $effort = ($level === 'max') ? 'high' : (string) $level; // OpenRouter no tiene 'max'
        $this->reasoning = ['effort' => $effort];
    }

    /* ── Endpoints ───────────────────────────────────────── */

    public function chat(array $messages, $model = null, array $opts = []) {
        $payload = [
            'model'    => $model ?: $this->defaultModel,
            'messages' => $this->adaptMessages($messages),
            'stream'   => false,
            // Pide a OpenRouter el costo REAL de la llamada (USD) dentro de usage.cost,
            // ademas del desglose prompt/completion tokens. Sin esto solo llegan tokens.
            'usage'    => ['include' => true],
        ];
        // Mapea las "options" estilo Ollama (temperature, top_p, num_predict...)
        // a sus equivalentes OpenAI mas comunes.
        if (isset($opts['temperature'])) $payload['temperature'] = $opts['temperature'];
        if (isset($opts['top_p']))       $payload['top_p']       = $opts['top_p'];
        if (isset($opts['num_predict'])) $payload['max_tokens']  = (int) $opts['num_predict'];
        if (isset($opts['max_tokens']))  $payload['max_tokens']  = (int) $opts['max_tokens'];
        // Tool-calling (function calling): el modelo puede pedir ejecutar herramientas.
        if (!empty($opts['tools']))      $payload['tools']       = $opts['tools'];
        if (isset($opts['tool_choice'])) $payload['tool_choice'] = $opts['tool_choice'];
        // Esfuerzo de razonamiento fijado con setThink() (mapeado a 'reasoning').
        if ($this->reasoning !== null)   $payload['reasoning']   = $this->reasoning;

        $data = $this->request('POST', '/chat/completions', $payload);

        // Normalizamos al contrato que espera el controlador (estilo Ollama). El
        // 'message' completo puede traer tool_calls; lo exponemos aparte para el loop.
        $msg = $data['choices'][0]['message'] ?? [];
        if (!isset($msg['content']) || $msg['content'] === null) $msg['content'] = '';
        return [
            'model'         => $data['model'] ?? ($model ?: $this->defaultModel),
            'message'       => $msg,
            'content'       => $msg['content'],
            'tool_calls'    => $msg['tool_calls'] ?? [],
            'finish_reason' => $data['choices'][0]['finish_reason'] ?? '',
            'usage'         => $data['usage'] ?? [],
        ];
    }

    /**
     * Igual que chat() pero en streaming. OpenRouter habla SSE estilo OpenAI:
     * lineas "data: {json}\n\n" con el delta en choices[0].delta.content y un
     * "data: [DONE]" final. Por cada fragmento invocamos $onChunk($piece).
     * Devuelve ['content' => textoCompleto, 'meta' => ['model','usage']].
     */
    public function chatStream(array $messages, $model = null, array $opts = [], callable $onChunk = null) {
        $payload = [
            'model'          => $model ?: $this->defaultModel,
            'messages'       => $this->adaptMessages($messages),
            'stream'         => true,
            'stream_options' => ['include_usage' => true],
            // Igual que en chat(): trae usage.cost (USD real) en el chunk final.
            'usage'          => ['include' => true],
        ];
        if (isset($opts['temperature'])) $payload['temperature'] = $opts['temperature'];
        if (isset($opts['top_p']))       $payload['top_p']       = $opts['top_p'];
        if (isset($opts['num_predict'])) $payload['max_tokens']  = (int) $opts['num_predict'];
        if (isset($opts['max_tokens']))  $payload['max_tokens']  = (int) $opts['max_tokens'];
        // Esfuerzo de razonamiento fijado con setThink() (mapeado a 'reasoning').
        if ($this->reasoning !== null)   $payload['reasoning']   = $this->reasoning;

        return $this->requestStream('/chat/completions', $payload, $onChunk);
    }

    public function listModels() {
        return $this->request('GET', '/models');
    }

    /* ── Adaptacion de mensajes (Ollama → OpenAI) ─────────── */

    /**
     * Convierte los mensajes del formato interno (estilo Ollama, con
     * images[] = base64 sin prefijo) al formato multimodal de OpenAI.
     * Mensajes sin imagenes quedan con content string (sin cambios).
     */
    private function adaptMessages(array $messages) {
        $out = [];
        foreach ($messages as $m) {
            $role    = isset($m['role']) ? $m['role'] : 'user';
            $content = isset($m['content']) ? (string) $m['content'] : '';
            $images  = (isset($m['images']) && is_array($m['images'])) ? $m['images'] : [];

            // Resultado de una herramienta (tool-calling): conserva tool_call_id.
            if ($role === 'tool') {
                $out[] = [
                    'role'         => 'tool',
                    'tool_call_id' => $m['tool_call_id'] ?? '',
                    'content'      => $content,
                ];
                continue;
            }
            // Turno del asistente que INVOCA herramientas: conserva tool_calls.
            if ($role === 'assistant' && !empty($m['tool_calls'])) {
                $out[] = [
                    'role'       => 'assistant',
                    'content'    => $content,
                    'tool_calls' => $m['tool_calls'],
                ];
                continue;
            }

            if (empty($images)) {
                $out[] = ['role' => $role, 'content' => $content];
                continue;
            }

            $parts = [];
            if ($content !== '') {
                $parts[] = ['type' => 'text', 'text' => $content];
            }
            foreach ($images as $b64) {
                if (!is_string($b64) || $b64 === '') continue;
                // El controlador ya limpio el prefijo data:...;base64, asi que
                // reconstruimos el data URL adivinando el MIME por magic bytes.
                $mime = $this->guessMimeFromBase64($b64);
                $parts[] = [
                    'type'      => 'image_url',
                    'image_url' => ['url' => "data:{$mime};base64,{$b64}"],
                ];
            }
            $out[] = ['role' => $role, 'content' => $parts];
        }
        return $out;
    }

    /** Detecta el MIME por el prefijo del base64 (magic bytes). */
    private function guessMimeFromBase64($b64) {
        $head = substr($b64, 0, 16);
        if (strncmp($head, 'iVBOR', 5) === 0)  return 'image/png';
        if (strncmp($head, '/9j/', 4) === 0)   return 'image/jpeg';
        if (strncmp($head, 'R0lGOD', 6) === 0) return 'image/gif';
        if (strncmp($head, 'UklGR', 5) === 0)  return 'image/webp';
        return 'image/png';
    }

    /* ── HTTP ────────────────────────────────────────────── */

    private function request($method, $path, $body = null) {
        $ch = curl_init($this->baseUrl . $path);
        $headers = [
            'Authorization: Bearer ' . $this->apiKey,
            'Content-Type: application/json',
            'Accept: application/json',
            'X-Title: ' . (defined('OPENROUTER_APP_TITLE') ? OPENROUTER_APP_TITLE : 'Huubie Visor'),
        ];
        if (defined('OPENROUTER_APP_REFERER') && OPENROUTER_APP_REFERER !== '') {
            $headers[] = 'HTTP-Referer: ' . OPENROUTER_APP_REFERER;
        }
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST  => $method,
            CURLOPT_HTTPHEADER     => $headers,
            CURLOPT_TIMEOUT        => OPENROUTER_TIMEOUT,
        ]);
        if (defined('OPENROUTER_CA_BUNDLE') && OPENROUTER_CA_BUNDLE !== '' && file_exists(OPENROUTER_CA_BUNDLE)) {
            curl_setopt($ch, CURLOPT_CAINFO, OPENROUTER_CA_BUNDLE);
        }
        if ($body !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE));
        }
        $resp = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err  = curl_error($ch);
        curl_close($ch);

        if ($resp === false) {
            throw new OpenRouterException('cURL: ' . $err);
        }
        if ($code >= 400) {
            throw new OpenRouterException("HTTP $code: $resp");
        }
        $data = json_decode($resp, true);
        if (!is_array($data)) {
            throw new OpenRouterException('Respuesta no JSON: ' . substr($resp, 0, 200));
        }
        return $data;
    }

    /**
     * Variante streaming de request(): parsea el SSE estilo OpenAI conforme
     * llega via CURLOPT_WRITEFUNCTION. cURL puede cortar a mitad de linea, asi
     * que bufferizamos y procesamos solo lineas completas.
     */
    private function requestStream($path, $body, callable $onChunk = null) {
        $ch = curl_init($this->baseUrl . $path);
        $headers = [
            'Authorization: Bearer ' . $this->apiKey,
            'Content-Type: application/json',
            'Accept: text/event-stream',
            'X-Title: ' . (defined('OPENROUTER_APP_TITLE') ? OPENROUTER_APP_TITLE : 'Huubie Visor'),
        ];
        if (defined('OPENROUTER_APP_REFERER') && OPENROUTER_APP_REFERER !== '') {
            $headers[] = 'HTTP-Referer: ' . OPENROUTER_APP_REFERER;
        }

        $buffer    = '';
        $full      = '';
        $usage     = [];
        $modelSeen = '';

        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => 'POST',
            CURLOPT_HTTPHEADER    => $headers,
            // Streaming: timeout de INACTIVIDAD en vez de tope total, para que una
            // generacion larga no aborte mientras sigan llegando tokens. Solo corta
            // si el upstream se queda mudo OPENROUTER_TIMEOUT segundos.
            CURLOPT_CONNECTTIMEOUT  => 30,
            CURLOPT_LOW_SPEED_LIMIT => 1,
            CURLOPT_LOW_SPEED_TIME  => OPENROUTER_TIMEOUT,
            CURLOPT_POSTFIELDS    => json_encode($body, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE),
            CURLOPT_WRITEFUNCTION => function ($c, $data) use (&$buffer, &$full, &$usage, &$modelSeen, $onChunk) {
                $buffer .= $data;
                while (($pos = strpos($buffer, "\n")) !== false) {
                    $line   = trim(substr($buffer, 0, $pos));
                    $buffer = substr($buffer, $pos + 1);
                    if ($line === '' || $line[0] === ':') continue; // vacia o comentario keep-alive
                    if (strncmp($line, 'data:', 5) !== 0) continue;
                    $json = trim(substr($line, 5));
                    if ($json === '[DONE]') continue;
                    $obj = json_decode($json, true);
                    if (!is_array($obj)) continue;
                    if (isset($obj['model'])) $modelSeen = $obj['model'];
                    if (isset($obj['usage']) && is_array($obj['usage'])) $usage = $obj['usage'];
                    $delta  = $obj['choices'][0]['delta'] ?? [];
                    // Modelos de razonamiento exponen el pensamiento en delta.reasoning
                    // (o reasoning_content). Lo reenviamos como 'thinking'.
                    $reason = $delta['reasoning'] ?? ($delta['reasoning_content'] ?? '');
                    if ($reason !== '' && $reason !== null && $onChunk) $onChunk($reason, 'thinking');
                    $piece = $delta['content'] ?? '';
                    if ($piece !== '' && $piece !== null) {
                        $full .= $piece;
                        if ($onChunk) $onChunk($piece, 'content');
                    }
                }
                return strlen($data);
            },
        ]);
        if (defined('OPENROUTER_CA_BUNDLE') && OPENROUTER_CA_BUNDLE !== '' && file_exists(OPENROUTER_CA_BUNDLE)) {
            curl_setopt($ch, CURLOPT_CAINFO, OPENROUTER_CA_BUNDLE);
        }

        $ok   = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err  = curl_error($ch);
        curl_close($ch);

        if ($ok === false && $err !== '') {
            throw new OpenRouterException('cURL: ' . $err);
        }
        if ($code >= 400) {
            throw new OpenRouterException("HTTP $code");
        }
        return ['content' => $full, 'meta' => ['model' => $modelSeen, 'usage' => $usage]];
    }
}
