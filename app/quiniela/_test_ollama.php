<?php
// Test temporal: valida la pipeline de Ollama (prompt -> parseo).
require __DIR__ . '/mdl/mdl-quiniela.php';

$m = new MQuiniela();
$msgs = $m->buildMessages('Corea del Sur', 'Republica Checa');

$start = microtime(true);
$res = $m->callOllama($msgs);
$elapsed = round(microtime(true) - $start, 1);

echo "Elapsed: {$elapsed}s\n";
echo json_encode($res, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n";
