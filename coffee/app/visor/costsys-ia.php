<?php
/**
 * Costsys IA — Chat estilo OpenAI (dark) conectado a Ollama.
 *
 * Autocontenido: reutiliza el endpoint SSE existente del visor
 * (ctrl/ctrl-coffeeia-stream.php → OllamaClient::chatStream) sin backend nuevo.
 * El "alma" del asistente se inyecta como systemOverride (prompt de Costsys),
 * así que Ollama responde ya enfocado en costeo (recetas, márgenes, % de costo).
 */
?>
<!DOCTYPE html>
<html lang="es" data-theme="dark">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Costsys IA — Chat con Ollama</title>

<script src="https://cdn.tailwindcss.com"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<script src="https://unpkg.com/lucide@latest"></script>
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/dompurify@3.0.6/dist/purify.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">

<style>
  :root, [data-theme="dark"] {
    --vsr-bg-base:#111928; --vsr-bg-chrome:#141d2b; --vsr-bg-card:#1F2A37; --vsr-bg-input:#1F2A37; --vsr-bg-hover:#1a2332;
    --vsr-text:#fff; --vsr-text-soft:#E5E7EB; --vsr-text-mid:#D1D5DB; --vsr-text-muted:#9CA3AF; --vsr-text-mute2:#6B7280;
    --vsr-border:rgba(55,65,81,.6); --vsr-border-soft:rgba(55,65,81,.4); --vsr-border-input:rgba(55,65,81,.6); --vsr-divider:rgba(124,58,237,.18);
    --vsr-accent:#7C3AED; --vsr-accent-soft:#A855F7; --vsr-accent-tint:rgba(124,58,237,.18);
    --vsr-scrollbar:#374151; --vsr-scrollbar-hov:#4B5563;
  }
  [data-theme="light"] {
    --vsr-bg-base:#F3F4F6; --vsr-bg-chrome:#FFFFFF; --vsr-bg-card:#FFFFFF; --vsr-bg-input:#FFFFFF; --vsr-bg-hover:#F3F4F6;
    --vsr-text:#111827; --vsr-text-soft:#1F2937; --vsr-text-mid:#374151; --vsr-text-muted:#6B7280; --vsr-text-mute2:#9CA3AF;
    --vsr-border:#E5E7EB; --vsr-border-soft:#E5E7EB; --vsr-border-input:#E5E7EB; --vsr-divider:rgba(124,58,237,.22);
    --vsr-accent:#7C3AED; --vsr-accent-soft:#6D28D9; --vsr-accent-tint:rgba(124,58,237,.10);
    --vsr-scrollbar:#D1D5DB; --vsr-scrollbar-hov:#9CA3AF;
  }
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { height:100%; }
  .visor-body { background:var(--vsr-bg-base); font-family:'Inter',system-ui,sans-serif; color:var(--vsr-text); height:100vh; overflow:hidden; display:flex; flex-direction:column; }

  /* Header */
  .visor-header { display:flex; align-items:center; justify-content:space-between; padding:0 20px; height:60px; flex-shrink:0; background:var(--vsr-bg-chrome); border-bottom:1px solid var(--vsr-divider); box-shadow:0 4px 8px rgba(0,0,0,.3); }
  .vsr-header-left { display:flex; align-items:center; gap:13px; }
  .visor-logo { width:36px; height:36px; border-radius:10px; background:linear-gradient(135deg,#7C3AED 0%,#EC4899 100%); display:flex; align-items:center; justify-content:center; font-weight:800; font-size:13px; color:#fff; box-shadow:0 4px 12px rgba(124,58,237,.35); }
  #headerTitle { font-size:14px; font-weight:700; color:var(--vsr-text); }
  #headerSubtitle { font-size:10px; color:var(--vsr-text-mute2); letter-spacing:.12em; text-transform:uppercase; }
  .conn-pill { display:inline-flex; align-items:center; gap:6px; font-size:11px; color:var(--vsr-text-mid); padding:4px 10px; border-radius:9999px; background:var(--vsr-bg-card); border:1px solid var(--vsr-border); }
  .conn-dot { width:7px; height:7px; border-radius:9999px; background:#34D399; box-shadow:0 0 0 3px rgba(52,211,153,.15); }
  .vsr-header-right { display:flex; align-items:center; gap:10px; }
  .ia-model-pill { font-size:11.5px; color:var(--vsr-text-soft); background:var(--vsr-bg-input); border:1px solid var(--vsr-border-input); border-radius:9px; padding:6px 10px; cursor:pointer; outline:none; font-family:inherit; }
  .ia-model-pill:focus { border-color:var(--vsr-accent); }
  .theme-toggle, .icon-btn { display:flex; align-items:center; justify-content:center; width:34px; height:34px; border-radius:9px; background:var(--vsr-bg-input); border:1px solid var(--vsr-border-input); color:var(--vsr-text-soft); cursor:pointer; transition:.15s; }
  .theme-toggle:hover, .icon-btn:hover { border-color:rgba(124,58,237,.5); color:var(--vsr-accent-soft); }
  .cs-btn { padding:6px 12px; font-size:12px; border-radius:8px; display:inline-flex; align-items:center; gap:6px; font-weight:600; cursor:pointer; border:1px solid transparent; transition:.15s; }
  .cs-btn-primary { background:var(--vsr-accent); color:#fff; }
  .cs-btn-primary:hover { background:var(--vsr-accent-soft); }
  .cs-btn-outline { color:var(--vsr-text-soft); background:transparent; border:1px solid var(--vsr-border-input); }
  .cs-btn-outline:hover { background:var(--vsr-bg-hover); border-color:var(--vsr-accent); }

  /* Workspace */
  .cs-workspace { flex:1 1 auto; display:flex; min-height:0; overflow:hidden; }
  .app-rail { width:66px; flex-shrink:0; background:var(--vsr-bg-chrome); border-right:1px solid var(--vsr-border); display:flex; flex-direction:column; align-items:center; padding:12px 0; gap:4px; }
  .app-rail-item { width:50px; padding:8px 0; border-radius:11px; display:flex; flex-direction:column; align-items:center; gap:4px; color:var(--vsr-text-mute2); text-decoration:none; font-size:8.5px; font-weight:600; transition:.15s; }
  .app-rail-item i { width:19px; height:19px; }
  .app-rail-item:hover { color:var(--vsr-text); background:var(--vsr-bg-hover); }
  .app-rail-item.active { color:var(--vsr-accent-soft); background:var(--vsr-accent-tint); }

  /* Sidebar de conversaciones */
  .chat-sidebar { width:274px; flex-shrink:0; background:var(--vsr-bg-chrome); border-right:1px solid var(--vsr-border); display:flex; flex-direction:column; min-height:0; }
  .chat-sidebar-head { padding:13px; display:flex; gap:8px; border-bottom:1px solid var(--vsr-border-soft); }
  .cs-input { flex:1; padding:8px 11px; font-size:12px; background:var(--vsr-bg-input); color:var(--vsr-text-soft); border:1px solid var(--vsr-border-input); border-radius:8px; outline:none; }
  .cs-input:focus { border-color:var(--vsr-accent); box-shadow:0 0 0 3px var(--vsr-accent-tint); }
  .cs-input::placeholder { color:var(--vsr-text-mute2); }
  .chat-sidebar-body { flex:1; overflow-y:auto; padding:8px; min-height:0; }
  .conv-item { display:flex; align-items:center; gap:9px; padding:9px 10px; border-radius:9px; cursor:pointer; color:var(--vsr-text-mid); border:1px solid transparent; transition:.12s; margin-bottom:2px; }
  .conv-item:hover { background:var(--vsr-bg-hover); color:var(--vsr-text); }
  .conv-item.active { background:linear-gradient(90deg,var(--vsr-accent-tint) 0%,transparent 100%); border-color:var(--vsr-border-soft); color:var(--vsr-text); }
  .conv-item i.lead { width:15px; height:15px; color:var(--vsr-text-mute2); flex-shrink:0; }
  .conv-item.active i.lead { color:var(--vsr-accent-soft); }
  .conv-title { flex:1; font-size:12.5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .conv-del { opacity:0; width:22px; height:22px; border-radius:6px; border:none; background:transparent; color:var(--vsr-text-mute2); cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .conv-item:hover .conv-del { opacity:1; }
  .conv-del:hover { color:#F87171; background:var(--vsr-bg-input); }
  .sidebar-empty { text-align:center; color:var(--vsr-text-mute2); font-size:12px; padding:40px 20px; }

  /* Main chat */
  .chat-main { flex:1 1 auto; display:flex; flex-direction:column; min-width:0; min-height:0; position:relative; }
  .chat-stream { flex:1 1 auto; overflow-y:auto; padding:26px 24px 8px; min-height:0; }
  .chat-container { max-width:760px; margin:0 auto; display:flex; flex-direction:column; gap:26px; }
  .chat-sidebar-body::-webkit-scrollbar, .chat-stream::-webkit-scrollbar { width:8px; }
  .chat-sidebar-body::-webkit-scrollbar-thumb, .chat-stream::-webkit-scrollbar-thumb { background:var(--vsr-scrollbar); border-radius:4px; }

  /* Welcome */
  .chat-welcome { display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:52px 24px; min-height:100%; }
  .chat-welcome-icon { width:58px; height:58px; border-radius:15px; background:linear-gradient(135deg,#7C3AED 0%,#EC4899 100%); display:flex; align-items:center; justify-content:center; color:#fff; margin-bottom:18px; box-shadow:0 8px 24px rgba(124,58,237,.3); }
  .chat-welcome-title { font-size:23px; font-weight:800; color:var(--vsr-text); margin-bottom:6px; letter-spacing:-.01em; }
  .chat-welcome-sub { font-size:13px; color:var(--vsr-text-muted); margin-bottom:26px; max-width:460px; line-height:1.6; }
  .chat-suggestions { display:grid; grid-template-columns:repeat(2,1fr); gap:10px; width:100%; max-width:560px; }
  .chat-suggestion { text-align:left; padding:13px 15px; background:var(--vsr-bg-card); border:1px solid var(--vsr-border-soft); border-radius:11px; cursor:pointer; transition:.15s; display:flex; align-items:flex-start; gap:11px; }
  .chat-suggestion:hover { border-color:var(--vsr-accent); background:var(--vsr-bg-hover); transform:translateY(-1px); }
  .chat-suggestion-icon { width:30px; height:30px; flex-shrink:0; border-radius:8px; background:var(--vsr-accent-tint); display:flex; align-items:center; justify-content:center; color:var(--vsr-accent-soft); }
  .chat-suggestion-text { display:flex; flex-direction:column; gap:2px; font-size:12px; min-width:0; }
  .chat-suggestion-text .label { color:var(--vsr-text); font-weight:600; }
  .chat-suggestion-text .hint { color:var(--vsr-text-muted); font-size:11px; }

  /* Mensajes */
  @keyframes msg-in { from{opacity:0;transform:translateY(5px);} to{opacity:1;transform:translateY(0);} }
  .chat-msg { display:flex; gap:13px; animation:msg-in .25s ease-out; }
  .chat-msg-avatar { width:32px; height:32px; border-radius:8px; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700; color:#fff; }
  .chat-msg.ai .chat-msg-avatar { background:linear-gradient(135deg,#7C3AED 0%,#EC4899 100%); }
  .chat-msg-body { flex:1; min-width:0; padding-top:3px; }
  .chat-msg-name { font-size:12px; font-weight:600; color:var(--vsr-text); margin-bottom:5px; display:flex; align-items:center; gap:8px; }
  .chat-msg-name .time { color:var(--vsr-text-mute2); font-size:10.5px; font-weight:400; }
  .chat-msg-text { font-size:13.5px; line-height:1.68; color:var(--vsr-text-soft); word-wrap:break-word; }
  .chat-msg-text p { margin:0 0 10px; } .chat-msg-text p:last-child { margin-bottom:0; }
  .chat-msg-text strong { color:var(--vsr-text); font-weight:600; }
  .chat-msg-text ul, .chat-msg-text ol { padding-left:22px; margin:8px 0; }
  .chat-msg-text li { margin:4px 0; }
  .chat-msg-text h1,.chat-msg-text h2,.chat-msg-text h3 { color:var(--vsr-text); font-weight:700; margin:14px 0 8px; line-height:1.3; }
  .chat-msg-text h1 { font-size:1.3em; } .chat-msg-text h2 { font-size:1.15em; } .chat-msg-text h3 { font-size:1.05em; }
  .chat-msg-text a { color:var(--vsr-accent-soft); text-decoration:underline; }
  .chat-msg-text code { background:var(--vsr-bg-input); color:var(--vsr-accent-soft); padding:2px 6px; border-radius:4px; font-family:'JetBrains Mono',monospace; font-size:12px; border:1px solid var(--vsr-border-input); }
  .chat-msg-text pre { background:var(--vsr-bg-card); border:1px solid var(--vsr-border-soft); border-radius:9px; padding:14px 16px; margin:10px 0; overflow-x:auto; font-family:'JetBrains Mono',monospace; font-size:12px; line-height:1.55; }
  .chat-msg-text pre code { background:transparent; border:none; padding:0; color:inherit; font-size:inherit; }
  .chat-msg-text table { border-collapse:collapse; margin:10px 0; font-size:12.5px; width:100%; }
  .chat-msg-text th, .chat-msg-text td { border:1px solid var(--vsr-border); padding:6px 10px; text-align:left; }
  .chat-msg-text th { background:var(--vsr-bg-card); font-weight:600; color:var(--vsr-text); }
  .chat-msg-text blockquote { border-left:3px solid var(--vsr-accent); padding-left:12px; color:var(--vsr-text-muted); margin:8px 0; }
  .chat-cursor { display:inline-block; width:7px; height:15px; background:var(--vsr-accent-soft); border-radius:1px; vertical-align:text-bottom; animation:blink 1s step-end infinite; }
  @keyframes blink { 50%{opacity:0;} }

  /* Usuario: burbuja derecha */
  .chat-msg.user { justify-content:flex-end; }
  .chat-msg.user .chat-msg-avatar, .chat-msg.user .chat-msg-name { display:none; }
  .chat-msg.user .chat-msg-body { flex:0 1 auto; max-width:78%; padding-top:0; }
  .chat-msg.user .chat-msg-text { background:var(--vsr-bg-card); border:1px solid var(--vsr-border-soft); padding:10px 14px; border-radius:13px; font-size:13px; }

  /* meta footer */
  .chat-msg-meta { display:flex; align-items:center; gap:14px; font-size:10.5px; color:var(--vsr-text-mute2); margin-top:9px; }
  .chat-msg-meta .meta-item { display:inline-flex; align-items:center; gap:5px; }
  .chat-msg-meta .dot { width:5px; height:5px; border-radius:50%; background:var(--vsr-accent-soft); }
  .chat-msg-meta .meta-actions { margin-left:auto; display:flex; gap:2px; }
  .chat-msg-meta .meta-iconbtn { width:22px; height:22px; border-radius:5px; background:transparent; border:none; cursor:pointer; color:var(--vsr-text-mute2); display:flex; align-items:center; justify-content:center; transition:.15s; }
  .chat-msg-meta .meta-iconbtn:hover { color:var(--vsr-text); background:var(--vsr-bg-hover); }

  /* typing */
  .chat-typing { display:flex; gap:5px; padding:6px 2px; }
  .chat-typing span { width:7px; height:7px; border-radius:50%; background:var(--vsr-accent-soft); animation:tblink 1.2s infinite both; }
  .chat-typing span:nth-child(2){ animation-delay:.2s; } .chat-typing span:nth-child(3){ animation-delay:.4s; }
  @keyframes tblink { 0%,80%,100%{opacity:.25;transform:translateY(0);} 40%{opacity:1;transform:translateY(-3px);} }
  .think-label { font-size:11.5px; color:var(--vsr-text-mute2); font-style:italic; padding:4px 2px; }

  /* Composer */
  .chat-composer-wrap { flex-shrink:0; padding:12px 24px 20px; background:var(--vsr-bg-base); }
  .chat-composer { max-width:760px; margin:0 auto; background:var(--vsr-bg-card); border:1px solid var(--vsr-border); border-radius:16px; padding:11px 13px 9px; transition:.15s; }
  .chat-composer:focus-within { border-color:var(--vsr-accent); box-shadow:0 0 0 3px var(--vsr-accent-tint); }
  .chat-composer-textarea { width:100%; min-height:26px; max-height:200px; background:transparent; border:none; outline:none; color:var(--vsr-text-soft); font-family:'Inter',sans-serif; font-size:13.5px; line-height:1.55; resize:none; }
  .chat-composer-textarea::placeholder { color:var(--vsr-text-mute2); }
  .chat-composer-foot { display:flex; align-items:center; justify-content:space-between; margin-top:7px; }
  .chat-hint-left { font-size:10.5px; color:var(--vsr-text-mute2); display:flex; align-items:center; gap:6px; }
  .chat-hint-left kbd { background:var(--vsr-bg-input); border:1px solid var(--vsr-border-input); padding:1px 5px; border-radius:4px; font-family:'JetBrains Mono',monospace; font-size:9.5px; color:var(--vsr-text-soft); }
  .chat-composer-send { width:34px; height:34px; border-radius:10px; background:var(--vsr-accent); color:#fff; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:.15s; }
  .chat-composer-send:hover { background:var(--vsr-accent-soft); transform:scale(1.05); }
  .chat-composer-send:disabled { opacity:.5; cursor:not-allowed; transform:none; }
  .chat-composer-send.is-stop { background:#DC2626; }

  .visor-toast { position:fixed; bottom:22px; left:50%; transform:translateX(-50%); background:#0F172A; color:#fff; border:1px solid var(--vsr-border); border-radius:10px; padding:10px 16px; font-size:12.5px; font-weight:500; box-shadow:0 14px 30px rgba(0,0,0,.4); opacity:0; pointer-events:none; transition:.2s; z-index:90; }
  .visor-toast.show { opacity:1; }
  @media (max-width:760px){ .app-rail, .chat-sidebar { display:none; } .chat-suggestions { grid-template-columns:1fr; } }
</style>
</head>

<body class="visor-body" data-theme="dark">

  <header class="visor-header">
    <div class="vsr-header-left">
      <div class="visor-logo">CS</div>
      <div class="flex flex-col leading-tight">
        <span id="headerTitle">Costsys IA</span>
        <span id="headerSubtitle">Asistente de costeo · Ollama</span>
      </div>
      <span class="conn-pill" id="connPill"><span class="conn-dot"></span> Ollama</span>
    </div>
    <div class="vsr-header-right">
      <select id="modelSelect" class="ia-model-pill" title="Modelo activo">
        <option value="">Automático (servidor)</option>
        <optgroup label="Ollama Cloud">
          <option value="glm-5.2:cloud">GLM 5.2</option>
          <option value="qwen3-coder-next:cloud">Qwen3 Coder Next</option>
          <option value="minimax-m3:cloud">MiniMax M3</option>
          <option value="deepseek-v4-pro:cloud">DeepSeek V4 Pro</option>
          <option value="kimi-k2.6:cloud">Kimi K2.6</option>
        </optgroup>
      </select>
      <button id="newChatBtn" class="cs-btn cs-btn-primary" title="Nueva conversación"><i data-lucide="plus" class="w-3.5 h-3.5"></i> Nueva</button>
      <button id="themeToggle" class="theme-toggle" title="Cambiar tema"><i data-lucide="sun" class="w-4 h-4"></i></button>
    </div>
  </header>

  <div class="cs-workspace">

    <nav class="app-rail" aria-label="Módulos">
      <a href="index.php" class="app-rail-item" title="Visor"><i data-lucide="layout-dashboard"></i><span>Visor</span></a>
      <a href="playground.php" class="app-rail-item" title="Playground"><i data-lucide="flask-conical"></i><span>Lab</span></a>
      <a href="forge.php" class="app-rail-item" title="Forge"><i data-lucide="hammer"></i><span>Forge</span></a>
      <a href="chat.php" class="app-rail-item" title="Chat con Agentes"><i data-lucide="message-circle"></i><span>Chat</span></a>
      <a href="costsys-ia.php" class="app-rail-item active" title="Costsys IA"><i data-lucide="sparkles"></i><span>Costsys</span></a>
    </nav>

    <aside class="chat-sidebar">
      <div class="chat-sidebar-head">
        <input id="convSearch" type="text" class="cs-input" placeholder="Buscar conversaciones…">
        <button id="newChatSidebar" class="cs-btn cs-btn-outline" title="Nueva"><i data-lucide="plus" class="w-3.5 h-3.5"></i></button>
      </div>
      <div class="chat-sidebar-body" id="convList"></div>
    </aside>

    <main class="chat-main">
      <div class="chat-stream" id="chatStream"></div>

      <div class="chat-composer-wrap">
        <div class="chat-composer">
          <textarea id="chatInput" class="chat-composer-textarea" rows="1" placeholder="Pregunta sobre costos, márgenes, % de costo, precios…"></textarea>
          <div class="chat-composer-foot">
            <span class="chat-hint-left"><kbd>Enter</kbd> enviar · <kbd>Shift</kbd>+<kbd>Enter</kbd> línea · <span id="modelHint">modelo del servidor</span></span>
            <button id="sendBtn" class="chat-composer-send" title="Enviar"><i data-lucide="arrow-up" class="w-4 h-4"></i></button>
          </div>
        </div>
      </div>
    </main>
  </div>

  <div id="toast" class="visor-toast"></div>

<script>
(function(){
  'use strict';

  const API = 'ctrl/ctrl-coffeeia-stream.php';
  const LS_KEY = 'costsys_ia_convos';

  // "Alma" del asistente: se manda como systemOverride en cada request.
  const SYSTEM_PROMPT = [
    'Eres **Costsys IA**, el asistente de costeo del ERP de Grupo Varoch (módulo Costsys).',
    'Ayudas a gerentes y capturistas a tomar decisiones sobre costos, precios y márgenes de recetas de restaurante.',
    '',
    'DOMINIO:',
    '- Jerarquía: Ingredientes → Subrecetas → Recetas (producto terminado) → tablero de Costo Potencial.',
    '- Fórmulas clave (úsalas siempre que te den números):',
    '  • Precio sin IVA = precio / (1 + IVA/100). IVA por defecto 8%.',
    '  • Margen de Contribución (MC) = Precio sin IVA − Costo.',
    '  • % de Costo = (Costo / Precio sin IVA) × 100.',
    '  • Costo unitario = Costo total de materiales / Rendimiento.',
    '- Umbral sano de % de costo: 35%. Objetivo de ajuste para cortes de carne (caros): ~45%.',
    '  Un % de costo alto significa margen erosionado.',
    '- Unidades de negocio: Sonoras Meat, Fogaza, Baos, Punto Modelo, Quinta Tabachines.',
    '- El Costo Potencial usa snapshots mensuales, precio propuesto e indicadores de color',
    '  (verde = sano, ámbar = vigilar, rojo = fuera de rango).',
    '',
    'CÓMO RESPONDES:',
    '- En español, claro y directo, en formato Markdown (listas, negritas, tablas cuando aporten).',
    '- Orientado a decisiones: no solo describas, recomienda (qué precio subir, qué margen proteger).',
    '- Si te dan cifras, haz el cálculo con las fórmulas de arriba y muestra el resultado.',
    '- Si falta un dato para calcular, pídelo en una línea.',
    '- Sé conciso; evita relleno.'
  ].join('\n');

  const SUGGESTIONS = [
    { icon:'calculator',   label:'Calcular % de costo',        hint:'Con la fórmula del ERP',        text:'¿Cómo calculo el % de costo de una receta y cuándo se considera sano?' },
    { icon:'beef',         label:'¿Mi arrachera está sana?',   hint:'Costo $374 · precio $750',      text:'Mi arrachera cuesta $374 y la vendo a $750 con IVA 8%. ¿Cuál es su % de costo y su margen? ¿Está sana?' },
    { icon:'trending-up',  label:'Bajar % de costo',           hint:'Ideas para mis cortes',         text:'Dame estrategias concretas para bajar el % de costo de mis cortes de carne sin perder clientes.' },
    { icon:'help-circle',  label:'¿Qué es el MC?',             hint:'Margen de contribución',        text:'Explícame qué es el margen de contribución y por qué importa más que el precio de venta.' },
  ];

  if (window.marked) marked.setOptions({ breaks:true, gfm:true });
  const mdToSafeHtml = (t) => {
    let html = window.marked ? marked.parse(t || '') : (t || '').replace(/\n/g,'<br>');
    return window.DOMPurify ? DOMPurify.sanitize(html) : html;
  };
  const esc = (s) => (s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const nowTime = () => new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});

  /* ---------- estado ---------- */
  let convos = [];          // [{id, title, ts, history:[{role,content,ts,meta?}]}]
  let currentId = null;
  let busy = false;
  let abortCtrl = null;

  const $stream = document.getElementById('chatStream');
  const $convList = document.getElementById('convList');
  const $input = document.getElementById('chatInput');
  const $sendBtn = document.getElementById('sendBtn');
  const $modelSelect = document.getElementById('modelSelect');
  const $modelHint = document.getElementById('modelHint');
  const $toast = document.getElementById('toast');

  const load = () => { try { convos = JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch(_){ convos = []; } };
  const save = () => { try { localStorage.setItem(LS_KEY, JSON.stringify(convos.slice(0,60))); } catch(_){} };
  const current = () => convos.find(c => c.id === currentId);

  function toast(msg){ $toast.textContent = msg; $toast.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(()=>$toast.classList.remove('show'), 2200); }

  /* ---------- conversaciones ---------- */
  function newConvo(){
    currentId = null;         // se materializa al enviar el primer mensaje
    renderConvList();
    renderStream();
    $input.focus();
  }
  function ensureConvo(firstMsg){
    if (currentId && current()) return current();
    const c = { id:'c'+Date.now().toString(36), title:(firstMsg||'Nueva conversación').slice(0,48), ts:Date.now(), history:[] };
    convos.unshift(c);
    currentId = c.id;
    return c;
  }
  function deleteConvo(id, ev){
    ev && ev.stopPropagation();
    convos = convos.filter(c => c.id !== id);
    if (currentId === id) currentId = null;
    save(); renderConvList(); renderStream();
  }
  function selectConvo(id){ currentId = id; renderConvList(); renderStream(); }

  function renderConvList(){
    const q = (document.getElementById('convSearch').value || '').toLowerCase();
    const list = convos.filter(c => !q || c.title.toLowerCase().includes(q));
    if (!list.length){ $convList.innerHTML = '<div class="sidebar-empty"><i data-lucide="message-square-dashed" class="w-7 h-7" style="opacity:.5;"></i><div style="margin-top:8px;">Sin conversaciones aún.<br>Inicia una nueva.</div></div>'; lucide.createIcons(); return; }
    $convList.innerHTML = list.map(c => `
      <div class="conv-item ${c.id===currentId?'active':''}" data-id="${c.id}">
        <i data-lucide="message-circle" class="lead"></i>
        <span class="conv-title">${esc(c.title)}</span>
        <button class="conv-del" data-del="${c.id}" title="Eliminar"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
      </div>`).join('');
    lucide.createIcons();
    $convList.querySelectorAll('.conv-item').forEach(el => el.addEventListener('click', () => selectConvo(el.dataset.id)));
    $convList.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', (e) => deleteConvo(b.dataset.del, e)));
  }

  /* ---------- render del stream ---------- */
  function welcomeHtml(){
    return `<div class="chat-welcome">
      <div class="chat-welcome-icon"><i data-lucide="sparkles" class="w-7 h-7"></i></div>
      <div class="chat-welcome-title">Costsys IA</div>
      <div class="chat-welcome-sub">Tu copiloto de costeo sobre <strong>Ollama</strong>. Pregunta sobre % de costo, margen de contribución, precios y decisiones del Costo Potencial.</div>
      <div class="chat-suggestions">
        ${SUGGESTIONS.map((s,i)=>`<button class="chat-suggestion" data-sg="${i}">
          <div class="chat-suggestion-icon"><i data-lucide="${s.icon}" class="w-4 h-4"></i></div>
          <div class="chat-suggestion-text"><span class="label">${s.label}</span><span class="hint">${s.hint}</span></div>
        </button>`).join('')}
      </div>
    </div>`;
  }
  function msgHtml(m){
    if (m.role === 'user'){
      return `<div class="chat-msg user"><div class="chat-msg-body"><div class="chat-msg-text">${mdToSafeHtml(m.content)}</div></div></div>`;
    }
    const meta = m.meta ? `<div class="chat-msg-meta">
        ${m.meta.model?`<span class="meta-item"><span class="dot"></span>${esc(m.meta.model)}</span>`:''}
        ${m.meta.tokens_used?`<span class="meta-item">${m.meta.tokens_used} tokens</span>`:''}
        ${m.meta.elapsed_ms?`<span class="meta-item">${(m.meta.elapsed_ms/1000).toFixed(1)}s</span>`:''}
        <span class="meta-actions"><button class="meta-iconbtn" data-copy title="Copiar"><i data-lucide="copy" class="w-3 h-3"></i></button></span>
      </div>` : '';
    return `<div class="chat-msg ai">
      <div class="chat-msg-avatar">IA</div>
      <div class="chat-msg-body">
        <div class="chat-msg-name">Costsys IA <span class="time">${m.ts?new Date(m.ts).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}):''}</span></div>
        <div class="chat-msg-text">${mdToSafeHtml(m.content)}</div>
        ${meta}
      </div>
    </div>`;
  }
  function renderStream(){
    const c = current();
    if (!c || !c.history.length){
      $stream.innerHTML = welcomeHtml();
      lucide.createIcons();
      $stream.querySelectorAll('.chat-suggestion').forEach(b => b.addEventListener('click', () => send(SUGGESTIONS[+b.dataset.sg].text)));
      return;
    }
    $stream.innerHTML = `<div class="chat-container">${c.history.map(msgHtml).join('')}</div>`;
    hydrate();
    scrollBottom();
  }
  function hydrate(){
    lucide.createIcons();
    if (window.hljs) $stream.querySelectorAll('pre code').forEach(el => { try { hljs.highlightElement(el); } catch(_){} });
    $stream.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', () => {
      const txt = b.closest('.chat-msg-body').querySelector('.chat-msg-text').innerText;
      navigator.clipboard.writeText(txt).then(()=>toast('Copiado al portapapeles'));
    }));
  }
  function scrollBottom(){ $stream.scrollTop = $stream.scrollHeight; }

  /* ---------- envío + streaming SSE ---------- */
  async function send(forcedText){
    if (busy) return;
    const text = (forcedText != null ? forcedText : $input.value).trim();
    if (!text) return;
    $input.value = ''; autoGrow();

    const c = ensureConvo(text);
    if (c.history.length === 0) c.title = text.slice(0,48);
    c.history.push({ role:'user', content:text, ts:Date.now() });
    renderConvList();
    renderStream();
    setBusy(true);

    // contenedor del mensaje AI en progreso
    const container = $stream.querySelector('.chat-container') || (function(){ $stream.innerHTML='<div class="chat-container"></div>'; return $stream.querySelector('.chat-container'); })();
    const wrap = document.createElement('div');
    wrap.className = 'chat-msg ai';
    wrap.innerHTML = `<div class="chat-msg-avatar">IA</div><div class="chat-msg-body"><div class="chat-msg-name">Costsys IA</div><div class="chat-msg-text"><div class="chat-typing"><span></span><span></span><span></span></div></div></div>`;
    container.appendChild(wrap);
    lucide.createIcons();
    scrollBottom();
    const $txt = wrap.querySelector('.chat-msg-text');

    let received = '', meta = null, streamErr = null, firstToken = false;
    abortCtrl = new AbortController();

    try {
      const payload = {
        messages: c.history.map(m => ({ role:m.role, content:m.content || '' })),
        systemOverride: SYSTEM_PROMPT,
        model: $modelSelect.value || '',
        canvasMode: false, graphMode:'', currentFile:'', currentFileContent:''
      };
      const res = await fetch(API, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload), signal:abortCtrl.signal });
      if (!res.ok || !res.body) throw new Error('HTTP ' + res.status);

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      while (true){
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream:true });
        let idx;
        while ((idx = buf.indexOf('\n\n')) !== -1){
          const rawEvent = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          let ev = 'message', dataStr = '';
          rawEvent.split('\n').forEach(l => {
            if (l.startsWith('event:')) ev = l.slice(6).trim();
            else if (l.startsWith('data:')) dataStr += l.slice(5).trim();
          });
          let obj = {};
          try { obj = dataStr ? JSON.parse(dataStr) : {}; } catch(_){ continue; }
          if (ev === 'thinking'){
            if (!firstToken) $txt.innerHTML = `<div class="think-label">Razonando…</div><div class="chat-typing"><span></span><span></span><span></span></div>`;
          } else if (ev === 'chunk'){
            if (!firstToken){ firstToken = true; }
            received += obj.t || '';
            $txt.innerHTML = mdToSafeHtml(received) + '<span class="chat-cursor"></span>';
            scrollBottom();
          } else if (ev === 'done'){
            meta = obj;
          } else if (ev === 'error'){
            streamErr = obj.error;
          }
        }
      }
    } catch(err){
      if (err && err.name === 'AbortError'){
        received = received ? received + '\n\n_[generación detenida]_' : '⏹ Generación detenida.';
      } else {
        streamErr = streamErr || (err && err.message) || 'Error de red';
      }
    }

    if (streamErr && !received){
      received = '⚠️ ' + streamErr + '\n\n_Revisa que Apache/WAMP tenga salida a `OLLAMA_BASE_URL` y que la API key en `credentials/.env` sea válida._';
    }
    c.history.push({ role:'assistant', content:received, ts:Date.now(), meta:meta });
    save();
    setBusy(false);
    abortCtrl = null;
    renderStream();
  }

  function setBusy(v){
    busy = v;
    const icon = v ? 'square' : 'arrow-up';
    $sendBtn.innerHTML = `<i data-lucide="${icon}" class="w-4 h-4"></i>`;
    $sendBtn.classList.toggle('is-stop', v);
    $sendBtn.title = v ? 'Detener' : 'Enviar';
    lucide.createIcons();
  }

  /* ---------- input ---------- */
  function autoGrow(){ $input.style.height='auto'; $input.style.height = Math.min(200, $input.scrollHeight) + 'px'; }
  $input.addEventListener('input', autoGrow);
  $input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); busy ? null : send(); }
  });
  $sendBtn.addEventListener('click', () => { if (busy){ abortCtrl && abortCtrl.abort(); } else { send(); } });

  document.getElementById('newChatBtn').addEventListener('click', newConvo);
  document.getElementById('newChatSidebar').addEventListener('click', newConvo);
  document.getElementById('convSearch').addEventListener('input', renderConvList);
  $modelSelect.addEventListener('change', () => {
    const label = $modelSelect.options[$modelSelect.selectedIndex].text;
    $modelHint.textContent = $modelSelect.value ? label : 'modelo del servidor';
  });

  document.getElementById('themeToggle').addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    document.body.setAttribute('data-theme', next);
    document.getElementById('themeToggle').innerHTML = `<i data-lucide="${next==='dark'?'sun':'moon'}" class="w-4 h-4"></i>`;
    lucide.createIcons();
    try { localStorage.setItem('costsys_ia_theme', next); } catch(_){}
  });

  /* ---------- init ---------- */
  (function init(){
    const savedTheme = (function(){ try { return localStorage.getItem('costsys_ia_theme'); } catch(_){ return null; } })();
    if (savedTheme){ document.documentElement.setAttribute('data-theme', savedTheme); document.body.setAttribute('data-theme', savedTheme); document.getElementById('themeToggle').innerHTML = `<i data-lucide="${savedTheme==='dark'?'sun':'moon'}" class="w-4 h-4"></i>`; }
    load();
    currentId = convos.length ? convos[0].id : null;
    renderConvList();
    renderStream();
    lucide.createIcons();
    $input.focus();
  })();
})();
</script>
</body>
</html>
