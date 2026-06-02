// SHA-256 of "aguda" and "Aguda@2026!" — generated offline, never stored in plain text
const ADMIN_USERNAME_HASH = 'af8564ea1741c50f76e2da72ab3551f977221c805bfbcbc4597d7c4f86f3af3f';
const ADMIN_PASSWORD_HASH = '44857db783161db1302e7f458eef21e643767f5f4f64d827afb70ae82278b355';

export class LoginModal {
    constructor(onSuccess) {
        this.onSuccess = onSuccess;
        this._overlay = null;
    }

    // ===== Lifecycle =====

    mount() {
        if (document.getElementById('login-modal-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'login-modal-overlay';
        overlay.className = 'login-modal-overlay';
        overlay.hidden = true;
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'login-modal-title');
        overlay.innerHTML = `
            <div class="login-modal-card">
                <button class="login-modal-close" id="login-modal-close" aria-label="סגור">&times;</button>
                <img src="catalog/logo-pics/GrabIt-Logo-Reverse.png" alt="לוגו GrabIt" class="login-modal-logo">
                <h2 class="login-modal-title" id="login-modal-title">כניסת ארגון</h2>
                <form id="login-form" class="login-form" novalidate>
                    <div class="login-field">
                        <label for="login-username">שם משתמש</label>
                        <input type="text" id="login-username" autocomplete="username" placeholder="הכנס שם משתמש" required>
                    </div>
                    <div class="login-field">
                        <label for="login-password">סיסמה</label>
                        <input type="password" id="login-password" autocomplete="current-password" placeholder="הכנס סיסמה" required>
                    </div>
                    <p id="login-error" class="login-error" hidden>שם משתמש או סיסמה שגויים</p>
                    <button type="submit" class="login-submit-btn">כניסה</button>
                </form>
            </div>
        `;

        overlay.addEventListener('click', (e) => this._handleClick(e));
        overlay.querySelector('#login-form').addEventListener('submit', (e) => this._handleSubmit(e));

        document.body.appendChild(overlay);
        this._overlay = overlay;
    }

    show() {
        this._overlay.hidden = false;
        this._overlay.querySelector('#login-error').hidden = true;
        this._overlay.querySelector('#login-username').value = '';
        this._overlay.querySelector('#login-password').value = '';
        this._overlay.querySelector('#login-username').focus();
    }

    hide() {
        this._overlay.hidden = true;
    }

    // ===== Event Handlers =====

    _handleClick(event) {
        if (event.target === this._overlay || event.target.closest('#login-modal-close')) {
            this.hide();
        }
    }

    async _handleSubmit(event) {
        event.preventDefault();

        const username = this._overlay.querySelector('#login-username').value.trim();
        const password = this._overlay.querySelector('#login-password').value;
        const errorEl  = this._overlay.querySelector('#login-error');
        const submitBtn = this._overlay.querySelector('.login-submit-btn');

        submitBtn.disabled = true;
        submitBtn.textContent = 'מאמת...';

        const [uHash, pHash] = await Promise.all([_sha256(username), _sha256(password)]);

        submitBtn.disabled = false;
        submitBtn.textContent = 'כניסה';

        if (uHash === ADMIN_USERNAME_HASH && pHash === ADMIN_PASSWORD_HASH) {
            this.hide();
            this.onSuccess();
        } else {
            errorEl.hidden = false;
            this._overlay.querySelector('#login-password').value = '';
            this._overlay.querySelector('#login-password').focus();
        }
    }
}

// ===== Helpers =====

async function _sha256(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
