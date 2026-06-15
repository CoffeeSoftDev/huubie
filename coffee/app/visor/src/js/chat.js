/* ============================================================
   chat.js — Modulo Chat estilo OpenAI en el Visor
   Reusa el endpoint SSE ctrl-coffeeia-stream.php y el backend
   de documentos ctrl-visor.php para persistir conversaciones.
   ============================================================ */

const CHAT_API_STREAM = 'ctrl/ctrl-coffeeia-stream.php';
const CHAT_API_DOCS   = 'ctrl/ctrl-visor.php';

const CHAT_AGENTS = {
    'CoffeeIA.md':            { key: 'CoffeeIA.md',            label: 'CoffeeIA',          icon: 'sparkles',      slug: 'CoffeeIA' },
    'CoffeeMagic.md':         { key: 'CoffeeMagic.md',         label: 'CoffeeMagic',       icon: 'wand-sparkles', slug: 'CoffeeMagic' },
    'coffee-intelligence.md': { key: 'coffee-intelligence.md', label: 'CoffeeIntelligence', icon: 'database',     slug: 'coffee-intelligence' }
};
const CHAT_DEFAULT_AGENT = 'CoffeeIA.md';

const CHAT_MODEL_OPTIONS = [
    { group: 'Ollama Cloud', options: [
        { value: 'qwen3-coder:480b-cloud', label: 'Qwen3 Coder 480B (cloud)' },
        { value: 'qwen3-vl:235b-cloud',     label: 'Qwen3 VL 235B (vision)' },
        { value: 'deepseek-v3.1:671b-cloud', label: 'DeepSeek V3.1 671B' }
    ]},
    { group: 'OpenRouter (free)', options: [
        { value: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B (free)' },
        { value: 'google/gemini-2.0-flash-exp:free',       label: 'Gemini 2.0 Flash (free)' },
        { value: 'qwen/qwen-2.5-72b-instruct:free',       label: 'Qwen 2.5 72B (free)' }
    ]},
    { group: 'OpenRouter (de pago)', options: [
        { value: 'anthropic/claude-sonnet-4',  label: 'Claude Sonnet 4' },
        { value: 'anthropic/claude-opus-4.8',  label: 'Claude Opus 4.8' },
        { value: 'openai/gpt-4o',              label: 'GPT-4o' },
        { value: 'openai/gpt-4o-mini',         label: 'GPT-4o mini' },
        { value: 'google/gemini-2.0-flash-001', label: 'Gemini 2.0 Flash' }
    ]}
];

const chat = {
    agentKey:      CHAT_DEFAULT_AGENT,
    model:         '',
    systemOverride: '',
    uiTheme:       'dark',
    history:       [],
    pendingImages: [],
    pendingDocs:   [],
    isBusy:        false,
    _abort:        null,
    conversations: [],
    currentFile:   null,
    currentTitle:  'Nueva conversacion',
    dirty:         false,
    _popSound:     null
};

/* ---------- Bootstrap ---------- */
$(async () => {
    chatLoadSettings();
    chatApplyUiTheme(chat.uiTheme);
    chatPopulateAgentSelect();
    chatPopulateModelSelect();
    chatBind();
    chatRenderMain();
    await chatLoadConversations();
    chatApplyAgent(chat.agentKey, true);
    if (window.lucide) lucide.createIcons();
});

/* ---------- Settings ---------- */
function chatLoadSettings() {
    try {
        const s = JSON.parse(localStorage.getItem('chat:settings:v1') || '{}');
        chat.agentKey = s.agentKey || CHAT_DEFAULT_AGENT;
        chat.model    = s.model || '';
        chat.uiTheme  = s.uiTheme || 'dark';
    } catch (_) { /* noop */ }
}

function chatSaveSettings() {
    localStorage.setItem('chat:settings:v1', JSON.stringify({
        agentKey: chat.agentKey,
        model: chat.model,
        uiTheme: chat.uiTheme
    }));
}

function chatApplyUiTheme(theme) {
    chat.uiTheme = theme;
    document.body.setAttribute('data-theme', theme);
    const $icon = $('#chatThemeToggle i');
    if ($icon.length) {
        $icon.attr('data-lucide', theme === 'dark' ? 'sun' : 'moon');
        if (window.lucide) lucide.createIcons();
    }
    chatSaveSettings();
}

/* ---------- Populate selects ---------- */
function chatPopulateAgentSelect() {
    const $sel = $('#chatAgentSelect');
    $sel.empty();
    Object.values(CHAT_AGENTS).forEach(a => {
        $sel.append(`<option value="${a.key}">${a.label}</option>`);
    });
    $sel.val(chat.agentKey);
}

function chatPopulateModelSelect() {
    const $sel = $('#chatModelSelect');
    $sel.empty();
    $sel.append('<option value="">— Default del proveedor —</option>');
    CHAT_MODEL_OPTIONS.forEach(g => {
        const $grp = $(`<optgroup label="${g.group}"></optgroup>`);
        g.options.forEach(o => {
            $grp.append(`<option value="${o.value}">${o.label}</option>`);
        });
        $sel.append($grp);
    });
    $sel.val(chat.model || '');
}

/* ---------- Bindings ---------- */
function chatBind() {
    $('#chatAgentSelect').on('change', e => chatApplyAgent(e.target.value, false));
    $('#chatModelSelect').on('change', e => { chat.model = e.target.value || ''; chatSaveSettings(); });
    $('#chatThemeToggle').on('click', () => chatApplyUiTheme(chat.uiTheme === 'dark' ? 'light' : 'dark'));

    $('#chatNewBtn, #chatNewSidebarBtn').on('click', () => chatNewConversation());

    $('#chatSendBtn').on('click', () => {
        if (chat.isBusy) chatStop();
        else chatSubmit();
    });

    $('#chatInput').on('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
            e.preventDefault();
            if (!chat.isBusy) chatSubmit();
        }
    }).on('input', function () {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 180) + 'px';
    });

    $('#chatRenameBtn').on('click', () => chatOpenRenameModal());
    $('#chatSaveBtn').on('click', () => chatSaveConversation());
    $('#chatDownloadBtn').on('click', () => chatDownloadConversation());
    $('#chatDeleteBtn').on('click', () => chatOpenDeleteModal());

    $('#chatRenameSave').on('click', () => chatApplyRename());
    $('#chatRenameCancel, #chatRenameBackdrop').on('click', () => chatCloseRenameModal());
    $('#chatDeleteConfirm').on('click', () => chatApplyDelete());
    $('#chatDeleteCancel, #chatDeleteBackdrop').on('click', () => chatCloseDeleteModal());

    $('#chatRenameInput').on('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); chatApplyRename(); }
    });

    chatBindAttachments();
}

