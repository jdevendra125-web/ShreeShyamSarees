import './style.css';
import { createClient } from '@supabase/supabase-js';

// Application State
let supabase = null;
let visitors = [];
let products = [];
let stockLevels = []; // Array of {product_id, size, quantity}
let lastRegisteredVisitor = null;

// Cart State (Customer storefront)
let cart = [];

// Sales Invoice Basket State (Owner Portal)
let invoiceBasket = [];

// History Log Active Type (sales vs orders)
let activeHistoryTab = 'sales'; 

// Constants
const WHATSAPP_GROUP_LINK = "https://chat.whatsapp.com/K2jtomZ8v0zBQDKQydA4im?s=cl&p=a&mlu=2";
const STORE_ADDRESS = "G2, Tapasya Apartment, Bhayandar West, Near Madhu Maternity Hospital, 401101";
const FIRM_NAME = "Shree Shyam Sarees";

const DEFAULT_SUPABASE_URL = "https://chientorhbzoqgzusnyp.supabase.co";
const DEFAULT_SUPABASE_KEY = "sb_publishable_dwNTrG7o9s5htPN_PS09Sg_EWyLwkh1";

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  initSupabase().then(() => {
    initAppRouting();
  });
});

// --- ROUTING SYSTEM ---
function initAppRouting() {
  const urlParams = new URLSearchParams(window.location.search);
  const view = urlParams.get('view');

  const customerView = document.getElementById('customer-view');
  const ownerView = document.getElementById('owner-view');

  if (view === 'owner') {
    if (customerView) customerView.classList.add('hidden');
    if (ownerView) ownerView.classList.remove('hidden');
    
    initOwnerPortal();
  } else {
    if (customerView) customerView.classList.remove('hidden');
    if (ownerView) ownerView.classList.add('hidden');
    
    initCustomerStorefront();
  }
}

// --- DB CONNECTION ---
function loadSettings() {
  const url = localStorage.getItem('supabase_url') || DEFAULT_SUPABASE_URL;
  const key = localStorage.getItem('supabase_anon_key') || DEFAULT_SUPABASE_KEY;
  
  // Set values if modal settings fields exist
  const inputSettingsUrl = document.getElementById('settings-url');
  const inputSettingsKey = document.getElementById('settings-key');
  if (inputSettingsUrl) inputSettingsUrl.value = url;
  if (inputSettingsKey) inputSettingsKey.value = key;

  // Set EmailJS settings
  const inputEmailJSPublic = document.getElementById('settings-emailjs-public');
  const inputEmailJSService = document.getElementById('settings-emailjs-service');
  const inputEmailJSTemplate = document.getElementById('settings-emailjs-template');
  const inputEmailJSRecipient = document.getElementById('settings-emailjs-recipient');

  if (inputEmailJSPublic) inputEmailJSPublic.value = localStorage.getItem('emailjs_public') || '';
  if (inputEmailJSService) inputEmailJSService.value = localStorage.getItem('emailjs_service') || '';
  if (inputEmailJSTemplate) inputEmailJSTemplate.value = localStorage.getItem('emailjs_template') || '';
  if (inputEmailJSRecipient) inputEmailJSRecipient.value = localStorage.getItem('emailjs_recipient') || 'shreeshyamsarees@gmail.com';
}

function saveSettings(url, key) {
  localStorage.setItem('supabase_url', url.trim());
  localStorage.setItem('supabase_anon_key', key.trim());
}

async function initSupabase() {
  const url = localStorage.getItem('supabase_url') || DEFAULT_SUPABASE_URL;
  const key = localStorage.getItem('supabase_anon_key') || DEFAULT_SUPABASE_KEY;

  if (!url || !key) {
    updateConnectionStatus(false, "Disconnected (Please configure settings)");
    return false;
  }

  try {
    supabase = createClient(url.trim(), key.trim());
    updateConnectionStatus(true, "Connected");
    return true;
  } catch (error) {
    console.error("Failed to initialize Supabase:", error);
    updateConnectionStatus(false, "Connection Failed");
    return false;
  }
}

function updateConnectionStatus(isConnected, text) {
  const settingsStatus = document.getElementById('settings-status');
  if (settingsStatus) {
    settingsStatus.className = `status-indicator ${isConnected ? 'connected' : 'disconnected'}`;
    settingsStatus.querySelector('.status-text').textContent = text;
  }
}

// --- CUSTOMER VIEW (STOREFRONT) LOGIC ---
async function initCustomerStorefront() {
  setupCustomerEventListeners();
  await loadCatalogProducts();
}

async function loadCatalogProducts() {
  if (!supabase) return;
  const catalogGrid = document.getElementById('catalog-grid');
  
  try {
    // 1. Fetch all products
    const { data: dbProducts, error: pError } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (pError) throw pError;
    products = dbProducts || [];

    // 2. Fetch all stock details
    const { data: dbStock, error: sError } = await supabase
      .from('product_stock')
      .select('*');

    if (sError) throw sError;
    stockLevels = dbStock || [];

    renderCatalog();
  } catch (e) {
    console.error("Error loading storefront catalog:", e);
    if (catalogGrid) {
      catalogGrid.innerHTML = `
        <div class="catalog-empty">
          <p style="color: var(--color-error)">Failed to load products: ${e.message}</p>
        </div>
      `;
    }
  }
}

