// Chat flotante de CoffeeIA. El aspecto copia el chat coffeeIA de erp-pro
// (pro/auth/src/js/nav-coffeeia.js): panel de 380×520, cabecera con la cara de
// CoffeeBot, portada con el muñeco vivo y la caja de escribir en el centro,
// burbujas con hora y copiar, y caja con el "+".
// El azul de erp-pro va como blue-* para seguir el acento del tema.

// Los números del muñeco de erp-pro (AV_* en nav-coffeeia.js).
const IA_BOT = {
    ojoW:    0.186,
    ojoH:    0.412,
    split:   15.46,
    pose:    { yaw: 0, pitch: 0, roll: 0 },
    alcance: 21,     // grados de giro por unidad de mirada; se dobla al seguir el cursor
    suelta:  2800,   // ms con el cursor quieto antes de volver a mirar al frente
    trans:   0.55,   // s que tarda una cara en dar paso a otra
    ocio:    300,    // s sin cursor ni teclas para dormirse
    pausa:   600,    // s de calma entre cara y cara del guion
    guion:   [{ gesto: 'curioso', dur: 1.8 }, { gesto: 'guino', dur: 1.0 }, { gesto: 'sorpresa', dur: 1.2 }],
    encaje:  'translate(200 180) scale(1.3723) translate(-160 -160)',
    clases:  { cuerpo: 'cb-cabeza', ojo: 'cb-ojo', punto: 'cb-ojo', grupoOjos: 'fx-ojos', grupoAcc: 'fx-acc' },
    gestos: {
        calma:    {},
        curioso:  { w: 0.21, h: 0.46, gaze: { yaw: 40, pitch: 16, roll: -20 } },
        sorpresa: { w: 0.34, h: 0.44, split: 19, escala: 1.05 },
        guino:    { split: 16.25, ojo2: { w: 0.42, h: 0.085 }, gaze: { yaw: -5.37, pitch: 4.55, roll: 6.7 } },
        sueno:    { w: 0.30, h: 0.06, zzz: true, respira: 0.6, gaze: { yaw: 12, pitch: -18, roll: -8 } }
    }
};

// CoffeeBot en reposo (CB_HEAD y CB_IDLE de nav-coffeeia.js): la cara de la cabecera.
const IA_COFFEEBOT = {
    head:   'M228.541 114.228C228.541 130.133 225.184 145.994 218.738 160.534C212.674 174.217 203.904 186.669 193.065 196.988C155.933 232.34 99.497 238.596 55.5255 212.24C45.097 205.99 35.6851 198.072 27.7451 188.866C19.1926 178.953 12.3686 167.569 7.65781 155.351C2.60712 142.264 0 128.257 0 114.228C0 98.3219 3.35751 82.4611 9.80315 67.9215C15.8672 54.2382 24.6377 41.7862 35.4767 31.4668C72.6081 -3.88483 129.044 -10.1413 173.016 16.2153C183.444 22.4653 192.856 30.3829 200.796 39.5896C209.349 49.5018 216.173 60.8859 220.883 73.1037C225.934 86.1906 228.541 100.198 228.541 114.228Z',
    encaje: 'translate(200 180) scale(1.1289) translate(-114.27 -114.23)',
    cabeza: 'translate(114.27 114.23) rotate(1.64) translate(-114.27 -114.23)',
    cx:     114.27,
    cy:     114.23,
    eyes:   [{"pts":[[-6.26,-20.75],[-3.91,-20.54],[-1.64,-19.92],[0.49,-18.9],[2.35,-17.45],[3.85,-15.64],[5.06,-13.61],[6.11,-11.5],[7.14,-9.37],[8.16,-7.24],[9.17,-5.11],[10.17,-2.97],[11.14,-0.82],[12.09,1.34],[13.01,3.52],[13.9,5.7],[14.75,7.9],[15.37,10.18],[15.48,12.53],[15.02,14.84],[13.97,16.95],[12.42,18.72],[10.48,20.05],[8.28,20.89],[5.94,21.2],[3.6,20.98],[1.36,20.26],[-0.69,19.09],[-2.45,17.51],[-3.84,15.61],[-4.93,13.52],[-5.85,11.35],[-6.75,9.16],[-7.68,6.99],[-8.62,4.83],[-9.59,2.67],[-10.57,0.53],[-11.57,-1.61],[-12.59,-3.74],[-13.69,-5.83],[-14.75,-7.94],[-15.59,-10.14],[-15.9,-12.47],[-15.52,-14.8],[-14.47,-16.9],[-12.87,-18.63],[-10.86,-19.84],[-8.61,-20.54]],"pos":[36.05,-43.69],"s":1.0},{"pts":[[-9.08,-20.13],[-6.97,-19.62],[-4.99,-18.73],[-3.17,-17.56],[-1.49,-16.18],[0.02,-14.62],[1.34,-12.9],[2.51,-11.07],[3.57,-9.18],[4.58,-7.25],[5.57,-5.32],[6.54,-3.37],[7.47,-1.41],[8.36,0.57],[9.23,2.56],[10.05,4.57],[10.84,6.59],[11.58,8.63],[12.28,10.69],[12.78,12.8],[12.94,14.97],[12.71,17.12],[11.89,19.12],[10.26,20.51],[8.14,20.87],[6.02,20.44],[4.07,19.48],[2.34,18.17],[0.84,16.61],[-0.41,14.84],[-1.44,12.92],[-2.29,10.93],[-3.06,8.9],[-3.82,6.86],[-4.62,4.84],[-5.44,2.83],[-6.3,0.84],[-7.2,-1.14],[-8.12,-3.11],[-9.08,-5.06],[-10.07,-6.99],[-11.1,-8.9],[-12.16,-10.8],[-13.15,-12.73],[-13.83,-14.79],[-13.93,-16.95],[-13.07,-18.91],[-11.24,-20.02]],"pos":[85.87,-53.88],"s":1.0}]
};

// -- Muñeco vivo --

// El motor de la portada de erp-pro (avAnimar): el blob respira y parpadea (eso lo
// pone forja-blob), sigue al cursor con la mirada, pone cara cuando se la piden y se
// duerme sin actividad. Cada cuadro repinta solo el encaje.
class IaBot {

    constructor(fig) {
        const G = IA_BOT;

        fig.innerHTML = `<svg viewBox="0 0 400 400" class="block w-full h-full" aria-hidden="true"><g transform="${G.encaje}"></g></svg>`;

        this.fig     = fig;
        this.encaje  = fig.querySelector('g');
        this.t       = 0;
        this.raf     = 0;
        this.k       = 1;        // lo andado de la transición entre dos caras, 0-1
        this.resta   = 0;        // s que le quedan a la cara antes de volver a calma
        this.ocio    = 0;
        this.turno   = 0;
        this.espera  = G.pausa;
        this.visto   = '';
        this.de      = this.pose('calma');
        this.a       = this.de;
        this.nombre  = 'calma';
        this.mira    = { x: 0, y: 0 };
        this.destino = { x: 0, y: 0 };
        this.fijo    = 0;        // cuánto te está siguiendo, 0-1
        this.pedido  = 0;
        this.ultMira = 0;
        this.looking = true;
        this.still   = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

        this.loop    = this.loop.bind(this);
        this.onMove  = this.onMove.bind(this);
        this.alive   = this.alive.bind(this);
        this.release = this.release.bind(this);

        if (this.still) {
            this.paint(this.de, 0, true);
            return;
        }

        window.addEventListener('pointermove', this.onMove, { passive: true });
        window.addEventListener('keydown', this.alive, { passive: true });
        document.addEventListener('mouseleave', this.release);
        window.addEventListener('blur', this.release);

        this.frame(0);
        this.resume();
    }

    // -- Public API --

    resume() {
        if (this.raf || this.still) return;
        this.last = performance.now();
        this.raf  = requestAnimationFrame(this.loop);
    }

    pause() {
        cancelAnimationFrame(this.raf);
        this.raf = 0;
    }

    stop() {
        this.pause();
        window.removeEventListener('pointermove', this.onMove);
        window.removeEventListener('keydown', this.alive);
        document.removeEventListener('mouseleave', this.release);
        window.removeEventListener('blur', this.release);
    }

    // Una cara pedida cuenta como el cambio del guion: la calma vuelve a contar entera.
    gesture(nombre, dur) {
        if (this.still || !IA_BOT.gestos[nombre]) return;
        this.alive();
        this.toGesture(nombre, dur);
        this.visto  = nombre;
        this.espera = IA_BOT.pausa;
        this.resume();
    }

    // Mientras se escribe mira al frente: una cara girando junto al texto distrae.
    look(on) {
        this.looking = !!on;
        if (!this.looking) this.release();
    }

    // -- Motor --

    loop(now) {
        const dt = Math.min((now - this.last) / 1000, 0.05);
        this.last = now;
        this.t   += dt;
        this.frame(dt);
        this.raf = requestAnimationFrame(this.loop);
    }

    frame(dt) {
        const G = IA_BOT;

        if (dt > 0) {
            if (this.k < 1) {
                this.k = Math.min(1, this.k + dt / G.trans);
            } else if (this.resta > 0) {
                this.resta -= dt;
                if (this.resta <= 0) this.toGesture('calma', 0);
            } else if (this.nombre === 'calma') {
                this.espera -= dt;
                if (this.espera <= 0) {
                    let paso = G.guion[this.turno % G.guion.length];
                    if (paso.gesto === this.visto) paso = G.guion[++this.turno % G.guion.length];
                    this.turno++;
                    this.espera = G.pausa;
                    this.visto  = paso.gesto;
                    this.toGesture(paso.gesto, paso.dur);
                }
            }

            this.ocio += dt;
            if (this.ocio >= G.ocio && this.nombre === 'calma') this.toGesture('sueno', 0);
        }

        if (this.pedido && performance.now() - this.ultMira > G.suelta) this.release();

        // Suavizados de la forja (por cuadro a 60 fps), sin depender de los FPS.
        this.fijo += (this.pedido - this.fijo) * (dt > 0 ? 1 - Math.pow(1 - 0.055, dt * 60) : 1);

        const ks = dt > 0 ? 1 - Math.pow(1 - (0.07 + 0.10 * this.fijo), dt * 60) : 1;
        this.mira.x += (this.destino.x - this.mira.x) * ks;
        this.mira.y += (this.destino.y - this.mira.y) * ks;

        this.paint(this.blend(this.de, this.a, this.smooth(this.k)), this.t, false);
    }

