// Localmente acessa o Flask direto. Na Vercel, /api é encaminhado ao backend.
<<<<<<< HEAD
const FRONTEND_BUILD = "2026.08.19-ROUTES-03-STORY-01";
=======
const FRONTEND_BUILD = "2026.08.18-ROUTES-03";
>>>>>>> 296cd674e2f205b2ac23260bde1771f355a8735a
console.info(`[Desafio Trigonométrico] Frontend build ${FRONTEND_BUILD}`);
const IS_LOCAL = location.protocol === "file:" || ["localhost", "127.0.0.1"].includes(location.hostname);
const API = IS_LOCAL ? "http://127.0.0.1:5000/game" : "/api/game";

// Mesmas imagens cadastradas no backend original (characters.py).
// A rota /game/characters continua sendo a fonte principal; esta lista evita
// que a seleção fique vazia enquanto a API estiver carregando.
const BACKEND_CHARACTERS = [
  { id: 1, name: "Theo", role: "Guardião dos Ângulos", image_url: "https://res.cloudinary.com/pltlrh9n/image/upload/v1786797938/menino.png" },
  { id: 2, name: "Ayla", role: "Exploradora dos Gráficos", image_url: "https://res.cloudinary.com/pltlrh9n/image/upload/v1786797937/menina.png" },
  { id: 3, name: "Pixel", role: "Estrategista das Dicas", image_url: "https://res.cloudinary.com/pltlrh9n/image/upload/v1786797938/gato.png" },
  { id: 4, name: "Bolt", role: "Mestre dos Períodos", image_url: "https://res.cloudinary.com/pltlrh9n/image/upload/v1786797938/c%C3%A3o.png" },
  { id: 5, name: "Íris", role: "Engenheira dos Problemas", image_url: "https://res.cloudinary.com/pltlrh9n/image/upload/v1786797937/passarinho.png" },
];

const REACTION_IMAGES = {
  1: { happy: "assets/reactions/theo_feliz.webp?v=2", sad: "assets/reactions/theo_triste.webp?v=2" },
  2: { happy: "assets/reactions/ayla_feliz.webp?v=2", sad: "assets/reactions/ayla_triste.webp?v=2" },
  3: { happy: "assets/reactions/pixel_feliz.webp?v=2", sad: "assets/reactions/pixel_triste.webp?v=2" },
  4: { happy: "assets/reactions/bolt_feliz.webp?v=2", sad: "assets/reactions/bolt_triste.webp?v=2" },
  5: { happy: "assets/reactions/iris_feliz.webp?v=2", sad: "assets/reactions/iris_triste.webp?v=2" },
};

const STORY_SCENES = [
  {
    image: "assets/story/centro-alerta.webp?v=1",
    status: "ALERTA DO SISTEMA",
    title: "Uma falha atingiu o centro",
  },
  {
    image: "assets/story/centro-bloqueado.webp?v=1",
    status: "MISSÃO RECEBIDA",
    title: "As cinco fases foram bloqueadas",
  },
];

const state = {
  view: "start",
  overview: null,
  characters: BACKEND_CHARACTERS,
  playerName: sessionStorage.getItem("trig-player") || "",
  playerId: sessionStorage.getItem("trig-player-id") || "",
  selectedCharacter: Number(sessionStorage.getItem("trig-character")) || null,
  stageId: Number(sessionStorage.getItem("trig-stage")) || 1,
  stage: null,
  questionIndex: 0,
  selectedOption: null,
  progress: null,
  hints: {},
  hintCooldownUntil: 0,
  newHintKey: null,
  answerPending: false,
  navigationPending: false,
  storyPage: 0,
  modal: null,
  certificate: null,
};

const app = document.querySelector("#app");
const toast = document.querySelector("#toast");
let renderedView = null;
let lastAction = { name: "", time: 0 };

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.errors?.join(" ") || "Não foi possível acessar o servidor.");
  return data;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

