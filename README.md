# Canadian Citizenship Test Driller

Next.js app for drilling Canadian citizenship test questions with separate progress for Pranav and Manal.

## Modes

- Drill: weakest-first multiple choice cards with immediate feedback.
- Practice: 20-question practice sessions with a 15/20 passing target.

Progress is stored per profile in `localStorage`, so leaving and returning in the same browser keeps history.

## Question Sources

- Official practice questions: Canada.ca Discover Canada study-question page.
- Drill questions: generated from topics covered in the official Discover Canada study guide.

## Development

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Vercel

Import this repository into Vercel and use the default Next.js settings.
