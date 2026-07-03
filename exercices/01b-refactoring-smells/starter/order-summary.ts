// order-summary.ts — fonctionne, mais accumule les smells.
// Ta mission : le refactorer SANS changer une seule sortie.
// Montants en centimes (entiers). Les tests de order-summary.test.ts sont ton filet.

export type Item = {
  sku: string;
  label: string;
  price: number; // centimes
  qty: number;
  weight: number; // grammes, unitaire
};

export function buildOrderSummary(
  customerType: string,
  country: string,
  street: string,
  city: string,
  zip: string,
  items: Item[],
): string {
  // --- sous-total ---
  let subtotal = 0;
  for (const it of items) {
    subtotal += it.price * it.qty;
  }

  // --- remise selon le type de client ---
  let discount = 0;
  switch (customerType) {
    case 'vip':
      discount = subtotal * 0.15;
      break;
    case 'gold':
      discount = subtotal * 0.1;
      break;
    case 'silver':
      discount = subtotal * 0.05;
      break;
    case 'standard':
      discount = 0;
      break;
    default:
      throw new Error('unknown customer type');
  }
  const afterDiscount = subtotal - discount;

  // --- frais de port selon poids + pays ---
  let totalWeight = 0;
  for (const it of items) {
    totalWeight += it.weight * it.qty;
  }
  let shipping = 0;
  if (country === 'FR') {
    if (totalWeight > 10000) shipping = 1500;
    else if (totalWeight > 2000) shipping = 900;
    else shipping = 490;
  } else if (country === 'BE' || country === 'DE' || country === 'ES') {
    if (totalWeight > 10000) shipping = 3000;
    else if (totalWeight > 2000) shipping = 1900;
    else shipping = 990;
  } else {
    if (totalWeight > 10000) shipping = 6000;
    else if (totalWeight > 2000) shipping = 3900;
    else shipping = 1990;
  }
  // livraison offerte au-dessus de 15000
  if (afterDiscount > 15000) shipping = 0;

  // --- TVA selon pays ---
  let vatRate = 0;
  if (country === 'FR') vatRate = 0.2;
  else if (country === 'BE') vatRate = 0.21;
  else if (country === 'DE') vatRate = 0.19;
  else if (country === 'ES') vatRate = 0.21;
  else vatRate = 0;
  const vat = (afterDiscount + shipping) * vatRate;

  const total = afterDiscount + shipping + vat;

  // --- rendu texte ---
  let out = '';
  out += `Livraison: ${street}, ${zip} ${city} (${country})\n`;
  for (const it of items) {
    out += `  ${it.label} x${it.qty} = ${(it.price * it.qty) / 100}€\n`;
  }
  out += `Sous-total: ${subtotal / 100}€\n`;
  out += `Remise: -${discount / 100}€\n`;
  out += `Frais de port: ${shipping / 100}€\n`;
  out += `TVA: ${vat / 100}€\n`;
  out += `Total: ${total / 100}€\n`;
  return out;
}