function storyPages() {
  const fallback = "Uma falha atingiu o Centro de Treinamento Trigonométrico. Os códigos que mantêm o sistema ativo foram espalhados pelas cinco fases.\n\nSua missão é resolver os desafios, recuperar cada parte do código e restaurar o sistema.";
  const text = String(state.overview?.introduction || fallback).trim();
  const paragraphs = text.split(/\n\s*\n/).map(item => item.trim()).filter(Boolean);
  if (paragraphs.length >= 2) {
    const middle = Math.ceil(paragraphs.length / 2);
    return [paragraphs.slice(0, middle).join("\n\n"), paragraphs.slice(middle).join("\n\n")];
  }
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map(item => item.trim()).filter(Boolean) || [text];
  if (sentences.length < 2) return [sentences[0], "Prepare-se para superar as cinco fases e recuperar o código final."];
  const middle = Math.ceil(sentences.length / 2);
  return [sentences.slice(0, middle).join(" "), sentences.slice(middle).join(" ")];
}

function notify(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => toast.classList.remove("show"), 3200);
}

function loading() {
  app.innerHTML = `<section class="screen"><div class="loading" aria-label="Carregando"></div></section>`;
}

function currentStageFromProgress(progress = state.progress) {
  const serverStage = Number(progress?.current_stage);
  if (Number.isInteger(serverStage) && serverStage >= 1 && serverStage <= 5) return serverStage;
  return Math.min(5, Math.max(1, Number(state.stageId) || 1));
}

function normalizedIds(values = []) {
  return new Set((Array.isArray(values) ? values : []).map(value => String(value)));
}

function isQuestionAnswered(progress, questionId) {
  return normalizedIds(progress?.answered_questions).has(String(questionId));
}

function isStageCompleted(progress, stageId) {
  return normalizedIds(progress?.completed_stages).has(String(stageId));
}

function nextUnansweredIndex(exercises = [], progress = state.progress, startAt = 0) {
  if (!Array.isArray(exercises)) return -1;
  const answeredQuestions = normalizedIds(progress?.answered_questions);
  const nextIndex = exercises.findIndex((question, index) => (
    index >= startAt && !answeredQuestions.has(String(question.id))
  ));
  if (nextIndex >= 0) return nextIndex;
  return exercises.findIndex(question => !answeredQuestions.has(String(question.id)));
}

async function continueAfterAnswer() {
  state.modal = null;
  state.selectedOption = null;
  state.hintCooldownUntil = 0;
  const nextQuestion = nextUnansweredIndex(
    state.stage?.exercises,
    state.progress,
    state.questionIndex + 1,
  );
  if (nextQuestion >= 0) {
    state.questionIndex = nextQuestion;
    state.view = "instruction";
    render();
    return;
  }
  await openMap();
}

function applyProgressRoute(progress, preferredView = "map") {
  state.progress = progress;
  state.stageId = currentStageFromProgress(progress);
  sessionStorage.setItem("trig-stage", String(state.stageId));
  state.modal = null;
  if (progress?.game_over) state.view = "gameOver";
  else if (progress?.awaiting_final_code) state.view = "finalCode";
  else state.view = preferredView;
}

async function openMap() {
  if (state.navigationPending) return;
  if (!state.playerName) {
    state.view = "start";
    render();
    return;
  }
  state.navigationPending = true;
  loading();
  try {
    const progress = await api(`/progress/${encodeURIComponent(state.playerName)}`);
    applyProgressRoute(progress, "map");
  } catch (error) {
    notify(error.message);
    state.modal = null;
    state.view = state.progress ? "map" : "start";
  }
  state.navigationPending = false;
  render();
}

