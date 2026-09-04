/* Shared assertions for the GPA engine. Runs in Node (tests/run.js) and in the
   browser (tests/tests.html) against the same source file. */
(function (root, factory) {
  root.GradePathTests = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = root.GradePathTests;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function run(GPA) {
    var results = [];
    function check(name, fn) {
      try { fn(); results.push({ name: name, ok: true }); }
      catch (e) { results.push({ name: name, ok: false, message: e.message }); }
    }
    function eq(actual, expected, label) {
      if (actual !== expected) throw new Error((label || '') + ' expected ' + expected + ', got ' + actual);
    }
    function near(actual, expected, label) {
      if (Math.abs(actual - expected) > 1e-9) throw new Error((label || '') + ' expected ~' + expected + ', got ' + actual);
    }

    check('GPA is credit-weighted, not a plain average', function () {
      /* 4 credits at A (4.0) and 1 credit at D (1.0) -> 17/5 = 3.4 */
      near(GPA.summarise([
        { credits: 4, grade: 'A' }, { credits: 1, grade: 'D' }
      ]).gpa, 3.4);
    });

    check('empty transcript has no GPA rather than zero', function () {
      eq(GPA.summarise([]).gpa, null);
    });

    check('an E counts in the GPA but earns no credit', function () {
      var s = GPA.summarise([{ credits: 3, grade: 'A' }, { credits: 3, grade: 'E' }]);
      near(s.gpa, 2.0, 'gpa');
      eq(s.gpaCredits, 6, 'gpa credits');
      eq(s.passedCredits, 3, 'passed credits');
    });

    check('MC and W are excluded from the GPA', function () {
      var s = GPA.summarise([{ credits: 3, grade: 'A' }, { credits: 3, grade: 'MC' }, { credits: 2, grade: 'W' }]);
      near(s.gpa, 4.0, 'gpa');
      eq(s.gpaCredits, 3, 'gpa credits');
      eq(s.attemptedCredits, 8, 'attempted credits');
    });

    check('an excluded repeat attempt drops out of every total', function () {
      var s = GPA.summarise([
        { credits: 3, grade: 'E', excluded: true },
        { credits: 3, grade: 'B' }
      ]);
      near(s.gpa, 3.0, 'gpa');
      eq(s.attemptedCredits, 3, 'attempted credits');
    });

    check('zero and negative credits are ignored', function () {
      var s = GPA.summarise([{ credits: 0, grade: 'A' }, { credits: -2, grade: 'A' }, { credits: 2, grade: 'B' }]);
      near(s.gpa, 3.0);
      eq(s.gpaCredits, 2);
    });

    check('class boundaries land on the right award', function () {
      eq(GPA.classify(3.7).name, 'First Class');
      eq(GPA.classify(3.69).name, 'Second Class (Upper)');
      eq(GPA.classify(3.3).name, 'Second Class (Upper)');
      eq(GPA.classify(3.0).name, 'Second Class (Lower)');
      eq(GPA.classify(2.0).name, 'General Pass');
      eq(GPA.classify(1.99).name, 'Below General Pass');
      eq(GPA.classify(null), null);
    });

    check('semesters come back in curriculum order with their own GPA', function () {
      var rows = GPA.bySemester([
        { semester: 'Y2S1', credits: 2, grade: 'B' },
        { semester: 'Y1S1', credits: 2, grade: 'A' }
      ]);
      eq(rows.length, 2, 'row count');
      eq(rows[0].semester, 'Y1S1', 'first semester');
      near(rows[1].gpa, 3.0, 'second semester gpa');
    });

    check('the trend series is cumulative, not per-semester', function () {
      var series = GPA.cumulativeSeries([
        { semester: 'Y1S1', credits: 10, grade: 'A' },
        { semester: 'Y1S2', credits: 10, grade: 'C' }
      ]);
      near(series[0].cumulativeGpa, 4.0, 'after Y1S1');
      near(series[1].semesterGpa, 2.0, 'Y1S2 alone');
      near(series[1].cumulativeGpa, 3.0, 'after Y1S2');
    });

    check('required average solves the target equation', function () {
      /* 30 credits of quality points at 3.0, 30 credits left, target 3.5
         -> (3.5*60 - 90)/30 = 4.0 */
      var s = GPA.summarise([{ credits: 30, grade: 'B' }]);
      var r = GPA.requiredAverage(s, 30, 3.5);
      near(r.required, 4.0, 'required');
      eq(r.achievable, true, 'achievable');
    });

    check('an out-of-reach target is reported as unachievable', function () {
      var s = GPA.summarise([{ credits: 60, grade: 'C' }]);
      var r = GPA.requiredAverage(s, 30, 3.7);
      eq(r.achievable, false, 'achievable');
    });

    check('a target already secured needs nothing further', function () {
      /* 60 credits at 4.0 with 30 to go: even all-E finishes above 2.5 */
      var s = GPA.summarise([{ credits: 60, grade: 'A' }]);
      var r = GPA.requiredAverage(s, 30, 2.5);
      eq(r.secured, true, 'secured');
      near(r.minPossibleGpa, 240 / 90, 'worst case');
    });

    check('the planner refuses missing remaining credits', function () {
      var r = GPA.requiredAverage(GPA.summarise([{ credits: 3, grade: 'A' }]), 0, 3.7);
      eq(typeof r.error, 'string');
    });

    check('a required average maps to the lowest sufficient grade', function () {
      eq(GPA.gradeFor(3.5), 'A-');
      eq(GPA.gradeFor(3.0), 'B');
      eq(GPA.gradeFor(4.0), 'A');
    });

    return results;
  }

  return { run: run };
});
