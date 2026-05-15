let api = 'ctrl/ctrl-pos.php';
let app;

$(async () => {
    const data = await useFetch({ url: api, data: { opc: 'init' } });

    app = new App(api, 'root');
    app.render();
});

class App extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'POS';
    }

    render() {
        this.layout();
        
    }

    layout() {
        const name = this.PROJECT_NAME;

        // Catalogo de productos.
        const catalogPanel = {
            type:  'div',
            id:    'catalogPanel',
            class: 'flex flex-col flex-1 min-w-0 max-w-[60%]',
            children: [
                {
                    id:    'infoHeader',
                    text:  '#infoHeader',
                    class: 'px-4 py-3 bg-[#0E1521] border-b border-[#374151] flex-shrink-0'
                },
                {
                    id:    'searchBar',
                    text:  '#searchBar',
                    class: 'px-4 pt-3 pb-2 space-y-2 flex-shrink-0'
                },
                {
                    id:    'productGrid',
                    text:  '#productGrid',
                    class: 'flex-1 overflow-y-auto px-4 pb-3 scrollbar-thin'
                }
            ]
            
        };

        // Panel de ventas .
        const salesPanel = {
            type:  'div',
            id:    'salesPanel',
            class: 'flex flex-col w-[40%] bg-[#141d2b] border-l border-[#374151]',
            children: [
                {
                    id:    'salesInfo',
                    text:  '#salesInfo',
                    class: 'px-4 py-3 border-b border-[#374151] flex-shrink-0 bg-[#141d2b]'
                },
                {
                    id:    'productsContainer',
                    text:  '#productsContainer',
                    class: 'flex-1 overflow-y-auto px-3 py-2 space-y-1.5 scrollbar-thin'
                },
                {
                    id:    'salesActions',
                    text:  '#salesActions',
                    class: 'border-t border-[#374151] px-4 py-3 flex-shrink-0'
                }
            ]
        };

        // Root layout.
        this.createLayout({
            parent: 'root',
            design: false,
            data: {
                id:        name,
                class:     'mt-14 h-[calc(100vh-3.5rem)] flex overflow-hidden',
                container: [catalogPanel, salesPanel]
            }
        });
    }

   
}
