# Guía paso a paso · Bot de WhatsApp con IA (CoffeeIA)

Documentación completa para instalar, configurar y operar el bot de WhatsApp que
vive en [`whatsapp/webhook.php`](whatsapp/webhook.php). El bot recibe mensajes de
WhatsApp, los responde con un LLM (Ollama Cloud / OpenRouter) usando el **alma de
CoffeeIA**, y contesta por la **Cloud API de Meta**.

> Documento de referencia del estado del proyecto. La sección final
> **"Hasta dónde llegamos"** resume qué quedó funcionando y qué falta.

---

## 1. Cómo funciona (arquitectura)

```
WhatsApp  --(webhook POST)-->  webhook.php  --(prompt)-->  LLM (Ollama / OpenRouter)
   ^                                                              |
   |------------(Graph API: enviar mensaje)<--- respuesta full ---|
```

- WhatsApp **no** hace streaming: el bot acumula toda la respuesta del modelo y la
  manda en un solo mensaje (la parte SSE/typewriter del prototipo `stream/` aquí
  no aplica).
- Reaprovecha la lógica LLM del prototipo `stream/` (cURL + `CURLOPT_WRITEFUNCTION`,
  soporte Ollama NDJSON / OpenRouter SSE).
- Carga la identidad de **CoffeeIA** desde `~/.claude/agents/CoffeeIA.md`, limpiando
  frontmatter e índice de steering, y le anexa un adaptador de canal para WhatsApp.

Un solo archivo resuelve dos rutas:
- **GET** → verificación del webhook (Meta envía `hub.challenge` una vez).
- **POST** → mensajes entrantes (Meta notifica cada mensaje del usuario).

---

## 2. Requisitos previos

| Requisito | Detalle |
|---|---|
| Servidor PHP | WAMP/Apache con PHP y cURL (este proyecto: `c:\wamp64`). |
| Key de LLM | `OLLAMA_API_KEY` (o `OPENROUTER_API_KEY`) en `coffee/app/credentials/.env`. |
| Cuenta Meta | App de tipo *Business* en <https://developers.facebook.com> con WhatsApp. |
| ngrok | Para exponer el WAMP local a internet con HTTPS (gratis, requiere cuenta). |
| Cuenta ngrok | Authtoken desde <https://dashboard.ngrok.com>. |

---

## 3. Instalación y configuración

### Paso 1 · Crear la app en Meta

1. <https://developers.facebook.com> → **Crear app** → tipo **Business**.
2. Agregar el producto **WhatsApp**.
3. Meta entrega gratis:
   - un **número de prueba** (ej. `+1 555 647 6610`),
   - un **Identificador de número de teléfono** (*Phone Number ID*),
   - un **token de acceso temporal** (24 h).

En este proyecto la app es **CoffeeBot**, con:

| Dato | Valor |
|---|---|
| Phone Number ID | `1144291168767775` |
| WhatsApp Business Account ID | `1025070633362656` |
| Número de prueba | `+1 555 647 6610` |
| Versión Graph API | `v25.0` |

### Paso 2 · Configurar `webhook.php`

Edita el `$CONFIG` de [`whatsapp/webhook.php`](whatsapp/webhook.php):

```php
'whatsapp' => [
    'verify_token'    => 'huubie-coffeebot-2026',   // tú lo inventas; va igual en Meta
    'access_token'    => '<TOKEN DE META>',          // del API Setup (caduca en 24 h)
    'phone_number_id' => '1144291168767775',
    'graph_version'   => 'v25.0',
],
'model' => '',   // '' => toma OLLAMA_DEFAULT_MODEL del .env; con "/" => OpenRouter
```

- Las **keys del LLM** se toman solas de `coffee/app/credentials/.env`
  (`OLLAMA_API_KEY`, `OLLAMA_DEFAULT_MODEL`, `OLLAMA_CA_BUNDLE`, etc.).
- El **alma de CoffeeIA** se carga de `soul_paths` (primero el agente de Claude
  Code, luego el alma del visor como respaldo):

```php
'soul_paths' => [
    'C:/Users/SomxDev/.claude/agents/CoffeeIA.md',  // alma completa
    __DIR__ . '/../../prompts/coffee-system.md',    // respaldo portable
],
```

> El `access_token` queda escrito en el archivo. **No lo subas a git** (ver §6).

### Paso 3 · Obtener el token de Meta

En el panel de Meta → **WhatsApp → Configuración de la API**:
1. Botón **"Generar token de acceso"** → copiar.
2. Pegarlo en `webhook.php` en `access_token`.

### Paso 4 · Autorizar tu número (número de prueba)

El número de prueba de Meta **solo** puede escribirle a números autorizados.
En **Configuración de la API → "Para" → Administrar lista de números**:
1. Agrega tu número (ej. `+52 962 114 9020`).
2. Meta envía un código por WhatsApp → confírmalo.

> Sin esto, el envío falla con `(#131030) Recipient phone number not in allowed list`.

### Paso 5 · Instalar y configurar ngrok

```powershell
winget install --id Ngrok.Ngrok -e        # instalar
ngrok update                               # IMPORTANTE: Meta exige agente >= 3.20
ngrok config add-authtoken <TU_AUTHTOKEN>  # de dashboard.ngrok.com
```

> El ngrok de winget viene viejo (3.3.1); sin `ngrok update` falla con
> `ERR_NGROK_121 agent version too old`.

### Paso 6 · Levantar el túnel

```powershell
ngrok http 80
```

