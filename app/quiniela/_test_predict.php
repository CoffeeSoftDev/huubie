<?php
// Test temporal: predicción completa de punta a punta (ambos modelos + consenso).
require __DIR__ . '/mdl/mdl-quiniela.php';

$mdl = new MQuiniela();
$messages = $mdl->buildMessages('Corea del Sur', 'Republica Checa');

$t0 = microtime(true);
$minimax = $mdl->predictWith($mdl->modelId('minimax'), $messages);
$t1 = microtime(true);
$ollama  = $mdl->predictWith($mdl->modelId('ollama'), $messages);
$t2 = microtime(true);
$consenso = $mdl->consensus($minimax, $ollama);

echo "MiniMax (" . round($t1 - $t0, 1) . "s):\n" . json_encode($minimax, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n\n";
echo "GPT-OSS (" . round($t2 - $t1, 1) . "s):\n" . json_encode($ollama, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n\n";
echo "Consenso:\n" . json_encode($consenso, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n";