function modalHtml() {
  if (!state.modal) return "";
  if (state.modal.kind === "how-to-play") {
    return `<div class="modal-backdrop how-to-backdrop" data-modal-backdrop><section class="modal how-to-modal" role="dialog" aria-modal="true" aria-labelledby="how-to-title"><button class="modal-close-button" data-action="close-modal" aria-label="Fechar instruções" title="Fechar">×</button><header class="how-to-header"><span class="how-to-symbol" aria-hidden="true">?</span><div><p>GUIA RÁPIDO</p><h2 id="how-to-title">Como jogar</h2></div></header><p class="how-to-intro">Complete as cinco fases, recupere as palavras escondidas e monte o código final do Desafio Trigonométrico.</p><div class="how-to-steps"><article><span>1</span><div><strong>IDENTIFIQUE-SE</strong><p>Digite seu nome e escolha o personagem que acompanhará você.</p></div></article><article><span>2</span><div><strong>LEIA AS INSTRUÇÕES</strong><p>Cada exercício possui uma explicação antes da pergunta.</p></div></article><article><span>3</span><div><strong>RESPONDA</strong><p>Selecione uma alternativa e clique em “Responder” para confirmar.</p></div></article><article><span>4</span><div><strong>USE AS DICAS</strong><p>O botão “?” mostra até duas dicas. Aguarde três segundos entre elas.</p></div></article><article><span>5</span><div><strong>CUIDE DAS VIDAS</strong><p>Você possui três vidas. Cada resposta incorreta consome uma tentativa.</p></div></article><article><span>6</span><div><strong>MONTE O CÓDIGO</strong><p>Cada fase libera uma palavra. No final, una todas na ordem correta.</p></div></article></div><button class="primary-button compact-button how-to-confirm" data-action="close-modal">ENTENDI, VAMOS JOGAR</button></section></div>`;
  }
  const { type = "", title, message, code, reaction, action = "Fechar", next = "close-modal" } = state.modal;
  const reactionImage = reaction ? REACTION_IMAGES[state.selectedCharacter]?.[reaction] : "";
  return `<div class="modal-backdrop"><section class="modal ${type} ${reactionImage ? "has-reaction" : "simple-modal"}">${reactionImage ? `<img class="reaction-character reaction-${reaction}" src="${reactionImage}" alt="Reação de ${escapeHtml(state.characters.find(item => item.id === state.selectedCharacter)?.name || "personagem")}">` : ""}<div class="reaction-content"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p>${code ? `<p class="code">${escapeHtml(code)}</p>` : ""}<button class="primary-button compact-button" data-action="${next}">${escapeHtml(action)}</button></div></section></div>`;
}

function render() {
  const views = { start: renderStart, name: renderName, characters: renderCharacters, story: renderStory, map: renderMap, stage: renderStage, instruction: renderInstruction, question: renderQuestion, finalCode: renderFinalCode, completed: renderCompleted, certificate: renderCertificate, gameOver: renderGameOver };
  const viewChanged = renderedView !== state.view;
  app.innerHTML = (views[state.view] || renderStart)() + modalHtml();
  if (!viewChanged) app.querySelector(".screen")?.classList.add("no-screen-animation");
  renderedView = state.view;
  state.newHintKey = null;
  if (state.modal?.kind === "how-to-play") requestAnimationFrame(() => app.querySelector(".modal-close-button")?.focus());
}

function renderStart() {
  return `<section class="screen hero"><div class="top-actions"><button class="icon-button how-to-button" data-action="how-to-play"><span aria-hidden="true">?</span> COMO JOGAR</button><button class="icon-button" data-action="credits">CRÉDITOS</button></div><div class="hero-logo"><div class="hero-mark">π</div><h1>DESAFIO<span>TRIGONOMÉTRICO</span></h1><p>SENO · COSSENO · TANGENTE</p></div><button class="primary-button" data-action="start">▶ INICIAR</button></section>`;
}

function renderName() {
  return `<section class="screen"><div class="panel"><h1 class="panel-title">Digite seu nome</h1><form class="name-form" id="name-form"><label for="player-name">Nome do jogador</label><input id="player-name" name="playerName" maxlength="40" autocomplete="name" value="${escapeHtml(state.playerName)}" placeholder="Como devemos chamar você?" required><button class="primary-button" type="submit">AVANÇAR</button></form></div></section>`;
}

function renderCharacters() {
  const cards = state.characters.map(character => `<button class="character-card ${state.selectedCharacter === character.id ? "selected" : ""}" data-character="${character.id}"><img src="${escapeHtml(character.image_url)}" alt="${escapeHtml(character.name)}"><span><strong>${escapeHtml(character.name)}</strong><small>${escapeHtml(character.role)}</small></span></button>`).join("");
  return `<section class="screen"><div class="panel"><h1 class="panel-title">Escolha seu personagem</h1><div class="characters">${cards}</div><div class="game-actions"><button class="primary-button" data-action="register" ${state.selectedCharacter ? "" : "disabled"}>AVANÇAR</button></div></div></section>`;
}

