# Tkoin Liquidity Network Design Guidelines

## Design Approach

**Reference-Based Strategy**: Blend Coinbase's trust-building professionalism, Binance's data density, Stripe Atlas's agent dashboard, and Phantom Wallet's clean interface. Create a credible financial platform that positions agents as **liquidity providers earning commissions**, not just exchange operators.

**Core Principle**: Every pixel reinforces the **agent marketplace narrative** - agents are micro-entrepreneurs earning from spreads, tier bonuses, and house edge sharing. The UI celebrates profitability, tier progression, and customer service excellence.

**Positioning Shift**: From "Buy & Redeem Tkoin" → "Tkoin Liquidity Network - Earn as an Agent, Play with Ease"

---

## Color System

**Primary Palette**:
- **Deep Purple/Indigo**: #4C1D95 to #5B21B6 (primary brand, CTAs, earnings highlights)
- **Accent Purple**: #7C3AED (hover states, tier progression indicators)
- **Success Green**: #10B981 (profit, completed transactions, commission earned)
- **Warning Amber**: #F59E0B (pending settlements, spread warnings, alerts)
- **Error Red**: #EF4444 (loss, failed transactions, limit exceeded)
- **Neutral Grays**: #F9FAFB to #111827 (backgrounds, text, borders)

**New Semantic Colors**:
- **Profit Green**: #059669 (positive margins, tier bonuses)
- **Loss Red**: #DC2626 (negative margins, inventory at risk)
- **Tier Bronze**: #CD7F32 (< 25K monthly volume)
- **Tier Silver**: #C0C0C0 (25K-100K monthly volume)
- **Tier Gold**: #FFD700 (> 100K monthly volume)

**Usage**:
- Purple gradients for hero sections and primary CTAs
- Green for all profit/earning indicators (commissions, margins, bonuses)
- Tier badges use metallic gradients with shimmer effects
- Status indicators use semantic colors (green/amber/red)
- Dark mode ready with purple accents and profit green maintaining prominence

---

## Typography

**Fonts** (Google Fonts CDN):
- **Inter**: Headlines, UI, body text (400, 500, 600, 700)
- **JetBrains Mono**: Addresses, hashes, amounts, profit/loss (400, 500, 700)

**Scale**:
- **Hero**: text-6xl lg:text-7xl, font-bold, tracking-tight
- **Headers**: text-4xl, font-semibold
- **Section Titles**: text-2xl lg:text-3xl, font-semibold
- **Cards**: text-xl, font-semibold
- **Body**: text-base
- **Data Labels**: text-sm, uppercase, tracking-wide, text-muted-foreground
- **Amounts**: text-lg to text-3xl, JetBrains Mono, font-medium
- **Profit/Loss**: text-xl lg:text-2xl, JetBrains Mono, font-bold (with + or - prefix)

**Copy Tone**:
- **For Users**: Reassuring, simple, trustworthy ("Find trusted agents near you")
- **For Agents**: Motivational, earnings-focused, entrepreneurial ("Earn up to 1% per transaction")
- **For Platform**: Professional, compliance-aware, transparent

---

## Layout System

**Spacing**: Tailwind units **4, 6, 8, 12, 16, 20, 24**
- Cards: p-6 to p-8
- Sections: py-16 to py-24
- Grid gaps: gap-6 for features, gap-4 for data tables
- Dashboard padding: p-6 lg:p-8

**Containers**:
- Public pages: max-w-7xl
- Agent Portal: Full width with sidebar (no max-width)
- Forms: max-w-2xl
- Modals: max-w-4xl for complex forms (pricing configurator)

---

## Component Library

### Navigation

**Public Header**: 
- Logo left, nav (Tokenomics, Agents, How It Works, Live Rates)
- Dual CTAs right: "Find an Agent" (outline), "Become an Agent" (primary gradient)
- Sticky with backdrop-blur-lg

**Agent Portal Sidebar** (New - Using Shadcn Sidebar):
- Use `SidebarProvider` with custom width via style variables:
  ```typescript
  const style = {
    "--sidebar-width": "20rem",  // 320px for agent portal
    "--sidebar-width-icon": "4rem",
  };
  <SidebarProvider style={style as React.CSSProperties}>
  ```
