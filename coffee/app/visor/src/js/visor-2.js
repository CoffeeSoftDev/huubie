/* ─────────────────────────────────────────────────────────────────────────
 * visor-2.js — capa de integración de Excalidraw (index.php e index-2.php)
 *
 * Se carga DESPUÉS de visor.js (que define App, app, visor, visorView,
 * drawioBoard…) y de excalidraw-board.js. No modifica el visor base:
 *   - parchea App.prototype.loadFile para enrutar archivos .excalidraw al
 *     ExcalidrawBoard en vez de renderizarlos como JSON;
 *   - instancia el board y enlaza los botones "Boceto" / "Cerrar boceto".
 *
 * Como las declaraciones top-level (let/const/class) de scripts clásicos
 * comparten el mismo entorno léxico global, aquí tenemos acceso a app, visor,
 * visorView, drawioBoard, coffeeIA y api definidos en visor.js.
 * ───────────────────────────────────────────────────────────────────────── */

let excalidrawBoard = null;

// ── Patch: enrutar .excalidraw al lienzo de bocetos ──
(function () {
    if (typeof App === 'undefined' || !App.prototype) return;
    const _origLoadFile = App.prototype.loadFile;

    // OJO: conservar la firma (fileName, fileObj). fileObj es el archivo ya resuelto
    // por fullPath (p. ej. cuál de los varios todo.json); si el wrapper lo tira,
    // el visor vuelve a resolver por nombre y abre el primero que coincida.
    App.prototype.loadFile = async function (fileName, fileObj) {
        const file = fileObj || visor.getFile(this.allFiles, fileName);
        const ext  = (file && file.file ? file.file : '').split('.').pop().toLowerCase();

        const isSketch = file && ext === 'excalidraw' && !file.lazyDrive && excalidrawBoard;
        if (isSketch) {
            fileName = file.file;
            // Descartar edición de texto en curso, si la había.
            if (this.isEditing && fileName !== this.currentFile) this.exitEditMode(false);

            this.currentFile    = fileName;
            this.currentFileObj = file;
            $('#sidebarList .sidebar-item').each(function () {
                $(this).toggleClass('active', $(this).data('file') === fileName);
            });

            visorView.renderBreadcrumb(file, this.dataInit.header);
            visorView.renderFrontmatter(file);
            visorView.renderFooterSelection(file);

            if (typeof drawioBoard !== 'undefined' && drawioBoard && drawioBoard.active) drawioBoard.close();
            $('#btnEdit').prop('disabled', true).attr('title', 'Los bocetos se editan en el lienzo');

            await excalidrawBoard.open(file);

            if (typeof coffeeIA !== 'undefined' && coffeeIA && coffeeIA._syncContext) coffeeIA._syncContext();
            if (window.lucide) lucide.createIcons();
            return;
        }

        // Veníamos de un boceto y cambiamos a otro archivo: cerrar el lienzo.
        if (excalidrawBoard && excalidrawBoard.active && ext !== 'excalidraw') {
            excalidrawBoard.close();
        }
        return _origLoadFile.call(this, fileName, fileObj);
    };
})();

// ── Arranque: instanciar board + botones (corre tras el ready de visor.js) ──
$(() => {
    if (typeof app === 'undefined' || !app) return;
    excalidrawBoard = new ExcalidrawBoard(app, api);

    // "Nuevo boceto" ahora vive en el menu de Graficas (App.generateGraph),
    // que invoca excalidrawBoard.open(null). Aqui solo queda el cierre del lienzo.
    $('#btnCloseSketch').off('click').on('click', () => {
        if (!excalidrawBoard) return;
        excalidrawBoard.close();
        // currentFileRef resuelve por fullPath (no por nombre): con varios todo.json
        // hay que volver a pintar el archivo realmente abierto.
        const file = app.currentFileRef ? app.currentFileRef() : visor.getFile(app.allFiles, app.currentFile);
        if (file) visorView.renderContent(file);
        if (window.lucide) lucide.createIcons();
    });
});
