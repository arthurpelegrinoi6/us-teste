/* Us: app fechado do casal. Site estático, sem build. Tudo conversa com o Supabase (login, banco e fotos). */
(function () {
"use strict";

/* ============ ambiente ============
   A cópia de teste (/us-teste/) mora no mesmo endereço-base do app real e usa o mesmo banco. Para não misturar
   login, aparelho e preferências no mesmo navegador, tudo que é guardado localmente usa chaves próprias por ambiente.
   A escolha é feita só aqui. */
const AMBIENTE = location.pathname.includes("/us-teste") ? "teste" : "real";
const TESTE = AMBIENTE === "teste";
const AUTH_KEY = TESTE ? "us-teste-auth" : "us-auth";
const SESSAO_DB = TESTE ? "us-teste-sessao" : "us-sessao";
const HID_KEY = TESTE ? "us-teste-cal-ocultos" : "us-cal-ocultos";
if (TESTE) {
  try { document.title = "Us (teste)"; } catch (e) { }
  const faixa = document.createElement("div"); faixa.className = "amb-teste"; faixa.textContent = "Ambiente de teste"; faixa.setAttribute("role", "note");
  document.body.appendChild(faixa);
}

/* ============ conexão ============ */
const SB_URL = "https://qjouhtitpufjnhocbnbs.supabase.co";
const SB_KEY = "sb_publishable_jFwJ41vOmpU4uTI44YbPdA_TxmA53gS";
const SB_KEY_LEGADA = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqb3VodGl0cHVmam5ob2NibmJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUyMDEyNjgsImV4cCI6MjExMDc3NzI2OH0.yYO_ahpMMXpEd0gZTVt6nZ13yFBeh28V7ryujkv2Hd8";
let sb = null;

/* ============ utilidades ============ */
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESL = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const SEM = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const pad = n => String(n).padStart(2, "0");
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = s => { const [y, m, d] = String(s).slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d); };
const todayDate = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const fmtN = n => Number(n).toLocaleString("pt-BR");
const plural = (n, a, b) => `${fmtN(n)} ${n === 1 ? a : b}`;
const cap1 = s => s.charAt(0).toUpperCase() + s.slice(1);
const dayDiff = (a, b) => Math.round((a - b) / 864e5);

function fmtLong(s) { const d = parseYmd(s); return `${d.getDate()} de ${MESL[d.getMonth()]} de ${d.getFullYear()}`; }
function fmtShort(s, withYear = true) { const d = parseYmd(s); return `${d.getDate()} ${MES[d.getMonth()]}${withYear ? " " + d.getFullYear() : ""}`; }
function rangeLabel(a, b) {
  if (a && b) {
    const da = parseYmd(a), db = parseYmd(b);
    if (a === b) return fmtShort(a);
    if (da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth()) return `${da.getDate()} a ${db.getDate()} ${MES[db.getMonth()]} ${db.getFullYear()}`;
    if (da.getFullYear() === db.getFullYear()) return `${fmtShort(a, false)} a ${fmtShort(b)}`;
    return `${fmtShort(a)} a ${fmtShort(b)}`;
  }
  if (a) return fmtShort(a);
  if (b) return `até ${fmtShort(b)}`;
  return "Sem datas";
}
function juntos(from, to) {
  let m = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) m--;
  if (m < 1) { const d = Math.max(0, dayDiff(to, from)); return d === 1 ? "1 dia" : `${d} dias`; }
  if (m < 12) return m === 1 ? "1 mês" : `${m} meses`;
  const a = Math.floor(m / 12), r = m % 12, as = a === 1 ? "1 ano" : `${a} anos`;
  return r ? `${as} e ${r === 1 ? "1 mês" : r + " meses"}` : as;
}
function relDay(iso) {
  const d = new Date(iso); if (isNaN(d)) return "";
  const t = todayDate(), dd = new Date(d.getFullYear(), d.getMonth(), d.getDate()), diff = dayDiff(t, dd);
  if (diff <= 0) return "hoje";
  if (diff === 1) return "ontem";
  if (diff < 7) return SEM[dd.getDay()];
  return fmtShort(ymd(dd), dd.getFullYear() !== t.getFullYear());
}

const IC = {
  back: '<path d="m15 5-7 7 7 7"/>', next: '<path d="m9 5 7 7-7 7"/>', plus: '<path d="M12 5v14M5 12h14"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>', trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  pin: '<path d="M9 4h6l-1 6 3 3v2H7v-2l3-3Z"/><path d="M12 15v6"/>', lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  note: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>', check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>', copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  grip: '<path d="M5 9h14M5 15h14"/>', repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="m7 22-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
  edit: '<path d="M12 20h8"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>', pinfill: '<path d="M9 4h6l-1 6 3 3v2H7v-2l3-3Z" fill="currentColor"/><path d="M12 15v6"/>',
  alarm: '<circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.5 1.5"/><path d="M4.5 5.5 7.5 3M19.5 5.5 16.5 3"/>', tcheck: '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 3 3 5-6"/>'
};
function ic(name, size = 22, sw = 2) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[name]}</svg>`;
}
const PLAY = '<svg width="18" height="18" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5Z"/></svg>';

/* ============ estado ============ */
const S = { user: null, members: [], couple: null, media: [], passeio: [], dayTitles: [], trips: [], lists: [], items: [], events: [], calendars: [], dates: [], sections: [], taskRem: [], loaded: false, lastLoad: 0 };
const t0 = todayDate();
const UI = {
  tab: "feed", seg: "datas", openList: null, panel: null, viewer: null,
  sel: null, calY: t0.getFullYear(), calM: t0.getMonth(), selDay: ymd(t0),
  authTab: "entrar", authEmail: "", recovery: false, onbMode: "criar"
};
const view = $("view"), panel = $("panel"), viewer = $("viewer"), gate = $("gate"), app = $("app");

const me = () => S.members.find(m => m.user_id === (S.user && S.user.id)) || null;
const partner = () => S.members.find(m => m.user_id !== (S.user && S.user.id)) || null;
const nameOf = uid => { const m = S.members.find(x => x.user_id === uid); return m ? (m.display_name || "Alguém") : "Alguém"; };
const memberColor = uid => { const i = S.members.findIndex(m => m.user_id === uid); return i === 0 ? "var(--wine)" : "#e0899a"; };
const whoColor = uid => uid ? memberColor(uid) : "var(--red)";
const whoName = uid => uid ? nameOf(uid) : "Os dois";
const coupleNames = () => S.members.map(m => m.display_name || "Alguém").join(" & ");

/* ============ erros ============ */
function isNet(e) { const m = String((e && e.message) || e || ""); return /failed to fetch|networkerror|load failed|network request|timeout/i.test(m); }
function friendly(e, fallback) {
  const m = String((e && e.message) || e || "");
  if (isNet(e)) return "Sem conexão. Confira a internet e tente de novo.";
  if (/jwt expired|not signed in|invalid jwt/i.test(m)) return "Sua sessão expirou. Saia e entre de novo.";
  if (/row-level security|permission denied/i.test(m)) return "Você não tem permissão para isso. Entre de novo e tente outra vez.";
  return fallback || "Algo deu errado. Tente de novo em instantes.";
}
async function q(p) { const r = await p; if (r.error) throw r.error; return r.data; }

/* ============ avisos ============ */
const toastEl = $("toast"); let toastT;
function toast(m) { toastEl.textContent = m; toastEl.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove("on"), 3200); }

/* ============ fotos privadas: links assinados em lote ============ */
const urlCache = new Map();
const fresh = p => { const c = urlCache.get(p); return c && c.exp > Date.now(); };
let hydrating = false, hydrateAgain = false;
async function hydrate() {
  if (hydrating) { hydrateAgain = true; return; }
  hydrating = true;
  try {
    do {
      hydrateAgain = false;
      const els = [...document.querySelectorAll("[data-path]:not([data-ok])")];
      const need = [...new Set(els.map(e => e.dataset.path).filter(p => p && !fresh(p)))];
      for (let i = 0; i < need.length; i += 100) {
        const chunk = need.slice(i, i + 100);
        try {
          const { data } = await sb.storage.from("media").createSignedUrls(chunk, 3600);
          (data || []).forEach(d => { if (d && d.signedUrl) urlCache.set(d.path, { url: d.signedUrl, exp: Date.now() + 55 * 60e3 }); });
        } catch (e) { /* tenta de novo no próximo desenho */ }
      }
      els.forEach(e => {
        const c = urlCache.get(e.dataset.path);
        if (c && fresh(e.dataset.path)) { e.src = e.tagName === "VIDEO" && e.dataset.thumb ? c.url + "#t=0.1" : c.url; e.dataset.ok = "1"; }
      });
    } while (hydrateAgain);
  } finally { hydrating = false; }
}
document.addEventListener("error", e => {
  const t = e.target;
  if (t && t.dataset && t.dataset.path && !t.dataset.retry) { t.dataset.retry = "1"; urlCache.delete(t.dataset.path); delete t.dataset.ok; hydrate(); }
}, true);
const imgTag = (path, alt = "", extra = "") => `<img data-path="${esc(path)}" alt="${esc(alt)}" ${extra}>`;

/* ============ carregar dados ============ */
async function fetchAll(table, build) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(sb.from(table).select("*")).range(from, from + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}
const sortMembers = mem => mem.sort((a, b) => String(a.joined_at).localeCompare(String(b.joined_at)) || a.user_id.localeCompare(b.user_id));
async function loadData() {
  const mem = await q(sb.from("couple_members").select("*"));
  S.members = sortMembers(mem);
  if (!me()) { S.couple = null; return false; }
  const coupleId = me().couple_id;
  const [couple, media, trips, lists, items, events, cals, dts, secs, dtit, rems] = await Promise.all([
    q(sb.from("couples").select("*").eq("id", coupleId).single()),
    fetchAll("media", b => b.order("taken_at", { ascending: false }).order("created_at", { ascending: false }).order("id")),
    q(sb.from("trips").select("*").order("created_at", { ascending: false })),
    q(sb.from("lists").select("*").order("updated_at", { ascending: false })),
    fetchAll("list_items", b => b.order("position", { ascending: true }).order("created_at", { ascending: true }).order("id")),
    q(sb.from("events").select("*").order("starts_on", { ascending: true })),
    sb.from("calendars").select("*").order("created_at", { ascending: true }).then(r => r.error ? [] : r.data, () => []),
    sb.from("couple_dates").select("*").order("created_at", { ascending: true }).then(r => r.error ? [] : r.data, () => []),
    sb.from("list_sections").select("*").order("position", { ascending: true }).then(r => r.error ? [] : r.data, () => []),
    sb.from("media_day_titles").select("*").then(r => r.error ? [] : r.data, () => []),
    sb.from("task_reminders").select("*").then(r => r.error ? [] : r.data, () => [])
  ]);
  S.dates = dts; S.sections = secs; S.taskRem = rems;
  S.dayTitles = dtit;
  S.couple = couple; S.media = media.filter(m => !m.expires_at); S.passeio = media.filter(m => m.expires_at); S.trips = trips; S.lists = lists; S.items = items; S.events = events; S.calendars = cals;
  S.loaded = true; S.lastLoad = Date.now();
  return true;
}

/* ============ entrada (login, cadastro, recuperação) ============ */
function showGate(html) { app.hidden = true; gate.hidden = false; gate.innerHTML = html; closeSheet(); }
function loadingHTML(msg) { return `<div class="center stack"><div class="spinner" role="progressbar" aria-label="Carregando"></div><p>${esc(msg || "Carregando…")}</p></div>`; }
function errorGate(e) {
  showGate(`<div class="center stack"><h1 class="step">Não deu para abrir o Us</h1><p>${esc(friendly(e, "Algo deu errado ao carregar."))}</p><button class="btn" data-g="retry">Tentar de novo</button><button class="btn ghost" data-g="signout">Sair da conta</button></div>`);
}
const AUTH_HERO = `<div class="hero-us" role="img" aria-label="Us"><svg class="mark" viewBox="204 150 616 700" aria-hidden="true"><path d="M262 292C240 560 330 796 512 796C694 796 784 560 762 292C756 196 690 170 624 196C540 228 430 262 430 366C430 470 608 444 608 546C608 640 468 656 418 584" fill="none" stroke="currentColor" stroke-width="56" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Us</span></div><p class="tagline">Baixar o Us juntos é o novo juntar as escovas de dente.</p><p class="lede">Fotos, listas e datas, só de vocês dois.</p>`;
function authMsg(kind, text) { const el = $("authmsg"); if (el) { el.className = "msg " + kind; el.textContent = text; el.hidden = false; } }
function authErr(e) {
  const m = String((e && e.message) || e || "");
  if (isNet(e)) return "Sem conexão. Confira a internet e tente de novo.";
  if (/invalid login/i.test(m)) return "E-mail ou senha incorretos. Confira e tente de novo.";
  if (/not confirmed/i.test(m)) return "Falta confirmar seu e-mail. Abra o link que enviamos e volte para entrar.";
  if (/already registered|already been registered/i.test(m)) return "Esse e-mail já tem conta. Use a aba Entrar.";
  if (/password/i.test(m) && /(least|short|weak|characters)/i.test(m)) return "A senha precisa ter pelo menos 6 caracteres.";
  if (/valid email|invalid email|unable to validate email/i.test(m)) return "Esse e-mail não parece certo. Confira e tente de novo.";
  if (/rate limit|too many|security purposes/i.test(m)) return "Muitas tentativas seguidas. Espere um minuto e tente de novo.";
  if (/same password|different from the old/i.test(m)) return "Escolha uma senha diferente da anterior.";
  return "Não deu certo. Tente de novo em instantes.";
}
function showAuth(initialMsg) {
  const t = UI.authTab;
  if (t === "enviado") {
    showGate(`<div class="center">${AUTH_HERO}<div class="msg ok">Enviamos um link para <b>${esc(UI.authEmail)}</b>. Abra, confirme e volte para entrar.</div><button class="btn ghost" data-g="tab" data-v="entrar">Voltar para entrar</button></div>`);
    return;
  }
  if (t === "esqueci") {
    showGate(`<div class="center">${AUTH_HERO}
      <p id="authmsg" class="msg" hidden></p>
      <form data-form="esqueci" novalidate>
        <label class="field"><span>E-mail</span><input name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="off" required value="${esc(UI.authEmail)}"></label>
        <button class="btn" type="submit">Enviar link</button>
      </form>
      <div class="row-links"><button class="link" data-g="tab" data-v="entrar">Voltar para entrar</button></div></div>`);
    return;
  }
  const entrar = t !== "criar";
  showGate(`<div class="center">${AUTH_HERO}
    <div class="seg" role="group" aria-label="Entrar ou criar conta" style="margin:0 0 18px">
      <button data-g="tab" data-v="entrar" aria-pressed="${entrar}">Entrar</button>
      <button data-g="tab" data-v="criar" aria-pressed="${!entrar}">Criar conta</button>
    </div>
    <p id="authmsg" class="msg ${initialMsg ? "err" : ""}" ${initialMsg ? "" : "hidden"}>${esc(initialMsg || "")}</p>
    <form data-form="${entrar ? "entrar" : "criar"}" novalidate>
      <label class="field"><span>E-mail</span><input name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="off" required value="${esc(UI.authEmail)}"></label>
      <label class="field"><span>Senha</span><input name="senha" type="password" autocomplete="${entrar ? "current-password" : "new-password"}" minlength="6" required>${entrar ? "" : '<span class="help">Pelo menos 6 caracteres.</span>'}</label>
      <button class="btn" type="submit">${entrar ? "Entrar" : "Criar conta"}</button>
    </form>
    ${entrar ? '<div class="row-links"><button class="link" data-g="tab" data-v="esqueci">Esqueci a senha</button></div>' : ""}</div>`);
}
function showRecovery() {
  showGate(`<div class="center"><h1 class="step">Nova senha</h1><p class="lede">Escolha a senha que você vai usar daqui para frente.</p>
    <p id="authmsg" class="msg" hidden></p>
    <form data-form="recuperar" novalidate>
      <label class="field"><span>Nova senha</span><input name="senha" type="password" autocomplete="new-password" minlength="6" required><span class="help">Pelo menos 6 caracteres.</span></label>
      <button class="btn" type="submit">Salvar senha</button>
    </form></div>`);
}
function showOnboarding() {
  const criar = UI.onbMode === "criar";
  showGate(`<div class="center"><h1 class="step">Que bom ter você aqui</h1><p class="lede">Falta pouco para abrir o Us de vocês.</p>
    <p id="authmsg" class="msg" hidden></p>
    <form data-form="onb" novalidate>
      <label class="field"><span>Como você quer ser chamado(a)?</span><input name="nome" type="text" maxlength="60" autocomplete="given-name" required value="${esc(UI.onbName || "")}"></label>
      <div class="choice" role="group" aria-label="O que você quer fazer">
        <button type="button" data-g="mode" data-v="criar" aria-pressed="${criar}">Criar a conta do casal</button>
        <button type="button" data-g="mode" data-v="codigo" aria-pressed="${!criar}">Tenho um código</button>
      </div>
      ${criar ? '<p class="lede" style="margin-top:-4px">Você cria o Us e depois convida quem você ama com um código.</p>' : `<label class="field"><span>Código de convite</span><input name="codigo" type="text" maxlength="12" autocapitalize="characters" autocomplete="off" spellcheck="false" required value="${esc(UI.onbCode || "")}"><span class="help">Quem criou o Us encontra o código no perfil.</span></label>`}
      <button class="btn" type="submit">${criar ? "Criar a conta do casal" : "Entrar no Us"}</button>
    </form>
    <div class="row-links"><button class="link" data-g="signout">Sair da conta</button></div></div>`);
}
/* ---- sequência de perguntas: fase, datas preferidas, outras datas e aniversário (uma por tela, sempre com Pular) ---- */
const partnerName = () => { const p = partner(); return p && p.display_name ? p.display_name : "quem você ama"; };
const STAGES = [["namoro", "Namorados"], ["noivado", "Noivos"], ["casamento", "Casados"]];
const DKEYS = ["met", "kiss", "dating", "engaged", "married", "child"];
const DLABEL = { met: "Dia em que se conheceram", kiss: "Primeiro beijo", dating: "Pedido de namoro", engaged: "Pedido de noivado", married: "Casamento", child: "Nascimento do primeiro filho" };
const DSTEP = {
  stage: () => ({ h: "Vocês namoram, são noivos ou são casados?", lede: "Escolha o que descreve vocês hoje. Dá para mudar depois." }),
  pick: () => ({ h: "Quais são as datas preferidas do casal?", lede: "Marque as que quiser, ou nenhuma. Cada uma vira um lembrete todo ano, para os dois." }),
  met: () => ({ h: "Quando vocês se conheceram?", lede: "Vira um lembrete todo ano, para os dois.", label: DLABEL.met }),
  kiss: () => ({ h: "Quando foi o primeiro beijo?", lede: "Vira um lembrete todo ano, para os dois.", label: DLABEL.kiss }),
  dating: () => ({ h: "Quando foi o pedido de namoro?", lede: "O Us conta o tempo de vocês e lembra o aniversário de namoro todo ano.", label: DLABEL.dating }),
  engaged: () => ({ h: "Quando foi o pedido de noivado?", lede: "Vira um lembrete todo ano, para os dois.", label: DLABEL.engaged }),
  married: () => ({ h: "Quando foi o casamento?", lede: "Vira um lembrete todo ano, para os dois.", label: DLABEL.married }),
  child: () => ({ h: "Quando nasceu o primeiro filho?", lede: "O aniversário dele ou dela vira lembrete todo ano, para os dois." }),
  others: () => ({ h: "Outras datas importantes", lede: "Aniversário de um filho, de um pet, de alguém da família, ou uma data importante só de vocês dois. Se não tiver nenhuma, é só continuar." }),
  birthday: () => ({ h: "Quando é o seu aniversário?", lede: `Só ${partnerName()} vê esse lembrete, um dia antes.`, label: "Seu aniversário" })
};
/* quais datas ainda podem ser escolhidas (o que já está preenchido não volta) */
function flowOptions(f) {
  const st = f.stage, keys = ["met", "kiss", "dating"];
  if (st === "noivado" || st === "casamento") keys.push("engaged");
  if (st === "casamento") keys.push("married");
  return keys.filter(k => f.snap[k]);
}
/* todas as datas da fase (as já preenchidas aparecem marcadas, com a data embaixo) */
function flowShown(f) {
  const st = f.stage, keys = ["met", "kiss", "dating"];
  if (st === "noivado" || st === "casamento") keys.push("engaged");
  if (st === "casamento") keys.push("married", "child");
  return keys;
}
/* já vêm marcadas: namorados, pedido de namoro; noivos, namoro e noivado; casados, casamento */
function defaultChecked(f) {
  const base = f.stage === "casamento" ? ["married"] : f.stage === "noivado" ? ["dating", "engaged"] : ["dating"];
  return base.filter(k => f.snap[k]);
}
function filledDate(k) {
  const c = S.couple;
  if (k === "child") { const d = S.dates.find(x => x.kind === "child"); return d ? `${d.title} · ${fmtLong(d.date)}` : ""; }
  const v = { met: c.met_on, kiss: c.first_kiss_on, dating: c.start_date, engaged: c.engaged_on, married: c.married_on }[k];
  return v ? fmtLong(v) : "";
}
function flowPlan(f) {
  const out = [];
  if (f.snap.askStage) out.push("stage");
  if (flowOptions(f).length) out.push("pick");
  if (f.picked) DKEYS.filter(k => f.picked.includes(k)).forEach(k => out.push(k));
  out.push("others");
  if (f.snap.birthday) out.push("birthday");
  return out;
}
function startFlow() {
  const c = S.couple, mm = me();
  UI.dflow = { i: 0, stage: c.stage || null, picked: null, checked: null, rows: [{ title: "", date: "" }],
    snap: { askStage: !c.stage, met: !c.met_on, kiss: !c.first_kiss_on, dating: !c.start_date, engaged: !c.engaged_on, married: !c.married_on, child: !S.dates.some(d => d.kind === "child"), birthday: !mm.birthday } };
  flowShow().catch(e => errorGate(e));
}
async function flowShow() {
  const f = UI.dflow;
  if (f.i >= flowPlan(f).length) { await saveCouple({}, { mark: true }); UI.dflow = null; enterApp(); return; }
  showDatesStep();
}
function showDatesStep() {
  const f = UI.dflow, plan = flowPlan(f), k = plan[f.i], d = DSTEP[k](), n = plan.length, last = f.i === n - 1, hoje = ymd(todayDate());
  const semContagem = k === "stage" || k === "pick";
  const head = semContagem ? `<div style="height:20px"></div>` : `<p class="stepno" role="status">${f.i + 1} de ${n}</p><div class="dbar" aria-hidden="true">${plan.map((_, j) => `<i class="${j <= f.i ? "on" : ""}"></i>`).join("")}</div>`;
  const go = last ? "Concluir" : "Continuar";
  let body;
  if (k === "stage") body = `<div class="pick-list" role="group" aria-label="Fase do casal">${STAGES.map(([v, t]) => `<button type="button" class="pick-opt" data-g="stage" data-v="${v}">${t}</button>`).join("")}</div>`;
  else if (k === "pick") {
    if (!f.checked) f.checked = defaultChecked(f);
    body = `<div class="pick-list" role="group" aria-label="Datas preferidas">${flowShown(f).map(o => f.snap[o]
      ? `<button type="button" class="pick-opt multi" data-g="ptoggle" data-v="${o}" aria-pressed="${f.checked.includes(o)}"><span class="cb" aria-hidden="true">${ic("check", 14, 3.4)}</span><span class="po-t">${esc(DLABEL[o])}</span></button>`
      : `<div class="pick-opt multi locked" role="group" aria-label="${esc(DLABEL[o])}, já preenchido: ${esc(filledDate(o))}"><span class="cb" aria-hidden="true">${ic("check", 14, 3.4)}</span><span class="po-t">${esc(DLABEL[o])}<small>${esc(filledDate(o))}</small></span></div>`).join("")}</div>
      <button class="btn" type="button" data-g="pcont" style="margin-top:14px">${go}</button>`;
  } else if (k === "child") body = `<form data-form="child" novalidate>
      <label class="field"><span>Nome</span><input name="nome" maxlength="60" autocomplete="off"></label>
      <label class="field"><span>Aniversário</span><input name="data" type="date" min="1900-01-01" max="${hoje}"></label>
      <button class="btn" type="submit">${go}</button></form>`;
  else if (k === "others") body = `<form data-form="others" novalidate>
      ${f.rows.map((r, j) => `<div class="kid">
        <label class="field"><span>Nome da data</span><input data-row="${j}" data-f="title" maxlength="80" autocomplete="off" placeholder="Ex.: Aniversário da Letícia" value="${esc(r.title)}"></label>
        <label class="field"><span>Dia</span><input type="date" data-row="${j}" data-f="date" min="1900-01-01" value="${esc(r.date)}"></label>
        ${f.rows.length > 1 ? `<button type="button" class="link" data-g="rrem" data-i="${j}">Remover</button>` : ""}</div>`).join("")}
      ${f.rows.length < 20 ? `<button type="button" class="btn ghost" data-g="radd">Adicionar outra</button>` : ""}
      <button class="btn" type="submit">${go}</button></form>`;
  else body = `<form data-form="datas" novalidate>
      <label class="field"><span>${esc(d.label)}</span><input name="data" type="date" min="1900-01-01" max="${hoje}"></label>
      <button class="btn" type="submit">${go}</button></form>`;
  showGate(`<div class="center">${head}
    <h1 class="step" style="margin-top:18px">${esc(d.h)}</h1><p class="lede">${esc(d.lede)}</p>
    <p id="authmsg" class="msg" hidden></p>
    ${body}
    <button class="btn soft" type="button" data-g="skipdates">Pular</button></div>`);
}
const DCOL = { met: "met", kiss: "kiss", dating: "start", engaged: "engaged", married: "married" };
/* val vazio = Pular (nada é gravado nem apagado) */
async function flowAdvance(val) {
  const f = UI.dflow; if (!f) return;
  const k = flowPlan(f)[f.i];
  if (k === "pick") f.picked = val === "ok" ? [...(f.checked || [])] : [];
  else if (val) {
    if (k === "stage") { await saveCouple({ stage: val }); f.stage = val; f.checked = null; }
    else if (DCOL[k]) await saveCouple({ [DCOL[k]]: val });
    else if (k === "birthday") await saveDates({ birthday: val }, true);
  }
  f.i++; await flowShow();
}
async function flowChild(form) {
  const nome = form.nome.value.trim(), data = form.data.value, hoje = ymd(todayDate());
  if (!nome) return authMsg("err", "Escreva o nome ou toque em Pular.");
  if (!data) return authMsg("err", "Escolha a data de nascimento ou toque em Pular.");
  if (data > hoje || data < "1900-01-01") return authMsg("err", "Essa data não vale. Confira o dia, o mês e o ano.");
  await q(sb.from("couple_dates").insert({ couple_id: S.couple.id, title: nome, date: data, kind: "child" }));
  await refreshCore(); UI.dflow.i++; await flowShow();
}
async function flowOthers() {
  const f = UI.dflow, rows = f.rows.map(r => ({ title: r.title.trim(), date: r.date })).filter(r => r.title || r.date);
  if (rows.some(r => !r.title || !r.date)) return authMsg("err", "Preencha o nome e o dia de cada data, ou toque em Remover.");
  if (rows.some(r => r.date < "1900-01-01" || r.date > "2100-01-01")) return authMsg("err", "Alguma data não vale. Confira o dia, o mês e o ano.");
  if (rows.length) { await q(sb.from("couple_dates").insert(rows.map(r => ({ couple_id: S.couple.id, title: r.title, date: r.date, kind: "other" })))); await refreshCore(); }
  f.i++; await flowShow();
}
async function refreshCore() {
  const [mem, cp, evs, dts] = await Promise.all([
    q(sb.from("couple_members").select("*")),
    q(sb.from("couples").select("*").eq("id", S.couple.id).single()),
    q(sb.from("events").select("*").order("starts_on", { ascending: true })),
    sb.from("couple_dates").select("*").order("created_at", { ascending: true }).then(r => r.error ? S.dates : r.data, () => S.dates)
  ]);
  S.members = sortMembers(mem); S.couple = cp; S.events = evs; S.dates = dts;
}
/* fase e datas do casal pelo banco (que também cria os compromissos). v só traz o que mudou de propósito; o resto fica como está */
async function saveCouple(v, o = {}) {
  const fields = ["stage", "start", "engaged", "married", "met", "kiss"].filter(k => k in v);
  await q(sb.rpc("save_couple_info", { p_stage: v.stage || null, p_start_on: v.start || null, p_engaged_on: v.engaged || null, p_married_on: v.married || null, p_met_on: v.met || null, p_first_kiss_on: v.kiss || null, p_mark_onboarded: !!o.mark, p_fields: fields }));
  await refreshCore();
}
/* meu aniversário (escondido de mim) */
async function saveDates(v, mark) {
  const fields = ["birthday", "met", "kiss"].filter(k => k in v);
  await q(sb.rpc("save_my_dates", { p_birthday: v.birthday || null, p_met_on: v.met || null, p_first_kiss_on: v.kiss || null, p_mark_onboarded: !!mark, p_fields: fields }));
  await refreshCore();
}

const FORMS = {
  async entrar(f) {
    const email = f.email.value.trim(), senha = f.senha.value; UI.authEmail = email;
    if (!email || !senha) return authMsg("err", "Preencha o e-mail e a senha.");
    const { error } = await sb.auth.signInWithPassword({ email, password: senha });
    if (error) throw error;
    /* o resto acontece no evento SIGNED_IN */
  },
  async criar(f) {
    const email = f.email.value.trim(), senha = f.senha.value; UI.authEmail = email;
    if (!email) return authMsg("err", "Escreva seu e-mail.");
    if (senha.length < 6) return authMsg("err", "A senha precisa ter pelo menos 6 caracteres.");
    const { data, error } = await sb.auth.signUp({ email, password: senha, options: { emailRedirectTo: location.origin + location.pathname } });
    if (error) throw error;
    if (data && data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) return authMsg("err", "Esse e-mail já tem conta. Use a aba Entrar.");
    if (!data.session) { UI.authTab = "enviado"; showAuth(); }
  },
  async esqueci(f) {
    const email = f.email.value.trim(); UI.authEmail = email;
    if (!email) return authMsg("err", "Escreva seu e-mail.");
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    if (error) throw error;
    authMsg("ok", `Enviamos um link para ${email}. Abra e crie sua nova senha.`);
  },
  async recuperar(f) {
    const senha = f.senha.value;
    if (senha.length < 6) return authMsg("err", "A senha precisa ter pelo menos 6 caracteres.");
    const { error } = await sb.auth.updateUser({ password: senha });
    if (error) throw error;
    UI.recovery = false;
    history.replaceState(null, "", location.pathname);
    await boot();
  },
  async onb(f) {
    const nome = f.nome.value.trim(); UI.onbName = nome;
    if (!nome) return authMsg("err", "Escreva como você quer ser chamado(a).");
    if (UI.onbMode === "criar") {
      await q(sb.rpc("create_couple", { p_display_name: nome }));
    } else {
      const codigo = f.codigo.value.trim(); UI.onbCode = codigo;
      if (!codigo) return authMsg("err", "Digite o código de convite.");
      await q(sb.rpc("join_couple", { p_code: codigo, p_display_name: nome }));
    }
    await boot();
  },
  async datas(f) {
    const v = f.data.value;
    if (!v) return authMsg("err", "Escolha a data ou toque em Pular.");
    if (v > ymd(todayDate()) || v < "1900-01-01") return authMsg("err", "Essa data não vale. Confira o dia, o mês e o ano.");
    await flowAdvance(v);
  },
  async child(f) { await flowChild(f); },
  async others() { await flowOthers(); }
};
function onbErr(e) {
  const m = String((e && e.message) || "");
  if (/invalid code/i.test(m)) return "Código não encontrado. Confira com quem te convidou.";
  if (/couple is full/i.test(m)) return "Esse casal já tem duas pessoas.";
  return null;
}
gate.addEventListener("submit", async e => {
  const f = e.target.closest("form[data-form]"); if (!f) return;
  e.preventDefault();
  const btn = f.querySelector("[type=submit]"); const label = btn.textContent;
  btn.disabled = true; btn.textContent = "Um instante…";
  try { await FORMS[f.dataset.form](f); }
  catch (err) {
    if (/already in a couple/i.test(String(err && err.message))) { boot(); return; }
    authMsg("err", onbErr(err) || (["onb", "datas", "child", "others"].includes(f.dataset.form) ? friendly(err) : authErr(err)));
  }
  if (btn.isConnected) { btn.disabled = false; btn.textContent = label; }
});
gate.addEventListener("input", e => { const t = e.target; if (UI.dflow && t.dataset && t.dataset.row != null && UI.dflow.rows[+t.dataset.row]) UI.dflow.rows[+t.dataset.row][t.dataset.f] = t.value; });
gate.addEventListener("click", async e => {
  const t = e.target.closest("[data-g]"); if (!t) return;
  const a = t.dataset.g;
  if (a === "tab") { const f = gate.querySelector("input[name=email]"); if (f) UI.authEmail = f.value; UI.authTab = t.dataset.v; showAuth(); }
  else if (a === "mode") { const f = gate.querySelector("input[name=nome]"); if (f) UI.onbName = f.value; UI.onbMode = t.dataset.v; showOnboarding(); }
  else if (a === "retry") boot();
  else if (a === "signout") signOut();
  else if (a === "skipdates") { if (t.disabled) return; t.disabled = true; try { await flowAdvance(null); } catch (err) { authMsg("err", friendly(err)); } if (t.isConnected) t.disabled = false; }
  else if (UI.dflow && ["stage", "ptoggle", "pcont", "radd", "rrem"].includes(a)) {
    const f = UI.dflow;
    if (a === "ptoggle") { const v = t.dataset.v, i = f.checked.indexOf(v); if (i >= 0) f.checked.splice(i, 1); else f.checked.push(v); showDatesStep(); return; }
    if (a === "radd") { f.rows.push({ title: "", date: "" }); showDatesStep(); const n = gate.querySelectorAll("[data-f=title]"); if (n.length) n[n.length - 1].focus(); return; }
    if (a === "rrem") { f.rows.splice(+t.dataset.i, 1); showDatesStep(); return; }
    if (t.disabled) return; t.disabled = true;
    try { await flowAdvance(a === "stage" ? t.dataset.v : "ok"); } catch (err) { authMsg("err", friendly(err)); }
    if (t.isConnected) t.disabled = false;
  }
});
async function signOut() {
  try { await dropPushOnSignOut(); } catch (e) { /* segue mesmo assim */ }
  try { await sb.auth.signOut(); } catch (e) { /* segue mesmo assim */ }
  resetState(); UI.authTab = "entrar"; showAuth();
}
function resetState() {
  Object.assign(S, { user: null, members: [], couple: null, media: [], passeio: [], dayTitles: [], trips: [], lists: [], items: [], events: [], calendars: [], dates: [], sections: [], taskRem: [], loaded: false });
  Object.assign(UI, { tab: "feed", openList: null, panel: null, viewer: null, dflow: null });
  urlCache.clear(); closePanel(true); closeViewer(true); closeSheet();
}

/* ============ início ============ */
let bootP = null;
function boot() { if (!bootP) bootP = bootRun().finally(() => { bootP = null; }); return bootP; }
async function bootRun() {
  showGate(loadingHTML("Abrindo o Us…"));
  try {
    const { data } = await sb.auth.getSession();
    if (UI.recovery) { showRecovery(); return; }
    if (!data.session) { showAuth(); return; }
    S.user = data.session.user;
    const has = await loadData();
    if (!has) { showOnboarding(); return; }
    proceed();
  } catch (e) { errorGate(e); }
}
/* depois do cadastro: quem ainda não passou pelas perguntas do casal responde agora (uma vez só; o que já estiver preenchido não volta) */
function proceed() { const m = me(); if (m && !m.stage_onboarded_at) startFlow(); else enterApp(); }
function enterApp() {
  gate.hidden = true; app.hidden = false;
  document.querySelectorAll(".tab").forEach(t => t.dataset.tab === UI.tab ? t.setAttribute("aria-current", "page") : t.removeAttribute("aria-current"));
  render();
  if (UI.abrirPasseio) { UI.abrirPasseio = false; openPanel("passeio"); }
  if (UI.abrirTarefa) { const a = UI.abrirTarefa; UI.abrirTarefa = null; abrirTarefaDoAviso(a.id, a.modo); }
}

/* ============ telas ============ */
function render(keep) {
  if (!S.couple) return;
  const y = view.scrollTop;
  view.innerHTML = { feed: feedHTML, fotos: fotosHTML, listas: listasHTML, cal: calHTML }[UI.tab]();
  const lAberta = UI.tab === "listas" && UI.openList !== null ? S.lists.find(l => l.id === UI.openList) : null;
  $("fab").innerHTML = UI.tab === "listas" && UI.openList === null ? `<button class="compose" data-act="novalista" aria-label="Nova lista">${ic("edit", 22)}</button>`
    : lAberta && lAberta.auto_key === "tasks" ? `<button class="compose" data-act="novatarefa" aria-label="Nova tarefa">${ic("plus", 24, 2.4)}</button>` : "";
  view.scrollTop = keep ? y : 0;
  fitAll();
  document.querySelectorAll(".tab").forEach(t => t.dataset.tab === UI.tab ? t.setAttribute("aria-current", "page") : t.removeAttribute("aria-current"));
  hydrate();
}
function avatar(m, cls = "av") {
  if (!m) return "";
  if (m.avatar_path) return `<span class="${cls}">${imgTag(m.avatar_path, m.display_name || "")}</span>`;
  return `<span class="${cls} init" aria-hidden="true">${esc((m.display_name || "?").trim().charAt(0).toUpperCase())}</span>`;
}
/* data laranja de câmera dos anos 90: DD MM 'AA a partir de taken_at (só aparência) */
function stampTxt(m) {
  const x = /^(\d{4})-(\d{2})-(\d{2})/.exec(m.taken_at || "");
  return x ? `${x[3]} ${x[2]} <span class="ap">'${x[1].slice(2)}</span>` : "";
}
function tile(m, extra = "", rev = false) {
  const media = m.kind === "video"
    ? `<video data-path="${esc(m.path)}" data-thumb="1" preload="metadata" muted playsinline aria-hidden="true"></video><span class="vid">${PLAY}</span>`
    : imgTag(m.thumb_path || m.path, m.caption || m.place || "Foto");
  const label = `aria-label="${m.kind === "video" ? "Vídeo" : "Foto"}${m.caption ? ": " + esc(m.caption) : ""}"`;
  if (rev) return `<button class="tile print" data-media="${m.id}" ${label} ${extra}><span class="ph">${media}<span class="stamp" aria-hidden="true">${stampTxt(m)}</span></span></button>`;
  return `<button class="tile" data-media="${m.id}" ${label} ${extra}>${media}</button>`;
}