function chatApplyAgent(key, silent) {
    if (!CHAT_AGENTS[key]) return;
    chat.agentKey = key;
    if (!silent) {
        $('#chatAgentSelect').val(key);
        chatSaveSettings();
    }
}

function chatBindAttachments() {
    $('#chatAttachBtn').on('click', () => $('#chatFileInput').trigger('click'));
    $('#chatFileInput').on('change', e => {
        Array.from(e.target.files || []).forEach(f => chatAddFile(f));
        e.target.value = '';
    });
    $(document).on('paste', e => {
        if (e.target && (e.target.id === 'chatRenameInput' || e.target.id === 'chatInput')) return;
        const cd = e.originalEvent && e.originalEvent.clipboardData;
        if (!cd || !cd.items) return;
        let pasted = 0;
        for (const it of cd.items) {
            if (it.kind !== 'file') continue;
            const f = it.getAsFile();
            if (f) { chatAddFile(f); pasted++; }
        }
        if (pasted > 0) {
            e.preventDefault();
            chatToast(pasted === 1 ? 'Adjunto pegado' : pasted + ' adjuntos pegados', 'success');
        }
    });
    const $wrap = $('.ia-input-wrap');
    $wrap.on('dragover', e => { e.preventDefault(); $wrap.addClass('is-drag-over'); });
    $wrap.on('dragleave drop', () => $wrap.removeClass('is-drag-over'));
    $wrap.on('drop', e => {
        e.preventDefault();
        const dt = e.originalEvent && e.originalEvent.dataTransfer;
        if (!dt || !dt.files) return;
        Array.from(dt.files).forEach(f => chatAddFile(f));
    });
}