Te da una URL pública, ej. `https://unengaged-guzzler-trustless.ngrok-free.dev`.
Tu webhook será esa URL + la ruta del archivo:

```
https://<sub>.ngrok-free.dev/huubie/coffee/app/visor/prototipo/whatsapp/webhook.php
```

> La URL **cambia cada vez que reinicias ngrok** (plan free). Hay que volver a
> registrarla en Meta cuando cambie.

### Paso 7 · Registrar el webhook en Meta

En **WhatsApp → Configuración** (Webhooks) → **Editar**:

| Campo | Valor |
|---|---|
| URL de devolución de llamada | la URL de ngrok + `/huubie/.../webhook.php` |
| Verificar token | `huubie-coffeebot-2026` |

Dale **"Verificar y guardar"** (Meta hace un GET y el bot responde el challenge).
Luego, en la lista de campos, **suscribe `messages`** (sin esto no llegan los
mensajes entrantes).

### Paso 8 · Probar

1. Escríbele al número de prueba (`+1 555 647 6610`) desde tu WhatsApp autorizado.
2. El bot responde con la voz de CoffeeIA.
3. Revisa [`whatsapp/webhook.log`](whatsapp/webhook.log) para ver entrada/salida/errores.

---

## 4. Referencia de configuración (`$CONFIG`)

| Clave | Para qué sirve |
|---|---|
| `timeout` | Segundos máx. de espera al LLM. |
| `ca_bundle` | Ruta a `cacert.pem` para SSL en Windows (se toma del `.env` si está). |
| `whatsapp.verify_token` | Token de verificación del webhook (lo inventas tú). |
| `whatsapp.access_token` | Token de la Graph API de Meta (caduca en 24 h). |
| `whatsapp.phone_number_id` | Identificador del número que envía. |
| `whatsapp.graph_version` | Versión de la Graph API (`v25.0`). |
| `model` | Modelo LLM. `''` usa `OLLAMA_DEFAULT_MODEL`. Con `/` → OpenRouter. |
| `soul_paths` | Rutas candidatas del alma; gana la primera que exista. |
| `whatsapp_adapter` | Texto que adapta la salida del alma a WhatsApp. |

---

## 5. Solución de problemas

| Síntoma (en `webhook.log` o Meta) | Causa / arreglo |
|---|---|
| `(#131030) Recipient phone number not in allowed list` | El número destino no está autorizado (§Paso 4), **o** el quirk de México: WhatsApp entrega como `521...` pero la lista tiene `52...`. El bot ya normaliza (`wa_normalize_to`) quitando el `1` extra de MX/AR. |
| `ERR_NGROK_121 ... agent version too old` | ngrok desactualizado → `ngrok update`. |
| La verificación del webhook falla en Meta | El `verify_token` no coincide, o el túnel/WAMP está caído. |
| Llegan mensajes pero no responde | Revisa `webhook.log`: si hay `ERROR wa_send` es envío; si hay `ERROR LLM` es el modelo; si no hay `OUT`, no llegó el POST (revisa suscripción a `messages`). |
| El texto del LLM no fluye / error SSL | En Windows configura `ca_bundle` a un `cacert.pem` válido. |
| El bot dice que "va a leer un archivo" | El adaptador ya se lo prohíbe; verifica que `whatsapp_adapter` esté presente. |

---

## 6. Seguridad

- **No subas `access_token` ni `webhook.log` a git.** Sugerencia de `.gitignore`
  en esta carpeta:
  ```
  whatsapp/webhook.log
  whatsapp/seen_*.lock
  ```
  y mantén el `access_token` fuera del control de versiones (idealmente en el
  `.env`).
- El token de prueba **caduca en 24 h**; para algo estable genera un token
  permanente de *System User* en Meta Business.

---

## 7. Hasta dónde llegamos (estado actual)

✅ **Funcionando de punta a punta:**

1. Webhook creado y servido por Apache: `localhost/huubie/.../webhook.php`.
2. Verificación GET probada (devuelve el `hub.challenge`). ✓
3. LLM (Ollama `qwen3-coder:480b-cloud`) responde correctamente. ✓
4. ngrok 3.39.6 instalado, authtoken configurado y túnel activo. ✓
5. Webhook registrado en Meta y suscrito a `messages`. ✓
6. Mensajes entrantes se reciben y se registran en `webhook.log`. ✓
7. Corregido el quirk de México (`521` → `52`) que daba `#131030`. ✓
8. Envío de respuesta aceptado por Meta (HTTP 200, sin error en el último envío). ✓
9. **Alma de CoffeeIA** cargada desde `~/.claude/agents/CoffeeIA.md` (limpiando
   frontmatter e índice) + adaptador de WhatsApp. ✓

🔧 **Pendiente / siguientes pasos:**

- Confirmar visualmente la **entrega** del mensaje en el teléfono (el API ya lo
  acepta; el `wamid` queda en el log con la línea `OK wa_send`).
- **Memoria de conversación** por número: hoy cada mensaje se procesa aislado, sin
  historial.
- **Token permanente** (System User) para no regenerar cada 24 h.
- **Dominio fijo** (hosting o ngrok de pago) para no reconfigurar la URL en Meta.
- Endurecer seguridad: mover `access_token` al `.env` y crear el `.gitignore`.

⚠️ **Recordatorios operativos:**

- Mantén **WAMP** y la terminal de **ngrok** abiertos mientras pruebas.
- La **URL de ngrok** y el **token de Meta** caducan/cambian; al reiniciar hay que
  actualizarlos (URL en Meta, token en `webhook.php`).
