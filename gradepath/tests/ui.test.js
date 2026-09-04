/*
 * End-to-end test of the essential user journey, driven through a real DOM.
 *   npm i jsdom  (once, anywhere)  then:  node tests/ui.test.js
 * The engine tests in run.js need no dependencies; this one needs jsdom.
 */
var fs = require('fs');
var path = require('path');

var JSDOM;
try {
  JSDOM = require(process.env.JSDOM_PATH || 'jsdom').JSDOM;
} catch (e) {
  console.log('SKIP  jsdom is not installed - run `npm i jsdom` to exercise the UI journey');
  process.exit(0);
}

var root = path.join(__dirname, '..');
var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  .replace(/<script src="[^"]*"><\/script>/g, '');   /* scripts are injected below */

var dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/', pretendToBeVisual: true });
var win = dom.window, doc = win.document;
win.confirm = function () { return true; };
win.scrollTo = function () {};
win.eval(fs.readFileSync(path.join(root, 'assets/gpa.js'), 'utf8'));
win.eval(fs.readFileSync(path.join(root, 'assets/app.js'), 'utf8'));

var results = [];
function check(name, fn) {
  try { fn(); results.push({ name: name, ok: true }); }
  catch (e) { results.push({ name: name, ok: false, message: e.message }); }
}
function eq(a, b, label) { if (a !== b) throw new Error((label || '') + ' expected "' + b + '", got "' + a + '"'); }
function has(hay, needle, label) {
  if (String(hay).indexOf(needle) === -1) throw new Error((label || '') + ' expected to contain "' + needle + '"');
}
function $(id) { return doc.getElementById(id); }

function addCourse(sem, code, credits, grade, title) {
  $('semester').value = sem;
  $('code').value = code;
  $('credits').value = String(credits);
  $('grade').value = grade;
  $('title').value = title || '';
  $('courseForm').dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
}
function clickIn(containerId, action, index) {
  var btns = $(containerId).querySelectorAll('button[data-act="' + action + '"]');
  btns[index || 0].dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
}

