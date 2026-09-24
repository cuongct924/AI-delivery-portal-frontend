# AI Store Agent — Embedded AI + Tool Calling

A small full-stack demo showing an AI embedded in a website that can **interact with website state through function/tool calling**.

## What the AI can do

- Search the product catalog
- Read the cart
- Add products to the cart
- Remove products from the cart
- Create a demo checkout/order
- List orders
- Look up an order status

The important architecture is:

`Chat UI -> Express backend -> OpenAI Responses API -> function call -> website/backend function -> function_call_output -> AI reply`

The model never writes directly to the browser or database. It asks the server to execute explicitly allowed tools.

## Run

Requires Node.js 18+.

```bash
cp .env.example .env
# edit .env and add OPENAI_API_KEY
npm install
npm run dev
```

Open <http://localhost:3000>.

## Environment

```env
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-5.6-luna
PORT=3000
```

## Tool-calling loop

1. Browser sends chat history to `POST /api/chat`.
2. Server calls the Responses API with tool schemas.
3. If the model emits `function_call`, the server validates/parses its arguments and runs only a known local function.
4. Server sends `function_call_output` back using `previous_response_id`.
5. The loop continues until the model returns normal text.
6. Server returns the assistant text, tool events, and current website state to the browser.

## Demo database

`data/store.json` acts as a tiny local JSON database so cart/order changes survive server restarts.

This is intentionally a demo. For production, replace it with PostgreSQL/MySQL/etc., add authentication and user-specific carts/orders, validate authorization inside every tool, add idempotency for writes, and require confirmation for consequential actions such as real purchases.
