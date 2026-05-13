import { CatalogPage } from './CatalogPage.js';
import { CheckoutPage } from './CheckoutPage.js';

export class CartPage {
    static ROUTE = 'cart';
    static URL = '#cart';

    /**
     * Creates a CartPage instance.
     *
     * Implementation: Stores the shared appContext reference and declares the
     * selector strings used by the click handler to identify quantity-change
     * and item-removal buttons.
     *
     * @param {Object} app - The shared application context (appContext from app.js).
     */
    constructor(app) {
        this.app = app;

        this.selectors = {
            changeQtyBtn:  '[data-action="change-cart-quantity"]',
            changeDaysBtn: '[data-action="change-cart-days"]',
            removeBtn:     '[data-action="remove-cart-item"]',
        };
    }

    // ===== Navigation Methods =====

    /**
     * Navigates to the Checkout page.
     *
     * Implementation: Instantiates CheckoutPage with the shared appContext,
     * calls app.navigateTo() to update the URL and render, then returns the
     * instance for programmatic chaining.
     *
     * @returns {CheckoutPage} The newly created CheckoutPage instance.
     */
    proceedToCheckout() {
        const page = new CheckoutPage(this.app);
        this.app.navigateTo(page);
        return page;
    }

    /**
     * Navigates back to the Product Catalog page.
     *
     * Implementation: Instantiates CatalogPage with the shared appContext,
     * calls app.navigateTo() to update the URL and render, then returns the
     * instance for programmatic chaining.
     *
     * @returns {CatalogPage} The newly created CatalogPage instance.
     */
    goToCatalog() {
        const page = new CatalogPage(this.app);
        this.app.navigateTo(page);
        return page;
    }

    // ===== In-Page Action Methods =====

    /**
     * Adjusts the quantity of a cart item by a signed delta and re-renders the page.
     *
     * Implementation: Delegates the state mutation to app.updateCartItemQuantity(),
     * which handles the quantity ceiling check, delegates to removeCartItem() when
     * the quantity drops to zero, and persists state. After the mutation, calls
     * app.rerender() so the cart view reflects the change.
     *
     * @param {string} productId - The ID of the product to adjust.
     * @param {number} delta - Positive to increase quantity, negative to decrease.
     * @returns {void}
     */
    adjustQuantity(productId, delta) {
        this.app.updateCartItemQuantity(productId, delta);
        this.app.rerender();
    }

    /**
     * Removes a product from the cart entirely and re-renders the page.
     *
     * Implementation: Delegates the state mutation to app.removeCartItem(), then
     * calls app.rerender() to update the cart view. If the cart becomes empty,
     * render() returns the empty-state template automatically.
     *
     * @param {string} productId - The ID of the product to remove.
     * @returns {void}
     */
    removeItem(productId) {
        this.app.removeCartItem(productId);
        this.app.rerender();
    }

    // ===== Event Handler Methods =====

    /**
     * Renders the full cart page HTML string.
     *
     * Implementation: Returns an empty-state card when the cart has no items.
     * Otherwise renders a two-column layout: a list of cart item cards (via
     * _renderCartItem()) and an order summary sidebar with the total count and price.
     *
     * @returns {string} HTML string for the cart page.
     */
    render() {
        const { app } = this;

        if (app.state.cart.length === 0) {
            return `
                <section class="card empty-state empty-state-large">
                    <h1>העגלה שלך ריקה</h1>
                    <p>הוסף מוצרים מהקטלוג כדי להמשיך לתשלום.</p>
                    <div class="empty-state-actions">
                        <button type="button" class="primary-button" data-route-link="catalog">חזור לקטלוג</button>
                    </div>
                </section>
            `;
        }

        return `
            <section class="cart-layout">
                <h1>עגלת הקניות שלך</h1>
                <div class="cart-items">
                    ${app.state.cart.map((item) => this._renderCartItem(item)).join('')}
                </div>
                <aside class="cart-summary card">
                    <h2>סיכום הזמנה</h2>
                    <div class="cart-summary-body">
                        <div class="cart-summary-info">
                            <div class="summary-row">
                                <span>פריטים:</span>
                                <strong>${app.getCartItemCount()}</strong>
                            </div>
                            <div class="summary-row">
                                <span>סך הכל:</span>
                                <strong>${app.calculateCartTotal()} ₪</strong>
                            </div>
                        </div>
                        <button type="button" class="primary-button" data-route-link="checkout">עבור לתשלום</button>
                    </div>
                </aside>
            </section>
        `;
    }

