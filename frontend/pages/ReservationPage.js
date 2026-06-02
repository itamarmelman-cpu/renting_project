import { CatalogPage } from './CatalogPage.js';

/**
 * ReservationPage
 * ─────────────────────────────────────────────────────────────────────────────
 * Lets a student reserve products in advance.
 *
 * Policy enforced server-side and displayed prominently to the user:
 *   • Reservation immediately removes items from the available inventory.
 *   • The reservation is valid for up to 5 days.
 *   • If not collected in time it is auto-cancelled and stock is restored.
 */
export class ReservationPage {
    static ROUTE = 'reserve';
    static URL   = '#reserve';
    static FAQ   = [
        {
            q: 'מה זו הזמנה מוקדמת?',
            a: 'הזמנה מוקדמת מאפשרת לך לשריין פריטים מראש לפני שמגיעים לאסוף. '
             + 'הפריטים מוסרים מהמלאי הזמין מיד עם אישור ההזמנה.',
        },
        {
            q: 'כמה זמן ההזמנה תקפה?',
            a: 'ההזמנה המוקדמת תקפה ל-5 ימים מיום ביצועה. '
             + 'אם לא תאסוף את ההזמנה בתוך 5 ימים היא תבוטל אוטומטית והמוצרים יוחזרו למלאי.',
        },
        {
            q: 'האם ניתן לבטל הזמנה מוקדמת?',
            a: 'ניתן לפנות לצוות הארגון לביטול ההזמנה. הצוות יטפל בבקשה בהקדם.',
        },
    ];

    constructor(app) {
        this.app             = app;
        this._step           = 'form';   // 'form' | 'success'
        this._confirmation   = null;     // { reservation: {...} } on success
        this._errors         = [];

        this.selectors = {
            form:           '[data-reservation-form]',
            firstNameInput: '#res-first-name',
            lastNameInput:  '#res-last-name',
            qtyInput:       '.reservation-qty-input',
        };
    }

    // ── Navigation ────────────────────────────────────────────────────────────

    goToCatalog() {
        this.app.navigateTo(new CatalogPage(this.app));
    }

    // ── Rendering ─────────────────────────────────────────────────────────────

    render() {
        return this._step === 'success'
            ? this._renderSuccess()
            : this._renderForm();
    }

    /** Prominent policy banner — shown on both the form and the success screen. */
    _renderPolicyBanner() {
        return `
            <div class="reservation-policy-banner" role="note" aria-label="מדיניות הזמנה מוקדמת">
                <div class="reservation-policy-body">
                    <h3 class="reservation-policy-title">מדיניות הזמנה מוקדמת</h3>
                    <ul class="reservation-policy-list">
                        <li>בעת ביצוע ההזמנה, הפריטים מוסרים מהמלאי הזמין <strong>מיידית</strong>.</li>
                        <li>יש לאסוף את ההזמנה תוך <strong>5 ימים</strong> מיום ביצועה.</li>
                        <li>הזמנה שלא נאספה בזמן <strong>מבוטלת אוטומטית</strong> והמלאי מוחזר.</li>
                    </ul>
                </div>
            </div>
        `;
    }

    _renderForm() {
        const { app } = this;

        // Build product rows for every product that has stock > 0
        const availableProducts = app.products.filter(
            (p) => (app.getInventoryStock(p.id)) > 0
        );

        const productRows = availableProducts.length
            ? availableProducts.map((p) => {
                const stock = app.getInventoryStock(p.id);
                return `
                    <div class="reservation-product-row">
                        <div class="reservation-product-info">
                            <div class="reservation-product-details">
                                <span class="reservation-product-name">${app.escapeHtml(p.name)}</span>
                                <div class="reservation-product-meta">
                                    <span class="reservation-type-badge ${p.type === 'rent' ? 'badge-rent' : 'badge-buy'}">
                                        ${p.type === 'rent' ? 'השכרה' : 'רכישה'}
                                    </span>
                                    <span class="reservation-product-price">
                                        ${p.price.toFixed(0)} ₪${p.type === 'rent' ? ' / יום' : ''}
                                    </span>
                                    <span class="reservation-product-stock">
                                        זמין: ${stock}
                                    </span>
                                </div>
                            </div>
                        </div><!-- /.reservation-product-info -->
                        <div class="reservation-qty-wrap">
                            <label class="sr-only" for="qty-${p.id}">כמות ${app.escapeHtml(p.name)}</label>
                            <input
                                type="number"
                                id="qty-${p.id}"
                                class="reservation-qty-input text-input"
                                data-product-id="${p.id}"
                                min="0"
                                max="${stock}"
                                value="0"
                            >
                        </div>
                    </div>
                `;
            }).join('')
            : `<p class="reservation-empty-products">אין מוצרים זמינים כרגע להזמנה מוקדמת.</p>`;

        const errorsHtml = this._errors.length
            ? `<div class="reservation-errors" role="alert">
                   ${this._errors.map((e) => `<p>⚠️ ${app.escapeHtml(e)}</p>`).join('')}
               </div>`
            : '';

        return `
            <section class="card reservation-page">

                <div class="reservation-page-header">
                    <h1 class="reservation-page-title">הזמנה מוקדמת</h1>
                </div>

                ${this._renderPolicyBanner()}

                <form data-reservation-form class="reservation-form" novalidate>

                    <fieldset class="reservation-fieldset">
                        <legend class="reservation-legend">פרטי המזמין</legend>
                        <div class="reservation-name-row">
                            <div class="reservation-field-group">
                                <label class="reservation-field-label field-required" for="res-first-name">שם פרטי</label>
                                <input
                                    type="text"
                                    id="res-first-name"
                                    class="text-input"
                                    placeholder="לדוגמה: ישראל"
                                    required
                                    autocomplete="given-name"
                                >
                            </div>
                            <div class="reservation-field-group">
                                <label class="reservation-field-label field-required" for="res-last-name">שם משפחה</label>
                                <input
                                    type="text"
                                    id="res-last-name"
                                    class="text-input"
                                    placeholder="לדוגמה: ישראלי"
                                    required
                                    autocomplete="family-name"
                                >
                            </div>
                        </div>
                    </fieldset>

                    <fieldset class="reservation-fieldset">
                        <legend class="reservation-legend">בחר פריטים לשריון</legend>
                        <p class="reservation-fieldset-hint">
                            הזן כמות גדולה מ-0 לכל פריט שברצונך לשריין. פריטים עם כמות 0 לא ייכללו בהזמנה.
                        </p>
                        <div class="reservation-products-list">
                            ${productRows}
                        </div>
                    </fieldset>

                    ${errorsHtml}

                    <div class="reservation-actions">
                        <button
                            type="submit"
                            class="primary-button"
                        >
                            אשר הזמנה מוקדמת
                        </button>
                        <button type="button" class="secondary-button" data-action="back-to-catalog">
                            חזרה לקטלוג
                        </button>
                    </div>

                </form>
            </section>
        `;
    }

