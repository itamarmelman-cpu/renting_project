import { CatalogPage } from './CatalogPage.js';

export class ReturnPage {
    static ROUTE = 'return';
    static URL   = '#return';

    static FAQ = [
        { q: 'אילו פריטים ניתן להחזיר?',             a: 'ניתן להחזיר רק פריטים שהושכרו על שמך. מלא שם מלא ובחר פריטים, ואנחנו נוודא מול הרשומות.' },
        { q: 'האם ניתן להחזיר כמה פריטים בבת אחת?', a: 'כן! לחץ "+ הוסף פריט" להוספת שורה. ניתן גם לשנות את הכמות בכל שורה.' },
        { q: 'מה קורה אחרי שנועלים את הלוקר?',      a: 'המערכת מעדכנת את המלאי ומציגה מסך אישור עם תודה על ההחזרה.' },
    ];

    constructor(app) {
        this.app = app;

        this._phase          = 'form';  // 'form' | 'done'
        this._returnRows     = [];      // [{id, productId, quantity}]
        this._rowCounter     = 0;
        this._validatedItems = null;    // items confirmed by /api/validate-return
        this._completedItems = [];      // items after successful return (for done screen)
        this._lockerOpen     = false;
        this._currentStep    = 1;
        this._savedFirstName = '';
        this._savedLastName  = '';
        this._rentProducts   = app.products.filter((p) => p.type === 'rent');

        this._addRowData();             // start with one row
    }

    // ===== Row state =====

    _addRowData() {
        this._rowCounter++;
        this._returnRows.push({ id: this._rowCounter, productId: this._rentProducts[0]?.id || '', quantity: 1 });
    }

    _removeRowData(rowId) {
        this._returnRows = this._returnRows.filter((r) => r.id !== rowId);
    }

    _saveFormState() {
        const fn = document.querySelector('input[name="returnFirstName"]');
        const ln = document.querySelector('input[name="returnLastName"]');
        if (fn) this._savedFirstName = fn.value;
        if (ln) this._savedLastName  = ln.value;
    }

    // ===== Rendering =====

    render() {
        return this._phase === 'done' ? this._renderDoneScreen() : this._renderFormScreen();
    }

