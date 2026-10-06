/** Independent Easy / Hard / Master editor state. */
(function (global) {
  const DIFFICULTIES = ["easy", "hard", "master"];

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function blankLayout() {
    const rows = [];
    for (let y = 0; y < 18; y += 1) {
      let row = "";
      for (let x = 0; x < 18; x += 1) row += (x === 0 || y === 0 || x === 17 || y === 17) ? "X " : "  ";
      rows.push(row);
    }
    return rows.join("\n");
  }

  function blankDifficulty() {
    return { status: "uncreated", layout: blankLayout(), time: 100, spawn_interval: 4, balls: [], author_history: [], errors: [] };
  }

  function hasPublishableDifficulty(payload) {
    const difficulties = payload && payload.difficulties ? payload.difficulties : {};
    return DIFFICULTIES.some(function (difficulty) {
      return difficulties[difficulty] && difficulties[difficulty].status === "valid";
    });
  }

  function create(payload) {
    const source = payload || {};
    const rows = {};
    const dirty = {};
    DIFFICULTIES.forEach(function (difficulty) {
      rows[difficulty] = source.difficulties && source.difficulties[difficulty]
        ? clone(source.difficulties[difficulty]) : null;
      dirty[difficulty] = false;
    });
    return {
      slug: source.slug || "",
      name: source.name || "",
      isPublic: !!source.is_public,
      activeDifficulty: DIFFICULTIES.find(function (id) { return rows[id]; }) || "easy",
      capture: function (difficulty, fields) {
        if (!DIFFICULTIES.includes(difficulty)) throw new Error("Unknown difficulty.");
        rows[difficulty] = Object.assign({}, rows[difficulty] || blankDifficulty(), clone(fields || {}), { status: "editing" });
        dirty[difficulty] = true;
        return this.select(difficulty);
      },
      select: function (difficulty) {
        if (!DIFFICULTIES.includes(difficulty)) throw new Error("Unknown difficulty.");
        this.activeDifficulty = difficulty;
        return clone(rows[difficulty] || blankDifficulty());
      },
      applySaved: function (saved, authoritativeDifficulty) {
        const response = saved || {};
        this.slug = response.slug || this.slug;
        this.name = response.name == null ? this.name : response.name;
        this.isPublic = response.is_public == null ? this.isPublic : !!response.is_public;
        DIFFICULTIES.forEach(function (difficulty) {
          const authoritative = authoritativeDifficulty
            ? difficulty === authoritativeDifficulty
            : response.difficulties && response.difficulties[difficulty] != null;
          if (!authoritative) return;
          rows[difficulty] = clone(response.difficulties[difficulty]);
          dirty[difficulty] = false;
        });
        return this;
      },
      status: function (difficulty) {
        return rows[difficulty] ? (rows[difficulty].status || "editing") : "uncreated";
      },
      isDirty: function (difficulty) { return !!dirty[difficulty]; },
      isReadOnly: function () { return this.isPublic; },
      canPublish: function () {
        return hasPublishableDifficulty({ difficulties: rows });
      },
      publishableDifficulties: function () {
        return DIFFICULTIES.filter(function (difficulty) { return rows[difficulty] && rows[difficulty].status === "valid"; });
      },
      publishErrors: function () {
        const result = [];
        DIFFICULTIES.forEach(function (difficulty) {
          const errors = rows[difficulty] && Array.isArray(rows[difficulty].errors)
            ? rows[difficulty].errors : [];
          errors.forEach(function (code) {
            result.push({ difficulty: difficulty, code: code });
          });
        });
        return result;
      },
      payload: function () {
        const difficulties = {};
        DIFFICULTIES.forEach(function (difficulty) { difficulties[difficulty] = clone(rows[difficulty]); });
        return { slug: this.slug, name: this.name, is_public: this.isPublic, difficulties: difficulties };
      },
    };
  }

  global.InkballCommunityEditorState = {
    DIFFICULTIES: DIFFICULTIES,
    blankLayout: blankLayout,
    create: create,
    hasPublishableDifficulty: hasPublishableDifficulty,
  };
})(window);
