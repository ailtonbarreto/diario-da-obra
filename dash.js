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

    // CARREGA PLANILHA ============================================================

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

                    obra: (row['obra'] || '').trim(),

                    data: (row['data'] || '').trim(),

                    etapa: (row['etapa'] || '').trim(),

                    status: (row['status'] || '').trim().toUpperCase()
                }));


            // GERA O DIA DA OBRA AUTOMATICAMENTE
            const obrasAgrupadas = {};

            movimentacoesBrutas.forEach(item => {

                if (!obrasAgrupadas[item.obra]) {
                    obrasAgrupadas[item.obra] = [];
                }

                obrasAgrupadas[item.obra].push(item);
            });

            Object.values(obrasAgrupadas).forEach(itensObra => {

                itensObra.sort((a, b) =>
                    parseDateFlexible(a.data) -
                    parseDateFlexible(b.data)
                );

                let diaObra = 0;
                let ultimaData = '';

                itensObra.forEach(item => {

                    if (item.data !== ultimaData) {

                        diaObra++;

                        ultimaData = item.data;
                    }

                    item.dia = diaObra;
                });
            });


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

            atualizarModelo3D();
        });

    // TABELA ============================================================

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
                        <th>Status</th>
                    </tr>
                </thead>

                <tbody>
        `;

        itens.forEach(i => {

            const corFundo =
                i.status === 'REALIZADO'
                    ? '#16eb5d'
                    : '#ee0303';

            html += `
        <tr>
            <td>${i.data || '-'}</td>
            <td>${i.etapa || '-'}</td>
            <td>
                <span style="
                    color:${corFundo};
                    padding:4px 10px;
                    border-radius:12px;
                    font-size:12px;
                    font-weight:600;
                ">
                    ${i.status || '-'}
                </span>
            </td>
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

        tabela.style.maxHeight = "14vw";
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

    // modelo 3D====================================================

    function atualizarModelo3D() {

        const obraSelecionada =
            document.getElementById("obra").value;

        const goiere =
            document.getElementById("goiere");

        const maringa =
            document.getElementById("maringa");

        goiere.style.display = "none";
        maringa.style.display = "none";

        if (obraSelecionada === "Goioerê") {
            goiere.style.display = "block";
        }

        if (obraSelecionada === "Maringá") {
            maringa.style.display = "block";
        }
    }

    // INDICADORES=====================================================

    function contarDiasUteis(dataInicio, dataFim) {

        let diasUteis = 0;

        const dataAtual =
            new Date(dataInicio);

        while (dataAtual <= dataFim) {

            const diaSemana =
                dataAtual.getDay();

            if (
                diaSemana !== 0 &&
                diaSemana !== 6
            ) {
                diasUteis++;
            }

            dataAtual.setDate(
                dataAtual.getDate() + 1
            );
        }

        return diasUteis;
    }


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
            Math.max(
                ...itens.map(i => Number(i.dia) || 0)
            );

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
            new Date(Math.max(...datas));

        const diasUteis =
            contarDiasUteis(
                menor,
                termino
            );

        elTempoEscolhido.innerText =
            tempoObra;
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

        const maior =
            new Date(Math.max(...datas));

        const diffDias = Math.ceil(
            (maior - menor) / 86400000
        );

        elCorridos.innerText =
            diffDias >= 0
                ? diffDias
                : 0;

        const diasTrabalhados = Math.max(
            0,
            ...itens
                .filter(i =>
                    i.status &&
                    i.status.toUpperCase() === 'REALIZADO'
                )
                .map(i => Number(i.dia) || 0)
        );

        elTrabalhados.innerText =
            diasTrabalhados;
    }

    // GRAFICO LINHA===================================================


    function graficoLinhaEvolucao() {

        const tempoObra =
            parseInt(
                document.getElementById(
                    "tempo_obra_escolhido"
                ).innerText
            ) || 0;

        const obraNorm =
            normalizarNome(obra.value);

        const itens =
            movimentacoesBrutas
                .filter(i =>
                    normalizarNome(i.obra) === obraNorm
                )
                .sort((a, b) => a.dia - b.dia);

        const eixoX =
            Array.from(
                { length: tempoObra },
                (_, i) => i + 1
            );

        const realizado = [];
        const pendente = [];

        for (let d = 1; d <= tempoObra; d++) {

            const etapasDia =
                itens.filter(i => i.dia === d);

            const possuiRealizado =
                etapasDia.some(i =>
                    i.status &&
                    i.status.toUpperCase() === "REALIZADO"
                );

            if (possuiRealizado) {

                realizado.push(d);
                pendente.push(null);

            } else {

                realizado.push(null);
                pendente.push(d);
            }
        }

        const corRotulo =
            getCorRotulo();

        const optionLine = {

            tooltip: {

                trigger: 'axis',

                formatter: function (params) {

                    const diaAtual =
                        Number(params[0].axisValue);

                    const etapasDoDia =
                        itens.filter(i =>
                            i.dia === diaAtual
                        );

                    if (!etapasDoDia.length) {

                        return `
                        <div>
                            Nenhuma etapa
                        </div>
                    `;
                    }

                    const etapasHTML =
                        etapasDoDia
                            .map(i => {

                                const cor =
                                    i.status &&
                                        i.status.toUpperCase() === "REALIZADO"
                                        ? "#16eb5d"
                                        : "#ee0303";

                                return `
                                <span style="color:${cor}">
                                    ● ${i.etapa}
                                </span>
                            `;
                            })
                            .join("<br>");

                    return `
                    <div style="
                        padding:8px;
                        line-height:1.6;
                    ">
                        <strong>
                            Dia ${diaAtual}
                        </strong>
                        <br><br>
                        ${etapasHTML}
                    </div>
                `;
                }
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
                axisLabel: {
                    color: corRotulo
                }
            },

            yAxis: {
                show: false,
                type: 'value',
                max: tempoObra
            },

            series: [

                {
                    name: 'REALIZADO',

                    type: 'bar',

                    barGap: '-100%',

                    itemStyle: {
                        color: '#16eb5d'
                    },

                    data: realizado
                },

                {
                    name: 'PENDENTE',

                    type: 'bar',

                    barGap: '-100%',

                    itemStyle: {
                        color: '#ee0303'
                    },

                    data: pendente
                }
            ]
        };

        myLineChart.setOption(optionLine);
    }

    // VELOCIMETRO=================================================

    function graficoVelocimetro() {

        const tempoObra =
            parseInt(
                document.getElementById(
                    "tempo_obra_escolhido"
                ).innerText
            ) || 0;

        const obraNorm =
            normalizarNome(obra.value);

        const itens =
            movimentacoesBrutas.filter(i =>
                normalizarNome(i.obra)
                === obraNorm
            );


        const diasRealizados = Math.max(
            0,
            ...itens
                .filter(i =>
                    i.status &&
                    i.status.toUpperCase() === 'REALIZADO'
                )
                .map(i => Number(i.dia) || 0)
        );
        const porcentagem =
            tempoObra > 0
                ? Math.round(
                    (diasRealizados / tempoObra) * 100
                )
                : 0;

        const corRotulo =
            getCorRotulo();

        let corProgresso = '#cc2e06';

        if (porcentagem > 66) {
            corProgresso = '#00c851';
        }
        else if (porcentagem > 33) {
            corProgresso = '#088af5';
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

        zoom: 2,

        layers: [darkTiles]
    });

    let marcadorAtual = null;

    const obrasMapa = {

        "Goioerê": {

            coords: [
                -24.1858549,
                -53.012921
            ],

            popup: `
            <div style="text-align:center;">

                <h3>
                    Goioerê - PR
                </h3>

                <img
                    src="./img/ailton.png"
                    style="
                        width:5vw;
                        border-radius:10px;
                    "
                >

                <p>
                    Engenheiro: Ailton Barreto
                </p>

                <p>
                    <a href="https://wa.me/5516994632838" target="_blank">
                        WhatsApp
                    </a>
                </p>

            </div>
        `
        },

        "Maringá": {

            coords: [
                -23.4511371,
                -51.8540074
            ],

            popup: `
            <div style="text-align:center;">

                <h3>
                    Maringá - PR
                </h3>

                <img
                    src="./img/cesar.png"
                    style="
                        width:5vw;
                        border-radius:10px;
                    "
                >

                <p>
                    Engenheiro: César Pegorari
                </p>

                    <p>
                    <a href="https://wa.me/5516994632838" target="_blank">
                        WhatsApp
                    </a>
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
            .openPopup();


        map.flyTo(
            dados.coords,
            15,
            {
                duration: 1.5
            }
        );
    }

    // ============================================================
    // EVENTOS

    document
        .getElementById("obra")
        .addEventListener("change", () => {

            atualizarIndicadores();

            graficoVelocimetro();

            graficoLinhaEvolucao();

            gerarTabelaEtapas();

            mapaObraSelecionada();

            atualizarModelo3D();
        });

});