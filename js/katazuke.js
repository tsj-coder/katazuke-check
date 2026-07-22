// 単発テスト(学校の片づけ術)。学習コード・進捗保存なし。
// lastTestIds だけを画面内で持ち回り、「別の類題でもう一度」を実現する。
//
// 合言葉画面はクライアント側チェックのみで、真の意味でのアクセス制限ではない
// (ソースを見れば合言葉も問題データも読める)。検索エンジン避け(noindex)と
// 「講演会に参加した人だけに合言葉を伝える」運用を前提にした簡易的な入口。
import { buildTest, gradeTest, emptyProgress, shuffleChoices } from './quiz-engine.js';

const $ = (id) => document.getElementById(id);
const GATE_PASSWORD = 'kensyu2026';
const GATE_SESSION_KEY = 'kz2-gate-unlocked';

const state = {
  questions: [],
  lastTestIds: [],
  test: null,
  answers: [],
};

function show(id) {
  for (const s of document.querySelectorAll('main > section')) s.hidden = (s.id !== id);
  window.scrollTo(0, 0);
}

function init() {
  $('btn-gate').addEventListener('click', tryUnlock);
  $('gate-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') tryUnlock(); });
  $('btn-start').addEventListener('click', start);
  $('btn-next').addEventListener('click', next);
  $('btn-again').addEventListener('click', start);
  $('btn-top').addEventListener('click', () => show('screen-start'));

  if (sessionStorage.getItem(GATE_SESSION_KEY) === '1') {
    loadQuiz();
  } else {
    show('screen-gate');
  }
}

function tryUnlock() {
  $('gate-error').hidden = true;
  const input = $('gate-input').value.trim();
  if (input === GATE_PASSWORD) {
    sessionStorage.setItem(GATE_SESSION_KEY, '1');
    loadQuiz();
  } else {
    $('gate-error').textContent = '合言葉が違います。講演会でご案内した合言葉をご確認ください。';
    $('gate-error').hidden = false;
  }
}

async function loadQuiz() {
  if (state.questions.length === 0) {
    state.questions = await (await fetch('questions/katazuke.json')).json();
  }
  show('screen-start');
}

function start() {
  const progress = { ...emptyProgress(), lastTestIds: state.lastTestIds };
  const built = buildTest({ questions: state.questions, progress, unit: 0 });
  const items = built.items.map((item) => ({ ...item, question: shuffleChoices(item.question) }));
  state.test = { unit: built.unit, items };
  state.answers = [];
  renderQuestion();
  show('screen-test');
}

function renderQuestion() {
  const i = state.answers.length;
  const { question } = state.test.items[i];
  $('test-progress').textContent = `問 ${i + 1} / ${state.test.items.length}`;
  $('q-badge').textContent = `【${question.domain}】`;
  $('q-text').textContent = question.text;
  const box = $('q-choices');
  box.innerHTML = '';
  question.choices.forEach((c, idx) => {
    const b = document.createElement('button');
    b.className = 'choice';
    b.textContent = c;
    b.addEventListener('click', () => answer(idx));
    box.appendChild(b);
  });
  $('q-feedback').hidden = true;
}

function answer(idx) {
  const i = state.answers.length;
  const { question } = state.test.items[i];
  state.answers.push(idx);
  const correct = idx === question.answer;
  [...document.querySelectorAll('.choice')].forEach((b, bi) => {
    b.disabled = true;
    if (bi === question.answer) b.classList.add('correct');
    else if (bi === idx) b.classList.add('wrong');
  });
  $('q-verdict').textContent = correct ? '⭕ 正解!' : '❌ 不正解';
  $('q-explanation').textContent = question.explanation;
  $('q-reference').textContent = question.reference ? `出典: ${question.reference}` : '';
  $('btn-next').textContent =
    state.answers.length < state.test.items.length ? '次へ' : '結果を見る';
  $('q-feedback').hidden = false;
}

function next() {
  if (state.answers.length < state.test.items.length) {
    renderQuestion();
    return;
  }
  finish();
}

function finish() {
  const grade = gradeTest(state.test.items, state.answers);
  state.lastTestIds = grade.results.map((r) => r.id);
  const rate = grade.newCorrect / grade.newTotal;
  $('result-verdict').textContent =
    rate >= 0.8 ? '🎉 すばらしい! 片づけ術はバッチリです'
      : rate >= 0.5 ? 'あと少し! 間違えた論点を復習しましょう'
        : 'まずは「整理→収納」の順番から復習しましょう';
  $('result-score').textContent = `${grade.newCorrect} / ${grade.newTotal} 問正解`;
  renderDomains(grade);
  show('screen-result');
}

function renderDomains(grade) {
  const box = $('result-domains');
  box.innerHTML = '';
  const byDomain = {};
  for (const r of grade.results) {
    const d = (byDomain[r.domain] ??= { asked: 0, correct: 0 });
    d.asked += 1;
    if (r.correct) d.correct += 1;
  }
  const h = document.createElement('h2');
  h.textContent = '分野別の結果';
  box.appendChild(h);
  for (const [domain, s] of Object.entries(byDomain)) {
    const p = document.createElement('p');
    p.textContent = `${domain}: ${s.correct} / ${s.asked} 正解`;
    box.appendChild(p);
  }
}

init();
