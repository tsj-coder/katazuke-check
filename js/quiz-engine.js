// 出題・採点・進捗更新の純関数モジュール。ブラウザと node --test の両方から使う。

export function emptyProgress() {
  return { unitCleared: 0, weakQueue: [], domainStats: {}, lastTestIds: [] };
}

const REVIEW_MAX = 3;

export function buildTest({ questions, progress, unit, pick = defaultPick }) {
  const unitQuestions = questions.filter((q) => q.unit === unit);
  const groups = [...new Set(unitQuestions.map((q) => q.group))];

  const newItems = groups.map((group) => {
    const variants = unitQuestions.filter((q) => q.group === group);
    const fresh = variants.filter((q) => !progress.lastTestIds.includes(q.id));
    const pool = fresh.length > 0 ? fresh : variants;
    return { question: pick(pool), isReview: false };
  });

  const currentGroups = new Set(groups);
  const reviewItems = [];
  for (const entry of progress.weakQueue) {
    if (reviewItems.length >= REVIEW_MAX) break;
    if (currentGroups.has(entry.group)) continue;
    const variants = questions.filter((q) => q.group === entry.group);
    if (variants.length === 0) continue;
    const fresh = variants.filter((q) => q.id !== entry.lastShownId);
    const pool = fresh.length > 0 ? fresh : variants;
    reviewItems.push({ question: pick(pool), isReview: true });
  }

  return { unit, items: [...newItems, ...reviewItems] };
}

function defaultPick(pool) {
  return pool[Math.floor(Math.random() * pool.length)];
}

export function gradeTest(items, answers) {
  const results = items.map(({ question, isReview }, i) => ({
    id: question.id,
    group: question.group,
    domain: question.domain,
    isReview,
    chosen: answers[i],
    correct: answers[i] === question.answer,
  }));
  const newResults = results.filter((r) => !r.isReview);
  const newCorrect = newResults.filter((r) => r.correct).length;
  const newTotal = newResults.length;
  const passed = newTotal > 0 && newCorrect >= Math.ceil(newTotal * 0.8);
  return { results, newCorrect, newTotal, passed };
}

export function updateProgress(progress, grade, unit, today = isoToday()) {
  const weakQueue = progress.weakQueue.map((e) => ({ ...e }));
  const domainStats = {};
  for (const [domain, s] of Object.entries(progress.domainStats)) {
    domainStats[domain] = { ...s };
  }

  for (const r of grade.results) {
    const stats = domainStats[r.domain] ?? { asked: 0, correct: 0 };
    stats.asked += 1;
    if (r.correct) stats.correct += 1;
    domainStats[r.domain] = stats;

    const idx = weakQueue.findIndex((e) => e.group === r.group);
    if (r.correct) {
      if (idx !== -1) weakQueue.splice(idx, 1);
    } else if (idx === -1) {
      weakQueue.push({ group: r.group, misses: 1, since: today, lastShownId: r.id });
    } else {
      weakQueue[idx].misses += 1;
      weakQueue[idx].lastShownId = r.id;
    }
  }

  return {
    unitCleared: grade.passed ? Math.max(progress.unitCleared, unit) : progress.unitCleared,
    weakQueue,
    domainStats,
    lastTestIds: grade.results.map((r) => r.id),
  };
}

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}