- Sidebar sections with lucide-react icons:
  - LayoutDashboard: Dashboard
  - DollarSign: Pricing & Limits
  - Receipt: Transactions
  - Trophy: Commissions & Earnings
  - TrendingUp: Analytics
  - Wallet: Inventory & Funding
  - Settings: Settings
- Use `SidebarMenuButton` with `data-[active=true]:bg-sidebar-accent`
- Tier badge in `SidebarFooter` showing current level (Bronze/Silver/Gold)

**Dashboard Header**: 
- Breadcrumb navigation left
- Quick stats (Today's Volume, Today's Profit)
- Notifications icon + profile dropdown right
- Purple gradient bottom border

### Cards & Data Display

**KPI Cards** (Agent Dashboard):
- Large metric (text-3xl, JetBrains Mono, font-bold)
- Icon top-left with purple gradient background
- Trend indicator (↑ ↓) with percentage change
- Label below (text-sm, text-muted-foreground)
- Use shadcn Card component with rounded-md borders and hover-elevate

**Pricing Preview Card** (Pricing Configurator):
- Two-column layout: "What Customers Pay" | "What You Pay"
- Large amounts with currency symbols
- Margin calculation in center with profit badge
- "Your Profit per 100 TKOIN" highlighted in green

**Commission Breakdown Card**:
- Stacked bar chart showing: Spread Earnings + Tier Bonus + House Share
- Total commission in large text
- Percentage breakdown below
- Link to full commission history

**Tier Progress Card**:
- Visual badge (Bronze/Silver/Gold) with shimmer animation
- Progress bar showing volume toward next tier
- Text: "X TKOIN away from Silver" with motivational copy
- Benefits list for next tier

**Agent Cards** (Agent Directory):
- Profile image with tier badge overlay
- Name, location, currencies supported (flags)
- Live bid/ask rates for selected currency
- Verification badge, rating stars
- "Contact Agent" button
- Hover: hover-elevate (subtle elevation without scaling)

**Transaction Tables**:
- Columns: Date, Type, Amount, Rate, Cost, Profit, Margin %
- Profit column in green/red with +/- prefix
- Margin % with colored badge (green >5%, yellow 2-5%, red <2%)
- Striped rows, sortable headers
- Monospace for amounts, hashes
- Expandable rows for transaction details
- Export to CSV button

**Live Metrics Ticker** (Homepage):
- Horizontal scrolling feed showing:
  - Total Agent Liquidity
  - Active Agents (breakdown by tier)
  - 24h Volume across all currencies
  - Average Commission Rate
- Animated number transitions

### Forms & Inputs

**Pricing Configurator Form**:
- Currency selector (dropdown with flags)
- Three slider inputs:
  - Bid Spread (0.5% - 5.0%) with "You buy at" live preview
  - Ask Spread (0.5% - 5.0%) with "You sell at" live preview
  - FX Buffer (0% - 2.0%)
- Tier limits shown as disabled max values
- Real-time profit calculator below
- "What if" simulator: Input transaction amount → See profit
- Save button (disabled if no changes)

**Exchange Calculator** (For Users):
- Two-column input/output with currency flags
- Large amounts (text-4xl, JetBrains Mono)
- Real-time conversion using agent's rates
- Fee breakdown: Base Rate + Spread + FX Buffer = Total
- "Find Agent" button below

**Agent Application Form**:
- Multi-step progress (Personal Info → Business Details → Documents → Review)
- Document upload with preview
- Commission tier benefits comparison table
- "Expected Monthly Earnings" calculator

### Status Elements

**Tier Badges**:
- Rounded-full pills with metallic gradients
- Icons from lucide-react: Medal (Bronze), Award (Silver), Trophy (Gold)
- Shimmer animation on hover (opacity/brightness change, not scale)
- Used in: Agent cards, dashboard header, sidebar footer

