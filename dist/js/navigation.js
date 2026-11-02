// Keypad browsing never edits the board. Ties keep the first cell in reading order.
export function digitIsComplete(game,digit){return !!game&&digit>=1&&digit<=9&&game.values.filter(v=>v===digit).length>=9;}
export function nearestPlacedDigit(game, digit, from = game.selected) {
  let nearest = -1, distance = Infinity;
  const row = Math.floor(from / 9), col = from % 9;
  for (let i = 0; i < 81; i++) {
    if (game.values[i] !== digit || game.solution[i] !== digit) continue;
    const d = (Math.floor(i / 9) - row) ** 2 + (i % 9 - col) ** 2;
    if (d < distance) { nearest = i; distance = d; }
  }
  return nearest;
}
