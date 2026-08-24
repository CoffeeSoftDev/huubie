<?php
/**
 * ImageLab — drivers. Cada proveedor tiene su API, pero todos se reducen al mismo par:
 *
 *   submit($job) -> arranca el trabajo, devuelve el id EXTERNO del proveedor
 *   poll($id)    -> consulta ese trabajo y devuelve estado normalizado
 *
 * Estados: starting | processing | succeeded | failed. Son los de Replicate, y sirven
 * para todos: fal habla de IN_QUEUE/IN_PROGRESS/COMPLETED y aqui se traduce.
 *
 * Un resultado puede llegar de dos formas: como URL del proveedor ('sourceUrl') o
 * como binario ya en la mano ('data'), que es lo que devuelve un servidor local
 * sincrono. El endpoint acepta las dos.
 */

require_once __DIR__ . '/config.php';

class ImageDriverException extends Exception {}

/** cURL comun. Devuelve [status, headers, body]. */
function il_http($method, $url, array $headers = [], $body = null, $timeout = null) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST  => strtoupper($method),
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_TIMEOUT        => $timeout ?: IL_TIMEOUT,
        CURLOPT_CONNECTTIMEOUT => 20,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_HEADER         => true,
    ]);
    if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    if (IL_CA_BUNDLE !== '') curl_setopt($ch, CURLOPT_CAINFO, IL_CA_BUNDLE);

    $raw = curl_exec($ch);
    if ($raw === false) {
        $err = curl_error($ch);
        curl_close($ch);
        throw new ImageDriverException('Fallo de red: ' . $err);
    }
    $status     = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $headerSize = (int) curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    curl_close($ch);

    return ['status' => $status, 'headers' => substr($raw, 0, $headerSize), 'body' => substr($raw, $headerSize)];
}

function il_http_json($method, $url, array $headers, array $payload = null, $timeout = null) {
    $headers[] = 'Content-Type: application/json';
    $headers[] = 'Accept: application/json';
    $body = $payload === null ? null : json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $res  = il_http($method, $url, $headers, $body, $timeout);
    $json = json_decode($res['body'], true);
    if (!is_array($json)) {
        throw new ImageDriverException('Respuesta no-JSON (HTTP ' . $res['status'] . '): ' . substr($res['body'], 0, 300));
    }
    $json['__http'] = $res['status'];
    return $json;
}

interface ImageDriver {
    public function name();
    public function submit(array $job);
    public function poll($externalId, array $job);
}

/* ── Local: ComfyUI o Automatic1111 ─────────────────────────────────────────
   El unico driver que no cobra por imagen. La URL decide donde corre: tu maquina,
   o una GPU rentada por horas con el puerto reenviado. El codigo es el mismo. */
class LocalDriver implements ImageDriver {
    public function name() { return 'local'; }

    public function submit(array $job) {
        return IL_LOCAL_KIND === 'a1111' ? $this->submitA1111($job) : $this->submitComfy($job);
    }

    public function poll($externalId, array $job) {
        // A1111 es sincrono: cuando submit vuelve, la imagen ya esta. No hay nada que consultar.
        if (IL_LOCAL_KIND === 'a1111') {
            return ['status' => 'succeeded', 'sourceUrl' => $job['source_url'], 'data' => null, 'error' => ''];
        }
        return $this->pollComfy($externalId, $job);
    }

    /* -- ComfyUI -- */

    private function submitComfy(array $job) {
        $workflow = $this->loadWorkflow($job);
        $res = il_http_json('POST', IL_LOCAL_BASE_URL . '/prompt', [], [
            'prompt'    => $workflow,
            'client_id' => 'imagelab-' . bin2hex(random_bytes(4)),
        ]);
        if (!empty($res['node_errors'])) {
            throw new ImageDriverException('ComfyUI rechazo el workflow: ' . json_encode($res['node_errors'], JSON_UNESCAPED_UNICODE));
        }
        if (empty($res['prompt_id'])) {
            throw new ImageDriverException('ComfyUI no devolvio prompt_id (HTTP ' . $res['__http'] . '): ' . json_encode($res, JSON_UNESCAPED_UNICODE));
        }
        return ['externalId' => (string) $res['prompt_id'], 'status' => 'starting', 'sourceUrl' => null, 'data' => null];
    }

