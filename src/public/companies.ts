/** The companies in the Uniq Group. Only Uniquem has a logo file today; the others show their names until real logos are added. Never alter a logo. */
export type Company = { id: string; name: string; logo?: { src: string; width: number; height: number }; blurb?: string; url?: string };
export const COMPANIES: Company[] = [
  { id: "uniquem", name: "Uniquem", logo: { src: "/brand/uniquem-logo-light.png", width: 2796, height: 1398 }, blurb: "Oilfield chemical solutions for exploration and production.", url: "https://uniquem.ca" },
  { id: "uniqenergy", name: "UniqEnergy Solutions" },
  { id: "kemko", name: "Kemko" },
  { id: "alchem", name: "Al Chem" }
];