function chatAddFile(file) {
    if (file.size > 8 * 1024 * 1024) {
        chatToast('Archivo demasiado grande (>8MB)', 'error');
        return;
    }
    if (/^image\//.test(file.type)) {
        const reader = new FileReader();
        reader.onload = ev => {
            chat.pendingImages.push({ name: file.name, dataurl: ev.target.result });
            chatRenderAttachments();
        };
        reader.readAsDataURL(file);
    } else {
        const reader = new FileReader();
        reader.onload = ev => {
            chat.pendingDocs.push({ name: file.name, text: ev.target.result });
            chatRenderAttachments();
        };
        reader.readAsText(file);
    }
}

function chatRenderAttachments() {
    const $strip = $('#chatImageStrip');
    $strip.empty();
    const all = [
        ...chat.pendingImages.map(i => Object.assign({}, i, { kind: 'image' })),
        ...chat.pendingDocs.map(d => Object.assign({}, d, { kind: 'doc' }))
    ];
    all.forEach((item, idx) => {
        const $chip = $('<div>').addClass('ia-img-chip');
        if (item.kind === 'image') {
            $chip.html(`<img src="${item.dataurl}" alt=""><span>${chatEscape(item.name)}</span><i data-lucide="x" class="cursor-pointer"></i>`);
        } else {
            $chip.html(`<i data-lucide="file-text" class="w-3.5 h-3.5"></i><span>${chatEscape(item.name)}</span><i data-lucide="x" class="cursor-pointer"></i>`);
        }
        $chip.find('i[data-lucide="x"]').on('click', () => {
            if (item.kind === 'image') {
                chat.pendingImages.splice(idx, 1);
            } else {
                chat.pendingDocs.splice(idx - chat.pendingImages.length, 1);
            }
            chatRenderAttachments();
        });
        $strip.append($chip);
    });
    $strip.toggle(all.length > 0);
    if (window.lucide) lucide.createIcons();
    const n = all.length;
    $('#chatContextInfo').text(n === 0 ? '' : (n + ' adjunto' + (n === 1 ? '' : 's')));
}

function chatDocsToContextString() {
    return chat.pendingDocs.map(d => `\n\n--- ${d.name} ---\n${d.text}`).join('');
}

/* ---------- Conversations list ---------- */
async function chatLoadConversations() {
    try {
        const res = await fetch(`${CHAT_API_DOCS}?folder=documents`);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        const all = chatFlattenTree(data.tree || []);
        chat.conversations = all
            .filter(n => n.rel && n.rel.indexOf('Chats/') === 0 && n.rel.endsWith('.md'))
            .map(n => chatParseConversationMeta(n));
        chatRenderSidebar();
    } catch (err) {
        console.error('chatLoadConversations:', err);
        chat.conversations = [];
        chatRenderSidebar();
    }
}

function chatFlattenTree(nodes, parentRel) {
    const out = [];
    (nodes || []).forEach(n => {
        const rel = parentRel ? parentRel + '/' + (n.name || n.path || '') : (n.rel || n.path || n.name || '');
        out.push(Object.assign({}, n, { rel: rel }));
        if (n.children && n.children.length) {
            out.push.apply(out, chatFlattenTree(n.children, rel));
        }
    });
    return out;
}

function chatParseConversationMeta(node) {
    const rel = node.rel || '';
    const parts = rel.split('/').filter(Boolean);
    const agentDir = parts[1] || '';
    const file = parts.slice(2).join('/') || (node.name || '');
    const title = (node.name || file || '').replace(/\.md$/i, '');
    return {
        file: file,
        fullPath: node.fullPath || rel,
        rel: rel,
        title: title,
        agentDir: agentDir,
        agentKey: Object.values(CHAT_AGENTS).find(a => a.slug === agentDir)?.key || CHAT_DEFAULT_AGENT,
        mtime: node.mtime || node.date || node.modified || new Date().toISOString(),
        size: node.size || 0,
        raw: node.raw || ''
    };
}

function chatRenderSidebar() {
    const groups = { today: [], yesterday: [], week: [], older: [] };
    const now = Date.now();
    chat.conversations.forEach(c => {
        const t = new Date(c.mtime).getTime();
        if (isNaN(t)) { groups.older.push(c); return; }
        const diffDays = Math.floor((now - t) / 86400000);
        if (diffDays === 0) groups.today.push(c);
        else if (diffDays === 1) groups.yesterday.push(c);
        else if (diffDays < 7) groups.week.push(c);
        else groups.older.push(c);
    });
    ['today', 'yesterday', 'week', 'older'].forEach(g => chatRenderGroup(g, groups[g]));
}

