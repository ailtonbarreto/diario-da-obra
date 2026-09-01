window.addEventListener('DOMContentLoaded', () => {

    let movimentacoesBrutas = [];
    let obraSelecionada = null;

    const myChart = echarts.init(document.getElementById('gauge'));
    const myLineChart = echarts.init(document.getElementById('line'));

    const url =
        "https://docs.google.com/spreadsheets/d/e/2PACX-1vRUZfSlgLpjKgGoGB9b_vLq9X10oX61iW7TJ_iUH4t4tmI02Kk4Xn8xyYo19vhQfoNtmVPLRhd-EFIC/pub?gid=640424636&single=true&output=csv";

    // ============================================================
    // FUNCOES AUXILIARES

    function normalizarNome(texto) {
        if (!texto) return '';
        return texto.normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();
    }

    function parseDateFlexible(str) {
        if (!str) return null;



        const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(str);
        if (br) return new Date(br[3], br[2] - 1, br[1]);

        const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(str);
        if (iso) return new Date(iso[1], iso[2] - 1, iso[3]);

        const d = new Date(str);
        return isNaN(d) ? null : d;
    }


    // ============================================================
    // MAPA

    function calcularPercentualRealizadoAteOntem() {
        const obraNorm = normalizarNome(obraSelecionada);

        const itens = movimentacoesBrutas.filter(i =>
            normalizarNome(i.obra) === obraNorm
        );

        if (!itens.length) return 0;

        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        const referencia = new Date(hoje);
        referencia.setDate(referencia.getDate() - 1);

        const etapasAteOntem = itens.filter(i => {
            const dataParsed = parseDateFlexible(i.data);
            return dataParsed && dataParsed <= referencia;
        });

        const totalAteOntem = etapasAteOntem.length;

        const etapasRealizadasAteOntem = etapasAteOntem.filter(i =>
            i.status === 'REALIZADO'
        ).length;

        return totalAteOntem > 0
            ? Math.round((etapasRealizadasAteOntem / totalAteOntem) * 100)
            : 0;
    }

    // --------------------------------------------------------------------------------------------

    const iconVerde = L.icon({
        iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });

    const iconVermelho = L.icon({
        iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });


    function escolherIconeVelocimetro(percentual) {
        if (percentual === 100) return iconVerde;
        return iconVermelho;
    }


    const lightTiles = L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }
    );

    const map = L.map('map', {
        center: [-20.5373611, -47.4548611],
        zoom: 2,
        layers: [lightTiles]
    });

    let marcadorAtual = null;

    const obrasMapa = {
        "Goioerê UH-02": {
            coords: [-24.1858549, -53.012921],
            popup: `
                <div style="text-align:center;">
                    <h3>Goioerê UH-02</h3>
                </div>
            `
        },

        "Franca UH-O3": {
            coords: [-20.536524, -47.448063],
            popup: `
                <div style="text-align:center;">
                    <h3>Franca UH-03</h3>
                </div>
            `
        },

        "Maringá UH-01": {
            coords: [-23.4511371, -51.8540074],
            popup: `
                <div style="text-align:center;">
                    <h3>Maringá UH-01</h3>
                </div>
            `
        }
    };

    function mapaObraSelecionada() {

        const dados = obrasMapa[obraSelecionada];
        if (!dados) return;

        const percentualOntem = calcularPercentualRealizadoAteOntem();
        const icone = escolherIconeVelocimetro(percentualOntem);

        if (marcadorAtual) map.removeLayer(marcadorAtual);

        marcadorAtual = L.marker(dados.coords, { icon: icone })
            .addTo(map)
            .bindPopup(dados.popup)
            .openPopup()
            .on("click", () => selecionarObra(obraSelecionada));

        map.flyTo(dados.coords, 6, { duration: 1.5 });
    }

    // --------------------------------------------------------------------------------------------

    fetch(url)
        .then(r => r.text())
        .then(csvText => {

            const resultados = Papa.parse(csvText, {
                header: true,
                dynamicTyping: false,
                skipEmptyLines: true,
                transformHeader: h => h.trim().toLowerCase()
            });

            movimentacoesBrutas = resultados.data.map(row => ({
                obra: (row['obra'] || '').trim(),
                data: (row['data'] || '').trim(),
                etapa: (row['etapa'] || '').trim(),
                desc: (row["desc"] || '').trim(),
                status: (row['status'] || '').trim().toUpperCase()
            }));

            const obrasAgrupadas = {};

            movimentacoesBrutas.forEach(item => {
                if (!obrasAgrupadas[item.obra]) obrasAgrupadas[item.obra] = [];
                obrasAgrupadas[item.obra].push(item);
            });

            Object.values(obrasAgrupadas).forEach(itensObra => {
                itensObra.sort((a, b) => parseDateFlexible(a.data) - parseDateFlexible(b.data));

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

            const obrasUnicas = [...new Set(
                movimentacoesBrutas.map(i => i.obra).filter(Boolean)
            )];

            obraSelecionada = obrasUnicas[0];

            selecionarObra(obraSelecionada);


            Object.keys(obrasMapa).forEach(nome => {
                const dados = obrasMapa[nome];

                obraSelecionada = nome;

                const percentualOntem = calcularPercentualRealizadoAteOntem();
                const icone = escolherIconeVelocimetro(percentualOntem);

                L.marker(dados.coords, { icon: icone })
                    .addTo(map)
                    .bindPopup(dados.popup)
                    .on("click", () => selecionarObra(nome));
                map.zoomControl.remove();
            });

        });

    // ============================================================

    function selecionarObra(nome) {
        obraSelecionada = nome;

        const nome_obra = document.getElementById("nome_obra").innerHTML = nome;

        atualizarIndicadores();
        graficoVelocimetro();
        graficoBarraEvolucao();
        mapaObraSelecionada();
        gerarCardsProgresso();
    }


    // ============================================================
    // INDICADORES


    function atualizarIndicadores() {

        const obraNorm = normalizarNome(obraSelecionada);

        const itens = movimentacoesBrutas.filter(i =>
            normalizarNome(i.obra) === obraNorm
        );

        const datas = itens.map(i => parseDateFlexible(i.data)).filter(Boolean);

        const elInicio = document.getElementById('data_inicio');
        const elPrev = document.getElementById('termino');
        const elCorridos = document.getElementById('qtd_dias_corridos');
        const elTrabalhados = document.getElementById('qtd_dias_trabalhados');
        const elTempoEscolhido = document.getElementById('tempo_obra_escolhido');

        const tempoObra = Math.max(...itens.map(i => Number(i.dia) || 0));

        if (!datas.length) {
            elInicio.innerText = '—';
            elPrev.innerText = '—';
            elCorridos.innerText = '0';
            elTrabalhados.innerText = '0';
            return;
        }

        const menor = new Date(Math.min(...datas));
        const termino = new Date(Math.max(...datas));

        elTempoEscolhido.innerText = tempoObra;

        function formatarData(d) {
            return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')
                }/${d.getFullYear()}`;
        }

        elInicio.innerText = formatarData(menor);
        elPrev.innerText = formatarData(termino);

        const diffDias = Math.ceil((termino - menor) / 86400000);
        elCorridos.innerText = diffDias >= 0 ? diffDias : 0;

        const diasTrabalhados = Math.max(
            0,
            ...itens.filter(i => i.status === 'REALIZADO').map(i => Number(i.dia) || 0)
        );

        elTrabalhados.innerText = diasTrabalhados;
    }

    // ============================================================
    // EVOLUCAO CONTAINER

    function corPorPercentual(p) {
        p = Number(p);

        if (p === 100) return "#07e777";
        if (p >= 66) return "#eb8807";
        if (p >= 33) return "#ff1010";
        return "red";
    }


    function calcularPercentuaisEtapas() {
        const obraNorm = normalizarNome(obraSelecionada);

        const itens = movimentacoesBrutas.filter(i =>
            normalizarNome(i.obra) === obraNorm
        );

        const grupos = {};

        itens.forEach(i => {
            if (!grupos[i.etapa]) grupos[i.etapa] = { total: 0, realizados: 0 };
            grupos[i.etapa].total++;
            if (i.status === "REALIZADO") grupos[i.etapa].realizados++;
        });

        const lista = Object.keys(grupos).map(etapa => {
            const g = grupos[etapa];
            const percentual = g.total > 0 ? ((g.realizados / g.total) * 100).toFixed(0) : 0;

            return {
                etapa,
                percentual
            };
        });

        return lista;
    }

    function gerarCardsProgresso() {
        const lista = calcularPercentuaisEtapas();

        const container = document.getElementById("cards_progresso");
        container.innerHTML = "";

        lista.forEach(item => {
            const cor = corPorPercentual(item.percentual);

            container.innerHTML += `
            <div class="card-etapa">
                <div class="titulo">${item.etapa}</div>
                <div class="percentual">${item.percentual}%</div>
                <div class="barra">
                    <div class="preenchimento" 
                         style="width:${item.percentual}%; background:${cor};">
                    </div>
                </div>
            </div>
        `;
        });
    }

    // ============================================================
    // GRAFICO DE BARRAS

    function graficoBarraEvolucao() {

        const tempoObra =
            parseInt(document.getElementById("tempo_obra_escolhido").innerText) || 0;

        const obraNorm = normalizarNome(obraSelecionada);

        const itens = movimentacoesBrutas
            .filter(i => normalizarNome(i.obra) === obraNorm)
            .sort((a, b) => a.dia - b.dia);

        const eixoX = Array.from({ length: tempoObra }, (_, i) => i + 1);

        const realizado = [];
        const pendente = [];

        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        const ontem = new Date(hoje);
        ontem.setDate(ontem.getDate() - 1);

        for (let d = 1; d <= tempoObra; d++) {

            const etapasDia = itens.filter(i => i.dia === d);

            if (!etapasDia.length) {
                realizado.push(null);
                pendente.push(null);
                continue;
            }

            const possuiRealizado = etapasDia.some(i => i.status === "REALIZADO");

            if (possuiRealizado) {
                realizado.push(d);
                pendente.push(null);
            } else {
                const dataEtapa = parseDateFlexible(etapasDia[0].data);

                if (dataEtapa <= ontem) {
                    pendente.push({ value: d, itemStyle: { color: "#ee0303" } }); // vermelho
                } else {
                    pendente.push({ value: d, itemStyle: { color: "#007bff" } }); // azul
                }

                realizado.push(null);
            }
        }

        const corRotulo = "#000";

        const optionLine = {
            tooltip: {
                trigger: 'axis',
                formatter: params => {
                    const diaAtual = Number(params[0].axisValue);
                    const etapasDoDia = itens.filter(i => i.dia === diaAtual);

                    if (!etapasDoDia.length) return `<div>Nenhuma etapa</div>`;

                    const dataAtual = etapasDoDia[0].data;

                    const etapasHTML = etapasDoDia.map(i => {
                        let cor;

                        if (i.status === "REALIZADO") {
                            cor = "#16eb5d";
                        } else {
                            const dataEtapa = parseDateFlexible(i.data);
                            cor = dataEtapa <= ontem ? "#ee0303" : "#0853df";
                        }

                        return `<span style="color:${cor}">● ${i.desc}</span>`;
                    }).join("<br>");

                    return `
                    <div style="padding:8px; line-height:1.6;">
                        <strong>${dataAtual}</strong><br><br>
                        ${etapasHTML}
                    </div>
                `;
                }
            },

            grid: { left: 0, right: 0, top: 0, bottom: 0, containLabel: false },

            xAxis: {
                type: 'category',
                data: eixoX,
                axisLabel: { color: corRotulo }
            },

            yAxis: { show: false, type: 'value', max: tempoObra },

            series: [
                {
                    name: 'REALIZADO',
                    type: 'bar',
                    barGap: '-100%',
                    itemStyle: { color: '#16eb5d' },
                    data: realizado
                },
                {
                    name: 'PENDENTE',
                    type: 'bar',
                    barGap: '-100%',
                    data: pendente
                }
            ]
        };

        myLineChart.setOption(optionLine);
    }

    // ============================================================
    // VELOCIMETRO

    function graficoVelocimetro() {

        const obraNorm = normalizarNome(obraSelecionada);

        const itens = movimentacoesBrutas.filter(i =>
            normalizarNome(i.obra) === obraNorm
        );

        if (!itens.length) return;

        const datas = itens
            .map(i => {
                if (!i.data) return null;
                const [dia, mes, ano] = i.data.split('/').map(Number);
                return new Date(ano, mes - 1, dia);
            })
            .filter(d => d instanceof Date && !isNaN(d.getTime()));

        if (!datas.length) return;

        const dataInicio = new Date(Math.min(...datas.map(d => d.getTime())));
        const dataFim = new Date(Math.max(...datas.map(d => d.getTime())));

        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        const referencia = new Date(hoje);
        referencia.setDate(referencia.getDate() - 1);

        const prazoTotal = dataFim.getTime() - dataInicio.getTime();
        const prazoDecorrido = hoje.getTime() - dataInicio.getTime();

        let porcentagemCronograma = 0;

        if (prazoTotal > 0) {
            porcentagemCronograma = Math.round((prazoDecorrido / prazoTotal) * 100);
            porcentagemCronograma = Math.max(0, Math.min(100, porcentagemCronograma));
        }

        const etapasAteOntem = itens.filter(i => {
            const dataParsed = parseDateFlexible(i.data);
            return dataParsed && dataParsed <= referencia;
        });

        const totalAteOntem = etapasAteOntem.length;

        const etapasRealizadasAteOntem = etapasAteOntem.filter(i =>
            i.status === 'REALIZADO'
        ).length;

        const porcentagemRealizadoAteOntem =
            totalAteOntem > 0
                ? Math.round((etapasRealizadasAteOntem / totalAteOntem) * 100)
                : 0;

        let corProgresso = '#ee0303';
        if (porcentagemRealizadoAteOntem === 100) corProgresso = '#00c851';

        const corRotulo = "#000";

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
                    itemStyle: { color: "#0853df" }
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
                    itemStyle: { color: "#353535" }
                },

                detail: {
                    show: true,
                    valueAnimation: true,
                    formatter: '{value}%',
                    color: corRotulo,
                    fontSize: 16,
                    offsetCenter: [0, '18%']
                },

                title: { show: false },

                data: [{ value: porcentagemCronograma }]
            }]
        });
    }

})