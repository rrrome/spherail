function sample() {
  const rows = Array.from({ length: 18 }, (_, y) => Array.from({ length: 18 }, (_, x) => x === 0 || y === 0 || x === 17 || y === 17 ? 'X ' : '  '));
  rows[2][2] = 'S '; rows[5][5] = 'H0';
  return { name: 'Test Map', author: 'Player', difficulties: { easy: { layout_content: rows.map(row => row.join('')).join('\n'), balls: ['grey'], time: 100, spawn_interval: 4 } } };
}
module.exports = { sample };
