const STORAGE_KEY = 'better-tv5monde-tcf-progress-v1';

const state = {
  data: null,
  lot: null,
  question: null,
  selections: new Map(),
};

const els = {
  lotSelect: document.querySelector('#lotSelect'),
  questionSelect: document.querySelector('#questionSelect'),
  questionMeta: document.querySelector('#questionMeta'),
  skillMeta: document.querySelector('#skillMeta'),
  questionTitle: document.querySelector('#questionTitle'),
  instruction: document.querySelector('#instruction'),
  imageBlock: document.querySelector('#imageBlock'),
  questionImage: document.querySelector('#questionImage'),
  audioBlock: document.querySelector('#audioBlock'),
  audio: document.querySelector('#audio'),
  audioLink: document.querySelector('#audioLink'),
  sourceLink: document.querySelector('#sourceLink'),
  answers: document.querySelector('#answers'),
  feedback: document.querySelector('#feedback'),
  nextButton: document.querySelector('#nextButton'),
  modelMeta: document.querySelector('#modelMeta'),
  transcriptDetails: document.querySelector('#transcriptDetails'),
  transcript: document.querySelector('#transcript'),
  currentResult: document.querySelector('#currentResult'),
  testProgress: document.querySelector('#testProgress'),
  resetProgressButton: document.querySelector('#resetProgressButton'),
};

init().catch((error) => {
  console.error(error);
  els.questionTitle.textContent = 'Failed to load TCF data';
  els.transcript.textContent = String(error?.message || error);
});

async function init() {
  const response = await fetch('./data/tcf-lots.json');
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

  state.data = await response.json();
  state.selections = loadSelections();
  state.lot = state.data.lots[0];
  state.question = state.lot.questions[0];

  fillLotSelect();
  fillQuestionSelect();
  render();

  els.lotSelect.addEventListener('change', () => {
    state.lot = state.data.lots.find((lot) => lot.id === els.lotSelect.value);
    state.question = state.lot.questions[0];
    fillQuestionSelect();
    render();
  });

  els.questionSelect.addEventListener('change', () => {
    state.question = state.lot.questions.find((question) => String(question.number) === els.questionSelect.value);
    render();
  });

  els.nextButton.addEventListener('click', goToNextQuestion);
  els.resetProgressButton.addEventListener('click', resetProgress);
}

function fillLotSelect() {
  els.lotSelect.replaceChildren(
    ...state.data.lots.map((lot) => new Option(`${lot.title}`, lot.id)),
  );
  els.lotSelect.value = state.lot.id;
}

function fillQuestionSelect() {
  els.questionSelect.replaceChildren(
    ...state.lot.questions.map((question) => {
      const hasAudio = question.audioUrl ? '🎧 ' : '';
      const answered = getSelectedCode(question) ? '✓ ' : '';
      return new Option(`${answered}${hasAudio}Question ${question.number}`, String(question.number));
    }),
  );
  els.questionSelect.value = String(state.question.number);
}

function render() {
  const lot = state.lot;
  const question = state.question;

  els.questionMeta.textContent = `${question.skill} · question ${question.number}`;
  els.skillMeta.textContent = `${question.skill}`;
  els.questionTitle.textContent = question.prompt || `Question ${question.number}`;
  els.instruction.textContent = question.instruction || '';
  els.sourceLink.href = lot.sourceUrl;

  if (question.imageUrl) {
    els.questionImage.src = question.imageUrl;
    els.imageBlock.hidden = false;
  } else {
    els.questionImage.removeAttribute('src');
    els.imageBlock.hidden = true;
  }

  if (question.audioUrl) {
    els.audio.src = question.audioUrl;
    els.audioLink.href = question.audioUrl;
    els.audioBlock.hidden = false;
  } else {
    els.audio.removeAttribute('src');
    els.audioBlock.hidden = true;
  }

  renderAnswers(question);
  renderTranscript(question);
  renderProgress();
  updateNextButton();
}

function renderAnswers(question) {
  const selectedCode = getSelectedCode(question);
  const answered = Boolean(selectedCode);

  els.answers.replaceChildren(
    ...question.answers.map((answer) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = answerClass(answer, selectedCode);
      button.setAttribute('aria-pressed', String(answer.code === selectedCode));
      button.addEventListener('click', () => selectAnswer(question, answer.code));

      const code = document.createElement('strong');
      code.textContent = answer.code;

      const text = document.createElement('span');
      text.textContent = answer.text;

      button.append(code, text);

      if (answered && answer.correct) {
        const badge = document.createElement('em');
        badge.textContent = 'Correct answer';
        button.append(badge);
      } else if (answered && answer.code === selectedCode && !answer.correct) {
        const badge = document.createElement('em');
        badge.textContent = 'Your answer';
        button.append(badge);
      }

      return button;
    }),
  );

  renderFeedback(question, selectedCode);
}

function answerClass(answer, selectedCode) {
  const classes = ['answer'];
  if (!selectedCode) return classes.join(' ');
  if (answer.correct) classes.push('correct');
  if (answer.code === selectedCode) classes.push('selected');
  if (answer.code === selectedCode && !answer.correct) classes.push('incorrect');
  return classes.join(' ');
}

function selectAnswer(question, code) {
  state.selections.set(selectionKey(question), code);
  saveSelections();
  fillQuestionSelect();
  renderAnswers(question);
  renderProgress();
  updateNextButton();
}