const SPOTIFY_RE = /^https:\/\/(open\.spotify\.com|spotify\.link)\/\S*$/;
function aboutHTML() {
  const c = S.couple;
  if (c.about_mode === "musica") {
    if (c.song_title) {
      /* abre o link do Spotify do casal; sem link, busca pelo título e artista */
      const url = c.song_url && SPOTIFY_RE.test(c.song_url) ? c.song_url : "https://open.spotify.com/search/" + encodeURIComponent((c.song_title + " " + (c.song_artist || "")).trim());
      return `<div class="about"><a class="song-line" href="${esc(url)}" target="_blank" rel="noopener noreferrer" aria-label="Ouvir ${esc(c.song_title)} no Spotify"><span class="note">${ic("note", 18, 1.9)}</span><div style="min-width:0"><div class="lbl">A música do casal</div><div class="tt">${esc(c.song_title)}${c.song_artist ? ` <span>· ${esc(c.song_artist)}</span>` : ""}</div><div class="go">Ouvir no Spotify ›</div></div></a></div>`;
    }
    return `<div class="addlink"><button class="link" data-act="editar">Adicionar a música do casal</button></div>`;
  }
  if (c.about_mode === "frase") {
    if (c.phrase) return `<div class="about"><div class="quote"><p>“${esc(c.phrase)}”</p></div></div>`;
    return `<div class="addlink"><button class="link" data-act="editar">Adicionar uma frase</button></div>`;
  }
  return `<div style="height:8px"></div>`;
}
function feedHTML() {
  const c = S.couple, ms = S.members, posts = S.media.filter(m => m.in_feed);
  const names = ms.length ? coupleNames() : "";
  const start = c.start_date
    ? `Desde ${esc(fmtLong(c.start_date))} · <b>${esc(juntos(parseYmd(c.start_date), todayDate()))}</b>`
    : `<button class="link" data-act="editar" style="min-height:32px">Adicionar a data de vocês</button>`;
  const cover = c.cover_path
    ? `<div class="cover">${imgTag(c.cover_path, "Capa do perfil")}</div>`
    : `<div class="cover empty"><button class="pbtn" data-act="capa">Escolher capa</button></div>`;
  const invite = ms.length < 2 ? `<div class="invite"><div><b>Convide quem você ama</b><span class="code" aria-label="Código de convite">${esc(c.invite_code)}</span></div><button class="pbtn red small" data-act="copiar" style="padding:8px 16px;flex:none">Copiar código</button></div>` : "";
  return `
  <div class="appbar"><span><span class="logo" role="img" aria-label="Us"><svg class="mark" viewBox="204 150 616 700" aria-hidden="true"><path d="M262 292C240 560 330 796 512 796C694 796 784 560 762 292C756 196 690 170 624 196C540 228 430 262 430 366C430 470 608 444 608 546C608 640 468 656 418 584" fill="none" stroke="currentColor" stroke-width="56" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Us</span></span><span class="lock">${ic("lock", 12, 2.4)}só nós dois</span></span>
    <span class="acts"><button data-act="novo" aria-label="Novo post">${ic("plus", 25, 1.8)}</button></span></div>
  ${cover}
  <div class="prof">
    <div class="avs">${ms.map(m => avatar(m)).join("")}</div>
    <h1 class="names">${esc(names)}</h1>
    <div class="bio">${start}</div>
    <div class="stats"><div><b>${fmtN(posts.length)}</b><span>no feed</span></div><div><b>${fmtN(S.media.length)}</b><span>fotos e vídeos</span></div><div><b>${fmtN(S.trips.length)}</b><span>viagens</span></div></div>
    <div class="prof-btns"><button class="pbtn" data-act="editar">Editar perfil</button><button class="pbtn red" data-act="novo">Novo post</button></div>
  </div>
  ${invite}
  ${aboutHTML()}
  ${posts.length ? `<div class="grid rev">${posts.map(m => tile(m, "", true)).join("")}</div>` : `<div class="empty-state"><h3>O feed de vocês começa aqui</h3><p>Escolha as fotos que contam a história de vocês e elas aparecem nesta grade.</p><button class="btn small" data-act="novo">Fazer o primeiro post</button></div>`}
  <div style="height:16px"></div>`;
}

/* ---- fotos e vídeos ---- */
function groupBy(arr, keyFn) { const m = new Map(); arr.forEach(x => { const k = keyFn(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); }); return m; }
function tripMedia(id) { return S.media.filter(m => m.trip_id === id); }
function fotosHTML() {
  const total = S.media.length, vids = S.media.filter(m => m.kind === "video").length;
  let body = "";
  if (!total && UI.seg !== "viagens") {
    body = `<div class="empty-state"><h3>Nenhuma foto ainda</h3><p>Suba as primeiras fotos e vídeos de vocês. Só vocês dois veem.</p><button class="btn small" data-act="subir">Subir fotos</button></div>`;
  } else if (UI.seg === "datas") {
    const g = groupBy(S.media, m => m.taken_at.slice(0, 7));
    body = [...g.keys()].sort().reverse().map(k => {
      const [y, mo] = k.split("-"), list = g.get(k);
      return `<div class="mhead"><h3>${cap1(MESL[+mo - 1])} ${y}</h3><span>${plural(list.length, "item", "itens")}</span></div><div class="pgrid">${list.map(m => tile(m)).join("")}</div>`;
    }).join("");
  } else if (UI.seg === "viagens") {
    const trips = [...S.trips].sort((a, b) => String(b.start_date || "").localeCompare(String(a.start_date || "")) || String(b.created_at).localeCompare(String(a.created_at)));
    body = `<div class="albums"><button class="album new" data-act="novaviagem" aria-label="Nova viagem"><div class="cv">${ic("plus", 26)}<span style="display:block;margin-top:4px;position:absolute;bottom:14px">Nova viagem</span></div></button>` + trips.map(t => {
      const ms = tripMedia(t.id), first = [...ms].sort((a, b) => a.taken_at.localeCompare(b.taken_at)).find(m => m.kind === "photo");
      return `<button class="album" data-trip="${t.id}"><div class="cv ${first ? "" : "ph"}">${first ? imgTag(first.path, "") : ic("pin", 30, 1.8)}<span class="cnt">${ms.length ? fmtN(ms.length) : "sem fotos"}</span></div><b>${esc(t.name)}</b><span>${esc(rangeLabel(t.start_date, t.end_date))}</span></button>`;
    }).join("") + `</div>`;
    if (!trips.length) body += `<p class="none" style="padding:0 16px">Crie uma viagem e junte nela as fotos da estrada, do hotel e do jantar.</p>`;
  } else {
    const g = groupBy(S.media.filter(m => m.place && m.place.trim()), m => m.place.trim().toLowerCase());
    const rows = [...g.values()].map(l => ({ name: l[0].place.trim(), list: l, key: l[0].place.trim().toLowerCase() })).sort((a, b) => b.list.length - a.list.length);
    const semLugar = S.media.filter(m => !(m.place && m.place.trim())).length;
    body = rows.length
      ? `<div class="places">${rows.map(r => `<button class="place" data-place="${esc(r.key)}"><b><span class="pin"></span>${esc(r.name)}</b><span class="th">${r.list.filter(m => m.kind === "photo").slice(0, 3).map(m => `<span>${imgTag(m.path, "")}</span>`).join("")}</span><span class="meta">${plural(r.list.length, "foto ou vídeo", "fotos e vídeos")}</span></button>`).join("")}</div>`
      : `<div class="empty-state"><h3>Nenhum lugar marcado</h3><p>Abra uma foto e escreva onde ela foi tirada. Os lugares aparecem aqui.</p></div>`;
    if (rows.length && semLugar) body += `<p class="none" style="padding:0 16px">${plural(semLugar, "item sem lugar", "itens sem lugar")}. Abra a foto para marcar onde foi.</p>`;
  }
  return `
  <div class="appbar"><span style="font-weight:700;font-size:15px">Tudo de vocês</span>
    <span class="acts"><button data-act="subir" aria-label="Subir fotos e vídeos" style="display:flex;gap:6px;align-items:center;color:var(--red);font-weight:700;font-size:14.5px">${ic("upload", 20, 2.2)}Subir</button></span></div>
  <h1 class="big-title">Fotos e vídeos</h1>
  <p class="sub-title">${plural(total, "item", "itens")} dos dois · ${plural(vids, "vídeo", "vídeos")}</p>
  ${passeioCardHTML()}
  <div class="seg" role="group" aria-label="Organizar por">
    <button data-seg="datas" aria-pressed="${UI.seg === "datas"}">Datas</button>
    <button data-seg="viagens" aria-pressed="${UI.seg === "viagens"}">Viagens</button>
    <button data-seg="lugares" aria-pressed="${UI.seg === "lugares"}">Lugares</button>
  </div>
  ${body}<div style="height:16px"></div>`;
}

/* ---- painel (viagem e lugar) ---- */
function renderPanel() {
  const p = UI.panel; if (!p) return;
  if (p.type === "passeio") { renderPasseio(); return; }
  let title = "", sub = "", list = [], actions = "", empty = "";
  if (p.type === "trip") {
    const t = S.trips.find(x => x.id === p.id); if (!t) { closePanel(); return; }
    list = tripMedia(t.id); title = t.name; sub = `${rangeLabel(t.start_date, t.end_date)} · ${plural(list.length, "item", "itens")}`;
    actions = `<div class="bar-actions"><button class="pbtn red" data-act="trip-upload">Enviar fotos</button><button class="pbtn" data-act="trip-pick">Escolher das já enviadas</button></div>
      <div class="bar-actions"><button class="pbtn" data-act="trip-del" style="color:#a00f25;flex:none">Apagar viagem</button></div>`;
    empty = "Nenhuma foto nesta viagem ainda. Envie novas ou escolha entre as que já estão aqui.";
  } else {
    list = S.media.filter(m => m.place && m.place.trim().toLowerCase() === p.key);
    if (!list.length) { closePanel(); return; }
    title = list[0].place.trim(); sub = plural(list.length, "foto ou vídeo", "fotos e vídeos");
  }
  panel.innerHTML = `<div class="appbar"><button class="back" data-act="fecharpanel" aria-label="Voltar">${ic("back", 22)}Fotos</button><span></span></div>
    <h1 class="big-title">${esc(title)}</h1><p class="sub-title">${esc(sub)}</p>${actions}
    ${list.length ? `<div class="pgrid" style="margin-top:14px">${list.map(m => tile(m)).join("")}</div>` : `<p class="none" style="padding:12px 16px">${esc(empty)}</p>`}
    <div style="height:30px"></div>`;
  hydrate();
}
function openPanel(type, idOrKey) { UI.panel = type === "trip" ? { type, id: idOrKey } : { type, key: idOrKey }; if (type === "passeio") UI.sel = null; renderPanel(); panel.scrollTop = 0; panel.classList.add("on"); }
function closePanel(quick) { UI.panel = null; UI.sel = null; panel.classList.remove("on"); if (quick) panel.innerHTML = ""; }

/* ---- visualizador (post) ---- */
function renderViewer() {
  const m = findMedia(UI.viewer);
  if (!m) { closeViewer(); return; }
  const trip = m.trip_id ? S.trips.find(t => t.id === m.trip_id) : null;
  const minis = S.members.map(x => x.avatar_path ? `<span>${imgTag(x.avatar_path, "")}</span>` : `<span class="init" aria-hidden="true">${esc((x.display_name || "?").charAt(0).toUpperCase())}</span>`).join("");
  const mediaEl = m.kind === "video"
    ? `<video data-path="${esc(m.path)}" controls playsinline preload="metadata"></video>`
    : imgTag(m.path, m.caption || "Foto");
  const stage = UI.viewerFeed && m.in_feed
    ? `<div class="vmedia rev"><div class="print"><div class="ph">${mediaEl}${m.kind === "video" ? "" : `<span class="stamp" aria-hidden="true">${stampTxt(m)}</span>`}</div></div></div>`
    : `<div class="vmedia">${mediaEl}</div>`;
  viewer.innerHTML = `
    <div class="appbar"><button class="back" data-act="fecharviewer" aria-label="Voltar">${ic("back", 22)}Voltar</button><span></span></div>
    <div class="post-head"><span class="mini">${minis}</span><div><div class="who">${esc(coupleNames())}</div><div class="where">${esc(m.place || "")}</div></div></div>
    ${stage}
    <div class="vact">
      <button class="pbtn ${m.in_feed ? "" : "red"}" data-act="v-feed">${m.in_feed ? "Tirar do feed" : "Pôr no feed"}</button>
      ${m.expires_at ? '<button class="pbtn" data-act="v-save">Salvar no celular</button>' : '<button class="pbtn" data-act="v-edit">Editar detalhes</button>'}
      <button class="pbtn dng" data-act="v-del">Apagar</button>
    </div>
    <div class="post-body">${m.caption ? `<b>${esc(coupleNames())}</b> ${esc(m.caption)}` : `<span style="color:var(--ink-2)">Sem legenda.</span>`}
      <div class="date">${esc(fmtLong(m.taken_at))}${m.place ? ` · ${esc(m.place)}` : ""}${trip ? ` · ${esc(trip.name)}` : ""}${m.in_feed ? " · no feed" : ""}${m.expires_at ? ` · some ${quando(diasRestantes(m))}` : ""}</div></div>`;
  hydrate();
}
function openViewer(id, fromFeed = false) { UI.viewer = id; UI.viewerFeed = fromFeed; renderViewer(); viewer.scrollTop = 0; viewer.classList.add("on"); }
function closeViewer(quick) { UI.viewer = null; viewer.classList.remove("on"); const v = viewer.querySelector("video"); if (v) v.pause(); if (quick) viewer.innerHTML = ""; }

