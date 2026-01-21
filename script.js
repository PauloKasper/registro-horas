document.addEventListener("DOMContentLoaded", () => {
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/service-worker.js")
    .then(() => console.log("Service Worker registrado"))
    .catch(err => console.error("Erro ao registrar Service Worker:", err));
}

const SALARIO_MINIMO = 920;
const HORAS_MES = 173.33;

const VALOR_HORA = SALARIO_MINIMO / HORAS_MES; // ≈ 5.31
const VALOR_HORA_EXTRA = VALOR_HORA * 2;       // ≈ 10.62

function contarDiasUteisPeriodo() {
  const [inicio, fim] = gerarPeriodo();
  let dias = 0;

  for (let d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) {
    if (!isWeekend(d)) dias++;
  }

  return dias;
}

function distribuirExtrasPorEscalao(horasExtras) {
  // Menos de 30 minutos não conta
  if (horasExtras < 0.5) {
    return { e1: 0, e2: 0, e3: 0 };
  }

  const horasInteiras = Math.floor(horasExtras);
  const fracao = horasExtras - horasInteiras;

  let e1 = 0, e2 = 0, e3 = 0;

  // FRAÇÃO vai sempre para o 1.º escalão
  if (fracao > 0) {
    e1 += fracao;
  }

  // Distribuição das horas inteiras
  if (horasInteiras >= 1) {
    e1 += 1;
  }
  if (horasInteiras >= 2) {
    e2 += 1;
  }
  if (horasInteiras > 2) {
    e3 += horasInteiras - 2;
  }

  return { e1, e2, e3 };
}
function calcularValorEscaloes(totalNormais, totalExtras) {
  const valorNormal = totalNormais * VALOR_HORA;
  const valorExtra = totalExtras * VALOR_HORA_EXTRA;

  return {
    valorNormal,
    valorExtra,
    valorTotal: valorNormal + valorExtra
  };
}

function calcularExtrasTotaisPorEscalao() {
  let totalE1 = 0;
  let totalE2 = 0;
  let totalE3 = 0;

  for (const data in window.registros) {
    const r = window.registros[data];
    if (!r || !r.salvo) continue;

    const horasDia = calcularHorasDoDia(r);
    const extrasDia = Math.max(0, horasDia - 8);

    const { e1, e2, e3 } = distribuirExtrasPorEscalao(extrasDia);

    totalE1 += e1;
    totalE2 += e2;
    totalE3 += e3;
  }

  return { totalE1, totalE2, totalE3 };
}
function atualizarCardExtrasPorEscalao() {
  const { totalE1, totalE2, totalE3 } = calcularExtrasTotaisPorEscalao();

  const valorE1 = totalE1 * VALOR_HORA * 2;
  const valorE2 = totalE2 * VALOR_HORA * 2.5;
  const valorE3 = totalE3 * VALOR_HORA * 3;

  const totalExtras = valorE1 + valorE2 + valorE3;

  document.getElementById("extra-h1-horas").innerText = `${totalE1.toFixed(2)}h`;
  document.getElementById("extra-h2-horas").innerText = `${totalE2.toFixed(2)}h`;
  document.getElementById("extra-rest-horas").innerText = `${totalE3.toFixed(2)}h`;

  document.getElementById("extra-h1-valor").innerText = `€ ${valorE1.toFixed(2)}`;
  document.getElementById("extra-h2-valor").innerText = `€ ${valorE2.toFixed(2)}`;
  document.getElementById("extra-rest-valor").innerText = `€ ${valorE3.toFixed(2)}`;

  document.getElementById("extra-total-valor").innerText =
    `€ ${totalExtras.toFixed(2)}`;

  // 🔑 horas
  window.totalExtraH1 = totalE1;
  window.totalExtraH2 = totalE2;
  window.totalExtraRest = totalE3;

  // 🔑 valores
  window.valorExtraH1 = valorE1;
  window.valorExtraH2 = valorE2;
  window.valorExtraRest = valorE3;
  window.valorExtraTotal = totalExtras;
}



function abrirModalHoras() {
  document.getElementById('modal-horas')
    .setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-aberto');
}

function fecharModalHoras() {
  document.getElementById('modal-horas')
    .setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-aberto');
}

function calcularHorasNegativas() {
  let horasTrabalhadas = 0;
  let diasComRegistro = 0;

  for (const data in window.registros) {
    const r = window.registros[data];
    if (!r || !r.salvo) continue;

    const horasDia = Number(calcularHorasDoDia(r)) || 0;

    if (horasDia > 0) {
      diasComRegistro++;
      horasTrabalhadas += horasDia;
    }
  }

  const horasEsperadas = diasComRegistro * 8;
  const negativas = horasEsperadas - horasTrabalhadas;

  return negativas > 0 ? negativas : 0;
}

function horasParaHHMM(horas) {
  if (!horas || horas <= 0) return "0:00";

  const totalMin = Math.round(horas * 60);
  const hh = Math.floor(totalMin / 60);
  const mm = totalMin % 60;

  return `${hh}:${String(mm).padStart(2, '0')}`;
}

function getDeviceType() {
  const ua = navigator.userAgent;

  if (/iPhone|iPad|iPod/i.test(ua)) {
    return 'ios';
  }

  if (/Android/i.test(ua)) {
    return 'android';
  }

  return 'desktop';
}


// Botão fechar
document.getElementById("fechar-modal").onclick = fecharModalHoras;

// Clique fora do card fecha
document.getElementById("modal-horas").addEventListener("click", e => {
  if (e.target.id === "modal-horas") fecharModalHoras();
});


    /* =========================
       VARIÁVEIS GLOBAIS
    ========================= */
    window.usuario_atual = null;
    window.registros = {};
    let chartHoras = null;

    /* =========================
       LOCAL STORAGE HELPERS
    ========================= */
    function salvarLS(c, v) {
        localStorage.setItem(c, JSON.stringify(v));
    }

    function carregarLS(chave) {
        const valor = localStorage.getItem(chave);
        if (valor === null) return {};

        try {
            return JSON.parse(valor);
        } catch {
            return valor; // string (ex: usuario_logado)
        }
    }

    /* =========================
       PERFIL – CARREGAR DADOS
    ========================= */
    function carregarPerfil() {
        const usuarioLogado = carregarLS("usuario_logado");
        if (!usuarioLogado) return;

        const usuarios = carregarLS("usuarios");
        const u = usuarios[usuarioLogado];
        if (!u) return;

        document.getElementById("perfil-colaborador").value = u.display_name || "";
        document.getElementById("perfil-funcao").value = u.funcao || "";
        document.getElementById("perfil-empresa").value = u.empresa || "";
        document.getElementById("perfil-contribuicao").value = u.contribuicao || "";
        document.getElementById("perfil-horario").value = u.horario || "";
    }

    /* =========================
       PERFIL – EDITAR / SALVAR
    ========================= */
    const btnEditarPerfil = document.getElementById("btn-editar-perfil");

    if (btnEditarPerfil) {
        btnEditarPerfil.onclick = () => {

            const editando = btnEditarPerfil.dataset.editando === "true";
            const inputs = document.querySelectorAll(".perfil-dados input");

            if (!editando) {
                inputs.forEach(i => i.disabled = false);
                btnEditarPerfil.innerText = "Salvar";
                btnEditarPerfil.dataset.editando = "true";

            } else {
                const usuarioLogado = carregarLS("usuario_logado");
                if (!usuarioLogado) return;

                const usuarios = carregarLS("usuarios");
                const u = usuarios[usuarioLogado];
                if (!u) return;

                u.display_name = document.getElementById("perfil-colaborador").value;
                u.funcao = document.getElementById("perfil-funcao").value;
                u.empresa = document.getElementById("perfil-empresa").value;
                u.contribuicao = document.getElementById("perfil-contribuicao").value;
                u.horario = document.getElementById("perfil-horario").value;

                salvarLS("usuarios", usuarios);

                inputs.forEach(i => i.disabled = true);
                btnEditarPerfil.innerText = "Editar";
                btnEditarPerfil.dataset.editando = "false";
            }
        };
    }

function sincronizarPerfilComPDF() {
    const usuario = carregarLS("usuario_logado");
    if (!usuario) return;

    const usuarios = carregarLS("usuarios");
    const u = usuarios[usuario];
    if (!u) return;

    document.getElementById("colaborador").innerText = u.display_name || "";
    document.getElementById("funcao").innerText = u.funcao || "";
    document.getElementById("empresa").innerText = u.empresa || "";
    document.getElementById("contribuinte").innerText = u.contribuicao || "";
    document.getElementById("horario").innerText = u.horario || "";
    document.getElementById("data_emissao").innerText =
        new Date().toLocaleDateString("pt-PT");
}



    // --- FUNÇÕES DE CÁLCULO ---
function calcularHorasDoDia(r) {
  function paraMinutos(h) {
    if (!h || !h.includes(':')) return null;
    const [hh, mm] = h.split(':').map(Number);
    return hh * 60 + mm;
  }

  const entrada = paraMinutos(r.entrada);
  if (entrada === null) return 0;

  let totalMin = 0;

  // Período antes do almoço
  if (r.saida_alm) {
    const saidaAlm = paraMinutos(r.saida_alm);
    if (saidaAlm !== null && saidaAlm > entrada) {
      totalMin += (saidaAlm - entrada);
    }
  }

  // Período depois do almoço
  if (r.retorno && r.saida_final) {
    const retorno = paraMinutos(r.retorno);
    const saidaFinal = paraMinutos(r.saida_final);
    if (retorno !== null && saidaFinal !== null && saidaFinal > retorno) {
      totalMin += (saidaFinal - retorno);
    }
  }

  return +(totalMin / 60).toFixed(2); // 🔑 nunca arredonda pra 8
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

        const horasNoDia = Number(calcularHorasDoDia(r)) || 0;

        if (horasNoDia > 0) {
            totalHoras += horasNoDia;
            diasTrabalhados += 1;
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

        const h = Number(calcularHorasDoDia(r)) || 0;

        if (h > 8) {
            totalNormais += 8;
            totalExtras += (h - 8);
        } else {
            totalNormais += h;
        }
    }

    return {
        totalNormais,
        totalExtras
    };
}


    function formatarHora(valor) {
    if (!valor) return '';

    valor = String(valor).replace(/\D/g, '');

    if (valor.length === 0) return '';

    // Se só tiver horas → completar com :00
    if (valor.length <= 2) {
        const h = Math.min(parseInt(valor, 10), 23);
        return String(h).padStart(2, '0') + ":00";
    }

    // Se tiver horas e minutos (ex: 830 → 8 e 30)
    let horas = valor.slice(0, valor.length - 2);
    let minutos = valor.slice(-2);

    let h = Math.min(parseInt(horas, 10), 23);
    let m = Math.min(parseInt(minutos, 10), 59);

    // Se for 24:00 → virar 00:00 (mantive sua lógica)
    if (h === 24 && m === 0) return "00:00";

    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
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
function gerarPeriodoFechoEmpresa(mesAno = null) {
    const hoje = new Date();

    let inicio;
    let fim;

    if (hoje.getDate() < 20) {
        // Estamos antes do fecho → ciclo anterior
        inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 20);
        fim = new Date(hoje.getFullYear(), hoje.getMonth(), 19);
    } else {
        // Estamos após o fecho → ciclo atual
        inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 20);
        fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 19);
    }

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