    private function pollComfy($externalId, array $job) {
        $res = il_http_json('GET', IL_LOCAL_BASE_URL . '/history/' . rawurlencode($externalId), [], null, 30);
        unset($res['__http']);

        // Mientras el trabajo esta en cola o generando, el historial viene vacio.
        if (!isset($res[$externalId])) return ['status' => 'processing', 'sourceUrl' => null, 'data' => null, 'error' => ''];

        $entry  = $res[$externalId];
        $status = $entry['status']['status_str'] ?? '';
        if ($status === 'error') {
            $msg = '';
            foreach (($entry['status']['messages'] ?? []) as $m) {
                if (($m[0] ?? '') === 'execution_error') $msg = $m[1]['exception_message'] ?? '';
            }
            return ['status' => 'failed', 'sourceUrl' => null, 'data' => null, 'error' => $msg ?: 'ComfyUI reporto un error'];
        }

        foreach (($entry['outputs'] ?? []) as $node) {
            if (empty($node['images'][0])) continue;
            $img = $node['images'][0];
            $url = IL_LOCAL_BASE_URL . '/view?filename=' . rawurlencode($img['filename'])
                 . '&subfolder=' . rawurlencode($img['subfolder'] ?? '')
                 . '&type=' . rawurlencode($img['type'] ?? 'output');
            return ['status' => 'succeeded', 'sourceUrl' => $url, 'data' => null, 'error' => ''];
        }
        return ['status' => 'processing', 'sourceUrl' => null, 'data' => null, 'error' => ''];
    }

    /**
     * Carga el workflow de ctrl/workflows/ y sustituye los marcadores. Los workflows
     * viven en JSON aparte para que puedas exportar el tuyo desde ComfyUI
     * ("Save (API format)") y pegarlo aqui sin tocar PHP.
     */
    private function loadWorkflow(array $job) {
        $file = __DIR__ . '/workflows/' . ($job['task'] === 'edit' ? 'img2img.json' : 'txt2img.json');
        $raw  = @file_get_contents($file);
        if ($raw === false) throw new ImageDriverException('Falta el workflow ' . basename($file));

        $imageName = '';
        if ($job['task'] === 'edit') {
            if (empty($job['imagePath'])) throw new ImageDriverException('Editar requiere una imagen de entrada.');
            $imageName = $this->uploadToComfy($job['imagePath']);
        }

        $vars = [
            '__PROMPT__'     => $job['prompt'],
            '__NEGATIVE__'   => IL_LOCAL_NEGATIVE,
            '__CHECKPOINT__' => $this->checkpoint(),
            '__SAMPLER__'    => IL_LOCAL_SAMPLER,
            '__SCHEDULER__'  => IL_LOCAL_SCHEDULER,
            '__IMAGE__'      => $imageName,
        ];
        // Los textos se inyectan por json_encode para que las comillas y los acentos
        // no rompan el JSON del workflow.
        foreach ($vars as $key => $value) {
            $raw = str_replace('"' . $key . '"', json_encode((string) $value, JSON_UNESCAPED_UNICODE), $raw);
        }
        $numbers = [
            '"__WIDTH__"'   => (int) $job['width'],
            '"__HEIGHT__"'  => (int) $job['height'],
            '"__STEPS__"'   => IL_LOCAL_STEPS,
            '"__CFG__"'     => IL_LOCAL_CFG,
            '"__DENOISE__"' => IL_LOCAL_DENOISE,
            '"__SEED__"'    => random_int(1, 2147483647),
        ];
        $raw = str_replace(array_keys($numbers), array_values($numbers), $raw);

        $workflow = json_decode($raw, true);
        if (!is_array($workflow)) throw new ImageDriverException('El workflow ' . basename($file) . ' no quedo como JSON valido');
        return $workflow;
    }

