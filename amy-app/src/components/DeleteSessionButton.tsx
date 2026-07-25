import { useState } from "react";
import { Trash2 } from "lucide-react";
import { amyFetch } from "@/lib/api";

export function DeleteSessionButton({
  sessionId,
  onDeleted,
}: {
  sessionId: string;
  onDeleted?: () => void;
}) {
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this session? Authorization units will be restored.")) return;
    setLoading(true);
    await amyFetch(`/sessions/${sessionId}`, { method: "DELETE" });
    onDeleted?.();
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="text-slate-400 hover:text-red-600 transition-colors"
      title="Delete session"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
