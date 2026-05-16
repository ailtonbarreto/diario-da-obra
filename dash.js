window.addEventListener('load', () => {

    const obra = document.getElementById('obra');
    const url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRUZfSlgLpjKgGoGB9b_vLq9X10oX61iW7TJ_iUH4t4tmI02Kk4Xn8xyYo19vhQfoNtmVPLRhd-EFIC/pub?gid=640424636&single=true&output=csv";

    const myChart = echarts.init(document.getElementById('gauge'));
    const myLineChart = echarts.init(document.getElementById('line'));

    let movimentacoesBrutas = [];

    // ======================FUNÇÕES DE SUPORTE======================

    function getCorRotulo() {
        return document.body.classList.contains('dark-mode-variables') ? '#FFFFFF' : '#000000';
    }

    function observarModoEscuro() {
        const observer = new MutationObserver(() => {
            const cor = getCorRotulo();

            myChart.setOption({
                series: [{
                    axisLabel: { color: cor },
                    detail: { color: cor }
                }]
            });

            myLineChart.setOption({
                xAxis: { axisLabel: { color: cor } },
                yAxis: { axisLabel: { color: cor } }
            });

            // Recalcula gauge com cores dinâmicas
            graficoVelocimetro();
        });

        observer.observe(document.body, { attributes: true });
    }

    observarModoEscuro();

    function parseDateFlexible(str) {
        if (!str) return null;

        const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(str);
        if (br) return new Date(br[3], br[2] - 1, br[1]);

        const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(str);
        if (iso) return new Date(iso[1], iso[2] - 1, iso[3]);

        const d = new Date(str);
        return isNaN(d) ? null : d;
    }

    function normalizarNome(s) {
        if (!s) return '';
        return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    }

    // ================================CARREGAR PLANILHA===========================================

    fetch(url)
        .then(response => response.text())
        .then(csvText => {

            const resultados = Papa.parse(csvText, {
                header: true,
                dynamicTyping: false,
                skipEmptyLines: true,
                transformHeader: h => h.trim().toLowerCase()
            });

            // Colunas: OBRA, DATA, DIA, ETAPA (viram: obra, data, dia, etapa)
            movimentacoesBrutas = resultados.data.map(row => ({
                obra: (row['obra'] || '').trim(),
                data: (row['data'] || '').trim(),
                dia: parseInt(row['dia'] || 0) || 0,
                etapa: (row['etapa'] || '').trim()
            }));

            const obrasUnicas = [...new Set(movimentacoesBrutas.map(i => i.obra).filter(Boolean))];
            obra.innerHTML = obrasUnicas.map(o => `<option value="${o}">${o}</option>`).join('');

            atualizarIndicadores();
            graficoVelocimetro();
            graficoLinhaEvolucao();
            gerarTabelaEtapas();
        });

    // =============================TABELA=============================
    function gerarTabelaEtapas() {

        const obraNorm = normalizarNome(obra.value);

        const itens = movimentacoesBrutas
            .filter(i => normalizarNome(i.obra) === obraNorm)
            .sort((a, b) => a.dia - b.dia);

        let html = `
        <table class="tabela-etapas">
            <thead>
                <tr>
                    <th>Data</th>
                    <th>Etapa</th>
                </tr>
            </thead>
            <tbody>
    `;

        itens.forEach(i => {
            html += `
            <tr>
                <td>${i.data || '-'}</td>
                <td>${i.etapa || '-'}</td>
            </tr>
        `;
        });

        html += `
            </tbody>
        </table>
    `;

        const tabela = document.getElementById("tabela_etapas");
        tabela.innerHTML = html;

        // 🔹 limita a altura e ativa scroll
        tabela.style.maxHeight = "12vw";   // ajusta se quiser
        tabela.style.overflowY = "auto";
        tabela.style.overflowX = "hidden";
        tabela.style.paddingRight = "5px";

        // 🔹 injeta CSS via JS para SOBRESCREVER o "table ::-webkit-scrollbar { display:none }"
        if (!document.getElementById("estilo-scroll-tabela-etapas")) {
            const style = document.createElement("style");
            style.id = "estilo-scroll-tabela-etapas";
            style.innerHTML = `
            #tabela_etapas::-webkit-scrollbar {
                display: block !important;
                width: 6px;
            }
            #tabela_etapas::-webkit-scrollbar-thumb {
                background: #0853df;
                border-radius: 10px;
            }
        `;
            document.head.appendChild(style);
        }
    }



    // =============================INDICADORES=============================

    function atualizarIndicadores() {

        const obraNorm = normalizarNome(obra.value);
        const itens = movimentacoesBrutas.filter(i => normalizarNome(i.obra) === obraNorm);

        // agora usa a coluna DATA
        const datas = itens.map(i => parseDateFlexible(i.data)).filter(Boolean);

        const elInicio = document.getElementById('data_inicio');
        const elPrev = document.getElementById('termino');
        const elCorridos = document.getElementById('qtd_dias_corridos');
        const elTrabalhados = document.getElementById('qtd_dias_trabalhados');
        const elTempoEscolhido = document.getElementById('tempo_obra_escolhido');

        const tempoObra = parseInt(document.getElementById("tempo_obra").value);

        elTempoEscolhido.innerText = tempoObra;

        if (!datas.length) {
            elInicio.innerText = '—';
            elPrev.innerText = '—';
            elTempoEscolhido.innerText = tempoObra;
            elCorridos.innerText = '0';
            elTrabalhados.innerText = '0';
            return;
        }

        const menor = new Date(Math.min(...datas));
        const termino = new Date(menor);

        termino.setDate(termino.getDate() + tempoObra);

        const formatar = d =>
            `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

        elInicio.innerText = formatar(menor);
        elPrev.innerText = formatar(termino);

        const hoje = new Date();
        const diffHoje = Math.ceil((hoje - menor) / 86400000);
        elCorridos.innerText = diffHoje > 0 ? diffHoje : 0;

        const diasTrabalhados = Math.max(...itens.map(i => i.dia).filter(n => !isNaN(n)));
        elTrabalhados.innerText = diasTrabalhados > 0 ? diasTrabalhados : 0;
    }

    // ================GRÁFICO DE LINHA (EVOLUÇÃO)==========

    function graficoLinhaEvolucao() {

        const diasTrabalhados = parseInt(document.getElementById("qtd_dias_trabalhados").innerText) || 0;
        const tempoObra = parseInt(document.getElementById("tempo_obra").value);

        const progressoRealizado = [];
        for (let d = 1; d <= diasTrabalhados; d++) {
            progressoRealizado.push(d);
        }

        const progressoMeta = [];
        for (let d = 1; d <= tempoObra; d++) {
            progressoMeta.push(d);
        }

        const maxDias = Math.max(tempoObra, diasTrabalhados);
        const eixoX = Array.from({ length: maxDias }, (_, i) => i + 1);

        const corRotulo = getCorRotulo();

        const optionLine = {
            tooltip: { trigger: 'axis' },

            legend: {
                show: false,
                data: ['Meta', 'Dias Trabalhados'],
                textStyle: { color: corRotulo }
            },

            grid: {
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                containLabel: false
            },

            xAxis: {
                type: 'category',
                data: eixoX,
                axisLabel: { color: corRotulo }
            },

            yAxis: {
                show: false,
                type: 'value',
                axisLabel: { color: corRotulo }
            },

            series: [
                {
                    name: 'Dias Trabalhados',
                    type: 'line',
                    smooth: true,
                    symbol: 'none',
                    lineStyle: { width: 2, color: '#0853df' },
                    itemStyle: { color: '#0853df' },
                    areaStyle: { color: '#0853df' },
                    data: progressoRealizado
                },
                {
                    name: 'Meta',
                    type: 'line',
                    smooth: true,
                    symbol: 'none',
                    lineStyle: { width: 2, color: '#0853df' },
                    itemStyle: { color: '#0853df' },
                    areaStyle: { opacity: 0 },
                    data: progressoMeta
                }
            ]
        };

        myLineChart.setOption(optionLine);
    }

    // ============================================================
    // GAUGE
    // ============================================================

    function graficoVelocimetro() {

        const diasTrabalhados = parseInt(document.getElementById("qtd_dias_trabalhados").innerText) || 0;
        const tempoObra = parseInt(document.getElementById("tempo_obra").value);

        const porcentagem = Math.min(100, Math.round((diasTrabalhados / tempoObra) * 100));

        const corRotulo = getCorRotulo();

        let corProgresso = '#cc2e06';
        if (porcentagem > 66) corProgresso = '#00c851';
        else if (porcentagem > 33) corProgresso = '#08d8df';

        const optionGauge = {
            series: [
                {
                    type: 'gauge',
                    startAngle: 180,
                    endAngle: 0,
                    min: 0,
                    max: 100,

                    progress: {
                        show: true,
                        width: 18,
                        itemStyle: { color: corProgresso }
                    },

                    axisLine: { lineStyle: { width: 18 } },
                    axisTick: { show: false },
                    splitLine: { show: false },

                    axisLabel: {
                        distance: 5,
                        color: corRotulo,
                        fontSize: 10
                    },

                    pointer: {
                        show: true,
                        length: '60%',
                        width: 6,
                        itemStyle: { color: corProgresso }
                    },

                    anchor: { show: false },

                    detail: {
                        show: true,
                        valueAnimation: true,
                        fontSize: 14,
                        offsetCenter: [0, '18%'],
                        formatter: '{value}%'
                    },

                    title: { show: false },

                    data: [{ value: porcentagem, name: '' }]
                }
            ]
        };

        myChart.setOption(optionGauge);
    }

    // ============================================================
    // EVENTOS
    // ============================================================

    document.getElementById("tempo_obra").addEventListener("change", () => {
        atualizarIndicadores();
        graficoVelocimetro();
        graficoLinhaEvolucao();
        gerarTabelaEtapas();
    });

    obra.addEventListener('change', () => {
        atualizarIndicadores();
        graficoVelocimetro();
        graficoLinhaEvolucao();
        gerarTabelaEtapas();
    });

});
