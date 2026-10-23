"""Derive per-difficulty layouts from a map's authored character grid."""

# Tokens that are not walls / holes / spawners / pre-placed balls.
_EASY_STRIP = set('KUDLRCTAYVG')
_HARD_STRIP = set('TAYVG')
_MASTER_STRIP = set()

_DIGIT = set('01234')
_ACCEL_DIR = set('udlrUDLR')
_TWO_CHAR_STRIP = set('KUDLRCYVG')

# Packed single-cell colour extras (must match static/js/inkball/constants.js).
COLOR_CELL_CHARS = {
    'C': 'Cabce',
    'Y': 'Yfhij',
    'V': 'Vkmno',
    'G': 'Gpqst',
    'K': 'Kvwxy',
}
PACKED_COLOR_CHARS = ''.join(chars[1:] for chars in COLOR_CELL_CHARS.values())

# Must match static/js/inkball/constants.js TIMED_SECONDS_CHARS.
DEFAULT_TIMED_TILE_SECONDS = 39
TIMED_SECONDS_CHARS = (
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
    + ''.join(chr(0xC0 + i) for i in range(38))
)


def encode_timed_seconds(seconds):
    try:
        n = int(round(float(seconds)))
    except (TypeError, ValueError):
        n = DEFAULT_TIMED_TILE_SECONDS
    n = max(0, min(99, n))
    if n == DEFAULT_TIMED_TILE_SECONDS:
        return ' '
    return TIMED_SECONDS_CHARS[n]


def decode_timed_seconds(ch, fallback=DEFAULT_TIMED_TILE_SECONDS):
    if ch is None or ch in ('', ' '):
        return fallback
    index = TIMED_SECONDS_CHARS.find(str(ch)[:1])
    return index if index >= 0 else fallback
_PACKED_COLOR_PARENT = {
    extra: parent
    for parent, chars in COLOR_CELL_CHARS.items()
    for extra in chars[1:]
}


def extras_to_strip(difficulty):
    if difficulty == 'easy':
        return _EASY_STRIP
    if difficulty == 'hard':
        return _HARD_STRIP
    return _MASTER_STRIP


COLS = 18
ROWS = 18
_TWO_CHAR = set('KUDLRCYVGB')


def is_pair_layout(text):
    lines = str(text or '').replace('\r\n', '\n').replace('\r', '\n').split('\n')
    return any(len(line) > COLS for line in lines if line != '')


def to_pair_layout(text):
    """Rewrite an 18-char spanning layout as 36-char cells (type + attr)."""
    raw = str(text or '').replace('\r\n', '\n').replace('\r', '\n').split('\n')
    while raw and raw[-1] == '':
        raw.pop()
    if any(len(line) > COLS for line in raw[:ROWS]):
        return '\n'.join((raw[row] if row < len(raw) else '').ljust(COLS * 2)[: COLS * 2] for row in range(ROWS))

    grid = []
    for row in range(ROWS):
        line = raw[row] if row < len(raw) else ''
        grid.append([(line[col] if col < len(line) else ' ') for col in range(COLS)])

    consumed = [[False] * COLS for _ in range(ROWS)]
    out = [['  '] * COLS for _ in range(ROWS)]

    def take(x, y):
        if 0 <= y < ROWS and 0 <= x < COLS:
            consumed[y][x] = True

    for y in range(ROWS):
        for x in range(COLS):
            if consumed[y][x]:
                continue
            cell = grid[y][x]
            if cell in (' ', '', '\0'):
                out[y][x] = '  '
                continue
            if cell == 'H' and x + 1 < COLS and y + 1 < ROWS:
                digit = grid[y][x + 1]
                attr = digit if digit in _DIGIT else '0'
                out[y][x] = 'H' + attr
                take(x, y)
                take(x + 1, y)
                take(x, y + 1)
                take(x + 1, y + 1)
                continue
            if cell == 'A' and x + 1 < COLS and grid[y][x + 1] in _ACCEL_DIR:
                out[y][x] = grid[y][x + 1].lower() + ' '
                take(x, y)
                take(x + 1, y)
                continue
            if cell in 'udlr':
                out[y][x] = cell + ' '
                continue
            parent = _PACKED_COLOR_PARENT.get(cell)
            if parent:
                color = COLOR_CELL_CHARS[parent].index(cell)
                out[y][x] = parent + str(color)
                continue
            if cell in _TWO_CHAR and x + 1 < COLS and grid[y][x + 1] in _DIGIT:
                out[y][x] = cell + grid[y][x + 1]
                take(x, y)
                take(x + 1, y)
                continue
            out[y][x] = cell + ' '

    return '\n'.join(''.join(row) for row in out)


