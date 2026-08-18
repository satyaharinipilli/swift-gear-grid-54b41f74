# Smart Warehouse Operations & Order Fulfillment System

Build NEXUS WAREHOUSE, a polished, production-style Smart Warehouse Operations & Order Fulfillment Platform for a hackathon.



This is Part 1 of a 3-part build. Build the complete operational foundation now and structure it so Parts 2 and 3 can add intelligent decision-making and advanced analytics without rebuilding the application.



Use realistic mock warehouse data. No external APIs are required.



PRODUCT GOAL



The system must support the complete core fulfillment lifecycle:



Order Created → Priority Determined → Inventory Checked → Stock Allocated → Picking → Packing → Quality Check → Dispatch → Inventory Updated



It must cover the hackathon requirements:



- Inventory and stock monitoring

- Order management and prioritization

- Inventory allocation

- Picking and packing

- Low-stock and out-of-stock detection

- Damaged/missing item handling

- Fulfillment and dispatch tracking

- Exception management

- Operational analytics foundation



This version should focus on operating the warehouse. Do not add advanced AI/decision intelligence yet.



---



UI / BRANDING



Create a premium dark warehouse command-center interface.



Use:



- Dark charcoal/navy background

- White/light typography

- Cyan/blue primary accent

- Green = healthy/success

- Amber = warning

- Red = critical

- Clean cards, tables, badges and charts

- Subtle animations only

- Strong spacing and hierarchy

- Desktop-first, responsive design



The result must look like a serious SaaS product, not a basic CRUD college project.



---



NAVIGATION



Use a clean sidebar:



OVERVIEW



- Dashboard



OPERATIONS



- Orders

- Inventory

- Picking & Packing

- Quality & Dispatch



CONTROL



- Exceptions

- Activity Log



INTELLIGENCE



- Analytics



Add a simple Demo Role Switcher for:



- Warehouse Manager

- Warehouse Worker



No complex authentication is required.



---



CORE DATA MODEL



Use a persistent/shared data layer rather than isolated frontend-only state.



Create these entities with sensible relationships:



Products



- id, SKU, name, category, price, reorder threshold



Inventory



- product, zone, bin/location, total quantity, reserved quantity, damaged quantity, available quantity, stock status



Customers



- id, name, email, phone, customer type



Orders



- order number, customer, order date, promised dispatch date, priority, status, total value



Order Items



- order, product, requested quantity, allocated quantity, picked quantity, packed quantity



Workers



- name, role, warehouse zone, availability



Picking Tasks



- order, worker, status, timestamps, notes



Picking Task Items



- product, location, required quantity, picked quantity, status, notes



Packing Tasks



- order, worker, packing station, package count, status, timestamps



Quality Checks



- order, inspector, result, notes, timestamp



Dispatch Records



- order, dispatch method, package count, tracking reference, timestamp, status



Exceptions



- order/product, type, severity, description, status, resolution notes, timestamps



Activity Log



- timestamp, actor, action, entity, description



Use sensible relationships between all entities.



---



DASHBOARD



Build the main dashboard as a warehouse command center.



Show live KPI cards:



- Total Orders

- Pending Orders

- Orders Picking

- Orders Packing

- Ready for Dispatch

- Low Stock

- Out of Stock

- Open Exceptions



Include:



Fulfillment Pipeline



Created → Allocated → Picking → Packing → Quality Check → Ready for Dispatch → Dispatched



Priority Actions



Examples:



- Urgent order waiting for allocation

- Low-stock item

- Out-of-stock item

- Failed QC

- Missing/damaged item

- Delayed order



These are rule-based operational alerts for now, not AI.



Recent Activity



Use real Activity Log data.



Warehouse Snapshot



Show useful current operational information.



---



INVENTORY



Create a complete inventory page with:



- Product

- SKU

- Category

- Location

- Total

- Reserved

- Available

- Damaged

- Reorder Threshold

- Stock Status



Add search, filtering, sorting and detail views.



Stock rules:



- Available <= 0 → Out of Stock

- Available <= reorder threshold → Low Stock

- Otherwise → Healthy



Damaged quantity must never be treated as available stock.



---



ORDERS



Create a professional order-management page.



Show:



- Order number

- Customer

- Order date

- Promised dispatch date

- Priority

- Total value

- Status

- Fulfillment progress



Support search, filtering, sorting, order creation and order details.



Order statuses:



Created → Allocated → Picking → Packing → Quality Check → Ready for Dispatch → Dispatched → Completed



Order details must show:



- Customer/order information

- Item table: Product | Requested | Allocated | Picked | Packed

- Visual fulfillment timeline

- Order-specific activity history



Priorities:



- Low

- Normal

- High

- Urgent



For Part 1, priority can be manually assigned.



---



BASIC INVENTORY ALLOCATION



Implement a working basic Allocate Stock action.



Rules:



- Only available stock can be allocated.

- Damaged stock cannot be allocated.

- Reserved stock cannot be allocated twice.

- Allocation cannot exceed requested quantity.

- Allocation cannot exceed available quantity.

- Partial allocation must be supported.



Example:



Requested = 10

Available = 7



Result:



Allocated = 7, Remaining = 3



Update the shared inventory/order data and Activity Log.