function renderStory() {
  const pages = storyPages();
  const page = Math.min(state.storyPage, pages.length - 1);
  const isLast = page === pages.length - 1;
  const character = state.characters.find(item => item.id === state.selectedCharacter);
  const scene = STORY_SCENES[page] || STORY_SCENES[STORY_SCENES.length - 1];
  const speaker = character?.name || "Central Trigonométrica";
  return `<section class="screen story-screen cinematic-story"><article class="story-cinematic-frame scene-${page + 1}"><img class="story-scene-image" src="${scene.image}" alt="Centro de Treinamento Trigonométrico"><div class="story-scene-shade" aria-hidden="true"></div><div class="story-scanlines" aria-hidden="true"></div><header class="story-cinematic-header"><span>TRANSMISSÃO ${page + 1} DE ${pages.length}</span><button class="story-skip-button" data-action="open-map">PULAR HISTÓRIA</button></header>${page > 0 ? `<button class="story-back-button" data-action="story-back" aria-label="Voltar para a cena anterior" title="Voltar">←</button>` : ""}${character ? `<img class="story-character" src="${escapeHtml(character.image_url)}" alt="${escapeHtml(character.name)}">` : ""}<div class="story-dialogue-wrap"><p class="screen-kicker">${scene.status}</p><h1>${scene.title}</h1><div class="story-dialogue"><strong>${escapeHtml(speaker)}</strong><p>${escapeHtml(pages[page])}</p></div><footer class="story-cinematic-footer"><div class="story-progress" aria-label="Cena ${page + 1} de ${pages.length}">${pages.map((_, index) => `<span class="${index === page ? "active" : ""}"></span>`).join("")}</div><button class="primary-button compact-button story-continue-button" data-action="${isLast ? "open-map" : "story-next"}">${isLast ? "ACEITAR MISSÃO" : "CONTINUAR →"}</button></footer></div></article></section>`;
}

function renderMap() {
  const progress = state.progress || { current_stage: 1, completed_stages: [] };
  const currentStage = currentStageFromProgress(progress);
  const unlockedCodes = progress.unlocked_codes || [];
  const chips = Array.from({ length: 5 }, (_, index) => {
    const id = index + 1;
    const done = isStageCompleted(progress, id);
    const active = id === currentStage;
    return `<div class="stage-chip ${done ? "done" : active ? "active" : ""}"><strong>FASE ${id}</strong><br><small>${done ? "CONCLUÍDA" : active ? "LIBERADA" : "BLOQUEADA"}</small></div>`;
  }).join("");
  const codeSlots = Array.from({ length: 5 }, (_, index) => `<span class="code-slot ${unlockedCodes[index] ? "unlocked" : "locked"}"><small>PARTE ${index + 1}</small><strong>${unlockedCodes[index] ? escapeHtml(unlockedCodes[index]) : "••••"}</strong></span>`).join("");
  return `<section class="screen"><div class="panel"><h1 class="panel-title">Centro de treinamento</h1><p class="lead">Complete cada sala para recuperar uma parte do código final.</p><div class="stage-map">${chips}</div><section class="code-tracker" aria-label="Partes recuperadas do código final"><p>CÓDIGO RECUPERADO</p><div>${codeSlots}</div></section><div class="game-actions"><button class="primary-button compact-button" data-action="load-stage">ENTRAR NA FASE ${currentStage}</button></div></div></section>`;
}

function renderStage() {
  return `<section class="screen"><div class="panel"><h1 class="panel-title">Fase ${state.stageId}</h1><h2 style="text-align:center">${escapeHtml(state.stage?.title)}</h2><p class="lead" style="text-align:center">${escapeHtml(state.stage?.intro)}</p><div class="game-actions"><button class="primary-button" data-action="begin-questions">COMEÇAR</button></div></div></section>`;
}

