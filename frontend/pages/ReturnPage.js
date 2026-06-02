export class ReturnPage {
    static ROUTE = 'return';
    static URL   = '#return';

    static FAQ = [
        { q: 'אילו פריטים ניתן להחזיר?',             a: 'הזן את שמך ואנחנו נאתר אוטומטית את כל ההשכרות הפעילות שלך.' },
        { q: 'האם ניתן להחזיר כמה פריטים בבת אחת?', a: 'כן! בחר את כל הפריטים הרצויים לפני פתיחת הלוקר.' },
        { q: 'מה קורה אחרי שנועלים את הלוקר?',      a: 'המערכת מעדכנת את המלאי ומציגה מסך אישור עם תודה על ההחזרה.' },
    ];

    constructor(app) {
        this.app = app;

        this._phase          = 'form';   // 'form' | 'lookup' | 'open' | 'done'
        this._savedFirstName = '';
        this._savedLastName  = '';
        this._rentals        = [];       // [{productId, productName, quantity, expiryDate}]
        this._selectedItems  = {};       // {productId: quantity}
        this._validatedItems = null;
        this._completedItems = [];
        this._searching      = false;
        this._formError      = null;
        this._lookupError    = null;
    }

    // ===== Rendering =====

    render() {
        switch (this._phase) {
            case 'lookup': return this._renderLookupStep();
            case 'open':   return this._renderOpenStep();
            case 'done':   return this._renderDoneScreen();
            default:       return this._renderFormStep();
        }
    }

    _renderFormStep() {
        const { app } = this;
        return `
            <div style="max-width:480px;margin:0 auto;padding:var(--space-5) var(--space-4)">
                <form class="card form-card" data-return-search-form>
                    <h1 style="margin-bottom:var(--space-3)">החזרת ציוד</h1>
                    <p style="color:var(--color-ink-soft);margin-bottom:var(--space-5)">
                        הזן את שמך ונאתר את ההשכרות הפעילות שלך.
                    </p>

                    <label class="field-group">
                        <span class="field-required">שם פרטי</span>
                        <input type="text" class="text-input" name="returnFirstName"
                               autocomplete="given-name" placeholder="לדוגמה: ישראל"
                               value="${app.escapeHtml(this._savedFirstName)}" />
                    </label>
                    <label class="field-group">
                        <span class="field-required">שם משפחה</span>
                        <input type="text" class="text-input" name="returnLastName"
                               autocomplete="family-name" placeholder="לדוגמה: ישראלי"
                               value="${app.escapeHtml(this._savedLastName)}" />
                    </label>

                    ${this._formError ? `
                        <div class="return-error-banner">
                            <strong>${app.escapeHtml(this._formError)}</strong>
                        </div>
                    ` : ''}

                    <div class="payment-actions" style="margin-top:var(--space-5)">
                        <button type="submit" class="primary-button"
                                ${this._searching ? 'disabled' : ''}>
                            ${this._searching ? 'מחפש...' : 'חיפוש הזמנות'}
                        </button>
                    </div>
                </form>
            </div>
        `;
    }

    _renderLookupStep() {
        const { app } = this;
        const anySelected = Object.keys(this._selectedItems).length > 0;
        const allSelected = this._rentals.length > 0 &&
            this._rentals.every(r => this._selectedItems[r.productId] !== undefined);

        return `
            <div style="max-width:560px;margin:0 auto;padding:var(--space-5) var(--space-4)">
                <div class="card form-card">
                    <div style="display:flex;align-items:center;gap:var(--space-3);margin-bottom:var(--space-2)">
                        <button type="button" class="return-back-btn" data-action="back-to-form"
                                title="חזרה">&#8592;</button>
                        <h2 style="margin:0">השכרות פעילות</h2>
                    </div>
                    <p style="color:var(--color-ink-soft);margin-bottom:var(--space-4)">
                        ${app.escapeHtml(this._savedFirstName)} ${app.escapeHtml(this._savedLastName)}
                         — בחר את הפריטים שברצונך להחזיר
                    </p>

                    <label class="return-select-all-label">
                        <input type="checkbox" data-action="select-all"
                               ${allSelected ? 'checked' : ''}>
                        <span>בחר הכל</span>
                    </label>

                    <div class="return-rentals-list">
                        ${this._rentals.map(r => this._renderRentalCard(r)).join('')}
                    </div>

                    ${this._lookupError ? `
                        <div class="return-error-banner" style="margin-top:var(--space-4)">
                            <strong>${app.escapeHtml(this._lookupError)}</strong>
                        </div>
                    ` : ''}

                    <div class="payment-actions" id="locker-actions" style="margin-top:var(--space-5)">
                        <button type="button" class="primary-button"
                                data-action="validate-and-open"
                                ${!anySelected ? 'disabled' : ''}>
                            פתיחת לוקר
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    _renderRentalCard(rental) {
        const { app } = this;
        const pid        = rental.productId;
        const isSelected = this._selectedItems[pid] !== undefined;
        const qty        = this._selectedItems[pid] ?? 1;
        const maxQty     = rental.quantity;

        const daysLeft   = (new Date(rental.expiryDate) - new Date()) / 86400000;
        const chipClass  = daysLeft < 0 ? 'chip-overdue' : daysLeft < 2 ? 'chip-urgent' : 'chip-ok';
        const expiryText = daysLeft < 0
            ? `פג תוקף — ${app.formatDate(rental.expiryDate)}`
            : `עד ${app.formatDate(rental.expiryDate)}`;

        return `
            <div class="return-rental-card ${isSelected ? 'return-rental-card--selected' : ''}">
                <label class="return-rental-main">
                    <input type="checkbox" data-action="toggle-item"
                           data-product-id="${pid}" ${isSelected ? 'checked' : ''}>
                    <div class="return-rental-info">
                        <strong>${app.escapeHtml(rental.productName)}</strong>
                        <span class="expiry-chip ${chipClass}">${expiryText}</span>
                        <span class="return-rental-avail">זמין להחזרה: ${maxQty}</span>
                    </div>
                </label>
                ${isSelected ? `
                    <div class="return-qty-control">
                        <button type="button" class="return-qty-btn"
                                data-action="dec-rental-qty" data-product-id="${pid}"
                                ${qty <= 1 ? 'disabled' : ''}>−</button>
                        <span class="return-qty-value">${qty}</span>
                        <button type="button" class="return-qty-btn"
                                data-action="inc-rental-qty" data-product-id="${pid}"
                                ${qty >= maxQty ? 'disabled' : ''}>+</button>
                    </div>
                ` : ''}
            </div>
        `;
    }

    _renderOpenStep() {
        return `
            <div class="locker-hero-grid">
                <section class="page-hero card">
                    <h1>החזרת ציוד</h1>
                    <ol class="locker-steps" id="locker-steps">
                        <li class="locker-step step-done" data-step="1">
                            <span class="step-num">1</span>
                            <div class="step-body">
                                <strong>בחר פריטים</strong>
                                <span>הפריטים נבחרו ואומתו</span>
                            </div>
                        </li>
                        <li class="locker-step step-active" data-step="2">
                            <span class="step-num">2</span>
                            <div class="step-body">
                                <strong>הנח פריטים בלוקר</strong>
                                <span>הכנס את הפריטים לתוך הלוקר</span>
                            </div>
                        </li>
                        <li class="locker-step step-pending" data-step="3">
                            <span class="step-num">3</span>
                            <div class="step-body">
                                <strong>צלם ונעל לוקר</strong>
                                <span>העלה תמונה ולחץ 'נעל לוקר'</span>
                            </div>
                        </li>
                    </ol>
                </section>

                <section class="locker-status-card locker-status-open" id="return-status-card">
                    <img class="locker-status-image" id="return-status-icon"
                         src="catalog/logo-pics/lock-open.png" alt="">
                    <h2 class="locker-status-label">לוקר פתוח</h2>
                    <p class="locker-status-desc">הלוקר פתוח. הנח את הפריטים בתוך הלוקר.</p>
                </section>
            </div>

            <div style="margin-bottom:var(--space-5)">
                <form class="card form-card" data-return-form>
                    <h2>השלם את ההחזרה</h2>

                    ${this._lookupError ? `
                        <div class="return-error-banner">
                            <strong>${this.app.escapeHtml(this._lookupError)}</strong>
                        </div>
                    ` : ''}

                    <div class="field-group" id="photo-section">
                        <span class="field-required">תמונת הפריטים בתוך הלוקר</span>
                        <label class="file-upload-btn" for="return-file-input">
                            <img src="catalog/logo-pics/UploadPicIcon.png" alt=""
                                 class="file-upload-icon"
                                 style="width:1.2rem;height:1.2rem;object-fit:contain;">
                            <span data-return-file-label>צלם/בחר תמונה של הפריטים בלוקר</span>
                        </label>
                        <input type="file" id="return-file-input" class="file-input-hidden"
                               accept="image/*" data-return-file-input />
                    </div>

                    <div class="payment-actions" id="locker-actions">
                        <button type="button" class="primary-button"
                                data-action="complete-return">
                            נעילת לוקר
                        </button>
                    </div>
                </form>
            </div>
        `;
    }

    _renderDoneScreen() {
        const { app } = this;
        return `
            <div class="return-done-container">
                <div class="return-done-card card">
                    <div class="return-done-icon">&#10003;</div>
                    <h2>ההחזרה הושלמה בהצלחה!</h2>
                    <p class="return-done-tagline">תודה שבחרת ב-GrabIt!</p>
                    <ul class="return-done-list">
                        ${this._completedItems.map((item) => `
                            <li>${app.escapeHtml(item.productName)} &times; ${item.quantity}</li>
                        `).join('')}
                    </ul>
                    <button class="primary-button" data-route-link="catalog">חזור לקטלוג</button>
                </div>
            </div>
        `;
    }

    afterRender() {}

    // ===== Event handlers =====

    handleClick(event) {
        const btn = event.target.closest('[data-action]');
        if (!btn) return;

        switch (btn.dataset.action) {
            case 'back-to-form':      this._backToForm(); break;
            case 'validate-and-open': this._validateAndOpen(); break;
            case 'complete-return':   this._completeReturn(); break;
            case 'dec-rental-qty':    this._changeRentalQty(btn.dataset.productId, -1); break;
            case 'inc-rental-qty':    this._changeRentalQty(btn.dataset.productId,  1); break;
        }
    }

    handleChange(event) {
        if (event.target.matches('[data-action="toggle-item"]')) {
            this._toggleItem(event.target.dataset.productId, event.target.checked);
        }
        if (event.target.matches('[data-action="select-all"]')) {
            this._toggleSelectAll(event.target.checked);
        }
        if (event.target.matches('[data-return-file-input]')) {
            const hasFile   = Boolean(event.target.files?.length);
            const labelSpan = document.querySelector('[data-return-file-label]');
            const labelBtn  = document.querySelector('.file-upload-btn');
            if (labelSpan) labelSpan.textContent = hasFile
                ? event.target.files[0].name
                : 'צלם/בחר תמונה של הפריטים בלוקר';
            if (labelBtn) labelBtn.classList.toggle('has-file', hasFile);
        }
    }

    handleSubmit(event) {
        if (event.target.closest('[data-return-search-form]')) {
            event.preventDefault();
            this._handleSearch();
        }
        if (event.target.closest('[data-return-form]')) {
            event.preventDefault();
        }
    }

    // ===== Search =====

    async _handleSearch() {
        const fn = document.querySelector('input[name="returnFirstName"]')?.value.trim() ?? '';
        const ln = document.querySelector('input[name="returnLastName"]')?.value.trim() ?? '';

        if (!fn || !ln) {
            this._formError = 'נא למלא שם פרטי ושם משפחה';
            this.app.rerender();
            return;
        }

        this._savedFirstName = fn;
        this._savedLastName  = ln;
        this._formError      = null;
        this._searching      = true;
        this.app.rerender();

        try {
            const res  = await fetch(
                `/api/returns/lookup?firstName=${encodeURIComponent(fn)}&lastName=${encodeURIComponent(ln)}`
            );
            const data = await res.json();

            if (!Array.isArray(data) || data.length === 0) {
                this._formError = 'לא נמצאו השכרות פעילות על שמך';
                this._searching = false;
                this.app.rerender();
                return;
            }

            this._rentals       = data;
            this._selectedItems = {};
            this._lookupError   = null;
            this._searching     = false;
            this._phase         = 'lookup';
            this.app.rerender();
        } catch {
            this._formError = 'שגיאה בחיבור לשרת. נסה שוב.';
            this._searching = false;
            this.app.rerender();
        }
    }

    _backToForm() {
        this._phase = 'form';
        this.app.rerender();
    }

    // ===== Item selection =====

    _toggleItem(productId, checked) {
        if (checked) {
            this._selectedItems[productId] = this._selectedItems[productId] ?? 1;
        } else {
            delete this._selectedItems[productId];
        }
        this.app.rerender();
    }

    _toggleSelectAll(checked) {
        if (checked) {
            this._rentals.forEach(r => {
                this._selectedItems[r.productId] = this._selectedItems[r.productId] ?? 1;
            });
        } else {
            this._selectedItems = {};
        }
        this.app.rerender();
    }

    _changeRentalQty(productId, delta) {
        const rental = this._rentals.find(r => r.productId === productId);
        if (!rental) return;
        const current = this._selectedItems[productId] ?? 1;
        const next    = Math.max(1, Math.min(rental.quantity, current + delta));
        this._selectedItems[productId] = next;
        this.app.rerender();
    }

    // ===== Validation & locker =====

    async _validateAndOpen() {
        const items = Object.entries(this._selectedItems).map(([productId, quantity]) => ({
            productId, quantity,
        }));
        if (items.length === 0) return;

        this._lookupError = null;

        const res  = await fetch('/api/validate-return', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                firstName: this._savedFirstName,
                lastName:  this._savedLastName,
                items,
            }),
        });
        const data = await res.json();

        if (!data.valid) {
            this._lookupError = (data.errors || ['אימות נכשל. נסה שוב.']).join(' | ');
            this.app.rerender();
            return;
        }

        this._validatedItems = data.items;
        this._phase = 'open';
        this.app.rerender();

        this._setLockerBtnsLoading('פותח את הלוקר...');
        await this.app.sendLockerServoCommand('open');
        this._finishLockerOpen();
    }

    async _completeReturn() {
        const file = document.querySelector('[data-return-file-input]')?.files?.[0];
        if (!file) {
            this._lookupError = 'נא לצלם תמונה של הפריטים בלוקר לפני הנעילה';
            this.app.rerender();
            return;
        }
        if (!this._validatedItems) {
            this._lookupError = 'שגיאה פנימית — נא להתחיל מחדש';
            this.app.rerender();
            return;
        }

        this._setLockerBtnsLoading('נועל את הלוקר...');
        await this.app.sendLockerServoCommand('close');

        await fetch('/api/returns', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                firstName: this._savedFirstName,
                lastName:  this._savedLastName,
                items:     this._validatedItems,
            }),
        });

        await this.app.refreshFromBackend();

        this._completedItems = [...this._validatedItems];
        this._phase = 'done';
        this.app.rerender();
    }

    // ===== Locker UI =====

    _setLockerBtnsLoading(label) {
        const actionsEl = document.getElementById('locker-actions');
        if (actionsEl) {
            actionsEl.insertAdjacentHTML('beforebegin', `
                <div id="locker-loading-spinner" class="locker-page-spinner-wrap">
                    <div class="locker-page-spinner"></div>
                    <span class="locker-page-spinner-label">${label}</span>
                </div>
            `);
            actionsEl.hidden = true;
        }
    }

    _finishLockerOpen() {
        document.getElementById('locker-loading-spinner')?.remove();
        const actionsEl = document.getElementById('locker-actions');
        if (actionsEl) actionsEl.hidden = false;

        const statusCard = document.getElementById('return-status-card');
        if (statusCard) {
            statusCard.classList.add('locker-state-changed');
            setTimeout(() => statusCard.classList.remove('locker-state-changed'), 700);
        }

        const photoSection = document.getElementById('photo-section');
        if (photoSection) photoSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}