    paint(g, t, quieto) {
        this.encaje.innerHTML = window.Bloub.cuadro(
            { forma: 'gota', gesto: g, accesorio: 'ninguno', anim: 'ninguna', color: '#FFFFFF' },
            t, this.mira,
            { margen: 30, clases: IA_BOT.clases, quieto: quieto, fijo: this.fijo, alcance: IA_BOT.alcance * (1 + this.fijo) }
        );
    }

    // Parte de lo que se ve ahora (la mezcla en curso): dos avisos pegados no dan tirón.
    toGesture(nombre, dur) {
        this.de     = this.blend(this.de, this.a, this.smooth(this.k));
        this.a      = this.pose(nombre);
        this.nombre = nombre;
        this.k      = 0;
        this.resta  = dur > 0 ? dur : 0;
    }

    alive() {
        this.ocio = 0;
        if (this.nombre === 'sueno') this.toGesture('calma', 0);
    }

    // La mirada se mide desde el centro del muñeco contra la ventana: el giro
    // completo se agota en los bordes de la pantalla.
    onMove(e) {
        this.alive();
        if (!this.looking) return;

        const r = this.fig.getBoundingClientRect();
        if (!r.width) return;

        this.destino.x = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (window.innerWidth * 0.38)));
        this.destino.y = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (window.innerHeight * 0.40)));
        this.pedido    = 1;
        this.ultMira   = performance.now();
    }

    release() {
        this.pedido    = 0;
        this.destino.x = 0;
        this.destino.y = 0;
    }

    // -- Helpers --

    pose(nombre) {
        const g = IA_BOT.gestos[nombre] || IA_BOT.gestos.calma;
        return this.blend(g, g, 0);
    }

    // Interpola los números de dos caras; lo que no es número cambia a la mitad.
    blend(a, b, k) {
        const G   = IA_BOT;
        const val = (g, campo, def) => g[campo] == null ? def : g[campo];
        const mix = (x, y) => x + (y - x) * k;
        const ga  = a.gaze || G.pose;
        const gb  = b.gaze || G.pose;
        const wa  = val(a, 'w', G.ojoW), wb = val(b, 'w', G.ojoW);
        const ha  = val(a, 'h', G.ojoH), hb = val(b, 'h', G.ojoH);
        const oa  = a.ojo2 || { w: wa, h: ha };
        const ob  = b.ojo2 || { w: wb, h: hb };

        return {
            w:       mix(wa, wb),
            h:       mix(ha, hb),
            ojo2:    { w: mix(oa.w, ob.w), h: mix(oa.h, ob.h) },
            split:   mix(val(a, 'split', G.split), val(b, 'split', G.split)),
            escala:  mix(val(a, 'escala', 1), val(b, 'escala', 1)),
            respira: mix(val(a, 'respira', 1), val(b, 'respira', 1)),
            gaze:    { yaw: mix(ga.yaw, gb.yaw), pitch: mix(ga.pitch, gb.pitch), roll: mix(ga.roll, gb.roll) },
            zzz:     k < 0.5 ? !!a.zzz : !!b.zzz,
            arco:    k < 0.5 ? !!a.arco : !!b.arco
        };
    }

    smooth(k) {
        return k * k * (3 - 2 * k);
    }
}

// -- Píldora --

// Lo de Compacto de Notch Buddy (erp-pro, ERP24/avatars/notch-buddy.html, pestaña
// Notch): con el chat cerrado y coffeeIA trabajando, una píldora cuelga del botón de
// la navbar con el muñeco buscando (p_busca del motor), del color de lo que hace, y
// el paso en curso. Al terminar dice «Listo» o «No se pudo» un rato y se recoge sola;
// tocarla abre el chat. El chat no cambia. Sin motor o sin botón en la navbar, no sale.
const IA_PIL = {
    // La gota con `sinZoom` mide 188 de diámetro, centrada en (160, 160): con esta
    // ventana ocupa 0,6 de la caja (24 px de cuerpo en la caja de 40).
    vista:  '3.333 3.333 313.333 313.333',
    clases: { cuerpo: 'iac-pil-cuerpo', ojo: 'iac-pil-ojo', punto: 'iac-pil-punto' },
    frente: { yaw: 0, pitch: 0, roll: 0 },
    ancho:  236,
    // Los estados de Notch Buddy (STATES): su color, cuánto sube el tinte, y la
    // animación y el gesto que el motor ya tiene para cada uno.
    estados: {
        busca: { col: '#6366F1', tint: 0.72, anim: 'p_busca', gesto: 'curioso' },
        listo: { col: '#34D399', tint: 0.35, anim: 'p_listo', gesto: 'feliz' },
        error: { col: '#F4505E', tint: 0.78, anim: 'p_error', gesto: 'triste' }
    },
    queda:  4500   // ms que se queda «Listo» o «No se pudo» antes de recogerse
};

class IaPildora {

    constructor(chat) {
        this.chat    = chat;
        this.id      = `${chat.opts.id}_pildora`;
        this.est     = null;
        this.col     = [99, 102, 241];
        this.colT    = this.col;
        this.tint    = 0;
        this.tintT   = 0;
        this.desde   = 0;
        this.raf     = 0;
        this.reloj   = 0;
        this.visible = false;
        this.gestos  = {};
        this.still   = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
        this.loop    = this.loop.bind(this);

        $(`#${this.id}`).remove();
        $('body').append(`
            <button type="button" id="${this.id}" style="width:${IA_PIL.ancho}px" class="iac-pildora fixed z-[1040] h-10 flex items-center gap-2 pl-0.5 pr-3.5 bg-white border border-[#E2E8F0] rounded-full shadow-[0_10px_28px_rgba(15,23,42,.14)] text-left" aria-live="polite">
                <svg viewBox="${IA_PIL.vista}" class="w-10 h-10 flex-shrink-0" aria-hidden="true"></svg>
                <span class="min-w-0 leading-[1.3]">
                    <b data-pil-big class="block text-[11.5px] font-bold text-[#0F172A] truncate"></b>
                    <span data-pil-sub class="block text-[10px] text-[#94A3B8] truncate"></span>
                </span>
            </button>`);

        this.el  = $(`#${this.id}`);
        this.svg = this.el.find('svg')[0];
        this.el.on('click', () => chat.open());
    }

    // -- Public API --

    // Cuelga buscando, con el paso en curso. Si ya colgaba, solo cambia el texto.
    trabaja(label) {
        clearTimeout(this.reloj);
        this.poner('busca', label, '');
        this.show();
    }

    paso(label) {
        if (this.est === 'busca') this.el.find('[data-pil-big]').text(label);
    }

    // Solo si estaba colgada: con el chat abierto la respuesta ya se ve ahí.
    termina(ok) {
        if (!this.visible) return;

        this.poner(ok ? 'listo' : 'error', ok ? 'Listo' : 'No se pudo', ok ? 'Toca para ver la respuesta' : 'Toca para ver qué pasó');
        clearTimeout(this.reloj);
        this.reloj = setTimeout(() => this.hide(), IA_PIL.queda);
    }

    hide() {
        clearTimeout(this.reloj);
        if (!this.visible) return;

        this.visible = false;
        this.el.removeClass('is-vista').addClass('is-cerrando');
        setTimeout(() => {
            if (this.visible) return;
            cancelAnimationFrame(this.raf);
            this.raf = 0;
        }, 400);
    }

    destroy() {
        this.hide();
        cancelAnimationFrame(this.raf);
        this.el.remove();
    }

    // -- Motor --

    // El tinte arranca en cero al colgar: el color sube desde abajo mientras crece.
    show() {
        if (!this.place()) return;

        if (!this.visible) {
            this.tint = 0;
            this.col  = this.colT;
        }

        this.visible = true;
        this.el.removeClass('is-cerrando').addClass('is-vista');

        if (!this.raf) {
            this.last = performance.now();
            this.raf  = requestAnimationFrame(this.loop);
        }
    }

    poner(est, big, sub) {
        const E = IA_PIL.estados[est];

        if (est !== this.est) {
            this.est   = est;
            this.desde = performance.now();
        }

        this.colT  = this.rgb(E.col);
        this.tintT = E.tint;
        this.sub   = sub;
        this.el.find('[data-pil-big]').text(big);
        this.el.find('[data-pil-sub]').text(sub || 'CoffeeIA');
    }

    // Bajo la navbar, con el borde derecho a 26 px del centro del botón: crece desde ahí.
    place() {
        const btn = $('[data-ia-nav]:visible')[0];
        if (!btn) return false;

        const r   = btn.getBoundingClientRect();
        const bar = (btn.closest('.navbar-main, header, nav') || btn).getBoundingClientRect();
        this.el.css({ top: Math.round(bar.bottom + 6), left: Math.max(8, Math.round(r.left + r.width / 2 + 26 - IA_PIL.ancho)) });
        return true;
    }

    // El color y el tinte se mezclan como Bot.update de Buddy; el muñeco se repinta
    // a 30 cuadros y el reloj de segundos, de paso.
    loop(now) {
        this.raf = requestAnimationFrame(this.loop);

        const dt = Math.min(Math.max((now - this.last) / 1000, 0), 0.05);
        this.last = now;

        const k = 1 - Math.pow(0.002, dt);
        this.col  = this.col.map((v, i) => v + (this.colT[i] - v) * k);
        this.tint += (this.tintT - this.tint) * (1 - Math.pow(0.0008, dt));

        if (now - (this.pinto || 0) < 33) return;
        this.pinto = now;

        this.place();

        if (this.est === 'busca' && !this.sub && this.chat.avance) {
            this.el.find('[data-pil-sub]').text(`CoffeeIA · ${this.chat.segundos(this.chat.avance.t0)} s`);
        }

        // Buscando da vueltas mientras dure; «Listo» y «No se pudo» pasan una vez y se
        // quedan en su último cuadro (a media vuelta de Terminado no se le ven los ojos).
        const A    = window.Bloub.ANIMS[IA_PIL.estados[this.est].anim];
        let   fase = Math.max(0, now - this.desde) / 1000;
        if (this.est !== 'busca' && A) fase = Math.min(fase, A.per - 0.001);

        this.svg.innerHTML = this.paint(now / 1000, fase);
    }

