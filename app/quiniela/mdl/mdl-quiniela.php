<?php
/**
 * Modelo de la Quiniela IA.
 *
 * No usa base de datos. Reutiliza los clientes LLM del visor
 * (coffee/app/visor/ctrl/llm-client.php) para consultar dos modelos y
 * normalizar sus respuestas a un pronostico estructurado y comparable.
 *
 * Enrutado (lo resuelve llm_client_for segun el id del modelo):
 *   - id con '/'  -> OpenRouter   (ej. "minimax/minimax-m1")  <- MiniMax 3.0
 *   - id sin '/'  -> Ollama Cloud (ej. "qwen3-coder:480b-cloud")
 *
 * Las API keys viven en coffee/app/credentials/.env (las leen los clientes).
 */

require_once __DIR__ . '/../../../coffee/app/visor/ctrl/llm-client.php';

class MQuiniela
{
    private $cfg;

    public function __construct()
    {
        $this->cfg = require(__DIR__ . '/../conf/config.php');
    }

    /** Id del modelo configurado para un rol ('minimax' | 'glm' | 'kimi'). */
    public function modelId($which)
    {
        return $this->cfg['models'][$which] ?? '';
    }

    /** Mapa rol => id de todos los modelos configurados. */
    public function models()
    {
        return $this->cfg['models'] ?? [];
    }

    /** Etiquetas visibles de cada modelo (para la UI). */
    public function labels()
    {
        if (!empty($this->cfg['labels'])) return $this->cfg['labels'];

        $labels = [];
        foreach ($this->models() as $role => $id) {
            $labels[$role] = $id;
        }
        return $labels;
    }

    /** Mensajes (system + user) compartidos por ambos modelos. */
    public function buildMessages($teamA, $teamB)
    {
        $system = "Eres un analista estadistico de futbol experto en Copas del Mundo. "
            . "Analiza un partido unico hipotetico entre dos selecciones basandote EXCLUSIVAMENTE en su historia mundialista: "
            . "numero de participaciones, fase mas lejana alcanzada y victorias notables sobre otras selecciones. "
            . "Responde UNICAMENTE con un objeto JSON valido, sin texto extra ni markdown, con esta forma exacta: "
            . '{"goles_a": <entero>, "goles_b": <entero>, "prob_a": <entero>, "prob_b": <entero>, "prob_empate": <entero>, "razonamiento": "<maximo 2 frases en espanol>"}. '
            . "prob_a, prob_b y prob_empate son enteros que DEBEN sumar 100. El marcador debe ser coherente con las probabilidades.";

        $user = "Equipo A: {$teamA}\nEquipo B: {$teamB}\nDame el pronostico del marcador para un partido unico.";

        return [
            ['role' => 'system', 'content' => $system],
            ['role' => 'user',   'content' => $user],
        ];
    }

    /**
     * Consulta un modelo via el cliente del visor y devuelve el pronostico
     * parseado, o ['error' => ...] si algo falla (key ausente, red, parseo).
     */
    public function predictWith($modelId, $messages)
    {
        if (empty($modelId)) return ['error' => 'Modelo no configurado', 'model' => ''];

        try {
            $client  = llm_client_for($modelId);
            $result  = $client->chat($messages, $modelId, $this->cfg['options'] ?? []);
            $content = $result['message']['content'] ?? ($result['response'] ?? '');
            if ($content === '') return ['error' => 'Respuesta vacia del modelo', 'model' => $modelId];

            $pred = $this->parsePrediction($content);
            $pred['model'] = $modelId; // informativo para la UI
            return $pred;
        } catch (Throwable $e) {
            return ['error' => $e->getMessage(), 'model' => $modelId];
        }
    }

    /** Normaliza el JSON crudo de un modelo a un pronostico consistente. */
    private function parsePrediction($content)
    {
        $data = $this->extractJson($content);
        if ($data === null) return ['error' => 'No se pudo interpretar la respuesta del modelo'];

        $ga = (int)($data['goles_a'] ?? 0);
        $gb = (int)($data['goles_b'] ?? 0);
        $pa = (int)($data['prob_a'] ?? 0);
        $pb = (int)($data['prob_b'] ?? 0);
        $pe = (int)($data['prob_empate'] ?? 0);

        // Normaliza las probabilidades para que sumen 100.
        $sum = $pa + $pb + $pe;
        if ($sum <= 0) { $pa = 34; $pb = 33; $pe = 33; }
        else {
            $pa = (int)round($pa * 100 / $sum);
            $pb = (int)round($pb * 100 / $sum);
            $pe = 100 - $pa - $pb;
        }

        return [
            'goles_a'      => $ga,
            'goles_b'      => $gb,
            'marcador'     => "{$ga} - {$gb}",
            'ganador'      => $this->winner($ga, $gb),
            'prob_a'       => $pa,
            'prob_b'       => $pb,
            'prob_empate'  => $pe,
            'razonamiento' => trim($data['razonamiento'] ?? ''),
        ];
    }

    /** Consenso: promedia los modelos que respondieron correctamente. */
    public function consensus($preds)
    {
        $models = [];
        foreach ($preds as $pred) {
            if (empty($pred['error'])) $models[] = $pred;
        }
        if (count($models) === 0) return ['error' => 'Ningun modelo pudo responder'];

        $n  = count($models);
        $ga = (int)round(array_sum(array_column($models, 'goles_a')) / $n);
        $gb = (int)round(array_sum(array_column($models, 'goles_b')) / $n);
        $pa = (int)round(array_sum(array_column($models, 'prob_a')) / $n);
        $pb = (int)round(array_sum(array_column($models, 'prob_b')) / $n);
        $pe = 100 - $pa - $pb;
        if ($pe < 0) $pe = 0;

        // El ganador del consenso se decide por PROBABILIDAD (no por el promedio
        // de goles, que al promediar marcadores opuestos tiende a dar empate).
        $ganador = 'Empate';
        if ($pa > $pb && $pa >= $pe)      $ganador = 'A';
        elseif ($pb > $pa && $pb >= $pe)  $ganador = 'B';

        // Ajusta el marcador para que sea coherente con el ganador elegido.
        if ($ganador === 'A' && $ga <= $gb)      $ga = $gb + 1;
        elseif ($ganador === 'B' && $gb <= $ga)  $gb = $ga + 1;
        elseif ($ganador === 'Empate' && $ga !== $gb) {
            $ga = $gb = (int)round(($ga + $gb) / 2);
        }

        return [
            'goles_a'     => $ga,
            'goles_b'     => $gb,
            'marcador'    => "{$ga} - {$gb}",
            'ganador'     => $ganador,
            'prob_a'      => $pa,
            'prob_b'      => $pb,
            'prob_empate' => $pe,
            'modelos'     => $n,
        ];
    }

    private function winner($ga, $gb)
    {
        if ($ga > $gb) return 'A';
        if ($gb > $ga) return 'B';
        return 'Empate';
    }

    /** Extrae el primer objeto JSON de un string (tolera fences ```json y prosa). */
    private function extractJson($content)
    {
        $content = trim($content);
        $content = preg_replace('/```(?:json)?/i', '', $content);
        $content = str_replace('```', '', $content);

        $start = strpos($content, '{');
        $end   = strrpos($content, '}');
        if ($start === false || $end === false || $end < $start) return null;

        $slice = substr($content, $start, $end - $start + 1);
        $data  = json_decode($slice, true);
        return is_array($data) ? $data : null;
    }
}
