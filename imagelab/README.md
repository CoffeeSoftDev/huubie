# ImageLab

Harness propio de generacion y edicion de imagenes, calcado del que le sacamos a
**TapEdit** mirando su pestana Network. Proyecto independiente: no depende del visor
ni de Huubie, y la carpeta se puede mover tal cual.

```
http://localhost/huubie/imagelab/
```

La gracia no es llamar a una API de imagenes — eso es una linea de cURL. La gracia es
el andamiaje: subida separada del trabajo, id opaco, polling, **motor intercambiable**
y un CDN propio que borra el rastro del proveedor.

---

## Las tres vias para tener motor

| Via | Que cuesta | Para que sirve |
|---|---|---|
| **Servidor local** (ComfyUI / A1111) | luz | sin limite, sin mandar nada a terceros |
| **GPU rentada por horas** | ~$0.20 – $0.70 USD/h | lo mismo, pero rapido, sin comprar tarjeta |
| **API por imagen** (fal, Venice, Replicate) | ~$0.003 – $0.055 por imagen | cero mantenimiento, la mejor calidad |
| **Pollinations** | nada, sin cuenta | probar el pipeline hoy; solo genera |

Lo importante: **las tres se configuran igual**, cambiando una linea del `.env`. El
front nunca se entera.

---

## Servidor local: lo que tu maquina puede y lo que no

Medido en esta PC:

| | |
|---|---|
| GPU | **NVIDIA GeForce GT 710 · 2 GB** |
| CPU | AMD Ryzen 5 3600 · 6 nucleos |
| RAM | 24 GB |

**La GT 710 no sirve para esto, y conviene saberlo antes de instalar nada.** Son 2 GB
de VRAM y una arquitectura Kepler de 2014: las versiones actuales de PyTorch ya no
traen soporte para ese chip, asi que ni siquiera podria usar CUDA. FLUX Kontext o
Qwen-Image-Edit —los motores que sospechamos debajo de TapEdit— piden del orden de
8-12 GB de VRAM. No es cuestion de esperar mas: no arrancan.

**Lo que si corre aqui es CPU**, y ahi el Ryzen 5 con 24 GB de RAM se defiende:

| Modelo en CPU | Tiempo aproximado por imagen |
|---|---|
| SDXL-Turbo · 512 px · 1-4 pasos | ~30-60 s |
| SD 1.5 · 512 px · 20 pasos | ~2-4 min |
| FLUX schnell cuantizado · 1 MP | ~15-40 min |

Traducido: **para iconos y placeholders de 512 px, local es viable**. Para edicion
instruccional —lo que hace TapEdit de verdad— no lo es en esta maquina.

### Montar ComfyUI

Es el que recomiendo de los dos: su API es asincrona igual que el harness (mandas el
trabajo, preguntas por el id), asi que la pagina no se queda colgada esperando.

1. Baja ComfyUI e instalalo (portable de Windows o `git clone` + `pip install -r requirements.txt`).
2. Arrancalo forzando CPU: `python main.py --cpu --listen 127.0.0.1 --port 8188`
3. Pon un checkpoint en `ComfyUI/models/checkpoints/`. Para CPU: **SDXL-Turbo** o **SD 1.5**.
4. En el `.env` de aqui:

```ini
IL_LOCAL_BASE_URL="http://127.0.0.1:8188"
IL_LOCAL_KIND="comfyui"
IL_LOCAL_CHECKPOINT=""     ; vacio = usa el primero que encuentre
IL_LOCAL_STEPS=4           ; con SDXL-Turbo bastan 1-4 pasos
IL_LOCAL_CFG=1.5
```

Recarga la pagina: el chip `local:` se pone verde y las operaciones `v1` y `e1` pasan
a salir por tu maquina. Si el servidor esta apagado, el harness lo detecta y cae al
siguiente motor de la lista sin que tengas que tocar nada.

