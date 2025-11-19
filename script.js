document.addEventListener("DOMContentLoaded", () => {
    let usuario_atual = null, registros = {};
    window.addEventListener('dadosPWAHorasAtualizados', atualizarCardsPerfil);


    // --- SERVICE WORKER ---
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("/service-worker.js")
            .then(() => console.log("Service Worker registrado"))
            .catch(err => console.error("Erro ao registrar Service Worker:", err));
    }

    // --- LOCAL STORAGE ---
    function salvarLS(c, v) { localStorage.setItem(c, JSON.stringify(v)); }
    function carregarLS(c) { return JSON.parse(localStorage.getItem(c) || "{}"); }

    // --- CÁLCULO DE HORAS ---
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

    // ---------- Ajuste: contar apenas dias "salvos" no placar ----------
    function calcularPlacarTotal() {
        let totalHoras = 0;
        let diasTrabalhados = 0;

        for (const data in registros) {
            const r = registros[data];

            // Conta só se o dia foi salvo manualmente
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

    // --- ATUALIZAÇÃO DOS CARDS ---
    function atualizarCardsPerfil() {

        // Apenas evita que o código tente resetar os cards indevidamente
        const resetPendente = carregarLS("aguardar_reset_cards_" + usuario_atual);
        if (resetPendente) {
            console.log("Reset pendente — mas cards continuarão exibindo normalmente até o primeiro salvamento.");
        }

        const placar = calcularPlacarTotal();

        // Dias / Horas
        const elDiasFront = document.getElementById('dias-front');
        const elHorasBack = document.getElementById('horas-back');
        if (elDiasFront && elHorasBack) {
            elDiasFront.innerHTML = `<span>Dias:</span><strong>${placar.diasTrabalhados}</strong>`;
            elHorasBack.innerHTML = `<span>Total:</span><strong>${placar.totalHoras.toFixed(2)}h</strong>`;
        }

        // Refeição / Estimativa
        const elRefeicaoFront = document.getElementById('refeicao-front');
        const elEstimativaBack = document.getElementById('estimativa-back');
        if (elRefeicaoFront && elEstimativaBack) {
            elRefeicaoFront.innerHTML = `<span>Refeição</span>`;
            elEstimativaBack.innerHTML = `<span>Estimativa:</span><strong>€ ${placar.estimativaVale.toFixed(2)}</strong>`;
        }
    }

    function resetarCardsPerfilEInputs() {
        // --- Reset dos cards visuais ---
        resetarCardsPerfil(); // mantém a sua função atual

        // --- Reset dos campos de entrada ---
        const lista = document.getElementById("lista-dias");
        if (!lista) return;

        lista.querySelectorAll("input").forEach(input => {
            input.value = ""; // limpa o valor
            const erroDiv = input.parentElement.querySelector(".erro-hora");
            if (erroDiv) erroDiv.textContent = ""; // limpa erros visuais
            input.style.border = ""; // remove borda de erro
        });
    }

    function resetarCardsPerfil() {
        // Zerar dados usados no placar (visual)
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

    window.addEventListener('dadosPWAHorasAtualizados', atualizarCardsPerfil);

    // --- TROCA DE TELAS ---
    function mostrar(tela) {
        document.querySelectorAll(".tela").forEach(t => t.classList.remove("ativa"));
        document.getElementById(tela).classList.add("ativa");
        if (tela === 'tela-perfil') {
            const btnConfig = document.getElementById("btn-configuracoes-perfil");
            if (btnConfig) btnConfig.onclick = () => mostrar("tela-configurações");
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
            } else erro.innerText = "Usuário ou senha incorretos.";
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
        if (cache) return JSON.parse(cache); // já retorna array de { date, name }

        try {
            const resp = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${ano}/${pais}`);
            if (!resp.ok) return [];
            const feriadosData = await resp.json();
            const datas = feriadosData.map(h => ({ date: h.date, name: h.localName })); // nome local
            localStorage.setItem(cacheKey, JSON.stringify(datas));
            return datas;
        } catch (e) {
            console.error("Erro ao buscar feriados:", e);
            return [];
        }
    }

    function isWeekend(date) { return date.getDay() === 0 || date.getDay() === 6; }
    function isHoliday(date, holidays) { return holidays.some(h => h.toDateString() === date.toDateString()); }

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
        // Remove o caractere de dois pontos antes de validar, para simplificar.
        let valor = input.value.trim().replace(":", "");

        // Se estiver vazio, não mostra erro
        if (valor === "") {
            if (erroDiv) erroDiv.textContent = "";
            input.style.border = "";
            return true; // campo vazio é permitido
        }

        // Apenas números permitidos na entrada bruta
        if (!/^\d{1,4}$/.test(valor)) { // permite 1 a 4 dígitos ou HHMM
            if (erroDiv) {
                erroDiv.textContent = "Formato inválido (ex: 1030 ou 10:30)!";
                erroDiv.style.color = "red";
            }
            input.style.border = "2px solid red";
            return false;
        }

        // Lógica adicional para verificar se os valores de HH e MM são válidos
        if (valor.length > 2) {
            const horas = parseInt(valor.slice(0, -2), 10);
            const minutos = parseInt(valor.slice(-2), 10);
            if (horas > 23 || minutos > 59) {
                if (erroDiv) {
                    erroDiv.textContent = "Hora inválida (máx 23:59)!";
                    erroDiv.style.color = "red";
                }
                input.style.border = "2px solid red";
                return false;
            }
        }
        // Se passou nos testes, limpa erro
        if (erroDiv) erroDiv.textContent = "";
        input.style.border = "";
        return true;
    }

    function isCycleComplete() {
        const [inicio, fim] = gerarPeriodo();
        let currentDate = new Date(inicio);
        const feriados = carregarLS(`feriados_PT_${inicio.getFullYear()}`) || [];

        while (currentDate <= fim) {
            const key = formatarDataParaKey(currentDate); // <-- usar a chave correta
            const r = registros[key];

            const weekend = isWeekend(currentDate);
            const holiday = isHoliday(currentDate, feriados.map(d => new Date(d)));

            if (!weekend && !holiday) {
                if (!r || !r.entrada || !r.saida_alm || !r.retorno || !r.saida_final) {
                    console.log(`DEBUG: Dia de trabalho incompleto: ${key}`);
                    return false;
                }
            } else {
                if (r && (!r.entrada || !r.saida_alm || !r.retorno || !r.saida_final)) {
                    console.log(`DEBUG: Dia de fim de semana/feriado incompleto: ${key}`);
                    return false;
                }
            }

            currentDate.setDate(currentDate.getDate() + 1);
        }

        console.log(`DEBUG: Todos os dias de trabalho no ciclo estão completos.`);
        return true;
    }

    // --- Função utilitária para padronizar chaves de datas ---
    function formatarDataParaKey(date) {
        if (typeof date === "string") {
            const parts = date.split('/');
            return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`; // YYYY-MM-DD
        }
        return date.toISOString().split('T')[0]; // para objetos Date
    }

    // --- Função para resetar todos os registros ---
    function resetAllHours() {
        registros = {}; // limpa memória
        salvarLS("horas_" + usuario_atual, registros); // limpa LS do usuário
        iniciarRegistro(); // reconstrói a lista de dias
    }

    // --- Função para iniciar o registro e montar lista de dias ---
    async function iniciarRegistro() {
        registros = carregarLS("horas_" + usuario_atual) || {};
        const lista = document.getElementById("lista-dias");
        if (!lista) return;
        lista.innerHTML = "";

        const [inicio, fim] = gerarPeriodo();
        const feriados = await buscarFeriados(inicio.getFullYear());

        for (let d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) {
            const key = formatarDataParaKey(d); // chave padronizada
            const r = registros[key] || { entrada: "", saida_alm: "", retorno: "", saida_final: "" };

            const div = document.createElement("div");
            div.className = "card-dia";

            const weekend = isWeekend(d);
            const holiday = isHoliday(d, feriados.map(f => new Date(f)));

            // Destaque visual
            let destaqueTexto = "";
            div.style.backgroundColor = ""; // cor padrão
            if (weekend) {
                destaqueTexto = "Fim de semana";
                div.style.backgroundColor = "#f0f0f0"; // cinza claro
            } else if (holiday) {
                destaqueTexto = "Feriado";
                div.style.backgroundColor = "#ffe0e0"; // rosa claro
            } else {
                div.style.backgroundColor = "#e0f7ff"; // azul claro para dias úteis
            }

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

    // --- Função para salvar um dia ---
window.salvarDia = async (d) => {
    const entrada = document.getElementById("e_" + d).value.trim();
    const saida_alm = document.getElementById("s_" + d).value.trim();
    const retorno = document.getElementById("r_" + d).value.trim();
    const saida_final = document.getElementById("f_" + d).value.trim();

    if (!entrada || !saida_alm || !retorno || !saida_final) {
        alert("Por favor, preencha todos os 4 campos de hora antes de salvar este dia.");
        return;
    }

    // Detecta se é o primeiro registro do ciclo atual
    const primeiroRegistro = Object.keys(registros).length === 0;

    // Salva o dia atual como "salvo"
    registros[d] = { entrada, saida_alm, retorno, saida_final, salvo: true };
    salvarLS("horas_" + usuario_atual, registros);

    // --- Auto-preenchimento dos demais dias úteis ---
    if (primeiroRegistro) {
        const [inicio, fim] = gerarPeriodo();
        const feriados = await buscarFeriados(inicio.getFullYear());

        for (let dt = new Date(inicio); dt <= fim; dt.setDate(dt.getDate() + 1)) {
            const key = formatarDataParaKey(dt);
            if (key === d) continue; // não sobrescreve o dia salvo

            const weekend = isWeekend(dt);
            const holiday = feriados.some(f => f.date === key);

            if (!weekend && !holiday) {
                const r = registros[key];
                const vazio = !r || (!r.entrada && !r.saida_alm && !r.retorno && !r.saida_final);

                if (vazio) {
                    registros[key] = { entrada, saida_alm, retorno, saida_final, salvo: false };
                }
            }
        }
        salvarLS("horas_" + usuario_atual, registros);
        iniciarRegistro();
    }

    atualizarCardsPerfil();

    // --- Detecta se este é o último dia do ciclo ---
    const [inicio, fim] = gerarPeriodo();
    let ultimoDia = null;
    for (let dt = new Date(inicio); dt <= fim; dt.setDate(dt.getDate() + 1)) {
        const key = formatarDataParaKey(dt);
        const weekend = isWeekend(dt);
        const holiday = (await buscarFeriados(dt.getFullYear())).some(f => f.date === key);
        if (!weekend && !holiday) ultimoDia = key;
    }

    if (d === ultimoDia) {
        const placar = calcularPlacarTotal();
        mostrarPopupCiclo(placar);
    }

    window.dispatchEvent(new Event('dadosPWAHorasAtualizados'));
};

// --- Função do popup ---
function mostrarPopupCiclo(placar) {
    const popup = document.getElementById("popup-ciclo");
    const texto = document.getElementById("popup-text");
    texto.innerHTML = `Dias trabalhados: <strong>${placar.diasTrabalhados}</strong><br>
                       Total de horas: <strong>${placar.totalHoras.toFixed(2)}h</strong><br>
                       Estimativa de refeição: <strong>€ ${placar.estimativaVale.toFixed(2)}</strong>`;
    popup.style.display = "flex";

    document.getElementById("popup-fechar").onclick = () => {
        popup.style.display = "none";
        // Reset apenas após fechar popup do último dia
        registros = {};
        salvarLS("horas_" + usuario_atual, registros);
        iniciarRegistro();
    };
}

    // --- GERAR CSV ---
    if (document.getElementById("btn-gerar-csv")) {
        document.getElementById("btn-gerar-csv").onclick = () => {
            let linhas = ["Data,Entrada,Saída Almoço,Retorno,Saída Final"];
            for(const d in registros){
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

    // --- FOTO DE PERFIL ---
    const btnGerirFoto = document.getElementById('btn-gerir-foto');
    const popupOpcoesFoto = document.getElementById('popup-opcoes-foto');
    const btnAdicionarNovaFoto = document.getElementById('btn-adicionar-nova-foto');
    const btnRemoverFoto = document.getElementById('btn-remover-foto');
    const fileInput = document.getElementById('file-input');
    const profileImageDisplay = document.getElementById('profile-image-display');
    const defaultProfilePicUrl = 'URL_DA_SUA_FOTO_PADRAO.jpg';

    if(btnGerirFoto && popupOpcoesFoto && btnAdicionarNovaFoto && btnRemoverFoto && fileInput && profileImageDisplay){
        btnGerirFoto.onclick = (e)=>{ e.stopPropagation(); popupOpcoesFoto.style.display=(popupOpcoesFoto.style.display==='block')?'none':'block'; };
        document.addEventListener('click',()=>{popupOpcoesFoto.style.display='none';});
        popupOpcoesFoto.addEventListener('click', e=>e.stopPropagation());
        btnAdicionarNovaFoto.onclick=()=>{ fileInput.value=''; fileInput.click(); };
        btnRemoverFoto.onclick=()=>{
            if(usuario_atual){ localStorage.removeItem(`profile_pic_${usuario_atual}`); profileImageDisplay.src=defaultProfilePicUrl; fileInput.value=''; alert("Foto removida."); }
        };
        fileInput.addEventListener('change', function(){
            const file = this.files[0];
            if(file){ const reader = new FileReader(); reader.onload=function(e){ profileImageDisplay.src=e.target.result; if(usuario_atual)localStorage.setItem(`profile_pic_${usuario_atual}`, e.target.result); }; reader.readAsDataURL(file); }
        });
        function loadProfilePic(){
            if(usuario_atual){ const savedPic=localStorage.getItem(`profile_pic_${usuario_atual}`); profileImageDisplay.src=savedPic||defaultProfilePicUrl; }
            else profileImageDisplay.src=defaultProfilePicUrl;
        }
        loadProfilePic();
    }

    // --- FLIP DOS CARDS ---
    const cards = document.querySelectorAll('.card');
    cards.forEach(card=>{
        card.addEventListener('click', ()=>{
            const flip = card.querySelector('.flip');
            flip.style.transform = flip.style.transform==='rotateY(180deg)'?'rotateY(0deg)':'rotateY(180deg)';
        });
    });

    // Ajusta altura da viewport
    function ajustarAlturaViewport(){
        const vh = window.innerHeight*0.01;
        document.documentElement.style.setProperty('--vh',`${vh}px`);
    }
    window.addEventListener('load', ajustarAlturaViewport);
    window.addEventListener('resize', ajustarAlturaViewport);

}); // DOMContentLoaded