function isCycleComplete(mes, ano) {
    const [inicio, fim] = gerarPeriodo(mes, ano);
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

    const totalHorasNegativas = calcularHorasNegativas();

        // CARD 1 – TOTAL DIAS (FRENTE) / TOTAL HORAS (VERSO)
    const elDiasFront = document.getElementById('dias-front');
    const elHorasBack = document.getElementById('horas-back');

    if (elDiasFront) {
        elDiasFront.innerHTML =
            `<span>Total Dias</span><strong>${placar.diasTrabalhados}</strong>`;
    }

   if (elHorasBack) {
      elHorasBack.innerHTML =
        `<span>Total Horas</span><strong>${horasParaHHMM(placar.totalHoras)}</strong>`;
    }


    // =========================
    // CARD RESUMO (embaixo)
    // =========================
    const elTotalHoras = document.getElementById('total-horas');
    const elHorasExtras = document.getElementById('horas-extras');
    const elHorasNegativas = document.getElementById('horas-negativas');

    if (elTotalHoras)
        elTotalHoras.innerText = horasParaHHMM(placar.totalHoras);

    if (elHorasExtras)
        elHorasExtras.innerText = horasParaHHMM(totalExtras);

    if (elHorasNegativas) {
      elHorasNegativas.innerText = horasParaHHMM(totalHorasNegativas);

      // remove estado anterior
      elHorasNegativas.classList.remove('horas-negativas', 'horas-ok');

    if (totalHorasNegativas > 0) {
        elHorasNegativas.classList.add('horas-negativas');
    } else {
        elHorasNegativas.classList.add('horas-ok');
      }
    }

    // =========================
    // 🔥 CARDS DE CIMA (FLIP)
    // =========================
    const elRefeicaoFront = document.getElementById('refeicao-front');
    const elEstimativaBack = document.getElementById('estimativa-back');


    if (elEstimativaBack) {
        elEstimativaBack.innerHTML =
            `<span>Estimativa</span><strong>€ ${placar.estimativaVale.toFixed(2)}</strong>`;
    }
   const elExtrasTotal = document.getElementById('extras-total');

    if (elExtrasTotal && typeof window.valorExtraTotal === "number") {
        elExtrasTotal.innerText = `€ ${window.valorExtraTotal.toFixed(2)}`;
    }


}
    window.addEventListener('dadosPWAHorasAtualizados', () => {
  atualizarCardExtrasPorEscalao();
  atualizarCardsPerfil();

});
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
    // ✅ SALVAR HORAS — APENAS UMA VEZ
    if (salvarHorasBtn) {
        salvarHorasBtn.onclick = () => {
            const key = modalHoras.dataset.dateKey;
            if (!key) return;

            salvarHorasDoDia(key);
            modalHoras.style.display = "none";

            window.dispatchEvent(new Event('dadosPWAHorasAtualizados'));

            setTimeout(() => gerarCalendarioPeriodo(mesAtualExibido), 50);
        };
    }

    const camposHora = [entrada, saidaAlmoco, retornoAlmoco, saidaFinal];
    camposHora.forEach(campo => {
    if (!campo) return;
    campo.addEventListener("blur", () => {
        campo.value = formatarHora(campo.value);
    });
});

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
    // -> aqui usamos formatarHora() para garantir apresentação consistente, mesmo quando o valor vem do storage
    entrada.value = r.entrada ? formatarHora(r.entrada) : "";
    saidaAlmoco.value = r.saida_alm ? formatarHora(r.saida_alm) : "";
    retornoAlmoco.value = r.retorno ? formatarHora(r.retorno) : "";
    saidaFinal.value = r.saida_final ? formatarHora(r.saida_final) : "";
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

    const allEmpty =
        !dados.entrada &&
        !dados.saida_alm &&
        !dados.retorno &&
        !dados.saida_final;

    if (allEmpty) {
        delete window.registros[dateKey];
    } else {
        // ✅ OBJETO NOVO (SEM structuredClone)
        window.registros[dateKey] = {
            entrada: dados.entrada,
            saida_alm: dados.saida_alm,
            retorno: dados.retorno,
            saida_final: dados.saida_final,
            salvo: true
        };
    }

    salvarRegistrosUsuario();
    window.dispatchEvent(new Event('dadosPWAHorasAtualizados'));

    const [inicio] = gerarPeriodo();
    const fechamentoKey = formatarDataParaKey(
        new Date(inicio.getFullYear(), inicio.getMonth(), 19)
    );

    if (dateKey === fechamentoKey) {
        let totalHoras = 0;
        let totalExtras = 0;
        let diasTrabalhados = 0;
        let estimativaVale = 0;

        for (const d in window.registros) {
            const r = window.registros[d];
            if (!r?.salvo) continue;

            const horasDia = calcularHorasDoDia(r);
            if (horasDia > 0) {
                diasTrabalhados++;
                totalHoras += horasDia;
                totalExtras += Math.max(0, horasDia - 8);

                let refeicaoDia = 8;
                if (horasDia - 8 >= 4) refeicaoDia += 8;
                estimativaVale += refeicaoDia;
            }
        }

        if (confirm(
            `Resumo do mês:
Dias trabalhados: ${diasTrabalhados}
Horas extras: ${totalExtras.toFixed(2)}h
Estimativa de vale-refeição: €${estimativaVale.toFixed(2)}

Deseja resetar os registros do mês?`
        )) {
            window.registros = {};
            salvarRegistrosUsuario();
            atualizarCardsPerfil();
            setTimeout(() => gerarCalendarioPeriodo(), 50);
            return;
        }
    }

    const registroDia = window.registros[dateKey];
    if (registroDia?.mesAnterior) {
        if (!confirm("Este dia pertence ao ciclo anterior. Sobrescrever?")) {
            carregarHorasDoDia(dateKey);
            return;
        }

        delete registroDia.mesAnterior;

        window.registros[dateKey] = {
            entrada: dados.entrada,
            saida_alm: dados.saida_alm,
            retorno: dados.retorno,
            saida_final: dados.saida_final,
            salvo: true
        };

        salvarRegistrosUsuario();
        window.dispatchEvent(new Event('dadosPWAHorasAtualizados'));
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
                modalHoras.dataset.dateKey = key;
                carregarHorasDoDia(key);
                modalHoras.style.display = "flex";

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

    /* === NOVO BLOCO ADICIONADO AQUI PARA CONTROLAR O BOTÃO IMPRIMIR === */
    const btnImprimir = document.getElementById("btn-gerar-csv");
    if (btnImprimir) {
        if (tela === "tela-registro") {
            btnImprimir.classList.remove("oculto"); // Mostrar apenas nesta tela
        } else {
            btnImprimir.classList.add("oculto"); // Esconder em todas as outras telas
        }
    }
    /* ================================================================= */


    if (tela === "tela-registro") {
        carregarRegistrosUsuario();
        gerarCalendarioPeriodo();
    }

   if (tela === "tela-perfil") {
    carregarPerfil();
    carregarRegistrosUsuario();
    atualizarCardsPerfil();

  // 🔥 ATUALIZA OS EXTRAS POR ESCALÃO
    atualizarCardExtrasPorEscalao();

    // 🔑 Garante sincronização visual
    if (window.loadProfilePic) {
        window.loadProfilePic();
    }
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
                salvarLS("usuario_logado", u);
                window.usuario_atual = u;

                carregarPerfil();
                carregarRegistrosUsuario();

                // 🔑 ESTA LINHA É O QUE FALTAVA
                if (window.loadProfilePic) {
                    window.loadProfilePic();
                }

                mostrar("tela-perfil");
            }

             else {
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

        const colaborador = (document.getElementById("cad-colaborador").value || "").trim();
        const numero = (document.getElementById("cad-numero").value || "").trim();
        const empresa = (document.getElementById("cad-empresa").value || "").trim();
        const funcao = (document.getElementById("cad-funcao").value || "").trim();
        const contribuicao = (document.getElementById("cad-contribuicao").value || "").trim();

        const erro = document.getElementById("erro-cadastro");
        if (erro) erro.innerText = "";

        if (!colaborador || !numero || !empresa || !funcao || !contribuicao) {
            if (erro) erro.innerText = "Preencha todos os campos";
            return;
        }

        const usuarioKey = colaborador.toLowerCase();

        const usuarios = carregarLS("usuarios");

        usuarios[usuarioKey] = {
            display_name: colaborador,
            numero: numero,
            empresa: empresa,
            funcao: funcao,
            contribuicao: contribuicao
        };

        salvarLS("usuarios", usuarios);

        // Pré-preenche login
        document.getElementById("usuario").value = usuarioKey;
        document.getElementById("senha").value = numero;

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

// script.js

// TODO: Certifique-se que as suas funções auxiliares estão disponíveis aqui (ex: gerarPeriodoFechoEmpresa, formatarDataParaKey, buscarFeriados)

async function gerarPDFComHTML() {
    // 1. Popula os campos de informação do colaborador no HTML oculto

        const hoje = new Date().toLocaleDateString('pt-PT', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });

    document.getElementById('data-assinatura').innerText = hoje;
    // Ajuste a data de assinatura no rodapé se necessário:
    // document.getElementById('data-assinatura').innerText = `Data: ${new Date().toLocaleDateString()}`;

    // 2. Gera o corpo da tabela dinamicamente (substituindo a lógica autoTable)
    const tbody = document.getElementById('tabela-body');
    tbody.innerHTML = ''; // Limpa o corpo da tabela
    const [inicio, fim] = gerarPeriodoFechoEmpresa(new Date()); // use suas datas reais

    const d = new Date(inicio);
    const totalRowsForDidDrawCell = calcularTotalDeLinhas(inicio, fim); // Função auxiliar para replicar a lógica de índice exato


    // --- Funções auxiliares ---
    function calcularHorasDoDia(r) {
        function paraMinutos(hora) {
            const [h, m] = hora.split(":").map(Number);
            return h * 60 + m;
        }

        if (!r.entrada) return { total: '', noturnas: '' };

        // se não houver saída final, usa a saída do almoço como saída do dia
        const saidaDia = r.saida_final || r.saida_alm;
        if (!saidaDia) return { total: '', noturnas: '' };


        let entrada = paraMinutos(r.entrada);
        let saidaFinal = paraMinutos(saidaDia);
        if (saidaFinal <= entrada) saidaFinal += 1440;

        let intervalos = [];

        if (r.saida_alm && r.retorno) {
            let saidaAlm = paraMinutos(r.saida_alm);
            let retorno = paraMinutos(r.retorno);
            if (saidaAlm <= entrada) saidaAlm += 1440;
            if (retorno <= saidaAlm) retorno += 1440;
            intervalos.push([entrada, saidaAlm], [retorno, saidaFinal]);
        } else {
            intervalos.push([entrada, saidaFinal]);
        }

        let totalMin = 0, noturnoMin = 0;

        for (const [ini, fim] of intervalos) {
            for (let m = ini; m < fim; m++) {
                totalMin++;
                const rel = m % 1440;
                if (rel >= 1320 || rel < 420) noturnoMin++;
            }
        }

        return {
            total: +(totalMin / 60).toFixed(2),       // ex: 0.5, 1.25, 4
            noturnas: +(noturnoMin / 60).toFixed(2)
        };

    }

    function calcularHorasExtras(total) {
        if (!total || total <= 8) return { h1: '', h2: '', rest: '' };
        const e = total - 8;
        return {
            h1: e >= 1 ? 1 : '',
            h2: e >= 2 ? 1 : '',
            rest: e > 2 ? e - 2 : ''
        };
    }

    // --- Feriados (anos cruzados) ---
    const anosPeriodo = new Set([inicio.getFullYear(), fim.getFullYear()]);
    const feriadosSet = new Set();

    for (const ano of anosPeriodo) {
        const feriadosAno = await buscarFeriados(ano, 'PT');
        feriadosAno.forEach(f => feriadosSet.add(f.date));
    }

    // --- Acumuladores ---
    let somaTotalHoras = 0;
    let somaHorasNoturnas = 0;
    let somaExtra1 = 0;
    let somaExtra2 = 0;
    let somaExtraRest = 0;
    let somaSabDom = 0;
    let somaFeriados = 0;
    let diasTrabalhados = 0;

    // --- Loop ---
while (d <= fim) {

    const key = formatarDataParaKey(d);
    const r = window.registros?.[key] || {};
    const trabalhouNoDia =
    !!r.entrada && !!(r.saida_final || r.saida_alm);

    if (trabalhouNoDia) {
        diasTrabalhados++;
    }

    const rDate = new Date(d);
    const isFimSemana = rDate.getDay() === 0 || rDate.getDay() === 6;
    const isFeriado = feriadosSet.has(key);

    const horas = calcularHorasDoDia(r);
    const extras = calcularHorasExtras(horas.total);

    // 👉 PRIMEIRO define
    const horasSabDom =
        isFimSemana && horas.total !== ''
            ? horas.total
            : '';

    const horasFeriado =
        isFeriado && horas.total !== ''
            ? horas.total
            : '';

     // TOTAL E NOTURNAS
    if (horas.total !== '') somaTotalHoras += horas.total;
    if (horas.noturnas !== '') somaHorasNoturnas += horas.noturnas;

    // HORAS EXTRAS
    if (extras.h1 !== '') somaExtra1 += Number(extras.h1);
    if (extras.h2 !== '') somaExtra2 += Number(extras.h2);
    if (extras.rest !== '') somaExtraRest += Number(extras.rest);

    // SAB / DOM
    if (horasSabDom !== '') somaSabDom += Number(horasSabDom);

    // FERIADOS
    if (horasFeriado !== '') somaFeriados += Number(horasFeriado);


    let rowHTML = `<tr>`;

    rowHTML += `<td>${key}</td>`;
    rowHTML += `<td>${r.entrada || ''}</td>`;
    rowHTML += `<td>${r.saida_alm || ''}</td>`;
    rowHTML += `<td>${r.retorno || ''}</td>`;
    rowHTML += `<td>${r.saida_final || ''}</td>`;

    rowHTML += `<td>${horas.total || ''}</td>`;
    rowHTML += `<td>${horas.noturnas || ''}</td>`;

     // HORAS EXTRAS
    rowHTML += `<td>${extras.h1}</td>`;
    rowHTML += `<td>${extras.h2}</td>`;
    rowHTML += `<td>${extras.rest}</td>`;
    rowHTML += `<td>${horasSabDom}</td>`;
    rowHTML += `<td>${horasFeriado}</td>`;

    // FORMAÇÃO
    rowHTML += `<td></td>`;

    // SUBSTITUIÇÃO
    rowHTML += `<td></td>`;

    // FÉRIAS
    rowHTML += `<td></td>`;
    rowHTML += `<td></td>`;

    // FALTAS JUST.
    rowHTML += `<td></td>`;
    rowHTML += `<td></td>`;

    // FALTAS INJUST.
    rowHTML += `<td></td>`;

    rowHTML += `</tr>`;

    tbody.insertAdjacentHTML('beforeend', rowHTML);

    d.setDate(d.getDate() + 1);
}

  // Elemento que será convertido em PDF
  const element = document.getElementById('pdf-content');
  const filename = `folha_horas_${new Date().toISOString().slice(0,10)}.pdf`;

  const device = getDeviceType();

  // 🔑 aplica classe conforme o dispositivo
  document.body.classList.add(`pdf-${device}`);

  const opt = {
    margin: [10, 10, 10, 10],
    filename,
    html2canvas: {
      scale: 2,
      scrollX: 0,
      scrollY: 0
    },
    jsPDF: {
      unit: 'mm',
      format: 'a4',
      orientation: 'landscape'
    },
    pagebreak: {
      mode: ['css', 'legacy']
    }
  };

  /* ===============================
     ATUALIZA DADOS DO PDF
     =============================== */

  document.getElementById('total-horas-trabalhadas').innerText =
    somaTotalHoras || '';

  document.getElementById('total-horas-noturnas').innerText =
    somaHorasNoturnas || '';

  document.getElementById('total-extra-1').innerText =
    somaExtra1 || '';

  document.getElementById('total-extra-2').innerText =
    somaExtra2 || '';

  document.getElementById('total-extra-rest').innerText =
    somaExtraRest || '';

  document.getElementById('total-sabdom').innerText =
    somaSabDom || '';

  document.getElementById('total-feriados').innerText =
    somaFeriados || '';

  // Subsídio de refeição
  const valorRefeicao = diasTrabalhados * 8;
  document.getElementById('subsidio-refeicao').innerText =
    `${diasTrabalhados} X 8 = ${valorRefeicao}`;

  /* ===============================
     GERAÇÃO DO PDF
     =============================== */

html2pdf()
    .set(opt)
    .from(element)
    .save()
    .then(() => {
      // 🔑 remove TODAS as classes de PDF
      document.body.classList.remove('pdf-ios', 'pdf-android', 'pdf-desktop');
    })
    .catch(() => {
      document.body.classList.remove('pdf-ios', 'pdf-android', 'pdf-desktop');
    });
}



// Função auxiliar para calcular o número total de linhas para a lógica de índice
function calcularTotalDeLinhas(inicio, fim) {
    let count = 0;
    const d = new Date(inicio);
    while (d <= fim) {
        count++;
        d.setDate(d.getDate() + 1);
    }
    // Adicione +2 para as linhas vazias/totais que adicionou no código original, se aplicável
    return count;
}


const btnImprimir = document.getElementById('btn-gerar-csv');
if (btnImprimir) {
    btnImprimir.onclick = async () => {

        // 🔑 PRIMEIRO: perfil → PDF
        sincronizarPerfilComPDF();

        // 🔑 DEPOIS: gera PDF
        await gerarPDFComHTML();
    };
}




    // =========================
// FOTO DE PERFIL (CORRIGIDO)
// =========================
(function setupFoto() {
    const btnGerirFoto = document.getElementById('btn-gerir-foto');
    const popupOpcoesFoto = document.getElementById('popup-opcoes-foto');
    const btnAdicionarNovaFoto = document.getElementById('btn-adicionar-nova-foto');
    const btnRemoverFoto = document.getElementById('btn-remover-foto');
    const fileInput = document.getElementById('file-input');
    const profileImageDisplay = document.getElementById('profile-image-display');
    const avatarContainer =
        document.querySelector('.card__avatar') ||
        document.querySelector('.foto-container');

    if (!(
        btnGerirFoto &&
        popupOpcoesFoto &&
        btnAdicionarNovaFoto &&
        btnRemoverFoto &&
        fileInput &&
        profileImageDisplay &&
        avatarContainer
    )) return;

    // =========================
    // ABRIR / FECHAR MENU
    // =========================
    btnGerirFoto.onclick = (e) => {
        e.stopPropagation();
        popupOpcoesFoto.style.display =
            popupOpcoesFoto.style.display === 'block' ? 'none' : 'block';
    };

    document.addEventListener('click', () => {
        popupOpcoesFoto.style.display = 'none';
    });

    popupOpcoesFoto.addEventListener('click', e => e.stopPropagation());

    // =========================
    // ADICIONAR FOTO
    // =========================
    btnAdicionarNovaFoto.onclick = () => {
        fileInput.value = '';
        fileInput.click();
    };

fileInput.addEventListener("change", async function () {
  const file = this.files[0];
  if (!file || !window.usuario_atual) return;

  const loading = document.getElementById("foto-loading");

  // 🔥 FORÇA renderização do loading
  loading.classList.remove("oculto");
  await new Promise(r => setTimeout(r, 500));

  try {
    const imagemReduzida = await reduzirImagem(file);

    localStorage.setItem(
      `profile_pic_${window.usuario_atual}`,
      imagemReduzida
    );

    profileImageDisplay.src = imagemReduzida;
    avatarContainer.classList.remove("no-photo");

  } catch (err) {
    alert("Erro ao salvar a foto.");
    console.error(err);
  } finally {
    loading.classList.add("oculto");
  }
});




    // =========================
    // REMOVER FOTO
    // =========================
    btnRemoverFoto.onclick = () => {
        if (!window.usuario_atual) {
            alert("Usuário não definido.");
            return;
        }

        localStorage.removeItem(`profile_pic_${window.usuario_atual}`);
        profileImageDisplay.src = '';
        avatarContainer.classList.add('no-photo');
        fileInput.value = '';
    };

    // =========================
    // CARREGAR FOTO DO USUÁRIO ATUAL
    // =========================
    window.loadProfilePic = function () {
        if (!window.usuario_atual) {
            profileImageDisplay.src = '';
            avatarContainer.classList.add('no-photo');
            return;
        }

        const savedPic = localStorage.getItem(
            `profile_pic_${window.usuario_atual}`
        );

        if (savedPic) {
            profileImageDisplay.src = savedPic;
            avatarContainer.classList.remove('no-photo');
        } else {
            profileImageDisplay.src = '';
            avatarContainer.classList.add('no-photo');
        }
    };
})();

const btnExcluirUsuario = document.getElementById("btn-excluir-usuario");
const modalExcluir = document.getElementById("modal-excluir-usuario");
const inputSenhaExcluir = document.getElementById("senha-excluir");
const btnConfirmarExcluir = document.getElementById("confirmar-exclusao");
const btnCancelarExcluir = document.getElementById("cancelar-exclusao");
const divErroExcluir = document.getElementById("erro-excluir");

if (btnExcluirUsuario && modalExcluir) {

    // Abrir modal
    btnExcluirUsuario.onclick = (e) => {
        e.stopPropagation();
        modalExcluir.style.display = "flex";
        inputSenhaExcluir.value = "";
        btnConfirmarExcluir.disabled = true;
        divErroExcluir.innerText = "";
    };

    // Habilitar botão apenas se digitar algo
    inputSenhaExcluir.addEventListener("input", () => {
        btnConfirmarExcluir.disabled = inputSenhaExcluir.value.trim() === "";
        divErroExcluir.innerText = "";
    });

    // Cancelar
    btnCancelarExcluir.onclick = () => {
        modalExcluir.style.display = "none";
        inputSenhaExcluir.value = "";
        divErroExcluir.innerText = "";
    };

    // Confirmar exclusão
    btnConfirmarExcluir.onclick = () => {
        if (!window.usuario_atual) {
            divErroExcluir.innerText = "Nenhum usuário logado.";
            return;
        }

        const usuarios = carregarLS("usuarios");
        const usuario = window.usuario_atual;
        const senhaCorreta = usuarios[usuario]?.numero;

        if (!senhaCorreta) {
            divErroExcluir.innerText = "Erro: dados do usuário não encontrados.";
            return;
        }

        if (inputSenhaExcluir.value !== senhaCorreta) {
            divErroExcluir.innerText = "Senha incorreta.";
            return;
        }

        // Remover dados do usuário
        try {
            // Registros de horas
            localStorage.removeItem(`horas_${usuario}`);

            // Foto de perfil
            localStorage.removeItem(`profile_pic_${usuario}`);
            const profileImageDisplay = document.getElementById('profile-image-display');
            const avatarContainer = document.querySelector('.card__avatar') || document.querySelector('.foto-container');
            if (profileImageDisplay) profileImageDisplay.src = '';
            if (avatarContainer) avatarContainer.classList.add('no-photo');

            // Cadastro
            delete usuarios[usuario];
            salvarLS("usuarios", usuarios);

            // Limpar sessão
            window.usuario_atual = null;

            // Fechar modal
            modalExcluir.style.display = "none";

            // Feedback permanente
            alert("Conta excluída com sucesso. Todos os dados foram removidos permanentemente.");

            // Redirecionar para login
            mostrar("tela-login");
        } catch (err) {
            console.error("Erro ao excluir usuário:", err);
            divErroExcluir.innerText = "Erro ao excluir a conta. Tente novamente.";
        }
    };

    // Fechar modal clicando fora do conteúdo
    modalExcluir.addEventListener("click", (ev) => {
        if (ev.target === modalExcluir) modalExcluir.style.display = "none";
    });
}
function mostrarTelaRegistro() {
    document.getElementById('tela-registro').classList.remove('oculto');
    document.getElementById('btn-gerar-csv').classList.remove('oculto');
}

function mostrarOutraTela() {
    document.getElementById('tela-registro').classList.add('oculto');
    // Adiciona a classe oculta para esconder o botão em outras telas
    document.getElementById('btn-gerar-csv').classList.add('oculto');
}

});

// =========================
// FUNÇÃO PARA REDUZIR FOTO
// =========================
function reduzirImagem(file, maxSize = 300) {
  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = e => {
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);

        canvas.width = img.width * scale;
        canvas.height = img.height * scale;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // 🔑 gera a imagem reduzida
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);

        // 🔥 LIMPA O CANVAS (importante para iOS / Safari)
        canvas.width = 0;
        canvas.height = 0;

        resolve(dataUrl);
      };

      img.src = e.target.result;
    };

    reader.readAsDataURL(file);
  });
}


