import Link from "next/link";
import type { ReactNode } from "react";
import {
  getRelatedPages,
  pagePath,
  type SeoPage,
  trustPages,
} from "./seo-content";
import { siteConfig } from "./seo";

function SiteHeader() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-6">
        <Link
          href="/"
          className="font-[family:var(--font-space-grotesk)] text-lg font-semibold text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          {siteConfig.name}
        </Link>
        <nav className="flex flex-wrap gap-2 text-sm" aria-label="Site">
          <Link
            href="/"
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 shadow-sm hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            Calculator
          </Link>
          <Link
            href="/debit-spread-calculator"
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 shadow-sm hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            Debit spreads
          </Link>
          <Link
            href="/methodology"
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 shadow-sm hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            Methodology
          </Link>
          <Link
            href="/disclaimer"
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 shadow-sm hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            Disclaimer
          </Link>
        </nav>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-6 text-sm text-slate-600 md:grid-cols-[minmax(0,1fr)_auto] md:px-6">
        <p className="max-w-2xl text-pretty">
          {siteConfig.name} is an educational options strategy calculator. It does not
          provide financial advice, broker quotes, or trade recommendations.
        </p>
        <nav className="flex flex-wrap gap-3 md:justify-end" aria-label="Footer">
          {trustPages.map((page) => (
            <Link
              key={page.slug}
              href={pagePath(page)}
              className="font-medium text-slate-700 hover:text-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              {page.title}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}

export function SeoPageShell({ children }: { children: ReactNode }) {
  return (
    <main className="h-dvh overflow-y-auto bg-stone-100 text-slate-900">
      <SiteHeader />
      {children}
      <SiteFooter />
    </main>
  );
}

export function SeoPageArticle({ page }: { page: SeoPage }) {
  const relatedPages = getRelatedPages(page);

  return (
    <>
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 md:px-6 md:py-12">
          <p className="text-sm font-semibold text-[var(--accent)]">{page.heroEyebrow}</p>
          <h1 className="mt-2 max-w-3xl font-[family:var(--font-space-grotesk)] text-4xl font-semibold text-balance text-slate-950 sm:text-5xl">
            {page.heroTitle}
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-pretty text-slate-600">
            {page.heroLead}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              href="/"
              className="rounded-md border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[var(--accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              Open calculator
            </Link>
            <Link
              href="/methodology"
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              Read methodology
            </Link>
          </div>
          <p className="mt-4 text-sm text-slate-500">{page.updated}</p>
        </div>
      </section>

      <section className="bg-stone-100">
        <div className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_20rem] md:px-6">
          <div className="space-y-4">
            {page.sections.map((section) => (
              <section
                key={section.heading}
                className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
              >
                <h2 className="font-[family:var(--font-space-grotesk)] text-2xl font-semibold text-balance text-slate-950">
                  {section.heading}
                </h2>
                <p className="mt-3 leading-7 text-pretty text-slate-600">{section.body}</p>
                {section.bullets ? (
                  <ul className="mt-4 grid gap-2 text-slate-600">
                    {section.bullets.map((bullet) => (
                      <li key={bullet} className="flex gap-2">
                        <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                        <span className="text-pretty">{bullet}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>

          <aside className="space-y-4">
            {page.example ? (
              <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="font-[family:var(--font-space-grotesk)] text-xl font-semibold text-balance text-slate-950">
                  {page.example.heading}
                </h2>
                <p className="mt-2 text-sm leading-6 text-pretty text-slate-600">
                  {page.example.body}
                </p>
                <dl className="mt-4 grid gap-2">
                  {page.example.rows.map((row) => (
                    <div
                      key={row.label}
                      className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-t border-slate-100 pt-2 text-sm"
                    >
                      <dt className="text-slate-500">{row.label}</dt>
                      <dd className="font-mono font-semibold text-slate-950 tabular-nums">
                        {row.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : null}

            {page.steps ? (
              <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="font-[family:var(--font-space-grotesk)] text-xl font-semibold text-balance text-slate-950">
                  How to use it
                </h2>
                <ol className="mt-4 grid gap-3 text-sm text-slate-600">
                  {page.steps.map((step, index) => (
                    <li key={step} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3">
                      <span className="flex size-8 items-center justify-center rounded-full bg-slate-950 font-mono text-xs font-semibold text-white tabular-nums">
                        {index + 1}
                      </span>
                      <span className="pt-1 text-pretty">{step}</span>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}
          </aside>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6">
          <h2 className="font-[family:var(--font-space-grotesk)] text-2xl font-semibold text-balance text-slate-950">
            Common questions
          </h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {page.faqs.map((faq) => (
              <section
                key={faq.question}
                className="rounded-lg border border-slate-200 bg-slate-50 p-4"
              >
                <h3 className="font-semibold text-balance text-slate-950">{faq.question}</h3>
                <p className="mt-2 text-sm leading-6 text-pretty text-slate-600">
                  {faq.answer}
                </p>
              </section>
            ))}
          </div>
        </div>
      </section>

      {relatedPages.length > 0 ? (
        <section className="border-t border-slate-200 bg-stone-100">
          <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6">
            <h2 className="font-[family:var(--font-space-grotesk)] text-2xl font-semibold text-balance text-slate-950">
              Related calculators and pages
            </h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {relatedPages.map((relatedPage) => (
                <Link
                  key={relatedPage.slug}
                  href={pagePath(relatedPage)}
                  className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                >
                  <span className="block font-semibold text-slate-950">
                    {relatedPage.title}
                  </span>
                  <span className="mt-2 block text-sm leading-6 text-pretty text-slate-600">
                    {relatedPage.description}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}

export function HomeSeoContent() {
  return (
    <section
      id="learn"
      aria-label="Calculator resources"
      className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm"
    >
      <div className="flex flex-col gap-2 text-xs leading-5 text-slate-500 lg:flex-row lg:items-center lg:justify-between">
        <p className="max-w-4xl text-pretty">
          Educational options calculator for debit spreads, break-even prices, max
          profit, max loss, and scenario P/L. Estimates are theoretical and not
          financial advice.
        </p>
        <nav className="flex shrink-0 flex-wrap gap-x-3 gap-y-1" aria-label="Resources">
          <Link
            href="/debit-spread-calculator"
            className="font-semibold text-slate-700 hover:text-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            Debit spread guide
          </Link>
          <Link
            href="/methodology"
            className="font-semibold text-slate-700 hover:text-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            Methodology
          </Link>
          <Link
            href="/disclaimer"
            className="font-semibold text-slate-700 hover:text-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            Disclaimer
          </Link>
        </nav>
      </div>
    </section>
  );
}
