import { A, useLocation, useNavigate } from "@solidjs/router";
import { Icon } from "./icons";

export const mds = " · ";

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


export function Link(props) {
  const location = useLocation();
  return <A state={{ previous: location.pathname }} {...props} />;
}

export function BackButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const backPath = () => (location.state?.previous ? -1 : '/');
  return <button class="uppercase flex flex-row gap-1 items-center cursor-pointer text-base" onClick={() => navigate(backPath())}><Icon type="arrow-left" size={1}/><span class="pt-[0.8]">back</span></button>;
}

export function LinkButton(props) {
  const classes = "w-fit font-bold cursor-pointer";
  const text = props.text || props.children || 'here'
  if (props.href) {
    return <Link href={props.href} class={classes}>{text}</Link>
  }
  if (props.onclick || props.onClick) {
    return <span onclick={(props.onclick || props.onClick)} class={classes}>{text}</span>
  }
}

export function LinkIcon(props) {
  return (
    <Link {...props} class="flex flex-row items-center gap-1 font-bold"><Icon type={props.type}/>{props.text}</Link>
  )
}

export function User(props) {
  return (
    // <LinkIcon type="dna" text={props.user.name} href={"/profile/" + props.user.name}/>
    <Link class="inline flex flex-row gap-1" href={"/profile/" + props.user.name}>
      <Show when={props.user.iso}>
        <Flag iso={props.user.iso}/>
        <span> </span>
      </Show>
      {/* <Icon type="dna"/>
      <span> </span> */}
      <span class="font-bold">{props.user.name}</span>
    </Link>
  )
}