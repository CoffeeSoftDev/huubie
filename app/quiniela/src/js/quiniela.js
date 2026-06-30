let api = 'ctrl/ctrl-quiniela.php';
let app;

$(function () {
    app = new App(api, 'root');
    app.init();
});

class App extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "Quiniela";
        this.teams = [];
        this.labels = { minimax: 'MiniMax 3.0', glm: 'GLM 5.2', kimi: 'Kimi K2.7' };
    }

    async init() {
        const data = await useFetch({ url: this._link, data: { opc: 'init' } });
        this.teams = data.teams || [];
        if (data.labels) this.labels = data.labels;
        this.render();
    }

    render() {
        this.layout();
        this.renderForm();
        this.renderPlaceholder();
    }

    // Layout canonico Huubie (ver CLAUDE.md).
    layout() {
        this.primaryLayout({
            parent: "root",
            id: this.PROJECT_NAME,
            class: 'flex mx-2 ',
            heightPreset: 'full',
            card: {
                filterBar: { class: 'w-full ', id: 'filterBar' },
                container: { class: 'w-full my-2 bg-[#1F2A37] h-screen rounded p-3 overflow-auto', id: 'container' + this.PROJECT_NAME }
            }
        });

        $('#filterBar').html(`
            <div id="filterBar${this.PROJECT_NAME}" class="w-full my-3 " ></div>
            <div id="containerHours"></div>
        `);
    }

    // Barra superior: seleccion de equipos + boton pronosticar.
    renderForm() {
        const options = this.teams.map(t => `<option value="${t}"></option>`).join('');
        const modelNames = Object.values(this.labels).join(' · ');

        $(`#filterBar${this.PROJECT_NAME}`).html(`
            <div class="w-full bg-[#1F2A37] rounded-lg p-4">
                <div class="flex items-center gap-3 mb-4">
                    <span class="text-3xl">⚽</span>
                    <div>
                        <h2 class="text-white text-lg font-semibold">Quiniela IA · Mundial 2026</h2>
                        <p class="text-gray-400 text-xs">Elige dos selecciones; <b>${modelNames}</b> las analizan por su historia mundialista.</p>
                    </div>
                </div>

                <div class="flex flex-col md:flex-row md:items-end gap-3">
                    <div class="flex-1 w-full">
                        <label class="text-gray-400 text-xs mb-1 block">Equipo A (local)</label>
                        <input id="teamA" list="teamsList" autocomplete="off" placeholder="Ej. Corea del Sur"
                            class="w-full bg-[#111928] text-white border border-gray-700 rounded-md px-3 py-2 focus:border-blue-500 focus:outline-none">
                    </div>

                    <div class="text-gray-500 font-bold pb-2 text-center hidden md:block">VS</div>

                    <div class="flex-1 w-full">
                        <label class="text-gray-400 text-xs mb-1 block">Equipo B (visitante)</label>
                        <input id="teamB" list="teamsList" autocomplete="off" placeholder="Ej. Republica Checa"
                            class="w-full bg-[#111928] text-white border border-gray-700 rounded-md px-3 py-2 focus:border-blue-500 focus:outline-none">
                    </div>

                    <button id="btnPredict" onclick="app.predict()"
                        class="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2 rounded-md transition-colors whitespace-nowrap">
                        <i class="icon-search"></i> Pronosticar
                    </button>
                </div>

                <datalist id="teamsList">${options}</datalist>
            </div>
        `);

        $('#teamA, #teamB').on('keydown', (e) => {
            if (e.key === 'Enter') this.predict();
        });
    }

    renderPlaceholder() {
        $(`#container${this.PROJECT_NAME}`).html(`
            <div class="flex flex-col items-center justify-center py-16 text-center">
                <span class="text-5xl mb-3">🔮</span>
                <p class="text-white font-medium">Elige dos selecciones y pulsa Pronosticar</p>
                <p class="text-gray-400 text-sm mt-1">${Object.keys(this.labels).length} modelos analizaran el duelo por su historia mundialista.</p>
            </div>
        `);
    }

    renderLoading(teamA, teamB) {
        const modelNames = Object.values(this.labels).join(', ');

        $(`#container${this.PROJECT_NAME}`).html(`
            <div class="flex flex-col items-center justify-center py-16 text-center">
                <div class="animate-spin rounded-full h-12 w-12 border-4 border-gray-600 border-t-blue-500 mb-4"></div>
                <p class="text-white font-medium">${teamA} <span class="text-gray-500">vs</span> ${teamB}</p>
                <p class="text-gray-400 text-sm mt-1">Analizando con ${modelNames}…</p>
                <p class="text-gray-500 text-xs mt-1">Consultando Ollama Cloud, puede tardar unos segundos.</p>
            </div>
        `);
    }

    async predict() {
        const teamA = ($('#teamA').val() || '').trim();
        const teamB = ($('#teamB').val() || '').trim();

        if (!teamA || !teamB) {
            alert({ icon: 'warning', title: 'Faltan equipos', text: 'Escribe los dos equipos.', btn1: true });
            return;
        }
        if (teamA.toLowerCase() === teamB.toLowerCase()) {
            alert({ icon: 'warning', title: 'Equipos iguales', text: 'Elige dos selecciones distintas.', btn1: true });
            return;
        }

        $('#btnPredict').prop('disabled', true).addClass('opacity-60');
        this.renderLoading(teamA, teamB);

        const data = await useFetch({ url: this._link, data: { opc: 'predict', teamA, teamB } });

        $('#btnPredict').prop('disabled', false).removeClass('opacity-60');

        if (!data || data.status !== 200) {
            alert({ icon: 'error', title: 'Error', text: (data && data.message) || 'No se pudo generar el pronostico.', btn1: true });
            this.renderPlaceholder();
            return;
        }

        this.renderResults(data);
    }

    renderResults(data) {
        const { teamA, teamB, predictions, consenso } = data;
        const roles = Object.keys(predictions || {});

        const palette = [
            'bg-purple-500/20 text-purple-300 border-purple-500/40',
            'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
            'bg-amber-500/20 text-amber-300 border-amber-500/40',
            'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
        ];

        const modelCards = roles.map((role, i) => this.predictionCard({
            title: this.labels[role] || role,
            badge: `<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold border ${palette[i % palette.length]}">OLLAMA CLOUD</span>`,
            pred: predictions[role], teamA, teamB, featured: false
        })).join('');

        $(`#container${this.PROJECT_NAME}`).html(`
            <div class="mb-5 text-center">
                <div class="inline-flex items-center gap-4 bg-[#111928] rounded-lg px-6 py-3">
                    <span class="text-white font-semibold text-lg">${teamA}</span>
                    <span class="text-gray-500 font-bold">VS</span>
                    <span class="text-white font-semibold text-lg">${teamB}</span>
                </div>
            </div>

            <div class="max-w-md mx-auto mb-4">
                ${this.predictionCard({
                    title: 'Consenso',
                    badge: '<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/40">VEREDICTO</span>',
                    pred: consenso, teamA, teamB, featured: true
                })}
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
                ${modelCards}
            </div>

            <p class="text-gray-500 text-xs text-center mt-5">
                ⚠️ Pronostico cualitativo generado por IA segun historia mundialista, no es una prediccion exacta.
            </p>
        `);
    }

    predictionCard({ title, badge, pred, teamA, teamB, featured }) {
        const border = featured ? 'border-blue-500 ring-1 ring-blue-500/40' : 'border-gray-700';

        if (!pred || pred.error) {
            return `
                <div class="bg-[#283341] border ${border} rounded-lg p-4 flex flex-col">
                    <div class="flex items-start justify-between mb-3">
                        <div>
                            <h3 class="text-white font-semibold leading-tight">${title}</h3>
                            ${pred && pred.model ? `<p class="text-gray-500 text-[10px]">${pred.model}</p>` : ''}
                        </div>
                        ${badge}
                    </div>
                    <div class="flex flex-col items-center justify-center flex-1 py-8 text-center">
                        <span class="text-3xl mb-2">⚠️</span>
                        <p class="text-gray-400 text-sm">${(pred && pred.error) || 'Sin respuesta'}</p>
                    </div>
                </div>`;
        }

        const winName = pred.ganador === 'A' ? teamA : (pred.ganador === 'B' ? teamB : 'Empate');
        const winBadge = pred.ganador === 'Empate'
            ? '<span class="inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium bg-gray-600 text-gray-200">🤝 Empate</span>'
            : `<span class="inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium bg-green-600/20 text-green-400 border border-green-600/40">🏆 ${winName}</span>`;

        const footer = pred.razonamiento
            ? `<p class="text-gray-400 text-xs mt-3 leading-relaxed border-t border-gray-700 pt-2">${pred.razonamiento}</p>`
            : (pred.modelos ? `<p class="text-gray-500 text-xs mt-3 border-t border-gray-700 pt-2 text-center">Promedio de ${pred.modelos} modelo(s)</p>` : '');

        return `
            <div class="bg-[#283341] border ${border} rounded-lg p-4 flex flex-col">
                <div class="flex items-center justify-between mb-3">
                    <h3 class="text-white font-semibold">${title}</h3>
                    ${badge}
                </div>

                <div class="text-center py-2">
                    <div class="text-4xl font-bold text-white tracking-wider">${pred.marcador}</div>
                    <div class="text-[11px] text-gray-500 mt-1">${teamA} · ${teamB}</div>
                    ${winBadge}
                </div>

                <div class="mt-4 space-y-2">
                    ${this.bar(teamA, pred.prob_a, 'bg-blue-500')}
                    ${this.bar('Empate', pred.prob_empate, 'bg-gray-500')}
                    ${this.bar(teamB, pred.prob_b, 'bg-rose-500')}
                </div>

                ${footer}
            </div>`;
    }

    bar(label, pct, color) {
        pct = pct || 0;
        return `
            <div>
                <div class="flex justify-between text-xs text-gray-300 mb-0.5">
                    <span class="truncate pr-2">${label}</span>
                    <span>${pct}%</span>
                </div>
                <div class="w-full bg-[#111928] rounded-full h-2">
                    <div class="${color} h-2 rounded-full" style="width:${pct}%"></div>
                </div>
            </div>`;
    }
}
