# Prototipo portable · Streaming de IA (efecto tipo Claude)

Demo **autocontenida en un solo archivo** (`index.php`) del streaming de respuestas
de un LLM con el efecto *typewriter* palabra a palabra, como Claude/ChatGPT.
Pensado para **copiar y pegar en otro proyecto** PHP. Tema **light**.

## Qué demuestra

1. **Recibir** el stream del modelo con cURL sin esperar la respuesta completa
   (`CURLOPT_WRITEFUNCTION`).
2. **Reenviarlo** al navegador en vivo con **Server-Sent Events (SSE)** + `flush()`.
3. **Pintarlo** en el front **palabra a palabra** a ritmo constante (sensación Claude),
   desacoplando la recepción (bloques a saltos) del pintado (fluido).

## Proveedores

Soporta **dos** y elige automáticamente según el id del modelo:

| id del modelo | Proveedor | Formato del stream |
|---|---|---|
| sin `/` (ej. `minimax-m3:cloud`) | **Ollama Cloud** | NDJSON (`/api/chat`) |
| con `/` (ej. `openai/gpt-oss-120b:free`) | **OpenRouter** | SSE OpenAI (`/chat/completions`) |

## Uso

1. Abre `index.php` y pon tu(s) API key(s) en `$CONFIG`.
2. Sube la carpeta a tu servidor (Apache/WAMP/Nginx con PHP) y ábrela en el navegador.
3. Elige modelo (Ollama u OpenRouter), escribe un prompt y dale **Enviar**.

```php
$CONFIG = [
    'ca_bundle' => '',   // Windows/WAMP: ruta a cacert.pem si falla SSL
    'ollama' => [
        'api_key'  => 'PEGA_AQUI_TU_API_KEY_OLLAMA',
        'base_url' => 'https://ollama.com',
        'chat_path'=> '/api/chat',
        'format'   => 'ndjson',
    ],
    'openrouter' => [
        'api_key'  => 'PEGA_AQUI_TU_API_KEY_OPENROUTER',
        'base_url' => 'https://openrouter.ai/api/v1',
        'chat_path'=> '/chat/completions',
        'format'   => 'openai',
    ],
    'models'  => [ /* 'id' => ['etiqueta', 'grupo'] */ ],
    'default' => 'minimax-m3:cloud',
];
```

Solo necesitas configurar la key del proveedor que vayas a usar (puedes dejar la
otra en placeholder). Para añadir más modelos, agrégalos al array `models` con su
etiqueta y grupo; el proveedor se deduce solo del `/`.

> **Windows/WAMP:** si cURL falla con error SSL, descarga `cacert.pem` y apunta
> `ca_bundle` a su ruta. En Linux normalmente no hace falta.

## Calibrar la velocidad del typewriter

En el JS, dentro de `pump()`:

```js
const wps = 14 + Math.min(46, pending.length / 40);
```

El `14` es **palabras por segundo** base: súbelo para más ágil, bájalo (~10) para
más reposado. El segundo término acelera solo si se acumula texto pendiente, para
no rezagarse en respuestas largas.

## Notas

- **No** subas tu API key a un repositorio público: este archivo está pensado para
  copiarse, deja la key fuera del control de versiones.
- Requiere un navegador con `fetch` + `ReadableStream` (cualquier navegador moderno).
- Si el texto llega **todo de golpe** al final en vez de fluir, tu servidor está
  rebufferizando: revisa que no haya gzip/compression activo en ese endpoint
  (en Apache `no-gzip`, en Nginx `X-Accel-Buffering: no`, ambos ya incluidos).
```