    // El motor con la piel de inventory y, encima del cuerpo, el tinte del estado: su
    // color subiendo desde abajo hasta un cuarto de radio por encima del centro, a
    // 0,92 × `tint` (Bot.draw de Buddy). El filo va en otra copia del contorno, encima
    // del tinte, para que no lo tape.
    paint(t, fase) {
        const B = window.Bloub;
        const E = IA_PIL.estados[this.est];
        const a = 0.92 * this.tint;
        const g = this.gestos[E.gesto] || (this.gestos[E.gesto] = Object.assign({}, (B.GESTOS[E.gesto] || B.GESTOS.calma).f(0.62) || {}, { gaze: IA_PIL.frente }));

        let s = B.cuadro(
            { forma: 'gota', gesto: g, accesorio: 'ninguno', anim: B.ANIMS[E.anim] ? E.anim : 'ninguna', color: '#FFFFFF' },
            t, null,
            { sinZoom: true, pose: IA_PIL.frente, clases: IA_PIL.clases, quieto: this.still, fase: this.still ? null : fase }
        );

        s = s.replace(/<path id="b\d+" d="([^"]*)" class="iac-pil-cuerpo"\/>/, (todo, d) =>
            todo + (a > 0.004 ? `<path d="${d}" fill="url(#${this.id}T)"/>` : '') + `<path d="${d}" class="iac-pil-filo"/>`);

        if (a <= 0.004) return s;

        const c = `rgb(${this.col.map(Math.round).join(',')})`;

        return `<defs><linearGradient id="${this.id}T" x1="0" y1="1" x2="0" y2="0.375"><stop offset="0" stop-color="${c}" stop-opacity="${a.toFixed(3)}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></linearGradient></defs>${s}`;
    }

    // -- Helpers --

    rgb(hex) {
        return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    }
}

// -- Chat --

class IaChat {

    constructor(options) {
        const defaults = {
            parent:      'body',
            id:          'iaChat',
            // Dónde abre el panel (clases Tailwind de posición fija): al centro de la pantalla.
            dock:        'inset-0 m-auto',
            title:       'Asistente',
            subtitle:    '',
            placeholder: 'Escribe un mensaje…',
            accept:      '',
            maxFiles:    3,
            welcome:     '',
            suggestions: [],
            questions:   ['¿Por dónde empezamos?', '¿En qué te ayudo hoy?', '¿Qué buscamos hoy?', '¿Con qué arrancamos?', '¿Qué hacemos primero?'],
            labels: {
                placeholderHola: 'Escríbelo aquí…',
                more:       'Más opciones',
                attach:     'Adjuntar archivos',
                attachHint: 'Excel, CSV o una imagen',
                send:       'Enviar',
                expand:     'Ampliar',
                clear:      'Borrar la conversación',
                close:      'Cerrar',
                copy:       'Copiar',
                drop:       'Suéltalo aquí',
                notice:     'puede equivocarse. Comprueba los datos importantes antes de decidir con ellos.',
                reading:    'Leyendo…',
                readingImage: 'Transcribiendo la foto…',
                readingSheet: 'Leyendo el Excel…',
                thinking:   'Pensando…',
                thinkingMore: 'Sigo dándole vueltas…',
                applying:   'Aplicando…',
                preview:    'Vista previa',
                selectAll:  'Todos',
                confirm:    'Aplicar',
                discard:    'Descartar',
                applied:    'Aplicado',
                discarded:  'Descartado',
                replaced:   'Reemplazada por una vista previa más nueva',
                nothing:    'Nada que aplicar',
                invalid:    'no aplican',
                badFormat:  'Formato no admitido',
                tooMany:    'Máximo de archivos alcanzado',
                error:      'Algo salió mal. Inténtalo otra vez.'
            },
            actions:   {},
            onAttach:  null,
            onSend:    null,
            onConfirm: null
        };

        const o = options || {};

        this.opts         = Object.assign({}, defaults, o);
        this.opts.labels  = Object.assign({}, defaults.labels, o.labels || {});
        this.opts.actions = Object.assign({}, o.actions || {});

        this.history   = [];
        this.texts     = [];
        this.files     = [];
        this.previews  = {};
        this.busy      = false;
        this.carga     = false;
        this.frase     = null;
        this.dirty     = false;
        this.expanded  = false;
        this.ticker    = null;
        this.dragDepth = 0;
        this.bot       = null;
        this.pildora   = null;

        this.ensureStyles();
        this.mount();
        this.bindEvents();
        this.welcome();
    }

    // -- Public API --

    // Con la portada a la vista el muñeco levanta la vista, como en erp-pro al abrir.
    // Cerrado, abre siempre en su lugar (`dock`) aunque antes se haya arrastrado.
    open() {
        if (!this.isOpen()) this.resetPlace();
        $(`#${this.opts.id}`).removeClass('hidden').addClass('flex');
        this.autosize();
        this.keepInside();
        this.scrollBottom();
        $(`#${this.opts.id}_input`).trigger('focus');
        if (this.bot) {
            this.bot.resume();
            this.bot.gesture('curioso', 3);
        }
        if (this.pildora) this.pildora.hide();
    }

    // Cerrado no se ve: el motor del muñeco se pausa. Si se cierra a medio trabajo,
    // la píldora cuelga del botón con lo que va haciendo.
    close() {
        this.menu(false);
        $(`#${this.opts.id}`).removeClass('flex').addClass('hidden');
        if (this.bot) this.bot.pause();
        if (this.busy && this.pill()) this.pildora.trabaja(this.step.label);
    }

    toggle() {
        this.isOpen() ? this.close() : this.open();
    }

    // Lo quita del todo: el muñeco, el reloj de espera, los eventos de la ventana y
    // el panel. Para un chat que vive lo que dura otra pieza (un modal).
    destroy() {
        const o = this.opts;

        clearInterval(this.ticker);
        this.stopBot();
        if (this.pildora) this.pildora.destroy();
        $(document).off(`mousedown.${o.id}`);
        $(window).off(`resize.${o.id}`);
        $(`#${o.id}`).remove();
    }

    isOpen() {
        return !$(`#${this.opts.id}`).hasClass('hidden');
    }

    // La píldora nace la primera vez que hace falta, si hay motor y botón en la navbar.
    pill() {
        if (!this.pildora && window.Bloub && window.Bloub.cuadro && $('[data-ia-nav]').length) this.pildora = new IaPildora(this);
        return this.pildora;
    }

    // Vuelve a la portada: se van mensajes, historial, adjuntos y vistas previas.
    clear() {
        if (this.busy || !this.dirty) return;
        if (Object.values(this.previews).some(p => p.state === 'applying')) return;

        this.history  = [];
        this.texts    = [];
        this.files    = [];
        this.previews = {};
        this.dirty    = false;

        this.leavePortada();
        $(`#${this.opts.id}_msgs`).empty();
        $(`#${this.opts.id}_input`).val('');
        this.autosize();
        this.renderChips();
        this.welcome();
        this.syncClear();
        $(`#${this.opts.id}_input`).trigger('focus');
    }

    // -- Render --

    mount() {
        const o    = this.opts;
        const l    = o.labels;
        const tool = 'w-7 h-7 p-1 rounded-lg flex items-center justify-center text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#334155] transition-colors';

        $(`#${o.id}`).remove();

        const parent = o.parent === 'body' ? $('body') : $(`#${o.parent}`);

        parent.append(`
            <div id="${o.id}" class="hidden fixed ${o.dock} z-[1040] w-[380px] max-w-[calc(100vw-16px)] h-[520px] max-h-[72vh] flex-col bg-white border border-[#E2E8F0] rounded-2xl shadow-[0_22px_55px_rgba(15,23,42,.20)] overflow-hidden transition-[width,height] duration-200">
                <div data-head class="flex items-center justify-between gap-2 px-[11px] py-[9px] border-b border-[#F1F5F9] flex-shrink-0 cursor-grab touch-none select-none">
                    <div class="flex items-center gap-[9px] min-w-0 flex-1">
                        <span id="${o.id}_cara" class="iac-mini block w-10 h-10 -my-[6px] -ml-[4px] flex-shrink-0">${this.coffeeBot()}</span>
                        <div class="min-w-0 flex-1">
                            <div class="text-[13.5px] font-bold text-[#0F2C4C] truncate">${this.marca(o.title)}</div>
                            <div class="text-[10.5px] text-[#94A3B8] mt-px truncate">${this.esc(o.subtitle)}</div>
                        </div>
                    </div>
                    <div class="flex items-center gap-1.5 flex-shrink-0">
                        <button type="button" id="${o.id}_clear" title="${this.esc(l.clear)}" disabled class="${tool} disabled:text-[#E2E8F0] disabled:hover:bg-transparent disabled:cursor-not-allowed">
                            <i data-lucide="eraser" class="w-4 h-4"></i>
                        </button>
                        <button type="button" id="${o.id}_expand" title="${this.esc(l.expand)}" class="${tool}">
                            <i data-lucide="maximize-2" class="w-4 h-4"></i>
                        </button>
                        <button type="button" id="${o.id}_close" title="${this.esc(l.close)}" class="${tool}">
                            <i data-lucide="x" class="w-4 h-4"></i>
                        </button>
                    </div>
                </div>

                <div id="${o.id}_msgs" class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-[14px] flex flex-col gap-[11px] bg-white [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#E2E8F0] hover:[&::-webkit-scrollbar-thumb]:bg-[#CBD5E1]"></div>

                <div id="${o.id}_foot" class="relative border-t border-[#F1F5F9] bg-[#F8FAFC] px-3 py-[11px] flex-shrink-0">
                    <div id="${o.id}_composer">
                        <div id="${o.id}_chips" class="hidden flex-wrap gap-[5px] mb-1.5 max-h-[135px] overflow-y-auto"></div>
                        <div class="iac-wrap flex items-end gap-[7px] bg-white border border-[#CBD5E1] rounded-[11px] p-1 transition-shadow focus-within:border-[#7C3AED] focus-within:shadow-[0_0_0_3px_rgba(124,58,237,.13)]">
                            <div class="relative flex-shrink-0">
                                <button type="button" id="${o.id}_plus" title="${this.esc(l.more)}" aria-haspopup="true" aria-expanded="false" class="w-[30px] h-[30px] rounded-full flex items-center justify-center text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#7C3AED] transition-colors">
                                    <i data-lucide="plus" class="w-[17px] h-[17px] transition-transform duration-150"></i>
                                </button>
                                <div id="${o.id}_menu" role="menu" class="hidden absolute left-0 bottom-[calc(100%+10px)] z-[46] min-w-[232px] p-1 bg-white border border-[#DBE2EA] rounded-[11px] shadow-[0_12px_28px_rgba(15,44,76,.16)]">
                                    <button type="button" id="${o.id}_attach" role="menuitem" class="group flex items-center gap-2.5 w-full px-[9px] py-[7px] rounded-lg text-left text-[#0F2C4C] hover:bg-[#F5F3FF]">
                                        <span class="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-[#F1F5F9] text-[#475569] group-hover:bg-[#EDE9FE] group-hover:text-[#7C3AED]">
                                            <i data-lucide="paperclip" class="w-[15px] h-[15px]"></i>
                                        </span>
                                        <span class="min-w-0 flex flex-col leading-[1.3]">
                                            <b class="text-[12px] font-bold">${this.esc(l.attach)}</b>
                                            <span class="text-[10.5px] text-[#8B99AB] truncate max-w-[170px]">${this.esc(l.attachHint)}</span>
                                        </span>
                                    </button>
                                </div>
                            </div>
                            <textarea id="${o.id}_input" rows="1" placeholder="${this.esc(o.placeholder)}" class="iac-input flex-1 min-w-0 resize-none bg-transparent border-0 outline-none text-[12.5px] leading-[1.45] text-[#1E293B] placeholder:text-[#94A3B8] py-1.5 px-0.5 max-h-[132px]"></textarea>
                            <button type="button" id="${o.id}_send" title="${this.esc(l.send)}" class="iac-send w-[30px] h-[30px] rounded-[9px] flex items-center justify-center text-white bg-gradient-to-br from-blue-800 to-blue-600 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 transition-opacity">
                                <i data-lucide="arrow-up" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </div>
                    <input type="file" id="${o.id}_file" class="hidden" multiple accept="${this.esc(o.accept)}">
                </div>

                <div id="${o.id}_drop" class="hidden absolute inset-0 z-40 items-center justify-center rounded-2xl bg-[rgba(248,250,252,.96)] border-2 border-dashed border-[#7C3AED] pointer-events-none">
                    <div class="flex flex-col items-center gap-[5px] text-center px-5 text-[#7C3AED]">
                        <i data-lucide="file-up" class="w-6 h-6"></i>
                        <b class="text-[13px]">${this.esc(l.drop)}</b>
                        <span class="text-[11px] text-[#64748B]">${this.esc(l.attachHint)}</span>
                    </div>
                </div>
            </div>`);

        this.icons();
    }

