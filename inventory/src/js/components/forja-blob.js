/*  COPIA de erp-pro (ERP24/avatars/src/js/forja-blob.js), traída el 30/09/2026
    para el muñeco de coffeeIA del chat de inventory (ia-chat.js). La fuente es
    la de erp-pro: si allá cambia, se vuelve a copiar entera, no se edita aquí. */

/*  FORJA :: el motor del blob.

    Un cuerpo redondo que respira, mira y parpadea, más una capa de
    accesorios que gira con él. Devuelve SVG y se refresca cuadro a cuadro.

    ── POR QUÉ ESTÁ VIVO ─────────────────────────────────────────────────────

    Los ojos NO están dibujados sobre el cuerpo: viven en la superficie de una
    ESFERA de radio 100 y se proyectan. La cara se orienta con tres ángulos
    --yaw, pitch, roll-- y los dos ojos se separan un ángulo (split) sobre esa
    esfera. Al proyectar, el ojo que se va hacia el borde se estrecha solo,
    porque su disco se ve de canto.

    Ese detalle es TODO. Unos ojos movidos con translate se leen como dos
    pegatinas deslizándose; proyectados, se leen como una cabeza que gira.

    La postura de reposo no es de frente: yaw 28.5°, pitch 28.6° y roll -13°.
    Mirar ligeramente arriba y a un lado es lo que le da carácter; de frente
    y centrado parece un icono.

    ── EL CUERPO ─────────────────────────────────────────────────────────────

    64 radios, uno cada 5.6°. Una forma es un array de 64 números y pasar de
    una a otra es interpolarlos: por eso el huevo se convierte en hexágono sin
    un solo caso especial. Encima van dos ondas lentas que nunca se repiten a
    la vez, que es lo que impide que parezca un círculo perfecto.

    ── LOS ACCESORIOS ────────────────────────────────────────────────────────

    Cada uno se ancla a un punto de la esfera (longitud, latitud) y se dibuja
    en su propio cuadrado de -50 a 50. La matriz que lo coloca sale de los
    ejes locales proyectados, así que el sombrero se inclina con la cabeza y
    se acorta cuando el blob mira hacia otro lado. Si el ancla queda detrás,
    el accesorio se pinta antes que el cuerpo y desaparece tras él.

    ── EL ENCUADRE ───────────────────────────────────────────────────────────

    Lo que se dibuja no cabe siempre: un gorro de mago mide más que el hueco
    que le deja el cuerpo, y una animación que salta se sale por arriba. Así
    que se MIDE lo que ocupa cada receta y se encoge el dibujo entero --no el
    cuerpo por su lado-- lo justo para que quepa. Ver `encuadre`.

    ── LOS ESTADOS ───────────────────────────────────────────────────────────

    Cuatro de las animaciones --Pulso, Cargando, Buscando y ¡Ajá!-- no son
    gracias: son lo que una interfaz enseña mientras el usuario espera. Se
    exportan como SVG animado y ese archivo se usa tal cual de indicador de
    carga. Ver ANIMS.
*/
(function (global) {
    'use strict';

    var R = 100;                 // radio de la esfera, en unidades del lienzo
    var V = 320;                 // lado del viewBox
    var CX = 160, CY = 160;      // centro
    var N = 64;                  // muestras de la silueta

    var SPLIT = 15.46;           // grados entre los dos ojos
    var OJO_W = 0.186;           // ancho del ojo, en radios de esfera
    var OJO_H = 0.412;           // alto
    /*  Postura de reposo: TRES CUARTOS, no de frente.

        Es la decision que mas cambia el resultado y la unica razon de que
        exista toda la maquinaria de la esfera. De frente y centrado, los dos
        ojos salen identicos, verticales y en el eje: un icono. Girada, cada
        ojo se estrecha por su cuenta --el que se va al borde se ve de canto--
        y el accesorio se inclina con la cabeza; ahi es donde deja de ser un
        dibujo y empieza a leerse como un personaje.

        No estorba a la mirada: `fijo` --cuanto te esta siguiendo-- desvanece
        esta pose hacia el frente (el factor `k` de piezas()), asi que en
        reposo esta de tres cuartos y al mover el cursor gira a mirarte. Con
        POSE en cero ese factor no tenia nada que desvanecer.

        ES EL VALOR DE FABRICA Y EL ULTIMO DE LA LISTA. Hoy no queda sitio
        donde salga: la forja pide frente con `pose` (ver FRENTE en forja.js),
        el forjador del wizard resuelve el gesto con el gaze en cero y el chat
        de coffeeIA lleva su propia pose. Se queda porque es el reposo del
        motor para quien no pida nada, y porque es la razon de que exista toda
        la maquinaria de la esfera. */
    var POSE = { yaw: 28.49, pitch: 28.62, roll: -13 };

    /*  La sombra necesita un clipPath con id, y en la forja hay cuarenta
        svg en la misma pagina: dos ids iguales y la sombra de uno recorta
        al otro. Un contador de proceso los mantiene unicos. */
    var UID = 0;

    /*  Cuanto se corre la sombra, en unidades del lienzo. La luz viene de
        arriba a la izquierda, asi que cae abajo y a la derecha. */
    var SOMBRA = { x: 5, y: 8, op: 0.34 };

    /*  ── EL ACCESORIO NO ES PARTE DEL CUERPO ──────────────────────────────

        Tres numeros para que un sombrero se lea PUESTO y no ESTAMPADO.

        ACC_SIGUE. Cuanto del RECORRIDO de la cara acompaña el ancla de lo
        que va sobre la coronilla. Uno entero es lo geometricamente correcto
        en una esfera, y se ve mal: el blob es liso, su silueta no cambia al
        girar y los ojos, que estan cerca del eje, se desplazan poquisimo.
        Con el ancla recorriendo la esfera entera, perseguir el cursor manda
        el sombrero al costado y se lee como que se cayo.

        Atenua solo lo que SE MUEVE --la mirada, la deriva, la animacion--.
        La postura del gesto va entera: la pose de reposo es el sitio donde
        el accesorio TIENE que estar, y rebajarla dejaria el sombrero a medio
        camino de ninguna parte. Tampoco toca el roll --un sombrero SI rueda
        con la cabeza-- ni a los accesorios de cara: unas gafas tienen que ir
        donde van los ojos.

        ACC_RETARDO. Segundos que el accesorio llega tarde. Es lo unico que
        separa un sombrero clavado al craneo de un sombrero que va encima: en
        el asentir, el negar y el salto, la cabeza sale primero y el sombrero
        despues. Mas de ~0.14 s y deja de ser inercia para ser un sombrero
        mal puesto.

        HUNDE. Cuanto se mete bajo la piel el borde de apoyo del accesorio
        --el ala del sombrero, la base de la corona--, en unidades del
        lienzo. Ver `apoyo` en ACCESORIOS.

        No es un numero libre: el lienzo de 320 va JUSTO. Un bombin apoyado
        en la piel de una cabeza de tres cuartos --la coronilla se va hacia
        el polo y sube el ancla-- pide 168 unidades desde el centro y solo
        hay 160, asi que la copa asoma por arriba del viewBox. A 6 el ala
        sigue sobresaliendo de la silueta --que es todo el objetivo-- sin
        gastar mas margen del necesario; subirlo mas devuelve el sombrero a
        parecer estampado. El recorte de fondo NO se arregla aqui: pide aire
        en el viewBox o una pose de reposo menos alta. */
    var ACC_SIGUE   = 0.5;
    var ACC_RETARDO = 0.09;
    var HUNDE       = 6;

    function rad(g) { return g * Math.PI / 180; }
    function lerp(a, b, t) { return a + (b - a) * t; }
    function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

    /*  Arranca y frena. Es la diferencia entre un barrido de cabeza y un
        limpiaparabrisas: nada vivo cambia de velocidad de golpe. */
    function suave(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }

    /*  Un rebote que se apaga. `n` son las medias vueltas que da antes de
        quedarse quieto y `k` la prisa con que se apaga; devuelve algo que
        empieza y acaba en cero, asi que se puede sumar a cualquier cosa sin
        dejar escalon al cerrar el bucle.

        Es lo que separa un aterrizaje de un frenazo: al caer, el cuerpo se
        pasa de frenada, vuelve, se pasa menos, y asi hasta pararse. */
    function amortigua(x, n, k) {
        return Math.exp(-k * x) * Math.sin(x * Math.PI * n);
    }

    /*  Gira dos ejes ortogonales alrededor del tercero. Es la única
        operación 3D que hace falta: componiendo tres de estas se orienta la
        cabeza entera. */
    function giro(e, t, a) {
        var c = Math.cos(a), s = Math.sin(a);
        return [
            [e[0] * c + t[0] * s, e[1] * c + t[1] * s, e[2] * c + t[2] * s],
            [t[0] * c - e[0] * s, t[1] * c - e[1] * s, t[2] * c - e[2] * s]
        ];
    }

    /*  Los tres ejes de la cara ya orientados: f mira al espectador, r es su
        derecha, u su arriba. */
    function ejes(g) {
        var f = [0, 0, 1], r = [1, 0, 0], u = [0, 1, 0], p;
        p = giro(f, r, rad(g.yaw));   f = p[0]; r = p[1];
        p = giro(u, f, rad(g.pitch)); u = p[0]; f = p[1];
        p = giro(r, u, rad(g.roll));  r = p[0]; u = p[1];
        return { f: f, r: r, u: u };
    }

    /*  Un punto de la superficie, a `lon` grados del frente sobre el ecuador
        de la cara y `lat` grados por encima. Devuelve su proyección y los dos
        ejes locales, ya proyectados: con ellos se orienta lo que se pegue
        ahí. */
    function ancla(E, lon, lat, dist, piel, extra) {
        var p = giro(E.f, E.r, rad(lon));
        var f2 = p[0], r2 = p[1];
        var q = giro(f2, E.u, rad(-lat));
        var f3 = q[0], u2 = q[1];

        /*  D es a qué distancia del centro cae el ancla.

            SIN `piel` el ancla vive en la esfera de radio R, y eso vale para
            los ojos: están casi de frente, donde la proyección apenas se
            aleja del centro.

            CON `piel` el radio de la esfera se sustituye por el de la
            SILUETA EN ESA DIRECCIÓN, que es lo que necesita un accesorio: el
            cuerpo no es una esfera. Anclado a radio fijo, el ala del
            sombrero se hunde en las formas anchas --el huevo y el hexágono
            miden más de R por arriba-- y se queda flotando en las achatadas
            --la pastilla y el canto miden menos--. Pegado a la silueta se
            apoya igual de bien en las seis.

            piel.R es el radio esférico equivalente del cuerpo de ESTE
            cuadro: lleva dentro la respiración y el `escala` del gesto, así
            que el accesorio también crece con la sorpresa y sube y baja con
            el aliento. El 0.94 de piel.R deja la misma holgura de siempre
            entre el ancla y la piel: en la gota, D sale igual que antes. */
        var D = (piel ? piel.R : R) * (dist || 1)
              * (piel ? radioEn(piel.r, Math.atan2(f3[1], f3[0])) : 1);

        /*  `extra` viene medido EN PANTALLA --es un borde del dibujo del
            accesorio-- y D es una distancia en 3D. Lo que se ve de un
            desplazamiento radial es solo su proyeccion, que vale lo que mide
            el ancla proyectada; dividir por ella devuelve en pantalla los
            `extra` pedidos. El suelo de 0.35 es para el ancla que mira casi
            a camara: ahi la proyeccion tiende a cero y sin tope el ancla se
            iria al infinito. */
        if (extra) D += extra / Math.max(Math.hypot(f3[0], f3[1]), 0.35);

        return {
            x: f3[0] * D, y: f3[1] * D, z: f3[2],
            ax: r2[0], ay: r2[1],
            bx: u2[0], by: u2[1]
        };
    }

    /*  Matriz que pega algo a un ancla. Se queda con la inclinacion del eje
        vertical local y descarta el escorzo; sin eso, un gorro visto desde
        abajo se convierte en una raya. La profundidad se insinua encogiendo
        un poco lo que se va hacia atras.

        Cuando el eje vertical apunta casi a la camara su proyeccion es
        ruido, asi que se cae a la direccion radial, que ahi si es estable. */
    function orienta(A, esc, E, modo) {
        var s = esc * (0.86 + 0.14 * clamp(A.z, -1, 1));
        var c1, c2;

        if (modo === 'cara') {
            /*  Alineado con la cara: unas gafas tienen que ir con los ojos,
                no con el radio. Se toma la derecha de la cara proyectada, y
                su giro es exactamente el roll de la cabeza. */
            var rx = E.r[0], ry = E.r[1], m = Math.hypot(rx, ry);
            if (m < 0.05) { rx = 1; ry = 0; } else { rx /= m; ry /= m; }
            c1 = [rx, ry];
            c2 = [-ry, rx];
        } else {
            /*  Radial: lo que sale de la cabeza --gorro, antena, halo--
                apunta hacia afuera del centro. */
            var dx = A.x, dy = A.y, d = Math.hypot(dx, dy);
            if (d < 1) { dx = 0; dy = -1; } else { dx /= d; dy /= d; }
            c1 = [-dy, dx];
            c2 = [-dx, -dy];
        }

        var tx = CX + A.x, ty = CY + A.y;
        var rot = Math.atan2(c1[1], c1[0]) * 180 / Math.PI;

        return {
            mtx: 'matrix(' + (c1[0] * s).toFixed(4) + ',' + (c1[1] * s).toFixed(4) + ','
               + (c2[0] * s).toFixed(4) + ',' + (c2[1] * s).toFixed(4) + ','
               + tx.toFixed(2) + ',' + ty.toFixed(2) + ')',
            tx: tx, ty: ty, rot: rot, esc: s,
            /*  Los dos ejes sueltos, para quien necesite saber donde cae un
                punto del cuadrado local sin volver a parsear la matriz: lo
                usa el encuadre para medir cuanto ocupa el accesorio. */
            ax: c1[0], ay: c1[1], bx: c2[0], by: c2[1]
        };
    }

    // ------------------------------------------------------------- siluetas
    /*  Una forma es una función ángulo -> radio, muestreada en 64 puntos. */
    function muestrea(f) {
        var a = new Array(N);
        for (var i = 0; i < N; i++) a[i] = f(i / N * Math.PI * 2);
        return a;
    }

    var FORMAS = {
        gota:     { nom: 'Gota',     r: muestrea(function () { return 1; }) },
        huevo:    { nom: 'Huevo',    r: muestrea(function (t) { return 1 + 0.085 * Math.cos(t + Math.PI / 2) - 0.03 * Math.cos(2 * t); }) },
        hexagono: { nom: 'Hexágono', r: muestrea(function (t) {
            var s = Math.PI / 3, m = ((t + Math.PI / 6) % s) - s / 2;
            return Math.cos(s / 2) / Math.cos(m);
        })},
        canto:    { nom: 'Canto',    r: muestrea(function (t) { return 1 + 0.10 * Math.cos(2 * t); }) },
        trebol:   { nom: 'Trébol',   r: muestrea(function (t) { return 1 + 0.085 * Math.cos(3 * t + Math.PI); }) },
        pastilla: { nom: 'Pastilla', r: muestrea(function (t) {
            var c = Math.abs(Math.cos(t)), s = Math.abs(Math.sin(t));
            return Math.pow(Math.pow(c / 1.16, 8) + Math.pow(s / 0.9, 8), -1 / 8);
        })}
    };

    /*  Radio de la silueta en un ángulo cualquiera, interpolando entre las
        64 muestras. Lo usa el ancla de los accesorios para pegarse al
        contorno, sea cual sea la forma del cuerpo. */
    function radioEn(r, ang) {
        var t = ((ang / (Math.PI * 2)) % 1 + 1) % 1 * N;
        var i = Math.floor(t);
        return lerp(r[i % N], r[(i + 1) % N], t - i);
    }

    /*  El contorno, como una curva cerrada suave. Catmull-Rom convertido a
        Bézier: con líneas rectas entre 64 puntos el borde queda facetado y a
        tamaño grande se nota. */
    function contorno(r, esc, def) {
        var d = def || { sx: 1, sy: 1, dx: 0, dy: 0 };
        var p = [], i;
        for (i = 0; i < N; i++) {
            var a = i / N * Math.PI * 2;
            p.push([CX + d.dx + Math.cos(a) * r[i] * esc * d.sx,
                    CY + d.dy + Math.sin(a) * r[i] * esc * d.sy]);
        }
        /*  Una decima de unidad de lienzo. A 400 px de ancho eso es seis
            centesimas de pixel: no se ve. Y sin embargo es la mitad del peso
            del SVG animado, donde este contorno --64 curvas, 384 numeros--
            se repite una vez por muestra. */
        function n(v) { return v.toFixed(1); }

        var d = 'M' + n(p[0][0]) + ' ' + n(p[0][1]);
        for (i = 0; i < N; i++) {
            var p0 = p[(i - 1 + N) % N], p1 = p[i], p2 = p[(i + 1) % N], p3 = p[(i + 2) % N];
            var c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
            var c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
            d += 'C' + n(c1x) + ' ' + n(c1y) + ',' + n(c2x) + ' ' + n(c2y)
               + ',' + n(p2[0]) + ' ' + n(p2[1]);
        }
        return d + 'Z';
    }

    // ---------------------------------------------------------------- ojos
    /*  Un ojo es una CÁPSULA: un segmento con las puntas redondeadas. Se
        dibuja como un trazo grueso, no como una forma, y por eso cerrarlo es
        sólo acortar el segmento y adelgazar el trazo. */
    function ojo(A, w, h, abierto, tilt, col) {
        if (A.z <= 0.02) return '';

        var c = Math.cos(rad(tilt || 0)), s = Math.sin(rad(tilt || 0));
        var dx = A.ax * c + A.bx * s, dy = A.ay * c + A.by * s;   // eje ancho
        var ux = -A.ax * s + A.bx * c, uy = -A.ay * s + A.by * c; // eje alto

        var hw = Math.max(w * R, 0.01) / 2;
        var hh = Math.max(h * R * abierto, 0.01) / 2;
        var rr = Math.min(hw, hh);
        var vert = hh > hw;
        var len = vert ? hh - rr : hw - rr;
        var ex = vert ? ux : dx, ey = vert ? uy : dy;

        var x1 = A.x - ex * len, y1 = A.y - ey * len;
        var x2 = A.x + ex * len, y2 = A.y + ey * len;

        return '<path d="M' + (CX + x1).toFixed(2) + ' ' + (CY + y1).toFixed(2)
             + 'L' + (CX + x2).toFixed(2) + ' ' + (CY + y2).toFixed(2) + '"'
             + ' stroke="' + col + '" stroke-width="' + (rr * 2).toFixed(2) + '"'
             + ' stroke-linecap="round" fill="none"/>';
    }

    /* ------------------------------------------------------------ accesorios
       Cada uno se dibuja en su propio cuadrado de -50 a 50 con el origen en
       el punto de anclaje, y declara dónde se pega: lon/lat sobre la esfera,
       la escala y, si hace falta, a qué distancia del centro (dist>1 lo
       separa del cuerpo, para lo que flota).

       `modo: 'cara'` lo alinea con los ojos en vez de con el radio. Unas
       gafas tienen que ir con la cara; un gorro, hacia afuera.

       `col` es SU color, el que trae de fabrica: un bombin es cafe y una gorra
       roja, y eso no depende de la receta. Quien no lo declara se pinta con el
       `acento` --el mando de la forja-- como se pinto siempre. El segundo tono
       sale del primero, sea cual sea el origen: con un solo color las piezas
       que se solapan --el ala sobre la copa-- se funden en una mancha.

       `apoyo` es la y local del borde que se apoya en la cabeza: el ala del
       sombrero, la base de la corona. Lo llevan los que SE POSAN --y con el,
       el motor los coloca donde ese borde toca la piel, no a un radio puesto
       a ojo--. Los que van pegados a la superficie (la flor, el lazo), los de
       cara y los que flotan por `dist` (el halo, la taza) no lo llevan: no se
       apoyan en nada. El brote y la antena lo llevan pequeño a proposito,
       porque nacen DE DENTRO de la cabeza.

       Reciben dos colores: el acento y una sombra suya. Con uno solo, las
       piezas que se solapan --el ala del sombrero sobre la copa-- se funden
       en una mancha. Y un tercero, una LUZ del mismo tono (un 30% más
       claro), para el que necesite un brillo; los demás lo ignoran. */
    /*  El auricular de los cascos. Se dibuja TUMBADO a proposito: en una
        pieza radial el eje X local es la TANGENTE de la cabeza, que en el
        costado cae en vertical, y el eje Y apunta hacia DENTRO, al centro del
        cuerpo. De ahi que la almohadilla vaya en y positivo --es el lado que
        toca la oreja-- y el anillo en negativo, que es la cara de fuera.

        ── TODO CONCENTRICO, Y NO ES CASUALIDAD ─────────────────────────────

        El eje X local NO APUNTA AL MISMO SITIO EN LOS DOS LADOS. Es tangente,
        o sea perpendicular al radio, y el radio de un costado es el contrario
        del otro: en el auricular derecho la x positiva baja por la mejilla y
        en el izquierdo sube hacia la coronilla. Cualquier detalle fuera del
        eje sale ESPEJADO entre las dos orejas -- que es lo que le pasaba al
        brillo de la primera version, arriba en una y abajo en la otra, y no
        se notaba solo porque el auricular de atras casi no se ve.

        Con todo centrado en el eje eso deja de existir: las dos orejas salen
        iguales se pinten donde se pinten. Si algun dia entra aqui un detalle
        lateral --un cable, un microfono-- hay que pasarle el signo del lado.

        ── LA COPA VISTA DE CANTO, PORQUE EL MUÑECO MIRA DE FRENTE ──────────

        La version anterior pintaba la CARA de la copa --carcasa, anillo y
        chapa, cuatro elipses concentricas-- y eso estaba pensado para el tres
        cuartos, donde la copa de este lado se ve casi de frente. Hoy todo
        arranca de frente, y ahi la copa cae justo en el canto: los anillos se
        leian como un disco pegado al costado, no como unos cascos.

        Ahora es la copa de PERFIL, tres piezas y todas en el eje:

          1. la almohadilla en c2, una cápsula que toca la cabeza (y
             positivo). Asoma entre la carcasa y la piel: es lo que dice
             "acolchado" y lo que la hace apretar.
          2. la carcasa en c, la elipse grande que sobresale del contorno.
          3. la tapa en c3, la LUZ: un óvalo más claro hacia fuera. Oscura se
             leía como un agujero; clara se lee como una tapa abombada.

        c es el color del accesorio, c2 un 22% más oscuro y c3 un 30% más
        claro.

        La sombra de contacto vuelve a llamar a esta misma función con los
        tres colores iguales (ver `pz.f(som, som, som)`), así que aquí NO
        puede entrar ningún color literal: saldría a todo color dentro de la
        sombra. */
    function auricular(c, c2, c3) {
        return '<rect x="-22" y="-2" width="44" height="17" rx="8.5" fill="' + c2 + '"/>'
             + '<ellipse cx="0" cy="-6" rx="28" ry="15" fill="' + c + '"/>'
             + '<ellipse cx="0" cy="-11" rx="17" ry="5.5" fill="' + c3 + '"/>';
    }

    /*  Un mechon del pelo de payaso: una bola rizada. Cinco rizos alrededor de
        un centro, y una luz encima.

        SIMETRICO SOBRE EL EJE Y LOCAL, por lo mismo que el auricular: el eje X
        de una pieza radial baja por un costado y sube por el otro, y cualquier
        detalle fuera del eje saldria espejado entre los dos lados.

        El fondo en c2 va corrido hacia y positivo --el lado que toca la
        cabeza-- y solo asoma por abajo: es lo que le da volumen a la bola. Los
        rizos son pequeños contra el centro a proposito; con rizos grandes y
        oscuros la primera version se leia como frambuesas, no como pelo.

        Mismo aviso que el auricular: la sombra de contacto llama a esta
        funcion con los tres colores iguales, asi que aqui no entra ningun
        color literal. */
    function mechon(c, c2, c3) {
        return '<circle cx="0" cy="4" r="22" fill="' + c2 + '"/>'
             + '<circle cx="0" cy="-14" r="11" fill="' + c + '"/>'
             + '<circle cx="-13.3" cy="-4.3" r="11" fill="' + c + '"/>'
             + '<circle cx="13.3" cy="-4.3" r="11" fill="' + c + '"/>'
             + '<circle cx="-8.2" cy="11.3" r="11" fill="' + c + '"/>'
             + '<circle cx="8.2" cy="11.3" r="11" fill="' + c + '"/>'
             + '<circle cx="0" cy="-1" r="19" fill="' + c + '"/>'
             + '<ellipse cx="0" cy="-11" rx="8" ry="4.5" fill="' + c3 + '"/>';
    }

    /*  EL MOÑO: una lazada, la derecha; la izquierda es su espejo. */
    function lazada(c, c2, c3) {
        return '<path d="M6 -7C15 -13 27 -21 36 -20C42 -19.5 44 -12 43.5 -3C43 7 41 14 35 15.5C27 17 16 10 6 7Z" fill="' + c + '"/>'
             + '<path d="M6 -7C11 -9 17 -8 21 -5C19 -1 19 3 21 7C16 8.5 10 8 6 7Z" fill="' + c2 + '" opacity=".85"/>'
             + '<path d="M21 0.5C28 -0.5 35 -2.5 42 -5" fill="none" stroke="' + c2 + '" stroke-width="2.4" stroke-linecap="round" opacity=".55"/>'
             + '<path d="M14 -12.5C21 -17 29 -19.8 35 -19" fill="none" stroke="' + c3 + '" stroke-width="3" stroke-linecap="round" opacity=".75"/>';
    }

    function monoDePelo(c, c2, c3) {
        return '<path d="M-5 5L-17 29L-11.5 26.5L-8.5 32.5L1 8Z" fill="' + c2 + '"/>'
             + '<path d="M5 5L17 29L11.5 26.5L8.5 32.5L-1 8Z" fill="' + c2 + '"/>'
             + lazada(c, c2, c3)
             + '<g transform="scale(-1 1)">' + lazada(c, c2, c3) + '</g>'
             + '<path d="M-8 -8C-8 -11 -6 -12 0 -12C6 -12 8 -11 8 -8V8C8 11 6 12 0 12C-6 12 -8 11 -8 8Z" fill="' + c + '"/>'
             + '<path d="M-3.2 -10C-4.6 -4 -4.6 4 -3.2 10M3.2 -10C4.6 -4 4.6 4 3.2 10" fill="none" stroke="' + c2
             +   '" stroke-width="1.8" stroke-linecap="round" opacity=".5"/>'
             + '<path d="M-3.5 -8.8H3" stroke="' + c3 + '" stroke-width="2.4" stroke-linecap="round" opacity=".7"/>';
    }

    /*  EL COLOR «A JUEGO». Un accesorio con `juego` no trae color de
        fabrica: lo saca del cuerpo, un tono mas oscuro (`juego` es cuanto).
        Es lo que hace que el moño se lea como parte del
        personaje y no como algo que se le pego encima.

        Dos casos no sirven con la regla: un cuerpo casi blanco daria un gris
        sin caracter --y es coffeeIA, el que mas se ve--, asi que ahi va un
        grafito azulado de oficina; y uno muy oscuro se comeria el accesorio,
        asi que ahi se aclara en vez de oscurecer. */
    var JUEGO_CLARO = '#2B3440';

    function colorAcc(code, cuerpo, acento) {
        var a = ACCESORIOS[code];
        if (!a) return acento || '#242229';
        if (a.col) return a.col;
        if (a.juego == null) return acento || '#242229';
        var l = luz(cuerpo || '#B8B8B8');
        if (l > 0.8)  return JUEGO_CLARO;
        if (l < 0.25) return tono(cuerpo, -0.55);
        return tono(cuerpo, a.juego);
    }

    /*  Una flor de temporada (cempasuchil o rosa) para la Catrina. */
    function florTemporada(x, y, col, centro) {
        var o = '';
        for (var i = 0; i < 6; i++) {
            var a = i / 6 * Math.PI * 2;
            o += '<circle cx="' + (x + 4.5 * Math.cos(a)).toFixed(1) + '" cy="' + (y + 4.5 * Math.sin(a)).toFixed(1) + '" r="3.8" fill="' + col + '"/>';
        }
        return o + '<circle cx="' + x + '" cy="' + y + '" r="2.6" fill="' + centro + '"/>';
    }
    /*  Digitos de trazo (8 x 12, origen arriba a la izquierda) para la placa
        de New Year. Dibujados y no escritos: un <text> depende de la fuente
        de cada equipo (ver NOTA). */
    var DIGITOS = {
        '0': 'M0 2Q0 0 2 0H6Q8 0 8 2V10Q8 12 6 12H2Q0 12 0 10Z', '1': 'M2 2L4 0V12',
        '2': 'M0 2Q0 0 2 0H6Q8 0 8 2V4Q8 6 6 6.5L0 12H8', '3': 'M0 0H8L4 5Q8 5 8 8.5Q8 12 4 12Q1 12 0 10',
        '4': 'M6 12V0L0 8H8', '5': 'M8 0H1L0 5.5Q2 4.5 4.5 4.5Q8 4.5 8 8.2Q8 12 4 12Q1 12 0 10',
        '6': 'M7 0Q0 2 0 8Q0 12 4 12Q8 12 8 8Q8 4.5 4 4.5Q1 4.5 0 7', '7': 'M0 0H8L3 12',
        '8': 'M4 6Q0 6 0 3Q0 0 4 0Q8 0 8 3Q8 6 4 6Q0 6 0 9Q0 12 4 12Q8 12 8 9Q8 6 4 6',
        '9': 'M1 12Q8 10 8 4Q8 0 4 0Q0 0 0 4Q0 7.5 4 7.5Q7 7.5 8 5'
    };
    function numeros(txt, x, y, e, col) {
        var o = '';
        for (var i = 0; i < txt.length; i++) {
            if (!DIGITOS[txt[i]]) continue;
            o += '<path transform="translate(' + (x + i * 11 * e) + ' ' + y + ') scale(' + e + ')" d="' + DIGITOS[txt[i]]
               + '" fill="none" stroke="' + col + '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>';
        }
        return o;
    }
    /*  El año que empieza: de julio en adelante, el siguiente. */
    function anioNuevo() {
        var d = new Date();
        return d.getMonth() >= 6 ? d.getFullYear() + 1 : d.getFullYear();
    }
    /*  Estrella de cinco picos, centrada. */
    function estrella5(col, e) {
        return '<path transform="scale(' + e + ')" d="M0 -9L2.6 -3.2L9 -2.8L4.1 1.4L5.6 7.6L0 4.2L-5.6 7.6L-4.1 1.4L-9 -2.8L-2.6 -3.2Z" fill="' + col + '"/>';
    }

    var ACCESORIOS = {
        ninguno: { nom: 'Ninguno', f: null },

        gorro: { nom: 'Bombín', col: '#8B5E3C', lon: 0, lat: 54, esc: 1.3, apoyo: 18, caja: [-53, -43, 53, 18], f: function (c, c2) {
            return '<path d="M-29 6C-31 -24 -19 -43 0 -43C19 -43 31 -24 29 6Z" fill="' + c + '"/>'
                 + '<path d="M-31 -6H31V6H-31Z" fill="' + c2 + '"/>'
                 + '<path d="M-53 4C-53 -4 -40 -9 0 -9C40 -9 53 -4 53 4C53 13 40 18 0 18C-40 18 -53 13 -53 4Z" fill="' + c + '"/>';
        }},

        mago: { nom: 'Mago', col: '#5FB8E8', lon: 0, lat: 58, esc: 1.5, apoyo: 16, caja: [-53, -82, 53, 16], f: function (c, c2) {
            return '<path d="M-23 4C-19 -38 -6 -68 15 -82C29 -58 33 -25 29 4Z" fill="' + c + '"/>'
                 + '<path d="M9 -44L13 -34L23 -30L13 -26L9 -16L5 -26L-5 -30L5 -34Z" fill="' + c2 + '"/>'
                 + '<path d="M-53 2C-53 -6 -40 -11 0 -11C40 -11 53 -6 53 2C53 11 40 16 0 16C-40 16 -53 11 -53 2Z" fill="' + c + '"/>';
        }},

        gorra: { nom: 'Gorra', col: '#DC2626', lon: 6, lat: 52, esc: 1.35, apoyo: 8, caja: [-31, -46, 58, 20], f: function (c, c2) {
            return '<path d="M-31 8C-31 -22 -18 -40 2 -40C22 -40 33 -22 33 8Z" fill="' + c + '"/>'
                 + '<circle cx="2" cy="-40" r="6" fill="' + c2 + '"/>'
                 + '<path d="M18 0C44 0 58 6 58 13C58 19 48 21 36 19C22 17 18 9 18 0Z" fill="' + c2 + '"/>';
        }},

        boina: { nom: 'Boina', lon: -6, lat: 56, esc: 1.3, apoyo: 17, caja: [-40, -45, 44, 17], f: function (c, c2) {
            return '<path d="M-40 4C-40 -20 -22 -36 4 -36C31 -36 45 -21 43 1C41 12 20 17 -6 17C-27 17 -40 12 -40 4Z" fill="' + c + '"/>'
                 + '<circle cx="16" cy="-38" r="7" fill="' + c2 + '"/>';
        }},

        corona: { nom: 'Corona', col: '#FBBF24', lon: 0, lat: 58, esc: 1.25, apoyo: 18, caja: [-39, -45, 44, 24], f: function (c, c2) {
            return '<path d="M-34 10L-38 -28C-39 -37 -29 -41 -24 -34L-11 -18L-4 -39C-1 -47 6 -47 9 -39L16 -18L29 -34C34 -41 44 -37 43 -28L39 10Z" fill="' + c + '"/>'
                 + '<path d="M-36 6H39V18C39 22 30 24 2 24C-27 24 -36 22 -36 18Z" fill="' + c2 + '"/>'
                 + '<circle cx="-20" cy="14" r="4" fill="' + c + '"/><circle cx="2" cy="14" r="4" fill="' + c + '"/>'
                 + '<circle cx="24" cy="14" r="4" fill="' + c + '"/>';
        }},

        halo: { nom: 'Halo', col: '#FBBF24', lon: 0, lat: 74, esc: 1.3, dist: 1.16, caja: [-40, -17, 40, 5], f: function (c, c2) {
            return '<ellipse cx="0" cy="-6" rx="40" ry="11" fill="none" stroke="' + c + '" stroke-width="9"/>'
                 + '<ellipse cx="-14" cy="-13" rx="9" ry="3" fill="' + c2 + '" opacity=".85"/>';
        }},

        antena: { nom: 'Antena', col: '#C7CDD4', lon: 4, lat: 68, esc: 1.1, apoyo: 4, caja: [0, -52, 26, 16], f: function (c, c2) {
            return '<path d="M0 16C0 -4 3 -20 11 -32" fill="none" stroke="' + c + '" stroke-width="8" stroke-linecap="round"/>'
                 + '<circle cx="14" cy="-40" r="12" fill="' + c2 + '"/>'
                 + '<circle cx="10" cy="-44" r="4" fill="' + c + '" opacity=".5"/>';
        }},

        brote: { nom: 'Brote', col: '#8CC63F', lon: 8, lat: 62, esc: 1.1, apoyo: 4, caja: [-28, -34, 42, 18], f: function (c, c2) {
            return '<path d="M0 18C0 2 2 -12 8 -24" fill="none" stroke="' + c2 + '" stroke-width="7" stroke-linecap="round"/>'
                 + '<path d="M8 -24C25 -42 46 -34 41 -12C36 6 13 -4 8 -24Z" fill="' + c + '"/>'
                 + '<path d="M4 -8C-12 -22 -32 -14 -26 2C-20 17 0 8 4 -8Z" fill="' + c + '"/>';
        }},

        flor: { nom: 'Flor', col: '#E86A9A', lon: -30, lat: 46, esc: 1.05, caja: [-40, -38, 40, 38], f: function (c, c2) {
            var s = '';
            for (var i = 0; i < 5; i++) {
                s += '<ellipse cx="0" cy="-19" rx="12" ry="19" fill="' + c
                   + '" transform="rotate(' + (i * 72) + ')"/>';
            }
            return s + '<circle cx="0" cy="0" r="10" fill="' + c2 + '"/>';
        }},

        lentes: { nom: 'Lentes', lon: 0, lat: 2, esc: 1.3, modo: 'cara', caja: [-58, -19, 58, 19], f: function (c, c2) {
            return '<g fill="none" stroke="' + c + '" stroke-width="7" stroke-linecap="round">'
                 + '<circle cx="-25" cy="0" r="19"/><circle cx="25" cy="0" r="19"/>'
                 + '<path d="M-6 -2H6"/><path d="M-44 -7L-58 -13"/><path d="M44 -7L58 -13"/></g>'
                 + '<circle cx="-31" cy="-7" r="5" fill="' + c2 + '" opacity=".55"/>'
                 + '<circle cx="19" cy="-7" r="5" fill="' + c2 + '" opacity=".55"/>';
        }},

        sol: { nom: 'De sol', lon: 0, lat: 2, esc: 1.3, modo: 'cara', caja: [-55, -23, 55, 18], f: function (c, c2) {
            return '<path d="M-55 -13C-55 -19 -49 -23 -41 -23H-9C-4 -23 -1 -19 -1 -14C-1 4 -11 18 -27 18C-45 18 -55 4 -55 -13Z" fill="' + c + '"/>'
                 + '<path d="M55 -13C55 -19 49 -23 41 -23H9C4 -23 1 -19 1 -14C1 4 11 18 27 18C45 18 55 4 55 -13Z" fill="' + c + '"/>'
                 + '<path d="M-41 -15L-31 -7" stroke="' + c2 + '" stroke-width="5" stroke-linecap="round" opacity=".7"/>'
                 + '<path d="M15 -15L25 -7" stroke="' + c2 + '" stroke-width="5" stroke-linecap="round" opacity=".7"/>';
        }},

        parche: { nom: 'Parche', lon: -15.46, lat: 0, esc: 1.35, modo: 'cara', caja: [-58, -35, 58, 22], f: function (c, c2) {
            return '<path d="M-58 -20L58 -26" stroke="' + c + '" stroke-width="6" stroke-linecap="round" fill="none"/>'
                 + '<path d="M-22 -20C-22 -30 -12 -35 0 -35C12 -35 22 -30 22 -20V4C22 16 12 22 0 22C-12 22 -22 16 -22 4Z" fill="' + c + '"/>'
                 + '<path d="M-12 -22C-6 -27 6 -27 12 -22" stroke="' + c2 + '" stroke-width="4" stroke-linecap="round" fill="none" opacity=".6"/>';
        }},

        bigote: { nom: 'Bigote', lon: 0, lat: -19, esc: 1.3, modo: 'cara', caja: [-48, -13, 48, 17], f: function (c, c2) {
            return '<path d="M0 6C-7 -8 -24 -17 -39 -10C-52 -4 -49 11 -35 15C-20 19 -6 14 0 6Z" fill="' + c + '"/>'
                 + '<path d="M0 6C7 -8 24 -17 39 -10C52 -4 49 11 35 15C20 19 6 14 0 6Z" fill="' + c + '"/>'
                 + '<path d="M0 6C-2 2 -2 -2 0 -6C2 -2 2 2 0 6Z" fill="' + c2 + '"/>';
        }},

        /*  ── LOS CASCOS, EL PRIMER ACCESORIO EN PIEZAS ───────────────

            Cuatro piezas: los dos auriculares, en los COSTADOS de la cabeza
            (lon ±90), y las dos mitades de la diadema, que son arcos de la
            propia esfera y no dibujos.

            Cada pieza se ancla sola, asi que cada una decide por su cuenta de
            que lado del cuerpo se pinta. Con la cara de tres cuartos, el
            auricular de este lado se ve entero y grande, y el del otro se va
            DETRAS del cuerpo y solo asoma por el borde. Eso es lo que separa
            unos cascos puestos de unos cascos pegados encima del dibujo, y no
            se puede hacer con una sola pieza plana: ahi los dos auriculares
            se ven siempre iguales y siempre delante.

            `sigue: 1` porque los cascos van AGARRADOS a la cabeza: cuando el
            blob gira a mirar el cursor, giran lo mismo que el. La atenuacion
            de ACC_SIGUE esta pensada para lo que solo se POSA encima --un
            sombrero, que si se queda un poco atras-- y aqui despegaria los
            auriculares de las orejas.

            La diadema no pasa por la coronilla de la esfera (lat 90) sino
            por el ALTO VISIBLE de la cabeza (lon 0, lat 72), que es donde se
            posan el gorro y la corona.

            ── UNA BANDA LISA, SIN BRAZOS NI ACOLCHADO ─────────────────────

            Hubo una version con cinco trazas: dos mitades en recta de lon/lat,
            dos brazos de 21 de grosor y un acolchado plano que tapaba el pico
            de la coronilla. De frente eso se leia como una banda con hombros y
            un bloque encima. Ahora son dos mitades con `cima` (ver
            arcoEsfera): recorren el mismo circulo, llegan arriba sin pico y ya
            no hay nada que tapar.

            LA BANDA NACE EN EL CENTRO DE LA COPA (lat0 igual al del
            auricular) y se esconde bajo ella: no se ve el remate redondo.

            LOS AURICULARES VAN AL FINAL DE LA LISTA. Dentro de una misma tanda
            las piezas se pintan en orden, y con la copa derecha la primera la
            banda le pasaba POR ENCIMA mientras la izquierda la tapaba: las dos
            orejas salian distintas. */
        cascos: { nom: 'Cascos', col: '#4B5563', partes: [
            { sigue: 1, traza: { lon0:  90, lat0: 4, cima: 72, dist: 1.03, n: 12, w: 15 } },
            { sigue: 1, traza: { lon0: -90, lat0: 4, cima: 72, dist: 1.03, n: 12, w: 15 } },
            { lon:  90, lat: 4, dist: 0.95, esc: 1.35, sigue: 1, asoma: 1, caja: [-28, -21, 28, 15], f: auricular },
            { lon: -90, lat: 4, dist: 0.95, esc: 1.35, sigue: 1, asoma: 1, caja: [-28, -21, 28, 15], f: auricular }
        ]},

        /*  ── EL PELO DE PAYASO, EL DE coffeeClown ──────────────────────────

            Dos bolas rojas en cada costado, coronilla pelona: el payaso de
            siempre. Va en piezas por la misma razon que los cascos --cada bola
            decide sola si cae delante o detras del cuerpo al girar-- y con
            `sigue: 1` y `asoma: 1` por lo mismo: el pelo va pegado a la cabeza
            y no puede quedarse atras ni desaparecer tras ella.

            Una bola arriba (lat 30) y otra a la altura de los ojos (lat 0). Se
            solapan a proposito: separadas se leen como cuatro pelotas sueltas;
            juntas, como un mechon.

            VAN DETRAS DE LA CABEZA, no en el costado: lon ±110 deja el ancla
            por detras (z negativa), el cuerpo se pinta encima y tapa la parte
            de dentro de cada bola. En lon ±90 caian delante y se comian el
            borde de la cara: se leian como orejeras, no como pelo. `dist` 1.08
            las saca lo justo para que asome algo mas de media bola; `asoma`
            ya no las deja hundirse del todo al girar. */
        payaso: { nom: 'Payaso', col: '#E53935', partes: [
            { lon:  110, lat: 30, dist: 1.08, esc: 1.7, sigue: 1, asoma: 1, caja: [-25, -25, 25, 26], f: mechon },
            { lon: -110, lat: 30, dist: 1.08, esc: 1.7, sigue: 1, asoma: 1, caja: [-25, -25, 25, 26], f: mechon },
            { lon:  110, lat: 0,  dist: 1.08, esc: 1.7, sigue: 1, asoma: 1, caja: [-25, -25, 25, 26], f: mechon },
            { lon: -110, lat: 0,  dist: 1.08, esc: 1.7, sigue: 1, asoma: 1, caja: [-25, -25, 25, 26], f: mechon }
        ]},

        lazo: { nom: 'Lazo', lon: -42, lat: 32, esc: 1.05, caja: [-51, -16, 51, 19], f: function (c, c2) {
            return '<path d="M-7 0C-17 -17 -40 -21 -48 -9C-55 3 -44 17 -25 15C-14 13 -9 6 -7 0Z" fill="' + c + '"/>'
                 + '<path d="M7 0C17 -17 40 -21 48 -9C55 3 44 17 25 15C14 13 9 6 7 0Z" fill="' + c + '"/>'
                 + '<path d="M-9 12C-4 20 4 20 9 12C4 16 -4 16 -9 12Z" fill="' + c2 + '"/>'
                 + '<circle cx="0" cy="0" r="9" fill="' + c2 + '"/>';
        }},

        bufanda: { nom: 'Bufanda', lon: 0, lat: -41, esc: 1.45, modo: 'cara', caja: [-55, -28, 55, 58], f: function (c, c2) {
            return '<path d="M-55 -9C-55 -21 -30 -28 0 -28C30 -28 55 -21 55 -9C55 3 30 10 0 10C-30 10 -55 3 -55 -9Z" fill="' + c + '"/>'
                 + '<path d="M-52 -14C-40 -20 -20 -23 0 -23" stroke="' + c2 + '" stroke-width="5" stroke-linecap="round" fill="none" opacity=".55"/>'
                 + '<path d="M17 4C31 1 42 7 44 19L49 50C50 57 43 60 38 55L15 37Z" fill="' + c2 + '"/>';
        }},

        pajarita: { nom: 'Pajarita', col: '#242229', lon: 0, lat: -46, esc: 1.05, modo: 'cara', caja: [-53, -24, 53, 24], f: function (c, c2) {
            return '<path d="M-7 0C-7 -15 -16 -24 -32 -24C-46 -24 -53 -13 -53 0C-53 13 -46 24 -32 24C-16 24 -7 15 -7 0Z" fill="' + c + '"/>'
                 + '<path d="M7 0C7 -15 16 -24 32 -24C46 -24 53 -13 53 0C53 13 46 24 32 24C16 24 7 15 7 0Z" fill="' + c + '"/>'
                 + '<rect x="-10" y="-14" width="20" height="28" rx="7" fill="' + c2 + '"/>';
        }},

        taza: { nom: 'Café', lon: 70, lat: -18, esc: 1.15, dist: 1.24, caja: [-33, -44, 44, 36], f: function (c, c2) {
            return '<path d="M-24 -10H23V15C23 27 14 34 -1 34C-16 34 -24 27 -24 15Z" fill="' + c + '"/>'
                 + '<path d="M-24 -10H23V-2H-24Z" fill="' + c2 + '"/>'
                 + '<path d="M23 -2C37 -2 44 4 44 11C44 18 37 23 25 23" fill="none" stroke="' + c + '" stroke-width="7" stroke-linecap="round"/>'
                 + '<path d="M-33 36H32" stroke="' + c + '" stroke-width="7" stroke-linecap="round" fill="none"/>'
                 + '<path d="M-9 -20C-15 -28 -3 -34 -9 -44" fill="none" stroke="' + c2 + '" stroke-width="5" stroke-linecap="round" opacity=".8"/>'
                 + '<path d="M9 -20C3 -28 15 -34 9 -44" fill="none" stroke="' + c2 + '" stroke-width="5" stroke-linecap="round" opacity=".8"/>';
        }},

        /*  ── LOS DEL VESTIDOR DE coffeeIA (25/09/2026) ───────────────────

            Pedidos para el vestidor del ERP: una agenda, un moñito y un
            pincel. Siguen las reglas de la cabecera: solo c, c2 y c3 --la
            sombra de contacto los vuelve a llamar con los tres iguales--, y
            los brillos van con opacidad, que en la sombra se funden sin
            pintar nada de mas. Hubo tambien unos anteojos; se quitaron. */

        /*  La agenda flota al costado, como la taza pero del otro lado (lon
            -70): se pueden tener las dos sin que choquen. Tapa, lomo con
            anillas, canto de hojas, liga y etiqueta.

            VA GIRADA 90°. En una pieza radial el eje Y local apunta al centro
            del cuerpo, y en el costado izquierdo eso deja el "arriba" del
            dibujo mirando hacia afuera: sin el giro la agenda sale tumbada y
            las anillas se leen como los dientes de un peine. Con rotate(90)
            el arriba del dibujo vuelve a ser el arriba de la pantalla. */
        agenda: { nom: 'Agenda', col: '#3B6FE0', lon: -70, lat: -14, esc: 1.2, dist: 1.26, caja: [-40, -32, 40, 32], f: function (c, c2, c3) {
            return '<g transform="rotate(90)">'
                 +   '<rect x="-20" y="-35" width="52" height="72" rx="7" fill="' + c3 + '"/>'
                 +   '<rect x="-24" y="-39" width="52" height="74" rx="8" fill="' + c + '"/>'
                 +   '<rect x="-24" y="-39" width="12" height="74" rx="5" fill="' + c2 + '"/>'
                 +   '<g fill="none" stroke="' + c3 + '" stroke-width="3.5" stroke-linecap="round">'
                 +     '<path d="M-29 -26H-16M-29 -10H-16M-29 6H-16M-29 22H-16"/></g>'
                 +   '<rect x="-4" y="-26" width="24" height="15" rx="3" fill="' + c3 + '"/>'
                 +   '<path d="M1 -18H15" stroke="' + c2 + '" stroke-width="3" stroke-linecap="round"/>'
                 +   '<rect x="17" y="-39" width="6" height="74" fill="' + c2 + '"/>'
                 + '</g>';
        }},

        /*  EL MOÑITO VA AL COSTADO DE LA CABEZA, PEGADO, NO ENCIMA.

            La primera version flotaba centrada sobre la coronilla con el nudo
            apenas tocando: se leia como un moño puesto encima del dibujo. Un
            moño de pelo va sujeto a un lado --donde la flor--, y anclado a la
            superficie (sin `apoyo`) monta sobre el borde de la silueta: la
            mitad cae sobre la cabeza y ahi recibe la sombra de contacto. Al
            ser una pieza radial, se inclina solo con la curva de la cabeza y
            las puntas caen HACIA la cabeza, como caen de verdad.

            `sigue: 1` porque va sujeto: con la atenuacion de lo que solo se
            posa, al girar la cabeza el moño resbalaria por la piel.

            Lazadas con su pliegue interior (c2), un doblez a lo largo, el
            brillo del satén (c3), nudo envuelto y puntas cortadas en V. */
        monito: { nom: 'Moñito', juego: 0.4, lon: -30, lat: 55, esc: 1.05, sigue: 1, caja: [-45, -23, 45, 34], f: monoDePelo },

        /*  El pincel flota al costado IZQUIERDO con la punta arriba, un poco
            inclinado hacia afuera. El COLOR del accesorio es el de la pintura
            --las cerdas--; el mango va en c2 y la virola en c3, asi que
            cambiar de color es cambiar de pintura.

            rotate(90) por lo mismo que la agenda, que vive del mismo lado; el
            rotate(-22) lo inclina hacia fuera. Estuvo a la derecha (lon 72,
            rotate(-90) rotate(22)) y se pidio a la izquierda. */
        pincel: { nom: 'Pincel', col: '#E4572E', lon: -72, lat: -6, esc: 1.45, dist: 1.26, caja: [-46, -36, 46, 36], f: function (c, c2, c3) {
            return '<g transform="rotate(90) rotate(-22)">'
                 +   '<path d="M-5 8H5L4 42C4 45 2 46 0 46C-2 46 -4 45 -4 42Z" fill="' + c2 + '"/>'
                 +   '<rect x="-7" y="-6" width="14" height="15" rx="2.5" fill="' + c3 + '"/>'
                 +   '<path d="M-7 -1H7" stroke="' + c2 + '" stroke-width="2" opacity=".5"/>'
                 +   '<path d="M-7 -5C-9 -20 -5 -34 0 -44C5 -34 9 -20 7 -5Z" fill="' + c + '"/>'
                 +   '<path d="M-2 -10C-3 -20 -1 -29 1 -35" fill="none" stroke="' + c3 + '" stroke-width="2.5" stroke-linecap="round" opacity=".55"/>'
                 + '</g>';
        }},

        /*  LAPTOP (29/09/2026): la del Modo programador, pero como ACCESORIO.
            Se pidio una variante del Modo programador que se ponga en el
            vestidor en vez de elegirse como animacion, para poder llevarla
            con cualquier movimiento.

            ES LA MISMA DEL MODO PROGRAMADOR, NO UNA COPIA: no se dibuja aqui
            --`f` no pinta nada-- sino con la laptop del motor (laptopDe), con
            su guion de tecleo sin fin (tecleoFijo): las rayitas de las teclas
            y los `</>` y `{ }` que salen de la pantalla. Quieto, ademas, el
            muñeco baja la mirada y teclea como en el Modo programador; con
            otra animacion, hace la suya y la laptop sigue escribiendo. `col`
            es el color de la tapa (aluminio de fabrica) y se puede teñir. La
            `caja` solo reserva su sitio para el encuadre. */
        laptop: { nom: 'Laptop', col: '#CDD3DB', lon: 0, lat: -50, esc: 0.92, modo: 'cara', caja: [-68, -34, 68, 38],
                  f: function () { return ''; } },
        /*  ── DE TEMPORADA (26/09/2026) ─────────────────────────────────────

            Dos por fecha: Dia de Muertos, Halloween, Navidad, Año Nuevo y
            cumpleaños. Van en el grupo 'temporada' para que el vestidor los
            junte aparte.

            ESTOS SI LLEVAN COLORES FIJOS --el blanco del gorro navideño, el
            verde del tallo de la calabaza, el dorado de la cinta--, que la
            regla de la cabecera prohibe porque la sombra de contacto vuelve a
            llamar al dibujo. Por eso reciben un cuarto argumento, `s`: vale
            null al pintar y el color de la sombra al pintar la sombra, y cada
            color fijo se escribe `s || '#FFFFFF'`. Asi la sombra sale entera
            de su color, como la de todos. El color que elige la persona sigue
            siendo `c`: la parte principal (la copa, el cono, el globo). */
        catrina: { nom: 'Catrina', temporada: 'Día de Muertos', col: '#2B2B33', lon: 0, lat: 54, esc: 1.35, apoyo: 16,
                   caja: [-60, -44, 60, 18], f: function (c, c2, c3, s) {
            return '<path d="M-24 -4C-26 -30 -14 -42 0 -42C14 -42 26 -30 24 -4Z" fill="' + c + '"/>'
                 + '<path d="M-24 -11H24V-3H-24Z" fill="' + (s || '#7C5AC4') + '"/>'
                 + '<path d="M-60 6C-60 -2 -34 -8 0 -8C34 -8 60 -2 60 6C60 14 34 18 0 18C-34 18 -60 14 -60 6Z" fill="' + c + '"/>'
                 + florTemporada(-16, -14, s || '#F59E0B', s || '#B45309') + florTemporada(-3, -18, s || '#F59E0B', s || '#B45309')
                 + florTemporada(10, -14, s || '#E86A9A', s || '#9D174D');
        }},
        cempasuchil: { nom: 'Cempasúchil', temporada: 'Día de Muertos', col: '#F59E0B', lon: -34, lat: 44, esc: 1.3,
                       caja: [-36, -36, 36, 40], f: function (c, c2, c3, s) {
            var o = '<path d="M-6 22C-18 26 -26 34 -26 38C-18 38 -8 32 -4 24ZM6 22C18 26 26 34 26 38C18 38 8 32 4 24Z" fill="' + (s || '#4D7C0F') + '"/>';
            for (var i = 0; i < 12; i++) { var a = i / 12 * Math.PI * 2; o += '<circle cx="' + (20 * Math.cos(a)).toFixed(1) + '" cy="' + (20 * Math.sin(a)).toFixed(1) + '" r="9" fill="' + c2 + '"/>'; }
            for (var j = 0; j < 10; j++) { var b = j / 10 * Math.PI * 2 + 0.3; o += '<circle cx="' + (12 * Math.cos(b)).toFixed(1) + '" cy="' + (12 * Math.sin(b)).toFixed(1) + '" r="8" fill="' + c + '"/>'; }
            for (var k = 0; k < 7; k++) { var d = k / 7 * Math.PI * 2; o += '<circle cx="' + (5 * Math.cos(d)).toFixed(1) + '" cy="' + (5 * Math.sin(d)).toFixed(1) + '" r="6" fill="' + c3 + '"/>'; }
            return o + '<circle r="3.5" fill="' + c2 + '"/>';
        }},
        calabaza: { nom: 'Calabaza', temporada: 'Halloween', col: '#F2862E', lon: 0, lat: 60, esc: 1.45, apoyo: 20,
                    caja: [-40, -36, 40, 22], f: function (c, c2, c3, s) {
            var cara = s || '#3B2412';
            return '<path d="M-3 -18C-3 -27 2 -31 8 -33L10 -30C5 -28 3 -24 3 -18Z" fill="' + (s || '#4D7C0F') + '"/>'
                 + '<ellipse cx="-15" cy="0" rx="17" ry="20" fill="' + c2 + '"/><ellipse cx="15" cy="0" rx="17" ry="20" fill="' + c2 + '"/>'
                 + '<ellipse cx="0" cy="0" rx="19" ry="21" fill="' + c + '"/>'
                 + '<path d="M-13 -6L-7 -12L-2 -6ZM2 -6L7 -12L13 -6Z" fill="' + cara + '"/>'
                 + '<path d="M-14 4L-9 9L-4 5L0 9L4 5L9 9L14 4L9 13L4 10L0 13L-4 10L-9 13Z" fill="' + cara + '"/>';
        }},
        bruja: { nom: 'Sombrero de bruja', temporada: 'Halloween', col: '#2D2A3E', lon: 4, lat: 58, esc: 1.45, apoyo: 14,
                 caja: [-56, -80, 56, 16], f: function (c, c2, c3, s) {
            return '<path d="M-24 4C-20 -30 -8 -58 8 -72C14 -78 24 -80 30 -74C20 -72 14 -64 12 -54C18 -30 22 -12 24 4Z" fill="' + c + '"/>'
                 + '<path d="M-23 -7H23L24 2H-24Z" fill="' + (s || '#7C5AC4') + '"/>'
                 + '<rect x="-6" y="-8" width="12" height="11" rx="1.5" fill="none" stroke="' + (s || '#F2C94C') + '" stroke-width="2.4"/>'
                 + '<path d="M-56 2C-56 -6 -40 -11 0 -11C40 -11 56 -6 56 2C56 11 40 16 0 16C-40 16 -56 11 -56 2Z" fill="' + c + '"/>';
        }},
        navidad: { nom: 'Gorro navideño', temporada: 'Navidad', col: '#DC2626', lon: -4, lat: 56, esc: 1.35, apoyo: 14,
                   caja: [-42, -56, 62, 16], f: function (c, c2, c3, s) {
            var b = s || '#FFFFFF';
            return '<path d="M-32 4C-32 -30 -10 -50 12 -50C32 -50 44 -38 50 -22C43 -28 36 -31 30 -29C24 -18 28 -6 34 4Z" fill="' + c + '"/>'
                 + '<path d="M12 -50C24 -50 34 -44 40 -34" fill="none" stroke="' + c2 + '" stroke-width="3" stroke-linecap="round" opacity=".5"/>'
                 + '<rect x="-40" y="-4" width="80" height="18" rx="9" fill="' + b + '" stroke="' + (s || '#D1D5DB') + '" stroke-width="1.5"/>'
                 + '<circle cx="52" cy="-20" r="10" fill="' + b + '" stroke="' + (s || '#D1D5DB') + '" stroke-width="1.5"/>';
        }},
        reno: { nom: 'Astas de reno', temporada: 'Navidad', col: '#8B5E3C', lon: 0, lat: 60, esc: 1.35, apoyo: 8,
                caja: [-54, -48, 54, 12], f: function (c, c2, c3, s) {
            var asta = 'M-22 6C-24 -10 -28 -22 -36 -34M-30 -20C-38 -22 -44 -28 -46 -38M-26 -10C-18 -16 -16 -26 -18 -36';
            return '<path d="' + asta + '" fill="none" stroke="' + c + '" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>'
                 + '<g transform="scale(-1 1)"><path d="' + asta + '" fill="none" stroke="' + c + '" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></g>'
                 + '<path d="M-32 9C-18 2 18 2 32 9" fill="none" stroke="' + c2 + '" stroke-width="5" stroke-linecap="round"/>'
                 + '<path d="M-8 2C-14 -4 -20 -2 -20 3C-15 4 -12 5 -8 2ZM-4 2C-2 -5 4 -8 8 -4C4 -1 1 1 -4 2Z" fill="' + (s || '#15803D') + '"/>'
                 + '<circle cx="-6" cy="4" r="3" fill="' + (s || '#DC2626') + '"/><circle cx="-1" cy="5.5" r="3" fill="' + (s || '#DC2626') + '"/>';
        }},
        chistera: { nom: 'Chistera', temporada: 'Año Nuevo', col: '#1F2937', lon: 0, lat: 58, esc: 1.3, apoyo: 16,
                    caja: [-46, -72, 50, 18], f: function (c, c2, c3, s) {
            var oro = s || '#F2C94C';
            return '<path d="M-22 4V-54C-22 -58 -18 -60 0 -60C18 -60 22 -58 22 -54V4Z" fill="' + c + '"/>'
                 + '<path d="M-22 -12H22V-3H-22Z" fill="' + oro + '"/>'
                 + '<path d="M-44 6C-44 -1 -26 -5 0 -5C26 -5 44 -1 44 6C44 13 26 17 0 17C-26 17 -44 13 -44 6Z" fill="' + c + '"/>'
                 + '<g transform="translate(34 -52)">' + estrella5(oro, 0.8) + '</g><g transform="translate(-34 -34)">' + estrella5(oro, 0.55) + '</g>';
        }},
        /*  NEW YEAR: diadema dorada con una placa que dice el año que
            empieza, y dos estrellas en resortes. El año se calcula al
            pintar (anioNuevo): de julio en adelante, el siguiente; en enero,
            el que acaba de empezar. Asi no hay que tocarlo cada año.
            Sustituye a la «Diadema de estrellas», que se pidio cambiar. */
        newyear: { nom: 'New Year', temporada: 'Año Nuevo', col: '#F2C94C', lon: 0, lat: 64, esc: 1.45, apoyo: 6,
                   caja: [-46, -50, 46, 10], f: function (c, c2, c3, s) {
            var resorte = 'fill="none" stroke="' + c2 + '" stroke-width="2.2" stroke-linecap="round"';
            return '<path d="M-14 4V-20M14 4V-20" stroke="' + c2 + '" stroke-width="2.4"/>'
                 + '<path d="M-24 2C-28 -8 -32 -14 -36 -26" ' + resorte + '/><path d="M24 2C28 -8 32 -14 36 -26" ' + resorte + '/>'
                 + '<path d="M-36 8C-24 -2 24 -2 36 8" fill="none" stroke="' + c + '" stroke-width="5" stroke-linecap="round"/>'
                 + '<rect x="-28" y="-40" width="56" height="21" rx="6" fill="' + c + '"/>'
                 + '<rect x="-24.5" y="-36.5" width="49" height="14" rx="4" fill="none" stroke="' + c3 + '" stroke-width="1.2"/>'
                 + numeros(String(anioNuevo()), -21, -35.5, 1, s || '#1F2937')
                 + '<g transform="translate(-36 -30)">' + estrella5(c, 0.9) + '</g><g transform="translate(36 -30)">' + estrella5(c, 0.9) + '</g>';
        }},
        fiesta: { nom: 'Gorrito de fiesta', temporada: 'Cumpleaños', col: '#7C5AC4', lon: 8, lat: 60, esc: 1.45, apoyo: 10,
                  caja: [-28, -62, 28, 12], f: function (c, c2, c3, s) {
            return '<path d="M-24 8L0 -52L24 8Z" fill="' + c + '"/>'
                 + '<circle cx="-6" cy="-6" r="3.5" fill="' + (s || '#F2C94C') + '"/><circle cx="8" cy="-18" r="3.5" fill="' + (s || '#2F9E7E') + '"/>'
                 + '<circle cx="-2" cy="-32" r="3" fill="' + (s || '#E86A9A') + '"/><circle cx="12" cy="0" r="3.2" fill="' + (s || '#2496E8') + '"/>'
                 + '<path d="M-26 8C-20 3 -14 11 -8 6C-2 1 4 11 10 6C16 1 22 11 26 8" fill="none" stroke="' + c2 + '" stroke-width="4" stroke-linecap="round"/>'
                 + '<circle cx="0" cy="-54" r="7" fill="' + (s || '#F2C94C') + '"/>';
        }},
        /*  EL GLOBO FLOTA: va arriba, a un lado de la cabeza y separado de
            ella (dist 1.45), con el cordon largo bajando hasta el muñeco, y
            sube y baja solo (`flota`). Es pieza de cara para que salga
            derecho en pantalla --una radial en ese sitio saldria girada 45°--.
            Estuvo pegado al costado y no se leia como globo. */
        globo: { nom: 'Globo', temporada: 'Cumpleaños', col: '#E4572E', modo: 'cara', lon: 48, lat: 42, esc: 1.35, dist: 1.45,
                 flota: 4, caja: [-40, -38, 24, 74], f: function (c, c2, c3, s) {
            return '<path d="M0 20C-2 34 -14 40 -16 52C-18 62 -26 66 -34 72" fill="none" stroke="' + (s || '#94A3B8') + '" stroke-width="1.6" stroke-linecap="round"/>'
                 + '<path d="M0 -36C14 -36 22 -24 22 -12C22 4 10 14 0 16C-10 14 -22 4 -22 -12C-22 -24 -14 -36 0 -36Z" fill="' + c + '"/>'
                 + '<path d="M-3 16H3L0 20Z" fill="' + c2 + '"/>'
                 + '<ellipse cx="-9" cy="-20" rx="4" ry="7" fill="' + c3 + '" opacity=".7" transform="rotate(-20 -9 -20)"/>';
        }}

    };

    /* ---------------------------------------------------------------- gestos
       Cada gesto decide la postura, los ojos y si el cuerpo cambia de forma.
       `t` son segundos desde que arrancó. */
    var GESTOS = {
        calma:   { nom: 'Calma',   f: function () { return {}; } },
        curioso: { nom: 'Curioso', f: function (t) {
            return { gaze: { yaw: 40, pitch: 16, roll: -20 }, w: 0.21, h: 0.46 };
        }},
        feliz:   { nom: 'Feliz',   f: function () { return { w: 0.30, h: 0.20, arco: true }; } },
        sorpresa:{ nom: 'Sorpresa',f: function () { return { w: 0.34, h: 0.44, split: 19, escala: 1.05 }; } },
        guino:   { nom: 'Guiño',   f: function () { return { ojo2: { w: 0.42, h: 0.085 }, split: 16.25,
                                                             gaze: { yaw: -5.37, pitch: 4.55, roll: 6.7 } }; } },
        sueno:   { nom: 'Sueño',   f: function (t) {
            return { h: 0.06, w: 0.30, gaze: { yaw: 12, pitch: -18, roll: -8 },
                     zzz: true, respira: 0.6 };
        }},
        pensando:{ nom: 'Pensando',f: function (t) { return { puntos: true, sinOjos: true }; } },

        /* ── LA SEGUNDA TANDA ─────────────────────────────────────────────

           El catálogo tenía el ánimo cubierto por arriba --contento,
           sorprendido, dormido-- y nada por abajo: un asistente que sólo
           sabe estar bien no puede acusar recibo de que algo salió mal.

           Los cuatro salen de lo que ya había --gaze, w/h, split, escala--
           salvo `incl`, que es el único añadido al motor: cuánto se tuerce
           cada ojo, en grados, y EN ESPEJO uno del otro. Positivo baja las
           puntas de dentro --"\ /", enfado--; negativo las sube --"/ \",
           tristeza--. Es la ceja que este muñeco no tiene. */

        atento:  { nom: 'Atento',  f: function () {
            /*  De frente y con los ojos abiertos del todo. Es el gesto de
                estar escuchando: la pose de reposo mira a un lado, y mirar
                a un lado mientras alguien habla se lee como distraído. */
            return { gaze: { yaw: 7, pitch: 30, roll: 1 },
                     w: 0.205, h: 0.50, split: 16.6 };
        }},

        duda:    { nom: 'Duda',    f: function () {
            /*  Cabeza ladeada y ojos entornados DESIGUAL. El desnivel entre
                los dos es lo que lo separa de un parpadeo a medias: uno
                mira, el otro casi cerrado, y eso es una ceja levantada sin
                tener ceja. */
            return { gaze: { yaw: 14, pitch: 20, roll: -17 },
                     w: 0.205, h: 0.44, ojo2: { w: 0.30, h: 0.155 }, split: 16.2 };
        }},

        enfado:  { nom: 'Enfado',  f: function () {
            /*  De frente, ojos cortos y torcidos hacia dentro, y el cuerpo
                un pelo más grande respirando más hondo: enfadarse ocupa
                sitio. */
            return { gaze: { yaw: 5, pitch: 26, roll: 0 },
                     incl: 26, w: 0.20, h: 0.34, split: 16.8,
                     escala: 1.02, respira: 1.35 };
        }},

        triste:  { nom: 'Triste',  f: function () {
            /*  La torcedura al revés, la cara caída --un pitch bajo baja los
                ojos por la esfera-- y el cuerpo encogido con el aliento
                corto. Ninguna de las tres cosas por separado se lee como
                tristeza; las tres juntas, sí. */
            return { gaze: { yaw: 12, pitch: 8, roll: -9 },
                     incl: -22, w: 0.19, h: 0.31,
                     escala: 0.97, respira: 0.75 };
        }}
    };

    /* ----------------------------------------------------------- animacion
       Un gesto es una POSTURA; una animacion es un MOVIMIENTO de cuerpo
       entero que va encima de ella. Recibe `u`, la vuelta de 0 a 1, y dice
       cuanto girar la cabeza, cuanto desplazar el cuerpo y cuanto acharlo.

       El periodo divide siempre los 6 s del ciclo exportado: si no, el SVG
       animado pega un salto al cerrar el bucle.

       `fase` es el instante en que la animacion se explica sola: el que se
       congela en la miniatura del selector. */
    /*  Los instantes en que el sorbo cambia de idea, en fraccion de vuelta
        (ver sorbo()). Los comparten `cafe` y `cafe_llevar`. Va FUERA de ANIMS
        y ANTES: un var declarado mas abajo valdria undefined aqui. */
    var HITOS_CAFE = [0.18, 0.36, 0.38, 0.45, 0.55, 0.60, 0.74, 0.76, 0.90];

    /*  EL GUION DE `programa`, en fraccion de vuelta (ver tecleo()). Va aqui
        por lo mismo que HITOS_CAFE: ANIMS lo lee al declararse.

        RAFAGAS son los dos tramos en que teclea: [desde, hasta, golpes]. Entre
        las dos levanta la cabeza a pensar. GLIFOS_T son los instantes en que
        nace cada simbolo que sube de la pantalla, y GLIFO_VIDA lo que dura.

        Los HITOS salen de ahi: cada golpe de tecla es un sube y baja de
        cuatro decimas, mas rapido que las 24 muestras del SVG exportado, y
        sin una muestra en cada pico y cada valle el tecleo se perderia al
        exportar. Lo mismo con el nacer y morir de cada simbolo. */
    var RAFAGAS    = [[0.29, 0.52, 6], [0.60, 0.84, 6]];
    var GLIFOS_T   = [0.31, 0.40, 0.49, 0.63, 0.72, 0.81];
    var GLIFO_VIDA = 0.14;
    var HITOS_PROGRAMA = (function () {
        var h = [0.06, 0.18, 0.26, 0.52, 0.56, 0.60, 0.86, 0.91, 0.92, 0.98];
        RAFAGAS.forEach(function (ra) {
            for (var i = 0; i <= ra[2] * 2; i++) h.push(ra[0] + (ra[1] - ra[0]) * i / (ra[2] * 2));
        });
        GLIFOS_T.forEach(function (b) { h.push(b, b + GLIFO_VIDA / 2, b + GLIFO_VIDA); });
        return h.sort(function (a, b) { return a - b; });
    })();

    /*  EL GUION DEL PROGRAMADOR DE LADO (ver trabajoLado()): siete teclas por
        rafaga. Los hitos por lo mismo que HITOS_PROGRAMA. */
    var RAFAGAS_LADO = [[0.30, 0.52, 7], [0.60, 0.82, 7]];
    var HITOS_LADO = (function () {
        var h = [0.06, 0.10, 0.14, 0.18, 0.22, 0.27, 0.52, 0.56, 0.60, 0.84, 0.88, 0.89, 0.93, 0.95, 0.98];
        RAFAGAS_LADO.forEach(function (ra) {
            for (var i = 0; i <= ra[2] * 2; i++) h.push(ra[0] + (ra[1] - ra[0]) * i / (ra[2] * 2));
        });
        return h.sort(function (a, b) { return a - b; });
    })();

    /*  EL GUION DEL MODO PROGRAMADOR (ver tecleoFijo()): la laptop de
        frente, abierta toda la vuelta. Dos rafagas largas con una pausa a
        pensar en medio, y los simbolos repartidos por las dos. */
    var RAFAGAS_FIJO = [[0.02, 0.44, 10], [0.54, 0.96, 10]];
    var GLIFOS_FIJO  = [0.05, 0.17, 0.29, 0.57, 0.69, 0.81];
    var HITOS_FIJO = (function () {
        var h = [0.44, 0.49, 0.54, 0.96, 1];
        RAFAGAS_FIJO.forEach(function (ra) {
            for (var i = 0; i <= ra[2] * 2; i++) h.push(ra[0] + (ra[1] - ra[0]) * i / (ra[2] * 2));
        });
        GLIFOS_FIJO.forEach(function (b) { h.push(b, b + GLIFO_VIDA / 2, b + GLIFO_VIDA); });
        return h.sort(function (a, b) { return a - b; });
    })();

    var ANIMS = {
        ninguna: { nom: 'Quieto', per: 1, fase: 0, f: null },

        /*  Asiente: la cabeza cae y vuelve. El balanceo lateral, al doble de
            frecuencia, es lo que evita que parezca un piston. */
        asiente: { nom: 'Asiente', per: 1.5, fase: 0.25, f: function (u) {
            var a = Math.sin(u * Math.PI * 2);
            return { pitch: -14 * a, dy: 5 * a, roll: 2.5 * Math.sin(u * Math.PI * 4) };
        }},

        /*  Niega: gira a los lados. El roll en contra hace que el cuello se
            lea como cuello y no como bisagra. */
        niega: { nom: 'Niega', per: 1.2, fase: 0.25, f: function (u) {
            var a = Math.sin(u * Math.PI * 2);
            return { yaw: 27 * a, roll: -4.5 * a, dx: 4 * a, pitch: 3 * Math.cos(u * Math.PI * 4) };
        }},

        /*  Salta: se agacha, sube estirado y aterriza aplastandose. El
            aplastamiento es lo que lo hace un salto; sin el es un ascensor.
            La ultima quinta parte de la vuelta es reposo, para que se vean
            saltos y no un rebote continuo. */
        salta: { nom: 'Salta', per: 1.5, fase: 0.39, hitos: [0.16, 0.62, 0.80], f: function (u) {
            var agacha = u < 0.16 ? Math.sin(u / 0.16 * Math.PI) : 0;
            var vuelo  = (u >= 0.16 && u < 0.62) ? Math.sin((u - 0.16) / 0.46 * Math.PI) : 0;
            var cae    = (u >= 0.62 && u < 0.80) ? Math.sin((u - 0.62) / 0.18 * Math.PI) : 0;
            var aplasta = 0.12 * agacha + 0.15 * cae;
            var estira  = 0.09 * Math.pow(vuelo, 0.7);
            return {
                dy: -34 * vuelo + 6 * agacha + 7 * cae,
                sx: 1 + aplasta * 0.85 - estira * 0.75,
                sy: 1 - aplasta + estira,
                roll: 3 * vuelo * Math.sin(u * Math.PI * 2)
            };
        }},

        /*  MÚSICA: escucha con la cabeza al compás. Cuatro golpes por vuelta
            --80 por minuto con la vuelta de 3 s-- y un vaivén de lado a lado
            que tarda la vuelta entera, dos golpes hacia cada lado.

            El golpe baja RÁPIDO y sube DESPACIO (0.15 s contra 0.6): así se
            marca un pulso y no se mece. Con la bajada y la subida iguales se
            lee como un sí lento, que es `asiente`.

            `notas` le pide al motor las corcheas que suben por los costados
            (ver notas()). Queda bien con los cascos, pero no los exige. */
        musica: { nom: 'Música', per: 3, fase: 0.3, notas: true,
                  hitos: [0, 0.05, 0.25, 0.30, 0.5, 0.55, 0.75, 0.80], f: function (u) {
            var b   = (u * 4) % 1;
            var cae = b < 0.2 ? suave(b / 0.2) : 1 - suave((b - 0.2) / 0.8);
            var va  = Math.sin(u * Math.PI * 2);
            return {
                pitch: -9 * cae, dy: 4 * cae,
                roll: 8 * va, yaw: 7 * va, dx: 6 * va,
                sx: 1 + 0.022 * cae, sy: 1 - 0.026 * cae
            };
        }},

        /*  CAFÉ: se toma un sorbo. La taza sube desde abajo a la derecha, la
            cabeza la busca, se echa atras con los ojos cerrados mientras
            bebe, baja la taza y se estremece de gusto. Luego reposo con el
            vapor saliendo, que es lo que dice "cafe" antes de beber.

            Tres tiempos, como `hallazgo` y por lo mismo: sin la mirada que va
            a la taza el sorbo sale de la nada; sin el estremecimiento del
            final no se nota que estaba bueno.

            `taza` dice QUE taza pinta el motor --una clave de TAZAS-- y la
            coloca tazaDe(). El guion lo comparten el cuerpo y la taza
            --sorbo()-- para que lean el mismo instante: con dos relojes la
            taza llega a la cara cuando la cabeza ya se fue.

            `cierra` es lo unico que no es de cuerpo: cierra los ojos mientras
            bebe. Va aqui y no en un gesto porque dura lo que dura el sorbo.

            LA VUELTA ENTERA DURA 6 s, y no es un numero libre: el periodo
            tiene que dividir los 6 s del ciclo exportado o el SVG animado
            pega un salto al cerrar. De los 3 s de la primera version se
            subio al siguiente escalon --se pidio mas lenta-- y el tiempo de
            mas se reparte entre el movimiento y las pausas: cada tramo dura
            ~1.7 veces lo que duraba, y el reposo del final crece. */
        cafe: { nom: 'Café', per: 6, fase: 0.45, taza: 'tarro', hitos: HITOS_CAFE, f: sorbeCuerpo },

        /*  CAFÉ PARA LLEVAR: el mismo sorbo con el vaso de papel. Guion,
            tiempos y cuerpo son los de `cafe`; solo cambia la taza. Van como
            dos animaciones y no como una opcion dentro de la misma porque el
            vestidor guarda UNA clave, y asi cada quien se queda con la suya. */
        cafe_llevar: { nom: 'Café para llevar', per: 6, fase: 0.45, taza: 'vaso', hitos: HITOS_CAFE, f: sorbeCuerpo },

        /*  MODO PROGRAMADOR (clave `oficina`): con su laptop y tecleando.

            Nacio como `programa` y fue «Modo oficina» hasta el 29/09/2026,
            cuando se cambiaron los nombres con la version de lado y se pidio
            que SE QUEDE PROGRAMANDO: la laptop ya esta fuera y abierta toda
            la vuelta, nunca la cierra ni la guarda. El muñeco mira la
            pantalla y teclea en dos rafagas; entre una y otra levanta la
            cabeza a pensar. Mientras teclea le salen de la pantalla `</>` y
            `{ }`, como las notas de `musica`. La clave sigue siendo `oficina`
            para no perder lo que ya guardo cada quien.

            LA LAPTOP SE VE POR DETRAS: la pantalla mira al muñeco, asi que a
            nosotros nos toca la tapa, con el logo de la taza. Es el encuadre
            de siempre de "alguien trabajando en su laptop" y deja los ojos
            por encima de la tapa, que es lo que hace falta para que se lea
            que mira la pantalla.

            `laptop` le pide al motor la laptop y los simbolos (ver laptopDe);
            `guion` le dice cual: tecleoFijo(), compartido con el cuerpo. 6 s
            por la misma razon que el cafe: tiene que dividir el ciclo
            exportado. */
        oficina: { nom: 'Modo programador', per: 6, fase: 0.4, laptop: true, especial: true,
                   guion: tecleoFijo, glifos: GLIFOS_FIJO, hitos: HITOS_FIJO, f: programadorCuerpo },

        /*  MODO OFICINA (clave `programa`; fue «Programador» hasta el
            29/09/2026): saca la laptop, SE PONE DE LADO y trabaja. Se pidio
            despues de la de frente, al estilo de las mascotas que programan
            de perfil.

            De lado cambia todo lo que en `oficina` no se podia ver: la
            laptop queda a su derecha en tres cuartos, asi que se ven el
            teclado y la pantalla con el
            codigo escribiendose linea a linea. El cuerpo gira la cara hacia
            la pantalla (yaw) y se corre a la izquierda para dejarle sitio. A
            media faena te mira de reojo, y al acabar cierra, se vuelve de
            frente y la guarda.

            `lado` le pide al motor la laptop de perfil (ver ladoDe). Guion
            compartido con el cuerpo en trabajoLado(). */
        programa: { nom: 'Modo oficina', per: 6, fase: 0.42, lado: true, especial: true,
                    hitos: HITOS_LADO, f: programaLadoCuerpo },

        /* ── LOS DE TRABAJO: ver LOS MOVIMIENTOS DE TRABAJO, mas abajo. Van
           en el grupo 'trabajo' para que el vestidor los junte aparte. */
        llevame:    { nom: 'Llévame', per: 6, fase: 0.66, grupo: 'trabajo', lado: true, app: true,
                      f: llevameCuerpo, utileria: llevameUtil,
                      hitos: hitosDe(HITOS_LADO.concat([0.32, 0.38, 0.44, 0.50, 0.56, 0.585, 0.61, 0.62, 0.65, 0.66, 0.69, 0.72, 0.78])) },
        leyendo:    { nom: 'Leyendo', per: 6, fase: 0.49, grupo: 'trabajo', f: leyendoCuerpo, utileria: leyendoUtil,
                      hitos: hitosDe([0.06, 0.16, 0.18, 0.31, 0.44, 0.46, 0.48, 0.50, 0.52, 0.54, 0.56, 0.69, 0.82, 0.86, 0.95]) },
        calculando: { nom: 'Calculando', per: 6, fase: 0.76, grupo: 'trabajo', f: calculandoCuerpo, utileria: calculandoUtil,
                      hitos: hitosDe([0.06, 0.16, 0.66, 0.70, 0.74, 0.86, 0.95]
                                     .concat((function () { var h = []; for (var i = 0; i <= 20; i++) h.push(0.20 + 0.46 * i / 20); return h; })())) },
        entrega:    { nom: 'Descargando', per: 6, fase: 0.5, grupo: 'trabajo', f: entregaCuerpo, utileria: entregaUtil,
                      hitos: hitosDe([0.08, 0.20, 0.24, 0.335, 0.43, 0.525, 0.62, 0.64, 0.68, 0.70, 0.84, 0.94]) },
        anotando:   { nom: 'Agendando', per: 6, fase: 0.6, grupo: 'trabajo', f: anotandoCuerpo, utileria: anotandoUtil,
                      hitos: hitosDe([0.06, 0.16, 0.24, 0.29, 0.34, 0.44, 0.42, 0.48, 0.50, 0.54, 0.78, 0.84, 0.86, 0.95]
                                     .concat((function () { var h = []; for (var i = 0; i <= 26; i++) h.push(0.52 + i / 100); return h; })())) },
        correo:     { nom: 'Enviando correo', per: 6, fase: 0.8, grupo: 'trabajo', lado: true, app: true,
                      f: correoCuerpo, utileria: correoUtil,
                      hitos: hitosDe(HITOS_LADO.concat([0.30, 0.34, 0.36, 0.425, 0.49, 0.555, 0.62, 0.66, 0.665, 0.67, 0.68, 0.71,
                                      0.715, 0.72, 0.75, 0.765, 0.80, 0.84])) },

        /* ── DEL DIA, DE LA CASA Y SIN RESULTADOS: ver mas abajo. */
        vacio:      { nom: 'Sin resultados', per: 6, fase: 0.72, grupo: 'trabajo', f: vacioCuerpo, utileria: vacioUtil,
                      hitos: hitosDe([0.06, 0.16, 0.18, 0.60, 0.62, 0.66, 0.68, 0.80, 0.86, 0.88, 0.95].concat((function () { var h = []; for (var i = 0; i <= 24; i++) h.push(0.22 + 0.38 * i / 24); return h; })())) },
        videollamada: { nom: 'Videollamada', per: 6, fase: 0.48, grupo: 'trabajo', lado: true, app: true,
                        f: videollamadaCuerpo, utileria: videollamadaUtil,
                        hitos: hitosDe(HITOS_LADO.concat([0.30, 0.32, 0.40, 0.42, 0.44, 0.52, 0.54, 0.56, 0.64, 0.66, 0.68, 0.78, 0.80]
                                       .concat((function () { var h = []; for (var i = 0; i <= 20; i++) h.push(0.30 + 0.50 * i / 20); return h; })()))) },
        aprobando:  { nom: 'Aprobando', per: 6, fase: 0.62, grupo: 'trabajo', f: aprobandoCuerpo, utileria: aprobandoUtil,
                      hitos: hitosDe([0.06, 0.16, 0.22, 0.28, 0.34, 0.39, 0.40, 0.42, 0.43, 0.44, 0.45, 0.50, 0.56, 0.86, 0.95]) },
        guardando:  { nom: 'Guardando', per: 6, fase: 0.72, grupo: 'trabajo', f: guardandoCuerpo, utileria: guardandoUtil,
                      hitos: hitosDe([0.06, 0.16, 0.20, 0.22, 0.64, 0.66, 0.70, 0.86, 0.95].concat((function () { var h = []; for (var i = 0; i <= 48; i++) h.push(0 + 1 * i / 48); return h; })())) },
        saludo:     { nom: 'Saludo', per: 3, fase: 0.3, grupo: 'dia', f: saludoCuerpo, utileria: saludoUtil,
                      hitos: hitosDe([0.08, 0.20, 0.70, 0.86], [[0.10, 0.42, 2]]) },
        festejo:    { nom: 'Festejo', per: 3, fase: 0.36, grupo: 'dia', f: festejoCuerpo, utileria: festejoUtil,
                      hitos: hitosDe([0.08, 0.24, 0.40, 0.45, 0.50].concat((function () { var h = []; for (var i = 0; i <= 16; i++) h.push(0.18 + 0.62 * i / 16); return h; })())) },
        fin:        { nom: 'Fin de jornada', per: 6, fase: 0.72, grupo: 'dia', f: finCuerpo, utileria: finUtil,
                      hitos: hitosDe([0.08, 0.20, 0.28, 0.38, 0.44, 0.54, 0.58, 0.60, 0.64, 0.68, 0.90, 0.97]) },
        barista:    { nom: 'Barista', per: 6, fase: 0.7, grupo: 'casa', f: baristaCuerpo, utileria: baristaUtil,
                      hitos: hitosDe([0.06, 0.16, 0.24, 0.27, 0.43, 0.58, 0.59, 0.61, 0.62, 0.67, 0.68, 0.72, 0.78, 0.84, 0.86, 0.90, 0.95]) },
        caja:       { nom: 'Caja', per: 6, fase: 0.6, grupo: 'casa', f: cajaCuerpo, utileria: cajaUtil,
                      hitos: hitosDe([0.06, 0.16, 0.22, 0.42, 0.48, 0.54, 0.57, 0.68, 0.72, 0.76, 0.80, 0.82, 0.86, 0.95]
                                     .concat((function () { var h = []; for (var i = 0; i <= 12; i++) h.push(0.52 + 0.18 * i / 12); return h; })())) },

        /* ── LOS DE PROCESO (29/09/2026): ver LOS PROCESOS, mas abajo. Van en
           el grupo 'proceso': no se eligen en el vestidor, los dispara lo que
           pasa (abrir el chat, terminar una tarea, un error...). */
        p_asoma:    { nom: 'Asomarse',       per: 1.5, fase: 0.6,  grupo: 'proceso', f: pAsoma,    utileria: pAsomaUtil },
        p_abre:     { nom: 'Abrir',          per: 1,   fase: 0.3,  grupo: 'proceso', f: pAbre,     utileria: pNada },
        p_cierra:   { nom: 'Cerrar',         per: 1,   fase: 0.4,  grupo: 'proceso', f: pCierra,   utileria: pNada },
        p_encima:   { nom: 'Encima',         per: 1,   fase: 0.2,  grupo: 'proceso', f: pEncima,   utileria: pNada },
        p_saluda:   { nom: 'Saludar',        per: 1.5, fase: 0.3,  grupo: 'proceso', f: pSaluda,   utileria: pSaludaUtil },
        p_aviso:    { nom: 'Aviso',          per: 1,   fase: 0.4,  grupo: 'proceso', f: pAviso,    utileria: pAvisoUtil },
        p_trabaja:  { nom: 'Trabajando',     per: 1.5, fase: 0.3,  grupo: 'proceso', f: pTrabaja,  utileria: pTrabajaUtil },
        p_piensa:   { nom: 'Pensando',       per: 1.5, fase: 0.5,  grupo: 'proceso', f: pPiensa,   utileria: pPiensaUtil },
        p_busca:    { nom: 'Buscando',       per: 1.5, fase: 0.25, grupo: 'proceso', f: pBusca,    utileria: pBuscaUtil },
        p_permiso:  { nom: 'Pide permiso',   per: 1.5, fase: 0.2,  grupo: 'proceso', f: pPermiso,  utileria: pPermisoUtil },
        p_pregunta: { nom: 'Pregunta',       per: 1.5, fase: 0.5,  grupo: 'proceso', f: pPregunta, utileria: pPreguntaUtil },
        p_listo:    { nom: 'Terminado',      per: 1.5, fase: 0.85, grupo: 'proceso', f: pListo,    utileria: pListoUtil },
        p_error:    { nom: 'Error',          per: 1.5, fase: 0.22, grupo: 'proceso', f: pError,    utileria: pErrorUtil },
        p_limite:   { nom: 'Límite',         per: 1.5, fase: 0.5,  grupo: 'proceso', f: pLimite,   utileria: pLimiteUtil },
        p_aprueba:  { nom: 'Aprobar',        per: 1,   fase: 0.5,  grupo: 'proceso', f: pAprueba,  utileria: pApruebaUtil },
        p_envia:    { nom: 'Enviar',         per: 1,   fase: 0.35, grupo: 'proceso', f: pEnvia,    utileria: pEnviaUtil },
        p_adjunta:  { nom: 'Adjuntar',       per: 1.5, fase: 0.6,  grupo: 'proceso', f: pAdjunta,  utileria: pAdjuntaUtil },
        p_traga:    { nom: 'Tragar archivo', per: 1.5, fase: 0.25, grupo: 'proceso', f: pTraga,    utileria: pTragaUtil },
        p_avance:   { nom: 'Avance',         per: 1.5, fase: 0.6,  grupo: 'proceso', f: pAvance,   utileria: pAvanceUtil },
        p_carga:    { nom: 'Cargando',       per: 3,   fase: 0.45, grupo: 'proceso', f: pCarga,    utileria: pCargaUtil, sinLaptop: true },
        p_amor:     { nom: 'Cariño',         per: 1.5, fase: 0.3,  grupo: 'proceso', f: pAmor,     utileria: pAmorUtil },
        p_sorpresa: { nom: 'Sorpresa',       per: 1,   fase: 0.2,  grupo: 'proceso', f: pSorpresa, utileria: pSorpresaUtil },
        p_orgullo:  { nom: 'Orgullo',        per: 1.5, fase: 0.4,  grupo: 'proceso', f: pOrgullo,  utileria: pOrgulloUtil },
        p_guino:    { nom: 'Guiño',          per: 1,   fase: 0.4,  grupo: 'proceso', f: pGuino,    utileria: pGuinoUtil },
        p_toque:    { nom: 'Toque',          per: 1,   fase: 0.1,  grupo: 'proceso', f: pToque,    utileria: pToqueUtil },
        p_molesto:  { nom: 'Molesto',        per: 1.5, fase: 0.3,  grupo: 'proceso', f: pMolesto,  utileria: pMolestoUtil },
        p_mareo:    { nom: 'Mareado',        per: 1.5, fase: 0.92, grupo: 'proceso', f: pMareo,    utileria: pMareoUtil },
        p_bosteza:  { nom: 'Bostezo',        per: 3,   fase: 0.35, grupo: 'proceso', f: pBosteza,  utileria: pBostezaUtil },
        p_duerme:   { nom: 'Dormir',         per: 3,   fase: 0.5,  grupo: 'proceso', f: pDuerme,   utileria: pDuermeUtil },

        /* ── LOS ESTADOS ──────────────────────────────────────────────────

           Las cuatro de abajo no son gracias: son los estados que una
           interfaz necesita enseñar mientras el usuario espera. Se exportan
           como SVG animado y ese archivo se usa tal cual de indicador de
           carga, que es la razon de que existan.

           Van de menos a mas ruido: `pulso` cabe al lado de un boton,
           `cargando` ocupa una tarjeta, `buscando` narra que esta mirando
           algo y `hallazgo` es el unico que cuenta un final. */

        /*  PULSO. El indicador mas callado que se puede hacer: solo cambia
            de tamaño. Sube rapido y baja despacio --de ahi la potencia 1.7--
            porque un latido no es una onda simetrica: golpea y se relaja. */
        pulso: { nom: 'Pulso', per: 1.5, fase: 0.3, f: function (u) {
            var a = Math.pow(0.5 - 0.5 * Math.cos(u * Math.PI * 2), 1.7);
            return { sx: 1 + 0.050 * a, sy: 1 + 0.050 * a, dy: -7 * a, pitch: 2.6 * a };
        }},

        /*  CARGANDO. El cuerpo recorre un circulo: es el giro de un spinner
            de toda la vida, hecho con el propio personaje en lugar de con un
            arco. Tres detalles lo separan de una pieza dando vueltas:

            - la cabeza gira UN POCO hacia donde va (yaw/pitch), no del todo:
              del todo se lee como que la arrastran;
            - el roll en contra le da peso, como una campana;
            - se achata abajo del recorrido y se estira arriba, que es lo que
              hace que el circulo tenga gravedad y no sea una orbita.

            Combinala con el gesto Pensando y el resultado es el indicador de
            carga completo: los tres puntos girando. */
        cargando: { nom: 'Cargando', per: 1.2, fase: 0.12, f: function (u) {
            var a = u * Math.PI * 2;
            var c = Math.cos(a), s = Math.sin(a);
            return {
                dx: c * 16, dy: s * 12,
                yaw: c * 8, pitch: -s * 6, roll: -c * 7,
                sx: 1 + 0.020 * s, sy: 1 - 0.022 * s
            };
        }},

        /*  BUSCANDO. Barre a un lado, SE PARA a mirar, barre al otro, se
            para, y vuelve al centro a pensarlo.

            Las paradas son el truco entero. Un barrido continuo es un
            limpiaparabrisas; lo que convierte el movimiento en una busqueda
            es detenerse en cada extremo, como si hubiera encontrado algo que
            merece un segundo. `suave` se encarga de que arranque y frene en
            vez de saltar.

            Se asoma en las paradas --baja la mirada y crece un pelo-- y en
            mitad del barrido va con la cabeza algo alta. `y*y` vale 1 justo
            en las paradas y 0 en el centro, asi que sirve de envolvente sin
            un solo caso aparte. */
        buscando: { nom: 'Buscando', per: 3, fase: 0.2,
                    hitos: [0.14, 0.30, 0.56, 0.72, 0.86], f: function (u) {
            var y;
            if      (u < 0.14) y = -suave(u / 0.14);
            else if (u < 0.30) y = -1;
            else if (u < 0.56) y = -1 + 2 * suave((u - 0.30) / 0.26);
            else if (u < 0.72) y =  1;
            else if (u < 0.86) y =  1 - suave((u - 0.72) / 0.14);
            else               y =  0;

            var mira = y * y;                       // 1 en las paradas, 0 en el centro
            return {
                yaw: 34 * y, roll: -5 * y, dx: 8 * y,
                pitch: -7 * mira + 3 * (1 - mira),
                sx: 1 + 0.016 * mira, sy: 1 + 0.016 * mira
            };
        }},

        /*  HALLAZGO. La sorpresa: lo encontro.

            Es la unica que cuenta una historia en tres tiempos, y los tres
            hacen falta. ANTICIPACION: se encoge y se hunde, que es como el
            ojo sabe que va a pasar algo. DISPARO: sale hacia arriba
            estirado. REBOTE: cae, se pasa de frenada, vuelve, y se va
            apagando --eso lo pone `amortigua`, no una lista de instantes--.

            Sin la anticipacion el salto sale de la nada; sin el rebote
            aterriza como un ladrillo. El giro va en otra frecuencia para que
            el cuerpo no oscile en bloque.

            Encaja detras de `buscando`: barre, barre, y esta es la vuelta en
            la que lo encuentra. */
        hallazgo: { nom: '¡Ajá!', per: 2, fase: 0.3,
                    hitos: [0.22, 0.26, 0.30, 0.35, 0.43], f: function (u) {
            var carga = u < 0.22 ? suave(u / 0.22) : 0;
            var t2    = u < 0.22 ? 0 : (u - 0.22) / 0.78;
            var pop   = amortigua(t2, 2.8, 3.8);
            var gira  = amortigua(t2, 4.2, 3.2);
            return {
                dy:    7 * carga - 44 * pop,
                sx:    1 + 0.10 * carga - 0.11 * pop,
                sy:    1 - 0.12 * carga + 0.14 * pop,
                pitch: -9 * carga + 22 * pop,
                roll:  5 * gira,
                yaw:  -4 * gira
            };
        }}
    };

    // -------------------------------------------------------------- paletas
    /*  Abre en blanco: es el tono de coffeeIA, la esfera de siempre. */
    var COLORES = [
        '#FFFFFF', '#B8B8B8', '#2496E8', '#7C5AC4', '#E4572E', '#2F9E7E', '#D14D8B',
        '#F2A93B', '#5C6470', '#8CC63F', '#E86A9A', '#3B6FE0', '#242229'
    ];
    var FONDOS = ['#F8F8F8', '#EFEDE8', '#E8EEF4', '#F3ECE4', '#1B1B1E', '#101014'];

    /*  LOS DE CASA. No son adorno: son la prueba de que el sistema cubre a los
        agentes que ya existen. El primero es coffeeIA --blanco, sin accesorio--
        que es la esfera blanca de siempre.

        Vive aqui y no en la pagina de la forja porque hay dos forjas: la de
        forja.html y la del wizard de agentes de avatars. Con una copia en cada
        una, agregar un agente de casa obligaba a acordarse de las dos, y la
        segunda siempre se olvida. */
    var CASA = [
        { nombre: 'coffeeIA',           forma: 'gota',     color: '#FFFFFF', fondo: '#F8F8F8', gesto: 'calma',    accesorio: 'ninguno',  acento: '#242229' },
        { nombre: 'coffeeMagic',        forma: 'gota',     color: '#7C5AC4', fondo: '#F3ECE4', gesto: 'curioso',  accesorio: 'mago',     acento: '#F2A93B' },
        { nombre: 'coffeeIntelligence', forma: 'hexagono', color: '#2496E8', fondo: '#E8EEF4', gesto: 'calma',    accesorio: 'lentes',   acento: '#242229' },
        { nombre: 'coffeeInvestigator', forma: 'canto',    color: '#5C6470', fondo: '#101014', gesto: 'pensando', accesorio: 'sol',      acento: '#8CC63F' },
        { nombre: 'coffeeArcher',       forma: 'huevo',    color: '#E4572E', fondo: '#F8F8F8', gesto: 'guino',    accesorio: 'ninguno',  acento: '#242229' },
        { nombre: 'coffeePlanner',      forma: 'pastilla', color: '#2F9E7E', fondo: '#EFEDE8', gesto: 'feliz',    accesorio: 'corona',   acento: '#F2A93B' },
        { nombre: 'coffeeClown',        forma: 'trebol',   color: '#D14D8B', fondo: '#F8F8F8', gesto: 'sorpresa', accesorio: 'pajarita', acento: '#F2A93B' },
        { nombre: 'coffeeKirby',        forma: 'gota',     color: '#E86A9A', fondo: '#F3ECE4', gesto: 'feliz',    accesorio: 'cascos',   acento: '#242229' },
        { nombre: 'coffeeArchivo',      forma: 'huevo',    color: '#8CC63F', fondo: '#1B1B1E', gesto: 'sueno',    accesorio: 'hoja',     acento: '#F8F8F8' }
    ];

    function tono(hex, f) {
        var n = parseInt(hex.slice(1), 16);
        var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
        if (f >= 0) { r *= (1 - f); g *= (1 - f); b *= (1 - f); }
        else { r += (255 - r) * -f; g += (255 - g) * -f; b += (255 - b) * -f; }
        return '#' + ((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b)).toString(16).slice(1);
    }
    function luz(hex) {
        var n = parseInt(hex.slice(1), 16);
        return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
    }

    /* ------------------------------------------------------------- parpadeo
       Los instantes salen de una semilla fija, no de Math.random: así el
       ritmo es siempre el mismo y, sobre todo, reproducible al exportar.
       Un 18% de las veces cae un segundo parpadeo pegado, que es lo que
       impide que suene a metrónomo. */
    var INSTANTES = (function () {
        var s = 24301;
        function az() { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }
        var v = [], t = 1.4;
        while (t < 900) {
            v.push(t);
            t += 1.9 + az() * 2.7;
            if (az() < 0.18) { v.push(t); t += 0.24; }
        }
        return v;
    })();

    function parpado(t) {
        for (var i = 0; i < INSTANTES.length; i++) {
            var n = INSTANTES[i];
            if (t < n) break;
            var r = (t - n) / 0.18;
            if (r >= 0 && r <= 1) return r < 0.45 ? 1 - r / 0.45 : (r - 0.45) / 0.55;
        }
        return 1;
    }

    /*  Deriva de reposo: dos ondas de periodo largo y distinto por eje, así
        la cabeza nunca vuelve exactamente a la misma postura. */
    function onda(t, p, d) { return Math.sin((t + d) * Math.PI * 2 / p); }

    function deriva(t, k) {
        return {
            yaw:   (onda(t, 11.3, 0.4) * 5.5 + onda(t, 3.7, 2.1) * 1.6) * k,
            pitch: (onda(t, 9.1, 1.3) * 4.2 + onda(t, 4.3, 0.7) * 1.3) * k,
            roll:   onda(t, 13.7, 3.2) * 2.2 * k
        };
    }

    // ------------------------------------------------------------------ API
    function receta(r) {
        r = r || {};
        return {
            nombre:    r.nombre || 'bloub',
            forma:     FORMAS[r.forma] ? r.forma : 'gota',
            color:     r.color || '#B8B8B8',
            fondo:     r.fondo || '#F8F8F8',
            /*  El gesto es normalmente un NOMBRE del catalogo, pero se
                acepta tambien un gesto YA RESUELTO --el objeto que
                devolveria GESTOS[x].f()--. Lo necesita quien interpola entre
                dos gestos por su cuenta: el guion del chat en
                nav-coffeeia.js pasa de calma a curioso en 0.55 s, y en medio
                no hay ningun nombre que describa la pose. Sin esto habria
                que duplicar el motor para tener transiciones. */
            gesto:     (r.gesto && typeof r.gesto === 'object') ? r.gesto
                     : (GESTOS[r.gesto] ? r.gesto : 'calma'),
            accesorio: ACCESORIOS[r.accesorio] ? r.accesorio : 'ninguno',
            anim:      ANIMS[r.anim] ? r.anim : 'ninguna',
            acento:    r.acento || '#242229',
            /*  El color que la persona le eligio a SU accesorio (vestidor
                del ERP, 29/09/2026). Manda sobre el de fabrica sin tocar el
                catalogo, que es compartido por todos los muñecos de la pagina. */
            accCol:    /^#[0-9a-f]{6}$/i.test(r.accCol || '') ? r.accCol : null,
            vivo:      r.vivo !== false
        };
    }

    /* ==================================================================
       UN CUADRO, EN PIEZAS

       Devolver las piezas por separado --y no una cadena ya montada-- es lo
       que permite exportar el SVG ANIMADO: se muestrea el ciclo, y de cada
       pieza sale una lista de valores que SMIL interpola. Si el motor
       devolviera sólo texto habría que reparsearlo.

       La estructura es SIEMPRE la misma para una receta dada: dos ojos, tres
       puntos, un accesorio. Lo que no toca se apaga con opacidad 0, porque
       una animación no puede añadir ni quitar elementos a mitad de camino.
       ================================================================== */
    function piezas(rec, t, mira, opciones) {
        var r = receta(rec);
        var o = opciones || {};
        var g = (typeof r.gesto === 'object') ? r.gesto
              : (GESTOS[r.gesto].f(t) || {});
        var m = mira || { x: 0, y: 0 };

        var quieto = o.quieto === true;
        var tt = quieto ? 0.62 : t;
        var fijo = clamp(o.fijo || 0, 0, 1);

        /*  La deriva y la animacion se piden POR INSTANTE y no una sola vez:
            el accesorio necesita las mismas dos cosas evaluadas un pelin
            antes que el cuerpo, y de ahi sale su inercia. */
        function dvDe(tq) {
            return quieto ? { yaw: 0, pitch: 0, roll: 0 }
                 : (o.ciclo ? derivaCiclo(tq) : deriva(tq, 1 - 0.75 * fijo));
        }

        /*  La animacion: un movimiento de cuerpo entero encima de la
            postura. `fase` fuerza un instante concreto y es lo que hace util
            la miniatura del selector: congelada en t=0, una animacion no se
            distingue de estar quieto. */
        var an = ANIMS[r.anim];
        var anima = an && an.f && (o.fase != null || !quieto);

        /*  El accesorio Laptop trae la laptop del Modo programador, salvo
            que la animacion ya saque la suya (oficina, programa y las de
            lado) o no quepa: en `p_carga` coffeeIA va encogido dentro de la
            barra y la laptop, que no encoge con el, lo tapaba entero. Ver
            `laptop` en ACCESORIOS. */
        var conLaptop = r.accesorio === 'laptop' && !(an && (an.laptop || an.lado || an.sinLaptop));

        /*  CON UNA ANIMACION EN MARCHA NO SIGUE AL CURSOR. La animacion ya
            mueve la cabeza a su manera --asiente, bebe, busca-- y la mirada
            encima la saca de su sitio: con el cafe, el muñeco giraba la cara
            hacia el raton mientras la taza seguia en la boca. Se anulan las
            dos cosas que trae el seguimiento: hacia donde mira (`m`) y cuanto
            te sigue (`fijo`, que ademas apaga la deriva y la pose). Vale para
            todo el que dibuje con el motor: lanzador, vestidor y forja. */
        if (anima) { m = { x: 0, y: 0 }; fijo = 0; }

        function movDe(tq) {
            /*  Lo de la segunda linea lo usan las animaciones de PROCESO
                (29/09/2026): `vuelta` gira la cara entera hacia arriba y por
                encima --sin el tope de la mirada--, `ojos` cambia la forma
                de los ojos (corazon, estrella, espiral, feliz), `guino`
                cierra solo el segundo, `ojoEsc` los agranda y `giro` hace
                girar la espiral. */
            var mv0 = { yaw: 0, pitch: 0, roll: 0, dx: 0, dy: 0, sx: 1, sy: 1, cierra: 0,
                        vuelta: 0, ojos: null, guino: 0, ojoEsc: 1, giro: 0 };
            if (!anima) {
                /*  Quieto con la Laptop puesta: teclea como en el Modo
                    programador, mirando la pantalla. */
                if (conLaptop) {
                    var mvL = programadorCuerpo(((tq / 6) % 1 + 1) % 1);
                    for (var kl in mv0) if (mvL[kl] != null) mv0[kl] = mvL[kl];
                }
                return mv0;
            }
            var u = ((tq / an.per) % 1 + 1) % 1;
            var mv = an.f(u) || {};
            for (var ki in mv0) if (mv[ki] != null) mv0[ki] = mv[ki];
            return mv0;
        }

        /*  El instante del cuadro. Con `fase` el reloj se para ahi, y el
            retardo del accesorio se mide igual desde ese punto: la miniatura
            del selector enseña el mismo desfase que se vera moviendose. */
        var tf = o.fase != null ? o.fase : tt;
        var dv  = dvDe(tt);
        var mov = movDe(tf);

        /*  ── LA SILUETA LISA ──────────────────────────────────────────────

            `silueta: 'lisa'` deja el contorno QUIETO: sin las dos ondas y sin
            el 1.6% de respiracion en el radio. Y la respiracion no se pierde:
            se convierte en `aire`, que inclina la cara grado y medio arriba y
            abajo. Sigue vivo; lo que no se mueve es el borde.

            Existe porque la forja se mira a 400 px y la app a 64 --o a 28 en
            una burbuja del chat--. A ese tamaño un radio que late no se lee
            como un pecho que se llena, se lee como un circulo que no para
            quieto. Y hay una razon tecnica ademas de la de gusto: en la app el
            borde es un aro de 1px de PANTALLA (vector-effect), asi que no
            crece con el cuerpo; al latir el radio, el aro caia cada cuadro en
            un subpixel distinto y parpadeaba de grosor.

            Va aqui arriba y no con el cuerpo porque `aire` entra en la
            POSTURA, que se calcula antes. */
        var per  = o.ciclo ? 3 : 3.4;
        var lisa = o.silueta === 'lisa';
        var onda = quieto ? 0 : Math.sin(tt * 2 * Math.PI / per) * (g.respira || 1);
        var aire = lisa ? onda * 1.5 : 0;

        // ---- postura
        /*  DE DONDE SALE LA POSTURA DE REPOSO, en este orden:

              1. la del GESTO, si trae la suya. `curioso` mira 40 grados a un
                 lado y eso es el gesto, no el reposo: pedir frente no se lo
                 quita.
              2. la que pida QUIEN DIBUJA, en `o.pose`.
              3. POSE, el tres cuartos de fabrica.

            El 2 esta por la forja: el taller abre de frente sin tocar ni el
            catalogo de gestos ni la pose de fabrica. */
        var b0 = g.gaze || o.pose || POSE;
        var k = 1 - 0.68 * fijo;
        var base = { yaw: b0.yaw * k, pitch: b0.pitch * k, roll: b0.roll * (1 - 0.4 * fijo) };
        /*  CUANTO GIRA LA CARA PERSIGUIENDO EL CURSOR, y hasta donde.

            La forja llega a 74 grados de yaw y ahi se queda tuerta en los
            extremos: uno de los dos ojos se va por detras del canto. Alli no
            molesta, porque los ojos son huecos del color del fondo y perder
            uno no deja una mancha. En la app son oscuros sobre la pagina, y
            un ojo desaparecido si se ve; por eso el chat pide topes mas
            cortos. Con el ojo a 15.46 grados del centro, 66 deja siempre los
            dos dentro conservando una cuarta parte del ancho del de fuera,
            que es justo lo que se lee como cabeza vuelta. */
        var alcance = o.alcance != null ? o.alcance : 26 + 26 * fijo;
        var topeY   = o.topeYaw   != null ? o.topeYaw   : 74;
        var topeP   = o.topePitch != null ? o.topePitch : 62;

        var gaze = {
            yaw:   clamp(base.yaw   + dv.yaw   + mov.yaw   + m.x * alcance, -topeY, topeY),
            pitch: clamp(base.pitch + dv.pitch + mov.pitch + aire
                         - m.y * (alcance * 0.72), -topeP, topeP) + mov.vuelta,
            roll:  base.roll  + dv.roll  + mov.roll  + m.x * 6
        };
        var E = ejes(gaze);

        // ---- cuerpo
        var forma = FORMAS[r.forma].r;

        var respira = lisa ? 1 : 1 + onda * 0.016;
        var esc = R * 0.94 * respira * (g.escala || 1);

        /*  Dos ondas de distinto periodo sobre el radio: sin ellas el
            contorno es un círculo perfecto y parece un botón. En modo ciclo
            los periodos dividen la duración, para que el bucle cierre. */
        var v1 = o.ciclo ? 0.5 : 0.55, v2 = o.ciclo ? 0.3333 : 0.37;
        var radios = new Array(N);
        for (var i = 0; i < N; i++) {
            var a = i / N * Math.PI * 2;
            var w = (quieto || lisa) ? 0
                  : (Math.sin(a * 3 + tt * Math.PI * 2 * v1 / 3) * 0.011
                   + Math.sin(a * 5 - tt * Math.PI * 2 * v2 / 3) * 0.007);
            radios[i] = forma[i] * (1 + w);
        }

        /*  El achatamiento se ancla en la BASE del cuerpo: encogiendo desde
            el centro, el blob no aterriza, se desinfla en el aire. */
        var def = { sx: mov.sx, sy: mov.sy, dx: mov.dx, dy: mov.dy + esc * (1 - mov.sy) };

        /*  Los rasgos y el accesorio viajan con el cuerpo. Ojo: solo se les
            mueve el punto de apoyo; el dibujo en si se queda como estaba.

            Recibe QUE deformacion aplicar porque el accesorio no usa la del
            cuerpo, sino la de un instante antes: en el salto, el blob sube y
            el sombrero tarda en subir. */
        function mueveCon(A, d) {
            A.x = A.x * d.sx + d.dx;
            A.y = A.y * d.sy + d.dy;
            return A;
        }
        function mueve(A) { return mueveCon(A, def); }

        /*  Los ojos son del color del FONDO: se leen como huecos recortados
            en el cuerpo, y de ahí viene el carácter. Si el cuerpo y el fondo
            se parecen demasiado, se cae a una sombra del propio cuerpo. */
        var colOjo = Math.abs(luz(r.color) - luz(r.fondo)) < 0.22 ? tono(r.color, 0.55) : r.fondo;

        /*  Y si el cuerpo casi no se distingue del fondo, se le pone un aro
            fino de su propio tono: sin el, un blob blanco sobre fondo claro
            es un cuadro vacio. */
        var borde = Math.abs(luz(r.color) - luz(r.fondo)) < 0.14 ? tono(r.color, 0.16) : null;

        var P = {
            fondo: r.fondo, color: r.color, colOjo: colOjo, acento: r.acento, borde: borde,
            /*  `soloCaja` es el atajo del encuadre: mide, no dibuja. Montar
                el contorno --64 curvas a texto-- es lo que cuesta de este
                metodo, y quien solo va a mirar donde caen las cosas no lo
                necesita. Sin esto, repintar los mandos se notaba. */
            cuerpo: o.soloCaja ? '' : contorno(radios, esc, def),
            clases: o.clases || null,
            tipo: g.puntos ? 'puntos' : (g.arco ? 'arco' : 'capsula'),
            ojos: [], puntos: [], acc: [], zzz: [], notas: [], taza: null, laptop: null, lado: null, util: null
        };

        /*  `cierra` lo manda la animacion (el sorbo de `cafe`) y va encima del
            parpadeo: tambien vale congelado, para que la miniatura lo enseñe. */
        var abierto = (quieto ? 1 : parpado(tt)) * (1 - 0.9 * mov.cierra);
        var split = g.split || SPLIT;
        var w = g.w || OJO_W, h = g.h || OJO_H;
        var A1 = mueve(ancla(E, -split, 0)), A2 = mueve(ancla(E, split, 0));

        if (P.tipo === 'puntos') {
            /*  Pensando: los ojos se van y quedan tres puntos que suben por
                turnos, como los de un chat escribiendo. */
            for (var k = 0; k < 3; k++) {
                var ci = o.ciclo ? 1.5 : 1.4;
                var fase = ((tt - k * 0.28) / ci % 1 + 1) % 1;

                /*  Un bombazo que sube y baja dentro de la primera mitad de
                    la vuelta. Iba multiplicado por dos sobre media onda, con
                    lo que llegaba a valer 2: el punto se hinchaba un 50% en
                    vez de un 25% y los tres se fundian en una mancha, y la
                    opacidad salia 1.45. Con la onda al doble de frecuencia
                    el bombazo entero cabe en la mitad y vale como mucho 1. */
                var sube = fase < 0.5 ? 0.5 - 0.5 * Math.cos(fase * Math.PI * 4) : 0;
                var Ap = mueve(ancla(E, (k - 1) * 17, 0));
                P.puntos.push({
                    cx: CX + Ap.x, cy: CY + Ap.y,
                    r: R * 0.165 * (1 + 0.25 * sube),
                    op: Ap.z <= 0.02 ? 0 : 0.55 + 0.45 * sube
                });
            }
        } else if (P.tipo === 'arco') {
            /*  Los dos arcos necesitan saber CUANTO SE VEN de lejos el uno
                del otro: ver arcoDe. */
            var sep = Math.hypot(A2.x - A1.x, A2.y - A1.y);
            P.ojos.push(arcoDe(A1, E, sep), arcoDe(A2, E, sep));
        } else {
            /*  La torcedura va EN ESPEJO: el mismo angulo con el signo
                cambiado en cada ojo. Con el mismo signo en los dos la cara no
                se enfada, se despeina. */
            var o2 = g.ojo2 || { w: w, h: h };
            var inc = g.incl || 0;
            var oe = mov.ojoEsc || 1;
            if (mov.ojos && FORMA_OJO[mov.ojos]) {
                P.ojos.push(formaOjo(A1, mov.ojos, oe, mov.giro),
                            formaOjo(A2, mov.ojos, oe, -mov.giro));
            } else {
                P.ojos.push(capsula(A1, w * oe, h * oe, abierto, inc),
                            capsula(A2, o2.w * oe, o2.h * oe, abierto * (1 - 0.95 * mov.guino), -inc));
            }
        }

        /*  ── EL ACCESORIO, EN PIEZAS ───────────────────────────

            Un accesorio es una LISTA de piezas, y cada pieza se ancla por su
            cuenta a un punto de la esfera. Casi todos traen una sola --un
            gorro es un dibujo y ya-- y para esos la lista es el accesorio
            mismo: sale exactamente lo que salia antes.

            Los cascos son la razon de que la lista exista. Unos auriculares
            no son un dibujo plano puesto por delante: son dos piezas en los
            COSTADOS de la cabeza y una diadema que pasa por encima. En una
            sola pieza los dos auriculares se ven siempre igual de grandes y
            siempre delante, que es justo lo que se lee como calcomania. En
            piezas, cada una mira su propia z: la de este lado se dibuja
            delante del cuerpo y grande, la del otro se dibuja DETRAS y solo
            asoma por el borde. Ver `cascos` en ACCESORIOS. */
        var acc = ACCESORIOS[r.accesorio];
        var partes = acc && (acc.partes || (acc.f ? [acc] : null));

        if (partes) {
            /*  ── LA CABEZA DEL ACCESORIO ─────────────────────────

                No es la del cuerpo. Va RETRASADA ACC_RETARDO segundos, y si
                el accesorio se apoya en la coronilla tambien va ATENUADA a
                ACC_SIGUE. Los de cara siguen la cara entera: ahi es donde
                les toca estar. El roll nunca se atenua.

                `sigue` es la salida de emergencia de esa atenuacion, y los
                cascos son quien la pide: lo que va agarrado a los COSTADOS
                de la cabeza tiene que girar con ella al cien por cien o se
                despega. Atenuar vale para lo que se POSA encima, no para lo
                que la abraza.

                Todo lo que cuelga de este gaze --el ancla, los ejes con los
                que se orienta y la deformacion del salto-- sale del mismo
                instante, asi que el accesorio se mueve como una pieza. */
            var ta   = tf - ACC_RETARDO;
            var dvA  = dvDe(quieto ? tt : tt - ACC_RETARDO);
            var movA = movDe(ta);

            var defA = { sx: movA.sx, sy: movA.sy, dx: movA.dx,
                         dy: movA.dy + esc * (1 - movA.sy) };

            /*  LA SOMBRA DE CONTACTO. Es el mismo dibujo del accesorio, en
                un tono oscuro del CUERPO --no del accesorio: lo que se ve
                sombreado es la piel del blob-- corrido hacia la luz opuesta
                y recortado contra la silueta. Sin ella un gorro es una
                calcomania; con ella se apoya en la cabeza.

                Solo la proyecta lo que esta DELANTE: lo que va detras no
                puede sombrear lo que lo tapa. */
            var som = tono(r.color, 0.45);

            /*  El color del accesorio es SUYO si lo declara; si trae `juego`,
                sale del cuerpo; si no, el acento de la receta. Ver colorAcc. */
            var cAcc = r.accCol || colorAcc(r.accesorio, r.color, r.acento);

            partes.forEach(function (pz) {
                var modo = pz.modo || null;
                var sigueAcc = pz.sigue != null ? pz.sigue
                             : (modo === 'cara' ? 1 : ACC_SIGUE);

                /*  Se atenua LO QUE SE MUEVE --la mirada, la deriva, la
                    animacion-- y NO la postura del gesto. Es la diferencia
                    entre un sombrero bien puesto en una cabeza de tres
                    cuartos y un sombrero a medio camino de ninguna parte: la
                    pose de reposo es el sitio donde el accesorio TIENE que
                    estar, y solo el recorrido es lo que se pasaba de largo. */
                var gazeA = {
                    yaw:   clamp(base.yaw + sigueAcc * (dvA.yaw + movA.yaw
                                 + m.x * alcance), -topeY, topeY),
                    pitch: clamp(base.pitch + aire + sigueAcc * (dvA.pitch + movA.pitch
                                 - m.y * (alcance * 0.72)), -topeP, topeP),
                    roll:  base.roll + dvA.roll + movA.roll + m.x * 6
                };
                var EA = ejes(gazeA);

                /*  El accesorio se ancla a la PIEL, no a la esfera: ver
                    ancla(). Los ojos no la reciben a proposito -- van casi de
                    frente y moverlos con el contorno les cambiaria el
                    caracter.

                    LA HOLGURA. Lo que se posa encima --un sombrero-- se ancla
                    por FUERA de la piel, y ese 1/0.94 es la holgura que la
                    forja ha tenido siempre; el `apoyo` es quien lo baja hasta
                    tocar. Lo que va PEGADO A LA CARA, no: se ancla sobre la
                    piel misma. Anclado por fuera, en cuanto la cara gira de
                    verdad --con la pose de tres cuartos, ya en reposo-- el
                    ancla se sale de la silueta y la pajarita aparece flotando
                    al lado del cuerpo. Los ojos, que son del color del fondo,
                    se salen igual pero no se ven; el accesorio si. */
                var holgura = modo === 'cara' ? 1 : 1 / 0.94;
                var piel = { r: radios, R: esc * holgura };

                /*  La diadema no es un dibujo pegado: es un arco de la propia
                    esfera. Ver arcoEsfera. */
                if (pz.traza) {
                    P.acc.push(arcoEsfera(pz.traza, EA, piel, defA, cAcc, som, o));
                    return;
                }

                /*  ── EL APOYO ───────────────────────────────────

                    `apoyo` es la y local del borde que toca la cabeza: el ala
                    del sombrero, la base de la corona. Con el, el ancla no se
                    coloca a un radio puesto a ojo --que es lo que dejaba el
                    ala DENTRO del cuerpo, leyendose como una calcomania--
                    sino exactamente donde ese borde queda sobre la piel,
                    hundido HUNDE unidades.

                    Se necesita la escala de la pieza para pasar `apoyo` de su
                    cuadrado local al lienzo, y esa escala depende de cuanto
                    se va hacia atras el ancla: de ahi el ancla de tanteo, que
                    solo se mira por su z. */
                var extra = 0;
                if (pz.apoyo != null) {
                    var z0 = ancla(EA, pz.lon, pz.lat, 1).z;
                    extra = pz.apoyo * (pz.esc || 1) * (0.86 + 0.14 * clamp(z0, -1, 1))
                          - HUNDE;
                }

                var A0 = ancla(EA, pz.lon, pz.lat, pz.dist, piel, extra);

                /*  `flota`: lo que va en el aire --el globo-- sube y baja solo,
                    esas unidades de lienzo, con una vuelta de 3 s (divide los
                    6 s del SVG animado). Quieto no flota: es la miniatura. */
                if (pz.flota && !quieto) A0.y += pz.flota * Math.sin(tt * Math.PI * 2 / 3);
                var delante = A0.z > -0.15;

                /*  ── `asoma`: LO DE DETRÁS NO SE HUNDE DEL TODO ─────────────

                    Al girar la cabeza, el auricular del otro lado se va detrás
                    y su ancla se mete hacia el centro: con la cara a 45 grados
                    la copa entera cae dentro de la silueta y el cuerpo, que es
                    opaco, la tapa. Unos cascos con una sola copa se leen como
                    un accesorio roto.

                    Con `asoma`, la pieza que va detrás se queda en el BORDE de
                    la silueta y sobresale por fuera. Justo en el cambio a
                    detrás (z -0.15) el ancla ya está en ese borde, así que no
                    salta; más allá solo se hunde un 12% según se aleja, que es
                    lo que le deja leerse como "del otro lado". */
                if (pz.asoma && !delante) {
                    var dA = Math.hypot(A0.x, A0.y);
                    if (dA > 0.5) {
                        var borde = esc * radioEn(radios, Math.atan2(A0.y, A0.x))
                                  * (1 - 0.12 * clamp((-A0.z - 0.15) / 0.85, 0, 1));
                        if (dA < borde) { A0.x *= borde / dA; A0.y *= borde / dA; }
                    }
                }

                var Aa = mueveCon(A0, defA);

                P.acc.push({
                    t: orienta(Aa, pz.esc || 1, EA, modo),
                    svg: o.soloCaja ? '' : pz.f(cAcc, tono(cAcc, 0.22), tono(cAcc, -0.3), null),
                    sombra: (!o.soloCaja && delante && o.sombra !== false)
                            ? pz.f(som, som, som, som) : null,
                    delante: delante,
                    caja: pz.caja
                });
            });
        }

        if (g.zzz && !quieto) P.zzz = dormido(tt, r, o.ciclo);

        /*  Las notas van con la ANIMACIÓN, no con el gesto: salen solo si se
            está moviendo --o congelada en su `fase`-- y al mismo reloj que
            el pulso, así cada nota nace en un golpe de cabeza. */
        if (anima && an.notas && !o.soloCaja) P.notas = notas(tf, r, an.per);

        /*  La taza, con la misma regla que las notas. */
        if (anima && an.taza && !o.soloCaja) P.taza = tazaDe(tf, an, mov);

        /*  Y la laptop de `programa`, igual. */
        if (anima && an.laptop && !o.soloCaja) P.laptop = laptopDe(tf, an, r);
        else if (conLaptop && !o.soloCaja) {
            P.laptop = laptopDe(tf, LAPTOP_ACC, r);
            P.laptop.tapa = r.accCol || colorAcc('laptop', r.color, r.acento);
        }

        /*  Y la de perfil del programador. */
        if (anima && an.lado && !o.soloCaja) P.lado = ladoDe(tf, an, r);

        /*  Y la utileria de los movimientos de trabajo. */
        if (anima && an.utileria && !o.soloCaja) P.util = an.utileria(((tf / an.per) % 1 + 1) % 1, r, mov);

        /*  Lo que ocupa este cuadro y cuanto hay que encogerlo para que
            quepa. Ver `extremos` y `encuadre`. */
        P.caja = extremos(radios, esc, def, P.acc);

        /*  `encaje` lleva el zoom Y el desplazamiento; `zoom` es el numero
            suelto de siempre, que es lo que consulta el muñeco de la app para
            compensar cuanto encogio el motor (ver nav-coffeeia.js). Se dejan
            los dos para no obligar a nadie a cambiar por un encuadre nuevo. */
        P.encaje = o.sinZoom ? { z: 1, dx: 0, dy: 0 } : encuadre(r, o);
        P.zoom   = P.encaje.z;

        return P;
    }

    /* ==================================================================
       EL ENCUADRE

       El lienzo estaba desbordado y no por poco: medido, el sombrero de
       mago perdia 77 unidades de copa EN REPOSO, el bombin 16 y la taza 25.
       No es un fallo de los accesorios --estan bien dibujados-- sino de
       encuadre: el cuerpo ocupa 188 de las 320 unidades del lienzo, y lo que
       se pone encima de la cabeza no cabe en las 66 que sobran.

       La forja tenia dos salidas malas y una buena. Encoger el cuerpo con
       `esc` NO vale: el tamaño del accesorio no cuelga de `esc`, asi que la
       cabeza menguaria y el sombrero seguiria igual de grande. Recortar los
       accesorios tampoco: un gorro de mago es alto, ese es el chiste.

       La buena es medir. Se calcula lo que ocupa el dibujo ENTERO --cuerpo
       y accesorio, en su sitio y con su giro-- y se encoge el grupo completo
       lo justo para que quepa, que es lo que hace `aire` en el montaje. Un
       avatar con gorro de mago sale mas pequeño que uno sin nada, y esta
       bien que asi sea: es exactamente lo que haria cualquiera dibujandolo a
       mano en un cuadrado.

       Se mide, no se estima, y por eso hace falta la `caja` local de cada
       accesorio: sus cuatro esquinas pasadas por la misma matriz que lo
       coloca dan su hueco real en el lienzo.
       ================================================================== */

    /*  El margen que se le deja al dibujo contra el borde del lienzo. */
    var MARGEN = 4;

    /*  La caja del cuadro. Del cuerpo bastan los 64 puntos de la silueta:
        los tiradores de las Bezier se salen de ellos menos de una unidad, y
        para eso esta MARGEN. */
    function extremos(radios, esc, def, accs) {
        var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, i;

        function mete(x, y) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
        }

        for (i = 0; i < N; i++) {
            var a = i / N * Math.PI * 2;
            mete(CX + def.dx + Math.cos(a) * radios[i] * esc * def.sx,
                 CY + def.dy + Math.sin(a) * radios[i] * esc * def.sy);
        }

        for (i = 0; i < accs.length; i++) {
            var A = accs[i];

            /*  El arco de esfera ya viene medido en el lienzo --no tiene
                cuadrado local ni matriz que lo coloque-- asi que entra por
                sus dos esquinas y ya esta. */
            if (A.cajaXY) {
                mete(A.cajaXY[0], A.cajaXY[1]);
                mete(A.cajaXY[2], A.cajaXY[3]);
                continue;
            }
            if (!A.caja) continue;

            var t = A.t, c = A.caja;
            [[c[0], c[1]], [c[2], c[1]], [c[2], c[3]], [c[0], c[3]]].forEach(function (p) {
                mete(t.tx + (p[0] * t.ax + p[1] * t.bx) * t.esc,
                     t.ty + (p[0] * t.ay + p[1] * t.by) * t.esc);
            });
        }

        return [x0, y0, x1, y1];
    }

    /*  El encuadre de una receta. Es constante mientras la receta no cambie
        --si variara cuadro a cuadro, el avatar respiraria de tamaño-- asi
        que se toma el PEOR cuadro de todos los que puede llegar a haber y se
        guarda en cache: en pantalla esto acaba siendo una consulta a un
        objeto sesenta veces por segundo.

        Los cuadros que se prueban son los que de verdad ocurren: la vuelta
        entera de la animacion, y las cuatro esquinas de la mirada con el
        cursor --con el blob mirando al borde de la pantalla el accesorio se
        va tan lejos como se va nunca--. La deriva de reposo y la respiracion
        mueven mucho menos que eso y caben en MARGEN. */
    var ENCUADRES = {};

    /*  La misma receta con OTRO gesto. Solo la usa el encuadre, para medir el
        catalogo entero sin tocar la receta que le entra. */
    function clonaReceta(r, gesto) {
        var c = {}, kk;
        for (kk in r) c[kk] = r[kk];
        c.gesto = gesto;
        return c;
    }

    function encuadre(r, o) {
        var an = ANIMS[r.anim];
        var mueve = an && an.f;

        /*  UN GESTO RESUELTO NO TIENE NOMBRE, y por tanto no tiene llave de
            cache: es una pose intermedia de una transicion, y hay infinitas.
            Para esas se mide el peor caso de TODO el catalogo de gestos y se
            guarda bajo '*'.

            No es solo por la cache. El zoom tiene que ser el MISMO durante
            toda la transicion: si cada pose intermedia calculara el suyo, el
            muñeco cambiaria de tamaño mientras pasa de calma a curioso, que
            es justo lo que el encuadre existe para evitar. Con el peor caso
            comun, el zoom no se mueve en toda la vuelta del guion. */
        var suelto = typeof r.gesto === 'object';
        var gestos = suelto ? Object.keys(GESTOS) : [r.gesto];

        var llave = r.forma + '|' + r.accesorio + '|' + (suelto ? '*' : r.gesto)
                  + '|' + (mueve ? r.anim : '-')
                  + '|' + (o && o.margen != null ? o.margen : MARGEN)
                  + '|' + (o && o.centrado ? 'c' : '-');
        if (ENCUADRES[llave] != null) return ENCUADRES[llave];

        var miradas = [
            { m: null,             fijo: 0 },
            { m: { x:  1, y:  0 }, fijo: 1 },
            { m: { x: -1, y:  0 }, fijo: 1 },
            { m: { x:  0, y:  1 }, fijo: 1 },
            { m: { x:  0, y: -1 }, fijo: 1 }
        ];

        var pasos = mueve ? 20 : 1, lejos = 0, i, j, k;
        var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;

        for (k = 0; k < gestos.length; k++) {
            var rg = suelto ? clonaReceta(r, gestos[k]) : r;

            for (i = 0; i < pasos; i++) {
                for (j = 0; j < miradas.length; j++) {
                    var P = piezas(rg, 0.62, miradas[j].m, {
                        quieto: true, sinZoom: true, soloCaja: true,
                        fijo: miradas[j].fijo,
                        fase: mueve ? i / pasos * an.per : null
                    });
                    var c = P.caja;
                    var d = Math.max(CX - c[0], CY - c[1], c[2] - CX, c[3] - CY);
                    if (d > lejos) lejos = d;

                    /*  La caja del peor caso, para el encuadre centrado. Se
                        acumula la union de todos los cuadros y no la de uno:
                        el desplazamiento tiene que ser tan constante como el
                        zoom, o el muñeco se pasearia por el lienzo mientras
                        salta o mientras te sigue con la mirada. */
                    if (c[0] < x0) x0 = c[0];
                    if (c[1] < y0) y0 = c[1];
                    if (c[2] > x1) x1 = c[2];
                    if (c[3] > y1) y1 = c[3];
                }
            }
        }

        /*  `margen` es cuanto aire se deja contra el borde, y quien pinta en
            OTRO lienzo tiene que decir el suyo.

            El encaje de la app lleva el CUERPO de 94 a 129 sobre un lienzo de
            400: calibra el cuerpo, no el lienzo. Eso le deja 180 unidades de
            aire hacia arriba, que en unidades de ESTE lienzo son 180/1.372 =
            131, no las 156 que protege el margen de la forja. Con el margen
            de casa, la punta del sombrero de mago cabia aqui y se cortaba
            alli. */
        var mrg = o && o.margen != null ? o.margen : MARGEN;
        var e;

        if (o && o.centrado) {
            /*  ENCUADRE CENTRADO. Se encaja la CAJA DEL DIBUJO en el lienzo en
                vez de escalar contra el centro, y eso cambia el resultado
                entero: el cuerpo ocupa 188 de las 320 unidades y deja 66 de
                aire arriba y 66 abajo, pero el sombrero solo crece hacia
                ARRIBA. Escalando contra el centro, las 66 de abajo no se usan
                nunca y hay que encoger el muñeco para meter la copa; corriendo
                el dibujo hacia abajo primero, casi todos los accesorios entran
                sin encoger nada.

                Medido: bombin, gorra, boina, corona, bufanda, taza y parche
                pasan de encoger al 91-96% a no encoger --100%--, y el gorro de
                mago sube del 67% al 95%. El precio es que el cuerpo se apoya
                mas abajo en el cuadro cuando lleva sombrero, que es lo que
                haria cualquiera dibujandolo a mano: el personaje no flota en
                el centro, se planta y el sombrero ocupa el aire de arriba. */
            var z = Math.min(1, (V - mrg * 2) / Math.max(x1 - x0, y1 - y0, 1));
            e = {
                z:  z,
                dx: CX - (x0 + x1) / 2 * z,
                dy: CY - (y0 + y1) / 2 * z
            };
        } else {
            /*  El de siempre: escala contra el centro del lienzo y no mueve
                nada. Es el que usa el encaje de la app --que calibra el CUERPO
                y no el lienzo, y da por hecho que el cuerpo esta centrado--,
                asi que sigue siendo el de por defecto. */
            var zc = Math.min(1, (CX - mrg) / Math.max(lejos, 1));
            e = { z: zc, dx: CX * (1 - zc), dy: CY * (1 - zc) };
        }

        ENCUADRES[llave] = e;
        return e;
    }

    /*  Un ojo cerrado no se encoge: se acorta el segmento y adelgaza el
        trazo. Por eso la cápsula se guarda como los dos extremos más el
        grosor, que es justo lo que SMIL sabe interpolar. */
    function capsula(A, w, h, abierto, incl) {
        if (A.z <= 0.02) return { d: 'M0 0L0 0', w: 0.01, op: 0 };

        var hw = Math.max(w * R, 0.01) / 2;
        var hh = Math.max(h * R * abierto, 0.01) / 2;
        var rr = Math.min(hw, hh);
        var vert = hh > hw;
        var len = vert ? hh - rr : hw - rr;

        /*  LA TORCEDURA. Se gira el MARCO LOCAL del ancla --sus dos ejes ya
            proyectados-- y no el trazo en pantalla: así el sesgo viaja con
            la cabeza, rueda con el roll y se acorta solo cuando el ojo se va
            de canto. Girado en pantalla, un ojo torcido en una cara de tres
            cuartos se despega de la esfera y se nota. */
        var c = 1, s = 0;
        if (incl) { c = Math.cos(rad(incl)); s = Math.sin(rad(incl)); }
        var ex = vert ? A.bx * c + A.ax * s : A.ax * c - A.bx * s;
        var ey = vert ? A.by * c + A.ay * s : A.ay * c - A.by * s;

        return {
            d: 'M' + (CX + A.x - ex * len).toFixed(2) + ' ' + (CY + A.y - ey * len).toFixed(2)
             + 'L' + (CX + A.x + ex * len).toFixed(2) + ' ' + (CY + A.y + ey * len).toFixed(2),
            w: rr * 2,
            op: 1
        };
    }

    /*  ── LOS OJOS CON FORMA (29/09/2026) ─────────────────────────────

        Corazones de cariño, estrellas de orgullo, espirales de mareo y los
        arcos de contento, para las animaciones de PROCESO. Cada forma es un
        trazo en el marco local del ojo --sus dos ejes ya proyectados, los
        mismos de la capsula-- y como ese paso es afin, los puntos de control
        de las curvas se transforman igual que los extremos: la forma se
        tuerce con la cabeza sin perder la curva. Sale en coordenadas del
        lienzo y sin matriz, asi que el SVG animado la exporta como a una
        capsula. */
    var FORMA_OJO = {
        corazon: function () {
            return [['M', 0, 9], ['C', -3, 6, -12, 0, -12, -5], ['C', -12, -10, -8, -12.5, -5, -11.5],
                    ['C', -2.5, -10.5, -1, -8.5, 0, -6.5], ['C', 1, -8.5, 2.5, -10.5, 5, -11.5],
                    ['C', 8, -12.5, 12, -10, 12, -5], ['C', 12, 0, 3, 6, 0, 9], ['Z']];
        },
        estrella: function () {
            var v = [];
            for (var i = 0; i < 10; i++) {
                var a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 5 : 12;
                v.push([i ? 'L' : 'M', r * Math.cos(a), r * Math.sin(a)]);
            }
            v.push(['Z']);
            return v;
        },
        espiral: function (giro) {
            var v = [], g0 = rad(giro || 0);
            for (var i = 0; i <= 28; i++) {
                var t = i / 28, a = g0 + t * Math.PI * 5, r = 1.5 + 10.5 * t;
                v.push([i ? 'L' : 'M', r * Math.cos(a), r * Math.sin(a)]);
            }
            return v;
        },
        feliz: function () { return [['M', -10, -4], ['Q', 0, 9, 10, -4]]; }
    };
    function formaOjo(A, tipo, esc, giro) {
        if (A.z <= 0.02) return { d: 'M0 0L0 0', w: 0.01, op: 0 };
        var k = (tipo === 'feliz' || tipo === 'espiral' ? 1.15 : 1.3) * (esc || 1);
        function pt(lx, ly) {
            lx *= k; ly *= k;
            return (CX + A.x + A.ax * lx + A.bx * ly).toFixed(2) + ' ' + (CY + A.y + A.ay * lx + A.by * ly).toFixed(2);
        }
        var d = FORMA_OJO[tipo](giro).map(function (c) {
            var s = c[0];
            for (var i = 1; i < c.length; i += 2) s += (i > 1 ? ' ' : '') + pt(c[i], c[i + 1]);
            return s;
        }).join('');
        return { d: d, w: tipo === 'espiral' ? 3.2 : 5.5, op: 1 };
    }

    /*  El ojo feliz es un ARCO, y un arco tiene un ancho que el de la
        capsula no tiene: no puede ser fijo.

        De frente los dos ojos se ven a unas 53 unidades el uno del otro y el
        arco de 38 cabe justo. Pero la cara descansa de tres cuartos, y ahi
        el escorzo los junta hasta unas 30: dos arcos de 38 a 30 de distancia
        se solapan y lo que se lee no son dos ojos contentos sino un garabato
        cruzando la cara.

        Asi que el arco se mide en funcion de lo separados que se VEAN, no de
        lo separados que ESTEN. El grosor no se toca --adelgazar el trazo lo
        convertiria en un pelo-- y por eso se escala el dibujo y no la
        matriz. */
    function arcoDe(A, E, sep) {
        if (A.z <= 0.02) return { d: 'M0 0L0 0', w: 0.01, op: 0, t: null };

        var k = clamp((sep || 53) / 53, 0.58, 1.15);
        function n(v) { return (v * k).toFixed(1); }

        return {
            t: orienta(A, 1, E, 'cara'),
            d: 'M' + n(-19) + ' ' + n(-6) + 'Q0 ' + n(16) + ' ' + n(19) + ' ' + n(-6),
            w: 13, op: 1
        };
    }

    /*  Un trazo suelto, ya en coordenadas del lienzo. Lo usa el arco de
        esfera, que no tiene cuadrado local ni matriz que lo coloque. */
    function trazo(d, w, c) {
        return '<path d="' + d + '" fill="none" stroke="' + c + '" stroke-width="' + w.toFixed(2)
             + '" stroke-linecap="round" stroke-linejoin="round"/>';
    }

    /*  ── LA DIADEMA: UN ARCO DE LA ESFERA ────────────────────────

        Una pieza normal es un dibujo plano mas una matriz que lo pega en un
        punto. Eso vale para lo que es compacto --un lazo, unas gafas, un
        auricular-- y no vale para una diadema, que RECORRE la cabeza de una
        oreja a la otra: pegada como dibujo, sus puntas se quedan donde
        estaban mientras los auriculares se van con el giro, y lo que se ve es
        una banda suelta flotando al lado de dos cosas.

        Asi que no se dibuja: se muestrea. Se recorre el meridiano que va de
        la oreja a la coronilla --las mismas coordenadas lon/lat que usa
        cualquier ancla, pegadas a la piel-- y se unen los puntos con un
        trazo. La banda se acorta sola cuando la cabeza gira, se abomba con la
        forma del cuerpo y sus puntas caen exactamente donde estan los
        auriculares, porque salen de la misma esfera.

        Nueve puntos bastan: el error de cortar 90 grados en ocho rectas es
        medio punto de lienzo, menos de lo que abulta el propio trazo.

        El grosor se atenua con la profundidad igual que la escala de las
        demas piezas: la mitad que se va hacia atras adelgaza.

        ── CON `cima`: MEDIA DIADEMA SIN PICO ─────────────────────────────

        Interpolar lon y lat en recta hace que las dos mitades lleguen a la
        coronilla con pendientes opuestas y se junten en punta. Con `cima` la
        traza no va en recta: recorre el CIRCULO de la esfera que pasa por las
        dos orejas (lon ±90, lat0) y por lo alto (lon 0, lat cima). Las dos
        mitades son trozos del mismo circulo, asi que llegan arriba con la
        misma tangente y se funden sin costura. Solo vale con la oreja en ±90:
        de lon0 se usa el signo. */
    function puntoCima(tz, u) {
        var fi = rad(tz.lat0), ka = rad(tz.cima);
        var dy = Math.sin(ka) - Math.sin(fi), dz = Math.cos(ka), L = Math.hypot(dy, dz);
        var c = (L * L - Math.cos(fi) * Math.cos(fi)) / (2 * L), rho = L - c;
        var t = lerp(Math.atan2(-c, Math.cos(fi)), Math.PI / 2, u);
        var X = rho * Math.cos(t) * (tz.lon0 < 0 ? -1 : 1), Y = c + rho * Math.sin(t);
        return {
            lon: Math.atan2(X, Y * dz / L) * 180 / Math.PI,
            lat: Math.asin(clamp(Math.sin(fi) + Y * dy / L, -1, 1)) * 180 / Math.PI
        };
    }

    function arcoEsfera(tz, EA, piel, defA, col, som, o) {
        var d = '', x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, zm = 0, zb = 1e9, j;
        /*  Con `cima` el grosor se mide EN LO ALTO, el punto que comparten
            las dos mitades: medido a media traza, al girar la cabeza cada
            mitad saldria de un grueso y la junta haria escalon. */
        var med = tz.cima != null ? tz.n : Math.round(tz.n / 2);

        for (j = 0; j <= tz.n; j++) {
            var u = j / tz.n;
            var pc = tz.cima != null ? puntoCima(tz, u)
                   : { lon: lerp(tz.lon0, tz.lon1, u), lat: lerp(tz.lat0, tz.lat1, u) };
            var A = ancla(EA, pc.lon, pc.lat, tz.dist, piel, 0);
            var x = CX + A.x * defA.sx + defA.dx;
            var y = CY + A.y * defA.sy + defA.dy;
            d += (j ? 'L' : 'M') + x.toFixed(2) + ' ' + y.toFixed(2);
            if (j === med) zm = A.z;
            if (j === 0) zb = A.z;
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
        }

        /*  Delante o detras lo decide la PUNTA del arco --el extremo de la
            oreja-- y no su punto medio. Un trazo es una sola figura y se
            pinta entera de un lado o del otro; el punto medio de la diadema
            cae en la coronilla, que con la cabeza echada atras esta siempre
            algo hundida, asi que mirandolo a el las dos mitades se irian
            detras del cuerpo y la banda se quedaria en un filo oscuro
            asomando por el borde. Mirando la punta, la mitad de aca cruza la
            cabeza por encima --que es donde se apoya una diadema-- y la de
            alla se va detras y solo asoma lo que sobresale. */
        var delante = zb > -0.15;
        var w = tz.w * (0.86 + 0.14 * clamp(zm, -1, 1));
        var h = w / 2;

        return {
            d: d, w: w, col: col, som: som, delante: delante,
            svg: o.soloCaja ? '' : trazo(d, w, col),
            sombra: (!o.soloCaja && delante && o.sombra !== false) ? trazo(d, w, som) : null,
            cajaXY: [x0 - h, y0 - h, x1 + h, y1 + h]
        };
    }

    /*  ── LAS NOTAS DE `musica` ─────────────────────────────────────────

        Dibujadas y no escritas: un ♪ en <text> depende de la fuente de cada
        equipo, y en alguna sale un cuadro vacío. Cada glifo tiene su centro
        cerca de (5, -10); quien lo pinta lo corre ahí para que gire y escale
        sobre sí mismo. */
    var NOTA = {
        corchea: '<ellipse cx="0" cy="0" rx="6.4" ry="4.8" transform="rotate(-22)"/>'
               + '<path d="M4.4 -1.5V-24H7.2C7.6 -18.5 11.5 -16.8 13.8 -13.2C16 -9.6 15.2 -5.6 12.8 -3.2'
               + 'C13.8 -7.8 11.4 -11.2 7.2 -12.8V-1.5Z"/>',
        doble:   '<ellipse cx="0" cy="0" rx="6.4" ry="4.8" transform="rotate(-22)"/>'
               + '<ellipse cx="17" cy="-4" rx="6.4" ry="4.8" transform="rotate(-22 17 -4)"/>'
               + '<path d="M4.4 -1.5V-22H7.2V-1.5ZM21.4 -5.5V-26H24.2V-5.5ZM4.4 -19L24.2 -23.5V-29L4.4 -24.5Z"/>'
    };

    /*  Cuatro notas, una por golpe de la vuelta, alternando lado. Cada una
        vive MEDIA vuelta --sube, se abre hacia fuera y se apaga-- así que
        nunca hay más de dos a la vez.

        Nacen JUSTO en los golpes, que son también `hitos` de la animación: en
        el SVG exportado hay muestra en el instante en que una nota salta de
        arriba a abajo, y ahí su opacidad es cero. Sin esa muestra, SMIL la
        interpolaría cruzando la cara a medio encender. */
    function notas(t, r, per) {
        var v = [], n = 4;
        var col = luz(r.fondo) < 0.35 ? tono(r.color, -0.35) : tono(r.color, 0.55);
        for (var i = 0; i < n; i++) {
            var f = ((t - i * per / n) / per % 1 + 1) % 1;
            if (f > 1 - 1e-6) f = 0;
            var k = Math.min(f * 2, 1);
            var lado = i % 2 ? -1 : 1;
            v.push({
                x: CX + lado * (100 + 20 * k),
                y: CY - 54 - 62 * k,
                rot: lado * (6 + 14 * k),
                s: i % 2 ? 1.5 : 1.7,
                op: f >= 0.5 ? 0 : (k < 0.15 ? k / 0.15 : (k > 0.6 ? (1 - k) / 0.4 : 1)),
                tipo: i === 1 ? 'doble' : 'corchea',
                col: col
            });
        }
        return v;
    }

    /*  ── EL GUION DE `cafe` ───────────────────────────────────────────────

        Tres curvas de 0 a 1 sobre la vuelta: `sube` es la taza camino de la
        cara, `bebe` el sorbo y `ahh` el gusto de despues. Las leen el cuerpo
        (ANIMS.cafe) y la taza (tazaDe), asi que no pueden desfasarse.

        Con la vuelta de 6 s (ver ANIMS.cafe), en segundos:

          0.00-0.18  reposo, la taza abajo humeando        1.1 s
          0.18-0.36  sube la taza                          1.1 s
          0.38-0.60  bebe: se inclina y se cierran los ojos 1.3 s
          0.60-0.74  baja la taza                          0.8 s
          0.76-0.90  ¡ahh!                                 0.8 s
          0.90-1.00  reposo                                0.6 s */
    function sorbo(u) {
        var sube = u < 0.18 ? 0
                 : u < 0.36 ? suave((u - 0.18) / 0.18)
                 : u < 0.60 ? 1
                 : u < 0.74 ? 1 - suave((u - 0.60) / 0.14) : 0;
        var bebe = u < 0.38 ? 0
                 : u < 0.45 ? suave((u - 0.38) / 0.07)
                 : u < 0.55 ? 1
                 : u < 0.60 ? 1 - suave((u - 0.55) / 0.05) : 0;
        var ahh  = (u >= 0.76 && u < 0.90) ? Math.sin((u - 0.76) / 0.14 * Math.PI) : 0;
        return { sube: sube, bebe: bebe, ahh: ahh };
    }

    /*  El cuerpo de las animaciones de cafe. `cafe` y `cafe_llevar` comparten
        este movimiento entero; lo unico que cambia entre ellas es la taza. */
    function sorbeCuerpo(u) {
        var k = sorbo(u);
        var tiembla = Math.sin((u - 0.76) / 0.14 * Math.PI * 3);
        return {
            yaw:    7 * k.sube,
            pitch:  -6 * k.sube * (1 - k.bebe) + 12 * k.bebe,
            roll:   -3 * k.bebe + 3 * k.ahh * tiembla,
            dy:     -4 * k.bebe + 2 * k.ahh,
            sx:     1 + 0.035 * k.ahh,
            sy:     1 - 0.04 * k.ahh,
            cierra: k.bebe
        };
    }

    /*  LAS TAZAS. Cada una con su centro en el origen, para que gire sobre si
        misma al inclinarse, y el asa --si la tiene-- a la derecha, lejos de la
        cara y pintada antes que el cuerpo para que este le tape las puntas.
        `boca` es la y donde nace el vapor: en el vaso sale por la tapa.

        Colores propios y no los de la receta, por lo mismo que `col` en
        ACCESORIOS: una taza de cafe es cafe. Son dos de cinco propuestas
        (15/09/2026): el tarro de siempre y el vaso para llevar.

        El vapor es un gris medio que se lee igual sobre el tema claro y el
        oscuro de la app. */
    var TAZAS = {
        tarro: { boca: -22, svg:
              '<path d="M22 -8C35 -8 41 -2 41 5C41 12 35 17 24 17" fill="none" stroke="#8B5E3C" stroke-width="7" stroke-linecap="round"/>'
            + '<path d="M-22 -18H22V8C22 20 13 26 0 26C-13 26 -22 20 -22 8Z" fill="#8B5E3C"/>'
            + '<path d="M-22 -18H22V-11H-22Z" fill="#6c492f"/>'
            + '<path d="M-14 -4V12" stroke="#ae8e77" stroke-width="5" stroke-linecap="round" opacity=".6"/>' },
        vaso: { boca: -30, svg:
              '<path d="M-19 -14H19L15 26H-15Z" fill="#F4EFE8" stroke="#5B4636" stroke-width="2.5" stroke-linejoin="round"/>'
            + '<path d="M-17.7 -1H17.7L16.2 14H-16.2Z" fill="#C69C6D"/>'
            + '<ellipse cx="0" cy="6.5" rx="4" ry="5.5" fill="#6B4A33"/>'
            + '<path d="M0 2.5C-1.5 5 1.5 8 0 10.5" fill="none" stroke="#C69C6D" stroke-width="1.4"/>'
            + '<path d="M-22 -14H22L20 -21H-20Z" fill="#3A2F2A"/>'
            + '<rect x="-15" y="-27" width="30" height="7" rx="3.5" fill="#3A2F2A"/>' }
    };
    var VAPOR     = 'M0 0C-6 -7 6 -13 0 -20';
    var VAPOR_COL = '#8F8984';

    /*  Donde va la taza en este instante. Sigue el desplazamiento del cuerpo
        (dx, dy) pero no su giro: la sostiene una mano que no se ve.

        NO ENTRA EN EL ENCUADRE (`extremos`) y no le hace falta: en su punto
        mas lejano --abajo a la derecha, con el asa-- queda dentro del margen
        de 30 que usa la app. Si algun dia se agranda, hay que medirla alli.

        Dos hilos de vapor, cada uno sube y se apaga en media vuelta. Nacen y
        mueren con opacidad cero, asi que el salto de arriba a abajo al
        reiniciar no se ve ni en el SVG animado. Se apagan mientras la taza
        sube: el vapor es del reposo.

        AL BEBER VA A LA DERECHA DE LA BOCA (x +26), no delante del centro:
        con el borde de la taza tocando la cara por ese lado se lee que bebe;
        centrada tapaba la cara y se leia como que la taza flotaba delante. */
    function tazaDe(t, an, mov) {
        var u = ((t / an.per) % 1 + 1) % 1;
        var k = sorbo(u);
        var humo = 1 - k.sube;
        var boca = TAZAS[an.taza].boca;
        return {
            tipo: an.taza,
            x: CX + mov.dx + lerp(72, 26, k.sube),
            y: CY + mov.dy + lerp(70, 50, k.sube) - 6 * k.bebe,
            rot: -38 * k.bebe,
            s: 1.25,
            vapor: [0, 1].map(function (i) {
                var f = ((u * 4 + i * 0.5) % 1 + 1) % 1;
                return { x: i ? 7 : -7, y: boca - 16 * f, op: 0.95 * humo * Math.sin(f * Math.PI) };
            })
        };
    }

    /*  ── EL GUION DE `programa` ──────────────────────────────────────────

        Con la vuelta de 6 s (ver ANIMS.programa), en segundos:

          0.00-0.06  reposo                                  0.4 s
          0.06-0.18  saca la laptop: sube desde abajo        0.7 s
          0.18-0.26  abre la tapa                            0.5 s
          0.29-0.52  teclea, seis golpes                     1.4 s
          0.52-0.60  levanta la cabeza a pensar              0.5 s
          0.60-0.84  teclea otra vez                         1.4 s
          0.86-0.91  cierra la tapa                          0.3 s
          0.92-0.98  la guarda                               0.4 s

        `golpe` es cada tecla: un seno al cuadrado, que vale cero al empezar
        y al acabar cada rafaga, asi que el cuerpo entra y sale del tecleo
        sin tirones. */
    function tecleo(u) {
        var saca = u < 0.06 ? 0 : u < 0.18 ? suave((u - 0.06) / 0.12)
                 : u < 0.92 ? 1 : u < 0.98 ? 1 - suave((u - 0.92) / 0.06) : 0;
        var abre = u < 0.18 ? 0 : u < 0.26 ? suave((u - 0.18) / 0.08)
                 : u < 0.86 ? 1 : u < 0.91 ? 1 - suave((u - 0.86) / 0.05) : 0;
        var golpe = 0, lado = 0;
        RAFAGAS.forEach(function (ra) {
            if (u >= ra[0] && u < ra[1]) {
                var x = ra[2] * (u - ra[0]) / (ra[1] - ra[0]);
                var sn = Math.sin(Math.PI * x);
                golpe = sn * sn;
                lado = Math.floor(x) % 2 ? 1 : -1;
            }
        });
        var piensa = (u >= 0.52 && u < 0.60) ? Math.sin((u - 0.52) / 0.08 * Math.PI) : 0;
        return { saca: saca, abre: abre, golpe: golpe, lado: lado, piensa: piensa };
    }

    /*  El guion del Modo programador: la laptop fuera y abierta siempre. Sin
        tecla ni pausa en u 0 = 1, asi que la vuelta se repite sin salto. */
    function tecleoFijo(u) {
        var golpe = 0, lado = 0;
        RAFAGAS_FIJO.forEach(function (ra) {
            if (u >= ra[0] && u < ra[1]) {
                var x = ra[2] * (u - ra[0]) / (ra[1] - ra[0]);
                var sn = Math.sin(Math.PI * x);
                golpe = sn * sn;
                lado = Math.floor(x) % 2 ? 1 : -1;
            }
        });
        var piensa = (u >= 0.44 && u < 0.54) ? Math.sin((u - 0.44) / 0.10 * Math.PI) : 0;
        return { saca: 1, abre: 1, golpe: golpe, lado: lado, piensa: piensa };
    }
    function programadorCuerpo(u) { return cuerpoTecleo(tecleoFijo(u)); }

    /*  El cuerpo: baja la mirada a la pantalla en cuanto la saca, cabecea un
        poco en cada tecla --el aplastamiento es lo que lo hace tecla y no
        asentir-- y en la pausa levanta la cabeza y la ladea, pensando. */
    function cuerpoTecleo(k) {
        var mira = Math.max(k.abre, 0.5 * k.saca);
        return {
            pitch: -8 * mira + 7 * k.piensa - 1.8 * k.golpe,
            yaw:   -7 * k.piensa,
            roll:   2.5 * k.piensa,
            dy:     3 * mira + 1.6 * k.golpe,
            sx:     1 + 0.014 * k.golpe,
            sy:     1 - 0.018 * k.golpe
        };
    }

    /*  LA LAPTOP, vista por detras. Medidas desde el centro del cuerpo: la
        bisagra en y 95-104 y la tapa sube desde y 98 hasta 60 de alto, asi
        que abierta llega a y 38: los ojos, con la cabeza baja, asoman por
        encima del borde, que es justo como se ve a alguien mirando su
        pantalla. Colores propios, como las tazas: una laptop es
        de aluminio sea cual sea el muñeco. */
    var LAPTOP = { tapa: '#CDD3DB', borde: '#A3ADBA', bisagra: '#939DAB', logo: '#F7F9FB' };
    var BISAGRA = '<rect x="-71" y="95" width="142" height="9" rx="4.5" fill="' + LAPTOP.bisagra + '"/>';
    var TAPA_W = 132, TAPA_H = 60;

    /*  LAS TECLAS. Por detras de la tapa las manos no se ven, asi que cada
        golpe se dibuja como se dibuja en una caricatura: tres rayitas que
        saltan por encima del borde, una vez a cada lado. Van en dos grupos
        fijos --izquierda y derecha-- con su propia opacidad, y no en uno que
        se mueva de lado: en el SVG animado ese salto se interpolaria y se
        veria a las rayas cruzar la tapa. */
    var TECLA = 'M-10 -4L-16 -14M0 -5V-17M10 -4L16 -14';
    var LOGO_TAZA = '<path d="M-9 -4H8V3C8 8 4.5 11 -0.5 11C-5.5 11 -9 8 -9 3Z" stroke="none"/>'
                  + '<path d="M8 -1C12.5 -1 14.5 1.5 14.5 4C14.5 6.5 12.5 8.5 9 8.5" fill="none" stroke-width="3" stroke-linecap="round"/>'
                  + '<path d="M-4 -8C-6 -10.5 -2 -12.5 -4 -15M2 -8C0 -10.5 4 -12.5 2 -15" fill="none" stroke-width="2.2" stroke-linecap="round"/>';

    /*  Los simbolos que salen de la pantalla. Dibujados y no escritos, por lo
        mismo que las notas: un <text> depende de la fuente de cada equipo. */
    var GLIFO = {
        etiqueta: 'M-7 -8L-14 0L-7 8M7 -8L14 0L7 8M3 -11L-3 11',
        llaves:   'M-5 -11C-9 -11 -9 -8 -9 -5V-2C-9 0 -11 0 -12 0C-11 0 -9 0 -9 2V5C-9 8 -9 11 -5 11'
                + 'M5 -11C9 -11 9 -8 9 -5V-2C9 0 11 0 12 0C11 0 9 0 9 2V5C9 8 9 11 5 11'
    };

    /*  Donde va la laptop en este instante y como esta. NO sigue el cabeceo
        del cuerpo: esta sobre la mesa, el que se mueve es el. Fuera de escena
        baja 170 y se apaga, asi que no hace falta quitarla del SVG animado. */
    /*  La del accesorio Laptop: el mismo guion del Modo programador. */
    var LAPTOP_ACC = { per: 6, guion: tecleoFijo, glifos: GLIFOS_FIJO };

    function laptopDe(t, an, r) {
        var u = ((t / an.per) % 1 + 1) % 1;
        var k = (an.guion || tecleo)(u);
        var col = luz(r.fondo) < 0.35 ? tono(r.color, -0.35) : tono(r.color, 0.55);
        var h = lerp(6, TAPA_H, k.abre);
        return {
            x: CX,
            y: CY + 170 * (1 - k.saca),
            op: suave(k.saca * 1.6),
            h: h,
            logo: clamp((h - 30) / (TAPA_H - 30), 0, 1),
            teclas: [-1, 1].map(function (lado) {
                return { x: lado * 30, op: lado === k.lado ? 0.85 * k.golpe : 0 };
            }),
            glifos: (an.glifos || GLIFOS_T).map(function (b, i) {
                var f = (u - b) / GLIFO_VIDA;
                var vive = f >= 0 && f <= 1;
                var lado = i % 2 ? 1 : -1;
                f = clamp(f, 0, 1);
                return {
                    tipo: i % 3 === 1 ? 'llaves' : 'etiqueta',
                    x: CX + lado * (46 + 24 * f),
                    y: CY + 36 - 74 * f,
                    rot: lado * (-8 + 16 * f),
                    op: vive ? 0.95 * Math.sin(f * Math.PI) : 0,
                    s: 1.3,
                    col: col
                };
            })
        };
    }

    /*  ── EL GUION DEL PROGRAMADOR DE LADO ────────────────────────────────

        Con la vuelta de 6 s (ver ANIMS.programa), en segundos:

          0.00-0.06  reposo, de frente                      0.4 s
          0.06-0.14  saca la laptop                         0.5 s
          0.10-0.22  se pone de lado y se corre             0.7 s
          0.18-0.27  abre la tapa                           0.5 s
          0.30-0.52  teclea: siete teclas                   1.3 s
          0.52-0.60  te mira de reojo                       0.5 s
          0.60-0.82  teclea otra vez                        1.3 s
          0.84-0.89  cierra la tapa                         0.3 s
          0.88-0.95  vuelve de frente                       0.4 s
          0.93-0.98  guarda la laptop                       0.3 s

        `escrito` es cuanto codigo hay en pantalla, de 0 a 1: media pantalla
        por rafaga, y quieto mientras piensa. */
    function trabajoLado(u) {
        var saca = u < 0.06 ? 0 : u < 0.14 ? suave((u - 0.06) / 0.08)
                 : u < 0.93 ? 1 : u < 0.98 ? 1 - suave((u - 0.93) / 0.05) : 0;
        var gira = u < 0.10 ? 0 : u < 0.22 ? suave((u - 0.10) / 0.12)
                 : u < 0.88 ? 1 : u < 0.95 ? 1 - suave((u - 0.88) / 0.07) : 0;
        var abre = u < 0.18 ? 0 : u < 0.27 ? suave((u - 0.18) / 0.09)
                 : u < 0.84 ? 1 : u < 0.89 ? 1 - suave((u - 0.84) / 0.05) : 0;
        var golpe = 0, lado = 0;
        RAFAGAS_LADO.forEach(function (ra) {
            if (u >= ra[0] && u < ra[1]) {
                var x = ra[2] * (u - ra[0]) / (ra[1] - ra[0]);
                var sn = Math.sin(Math.PI * x);
                golpe = sn * sn;
                lado = Math.floor(x) % 2 ? 1 : -1;
            }
        });
        var piensa = (u >= 0.52 && u < 0.60) ? Math.sin((u - 0.52) / 0.08 * Math.PI) : 0;
        var escrito = u < 0.30 ? 0 : u < 0.52 ? 0.5 * (u - 0.30) / 0.22
                    : u < 0.60 ? 0.5 : u < 0.82 ? 0.5 + 0.5 * (u - 0.60) / 0.22 : 1;
        return { saca: saca, gira: gira, abre: abre, golpe: golpe, lado: lado, piensa: piensa, escrito: escrito };
    }

    /*  El cuerpo: gira la cara hacia la pantalla --yaw 52: de perfil pero
        con los dos ojos a la vista; a 60 el de alla se iba por el borde-- y
        se corre 40 a la izquierda para dejarle sitio a la laptop. Cabecea poco en
        cada tecla: lo que teclea se ve en la pantalla. En la pausa
        vuelve la cara hacia ti a medias, que es mirar de reojo. */
    function programaLadoCuerpo(u) {
        var k = trabajoLado(u);
        return {
            yaw:   52 * k.gira - 30 * k.piensa,
            pitch: -5 * k.gira * (1 - k.piensa) + 4 * k.piensa - 1.2 * k.golpe,
            roll:  -2 * k.gira + 3 * k.piensa,
            dx:    -40 * k.gira,
            dy:     1.2 * k.golpe,
            sx:     1 + 0.01 * k.golpe,
            sy:     1 - 0.012 * k.golpe
        };
    }

    /*  LA LAPTOP DE PERFIL, en tres cuartos, a la derecha del muñeco. Todo en
        coordenadas desde el centro del cuerpo, con el cuerpo ya corrido 40 a
        la izquierda (su borde derecho cae en x 54):

          bisagra   H1 (60, 88) - H2 (126, 103)
          frente    F1 (6, 103) - F2 (72, 118)   el lado del teclado que da
                                                  al muñeco
          tapa      sube de la bisagra hasta T1 (70, 8) - T2 (134, 25),
                    un poco echada hacia atras

        Es grande a proposito: la primera version media un 30% menos y, al
        lado del cuerpo, se leia como un juguete. Asi el teclado queda justo
        delante de la barriga y la pantalla a la altura de la cara.

        La pantalla mira al muñeco y, de tres cuartos, tambien a nosotros: por
        eso se ve el codigo. Cerrada, la tapa se tumba sobre el teclado
        (T = frente + 4 arriba) y enseña el aluminio; el bisel negro y la
        pantalla solo aparecen cuando ya esta levantada. En el lienzo llega a
        x 294 e y 283: dentro de 320. */
    var LADO = {
        H1: [60, 88], H2: [126, 103], F1: [6, 103], F2: [72, 118],
        T1: [70, 8], T2: [134, 25],
        alu: '#C9D0D9', borde: '#A3ADBA', teclado: '#B4BCC7', bisel: '#2B3240', pantalla: '#161C27',
        cursor: '#E6EDF7'
    };
    /*  Las lineas de codigo: sangria, largo y color, de arriba abajo. Colores
        de resaltado de sintaxis sobre el fondo oscuro de la pantalla. */
    var CODIGO = [
        { ind: 0,    largo: 0.52, col: '#7CC4FF' },
        { ind: 0.10, largo: 0.60, col: '#F9C66B' },
        { ind: 0.20, largo: 0.40, col: '#7EE0A5' },
        { ind: 0.10, largo: 0.66, col: '#F28CB1' },
        { ind: 0,    largo: 0.30, col: '#7CC4FF' }
    ];

    function mezcla(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)]; }
    function quad(p) {
        return 'M' + p.map(function (q) { return q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join('L') + 'Z';
    }
    /*  Un punto del teclado: s a lo ancho (0 izquierda, 1 derecha) y d desde
        la bisagra (0) hasta el frente (1). */
    function enTeclado(s, d) {
        return [LADO.H1[0] + s * (LADO.H2[0] - LADO.H1[0]) + d * (LADO.F1[0] - LADO.H1[0]),
                LADO.H1[1] + s * (LADO.H2[1] - LADO.H1[1]) + d * (LADO.F1[1] - LADO.H1[1])];
    }
    /*  El teclado no cambia: se arma una vez. Primero el grosor --la misma
        figura cinco mas abajo, mas oscura--, luego la cubierta y el teclado. */
    var TECLADO_LADO = (function () {
        var cub = [LADO.H1, LADO.H2, LADO.F2, LADO.F1];
        var gro = cub.map(function (q) { return [q[0], q[1] + 5]; });
        var tec = [enTeclado(0.1, 0.12), enTeclado(0.9, 0.12), enTeclado(0.9, 0.66), enTeclado(0.1, 0.66)];
        return '<path d="' + quad(gro) + '" fill="' + LADO.borde + '"/>'
             + '<path d="' + quad(cub) + '" fill="' + LADO.alu + '" stroke="' + LADO.borde + '" stroke-width="1.5" stroke-linejoin="round"/>'
             + '<path d="' + quad(tec) + '" fill="' + LADO.teclado + '"/>';
    })();

    function ladoDe(t, an, r) {
        var u = ((t / an.per) % 1 + 1) % 1;
        var k = trabajoLado(u);
        var T1 = mezcla([LADO.F1[0], LADO.F1[1] - 4], LADO.T1, k.abre);
        var T2 = mezcla([LADO.F2[0], LADO.F2[1] - 4], LADO.T2, k.abre);
        /*  Un punto de la tapa: s a lo ancho, h desde la bisagra (0) hasta
            arriba (1). */
        function enTapa(s, h) {
            return mezcla(mezcla(LADO.H1, LADO.H2, s), mezcla(T1, T2, s), h);
        }
        var bisel   = clamp((k.abre - 0.3) / 0.3, 0, 1);
        var pantOp  = clamp((k.abre - 0.7) / 0.3, 0, 1);
        var n = CODIGO.length, fila = Math.min(n - 1, Math.floor(k.escrito * n));

        var lineas = CODIGO.map(function (c, i) {
            var f = clamp(k.escrito * n - i, 0, 1);
            var h = 0.80 - 0.145 * i, s0 = 0.14 + c.ind;
            var a = enTapa(s0, h), b = enTapa(s0 + c.largo * f, h);
            return { d: 'M' + a[0].toFixed(1) + ' ' + a[1].toFixed(1) + 'L' + b[0].toFixed(1) + ' ' + b[1].toFixed(1),
                     col: c.col, op: f > 0 && !an.app ? pantOp : 0 };
        });
        var cf = CODIGO[fila], cs = 0.14 + cf.ind + cf.largo * clamp(k.escrito * n - fila, 0, 1) + 0.03;
        var ca = enTapa(cs, 0.80 - 0.145 * fila + 0.05), cb = enTapa(cs, 0.80 - 0.145 * fila - 0.05);
        /*  El cursor parpadea mientras teclea y se queda fijo al pensar. */
        var parpadea = (k.golpe > 0 || k.piensa > 0) ? (Math.sin(u * Math.PI * 2 * 9) > -0.3 ? 1 : 0) : 1;

        return {
            x: CX,
            y: CY + 160 * (1 - k.saca),
            op: suave(k.saca * 1.6),
            alu:  quad([LADO.H1, T1, T2, LADO.H2].map(function (q, i) { return i === 0 || i === 3 ? [q[0] + 3, q[1]] : [q[0] + 4, q[1] - 1]; })),
            bisel: quad([LADO.H1, T1, T2, LADO.H2]),
            biselOp: bisel,
            pantalla: quad([enTapa(0.07, 0.08), enTapa(0.07, 0.93), enTapa(0.93, 0.93), enTapa(0.93, 0.08)]),
            pantOp: pantOp,
            lineas: lineas,
            cursor: { d: 'M' + ca[0].toFixed(1) + ' ' + ca[1].toFixed(1) + 'L' + cb[0].toFixed(1) + ' ' + cb[1].toFixed(1),
                      op: an.app ? 0 : pantOp * parpadea }
        };
    }

    /* ================== LOS MOVIMIENTOS DE TRABAJO (25/09/2026) ==================

       Seis movimientos que cuentan lo que hace coffeeIA en el ERP:

         llevame     en la laptop: un punto recorre la ruta y cae un pin    ubicar, guiar_pantalla
         leyendo     lee un libro abierto y pasa la hoja                    lo que suben al chat
         calculando  una terminal imprime el ticket con el total            consultar, reportes
         entrega     descarga un archivo: aro que se llena y palomita       bajar_reporte, bajar_formato
         anotando    agenda un evento en un calendario y suena la campana   crear_recordatorio
         correo      en la laptop: escribe un correo y pulsa «Enviar»       redactar_correo

       SIN MANOS NI BRAZOS, y es una decision: la primera version las tenia y
       se leia como caricatura, no como una herramienta de trabajo. Los objetos
       flotan junto al muñeco con el vocabulario de una interfaz --un boton, un
       aro de descarga, una palomita, una campana-- y en la paleta del ERP.
       La primera tanda tuvo tambien «encogerse de hombros»; se quito.

       ── LA UTILERIA ─────────────────────────────────────────────────────────

       Un solo pintor para todos: la animacion declara `utileria(u, r, mov)` y
       devuelve una lista de piezas, cada una con su dibujo FIJO y lo que se
       mueve (x, y, rot, s, op). pintaPiezas las pone con un transform y el SVG
       animado anima esos cinco numeros.

       LA REGLA: la lista tiene siempre el mismo largo y la pieza i siempre el
       mismo dibujo. Lo que aparece y desaparece lo hace con `op`: SMIL anima
       atributos, no puede cambiar un dibujo por otro a mitad del ciclo. Lo
       que tiene que verse en perspectiva (la calculadora) lleva la matriz
       DENTRO de su dibujo.

       Tres de ellos --Llévame, Calculando y Correo-- tuvieron una primera
       version (un boton con flecha, una calculadora de lado y un sobre) que
       no convencio; se rehicieron como tarjetas, igual que Leyendo. */

    function entra(u, a, b, c, d) {
        return u < a ? 0 : u < b ? suave((u - a) / (b - a))
             : u < c ? 1 : u < d ? 1 - suave((u - c) / (d - c)) : 0;
    }
    function tramo(u, a, b) { return suave((u - a) / (b - a)); }
    function golpes(u, a, b, n) {
        if (u < a || u >= b) return { g: 0, lado: 0, i: -1 };
        var x = n * (u - a) / (b - a), sn = Math.sin(Math.PI * x);
        return { g: sn * sn, lado: Math.floor(x) % 2 ? 1 : -1, i: Math.floor(x) };
    }
    /*  Los hitos de una animacion: sus fronteras y, por cada rafaga de
        golpes, cada pico y cada valle (ver HITOS_PROGRAMA). */
    function hitosDe(base, rafagas) {
        var h = base.slice();
        (rafagas || []).forEach(function (ra) {
            for (var i = 0; i <= ra[2] * 2; i++) h.push(ra[0] + (ra[1] - ra[0]) * i / (ra[2] * 2));
        });
        return h.sort(function (a, b) { return a - b; });
    }
    function pieza(svg, x, y, rot, s, op) {
        return { svg: svg, x: x, y: y, rot: rot || 0, s: s == null ? 1 : s, op: clamp(op, 0, 1) };
    }
    /*  Un punto de un objeto girado: (lx, ly) en su dibujo, el objeto en
        (x, y) con giro `g` y escala `s`. */
    function sobre(x, y, g, s, lx, ly) {
        var a = rad(g), c = Math.cos(a), sn = Math.sin(a);
        return [x + s * (lx * c - ly * sn), y + s * (lx * sn + ly * c)];
    }
    function trazo2(d, col, w) {
        return '<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="' + (w || 3.6)
             + '" stroke-linecap="round" stroke-linejoin="round"/>';
    }

    /*  La paleta de estos objetos: la del ERP. */
    var ERP = { azul: '#1277DB', verde: '#16A34A', ambar: '#F59E0B', rojo: '#E5484D',
                papel: '#FFFFFF', filo: '#D8DEE8', gris: '#C4CCD8', tinta: '#475569', claro: '#EEF2F7' };

    var PALOMITA = '<circle r="12" fill="' + ERP.verde + '"/>'
                 + '<path d="M-5.5 0.5L-1.5 4.5L6 -4" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>';

    var CURSOR = '<path d="M0 0V17L4.5 12.5L7.5 19L10.5 17.7L7.5 11.3H13.5Z" fill="#1F2937" stroke="#FFFFFF" stroke-width="1.5" stroke-linejoin="round"/>';
    var ONDA = '<circle r="8" fill="none" stroke="' + ERP.azul + '" stroke-width="2.4"/>';

    /* ── LEYENDO (6 s) ──────────────────────────────────────────────────────
       Un libro abierto flota delante, por debajo de los ojos. Lee la pagina
       izquierda y luego la derecha --la mirada barre cada una--, pasa la
       hoja y sigue leyendo. Sin laptop: se pidio que leer no fuera otra
       pantalla. (Antes fue un documento flotando al lado y despues un haz de
       analisis en la laptop; ninguno convencio.)

       LA HOJA QUE PASA son tres dibujos fijos --levantandose, de pie y
       cayendo-- que se van relevando con la opacidad, como los cuadros de un
       dibujo animado. La utileria no sabe girar en 3D, y a este tamaño tres
       cuadros bastan para leer el gesto. */
    var LIBRO = '<path d="M-58 -30L0 -24L58 -30V32L0 38L-58 32Z" fill="#1F4E79"/>'
              + '<path d="M-54 -27C-36 -30 -14 -28 -2 -22V33C-14 27 -36 25 -54 28Z" fill="' + ERP.papel + '"/>'
              + '<path d="M54 -27C36 -30 14 -28 2 -22V33C14 27 36 25 54 28Z" fill="' + ERP.papel + '"/>'
              + '<path d="M-46 -16H-10M-46 -8H-8M-46 0H-12M-46 8H-8M-46 16H-16" stroke="' + ERP.gris + '" stroke-width="2.6" stroke-linecap="round"/>'
              + '<path d="M10 -16H46M8 -8H46M12 0H46M8 8H46M16 16H40" stroke="' + ERP.gris + '" stroke-width="2.6" stroke-linecap="round"/>'
              + '<path d="M36 -29V-14L40 -18L44 -14V-30" fill="' + ERP.rojo + '"/>';
    var HOJA_SUBE  = '<path d="M-2 -22C10 -32 28 -38 42 -40V20C28 22 10 26 -2 33Z" fill="' + ERP.papel + '" stroke="' + ERP.filo + '" stroke-width="1.5" stroke-linejoin="round"/>';
    var HOJA_PIE   = '<path d="M-2 -22C0 -38 4 -48 8 -54V10C4 16 0 24 -2 33Z" fill="' + ERP.papel + '" stroke="' + ERP.filo + '" stroke-width="1.5" stroke-linejoin="round"/>';
    var HOJA_CAE   = '<path d="M2 -22C-10 -32 -28 -38 -42 -40V20C-28 22 -10 26 2 33Z" fill="' + ERP.papel + '" stroke="' + ERP.filo + '" stroke-width="1.5" stroke-linejoin="round"/>';
    function leeK(u) {
        /*  Dos tandas de lectura con la hoja pasando en medio. `pag` es que
            pagina lee (-1 izquierda, 1 derecha) y `barre` por donde va. */
        var a = entra(u, 0.06, 0.16, 0.86, 0.95), pasa = clamp((u - 0.46) / 0.08, 0, 1);
        var lee = -1, x = 0, pag = 0;
        [[0.18, 0.44], [0.56, 0.82]].forEach(function (t) { if (u >= t[0] && u < t[1]) { lee = 1; x = (u - t[0]) / (t[1] - t[0]); } });
        if (lee > 0) { pag = x < 0.5 ? -1 : 1; x = (x % 0.5) * 2; }
        return { a: a, pasa: u >= 0.46 && u < 0.54 ? pasa : -1, pag: pag, barre: x, lee: lee > 0 ? 1 : 0 };
    }
    function leyendoCuerpo(u) {
        var k = leeK(u);
        return { yaw: k.lee * (k.pag * 9 + (k.barre - 0.5) * 8), pitch: -9 * k.a - 2 * k.barre * k.lee, dy: 2 * k.a };
    }
    function leyendoUtil(u) {
        var k = leeK(u), x = CX, y = CY + 88 + 16 * (1 - k.a), e = 1.1;
        function cuadro(i) { return k.pasa < 0 ? 0 : Math.max(0, 1 - Math.abs(k.pasa * 4 - (i + 1))); }
        return [
            pieza(LIBRO, x, y, 0, e, k.a),
            pieza(HOJA_SUBE, x, y, 0, e, k.a * cuadro(0)),
            pieza(HOJA_PIE, x, y, 0, e, k.a * cuadro(1)),
            pieza(HOJA_CAE, x, y, 0, e, k.a * cuadro(2))
        ];
    }

    /* ── CALCULANDO (6 s) ───────────────────────────────────────────────────
       Una terminal pequeña a su lado imprime un ticket: el papel va saliendo
       con los renglones de la cuenta, una linea punteada y el total en verde;
       al terminar, la palomita. Es una cafeteria: la cuenta es un ticket.
       Sin laptop, a peticion. (Antes fueron una calculadora con manos, una de
       lado y una grafica en la laptop.)

       El papel son diez tramos fijos que aparecen de arriba abajo; el borde
       dentado es la unica pieza que baja. */
    var TICKET_N = 10, TICKET_H = 10;
    var TERMINAL = '<rect x="-30" y="-8" width="60" height="16" rx="8" fill="#2F3A4A"/>'
                 + '<rect x="-22" y="-1.5" width="44" height="3" rx="1.5" fill="#111827"/>'
                 + '<circle cx="23" cy="-3" r="1.6" fill="' + ERP.verde + '"/>';
    var TICKET_TRAMOS = (function () {
        var v = [];
        for (var i = 0; i < TICKET_N; i++) {
            var y = 1 + TICKET_H * i, h = TICKET_H + 0.6;
            v.push('<rect x="-20" y="' + y + '" width="40" height="' + h + '" fill="' + ERP.papel + '"/>'
                 + '<path d="M-20 ' + y + 'V' + (y + h) + 'M20 ' + y + 'V' + (y + h) + '" stroke="' + ERP.filo + '" stroke-width="1.2"/>');
        }
        return v;
    })();
    /*  Lo impreso en cada tramo (null = nada). */
    var TICKET_TEXTO = [
        '<path d="M-10 6H10" stroke="' + ERP.tinta + '" stroke-width="3" stroke-linecap="round"/>',
        '<path d="M-14 16H2M8 16H14" stroke="' + ERP.gris + '" stroke-width="2.6" stroke-linecap="round"/>',
        '<path d="M-14 26H-2M8 26H14" stroke="' + ERP.gris + '" stroke-width="2.6" stroke-linecap="round"/>',
        '<path d="M-14 36H4M8 36H14" stroke="' + ERP.gris + '" stroke-width="2.6" stroke-linecap="round"/>',
        '<path d="M-14 46H0M8 46H14" stroke="' + ERP.gris + '" stroke-width="2.6" stroke-linecap="round"/>',
        null,
        '<path d="M-14 66H14" stroke="' + ERP.gris + '" stroke-width="1.6" stroke-dasharray="2.5 2.5"/>',
        '<path d="M-14 76H-3" stroke="' + ERP.tinta + '" stroke-width="3.4" stroke-linecap="round"/><rect x="2" y="72" width="13" height="8" rx="2" fill="' + ERP.verde + '"/>',
        null, null
    ];
    var DIENTES = '<path d="M-20 0L-16 4L-12 0L-8 4L-4 0L0 4L4 0L8 4L12 0L16 4L20 0Z" fill="' + ERP.papel + '" stroke="' + ERP.filo + '" stroke-width="1.2" stroke-linejoin="round"/>';
    function calcK(u) {
        return { a: entra(u, 0.06, 0.16, 0.86, 0.95), sale: clamp((u - 0.20) / 0.46, 0, 1), ok: entra(u, 0.70, 0.74, 0.86, 0.95) };
    }
    function calculandoCuerpo(u) {
        var k = calcK(u);
        return { yaw: 12 * k.a, pitch: k.a * (-2 - 7 * k.sale) + 5 * k.ok, dy: 1.5 * k.a - 2 * k.ok };
    }
    function calculandoUtil(u) {
        var k = calcK(u), x = CX + 100, y = CY - 26 + 10 * (1 - k.a), e = 1.05, n = k.sale * TICKET_N;
        var v = [];
        TICKET_TRAMOS.forEach(function (t, i) { v.push(pieza(t, x, y, 0, e, k.a * clamp(n - i, 0, 1))); });
        TICKET_TEXTO.forEach(function (t, i) { v.push(pieza(t || '', x, y, 0, e, t ? k.a * clamp(n - i - 0.4, 0, 1) : 0)); });
        v.push(pieza(DIENTES, x, y + e * (1 + TICKET_H * n), 0, e, k.a * (n > 0.05 ? 1 : 0)));
        v.push(pieza(TERMINAL, x, y, 0, e, k.a));
        v.push(pieza(PALOMITA, x + 42, y + 2, 0, 0.8 + 0.3 * k.ok, k.ok));
        return v;
    }

    /* ── DESCARGANDO (6 s) ──────────────────────────────────────────────────
       Aparece a su lado un archivo de hoja de calculo y, en su esquina, el
       indicador de descarga de siempre: una flecha dentro de un aro que se
       va llenando. Al completarse, el aro se vuelve una palomita verde. */
    var ARCHIVO = '<path d="M-22 -30H10L22 -18V30H-22Z" fill="' + ERP.papel + '" stroke="' + ERP.filo + '" stroke-width="2" stroke-linejoin="round"/>'
                + '<path d="M10 -30V-18H22" fill="' + ERP.claro + '" stroke="' + ERP.filo + '" stroke-width="2" stroke-linejoin="round"/>'
                + '<rect x="-15" y="-20" width="18" height="10" rx="2.5" fill="' + ERP.verde + '"/>'
                + '<path d="M-15 0H15M-15 9H15M-15 18H15M-4 -4V24M6 -4V24" stroke="#A7E3BC" stroke-width="2" stroke-linecap="round"/>';
    var ARO_N = 12;
    function descargaK(u) {
        return {
            a: entra(u, 0.08, 0.20, 0.84, 0.94),
            carga: clamp((u - 0.24) / 0.38, 0, 1),
            aro: entra(u, 0.20, 0.24, 0.64, 0.68),
            ok: entra(u, 0.64, 0.70, 0.84, 0.94)
        };
    }
    function entregaCuerpo(u) {
        var k = descargaK(u);
        return { yaw: 18 * k.a, pitch: -4 * k.a + 5 * k.ok, dy: 1.5 * k.a - 2 * k.ok };
    }
    function entregaUtil(u) {
        var k = descargaK(u), x = CX + 96, y = CY + 40 + 14 * (1 - k.a), s = 1.5;
        var c = sobre(x, y, 0, s, 20, 26);
        var v = [pieza(ARCHIVO, x, y, 0, s, k.a)];
        for (var i = 0; i < ARO_N; i++) {
            var ang = -Math.PI / 2 + i / ARO_N * Math.PI * 2;
            var lleno = clamp(k.carga * ARO_N - i, 0, 1);
            v.push(pieza('<circle r="2.4" fill="' + ERP.azul + '"/>', c[0] + 18 * Math.cos(ang), c[1] + 18 * Math.sin(ang), 0, 1.2,
                         k.aro * (0.22 + 0.78 * lleno)));
        }
        v.push(pieza(trazo2('M0 -6V5M-4.5 1L0 5.5L4.5 1', ERP.azul, 2.8), c[0], c[1] + 2 * Math.sin(u * Math.PI * 12), 0, 1.3, k.aro));
        v.push(pieza(PALOMITA, c[0], c[1], 0, 1.1 + 0.3 * k.ok, k.ok));
        return v;
    }

    /* ── AGENDANDO (6 s) ────────────────────────────────────────────────────
       Un calendario flota a su izquierda; un evento azul entra y se coloca en
       un dia, el dia se marca y suena la campana: recordatorio puesto. */
    var CALENDARIO = (function () {
        var s = '<rect x="-34" y="-34" width="68" height="70" rx="7" fill="' + ERP.papel + '" stroke="' + ERP.filo + '" stroke-width="2"/>'
              + '<path d="M-34 -27C-34 -30.9 -30.9 -34 -27 -34H27C30.9 -34 34 -30.9 34 -27V-18H-34Z" fill="' + ERP.rojo + '"/>'
              + '<rect x="-20" y="-39" width="4" height="10" rx="2" fill="' + ERP.tinta + '"/>'
              + '<rect x="16" y="-39" width="4" height="10" rx="2" fill="' + ERP.tinta + '"/>';
        for (var f = 0; f < 3; f++) {
            for (var c = 0; c < 4; c++) {
                s += '<rect x="' + (-27 + 14 * c) + '" y="' + (-11 + 14 * f) + '" width="12" height="11" rx="2" fill="' + ERP.claro + '"/>';
            }
        }
        return s;
    })();
    var CAMPANA = '<circle r="11" fill="' + ERP.ambar + '"/>'
                + '<path d="M-5 3V-1C-5 -4.5 -2.8 -6.5 0 -6.5C2.8 -6.5 5 -4.5 5 -1V3L6.5 5H-6.5Z" fill="#FFFFFF"/>'
                + '<circle cx="0" cy="7" r="1.6" fill="#FFFFFF"/>';
    function agendaK(u) {
        return {
            a: entra(u, 0.06, 0.16, 0.86, 0.95),
            entra: tramo(u, 0.24, 0.44),
            marca: entra(u, 0.42, 0.48, 0.86, 0.95),
            suena: entra(u, 0.50, 0.54, 0.78, 0.84),
            vibra: (u >= 0.52 && u < 0.78) ? Math.sin((u - 0.52) * Math.PI * 2 * 30) : 0
        };
    }
    function anotandoCuerpo(u) {
        var k = agendaK(u);
        return { yaw: -16 * k.a, pitch: -5 * k.a + 3 * k.suena, dy: 1.5 * k.a };
    }
    function anotandoUtil(u) {
        var k = agendaK(u), x = CX - 104, y = CY + 62 + 14 * (1 - k.a), s = 1.25;
        var dia = sobre(x, y, 0, s, -27 + 14 * 2 + 6, -11 + 14 * 1 + 5.5);
        var ev0 = [dia[0] + 70, dia[1] - 40];
        var ev = [lerp(ev0[0], dia[0], k.entra), lerp(ev0[1], dia[1], k.entra)];
        var cp = sobre(x, y, 0, s, 30, -30);
        return [
            pieza(CALENDARIO, x, y, 0, s, k.a),
            pieza('<rect x="-6" y="-5.5" width="12" height="11" rx="2" fill="' + ERP.azul + '" opacity=".22"/>', dia[0], dia[1], 0, s, k.a * k.marca),
            pieza('<rect x="-9" y="-4" width="18" height="8" rx="3" fill="' + ERP.azul + '"/>', ev[0], ev[1], 0, 1,
                  k.a * (u < 0.24 ? 0 : Math.min(1, (u - 0.24) / 0.05))),
            pieza(CAMPANA, cp[0], cp[1], 14 * k.vibra, 0.9 + 0.4 * k.suena, k.a * k.suena)
        ];
    }

    /* ── EN LA LAPTOP: LLÉVAME, CALCULANDO Y ENVIANDO CORREO (6 s) ────────────

       Los tres pasan en la pantalla de la laptop del Programador: saca la
       laptop, se pone de lado, la abre (mismo guion, trabajoLado) y en la
       pantalla, en vez de codigo, se ve una pequeña app del ERP con barra
       azul arriba. Antes fueron tarjetas flotando al lado; se pidio verlos
       "en una laptop".

       LA PANTALLA ESTA EN PERSPECTIVA, y lo que va dentro tambien. Se dibuja
       en un espacio propio de 100 x 80 (x a la derecha, y hacia abajo) y la
       matriz PANTALLA lo lleva al paralelogramo de la pantalla abierta: sale
       de las mismas esquinas que usa ladoDe (enTapa en 0.07/0.93 y 0.08/0.93),
       asi que si la laptop cambia de medida, esto la sigue.

       Solo se ve con la tapa abierta (`pantOp`), y durante ese rato la laptop
       no se mueve: por eso cada pieza de pantalla es FIJA --la matriz va
       dentro de su dibujo-- y solo cambia su opacidad. Lo que si se mueve (el
       cursor, la onda, la palomita) se coloca con enPantalla() y se dibuja
       plano, que a ese tamaño no se nota. */
    var PANTALLA = (function () {
        function tapa(s, h) {
            return [lerp(lerp(LADO.H1[0], LADO.H2[0], s), lerp(LADO.T1[0], LADO.T2[0], s), h),
                    lerp(lerp(LADO.H1[1], LADO.H2[1], s), lerp(LADO.T1[1], LADO.T2[1], s), h)];
        }
        var tl = tapa(0.07, 0.93), tr = tapa(0.93, 0.93), bl = tapa(0.07, 0.08);
        return { a: (tr[0] - tl[0]) / 100, b: (tr[1] - tl[1]) / 100, c: (bl[0] - tl[0]) / 80, d: (bl[1] - tl[1]) / 80,
                 e: tl[0], f: tl[1] };
    })();
    function enPantalla(x, y) {
        var M = PANTALLA;
        return [CX + M.e + M.a * x + M.c * y, CY + M.f + M.b * x + M.d * y];
    }
    /*  Un dibujo en el espacio de la pantalla, listo para ser pieza en (CX, CY). */
    function dePantalla(inner) {
        var M = PANTALLA;
        return '<g transform="matrix(' + [M.a, M.b, M.c, M.d, M.e, M.f].map(function (n) { return n.toFixed(4); }).join(' ')
             + ')">' + inner + '</g>';
    }
    var APP = dePantalla('<rect x="0" y="0" width="100" height="80" rx="3" fill="#F7F9FC"/>'
                       + '<path d="M0 3C0 1.3 1.3 0 3 0H97C98.7 0 100 1.3 100 3V10H0Z" fill="' + ERP.azul + '"/>');
    function pantallaDe(u) { return clamp((trabajoLado(u).abre - 0.7) / 0.3, 0, 1); }

    /*  El cuerpo de los tres: el del programador sin teclear ni mirar de
        reojo --aqui lo que pasa esta en la pantalla-- y un asentir corto
        cuando la tarea sale bien (`ok`). */
    function enLaptopCuerpo(u, ok) {
        var k = trabajoLado(u);
        return { yaw: 52 * k.gira, pitch: -5 * k.gira + 4 * (ok || 0), roll: -2 * k.gira, dx: -40 * k.gira, dy: -1.5 * (ok || 0) };
    }

    /*  LLÉVAME: una ruta de tres puntos. Un punto azul la recorre y enciende
        cada parada; al llegar, cae un pin de ubicacion sobre el destino con
        una onda. Es "te llevo alla" dicho como lo dice un mapa.

        Hubo una version con un menu lateral y un cursor que hacia clic; a
        ese tamaño no se entendia. La linea que se llena son diez tramos
        fijos que se encienden, por la REGLA de la utileria. */
    var RUTA_X = [20, 50, 80], RUTA_Y = 40;
    var RUTA_FIJO = dePantalla('<path d="M8 20H44" stroke="' + ERP.tinta + '" stroke-width="3.6" stroke-linecap="round"/>'
                             + '<path d="M20 40H80" stroke="' + ERP.filo + '" stroke-width="3" stroke-linecap="round"/>'
                             + '<circle cx="20" cy="40" r="4.5" fill="#FFFFFF" stroke="' + ERP.gris + '" stroke-width="2"/>'
                             + '<circle cx="50" cy="40" r="4.5" fill="#FFFFFF" stroke="' + ERP.gris + '" stroke-width="2"/>'
                             + '<circle cx="80" cy="40" r="4.5" fill="#FFFFFF" stroke="' + ERP.gris + '" stroke-width="2"/>'
                             + '<path d="M12 56H28M42 56H58M72 56H88" stroke="' + ERP.gris + '" stroke-width="3" stroke-linecap="round"/>');
    var RUTA_TRAMOS = (function () {
        var v = [];
        for (var i = 0; i < 10; i++) {
            v.push(dePantalla('<path d="M' + (20 + 6 * i) + ' 40H' + (26 + 6 * i) + '" stroke="' + ERP.azul + '" stroke-width="3"/>'));
        }
        return v;
    })();
    var RUTA_PARADAS = RUTA_X.map(function (x) {
        return dePantalla('<circle cx="' + x + '" cy="40" r="4.5" fill="' + ERP.azul + '"/>');
    });
    var PIN = '<path d="M0 0C-5 -6 -8 -10 -8 -14A8 8 0 1 1 8 -14C8 -10 5 -6 0 0Z" fill="' + ERP.azul + '"/>'
            + '<circle cx="0" cy="-14" r="3" fill="#FFFFFF"/>';
    var PUNTO = '<circle r="3.4" fill="' + ERP.azul + '" stroke="#FFFFFF" stroke-width="1.5"/>';
    function llevaK(u) {
        return { va: clamp((u - 0.32) / 0.24, 0, 1), cae: tramo(u, 0.56, 0.61), bote: (u >= 0.61 && u < 0.69) ? Math.sin((u - 0.61) / 0.08 * Math.PI) : 0,
                 onda: clamp((u - 0.60) / 0.12, 0, 1), ok: entra(u, 0.62, 0.66, 0.72, 0.78) };
    }
    function llevameCuerpo(u) { return enLaptopCuerpo(u, llevaK(u).ok); }
    function llevameUtil(u) {
        var k = llevaK(u), op = pantallaDe(u);
        var v = [pieza(APP, CX, CY, 0, 1, op), pieza(RUTA_FIJO, CX, CY, 0, 1, op)];
        RUTA_TRAMOS.forEach(function (t, i) { v.push(pieza(t, CX, CY, 0, 1, op * clamp(k.va * 10 - i, 0, 1))); });
        RUTA_PARADAS.forEach(function (p, i) { v.push(pieza(p, CX, CY, 0, 1, op * clamp((k.va - i / 2) * 20 + 1, 0, 1))); });
        var d = enPantalla(lerp(20, 80, k.va), RUTA_Y), fin = enPantalla(80, RUTA_Y);
        v.push(pieza(PUNTO, d[0], d[1], 0, 1, op * (u >= 0.32 ? 1 - k.cae : 0)));
        v.push(pieza(ONDA, fin[0], fin[1], 0, 0.3 + 0.8 * k.onda, op * (k.onda > 0 && k.onda < 1 ? 1 - k.onda : 0)));
        v.push(pieza(PIN, fin[0], fin[1] - 10 * (1 - k.cae) - 4 * k.bote, 0, 0.8, op * k.cae));
        return v;
    }

    /*  ENVIANDO CORREO: destinatario, el texto se escribe renglon por
        renglon, se pulsa «Enviar» y queda la palomita. */
    var CORREO_FIJO = dePantalla('<path d="M8 19H15" stroke="#AEB8C6" stroke-width="3" stroke-linecap="round"/>'
                               + '<path d="M6 25H94M6 35H94" stroke="' + ERP.filo + '" stroke-width="1.2"/>'
                               + '<path d="M8 30H48" stroke="' + ERP.tinta + '" stroke-width="3" stroke-linecap="round"/>');
    var CORREO_PARA = dePantalla('<rect x="19" y="14.5" width="34" height="9" rx="4.5" fill="' + ERP.azul + '" opacity=".18"/>'
                               + '<path d="M23 19H49" stroke="' + ERP.azul + '" stroke-width="2.4" stroke-linecap="round"/>');
    var CORREO_LINEAS = ['M8 43H84', 'M8 50H90', 'M8 57H70', 'M8 64H80'].map(function (d) {
        return dePantalla('<path d="' + d + '" stroke="' + ERP.gris + '" stroke-width="3" stroke-linecap="round"/>');
    });
    var CORREO_BOTON = dePantalla('<rect x="66" y="68" width="27" height="9" rx="4.5" fill="' + ERP.azul + '"/>'
                                + '<path d="M74 72.5H84M80.5 69.5L84 72.5L80.5 75.5" fill="none" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>');
    var CORREO_PULSADO = dePantalla('<rect x="66" y="68" width="27" height="9" rx="4.5" fill="#0C4F92"/>');
    function correoK(u) {
        return { para: tramo(u, 0.30, 0.34), escribe: clamp((u - 0.36) / 0.26, 0, 1), pulsa: entra(u, 0.66, 0.67, 0.68, 0.71),
                 onda: clamp((u - 0.665) / 0.10, 0, 1), ok: tramo(u, 0.72, 0.75) };
    }
    function correoCuerpo(u) { var k = correoK(u); return enLaptopCuerpo(u, entra(u, 0.72, 0.75, 0.80, 0.84)); }
    function correoUtil(u) {
        var k = correoK(u), op = pantallaDe(u), b = enPantalla(79.5, 72.5), c = enPantalla(90, 18);
        var v = [pieza(APP, CX, CY, 0, 1, op), pieza(CORREO_FIJO, CX, CY, 0, 1, op), pieza(CORREO_PARA, CX, CY, 0, 1, op * k.para)];
        CORREO_LINEAS.forEach(function (l, i) { v.push(pieza(l, CX, CY, 0, 1, op * clamp(k.escribe * 4 - i, 0, 1))); });
        v.push(pieza(CORREO_BOTON, CX, CY, 0, 1, op));
        v.push(pieza(CORREO_PULSADO, CX, CY, 0, 1, op * k.pulsa));
        v.push(pieza(ONDA, b[0], b[1], 0, 0.3 + 0.8 * k.onda, op * (k.onda > 0 && k.onda < 1 ? 1 - k.onda : 0)));
        v.push(pieza(PALOMITA, c[0], c[1], 0, 0.55 + 0.2 * k.ok, op * k.ok));
        return v;
    }

    /* ================== DEL DIA, DE LA CASA Y «SIN RESULTADOS» (25/09/2026) ==================

       Las propuestas que quedaban. Mismas reglas que los de trabajo: sin
       manos, objetos de interfaz y la paleta del ERP, todo con la utileria.

         saludo      bota contento y sale un globo con un sol          grupo 'dia'
         festejo     salta y estalla confeti                           grupo 'dia'
         fin         se estira, bosteza y aparecen la luna y estrellas grupo 'dia'
         barista     una cafetera de espresso llena la taza            grupo 'casa'
         caja        la caja registradora cobra y salta una moneda     grupo 'casa'
         vacio       busca en una lista vacia y la lupa termina en ×   grupo 'trabajo'

       `vacio` cubre el hueco que dejo «encogerse de hombros»: el momento en
       que coffeeIA no encuentra algo o la persona no tiene acceso. */

    function estrella4(col) {
        return '<path d="M0 -6C0.8 -1.6 1.6 -0.8 6 0C1.6 0.8 0.8 1.6 0 6C-0.8 1.6 -1.6 0.8 -6 0C-1.6 -0.8 -0.8 -1.6 0 -6Z" fill="' + col + '"/>';
    }

    /* ── SALUDO (3 s) ─────────────────────────────────────────────────────── */
    var GLOBO = '<path d="M-26 -18H26C30.4 -18 34 -14.4 34 -10V10C34 14.4 30.4 18 26 18H-6L-16 28L-14 18H-26C-30.4 18 -34 14.4 -34 10V-10C-34 -14.4 -30.4 -18 -26 -18Z" fill="'
              + ERP.papel + '" stroke="' + ERP.filo + '" stroke-width="2" stroke-linejoin="round"/>'
              + '<circle r="7" fill="' + ERP.ambar + '"/>'
              + '<path d="M0 -13V-10M0 10V13M-13 0H-10M10 0H13M-9 -9L-7 -7M7 7L9 9M-9 9L-7 7M7 -7L9 -9" stroke="' + ERP.ambar + '" stroke-width="2.4" stroke-linecap="round"/>';
    function saludoK(u) { return { a: entra(u, 0.08, 0.20, 0.70, 0.86), b: golpes(u, 0.10, 0.42, 2).g }; }
    function saludoCuerpo(u) {
        var k = saludoK(u);
        return { dy: -8 * k.b, sy: 1 + 0.03 * k.b, sx: 1 - 0.02 * k.b, roll: 5 * k.a, yaw: -6 * k.a, pitch: 3 * k.a };
    }
    function saludoUtil(u) {
        var k = saludoK(u), x = CX + 90, y = CY - 80 + 10 * (1 - k.a);
        var v = [pieza(GLOBO, x, y, 0, 1.0 + 0.2 * k.a, k.a)];
        [[48, -12, 0], [-46, -24, 0.33], [34, 26, 0.66]].forEach(function (e) {
            v.push(pieza(estrella4(ERP.ambar), x + e[0], y + e[1], 0, 1.2, k.a * Math.max(0, Math.sin(Math.PI * 2 * (u * 2 - e[2])))));
        });
        return v;
    }

    /* ── FESTEJO (3 s) ────────────────────────────────────────────────────── */
    var CONFETI_COL = [ERP.azul, ERP.verde, ERP.ambar, ERP.rojo, '#7C5AC4'];
    var CONFETI = (function () {
        var v = [];
        for (var i = 0; i < 14; i++) {
            var ang = -Math.PI / 2 + (i / 13 - 0.5) * 2.2;
            v.push({ vx: Math.cos(ang) * (70 + 40 * ((i * 7) % 5) / 4), vy: Math.sin(ang) * (110 + 30 * ((i * 3) % 4) / 3),
                     giro: (i % 2 ? 1 : -1) * (200 + 60 * (i % 3)),
                     svg: '<rect x="-3.5" y="-2" width="7" height="4" rx="1" fill="' + CONFETI_COL[i % 5] + '"/>' });
        }
        return v;
    })();
    function festejoK(u) {
        var salto = (u >= 0.08 && u < 0.40) ? Math.sin((u - 0.08) / 0.32 * Math.PI) : 0;
        var cae = (u >= 0.40 && u < 0.50) ? Math.sin((u - 0.40) / 0.10 * Math.PI) : 0;
        return { salto: salto, cae: cae, t: (u - 0.18) / 0.62 };
    }
    function festejoCuerpo(u) {
        var k = festejoK(u);
        return { dy: -28 * k.salto + 5 * k.cae, sy: 1 + 0.06 * k.salto - 0.08 * k.cae, sx: 1 - 0.04 * k.salto + 0.07 * k.cae, pitch: 6 * k.salto };
    }
    function festejoUtil(u) {
        var k = festejoK(u), t = clamp(k.t, 0, 1), vive = k.t >= 0 && k.t <= 1;
        return CONFETI.map(function (c) {
            return pieza(c.svg, CX + c.vx * t, CY - 84 + c.vy * t + 190 * t * t, c.giro * t, 1.7,
                         vive ? Math.min(1, t * 8) * (1 - tramo(t, 0.7, 1)) : 0);
        });
    }

    /* ── FIN DE JORNADA (6 s) ─────────────────────────────────────────────── */
    var LUNA = '<path d="M3 -13A13 13 0 1 0 13 5A10 10 0 0 1 3 -13Z" fill="#F2C94C"/>';
    function finK(u) {
        return { estira: entra(u, 0.08, 0.20, 0.28, 0.38), bosteza: entra(u, 0.38, 0.44, 0.54, 0.60),
                 descansa: entra(u, 0.58, 0.68, 0.90, 0.97), luna: entra(u, 0.54, 0.64, 0.90, 0.97) };
    }
    function finCuerpo(u) {
        var k = finK(u);
        return { sy: 1 + 0.08 * k.estira - 0.02 * k.descansa, sx: 1 - 0.05 * k.estira + 0.02 * k.descansa,
                 dy: -6 * k.estira + 4 * k.descansa, pitch: 9 * k.bosteza - 3 * k.descansa,
                 cierra: Math.max(0.75 * k.bosteza, 0.45 * k.descansa) };
    }
    function finUtil(u) {
        var k = finK(u), x = CX + 86, y = CY - 80;
        var v = [pieza(LUNA, x, y + 8 * (1 - k.luna), -10, 1.4, k.luna)];
        [[-30, -8, 0], [22, 22, 0.4], [-8, 30, 0.7]].forEach(function (e) {
            v.push(pieza(estrella4('#F2C94C'), x + e[0], y + e[1], 0, 0.8, k.luna * (0.4 + 0.6 * Math.max(0, Math.sin(Math.PI * 2 * (u * 3 - e[2]))))));
        });
        return v;
    }

    /* ================== LOS PROCESOS (29/09/2026) ==================

       Como avisa coffeeIA lo que esta pasando. La INTENCION de cada uno se
       tomo de Coucou (github.com/Louis-CFM/coucou): asomarse al pasar el
       raton, dar una vuelta de contento al terminar, sacudirse con un error,
       ojos de corazon con el cariño, «z» al dormir... Pero NADA de su
       personaje (Mochi) ni de sus dibujos: su licencia de recursos lo
       reserva. Todo esto es el blob de coffeeIA con su motor, y las piezas
       --insignias, corazones, estrellas, gotas-- estan dibujadas aqui.

       Cada uno dura una vuelta corta (1, 1.5 o 3 s) y se ve una vez cuando
       pasa lo que lo dispara. Las piezas siguen la regla de la utileria: la
       lista siempre del mismo largo y la pieza i siempre el mismo dibujo. */

    var PC = { trabaja: '#3B9EFF', piensa: '#8B5CF6', busca: '#6366F1', permiso: '#F5A524', pregunta: '#22D3EE',
               error: '#F4505E', listo: '#34D399', limite: '#FB923C', duerme: '#94A3B8', mareo: '#F472B6',
               amor: '#FF4D6D', orgullo: '#F7B32B' };

    function rebote(x) {
        x = clamp(x, 0, 1);
        var c1 = 1.70158, c3 = c1 + 1;
        return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
    }
    function ondaEn(u, a, b, n) {
        if (u < a || u >= b) return 0;
        return Math.sin(Math.PI * 2 * n * (u - a) / (b - a));
    }
    /*  La coronilla, siguiendo el cuerpo: las insignias van encima. */
    function coronilla(mov) {
        return { x: CX + (mov.dx || 0), y: CY - 94 * (2 * (mov.sy || 1) - 1) + (mov.dy || 0) };
    }

    function pildora(col) {
        return '<rect x="-17" y="-9" width="34" height="18" rx="9" fill="' + col + '"/>';
    }
    var PUNTO_P = '<circle r="2.8" fill="#FFFFFF"/>';
    function insignia(col, glifo) { return '<circle r="10" fill="' + col + '"/>' + glifo; }
    var EXCLAMA = '<path d="M0 -5V1.2" stroke="#FFFFFF" stroke-width="2.8" stroke-linecap="round"/><circle cy="5" r="1.6" fill="#FFFFFF"/>';
    var PREGUNTA = '<path d="M-3 -2.6C-3 -6 3.2 -6.2 3.2 -2.6C3.2 -0.4 0 0 0 2.4" fill="none" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round"/><circle cy="5.6" r="1.5" fill="#FFFFFF"/>';
    function puntoB(col) { return '<circle r="6.5" fill="' + col + '" stroke="#FFFFFF" stroke-width="2.2"/>'; }
    function corazonP(col) {
        return '<path d="M0 8C-3 5.5 -10 1 -10 -4C-10 -8 -6.5 -10 -4 -9C-2 -8.4 -0.8 -7 0 -5.4C0.8 -7 2 -8.4 4 -9C6.5 -10 10 -8 10 -4C10 1 3 5.5 0 8Z" fill="' + col + '"/>';
    }
    function estrella5(col) {
        var d = '';
        for (var i = 0; i < 10; i++) {
            var a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 4.2 : 10;
            d += (i ? 'L' : 'M') + (r * Math.cos(a)).toFixed(1) + ' ' + (r * Math.sin(a)).toFixed(1);
        }
        return '<path d="' + d + 'Z" fill="' + col + '" stroke="' + col + '" stroke-width="1.5" stroke-linejoin="round"/>';
    }
    var ZETA = '<path d="M-5 -5H5L-5 5H5" fill="none" stroke="#94A3B8" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>';
    var GOTA = '<path d="M0 -8C3 -3 5.5 0.5 5.5 3.5A5.5 5.5 0 0 1 -5.5 3.5C-5.5 0.5 -3 -3 0 -8Z" fill="#7DC4F5"/>'
             + '<path d="M-2.4 2.5A2.4 2.4 0 0 0 -0.6 5" fill="none" stroke="#FFFFFF" stroke-width="1.3" stroke-linecap="round" opacity=".8"/>';
    var ENOJO = '<path d="M-8 -2.5C-4.5 -3 -3 -4.5 -2.5 -8M2.5 -8C3 -4.5 4.5 -3 8 -2.5M8 2.5C4.5 3 3 4.5 2.5 8M-2.5 8C-3 4.5 -4.5 3 -8 2.5" fill="none" stroke="' + ERP.rojo + '" stroke-width="2.8" stroke-linecap="round"/>';
    var IMPACTO = '<path d="M0 -10V-4M7.5 -7L4 -2.5M-7.5 -7L-4 -2.5" fill="none" stroke="' + ERP.ambar + '" stroke-width="2.8" stroke-linecap="round"/>';
    var AVION = '<path d="M-11 1L12 -9L4 11L1 3Z" fill="#3B8FF0" stroke="#3B8FF0" stroke-width="1.5" stroke-linejoin="round"/>'
              + '<path d="M1 3L12 -9" stroke="#FFFFFF" stroke-width="1.3" stroke-linecap="round"/>';
    var DOC = '<rect x="-10" y="-13" width="20" height="26" rx="3" fill="#FFFFFF" stroke="#C4CCD8" stroke-width="1.8"/>'
            + '<path d="M-5.5 -6H5.5M-5.5 -1H5.5M-5.5 4H2" stroke="#9AA6B8" stroke-width="1.8" stroke-linecap="round"/>';
    var VENTANA = '<rect x="-18" y="-12" width="36" height="24" rx="3.5" fill="#FFFFFF" stroke="#C4CCD8" stroke-width="1.8"/>'
                + '<path d="M-18 -6H18" stroke="#E4E8EE" stroke-width="1.6"/>'
                + '<circle cx="-13.5" cy="-9" r="1.4" fill="#F4505E"/><circle cx="-9.5" cy="-9" r="1.4" fill="#F5A524"/><circle cx="-5.5" cy="-9" r="1.4" fill="#34D399"/>'
                + '<path d="M-12 -1H8M-12 4H3" stroke="#D5DBE4" stroke-width="1.8" stroke-linecap="round"/>';
    var BARRA_F = '<rect x="-46" y="-4" width="92" height="8" rx="4" fill="#E4E8EE"/>';
    var BARRA_S = '<rect x="-4.2" y="-4" width="8.4" height="8" rx="2" fill="' + PC.listo + '"/>';

    function pNada() { return []; }

    /*  Tres puntos que botan por turnos dentro de una pildora: trabaja,
        piensa y busca, cada uno de su color. */
    function puntosUtil(u, mov, col, x, y, op) {
        var v = [pieza(pildora(col), x, y, 0, 1, op)];
        for (var i = 0; i < 3; i++) {
            var b = Math.max(0, Math.sin(Math.PI * 2 * (u * 2 - i * 0.16)));
            v.push(pieza(PUNTO_P, x + (i - 1) * 9, y - 3 * b, 0, 1, op));
        }
        return v;
    }
    function insigniaSobre(mov, dx, dy) {
        var c = coronilla(mov);
        return { x: c.x + (dx == null ? 58 : dx), y: c.y + (dy == null ? 22 : dy) };
    }

    /* ── Ventana ── */
    function pAsoma(u) {
        var sube = rebote(u / 0.32), hola = entra(u, 0.34, 0.42, 0.78, 0.9);
        return { dy: 95 * (1 - sube), roll: 9 * ondaEn(u, 0.34, 0.9, 2) * hola,
                 ojoEsc: 1 + 0.12 * entra(u, 0.25, 0.32, 0.5, 0.6) };
    }
    function pAsomaUtil(u, r, mov) {
        var c = coronilla(mov), a = entra(u, 0.36, 0.44, 0.8, 0.95);
        return [pieza(estrella4(ERP.ambar), c.x + 66, c.y + 30, 0, 1.3, a * Math.max(0, Math.sin(Math.PI * 2 * u * 2)))];
    }
    function pAbre(u) {
        var s = Math.sin(Math.PI * clamp((u - 0.1) / 0.45, 0, 1));
        return { cierra: entra(u, 0.02, 0.07, 0.09, 0.16), sx: 1 + 0.07 * s, sy: 1 + 0.07 * s, ojoEsc: 1 + 0.12 * s };
    }
    function pCierra(u) {
        var q = entra(u, 0.05, 0.3, 0.55, 0.9);
        return { sy: 1 - 0.12 * q, sx: 1 + 0.07 * q, cierra: 0.8 * q, pitch: -5 * q };
    }
    function pEncima(u) {
        var b = Math.sin(Math.PI * clamp(u / 0.35, 0, 1));
        return { dy: -7 * b, sy: 1 + 0.03 * b, ojoEsc: 1 + 0.1 * entra(u, 0.05, 0.2, 0.6, 0.9) };
    }
    function pSaluda(u) {
        var a = entra(u, 0.02, 0.12, 0.8, 0.95);
        return { roll: 10 * ondaEn(u, 0.08, 0.8, 3) * a, dy: -5 * a, ojos: a > 0.5 ? 'feliz' : null };
    }
    function pSaludaUtil(u, r, mov) {
        var c = coronilla(mov), a = entra(u, 0.08, 0.16, 0.8, 0.95);
        return [[-64, 26, 0], [70, 16, 0.33], [58, 70, 0.66]].map(function (e) {
            return pieza(estrella4(ERP.ambar), c.x + e[0], c.y + e[1], 0, 1.4,
                         a * Math.max(0, Math.sin(Math.PI * 2 * (u * 2 - e[2]))));
        });
    }
    function pAviso(u) {
        return { pitch: -4 * Math.sin(Math.PI * clamp((u - 0.05) / 0.3, 0, 1)) };
    }
    function pAvisoUtil(u, r, mov) {
        var p = insigniaSobre(mov, 60, 26);
        return [pieza(puntoB(ERP.azul), p.x, p.y, 0, rebote((u - 0.05) / 0.25), entra(u, 0.05, 0.1, 0.8, 0.97))];
    }

    /* ── Trabajo ── */
    function pTrabaja(u) {
        return { dy: -2 * Math.sin(Math.PI * 4 * u), pitch: -5 * entra(u, 0, 0.12, 0.88, 1) };
    }
    function pTrabajaUtil(u, r, mov) {
        var p = insigniaSobre(mov, 0, -24);
        return puntosUtil(u, mov, PC.trabaja, p.x, p.y, entra(u, 0, 0.08, 0.9, 1));
    }
    function pPiensa(u) {
        var a = entra(u, 0.02, 0.2, 0.82, 0.98);
        return { yaw: 16 * a, pitch: 15 * a };
    }
    function pPiensaUtil(u, r, mov) {
        var p = insigniaSobre(mov, 44, -18);
        return puntosUtil(u, mov, PC.piensa, p.x, p.y, entra(u, 0, 0.1, 0.9, 1));
    }
    function pBusca(u) {
        return { yaw: 26 * Math.sin(Math.PI * 2 * u) * entra(u, 0, 0.05, 0.95, 1) };
    }
    function pBuscaUtil(u, r, mov) {
        var p = insigniaSobre(mov, 0, -24);
        return puntosUtil(u, mov, PC.busca, p.x, p.y, entra(u, 0, 0.08, 0.9, 1));
    }
    function pPermiso(u) {
        var gp = golpes(u, 0.05, 0.8, 3).g;
        return { dy: -12 * gp, sy: 1 + 0.05 * gp, sx: 1 - 0.04 * gp, ojoEsc: 1 + 0.22 * entra(u, 0, 0.06, 0.88, 1) };
    }
    function pPermisoUtil(u, r, mov) {
        var p = insigniaSobre(mov), a = entra(u, 0, 0.08, 0.9, 1);
        return [pieza(insignia(PC.permiso, EXCLAMA), p.x, p.y, 0, 1.2 + 0.12 * Math.max(0, Math.sin(Math.PI * 2 * u * 3)), a)];
    }
    function pPregunta(u) {
        var a = entra(u, 0.04, 0.2, 0.82, 0.97);
        return { roll: 11 * a, yaw: -6 * a, pitch: 3 * a };
    }
    function pPreguntaUtil(u, r, mov) {
        var p = insigniaSobre(mov), a = entra(u, 0.1, 0.2, 0.88, 1);
        return [pieza(insignia(PC.pregunta, PREGUNTA), p.x, p.y, -8 * a, 1.2 * rebote((u - 0.1) / 0.2), a)];
    }
    function pListo(u) {
        var x = clamp((u - 0.06) / 0.62, 0, 1);
        return { vuelta: 360 * suave(x), dy: -16 * Math.sin(Math.PI * x), sy: 1 + 0.04 * Math.sin(Math.PI * x),
                 ojos: u > 0.66 ? 'feliz' : null };
    }
    var BRILLO_ANG = [0, 60, 120, 180, 240, 300];
    function pListoUtil(u, r, mov) {
        var t = clamp((u - 0.64) / 0.3, 0, 1), vive = u >= 0.64 && u < 0.97;
        var v = BRILLO_ANG.map(function (g, i) {
            var a = rad(g - 90), d = 70 + 50 * t;
            return pieza(estrella4(i % 2 ? PC.listo : ERP.ambar), CX + mov.dx + Math.cos(a) * d, CY + mov.dy + Math.sin(a) * d, 90 * t, 1.5 - 0.6 * t,
                         vive ? Math.min(1, t * 6) * (1 - tramo(t, 0.6, 1)) : 0);
        });
        var p = insigniaSobre(mov);
        v.push(pieza(puntoB(PC.listo), p.x, p.y, 0, 1, entra(u, 0.66, 0.72, 0.95, 1)));
        return v;
    }
    function pError(u) {
        return { dx: 9 * ondaEn(u, 0, 0.45, 6) * (1 - tramo(u, 0.15, 0.45)), cierra: 0.75 * entra(u, 0.02, 0.08, 0.86, 0.97),
                 roll: -3 * entra(u, 0.05, 0.15, 0.85, 0.97) };
    }
    function pErrorUtil(u, r, mov) {
        var p = insigniaSobre(mov);
        return [pieza(puntoB(PC.error), p.x, p.y, 0, rebote((u - 0.02) / 0.2), entra(u, 0.02, 0.06, 0.9, 1))];
    }
    function pLimite(u) {
        var a = entra(u, 0.02, 0.15, 0.85, 0.98);
        return { cierra: 0.55 * a, dy: 3 * a, sy: 1 - 0.03 * a, pitch: -6 * a };
    }
    function pLimiteUtil(u, r, mov) {
        var c = coronilla(mov), a = entra(u, 0.05, 0.15, 0.85, 0.98);
        var v = [0, 0.5].map(function (f, i) {
            var t = ((u * 2 - f) % 1 + 1) % 1;
            return pieza(GOTA, c.x + (i ? -70 : 72), c.y + 40 + 40 * t, 0, 1.3, a * Math.sin(Math.PI * t));
        });
        var p = insigniaSobre(mov);
        v.push(pieza(puntoB(PC.limite), p.x, p.y, 0, 1, a));
        return v;
    }

    /* ── Acciones ── */
    function pAprueba(u) {
        return { pitch: -10 * Math.sin(Math.PI * clamp((u - 0.05) / 0.3, 0, 1)), ojos: u > 0.1 && u < 0.85 ? 'feliz' : null };
    }
    function pApruebaUtil(u, r, mov) {
        var c = coronilla(mov);
        return [pieza(PALOMITA, c.x, c.y - 26, 0, 1.4 * rebote((u - 0.08) / 0.3), entra(u, 0.08, 0.14, 0.82, 0.97))];
    }
    function pEnvia(u) {
        var q = entra(u, 0.05, 0.2, 0.3, 0.55);
        return { pitch: -7 * q, dy: 3 * q, yaw: 8 * entra(u, 0.25, 0.4, 0.7, 0.9) };
    }
    function pEnviaUtil(u, r, mov) {
        var t = clamp((u - 0.22) / 0.6, 0, 1);
        return [pieza(AVION, CX + 60 + 90 * t, CY + 10 - 130 * t + 30 * t * (1 - t), -15 - 10 * t, 1.6 - 0.4 * t,
                      u >= 0.2 && u < 0.85 ? Math.min(1, t * 8) * (1 - tramo(t, 0.7, 1)) : 0)];
    }
    function pAdjunta(u) {
        var mira = entra(u, 0.05, 0.2, 0.75, 0.9);
        return { yaw: 16 * mira, pitch: -3 * mira, dy: -4 * Math.sin(Math.PI * clamp((u - 0.45) / 0.12, 0, 1)) };
    }
    function pAdjuntaUtil(u, r, mov) {
        var x = lerp(CX + 170, CX + 96, rebote((u - 0.1) / 0.35)), pega = Math.sin(Math.PI * clamp((u - 0.45) / 0.12, 0, 1));
        return [pieza(VENTANA, x, CY + 30, -6, 1.5 + 0.2 * pega, entra(u, 0.1, 0.18, 0.86, 0.97)),
                pieza(PALOMITA, x + 22, CY + 12, 0, 0.8 * rebote((u - 0.5) / 0.2), entra(u, 0.5, 0.55, 0.86, 0.97))];
    }
    function pTraga(u) {
        var cae = entra(u, 0.02, 0.1, 0.3, 0.36), g = Math.sin(Math.PI * clamp((u - 0.36) / 0.18, 0, 1));
        var sale = Math.sin(Math.PI * clamp((u - 0.55) / 0.15, 0, 1));
        return { pitch: 12 * cae, ojoEsc: 1 + 0.15 * cae, sy: 1 - 0.1 * g + 0.05 * sale, sx: 1 + 0.07 * g - 0.03 * sale,
                 cierra: 0.85 * entra(u, 0.34, 0.38, 0.5, 0.56), ojos: u > 0.6 && u < 0.92 ? 'feliz' : null };
    }
    function pTragaUtil(u, r, mov) {
        var c = coronilla(mov), t = clamp((u - 0.04) / 0.3, 0, 1), m = clamp((u - 0.34) / 0.14, 0, 1);
        var y = lerp(c.y - 110, c.y - 36, t * t) + 30 * m;
        return [pieza(DOC, c.x, y, 12 * (1 - t), 1.6 * (1 - m), u >= 0.04 && u < 0.5 ? Math.min(1, t * 6) : 0)];
    }
    function pAvance(u) {
        return { pitch: -9 * entra(u, 0, 0.1, 0.88, 1) };
    }
    function pAvanceUtil(u, r, mov) {
        var y = CY + 118 + mov.dy, a = entra(u, 0, 0.06, 0.9, 1);
        var v = [pieza(BARRA_F, CX + mov.dx, y, 0, 1, a)];
        for (var i = 0; i < 10; i++) {
            v.push(pieza(BARRA_S, CX + mov.dx - 40.5 + i * 9, y, 0, 1, a * (u >= 0.06 + i * 0.075 ? 1 : 0)));
        }
        return v;
    }

    /*  CARGANDO: coffeeIA ES el cursor de la barra. El mismo coffeeIA --con
        sus ojos en proporcion, sin rodar ni deformarse--, en chico, avanza de
        izquierda a derecha DENTRO de la barra y lo que deja atras se llena;
        al llegar da un brinco.

        La barra va DETRAS del cuerpo (`detras` en las piezas): el muñeco
        pasa por delante sin dejar hueco. El fondo de la barra es un verde
        claro, no blanco; lo lleno, el verde de «terminado». */
    var CARGA = { x0: CX - 124, x1: CX + 124, n: 28, esc: 0.235, alto: 26 };
    var CARGA_Y = CY + 94 - 94 * CARGA.esc;     // el centro del cuerpo encogido
    var CARGA_PASO = (CARGA.x1 - CARGA.x0 - 2 * CARGA.alto) / CARGA.n;
    var CARGA_W = (CARGA_PASO + 2).toFixed(2);
    var CARGA_FONDO = '#BFEBD6';
    var CARGA_PISTA = '<rect x="' + (CARGA.x0 - CX) + '" y="' + (-CARGA.alto) + '" width="' + (CARGA.x1 - CARGA.x0) + '" height="' + (2 * CARGA.alto)
                    + '" rx="' + CARGA.alto + '" fill="' + CARGA_FONDO + '"/>';
    var CARGA_LLENO = '<rect x="' + (-CARGA_W / 2) + '" y="' + (-CARGA.alto) + '" width="' + CARGA_W + '" height="' + (2 * CARGA.alto) + '" fill="' + PC.listo + '"/>';
    function cargaTapa(lado) {
        var a = CARGA.alto;
        return lado < 0 ? '<path d="M1 ' + (-a) + 'H0A' + a + ' ' + a + ' 0 0 0 0 ' + a + 'H1Z" fill="' + PC.listo + '"/>'
                        : '<path d="M-1 ' + (-a) + 'H0A' + a + ' ' + a + ' 0 0 1 0 ' + a + 'H-1Z" fill="' + PC.listo + '"/>';
    }
    var CARGA_TAPA_I = cargaTapa(-1), CARGA_TAPA_D = cargaTapa(1);
    function cargaK(u) {
        var p = suave(clamp((u - 0.06) / 0.72, 0, 1));
        return { p: p, x: lerp(CARGA.x0 + CARGA.alto, CARGA.x1 - CARGA.alto, p), fin: entra(u, 0.8, 0.86, 0.94, 1) };
    }
    function pCarga(u) {
        var k = cargaK(u), paso = Math.abs(Math.sin(Math.PI * 8 * k.p)) * (1 - k.fin);
        return { sx: CARGA.esc, sy: CARGA.esc, ojoEsc: CARGA.esc,
                 dx: k.x - CX, dy: -9 * Math.sin(Math.PI * k.fin) - 3 * paso };
    }
    function pCargaUtil(u, r, mov) {
        var k = cargaK(u), y = CARGA_Y, lleno = u > 0.8, v = [];
        var vivo = entra(u, 0, 0.04, 0.96, 1);
        var xi = CARGA.x0 + CARGA.alto, xd = CARGA.x1 - CARGA.alto;
        function atras(p) { p.detras = true; return p; }
        v.push(atras(pieza(CARGA_PISTA, CX, y, 0, 1, vivo)));
        v.push(atras(pieza(CARGA_TAPA_I, xi, y, 0, 1, vivo)));
        for (var i = 0; i < CARGA.n; i++) {
            var x = xi + CARGA_PASO * (i + 0.5);
            v.push(atras(pieza(CARGA_LLENO, x, y, 0, 1, vivo * (x - CARGA_PASO / 2 < k.x || lleno ? 1 : 0))));
        }
        v.push(atras(pieza(CARGA_TAPA_D, xd, y, 0, 1, vivo * (lleno ? 1 : 0))));
        return v;
    }

    /* ── Personalidad ── */
    function pAmor(u) {
        var s = Math.sin(Math.PI * 4 * u);
        return { ojos: 'corazon', ojoEsc: 1 + 0.12 * s, sx: 1 + 0.03 * s, sy: 1 - 0.02 * s };
    }
    function pAmorUtil(u, r, mov) {
        var c = coronilla(mov);
        return [[-50, 0], [48, 0.33], [8, 0.66]].map(function (e) {
            var t = ((u * 1 + e[1]) % 1 + 1) % 1;
            return pieza(corazonP(PC.amor), c.x + e[0] + 8 * Math.sin(Math.PI * 2 * t), c.y + 20 - 70 * t, 0, 1.1 + 0.4 * t,
                         Math.sin(Math.PI * t) * entra(u, 0, 0.05, 0.92, 1));
        });
    }
    function pSorpresa(u) {
        var s = Math.sin(Math.PI * clamp(u / 0.45, 0, 1));
        return { dy: -20 * s, sy: 1 + 0.08 * s, sx: 1 - 0.06 * s, ojoEsc: 1 + 0.35 * entra(u, 0, 0.08, 0.6, 0.85) };
    }
    function pSorpresaUtil(u, r, mov) {
        var c = coronilla(mov);
        return [pieza(IMPACTO, c.x, c.y - 12, 0, 1.6, entra(u, 0.02, 0.08, 0.45, 0.65))];
    }
    function pOrgullo(u) {
        var a = entra(u, 0.03, 0.18, 0.85, 0.98);
        return { ojos: 'estrella', pitch: 13 * a, roll: 4 * a, sy: 1 + 0.03 * a, giro: 0 };
    }
    function pOrgulloUtil(u, r, mov) {
        var c = coronilla(mov);
        return [[-58, 0], [56, 0.4], [-6, 0.7]].map(function (e) {
            var t = ((u * 1.3 + e[1]) % 1 + 1) % 1;
            return pieza(estrella5(PC.orgullo), c.x + e[0], c.y + 30 - 60 * t, 120 * t, 0.9 + 0.3 * t,
                         Math.sin(Math.PI * t) * entra(u, 0, 0.06, 0.9, 1));
        });
    }
    function pGuino(u) {
        var a = entra(u, 0.1, 0.2, 0.6, 0.75);
        return { guino: a, roll: 8 * a, yaw: -5 * a };
    }
    function pGuinoUtil(u, r, mov) {
        var c = coronilla(mov), a = entra(u, 0.16, 0.24, 0.56, 0.7);
        return [pieza(estrella4(ERP.ambar), c.x + 58, c.y + 44, 0, 1.3, a)];
    }
    function pToque(u) {
        var d = u < 0.03 ? 0 : Math.sin(Math.PI * 2 * 3 * (u - 0.03)) * Math.exp(-5 * (u - 0.03));
        return { sx: 1 + 0.14 * d, sy: 1 - 0.12 * d, dx: 6 * d, cierra: 0.7 * entra(u, 0.02, 0.05, 0.2, 0.35) };
    }
    function pToqueUtil(u, r, mov) {
        return [pieza(IMPACTO, CX - 96 + mov.dx, CY - 20, -70, 1.6, entra(u, 0.02, 0.05, 0.25, 0.42))];
    }
    function pMolesto(u) {
        var a = entra(u, 0.02, 0.12, 0.85, 0.98);
        return { dx: 3 * ondaEn(u, 0, 0.5, 8) * entra(u, 0, 0.08, 0.35, 0.5), cierra: 0.45 * a, yaw: -9 * a, pitch: -4 * a };
    }
    function pMolestoUtil(u, r, mov) {
        var c = coronilla(mov);
        return [pieza(ENOJO, c.x + 52, c.y + 16, 0, 1.3 + 0.2 * Math.max(0, Math.sin(Math.PI * 2 * u * 3)), entra(u, 0.05, 0.12, 0.88, 1))];
    }
    function pMareo(u) {
        var x = clamp(u / 0.86, 0, 1);
        return { vuelta: 720 * suave(x), ojos: 'espiral', giro: 540 * u, roll: 8 * Math.sin(Math.PI * 2 * 2 * u),
                 dy: -8 * Math.sin(Math.PI * x) };
    }
    function pMareoUtil(u, r, mov) {
        var c = coronilla(mov), a = entra(u, 0.5, 0.62, 0.92, 1);
        return [0, 1, 2].map(function (i) {
            var ang = Math.PI * 2 * (u * 2 + i / 3);
            return pieza(estrella5(PC.mareo), c.x + 42 * Math.cos(ang), c.y - 6 + 12 * Math.sin(ang), 0, 0.8, a * (0.6 + 0.4 * (Math.sin(ang) + 1) / 2));
        });
    }
    function pBosteza(u) {
        var e = entra(u, 0.05, 0.25, 0.45, 0.65);
        return { sy: 1 + 0.12 * e, sx: 1 - 0.07 * e, dy: -6 * e, pitch: 9 * e,
                 cierra: Math.min(1, 0.6 * e + tramo(u, 0.55, 0.85)) };
    }
    function pBostezaUtil(u, r, mov) {
        var c = coronilla(mov), t = clamp((u - 0.7) / 0.28, 0, 1);
        return [pieza(ZETA, c.x + 56 + 10 * t, c.y + 10 - 26 * t, 0, 1 + 0.4 * t, u >= 0.7 ? Math.sin(Math.PI * t) : 0)];
    }
    function pDuerme(u) {
        return { cierra: 1, sy: 1 + 0.025 * Math.sin(Math.PI * 2 * u), dy: 3, pitch: -6 };
    }
    function pDuermeUtil(u, r, mov) {
        var c = coronilla(mov);
        return [0, 1, 2].map(function (i) {
            var t = ((u * 1.5 - i / 3) % 1 + 1) % 1;
            return pieza(ZETA, c.x + 50 + 18 * t, c.y + 14 - 50 * t, 0, 0.9 + 0.6 * t, Math.sin(Math.PI * t));
        });
    }

    /* ── BARISTA (6 s) ────────────────────────────────────────────────────── */
    var CAFETERA = '<rect x="-26" y="-42" width="52" height="72" rx="7" fill="#3A4250"/>'
                 + '<rect x="-26" y="-42" width="52" height="10" rx="5" fill="#4B5563"/>'
                 + '<circle cx="15" cy="-22" r="4.5" fill="#8B95A5"/><circle cx="15" cy="-22" r="1.6" fill="' + ERP.verde + '"/>'
                 + '<rect x="-12" y="-20" width="20" height="7" rx="2" fill="#8B95A5"/>'
                 + '<rect x="-4" y="-13" width="4" height="4" fill="#8B95A5"/>'
                 + '<rect x="-24" y="28" width="48" height="6" rx="2" fill="#8B95A5"/>';
    var TAZA_B = '<path d="M-12 8H8L6 26C6 27.1 5.1 28 4 28H-8C-9.1 28 -10 27.1 -10 26Z" fill="#FFFFFF" stroke="' + ERP.filo + '" stroke-width="1.5"/>'
               + '<path d="M8 12C13 12 14 20 7 21" fill="none" stroke="#FFFFFF" stroke-width="2.4"/>';
    var CHORRO = '<path d="M-2 -9V10" stroke="#6B4A33" stroke-width="2.4" stroke-linecap="round"/>';
    var NIVELES = [[26, 7], [22, 8], [18, 9], [14, 9.6], [10, 10]].map(function (n) {
        return '<rect x="' + (-2 - n[1]) + '" y="' + (n[0] - 4) + '" width="' + (2 * n[1]) + '" height="4.2" fill="#6B4A33"/>';
    });
    var ARTE = '<ellipse cx="-2" cy="9" rx="9.5" ry="2.6" fill="#C69C6D"/>'
             + '<path d="M-2 10.5C-4.5 8.6 -5.5 7.6 -4.4 6.9C-3.5 6.4 -2.6 7 -2 7.8C-1.4 7 -0.5 6.4 0.4 6.9C1.5 7.6 0.5 8.6 -2 10.5Z" fill="#FFFFFF"/>';
    var VAPOR_B = '<path d="M0 0C-3 -4 3 -7 0 -11" fill="none" stroke="' + ERP.gris + '" stroke-width="2" stroke-linecap="round"/>';
    function baristaK(u) {
        return { a: entra(u, 0.06, 0.16, 0.86, 0.95), chorro: entra(u, 0.24, 0.27, 0.58, 0.61), llena: clamp((u - 0.27) / 0.32, 0, 1),
                 arte: tramo(u, 0.62, 0.67), vapor: entra(u, 0.64, 0.70, 0.84, 0.90), ok: entra(u, 0.68, 0.72, 0.78, 0.84) };
    }
    function baristaCuerpo(u) {
        var k = baristaK(u);
        return { yaw: 12 * k.a, pitch: -6 * k.a + 4 * k.ok, dy: 1.5 * k.a - 2 * k.ok };
    }
    function baristaUtil(u) {
        var k = baristaK(u), x = CX + 96, y = CY + 32 + 12 * (1 - k.a), e = 1.5;
        var v = [pieza(CAFETERA, x, y, 0, e, k.a), pieza(TAZA_B, x, y, 0, e, k.a), pieza(CHORRO, x, y, 0, e, k.a * k.chorro)];
        NIVELES.forEach(function (n, i) { v.push(pieza(n, x, y, 0, e, k.a * clamp(k.llena * NIVELES.length - i, 0, 1))); });
        v.push(pieza(ARTE, x, y, 0, e, k.a * k.arte));
        [[-6, 0], [2, 0.5]].forEach(function (w) {
            var f = ((u * 3 + w[1]) % 1);
            v.push(pieza(VAPOR_B, x + e * w[0], y + e * (4 - 10 * f), 0, e, k.vapor * Math.sin(Math.PI * f)));
        });
        return v;
    }

    /* ── CAJA (6 s) ───────────────────────────────────────────────────────── */
    var CAJA_REG = '<path d="M-30 -8H30L34 26H-34Z" fill="#3A4250"/>'
                 + '<path d="M-22 -34H22L26 -10H-26Z" fill="#4B5563"/>'
                 + '<path d="M-17 -30H17L19.5 -16H-19.5Z" fill="#D9F2E6"/>'
                 + '<path d="M-22 0H-10M-4 0H8M14 0H24M-24 9H-12M-6 9H6M12 9H26" stroke="#8B95A5" stroke-width="4" stroke-linecap="round"/>';
    var CAJON = '<rect x="-36" y="0" width="72" height="12" rx="2" fill="#2F3A4A"/>'
              + '<rect x="-26" y="2" width="16" height="6" rx="1" fill="' + ERP.verde + '"/>'
              + '<rect x="-6" y="2" width="16" height="6" rx="1" fill="' + ERP.verde + '"/>'
              + '<circle cx="20" cy="5" r="3" fill="#F2C94C"/><circle cx="27" cy="5" r="3" fill="#F2C94C"/>'
              + '<rect x="-6" y="-1" width="12" height="3" rx="1.5" fill="#8B95A5"/>';
    var MONEDA = '<circle r="7" fill="#F2C94C" stroke="#C99A1E" stroke-width="1.5"/>'
               + '<path d="M0 -4.5V4.5M2.4 -2.4H-0.8C-2.6 -2.4 -2.6 0 -0.8 0H0.8C2.6 0 2.6 2.4 0.8 2.4H-2.4" fill="none" stroke="#9A7412" stroke-width="1.4" stroke-linecap="round"/>';
    var DIGITO = function (i) { return '<rect x="' + (8 - 7 * i) + '" y="-27" width="4" height="8" rx="1" fill="#1F4D3A"/>'; };
    function cajaK(u) {
        return { a: entra(u, 0.06, 0.16, 0.86, 0.95), cifra: clamp((u - 0.22) / 0.20, 0, 1), abre: entra(u, 0.48, 0.54, 0.76, 0.82),
                 moneda: clamp((u - 0.52) / 0.18, 0, 1), ok: entra(u, 0.68, 0.72, 0.80, 0.86) };
    }
    function cajaCuerpo(u) {
        var k = cajaK(u), brinca = (u >= 0.52 && u < 0.62) ? Math.sin((u - 0.52) / 0.10 * Math.PI) : 0;
        return { yaw: 12 * k.a, pitch: -5 * k.a + 4 * k.ok, dy: 1.5 * k.a - 6 * brinca, sy: 1 + 0.03 * brinca };
    }
    function cajaUtil(u) {
        var k = cajaK(u), x = CX + 92, y = CY + 44 + 12 * (1 - k.a), e = 1.3;
        var v = [pieza(CAJON, x, y + e * (18 + 10 * k.abre), 0, e, k.a), pieza(CAJA_REG, x, y, 0, e, k.a)];
        for (var i = 0; i < 4; i++) v.push(pieza(DIGITO(i), x, y, 0, e, k.a * clamp(k.cifra * 4 - i, 0, 1)));
        var m = k.moneda, vive = u >= 0.52 && u < 0.70;
        v.push(pieza(MONEDA, x + 26 * m, y - 10 - 70 * m + 80 * m * m, 360 * m, 1.1, vive ? Math.sin(Math.PI * m) : 0));
        v.push(pieza(PALOMITA, x + 36, y - 40, 0, 0.8 + 0.3 * k.ok, k.ok));
        return v;
    }

    /* ── SIN RESULTADOS (6 s) ─────────────────────────────────────────────── */
    var BUSQUEDA = '<rect x="-36" y="-40" width="72" height="82" rx="7" fill="' + ERP.papel + '" stroke="' + ERP.filo + '" stroke-width="2"/>'
                 + '<rect x="-28" y="-32" width="56" height="12" rx="6" fill="' + ERP.claro + '" stroke="' + ERP.filo + '" stroke-width="1.2"/>'
                 + '<circle cx="-20" cy="-26" r="3" fill="none" stroke="' + ERP.gris + '" stroke-width="1.6"/>'
                 + '<path d="M-10 -26H12" stroke="' + ERP.gris + '" stroke-width="2.4" stroke-linecap="round"/>'
                 + '<rect x="-28" y="-10" width="56" height="12" rx="3" fill="none" stroke="' + ERP.filo + '" stroke-width="1.5" stroke-dasharray="3 3"/>'
                 + '<rect x="-28" y="8" width="56" height="12" rx="3" fill="none" stroke="' + ERP.filo + '" stroke-width="1.5" stroke-dasharray="3 3"/>'
                 + '<rect x="-28" y="26" width="56" height="12" rx="3" fill="none" stroke="' + ERP.filo + '" stroke-width="1.5" stroke-dasharray="3 3"/>';
    var LUPA = '<circle r="9" fill="#FFFFFF" fill-opacity=".7" stroke="' + ERP.tinta + '" stroke-width="3"/>'
             + '<path d="M6.5 6.5L13 13" stroke="' + ERP.tinta + '" stroke-width="3.6" stroke-linecap="round"/>';
    var TACHE = '<path d="M-3.5 -3.5L3.5 3.5M3.5 -3.5L-3.5 3.5" stroke="' + ERP.rojo + '" stroke-width="2.4" stroke-linecap="round"/>';
    function vacioK(u) {
        var busca = u >= 0.22 && u < 0.60 ? (u - 0.22) / 0.38 : (u >= 0.60 ? 1 : 0);
        return { a: entra(u, 0.06, 0.16, 0.86, 0.95), busca: busca, para: tramo(u, 0.60, 0.66), duda: entra(u, 0.62, 0.68, 0.80, 0.88) };
    }
    function vacioCuerpo(u) {
        var k = vacioK(u);
        return { yaw: 10 * k.a - 6 * k.duda, pitch: -5 * k.a + 4 * k.duda, roll: 7 * k.duda, sy: 1 - 0.02 * k.duda };
    }
    function vacioUtil(u) {
        var k = vacioK(u), x = CX + 100, y = CY + 48 + 12 * (1 - k.a), e = 1.2;
        var barre = Math.sin(k.busca * Math.PI * 4) * (1 - k.para);
        var fila = lerp(-4, 32, (1 - Math.cos(k.busca * Math.PI)) / 2) * (1 - k.para) + 14 * k.para;
        var lp = sobre(x, y, 0, e, 16 * barre, fila);
        return [
            pieza(BUSQUEDA, x, y, 0, e, k.a),
            pieza(LUPA, lp[0], lp[1], 0, 1.2, k.a * (u >= 0.18 ? 1 : 0)),
            pieza(TACHE, lp[0], lp[1], 0, 1.2, k.a * k.para)
        ];
    }

    /* ================== VIDEOLLAMADA, APROBANDO Y GUARDANDO (27/09/2026) ==================

       Tres mas para Mientras trabaja, con las mismas reglas: sin manos,
       objetos de interfaz y paleta del ERP.

         videollamada  en la laptop: cuatro en llamada, el marco azul va con
                       quien habla y coffeeIA asiente                   juntas
         aprobando     un sello baja sobre el documento y deja la marca
                       verde de aprobado                                autorizaciones
         guardando     una nube con flecha que sube y una barra que se
                       llena; al terminar, palomita                     guardarDato */

    /* ── VIDEOLLAMADA (6 s): en la laptop, como Llévame y Correo ─────────── */
    var LLAMADA_TILES = [[6, 14], [52, 14], [6, 46], [52, 46]];
    var LLAMADA_COL = ['#2496E8', '#F2A93B', '#2F9E7E', '#E86A9A'];
    var LLAMADA_FIJO = dePantalla(LLAMADA_TILES.map(function (p, i) {
        return '<rect x="' + p[0] + '" y="' + p[1] + '" width="42" height="29" rx="3" fill="#1F2937"/>'
             + '<circle cx="' + (p[0] + 21) + '" cy="' + (p[1] + 12) + '" r="6" fill="' + LLAMADA_COL[i] + '"/>'
             + '<path d="M' + (p[0] + 11) + ' ' + (p[1] + 27) + 'C' + (p[0] + 11) + ' ' + (p[1] + 20) + ' ' + (p[0] + 31) + ' ' + (p[1] + 20)
             + ' ' + (p[0] + 31) + ' ' + (p[1] + 27) + 'Z" fill="' + LLAMADA_COL[i] + '"/>';
    }).join('') + '<rect x="44" y="76.5" width="12" height="3" rx="1.5" fill="' + ERP.rojo + '"/>');
    var LLAMADA_MARCOS = LLAMADA_TILES.map(function (p) {
        return dePantalla('<rect x="' + (p[0] - 1) + '" y="' + (p[1] - 1) + '" width="44" height="31" rx="3.5" fill="none" stroke="' + ERP.azul + '" stroke-width="2"/>');
    });
    /*  Quien habla en cada tramo: 0-3 son los cuatro recuadros. */
    var LLAMADA_TURNOS = [[0.30, 0.42, 1], [0.42, 0.54, 2], [0.54, 0.66, 3], [0.66, 0.80, 1]];
    function videollamadaCuerpo(u) {
        var c = enLaptopCuerpo(u, 0), habla = u >= 0.30 && u < 0.80;
        if (habla) c.pitch += -3 * Math.max(0, Math.sin((u - 0.30) * Math.PI * 2 * 5));
        return c;
    }
    function videollamadaUtil(u) {
        var op = pantallaDe(u), v = [pieza(APP, CX, CY, 0, 1, op), pieza(LLAMADA_FIJO, CX, CY, 0, 1, op)];
        LLAMADA_MARCOS.forEach(function (m, i) {
            var on = 0;
            LLAMADA_TURNOS.forEach(function (t) { if (t[2] === i) on = Math.max(on, entra(u, t[0], t[0] + 0.02, t[1] - 0.02, t[1])); });
            v.push(pieza(m, CX, CY, 0, 1, op * on));
        });
        return v;
    }

    /* ── APROBANDO (6 s) ──────────────────────────────────────────────────── */
    var DOC_FIRMA = '<rect x="-34" y="-42" width="68" height="84" rx="7" fill="' + ERP.papel + '" stroke="' + ERP.filo + '" stroke-width="2"/>'
                  + '<path d="M-24 -28H6" stroke="' + ERP.tinta + '" stroke-width="3.6" stroke-linecap="round"/>'
                  + '<path d="M-24 -16H24M-24 -7H18M-24 2H24M-24 11H10" stroke="' + ERP.gris + '" stroke-width="3" stroke-linecap="round"/>'
                  + '<path d="M-24 32H4" stroke="' + ERP.gris + '" stroke-width="1.5"/>';
    var SELLO = '<rect x="-5.5" y="-30" width="11" height="18" rx="5" fill="#8B5E3C"/>'
              + '<rect x="-15" y="-13" width="30" height="7" rx="2" fill="#4B5563"/>'
              + '<rect x="-13" y="-6" width="26" height="5" rx="1" fill="' + ERP.verde + '"/>';
    var MARCA_OK = '<circle r="14" fill="none" stroke="' + ERP.verde + '" stroke-width="3"/>'
                 + '<circle r="10" fill="none" stroke="' + ERP.verde + '" stroke-width="1.2"/>'
                 + '<path d="M-6 0.5L-1.5 5L7 -4.5" fill="none" stroke="' + ERP.verde + '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>';
    function aprobK(u) {
        return { a: entra(u, 0.06, 0.16, 0.86, 0.95), baja: tramo(u, 0.28, 0.40), sube: tramo(u, 0.44, 0.56),
                 golpe: (u >= 0.39 && u < 0.45) ? Math.sin((u - 0.39) / 0.06 * Math.PI) : 0, marca: tramo(u, 0.40, 0.43) };
    }
    function aprobandoCuerpo(u) {
        var k = aprobK(u);
        return { yaw: 12 * k.a, pitch: -6 * k.a - 2 * k.golpe + 3 * k.marca * (1 - k.sube * 0), dy: 1.5 * k.a + 2.5 * k.golpe };
    }
    function aprobandoUtil(u) {
        var k = aprobK(u), x = CX + 100, y = CY + 48 + 12 * (1 - k.a), e = 1.2;
        var m = sobre(x, y, 0, e, 8, 14);
        var alto = u < 0.44 ? lerp(-70, 0, k.baja) : lerp(0, -70, k.sube);
        var selloOp = k.a * (u < 0.28 ? tramo(u, 0.22, 0.28) : u < 0.44 ? 1 : 1 - k.sube);
        return [
            pieza(DOC_FIRMA, x, y, 0, e, k.a),
            pieza(MARCA_OK, m[0], m[1], -14, e * (1.2 - 0.2 * k.marca), k.a * k.marca),
            pieza(SELLO, m[0], m[1] + alto + 2 * k.golpe, 0, e, selloOp)
        ];
    }

    /* ── GUARDANDO (6 s) ──────────────────────────────────────────────────── */
    var NUBE = '<path d="M-22 10C-30 10 -34 4 -34 -2C-34 -9 -28 -14 -21 -13C-19 -22 -11 -28 -1 -28C10 -28 18 -20 19 -11C27 -11 32 -5 32 1C32 7 27 10 21 10Z" fill="#EAF3FD" stroke="'
             + ERP.azul + '" stroke-width="2.4" stroke-linejoin="round"/>';
    var FLECHA_SUBE = trazo2('M0 6V-10M-6 -4L0 -10L6 -4', ERP.azul, 3);
    var BARRA_N = 8;
    function guardaK(u) {
        return { a: entra(u, 0.06, 0.16, 0.86, 0.95), carga: clamp((u - 0.22) / 0.42, 0, 1), ok: entra(u, 0.66, 0.70, 0.86, 0.95) };
    }
    function guardandoCuerpo(u) {
        var k = guardaK(u);
        return { yaw: 10 * k.a, pitch: 5 * k.a - 3 * k.ok, dy: -1 * k.a - 2 * k.ok };
    }
    function guardandoUtil(u) {
        var k = guardaK(u), x = CX + 92, y = CY - 44 + 10 * (1 - k.a), e = 1.35;
        var sube = ((u * 4) % 1);
        var v = [pieza(NUBE, x, y, 0, e, k.a),
                 pieza(FLECHA_SUBE, x, y + e * (4 - 8 * sube), 0, e, k.a * (1 - k.ok) * (u >= 0.2 ? Math.sin(Math.PI * sube) : 0))];
        for (var i = 0; i < BARRA_N; i++) {
            v.push(pieza('<rect x="-3" y="-2" width="6" height="4" rx="2" fill="' + ERP.azul + '"/>', x + e * (-24.5 + 7 * i), y + e * 20, 0, e,
                         k.a * (0.2 + 0.8 * clamp(k.carga * BARRA_N - i, 0, 1))));
        }
        v.push(pieza(PALOMITA, x, y - 2, 0, 0.9 + 0.3 * k.ok, k.ok));
        return v;
    }

    function dormido(t, r, ciclo) {
        var v = [], per = ciclo ? 3 : 2.7;
        for (var i = 0; i < 3; i++) {
            var f = ((t - i * 0.9) / per % 1 + 1) % 1;
            v.push({
                x: 232 + Math.sin(f * 6) * 9 + i * 4,
                y: 96 - f * 62,
                s: 17 + i * 5,
                op: f < 0.15 ? f / 0.15 : (f > 0.7 ? (1 - f) / 0.3 : 1),
                col: tono(r.color, 0.2)
            });
        }
        return v;
    }

    /*  Deriva con periodos que dividen los 6 segundos del ciclo exportado:
        así el bucle cierra sin salto. La de reposo usa periodos primos entre
        sí a propósito, para no repetirse nunca. */
    function derivaCiclo(t) {
        return {
            yaw:   Math.sin(t * Math.PI * 2 / 6) * 5.5 + Math.sin(t * Math.PI * 2 / 3) * 1.6,
            pitch: Math.sin(t * Math.PI * 2 / 6 + 1.3) * 4.2 + Math.sin(t * Math.PI * 2 / 2 + 0.7) * 1.3,
            roll:  Math.sin(t * Math.PI * 2 / 6 + 3.2) * 2.2
        };
    }

    // ------------------------------------------------------------- montaje
    /*  EL AIRE. Un grupo que encoge el dibujo entero --cuerpo, cara,
        accesorio y su sombra-- alrededor del centro del lienzo, dejando el
        fondo intacto.

        Hace falta porque el encuadre esta al limite: con un sombrero puesto,
        el blob EN REPOSO ya toca el borde de arriba. En cuanto una animacion
        lo levanta, al sombrero se le va la copa fuera del lienzo y lo que
        queda es un ala negra flotando. Encogerlo un 15% da los treinta y
        pico de unidades que necesita el salto.

        Se hace aqui, en el montaje, y no tocando `esc`, porque el tamaño del
        accesorio no cuelga de `esc`: encogiendo el cuerpo por ahi, la cabeza
        menguaria y el sombrero no. Aqui escala el grupo entero y las
        proporciones se mantienen exactas. */
    function aire(e) {
        if (!e) return '';

        /*  Un numero suelto se sigue aceptando --escala contra el centro, que
            es lo que hacia antes-- por si alguien de fuera pasa P.zoom. */
        if (typeof e === 'number') e = { z: e, dx: CX * (1 - e), dy: CY * (1 - e) };

        if (e.z === 1 && !e.dx && !e.dy) return '';

        return '<g transform="translate(' + e.dx.toFixed(2) + ' ' + e.dy.toFixed(2)
             + ') scale(' + e.z + ')">';
    }

    /*  ── PINTAR CON CLASES EN VEZ DE COLORES ──────────────────────────────

        La forja pinta con los colores de la receta: es un taller, ahi el
        color ES lo que se esta eligiendo. La app no: alli el muñeco vive
        dentro de la navbar, tiene que seguir el tema claro/oscuro que el
        usuario tenga puesto y su contorno debe medir 1px de PANTALLA a
        cualquier tamaño --28px en una burbuja, 64 en el lanzador--, que solo
        se consigue con vector-effect en CSS.

        Con `o.clases` el cuerpo y la cara salen con class y sin fill, y el
        fondo no se pinta. Es lo que permite que la app y la forja compartan
        motor sin que ninguna de las dos ceda: mismo dibujo, distinta piel. */
    function pintaPiezas(P) {
        var cl = P.clases || null;
        var s = cl ? '' : '<rect width="' + V + '" height="' + V + '" fill="' + P.fondo + '"/>';
        var zg = aire(P.encaje);
        s += zg;
        /*  Los GRUPOS llevan clase aparte porque son ganchos de animacion
            CSS, no de color: .fx-ojos es de donde tira @keyframes iaPiensa
            para mover la mirada de lado a lado en la burbuja que trabaja, y
            .fx-acc mantiene el accesorio fuera del repintado del encaje. */
        /*  Las piezas del accesorio se reparten en dos tandas: las que caen
            DETRAS del cuerpo se pintan antes que el y las de delante despues.
            Es todo el reparto de profundidad que hace falta, porque el cuerpo
            es opaco y no hay nada entre medias. */
        function accTanda(delante) {
            var s2 = '';
            P.acc.forEach(function (A) {
                if (A.delante !== delante) return;
                s2 += A.t ? '<g transform="' + A.t.mtx + '">' + A.svg + '</g>' : A.svg;
            });
            return s2 ? '<g' + (cl && cl.grupoAcc ? ' class="' + cl.grupoAcc + '"' : '')
                        + '>' + s2 + '</g>' : '';
        }

        s += accTanda(false);

        /*  La utileria que va DETRAS del cuerpo (`detras` en la pieza): la
            barra de Cargando, por la que el muñeco pasa por delante. */
        if (P.util) {
            P.util.forEach(function (it) {
                if (!it.detras || it.op <= 0.01) return;
                s += '<g transform="translate(' + it.x.toFixed(1) + ' ' + it.y.toFixed(1) + ') rotate(' + it.rot.toFixed(1)
                   + ') scale(' + it.s.toFixed(3) + ')" opacity="' + it.op.toFixed(2) + '">' + it.svg + '</g>';
            });
        }

        /*  ── EL CUERPO Y SU RECORTE ───────────────────────────────────────

            El cuerpo lleva id porque su silueta se usa DOS veces mas: para
            la sombra del accesorio y para recortar la cara. Un <use> ahorra
            repetir las 64 curvas.

            POR QUE SE RECORTA LA CARA. Los ojos viven en la esfera de radio
            100 y el cuerpo mide 94 por su radio medio, asi que en las formas
            que se estrechan --el trebol, el canto-- un ojo se sale de la
            silueta. Como son del color del FONDO, lo que se ve no es un ojo
            fuera de sitio sino una mancha clara pegada al borde. Lo mismo
            con los tres puntos de Pensando.

            Anclarlos al contorno los arreglaria y les cambiaria el caracter
            --es una decision tomada, ver `ancla`--, asi que se deja el ojo
            donde esta y se le prohibe pintar fuera del cuerpo. */
        var idC = 'b' + (++UID);
        s += '<path id="' + idC + '" d="' + P.cuerpo + '"'
           + (cl ? ' class="' + cl.cuerpo + '"'
                 : ' fill="' + P.color + '"'
                   + (P.borde ? ' stroke="' + P.borde + '" stroke-width="2"' : ''))
           + '/>'
           + '<clipPath id="r' + idC + '"><use href="#' + idC + '"/></clipPath>';

        var recorte = ' clip-path="url(#r' + idC + ')"';

        /*  La sombra va sobre el cuerpo y debajo de la cara: recortada, solo
            se ve la parte que cae encima del blob. */
        var somAcc = '';
        P.acc.forEach(function (A) {
            if (!A.sombra) return;
            somAcc += A.t ? '<g transform="' + A.t.mtx + '">' + A.sombra + '</g>' : A.sombra;
        });

        if (somAcc) {
            s += '<g' + recorte + ' opacity="' + SOMBRA.op + '">'
               +   '<g transform="translate(' + SOMBRA.x + ' ' + SOMBRA.y + ')">'
               +     somAcc
               +   '</g></g>';
        }

        var cara = '';

        P.puntos.forEach(function (p) {
            cara += '<circle cx="' + p.cx.toFixed(2) + '" cy="' + p.cy.toFixed(2) + '" r="' + p.r.toFixed(2)
                  + (cl ? '" class="' + cl.punto : '" fill="' + P.colOjo)
                  + '" opacity="' + p.op.toFixed(2) + '"/>';
        });

        P.ojos.forEach(function (o) {
            var abre = o.t ? '<g transform="' + o.t.mtx + '">' : '';
            var cierra = o.t ? '</g>' : '';
            cara += abre + '<path d="' + o.d + '"'
                  + (cl ? ' class="' + cl.ojo + '"' : ' stroke="' + P.colOjo + '" fill="none"')
                  + ' stroke-width="' + o.w.toFixed(2)
                  + '" stroke-linecap="round" opacity="' + o.op + '"/>' + cierra;
        });

        if (cara) s += '<g' + (cl && cl.grupoOjos ? ' class="' + cl.grupoOjos + '"' : '')
                     + recorte + '>' + cara + '</g>';

        s += accTanda(true);

        P.zzz.forEach(function (z) {
            s += '<text x="' + z.x.toFixed(1) + '" y="' + z.y.toFixed(1) + '" font-family="system-ui,sans-serif"'
               + ' font-size="' + z.s + '" font-weight="700" fill="' + z.col
               + '" opacity="' + z.op.toFixed(2) + '">z</text>';
        });

        P.notas.forEach(function (n) {
            if (n.op <= 0) return;
            s += '<g transform="translate(' + n.x.toFixed(1) + ' ' + n.y.toFixed(1) + ') rotate(' + n.rot.toFixed(1)
               + ') scale(' + n.s + ') translate(-5 10)" fill="' + n.col + '" opacity="' + n.op.toFixed(2) + '">'
               + NOTA[n.tipo] + '</g>';
        });

        /*  La taza de `cafe`, la ultima: va por delante de la cara y del
            accesorio. El vapor antes que la taza, para que salga de dentro. */
        if (P.taza) {
            var T = P.taza;
            s += '<g transform="translate(' + T.x.toFixed(1) + ' ' + T.y.toFixed(1) + ') rotate('
               + T.rot.toFixed(1) + ') scale(' + T.s + ')">';
            T.vapor.forEach(function (v) {
                if (v.op <= 0.01) return;
                s += '<path d="' + VAPOR + '" transform="translate(' + v.x + ' ' + v.y.toFixed(1) + ')"'
                   + ' fill="none" stroke="' + VAPOR_COL + '" stroke-width="4" stroke-linecap="round"'
                   + ' opacity="' + v.op.toFixed(2) + '"/>';
            });
            s += TAZAS[T.tipo].svg + '</g>';
        }

        /*  La laptop de `programa`: primero los simbolos --salen de detras
            de la tapa-- y la laptop encima de todo. Tuvo una luz de pantalla
            sobre la cara; se quito (29/09/2026). */
        if (P.laptop) {
            var L = P.laptop;
            L.glifos.forEach(function (g) {
                if (g.op <= 0.01) return;
                s += '<path d="' + GLIFO[g.tipo] + '" transform="translate(' + g.x.toFixed(1) + ' ' + g.y.toFixed(1)
                   + ') rotate(' + g.rot.toFixed(1) + ') scale(' + g.s + ')" fill="none" stroke="' + g.col + '" stroke-width="3.2"'
                   + ' stroke-linecap="round" stroke-linejoin="round" opacity="' + g.op.toFixed(2) + '"/>';
            });
            if (L.op > 0.01) {
                s += '<g transform="translate(' + L.x.toFixed(1) + ' ' + L.y.toFixed(1) + ')" opacity="' + L.op.toFixed(2) + '">';
                L.teclas.forEach(function (k) {
                    if (k.op <= 0.01) return;
                    s += '<path d="' + TECLA + '" transform="translate(' + k.x + ' ' + (96 - L.h).toFixed(1) + ')" fill="none"'
                       + ' stroke="' + L.glifos[0].col + '" stroke-width="3.6" stroke-linecap="round" opacity="' + k.op.toFixed(2) + '"/>';
                });
                s +=   '<rect x="' + (-TAPA_W / 2) + '" y="' + (98 - L.h).toFixed(1) + '" width="' + TAPA_W + '" height="' + L.h.toFixed(1) + '" rx="7"'
                   +     ' fill="' + (L.tapa || LAPTOP.tapa) + '" stroke="' + LAPTOP.borde + '" stroke-width="2.5"/>'
                   +   (L.logo > 0.01
                        ? '<g transform="translate(0 ' + (98 - L.h / 2).toFixed(1) + ')" fill="' + LAPTOP.logo + '" stroke="'
                          + LAPTOP.logo + '" opacity="' + L.logo.toFixed(2) + '">' + LOGO_TAZA + '</g>'
                        : '')
                   +   BISAGRA
                   + '</g>';
            }
        }

        /*  La laptop de perfil del programador: el teclado y la tapa encima
            --cerrada se tumba sobre el--. Sin manos: se quitaron de todos los
            movimientos. Sin luz de pantalla en la cara: se quito (29/09/2026). */
        if (P.lado) {
            var Q = P.lado;
            if (Q.op > 0.01) {
                s += '<g transform="translate(' + Q.x.toFixed(1) + ' ' + Q.y.toFixed(1) + ')" opacity="' + Q.op.toFixed(2) + '">'
                   +   TECLADO_LADO
                   +   '<path d="' + Q.alu + '" fill="' + LADO.alu + '" stroke="' + LADO.borde + '" stroke-width="1.5" stroke-linejoin="round"/>'
                   +   '<path d="' + Q.bisel + '" fill="' + LADO.bisel + '" stroke-linejoin="round" opacity="' + Q.biselOp.toFixed(2) + '"/>'
                   +   '<path d="' + Q.pantalla + '" fill="' + LADO.pantalla + '" opacity="' + Q.pantOp.toFixed(2) + '"/>';
                Q.lineas.forEach(function (l) {
                    if (l.op <= 0.01) return;
                    s += '<path d="' + l.d + '" stroke="' + l.col + '" stroke-width="3" stroke-linecap="round" opacity="' + l.op.toFixed(2) + '"/>';
                });
                if (Q.cursor.op > 0.01) {
                    s += '<path d="' + Q.cursor.d + '" stroke="' + LADO.cursor + '" stroke-width="3" stroke-linecap="round" opacity="' + Q.cursor.op.toFixed(2) + '"/>';
                }
                s += '</g>';
            }
        }

        /*  La utileria: cada pieza con su transform, delante de todo. */
        if (P.util) {
            P.util.forEach(function (it) {
                if (it.detras || it.op <= 0.01) return;
                s += '<g transform="translate(' + it.x.toFixed(1) + ' ' + it.y.toFixed(1) + ') rotate(' + it.rot.toFixed(1)
                   + ') scale(' + it.s.toFixed(3) + ')" opacity="' + it.op.toFixed(2) + '">' + it.svg + '</g>';
            });
        }

        return s + (zg ? '</g>' : '');
    }

    function cuadro(rec, t, mira, opciones) {
        return pintaPiezas(piezas(rec, t || 0, mira, opciones));
    }

    /*  El SVG completo. `quieto` congela el cuadro para exportar. */
    function svg(rec, t, mira, opciones) {
        var o = opciones || {};
        var med = o.lado ? ' width="' + o.lado + '" height="' + o.lado + '"' : '';
        return '<svg viewBox="0 0 ' + V + ' ' + V + '"' + med
             + ' xmlns="http://www.w3.org/2000/svg" role="img" aria-label="'
             + String((rec && rec.nombre) || 'avatar').replace(/[<>&"]/g, '') + '">'
             + cuadro(rec, t || 0, mira, o) + '</svg>';
    }

    /* ==================================================================
       EL SVG ANIMADO

       Se muestrea un ciclo de 6 s y cada pieza se convierte en un
       <animate> con la lista de valores. SMIL INTERPOLA entre ellos, así
       que no hacen falta 60 muestras por segundo: basta con que todos los
       cuadros tengan la misma estructura de path --y la tienen, porque el
       contorno siempre son 64 curvas.

       Los tiempos NO son uniformes. El parpadeo dura 0.18 s y con muestreo
       regular se lo salta entero, así que se añaden muestras densas
       alrededor de cada parpadeo y se declaran con keyTimes.
       ================================================================== */
    var CICLO = 6;

    /*  MUESTREO. Cuando decide el motor, no el reloj.

        SMIL interpola RECTO entre dos muestras, asi que la rejilla tiene que
        ser lo bastante fina para el movimiento mas rapido del cuadro. Las 24
        muestras de siempre valen para una cara que respira, y se quedan
        cortas en cuanto hay una animacion encima:

        - una animacion de periodo corto se recorre varias veces dentro de
          los 6 s, y con 24 muestras a `cargando` --que da cinco vueltas--
          le tocan menos de cinco por vuelta: el circulo sale poligono. Por
          eso la rejilla se aprieta hasta 9 muestras POR VUELTA;
        - una animacion con esquinas --el despegue del salto, las paradas de
          `buscando`-- pierde la esquina si no cae una muestra justo encima,
          y una esquina perdida es el golpe que desaparece. Por eso cada
          animacion declara sus `hitos`, las fracciones de vuelta donde el
          movimiento cambia de idea, y cada aparicion de cada hito se lleva
          su muestra.

        El coste es el peso del archivo: el contorno son 64 curvas y cada
        muestra las repite. De ahi el tope de 60. */
    function tiempos(rec) {
        var t = [], i, n = 24;
        var an = ANIMS[receta(rec).anim];
        var mueve = an && an.f;

        if (mueve) n = clamp(Math.ceil(CICLO / an.per * 8), 24, 40);
        for (i = 0; i <= n; i++) t.push(i / n * CICLO);

        if (mueve && an.hitos) {
            for (var v = 0; v * an.per < CICLO - 1e-6; v++) {
                an.hitos.forEach(function (h) {
                    t.push((v + h) * an.per);
                });
            }
        }

        /*  Un parpadeo dentro del ciclo, con seis muestras propias para que
            el cierre no se pierda entre dos cuadros lejanos. */
        var p0 = 2.1;
        [0, 0.04, 0.081, 0.11, 0.15, 0.18].forEach(function (d) { t.push(p0 + d); });

        t.sort(function (a, b) { return a - b; });
        return t.filter(function (v, i, a) { return i === 0 || v - a[i - 1] > 1e-4; });
    }

    /*  El parpadeo del ciclo exportado es uno solo y en un instante fijo: el
        de la pantalla usa instantes pseudoaleatorios que nunca cerrarían el
        bucle. */
    function parpadoCiclo(t) {
        var r = (t - 2.1) / 0.18;
        if (r < 0 || r > 1) return 1;
        return r < 0.45 ? 1 - r / 0.45 : (r - 0.45) / 0.55;
    }

    function animado(rec, opciones) {
        var o = opciones || {};
        var ts = tiempos(rec);
        /*  LAS OPCIONES DE ENCUADRE VIAJAN AL MUESTREO. `ciclo` es cosa de
            aqui --el parpadeo se reparte por la vuelta entera-- pero `margen`
            y `centrado` deciden cuanto encoge y cuanto se corre el dibujo, y
            si no se pasan, el SVG exportado sale encuadrado de otra manera que
            el mismo avatar en pantalla: el estatico centrado y el animado no,
            con el mago al 95% en uno y al 67% en el otro.

            `pose` viaja por lo mismo, y aqui se ve todavia mas: sin ella el
            taller enseña un muñeco de frente y el archivo que se descarga sale
            de tres cuartos. */
        var cuadros = ts.map(function (t) {
            var guarda = parpado;
            parpado = parpadoCiclo;                    // sólo para este muestreo
            var P = piezas(rec, t, null, {
                ciclo: true, margen: o.margen, centrado: o.centrado,
                pose: o.pose
            });
            parpado = guarda;
            return P;
        });

        var P0 = cuadros[0];

        /*  El SVG exportado nunca lleva clases --se abre suelto, fuera de la
            pagina que las define-- pero los ganchos se consultan igual que en
            pantalla para que las dos rutas se lean iguales. */
        var cl = P0.clases;
        var claves = ts.map(function (t) { return (t / CICLO).toFixed(4); }).join(';');
        var dur = ' dur="' + CICLO + 's" repeatCount="indefinite" calcMode="linear"';

        function anima(attr, vals) {
            return '<animate attributeName="' + attr + '" values="' + vals.join(';') + '"'
                 + ' keyTimes="' + claves + '"' + dur + '/>';
        }
        function animaT(tipo, vals) {
            return '<animateTransform attributeName="transform" type="' + tipo + '" additive="sum"'
                 + ' values="' + vals.join(';') + '" keyTimes="' + claves + '"' + dur + '/>';
        }
        function col(f) { return cuadros.map(f); }

        var med = o.lado ? ' width="' + o.lado + '" height="' + o.lado + '"' : '';
        var s = '<svg viewBox="0 0 ' + V + ' ' + V + '"' + med
              + ' xmlns="http://www.w3.org/2000/svg" role="img" aria-label="'
              + String((rec && rec.nombre) || 'avatar').replace(/[<>&"]/g, '') + '">'
              + '<rect width="' + V + '" height="' + V + '" fill="' + P0.fondo + '"/>';

        /*  El mismo aire que en pantalla, y por la misma razon. Es constante
            durante todo el ciclo, asi que va como transform fijo: ni una
            muestra mas de peso. */
        var zg = aire(P0.encaje);
        s += zg;

        function pegado(sacaT, dentro) {
            return '<g>' + animaT('translate', col(function (P) { var t = sacaT(P); return t.tx.toFixed(2) + ' ' + t.ty.toFixed(2); }))
                 +   '<g>' + animaT('rotate', col(function (P) { return sacaT(P).rot.toFixed(2); }))
                 +     '<g>' + animaT('scale', col(function (P) { return sacaT(P).esc.toFixed(4); }))
                 +       dentro
                 +     '</g></g></g>';
        }

        /*  Cada pieza del accesorio se exporta por su lado, y en la tanda
            --delante o detras-- que tenia en el PRIMER cuadro: SMIL anima
            atributos, no puede reordenar elementos a mitad de camino. En el
            ciclo exportado no hay cursor al que seguir, asi que ninguna pieza
            cambia de lado por el camino. */
        function accTanda(delante, sombra) {
            var s2 = '';
            P0.acc.forEach(function (A0, i) {
                if (A0.delante !== delante) return;
                if (sombra && !A0.sombra) return;

                /*  El arco de esfera no tiene matriz que animar: lo que
                    cambia cuadro a cuadro es su propio trazo, asi que se
                    anima la `d`. Es la misma tecnica del contorno. */
                if (!A0.t) {
                    s2 += '<path fill="none" stroke="' + (sombra ? A0.som : A0.col) + '"'
                        + ' stroke-linecap="round" stroke-linejoin="round">'
                        + anima('d', col(function (P) { return P.acc[i].d; }))
                        + anima('stroke-width', col(function (P) { return P.acc[i].w.toFixed(2); }))
                        + '</path>';
                    return;
                }
                s2 += pegado(function (P) { return P.acc[i].t; }, sombra ? A0.sombra : A0.svg);
            });
            return s2;
        }

        s += accTanda(false, false);
        s += utilTanda(true);

        /*  El cuerpo lleva id: la sombra lo reutiliza como recorte con un
            <use> en vez de repetir los treinta cuadros del contorno, que
            duplicaban el peso del archivo. */
        var idCuerpo = 'c' + (++UID);
        s += '<path id="' + idCuerpo + '" fill="' + P0.color + '"'
           + (P0.borde ? ' stroke="' + P0.borde + '" stroke-width="2"' : '') + '>'
           + anima('d', col(function (P) { return P.cuerpo; })) + '</path>';

        /*  UN SOLO RECORTE para la sombra y para la cara, con el mismo
            <use>: el contorno cambia en cada cuadro y el clipPath lo sigue
            solo, porque apunta al cuerpo en vez de repetirlo. La cara se
            recorta por lo mismo que en pantalla: ver pintaPiezas. */
        var idR = 'r' + (++UID);
        s += '<clipPath id="' + idR + '"><use href="#' + idCuerpo + '"/></clipPath>';
        var recorte = ' clip-path="url(#' + idR + ')"';

        var somAcc = accTanda(true, true);

        if (somAcc) {
            s += '<g' + recorte + ' opacity="' + SOMBRA.op + '">'
               +   '<g transform="translate(' + SOMBRA.x + ' ' + SOMBRA.y + ')">'
               +     somAcc
               +   '</g></g>';
        }

        var cara = '';

        P0.puntos.forEach(function (_, i) {
            cara += '<circle fill="' + P0.colOjo + '">'
                  + anima('cx', col(function (P) { return P.puntos[i].cx.toFixed(2); }))
                  + anima('cy', col(function (P) { return P.puntos[i].cy.toFixed(2); }))
                  + anima('r',  col(function (P) { return P.puntos[i].r.toFixed(2); }))
                  + anima('opacity', col(function (P) { return P.puntos[i].op.toFixed(2); }))
                  + '</circle>';
        });

        P0.ojos.forEach(function (o0, i) {
            var trazo = '<path stroke="' + P0.colOjo + '" stroke-linecap="round" fill="none">'
                      + anima('d', col(function (P) { return P.ojos[i].d; }))
                      + anima('stroke-width', col(function (P) { return P.ojos[i].w.toFixed(2); }))
                      + anima('opacity', col(function (P) { return String(P.ojos[i].op); }))
                      + '</path>';
            cara += o0.t ? pegado(function (P) { return P.ojos[i].t; }, trazo) : trazo;
        });

        if (cara) s += '<g' + recorte + '>' + cara + '</g>';

        s += accTanda(true, false);

        P0.zzz.forEach(function (z0, i) {
            s += '<text font-family="system-ui,sans-serif" font-size="' + z0.s + '" font-weight="700" fill="' + z0.col + '">'
               + anima('x', col(function (P) { return P.zzz[i].x.toFixed(1); }))
               + anima('y', col(function (P) { return P.zzz[i].y.toFixed(1); }))
               + anima('opacity', col(function (P) { return P.zzz[i].op.toFixed(2); }))
               + 'z</text>';
        });

        /*  La nota se mueve con translate y rotate animados; la escala y el
            centrado del glifo son fijos y van en un transform normal. */
        P0.notas.forEach(function (n0, i) {
            s += '<g fill="' + n0.col + '">'
               +   anima('opacity', col(function (P) { return P.notas[i].op.toFixed(2); }))
               +   '<g>' + animaT('translate', col(function (P) { return P.notas[i].x.toFixed(1) + ' ' + P.notas[i].y.toFixed(1); }))
               +     '<g>' + animaT('rotate', col(function (P) { return P.notas[i].rot.toFixed(1); }))
               +       '<g transform="scale(' + n0.s + ') translate(-5 10)">' + NOTA[n0.tipo] + '</g>'
               +   '</g></g></g>';
        });

        /*  La taza igual que la nota: translate y rotate animados, escala
            fija. El vapor anima su subida y su opacidad dentro del grupo. */
        if (P0.taza) {
            var vap = '';
            P0.taza.vapor.forEach(function (_, i) {
                vap += '<path d="' + VAPOR + '" fill="none" stroke="' + VAPOR_COL + '" stroke-width="4" stroke-linecap="round">'
                     +   anima('opacity', col(function (P) { return P.taza.vapor[i].op.toFixed(2); }))
                     +   animaT('translate', col(function (P) { return P.taza.vapor[i].x + ' ' + P.taza.vapor[i].y.toFixed(1); }))
                     + '</path>';
            });
            s += '<g>' + animaT('translate', col(function (P) { return P.taza.x.toFixed(1) + ' ' + P.taza.y.toFixed(1); }))
               +   '<g>' + animaT('rotate', col(function (P) { return P.taza.rot.toFixed(1); }))
               +     '<g transform="scale(' + P0.taza.s + ')">' + vap + TAZAS[P0.taza.tipo].svg + '</g>'
               +   '</g></g>';
        }

        /*  La laptop igual que en pantalla, con lo que cambia animado: la
            altura de la tapa (y, height), el sitio del logo, las opacidades y
            el camino de cada simbolo. */
        if (P0.laptop) {
            P0.laptop.glifos.forEach(function (g0, i) {
                s += '<g>' + animaT('translate', col(function (P) { var g = P.laptop.glifos[i]; return g.x.toFixed(1) + ' ' + g.y.toFixed(1); }))
                   +   '<g>' + animaT('rotate', col(function (P) { return P.laptop.glifos[i].rot.toFixed(1); }))
                   +     '<path d="' + GLIFO[g0.tipo] + '" transform="scale(' + g0.s + ')" fill="none" stroke="' + g0.col + '" stroke-width="3.2"'
                   +       ' stroke-linecap="round" stroke-linejoin="round">'
                   +       anima('opacity', col(function (P) { return P.laptop.glifos[i].op.toFixed(2); }))
                   +     '</path>'
                   +   '</g></g>';
            });
            s += '<g>' + anima('opacity', col(function (P) { return P.laptop.op.toFixed(2); }))
               +   '<g>' + animaT('translate', col(function (P) { return P.laptop.x.toFixed(1) + ' ' + P.laptop.y.toFixed(1); }))
               +     P0.laptop.teclas.map(function (k0, i) {
                           return '<g>' + animaT('translate', col(function (P) { return k0.x + ' ' + (96 - P.laptop.h).toFixed(1); }))
                                +   '<path d="' + TECLA + '" fill="none" stroke="' + P0.laptop.glifos[0].col + '" stroke-width="3.6" stroke-linecap="round">'
                                +     anima('opacity', col(function (P) { return P.laptop.teclas[i].op.toFixed(2); }))
                                +   '</path></g>';
                       }).join('')
               +     '<rect x="' + (-TAPA_W / 2) + '" width="' + TAPA_W + '" rx="7" fill="' + (P0.laptop.tapa || LAPTOP.tapa) + '" stroke="' + LAPTOP.borde + '" stroke-width="2.5">'
               +       anima('y', col(function (P) { return (98 - P.laptop.h).toFixed(1); }))
               +       anima('height', col(function (P) { return P.laptop.h.toFixed(1); }))
               +     '</rect>'
               +     '<g fill="' + LAPTOP.logo + '" stroke="' + LAPTOP.logo + '">'
               +       anima('opacity', col(function (P) { return P.laptop.logo.toFixed(2); }))
               +       '<g>' + animaT('translate', col(function (P) { return '0 ' + (98 - P.laptop.h / 2).toFixed(1); }))
               +         LOGO_TAZA
               +       '</g>'
               +     '</g>'
               +     BISAGRA
               +   '</g></g>';
        }

        /*  La de perfil: todo lo que se mueve dentro de la laptop es un
            trazo que cambia de forma --la tapa al abrirse, cada linea de
            codigo al escribirse, el cursor--, asi que se anima su `d`; las
            demas va con opacidad. */
        if (P0.lado) {
            s += '<g>' + anima('opacity', col(function (P) { return P.lado.op.toFixed(2); }))
               +   '<g>' + animaT('translate', col(function (P) { return P.lado.x.toFixed(1) + ' ' + P.lado.y.toFixed(1); }))
               +     TECLADO_LADO
               +     '<path fill="' + LADO.alu + '" stroke="' + LADO.borde + '" stroke-width="1.5" stroke-linejoin="round">'
               +       anima('d', col(function (P) { return P.lado.alu; }))
               +     '</path>'
               +     '<path fill="' + LADO.bisel + '" stroke-linejoin="round">'
               +       anima('d', col(function (P) { return P.lado.bisel; }))
               +       anima('opacity', col(function (P) { return P.lado.biselOp.toFixed(2); }))
               +     '</path>'
               +     '<path fill="' + LADO.pantalla + '">'
               +       anima('d', col(function (P) { return P.lado.pantalla; }))
               +       anima('opacity', col(function (P) { return P.lado.pantOp.toFixed(2); }))
               +     '</path>'
               +     P0.lado.lineas.map(function (l0, i) {
                         return '<path stroke="' + l0.col + '" stroke-width="3" stroke-linecap="round">'
                              + anima('d', col(function (P) { return P.lado.lineas[i].d; }))
                              + anima('opacity', col(function (P) { return P.lado.lineas[i].op.toFixed(2); }))
                              + '</path>';
                     }).join('')
               +     '<path stroke="' + LADO.cursor + '" stroke-width="3" stroke-linecap="round">'
               +       anima('d', col(function (P) { return P.lado.cursor.d; }))
               +       anima('opacity', col(function (P) { return P.lado.cursor.op.toFixed(2); }))
               +     '</path>'
               +   '</g></g>';
        }

        /*  La utileria: el dibujo de cada pieza es fijo (ver la REGLA en LOS
            MOVIMIENTOS DE TRABAJO), asi que se animan sus cinco numeros. */
        s += utilTanda(false);

        /*  Las piezas que van detras del cuerpo (`detras`) se exportan antes
            que el; las demas, delante de todo. El lado lo dice el primer
            cuadro: SMIL no reordena. */
        function utilTanda(detras) {
            var s2 = '';
            if (!P0.util) return s2;
            P0.util.forEach(function (it0, i) {
                if (!!it0.detras !== detras) return;
                s2 += '<g>' + anima('opacity', col(function (P) { return P.util[i].op.toFixed(2); }))
                   +   '<g>' + animaT('translate', col(function (P) { var it = P.util[i]; return it.x.toFixed(1) + ' ' + it.y.toFixed(1); }))
                   +     '<g>' + animaT('rotate', col(function (P) { return P.util[i].rot.toFixed(1); }))
                   +       '<g>' + animaT('scale', col(function (P) { return P.util[i].s.toFixed(3); }))
                   +         it0.svg
                   +   '</g></g></g></g>';
            });
            return s2;
        }

        return s + (zg ? '</g>' : '') + '</svg>';
    }

    /*  Una receta al azar que siempre sale legible: el fondo se elige lejos
        del color del cuerpo, o el blob desaparece contra su propio fondo. */
    function azar() {
        function uno(a) { return a[(Math.random() * a.length) | 0]; }
        var color = uno(COLORES), fondo, i = 0;
        do { fondo = uno(FONDOS); i++; }
        while (Math.abs(luz(fondo) - luz(color)) < 0.3 && i < 10);

        var accs = Object.keys(ACCESORIOS);
        return {
            nombre: 'sin nombre',
            forma: uno(Object.keys(FORMAS)),
            color: color,
            fondo: fondo,
            gesto: uno(Object.keys(GESTOS)),
            accesorio: Math.random() < 0.25 ? 'ninguno' : uno(accs),
            /*  La mitad de las veces quieto: una galeria donde todo brinca
                marea y tapa las diferencias de forma. */
            anim: Math.random() < 0.5 ? 'ninguna' : uno(Object.keys(ANIMS)),
            acento: uno(COLORES)
        };
    }

    global.Bloub = {
        svg: svg,
        animado: animado,
        cuadro: cuadro,
        piezas: piezas,
        receta: receta,
        azar: azar,
        tono: tono,
        luz: luz,
        /*  La pose de reposo. La expone porque quien interpola gestos por su
            cuenta --el guion del chat-- necesita el MISMO punto de partida:
            con su propia copia, el muñeco de la app miraria de frente y el de
            la forja de tres cuartos, y serian dos personajes otra vez. */
        POSE: POSE,
        LADO: V,
        FORMAS: FORMAS,
        GESTOS: GESTOS,
        ACCESORIOS: ACCESORIOS,
        colorAcc: colorAcc,
        ANIMS: ANIMS,
        COLORES: COLORES,
        FONDOS: FONDOS,
        CASA: CASA
    };
})(window);