function renderInstruction() {
  const question = state.stage?.exercises?.[state.questionIndex];
  if (!question) return renderStage();
  const instruction = question.instruction || "Leia com atenção os dados da questão, identifique a relação trigonométrica adequada e compare seu resultado com as alternativas.";
  const character = state.characters.find(item => item.id === state.selectedCharacter);
  return `<section class="screen instruction-screen"><button class="corner-nav-button" data-action="open-map" aria-label="Voltar ao mapa" title="Voltar ao mapa">←</button><header class="stage-header"><span aria-hidden="true"></span><div class="stage-heading">FASE ${state.stageId}</div><div class="question-counter">QUESTÃO ${state.questionIndex + 1} DE ${state.stage.exercises.length}</div></header><article class="panel instruction-panel"><div class="instruction-copy"><p class="screen-kicker">BRIEFING DO EXERCÍCIO</p><h1 class="panel-title">Como resolver</h1><p class="instruction-text">${escapeHtml(instruction)}</p><div class="instruction-steps"><div><span>1</span><strong>LEIA</strong><small>Encontre os dados importantes.</small></div><div><span>2</span><strong>RELACIONE</strong><small>Escolha a função trigonométrica.</small></div><div><span>3</span><strong>RESOLVA</strong><small>Calcule e marque a alternativa.</small></div></div><div class="game-actions centered-main-action"><button class="primary-button compact-button" data-action="start-question">IR PARA A QUESTÃO →</button></div></div><div class="instruction-visual" aria-hidden="true"><div class="math-card"><span class="math-angle">30°</span><div class="triangle"><i></i></div><strong>sen · cos · tg</strong></div>${character ? `<img src="${escapeHtml(character.image_url)}" alt="">` : ""}</div></article></section>`;
}

function renderQuestion() {
  const question = state.stage?.exercises?.[state.questionIndex];
  if (!question) return renderStage();
  const progress = state.progress || { score: 0, wrong_answers: 0 };
  const questionHints = state.hints[question.id] || [];
  const hintCoolingDown = Date.now() < state.hintCooldownUntil;
  const answers = question.options.map(option => `<button class="answer ${state.selectedOption === option.id ? "selected" : ""}" data-option="${option.id}">${escapeHtml(option.id)}) ${escapeHtml(option.text).replace("raiz de 3", "√3")}</button>`).join("");
  const character = state.characters.find(item => item.id === state.selectedCharacter);
  const hintsHtml = questionHints.length ? `<div class="hints-list">${questionHints.map((hint, index) => {
    const isNew = state.newHintKey === `${question.id}:${index}`;
    return `<div class="hint-box ${isNew ? "new-hint" : ""}"><strong>DICA ${index + 1}:</strong> ${escapeHtml(hint)}</div>`;
  }).join("")}</div>` : "";
  return `<section class="screen question-screen"><button class="corner-nav-button" data-action="open-map" aria-label="Voltar ao mapa" title="Voltar ao mapa">←</button><button class="help-button" data-action="hint" aria-label="Pedir uma dica" title="${hintCoolingDown ? "Aguarde para pedir outra dica" : "Pedir dica"}" ${hintCoolingDown ? "disabled" : ""}>?</button><header class="stage-header"><span aria-hidden="true"></span><div class="stage-heading">FASE ${state.stageId}</div><div class="hud"><span>${progress.score || 0} PTS</span><span>${Math.max(0, 3 - (progress.wrong_answers || 0))} VIDAS</span></div></header><article class="panel"><p class="lead">${escapeHtml(state.stage.intro)}</p><h2>PERGUNTA ${state.questionIndex + 1}</h2><p class="question">${escapeHtml(question.question)}</p><div class="answers">${answers}</div>${hintsHtml}<div class="game-actions centered-main-action"><button class="primary-button pink-button" data-action="answer" ${state.selectedOption ? "" : "disabled"}>RESPONDER</button></div></article>${character ? `<img src="${escapeHtml(character.image_url)}" alt="" style="position:fixed;left:2vw;bottom:0;max-height:38vh;max-width:20vw;object-fit:contain;pointer-events:none">` : ""}</section>`;
}

function renderFinalCode() {
  const codes = state.progress?.unlocked_codes?.join(" · ") || "";
  return `<section class="screen"><div class="panel"><h1 class="panel-title">Digite o código final</h1><p class="lead" style="text-align:center">Códigos recuperados: <strong class="code">${escapeHtml(codes)}</strong></p><form id="code-form" class="name-form"><input class="code-input" name="code" placeholder="Digite a frase completa" required><button class="primary-button" type="submit">VALIDAR CÓDIGO</button></form></div></section>`;
}

