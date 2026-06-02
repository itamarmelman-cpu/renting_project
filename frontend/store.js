import { PRODUCTS } from './data/products.js';
import { loadStoredJson, saveStoredJson } from './utils.js';

// ===== Constants =====

export const STORAGE_KEYS = {
    cart:         'grabit.cart',
    inventory:    'grabit.inventory',
    rentDays:     'grabit.rentDays',
    orders:       'grabit.orders',
    returns:      'grabit.returns',
    reservations: 'grabit.reservations',
};

// ===== Shared Runtime State =====

export const state = {
    cart:                 [],
    inventory:            {},
    rentDaysByProductId:  {},
    lockerOpen:           false,
};

export const products = [...PRODUCTS];

// ===== State Loaders =====

export function loadCartState() {
    const items = loadStoredJson(STORAGE_KEYS.cart, []);
    return Array.isArray(items) ? items : [];
}

export function loadInventoryState() {
    const stored = loadStoredJson(STORAGE_KEYS.inventory, null);
    if (stored && typeof stored === 'object') return normalizeInventory(stored);
    const defaults = Object.fromEntries(products.map((p) => [p.id, p.stock]));
    saveStoredJson(STORAGE_KEYS.inventory, defaults);
    return defaults;
}

export function saveCartState() {
    saveStoredJson(STORAGE_KEYS.cart, state.cart);
}

export function saveInventoryState() {
    saveStoredJson(STORAGE_KEYS.inventory, state.inventory);
    fetch('/api/inventory', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(state.inventory),
    }).catch(() => {});
}

export function normalizeInventory(inventory) {
    const normalized = {};
    products.forEach((product) => {
        const val = Number(inventory[product.id]);
        normalized[product.id] = Number.isFinite(val) ? val : product.stock;
    });
    saveStoredJson(STORAGE_KEYS.inventory, normalized);
    return normalized;
}

// ===== Lookup Helpers =====

export function getProductById(id) {
    return products.find((p) => p.id === id) || null;
}

export function getCartItemByProductId(id) {
    return state.cart.find((item) => item.productId === id) || null;
}

export function getCartItemCount() {
    return state.cart.reduce((total, item) => total + item.quantity, 0);
}

export function getInventoryStock(id) {
    return Number(state.inventory[id] || 0);
}

export function getAvailableStock(id) {
    return Math.max(0, getInventoryStock(id) - getCartQuantity(id));
}

export function getCartQuantity(id) {
    const item = getCartItemByProductId(id);
    return item ? item.quantity : 0;
}

// ===== Cart Operations =====

export function addProductToCart(productId) {
    const product = getProductById(productId);
    if (!product) return;
    if (getAvailableStock(productId) <= 0) return;

    const cartItem = getCartItemByProductId(productId);
    if (cartItem) {
        cartItem.quantity += 1;
        cartItem.rentDays  = getRentDaysPreference(productId);
    } else {
        state.cart.push({ productId: product.id, quantity: 1, rentDays: getRentDaysPreference(productId) });
    }
    saveCartState();
}

export function updateCartItemQuantity(productId, delta) {
    const cartItem = getCartItemByProductId(productId);
    if (!cartItem) return;

    const updatedQty = cartItem.quantity + delta;
    if (updatedQty <= 0) { removeCartItem(productId); return; }
    if (updatedQty > getInventoryStock(productId)) return;

    cartItem.quantity = updatedQty;
    saveCartState();
}

export function updateCartItemRentDays(productId, delta) {
    const cartItem = getCartItemByProductId(productId);
    if (!cartItem) return;
    const updated = (cartItem.rentDays || 1) + delta;
    if (updated < 1) return;
    cartItem.rentDays = updated;
    saveCartState();
}

export function removeCartItem(productId) {
    state.cart = state.cart.filter((item) => item.productId !== productId);
    saveCartState();
}

export function clearCart() {
    state.cart = [];
    saveCartState();
}

// ===== Price Calculations =====

export function calculateCartItemTotal(cartItem) {
    const product = getProductById(cartItem.productId);
    if (!product) return 0;
    return product.price * cartItem.quantity * (cartItem.rentDays || 1);
}

export function calculateCartTotal() {
    return state.cart.reduce((total, item) => total + calculateCartItemTotal(item), 0);
}

// ===== Rent-Day Preferences =====

export function setRentDaysPreference(id, days) {
    state.rentDaysByProductId[id] = days;
    saveStoredJson(STORAGE_KEYS.rentDays, state.rentDaysByProductId);
}

export function getRentDaysPreference(id) {
    const days = Number(state.rentDaysByProductId[id]);
    return [1, 2, 3].includes(days) ? days : 1;
}

// ===== Orders & Returns =====

export function saveOrder(order) {
    const orders = loadStoredJson(STORAGE_KEYS.orders, []);
    orders.push(order);
    saveStoredJson(STORAGE_KEYS.orders, orders);
}

export function incrementInventoryForReturn(productId, qty = 1) {
    state.inventory[productId] = getInventoryStock(productId) + qty;
    saveInventoryState();
}

export function validateReturn(firstName, lastName, items) {
    const customerName = `${firstName} ${lastName}`;
    const orders  = loadStoredJson(STORAGE_KEYS.orders,  []);
    const returns = loadStoredJson(STORAGE_KEYS.returns, []);

    const errors     = [];
    const validItems = [];

    for (const { productId, quantity } of items) {
        const product = getProductById(productId);
        if (!product || product.type !== 'rent') {
            errors.push('מוצר לא נמצא או אינו מוצר להשכרה');
            continue;
        }

        let totalRented = 0;
        for (const order of orders) {
            if (order.customerName === customerName) {
                for (const item of (order.items || [])) {
                    if (item.productId === productId) totalRented += item.quantity || 1;
                }
            }
        }

        let totalReturned = 0;
        for (const ret of returns) {
            if (ret.firstName === firstName && ret.lastName === lastName) {
                for (const item of (ret.items || [])) {
                    if (item.productId === productId) totalReturned += item.quantity || 1;
                }
            }
        }

        const available = totalRented - totalReturned;
        if (available <= 0) {
            errors.push(`${product.name}: לא נמצאה השכרה פעילה על שמך`);
        } else if (quantity > available) {
            errors.push(`${product.name}: ביקשת להחזיר ${quantity} אך יש לך רק ${available} בהשכרה פעילה`);
        } else {
            validItems.push({ productId, quantity, productName: product.name });
        }
    }

    return errors.length > 0 ? { valid: false, errors } : { valid: true, items: validItems };
}

export function saveReturnToLocal(firstName, lastName, items) {
    const returns = loadStoredJson(STORAGE_KEYS.returns, []);
    returns.push({ firstName, lastName, items, returnedAt: new Date().toISOString() });
    saveStoredJson(STORAGE_KEYS.returns, returns);
}

export function getActiveRentedProductIds() {
    const orders  = loadStoredJson(STORAGE_KEYS.orders,  []);
    const returns = loadStoredJson(STORAGE_KEYS.returns, []);

    const ordered  = {};
    const returned = {};

    for (const order of orders) {
        for (const item of (order.items || [])) {
            ordered[item.productId] = (ordered[item.productId] || 0) + (item.quantity || 1);
        }
    }
    for (const ret of returns) {
        for (const item of (ret.items || [])) {
            returned[item.productId] = (returned[item.productId] || 0) + (item.quantity || 1);
        }
    }

    return products
        .filter((p) => p.type === 'rent' && (ordered[p.id] || 0) > (returned[p.id] || 0))
        .map((p) => p.id);
}