function renderCatalog() {
  const catalogGrid = document.getElementById('catalog-grid');
  if (!catalogGrid) return;

  if (products.length === 0) {
    catalogGrid.innerHTML = `
      <div class="catalog-empty">
        <p>No saree collections added yet. Please check back later!</p>
      </div>
    `;
    return;
  }

  catalogGrid.innerHTML = products.map(product => {
    // Get stock variants for this product
    const variants = stockLevels.filter(s => s.product_id === product.id && s.quantity > 0);
    const totalQty = variants.reduce((acc, curr) => acc + curr.quantity, 0);
    
    let stockStatusHTML = `<span class="stock-tag out-stock">Out of Stock</span>`;
    if (totalQty > 5) {
      stockStatusHTML = `<span class="stock-tag in-stock">In Stock</span>`;
    } else if (totalQty > 0) {
      stockStatusHTML = `<span class="stock-tag low-stock">Only ${totalQty} left</span>`;
    }

    // Size options buttons
    let sizesHTML = '';
    if (variants.length > 0) {
      sizesHTML = `
        <div class="product-sizes-container">
          <div class="sizes-title">Select Size</div>
          <div class="sizes-options" data-product-id="${product.id}">
            ${variants.map(v => `
              <button class="size-option-btn" data-size="${v.size}" data-qty="${v.quantity}">
                ${v.size}
              </button>
            `).join('')}
          </div>
        </div>
      `;
    } else {
      sizesHTML = `
        <div class="product-sizes-container">
          <p style="font-size: 0.82rem; color: var(--color-error); font-weight: 600;">Currently Unavailable</p>
        </div>
      `;
    }

    const priceHTML = product.sale_price 
      ? `<span class="original-price">₹${product.price}</span><span class="sale-price">₹${product.sale_price}</span>`
      : `<span class="sale-price">₹${product.price}</span>`;

    const ribbonHTML = product.sale_price
      ? `<div class="offer-ribbon">OFFER</div>`
      : '';

    const defaultPhoto = "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect width=%22100%25%22 height=%22100%25%22 fill=%22%23eae6d8%22/><text x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 font-size=%2214%22 fill=%22%23800020%22 font-family=%22serif%22>Shree Shyam Sarees</text></svg>";

    const finalPhotoUrl = product.photo_url || defaultPhoto;

    return `
      <div class="product-card" id="card-${product.id}">
        <div class="product-image-wrapper">
          <img src="${finalPhotoUrl}" class="product-img" alt="${product.name}" onerror="this.src='${defaultPhoto}'"/>
          ${ribbonHTML}
          ${stockStatusHTML}
        </div>
        <div class="product-info">
          <h3>${escapeHTML(product.name)}</h3>
          <p class="product-desc">${escapeHTML(product.description || 'No description available.')}</p>
          
          <div class="product-price-row">
            ${priceHTML}
          </div>

          ${sizesHTML}

          <button class="btn-primary btn-add-to-cart" data-id="${product.id}" ${variants.length === 0 ? 'disabled' : ''}>
            <span>Add to Cart</span>
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Add event listeners to size buttons
  document.querySelectorAll('.sizes-options').forEach(container => {
    container.querySelectorAll('.size-option-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        // Toggle selected state
        container.querySelectorAll('.size-option-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
    });
  });

  // Add event listeners to "Add to Cart" buttons
  document.querySelectorAll('.btn-add-to-cart').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const productId = btn.getAttribute('data-id');
      const sizeContainer = document.querySelector(`.sizes-options[data-product-id="${productId}"]`);
      
      if (!sizeContainer) {
        alert("This item is unavailable.");
        return;
      }

      const selectedBtn = sizeContainer.querySelector('.size-option-btn.selected');
      if (!selectedBtn) {
        alert("Please select a size first!");
        return;
      }

      const selectedSize = selectedBtn.getAttribute('data-size');
      const maxQty = parseInt(selectedBtn.getAttribute('data-qty'), 10);
      
      addToCart(productId, selectedSize, maxQty);
    });
  });
}

function addToCart(productId, size, maxQty) {
  const product = products.find(p => p.id === productId);
  if (!product) return;

  const existing = cart.find(item => item.id === productId && item.size === size);
  const currentQty = existing ? existing.qty : 0;

  if (currentQty + 1 > maxQty) {
    alert(`Only ${maxQty} item(s) available in size ${size}. Cannot add more.`);
    return;
  }

  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      size: size,
      qty: 1,
      price: product.sale_price || product.price,
      photo_url: product.photo_url,
      maxQty: maxQty
    });
  }

  updateCartBadge();
  renderCartDrawer();
  openCartDrawer();
}

function updateCartBadge() {
  const cartBadge = document.getElementById('cart-badge');
  if (!cartBadge) return;

  const totalItems = cart.reduce((acc, curr) => acc + curr.qty, 0);
  if (totalItems > 0) {
    cartBadge.textContent = totalItems;
    cartBadge.classList.remove('hidden');
  } else {
    cartBadge.classList.add('hidden');
  }
}

function renderCartDrawer() {
  const cartItemsContainer = document.getElementById('cart-items-container');
  const formCheckout = document.getElementById('form-checkout');
  if (!cartItemsContainer || !formCheckout) return;

  if (cart.length === 0) {
    cartItemsContainer.innerHTML = `<p class="cart-empty-msg">Your cart is empty.</p>`;
    formCheckout.classList.add('hidden');
    return;
  }

  cartItemsContainer.innerHTML = cart.map(item => {
    const defaultPhoto = "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect width=%22100%25%22 height=%22100%25%22 fill=%22%23eae6d8%22/><text x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 font-size=%2212%22 fill=%22%23800020%22 font-family=%22serif%22>Saree</text></svg>";
    const finalPhoto = item.photo_url || defaultPhoto;

    return `
      <div class="cart-item-row">
        <img src="${finalPhoto}" class="cart-item-img" alt="${item.name}" onerror="this.src='${defaultPhoto}'"/>
        <div class="cart-item-details">
          <div class="cart-item-name">${escapeHTML(item.name)}</div>
          <div class="cart-item-size-tag">Size: ${item.size}</div>
          <div class="cart-item-price">₹${item.price}</div>
        </div>
        <div class="cart-item-actions">
          <div class="cart-qty-control">
            <button class="cart-qty-btn btn-qty-minus" data-id="${item.id}" data-size="${item.size}">-</button>
            <span class="cart-qty-val">${item.qty}</span>
            <button class="cart-qty-btn btn-qty-plus" data-id="${item.id}" data-size="${item.size}">+</button>
          </div>
          <button class="btn-remove-item" data-id="${item.id}" data-size="${item.size}">Remove</button>
        </div>
      </div>
    `;
  }).join('');

  // Update calculations
  const subtotal = cart.reduce((acc, curr) => acc + (curr.price * curr.qty), 0);
  document.getElementById('cart-summary-subtotal').textContent = `₹${subtotal}`;
  document.getElementById('cart-summary-total').textContent = `₹${subtotal}`;
  
  formCheckout.classList.remove('hidden');

  // Event listeners inside cart
  document.querySelectorAll('.btn-qty-minus').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const size = btn.getAttribute('data-size');
      changeCartQty(id, size, -1);
    });
  });

  document.querySelectorAll('.btn-qty-plus').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const size = btn.getAttribute('data-size');
      changeCartQty(id, size, 1);
    });
  });

  document.querySelectorAll('.btn-remove-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const size = btn.getAttribute('data-size');
      removeFromCart(id, size);
    });
  });
}

function changeCartQty(id, size, delta) {
  const item = cart.find(i => i.id === id && i.size === size);
  if (!item) return;

  const newQty = item.qty + delta;
  if (newQty <= 0) {
    removeFromCart(id, size);
    return;
  }

  if (newQty > item.maxQty) {
    alert(`Only ${item.maxQty} items available in size ${item.size}.`);
    return;
  }

  item.qty = newQty;
  updateCartBadge();
  renderCartDrawer();
}

function removeFromCart(id, size) {
  cart = cart.filter(i => !(i.id === id && i.size === size));
  updateCartBadge();
  renderCartDrawer();
}

function openCartDrawer() {
  const drawer = document.getElementById('cart-drawer');
  if (drawer) drawer.classList.remove('hidden');
}

function closeCartDrawer() {
  const drawer = document.getElementById('cart-drawer');
  if (drawer) drawer.classList.add('hidden');
}

function setupCustomerEventListeners() {
  const btnCartToggle = document.getElementById('btn-cart-toggle');
  const btnCloseCart = document.getElementById('btn-close-cart');
  const cartDrawerOverlay = document.querySelector('.cart-drawer-overlay');
  const formCheckout = document.getElementById('form-checkout');

  if (btnCartToggle) {
    btnCartToggle.addEventListener('click', () => {
      renderCartDrawer();
      openCartDrawer();
    });
  }

  if (btnCloseCart) {
    btnCloseCart.addEventListener('click', closeCartDrawer);
  }

  if (cartDrawerOverlay) {
    cartDrawerOverlay.addEventListener('click', closeCartDrawer);
  }

  // Handle Checkout Submit
  if (formCheckout) {
    formCheckout.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      if (cart.length === 0) return;
      if (!supabase) {
        alert("Database connection is not configured.");
        return;
      }

      const name = document.getElementById('checkout-name').value;
      const phone = document.getElementById('checkout-phone').value;
      const address = document.getElementById('checkout-address').value;
      const totalAmount = cart.reduce((acc, curr) => acc + (curr.price * curr.qty), 0);

      const spinner = document.getElementById('checkout-spinner');
      const submitBtn = document.getElementById('btn-place-order');

      // Set Loading
      if (spinner) spinner.classList.remove('hidden');
      if (submitBtn) submitBtn.disabled = true;

      try {
        // 1. Double check stock availability and decrement stock size-wise in DB
        // We will fetch and update sequentially (client-side lock fallback)
        for (const item of cart) {
          const { data: stockRow, error: checkError } = await supabase
            .from('product_stock')
            .select('quantity')
            .eq('product_id', item.id)
            .eq('size', item.size)
            .single();

          if (checkError || !stockRow) {
            throw new Error(`Item ${item.name} in size ${item.size} is no longer available.`);
          }

          if (stockRow.quantity < item.qty) {
            throw new Error(`Insufficient stock for ${item.name} (${item.size}). Available: ${stockRow.quantity}`);
          }

          // Update stock
          const newQty = stockRow.quantity - item.qty;
          const { error: updateError } = await supabase
            .from('product_stock')
            .update({ quantity: newQty })
            .eq('product_id', item.id)
            .eq('size', item.size);

          if (updateError) throw updateError;
        }

        // 2. Insert order record
        const orderItems = cart.map(item => ({
          id: item.id,
          name: item.name,
          size: item.size,
          qty: item.qty,
          price: item.price
        }));

        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .insert([{
            customer_name: name,
            customer_phone: phone,
            customer_address: address,
            items: orderItems,
            total_amount: totalAmount,
            status: 'pending'
          }])
          .select();

        if (orderError) throw orderError;
        const newOrder = orderData[0];

        // 3. Trigger EmailJS Notification
        await sendEmailJSNotification(newOrder, name, phone, address, orderItems, totalAmount);

        // 4. Success handling
        alert(`Thank you ${name}! Your order has been placed successfully. Size-wise stock has been updated.`);
        
        // Reset cart
        cart = [];
        updateCartBadge();
        closeCartDrawer();
        
        // Clear checkout form
        formCheckout.reset();

        // Refresh Storefront catalog
        await loadCatalogProducts();
      } catch (err) {
        console.error("Checkout transaction failed:", err);
        alert(`Failed to place order: ${err.message}`);
      } finally {
        if (spinner) spinner.classList.add('hidden');
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }
}

async function sendEmailJSNotification(order, name, phone, address, items, total) {
  const serviceId = localStorage.getItem('emailjs_service');
  const templateId = localStorage.getItem('emailjs_template');
  const publicKey = localStorage.getItem('emailjs_public');
  const recipient = localStorage.getItem('emailjs_recipient') || 'shreeshyamsarees@gmail.com';

  if (!serviceId || !templateId || !publicKey) {
    console.warn("EmailJS notification skipped: credentials are not configured in settings.");
    return;
  }

  // Build items description
  const itemsText = items.map(i => `- ${i.name} (Size: ${i.size}) x ${i.qty} @ ₹${i.price}`).join('\n');

  const templateParams = {
    to_email: recipient,
    customer_name: name,
    customer_phone: phone,
    customer_address: address,
    order_details: itemsText,
    total_amount: `₹${total}`,
    order_id: order.id.substring(0, 8).toUpperCase()
  };

  try {
    emailjs.init({ publicKey: publicKey });
    const response = await emailjs.send(serviceId, templateId, templateParams);
    console.log("EmailJS order notification sent successfully!", response);
  } catch (err) {
    console.error("EmailJS notification failed:", err);
  }
}


// --------------------------------------------- */
//             OWNER PORTAL VIEW LOGIC           */
// --------------------------------------------- */
async function initOwnerPortal() {
  setupOwnerEventListeners();
  
  // Load initial data for tabs
  await fetchVisitors();
  await loadStockInventory();
  await loadHistoryRecords();
}

function setupOwnerEventListeners() {
  // Tabs Navigation Toggle
  const tabLinks = document.querySelectorAll('.tab-link');
  tabLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const targetTabId = link.getAttribute('data-tab');
      
      // Toggle tab header link states
      tabLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');

      // Toggle tab content panels
      document.querySelectorAll('.tab-content-grid').forEach(panel => {
        panel.classList.add('hidden');
      });
      const targetPanel = document.getElementById(targetTabId);
      if (targetPanel) targetPanel.classList.remove('hidden');
    });
  });

  // Settings Modal Toggle (Owner Portal Gear Button)
  const btnSettingsOwner = document.getElementById('btn-settings-owner');
  const btnCloseSettings = document.getElementById('btn-close-settings');
  const btnSaveSettings = document.getElementById('btn-save-settings');
  const btnTestConnection = document.getElementById('btn-test-connection');

  if (btnSettingsOwner) {
    btnSettingsOwner.addEventListener('click', () => {
      loadSettings();
      document.getElementById('modal-settings').classList.remove('hidden');
    });
  }

  if (btnCloseSettings) {
    btnCloseSettings.addEventListener('click', () => {
      document.getElementById('modal-settings').classList.add('hidden');
    });
  }

  if (btnSaveSettings) {
    btnSaveSettings.addEventListener('click', async () => {
      const url = document.getElementById('settings-url').value.trim();
      const key = document.getElementById('settings-key').value.trim();

      // Save EmailJS details too
      localStorage.setItem('emailjs_public', document.getElementById('settings-emailjs-public').value.trim());
      localStorage.setItem('emailjs_service', document.getElementById('settings-emailjs-service').value.trim());
      localStorage.setItem('emailjs_template', document.getElementById('settings-emailjs-template').value.trim());
      localStorage.setItem('emailjs_recipient', document.getElementById('settings-emailjs-recipient').value.trim());

      if (!url || !key) {
        alert("Both Supabase URL and Anon Key are required.");
        return;
      }

      saveSettings(url, key);
      const success = await initSupabase();
      if (success) {
        alert("Settings saved successfully!");
        document.getElementById('modal-settings').classList.add('hidden');
        // Refresh views
        await fetchVisitors();
        await loadStockInventory();
        await loadHistoryRecords();
      } else {
        alert("Failed to connect with settings. Please verify details.");
      }
    });
  }

  if (btnTestConnection) {
    btnTestConnection.addEventListener('click', async () => {
      const url = document.getElementById('settings-url').value.trim();
      const key = document.getElementById('settings-key').value.trim();
      
      if (!url || !key) {
        alert("Please input Supabase URL and key first.");
        return;
      }

      btnTestConnection.disabled = true;
      btnTestConnection.textContent = "Testing...";

      try {
        const client = createClient(url, key);
        const { error } = await client.from('visitors').select('id').limit(1);
        if (error) throw error;
        alert("Connection Successful!");
        updateConnectionStatus(true, "Connected");
      } catch (err) {
        alert(`Connection Failed: ${err.message}`);
        updateConnectionStatus(false, "Connection Failed");
      } finally {
        btnTestConnection.disabled = false;
        btnTestConnection.textContent = "Test Connection";
      }
    });
  }

  // --- VISITOR REGISTRY DESK ---
  const formVisitor = document.getElementById('form-visitor');
  const searchInput = document.getElementById('search-input');
  const btnExport = document.getElementById('btn-export');
  const btnCloseWhatsapp = document.getElementById('btn-close-whatsapp');
  const btnWhatsappRedirect = document.getElementById('btn-whatsapp-redirect');

  if (formVisitor) {
    formVisitor.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      if (!supabase) {
        alert("Please connect your Supabase database in Settings.");
        return;
      }

      const name = document.getElementById('visitor-name').value;
      const place = document.getElementById('visitor-place').value;
      const rawWhatsapp = document.getElementById('visitor-whatsapp').value;
      const cleanPhone = cleanPhoneNumber(rawWhatsapp);

      if (cleanPhone.length < 10) {
        alert("Please enter a valid phone number (at least 10 digits).");
        return;
      }

      const spinner = document.getElementById('submit-spinner');
      const submitBtn = document.getElementById('btn-submit');

      if (spinner) spinner.classList.remove('hidden');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.querySelector('.btn-text').textContent = "Registering...";
        submitBtn.querySelector('.btn-arrow').classList.add('hidden');
      }

      const savedVisitor = await registerVisitorInDB(name, place, cleanPhone);

      if (spinner) spinner.classList.add('hidden');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.querySelector('.btn-text').textContent = "Register & Send Invite";
        submitBtn.querySelector('.btn-arrow').classList.remove('hidden');
      }

      if (savedVisitor) {
        formVisitor.reset();
        lastRegisteredVisitor = savedVisitor;
        await fetchVisitors();

        // Setup success modal and preview message
        document.getElementById('success-visitor-name').textContent = savedVisitor.name;
        document.getElementById('whatsapp-message-preview').textContent = generateWhatsAppMessage(savedVisitor.name);
        
        // Open WhatsApp Success Modal
        document.getElementById('modal-whatsapp').classList.remove('hidden');
      }
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderVisitors();
    });
  }

  if (btnExport) {
    btnExport.addEventListener('click', () => {
      exportToCSV();
    });
  }

  if (btnCloseWhatsapp) {
    btnCloseWhatsapp.addEventListener('click', () => {
      document.getElementById('modal-whatsapp').classList.add('hidden');
    });
  }

  if (btnWhatsappRedirect) {
    btnWhatsappRedirect.addEventListener('click', () => {
      if (lastRegisteredVisitor) {
        openWhatsAppRedirect(
          lastRegisteredVisitor.whatsapp_number, 
          lastRegisteredVisitor.name, 
          lastRegisteredVisitor.id
        );
        document.getElementById('modal-whatsapp').classList.add('hidden');
      }
    });
  }

  // --- STOCK MANAGER DESK ---
  const formStock = document.getElementById('form-stock');
  const btnRefreshStock = document.getElementById('btn-refresh-stock');

  if (formStock) {
    formStock.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!supabase) {
        alert("Database connection is not configured.");
        return;
      }

      const sku = document.getElementById('stock-sku').value.trim();
      const name = document.getElementById('stock-name').value.trim();
      const desc = document.getElementById('stock-desc').value.trim();
      const price = parseFloat(document.getElementById('stock-price').value);
      const salePriceInput = document.getElementById('stock-sale-price').value;
      const salePrice = salePriceInput ? parseFloat(salePriceInput) : null;
      const photoFile = document.getElementById('stock-photo-file').files[0];

      const sizes = [
        { name: 'Free Size', qty: parseInt(document.getElementById('qty-freesize').value) || 0 },
        { name: 'S', qty: parseInt(document.getElementById('qty-s').value) || 0 },
        { name: 'M', qty: parseInt(document.getElementById('qty-m').value) || 0 },
        { name: 'L', qty: parseInt(document.getElementById('qty-l').value) || 0 },
        { name: 'XL', qty: parseInt(document.getElementById('qty-xl').value) || 0 }
      ];

      const spinner = document.getElementById('stock-spinner');
      const submitBtn = document.getElementById('btn-save-product');

      if (spinner) spinner.classList.remove('hidden');
      if (submitBtn) submitBtn.disabled = true;

      try {
        let photoUrl = null;

        // Upload photo to Supabase storage if selected
        if (photoFile) {
          const fileExt = photoFile.name.split('.').pop();
          const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 10)}.${fileExt}`;
          
          const { data: uploadData, error: uploadError } = await supabase
            .storage
            .from('product-photos')
            .upload(fileName, photoFile);

          if (uploadError) throw uploadError;

          const { data: publicUrlData } = supabase
            .storage
            .from('product-photos')
            .getPublicUrl(fileName);

          photoUrl = publicUrlData.publicUrl;
        }

        // 1. Insert product details
        const { data: pData, error: pError } = await supabase
          .from('products')
          .insert([{
            sku: sku,
            name: name,
            description: desc,
            price: price,
            sale_price: salePrice,
            photo_url: photoUrl
          }])
          .select();

        if (pError) throw pError;
        const newProduct = pData[0];

        // 2. Insert initial stock rows
        const stockInserts = sizes
          .filter(s => s.qty >= 0) // Filter only valid quantities
          .map(s => ({
            product_id: newProduct.id,
            size: s.name,
            quantity: s.qty
          }));

        if (stockInserts.length > 0) {
          const { error: sError } = await supabase
            .from('product_stock')
            .insert(stockInserts);
          if (sError) throw sError;
        }

        alert(`Product "${name}" saved and inventory initialized size-wise!`);
        formStock.reset();
        
        // Reset size inputs to default
        document.getElementById('qty-freesize').value = "10";
        document.getElementById('qty-s').value = "0";
        document.getElementById('qty-m').value = "0";
        document.getElementById('qty-l').value = "0";
        document.getElementById('qty-xl').value = "0";

        // Refresh stock table & rebuild invoice selects
        await loadStockInventory();
      } catch (err) {
        console.error("Save product failed:", err);
        alert(`Failed to save product: ${err.message}`);
      } finally {
        if (spinner) spinner.classList.add('hidden');
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  if (btnRefreshStock) {
    btnRefreshStock.addEventListener('click', async () => {
      btnRefreshStock.disabled = true;
      btnRefreshStock.textContent = "Loading...";
      await loadStockInventory();
      btnRefreshStock.disabled = false;
      btnRefreshStock.textContent = "Refresh";
    });
  }

  // --- SALES INVOICING DESK ---
  const formSale = document.getElementById('form-sale');
  const btnAddToBasket = document.getElementById('btn-add-to-basket');
  const basketProductSelect = document.getElementById('basket-product-select');
  const btnCloseInvoice = document.getElementById('btn-close-invoice');
  const btnPrintReceipt = document.getElementById('btn-print-receipt');

  // Load variant options when product is chosen in select
  if (basketProductSelect) {
    basketProductSelect.addEventListener('change', () => {
      const productId = basketProductSelect.value;
      const sizeSelect = document.getElementById('basket-size-select');
      if (!sizeSelect) return;

      sizeSelect.innerHTML = `<option value="">Size</option>`;
      if (!productId) return;

      const variants = stockLevels.filter(s => s.product_id === productId && s.quantity > 0);
      sizeSelect.innerHTML += variants.map(v => `
        <option value="${v.size}">
          ${v.size} (Qty: ${v.quantity})
        </option>
      `).join('');
    });
  }

  if (btnAddToBasket) {
    btnAddToBasket.addEventListener('click', () => {
      const productId = basketProductSelect.value;
      const sizeSelect = document.getElementById('basket-size-select');
      const size = sizeSelect ? sizeSelect.value : '';
      const qtyInput = document.getElementById('basket-qty-input');
      const qty = qtyInput ? parseInt(qtyInput.value, 10) : 0;

      if (!productId || !size || qty <= 0) {
        alert("Please choose a product, select a size, and enter a valid quantity.");
        return;
      }

      const product = products.find(p => p.id === productId);
      const stockRow = stockLevels.find(s => s.product_id === productId && s.size === size);

      if (!product || !stockRow) return;

      // Verify stock level before adding
      const existing = invoiceBasket.find(i => i.id === productId && i.size === size);
      const currentBasketQty = existing ? existing.qty : 0;

      if (currentBasketQty + qty > stockRow.quantity) {
        alert(`Insufficient stock! Available: ${stockRow.quantity}. Already in basket: ${currentBasketQty}.`);
        return;
      }

      if (existing) {
        existing.qty += qty;
      } else {
        invoiceBasket.push({
          id: product.id,
          name: product.name,
          size: size,
          qty: qty,
          price: product.sale_price || product.price,
          maxQty: stockRow.quantity
        });
      }

      // Reset select options and render basket
      if (qtyInput) qtyInput.value = 1;
      renderInvoiceBasket();
    });
  }

  if (formSale) {
    formSale.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      if (invoiceBasket.length === 0) {
        alert("Please add at least one product to the invoice basket.");
        return;
      }
      if (!supabase) {
        alert("Database connection is not configured.");
        return;
      }

      const name = document.getElementById('sale-cust-name').value.trim();
      const phone = document.getElementById('sale-cust-phone').value.trim();
      const totalAmount = invoiceBasket.reduce((acc, curr) => acc + (curr.price * curr.qty), 0);

      const spinner = document.getElementById('sale-spinner');
      const submitBtn = document.getElementById('btn-generate-invoice');

      if (spinner) spinner.classList.remove('hidden');
      if (submitBtn) submitBtn.disabled = true;

      try {
        // 1. Decrement stock size-wise in DB sequentially
        for (const item of invoiceBasket) {
          const { data: stockRow, error: checkError } = await supabase
            .from('product_stock')
            .select('quantity')
            .eq('product_id', item.id)
            .eq('size', item.size)
            .single();

          if (checkError || !stockRow) {
            throw new Error(`Item ${item.name} (${item.size}) is not in stock inventory.`);
          }

          if (stockRow.quantity < item.qty) {
            throw new Error(`Insufficient stock for ${item.name} (${item.size}). Available: ${stockRow.quantity}`);
          }

          // Decrement
          const newQty = stockRow.quantity - item.qty;
          const { error: updateError } = await supabase
            .from('product_stock')
            .update({ quantity: newQty })
            .eq('product_id', item.id)
            .eq('size', item.size);

          if (updateError) throw updateError;
        }

        // 2. Save sale record in DB
        const saleItems = invoiceBasket.map(item => ({
          id: item.id,
          name: item.name,
          size: item.size,
          qty: item.qty,
          price: item.price
        }));

        const { data: saleData, error: saleError } = await supabase
          .from('sales')
          .insert([{
            customer_name: name,
            customer_phone: phone,
            items: saleItems,
            total_amount: totalAmount
          }])
          .select();

        if (saleError) throw saleError;
        const newSale = saleData[0];

        // 3. Render and display the Invoice Receipt Printable Modal
        renderInvoiceReceipt(newSale);

        // Reset basket & forms
        invoiceBasket = [];
        renderInvoiceBasket();
        formSale.reset();
        
        // Refresh local stock inventory and logs
        await loadStockInventory();
        await loadHistoryRecords();
      } catch (err) {
        console.error("Sale generation failed:", err);
        alert(`Failed to complete sale: ${err.message}`);
      } finally {
        if (spinner) spinner.classList.add('hidden');
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  if (btnCloseInvoice) {
    btnCloseInvoice.addEventListener('click', () => {
      document.getElementById('modal-invoice').classList.add('hidden');
    });
  }

  if (btnPrintReceipt) {
    btnPrintReceipt.addEventListener('click', () => {
      window.print();
    });
  }

  // --- HISTORY LOG TOGGLE DESK ---
  const historyTabs = document.querySelectorAll('.history-tab');
  historyTabs.forEach(tab => {
    tab.addEventListener('click', async () => {
      historyTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      activeHistoryTab = tab.getAttribute('data-history-type');
      
      // Toggle table headers
      const theadRow = document.getElementById('history-thead-row');
      if (activeHistoryTab === 'sales') {
        theadRow.innerHTML = `
          <th>Customer Info</th>
          <th>Items Sold</th>
          <th>Total Paid</th>
          <th>Date</th>
        `;
      } else {
        theadRow.innerHTML = `
          <th>Customer Info</th>
          <th>Items Ordered</th>
          <th>Total Amount</th>
          <th>Date & Status</th>
        `;
      }

      await loadHistoryRecords();
    });
  });

  // Close modals on overlay clicks
  window.addEventListener('click', (e) => {
    const modalInvoice = document.getElementById('modal-invoice');
    if (e.target === modalInvoice) modalInvoice.classList.add('hidden');
  });
}

// --- VISITOR REGISTRY LOGIC ---
async function fetchVisitors() {
  if (!supabase) return;

  try {
    const { data, error } = await supabase
      .from('visitors')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    visitors = data || [];
    renderVisitors();
    updateStats();
  } catch (error) {
    console.error("Error fetching visitors:", error);
  }
}

async function registerVisitorInDB(name, place, whatsapp) {
  try {
    const { data, error } = await supabase
      .from('visitors')
      .insert([
        { 
          name: name.trim(), 
          place: place.trim(), 
          whatsapp_number: whatsapp, 
          sms_status: 'pending' 
        }
      ])
      .select();

    if (error) throw error;
    return data && data.length > 0 ? data[0] : null;
  } catch (error) {
    console.error("Error registering visitor:", error);
    alert(`Registration failed: ${error.message}`);
    return null;
  }
}

async function updateVisitorStatusInDB(id, newStatus) {
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('visitors')
      .update({ sms_status: newStatus })
      .eq('id', id);

    if (error) throw error;
    
    const visitor = visitors.find(v => v.id === id);
    if (visitor) {
      visitor.sms_status = newStatus;
      renderVisitors();
      updateStats();
    }
  } catch (error) {
    console.error("Error updating visitor status:", error);
  }
}

function renderVisitors() {
  const visitorsTbody = document.getElementById('visitors-tbody');
  const searchInput = document.getElementById('search-input');
  if (!visitorsTbody || !searchInput) return;

  const query = searchInput.value.toLowerCase().trim();
  const filtered = visitors.filter(visitor => {
    return (
      visitor.name.toLowerCase().includes(query) ||
      visitor.place.toLowerCase().includes(query) ||
      visitor.whatsapp_number.includes(query)
    );
  });

  if (filtered.length === 0) {
    visitorsTbody.innerHTML = `
      <tr class="empty-row">
        <td colspan="6">
          <div class="empty-state">
            <p>${query ? 'No matching visitors found.' : 'No visitors registered yet.'}</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  visitorsTbody.innerHTML = filtered.map(visitor => {
    const dateStr = formatDate(visitor.created_at);
    const isRedirected = visitor.sms_status === 'redirected';
    const badgeClass = isRedirected ? 'badge-redirected' : 'badge-pending';
    const badgeText = isRedirected ? 'Redirected' : 'Pending';
    
    return `
      <tr>
        <td data-label="Visitor Name" style="font-weight: 500;">${escapeHTML(visitor.name)}</td>
        <td data-label="Place">${escapeHTML(visitor.place)}</td>
        <td data-label="WhatsApp No.">${escapeHTML(visitor.whatsapp_number)}</td>
        <td data-label="Date & Time" style="font-size: 0.85rem; color: var(--color-text-muted);">${dateStr}</td>
        <td data-label="Status">
          <span class="badge ${badgeClass}">
            <span class="badge-dot"></span>
            ${badgeText}
          </span>
        </td>
        <td data-label="Action">
          <button class="btn-table-whatsapp btn-visitor-whatsapp" data-id="${visitor.id}" data-phone="${visitor.whatsapp_number}" data-name="${visitor.name}">
            <span>${isRedirected ? 'Resend' : 'Send'}</span>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  document.querySelectorAll('.btn-visitor-whatsapp').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget;
      const id = target.getAttribute('data-id');
      const phone = target.getAttribute('data-phone');
      const name = target.getAttribute('data-name');
      openWhatsAppRedirect(phone, name, id);
    });
  });
}

