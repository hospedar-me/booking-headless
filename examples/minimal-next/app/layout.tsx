import { Suspense } from "react";
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main
          style={{
            maxWidth: 760,
            margin: "3rem auto",
            fontFamily: "system-ui",
            padding: 24,
          }}
        >
          <Suspense fallback={<p>Loading…</p>}>{children}</Suspense>
        </main>
      </body>
    </html>
  );
}