function renderFeedback(question, selectedCode) {
  if (!selectedCode) {
    els.feedback.textContent = 'Choose an answer to reveal the correct option.';
    els.feedback.className = 'feedback muted';
    return;
  }

  const selected = question.answers.find((answer) => answer.code === selectedCode);
  if (selected?.correct) {
    els.feedback.textContent = `Correct — ${selectedCode}.`;
    els.feedback.className = 'feedback correct';
  } else {
    els.feedback.textContent = `Not quite. Correct answer: ${question.correctAnswer}.`;
    els.feedback.className = 'feedback incorrect';
  }
}

function renderTranscript(question) {
  els.transcriptDetails.open = false;
  const tx = question.transcription;
  if (!tx?.text) {
    els.modelMeta.textContent = 'Transcript unavailable';
    els.transcript.textContent = 'No transcript is available for this question.';
    return;
  }

  els.modelMeta.textContent = `Transcript · ${tx.model}`;
  els.transcript.replaceChildren(...splitTranscript(tx.text).map((part) => {
    const p = document.createElement('p');
    p.textContent = part;
    return p;
  }));
}

function renderProgress() {
  const currentStats = getLotStats(state.lot);
  const completeText = currentStats.completed
    ? `Result for ${state.lot.title}: ${currentStats.correct}/${currentStats.total} correct (${currentStats.percent}%).`
    : `${state.lot.title}: ${currentStats.answered}/${currentStats.total} questions answered. Result will appear after all ${currentStats.total} questions.`;

  els.currentResult.textContent = completeText;
  els.currentResult.className = currentStats.completed ? 'result-summary complete' : 'result-summary';

  els.testProgress.replaceChildren(
    ...state.data.lots.map((lot) => {
      const stats = getLotStats(lot);
      const item = document.createElement('button');
      item.type = 'button';
      item.className = progressClass(lot, stats);
      item.setAttribute('role', 'listitem');
      item.addEventListener('click', () => selectLot(lot.id));

      const title = document.createElement('strong');
      title.textContent = lot.title;

      const status = document.createElement('span');
      status.textContent = progressStatus(stats);

      item.append(title, status);
      return item;
    }),
  );
}

function progressClass(lot, stats) {
  const classes = ['progress-pill'];
  if (lot.id === state.lot.id) classes.push('current');
  if (stats.completed) classes.push('completed');
  else if (stats.answered > 0) classes.push('started');
  return classes.join(' ');
}

function progressStatus(stats) {
  if (stats.completed) return `Done · ${stats.correct}/${stats.total} (${stats.percent}%)`;
  if (stats.answered > 0) return `In progress · ${stats.answered}/${stats.total}`;
  return 'Not started';
}

function getLotStats(lot) {
  const total = lot.questions.length;
  const answered = lot.questions.filter((question) => getSelectedCode(question, lot)).length;
  const correct = lot.questions.filter((question) => isCorrectSelection(question, lot)).length;
  const completed = answered === total;
  const percent = total === 0 ? 0 : Math.round((correct / total) * 100);

  return { total, answered, correct, completed, percent };
}

function isCorrectSelection(question, lot = state.lot) {
  const selectedCode = getSelectedCode(question, lot);
  if (!selectedCode) return false;
  return question.answers.some((answer) => answer.code === selectedCode && answer.correct);
}

function selectLot(lotId) {
  state.lot = state.data.lots.find((lot) => lot.id === lotId);
  state.question = state.lot.questions[0];
  els.lotSelect.value = state.lot.id;
  fillQuestionSelect();
  render();
  scrollQuestionMetaIntoView();
}

function goToNextQuestion() {
  const questions = state.lot.questions;
  const index = questions.findIndex((question) => question.number === state.question.number);
  const next = questions[(index + 1) % questions.length];
  state.question = next;
  els.questionSelect.value = String(next.number);
  render();
  scrollQuestionMetaIntoView();
}

function scrollQuestionMetaIntoView() {
  els.questionMeta.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function updateNextButton() {
  const questions = state.lot.questions;
  const index = questions.findIndex((question) => question.number === state.question.number);
  const stats = getLotStats(state.lot);
  if (index === questions.length - 1 && stats.completed) {
    els.nextButton.textContent = 'Review from question 1';
  } else {
    els.nextButton.textContent = index === questions.length - 1 ? 'Back to question 1' : 'Next question';
  }
}

function getSelectedCode(question, lot = state.lot) {
  return state.selections.get(selectionKey(question, lot));
}

function selectionKey(question, lot = state.lot) {
  return `${lot.id}:${question.number}`;
}

function loadSelections() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return new Map();
    return new Map(Object.entries(parsed).filter(([, value]) => typeof value === 'string'));
  } catch (error) {
    console.warn('Could not load saved progress', error);
    return new Map();
  }
}

function saveSelections() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(state.selections)));
  } catch (error) {
    console.warn('Could not save progress', error);
  }
}

function resetProgress() {
  const confirmed = window.confirm('Clear all locally saved answers and progress?');
  if (!confirmed) return;

  state.selections.clear();
  localStorage.removeItem(STORAGE_KEY);
  fillQuestionSelect();
  render();
}

function splitTranscript(text) {
  return text
    .replace(/\s+(?=(?:A|B|C|D)\.\s)/g, '\n')
    .replace(/\s+(?=(?:Écoutez|Choisissez|Quand|Quelle|Pourquoi|Selon|De quoi|A quoi)\b)/g, '\n')
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
}