    _renderFormScreen() {
        const { app } = this;
        const lockerClass = this._lockerOpen ? 'locker-status-open' : 'locker-status-closed';
        const lockerIcon  = this._lockerOpen ? 'lock-open.png'      : 'locked.png';
        const lockerLabel = this._lockerOpen ? 'לוקר פתוח'          : 'לוקר נעול';
        const lockerDesc  = this._lockerOpen
            ? 'הלוקר פתוח. הנח את הפריטים בתוך הלוקר.'
            : 'מלא את הפרטים, אמת ופתח את הלוקר.';

        return `
            <div class="locker-hero-grid">
                <section class="page-hero card">
                    <h1>החזרת ציוד</h1>
                    <ol class="locker-steps" id="locker-steps">
                        <li class="locker-step step-active" data-step="1">
                            <span class="step-num">1</span>
                            <div class="step-body">
                                <strong>מלא פרטים ואמת</strong>
                                <span>הזן שם, בחר פריטים ולחץ 'פתיחת לוקר'</span>
                            </div>
                        </li>
                        <li class="locker-step step-pending" data-step="2">
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
                                <span>העלה תמונה של הפריטים בלוקר ולחץ 'נעל לוקר'</span>
                            </div>
                        </li>
                    </ol>
                </section>

                <section class="locker-status-card ${lockerClass}" id="return-status-card">
                    <img class="locker-status-image" id="return-status-icon"
                         src="catalog/logo-pics/${lockerIcon}" alt="">
                    <h2 class="locker-status-label" id="return-status-label">${lockerLabel}</h2>
                    <p class="locker-status-desc" id="return-status-desc">${lockerDesc}</p>
                </section>
            </div>

            <div style="margin-bottom: var(--space-5);">
                <form class="card form-card" data-return-form>
                    <h2>פרטי החזרה</h2>

                    <label class="field-group">
                        <span class="field-required">שם פרטי</span>
                        <input type="text" class="text-input" name="returnFirstName"
                               value="${app.escapeHtml(this._savedFirstName)}" />
                    </label>
                    <label class="field-group">
                        <span class="field-required">שם משפחה</span>
                        <input type="text" class="text-input" name="returnLastName"
                               value="${app.escapeHtml(this._savedLastName)}" />
                    </label>

                    <div class="field-group">
                        <span class="field-required">פריטים להחזרה</span>
                        <div id="return-items-container">
                            ${this._returnRows.map((row) => this._renderItemRow(row)).join('')}
                        </div>
                        <button type="button" class="return-add-row-btn" data-action="add-row">
                            + הוסף פריט
                        </button>
                    </div>

                    <div class="return-error-banner" id="return-error-banner" hidden>
                        <strong>פרטי ההחזרה שגויים - אנא ודא שהפרטים ממולאים בהתאם למידע ההזמנה המדויק</strong>
                        <ul id="return-error-list"></ul>
                    </div>

                    <div class="return-success-banner" id="return-success-banner" hidden>
                        <strong>הפרטים אומתו בהצלחה!</strong>
                        <span>הנח את הפריטים בלוקר ולאחר מכן נעל אותו.</span>
                    </div>

                    <div class="field-group" id="photo-section" ${this._lockerOpen ? '' : 'hidden'}>
                        <span class="field-required">תמונת הפריטים בתוך הלוקר</span>
                        <label class="file-upload-btn" for="return-file-input">
                            <img src="catalog/logo-pics/UploadPicIcon.png" alt=""
                                 class="file-upload-icon" style="width:1.2rem;height:1.2rem;object-fit:contain;">
                            <span data-return-file-label>צלם/בחר תמונה של הפריטים בלוקר</span>
                        </label>
                        <input type="file" id="return-file-input" class="file-input-hidden"
                               accept="image/*" data-return-file-input />
                    </div>

                    <div class="payment-actions" id="locker-actions">
                        <button type="button" class="primary-button"
                                data-action="validate-and-open"
                                ${this._lockerOpen ? 'disabled' : ''}>
                            פתיחת לוקר
                        </button>
                        <button type="button" class="secondary-button"
                                data-action="complete-return"
                                ${!this._lockerOpen ? 'disabled' : ''}>
                            נעילת לוקר
                        </button>
                    </div>
                </form>
            </div>
        `;
    }