/* ---- listas ---- */
const cmpItem = (a, b) => (a.position - b.position) || String(a.created_at).localeCompare(String(b.created_at)) || a.id.localeCompare(b.id);
const cmpSec = (a, b) => (a.position - b.position) || String(a.created_at).localeCompare(String(b.created_at)) || a.id.localeCompare(b.id);
const itemsOf = id => S.items.filter(i => i.list_id === id).sort(cmpItem);
const secsOf = id => S.sections.filter(x => x.list_id === id).sort(cmpSec);
const itemsIn = (listId, secId) => itemsOf(listId).filter(i => (i.section_id || null) === (secId || null));
function listPreview(L) {
  const its = itemsOf(L.id); if (!its.length) return "Sem itens";
  const open = its.filter(i => !i.done).map(i => i.text);
  return open.length ? open.join(", ") : "Tudo feito";
}
/* modelos de lista: seções prontas (sempre dá para editar depois) */
const anoAtual = () => new Date().getFullYear();
const MODELOS = [
  { k: "metas", e: "🎯", t: "Metas do Casal", d: "Por área: saúde, carreira, finanças e mais", rated: false, kw: ["meta"], secs: () => ["Saúde", "Mental", "Carreira", "Finanças", "Relacionamento", "Lazer"] },
  { k: "filmes", e: "🎬", t: "Filmes", d: "Os que vocês assistiram, por ano", rated: true, kw: ["filme"], secs: () => { const a = ["Favoritos"]; for (let y = anoAtual(); y >= 2023; y--) a.push(String(y)); return a; } },
  { k: "series", e: "📺", t: "Séries", d: "Assistindo, favoritas e as que querem ver", rated: true, kw: ["serie"], secs: () => ["Assistindo", "Favoritas", "Queremos ver"] },
  { k: "restaurantes", e: "🍽️", t: "Restaurantes", d: "Os favoritos e os que querem conhecer", rated: true, kw: ["restaurante"], secs: () => ["Favoritos", "Wishlist"] },
  { k: "viagens", e: "✈️", t: "Viagens", d: "As que já fizeram e as que sonham fazer", rated: false, kw: ["viage"], secs: () => ["Viagens feitas", "Wishlist"] },
  { k: "livros", e: "📚", t: "Livros", d: "Lendo, lidos e os que querem ler", rated: true, kw: ["livro"], secs: () => ["Lendo", "Lidos", "Queremos ler"] },
  { k: "programas", e: "🎟️", t: "Programas a dois", d: "O que querem fazer e o que já fizeram", rated: false, kw: ["programa"], secs: () => ["Queremos fazer", "Já fizemos"] },
  { k: "presentes", e: "🎁", t: "Presentes", d: "Ideias para cada um", rated: false, kw: ["presente"], secs: () => { const n = S.members.slice(0, 2).map(m => m.display_name || "alguém"); if (n.length < 2) n.push("quem você ama"); return n.map(x => `Ideias para ${x}`.slice(0, 80)); } },
  { k: "compras", e: "🛒", t: "Compras", d: "Por seção do mercado", rated: false, kw: ["compra"], secs: () => ["Hortifrúti", "Mercearia", "Limpeza", "Casa"] }
];
const semAcento = t => String(t).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const semEmoji = t => String(t).replace(/^[^\p{L}\p{N}]+/u, "").trim().toLowerCase();
const modeloDaLista = L => { const t = semAcento(L.title); return MODELOS.find(m => m.kw.some(w => t.includes(w))) || null; };
function metasLista() {
  return S.lists.filter(l => l.auto_key !== "tasks" && (modeloDaLista(l) || {}).k === "metas").sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))[0] || null;
}
function metasCardHTML() {
  const L = metasLista();
  if (!L) return `<button class="mcard" data-sug="metas" aria-label="Criar a lista Metas do Casal"><span class="mic" aria-hidden="true">🎯</span><span class="mbody"><span class="mttl">Metas do Casal</span><span class="msub">O que vocês querem conquistar juntos?</span></span><span class="mcta">Criar metas</span></button>`;
  const its = S.items.filter(i => i.list_id === L.id), tot = its.length, feitas = its.filter(i => i.done).length;
  const sub = !tot ? "Escrevam a primeira meta" : (feitas === tot ? "Todas cumpridas" : `${feitas} de ${tot} cumpridas`);
  return `<button class="mcard" data-list="${L.id}" aria-label="Abrir Metas do Casal. ${sub}"><span class="mic" aria-hidden="true">🎯</span><span class="mbody"><span class="mttl">Metas do Casal</span><span class="msub">${sub}</span></span><span class="mnext" aria-hidden="true">›</span></button>`;
}
function sugestoesHTML() {
  const tem = new Set(S.lists.map(l => (modeloDaLista(l) || {}).k));
  const falta = MODELOS.filter(m => m.k !== "metas" && !tem.has(m.k));
  if (!falta.length) return "";
  return `<div class="ngroup-h">Sugestões</div><div class="sugs">${falta.map(m => `<button class="sug" data-sug="${m.k}"><span class="e" aria-hidden="true">${m.e}</span>${esc(m.t)}</button>`).join("")}</div><p class="sug-h">Toque para criar a lista na hora, já com as seções.</p>`;
}
function listasHTML() {
  if (UI.openList !== null) { const Lo = S.lists.find(l => l.id === UI.openList); const html = Lo && Lo.auto_key === "tasks" ? tarefasHTML() : noteHTML(); if (html) return html; UI.openList = null; }
  const row = L => `<button class="nrow" data-list="${L.id}"><b>${esc(L.title)}</b><span><em>${esc(relDay(L.updated_at))}</em>${esc(listPreview(L))}</span></button>`;
  const mL = metasLista();
  const comuns = S.lists.filter(l => l.auto_key !== "tasks" && !(mL && l.id === mL.id));
  const sorted = [...comuns].sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
  const pins = sorted.filter(l => l.pinned), rest = sorted.filter(l => !l.pinned);
  return `<div class="notes-app">
    <div class="nbar" style="background:var(--group)"><span></span><span style="font-weight:600;color:var(--ink-2);font-size:13px">${esc(coupleNames())}</span></div>
    <h1 class="big-title">Listas</h1>
    ${tarefasCardHTML()}
    ${metasCardHTML()}
    ${!comuns.length ? `<div class="empty-state"><h3>Uma lista para cada vontade</h3><p>Restaurantes para conhecer, filmes, viagens, compras da casa. Toque no lápis para criar a primeira.</p></div>` : ""}
    ${pins.length ? `<div class="ngroup-h">Fixadas</div><div class="ngroup">${pins.map(row).join("")}</div>` : ""}
    ${rest.length ? `<div class="ngroup-h">Do casal</div><div class="ngroup">${rest.map(row).join("")}</div>` : ""}
    ${comuns.length ? `<div class="ncount">${plural(comuns.length, "lista", "listas")}</div>` : ""}
    ${sugestoesHTML()}
  </div>`;
}
const STAR = '<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9L3.5 9.7l5.9-.8Z"/>';
IC.star = STAR;
function itemHTML(it, L) {
  const stars = L.rated ? `<div class="stars" role="group" aria-label="Nota de 1 a 5">${[1, 2, 3, 4, 5].map(n => `<button type="button" class="star ${it.rating >= n ? "on" : ""}" data-rate="${it.id}" data-n="${n}" aria-pressed="${it.rating === n}" aria-label="Nota ${n} de 5: ${esc(it.text)}">${ic("star", 20, 1.6)}</button>`).join("")}</div>` : "";
  return `<div class="citem ${it.done ? "done" : ""}" data-item="${it.id}"><button class="cbox" data-check="${it.id}" aria-pressed="${it.done}" aria-label="${it.done ? "Desmarcar" : "Marcar"}: ${esc(it.text)}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></button><div class="body"><textarea class="tx-in" rows="1" maxlength="5000" data-edit="${it.id}" enterkeyhint="done" autocomplete="off" aria-label="Texto do item">${esc(it.text)}</textarea>${stars}</div><button class="grip" data-grip="${it.id}" aria-label="Arrastar para mudar a ordem: ${esc(it.text)}">${ic("grip", 20, 2)}</button><button class="del" data-delitem="${it.id}" aria-label="Apagar item: ${esc(it.text)}">${ic("x", 18, 2)}</button></div>`;
}
const addRowHTML = secId => `<div class="nadd"><span class="cbox" aria-hidden="true"></span><textarea class="nitem" rows="1" data-sec="${esc(secId || "")}" placeholder="Novo item" aria-label="Novo item" maxlength="5000" enterkeyhint="done" autocomplete="off" autocapitalize="sentences"></textarea></div>`;
function noteHTML() {
  const L = S.lists.find(l => l.id === UI.openList); if (!L) return "";
  const secs = secsOf(L.id), solto = itemsIn(L.id, null), modelo = !secs.length ? modeloDaLista(L) : null;
  const blocos = secs.map(x => `<div class="sec" data-sec="${x.id}">
      <div class="shead" data-shead="${x.id}"><input class="sec-in" data-sec-edit="${x.id}" value="${esc(x.title)}" maxlength="80" autocomplete="off" enterkeyhint="done" aria-label="Nome da seção"><button class="sgrip" data-sgrip="${x.id}" aria-label="Arrastar a seção ${esc(x.title)}">${ic("grip", 20, 2)}</button><button class="del" data-delsec="${x.id}" aria-label="Apagar a seção ${esc(x.title)}">${ic("x", 18, 2)}</button></div>
      ${itemsIn(L.id, x.id).map(it => itemHTML(it, L)).join("")}${addRowHTML(x.id)}</div>`).join("");
  return `<div class="lnote">
    <div class="nbar"><button data-act="voltarlista" class="back" style="color:var(--red);font-size:16px;font-weight:400">${ic("back", 20, 2.4)}Listas</button>
      <span class="icos"><button data-act="darnota" aria-pressed="${!!L.rated}" aria-label="${L.rated ? "Desligar as notas" : "Dar nota aos itens"}">${ic("star", 21, 1.9)}</button><button data-act="copiarlista" aria-label="Copiar lista">${ic("copy", 21, 1.9)}</button><button data-act="fixar" aria-pressed="${L.pinned}" aria-label="${L.pinned ? "Desafixar lista" : "Fixar lista"}">${ic(L.pinned ? "pinfill" : "pin", 21, 1.9)}</button><button data-act="apagarlista" aria-label="Apagar lista">${ic("trash", 21, 1.9)}</button></span></div>
    <div class="lnote-date">Atualizada ${esc(relDay(L.updated_at))}</div>
    <label class="sr" for="ltitle" style="position:absolute;left:-9999px">Título da lista</label>
    <input class="title-in" id="ltitle" value="${esc(L.title)}" maxlength="200" autocomplete="off" enterkeyhint="done">
    <div class="sec sec0">${solto.map(it => itemHTML(it, L)).join("")}${!secs.length ? addRowHTML("") : ""}</div>
    ${!secs.length && !solto.length ? `<p class="empty-note">Lista vazia. Escreva o primeiro item acima, ou cole uma lista inteira.</p>` : ""}
    ${blocos}
    <button class="nsec" data-act="novasecao">${ic("plus", 18, 2.2)}Nova seção</button>
    ${modelo ? `<button class="org-hint" data-act="organizar"><b>Organizar em seções</b><span>${esc(modelo.secs().join(", "))}</span></button>` : ""}
  </div>`;
}

/* ---- tarefas: lista especial "Tarefas" (uma por casal, criada pelo banco) ---- */
const tasksList = () => S.lists.find(l => l.auto_key === "tasks") || null;
const isTask = it => { const L = tasksList(); return !!(L && it && it.list_id === L.id); };
const taskAll = () => { const L = tasksList(); return L ? S.items.filter(i => i.list_id === L.id) : []; };
const todayYmd = () => ymd(new Date());
const isOverdue = t => !t.done && !!t.due_on && t.due_on < todayYmd();
/* de quem é, do ponto de vista de quem está olhando: mine (para você), both (dos dois), other (do parceiro) */
const taskGroup = t => t.assignee === (S.user && S.user.id) ? "mine" : t.assignee ? "other" : "both";
const GRUPO_ORDEM = { mine: 0, both: 1, other: 2 };
/* abertas: o que é seu primeiro; dentro de cada grupo, atrasadas, depois por prazo (sem prazo por último), depois a mais antiga */
const cmpTask = (a, b) => GRUPO_ORDEM[taskGroup(a)] - GRUPO_ORDEM[taskGroup(b)]
  || (isOverdue(b) - isOverdue(a))
  || String(a.due_on || "9999").localeCompare(String(b.due_on || "9999"))
  || String(a.created_at).localeCompare(String(b.created_at)) || a.id.localeCompare(b.id);
const myReminder = id => S.taskRem.find(r => r.item_id === id && !r.sent_at && new Date(r.remind_at) > new Date()) || null;
function dueLabel(t) {
  const d = parseYmd(t.due_on), diff = dayDiff(d, todayDate());
  if (diff < 0) return diff === -1 ? "venceu ontem" : `venceu há ${-diff} dias`;
  if (diff === 0) return "hoje";
  if (diff === 1) return "amanhã";
  if (diff < 7) return SEM[d.getDay()];
  return fmtShort(t.due_on, d.getFullYear() !== t0.getFullYear());
}
const horaTxt = d => d.getMinutes() ? `${d.getHours()}h${pad(d.getMinutes())}` : `${d.getHours()}h`;
function quandoTxt(iso) {
  const d = new Date(iso), diff = dayDiff(new Date(d.getFullYear(), d.getMonth(), d.getDate()), todayDate());
  const dia = diff === 0 ? "hoje" : diff === 1 ? "amanhã" : diff > 1 && diff < 7 ? SEM[d.getDay()] : fmtShort(ymd(d), d.getFullYear() !== t0.getFullYear());
  return `${dia} ${horaTxt(d)}`;
}
const CHECK_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
function taskMeta(t, curto) {
  const out = [], g = taskGroup(t), od = isOverdue(t), rem = t.done ? null : myReminder(t.id);
  if (curto) out.push(`<span>${g === "mine" ? "Para você" : g === "both" ? "Dos dois" : esc("Para " + partnerName())}</span>`);
  else if (g !== "other" && t.created_by && t.created_by !== (S.user && S.user.id)) out.push(`<span>${esc(nameOf(t.created_by))} pediu</span>`);
  if (t.due_on && !t.done) out.push(`<span class="${od ? "late" : ""}">${esc(dueLabel(t))}</span>`);
  if (rem) out.push(`<span class="alarm">${ic("alarm", 13, 2)}${esc(quandoTxt(rem.remind_at))}</span>`);
  return out.length ? `<span class="tmeta">${out.join("")}</span>` : "";
}
function taskRowHTML(t, curto) {
  const od = isOverdue(t);
  return `<div class="citem trow ${t.done ? "done" : ""} ${od ? "od" : ""}" data-item="${t.id}"><button class="cbox" data-check="${t.id}" aria-pressed="${t.done}" aria-label="${t.done ? "Desmarcar" : "Marcar como feita"}: ${esc(t.text)}">${CHECK_SVG}</button><button class="tbody" data-tarefa="${t.id}" aria-label="Abrir a tarefa: ${esc(t.text)}"><span class="tx">${esc(t.text)}</span>${taskMeta(t, curto)}</button></div>`;
}
function tarefasCardHTML() {
  const L = tasksList(); if (!L) return "";
  const all = taskAll(), open = all.filter(t => !t.done).sort(cmpTask), n = open.length;
  const late = open.filter(isOverdue).length;
  const vazio = !n ? `<p class="tvazio">${all.length ? "Tudo em dia." : "Nada pendente por aqui."}<span>${partner() ? `Passe uma tarefa para ${esc(partnerName())} ou anote uma para você.` : "Anote o que falta fazer."}</span></p>` : "";
  return `<section class="tcard" aria-label="Tarefas">
    <button class="thead" data-act="vertarefas" aria-label="Abrir todas as tarefas"><span class="tic">${ic("tcheck", 22, 2)}</span><span class="ttl">Tarefas</span><span class="tcount${late ? " hot" : ""}">${n ? (late ? `${plural(n, "aberta", "abertas")}, ${late} atrasada${late > 1 ? "s" : ""}` : plural(n, "aberta", "abertas")) : "em dia"}</span></button>
    ${n ? open.slice(0, 3).map(t => taskRowHTML(t, true)).join("") : vazio}
    <div class="tfoot"><button class="tall" data-act="vertarefas">${n > 3 ? `Ver todas (${n})` : "Ver todas"}${ic("next", 14, 2.6)}</button><button class="tadd" data-act="novatarefa" aria-label="Nova tarefa">${ic("plus", 16, 2.6)}Nova tarefa</button></div>
  </section>`;
}
function tarefasHTML() {
  const L = tasksList(); if (!L) return "";
  const all = taskAll(), open = all.filter(t => !t.done).sort(cmpTask), feitas = all.filter(t => t.done).sort((a, b) => String(b.done_at || b.created_at).localeCompare(String(a.done_at || a.created_at)));
  const late = open.filter(isOverdue).length;
  const grupos = [["mine", "Para você"], ["other", `Para ${partnerName()}`], ["both", "Dos dois"]];
  const blocos = grupos.map(([k, nome]) => { const its = open.filter(t => taskGroup(t) === k); return its.length ? `<div class="sec"><div class="ngroup-h">${esc(nome)}<span>${its.length}</span></div>${its.map(t => taskRowHTML(t, false)).join("")}</div>` : ""; }).join("");
  const sub = open.length ? `${plural(open.length, "aberta", "abertas")}${late ? ` · ${late} atrasada${late > 1 ? "s" : ""}` : ""}` : (all.length ? "Tudo em dia." : "");
  return `<div class="lnote tnote">
    <div class="nbar"><button data-act="voltarlista" class="back" style="color:var(--red);font-size:16px;font-weight:400">${ic("back", 20, 2.4)}Listas</button><span></span></div>
    <h1 class="t-title">Tarefas</h1>
    ${sub ? `<p class="t-sub${late ? " hot" : ""}">${sub}</p>` : ""}
    ${!all.length ? `<div class="empty-state"><h3>O que falta fazer, dividido</h3><p>Toque no + para anotar uma tarefa. ${partner() ? `Se for para ${esc(partnerName())}, ${esc(partnerName())} recebe um aviso.` : ""}</p></div>` : ""}
    ${blocos}
    ${feitas.length ? `<button class="t-feitas" data-act="feitas" aria-expanded="${!!UI.tarefasFeitas}">Feitas (${feitas.length})<span class="chev ${UI.tarefasFeitas ? "open" : ""}">${ic("next", 16, 2.4)}</span></button>${UI.tarefasFeitas ? `<div class="sec">${feitas.slice(0, 60).map(t => taskRowHTML(t, false)).join("")}</div>` : ""}` : ""}
  </div>`;
}

/* avisa o servidor para entregar os avisos pendentes agora (sem isso o aviso sai em até 1 minuto); erros não importam */
async function avisarTarefas() { try { await sb.functions.invoke("avisar-tarefas", { body: {} }); } catch (e) { } }

function openTarefa(id) {
  const L = tasksList(); const t = id ? S.items.find(i => i.id === id) : null; if (!L || (id && !t)) return;
  const eu = S.user.id, p = partner();
  const m = { text: t ? t.text : "", who: t ? (t.assignee || "") : (p ? "" : eu), due: t && t.due_on ? t.due_on : "", err: "" };
  const quem = [[eu, "Para mim"], ...(p ? [[p.user_id, `Para ${p.display_name || "quem você ama"}`], ["", "Dos dois"]] : [])];
  const rem = t && !t.done ? myReminder(t.id) : null;
  openSheet({
    model: m, focus: !t,
    view: () => `<h3>${t ? "Tarefa" : "Nova tarefa"}</h3>${m.err ? hint(m.err) : ""}
      ${t ? `<button type="button" class="btn ghost" data-s="feita">${t.done ? "Voltar para as abertas" : "Marcar como feita"}</button>` : ""}
      <form novalidate>
      <label class="field"><span>O que precisa ser feito</span><input data-m="text" maxlength="300" value="${esc(m.text)}" autocomplete="off" placeholder="Ex.: Pagar o condomínio" enterkeyhint="done"></label>
      <div class="field"><span>De quem é</span><div class="chips" role="group" aria-label="De quem é a tarefa">
        ${quem.map(([v, nome]) => `<button type="button" data-s="who" data-v="${esc(v)}" aria-pressed="${m.who === v}">${esc(nome)}</button>`).join("")}</div></div>
      <div class="field"><span>Prazo (opcional)</span><input type="date" data-m="due" value="${esc(m.due)}" aria-label="Prazo da tarefa">
        <div class="chips" style="margin:8px 0 0" role="group" aria-label="Atalhos de prazo"><button type="button" data-s="prazo" data-v="0">Hoje</button><button type="button" data-s="prazo" data-v="1">Amanhã</button>${m.due ? `<button type="button" data-s="prazo" data-v="">Sem prazo</button>` : ""}</div></div>
      ${t && !t.done ? `<div class="field"><span>Lembrete</span>${rem ? `<div class="remrow"><span class="alarm">${ic("alarm", 18, 2)}${esc(quandoTxt(rem.remind_at))}</span><button type="button" class="btn small ghost" data-s="lembrar">Mudar</button></div>` : `<button type="button" class="btn ghost" style="margin-top:0" data-s="lembrar">${ic("alarm", 18, 2)} Me lembrar</button>`}</div>` : ""}
      <button class="btn" type="submit">${t ? "Salvar" : "Criar tarefa"}</button>
      ${t ? `<button type="button" class="btn warn" data-s="apagar">Apagar tarefa</button>` : ""}</form>`,
    on: {
      who: x => { m.who = x.dataset.v; drawSheet(); },
      prazo: x => { const v = x.dataset.v; m.due = v === "" ? "" : ymd(new Date(t0.getFullYear(), t0.getMonth(), t0.getDate() + +v)); drawSheet(); },
      lembrar: () => openLembrar(t.id),
      feita: async () => { await toggleItem(t.id); closeSheet(); },
      apagar: () => apagarTarefa(t.id),
      submit: async () => {
        const texto = m.text.replace(/\s+/g, " ").trim();
        if (!texto) { m.err = "Escreva o que precisa ser feito."; drawSheet(); return; }
        const assignee = m.who || null;
        if (t) {
          const patch = {};
          if (texto !== t.text) patch.text = texto;
          if (assignee !== (t.assignee || null)) patch.assignee = assignee;
          if ((m.due || null) !== (t.due_on || null)) patch.due_on = m.due || null;
          if (Object.keys(patch).length) Object.assign(t, await q(sb.from("list_items").update(patch).eq("id", t.id).select().single()));
          closeSheet(); render(true); toast("Tarefa salva.");
          if ("assignee" in patch && assignee !== eu) avisarTarefas();
        } else {
          const r = await q(sb.from("list_items").insert({ list_id: L.id, couple_id: S.couple.id, text: texto, position: nextPos(L.id), assignee, due_on: m.due || null }).select().single());
          S.items.push(r); closeSheet(); render(true); toast(assignee === eu || !p ? "Tarefa criada." : `Tarefa criada. ${p.display_name || "Quem você ama"} recebe um aviso.`);
          if (assignee !== eu) avisarTarefas();
        }
      }
    }
  });
}
function apagarTarefa(id) {
  const t = S.items.find(i => i.id === id); if (!t) return;
  askConfirm(`Apagar "${t.text.length > 60 ? t.text.slice(0, 59) + "…" : t.text}"?`, "A tarefa some para os dois.", "Apagar", async () => {
    await q(sb.from("list_items").delete().eq("id", id));
    S.items = S.items.filter(i => i.id !== id); S.taskRem = S.taskRem.filter(r => r.item_id !== id);
    closeSheet(); render(true); toast("Tarefa apagada.");
  });
}

/* "Me lembrar": opções rápidas; quem toca no aviso cai aqui (fromPush) */
const pad2dt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
function opcoesLembrete(t) {
  const agora = new Date(), em = (dias, h) => new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + dias, h, 0, 0, 0);
  const o = [{ label: "Daqui a 1 hora", when: new Date(agora.getTime() + 3600e3) }];
  const h18 = em(0, 18);
  o.push(h18 - agora > 5 * 60e3 ? { label: "Hoje, 18h", when: h18 } : { label: "Amanhã, 18h", when: em(1, 18) });
  o.push({ label: "Amanhã, 9h", when: em(1, 9) });
  if (t.due_on) { const d9 = parseYmd(t.due_on); d9.setHours(9, 0, 0, 0); if (d9 > agora && !o.some(x => x.when.getTime() === d9.getTime())) o.push({ label: "No dia do prazo, 9h", when: d9 }); }
  return o;
}
function openLembrar(id, opts = {}) {
  const t = S.items.find(i => i.id === id); if (!t) return;
  const rem = myReminder(id), m = { custom: false, when: "", err: "" };
  const quemPassou = t.assigned_by && t.assigned_by !== S.user.id ? nameOf(t.assigned_by) : "";
  const salvar = async when => {
    if (!(when > new Date(Date.now() + 30e3))) { m.err = "Escolha um horário que ainda não passou."; drawSheet(); return; }
    await q(sb.rpc("set_task_reminder", { p_item: id, p_at: when.toISOString() }));
    S.taskRem = S.taskRem.filter(r => r.item_id !== id); S.taskRem.push({ item_id: id, user_id: S.user.id, couple_id: S.couple.id, remind_at: when.toISOString(), sent_at: null });
    closeSheet(); render(true); toast(`Lembrete marcado: ${quandoTxt(when.toISOString())}.`); offerPush();
  };
  openSheet({
    model: m, focus: false,
    view: () => `<h3>${opts.push ? "Me lembrar?" : "Me lembrar"}</h3>
      ${opts.push && quemPassou ? `<p class="hint">${esc(quemPassou)} ${t.assignee ? "te passou" : "criou para vocês dois"} esta tarefa.</p>` : ""}
      <p class="tq">${esc(t.text)}</p>${m.err ? hint(m.err) : ""}
      <div class="lopts" role="group" aria-label="Quando lembrar">
      ${opcoesLembrete(t).map((o, i) => `<button type="button" class="lopt" data-s="lemb" data-i="${i}"><span>${esc(o.label)}</span><em>${esc(quandoTxt(o.when.toISOString()))}</em></button>`).join("")}
      ${m.custom ? "" : `<button type="button" class="lopt" data-s="outro"><span>Escolher dia e hora</span><em aria-hidden="true">${ic("next", 16, 2.4)}</em></button>`}
      </div>
      ${m.custom ? `<label class="field" style="margin-top:12px"><span>Dia e hora</span><input type="datetime-local" data-m="when" value="${esc(m.when)}" min="${esc(pad2dt(new Date()))}"></label><button type="button" class="btn" data-s="definir">Definir lembrete</button>` : ""}
      ${rem ? `<button type="button" class="btn warn" data-s="tirar">Tirar o lembrete (${esc(quandoTxt(rem.remind_at))})</button>` : ""}
      <button type="button" class="btn ghost" data-s="agora-nao">${opts.push ? "Agora não" : "Voltar"}</button>`,
    on: {
      lemb: x => salvar(opcoesLembrete(t)[+x.dataset.i].when),
      outro: () => { const d = new Date(Date.now() + 3600e3); d.setMinutes(0, 0, 0); m.custom = true; m.when = pad2dt(d); drawSheet(); },
      definir: () => { const d = m.when ? new Date(m.when) : null; if (!d || isNaN(d)) { m.err = "Escolha o dia e a hora."; drawSheet(); return; } return salvar(d); },
      tirar: async () => {
        await q(sb.rpc("set_task_reminder", { p_item: id, p_at: null }));
        S.taskRem = S.taskRem.filter(r => r.item_id !== id); closeSheet(); render(true); toast("Lembrete removido.");
      },
      "agora-nao": () => sheetBack()
    }
  }, !!SH);
}
/* toque no aviso: abre a lista Tarefas na tarefa certa. m=lembrar abre o "Me lembrar"; m=ver abre a tarefa */
async function abrirTarefaDoAviso(id, modo) {
  let t = S.items.find(i => i.id === id);
  if (!t) { try { await loadData(); } catch (e) { } t = S.items.find(i => i.id === id); }
  closePanel(); closeViewer(); closeSheet();
  const L = tasksList(); if (L) { UI.tab = "listas"; UI.openList = L.id; render(); }
  if (!t) { toast("Essa tarefa não existe mais."); return; }
  if (modo === "lembrar" && !t.done) openLembrar(id, { push: true }); else openTarefa(id);
}

