const CACHE_NAME = 'horas-cache-v1';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Service Worker Listeners (Fora do DOMContentLoaded)
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(response => response || fetch(e.request))
  );
});


// --- Início do ficheiro: script.js ---

document.addEventListener("DOMContentLoaded", () => {
    let usuario_atual = null, registros = {};

    // REGISTRO DO SERVICE WORKER (Mantido no script.js para inicializar o sw.js)
    if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/service-worker.js")
    .then(() => console.log("Service Worker registrado"))
    .catch(err => console.error("Erro ao registrar Service Worker:", err));
}


    // Função para trocar de tela
    function mostrar(tela) {
        document.querySelectorAll(".tela").forEach(t => t.classList.remove("ativa"));
        document.getElementById(tela).classList.add("ativa");
        // Adiciona o listener da engrenagem sempre que a tela de perfil é mostrada
        if (tela === 'tela-perfil') {
            const btnConfig = document.getElementById("btn-configuracoes-perfil");
            if (btnConfig) {
                btnConfig.onclick = () => mostrar("tela-configurações");
            }
        }
    }
    // Torna a função globalmente acessível para onclick="" no HTML
    window.mostrar = mostrar;


    function salvarLS(c, v) { localStorage.setItem(c, JSON.stringify(v)); }
    function carregarLS(c) { return JSON.parse(localStorage.getItem(c) || "{}"); }

    // LOGIN
    if (document.getElementById("btn-entrar")) { // Verificação adicionada
      document.getElementById("btn-entrar").onclick = () => {
          const u = document.getElementById("usuario").value.trim().toLowerCase();
          const s = document.getElementById("senha").value.trim();
          const us = carregarLS("usuarios");
          const erro = document.getElementById("erro-login");
          erro.innerText = "";
          if (u in us && us[u].numero === s) {
              usuario_atual = u;
              const usuarioLogadoEl = document.getElementById("usuario-logado");
              if (usuarioLogadoEl) {
                  usuarioLogadoEl.innerText = "Usuário: " + us[u].display_name;
              }
              iniciarRegistro();
              mostrar("tela-perfil");
          } else {
              erro.innerText = "Usuário ou senha incorretos.";
          }
      };
    }

    if (document.getElementById("btn-abrir-cadastro")) document.getElementById("btn-abrir-cadastro").onclick = () => mostrar("tela-cadastro");
    if (document.getElementById("btn-voltar-login")) document.getElementById("btn-voltar-login").onclick = () => mostrar("tela-login");

    // CADASTRO
    if (document.getElementById("btn-salvar-cadastro")) { // Verificação adicionada
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

    // REGISTRO
    function gerarPeriodo() {
        const hoje = new Date();
        let inicio = hoje.getDate() < 20 ? new Date(hoje.getFullYear(), hoje.getMonth() - 1, 20) : new Date(hoje.getFullYear(), hoje.getMonth(), 20);
        let fim = new Date(inicio); fim.setDate(inicio.getDate() + 30);
        return [inicio, fim];
    }

    async function buscarFeriados(ano, pais = 'BR') {
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

    async function iniciarRegistro() {
        registros = carregarLS("horas_" + usuario_atual) || {};
        const lista = document.getElementById("lista-dias");
        if (!lista) return;
        lista.innerHTML = "";
        const [inicio, fim] = gerarPeriodo();
        const feriados = await buscarFeriados(inicio.getFullYear());

        for (let d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) {
            const ds = d.toLocaleDateString("pt-BR");
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
    }

    // SALVAR DIA
    window.salvarDia = (d) => {
        registros[d] = {
            entrada: document.getElementById("e_" + d).value.trim(),
            saida_alm: document.getElementById("s_" + d).value.trim(),
            retorno: document.getElementById("r_" + d).value.trim(),
            saida_final: document.getElementById("f_" + d).value.trim()
        };
        salvarLS("horas_" + usuario_atual, registros);
        alert("Salvo!");
    };

    // CSV
    if (document.getElementById("btn-gerar-csv")) { // Verificação adicionada
      document.getElementById("btn-gerar-csv").onclick = () => {
          let linhas = ["Data,Entrada,Saída Almoço,Retorno,Saída Final"];
          for (const d in registros) { const r = registros[d]; linhas.push(`${d},${r.entrada},${r.saida_alm},${r.retorno},${r.saida_final}`); }
          const blob = new Blob([linhas.join("\n")], { type: "text/csv" });
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = `horas_${usuario_atual}.csv`;
          a.click();
      };
    }

    // --- AQUI ESTÁ O CÓDIGO DOS BOTÕES QUE ESTAVAM A FALHAR ---
    // Agora que estamos dentro do DOMContentLoaded, eles devem funcionar:
    if(document.getElementById("btn-configurações-voltar")) document.getElementById("btn-configurações-voltar").onclick = () => mostrar("tela-perfil");
    if(document.getElementById("btn-registrar-hora")) document.getElementById("btn-registrar-hora").onclick = () => mostrar("tela-registro");
    if(document.getElementById("btn-registro-voltar")) document.getElementById("btn-registro-voltar").onclick = () => mostrar("tela-perfil");
    if(document.getElementById("btn-logout-perfil")) document.getElementById("btn-logout-perfil").onclick = () => mostrar("tela-login");
    // FIM DO CÓDIGO DOS BOTÕES

    // ... dentro do document.addEventListener("DOMContentLoaded", () => { ...

    // --- Perfil e Upload de Foto (Lógica Consolidada) ---
    const btnGerirFoto = document.getElementById('btn-gerir-foto');
    const popupOpcoesFoto = document.getElementById('popup-opcoes-foto');
    const btnAdicionarNovaFoto = document.getElementById('btn-adicionar-nova-foto');
    const btnRemoverFoto = document.getElementById('btn-remover-foto');
    const fileInput = document.getElementById('file-input');
    const profileImageDisplay = document.getElementById('profile-image-display');
    const defaultProfilePicUrl = 'URL_DA_SUA_FOTO_PADRAO.jpg';

    if (btnGerirFoto && popupOpcoesFoto && btnAdicionarNovaFoto && btnRemoverFoto && fileInput && profileImageDisplay) {

        // Função para alternar a visibilidade do pop-up
        btnGerirFoto.onclick = (e) => {
            e.stopPropagation(); // Impede que o clique feche imediatamente
            popupOpcoesFoto.style.display = (popupOpcoesFoto.style.display === 'block') ? 'none' : 'block';
        };

        // Fechar o pop-up se clicar em qualquer outro lugar do documento
        document.addEventListener('click', () => {
            popupOpcoesFoto.style.display = 'none';
        });

        // Impedir que cliques dentro do pop-up o fechem imediatamente
        popupOpcoesFoto.addEventListener('click', (e) => {
            e.stopPropagation();
        });


        // 1. Ação Adicionar/Mudar Foto (abre o input de arquivo)
        btnAdicionarNovaFoto.onclick = () => {
            fileInput.value = ''; // Limpa o input para garantir que o evento 'change' dispara sempre
            fileInput.click();
        };

        // 2. Ação Remover Foto
        btnRemoverFoto.onclick = () => {
            if (usuario_atual) {
                localStorage.removeItem(`profile_pic_${usuario_atual}`);
                profileImageDisplay.src = defaultProfilePicUrl;
                fileInput.value = ''; // Limpa o input
                alert("Foto de perfil removida.");
            }
        };

        // 3. Listener para quando um arquivo é selecionado
        fileInput.addEventListener('change', function() {
            const file = this.files[0]; // Pega o primeiro arquivo
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    profileImageDisplay.src = e.target.result;
                    if (usuario_atual) {
                       localStorage.setItem(`profile_pic_${usuario_atual}`, e.target.result);
                    }
                };
                reader.readAsDataURL(file);
            }
        });

        // Função loadProfilePic (o seu código existente) ...
        function loadProfilePic() {
            if (usuario_atual) {
                const savedPic = localStorage.getItem(`profile_pic_${usuario_atual}`);
                if (savedPic) {
                    profileImageDisplay.src = savedPic;
                } else {
                    profileImageDisplay.src = defaultProfilePicUrl;
                }
            } else {
                 profileImageDisplay.src = defaultProfilePicUrl;
            }
        }

        // Pode chamar loadProfilePic() aqui para carregar a padrão ao iniciar
        loadProfilePic();
    }

    // ... (restante do seu código) ...

});
