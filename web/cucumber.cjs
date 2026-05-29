// Cucumber.js config (CommonJS so Node can load it without a TS
// loader). The features themselves and step definitions are TS;
// `tsx` (run via the npm script) registers a TS loader before
// cucumber-js boots, so the require()s below resolve correctly.
//
// Features live under web/src/test/features/ next to the rest of
// the test harness. Step definitions co-located under the same
// tree so a feature + its steps move together.

/** @type {import('@cucumber/cucumber').IConfiguration} */
module.exports = {
  default: {
    paths: ["src/test/features/**/*.feature"],
    // `support/**/*.ts` registers the custom World (Playwright
    // browser ownership) + the Before/After hooks. Cucumber only
    // discovers hooks from explicitly-imported files, so missing
    // `support/` here means scenarios run with the default World
    // and steps see `this.page` as undefined.
    import: [
      "src/test/features/support/**/*.ts",
      "src/test/features/step_definitions/**/*.ts",
    ],
    format: [
      "progress-bar",
      "summary",
      ["html", "src/test/reports/cucumber-report.html"],
    ],
    formatOptions: {
      snippetInterface: "async-await",
    },
    // Keep the default 5s step timeout — Playwright's own waiters
    // are how we ride out slow page loads.
  },
};