function main() {

check('a first-time visitor lands on a working example, clearly labelled', function () {
  eq($('list').querySelectorAll('tbody tr').length, 12, 'example rows');
  eq($('sampleNote').hidden, false, 'example notice shown');
  has($('sampleNote').textContent, 'example courses', 'notice wording');
});

check('clearing the example leaves an empty transcript', function () {
  $('clearBtn').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  has($('list').textContent, 'No courses yet', 'empty state');
  eq($('statGpa').textContent, '--', 'gpa');
  eq($('sampleNote').hidden, true, 'notice hidden');
});

check('the form refuses a course with no grade', function () {
  addCourse('Y1S1', 'IIC 1113', 3, '');
  eq($('formErr').hidden, false, 'error visible');
  has($('formErr').textContent, 'Pick a grade', 'message');
  eq($('statGpa').textContent, '--', 'gpa untouched');
});

check('the form refuses zero credits', function () {
  addCourse('Y1S1', 'IIC 1113', 0, 'A');
  has($('formErr').textContent, 'above zero', 'message');
});

check('adding a graded course updates GPA, class and the list', function () {
  addCourse('Y2S2', 'IIC 2223', 3, 'A', 'Web Application Development');
  eq($('statGpa').textContent, '4.00', 'gpa');
  eq($('statClass').textContent, 'First Class', 'class');
  has($('list').textContent, 'IIC 2223', 'course row');
  has($('list').textContent, 'Web Application Development', 'course title');
  eq($('formErr').hidden, true, 'error cleared');
  eq($('code').value, '', 'form reset');
});

check('a second course pulls the GPA to the weighted value', function () {
  addCourse('Y2S2', 'IIM 2212', 1, 'D', 'Statistics');
  eq($('statGpa').textContent, '3.25', 'gpa');          /* (3*4 + 1*1) / 4 */
  eq($('statClass').textContent, 'Second Class (Lower)', 'class');
});

check('excluding a course removes it from the GPA', function () {
  clickIn('list', 'toggle', 1);
  eq($('statGpa').textContent, '4.00', 'gpa after exclude');
  clickIn('list', 'toggle', 1);
  eq($('statGpa').textContent, '3.25', 'gpa after include');
});

check('the planner states the average still needed', function () {
  $('target').value = '3.7';
  $('target').dispatchEvent(new win.Event('change', { bubbles: true }));
  $('remaining').value = '30';
  $('remaining').dispatchEvent(new win.Event('input', { bubbles: true }));
  /* (3.7 * 34 - 13) / 30 = 3.76 */
  has($('planOut').textContent, '3.76', 'required average');
  has($('planOut').textContent, 'average needed', 'wording');
});

check('an impossible target is called out rather than shown as a number', function () {
  $('remaining').value = '2';
  $('remaining').dispatchEvent(new win.Event('input', { bubbles: true }));
  has($('planOut').textContent, 'Out of reach', 'verdict');
  $('remaining').value = '30';
  $('remaining').dispatchEvent(new win.Event('input', { bubbles: true }));
});

check('the trend chart draws a point per semester', function () {
  eq($('chart').querySelectorAll('circle').length, 1, 'points for one semester');
  addCourse('Y1S1', 'IIC 1113', 3, 'B');
  eq($('chart').querySelectorAll('circle').length, 2, 'points for two semesters');
  has($('chart').querySelector('svg').getAttribute('aria-label'), 'Cumulative GPA', 'accessible label');
});

check('semesters are listed in curriculum order, not entry order', function () {
  var heads = Array.prototype.map.call($('list').querySelectorAll('.sem-head strong'), function (n) { return n.textContent; });
  eq(heads[0], 'Year 1 - Semester 1', 'first block');
  eq(heads[1], 'Year 2 - Semester 2', 'second block');
});

check('edit loads a course back into the form and replaces it on save', function () {
  clickIn('list', 'edit', 0);
  eq($('code').value, 'IIC 1113', 'loaded code');
  $('grade').value = 'A';
  $('courseForm').dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
  eq($('list').querySelectorAll('tbody tr').length, 3, 'still three courses');
  eq($('statGpa').textContent, '3.57', 'gpa after edit');   /* (12 + 1 + 12) / 7 */
});

check('the transcript survives a reload', function () {
  var saved = JSON.parse(win.localStorage.getItem('gradepath.v1'));
  eq(saved.courses.length, 3, 'stored courses');
  eq(saved.target, 3.7, 'stored target');
  eq(saved.sample, false, 'no longer flagged as the example');
});

check('the sample transcript loads twelve courses across four semesters', function () {
  $('sampleBtn').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  eq($('list').querySelectorAll('tbody tr').length, 12, 'rows');
  eq($('chart').querySelectorAll('circle').length, 4, 'semesters plotted');
  eq($('statGpa').textContent, '3.36', 'sample gpa');
});

check('delete removes a course', function () {
  var before = $('list').querySelectorAll('tbody tr').length;
  clickIn('list', 'del', 0);
  eq($('list').querySelectorAll('tbody tr').length, before - 1, 'rows after delete');
});

check('clear all empties the transcript', function () {
  $('clearBtn').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  has($('list').textContent, 'No courses yet', 'empty state');
  eq($('statGpa').textContent, '--', 'gpa reset');
});

var failed = results.filter(function (r) { return !r.ok; });
results.forEach(function (r) {
  console.log((r.ok ? 'PASS  ' : 'FAIL  ') + r.name + (r.ok ? '' : '\n      ' + r.message));
});
console.log('\n' + (results.length - failed.length) + '/' + results.length + ' passed');
process.exit(failed.length ? 1 : 0);

}

/* The app wires itself up on DOMContentLoaded, which jsdom fires asynchronously. */
if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', main);
else main();
