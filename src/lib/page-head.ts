/** Leaf pages own their metadata; private health data never appears in previews. */
export function covePageHead(label: string, description: string) {
  const title = `${label} — Cove`;
  return { meta: [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] };
}