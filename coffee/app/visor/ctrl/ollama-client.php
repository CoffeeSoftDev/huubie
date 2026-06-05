<?php
/**
 * Cliente minimalista para Ollama Cloud API usando API key.
 * Sin SDK, solo cURL.
 *
 * Operaciones:
 *  - chat($messages, $model = null, $opts = [])
 *  - generate($prompt, $model = null, $opts = [])
 *  - embeddings($input, $model = null)
 *  - listModels()
 */

require_once __DIR__ . '/ollama-config.php';

class OllamaException extends Exception {}

class OllamaClient {
    private $apiKey;
    private $baseUrl;
    private $defaultModel;

    public function __construct() {
        if (!defined('OLLAMA_API_KEY') || OLLAMA_API_KEY === '') {
            throw new OllamaException('OLLAMA_API_KEY no definida. Revisa coffee/app/credentials/.env');
        }
        $this->apiKey       = OLLAMA_API_KEY;
        $this->baseUrl      = rtrim(OLLAMA_BASE_URL, '/');
        $this->defaultModel = OLLAMA_DEFAULT_MODEL;
    }

    /* ── Endpoints ───────────────────────────────────────── */

    public function chat(array $messages, $model = null, array $opts = []) {
        $payload = [
            'model'    => $model ?: $this->defaultModel,
            'messages' => $messages,
            'stream'   => false,
        ];
        if (!empty($opts)) {
            $payload['options'] = $opts;
        }
        return $this->request('POST', '/api/chat', $payload);
    }

    /**
     * Igual que chat() pero en modo streaming: Ollama Cloud devuelve NDJSON
     * (una linea JSON por token-chunk). Por cada fragmento de texto invocamos
     * $onChunk($piece). Devuelve al final ['content' => textoCompleto, 'meta' => ultimoObj].
     */
    public function chatStream(array $messages, $model = null, array $opts = [], callable $onChunk = null) {
        $payload = [
            'model'    => $model ?: $this->defaultModel,
            'messages' => $messages,
            'stream'   => true,
        ];
        if (!empty($opts)) {
            $payload['options'] = $opts;
        }
        return $this->requestStream('POST', '/api/chat', $payload, $onChunk);
    }

    public function generate($prompt, $model = null, array $opts = []) {
        $payload = [
            'model'  => $model ?: $this->defaultModel,
            'prompt' => $prompt,
            'stream' => false,
        ];
        if (!empty($opts)) {
            $payload['options'] = $opts;
        }
        return $this->request('POST', '/api/generate', $payload);
    }

    public function embeddings($input, $model = null) {
        $payload = [
            'model' => $model ?: $this->defaultModel,
            'input' => $input,
        ];
        return $this->request('POST', '/api/embed', $payload);
    }

    public function listModels() {
        return $this->request('GET', '/api/tags');
    }

    /* ── HTTP ────────────────────────────────────────────── */

    private function request($method, $path, $body = null) {
        $ch = curl_init($this->baseUrl . $path);
        $headers = [
            'Authorization: Bearer ' . $this->apiKey,
            'Content-Type: application/json',
            'Accept: application/json',
        ];
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST  => $method,
            CURLOPT_HTTPHEADER     => $headers,
            CURLOPT_TIMEOUT        => OLLAMA_TIMEOUT,
        ]);
        if (defined('OLLAMA_CA_BUNDLE') && OLLAMA_CA_BUNDLE !== '' && file_exists(OLLAMA_CA_BUNDLE)) {
            curl_setopt($ch, CURLOPT_CAINFO, OLLAMA_CA_BUNDLE);
        }
        if ($body !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE));
        }
        $resp = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err  = curl_error($ch);
        curl_close($ch);

        if ($resp === false) {
            throw new OllamaException('cURL: ' . $err);
        }
        if ($code >= 400) {
            throw new OllamaException("HTTP $code: $resp");
        }
        $data = json_decode($resp, true);
        if (!is_array($data)) {
            throw new OllamaException('Respuesta no JSON: ' . substr($resp, 0, 200));
        }
        return $data;
    }

    /**
     * Variante streaming de request(): usa CURLOPT_WRITEFUNCTION para procesar
     * el NDJSON conforme llega (sin esperar al curl_exec completo). cURL puede
     * entregar trozos a mitad de linea, asi que bufferizamos y partimos por \n.
     */
    private function requestStream($method, $path, $body, callable $onChunk = null) {
        $ch = curl_init($this->baseUrl . $path);
        $headers = [
            'Authorization: Bearer ' . $this->apiKey,
            'Content-Type: application/json',
            'Accept: application/x-ndjson',
        ];

        $buffer = '';
        $full   = '';
        $raw    = '';   // acumula TODO el cuerpo (para poder leer el error si HTTP >= 400)
        $meta   = [];

        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_HTTPHEADER    => $headers,
            CURLOPT_TIMEOUT       => OLLAMA_TIMEOUT,
            CURLOPT_POSTFIELDS    => ($body !== null ? json_encode($body, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE) : null),
            CURLOPT_WRITEFUNCTION => function ($c, $data) use (&$buffer, &$full, &$raw, &$meta, $onChunk) {
                $raw    .= $data;
                $buffer .= $data;
                while (($pos = strpos($buffer, "\n")) !== false) {
                    $line   = trim(substr($buffer, 0, $pos));
                    $buffer = substr($buffer, $pos + 1);
                    if ($line === '') continue;
                    $obj = json_decode($line, true);
                    if (!is_array($obj)) continue;
                    $piece = $obj['message']['content'] ?? '';
                    if ($piece !== '') {
                        $full .= $piece;
                        if ($onChunk) $onChunk($piece);
                    }
                    if (!empty($obj['done'])) {
                        $meta = $obj; // trae eval_count, total_duration, etc.
                    }
                }
                // Obligatorio devolver los bytes consumidos o cURL aborta.
                return strlen($data);
            },
        ]);
        if (defined('OLLAMA_CA_BUNDLE') && OLLAMA_CA_BUNDLE !== '' && file_exists(OLLAMA_CA_BUNDLE)) {
            curl_setopt($ch, CURLOPT_CAINFO, OLLAMA_CA_BUNDLE);
        }

        $ok   = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err  = curl_error($ch);
        curl_close($ch);

        if ($ok === false && $err !== '') {
            throw new OllamaException('cURL: ' . $err);
        }
        if ($code >= 400) {
            // Exponer el motivo real del rechazo (Ollama responde {"error":"..."}).
            $detail = '';
            $j = json_decode(trim($raw), true);
            if (is_array($j) && !empty($j['error'])) {
                $detail = is_string($j['error']) ? $j['error'] : json_encode($j['error'], JSON_UNESCAPED_UNICODE);
            } elseif (trim($raw) !== '') {
                $detail = substr(trim($raw), 0, 400);
            }
            throw new OllamaException("HTTP $code" . ($detail !== '' ? ": $detail" : ''));
        }
        return ['content' => $full, 'meta' => $meta];
    }
}
