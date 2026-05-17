import { CatalogPage } from './CatalogPage.js';

export class LockerPage {
    static ROUTE = 'locker';
    static URL = '#locker';

    constructor(app) {
        this.app = app;

        this.selectors = {
            lockerControlBtn: '[data-action="locker-control"]',
            statusEl:         '#locker-status',
        };

        this._lockerResetTimer = null;
        this._currentStep = app.state.lockerOpen ? 2 : 1;
    }

    // ===== Navigation Methods =====

    goToCatalog() {
        const page = new CatalogPage(this.app);
        this.app.navigateTo(page);
        return page;
    }

    // ===== In-Page Action Methods =====

    async openLocker() {
        const { app } = this;
        this._setLockerBtnsLoading('פותח לוקר...');
        await app.sendLockerServoCommand('open');
        app.state.lockerOpen = true;
        this._finishLockerAction('open');
    }

    async closeLocker() {
        const { app } = this;
        this._setLockerBtnsLoading('נועל לוקר...');
        await app.sendLockerServoCommand('close');
        app.state.lockerOpen = false;
        this._finishLockerAction('close');
    }

    // ===== Rendering =====

    render() {
        const { app } = this;
        const isOpen = app.state.lockerOpen;
        this._currentStep = isOpen ? 2 : 1;

        return `
            <div class="locker-hero-grid">
                <section class="page-hero card">
                    <h1>איסוף ציוד</h1>
                    <ol class="locker-steps" id="locker-steps">
                        <li class="locker-step ${this._currentStep === 1 ? 'step-active' : 'step-done'}" data-step="1">
                            <span class="step-num">1</span>
                            <div class="step-body">
                                <strong>פתח לוקר</strong>
                                <span>לחץ על 'פתח לוקר' והמתן לפתיחה</span>
                            </div>
                        </li>
                        <li class="locker-step ${this._currentStep === 2 ? 'step-active' : this._currentStep > 2 ? 'step-done' : 'step-pending'}" data-step="2">
                            <span class="step-num">2</span>
                            <div class="step-body">
                                <strong>אסוף ציוד</strong>
                                <span>קח את הפריטים מתוך הלוקר</span>
                            </div>
                        </li>
                        <li class="locker-step ${this._currentStep >= 3 ? 'step-done' : 'step-pending'}" data-step="3">
                            <span class="step-num">3</span>
                            <div class="step-body">
                                <strong>נעל לוקר</strong>
                                <span>סגור את הדלת ולחץ 'נעל לוקר'</span>
                            </div>
                        </li>
                    </ol>
                </section>

                <section class="locker-status-card ${isOpen ? 'locker-status-open' : 'locker-status-closed'}" id="locker-status-card">
                    <img class="locker-status-image" id="locker-status-icon"
                         src="catalog/logo-pics/${isOpen ? 'lock-open.png' : 'locked.png'}" alt="">
                    <h2 class="locker-status-label" id="locker-status-label">
                        ${isOpen ? 'לוקר פתוח' : 'לוקר נעול'}
                    </h2>
                    <p class="locker-status-desc" id="locker-status">
                        ${isOpen ? 'הלוקר פתוח. אסוף את הפריטים ולחץ נעל לוקר בסיום.' : 'לחץ על פתח לוקר כדי להתחיל.'}
                    </p>
                </section>
            </div>

            <section class="card locker-card">
                <div class="locker-actions">
                    <button type="button" class="primary-button" data-action="locker-control" data-command="open">
                        פתח לוקר
                    </button>
                    <button type="button" class="secondary-button" data-action="locker-control" data-command="close">
                        נעל לוקר
                    </button>
                </div>
            </section>
        `;
    }

    // ===== Event Handler =====

    handleClick(event) {
        const btn = event.target.closest(this.selectors.lockerControlBtn);
        if (!btn) return;
        if (btn.dataset.command === 'open')  this.openLocker();
        if (btn.dataset.command === 'close') this.closeLocker();
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
                ? 'הלוקר פתוח. אסוף את הפריטים ולחץ נעל לוקר בסיום.'
                : 'הלוקר נעול.';
        }

        const statusCard = document.getElementById('locker-status-card');
        if (statusCard) {
            statusCard.className = `locker-status-card ${isOpen ? 'locker-status-open' : 'locker-status-closed'}`;
            statusCard.classList.add('locker-state-changed');
            setTimeout(() => statusCard.classList.remove('locker-state-changed'), 700);
        }

        const iconEl = document.getElementById('locker-status-icon');
        if (iconEl) {
            iconEl.src = `catalog/logo-pics/${isOpen ? 'lock-open.png' : 'locked.png'}`;
        }

        const labelEl = document.getElementById('locker-status-label');
        if (labelEl) labelEl.textContent = isOpen ? 'לוקר פתוח' : 'לוקר נעול';

        this._currentStep = isOpen ? 2 : 3;
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
}
