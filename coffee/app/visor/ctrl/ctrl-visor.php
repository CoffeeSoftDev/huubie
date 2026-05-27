<?php
header('Cache-Control: no-store');

// Endpoint lazy-read para archivos de Drive (no devuelve JSON, devuelve el contenido raw)
if (($_GET['action'] ?? '') === 'driveread') {
    require_once __DIR__ . '/drive-client.php';
    $id   = $_GET['id']   ?? '';
    $mime = $_GET['mime'] ?? '';
    if (!$id) { header('Content-Type: text/plain'); http_response_code(400); echo '// ID requerido'; exit; }

    header('Content-Type: text/plain; charset=utf-8');
    try {
        $drive = new DriveClient();
        // Solo previsualizamos texto, markdown, codigo o Google Docs
        $isText  = strpos($mime, 'text/') === 0;
        $isCode  = in_array($mime, ['application/json','application/javascript','application/x-javascript','application/xml','application/sql']);
        $isGdoc  = strpos($mime, 'application/vnd.google-apps.') === 0;
        if ($isText || $isCode) {
            echo $drive->downloadFile($id);
        } elseif ($isGdoc) {
            echo $drive->getFileContent(['id' => $id, 'mimeType' => $mime]);
        } else {
            echo "> Archivo no previsualizable en el visor.\n>\n> **Tipo:** `$mime`\n>\n> Usa el enlace 'Abrir en Drive' para verlo.";
        }
    } catch (Throwable $e) {
        http_response_code(500);
        echo "> Error al leer el archivo desde Drive:\n>\n> " . $e->getMessage();
    }
    exit;
}

// Endpoint para guardar archivos locales (POST)
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST' && ($_POST['action'] ?? '') === 'save') {
    header('Content-Type: application/json; charset=utf-8');

    $fullPath   = trim($_POST['fullPath']   ?? '');
    $customPath = trim($_POST['customPath'] ?? '');
    $content    = $_POST['content'] ?? '';

    if ($fullPath === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'fullPath requerido']);
        exit;
    }

    // Extensiones de texto admitidas
    $allowedExts = [
        'md','markdown','txt','json','yml','yaml','toml','xml','csv','tsv',
        'html','htm','css','scss','js','ts','php','py','rb','go','rs',
        'java','c','cpp','cs','sh','sql','ini','conf','log','env'
    ];
    $ext = strtolower(pathinfo($fullPath, PATHINFO_EXTENSION));
    if (!in_array($ext, $allowedExts, true)) {
        echo json_encode(['success' => false, 'message' => "Extension no editable: .$ext"]);
        exit;
    }

    // Sandbox: validar que el archivo cae dentro de un root conocido
    $userHome    = getenv('USERPROFILE') ?: getenv('HOME') ?: '';
    $CLAUDE_HOME = str_replace('\\', '/', $userHome) . '/.claude';
    $allowedRoots = [
        $CLAUDE_HOME . '/agents',
        $CLAUDE_HOME . '/commands',
        $CLAUDE_HOME . '/steering',
        str_replace('\\', '/', __DIR__ . '/../documents'),
    ];
    if ($customPath !== '') $allowedRoots[] = str_replace('\\', '/', $customPath);

    $target  = str_replace('\\', '/', $fullPath);
    $dir     = dirname($target);
    $dirReal = realpath($dir);
    if ($dirReal === false) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Carpeta destino no existe']);
        exit;
    }
    $dirReal = str_replace('\\', '/', $dirReal);

    $inside = false;
    foreach ($allowedRoots as $root) {
        $rootReal = realpath($root);
        if ($rootReal === false) continue;
        $rootReal = rtrim(str_replace('\\', '/', $rootReal), '/');
        if (strpos($dirReal . '/', $rootReal . '/') === 0) { $inside = true; break; }
    }
    if (!$inside) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Ruta fuera del sandbox del visor']);
        exit;
    }

    $bytes = @file_put_contents($target, $content);
    if ($bytes === false) {
        $err = error_get_last();
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'No se pudo escribir: ' . ($err['message'] ?? 'IO error')]);
        exit;
    }

    $size    = filesize($target);
    $sizeFmt = $size < 1024 ? $size . ' B' : ($size < 1024 * 1024 ? round($size / 1024) . ' KB' : round($size / (1024 * 1024), 1) . ' MB');
    echo json_encode([
        'success' => true,
        'message' => 'Guardado',
        'size'    => $sizeFmt,
        'bytes'   => $bytes,
        'mtime'   => date('Y-m-d H:i:s', filemtime($target))
    ]);
    exit;
}

