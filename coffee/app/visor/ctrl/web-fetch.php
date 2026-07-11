<?php
/**
 * Consulta de paginas web para CoffeeIA (visor/playground/forge/studio).
 *
 * Permite "clonar" una pagina: cuando el usuario pega una URL http(s) en su
 * mensaje, el backend la descarga server-side (cURL), limpia el HTML (sin
 * <script> ni comentarios), baja hasta 2 hojas CSS externas y lo inyecta todo
 * como FUENTE DE VERDAD en el contexto — funciona con TODOS los modelos,
 * incluso los que no soportan tool-calling.
 *
 * Ademas expone la herramienta `fetch_url` (formato OpenAI) para los loops
 * agenticos: el modelo puede bajar bajo demanda recursos adicionales, p.ej.
 * una hoja de estilos que no se descargo automaticamente.
 *
 * No hay whitelist de hosts: es una herramienta de desarrollo local (WAMP) y
 * clonar http://localhost/... de los propios vhosts es un caso de uso valido.
 */

if (!defined('WEB_FETCH_TIMEOUT'))    define('WEB_FETCH_TIMEOUT', 15);        // seg por peticion
if (!defined('WEB_FETCH_MAX_BYTES'))  define('WEB_FETCH_MAX_BYTES', 3145728); // 3MB de descarga
if (!defined('WEB_FETCH_MAX_HTML'))   define('WEB_FETCH_MAX_HTML', 160000);   // chars de HTML inyectado
if (!defined('WEB_FETCH_MAX_CSS'))    define('WEB_FETCH_MAX_CSS', 50000);     // chars por hoja CSS
if (!defined('WEB_FETCH_MAX_SHEETS')) define('WEB_FETCH_MAX_SHEETS', 3);      // hojas CSS por pagina
if (!defined('WEB_FETCH_MAX_URLS'))   define('WEB_FETCH_MAX_URLS', 2);        // URLs por mensaje

/**
 * Extrae las URLs http(s) "clonables" de un mensaje: descarta assets binarios
 * (imagenes, fuentes, videos...) y deduplica. Maximo WEB_FETCH_MAX_URLS.
 */
function web_extract_urls($text, $max = WEB_FETCH_MAX_URLS) {
    if (!preg_match_all('#https?://[^\s"\'<>()\[\]{}]+#iu', (string) $text, $m)) return [];
    $skip = ['jpg','jpeg','png','gif','webp','svg','ico','woff','woff2','ttf','otf','eot',
             'mp4','mp3','avi','mov','webm','pdf','zip','rar','7z','gz','exe','dll'];
    $out = [];
    foreach ($m[0] as $u) {
        $u = rtrim($u, '.,;:!?');
        $path = (string) parse_url($u, PHP_URL_PATH);
        $ext  = strtolower(pathinfo($path, PATHINFO_EXTENSION));
        if (in_array($ext, $skip, true)) continue;
        if (!in_array($u, $out, true)) $out[] = $u;
        if (count($out) >= $max) break;
    }
    return $out;
}

/**
 * Descarga cruda de una URL con cURL.
 * @return array{status:int, content_type:string, body:string, final_url:string, truncated:bool}|array{error:string}
 */
function web_fetch_raw($url) {
    if (!preg_match('#^https?://#i', $url)) return ['error' => 'solo se permiten URLs http(s)'];
    if (!function_exists('curl_init'))      return ['error' => 'cURL no esta disponible en este PHP'];
    $body = '';
    $truncated = false;
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS      => 4,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_TIMEOUT        => WEB_FETCH_TIMEOUT,
        CURLOPT_ENCODING       => '',
        // WAMP local rara vez tiene curl.cainfo configurado: sin esto TODA URL
        // https fallaria por certificado. Solo se lee contenido publico.
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => 0,
        CURLOPT_USERAGENT      => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        CURLOPT_HTTPHEADER     => [
            'Accept: text/html,application/xhtml+xml,text/css,*/*;q=0.8',
            'Accept-Language: es-MX,es;q=0.9,en;q=0.8',
        ],
        // Corta la descarga al pasar el tope de bytes; lo ya recibido se conserva.
        CURLOPT_WRITEFUNCTION  => function ($ch, $chunk) use (&$body, &$truncated) {
            $body .= $chunk;
            if (strlen($body) > WEB_FETCH_MAX_BYTES) { $truncated = true; return -1; }
            return strlen($chunk);
        },
    ]);
    curl_exec($ch);
    $errno  = curl_errno($ch);
    $err    = curl_error($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $ctype  = (string) curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
    $final  = (string) curl_getinfo($ch, CURLINFO_EFFECTIVE_URL);
    curl_close($ch);
    // El abort por tamano (write callback) no es fallo: se usa el cuerpo parcial.
    if ($errno && !$truncated && $body === '') return ['error' => "no se pudo descargar ($err)"];
    return ['status' => $status, 'content_type' => $ctype, 'body' => $body,
            'final_url' => $final !== '' ? $final : $url, 'truncated' => $truncated];
}