    /** ComfyUI no acepta la imagen inline: primero se sube a su carpeta input. */
    private function uploadToComfy($path) {
        if (!is_file($path)) throw new ImageDriverException('No existe la imagen de entrada');
        $name = 'imagelab-' . bin2hex(random_bytes(6)) . '.' . pathinfo($path, PATHINFO_EXTENSION);

        $post = ['image' => new CURLFile($path, mime_content_type($path) ?: 'image/jpeg', $name), 'overwrite' => 'true'];
        $res  = il_http('POST', IL_LOCAL_BASE_URL . '/upload/image', [], $post, 60);
        $json = json_decode($res['body'], true);
        if ($res['status'] >= 400 || !is_array($json) || empty($json['name'])) {
            throw new ImageDriverException('ComfyUI rechazo la subida (HTTP ' . $res['status'] . ')');
        }
        $sub = (string)($json['subfolder'] ?? '');
        return $sub === '' ? $json['name'] : $sub . '/' . $json['name'];
    }

    /** Sin checkpoint fijado en el .env, se toma el primero que tenga instalado. */
    private function checkpoint() {
        if (IL_LOCAL_CHECKPOINT !== '') return IL_LOCAL_CHECKPOINT;

        static $found = null;
        if ($found !== null) return $found;

        $res  = il_http_json('GET', IL_LOCAL_BASE_URL . '/object_info/CheckpointLoaderSimple', [], null, 20);
        $list = $res['CheckpointLoaderSimple']['input']['required']['ckpt_name'][0] ?? [];
        if (!is_array($list) || $list === []) {
            throw new ImageDriverException('ComfyUI no tiene ningun checkpoint instalado en models/checkpoints');
        }
        return $found = (string) $list[0];
    }

    /* -- Automatic1111 / Forge -- */

    private function submitA1111(array $job) {
        $payload = [
            'prompt'          => $job['prompt'],
            'negative_prompt' => IL_LOCAL_NEGATIVE,
            'steps'           => IL_LOCAL_STEPS,
            'cfg_scale'       => IL_LOCAL_CFG,
            'sampler_name'    => IL_LOCAL_SAMPLER,
            'width'           => (int) $job['width'],
            'height'          => (int) $job['height'],
        ];
        $route = '/sdapi/v1/txt2img';

        if ($job['task'] === 'edit') {
            if (empty($job['imagePath'])) throw new ImageDriverException('Editar requiere una imagen de entrada.');
            $payload['init_images']        = [base64_encode(file_get_contents($job['imagePath']))];
            $payload['denoising_strength'] = IL_LOCAL_DENOISE;
            unset($payload['width'], $payload['height']);
            $route = '/sdapi/v1/img2img';
        }

        // Sincrono: esta llamada tarda lo que tarde la imagen. En CPU pueden ser minutos.
        $res = il_http_json('POST', IL_LOCAL_BASE_URL . $route, [], $payload);
        if (empty($res['images'][0])) {
            throw new ImageDriverException('A1111 no devolvio imagen (HTTP ' . $res['__http'] . ')');
        }
        $bin = base64_decode($res['images'][0], true);
        if ($bin === false) throw new ImageDriverException('A1111 devolvio un base64 corrupto');

        return ['externalId' => 'a1111-' . bin2hex(random_bytes(6)), 'status' => 'succeeded', 'sourceUrl' => null, 'data' => $bin];
    }
}

/* ── Pollinations ───────────────────────────────────────────────────────────
   Sin cuenta ni key: la imagen ES una URL GET. Solo genera. Sirve para ver el
   harness completo funcionando sin dar de alta nada. */
