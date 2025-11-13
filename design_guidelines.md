# Tkoin Ecosystem Design Guidelines

## Design Approach

**Reference-Based Strategy**: Draw inspiration from leading crypto platforms - Solana.com for brand clarity, Jupiter for clean functionality, and Phantom Wallet for trust-building design patterns. Create a professional fintech aesthetic that balances technical sophistication with accessibility.

**Core Principle**: Establish credibility through precision, clarity, and real-time transparency - every design element reinforces trust in the tokenomics system.

---

## Typography

**Font Families** (via Google Fonts):
- **Primary**: Inter (headings, UI elements) - weights 400, 500, 600, 700
- **Secondary**: JetBrains Mono (addresses, transaction hashes, numbers) - weight 400

**Hierarchy**:
- Hero Headlines: text-5xl to text-6xl, font-bold, tracking-tight
- Section Headers: text-3xl to text-4xl, font-semibold
- Card Titles: text-xl, font-semibold
- Body Text: text-base, font-normal
- Captions/Labels: text-sm, uppercase tracking-wide for UI labels
- Monospace Data: text-sm to text-base for addresses, amounts, hashes

---

## Layout System

**Spacing Primitives**: Use Tailwind units of **4, 6, 8, 12, 16, 20** for consistent rhythm
- Component padding: p-6, p-8
- Section spacing: py-16, py-20, py-24
- Card gaps: gap-6, gap-8
- Grid gutters: gap-4 for tight data, gap-8 for feature cards

**Container Strategy**:
- Full-width sections with inner max-w-7xl
- Dashboard content: max-w-6xl
- Form containers: max-w-2xl

---

## Component Library

### Navigation
- **Public Header**: Logo left, nav links center (About, Tokenomics, Docs), "Agent Portal" button right
- **Dashboard Header**: Logo, breadcrumbs, agent profile dropdown right
- Sticky positioning on scroll with subtle backdrop blur

### Cards & Containers
- **Stat Cards**: Rounded borders (rounded-xl), subtle background differentiation, large numbers with labels
- **Transaction Cards**: Compact rows with monospace hashes, status badges, timestamp
- **Feature Cards**: Icon + title + description layout in 3-column grid

### Data Display
- **Live Stats**: Large numeric displays with trend indicators (↑ green, ↓ red)
- **Tables**: Clean striped rows, sortable headers, monospace for addresses/amounts
- **Charts**: Simple line/area charts for supply/burn trends (use Chart.js or similar)

### Forms & Inputs
- **Input Fields**: Rounded borders, clear labels above, helper text below
- **Calculators**: Side-by-side input/output display with real-time updates
- **Sliders**: For fee percentage adjustments with numeric input sync

### Buttons
- **Primary CTAs**: Solid fill, rounded-lg, medium padding (px-6 py-3)
- **Secondary**: Outline style with border
- **Hero Buttons**: Larger (px-8 py-4) with blur backdrop when on images

### Badges & Status
- **Status Badges**: Small rounded-full pills (Pending, Completed, Failed)
- **Tier Indicators**: Bronze/Silver/Gold badges for commission tiers

---

## Page-Specific Layouts

### Homepage (tkoin.finance)

**Hero Section** (90vh):
- Large hero image: Abstract Solana-themed gradient/particle background
- Centered headline: "Tkoin: Solana Token-2022 Powering BetWin Gaming"
- Subheadline explaining the soft-peg credit system
- Two CTAs: "View Tokenomics" (primary) + "Agent Portal" (secondary)
- Live supply counter displayed prominently

**Tokenomics Section**:
- 3-column grid: Max Supply (100M), Circulating Supply (live), Total Burned (live)
- Visual breakdown: Pie chart or progress bars for distribution
- Key features: Transfer fees, burn mechanics, commission system

**How It Works**:
- 4-step flow diagram: Deposit → Burn → Credits → Withdraw
- Icons + brief descriptions for each step
- Agent role explanation with commission tiers visual

**Live Activity Feed**:
- Recent transactions ticker (mints, burns, large transfers)
- Links to Solana Explorer for transparency

**Integration Section**:
- 2-column: "For Players" (deposit flow) + "For Agents" (minting flow)
- Screenshot mockups or simplified diagrams

**Footer**:
- Links: Documentation, GitHub, Solana Explorer
- Social links, audit reports link
- Newsletter signup (optional)

### Agent Portal

**Login Page**:
- Centered card (max-w-md), Replit Auth integration
- Clean form with "Approved Agents Only" messaging

**Agent Dashboard**:
- Top stats row: Total Minted, Commissions Earned, Current Tier
- Minting Interface Card:
  - Amount input with TKOIN suffix
  - Fee calculator showing: Gross amount, Fee %, Net to user, Your commission
  - "Generate Tkoin" primary button
- Recent Activity table below

**Transaction History**:
- Full-width table with filters (date range, type, status)
- Columns: Date, Type, Amount, User, Fee, Commission, Status, Explorer Link
- Export to CSV button

**Commission Tracker**:
- Progress bar to next tier with thresholds labeled
- Earnings breakdown by month (simple bar chart)
- Tier benefits table

**Settings Panel**:
- Fee configuration form (admin only)
- Commission tier thresholds editor
- Burn rate adjustment slider

---

## Visual Elements

### Images
- **Hero**: Full-width abstract Solana-branded gradient background (purples, blues, teals)
- **Section backgrounds**: Subtle geometric patterns or particle effects
- **Icons**: Use Heroicons for UI, custom Solana logo SVG

### Animations
- **Minimal**: Counter animations for live stats
- **Hover states**: Subtle scale on cards (scale-105), underline on links
- **Loading states**: Skeleton screens for async data, spinner for transactions

---

## Accessibility & Polish
- High contrast ratios throughout (WCAG AA minimum)
- Focus states on all interactive elements (ring-2 ring-offset-2)
- Responsive breakpoints: Mobile-first, tablet (md:), desktop (lg:, xl:)
- Loading skeletons for blockchain data fetches
- Error states with clear messaging and retry options