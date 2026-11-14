/*  Huubie · Rail lateral de pro/

    El mismo rail de erp-pro/pro (auth/src/js/sidebar.js): 60px, icono arriba,
    etiqueta chica abajo, y los submodulos en un panel flotante que sale al
    pasar el mouse -- en 60px no hay a donde desplegar un acordeon.

    Tiene dos formas, y la decide el servidor (ctrl-nav :: rail) segun la
    pagina que pregunta:

      En el INICIO y el perfil    los MODULOS que la empresa contrato. Nada
                                  mas: lo que no esta en su plan no existe para
                                  ella. Uno sin pagina todavia sale apagado
                                  ("Próximamente"); con la empresa sin pago al
                                  corriente, todos salen con candado.
      Dentro de un MODULO         sus secciones, las que el rol deja ver, cada
                                  una con su boton: primero las sueltas, despues
                                  las de cada submodulo, con una linea entre
                                  grupos. El servidor ya no manda submodulos
                                  agrupados; el flotante queda para el dia que
                                  vuelva a hacerlo.

    Arriba siempre va Inicio y al pie las salidas fijas (extras): Mi perfil y,
    para root, Developer y Empresas.

    Cada seccion es su propia pagina y se navega con carga completa, no con
    ajax: asi cada pagina vuelve a pasar por su Permission::page().

    En movil (<= MOVIL px) el rail deja el lateral y se vuelve una barra FIJA
    al pie, en fila y con scroll horizontal; el flotante sale hacia arriba.

    ESTE ARCHIVO ES EL RAIL ENTERO, para todo pro/: su markup y TODO su CSS
    (injectCSS). Ninguna pagina ni modulo le pone clases al contenedor ni carga
    una hoja para el: con el <div> vacio y este script basta, y asi se ve igual
    en todas partes. Los colores salen de los tokens del tema (themes.css:
    --surface, --line, --ink-dim, --tint, --brand-*, --dk-*), asi que sigue al
    modo claro u oscuro sin reglas por pagina.

    Lo unico que queda fuera es el HUECO que la pagina le deja (general.css:
    el rail fijo de 60px y el padding-left del <body>). Va en la hoja de la
    pagina porque tiene que estar antes del primer pintado, y este script
    corre al final.

    Uso:  <div id="menu-sidebar"></div>
          <script src=".../auth/src/js/sidebar.js"></script>

    Una pagina puede marcar su item a mano con
    data-active="inicio|perfil|configuracion" cuando no es ni un modulo ni una
    seccion.

    data-rail="static": la pagina trae sus propios botones .menu-rail-item
    (la plantilla del POS). El script solo pone el CSS y no toca el markup. */