class PollinationsDriver implements ImageDriver {
    public function name() { return 'pollinations'; }

    public function submit(array $job) {
        if ($job['task'] !== 'generate') throw new ImageDriverException('Pollinations no edita imagenes, solo genera.');
        $url = 'https://image.pollinations.ai/prompt/' . rawurlencode($job['prompt'])
             . '?width=' . (int) $job['width'] . '&height=' . (int) $job['height']
             . '&nologo=true&seed=' . random_int(1, 999999);
        return ['externalId' => 'poll-' . bin2hex(random_bytes(6)), 'status' => 'succeeded', 'sourceUrl' => $url, 'data' => null];
    }

    public function poll($externalId, array $job) {
        return ['status' => 'succeeded', 'sourceUrl' => $job['source_url'], 'data' => null, 'error' => ''];
    }
}

/* ── fal.ai ─────────────────────────────────────────────────────────────── */
class FalDriver implements ImageDriver {
    public function name() { return 'fal'; }

    private function headers() { return ['Authorization: Key ' . IL_FAL_API_KEY]; }

    public function submit(array $job) {
        $input = ['prompt' => $job['prompt'], 'num_images' => 1, 'enable_safety_checker' => true];
        $input['output_format'] = $job['format'] === 'png' ? 'png' : 'jpeg';

        if ($job['task'] === 'edit') {
            if (empty($job['imageUrl'])) throw new ImageDriverException('Editar requiere una imagen de entrada.');
            $input['image_url'] = $job['imageUrl'];
        } else {
            $input['image_size'] = ['width' => (int) $job['width'], 'height' => (int) $job['height']];
        }

        $res = il_http_json('POST', IL_FAL_BASE_URL . '/' . $job['model'], $this->headers(), $input);
        if ($res['__http'] >= 400 || empty($res['request_id'])) {
            throw new ImageDriverException('fal rechazo el trabajo (HTTP ' . $res['__http'] . '): ' . $this->readError($res));
        }
        return ['externalId' => (string) $res['request_id'], 'status' => 'starting', 'sourceUrl' => null, 'data' => null];
    }

    public function poll($externalId, array $job) {
        $base = IL_FAL_BASE_URL . '/' . $this->queueRoot($job['model']) . '/requests/' . rawurlencode($externalId);
        $st   = il_http_json('GET', $base . '/status', $this->headers());
        $falStatus = strtoupper((string)($st['status'] ?? ''));

        if ($falStatus === 'IN_QUEUE' || $falStatus === 'IN_PROGRESS') {
            return ['status' => 'processing', 'sourceUrl' => null, 'data' => null, 'error' => ''];
        }
        if ($falStatus !== 'COMPLETED') {
            return ['status' => 'failed', 'sourceUrl' => null, 'data' => null, 'error' => $this->readError($st) ?: ('estado ' . $falStatus)];
        }

        $out = il_http_json('GET', $base, $this->headers());
        $url = $out['images'][0]['url'] ?? ($out['image']['url'] ?? '');
        if ($url === '') return ['status' => 'failed', 'sourceUrl' => null, 'data' => null, 'error' => 'fal no devolvio imagen: ' . $this->readError($out)];

        return ['status' => 'succeeded', 'sourceUrl' => $url, 'data' => null, 'error' => ''];
    }

    /** fal-ai/flux/schnell -> fal-ai/flux : la cola vive en el modelo base. */
    private function queueRoot($model) {
        $parts = explode('/', $model);
        return count($parts) > 2 ? $parts[0] . '/' . $parts[1] : $model;
    }

    private function readError(array $res) {
        foreach (['detail', 'error'] as $key) {
            if (!empty($res[$key])) {
                return is_string($res[$key]) ? $res[$key] : json_encode($res[$key], JSON_UNESCAPED_UNICODE);
            }
        }
        return '';
    }
}

