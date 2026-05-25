<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$CLAUDE_HOME = 'C:/Users/CoffeSoft/.claude';

$PRESETS = [
    'agents' => [
        'label'      => 'Agentes',
        'path'       => $CLAUDE_HOME . '/agents',
        'subfolder'  => 'grimorios',
        'subLabel'   => 'Grimorios',
        'pathLabel'  => '.claude/agents',
        'relPrefix'  => '.claude/agents'
    ],
    'commands' => [
        'label'      => 'Comandos',
        'path'       => $CLAUDE_HOME . '/commands',
        'subfolder'  => null,
        'subLabel'   => null,
        'pathLabel'  => '.claude/commands',
        'relPrefix'  => '.claude/commands'
    ],
    'steering' => [
        'label'      => 'Steering',
        'path'       => $CLAUDE_HOME . '/steering',
        'subfolder'  => null,
        'subLabel'   => null,
        'pathLabel'  => '.claude/steering',
        'relPrefix'  => '.claude/steering'
    ],
    'grimoires' => [
        'label'      => 'Solo Grimorios',
        'path'       => $CLAUDE_HOME . '/agents/grimorios',
        'subfolder'  => null,
        'subLabel'   => null,
        'pathLabel'  => '.claude/agents/grimorios',
        'relPrefix'  => '.claude/agents/grimorios'
    ]
];

$folderKey  = isset($_GET['folder']) ? trim($_GET['folder']) : 'agents';
$customPath = isset($_GET['path'])   ? trim($_GET['path'])   : '';

function presetList($presets) {
    $out = [];
    foreach ($presets as $key => $p) {
        $out[] = [
            'key'      => $key,
            'label'    => $p['label'],
            'path'     => $p['path'],
            'exists'   => is_dir($p['path'])
        ];
    }
    return $out;
}

function parseFrontmatter($raw) {
    $fm = ['name' => null, 'description' => null, 'model' => null];
    if (preg_match('/^---\r?\n(.*?)\r?\n---/s', $raw, $m)) {
        $block = $m[1];
        foreach (explode("\n", $block) as $line) {
            if (preg_match('/^([\w-]+):\s*(.+?)\s*$/', $line, $kv)) {
                $key = $kv[1];
                $val = trim($kv[2], " \t\"'");
                if (array_key_exists($key, $fm)) $fm[$key] = $val;
            }
        }
    }
    return $fm;
}

function fmtSize($bytes) {
    if ($bytes < 1024)         return $bytes . ' B';
    if ($bytes < 1024 * 1024)  return round($bytes / 1024) . ' KB';
    return round($bytes / (1024 * 1024), 1) . ' MB';
}

function readSection($dir, $section, $relPrefix) {
    $items = [];
    if (!is_dir($dir)) return $items;
    $files = scandir($dir);
    if ($files === false) return $items;

    foreach ($files as $f) {
        if ($f === '.' || $f === '..') continue;
        $full = $dir . '/' . $f;
        if (is_dir($full))                continue;
        if (substr($f, -3) !== '.md')     continue;

        $raw = file_get_contents($full);
        if ($raw === false) continue;

        $name = preg_replace('/\.md$/', '', $f);

        $items[] = [
            'name'        => $name,
            'file'        => $f,
            'section'     => $section,
            'size'        => fmtSize(filesize($full)),
            'isBackup'    => (stripos($name, 'backup') !== false),
            'frontmatter' => parseFrontmatter($raw),
            'raw'         => $raw,
            'mtime'       => date('Y-m-d H:i:s', filemtime($full)),
            'fullPath'    => str_replace('\\', '/', $full),
            'relPath'     => $relPrefix . '/' . $f
        ];
    }

    usort($items, function ($a, $b) {
        return strcasecmp($a['name'], $b['name']);
    });

    return $items;
}

if ($folderKey === 'custom' && $customPath !== '') {
    $normalized = str_replace('\\', '/', $customPath);
    $baseLabel  = basename($normalized);
    $rootDir    = $normalized;
    $subDir     = $normalized . '/grimorios';
    $subLabel   = 'grimorios';
    $pathLabel  = $normalized;
    $relPrefix  = $normalized;
    $activeKey  = 'custom';
    $activeLbl  = $baseLabel !== '' ? $baseLabel : 'Custom';
    $isValid    = is_dir($rootDir);
} else {
    if (!isset($PRESETS[$folderKey])) $folderKey = 'agents';
    $preset    = $PRESETS[$folderKey];
    $rootDir   = $preset['path'];
    $subDir    = $preset['subfolder'] ? $rootDir . '/' . $preset['subfolder'] : null;
    $subLabel  = $preset['subLabel'];
    $pathLabel = $preset['pathLabel'];
    $relPrefix = $preset['relPrefix'];
    $activeKey = $folderKey;
    $activeLbl = $preset['label'];
    $isValid   = is_dir($rootDir);
}

$agents    = readSection($rootDir, 'agentes', $relPrefix);
$grimoires = $subDir ? readSection($subDir, 'grimorios', $relPrefix . '/grimorios') : [];

$payload = [
    'header' => [
        'title'        => 'Visor de Agentes',
        'subtitle'     => 'CoffeeSoft Library',
        'user'         => ['initials' => 'RV', 'name' => 'Rosy V.', 'role' => 'Guardiana'],
        'pathLabel'    => $pathLabel,
        'source'       => 'Local',
        'currentKey'   => $activeKey,
        'currentLabel' => $activeLbl,
        'currentPath'  => str_replace('\\', '/', $rootDir),
        'valid'        => $isValid,
        'presets'      => presetList($PRESETS),
        'sectionLabel' => $subLabel
    ],
    'agents'    => $agents,
    'grimoires' => $grimoires
];

echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
