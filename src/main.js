import './style.css';
import { createClient } from '@supabase/supabase-js';

// Application State
let supabase = null;
let visitors = [];
let lastRegisteredVisitor = null;

// Constant Constants
const WHATSAPP_GROUP_LINK = "https://chat.whatsapp.com/K2jtomZ8v0zBQDKQydA4im?s=cl&p=a&mlu=2";
const STORE_ADDRESS = "G2, Tapasya Apartment, Bhayandar West, Near Madhu Maternity Hospital, 401101";
const FIRM_NAME = "Shree Shyam Sarees";

// DOM Elements
const formVisitor = document.getElementById('form-visitor');
const btnSubmit = document.getElementById('btn-submit');
const submitSpinner = document.getElementById('submit-spinner');
const inputName = document.getElementById('visitor-name');
const inputPlace = document.getElementById('visitor-place');
const inputWhatsapp = document.getElementById('visitor-whatsapp');

const statTotal = document.getElementById('stat-total');
const statInvites = document.getElementById('stat-invites');
const searchInput = document.getElementById('search-input');
const btnExport = document.getElementById('btn-export');
const visitorsTbody = document.getElementById('visitors-tbody');

// Modals
const modalSettings = document.getElementById('modal-settings');
const btnSettings = document.getElementById('btn-settings');
const btnCloseSettings = document.getElementById('btn-close-settings');
const inputSettingsUrl = document.getElementById('settings-url');
const inputSettingsKey = document.getElementById('settings-key');
const settingsStatus = document.getElementById('settings-status');
const btnTestConnection = document.getElementById('btn-test-connection');
const btnSaveSettings = document.getElementById('btn-save-settings');

const modalWhatsapp = document.getElementById('modal-whatsapp');
const btnCloseWhatsapp = document.getElementById('btn-close-whatsapp');
const successVisitorName = document.getElementById('success-visitor-name');
const whatsappMessagePreview = document.getElementById('whatsapp-message-preview');
const btnWhatsappRedirect = document.getElementById('btn-whatsapp-redirect');

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  initSupabase();
  setupEventListeners();
});

// --- SETTINGS MANAGEMENT ---
function loadSettings() {
  const url = localStorage.getItem('supabase_url') || '';
  const key = localStorage.getItem('supabase_anon_key') || '';
  inputSettingsUrl.value = url;
  inputSettingsKey.value = key;
}

function saveSettings(url, key) {
  localStorage.setItem('supabase_url', url.trim());
  localStorage.setItem('supabase_anon_key', key.trim());
}

async function initSupabase() {
  const url = localStorage.getItem('supabase_url');
  const key = localStorage.getItem('supabase_anon_key');

  if (!url || !key) {
    updateConnectionStatus(false, "Disconnected (Please configure settings)");
    showModal(modalSettings);
    return false;
  }

  try {
    supabase = createClient(url.trim(), key.trim());
    updateConnectionStatus(true, "Connected");
    await fetchVisitors();
    return true;
  } catch (error) {
    console.error("Failed to initialize Supabase:", error);
    updateConnectionStatus(false, "Connection Failed");
    return false;
  }
}

function updateConnectionStatus(isConnected, text) {
  settingsStatus.className = `status-indicator ${isConnected ? 'connected' : 'disconnected'}`;
  settingsStatus.querySelector('.status-text').textContent = text;
}

// --- API DATABASE CALLS ---
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
    alert(`Could not fetch visitors: ${error.message}\nMake sure your 'visitors' table is created in Supabase.`);
  }
}