function updateStats() {
  const statTotal = document.getElementById('stat-total');
  const statInvites = document.getElementById('stat-invites');
  if (statTotal) statTotal.textContent = visitors.length;
  if (statInvites) {
    const redirectedCount = visitors.filter(v => v.sms_status === 'redirected').length;
    statInvites.textContent = redirectedCount;
  }
}

// --- WHATSAPP REDIRECT UTILS ---
function cleanPhoneNumber(number) {
  let clean = number.replace(/\D/g, '');
  if (clean.length === 10) {
    clean = '91' + clean;
  }
  if (clean.startsWith('0') && clean.length > 10) {
    clean = clean.substring(1);
  }
  return clean;
}

function generateWhatsAppMessage(visitorName) {
  return `Hello ${visitorName},

Thank you for visiting *${FIRM_NAME}* at our exhibition stall! We are delighted to connect with you.

Please join our WhatsApp Group to explore our latest collection of premium sarees, exclusive designs, and upcoming arrivals:
👉 ${WHATSAPP_GROUP_LINK}

📍 *Visit our physical store:*
${STORE_ADDRESS}

Looking forward to styling you soon!
*${FIRM_NAME}*`;
}

function openWhatsAppRedirect(phone, name, id) {
  const cleanPhone = cleanPhoneNumber(phone);
  const message = generateWhatsAppMessage(name);
  const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  window.open(waUrl, '_blank');
  updateVisitorStatusInDB(id, 'redirected');
}

