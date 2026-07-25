import { useNavigate } from "react-router-dom";

export function CaseNotesSearch({
  clients,
  currentClientId,
  currentSearch,
}: {
  clients: { id: string; firstName: string; lastName: string }[];
  currentClientId?: string;
  currentSearch?: string;
}) {
  const navigate = useNavigate();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const params = new URLSearchParams();
    const clientId = form.get("clientId") as string;
    const search = form.get("search") as string;
    if (clientId) params.set("clientId", clientId);
    if (search) params.set("search", search);
    navigate(`/notes?${params.toString()}`);
  }

  return (
    <form onSubmit={handleSubmit} className="card flex flex-wrap items-end gap-4 p-4">
      <div className="flex-1 min-w-[200px]">
        <label className="label-field" htmlFor="search">
          Search notes
        </label>
        <input
          id="search"
          name="search"
          defaultValue={currentSearch ?? ""}
          placeholder="Search by title or content..."
          className="input-field"
        />
      </div>
      <div className="min-w-[180px]">
        <label className="label-field" htmlFor="clientId">
          Filter by client
        </label>
        <select id="clientId" name="clientId" defaultValue={currentClientId ?? ""} className="input-field">
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.firstName} {c.lastName}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className="btn-primary">
        Search
      </button>
    </form>
  );
}