/* ── Venice ─────────────────────────────────────────────────────────────────
   Genera y edita, y ambas rutas son SINCRONAS: la imagen vuelve en la misma
   respuesta, en binario. Por eso submit ya trae 'data' y poll no tiene nada que
   consultar, igual que A1111. */
class VeniceDriver implements ImageDriver {
    public function name() { return 'venice'; }

    private function headers() { return ['Authorization: Bearer ' . IL_VENICE_API_KEY]; }

    public function submit(array $job) {
        $bin = $job['task'] === 'edit' ? $this->edit($job) : $this->generate($job);
        return ['externalId' => 'venice-' . bin2hex(random_bytes(6)), 'status' => 'succeeded', 'sourceUrl' => null, 'data' => $bin];
    }

    public function poll($externalId, array $job) {
        return ['status' => 'succeeded', 'sourceUrl' => $job['source_url'], 'data' => null, 'error' => ''];
    }

    private function generate(array $job) {
        list($w, $h) = $this->clamp((int) $job['width'], (int) $job['height']);
        return $this->request('/image/generate', [
            'model'          => $job['model'],
            'prompt'         => $job['prompt'],
            'width'          => $w,
            'height'         => $h,
            'format'         => $this->format($job['format']),
            'safe_mode'      => IL_VENICE_SAFE_MODE,
            'hide_watermark' => true,
            'return_binary'  => true,
        ]);
    }

    private function edit(array $job) {
        return $this->request('/image/edit', [
            'model'         => $job['model'],
            'prompt'        => $job['prompt'],
            'image'         => $this->inputBase64($job),
            'output_format' => $this->format($job['format']),
            'aspect_ratio'  => 'auto',
            'safe_mode'     => IL_VENICE_SAFE_MODE,
        ]);
    }

    /**
     * Las dos rutas devuelven la imagen en crudo, pero un error llega como JSON con
     * el mismo Content-Type generico. Se distingue por el contenido: si getimagesize
     * lo reconoce, es la imagen; si no, ahi viene el motivo.
     */
    private function request($route, array $payload) {
        $headers = array_merge($this->headers(), ['Content-Type: application/json', 'Accept: image/*, application/json']);
        $res = il_http('POST', IL_VENICE_BASE_URL . $route, $headers, json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

        if ($res['status'] < 400 && @getimagesizefromstring($res['body']) !== false) return $res['body'];

        $json = json_decode($res['body'], true);
        // Con return_binary la imagen viene en crudo, pero algunos modelos ignoran la
        // bandera y responden el JSON de siempre con la imagen en base64.
        if (is_array($json) && !empty($json['images'][0])) {
            $bin = base64_decode((string) $json['images'][0], true);
            if ($bin !== false && $bin !== '') return $bin;
        }
        throw new ImageDriverException('Venice rechazo el trabajo (HTTP ' . $res['status'] . '): ' . $this->readError($json, $res['body']));
    }

    /** Venice acepta base64 puro o una URL publica; localhost no lo es, asi va el archivo. */
    private function inputBase64(array $job) {
        if (!empty($job['imagePath']) && is_file($job['imagePath'])) {
            return base64_encode(file_get_contents($job['imagePath']));
        }
        // De la nube llega como data URI: se le quita la cabecera y queda el base64.
        $url = (string)($job['imageUrl'] ?? '');
        if (strpos($url, 'base64,') !== false) return substr($url, strpos($url, 'base64,') + 7);
        throw new ImageDriverException('Editar requiere una imagen de entrada.');
    }

    /** El tope de Venice son 1280 px por lado; se reduce en proporcion y vuelve a la rejilla de 64. */
    private function clamp($w, $h) {
        $max = 1280;
        if ($w <= $max && $h <= $max) return [$w, $h];
        $scale = $max / max($w, $h);
        $snap  = function ($v) use ($max) { return min($max, max(256, (int) (round($v / 64) * 64))); };
        return [$snap($w * $scale), $snap($h * $scale)];
    }

    private function format($fmt) {
        $fmt = strtolower((string) $fmt);
        if ($fmt === 'png' || $fmt === 'webp') return $fmt;
        return 'jpeg';
    }

    private function readError($json, $raw) {
        if (is_array($json)) {
            foreach (['details', 'error', 'message'] as $key) {
                if (!empty($json[$key])) {
                    return is_string($json[$key]) ? $json[$key] : json_encode($json[$key], JSON_UNESCAPED_UNICODE);
                }
            }
        }
        return substr((string) $raw, 0, 300);
    }
}

/* ── Replicate ──────────────────────────────────────────────────────────────
   El que corre debajo de TapEdit. Cobra por segundo de GPU, asi que sale bastante
   mas caro que fal por el mismo modelo. */
class ReplicateDriver implements ImageDriver {
    public function name() { return 'replicate'; }

