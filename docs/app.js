const state = {
  data: null,
  selectedTest: null,
  selectedTask: null,
};

const els = {
  testSelect: document.querySelector('#testSelect'),
  taskSelect: document.querySelector('#taskSelect'),
  taskMeta: document.querySelector('#taskMeta'),
  taskTitle: document.querySelector('#taskTitle'),
  transcript: document.querySelector('#transcript'),
  audioLink: document.querySelector('#audioLink'),
  sourcePage: document.querySelector('#sourcePage'),
  sourcePdf: document.querySelector('#sourcePdf'),
};

init().catch((error) => {
  console.error(error);
  els.taskTitle.textContent = 'Не удалось загрузить транскрипты';
  els.transcript.textContent = String(error?.message || error);
});

async function init() {
  const response = await fetch('./data/transcripts.json');
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

  state.data = await response.json();
  state.selectedTest = state.data.tests[0];
  state.selectedTask = state.selectedTest.tasks[0];

  fillTestSelect();
  fillTaskSelect();
  render();

  els.testSelect.addEventListener('change', () => {
    state.selectedTest = state.data.tests.find((test) => test.id === els.testSelect.value);
    state.selectedTask = state.selectedTest.tasks[0];
    fillTaskSelect();
    render();
  });

  els.taskSelect.addEventListener('change', () => {
    state.selectedTask = state.selectedTest.tasks.find((task) => task.id === els.taskSelect.value);
    render();
  });
}

function fillTestSelect() {
  els.testSelect.replaceChildren(
    ...state.data.tests.map((test) => new Option(`Тест ${test.number} — ${test.title}`, test.id)),
  );
  els.testSelect.value = state.selectedTest.id;
}

function fillTaskSelect() {
  els.taskSelect.replaceChildren(
    ...state.selectedTest.tasks.map((task) => {
      const label = task.kind === 'intro' ? task.number : `Задание ${task.number}`;
      return new Option(`${label} — ${task.title}`, task.id);
    }),
  );
  els.taskSelect.value = state.selectedTask.id;
}

function render() {
  const test = state.selectedTest;
  const task = state.selectedTask;

  els.taskMeta.textContent = task.kind === 'intro'
    ? `Тест ${test.number} · вступление`
    : `Тест ${test.number} · задание ${task.number}`;
  els.taskTitle.textContent = task.title;
  els.transcript.replaceChildren(...paragraphs(task.text));

  els.audioLink.href = test.audioUrl || state.data.source.audio;
  els.sourcePage.href = state.data.source.page;
  els.sourcePdf.href = state.data.source.pdf;
}

function paragraphs(text) {
  return splitTranscript(text).map((part) => {
    const p = document.createElement('p');
    p.textContent = part;
    return p;
  });
}

function splitTranscript(text) {
  return text
    .replace(/\s+(?=(?:A|B|C|D)\.\s)/g, '\n')
    .replace(/\s+(?=(?:Question|Regardez|Écoutez)\b)/g, '\n')
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
}
