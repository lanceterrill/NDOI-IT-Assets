import './style.css';
import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL ?? 'https://localhost:3000';
const TOKEN_KEY = 'ndoi_admin_token';

interface Asset {
  id: number;
  computerName: string;
  pcUser: string;
  modelNumber: string;
  serial: string;
  createdAt: string;
}

type AssetFields = Omit<Asset, 'id' | 'createdAt'>;

const FIELDS: { key: keyof AssetFields; label: string }[] = [
  { key: 'computerName', label: 'Computer' },
  { key: 'pcUser', label: 'User' },
  { key: 'modelNumber', label: 'Model' },
  { key: 'serial', label: 'Serial' },
];

const app = document.querySelector<HTMLDivElement>('#app')!;
let assets: Asset[] = [];
let loginError = '';
let actionError = '';
let searchQuery = '';
let editingId: number | null = null;

function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

function setToken(token: string | null) {
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]!));
}

function fuzzyMatch(query: string, text: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

function visibleAssets(): Asset[] {
  return assets.filter((a) =>
    fuzzyMatch(searchQuery, `${a.computerName} ${a.pcUser} ${a.modelNumber} ${a.serial}`)
  );
}

async function verifyToken(token: string): Promise<'ok' | 'invalid' | 'unreachable'> {
  try {
    const res = await fetch(`${API_URL}/api/verify`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok ? 'ok' : 'invalid';
  } catch (e) {
    return 'unreachable';
  }
}

async function loadAssets() {
  try {
    const res = await fetch(`${API_URL}/api/assets`);
    assets = await res.json();
    actionError = '';
  } catch (e) {
    actionError = `Could not reach ${API_URL}. Is the backend running, and have you accepted its certificate warning in this browser?`;
  }
  render();
}

async function authedRequest(url: string, method: string, body?: AssetFields): Promise<boolean> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    actionError = `Could not reach ${API_URL}. Is the backend running, and have you accepted its certificate warning in this browser?`;
    render();
    return false;
  }
  if (res.status === 401) {
    setToken(null);
    loginError = 'Session expired. Please log in again.';
    render();
    return false;
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    actionError = body.error ?? `Request failed (${res.status}).`;
    render();
    return false;
  }
  actionError = '';
  return true;
}

async function addAsset(asset: AssetFields): Promise<boolean> {
  const ok = await authedRequest(`${API_URL}/api/assets`, 'POST', asset);
  render();
  return ok;
}

async function updateAsset(id: number, asset: AssetFields) {
  const ok = await authedRequest(`${API_URL}/api/assets/${id}`, 'PUT', asset);
  if (ok) editingId = null;
  render();
}

async function deleteAsset(id: number) {
  await authedRequest(`${API_URL}/api/assets/${id}`, 'DELETE');
  render();
}

function assetRow(a: Asset, token: string | null): string {
  if (editingId === a.id) {
    return `
      <tr data-id="${a.id}">
        ${FIELDS.map(f => `<td><input class="edit-field" data-field="${f.key}" value="${escapeHtml(a[f.key])}" /></td>`).join('')}
        <td>${new Date(a.createdAt).toLocaleString()}</td>
        <td class="row-actions">
          <button class="save-btn" data-id="${a.id}">Save</button>
          <button class="cancel-btn btn-secondary" type="button">Cancel</button>
        </td>
      </tr>
    `;
  }
  return `
    <tr data-id="${a.id}">
      <td>${escapeHtml(a.computerName)}</td>
      <td>${escapeHtml(a.pcUser)}</td>
      <td>${escapeHtml(a.modelNumber)}</td>
      <td>${escapeHtml(a.serial)}</td>
      <td>${new Date(a.createdAt).toLocaleString()}</td>
      <td class="row-actions">
        ${token ? `
          <button class="edit-btn" data-id="${a.id}" type="button">Edit</button>
          <button class="delete-btn btn-danger" data-id="${a.id}" type="button">Delete</button>
        ` : ''}
      </td>
    </tr>
  `;
}