function renderCompleted() {
  const classification = state.progress?.classification?.title || state.progress?.classification || "Mestre das Funções Trigonométricas";
  return `<section class="screen"><div class="panel" style="text-align:center"><h1 class="panel-title">Parabéns!</h1><p class="code">${escapeHtml(state.playerName)}</p><p>Você concluiu o Desafio Trigonométrico.</p><p>Pontuação final: <strong>${state.progress?.score || 0} pontos</strong></p><p>Classificação: <strong>${escapeHtml(classification)}</strong></p><div class="game-actions final-actions"><button class="primary-button" data-action="certificate">CERTIFICADO</button><button class="secondary-button" data-action="restart">JOGAR NOVAMENTE</button></div></div></section>`;
}

function renderCertificate() {
  const certificate = state.certificate;
  if (!certificate) return renderCompleted();
  const date = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date());
  return `<section class="screen certificate-screen"><article class="certificate" id="certificate-document"><div class="certificate-corners" aria-hidden="true"></div><div class="certificate-symbol">π</div><p class="certificate-eyebrow">CERTIFICADO DE CONCLUSÃO</p><h1>Desafio Trigonométrico</h1><p class="certificate-text">Certificamos que</p><h2>${escapeHtml(certificate.player_name)}</h2><p class="certificate-text">concluiu todas as etapas do Desafio Trigonométrico, demonstrando conhecimentos sobre seno, cosseno, tangente e funções trigonométricas.</p><div class="certificate-results"><span><small>PONTUAÇÃO</small><strong>${escapeHtml(certificate.score)} pontos</strong></span><span><small>CLASSIFICAÇÃO</small><strong>${escapeHtml(certificate.title)}</strong></span></div><p class="certificate-date">Emitido em ${escapeHtml(date)}</p><div class="certificate-signature"><span></span><strong>Desafio Trigonométrico</strong><small>Projeto educacional</small></div></article><div class="certificate-actions"><button class="secondary-button" data-action="back-completed">← VOLTAR</button><button class="primary-button" data-action="print-certificate">IMPRIMIR OU SALVAR EM PDF</button></div></section>`;
}

function renderGameOver() {
  return `<section class="screen"><div class="panel" style="text-align:center"><h1 class="panel-title">Tentativas encerradas</h1><p class="lead">Você atingiu o limite de três erros. Reinicie o progresso para tentar novamente.</p><button class="primary-button" data-action="restart">REINICIAR</button></div></section>`;
}

async function bootstrap() {
  try {
    const [overview, characters] = await Promise.all([api(""), api("/characters")]);
    state.overview = overview;
    state.characters = characters.characters?.length ? characters.characters : BACKEND_CHARACTERS;
    if (state.playerName) {
      const progress = await api(`/progress/${encodeURIComponent(state.playerName)}`);
      applyProgressRoute(progress, "map");
    }
  } catch (error) {
    notify(error.message);
  }
  render();
}

async function registerPlayer() {
  loading();
  try {
    const data = await api("/players", { method: "POST", body: JSON.stringify({ player_name: state.playerName, character_id: state.selectedCharacter }) });
    state.playerId = data.player.id;
    sessionStorage.setItem("trig-player", state.playerName);
    sessionStorage.setItem("trig-player-id", state.playerId);
    sessionStorage.setItem("trig-character", state.selectedCharacter);
    state.progress = await api(`/progress/${encodeURIComponent(state.playerName)}`);
    state.stageId = currentStageFromProgress(state.progress);
    sessionStorage.setItem("trig-stage", String(state.stageId));
    state.hints = {};
    state.hintCooldownUntil = 0;
    state.storyPage = 0;
    const hasProgress = state.stageId > 1 || state.progress.completed_stages?.length > 0 || state.progress.answered_questions?.length > 0;
    state.view = hasProgress ? "map" : "story";
  } catch (error) { notify(error.message); state.view = "characters"; }
  render();
}

