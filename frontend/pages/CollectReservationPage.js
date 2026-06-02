import { LockerPage } from './LockerPage.js';

export class CollectReservationPage {
    static ROUTE = 'collect';
    static URL   = '#collect';

    constructor(app) {
        this.app          = app;
        this._step        = 'search'; // 'search' | 'confirm'
        this._reservation = null;
        this._rentDays    = {};
        this._errors      = [];

        this.selectors = {
            searchForm:     '[data-collect-search-form]',
            firstNameInput: '#collect-first-name',
            lastNameInput:  '#collect-last-name',
            paymentBtn:     '[data-action="collect-payment"]',
            backBtn:        '[data-action="collect-back"]',
            rentDaysInput:  '.collect-rent-days-input',
        };
    }

    render() {
        return this._step === 'confirm'
            ? this._renderConfirm()
            : this._renderSearch();
    }

    _renderSearch() {
        const errorsHtml = this._errors.length
            ? `<div class="reservation-errors" role="alert">
                   ${this._errors.map((e) => `<p>⚠️ ${this.app.escapeHtml(e)}</p>`).join('')}
               </div>`
            : '';

        return `
            <section class="card reservation-page">
                <div class="reservation-page-header">
                    <h1 class="reservation-page-title">איסוף הזמנה מוקדמת</h1>
                    <p class="reservation-page-subtitle">הכנס את שמך כדי למצוא את ההזמנה שלך</p>
                </div>
                <form data-collect-search-form class="reservation-form" novalidate>
                    <fieldset class="reservation-fieldset">
                        <legend class="reservation-legend">פרטי המזמין</legend>
                        <div class="reservation-name-row">
                            <div class="reservation-field-group">
                                <label class="reservation-field-label field-required" for="collect-first-name">שם פרטי</label>
                                <input type="text" id="collect-first-name" class="text-input"
                                    placeholder="לדוגמה: ישראל" required autocomplete="given-name">
                            </div>
                            <div class="reservation-field-group">
                                <label class="reservation-field-label field-required" for="collect-last-name">שם משפחה</label>
                                <input type="text" id="collect-last-name" class="text-input"
                                    placeholder="לדוגמה: ישראלי" required autocomplete="family-name">
                            </div>
                        </div>
                    </fieldset>
                    ${errorsHtml}
                    <div class="reservation-actions">
                        <button type="submit" class="primary-button">חפש הזמנה</button>
                        <button type="button" class="secondary-button btn-coral" data-route-link="catalog">חזרה לקטלוג</button>
                    </div>
                </form>
            </section>
        `;
    }

    _renderConfirm() {
        const { app } = this;
        const r = this._reservation;

        const itemRows = (r.items || []).map((item) => {
            const product  = app.getProductById(item.productId);
            const name     = product ? app.escapeHtml(product.name) : item.productId;
            const price    = product?.price || 0;
            const rentDays = this._rentDays[item.productId] || 1;
            const subtotal = (price * item.quantity * rentDays).toFixed(0);
            return `
                <div class="order-preview-item">
                    <div class="order-preview-item-header">
                        <span class="order-preview-name">${name}</span>
                        <strong class="order-preview-subtotal">${subtotal} ₪</strong>
                    </div>
                    <div class="collect-item-meta">
                        <span>כמות: <strong>${item.quantity}</strong></span>
                        <span>${price} ₪ ליום</span>
                    </div>
                    <div class="collect-days-row">
                        <label class="collect-days-label" for="days-${app.escapeHtml(item.productId)}">ימי השכרה</label>
                        <input
                            type="number"
                            id="days-${app.escapeHtml(item.productId)}"
                            class="collect-rent-days-input text-input"
                            data-product-id="${app.escapeHtml(item.productId)}"
                            min="1" max="30"
                            value="${rentDays}"
                        >
                    </div>
                </div>
            `;
        });

        const total = this._calcTotal();

        return `
            <section class="checkout-grid">
                <div class="card form-card">
                    <h2>הזמנה נמצאה</h2>
                    <p>שם: <strong>${app.escapeHtml(r.customerName)}</strong></p>
                    <p>תקפה עד: <strong>${app.formatDate(r.expiresAt)}</strong></p>
                    <p style="margin-top:var(--space-4)">בחר כמה ימים לשכור כל פריט, לאחר מכן בחר אמצעי תשלום:</p>
                    <div class="payment-actions" style="margin-top:var(--space-4)">
                        <button type="button" class="payment-button apple-pay"
                            data-action="collect-payment" data-provider="Apple Pay">Apple Pay</button>
                        <button type="button" class="payment-button google-pay"
                            data-action="collect-payment" data-provider="Google Pay">Google Pay</button>
                    </div>
                    <button type="button" class="secondary-button btn-coral" data-action="collect-back"
                        style="margin-top:var(--space-3)">חזרה לחיפוש</button>
                </div>

                <aside class="card order-panel">
                    <h2>סיכום הזמנה</h2>
                    <div class="order-preview-list">
                        ${itemRows.join('')}
                    </div>
                    <div class="order-preview-total">
                        <span>סך הכל</span>
                        <strong id="collect-total">${total} ₪</strong>
                    </div>
                </aside>
            </section>
        `;
    }

