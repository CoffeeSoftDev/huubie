<?php
// Test temporal: predicción completa de punta a punta (todos los modelos + consenso).
require __DIR__ . '/mdl/mdl-quiniela.php';

$mdl = new MQuiniela();
$messages = $mdl->buildMessages('Corea del Sur', 'Republica Checa');
$labels   = $mdl->labels();

$predictions = [];
foreach ($mdl->models() as $role => $modelId) {
    $t0 = microtime(true);
    $predictions[$role] = $mdl->predictWith($modelId, $messages);
    $t1 = microtime(true);
    $name = $labels[$role] ?? $role;
    echo "{$name} (" . round($t1 - $t0, 1) . "s):\n" . json_encode($predictions[$role], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n\n";
}

$consenso = $mdl->consensus(array_values($predictions));
echo "Consenso:\n" . json_encode($consenso, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n";