async function loadStage() {
  loading();
  try {
    state.progress = await api(`/progress/${encodeURIComponent(state.playerName)}`);
    if (state.progress.game_over) {
      state.view = "gameOver";
    } else if (state.progress.awaiting_final_code) {
      state.view = "finalCode";
    } else {
      state.stageId = currentStageFromProgress(state.progress);
      sessionStorage.setItem("trig-stage", String(state.stageId));
      state.stage = await api(`/stages/${state.stageId}`);
      const nextQuestion = nextUnansweredIndex(state.stage.exercises, state.progress);
      if (nextQuestion < 0) {
        state.stage = null;
        state.view = "map";
        notify("Esta fase já foi concluída. Seu progresso foi atualizado.");
      } else {
        state.questionIndex = nextQuestion;
        state.view = "stage";
      }
    }
  } catch (error) { notify(error.message); state.view = "map"; }
  render();
}

async function useHint() {
  const question = state.stage.exercises[state.questionIndex];
  if (Date.now() < state.hintCooldownUntil) return;
  state.hintCooldownUntil = Date.now() + 3000;
  const hintButton = app.querySelector('[data-action="hint"]');
  if (hintButton) {
    hintButton.disabled = true;
    hintButton.title = "Aguarde para pedir outra dica";
  }
  clearTimeout(useHint.cooldownTimer);
  useHint.cooldownTimer = setTimeout(() => {
    state.hintCooldownUntil = 0;
    const currentButton = app.querySelector('[data-action="hint"]');
    if (state.view === "question" && currentButton) {
      currentButton.disabled = false;
      currentButton.title = "Pedir dica";
    }
  }, 3050);
  try {
    const data = await api("/hint", { method: "POST", body: JSON.stringify({ player_name: state.playerName, question_id: question.id }) });
    if (data.hint) {
      const savedHints = state.hints[question.id] || [];
      if (!savedHints.includes(data.hint)) {
        state.hints[question.id] = [...savedHints, data.hint];
        state.newHintKey = `${question.id}:${savedHints.length}`;
        render();
      } else {
        notify("Esta dica já está visível.");
      }
    } else if (data.message) {
      notify(data.message);
    }
  } catch (error) { notify(error.message); }
}

async function answerQuestion() {
  if (state.answerPending) return;
  state.answerPending = true;
  const question = state.stage.exercises[state.questionIndex];
  const selectedOption = state.selectedOption;
  loading();
  try {
    const data = await api("/answer", { method: "POST", body: JSON.stringify({ player_name: state.playerName, question_id: question.id, selected_option: selectedOption }) });
    state.progress = data.progress;
    if (state.progress?.game_over) {
      state.view = "gameOver";
    } else if (typeof data.correct !== "boolean" && isQuestionAnswered(state.progress, question.id)) {
      state.modal = null;
      if (state.progress.awaiting_final_code) {
        state.view = "finalCode";
      } else {
        const nextQuestion = nextUnansweredIndex(state.stage?.exercises, state.progress, state.questionIndex + 1);
        if (nextQuestion >= 0) {
          state.questionIndex = nextQuestion;
          state.view = "instruction";
          notify("Progresso sincronizado. Continuando na próxima questão.");
        } else {
          state.stage = null;
          state.view = "map";
          notify("Fase concluída. Progresso atualizado.");
        }
      }
    } else if (data.correct === false) {
      const feedback = data.feedback || data.message || "Essa alternativa não está correta. Tente novamente.";
      const attemptsText = Number.isFinite(data.remaining_errors) ? ` Restam ${data.remaining_errors} tentativas.` : "";
      state.modal = { type: "error", reaction: "sad", title: "Resposta incorreta", message: `${feedback}${attemptsText}`, action: "TENTAR NOVAMENTE" };
    } else if (data.stage_completed) {
      const feedback = data.feedback || data.message || "Resposta correta!";
      state.modal = { type: "success", reaction: "happy", title: `Fase ${state.stageId} concluída`, message: `${feedback} ${state.stage.success_message || ""}`.trim(), code: `Código: ${data.code_received}`, action: data.awaiting_final_code ? "CÓDIGO FINAL" : "PRÓXIMA FASE", next: data.awaiting_final_code ? "go-final" : "next-stage" };
    } else {
      const feedback = data.feedback || data.message || "Resposta correta!";
      state.modal = { type: "success", reaction: "happy", title: "Resposta correta", message: `${feedback} Você ganhou ${data.earned_points} pontos.`, action: "PRÓXIMA PERGUNTA", next: "next-question" };
    }
  } catch (error) { notify(error.message); }
  state.answerPending = false;
  state.selectedOption = null;
  render();
}

