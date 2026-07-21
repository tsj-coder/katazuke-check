// 単発テスト(学校の片づけ術)。学習コード・進捗保存なし。
// lastTestIds だけを画面内で持ち回り、「別の類題でもう一度」を実現する。
import { buildTest, gradeTest, emptyProgress } from './quiz-engine.js';

const $ = (id) => document.getElementById(id);

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

async function init() {
  state.questions = await (await fetch('questions/katazuke.json')).json();
  $('btn-start').addEventListener('click', start);
  $('btn-next').addEventListener('click', next);
  $('btn-again').addEventListener('click', start);
  $('btn-top').addEventListener('click', () => show('screen-start'));
  show('screen-start');
}

function start() {
  const progress = { ...emptyProgress(), lastTestIds: state.lastTestIds };
  state.test = buildTest({ questions: state.questions, progress, unit: 0 });
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
