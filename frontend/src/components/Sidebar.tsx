import { NavLink } from "react-router-dom";
import { BarChart3, FilePlus2, History, ListTree, Receipt, Settings, UserRound, type LucideIcon } from "lucide-react";

const tabs: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/", label: "New receipt", icon: FilePlus2 },
  { to: "/receipts", label: "Receipts", icon: Receipt },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/statements", label: "Person statements", icon: UserRound },
  { to: "/items", label: "Items and sub-groups", icon: ListTree },
  { to: "/audit", label: "Audit log and deleted", icon: History },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  return (
    <aside className="w-64 shrink-0 bg-white border-r border-line flex flex-col">
      <div className="px-6 pt-7 pb-6 border-b border-line">
        <img src="./logo.png" alt="Church logo" className="h-16 w-16" />
        <p className="mt-3 font-semibold text-brand leading-tight">Church Treasury</p>
      </div>
      <nav className="flex-1 p-3 space-y-1" aria-label="Main">
        {tabs.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              "flex items-center gap-3 rounded-md px-3 py-2.5 text-[0.95rem] border-l-4 " +
              (isActive
                ? "bg-brand-tint text-brand font-medium border-brand"
                : "text-ink border-transparent hover:bg-surface")
            }
          >
            <Icon size={18} aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
