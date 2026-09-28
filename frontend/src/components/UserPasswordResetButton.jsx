import { useState } from 'react';
import { api } from '../api/client';

export default function UserPasswordResetButton({ userId, userEmail, disabled }) {
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!window.confirm(`Reset password for ${userEmail} and email a temporary password?`)) return;
    setLoading(true);
    try {
      const result = await api.post(`/admin/users/${userId}/reset-password`, { sendEmail: true });
      if (result.temporaryPassword) {
        alert(`Email may have failed. Temporary password (copy now):\n\n${result.temporaryPassword}`);
      } else {
        alert(`Password reset. Email sent to ${result.email}.`);
      }
    } catch (err) {
      alert(err.message || 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      disabled={disabled || loading}
      onClick={handleReset}
    >
      {loading ? 'Resetting…' : 'Reset password'}
    </button>
  );
}
