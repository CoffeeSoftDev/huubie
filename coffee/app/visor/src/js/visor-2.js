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

    App.prototype.loadFile = async function (fileName) {
        const file = visor.getFile(this.allFiles, fileName);
        const ext  = (file && file.file ? file.file : '').split('.').pop().toLowerCase();

        const isSketch = file && ext === 'excalidraw' && !file.lazyDrive && excalidrawBoard;
        if (isSketch) {
            // Descartar edición de texto en curso, si la había.
            if (this.isEditing && fileName !== this.currentFile) this.exitEditMode(false);

            this.currentFile = fileName;
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
        return _origLoadFile.call(this, fileName);
    };
})();

// ── Arranque: instanciar board + botones (corre tras el ready de visor.js) ──
$(() => {
    if (typeof app === 'undefined' || !app) return;
    excalidrawBoard = new ExcalidrawBoard(app, api);

    $('#btnNewSketch').off('click').on('click', () => { if (excalidrawBoard) excalidrawBoard.open(null); });

    $('#btnCloseSketch').off('click').on('click', () => {
        if (!excalidrawBoard) return;
        excalidrawBoard.close();
        const file = visor.getFile(app.allFiles, app.currentFile);
        if (file) visorView.renderContent(file);
        if (window.lucide) lucide.createIcons();
    });
});
