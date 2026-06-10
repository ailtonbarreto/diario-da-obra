window.addEventListener("DOMContentLoaded", () => {


  if (sessionStorage.getItem("logon") === "1") {
    esconderLogin();
    carregarDashboard();
    return;
  }

  configurarFormularioLogin();
});


function configurarFormularioLogin() {
  const form = document.getElementById("loginForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const password = document.getElementById("password").value.trim();

    if (!password) {
      exibirAlerta("A senha é obrigatória!");
      return;
    }

    await validarSenha(password);
  });
}


async function validarSenha(password) {
  const spinner = document.getElementById("loading");
  if (spinner) spinner.style.display = "flex";

  try {

    const keyReq = await fetch("keys.json");
    const keyJson = await keyReq.json();

    const csvReq = await fetch(keyJson[0].base);
    const csvText = await csvReq.text();

    const senhas = processarCSV(csvText);

    if (!senhas.includes(password)) {
      exibirAlerta("Senha incorreta!");
      return;
    }

    // login OK
    sessionStorage.setItem("logon", "1");
    sessionStorage.setItem("empresa", "Barreto Soluções");

    esconderLogin();
    carregarDashboard();

  } catch (err) {
    console.error(err);
    exibirAlerta("Erro ao validar senha.");
  } finally {
    if (spinner) spinner.style.display = "none";
  }
}

function processarCSV(csv) {

  csv = csv.replace(/^\uFEFF/, ""); // remove BOM
  const separador = csv.includes(";") ? ";" : ",";
  const linhas = csv.split(/\r?\n/).filter(l => l.trim());

  const cabecalho = linhas[0]
    .split(separador)
    .map(c => limpar(c));

  const indexSenha = cabecalho.indexOf("password");

  if (indexSenha === -1) {
    throw new Error("Coluna 'password' não encontrada no CSV");
  }

  return linhas.slice(1).map(linha => {
    const valores = linha.split(separador);
    return limpar(valores[indexSenha]);
  });
}

function limpar(valor = "") {
  return valor.replace(/^"+|"+$/g, "").trim();
}

function esconderLogin() {
  const login = document.getElementById("container-login");
  if (login) login.style.display = "none";
}

function carregarDashboard() {
  const iframe = document.getElementById("tela");
  if (iframe) iframe.src = "dash.html";
}

function exibirAlerta(msg) {
  const alert = document.getElementById("alert");
  if (!alert) return;

  alert.innerText = msg;
  alert.style.display = "block";
}

