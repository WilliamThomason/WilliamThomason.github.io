/**
 * Dispatcher — tick-loop orchestrator for Hermes Dashboard kanban.
 *
 * Every `tickInterval` ms the dispatcher:
 *   1. Scans ready cards (todo + parent done) across all projects.
 *   2. Claims available cards (todo → doing) assigning them to idle agents.
 *   3. Simulates agent work on doing cards (calls Hermes API).
 *   4. Auto-promotes review → done when simulated work completes.
 *   5. When a card is done, its children become "ready" for next tick.
 *
 * Dependencies:
 *   window.kanbanStore   (KanbanStore from kanban.js)
 *   window.S             (dashboard state with .projects and .agentConfigs)
 */
var Dispatcher = (function () {

  // ── state ────────────────────────────────────────────────────────────
  var _running = false;
  var _timer = null;
  var _tickInterval = 5000;          // ms between ticks
  var _simulateDelay = 2000;         // ms to simulate work per card
  var _runningTasks = {};            // cardId → { agentId, startedAt }
  var _log = [];                     // recent event log
  var _maxLog = 200;

  // ── helpers ──────────────────────────────────────────────────────────
  function now() { return Date.now(); }

  function addLog(msg, type) {
    var entry = { time: now(), msg: msg, type: type || 'info' };
    _log.push(entry);
    if (_log.length > _maxLog) _log.shift();
    var prefix = '[Dispatcher]';
    if (type === 'error') console.error(prefix, msg);
    else if (type === 'ok') console.log('%c' + prefix + ' ' + msg, 'color: #00b894');
    else console.log(prefix, msg);
  }

  function getStore() {
    return window.kanbanStore || (typeof KanbanStore !== 'undefined' ? KanbanStore : null);
  }

  function getDashboardState() { return window.S || null; }

  /**
   * Pick the best idle agent for a project.
   * Prefers agents assigned to the project that aren't currently working.
   */
  function pickIdleAgent(projectId) {
    var S = getDashboardState();
    if (!S) return null;

    var project = null;
    for (var i = 0; i < S.projects.length; i++) {
      if (S.projects[i].id === projectId) { project = S.projects[i]; break; }
    }
    if (!project || !project.agents || !project.agents.length) {
      // fallback: any agent from agentConfigs not currently busy
      return pickAnyIdleAgent();
    }

    var busyAgents = {};
    for (var cardId in _runningTasks) {
      if (_runningTasks.hasOwnProperty(cardId)) {
        busyAgents[_runningTasks[cardId].agentId] = true;
      }
    }

    for (var j = 0; j < project.agents.length; j++) {
      var aid = project.agents[j];
      if (!busyAgents[aid]) return aid;
    }

    return null; // all project agents busy
  }

  function pickAnyIdleAgent() {
    var S = getDashboardState();
    if (!S || !S.agentConfigs) return null;

    var busyAgents = {};
    for (var cardId in _runningTasks) {
      if (_runningTasks.hasOwnProperty(cardId)) {
        busyAgents[_runningTasks[cardId].agentId] = true;
      }
    }

    for (var i = 0; i < S.agentConfigs.length; i++) {
      var aid = S.agentConfigs[i].id;
      if (!busyAgents[aid]) return aid;
    }
    return null;
  }

  function getAgentName(agentId) {
    var S = getDashboardState();
    if (!S || !S.agentConfigs) return agentId;
    for (var i = 0; i < S.agentConfigs.length; i++) {
      if (S.agentConfigs[i].id === agentId) return S.agentConfigs[i].name;
    }
    return agentId;
  }

  function getProjectName(projectId) {
    var S = getDashboardState();
    if (!S || !S.projects) return projectId;
    for (var i = 0; i < S.projects.length; i++) {
      if (S.projects[i].id === projectId) return S.projects[i].name;
    }
    return projectId;
  }

  // ── Hermes API simulation ────────────────────────────────────────────
  /**
   * Simulate agent work by calling the Hermes API.
   * In a real deployment this would POST to an actual endpoint.
   * For now it's a simulated async operation with a timeout.
   */
  function simulateAgentWork(card, agentId, callback) {
    var agentName = getAgentName(agentId);
    addLog(agentName + ' started work on: ' + card.title, 'info');

    // Simulate async work with a delay
    setTimeout(function () {
      // 80% success rate → move to review, 20% → blocked
      var success = Math.random() > 0.2;
      if (success) {
        addLog(agentName + ' completed work on: ' + card.title + ' → review', 'ok');
        callback(null, 'review');
      } else {
        addLog(agentName + ' blocked on: ' + card.title, 'error');
        callback(null, 'blocked');
      }
    }, _simulateDelay + Math.random() * 1500);
  }

  /**
   * Optionally call a real Hermes API endpoint.
   * POST { cardId, agentId, title, model } → { newStage: 'review'|'blocked' }
   * Falls back to simulation if the endpoint is unavailable.
   */
  function callHermesAPI(card, agentId, callback) {
    var S = getDashboardState();
    var agent = null;
    if (S && S.agentConfigs) {
      for (var i = 0; i < S.agentConfigs.length; i++) {
        if (S.agentConfigs[i].id === agentId) { agent = S.agentConfigs[i]; break; }
      }
    }
    var model = agent ? agent.model : 'openrouter/owl-alpha';
    var endpoint = (S && S.settings && S.settings.apiEndpoint) || '';

    if (!endpoint) {
      // No API configured — simulate
      simulateAgentWork(card, agentId, callback);
      return;
    }

    var xhr = new XMLHttpRequest();
    xhr.open('POST', endpoint, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.timeout = 30000;
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          var resp = JSON.parse(xhr.responseText);
          callback(null, resp.newStage || 'review');
        } catch (e) {
          callback(null, 'review');
        }
      } else {
        addLog('Hermes API error ' + xhr.status + ', falling back to simulation', 'error');
        simulateAgentWork(card, agentId, callback);
      }
    };
    xhr.ontimeout = function () {
      addLog('Hermes API timeout, falling back to simulation', 'error');
      simulateAgentWork(card, agentId, callback);
    };
    xhr.send(JSON.stringify({
      cardId: card.id,
      agentId: agentId,
      title: card.title,
      model: model
    }));
  }

  // ── tick logic ───────────────────────────────────────────────────────
  function tick() {
    var store = getStore();
    if (!store) { addLog('KanbanStore not available', 'error'); return; }

    addLog('── tick ──', 'info');

    // 1. Check in-progress simulated tasks for promotion
    for (var cardId in _runningTasks) {
      if (!_runningTasks.hasOwnProperty(cardId)) continue;
      var task = _runningTasks[cardId];
      var elapsed = now() - task.startedAt;
      // If simulated work has been "running" long enough, it will callback
      // This loop just logs stale tasks
      if (elapsed > 60000) {
        addLog('Task ' + cardId + ' still in progress after 60s, cleaning up', 'error');
        delete _runningTasks[cardId];
      }
    }

    // 2. Check doing cards — simulate completion for any that weren't
    //    started via our path (e.g. claimed by user in UI)
    var doingCards = store.getCardsByStage('doing');
    doingCards.forEach(function (card) {
      if (!_runningTasks[card.id]) {
        // A doing card not tracked by us — try to process it
        addLog('Found untracked doing card: ' + card.title + ', assigning agent', 'info');
        var agentId = card.assignee || pickIdleAgent(card.project_id);
        if (agentId) {
          _runningTasks[card.id] = { agentId: agentId, startedAt: now() };
          callHermesAPI(card, agentId, function (err, newStage) {
            delete _runningTasks[card.id];
            if (newStage) {
              store.updateCard(card.id, { stage: newStage });
              if (newStage === 'done' || newStage === 'review') {
                onCardCompleted(card);
              }
            }
          });
        } else {
          addLog('No idle agent for: ' + card.title, 'info');
        }
      }
    });

    // 3. Promote review → done for cards that have been in review > 1 tick
    var reviewCards = store.getCardsByStage('review');
    reviewCards.forEach(function (card) {
      var age = now() - card.updated_at;
      // Auto-complete cards that have been in review for more than one tick interval
      if (age > _tickInterval) {
        store.completeCard(card.id);
        addLog('Auto-completed: ' + card.title + ' (review → done)', 'ok');
        onCardCompleted(card);
      }
    });

    // 4. Pick up ready todo cards and claim them
    var readyCards = store.getReadyCards();
    addLog('Ready todo cards: ' + readyCards.length, 'info');

    readyCards.forEach(function (card) {
      // Respect concurrency: max 1 card per agent
      var agentId = pickIdleAgent(card.project_id);
      if (!agentId) {
        addLog('All agents busy, waiting for: ' + card.title, 'info');
        return;
      }

      var claimed = store.claimCard(card.id, agentId);
      if (!claimed) {
        addLog('Failed to claim: ' + card.title, 'error');
        return;
      }

      addLog(getAgentName(agentId) + ' claimed: ' + card.title, 'ok');

      // Start simulated work
      _runningTasks[card.id] = { agentId: agentId, startedAt: now() };
      callHermesAPI(claimed, agentId, function (err, newStage) {
        delete _runningTasks[card.id];
        if (newStage) {
          store.updateCard(card.id, { stage: newStage });
          addLog(card.title + ' → ' + newStage, newStage === 'review' || newStage === 'done' ? 'ok' : 'error');
          if (newStage === 'done' || newStage === 'review') {
            onCardCompleted(claimed); // claimed is the card snapshot; re-fetch below
          }
        }
      });
    });

    // Refresh dashboard page if visible
    if (window.updateCounts) window.updateCounts();
  }

  /**
   * When a card completes (review or done), check if children become ready.
   * Log this so the user can see the chain reaction.
   */
  function onCardCompleted(card) {
    var store = getStore();
    if (!store) return;

    var updatedCard = store.getCard(card.id);
    var completedCard = updatedCard || card;

    var children = store.getChildren(completedCard.id);
    if (children.length > 0) {
      addLog(completedCard.title + ' completed — ' + children.length + ' child(ren) now potentially ready', 'ok');
      children.forEach(function (child) {
        if (store.checkParentsReady(child.id)) {
          addLog('  child ready: ' + child.title, 'ok');
        }
      });
    }
  }

  // ── public API ──────────────────────────────────────────────────────

  function start(intervalMs) {
    if (_running) { addLog('Already running', 'info'); return; }
    if (intervalMs) _tickInterval = intervalMs;
    _running = true;

    // Run migration on first start
    var store = getStore();
    if (store) {
      store.migrateFromLocalStorage();
    }

    addLog('Started (interval: ' + _tickInterval + 'ms)', 'ok');
    tick(); // fire first tick immediately
    _timer = setInterval(tick, _tickInterval);
  }

  function stop() {
    _running = false;
    if (_timer) { clearInterval(_timer); _timer = null; }
    addLog('Stopped', 'info');
  }

  function isRunning() { return _running; }

  function setTickInterval(ms) { _tickInterval = ms; }
  function getTickInterval() { return _tickInterval; }
  function setSimulateDelay(ms) { _simulateDelay = ms; }

  function getLog() { return _log.slice(); }
  function getRunningTasks() {
    var result = {};
    for (var k in _runningTasks) {
      if (_runningTasks.hasOwnProperty(k)) {
        result[k] = { agentId: _runningTasks[k].agentId, elapsed: now() - _runningTasks[k].startedAt };
      }
    }
    return result;
  }

  /** Single step — useful for debugging */
  function step() { tick(); }

  return {
    start: start,
    stop: stop,
    isRunning: isRunning,
    step: step,
    setTickInterval: setTickInterval,
    getTickInterval: getTickInterval,
    setSimulateDelay: setSimulateDelay,
    getLog: getLog,
    getRunningTasks: getRunningTasks
  };

})();

// Expose globally
window.Dispatcher = Dispatcher;
