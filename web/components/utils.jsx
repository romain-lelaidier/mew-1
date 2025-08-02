import { A, useNavigate } from "@solidjs/router";

export function chooseThumbnailUrl(thumbnails, width=Infinity) {
  if (!thumbnails || thumbnails.length == 0) return;
  if (typeof thumbnails == 'string') thumbnails = JSON.parse(thumbnails)
  var sorted = thumbnails
    .sort((thb1, thb2) => thb2.width - thb1.width);
  var filtered = sorted.filter(thb => thb.width <= width)
  if (filtered.length > 0) return filtered[0].url;
  return sorted[sorted.length - 1].url;
}

export function timeAgo(date) {
  if (typeof date == 'object') date = new Date(date);
  const seconds = Math.floor((new Date() - date) / 1000);

  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60,
    second: 1
  };

  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInUnit);
    if (interval >= 1) {
      return interval === 1 ? `${interval} ${unit} ago` : `${interval} ${unit}s ago`;
    }
  }

  return 'just now';
}

export function is2xx(res) {
  return Math.floor(res.status / 100) == 2;
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

export function RoundButton(props) {
  return (
    <span class="w-fit rounded-md block bg-b text-white px-3 py-1 cursor-pointer" onclick={props.onclick}>{props.text}</span>
  )
}

export function LinkButton(props) {
  // const classes = "w-fit rounded-md px-1 py-0.5 bg-white/10 cursor-pointer";
  const classes = "w-fit underline cursor-pointer";
  const text = props.text || props.children || 'here'
  if (props.href) {
    return <A href={props.href} class={classes}>{text}</A>
  }
  if (props.onclick || props.onClick) {
    return <span onclick={(props.onclick || props.onClick)} class={classes}>{text}</span>
  }
}