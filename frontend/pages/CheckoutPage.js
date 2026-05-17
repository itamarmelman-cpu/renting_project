import { CartPage } from './CartPage.js';
import { LockerPage } from './LockerPage.js';

export class CheckoutPage {
    static ROUTE = 'checkout';
    static URL = '#checkout';

    /**
     * Creates a CheckoutPage instance.
     *
     * Implementation: Stores the shared appContext reference and declares selector
     * strings for the checkout form, name inputs, and payment buttons.
     *
     * @param {Object} app - The shared application context (appContext from app.js).
     */
    constructor(app) {
        this.app = app;

        this.selectors = {
            form:           '[data-checkout-form]',
            firstNameInput: 'input[name="firstName"]',
            lastNameInput:  'input[name="lastName"]',
            paymentBtn:     '[data-action="process-payment"]',
        };
    }

    // ===== Navigation Methods =====

    /**
     * Navigates to the Locker page after a successful payment.
     *
     * Implementation: Instantiates LockerPage with the shared appContext, calls
     * app.navigateTo() to update the URL and render, then returns the instance
     * for programmatic chaining.
     *
     * @returns {LockerPage} The newly created LockerPage instance.
     */
    goToLocker() {
        const page = new LockerPage(this.app);
        this.app.navigateTo(page);
        return page;
    }

    /**
     * Navigates back to the Cart page (e.g. on stock validation failure).
     *
     * Implementation: Instantiates CartPage with the shared appContext, calls
     * app.navigateTo() to update the URL and render, then returns the instance
     * for programmatic chaining.
     *
     * @returns {CartPage} The newly created CartPage instance.
     */
    goToCart() {
        const page = new CartPage(this.app);
        this.app.navigateTo(page);
        return page;
    }

    // ===== In-Page Action Methods =====

    /**
     * Processes a mock payment for the given provider.
     *
     * Implementation:
     *   1. Validates the customer name form via _collectFormData(); returns null on failure.
     *   2. Guards against an empty cart.
     *   3. Performs an atomic stock check against an inventory snapshot — aborts
     *      and navigates to Cart if any item's stock is insufficient.
     *   4. Applies the stock deduction to app.state.inventory and persists it.
     *   5. Clears the cart and saves a checkout context object to localStorage
     *      (used by LockerPage to display order details).
     *   6. Delegates navigation to goToLocker() and returns the LockerPage instance.
     *
     * @param {string} provider - The payment provider label (e.g. 'Apple Pay').
     * @returns {LockerPage|null} The LockerPage instance on success, null on validation failure.
     */
    submitPayment(provider) {
        const formData = this._collectFormData();
        if (!formData) return null;

        const { firstName, lastName } = formData;
        const { app } = this;

        if (app.state.cart.length === 0) {
            return this.goToCart();
        }

        const inventorySnapshot = { ...app.state.inventory };
        for (const cartItem of app.state.cart) {
            const currentStock = Number(inventorySnapshot[cartItem.productId] || 0);
            if (currentStock < cartItem.quantity) {
                return this.goToCart();
            }
            inventorySnapshot[cartItem.productId] = currentStock - cartItem.quantity;
        }

        app.state.inventory = inventorySnapshot;
        app.saveInventoryState();

        const orderTotal     = app.calculateCartTotal();
        const purchasedItems = app.state.cart.map((item) => ({
            ...item,
            unitPrice: app.getProductById(item.productId)?.price || 0,
        }));
        app.clearCart();
        app.state.lockerOpen = false;
        const order = {
            id:           `order_${Date.now()}`,
            customerName: `${firstName} ${lastName}`,
            provider,
            items:        purchasedItems,
            total:        orderTotal,
            createdAt:    new Date().toISOString(),
        };
        app.saveOrder(order);
        app.saveStoredJson('agugo.checkoutContext', order);

        try {
            fetch('/api/orders', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({
                    customerName: order.customerName,
                    provider:     order.provider,
                    total:        order.total,
                    items:        purchasedItems,
                }),
            }).catch(() => {});
        } catch {}