/** Resuelve un href (relativo, absoluto o protocol-relative) contra la URL base. */
function web_abs_url($href, $baseUrl) {
    $href = trim((string) $href);
    if ($href === '' || stripos($href, 'data:') === 0) return '';
    if (preg_match('#^https?://#i', $href)) return $href;
    $p = parse_url($baseUrl);
    if (!isset($p['scheme'], $p['host'])) return '';
    $origin = $p['scheme'] . '://' . $p['host'] . (isset($p['port']) ? ':' . $p['port'] : '');
    if (strpos($href, '//') === 0) return $p['scheme'] . ':' . $href;
    if (strpos($href, '/') === 0)  return $origin . $href;
    $dir = isset($p['path']) ? preg_replace('#/[^/]*$#', '/', $p['path']) : '/';
    if ($dir === '' || $dir[0] !== '/') $dir = '/';
    $path = $dir . $href;
    // Normaliza los ../ para que el clon no arrastre rutas tipo /a/../b.
    do { $path = preg_replace('#/(?!\.\.)[^/]+/\.\./#', '/', $path, 1, $n); } while ($n);
    return $origin . $path;
}

/**
 * Absolutiza los url(...) de un CSS contra la URL del documento que lo contiene,
 * para que fondos, fuentes y sprites del clon carguen desde el sitio original.
 */
function web_abs_css_urls($css, $baseUrl) {
    return preg_replace_callback('#url\(\s*(["\']?)([^"\')\s]+)\1\s*\)#i', function ($m) use ($baseUrl) {
        $u = trim($m[2]);
        if ($u === '' || preg_match('#^(https?:|data:|\#)#i', $u)) return $m[0];
        $abs = web_abs_url($u, $baseUrl);
        return $abs === '' ? $m[0] : "url('" . $abs . "')";
    }, (string) $css);
}

/**
 * Limpia un HTML para el contexto del modelo: quita <script>/<noscript>/comentarios,
 * recorta data-URIs base64 gigantes, ABSOLUTIZA src/href/srcset/url(...) contra el
 * sitio original (asi el clon carga imagenes, fuentes y fondos reales) y extrae los
 * stylesheets externos (URLs absolutas).
 * @return array{html:string, stylesheets:array}
 */
function web_clean_html($html, $baseUrl) {
    // <base href> manda sobre la URL de la pagina para resolver rutas relativas.
    if (preg_match('#<base\b[^>]*href=["\']?([^"\'\s>]+)#i', $html, $mb)) {
        $baseAbs = web_abs_url(html_entity_decode($mb[1]), $baseUrl);
        if ($baseAbs !== '') $baseUrl = $baseAbs;
    }

    $sheets = [];
    if (preg_match_all('#<link\b[^>]*>#i', $html, $mLinks)) {
        foreach ($mLinks[0] as $tag) {
            if (!preg_match('#rel=["\']?[^"\'>]*stylesheet#i', $tag)) continue;
            if (!preg_match('#href=["\']?([^"\'\s>]+)#i', $tag, $mh)) continue;
            $abs = web_abs_url(html_entity_decode($mh[1]), $baseUrl);
            if ($abs !== '' && !in_array($abs, $sheets, true)) $sheets[] = $abs;
        }
    }
    $html = preg_replace('#<script\b[^>]*>.*?</script>#is', '', $html);
    $html = preg_replace('#<noscript\b[^>]*>.*?</noscript>#is', '', $html);
    $html = preg_replace('#<!--.*?-->#s', '', $html);
    // Imagenes embebidas en base64 no aportan al clon y comen contexto.
    $html = preg_replace('#(data:[^;"\'\s]+;base64,)[A-Za-z0-9+/=]{256,}#', '$1[...recortado...]', $html);

    // Rutas relativas -> absolutas del sitio original. Sin esto el clon "pierde"
    // todas las imagenes y el modelo tiende a inventar placeholders.
    $html = preg_replace_callback('#\b(src|href|poster|data-src)\s*=\s*(["\'])([^"\']*)\2#i', function ($m) use ($baseUrl) {
        $val = trim(html_entity_decode($m[3]));
        if ($val === '' || preg_match('#^(https?:|data:|\#|mailto:|tel:|javascript:)#i', $val)) return $m[0];
        $abs = web_abs_url($val, $baseUrl);
        return $abs === '' ? $m[0] : $m[1] . '=' . $m[2] . $abs . $m[2];
    }, $html);
    $html = preg_replace_callback('#\b(srcset|data-srcset)\s*=\s*(["\'])([^"\']*)\2#i', function ($m) use ($baseUrl) {
        $parts = [];
        foreach (explode(',', html_entity_decode($m[3])) as $item) {
            $item = trim($item);
            if ($item === '') continue;
            $bits = preg_split('#\s+#', $item, 2);
            if (!preg_match('#^(https?:|data:)#i', $bits[0])) {
                $abs = web_abs_url($bits[0], $baseUrl);
                if ($abs !== '') $bits[0] = $abs;
            }
            $parts[] = implode(' ', $bits);
        }
        return $m[1] . '=' . $m[2] . implode(', ', $parts) . $m[2];
    }, $html);
    // url(...) de los <style> embebidos y atributos style="background:url(...)".
    $html = web_abs_css_urls($html, $baseUrl);

    $html = preg_replace("#[ \t]+\n#", "\n", $html);
    $html = preg_replace("#\n{3,}#", "\n\n", $html);
    return ['html' => trim((string) $html), 'stylesheets' => $sheets];
}

