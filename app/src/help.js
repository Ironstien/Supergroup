import {
  RANK_META,
  RANK_ORDER,
  RANK_THRESHOLDS,
  goalStatus,
  overallRankRule,
} from './ranks.js';

function rankRow(rank) {
  const meta = RANK_META[rank];
  const min = RANK_THRESHOLDS.find((tier) => tier.rank === rank)?.min ?? 0;
  const max =
    rank === 'S'
      ? 100
      : (RANK_THRESHOLDS.find((tier) => tier.min > min)?.min ?? 100) - 1;

  return `
    <div class="help-rank-pill help-rank-pill--${rank}">
      <span class="help-rank-pill__badge">${rank}</span>
      <div class="help-rank-pill__body">
        <div class="help-rank-pill__label">${meta.label}</div>
        <div class="help-rank-pill__range">${min}–${max} / 100</div>
      </div>
    </div>`;
}

function goalTierTable(goal, title) {
  const rows = RANK_ORDER.map((rank) => {
    const min = RANK_THRESHOLDS.find((tier) => tier.rank === rank)?.min ?? 0;
    return `<tr><td><span class="help-rank-chip help-rank-chip--${rank}">${rank}</span></td><td>≥ ${min}</td><td>${goalStatus(goal, rank)}</td></tr>`;
  }).join('');

  return `
    <h3 class="help-section__subtitle">${title}</h3>
    <table class="help-table">
      <thead>
        <tr><th>Rank</th><th>Score</th><th>Outcome</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

export function renderHelpPage() {
  return `
    <div class="help-page">
      <div class="game-header">
        <div>
          <h1 class="game-header__title">HELP</h1>
          <div class="game-header__meta">How to play &amp; how scoring works</div>
        </div>
        <div class="game-header__actions">
          <button class="btn-secondary" id="help-back">Back</button>
        </div>
      </div>

      <section class="help-section">
        <h2 class="help-section__title">How to play</h2>
        <p class="help-section__lead">
          You get five band spins. Each spin lands on a real band from a specific era. Pick one musician
          and assign them to an open slot: Vocals, Guitar, Bass, Drums, or Producer.
        </p>
        <p>
          Fill all five slots, then submit. The game scores Charts, Tour, and Reviews out of 100, assigns
          each a letter rank, and rolls up an overall grade.
        </p>
      </section>

      <section class="help-section">
        <h2 class="help-section__title">The six ranks</h2>
        <p class="help-section__lead">
          Every goal and your final grade use the same six-tier ladder. The rank letter and colour reflect
          how high your score landed.
        </p>
        <div class="help-rank-list">
          ${RANK_ORDER.map(rankRow).join('')}
        </div>
      </section>

      <section class="help-section">
        <h2 class="help-section__title">The three goals</h2>
        <p class="help-section__lead">
          Each goal shows a score out of 100 and a rank badge. Status text describes what that tier means
          for that goal.
        </p>

        <div class="help-goal-demos">
          <div class="goal-card goal-card--rank-A help-goal-demo">
            <div class="goal-card__rank">A</div>
            <div class="goal-card__title">Charts</div>
            <div class="goal-card__score">84<span class="goal-card__score-denom">/100</span></div>
            <div class="goal-card__status">Top 10 album</div>
          </div>
          <div class="goal-card goal-card--rank-D help-goal-demo">
            <div class="goal-card__rank">D</div>
            <div class="goal-card__title">Tour</div>
            <div class="goal-card__score">56<span class="goal-card__score-denom">/100</span></div>
            <div class="goal-card__status">Half-empty rooms</div>
          </div>
        </div>

        ${goalTierTable('charts', 'Charts')}
        ${goalTierTable('tour', 'Tour')}
        ${goalTierTable('reviews', 'Reviews')}
      </section>

      <section class="help-section">
        <h2 class="help-section__title">Overall grade</h2>
        <p class="help-section__lead">
          Your final grade uses the same ranks and colours as the goals. It blends the three scores with
          a weakest-goal cap — one bad night can drag the whole band down.
        </p>

        <div class="help-grade-list">
          ${RANK_ORDER.map((rank) => {
            const meta = RANK_META[rank];
            const superClass = rank === 'S' ? ' help-grade-demo--super' : '';
            return `
            <div class="help-grade-demo help-grade-demo--${rank}${superClass}">
              <div class="help-grade-demo__letter">${rank}</div>
              <div>
                <div class="help-grade-demo__label">${meta.label}</div>
                <p class="help-grade-demo__desc">${overallRankRule(rank)}</p>
              </div>
            </div>`;
          }).join('')}
        </div>

        <p>
          In short: <strong>S</strong> needs every goal at S. <strong>A</strong> needs every goal at A or
          better. <strong>B</strong> needs every goal at B or better. Otherwise your average score sets the
          tier, but you cannot finish more than one rank above your worst goal.
        </p>
      </section>

      <section class="help-section">
        <h2 class="help-section__title">FAB FIVE stats</h2>
        <p class="help-section__lead">
          Musician stats on a 0–99 scale feed the hidden goal scores. Slot ratings decide who can fill each role.
        </p>
        <dl class="help-stat-list">
          <div><dt>VOX</dt><dd>Singing, lyrics, front-person presence</dd></div>
          <div><dt>PLAY</dt><dd>Instrument skill</dd></div>
          <div><dt>GROOVE</dt><dd>Time, pocket, rhythm-section feel</dd></div>
          <div><dt>STAR</dt><dd>Fame, charisma, headline draw</dd></div>
          <div><dt>DESK</dt><dd>Writing, producing, arrangement</dd></div>
        </dl>
        <p>
          Musicians need a slot rating of at least <strong>75</strong> to be eligible for that slot.
          Charts leans STAR, DESK, VOX. Tour leans STAR, GROOVE, VOX. Reviews leans DESK, PLAY.
        </p>
      </section>
    </div>`;
}

export function bindHelpEvents(onBack) {
  document.getElementById('help-back')?.addEventListener('click', onBack);
}