/* ---- calendário ---- */
const CASAL_COR = "#b3122a";
const PALETA = [["#2f6fd6", "Azul"], ["#2f8f5b", "Verde"], ["#e07a1f", "Laranja"], ["#7a4fd0", "Roxo"], ["#d9a400", "Amarelo"], ["#1f8a8a", "Azul-petróleo"], ["#e0899a", "Rosa"], ["#6e0b1a", "Vinho"], ["#7d6f71", "Cinza"], ["#c2410c", "Terracota"]];
const SUG_CALS = ["Médicos", "Viagens", "Filhos", "Tarefas da casa", "Trabalho"];
let HID = new Set();
try { HID = new Set(JSON.parse(localStorage.getItem(HID_KEY) || "[]")); } catch (e) { HID = new Set(); }
function saveHid() { try { localStorage.setItem(HID_KEY, JSON.stringify([...HID])); } catch (e) { } }
const calOf = e => e.calendar_id ? (S.calendars.find(c => c.id === e.calendar_id) || null) : null;
const evColor = e => { const c = calOf(e); return c ? c.color : CASAL_COR; };
const evVisible = e => !HID.has(calOf(e) ? e.calendar_id : "casal");
const evEnd = e => e.ends_on || e.starts_on;
const evTime = e => String(e.start_time || "").slice(0, 5) || e.time_label || "";
const sortEv = (a, b) => a.starts_on.localeCompare(b.starts_on) || evTime(a).localeCompare(evTime(b));
const isLeap = y => y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
/* dia em que um compromisso anual cai no ano y (29/02 vira 28/02 em ano sem bissexto); antes do ano original, nenhum */
function occIn(e, y) {
  const [sy, sm, sd] = e.starts_on.slice(0, 10).split("-").map(Number);
  if (y < sy) return null;
  const d = sm === 2 && sd === 29 && !isLeap(y) ? 28 : sd;
  return `${y}-${pad(sm)}-${pad(d)}`;
}
/* ---- repetição: cada compromisso tem uma regra (a antiga "todo ano" dos automáticos conta como 'yearly') ---- */
const repRule = e => e.repeat_rule || (e.repeats_yearly ? "yearly" : null);
const addDaysS = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
const evDur = e => e.ends_on ? Math.max(0, dayDiff(parseYmd(e.ends_on), parseYmd(e.starts_on))) : 0;
/* uma ocorrência COMEÇA neste dia? (mesma conta do banco: mês curto cai no último dia; 29/02 vira 28/02) */
function repOccursOn(e, ds) {
  const rule = repRule(e), s0 = e.starts_on.slice(0, 10);
  if (!rule) return ds === s0;
  if (ds < s0 || (e.repeat_until && ds > e.repeat_until)) return false;
  const d = parseYmd(ds), sd = parseYmd(s0), dow = d.getDay();
  if (rule === "daily") return true;
  if (rule === "yearly") return occIn(e, d.getFullYear()) === ds;
  if (rule === "monthly") return d.getDate() === Math.min(sd.getDate(), new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate());
  const days = e.repeat_days || [];
  if (!days.includes(dow)) return false;
  return rule === "weekly" || Math.round((dayDiff(d, sd) - dow + sd.getDay()) / 7) % 2 === 0;
}
/* começo da ocorrência que cobre este dia (considera a duração de compromissos de vários dias), ou null */
function occCover(e, ds) {
  if (!repRule(e)) return e.starts_on <= ds && evEnd(e) >= ds ? e.starts_on : null;
  const dur = Math.min(evDur(e), 366);
  for (let k = 0; k <= dur; k++) { const s1 = k ? addDaysS(ds, -k) : ds; if (repOccursOn(e, s1)) return s1; }
  return null;
}
/* primeira ocorrência que começa DEPOIS deste dia, ou null (série terminou) */
function nextOccStart(e, after) {
  if (!repRule(e)) return e.starts_on > after ? e.starts_on : null;
  if (repRule(e) === "yearly") {
    let on = occIn(e, Math.max(+after.slice(0, 4), +e.starts_on.slice(0, 4)));
    if (on <= after) on = occIn(e, +on.slice(0, 4) + 1);
    return e.repeat_until && on > e.repeat_until ? null : on;
  }
  for (let i = 1; i <= 400; i++) {
    const s1 = addDaysS(after, i);
    if (e.repeat_until && s1 > e.repeat_until) return null;
    if (repOccursOn(e, s1)) return s1;
  }
  return null;
}
/* o compromisso como aparece numa ocorrência (começo e fim daquela vez) */
const occ = (e, on) => repRule(e) ? Object.assign({}, e, { _serie: e._serie || e.starts_on, starts_on: on, ends_on: evDur(e) ? addDaysS(on, evDur(e)) : null }) : e;
const evsOn = ds => S.events.filter(e => evVisible(e) && occCover(e, ds));
/* próximos compromissos depois de um dia (os que repetem entram com a próxima data em que caem) */
function upcoming(after, n) {
  const out = [];
  S.events.filter(evVisible).forEach(e => { const on = nextOccStart(e, after); if (on) out.push(occ(e, on)); });
  return out.sort(sortEv).slice(0, n);
}
/* resumo da regra: "Todo sábado", "Seg e qua, a cada 2 semanas", "Todo mês, dia 5", "Todo dia, até 30/03/2027" */
const SEM3 = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
function repSummary(e) {
  const rule = e.repeat_rule; if (!rule) return "";
  const dias = [...(e.repeat_days || [])].sort((a, b) => a - b);
  const lista = a => { const t = a.map(i => SEM3[i]); const j = t.length > 1 ? t.slice(0, -1).join(", ") + " e " + t[t.length - 1] : t[0] || ""; return j.charAt(0).toUpperCase() + j.slice(1); };
  let t = "";
  if (rule === "daily") t = "Todo dia";
  else if (rule === "weekly") t = dias.length === 1 ? `${[0, 6].includes(dias[0]) ? "Todo" : "Toda"} ${SEM[dias[0]]}` : `${lista(dias)}, toda semana`;
  else if (rule === "biweekly") t = `${lista(dias)}, a cada 2 semanas`;
  else if (rule === "monthly") t = `Todo mês, dia ${parseYmd(e._serie || e.starts_on).getDate()}`;
  else if (rule === "yearly") t = "Todo ano";
  if (e.repeat_until) { const [y, m, d] = e.repeat_until.slice(0, 10).split("-"); t += `, até ${d}/${m}/${y}`; }
  return t;
}
function rangeShort(a, b) {
  const da = parseYmd(a), db = parseYmd(b), yr = db.getFullYear() !== todayDate().getFullYear() ? " " + db.getFullYear() : "";
  if (da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth()) return `${da.getDate()} a ${db.getDate()} ${MES[db.getMonth()]}${yr}`;
  return `${da.getDate()} ${MES[da.getMonth()]} a ${db.getDate()} ${MES[db.getMonth()]}${yr}`;
}
function calHTML() {
  const y = UI.calY, mo = UI.calM, first = new Date(y, mo, 1), dow = first.getDay(), dim = new Date(y, mo + 1, 0).getDate();
  const todayS = ymd(todayDate());
  let cells = "";
  for (let i = 0; i < dow; i++) cells += `<div class="dcell out"></div>`;
  for (let d = 1; d <= dim; d++) {
    const ds = `${y}-${pad(mo + 1)}-${pad(d)}`, evs = evsOn(ds);
    const cores = [...new Set(evs.map(evColor))].slice(0, 3);
    cells += `<button class="dcell ${ds === todayS ? "today" : ""} ${ds === UI.selDay ? "sel" : ""}" data-day="${ds}" aria-pressed="${ds === UI.selDay}" aria-label="${d} de ${MESL[mo]}${evs.length ? `, ${plural(evs.length, "compromisso", "compromissos")}` : ""}"><span class="n">${d}</span><span class="ds">${cores.map(c => `<i style="--c:${c}"></i>`).join("")}</span></button>`;
  }
  const sel = parseYmd(UI.selDay);
  const dayEvs = evsOn(UI.selDay).map(e => occ(e, occCover(e, UI.selDay))).sort(sortEv);
  const later = upcoming(UI.selDay, 4);
  const evRow = (e, withDate) => {
    const multi = evEnd(e) > e.starts_on, d = parseYmd(e.starts_on), cal = calOf(e), tempo = evTime(e), auto = !!e.auto_key;
    let quando = "";
    if (withDate) quando = multi ? rangeShort(e.starts_on, e.ends_on) : `${SEM[d.getDay()]}, ${d.getDate()} ${MES[d.getMonth()]}${d.getFullYear() !== todayDate().getFullYear() ? " " + d.getFullYear() : ""}`;
    else if (multi) quando = `Dia ${dayDiff(parseYmd(UI.selDay), d) + 1} de ${dayDiff(parseYmd(e.ends_on), d) + 1} · ${rangeShort(e.starts_on, e.ends_on)}`;
    const sub = [quando, cal ? cal.name : "", e.repeat_rule ? repSummary(e) : "", auto ? "" : whoName(e.who_user)].filter(Boolean).map(esc).join(" · ");
    const tm = withDate ? tempo : (multi && UI.selDay !== e.starts_on ? "" : (tempo || "dia todo"));
    return `<div class="evt" style="--c:${evColor(e)}"><span class="bar"></span><button class="evbody" data-ev="${e.id}" aria-label="${auto ? "Data do perfil" : "Editar compromisso"}: ${esc(e.title)}"><b>${esc(e.title)}${e.repeat_rule ? `<span class="rep" role="img" aria-label="Repete">${ic("repeat", 13, 2.2)}</span>` : ""}</b><span>${sub}</span>${e.note ? `<span class="note-ev">${esc(e.note)}</span>` : ""}</button><div class="tm">${esc(tm)}</div>${auto ? "" : `<button class="del" data-delev="${e.id}" aria-label="Apagar compromisso: ${esc(e.title)}">${ic("trash", 18, 1.9)}</button>`}</div>`;
  };
  /* contagem regressiva: só dos compromissos marcados com essa opção, do mais perto ao mais longe */
  const card = S.events.filter(e => e.countdown && evVisible(e)).map(e => { const on = nextOccStart(e, todayS); return on ? occ(e, on) : null; }).filter(Boolean).sort(sortEv).map(next => {
    const n = dayDiff(parseYmd(next.starts_on), todayDate()), multi = evEnd(next) > next.starts_on;
    return `<div class="count-card"><div><div class="t">${esc(next.title)}</div><span>${esc(multi ? rangeShort(next.starts_on, next.ends_on) : fmtLong(next.starts_on))}${evTime(next) ? " · " + esc(evTime(next)) : ""}</span></div><div style="text-align:right"><b>${fmtN(n)}</b><span style="display:block">${n === 1 ? "dia" : "dias"}</span></div></div>`;
  }).join("");
  const leg = [];
  if (!HID.has("casal")) leg.push(["Do casal", CASAL_COR]);
  S.calendars.filter(c => !HID.has(c.id)).forEach(c => leg.push([c.name, c.color]));
  return `
  <div class="appbar"><span style="font-weight:700;font-size:15px">Agenda do casal</span>
    <span class="acts"><button data-act="calendarios" style="color:var(--red);font-weight:700;font-size:14.5px">Calendários</button><button data-act="hoje" style="color:var(--red);font-weight:700;font-size:14.5px">Hoje</button><button data-act="evento" aria-label="Novo compromisso" style="color:var(--red)">${ic("plus", 24, 2.2)}</button></span></div>
  <div class="cal-head"><h2>${cap1(MESL[mo])} <i>${y}</i></h2>
    <span class="arr"><button data-mon="-1" aria-label="Mês anterior">${ic("back", 18, 2.4)}</button><button data-mon="1" aria-label="Próximo mês">${ic("next", 18, 2.4)}</button></span></div>
  <div class="legend">${leg.length ? leg.map(([n, c]) => `<span><i style="--c:${c}"></i>${esc(n)}</span>`).join("") : `<span>Nenhum calendário visível. Toque em Calendários.</span>`}</div>
  <div class="wk" aria-hidden="true"><span>D</span><span>S</span><span>T</span><span>Q</span><span>Q</span><span>S</span><span>S</span></div>
  <div class="month">${cells}</div>
  <div class="daylist">
    <div class="dl-h">${SEM[sel.getDay()]}, ${sel.getDate()} de ${MESL[sel.getMonth()]}</div>
    ${dayEvs.length ? dayEvs.map(e => evRow(e, false)).join("") : `<div class="none">Nenhum compromisso. Dia livre para os dois. Toque no + para marcar algo.</div>`}
    ${later.length ? `<div class="dl-h">Depois</div>${later.map(e => evRow(e, true)).join("")}` : ""}
  </div>
  ${card}
  <div style="height:20px"></div>`;
}

/* ============ janela de baixo (sheet) ============ */
const sheetEl = $("sheet"), scrimEl = $("scrim");
let SH = null, SHSTACK = [];
function drawSheet() { if (!SH) return; sheetEl.innerHTML = `<div class="grab"></div>${SH.view(SH.model)}`; hydrate(); }
function openSheet(def, push) {
  if (push && SH) SHSTACK.push(SH); else if (!push) SHSTACK = [];
  def.model = def.model || {}; SH = def; drawSheet();
  sheetEl.classList.add("on"); scrimEl.classList.add("on"); sheetEl.scrollTop = 0;
  const f = sheetEl.querySelector("input:not([type=hidden]),textarea");
  if (f && def.focus !== false) setTimeout(() => f.focus({ preventScroll: true }), 380);
}
function closeSheet() { SH = null; SHSTACK = []; sheetEl.classList.remove("on"); scrimEl.classList.remove("on"); const sh = $("shell"); if (sh) { sh.scrollTop = 0; sh.scrollLeft = 0; } }
function sheetBack() { const p = SHSTACK.pop(); if (p) { SH = p; drawSheet(); } else closeSheet(); }
scrimEl.addEventListener("click", closeSheet);
document.addEventListener("keydown", e => { if (e.key === "Escape" && SH) closeSheet(); });
sheetEl.addEventListener("click", async e => {
  const t = e.target.closest("[data-s]"); if (!t || !SH) return;
  const h = SH.on && SH.on[t.dataset.s]; if (!h) return;
  e.preventDefault();
  await guard(t, () => h(t, e));
});
const sheetField = e => {
  const t = e.target; if (!SH || !t.dataset) return;
  if (t.dataset.m) SH.model[t.dataset.m] = t.value;
  else if (t.dataset.row != null && SH.model.rows && SH.model.rows[+t.dataset.row]) SH.model.rows[+t.dataset.row][t.dataset.f] = t.value;
};
sheetEl.addEventListener("input", sheetField);
sheetEl.addEventListener("change", sheetField);
sheetEl.addEventListener("submit", async e => {
  const f = e.target.closest("form"); if (!f || !SH) return;
  e.preventDefault();
  const h = SH.on && SH.on.submit; if (!h) return;
  await guard(f.querySelector("[type=submit]"), () => h(f));
});
async function guard(btn, fn) {
  if (btn && btn.disabled) return;
  if (btn) btn.disabled = true;
  try { await fn(); } catch (err) { toast(friendly(err)); }
  if (btn && btn.isConnected) btn.disabled = false;
}
const hint = txt => `<p class="msg err" role="alert">${esc(txt)}</p>`;
function askConfirm(title, text, label, fn) {
  openSheet({ focus: false, view: () => `<h3>${esc(title)}</h3><p class="hint">${esc(text)}</p><div class="btns"><button class="btn ghost" data-s="no">Cancelar</button><button class="btn warn" data-s="yes">${esc(label)}</button></div>`,
    on: { no: () => sheetBack(), yes: async () => { await fn(); } } }, !!SH);
}

/* ============ fotos: envio, redução, escolha ============ */
const VIDEO_EXT = { "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm" };
const IMG_OK = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/gif"];
function loadImg(file) {
  return new Promise((res, rej) => { const u = URL.createObjectURL(file), i = new Image(); i.onload = () => { URL.revokeObjectURL(u); res(i); }; i.onerror = () => { URL.revokeObjectURL(u); rej(new Error("decode")); }; i.src = u; });
}
async function resizeImage(file, max, quality) {
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); } catch (e) { bmp = await loadImg(file); }
  const w = bmp.width || bmp.naturalWidth, h = bmp.height || bmp.naturalHeight;
  if (!w || !h) throw new Error("decode");
  const sc = Math.min(1, max / Math.max(w, h)), cw = Math.round(w * sc), ch = Math.round(h * sc);
  const cv = document.createElement("canvas"); cv.width = cw; cv.height = ch;
  const ctx = cv.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cw, ch); ctx.drawImage(bmp, 0, 0, cw, ch);
  if (bmp.close) bmp.close();
  const blob = await new Promise(r => cv.toBlob(r, "image/jpeg", quality));
  if (!blob) throw new Error("decode");
  return blob;
}
const own = m => { const e = new Error(m); e.own = true; return e; };
function fileType(file) {
  let t = (file.type || "").toLowerCase();
  if (!t) { const x = (file.name.split(".").pop() || "").toLowerCase(); t = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", gif: "image/gif", mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime", webm: "video/webm" }[x] || ""; }
  return t;
}
/* sobe um arquivo (foto reduzida ou vídeo) e cria a linha em media; devolve a linha */
async function uploadOne(file, opts) {
  const type = fileType(file), isVideo = type.startsWith("video/");
  let blob = file, ctype = type, ext;
  if (isVideo) {
    if (!VIDEO_EXT[type]) throw own(`${file.name}: formato de vídeo não aceito. Use MP4, MOV ou WebM.`);
    if (file.size > 50 * 1024 * 1024) throw own(`${file.name}: o vídeo passa de 50 MB. Encurte ou reduza o vídeo e tente de novo.`);
    ext = VIDEO_EXT[type];
  } else if (type === "image/gif") {
    if (file.size > 50 * 1024 * 1024) throw own(`${file.name}: o arquivo passa de 50 MB.`);
    ext = "gif";
  } else if (IMG_OK.includes(type)) {
    try { blob = await resizeImage(file, 2000, 0.85); } catch (e) {
      throw own(type === "image/heic" ? `${file.name}: este navegador não abre fotos HEIC. Envie pelo iPhone ou converta para JPG.` : `${file.name}: não consegui abrir essa foto. Tente outra.`);
    }
    ctype = "image/jpeg"; ext = "jpg";
  } else throw own(`${file.name}: formato não aceito. Use foto (JPG, PNG, WebP) ou vídeo (MP4, MOV, WebM).`);
  const path = `${S.couple.id}/${crypto.randomUUID()}.${ext}`;
  const up = await sb.storage.from("media").upload(path, blob, { contentType: ctype, upsert: false });
  if (up.error) throw up.error;
  const row = {
    couple_id: S.couple.id, path, kind: isVideo ? "video" : "photo",
    taken_at: ymd(file.lastModified ? new Date(file.lastModified) : new Date()),
    in_feed: !!opts.in_feed, place: opts.place || null, caption: opts.caption || null, trip_id: opts.trip_id || null
  };
  const ins = await sb.from("media").insert(row).select().single();
  if (ins.error) { sb.storage.from("media").remove([path]).catch(() => { }); throw ins.error; }
  return ins.data;
}
const progEl = $("progress");
async function uploadFiles(files, opts = {}) {
  const list = [...files], n = list.length, out = [], fails = [];
  progEl.hidden = false;
  const draw = (i, extra = "") => { progEl.innerHTML = `<div>${extra || `Enviando ${Math.min(i + 1, n)} de ${n}…`}</div><div class="pb"><i style="width:${Math.round((i / n) * 100)}%"></i></div>`; };
  draw(0);
  for (let i = 0; i < n; i++) {
    draw(i);
    try { const row = await uploadOne(list[i], opts); S.media.unshift(row); out.push(row); }
    catch (e) { fails.push(isNet(e) ? "Sem conexão. Confira a internet e tente de novo." : (e && e.own ? e.message : `${list[i].name}: não subiu. Tente de novo.`)); if (isNet(e)) break; }
  }
  S.media.sort((a, b) => b.taken_at.localeCompare(a.taken_at) || String(b.created_at).localeCompare(String(a.created_at)));
  refreshViews();
  if (fails.length) {
    progEl.innerHTML = `<div>${out.length ? `${plural(out.length, "arquivo subiu", "arquivos subiram")}. ` : ""}${esc(fails.slice(0, 2).join(" "))}${fails.length > 2 ? ` E mais ${fails.length - 2}.` : ""}</div><button data-act="fecharprog">Entendi</button>`;
  } else { progEl.hidden = true; toast(out.length === 1 ? "Enviado." : `${out.length} arquivos enviados.`); }
  return out;
}
progEl.addEventListener("click", e => { if (e.target.closest("[data-act=fecharprog]")) progEl.hidden = true; });
function pickFiles(accept, multiple, cb) {
  const inp = $("filepick"); inp.accept = accept; inp.multiple = !!multiple; inp.value = "";
  inp.onchange = () => { const fs = [...inp.files]; inp.value = ""; if (fs.length) cb(fs); };
  inp.click();
}
const ACCEPT_ALL = "image/*,video/mp4,video/quicktime,video/webm,.heic,.mov";

/* janela de escolher fotos já enviadas */
function openPicker(o) {
  const m = { sel: new Set(), caption: "", place: "" };
  const pool = () => S.media.filter(x => (!o.onlyPhotos || x.kind === "photo") && !(o.exclude && o.exclude(x)));
  const def = {
    model: m, focus: false,
    view: () => {
      const items = pool();
      return `<h3>${esc(o.title)}</h3><p class="hint">${esc(o.hint || "")}</p>
      ${items.length ? `<div class="picker" role="group" aria-label="Fotos já enviadas">${items.map(x => `<button type="button" class="pick" data-s="tog" data-id="${x.id}" aria-pressed="${m.sel.has(x.id)}" aria-label="${x.kind === "video" ? "Vídeo" : "Foto"} de ${esc(fmtShort(x.taken_at))}">${x.kind === "video" ? `<video data-path="${esc(x.path)}" data-thumb="1" preload="metadata" muted playsinline></video>` : imgTag(x.path, "")}<span class="chk"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></span></button>`).join("")}</div>` : `<p class="none">${esc(o.emptyText || "Não há fotos para escolher aqui. Envie novas.")}</p>`}
      ${o.extra ? `<label class="field"><span>Legenda (opcional)</span><textarea data-m="caption" maxlength="1000" rows="2">${esc(m.caption)}</textarea></label><label class="field"><span>Lugar (opcional)</span><input data-m="place" maxlength="120" value="${esc(m.place)}" autocomplete="off"></label>` : ""}
      <button class="btn" data-s="ok" ${m.sel.size ? "" : "disabled"}>${esc(o.okLabel)}${m.sel.size && o.multi ? ` (${m.sel.size})` : ""}</button>
      <button class="btn ghost" data-s="up">Enviar ${o.onlyPhotos ? "foto nova" : "novas"} do celular</button>${o.push ? '<button class="btn ghost" data-s="back">Voltar</button>' : ""}`;
    },
    on: {
      tog: t => { const id = t.dataset.id; if (!o.multi) m.sel.clear(); if (m.sel.has(id)) m.sel.delete(id); else m.sel.add(id); drawSheet(); },
      ok: async () => { await o.onDone([...m.sel], m); },
      back: () => sheetBack(),
      up: () => pickFiles(o.onlyPhotos ? "image/*,.heic" : ACCEPT_ALL, o.multi, async files => { await o.onUpload(files, m); })
    }
  };
  openSheet(def, !!o.push);
}

