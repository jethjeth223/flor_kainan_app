# Flor’s Kainan App — proposed system design

Status: agreed design proposal, October 21, 2026. A functional pilot was implemented on October 22, 2026; see [the application README](flors-kainan/README.md) and [architecture notes](flors-kainan/ARCHITECTURE.md). The pilot is for private review. Customer access/account ownership, unattended backups and file retention, and testing on Flor’s physical phone remain rollout work. This proposal describes the broader intended system as well as the implemented core.

## 1. Decisions confirmed with you

| Area | Agreed direction |
| --- | --- |
| Fulfillment | Pickup only |
| Preparation | Flor plans a daily quantity shared between walk-ins and preorders |
| Portions | Fixed servings with fixed prices |
| Preorders | Flor taps Accept before an order is confirmed |
| Payment | Cash or GCash; customers may pay at pickup or send GCash before pickup |
| Utang | Flor records it manually; customers cannot select credit at checkout |
| Puhunan | Track business spending and money Flor adds to the business separately |
| Owner device | Infinix Note 30 5G, Android; internet is generally available at the stall |
| Language | Filipino mixed with familiar English terms |
| Communication | Direct customer-to-Flor chat with image uploads, including payment screenshots |

Everything below is a recommendation unless identified above as confirmed. Operating hours, cutoff times, and cancellation terms still need to be set before launch.

## 2. Product structure and roles

Use one mobile-friendly application with a customer view and an owner view. The owner view should open directly to today's work on Flor's phone.

Customers can browse published menus, request food for a pickup date, see whether Flor accepted, see their order and payment status, send payment evidence, and chat with Flor. Require sign-in before an order or private conversation; allow browsing without sign-in. The exact sign-in method can be selected during implementation.

Flor can publish menus, manage portions, accept orders, record walk-in sales, confirm money received, record expenses and capital additions, manage utang, and reply to messages. Owner access must be enforced on the server.

Do not require a walk-in customer to register. Flor can record an anonymous paid sale, or select/create a named customer when recording utang. A customer record created by Flor must not become accessible to someone merely because they enter the same name or phone number.

## 3. Flor's four main screens

| Screen | Main actions |
| --- | --- |
| Tinda | Choose today or tomorrow, copy a previous menu, toggle dishes, enter portions, publish, mark sold out |
| Orders | Accept requests, see pickup details, view preparation totals, mark ready or picked up, record a walk-in sale |
| Pera | Record payment, view utang, add gastos, add puhunan, review daily totals and close the day |
| Chat | Customer conversations, unread messages, images, links to related orders |

Use large labeled buttons, readable prices, food photos, a number keypad, and clear success messages. Show words alongside colors. Keep Bagong benta easy to reach during selling hours. Put advanced settings outside the daily workflow.

Example labels: Tinda bukas, Kopyahin ang menu, Tanggapin, Handa na, Na-pick up, May bayad na, Magdagdag ng gastos, and Bayad sa utang.

## 4. Food catalog and dated menus

Maintain a reusable food catalog containing the dish name, optional photo, default serving description, and default price. Flor creates a dish once and reuses it.

Each selling date has its own menu. Its items store that day's price, serving description, planned portions, and visibility. Changing tomorrow's menu must not change today's menu or any past order.

Suggested evening workflow:

1. Tap Tinda bukas.
2. Start from the previous menu or choose dishes from the catalog.
3. Toggle dishes on or off and enter portions; retain the default price unless changed.
4. Tap I-publish ang menu.

The proposed item states are Draft, Available, Paused, and Sold out. A dish paused for new orders remains visible inside existing orders. Archiving a catalog dish removes it from future selection without deleting sales history.

Display an actual pickup date alongside Today or Tomorrow. Use Asia/Manila for menu dates and cutoff rules. Initially support the current selling day and the next published selling day; keep the ordering window configurable.

## 5. One stock count for walk-ins and preorders

Example: Flor plans 30 servings of adobo. She accepts preorders for 12. There are 18 servings left for new orders or walk-ins. The preparation list shows 30 total, including the 12 already reserved.

Use these quantities for each dated menu item:

- Planned or actual sellable portions.
- Reserved portions in accepted orders that have not been collected.
- Portions already handed over through pickup or walk-in sales.
- Portions removed as waste or otherwise unavailable.
- Portions still available for new orders.

Available portions equal the sellable total minus uncollected reservations, fulfilled portions, and removed portions. Pending requests are shown separately and do not reserve stock under this proposal.

Every accepted preorder and walk-in sale must update this same stock record. The server must check and reserve/decrement stock in one database transaction, including all dishes in an order. Two people requesting the last serving must not both receive a confirmation.

