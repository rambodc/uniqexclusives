/** The companies in the Uniq Group. Logos are used exactly as supplied (never altered); a company without a logo file shows its name. */
export type Logo = { src: string; width: number; height: number; /** Show the company name beside a mark-only logo. */ withName?: boolean };
export type Company = { id: string; name: string; logo?: Logo; blurb?: string; url?: string };
export const COMPANIES: Company[] = [
  // uniquem.ca shows this mark next to the Uniquem name.
  { id: "uniquem", name: "Uniquem", logo: { src: "/brand/uniquem-mark-180.png", width: 180, height: 180, withName: true }, blurb: "Oilfield chemical solutions for exploration and production.", url: "https://uniquem.ca" },
  { id: "uniqenergy", name: "UniqEnergy Solutions", logo: { src: "/brand/uniqenergy-solutions-logo.png", width: 2796, height: 1398 } },
  { id: "kemko", name: "Kemko" },
  { id: "alchem", name: "Al Chem" }
];