function render() {
  const token = getToken();
  const rows = visibleAssets();
  app.innerHTML = `
    <header class="topbar">
      <h1>NDOI IT Assets</h1>
      ${token ? '<button id="logout-btn" class="btn-secondary">Log out</button>' : '<button id="login-open-btn" class="btn-secondary">Log in</button>'}
    </header>

    <section class="panel">
      <h2>Get device info</h2>
      <p>Run this in PowerShell on the device to get its name, serial, and current AD user:</p>
      <pre class="code-snippet"><code>Get-CimInstance Win32_ComputerSystemProduct | Select-Object Name,SerialNumber; Write-Host (Get-ADUser $env:USERNAME -Properties DisplayName).DisplayName</code></pre>
      <button id="copy-snippet-btn" type="button" class="btn-secondary">Copy</button>
    </section>

    ${!token ? `
      <section id="login-panel" class="panel">
        <h2>Log in to make changes</h2>
        <form id="login-form">
          <input id="login-token" type="password" placeholder="Admin token" autocomplete="current-password" required />
          <button type="submit">Log in</button>
        </form>
        ${loginError ? `<p class="error">${escapeHtml(loginError)}</p>` : ''}
      </section>
    ` : `
      <section class="panel">
        <h2>Add asset</h2>
        <form id="asset-form">
          <input name="computerName" placeholder="Computer name" required />
          <input name="pcUser" placeholder="User" required />
          <input name="modelNumber" placeholder="Model number" required />
          <input name="serial" placeholder="Serial" required />
          <button type="submit">Add</button>
        </form>
      </section>
    `}

    <section class="panel">
      <h2>Assets</h2>
      ${actionError ? `<p class="error">${escapeHtml(actionError)}</p>` : ''}
      <input id="search-input" type="search" placeholder="Search assets..." value="${escapeHtml(searchQuery)}" class="search-input" />
      <table>
        <thead>
          <tr><th>Computer</th><th>User</th><th>Model</th><th>Serial</th><th>Added</th><th></th></tr>
        </thead>
        <tbody>
          ${rows.map(a => assetRow(a, token)).join('')}
        </tbody>
      </table>
    </section>
  `;

  document.getElementById('copy-snippet-btn')?.addEventListener('click', (e) => {
    const code = document.querySelector('.code-snippet code')!.textContent!;
    navigator.clipboard.writeText(code);
    const btn = e.target as HTMLButtonElement;
    const original = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = original; }, 1500);
  });

  document.getElementById('login-open-btn')?.addEventListener('click', () => {
    loginError = '';
    render();
    document.getElementById('login-token')?.focus();
  });

  document.getElementById('logout-btn')?.addEventListener('click', () => {
    setToken(null);
    render();
  });

  document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('login-token') as HTMLInputElement;
    const result = await verifyToken(input.value);
    if (result === 'ok') {
      setToken(input.value);
      loginError = '';
      render();
    } else if (result === 'invalid') {
      loginError = 'Invalid token.';
      render();
    } else {
      loginError = `Could not reach ${API_URL}. Is the backend running, and have you accepted its certificate warning in this browser?`;
      render();
    }
  });

  document.getElementById('asset-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const data = new FormData(form);
    const ok = await addAsset({
      computerName: String(data.get('computerName')),
      pcUser: String(data.get('pcUser')),
      modelNumber: String(data.get('modelNumber')),
      serial: String(data.get('serial')),
    });
    if (ok) form.reset();
  });

  const searchInput = document.getElementById('search-input') as HTMLInputElement;
  searchInput?.addEventListener('input', () => {
    searchQuery = searchInput.value;
    render();
    document.getElementById('search-input')?.focus();
    const el = document.getElementById('search-input') as HTMLInputElement;
    el.selectionStart = el.selectionEnd = el.value.length;
  });

  document.querySelectorAll<HTMLButtonElement>('.edit-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      editingId = Number(btn.dataset.id);
      render();
    });
  });

  document.querySelectorAll<HTMLButtonElement>('.cancel-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      editingId = null;
      render();
    });
  });

  document.querySelectorAll<HTMLButtonElement>('.delete-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.dataset.id);
      const row = btn.closest('tr')!;
      const computerName = row.querySelector('td')?.textContent ?? '';
      if (confirm(`Delete asset "${computerName}"? This cannot be undone.`)) {
        await deleteAsset(id);
      }
    });
  });

  document.querySelectorAll<HTMLButtonElement>('.save-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.dataset.id);
      const row = btn.closest('tr')!;
      const fields: Partial<AssetFields> = {};
      row.querySelectorAll<HTMLInputElement>('.edit-field').forEach((input) => {
        fields[input.dataset.field as keyof AssetFields] = input.value;
      });
      await updateAsset(id, fields as AssetFields);
    });
  });
}

const socket = io(API_URL);
socket.on('assetAdded', () => loadAssets());
socket.on('assetUpdated', () => loadAssets());
socket.on('assetDeleted', () => loadAssets());

render();
loadAssets();
