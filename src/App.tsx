import { useState } from 'react';
import WebsiteAccount from './components/WebsiteAccount';
import {
  ArrowRight, ArrowUpRight, Blocks, Check, ChevronRight, Code2, Compass,
  Database, Gamepad2, Layers3, Mail, Menu, Monitor, Radio, Server,
  ShieldCheck, Sparkles, Workflow, X, Zap,
} from 'lucide-react';

const offerings = [
  { icon: Code2, title: 'Custom software', detail: 'Purpose-built applications, dashboards, and tools that fit the way you work.', tags: ['Web applications', 'Internal tools', 'Product development'] },
  { icon: Workflow, title: 'Automation & integrations', detail: 'Connect your existing systems and remove repetitive work from daily operations.', tags: ['APIs & integrations', 'Workflow automation', 'Data pipelines'] },
  { icon: Database, title: 'Systems & data', detail: 'Turn scattered information into dependable processes and clear decisions.', tags: ['System design', 'Reporting', 'Operational visibility'] },
];

const features = [
  { icon: Radio, title: 'TikTok gift triggers', detail: 'Connect audience interactions to in-game actions.' },
  { icon: Gamepad2, title: 'ARK server actions', detail: 'Map gifts to creature spawns, items, and other supported commands.' },
  { icon: Layers3, title: 'Custom kits & rules', detail: 'Build flexible rewards using a configurable catalog.' },
  { icon: Monitor, title: 'Local companion agent', detail: 'Run your connection to the game server from your own PC.' },
];

const navigation = [
  { label: 'Services', href: '#services' },
  { label: 'Products', href: '#products' },
  { label: 'Approach', href: '#approach' },
  { label: 'Contact', href: '#contact' },
];

function Brand({ light = false }: { light?: boolean }) {
  return (
    <a href="#home" aria-label="Northpath — back to top" className="inline-flex items-center gap-3 group">
      <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-400 shadow-lg shadow-cyan-500/10">
        <Compass size={23} strokeWidth={2.2} className="text-slate-950" />
      </span>
      <span className={`text-xl font-extrabold tracking-[-0.045em] ${light ? 'text-white' : 'text-slate-950'}`}>northpath<span className="text-emerald-400">.</span></span>
    </a>
  );
}

