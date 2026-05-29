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
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body, JSON_UNESCAPED_UNICODE));
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
}