/* ============ ações: perfil ============ */
function openProfile() {
  const c = S.couple, mm = me();
  const m = { push: "checking", about: c.about_mode, song_title: c.song_title || "", song_artist: c.song_artist || "", song_url: c.song_url || "", phrase: c.phrase || "", nome: mm.display_name || "", start: c.start_date || "", birthday: mm.birthday || "", met: c.met_on || "", kiss: c.first_kiss_on || "",
    stage: c.stage || "", engaged: c.engaged_on || "", married: c.married_on || "",
    rows: S.dates.map(d => ({ id: d.id, title: d.title, date: d.date, kind: d.kind })),
    orig: { birthday: mm.birthday || "", met: c.met_on || "", kiss: c.first_kiss_on || "", start: c.start_date || "", stage: c.stage || "", engaged: c.engaged_on || "", married: c.married_on || "" }, err: "" };
  m.origRows = JSON.parse(JSON.stringify(m.rows));
  const hojeP = ymd(todayDate());
  const dfield = (key, label, help) => `<label class="field"><span>${label}</span><input type="date" data-m="${key}" min="1900-01-01" max="${hojeP}" value="${esc(m[key])}">${help ? `<span class="help">${esc(help)}</span>` : ""}</label>`;
  const couplePart = () => {
    const st = m.stage;
    const dates = (st === "casamento" ? dfield("married", DLABEL.married) : "") + dfield("start", DLABEL.dating) + (st === "noivado" || st === "casamento" ? dfield("engaged", DLABEL.engaged) : "") + dfield("met", DLABEL.met) + dfield("kiss", DLABEL.kiss);
    const rows = `<div class="field"><span>Outras datas importantes</span>${m.rows.map((r, j) => `<div class="kid"><input data-row="${j}" data-f="title" maxlength="80" placeholder="${r.kind === "child" ? "Nome do filho" : "Ex.: Aniversário da Letícia"}" aria-label="Nome da data" autocomplete="off" value="${esc(r.title)}"><input type="date" data-row="${j}" data-f="date" min="1900-01-01" aria-label="Dia" value="${esc(r.date)}"><button type="button" class="link" data-s="rrem" data-i="${j}">Remover</button></div>`).join("")}${m.rows.length < 40 ? `<button type="button" class="btn ghost" data-s="radd" data-k="other">Adicionar data</button>` : ""}</div>`;
    return `<div class="field"><span>Vocês são</span><div class="chips" role="group" aria-label="Fase do casal">${STAGES.map(([v, t]) => `<button type="button" data-s="stage" data-v="${v}" aria-pressed="${st === v}">${t}</button>`).join("")}</div></div>${dates}${rows}`;
  };
  const def = {
    model: m, focus: false,
    view: () => `<h3>Editar perfil</h3><p class="hint">O que aparece embaixo dos nomes de vocês.</p>
      ${m.err ? hint(m.err) : ""}
      <div role="radiogroup" aria-label="Embaixo dos nomes">
        ${[["musica", "Música do casal", "O nome da música aparece no perfil"], ["frase", "Uma frase", "Um verso, uma promessa, uma piada interna"], ["branco", "Deixar em branco", "Só as fotos"]].map(([k, t, d]) => `<button type="button" class="opt" role="radio" data-s="about" data-v="${k}" aria-checked="${m.about === k}"><span class="radio"></span><span><b>${t}</b><span class="d">${d}</span></span></button>`).join("")}
      </div>
      <form id="pform" novalidate style="margin-top:8px">
      ${m.about === "musica" ? `<label class="field"><span>Título da música</span><input data-m="song_title" maxlength="120" value="${esc(m.song_title)}" autocomplete="off"></label><label class="field"><span>Artista</span><input data-m="song_artist" maxlength="120" value="${esc(m.song_artist)}" autocomplete="off"></label><label class="field"><span>Link do Spotify (opcional)</span><input type="url" inputmode="url" data-m="song_url" maxlength="500" value="${esc(m.song_url)}" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://open.spotify.com/..."><span class="help">No Spotify: Compartilhar → Copiar link</span></label>` : ""}
      ${m.about === "frase" ? `<label class="field"><span>A frase de vocês</span><textarea data-m="phrase" maxlength="200" rows="2">${esc(m.phrase)}</textarea></label>` : ""}
      <label class="field"><span>Seu nome</span><input data-m="nome" maxlength="60" value="${esc(m.nome)}" autocomplete="given-name"></label>
      <label class="field"><span>Seu aniversário</span><input type="date" data-m="birthday" min="1900-01-01" max="${ymd(todayDate())}" value="${esc(m.birthday)}"><span class="help">Só ${esc(partnerName())} vê esse lembrete, um dia antes.</span></label>
      ${couplePart()}
      <button class="cover-row" type="button" data-s="avatar"><span class="th" style="width:44px;height:44px;border-radius:50%;display:grid;place-items:center;font-family:var(--f-display);font-style:italic;font-size:22px;color:var(--red)">${mm.avatar_path ? imgTag(mm.avatar_path, "") : esc((mm.display_name || "?").charAt(0).toUpperCase())}</span><span><b style="display:block;font-size:15.5px">Sua foto</b><span style="font-size:13px;color:var(--ink-2)">${mm.avatar_path ? "Trocar a foto do seu perfil" : "Escolher uma foto sua"}</span></span></button>
      <button class="cover-row" type="button" data-s="capa"><span class="th ${c.cover_path ? "" : "none"}">${c.cover_path ? imgTag(c.cover_path, "") : ""}</span><span><b style="display:block;font-size:15.5px">Trocar foto de capa</b><span style="font-size:13px;color:var(--ink-2)">Escolher entre as fotos de vocês ou enviar uma nova</span></span></button>
      <div class="push-box"><b>Notificações dos compromissos</b><p class="d">${esc(PUSH_TXT[m.push] || "")}</p>${m.push === "on" ? '<button type="button" class="btn ghost" data-s="pushoff">Desativar neste aparelho</button>' : m.push === "off" ? '<button type="button" class="btn ghost" data-s="pushon">Ativar neste aparelho</button>' : ""}</div>
      <button class="btn" type="submit" style="margin-top:14px">Salvar</button>
      <button class="btn ghost signout" type="button" data-s="sair">Sair da conta</button>
      </form>`,
    on: {
      about: t => { m.about = t.dataset.v; drawSheet(); },
      stage: t => { m.stage = t.dataset.v; drawSheet(); },
      radd: t => { m.rows.push({ id: null, title: "", date: "", kind: t.dataset.k }); drawSheet(); },
      rrem: t => { m.rows.splice(+t.dataset.i, 1); drawSheet(); },
      submit: async () => {
        const nome = m.nome.trim();
        if (!nome) { m.err = "Escreva o seu nome."; drawSheet(); return; }
        const hoje = ymd(todayDate());
        if ([m.birthday, m.met, m.kiss, m.start, m.engaged, m.married].some(x => x && (x > hoje || x < "1900-01-01"))) { m.err = "Alguma data não vale. Confira o dia, o mês e o ano."; drawSheet(); return; }
        const rows = m.rows.map(r => ({ id: r.id, kind: r.kind, title: r.title.trim(), date: r.date })).filter(r => r.id || r.title || r.date);
        if (rows.some(r => !r.title || !r.date)) { m.err = "Preencha o nome e o dia de cada data, ou toque em Remover."; drawSheet(); return; }
        if (rows.some(r => r.date < "1900-01-01" || r.date > "2100-01-01")) { m.err = "Alguma data não vale. Confira o dia, o mês e o ano."; drawSheet(); return; }
        const songUrl = m.song_url.trim();
        if (songUrl && !SPOTIFY_RE.test(songUrl)) { m.err = "Esse link não é do Spotify. No Spotify, toque em Compartilhar → Copiar link e cole aqui."; drawSheet(); return; }
        const patch = { about_mode: m.about, song_title: m.song_title.trim() || null, song_artist: m.song_artist.trim() || null, song_url: songUrl || null, phrase: m.phrase.trim() || null };
        const [c2, m2] = await Promise.all([
          q(sb.from("couples").update(patch).eq("id", S.couple.id).select().single()),
          q(sb.from("couple_members").update({ display_name: nome }).eq("user_id", S.user.id).select().single())
        ]);
        S.couple = c2; Object.assign(me(), m2);
        /* só manda o que mudou em relação ao que o formulário mostrava ao abrir */
        const v = {};
        ["birthday", "met", "kiss"].forEach(k => { if (m[k] !== m.orig[k]) v[k] = m[k] || null; });
        if (v.birthday !== undefined) await saveDates({ birthday: v.birthday }, true);
        /* fase e datas do casal: só o que mudou; trocar de fase não apaga datas já salvas */
        const cv = {};
        ["stage", "start", "engaged", "married", "met", "kiss"].forEach(k => { if (m[k] !== m.orig[k]) cv[k] = m[k] || null; });
        if (Object.keys(cv).length) await saveCouple(cv);
        /* outras datas importantes: apagar, editar e criar (o banco acerta os compromissos) */
        const was = m.origRows, gone = was.filter(w => !rows.some(r => r.id === w.id)).map(w => w.id);
        const changed = rows.filter(r => r.id && (w => w && (w.title !== r.title || w.date !== r.date))(was.find(x => x.id === r.id)));
        const added = rows.filter(r => !r.id);
        if (gone.length) await q(sb.from("couple_dates").delete().in("id", gone));
        for (const r of changed) await q(sb.from("couple_dates").update({ title: r.title, date: r.date }).eq("id", r.id));
        if (added.length) await q(sb.from("couple_dates").insert(added.map(r => ({ couple_id: S.couple.id, title: r.title, date: r.date, kind: r.kind }))));
        await refreshCore();
        closeSheet(); render(true); toast("Perfil salvo.");
      },
      avatar: () => pickFiles("image/*,.heic", false, async files => {
        try {
          const old = me().avatar_path;
          progEl.hidden = false; progEl.innerHTML = "<div>Enviando sua foto…</div>";
          const blob = await resizeImage(files[0], 600, 0.85);
          const path = `${S.couple.id}/avatar-${S.user.id.slice(0, 8)}-${crypto.randomUUID()}.jpg`;
          const up = await sb.storage.from("media").upload(path, blob, { contentType: "image/jpeg", upsert: false });
          if (up.error) throw up.error;
          const r = await sb.from("couple_members").update({ avatar_path: path }).eq("user_id", S.user.id).select().single();
          if (r.error) { sb.storage.from("media").remove([path]).catch(() => { }); throw r.error; }
          me().avatar_path = path;
          if (old && /\/avatar-/.test(old)) sb.storage.from("media").remove([old]).catch(() => { });
          progEl.hidden = true; toast("Foto atualizada."); drawSheet(); render(true);
        } catch (e) { progEl.hidden = true; toast(isNet(e) ? friendly(e) : "Não consegui usar essa foto. Tente outra."); }
      }),
      capa: () => openCoverPicker(true),
      pushon: async () => { try { await enablePush(); m.push = "on"; drawSheet(); toast("Notificações ativadas neste aparelho."); } catch (e) { toast(pushMsg(e)); m.push = await pushStatus(); drawSheet(); } },
      pushoff: async () => { try { await disablePush(); m.push = "off"; drawSheet(); toast("Notificações desativadas neste aparelho."); } catch (e) { toast(pushMsg(e)); } },
      sair: () => { closeSheet(); signOut(); }
    }
  };
  openSheet(def);
  pushStatus().then(st => { m.push = st; if (SH === def) drawSheet(); }).catch(() => { m.push = "unsupported"; if (SH === def) drawSheet(); });
}
async function setCover(path) {
  const r = await q(sb.from("couples").update({ cover_path: path }).eq("id", S.couple.id).select().single());
  S.couple = r; render(true);
}
function openCoverPicker(push) {
  openPicker({
    title: "Foto de capa", hint: "Escolha uma das fotos de vocês ou envie uma nova.", onlyPhotos: true, multi: false, okLabel: "Usar como capa", push,
    emptyText: "Ainda não há fotos. Envie a primeira para usar como capa.",
    onDone: async ids => { const mm = S.media.find(x => x.id === ids[0]); if (!mm) return; await setCover(mm.path); closeSheet(); toast("Capa atualizada."); },
    onUpload: async files => { const rows = await uploadFiles([files[0]]); if (rows[0]) { await setCover(rows[0].path); closeSheet(); toast("Capa atualizada."); } }
  });
}

/* ============ ações: posts ============ */
function openNewPost() {
  openPicker({
    title: "Novo post", hint: "Escolha as fotos e vídeos que vão para o feed. Cada um vira um post.", multi: true, extra: true, okLabel: "Pôr no feed",
    exclude: x => x.in_feed, emptyText: "Todas as fotos já estão no feed. Envie novas para postar.",
    onDone: async (ids, m) => {
      const patch = { in_feed: true }; if (m.caption.trim()) patch.caption = m.caption.trim(); if (m.place.trim()) patch.place = m.place.trim();
      const rows = await q(sb.from("media").update(patch).in("id", ids).select());
      rows.forEach(r => { const i = S.media.findIndex(x => x.id === r.id); if (i >= 0) S.media[i] = r; });
      closeSheet(); refreshViews(); toast(rows.length === 1 ? "Post publicado no feed." : `${rows.length} posts no feed.`);
    },
    onUpload: async (files, m) => {
      closeSheet();
      const rows = await uploadFiles(files, { in_feed: true, caption: m.caption.trim(), place: m.place.trim() });
      if (rows.length) toast(rows.length === 1 ? "Post publicado no feed." : `${rows.length} posts no feed.`);
    }
  });
}
function openEditMedia() {
  const x = S.media.find(v => v.id === UI.viewer); if (!x) return;
  const m = { caption: x.caption || "", place: x.place || "", trip: x.trip_id || "", date: x.taken_at };
  openSheet({
    model: m, focus: false,
    view: () => `<h3>Detalhes</h3>
      <form novalidate>
      <label class="field"><span>Legenda</span><textarea data-m="caption" maxlength="1000" rows="3">${esc(m.caption)}</textarea></label>
      <label class="field"><span>Lugar</span><input data-m="place" maxlength="120" value="${esc(m.place)}" autocomplete="off"></label>
      <label class="field"><span>Viagem</span><select data-m="trip"><option value="">Nenhuma</option>${S.trips.map(t => `<option value="${t.id}" ${t.id === m.trip ? "selected" : ""}>${esc(t.name)}</option>`).join("")}</select></label>
      <label class="field"><span>Data</span><input type="date" data-m="date" value="${esc(m.date)}" max="${ymd(todayDate())}"></label>
      <button class="btn" type="submit">Salvar</button></form>`,
    on: {
      submit: async () => {
        const patch = { caption: m.caption.trim() || null, place: m.place.trim() || null, trip_id: m.trip || null };
        if (m.date) patch.taken_at = m.date;
        const r = await q(sb.from("media").update(patch).eq("id", x.id).select().single());
        const i = S.media.findIndex(v => v.id === x.id); if (i >= 0) S.media[i] = r;
        closeSheet(); refreshViews(); toast("Detalhes salvos.");
      }
    }
  });
}
function deleteMedia() {
  const x = findMedia(UI.viewer); if (!x) return;
  askConfirm(x.kind === "video" ? "Apagar este vídeo?" : "Apagar esta foto?", "Ela some para os dois e não dá para desfazer.", "Apagar", async () => {
    await q(sb.from("media").delete().eq("id", x.id));
    sb.storage.from("media").remove([x.path, x.thumb_path].filter(Boolean)).catch(() => { });
    if (S.couple.cover_path === x.path) { S.couple = await q(sb.from("couples").update({ cover_path: null }).eq("id", S.couple.id).select().single()); }
    S.media = S.media.filter(v => v.id !== x.id); S.passeio = S.passeio.filter(v => v.id !== x.id);
    closeSheet(); closeViewer(); refreshViews(); toast("Apagado.");
  });
}

/* ============ fotos do passeio ============
   Quem tirou manda em alta qualidade (até 3000 px), o outro salva tudo no celular, os dois escolhem as
   preferidas (vão para o feed) e o resto some 30 dias depois do envio (o banco e a limpeza diária cuidam disso). */
const PARALELO = 3, LOTE_SALVAR = 20, MAX_FULL = 3000, Q_FULL = 0.85, MAX_THUMB = 640, Q_THUMB = 0.8, PASSEIO_DIAS = 30;
const findMedia = id => S.media.find(x => x.id === id) || S.passeio.find(x => x.id === id) || null;
const cmpShot = (a, b) => String(a.shot_at || a.created_at).localeCompare(String(b.shot_at || b.created_at)) || a.id.localeCompare(b.id);
/* põe a linha no lugar certo: com prazo = passeio; sem prazo (foi para o feed ou é antiga) = fotos de sempre */
function placeRow(r) {
  S.media = S.media.filter(x => x.id !== r.id); S.passeio = S.passeio.filter(x => x.id !== r.id);
  (r.expires_at ? S.passeio : S.media).push(r);
  S.media.sort((a, b) => b.taken_at.localeCompare(a.taken_at) || String(b.created_at).localeCompare(String(a.created_at)));
}
const diasRestantes = m => Math.max(0, Math.ceil((new Date(m.expires_at) - Date.now()) / 864e5));
const quando = d => d <= 0 ? "hoje" : d === 1 ? "amanhã" : `em ${d} dias`;
function dayLabel(day) {
  const d = parseYmd(day), y = d.getFullYear() !== t0.getFullYear() ? " " + d.getFullYear() : "";
  return `${cap1(SEM[d.getDay()])}, ${d.getDate()} ${MES[d.getMonth()]}${y}`;
}
const dayTitle = day => { const x = S.dayTitles.find(t => t.day === day); return x ? x.title : ""; };
function passeioDias() {
  const g = groupBy(S.passeio, m => m.taken_at);
  return [...g.keys()].sort().reverse().map(day => ({ day, list: g.get(day).sort(cmpShot) }));
}
const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const canShareFiles = () => { try { return !!(navigator.canShare && navigator.share && navigator.canShare({ files: [new File([""], "a.jpg", { type: "image/jpeg" })] })); } catch (e) { return false; } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const isNetErr = e => isNet(e) || navigator.onLine === false;

/* ---- EXIF: lê a data em que a foto foi tirada (DateTimeOriginal) e grava de volta na foto reduzida ---- */
function exifDateFromString(s) {
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(s || "");
  if (!m || +m[1] < 1990 || +m[2] < 1 || +m[2] > 12 || +m[3] < 1 || +m[3] > 31) return null;
  return { date: `${m[1]}-${m[2]}-${m[3]}`, time: `${m[4]}:${m[5]}:${m[6]}` };
}
function tiffDate(v, t) {
  const le = v.getUint16(t) === 0x4949, u16 = p => v.getUint16(p, le), u32 = p => v.getUint32(p, le);
  if (u16(t + 2) !== 42) return null;
  const entries = off => {
    const out = {}, n = u16(t + off);
    for (let i = 0; i < n && i < 200; i++) { const e = t + off + 2 + i * 12; out[u16(e)] = { type: u16(e + 2), count: u32(e + 4), at: e + 8 }; }
    return out;
  };
  const str = e => {
    if (!e || e.type !== 2 || e.count < 19 || e.count > 64) return null;
    const p = t + u32(e.at); let s = "";
    for (let i = 0; i < e.count - 1; i++) s += String.fromCharCode(v.getUint8(p + i));
    return s;
  };
  const i0 = entries(u32(t + 4));
  let r = null;
  if (i0[0x8769]) { const ex = entries(u32(i0[0x8769].at)); r = exifDateFromString(str(ex[0x9003])) || exifDateFromString(str(ex[0x9004])); }
  return r || exifDateFromString(str(i0[0x0132]));
}
async function readExifDate(file) {
  try {
    const v = new DataView(await file.slice(0, 262144).arrayBuffer());
    if (v.getUint16(0) !== 0xFFD8) return null;
    let o = 2;
    while (o + 4 < v.byteLength) {
      if (v.getUint8(o) !== 0xFF) break;
      const mk = v.getUint8(o + 1), len = v.getUint16(o + 2);
      if (mk === 0xE1 && v.getUint32(o + 4) === 0x45786966 && v.getUint16(o + 8) === 0) return tiffDate(v, o + 10);
      if (mk === 0xDA) break;
      o += 2 + len;
    }
  } catch (e) { /* sem EXIF legível: usa a data do arquivo */ }
  return null;
}
const dateTimeOfMs = ms => { const d = new Date(ms || Date.now()); return { date: ymd(d), time: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` }; };
/* a foto reduzida pelo canvas perde o EXIF; sem isso o iPhone guardaria tudo com a data de hoje. Gravamos só a data/hora original. */
async function injectExif(blob, dt) {
  const ab = new Uint8Array(await blob.arrayBuffer());
  if (ab[0] !== 0xFF || ab[1] !== 0xD8) return blob;
  const s = `${dt.date.replace(/-/g, ":")} ${dt.time}\0`, seg = new Uint8Array(86), v = new DataView(seg.buffer);
  seg[0] = 0xFF; seg[1] = 0xE1; v.setUint16(2, 84);
  [0x45, 0x78, 0x69, 0x66, 0, 0].forEach((b, i) => { seg[4 + i] = b; });
  const t = 10;                                    /* início do TIFF dentro do segmento */
  [0x4D, 0x4D, 0, 0x2A].forEach((b, i) => { seg[t + i] = b; }); v.setUint32(t + 4, 8);
  v.setUint16(t + 8, 1); v.setUint16(t + 10, 0x8769); v.setUint16(t + 12, 4); v.setUint32(t + 14, 1); v.setUint32(t + 18, 26); v.setUint32(t + 22, 0);
  v.setUint16(t + 26, 2);
  v.setUint16(t + 28, 0x9003); v.setUint16(t + 30, 2); v.setUint32(t + 32, 20); v.setUint32(t + 36, 56);
  v.setUint16(t + 40, 0x9004); v.setUint16(t + 42, 2); v.setUint32(t + 44, 20); v.setUint32(t + 48, 56);
  v.setUint32(t + 52, 0);
  for (let i = 0; i < 20; i++) seg[t + 56 + i] = s.charCodeAt(i) || 0;
  const out = new Uint8Array(ab.length + seg.length);
  out.set(ab.subarray(0, 2), 0); out.set(seg, 2); out.set(ab.subarray(2), 2 + seg.length);
  return new Blob([out], { type: "image/jpeg" });
}

/* ---- preparar uma foto: lê a data, reduz a 3000 px, faz a miniatura ---- */
let prepChain = Promise.resolve();
const emFila = fn => { const r = prepChain.then(fn); prepChain = r.catch(() => { }); return r; };   /* uma por vez: o iPhone não aguenta várias fotos grandes abertas juntas */
const toBlob = (cv, q) => new Promise(r => cv.toBlob(r, "image/jpeg", q));
async function prepararFoto(file) {
  const exif = await readExifDate(file);
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); } catch (e) { bmp = await loadImg(file); }
  const w = bmp.width || bmp.naturalWidth, h = bmp.height || bmp.naturalHeight;
  if (!w || !h) throw new Error("decode");
  const sc = Math.min(1, MAX_FULL / Math.max(w, h)), cw = Math.round(w * sc), ch = Math.round(h * sc);
  const cv = document.createElement("canvas"); cv.width = cw; cv.height = ch;
  const ctx = cv.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cw, ch); ctx.imageSmoothingQuality = "high"; ctx.drawImage(bmp, 0, 0, cw, ch);
  if (bmp.close) bmp.close();
  const rawFull = await toBlob(cv, Q_FULL);
  const ts = Math.min(1, MAX_THUMB / Math.max(cw, ch)), tw = Math.max(1, Math.round(cw * ts)), th = Math.max(1, Math.round(ch * ts));
  const tc = document.createElement("canvas"); tc.width = tw; tc.height = th;
  const tx = tc.getContext("2d"); tx.imageSmoothingQuality = "high"; tx.drawImage(cv, 0, 0, tw, th);
  const thumb = await toBlob(tc, Q_THUMB);
  cv.width = cv.height = 0; tc.width = tc.height = 0;      /* devolve a memória já */
  if (!rawFull || !thumb) throw new Error("decode");
  const dt = exif || dateTimeOfMs(file.lastModified);
  return { full: await injectExif(rawFull, dt), thumb, day: dt.date, shot: `${dt.date}T${dt.time}` };
}

/* ---- enviar ---- */
let ENVIO = null;
async function pegarWake() {
  const E = ENVIO; if (!E || E.wake || !("wakeLock" in navigator)) return;
  try { E.wake = await navigator.wakeLock.request("screen"); E.wake.addEventListener("release", () => { E.wake = null; }); } catch (e) { }
}
function soltarWake() { const E = ENVIO; if (E && E.wake) { try { E.wake.release(); } catch (e) { } E.wake = null; } }
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && ENVIO && ENVIO.ativo) pegarWake(); });
window.addEventListener("beforeunload", e => { if (ENVIO && ENVIO.ativo) { e.preventDefault(); e.returnValue = ""; } });

async function comRetry(fn) {
  for (let t = 0; ; t++) {
    try { return await fn(); }
    catch (e) { if (!isNetErr(e) || t >= 2) throw e; await sleep(1000 * 2 ** t); }
  }
}
async function enviarUma(it) {
  if (!it.prep) it.prep = await emFila(() => prepararFoto(it.file));
  const p = it.prep, base = `${S.couple.id}/${it.id}`;
  const path = `${base}.jpg`, thumb_path = `${base}_t.jpg`;
  return comRetry(async () => {
    const a = await sb.storage.from("media").upload(path, p.full, { contentType: "image/jpeg", upsert: true }); if (a.error) throw a.error;
    const b = await sb.storage.from("media").upload(thumb_path, p.thumb, { contentType: "image/jpeg", upsert: true }); if (b.error) throw b.error;
    const row = {
      id: it.id, couple_id: S.couple.id, path, thumb_path, kind: "photo", taken_at: p.day, shot_at: p.shot, in_feed: false,
      expires_at: new Date(Date.now() + PASSEIO_DIAS * 864e5).toISOString()   /* o banco refaz esta conta; é só o sinal de "passeio" */
    };
    const ins = await sb.from("media").insert(row).select().single();
    if (ins.error) {
      if (ins.error.code === "23505") { const got = await sb.from("media").select("*").eq("id", it.id).single(); if (got.data) return got.data; }
      throw ins.error;
    }
    return ins.data;
  });
}
function desenharEnvio() {
  const E = ENVIO; if (!E) return;
  const feitas = E.itens.filter(i => i.state === "ok" || i.state === "falha" || i.state === "parada").length, n = E.itens.length;
  progEl.hidden = false;
  if (E.pausado) {
    progEl.innerHTML = `<div>Sem conexão. ${feitas} de ${n} enviadas.</div><div class="pb"><i style="width:${Math.round(feitas / n * 100)}%"></i></div><div class="prow"><button data-act="penv-cont">Continuar</button><button data-act="penv-parar">Parar por aqui</button></div>`;
  } else {
    progEl.innerHTML = `<div>Enviando ${Math.min(feitas + 1, n)} de ${n}</div><div class="pb"><i style="width:${Math.round(feitas / n * 100)}%"></i></div>`;
  }
}
async function rodarEnvio() {
  const E = ENVIO; if (!E) return;
  E.pausado = false; E.ativo = true; pegarWake(); desenharEnvio();
  const worker = async () => {
    while (!E.pausado) {
      const it = E.itens.find(i => i.state === "espera"); if (!it) return;
      it.state = "indo";
      try { const row = await enviarUma(it); it.state = "ok"; it.prep = null; E.linhas.push(row); placeRow(row); }
      catch (e) {
        if (isNetErr(e)) { it.state = "espera"; E.pausado = true; }
        else { it.state = "falha"; it.prep = null; it.err = e && e.message === "decode" ? `${it.file.name}: não consegui abrir essa foto.` : `${it.file.name}: não subiu.`; }
      }
      desenharEnvio();
    }
  };
  await Promise.all(Array.from({ length: PARALELO }, worker));
  if (E.pausado) { E.ativo = false; soltarWake(); desenharEnvio(); return; }
  await terminarEnvio();
}
async function terminarEnvio() {
  const E = ENVIO; if (!E) return;
  E.ativo = false; soltarWake(); ENVIO = null;
  const ok = E.linhas, falhas = E.itens.filter(i => i.state === "falha");
  refreshViews();
  if (ok.length && partner()) { try { await sb.functions.invoke("avisar-fotos", { body: { count: ok.length, days: [...new Set(ok.map(r => r.taken_at))] } }); } catch (e) { } }
  if (falhas.length) {
    progEl.hidden = false;
    progEl.innerHTML = `<div>${ok.length ? `${plural(ok.length, "foto subiu", "fotos subiram")}. ` : ""}${esc(falhas.slice(0, 2).map(f => f.err).join(" "))}${falhas.length > 2 ? ` E mais ${falhas.length - 2}.` : ""}</div><button data-act="fecharprog">Entendi</button>`;
  } else {
    progEl.hidden = true;
    if (ok.length) toast(partner() ? `${plural(ok.length, "foto enviada", "fotos enviadas")}. ${partnerName()} recebe o aviso.` : `${plural(ok.length, "foto enviada", "fotos enviadas")}.`);
  }
}
function iniciarEnvio(files) {
  if (ENVIO && ENVIO.ativo) { toast("Já tem um envio em andamento."); return; }
  const itens = files.map(f => ({ file: f, id: crypto.randomUUID(), state: "espera", prep: null, err: "" }));
  ENVIO = { itens, linhas: [], pausado: false, ativo: false, wake: null };
  rodarEnvio();
}
function pedirEnvioPasseio() {
  pickFiles("image/*,.heic", true, files => {
    const fotos = files.filter(f => { const t = fileType(f); return t.startsWith("image/") && t !== "image/gif"; });
    const fora = files.length - fotos.length;
    if (!fotos.length) { toast("Aqui só entram fotos. Vídeo vai pelo botão Subir."); return; }
    const p = partner();
    openSheet({
      focus: false,
      view: () => `<h3>${fotos.length === 1 ? "Mandar 1 foto" : `Mandar ${fotos.length} fotos`}</h3>
        <p class="hint">As fotos vão em alta qualidade e somem ${PASSEIO_DIAS} dias depois do envio, menos as que forem para o feed.${p ? ` ${esc(p.display_name || "Seu par")} recebe um aviso quando terminar.` : ""}</p>
        ${fora ? `<p class="hint">${plural(fora, "arquivo ficou de fora", "arquivos ficaram de fora")} (não é foto).</p>` : ""}
        <p class="hint">Deixe o Us aberto até acabar.</p>
        <button class="btn" data-s="go">Enviar</button><button class="btn ghost" data-s="no">Cancelar</button>`,
      on: { go: () => { closeSheet(); iniciarEnvio(fotos); }, no: () => closeSheet() }
    });
  });
}
progEl.addEventListener("click", e => {
  const t = e.target.closest("[data-act]"); if (!t || !ENVIO) return;
  if (t.dataset.act === "penv-cont") { if (navigator.onLine === false) { toast("Ainda sem conexão."); return; } rodarEnvio(); }
  if (t.dataset.act === "penv-parar") { ENVIO.itens.forEach(i => { if (i.state === "espera") i.state = "parada"; }); terminarEnvio(); }
});