function chatRenderGroup(groupKey, items) {
    const $wrap = $(`.chat-sidebar-group[data-group="${groupKey}"]`);
    const $ul = $wrap.find('ul');
    $ul.empty();
    if (!items.length) { $wrap.hide(); return; }
    $wrap.show();
    items.sort((a, b) => new Date(b.mtime) - new Date(a.mtime));
    items.forEach(c => {
        const active = c.fullPath === chat.currentFile ? ' active' : '';
        const $li = $(`
            <li class="chat-sidebar-item${active}" data-path="${chatEscape(c.fullPath)}" title="${chatEscape(c.title)}">
                <i data-lucide="message-circle" class="w-3.5 h-3.5"></i>
                <span class="item-title">${chatEscape(c.title)}</span>
                <span class="item-meta">${chatRelativeTime(c.mtime)}</span>
            </li>
        `);
        $li.on('click', () => chatOpenConversation(c.fullPath));
        $ul.append($li);
    });
    if (window.lucide) lucide.createIcons();
}

/* ---------- New / Open / Save / Delete / Rename ---------- */
function chatNewConversation() {
    if (chat.dirty) {
        if (!confirm('Tienes cambios sin guardar. ¿Descartar y empezar una nueva conversacion?')) return;
    }
    chat.history = [];
    chat.currentFile = null;
    chat.currentTitle = 'Nueva conversacion';
    chat.dirty = false;
    chat.pendingImages = [];
    chat.pendingDocs = [];
    chatRenderAttachments();
    chatRenderMain();
    chatRenderSidebar();
    $('#chatInput').focus();
}

async function chatOpenConversation(fullPath) {
    if (chat.dirty && chat.currentFile !== fullPath) {
        if (!confirm('Tienes cambios sin guardar. ¿Descartarlos y abrir esta conversacion?')) return;
    }
    const conv = chat.conversations.find(c => c.fullPath === fullPath);
    let raw = conv ? conv.raw : '';
    if (!raw) {
        try {
            const res = await fetch(`${CHAT_API_DOCS}?action=read&fullPath=${encodeURIComponent(fullPath)}`);
            const data = await res.json();
            if (!data.success) { chatToast('No se pudo abrir: ' + (data.message || ''), 'error'); return; }
            raw = data.content || '';
        } catch (err) {
            console.error(err);
            chatToast('Error al abrir la conversacion', 'error');
            return;
        }
    }
    const { frontmatter, body } = chatParseFrontmatter(raw);
    chat.history = chatParseHistoryFromBody(body);
    chat.currentFile = fullPath;
    chat.currentTitle = frontmatter.name || 'Conversacion';
    chat.agentKey = Object.values(CHAT_AGENTS).find(a => a.slug === (frontmatter.agent_dir || ''))?.key || frontmatter.agent || chat.agentKey;
    chat.model = frontmatter.model && frontmatter.model !== 'default' ? frontmatter.model : '';
    chat.dirty = false;
    chatRenderMain();
    chatRenderSidebar();
    chatApplyAgent(chat.agentKey, true);
    $('#chatModelSelect').val(chat.model);
    $('#chatInput').focus();
}

async function chatSaveConversation() {
    if (!chat.history.length) {
        chatToast('Conversacion vacia, nada que guardar', 'info');
        return;
    }
    if (chat.currentTitle === 'Nueva conversacion' || !chat.currentTitle.trim()) {
        chat.currentTitle = (chat.history[0].content || 'Conversacion').slice(0, 50).trim() || 'Conversacion';
    }
    const stamp = chatStamp();
    const agentDef = CHAT_AGENTS[chat.agentKey] || CHAT_AGENTS[CHAT_DEFAULT_AGENT];
    const slug = chatSlugify(chat.currentTitle) || agentDef.slug.toLowerCase();
    const filename = `${stamp}-${slug}.md`;
    const fullPath = `coffee/app/visor/documents/Chats/${agentDef.slug}/${filename}`;
    const content = chatSerializeToMd();

    const form = new FormData();
    form.append('action', 'save');
    form.append('fullPath', fullPath);
    form.append('content', content);

    try {
        const res = await fetch(CHAT_API_DOCS, { method: 'POST', body: form });
        const data = await res.json();
        if (!data.success) {
            chatToast('Error al guardar: ' + (data.message || ''), 'error');
            return;
        }
        chat.currentFile = fullPath;
        chat.dirty = false;
        await chatLoadConversations();
        chatToast('Conversacion guardada', 'success');
    } catch (err) {
        console.error(err);
        chatToast('Error de red al guardar', 'error');
    }
}

