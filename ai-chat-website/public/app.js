const messagesEl = document.querySelector("#messages");
const form = document.querySelector("#chatForm");
const input = document.querySelector("#messageInput");
const sendButton = document.querySelector("#sendButton");
const newChatButton = document.querySelector("#newChat");
const resetDemoButton = document.querySelector("#resetDemo");
const cartBadge = document.querySelector("#cartBadge");
const cartList = document.querySelector("#cartList");
const cartTotal = document.querySelector("#cartTotal");
const ordersList = document.querySelector("#ordersList");
const productList = document.querySelector("#productList");

let history = [];

function money(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0);
}

function addMessage(role, text, extraClass = "") {
  const row = document.createElement("div");
  row.className = `message ${role} ${extraClass}`.trim();
  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = role === "user" ? "YOU" : "AI";
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;
  row.append(avatar, bubble);
  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return row;
}

function addToolEvents(events = []) {
  if (!events.length) return;
  const wrap = document.createElement("div");
  wrap.className = "toolEvents";
  for (const event of events) {
    const pill = document.createElement("span");
    pill.className = "toolPill";
    pill.textContent = `tool: ${event.name}${event.result?.ok === false ? " ⚠" : " ✓"}`;
    wrap.appendChild(pill);
  }
  messagesEl.appendChild(wrap);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function renderState(state) {
  if (!state) return;
  cartBadge.textContent = state.cartCount || 0;
  cartTotal.textContent = money(state.cartTotal);

  cartList.innerHTML = "";
  if (!state.cart?.length) cartList.innerHTML = '<div class="empty">Your cart is empty.</div>';
  for (const item of state.cart || []) {
    const el = document.createElement("div");
    el.className = "lineItem";
    el.innerHTML = `<div class="lineTop"><strong>${escapeHtml(item.name)}</strong><span>${money(item.lineTotal)}</span></div><div class="lineSub">${item.quantity} × ${money(item.price)}</div>`;
    cartList.appendChild(el);
  }

  ordersList.innerHTML = "";
  if (!state.orders?.length) ordersList.innerHTML = '<div class="empty">No demo orders yet.</div>';
  for (const order of (state.orders || []).slice(0, 4)) {
    const el = document.createElement("div");
    el.className = "orderItem";
    el.innerHTML = `<div class="lineTop"><strong>${escapeHtml(order.id)}</strong><span>${money(order.total)}</span></div><div class="lineSub">${escapeHtml(order.status)} · ${order.items.length} item type(s)</div>`;
    ordersList.appendChild(el);
  }

  productList.innerHTML = "";
  for (const p of state.products || []) {
    const el = document.createElement("div");
    el.className = "product";
    el.innerHTML = `<div class="productName"><span>${escapeHtml(p.name)}</span><span class="price">${money(p.price)}</span></div><p>${escapeHtml(p.description)} · ID ${escapeHtml(p.id)}</p>`;
    productList.appendChild(el);
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadState() {
  const response = await fetch("/api/state");
  if (response.ok) renderState(await response.json());
}

function resetConversation() {
  history = [];
  messagesEl.innerHTML = "";
  addMessage("assistant", "Hi! I can interact with this website for you. Try: “Find a keyboard and add it to my cart.”");
  input.focus();
}

function resizeInput() {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 170) + "px";
}

async function submitMessage(text) {
  text = text.trim();
  if (!text || sendButton.disabled) return;
  history.push({ role: "user", content: text });
  addMessage("user", text);
  input.value = "";
  resizeInput();
  sendButton.disabled = true;
  const typing = addMessage("assistant", "Thinking and checking website tools…", "typing");

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Request failed");
    typing.remove();
    addToolEvents(data.toolEvents);
    history.push({ role: "assistant", content: data.reply });
    addMessage("assistant", data.reply);
    renderState(data.state);
  } catch (error) {
    typing.remove();
    addMessage("assistant", `Error: ${error.message}`);
  } finally {
    sendButton.disabled = false;
    input.focus();
  }
}

input.addEventListener("input", resizeInput);
input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  submitMessage(input.value);
});

newChatButton.addEventListener("click", resetConversation);

document.querySelectorAll(".promptChip").forEach((button) => {
  button.addEventListener("click", () => submitMessage(button.dataset.prompt || ""));
});

resetDemoButton.addEventListener("click", async () => {
  const response = await fetch("/api/reset", { method: "POST" });
  if (response.ok) {
    renderState(await response.json());
    resetConversation();
    addMessage("assistant", "Demo cart and orders were reset.");
  }
});

resetConversation();
loadState();
