<?php
// Test temporal: lista modelos de Ollama Cloud y busca MiniMax.
require __DIR__ . '/../../coffee/app/visor/ctrl/ollama-client.php';

try {
    $c = new OllamaClient();
    $models = $c->listModels();
    $list = $models['models'] ?? ($models['data'] ?? []);
    echo "Modelos visibles en Ollama: " . count($list) . "\n";
    foreach ($list as $m) {
        $name = $m['name'] ?? ($m['model'] ?? (is_string($m) ? $m : json_encode($m)));
        echo "  - $name\n";
    }
} catch (Throwable $e) {
    echo "ERROR listModels: " . $e->getMessage() . "\n";
}
