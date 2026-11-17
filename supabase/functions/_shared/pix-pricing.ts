// Calculate in cents so the service fee is rounded once, to the nearest cent.
export function pixPricing(amount: number) {
  const creditCents = Math.round(amount * 100)
  const feeCents = Math.round(creditCents / 100)
  return { serviceFee: feeCents / 100, chargedAmount: (creditCents + feeCents) / 100 }
}
