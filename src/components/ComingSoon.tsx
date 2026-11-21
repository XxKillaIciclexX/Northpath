import { ArrowRight, Eye, Zap, Target, Shield, Mail } from 'lucide-react';

interface ComingSoonProps {
  onPreview: () => void;
}

export default function ComingSoon({ onPreview }: ComingSoonProps) {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="mx-auto max-w-4xl px-6 py-24 text-center">
        <p className="mb-5 text-sm font-semibold uppercase tracking-[0.25em] text-cyan-400">Northpath</p>
        <h1 className="mb-6 text-4xl font-bold leading-tight sm:text-6xl">
          Technology that <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">moves you forward.</span>
        </h1>
        <p className="mx-auto mb-12 max-w-2xl text-lg leading-relaxed text-slate-300">
          We're building practical software, connected systems, and automation that make complex work simpler. Our next chapter is coming soon.
        </p>
        <div className="mx-auto mb-12 grid max-w-2xl gap-6 sm:grid-cols-3">
          {[
            { Icon: Target, title: 'Direction', caption: 'Purposeful technology' },
            { Icon: Zap, title: 'Clarity', caption: 'Straightforward solutions' },
            { Icon: Shield, title: 'Reliability', caption: 'Built to work' }
          ].map(({ Icon, title, caption }) => (
            <div key={title} className="rounded-xl border border-slate-700 bg-slate-800/40 p-5">
              <Icon className="mx-auto mb-3 text-cyan-400" size={28} />
              <h2 className="font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-slate-400">{caption}</p>
            </div>
          ))}
        </div>
        <div className="mx-auto mb-8 max-w-md rounded-2xl border border-slate-700 bg-slate-800/50 p-7">
          <h2 className="mb-3 text-xl font-semibold">Stay in touch</h2>
          <p className="mb-5 text-sm text-slate-300">Our signup system is being upgraded. Email us directly for updates or inquiries.</p>
          <a href="mailto:hello@northpath.ai?subject=Northpath%20updates" className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 px-6 py-3 font-medium text-white hover:opacity-90">
            <Mail size={18} className="mr-2" /> Email Northpath
          </a>
        </div>
        <button onClick={onPreview} className="inline-flex items-center rounded-lg border border-slate-600 bg-slate-800 px-7 py-3 font-medium hover:bg-slate-700">
          <Eye size={18} className="mr-2" /> Preview our website <ArrowRight size={18} className="ml-2" />
        </button>
      </div>
    </main>
  );
}