Los workflows viven en `ctrl/workflows/*.json` y son **formato API de ComfyUI**: puedes
armar el tuyo en la interfaz, exportarlo con *Save (API format)* y pegarlo ahi. Solo
conserva los marcadores `__PROMPT__`, `__WIDTH__`, `__SEED__`, `__CHECKPOINT__`,
`__IMAGE__`, `__DENOISE__` donde correspondan.

### Automatic1111 / Forge

Tambien sirve (`IL_LOCAL_KIND="a1111"`, puerto 7860, arrancado con `--use-cpu all`),
pero su API es **sincrona**: la peticion `run` se queda esperando a que termine la
imagen. Con tiempos de CPU eso significa un `run` de varios minutos. Preferible ComfyUI.

### GPU rentada: el mismo codigo, otra URL

Si algun dia quieres el motor bueno sin comprar tarjeta, en RunPod o vast.ai alquilas
una GPU con ComfyUI ya instalado por horas. Levantas la instancia, reenvias el puerto
8188, y aqui **solo cambias `IL_LOCAL_BASE_URL`**. El driver es el mismo. Pagas mientras
corre y la apagas al terminar; una RTX 4090 anda por el rango de $0.30-0.70 la hora.

Cuidado con la licencia si el trabajo es para un cliente: **FLUX.1-Kontext-dev es no
comercial**; **Qwen-Image-Edit es Apache 2.0**, o sea que corriendolo tu no le debes
nada a nadie. Para Huubie o Grupo Varoch, esa diferencia es la que decide.

---

## API por imagen

Para editar de verdad —"quita esto", "haz que se vea mas iluminado"— hoy no hay atajo
local en esta maquina. Va por API:

```ini
FAL_API_KEY="…"              ; https://fal.ai/dashboard/keys
VENICE_API_KEY="…"           ; https://venice.ai/settings/api
REPLICATE_API_TOKEN="…"      ; https://replicate.com/account/api-tokens
```

**Elige fal o Venice.** Los tres corren los mismos modelos; lo que cambia es como
cobran. fal cobra por imagen (~$0.03-0.04 en Kontext), Venice tambien por imagen
(~$0.03 generando con `qwen-image`, ~$0.04 editando con `firered-image-edit`) y
Replicate por **segundo de GPU**, que para la misma imagen sale ~$0.055. Que TapEdit
corra sobre Replicate no es una recomendacion, es su decision.

### Venice

Vale la pena aparte por tres razones: **una sola key cubre generar y editar**, no
guarda historial de lo que le mandas, y su API es sincrona — la imagen vuelve en
binario en la misma respuesta, sin cola ni polling. El driver lo absorbe igual que
al A1111: `submit()` ya trae la imagen y el harness la publica de inmediato, asi que
el front no nota la diferencia.

Dos limites suyos que el driver tapa solo:

- **1280 px por lado como maximo.** `il_dimensions()` puede pedir mas en `2K`; el
  driver reduce en proporcion y vuelve a la rejilla de 64.
- **`safe_mode` viene encendido de fabrica** y desenfoca lo que considere adulto. Se
  apaga con `IL_VENICE_SAFE_MODE=0`.

Modelos por defecto en `il_aliases()` — cambialos ahi si prefieres otros, la lista
viva sale de `GET /models?type=image`:

| Alias | Modelo | Aprox. |
|---|---|---|
| `v1` Rapido | `qwen-image` | $0.03 |
| `v2` Calidad | `flux-2-max` | $0.09 |
| `e1` Editar | `firered-image-edit` | $0.04 |
| `e2` Editar pro | `gpt-image-2-edit` | por tier de calidad, el mas caro |

---

## Anatomia del pipeline

