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

const app = document.querySelector<HTMLDivElement>('#app')!;
let assets: Asset[] = [];
let loginError = '';

function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

function setToken(token: string | null) {
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
}

async function verifyToken(token: string): Promise<boolean> {
  const res = await fetch(`${API_URL}/api/verify`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.ok;
}

async function loadAssets() {
  const res = await fetch(`${API_URL}/api/assets`);
  assets = await res.json();
  render();
}

async function addAsset(asset: Omit<Asset, 'id' | 'createdAt'>) {
  const token = getToken();
  const res = await fetch(`${API_URL}/api/assets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(asset),
  });
  if (res.status === 401) {
    setToken(null);
    loginError = 'Session expired. Please log in again.';
    render();
    return;
  }
  render();
}

function render() {
  const token = getToken();
  app.innerHTML = `
    <header class="topbar">
      <h1>NDOI IT Assets</h1>
      ${token ? '<button id="logout-btn" class="btn-secondary">Log out</button>' : '<button id="login-open-btn" class="btn-secondary">Log in</button>'}
    </header>

    ${!token ? `
      <section id="login-panel" class="panel">
        <h2>Log in to make changes</h2>
        <form id="login-form">
          <input id="login-token" type="password" placeholder="Admin token" autocomplete="current-password" required />
          <button type="submit">Log in</button>
        </form>
        ${loginError ? `<p class="error">${loginError}</p>` : ''}
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
      <table>
        <thead>
          <tr><th>Computer</th><th>User</th><th>Model</th><th>Serial</th><th>Added</th></tr>
        </thead>
        <tbody>
          ${assets.map(a => `
            <tr>
              <td>${a.computerName}</td>
              <td>${a.pcUser}</td>
              <td>${a.modelNumber}</td>
              <td>${a.serial}</td>
              <td>${new Date(a.createdAt).toLocaleString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </section>
  `;

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
    const ok = await verifyToken(input.value);
    if (ok) {
      setToken(input.value);
      loginError = '';
      render();
    } else {
      loginError = 'Invalid token.';
      render();
    }
  });

  document.getElementById('asset-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const data = new FormData(form);
    await addAsset({
      computerName: String(data.get('computerName')),
      pcUser: String(data.get('pcUser')),
      modelNumber: String(data.get('modelNumber')),
      serial: String(data.get('serial')),
    });
    form.reset();
  });
}

const socket = io(API_URL);
socket.on('assetAdded', () => loadAssets());

render();
loadAssets();
