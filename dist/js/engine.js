// Original Sudoku engine. No network services or runtime dependencies.
export const ALL = 0x3fe;
export const digits = mask => Array.from({length: 9}, (_, i) => i + 1).filter(n => mask & (1 << n));
export const countBits = mask => { let n = 0; while (mask) { mask &= mask - 1; n++; } return n; };
export const row = i => Math.floor(i / 9);
export const col = i => i % 9;
export const box = i => Math.floor(row(i) / 3) * 3 + Math.floor(col(i) / 3);
export const UNITS = [
  ...Array.from({length: 9}, (_, r) => Array.from({length: 9}, (_, c) => r * 9 + c)),
  ...Array.from({length: 9}, (_, c) => Array.from({length: 9}, (_, r) => r * 9 + c)),
  ...Array.from({length: 9}, (_, b) => Array.from({length: 9}, (_, j) => (Math.floor(b / 3) * 3 + Math.floor(j / 3)) * 9 + b % 3 * 3 + j % 3))
];
export const PEERS = Array.from({length: 81}, (_, i) => [...new Set(UNITS.filter(u => u.includes(i)).flat())].filter(j => j !== i));
export const LEVELS = [
  {id: 'beginner', name: 'Начальный', subtitle: 'Освоиться с полем и кандидатами', rank: 1},
  {id: 'easy', name: 'Легкий', subtitle: 'Одиночные кандидаты', rank: 1},
  {id: 'normal', name: 'Средний', subtitle: 'Скрытые одиночки', rank: 2},
  {id: 'hard', name: 'Сложный', subtitle: 'Пересечения, пары и тройки', rank: 4},
  {id: 'expert', name: 'Эксперт', subtitle: 'X-Wing и комбинации приемов', rank: 5},
  {id: 'master', name: 'Мастер', subtitle: 'Крылья, рыбы и более глубокий анализ', rank: 6},
  {id: 'extreme', name: 'Максимальный', subtitle: 'Глубокий анализ и цепочки', rank: 7}
];
export function parseGrid(text) {
  if (typeof text !== 'string' || !/^[0-9.]{81}$/.test(text)) throw new Error('Invalid puzzle');
  return [...text].map(c => c === '.' ? 0 : Number(c));
}
export function validGrid(grid) {
  return Array.isArray(grid) && grid.length === 81 && grid.every(n => Number.isInteger(n) && n >= 0 && n <= 9);
}
export function conflicts(grid) {
  const out = new Set();
  for (const u of UNITS) {
    const seen = new Map();
    for (const i of u) if (grid[i]) {
      if (seen.has(grid[i])) { out.add(i); out.add(seen.get(grid[i])); }
      else seen.set(grid[i], i);
    }
  }
  return out;
}
export function candidateMask(grid, i) {
  if (grid[i]) return 0;
  let mask = ALL;
  for (const j of PEERS[i]) mask &= ~(1 << grid[j]);
  return mask;
}
export function allCandidates(grid) { return grid.map((_, i) => candidateMask(grid, i)); }
export function isComplete(grid) { return validGrid(grid) && grid.every(Boolean) && conflicts(grid).size === 0; }
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function shuffle(a, random) {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
// Search is used for uniqueness and explicitly labeled reveals, never to fabricate a logical hint.
export function solve(grid, {limit = 2, random = null, maxNodes = 2000000} = {}) {
  if (!validGrid(grid) || conflicts(grid).size) return {count: 0, solution: null, nodes: 0, branches: 0, depth: 0, exhausted: false};
  const g = [...grid], rows = Array(9).fill(0), cols = Array(9).fill(0), boxes = Array(9).fill(0);
  for (let i = 0; i < 81; i++) if (g[i]) { const bit = 1 << g[i]; rows[row(i)] |= bit; cols[col(i)] |= bit; boxes[box(i)] |= bit; }
  let count = 0, solution = null, nodes = 0, branches = 0, depth = 0, exhausted = false;
  function walk(branchDepth) {
    if (count >= limit || exhausted) return;
    if (++nodes > maxNodes) { exhausted = true; return; }
    let at = -1, mask = 0, fewest = 10;
    for (let i = 0; i < 81; i++) if (!g[i]) {
      const m = ALL & ~(rows[row(i)] | cols[col(i)] | boxes[box(i)]), size = countBits(m);
      if (!size) return;
      if (size < fewest) { at = i; mask = m; fewest = size; if (size === 1) break; }
    }
    if (at === -1) { count++; solution ??= [...g]; return; }
    const d = branchDepth + (fewest > 1 ? 1 : 0); depth = Math.max(depth, d);
    if (fewest > 1) branches++;
    const r = row(at), c = col(at), b = box(at);
    const options = random ? shuffle(digits(mask), random) : digits(mask);
    for (const n of options) {
      const bit = 1 << n; g[at] = n; rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
      walk(d);
      g[at] = 0; rows[r] &= ~bit; cols[c] &= ~bit; boxes[b] &= ~bit;
      if (count >= limit || exhausted) break;
    }
  }
  walk(0);
  return {count, solution, nodes, branches, depth, exhausted};
}
function combinations(items, n) {
  const out = [];
  function run(start, part) {
    if (part.length === n) { out.push(part); return; }
    for (let i = start; i <= items.length - n + part.length; i++) run(i + 1, [...part, items[i]]);
  }
  run(0, []); return out;
}
const cellName = i => `строка ${row(i) + 1}, столбец ${col(i) + 1}`;
const unitName = u => u < 9 ? `строке ${u + 1}` : u < 18 ? `столбце ${u - 8}` : `блоке ${u - 17}`;
function elimination(type, rank, cells, changes, text) {
  return changes.length ? {type, rank, cells, changes, text, kind: 'eliminate'} : null;
}
export function logicalStep(grid, candidates = allCandidates(grid), maxRank = 6) {
  const m = candidates.map((v, i) => v & candidateMask(grid, i));
  for (let i = 0; i < 81; i++) if (!grid[i] && countBits(m[i]) === 1) {
    const value = digits(m[i])[0];
    return {type: 'Единственный кандидат', rank: 1, kind: 'place', index: i, value, cells: [i], text: `В клетке (${cellName(i)}) остается только ${value}. Остальные цифры уже заняты в ее строке, столбце или блоке, либо исключены предыдущими логическими шагами.`};
  }
  if (maxRank < 2) return null;
  for (let u = 0; u < 27; u++) for (let n = 1; n <= 9; n++) {
    const places = UNITS[u].filter(i => m[i] & 1 << n);
    if (places.length === 1) return {type: 'Скрытый одиночный', rank: 2, kind: 'place', index: places[0], value: n, cells: UNITS[u], text: `В ${unitName(u)} цифра ${n} может стоять только в одной клетке (${cellName(places[0])}).`};
  }
  if (maxRank < 3) return null;
  for (let u = 0; u < 27; u++) for (let n = 1; n <= 9; n++) {
    const bit = 1 << n, cells = UNITS[u].filter(i => m[i] & bit);
    if (cells.length < 2 || cells.length > 3) continue;
    for (const v of Array.from({length: 27}, (_, i) => i).filter(v => v !== u && (u >= 18 || v >= 18))) {
      if (!cells.every(i => UNITS[v].includes(i))) continue;
      const changes = UNITS[v].filter(i => !UNITS[u].includes(i) && m[i] & bit).map(index => ({index, remove: bit}));
      const s = elimination('Пересечение', 3, cells, changes, `Все варианты цифры ${n} в ${unitName(u)} попадают в одну общую область с ${unitName(v)}. Из остальных клеток этой области ${n} можно убрать.`);
      if (s) return s;
    }
  }
  if (maxRank < 4) return null;
  for (let u = 0; u < 27; u++) for (const size of [2, 3]) {
    const eligible = UNITS[u].filter(i => countBits(m[i]) >= 2 && countBits(m[i]) <= size);
    for (const cells of combinations(eligible, size)) {
      const union = cells.reduce((a, i) => a | m[i], 0);
      if (countBits(union) !== size) continue;
      const changes = UNITS[u].filter(i => !cells.includes(i) && m[i] & union).map(index => ({index, remove: m[index] & union}));
      const s = elimination(size === 2 ? 'Открытая пара' : 'Открытая тройка', 4, cells, changes, `Цифры ${digits(union).join(', ')} занимают ${size === 2 ? 'две' : 'три'} клетки в ${unitName(u)}. Эти кандидаты исключаются из остальных клеток этой области.`);
      if (s) return s;
    }
    const available = digits(UNITS[u].reduce((a, i) => a | m[i], 0));
    for (const ns of combinations(available, size)) {
      const mask = ns.reduce((a, n) => a | 1 << n, 0);
      const cells = UNITS[u].filter(i => m[i] & mask);
      if (cells.length !== size) continue;
      const changes = cells.filter(i => m[i] & ~mask).map(index => ({index, remove: m[index] & ~mask}));
      const s = elimination(size === 2 ? 'Скрытая пара' : 'Скрытая тройка', 4, cells, changes, `В ${unitName(u)} цифры ${ns.join(', ')} возможны только в этих ${size} клетках. Остальные кандидаты из них можно исключить.`);
      if (s) return s;
    }
  }
  if (maxRank < 5) return null;
  for (const size of [2, 3]) {
    if (size === 3 && maxRank < 6) continue;
    for (const axis of [0, 1]) for (let n = 1; n <= 9; n++) {
      const bit = 1 << n, lines = Array.from({length: 9}, (_, i) => i);
      const positions = lines.map(a => lines.filter(b => m[axis === 0 ? a * 9 + b : b * 9 + a] & bit));
      for (const bases of combinations(lines.filter(a => positions[a].length >= 2 && positions[a].length <= size), size)) {
        const covers = [...new Set(bases.flatMap(a => positions[a]))];
        if (covers.length !== size) continue;
        const cells = bases.flatMap(a => positions[a].map(b => axis === 0 ? a * 9 + b : b * 9 + a));
        const changes = lines.filter(a => !bases.includes(a)).flatMap(a => covers.map(b => axis === 0 ? a * 9 + b : b * 9 + a)).filter(i => m[i] & bit).map(index => ({index, remove: bit}));
        const s = elimination(size === 2 ? 'X-Wing' : 'Swordfish', size === 2 ? 5 : 6, cells, changes, `Кандидат ${n} в ${size} ${axis === 0 ? 'строках' : 'столбцах'} ограничен теми же ${size} ${axis === 0 ? 'столбцами' : 'строками'}. Из остальных клеток этих ${axis === 0 ? 'столбцов' : 'строк'} его можно исключить.`);
        if (s) return s;
      }
    }
  }
  if (maxRank < 6) return null;
  for (let pivot = 0; pivot < 81; pivot++) if (countBits(m[pivot]) === 2) {
    const wings = PEERS[pivot].filter(i => countBits(m[i]) === 2 && countBits(m[i] & m[pivot]) === 1);
    for (const [a, b] of combinations(wings, 2)) {
      const shared = m[a] & m[b];
      if (countBits(shared) !== 1 || shared & m[pivot] || (m[a] | m[b]) !== (m[pivot] | shared)) continue;
      const changes = PEERS[a].filter(i => i !== pivot && PEERS[b].includes(i) && m[i] & shared).map(index => ({index, remove: shared}));
      const s = elimination('XY-Wing', 6, [pivot, a, b], changes, `У центральной клетки два кандидата. При любом из них одно из двух крыльев содержит ${digits(shared)[0]}. Поэтому этот кандидат исключается из клеток, которые видят оба крыла.`);
      if (s) return s;
    }
  }
  return null;
}
export function applyLogicalStep(grid, masks, step) {
  if (step.kind === 'place') {
    grid[step.index] = step.value; masks[step.index] = 0;
    for (const j of PEERS[step.index]) masks[j] &= ~(1 << step.value);
  } else for (const {index, remove} of step.changes) masks[index] &= ~remove;
}
export function analyze(grid) {
  const g = [...grid], masks = allCandidates(g), steps = [];
  let rank = 0;
  for (let n = 0; n < 400 && g.some(v => !v); n++) {
    const step = logicalStep(g, masks); if (!step) break;
    rank = Math.max(rank, step.rank); steps.push(step.type); applyLogicalStep(g, masks, step);
  }
  const solved = isComplete(g), search = solved ? null : solve(g, {limit: 1});
  const level = solved ? rank <= 1 ? grid.filter(Boolean).length>=44?'beginner':'easy' : rank <= 2 ? 'normal' : rank <= 4 ? 'hard' : rank<=5?'expert':'master' : search && !search.exhausted && search.depth >= 4 && search.branches >= 12 ? 'extreme' : 'master';
  return {level, rank: solved ? rank : 7, solvedLogically: solved, steps: steps.length, techniques: [...new Set(steps)], remaining: g.filter(n => !n).length, search: search ? {nodes: search.nodes, branches: search.branches, depth: search.depth} : null};
}
export function generatePuzzle(seed, target = 27) {
  const random = rng(seed), solution = solve(Array(81).fill(0), {limit: 1, random}).solution;
  const puzzle = [...solution]; let clues = 81;
  for (const i of shuffle(Array.from({length: 81}, (_, i) => i), random)) {
    if (clues <= target) break;
    const value = puzzle[i]; puzzle[i] = 0;
    const result = solve(puzzle);
    if (result.count !== 1 || result.exhausted) puzzle[i] = value; else clues--;
  }
  return {puzzle, solution, clues};
}
// Sudoku-preserving transformations retain uniqueness. The app verifies each result.
export function transformPuzzle(puzzle, solution, seed) {
  const random = rng(seed), ns = [0, ...shuffle([1,2,3,4,5,6,7,8,9], random)];
  const rs = shuffle([0,1,2], random).flatMap(b => shuffle([0,1,2], random).map(i => b * 3 + i));
  const cs = shuffle([0,1,2], random).flatMap(b => shuffle([0,1,2], random).map(i => b * 3 + i));
  const transpose = random() < 0.5;
  const map = source => Array.from({length: 81}, (_, i) => ns[source[transpose ? cs[col(i)] * 9 + rs[row(i)] : rs[row(i)] * 9 + cs[col(i)]]]);
  return {puzzle: map(puzzle), solution: map(solution)};
}