function chatDownloadConversation() {
    if (!chat.history.length) { chatToast('Nada que descargar', 'info'); return; }
    const md = chatSerializeToMd();
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${chatSlugify(chat.currentTitle) || 'conversacion'}.md`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
}

function chatOpenDeleteModal() {
    if (!chat.currentFile) { chatToast('Esta conversacion aun no esta guardada', 'info'); return; }
    $('#chatDeleteText').text('Vas a eliminar "' + chat.currentTitle + '". Esta accion no se puede deshacer.');
    $('#chatDeleteModal').removeClass('hidden');
}

function chatCloseDeleteModal() { $('#chatDeleteModal').addClass('hidden'); }

async function chatApplyDelete() {
    if (!chat.currentFile) return;
    const form = new FormData();
    form.append('action', 'delete');
    form.append('fullPath', chat.currentFile);
    try {
        const res = await fetch(CHAT_API_DOCS, { method: 'POST', body: form });
        const data = await res.json();
        if (!data.success) { chatToast('Error al eliminar: ' + (data.message || ''), 'error'); return; }
        chatToast('Conversacion eliminada', 'success');
        chatNewConversation();
        await chatLoadConversations();
        chatCloseDeleteModal();
    } catch (err) {
        console.error(err);
        chatToast('Error de red al eliminar', 'error');
    }
}

function chatOpenRenameModal() {
    $('#chatRenameInput').val(chat.currentTitle);
    $('#chatRenameModal').removeClass('hidden');
    setTimeout(() => $('#chatRenameInput').trigger('focus').select(), 50);
}

function chatCloseRenameModal() { $('#chatRenameModal').addClass('hidden'); }

function chatApplyRename() {
    const newTitle = $('#chatRenameInput').val().trim();
    if (!newTitle) { chatToast('El titulo no puede estar vacio', 'error'); return; }
    chat.currentTitle = newTitle;
    chat.dirty = true;
    $('#chatCurrentTitle').text(chat.currentTitle);
    chatCloseRenameModal();
    chatToast('Titulo actualizado (guarda para persistir)', 'info');
}

/* ---------- Serialize / parse markdown ---------- */
function chatSerializeToMd() {
    const fmLines = [
        '---',
        `name: ${chat.currentTitle}`,
        `description: ${(chat.history[0]?.content || '').slice(0, 120).replace(/\n/g, ' ')}`,
        `date: ${new Date().toISOString().slice(0, 10)}`,
        `agent: ${chat.agentKey}`,
        `agent_dir: ${CHAT_AGENTS[chat.agentKey]?.slug || 'CoffeeIA'}`,
        `model: ${chat.model || 'default'}`,
        `messages: ${chat.history.length}`,
        '---',
        ''
    ];
    const blocks = chat.history.map(m => {
        const ts = new Date(m.ts || Date.now()).toISOString();
        const role = m.role === 'user' ? 'Tu' : (CHAT_AGENTS[chat.agentKey]?.label || 'Assistant');
        return `### ${ts} · ${role}\n\n${m.content || ''}\n`;
    });
    return fmLines.join('\n') + blocks.join('\n---\n\n');
}

function chatParseFrontmatter(md) {
    const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!m) return { frontmatter: {}, body: md };
    const fm = {};
    m[1].split(/\r?\n/).forEach(line => {
        const kv = line.match(/^([\w-]+):\s*(.*)$/);
        if (kv) fm[kv[1]] = kv[2].trim();
    });
    return { frontmatter: fm, body: m[2] };
}