Flor can adjust actual portions after cooking. An adjustment that would leave too few portions for accepted orders must surface the affected orders for her to resolve. Do not silently cancel them.

For cancellations and no-shows, ask Flor whether the portions can be returned to availability or must be recorded as unavailable. Do not automatically assume prepared food can be resold.

## 6. Preorders and quick walk-in sales

Customer flow:

1. Select a published pickup date, dishes, and quantities.
2. Review portions, prices, pickup instructions, and payment arrangement.
3. Send the request. Show Waiting for Flor; explain that stock is reserved only after acceptance.
4. Flor accepts after the server checks availability, or declines with a short reason.
5. After acceptance, the customer can send advance GCash payment or pay at pickup.
6. Flor marks the order ready and then picked up.

Keep order progress separate from payment records. Suggested order states are Pending, Accepted, Ready, Picked up, Declined, Cancelled, and No-show. Suggested payment summaries are Unpaid, For verification, Partially paid, and Paid. Track refund obligations and completed refunds separately.

Accepting an order does not mark it paid. Receiving advance payment does not mark it picked up. A screenshot awaiting review does not reduce the balance due.

A quick walk-in sale should need only food and quantities, payment entry, and Save sale. Record the net money received after change. For a fully paid sale, customer details are optional. Flor must choose a named customer and explicitly record utang before releasing an unpaid balance.

Store the agreed food descriptions and prices on order lines. Later catalog changes must not rewrite existing orders. Prevent duplicate orders, sales, and payment entries caused by repeated taps or network retries.

## 7. Cash and GCash payments

Cash: Flor records the amount actually received and the order or debt it pays. Support multiple payments against a balance, including a combination of cash and GCash.

GCash: show Flor's configured payment details. Provide a Send payment proof action attached to an order, with image, amount, reference number, and payment time. Customers may also send images in chat; Flor can link a relevant image to the payment record instead of searching for it again.

Flor verifies receipt against her own GCash transaction records and taps Confirm received or Needs correction. A payment submission is evidence awaiting review. It becomes a collection only after verification. Flag reuse of the same received transaction/reference rather than crediting the money twice. One verified payment may be allocated across balances, but its total allocation cannot exceed the amount received.