    _renderSuccess() {
        const { app }        = this;
        const { reservation} = this._confirmation;
        const expiryDate     = app.formatDate(reservation.expiresAt);

        const itemsList = (reservation.items || []).map((item) => {
            const product = app.getProductById(item.productId);
            const name    = product ? product.name : item.productId;
            return `<li class="reservation-success-item">
                        <span>${app.escapeHtml(name)}</span>
                        <span class="reservation-success-qty">${item.quantity} יח'</span>
                    </li>`;
        }).join('');

        return `
            <section class="card reservation-page">
                <div class="reservation-success">
                    <h2 class="reservation-success-title">ההזמנה המוקדמת אושרה</h2>
                    <p class="reservation-success-id">
                        מספר הזמנה: <strong>${app.escapeHtml(reservation.id)}</strong>
                    </p>
                    <div class="reservation-success-expiry">
                        <span>ההזמנה תקפה עד:</span>
                        <strong>${expiryDate}</strong>
                    </div>

                    <div class="reservation-success-items-wrap">
                        <h3>פריטים ששוריינו</h3>
                        <ul class="reservation-success-items-list">
                            ${itemsList}
                        </ul>
                    </div>

                    ${this._renderPolicyBanner()}

                    <button class="primary-button" data-action="back-to-catalog">
                        חזרה לקטלוג
                    </button>
                </div>
            </section>
        `;
    }

    // ── Event Handlers ────────────────────────────────────────────────────────

    afterRender() {
        // No async fetch needed — we use app.state.inventory directly.
        // The server validates stock on submit, so stale local data only
        // affects the UI hint; the reservation itself is always accurate.
    }

    handleClick(event) {
        if (event.target.closest('[data-action="back-to-catalog"]')) {
            this.goToCatalog();
        }
    }

    handleSubmit(event) {
        if (event.target.closest(this.selectors.form)) {
            event.preventDefault();
            void this._submitReservation();
        }
    }

    // ── Submission ────────────────────────────────────────────────────────────

    async _submitReservation() {
        const { app } = this;
        this._errors  = [];

        const firstName = document.querySelector(this.selectors.firstNameInput)?.value?.trim() ?? '';
        const lastName  = document.querySelector(this.selectors.lastNameInput)?.value?.trim()  ?? '';

        if (!firstName || !lastName) {
            this._errors = ['נא למלא שם פרטי ושם משפחה.'];
            app.rerender();
            return;
        }

        const qtyInputs = document.querySelectorAll(this.selectors.qtyInput);
        const items     = [];
        for (const input of qtyInputs) {
            const qty = parseInt(input.value, 10);
            if (qty > 0) items.push({ productId: input.dataset.productId, quantity: qty });
        }

        if (items.length === 0) {
            this._errors = ['נא לבחור לפחות פריט אחד להזמנה.'];
            app.rerender();
            return;
        }

        const res = await fetch('/api/reservations', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ customerName: `${firstName} ${lastName}`, items }),
        });

        const body = await res.json();

        if (!res.ok || !body.ok) {
            this._errors = (body.errors || []).length
                ? body.errors
                : ['שגיאה ביצירת ההזמנה. נסה שוב.'];
            app.rerender();
            return;
        }

        // Backend deducted stock — sync local state
        await app.refreshFromBackend();

        this._confirmation = { reservation: body.reservation };
        this._step         = 'success';
        app.rerender();
    }
}