async function registerVisitorInDB(name, place, whatsapp) {
  if (!supabase) {
    alert("Database not configured. Please open settings and save your credentials.");
    showModal(modalSettings);
    return null;
  }

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
    
    if (data && data.length > 0) {
      return data[0];
    }
    return null;
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
    
    // Update local state
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

// --- WHATSAPP UTILITIES ---
function cleanPhoneNumber(number) {
  // Strip all non-numeric characters
  let clean = number.replace(/\D/g, '');
  
  // If it's a 10 digit Indian number, prefix it with 91
  if (clean.length === 10) {
    clean = '91' + clean;
  }
  
  // Remove leading zeros if present
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
  const encodedText = encodeURIComponent(message);
  
  const waUrl = `https://wa.me/${cleanPhone}?text=${encodedText}`;
  window.open(waUrl, '_blank');
  
  // Update status to 'redirected'
  updateVisitorStatusInDB(id, 'redirected');
}

// --- UI RENDERING ---
function renderVisitors() {
  const query = searchInput.value.toLowerCase().trim();
  
  // Filter visitors based on search query
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
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="empty-icon">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
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
          <button class="btn-table-whatsapp" data-id="${visitor.id}" data-phone="${visitor.whatsapp_number}" data-name="${visitor.name}">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
            </svg>
            <span>${isRedirected ? 'Resend' : 'Send'}</span>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // Attach event listeners to newly generated table buttons
  document.querySelectorAll('.btn-table-whatsapp').forEach(btn => {
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
  statTotal.textContent = visitors.length;
  const redirectedCount = visitors.filter(v => v.sms_status === 'redirected').length;
  statInvites.textContent = redirectedCount;
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
  
  // Visitor Form Submit
  formVisitor.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!supabase) {
      alert("Please configure your Supabase connection first.");
      showModal(modalSettings);
      return;
    }

    const name = inputName.value;
    const place = inputPlace.value;
    const rawWhatsapp = inputWhatsapp.value;
    const cleanPhone = cleanPhoneNumber(rawWhatsapp);

    // Validate phone number length (should generally be 10+ digits with country code)
    if (cleanPhone.length < 10) {
      alert("Please enter a valid phone number (at least 10 digits).");
      return;
    }

    // Show loading state
    setLoading(true);

    const savedVisitor = await registerVisitorInDB(name, place, cleanPhone);

    setLoading(false);

    if (savedVisitor) {
      // Clear form inputs
      inputName.value = '';
      inputPlace.value = '';
      inputWhatsapp.value = '';

      // Set last registered info and refresh data
      lastRegisteredVisitor = savedVisitor;
      await fetchVisitors();

      // Setup success modal and preview message
      successVisitorName.textContent = savedVisitor.name;
      whatsappMessagePreview.textContent = generateWhatsAppMessage(savedVisitor.name);
      
      // Open WhatsApp Success Modal
      showModal(modalWhatsapp);
    }
  });

  // Export to CSV
  btnExport.addEventListener('click', () => {
    exportToCSV();
  });

  // Real-time local Search
  searchInput.addEventListener('input', () => {
    renderVisitors();
  });

  // Settings Modal controls
  btnSettings.addEventListener('click', () => {
    loadSettings();
    showModal(modalSettings);
  });

  btnCloseSettings.addEventListener('click', () => {
    hideModal(modalSettings);
  });

  btnSaveSettings.addEventListener('click', async () => {
    const url = inputSettingsUrl.value.trim();
    const key = inputSettingsKey.value.trim();

    if (!url || !key) {
      alert("Both Supabase URL and Anon Key are required.");
      return;
    }

    saveSettings(url, key);
    const success = await initSupabase();
    if (success) {
      hideModal(modalSettings);
    } else {
      alert("Failed to connect. Please check credentials and try again.");
    }
  });

  btnTestConnection.addEventListener('click', async () => {
    const url = inputSettingsUrl.value.trim();
    const key = inputSettingsKey.value.trim();

    if (!url || !key) {
      alert("Please fill in both URL and Key first.");
      return;
    }

    btnTestConnection.disabled = true;
    btnTestConnection.textContent = "Testing...";

    try {
      const tempClient = createClient(url, key);
      // Try listing a single row to test table access
      const { data, error } = await tempClient.from('visitors').select('id').limit(1);
      
      if (error) throw error;
      
      alert("Connection Successful! Database is ready to use.");
      updateConnectionStatus(true, "Connected");
    } catch (err) {
      console.error(err);
      alert(`Connection Failed: ${err.message}\n\nPlease check: \n1. Your credentials are correct.\n2. The 'visitors' table exists.\n3. RLS policy allows read operations.`);
      updateConnectionStatus(false, "Connection Failed");
    } finally {
      btnTestConnection.disabled = false;
      btnTestConnection.textContent = "Test Connection";
    }
  });

  // Success WhatsApp Modal Controls
  btnCloseWhatsapp.addEventListener('click', () => {
    hideModal(modalWhatsapp);
  });

  btnWhatsappRedirect.addEventListener('click', () => {
    if (lastRegisteredVisitor) {
      openWhatsAppRedirect(
        lastRegisteredVisitor.whatsapp_number, 
        lastRegisteredVisitor.name, 
        lastRegisteredVisitor.id
      );
      hideModal(modalWhatsapp);
    }
  });

  // Close modals on overlay click
  window.addEventListener('click', (e) => {
    if (e.target === modalSettings) hideModal(modalSettings);
    if (e.target === modalWhatsapp) hideModal(modalWhatsapp);
  });
}

// --- UI HELPERS ---
function showModal(modal) {
  modal.classList.remove('hidden');
}

function hideModal(modal) {
  modal.classList.add('hidden');
}

function setLoading(isLoading) {
  btnSubmit.disabled = isLoading;
  if (isLoading) {
    submitSpinner.classList.remove('hidden');
    btnSubmit.querySelector('.btn-text').textContent = "Registering...";
    btnSubmit.querySelector('.btn-arrow').classList.add('hidden');
  } else {
    submitSpinner.classList.add('hidden');
    btnSubmit.querySelector('.btn-text').textContent = "Register & Send Invite";
    btnSubmit.querySelector('.btn-arrow').classList.remove('hidden');
  }
}

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

// --- CSV EXPORT UTILITY ---
function exportToCSV() {
  if (visitors.length === 0) {
    alert("No data available to export.");
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

  // Convert array to CSV format
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => {
      // Escape commas and quotes inside cells
      const val = String(cell).replace(/"/g, '""');
      return `"${val}"`;
    }).join(','))
  ].join('\n');

  // Create downloadable Blob
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  // Create virtual link to trigger download
  const link = document.createElement("a");
  link.setAttribute("href", url);
  
  const today = new Date().toISOString().split('T')[0];
  link.setAttribute("download", `shree_shyam_sarees_visitors_${today}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
