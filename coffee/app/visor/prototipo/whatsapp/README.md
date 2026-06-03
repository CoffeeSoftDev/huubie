# Prototipo · Bot de WhatsApp (Cloud API de Meta) + LLM

Mismo nucleo que [`../stream/`](../stream/) pero, en vez de SSE/typewriter en el
navegador, **conversa por WhatsApp**. Reutiliza la logica de hablar con el LLM
(Ollama Cloud u OpenRouter), pero acumula toda la respuesta y la manda en un
mensaje (WhatsApp no hace streaming).

```
WhatsApp --(webhook POST)--> webhook.php --(prompt)--> LLM (Ollama/OpenRouter)
    ^                                                         |
    |---------(Graph API: enviar mensaje)<--- respuesta full -|
```

## 1. Cuenta en Meta (una vez)

1. Entra en <https://developers.facebook.com/> → **My Apps** → **Create App** →
   tipo **Business**.
2. Anade el producto **WhatsApp**. Meta te da gratis un **numero de pruebas** y un
   **Phone Number ID**, mas un **token de acceso temporal (24 h)**.
3. Anota: `Phone Number ID` y `Temporary access token` (luego puedes generar uno
   permanente con un *System User*).

## 2. Configurar `webhook.php`

Edita el `$CONFIG` de [`webhook.php`](webhook.php):

```php
'whatsapp' => [
    'verify_token'    => 'algo-que-tu-inventes',   // mismo valor que pondras en Meta
    'access_token'    => '<TOKEN DE META>',
    'phone_number_id' => '<PHONE NUMBER ID>',
    'graph_version'   => 'v21.0',
],
'model' => 'minimax-m3:cloud',   // con "/" => OpenRouter; sin "/" => Ollama
```

Las keys del LLM (Ollama/OpenRouter) se toman solas del `.env` del visor
(`coffee/app/visor/credentials/.env`) si ya estan ahi; si no, pegalas en `$CONFIG`.

> **Windows/WAMP:** si cURL da error SSL, apunta `ca_bundle` a `cacert.pem`.

## 3. Exponer tu WAMP a internet (ngrok)

Meta necesita una URL **publica HTTPS**. En local:

```powershell
ngrok http 80
```

Te da algo como `https://abc123.ngrok-free.app`. Tu webhook sera:

```
https://abc123.ngrok-free.app/huubie/coffee/app/visor/prototipo/whatsapp/webhook.php
```

(Ajusta la ruta segun donde sirva tu Apache la carpeta `www`.)

## 4. Registrar el webhook en Meta

En el panel de la app → **WhatsApp → Configuration → Webhook → Edit**:

- **Callback URL**: la URL de arriba.
- **Verify token**: el MISMO `verify_token` que pusiste en `$CONFIG`.
- Guarda. Meta hace un **GET** y `webhook.php` devuelve el `hub.challenge` → si el
  token coincide, queda verificado (✓).
- En **Webhook fields**, suscribe **`messages`**.

## 5. Probar

1. En el panel, agrega tu numero personal como **destinatario de pruebas**
   (el numero de pruebas de Meta solo habla con numeros que autorices).
2. Escribe al numero de pruebas desde tu WhatsApp.
3. `webhook.php` recibe el mensaje, consulta al LLM y responde.
4. Revisa `webhook.log` (se crea junto al script) para ver entradas/salidas/errores.

## Notas y limites

- **Ventana de 24 h:** fuera de una conversacion iniciada por el usuario, Meta solo
  permite enviar *plantillas* aprobadas. Para responder a quien te escribe (este
  caso) no hace falta plantilla.
- **Responder rapido el 200:** Meta reintenta si tardas, lo que duplicaria
  respuestas. El script cierra la conexion (con `Connection: close` o
  `fastcgi_finish_request`) antes de llamar al LLM, y deduplica por `message id`.
- **Token temporal de 24 h:** caduca; para algo estable genera un token permanente
  de *System User* en Meta Business.
- **No subas tokens al repo.** Considera mover `access_token` al `.env` del visor.
- **ngrok-free cambia de URL** en cada reinicio: tendras que reconfigurar el webhook
  en Meta. Para algo fijo, usa un dominio/hosting real.
