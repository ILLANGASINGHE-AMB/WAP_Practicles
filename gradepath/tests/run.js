/* Node test runner:  node tests/run.js  */
var GPA = require('../assets/gpa.js');
var tests = require('./tests.js');

var results = tests.run(GPA);
var failed = results.filter(function (r) { return !r.ok; });

results.forEach(function (r) {
  console.log((r.ok ? 'PASS  ' : 'FAIL  ') + r.name + (r.ok ? '' : '\n      ' + r.message));
});
console.log('\n' + (results.length - failed.length) + '/' + results.length + ' passed');
process.exit(failed.length ? 1 : 0);
