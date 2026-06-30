<?php
/**
 * Endpoint de GitHub Projects (v2) para CoffeeIA.
 * Consulta la GraphQL API con el token de credentials/.env y devuelve JSON
 * normalizado para que el frontend pinte la "card" del tablero en el chat.
 *
 * Acciones (opc):
 *   - list           -> proyectos del usuario dueno del token (viewer).
 *   - items&number=N -> items del proyecto N, con Status y Size normalizados.
 */

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/github-config.php';

$opc = $_REQUEST['opc'] ?? '';

/** Respuesta de error uniforme. */
function gh_fail(string $message, int $http = 400): void
{
    http_response_code($http);
    echo json_encode(['ok' => false, 'error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

if (!github_has_token()) {
    gh_fail('No hay token de GitHub configurado. Agrega GITHUB_TOKEN en coffee/app/credentials/.env', 500);
}

try {
    switch ($opc) {

        case 'list':
            $resp = github_graphql('
                query {
                    viewer {
                        login
                        projectsV2(first: 50) {
                            totalCount
                            nodes { number title url shortDescription closed updatedAt items { totalCount } }
                        }
                    }
                }
            ');

            $viewer = $resp['data']['viewer'] ?? null;
            if (!$viewer) {
                gh_fail('GitHub no devolvio datos del usuario. Revisa el token / permiso read:project.', 502);
            }

            $nodes    = $viewer['projectsV2']['nodes'] ?? [];
            $total    = $viewer['projectsV2']['totalCount'] ?? 0;
            $projects = [];
            $inaccessible = 0;

            foreach ($nodes as $n) {
                // Los proyectos sin acceso (p. ej. de una organizacion) llegan como null.
                if ($n === null) { $inaccessible++; continue; }
                $projects[] = [
                    'number'           => $n['number'] ?? null,
                    'title'            => $n['title'] ?? '(sin titulo)',
                    'url'              => $n['url'] ?? '',
                    'shortDescription' => $n['shortDescription'] ?? '',
                    'closed'           => (bool)($n['closed'] ?? false),
                    'updatedAt'        => $n['updatedAt'] ?? '',
                    'itemsCount'       => $n['items']['totalCount'] ?? 0,
                ];
            }

            echo json_encode([
                'ok'           => true,
                'login'        => $viewer['login'] ?? '',
                'total'        => $total,
                'projects'     => $projects,
                'inaccessible' => $inaccessible,
            ], JSON_UNESCAPED_UNICODE);
            break;

        case 'items':
            $number = (int)($_REQUEST['number'] ?? 0);
            if ($number <= 0) {
                gh_fail('Falta el numero de proyecto (number).');
            }

            $resp = github_graphql('
                query($number: Int!) {
                    viewer {
                        projectV2(number: $number) {
                            title
                            url
                            shortDescription
                            updatedAt
                            fields(first: 40) {
                                nodes {
                                    __typename
                                    ... on ProjectV2SingleSelectField { name options { name } }
                                    ... on ProjectV2IterationField {
                                        name
                                        configuration {
                                            iterations { title startDate }
                                            completedIterations { title startDate }
                                        }
                                    }
                                }
                            }
                            items(first: 100) {
                                totalCount
                                nodes {
                                    type
                                    content {
                                        __typename
                                        ... on DraftIssue { title }
                                        ... on Issue { number title state url }
                                        ... on PullRequest { number title state url }
                                    }
                                    fieldValues(first: 20) {
                                        nodes {
                                            __typename
                                            ... on ProjectV2ItemFieldSingleSelectValue {
                                                name
                                                field { ... on ProjectV2FieldCommon { name } }
                                            }
                                            ... on ProjectV2ItemFieldIterationValue {
                                                title
                                                field { ... on ProjectV2FieldCommon { name } }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            ', ['number' => $number]);

            $project = $resp['data']['viewer']['projectV2'] ?? null;
            if (!$project) {
                gh_fail('Proyecto no encontrado o sin acceso con este token.', 404);
            }

            $items = [];
            foreach (($project['items']['nodes'] ?? []) as $node) {
                $content = $node['content'] ?? [];
                $status  = null;
                $size    = null;
                $sprint  = null;

                foreach (($node['fieldValues']['nodes'] ?? []) as $fv) {
                    $tn    = $fv['__typename'] ?? '';
                    $fname = $fv['field']['name'] ?? '';
                    if ($tn === 'ProjectV2ItemFieldSingleSelectValue') {
                        if ($fname === 'Status')      $status = $fv['name'] ?? null;
                        elseif ($fname === 'Size')    $size   = $fv['name'] ?? null;
                    } elseif ($tn === 'ProjectV2ItemFieldIterationValue') {
                        $sprint = $fv['title'] ?? null;
                    }
                }

                $items[] = [
                    'title'  => $content['title'] ?? '(sin titulo)',
                    'type'   => $content['__typename'] ?? ($node['type'] ?? ''),
                    'number' => $content['number'] ?? null,
                    'url'    => $content['url'] ?? '',
                    'state'  => $content['state'] ?? '',
                    'status' => $status ?: 'Sin estado',
                    'size'   => $size ?: '',
                    'sprint' => $sprint ?: '',
                ];
            }

            // Opciones de Status (define el orden de columnas) e iteraciones (sprints).
            $statusOptions = [];
            $iterations    = [];
            foreach (($project['fields']['nodes'] ?? []) as $f) {
                $tn = $f['__typename'] ?? '';
                if ($tn === 'ProjectV2SingleSelectField' && ($f['name'] ?? '') === 'Status') {
                    foreach (($f['options'] ?? []) as $o) {
                        if (isset($o['name'])) $statusOptions[] = $o['name'];
                    }
                } elseif ($tn === 'ProjectV2IterationField') {
                    foreach (($f['configuration']['iterations'] ?? []) as $it) {
                        $iterations[] = ['title' => $it['title'] ?? '', 'startDate' => $it['startDate'] ?? '', 'active' => true];
                    }
                    foreach (($f['configuration']['completedIterations'] ?? []) as $it) {
                        $iterations[] = ['title' => $it['title'] ?? '', 'startDate' => $it['startDate'] ?? '', 'active' => false];
                    }
                }
            }

            echo json_encode([
                'ok'            => true,
                'project'       => [
                    'number'           => $number,
                    'title'            => $project['title'] ?? '(sin titulo)',
                    'url'              => $project['url'] ?? '',
                    'shortDescription' => $project['shortDescription'] ?? '',
                    'updatedAt'        => $project['updatedAt'] ?? '',
                    'total'            => $project['items']['totalCount'] ?? count($items),
                ],
                'statusOptions' => $statusOptions,
                'iterations'    => $iterations,
                'items'         => $items,
            ], JSON_UNESCAPED_UNICODE);
            break;

        default:
            gh_fail('Accion no reconocida: ' . $opc);
    }
} catch (Throwable $e) {
    gh_fail('Error al consultar GitHub: ' . $e->getMessage(), 502);
}
