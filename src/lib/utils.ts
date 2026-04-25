export function segmentChineseText(text: string): string[] {
  try {
    const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' });
    const segments = Array.from(segmenter.segment(text));
    return segments.map(s => s.segment);
  } catch (e) {
    console.error("Intl.Segmenter not supported for zh-CN. Falling back to char-by-char", e);
    // Fallback to character by character if segmenter fails (should not happen on modern browsers)
    return Array.from(text);
  }
}

export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}
