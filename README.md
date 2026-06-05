# Freedom Bank

> Firebase-based simulated banking dashboard for generating realistic checking and credit card activity for BudgetWise AI.

> COMP 491/L Senior Design Project II and Lab - Spring 2026 companion application for BudgetWise AI.

![Firebase](https://img.shields.io/badge/Backend-Firebase-orange)
![Firestore](https://img.shields.io/badge/Database-Firestore-yellow)
![JavaScript](https://img.shields.io/badge/Frontend-JavaScript-blue)
![Cloud Functions](https://img.shields.io/badge/API-Cloud_Functions-green)
![Firebase Auth](https://img.shields.io/badge/Auth-Firebase_Auth-red)

---

## About

Freedom Bank is a simulated banking application built with Firebase Hosting, Firebase Authentication, Cloud Firestore, and Firebase Cloud Functions.

The project lets users create an account, sign in, view simulated checking and credit card accounts, generate realistic transaction history, and connect the simulated bank account to **BudgetWise AI**, a companion personal finance dashboard.

> This is a demo banking simulator. It is not a real bank, payment processor, card issuer, or production financial platform.

---

## Purpose

Freedom Bank was created as a safe transaction simulator for BudgetWise AI. Instead of connecting BudgetWise AI to a real bank API, Freedom Bank generates realistic fake financial activity that can be imported, analyzed, and displayed inside the BudgetWise AI dashboard.

---

## Features

| Area | Features |
|---|---|
| Authentication | Email/password signup and login using Firebase Auth |
| Dashboard | Checking and credit card account views |
| Accounts | Simulated checking balance, credit debt, masked account numbers, expiry, and demo CVV display |
| Transactions | Generated transaction history with merchants, categories, dates, types, and amounts |
| Manual Generation | Generate up to 5 manual transactions per account per day |
| Scheduled Generation | Hourly Cloud Function generates simulated activity |
| Activity Types | Expenses, salary deposits, credit card spending, credit payments, ATM/top-up behavior |
| Filtering | Search transactions, filter by date, and switch between checking/credit accounts |
| Themes | Light and dark mode support |
| BudgetWise Sync | Link/unlink status for BudgetWise AI integration |

---

## Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | HTML, CSS, JavaScript, Tailwind CDN |
| Backend | Firebase Cloud Functions v2, Node.js 20 |
| Authentication | Firebase Authentication |
| Database | Cloud Firestore |
| Hosting | Firebase Hosting |
| Scheduling | Firebase Scheduler / scheduled Cloud Functions |
| UI Tools | Flatpickr, Google Fonts |

---

## Project Architecture

```text
freedom-bank/
├── functions/
│   ├── index.js              # Cloud Functions, API endpoints, scheduled generation
│   ├── package.json
│   ├── package-lock.json
│   └── .gitignore
│
├── public/
│   ├── index.html            # Login/signup page
│   ├── dashboard.html        # Main banking dashboard
│   ├── auth.js               # Authentication UI logic
│   ├── dashboard.js          # Dashboard rendering and API calls
│   ├── theme.js              # Light/dark theme handling
│   ├── styles.css            # Custom styling
│   ├── favicon.svg
│   └── firebase-config.js    # Local Firebase client config, ignored by Git
│
├── firestore.rules
├── firebase.json
├── .firebaserc
├── .gitignore
└── README.md
```

---

## Main Application Flow

1. User signs up or logs in with Firebase Authentication.
2. The dashboard loads the user's simulated checking and credit accounts.
3. The user can switch between checking and credit card views.
4. The app displays account balance/debt, income, expenses, net change, and recent transactions.
5. Users can manually generate transactions, limited to 5 per account per day.
6. Scheduled Cloud Functions generate simulated banking activity automatically.
7. BudgetWise AI can connect to Freedom Bank and import selected account activity.

---

## Cloud Functions / API Overview

| Function / Endpoint | Purpose |
|---|---|
| `hourlyTick` | Scheduled hourly transaction generator for Firebase users |
| `/tick` | Authenticated manual transaction generation endpoint |
| `/api/account` | Retrieves simulated checking/credit account data |
| `/api/transactions` | Retrieves transaction history |
| `/api/linkBudgetWise` | Updates BudgetWise linked/unlinked status |

---

## Firestore Data Model

```text
users/{uid}
├── account/
│   ├── checking
│   └── credit
├── transactions
├── plans
├── hourLocks
├── manualDaily
└── dailyAutoPlan
```

The app stores simulated account data, generated transactions, daily generation plans, manual transaction counters, and duplicate-prevention lock records in Firestore.

---

## BudgetWise AI Integration

Freedom Bank is designed to work with BudgetWise AI.

| Integration Feature | Description |
|---|---|
| Simulated Bank Login | BudgetWise AI signs into Freedom Bank using Firebase authentication endpoints |
| Account Selection | BudgetWise AI users can connect checking, credit card, or both |
| Transaction Import | Freedom Bank transactions can be imported into BudgetWise AI |
| Linked Status | Freedom Bank can show whether the account is connected to BudgetWise AI |
| Demo Safety | No real banking data is used |

---

## Security Notes

This project is a simulator and is not production-ready.

Known limitations:

- It does not process real payments or real banking transactions.
- Firestore rules should be hardened before any production use.
- Client-side account/card details are demo-only and should not be treated as real card data.
- API keys and Firebase configuration should be kept out of Git when sensitive.
- CORS, rate limiting, audit logging, and stronger account protection would be required for production.
- Automated tests should be added before using the project beyond demo/portfolio purposes.

---

## Environment / Configuration

The real Firebase client configuration should be stored locally in:

```text
public/firebase-config.js
```

That file is intentionally ignored by Git.

Cloud Function secrets should be stored using Firebase environment configuration or local `.env` files that are also ignored by Git.

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/LernikAvetisyan/freedom-bank.git
cd freedom-bank
```

### 2. Install Cloud Functions dependencies

```bash
cd functions
npm install
```

### 3. Configure Firebase

Create your Firebase project and add your local Firebase client config to:

```text
public/firebase-config.js
```

### 4. Run locally

```bash
firebase emulators:start
```

### 5. Deploy

```bash
firebase deploy
```

---

## Resume Summary

Built Freedom Bank, a Firebase-based banking transaction simulator with Firebase Auth, Cloud Firestore, Cloud Functions, scheduled transaction generation, manual generation limits, checking/credit account views, transaction filtering, light/dark theme support, and simulated bank synchronization for BudgetWise AI.

---

## Disclaimer

Freedom Bank is a student/portfolio project using simulated financial data. It is not a real bank, payment processor, card issuer, or production financial system.
