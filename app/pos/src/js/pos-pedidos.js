let api = 'ctrl/ctrl-pos.php';
let app;

$(async () => {
    const data = await useFetch({ url: api, data: { opc: 'initPedidos' } });

    app = new App(api, 'root');
    app.render();
});

class App extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'POSPedidos';
    }

    render() {
        this.layout();
        // this.renderHeader();
        // this.renderFilterBar();
        // this.renderKpis();
        // this.ls();
    }

    layout() {
        const name = this.PROJECT_NAME;

        // Main panel.
        const mainPanel = {
            type:  'div',
            id:    'mainPanel',
            class: 'flex-1 flex flex-col overflow-hidden min-w-0',
            children: [
                {
                    id:    'viewHeader',
                    text:  '#viewHeader',
                    class: 'flex items-center justify-between px-4 py-3 bg-[#0E1521] border-b border-[#374151] flex-shrink-0'
                },
                {
                    id:    'filterBar',
                    text:  '#filterBar',
                    class: 'px-4 py-3 bg-[#141d2b] border-b border-[#374151] flex-shrink-0'
                },
                {
                    id:    'kpisRow',
                    text:  '#kpisRow',
                    class: 'grid grid-cols-4 gap-2 px-4 py-3 bg-[#0E1521] border-b border-[#374151] flex-shrink-0'
                },
                {
                    id:    'tableWrap',
                    text:  '#tableWrap',
                    class: 'flex-1 overflow-y-auto overflow-x-auto cs-scroll'
                },
                {
                    id:    'viewFooter',
                    text:  '#viewFooter',
                    class: 'px-4 py-2 bg-[#141d2b] border-t border-[#374151] flex items-center justify-between flex-shrink-0'
                }
            ]
        };

        // Detail panel.
        const detailPanel = {
            type:  'aside',
            id:    'detailPanel',
            class: 'w-[420px] flex-shrink-0 bg-[#141d2b] border-l border-[#374151] flex flex-col overflow-hidden',
            children: [
                {
                    id:    'emptyDetail',
                    text:  '#emptyDetail',
                    class: 'flex-1 flex flex-col items-center justify-center text-center px-6'
                },
                {
                    id:    'detailContent',
                    text:  '#detailContent',
                    class: 'hidden flex-1 flex flex-col overflow-hidden'
                }
            ]
        };

        // Root layout.
        this.createLayout({
            parent: 'root',
            design: false,
            data: {
                id:        name,
                class:     'mt-16 h-[calc(100vh-4rem)] flex overflow-hidden',
                container: [mainPanel, detailPanel]
            }
        });
    }


}
