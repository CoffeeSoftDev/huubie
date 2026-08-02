# Agent Arena — Propuesta de template (pestaña de pruebas)

Pantalla **independiente** del Agent Studio (otro item del rail, junto a CoffeeIA): el banco de pruebas de agentes. Corre los casos dorados de cada agente, valida su salida contra las **47 reglas de TESTING.md** (mecánicas, sin LLM) + lint + BD real, compara modelos, y cuando algo falla **propone un diff al `.md` del agente que tú apruebas** — el loop de mejora semiautomático.

**Solo template estático** — sin lógica. Datos de muestra realistas (reglas CTRL/MDL/JS/IDX reales, modelos del catálogo).

```html
<style>
    :root {
        --bg: #111928; --chrome: #141d2b; --card: #1F2A37; --hover: #1a2332;
        --text: #fff; --soft: #E5E7EB; --mid: #D1D5DB; --muted: #9CA3AF; --mute2: #6B7280;
        --border: rgba(55,65,81,.6); --divider: rgba(192,90,64,0.22);
        --accent: #C05A40; --accent-soft: #E8A68F; --accent-tint: rgba(192,90,64,0.18);
        --ok: #34D399; --ok-tint: rgba(52,211,153,.12);
        --err: #F87171; --err-tint: rgba(248,113,113,.12);
        --warn: #FBBF24; --warn-tint: rgba(251,191,36,.1);
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    .ar-root {
        font-family: 'Inter', system-ui, sans-serif;
        background: var(--bg); color: var(--text);
        min-height: 100vh; display: flex; flex-direction: column; font-size: 13px;
    }
    .mono { font-family: 'JetBrains Mono', monospace; }

    /* ── Header ── */
    .ar-header {
        display: flex; align-items: center; gap: 14px;
        padding: 12px 18px; background: var(--chrome); border-bottom: 1px solid var(--border);
    }
    .ar-title { font-size: 16px; font-weight: 800; letter-spacing: -.02em; }
    .ar-title span { color: var(--accent); }
    .ar-sub { font-size: 11px; color: var(--mute2); }
    .ar-agent-pick {
        display: flex; align-items: center; gap: 7px;
        background: var(--card); border: 1px solid var(--border);
        border-radius: 8px; padding: 6px 12px; font-size: 12px; font-weight: 600; color: var(--soft);
    }
    .ar-header-right { margin-left: auto; display: flex; gap: 8px; align-items: center; }
    .ar-btn {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 7px 14px; border-radius: 8px; cursor: pointer;
        font-size: 12px; font-weight: 600; border: 1px solid var(--border);
        background: transparent; color: var(--mid); font-family: inherit;
    }
    .ar-btn:hover { background: var(--hover); }
    .ar-btn-primary { background: var(--accent); border-color: var(--accent); color: #fff; }
    .ar-score-pill {
        font-size: 12px; font-weight: 800; padding: 6px 12px; border-radius: 9999px;
        background: var(--ok-tint); color: var(--ok); border: 1px solid rgba(52,211,153,.3);
    }

    .ar-body { flex: 1; display: flex; min-height: 0; }

    /* ── Casos (izquierda) ── */
    .ar-cases {
        width: 285px; flex-shrink: 0; background: var(--chrome);
        border-right: 1px solid var(--border); padding: 12px 10px;
        display: flex; flex-direction: column; gap: 5px;
    }
    .ar-cases h3 {
        font-size: 10px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase;
        color: var(--mute2); padding: 0 6px 8px;
    }
    .ar-case {
        display: flex; align-items: center; gap: 9px;
        padding: 9px 10px; border-radius: 9px; cursor: pointer; border: 1px solid transparent;
    }
    .ar-case:hover { background: var(--hover); }
    .ar-case.active { background: var(--accent-tint); border-color: var(--divider); }
    .ar-case-status { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .st-ok { background: var(--ok); } .st-err { background: var(--err); }
    .st-warn { background: var(--warn); } .st-none { background: var(--mute2); opacity: .4; }
    .ar-case-info { flex: 1; min-width: 0; }
    .ar-case-name { font-size: 12px; font-weight: 600; color: var(--soft); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ar-case-meta { font-size: 10px; color: var(--mute2); }
    .ar-case-score { font-size: 10.5px; font-weight: 700; flex-shrink: 0; }
    .sc-ok { color: var(--ok); } .sc-err { color: var(--err); } .sc-none { color: var(--mute2); }
    .ar-new-case {
        margin-top: 4px; display: flex; align-items: center; justify-content: center; gap: 6px;
        padding: 8px; border-radius: 9px; cursor: pointer; border: 1px dashed var(--border);
        color: var(--mute2); font-size: 11.5px; font-weight: 600; background: none; font-family: inherit;
    }
    .ar-new-case:hover { border-color: var(--accent); color: var(--accent-soft); }

    /* Matriz agente × modelo (pie del panel izquierdo) */
    .ar-matrix { margin-top: auto; padding: 10px 6px 2px; border-top: 1px solid var(--border); }
    .ar-matrix h3 { padding-bottom: 6px; }
    .ar-matrix table { width: 100%; border-collapse: collapse; font-size: 10px; }
    .ar-matrix th { text-align: left; color: var(--mute2); font-weight: 600; padding: 3px 4px; }
    .ar-matrix td { padding: 3px 4px; font-weight: 700; }
    .ar-matrix .best { color: var(--ok); }
    .ar-matrix .mid2 { color: var(--warn); }
    .ar-matrix .low { color: var(--err); }

    /* ── Detalle (derecha) ── */
    .ar-detail { flex: 1; overflow-y: auto; padding: 20px 24px; }
    .ar-detail-inner { max-width: 900px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }

    .ar-sec { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 15px 17px; }
    .ar-sec h4 {
        font-size: 11px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase;
        color: var(--muted); margin-bottom: 11px; display: flex; align-items: center; gap: 8px;
    }
    .ar-sec h4 .hint { text-transform: none; letter-spacing: 0; font-weight: 400; font-size: 10.5px; color: var(--mute2); }
    .ar-sec h4 .right { margin-left: auto; }

    .ar-prompt {
        background: var(--bg); border: 1px solid var(--border); border-radius: 9px;
        padding: 11px 13px; font-size: 12px; color: var(--mid); line-height: 1.55;
    }
    .ar-ctx { display: flex; gap: 7px; margin-top: 9px; }
    .ar-ctx-chip {
        display: inline-flex; align-items: center; gap: 5px;
        font-size: 10.5px; padding: 4px 10px; border-radius: 9999px;
        background: var(--accent-tint); color: var(--accent-soft); border: 1px solid var(--divider);
    }

    /* Fases del run */
    .ar-phases { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
    .ar-phase {
        background: var(--bg); border: 1px solid var(--border); border-radius: 9px;
        padding: 9px 10px; text-align: center;
    }
    .ar-phase .n { font-size: 16px; font-weight: 800; }
    .ar-phase .l { font-size: 9.5px; color: var(--mute2); margin-top: 1px; }
    .ph-ok .n { color: var(--ok); } .ph-err .n { color: var(--err); } .ph-warn .n { color: var(--warn); }

    /* Tabla de reglas */
    .ar-rules { width: 100%; border-collapse: collapse; font-size: 11.5px; }
    .ar-rules th {
        text-align: left; font-size: 9.5px; text-transform: uppercase; letter-spacing: .05em;
        color: var(--mute2); padding: 6px 8px; border-bottom: 1px solid var(--border);
    }
    .ar-rules td { padding: 7px 8px; border-bottom: 1px solid rgba(55,65,81,.3); color: var(--mid); }
    .ar-rules tr:last-child td { border-bottom: none; }
    .ar-badge {
        display: inline-flex; align-items: center; gap: 4px;
        font-size: 9.5px; font-weight: 700; padding: 2px 8px; border-radius: 9999px;
    }
    .b-pass { background: var(--ok-tint); color: var(--ok); }
    .b-err  { background: var(--err-tint); color: var(--err); }
    .b-warn { background: var(--warn-tint); color: var(--warn); }
    .b-skip { background: var(--hover); color: var(--mute2); }
    .ar-rule-id { font-weight: 700; color: var(--soft); }

    /* Propuesta de mejora (diff) */
    .ar-fix { border-color: var(--divider); background: linear-gradient(110deg, var(--accent-tint) 0%, var(--card) 55%); }
    .ar-diff {
        background: var(--bg); border: 1px solid var(--border); border-radius: 9px;
        padding: 11px 13px; font-size: 11px; line-height: 1.7; overflow-x: auto;
    }
    .ar-diff .del { color: var(--err); }
    .ar-diff .add { color: var(--ok); }
    .ar-diff .ctx2 { color: var(--mute2); }
    .ar-fix-actions { display: flex; gap: 8px; margin-top: 11px; }

    /* Historial */
    .ar-history { display: flex; align-items: flex-end; gap: 5px; height: 58px; padding: 4px 2px 0; }
    .ar-bar { flex: 1; border-radius: 4px 4px 0 0; background: var(--ok); opacity: .8; position: relative; }
    .ar-bar.err { background: var(--err); }
    .ar-bar span {
        position: absolute; top: -16px; left: 50%; transform: translateX(-50%);
        font-size: 9px; color: var(--mute2); font-family: 'JetBrains Mono', monospace;
    }
    .ar-history-labels { display: flex; gap: 5px; margin-top: 5px; }
    .ar-history-labels div { flex: 1; text-align: center; font-size: 9px; color: var(--mute2); font-family: 'JetBrains Mono', monospace; }

    @media (max-width: 800px) {
        .ar-cases { display: none; }
        .ar-phases { grid-template-columns: repeat(2, 1fr); }
    }
</style>

<div class="ar-root">

    <header class="ar-header">
        <div>
            <div class="ar-title">Agent <span>Arena</span></div>
            <div class="ar-sub">Banco de pruebas · TESTING.md (47 reglas) · lint · BD real</div>
        </div>
        <div class="ar-agent-pick">☕ CoffeeIA <span style="color:var(--mute2);">▾</span></div>
        <div class="ar-header-right">
            <span class="ar-score-pill">Score 87%</span>
            <button class="ar-btn">⚖ Comparar modelos</button>
            <button class="ar-btn ar-btn-primary">▶ Correr todo (6 casos)</button>
        </div>
    </header>

    <div class="ar-body">

        <!-- ══ Casos dorados ══ -->
        <aside class="ar-cases">
            <h3>Casos dorados · CoffeeIA</h3>

            <div class="ar-case active">
                <span class="ar-case-status st-err"></span>
                <div class="ar-case-info">
                    <div class="ar-case-name">Genera ctrl+mdl de mermas</div>
                    <div class="ar-case-meta">@fayxzvov_inventory · hace 12 min</div>
                </div>
                <span class="ar-case-score sc-err">41/47</span>
            </div>
            <div class="ar-case">
                <span class="ar-case-status st-ok"></span>
                <div class="ar-case-info">
                    <div class="ar-case-name">CRUD de proveedores completo</div>
                    <div class="ar-case-meta">@fayxzvov_inventory · hace 12 min</div>
                </div>
                <span class="ar-case-score sc-ok">47/47</span>
            </div>
            <div class="ar-case">
                <span class="ar-case-status st-ok"></span>
                <div class="ar-case-info">
                    <div class="ar-case-name">Tabla con filtros por sucursal</div>
                    <div class="ar-case-meta">@fayxzvov_reginas · hace 13 min</div>
                </div>
                <span class="ar-case-score sc-ok">46/47</span>
            </div>
            <div class="ar-case">
                <span class="ar-case-status st-warn"></span>
                <div class="ar-case-info">
                    <div class="ar-case-name">Modal de pago con validación</div>
                    <div class="ar-case-meta">sin contexto · hace 13 min</div>
                </div>
                <span class="ar-case-score sc-ok">44/47</span>
            </div>
            <div class="ar-case">
                <span class="ar-case-status st-none"></span>
                <div class="ar-case-info">
                    <div class="ar-case-name">Reporte corte de turno</div>
                    <div class="ar-case-meta">@fayxzvov_alpha · sin correr</div>
                </div>
                <span class="ar-case-score sc-none">—</span>
            </div>
            <div class="ar-case">
                <span class="ar-case-status st-none"></span>
                <div class="ar-case-info">
                    <div class="ar-case-name">Refactor de módulo legacy</div>
                    <div class="ar-case-meta">carpeta: costsys · sin correr</div>
                </div>
                <span class="ar-case-score sc-none">—</span>
            </div>

            <button class="ar-new-case">＋ Nuevo caso dorado</button>

            <!-- Matriz agente × modelo -->
            <div class="ar-matrix">
                <h3>Score por modelo · 6 casos</h3>
                <table>
                    <tr><th>Modelo</th><th>Score</th><th>Time</th></tr>
                    <tr><td class="mono">glm-5.2</td><td class="best">91%</td><td class="mono" style="color:var(--mute2);">14s</td></tr>
                    <tr><td class="mono">qwen3-coder</td><td class="best">89%</td><td class="mono" style="color:var(--mute2);">21s</td></tr>
                    <tr><td class="mono">kimi-k2.7</td><td class="mid2">76%</td><td class="mono" style="color:var(--mute2);">18s</td></tr>
                    <tr><td class="mono">minimax-m3</td><td class="low">38%</td><td class="mono" style="color:var(--mute2);">9s</td></tr>
                </table>
            </div>
        </aside>

        <!-- ══ Detalle del caso ══ -->
        <main class="ar-detail">
            <div class="ar-detail-inner">

                <section class="ar-sec">
                    <h4>Caso: Genera ctrl+mdl de mermas
                        <span class="right ar-badge b-err">✕ 3 errores · 2 warnings</span>
                    </h4>
                    <div class="ar-prompt">Genera el módulo de mermas: controlador y modelo PHP siguiendo las convenciones CoffeeSoft, con listado filtrable por almacén y captura de nueva merma con evidencia.</div>
                    <div class="ar-ctx">
                        <span class="ar-ctx-chip">🛢 fayxzvov_inventory</span>
                        <span class="ar-ctx-chip">📖 MDL.md · CTRL.md</span>
                        <span class="ar-ctx-chip mono">glm-5.2</span>
                        <span class="ar-ctx-chip">× 3 corridas</span>
                    </div>
                </section>

                <section class="ar-sec">
                    <h4>Resultado por fase <span class="hint">— el reporte de CoffeeArcher, ahora determinista</span></h4>
                    <div class="ar-phases">
                        <div class="ar-phase ph-err"><div class="n">41/47</div><div class="l">Reglas TESTING.md</div></div>
                        <div class="ar-phase ph-ok"><div class="n">✓</div><div class="l">PHP lint</div></div>
                        <div class="ar-phase ph-ok"><div class="n">✓</div><div class="l">Rutas</div></div>
                        <div class="ar-phase ph-err"><div class="n">✕</div><div class="l">BD (columnas)</div></div>
                        <div class="ar-phase ph-warn"><div class="n">7.5</div><div class="l">Juez LLM (rúbrica)</div></div>
                    </div>
                </section>

                <section class="ar-sec">
                    <h4>Reglas violadas <span class="hint">— de las 47, solo las que fallaron</span></h4>
                    <table class="ar-rules">
                        <tr><th>Regla</th><th>Tipo</th><th>Detalle</th><th>Estado</th></tr>
                        <tr>
                            <td class="ar-rule-id">CTRL-004</td>
                            <td class="mono">EXISTE</td>
                            <td>Falta el <span class="mono">case 'lsAlmacenes'</span> requerido por el filtro del listado</td>
                            <td><span class="ar-badge b-err">ERROR</span></td>
                        </tr>
                        <tr>
                            <td class="ar-rule-id">MDL-007</td>
                            <td class="mono">PATRON</td>
                            <td>El pivote no es inmutable: reasigna <span class="mono">$this->_table</span> dentro del método</td>
                            <td><span class="ar-badge b-err">ERROR</span></td>
                        </tr>
                        <tr>
                            <td class="ar-rule-id">BD-CRUCE</td>
                            <td class="mono">CRUCE</td>
                            <td>Usa la columna <span class="mono">item.warehouse_id</span> — no existe: el almacén se deriva por categoría</td>
                            <td><span class="ar-badge b-err">ERROR</span></td>
                        </tr>
                        <tr>
                            <td class="ar-rule-id">JS-011</td>
                            <td class="mono">AUSENCIA</td>
                            <td>Usa iconos Lucide en un módulo que va con Fontello</td>
                            <td><span class="ar-badge b-warn">WARNING</span></td>
                        </tr>
                        <tr>
                            <td class="ar-rule-id">IDX-003</td>
                            <td class="mono">PATRON</td>
                            <td><span class="mono">heightPreset</span> distinto de 'full' en primaryLayout</td>
                            <td><span class="ar-badge b-warn">WARNING</span></td>
                        </tr>
                        <tr>
                            <td class="ar-rule-id">CTRL-001…014</td>
                            <td class="mono">—</td>
                            <td>Las 42 reglas restantes pasaron</td>
                            <td><span class="ar-badge b-pass">PASS ×42</span></td>
                        </tr>
                    </table>
                </section>

                <section class="ar-sec ar-fix">
                    <h4>✨ Mejora propuesta al agente <span class="hint">— cambio mínimo a CoffeeIA.md; nada se aplica sin tu OK</span></h4>
                    <div class="ar-diff mono">
<span class="ctx2">## Convenciones de modelo (MDL)</span><br>
<span class="ctx2">&nbsp;- Nomenclatura ls/get en controladores</span><br>
<span class="del">- Usa el patrón pivote en los modelos</span><br>
<span class="add">+ Usa el patrón pivote en los modelos. El pivote es INMUTABLE:</span><br>
<span class="add">+ se define una vez en el constructor y NUNCA se reasigna</span><br>
<span class="add">+ ($this->_table no se toca dentro de métodos).</span><br>
<span class="add">+ El almacén de un producto SIEMPRE se deriva por categoría</span><br>
<span class="add">+ (item_category.warehouse_id); item.warehouse_id NO existe.</span>
                    </div>
                    <div class="ar-fix-actions">
                        <button class="ar-btn ar-btn-primary">✓ Aplicar al agente (v13)</button>
                        <button class="ar-btn">Editar propuesta</button>
                        <button class="ar-btn">✕ Descartar</button>
                    </div>
                </section>

                <section class="ar-sec">
                    <h4>Historial del agente <span class="hint">— score por versión del prompt (git); una barra roja = regresión</span></h4>
                    <div class="ar-history">
                        <div class="ar-bar" style="height:52%;"><span>71</span></div>
                        <div class="ar-bar" style="height:57%;"><span>74</span></div>
                        <div class="ar-bar" style="height:63%;"><span>78</span></div>
                        <div class="ar-bar err" style="height:47%;"><span>66</span></div>
                        <div class="ar-bar" style="height:68%;"><span>81</span></div>
                        <div class="ar-bar" style="height:74%;"><span>85</span></div>
                        <div class="ar-bar" style="height:78%;"><span>87</span></div>
                    </div>
                    <div class="ar-history-labels">
                        <div>v6</div><div>v7</div><div>v8</div><div>v9</div><div>v10</div><div>v11</div><div>v12</div>
                    </div>
                </section>

            </div>
        </main>
    </div>
</div>
```

---

## Notas de la propuesta

- **Pantalla propia** en el rail (p.ej. "Arena"), separada del Agent Studio: el Studio edita agentes, la Arena los pone a prueba. Comparten el frontmatter y el versionado git.
- **Determinista primero**: las 47 reglas de `steering/TESTING.md` (EXISTE/AUSENCIA/PATRON/CRUCE) se corren con regex en PHP, sin LLM — gratis y repetibles. El juez LLM solo puntúa lo subjetivo.
- **El caso de muestra es real a propósito**: el error `item.warehouse_id` (el almacén se deriva por categoría) y el warning de Fontello son errores que un agente cometería hoy con nuestro esquema — la Arena existe para cazarlos antes que el usuario.
- **La matriz de modelos responde con datos** la pregunta "¿qué modelo pongo en el frontmatter?": minimax al 38% deja de ser opinión.
- **El diff propuesto nunca se auto-aplica**: Aplicar / Editar / Descartar. El historial por versión detecta regresiones (la barra roja v9).
