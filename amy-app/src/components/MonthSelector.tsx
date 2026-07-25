import { useNavigate, useSearchParams } from "react-router-dom";
import { format } from "date-fns";

export function MonthSelector() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const now = new Date();
  const year = parseInt(searchParams.get("year") ?? String(now.getFullYear()), 10);
  const month = parseInt(searchParams.get("month") ?? String(now.getMonth()), 10);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const [y, m] = e.target.value.split("-").map(Number);
    navigate(`/rbt?year=${y}&month=${m - 1}`);
  }

  const value = `${year}-${String(month + 1).padStart(2, "0")}`;

  return (
    <div className="flex items-center gap-3">
      <label htmlFor="month-select" className="text-sm font-medium text-slate-700">
        Viewing month:
      </label>
      <input
        id="month-select"
        type="month"
        value={value}
        onChange={handleChange}
        className="input-field w-auto"
      />
      <span className="text-sm text-slate-500">{format(new Date(year, month), "MMMM yyyy")}</span>
    </div>
  );
}
