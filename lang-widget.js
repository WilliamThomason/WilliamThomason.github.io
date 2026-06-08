/* ═══════════════════════════════════════════════════
   Language Widget — Reusable JS v2
   No dependencies. All functions scoped to lw_*.
   APIs: MyMemory (translate), Datamuse (thesaurus),
         LanguageTool (grammar), Free Dictionary (defs),
         Web Speech (TTS)
   ═══════════════════════════════════════════════════ */
(function() {
  'use strict';

  var API_TRANSLATE = 'https://api.mymemory.translated.net/get';
  var API_SYNONYMS  = 'https://api.datamuse.com/words';
  var API_GRAMMAR   = 'https://api.languagetool.org/v2/check';
  var API_DEFINE    = 'https://api.dictionaryapi.dev/api/v2/entries/en';

  var vocabList = [];
  var translateTimeout = null;
  var currentThesaurusWord = null;
  var grammarPickyMode = false;

  // ── LOCAL FALLBACK THESAURUS (common English words) ──
  var LOCAL_THESAURUS = {
    "happy": { synonyms: ["joyful","cheerful","content","pleased","delighted","glad","elated","blissful","ecstatic","thrilled"], antonyms: ["sad","unhappy","miserable","sorrowful","depressed"] },
    "sad": { synonyms: ["unhappy","sorrowful","dejected","melancholy","gloomy","miserable","downcast","despondent","blue","forlorn"], antonyms: ["happy","joyful","cheerful","glad","elated"] },
    "big": { synonyms: ["large","huge","enormous","massive","vast","immense","gigantic","colossal","substantial","considerable"], antonyms: ["small","tiny","little","minute","miniature"] },
    "small": { synonyms: ["tiny","little","miniature","minute","compact","petite","diminutive","slight","modest","microscopic"], antonyms: ["big","large","huge","enormous","massive"] },
    "good": { synonyms: ["excellent","great","fine","superb","wonderful","outstanding","splendid","admirable","commendable","superior"], antonyms: ["bad","poor","terrible","awful","inferior"] },
    "bad": { synonyms: ["terrible","awful","poor","dreadful","atrocious","horrible","dismal","inferior","substandard","deficient"], antonyms: ["good","excellent","great","superb","fine"] },
    "fast": { synonyms: ["quick","rapid","swift","speedy","hasty","brisk","fleet","expeditious","nimble","prompt"], antonyms: ["slow","sluggish","leisurely","unhurried","gradual"] },
    "slow": { synonyms: ["sluggish","leisurely","unhurried","gradual","plodding","languid","dawdling","creeping","measured","steady"], antonyms: ["fast","quick","rapid","swift","speedy"] },
    "beautiful": { synonyms: ["gorgeous","stunning","lovely","attractive","elegant","exquisite","radiant","magnificent","splendid","pretty"], antonyms: ["ugly","unattractive","hideous","grotesque","unsightly"] },
    "ugly": { synonyms: ["unattractive","hideous","unsightly","grotesque","repulsive","homely","plain","ghastly","monstrous","dreadful"], antonyms: ["beautiful","gorgeous","stunning","lovely","attractive"] },
    "smart": { synonyms: ["intelligent","clever","brilliant","sharp","astute","wise","knowledgeable","gifted","perceptive","shrewd"], antonyms: ["stupid","dull","foolish","unintelligent","dense"] },
    "stupid": { synonyms: ["foolish","dull","dense","dim","idiotic","moronic","brainless","mindless","senseless","unintelligent"], antonyms: ["smart","intelligent","clever","brilliant","wise"] },
    "strong": { synonyms: ["powerful","mighty","robust","sturdy","tough","resilient","potent","vigorous","forceful","hardy"], antonyms: ["weak","feeble","frail","fragile","delicate"] },
    "weak": { synonyms: ["feeble","frail","fragile","delicate","infirm","debilitated","puny","powerless","vulnerable","flimsy"], antonyms: ["strong","powerful","mighty","robust","sturdy"] },
    "important": { synonyms: ["significant","crucial","vital","essential","critical","key","paramount","fundamental","pivotal","consequential"], antonyms: ["unimportant","trivial","insignificant","minor","negligible"] },
    "easy": { synonyms: ["simple","straightforward","effortless","uncomplicated","basic","elementary","painless","facile","smooth","manageable"], antonyms: ["difficult","hard","challenging","tough","arduous"] },
    "difficult": { synonyms: ["hard","challenging","tough","arduous","demanding","strenuous","formidable","complex","complicated","tricky"], antonyms: ["easy","simple","straightforward","effortless","basic"] },
    "old": { synonyms: ["ancient","aged","elderly","vintage","antique","mature","senior","time-honoured","longstanding","worn"], antonyms: ["new","young","modern","fresh","recent"] },
    "new": { synonyms: ["fresh","modern","recent","novel","latest","current","contemporary","brand-new","innovative","cutting-edge"], antonyms: ["old","ancient","aged","vintage","antique"] },
    "love": { synonyms: ["adore","cherish","treasure","worship","idolize","revere","devotion","affection","passion","fondness"], antonyms: ["hate","loathe","despise","detest","abhor"] },
    "hate": { synonyms: ["loathe","despise","detest","abhor","abominate","execrate","dislike","resent","revile","scorn"], antonyms: ["love","adore","cherish","treasure","admire"] },
    "begin": { synonyms: ["start","commence","initiate","launch","embark","inaugurate","originate","kick off","open","set out"], antonyms: ["end","finish","conclude","terminate","complete"] },
    "end": { synonyms: ["finish","conclude","terminate","cease","stop","close","complete","culminate","expire","wrap up"], antonyms: ["begin","start","commence","initiate","launch"] },
    "help": { synonyms: ["assist","aid","support","facilitate","serve","benefit","contribute","relieve","rescue","guide"], antonyms: ["hinder","obstruct","impede","hamper","block"] },
    "think": { synonyms: ["believe","consider","ponder","contemplate","reflect","deliberate","reason","muse","meditate","ruminate"], antonyms: [] },
    "make": { synonyms: ["create","produce","construct","build","manufacture","fabricate","craft","forge","assemble","generate"], antonyms: ["destroy","demolish","ruin","dismantle","break"] },
    "say": { synonyms: ["state","declare","announce","express","utter","articulate","voice","proclaim","assert","remark"], antonyms: [] },
    "get": { synonyms: ["obtain","acquire","receive","gain","procure","secure","attain","fetch","collect","earn"], antonyms: ["lose","forfeit","surrender","relinquish","give up"] },
    "give": { synonyms: ["provide","offer","supply","deliver","grant","present","donate","contribute","bestow","hand over"], antonyms: ["take","receive","withhold","keep","retain"] },
    "take": { synonyms: ["grab","seize","acquire","obtain","capture","collect","accept","receive","claim","procure"], antonyms: ["give","offer","provide","donate","return"] },
    "come": { synonyms: ["arrive","approach","reach","appear","emerge","materialise","turn up","show up","enter","advance"], antonyms: ["go","leave","depart","exit","withdraw"] },
    "go": { synonyms: ["leave","depart","proceed","move","travel","head","advance","progress","venture","set off"], antonyms: ["come","arrive","stay","remain","return"] },
    "see": { synonyms: ["observe","notice","perceive","spot","witness","view","glimpse","discern","detect","behold"], antonyms: ["overlook","miss","ignore","disregard"] },
    "know": { synonyms: ["understand","comprehend","recognize","realize","grasp","perceive","fathom","apprehend","discern","be aware"], antonyms: [] },
    "want": { synonyms: ["desire","wish","crave","long for","yearn for","aspire","covet","fancy","need","require"], antonyms: [] },
    "need": { synonyms: ["require","demand","necessitate","call for","depend on","want","lack","must have","crave","yearn"], antonyms: [] },
    "use": { synonyms: ["utilize","employ","apply","operate","wield","exercise","implement","harness","exploit","leverage"], antonyms: ["waste","misuse","neglect","abandon"] },
    "find": { synonyms: ["discover","locate","uncover","detect","spot","identify","unearth","track down","stumble upon","come across"], antonyms: ["lose","misplace","overlook","miss"] },
    "tell": { synonyms: ["inform","notify","advise","reveal","disclose","communicate","convey","report","announce","instruct"], antonyms: ["conceal","hide","withhold","suppress"] },
    "ask": { synonyms: ["inquire","question","query","request","demand","probe","interrogate","quiz","petition","solicit"], antonyms: ["answer","reply","respond"] },
    "work": { synonyms: ["function","operate","perform","labour","toil","strive","endeavour","exert","engage","ply"], antonyms: ["rest","idle","laze","relax"] },
    "seem": { synonyms: ["appear","look","feel","sound","come across","give the impression","strike one as","resemble","suggest","indicate"], antonyms: [] },
    "feel": { synonyms: ["sense","perceive","experience","undergo","notice","detect","discern","touch","encounter","suffer"], antonyms: [] },
    "try": { synonyms: ["attempt","endeavour","strive","aim","seek","undertake","venture","struggle","essay","tackle"], antonyms: ["give up","abandon","quit","surrender"] },
    "leave": { synonyms: ["depart","exit","withdraw","vacate","abandon","forsake","quit","retreat","set off","go away"], antonyms: ["stay","remain","arrive","enter","return"] },
    "call": { synonyms: ["phone","ring","contact","dial","reach","summon","beckon","shout","cry out","yell"], antonyms: ["dismiss","ignore","hang up on"] },
    "keep": { synonyms: ["retain","hold","maintain","preserve","sustain","continue","store","save","guard","protect"], antonyms: ["discard","release","abandon","relinquish","surrender"] },
    "let": { synonyms: ["allow","permit","enable","authorize","grant","sanction","approve","consent","empower","license"], antonyms: ["forbid","prohibit","prevent","block","restrict"] },
    "show": { synonyms: ["display","exhibit","demonstrate","present","reveal","indicate","illustrate","manifest","expose","unveil"], antonyms: ["hide","conceal","cover","mask","obscure"] },
    "hear": { synonyms: ["listen","perceive","catch","detect","make out","overhear","pick up","discern","eavesdrop","attend"], antonyms: ["ignore","tune out","miss"] },
    "play": { synonyms: ["perform","engage in","participate","compete","contend","frolic","romp","toy","gamble","recreate"], antonyms: ["work","rest","stop","quit"] },
    "run": { synonyms: ["sprint","dash","race","bolt","rush","gallop","jog","tear","hurry","scramble"], antonyms: ["walk","crawl","stop","stand","halt"] },
    "move": { synonyms: ["shift","transfer","relocate","transport","displace","migrate","advance","progress","budge","stir"], antonyms: ["stay","remain","stop","halt","freeze"] },
    "live": { synonyms: ["reside","dwell","inhabit","exist","survive","thrive","flourish","breathe","populate","occupy"], antonyms: ["die","perish","expire","decease","succumb"] },
    "believe": { synonyms: ["trust","accept","hold","maintain","consider","deem","reckon","suppose","presume","credit"], antonyms: ["doubt","disbelieve","distrust","question","suspect"] },
    "hold": { synonyms: ["grip","grasp","clutch","clasp","embrace","possess","contain","retain","support","carry"], antonyms: ["release","drop","let go","free","relinquish"] },
    "bring": { synonyms: ["carry","convey","transport","deliver","fetch","bear","transfer","lug","usher","escort"], antonyms: ["take away","remove","withdraw","confiscate"] },
    "happen": { synonyms: ["occur","take place","transpire","arise","emerge","develop","unfold","come about","result","ensue"], antonyms: ["prevent","avert","avoid","forestall"] },
    "write": { synonyms: ["compose","author","pen","draft","inscribe","record","document","chronicle","jot","scribble"], antonyms: ["erase","delete","cross out","efface"] },
    "provide": { synonyms: ["supply","furnish","give","offer","deliver","present","yield","contribute","bestow","afford"], antonyms: ["withhold","deny","refuse","deprive","reject"] },
    "sit": { synonyms: ["seat","perch","settle","rest","lounge","squat","hunker","recline","park yourself","install yourself"], antonyms: ["stand","rise","get up","arise"] },
    "stand": { synonyms: ["rise","arise","be upright","be erect","tower","loom","perch","station oneself","plant oneself"], antonyms: ["sit","lie down","kneel","crouch"] },
    "lose": { synonyms: ["misplace","forfeit","surrender","waste","squander","drop","leave behind","be deprived of","miss"], antonyms: ["find","win","gain","earn","recover"] },
    "pay": { synonyms: ["compensate","remunerate","reimburse","settle","fund","finance","contribute","disburse","expend","spend"], antonyms: ["owe","default","withhold"] },
    "meet": { synonyms: ["encounter","rendezvous","converge","assemble","gather","join","unite","connect","get together","link up"], antonyms: ["part","separate","diverge","scatter","disperse"] },
    "include": { synonyms: ["comprise","encompass","contain","incorporate","embrace","cover","involve","entail","subsume","embody"], antonyms: ["exclude","omit","leave out","bar","reject"] },
    "continue": { synonyms: ["persist","proceed","carry on","resume","maintain","sustain","persevere","endure","keep on","press on"], antonyms: ["stop","cease","halt","discontinue","quit"] },
    "set": { synonyms: ["place","put","position","arrange","establish","fix","assign","determine","specify","prescribe"], antonyms: ["remove","dislodge","displace","unset"] },
    "learn": { synonyms: ["study","master","acquire","absorb","grasp","assimilate","pick up","discover","familiarize","memorize"], antonyms: ["forget","unlearn","ignore","neglect"] },
    "change": { synonyms: ["alter","modify","adjust","transform","convert","revise","amend","vary","shift","adapt"], antonyms: ["preserve","maintain","keep","retain","conserve"] },
    "lead": { synonyms: ["guide","direct","head","command","conduct","steer","govern","manage","supervise","captain"], antonyms: ["follow","trail","tail","obey","submit"] },
    "understand": { synonyms: ["comprehend","grasp","fathom","apprehend","perceive","discern","realize","recognize","get","follow"], antonyms: ["misunderstand","misinterpret","misconstrue","confuse"] },
    "watch": { synonyms: ["observe","view","monitor","survey","scrutinize","inspect","examine","gaze at","stare at","eye"], antonyms: ["ignore","overlook","neglect","disregard"] },
    "follow": { synonyms: ["pursue","trail","track","tail","shadow","chase","hound","stalk","succeed","come after"], antonyms: ["lead","precede","guide","avoid","evade"] },
    "stop": { synonyms: ["cease","halt","discontinue","quit","desist","terminate","suspend","pause","break off","wind up"], antonyms: ["continue","start","begin","resume","proceed"] },
    "create": { synonyms: ["make","produce","generate","build","construct","design","develop","invent","originate","establish"], antonyms: ["destroy","demolish","annihilate","eradicate","abolish"] },
    "speak": { synonyms: ["talk","say","utter","articulate","voice","express","communicate","converse","verbalize","enunciate"], antonyms: ["be silent","shut up","hush","quiet"] },
    "read": { synonyms: ["peruse","study","scan","browse","skim","devour","absorb","pore over","wade through","leaf through"], antonyms: [] },
    "allow": { synonyms: ["permit","let","enable","authorize","sanction","approve","grant","consent","tolerate","acquiesce"], antonyms: ["forbid","prohibit","ban","prevent","disallow"] },
    "add": { synonyms: ["append","attach","include","incorporate","supplement","augment","insert","affix","tack on","tag on"], antonyms: ["subtract","remove","deduct","take away","withdraw"] },
    "spend": { synonyms: ["expend","use up","consume","squander","waste","disburse","lay out","shell out","fork out","invest"], antonyms: ["save","conserve","hoard","keep","preserve"] },
    "grow": { synonyms: ["expand","increase","develop","flourish","thrive","prosper","mature","bloom","sprout","burgeon"], antonyms: ["shrink","decline","diminish","wither","dwindle"] },
    "open": { synonyms: ["unlock","unfasten","unseal","uncover","unbolt","unbar","prise open","throw wide","access","expose"], antonyms: ["close","shut","seal","lock","fasten"] },
    "walk": { synonyms: ["stroll","stride","amble","saunter","march","trek","hike","ramble","wander","roam"], antonyms: ["run","stand still","stop","halt"] },
    "win": { synonyms: ["triumph","prevail","succeed","conquer","overcome","earn","gain","secure","achieve","carry off"], antonyms: ["lose","fail","forfeit","surrender"] },
    "offer": { synonyms: ["propose","present","suggest","tender","extend","volunteer","bid","submit","put forward","proffer"], antonyms: ["withdraw","revoke","retract","refuse","reject"] },
    "remember": { synonyms: ["recall","recollect","reminisce","retain","recognize","think back","look back","call to mind","retain"], antonyms: ["forget","overlook","disregard","ignore"] },
    "consider": { synonyms: ["contemplate","ponder","reflect on","deliberate","weigh","evaluate","assess","examine","review","mull over"], antonyms: ["ignore","dismiss","overlook","disregard"] },
    "appear": { synonyms: ["emerge","surface","materialise","arise","show up","turn up","come into view","manifest","present","loom"], antonyms: ["disappear","vanish","fade","evaporate","dissipate"] },
    "buy": { synonyms: ["purchase","acquire","obtain","procure","invest in","pick up","snap up","secure","get","pay for"], antonyms: ["sell","dispose of","auction","liquidate"] },
    "wait": { synonyms: ["pause","hold on","hang on","stand by","bide","linger","delay","remain","stay","tarry"], antonyms: ["proceed","act","hurry","rush","advance"] },
    "serve": { synonyms: ["assist","help","aid","attend","cater","provide","supply","support","minister","wait on"], antonyms: ["command","order","direct","lead"] },
    "die": { synonyms: ["perish","expire","decease","succumb","pass away","depart","croak","kick the bucket","give up the ghost","go"], antonyms: ["live","survive","thrive","flourish","exist"] },
    "send": { synonyms: ["dispatch","transmit","forward","deliver","ship","mail","post","convey","direct","route"], antonyms: ["receive","accept","get","collect","retrieve"] },
    "expect": { synonyms: ["anticipate","await","foresee","predict","forecast","envision","look forward to","count on","bank on"], antonyms: [] },
    "build": { synonyms: ["construct","erect","assemble","create","establish","develop","fabricate","make","put up","set up"], antonyms: ["demolish","destroy","dismantle","raze","tear down"] },
    "stay": { synonyms: ["remain","linger","wait","abide","dwell","reside","continue","tarry","loiter","hang around"], antonyms: ["leave","depart","go","exit","move"] },
    "fall": { synonyms: ["drop","descend","plunge","tumble","topple","collapse","plummet","cascade","stumble","trip"], antonyms: ["rise","ascend","climb","soar","go up"] },
    "cut": { synonyms: ["slice","chop","trim","sever","shear","snip","carve","hack","slash","cleave"], antonyms: ["join","connect","attach","mend","repair"] },
    "reach": { synonyms: ["arrive at","attain","achieve","make it to","get to","access","stretch to","extend to","contact"], antonyms: ["miss","fall short","fail"] },
    "kill": { synonyms: ["slay","eliminate","destroy","execute","assassinate","dispatch","annihilate","eradicate","exterminate","finish off"], antonyms: ["save","rescue","revive","spare","protect"] },
    "remain": { synonyms: ["stay","linger","endure","persist","continue","abide","survive","last","prevail","hold on"], antonyms: ["leave","depart","go","disappear","vanish"] },
    "suggest": { synonyms: ["propose","recommend","advise","advocate","put forward","submit","urge","counsel","intimate","hint"], antonyms: ["demand","insist","require","order","command"] },
    "raise": { synonyms: ["lift","elevate","hoist","boost","increase","heighten","boost up","jack up","uplift","erect"], antonyms: ["lower","drop","reduce","decrease","diminish"] },
    "pass": { synonyms: ["go by","elapse","proceed","move","advance","progress","overtake","surpass","exceed","clear"], antonyms: ["fail","fall short","miss"] },
    "sell": { synonyms: ["market","trade","vend","retail","peddle","hawk","auction","merchandise","deal in","flog"], antonyms: ["buy","purchase","acquire","procure"] },
    "require": { synonyms: ["need","demand","necessitate","call for","mandate","stipulate","insist on","expect","want","depend on"], antonyms: ["offer","give","provide","waive","forgo"] },
    "report": { synonyms: ["announce","declare","state","communicate","inform","notify","disclose","reveal","chronicle","document"], antonyms: ["conceal","hide","suppress","cover up"] },
    "decide": { synonyms: ["determine","resolve","settle","choose","opt","conclude","elect","commit","make up one's mind","rule"], antonyms: ["hesitate","waver","vacillate","waver","falter"] },
    "pull": { synonyms: ["tug","drag","draw","haul","yank","wrench","heave","tow","extract","pluck"], antonyms: ["push","shove","thrust","press","force"] },
    "develop": { synonyms: ["grow","evolve","advance","progress","expand","mature","flourish","bloom","unfold","elaborate"], antonyms: ["decline","regress","stagnate","deteriorate","worsen"] },
    "realize": { synonyms: ["understand","comprehend","recognize","grasp","appreciate","perceive","discern","become aware","fathom","see"], antonyms: ["overlook","miss","ignore","disregard"] }
  };

  // ── INIT ──
  function init() {
    try {
      var saved = localStorage.getItem('lw_vocab');
      if (saved) vocabList = JSON.parse(saved);
    } catch(e) { vocabList = []; }
    renderVocabList();
    setupEnterKey();
  }

  function setupEnterKey() {
    var synInput = document.getElementById('lw-synonym-input');
    if (synInput) synInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); doSynonyms(); }
    });
    var conInput = document.getElementById('lw-conjugate-input');
    if (conInput) conInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); doConjugate(); }
    });
  }

  // ── TOGGLE ──
  window.lw_toggle = function() {
    var panel = document.getElementById('lw-panel');
    var toggle = document.getElementById('lw-toggle');
    var isOpen = panel.classList.contains('open');
    if (isOpen) {
      panel.classList.remove('open');
      if (toggle) toggle.classList.remove('active');
    } else {
      panel.classList.add('open');
      if (toggle) toggle.classList.add('active');
    }
  };

  // ── TABS ──
  window.lw_switchTab = function(tab) {
    document.querySelectorAll('.lang-tab').forEach(function(t){ t.classList.remove('active'); });
    document.querySelectorAll('.lang-tab-content').forEach(function(c){ c.classList.remove('active'); });
    var tabBtn = document.querySelector('.lang-tab[data-tab="' + tab + '"]');
    if (tabBtn) tabBtn.classList.add('active');
    var content = document.getElementById('lw-tab-' + tab);
    if (content) content.classList.add('active');
  };

  // ── SWAP LANGUAGES ──
  window.lw_swapLangs = function() {
    var from = document.getElementById('lw-lang-from');
    var to = document.getElementById('lw-lang-to');
    if (!from || !to) return;
    var tmp = from.value;
    from.value = to.value;
    to.value = tmp;
  };

  // ── TRANSLATE ──
  window.lw_doTranslate = function() {
    var text = document.getElementById('lw-lang-input').value.trim();
    if (!text) return;
    var from = document.getElementById('lw-lang-from').value;
    var to = document.getElementById('lw-lang-to').value;
    var results = document.getElementById('lw-translate-results');
    results.innerHTML = '<div class="lang-loading"><div class="spinner"></div>Translating...</div>';

    var url = API_TRANSLATE + '?q=' + encodeURIComponent(text) + '&langpair=' + from + '|' + to;

    fetch(url)
      .then(function(r) {
        if (r.status === 429) throw new Error('Rate limit exceeded. Wait a moment and try again.');
        return r.json();
      })
      .then(function(data) {
        if (data.responseStatus && data.responseStatus !== 200) {
          if (data.responseStatus === 429) throw new Error('Rate limit exceeded.');
          throw new Error('Translation failed.');
        }
        var tr = (data.responseData && data.responseData.translatedText) ? data.responseData.translatedText : '';
        if (!tr) throw new Error('No translation returned.');

        var matches = data.matches || [];
        var matchScore = data.responseData.match || 0;

        var escTr = escapeHtml(tr);
        var escText = escapeHtml(text);
        var html = '<div class="lang-result">' +
          '<div class="lang-result-label">Translation (' + from + ' \u2192 ' + to + ')</div>' +
          '<div class="lang-result-text">' + escTr + '</div>' +
          '<div class="lang-result-actions">' +
            '<button class="lang-action-btn" onclick="lw_speak(\'' + to + '\',\'' + escTr.replace(/'/g, "\\'") + '\')">\uD83D\uDD0A Speak</button>' +
            '<button class="lang-action-btn" onclick="lw_saveVocab(\'' + escText.replace(/'/g, "\\'") + '\',\'' + escTr.replace(/'/g, "\\'") + '\',\'' + from + '\',\'' + to + '\')">\uD83D\uDCBE Save</button>' +
          '</div>';

        if (matches.length > 0) {
          var goodMatches = matches.filter(function(m){ return m.quality >= 50; }).slice(0, 3);
          if (goodMatches.length > 0) {
            html += '<div class="context-section"><div class="context-title">Examples</div>';
            goodMatches.forEach(function(m) {
              html += '<div class="context-example">' +
                '<div class="source">' + escapeHtml(m.segment || '') + '</div>' +
                '<div class="target">' + escapeHtml(m.translation || '') + '</div>' +
                '</div>';
            });
            html += '</div>';
          }
        }

        html += '</div>';
        results.innerHTML = html;
      })
      .catch(function(e) {
        results.innerHTML = '<div class="lang-result"><div class="lang-result-text" style="color:var(--lw-rose)">' + (e.message || 'Translation failed.') + '</div></div>';
      });
  };

  // ═══════════════════════════════════════════════════
  // ── ENHANCED THESAURUS ──
  // ═══════════════════════════════════════════════════
  window.lw_doSynonyms = function(word) {
    if (!word) {
      word = document.getElementById('lw-synonym-input').value.trim().toLowerCase();
    }
    if (!word) return;
    currentThesaurusWord = word;

    // Update input if called from click
    var input = document.getElementById('lw-synonym-input');
    if (input) input.value = word;

    var results = document.getElementById('lw-synonym-results');
    results.innerHTML = '<div class="lang-loading"><div class="spinner"></div>Searching thesaurus...</div>';

    // Build breadcrumb
    var breadcrumb = '<div class="thes-breadcrumb">' +
      '<span class="thes-back-btn" onclick="lw_doSynonyms(\'' + escapeHtml(currentThesaurusWord) + '\')">\u2190 Back</span>' +
      '<span class="thes-current-word">' + escapeHtml(word) + '</span>' +
      '<button class="pronounce-btn" onclick="lw_speak(\'en\',\'' + escapeHtml(word).replace(/'/g, "\\'") + '\')" title="Listen">\uD83D\uDD0A</button>' +
      '</div>';

    // Check local thesaurus first
    var localData = LOCAL_THESAURUS[word];

    // Fetch from Datamuse: multiple query types in parallel
    var queries = [
      fetch(API_SYNONYMS + '?rel_syn=' + encodeURIComponent(word) + '&max=20').then(function(r){ return r.json(); }),
      fetch(API_SYNONYMS + '?rel_ant=' + encodeURIComponent(word) + '&max=10').then(function(r){ return r.json(); }),
      fetch(API_SYNONYMS + '?rel_trg=' + encodeURIComponent(word) + '&max=10').then(function(r){ return r.json(); }),
      fetch(API_SYNONYMS + '?rel_spc=' + encodeURIComponent(word) + '&max=8').then(function(r){ return r.json(); }),
      fetch(API_SYNONYMS + '?rel_gen=' + encodeURIComponent(word) + '&max=8').then(function(r){ return r.json(); }),
      fetch(API_DEFINE + '/' + encodeURIComponent(word)).then(function(r){ return r.json(); }).catch(function(){ return null; })
    ];

    Promise.all(queries).then(function(allData) {
      var synonyms     = allData[0] || [];
      var antonyms     = allData[1] || [];
      var triggers     = allData[2] || [];  // words statistically associated
      var specific     = allData[3] || [];  // more specific (hyponyms)
      var generic      = allData[4] || [];  // more general (hypernyms)
      var definitions  = allData[5] && !allData[5].title ? allData[5] : null;

      // Merge local + API synonyms, deduplicate
      var allSyns = [];
      var seen = {};

      // Add local synonyms first (high quality)
      if (localData) {
        localData.synonyms.forEach(function(s) {
          if (!seen[s]) { seen[s] = true; allSyns.push({word: s, score: 9999, source: 'local'}); }
        });
        // Add local antonyms
        if (localData.antonyms) {
          localData.antonyms.forEach(function(a) {
            if (!seen[a]) { seen[a] = true; }
          });
        }
      }

      // Add API synonyms
      synonyms.forEach(function(item) {
        if (!seen[item.word]) {
          seen[item.word] = true;
          allSyns.push(item);
        }
      });

      // Build HTML
      var html = breadcrumb;

      // Definitions section
      if (definitions && definitions.length > 0) {
        html += '<div class="thes-definitions">';
        definitions.forEach(function(entry) {
          if (entry.meanings) {
            entry.meanings.forEach(function(meaning) {
              var defs = meaning.definitions.slice(0, 2);
              defs.forEach(function(d, i) {
                html += '<div class="thes-def">' +
                  '<span class="thes-def-part">' + escapeHtml(meaning.partOfSpeech || '') + '</span>' +
                  '<span class="thes-def-text">' + escapeHtml(d.definition || '') + '</span>' +
                  (d.example ? '<span class="thes-def-example">"' + escapeHtml(d.example) + '"</span>' : '') +
                  '</div>';
              });
            });
          }
        });
        html += '</div>';
      }

      // Synonyms section
      if (allSyns.length > 0) {
        html += '<div class="thes-group">' +
          '<div class="thes-group-title"><span class="thes-dot thes-dot-syn"></span>Synonyms</div>' +
          '<div class="thes-chips">';
        allSyns.forEach(function(item) {
          var score = item.score || 0;
          var cls = score > 5000 ? 'chip-exact' : (score > 1000 ? 'chip-common' : '');
          var w = escapeHtml(item.word).replace(/'/g, "\\'");
          html += '<span class="thes-chip ' + cls + '" onclick="lw_doSynonyms(\'' + w + '\')" title="Click to explore \'' + escapeHtml(item.word) + '\'">' + escapeHtml(item.word) + '</span>';
        });
        html += '</div></div>';
      }

      // Antonyms section
      var allAnts = [];
      var antSeen = {};
      if (localData && localData.antonyms) {
        localData.antonyms.forEach(function(a) {
          if (!antSeen[a]) { antSeen[a] = true; allAnts.push({word: a, score: 9999}); }
        });
      }
      antonyms.forEach(function(item) {
        if (!antSeen[item.word]) {
          antSeen[item.word] = true;
          allAnts.push(item);
        }
      });
      if (allAnts.length > 0) {
        html += '<div class="thes-group">' +
          '<div class="thes-group-title"><span class="thes-dot thes-dot-ant"></span>Antonyms</div>' +
          '<div class="thes-chips">';
        allAnts.forEach(function(item) {
          var w = escapeHtml(item.word).replace(/'/g, "\\'");
          html += '<span class="thes-chip chip-ant" onclick="lw_doSynonyms(\'' + w + '\')" title="Click to explore \'' + escapeHtml(item.word) + '\'">' + escapeHtml(item.word) + '</span>';
        });
        html += '</div></div>';
      }

      // Related / Trigger words
      if (triggers.length > 0) {
        html += '<div class="thes-group">' +
          '<div class="thes-group-title"><span class="thes-dot thes-dot-rel"></span>Related Words</div>' +
          '<div class="thes-chips">';
        triggers.forEach(function(item) {
          var w = escapeHtml(item.word).replace(/'/g, "\\'");
          html += '<span class="thes-chip chip-rel" onclick="lw_doSynonyms(\'' + w + '\')" title="Click to explore \'' + escapeHtml(item.word) + '\'">' + escapeHtml(item.word) + '</span>';
        });
        html += '</div></div>';
      }

      // More specific (hyponyms)
      if (specific.length > 0) {
        html += '<div class="thes-group">' +
          '<div class="thes-group-title"><span class="thes-dot thes-dot-spc"></span>More Specific</div>' +
          '<div class="thes-chips">';
          specific.forEach(function(item) {
            var w = escapeHtml(item.word).replace(/'/g, "\\'");
            html += '<span class="thes-chip chip-spc" onclick="lw_doSynonyms(\'' + w + '\')">' + escapeHtml(item.word) + '</span>';
          });
        html += '</div></div>';
      }

      // More general (hypernyms)
      if (generic.length > 0) {
        html += '<div class="thes-group">' +
          '<div class="thes-group-title"><span class="thes-dot thes-dot-gen"></span>More General</div>' +
          '<div class="thes-chips">';
          generic.forEach(function(item) {
            var w = escapeHtml(item.word).replace(/'/g, "\\'");
            html += '<span class="thes-chip chip-gen" onclick="lw_doSynonyms(\'' + w + '\')">' + escapeHtml(item.word) + '</span>';
          });
        html += '</div></div>';
      }

      if (allSyns.length === 0 && allAnts.length === 0 && triggers.length === 0 && specific.length === 0 && generic.length === 0) {
        html += '<div class="lang-result"><div class="lang-result-text" style="color:var(--lw-text-dim)">No thesaurus data found for "' + escapeHtml(word) + '". Try a different word.</div></div>';
      }

      results.innerHTML = html;

    }).catch(function() {
      // Fallback: try local only
      if (localData) {
        lw_doSynonyms(word);
      } else {
        results.innerHTML = breadcrumb + '<div class="lang-result"><div class="lang-result-text" style="color:var(--lw-rose)">Thesaurus request failed. Check your connection.</div></div>';
      }
    });
  };

  // ── CONJUGATE ──
  window.lw_doConjugate = function() {
    var verb = document.getElementById('lw-conjugate-input').value.trim().toLowerCase();
    if (!verb) return;
    var results = document.getElementById('lw-conjugate-results');
    results.innerHTML = '<div class="lang-loading"><div class="spinner"></div>Conjugating...</div>';

    fetch(API_SYNONYMS + '?rel_bga=' + encodeURIComponent(verb) + '&max=3')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var base = verb;
        if (data && data.length > 0) {
          base = data[0].word;
        }

        var forms = [
          {tense: 'Infinitive', form: base},
          {tense: 'Present (I/you/we/they)', form: base},
          {tense: 'Present (he/she/it)', form: conjugate3rd(base)},
          {tense: 'Past Simple', form: conjugatePast(base)},
          {tense: 'Present Participle', form: conjugateParticiple(base)},
          {tense: 'Past Participle', form: conjugatePast(base)}
        ];

        var html = '<table class="conj-table"><thead><tr><th>Tense</th><th>Form</th></tr></thead><tbody>';
        forms.forEach(function(f) {
          html += '<tr><td class="conj-tense">' + f.tense + '</td><td>' + f.form + '</td></tr>';
        });
        html += '</tbody></table>';
        results.innerHTML = html;
      })
      .catch(function() {
        results.innerHTML = '<div class="lang-result"><div class="lang-result-text" style="color:var(--lw-rose)">Conjugation failed.</div></div>';
      });
  };

  function conjugate3rd(v) {
    if (v.endsWith('s') || v.endsWith('sh') || v.endsWith('ch') || v.endsWith('x') || v.endsWith('z') || v.endsWith('o')) return v + 'es';
    if (v.endsWith('y') && !'aeiou'.includes(v.charAt(v.length-2))) return v.slice(0,-1) + 'ies';
    return v + 's';
  }
  function conjugatePast(v) {
    if (v.endsWith('e')) return v + 'd';
    if (v.endsWith('y') && !'aeiou'.includes(v.charAt(v.length-2))) return v.slice(0,-1) + 'ied';
    if (v.length <= 4 && !'aeiou'.includes(v.charAt(v.length-2)) && 'aeiou'.includes(v.charAt(v.length-3))) {
      return v + v.charAt(v.length-1) + 'ed';
    }
    return v + 'ed';
  }
  function conjugateParticiple(v) {
    if (v.endsWith('e')) return v.slice(0,-1) + 'ing';
    if (v.length <= 4 && !'aeiou'.includes(v.charAt(v.length-2)) && 'aeiou'.includes(v.charAt(v.length-3))) {
      return v + v.charAt(v.length-1) + 'ing';
    }
    return v + 'ing';
  }

  // ═══════════════════════════════════════════════════
  // ── ENHANCED GRAMMAR CHECKER ──
  // ═══════════════════════════════════════════════════
  window.lw_doGrammarCheck = function() {
    var text = document.getElementById('lw-grammar-input').value.trim();
    if (!text) return;
    var results = document.getElementById('lw-grammar-results');
    results.innerHTML = '<div class="lang-loading"><div class="spinner"></div>Checking grammar...</div>';

    // Detect language from grammar lang selector or default to en-US
    var langSelect = document.getElementById('lw-grammar-lang');
    var lang = langSelect ? langSelect.value : 'en-US';

    var body = 'text=' + encodeURIComponent(text) +
      '&language=' + encodeURIComponent(lang) +
      '&enabledOnly=false' +
      (grammarPickyMode ? '&level=picky' : '');

    fetch(API_GRAMMAR, {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: body
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var matches = data.matches || [];

      if (matches.length === 0) {
        results.innerHTML = '<div class="grammar-clean">\u2705 No issues found! Your text looks great.</div>';
        return;
      }

      // Categorize errors
      var errors = [];
      var warnings = [];
      var styleIssues = [];

      matches.forEach(function(m) {
        var rule = m.rule || {};
        var category = rule.category || {};
        var typeName = (category.name || '').toLowerCase();
        var issueType = rule.issueType || '';

        var item = {
          offset: m.offset || 0,
          length: m.length || 0,
          message: m.message || '',
          shortMessage: m.shortMessage || '',
          replacements: (m.replacements || []).slice(0, 4).map(function(r){ return r.value || ''; }).filter(function(v){ return v.length > 0; }),
          ruleId: rule.id || '',
          categoryName: category.name || '',
          issueType: issueType
        };

        if (issueType === 'style' || issueType === 'locale-violation' || typeName.includes('style') || typeName.includes('redundancy')) {
          styleIssues.push(item);
        } else if (typeName.includes('grammar') || typeName.includes('verb') || typeName.includes('agreement') || typeName.includes('punctuation') || typeName.includes('capitalization') || typeName.includes('spelling')) {
          errors.push(item);
        } else {
          warnings.push(item);
        }
      });

      // Build summary bar
      var totalIssues = errors.length + warnings.length + styleIssues.length;
      var html = '<div class="grammar-summary">' +
        '<div class="grammar-summary-count">' +
          (errors.length > 0 ? '<span class="grammar-count-err">' + errors.length + ' error' + (errors.length > 1 ? 's' : '') + '</span>' : '') +
          (warnings.length > 0 ? '<span class="grammar-count-warn">' + warnings.length + ' warning' + (warnings.length > 1 ? 's' : '') + '</span>' : '') +
          (styleIssues.length > 0 ? '<span class="grammar-count-style">' + styleIssues.length + ' style</span>' : '') +
        '</div>' +
        '<label class="grammar-picky-toggle">' +
          '<input type="checkbox" id="lw-picky-mode" ' + (grammarPickyMode ? 'checked' : '') + ' onchange="lw_togglePickyMode()">' +
          'Picky mode' +
        '</label>' +
        '</div>';

      // Highlighted text preview
      html += '<div class="grammar-highlighted-text">' + buildHighlightedText(text, errors, warnings, styleIssues) + '</div>';

      // Errors section
      if (errors.length > 0) {
        html += '<div class="grammar-section"><div class="grammar-section-title grammar-section-err">\u2717 Errors</div>';
        errors.forEach(function(item) {
          html += buildErrorCard(text, item);
        });
        html += '</div>';
      }

      // Warnings section
      if (warnings.length > 0) {
        html += '<div class="grammar-section"><div class="grammar-section-title grammar-section-warn">\u26A0 Warnings</div>';
        warnings.forEach(function(item) {
          html += buildErrorCard(text, item);
        });
        html += '</div>';
      }

      // Style issues section
      if (styleIssues.length > 0) {
        html += '<div class="grammar-section"><div class="grammar-section-title grammar-section-style">\u2728 Style Suggestions</div>';
        styleIssues.forEach(function(item) {
          html += buildErrorCard(text, item);
        });
        html += '</div>';
      }

      results.innerHTML = html;
    })
    .catch(function() {
      results.innerHTML = '<div class="lang-result"><div class="lang-result-text" style="color:var(--lw-rose)">Grammar check failed. Check your connection.</div></div>';
    });
  };

  function buildHighlightedText(text, errors, warnings, styleIssues) {
    var allIssues = [];
    errors.forEach(function(e){ allIssues.push({offset: e.offset, length: e.length, cls: 'hl-err'}); });
    warnings.forEach(function(w){ allIssues.push({offset: w.offset, length: w.length, cls: 'hl-warn'}); });
    styleIssues.forEach(function(s){ allIssues.push({offset: s.offset, length: s.length, cls: 'hl-style'}); });

    // Sort by offset
    allIssues.sort(function(a, b){ return a.offset - b.offset; });

    // Remove overlaps
    var filtered = [];
    var lastEnd = 0;
    allIssues.forEach(function(issue) {
      if (issue.offset >= lastEnd) {
        filtered.push(issue);
        lastEnd = issue.offset + issue.length;
      }
    });

    var result = '';
    var pos = 0;
    filtered.forEach(function(issue) {
      if (issue.offset > pos) {
        result += escapeHtml(text.substring(pos, issue.offset));
      }
      result += '<span class="grammar-hl ' + issue.cls + '">' + escapeHtml(text.substring(issue.offset, issue.offset + issue.length)) + '</span>';
      pos = issue.offset + issue.length;
    });
    if (pos < text.length) {
      result += escapeHtml(text.substring(pos));
    }
    return result;
  }

  function buildErrorCard(text, item) {
    var errorText = text.substring(item.offset, item.offset + item.length);
    var html = '<div class="grammar-error-card">' +
      '<div class="grammar-error-header">' +
        '<span class="grammar-error-text">' + escapeHtml(errorText) + '</span>' +
        (item.shortMessage ? '<span class="grammar-error-short">' + escapeHtml(item.shortMessage) + '</span>' : '') +
      '</div>' +
      '<div class="grammar-error-message">' + escapeHtml(item.message) + '</div>';

    if (item.replacements.length > 0) {
      html += '<div class="grammar-corrections">';
      item.replacements.forEach(function(r) {
        html += '<span class="grammar-corr-chip">' + escapeHtml(r) + '</span>';
      });
      html += '</div>';
    }

    if (item.categoryName) {
      html += '<div class="grammar-error-category">' + escapeHtml(item.categoryName) + '</div>';
    }

    html += '</div>';
    return html;
  }

  window.lw_togglePickyMode = function() {
    grammarPickyMode = !grammarPickyMode;
    var text = document.getElementById('lw-grammar-input').value.trim();
    if (text) {
      lw_doGrammarCheck();
    }
  };

  // ── VOCAB ──
  window.lw_saveVocab = function(src, tgt, from, to) {
    vocabList.unshift({source: src, target: tgt, from: from, to: to, time: new Date().toLocaleDateString()});
    if (vocabList.length > 200) vocabList = vocabList.slice(0, 200);
    try { localStorage.setItem('lw_vocab', JSON.stringify(vocabList)); } catch(e) {}
    renderVocabList();
    lw_showToast('Word saved!');
  };

  function renderVocabList() {
    var c = document.getElementById('lw-vocab-list');
    if (!c) return;
    if (vocabList.length === 0) {
      c.innerHTML = '<div class="vocab-empty">Your saved words will appear here</div>';
      return;
    }
    var html = '';
    vocabList.forEach(function(v, i) {
      html += '<div class="vocab-item">' +
        '<div><span class="vocab-word">' + escapeHtml(v.source) + '</span>' +
        '<span class="vocab-lang">' + v.from + '</span></div>' +
        '<div class="vocab-translation">' + escapeHtml(v.target) + '</div>' +
        '<button class="vocab-delete" onclick="lw_deleteVocab(' + i + ')">\u2715</button>' +
        '</div>';
    });
    c.innerHTML = html;
  }

  window.lw_deleteVocab = function(idx) {
    vocabList.splice(idx, 1);
    try { localStorage.setItem('lw_vocab', JSON.stringify(vocabList)); } catch(e) {}
    renderVocabList();
  };

  window.lw_filterVocab = function() {
    var q = document.getElementById('lw-vocab-search').value.toLowerCase();
    var items = document.querySelectorAll('#lw-vocab-list .vocab-item');
    items.forEach(function(item) {
      item.style.display = item.textContent.toLowerCase().includes(q) ? 'flex' : 'none';
    });
  };

  // ── TTS ──
  window.lw_speak = function(lang, text) {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text);
    var langMap = {en:'en-US',de:'de-DE',es:'es-ES',fr:'fr-FR',it:'it-IT',pt:'pt-PT',ru:'ru-RU',ja:'ja-JP',ko:'ko-KR',zh:'zh-CN',ar:'ar-SA',hi:'hi-IN',nl:'nl-NL',pl:'pl-PL',tr:'tr-TR',sv:'sv-SE',da:'da-DK',fi:'fi-FI',el:'el-GR',cs:'cs-CZ',ro:'ro-RO',hu:'hu-HU',bg:'bg-BG',sk:'sk-SK',sl:'sl-SI',lv:'lv-LV',lt:'lt-LT',et:'et-EE',uk:'uk-UA',sr:'sr-RS',id:'id-ID',ms:'ms-MY',tl:'tl-PH',vi:'vi-VN',th:'th-TH',fa:'fa-IR',he:'he-IL',ur:'ur-PK',bn:'bn-BD'};
    u.lang = langMap[lang] || 'en-US';
    u.rate = 0.85;
    speechSynthesis.speak(u);
  };

  // ── UTILS ──
  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  window.lw_showToast = function(msg) {
    var existing = document.querySelector('.lang-toast');
    if (existing) existing.remove();
    var div = document.createElement('div');
    div.className = 'lang-toast';
    div.textContent = msg;
    document.body.appendChild(div);
    setTimeout(function() {
      div.style.opacity = '0';
      div.style.transition = 'opacity .3s';
      setTimeout(function() { div.remove(); }, 300);
    }, 2000);
  };

  // ── AUTO-INIT ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