(function () {
    'use strict';

    // Alto de la navbar: el flotante nunca sube mas arriba de esto.
    var TOPE = 72;

    /*  Ancho a partir del cual el rail baja al pie. El mismo numero manda en
        el @media del CSS y en el flotante: los dos tienen que cambiar de
        opinion en el mismo pixel. */
    var MOVIL = 640;

    // Alto de la barra al pie, sin el safe-area. Lo usan la barra y el hueco
    // que se le deja al contenido.
    var ALTO_MOVIL = 60;

    // El menu de la ultima visita, por pagina de modulo: se pinta de inmediato
    // y se corrige cuando contesta el servidor. El logout y el login lo borran.
    var CLAVE = 'pro:sidebar:';

    function esMovil() {
        return window.matchMedia('(max-width:' + MOVIL + 'px)').matches;
    }

    function esc(t) {
        return (t == null ? '' : String(t)).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function iconos() {
        if (window.lucide && lucide.createIcons) lucide.createIcons();
    }

    // Base del host hasta /pro (ej. "/huubie/pro" o "/pro").
    function proBase() {
        var p = window.location.pathname;
        var i = p.indexOf('/pro/');
        return i >= 0 ? p.slice(0, i + '/pro'.length) : '/pro';
    }

    // Ruta de la pagina relativa a pro/ (ej. "app/developer/accesos.php").
    function paginaActual() {
        var p = window.location.pathname;
        var i = p.indexOf('/pro/');
        return i >= 0 ? p.slice(i + '/pro/'.length) : '';
    }

    var BASE = proBase();

    // Todas las rutas del servidor son relativas a pro/.
    function href(ruta) {
        return BASE + '/' + String(ruta).replace(/^\/+/, '');
    }

    // Sin index.php ni barra final, para comparar 'app/home/' con 'app/home/index.php'.
    function norma(p) {
        return String(p || '').replace(/index\.php$/i, '').replace(/\/+$/, '');
    }

    /*  ¿Esta ruta es la pagina abierta? Igual, o la pagina cuelga de ella
        (app/pedidos cubre app/pedidos/nuevo.php). El largo sirve para que la
        coincidencia mas especifica gane. */
    function coincide(ruta) {
        var actual = norma(paginaActual());
        var r      = norma(ruta);

        if (!r) return -1;
        return actual === r || actual.indexOf(r + '/') === 0 ? r.length : -1;
    }

    /* ============ CSS ============ */
    function injectCSS() {
        if (document.getElementById('sidebar-rail-css')) return;

        var acento = 'rgb(var(--brand-600, 80 48 165))';

        var css = ''
            /*  El contenedor. general.css ya lo deja fijo a la izquierda, de
                60px y bajo la navbar. Los !important son por si una pagina le
                deja clases de utilidad (.py-4, .gap-2, .bg-white de Bootstrap
                van con !important): el rail mide lo mismo en todas. La fuente
                va fija y no heredada: cada pagina trae la suya en el <body>. */
            + '#menu-sidebar { display:flex; flex-direction:column; align-items:center; gap:4px !important; padding:10px 6px 10px !important; overflow-y:auto; overflow-x:hidden; scrollbar-width:none; background-color:var(--surface, #FFFFFF) !important; border-right-color:var(--line, #E5E7EB); font-family:"Inter",system-ui,-apple-system,"Segoe UI",sans-serif; }'
            + '#menu-sidebar::-webkit-scrollbar { display:none; }'
            + 'body.dark-mode #menu-sidebar { background-color:var(--dk-chrome, #141d2b) !important; border-right:1px solid var(--dk-line, #374151); }'

            /*  El item: icono arriba, nombre abajo. El de la pagina abierta va
                con el tinte del acento; al pasar, el acento muy diluido. */
            + '.menu-rail-item { position:relative; flex-shrink:0; width:48px; min-height:46px; box-sizing:border-box; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; margin:0; padding:7px 1px; border:1px solid transparent; border-radius:14px; background:transparent; color:var(--ink-dim, #6B7280); font-family:inherit; text-align:center; text-decoration:none !important; cursor:pointer; transition:color .15s ease, background .15s ease, border-color .15s ease; }'
            + '.menu-rail-item i, .menu-rail-item svg { width:19px; height:19px; flex-shrink:0; }'
            + '.menu-rail-label { font-size:8.5px; font-weight:600; letter-spacing:.01em; line-height:1; white-space:nowrap; }'
            // Bootstrap pinta los <a> de azul al pasar: el color lo decide el tema.
            + 'a.menu-rail-item:hover { text-decoration:none; }'
            + '.menu-rail-item:hover { color:' + acento + '; background:var(--tint, rgb(var(--brand-600, 80 48 165) / .06)); border-color:transparent; }'
            + '.menu-rail-item:focus-visible { outline:2px solid ' + acento + '; outline-offset:1px; }'
            + '.menu-rail-item.is-active { color:' + acento + '; background:rgb(var(--brand-600, 80 48 165) / .10); border-color:rgb(var(--brand-600, 80 48 165) / .12); }'

            + 'body.dark-mode .menu-rail-item { color:var(--dk-muted, #9CA3AF); }'
            + 'body.dark-mode .menu-rail-item:hover { color:#FFFFFF; background:var(--dk-hover, #1a2332); border-color:rgba(55,65,81,.4); }'
            + 'body.dark-mode .menu-rail-item.is-active { color:rgb(var(--brand-300, 164 202 254)); background:rgb(var(--brand-600, 28 100 242) / .18); border-color:rgb(var(--brand-600, 28 100 242) / .22); }'

            /*  Rail con color propio: InventoryPalette (tailwind-theme.js) pone
                --sidebar-bg y data-sidebar="dark" en <html> cuando el modo trae
                un fondo oscuro para el rail (el #0F172A del modo oscuro). Los
                items van claros y el hover es un velo blanco. `html ... body`
                para ganarle a las reglas de body.dark-mode de arriba. */
            + 'html[data-sidebar] body #menu-sidebar { background-color:var(--sidebar-bg) !important; }'
            + 'html[data-sidebar="dark"] body #menu-sidebar { border-right-color:rgb(0 0 0 / .10); }'
            + 'html[data-sidebar="dark"] body .menu-rail-item { color:rgb(255 255 255 / .68); }'
            + 'html[data-sidebar="dark"] body .menu-rail-item:hover { color:#FFFFFF; background:rgb(255 255 255 / .08); border-color:rgb(255 255 255 / .10); }'
            + 'html[data-sidebar="dark"] body .menu-rail-item.is-active { color:#FFFFFF; background:rgb(255 255 255 / .16); border-color:rgb(255 255 255 / .20); }'
            /*  Etiqueta de UNA linea con puntos suspensivos. En 48px no cabe un
                nombre real; el completo va en el title del item. Si algun dia
                se quieren leer enteros, el camino es ensanchar el rail. */
            + '.menu-rail-label { max-width:100%; overflow:hidden; text-overflow:ellipsis; }'
            // La pagina donde estas y no es enlace: no invita a pulsar.
            + '.menu-rail-item[aria-current="page"] { cursor:default; }'

            /*  Apagado: un modulo sin pagina todavia, o cualquiera con la
                empresa sin pago al corriente. Se ve, no se puede abrir. */
            + '#menu-sidebar .menu-rail-item.is-dead, #menu-sidebar .menu-rail-item.is-dead:hover { opacity:.42; cursor:not-allowed; background:transparent; border-color:transparent; }'
            + '.menu-rail-lock { position:absolute; top:4px; right:5px; width:11px; height:11px; }'
            + '.menu-rail-item .menu-rail-lock { width:11px; height:11px; }'

            + '.menu-rail-sep { width:28px; height:1px; background:var(--line, #E5E7EB); margin:6px 0; flex-shrink:0; }'
            + 'body.dark-mode .menu-rail-sep { background:var(--dk-line, #374151); }'
            + 'html[data-sidebar="dark"] body .menu-rail-sep { background:rgb(255 255 255 / .16); }'

            /*  El pie: margin-top:auto se come el hueco libre del rail y manda
                el bloque al fondo aunque el modulo tenga dos secciones. Si ya
                no sobra hueco el auto vale 0 y queda el separador. */
            + '.menu-rail-foot { margin-top:auto; display:flex; flex-direction:column; align-items:center; gap:4px; flex-shrink:0; }'

            // Punto que marca al submodulo dueño de la seccion abierta.
            + '.menu-rail-dot { position:absolute; top:5px; right:6px; width:5px; height:5px; border-radius:9999px; background:rgb(var(--brand-600, 192 90 64)); }'

            /*  Flotante de submodulo. position:fixed y colgado del <body>: el
                rail tiene overflow-y:auto y cualquier hijo absoluto quedaria
                recortado. Por encima del rail (40) y la navbar (50), debajo de
                los modales (9998+). */
            + '.menu-rail-fly { position:fixed; z-index:70; display:none; min-width:186px; max-width:250px; padding:6px; background:var(--surface, #FFFFFF); border:1px solid var(--line, #E5E7EB); border-radius:12px; box-shadow:0 12px 28px rgba(15,23,42,.14); font-family:"Inter",system-ui,sans-serif; }'
            + '.menu-rail-fly.is-open { display:block; }'
            + '.menu-rail-fly-head { margin:0; padding:5px 9px; font-size:10px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:var(--ink-dim, #6B7280); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }'
            + '.menu-rail-fly-item { display:flex; align-items:center; gap:8px; padding:7px 9px; border-radius:9px; font-size:12.5px; font-weight:500; color:var(--ink-dim, #6B7280) !important; text-decoration:none !important; transition:color .15s ease, background .15s ease; }'
            + '.menu-rail-fly-item svg { width:15px; height:15px; flex-shrink:0; }'
            + '.menu-rail-fly-item span { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }'
            + '.menu-rail-fly-item:hover { color:var(--ink, #111827) !important; background:rgb(var(--gray-100, 243 244 246)); }'
            + '.menu-rail-fly-item.is-active { color:rgb(var(--brand-600, 192 90 64)) !important; background:rgb(var(--brand-600, 192 90 64) / .10); font-weight:600; }'
            + '.menu-rail-fly-item.is-dead, .menu-rail-fly-item.is-dead:hover { opacity:.45; cursor:not-allowed; background:transparent; }'
            + 'body.dark-mode .menu-rail-fly { background:var(--dk-card, #1F2A37); border-color:var(--dk-line, #374151); box-shadow:0 16px 40px rgba(0,0,0,.45); }'
            + 'body.dark-mode .menu-rail-fly-head, body.dark-mode .menu-rail-fly-item { color:var(--dk-muted, #9CA3AF) !important; }'
            + 'body.dark-mode .menu-rail-fly-item:hover { color:var(--dk-text, #F9FAFB) !important; background:var(--dk-hover, #1a2332); }'
            + 'body.dark-mode .menu-rail-fly-item.is-active { color:rgb(var(--brand-300, 232 166 143)) !important; background:rgb(var(--brand-600, 192 90 64) / .18); }'

            /*  Movil: el rail deja el lateral y se vuelve una barra FIJA al
                pie, en fila y con scroll horizontal.

                general.css le reserva al rail 60px a la izquierda con el
                padding del <body>: aqui ese hueco pasa abajo, del alto de la
                barra, para que la ultima fila termine encima de ella y no
                debajo. El safe-area es para el gesto de inicio del iPhone. */
            + '@media (max-width:' + MOVIL + 'px) {'
            +   'body:not(:has(#menu-sidebar[data-rail="static"])) { padding-left:0 !important; padding-bottom:calc(' + ALTO_MOVIL + 'px + env(safe-area-inset-bottom)) !important; }'
            +   '#menu-sidebar:not([data-rail="static"]) { top:auto; left:0; right:0; bottom:0; width:auto; box-sizing:border-box; height:calc(' + ALTO_MOVIL + 'px + env(safe-area-inset-bottom)); flex-direction:row; gap:2px !important; padding:6px 8px calc(6px + env(safe-area-inset-bottom)) !important; border-right:0; border-top:1px solid var(--line, #E5E7EB); box-shadow:0 -4px 12px rgba(15,23,42,.06); overflow-x:auto; overflow-y:hidden; -webkit-overflow-scrolling:touch; }'
            +   'body.dark-mode #menu-sidebar:not([data-rail="static"]) { border-top-color:var(--dk-line, #374151); }'
            +   '.menu-rail-sep { width:1px; height:28px; margin:0 6px; }'
            // Al pie ya va ultimo en la fila: empujarlo al extremo abriria un hueco.
            +   '.menu-rail-foot { margin-top:0; margin-left:auto; flex-direction:row; gap:2px; }'
            +   '.menu-rail-fly { overflow-y:auto; }'
            /* Mientras el raton arrastra la tira (ver arrastre): los items no
               reciben hover ni click, que si no el flotante parpadea y soltar
               sobre un enlace navega. */
            +   '#menu-sidebar.is-arrastrando { cursor:grabbing; }'
            +   '#menu-sidebar.is-arrastrando .menu-rail-item { pointer-events:none; }'
            + '}';

        var tag = document.createElement('style');

        tag.id = 'sidebar-rail-css';
        tag.textContent = css;
        document.head.appendChild(tag);
    }

    /* ============ RENDER ============ */
    function etiqueta(icon, nombre) {
        return '<i data-lucide="' + esc(icon) + '"></i><span class="menu-rail-label">' + esc(nombre) + '</span>';
    }

    /*  Un item del rail. Sin ruta no se pinta un enlace roto, y con candado
        tampoco se pinta un enlace que el servidor va a rebotar: se pinta
        apagado y el title dice por que. */
    function itemHTML(s, activa) {
        if (s.locked) {
            return '<span class="menu-rail-item is-dead" title="' + esc(s.name) + ' — disponible al regularizar tu pago">'
                 + etiqueta(s.icon, s.name) + '<i data-lucide="lock" class="menu-rail-lock"></i></span>';
        }

        if (!s.route) {
            return '<span class="menu-rail-item is-dead" title="' + esc(s.name) + ' — próximamente">' + etiqueta(s.icon, s.name) + '</span>';
        }

        return '<a class="menu-rail-item' + (activa ? ' is-active' : '') + '" href="' + esc(href(s.route)) + '" title="' + esc(s.name) + '"'
             + (activa ? ' aria-current="page"' : '') + '>' + etiqueta(s.icon, s.name) + '</a>';
    }

    function subHTML(sm, dueno) {
        return ''
            + '<button type="button" class="menu-rail-item' + (dueno ? ' is-active' : '') + '"'
            +         ' data-sub="' + Number(sm.id) + '" title="' + esc(sm.name) + '"'
            +         ' aria-haspopup="true" aria-expanded="false">'
            +   etiqueta(sm.icon, sm.name)
            +   (dueno ? '<span class="menu-rail-dot"></span>' : '')
            + '</button>';
    }

    /*  De todo lo que hay en el rail, cual es la pagina abierta: la ruta que
        coincide y es la mas larga. Devuelve esa ruta, o '' si ninguna. */
    function rutaActiva(tree) {
        var mejor = '';
        var largo = -1;

        function probar(ruta) {
            var n = coincide(ruta);
            if (n > largo) { largo = n; mejor = ruta; }
        }

        tree.items.forEach(function (s) { probar(s.route); });
        tree.submodules.forEach(function (sm) { sm.sections.forEach(function (s) { probar(s.route); }); });
        (tree.extras || []).forEach(function (s) { probar(s.route); });

        return mejor;
    }

    function render(host, tree) {
        var activa = rutaActiva(tree);
        var marca  = host.getAttribute('data-active') || '';

        var enInicio = marca === 'inicio' || (!marca && !activa && tree.mode === 'home' && coincide('app/home') >= 0);

        // Una linea donde cambia el grupo (el submodulo de la seccion).
        var items = tree.items.map(function (s, i) {
            var corte = i > 0 && s.group !== undefined && s.group !== tree.items[i - 1].group;

            return (corte ? '<span class="menu-rail-sep"></span>' : '') + itemHTML(s, !!s.route && s.route === activa);
        }).join('');

        var subs = tree.submodules.map(function (sm) {
            return subHTML(sm, sm.sections.some(function (s) { return !!s.route && s.route === activa; }));
        }).join('');

        var pie = (tree.extras || []).map(function (s) {
            return itemHTML(s, s.route === activa || (marca === 'perfil' && norma(s.route) === 'app/perfil') || (marca === 'configuracion' && norma(s.route) === 'app/configuracion'));
        }).join('');

        host.innerHTML = ''
            // app/home/ y no index.php: index manda a root a Empresas, y root
            // dentro de una empresa quiere el inicio de ESA empresa. Sin
            // empresa elegida, es el propio inicio quien lo manda a Empresas.
            + '<a class="menu-rail-item' + (enInicio ? ' is-active' : '') + '" href="' + esc(href('app/home/')) + '" title="Inicio">'
            +   etiqueta('house', 'Inicio')
            + '</a>'
            + (items || subs ? '<span class="menu-rail-sep"></span>' : '')
            + items
            + (items && subs ? '<span class="menu-rail-sep"></span>' : '')
            + subs
            + (pie ? '<div class="menu-rail-foot"><span class="menu-rail-sep"></span>' + pie + '</div>' : '');

        iconos();
    }

    /* ============ FLOTANTE DE SUBMODULO ============ */
    /*  Uno solo, reusado por todos los submodulos y colgado del <body>: asi
        escapa del overflow del rail y no hay un nodo por submodulo. Lee el
        arbol de estado.tree en cada apertura, porque el rail se repinta cuando
        contesta el servidor. */
    function flyout(estado) {
        var fly = document.createElement('div');

        fly.className = 'menu-rail-fly';
        document.body.appendChild(fly);

        var abierto = null;   // id del submodulo mostrado
        var cierre  = null;   // timer del cierre diferido

        function contenido(sm) {
            var activa = rutaActiva(estado.tree);

            var items = sm.sections.map(function (s) {
                var cuerpo = '<i data-lucide="' + esc(s.icon) + '"></i><span>' + esc(s.name) + '</span>';

                if (!s.route) return '<span class="menu-rail-fly-item is-dead" title="Próximamente">' + cuerpo + '</span>';

                return '<a class="menu-rail-fly-item' + (s.route === activa ? ' is-active' : '') + '" href="' + esc(href(s.route)) + '">' + cuerpo + '</a>';
            }).join('');

            return '<p class="menu-rail-fly-head">' + esc(sm.name) + '</p>' + items;
        }

        function abrir(btn) {
            var id = Number(btn.dataset.sub);
            var sm = null;

            estado.tree.submodules.forEach(function (x) { if (Number(x.id) === id) sm = x; });
            if (!sm) return;

            clearTimeout(cierre);

            if (abierto !== id) {
                fly.innerHTML = contenido(sm);
                abierto = id;
                iconos();
            }

            fly.classList.add('is-open');
            btn.setAttribute('aria-expanded', 'true');

            /* Se posiciona despues de mostrarlo: mientras esta en display:none
               no tiene alto y no se podria saber si se sale por abajo. */
            var caja = btn.getBoundingClientRect();

            /*  Rail al pie: sale hacia ARRIBA, centrado sobre el boton y sin
                salirse por los lados. El alto se limita al hueco entre la
                navbar y el rail; el CSS de movil le pone el scroll. */
            if (esMovil()) {
                fly.style.maxHeight = (caja.top - TOPE - 8) + 'px';

                var ancho = fly.offsetWidth;
                var izq   = Math.max(8, Math.min(caja.left + caja.width / 2 - ancho / 2, window.innerWidth - ancho - 8));

                fly.style.left = izq + 'px';
                fly.style.top  = (caja.top - fly.offsetHeight - 8) + 'px';
                return;
            }

            fly.style.maxHeight = '';

            var alto = fly.offsetHeight;
            var tope = Math.max(TOPE, Math.min(caja.top, window.innerHeight - alto - 12));

            fly.style.left = (caja.right + 8) + 'px';
            fly.style.top  = tope + 'px';
        }

        function cerrar() {
            fly.classList.remove('is-open');
            abierto = null;

            Array.prototype.forEach.call(document.querySelectorAll('[data-sub]'), function (b) {
                b.setAttribute('aria-expanded', 'false');
            });
        }

        // Diferido: da tiempo a cruzar el hueco entre el rail y el flotante.
        function cerrarPronto() {
            clearTimeout(cierre);
            cierre = setTimeout(cerrar, 180);
        }

        return { el: fly, abrir: abrir, cerrar: cerrar, cerrarPronto: cerrarPronto, cancelar: function () { clearTimeout(cierre); } };
    }

    /* ============ ARRASTRE CON RATON (MOVIL) ============ */
    /*  Con el rail al pie la barra de scroll va escondida, y eso deja al raton
        sin forma de mover la tira: el dedo arrastra solo, el raton no. Asi que
        arrastrar con el raton la mueve, y la rueda tambien. Al tacto se le
        deja el scroll nativo, que ya frena con inercia. */
    function arrastre(host) {
        var x0 = 0, s0 = 0;
        var activo = false;   // boton apretado
        var movido = false;   // ya paso el umbral: es arrastre, no click

        host.addEventListener('pointerdown', function (e) {
            if (e.pointerType !== 'mouse' || e.button !== 0 || !esMovil()) return;

            activo = true;
            movido = false;
            x0 = e.clientX;
            s0 = host.scrollLeft;
        });

        host.addEventListener('pointermove', function (e) {
            if (!activo) return;

            var dx = e.clientX - x0;

            /* Umbral: un click con pulso no es un arrastre. Y se captura el
               puntero al cruzarlo, no antes: capturado desde el pointerdown, el
               click resultante cae en el rail y no en el enlace, y no navega. */
            if (!movido) {
                if (Math.abs(dx) < 4) return;

                movido = true;
                host.classList.add('is-arrastrando');
                host.setPointerCapture(e.pointerId);
            }

            host.scrollLeft = s0 - dx;
        });

        function soltar() {
            activo = false;
            host.classList.remove('is-arrastrando');

            /* El click llega justo despues del pointerup, en la misma vuelta;
               el timer lo deja pasar y limpia antes del siguiente gesto. */
            setTimeout(function () { movido = false; }, 0);
        }

        host.addEventListener('pointerup', soltar);
        host.addEventListener('pointercancel', soltar);

        // Soltar sobre un enlace despues de arrastrar no es un click.
        host.addEventListener('click', function (e) {
            if (!movido) return;

            e.preventDefault();
            e.stopPropagation();
        }, true);

        // Un enlace arrastrado dispara el drag nativo del navegador y se lleva el gesto.
        host.addEventListener('dragstart', function (e) {
            if (esMovil()) e.preventDefault();
        });

        /* La rueda sobre una tira horizontal quiere decir izquierda/derecha.
           Un trackpad ya manda deltaX y a ese no se le toca nada. */
        host.addEventListener('wheel', function (e) {
            if (!esMovil() || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;

            host.scrollLeft += e.deltaY;
            e.preventDefault();
        }, { passive: false });
    }

    /* ============ MENU GUARDADO ============ */
    // Una clave por carpeta: todas las paginas de un modulo comparten el menu.
    function clave() {
        return CLAVE + paginaActual().replace(/[^/]*$/, '');
    }

    function guardado() {
        try {
            var tree = JSON.parse(sessionStorage.getItem(clave()) || 'null');
            return tree && Array.isArray(tree.items) && Array.isArray(tree.submodules) ? tree : null;
        } catch (e) {
            return null;
        }
    }

    function guardar(tree) {
        try { sessionStorage.setItem(clave(), JSON.stringify(tree)); } catch (e) { /* se pinta igual, sin adelanto */ }
    }

    async function pedir() {
        try {
            var res = await fetch(BASE + '/auth/ctrl/ctrl-nav.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: 'opc=rail&module=' + encodeURIComponent(paginaActual())
            });

            return await res.json();
        } catch (e) {
            return null;
        }
    }

    /* ============ INIT ============ */
    async function init() {
        var host = document.getElementById('menu-sidebar');
        if (!host) return;

        // La pagina trae su propio rail (plantilla): solo necesitaba el CSS.
        if (host.getAttribute('data-rail') === 'static') return;

        // Fail-closed: mientras no haya menu, solo Inicio. Es la salida, y no
        // depende de nada.
        var estado = { tree: guardado() || { mode: 'home', items: [], submodules: [], extras: [] } };

        render(host, estado.tree);

        // Sobre el host y antes del fetch: el markup se regenera, los listeners no.
        arrastre(host);

        var fly = flyout(estado);

        /* Delegado sobre el rail: el markup se regenera, los listeners no.
           mouseover/mouseout y no mouseenter/mouseleave porque estos ultimos
           no burbujean. */
        function boton(e) {
            var btn = e.target.closest ? e.target.closest('[data-sub]') : null;
            return btn && host.contains(btn) ? btn : null;
        }

        host.addEventListener('mouseover', function (e) { var b = boton(e); if (b) fly.abrir(b); });
        host.addEventListener('mouseout',  function (e) { if (boton(e)) fly.cerrarPronto(); });

        // Al entrar al flotante se cancela el cierre; al salir, se cierra.
        fly.el.addEventListener('mouseover', function () { fly.cancelar(); });
        fly.el.addEventListener('mouseout', fly.cerrarPronto);

        /* Tactil y teclado: sin mouse no hay hover. El click SOLO abre, y el
           foco abre para quien navega con tabulador. No alterna: antes del
           click ya llegaron el hover (o su emulacion en tactil) y el focusin,
           que lo dejan abierto; un toggle aqui lo cerraba en el mismo gesto.
           Se cierra tocando fuera. */
        host.addEventListener('click', function (e) {
            var b = boton(e);
            if (!b) return;

            e.preventDefault();
            fly.abrir(b);
        });

        host.addEventListener('focusin', function (e) { var b = boton(e); if (b) fly.abrir(b); });

        document.addEventListener('click', function (e) {
            if (fly.el.contains(e.target) || boton(e)) return;
            fly.cerrar();
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') fly.cerrar();
        });

        // Si la pagina se mueve debajo, el flotante quedaria flotando en el aire.
        window.addEventListener('scroll', fly.cerrar, true);
        window.addEventListener('resize', fly.cerrar);

        /*  401 en silencio: navbar.js ya manda al login cuando la sesion murio.
            Dos redirects compitiendo no arreglan nada. Si la peticion falla el
            rail se queda con lo que tenia. */
        var res = await pedir();
        if (!res || res.status !== 200 || !res.data) return;

        guardar(res.data);

        if (JSON.stringify(res.data) === JSON.stringify(estado.tree)) return;

        estado.tree = res.data;
        fly.cerrar();
        render(host, estado.tree);
    }

    // El CSS, en cuanto carga el script: no espera al contenedor ni al servidor.
    injectCSS();

    if (document.readyState === 'loading' && !document.getElementById('menu-sidebar')) document.addEventListener('DOMContentLoaded', init);
    else init();
})();
