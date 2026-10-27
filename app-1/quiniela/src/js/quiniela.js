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
                        <p class="text-gray-400 text-xs">Elige dos selecciones; <b>${modelNames}</b> las analizan por su historia mundialista con simulacion de Monte Carlo (modelo de Poisson).</p>
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
        this.lastData = data;
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
            badge: `<span class="px-1.5 py-0.5 rounded-full text-[9px] font-semibold border ${palette[i % palette.length]}">CLOUD</span>`,
            pred: predictions[role], teamA, teamB, featured: false, cardKey: role
        })).join('');

        $(`#container${this.PROJECT_NAME}`).html(`
            <div class="mb-3 text-center">
                <div class="inline-flex items-center gap-3 bg-[#111928] rounded-lg px-5 py-2">
                    <span class="text-white font-semibold">${teamA}</span>
                    <span class="text-gray-500 font-bold text-sm">VS</span>
                    <span class="text-white font-semibold">${teamB}</span>
                </div>
            </div>

            <div class="grid grid-cols-2 md:grid-cols-4 gap-2 items-stretch">
                ${this.predictionCard({
                    title: 'Consenso',
                    badge: '<span class="px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/40">VEREDICTO</span>',
                    pred: consenso, teamA, teamB, featured: true, cardKey: 'consenso'
                })}
                ${modelCards}
            </div>

            ${this.methodologyNote()}

            <p class="text-gray-500 text-[11px] text-center mt-3">
                ⚠️ Pronostico cualitativo generado por IA segun historia mundialista, no es una prediccion exacta.
            </p>
        `);
    }

    // Observacion: explica brevemente la metodologia usada por los modelos.
    methodologyNote() {
        return `
            <div class="mt-3 bg-[#111928] border border-blue-500/30 rounded-lg p-3">
                <div class="flex items-start gap-2">
                    <span class="text-xl leading-none">🎲</span>
                    <div>
                        <h4 class="text-blue-300 font-semibold text-xs mb-1">Observacion · Metodologia Monte Carlo (modelo de Poisson)</h4>
                        <p class="text-gray-400 text-[11px] leading-snug">
                            Los modelos estiman las probabilidades aplicando <b>simulacion de Monte Carlo</b>:
                            simular el partido miles de veces al azar para ver con que frecuencia gana cada equipo.
                            Los goles de cada seleccion se modelan con una <b>distribucion de Poisson</b>, que estima
                            cuantos goles marcaria segun sus goles esperados (xG). Juntos convierten la historia
                            mundialista en un marcador y unas probabilidades con base estadistica.
                        </p>
                    </div>
                </div>
            </div>`;
    }

    predictionCard({ title, badge, pred, teamA, teamB, featured, cardKey }) {
        const border = featured ? 'border-blue-500 ring-1 ring-blue-500/40' : 'border-gray-700';

        if (!pred || pred.error) {
            return `
                <div class="bg-[#283341] border ${border} rounded-lg p-3 flex flex-col">
                    <div class="flex items-start justify-between mb-2">
                        <div>
                            <h3 class="text-white font-semibold text-sm leading-tight">${title}</h3>
                            ${pred && pred.model ? `<p class="text-gray-500 text-[10px]">${pred.model}</p>` : ''}
                        </div>
                        ${badge}
                    </div>
                    <div class="flex flex-col items-center justify-center flex-1 py-5 text-center">
                        <span class="text-2xl mb-1">⚠️</span>
                        <p class="text-gray-400 text-xs">${(pred && pred.error) || 'Sin respuesta'}</p>
                    </div>
                </div>`;
        }

        const winName = pred.ganador === 'A' ? teamA : (pred.ganador === 'B' ? teamB : 'Empate');
        const winBadge = pred.ganador === 'Empate'
            ? '<span class="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-600 text-gray-200">🤝 Empate</span>'
            : `<span class="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-600/20 text-green-400 border border-green-600/40 truncate max-w-full">🏆 ${winName}</span>`;

        const clamp2 = 'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;';
        const footer = pred.razonamiento
            ? `<p class="text-gray-400 text-[10px] mt-1.5 leading-snug border-t border-gray-700 pt-1" style="${clamp2}">${pred.razonamiento}</p>`
            : (pred.modelos ? `<p class="text-gray-500 text-[10px] mt-1.5 border-t border-gray-700 pt-1 text-center">Promedio de ${pred.modelos} modelo(s)</p>` : '');

        const clickable = cardKey ? `onclick="app.showBreakdown('${cardKey}')"` : '';
        const clickCls = cardKey ? 'cursor-pointer hover:border-blue-500/70 transition-colors' : '';
        const hint = cardKey ? '<p class="text-[9px] text-blue-400/80 text-center mt-1">🔍 Ver como se genero</p>' : '';

        return `
            <div class="bg-[#283341] border ${border} ${clickCls} rounded-lg p-2 flex flex-col" ${clickable}>
                <div class="flex items-center justify-between gap-1 mb-1">
                    <h3 class="text-white font-semibold text-xs truncate">${title}</h3>
                    ${badge}
                </div>

                <div class="text-center py-0.5">
                    <div class="text-2xl font-bold text-white tracking-wide">${pred.marcador}</div>
                    <div class="text-[9px] text-gray-500 truncate">${teamA} · ${teamB}</div>
                    ${winBadge}
                </div>

                <div class="mt-1.5 space-y-1">
                    ${this.bar(teamA, pred.prob_a, 'bg-blue-500')}
                    ${this.bar('Empate', pred.prob_empate, 'bg-gray-500')}
                    ${this.bar(teamB, pred.prob_b, 'bg-rose-500')}
                </div>

                ${footer}
                ${hint}
            </div>`;
    }

    bar(label, pct, color) {
        pct = pct || 0;
        return `
            <div>
                <div class="flex justify-between text-[10px] text-gray-300 mb-0.5">
                    <span class="truncate pr-1">${label}</span>
                    <span>${pct}%</span>
                </div>
                <div class="w-full bg-[#111928] rounded-full h-1.5">
                    <div class="${color} h-1.5 rounded-full" style="width:${pct}%"></div>
                </div>
            </div>`;
    }

    // Probabilidad de Poisson: P(X = k | media lambda).
    poissonPmf(k, lambda) {
        let fact = 1;
        for (let i = 2; i <= k; i++) fact *= i;
        return Math.exp(-lambda) * Math.pow(lambda, k) / fact;
    }

    // Al hacer clic en una tarjeta: desglosa como se genero el resultado
    // reconstruyendo la distribucion de Poisson a partir de los goles esperados.
    showBreakdown(cardKey) {
        const d = this.lastData;
        if (!d) return;
        const pred = cardKey === 'consenso' ? d.consenso : (d.predictions || {})[cardKey];
        if (!pred || pred.error) return;

        const teamA = d.teamA, teamB = d.teamB;
        const title = cardKey === 'consenso' ? 'Consenso' : (this.labels[cardKey] || cardKey);
        const MAX = 6;

        // Los goles previstos por el modelo son la media (lambda) de cada Poisson.
        const la = Math.max(pred.goles_a || 0, 0.3);
        const lb = Math.max(pred.goles_b || 0, 0.3);

        const pa = [], pb = [];
        for (let i = 0; i <= MAX; i++) { pa[i] = this.poissonPmf(i, la); pb[i] = this.poissonPmf(i, lb); }

        let winA = 0, draw = 0, winB = 0, over = 0;
        const scores = [];
        for (let i = 0; i <= MAX; i++) {
            for (let j = 0; j <= MAX; j++) {
                const p = pa[i] * pb[j];
                scores.push({ i, j, s: `${i}-${j}`, p });
                if (i > j) winA += p; else if (i === j) draw += p; else winB += p;
                if (i + j > 2.5) over += p;
            }
        }
        scores.sort((x, y) => y.p - x.p);

        const ei = Math.min(pred.goles_a || 0, MAX);
        const ej = Math.min(pred.goles_b || 0, MAX);
        const exact = pa[ei] * pb[ej];
        const topP = scores[0].p;
        const pf = (x) => (x * 100).toFixed(1);

        const rows = scores.slice(0, 8).map(x => {
            const hi = (x.i === ei && x.j === ej);
            const w = Math.round(x.p / topP * 100);
            return `
                <div class="flex items-center gap-2 ${hi ? 'bg-blue-500/10 rounded px-1.5 py-0.5' : 'px-1.5'}">
                    <span class="w-9 text-sm font-mono ${hi ? 'text-blue-300 font-bold' : 'text-gray-300'}">${x.s}</span>
                    <div class="flex-1 bg-[#0b1220] rounded-full h-2">
                        <div class="${hi ? 'bg-blue-500' : 'bg-gray-600'} h-2 rounded-full" style="width:${w}%"></div>
                    </div>
                    <span class="w-12 text-right text-xs ${hi ? 'text-blue-300 font-semibold' : 'text-gray-400'}">${pf(x.p)}%</span>
                </div>`;
        }).join('');

        const cmp = (label, poissonP, modelP, color) => `
            <div>
                <div class="flex justify-between text-xs mb-0.5">
                    <span class="text-gray-300 truncate pr-2">${label}</span>
                    <span class="text-gray-400">Poisson <b class="text-white">${pf(poissonP)}%</b> · modelo ${modelP}%</span>
                </div>
                <div class="w-full bg-[#0b1220] rounded-full h-2">
                    <div class="${color} h-2 rounded-full" style="width:${pf(poissonP)}%"></div>
                </div>
            </div>`;

        this.closeBreakdown();
        $('body').append(`
            <div id="breakdownModal" class="fixed inset-0 z-[9999] bg-black/70 flex items-center justify-center p-4"
                 onclick="if(event.target===this)app.closeBreakdown()">
                <div class="bg-[#1F2A37] border border-gray-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-auto shadow-2xl">
                    <div class="flex items-start justify-between p-4 border-b border-gray-700 sticky top-0 bg-[#1F2A37]">
                        <div>
                            <h3 class="text-white font-semibold">🎲 Cómo se generó este resultado</h3>
                            <p class="text-gray-400 text-xs mt-0.5">${title} · ${teamA} vs ${teamB} · Monte Carlo (Poisson)</p>
                        </div>
                        <button onclick="app.closeBreakdown()" class="text-gray-400 hover:text-white text-xl leading-none px-2">×</button>
                    </div>

                    <div class="p-4 space-y-4">
                        <div class="grid grid-cols-3 gap-2 text-center">
                            <div class="bg-[#111928] rounded-lg p-2">
                                <div class="text-[10px] text-gray-500">λ ${teamA}</div>
                                <div class="text-lg font-bold text-blue-300">${la.toFixed(2)}</div>
                            </div>
                            <div class="bg-[#111928] rounded-lg p-2">
                                <div class="text-[10px] text-gray-500">Marcador ${ei}-${ej}</div>
                                <div class="text-lg font-bold text-white">${pf(exact)}%</div>
                            </div>
                            <div class="bg-[#111928] rounded-lg p-2">
                                <div class="text-[10px] text-gray-500">λ ${teamB}</div>
                                <div class="text-lg font-bold text-rose-300">${lb.toFixed(2)}</div>
                            </div>
                        </div>

                        <div>
                            <h4 class="text-gray-300 text-xs font-semibold mb-2 uppercase tracking-wide">Marcadores más probables</h4>
                            <div class="space-y-1">${rows}</div>
                        </div>

                        <div>
                            <h4 class="text-gray-300 text-xs font-semibold mb-2 uppercase tracking-wide">Resultado 1·X·2 (Poisson vs modelo)</h4>
                            <div class="space-y-2">
                                ${cmp('Gana ' + teamA, winA, pred.prob_a, 'bg-blue-500')}
                                ${cmp('Empate', draw, pred.prob_empate, 'bg-gray-500')}
                                ${cmp('Gana ' + teamB, winB, pred.prob_b, 'bg-rose-500')}
                            </div>
                        </div>

                        <div class="flex gap-2 text-center">
                            <div class="flex-1 bg-[#111928] rounded-lg p-2">
                                <div class="text-[10px] text-gray-500">Más de 2.5 goles</div>
                                <div class="text-base font-bold text-white">${pf(over)}%</div>
                            </div>
                            <div class="flex-1 bg-[#111928] rounded-lg p-2">
                                <div class="text-[10px] text-gray-500">Menos de 2.5 goles</div>
                                <div class="text-base font-bold text-white">${pf(1 - over)}%</div>
                            </div>
                        </div>

                        <p class="text-gray-500 text-[11px] leading-relaxed border-t border-gray-700 pt-3">
                            Se toman los goles previstos como media (λ) de una <b>distribución de Poisson</b> por equipo.
                            Combinando todos los marcadores posibles (0-0 a ${MAX}-${MAX}) se obtiene la probabilidad de cada
                            resultado; sumarlos por ganador/empate da el 1·X·2. Es el valor al que converge la
                            <b>simulación de Monte Carlo</b> tras miles de partidos.
                        </p>
                    </div>
                </div>
            </div>
        `);
    }

    closeBreakdown() {
        $('#breakdownModal').remove();
    }
}
