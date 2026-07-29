import "./styles.css";

const studyStops = Array.from(
  { length: 20 },
  (_, index) =>
    `<span class="route-stop${index === 0 ? " is-current" : ""}" aria-hidden="true"></span>`
).join("");

export function bootApp(root: HTMLElement): void {
  root.innerHTML = `
    <div class="app-frame">
      <header class="topbar">
        <a class="brand" href="#/home" aria-label="AIF Field Guide home">
          <span class="brand-mark" aria-hidden="true">AIF</span>
          <span>
            <strong>AIF Field Guide</strong>
            <small>Certified AI Practitioner</small>
          </span>
        </a>
        <span class="target-chip">Target · Aug 31</span>
      </header>

      <main id="main-content" aria-labelledby="page-title">
        <section class="route-card" aria-labelledby="route-title">
          <div class="section-label">
            <span>Rapid acquisition route</span>
            <strong>0 / 20 hours</strong>
          </div>
          <div class="route-line" aria-hidden="true">${studyStops}</div>
          <p id="route-title">Your first stop is a balanced AWS diagnostic.</p>
        </section>

        <section class="daily-ticket">
          <div>
            <p class="eyebrow">Today's practice</p>
            <h1 id="page-title">AWS AI Practitioner</h1>
            <p class="lead">
              One focused group. Submit once, then review every explanation.
            </p>
          </div>
          <button class="primary-action" type="button" data-action="start-daily">
            Start 25 questions
            <span aria-hidden="true">→</span>
          </button>
          <dl class="ticket-meta">
            <div><dt>Mode</dt><dd>Adaptive</dd></div>
            <div><dt>Answers</dt><dd>After submit</dd></div>
            <div><dt>Timer</dt><dd>None</dd></div>
          </dl>
        </section>

        <section class="domain-board" aria-labelledby="domain-title">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Exam map</p>
              <h2 id="domain-title">Five domains, one route</h2>
            </div>
            <span>Diagnostic pending</span>
          </div>
          <ol class="domain-list">
            <li><b>01</b><span>AI & ML fundamentals</span><em>20%</em></li>
            <li><b>02</b><span>Generative AI</span><em>24%</em></li>
            <li><b>03</b><span>Foundation models</span><em>28%</em></li>
            <li><b>04</b><span>Responsible AI</span><em>14%</em></li>
            <li><b>05</b><span>Security & governance</span><em>14%</em></li>
          </ol>
        </section>
      </main>

      <nav class="bottom-nav" aria-label="Primary">
        <a class="is-active" href="#/home">Today</a>
        <a href="#/library">Library</a>
        <a href="#/cheatsheet">Cheat sheet</a>
        <a href="#/settings">Settings</a>
      </nav>
    </div>
  `;
}

const root = document.querySelector<HTMLElement>("#app");
if (root) {
  bootApp(root);
}