    // Portada: muñeco, fecha, saludo, pregunta al azar, la caja de escribir y las
    // sugerencias. Se va con el primer mensaje.
    welcome() {
        const o      = this.opts;
        const hora   = new Date().getHours();
        const saludo = hora < 12 ? 'Buenos días' : (hora < 20 ? 'Buenas tardes' : 'Buenas noches');
        const preg   = o.questions[Math.floor(Math.random() * o.questions.length)] || '';
        const motor  = !!(window.Bloub && window.Bloub.cuadro);
        const bot    = motor
            ? '<span data-hola-bot class="iac-hola-bot block w-20 h-20 mb-[12px]"></span>'
            : '<span class="w-16 h-16 mb-3 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0"><i data-lucide="sparkles" class="w-7 h-7"></i></span>';

        const chips = o.suggestions.map(s => `
            <button type="button" data-suggestion="${this.esc(s)}" class="inline-flex items-center gap-1.5 px-3 py-[7px] border border-[#E2E8F0] rounded-full bg-white text-[11.5px] font-medium text-[#42546B] leading-[1.2] text-left hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                <i data-lucide="corner-down-right" class="w-3 h-3 flex-shrink-0 text-[#94A3B8]"></i>${this.esc(s)}
            </button>`).join('');

        this.appendNode(`
            <div data-hola class="flex flex-col flex-grow text-center px-[14px] pt-[18px] pb-1.5">
                <div class="my-auto flex flex-col items-center">
                    ${bot}
                    <div class="mb-2.5 text-[9.5px] font-semibold tracking-[.2em] uppercase text-[#94A3B8]">${this.esc(this.fechaHoy())}</div>
                    <div class="text-[24px] font-medium text-[#0F172A] tracking-[-.5px] leading-[1.15]">Hola, soy ${this.marca(o.title)}</div>
                    <p class="mt-[5px] text-[13.5px] leading-[1.4] text-[#64748B]">${saludo}</p>
                    <div class="mt-4 text-[15px] font-bold text-[#0F172A] tracking-[-.2px]">${this.esc(preg)}</div>
                    <span class="block w-[46px] h-[3px] mx-auto mt-2 rounded-full bg-gradient-to-r from-blue-600 to-blue-200"></span>
                    ${o.welcome ? `<p class="mt-3 text-[11.5px] leading-[1.5] text-[#64748B] whitespace-pre-wrap">${this.esc(o.welcome)}</p>` : ''}
                    <div data-hola-caja class="w-full"></div>
                    ${chips ? `<div class="mt-3 flex flex-wrap justify-center gap-1.5">${chips}</div>` : ''}
                </div>
                <div class="pt-4 text-[9.5px] leading-[1.45] text-[#94A3B8]">${this.esc(o.title)} ${this.esc(o.labels.notice)}</div>
            </div>`);

        this.dockComposer(true);
        this.startBot();
    }

    // La caja de escribir viaja: en la portada va al centro (como en erp-pro) y con
    // el primer mensaje vuelve al pie. Se mueve el nodo, así conserva lo escrito,
    // los adjuntos y sus eventos.
    dockComposer(portada) {
        const o     = this.opts;
        const caja  = $(`#${o.id}_composer`);
        const input = $(`#${o.id}_input`);
        const foco  = document.activeElement === input[0];
        const hueco = $(`#${o.id}_msgs [data-hola-caja]`);
        const hola  = !!portada && hueco.length > 0;

        if (hola) hueco.append(caja);
        else $(`#${o.id}_foot`).prepend(caja);

        caja.toggleClass('iac-portada', hola);
        $(`#${o.id}_foot`).toggleClass('hidden', hola);
        $(`#${o.id}`).toggleClass('iac-con-portada', hola);
        input.attr('placeholder', hola ? o.labels.placeholderHola : o.placeholder);
        this.autosize();
        if (foco) input.trigger('focus');
    }

    leavePortada() {
        this.stopBot();
        this.dockComposer(false);
        $(`#${this.opts.id}_msgs [data-hola]`).remove();
    }

    // El muñeco de la portada nace pausado si el chat está cerrado, y sin mirar al
    // cursor si se está escribiendo.
    startBot() {
        this.stopBot();

        const fig = $(`#${this.opts.id}_msgs [data-hola-bot]`)[0];
        if (!fig) return;

        this.bot = new IaBot(fig);
        if (!this.isOpen()) this.bot.pause();
        this.bot.look(document.activeElement !== $(`#${this.opts.id}_input`)[0]);
    }

    stopBot() {
        if (this.bot) this.bot.stop();
        this.bot = null;
    }

    // -- Mensajes --

    addMessage(role, text, fileNames) {
        const esUser = role === 'user';
        const idx    = this.texts.push(String(text || '')) - 1;
        const tone   = esUser
            ? 'bg-blue-600 text-white rounded-[13px] rounded-br-[4px]'
            : (role === 'error'
                ? 'bg-red-50 text-red-700 border border-red-200 rounded-[13px] rounded-bl-[4px]'
                : 'bg-[#F1F5F9] text-[#1E293B] rounded-[13px] rounded-bl-[4px]');

        const files = (fileNames || []).map(n => `
            <span class="inline-flex items-center gap-1 text-[10.5px] bg-white/20 rounded-md px-1.5 py-0.5"><i data-lucide="paperclip" class="w-3 h-3"></i>${this.esc(n)}</span>`).join('');

        const copy = text ? `
            <button type="button" data-copy="${idx}" title="${this.esc(this.opts.labels.copy)}" class="p-[3px] rounded-[5px] leading-none text-[#94A3B8] hover:bg-[rgba(15,44,76,.06)] hover:text-blue-600 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all">
                <i data-lucide="copy" class="w-3 h-3"></i>
            </button>` : '';

        this.appendNode(`
            <div class="flex ${esUser ? 'justify-end' : ''} min-w-0">
                <div class="group flex flex-col ${esUser ? 'items-end' : 'items-start'} min-w-0 max-w-[92%]">
                    <div class="max-w-full ${tone} px-3 py-[9px] text-[12.5px] leading-[1.5] whitespace-pre-wrap break-words">${files ? `<div class="flex flex-wrap gap-1 ${text ? 'mb-[5px]' : ''}">${files}</div>` : ''}${this.esc(text)}</div>
                    <div class="mt-[3px] px-[3px] flex items-center gap-1.5 ${esUser ? 'flex-row-reverse' : ''}">
                        <span class="text-[10px] text-[#94A3B8] tabular-nums tracking-[.02em]">${this.hora()}</span>
                        ${copy}
                    </div>
                </div>
            </div>`);
    }

    setBusy(on, label) {
        const o = this.opts;

        this.busy = on;
        this.syncSend();
        this.syncClear();
        $(`#${o.id}_cara`).toggleClass('is-activo', !!on);

        clearInterval(this.ticker);
        $(`#${o.id}_typing`).remove();

        if (!on) return;

        this.steps  = [];
        this.step   = { label: label || o.labels.thinking, at: Date.now(), inicial: !label };
        this.avance = { p: 0, desde: 0, hasta: 1, at: Date.now(), t0: Date.now(), fin: 0 };
        this.renderBusy();

        this.ticker = setInterval(() => this.tickBusy(), this.carga ? 80 : 250);

        if (!this.isOpen() && this.pill()) this.pildora.trabaja(this.step.label);
    }

    // Paso del proceso real, lo manda quien atiende onSend con la fracción del total
    // que queda hecha al terminarlo (`hasta`, 0-1). El «Pensando» genérico del
    // arranque se reemplaza; al pasar a otro paso el anterior queda palomeado con su
    // tiempo y la barra llega a su marca.
    progress(label, hasta) {
        if (!this.busy) return;

        const a = this.avance;

        if (!this.step.inicial) {
            this.steps.push({ label: this.step.label, secs: this.segundos(this.step.at) });
            a.p = a.desde = a.hasta;
        }

        a.hasta = Math.min(1, Math.max(a.desde, hasta == null ? 1 : Number(hasta)));
        a.at    = Date.now();

        this.step = { label: label, at: Date.now() };
        this.renderBusy();
        if (this.pildora) this.pildora.paso(label);
    }

    // Al terminar bien, la barra se completa (y coffeeIA da su brinco) antes de dar
    // paso a la respuesta. Sin archivo no hay barra que completar.
    finishBusy() {
        if (!this.busy || !this.carga) return Promise.resolve();

        this.avance.fin = Date.now();
        return new Promise(resolve => setTimeout(resolve, 450));
    }

    // Dentro de un paso no hay avance que medir (el modelo contesta de una vez): la
    // barra se acerca a la marca del paso sin alcanzarla (90 % del tramo a lo más) y
    // solo la toca cuando el paso de verdad termina.
    tickBusy() {
        if (!this.carga) {
            this.tickPensando();
            return;
        }

        const o    = this.opts;
        const a    = this.avance;
        const meta = a.desde + (a.hasta - a.desde) * 0.9 * (1 - Math.exp(-(Date.now() - a.at) / 8000));

        a.p = Math.max(a.p, meta);

        $(`#${o.id}_carga`).html(this.cargaHtml());
        $(`#${o.id}_secs`).text(this.segundos(this.step.at) + ' s');
    }