**Verification Badges**:
- Green checkmark + "Verified" for KYC-approved agents
- Yellow clock + "Pending Verification"
- Gray shield + "Basic" for unverified

**Transaction Type Labels**:
- "Inventory Buy" (purple) - Agent buying inventory with stablecoins
- "Sell to User" (green) - Agent selling Tkoin to user (profit)
- "Buy from User" (blue) - Agent buying Tkoin from user (redemption)
- "Settlement" (amber) - Monthly commission payout

**Profit Indicators**:
- Positive: Green background, "+" prefix, up arrow
- Negative: Red background, "-" prefix, down arrow
- Break-even: Gray background, "=" prefix

### Buttons

Use shadcn Button component with size variants:
- **Primary (default variant)**: Purple gradient background, white text, hover-elevate
- **Secondary (outline variant)**: Purple outline, transparent background, hover-elevate
- **Success**: Green gradient variant (for "Claim Commission", "Process Settlement")
- **Danger**: Red outline variant (for "Suspend Agent", "Cancel Order")
- **Sizes**: Use Button size prop - `default`, `sm`, `lg`, `icon`
- **Hero Buttons**: Use `size="lg"` with backdrop-blur-md background when on images

### Charts & Visualizations

**Volume/Profit Charts** (Analytics):
- Line charts with purple gradient fill (volume)
- Dual-axis: Green line for profit
- Time ranges: 7d, 30d, 90d, 1y
- Tooltips showing exact values
- Export to image button

**Commission Breakdown** (Pie Chart):
- Three segments: Spread Earnings, Tier Bonus, House Share
- Purple/green/blue color scheme
- Percentage labels on hover
- Legend below

**Tier Progression Graph**:
- Stepped area chart showing volume over time
- Tier thresholds as horizontal lines (Bronze/Silver/Gold)
- Current position highlighted
- Forecast line (dotted) based on current trend

---

## Page Layouts

### Homepage (tkoin.finance)

**Hero** (90vh):
- Full-width purple-to-indigo gradient background with subtle particle animation
- Centered headline: **"Tkoin Liquidity Network"**
- Subheadline: **"Earn as an Agent, Play with Ease"**
- Description: "Trusted agent network for buying Tkoin to play and redeeming your winnings back to fiat. 1% burn mechanism (configurable), 100M max supply."
- **Dual CTAs**: 
  - "Find an Agent" (primary gradient) → Agent Directory
  - "Become a Liquidity Provider" (outline) → Agent Application
- Live stats bar below:
  - Total Agent Liquidity
  - Active Agents (X Bronze, Y Silver, Z Gold)
  - 24h Volume
  - 6 Supported Currencies (flags)

**How It Works** (3-column):
- **For Users**: Find Agent → Buy Tkoin → Play → Redeem Winnings
- **For Agents**: Buy Inventory → Set Prices → Serve Customers → Earn Commissions
- **For Platform**: Blockchain Verified, Compliance Ready, 1% Burn Mechanism

**Live Rates Comparison**:
- 6-column table (PHP, EUR, USD, JPY, GBP, AUD)
- Row 1: Buy Rate (what agents pay users)
- Row 2: Sell Rate (what users pay agents)
- Last updated timestamp
- "See All Agents" link

**Agent Benefits Section**:
- "Why Provide Liquidity?" headline
- 3-column grid:
  - **Earn Commissions**: Up to 1% per transaction + tier bonuses
  - **Tier Progression**: Bronze → Silver → Gold unlocks higher limits and better rates
  - **Monthly Settlements**: Automatic USDC payouts + house edge share
- "Apply to Become an Agent" CTA

**Featured Agents**:
- 3-column grid of top agents (highest rating or volume)
- Profile cards with live rates
- "View All Agents" link

**Trust & Compliance**:
- 2-column: Security features (blockchain verification, burn mechanism) | Audit badges
- Regulatory compliance messaging
- Link to documentation

**Footer**:
- Navigation: Tokenomics, Agents, How It Works, Live Rates, Docs, About
- Social links, legal pages, newsletter signup

---

### Agent Portal