/* ---- salvar no celular ---- */
async function urlAssinada(path) {
  if (fresh(path)) return urlCache.get(path).url;
  const { data, error } = await sb.storage.from("media").createSignedUrl(path, 3600);
  if (error) throw error;
  urlCache.set(path, { url: data.signedUrl, exp: Date.now() + 55 * 60e3 });
  return data.signedUrl;
}
async function baixarFoto(m, n) {
  const r = await fetch(await urlAssinada(m.path)); if (!r.ok) throw new Error("download");
  return new File([await r.blob()], `Us-${m.taken_at}-${String(n).padStart(3, "0")}.jpg`, { type: "image/jpeg", lastModified: m.shot_at ? new Date(m.shot_at).getTime() : Date.now() });
}
function salvarFotos(rows) {
  rows = [...rows].sort((a, b) => a.taken_at.localeCompare(b.taken_at) || cmpShot(a, b));
  if (!rows.length) return;
  if (isIos() && canShareFiles()) return salvarNoCelular(rows);
  return baixarNoComputador(rows);
}
/* iPhone: a janela de compartilhar só abre com um toque, então o lote é preparado antes e o toque só entrega */
function salvarNoCelular(rows) {
  const lotes = []; for (let i = 0; i < rows.length; i += LOTE_SALVAR) lotes.push(rows.slice(i, i + LOTE_SALVAR));
  const m = { i: 0, estado: "prep", files: [], aviso: "" };
  const def = {
    model: m, focus: false,
    view: () => {
      const nlote = lotes.length, tot = rows.length;
      const cab = `<h3>${tot === 1 ? "Salvar 1 foto" : `Salvar ${tot} fotos`}</h3>`;
      if (m.estado === "fim") return `${cab}<p class="hint">Pronto. ${tot === 1 ? "A foto está" : `As ${tot} fotos estão`} no app Fotos do seu iPhone.</p><button class="btn" data-s="fim">Fechar</button>`;
      const lote = nlote > 1 ? `lote ${m.i + 1} de ${nlote}` : "";
      const intro = nlote > 1 ? `<p class="hint">Para não travar o iPhone, vão ${nlote} lotes de até ${LOTE_SALVAR} fotos. Em cada um, toque em Salvar imagens.</p>` : `<p class="hint">Na janela que abrir, toque em Salvar imagens.</p>`;
      if (m.estado === "prep") return `${cab}${intro}<p class="hint"><b>Preparando ${lote || "as fotos"}…</b></p><button class="btn" disabled>Preparando…</button>`;
      if (m.estado === "erro") return `${cab}<p class="msg err" role="alert">Não consegui baixar ${lote ? "este lote" : "a foto"}. Confira a internet e tente de novo.</p><button class="btn" data-s="tentar">Tentar de novo</button>`;
      return `${cab}${intro}${m.aviso ? `<p class="hint">${esc(m.aviso)}</p>` : ""}<button class="btn" data-s="salvar">Salvar ${lote ? `${lote} (${plural(m.files.length, "foto", "fotos")})` : "foto"}</button><button class="btn ghost" data-s="fim">Fechar</button>`;
    },
    on: {
      salvar: async () => {
        m.aviso = "";
        try { await navigator.share({ files: m.files, title: "Fotos do passeio" }); }
        catch (e) {
          if (e && (e.name === "AbortError" || e.name === "NotAllowedError")) { m.aviso = "A janela foi fechada. Toque de novo para salvar este lote."; if (SH === def) drawSheet(); return; }
          m.estado = "erro"; if (SH === def) drawSheet(); return;
        }
        m.i++; m.files = [];
        if (m.i >= lotes.length) { m.estado = "fim"; drawSheet(); return; }
        preparar();
      },
      tentar: () => preparar(),
      fim: () => closeSheet()
    }
  };
  async function preparar() {
    m.estado = "prep"; if (SH === def) drawSheet();
    try {
      const out = [], lote = lotes[m.i];
      for (let k = 0; k < lote.length; k += 4) {
        out.push(...await Promise.all(lote.slice(k, k + 4).map((r, j) => baixarFoto(r, m.i * LOTE_SALVAR + k + j + 1))));
        if (SH !== def) return;
      }
      m.files = out; m.estado = "pronto";
    } catch (e) { console.warn("lote", e); m.estado = "erro"; }
    if (SH === def) drawSheet();
  }
  openSheet(def);
  preparar();
}
/* computador: baixa os arquivos um por um */
async function baixarNoComputador(rows) {
  progEl.hidden = false;
  try {
    for (let i = 0; i < rows.length; i++) {
      progEl.innerHTML = `<div>Baixando ${i + 1} de ${rows.length}</div><div class="pb"><i style="width:${Math.round(i / rows.length * 100)}%"></i></div>`;
      const f = await baixarFoto(rows[i], i + 1), u = URL.createObjectURL(f), a = document.createElement("a");
      a.href = u; a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(u), 20000); await sleep(350);
    }
    progEl.hidden = true; toast(rows.length === 1 ? "Foto baixada." : `${rows.length} fotos baixadas. Veja a pasta Downloads.`);
  } catch (e) { progEl.innerHTML = `<div>Não consegui baixar tudo. Confira a internet e tente de novo.</div><button data-act="fecharprog">Entendi</button>`; }
}

/* ---- telas ---- */
function passeioCardHTML() {
  const n = S.passeio.length;
  if (!n) return `<button class="pcard" data-act="passeio"><span class="pc-body"><span class="pc-t">Fotos do passeio</span><span class="pc-d">Quem tirou manda em alta qualidade. Quem não tirou salva tudo no celular de uma vez.</span></span><span class="pc-go">${ic("next", 18, 2.2)}</span></button>`;
  const soon = Math.min(...S.passeio.map(diasRestantes));
  const th = [...S.passeio].sort((a, b) => cmpShot(b, a)).slice(0, 3).map(m => `<span>${imgTag(m.thumb_path || m.path, "", 'loading="lazy" decoding="async"')}</span>`).join("");
  return `<button class="pcard filled" data-act="passeio"><span class="pc-th">${th}</span><span class="pc-body"><span class="pc-t">Fotos do passeio</span><span class="pc-d">${plural(n, "foto", "fotos")} · a mais antiga some ${quando(soon)}</span></span><span class="pc-go">${ic("next", 18, 2.2)}</span></button>`;
}
function renderPasseio() {
  const sel = UI.sel, dias = passeioDias(), total = S.passeio.length, y = panel.scrollTop;
  const chk = '<span class="chk"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></span>';
  const grupos = dias.map(({ day, list }) => {
    const nome = dayTitle(day), quem = new Set(list.map(m => m.created_by));
    const quemTxt = quem.size > 1 ? "Os dois enviaram" : quem.has(null) || quem.has(undefined) ? "" : `${esc(nameOf([...quem][0]))} enviou`;
    const dmin = Math.min(...list.map(diasRestantes));
    const meta = [nome ? esc(dayLabel(day)) : "", plural(list.length, "foto", "fotos"), quemTxt, `some ${quando(dmin)}`].filter(Boolean).join(" · ");
    const marcadas = sel ? list.filter(m => sel.has(m.id)).length : 0;
    const acao = sel ? `<button class="link-sm" data-pday="${day}">${marcadas === list.length ? "Desmarcar o dia" : "Marcar o dia"}</button>` : `<button class="link-sm" data-pday="${day}">Salvar o dia</button>`;
    const cab = nome
      ? `<button class="pday-t" data-dayname="${day}" aria-label="Mudar o nome do dia">${esc(nome)}${ic("edit", 14, 2)}</button>`
      : `<h3>${esc(dayLabel(day))}</h3>`;
    return `<section class="pday"><div class="pday-h"><div style="min-width:0">${cab}<div class="pday-m">${meta}</div>${nome ? "" : `<button class="link-sm" data-dayname="${day}" style="margin-top:2px">Dar um nome ao dia</button>`}</div>${acao}</div>
      <div class="pgrid">${list.map(m => `<button class="tile ptile" data-pm="${m.id}" ${sel ? `aria-pressed="${sel.has(m.id)}"` : ""} aria-label="Foto de ${esc(dayLabel(day))}">${imgTag(m.thumb_path || m.path, "", 'loading="lazy" decoding="async"')}${sel ? chk : ""}</button>`).join("")}</div></section>`;
  }).join("");
  const vazio = `<div class="empty-state"><h3>Nenhuma foto de passeio</h3><p>Quem tirou as fotos manda aqui. A outra pessoa recebe um aviso e salva tudo no celular de uma vez.</p><button class="btn small" data-act="p-enviar">Mandar fotos</button></div>`;
  const barra = total ? (sel
    ? `<div class="bar-actions"><button class="pbtn" data-act="p-todas">Marcar todas</button><button class="pbtn" data-act="p-cancelar">Cancelar</button></div><p class="sub-title" style="margin-top:8px">Toque nas fotos de que mais gostaram.</p>`
    : `<div class="bar-actions"><button class="pbtn red" data-act="p-salvar-todas">Salvar todas no celular</button><button class="pbtn" data-act="p-escolher">Escolher preferidas</button></div>`) : "";
  const n = sel ? sel.size : 0;
  const selbar = sel ? `<div class="selbar"><span>${n ? plural(n, "escolhida", "escolhidas") : "Nenhuma escolhida"}</span><button class="pbtn red" data-act="p-feed" ${n ? "" : "disabled"}>Pôr no feed</button><button class="pbtn" data-act="p-salvar-sel" ${n ? "" : "disabled"}>Salvar</button><button class="pbtn dng" data-act="p-apagar" ${n ? "" : "disabled"}>Apagar</button></div>` : "";
  panel.innerHTML = `<div class="appbar"><button class="back" data-act="fecharpanel" aria-label="Voltar">${ic("back", 22)}Fotos</button><span class="acts"><button data-act="p-enviar" aria-label="Mandar fotos do passeio" style="display:flex;gap:6px;align-items:center;color:var(--red);font-weight:700;font-size:14.5px">${ic("upload", 20, 2.2)}Mandar</button></span></div>
    <h1 class="big-title">Fotos do passeio</h1>
    <p class="sub-title">${total ? `${plural(total, "foto", "fotos")}. ` : ""}Somem ${PASSEIO_DIAS} dias depois do envio. As que vão para o feed ficam para sempre.</p>
    ${barra}${total ? grupos : vazio}<div style="height:${sel ? 96 : 30}px"></div>${selbar}`;
  panel.scrollTop = y; $("main").scrollLeft = 0;
  hydrate();
}
function openDayName(day) {
  const m = { name: dayTitle(day) };
  openSheet({
    model: m,
    view: () => `<h3>${esc(dayLabel(day))}</h3><p class="hint">Dê um nome ao dia para os dois lembrarem. É opcional.</p>
      <form novalidate><label class="field"><span>Nome do dia</span><input data-m="name" maxlength="80" value="${esc(m.name)}" autocomplete="off" placeholder="Ex.: Jantar no Glouton"></label>
      <button class="btn" type="submit">Salvar</button>${dayTitle(day) ? '<button type="button" class="btn ghost" data-s="tirar">Tirar o nome</button>' : ""}</form>`,
    on: {
      submit: async () => {
        const title = m.name.trim();
        if (!title) { if (dayTitle(day)) return tirar(); closeSheet(); return; }
        const r = await q(sb.from("media_day_titles").upsert({ couple_id: S.couple.id, day, title, updated_at: new Date().toISOString() }, { onConflict: "couple_id,day" }).select().single());
        S.dayTitles = S.dayTitles.filter(x => x.day !== day).concat(r); closeSheet(); refreshViews(); toast("Nome salvo.");
      },
      tirar: () => tirar()
    }
  });
  async function tirar() {
    await q(sb.from("media_day_titles").delete().eq("couple_id", S.couple.id).eq("day", day));
    S.dayTitles = S.dayTitles.filter(x => x.day !== day); closeSheet(); refreshViews(); toast("Nome tirado.");
  }
}
const chunks = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
async function porNoFeed(ids) {
  const rows = [];
  for (const c of chunks(ids, 50)) rows.push(...await q(sb.from("media").update({ in_feed: true }).in("id", c).select()));
  rows.forEach(placeRow);
  UI.sel = null; refreshViews();
  toast(rows.length === 1 ? "Foi para o feed." : `${rows.length} fotos no feed.`);
}
function apagarFotos(ids) {
  const rows = ids.map(findMedia).filter(Boolean);
  askConfirm(rows.length === 1 ? "Apagar esta foto?" : `Apagar ${rows.length} fotos?`, "Elas somem para os dois e não dá para desfazer.", "Apagar", async () => {
    for (const c of chunks(rows.map(r => r.id), 50)) await q(sb.from("media").delete().in("id", c));
    const paths = rows.flatMap(r => [r.path, r.thumb_path]).filter(Boolean);
    for (const c of chunks(paths, 100)) sb.storage.from("media").remove(c).catch(() => { });
    const gone = new Set(rows.map(r => r.id));
    S.media = S.media.filter(x => !gone.has(x.id)); S.passeio = S.passeio.filter(x => !gone.has(x.id));
    UI.sel = null; closeSheet(); if (UI.viewer && gone.has(UI.viewer)) closeViewer(); refreshViews(); toast("Apagado.");
  });
}
const marcarPasseio = (id) => { if (!UI.sel) return; UI.sel.has(id) ? UI.sel.delete(id) : UI.sel.add(id); renderPanel(); };

/* ============ ações: viagens ============ */
function openNewTrip() {
  const m = { name: "", start: "", end: "", err: "" };
  openSheet({
    model: m,
    view: () => `<h3>Nova viagem</h3><p class="hint">Depois é só juntar as fotos nela.</p>${m.err ? hint(m.err) : ""}
      <form novalidate>
      <label class="field"><span>Nome da viagem</span><input data-m="name" maxlength="80" value="${esc(m.name)}" autocomplete="off" placeholder="Ex.: Paraty"></label>
      <label class="field"><span>Ida</span><input type="date" data-m="start" value="${esc(m.start)}"></label>
      <label class="field"><span>Volta</span><input type="date" data-m="end" value="${esc(m.end)}"></label>
      <button class="btn" type="submit">Criar viagem</button></form>`,
    on: {
      submit: async () => {
        if (!m.name.trim()) { m.err = "Dê um nome para a viagem."; drawSheet(); return; }
        if (m.start && m.end && m.end < m.start) { m.err = "A volta precisa ser depois da ida."; drawSheet(); return; }
        const t = await q(sb.from("trips").insert({ couple_id: S.couple.id, name: m.name.trim(), start_date: m.start || null, end_date: m.end || null }).select().single());
        S.trips.unshift(t); closeSheet(); render(true); toast("Viagem criada.");
        openPanel("trip", t.id);
      }
    }
  });
}
async function addToTrip(ids, tripId) {
  const rows = await q(sb.from("media").update({ trip_id: tripId }).in("id", ids).select());
  rows.forEach(r => { const i = S.media.findIndex(x => x.id === r.id); if (i >= 0) S.media[i] = r; });
  refreshViews();
}
function tripUpload() {
  const t = UI.panel && UI.panel.type === "trip" ? UI.panel.id : null; if (!t) return;
  pickFiles(ACCEPT_ALL, true, async files => { await uploadFiles(files, { trip_id: t }); });
}
function tripPick() {
  const tid = UI.panel && UI.panel.id; if (!tid) return;
  openPicker({
    title: "Juntar à viagem", hint: "Escolha as fotos e vídeos que fazem parte dela.", multi: true, okLabel: "Adicionar à viagem",
    exclude: x => x.trip_id === tid, emptyText: "Tudo o que foi enviado já está nesta viagem.",
    onDone: async ids => { await addToTrip(ids, tid); closeSheet(); toast("Adicionado à viagem."); },
    onUpload: async files => { closeSheet(); await uploadFiles(files, { trip_id: tid }); }
  });
}
function deleteTrip() {
  const t = S.trips.find(x => x.id === (UI.panel && UI.panel.id)); if (!t) return;
  askConfirm(`Apagar a viagem ${t.name}?`, "As fotos continuam guardadas, só saem da viagem.", "Apagar viagem", async () => {
    await q(sb.from("trips").delete().eq("id", t.id));
    S.trips = S.trips.filter(x => x.id !== t.id); S.media.forEach(m => { if (m.trip_id === t.id) m.trip_id = null; });
    closeSheet(); closePanel(); refreshViews(); toast("Viagem apagada.");
  });
}

/* ============ ações: subir ============ */
function startUpload() {
  pickFiles(ACCEPT_ALL, true, files => {
    const m = { place: "", trip: "" };
    openSheet({
      model: m, focus: false,
      view: () => `<h3>${files.length === 1 ? "Enviar 1 arquivo" : `Enviar ${files.length} arquivos`}</h3><p class="hint">Fotos ficam com no máximo 2000 px de largura. Vídeos podem ter até 50 MB.</p>
        <form novalidate>
        <label class="field"><span>Lugar (opcional)</span><input data-m="place" maxlength="120" value="${esc(m.place)}" autocomplete="off" placeholder="Ex.: Belo Horizonte, MG"></label>
        <label class="field"><span>Viagem (opcional)</span><select data-m="trip"><option value="">Nenhuma</option>${S.trips.map(t => `<option value="${t.id}" ${t.id === m.trip ? "selected" : ""}>${esc(t.name)}</option>`).join("")}</select></label>
        <button class="btn" type="submit">Enviar</button></form>`,
      on: { submit: async () => { closeSheet(); await uploadFiles(files, { place: m.place.trim(), trip_id: m.trip || null }); } }
    });
  });
}

/* ============ ações: listas ============ */
async function touchList(id) {
  const now = new Date().toISOString();
  const L = S.lists.find(l => l.id === id); if (L) L.updated_at = now;
  sb.from("lists").update({ updated_at: now }).eq("id", id).then(() => { });
}
const nextSecPos = listId => secsOf(listId).reduce((mx, x) => Math.max(mx, x.position), 0) + 1;
async function addSections(L, titles) {
  const base = nextSecPos(L.id);
  const rows = await q(sb.from("list_sections").insert(titles.map((t, i) => ({ list_id: L.id, couple_id: S.couple.id, title: String(t).slice(0, 80), position: base + i }))).select());
  S.sections.push(...rows);
}
/* modelo = um item de MODELOS, ou null para lista em branco */
async function newList(modelo) {
  try {
    const L = await q(sb.from("lists").insert({ couple_id: S.couple.id, title: modelo ? `${modelo.e} ${modelo.t}` : "Nova lista", rated: modelo ? modelo.rated : false }).select().single());
    S.lists.unshift(L);
    if (modelo) await addSections(L, modelo.secs());
    UI.openList = L.id; closeSheet(); render();
    const t = $("ltitle"); if (t && !modelo) { t.focus(); t.select(); }
  } catch (e) { toast(friendly(e)); }
}
function openNewList() {
  openSheet({
    focus: false,
    view: () => `<h3>Nova lista</h3><p class="hint">Escolha um modelo, com as seções prontas, ou comece em branco. Dá para mudar as seções depois.</p>
      <div class="models">${MODELOS.map(m => `<button type="button" class="model" data-s="modelo" data-k="${m.k}"><span class="e" aria-hidden="true">${m.e}</span><span><b>${esc(m.t)}</b><span class="d">${esc(m.d)}</span></span></button>`).join("")}
      <button type="button" class="model" data-s="branco"><span class="e" aria-hidden="true">${ic("edit", 20, 1.9)}</span><span><b>Lista em branco</b><span class="d">Sem seções, só o que você escrever</span></span></button></div>`,
    on: { modelo: t => newList(MODELOS.find(m => m.k === t.dataset.k)), branco: () => newList(null) }
  });
}
async function toggleItem(id) {
  const it = S.items.find(i => i.id === id); if (!it) return;
  const tarefa = isTask(it), antes = { done: it.done, done_by: it.done_by, done_at: it.done_at };
  it.done = !it.done;
  if (tarefa) { it.done_by = it.done ? S.user.id : null; it.done_at = it.done ? new Date().toISOString() : null; }
  render(true);
  try {
    if (tarefa) { Object.assign(it, await q(sb.from("list_items").update({ done: it.done }).eq("id", id).select().single())); render(true); avisarTarefas(); }
    else { await q(sb.from("list_items").update({ done: it.done }).eq("id", id)); touchList(it.list_id); }
  }
  catch (e) { Object.assign(it, antes); render(true); toast(friendly(e)); }
}
async function deleteItem(id) {
  const it = S.items.find(i => i.id === id); if (!it) return;
  try { await q(sb.from("list_items").delete().eq("id", id)); S.items = S.items.filter(i => i.id !== id); touchList(it.list_id); render(true); }
  catch (e) { toast(friendly(e)); }
}
async function setRating(id, n) {
  const it = S.items.find(i => i.id === id); if (!it) return;
  const old = it.rating, val = old === n ? null : n;
  it.rating = val; render(true);
  try { await q(sb.from("list_items").update({ rating: val }).eq("id", id)); touchList(it.list_id); }
  catch (e) { it.rating = old; render(true); toast(friendly(e)); }
}
async function toggleRated() {
  const L = S.lists.find(l => l.id === UI.openList); if (!L) return;
  const old = L.rated; L.rated = !old; render(true);
  try { await q(sb.from("lists").update({ rated: L.rated }).eq("id", L.id)); toast(L.rated ? "Notas ligadas. Toque nas estrelas." : "Notas desligadas."); }
  catch (e) { L.rated = old; render(true); toast(friendly(e)); }
}
const nextPos = listId => itemsOf(listId).reduce((mx, i) => Math.max(mx, i.position), 0) + 1;
const focusAdd = secId => setTimeout(() => { const n = view.querySelector(`.nitem[data-sec="${secId || ""}"]`); if (n) n.focus({ preventScroll: true }); }, 30);
async function addMany(lines, secId) {
  const L = S.lists.find(l => l.id === UI.openList); if (!L) return;
  const base = nextPos(L.id);
  const rows = await q(sb.from("list_items").insert(lines.map((text, i) => ({ list_id: L.id, couple_id: S.couple.id, text: text.slice(0, 5000), position: base + i, section_id: secId || null }))).select());
  S.items.push(...rows); touchList(L.id); render(true); focusAdd(secId);
}
const addItem = (text, secId) => addMany([text], secId);

