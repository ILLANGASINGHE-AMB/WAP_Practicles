# GradePath

A GPA and degree-class planner for undergraduates. Enter the courses you have
completed, see your cumulative GPA and the class you are currently on, and find
out what average you still need over your remaining credits to reach the class
you want.

Built for IIC 2223 Web Application Development, Laboratory Exercise 1 - Part 1.

## Running it

No build step, no server, no dependencies.

    open index.html          # macOS
    xdg-open index.html      # Linux

Or open `dist/gradepath.html`, which is the whole application inlined into one
file you can email or carry on a USB stick.

## The essential user journey

1. Add a course: semester, code, credits, grade.
2. The headline GPA, degree class and credit counts update immediately.
3. Choose a target class and the credits you still have to take.
4. The planner states the average you need, the grade that corresponds to, and
   whether the target is secured, still open, or out of reach.

## Features

- Credit-weighted GPA on the 4.00 scale, cumulative and per semester.
- Degree class against the published boundaries, plus the gap to the next class.
- Cumulative GPA trend chart with a hover readout and a dashed target line.
- Target planner that solves for the average still required and reports
  unreachable targets instead of printing an impossible number.
- Repeat handling: exclude a superseded attempt without deleting it.
- MC, W and I are recorded but kept out of the GPA arithmetic.
- Everything is saved in the browser. Export and import as JSON.
- A first visit opens on a labelled example transcript, so the page shows what it
  does before you have typed anything. Clear all replaces it with your own.
- Light and dark themes, keyboard accessible, responsive to phone width.

## Grading rules

| Grade | Points | | Grade | Points |
|---|---|---|---|---|
| A+ | 4.00 | | C+ | 2.30 |
| A  | 4.00 | | C  | 2.00 |
| A- | 3.70 | | C- | 1.70 |
| B+ | 3.30 | | D+ | 1.30 |
| B  | 3.00 | | D  | 1.00 |
| B- | 2.70 | | E  | 0.00 |

MC, W and I carry credits but never enter the GPA. Credits count as passed at
grade C (2.00) or above.

Award boundaries: First Class 3.70, Second Class Upper 3.30, Second Class Lower
3.00, General Pass 2.00.

These constants live at the top of `assets/gpa.js`. Change them there if your
programme uses different ones.

## Layout

    index.html          markup only
    assets/styles.css   design tokens and layout
    assets/gpa.js       the GPA engine: pure functions, no DOM
    assets/app.js       rendering, events, storage
    tests/run.js        engine tests, no dependencies
    tests/tests.js      the assertions, shared by both runners
    tests/tests.html    the same tests in a browser
    tests/ui.test.js    the user journey through a real DOM (needs jsdom)
    build.js            inlines everything into dist/
    dist/gradepath.html single-file build

## Tests

    node tests/run.js        # 14 engine tests, no install needed
    npm i jsdom
    node tests/ui.test.js    # 16 journey tests through the real DOM

`tests/tests.html` runs the engine tests in a browser if you prefer to see them
there.

## Privacy

Nothing leaves the browser. There is no backend, no account and no analytics.
Grades are held in `localStorage` under `gradepath.v1` and are cleared by the
Clear all button.

## Caveat

Always check the figures against your official academic record before relying on
them for a decision.
