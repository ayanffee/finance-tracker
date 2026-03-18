# Finance Tracker TODO

## Database & Schema
- [x] Create transactions table (id, userId, type, amount, category, date, description)
- [x] Create categories table (id, name, color, icon)
- [x] Create wishlist_items table (id, userId, name, estimatedPrice, priority, targetDate)
- [x] Create financial_goals table (id, userId, targetAmount, targetDate, description)
- [x] Run database migrations

## Backend API
- [x] Create transaction CRUD procedures (create, read, update, delete)
- [x] Create category management procedures
- [x] Create wishlist CRUD procedures
- [x] Create financial goals procedures
- [x] Create spending analytics procedures (daily/weekly/monthly totals)
- [x] Create budget CRUD procedures
- [x] Create recurring transaction CRUD procedures
- [ ] Create CSV parsing and transaction import procedure
- [ ] Create AI assistant procedure for spending analysis

## Frontend - Dashboard
- [x] Create DashboardLayout with sidebar navigation
- [x] Build dashboard page with overview cards (total income, expenses, balance)
- [x] Add income vs expenses chart (monthly/weekly/daily)
- [x] Add category breakdown pie/bar chart
- [x] Add spending trend line chart

## Frontend - Transaction Management
- [x] Create transaction entry form with category selector
- [x] Build transaction list page with filtering (date, category, type)
- [ ] Create CSV upload component with preview
- [x] Add transaction edit/delete functionality
- [ ] Create transaction detail view

## Frontend - Wishlist & Projections
- [x] Build wishlist page with add/edit/delete items
- [x] Add priority level selector (high, medium, low)
- [x] Create financial projections calculator
- [x] Display "how much to earn/save" for wishlist items
- [x] Add target date picker for wishlist items

## Frontend - AI Assistant
- [x] Create chat interface component
- [x] Build message history display
- [x] Add input field for user questions
- [x] Integrate with backend AI procedure
- [x] Display spending insights and recommendations

## Frontend - Budget & Recurring
- [x] Build budgets page with monthly spending limits
- [x] Add budget alert thresholds and visual progress bars
- [x] Build recurring transactions page
- [x] Add frequency selector (daily, weekly, monthly, etc.)
- [x] Add toggle to enable/disable recurring transactions

## Frontend - Polish
- [x] Add loading states and error handling
- [x] Create empty states for all pages
- [ ] Add responsive design for mobile
- [ ] Implement dark/light theme toggle
- [x] Add navigation between all features

## Testing & Deployment
- [x] Write vitest tests for backend procedures
- [x] Write vitest tests for data calculations
- [ ] Test CSV parsing with sample files
- [ ] Test AI assistant responses
- [ ] Create checkpoint and prepare for deployment