    _renderItemRow(row) {
        const { app } = this;
        const canRemove = this._returnRows.length > 1;
        return `
            <div class="return-item-row" data-row-id="${row.id}">
                <select class="text-input return-item-select"
                        data-action="select-product" data-row="${row.id}">
                    ${this._rentProducts.map((p) => `
                        <option value="${p.id}" ${p.id === row.productId ? 'selected' : ''}>
                            ${app.escapeHtml(p.name)}
                        </option>
                    `).join('')}
                </select>
                <div class="return-qty-control">
                    <button type="button" class="return-qty-btn"
                            data-action="dec-qty" data-row="${row.id}">-</button>
                    <span class="return-qty-value" data-row-qty="${row.id}">${row.quantity}</span>
                    <button type="button" class="return-qty-btn"
                            data-action="inc-qty" data-row="${row.id}">+</button>
                </div>
                ${canRemove
                    ? `<button type="button" class="return-remove-row-btn"
                               data-action="remove-row" data-row="${row.id}">&times;</button>`
                    : '<div class="return-row-placeholder"></div>'
                }
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

    afterRender() {
        if (this._phase === 'done') return;
        const activeIds = new Set(this.app.getActiveRentedProductIds());
        if (activeIds.size === 0) return;
        this._rentProducts = this.app.products.filter(
            (p) => p.type === 'rent' && activeIds.has(p.id)
        );
        this._returnRows.forEach((row) => {
            if (!activeIds.has(row.productId)) {
                row.productId = this._rentProducts[0]?.id || '';
            }
        });
        this._rerenderItemsContainer();
    }

    // ===== Event handlers =====

    handleClick(event) {
        const btn = event.target.closest('[data-action]');
        if (!btn) return;

        switch (btn.dataset.action) {
            case 'add-row':           this._addRow(); break;
            case 'remove-row':        this._removeRow(Number(btn.dataset.row)); break;
            case 'inc-qty':           this._changeQty(Number(btn.dataset.row),  1); break;
            case 'dec-qty':           this._changeQty(Number(btn.dataset.row), -1); break;
            case 'validate-and-open': this._validateAndOpen(); break;
            case 'complete-return':   this._completeReturn(); break;
        }
    }

    handleChange(event) {
        if (event.target.matches('[data-action="select-product"]')) {
            const rowId = Number(event.target.dataset.row);
            const row = this._returnRows.find((r) => r.id === rowId);
            if (row) row.productId = event.target.value;
            this._resetValidation();
        }

        if (event.target.matches('[data-return-file-input]')) {
            const hasFile   = Boolean(event.target.files?.length);
            const labelSpan = document.querySelector('[data-return-file-label]');
            const labelBtn  = document.querySelector('.file-upload-btn');
            if (labelSpan) labelSpan.textContent = hasFile ? event.target.files[0].name : 'צלם/בחר תמונה של הפריטים בלוקר';
            if (labelBtn)  labelBtn.classList.toggle('has-file', hasFile);
            if (hasFile && this._currentStep === 2) {
                this._currentStep = 3;
                this._updateStepsUI();
            }
        }
    }

    handleSubmit(event) {
        if (event.target.closest('[data-return-form]')) event.preventDefault();
    }

    // ===== Row operations =====

    _addRow() {
        this._saveFormState();
        this._addRowData();
        this._rerenderItemsContainer();
        this._resetValidation();
    }

    _removeRow(rowId) {
        this._saveFormState();
        this._removeRowData(rowId);
        this._rerenderItemsContainer();
        this._resetValidation();
    }

    _changeQty(rowId, delta) {
        const row = this._returnRows.find((r) => r.id === rowId);
        if (!row) return;
        const next = row.quantity + delta;
        if (next < 1) return;
        row.quantity = next;
        const qtyEl = document.querySelector(`[data-row-qty="${rowId}"]`);
        if (qtyEl) qtyEl.textContent = String(row.quantity);
        this._resetValidation();
    }

    _rerenderItemsContainer() {
        const container = document.getElementById('return-items-container');
        if (container) container.innerHTML = this._returnRows.map((r) => this._renderItemRow(r)).join('');
    }

    // ===== Validation & locker =====

    async _validateAndOpen() { // async kept for sendLockerServoCommand
        this._saveFormState();
        const { _savedFirstName: firstName, _savedLastName: lastName } = this;

        if (!firstName || !lastName) {
            this._showError(['נא למלא שם פרטי ושם משפחה']);
            return;
        }
        if (this._returnRows.length === 0) {
            this._showError(['נא לבחור לפחות פריט אחד להחזרה']);
            return;
        }

        const data = this.app.validateReturn(
            firstName,
            lastName,
            this._returnRows.map((r) => ({ productId: r.productId, quantity: r.quantity }))
        );

        if (!data.valid) {
            this._showError(data.errors);
            return;
        }

        this._validatedItems = data.items;
        this._showSuccess();

        this._setLockerBtnsLoading('פותח את הלוקר...');
        await this.app.sendLockerServoCommand('open');
        this._lockerOpen = true;
        this._finishLockerAction('open');
    }

    async _completeReturn() {
        const file = document.querySelector('[data-return-file-input]')?.files?.[0];
        if (!file) {
            this._showError(['נא לצלם תמונה של הפריטים בלוקר לפני הנעילה']);
            return;
        }
        if (!this._validatedItems) {
            this._showError(['שגיאה פנימית - נא להתחיל מחדש']);
            return;
        }

        this._setLockerBtnsLoading('נועל את הלוקר...');
        await this.app.sendLockerServoCommand('close');
        this._lockerOpen = false;

        this.app.saveReturnToLocal(this._savedFirstName, this._savedLastName, this._validatedItems);

        fetch('/api/returns', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                firstName: this._savedFirstName,
                lastName:  this._savedLastName,
                items:     this._validatedItems,
            }),
        }).catch(() => {});

        for (const item of this._validatedItems) {
            this.app.incrementInventoryForReturn(item.productId, item.quantity);
        }

        this._completedItems = [...this._validatedItems];
        this._phase = 'done';
        this.app.rerender();
    }

    // ===== Banner helpers =====

    _showError(errors) {
        const banner  = document.getElementById('return-error-banner');
        const list    = document.getElementById('return-error-list');
        const success = document.getElementById('return-success-banner');
        if (list)    list.innerHTML = errors.map((e) => `<li>${this.app.escapeHtml(e)}</li>`).join('');
        if (banner)  banner.removeAttribute('hidden');
        if (success) success.setAttribute('hidden', '');
    }

    _showSuccess() {
        const banner = document.getElementById('return-success-banner');
        const error  = document.getElementById('return-error-banner');
        if (banner) banner.removeAttribute('hidden');
        if (error)  error.setAttribute('hidden', '');
    }

    _resetValidation() {
        this._validatedItems = null;
        document.getElementById('return-error-banner')?.setAttribute('hidden', '');
        document.getElementById('return-success-banner')?.setAttribute('hidden', '');
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

    _finishLockerAction(command) {
        const isOpen = command === 'open';

        document.getElementById('locker-loading-spinner')?.remove();

        const actionsEl = document.getElementById('locker-actions');
        if (actionsEl) actionsEl.hidden = false;

        const openBtn  = document.querySelector('[data-action="validate-and-open"]');
        const closeBtn = document.querySelector('[data-action="complete-return"]');
        if (openBtn)  openBtn.disabled  = isOpen;
        if (closeBtn) closeBtn.disabled = !isOpen;

        const statusCard = document.getElementById('return-status-card');
        if (statusCard) {
            statusCard.className = `locker-status-card ${isOpen ? 'locker-status-open' : 'locker-status-closed'}`;
            statusCard.classList.add('locker-state-changed');
            setTimeout(() => statusCard.classList.remove('locker-state-changed'), 700);
        }

        const iconEl  = document.getElementById('return-status-icon');
        const labelEl = document.getElementById('return-status-label');
        const descEl  = document.getElementById('return-status-desc');
        if (iconEl)  iconEl.src          = `catalog/logo-pics/${isOpen ? 'lock-open.png' : 'locked.png'}`;
        if (labelEl) labelEl.textContent  = isOpen ? 'לוקר פתוח' : 'לוקר נעול';
        if (descEl)  descEl.textContent   = isOpen
            ? 'הלוקר פתוח. הנח את הפריטים בתוך הלוקר.'
            : 'הלוקר ננעל. תהליך ההחזרה הושלם.';

        if (isOpen) {
            const photoSection = document.getElementById('photo-section');
            if (photoSection) {
                photoSection.removeAttribute('hidden');
                photoSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
            this._currentStep = 2;
        } else {
            this._currentStep = 4;
        }
        this._updateStepsUI();
    }

    _updateStepsUI() {
        document.getElementById('locker-steps')?.querySelectorAll('.locker-step').forEach((li) => {
            const s = Number(li.dataset.step);
            li.className = 'locker-step';
            if (s === this._currentStep)    li.classList.add('step-active');
            else if (s < this._currentStep) li.classList.add('step-done');
            else                            li.classList.add('step-pending');
        });
    }
}