    afterRender() {
        if (this._step !== 'confirm') return;

        const updateTotal = () => {
            let total = 0;
            document.querySelectorAll(this.selectors.rentDaysInput).forEach((input) => {
                const productId = input.dataset.productId;
                const days      = Math.max(1, parseInt(input.value, 10) || 1);
                const item      = (this._reservation.items || []).find((i) => i.productId === productId);
                if (!item) return;
                const price    = this.app.getProductById(productId)?.price || 0;
                const subtotal = price * item.quantity * days;
                total += subtotal;
                const subtotalEl = input.closest('.order-preview-item')?.querySelector('.order-preview-subtotal');
                if (subtotalEl) subtotalEl.textContent = `${subtotal.toFixed(0)} ₪`;
            });
            const totalEl = document.getElementById('collect-total');
            if (totalEl) totalEl.textContent = `${total.toFixed(0)} ₪`;
        };

        document.querySelectorAll(this.selectors.rentDaysInput).forEach((input) => {
            input.addEventListener('input', updateTotal);
        });
    }

    handleSubmit(event) {
        if (event.target.closest(this.selectors.searchForm)) {
            event.preventDefault();
            void this._handleSearch();
        }
    }

    handleClick(event) {
        const paymentBtn = event.target.closest(this.selectors.paymentBtn);
        if (paymentBtn) {
            void this._submitPayment(paymentBtn.dataset.provider);
            return;
        }
        if (event.target.closest(this.selectors.backBtn)) {
            this._step        = 'search';
            this._reservation = null;
            this._errors      = [];
            this.app.rerender();
        }
    }

    // ── Private ───────────────────────────────────────────────────────────────

    async _handleSearch() {
        const firstName = document.querySelector(this.selectors.firstNameInput)?.value?.trim() ?? '';
        const lastName  = document.querySelector(this.selectors.lastNameInput)?.value?.trim()  ?? '';

        if (!firstName || !lastName) {
            this._errors = ['נא למלא שם פרטי ושם משפחה.'];
            this.app.rerender();
            return;
        }

        const fullName = `${firstName} ${lastName}`.toLowerCase();
        const now      = new Date().toISOString();

        let reservations;
        try {
            const res = await fetch('/api/reservations');
            if (!res.ok) throw new Error('server error');
            reservations = await res.json();
        } catch {
            this._errors = ['שגיאה בחיפוש ההזמנה. נסה שוב.'];
            this.app.rerender();
            return;
        }

        const reservation = reservations.find(
            (r) => r.status === 'active'
                && r.customerName.toLowerCase() === fullName
                && r.expiresAt > now
        );

        if (!reservation) {
            this._errors = ['לא נמצאה הזמנה פעילה על שמך. ייתכן שפגה תוקף ההזמנה.'];
            this.app.rerender();
            return;
        }

        this._reservation = reservation;
        for (const item of reservation.items) {
            this._rentDays[item.productId] = 1;
        }
        this._step   = 'confirm';
        this._errors = [];
        this.app.rerender();
    }

    _readRentDaysFromDom() {
        document.querySelectorAll(this.selectors.rentDaysInput).forEach((input) => {
            const val = Math.max(1, parseInt(input.value, 10) || 1);
            if (input.dataset.productId) this._rentDays[input.dataset.productId] = val;
        });
    }

    _calcTotal() {
        const { app } = this;
        return (this._reservation?.items || []).reduce((sum, item) => {
            const price    = app.getProductById(item.productId)?.price || 0;
            const rentDays = this._rentDays[item.productId] || 1;
            return sum + price * item.quantity * rentDays;
        }, 0).toFixed(0);
    }

    async _submitPayment(provider) {
        const { app } = this;
        this._readRentDaysFromDom();
        const r = this._reservation;

        const res = await fetch(`/api/reservations/${encodeURIComponent(r.id)}/collect`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ provider, rentDays: this._rentDays }),
        });

        const body = await res.json();
        if (!res.ok || !body.ok) {
            this._errors = [body.error || 'שגיאה באיסוף ההזמנה. נסה שוב.'];
            this.app.rerender();
            return;
        }

        await app.refreshFromBackend();

        // LockerPage reads this to display order details
        app.saveStoredJson('grabit.checkoutContext', {
            ...body.order,
            provider,
            fromReservation: r.id,
        });

        app.state.lockerOpen = false;
        app.navigateTo(new LockerPage(app));
    }
}