function chatParseHistoryFromBody(body) {
    const blocks = body.split(/\n---\n\n/);
    const history = [];
    blocks.forEach(b => {
        const m = b.match(/^###\s+(\S+)\s+·\s+(.+?)\n\n([\s\S]*)$/);
        if (!m) return;
        const ts = m[1];
        const roleRaw = m[2];
        const content = m[3].trim();
        const role = /Tu|user/i.test(roleRaw) ? 'user' : 'assistant';
        history.push({ role: role, content: content, ts: new Date(ts).getTime() || Date.now() });
    });
    return history;
}

/* ---------- Render main / mensajes ---------- */
function chatRenderMain() {
    $('#chatCurrentTitle').text(chat.currentTitle);
    const $body = $('#chatBody');
    $body.empty();
    if (!chat.history.length) {
        $body.html(chatEmptyHtml());
        chatBindSuggestions();
        if (window.lucide) lucide.createIcons();
        return;
    }
    const $inner = $('<div class="chat-body-inner"></div>');
    chat.history.forEach((m, idx) => $inner.append(chatRenderMessage(m, idx)));
    $body.append($inner);
    if (window.lucide) lucide.createIcons();
    chatScrollBottom();
}

function chatEmptyHtml() {
    return `
        <div class="chat-empty">
            <i data-lucide="message-circle"></i>
            <div class="chat-empty-title">Inicia una conversacion</div>
            <div class="chat-empty-sub">Pregunta lo que quieras. Adjunta imagenes o documentos para enriquecer el contexto.</div>
            <div class="chat-suggestions">
                <button class="chat-suggestion" data-prompt="¿Que puedes hacer?">¿Que puedes hacer?</button>
                <button class="chat-suggestion" data-prompt="Explicame CoffeeSoft en 3 parrafos">Explicame CoffeeSoft</button>
                <button class="chat-suggestion" data-prompt="Dame un ejemplo de consulta SQL con JOIN">Ejemplo SQL con JOIN</button>
                <button class="chat-suggestion" data-prompt="¿Cual es la diferencia entre varoch y huubie?">Varoch vs Huubie</button>
            </div>
        </div>
    `;
}

function chatBindSuggestions() {
    $('.chat-suggestion').on('click', function () {
        const prompt = $(this).data('prompt') || $(this).text();
        $('#chatInput').val(prompt).trigger('input').trigger('focus');
    });
}

function chatRenderMessage(m, idx) {
    const isUser = m.role === 'user';
    const $msg = $('<div>').addClass('chat-msg').addClass(m.role);
    const $text = $('<div>').addClass('chat-msg-text');
    if (isUser) {
        $text.text(m.content);
    } else {
        $text.html(chatMarkdown(m.content || ''));
    }
    $msg.append($text);

    const $actions = $('<div>').addClass('chat-msg-actions');
    if (isUser) {
        $actions.append(chatActionBtn('edit-3', 'Editar', () => chatEditMessage(idx)));
    } else {
        $actions.append(chatActionBtn('copy', 'Copiar', () => chatCopyMessage(idx)));
        $actions.append(chatActionBtn('refresh-cw', 'Regenerar', () => chatRegenerate(idx)));
    }
    $msg.append($actions);

    if (!isUser && m.meta) {
        const $meta = $('<div>').addClass('chat-msg-meta');
        if (m.meta.tokens_used) $meta.append(`<span class="meta-item"><span class="dot"></span>${m.meta.tokens_used} tokens</span>`);
        if (m.meta.cost_usd)    $meta.append(`<span class="meta-item">$${Number(m.meta.cost_usd).toFixed(4)}</span>`);
        if (m.meta.elapsed_ms)  $meta.append(`<span class="meta-item">${(m.meta.elapsed_ms / 1000).toFixed(1)}s</span>`);
        if (m.meta.model)       $meta.append(`<span class="meta-item">${m.meta.model}</span>`);
        $msg.append($meta);
    }
    return $msg;
}

function chatActionBtn(icon, title, handler) {
    return $(`<button class="chat-msg-action" title="${title}"><i data-lucide="${icon}" class="w-3.5 h-3.5"></i></button>`).on('click', handler);
}

function chatMarkdown(text) {
    if (!text) return '';
    if (!window.marked || !window.DOMPurify) return chatEscape(text);
    try {
        const raw = window.marked.parse(text, { breaks: true, gfm: true });
        const clean = window.DOMPurify.sanitize(raw, { ADD_ATTR: ['target'] });
        if (window.hljs) {
            const tmp = document.createElement('div');
            tmp.innerHTML = clean;
            tmp.querySelectorAll('pre code').forEach(el => {
                try { window.hljs.highlightElement(el); } catch (_) { /* noop */ }
            });
            return tmp.innerHTML;
        }
        return clean;
    } catch (err) {
        console.error('chatMarkdown:', err);
        return chatEscape(text);
    }
}

function chatScrollBottom() {
    const $body = $('#chatBody');
    $body.scrollTop($body[0].scrollHeight);
}

function chatCopyMessage(idx) {
    const m = chat.history[idx];
    if (!m) return;
    const text = m.content || '';
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(
            () => chatToast('Mensaje copiado', 'success'),
            () => chatToast('No se pudo copiar', 'error')
        );
    } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); chatToast('Mensaje copiado', 'success'); }
        catch (_) { chatToast('No se pudo copiar', 'error'); }
        document.body.removeChild(ta);
    }
}

