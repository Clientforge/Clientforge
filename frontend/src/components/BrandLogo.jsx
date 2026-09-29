/** Official flame mark — replace with /brand/mark.svg when designer delivers SVG. */
const MARK_SRC = '/brand/mark.png';

const SIZES = {
  sm: { mark: 24, text: 14 },
  md: { mark: 32, text: 16 },
  lg: { mark: 48, text: 20 },
};

export default function BrandLogo({
  variant = 'lockup',
  size = 'md',
  suffix = null,
  className = '',
}) {
  const { mark: markPx, text: textPx } = SIZES[size] || SIZES.md;
  const showWordmark = variant === 'lockup' || variant === 'wordmark';

  return (
    <span
      className={`brand-logo brand-logo--${variant} brand-logo--${size} ${className}`.trim()}
      aria-label={suffix ? `ClientForge AI ${suffix}` : 'ClientForge AI'}
    >
      {(variant === 'lockup' || variant === 'mark') && (
        <img
          src={MARK_SRC}
          alt=""
          className="brand-logo__mark"
          width={markPx}
          height={markPx}
          decoding="async"
        />
      )}
      {showWordmark && (
        <span className="brand-logo__text" style={{ fontSize: textPx }}>
          ClientForge
          <span className="brand-ai"> AI</span>
        </span>
      )}
      {suffix != null && suffix !== '' && (
        <span className={`brand-logo__suffix ${suffix === 'Admin' ? 'brand-admin' : ''}`}>{suffix}</span>
      )}
    </span>
  );
}