/* ---- colar e copiar: sempre texto puro ---- */
/* texto vindo da área de transferência: sempre texto puro. HTML vira linhas (um item por bloco) */
function htmlToText(h) {
  const doc = new DOMParser().parseFromString(String(h), "text/html");
  doc.querySelectorAll("script,style,head,title,meta,input").forEach(n => n.remove());
  doc.querySelectorAll("br").forEach(b => b.replaceWith("\n"));
  doc.querySelectorAll("div,p,li,ul,ol,h1,h2,h3,h4,h5,h6,tr,blockquote,pre,section,article").forEach(n => n.append("\n"));
  return doc.body.textContent || "";
}
/* RTF (formato que o Notas do Mac também manda): lê de verdade, ignorando tabelas, marcadores de lista e códigos */
function rtfToText(r) {
  const s = String(r), SKIP = /^(fonttbl|colortbl|expandedcolortbl|stylesheet|info|listtable|listoverridetable|listtext|pict|header|footer|generator|themedata|datastore|latentstyles|xmlnstbl|rsidtbl|mmathPr|filetbl|revtbl)$/;
  let out = "", i = 0, uc = 1, skipN = 0;
  const stack = [{ skip: false }];
  const cur = () => stack[stack.length - 1];
  while (i < s.length) {
    const c = s[i];
    if (c === "{") { stack.push({ skip: cur().skip, fresh: true }); i++; continue; }
    if (c === "}") { if (stack.length > 1) stack.pop(); i++; continue; }
    if (c === "\\") {
      const n = s[i + 1];
      if (n === "\n" || n === "\r") { if (!cur().skip) out += "\n"; i += 2; continue; }
      if (n === "*") { cur().skip = true; i += 2; continue; }
      if (n === "'") { const h = s.substr(i + 2, 2); if (!cur().skip && skipN === 0) out += String.fromCharCode(parseInt(h, 16)); else if (skipN > 0) skipN--; i += 4; continue; }
      if (n === "\\" || n === "{" || n === "}") { if (!cur().skip) out += n; i += 2; continue; }
      if (n === "~") { if (!cur().skip) out += " "; i += 2; continue; }
      const m = /^([a-zA-Z]+)(-?\d+)? ?/.exec(s.slice(i + 1, i + 40));
      if (!m) { i += 2; continue; }
      const w = m[1], arg = m[2];
      i += 1 + m[0].length;
      const g = cur();
      if (g.fresh && SKIP.test(w)) g.skip = true;
      g.fresh = false;
      if (g.skip) continue;
      if (w === "par" || w === "line" || w === "row") out += "\n";
      else if (w === "tab" || w === "cell") out += " ";
      else if (w === "uc") uc = +arg || 0;
      else if (w === "u") { const v = +arg; out += String.fromCharCode(v < 0 ? v + 65536 : v); skipN = uc; }
      continue;
    }
    if (c === "\n" || c === "\r") { i++; continue; }
    cur().fresh = false;
    if (!cur().skip) { if (skipN > 0) skipN--; else out += c; }
    i++;
  }
  return out;
}
const HTMLISH = /<\/?(div|br|p|span|li|ul|ol|b|i|a|body|html|meta)\b[^>]*>/i;
const RTFISH = /^\s*\{\\rtf/;
/* ordem de preferência: texto puro > HTML (só se trouxer mais linhas) > RTF (só se não houver nenhum dos dois) */
function clipLines(cd) {
  if (!cd) return [];
  const get = ty => { try { return cd.getData(ty) || ""; } catch (x) { return ""; } };
  const plainRaw = get("text/plain");
  let plain = [];
  if (plainRaw) plain = parseLines(RTFISH.test(plainRaw) ? rtfToText(plainRaw) : HTMLISH.test(plainRaw) ? htmlToText(plainRaw) : plainRaw);
  const htmlRaw = get("text/html");
  const html = htmlRaw ? parseLines(htmlToText(htmlRaw)) : [];
  if (plain.length && plain.length >= html.length) return plain;
  if (html.length) return html;
  const rtfRaw = get("text/rtf") || get("text/richtext") || get("application/rtf");
  if (rtfRaw) { const r = parseLines(rtfToText(rtfRaw)); if (r.length) return r; }
  const uri = get("text/uri-list");
  if (uri) return parseLines(uri.split(/\r?\n/).filter(l => l && l[0] !== "#").join("\n"));
  return plain;
}
/* marcadores de lista/checklist no começo da linha: ◦ • - * – — ☐ ☑ ✓ ✔ ✅ ⬜ [ ] [x] e números "1." "1)" */
const MARCA = /^(?:[-*•◦‣⁃·▪▫●○◌◯–—]\s+|\[[ xX✓✔]?\]\s*|[☐☑☒□■✓✔✅⬜☑️✔️]\s*|\d{1,3}[.)]\s+)/;
const INVIS = /[\u00a0\u1680\u2000-\u200d\u202f\u205f\u2060\u3000\ufeff]/g;
/* uma linha de texto sem marcador de checklist/lista no começo e sem espaços invisíveis */
const limpaLinha = l => { let t = String(l).replace(INVIS, " ").trim(), prev; do { prev = t; t = t.replace(MARCA, "").replace(/\s*\\+$/, "").trim(); } while (t !== prev); if (/^\\[a-z*']/i.test(t) || !/[\p{L}\p{N}\p{Extended_Pictographic}]/u.test(t)) return ""; return t.slice(0, 5000); };
const QUEBRA = /\r\n|[\n\r\u2028\u2029\u0085\u000b\u000c]/;
function parseLines(txt) { return String(txt).split(new RegExp(QUEBRA.source)).map(limpaLinha).filter(Boolean); }
const temQuebra = v => new RegExp(QUEBRA.source).test(String(v));
/* aviso de excesso: no máximo 200 itens por colagem */
async function colarLinhas(lines, secId) {
  const cut = lines.length > 200;
  try { await addMany(lines.slice(0, 200), secId); if (cut) toast("Entraram os 200 primeiros. Cole o resto de novo."); }
  catch (err) { toast(friendly(err)); }
}
async function saveItemText(id, el) {
  const it = S.items.find(i => i.id === id); if (!it) return;
  const v = el.value.replace(/\s+/g, " ").trim();
  if (!v) { el.value = it.text; fitTA(el); return; }
  if (v === it.text) { el.value = v; fitTA(el); return; }
  const old = it.text; it.text = v; el.value = v; fitTA(el);
  try { await q(sb.from("list_items").update({ text: v }).eq("id", id)); touchList(it.list_id); }
  catch (e) { it.text = old; if (el.isConnected) { el.value = old; fitTA(el); } toast(friendly(e)); }
}
const fitTA = el => { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; };
const fitAll = () => view.querySelectorAll(".tx-in,.nitem").forEach(fitTA);
/* adiciona o que está escrito no campo de novo item (Enter, ou "Retorno" no celular) */
let ADDING = false;
async function submitNovo(el) {
  const lines = parseLines(el.value); if (!lines.length || ADDING) { if (!lines.length) el.value = ""; return; }
  ADDING = true; el.readOnly = true;
  try { await (lines.length > 1 ? colarLinhas(lines, el.dataset.sec) : addItem(lines[0], el.dataset.sec)); }
  catch (err) { toast(friendly(err)); if (el.isConnected) el.readOnly = false; }
  ADDING = false;
}

/* ---- seções ---- */
async function newSection() {
  const L = S.lists.find(l => l.id === UI.openList); if (!L) return;
  try {
    const rows = await q(sb.from("list_sections").insert({ list_id: L.id, couple_id: S.couple.id, title: "Nova seção", position: nextSecPos(L.id) }).select());
    S.sections.push(...rows); touchList(L.id); render(true);
    setTimeout(() => { const n = view.querySelector(`[data-sec-edit="${rows[0].id}"]`); if (n) { n.focus(); n.select(); n.scrollIntoView({ block: "center" }); } }, 40);
  } catch (e) { toast(friendly(e)); }
}
async function renameSection(id, el) {
  const x = S.sections.find(s => s.id === id); if (!x) return;
  const v = el.value.replace(/\s+/g, " ").trim();
  if (!v) { el.value = x.title; return; }
  if (v === x.title) { el.value = v; return; }
  const old = x.title; x.title = v; el.value = v;
  try { await q(sb.from("list_sections").update({ title: v }).eq("id", id)); touchList(x.list_id); }
  catch (e) { x.title = old; if (el.isConnected) el.value = old; toast(friendly(e)); }
}
function deleteSection(id) {
  const x = S.sections.find(s => s.id === id); if (!x) return;
  const its = itemsIn(x.list_id, id), done = () => { closeSheet(); render(true); };
  if (!its.length) { askConfirm(`Apagar a seção ${x.title}?`, "Ela está vazia.", "Apagar seção", async () => { await q(sb.from("list_sections").delete().eq("id", id)); S.sections = S.sections.filter(s => s.id !== id); touchList(x.list_id); done(); toast("Seção apagada."); }); return; }
  openSheet({
    focus: false,
    view: () => `<h3>Apagar a seção ${esc(x.title)}?</h3><p class="hint">Ela tem ${plural(its.length, "item", "itens")}. Os itens podem ficar na lista, sem seção, ou sair junto.</p>
      <div class="btns" style="flex-direction:column"><button class="btn" data-s="manter">Apagar a seção e manter os itens</button><button class="btn warn" data-s="tudo">Apagar a seção e os itens</button><button class="btn ghost" data-s="no">Cancelar</button></div>`,
    on: {
      manter: async () => { await q(sb.from("list_sections").delete().eq("id", id)); S.items.forEach(i => { if (i.section_id === id) i.section_id = null; }); S.sections = S.sections.filter(s => s.id !== id); touchList(x.list_id); done(); toast("Seção apagada. Os itens ficaram na lista."); },
      tudo: async () => { await q(sb.from("list_items").delete().eq("section_id", id)); await q(sb.from("list_sections").delete().eq("id", id)); S.items = S.items.filter(i => i.section_id !== id); S.sections = S.sections.filter(s => s.id !== id); touchList(x.list_id); done(); toast("Seção e itens apagados."); },
      no: () => closeSheet()
    }
  });
}
/* sugestão para listas sem seção: aplica as seções do modelo que combina com o título; os itens não mudam de lugar */
function organizar() {
  const L = S.lists.find(l => l.id === UI.openList), m = L && modeloDaLista(L); if (!m) return;
  const nomes = m.secs();
  openSheet({
    focus: false,
    view: () => `<h3>Organizar em seções?</h3><p class="hint">Vamos criar: ${esc(nomes.join(", "))}.${m.rated && !L.rated ? " Também ligamos as estrelas de nota." : ""} Seus itens continuam na lista, sem seção, e vocês movem para onde quiserem.</p>
      <div class="btns"><button class="btn ghost" data-s="no">Agora não</button><button class="btn" data-s="yes">Criar seções</button></div>`,
    on: {
      no: () => closeSheet(),
      yes: async () => {
        await addSections(L, nomes);
        if (m.rated && !L.rated) { L.rated = true; await q(sb.from("lists").update({ rated: true }).eq("id", L.id)); }
        touchList(L.id); closeSheet(); render(true); toast("Seções criadas.");
      }
    }
  });
}

/* ---- mudar de lugar: item (dentro da seção ou para outra) e seção ---- */
function midpoint(prev, next) {
  if (!prev && !next) return 1;
  if (!prev) return next.position - 1;
  if (!next) return prev.position + 1;
  return (prev.position + next.position) / 2;
}
/* põe o item na seção secId, entre os itens prevId e nextId (já dessa seção) */
async function moveItemTo(id, secId, prevId, nextId) {
  const it = S.items.find(i => i.id === id); if (!it) return;
  secId = secId || null;
  const target = itemsIn(it.list_id, secId).filter(i => i.id !== id);
  const prev = prevId ? target.find(i => i.id === prevId) : null, next = nextId ? target.find(i => i.id === nextId) : null;
  const to = prev ? target.indexOf(prev) + 1 : next ? target.indexOf(next) : target.length;
  const mesmaSecao = (it.section_id || null) === secId;
  if (mesmaSecao && itemsIn(it.list_id, secId).findIndex(i => i.id === id) === to) return;
  const before = new Map(S.items.filter(i => i.list_id === it.list_id).map(i => [i.id, { p: i.position, s: i.section_id || null }]));
  const gap = prev && next ? next.position - prev.position : 1;
  let changed = [it];
  if (gap < 1e-6) {
    const seq = [...target]; seq.splice(to, 0, it); seq.forEach((x, i) => { x.position = i + 1; });
    changed = seq.filter(x => x === it || x.position !== before.get(x.id).p);
  } else it.position = midpoint(prev, next);
  it.section_id = secId;
  render(true);
  try { await Promise.all(changed.map(x => q(sb.from("list_items").update(x === it ? { section_id: secId, position: x.position } : { position: x.position }).eq("id", x.id)))); touchList(it.list_id); }
  catch (e) { S.items.forEach(i => { const b = before.get(i.id); if (b) { i.position = b.p; i.section_id = b.s; } }); render(true); toast(friendly(e)); }
}
/* teclado: sobe ou desce o item dentro da própria seção */
function moveItem(id, delta) {
  const it = S.items.find(i => i.id === id); if (!it) return Promise.resolve();
  const lista = itemsIn(it.list_id, it.section_id), i = lista.findIndex(x => x.id === id), to = i + delta;
  if (to < 0 || to >= lista.length) return Promise.resolve();
  const resto = lista.filter(x => x.id !== id);
  return moveItemTo(id, it.section_id, resto[to - 1] && resto[to - 1].id, resto[to] && resto[to].id);
}
async function moveSection(id, to) {
  const x = S.sections.find(s => s.id === id); if (!x) return;
  const all = secsOf(x.list_id), from = all.findIndex(s => s.id === id);
  if (from < 0 || to < 0 || to >= all.length || to === from) return;
  const rest = all.filter(s => s.id !== id), prev = rest[to - 1], next = rest[to];
  const before = new Map(all.map(s => [s.id, s.position]));
  let changed = [x];
  if (prev && next && next.position - prev.position < 1e-6) { rest.splice(to, 0, x); rest.forEach((s, i) => { s.position = i + 1; }); changed = rest.filter(s => s.position !== before.get(s.id)); }
  else x.position = midpoint(prev, next);
  render(true);
  try { await Promise.all(changed.map(s => q(sb.from("list_sections").update({ position: s.position }).eq("id", s.id)))); touchList(x.list_id); }
  catch (e) { all.forEach(s => { s.position = before.get(s.id); }); render(true); toast(friendly(e)); }
}
let DRAG = null;
/* kind "item": arrasta uma linha por entre todas as linhas, cabeçalhos e campos de novo item; kind "sec": arrasta o bloco da seção */
function startDrag(e, grip, kind) {
  if (DRAG || (e.button != null && e.button !== 0)) return;
  const unit = kind === "sec" ? grip.closest(".sec") : grip.closest(".citem"); if (!unit) return;
  const nodes = kind === "sec" ? [...view.querySelectorAll(".lnote .sec[data-sec]")] : [...view.querySelectorAll(".lnote .citem, .lnote .shead, .lnote .nadd")];
  const i0 = nodes.indexOf(unit), sc = view.scrollTop;
  const mid = r => { const b = r.getBoundingClientRect(); return b.top + b.height / 2 + sc; };
  DRAG = { kind, unit, nodes, i0, to: i0, y0: e.clientY, y: e.clientY, sc0: sc, h: unit.getBoundingClientRect().height, mids: nodes.map(mid), raf: 0, grip, pid: e.pointerId };
  try { grip.setPointerCapture(e.pointerId); } catch (x) { }
  unit.classList.add("dragging"); nodes.forEach(r => { if (r !== unit) r.classList.add("shifting"); });
  grip.addEventListener("pointermove", dragMove); grip.addEventListener("pointerup", dragEnd); grip.addEventListener("pointercancel", dragEnd);
  dragLoop();
}
function dragPlace() {
  const D = DRAG; if (!D) return;
  const dy = (D.y - D.y0) + (view.scrollTop - D.sc0), center = D.mids[D.i0] + dy;
  let to = 0; D.mids.forEach((m, j) => { if (j !== D.i0 && m < center) to++; });
  D.to = to;
  D.unit.style.transform = `translateY(${dy}px)`;
  D.nodes.forEach((r, j) => {
    if (j === D.i0) return;
    const shift = D.to > D.i0 && j > D.i0 && j <= D.to ? -D.h : D.to < D.i0 && j >= D.to && j < D.i0 ? D.h : 0;
    r.style.transform = shift ? `translateY(${shift}px)` : "";
  });
}
function dragMove(e) { if (!DRAG || e.pointerId !== DRAG.pid) return; DRAG.y = e.clientY; dragPlace(); }
/* rola a tela quando o dedo chega perto da borda */
function dragLoop() {
  const D = DRAG; if (!D) return;
  const r = view.getBoundingClientRect(), edge = 70;
  let v = 0;
  if (D.y < r.top + edge) v = -Math.ceil((r.top + edge - D.y) / 6);
  else if (D.y > r.bottom - edge) v = Math.ceil((D.y - (r.bottom - edge)) / 6);
  if (v) { view.scrollTop += Math.max(-18, Math.min(18, v)); dragPlace(); }
  D.raf = requestAnimationFrame(dragLoop);
}
function dragEnd(e) {
  const D = DRAG; if (!D || (e && e.pointerId !== D.pid)) return;
  DRAG = null; cancelAnimationFrame(D.raf);
  D.grip.removeEventListener("pointermove", dragMove); D.grip.removeEventListener("pointerup", dragEnd); D.grip.removeEventListener("pointercancel", dragEnd);
  D.nodes.forEach(r => { r.style.transform = ""; r.classList.remove("dragging", "shifting"); });
  if ((e && e.type === "pointercancel") || D.to === D.i0) return;
  if (D.kind === "sec") { moveSection(D.unit.dataset.sec, D.to); return; }
  /* item: a seção e os vizinhos saem da ordem em que ficou */
  const order = D.nodes.filter((_, j) => j !== D.i0); order.splice(D.to, 0, D.unit);
  const k = order.indexOf(D.unit); let sec = null, prev = null, next = null;
  for (let j = 0; j < k; j++) { const n = order[j]; if (n.classList.contains("shead")) { sec = n.dataset.shead; prev = null; } else if (n.classList.contains("citem")) prev = n; }
  for (let j = k + 1; j < order.length; j++) { const n = order[j]; if (n.classList.contains("shead")) break; if (n.classList.contains("citem")) { next = n; break; } }
  moveItemTo(D.unit.dataset.item, sec, prev && prev.dataset.item, next && next.dataset.item);
}
/* a lista como texto puro: título, itens soltos, e cada seção com o nome em uma linha (sem marcas: cola limpo no Notas e no Us) */
function listText(L) {
  const out = [L.title, ...itemsIn(L.id, null).map(i => i.text)];
  secsOf(L.id).forEach(x => { out.push("", x.title, ...itemsIn(L.id, x.id).map(i => i.text)); });
  return out.join("\n");
}
function copyText(txt) {
  return new Promise(res => {
    const fallback = () => {
      const ta = document.createElement("textarea"); ta.value = txt; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
      document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, txt.length);
      let ok = false; try { ok = document.execCommand("copy"); } catch (x) { } ta.remove(); res(ok);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(() => res(true), fallback); else fallback();
  });
}
async function copyList() {
  const L = S.lists.find(l => l.id === UI.openList); if (!L) return;
  const ok = await copyText(listText(L));
  toast(ok ? "Lista copiada." : "Não consegui copiar. Selecione os itens e copie.");
}
async function togglePin() {
  const L = S.lists.find(l => l.id === UI.openList); if (!L) return;
  try { const r = await q(sb.from("lists").update({ pinned: !L.pinned, updated_at: new Date().toISOString() }).eq("id", L.id).select().single()); Object.assign(L, r); render(true); toast(L.pinned ? "Lista fixada." : "Lista desafixada."); }
  catch (e) { toast(friendly(e)); }
}
function deleteList() {
  const L = S.lists.find(l => l.id === UI.openList); if (!L) return;
  askConfirm(`Apagar a lista ${L.title}?`, "Os itens somem para os dois e não dá para desfazer.", "Apagar lista", async () => {
    await q(sb.from("lists").delete().eq("id", L.id));
    S.lists = S.lists.filter(l => l.id !== L.id); S.items = S.items.filter(i => i.list_id !== L.id); S.sections = S.sections.filter(x => x.list_id !== L.id);
    UI.openList = null; closeSheet(); render(); toast("Lista apagada.");
  });
}

/* ============ ações: calendário ============ */
const ALERTAS = [["", "Nenhum"], ["0", "Na hora"], ["5", "5 min antes"], ["15", "15 min antes"], ["30", "30 min antes"], ["60", "1 hora antes"], ["120", "2 horas antes"], ["1440", "1 dia antes"], ["2880", "2 dias antes"], ["10080", "1 semana antes"]];
const ALERTAS_DIA = [["", "Nenhum"], ["0", "No dia (9h)"], ["1440", "1 dia antes (9h)"], ["2880", "2 dias antes (9h)"], ["10080", "1 semana antes (9h)"]];
function proximaCor() { const usadas = new Set(S.calendars.map(c => c.color.toLowerCase())); return (PALETA.find(p => !usadas.has(p[0])) || PALETA[S.calendars.length % PALETA.length])[0]; }

const REPETIR = [["", "Não repete"], ["daily", "Todo dia"], ["weekly", "Toda semana"], ["biweekly", "A cada 2 semanas"], ["monthly", "Todo mês"], ["yearly", "Todo ano"]];
function openEventForm(ev) {
  const m = {
    title: ev ? ev.title : "", cal: ev && ev.calendar_id && calOf(ev) ? ev.calendar_id : "", allday: ev ? !evTime(ev) : true,
    date: ev ? ev.starts_on : UI.selDay, time: ev ? evTime(ev) : "", end: ev && ev.ends_on ? ev.ends_on : "", who: ev && ev.who_user ? ev.who_user : "",
    alert: ev && ev.alert_minutes != null ? String(ev.alert_minutes) : "", note: ev && ev.note ? ev.note : "", countdown: !!(ev && ev.countdown), err: "",
    rule: ev && ev.repeat_rule ? ev.repeat_rule : "", days: ev && ev.repeat_days ? [...ev.repeat_days] : [], daysTouched: !!(ev && ev.repeat_days), until: ev && ev.repeat_until ? ev.repeat_until : ""
  };
  /* dias da semana: enquanto a pessoa não mexe nos chips, acompanham o dia da data escolhida */
  const syncDays = () => { if (!m.daysTouched && m.date) m.days = [parseYmd(m.date).getDay()]; };
  const cals = [["", "Do casal", CASAL_COR], ...S.calendars.map(c => [c.id, c.name, c.color])];
  openSheet({
    model: m, focus: !ev,
    view: () => `<h3>${ev ? "Editar compromisso" : "Novo compromisso"}</h3>${m.err ? hint(m.err) : ""}
      <form novalidate>
      <label class="field"><span>O que vai acontecer</span><input data-m="title" maxlength="120" value="${esc(m.title)}" autocomplete="off" placeholder="Ex.: Jantar na casa da Bia"></label>
      <div class="field"><span>Calendário</span><div class="chips" role="group" aria-label="Calendário">
        ${cals.map(([id, nm, cor]) => `<button type="button" class="calchip" data-s="cal" data-v="${esc(id)}" aria-pressed="${m.cal === id}"><i style="--c:${cor}"></i>${esc(nm)}</button>`).join("")}</div></div>
      <button type="button" class="tgl-row" role="switch" aria-checked="${m.allday}" data-s="allday"><span>Dia inteiro</span><span class="tgl"></span></button>
      <div class="${m.allday ? "" : "row2"}">
        <label class="field"><span>Começa</span><input type="date" data-m="date" value="${esc(m.date)}"></label>
        ${m.allday ? "" : `<label class="field"><span>Horário</span><input type="time" data-m="time" value="${esc(m.time)}"></label>`}
      </div>
      <label class="field"><span>Termina (opcional)</span><input type="date" data-m="end" value="${esc(m.end)}" min="${esc(m.date)}"><span class="help">Para compromissos de vários dias, como uma viagem.</span></label>
      <div class="field"><span>Repetir</span><div class="chips" role="group" aria-label="Repetir">
        ${REPETIR.map(([v, t]) => `<button type="button" data-s="rep" data-v="${v}" aria-pressed="${m.rule === v}">${t}</button>`).join("")}</div>
        ${m.rule === "weekly" || m.rule === "biweekly" ? `<div class="chips days" role="group" aria-label="Dias da semana">${["D", "S", "T", "Q", "Q", "S", "S"].map((l, i) => `<button type="button" data-s="day" data-v="${i}" aria-label="${SEM[i]}" aria-pressed="${m.days.includes(i)}">${l}</button>`).join("")}</div>` : ""}
        ${m.rule ? `<p class="help-row" style="margin-top:-6px">${esc(repSummary({ repeat_rule: m.rule, repeat_days: m.days, repeat_until: m.until, starts_on: m.date || UI.selDay }))}. ${evDur({ starts_on: m.date, ends_on: m.end }) ? "Cada vez dura o mesmo número de dias." : ""}</p>` : ""}</div>
      ${m.rule ? `<label class="field"><span>Até quando (opcional)</span><input type="date" data-m="until" min="${esc(m.date)}" value="${esc(m.until)}"><span class="help">Sem data, repete para sempre.${ev ? " Mudar aqui vale para todas as repetições." : ""}</span></label>` : ""}
      <div class="field"><span>Quem vai</span><div class="chips" role="group" aria-label="Quem vai">
        <button type="button" data-s="who" data-v="" aria-pressed="${m.who === ""}">Os dois</button>
        ${S.members.map(x => `<button type="button" data-s="who" data-v="${x.user_id}" aria-pressed="${m.who === x.user_id}">${esc(x.display_name || "Alguém")}</button>`).join("")}</div></div>
      <label class="field"><span>Alerta</span><select data-m="alert">${(m.allday ? ALERTAS_DIA : ALERTAS).map(([v, t]) => `<option value="${v}" ${m.alert === v ? "selected" : ""}>${t}</option>`).join("")}</select></label>
      <button type="button" class="tgl-row" role="switch" aria-checked="${m.countdown}" data-s="countdown" style="margin-bottom:4px"><span>Contagem regressiva</span><span class="tgl"></span></button>
      <p class="help-row">Mostra na agenda quantos dias faltam.</p>
      <label class="field"><span>Observação (opcional)</span><input data-m="note" maxlength="300" value="${esc(m.note)}" autocomplete="off"></label>
      <button class="btn" type="submit">${ev ? "Salvar alterações" : "Salvar compromisso"}</button>
      ${ev ? `<button type="button" class="btn warn" data-s="apagar">Apagar compromisso</button>` : ""}</form>`,
    on: {
      cal: t => { m.cal = t.dataset.v; drawSheet(); },
      allday: () => { m.allday = !m.allday; if (m.allday && !ALERTAS_DIA.some(a => a[0] === m.alert)) m.alert = ""; drawSheet(); },
      who: t => { m.who = t.dataset.v; drawSheet(); },
      rep: t => { m.rule = t.dataset.v; if (!m.rule) m.until = ""; syncDays(); drawSheet(); },
      day: t => {
        const i = +t.dataset.v, on = m.days.includes(i);
        if (on && m.days.length === 1) return toast("Escolha pelo menos um dia da semana.");
        m.daysTouched = true; m.days = on ? m.days.filter(x => x !== i) : [...m.days, i].sort((a, b) => a - b); drawSheet();
      },
      countdown: () => { m.countdown = !m.countdown; drawSheet(); },
      apagar: () => deleteEvent(ev.id),
      submit: async () => {
        if (!m.title.trim()) { m.err = "Dê um nome para o compromisso."; drawSheet(); return; }
        if (!m.date) { m.err = "Escolha o dia em que começa."; drawSheet(); return; }
        if (!m.allday && !m.time) { m.err = "Escolha o horário ou ligue Dia inteiro."; drawSheet(); return; }
        if (m.end && m.end < m.date) { m.err = "O fim precisa ser no mesmo dia do começo ou depois."; drawSheet(); return; }
        if (m.until && m.until < m.date) { m.err = "A data final precisa ser no dia do começo ou depois."; drawSheet(); return; }
        let start = m.date, fim = m.end && m.end > m.date ? m.end : null;
        const semanal = m.rule === "weekly" || m.rule === "biweekly";
        if (semanal) {
          syncDays();
          /* o compromisso começa no primeiro dia marcado a partir da data escolhida (a duração é mantida) */
          let k = 0; while (!m.days.includes(parseYmd(addDaysS(start, k)).getDay()) && k < 7) k++;
          if (k) { if (fim) fim = addDaysS(fim, k); start = addDaysS(start, k); }
          if (m.until && m.until < start) { m.err = "A data final vem antes do primeiro dia da repetição. Escolha uma data depois."; drawSheet(); return; }
        }
        const row = {
          title: m.title.trim(), starts_on: start, ends_on: fim,
          repeat_rule: m.rule || null, repeat_days: semanal ? [...m.days].sort((a, b) => a - b) : null, repeat_until: m.rule && m.until ? m.until : null,
          start_time: m.allday ? null : m.time, time_label: m.allday ? null : m.time,
          calendar_id: m.cal || null, who_user: m.who || null, alert_minutes: m.alert === "" ? null : +m.alert, note: m.note.trim() || null, countdown: !!m.countdown
        };
        let saved;
        if (ev) {
          saved = await q(sb.from("events").update(row).eq("id", ev.id).select().single());
          const i = S.events.findIndex(x => x.id === ev.id); if (i >= 0) S.events[i] = saved; else S.events.push(saved);
        } else {
          saved = await q(sb.from("events").insert({ couple_id: S.couple.id, ...row }).select().single());
          S.events.push(saved);
        }
        S.events.sort(sortEv);
        if (HID.has(m.cal || "casal")) { HID.delete(m.cal || "casal"); saveHid(); }
        const d = parseYmd(start); UI.calY = d.getFullYear(); UI.calM = d.getMonth(); UI.selDay = start;
        closeSheet(); render(true); toast(ev ? "Compromisso atualizado." : "Compromisso salvo.");
        if (row.alert_minutes != null) offerPush();
      }
    }
  });
}
function deleteEvent(id) {
  const e = S.events.find(x => x.id === id); if (!e) return;
  askConfirm(`Apagar "${e.title}"?`, e.repeat_rule ? "Apaga a série inteira, com todas as repetições, para os dois." : "O compromisso some para os dois.", e.repeat_rule ? "Apagar a série" : "Apagar", async () => {
    await q(sb.from("events").delete().eq("id", id));
    S.events = S.events.filter(x => x.id !== id); closeSheet(); render(true); toast("Compromisso apagado.");
  });
}

/* ---- calendários (as cores) ---- */
async function criarCalendario(name, color) {
  const c = await q(sb.from("calendars").insert({ couple_id: S.couple.id, name, color }).select().single());
  S.calendars.push(c); return c;
}
function openCalendarios() {
  const def = {
    model: {}, focus: false,
    view: () => {
      const rows = [["casal", "Do casal", CASAL_COR, false], ...S.calendars.map(c => [c.id, c.name, c.color, true])];
      return `<h3>Calendários</h3><p class="hint">Toque para mostrar ou ocultar na agenda.</p>
      <div class="calrows">${rows.map(([id, nm, cor, ed]) => `<div class="calrow"><button type="button" class="calmain" role="switch" aria-checked="${!HID.has(id)}" data-s="vis" data-id="${esc(id)}"><span class="vis" style="--c:${cor}">${ic("check", 14, 3.4)}</span><span class="nm">${esc(nm)}</span></button>${ed ? `<button type="button" class="caledit" data-s="editcal" data-id="${esc(id)}" aria-label="Editar o calendário ${esc(nm)}">${ic("edit", 18, 1.9)}</button>` : ""}</div>`).join("")}</div>
      <div class="btns" style="margin:0 0 14px"><button class="btn ghost" data-s="todos">Mostrar todos</button><button class="btn ghost" data-s="nenhum">Ocultar todos</button></div>
      ${S.calendars.some(c => !c.auto_key) ? "" : `<p class="hint">Que tal começar por um destes?</p><div class="chips">${SUG_CALS.map(n => `<button type="button" data-s="sug" data-v="${esc(n)}">${esc(n)}</button>`).join("")}</div>`}
      <button class="btn" data-s="novo">Novo calendário</button>`;
    },
    on: {
      vis: t => { const id = t.dataset.id; if (HID.has(id)) HID.delete(id); else HID.add(id); saveHid(); drawSheet(); render(true); },
      todos: () => { HID.clear(); saveHid(); drawSheet(); render(true); },
      nenhum: () => { HID = new Set(["casal", ...S.calendars.map(c => c.id)]); saveHid(); drawSheet(); render(true); },
      sug: async t => { const n = t.dataset.v; await criarCalendario(n, proximaCor()); drawSheet(); render(true); toast(`Calendário ${n} criado.`); },
      novo: () => openCalForm(null),
      editcal: t => { const c = S.calendars.find(x => x.id === t.dataset.id); if (c) openCalForm(c); }
    }
  };
  openSheet(def);
}
function openCalForm(cal) {
  const auto = !!(cal && cal.auto_key);   /* calendário automático (Aniversários): só a cor muda */
  const m = { name: cal ? cal.name : "", color: cal ? cal.color : proximaCor(), err: "" };
  openSheet({
    model: m, focus: !cal,
    view: () => `<h3>${cal ? "Editar calendário" : "Novo calendário"}</h3>${m.err ? hint(m.err) : ""}
      <form novalidate>
      ${auto ? `<p class="hint">${esc(cal.name)} é criado pelo Us, com as datas de vocês. Aqui dá para trocar só a cor.</p>` : `<label class="field"><span>Nome</span><input data-m="name" maxlength="40" value="${esc(m.name)}" autocomplete="off" placeholder="Ex.: Médicos"></label>`}
      <div class="field"><span>Cor</span><div class="swatches" role="radiogroup" aria-label="Cor do calendário">${PALETA.map(([hex, nm]) => `<button type="button" class="swatch" role="radio" aria-label="${nm}" aria-checked="${m.color.toLowerCase() === hex}" data-s="cor" data-v="${hex}" style="--c:${hex}">${ic("check", 16, 3.2)}</button>`).join("")}</div></div>
      <button class="btn" type="submit">${cal ? "Salvar" : "Criar calendário"}</button>
      ${cal && !auto ? `<button type="button" class="btn warn" data-s="apagar">Apagar calendário</button>` : ""}
      <button type="button" class="btn ghost" data-s="voltar">Voltar</button></form>`,
    on: {
      cor: t => { m.color = t.dataset.v; drawSheet(); },
      voltar: () => sheetBack(),
      apagar: () => askConfirm(`Apagar o calendário ${cal.name}?`, "Os compromissos dele não somem: voltam para Do casal.", "Apagar calendário", async () => {
        await q(sb.from("calendars").delete().eq("id", cal.id));
        S.calendars = S.calendars.filter(c => c.id !== cal.id);
        S.events.forEach(e => { if (e.calendar_id === cal.id) e.calendar_id = null; });
        HID.delete(cal.id); saveHid(); render(true); openCalendarios(); toast("Calendário apagado.");
      }),
      submit: async () => {
        const name = m.name.trim();
        if (!name && !auto) { m.err = "Dê um nome para o calendário."; drawSheet(); return; }
        if (cal) { const r = await q(sb.from("calendars").update(auto ? { color: m.color } : { name, color: m.color }).eq("id", cal.id).select().single()); Object.assign(cal, r); }
        else await criarCalendario(name, m.color);
        render(true); sheetBack(); toast(cal ? "Calendário salvo." : "Calendário criado.");
      }
    }
  }, true);
}

/* ---- avisos no celular ---- */
const VAPID = "BEJClVUgE08Luw7szg-0m4oUhYPAF2XOnhjoFln8EZ1Ohv77ecnBW6J2c07oNfxcj4VOxz61MF8plfUp1-RvUa8";
const b64ToU8 = s => { const p = "=".repeat((4 - s.length % 4) % 4), r = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(r, c => c.charCodeAt(0)); };
async function pushStatus() {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  const ok = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (ios && (!standalone || !ok)) return "ios";
  if (!ok) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  try { const reg = await navigator.serviceWorker.getRegistration(); const sub = reg && await reg.pushManager.getSubscription(); if (sub && Notification.permission === "granted") return "on"; } catch (e) { }
  return "off";
}
const PUSH_TXT = {
  checking: "Conferindo…",
  on: "Ativadas neste aparelho. Você recebe o aviso na hora que escolher.",
  off: "Desativadas neste aparelho. Ative para ser lembrado dos compromissos.",
  blocked: "Bloqueadas neste aparelho. Para receber os avisos, libere as notificações do Us nas configurações do celular ou do navegador.",
  ios: "No iPhone, os avisos funcionam com o Us instalado na Tela de Início: no Safari, toque em Compartilhar e depois em Adicionar à Tela de Início.",
  unsupported: "Este navegador não permite avisos. Tente abrir o Us no Chrome ou no Safari."
};
async function enablePush() {
  if (!("Notification" in window)) throw own("Este aparelho não permite avisos.");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw own("Sem a sua permissão não dá para avisar. Libere as notificações nas configurações.");
  const reg = await Promise.race([navigator.serviceWorker.ready, new Promise((_, rej) => setTimeout(() => rej(own("Não consegui ativar agora. Feche e abra o Us e tente de novo.")), 8000))]);
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(VAPID) });
  const j = sub.toJSON(), k = j.keys || {};
  await q(sb.rpc("register_push", { p_endpoint: sub.endpoint, p_p256dh: k.p256dh, p_auth: k.auth }));
}
async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg && await reg.pushManager.getSubscription();
  if (sub) { const ep = sub.endpoint; await sub.unsubscribe(); await q(sb.from("push_subscriptions").delete().eq("endpoint", ep)); }
}
const pushMsg = e => e && e.own ? e.message : friendly(e, "Não consegui mudar as notificações. Tente de novo em instantes.");
let pushOfferSeen = false;
async function offerPush() {
  if (pushOfferSeen) return;
  const st = await pushStatus();
  if (st === "on") return;
  pushOfferSeen = true;
  if (st === "off") {
    openSheet({
      focus: false,
      view: () => `<h3>Quer ser avisado?</h3><p class="hint">Ative as notificações neste celular e o Us lembra vocês na hora certa.</p><button class="btn" data-s="ativar">Ativar notificações neste celular</button><button class="btn ghost" data-s="depois">Agora não</button>`,
      on: {
        ativar: async () => { try { await enablePush(); closeSheet(); toast("Notificações ativadas neste celular."); } catch (e) { toast(pushMsg(e)); } },
        depois: () => closeSheet()
      }
    });
  } else {
    openSheet({ focus: false, view: () => `<h3>Avisos no celular</h3><p class="hint">${esc(PUSH_TXT[st])}</p><button class="btn" data-s="ok">Entendi</button>`, on: { ok: () => closeSheet() } });
  }
}