def filter_layout(text, difficulty, max_preplaced=None):
    """
    Return a copy of `text` with difficulty extras (and optional extra B
    tokens) replaced by spaces. Line lengths are preserved.
    """
    strip = extras_to_strip(difficulty)
    lines = text.replace('\r\n', '\n').replace('\r', '\n').split('\n')
    filtered = [_strip_extras(line, strip) for line in lines]
    if max_preplaced is not None:
        filtered = _limit_preplaced(filtered, max_preplaced)
    return '\n'.join(filtered)


def count_preplaced(text):
    count = 0
    pair = is_pair_layout(text)
    for line in text.replace('\r\n', '\n').replace('\r', '\n').split('\n'):
        if pair:
            for index in range(0, len(line), 2):
                if line[index] == 'B':
                    count += 1
            continue
        index = 0
        while index < len(line):
            if line[index] == 'B' and index + 1 < len(line) and line[index + 1] in _DIGIT:
                count += 1
                index += 2
            else:
                index += 1
    return count


def total_ball_count(layout, serve_balls):
    """Count balls already on the board plus entries in the serve queue."""
    return count_preplaced(layout) + len(serve_balls)


def _strip_extras(line, strip):
    chars = list(line)
    index = 0
    pair = len(line) > COLS
    while index < len(chars):
        cell = chars[index]
        if pair:
            packed_parent = _PACKED_COLOR_PARENT.get(cell)
            if packed_parent and packed_parent in strip:
                chars[index] = ' '
                if index + 1 < len(chars):
                    chars[index + 1] = ' '
                index += 2
                continue
            if cell in 'udlr' and 'A' in strip:
                chars[index] = ' '
                if index + 1 < len(chars):
                    chars[index + 1] = ' '
                index += 2
                continue
            if cell in strip:
                chars[index] = ' '
                if index + 1 < len(chars):
                    chars[index + 1] = ' '
            index += 2
            continue
        packed_parent = _PACKED_COLOR_PARENT.get(cell)
        if packed_parent and packed_parent in strip:
            chars[index] = ' '
            index += 1
            continue
        if cell in 'udlr' and 'A' in strip:
            chars[index] = ' '
            index += 1
            continue
        if cell in strip:
            chars[index] = ' '
            if cell == 'A' and index + 1 < len(chars) and chars[index + 1] in _ACCEL_DIR:
                chars[index + 1] = ' '
                index += 2
                continue
            if cell in _TWO_CHAR_STRIP and index + 1 < len(chars) and chars[index + 1] in _DIGIT:
                chars[index + 1] = ' '
                index += 2
                continue
        index += 1
    return ''.join(chars)


def _limit_preplaced(lines, max_preplaced):
    kept = 0
    pair = any(len(line) > COLS for line in lines)
    out = []
    for line in lines:
        chars = list(line)
        index = 0
        while index < len(chars):
            if pair:
                if chars[index] == 'B':
                    if kept >= max_preplaced:
                        chars[index] = ' '
                        if index + 1 < len(chars):
                            chars[index + 1] = ' '
                    else:
                        kept += 1
                index += 2
                continue
            if chars[index] == 'B' and index + 1 < len(chars) and chars[index + 1] in _DIGIT:
                if kept >= max_preplaced:
                    chars[index] = ' '
                    chars[index + 1] = ' '
                else:
                    kept += 1
                index += 2
                continue
            index += 1
        out.append(''.join(chars))
    return out
