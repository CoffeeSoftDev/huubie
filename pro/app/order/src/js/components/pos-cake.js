// -- CSS --

function posCakeCSS() {
    if (document.getElementById('pos-cake-css')) return;

    const css = ''
        + '.pos-ck{--po-surface:#FFF;--po-sunken:#F9FAFB;--po-line:#E5E7EB;--po-line-hi:#D1D5DB;--po-ink:#111827;--po-ink-2:#374151;--po-muted:#6B7280;--po-hover:#F3F4F6;'
        + '--po-brand:rgb(var(--brand-600,192 90 64));--po-brand-ink:rgb(var(--brand-700,160 72 51));--po-brand-soft:rgb(var(--brand-50,253 243 240));--po-brand-line:rgb(var(--brand-200,243 199 186));'
        + '--po-ring:rgb(var(--brand-600,192 90 64) / .18);--po-ok:#047857;--po-ok-fill:#059669;--po-ok-soft:#ECFDF5;--po-ok-line:#A7F3D0;--po-warn:#92400E;--po-warn-soft:#FFFBEB;--po-warn-line:#FDE68A;'
        + 'display:grid;grid-template-columns:minmax(0,1fr) 320px;grid-template-areas:"prog prog" "stage side" "more side";grid-template-rows:auto auto 1fr;align-items:start;gap:14px;padding:18px 1.5rem 10px;color:var(--po-ink);font-size:13px;line-height:1.4;text-align:left}'
        + 'body.dark-mode .pos-ck{--po-surface:var(--dk-card,#1F2A37);--po-sunken:var(--dk-sunken,#1a2332);--po-line:var(--dk-line,#374151);--po-line-hi:var(--dk-line-hi,#4B5563);--po-ink:var(--dk-text,#f5f5f5);--po-ink-2:#D1D5DB;'
        + '--po-muted:var(--dk-muted,#9CA3AF);--po-hover:var(--dk-row-hover,#334155);--po-brand-ink:rgb(var(--brand-200,243 199 186));--po-brand-soft:rgb(var(--brand-600,192 90 64) / .16);--po-brand-line:rgb(var(--brand-600,192 90 64) / .45);'
        + '--po-ok:#6EE7B7;--po-ok-soft:rgb(16 185 129 / .14);--po-ok-line:rgb(16 185 129 / .4);--po-warn:#FCD34D;--po-warn-soft:rgb(245 158 11 / .12);--po-warn-line:rgb(245 158 11 / .35);color-scheme:dark}'
        + '.pos-ck.is-blank{grid-template-areas:"stage side" "more side";grid-template-rows:auto 1fr}'
        + '.pos-ck input[type=number]{-moz-appearance:textfield;appearance:textfield}'
        + '.pos-ck input[type=number]::-webkit-inner-spin-button,.pos-ck input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}'
        + '.pos-ck svg{width:16px;height:16px;flex-shrink:0}'
        + '.pos-ck-card{min-width:0;border:1px solid var(--po-line);border-radius:14px;background:var(--po-surface)}'
        + '.pos-ck-card-title{font-size:14px;font-weight:700;line-height:1.3;color:var(--po-ink)}'

        + '.pos-ck-prog{grid-area:prog;padding:14px 16px 12px;background:var(--po-sunken)}'
        + '.pos-ck-prog-head{display:flex;align-items:center;justify-content:space-between;gap:12px}'
        + '.pos-ck-prog-text{display:block;font-size:12.5px;color:var(--po-muted)}'
        + '.pos-ck-badge{display:inline-flex;align-items:center;gap:5px;height:26px;flex-shrink:0;padding:0 10px;border:1px solid var(--po-brand-line);border-radius:999px;background:var(--po-brand-soft);color:var(--po-brand-ink);font-size:12px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}'
        + '.pos-ck-badge svg{display:none;width:13px;height:13px}'
        + '.pos-ck-prog.is-done .pos-ck-badge{border-color:var(--po-ok-line);background:var(--po-ok-soft);color:var(--po-ok)}'
        + '.pos-ck-prog.is-done .pos-ck-badge svg{display:block}'
        + '.pos-ck-bar{height:6px;margin-top:10px;border-radius:999px;background:var(--po-line);overflow:hidden}'
        + '.pos-ck-bar > span{display:block;width:0;height:100%;border-radius:999px;background:var(--po-brand);transition:width .25s ease,background-color .2s}'
        + '.pos-ck-prog.is-done .pos-ck-bar > span{background:var(--po-ok-fill)}'
        + '.pos-ck-chips{position:relative;display:flex;gap:6px;margin:9px -3px -3px;padding:3px;overflow-x:auto;scrollbar-width:none}'
        + '.pos-ck-chips::-webkit-scrollbar{display:none}'
        + 'button.pos-ck-chip{display:inline-flex;align-items:center;gap:8px;height:36px;flex-shrink:0;margin:0;padding:0 13px 0 7px;border:1px solid var(--po-line);border-radius:999px;background:var(--po-surface);color:var(--po-ink-2);font-size:12.5px;font-weight:600;line-height:1;white-space:nowrap;cursor:pointer;transition:background-color .15s,border-color .15s,color .15s}'
        + 'button.pos-ck-chip:hover{border-color:var(--po-line-hi);background:var(--po-hover)}'
        + 'button.pos-ck-chip:focus-visible{outline:none;box-shadow:0 0 0 3px var(--po-ring)}'
        + '.pos-ck-num{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;flex-shrink:0;border-radius:999px;background:var(--po-hover);color:var(--po-muted);font-size:11px;font-variant-numeric:tabular-nums;transition:background-color .15s,color .15s}'
        + '.pos-ck-num b{font-weight:700}'
        + '.pos-ck-num svg{display:none;width:13px;height:13px;stroke-width:3}'
        + 'button.pos-ck-chip:hover .pos-ck-num{background:var(--po-line)}'
        + 'button.pos-ck-chip.is-done .pos-ck-num{background:var(--po-ok-fill);color:#fff}'
        + 'button.pos-ck-chip.is-done .pos-ck-num b{display:none}'
        + 'button.pos-ck-chip.is-done .pos-ck-num svg{display:block}'
        + 'button.pos-ck-chip.is-on{border-color:var(--po-brand);background:var(--po-brand-soft);color:var(--po-brand-ink)}'
        + 'button.pos-ck-chip.is-on .pos-ck-num{background:var(--po-brand);color:#fff}'

        + '.pos-ck-stage{grid-area:stage;display:flex;flex-direction:column;gap:12px;padding:16px}'
        + '.pos-ck-stage-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}'
        + '.pos-ck-stage-text{display:flex;flex-direction:column;gap:1px;min-width:0}'
        + '.pos-ck-eyebrow{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--po-brand-ink)}'
        + '.pos-ck-title{font-size:17px;font-weight:700;line-height:1.25;color:var(--po-ink);overflow-wrap:anywhere}'
        + '.pos-ck-hint{font-size:12.5px;color:var(--po-muted)}'
        + '.pos-ck-nav{display:flex;gap:6px;flex-shrink:0}'
        + 'button.pos-ck-navbtn{display:inline-flex;align-items:center;justify-content:center;gap:4px;height:36px;margin:0;padding:0 12px;border:1px solid var(--po-line-hi);border-radius:10px;background:var(--po-surface);color:var(--po-ink-2);font-size:12.5px;font-weight:600;line-height:1;white-space:nowrap;cursor:pointer;transition:background-color .15s,border-color .15s,color .15s,opacity .15s}'
        + 'button.pos-ck-navbtn.is-prev{padding-left:8px}'
        + 'button.pos-ck-navbtn.is-next{padding-right:8px;border-color:var(--po-brand-line);background:var(--po-brand-soft);color:var(--po-brand-ink)}'
        + 'button.pos-ck-navbtn:hover{border-color:var(--po-brand);color:var(--po-brand-ink)}'
        + 'button.pos-ck-navbtn:focus-visible{outline:none;box-shadow:0 0 0 3px var(--po-ring)}'
        + 'button.pos-ck-navbtn:disabled{border-color:var(--po-line);background:var(--po-surface);color:var(--po-muted);opacity:.55;cursor:default}'
        + 'button.pos-ck-navbtn svg{width:15px;height:15px}'

        + 'input.pos-ck-in,textarea.pos-ck-in{display:block;width:100%;margin:0;border:1px solid var(--po-line-hi);border-radius:10px;background:var(--po-surface);color:var(--po-ink);font-size:13.5px !important;line-height:1.35;outline:none;box-shadow:none;transition:border-color .15s,box-shadow .15s}'
        + 'input.pos-ck-in{height:40px !important;padding:0 12px}'
        + 'textarea.pos-ck-in{min-height:70px;padding:9px 12px;resize:vertical}'
        + 'input.pos-ck-in::placeholder,textarea.pos-ck-in::placeholder{color:var(--po-muted);opacity:1}'
        + 'input.pos-ck-in:focus,textarea.pos-ck-in:focus{border-color:var(--po-brand);box-shadow:0 0 0 3px var(--po-ring)}'
        + '.pos-ck-field{display:flex;flex-direction:column;min-width:0}'
        + '.pos-ck label.pos-ck-lbl{display:block;margin:0 0 5px !important;font-size:12px !important;font-weight:600;line-height:1.3;color:var(--po-ink-2)}'
        + '.pos-ck-help{display:block;margin-top:4px;font-size:11.5px;line-height:1.3;color:var(--po-muted)}'
        + '.pos-ck-pair{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}'
        + '.pos-ck-search{position:relative}'
        + '.pos-ck-search.is-off{display:none}'
        + '.pos-ck-search > svg{position:absolute;left:12px;top:50%;width:15px;height:15px;margin-top:-7.5px;color:var(--po-muted);pointer-events:none}'
        + '.pos-ck-search input.pos-ck-in{padding-left:36px}'

        + '.pos-ck-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));grid-auto-rows:min-content;align-content:start;gap:8px;height:296px;margin:-3px;padding:3px;overflow-y:auto;scrollbar-width:thin}'
        + 'button.pos-ck-opt,div.pos-ck-opt{display:flex;align-items:center;gap:10px;width:100%;min-width:0;min-height:58px;margin:0;padding:8px 12px;border:1px solid var(--po-line);border-radius:12px;background:var(--po-surface);color:var(--po-ink);font-size:13px;line-height:1.3;text-align:left;transition:background-color .15s,border-color .15s,box-shadow .15s}'
        + 'button.pos-ck-opt{cursor:pointer}'
        + 'button.pos-ck-opt:hover{border-color:var(--po-line-hi);background:var(--po-hover)}'
        + 'button.pos-ck-opt:focus-visible{outline:none;border-color:var(--po-brand);box-shadow:0 0 0 3px var(--po-ring)}'
        + 'button.pos-ck-opt.is-on,div.pos-ck-opt.is-on{border-color:var(--po-brand);background:var(--po-brand-soft)}'
        + 'button.pos-ck-opt.is-off,div.pos-ck-opt.is-off{display:none}'
        + '.pos-ck-dot{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;flex-shrink:0;border:1.5px solid var(--po-line-hi);border-radius:999px;background:var(--po-surface);color:#fff;transition:background-color .15s,border-color .15s}'
        + '.pos-ck-dot svg{width:12px;height:12px;stroke-width:3;opacity:0}'
        + 'button.pos-ck-opt.is-on .pos-ck-dot{border-color:var(--po-brand);background:var(--po-brand)}'
        + 'button.pos-ck-opt.is-on .pos-ck-dot svg{opacity:1}'
        + '.pos-ck-opt-main{display:flex;flex-direction:column;flex:1 1 0%;gap:1px;min-width:0}'
        + '.pos-ck-opt-name{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-weight:600;color:var(--po-ink);overflow-wrap:anywhere}'
        + '.pos-ck-opt-sub{font-size:11.5px;font-variant-numeric:tabular-nums;color:var(--po-muted)}'
        + '.pos-ck-opt-price{display:flex;flex-direction:column;align-items:flex-end;flex-shrink:0;line-height:1.2}'
        + '.pos-ck-opt-price b{font-size:13.5px;font-weight:700;font-variant-numeric:tabular-nums;color:var(--po-ink)}'
        + '.pos-ck-opt-price small{font-size:10.5px;font-weight:500;color:var(--po-muted)}'
        + 'button.pos-ck-add{display:inline-flex;align-items:center;justify-content:center;gap:5px;height:34px;flex-shrink:0;margin:0;padding:0 12px 0 9px;border:1px solid var(--po-line-hi);border-radius:9px;background:var(--po-surface);color:var(--po-ink-2);font-size:12.5px;font-weight:600;line-height:1;white-space:nowrap;cursor:pointer;transition:background-color .15s,border-color .15s,color .15s}'
        + 'button.pos-ck-add:hover{border-color:var(--po-brand-line);background:var(--po-brand-soft);color:var(--po-brand-ink)}'
        + 'button.pos-ck-add:focus-visible{outline:none;border-color:var(--po-brand);box-shadow:0 0 0 3px var(--po-ring)}'
        + 'button.pos-ck-add svg{width:14px;height:14px}'
        + '.pos-ck-qty{display:none;align-items:stretch;height:34px;flex-shrink:0;border:1px solid var(--po-brand-line);border-radius:9px;background:var(--po-surface);overflow:hidden;transition:border-color .15s,box-shadow .15s}'
        + '.pos-ck-qty:focus-within{border-color:var(--po-brand);box-shadow:0 0 0 3px var(--po-ring)}'
        + 'div.pos-ck-opt.is-on button.pos-ck-add{display:none}'
        + 'div.pos-ck-opt.is-on .pos-ck-qty{display:inline-flex}'
        + 'button.pos-ck-qtybtn{display:inline-flex;align-items:center;justify-content:center;width:32px;margin:0;padding:0;border:0;border-radius:0;background:transparent;color:var(--po-brand-ink);cursor:pointer;transition:background-color .15s}'
        + 'button.pos-ck-qtybtn:hover,button.pos-ck-qtybtn:focus-visible{outline:none;background:var(--po-brand-soft)}'
        + 'button.pos-ck-qtybtn svg{width:14px;height:14px}'
        + '.pos-ck .pos-ck-qty input.pos-ck-qtyin{width:40px;height:auto !important;margin:0;padding:0;border:0 !important;border-radius:0 !important;background:transparent !important;color:var(--po-ink) !important;font-size:13.5px !important;font-weight:700;line-height:1;text-align:center;font-variant-numeric:tabular-nums;outline:none;box-shadow:none !important}'

        + '.pos-ck-none{display:none;grid-column:1 / -1;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:36px 16px;text-align:center;color:var(--po-muted);font-size:12.5px}'
        + '.pos-ck-none.is-on{display:flex}'
        + '.pos-ck-none svg{width:26px;height:26px;margin-bottom:5px;opacity:.7}'
        + '.pos-ck-none b{font-size:13.5px;font-weight:600;color:var(--po-ink-2)}'

        + '.pos-ck-side{grid-area:side;position:sticky;top:12px;display:flex;flex-direction:column;gap:12px;padding:16px}'
        + '.pos-ck-side-head{display:flex;align-items:center;gap:8px}'
        + '.pos-ck-side-head svg{width:17px;height:17px;color:var(--po-brand)}'
        + '.pos-ck-sum{display:flex;flex-direction:column;border:1px solid var(--po-line);border-radius:12px;overflow:hidden}'
        + 'button.pos-ck-sumrow{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;width:100%;margin:0;padding:8px 11px;border:0;border-top:1px solid var(--po-line);border-radius:0;background:var(--po-surface);color:var(--po-ink);font-size:12.5px;line-height:1.35;text-align:left;cursor:pointer;transition:background-color .15s}'
        + 'button.pos-ck-sumrow:first-child{border-top:0}'
        + 'button.pos-ck-sumrow:hover{background:var(--po-hover)}'
        + 'button.pos-ck-sumrow.is-on{box-shadow:inset 3px 0 0 var(--po-brand)}'
        + 'button.pos-ck-sumrow:focus-visible{outline:none;box-shadow:inset 0 0 0 2px var(--po-brand)}'
        + '.pos-ck-sum-main{display:flex;flex-direction:column;flex:1 1 0%;gap:1px;min-width:0}'
        + '.pos-ck-sum-group{font-size:10.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--po-muted)}'
        + '.pos-ck-sum-value{font-weight:600;color:var(--po-ink);overflow-wrap:anywhere}'
        + '.pos-ck-sum-value.is-none{font-weight:500;color:var(--po-muted)}'
        + '.pos-ck-sum-note{font-size:11px;font-variant-numeric:tabular-nums;color:var(--po-muted)}'
        + '.pos-ck-sum-amount{flex-shrink:0;padding-top:15px;font-weight:700;font-variant-numeric:tabular-nums;color:var(--po-ink);white-space:nowrap}'
        + '.pos-ck-warn{display:none;align-items:flex-start;gap:7px;padding:8px 10px;border:1px solid var(--po-warn-line);border-radius:10px;background:var(--po-warn-soft);color:var(--po-warn);font-size:12px;font-weight:500;line-height:1.35}'
        + '.pos-ck-warn.is-on{display:flex}'
        + '.pos-ck-warn svg{width:14px;height:14px;margin-top:1px}'
        + '.pos-ck-tot{display:flex;flex-direction:column;gap:10px;padding-top:12px;border-top:1px dashed var(--po-line-hi)}'
        + '.pos-ck-tot-line{display:flex;align-items:baseline;justify-content:space-between;gap:10px;font-size:12.5px;color:var(--po-muted)}'
        + '.pos-ck-tot-line b{font-size:13.5px;font-weight:700;font-variant-numeric:tabular-nums;color:var(--po-ink)}'
        + '.pos-ck-money{position:relative}'
        + '.pos-ck-money > span{position:absolute;left:12px;top:0;display:flex;align-items:center;height:40px;font-size:13.5px;font-weight:600;color:var(--po-muted);pointer-events:none}'
        + '.pos-ck-money input.pos-ck-in{padding-left:26px}'
        + '.pos-ck-total{display:flex;align-items:flex-end;justify-content:space-between;gap:10px;padding:10px 12px;border-radius:12px;background:var(--po-sunken)}'
        + '.pos-ck-total-text{display:flex;flex-direction:column;font-size:12.5px;font-weight:600;line-height:1.3;color:var(--po-ink-2)}'
        + '.pos-ck-total-text small{font-size:11px;font-weight:500;color:var(--po-muted)}'
        + '.pos-ck-total > b{font-size:20px;font-weight:800;line-height:1.1;font-variant-numeric:tabular-nums;color:var(--po-ink)}'

        + '.pos-ck-more{grid-area:more;display:flex;flex-direction:column;gap:12px;padding:16px}'
        + '.pos-ck-more-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px}'
        + '.pos-ck-more-col{display:flex;flex-direction:column;gap:10px;min-width:0}'
        + '.pos-ck-shots-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:5px}'
        + '.pos-ck-shots-title{font-size:12px;font-weight:600;line-height:1.3;color:var(--po-ink-2)}'
        + '.pos-ck-count{font-size:11.5px;font-variant-numeric:tabular-nums;color:var(--po-muted)}'
        + '.pos-ck-shots{display:grid;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:8px}'
        + '.pos-ck-shot{position:relative;aspect-ratio:1 / 1;border:1px solid var(--po-line);border-radius:10px;background:var(--po-sunken);overflow:hidden}'
        + 'button.pos-ck-shot-view{display:flex;align-items:center;justify-content:center;width:100%;height:100%;margin:0;padding:0;border:0;border-radius:0;background:transparent;color:var(--po-muted);cursor:zoom-in}'
        + 'button.pos-ck-shot-view:disabled{cursor:default}'
        + 'button.pos-ck-shot-view:focus-visible{outline:none;box-shadow:inset 0 0 0 3px var(--po-brand)}'
        + 'button.pos-ck-shot-view img{display:block;width:100%;height:100%;max-width:none;object-fit:cover}'
        + 'button.pos-ck-shot-view svg{width:20px;height:20px}'
        + 'button.pos-ck-shot-del{position:absolute;top:4px;right:4px;display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;margin:0;padding:0;border:0;border-radius:999px;background:rgba(17,24,39,.72);color:#fff;cursor:pointer;transition:background-color .15s}'
        + 'button.pos-ck-shot-del:hover{background:#DC2626}'
        + 'button.pos-ck-shot-del:focus-visible{outline:none;background:#DC2626;box-shadow:0 0 0 2px #fff}'
        + 'button.pos-ck-shot-del svg{width:12px;height:12px}'
        + '.pos-ck label.pos-ck-drop{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;aspect-ratio:1 / 1;margin:0 !important;padding:6px;border:1.5px dashed var(--po-line-hi);border-radius:10px;background:var(--po-sunken);color:var(--po-muted);font-size:11px !important;font-weight:600;line-height:1.25;text-align:center;cursor:pointer;transition:background-color .15s,border-color .15s,color .15s}'
        + '.pos-ck label.pos-ck-drop:hover,.pos-ck label.pos-ck-drop.is-over{border-color:var(--po-brand);background:var(--po-brand-soft);color:var(--po-brand-ink)}'
        + '.pos-ck label.pos-ck-drop:focus-within{border-color:var(--po-brand);box-shadow:0 0 0 3px var(--po-ring)}'
        + '.pos-ck label.pos-ck-drop.is-off{display:none}'
        + '.pos-ck label.pos-ck-drop.is-busy{pointer-events:none;opacity:.75}'
        + '.pos-ck-shots.is-empty label.pos-ck-drop{grid-column:1 / -1;flex-direction:row;gap:8px;aspect-ratio:auto;min-height:72px;padding:12px;font-size:12px !important}'
        + '.pos-ck-drop-icon,.pos-ck-drop-spin{display:inline-flex}'
        + '.pos-ck-drop-icon svg,.pos-ck-drop-spin svg{width:20px;height:20px}'
        + '.pos-ck-drop-spin{display:none;animation:pos-ck-spin .8s linear infinite}'
        + 'label.pos-ck-drop.is-busy .pos-ck-drop-icon{display:none}'
        + 'label.pos-ck-drop.is-busy .pos-ck-drop-spin{display:inline-flex}'
        + '.pos-ck label.pos-ck-drop input{position:absolute;left:0;top:0;width:1px;height:1px !important;padding:0;border:0;opacity:0;pointer-events:none}'
        + '@keyframes pos-ck-spin{to{transform:rotate(360deg)}}'

        + '.pos-ck-zoom{position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(17,24,39,.88);cursor:zoom-out;outline:none}'
        + '.pos-ck-zoom img{display:block;width:auto;height:auto;max-width:100%;max-height:100%;border-radius:10px;box-shadow:0 20px 60px rgba(0,0,0,.5)}'
        + '.pos-ck-zoom-x{position:absolute;top:16px;right:16px;display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:999px;background:rgba(255,255,255,.14);color:#fff}'
        + '.pos-ck-zoom-x svg{width:18px;height:18px}'

        + '@media (max-width:1023px){'
        + '.pos-ck{grid-template-columns:minmax(0,1fr);grid-template-areas:"prog" "stage" "side" "more";grid-template-rows:none}'
        + '.pos-ck.is-blank{grid-template-areas:"stage" "side" "more";grid-template-rows:none}'
        + '.pos-ck-side{position:static}'
        + '.pos-ck-list{height:auto;max-height:340px}'
        + '}'
        + '@media (max-width:767px){'
        + '.pos-ck-more-grid{grid-template-columns:minmax(0,1fr)}'
        + '}'
        + '@media (max-width:639px){'
        + '.pos-ck{gap:12px;padding:14px 16px 8px}'
        + '.pos-ck-prog,.pos-ck-stage,.pos-ck-side,.pos-ck-more{padding:14px}'
        + '.pos-ck-stage-head{flex-direction:column;align-items:stretch}'
        + '.pos-ck-nav button.pos-ck-navbtn{flex:1 1 0%}'
        + '.pos-ck-list{grid-template-columns:minmax(0,1fr)}'
        + '}';

    const style = document.createElement('style');

    style.id          = 'pos-cake-css';
    style.textContent = css;

    document.head.appendChild(style);
}

