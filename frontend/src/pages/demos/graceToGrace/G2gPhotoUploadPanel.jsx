import { useEffect, useRef, useState } from 'react';
import { postG2gPhotoSubmission } from './graceEstimateApi';
import { getOrCreateG2gSessionId } from './g2gSession';
import { formatOfferRange } from './displayOffer';

const MAX_PHOTOS = 12;

export default function G2gPhotoUploadPanel({
  contact,
  result,
  vehicle,
  estimatePayload,
  onSuccess,
}) {
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);

  useEffect(() => {
    return () => {
      items.forEach((it) => {
        if (it.previewUrl) URL.revokeObjectURL(it.previewUrl);
      });
    };
  }, [items]);

  const addFiles = (fileList) => {
    const next = [...items];
    for (const file of fileList) {
      if (!file.type.startsWith('image/')) continue;
      if (next.length >= MAX_PHOTOS) break;
      next.push({ file, previewUrl: URL.createObjectURL(file) });
    }
    setItems(next);
  };

  const removeAt = (idx) => {
    setItems((prev) => {
      const copy = [...prev];
      const [removed] = copy.splice(idx, 1);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return copy;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    setOk(false);
    if (!contact) {
      setErr('Contact information is missing. Refresh and try again.');
      return;
    }
    if (items.length === 0) {
      setErr('Add at least one photo.');
      return;
    }
    setBusy(true);
    try {
      await postG2gPhotoSubmission({
        leadId: contact.leadId,
        sessionId: getOrCreateG2gSessionId(),
        contact: {
          firstName: contact.firstName,
          phone: contact.phone,
          email: contact.email,
        },
        vehicle,
        estimate: estimatePayload,
        photos: items.map((it) => it.file),
      });
      setOk(true);
      setOpen(false);
      onSuccess?.();
    } catch (ex) {
      setErr(ex.message || 'Upload failed.');
    } finally {
      setBusy(false);
    }
  };

  if (ok) {
    return (
      <div className="g2g-alert g2g-alert--success g2g-mt" role="status">
        Thanks — we received your photos. Our team will review them shortly.
      </div>
    );
  }

  return (
    <div className="g2g-photo-upload g2g-mt">
      <button
        type="button"
        className="g2g-btn g2g-btn--ghost"
        onClick={() => {
          setOpen((o) => !o);
          setErr('');
        }}
      >
        {open ? 'Hide photo upload' : 'Upload vehicle photos'}
      </button>
      {open ? (
        <form className="g2g-photo-panel g2g-form g2g-mt" onSubmit={handleSubmit}>
          <p className="g2g-field-hint" style={{ margin: '0 0 0.75rem' }}>
            Add photos of the exterior, interior, damage, and odometer if you can. This helps us verify your
            estimate{formatOfferRange(result) ? ` (${formatOfferRange(result)})` : ''}.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="g2g-visually-hidden"
            onChange={(ev) => {
              addFiles(ev.target.files || []);
              ev.target.value = '';
            }}
          />
          <button
            type="button"
            className="g2g-btn g2g-btn--ghost"
            disabled={items.length >= MAX_PHOTOS}
            onClick={() => inputRef.current?.click()}
          >
            Choose photos ({items.length}/{MAX_PHOTOS})
          </button>
          {items.length > 0 ? (
            <div className="g2g-photo-previews">
              {items.map((it, idx) => (
                <div key={it.previewUrl} className="g2g-photo-preview">
                  <img src={it.previewUrl} alt="" />
                  <button type="button" className="g2g-photo-preview__remove" onClick={() => removeAt(idx)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          {err ? <div className="g2g-alert g2g-alert--error g2g-mt">{err}</div> : null}
          <button type="submit" className="g2g-btn g2g-btn--primary g2g-mt" disabled={busy}>
            {busy ? 'Uploading…' : 'Submit photos'}
          </button>
        </form>
      ) : null}
    </div>
  );
}
