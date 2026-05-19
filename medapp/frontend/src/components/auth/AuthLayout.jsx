import BrandLogo from "../ui/BrandLogo";

export default function AuthLayout({
  title,
  subtitle,
  children,
  footer,
  visualTitle,
  visualText,
  chips = [],
  maxWidthClass = "max-w-[820px]",
}) {
  return (
    <main className="auth-shell flex min-h-[100dvh] items-center justify-center px-4 py-4 sm:px-5 sm:py-6">
      <div className={`grid w-full ${maxWidthClass} overflow-hidden rounded-[20px] bg-white shadow-auth-card lg:grid-cols-[1.05fr_1fr]`}>
        <section className="animate-slide-left bg-white px-5 py-7 sm:px-8 sm:py-8 lg:px-10 lg:py-9">
          <BrandLogo containerClassName="mb-6" />

          <header className="mb-5">
            <h1 className="font-display text-[1.75rem] font-bold leading-tight text-med-ink sm:text-[1.95rem]">
              {title}
            </h1>
            <p className="mt-2.5 max-w-md text-sm font-light leading-5 text-med-ink-muted">
              {subtitle}
            </p>
          </header>

          {children}
          {footer ? <div className="mt-6">{footer}</div> : null}

          <p className="mt-6 text-center text-xs text-med-ink-subtle">
            (c) 2025 MedApp - Sistema de Gestion de Citas
          </p>
        </section>

        <aside className="relative hidden overflow-hidden bg-[linear-gradient(148deg,#3A3BA0_0%,#5E60CE_30%,#4EA8DE_66%,#A0EDCE_100%)] px-8 py-8 text-white lg:flex lg:flex-col lg:justify-center lg:animate-slide-right">
          <div className="absolute -right-24 -top-24 h-[340px] w-[340px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.13)_0%,transparent_68%)]" />
          <div className="absolute -left-10 top-16 h-[190px] w-[190px] animate-float-soft rounded-full bg-[radial-gradient(circle,rgba(255,209,102,0.22)_0%,transparent_65%)]" />
          <div className="absolute -right-16 bottom-20 h-[250px] w-[250px] animate-float-soft rounded-full bg-[radial-gradient(circle,rgba(247,37,133,0.15)_0%,transparent_62%)] [animation-delay:2.2s]" />
          <div className="absolute left-[52%] top-[42%] h-[100px] w-[100px] animate-float-soft bg-[rgba(128,237,153,0.16)] [border-radius:38%_62%_63%_37%/41%_44%_56%_59%] [animation-delay:1.3s]" />
          <div className="absolute -right-40 -top-44 h-[480px] w-[480px] rounded-full border border-white/10" />
          <div className="absolute -right-16 -top-20 h-[310px] w-[310px] rounded-full border border-white/10" />

          <div className="relative z-10">
            {chips.length ? (
              <div className="mb-5 flex flex-wrap gap-2">
                {chips.map((chip) => (
                  <span key={chip.label} className="pill-chip">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: chip.color }} />
                    {chip.label}
                  </span>
                ))}
              </div>
            ) : null}

            <h2 className="font-display text-[2rem] font-extrabold leading-[1.08] text-white">
              {visualTitle}
            </h2>

            <p className="mt-3 max-w-[300px] text-[0.9rem] font-light leading-6 text-white/70">
              {visualText}
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
