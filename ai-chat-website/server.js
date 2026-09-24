import "dotenv/config";
import express from "express";
import OpenAI from "openai";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, "data", "store.json");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));

function readStore() {
  return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
}

function writeStore(store) {
  fs.writeFileSync(DB_PATH, JSON.stringify(store, null, 2));
}

function money(value) {
  return Math.round(Number(value) * 100) / 100;
}

function publicState() {
  const store = readStore();
  const cart = store.cart.map((item) => {
    const product = store.products.find((p) => p.id === item.productId);
    return {
      productId: item.productId,
      name: product?.name ?? "Unknown product",
      price: product?.price ?? 0,
      quantity: item.quantity,
      lineTotal: money((product?.price ?? 0) * item.quantity),
    };
  });
  return {
    products: store.products,
    cart,
    cartTotal: money(cart.reduce((sum, item) => sum + item.lineTotal, 0)),
    cartCount: cart.reduce((sum, item) => sum + item.quantity, 0),
    orders: store.orders.slice().reverse(),
  };
}

const tools = [
  {
    type: "function",
    name: "search_products",
    description: "Search the website product catalog by name or description. Use this before adding a product when the user did not provide an exact product ID.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search words such as keyboard, mouse, webcam, or laptop." },
      },
      required: ["query"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "get_cart",
    description: "Read the current shopping cart and total.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    strict: true,
  },
  {
    type: "function",
    name: "add_to_cart",
    description: "Add a catalog product to the shopping cart. If it is already present, increase its quantity.",
    parameters: {
      type: "object",
      properties: {
        product_id: { type: "string", description: "Exact product ID returned by search_products." },
        quantity: { type: "integer", minimum: 1, maximum: 10 },
      },
      required: ["product_id", "quantity"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "remove_from_cart",
    description: "Remove a product entirely from the cart.",
    parameters: {
      type: "object",
      properties: {
        product_id: { type: "string", description: "Product ID to remove." },
      },
      required: ["product_id"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: "function",
    name: "checkout",
    description: "Create a DEMO order from the current cart. This sample app does not charge real money.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    strict: true,
  },
  {
    type: "function",
    name: "get_orders",
    description: "List demo orders created in this website.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    strict: true,
  },
  {
    type: "function",
    name: "get_order_status",
    description: "Get status and details for a specific demo order.",
    parameters: {
      type: "object",
      properties: {
        order_id: { type: "string", description: "Order ID such as ORD-AB12CD." },
      },
      required: ["order_id"],
      additionalProperties: false,
    },
    strict: true,
  },
];

function executeTool(name, args) {
  const store = readStore();

  if (name === "search_products") {
    const q = args.query.trim().toLowerCase();
    const products = store.products.filter((p) =>
      `${p.name} ${p.description}`.toLowerCase().includes(q)
    );
    return { ok: true, products };
  }

  if (name === "get_cart") {
    const state = publicState();
    return { ok: true, cart: state.cart, total: state.cartTotal, count: state.cartCount };
  }

  if (name === "add_to_cart") {
    const product = store.products.find((p) => p.id === args.product_id);
    if (!product) return { ok: false, error: `Product ${args.product_id} does not exist.` };
    const quantity = Math.max(1, Math.min(Number(args.quantity) || 1, 10));
    const current = store.cart.find((i) => i.productId === product.id);
    const nextQuantity = Math.min((current?.quantity || 0) + quantity, product.stock, 10);
    if (current) current.quantity = nextQuantity;
    else store.cart.push({ productId: product.id, quantity: nextQuantity });
    writeStore(store);
    return { ok: true, message: `${product.name} added to cart.`, cart: publicState().cart };
  }

  if (name === "remove_from_cart") {
    const product = store.products.find((p) => p.id === args.product_id);
    const before = store.cart.length;
    store.cart = store.cart.filter((i) => i.productId !== args.product_id);
    writeStore(store);
    return {
      ok: store.cart.length < before,
      message: store.cart.length < before ? `${product?.name || args.product_id} removed from cart.` : "Product was not in the cart.",
      cart: publicState().cart,
    };
  }

  if (name === "checkout") {
    if (!store.cart.length) return { ok: false, error: "The cart is empty." };

    const items = store.cart.map((item) => {
      const product = store.products.find((p) => p.id === item.productId);
      return {
        productId: item.productId,
        name: product.name,
        quantity: item.quantity,
        unitPrice: product.price,
        lineTotal: money(product.price * item.quantity),
      };
    });

    const order = {
      id: `ORD-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
      status: "confirmed",
      createdAt: new Date().toISOString(),
      items,
      total: money(items.reduce((sum, item) => sum + item.lineTotal, 0)),
      demo: true,
    };

    store.orders.push(order);
    store.cart = [];
    writeStore(store);
    return { ok: true, order, note: "Demo checkout only. No payment was processed." };
  }

  if (name === "get_orders") {
    return { ok: true, orders: store.orders.slice().reverse() };
  }

  if (name === "get_order_status") {
    const order = store.orders.find((o) => o.id.toLowerCase() === args.order_id.toLowerCase());
    if (!order) return { ok: false, error: `Order ${args.order_id} was not found.` };
    return { ok: true, order };
  }

  return { ok: false, error: `Unknown tool: ${name}` };
}

async function runAgent(messages) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const input = messages
    .filter((m) => m && ["user", "assistant"].includes(m.role) && typeof m.content === "string")
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content }));

  let response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
    instructions: [
      "You are an AI shopping assistant embedded inside this demo website.",
      "You can answer normal questions and use website tools when the user asks you to inspect or change website state.",
      "When a user names a product without an exact product ID, search the catalog first, then act on the matching product.",
      "Never claim an item was added, removed, ordered, or found unless the corresponding tool result says it succeeded.",
      "Checkout is demo-only and does not process real payment. Mention that briefly after checkout.",
      "Keep responses concise and user-friendly.",
    ].join(" "),
    input,
    tools,
    parallel_tool_calls: true,
  });

  const toolEvents = [];
  let rounds = 0;

  while (rounds < 8) {
    const calls = response.output.filter((item) => item.type === "function_call");
    if (!calls.length) break;

    const toolOutputs = [];
    for (const call of calls) {
      let args = {};
      try {
        args = JSON.parse(call.arguments || "{}");
      } catch {
        args = {};
      }

      let result;
      try {
        result = executeTool(call.name, args);
      } catch (error) {
        result = { ok: false, error: error?.message || "Tool execution failed." };
      }

      toolEvents.push({ name: call.name, args, result });
      toolOutputs.push({
        type: "function_call_output",
        call_id: call.call_id,
        output: JSON.stringify(result),
      });
    }

    response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
      previous_response_id: response.id,
      input: toolOutputs,
      tools,
      parallel_tool_calls: true,
    });
    rounds += 1;
  }

  return {
    reply: response.output_text || "Done.",
    responseId: response.id,
    toolEvents,
    state: publicState(),
  };
}

app.get("/api/state", (_req, res) => {
  res.json(publicState());
});

app.post("/api/chat", async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY is not configured on the server." });
    }
    const messages = Array.isArray(req.body.messages) ? req.body.messages : [];
    if (!messages.length) return res.status(400).json({ error: "messages is required" });
    res.json(await runAgent(messages));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error?.message || "AI request failed" });
  }
});

app.post("/api/reset", (_req, res) => {
  const store = readStore();
  store.cart = [];
  store.orders = [];
  writeStore(store);
  res.json(publicState());
});

app.listen(port, () => {
  console.log(`AI tool-calling website running at http://localhost:${port}`);
});
