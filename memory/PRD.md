# CashClick — Product Requirements (v1)

## Overview
CashClick is an Expo React Native (mobile) task earning app. Users register via device-ID + mobile + username (one device = one account), then play mini-games, complete tasks/campaigns, do daily explore activities, refer friends, and withdraw earnings via UPI/Bank with admin approval.

## Stack
- **Frontend**: Expo SDK 54 (React Native), expo-router, Plus Jakarta Sans, Feather icons, Reanimated/Animated
- **Backend**: FastAPI + Motor (MongoDB)
- **Ads**: react-native-google-mobile-ads (banner/interstitial/rewarded). Test ad IDs by default. Real ads activate in production builds; Expo Go shows clear placeholders.
- **Currency**: INR (₹), 100 points = ₹1 default (admin-configurable). IST timezone for daily resets.

## User-facing
- **Splash + Login**: Device-ID based "Continue → Mobile + Confirm Mobile + Username (live check) + optional referral".
- **Home tab**: TopBar (logo + username, points pill), auto-sliding banners (in-app & external), "Play Games & Earn Rewards" grid with 11 mini-games. Each game: 10 chances/day, +10 chances per rewarded ad, interstitial every 5 plays, animated reward popup.
- **Earn tab**: Tasks / Campaigns / Explore segmented grid.
  - Tasks: detail with rules, tutorial, start → form → submit → review (approve/reject/reset).
  - Campaigns: detail with rules → start → "Payment Received" confirmation → withdrawal-style entry tagged Campaign (no points awarded).
  - Explore (7 cards): Daily Check-in (30-day streak, 10-100 pts, 1.2× multiplier), Spin (daily, 10-20 pts, 2×), Scratch (daily, 10-20 pts, 2×), Visit & Earn (10s timer + reset on early return, 1.5×), Watch (5 daily with 30s gap), Surveys (100 pool, 10 daily, native ad in card, 1.5×), Quizzes (100 pool, 10 daily, 7 pts/correct, 1.5×).
- **Refer tab**: Hero with referral code (=username), rules (admin-configured: points-threshold, first-withdrawal, check-in streak — any/all), refer history, streak rewards.
- **Wallet tab**: Balance card (pts + ₹ + conversion rate), Withdraw button, transaction history with filter chips (All/Games/Task/Campaigns/Refer/Explore).
- **Withdraw**: balance card → UPI/Bank → amount chips → form with confirm fields → "Submit" → success popup + "Help Admin (Watch Ad)" rewarded button → withdrawal history with status/reason.
- **Profile tab**: username + mobile (left), animated mascot "Hi 👋" (right), Quick Access grid, Admin Login, Logout, version.

## Admin (in-app via Profile → Admin Login)
- Login: Altaf93 / 9372@Altaf93C
- Dashboard: clickable stat cards (Total Users, Active 7d, Paid ₹, Pending ₹, Task Requests, Pending Withdraws) + Manage grid.
- Manage screens: Users (search), Active Users, Withdrawals (Pay/Reject with reason/Deduct with reason+amount), Task Requests (Approve/Reject/Reset), Tasks/Campaigns/Banners/Visits/QuickAccess CRUD, Games config (chances + reward range per game), App settings (conversion rate, refer reward & qualify rules & streak rewards, withdraw chips, min withdraw, AdMob config JSON, app version, force update).

## Key API Routes
- Auth: `/auth/check-device/{did}`, `/auth/check-username`, `/auth/register`, `/auth/me/{did}`
- Config & banners: `/config`, `/banners`
- Games: `/games`, `/games/play`, `/games/watch-rewarded`
- Tasks: `/tasks`, `/tasks/{id}`, `/tasks/submit`
- Campaigns: `/campaigns`, `/campaigns/confirm`
- Explore: `/explore/checkin(/claim)`, `/explore/spin(/claim)`, `/explore/scratch(/claim)`, `/explore/visits(/start|/complete|/reset)`, `/explore/watch(/complete)`, `/explore/surveys(/submit)`, `/explore/quizzes(/submit)`
- Wallet: `/wallet/balance`, `/wallet/transactions`, `/wallet/withdraw`, `/wallet/withdrawals`
- Refer: `/refer/info`
- Profile: `/profile/quick-access`
- Admin: `/admin/login`, `/admin/dashboard`, `/admin/users(/active|/{username})`, `/admin/withdrawals(/action)`, `/admin/tasks`, `/admin/task-submissions(/action)`, `/admin/campaigns`, `/admin/banners`, `/admin/visits`, `/admin/quick-access`, `/admin/config`, `/admin/games-config`

## Mocked/Build-only
- AdMob native modules only render real ads in a development/production native build. Expo Go preview shows clear "AD BANNER" placeholders, and rewarded/interstitial calls resolve instantly while firing the reward callback (so reward flows are fully testable in preview).

## Test credentials
See `/app/memory/test_credentials.md`.