    // La animación «Cargando» del vestidor de erp-pro con la barra donde va el
    // proceso: un cuadro fijo por tic en vez del bucle que se llena solo cada 3 s.
    // Sin el motor, una barra simple.
    cargaHtml() {
        const a  = this.avance;
        const B  = window.Bloub;
        const an = B && B.CASA && B.ANIMS ? B.ANIMS.p_carga : null;

        if (!an) {
            return `<span class="block w-16 h-1.5 rounded-full bg-[#E2E8F0] overflow-hidden"><span class="block h-full rounded-full bg-blue-600" style="width:${Math.round((a.fin ? 1 : a.p) * 100)}%"></span></span>`;
        }

        const u   = a.fin ? 0.78 + 0.17 * Math.min(1, (Date.now() - a.fin) / 450) : this.faseCarga(a.p);
        const rec = B.receta(Object.assign({}, B.CASA[0], { anim: 'p_carga', fondo: '#F1F5F9' }));

        return B.svg(rec, (Date.now() - a.t0) / 1000, null, { centrado: true, fase: u * an.per });
    }

    // En cargaK (forja-blob.js) la barra se llena entre el 6 % y el 78 % de la vuelta
    // con una curva suave (smoothstep); esto la invierte para pedir el cuadro con la
    // barra llena justo en `p`.
    faseCarga(p) {
        const s = 0.5 - Math.sin(Math.asin(1 - 2 * Math.min(1, Math.max(0, p))) / 3);
        return 0.06 + 0.72 * s;
    }

    // La burbuja de espera: con archivo, la barra de avance y la lista de pasos.
    renderBusy() {
        if (!this.carga) {
            this.renderPensando();
            return;
        }

        const o      = this.opts;
        const motor  = !!(window.Bloub && window.Bloub.CASA);
        const espera = `<span id="${o.id}_carga" class="${motor ? 'w-24 h-24 -my-7 -ml-2 [&>svg]:w-full [&>svg]:h-full' : ''} flex items-center flex-shrink-0">${this.cargaHtml()}</span>`;

        const hechos = this.steps.map(s => `
            <span class="flex items-center gap-1 text-[10.5px] text-[#94A3B8]">
                <i data-lucide="check" class="w-3 h-3 text-emerald-500 flex-shrink-0"></i>${this.esc(s.label)} <span class="tabular-nums">${s.secs} s</span>
            </span>`).join('');

        const html = `
            <div id="${o.id}_typing" class="flex">
                <div class="bg-[#F1F5F9] rounded-[13px] rounded-bl-[4px] px-3 py-[11px] flex items-center gap-1 overflow-hidden max-w-[92%]">
                    ${espera}
                    <div class="ml-1 min-w-0 flex flex-col gap-0.5">
                        ${hechos}
                        <span class="text-[11px] italic font-semibold text-[#64748B]">${this.esc(this.step.label)} <span id="${o.id}_secs" class="not-italic font-normal tabular-nums">${this.segundos(this.step.at)} s</span></span>
                    </div>
                </div>
            </div>`;

        const prev = $(`#${o.id}_typing`);

        if (!prev.length) {
            this.appendNode(html);
            return;
        }

        prev.replaceWith(html);
        this.icons();
        this.scrollBottom();
    }

    // Sin archivo, la espera de erp-pro (cargaHTML con 'puntos'): los tres puntitos
    // y al lado la frase de lo que hace. La burbuja nace una vez; los pasos solo
    // cambian la frase, así los puntos no reinician su compás.
    renderPensando() {
        const o = this.opts;

        if (!$(`#${o.id}_typing`).length) {
            this.frase = null;
            this.appendNode(`
                <div id="${o.id}_typing" class="flex">
                    <div class="bg-[#F1F5F9] rounded-[13px] rounded-bl-[4px] px-3 py-[9px] text-[12.5px] leading-[1.5] max-w-[92%]">
                        <span id="${o.id}_pensando" class="iac-carga" role="status"><span class="iac-puntos"><span></span><span></span><span></span></span></span>
                    </div>
                </div>`);
        }

        this.tickPensando();
    }

    // Como en erp-pro: el «Pensando…» genérico sale a los 4 s y cambia a los 15; un
    // paso real se dice en cuanto llega. El reloj (y los pasos, desde dos) también
    // espera a los 4 s. La frase se reemplaza solo cuando es otra, para que su
    // fundido de entrada no se repita en cada tic.
    tickPensando() {
        const o     = this.opts;
        const l     = o.labels;
        const s     = this.segundos(this.avance.t0);
        const pasos = this.steps.length + (this.step.inicial ? 0 : 1);
        const frase = this.step.inicial ? (s < 4 ? '' : (s < 15 ? l.thinking : l.thinkingMore)) : this.step.label;
        const reloj = s < 4 ? '' : `${pasos >= 2 ? ` · ${pasos} pasos` : ''} · ${s} s`;
        const caja  = $(`#${o.id}_pensando`);

        if (frase === this.frase) {
            caja.find('[data-reloj]').text(reloj);
            return;
        }

        this.frase = frase;
        caja.find('.iac-paso').remove();
        if (frase) caja.append(`<em class="iac-paso">${this.esc(frase)}<span data-reloj>${this.esc(reloj)}</span></em>`);
        this.scrollBottom();
    }

    // -- Vista previa --

    addPreview(response) {
        const o     = this.opts;
        const l     = o.labels;
        const token = response.token || '';
        const rows  = response.row || [];
        const uid   = `${o.id}_pv${Date.now()}`;

        Object.keys(this.previews).forEach(t => {
            if (this.previews[t].state === 'pending') this.closePreview(t, 'replaced');
        });

        const validos = rows.filter(r => r.valid).length;
        const counts  = Object.keys(o.actions).map(a => {
            const n = rows.filter(r => r.valid && r.action === a).length;
            return n ? this.badge(o.actions[a], `${n} ${o.actions[a].label}`) : '';
        }).join('');
        const invalid = rows.length - validos;

        this.appendNode(`
            <div id="${uid}" class="w-full">
                <div class="bg-white border border-[#E2E8F0] rounded-[11px] overflow-hidden shadow-sm">
                    <div class="flex items-center justify-between gap-2 px-3 py-2 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                        <span class="flex items-center gap-1.5 text-xs font-semibold text-[#0F2C4C]">
                            <i data-lucide="list-checks" class="w-3.5 h-3.5 text-blue-600"></i>${this.esc(l.preview)} · ${rows.length}
                        </span>
                        ${validos ? `<label class="flex items-center gap-1.5 text-[11px] text-[#64748B] cursor-pointer select-none"><input type="checkbox" data-all checked class="w-3.5 h-3.5 accent-blue-600 cursor-pointer">${this.esc(l.selectAll)}</label>` : ''}
                    </div>
                    <div class="flex flex-wrap gap-1.5 px-3 pt-2">
                        ${counts}${invalid ? this.badge({ tone: 'bg-gray-100 text-gray-500' }, `${invalid} ${l.invalid}`) : ''}
                    </div>
                    <ul class="${this.expanded ? 'max-h-[55vh]' : 'max-h-[280px]'} overflow-y-auto divide-y divide-[#F1F5F9] mt-1" data-list>
                        ${rows.map(r => this.previewRow(r)).join('')}
                    </ul>
                    <div class="flex items-center justify-between gap-2 px-3 py-2 border-t border-[#E2E8F0] bg-[#F8FAFC]" data-footer>
                        <span class="text-[11px] text-[#64748B] min-w-0" data-status>${validos ? '' : this.esc(l.nothing)}</span>
                        ${validos && token ? `
                        <div class="flex items-center gap-2 flex-shrink-0">
                            <button type="button" data-discard class="px-3 py-1.5 text-xs font-medium text-[#475569] bg-white border border-[#CBD5E1] rounded-lg hover:bg-[#F1F5F9] transition-colors">${this.esc(l.discard)}</button>
                            <button type="button" data-confirm class="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors">
                                <i data-lucide="check" class="w-3.5 h-3.5"></i><span data-confirm-text>${this.esc(l.confirm)} ${validos}</span>
                            </button>
                        </div>` : ''}
                    </div>
                </div>
            </div>`);

        if (!validos || !token) return;

        this.previews[token] = { uid: uid, state: 'pending' };

        const card = $(`#${uid}`);

        card.on('change', '[data-all]', e => {
            card.find('[data-row]:not(:disabled)').prop('checked', e.target.checked);
            this.syncPreview(token);
        });

        card.on('change', '[data-row]', () => this.syncPreview(token));
        card.on('click', '[data-discard]', () => this.closePreview(token, 'discarded'));
        card.on('click', '[data-confirm]', () => this.confirmPreview(token));
    }

    previewRow(r) {
        const a       = this.opts.actions[r.action] || { label: r.action, tone: 'bg-gray-100 text-gray-600' };
        const changes = (r.changes && r.changes.length) ? r.changes : (r.after ? [{ label: '', before: r.before, after: r.after }] : []);
        const lines   = changes.map(ch => `
                    <div class="text-[11px] text-gray-500 mt-0.5 break-words">
                        ${ch.label ? `<span class="text-gray-400">${this.esc(ch.label)}:</span> ` : ''}${this.change(ch.before, ch.after, ch.swatch, ch.icon)}
                    </div>`).join('');

        return `
            <li class="flex items-start gap-2 px-3 py-2 ${r.valid ? '' : 'bg-gray-50/60'}">
                <input type="checkbox" data-row="${r.idx}" data-action="${this.esc(r.action)}" data-valid="${r.valid ? 1 : 0}" ${r.valid ? 'checked' : 'disabled'} class="mt-0.5 w-3.5 h-3.5 accent-blue-600 cursor-pointer disabled:cursor-not-allowed flex-shrink-0">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1.5 min-w-0">
                        ${this.badge(a, a.label)}
                        ${r.tag ? `<span class="text-[10px] font-medium uppercase tracking-wide text-gray-400 flex-shrink-0">${this.esc(r.tag)}</span>` : ''}
                        <span class="text-[12px] font-medium truncate ${r.valid ? 'text-gray-800' : 'text-gray-400 line-through'}" title="${this.esc(r.name)}">${this.esc(r.name)}</span>
                        ${r.sku ? `<span class="text-[10px] text-gray-400 flex-shrink-0">${this.esc(r.sku)}</span>` : ''}
                    </div>
                    ${r.valid ? lines : ''}
                    ${r.valid && r.detail ? `<div class="text-[11px] text-gray-400">${this.esc(r.detail)}</div>` : ''}
                    ${r.warn ? `<div class="text-[11px] text-amber-600 mt-0.5 flex items-start gap-1"><i data-lucide="alert-triangle" class="w-3 h-3 mt-0.5 flex-shrink-0"></i><span>${this.esc(r.warn)}</span></div>` : ''}
                    ${r.note ? `<div class="text-[11px] text-red-600 mt-0.5">${this.esc(r.note)}</div>` : ''}
                </div>
            </li>`;
    }

