/** The companies in the Uniq Group. Logos are used exactly as supplied (never altered); a company without its own logo file shows its name. */
export type Logo = { src: string; width: number; height: number };
export type Company = { id: string; name: string; logo?: Logo; url?: string };
export const COMPANIES: Company[] = [
  { id: "uniquem", name: "Uniquem", url: "https://uniquem.ca" },
  { id: "uniqenergy", name: "UniqEnergy Solutions", logo: { src: "/brand/uniqenergy-solutions-logo-640.webp", width: 640, height: 320 } },
  { id: "kemko", name: "Kemko" },
  { id: "alchem", name: "Al Chem" }
];
