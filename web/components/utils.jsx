export function chooseThumbnailUrl(thumbnails, width=Infinity) {
  if (!thumbnails || thumbnails.length == 0) return;
  if (typeof thumbnails == 'string') thumbnails = JSON.parse(thumbnails)
  var sorted = thumbnails
    .sort((thb1, thb2) => thb2.width - thb1.width);
  var filtered = sorted.filter(thb => thb.width <= width)
  if (filtered.length > 0) return filtered[0].url;
  return sorted[sorted.length - 1].url;
}

export function url(result) {
  if (result.type == 'ARTIST') return `/artist/${result.id}`;
  if (result.type == 'SONG' || result.type == 'VIDEO' || result.type == 'ALBUM') return `/player/${result.id}`;
  return '';
}

export function viewCountString(viewCount) {
  if (!viewCount) return null;
  if (Math.floor(viewCount/1e9) > 0) return `${Math.floor(viewCount/1e8)/10}Mds`
  if (Math.floor(viewCount/1e6) > 0) return `${Math.floor(viewCount/1e5)/10}M`
  if (Math.floor(viewCount/1e3) > 0) return `${Math.floor(viewCount/1e2)/10}k`
  return viewCount.toString()
}

export function durationString(duration) {
  if (!duration) return null;
  duration = Math.floor(duration);
  const pad = (i, w, s) => (s.length < i) ? pad(i, w, w + s) : s;
  return Math.floor(duration / 60) + ':' + pad(2, '0', (duration%60).toString())
}