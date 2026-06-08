# SaiHat / TripBalance

A mobile-first web app for splitting private trip expenses, managing members, and reviewing settlement recommendations across AED, CNY, and KZT.

## Prerequisites

- macOS Terminal
- Node.js and npm

Check your installed versions:

```bash
node --version
npm --version
```

## Run The Website Locally

1. Install dependencies:

```bash
npm install
```

2. Start the local development server:

```bash
npm run dev
```

3. Open the site in your browser:

```txt
http://localhost:3000
```

If port 3000 is already in use, stop the other process or change the port in `package.json`.

## Verify The Project

Run TypeScript checks:

```bash
npm run lint
```

Run a production build:

```bash
npm run build
```

## Manual Test Checklist

- Reset sample data from the side menu.
- Join or inspect the sample trip using invite code `GRAD26`.
- Switch personas from the side menu.
- Add an equal-split expense.
- Add a multi-currency expense using AED, CNY, or KZT.
- Edit and delete an expense.
- Switch to the admin persona and approve a pending member.
- Review balances and mark a settlement as paid.
- Test the layout in mobile responsive mode in your browser.
