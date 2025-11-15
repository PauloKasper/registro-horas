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


document.addEventListener("DOMContentLoaded", () => {
    let usuario_atual = null, registros = {};

    // Registro do Service Worker (Mantido no script.js se sw.js não for usado)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js')
        .then(() => console.log('Service Worker registrado'))
        .catch(err => console.error('Erro SW:', err));
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
    document.getElementById("btn-abrir-cadastro").onclick = () => mostrar("tela-cadastro");
    document.getElementById("btn-voltar-login").onclick = () => mostrar("tela-login");

    // CADASTRO
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
    document.getElementById("btn-gerar-csv").onclick = () => {
        let linhas = ["Data,Entrada,Saída Almoço,Retorno,Saída Final"];
        for (const d in registros) { const r = registros[d]; linhas.push(`${d},${r.entrada},${r.saida_alm},${r.retorno},${r.saida_final}`); }
        const blob = new Blob([linhas.join("\n")], { type: "text/csv" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `horas_${usuario_atual}.csv`;
        a.click();
    };

  // --- Perfil e Upload de Foto (Lógica Consolidada) ---
    const editPicBtn = document.getElementById('edit-pic-btn'); // O novo botão de texto
    const fileInput = document.getElementById('file-input');
    const profileImageDisplay = document.getElementById('profile-image-display');
    // removePicBtn original foi removido do HTML, mas a lógica está aqui

    if (editPicBtn && fileInput && profileImageDisplay) {

        // Função para carregar a foto armazenada ao iniciar
        function loadProfilePic() {
            const savedPic = localStorage.getItem(`profile_pic_${usuario_atual}`);
            if (savedPic) {
                profileImageDisplay.src = savedPic;
            } else {
                // Define uma imagem padrão se não houver foto salva
                profileImageDisplay.src = 'URL_DA_SUA_FOTO_PADRAO.jpg';
            }
        }

        // Lógica para o botão "Editar Foto"
        editPicBtn.addEventListener('click', (event) => {
            const hasPicture = profileImageDisplay.src && !profileImageDisplay.src.includes('URL_DA_SUA_FOTO_PADRAO.jpg');

            // Se o utilizador carregar com a tecla Shift premida E já houver uma foto, remove a foto
            if (event.shiftKey && hasPicture) {
                event.preventDefault(); // Impede o comportamento padrão (abrir seletor de arquivo)
                // Lógica de remover foto (anteriormente no removePicBtn)
                localStorage.removeItem(`profile_pic_${usuario_atual}`);
                loadProfilePic(); // Carrega a imagem padrão
                alert("Foto de perfil removida.");
            } else {
                // Comportamento padrão: abre o seletor de ficheiros
                fileInput.click();
            }
        });

        // Lógica de upload de nova foto
        fileInput.addEventListener('change', (event) => {
            const files = event.target.files;
            if (files.length > 0) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const dataUrl = e.target.result;
                    profileImageDisplay.src = dataUrl;
                    // Salva a imagem no localStorage para persistência
                    localStorage.setItem(`profile_pic_${usuario_atual}`, dataUrl);
                };
                reader.readAsDataURL(files);
            }
        });


        // Lógica para o botão "X" (Remover Foto)
        removePicBtn.addEventListener('click', () => {
            profileImageDisplay.src = "URL_DA_SUA_FOTO.jpg";
            // localStorage.removeItem('userProfilePic');
        });
    }

    // Carregar imagem salva (dentro do DOMContentLoaded)
    const savedPic = localStorage.getItem('userProfilePic');
    if (savedPic && profileImageDisplay) {
        profileImageDisplay.src = savedPic;
    }


    // --- Navegação entre Telas (Continução) ---

    // Configuracao do botao da engrenagem está agora na função mostrar()
    if(document.getElementById("btn-configurações-voltar")) document.getElementById("btn-configurações-voltar").onclick = () => mostrar("tela-perfil");
    if(document.getElementById("btn-registrar-hora")) document.getElementById("btn-registrar-hora").onclick = () => mostrar("tela-registro");

    // LOGOUT e Voltar do Registro
    if(document.getElementById("btn-registro-voltar")) document.getElementById("btn-registro-voltar").onclick = () => mostrar("tela-perfil");
    if(document.getElementById("btn-logout-perfil")) document.getElementById("btn-logout-perfil").onclick = () => mostrar("tela-login");


    // --- OLHO SENHA e Máscaras ---

    let show = false;
    const toggleSenhaEl = document.getElementById("toggle-senha");
    const senhaInputEl = document.getElementById("senha");
    const iconEyeEl = document.getElementById("icon-eye");

    if(toggleSenhaEl && senhaInputEl && iconEyeEl) {
        toggleSenhaEl.onclick = () => {
            show = !show;
            senhaInputEl.type = show ? "text" : "password";
            iconEyeEl.innerHTML = show
                ? `<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>`
                : `<path d="M1 12c3-5 8-8 11-8s8 3 11 8"/><path d="M1 1l22 22"/>`;
        };
    }

    // Funções de máscara de hora (mantidas)
    function aplicarMascaraHora(input){
      const campo = input.closest(".campo");
      const erroDiv = campo?.querySelector(".erro-hora");

      input.addEventListener("input", function(){
        let v = this.value.replace(/\D/g,"");
        if(v.length > 4) v = v.slice(0,4);
        if(v.length >= 3) v = v.slice(0,2) + ":" + v.slice(2);
        this.value = v;
        limparErro();
      });

      input.addEventListener("keypress", function(e){
        if(!/[0-9]/.test(e.key)){
          e.preventDefault();
          if(erroDiv) erroDiv.innerText = "Só são permitidos números";
          input.style.border = "2px solid red";
        }
      });

      input.addEventListener("blur", function(){
        if(this.value === "") return;
        const partes = this.value.split(":");
        if(partes.length !== 2) return marcarErro("Formato inválido HH:MM");

        let h = parseInt(partes[0],10);
        let m = parseInt(partes[1],10);
        if(h>23 || m>59) marcarErro("Hora inválida 00:00-23:59");
        else limparErro();
      });

      function marcarErro(msg){
        input.style.border = "2px solid red";
        if(erroDiv) erroDiv.innerText = msg;
      }

      function limparErro(){
        input.style.border = "1px solid #ccc";
        if(erroDiv) erroDiv.innerText = "";
      }
    }

    document.querySelector(".btn-editar")?.addEventListener("click", () => {
      alert("Função de edição ainda não implementada!");
    });


    // Observer para inputs dinâmicos
    const observer = new MutationObserver(() => {
        document.querySelectorAll("#lista-dias input").forEach(inp => aplicarMascaraHora(inp));
    });

    const listaDiasEl = document.getElementById("lista-dias");
    if(listaDiasEl) {
        observer.observe(listaDiasEl, {childList:true,subtree:true});
    }
});
