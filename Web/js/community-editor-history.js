/** Bounded undo/redo history for editor snapshots. */
(function (global) {
  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function same(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  function create(limit) {
    const maximum = Math.max(1, Number(limit) || 50);
    const past = [];
    const future = [];
    return {
      record: function (snapshot) {
        if (past.length && same(past[past.length - 1], snapshot)) return;
        past.push(clone(snapshot));
        if (past.length > maximum) past.shift();
        future.length = 0;
      },
      undo: function (current) {
        if (!past.length) return null;
        future.push(clone(current));
        return clone(past.pop());
      },
      redo: function (current) {
        if (!future.length) return null;
        past.push(clone(current));
        return clone(future.pop());
      },
      canUndo: function () { return past.length > 0; },
      canRedo: function () { return future.length > 0; },
      clear: function () { past.length = 0; future.length = 0; },
    };
  }

  global.InkballEditorHistory = { create: create };
})(window);
