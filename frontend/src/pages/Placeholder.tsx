import type { LucideIcon } from "lucide-react";

export default function Placeholder({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <section className="max-w-xl">
      <h1 className="text-2xl font-semibold text-brand">{title}</h1>
      <div className="mt-6 rounded-lg border border-dashed border-line bg-white p-8 text-center">
        <Icon size={32} className="mx-auto text-muted" aria-hidden />
        <p className="mt-3 text-muted">{text}</p>
      </div>
    </section>
  );
}