    syncPreview(token) {
        const card  = $(`#${this.previews[token].uid}`);
        const total = card.find('[data-row]:not(:disabled)').length;
        const sel   = card.find('[data-row]:checked:not(:disabled)').length;

        card.find('[data-all]').prop('checked', sel === total).prop('indeterminate', sel > 0 && sel < total);
        card.find('[data-confirm]').prop('disabled', sel === 0);
        card.find('[data-confirm-text]').text(`${this.opts.labels.confirm} ${sel}`);
        this.disarmPreview(token);
    }

    // Una acción con "confirm" (vaciar) pide un segundo clic: el primero solo arma el botón.
    armPreview(token, action) {
        const card = $(`#${this.previews[token].uid}`);

        this.previews[token].armed = true;
        card.find('[data-confirm]').removeClass('bg-blue-600 hover:bg-blue-500').addClass('bg-red-600 hover:bg-red-500');
        card.find('[data-confirm-text]').text(action.confirmLabel || this.opts.labels.confirm);
        card.find('[data-status]').removeClass('text-[#64748B]').addClass('text-red-600 font-medium').text(action.confirm);
    }

    disarmPreview(token) {
        const pv   = this.previews[token];
        const card = $(`#${pv.uid}`);

        card.find('[data-confirm]').removeClass('bg-red-600 hover:bg-red-500').addClass('bg-blue-600 hover:bg-blue-500');

        if (!pv.armed) return;

        pv.armed = false;
        card.find('[data-status]').removeClass('text-red-600 font-medium').addClass('text-[#64748B]').text('');
    }

    async confirmPreview(token) {
        const l    = this.opts.labels;
        const pv   = this.previews[token];
        const card = $(`#${pv.uid}`);
        const sel  = card.find('[data-row]:checked:not(:disabled)');
        const ids  = sel.map((i, el) => Number($(el).data('row'))).get();

        if (!ids.length || pv.state !== 'pending' || typeof this.opts.onConfirm !== 'function') return;

        const risky = sel.map((i, el) => this.opts.actions[$(el).data('action')]).get().find(a => a && a.confirm);

        if (risky && !pv.armed) {
            this.armPreview(token, risky);
            return;
        }

        pv.armed = false;

        pv.state = 'applying';
        card.find('input, [data-discard]').prop('disabled', true);
        card.find('[data-confirm]').prop('disabled', true).html(`<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i>${this.esc(l.applying)}`);
        card.find('[data-status]').removeClass('text-red-600').addClass('text-[#64748B]').text('');
        this.icons();

        let r = null;

        try {
            r = await this.opts.onConfirm(token, ids);
        } catch (e) {
            r = null;
        }

        if (r && r.status === 200) {
            this.closePreview(token, 'applied', r.message);
            this.addMessage('assistant', r.message || l.applied);
            this.history.push({ role: 'assistant', content: `Se aplicaron los cambios: ${r.message || ''}` });
            return;
        }

        pv.state = 'pending';
        card.find('[data-row][data-valid="1"], [data-all], [data-discard]').prop('disabled', false);
        card.find('[data-confirm]').html(`<i data-lucide="check" class="w-3.5 h-3.5"></i><span data-confirm-text></span>`);
        card.find('[data-status]').removeClass('text-[#64748B]').addClass('text-red-600').text((r && r.message) || l.error);
        this.icons();
        this.syncPreview(token);
    }

    closePreview(token, state, message) {
        const l    = this.opts.labels;
        const pv   = this.previews[token];
        const card = $(`#${pv.uid}`);
        const text = { applied: String(message || l.applied).split('\n')[0], discarded: l.discarded, replaced: l.replaced }[state];
        const icon = { applied: 'check-circle-2', discarded: 'x-circle', replaced: 'history' }[state];
        const tone = state === 'applied' ? 'text-emerald-600' : 'text-[#64748B]';

        pv.state = state;
        card.find('input').prop('disabled', true);
        card.find('[data-footer]').html(`<span class="flex items-center gap-1.5 text-[11px] font-medium ${tone}"><i data-lucide="${icon}" class="w-3.5 h-3.5 flex-shrink-0"></i>${this.esc(text)}</span>`);
        this.icons();
    }

    // -- Envío --

    async send() {
        const o     = this.opts;
        const input = $(`#${o.id}_input`);
        const text  = String(input.val() || '').trim();
        const files = this.files.filter(f => f.status === 'ok');

        if (this.busy || this.files.some(f => f.status === 'reading') || typeof o.onSend !== 'function') return;
        if (!text && !files.length) return;

        input.val('');
        this.autosize();
        this.menu(false);
        this.leavePortada();

        const names   = files.map(f => f.name);
        const history = this.history.slice(-8);

        this.addMessage('user', text, names);
        this.history.push({ role: 'user', content: text + (names.length ? `\n(Adjuntó: ${names.join(', ')})` : '') });
        this.dirty = true;
        this.carga = files.length > 0;
        this.setBusy(true);

        let r = null;

        try {
            r = await o.onSend(text, files.map(f => ({ nombre: f.name, texto: f.texto })), history, (label, hasta) => this.progress(label, hasta));
        } catch (e) {
            r = null;
        }

        if (r && r.status === 200) await this.finishBusy();

        this.setBusy(false);
        if (this.pildora) this.pildora.termina(!!(r && r.status === 200));

        if (!r || r.status !== 200) {
            this.history.pop();
            this.addMessage('error', (r && r.message) || o.labels.error);
            return;
        }

        this.addMessage('assistant', r.reply || '');

        if (r.row && r.row.length) this.addPreview(r);

        this.history.push({ role: 'assistant', content: this.historyText(r) });
    }

    historyText(r) {
        const rows = r.row || [];

        if (!rows.length) return r.reply || '';

        const lines = rows.slice(0, 40).map(x => {
            const a      = this.opts.actions[x.action] ? this.opts.actions[x.action].label : x.action;
            const campos = (x.changes || []).map(ch => `${ch.label} ${ch.after}`).join(', ') || x.after || '';
            return `${a} ${x.tag ? x.tag.toLowerCase() + ' ' : ''}${x.name}${campos ? ' (' + campos + ')' : ''}${x.valid ? '' : ' [no aplica: ' + x.note + ']'}`;
        });

        return `${r.reply || ''}\n[Vista previa] ${lines.join('; ')}`;
    }

    // Copia el texto crudo del mensaje. navigator.clipboard pide https o localhost;
    // en la red interna por http queda el respaldo con execCommand.
    copy(btn) {
        const text = this.texts[Number($(btn).data('copy'))] || '';
        const ok   = () => {
            $(btn).addClass('!text-emerald-600 !bg-emerald-50 !opacity-100');
            setTimeout(() => $(btn).removeClass('!text-emerald-600 !bg-emerald-50 !opacity-100'), 1500);
        };

        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(ok).catch(() => this.copyLegacy(text, ok));
            return;
        }