async function validateCode(code) {
  loading();
  try {
    const data = await api("/final-code", { method: "POST", body: JSON.stringify({ player_name: state.playerName, code }) });
    state.progress = data.progress;
    if (data.valid) state.view = "completed";
    else { state.view = "finalCode"; state.modal = { type: "error", title: "Código incorreto", message: data.message, action: "CORRIGIR" }; }
  } catch (error) { state.view = "finalCode"; notify(error.message); }
  render();
}

async function restart() {
  loading();
  try {
    const path = state.playerId ? `/players/${encodeURIComponent(state.playerId)}/restart` : "/restart";
    const options = state.playerId ? { method: "POST" } : { method: "POST", body: JSON.stringify({ player_name: state.playerName }) };
    const data = await api(path, options);
    state.progress = data.progress;
    state.hints = {};
    state.hintCooldownUntil = 0;
    state.stageId = 1;
    sessionStorage.setItem("trig-stage", "1");
    state.view = "map";
  } catch (error) { notify(error.message); state.view = "start"; }
  render();
}

async function loadCertificate() {
  loading();
  try {
    const path = state.playerId
      ? `/players/${encodeURIComponent(state.playerId)}/certificate`
      : `/certificate/${encodeURIComponent(state.playerName)}`;
    const data = await api(path);
    state.certificate = data.certificate;
    state.view = "certificate";
  } catch (error) {
    state.view = "completed";
    notify(error.message);
  }
  render();
}

app.addEventListener("click", async event => {
  if (event.target.matches("[data-modal-backdrop]")) { state.modal = null; render(); return; }
  const character = event.target.closest("[data-character]");
  if (character) { state.selectedCharacter = Number(character.dataset.character); render(); return; }
  const option = event.target.closest("[data-option]");
  if (option) { state.selectedOption = option.dataset.option; render(); return; }
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (!action) return;
  const now = performance.now();
  if (lastAction.name === action && now - lastAction.time < 500) return;
  lastAction = { name: action, time: now };
  if (action === "start") { state.view = "name"; render(); }
  if (action === "how-to-play") { state.modal = { kind: "how-to-play" }; render(); }
  if (action === "credits") { state.modal = { title: "Créditos", message: "Jogo educativo desenvolvido como projeto de trigonometria. Design e programação integrados à API Flask.", action: "FECHAR" }; render(); }
  if (action === "register") await registerPlayer();
  if (action === "story-next") { state.storyPage = Math.min(storyPages().length - 1, state.storyPage + 1); render(); }
  if (action === "story-back") { state.storyPage = Math.max(0, state.storyPage - 1); render(); }
  if (action === "open-map") await openMap();
  if (action === "load-stage") await loadStage();
  if (action === "begin-questions") { state.view = "instruction"; render(); }
  if (action === "start-question") { state.view = "question"; render(); }
  if (action === "hint") await useHint();
  if (action === "answer") await answerQuestion();
  if (action === "close-modal") { state.modal = null; render(); }
  if (action === "next-question") await continueAfterAnswer();
  if (action === "next-stage") await openMap();
  if (action === "go-final") { state.modal = null; state.view = "finalCode"; render(); }
  if (action === "restart") await restart();
  if (action === "certificate") await loadCertificate();
  if (action === "print-certificate") window.print();
  if (action === "back-completed") { state.view = "completed"; render(); }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && state.modal) {
    state.modal = null;
    render();
  }
});

app.addEventListener("submit", event => {
  event.preventDefault();
  const form = new FormData(event.target);
  if (event.target.id === "name-form") {
    state.playerName = String(form.get("playerName") || "").trim();
    if (state.playerName.length < 2) return notify("Digite um nome com pelo menos dois caracteres.");
    state.view = "characters";
    render();
  }
  if (event.target.id === "code-form") validateCode(String(form.get("code") || ""));
});

bootstrap();
