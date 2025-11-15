/* ---------- SAFE AREA UNIVERSAL ---------- */
body {
    margin: 0;
    padding: 0;
    font-family: Arial, sans-serif;

    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
    padding-left: env(safe-area-inset-left);
    padding-right: env(safe-area-inset-right);

    height: 100vh;
    height: 100dvh;
    width: 100vw;
    min-height: 100vh;

    display: flex;
    justify-content: center;
    align-items: center;

    color: #000;

    /* 🎨 GRADIENTE — substitui QUALQUER vermelho */
    background: linear-gradient(135deg, #7f8c8d 0%, #3498db 50%, #e67e22 100%);
}

/* ---------- TELAS ---------- */
.tela {
    width: 100vw;
    max-width: 400px;
    padding: 20px;
    box-sizing: border-box;
    display: none;
    flex-direction: column;
    align-items: center;
    gap: 15px;
}

.tela.ativa {
    display: flex;
    background-color: transparent;
}

/* Alinha telas específicas ao topo */
#tela-perfil.tela.ativa,
#tela-registro.tela.ativa {
    align-self: flex-start;
}

/* ---------- FORM CONTROLS ---------- */
input {
    width: 100%;
    padding: 10px;
    margin: 10px 0;
    border-radius: 5px;
    border: 1px solid #ccc;
    font-size: 16px;
    box-sizing: border-box;
    color: #000;
}

.input-wrap {
    position: relative;
    width: 100%;
}

.input-wrap input { padding-right: 44px; }

.eye-btn {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    cursor: pointer;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.eye-btn svg {
    width: 20px;
    height: 20px;
    stroke: #222;
    fill: none;
}

/* ---------- BOTÕES COM EFEITO ---------- */
button,
.icon-btn,
.text-btn-edit-pic,
.btn-salvar-dia,
#btn-gerir-foto,
.popup-opcoes .opcao-foto {
    transition: transform 0.1s ease-out, background-color 0.2s ease-in-out, color 0.2s ease-in-out;
    transform: none;
}

button:active,
.icon-btn:active,
.text-btn-edit-pic:active,
.btn-salvar-dia:active,
#btn-gerir-foto:active,
.popup-opcoes .opcao-foto:active {
    transform: scale(0.96);
}

button {
    padding: 10px 15px;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    width: 100%;
    font-size: 16px;
}

#btn-entrar, #btn-salvar-cadastro, #btn-gerar-csv, #btn-logout {
    background: #2196f3;
    color: #fff;
}

#btn-abrir-cadastro, #btn-voltar-login {
    background: #e0e0e0;
}

/* ---------- LISTA DE DIAS ---------- */
#lista-dias {
    max-height: 72vh;
    overflow-y: auto;
}

.card-dia {
    background: #f9f9f9;
    padding: 25px;
    border-radius: 10px;
    margin-bottom: 10px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    color: #000;
}

.card-dia .destaque {
    font-weight: bold;
    text-align: center;
    margin-bottom: 5px;
    padding: 50px;
}

/* ---------- PERFIL ---------- */
.perfil-app {
    width: 320px;
    overflow: hidden;
    position: relative;
    color: white;
}

.perfil-topo {
    display: flex;
    justify-content: center;
    padding-top: 20px;
    padding-bottom: 20px;
}

.foto-container {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    overflow: hidden;
    border: 0px solid #fff;
    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
}

.profile-pic {
    width: 100%;
    height: auto;
    object-fit: cover;
}

/* ---------- ÍCONES DO PERFIL ---------- */
.icon-btn {
    position: absolute;
    background-color: transparent;
    border: none;
    cursor: pointer;
    padding: 0;
    border-radius: 5px;
    font-size: 1.4rem;
}

.top-right {
    position: absolute;
    top: calc(env(safe-area-inset-top, 10px) + 10px);
    right: 10px;
    background-color: rgba(255,255,255,0.8);
    padding: 9px;
    border-radius: 20%;
    display: flex;
    justify-content: center;
    align-items: center;
}

.bottom-right {
    position: absolute;
    bottom: env(safe-area-inset-bottom, 15px);
    right: center;
    padding: 25px;
    font-size: 0.9rem;
}

/* ---------- CARD DE PERFIL ---------- */
.perfil-card {
    text-align: center;
    padding: 15px;
    background: #FFF;
    border-radius: 15px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    width: 100%;
    max-width: 350px;
}

/* ---------- LOGIN GLASS ---------- */
#tela-login.tela.ativa {
    background-color: rgba(255, 255, 255, 0.4);
    backdrop-filter: blur(12px);
    border-radius: 20px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.1);
    border: 1px solid rgba(255,255,255,0.5);
    padding: 40px 30px;
    max-width: 350px;
}

/* Inputs login */
#tela-login input {
    background-color: rgba(255,255,255,0.6);
    border-bottom: 1px solid rgba(0,0,0,0.2);
}

/* ---------- POPUP FOTO ---------- */
.popup-opcoes {
    display: none;
    position: absolute;
    bottom: 100%;
    width: 150px;
    left: 50%;
    transform: translateX(-50%);
    background-color: rgba(255,255,255,0.7);
    box-shadow: 0 4px 10px rgba(0,0,0,0.1);
    border-radius: 8px;
    z-index: 10;
}
