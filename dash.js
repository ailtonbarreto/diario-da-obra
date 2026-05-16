window.addEventListener('load', () => {

    // ============================================================
    // ELEMENTOS
    // ============================================================

    const obra = document.getElementById('obra');

    const myChart = echarts.init(
        document.getElementById('gauge')
    );

    const myLineChart = echarts.init(
        document.getElementById('line')
    );

    const url =
        "https://docs.google.com/spreadsheets/d/e/2PACX-1vRUZfSlgLpjKgGoGB9b_vLq9X10oX61iW7TJ_iUH4t4tmI02Kk4Xn8xyYo19vhQfoNtmVPLRhd-EFIC/pub?gid=640424636&single=true&output=csv";

    let movimentacoesBrutas = [];

    // ============================================================
    // FUNÇÕES AUXILIARES
    // ============================================================

    function getCorRotulo() {

        return document.body.classList.contains(
            'dark-mode-variables'
        )
            ? '#FFFFFF'
            : '#000000';
    }

    function normalizarNome(texto) {

        if (!texto) return '';

        return texto
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();
    }

    function parseDateFlexible(str) {

        if (!str) return null;

        const br =
            /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(str);

        if (br) {
            return new Date(br[3], br[2] - 1, br[1]);
        }

        const iso =
            /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(str);

        if (iso) {
            return new Date(iso[1], iso[2] - 1, iso[3]);
        }

        const d = new Date(str);

        return isNaN(d) ? null : d;
    }

    // ============================================================
    // OBSERVA DARK MODE
    // ============================================================

    function atualizarTemaGraficos() {

        const cor = getCorRotulo();

        myChart.setOption({
            series: [{
                axisLabel: {
                    color: cor
                },
                detail: {
                    color: cor
                }
            }]
        });

        myLineChart.setOption({

            xAxis: {
                axisLabel: {
                    color: cor
                }
            },

            yAxis: {
                axisLabel: {
                    color: cor
                }
            }
        });

        atualizarTemaMapa();
        graficoVelocimetro();
    }

    const observer = new MutationObserver(() => {
        atualizarTemaGraficos();
    });

    observer.observe(document.body, {
        attributes: true
    });

    // ============================================================
    // CARREGA PLANILHA
    // ============================================================

    fetch(url)
        .then(response => response.text())
        .then(csvText => {

            const resultados = Papa.parse(csvText, {

                header: true,

                dynamicTyping: false,

                skipEmptyLines: true,

                transformHeader: h =>
                    h.trim().toLowerCase()
            });

            movimentacoesBrutas =
                resultados.data.map(row => ({

                    obra:
                        (row['obra'] || '').trim(),

                    data:
                        (row['data'] || '').trim(),

                    dia:
                        parseInt(row['dia'] || 0) || 0,

                    etapa:
                        (row['etapa'] || '').trim()
                }));

            const obrasUnicas = [
                ...new Set(
                    movimentacoesBrutas
                        .map(i => i.obra)
                        .filter(Boolean)
                )
            ];

            obra.innerHTML =
                obrasUnicas.map(o => `
                    <option value="${o}">
                        ${o}
                    </option>
                `).join('');

            atualizarIndicadores();

            graficoVelocimetro();

            graficoLinhaEvolucao();

            gerarTabelaEtapas();

            mapaObraSelecionada();
        });

    // ============================================================
    // TABELA
    // ============================================================

    function gerarTabelaEtapas() {

        const obraNorm =
            normalizarNome(obra.value);

        const itens =
            movimentacoesBrutas
                .filter(i =>
                    normalizarNome(i.obra)
                    === obraNorm
                )
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

        const tabela =
            document.getElementById("tabela_etapas");

        tabela.innerHTML = html;

        tabela.style.maxHeight = "12vw";
        tabela.style.overflowY = "auto";
        tabela.style.overflowX = "hidden";

        if (
            !document.getElementById(
                "estilo-scroll-tabela-etapas"
            )
        ) {

            const style =
                document.createElement("style");

            style.id =
                "estilo-scroll-tabela-etapas";

            style.innerHTML = `

                #tabela_etapas::-webkit-scrollbar {
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

    // ============================================================
    // INDICADORES
    // ============================================================

    function atualizarIndicadores() {

        const obraNorm =
            normalizarNome(obra.value);

        const itens =
            movimentacoesBrutas.filter(i =>
                normalizarNome(i.obra)
                === obraNorm
            );

        const datas =
            itens
                .map(i =>
                    parseDateFlexible(i.data)
                )
                .filter(Boolean);

        const elInicio =
            document.getElementById('data_inicio');

        const elPrev =
            document.getElementById('termino');

        const elCorridos =
            document.getElementById('qtd_dias_corridos');

        const elTrabalhados =
            document.getElementById('qtd_dias_trabalhados');

        const elTempoEscolhido =
            document.getElementById('tempo_obra_escolhido');

        const tempoObra =
            parseInt(
                document.getElementById("tempo_obra").value
            );

        elTempoEscolhido.innerText = tempoObra;

        if (!datas.length) {

            elInicio.innerText = '—';
            elPrev.innerText = '—';
            elCorridos.innerText = '0';
            elTrabalhados.innerText = '0';

            return;
        }

        const menor =
            new Date(Math.min(...datas));

        const termino =
            new Date(menor);

        termino.setDate(
            termino.getDate() + tempoObra
        );

        function formatarData(d) {

            return `
                ${String(d.getDate()).padStart(2, '0')}/
                ${String(d.getMonth() + 1).padStart(2, '0')}/
                ${d.getFullYear()}
            `.replace(/\s/g, '');
        }

        elInicio.innerText =
            formatarData(menor);

        elPrev.innerText =
            formatarData(termino);

        const hoje = new Date();

        const diffHoje = Math.ceil(
            (hoje - menor) / 86400000
        );

        elCorridos.innerText =
            diffHoje > 0
                ? diffHoje
                : 0;

        const diasTrabalhados =
            Math.max(
                ...itens
                    .map(i => i.dia)
                    .filter(n => !isNaN(n))
            );

        elTrabalhados.innerText =
            diasTrabalhados > 0
                ? diasTrabalhados
                : 0;
    }

    // ============================================================
    // GRÁFICO LINHA
    // ============================================================

    function graficoLinhaEvolucao() {

        const diasTrabalhados =
            parseInt(
                document.getElementById(
                    "qtd_dias_trabalhados"
                ).innerText
            ) || 0;

        const tempoObra =
            parseInt(
                document.getElementById(
                    "tempo_obra"
                ).value
            );

        const eixoX =
            Array.from({
                length: Math.max(
                    tempoObra,
                    diasTrabalhados
                )
            }, (_, i) => i + 1);

        const progressoRealizado =
            Array.from({
                length: diasTrabalhados
            }, (_, i) => i + 1);

        const progressoMeta =
            Array.from({
                length: tempoObra
            }, (_, i) => i + 1);

        const corRotulo =
            getCorRotulo();

        myLineChart.setOption({

            tooltip: {
                trigger: 'axis'
            },

            grid: {
                left: 0,
                right: 0,
                top: 0,
                bottom: 0
            },

            xAxis: {

                type: 'category',

                data: eixoX,

                axisLabel: {
                    color: corRotulo
                }
            },

            yAxis: {

                show: false,

                type: 'value',

                axisLabel: {
                    color: corRotulo
                }
            },

            series: [

                {
                    type: 'line',

                    smooth: true,

                    symbol: 'none',

                    data: progressoRealizado,

                    lineStyle: {
                        width: 3,
                        color: '#0853df'
                    },

                    areaStyle: {
                        color: '#0853df'
                    }
                },

                {
                    type: 'line',

                    smooth: true,

                    symbol: 'none',

                    data: progressoMeta,

                    lineStyle: {
                        width: 2,
                        type: 'dashed',
                        color: '#999'
                    },

                    areaStyle: {
                        opacity: 0
                    }
                }
            ]
        });
    }

    // ============================================================
    // VELOCÍMETRO
    // ============================================================

    function graficoVelocimetro() {

        const diasTrabalhados =
            parseInt(
                document.getElementById(
                    "qtd_dias_trabalhados"
                ).innerText
            ) || 0;

        const tempoObra =
            parseInt(
                document.getElementById(
                    "tempo_obra"
                ).value
            );

        const porcentagem =
            Math.min(
                100,
                Math.round(
                    (diasTrabalhados / tempoObra) * 100
                )
            );

        const corRotulo =
            getCorRotulo();

        let corProgresso = '#cc2e06';

        if (porcentagem > 66) {
            corProgresso = '#00c851';
        }
        else if (porcentagem > 33) {
            corProgresso = '#08d8df';
        }

        myChart.setOption({

            series: [{

                type: 'gauge',

                startAngle: 180,

                endAngle: 0,

                min: 0,

                max: 100,

                progress: {

                    show: true,

                    width: 18,

                    itemStyle: {
                        color: corProgresso
                    }
                },

                axisLine: {
                    lineStyle: {
                        width: 18
                    }
                },

                axisTick: {
                    show: false
                },

                splitLine: {
                    show: false
                },

                axisLabel: {

                    distance: 5,

                    color: corRotulo,

                    fontSize: 10
                },

                pointer: {

                    show: true,

                    length: '60%',

                    width: 6,

                    itemStyle: {
                        color: corProgresso
                    }
                },

                detail: {

                    show: true,

                    valueAnimation: true,

                    formatter: '{value}%',

                    color: corRotulo,

                    fontSize: 16,

                    offsetCenter: [0, '18%']
                },

                title: {
                    show: false
                },

                data: [{
                    value: porcentagem
                }]
            }]
        });
    }

    // ============================================================
    // MAPA
    // ============================================================

    const lightTiles = L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
            maxZoom: 19,
            attribution:
                '&copy; OpenStreetMap contributors'
        }
    );

    const darkTiles = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        {
            maxZoom: 19,
            attribution:
                '&copy; OpenStreetMap contributors &copy; CARTO'
        }
    );

    const map = L.map('map', {

        center: [-20.5373611, -47.4548611],

        zoom: 10,

        layers: [darkTiles]
    });

    let marcadorAtual = null;

    const obrasMapa = {

        "Obra 1": {

            coords: [
                -20.5938139,
                -47.4684872
            ],

            popup: `
            <div style="text-align:center;">

                <h3>
                    Obra 1
                </h3>

                <img
                    src="./img/house.png"
                    style="
                        width:120px;
                        border-radius:10px;
                    "
                >

                <p>
                    Restinga - SP
                </p>

            </div>
        `
        },

        "Obra 2": {

            coords: [
                -20.5349167,
                -47.4533889
            ],

            popup: `
            <div style="text-align:center;">

                <h3>
                    Obra 2
                </h3>

                <img
                    src="./img/house.png"
                    style="
                        width:120px;
                        border-radius:10px;
                    "
                >

                <p>
                    Jardim Arizona
                </p>

            </div>
        `
        }
    };

    function atualizarTemaMapa() {

        const darkMode =
            document.body.classList.contains(
                'dark-mode-variables'
            );

        if (darkMode) {

            if (map.hasLayer(lightTiles)) {
                map.removeLayer(lightTiles);
            }

            if (!map.hasLayer(darkTiles)) {
                map.addLayer(darkTiles);
            }

        } else {

            if (map.hasLayer(darkTiles)) {
                map.removeLayer(darkTiles);
            }

            if (!map.hasLayer(lightTiles)) {
                map.addLayer(lightTiles);
            }
        }
    }

    function mapaObraSelecionada() {

        const obraSelecionada =
            document.getElementById("obra").value;

        const dados =
            obrasMapa[obraSelecionada];

        if (!dados) return;

        if (marcadorAtual) {
            map.removeLayer(marcadorAtual);
        }

        marcadorAtual = L.marker(dados.coords)
            .addTo(map)
            .bindPopup(dados.popup)


        map.flyTo(
            dados.coords,
            16,
            {
                duration: 1.5
            }
        );
    }

    // ============================================================
    // EVENTOS
    // ============================================================

    document
        .getElementById("tempo_obra")
        .addEventListener("change", () => {

            atualizarIndicadores();

            graficoVelocimetro();

            graficoLinhaEvolucao();

            gerarTabelaEtapas();
        });

    document
        .getElementById("obra")
        .addEventListener("change", () => {

            atualizarIndicadores();

            graficoVelocimetro();

            graficoLinhaEvolucao();

            gerarTabelaEtapas();

            mapaObraSelecionada();
        });

});