Do not implement intelligent order competition yet. That belongs to Part 2.



---



PICKING & PACKING



Picking



Show:



- Task

- Order

- Priority

- Worker

- Zone

- Status



Allow:



- Start task

- Mark item Picked

- Mark item Missing

- Mark item Damaged

- Record partial quantity

- Add notes

- Complete task



When picking completes successfully:



Order → Packing



When Missing/Damaged is recorded:



Create an Exception



Do not automatically solve it yet.



Packing



Show:



- Order

- Worker

- Packing station

- Package count

- Status



Allow:



- Start packing

- Update package count

- Mark packed

- Add notes



When packed:



Order → Quality Check



---



QUALITY CHECK



Create a Quality Check workflow.



Allow:



- Pass QC

- Fail QC

- Add notes



If passed:



Order → Ready for Dispatch



If failed:



- Create a Quality Check Failure exception

- Record the activity



---



DISPATCH



Create a Ready for Dispatch view showing:



- Order

- Customer

- Priority

- Package count

- Ready time

- Status



Provide Dispatch Order.



When dispatched:



- Create/update dispatch record

- Update order status

- Update inventory/fulfillment records consistently

- Record Activity Log entry



Prevent duplicate dispatch and invalid state transitions.



---



EXCEPTIONS



Create a dedicated Exceptions page.



Types:



- Damaged Item

- Missing Item

- Quantity Mismatch

- Stock Mismatch

- Quality Check Failure

- Delayed Fulfillment



Severity:



- Medium

- High

- Critical



Status:



Open → Investigating → Resolved



Support search/filtering and exception details.



Allow manual resolution notes.



Part 2 will later add intelligent recommendations and automatic decision support.



---



ACTIVITY LOG



Create a chronological audit trail.



Record events such as:



- Order created

- Stock allocated

- Picking started/completed

- Item damaged/missing

- Exception created/resolved

- Packing completed

- QC passed/failed

- Order dispatched



Show timestamp, actor, action and description.



---



ANALYTICS FOUNDATION



Create an Analytics page using real application data.



Include:



- Orders by status

- Orders by priority

- Inventory health

- Low/healthy/out-of-stock distribution

- Fulfillment pipeline

- Exceptions by type

- Exceptions by severity

- Dispatch activity



Keep this operational/basic for now. Advanced analytics and bottleneck detection come in Part 3.



---



MOCK DATA



Seed the app with realistic demo data immediately.



Create approximately:



- 30 products

- 20–25 orders

- 8–10 workers

- Multiple warehouse zones and bin locations

- Picking tasks

- Packing tasks

- QC records

- Dispatch records

- Exceptions

- Activity history



Intentionally include:



- Healthy stock

- Low stock

- Out-of-stock items

- Damaged inventory

- Urgent/high/normal orders

- Partial allocation

- Picking orders

- Packing orders

- QC failure

- Missing item

- Damaged item

- Delayed order

- Ready-to-dispatch orders

- Recently dispatched orders



Make the data realistic and varied enough that the dashboard looks active during a hackathon demo.



---



VALIDATION & WORKFLOW RULES



Enforce sensible state transitions.



Examples:



- Cannot allocate unavailable/damaged stock.

- Cannot allocate more than requested.

- Cannot pack before picking is completed.

- Cannot perform QC before packing.

- Cannot dispatch before QC passes.

- Cannot dispatch an already dispatched order.

- Cannot create invalid negative inventory.

- Important actions must update the shared state/database.

- Important actions must create Activity Log entries.



Do not silently fail. Show clear success/error notifications.



---



UX QUALITY



Add:



- Search

- Filters

- Sorting

- Status/priority badges

- Detail views

- Confirmation dialogs where appropriate

- Toast notifications

- Empty states

- Loading states

- Error states

- Clear validation messages



Avoid unnecessary pages or duplicate functionality.



---



FUTURE-COMPATIBILITY



Design the application so later prompts can add:



PART 2 — DECISION INTELLIGENCE



- Smart order prioritization

- Intelligent inventory allocation

- Partial fulfillment decisions

- Reorder recommendations

- Picking optimization

- Intelligent exception resolution

- Decision explanations

- Exception → Decision → Resolution



PART 3 — OPTIMIZATION & ANALYTICS



- Bottleneck detection

- Warehouse health score

- Advanced analytics

- Trend analysis

- Predictive insights

- Operational recommendations

- Advanced alerts



Do not implement these advanced features now; build the foundation they can use.



---



IMPORTANT



Do not create disconnected static screens.



The application must behave as one integrated system.



For example:



Allocation

→ updates order + inventory + dashboard + activity log



Picking completion

→ updates picking + order + packing availability + activity log



QC failure

→ updates order + exception + dashboard + activity log



Dispatch

→ updates dispatch + order + inventory/fulfillment + activity log



Use reusable components and maintainable business logic.



At the end, verify the complete basic workflow using the seeded demo data:



Order Created → Allocation → Picking → Packing → QC → Dispatch → Inventory/Activity updates



The final result of this prompt must be a functional, polished warehouse operations platform ready for Part 2, not merely a visual prototype.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://swift-gear-grid.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/96e35523-24e3-495a-b3a3-aa6a9db54eac).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
