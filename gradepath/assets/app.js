/* GradePath - UI layer. All arithmetic lives in assets/gpa.js. */
(function () {
  'use strict';

  var BOOT_AT = Date.now();
  var STORE = 'gradepath.v1';
  var THEME = 'gradepath.theme';
  var $ = function (id) { return document.getElementById(id); };

  var state = { courses: [], target: 3.7, remaining: 30, sample: false };

  /* ---------- storage ---------- */

  function load() {
    try {
      var raw = localStorage.getItem(STORE);
      if (!raw) return false;
      var saved = JSON.parse(raw);
      if (saved && Array.isArray(saved.courses)) {
        state.courses = saved.courses;
        state.sample = !!saved.sample;
        if (saved.target) state.target = Number(saved.target);
        if (saved.remaining) state.remaining = Number(saved.remaining);
        return true;
      }
    } catch (e) { /* corrupt or blocked storage: start empty */ }
    return false;
  }

  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(state)); }
    catch (e) { /* private mode: the app still works for this session */ }
  }

  function uid() { return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  /* ---------- small helpers ---------- */

  function fmt(n, dp) { return n === null || n === undefined || !isFinite(n) ? '--' : Number(n).toFixed(dp === undefined ? 2 : dp); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  var toastTimer;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
  }

  /* ---------- option lists ---------- */

  function fillSelects() {
    $('semester').innerHTML = GPA.SEMESTERS.map(function (s) {
      return '<option value="' + s + '">' + s.replace(/Y(\d)S(\d)/, 'Year $1 - Semester $2') + '</option>';
    }).join('');

    var graded = GPA.GRADE_LADDER.slice().reverse().map(function (g) {
      return '<option value="' + g + '">' + g + '  (' + GPA.GRADE_POINTS[g].toFixed(2) + ')</option>';
    }).join('');
    var other = Object.keys(GPA.NON_GPA_GRADES).map(function (g) {
      return '<option value="' + g + '">' + g + '  (' + GPA.NON_GPA_GRADES[g] + ', not in GPA)</option>';
    }).join('');
    $('grade').innerHTML = '<option value="">Select a grade</option>' +
      '<optgroup label="Counts towards GPA">' + graded + '</optgroup>' +
      '<optgroup label="Outside the GPA">' + other + '</optgroup>';

    $('target').innerHTML = GPA.CLASSES.map(function (c) {
      return '<option value="' + c.min + '">' + c.name + ' (' + c.min.toFixed(2) + ')</option>';
    }).join('');
    $('target').value = String(state.target);
    $('remaining').value = state.remaining;
  }

  /* ---------- rendering ---------- */

  function render() {
    var s = GPA.summarise(state.courses);
    var cls = GPA.classify(s.gpa);

    $('statGpa').textContent = s.gpa === null ? '--' : fmt(s.gpa);
    $('statGpaNote').textContent = s.gpa === null
      ? 'Add your first course to begin'
      : s.gpaCredits + ' credits counted across ' + GPA.bySemester(state.courses).length + ' semester(s)';

    $('statClass').textContent = cls ? cls.name : '--';
    var next = GPA.nextClassAbove(s.gpa);
    $('statClassNote').textContent = s.gpa === null ? 'Based on the boundaries below'
      : next ? (fmt(next.min - s.gpa) + ' GPA points below ' + next.name)
             : 'Highest class - hold this line';

    $('statCredits').textContent = fmt(s.gpaCredits, s.gpaCredits % 1 ? 1 : 0);
    $('statCreditsNote').textContent = fmt(s.passedCredits, s.passedCredits % 1 ? 1 : 0) +
      ' passed at C or above, ' + fmt(s.attemptedCredits, s.attemptedCredits % 1 ? 1 : 0) + ' attempted';

    $('sampleNote').hidden = !(state.sample && state.courses.length);
    renderList();
    renderChart();
    renderPlan(s);
  }

  function renderList() {
    var rows = GPA.bySemester(state.courses);
    if (!rows.length) {
      $('list').innerHTML = '<p class="empty">No courses yet. Add one on the left, or load the sample transcript to look around.</p>';
      return;
    }
    $('list').innerHTML = rows.map(function (row) {
      var body = row.courses.map(function (c) {
        var pts = GPA.points(c.grade);
        var cls = !GPA.isGpaGrade(c.grade) ? 'nongpa' : (pts < GPA.PASS_POINT ? 'fail' : '');
        return '<tr class="' + (c.excluded ? 'off' : '') + '">' +
          '<td><strong>' + esc(c.code) + '</strong>' + (c.title ? '<br><span class="hint">' + esc(c.title) + '</span>' : '') + '</td>' +
          '<td class="num">' + fmt(c.credits, Number(c.credits) % 1 ? 1 : 0) + '</td>' +
          '<td class="num"><span class="grade-pill ' + cls + '">' + esc(c.grade) + '</span></td>' +
          '<td class="act">' +
            '<button class="mini" data-act="edit" data-id="' + c.id + '">Edit</button>' +
            '<button class="mini" data-act="toggle" data-id="' + c.id + '">' + (c.excluded ? 'Include' : 'Exclude') + '</button>' +
            '<button class="mini danger" data-act="del" data-id="' + c.id + '">Delete</button>' +
          '</td></tr>';
      }).join('');

      return '<div class="sem">' +
        '<div class="sem-head"><strong>' + row.semester.replace(/Y(\d)S(\d)/, 'Year $1 - Semester $2') + '</strong>' +
        '<span>Semester GPA ' + fmt(row.gpa) + ' &middot; ' + fmt(row.gpaCredits, row.gpaCredits % 1 ? 1 : 0) + ' credits</span></div>' +
        '<table><thead><tr><th>Course</th><th class="num">Credits</th><th class="num">Grade</th><th></th></tr></thead>' +
        '<tbody>' + body + '</tbody></table></div>';
    }).join('');
  }

  function renderPlan(s) {
    var out = $('planOut');
    var r = GPA.requiredAverage(s, state.remaining, state.target);
    var targetName = (GPA.CLASSES.filter(function (c) { return c.min === state.target; })[0] || {}).name || 'target';

    if (r.error) { out.innerHTML = '<p>' + esc(r.error) + '</p>'; return; }

    if (r.secured) {
      out.innerHTML = '<p><span class="badge ok">Secured</span></p>' +
        '<p>' + targetName + ' is already safe. Even the worst possible run over the next ' +
        fmt(r.remainingCredits, 0) + ' credits leaves you at ' + fmt(r.minPossibleGpa) + '.</p>';
      return;
    }
    if (!r.achievable) {
      out.innerHTML = '<p><span class="badge no">Out of reach</span></p>' +
        '<p>' + targetName + ' would need an average of ' + fmt(r.required) + ' over the next ' +
        fmt(r.remainingCredits, 0) + ' credits, and 4.00 is the ceiling. The best you can finish on is ' +
        fmt(r.maxPossibleGpa) + '. Try a lower target, or add the credits you have left to take.</p>';
      return;
    }
    var grade = GPA.gradeFor(r.required);
    var tight = r.required >= 3.7;
    out.innerHTML =
      '<p><span class="badge ' + (tight ? 'tight' : 'ok') + '">' + (tight ? 'Tight' : 'Reachable') + '</span></p>' +
      '<p class="need">' + fmt(r.required) + ' average needed</p>' +
      '<p>That is roughly a <strong>' + grade + '</strong> in every one of the next ' +
      fmt(r.remainingCredits, 0) + ' credits to reach ' + targetName + '.</p>' +
      '<p>Range still open to you: ' + fmt(r.minPossibleGpa) + ' to ' + fmt(r.maxPossibleGpa) + '.</p>';
  }

  /* ---------- chart: cumulative GPA per semester ---------- */

  var VBW = 640, VBH = 240, PAD = { t: 16, r: 18, b: 30, l: 38 };

  function renderChart() {
    var host = $('chart');
    var series = GPA.cumulativeSeries(state.courses).filter(function (d) { return d.cumulativeGpa !== null; });

    if (!series.length) {
      host.innerHTML = '<p class="empty">The trend appears once a graded course is in.</p>';
      return;
    }

    /* Zoom to the data, but always keep the target line and a full grade point in view. */
    var lo = series.reduce(function (m, d) { return Math.min(m, d.cumulativeGpa); }, state.target);
    var yMax = 4;
    var yMin = Math.max(0, Math.floor((lo - 0.2) * 2) / 2);
    if (yMax - yMin < 1) yMin = yMax - 1;
    var innerW = VBW - PAD.l - PAD.r, innerH = VBH - PAD.t - PAD.b;

    var x = function (i) {
      return series.length === 1 ? PAD.l + innerW / 2 : PAD.l + (i / (series.length - 1)) * innerW;
    };
    var y = function (v) { return PAD.t + innerH - ((v - yMin) / (yMax - yMin)) * innerH; };

    var ticks = [];
    for (var t = yMin; t <= yMax + 1e-9; t += 0.5) ticks.push(Math.round(t * 10) / 10);

    var svg = [];
    svg.push('<svg viewBox="0 0 ' + VBW + ' ' + VBH + '" role="img" aria-label="Cumulative GPA after each semester, ' +
      series.map(function (d) { return d.semester + ' ' + fmt(d.cumulativeGpa); }).join(', ') + '">');

    /* recessive grid + y labels */
    ticks.forEach(function (v) {
      svg.push('<line x1="' + PAD.l + '" x2="' + (VBW - PAD.r) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) +
        '" stroke="var(--grid)" stroke-width="1"/>');
      svg.push('<text x="' + (PAD.l - 8) + '" y="' + (y(v) + 3.5).toFixed(1) + '" text-anchor="end" font-size="10" fill="var(--muted)">' +
        v.toFixed(1) + '</text>');
    });

    /* Target reference line. The label sits at the left, where the direct label
       on the final point can never run into it, and flips below the line if the
       first point is sitting on top of it. */
    if (state.target >= yMin && state.target <= yMax) {
      var ty = y(state.target);
      svg.push('<line x1="' + PAD.l + '" x2="' + (VBW - PAD.r) + '" y1="' + ty.toFixed(1) + '" y2="' + ty.toFixed(1) +
        '" stroke="var(--muted)" stroke-width="1" stroke-dasharray="4 4"/>');
      var clash = Math.abs(y(series[0].cumulativeGpa) - ty) < 14;
      svg.push('<text x="' + (PAD.l + 4) + '" y="' + (clash ? ty + 14 : ty - 6).toFixed(1) +
        '" text-anchor="start" font-size="10" fill="var(--muted)">Target ' + state.target.toFixed(2) + '</text>');
    }

    /* the line */
    if (series.length > 1) {
      var d = series.map(function (p, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.cumulativeGpa).toFixed(1); }).join(' ');
      svg.push('<path d="' + d + '" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>');
    }

    /* markers, ringed against the surface, plus x labels */
    series.forEach(function (p, i) {
      svg.push('<circle cx="' + x(i).toFixed(1) + '" cy="' + y(p.cumulativeGpa).toFixed(1) +
        '" r="4.5" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/>');
      svg.push('<text x="' + x(i).toFixed(1) + '" y="' + (VBH - 10) + '" text-anchor="middle" font-size="10" fill="var(--muted)">' +
        p.semester + '</text>');
    });

    /* the last point is the one worth labelling directly */
    var last = series[series.length - 1];
    svg.push('<text x="' + (x(series.length - 1) - 8).toFixed(1) + '" y="' + (y(last.cumulativeGpa) - 10).toFixed(1) +
      '" text-anchor="end" font-size="11" font-weight="600" fill="var(--text)">' + fmt(last.cumulativeGpa) + '</text>');

    /* hover layer */
    svg.push('<line id="cross" x1="0" x2="0" y1="' + PAD.t + '" y2="' + (PAD.t + innerH) +
      '" stroke="var(--border-strong)" stroke-width="1" visibility="hidden"/>');
    svg.push('<rect id="hit" x="' + PAD.l + '" y="' + PAD.t + '" width="' + innerW + '" height="' + innerH + '" fill="transparent"/>');
    svg.push('</svg><div class="tip" id="tip" hidden></div>');

    host.innerHTML = svg.join('');
    wireHover(host, series, x, y);
  }

  function wireHover(host, series, x, y) {
    var svg = host.querySelector('svg'), tip = $('tip'), cross = $('cross');
    function move(ev) {
      var rect = svg.getBoundingClientRect(), scale = rect.width / VBW;
      var vx = (ev.clientX - rect.left) / scale;
      var best = 0, bestD = Infinity;
      series.forEach(function (p, i) { var d = Math.abs(x(i) - vx); if (d < bestD) { bestD = d; best = i; } });
      var p = series[best];
      cross.setAttribute('x1', x(best)); cross.setAttribute('x2', x(best));
      cross.setAttribute('visibility', 'visible');
      tip.hidden = false;
      tip.innerHTML = '<b>' + p.semester + '</b><br>Cumulative <b>' + fmt(p.cumulativeGpa) + '</b>' +
        (p.semesterGpa === null ? '' : '<br>This semester <b>' + fmt(p.semesterGpa) + '</b>') +
        '<br>' + fmt(p.gpaCredits, p.gpaCredits % 1 ? 1 : 0) + ' credits so far';
      tip.style.left = (x(best) * scale) + 'px';
      tip.style.top = (y(p.cumulativeGpa) * scale) + 'px';
    }
    function out() { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); }
    svg.addEventListener('pointermove', move);
    svg.addEventListener('pointerdown', move);
    svg.addEventListener('pointerleave', out);
  }

  /* ---------- form ---------- */

  function showErr(msg) { var e = $('formErr'); e.textContent = msg; e.hidden = !msg; }

  function resetForm() {
    $('editId').value = '';
    $('code').value = ''; $('title').value = ''; $('credits').value = ''; $('grade').value = '';
    $('submitBtn').textContent = 'Add course';
    $('cancelEdit').hidden = true;
    showErr('');
  }

  function onSubmit(ev) {
    ev.preventDefault();
    var code = $('code').value.trim();
    var credits = Number($('credits').value);
    var grade = $('grade').value;

    if (!code) return showErr('Give the course a code so you can find it later.');
    if (!isFinite(credits) || credits <= 0) return showErr('Credits must be a number above zero.');
    if (credits > 30) return showErr('That looks too large for one course. Check the credit value.');
    if (!grade) return showErr('Pick a grade.');

    var course = {
      id: $('editId').value || uid(),
      semester: $('semester').value,
      code: code,
      title: $('title').value.trim(),
      credits: credits,
      grade: grade,
      excluded: false
    };

    state.sample = false;
    var idx = state.courses.findIndex(function (c) { return c.id === course.id; });
    if (idx > -1) { course.excluded = state.courses[idx].excluded; state.courses[idx] = course; toast('Course updated'); }
    else { state.courses.push(course); toast('Added ' + course.code); }

    save(); resetForm(); render();
    $('code').focus();
  }

  function onListClick(ev) {
    var btn = ev.target.closest('button[data-act]');
    if (!btn) return;
    var id = btn.getAttribute('data-id');
    var course = state.courses.filter(function (c) { return c.id === id; })[0];
    if (!course) return;

    state.sample = false;
    if (btn.getAttribute('data-act') === 'del') {
      if (!confirm('Delete ' + course.code + '?')) return;
      state.courses = state.courses.filter(function (c) { return c.id !== id; });
      toast('Deleted ' + course.code);
    } else if (btn.getAttribute('data-act') === 'toggle') {
      course.excluded = !course.excluded;
      toast(course.excluded ? course.code + ' left out of the GPA' : course.code + ' back in the GPA');
    } else {
      $('editId').value = course.id;
      $('semester').value = course.semester;
      $('code').value = course.code;
      $('title').value = course.title || '';
      $('credits').value = course.credits;
      $('grade').value = course.grade;
      $('submitBtn').textContent = 'Save changes';
      $('cancelEdit').hidden = false;
      showErr('');
      $('code').focus();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    save(); render();
  }

  /* ---------- data in and out ---------- */

  /* Hosts that sandbox downloads hand the page a save API instead of letting a
     link write to disk. Resolved once at start-up; null everywhere else. */
  var saver = null;
  function findSaver() {
    if (!window.claude || typeof window.claude.use !== 'function') return;
    try {
      window.claude.use('downloads').then(function (api) { saver = api || null; },
                                          function () { saver = null; });
    } catch (e) { saver = null; }
  }

  function exportJson() {
    var json = JSON.stringify(state, null, 2);
    var name = 'gradepath-transcript.json';

    if (saver) {
      saver.save({ filename: name, data: json }).then(function () {
        toast('Transcript exported');
      }, function (err) {
        if (err && err.code === 'declined') return;
        toast('This page cannot save files here. Copy the app locally to export.');
      });
      return;
    }

    var blob = new Blob([json], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    toast('Transcript exported');
  }

  function importJson(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        if (!data || !Array.isArray(data.courses)) throw new Error('no courses array');
        state.courses = data.courses.map(function (c) {
          return {
            id: c.id || uid(), semester: c.semester || GPA.SEMESTERS[0], code: String(c.code || 'Course'),
            title: c.title || '', credits: Number(c.credits) || 0, grade: c.grade || 'E', excluded: !!c.excluded
          };
        });
        if (data.target) { state.target = Number(data.target); $('target').value = String(state.target); }
        if (data.remaining) { state.remaining = Number(data.remaining); $('remaining').value = state.remaining; }
        state.sample = false;
        save(); render(); toast('Imported ' + state.courses.length + ' courses');
      } catch (e) { toast('That file is not a GradePath export'); }
    };
    reader.readAsText(file);
  }

  var SAMPLE = [
    ['Y1S1', 'IIC 1113', 'Introduction to ICT', 3, 'A-'],
    ['Y1S1', 'IIC 1122', 'Programming Fundamentals', 2, 'B+'],
    ['Y1S1', 'IIM 1113', 'Mathematics for ICT', 3, 'B'],
    ['Y1S2', 'IIC 1213', 'Object Oriented Programming', 3, 'A'],
    ['Y1S2', 'IIC 1222', 'Database Management Systems', 2, 'B+'],
    ['Y1S2', 'IIS 1212', 'Communication Skills', 2, 'A-'],
    ['Y2S1', 'IIC 2113', 'Data Structures and Algorithms', 3, 'B-'],
    ['Y2S1', 'IIC 2122', 'Computer Networks', 2, 'B+'],
    ['Y2S1', 'IIC 2132', 'Operating Systems', 2, 'C+'],
    ['Y2S2', 'IIC 2223', 'Web Application Development', 3, 'A'],
    ['Y2S2', 'IIC 2212', 'Software Engineering', 2, 'A-'],
    ['Y2S2', 'IIM 2212', 'Statistics for ICT', 2, 'B']
  ];

  function sampleCourses() {
    return SAMPLE.map(function (r) {
      return { id: uid(), semester: r[0], code: r[1], title: r[2], credits: r[3], grade: r[4], excluded: false };
    });
  }

  function loadSample() {
    if (state.courses.length && !confirm('Replace the current transcript with the sample?')) return;
    state.courses = sampleCourses();
    state.sample = true;
    save(); render(); toast('Sample transcript loaded');
  }

  function clearAll() {
    if (!state.courses.length) return toast('Nothing to clear');
    if (!confirm('Delete every course? This cannot be undone.')) return;
    state.courses = []; state.sample = false; save(); render(); toast('Transcript cleared');
  }

  /* ---------- loading screen ---------- */

  /* The app itself is ready almost immediately, so the screen is held for a set
     time to be seen at all, and until the web fonts settle so the interface does
     not repaint under the user. Change MIN_VISIBLE to make it shorter or longer. */
  function dismissSplash() {
    var el = $('splash');
    if (!el) return;
    var MIN_VISIBLE = 1400, FONT_WAIT = 2000, FADE = 450;

    function hide() {
      setTimeout(function () {
        el.classList.add('done');
        setTimeout(function () { el.hidden = true; }, FADE);
      }, Math.max(0, MIN_VISIBLE - (Date.now() - BOOT_AT)));
    }

    var fonts = document.fonts;
    if (fonts && fonts.ready && typeof fonts.ready.then === 'function') {
      var settled = false;
      var once = function () { if (!settled) { settled = true; hide(); } };
      fonts.ready.then(once, once);
      setTimeout(once, FONT_WAIT);   /* never wait on a font that will not arrive */
    } else {
      hide();
    }
  }

  /* ---------- theme ---------- */

  function prefersDark() {
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  /* A data-theme stamp already on the page wins over the OS setting. */
  function effectiveDark() {
    var stamped = document.documentElement.getAttribute('data-theme');
    return stamped ? stamped === 'dark' : prefersDark();
  }

  function syncThemeLabel() {
    var dark = effectiveDark();
    $('themeLabel').textContent = dark ? 'Light mode' : 'Dark mode';
    $('themeBtn').setAttribute('aria-pressed', String(dark));
  }

  function applyTheme(mode) {
    document.documentElement.setAttribute('data-theme', mode);
    syncThemeLabel();
  }

  /* ---------- wiring ---------- */

  function init() {
    findSaver();
    /* A first-time visitor sees the app doing its job rather than an empty form. */
    if (!load()) { state.courses = sampleCourses(); state.sample = true; }
    fillSelects();
    render();

    $('courseForm').addEventListener('submit', onSubmit);
    $('cancelEdit').addEventListener('click', resetForm);
    $('list').addEventListener('click', onListClick);

    $('target').addEventListener('change', function () { state.target = Number(this.value); save(); render(); });
    $('remaining').addEventListener('input', function () { state.remaining = Number(this.value); save(); render(); });

    $('sampleBtn').addEventListener('click', loadSample);
    $('clearBtn').addEventListener('click', clearAll);
    $('exportBtn').addEventListener('click', exportJson);
    $('importBtn').addEventListener('click', function () { $('importFile').click(); });
    $('importFile').addEventListener('change', function () { if (this.files[0]) importJson(this.files[0]); this.value = ''; });

    var savedTheme = null;
    try { savedTheme = localStorage.getItem(THEME); } catch (e) {}
    /* With no stored choice, leave the page as the host or the OS set it. */
    if (savedTheme) applyTheme(savedTheme); else syncThemeLabel();
    $('themeBtn').addEventListener('click', function () {
      var next = effectiveDark() ? 'light' : 'dark';
      applyTheme(next);
      try { localStorage.setItem(THEME, next); } catch (e) {}
      render();
    });

    window.addEventListener('resize', function () { var t = $('tip'); if (t) t.hidden = true; });

    dismissSplash();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