/* ao sair da conta, este aparelho deixa de receber avisos dessa conta (erros são ignorados) */
async function dropPushOnSignOut() {
  try {
    if (!("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg && reg.pushManager && await reg.pushManager.getSubscription();
    if (!sub) return;
    const ep = sub.endpoint;
    try { await sb.from("push_subscriptions").delete().eq("endpoint", ep); } catch (e) { }
    try { await sub.unsubscribe(); } catch (e) { }
  } catch (e) { }
}
function copyCode() {
  const code = S.couple.invite_code;
  const done = () => toast("Código copiado. Mande para quem você ama.");
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(done, () => toast(`Seu código: ${code}`));
  else toast(`Seu código: ${code}`);
}

/* ============ eventos da tela ============ */
function refreshViews() { render(true); if (UI.panel) renderPanel(); if (UI.viewer) renderViewer(); }
$("tabbar").addEventListener("click", e => {
  const b = e.target.closest(".tab"); if (!b) return;
  closePanel(); closeViewer();
  if (b.dataset.tab === UI.tab && UI.tab === "listas") UI.openList = null;
  UI.tab = b.dataset.tab; render();
  view.classList.remove("enter"); void view.offsetWidth; view.classList.add("enter");
});
let sugBusy = false;
$("main").addEventListener("click", e => {
  const t = e.target.closest("[data-media],[data-act],[data-seg],[data-list],[data-check],[data-delitem],[data-day],[data-mon],[data-trip],[data-place],[data-delev],[data-ev],[data-sug],[data-rate],[data-delsec],[data-pm],[data-dayname],[data-pday],[data-tarefa]");
  if (!t) return;
  const d = t.dataset;
  if (d.media) return openViewer(d.media, !!t.closest(".grid.rev"));
  if (d.pm) return UI.sel ? marcarPasseio(d.pm) : openViewer(d.pm);
  if (d.dayname) return openDayName(d.dayname);
  if (d.pday) {
    const lista = S.passeio.filter(m => m.taken_at === d.pday);
    if (!UI.sel) return salvarFotos(lista);
    const todas = lista.every(m => UI.sel.has(m.id));
    lista.forEach(m => todas ? UI.sel.delete(m.id) : UI.sel.add(m.id)); return renderPanel();
  }
  if (d.seg) { UI.seg = d.seg; return render(true); }
  if (d.trip) return openPanel("trip", d.trip);
  if (d.place) return openPanel("place", d.place);
  if (d.list) { UI.openList = d.list; return render(); }
  if (d.tarefa) return openTarefa(d.tarefa);
  if (d.check) return toggleItem(d.check);
  if (d.delitem) return deleteItem(d.delitem);
  if (d.delev) return deleteEvent(d.delev);
  if (d.ev) { const x = S.events.find(v => v.id === d.ev); if (x && x.auto_key) return toast("Essa data vem do perfil. Para mudar, toque em Editar perfil."); return x && openEventForm(x); }
  if (d.rate) return setRating(d.rate, +d.n);
  if (d.delsec) return deleteSection(d.delsec);
  if (d.sug) { if (sugBusy) return; const x = MODELOS.find(m => m.k === d.sug); if (!x) return; sugBusy = true; return newList(x).finally(() => { sugBusy = false; }); }
  if (d.day) { UI.selDay = d.day; return render(true); }
  if (d.mon) {
    UI.calM += +d.mon; if (UI.calM < 0) { UI.calM = 11; UI.calY--; } if (UI.calM > 11) { UI.calM = 0; UI.calY++; }
    const first = `${UI.calY}-${pad(UI.calM + 1)}-01`; UI.selDay = first;
    return render(true);
  }
  const A = {
    editar: openProfile, novo: openNewPost, capa: () => openCoverPicker(false), copiar: copyCode, subir: startUpload,
    novaviagem: openNewTrip, "trip-upload": tripUpload, "trip-pick": tripPick, "trip-del": deleteTrip,
    fecharpanel: () => closePanel(), fecharviewer: () => closeViewer(),
    "v-feed": async () => {
      const x = findMedia(UI.viewer); if (!x) return;
      try { const r = await q(sb.from("media").update({ in_feed: !x.in_feed }).eq("id", x.id).select().single()); placeRow(r); refreshViews(); toast(r.in_feed ? "Foi para o feed." : "Saiu do feed."); }
      catch (err) { toast(friendly(err)); }
    },
    "v-edit": openEditMedia, "v-del": deleteMedia,
    "v-save": () => { const x = findMedia(UI.viewer); if (x) salvarFotos([x]); },
    passeio: () => openPanel("passeio"), "p-enviar": pedirEnvioPasseio,
    "p-salvar-todas": () => salvarFotos(S.passeio),
    "p-escolher": () => { UI.sel = new Set(); renderPanel(); }, "p-cancelar": () => { UI.sel = null; renderPanel(); },
    "p-todas": () => { UI.sel = UI.sel.size === S.passeio.length ? new Set() : new Set(S.passeio.map(m => m.id)); renderPanel(); },
    "p-feed": () => UI.sel && UI.sel.size && porNoFeed([...UI.sel]).catch(err => toast(friendly(err))),
    "p-salvar-sel": () => UI.sel && UI.sel.size && salvarFotos([...UI.sel].map(findMedia).filter(Boolean)),
    "p-apagar": () => UI.sel && UI.sel.size && apagarFotos([...UI.sel]),
    novatarefa: () => openTarefa(null), vertarefas: () => { const L = tasksList(); if (L) { UI.openList = L.id; render(); } },
    feitas: () => { UI.tarefasFeitas = !UI.tarefasFeitas; render(true); },
    novalista: openNewList, novasecao: newSection, darnota: toggleRated, organizar, voltarlista: () => { UI.openList = null; render(); }, fixar: togglePin, apagarlista: deleteList, copiarlista: copyList,
    hoje: () => { const n = todayDate(); UI.calY = n.getFullYear(); UI.calM = n.getMonth(); UI.selDay = ymd(n); render(true); },
    evento: () => openEventForm(), calendarios: openCalendarios
  }[d.act];
  if (A) A();
});
/* colar no campo de novo item ou na edição de um item. Lê todos os tipos do clipboard; se não vier nada,
   deixa a colagem padrão acontecer e trata no evento "input" (as quebras de linha ficam no textarea) */
view.addEventListener("paste", e => {
  const el = e.target, novo = el.classList && el.classList.contains("nitem"), edit = el.classList && el.classList.contains("tx-in");
  if (!novo && !edit) return;
  const lines = clipLines(e.clipboardData || window.clipboardData);
  if (!lines.length) return;
  e.preventDefault();                         /* nunca deixa o navegador colar HTML */
  if (novo && lines.length > 1) { colarLinhas(lines, el.dataset.sec); return; }
  const piece = lines.join(" "), room = Math.max(0, 5000 - (el.value.length - (el.selectionEnd - el.selectionStart)));
  el.setRangeText(piece.slice(0, room), el.selectionStart, el.selectionEnd, "end");
  fitTA(el);
});
/* copiar da tela da lista (menu do sistema): só título, seções e itens, em texto puro, sem botões nem rótulos */
document.addEventListener("copy", e => {
  if (UI.tab !== "listas") return;
  const L = S.lists.find(l => l.id === UI.openList); if (!L) return;
  if (e.target.matches && e.target.matches("textarea,input")) return;
  const sel = window.getSelection(); if (!sel || sel.isCollapsed) return;
  const lines = [];
  if ($("ltitle") && sel.containsNode($("ltitle"), true)) lines.push(L.title);
  view.querySelectorAll(".lnote .citem[data-item], .lnote .shead").forEach(r => {
    if (!sel.containsNode(r, true)) return;
    if (r.classList.contains("shead")) { const x = S.sections.find(s => s.id === r.dataset.shead); if (x) lines.push("", x.title); }
    else { const it = S.items.find(i => i.id === r.dataset.item); if (it) lines.push(it.text); }
  });
  if (!lines.length) return;
  e.clipboardData.setData("text/plain", lines.join("\n").replace(/^\n/, ""));
  e.preventDefault();
});
/* colar com setRangeText não dispara "change": salva também ao sair do campo (não repete se nada mudou) */
view.addEventListener("focusout", e => {
  const t = e.target; if (!t.classList || !t.isConnected) return;
  if (t.classList.contains("tx-in")) saveItemText(t.dataset.edit, t);
  else if (t.classList.contains("sec-in")) renameSection(t.dataset.secEdit, t);
});
view.addEventListener("pointerdown", e => {
  const g = e.target.closest("[data-grip]"); if (g) return startDrag(e, g, "item");
  const s = e.target.closest("[data-sgrip]"); if (s) startDrag(e, s, "sec");
});
/* qualquer caminho de colagem que deixe várias linhas no campo vira vários itens */
view.addEventListener("input", e => {
  const el = e.target; if (!el.classList) return;
  if (el.classList.contains("tx-in")) {
    if (temQuebra(el.value)) el.value = parseLines(el.value).join(" ");
    fitTA(el); return;
  }
  if (el.classList.contains("nitem")) {
    if (temQuebra(el.value)) { const lines = parseLines(el.value); el.value = ""; fitTA(el); if (lines.length) colarLinhas(lines, el.dataset.sec); return; }
    if (/^insertFromPaste|^insertFromDrop|^insertReplacementText/.test(e.inputType || "")) el.value = limpaLinha(el.value);
    fitTA(el);
  }
});
/* "Retorno" do celular (que nem sempre manda a tecla Enter) também adiciona o item */
view.addEventListener("beforeinput", e => {
  const el = e.target;
  if (el.classList && el.classList.contains("nitem") && (e.inputType === "insertLineBreak" || e.inputType === "insertParagraph")) { e.preventDefault(); submitNovo(el); }
});
view.addEventListener("keydown", e => {
  const el = e.target;
  const g = el.closest && el.closest("[data-grip],[data-sgrip]");
  if (g && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
    e.preventDefault();
    const d = e.key === "ArrowUp" ? -1 : 1;
    if (g.dataset.grip) {
      const id = g.dataset.grip;
      moveItem(id, d).then(() => { const n = view.querySelector(`[data-grip="${id}"]`); if (n) n.focus(); });
    } else {
      const id = g.dataset.sgrip, x = S.sections.find(s => s.id === id); if (!x) return;
      moveSection(id, secsOf(x.list_id).findIndex(s => s.id === id) + d).then(() => { const n = view.querySelector(`[data-sgrip="${id}"]`); if (n) n.focus(); });
    }
    return;
  }
  if (e.key === "Enter" && !e.isComposing && el.classList) {
    if (el.classList.contains("nitem")) { e.preventDefault(); submitNovo(el); }
    else if (el.classList.contains("tx-in") && !e.shiftKey) { e.preventDefault(); el.blur(); }
    else if (el.classList.contains("sec-in") || el.id === "ltitle") el.blur();
  }
});
view.addEventListener("change", async e => {
  if (e.target.classList && e.target.classList.contains("tx-in")) { saveItemText(e.target.dataset.edit, e.target); return; }
  if (e.target.id !== "ltitle") return;
  const L = S.lists.find(l => l.id === UI.openList); if (!L) return;
  const v = e.target.value.trim();
  if (!v) { e.target.value = L.title; toast("A lista precisa de um nome."); return; }
  if (v === L.title) return;
  try { const r = await q(sb.from("lists").update({ title: v, updated_at: new Date().toISOString() }).eq("id", L.id).select().single()); Object.assign(L, r); }
  catch (err) { e.target.value = L.title; toast(friendly(err)); }
});

/* ============ atualizar quando voltar para o app ============ */
async function refresh() {
  if (!S.loaded || Date.now() - S.lastLoad < 8000) return;
  try {
    await loadData();
    if (!S.couple) return;
    const busy = SH || (document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName));
    if (busy) return;
    if (UI.viewer && !findMedia(UI.viewer)) closeViewer();
    refreshViews();
  } catch (e) { /* sem rede: mantém o que está na tela */ }
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") refresh(); });

/* ============ login que não se perde ============
   O iPhone às vezes apaga o localStorage do app instalado na tela inicial.
   Guardamos a sessão em dois lugares (localStorage + IndexedDB) e lemos de quem tiver. */
const sessionStore = (() => {
  const DB = SESSAO_DB, ST = "kv";
  let dbp = null;
  const idb = () => dbp || (dbp = new Promise((res, rej) => {
    try { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(ST); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); }
  }));
  const tx = async (mode, fn) => { const db = await idb(); return new Promise((res, rej) => { const t = db.transaction(ST, mode); const req = fn(t.objectStore(ST)); t.oncomplete = () => res(req && req.result); t.onerror = () => rej(t.error); }); };
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } };
  const lsDel = k => { try { localStorage.removeItem(k); } catch (e) { } };
  return {
    async getItem(k) {
      const a = lsGet(k); if (a) return a;
      try { const b = await tx("readonly", s => s.get(k)); if (b) { lsSet(k, b); return b; } } catch (e) { }
      return null;
    },
    async setItem(k, v) { lsSet(k, v); try { await tx("readwrite", s => s.put(v, k)); } catch (e) { } },
    async removeItem(k) { lsDel(k); try { await tx("readwrite", s => s.delete(k)); } catch (e) { } }
  };
})();
/* quem já estava logado com a chave antiga não precisa entrar de novo */
if (!TESTE) { try { const old = localStorage.getItem("sb-qjouhtitpufjnhocbnbs-auth-token"); if (old && !localStorage.getItem("us-auth")) localStorage.setItem("us-auth", old); } catch (e) { } }

/* ============ começar ============ */
async function init() {
  if (!window.supabase) { showGate(`<div class="center stack"><h1 class="step">Sem conexão</h1><p>Não consegui carregar o Us. Confira a internet e tente de novo.</p><button class="btn" data-g="reload">Tentar de novo</button></div>`); gate.addEventListener("click", e => { if (e.target.closest("[data-g=reload]")) location.reload(); }); return; }
  showGate(loadingHTML("Abrindo o Us…"));
  let key = SB_KEY;
  try { const r = await fetch(`${SB_URL}/auth/v1/settings`, { headers: { apikey: SB_KEY } }); if (r.status === 401 || r.status === 403) key = SB_KEY_LEGADA; } catch (e) { /* offline: segue com a chave principal */ }
  sb = window.supabase.createClient(SB_URL, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storage: sessionStore, storageKey: AUTH_KEY } });
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { }
  const h = location.hash || "";
  if (/type=recovery/.test(h)) UI.recovery = true;
  else if (/^#cal\b/.test(h)) { UI.tab = "cal"; history.replaceState(null, "", location.pathname); }
  else if (/^#tarefa=/.test(h)) { const mt = /^#tarefa=([0-9a-f-]{36})(?:&m=(\w+))?/i.exec(h); if (mt) UI.abrirTarefa = { id: mt[1], modo: mt[2] || "ver" }; history.replaceState(null, "", location.pathname); }
  else if (/^#fotos\b/.test(h)) { UI.tab = "fotos"; UI.abrirPasseio = true; history.replaceState(null, "", location.pathname); }
  let hashErr = "";
  if (/error_code=otp_expired|error=access_denied/.test(h)) { hashErr = "O link venceu ou já foi usado. Peça um novo em Esqueci a senha."; history.replaceState(null, "", location.pathname); }
  sb.auth.onAuthStateChange((ev, session) => {
    setTimeout(() => {
      if (ev === "PASSWORD_RECOVERY") { UI.recovery = true; showRecovery(); }
      else if (ev === "SIGNED_IN" && session && !UI.recovery) { if (!S.user || S.user.id !== session.user.id) boot(); }
      else if (ev === "SIGNED_OUT") { if (S.user || S.loaded) { resetState(); showAuth(); } }
    }, 0);
  });
  if (hashErr) { const { data } = await sb.auth.getSession(); if (!data.session) { showAuth(hashErr); return; } }
  await boot();
}
if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).catch(() => { }));
  /* versão nova publicada: confere sempre que o app volta para a tela e recarrega sozinho quando é seguro
     (nunca no meio de um formulário aberto ou enquanto a pessoa digita) */
  const tinhaVersao = !!navigator.serviceWorker.controller;
  let recarregarDepois = false;
  const seguro = () => !SH && !(ENVIO && ENVIO.ativo) && !(document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName));
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!tinhaVersao) return; // primeira vez neste aparelho: a página já é a versão nova
    if (ENVIO && ENVIO.ativo) recarregarDepois = true; else if (document.hidden || seguro()) location.reload(); else recarregarDepois = true;
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { if (recarregarDepois && !(ENVIO && ENVIO.ativo)) location.reload(); return; }
    navigator.serviceWorker.getRegistration().then(r => r && r.update()).catch(() => { });
  });
}
if ("serviceWorker" in navigator) navigator.serviceWorker.addEventListener("message", e => {
  if (e.data && e.data.tipo === "abrir-calendario" && S.couple) { closePanel(); closeViewer(); closeSheet(); UI.tab = "cal"; render(); }
  if (e.data && e.data.tipo === "abrir-tarefa" && S.couple) abrirTarefaDoAviso(e.data.id, e.data.modo);
  if (e.data && e.data.tipo === "abrir-fotos" && S.couple) { closePanel(); closeViewer(); closeSheet(); UI.tab = "fotos"; render(); openPanel("passeio"); }
});
if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) window.__usFotos = { S, UI, urlCache, readExifDate, injectExif, prepararFoto, passeioDias, render, openPanel, closeSheet, salvarFotos, exifDateFromString, iniciarEnvio, setSb: x => { sb = x; }, envio: () => ENVIO,
  entrar: () => { gate.hidden = true; app.hidden = false; render(); } };
init();
})();