/**
 * Descarga una URL y la deja lista para el modelo. Si es HTML se limpia y
 * (con $withCss) se bajan hasta 2 hojas CSS externas; otros tipos de texto se
 * devuelven tal cual truncados. Tipos binarios devuelven error.
 */
function web_fetch_url($url, $withCss = true) {
    $raw = web_fetch_raw($url);
    if (isset($raw['error'])) return ['url' => $url, 'error' => $raw['error']];

    $body  = (string) $raw['body'];
    $ctype = strtolower((string) $raw['content_type']);
    foreach (['image/', 'audio/', 'video/', 'font/', 'application/octet-stream', 'application/pdf', 'application/zip'] as $bin) {
        if (strpos($ctype, $bin) !== false) return ['url' => $url, 'error' => "contenido no textual ($ctype)"];
    }

    $out = [
        'url'          => $url,
        'final_url'    => $raw['final_url'],
        'status'       => $raw['status'],
        'content_type' => $raw['content_type'],
        'truncated'    => !empty($raw['truncated']),
        'stylesheets'  => [],
        'css'          => [],
    ];

    $isHtml = strpos($ctype, 'html') !== false || preg_match('#^\s*(<!doctype|<html)#i', $body);
    if ($isHtml) {
        $clean = web_clean_html($body, $raw['final_url']);
        $html  = $clean['html'];
        if (strlen($html) > WEB_FETCH_MAX_HTML) {
            $html = mb_strcut($html, 0, WEB_FETCH_MAX_HTML, 'UTF-8') . "\n<!-- [... HTML truncado ...] -->";
            $out['truncated'] = true;
        }
        $out['content']     = $html;
        $out['stylesheets'] = $clean['stylesheets'];
        if ($withCss) {
            foreach (array_slice($clean['stylesheets'], 0, WEB_FETCH_MAX_SHEETS) as $cssUrl) {
                $cssRaw = web_fetch_raw($cssUrl);
                if (isset($cssRaw['error'])) continue;
                // Fondos/fuentes del CSS resuelven contra la URL de LA HOJA, no de la pagina.
                $css = web_abs_css_urls((string) $cssRaw['body'], $cssUrl);
                $cut = strlen($css) > WEB_FETCH_MAX_CSS;
                if ($cut) $css = mb_strcut($css, 0, WEB_FETCH_MAX_CSS, 'UTF-8') . "\n/* [... CSS truncado ...] */";
                $out['css'][] = ['url' => $cssUrl, 'content' => $css, 'truncated' => $cut];
            }
        }
    } else {
        $txt = $body;
        if (strlen($txt) > WEB_FETCH_MAX_HTML) {
            $txt = mb_strcut($txt, 0, WEB_FETCH_MAX_HTML, 'UTF-8') . "\n[... truncado ...]";
            $out['truncated'] = true;
        }
        $out['content'] = $txt;
    }
    return $out;
}

/**
 * Descarga las URLs del mensaje y arma el bloque de contexto (fuente de verdad)
 * listo para concatenar al system prompt.
 * @return array{block:string, fetched:array, errors:array}
 */
