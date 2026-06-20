<!DOCTYPE html>
<html lang="es" data-theme="dark">
<head>
<meta charset="UTF-8">
<script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/dompurify@3.0.6/dist/purify.min.js"></script>
<script>window.lucide = { createIcons(){} };</script>
</head>
<body>
<!-- skeleton mínimo con los IDs que toca el camino de carga -->
<span id="pgChatAgentName"></span><i id="pgChatAgentIcon"></i><span id="pgKnowAgentName"></span>
<select id="pgAgentSelect"></select><select id="pgThemeSelect"></select>
<span id="pgSandboxTheme"></span><span id="pgZoomLabel"></span><span id="pgKnowledgeCount"></span>
<textarea id="pgPromptEditor"></textarea><span id="pgPromptPath"></span>
<button id="pgThreadChip"><span id="pgThreadName"></span><span id="pgThreadState"></span></button>
<div class="ia-input-wrap"></div>
<div id="pgChatBody"></div>
<div class="pg-sandbox-body"><iframe id="pgSandboxFrame"></iframe><pre id="pgSandboxCode"><code></code></pre></div>
<div id="pgSandboxEmpty"></div>
<div class="pg-viewport"></div>
<pre id="RESULT">pending</pre>

<script src="src/js/playground.js"></script>
<script>
window.addEventListener('load', () => {
  setTimeout(async () => {
    const out = document.getElementById('RESULT');
    try {
      const r = await fetch('ctrl/ctrl-visor.php?action=listtemplates', {cache:'no-store'});
      const d = await r.json();
      const tpl = (d.templates||[]).find(t => Array.isArray(t.history) && t.history.length) || d.templates[0];
      out.textContent = 'CHOSEN slug=' + (tpl&&tpl.slug) + ' historyLen=' + (tpl&&tpl.history?tpl.history.length:'NA') + '\n';
      pgLoadSavedTemplate(tpl);
      const msgs = document.querySelectorAll('#pgChatBody .ia-msg').length;
      const users = document.querySelectorAll('#pgChatBody .ia-msg.user').length;
      const ais = document.querySelectorAll('#pgChatBody .ia-msg.ai').length;
      out.textContent += 'RENDERED msgs=' + msgs + ' user=' + users + ' ai=' + ais + '\n';
      out.textContent += 'EMPTY_PRESENT=' + (document.querySelector('#pgChatBody .pg-empty')?'YES':'no');
    } catch (e) {
      out.textContent = 'ERROR: ' + (e && e.message) + '\n' + (e && e.stack);
    }
  }, 2000);
});
window.addEventListener('error', e => {
  const out = document.getElementById('RESULT');
  if (out) out.textContent = 'WINDOW_ERROR: ' + e.message + ' @ ' + e.filename + ':' + e.lineno;
});
</script>
</body>
</html>
