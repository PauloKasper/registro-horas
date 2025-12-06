document.addEventListener("DOMContentLoaded", () => {

    // --- VARIÁVEIS GLOBAIS (únicas fontes) ---
    window.usuario_atual = null;
    window.registros = {}; // única fonte de verdade para registros (map date -> {entrada,saida_alm,retorno,saida_final,salvo})
    let chartHoras = null;

    // --- SERVICE WORKER ---
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("/service-worker.js")
            .then(() => console.log("Service Worker registrado"))
            .catch(err => console.error("Erro ao registrar Service Worker:", err));
    }

    // --- LOCAL STORAGE HELPERS ---
    function salvarLS(c, v) { localStorage.setItem(c, JSON.stringify(v)); }
    function carregarLS(c) {
        try { return JSON.parse(localStorage.getItem(c) || "{}"); }
        catch (e) { return {}; }
    }

    // --- FUNÇÕES DE CÁLCULO ---
    function calcularHorasDoDia(r) {
        const parseHora = (h) => {
            if (!h || h.indexOf(':') === -1) return 0;
            const [horas, minutos] = h.split(':').map(Number);
            return (horas * 60) + minutos;
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

        for (const data in window.registros) {
            const r = window.registros[data];
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

        for (const data in window.registros) {
            const r = window.registros[data];
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
        const erroDiv = input.parentElement ? input.parentElement.querySelector(".erro-hora") : null;
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
            if (date.includes("-")) return date;
            const parts = date.split('/');
            return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
        }
        return date.toISOString().split('T')[0];
    }

    function isWeekend(date) { return date.getDay() === 0 || date.getDay() === 6; }

    function isHoliday(date, holidays) {
        if (!holidays || holidays.length === 0) return false;
        return holidays.some(h => {
            if (typeof h === "string") return (new Date(h)).toDateString() === date.toDateString();
            if (h && h.date) return (new Date(h.date)).toDateString() === date.toDateString();
            return (new Date(h)).toDateString() === date.toDateString();
        });
    }

  let mesAtualExibido = null; // Objeto {ano, mes} usado para navegação

function gerarPeriodo(mesAno = null) {
    // Se não passar mês/ano, pega o atual
    const hoje = new Date();
    const ano = mesAno?.ano ?? hoje.getFullYear();
    const mes = mesAno?.mes ?? hoje.getMonth();

    // Início: primeiro dia do mês
    const inicio = new Date(ano, mes, 1);
    // Fim: último dia do mês
    const fim = new Date(ano, mes + 1, 0);

    // Guarda o mês exibido
    mesAtualExibido = { ano, mes };

    return [inicio, fim];
}

// Função para ir para o mês anterior
function mesAnterior() {
    if (!mesAtualExibido) gerarPeriodo(); // garante que a variável esteja inicializada
    let { ano, mes } = mesAtualExibido;
    mes--;
    if (mes < 0) {
        mes = 11;
        ano--;
    }
    gerarCalendarioPeriodo({ ano, mes });
}

// Função para ir para o próximo mês
function proximoMes() {
    if (!mesAtualExibido) gerarPeriodo();
    let { ano, mes } = mesAtualExibido;
    mes++;
    if (mes > 11) {
        mes = 0;
        ano++;
    }
    gerarCalendarioPeriodo({ ano, mes });
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
            const holiday = isHoliday(currentDate, feriados.map(d => d.date ? d.date : d));

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

        const elDiasFront = document.getElementById('dias-front');
        const elHorasBack = document.getElementById('horas-back');
        if (elDiasFront && elHorasBack) {
            elDiasFront.innerHTML = `<span>Dias:</span><strong>${placar.diasTrabalhados}</strong>`;
            elHorasBack.innerHTML = `<span>Total:</span><strong>${placar.totalHoras.toFixed(2)}h</strong>`;
        }

        const elRefeicaoFront = document.getElementById('refeicao-front');
        const elEstimativaBack = document.getElementById('estimativa-back');
        if (elRefeicaoFront && elEstimativaBack) {
            elRefeicaoFront.innerHTML = `<span>Refeição</span>`;
            elEstimativaBack.innerHTML = `<span>Estimativa:</span><strong>€ ${placar.estimativaVale.toFixed(2)}</strong>`;
        }

        const elExtrasFront = document.getElementById('extras-front');
        const elExtrasBack = document.getElementById('extras-back');
        if (elExtrasFront && elExtrasBack) {
            elExtrasFront.innerHTML = `<span>Horas Extras</span><strong>${totalExtras.toFixed(2)}h</strong>`;
            elExtrasBack.innerHTML = `<span>Horas Negativas</span><strong>${totalHorasNegativas.toFixed(2)}h</strong>`;
        }
    }

    window.addEventListener('dadosPWAHorasAtualizados', atualizarCardsPerfil);

    // --- Modal e Calendário ---
    const calendarElId = "calendar";
    const modalHoras = document.getElementById("modal-horas");
    const modalData = document.getElementById("modal-data");
    const entrada = document.getElementById("entrada");
    const saidaAlmoco = document.getElementById("saidaAlmoco");
    const retornoAlmoco = document.getElementById("retornoAlmoco");
    const saidaFinal = document.getElementById("saidaFinal");
    const salvarHorasBtn = document.getElementById("salvar-horas");
    const fecharModalBtn = document.getElementById("fechar-modal");

    const modalAvailable = !!(modalHoras && modalData && entrada && saidaAlmoco && retornoAlmoco && saidaFinal && salvarHorasBtn && fecharModalBtn);

    function carregarRegistrosUsuario() {
        if (!window.usuario_atual) {
            window.registros = {};
            return;
        }
        window.registros = carregarLS("horas_" + window.usuario_atual) || {};
    }

    function salvarRegistrosUsuario() {
        if (!window.usuario_atual) return;
        salvarLS("horas_" + window.usuario_atual, window.registros);
    }

    function carregarHorasDoDia(dateKey) {
        const r = window.registros[dateKey] || { entrada: "", saida_alm: "", retorno: "", saida_final: "", salvo: false };
        entrada.value = r.entrada || "";
        saidaAlmoco.value = r.saida_alm || "";
        retornoAlmoco.value = r.retorno || "";
        saidaFinal.value = r.saida_final || "";
    }

    // --- FUNÇÃO ATUALIZADA PARA ZERAR REGISTROS NO ÚLTIMO DIA ---
    function salvarHorasDoDia(dateKey) {
        const dados = {
            entrada: entrada.value,
            saida_alm: saidaAlmoco.value,
            retorno: retornoAlmoco.value,
            saida_final: saidaFinal.value,
            salvo: true
        };

        const allEmpty = !dados.entrada && !dados.saida_alm && !dados.retorno && !dados.saida_final;
        if (allEmpty) {
            delete window.registros[dateKey];
        } else {
            window.registros[dateKey] = dados;
        }

        salvarRegistrosUsuario();
        window.dispatchEvent(new Event('dadosPWAHorasAtualizados'));

        // --- ZERA REGISTROS AUTOMATICAMENTE NO ÚLTIMO DIA ---
        const [inicio, fim] = gerarPeriodo();
        const ultimoDia = formatarDataParaKey(fim);

        if (dateKey === ultimoDia) {
            window.registros = {};
            salvarRegistrosUsuario();
            atualizarCardsPerfil();
            setTimeout(() => gerarCalendarioPeriodo(), 50);
        }
    }

     async function gerarCalendarioPeriodo(mesAno = null) {
        const container = document.getElementById(calendarElId);
        if (!container) return;
        container.innerHTML = "";

        const [inicio, fim] = gerarPeriodo(mesAno);

        // busca feriados
        const years = new Set();
        for (let d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) years.add(d.getFullYear());
        let feriados = [];
        for (const y of years) {
            const f = await buscarFeriados(y);
            feriados = feriados.concat(f);
        }

        // título mês
        const monthYear = document.getElementById("month-year");
        const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
                       "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
        if (monthYear) monthYear.textContent = `${meses[inicio.getMonth()]} ${inicio.getFullYear()}`;

        // dias vazios antes do 1º dia
        const startWeekday = inicio.getDay();
        for (let i = 0; i < startWeekday; i++) {
            const empty = document.createElement("div");
            empty.className = "day empty";
            container.appendChild(empty);
        }

        const hoje = new Date();
        for (let d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) {
            const key = formatarDataParaKey(d);
            const dayEl = document.createElement("div");
            dayEl.className = "day";
            dayEl.dataset.date = key;
            dayEl.textContent = d.getDate();

            if (isWeekend(d)) dayEl.classList.add("weekend");
            if (isHoliday(d, feriados)) dayEl.classList.add("feriado");
            if (d.toDateString() === hoje.toDateString()) dayEl.classList.add("hoje");
            if (window.registros && window.registros[key] && window.registros[key].salvo)
                dayEl.classList.add("registrado");

            dayEl.addEventListener("click", async (e) => {
                e.stopPropagation();
                if (!modalAvailable) {
                    const existing = window.registros[key] || {};
                    const entradaPrompt = prompt("Entrada (HH:MM)", existing.entrada || "");
                    if (entradaPrompt === null) return;
                    const saidaPrompt = prompt("Saída almoço (HH:MM)", existing.saida_alm || "");
                    if (saidaPrompt === null) return;
                    const retornoPrompt = prompt("Retorno (HH:MM)", existing.retorno || "");
                    if (retornoPrompt === null) return;
                    const saidaFinalPrompt = prompt("Saída final (HH:MM)", existing.saida_final || "");
                    if (saidaFinalPrompt === null) return;

                    window.registros[key] = {
                        entrada: entradaPrompt,
                        saida_alm: saidaPrompt,
                        retorno: retornoPrompt,
                        saida_final: saidaFinalPrompt,
                        salvo: true
                    };
                    salvarRegistrosUsuario();
                    await gerarCalendarioPeriodo(mesAtualExibido);
                    atualizarCardsPerfil();
                    return;
                }

                modalData.textContent = (new Date(key)).toLocaleDateString("pt-PT");
                modalData.dataset.key = key;
                carregarHorasDoDia(key);
                modalHoras.style.display = "flex";

                const novoSalvar = () => {
                    salvarHorasDoDia(key);
                    modalHoras.style.display = "none";
                    setTimeout(() => gerarCalendarioPeriodo(mesAtualExibido), 50);
                    atualizarCardsPerfil();
                    salvarHorasBtn.removeEventListener("click", novoSalvar);
                };
                salvarHorasBtn.addEventListener("click", novoSalvar);
            });

            container.appendChild(dayEl);
        }

        atualizarCardsPerfil();
    }

    // --- BOTOES DE NAVEGACAO ---
    const btnMesAnterior = document.getElementById("btn-mes-anterior");
    const btnProximoMes = document.getElementById("btn-proximo-mes");
    if (btnMesAnterior) btnMesAnterior.onclick = mesAnterior;
    if (btnProximoMes) btnProximoMes.onclick = proximoMes;
    if (modalAvailable) {
        fecharModalBtn.onclick = () => modalHoras.style.display = "none";
        modalHoras.addEventListener("click", (ev) => {
            if (ev.target === modalHoras) modalHoras.style.display = "none";
        });
    }

    // --- LOGIN / CADASTRO / NAVEGAÇÃO ---
    function mostrar(tela) {
        document.querySelectorAll(".tela").forEach(t => t.classList.remove("ativa"));
        const alvo = document.getElementById(tela);
        if (alvo) alvo.classList.add("ativa");

        const nav = document.getElementById("bottom-nav");
        if (nav) {
            if (tela === "tela-login" || tela === "tela-cadastro") nav.classList.add("oculto");
            else nav.classList.remove("oculto");

            const radios = nav.querySelectorAll("input[name='bottom-nav']");
            radios.forEach(r => r.checked = false);
            switch (tela) {
                case "tela-perfil": if (radios[0]) radios[0].checked = true; break;
                case "tela-registro": if (radios[1]) radios[1].checked = true; break;
                case "tela-configurações": if (radios[2]) radios[2].checked = true; break;
                case "tela-login": if (radios[3]) radios[3].checked = true; break;
            }
        }

        if (tela === "tela-registro") {
            carregarRegistrosUsuario();
            gerarCalendarioPeriodo();
        }

        if (tela === "tela-perfil") {
            carregarRegistrosUsuario();
            atualizarCardsPerfil();
        }
    }

    const btnEntrar = document.getElementById("btn-entrar");
    if (btnEntrar) {
        btnEntrar.onclick = () => {
            const u = (document.getElementById("usuario").value || "").trim().toLowerCase();
            const s = (document.getElementById("senha").value || "").trim();
            const us = carregarLS("usuarios");
            const erro = document.getElementById("erro-login");
            if (erro) erro.innerText = "";

            if (u in us && us[u].numero === s) {
                window.usuario_atual = u;
                carregarRegistrosUsuario();
                mostrar("tela-perfil");
            } else {
                if (erro) erro.innerText = "Usuário ou senha incorretos.";
            }
        };
    }

    const btnAbrirCadastro = document.getElementById("btn-abrir-cadastro");
    if (btnAbrirCadastro) btnAbrirCadastro.onclick = () => mostrar("tela-cadastro");
    const btnVoltarLogin = document.getElementById("btn-voltar-login");
    if (btnVoltarLogin) btnVoltarLogin.onclick = () => mostrar("tela-login");

    const senhaInput = document.getElementById("senha");
    const toggleSenhaBtn = document.getElementById("toggle-senha");
    if (senhaInput && toggleSenhaBtn) {
        toggleSenhaBtn.addEventListener("click", () => {
            const mostrarSenha = senhaInput.type === "password";
            senhaInput.type = mostrarSenha ? "text" : "password";
            toggleSenhaBtn.setAttribute("aria-label", mostrarSenha ? "Ocultar senha" : "Mostrar senha");
        });
    }

    const btnSalvarCadastro = document.getElementById("btn-salvar-cadastro");
    if (btnSalvarCadastro) {
        btnSalvarCadastro.onclick = () => {
            const u = (document.getElementById("cad-colaborador").value || "").trim().toLowerCase();
            const n = (document.getElementById("cad-numero").value || "").trim();
            const erro = document.getElementById("erro-cadastro");

            if (erro) erro.innerText = "";
            if (!u || !n) {
                if (erro) erro.innerText = "Preencha todos os campos";
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

    if (document.getElementById("btn-configurações-voltar"))
        document.getElementById("btn-configurações-voltar").onclick = () => mostrar("tela-perfil");
    if (document.getElementById("btn-registro-voltar"))
        document.getElementById("btn-registro-voltar").onclick = () => mostrar("tela-perfil");

    const bottomRadios = document.querySelectorAll("#bottom-nav input[name='bottom-nav']");
    bottomRadios.forEach((radio, index) => {
        radio.addEventListener("change", () => {
            switch(index){
                case 0: mostrar("tela-perfil"); break;
                case 1: mostrar("tela-registro"); break;
                case 2: mostrar("tela-configurações"); break;
                case 3:
                    window.usuario_atual = null;
                    mostrar("tela-login");
                    break;
            }
        });
    });

    const cards = document.querySelectorAll('.card');
    cards.forEach(card => {
        card.addEventListener('click', () => {
            const flip = card.querySelector('.flip');
            if (!flip) return;
            flip.style.transform =
                flip.style.transform === 'rotateY(180deg)' ? 'rotateY(0deg)' : 'rotateY(180deg)';
        });
    });

    function ajustarAlturaViewport() {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    }
    window.addEventListener('load', ajustarAlturaViewport);
    window.addEventListener('resize', ajustarAlturaViewport);

    const btnGerarCSV = document.getElementById("btn-gerar-csv");
    if (btnGerarCSV) {
        btnGerarCSV.onclick = () => {
            let linhas = ["Data,Entrada,Saída Almoço,Retorno,Saída Final"];
            for (const d in window.registros) {
                const r = window.registros[d];
                linhas.push(`${d},${r.entrada || ""},${r.saida_alm || ""},${r.retorno || ""},${r.saida_final || ""}`);
            }
            const blob = new Blob([linhas.join("\n")], { type: "text/csv" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `horas_${window.usuario_atual || "anon"}.csv`;
            a.click();
        };
    }

    // --- FOTO DE PERFIL (mantida) ---
    (function setupFoto() {
        const btnGerirFoto = document.getElementById('btn-gerir-foto');
        const popupOpcoesFoto = document.getElementById('popup-opcoes-foto');
        const btnAdicionarNovaFoto = document.getElementById('btn-adicionar-nova-foto');
        const btnRemoverFoto = document.getElementById('btn-remover-foto');
        const fileInput = document.getElementById('file-input');
        const profileImageDisplay = document.getElementById('profile-image-display');
        const avatarContainer = document.querySelector('.card__avatar') || document.querySelector('.foto-container');

        if (!(btnGerirFoto && popupOpcoesFoto && btnAdicionarNovaFoto && btnRemoverFoto && fileInput && profileImageDisplay && avatarContainer)) return;

        btnGerirFoto.onclick = (e) => {
            e.stopPropagation();
            popupOpcoesFoto.style.display = (popupOpcoesFoto.style.display === 'block') ? 'none' : 'block';
        };
        document.addEventListener('click', () => { popupOpcoesFoto.style.display = 'none'; });
        popupOpcoesFoto.addEventListener('click', e => e.stopPropagation());

        btnAdicionarNovaFoto.onclick = () => {
            fileInput.value = '';
            fileInput.click();
        };

        btnRemoverFoto.onclick = () => {
            if (!window.usuario_atual) {
                alert("Usuário não definido. Não é possível remover a foto.");
                return;
            }
            localStorage.removeItem(`profile_pic_${window.usuario_atual}`);
            profileImageDisplay.src = '';
            avatarContainer.classList.add('no-photo');
            fileInput.value = '';
            alert("Foto removida.");
        };

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
                    avatarContainer.classList.remove('no-photo');
                } catch (err) {
                    console.error("Erro ao salvar foto no localStorage:", err);
                    alert("Erro ao salvar a foto. Talvez a imagem seja muito grande.");
                }
            };
            reader.readAsDataURL(file);
        });

        function loadProfilePic() {
            if (!window.usuario_atual) {
                profileImageDisplay.src = '';
                avatarContainer.classList.add('no-photo');
                return;
            }
            const savedPic = localStorage.getItem(`profile_pic_${window.usuario_atual}`);
            if (savedPic) {
                profileImageDisplay.src = savedPic;
                avatarContainer.classList.remove('no-photo');
            } else {
                profileImageDisplay.src = '';
                avatarContainer.classList.add('no-photo');
            }
        }

        window.addEventListener('dadosPWAHorasAtualizados', loadProfilePic);
        (function waitForUserAndLoad() {
            if (window.usuario_atual) loadProfilePic();
            else setTimeout(waitForUserAndLoad, 100);
        })();
    })();

});
