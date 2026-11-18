/*  Lealtad › Programa (sección lealtad-programa).

    Arriba, cómo entran los clientes: el registro solo con el QR del mostrador
    (registro.php). Abajo, los mensajes que salen solos por WhatsApp (tu
    tarjeta, premio listo, cumpleaños, te extrañamos, nuevo nivel), cada uno
    con su interruptor, y a la derecha el teléfono con el texto de su plantilla.

    Antes era una pestaña de Tarjetas. Su código sigue en la clase Loyalty de
    tarjetas.js, que esta página carga antes como librería (allá el arranque
    se salta si existe LoyaltyProgramPage). Aquí solo se arma la página, se
    apunta al ctrl de la sección (ctrl-programa.php, que deja pasar solo las
    opc del programa) y la ficha que abre el ojo de las listas sale solo para
    leer (cardActions). */

const PROGRAM_API = 'ctrl/ctrl-programa.php';

$(async () => {
    dataInit = (await useFetch({ url: PROGRAM_API, data: { opc: 'init' } })) || {};

    loyalty = new LoyaltyProgramPage(PROGRAM_API, 'root');
    loyalty.init();
});

class LoyaltyProgramPage extends Loyalty {

    // -- Initial --

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'LoyaltyProgram';
        this.cardActions  = false;
    }

    // -- Interface --

    render() {
        this.layout();
        this.header();

        if (dataInit.status != 200) return this.blocked(dataInit.message || 'No se pudo cargar el Programa. Recarga la página.');

        if (!this.allow('show')) return this.blocked('Tu rol no tiene permiso para ver el programa de lealtad.');

        this.programCard();
        this.lsProgram();
    }

    header() {
        const scope = dataInit.scope || {};

        this.createLayout({
            parent: `header${this.PROJECT_NAME}`,
            design: false,
            data: {
                id:    `title${this.PROJECT_NAME}`,
                class: 'w-full',
                container: [
                    { type: 'h1', class: 'cp-pagina-titulo', text: 'Programa' },
                    { type: 'p', class: 'cp-pagina-subtitulo', text: [scope.company, 'cómo entran los clientes y los mensajes que salen solos'].filter(Boolean).join(' · ') }
                ]
            }
        });
    }

    // Donde pinta lsProgram (bodyLoyProgram, el mismo id que tenía la pestaña). Sin tarjeta blanca alrededor: el tablero va sobre el fondo.
    programCard() {
        this.createLayout({
            parent: `body${this.PROJECT_NAME}`,
            design: false,
            data: {
                id:    `card${this.PROJECT_NAME}`,
                class: 'w-full flex-1',
                container: [{ type: 'div', id: 'bodyLoyProgram', class: 'w-full' }]
            }
        });
    }

    // -- Complements --

    // Aquí no hay galería ni lista de tarjetas: lo que cambia se ve en el programa.
    reload() {
        this.lsProgram();
    }

    // Sin tipos activos no hay tarjeta de bienvenida que elegir: los tipos se crean en Tarjetas.
    async needType() {
        const r = await alert({
            icon:     'info',
            title:    'Primero crea un tipo de tarjeta',
            text:     'La tarjeta de bienvenida es un tipo de tarjeta activo. Se crean en Lealtad › Tarjetas.',
            btn1:     true,
            btn1Text: 'Ir a Tarjetas',
            btn2:     true,
            btn2Text: 'Ahora no'
        });

        if (r && r.isConfirmed) location.href = 'tarjetas.php';
    }
}
