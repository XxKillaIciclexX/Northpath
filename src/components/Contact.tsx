import { Mail, Phone, MapPin } from 'lucide-react';

export default function Contact() {
  return (
    <section id="contact" className="bg-slate-900 py-20 text-white">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Let's build something useful.</h2>
          <p className="mx-auto max-w-2xl text-lg text-slate-300">
            Tell us what you're working on. We build software, integrations, and automation to solve real problems.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <a href="mailto:hello@northpath.ai" className="rounded-xl border border-slate-700 bg-slate-800 p-6 hover:border-cyan-500">
            <Mail className="mb-4 text-cyan-400" size={26} />
            <h3 className="mb-2 font-semibold">Email</h3>
            <p className="text-slate-300">hello@northpath.ai</p>
          </a>
          <a href="tel:+16039135709" className="rounded-xl border border-slate-700 bg-slate-800 p-6 hover:border-cyan-500">
            <Phone className="mb-4 text-cyan-400" size={26} />
            <h3 className="mb-2 font-semibold">Phone</h3>
            <p className="text-slate-300">(603) 913-5709</p>
          </a>
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-6">
            <MapPin className="mb-4 text-cyan-400" size={26} />
            <h3 className="mb-2 font-semibold">Location</h3>
            <p className="text-slate-300">Bedford, New Hampshire</p>
          </div>
        </div>
        <p className="mt-8 text-center text-sm text-slate-400">Online inquiry forms will return when the new database is configured. For now, please contact us directly.</p>
      </div>
    </section>
  );
}
