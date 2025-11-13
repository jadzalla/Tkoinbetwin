# Tkoin Exchange Platform Design Guidelines

## Design Approach

**Reference-Based Strategy**: Blend Coinbase's trust-building professionalism, Binance's data density, and Phantom Wallet's clean interface. Create a credible financial platform that balances institutional reliability with crypto-native accessibility.

**Core Principle**: Every pixel reinforces financial credibility - precision in data display, clarity in transactions, transparency in agent operations.

---

## Color System

**Primary Palette**:
- Deep Purple/Indigo: #4C1D95 to #5B21B6 (primary brand, CTAs, headers)
- Accent Purple: #7C3AED (hover states, highlights)
- Success Green: #10B981 (completed transactions, positive trends)
- Warning Amber: #F59E0B (pending states, alerts)
- Error Red: #EF4444 (failed transactions, rejections)
- Neutral Grays: #F9FAFB to #111827 (backgrounds, text, borders)

**Usage**:
- Purple gradients for hero sections and primary CTAs
- Status indicators use semantic colors (green/amber/red)
- Agent tier badges use bronze/silver/gold metallic tones
- Dark mode ready with purple accents maintaining prominence

---

## Typography

**Fonts** (Google Fonts CDN):
- **Inter**: Headlines, UI (400, 500, 600, 700)
- **JetBrains Mono**: Addresses, hashes, amounts (400, 500)

**Scale**:
- Hero: text-6xl lg:text-7xl, font-bold, tracking-tight
- Headers: text-4xl, font-semibold
- Cards: text-xl, font-semibold
- Body: text-base
- Data Labels: text-sm, uppercase, tracking-wide
- Amounts: text-lg to text-3xl, JetBrains Mono, font-medium

---

## Layout System

**Spacing**: Tailwind units **4, 6, 8, 12, 16, 20, 24**
- Cards: p-6 to p-8
- Sections: py-20 to py-24
- Grid gaps: gap-6 for features, gap-4 for data tables

**Containers**:
- Public pages: max-w-7xl
- Dashboards: max-w-6xl
- Forms: max-w-2xl

---

## Component Library

### Navigation
**Public Header**: Logo left, nav (Tokenomics, Agents, Docs, About), "Agent Login" + "Admin" buttons right. Sticky with backdrop-blur-lg.

**Dashboard Header**: Logo, breadcrumb navigation, notifications icon, profile dropdown. Purple gradient bottom border.

### Cards & Data Display
**Stat Cards**: Large numbers (text-3xl, JetBrains Mono), icon top-left, trend indicator, label below. Rounded-xl borders, subtle background.

**Agent Cards**: Profile image, name, tier badge, transaction volume, rating stars, "View Profile" link. Grid layout (3-4 columns desktop).

**Transaction Tables**: Striped rows, sortable headers, monospace for hashes/addresses, status badges, timestamp, Explorer link icon.

**Live Ticker**: Horizontal scrolling feed showing recent mints/burns with animation.

### Forms & Inputs
**Exchange Calculator**: Two-column input/output display with large amounts, real-time conversion, fee breakdown below.

**Agent Verification Form**: Multi-step progress indicator, document upload areas, status checkboxes.

### Status Elements
**Tier Badges**: Rounded-full pills with metallic gradients (bronze/silver/gold), small icons.

**Verification Badges**: Green checkmark for verified agents, yellow pending, gray for unverified.

**Transaction Status**: Pills with icons - Completed (green), Pending (amber), Failed (red).

### Buttons
**Primary**: Purple gradient background, rounded-lg, px-8 py-4, white text
**Secondary**: Purple outline, transparent background
**Hero Buttons**: Larger scale, backdrop-blur-md background when on images

---

## Page Layouts

### Homepage (tkoin.finance)

**Hero** (85vh): Full-width purple-to-indigo gradient background image with particle effects. Centered headline "Professional Tkoin Exchange - Trusted Agent Network", subheadline, two CTAs ("Find an Agent", "Become an Agent"), live stats bar below (Total Supply, 24h Volume, Active Agents).

**Tokenomics Dashboard**: 4-column live stats (Max Supply, Circulating, Burned, Total Agents), visual supply chart, burn rate graph.

**Featured Agents**: 3-column grid of top-performing agents with profile cards, "View All Agents" link.

**How It Works**: 3-step flow (Find Agent → Exchange Funds → Receive Tkoin) with icons and descriptions. 

**Trust Section**: 2-column grid - left side lists security features (blockchain verification, escrow protection), right side shows audit badge and regulatory compliance.

**Live Activity**: Recent transaction feed with real-time updates.

**Agent CTA Section**: Large centered card encouraging agent applications with benefits list and "Apply Now" button.

**Footer**: Navigation links, social, documentation, legal pages, newsletter signup.

### Agent Portal

**Dashboard Home**: Top row KPI cards (Total Volume, Commissions Earned, Active Orders, Current Tier). Exchange interface card with calculator. Recent orders table. Commission progress bar with next tier threshold.

**Order Management**: Full-width table with filters (status, date range, amount). Columns: Order ID, Customer, Amount, Fee, Commission, Status, Actions. Expandable rows for order details.

**Inventory Panel**: Current TKOIN balance, fiat reserves, pending transactions, liquidity status indicators.

**Analytics Page**: Monthly volume chart, commission breakdown, customer retention metrics, tier progression graph.

**Profile Settings**: Agent information form, bank account details, verification documents display, commission tier benefits table.

### Admin Panel

**Agent Approval Queue**: Table with pending applications, document preview modal, approve/reject actions, verification checklist.

**System Configuration**: Fee structure editor with sliders, burn rate adjustment, tier threshold configuration, emergency pause toggles.

**Platform Analytics**: Total platform volume, agent performance leaderboard, transaction heatmap, burn rate trends.

**Agent Directory Management**: Search/filter interface, bulk actions, tier reassignment, suspension controls.

---

## Images

**Hero Image**: Abstract cryptocurrency visualization with purple-to-indigo gradient, flowing particle effects suggesting blockchain transactions, professional and modern (1920x1080, full-bleed).

**Section Backgrounds**: Subtle geometric grid patterns in light purple for alternating sections.

**Agent Profiles**: Placeholder avatars for agents without photos (professional initials style).

**Trust Badges**: Security audit logos, regulatory compliance seals.

---

## Animations

**Minimal & Purposeful**:
- Live counter animations for stats using smooth number transitions
- Hover: scale-105 on cards, subtle glow on purple buttons
- Loading: Skeleton screens for async data, spinner for form submissions
- Transaction feed: Smooth fade-in for new entries

---

## Accessibility

- Purple color contrast tested against white/light backgrounds (WCAG AA)
- Focus rings on all interactive elements (ring-2 ring-purple-500)
- Keyboard navigation for all dashboard functions
- Screen reader labels for transaction statuses and amounts
- High contrast mode for data tables