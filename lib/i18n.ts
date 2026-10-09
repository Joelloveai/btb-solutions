export const LOCALES = ["en", "ms"] as const;
export type Locale = (typeof LOCALES)[number];

export const translations = {
  en: {
    dashboard: "Dashboard",
    quotes: "Quotes",
    receivables: "Receivables",
    subcons: "Subcons",
    clients: "Clients",
    projects: "Projects",
    costs: "Costs",
    payments: "Payments",
    changeOrders: "Change Orders",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    logout: "Logout",
    settings: "Settings",
    language: "Language",
    exportAllData: "Export All Data",
  },
  ms: {
    dashboard: "Papan Pemuka",
    quotes: "Sebut Harga",
    receivables: "Akaun Belum Terima",
    subcons: "Subkontraktor",
    clients: "Pelanggan",
    projects: "Projek",
    costs: "Kos",
    payments: "Bayaran",
    changeOrders: "Perintah Perubahan",
    save: "Simpan",
    cancel: "Batal",
    delete: "Padam",
    logout: "Log Keluar",
    settings: "Tetapan",
    language: "Bahasa",
    exportAllData: "Eksport Semua Data",
  },
} as const satisfies Record<Locale, Record<string, string>>;

export type Translations = Record<keyof (typeof translations)["en"], string>;

export const isLocale = (value: unknown): value is Locale =>
  typeof value === "string" && (LOCALES as readonly string[]).includes(value);
