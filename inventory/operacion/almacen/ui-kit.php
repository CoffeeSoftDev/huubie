<?php
session_start();

// Validar sesión de usuario
if (empty($_SESSION["IDU"])) {
    require_once('../../acceso/ctrl/ctrl-logout.php');
    exit();
}

require_once('layout/head.php');
require_once('layout/core-libraries.php');

// Modo embebido: dentro del iframe de /inventory/root/ se ocultan navbar/sidebar
// para mostrar solo el contenido de la sección.
$embed = isset($_GET['embed']);
?>

<!-- CoffeeSoft Framework -->
<script src="../../src/js/coffeeSoft.js?t=<?php echo time(); ?>"></script>
<script src="../../src/js/plugins.js?t=<?php echo time(); ?>"></script>
<script src="../../src/js/complementos.js?t=<?php echo time(); ?>"></script>
<link rel="stylesheet" href="../../src/css/dark-mode.css">
<!-- Utilidades de color reales del sistema (btn-*, badge-*, alert-*) para la demo de componentes -->
<link rel="stylesheet" href="../../src/css/color-palette.css">

<style>
    /* ===========================================================
       UI KIT DE COLOR · Inventory  (estilos scoped .uik-*)
       Lenguaje visual alineado al uikit del rail (sidebar-uikit.html)
       =========================================================== */
    .uik-wrap { max-width: 1120px; margin: 0 auto; padding: 4px 2px 56px; font-family: 'Inter', sans-serif; }

    /* Header */
    .uik-head { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 16px; margin-bottom: 8px; }
    .uik-kicker { font-size: 11px; letter-spacing: .5px; text-transform: uppercase; color: #6B7280; margin-bottom: 4px; }
    .uik-h1 { font-size: 28px; font-weight: 700; color: #111827; margin: 0; }
    .uik-sub { font-size: 14px; color: #6B7280; margin: 8px 0 0; max-width: 640px; line-height: 1.5; }
    body.dark-mode .uik-h1 { color: #F9FAFB; }
    body.dark-mode .uik-kicker, body.dark-mode .uik-sub { color: #9CA3AF; }

    .uik-theme-btn {
        background: #FFFFFF; border: 1px solid #E5E7EB; color: #1F2937;
        padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 500;
        cursor: pointer; display: inline-flex; align-items: center; gap: 6px;
        transition: background-color .12s ease, border-color .12s ease;
    }
    .uik-theme-btn:hover { background: #F3F4F6; }
    body.dark-mode .uik-theme-btn { background: #1F2A37; border-color: #374151; color: #E5E7EB; }
    body.dark-mode .uik-theme-btn:hover { background: #283341; }

    /* Chips de "oficial" */
    .uik-officials { display: flex; flex-wrap: wrap; gap: 10px; margin: 18px 0 28px; }
    .uik-pill {
        display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 500;
        padding: 7px 13px; border-radius: 9999px; border: 1px solid #E5E7EB; background: #FFFFFF; color: #1F2937;
    }
    body.dark-mode .uik-pill { background: #1F2A37; border-color: #374151; color: #E5E7EB; }
    .uik-dot { width: 14px; height: 14px; border-radius: 9999px; border: 1px solid rgba(0,0,0,.12); flex-shrink: 0; }

    /* Secciones */
    .uik-section { margin-top: 38px; }
    .uik-section > h2 { font-size: 19px; font-weight: 600; color: #111827; margin: 0 0 4px; display: flex; align-items: center; gap: 9px; }
    .uik-section > p { font-size: 13.5px; color: #6B7280; margin: 0 0 18px; max-width: 720px; line-height: 1.55; }
    .uik-group-title { font-size: 13px; font-weight: 600; color: #374151; margin: 24px 0 12px; text-transform: uppercase; letter-spacing: .4px; }
    body.dark-mode .uik-section > h2 { color: #F3F4F6; }
    body.dark-mode .uik-section > p { color: #9CA3AF; }
    body.dark-mode .uik-group-title { color: #D1D5DB; }

    /* Grid de swatches */
    .uik-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(186px, 1fr)); gap: 13px; }
    .uik-swatch {
        background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 12px; padding: 13px;
        box-shadow: 0 1px 2px rgba(0,0,0,.04);
    }
    body.dark-mode .uik-swatch { background: #1F2A37; border-color: #374151; }
    .uik-chip { width: 100%; height: 76px; border-radius: 8px; border: 1px solid rgba(0,0,0,.08); margin-bottom: 10px; }
    .uik-name { font-size: 13px; font-weight: 600; color: #1F2937; margin-bottom: 2px; }
    .uik-hex { font-size: 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color: #6B7280; margin-bottom: 6px; }
    .uik-use { font-size: 12px; color: #6B7280; line-height: 1.4; }
    body.dark-mode .uik-name { color: #E5E7EB; }
    body.dark-mode .uik-hex, body.dark-mode .uik-use { color: #9CA3AF; }

    /* Rampa horizontal (terracota / grises) */
    .uik-ramp { display: flex; border-radius: 10px; overflow: hidden; border: 1px solid #E5E7EB; }
    body.dark-mode .uik-ramp { border-color: #374151; }
    .uik-ramp-cell { flex: 1; height: 64px; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 5px; }
    .uik-ramp-cell span { font-size: 9.5px; font-family: ui-monospace, monospace; font-weight: 600; }

    /* Comparación actual vs propuesta */
    .uik-cmp { display: flex; flex-direction: column; gap: 11px; }
    .uik-cmp-row {
        display: grid; grid-template-columns: 1fr 34px 1fr 1.4fr; align-items: center; gap: 14px;
        background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 12px; padding: 13px 16px;
    }
    body.dark-mode .uik-cmp-row { background: #1F2A37; border-color: #374151; }
    .uik-cmp-side { display: flex; align-items: center; gap: 11px; min-width: 0; }
    .uik-cmp-chip { width: 46px; height: 46px; border-radius: 9px; border: 1px solid rgba(0,0,0,.1); flex-shrink: 0; }
    .uik-cmp-meta { min-width: 0; }
    .uik-cmp-token { font-size: 12.5px; font-weight: 600; color: #1F2937; }
    .uik-cmp-hex { font-size: 11.5px; font-family: ui-monospace, monospace; color: #6B7280; }
    .uik-cmp-tag { font-size: 10.5px; color: #9CA3AF; display: block; margin-top: 1px; }
    body.dark-mode .uik-cmp-token { color: #E5E7EB; }
    body.dark-mode .uik-cmp-hex, body.dark-mode .uik-cmp-tag { color: #9CA3AF; }
    .uik-cmp-arrow { display: flex; align-items: center; justify-content: center; color: #C05A40; }
    .uik-cmp-arrow i { width: 20px; height: 20px; }
    .uik-cmp-note { font-size: 12px; color: #6B7280; line-height: 1.45; }
    body.dark-mode .uik-cmp-note { color: #9CA3AF; }

    .uik-tag { display: inline-block; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; padding: 2px 8px; border-radius: 9999px; }
    .uik-tag.keep { background: rgba(192,90,64,.12); color: #A84A33; }
    .uik-tag.change { background: rgba(217,154,43,.16); color: #9a6c12; }
    body.dark-mode .uik-tag.keep { color: #E8A68F; }
    body.dark-mode .uik-tag.change { color: #E3B25B; }

    /* Demo de componentes */
    .uik-demo { background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 12px; padding: 20px; }
    body.dark-mode .uik-demo { background: #1F2A37; border-color: #374151; }
    .uik-demo-row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 14px; }
    .uik-demo-row:last-child { margin-bottom: 0; }
    .uik-pbtn { border: none; color: #fff; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: default; }
    .uik-pbadge { color: #fff; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; }
    .uik-palert { padding: 11px 14px; border-radius: 8px; font-size: 13px; }

    @media (max-width: 720px) {
        .uik-cmp-row { grid-template-columns: 1fr; gap: 10px; text-align: left; }
        .uik-cmp-arrow { transform: rotate(90deg); justify-content: flex-start; }
    }
</style>

<?php if ($embed): ?>
<style>
    /* Embebido en /inventory/root/: sin navbar ni sidebar, a todo lo ancho. */
    body.embed-mode { padding-left: 0 !important; padding-top: 0 !important; }
</style>
<?php endif; ?>

<body class="<?php echo $embed ? 'embed-mode' : ''; ?>">
    <?php if (!$embed): ?>
    <div id="menu-sidebar" class="bg-white flex flex-col items-center py-4 gap-2"></div>
    <?php endif; ?>
    <main>
        <?php if (!$embed): ?>
        <div id="menu-navbar"></div>
        <?php endif; ?>

        <div id="main__content">
            <div id="root">
                <div class="uik-wrap">

                    <!-- ============================================================ -->
                    <!--  Header                                                      -->
                    <!-- ============================================================ -->
                    <div class="uik-head">
                        <div>
                            <div class="uik-kicker">Inventory &rsaquo; Sistema de diseño</div>
                            <h1 class="uik-h1">UI Kit de Color</h1>
                            <p class="uik-sub">
                                Referencia viva de la paleta del sistema y propuesta de refinamiento
                                <strong>“Arcilla Invernal v2”</strong>. Los colores oficiales —
                                <strong>terracota</strong> y <strong>fondo gris</strong> — se conservan intactos;
                                la propuesta solo ordena los secundarios y estados para que dejen de competir con el acento.
                            </p>
                        </div>
                        <button class="uik-theme-btn" type="button" onclick="uikToggleTheme()">
                            <i data-lucide="moon" class="w-4 h-4"></i>
                            <span id="uik-theme-label">Alternar tema</span>
                        </button>
                    </div>

                    <!-- Oficiales -->
                    <div class="uik-officials">
                        <span class="uik-pill"><span class="uik-dot" style="background:#C05A40"></span> Oficial · Terracota <code style="font-family:ui-monospace,monospace;font-size:11px;color:#9CA3AF">#C05A40</code></span>
                        <span class="uik-pill"><span class="uik-dot" style="background:#1F2A37"></span> Oficial · Fondo gris (superficie) <code style="font-family:ui-monospace,monospace;font-size:11px;color:#9CA3AF">#1F2A37</code></span>
                        <span class="uik-pill"><span class="uik-dot" style="background:#111928"></span> Oficial · Fondo gris (base) <code style="font-family:ui-monospace,monospace;font-size:11px;color:#9CA3AF">#111928</code></span>
                    </div>

                    <!-- ============================================================ -->
                    <!--  1. PALETA ACTUAL                                            -->
                    <!-- ============================================================ -->
                    <section class="uik-section">
                        <h2><i data-lucide="palette" style="width:19px;height:19px;color:#C05A40"></i> 1 · Paleta actual del sistema</h2>
                        <p>
                            Tomada tal cual de <code style="font-family:ui-monospace,monospace;font-size:12px">src/css/colors.css</code>.
                            Es la base que ya usa todo Inventory hoy.
                        </p>

                        <div class="uik-group-title">Acento — Terracota</div>
                        <div class="uik-grid">
                            <div class="uik-swatch">
                                <div class="uik-chip" style="background:#C05A40"></div>
                                <div class="uik-name">--primary</div>
                                <div class="uik-hex">#C05A40</div>
                                <div class="uik-use">Acento principal · botones, tabs activos, focus, border-left activo</div>
                            </div>
                            <div class="uik-swatch">
                                <div class="uik-chip" style="background:#A84A33"></div>
                                <div class="uik-name">--primary-hover</div>
                                <div class="uik-hex">#A84A33</div>
                                <div class="uik-use">Hover del acento</div>
                            </div>
                            <div class="uik-swatch">
                                <div class="uik-chip" style="background:#E8A68F"></div>
                                <div class="uik-name">--primary-light / salmón</div>
                                <div class="uik-hex">#E8A68F</div>
                                <div class="uik-use">Acento suave, icono activo en dark</div>
                            </div>
                            <div class="uik-swatch">
                                <div class="uik-chip" style="background:#8F3D2A"></div>
                                <div class="uik-name">--primary-dark</div>
                                <div class="uik-hex">#8F3D2A</div>
                                <div class="uik-use">Acento profundo</div>
                            </div>
                            <div class="uik-swatch">
                                <div class="uik-chip" style="background:rgba(192,90,64,.18)"></div>
                                <div class="uik-name">--terracota-tint</div>
                                <div class="uik-hex">rgba(192,90,64,.18)</div>
                                <div class="uik-use">Fondo de chip / item activo / focus ring</div>
                            </div>
                        </div>

                        <div class="uik-group-title">Fondos gris (superficies oficiales)</div>
                        <div class="uik-grid">
                            <div class="uik-swatch">
                                <div class="uik-chip" style="background:#111928"></div>
                                <div class="uik-name">Fondo base · dark</div>
                                <div class="uik-hex">#111928</div>
                                <div class="uik-use">Fondo de página en tema oscuro</div>
                            </div>
                            <div class="uik-swatch">
                                <div class="uik-chip" style="background:#1F2A37"></div>
                                <div class="uik-name">Superficie / card · dark</div>
                                <div class="uik-hex">#1F2A37</div>
                                <div class="uik-use">Contenedores, cards del visor</div>
                            </div>
                            <div class="uik-swatch">
                                <div class="uik-chip" style="background:#374151"></div>
                                <div class="uik-name">Borde · dark</div>
                                <div class="uik-hex">#374151</div>
                                <div class="uik-use">Separadores y bordes de card</div>
                            </div>
                            <div class="uik-swatch">
                                <div class="uik-chip" style="background:#141d2b"></div>
                                <div class="uik-name">--navbar (chrome)</div>
                                <div class="uik-hex">#141d2b</div>
                                <div class="uik-use">Fondo del rail + navbar</div>
                            </div>
                            <div class="uik-swatch">
                                <div class="uik-chip" style="background:#F3F4F6"></div>
                                <div class="uik-name">Fondo base · light</div>
                                <div class="uik-hex">#F3F4F6</div>
                                <div class="uik-use">Fondo de página en tema claro</div>
                            </div>
                            <div class="uik-swatch">
                                <div class="uik-chip" style="background:#E5E7EB"></div>
                                <div class="uik-name">Borde · light</div>
                                <div class="uik-hex">#E5E7EB</div>
                                <div class="uik-use">Separadores en tema claro</div>
                            </div>
                        </div>

                        <div class="uik-group-title">Estados semánticos (actuales)</div>
                        <div class="uik-grid">
                            <div class="uik-swatch">
                                <div class="uik-chip" style="background:#0F172A"></div>
                                <div class="uik-name">--secondary</div>
                                <div class="uik-hex">#0F172A · slate-900</div>
                                <div class="uik-use">Acción secundaria · <strong>tono azulado</strong></div>
                            </div>
                            <div class="uik-swatch">
                                <div class="uik-chip" style="background:#22C55E"></div>
                                <div class="uik-name">--success</div>
                                <div class="uik-hex">#22C55E · green-500</div>
                                <div class="uik-use">Éxito · <strong>verde neón genérico</strong></div>
                            </div>
                            <div class="uik-swatch">
                                <div class="uik-chip" style="background:#9D3434"></div>
                                <div class="uik-name">--danger</div>
                                <div class="uik-hex">#9D3434</div>
                                <div class="uik-use">Error / merma · rojo vino (ya en mood tierra)</div>
                            </div>
                            <div class="uik-swatch">
                                <div class="uik-chip" style="background:#F69F00"></div>
                                <div class="uik-name">--warning</div>
                                <div class="uik-hex">#F69F00</div>
                                <div class="uik-use">Aviso · ámbar muy naranja</div>
                            </div>
                            <div class="uik-swatch">
                                <div class="uik-chip" style="background:#C05A40"></div>
                                <div class="uik-name">--info</div>
                                <div class="uik-hex">#C05A40 (alias)</div>
                                <div class="uik-use"><strong>Confuso:</strong> info == acento, no se distingue</div>
                            </div>
                            <div class="uik-swatch">
                                <div class="uik-chip" style="background:#aad3eb"></div>
                                <div class="uik-name">--middle</div>
                                <div class="uik-hex">#aad3eb</div>
                                <div class="uik-use">Celeste suelto, ajeno a la paleta</div>
                            </div>
                        </div>
                    </section>

                    <!-- ============================================================ -->
                    <!--  2. RAMPA TERRACOTA (columna vertebral)                      -->
                    <!-- ============================================================ -->
                    <section class="uik-section">
                        <h2><i data-lucide="layers" style="width:19px;height:19px;color:#C05A40"></i> 2 · Rampa terracota 50–950</h2>
                        <p>
                            Definida en <code style="font-family:ui-monospace,monospace;font-size:12px">tailwind-theme.js</code>:
                            remapea la escala <code style="font-family:ui-monospace,monospace;font-size:12px">blue</code> de Tailwind al acento,
                            así toda clase <code style="font-family:ui-monospace,monospace;font-size:12px">bg-blue-*</code> rinde terracota.
                            Se conserva sin cambios — es la columna vertebral de ambas paletas.
                        </p>
                        <div class="uik-ramp">
                            <div class="uik-ramp-cell" style="background:#FBF3EF"><span style="color:#6E2F20">50</span></div>
                            <div class="uik-ramp-cell" style="background:#F7E3DC"><span style="color:#6E2F20">100</span></div>
                            <div class="uik-ramp-cell" style="background:#EFC9BC"><span style="color:#6E2F20">200</span></div>
                            <div class="uik-ramp-cell" style="background:#E8A68F"><span style="color:#4A1F16">300</span></div>
                            <div class="uik-ramp-cell" style="background:#D9826A"><span style="color:#fff">400</span></div>
                            <div class="uik-ramp-cell" style="background:#C8694C"><span style="color:#fff">500</span></div>
                            <div class="uik-ramp-cell" style="background:#C05A40"><span style="color:#fff">600</span></div>
                            <div class="uik-ramp-cell" style="background:#A84A33"><span style="color:#fff">700</span></div>
                            <div class="uik-ramp-cell" style="background:#8F3D2A"><span style="color:#fff">800</span></div>
                            <div class="uik-ramp-cell" style="background:#6E2F20"><span style="color:#fff">900</span></div>
                            <div class="uik-ramp-cell" style="background:#4A1F16"><span style="color:#fff">950</span></div>
                        </div>
                    </section>

                    <!-- ============================================================ -->
                    <!--  3. PALETA PROPUESTA                                         -->
                    <!-- ============================================================ -->
                    <section class="uik-section">
                        <h2><i data-lucide="sparkles" style="width:19px;height:19px;color:#C05A40"></i> 3 · Paleta propuesta — “Arcilla Invernal v2”</h2>
                        <p>
                            Mismo acento, mismos grises de fondo. Cambia solo lo que hoy desentona:
                            secundario neutralizado (sin azul), estados llevados al mood tierra y un
                            <strong>info</strong> propio (acero) que ya no se confunde con el acento.
                        </p>

                        <div class="uik-group-title">Neutros cálidos (grises de apoyo para texto/borde)</div>
                        <div class="uik-ramp">
                            <div class="uik-ramp-cell" style="background:#FAFAF9"><span style="color:#44403C">50</span></div>
                            <div class="uik-ramp-cell" style="background:#F5F5F4"><span style="color:#44403C">100</span></div>
                            <div class="uik-ramp-cell" style="background:#E7E5E4"><span style="color:#44403C">200</span></div>
                            <div class="uik-ramp-cell" style="background:#D6D3D1"><span style="color:#44403C">300</span></div>
                            <div class="uik-ramp-cell" style="background:#A8A29E"><span style="color:#fff">400</span></div>
                            <div class="uik-ramp-cell" style="background:#78716C"><span style="color:#fff">500</span></div>
                            <div class="uik-ramp-cell" style="background:#57534E"><span style="color:#fff">600</span></div>
                            <div class="uik-ramp-cell" style="background:#44403C"><span style="color:#fff">700</span></div>
                            <div class="uik-ramp-cell" style="background:#292524"><span style="color:#fff">800</span></div>
                            <div class="uik-ramp-cell" style="background:#1C1917"><span style="color:#fff">900</span></div>
                        </div>
                        <p style="margin-top:10px;font-size:12.5px">
                            Grises con una pizca de calidez (familia <em>stone</em>) que combinan con la arcilla,
                            en vez del slate frío. Útiles para texto, bordes y superficies en tema claro.
                        </p>

                        <div class="uik-group-title">Estados semánticos armonizados</div>
                        <div class="uik-grid">
                            <div class="uik-swatch">
                                <div class="uik-chip" style="background:#3F4A3A"></div>
                                <div class="uik-name">success → salvia</div>
                                <div class="uik-hex">#4F7942</div>
                                <div class="uik-use">Verde salvia/oliva, sobrio y terroso. (chip muestra base + tinte)</div>
                            </div>
                            <div class="uik-swatch">
                                <div class="uik-chip" style="background:#4F7942"></div>
                                <div class="uik-name">--success (base)</div>
                                <div class="uik-hex">#4F7942</div>
                                <div class="uik-use">Éxito · stock OK, confirmaciones</div>
                            </div>
                            <div class="uik-swatch">
                                <div class="uik-chip" style="background:#9D3434"></div>
                                <div class="uik-name">--danger (se conserva)</div>
                                <div class="uik-hex">#9D3434</div>
                                <div class="uik-use">Rojo vino · ya armoniza con terracota</div>
                            </div>
                            <div class="uik-swatch">
                                <div class="uik-chip" style="background:#D99A2B"></div>
                                <div class="uik-name">--warning → dorado</div>
                                <div class="uik-hex">#D99A2B</div>
                                <div class="uik-use">Ámbar dorado cálido, menos naranja puro</div>
                            </div>
                            <div class="uik-swatch">
                                <div class="uik-chip" style="background:#5C7A99"></div>
                                <div class="uik-name">--info → acero</div>
                                <div class="uik-hex">#5C7A99</div>
                                <div class="uik-use">Azul acero apagado · informativo, distinto del acento</div>
                            </div>
                            <div class="uik-swatch">
                                <div class="uik-chip" style="background:#8FA3B7"></div>
                                <div class="uik-name">--acero (apoyo)</div>
                                <div class="uik-hex">#8FA3B7</div>
                                <div class="uik-use">Muted / secundario suave (ya existe como token base)</div>
                            </div>
                        </div>

                        <div class="uik-group-title">Acentos de apoyo (ya presentes como tokens base)</div>
                        <div class="uik-grid">
                            <div class="uik-swatch">
                                <div class="uik-chip" style="background:#E8A68F"></div>
                                <div class="uik-name">--salmon</div>
                                <div class="uik-hex">#E8A68F</div>
                                <div class="uik-use">Acento suave / hover claro</div>
                            </div>
                            <div class="uik-swatch">
                                <div class="uik-chip" style="background:#F7F0EB"></div>
                                <div class="uik-name">--crema</div>
                                <div class="uik-hex">#F7F0EB</div>
                                <div class="uik-use">Fondo light cálido / badges suaves</div>
                            </div>
                            <div class="uik-swatch">
                                <div class="uik-chip" style="background:#1E2730"></div>
                                <div class="uik-name">--navy</div>
                                <div class="uik-hex">#1E2730</div>
                                <div class="uik-use">Texto/acento profundo</div>
                            </div>
                        </div>
                    </section>

                    <!-- ============================================================ -->
                    <!--  4. COMPARATIVA ACTUAL ↔ PROPUESTA                           -->
                    <!-- ============================================================ -->
                    <section class="uik-section">
                        <h2><i data-lucide="arrow-left-right" style="width:19px;height:19px;color:#C05A40"></i> 4 · Actual vs propuesta</h2>
                        <p>Solo se listan los tokens que cambian. Acento terracota y grises de fondo se marcan como <span class="uik-tag keep">se conserva</span>.</p>

                        <div class="uik-cmp">
                            <!-- Terracota: sin cambio -->
                            <div class="uik-cmp-row">
                                <div class="uik-cmp-side">
                                    <div class="uik-cmp-chip" style="background:#C05A40"></div>
                                    <div class="uik-cmp-meta">
                                        <div class="uik-cmp-token">--primary</div>
                                        <div class="uik-cmp-hex">#C05A40</div>
                                        <span class="uik-cmp-tag">Acento oficial</span>
                                    </div>
                                </div>
                                <div class="uik-cmp-arrow"><i data-lucide="equal"></i></div>
                                <div class="uik-cmp-side">
                                    <div class="uik-cmp-chip" style="background:#C05A40"></div>
                                    <div class="uik-cmp-meta">
                                        <div class="uik-cmp-token">--primary</div>
                                        <div class="uik-cmp-hex">#C05A40</div>
                                        <span class="uik-cmp-tag">Idéntico</span>
                                    </div>
                                </div>
                                <div class="uik-cmp-note"><span class="uik-tag keep">se conserva</span> Terracota es oficial; intocable.</div>
                            </div>

                            <!-- Fondo gris: sin cambio -->
                            <div class="uik-cmp-row">
                                <div class="uik-cmp-side">
                                    <div class="uik-cmp-chip" style="background:#1F2A37"></div>
                                    <div class="uik-cmp-meta">
                                        <div class="uik-cmp-token">Superficie dark</div>
                                        <div class="uik-cmp-hex">#1F2A37</div>
                                        <span class="uik-cmp-tag">Fondo oficial</span>
                                    </div>
                                </div>
                                <div class="uik-cmp-arrow"><i data-lucide="equal"></i></div>
                                <div class="uik-cmp-side">
                                    <div class="uik-cmp-chip" style="background:#1F2A37"></div>
                                    <div class="uik-cmp-meta">
                                        <div class="uik-cmp-token">Superficie dark</div>
                                        <div class="uik-cmp-hex">#1F2A37</div>
                                        <span class="uik-cmp-tag">Idéntico</span>
                                    </div>
                                </div>
                                <div class="uik-cmp-note"><span class="uik-tag keep">se conserva</span> Fondo gris es oficial; intocable.</div>
                            </div>

                            <!-- Secondary -->
                            <div class="uik-cmp-row">
                                <div class="uik-cmp-side">
                                    <div class="uik-cmp-chip" style="background:#0F172A"></div>
                                    <div class="uik-cmp-meta">
                                        <div class="uik-cmp-token">--secondary</div>
                                        <div class="uik-cmp-hex">#0F172A</div>
                                        <span class="uik-cmp-tag">slate · azulado</span>
                                    </div>
                                </div>
                                <div class="uik-cmp-arrow"><i data-lucide="arrow-right"></i></div>
                                <div class="uik-cmp-side">
                                    <div class="uik-cmp-chip" style="background:#292524"></div>
                                    <div class="uik-cmp-meta">
                                        <div class="uik-cmp-token">--secondary</div>
                                        <div class="uik-cmp-hex">#292524</div>
                                        <span class="uik-cmp-tag">grafito neutro cálido</span>
                                    </div>
                                </div>
                                <div class="uik-cmp-note"><span class="uik-tag change">cambia</span> Quita el tinte azul para no pelear con el terracota.</div>
                            </div>

                            <!-- Success -->
                            <div class="uik-cmp-row">
                                <div class="uik-cmp-side">
                                    <div class="uik-cmp-chip" style="background:#22C55E"></div>
                                    <div class="uik-cmp-meta">
                                        <div class="uik-cmp-token">--success</div>
                                        <div class="uik-cmp-hex">#22C55E</div>
                                        <span class="uik-cmp-tag">verde neón</span>
                                    </div>
                                </div>
                                <div class="uik-cmp-arrow"><i data-lucide="arrow-right"></i></div>
                                <div class="uik-cmp-side">
                                    <div class="uik-cmp-chip" style="background:#4F7942"></div>
                                    <div class="uik-cmp-meta">
                                        <div class="uik-cmp-token">--success</div>
                                        <div class="uik-cmp-hex">#4F7942</div>
                                        <span class="uik-cmp-tag">verde salvia</span>
                                    </div>
                                </div>
                                <div class="uik-cmp-note"><span class="uik-tag change">cambia</span> Verde terroso, más sobrio junto a la arcilla.</div>
                            </div>

                            <!-- Warning -->
                            <div class="uik-cmp-row">
                                <div class="uik-cmp-side">
                                    <div class="uik-cmp-chip" style="background:#F69F00"></div>
                                    <div class="uik-cmp-meta">
                                        <div class="uik-cmp-token">--warning</div>
                                        <div class="uik-cmp-hex">#F69F00</div>
                                        <span class="uik-cmp-tag">ámbar naranja</span>
                                    </div>
                                </div>
                                <div class="uik-cmp-arrow"><i data-lucide="arrow-right"></i></div>
                                <div class="uik-cmp-side">
                                    <div class="uik-cmp-chip" style="background:#D99A2B"></div>
                                    <div class="uik-cmp-meta">
                                        <div class="uik-cmp-token">--warning</div>
                                        <div class="uik-cmp-hex">#D99A2B</div>
                                        <span class="uik-cmp-tag">dorado cálido</span>
                                    </div>
                                </div>
                                <div class="uik-cmp-note"><span class="uik-tag change">cambia</span> Dorado, menos competencia con el naranja del acento.</div>
                            </div>

                            <!-- Info -->
                            <div class="uik-cmp-row">
                                <div class="uik-cmp-side">
                                    <div class="uik-cmp-chip" style="background:#C05A40"></div>
                                    <div class="uik-cmp-meta">
                                        <div class="uik-cmp-token">--info</div>
                                        <div class="uik-cmp-hex">#C05A40</div>
                                        <span class="uik-cmp-tag">alias del acento ⚠</span>
                                    </div>
                                </div>
                                <div class="uik-cmp-arrow"><i data-lucide="arrow-right"></i></div>
                                <div class="uik-cmp-side">
                                    <div class="uik-cmp-chip" style="background:#5C7A99"></div>
                                    <div class="uik-cmp-meta">
                                        <div class="uik-cmp-token">--info</div>
                                        <div class="uik-cmp-hex">#5C7A99</div>
                                        <span class="uik-cmp-tag">acero apagado</span>
                                    </div>
                                </div>
                                <div class="uik-cmp-note"><span class="uik-tag change">cambia</span> Info deja de ser igual al acento; gana identidad propia.</div>
                            </div>

                            <!-- Middle -->
                            <div class="uik-cmp-row">
                                <div class="uik-cmp-side">
                                    <div class="uik-cmp-chip" style="background:#aad3eb"></div>
                                    <div class="uik-cmp-meta">
                                        <div class="uik-cmp-token">--middle</div>
                                        <div class="uik-cmp-hex">#aad3eb</div>
                                        <span class="uik-cmp-tag">celeste suelto</span>
                                    </div>
                                </div>
                                <div class="uik-cmp-arrow"><i data-lucide="arrow-right"></i></div>
                                <div class="uik-cmp-side">
                                    <div class="uik-cmp-chip" style="background:#D6D3D1"></div>
                                    <div class="uik-cmp-meta">
                                        <div class="uik-cmp-token">--middle</div>
                                        <div class="uik-cmp-hex">#D6D3D1</div>
                                        <span class="uik-cmp-tag">neutro 300</span>
                                    </div>
                                </div>
                                <div class="uik-cmp-note"><span class="uik-tag change">cambia</span> Se integra a la rampa neutra cálida.</div>
                            </div>
                        </div>
                    </section>

                    <!-- ============================================================ -->
                    <!--  5. APLICACIÓN EN COMPONENTES                                -->
                    <!-- ============================================================ -->
                    <section class="uik-section">
                        <h2><i data-lucide="component" style="width:19px;height:19px;color:#C05A40"></i> 5 · Aplicación en componentes</h2>
                        <p>Izquierda: utilidades reales de <code style="font-family:ui-monospace,monospace;font-size:12px">color-palette.css</code> (actual). Derecha: mismos componentes con la paleta propuesta.</p>

                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px" class="uik-cmp-grid">
                            <!-- Actual -->
                            <div class="uik-demo">
                                <div class="uik-group-title" style="margin-top:0">Actual</div>
                                <div class="uik-demo-row">
                                    <button class="btn-primary">Primary</button>
                                    <button class="btn-success">Success</button>
                                    <button class="btn-danger">Danger</button>
                                </div>
                                <div class="uik-demo-row">
                                    <span class="badge-primary">Acento</span>
                                    <span class="badge-success">OK</span>
                                    <span class="badge-danger">Merma</span>
                                    <span class="badge-secondary">Sec.</span>
                                </div>
                                <div class="uik-demo-row" style="display:block">
                                    <div class="alert-success" style="margin-bottom:8px">Entrada registrada correctamente.</div>
                                    <div class="alert-danger">Stock insuficiente para el traspaso.</div>
                                </div>
                            </div>

                            <!-- Propuesta -->
                            <div class="uik-demo">
                                <div class="uik-group-title" style="margin-top:0">Propuesta</div>
                                <div class="uik-demo-row">
                                    <button class="uik-pbtn" style="background:#C05A40">Primary</button>
                                    <button class="uik-pbtn" style="background:#4F7942">Success</button>
                                    <button class="uik-pbtn" style="background:#9D3434">Danger</button>
                                </div>
                                <div class="uik-demo-row">
                                    <span class="uik-pbadge" style="background:#C05A40">Acento</span>
                                    <span class="uik-pbadge" style="background:#4F7942">OK</span>
                                    <span class="uik-pbadge" style="background:#9D3434">Merma</span>
                                    <span class="uik-pbadge" style="background:#292524">Sec.</span>
                                </div>
                                <div class="uik-demo-row" style="display:block">
                                    <div class="uik-palert" style="background:rgba(79,121,66,.12);border-left:4px solid #4F7942;color:#3F4A3A;margin-bottom:8px">Entrada registrada correctamente.</div>
                                    <div class="uik-palert" style="background:rgba(157,52,52,.10);border-left:4px solid #9D3434;color:#6E2424">Stock insuficiente para el traspaso.</div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <p style="text-align:center;font-size:12px;color:#9CA3AF;margin-top:42px;padding-top:20px;border-top:1px solid #E5E7EB">
                        UI Kit de Color · módulo Almacén — propuesta de diseño, sin cambios aún en los CSS del sistema.
                    </p>

                </div>
            </div>
        </div>
    </main>

    <?php if (!$embed): ?>
    <!-- Importación navbar y sidebar -->
    <script src="../../acceso/src/js/navbar.js"></script>
    <script src="../../acceso/src/js/sidebar.js"></script>
    <?php endif; ?>

    <script>
        // Toggle de tema local, sincronizado con el resto del módulo (localStorage 'darkMode').
        function uikToggleTheme() {
            const isDark = document.body.classList.toggle('dark-mode');
            localStorage.setItem('darkMode', isDark ? 'true' : 'false');
            const lbl = document.getElementById('uik-theme-label');
            if (lbl) lbl.textContent = isDark ? 'Tema oscuro' : 'Tema claro';
        }

        $(function () {
            const lbl = document.getElementById('uik-theme-label');
            if (lbl) lbl.textContent = document.body.classList.contains('dark-mode') ? 'Tema oscuro' : 'Tema claro';
            if (typeof lucide !== 'undefined') lucide.createIcons();
        });
    </script>
</body>
</html>