// --- OWNER STOCK LEVELS LOGIC ---
async function loadStockInventory() {
  if (!supabase) return;

  try {
    // 1. Fetch products
    const { data: pData, error: pError } = await supabase
      .from('products')
      .select('*')
      .order('name', { ascending: true });

    if (pError) throw pError;
    products = pData || [];

    // 2. Fetch stock levels
    const { data: sData, error: sError } = await supabase
      .from('product_stock')
      .select('*');

    if (sError) throw sError;
    stockLevels = sData || [];

    // Render Table and Invoicing selectors
    renderStockTable();
    populateProductSelectForInvoicing();
  } catch (err) {
    console.error("Error loading stock database:", err);
  }
}

function renderStockTable() {
  const tbody = document.getElementById('stock-tbody');
  if (!tbody) return;

  if (products.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center">No products in stock inventory. Add one above!</td></tr>`;
    return;
  }

  tbody.innerHTML = products.map(product => {
    // Find stock entries
    const entries = stockLevels.filter(s => s.product_id === product.id);
    const totalStock = entries.reduce((acc, curr) => acc + curr.quantity, 0);

    // Format size listings
    const sizesHTML = entries.length > 0
      ? entries.map(s => `
          <span style="display:inline-block; background:#f0ebdc; padding:2px 8px; border-radius:4px; margin:2px; font-size:0.8rem;">
            <strong>${s.size}</strong>: ${s.quantity}
          </span>
        `).join('')
      : '<span style="color:var(--color-error)">No size stock added</span>';

    const priceText = product.sale_price 
      ? `<span style="text-decoration:line-through; color:var(--color-text-muted)">₹${product.price}</span> <strong style="color:var(--color-primary)">₹${product.sale_price}</strong>`
      : `<strong>₹${product.price}</strong>`;

    return `
      <tr>
        <td data-label="Product Info" style="font-weight: 500;">
          <div style="display:flex; align-items:center; gap:10px;">
            ${product.photo_url ? `<img src="${product.photo_url}" style="width:40px; height:40px; object-fit:cover; border-radius:4px;"/>` : ''}
            <div>
              <div style="font-weight:600;">${escapeHTML(product.name)}</div>
              <div style="font-size:0.78rem; color:var(--color-primary); font-weight:600; margin-top:2px;">SKU: ${escapeHTML(product.sku || 'N/A')}</div>
              <div style="font-size:0.75rem; color:var(--color-text-muted); margin-top:2px;">${escapeHTML(product.description || '')}</div>
            </div>
          </div>
        </td>
        <td data-label="Original/Offer Price">${priceText}</td>
        <td data-label="Sizes available (Qty)">${sizesHTML}</td>
        <td data-label="Total Stock" style="font-weight:700;">${totalStock}</td>
        <td data-label="Actions">
          <button class="btn-table-whatsapp btn-delete-product" style="border-color:var(--color-error); color:var(--color-error);" data-id="${product.id}">
            <span>Delete</span>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // Event listeners for delete buttons
  document.querySelectorAll('.btn-delete-product').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const product = products.find(p => p.id === id);
      if (!product) return;

      if (confirm(`Are you sure you want to delete the product "${product.name}" and all its stock records?`)) {
        try {
          const { error } = await supabase.from('products').delete().eq('id', id);
          if (error) throw error;
          alert("Product deleted successfully.");
          await loadStockInventory();
        } catch (e) {
          alert(`Delete failed: ${e.message}`);
        }
      }
    });
  });
}

function populateProductSelectForInvoicing() {
  const select = document.getElementById('basket-product-select');
  if (!select) return;

  // Preserve first option
  select.innerHTML = `<option value="">-- Choose Product --</option>`;
  select.innerHTML += products.map(p => `
    <option value="${p.id}">${escapeHTML(p.name)}</option>
  `).join('');
}


// --- OWNER BASKET LOGIC (INVOICING) ---
function renderInvoiceBasket() {
  const container = document.getElementById('invoice-basket-container');
  if (!container) return;

  if (invoiceBasket.length === 0) {
    container.innerHTML = `<p class="basket-empty-msg">No items in invoice basket.</p>`;
    document.getElementById('invoice-basket-total').textContent = `₹0`;
    return;
  }

  container.innerHTML = invoiceBasket.map((item, index) => `
    <div class="basket-item-row">
      <div>
        <div class="basket-item-desc">${escapeHTML(item.name)} (${item.size})</div>
        <div class="basket-item-pricing">${item.qty} x ₹${item.price}</div>
      </div>
      <div style="display:flex; align-items:center; gap:12px;">
        <span style="font-weight:700;">₹${item.price * item.qty}</span>
        <button type="button" class="btn-remove-basket" data-index="${index}">&times;</button>
      </div>
    </div>
  `).join('');

  // Update total
  const total = invoiceBasket.reduce((acc, curr) => acc + (curr.price * curr.qty), 0);
  document.getElementById('invoice-basket-total').textContent = `₹${total}`;

  // Attach delete buttons
  document.querySelectorAll('.btn-remove-basket').forEach(btn => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.getAttribute('data-index'), 10);
      invoiceBasket.splice(index, 1);
      renderInvoiceBasket();
    });
  });
}

function renderInvoiceReceipt(sale) {
  document.getElementById('receipt-id').textContent = `#INV-${sale.id.substring(0, 8).toUpperCase()}`;
  document.getElementById('receipt-date').textContent = new Date(sale.created_at).toLocaleDateString('en-IN');
  document.getElementById('receipt-cust-name').textContent = sale.customer_name;
  document.getElementById('receipt-cust-phone').textContent = sale.customer_phone;

  const tbody = document.getElementById('receipt-items-tbody');
  if (tbody) {
    tbody.innerHTML = sale.items.map(item => `
      <tr>
        <td>${escapeHTML(item.name)}</td>
        <td class="text-center">${item.size}</td>
        <td class="text-center">${item.qty}</td>
        <td class="text-right">₹${item.price}</td>
        <td class="text-right">₹${item.price * item.qty}</td>
      </tr>
    `).join('');
  }

  document.getElementById('receipt-grand-total').textContent = `₹${sale.total_amount}`;
  document.getElementById('modal-invoice').classList.remove('hidden');
}


// --- SALES & ORDERS LOG HISTORY ---
async function loadHistoryRecords() {
  if (!supabase) return;

  const tbody = document.getElementById('history-tbody');
  if (!tbody) return;

  try {
    if (activeHistoryTab === 'sales') {
      // Fetch Stall Sales
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center">No sales invoices recorded yet.</td></tr>`;
        return;
      }

      tbody.innerHTML = data.map(sale => {
        const dateStr = formatDate(sale.created_at);
        const itemsStr = sale.items.map(i => `${escapeHTML(i.name)} (${i.size}) x ${i.qty}`).join(', ');

        return `
          <tr>
            <td data-label="Customer Info">
              <strong>${escapeHTML(sale.customer_name)}</strong><br/>
              <span style="font-size:0.82rem; color:var(--color-text-muted);">${escapeHTML(sale.customer_phone)}</span>
            </td>
            <td data-label="Items Sold" style="white-space:normal; font-size:0.85rem;">${itemsStr}</td>
            <td data-label="Total Paid" style="font-weight:700; color:var(--color-primary);">₹${sale.total_amount}</td>
            <td data-label="Date" style="font-size:0.82rem; color:var(--color-text-muted);">${dateStr}</td>
          </tr>
        `;
      }).join('');

    } else {
      // Fetch Online Orders
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center">No online orders placed yet.</td></tr>`;
        return;
      }

      tbody.innerHTML = data.map(order => {
        const dateStr = formatDate(order.created_at);
        const itemsStr = order.items.map(i => `${escapeHTML(i.name)} (${i.size}) x ${i.qty}`).join(', ');

        return `
          <tr>
            <td data-label="Customer Info">
              <strong>${escapeHTML(order.customer_name)}</strong><br/>
              <span style="font-size:0.82rem; color:var(--color-text-muted);">${escapeHTML(order.customer_phone)}</span><br/>
              <span style="font-size:0.75rem; color:var(--color-accent-dark); white-space:normal;">${escapeHTML(order.customer_address)}</span>
            </td>
            <td data-label="Items Ordered" style="white-space:normal; font-size:0.85rem;">${itemsStr}</td>
            <td data-label="Total Amount" style="font-weight:700; color:var(--color-primary);">₹${order.total_amount}</td>
            <td data-label="Date & Status" style="font-size:0.82rem; color:var(--color-text-muted);">
              ${dateStr}<br/>
              <span class="badge badge-redirected" style="margin-top:4px;">
                <span class="badge-dot"></span>
                ${escapeHTML(order.status)}
              </span>
            </td>
          </tr>
        `;
      }).join('');
    }
  } catch (err) {
    console.error("Error loading history logs:", err);
    tbody.innerHTML = `<tr><td colspan="4" class="text-center" style="color:var(--color-error)">Failed to load records.</td></tr>`;
  }
}

// --- EXPORT UTILS ---
function exportToCSV() {
  if (visitors.length === 0) {
    alert("No visitor data available to export.");
    return;
  }

  const headers = ['Name', 'Place', 'WhatsApp Number', 'Registered At', 'Invite Status'];
  const rows = visitors.map(v => [
    v.name,
    v.place,
    v.whatsapp_number,
    new Date(v.created_at).toLocaleString('en-IN'),
    v.sms_status
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.setAttribute("href", url);
  
  const today = new Date().toISOString().split('T')[0];
  link.setAttribute("download", `shree_shyam_sarees_visitors_${today}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// --- UTILITY FORMATTERS ---
function formatDate(isoString) {
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (e) {
    return isoString;
  }
}

function escapeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