        this.copyLegacy(text, ok);
    }

    copyLegacy(text, ok) {
        const area = $('<textarea>', { class: 'fixed -left-[9999px] top-0' }).val(text).appendTo('body');

        area[0].select();

        try {
            if (document.execCommand('copy')) ok();
        } catch (e) { }

        area.remove();
    }

    // -- Adjuntos --

    async addFiles(fileList) {
        const o = this.opts;
        const l = o.labels;

        for (const file of Array.from(fileList || [])) {
            const item = { uid: 'f' + Date.now() + Math.random().toString(36).slice(2, 6), name: file.name || 'captura.png', status: 'reading', texto: '', detalle: '' };

            if (this.files.length >= o.maxFiles) {
                this.addMessage('error', `${l.tooMany} (${o.maxFiles}).`);
                break;
            }

            this.files.push(item);

            if (!this.accepts(item.name)) {
                Object.assign(item, { status: 'error', detalle: l.badFormat });
                this.renderChips();
                continue;
            }

            this.renderChips();

            let r = null;

            try {
                r = typeof o.onAttach === 'function' ? await o.onAttach(file) : null;
            } catch (e) {
                r = null;
            }

            if (!this.files.includes(item)) continue;

            if (r && r.status === 200 && r.data) {
                Object.assign(item, { status: 'ok', texto: r.data.texto || '', detalle: r.data.detalle || '', clase: r.data.clase || '' });
            } else {
                Object.assign(item, { status: 'error', detalle: (r && r.message) || l.error });
            }

            this.renderChips();
        }
    }

    removeFile(uid) {
        this.files = this.files.filter(f => f.uid !== uid);
        this.renderChips();
    }

    renderChips() {
        const o     = this.opts;
        const chips = $(`#${o.id}_chips`);

        if (!this.files.length) {
            chips.removeClass('flex').addClass('hidden').empty();
            this.syncSend();
            return;
        }

        const tones = {
            reading: 'bg-[#F8FAFC] border-[#E2E8F0] text-[#334155] opacity-60',
            ok:      'bg-[#F8FAFC] border-[#E2E8F0] text-[#334155]',
            error:   'bg-[#FEF2F2] border-[#FECACA] text-[#B91C1C]'
        };

        chips.removeClass('hidden').addClass('flex').html(this.files.map(f => {
            const icon = f.status === 'reading' ? 'loader-2' : (f.status === 'error' ? 'alert-circle' : (f.clase === 'imagen' ? 'image' : 'file-spreadsheet'));
            const info = f.status === 'reading' ? this.leyendo(f.name) : f.detalle;

            return `
                <span class="flex items-center gap-1.5 max-w-[calc(50%-3px)] border rounded-[9px] px-[7px] py-[5px] text-[11px] ${tones[f.status]}" title="${this.esc(f.name)}${info ? ' · ' + this.esc(info) : ''}">
                    <i data-lucide="${icon}" class="w-3.5 h-3.5 flex-shrink-0 ${f.status === 'reading' ? 'animate-spin' : ''}"></i>
                    <span class="min-w-0 flex flex-col leading-[1.25]">
                        <span class="font-semibold truncate">${this.esc(f.name)}</span>
                        ${info ? `<span class="text-[10px] opacity-75 truncate">${this.esc(info)}</span>` : ''}
                    </span>
                    <button type="button" data-remove="${f.uid}" class="flex-shrink-0 opacity-50 hover:opacity-100"><i data-lucide="x" class="w-3 h-3"></i></button>
                </span>`;
        }).join(''));

        this.icons();
        this.syncSend();
    }

    // Lo que de verdad pasa al leer el adjunto: la foto se transcribe, el Excel se lee.
    leyendo(name) {
        const l   = this.opts.labels;
        const ext = String(name).toLowerCase().split('.').pop();

        if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) return l.readingImage;
        if (['xlsx', 'xls', 'csv'].includes(ext)) return l.readingSheet;

        return l.reading;
    }

    accepts(name) {
        const list = String(this.opts.accept || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
        const ext  = '.' + String(name).toLowerCase().split('.').pop();

        return !list.length || list.includes(ext);
    }

    // -- Eventos --

    bindEvents() {
        const o     = this.opts;
        const panel = $(`#${o.id}`);
        const input = $(`#${o.id}_input`);
        const file  = $(`#${o.id}_file`);

        $(`#${o.id}_close`).on('click', () => this.close());
        $(`#${o.id}_clear`).on('click', () => this.clear());
        $(`#${o.id}_expand`).on('click', () => this.toggleExpand());
        $(`#${o.id}_send`).on('click', () => this.send());
        $(`#${o.id}_plus`).on('click', () => this.menu($(`#${o.id}_menu`).hasClass('hidden')));

        $(`#${o.id}_attach`).on('click', () => {
            this.menu(false);
            file.trigger('click');
        });

        $(document).off(`mousedown.${o.id}`).on(`mousedown.${o.id}`, e => {
            if (!$(e.target).closest(`#${o.id}_plus, #${o.id}_menu`).length) this.menu(false);
        });

        file.on('change', () => {
            this.addFiles(file[0].files);
            file.val('');
        });

        input.on('input', () => {
            this.autosize();
            this.syncSend();
        });

        input.on('focus', () => { if (this.bot) this.bot.look(false); });
        input.on('blur',  () => { if (this.bot) this.bot.look(true); });

        input.on('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.send();
            }
        });

        // Escape y Enter se quedan en el chat: Escape lo cierra solo a él, y un Enter
        // aquí no confirma el modal que esté detrás (el editor de temas lo monta adentro).
        panel.on('keydown', e => {
            if (e.key !== 'Escape' && e.key !== 'Enter') return;

            e.stopPropagation();
            if (e.key === 'Escape') this.close();
        });

        input.on('paste', e => {
            const cb = e.originalEvent.clipboardData;

            if (cb && cb.files && cb.files.length) {
                e.preventDefault();
                this.addFiles(cb.files);
            }
        });

        panel.on('click', '[data-suggestion]', e => {
            input.val($(e.currentTarget).data('suggestion')).trigger('input').trigger('focus');
        });

        panel.on('click', '[data-copy]', e => this.copy(e.currentTarget));
        panel.on('click', '[data-remove]', e => this.removeFile(String($(e.currentTarget).data('remove'))));

        panel.on('dragenter', e => {
            e.preventDefault();
            this.dragDepth++;
            $(`#${o.id}_drop`).removeClass('hidden').addClass('flex');
        });

        panel.on('dragover', e => e.preventDefault());

        panel.on('dragleave', () => {
            this.dragDepth = Math.max(0, this.dragDepth - 1);
            if (!this.dragDepth) $(`#${o.id}_drop`).removeClass('flex').addClass('hidden');
        });

        panel.on('drop', e => {
            e.preventDefault();
            this.dragDepth = 0;
            $(`#${o.id}_drop`).removeClass('flex').addClass('hidden');
            this.addFiles(e.originalEvent.dataTransfer.files);
        });

        this.bindDrag();
        this.syncSend();
    }

    toggleExpand() {
        const o     = this.opts;
        const panel = $(`#${o.id}`);

        this.expanded = !this.expanded;

        panel.toggleClass('w-[380px] h-[520px] max-h-[72vh]', !this.expanded).toggleClass('w-[680px] h-[calc(100vh-5rem)] max-h-[calc(100vh-5rem)]', this.expanded);
        panel.find('[data-list]').toggleClass('max-h-[280px]', !this.expanded).toggleClass('max-h-[55vh]', this.expanded);
        $(`#${o.id}_expand`).html(`<i data-lucide="${this.expanded ? 'minimize-2' : 'maximize-2'}" class="w-4 h-4"></i>`);
        this.icons();
        setTimeout(() => this.keepInside(), 220);
    }

    // El "+" gira a "×" mientras su menú está abierto.
    menu(open) {
        const o = this.opts;

        $(`#${o.id}_menu`).toggleClass('hidden', !open);
        $(`#${o.id}_plus`).attr('aria-expanded', open ? 'true' : 'false').toggleClass('!bg-[#F1F5F9] !text-[#7C3AED]', open);
        $(`#${o.id}_plus svg`).toggleClass('rotate-45', open);
    }

    // -- Helpers --

    syncSend() {
        const o        = this.opts;
        const reading  = this.files.some(f => f.status === 'reading');
        const hasFiles = this.files.some(f => f.status === 'ok');
        const hasText  = String($(`#${o.id}_input`).val() || '').trim() !== '';

        $(`#${o.id}_send`).prop('disabled', this.busy || reading || (!hasText && !hasFiles));
    }

    // Sin nada que borrar la goma va apagada: así no se dispara por accidente.
    syncClear() {
        $(`#${this.opts.id}_clear`).prop('disabled', this.busy || !this.dirty);
    }

    // La caja crece con el texto hasta 132 px y de ahí manda su scroll (crecer() de
    // erp-pro). El alto va con !important: compact.css fuerza `textarea { height:auto
    // !important }` y sin esto el alto calculado no se aplicaba. Con el chat cerrado
    // no hay medida (scrollHeight 0) y se deja sin alto hasta abrirlo.
    autosize() {
        const el = document.getElementById(`${this.opts.id}_input`);

        if (!el) return;

        el.style.setProperty('height', 'auto', 'important');

        if (!el.scrollHeight) {
            el.style.removeProperty('height');
            return;
        }

        el.style.setProperty('height', Math.min(el.scrollHeight, 132) + 'px', 'important');
        el.style.overflowY = el.scrollHeight > 132 ? 'auto' : 'hidden';
    }

    // Se mueve agarrándolo por la cabecera, como en erp-pro (engancharCabecera). Los
    // botones de la cabecera no arrastran y el panel nunca sale de la ventana.
    bindDrag() {
        const o     = this.opts;
        const panel = $(`#${o.id}`);
        const head  = panel.find('[data-head]');
        let agarre  = null;

        head.on('pointerdown', e => {
            if (e.button > 0 || $(e.target).closest('button').length) return;

            const r = panel[0].getBoundingClientRect();

            agarre = { dx: e.clientX - r.left, dy: e.clientY - r.top };
            panel.addClass('iac-moviendo');
            try { head[0].setPointerCapture(e.pointerId); } catch (err) { }
            e.preventDefault();
        });

        head.on('pointermove', e => {
            if (agarre) this.place(e.clientX - agarre.dx, e.clientY - agarre.dy);
        });

        head.on('pointerup pointercancel', e => {
            if (!agarre) return;

            agarre = null;
            panel.removeClass('iac-moviendo');
            try { head[0].releasePointerCapture(e.pointerId); } catch (err) { }
        });

        $(window).off(`resize.${o.id}`).on(`resize.${o.id}`, () => this.keepInside());
    }

    // Lleva el panel a (left, top) con 8 px de margen contra los bordes de la ventana.
    place(left, top) {
        const el = document.getElementById(this.opts.id);
        const m  = 8;

        $(el).css({
            left:   Math.max(m, Math.min(left, window.innerWidth  - el.offsetWidth  - m)),
            top:    Math.max(m, Math.min(top,  window.innerHeight - el.offsetHeight - m)),
            right:  'auto',
            bottom: 'auto'
        });

        this.moved = true;
    }

    // Quita la posición del arrastre: manda otra vez el `dock`.
    resetPlace() {
        $(`#${this.opts.id}`).css({ left: '', top: '', right: '', bottom: '' });
        this.moved = false;
    }

    // Tras cambiar la ventana o el tamaño del panel, lo devuelve adentro si se salió.
    keepInside() {
        if (!this.moved || !this.isOpen()) return;

        const r = document.getElementById(this.opts.id).getBoundingClientRect();

        this.place(r.left, r.top);
    }

    appendNode(html) {
        $(`#${this.opts.id}_msgs`).append(html);
        this.icons();
        this.scrollBottom();
    }

    scrollBottom() {
        const msgs = document.getElementById(`${this.opts.id}_msgs`);

        if (msgs) msgs.scrollTop = msgs.scrollHeight;
    }

    // La cara de la cabecera es CoffeeBot, como en erp-pro: a este tamaño sus ojos se
    // leen mejor que los del blob. El ojo va dentro de un grupo que lo coloca para que
    // el parpadeo (scaleY por CSS) lo cierre sobre sí mismo.
    coffeeBot() {
        const C    = IA_COFFEEBOT;
        const clip = `${this.opts.id}_cbClip`;
        const ojos = C.eyes.map(e => `<g transform="translate(${(C.cx + e.pos[0]).toFixed(2)} ${(C.cy + e.pos[1]).toFixed(2)}) scale(${e.s})"><path class="cb-ojo" d="M${e.pts.map(p => p.join(' ')).join('L')}Z"/></g>`).join('');

        return `
            <span class="iac-bot block w-full h-full">
                <svg viewBox="0 0 400 400" class="block w-full h-full" aria-hidden="true">
                    <defs><clipPath id="${clip}"><path d="${C.head}"/></clipPath></defs>
                    <g transform="${C.encaje}"><g transform="${C.cabeza}">
                        <path class="cb-cabeza" d="${C.head}"/>
                        <g class="fx-ojos" clip-path="url(#${clip})">${ojos}</g>
                    </g></g>
                </svg>
            </span>`;
    }

    // Lo que Tailwind no alcanza: el color del muñeco (el motor pinta con clases),
    // sus animaciones (las de .ia-mini de erp-pro), la caja de escribir en la
    // portada (.ia-hola-caja) y la espera con puntitos (.ia-pensando-p y .ia-paso). Los !important le ganan a las utilidades de Bootstrap
    // y al font-size que compact.css fuerza en todos los textarea.
    ensureStyles() {
        if (document.getElementById('iaChatStyles')) return;

        const css = `
            .iac-bot .cb-cabeza, .iac-hola-bot .cb-cabeza { fill:#FFFFFF; stroke:#D6D6D6; stroke-width:1px; vector-effect:non-scaling-stroke; }
            .iac-bot .cb-ojo { fill:#1E293B; }
            .iac-hola-bot .cb-ojo { fill:none; stroke:#1E293B; stroke-linecap:round; }
            .iac-mini .iac-bot { transform-origin:50% 58%; animation:iacRespira 4.6s ease-in-out infinite; }
            .iac-mini .cb-ojo { transform-box:fill-box; transform-origin:center; animation:iacPestanea 6.4s ease-in-out infinite; }
            .iac-mini.is-activo { animation:iacFlota 1.1s ease-in-out infinite; }
            .iac-mini.is-activo .fx-ojos { animation:iacPiensa 1.1s ease-in-out infinite; }
            .iac-con-portada .iac-mini { display:none !important; }
            @keyframes iacRespira { 0%,100% { transform:scale(1) rotate(0deg); } 50% { transform:scale(1.035) rotate(-1.2deg); } }
            @keyframes iacPestanea { 0%,93%,100% { transform:scaleY(1); } 96% { transform:scaleY(.08); } }
            @keyframes iacFlota { 0%,100% { transform:translateY(0) rotate(-2deg); } 50% { transform:translateY(-5px) rotate(2deg); } }
            @keyframes iacPiensa { 0%,100% { transform:translate(-16px, 6px); } 50% { transform:translate(16px, 6px); } }
            @media (prefers-reduced-motion: reduce) { .iac-mini, .iac-mini .iac-bot, .iac-mini .cb-ojo, .iac-mini .fx-ojos { animation:none !important; } }
            .iac-wrap .iac-input { font-size:12.5px !important; overflow-y:hidden; }
            .iac-moviendo, .iac-moviendo * { cursor:grabbing !important; user-select:none !important; }
            .iac-portada { width:100%; margin-top:26px; text-align:left; position:relative; }
            .iac-portada .iac-wrap { border-color:#E5EAF0 !important; border-radius:18px !important; padding:6px 6px 6px 8px !important; box-shadow:0 8px 24px rgba(15,23,42,.07) !important; }
            .iac-portada .iac-wrap:focus-within { border-color:rgb(var(--brand-600, 192 90 64) / .3) !important; box-shadow:0 0 0 3px rgb(var(--brand-600, 192 90 64) / .08), 0 8px 24px rgba(15,23,42,.07) !important; }
            .iac-portada .iac-input { font-size:13px !important; }
            .iac-portada .iac-send { width:34px !important; height:34px !important; border-radius:9999px !important; background:rgb(var(--brand-600, 192 90 64)) !important; box-shadow:0 4px 12px rgb(var(--brand-600, 192 90 64) / .35); }
            .iac-pildora { opacity:0; transform:scale(.3); transform-origin:calc(100% - 26px) -6px; pointer-events:none; transition:opacity .25s ease, transform .52s cubic-bezier(.32,1.22,.42,1); }
            .iac-pildora.is-vista { opacity:1; transform:none; pointer-events:auto; }
            .iac-pildora.is-cerrando { transition:opacity .2s ease, transform .34s cubic-bezier(.45,0,.2,1); }
            .iac-pil-cuerpo { fill:#FFFFFF; }
            .iac-pil-filo { fill:none; stroke:#D6D6D6; stroke-width:1px; vector-effect:non-scaling-stroke; }
            .iac-pil-ojo { fill:none; stroke:#1E293B; stroke-linecap:round; }
            .iac-pil-punto { fill:#1E293B; }
            @media (prefers-reduced-motion: reduce) { .iac-pildora, .iac-pildora.is-cerrando { transition:opacity .15s ease; transform:none; } }
            .iac-carga { display:inline-flex; align-items:center; gap:4px; vertical-align:middle; }
            .iac-puntos { display:inline-flex; gap:4px; align-items:center; }
            .iac-puntos > span { width:6px; height:6px; border-radius:9999px; background:#94A3B8; animation:iacBlink 1.3s infinite; }
            .iac-puntos > span:nth-child(2) { animation-delay:.18s; }
            .iac-puntos > span:nth-child(3) { animation-delay:.36s; }
            @keyframes iacBlink { 0%,60%,100% { opacity:.25; } 30% { opacity:1; } }
            .iac-paso { font-style:italic; font-size:11px; font-weight:600; color:#64748B; animation:iacPaso .28s ease-out; }
            @keyframes iacPaso { from { opacity:0; transform:translateY(2px); } to { opacity:1; transform:none; } }
            @supports ((-webkit-background-clip:text) or (background-clip:text)) { .iac-paso { background-image:linear-gradient(100deg,#64748B 30%,#334155 45%,#334155 55%,#64748B 70%); background-size:250% 100%; -webkit-background-clip:text; background-clip:text; color:transparent; -webkit-text-fill-color:transparent; animation:iacPaso .28s ease-out, iacBrillo 2.6s linear infinite; } }
            @keyframes iacBrillo { from { background-position:180% 0; } to { background-position:-80% 0; } }
            @media (prefers-reduced-motion: reduce) { .iac-paso { animation:none; background-image:none; color:#64748B; -webkit-text-fill-color:#64748B; } }`;

        const style = document.createElement('style');
        style.id = 'iaChatStyles';
        style.textContent = css;
        document.head.appendChild(style);
    }

    // "CoffeeIA" con el "IA" en el acento, como la marca de erp-pro.
    marca(title) {
        const t = String(title || '');
        const m = t.match(/^(.*?)(IA)$/);

        if (!m) return this.esc(t);

        return `<span class="font-extrabold tracking-[-.02em] text-[#0F172A]">${this.esc(m[1])}<b class="font-extrabold text-blue-600">IA</b></span>`;
    }

    fechaHoy() {
        try {
            return new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
        } catch (e) {
            return '';
        }
    }

    segundos(desde) {
        return Math.round((Date.now() - desde) / 1000);
    }

    hora() {
        const d = new Date();
        const h = d.getHours();

        return `${(h % 12) || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
    }

    // Con `swatch` cada valor que sea un hex lleva su muestra de color al lado. Con
    // `icon` el valor es un ícono de Lucide: se dibuja en vez de escribir su nombre
    // (en Catálogo el nombre del ícono solo lo ve el Super Admin).
    change(before, after, swatch, icon) {
        const sw    = v => swatch ? this.swatch(v) : '';
        const txt   = v => icon ? this.glyph(v) : this.esc(v);
        const antes = before && before !== '—' ? `${sw(before)}${txt(before)} <i data-lucide="arrow-right" class="inline w-3 h-3 mx-0.5 -mt-px"></i> ` : '';

        return `${antes}<b class="font-semibold text-gray-800">${sw(after)}${txt(after)}</b>`;
    }

    // Solo nombres de Lucide (minúsculas, números y guiones): el valor termina en un atributo.
    glyph(name) {
        if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(String(name))) return this.esc(name);

        return `<i data-lucide="${name}" class="inline w-3.5 h-3.5 -mt-px"></i>`;
    }

    // Solo #RRGGBB: el valor termina dentro de un style.
    swatch(hex) {
        if (!/^#[0-9A-Fa-f]{6}$/.test(String(hex))) return '';

        return `<span class="inline-block w-2.5 h-2.5 mr-1 rounded-[3px] border border-black/10 align-[-1px]" style="background:${hex}"></span>`;
    }

    badge(action, text) {
        return `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold leading-none flex-shrink-0 ${action.tone || 'bg-gray-100 text-gray-600'}">${this.esc(text)}</span>`;
    }

    icons() {
        if (window.lucide) lucide.createIcons();
    }

    esc(s) {
        return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
}


