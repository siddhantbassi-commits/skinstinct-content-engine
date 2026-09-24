import { XMLParser } from "fast-xml-parser";

export interface NewsItem {
  headline: string;
  source: string;
  date: string;
  url: string;
  summary: string;
}

// Google News RSS — no account, no key. https://news.google.com/rss/search?q=...
export async function fetchTopNews(searchPhrase: string): Promise<NewsItem | null> {
  const query = encodeURIComponent(searchPhrase);
  const url = `https://news.google.com/rss/search?q=${query}&hl=en-IN&gl=IN&ceid=IN:en`;

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; SkinstinctContentEngine/1.0)" },
  });
  if (!res.ok) return null;

  const xml = await res.text();
  const parser = new XMLParser({ ignoreAttributes: false });
  const parsed = parser.parse(xml);

  const items = parsed?.rss?.channel?.item;
  const first = Array.isArray(items) ? items[0] : items;
  if (!first) return null;

  const title: string = String(first.title ?? "").trim();
  // Google News titles are usually "Headline - Source"
  const lastDash = title.lastIndexOf(" - ");
  const headline = lastDash > -1 ? title.slice(0, lastDash) : title;
  const source =
    (typeof first.source === "object" ? first.source?.["#text"] : first.source) ||
    (lastDash > -1 ? title.slice(lastDash + 3) : "Unknown source");

  const description: string = String(first.description ?? "").replace(/<[^>]+>/g, "").trim();

  return {
    headline,
    source: String(source).trim(),
    date: String(first.pubDate ?? "").trim(),
    url: String(first.link ?? "").trim(),
    summary: description.slice(0, 300),
  };
}
