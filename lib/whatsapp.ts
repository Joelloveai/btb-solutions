/**
 * Turns a Malaysian phone number typed any way ("012-345 6789", "+60 12 345 6789") into the
 * international digits wa.me needs ("60123456789"). Returns null when there is no usable number.
 */
export function whatsappNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `60${digits.slice(1)}`;
  return digits.length >= 9 && digits.length <= 15 ? digits : null;
}

/** A wa.me link with a ready-to-send reminder. The contractor taps send; nothing is sent from the server. */
export function reminderLink(input: { phone: string | null | undefined; name: string; task: string; project: string; due: string; appUrl: string }) {
  const number = whatsappNumber(input.phone);
  if (!number) return null;
  const text = `Hi ${input.name}, a reminder from BTB Builders: "${input.task}" for ${input.project} is due ${input.due}. Please update it here when done: ${input.appUrl}/sub/tasks`;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