Reference: [GCash guidance on confirming receipt and checking transaction records](https://help.gcash.com/hc/en-us/articles/30245019590553-Did-not-receive-money).

For a paid order that is cancelled, create a refund to-do. Record the actual refund separately after Flor sends it. Cancelling an order must not imply that money was automatically refunded. GCash verification and refunds are manual in the first version.

## 8. Utang as a customer ledger

Only Flor can create or adjust utang. There is no customer-facing Utang payment option.

Flor can:

- Record an unpaid balance when handing over food to a named customer.
- Enter an existing balance from the paper notebook, labeled Opening balance with its as-of date.
- Record partial repayments through cash or verified GCash.
- See the original charges, repayments, dates, notes, and remaining balance.
- Correct mistakes through recorded adjustments that preserve the earlier entry.

Example: a customer receives food worth ₱100 and pays ₱60. Record one ₱100 sale, one ₱60 collection, and ₱40 utang. When the customer later pays ₱40, record a repayment and reduce utang; do not create another sale.

Balances should be calculated from charges, payment allocations, and adjustments. An order's unpaid amount must not be added again as an unrelated debt entry. Opening balances must not inflate launch-day sales.

Keep the utang ledger private to Flor in the first version. Customer access to a personal statement can be added after reliable account-to-customer linking is in place.

## 9. Benta, gastos, and puhunan

Show these figures separately, with daily, weekly, and monthly views:

| Figure | Meaning |
| --- | --- |
| Benta | Value of food handed over during the period, adjusted for sale reversals |
| Nakolekta | Actual business payments received during the period, split into cash and verified GCash |
| Utang | Outstanding customer balances; distinguish new credit from older balances |
| Gastos | Recorded ingredient purchases and operating spending, with category and payment method |
| Dagdag puhunan | Money Flor contributes to the business; separate from sales |
| Withdrawals and transfers | Money taken out or moved between business cash and GCash; separate from sales and operating spending |

Advance payment for tomorrow increases collections today, with the corresponding sale recorded when food is handed over. Repayment of yesterday's utang increases collections today without becoming today's food sale.

Do not label the drawer balance or collections minus purchases as exact profit. Bulk ingredients can be used across several days. Show a Tantiya kita figure only when ingredient costs used for the period and relevant operating costs have been recorded; explain what costs the estimate includes. Detailed recipe costing and raw-ingredient inventory can come later.

Provide a short end-of-day review: unresolved orders, cash and GCash collections, expenses, new and remaining utang, leftovers/waste, and a cash count. Calculate expected drawer cash from the opening cash and recorded cash movements. Compare it with Flor's actual count. A manually recorded business GCash total is not a live balance from her wallet.

## 10. Chat and alerts

Provide a private customer-to-Flor conversation with text and image attachments. Orders should have a Chat about this order shortcut so Flor can see the relevant order without asking which transaction the customer means.

Use quick replies such as Handa na po, Na-check ko na ang bayad, and Wala na pong available. Show unread conversations and notifications for new requests, acceptance/decline, ready-for-pickup updates, and payment proof requiring review.

Chat messages must not automatically change order totals, stock, or payment status. Flor uses the corresponding order/payment action to make those changes.

Store uploaded images privately. Validate file types and sizes, compress images for mobile data, and allow access only to the customer involved and Flor. In-app notifications are part of the first version; phone push notifications can be added after checking behavior on the target device.

## 11. Proposed technical structure

Start with a mobile web application that can be added to Flor's Android home screen as a progressive web app. Customers can open the same service from a link. Test the ordering, image upload, keyboard, and home-screen experience on her actual phone.

Reference: [web.dev introduction to installable progressive web apps](https://web.dev/learn/pwa/welcome).

Use a straightforward server application, a relational database for orders and money records, and private file storage for images. Keep stock changes and financial allocations transactional. Framework and hosting choices should follow the expected customer volume, budget, and maintenance needs.

Main data groups:

- Accounts, roles, and customer records.
- Food catalog, dated menus, and dated menu items.
- Orders and immutable order-line price/serving snapshots.
- Stock reservations and movements, including sales, adjustments, and waste.
- Payment submissions, verified payments, allocations, and refunds.
- Opening utang balances, credit authorization on sales, and audited adjustments.
- Expenses, capital additions, withdrawals, and transfers.
- Conversations, messages, and private image attachments.
- Daily closeouts and an audit trail of important changes.

Use HTTPS, protected owner sessions, server-side access checks, and daily backups with a tested restore process. Allow export of sales, spending, payments, and utang records. Preserve financial corrections rather than silently deleting settled transactions.

First-version orders, stock updates, and payment confirmations require a server connection. Clearly show Saving, Saved, and Not sent. If connectivity fails, retain the unsent form as a draft and retry safely; never show a customer an accepted order until the server has saved it. Full offline selling and conflict resolution are separate work if field testing shows they are needed.

## 12. First-version scope and rollout

Include the dated menu, fixed serving quantities, Flor's acceptance queue, pickup tracking, walk-in sales, shared portion availability, manual cash/GCash records, private chat with images, owner-only utang, expenses, capital additions, daily summaries, exports, and backups.

Defer delivery, ingredient-level inventory automation, automatic GCash integration, recipe profitability, customer credit checkout, loyalty rewards, and multiple staff roles. They are not required for the agreed daily workflow.

Before launch, set pickup location and hours, next-day preorder cutoff and acceptance deadline, cancellation/no-show handling, opening balances, account recovery, and the hosting budget. Have Flor try the screens with a small set of real dishes and customers. Use paper records alongside the pilot long enough to reconcile orders, stock, payments, and debt before relying on the app alone.

Acceptance scenarios to verify during implementation:

1. Flor copies a menu, disables a dish, changes portions, and publishes the correct date.
2. A preorder for two servings and a one-serving walk-in sale reduce the same day's availability by three.
3. Only one competing sale can claim the final available serving.
4. Uploading payment proof leaves the money unverified until Flor confirms receipt.
5. A ₱100 sale with ₱60 paid and ₱40 utang stays one sale when the remaining ₱40 is collected later.
6. Tomorrow's advance payment and today's capital addition are shown separately from today's food sales.
7. An old utang opening balance does not become a new sale.
8. Customers cannot access another customer's orders, messages, or payment images.
9. A network retry does not duplicate a sale or verified payment.
10. Flor completes menu publishing, a walk-in sale, an utang repayment, and an expense entry on her own Android phone with minimal assistance.


## Supabase migration — October 22, 2026

The cloud backend is now PostgreSQL/Auth/Storage in Supabase project
soeptuxxgxvluorkhkgt. The Node/Next.js server runs locally against it. Railway
deployment is on hold; no public cloud server or Android APK has been published.
See flors-kainan/docs/CLOUD_MIGRATION.md for current implementation and rollout status.