function chatEditMessage(idx) {
    const m = chat.history[idx];
    if (!m || m.role !== 'user') return;
    const $msg = $('#chatBody .chat-body-inner .chat-msg').eq(idx);
    if (!$msg.length) return;
    const $editor = $(`<textarea class="chat-edit-textarea" rows="3">${chatEscape(m.content)}</textarea>`);
    const $actions = $(`
        <div class="chat-edit-actions">
            <button class="cs-btn cs-btn-sm cs-btn-primary chat-edit-save"><i data-lucide="send" class="w-3 h-3"></i> Guardar y reenviar</button>
            <button class="cs-btn cs-btn-sm cs-btn-ghost chat-edit-cancel">Cancelar</button>
        </div>
    `);
    $msg.find('.chat-msg-text').replaceWith($editor);
    $msg.find('.chat-msg-actions').replaceWith($actions);
    if (window.lucide) lucide.createIcons();
    $editor.trigger('focus');
    $actions.find('.chat-edit-save').on('click', () => {
        const newText = $editor.val().trim();
        if (!newText) { chatToast('Mensaje vacio', 'error'); return; }
        chat.history = chat.history.slice(0, idx);
        chat.history.push({ role: 'user', content: newText, ts: Date.now() });
        chat.dirty = true;
        chatRenderMain();
        chatSubmit();
    });
    $actions.find('.chat-edit-cancel').on('click', () => chatRenderMain());
}

function chatRegenerate(idx) {
    const m = chat.history[idx];
    if (!m || m.role !== 'assistant') return;
    chat.history = chat.history.slice(0, idx);
    chat.dirty = true;
    chatRenderMain();
    chatSubmit();
}

/* ---------- Submit + SSE streaming ---------- */
async function chatSubmit() {
    const text = $('#chatInput').val().trim();
    if (!text && !chat.pendingImages.length && !chat.pendingDocs.length) return;
    if (chat.isBusy) { chatStop(); return; }

    const userMsg = {
        role: 'user',
        content: text,
        images: chat.pendingImages.map(img => (img.dataurl || '').replace(/^data:[^;]+;base64,/, '')),
        ts: Date.now()
    };
    chat.history.push(userMsg);
    $('#chatInput').val('').trigger('input');
    chat.pendingImages = [];
    chat.pendingDocs = [];
    chatRenderAttachments();
    chat.dirty = true;

    if (chat.history.length === 1) {
        const auto = (text || 'Nueva conversacion').slice(0, 50).trim();
        chat.currentTitle = auto || 'Nueva conversacion';
    }
    chatRenderMain();

    chatSetBusy(true);
    const ac = new AbortController();
    chat._abort = ac;
    const $typing = chatAppendTyping();
    let received = '';
    let meta = null;
    let streamErr = null;
    let firstToken = false;

    try {
        const payload = {
            messages: chat.history.map(m => {
                const o = { role: m.role, content: m.content || '' };
                if (m.images && m.images.length) o.images = m.images;
                return o;
            }),
            systemOverride: chat.systemOverride,
            model: chat.model || '',
            currentFile: '',
            currentFileContent: chatDocsToContextString() || ''
        };

        const res = await fetch(CHAT_API_STREAM, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: ac.signal
        });
        if (!res.ok || !res.body) throw new Error('HTTP ' + res.status);

        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = '';
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            let idx;
            while ((idx = buf.indexOf('\n\n')) !== -1) {
                const rawEvent = buf.slice(0, idx);
                buf = buf.slice(idx + 2);
                let ev = 'message', dataStr = '';
                rawEvent.split('\n').forEach(l => {
                    if (l.startsWith('event:')) ev = l.slice(6).trim();
                    else if (l.startsWith('data:')) dataStr += l.slice(5).trim();
                });
                let obj = {};
                try { obj = dataStr ? JSON.parse(dataStr) : {}; } catch (_) { continue; }
                if (ev === 'chunk') {
                    if (!firstToken) { firstToken = true; $typing.remove(); }
                    received += obj.t || '';
                    chatAppendOrUpdateStream(received);
                } else if (ev === 'done') {
                    meta = obj;
                } else if (ev === 'error') {
                    streamErr = obj.error;
                }
            }
        }
    } catch (err) {
        $typing.remove();
        const aborted = err && err.name === 'AbortError';
        if (aborted) {
            const content = received ? (received + '\n\n_[generacion detenida]_') : '⏹ Generacion detenida.';
            chat.history.push({ role: 'assistant', content: content, ts: Date.now() });
        } else {
            const content = '⚠️ ' + (streamErr || err.message || 'Error de red');
            chat.history.push({ role: 'assistant', content: content, ts: Date.now() });
        }
        chat.dirty = true;
        chatRenderMain();
        chatSetBusy(false);
        chat._abort = null;
        return;
    }

    if ($typing && $typing.length) $typing.remove();
    if (streamErr) {
        chat.history.push({ role: 'assistant', content: '⚠️ ' + streamErr, ts: Date.now(), meta: meta });
    } else {
        chat.history.push({ role: 'assistant', content: received, ts: Date.now(), meta: meta });
    }
    chat.dirty = true;
    chatRenderMain();
    chatSetBusy(false);
    chat._abort = null;
    chatPlayPopSound();

    if (chat.history.length > 0 && chat.history.length % 3 === 0) {
        chatSaveConversation();
    }
}

