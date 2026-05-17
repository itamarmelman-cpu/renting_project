import { CatalogPage } from './CatalogPage.js';

export class ReturnPage {
    static ROUTE = 'return';
    static URL = '#return';

    constructor(app) {
        this.app = app;

        this.selectors = {
            form:              '[data-return-form]',
            productSelect:     '[data-return-product-select]',
            fileInput:         '[data-return-file-input]',
            fileLabel:         '[data-return-file-label]',
            statusEl:          '#return-status',
            stockValue:        '[data-return-stock-value]',
            productNameEl:     '[data-return-product-name]',
            lockerControlBtn:  '[data-action="locker-control"]',
            firstNameInput:    'input[name="returnFirstName"]',
            lastNameInput:     'input[name="returnLastName"]',
        };

        this._lockerResetTimer = null;
        this._currentStep = 1;
    }

    // ===== Navigation Methods =====

    goToCatalog() {
        const page = new CatalogPage(this.app);
        this.app.navigateTo(page);
        return page;
    }

    // ===== In-Page Action Methods =====

    async initiateReturn() {
        const formData = this._collectFormData();
        if (!formData) return;

        const { app } = this;
        this._setLockerBtnsLoading('פותח את הלוקר...');
        await app.sendLockerServoCommand('open');
        app.state.lockerOpen = true;
        this._finishLockerAction('open');
    }