**Sidebar Navigation** (Using Shadcn Sidebar component):
- `SidebarHeader`: Logo + Agent name + tier badge
- `SidebarContent` with `SidebarMenu`:
  - LayoutDashboard icon: Dashboard
  - DollarSign icon: Pricing & Limits
  - Receipt icon: Transactions  
  - Trophy icon: Commissions & Earnings
  - TrendingUp icon: Analytics
  - Wallet icon: Inventory & Funding
  - Settings icon: Settings
- Use `SidebarMenuButton` with proper active states (data-[active=true])
- `SidebarFooter`: Tier progress mini-card with current tier badge

**Dashboard Home**:
- Top row KPI cards (4 columns):
  - Current Tier (with progress bar)
  - Today's Volume
  - Today's Profit (green if positive)
  - Inventory Balance
- Quick actions row:
  - "Configure Pricing" → Pricing page
  - "Buy Inventory" → Funding modal
  - "View Commissions" → Commissions page
- Middle: Exchange calculator widget (for user transactions)
- Bottom: Recent transactions table (last 10)

**Pricing & Limits Page**:
- Currency tabs at top (PHP, EUR, USD, etc.)
- Current rates card showing:
  - Your bid rate (what you pay to buy from users)
  - Your ask rate (what users pay you)
  - Your margin per 100 TKOIN
- Pricing configurator form:
  - Bid spread slider (with tier limits)
  - Ask spread slider (with tier limits)
  - FX buffer slider
  - Live preview updating in real-time
- "What If" calculator:
  - Input: Transaction amount (TKOIN or fiat)
  - Output: Your profit for this transaction
- Order limits section:
  - Min/Max order size
  - Daily limit remaining
  - Monthly volume toward next tier

**Transactions Page**:
- Filters: Date range, Type (Inventory/Sell/Buy), Currency
- Export to CSV button
- Table columns:
  - Date/Time
  - Type (with colored label)
  - Amount (TKOIN)
  - Fiat Amount
  - Rate
  - Cost Basis
  - Profit/Loss (green/red)
  - Margin %
- Summary cards above table:
  - Total Volume (period)
  - Total Profit (period)
  - Average Margin %
  - Transaction Count
- Expandable rows showing transaction details + blockchain link

**Commissions & Earnings Page**:
- Large tier badge with progress bar
- "X TKOIN to Silver" motivational text
- Commission breakdown (current month):
  - Spread Earnings
  - Tier Bonus (0.5%/0.75%/1.0%)
  - House Edge Share (10% pro-rata)
  - **Total Commission** (large, green)
- Settlement calendar:
  - Next settlement date
  - Estimated payout (USDC)
  - Settlement history table
- YTD summary:
  - Total commissions earned
  - Total transactions
  - Average commission per transaction

**Analytics Page**:
- Time range selector (30d, 60d, 90d, 1y)
- Charts row 1:
  - Volume over time (line chart)
  - Profit over time (line chart)
- Charts row 2:
  - Commission breakdown (pie chart)
  - Tier progression (stepped area chart)
- Metrics grid:
  - Customer Metrics: Repeat customers, avg transaction size, customer acquisition
  - Inventory Metrics: Cost basis trends, turnover rate, profit per currency
  - Performance: Best performing currency, highest margin day, peak volume hour

**Inventory & Funding Page**:
- Current balance card:
  - TKOIN balance
  - Fiat reserves (by currency)
  - Pending transactions
- Cost basis analysis:
  - Blended cost per TKOIN
  - Profit/loss if sold at current market rate
- "Buy Inventory" form:
  - Select currency (USDT/USDC/EURt)
  - Amount to deposit
  - Expected TKOIN received (after 1% burn)
  - Treasury wallet address + QR code
- Transaction history (inventory purchases only)

**Settings Page**:
- Profile information
- Bank account for settlements
- Verification status + documents
- Notification preferences
- API keys (future)

---

### Admin Panel

**Agent Approval Queue**:
- Pending applications table
- Document preview modal
- Verification checklist
- Approve/Reject actions with reason field

