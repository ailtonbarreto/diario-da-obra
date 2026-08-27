window.addEventListener('load', () => {

    // ============================================================
    // VARIÁVEIS GLOBAIS
    // ============================================================

    let movimentacoesBrutas = [];
    let obraSelecionada = null;

    const myChart = echarts.init(document.getElementById('gauge'));
    const myLineChart = echarts.init(document.getElementById('line'));

    const url =
        "https://docs.google.com/spreadsheets/d/e/2PACX-1vRUZfSlgLpjKgGoGB9b_vLq9X10oX61iW7TJ_iUH4t4tmI02Kk4Xn8xyYo19vhQfoNtmVPLRhd-EFIC/pub?gid=640424636&single=true&output=csv";

    // ============================================================
    // FUNÇÕES AUXILIARES
    // ============================================================

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
    // TEMA
    // ============================================================

    function atualizarTemaGraficos() {
        // const cor = getCorRotulo();

        const cor =  "#000";

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

        atualizarTemaMapa();
        graficoVelocimetro();
    }

    new MutationObserver(atualizarTemaGraficos)
        .observe(document.body, { attributes: true });


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
                status: (row['status'] || '').trim().toUpperCase()
            }));

            // GERA DIA DA OBRA
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

            // LISTA DE OBRAS
            const obrasUnicas = [...new Set(
                movimentacoesBrutas.map(i => i.obra).filter(Boolean)
            )];

            // DEFINE PRIMEIRA OBRA AUTOMATICAMENTE
            obraSelecionada = obrasUnicas[0];

            selecionarObra(obraSelecionada);

            // CRIA MARCADORES NO MAPA
            Object.keys(obrasMapa).forEach(nome => {
                const dados = obrasMapa[nome];

                L.marker(dados.coords)
                    .addTo(map)
                    .bindPopup(dados.popup)
                    .on("click", () => selecionarObra(nome));
            });

        });

    // ============================================================
    // FUNÇÃO CENTRAL DE SELEÇÃO
    // ============================================================

    function selecionarObra(nome) {
        obraSelecionada = nome;

        const nome_obra = document.getElementById("nome_obra").innerHTML = nome;

        atualizarIndicadores();
        graficoVelocimetro();
        graficoBarraEvolucao();
        gerarTabelaEtapas();
        mapaObraSelecionada();
    }

    // ============================================================
    // TABELA
    // ============================================================

    function gerarTabelaEtapas() {

        const obraNorm = normalizarNome(obraSelecionada);

        const itens = movimentacoesBrutas
            .filter(i => normalizarNome(i.obra) === obraNorm)
            .sort((a, b) => a.dia - b.dia);

        let html = `
            <table class="tabela-etapas">
                <thead>
                    <tr>
                        <th>Data</th>
                        <th>Dia</th>
                        <th>Etapa</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
        `;

        itens.forEach(i => {
            const corFundo = i.status === 'REALIZADO' ? '#16eb5d' : '#ee0303';

            html += `
                <tr>
                    <td>${i.data || '-'}</td>
                    <td>${i.dia || '-'}</td>
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

        html += `</tbody></table>`;

        document.getElementById("tabela_etapas").innerHTML = html;
    }

    // ============================================================
    // INDICADORES
    // ============================================================

    function contarDiasUteis(dataInicio, dataFim) {
        let diasUteis = 0;
        const dataAtual = new Date(dataInicio);

        while (dataAtual <= dataFim) {
            const diaSemana = dataAtual.getDay();
            if (diaSemana !== 0 && diaSemana !== 6) diasUteis++;
            dataAtual.setDate(dataAtual.getDate() + 1);
        }

        return diasUteis;
    }

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
            return `${String(d.getDate()).padStart(2, '0')}/${
                String(d.getMonth() + 1).padStart(2, '0')
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
    // GRÁFICO DE BARRAS
    // ============================================================

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

        for (let d = 1; d <= tempoObra; d++) {
            const etapasDia = itens.filter(i => i.dia === d);
            const possuiRealizado = etapasDia.some(i => i.status === "REALIZADO");

            realizado.push(possuiRealizado ? d : null);
            pendente.push(possuiRealizado ? null : d);
        }

        const corRotulo =  "#000";

        const optionLine = {
            tooltip: {
                trigger: 'axis',
                formatter: params => {
                    const diaAtual = Number(params[0].axisValue);
                    const etapasDoDia = itens.filter(i => i.dia === diaAtual);

                    if (!etapasDoDia.length) return `<div>Nenhuma etapa</div>`;

                    const etapasHTML = etapasDoDia.map(i => {
                        const cor = i.status === "REALIZADO" ? "#16eb5d" : "#ee0303";
                        return `<span style="color:${cor}">● ${i.etapa}</span>`;
                    }).join("<br>");

                    return `
                        <div style="padding:8px; line-height:1.6;">
                            <strong>Dia ${diaAtual}</strong><br><br>
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
                    itemStyle: { color: '#ee0303' },
                    data: pendente
                }
            ]
        };

        myLineChart.setOption(optionLine);
    }

    // ============================================================
    // VELOCÍMETRO
    // ============================================================

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

        // const corRotulo = getCorRotulo();

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

    // ============================================================
    // MAPA

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
        "Goioerê": {
            coords: [-24.1858549, -53.012921],
            popup: `
                <div style="text-align:center;">
                    <h3>Goioerê - PR</h3>
                    <img src="./img/ailton.png" style="width:80%; border-radius:10px;">
                    <p>Engenheiro: Ailton Barreto</p>
                    <p><a href="https://wa.me/5516994632838" target="_blank">WhatsApp</a></p>
                </div>
            `
        },

        "Maringá": {
            coords: [-23.4511371, -51.8540074],
            popup: `
                <div style="text-align:center;">
                    <h3>Maringá - PR</h3>
                    <img src="./img/cesar.png" style="width:80%; border-radius:10px;">
                    <p>Engenheiro: César Pegorari</p>
                    <p><a href="https://wa.me/5516994632838" target="_blank">WhatsApp</a></p>
                </div>
            `
        }
    };


    function mapaObraSelecionada() {

        const dados = obrasMapa[obraSelecionada];
        if (!dados) return;

        if (marcadorAtual) map.removeLayer(marcadorAtual);

        marcadorAtual = L.marker(dados.coords)
            .addTo(map)
            .bindPopup(dados.popup)
            .openPopup()
            .on("click", () => selecionarObra(obraSelecionada));

        map.flyTo(dados.coords, 15, { duration: 1.5 });
    }

})