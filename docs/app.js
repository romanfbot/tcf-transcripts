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
  transcript: document.querySelector('#transcript'),
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
      return new Option(`${hasAudio}Question ${question.number}`, String(question.number));
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
  renderAnswers(question);
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
  els.nextButton.textContent = index === questions.length - 1 ? 'Back to question 1' : 'Next question';
}

function getSelectedCode(question) {
  return state.selections.get(selectionKey(question));
}

function selectionKey(question) {
  return `${state.lot.id}:${question.number}`;
}

function splitTranscript(text) {
  return text
    .replace(/\s+(?=(?:A|B|C|D)\.\s)/g, '\n')
    .replace(/\s+(?=(?:Écoutez|Choisissez|Quand|Quelle|Pourquoi|Selon|De quoi|A quoi)\b)/g, '\n')
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
}
