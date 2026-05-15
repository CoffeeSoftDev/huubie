<?php
$pdo = new PDO('mysql:host=localhost;dbname=fayxzvov_alpha', 'root', '', [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::MYSQL_ATTR_INIT_COMMAND => 'SET NAMES utf8'
]);

$tables = [
    'fayxzvov_reginas.`order`',
    'fayxzvov_reginas.order_clients',
    'fayxzvov_reginas.order_package',
    'fayxzvov_reginas.pos_order_payment',
    'fayxzvov_reginas.pos_payment_type',
    'fayxzvov_reginas.cash_shift',
    'fayxzvov_alpha.subsidiaries',
];

foreach ($tables as $t) {
    echo "===== $t =====\n";
    try {
        $rows = $pdo->query("DESCRIBE $t")->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as $r) {
            printf("  %-30s %-25s %-5s %-10s %s\n",
                $r['Field'], $r['Type'], $r['Null'],
                ($r['Default'] === null ? 'NULL' : $r['Default']),
                $r['Extra']
            );
        }
    } catch (Throwable $e) {
        echo "  ERROR: " . $e->getMessage() . "\n";
    }
    echo "\n";
}

echo "===== pos_payment_type rows =====\n";
try {
    $rows = $pdo->query("SELECT id, code, name, is_cash FROM fayxzvov_reginas.pos_payment_type")->fetchAll(PDO::FETCH_ASSOC);
    foreach ($rows as $r) print_r($r);
} catch (Throwable $e) { echo "  ERROR: " . $e->getMessage() . "\n"; }

echo "\n===== subsidiaries id=4 =====\n";
try {
    $rows = $pdo->query("SELECT id, name FROM fayxzvov_alpha.subsidiaries WHERE id = 4")->fetchAll(PDO::FETCH_ASSOC);
    foreach ($rows as $r) print_r($r);
} catch (Throwable $e) { echo "  ERROR: " . $e->getMessage() . "\n"; }

echo "\n===== cash_shift muestra =====\n";
try {
    $rows = $pdo->query("SELECT id, subsidiaries_id, active FROM fayxzvov_reginas.cash_shift LIMIT 5")->fetchAll(PDO::FETCH_ASSOC);
    foreach ($rows as $r) print_r($r);
} catch (Throwable $e) { echo "  ERROR: " . $e->getMessage() . "\n"; }
