import BrandLogo from "../ui/BrandLogo";

export default function AuthLayout({
  title,
  subtitle,
  children,
  footer,
  visualTitle,
  visualText,
  chips = [],
  maxWidthClass = "max-w-[860px]",
}) {
  return (
    <main className="auth-shell flex min-h-screen items-center justify-center px-5 py-8">
      <div className={`grid w-full ${maxWidthClass} overflow-hidden rounded-[24px] bg-white shadow-auth-card lg:grid-cols-[1.05fr_1fr]`}>
        <section className="animate-slide-left bg-white px-6 py-10 sm:px-10 lg:px-12">
          <BrandLogo containerClassName="mb-8" />

          <header className="mb-7">
            <h1 className="font-display text-[2rem] font-bold leading-none tracking-[-0.04em] text-med-ink sm:text-[2.1rem]">
              {title}
            </h1>
            <p className="mt-3 max-w-md text-sm font-light leading-6 text-med-ink-muted">
              {subtitle}
            </p>
          </header>

          {children}
          {footer ? <div className="mt-6">{footer}</div> : null}

          <p className="mt-6 text-center text-xs text-med-ink-subtle">
            (c) 2025 MedApp - Sistema de Gestion de Citas
          </p>
        </section>

        <aside className="relative hidden overflow-hidden bg-[linear-gradient(148deg,#3A3BA0_0%,#5E60CE_30%,#4EA8DE_66%,#A0EDCE_100%)] px-8 py-10 text-white lg:flex lg:flex-col lg:justify-end lg:animate-slide-right">
          <div className="absolute -right-24 -top-24 h-[340px] w-[340px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.13)_0%,transparent_68%)]" />
          <div className="absolute -left-10 top-16 h-[190px] w-[190px] animate-float-soft rounded-full bg-[radial-gradient(circle,rgba(255,209,102,0.22)_0%,transparent_65%)]" />
          <div className="absolute -right-16 bottom-20 h-[250px] w-[250px] animate-float-soft rounded-full bg-[radial-gradient(circle,rgba(247,37,133,0.15)_0%,transparent_62%)] [animation-delay:2.2s]" />
          <div className="absolute left-[52%] top-[42%] h-[100px] w-[100px] animate-float-soft bg-[rgba(128,237,153,0.16)] [border-radius:38%_62%_63%_37%/41%_44%_56%_59%] [animation-delay:1.3s]" />
          <div className="absolute -right-40 -top-44 h-[480px] w-[480px] rounded-full border border-white/10" />
          <div className="absolute -right-16 -top-20 h-[310px] w-[310px] rounded-full border border-white/10" />

          <div className="relative z-10">
            {chips.length ? (
              <div className="mb-7 flex flex-wrap gap-2">
                {chips.map((chip) => (
                  <span key={chip.label} className="pill-chip">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: chip.color }} />
                    {chip.label}
                  </span>
                ))}
              </div>
            ) : null}

            <h2 className="font-display text-[2.3rem] font-extrabold leading-[1.05] tracking-[-0.04em] text-white">
              {visualTitle}
            </h2>

            <p className="mt-4 max-w-[300px] text-[0.95rem] font-light leading-7 text-white/70">
              {visualText}
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
