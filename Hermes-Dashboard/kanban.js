/**
 * KanbanStore — localStorage-backed card store for Hermes Dashboard
 *
 * Schema (cards):
 *   id            string   unique card id
 *   project_id    string   owning project
 *   title         string   card title
 *   stage         string   todo | doing | blocked | review | done | shelved
 *   priority      string   high | medium | low
 *   assignee      string   agent id (or '')
 *   parent_id     string   parent card id (or '')
 *   pipeline_type string   workflow pipeline type (or '')
 *   score         number   priority / ordering score
 *   created_at    number   Date.now() on creation
 *   updated_at    number   Date.now() on every mutation
 *
 * Storage key: 'hermes_kanban_cards'
 */
var LS_KEY = 'hermes_kanban_cards';

var KanbanStore = (function () {

  // ── helpers ──────────────────────────────────────────────────────────
  function now() { return Date.now(); }
  function genId() { return 'c_' + now() + '_' + Math.random().toString(36).slice(2, 9); }

  function loadAll() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.warn('[KanbanStore] loadAll parse error, resetting', e);
      return [];
    }
  }

  function saveAll(cards) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(cards));
    } catch (e) {
      console.error('[KanbanStore] saveAll failed', e);
    }
  }

  function findIndex(cards, id) {
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].id === id) return i;
    }
    return -1;
  }

  function shallowCopy(obj) {
    var o = {};
    for (var k in obj) { if (obj.hasOwnProperty(k)) o[k] = obj[k]; }
    return o;
  }

  // ── migrate from the old S.projects kanban structure ──────────────────
  function migrateFromLocalStorage() {
    var existing = loadAll();
    if (existing.length > 0) {
      console.log('[KanbanStore] migrateFromLocalStorage: cards already present (' + existing.length + '), skipping.');
      return existing.length;
    }

    // Try to pull from S.projects (set by index.html)
    var S = window.S;
    if (!S || !S.projects || !S.projects.length) {
      console.warn('[KanbanStore] migrateFromLocalStorage: S.projects not available.');
      return 0;
    }

    var stages = ['todo', 'doing', 'review', 'done'];
    var migrated = [];
    var counter = 0;

    S.projects.forEach(function (proj) {
      if (!proj.kanban) return;
      stages.forEach(function (stage) {
        var list = proj.kanban[stage] || [];
        list.forEach(function (task) {
          counter++;
          migrated.push({
            id: task.id || genId(),
            project_id: proj.id,
            title: task.title || 'Untitled',
            stage: stage,
            priority: task.priority || 'medium',
            assignee: task.assignee || '',
            parent_id: '',
            pipeline_type: '',
            score: counter,
            created_at: now(),
            updated_at: now()
          });
        });
      });
    });

    saveAll(migrated);
    console.log('[KanbanStore] migrateFromLocalStorage: migrated ' + migrated.length + ' cards from S.projects.');
    return migrated.length;
  }

  // ── CRUD ─────────────────────────────────────────────────────────────

  function createCard(fields) {
    var ts = now();
    var card = {
      id: fields.id || genId(),
      project_id: fields.project_id || '',
      title: fields.title || 'Untitled',
      stage: fields.stage || 'todo',
      priority: fields.priority || 'medium',
      assignee: fields.assignee || '',
      parent_id: fields.parent_id || '',
      pipeline_type: fields.pipeline_type || '',
      score: (typeof fields.score === 'number') ? fields.score : ts,
      created_at: ts,
      updated_at: ts
    };

    var cards = loadAll();
    cards.push(card);
    saveAll(cards);

    // Push to global state so dispatcher can see it without reload
    if (window._kanbanCards !== undefined) window._kanbanCards = null; // bust cache

    console.log('[KanbanStore] createCard:', card.id, card.title);
    return shallowCopy(card);
  }

  function getCard(id) {
    var cards = loadAll();
    var idx = findIndex(cards, id);
    return idx >= 0 ? shallowCopy(cards[idx]) : null;
  }

  function updateCard(id, updates) {
    var cards = loadAll();
    var idx = findIndex(cards, id);
    if (idx < 0) { console.warn('[KanbanStore] updateCard: not found', id); return null; }

    var allowed = ['project_id','title','stage','priority','assignee','parent_id','pipeline_type','score'];
    for (var i = 0; i < allowed.length; i++) {
      var key = allowed[i];
      if (updates.hasOwnProperty(key)) cards[idx][key] = updates[key];
    }
    cards[idx].updated_at = now();
    saveAll(cards);

    if (window._kanbanCards !== undefined) window._kanbanCards = null;

    console.log('[KanbanStore] updateCard:', id, Object.keys(updates));
    return shallowCopy(cards[idx]);
  }

  function deleteCard(id) {
    var cards = loadAll();
    var idx = findIndex(cards, id);
    if (idx < 0) { console.warn('[KanbanStore] deleteCard: not found', id); return false; }

    cards.splice(idx, 1);
    saveAll(cards);
    if (window._kanbanCards !== undefined) window._kanbanCards = null;

    console.log('[KanbanStore] deleteCard:', id);
    return true;
  }

  // ── stage transitions ───────────────────────────────────────────────

  function claimCard(id, agentId) {
    var card = getCard(id);
    if (!card) { console.warn('[KanbanStore] claimCard: not found', id); return null; }
    if (card.stage !== 'todo') { console.warn('[KanbanStore] claimCard: card not in todo (is ' + card.stage + ')'); return null; }
    return updateCard(id, { stage: 'doing', assignee: agentId || card.assignee });
  }

  function completeCard(id) {
    var card = getCard(id);
    if (!card) { console.warn('[KanbanStore] completeCard: not found', id); return null; }
    if (card.stage !== 'review') { console.warn('[KanbanStore] completeCard: card not in review (is ' + card.stage + ')'); return null; }
    return updateCard(id, { stage: 'done' });
  }

  function shelveCard(id) {
    return updateCard(id, { stage: 'shelved' });
  }

  // ── hierarchy helpers ───────────────────────────────────────────────

  function getChildren(parentId) {
    var cards = loadAll();
    var result = [];
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].parent_id === parentId) result.push(shallowCopy(cards[i]));
    }
    return result;
  }

  function checkParentsReady(cardId) {
    var card = getCard(cardId);
    if (!card) return true;   // no card = nothing blocking
    if (!card.parent_id) return true; // no parent = root level, always ready
    var parent = getCard(card.parent_id);
    if (!parent) return true; // parent missing = treat as ready
    return parent.stage === 'done';
  }

  // ── query helpers ───────────────────────────────────────────────────

  function getCardsByStage(stage) {
    var cards = loadAll();
    var result = [];
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].stage === stage) result.push(shallowCopy(cards[i]));
    }
    // sort by score ascending
    result.sort(function (a, b) { return a.score - b.score; });
    return result;
  }

  function getCardsByAgent(agentId) {
    var cards = loadAll();
    var result = [];
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].assignee === agentId) result.push(shallowCopy(cards[i]));
    }
    return result;
  }

  function getCardsByProject(projectId) {
    var cards = loadAll();
    var result = [];
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].project_id === projectId) result.push(shallowCopy(cards[i]));
    }
    return result;
  }

  /**
   * getReadyCards — todo cards whose parent (if any) is done.
   * Optional: filter by projectId.
   */
  function getReadyCards(projectId) {
    var todo = getCardsByStage('todo');
    var result = [];
    for (var i = 0; i < todo.length; i++) {
      var card = todo[i];
      if (projectId && card.project_id !== projectId) continue;
      if (checkParentsReady(card.id)) result.push(card);
    }
    return result;
  }

  // ── debug / dump ─────────────────────────────────────────────────────
  function dump() {
    var cards = loadAll();
    console.table(cards);
    return cards;
  }

  function clearAll() {
    saveAll([]);
    if (window._kanbanCards !== undefined) window._kanbanCards = null;
    console.log('[KanbanStore] clearAll: wiped all cards.');
  }

  // ── public API ──────────────────────────────────────────────────────
  return {
    // CRUD
    createCard: createCard,
    getCard: getCard,
    updateCard: updateCard,
    deleteCard: deleteCard,
    // Transitions
    claimCard: claimCard,
    completeCard: completeCard,
    shelveCard: shelveCard,
    // Hierarchy
    getChildren: getChildren,
    checkParentsReady: checkParentsReady,
    // Queries
    getReadyCards: getReadyCards,
    getCardsByStage: getCardsByStage,
    getCardsByAgent: getCardsByAgent,
    getCardsByProject: getCardsByProject,
    // Migration
    migrateFromLocalStorage: migrateFromLocalStorage,
    // Debug
    dump: dump,
    clearAll: clearAll,
    _loadAll: loadAll
  };

})();

// Expose globally for dispatcher and index.html
window.kanbanStore = KanbanStore;