function Label({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return <span className={`inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] ${light ? 'text-emerald-300' : 'text-emerald-700'}`}><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{children}</span>;
}

function ProductPreview() {
  return (
    <div className="relative mx-auto w-full max-w-xl" aria-label="Illustrative Ice Pack Companion dashboard preview">
      <div className="pointer-events-none absolute -inset-8 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="relative overflow-hidden rounded-2xl border border-slate-600/60 bg-slate-900 shadow-[0_28px_90px_rgba(0,0,0,0.40)]">
        <div className="flex items-center justify-between border-b border-white/10 bg-slate-800/80 px-5 py-3">
          <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-rose-400/80"/><span className="h-2 w-2 rounded-full bg-amber-400/80"/><span className="h-2 w-2 rounded-full bg-emerald-400/80"/></div>
          <span className="text-[11px] font-medium tracking-wide text-slate-400">ICE PACK COMPANION / CONCEPT</span>
          <span className="h-2 w-2 rounded-full bg-cyan-400"/>
        </div>
        <div className="p-5 sm:p-7">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Stream overview</p><h3 className="mt-1 text-xl font-bold text-white">Your game. Your rules.</h3></div>
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">Demo interface</span>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {[['Gift rules','12'],['Reward kits','04'],['Catalog','ARK']].map(([title,value]) => <div key={title} className="rounded-xl border border-white/10 bg-white/5 p-3 sm:p-4"><p className="text-[10px] uppercase tracking-wider text-slate-400 sm:text-xs">{title}</p><p className="mt-2 text-xl font-bold text-white sm:text-2xl">{value}</p></div>)}
          </div>
          <div className="mt-5 rounded-xl border border-white/10 bg-slate-800/80 p-4">
            <div className="mb-4 flex items-center justify-between"><p className="text-sm font-semibold text-white">Example gift mappings</p><span className="text-[11px] text-slate-400">Illustrative data</span></div>
            {[['🌹','Rose','Spawn 2 Raptors'],['🎁','Perfume','Give 100 Stone'],['🌌','Galaxy','Spawn level 150 Rex']].map(([emoji,gift,reward]) => <div key={gift} className="flex items-center gap-3 border-t border-white/10 py-3 first:border-t-0"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-xl">{emoji}</span><span className="min-w-0 flex-1 text-sm font-medium text-slate-100">{gift}</span><ChevronRight size={14} className="shrink-0 text-slate-500"/><span className="max-w-[48%] text-right text-xs text-cyan-200 sm:text-sm">{reward}</span></div>)}
          </div>
        </div>
      </div>
      <div className="absolute -bottom-5 -left-4 hidden items-center gap-2 rounded-xl border border-white/15 bg-slate-800 px-4 py-3 text-xs font-semibold text-slate-100 shadow-xl sm:flex"><Zap size={16} className="text-emerald-300" /> Built for interactive streams</div>
    </div>
  );
}

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <div id="home" className="min-h-screen bg-[#081321] text-white antialiased">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#081321]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Brand light />
          <nav className="hidden items-center gap-8 md:flex" aria-label="Main navigation">
            {navigation.map((item) => <a key={item.href} href={item.href} className="text-sm font-semibold text-slate-300 transition-colors hover:text-white">{item.label}</a>)}
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <a className="hidden items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-cyan-100 md:inline-flex" href="mailto:hello@northpath.ai?subject=Let's%20talk%20Northpath">Let's talk <ArrowUpRight size={16}/></a>
            <WebsiteAccount />
            <button type="button" className="rounded-lg border border-white/15 p-2 text-white md:hidden" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={22}/> : <Menu size={22}/>}</button>
          </div>
        </div>
        {menuOpen && <nav aria-label="Mobile navigation" className="border-t border-white/10 bg-[#0d1b2b] px-5 py-4 md:hidden">{navigation.map(item => <a key={item.href} href={item.href} onClick={closeMenu} className="block rounded-lg px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-white/10">{item.label}</a>)}<a href="mailto:hello@northpath.ai" onClick={closeMenu} className="mt-3 block rounded-lg bg-emerald-400 px-4 py-3 text-center text-sm font-bold text-slate-950">Let's talk</a></nav>}
      </header>

      <main>
        <section className="relative isolate overflow-hidden pt-36 pb-24 sm:pt-44 sm:pb-32">
          <div className="pointer-events-none absolute -right-48 top-10 h-[530px] w-[530px] rounded-full bg-cyan-400/10 blur-[110px]"/>
          <div className="pointer-events-none absolute -left-32 bottom-0 h-[420px] w-[420px] rounded-full bg-emerald-400/10 blur-[100px]"/>
          <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 sm:px-8 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="relative z-10">
              <Label light>Software. Systems. Solutions.</Label>
              <h1 className="mt-7 max-w-3xl text-5xl font-extrabold leading-[1.05] tracking-[-0.055em] sm:text-6xl lg:text-[4.6rem]">Technology that <span className="bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300 bg-clip-text text-transparent">moves you forward.</span></h1>
              <p className="mt-7 max-w-xl text-lg leading-relaxed text-slate-300">We design practical software, automate complex workflows, and connect the systems that power your next big idea.</p>
              <div className="mt-9 flex flex-wrap gap-3"><a href="#services" className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 px-6 py-3.5 font-bold text-slate-950 transition-transform hover:-translate-y-0.5">Explore what we do <ArrowRight size={17}/></a><a href="#products" className="inline-flex items-center gap-2 rounded-full border border-white/25 px-6 py-3.5 font-bold text-white transition-colors hover:border-cyan-300">Meet our first product <ArrowUpRight size={17}/></a></div>
              <div className="mt-12 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-400"><span className="inline-flex items-center gap-2"><Check size={15} className="text-emerald-300"/> Custom-built</span><span className="inline-flex items-center gap-2"><Check size={15} className="text-emerald-300"/> Connected by design</span><span className="inline-flex items-center gap-2"><Check size={15} className="text-emerald-300"/> Made for real-world use</span></div>
            </div>
            <div className="relative z-10"><ProductPreview/></div>
          </div>
        </section>

        <section className="border-y border-white/10 bg-[#0d1b2b] py-6"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-12 gap-y-4 px-5 text-center text-xs font-bold uppercase tracking-[0.18em] text-slate-400 sm:px-8"><span className="inline-flex items-center gap-2"><Code2 size={18} className="text-emerald-300"/> Product development</span><span className="inline-flex items-center gap-2"><Blocks size={18} className="text-cyan-300"/> Systems integration</span><span className="inline-flex items-center gap-2"><Zap size={18} className="text-emerald-300"/> Automation</span><span className="inline-flex items-center gap-2"><ShieldCheck size={18} className="text-cyan-300"/> Thoughtful architecture</span></div></section>

        <section id="services" className="scroll-mt-20 bg-[#f4f8fa] py-24 text-slate-950 sm:py-28"><div className="mx-auto max-w-7xl px-5 sm:px-8"><Label>What we build</Label><div className="mt-5 flex flex-wrap items-end justify-between gap-5"><h2 className="max-w-2xl text-4xl font-extrabold leading-tight tracking-[-0.045em] sm:text-5xl">Complex problems.<br/>Clear solutions.</h2><p className="max-w-sm text-base leading-relaxed text-slate-600">From the first idea to a system you can actually use, we focus on technology that creates momentum.</p></div><div className="mt-12 grid gap-5 md:grid-cols-3">{offerings.map(({icon:Icon,title,detail,tags},i)=><article key={title} className="group rounded-2xl border border-slate-200 bg-white p-7 shadow-[0_12px_40px_rgba(15,23,42,0.04)] transition-all hover:-translate-y-1 hover:shadow-xl"><div className="flex items-start justify-between"><span className="flex h-13 w-13 items-center justify-center rounded-xl bg-slate-900 p-3 text-emerald-300"><Icon size={25}/></span><span className="text-xs font-bold text-slate-400">0{i+1}</span></div><h3 className="mt-8 text-2xl font-bold tracking-tight">{title}</h3><p className="mt-3 min-h-[84px] text-sm leading-relaxed text-slate-600">{detail}</p><div className="mt-6 flex flex-wrap gap-2">{tags.map(tag=><span key={tag} className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-semibold text-slate-600">{tag}</span>)}</div></article>)}</div></div></section>

        <section id="products" className="scroll-mt-20 relative overflow-hidden bg-[#0b1829] py-24 sm:py-28"><div className="pointer-events-none absolute -right-20 top-0 h-96 w-96 rounded-full bg-cyan-500/10 blur-[110px]"/><div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 sm:px-8 lg:grid-cols-2"><div><Label light>Introducing our first product</Label><div className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-200"><Sparkles size={13}/> In development</div><h2 className="mt-6 text-4xl font-extrabold tracking-[-0.045em] sm:text-5xl">Ice Pack <span className="text-cyan-300">Companion</span></h2><p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-300">An interactive streaming toolkit built to turn TikTok gifts into real gameplay moments in ARK: Survival Ascended.</p><p className="mt-4 max-w-xl leading-relaxed text-slate-400">Customize gift mappings, configure reward kits, and connect your stream to your game server through a local companion agent.</p><a className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/25 px-6 py-3 font-bold text-white transition-colors hover:border-cyan-300" href="mailto:hello@northpath.ai?subject=Ice%20Pack%20Companion%20updates">Ask about the project <ArrowUpRight size={17}/></a><p className="mt-4 text-xs text-slate-500">Early development preview. Features and availability may change.</p></div><div className="grid gap-4 sm:grid-cols-2">{features.map(({icon:Icon,title,detail})=><article key={title} className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur"><Icon size={27} className="text-cyan-300"/><h3 className="mt-5 text-lg font-bold">{title}</h3><p className="mt-2 text-sm leading-relaxed text-slate-400">{detail}</p></article>)}</div></div></section>

        <section id="approach" className="scroll-mt-20 bg-white py-24 text-slate-950 sm:py-28"><div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[0.9fr_1.1fr]"><div><Label>Our approach</Label><h2 className="mt-5 text-4xl font-extrabold leading-tight tracking-[-0.045em] sm:text-5xl">Build with purpose.<br/><span className="text-emerald-700">Move with confidence.</span></h2><p className="mt-6 max-w-lg leading-relaxed text-slate-600">We believe good technology should make life simpler, not add another layer of complexity. That means understanding the problem before choosing the tools.</p></div><div className="space-y-4">{[{icon:Compass,title:'Find the right direction',body:'Define the actual problem and the outcome that matters.'},{icon:Server,title:'Connect the important pieces',body:'Build a practical solution around the systems and workflows already in place.'},{icon:ShieldCheck,title:'Make it dependable',body:'Keep the experience clear, maintainable, and ready to grow.'}].map(({icon:Icon,title,body},i)=><div key={title} className="flex gap-5 rounded-2xl border border-slate-200 bg-slate-50 p-6"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#0d1b2b] text-emerald-300"><Icon size={23}/></div><div><p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Step 0{i+1}</p><h3 className="text-lg font-bold">{title}</h3><p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p></div></div>)}</div></div></section>

        <section id="contact" className="scroll-mt-20 relative overflow-hidden bg-gradient-to-br from-emerald-400 to-cyan-400 py-20 text-slate-950 sm:py-24"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-9 px-5 sm:px-8"><div><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-slate-800">Have something in mind?</p><h2 className="mt-4 max-w-2xl text-4xl font-extrabold tracking-[-0.05em] sm:text-5xl">Let's find a better way forward.</h2><p className="mt-4 max-w-xl text-base text-slate-800">Tell us what you're building or what's slowing you down. We'd love to hear about it.</p></div><a href="mailto:hello@northpath.ai?subject=Project%20inquiry" className="inline-flex items-center gap-3 rounded-full bg-[#081321] px-7 py-4 font-bold text-white transition-transform hover:-translate-y-0.5"><Mail size={20}/> hello@northpath.ai <ArrowUpRight size={18}/></a></div></section>
      </main>

      <footer className="border-t border-white/10 bg-[#081321] py-12"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 px-5 sm:px-8 md:flex-row md:items-center"><div><Brand light/><p className="mt-4 max-w-sm text-sm text-slate-400">Software, systems, and solutions built to move you forward.</p></div><div className="flex flex-wrap gap-5 text-sm font-medium text-slate-400">{navigation.map(item=><a key={item.href} href={item.href} className="hover:text-white">{item.label}</a>)}</div></div><div className="mx-auto mt-10 flex max-w-7xl flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 pt-7 text-xs text-slate-500 sm:px-8"><span>© {new Date().getFullYear()} Northpath. All rights reserved.</span><span>Built with intention.</span></div></footer>
    </div>
  );
}
