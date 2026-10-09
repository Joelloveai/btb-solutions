import { getServerSession } from "next-auth";
import { cache } from "react";
import { authOptions } from "./auth";
import { isLocale, translations, type Locale } from "./i18n";
import { prisma } from "./prisma";

/** The signed-in user's saved language; "en" for anyone else (e.g. the login page). */
export const getLocale = cache(async (): Promise<Locale> => {
  const email = (await getServerSession(authOptions))?.user?.email;
  if (!email) return "en";
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { locale: true },
  });
  return isLocale(user?.locale) ? user.locale : "en";
});

export async function getT() {
  const locale = await getLocale();
  return { locale, t: translations[locale] };
}
