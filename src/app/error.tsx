"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="setup-page">
      <h1>We couldn’t load your workspace.</h1>
      <p>
        Check the database migration and connection settings, then try again. No
        changes have been confirmed.
      </p>
      <button onClick={reset}>Try again</button>
    </main>
  );
}