    async completeReturn() {
        const formData = this._collectFormData();
        if (!formData) return;

        const file = document.querySelector(this.selectors.fileInput)?.files?.[0];
        if (!file) return;

        const { app } = this;
        this._setLockerBtnsLoading('נועל את הלוקר...');
        await app.sendLockerServoCommand('close');
        app.state.lockerOpen = false;

        try {
            fetch('/api/returns', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    firstName:   formData.firstName,
                    lastName:    formData.lastName,
                    productId:   formData.product.id,
                    productName: formData.product.name,
                }),
            }).catch(() => {});
        } catch {}

        app.incrementInventoryForReturn(formData.product.id);
        this._finishLockerAction('close');
    }

    selectReturnProduct(productId) {
        const { app } = this;
        const product = app.getProductById(productId);
        if (!product) return;

        const statusEl = document.querySelector(this.selectors.statusEl);
        const stockEl  = document.querySelector(this.selectors.stockValue);
        const nameEl   = document.querySelector(this.selectors.productNameEl);

        if (statusEl) statusEl.textContent = `המוצר ${product.name} נבחר להחזרה.`;
        if (stockEl)  stockEl.textContent  = String(app.getInventoryStock(product.id));
        if (nameEl)   nameEl.textContent   = product.name;
    }

    // ===== Rendering =====

    render() {
        const { app } = this;
        const firstProduct = app.products[0];
        this._currentStep = 1;

        return `
            <div class="locker-hero-grid">
                <section class="page-hero card">
                    <h1>החזרת ציוד</h1>
                    <ol class="locker-steps" id="locker-steps">
                        <li class="locker-step step-active" data-step="1">
                            <span class="step-num">1</span>
                            <div class="step-body">
                                <strong>מלא פרטים ופתח לוקר</strong>
                                <span>הזן שם, בחר מוצר ולחץ 'פתח לוקר'</span>
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

                <section class="locker-status-card locker-status-closed" id="return-status-card">
                    <img class="locker-status-image" id="return-status-icon"
                         src="catalog/logo-pics/locked.png" alt="">
                    <h2 class="locker-status-label" id="return-status-label">לוקר נעול</h2>
                    <p class="locker-status-desc" id="return-status">
                        ${app.escapeHtml(firstProduct.name)} נבחר להחזרה.
                    </p>
                </section>
            </div>

            <div style="margin-bottom: var(--space-5);">
                <form class="card form-card" data-return-form>
                    <h2>פרטי החזרה</h2>
                    <label class="field-group">
                        <span class="field-required">שם פרטי</span>
                        <input type="text" class="text-input" name="returnFirstName" required />
                    </label>
                    <label class="field-group">
                        <span class="field-required">שם משפחה</span>
                        <input type="text" class="text-input" name="returnLastName" required />
                    </label>
                    <label class="field-group">
                        <span class="field-required">פריט להחזרה</span>
                        <select class="text-input" data-return-product-select>
                            ${app.products.map((p, i) => `<option value="${p.id}" ${i === 0 ? 'selected' : ''}>${app.escapeHtml(p.name)}</option>`).join('')}
                        </select>
                    </label>

                    <div class="field-group" id="photo-section" style="display:none;">
                        <span class="field-required">תמונת הפריטים בתוך הלוקר</span>
                        <label class="file-upload-btn" for="return-file-input">
                            <img src="catalog/logo-pics/UploadPicIcon.png" alt="" class="file-upload-icon" style="width:1.2rem;height:1.2rem;object-fit:contain;">
                            <span data-return-file-label>צלם/בחר תמונה של הפריטים בלוקר</span>
                        </label>
                        <input type="file" id="return-file-input" class="file-input-hidden" accept="image/*" data-return-file-input />
                    </div>

                    <div class="payment-actions">
                        <button type="button" class="primary-button" data-action="locker-control" data-command="open">פתיחת לוקר</button>
                        <button type="button" class="secondary-button" data-action="locker-control" data-command="close">נעילת לוקר</button>
                    </div>
                </form>
            </div>
        `;
    }

    // ===== Event Handlers =====

    handleClick(event) {
        const btn = event.target.closest(this.selectors.lockerControlBtn);
        if (!btn) return;
        if (btn.dataset.command === 'open')  this.initiateReturn();
        if (btn.dataset.command === 'close') this.completeReturn();
    }

    handleChange(event) {
        if (event.target.matches(this.selectors.productSelect)) {
            this.selectReturnProduct(event.target.value);
        }

        if (event.target.matches(this.selectors.fileInput)) {
            const labelSpan = document.querySelector(this.selectors.fileLabel);
            const labelBtn  = event.target.previousElementSibling;
            const hasFile   = Boolean(event.target.files?.length);
            if (labelSpan) labelSpan.textContent = hasFile ? event.target.files[0].name : 'צלם/בחר תמונה של הפריטים בלוקר';
            if (labelBtn)  labelBtn.classList.toggle('has-file', hasFile);
            if (hasFile && this._currentStep === 2) {
                this._currentStep = 3;
                this._updateStepsUI();
            }
        }
    }

    handleSubmit(event) {
        if (event.target.closest(this.selectors.form)) {
            event.preventDefault();
        }
    }

    // ===== Private Helpers =====

    _setLockerBtnsLoading(label) {
        clearTimeout(this._lockerResetTimer);
        const actionsEl = document.querySelector('.locker-actions, .payment-actions');
        if (actionsEl) {
            actionsEl.insertAdjacentHTML('beforebegin', `
                <div id="locker-loading-spinner" class="locker-page-spinner-wrap">
                    <div class="locker-page-spinner"></div>
                    <span class="locker-page-spinner-label">${label}</span>
                </div>
            `);
            actionsEl.hidden = true;
        }
        document.querySelectorAll(this.selectors.lockerControlBtn).forEach((btn) => {
            btn.disabled = true;
        });
    }

    _finishLockerAction(command) {
        const isOpen = command === 'open';

        const spinnerWrap = document.getElementById('locker-loading-spinner');
        if (spinnerWrap) spinnerWrap.remove();

        const actionsEl = document.querySelector('.locker-actions, .payment-actions');
        if (actionsEl) actionsEl.hidden = false;

        document.querySelectorAll(this.selectors.lockerControlBtn).forEach((btn) => {
            btn.disabled = false;
        });

        const statusEl = document.querySelector(this.selectors.statusEl);
        if (statusEl) {
            statusEl.textContent = isOpen
                ? 'הלוקר פתוח. הנח את הפריטים בתוך הלוקר.'
                : 'הלוקר ננעל. תהליך ההחזרה הושלם בהצלחה.';
        }

        const statusCard = document.getElementById('return-status-card');
        if (statusCard) {
            statusCard.className = `locker-status-card ${isOpen ? 'locker-status-open' : 'locker-status-closed'}`;
            statusCard.classList.add('locker-state-changed');
            setTimeout(() => statusCard.classList.remove('locker-state-changed'), 700);
        }

        const iconEl = document.getElementById('return-status-icon');
        if (iconEl) iconEl.src = `catalog/logo-pics/${isOpen ? 'lock-open.png' : 'locked.png'}`;

        const labelEl = document.getElementById('return-status-label');
        if (labelEl) labelEl.textContent = isOpen ? 'לוקר פתוח' : 'לוקר נעול';

        if (isOpen) {
            const photoSection = document.getElementById('photo-section');
            if (photoSection) {
                photoSection.style.display = '';
                photoSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
            this._currentStep = 2;
        } else {
            this._currentStep = 4; // beyond last step → all shown as done
        }
        this._updateStepsUI();
    }

    _updateStepsUI() {
        const stepsEl = document.getElementById('locker-steps');
        if (!stepsEl) return;
        stepsEl.querySelectorAll('.locker-step').forEach((li) => {
            const s = Number(li.dataset.step);
            li.className = 'locker-step';
            if (s === this._currentStep) li.classList.add('step-active');
            else if (s < this._currentStep) li.classList.add('step-done');
            else li.classList.add('step-pending');
        });
    }

    _collectFormData() {
        const { app } = this;
        const select         = document.querySelector(this.selectors.productSelect);
        const firstNameInput = document.querySelector(this.selectors.firstNameInput);
        const lastNameInput  = document.querySelector(this.selectors.lastNameInput);

        if (!select || !firstNameInput || !lastNameInput) return null;

        const firstName = firstNameInput.value.trim();
        const lastName  = lastNameInput.value.trim();

        if (!firstName || !lastName) return null;

        return { firstName, lastName, product: app.getProductById(select.value) };
    }
}