    /**
     * Handles click events delegated from the global listener.
     *
     * Implementation: Dispatches to the appropriate semantic method:
     *   - change-cart-quantity button → adjustQuantity() with the button's delta.
     *   - remove-cart-item button     → removeItem().
     *
     * @param {MouseEvent} event - The click event from the global delegated listener.
     * @returns {void}
     */
    handleClick(event) {
        const changeBtn = event.target.closest(this.selectors.changeQtyBtn);
        if (changeBtn) {
            this.adjustQuantity(changeBtn.dataset.productId, Number(changeBtn.dataset.delta));
            return;
        }

        const daysBtn = event.target.closest(this.selectors.changeDaysBtn);
        if (daysBtn) {
            this.app.updateCartItemRentDays(daysBtn.dataset.productId, Number(daysBtn.dataset.delta));
            this.app.rerender();
            return;
        }

        const removeBtn = event.target.closest(this.selectors.removeBtn);
        if (removeBtn) {
            this.removeItem(removeBtn.dataset.productId);
        }
    }

    // ===== Private Rendering Helpers =====

    /**
     * Renders the HTML card for a single cart line item.
     *
     * Implementation: Looks up the product by the cart entry's productId. Returns
     * an empty string if the product no longer exists. Displays the product emoji,
     * name, description, rental duration, unit price, quantity stepper, and line total.
     *
     * @param {{ productId: string, quantity: number, rentDays: number }} cartItem
     * @returns {string} HTML string for one cart item card, or '' if product not found.
     */
    _renderCartItem(cartItem) {
        const { app } = this;
        const product = app.getProductById(cartItem.productId);
        if (!product) return '';

        const itemTotal = app.calculateCartItemTotal(cartItem);

        return `
            <article class="card cart-item-card">
                <div class="cart-item-top">
                    <div class="cart-item-visual"><img src="${app.escapeHtml(product.image)}" alt="${app.escapeHtml(product.name)}"></div>
                    <div class="cart-item-info">
                        <h2>${app.escapeHtml(product.name)}</h2>
                        <p>${app.escapeHtml(product.description)}</p>
                    </div>
                    <button type="button" class="icon-button" data-action="remove-cart-item" data-product-id="${product.id}">×</button>
                </div>
                <div class="cart-item-bottom">
                    <span class="cart-item-price-tag">${product.price} ₪ <span class="per-day-label">ליום</span></span>
                    <div class="cart-controls-group">
                        <div class="cart-control-row">
                            <span class="control-label">כמות</span>
                            <button type="button" class="quantity-button" data-action="change-cart-quantity" data-product-id="${product.id}" data-delta="-1">−</button>
                            <strong class="control-value">${cartItem.quantity}</strong>
                            <button type="button" class="quantity-button" data-action="change-cart-quantity" data-product-id="${product.id}" data-delta="1">+</button>
                        </div>
                        <div class="cart-control-row">
                            <span class="control-label">ימים</span>
                            <button type="button" class="quantity-button" data-action="change-cart-days" data-product-id="${product.id}" data-delta="-1">−</button>
                            <strong class="control-value">${cartItem.rentDays}</strong>
                            <button type="button" class="quantity-button" data-action="change-cart-days" data-product-id="${product.id}" data-delta="1">+</button>
                        </div>
                    </div>
                    <span class="cart-item-total">${itemTotal} ₪</span>
                </div>
            </article>
        `;
    }
}