function web_context_block(array $urls) {
    $block = '';
    $fetched = [];
    $errors = [];
    foreach ($urls as $u) {
        $r = web_fetch_url($u, true);
        if (isset($r['error']) || trim((string) (isset($r['content']) ? $r['content'] : '')) === '') {
            $errors[] = $u . ' (' . (isset($r['error']) ? $r['error'] : 'sin contenido') . ')';
            continue;
        }
        $fetched[] = $u;
        $block .= "--- INICIO PAGINA: {$u} (HTTP {$r['status']}) ---\n" . $r['content'] . "\n--- FIN PAGINA: {$u} ---\n\n";
        foreach ($r['css'] as $css) {
            $block .= "--- INICIO CSS DE LA PAGINA: {$css['url']} ---\n" . $css['content'] . "\n--- FIN CSS ---\n\n";
        }
        if (count($r['stylesheets']) > count($r['css'])) {
            $rest = array_slice($r['stylesheets'], count($r['css']));
            $block .= "(Hojas de estilo adicionales NO descargadas — pidelas con fetch_url si las necesitas: "
                    . implode(', ', $rest) . ")\n\n";
        }
    }
    if ($block === '' && empty($errors)) return ['block' => '', 'fetched' => [], 'errors' => []];

    $head = "=== PAGINA WEB CONSULTADA (FUENTE DE VERDAD) ===\n"
        . "Se descargo el contenido REAL de las URLs que menciona el usuario. Si pide clonar,\n"
        . "recrear o copiar la pagina, el objetivo es una COPIA FIEL, indistinguible del\n"
        . "original. Reglas obligatorias del clon:\n"
        . "1. Reproduce la pagina COMPLETA seccion por seccion y en el MISMO ORDEN (navbar,\n"
        . "   hero, cards, listados, footer...); no resumas, no omitas secciones 'por brevedad'\n"
        . "   ni reduzcas la cantidad de elementos repetidos (si hay 8 cards, van 8).\n"
        . "2. Copia los TEXTOS literales (titulos, parrafos, botones, menus, precios); no los\n"
        . "   parafrasees ni traduzcas, y no inventes contenido que no aparezca aqui.\n"
        . "3. Respeta los colores EXACTOS (toma los hex/rgb del CSS real), la tipografia\n"
        . "   (conserva los <link> de fuentes, p.ej. Google Fonts) y los tamanos/espaciados.\n"
        . "4. Las imagenes, logos y fondos ya vienen con URL ABSOLUTA del sitio original:\n"
        . "   usalas TAL CUAL en src/srcset/url(); NUNCA las sustituyas por placeholders.\n"
        . "5. No 'mejores', modernices ni re-tematices el diseno salvo que el usuario lo pida\n"
        . "   explicitamente.\n"
        . "El HTML viene SIN <script>; si la pagina se construye por JavaScript y el HTML llega\n"
        . "casi vacio, dilo honestamente y clona lo que si aparece.\n\n";
    if (!empty($errors)) {
        $head .= "URLs que NO se pudieron descargar (avisa al usuario): " . implode('; ', $errors) . "\n\n";
    }
    return ['block' => $head . rtrim($block), 'fetched' => $fetched, 'errors' => $errors];
}

/* ── Tool-calling: expone fetch_url al modelo ─────────────────────── */

/** Definicion de la herramienta (formato OpenAI) para los loops agenticos. */
function web_tool_spec() {
    return [
        'type' => 'function',
        'function' => [
            'name'        => 'fetch_url',
            'description' => 'Descarga una URL http(s) publica y devuelve su contenido de texto '
                           . '(HTML sin <script>, CSS, JSON...). Usala para consultar o clonar una '
                           . 'pagina web, o para bajar una hoja de estilos externa que necesites '
                           . 'para replicarla fielmente.',
            'parameters'  => [
                'type' => 'object',
                'properties' => [
                    'url' => ['type' => 'string', 'description' => 'URL completa http(s) a descargar.'],
                ],
                'required' => ['url'],
            ],
        ],
    ];
}

/** Ejecuta fetch_url y devuelve el resultado como STRING JSON (mensaje role=tool). */
function web_run_tool(array $args) {
    try {
        $url = isset($args['url']) ? trim((string) $args['url']) : '';
        if ($url === '') return json_encode(['error' => 'falta la url'], JSON_UNESCAPED_UNICODE);
        // Sin CSS automatico: el modelo pide cada hoja con otra llamada si la necesita.
        $res = web_fetch_url($url, false);
        return json_encode($res, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    } catch (Throwable $e) {
        return json_encode(['error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
    }
}

/** Etiqueta corta para el indicador "trabajando..." del UI. */
function web_tool_label(array $args) {
    return 'consultando ' . (isset($args['url']) && $args['url'] !== '' ? $args['url'] : 'una URL');
}
