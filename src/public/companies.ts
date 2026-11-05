/**
 * The companies in the Uniq Group, Uniquem always first. Each logo is the supplied artwork on a transparent background
 * in its dark-page version (only black/grey parts turned white; built by brand-src/make_logos.py), at 1x and 2x.
 */
export type Company = { id: string; name: string; url: string; logo: { src: string; src2x: string; width: number; height: number } };
const logo = (id: string, width: number) => ({ src: `/brand/companies/${id}-dark.png`, src2x: `/brand/companies/${id}-dark@2x.png`, width, height: 60 });
export const COMPANIES: Company[] = [
  { id: "uniquem", name: "Uniquem", url: "https://uniquem.ca/", logo: logo("uniquem", 136) },
  { id: "uniqenergy", name: "UniqEnergy Solutions", url: "https://uniqenergy.com/", logo: logo("uniqenergy", 122) },
  { id: "kemko", name: "Kemko", url: "https://www.kemko.ca/", logo: logo("kemko", 194) },
  { id: "alchem", name: "Al Chem", url: "https://alchem.ca/", logo: logo("alchem", 116) }
];