    private function headers() { return ['Authorization: Bearer ' . IL_REPLICATE_API_TOKEN, 'Prefer: respond-async']; }

    public function submit(array $job) {
        $input = ['prompt' => $job['prompt'], 'output_format' => $job['format'] === 'png' ? 'png' : 'jpg'];

        if ($job['task'] === 'edit') {
            if (empty($job['imageUrl'])) throw new ImageDriverException('Editar requiere una imagen de entrada.');
            $input['input_image']  = $job['imageUrl'];
            $input['image']        = $job['imageUrl'];   // los modelos de qwen usan este nombre
            $input['aspect_ratio'] = 'match_input_image';
        } else {
            $input['aspect_ratio'] = $job['aspect'] === 'default' ? '1:1' : $job['aspect'];
        }

        $res = il_http_json('POST', IL_REPLICATE_BASE_URL . '/models/' . $job['model'] . '/predictions', $this->headers(), ['input' => $input]);
        if ($res['__http'] >= 400 || empty($res['id'])) {
            throw new ImageDriverException('Replicate rechazo el trabajo (HTTP ' . $res['__http'] . '): ' . (string)($res['detail'] ?? ''));
        }
        return ['externalId' => (string) $res['id'], 'status' => $this->mapStatus($res['status'] ?? 'starting'), 'sourceUrl' => null, 'data' => null];
    }

    public function poll($externalId, array $job) {
        $res    = il_http_json('GET', IL_REPLICATE_BASE_URL . '/predictions/' . rawurlencode($externalId), $this->headers());
        $status = $this->mapStatus($res['status'] ?? '');

        if ($status === 'succeeded') {
            $out = $res['output'] ?? '';
            $url = is_array($out) ? (string) reset($out) : (string) $out;
            if ($url === '') return ['status' => 'failed', 'sourceUrl' => null, 'data' => null, 'error' => 'Replicate no devolvio imagen'];
            return ['status' => 'succeeded', 'sourceUrl' => $url, 'data' => null, 'error' => ''];
        }
        if ($status === 'failed') {
            return ['status' => 'failed', 'sourceUrl' => null, 'data' => null, 'error' => (string)($res['error'] ?? 'el trabajo fallo')];
        }
        return ['status' => $status, 'sourceUrl' => null, 'data' => null, 'error' => ''];
    }

    private function mapStatus($s) {
        switch ($s) {
            case 'starting':   return 'starting';
            case 'processing': return 'processing';
            case 'succeeded':  return 'succeeded';
            case 'failed':
            case 'canceled':   return 'failed';
        }
        return 'processing';
    }
}

function il_driver($provider) {
    switch ($provider) {
        case 'local':        return new LocalDriver();
        case 'pollinations': return new PollinationsDriver();
        case 'fal':          return new FalDriver();
        case 'venice':       return new VeniceDriver();
        case 'replicate':    return new ReplicateDriver();
    }
    throw new ImageDriverException('Proveedor desconocido: ' . $provider);
}
