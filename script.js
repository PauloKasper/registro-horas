document.addEventListener("DOMContentLoaded", () => {
// on iOS Safari
window.navigator.standalone

// on Android Chrome
window.matchMedia(
  '(display-mode: standalone)'
).matches

    let usuario_atual = null, registros = {};

    // --- REGISTRO DO SERVICE WORKER ---
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("/service-worker.js")
            .then(() => console.log("Service Worker registrado"))
            .catch(err => console.error("Erro ao registrar Service Worker:", err));
    }

    // --- LOCAL STORAGE ---
    function salvarLS(c, v) { localStorage.setItem(c, JSON.stringify(v)); }
    function carregarLS(c) { return JSON.parse(localStorage.getItem(c) || "{}"); }

    // --- FUNÇÕES NOVAS PARA CALCULO E GESTÃO DO PLACAR ---

    // Função para calcular o total de horas a partir dos registros de um dia
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
        return (manha + tarde) / 60; // Retorna total em horas (float)
    }

    // Função para calcular o valor do vale (AJUSTE CONFORME SUA REGRA REAL)
    function calcularValeRefeicao(diasTrabalhados) {
        // Agora o valor por dia é de 8 euros, conforme pedido.
        const valorPorDia = 8.00;
        return diasTrabalhados * valorPorDia;
    }

    // Função que calcula o placar total do mês a partir de 'registros'
    function calcularPlacarTotal() {
        let totalHoras = 0;
        let diasTrabalhados = 0;

        for (const data in registros) {
            const horasNoDia = calcularHorasDoDia(registros[data]);
            if (horasNoDia > 0) {
                totalHoras += horasNoDia;
                diasTrabalhados += 1;
            }
        }

        const estimativaVale = calcularValeRefeicao(diasTrabalhados);
        return { totalHoras, diasTrabalhados, estimativaVale };
    }

       // Função para atualizar os elementos visuais na tela de perfil (AJUSTADA PARA MOSTRAR DIAS E ESTIMATIVA)
    function atualizarCardsPerfil() {
        const placar = calcularPlacarTotal();

        // Atualiza o primeiro card (Dias/Horas)
        const elDiasFront = document.getElementById('dias-front');
        const elHorasBack = document.getElementById('horas-back');
        if (elDiasFront && elHorasBack) {
    // Dias no lado 'front'
    elDiasFront.style.display = 'flex';
    elDiasFront.style.flexDirection = 'column';
    elDiasFront.style.justifyContent = 'center';
    elDiasFront.style.alignItems = 'center';
    elDiasFront.style.height = '100%';

    elDiasFront.innerHTML = `
      <span style="margin-bottom: 10px;">Dias:</span>
      <strong style="font-size: 1.2em;">${placar.diasTrabalhados.toFixed()}</strong>
    `;

    // Horas no lado 'back'
    elHorasBack.style.display = 'flex';
    elHorasBack.style.flexDirection = 'column';
    elHorasBack.style.justifyContent = 'center';
    elHorasBack.style.alignItems = 'center';
    elHorasBack.style.height = '100%';

    elHorasBack.innerHTML = `
      <span style="margin-bottom: 10px;">Total:</span>
      <strong style="font-size: 1.2em;">${placar.totalHoras.toFixed(2)}h</strong>
    `;
}


        // Atualiza o segundo card (Refeição/Estimativa)
        const elRefeicaoFront = document.getElementById('refeicao-front');
        const elEstimativaBack = document.getElementById('estimativa-back');
       if (elRefeicaoFront && elEstimativaBack) {
    // Frente do card (Refeição)
    elRefeicaoFront.style.display = 'flex';
    elRefeicaoFront.style.flexDirection = 'column';
    elRefeicaoFront.style.justifyContent = 'center';
    elRefeicaoFront.style.alignItems = 'center';
    elRefeicaoFront.style.height = '100%';
    elRefeicaoFront.innerHTML = `
        <span style="margin-bottom: 10px;">Refeição</span>
    `;

    // Verso do card (Estimativa)
    elEstimativaBack.style.display = 'flex';
    elEstimativaBack.style.flexDirection = 'column';
    elEstimativaBack.style.justifyContent = 'center';
    elEstimativaBack.style.alignItems = 'center';
    elEstimativaBack.style.height = '100%';
    elEstimativaBack.innerHTML = `
        <span style="margin-bottom: 10px;">Estimativa:</span>
        <strong style="font-size: 1.2em;">€ ${placar.estimativaVale.toFixed(2)}</strong>
    `;
}

    }


    // Ouvir o evento personalizado para atualizações em tempo real entre telas/abas
    window.addEventListener('dadosPWAHorasAtualizados', atualizarCardsPerfil);
    // --- FUNÇÃO PARA TROCAR TELAS (SUBSTITUIR EXISTENTE) ---
    function mostrar(tela) {
        document.querySelectorAll(".tela").forEach(t => t.classList.remove("ativa"));
        document.getElementById(tela).classList.add("ativa");
        if (tela === 'tela-perfil') {
            const btnConfig = document.getElementById("btn-configuracoes-perfil");
            if (btnConfig) btnConfig.onclick = () => mostrar("tela-configurações");
            // Adicionado: Atualiza os cartões sempre que entrar na tela de perfil
            atualizarCardsPerfil();
        }
    }
    window.mostrar = mostrar;

    // --- LOGIN ---
    if (document.getElementById("btn-entrar")) {
        document.getElementById("btn-entrar").onclick = () => {
            const u = document.getElementById("usuario").value.trim().toLowerCase();
            const s = document.getElementById("senha").value.trim();
            const us = carregarLS("usuarios");
            const erro = document.getElementById("erro-login");
            erro.innerText = "";
            if (u in us && us[u].numero === s) {
                usuario_atual = u;
                const usuarioLogadoEl = document.getElementById("usuario-logado");
                if (usuarioLogadoEl) usuarioLogadoEl.innerText = "Usuário: " + us[u].display_name;
                iniciarRegistro();
                mostrar("tela-perfil");
            } else {
                erro.innerText = "Usuário ou senha incorretos.";
            }
        };
    }
    if (document.getElementById("btn-abrir-cadastro")) document.getElementById("btn-abrir-cadastro").onclick = () => mostrar("tela-cadastro");
    if (document.getElementById("btn-voltar-login")) document.getElementById("btn-voltar-login").onclick = () => mostrar("tela-login");

    // --- CADASTRO ---
    if (document.getElementById("btn-salvar-cadastro")) {
        document.getElementById("btn-salvar-cadastro").onclick = () => {
            const u = document.getElementById("cad-colaborador").value.trim().toLowerCase();
            const n = document.getElementById("cad-numero").value.trim();
            const erro = document.getElementById("erro-cadastro");
            erro.innerText = "";
            if (!u || !n) { erro.innerText = "Preencha todos os campos"; return; }
            const us = carregarLS("usuarios");
            us[u] = { display_name: u, numero: n };
            salvarLS("usuarios", us);
            document.getElementById("usuario").value = u;
            document.getElementById("senha").value = n;
            mostrar("tela-login");
        };
    }

    // --- REGISTRO ---
    function gerarPeriodo() {
        const hoje = new Date();
        let inicio = hoje.getDate() < 20 ? new Date(hoje.getFullYear(), hoje.getMonth() - 1, 20) : new Date(hoje.getFullYear(), hoje.getMonth(), 20);
        let fim = new Date(inicio); fim.setDate(inicio.getDate() + 30);
        return [inicio, fim];
    }

    async function buscarFeriados(ano, pais = 'PT') {
        const cacheKey = `feriados_${pais}_${ano}`;
        const cache = localStorage.getItem(cacheKey);
        if (cache) return JSON.parse(cache).map(d => new Date(d));
        try {
            const resp = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${ano}/${pais}`);
            if (!resp.ok) return [];
            const feriadosData = await resp.json();
            const datas = feriadosData.map(h => h.date);
            localStorage.setItem(cacheKey, JSON.stringify(datas));
            return datas.map(d => new Date(d));
        } catch (e) { console.error("Erro ao buscar feriados:", e); return []; }
    }

    function isWeekend(date) { return date.getDay() === 0 || date.getDay() === 6; }
    function isHoliday(date, holidays) { return holidays.some(h => h.toDateString() === date.toDateString()); }

    // --- INICIAR REGISTRO (SUBSTITUIR EXISTENTE) ---
    async function iniciarRegistro() {
        registros = carregarLS("horas_" + usuario_atual) || {};
        const lista = document.getElementById("lista-dias");
        if (!lista) return;
        lista.innerHTML = "";
        const [inicio, fim] = gerarPeriodo();
        const feriados = await buscarFeriados(inicio.getFullYear());

        for (let d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) {
            const ds = d.toLocaleDateString("pt-PT");
            const r = registros[ds] || { entrada: "", saida_alm: "", retorno: "", saida_final: "" };
            const div = document.createElement("div"); div.className = "card-dia";
            const weekend = isWeekend(d);
            const holiday = isHoliday(d, feriados);
            if (weekend && holiday) div.style.backgroundColor = "#fcf8e3";
            else if (weekend) div.style.backgroundColor = "#f2dede";
            else if (holiday) div.style.backgroundColor = "#d9edf7";
            let destaqueTexto = "";
            if (weekend) destaqueTexto += "Final de Semana";
            if (holiday) destaqueTexto += (destaqueTexto ? " / " : "") + "Feriado";
            let destaqueHTML = destaqueTexto ? `<div class="destaque">${destaqueTexto}</div>` : "";
            div.innerHTML = `${destaqueHTML}<strong>${ds}</strong>
                <div class="campo"><label>Entrada</label><input id="e_${ds}" value="${r.entrada}"><div class="erro-hora"></div></div>
                <div class="campo"><label>Saída Almoço</label><input id="s_${ds}" value="${r.saida_alm}"><div class="erro-hora"></div></div>
                <div class="campo"><label>Retorno</label><input id="r_${ds}" value="${r.retorno}"><div class="erro-hora"></div></div>
                <div class="campo"><label>Saída Final</label><input id="f_${ds}" value="${r.saida_final}"><div class="erro-hora"></div></div>
                <button class="btn-salvar-dia" onclick="salvarDia('${ds}')">Salvar</button>`;
            lista.appendChild(div);
        }
        // Adicionado: Carrega os dados do perfil após carregar a lista de registro
        atualizarCardsPerfil();
    }
    // --- SALVAR DIA (SUBSTITUIR EXISTENTE) ---
    window.salvarDia = (d) => {
        // 1. Captura os valores dos inputs
        const entrada = document.getElementById("e_" + d).value.trim();
        const saida_alm = document.getElementById("s_" + d).value.trim();
        const retorno = document.getElementById("r_" + d).value.trim();
        const saida_final = document.getElementById("f_" + d).value.trim();

        // 2. Atualiza o objeto 'registros' global
        registros[d] = { entrada, saida_alm, retorno, saida_final };

        // 3. Salva TUDO no LocalStorage
        salvarLS("horas_" + usuario_atual, registros);

        // 4. ATUALIZA OS CARDS DO PERFIL EM TEMPO REAL
        atualizarCardsPerfil();

        // 5. Dispara um evento para comunicar a outra tela (se estiver aberta em outra aba)
        window.dispatchEvent(new Event('dadosPWAHorasAtualizados'));

        alert("Salvo! O placar do perfil foi atualizado.");
    };

    // --- GERAR CSV ---
    if (document.getElementById("btn-gerar-csv")) {
        document.getElementById("btn-gerar-csv").onclick = () => {
            let linhas = ["Data,Entrada,Saída Almoço,Retorno,Saída Final"];
            for (const d in registros) {
                const r = registros[d];
                linhas.push(`${d},${r.entrada},${r.saida_alm},${r.retorno},${r.saida_final}`);
            }
            const blob = new Blob([linhas.join("\n")], { type: "text/csv" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `horas_${usuario_atual}.csv`;
            a.click();
        };
    }

    // --- BOTÕES ---
    if(document.getElementById("btn-configurações-voltar")) document.getElementById("btn-configurações-voltar").onclick = () => mostrar("tela-perfil");
    if(document.getElementById("btn-registrar-hora")) document.getElementById("btn-registrar-hora").onclick = () => mostrar("tela-registro");
    if(document.getElementById("btn-registro-voltar")) document.getElementById("btn-registro-voltar").onclick = () => mostrar("tela-perfil");
    if(document.getElementById("btn-logout-perfil")) document.getElementById("btn-logout-perfil").onclick = () => mostrar("tela-login");

    // --- PERFIL E UPLOAD DE FOTO ---
    const btnGerirFoto = document.getElementById('btn-gerir-foto');
    const popupOpcoesFoto = document.getElementById('popup-opcoes-foto');
    const btnAdicionarNovaFoto = document.getElementById('btn-adicionar-nova-foto');
    const btnRemoverFoto = document.getElementById('btn-remover-foto');
    const fileInput = document.getElementById('file-input');
    const profileImageDisplay = document.getElementById('profile-image-display');
    const defaultProfilePicUrl = 'URL_DA_SUA_FOTO_PADRAO.jpg'; // Substitua pela sua URL padrão

    if (btnGerirFoto && popupOpcoesFoto && btnAdicionarNovaFoto && btnRemoverFoto && fileInput && profileImageDisplay) {
        btnGerirFoto.onclick = (e) => { e.stopPropagation(); popupOpcoesFoto.style.display = (popupOpcoesFoto.style.display === 'block') ? 'none' : 'block'; };
        document.addEventListener('click', () => { popupOpcoesFoto.style.display = 'none'; });
        popupOpcoesFoto.addEventListener('click', (e) => { e.stopPropagation(); });

        btnAdicionarNovaFoto.onclick = () => { fileInput.value=''; fileInput.click(); };
        btnRemoverFoto.onclick = () => {
            if(usuario_atual){
                localStorage.removeItem(`profile_pic_${usuario_atual}`);
                profileImageDisplay.src = defaultProfilePicUrl;
                fileInput.value='';
                alert("Foto de perfil removida.");
            }
        };
        fileInput.addEventListener('change', function() {
            const file = this.files[0];
            if(file){
                const reader = new FileReader();
                reader.onload = function(e){
                    profileImageDisplay.src = e.target.result;
                    if(usuario_atual) localStorage.setItem(`profile_pic_${usuario_atual}`, e.target.result);
                };
                reader.readAsDataURL(file);
            }
        });

        function loadProfilePic() {
            if(usuario_atual){
                const savedPic = localStorage.getItem(`profile_pic_${usuario_atual}`);
                profileImageDisplay.src = savedPic || defaultProfilePicUrl;
            } else profileImageDisplay.src = defaultProfilePicUrl;
        }
        loadProfilePic();
    }

}); // Fim do DOMContentLoaded

const cards = document.querySelectorAll('.card');

cards.forEach(card => {
    card.addEventListener('click', () => {
        const flip = card.querySelector('.flip');
        flip.style.transform = flip.style.transform === 'rotateY(180deg)' ? 'rotateY(0deg)' : 'rotateY(180deg)';
    });

  // Calcula a altura real da viewport e salva em uma variável CSS
function ajustarAlturaViewport() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
}

// Executa na carga da página
window.addEventListener('load', ajustarAlturaViewport);

// Recalcula se o usuário rotacionar o celular ou redimensionar a tela
window.addEventListener('resize', ajustarAlturaViewport);
});