| TapEdit | Aqui | Para que sirve |
|---|---|---|
| `POST /api/presign` | `?action=presign` | permiso de subida de un solo uso, con caducidad |
| upload al bucket | `?action=upload` | el archivo entra al servidor y se valida |
| `POST .../run` con `{m,q,res,ar,fmt,p,i}` | `?action=run`, **mismo payload** | dispara el trabajo, devuelve un id |
| `predictionId` cifrado con AES | `jobId` opaco + tabla SQLite | que el cliente no pueda hablarle al proveedor |
| `GET /api/status?id=…` | `?action=status&id=…` | polling hasta `succeeded` |
| `cdn.tapedit.ai/…` | `uploads/out/…` | el resultado se sirve desde tu dominio |
| `m: "v2"` — alias sin nombre | `il_aliases()` en `ctrl/config.php` | cambiar de motor sin tocar el front |
| re-encode con sharp | `il_publish()` con GD | borra EXIF, iTXt y firmas del generador |

El payload de `run` es el suyo, campo por campo:

```json
{ "m": "v1", "q": "standard", "res": "1K", "ar": "1:1",
  "fmt": "jpg", "p": "una taza de cafe azul, icono plano", "i": "" }
```

`res` + `ar` se convierten en ancho y alto **multiplos de 64** (`il_dimensions()`). No
es estetica: los modelos de difusion latente comprimen la imagen 8 veces y solo
trabajan en esa rejilla. Fue justo lo que delato a TapEdit — su salida de 768x1024
descartaba a nano banana, que en 3:4 entrega 864x1184.

### Decisiones que no son obvias

**Upload separado de run.** Subir 4 MB y generar tienen tiempos y limites distintos. Con
el archivo ya en el servidor, `run` viaja como un JSON de 200 bytes y se puede
reintentar sin volver a subir la foto.

**La foto viaja distinto segun el motor.** Al local se le pasa la ruta del archivo (lo
sube a ComfyUI con su propio endpoint). A fal y Replicate se les manda un **data URI**,
porque ellos tienen que descargarla y a `http://localhost` no llegan.

**La salida se re-codifica siempre.** Al pasar por GD se pierden EXIF, iTXt y cualquier
firma. Sin ese paso, un archivo de Pollinations llega con `Make: sana` y el prompt
completo dentro — asi averiguamos su motor. Ademas `il_strip_jpeg_comment()` borra el
`CREATOR: gd-jpeg` que GD escribe solo, que contaria que detras hay PHP.

**El id es opaco.** El `jobId` no sirve fuera de aqui: la tabla guarda el `external_id`
real y amarra cada trabajo a su dueno.

**`i` se valida contra `il_path_from_url()`.** Solo se aceptan rutas dentro de
`uploads/`. Sin eso, `run` seria un SSRF.

---

## Archivos

| Archivo | Que hace |
|---|---|
| `index.php` | la pagina |
| `src/js/app.js` | cliente del pipeline + panel de traza |
| `src/css/app.css` | estilos, sin dependencias |
| `ctrl/api.php` | los cinco endpoints |
| `ctrl/config.php` | .env, tabla de alias, dimensiones, guardia de origen |
| `ctrl/drivers.php` | local, pollinations, fal, venice y replicate tras una interfaz comun |
| `ctrl/jobs.php` | tabla `jobs` en `data/jobs.sqlite` |
| `ctrl/workflows/*.json` | workflows de ComfyUI en formato API |

`uploads/`, `data/` y `.env` no se versionan.

## Probar por consola

El dueno de cada trabajo es la sesion de PHP, asi que `run` y `status` tienen que
compartir cookie: sin `-c/-b`, cURL abre sesion nueva y `status` responde
*Trabajo no encontrado*.

```bash
B="http://localhost/huubie/imagelab/ctrl/api.php"
J="/tmp/il.cookie"
curl -s "$B?action=catalog"

RUN=$(curl -s -c "$J" -b "$J" -H "Content-Type: application/json" \
  -d '{"m":"v1","res":"512","ar":"1:1","fmt":"jpg","p":"a blue coffee cup icon"}' "$B?action=run")
ID=$(echo "$RUN" | tr ',' '\n' | grep jobId | cut -d'"' -f4)
curl -s -c "$J" -b "$J" "$B?action=status&id=$ID"
```
