/** Options the cost, payment and change order forms pick from. */
export type Lookups = {
  boqLines: { id: string; label: string }[];
  subcons: { id: string; name: string }[];
  /** Claims a payment can be recorded against. */
  claims: { id: string; label: string }[];
};
