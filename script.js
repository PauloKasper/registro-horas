document.addEventListener("DOMContentLoaded", () => {

    // --- VARIÁVEIS GLOBAIS (únicas fontes) ---
    window.usuario_atual = null;
    window.registros = {}; // única fonte de verdade para registros
    let chartHoras = null;

    // --- SERVICE WORKER ---
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("/service-worker.js")
            .then(() => console.log("Service Worker registrado"))
            .catch(err => console.error("Erro ao registrar Service Worker:", err));
    }

    // --- LOCAL STORAGE ---
    function salvarLS(c, v) { localStorage.setItem(c, JSON.stringify(v)); }
    function carregarLS(c) { return JSON.parse(localStorage.getItem(c) || "{}"); }

    // --- FUNÇÕES DE CÁLCULO ---
    function calcularHorasDoDia(r) {
        const parseHora = (h) => {
            if (!h || h.indexOf(':') === -1) return 0;
            const [horas, minutos] = h.split(':').map(Number);
            return horas * 60 + minutos;
        };
        const entrada = parseHora(r.entrada);
        const saidaAlm = parseHora(r.saida_alm);
        const retorno = parseHora(r.retorno);
        const saidaFinal = parseHora(r.saida_final);

        if (!entrada || !saidaAlm || !retorno || !saidaFinal || saidaAlm < entrada || retorno < saidaAlm || saidaFinal < retorno) return 0;

        const manha = saidaAlm - entrada;
        const tarde = saidaFinal - retorno;
        return (manha + tarde) / 60;
    }

    function calcularValeRefeicao(diasTrabalhados) {
        const valorPorDia = 8.00;
        return diasTrabalhados * valorPorDia;
    }

    function calcularPlacarTotal() {
        let totalHoras = 0;
        let diasTrabalhados = 0;
        const registros = window.registros;

        for (const data in registros) {
            const r = registros[data];
            if (!r || !r.salvo) continue;
            const horasNoDia = calcularHorasDoDia(r);
            if (horasNoDia > 0) {
                totalHoras += horasNoDia;
                diasTrabalhados++;
            }
        }

        return {
            totalHoras,
            diasTrabalhados,
            estimativaVale: calcularValeRefeicao(diasTrabalhados)
        };
    }

    function calcularHorasNormaisExtras() {
        let totalNormais = 0;
        let totalExtras = 0;
        const registros = window.registros;

        for (const data in registros) {
            const r = registros[data];
            if (!r || !r.salvo) continue;

            const h = calcularHorasDoDia(r);
            if (h > 8) {
                totalNormais += 8;
                totalExtras += h - 8;
            } else {
                totalNormais += h;
            }
        }

        return { totalNormais, totalExtras };
    }

    // --- FORMATAÇÃO / VALIDAÇÃO ---
    function formatarHora(valor) {
        if (!valor) return '';
        valor = String(valor).replace(/\D/g, '');
        if (valor.length === 0) return '';
        let horas = '00', minutos = '00';
        if (valor.length <= 2) { horas = valor.padStart(2, '0'); minutos = '00'; }
        else { minutos = valor.slice(-2); horas = valor.slice(0, -2).padStart(2, '0'); }
        let h = parseInt(horas, 10), m = parseInt(minutos, 10);
        if (h === 24 && m === 0) return "00:00";
        if (h > 23) h = 23; if (m > 59) m = 59;
        return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
    }

    function validarHoraInput(input) {
        const erroDiv = input.parentElement.querySelector(".erro-hora");
        let valor = input.value.trim().replace(":", "");

        if (valor === "") {
            if (erroDiv) erroDiv.textContent = "";
            input.style.border = "";
            return true;
        }

        if (!/^\d{1,4}$/.test(valor)) {
            if (erroDiv) { erroDiv.textContent = "Formato inválido (ex: 1030 ou 10:30)!"; erroDiv.style.color = "red"; }
            input.style.border = "2px solid red";
            return false;
        }

        if (valor.length > 2) {
            const horas = parseInt(valor.slice(0, -2), 10);
            const minutos = parseInt(valor.slice(-2), 10);
            if (horas > 23 || minutos > 59) {
                if (erroDiv) { erroDiv.textContent = "Hora inválida (máx 23:59)!"; erroDiv.style.color = "red"; }
                input.style.border = "2px solid red";
                return false;
            }
        }

        if (erroDiv) erroDiv.textContent = "";
        input.style.border = "";
        return true;
    }

    function formatarDataParaKey(date) {
        if (typeof date === "string") {
            const parts = date.split('/');
            return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
        }
        return date.toISOString().split('T')[0];
    }

    function isWeekend(date) { return date.getDay() === 0 || date.getDay() === 6; }
    function isHoliday(date, holidays) { return holidays.some(h => h.toDateString() === date.toDateString()); }

    function gerarPeriodo() {
        const hoje = new Date();
        let inicio = hoje.getDate() < 20 ? new Date(hoje.getFullYear(), hoje.getMonth() - 1, 20) : new Date(hoje.getFullYear(), hoje.getMonth(), 20);
        let fim = new Date(inicio); fim.setDate(inicio.getDate() + 30);
        return [inicio, fim];
    }

    async function buscarFeriados(ano, pais = 'PT') {
        const cacheKey = `feriados_${pais}_${ano}`;
        const cache = localStorage.getItem(cacheKey);
        if (cache) return JSON.parse(cache);

        try {
            const resp = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${ano}/${pais}`);
            if (!resp.ok) return [];
            const feriadosData = await resp.json();
            const datas = feriadosData.map(h => ({ date: h.date, name: h.localName }));
            localStorage.setItem(cacheKey, JSON.stringify(datas));
            return datas;
        } catch (e) { console.error("Erro ao buscar feriados:", e); return []; }
    }

    function isCycleComplete() {
        const [inicio, fim] = gerarPeriodo();
        let currentDate = new Date(inicio);
        const feriados = carregarLS(`feriados_PT_${inicio.getFullYear()}`) || [];

        while (currentDate <= fim) {
            const key = formatarDataParaKey(currentDate);
            const r = window.registros[key];

            const weekend = isWeekend(currentDate);
            const holiday = isHoliday(currentDate, feriados.map(d => new Date(d)));

            if (!weekend && !holiday) {
                if (!r || !r.entrada || !r.saida_alm || !r.retorno || !r.saida_final) return false;
            } else {
                if (r && (!r.entrada || !r.saida_alm || !r.retorno || !r.saida_final)) return false;
            }

            currentDate.setDate(currentDate.getDate() + 1);
        }
        return true;
    }

    function atualizarCardsPerfil() {
    const placar = calcularPlacarTotal();
    const { totalNormais, totalExtras } = calcularHorasNormaisExtras();
    const totalHorasNegativas = Math.max(0, placar.diasTrabalhados * 8 - totalNormais);

    // Atualiza cards de dias e total de horas
    const elDiasFront = document.getElementById('dias-front');
    const elHorasBack = document.getElementById('horas-back');
    if (elDiasFront && elHorasBack) {
        elDiasFront.innerHTML = `<span>Dias:</span><strong>${placar.diasTrabalhados}</strong>`;
        elHorasBack.innerHTML = `<span>Total:</span><strong>${placar.totalHoras.toFixed(2)}h</strong>`;
    }

    // Atualiza cards de refeição
    const elRefeicaoFront = document.getElementById('refeicao-front');
    const elEstimativaBack = document.getElementById('estimativa-back');
    if (elRefeicaoFront && elEstimativaBack) {
        elRefeicaoFront.innerHTML = `<span>Refeição</span>`;
        elEstimativaBack.innerHTML = `<span>Estimativa:</span><strong>€ ${placar.estimativaVale.toFixed(2)}</strong>`;
    }

    // Atualiza cards de horas extras e horas negativas
    const elExtrasFront = document.getElementById('extras-front');
    const elExtrasBack = document.getElementById('extras-back');
    if (elExtrasFront && elExtrasBack) {
        elExtrasFront.innerHTML = `<span>Horas Extras</span><strong>${totalExtras.toFixed(2)}h</strong>`;
        elExtrasBack.innerHTML = `<span>Horas Negativas</span><strong>${totalHorasNegativas.toFixed(2)}h</strong>`;
    }

    atualizarGraficoHoras();
}

function atualizarGraficoHoras() {
    const { totalNormais, totalExtras } = calcularHorasNormaisExtras();
    const canvas = document.getElementById('grafico-horas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const data = {
        labels: ['Horas Normais', 'Horas Extras'],
        datasets: [{
            data: [totalNormais, totalExtras],
            backgroundColor: ['#3498db', '#e67e22'],
            borderColor: ['#2980b9', '#d35400'],
            borderWidth: 2
        }]
    };

    const options = {
        responsive: true,
        plugins: {
            legend: {
                position: 'bottom',
                labels: { color: 'white', font: { size: 14 } }
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        return context.label + ': ' + context.raw.toFixed(2) + 'h';
                    }
                }
            }
        }
    };

    if (chartHoras) {
        chartHoras.data = data;
        chartHoras.options = options;
        chartHoras.update();
    } else {
        chartHoras = new Chart(ctx, { type: 'doughnut', data: data, options: options });
    }
}

    function resetarCardsPerfil() {
        const elDiasFront = document.getElementById('dias-front');
        const elHorasBack = document.getElementById('horas-back');
        if (elDiasFront && elHorasBack) {
            elDiasFront.innerHTML = `<span>Dias:</span><strong>0</strong>`;
            elHorasBack.innerHTML = `<span>Total:</span><strong>0h</strong>`;
        }

        const elRefeicaoFront = document.getElementById('refeicao-front');
        const elEstimativaBack = document.getElementById('estimativa-back');
        if (elRefeicaoFront && elEstimativaBack) {
            elRefeicaoFront.innerHTML = `<span>Refeição</span>`;
            elEstimativaBack.innerHTML = `<span>Estimativa:</span><strong>€ 0.00</strong>`;
        }
    }

    function resetarCardsPerfilEInputs() {
        resetarCardsPerfil();
        const lista = document.getElementById("lista-dias");
        if (!lista) return;
        lista.querySelectorAll("input").forEach(input => {
            input.value = "";
            const erroDiv = input.parentElement.querySelector(".erro-hora");
            if (erroDiv) erroDiv.textContent = "";
            input.style.border = "";
        });
    }

    window.addEventListener('dadosPWAHorasAtualizados', atualizarCardsPerfil);

    // --- REGISTRO / INICIALIZAÇÃO DE LISTA ---
    async function iniciarRegistro() {
        window.registros = carregarLS("horas_" + window.usuario_atual) || {};
        const registros = window.registros;
        const lista = document.getElementById("lista-dias");
        if (!lista) return;
        lista.innerHTML = "";

        const [inicio, fim] = gerarPeriodo();
        const feriados = await buscarFeriados(inicio.getFullYear());

        for (let d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) {
            const key = formatarDataParaKey(d);
            const r = registros[key] || { entrada: "", saida_alm: "", retorno: "", saida_final: "" };

            const div = document.createElement("div");
            div.className = "card-dia";

            const weekend = isWeekend(d);
            const holiday = isHoliday(d, feriados.map(f => new Date(f)));
            let destaqueTexto = "";
            div.style.backgroundColor = "";
            if (weekend) { destaqueTexto = "Fim de semana"; div.style.backgroundColor = "#f0f0f0"; }
            else if (holiday) { destaqueTexto = "Feriado"; div.style.backgroundColor = "#ffe0e0"; }
            else div.style.backgroundColor = "#e0f7ff";

            let destaqueHTML = destaqueTexto ? `<div class="destaque">${destaqueTexto}</div>` : "";

            div.innerHTML = `
                ${destaqueHTML}<strong>${d.toLocaleDateString("pt-PT")}</strong>
                <div class="campo"><label>Entrada</label><input id="e_${key}" value="${r.entrada}"><div class="erro-hora"></div></div>
                <div class="campo"><label>Saída Almoço</label><input id="s_${key}" value="${r.saida_alm}"><div class="erro-hora"></div></div>
                <div class="campo"><label>Retorno</label><input id="r_${key}" value="${r.retorno}"><div class="erro-hora"></div></div>
                <div class="campo"><label>Saída Final</label><input id="f_${key}" value="${r.saida_final}"><div class="erro-hora"></div></div>
                <button class="btn-salvar-dia" onclick="salvarDia('${key}')">Salvar</button>
            `;
            lista.appendChild(div);

            ["e","s","r","f"].forEach(prefixo => {
                const input = document.getElementById(`${prefixo}_${key}`);
                if (!input) return;
                input.addEventListener("input", () => validarHoraInput(input));
                input.addEventListener("blur", () => {
                    if (validarHoraInput(input) && input.value.trim() !== "") {
                        input.value = formatarHora(input.value);
                        validarHoraInput(input);
                    }
                });
            });
        }

        atualizarCardsPerfil();
    }

    window.salvarDia = async (d) => {
        const entrada = document.getElementById("e_" + d).value.trim();
        const saida_alm = document.getElementById("s_" + d).value.trim();
        const retorno = document.getElementById("r_" + d).value.trim();
        const saida_final = document.getElementById("f_" + d).value.trim();

        if (!entrada || !saida_alm || !retorno || !saida_final) {
            alert("Por favor, preencha todos os 4 campos de hora antes de salvar este dia.");
            return;
        }

        const registros = window.registros;
        const primeiroRegistro = Object.keys(registros).length === 0;

        registros[d] = { entrada, saida_alm, retorno, saida_final, salvo: true };
        window.registros = registros;
        salvarLS("horas_" + window.usuario_atual, window.registros);

        if (primeiroRegistro) {
            const [inicio, fim] = gerarPeriodo();
            const feriados = await buscarFeriados(inicio.getFullYear());

            for (let dt = new Date(inicio); dt <= fim; dt.setDate(dt.getDate() + 1)) {
                const key = formatarDataParaKey(dt);
                if (key === d) continue;
                const weekend = isWeekend(dt);
                const holiday = feriados.some(f => f.date === key);
                const r = window.registros[key];
                const vazio = !r || (!r.entrada && !r.saida_alm && !r.retorno && !r.saida_final);

                if (!weekend && !holiday && vazio) {
                    window.registros[key] = { entrada, saida_alm, retorno, saida_final, salvo: false };
                }
            }
            salvarLS("horas_" + window.usuario_atual, window.registros);
            await iniciarRegistro();
        }

        atualizarCardsPerfil();

        const [inicio, fim] = gerarPeriodo();
        let ultimoDia = null;
        for (let dt = new Date(inicio); dt <= fim; dt.setDate(dt.getDate() + 1)) {
            const key = formatarDataParaKey(dt);
            const weekend = isWeekend(dt);
            const holiday = (await buscarFeriados(dt.getFullYear())).some(f => f.date === key);
            if (!weekend && !holiday) ultimoDia = key;
        }

        if (d === ultimoDia) mostrarPopupCiclo(calcularPlacarTotal());

        window.dispatchEvent(new Event('dadosPWAHorasAtualizados'));
    };

    function mostrarPopupCiclo(placar) {
        const popup = document.getElementById("popup-ciclo");
        const texto = document.getElementById("popup-text");
        texto.innerHTML = `Dias trabalhados: <strong>${placar.diasTrabalhados}</strong><br>
                           Total de horas: <strong>${placar.totalHoras.toFixed(2)}h</strong><br>
                           Estimativa de refeição: <strong>€ ${placar.estimativaVale.toFixed(2)}</strong>`;
        popup.style.display = "flex";

        document.getElementById("popup-fechar").onclick = () => {
            popup.style.display = "none";
            window.registros = {};
            salvarLS("horas_" + window.usuario_atual, window.registros);
            iniciarRegistro();
        };
    }

function mostrar(tela) {

    // controla telas
    document.querySelectorAll(".tela").forEach(t => t.classList.remove("ativa"));
    document.getElementById(tela).classList.add("ativa");

    // controla nav
    const nav = document.getElementById("bottom-nav");
    if(tela === "tela-login" || tela === "tela-cadastro"){
        nav.classList.add("oculto");  // oculta nav no login e cadastro
    } else{
        nav.classList.remove("oculto"); // mostra nav nas outras telas
    }

    // destaca botão ativo (radio)
    const radios = nav.querySelectorAll("input[name='bottom-nav']");
    radios.forEach(r => r.checked = false);

    switch(tela){
        case "tela-perfil": radios[0].checked = true; break;
        case "tela-registro": radios[1].checked = true; break;
        case "tela-configurações": radios[2].checked = true; break;
        case "tela-login": radios[3].checked = true; break;
    }
}
// =======================
// LOGIN
// =======================
if (document.getElementById("btn-entrar")) {
    document.getElementById("btn-entrar").onclick = () => {
        const u = document.getElementById("usuario").value.trim().toLowerCase();
        const s = document.getElementById("senha").value.trim();
        const us = carregarLS("usuarios");
        const erro = document.getElementById("erro-login");

        erro.innerText = "";

        if (u in us && us[u].numero === s) {
            window.usuario_atual = u;
            mostrar("tela-perfil");
        } else {
            erro.innerText = "Usuário ou senha incorretos.";
        }
    };
}

// =======================
// BOTÕES LOGIN / CADASTRO
// =======================
document.getElementById("btn-abrir-cadastro").onclick = () => mostrar("tela-cadastro");
document.getElementById("btn-voltar-login").onclick = () => mostrar("tela-login");

// --- TOGGLE DE SENHA ---
const senhaInput = document.getElementById("senha");
const toggleSenhaBtn = document.getElementById("toggle-senha");

if (senhaInput && toggleSenhaBtn) {
    toggleSenhaBtn.addEventListener("click", () => {
        const mostrarSenha = senhaInput.type === "password";
        senhaInput.type = mostrarSenha ? "text" : "password";
        toggleSenhaBtn.setAttribute("aria-label", mostrarSenha ? "Ocultar senha" : "Mostrar senha");
    });
}

// =======================
// CADASTRO
// =======================
if (document.getElementById("btn-salvar-cadastro")) {
    document.getElementById("btn-salvar-cadastro").onclick = () => {
        const u = document.getElementById("cad-colaborador").value.trim().toLowerCase();
        const n = document.getElementById("cad-numero").value.trim();
        const erro = document.getElementById("erro-cadastro");

        erro.innerText = "";
        if (!u || !n) {
            erro.innerText = "Preencha todos os campos";
            return;
        }

        const us = carregarLS("usuarios");
        us[u] = { display_name: u, numero: n };
        salvarLS("usuarios", us);

        document.getElementById("usuario").value = u;
        document.getElementById("senha").value = n;

        mostrar("tela-login");
    };
}

// =======================
// BOTÕES INTERNOS (voltar)
// =======================
if (document.getElementById("btn-configurações-voltar"))
    document.getElementById("btn-configurações-voltar").onclick = () => mostrar("tela-perfil");

if (document.getElementById("btn-registro-voltar"))
    document.getElementById("btn-registro-voltar").onclick = () => mostrar("tela-perfil");

// ======================================================
// === LISTENER UNIFICADO DO BOTTOM-NAV (radios)
// ======================================================
const bottomRadios = document.querySelectorAll("#bottom-nav input[name='bottom-nav']");

bottomRadios.forEach((radio, index) => {
    radio.addEventListener("change", () => {
        switch(index){
            case 0: mostrar("tela-perfil"); break;
            case 1:
                if(typeof iniciarRegistro === "function") iniciarRegistro();
                mostrar("tela-registro");
                break;
            case 2: mostrar("tela-configurações"); break;
            case 3:
                window.usuario_atual = null;
                mostrar("tela-login");
                break;
        }
    });
});

// =======================
// CARDS FLIP
// =======================
const cards = document.querySelectorAll('.card');
cards.forEach(card => {
    card.addEventListener('click', () => {
        const flip = card.querySelector('.flip');
        flip.style.transform =
            flip.style.transform === 'rotateY(180deg)' ? 'rotateY(0deg)' : 'rotateY(180deg)';
    });
});

    // Função para ajustar a altura do viewport (mantida)
function ajustarAlturaViewport() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
}
window.addEventListener('load', ajustarAlturaViewport);
window.addEventListener('resize', ajustarAlturaViewport);

// Função de geração de CSV (mantida)
if (document.getElementById("btn-gerar-csv")) {
    document.getElementById("btn-gerar-csv").onclick = () => {
        let linhas = ["Data,Entrada,Saída Almoço,Retorno,Saída Final"];
        for (const d in window.registros) {
            const r = window.registros[d];
            linhas.push(`${d},${r.entrada},${r.saida_alm},${r.retorno},${r.saida_final}`);
        }
        const blob = new Blob([linhas.join("\n")], { type: "text/csv" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `horas_${window.usuario_atual}.csv`;
        a.click();
    };
}

// Elementos da foto de perfil
const btnGerirFoto = document.getElementById('btn-gerir-foto');
const popupOpcoesFoto = document.getElementById('popup-opcoes-foto');
const btnAdicionarNovaFoto = document.getElementById('btn-adicionar-nova-foto');
const btnRemoverFoto = document.getElementById('btn-remover-foto');
const fileInput = document.getElementById('file-input');
const profileImageDisplay = document.getElementById('profile-image-display');
const fotoContainer = document.querySelector('.foto-container');

if (btnGerirFoto && popupOpcoesFoto && btnAdicionarNovaFoto && btnRemoverFoto && fileInput && profileImageDisplay && fotoContainer) {

    // Abrir/fechar popup
    btnGerirFoto.onclick = (e) => {
        e.stopPropagation();
        popupOpcoesFoto.style.display = (popupOpcoesFoto.style.display === 'block') ? 'none' : 'block';
    };
    document.addEventListener('click', () => { popupOpcoesFoto.style.display = 'none'; });
    popupOpcoesFoto.addEventListener('click', e => e.stopPropagation());

    // Adicionar nova foto
    btnAdicionarNovaFoto.onclick = () => {
        fileInput.value = '';
        fileInput.click();
    };

    // Remover foto
    btnRemoverFoto.onclick = () => {
        if (!window.usuario_atual) {
            alert("Usuário não definido. Não é possível remover a foto.");
            return;
        }
        localStorage.removeItem(`profile_pic_${window.usuario_atual}`);
        profileImageDisplay.src = '';
        fotoContainer.classList.add('no-photo');
        fileInput.value = '';
        alert("Foto removida.");
    };

    // Upload de foto
    fileInput.addEventListener('change', function() {
        const file = this.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            profileImageDisplay.src = e.target.result;

            if (!window.usuario_atual) {
                alert("Usuário não definido. Foto não será salva.");
                return;
            }

            try {
                localStorage.setItem(`profile_pic_${window.usuario_atual}`, e.target.result);
                fotoContainer.classList.remove('no-photo');
                console.log("Foto salva com sucesso!");
            } catch (err) {
                console.error("Erro ao salvar foto no localStorage:", err);
                alert("Erro ao salvar a foto. Talvez a imagem seja muito grande.");
            }
        };
        reader.readAsDataURL(file);
    });

    // Função para carregar a foto
    function loadProfilePic() {
        if (!window.usuario_atual) {
            profileImageDisplay.src = '';
            fotoContainer.classList.add('no-photo');
            console.warn("Usuário não definido. Foto não carregada.");
            return;
        }

        const savedPic = localStorage.getItem(`profile_pic_${window.usuario_atual}`);
        if (savedPic) {
            profileImageDisplay.src = savedPic;
            fotoContainer.classList.remove('no-photo');
            console.log("Foto carregada do localStorage.");
        } else {
            profileImageDisplay.src = '';
            fotoContainer.classList.add('no-photo');
        }
    }

    // Garantir que a função de load só rode depois que o usuário estiver definido
    function waitForUserAndLoad() {
        if (window.usuario_atual) {
            loadProfilePic();
        } else {
            setTimeout(waitForUserAndLoad, 100); // tenta novamente em 100ms
        }
    }
    waitForUserAndLoad();
}

document.querySelectorAll("#bottom-nav button").forEach(btn=>{
    btn.onclick = ()=>{
        const tela = btn.dataset.tela;
        mostrar(tela);
    }
});


}); // DOMContentLoaded