// -- Componente --

Templates.prototype.posCake = function (options) {
    const defaults = {
        parent:        'root',
        id:            'posCake',
        class:         '',
        json:          [],
        value:         {},
        images:        [],
        maxImages:     10,
        onFiles:       () => { },
        onRemoveImage: () => { }
    };

    const opts  = Object.assign({}, defaults, options);
    const value = Object.assign({ name: '', portions: '', quantity: 1, price: '', dedication: '', details: '', modifiers: [] }, opts.value);
    const state = { step: 0, picks: {}, images: opts.images.slice(), busy: false };

    const plain = (text) => String(text == null ? '' : text).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    const icon  = (name) => $('<i>', { 'data-lucide': name, 'aria-hidden': 'true' });
    const cash  = (n) => '$' + (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const whole = (raw, max) => {
        const text = String(raw == null ? '' : raw).trim();
        const n    = /^\d+$/.test(text) ? Number(text) : 0;

        return n >= 1 && n <= max ? n : 0;
    };

    const typed = (input) => {
        if (input[0].validity && input[0].validity.badInput) return '?';

        return String(input.val() == null ? '' : input.val()).trim();
    };

    const groups = opts.json
        .map((g) => ({
            name:     g.name,
            multiple: Boolean(g.multiple),
            options:  (g.options || []).map((o) => ({ id: Number(o.id), name: o.name, price: Number(o.price) || 0 }))
        }))
        .filter((g) => g.options.length);

    const picked = (g) => g.options.filter((o) => state.picks[o.id]);

    groups.forEach((g) => {
        g.options.forEach((o) => {
            const found = (value.modifiers || []).find((m) => Number(m.id) === o.id);

            if (!found) return;

            if (!g.multiple) g.options.forEach((other) => { delete state.picks[other.id]; });

            state.picks[o.id] = g.multiple ? Math.min(999, Math.max(1, Math.floor(Number(found.quantity)) || 1)) : 1;
        });
    });

    state.step = Math.max(0, groups.findIndex((g) => !picked(g).length));

    posCakeCSS();

    const root      = $('<div>', { id: opts.id, class: `pos-ck ${opts.class}` });
    const prog      = $('<div>', { class: 'pos-ck-card pos-ck-prog' });
    const progText  = $('<span>', { class: 'pos-ck-prog-text', 'aria-live': 'polite' });
    const badge     = $('<span>', { class: 'pos-ck-badge' });
    const badgeText = $('<span>');
    const fill      = $('<span>');
    const chips     = $('<div>', { class: 'pos-ck-chips' });

    const stage   = $('<div>', { class: 'pos-ck-card pos-ck-stage' });
    const eyebrow = $('<span>', { class: 'pos-ck-eyebrow' });
    const heading = $('<span>', { class: 'pos-ck-title' });
    const hint    = $('<span>', { class: 'pos-ck-hint' });
    const prev    = $('<button>', { type: 'button', class: 'pos-ck-navbtn is-prev' }).append(icon('chevron-left'), $('<span>', { text: 'Anterior' }));
    const next    = $('<button>', { type: 'button', class: 'pos-ck-navbtn is-next' }).append($('<span>', { text: 'Siguiente' }), icon('chevron-right'));
    const search  = $('<div>', { class: 'pos-ck-search' });
    const query   = $('<input>', { id: `${opts.id}Search`, class: 'pos-ck-in', type: 'text', autocomplete: 'off', spellcheck: 'false', placeholder: 'Buscar opción', 'aria-label': 'Buscar opción' });
    const list    = $('<div>', { id: `${opts.id}List`, class: 'pos-ck-list' });
    const none    = $('<div>', { class: 'pos-ck-none' }).append(icon('search'), $('<b>', { text: 'Sin coincidencias' }), $('<span>', { text: 'Prueba con otra palabra.' }));

    const side       = $('<div>', { class: 'pos-ck-card pos-ck-side' });
    const inName     = $('<input>', { id: `${opts.id}Name`, class: 'pos-ck-in', type: 'text', maxlength: 150, autocomplete: 'off' }).val(value.name);
    const inPortions = $('<input>', { id: `${opts.id}Portions`, class: 'pos-ck-in', type: 'number', inputmode: 'numeric', min: 1, max: 999, step: 1, placeholder: 'Ej. 20' }).val(value.portions);
    const inQuantity = $('<input>', { id: `${opts.id}Quantity`, class: 'pos-ck-in', type: 'number', inputmode: 'numeric', min: 1, max: 9999, step: 1 }).val(value.quantity);
    const inPrice    = $('<input>', { id: `${opts.id}Price`, class: 'pos-ck-in', type: 'number', inputmode: 'decimal', min: 0, step: '0.01' }).val(value.price);
    const sum        = $('<div>', { class: 'pos-ck-sum' });
    const warn       = $('<div>', { class: 'pos-ck-warn', role: 'status' }).append(icon('triangle-alert'), $('<span>', { text: 'Escribe las porciones para calcular el precio.' }));
    const suggested  = $('<b>');
    const total      = $('<b>');
    const totalNote  = $('<small>');

    const more         = $('<div>', { class: 'pos-ck-card pos-ck-more' });
    const inDedication = $('<input>', { id: `${opts.id}Dedication`, class: 'pos-ck-in', type: 'text', maxlength: 255, autocomplete: 'off', placeholder: 'Ej. Feliz cumpleaños, Ana' }).val(value.dedication);
    const inDetails    = $('<textarea>', { id: `${opts.id}Details`, class: 'pos-ck-in', rows: 3, maxlength: 255, placeholder: 'Colores, forma, alergias…' }).val(value.details);
    const photos       = $('<div>', { class: 'pos-ck-more-col' });
    const shots        = $('<div>', { id: `${opts.id}Shots`, class: 'pos-ck-shots' });
    const counter      = $('<span>', { class: 'pos-ck-count' });
    const file         = $('<input>', { id: `${opts.id}File`, type: 'file', accept: 'image/*', multiple: true });
    const dropText     = $('<span>');
    const drop         = $('<label>', { class: 'pos-ck-drop' });

    let rows = [];

    const paint = () => {
        if (window.lucide) lucide.createIcons({ root: root[0] });
    };

    const field = (label, input, help) => {
        const el = $('<div>', { class: 'pos-ck-field' });

        el.append($('<label>', { class: 'pos-ck-lbl', for: input.attr('id'), text: label }), input);

        if (help) el.append($('<span>', { class: 'pos-ck-help', text: help }));

        return el;
    };

    const filter = () => {
        const text = plain(query.val());
        let shown  = 0;

        rows.forEach((row) => {
            const on = text === '' || row.words.includes(text);

            row.el.toggleClass('is-off', !on);

            if (on) shown++;
        });

        none.toggleClass('is-on', shown === 0);
    };

    const single = (g, o) => {
        const el = $('<button>', { type: 'button', class: 'pos-ck-opt', 'aria-pressed': 'false' });

        el.append(
            $('<span>', { class: 'pos-ck-dot' }).append(icon('check')),
            $('<span>', { class: 'pos-ck-opt-main' }).append($('<span>', { class: 'pos-ck-opt-name', text: o.name })),
            $('<span>', { class: 'pos-ck-opt-price' }).append($('<b>', { text: cash(o.price) }), $('<small>', { text: 'por porción' }))
        );

        el.on('click', () => {
            const on = Boolean(state.picks[o.id]);

            g.options.forEach((other) => { delete state.picks[other.id]; });

            if (!on) state.picks[o.id] = 1;

            sync();
        });

        return {
            el:    el,
            words: plain(o.name),
            sync:  () => {
                const on = Boolean(state.picks[o.id]);

                el.toggleClass('is-on', on).attr('aria-pressed', String(on));
            }
        };
    };

    const multi = (o) => {
        const el    = $('<div>', { class: 'pos-ck-opt' });
        const add   = $('<button>', { type: 'button', class: 'pos-ck-add', 'aria-label': `Agregar ${o.name}` }).append(icon('plus'), $('<span>', { text: 'Agregar' }));
        const box   = $('<div>', { class: 'pos-ck-qty' });
        const minus = $('<button>', { type: 'button', class: 'pos-ck-qtybtn', 'aria-label': `Quitar uno de ${o.name}` }).append(icon('minus'));
        const plus  = $('<button>', { type: 'button', class: 'pos-ck-qtybtn', 'aria-label': `Agregar uno de ${o.name}` }).append(icon('plus'));
        const input = $('<input>', { class: 'pos-ck-qtyin', type: 'text', inputmode: 'numeric', maxlength: 3, autocomplete: 'off', 'aria-label': `Cantidad de ${o.name}` });

        const set = (n) => {
            if (n >= 1) state.picks[o.id] = Math.min(999, n);
            else delete state.picks[o.id];

            input.val(state.picks[o.id] ? String(state.picks[o.id]) : '');
            sync();
        };

        add.on('click', () => {
            set(1);
            plus.trigger('focus');
        });

        minus.on('click', () => {
            set((state.picks[o.id] || 0) - 1);

            if (!state.picks[o.id]) add.trigger('focus');
        });

        plus.on('click', () => set((state.picks[o.id] || 0) + 1));

        input.on('focus', () => input.trigger('select'));

        input.on('input', () => {
            const text = String(input.val()).replace(/\D/g, '');

            if (text !== input.val()) input.val(text);

            if (Number(text) < 1) return;

            state.picks[o.id] = Number(text);
            sync();
        });

        input.on('blur', () => set(Number(input.val()) || 0));

        box.append(minus, input, plus);

        el.append(
            $('<span>', { class: 'pos-ck-opt-main' }).append(
                $('<span>', { class: 'pos-ck-opt-name', text: o.name }),
                $('<span>', { class: 'pos-ck-opt-sub', text: `${cash(o.price)} c/u` })
            ),
            add,
            box
        );

        return {
            el:    el,
            words: plain(o.name),
            sync:  () => {
                const units = state.picks[o.id] || 0;

                el.toggleClass('is-on', units > 0);

                if (document.activeElement !== input[0]) input.val(units ? String(units) : '');
            }
        };
    };

    const chipEls = groups.map((g, i) => {
        const el = $('<button>', { type: 'button', class: 'pos-ck-chip' });

        el.append($('<span>', { class: 'pos-ck-num' }).append($('<b>', { text: String(i + 1) }), icon('check')), $('<span>', { text: g.name }));
        el.on('click', () => go(i));

        chips.append(el);

        return el;
    });

    const sumEls = groups.map((g, i) => {
        const el     = $('<button>', { type: 'button', class: 'pos-ck-sumrow' });
        const main   = $('<span>', { class: 'pos-ck-sum-main' });
        const amount = $('<span>', { class: 'pos-ck-sum-amount' });

        el.append(main, amount);
        el.on('click', () => go(i, true));

        sum.append(el);

        return { el: el, main: main, amount: amount };
    });

    const sync = () => {
        const portions = whole(inPortions.val(), 999);
        const quantity = whole(inQuantity.val(), 9999);
        const done     = groups.filter((g) => picked(g).length).length;
        const ready    = groups.length > 0 && done === groups.length;
        let price      = 0;
        let pending    = false;

        groups.forEach((g, i) => {
            const chosen = picked(g);
            const row    = sumEls[i];
            let amount   = 0;

            row.main.empty().append($('<span>', { class: 'pos-ck-sum-group', text: g.name }));

            if (!chosen.length) row.main.append($('<span>', { class: 'pos-ck-sum-value is-none', text: 'Sin elegir' }));

            chosen.forEach((o) => {
                const units = g.multiple ? state.picks[o.id] : portions;
                let note    = `${cash(o.price)} c/u`;

                if (!g.multiple) note = portions ? `${cash(o.price)} × ${portions} ${portions === 1 ? 'porción' : 'porciones'}` : `${cash(o.price)} por porción`;

                if (!g.multiple && !portions) pending = true;

                amount += o.price * units;

                row.main.append(
                    $('<span>', { class: 'pos-ck-sum-value', text: g.multiple ? `${units} × ${o.name}` : o.name }),
                    $('<span>', { class: 'pos-ck-sum-note', text: note })
                );
            });

            row.amount.text(!chosen.length ? '' : (g.multiple || portions ? cash(amount) : '—'));
            row.el.toggleClass('is-on', i === state.step);

            chipEls[i].toggleClass('is-done', chosen.length > 0).toggleClass('is-on', i === state.step);

            if (i === state.step) chipEls[i].attr('aria-current', 'step');
            else chipEls[i].removeAttr('aria-current');

            price += amount;
        });

        price = Math.round(price * 100) / 100;

        const raw  = typed(inPrice);
        const unit = raw === '' ? price : (/^\d+(\.\d{1,2})?$/.test(raw) && Number(raw) <= 999999 ? Number(raw) : 0);

        prog.toggleClass('is-done', ready);
        progText.text(ready ? 'Tu pastel está listo' : `${done} de ${groups.length} ${groups.length === 1 ? 'paso completado' : 'pasos completados'}`);
        badgeText.text(`${done} / ${groups.length}`);
        fill.css('width', `${groups.length ? (done / groups.length) * 100 : 0}%`);

        rows.forEach((row) => row.sync());

        warn.toggleClass('is-on', pending);
        suggested.text(cash(price));
        inPrice.attr('placeholder', price.toFixed(2));
        total.text(cash(unit * quantity));
        totalNote.text(quantity ? `${quantity.toLocaleString('es-MX')} ${quantity === 1 ? 'pastel' : 'pasteles'}` : 'Falta la cantidad');
    };

    const renderStep = () => {
        const g    = groups[state.step];
        const chip = chipEls[state.step][0];

        rows = g.options.map((o) => (g.multiple ? multi(o) : single(g, o)));

        list.empty();
        rows.forEach((row) => list.append(row.el));
        list.append(none);

        eyebrow.text(`Paso ${state.step + 1} de ${groups.length}`);
        heading.text(g.name);
        hint.text(g.multiple ? 'Agrega las que lleve. Se cobran por pieza.' : 'Elige una opción. Se cobra por porción.');
        query.val('');
        search.toggleClass('is-off', g.options.length <= 8);
        prev.prop('disabled', state.step === 0);
        next.prop('disabled', state.step === groups.length - 1);

        filter();
        sync();
        paint();

        list.scrollTop(0);
        chips.scrollLeft(chip.offsetLeft - (chips[0].clientWidth - chip.offsetWidth) / 2);
    };

    const go = (i, reveal) => {
        if (i < 0 || i >= groups.length) return;

        if (i !== state.step) {
            state.step = i;
            renderStep();
        }

        if (reveal) stage[0].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    };

    const picture = (image, fail) => {
        const img = $('<img>', { alt: image.name || '', src: image.src });

        img.on('error', () => {
            if (image.fallback && img.attr('src') !== image.fallback) {
                img.attr('src', image.fallback);
                return;
            }

            fail(img);
        });

        return img;
    };

    const zoom = (image, origin) => {
        const box = $('<div>', { id: `${opts.id}Zoom`, class: 'pos-ck-zoom', tabindex: -1, role: 'dialog', 'aria-modal': 'true', 'aria-label': image.name || 'Foto de referencia' });

        const shut = () => {
            box.remove();
            origin.trigger('focus');
        };

        $(`#${opts.id}Zoom`).remove();

        box.append(picture(image, shut), $('<span>', { class: 'pos-ck-zoom-x' }).append(icon('x')));
        box.on('click', shut);

        box.on('keydown', (e) => {
            e.stopPropagation();

            if (e.key === 'Tab') {
                e.preventDefault();
                return;
            }

            if (e.key !== 'Escape' && e.key !== 'Enter' && e.key !== ' ') return;

            e.preventDefault();
            shut();
        });

        $('body').append(box);

        if (window.lucide) lucide.createIcons({ root: box[0] });

        box.trigger('focus');
    };

    const shot = (image, i) => {
        const el   = $('<div>', { class: 'pos-ck-shot' });
        const view = $('<button>', { type: 'button', class: 'pos-ck-shot-view', 'aria-label': `Ver foto ${i + 1}` });
        const del  = $('<button>', { type: 'button', class: 'pos-ck-shot-del', 'aria-label': `Quitar foto ${i + 1}` }).append(icon('x'));

        view.append(picture(image, (img) => {
            img.replaceWith(icon('image-off'));
            view.prop('disabled', true);
            paint();
        }));

        view.on('click', () => zoom(image, view));

        del.on('click', () => {
            if (!state.busy) opts.onRemoveImage(i);
        });

        return el.append(view, del);
    };

    const renderShots = () => {
        const n = state.images.length;

        shots.children('.pos-ck-shot').remove();

        state.images.forEach((image, i) => drop.before(shot(image, i)));

        shots.toggleClass('is-empty', n === 0);
        drop.toggleClass('is-off', n >= opts.maxImages).toggleClass('is-busy', state.busy);
        dropText.text(state.busy ? 'Subiendo…' : (n ? 'Agregar' : 'Arrastra fotos aquí o haz clic para elegirlas'));
        counter.text(`${n} de ${opts.maxImages}`);
        file.prop('disabled', state.busy);

        paint();
    };

    const send = (files) => {
        const chosen = Array.from(files || []);

        if (chosen.length && !state.busy) opts.onFiles(chosen);
    };

    prog.append(
        $('<div>', { class: 'pos-ck-prog-head' }).append(
            $('<div>').append($('<span>', { class: 'pos-ck-card-title', text: 'Progreso del pastel' }), progText),
            badge.append(icon('check'), badgeText)
        ),
        $('<div>', { class: 'pos-ck-bar' }).append(fill),
        chips
    );

    search.append(icon('search'), query);

    if (groups.length) {
        stage.append(
            $('<div>', { class: 'pos-ck-stage-head' }).append(
                $('<div>', { class: 'pos-ck-stage-text' }).append(eyebrow, heading, hint),
                $('<div>', { class: 'pos-ck-nav' }).append(prev, next)
            ),
            search,
            list
        );
    } else {
        stage.append($('<div>', { class: 'pos-ck-none is-on' }).append(
            icon('cake-slice'),
            $('<b>', { text: 'Sin opciones para armar' }),
            $('<span>', { text: 'Agrega los modificadores del pastel en Catálogo.' })
        ));
    }

    side.append(
        $('<div>', { class: 'pos-ck-side-head' }).append(icon('cake'), $('<span>', { class: 'pos-ck-card-title', text: 'Vista previa' })),
        field('Nombre del pastel', inName),
        $('<div>', { class: 'pos-ck-pair' }).append(field('Porciones', inPortions), field('Pasteles', inQuantity))
    );

    if (groups.length) side.append(sum, warn);

    side.append($('<div>', { class: 'pos-ck-tot' }).append(
        $('<div>', { class: 'pos-ck-tot-line' }).append($('<span>', { text: 'Precio sugerido' }), suggested),
        field('Precio por pastel', inPrice, 'Vacío = se usa el sugerido.'),
        $('<div>', { class: 'pos-ck-total' }).append(
            $('<span>', { class: 'pos-ck-total-text' }).append($('<span>', { text: 'Importe' }), totalNote),
            total
        )
    ));

    inPrice.wrap($('<div>', { class: 'pos-ck-money' })).before($('<span>', { text: '$' }));

    drop.append(
        $('<span>', { class: 'pos-ck-drop-icon' }).append(icon('image-plus')),
        $('<span>', { class: 'pos-ck-drop-spin' }).append(icon('loader-circle')),
        dropText,
        file
    );

    shots.append(drop);

    photos.append(
        $('<div>', { class: 'pos-ck-shots-head' }).append($('<span>', { class: 'pos-ck-shots-title', text: 'Fotos de referencia' }), counter),
        shots
    );

    more.append(
        $('<span>', { class: 'pos-ck-card-title', text: 'Detalles del pastel' }),
        $('<div>', { class: 'pos-ck-more-grid' }).append(
            $('<div>', { class: 'pos-ck-more-col' }).append(field('Dedicatoria', inDedication), field('Indicaciones', inDetails)),
            photos
        )
    );

    if (groups.length) root.append(prog);
    else root.addClass('is-blank');

    root.append(stage, side, more);

    $(`#${opts.parent}`).html(root);

    prev.on('click', () => {
        go(state.step - 1);

        if (prev.prop('disabled')) next.trigger('focus');
    });

    next.on('click', () => {
        go(state.step + 1);

        if (next.prop('disabled')) prev.trigger('focus');
    });

    query.on('input', filter);

    query.on('keydown', (e) => {
        if (e.key !== 'Escape' || query.val() === '') return;

        e.stopPropagation();
        query.val('');
        filter();
    });

    root.on('dragover drop', (e) => e.preventDefault());

    inPortions.add(inQuantity).add(inPrice).on('input', sync);

    file.on('change', () => {
        const files = Array.from(file[0].files || []);

        file.val('');
        send(files);
    });

    photos.on('dragover', (e) => {
        e.preventDefault();
        drop.toggleClass('is-over', !state.busy);
    });

    photos.on('dragleave drop', () => drop.removeClass('is-over'));

    photos.on('drop', (e) => {
        const data = e.originalEvent.dataTransfer;

        e.preventDefault();

        if (data && state.images.length < opts.maxImages) send(data.files);
    });

    if (groups.length) renderStep();
    else sync();

    renderShots();

    return {
        get: () => {
            const modifiers = [];

            groups.forEach((g) => {
                picked(g).forEach((o) => modifiers.push({ id: o.id, quantity: g.multiple ? state.picks[o.id] : 1 }));
            });

            return {
                name:       String(inName.val() || ''),
                portions:   typed(inPortions),
                quantity:   typed(inQuantity),
                price:      typed(inPrice),
                dedication: String(inDedication.val() || ''),
                details:    String(inDetails.val() || ''),
                modifiers:  modifiers
            };
        },

        images: (items) => {
            state.images = (items || []).slice();
            renderShots();
        },

        busy: (on) => {
            state.busy = Boolean(on);
            renderShots();
        }
    };
};
