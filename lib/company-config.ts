/**
 * Company details printed in the site header and on progress claims.
 * Every value marked TODO is a placeholder: replace it with the real one.
 */
export const COMPANY = {
  name: "BTB Builders Sdn Bhd",
  cidbGrade: "G7",
  // TODO: replace with the real CIDB registration number.
  cidbRegNo: "TODO-CIDB-REG-NO",
  // TODO: replace with the real company address (one string per printed line).
  addressLines: ["TODO: Company address line 1", "TODO: Postcode, City, State"],
} as const;

/** TODO: confirm the payment terms printed on quotes and used to decide when a claim is overdue. */
export const PAYMENT_TERMS_DAYS = 30;

/** TODO: confirm how long a quotation stays valid. */
export const QUOTE_VALID_DAYS = 30;

/** TODO: replace with the company's standard quotation terms. */
export const QUOTE_TERMS = [
  "TODO: Payment terms and schedule.",
  "TODO: Exclusions and assumptions.",
];

/** TODO: replace with the name and title of whoever signs reminder letters. */
export const SIGNATORY = { name: "TODO: Authorised signatory", title: "TODO: Title" };