**System Configuration**:
- **Pricing Defaults**:
  - Global bid spread (default for new agents)
  - Global ask spread
  - Global FX buffer
- **Commission Tiers**:
  - Bronze threshold (volume)
  - Silver threshold
  - Gold threshold
  - Commission rates per tier
- **House Edge Share**: Percentage (default 10%)
- **Burn Rate**: Slider 0-2% (currently 1%)
- Save button with audit log

**Agent Profitability Monitoring**:
- All agents table:
  - Agent Name + Tier
  - 30-day Volume
  - Total Profit
  - Average Margin %
  - Risk Score (inventory exposure)
- Filters: Tier, Profitability, Risk level
- Export to CSV
- Alerts for: Negative margins, excessive spreads, low inventory

**Settlement Operations**:
- Process monthly settlement button
- Settlement history with status
- USDC payout tracking
- Commission reconciliation report

**Platform Analytics**:
- Total platform volume (all agents)
- Agent performance leaderboard
- Transaction heatmap (by currency, hour)
- Burn rate trends
- System health metrics

---

## Images

**Hero Image**: Abstract cryptocurrency liquidity pool visualization with purple-to-indigo gradient, flowing particles suggesting agent network connections, professional and modern (1920x1080, full-bleed).

**Section Backgrounds**: Subtle geometric grid patterns in light purple for alternating sections.

**Agent Profiles**: Professional avatar placeholders (initials style with tier-colored backgrounds).

**Tier Badge Icons**: Custom bronze/silver/gold badges with shimmer effects.

**Trust Badges**: Security audit logos, regulatory compliance seals, blockchain verification icons.

---

## Animations

**Minimal & Purposeful**:
- Live counter animations for stats (smooth number transitions with easing)
- Tier badge shimmer effect on hover (opacity/brightness, NO scaling)
- Profit/loss numbers: Fade in with color (green/red)
- Charts: Animated drawing on load
- Hover: Use hover-elevate utility (elevation without size change)
- Loading: Skeleton screens for async data, spinner for form submissions
- Real-time updates: Smooth fade-in for new transactions
- Progress bars: Animated fill with easing
- **NEVER use scale transforms on hover** - violates layout stability rules

---

## Accessibility

- Purple and green color contrast tested against white/light backgrounds (WCAG AA)
- Focus rings on all interactive elements (ring-2 ring-purple-500)
- Keyboard navigation for all dashboard functions
- Screen reader labels for:
  - Transaction types and statuses
  - Profit/loss indicators
  - Chart data points
  - Tier progression
- High contrast mode for data tables and charts
- Reduced motion support for animations

---

## Dark Mode

- All components support dark mode with `.dark` class
- Purple accents maintain prominence in dark mode
- Profit green and loss red maintain sufficient contrast
- Tier badges use lighter metallic tones in dark mode
- Charts use dark backgrounds with light grid lines
- Data tables use subtle borders and hover states

---

## Mobile Responsive

**Breakpoints**: sm (640px), md (768px), lg (1024px), xl (1280px)

**Mobile Navigation**: Hamburger menu collapsing to drawer
**Agent Portal Mobile**: Bottom tab bar (Dashboard, Transactions, Pricing, Commissions)
**Tables**: Horizontal scroll or stacked card view
**Charts**: Responsive scaling, touch-friendly tooltips
**Forms**: Full-width on mobile, stacked inputs

---

## Data Formatting

**Amounts**:
- TKOIN: Up to 8 decimals (e.g., "1,234.56789012 TKOIN")
- Fiat: 2 decimals (e.g., "$1,234.56 USD")
- Percentages: 2 decimals (e.g., "3.45%")

**Dates**:
- Relative: "2 hours ago", "3 days ago"
- Absolute: "Jan 13, 2025 9:30 PM"
- Settlement dates: "January 2025 Settlement"

**Numbers**:
- Thousands separator: comma (1,234)
- Large numbers: "1.2M", "345K" (with tooltip showing full number)

**Addresses**:
- Shortened: "ABC...XYZ" (first 3, last 3)
- Full on hover/click with copy button
- Monospace font
