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

export const products = [];

function _mapBackendProduct(p) {
    return {
        id:            p.id,
        name:          p.name,
        description:   p.description   || '',
        type:          p.type,
        price:         p.price,
        stock:         p.stock,
        visual:        p.visual         || '📦',
        image:         p.image          || '',
        categoryLabel: p.category_label || (p.type === 'rent' ? 'השכרה' : 'רכישה'),
        rentLabel:     p.rent_label     || (p.type === 'rent' ? 'ליום' : ''),
        searchTerms:   p.search_terms   || (p.name || '').toLowerCase(),
    };
}

export async function refreshFromBackend() {
    const [productsRes, inventoryRes] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/inventory'),
    ]);
    if (productsRes.ok) {
        const raw = await productsRes.json();
        products.length = 0;
        raw.forEach((p) => products.push(_mapBackendProduct(p)));
    }
    if (inventoryRes.ok) {
        const inv = await inventoryRes.json();
        Object.keys(state.inventory).forEach((k) => delete state.inventory[k]);
        Object.assign(state.inventory, inv);
    }
}

// ===== State Loaders =====

export function loadCartState() {
    const items = loadStoredJson(STORAGE_KEYS.cart, []);
    return Array.isArray(items) ? items : [];
}

export function saveCartState() {
    saveStoredJson(STORAGE_KEYS.cart, state.cart);
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

