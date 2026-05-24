// ── Module-level constants ────────────────────────────────────────────────────

// Grid order: orders/products on top, order_items/returns on bottom.
// This keeps vertical arrows in the same column (orders↓order_items, products↓returns)
// and limits the diagonal to one cross-column FK (products→order_items).
const TABLE_ORDER = ['orders', 'products', 'order_items', 'returns'];

const TABLE_META = {
    orders:      { icon: '🧾', label: 'orders' },
    products:    { icon: '📦', label: 'products' },
    order_items: { icon: '📋', label: 'order_items' },
    returns:     { icon: '↩️',  label: 'returns' },
};

const QUERIES = [
    {
        title: 'יומן השכרות',
        description: 'כל פריטי ההשכרה עם תאריך יעד להחזרה, מוקדם ראשון',
        sql: `SELECT
  p.name                                          AS product,
  o.customer_name                                 AS customer,
  oi.quantity,
  oi.rent_days,
  date(o.created_at)                              AS rented_on,
  date(o.created_at, oi.rent_days || ' days')     AS due_on
FROM order_items oi
JOIN orders   o ON o.id  = oi.order_id
JOIN products p ON p.id  = oi.product_id
WHERE p.type = 'rent'
ORDER BY due_on ASC`,
    },
    {
        title: 'שעת שיא',
        description: 'שעות היממה עם הכי הרבה הזמנות, יורד',
        sql: `SELECT
  CAST(substr(created_at, 12, 2) AS INTEGER) AS hour,
  COUNT(*)                                   AS orders_count
FROM orders
GROUP BY hour
ORDER BY orders_count DESC
LIMIT 10`,
    },
    {
        title: 'מוצרים פופולריים',
        description: 'דירוג מוצרים לפי סך יחידות שהוזמנו',
        sql: `SELECT
  p.name,
  p.type,
  SUM(oi.quantity) AS total_units
FROM order_items oi
JOIN products p ON p.id = oi.product_id
GROUP BY p.id, p.name, p.type
ORDER BY total_units DESC`,
    },
    {
        title: 'השכרות באיחור',
        description: 'פריטים שחלף מועד ההחזרה שלהם - לא כולל מוחזרים',
        sql: `SELECT
  p.name          AS product,
  o.customer_name AS customer,
  oi.rent_days,
  date(o.created_at, oi.rent_days || ' days')         AS due_on,
  CAST(julianday('now') - julianday(o.created_at)
       AS INTEGER) - oi.rent_days                     AS days_late
FROM order_items oi
JOIN orders   o ON o.id = oi.order_id
JOIN products p ON p.id = oi.product_id
WHERE p.type = 'rent'
  AND datetime(o.created_at, oi.rent_days || ' days') < datetime('now')
  AND NOT EXISTS (
        SELECT 1 FROM returns r
        WHERE r.product_id = oi.product_id
          AND r.first_name || ' ' || r.last_name = o.customer_name
      )
ORDER BY days_late DESC`,
    },
    {
        title: 'סיכום החזרות',
        description: 'כמה פעמים כל מוצר הוחזר, ומתי הפעם האחרונה',
        sql: `SELECT
  product_name,
  COUNT(*)               AS return_count,
  MAX(date(returned_at)) AS last_return
FROM returns
GROUP BY product_id, product_name
ORDER BY return_count DESC`,
    },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function escHtml(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function highlightSQL(sql) {
    const KEYWORDS = new Set([
        'select','from','where','join','on','group','by','order','limit',
        'count','sum','max','min','avg','as','and','not','exists','cast',
        'left','inner','outer','distinct','having','or','is','null','in',
        'like','datetime','julianday','strftime','substr','coalesce','printf',
        'date','integer','text','real','asc','desc','with',
    ]);

    const tokens = [];
    let i = 0;
    while (i < sql.length) {
        if (sql[i] === '-' && sql[i + 1] === '-') {
            const end = sql.indexOf('\n', i);
            const s = end === -1 ? sql.slice(i) : sql.slice(i, end);
            tokens.push({ type: 'comment', value: s });
            i += s.length;
        } else if (sql[i] === "'") {
            let j = i + 1;
            while (j < sql.length && sql[j] !== "'") j++;
            tokens.push({ type: 'string', value: sql.slice(i, j + 1) });
            i = j + 1;
        } else if (/\d/.test(sql[i])) {
            let j = i;
            while (j < sql.length && /[\d.]/.test(sql[j])) j++;
            tokens.push({ type: 'number', value: sql.slice(i, j) });
            i = j;
        } else if (/[a-zA-Z_]/.test(sql[i])) {
            let j = i;
            while (j < sql.length && /[a-zA-Z0-9_]/.test(sql[j])) j++;
            const word = sql.slice(i, j);
            tokens.push({ type: KEYWORDS.has(word.toLowerCase()) ? 'keyword' : 'ident', value: word });
            i = j;
        } else {
            tokens.push({ type: 'other', value: sql[i] });
            i++;
        }
    }

    return tokens.map(({ type, value }) => {
        const v = escHtml(value);
        if (type === 'keyword') return `<span class="sql-kw">${v}</span>`;
        if (type === 'string')  return `<span class="sql-str">${v}</span>`;
        if (type === 'number')  return `<span class="sql-num">${v}</span>`;
        if (type === 'comment') return `<span class="sql-comment">${v}</span>`;
        return v;
    }).join('');
}

async function runApiQuery(sql) {
    const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Query failed');
    return data.rows || [];
}

// ── Page class ────────────────────────────────────────────────────────────────

export class DatabasePage {
    static ROUTE = 'database';
    static URL = '#database';

    constructor(app) {
        this.app = app;
    }

    // ── render ──────────────────────────────────────────────────────────────

    render() {
        return `
<style>
.db-page { padding: 32px 24px; }
.db-section-card { padding: 28px; margin-bottom: 32px; }

/* Schema grid */
.db-schema-wrapper { position: relative; }
.db-schema-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    direction: ltr;
}
.db-table-card {
    background: #f8fafc;
    border: 2px solid #d0dce8;
    border-radius: 12px;
    overflow: hidden;
}
.db-table-header {
    background: var(--color-header-bg, #0e4156);
    color: #fff;
    padding: 10px 16px;
    font-weight: 700;
    font-size: 0.93rem;
    display: flex;
    align-items: center;
    gap: 8px;
    direction: ltr;
}
.db-col-row {
    display: grid;
    grid-template-columns: 1fr auto auto;
    gap: 8px;
    padding: 6px 14px;
    border-bottom: 1px solid #e8eef4;
    font-size: 0.81rem;
    align-items: center;
    direction: ltr;
}
.db-col-row:last-child { border-bottom: none; }
.db-col-name { font-weight: 600; color: #1a2e44; font-family: monospace; }
.db-col-type { color: #6b7a8d; font-size: 0.77rem; font-family: monospace; }
.db-badge-pk { background: #fee195; color: #7a5800; padding: 1px 7px; border-radius: 4px; font-size: 0.7rem; font-weight: 700; }
.db-badge-fk { background: #ccf0eb; color: #0d6677; padding: 1px 7px; border-radius: 4px; font-size: 0.7rem; font-weight: 700; }

/* FK arrows SVG */
.db-fk-svg {
    position: absolute; top: 0; left: 0;
    width: 100%; height: 100%;
    pointer-events: none;
    overflow: visible;
}

/* SQL block */
.db-sql-pre {
    background: #0d1b2a;
    border-radius: 10px;
    padding: 14px 18px;
    overflow-x: auto;
    margin: 12px 0;
    direction: ltr;
}
.db-sql-pre code {
    font-family: 'Menlo', 'Consolas', 'Courier New', monospace;
    font-size: 0.8rem;
    line-height: 1.65;
    white-space: pre;
    color: #c9d1d9;
}
.sql-kw      { color: #79c0ff; font-weight: 600; }
.sql-str     { color: #a5f3a5; }
.sql-num     { color: #ffa7a7; }
.sql-comment { color: #5a6a7a; font-style: italic; }

/* Results table */
.db-results-wrap {
    overflow-x: auto;
    border-radius: 8px;
    border: 1px solid #d0dce8;
    margin-top: 2px;
}
.db-results-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.82rem;
    direction: ltr;
    text-align: left;
}
.db-results-table th {
    background: #f0f4f8;
    padding: 7px 14px;
    font-weight: 700;
    color: #1a2e44;
    border-bottom: 2px solid #c8d6e4;
    white-space: nowrap;
}
.db-results-table td {
    padding: 6px 14px;
    border-bottom: 1px solid #eaf0f6;
    color: #374151;
    font-family: monospace;
    font-size: 0.8rem;
}
.db-results-table tr:last-child td { border-bottom: none; }
.db-results-table tbody tr:hover td { background: #f5f8fb; }

/* State placeholders */
.db-placeholder {
    display: flex; align-items: center; justify-content: center;
    min-height: 80px; color: #8a9ab0; font-size: 0.88rem;
}
.db-error-msg { color: var(--color-accent, #f06a73); text-align: center; padding: 16px; font-size: 0.88rem; }
.db-no-rows   { text-align: center; padding: 20px; color: #8a9ab0; font-size: 0.88rem; }
</style>

<div class="inventory-dashboard-shell db-page">

    <div class="catalog-header-wrapper" style="margin-bottom: 28px;">
        <h1 style="color: var(--color-header-bg); margin: 0 0 6px;">מסד הנתונים - AguGo</h1>
        <p style="color: #5a6a7a; margin: 0; font-size: 0.95rem;">סכמת טבלאות, קשרי מפתחות זרים ושאילתות SQL חיות</p>
    </div>

    <!-- ── Schema visualisation ─────────────────────────────────────────── -->
    <section class="card db-section-card">
        <div class="eyebrow" style="margin-bottom: 20px;">סכמת מסד הנתונים</div>
        <div id="db-schema-area" class="db-schema-wrapper">
            <div class="db-placeholder" id="schema-loading-msg">טוען סכמה...</div>
        </div>
        <p style="margin-top:16px; font-size:0.8rem; color:#8a9ab0; direction:ltr; text-align:left;">
            ── FK (תלות)&nbsp;&nbsp;&nbsp;- - FK cross-column
        </p>
    </section>

    <!-- ── Query cards ──────────────────────────────────────────────────── -->
    <div class="eyebrow" style="margin-bottom: 20px;">שאילתות SQL חיות</div>

    ${QUERIES.map((q, i) => `
    <div class="card db-section-card" style="margin-bottom:24px;">
        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:6px; flex-wrap:wrap;">
            <div>
                <div class="eyebrow">${escHtml(q.title)}</div>
                <p style="color:#5a6a7a; font-size:0.87rem; margin:4px 0 0;">${escHtml(q.description)}</p>
            </div>
            <button class="action-button" data-action="run-query" data-query-index="${i}" style="flex-shrink:0; white-space:nowrap;">
                ↺ הרץ שוב
            </button>
        </div>
        <div class="db-sql-pre"><code>${highlightSQL(q.sql)}</code></div>
        <div id="qr-${i}"><div class="db-placeholder">טוען תוצאות...</div></div>
    </div>
    `).join('')}

</div>`;
    }

    // ── afterRender ─────────────────────────────────────────────────────────

    async afterRender() {
        await Promise.all([
            this._loadSchema(),
            ...QUERIES.map((_, i) => this._runQuery(i)),
        ]);
    }

    // ── Schema loading ───────────────────────────────────────────────────────

    async _loadSchema() {
        const area = document.getElementById('db-schema-area');
        if (!area) return;

        try {
            // Fetch column lists and FK lists in parallel
            const colResults = await Promise.all(
                TABLE_ORDER.map(t => runApiQuery(`PRAGMA table_info(${t})`))
            );
            const fkResults = await Promise.all(
                TABLE_ORDER.map(t => runApiQuery(`PRAGMA foreign_key_list(${t})`))
            );

            const colsMap = Object.fromEntries(TABLE_ORDER.map((t, i) => [t, colResults[i]]));
            const fkMap   = Object.fromEntries(TABLE_ORDER.map((t, i) => [t, fkResults[i]]));

            const fkCols = (table) => new Set((fkMap[table] || []).map(fk => fk.from));

            const cardsHtml = TABLE_ORDER.map(table => {
                const cols = colsMap[table] || [];
                const fks  = fkCols(table);
                const meta = TABLE_META[table];
                return `
<div class="db-table-card" id="dbt-${table}">
    <div class="db-table-header">
        <span aria-hidden="true">${meta.icon}</span>
        <span>${escHtml(meta.label)}</span>
    </div>
    <div>
        ${cols.map(col => `
        <div class="db-col-row">
            <span class="db-col-name">${escHtml(col.name)}</span>
            <span class="db-col-type">${escHtml(col.type)}</span>
            <span>
                ${col.pk  ? '<span class="db-badge-pk">PK</span>' : ''}
                ${fks.has(col.name) ? '<span class="db-badge-fk">FK</span>' : ''}
            </span>
        </div>`).join('')}
    </div>
</div>`;
            }).join('');

            area.innerHTML = `
<div class="db-schema-grid" id="db-grid">${cardsHtml}</div>
<svg class="db-fk-svg" id="db-svg" aria-hidden="true"></svg>`;

            // Two rAF ticks: first lets grid lay out, second reads final rects
            requestAnimationFrame(() => requestAnimationFrame(() => this._drawArrows()));

        } catch (err) {
            area.innerHTML = `<div class="db-error-msg">שגיאה בטעינת הסכמה: ${escHtml(err.message)}</div>`;
        }
    }

    _drawArrows() {
        const area = document.getElementById('db-schema-area');
        const svg  = document.getElementById('db-svg');
        if (!area || !svg) return;

        const base = area.getBoundingClientRect();

        const box = (id) => {
            const el = document.getElementById(id);
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return {
                top:   r.top    - base.top,
                bot:   r.bottom - base.top,
                left:  r.left   - base.left,
                right: r.right  - base.left,
                midX:  (r.left + r.right)  / 2 - base.left,
                midY:  (r.top  + r.bottom) / 2 - base.top,
            };
        };

        const ord = box('dbt-orders');
        const pro = box('dbt-products');
        const oi  = box('dbt-order_items');
        const ret = box('dbt-returns');
        if (!ord || !pro || !oi || !ret) return;

        // Update SVG height to cover the whole area
        svg.style.height = `${area.scrollHeight}px`;

        // Arrow 1: orders → order_items  (vertical, left column)
        const vmid1 = (ord.bot + oi.top) / 2;
        const path1 = `M ${ord.midX} ${ord.bot} C ${ord.midX} ${vmid1}, ${oi.midX} ${vmid1}, ${oi.midX} ${oi.top}`;

        // Arrow 2: products → returns  (vertical, right column)
        const vmid2 = (pro.bot + ret.top) / 2;
        const path2 = `M ${pro.midX} ${pro.bot} C ${pro.midX} ${vmid2}, ${ret.midX} ${vmid2}, ${ret.midX} ${ret.top}`;

        // Arrow 3: products → order_items  (cross-column, dashed)
        // Route from products left edge → gap midpoint → order_items right edge
        const gapX = (oi.right + pro.left) / 2;
        const path3 = `M ${pro.left} ${pro.midY} C ${gapX} ${pro.midY}, ${gapX} ${oi.midY}, ${oi.right} ${oi.midY}`;

        const TEAL  = '#0d6677';
        const CORAL = '#f06a73';

        svg.innerHTML = `
<defs>
    <marker id="mkt" markerWidth="9" markerHeight="9" refX="8" refY="3.5" orient="auto">
        <path d="M0,0 L0,7 L9,3.5 z" fill="${TEAL}"/>
    </marker>
    <marker id="mkc" markerWidth="9" markerHeight="9" refX="8" refY="3.5" orient="auto">
        <path d="M0,0 L0,7 L9,3.5 z" fill="${CORAL}"/>
    </marker>
</defs>
<path d="${path1}" stroke="${TEAL}"  stroke-width="2" fill="none" marker-end="url(#mkt)" stroke-opacity="0.8"/>
<path d="${path2}" stroke="${TEAL}"  stroke-width="2" fill="none" marker-end="url(#mkt)" stroke-opacity="0.8"/>
<path d="${path3}" stroke="${CORAL}" stroke-width="2" fill="none" marker-end="url(#mkc)" stroke-opacity="0.8" stroke-dasharray="6 3"/>`;
    }

    // ── Query execution ──────────────────────────────────────────────────────

    async _runQuery(index) {
        const container = document.getElementById(`qr-${index}`);
        if (!container) return;

        container.innerHTML = `<div class="db-placeholder">מריץ שאילתה...</div>`;

        try {
            const rows = await runApiQuery(QUERIES[index].sql);
            container.innerHTML = this._tableHtml(rows);
        } catch (err) {
            container.innerHTML = `<div class="db-error-msg">שגיאה: ${escHtml(err.message)}</div>`;
        }
    }

    _tableHtml(rows) {
        if (!rows || rows.length === 0) {
            return `<div class="db-no-rows">אין תוצאות</div>`;
        }
        const cols = Object.keys(rows[0]);
        return `
<div class="db-results-wrap">
<table class="db-results-table">
    <thead><tr>${cols.map(c => `<th>${escHtml(c)}</th>`).join('')}</tr></thead>
    <tbody>
        ${rows.map(row =>
            `<tr>${cols.map(c => `<td>${escHtml(row[c] ?? '')}</td>`).join('')}</tr>`
        ).join('')}
    </tbody>
</table>
</div>`;
    }

    // ── Event handlers ───────────────────────────────────────────────────────

    handleClick(event) {
        const btn = event.target.closest('[data-action="run-query"]');
        if (!btn) return;
        const idx = parseInt(btn.dataset.queryIndex, 10);
        if (!isNaN(idx)) this._runQuery(idx);
    }

    handleChange() {}
    handleSubmit() {}
}
