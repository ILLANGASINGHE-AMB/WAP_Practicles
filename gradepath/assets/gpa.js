/*
 * GradePath - GPA engine
 * Pure functions only: no DOM, no storage. Runs in the browser and in Node,
 * so the same code is exercised by tests/run.js and by the app.
 */
(function (root, factory) {
  var api = factory();
  root.GPA = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* Grade points used by the BICT programme (4.00 scale). */
  var GRADE_POINTS = {
    'A+': 4.0, 'A': 4.0, 'A-': 3.7,
    'B+': 3.3, 'B': 3.0, 'B-': 2.7,
    'C+': 2.3, 'C': 2.0, 'C-': 1.7,
    'D+': 1.3, 'D': 1.0,
    'E': 0.0
  };

  /* Grades that carry credits but never enter the GPA arithmetic. */
  var NON_GPA_GRADES = { 'MC': 'Medical / approved absence', 'W': 'Withdrawn', 'I': 'Incomplete' };

  /* Lowest grade point that counts as a pass for credit accumulation. */
  var PASS_POINT = 2.0;

  /* Award boundaries, highest first. */
  var CLASSES = [
    { name: 'First Class', min: 3.7 },
    { name: 'Second Class (Upper)', min: 3.3 },
    { name: 'Second Class (Lower)', min: 3.0 },
    { name: 'General Pass', min: 2.0 }
  ];

  var SEMESTERS = ['Y1S1', 'Y1S2', 'Y2S1', 'Y2S2', 'Y3S1', 'Y3S2', 'Y4S1', 'Y4S2'];

  function gradeList() {
    return Object.keys(GRADE_POINTS).concat(Object.keys(NON_GPA_GRADES));
  }

  function isGpaGrade(grade) {
    return Object.prototype.hasOwnProperty.call(GRADE_POINTS, grade);
  }

  function points(grade) {
    return isGpaGrade(grade) ? GRADE_POINTS[grade] : null;
  }

  function credits(course) {
    var c = Number(course && course.credits);
    return isFinite(c) && c > 0 ? c : 0;
  }

  /* A course counts towards the GPA unless it is excluded (e.g. a superseded
     repeat attempt) or carries a non-GPA grade. */
  function countsToGpa(course) {
    if (!course || course.excluded) return false;
    return isGpaGrade(course.grade) && credits(course) > 0;
  }

  function round2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  /* Core aggregate over any list of courses. gpa is null when nothing counts. */
  function summarise(courses) {
    var list = Array.isArray(courses) ? courses : [];
    var qualityPoints = 0, gpaCredits = 0, passedCredits = 0, attempted = 0;

    list.forEach(function (course) {
      var cr = credits(course);
      if (!course || course.excluded || cr === 0) return;
      attempted += cr;
      if (!isGpaGrade(course.grade)) return;
      qualityPoints += cr * GRADE_POINTS[course.grade];
      gpaCredits += cr;
      if (GRADE_POINTS[course.grade] >= PASS_POINT) passedCredits += cr;
    });

    return {
      gpa: gpaCredits > 0 ? qualityPoints / gpaCredits : null,
      qualityPoints: qualityPoints,
      gpaCredits: gpaCredits,
      passedCredits: passedCredits,
      attemptedCredits: attempted,
      courseCount: list.length
    };
  }

  /* One row per semester that has at least one course, in curriculum order. */
  function bySemester(courses) {
    var list = Array.isArray(courses) ? courses : [];
    var order = SEMESTERS.slice();
    list.forEach(function (c) {
      if (c && c.semester && order.indexOf(c.semester) === -1) order.push(c.semester);
    });
    return order.map(function (sem) {
      var inSem = list.filter(function (c) { return c && c.semester === sem; });
      var s = summarise(inSem);
      s.semester = sem;
      s.courses = inSem;
      return s;
    }).filter(function (row) { return row.courses.length > 0; });
  }

  /* Cumulative GPA after each semester - the series the trend chart draws. */
  function cumulativeSeries(courses) {
    var running = [];
    return bySemester(courses).map(function (row) {
      running = running.concat(row.courses);
      var cum = summarise(running);
      return {
        semester: row.semester,
        semesterGpa: row.gpa,
        cumulativeGpa: cum.gpa,
        gpaCredits: cum.gpaCredits
      };
    });
  }

  function classify(gpa) {
    if (gpa === null || gpa === undefined || !isFinite(gpa)) return null;
    for (var i = 0; i < CLASSES.length; i++) {
      if (gpa >= CLASSES[i].min) return CLASSES[i];
    }
    return { name: 'Below General Pass', min: 0 };
  }

  function nextClassAbove(gpa) {
    if (gpa === null || gpa === undefined || !isFinite(gpa)) return CLASSES[CLASSES.length - 1];
    var above = CLASSES.filter(function (c) { return gpa < c.min; });
    return above.length ? above[above.length - 1] : null;
  }

  /*
   * What average GPA is needed over the remaining credits to finish on target?
   *   required = (target * (done + remaining) - qualityPoints) / remaining
   */
  function requiredAverage(summary, remainingCredits, targetGpa) {
    var rem = Number(remainingCredits);
    var target = Number(targetGpa);
    if (!isFinite(rem) || rem <= 0) return { error: 'Enter the credits you still have to take.' };
    if (!isFinite(target) || target <= 0) return { error: 'Choose a target.' };

    var done = summary.gpaCredits;
    var needed = (target * (done + rem) - summary.qualityPoints) / rem;
    var maxPoint = GRADE_POINTS['A+'];

    return {
      required: needed,
      target: target,
      remainingCredits: rem,
      secured: needed <= 0,               /* target already locked in */
      achievable: needed <= maxPoint,     /* still reachable at all */
      maxPossibleGpa: (summary.qualityPoints + rem * maxPoint) / (done + rem),
      minPossibleGpa: (summary.qualityPoints) / (done + rem)
    };
  }

  /* Grades from lowest to highest, so a search returns the cheapest option. */
  var GRADE_LADDER = ['E', 'D', 'D+', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'A+'];

  /* Lowest listed grade at or above a required average - a concrete target. */
  function gradeFor(pointValue) {
    for (var i = 0; i < GRADE_LADDER.length; i++) {
      if (GRADE_POINTS[GRADE_LADDER[i]] >= pointValue) return GRADE_LADDER[i];
    }
    return null;
  }

  return {
    GRADE_POINTS: GRADE_POINTS,
    GRADE_LADDER: GRADE_LADDER,
    NON_GPA_GRADES: NON_GPA_GRADES,
    CLASSES: CLASSES,
    SEMESTERS: SEMESTERS,
    PASS_POINT: PASS_POINT,
    gradeList: gradeList,
    isGpaGrade: isGpaGrade,
    points: points,
    countsToGpa: countsToGpa,
    round2: round2,
    summarise: summarise,
    bySemester: bySemester,
    cumulativeSeries: cumulativeSeries,
    classify: classify,
    nextClassAbove: nextClassAbove,
    requiredAverage: requiredAverage,
    gradeFor: gradeFor
  };
});