        return this.goToLocker();
    }

    // ===== Event Handler Methods =====

    /**
     * Renders the full checkout page HTML string.
     *
     * Implementation: Returns an empty-state card when the cart is empty.
     * Otherwise renders a two-column layout: a customer name + payment form,
     * and an order preview sidebar listing each cart item with its total.
     *
     * @returns {string} HTML string for the checkout page.
     */
    render() {
        const { app } = this;

        if (app.state.cart.length === 0) {
            return `
                <section class="card empty-state empty-state-large">
                    <h1>אין פריטים לתשלום</h1>
                    <p>העגלה שלך ריקה, אז אין מה לשלם.</p>
                    <div class="empty-state-actions">
                        <button type="button" class="primary-button" data-route-link="catalog">חזור לקטלוג</button>
                    </div>
                </section>
            `;
        }

        return `
            <h1>תשלום</h1>

            <section class="checkout-grid">
                <form class="card form-card" data-checkout-form>
                    <h2>פרטי הלקוח</h2>
                    <label class="field-group">
                        <span class="field-required">שם פרטי</span>
                        <input type="text" class="text-input" name="firstName" required />
                    </label>
                    <label class="field-group">
                        <span class="field-required">שם משפחה</span>
                        <input type="text" class="text-input" name="lastName" required />
                    </label>
                    <div class="payment-actions">
                        <button type="button" class="payment-button apple-pay" data-action="process-payment" data-provider="Apple Pay">Apple Pay</button>
                        <button type="button" class="payment-button google-pay" data-action="process-payment" data-provider="Google Pay">Google Pay</button>
                    </div>
                </form>

                <aside class="card order-panel">
                    <h2>סיכום הזמנה</h2>
                    <div class="order-preview-list">
                        ${app.state.cart.map((item) => {
                            const product = app.getProductById(item.productId);
                            if (!product) return '';
                            return `
                                <div class="order-preview-item">
                                    <div class="order-preview-item-header">
                                        <span class="order-preview-name">${app.escapeHtml(product.name)}</span>
                                        <strong class="order-preview-subtotal">${app.calculateCartItemTotal(item)} ₪</strong>
                                    </div>
                                    <div class="order-preview-meta">
                                        <span class="order-meta-chip">כמות: ${item.quantity}</span>
                                        <span class="order-meta-chip">ימים: ${item.rentDays}</span>
                                        <span class="order-meta-chip order-meta-muted">${product.price} ₪ ליום</span>
                                    </div>
                                </div>`;
                        }).join('')}
                    </div>
                    <div class="order-preview-total">
                        <span>סך הכל</span>
                        <strong>${app.calculateCartTotal()} ₪</strong>
                    </div>
                </aside>
            </section>
        `;
    }

    /**
     * Handles click events delegated from the global listener.
     *
     * Implementation: Detects a click on a payment button and forwards the
     * provider name to submitPayment().
     *
     * @param {MouseEvent} event - The click event from the global delegated listener.
     * @returns {void}
     */
    handleClick(event) {
        const paymentBtn = event.target.closest(this.selectors.paymentBtn);
        if (paymentBtn) {
            this.submitPayment(paymentBtn.dataset.provider);
        }
    }

    /**
     * Handles form submit events delegated from the global listener.
     *
     * Implementation: Prevents the browser's default form submission so that
     * payment is triggered only by the explicit payment buttons, not Enter key.
     *
     * @param {SubmitEvent} event - The submit event from the global delegated listener.
     * @returns {void}
     */
    handleSubmit(event) {
        if (event.target.closest(this.selectors.form)) {
            event.preventDefault();
        }
    }

    // ===== Private Helpers =====

    /**
     * Reads and validates the customer name fields from the checkout form.
     *
     * Implementation: Queries the form element and reads both name input values.
     * Returns null and shows an error notice if either field is empty or the form
     * element cannot be found in the DOM.
     *
     * @returns {{ firstName: string, lastName: string }|null} Validated data, or null on failure.
     */
    _collectFormData() {
        const form = document.querySelector(this.selectors.form);
        if (!form) return null;

        const firstName = form.querySelector(this.selectors.firstNameInput)?.value.trim() || '';
        const lastName  = form.querySelector(this.selectors.lastNameInput)?.value.trim()  || '';

        if (!firstName || !lastName) {
            return null;
        }

        return { firstName, lastName };
    }
}
