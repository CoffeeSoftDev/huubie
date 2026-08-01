# Agent Studio — Propuesta de template

Editor visual de agentes para CoffeeSoft (el equivalente al "Assistants" de OpenAI, sobre nuestra infraestructura). Los agentes ya viven como `.md` con frontmatter en `.claude/agents/`; esta pantalla los vuelve un catálogo editable por cualquiera del equipo: instrucciones, modelo por defecto, tools que se encienden solas y grimorios inyectados.

**Solo template estático** — sin lógica, para revisar el diseño. Datos de muestra reales (los 3 agentes del chat + frontmatter real de CoffeeIA.md).

```html
<style>
    :root {
        --bg:        #111928;
        --chrome:    #141d2b;
        --card:      #1F2A37;
        --hover:     #1a2332;
        --text:      #ffffff;
        --soft:      #E5E7EB;
        --mid:       #D1D5DB;
        --muted:     #9CA3AF;
        --mute2:     #6B7280;
        --border:    rgba(55,65,81,.6);
        --divider:   rgba(192,90,64,0.22);
        --accent:      #C05A40;
        --accent-soft: #E8A68F;
        --accent-tint: rgba(192,90,64,0.18);
        --ok: #34D399;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    .as-root {
        font-family: 'Inter', system-ui, sans-serif;
        background: var(--bg);
        color: var(--text);
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        font-size: 13px;
    }

    /* ── Header ── */
    .as-header {
        display: flex; align-items: center; gap: 12px;
        padding: 12px 18px;
        background: var(--chrome);
        border-bottom: 1px solid var(--border);
    }
    .as-title { font-size: 16px; font-weight: 800; letter-spacing: -.02em; }
    .as-title span { color: var(--accent); }
    .as-sub { font-size: 11px; color: var(--mute2); margin-left: 2px; }
    .as-header-right { margin-left: auto; display: flex; gap: 8px; }
    .as-btn {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 7px 14px; border-radius: 8px; cursor: pointer;
        font-size: 12px; font-weight: 600; border: 1px solid var(--border);
        background: transparent; color: var(--mid); font-family: inherit;
    }
    .as-btn:hover { background: var(--hover); color: var(--soft); }
    .as-btn-primary { background: var(--accent); border-color: var(--accent); color: #fff; }
    .as-btn-primary:hover { background: var(--accent-soft); color: #1F2A37; }
    .as-btn-danger { color: #F87171; border-color: rgba(248,113,113,.3); }

    /* ── Layout ── */
    .as-body { flex: 1; display: flex; min-height: 0; }

    /* ── Catálogo (izquierda) ── */
    .as-catalog {
        width: 270px; flex-shrink: 0;
        background: var(--chrome);
        border-right: 1px solid var(--border);
        display: flex; flex-direction: column;
        padding: 12px 10px;
        gap: 6px;
    }
    .as-catalog-head {
        display: flex; align-items: center; justify-content: space-between;
        padding: 0 6px 10px;
    }
    .as-catalog-head h3 {
        font-size: 10px; font-weight: 700; letter-spacing: .07em;
        text-transform: uppercase; color: var(--mute2);
    }
    .as-agent {
        display: flex; align-items: center; gap: 10px;
        padding: 10px 10px; border-radius: 10px; cursor: pointer;
        border: 1px solid transparent;
    }
    .as-agent:hover { background: var(--hover); }
    .as-agent.active { background: var(--accent-tint); border-color: var(--divider); }
    .as-agent-dot {
        width: 30px; height: 30px; border-radius: 9px; flex-shrink: 0;
        display: grid; place-items: center; font-size: 14px;
    }
    .as-agent-info { min-width: 0; flex: 1; }
    .as-agent-name { font-weight: 700; font-size: 12.5px; color: var(--soft); }
    .as-agent-desc {
        font-size: 10.5px; color: var(--mute2);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .as-agent-model {
        font-size: 9.5px; font-family: 'JetBrains Mono', monospace;
        color: var(--mute2); flex-shrink: 0;
        background: var(--card); border: 1px solid var(--border);
        padding: 2px 6px; border-radius: 5px;
    }
    .as-new {
        margin-top: 4px;
        display: flex; align-items: center; justify-content: center; gap: 6px;
        padding: 9px; border-radius: 10px; cursor: pointer;
        border: 1px dashed var(--border); color: var(--mute2);
        font-size: 12px; font-weight: 600; background: none; font-family: inherit;
    }
    .as-new:hover { border-color: var(--accent); color: var(--accent-soft); }

    /* ── Editor (derecha) ── */
    .as-editor { flex: 1; overflow-y: auto; padding: 22px 26px; }
    .as-editor-inner { max-width: 860px; margin: 0 auto; display: flex; flex-direction: column; gap: 18px; }

    .as-section {
        background: var(--card); border: 1px solid var(--border);
        border-radius: 12px; padding: 16px 18px;
    }
    .as-section h4 {
        font-size: 11px; font-weight: 700; letter-spacing: .05em;
        text-transform: uppercase; color: var(--muted); margin-bottom: 12px;
        display: flex; align-items: center; gap: 8px;
    }
    .as-section h4 .hint { text-transform: none; letter-spacing: 0; font-weight: 400; font-size: 10.5px; color: var(--mute2); }

    .as-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .as-field { display: flex; flex-direction: column; gap: 5px; }
    .as-field.full { grid-column: 1 / -1; }
    .as-label { font-size: 11px; font-weight: 600; color: var(--muted); }
    .as-input, .as-select, .as-textarea {
        background: var(--bg); border: 1px solid var(--border);
        border-radius: 8px; color: var(--soft);
        padding: 9px 11px; font-size: 12.5px; font-family: inherit; outline: none;
        width: 100%;
    }
    .as-input:focus, .as-textarea:focus { border-color: var(--accent); }
    .as-textarea { min-height: 170px; resize: vertical; font-family: 'JetBrains Mono', monospace; font-size: 11.5px; line-height: 1.6; }
    .as-help { font-size: 10.5px; color: var(--mute2); }

    /* Tools: toggles */
    .as-tools { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
    .as-tool {
        display: flex; align-items: center; gap: 10px;
        background: var(--bg); border: 1px solid var(--border);
        border-radius: 10px; padding: 11px 12px; cursor: pointer;
    }
    .as-tool.on { border-color: var(--divider); background: var(--accent-tint); }
    .as-tool-ico { font-size: 15px; }
    .as-tool-info { flex: 1; min-width: 0; }
    .as-tool-name { font-size: 12px; font-weight: 600; color: var(--soft); }
    .as-tool-desc { font-size: 10px; color: var(--mute2); }
    .as-switch {
        width: 30px; height: 17px; border-radius: 9999px; flex-shrink: 0;
        background: var(--border); position: relative;
    }
    .as-switch::after {
        content: ''; position: absolute; top: 2px; left: 2px;
        width: 13px; height: 13px; border-radius: 50%; background: var(--mute2);
    }
    .as-tool.on .as-switch { background: var(--accent); }
    .as-tool.on .as-switch::after { left: 15px; background: #fff; }

    /* Grimorios: chips */
    .as-chips { display: flex; flex-wrap: wrap; gap: 8px; }
    .as-chip {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 6px 11px; border-radius: 9999px;
        border: 1px solid var(--border); background: var(--bg);
        font-size: 11.5px; color: var(--mid);
    }
    .as-chip.on { border-color: var(--divider); background: var(--accent-tint); color: var(--accent-soft); }
    .as-chip .x { color: var(--mute2); font-size: 12px; }

    /* Meta pie */
    .as-meta {
        display: flex; align-items: center; gap: 14px;
        font-size: 10.5px; color: var(--mute2);
        font-family: 'JetBrains Mono', monospace;
    }
    .as-meta .ok { color: var(--ok); }
    .as-footer {
        display: flex; align-items: center; justify-content: space-between; gap: 10px;
    }
    .as-footer-actions { display: flex; gap: 8px; }

    @media (max-width: 760px) {
        .as-catalog { display: none; }
        .as-grid, .as-tools { grid-template-columns: 1fr; }
    }
</style>

<div class="as-root">

    <header class="as-header">
        <div>
            <div class="as-title">Agent <span>Studio</span></div>
            <div class="as-sub">Catálogo de agentes CoffeeSoft — .claude/agents</div>
        </div>
        <div class="as-header-right">
            <button class="as-btn">↺ Historial de versiones</button>
            <button class="as-btn as-btn-primary">💾 Guardar agente</button>
        </div>
    </header>

    <div class="as-body">

        <!-- ══ Catálogo ══ -->
        <aside class="as-catalog">
            <div class="as-catalog-head">
                <h3>Agentes · 4</h3>
            </div>

            <div class="as-agent active">
                <div class="as-agent-dot" style="background:rgba(236,72,153,.18);">☕</div>
                <div class="as-agent-info">
                    <div class="as-agent-name">CoffeeIA</div>
                    <div class="as-agent-desc">Genera módulos MVC del framework</div>
                </div>
                <span class="as-agent-model">sonnet</span>
            </div>

            <div class="as-agent">
                <div class="as-agent-dot" style="background:rgba(139,92,246,.18);">🪄</div>
                <div class="as-agent-info">
                    <div class="as-agent-name">CoffeeMagic</div>
                    <div class="as-agent-desc">Templates HTML del sistema de diseño</div>
                </div>
                <span class="as-agent-model">glm-5.2</span>
            </div>

            <div class="as-agent">
                <div class="as-agent-dot" style="background:rgba(59,130,246,.18);">🛢</div>
                <div class="as-agent-info">
                    <div class="as-agent-name">CoffeeIntelligence</div>
                    <div class="as-agent-desc">Analiza templates y propone BD</div>
                </div>
                <span class="as-agent-model">qwen3</span>
            </div>

            <div class="as-agent">
                <div class="as-agent-dot" style="background:rgba(52,211,153,.15);">🏹</div>
                <div class="as-agent-info">
                    <div class="as-agent-name">CoffeeArcher</div>
                    <div class="as-agent-desc">QA: valida módulos del ERP-GV</div>
                </div>
                <span class="as-agent-model">default</span>
            </div>

            <button class="as-new">＋ Nuevo agente</button>
        </aside>

        <!-- ══ Editor ══ -->
        <main class="as-editor">
            <div class="as-editor-inner">

                <section class="as-section">
                    <h4>Identidad <span class="hint">— frontmatter del .md</span></h4>
                    <div class="as-grid">
                        <div class="as-field">
                            <label class="as-label">Nombre</label>
                            <input class="as-input" value="CoffeeIA">
                        </div>
                        <div class="as-field">
                            <label class="as-label">Alias (separados por coma)</label>
                            <input class="as-input" value="coffee, coffeeia">
                        </div>
                        <div class="as-field full">
                            <label class="as-label">Descripción</label>
                            <input class="as-input" value="Asistente oficial del framework CoffeeSoft. Genera módulos MVC (ctrl PHP, mdl PHP, JS frontend) siguiendo arquitectura con pivotes inmutables.">
                            <span class="as-help">Se muestra en el catálogo y le dice al enrutador cuándo usar este agente.</span>
                        </div>
                    </div>
                </section>

                <section class="as-section">
                    <h4>Instrucciones del sistema <span class="hint">— el cuerpo del .md (890 líneas)</span></h4>
                    <div class="as-field">
                        <textarea class="as-textarea"># Prompt Estructurado para Generar Código con CoffeeSoft (PRINCIPIO R.O.S.Y)

> **R.O.S.Y** (acrónimo en inglés): **R**ol · **O**bjective · **S**equence · **Y**ield.

## Rol
Eres CoffeeIA, el asistente oficial del framework CoffeeSoft…

## Convenciones
- Nomenclatura ls/get en controladores
- Patrón pivote inmutable en modelos
- createTable / createForm / createModalForm para la UI
…</textarea>
                        <span class="as-help">Markdown. Se inyecta como systemOverride al conversar con este agente.</span>
                    </div>
                </section>

                <section class="as-section">
                    <h4>Modelo y herramientas <span class="hint">— se aplican solos al elegir el agente en el chat</span></h4>
                    <div class="as-grid" style="margin-bottom:14px;">
                        <div class="as-field">
                            <label class="as-label">Modelo por defecto</label>
                            <select class="as-select">
                                <option>Qwen3 Coder 480B (código · módulos ⭐)</option>
                                <option selected>GLM 5.2 (código)</option>
                                <option>Kimi K2.7 Code (código · vision)</option>
                                <option>— Default del proveedor —</option>
                            </select>
                        </div>
                        <div class="as-field">
                            <label class="as-label">Modo de render</label>
                            <select class="as-select">
                                <option selected>Código (módulos al sandbox)</option>
                                <option>HTML (componentes al lienzo)</option>
                                <option>Markdown (documento)</option>
                            </select>
                        </div>
                    </div>
                    <div class="as-tools">
                        <div class="as-tool on">
                            <span class="as-tool-ico">🛢</span>
                            <div class="as-tool-info">
                                <div class="as-tool-name">Base de datos</div>
                                <div class="as-tool-desc">run_select (solo lectura)</div>
                            </div>
                            <span class="as-switch"></span>
                        </div>
                        <div class="as-tool on">
                            <span class="as-tool-ico">📁</span>
                            <div class="as-tool-info">
                                <div class="as-tool-name">Archivos</div>
                                <div class="as-tool-desc">list_dir · read_file · grep</div>
                            </div>
                            <span class="as-switch"></span>
                        </div>
                        <div class="as-tool">
                            <span class="as-tool-ico">🎨</span>
                            <div class="as-tool-info">
                                <div class="as-tool-name">Modo lienzo</div>
                                <div class="as-tool-desc">HTML renderizable</div>
                            </div>
                            <span class="as-switch"></span>
                        </div>
                    </div>
                </section>

                <section class="as-section">
                    <h4>Grimorios en contexto <span class="hint">— conocimiento que viaja siempre con el agente</span></h4>
                    <div class="as-chips">
                        <span class="as-chip on">📖 MDL.md <span class="x">✕</span></span>
                        <span class="as-chip on">📖 CTRL.md <span class="x">✕</span></span>
                        <span class="as-chip on">📖 grimorio-coffee-varoch.md <span class="x">✕</span></span>
                        <span class="as-chip">＋ Añadir grimorio</span>
                    </div>
                </section>

                <section class="as-section as-footer">
                    <div class="as-meta">
                        <span>CoffeeIA.md · 44 KB</span>
                        <span>editado 2026-07-13 16:09</span>
                        <span class="ok">✓ versionado (git)</span>
                    </div>
                    <div class="as-footer-actions">
                        <button class="as-btn">⧉ Clonar</button>
                        <button class="as-btn">⬇ Exportar .md</button>
                        <button class="as-btn as-btn-danger">🗑 Eliminar</button>
                    </div>
                </section>

            </div>
        </main>
    </div>
</div>
```

---

## Notas de la propuesta

- **No inventa infraestructura**: edita los mismos `.md` de `.claude/agents/` que ya usan CoffeeIA chat y Claude Code. El backend de guardar/borrar ya existe (`ctrl-documents-admin.php`); la resolución de la carpeta también (`path-helper.php`).
- **El frontmatter manda**: `model`, `tools`, `grimoires` y `render` viven en el YAML del `.md`. Al elegir el agente en el chat, coffeeia.js los aplica solos (hoy los ignora).
- **Versionado**: el pie muestra el estado git del archivo — la excusa para dejar de hacer respaldos a mano (`CoffeeIA.backup-*.md`).
- **Fuera de alcance a propósito**: code interpreter (riesgo de seguridad en WAMP) y vector stores (a nuestra escala, grimorios + grep rinden igual).