function chatAppendTyping() {
    const $body = $('#chatBody');
    let $inner = $body.find('.chat-body-inner');
    if (!$inner.length) {
        $inner = $('<div class="chat-body-inner"></div>');
        $body.empty().append($inner);
    }
    const $typing = $('<div class="chat-typing"><span></span><span></span><span></span></div>');
    $inner.append($typing);
    chatScrollBottom();
    return $typing;
}

function chatAppendOrUpdateStream(received) {
    const $inner = $('#chatBody .chat-body-inner');
    if (!$inner.length) return;
    let $last = $inner.find('.chat-msg.assistant').last();
    if (!$last.length) {
        $last = $('<div class="chat-msg assistant"><div class="chat-msg-text"></div></div>');
        $inner.append($last);
    }
    $last.find('.chat-msg-text').html(chatMarkdown(received) + '<span class="ia-stream-cursor">▍</span>');
    chatScrollBottom();
}

function chatStop() {
    if (chat._abort) chat._abort.abort();
}

function chatSetBusy(b) {
    chat.isBusy = b;
    const $btn = $('#chatSendBtn');
    if (!$btn.length) return;
    if (b) {
        $btn.addClass('is-stop').html('<i data-lucide="square" class="w-3.5 h-3.5"></i>');
        $btn.attr('title', 'Detener');
    } else {
        $btn.removeClass('is-stop').html('<i data-lucide="arrow-up" class="w-3.5 h-3.5"></i>');
        $btn.attr('title', 'Enviar (Enter)');
    }
    if (window.lucide) lucide.createIcons();
    $('#chatStatusInfo').text(b ? 'Generando…' : 'Listo');
}

function chatPlayPopSound() {
    try {
        if (!chat._popSound) {
            chat._popSound = new Audio('src/audio/pop_up.ogg');
        }
        chat._popSound.currentTime = 0;
        chat._popSound.play().catch(() => { /* noop */ });
    } catch (_) { /* noop */ }
}

/* ---------- Toast ---------- */
function chatToast(msg, tone) {
    tone = tone || 'info';
    const $t = $('#chatToast');
    if (!$t.length) return;
    $t.text(msg).attr('data-tone', tone).addClass('visible');
    clearTimeout(chat._toastTimer);
    chat._toastTimer = setTimeout(() => $t.removeClass('visible'), 2800);
}

/* ---------- Helpers ---------- */
function chatStamp() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function chatSlugify(s) {
    if (!s) return '';
    return String(s)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 50);
}

function chatEscape(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function chatRelativeTime(ts) {
    if (!ts) return '';
    const t = new Date(ts).getTime();
    if (isNaN(t)) return '';
    const diff = Date.now() - t;
    if (diff < 0) return 'ahora';
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'ahora';
    if (min < 60) return min + 'm';
    const h = Math.floor(min / 60);
    if (h < 24) return h + 'h';
    const d = Math.floor(h / 24);
    if (d < 7) return d + 'd';
    return new Date(t).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' });
}