header('Content-Type: application/json; charset=utf-8');

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
    ],
];

// Auto-descubrimiento: agrega un preset por cada carpeta de Drive compartida con el SA
function discoverDrivePresets() {
    try {
        require_once __DIR__ . '/drive-client.php';
        $drive = new DriveClient();
        $folders = $drive->listSharedFolders();
        $out = [];
        foreach ($folders as $f) {
            $out['drive:' . $f['id']] = [
                'label'         => 'Drive · ' . $f['name'],
                'path'          => 'drive://' . $f['name'],
                'subfolder'     => null,
                'subLabel'      => null,
                'pathLabel'     => 'Google Drive · ' . $f['name'],
                'relPrefix'     => 'drive/' . $f['id'],
                'mode'          => 'drive',
                'driveFolderId' => $f['id']
            ];
        }
        return $out;
    } catch (Throwable $e) {
        return [];
    }
}
$PRESETS = array_merge($PRESETS, discoverDrivePresets());

$folderKey  = isset($_GET['folder']) ? trim($_GET['folder']) : 'agents';
$customPath = isset($_GET['path'])   ? trim($_GET['path'])   : '';

function presetList($presets) {
    $out = [];
    foreach ($presets as $key => $p) {
        $isDrive = ($p['mode'] ?? '') === 'drive';
        $out[] = [
            'key'      => $key,
            'label'    => $p['label'],
            'path'     => $p['path'],
            'exists'   => $isDrive ? true : is_dir($p['path'])
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

function readDriveTree($relPrefix, $folderId) {
    require_once __DIR__ . '/drive-client.php';
    $drive = new DriveClient();
    $documents = [];

    $rootChildren = $drive->listChildren($folderId, 'all');
    $rootFolders  = [];
    $rootLoose    = [];
    foreach ($rootChildren as $c) {
        if (($c['mimeType'] ?? '') === DRIVE_FOLDER_MIME) $rootFolders[] = $c;
        else                                              $rootLoose[]   = $c;
    }

    // Lazy: solo metadatos. El contenido se descarga bajo demanda via ?action=driveread
    $buildFile = function ($f, $projectName, $typeName, $relPrefix) {
        $name = $f['name'];
        $displayName = preg_replace('/\.md$/', '', $name);
        return [
            'name'        => $displayName,
            'file'        => $name,
            'section'     => 'documents',
            'size'        => fmtSize($f['size'] ?? 0),
            'isBackup'    => (stripos($displayName, 'backup') !== false),
            'frontmatter' => ['name' => null, 'description' => null, 'model' => null, 'type' => null, 'project' => null, 'status' => null, 'date' => null],
            'raw'         => '',
            'lazyDrive'   => true,
            'mtime'       => isset($f['modifiedTime']) ? date('Y-m-d H:i:s', strtotime($f['modifiedTime'])) : '',
            'fullPath'    => 'drive://' . $f['id'],
            'relPath'     => $relPrefix . '/' . $projectName . '/' . $typeName . '/' . $name,
            'project'     => $projectName,
            'type'        => $typeName,
            'driveId'     => $f['id'],
            'mimeType'    => $f['mimeType'] ?? ''
        ];
    };

    // Archivos sueltos en la raiz → pseudo-proyecto "(general)" / pseudo-tipo "(sin clasificar)"
    if (!empty($rootLoose)) {
        $items = [];
        foreach ($rootLoose as $f) {
            $items[] = $buildFile($f, '(general)', '(sin clasificar)', $relPrefix);
        }
        usort($items, function ($a, $b) { return strcasecmp($a['name'], $b['name']); });
        $documents['(general)'] = ['(sin clasificar)' => $items];
    }

    // Proyectos reales (carpetas en root)
    foreach ($rootFolders as $proj) {
        $projChildren = $drive->listChildren($proj['id'], 'all');
        $typeFolders  = [];
        $projLoose    = [];
        foreach ($projChildren as $c) {
            if (($c['mimeType'] ?? '') === DRIVE_FOLDER_MIME) $typeFolders[] = $c;
            else                                              $projLoose[]   = $c;
        }

        $types = [];

        if (!empty($projLoose)) {
            $items = [];
            foreach ($projLoose as $f) {
                $items[] = $buildFile($f, $proj['name'], '(sin clasificar)', $relPrefix);
            }
            usort($items, function ($a, $b) { return strcasecmp($a['name'], $b['name']); });
            $types['(sin clasificar)'] = $items;
        }

        foreach ($typeFolders as $type) {
            $rawFiles = $drive->listChildren($type['id'], 'file');
            $items = [];
            foreach ($rawFiles as $f) {
                $items[] = $buildFile($f, $proj['name'], $type['name'], $relPrefix);
            }
            usort($items, function ($a, $b) { return strcasecmp($a['name'], $b['name']); });
            if (count($items)) $types[$type['name']] = $items;
        }

        if (count($types)) {
            uksort($types, function ($a, $b) {
                if ($a === '(sin clasificar)') return 1;
                if ($b === '(sin clasificar)') return -1;
                return strcasecmp($a, $b);
            });
            $documents[$proj['name']] = $types;
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
    // Migracion: la antigua key 'drive' apunta al primer preset Drive descubierto
    if ($folderKey === 'drive') {
        foreach (array_keys($PRESETS) as $k) {
            if (strpos($k, 'drive:') === 0) { $folderKey = $k; break; }
        }
    }
    if (!isset($PRESETS[$folderKey])) $folderKey = 'agents';
    $preset    = $PRESETS[$folderKey];
    $rootDir   = $preset['path'];
    $subDir    = $preset['subfolder'] ? $rootDir . '/' . $preset['subfolder'] : null;
    $subLabel  = $preset['subLabel'];
    $pathLabel = $preset['pathLabel'];
    $relPrefix = $preset['relPrefix'];
    $activeKey = $folderKey;
    $activeLbl = $preset['label'];
    // Drive no es filesystem — su validez se evalua al construir el arbol
    $isValid   = ($preset['mode'] ?? '') === 'drive' ? true : is_dir($rootDir);
}

$mode = ($preset['mode'] ?? 'flat');

if ($mode === 'drive') {
    try {
        $folderId = $preset['driveFolderId'] ?? null;
        if (!$folderId) throw new Exception('Preset Drive sin folderId');
        $documents = readDriveTree($relPrefix, $folderId);
        $valid = true;
        $errMsg = null;
    } catch (Throwable $e) {
        $documents = [];
        $valid = false;
        $errMsg = $e->getMessage();
    }
    $payload = [
        'header' => [
            'title'        => 'Visor de Agentes',
            'subtitle'     => 'CoffeeSoft Library',
            'user'         => ['initials' => 'RV', 'name' => 'Rosy V.', 'role' => 'Guardiana'],
            'pathLabel'    => $pathLabel,
            'source'       => 'Drive',
            'currentKey'   => $activeKey,
            'currentLabel' => $activeLbl,
            'currentPath'  => $rootDir,
            'valid'        => $valid,
            'presets'      => presetList($PRESETS),
            'sectionLabel' => null,
            'error'        => $errMsg
        ],
        'documents' => $documents,
        'agents'    => [],
        'grimoires' => []
    ];
} elseif ($mode === 'tree') {
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
