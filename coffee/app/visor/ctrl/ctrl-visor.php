<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$userHome    = getenv('USERPROFILE') ?: getenv('HOME') ?: '';
$CLAUDE_HOME = str_replace('\\', '/', $userHome) . '/.claude';

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
    ],
    'documents' => [
        'label'      => 'Documents',
        'path'       => __DIR__ . '/../documents',
        'subfolder'  => null,
        'subLabel'   => null,
        'pathLabel'  => 'coffee/app/visor/documents',
        'relPrefix'  => 'coffee/app/visor/documents',
        'mode'       => 'tree'
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
    $fm = [
        'name'        => null, 'description' => null, 'model' => null,
        'type'        => null, 'project'     => null,
        'status'      => null, 'date'        => null
    ];
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

function readDocumentsTree($baseDir, $relPrefix) {
    $documents = [];
    if (!is_dir($baseDir)) return $documents;

    $projects = scandir($baseDir);
    if ($projects === false) return $documents;
    sort($projects);

    foreach ($projects as $proj) {
        if ($proj === '.' || $proj === '..') continue;
        $projPath = $baseDir . '/' . $proj;
        if (!is_dir($projPath)) continue;

        $types = [];
        $uncategorized = [];
        $entries = scandir($projPath);
        if ($entries === false) continue;

        foreach ($entries as $entry) {
            if ($entry === '.' || $entry === '..') continue;
            $entryPath = $projPath . '/' . $entry;

            if (is_dir($entryPath)) {
                $files = scandir($entryPath);
                if ($files === false) continue;
                $typeItems = [];
                foreach ($files as $f) {
                    if (substr($f, -3) !== '.md') continue;
                    $full = $entryPath . '/' . $f;
                    if (!is_file($full)) continue;
                    $raw = file_get_contents($full);
                    if ($raw === false) continue;
                    $name = preg_replace('/\.md$/', '', $f);
                    $typeItems[] = [
                        'name'        => $name,
                        'file'        => $f,
                        'section'     => 'documents',
                        'size'        => fmtSize(filesize($full)),
                        'isBackup'    => (stripos($name, 'backup') !== false),
                        'frontmatter' => parseFrontmatter($raw),
                        'raw'         => $raw,
                        'mtime'       => date('Y-m-d H:i:s', filemtime($full)),
                        'fullPath'    => str_replace('\\', '/', $full),
                        'relPath'     => $relPrefix . '/' . $proj . '/' . $entry . '/' . $f,
                        'project'     => $proj,
                        'type'        => $entry
                    ];
                }
                usort($typeItems, function ($a, $b) {
                    return strcasecmp($a['name'], $b['name']);
                });
                if (count($typeItems)) $types[$entry] = $typeItems;
            } else if (substr($entry, -3) === '.md') {
                $full = $entryPath;
                if (!is_file($full)) continue;
                $raw = file_get_contents($full);
                if ($raw === false) continue;
                $name = preg_replace('/\.md$/', '', $entry);
                $uncategorized[] = [
                    'name'        => $name,
                    'file'        => $entry,
                    'section'     => 'documents',
                    'size'        => fmtSize(filesize($full)),
                    'isBackup'    => (stripos($name, 'backup') !== false),
                    'frontmatter' => parseFrontmatter($raw),
                    'raw'         => $raw,
                    'mtime'       => date('Y-m-d H:i:s', filemtime($full)),
                    'fullPath'    => str_replace('\\', '/', $full),
                    'relPath'     => $relPrefix . '/' . $proj . '/' . $entry,
                    'project'     => $proj,
                    'type'        => '(sin clasificar)'
                ];
            }
        }

        if (count($uncategorized)) {
            usort($uncategorized, function ($a, $b) {
                return strcasecmp($a['name'], $b['name']);
            });
            $types['(sin clasificar)'] = $uncategorized;
        }

        if (count($types)) {
            uksort($types, function ($a, $b) {
                if ($a === '(sin clasificar)') return 1;
                if ($b === '(sin clasificar)') return -1;
                return strcasecmp($a, $b);
            });
            $documents[$proj] = $types;
        }
    }

    return $documents;
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

$mode = ($preset['mode'] ?? 'flat');

if ($mode === 'tree') {
    $documents = readDocumentsTree($rootDir, $relPrefix);
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
            'sectionLabel' => null
        ],
        'documents' => $documents,
        'agents'    => [],
        'grimoires' => []
    ];
} else {
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
}

echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
