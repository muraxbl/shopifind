export type AssetProbe = {
  status: number | null;
  contentType?: string | null;
  title?: string | null;
};

export type CatalogHealth = {
  publishable: boolean;
  reasons: string[];
  warnings: string[];
};

const PLACEHOLDER_IMAGE_HOSTS = new Set([
  "placehold.co",
  "via.placeholder.com",
]);

export function isPlaceholderImageUrl(value: string): boolean {
  try {
    return PLACEHOLDER_IMAGE_HOSTS.has(new URL(value).hostname.toLowerCase());
  } catch {
    return true;
  }
}

export function classifyCatalogHealth(input: {
  imageUrl: string;
  source: AssetProbe;
  image: AssetProbe | null;
}): CatalogHealth {
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (input.source.status === null) {
    warnings.push("source-unreachable");
  } else if ([404, 410, 451].includes(input.source.status)) {
    reasons.push(`source-http-${input.source.status}`);
  } else if (input.source.status === 401 || input.source.status === 403) {
    warnings.push(`source-http-${input.source.status}`);
  } else if (input.source.status < 200 || input.source.status >= 400) {
    warnings.push(`source-http-${input.source.status}`);
  }

  if (/\b(?:404|not found|page not found)\b/i.test(input.source.title ?? "")) {
    reasons.push("source-not-found-page");
  }

  if (isPlaceholderImageUrl(input.imageUrl)) {
    reasons.push("placeholder-image");
  } else if (!input.image || input.image.status === null) {
    reasons.push("image-unreachable");
  } else if (input.image.status < 200 || input.image.status >= 400) {
    reasons.push(`image-http-${input.image.status}`);
  } else if (
    !(input.image.contentType ?? "").toLowerCase().startsWith("image/")
  ) {
    reasons.push("image-content-type");
  }

  return {
    publishable: reasons.length === 0,
    reasons: [...new Set(reasons)],
    warnings: [...new Set(warnings)],
  };
}