Templates.prototype.iaChat = function (options) {
    const chat = new IaChat(options);
    chat.tpl = this;
    return chat;
};

// -- Ícono --

// La cara de coffeeIA dibujada como un ícono de Lucide: 24×24, solo trazo en
// currentColor, grosor 2 y puntas redondas. La cabeza de CoffeeBot (IA_COFFEEBOT)
// es casi un círculo y los ojos miran al frente. Como en los íconos de Lucide con
// insignia, el contorno se abre abajo a la derecha (arco de 80° a 15°) para que
// lo que se le monte ahí (el "IA" del botón de la navbar) no choque con la línea. Sin
// data-lucide: lucide.createIcons no lo toca, y toma el color y el tamaño del
// lugar donde va, como cualquier ícono de Lucide.
Templates.prototype.iaIcon = function () {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-coffee-ia" aria-hidden="true">'
         + '<path d="M13.74 21.85A10 10 0 1 1 21.66 14.59"/>'
         + '<path d="M9 8v2"/>'
         + '<path d="M15 8v2"/>'
         + '</svg>';
};

// -- Botón de la navbar --

// CoffeeIA en la navbar de inventory, el primero de los botones de la derecha
// (antes de Tema) y con el aspecto de los demás (nav-theme-toggle de navbar.js): la
// cara de iaIcon, un poco más grande que los íconos de al lado, y el "IA" en el
// morado del chat en su esquina de abajo a la derecha (en barra oscura, uno más
// claro). `onClick` abre o cierra el CoffeeIA de cada módulo. La navbar se pinta
// sola y asíncrona (navbar.js): si aún no está, se espera su aviso navbarReady.
Templates.prototype.iaNavButton = function (options) {
    const o = Object.assign({
        id:      'iaNavButton',
        title:   'CoffeeIA',
        onClick: null
    }, options || {});

    const mount = () => {
        const $tema = $('#btnTheme');
        if (!$tema.length) return false;

        $(`#${o.id}`).remove();

        const $btn = $('<button>', {
            type: 'button',
            id: o.id,
            class: 'nav-theme-toggle',
            title: o.title,
            'aria-label': `Abrir ${o.title}`,
            'data-ia-nav': ''
        }).append($('<span>', { class: 'relative block' }).append(
            $(this.iaIcon()).addClass('block w-[21px] h-[21px]'),
            $('<span>', {
                class: 'absolute right-[-4px] bottom-[-1px] text-[8.5px] font-extrabold leading-none tracking-[-.02em] pointer-events-none text-[#7C3AED] [.nav-dark_&]:text-[#A78BFA]',
                text: 'IA'
            })
        ));

        $btn.on('click', () => {
            if (o.onClick) o.onClick();
        });

        // #btnTheme vive en un div.relative junto con su menú de temas.
        $tema.parent().before($btn);
        return true;
    };

    if (!mount()) $(document).one('navbarReady', mount);
};
