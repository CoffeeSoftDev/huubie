// -- PosShell --

// Lo unico que comparten las cuatro pantallas de la terminal ahora que cada una es
// su propia pagina: a donde se va y como se sale. Antes esto era un router escrito
// a mano dentro de pos.js —this.view, go(), back(), un hint ?view= en la url— que
// resolvia en JS lo que en el framework resuelve el navegador.
//
// Los avisos salen por la global `app` de cada pagina: alertBox y swalQuestion son
// metodos de Templates, no funciones sueltas.

const POS_PAGES = {
    acceso:  '/app/facture2/',
    inicio:  '/app/facture2/inicio.php',
    cuentas: '/app/facture2/cuentas.php',
    admin:   '/app/facture2/admin.php'
};

function posGo(page) {
    window.location.href = POS_PAGES[page] || page;
}

function posExit() {
    app.swalQuestion({
        extends: true,
        opts: {
            title:             'Salir del sistema',
            text:              'Se cerrara la sesion de la terminal y volveras a la pantalla de acceso.',
            icon:              'warning',
            confirmButtonText: 'Si, salir',
            cancelButtonText:  'No'
        }
    }).then((result) => {
        if (result.isConfirmed) posGo('acceso');
    });
}

function posPending(accion) {
    app.alertBox({
        theme: WANSOFT_THEME,
        type:  'info',
        title: `${accion}: pendiente de backend`,
        timer: 1800
    });
}
