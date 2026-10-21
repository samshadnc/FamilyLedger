import { useState } from 'react';
import { getBankBrand } from '../constants';

/**
 * Shows the bank's real logo; falls back to brand-colored initials if the image fails.
 * size: 'chip' (tiny logo inside a pill chip, no shadow box)
 *       'sm'   (small standalone badge, 20×20)
 *       'md'   (analytics rows, 36×36, default)
 */
export default function BankBadge({ label = '', size = 'md' }) {
  const brand = getBankBrand(label);
  const [imgOk, setImgOk] = useState(!!brand.logo);

  if (size === 'chip') {
    // Inline inside a colored pill — just the logo image, no wrapper box
    if (brand.logo && imgOk) {
      return (
        <img
          src={brand.logo}
          alt={label}
          className="w-4 h-4 object-contain rounded flex-shrink-0 bg-white"
          onError={() => setImgOk(false)}
        />
      );
    }
    return null; // chip already shows the name as text
  }

  const dim = size === 'sm' ? 'w-5 h-5 rounded-lg text-[9px]' : 'w-9 h-9 rounded-xl text-[11px]';

  if (brand.logo && imgOk) {
    return (
      <div
        className={`${dim} flex items-center justify-center flex-shrink-0 overflow-hidden bg-white`}
        style={{ boxShadow: `0 1px 4px ${brand.ring}44` }}
      >
        <img
          src={brand.logo}
          alt={label}
          className="w-full h-full object-contain p-0.5"
          onError={() => setImgOk(false)}
        />
      </div>
    );
  }

  return (
    <div
      className={`${dim} flex items-center justify-center flex-shrink-0 font-bold tracking-wide`}
      style={{ background: brand.bg, color: brand.text, boxShadow: `0 2px 6px ${brand.ring}55` }}
    >
      {brand.abbr}
    </div>
  );
}
