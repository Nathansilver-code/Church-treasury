import { Route, Routes } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import AuditLog from "./pages/AuditLog";
import Items from "./pages/Items";
import NewReceipt from "./pages/NewReceipt";
import Receipts from "./pages/Receipts";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Statements from "./pages/Statements";

export default function App() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="min-w-0 flex-1 p-8">
        <Routes>
          <Route path="/" element={<NewReceipt />} />
          <Route path="/receipts" element={<Receipts />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/statements" element={<Statements />} />
          <Route path="/items" element={<Items />} />
          <Route path="/audit" element={<AuditLog />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}
