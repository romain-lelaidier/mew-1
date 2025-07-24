import { For, Match, Switch } from "solid-js";

export const mds = ' · ';

export function SearchResults(props) {
  console.log(props.results.length)
  if (props.results.length == 0) return (
    <div>
      No results.
    </div>
  )

  const sortedResults = [];
  var latestType = props.results[0].type;
  var latestTypeResults = [];
  for (const result of props.results) {
    if (result.type == latestType) {
      latestTypeResults.push(result);
    } else {
      sortedResults.push({
        type: latestType,
        results: latestTypeResults
      });
      latestType = result.type;
      latestTypeResults = [ result ];
    }
  }
  sortedResults.push({
    type: latestType,
    results: latestTypeResults
  });

  return (
    <div class="flex flex-col gap-2">
      <For each={sortedResults}>{(resultGroup, i) => 
        <SearchResultGroup group={resultGroup} />
      }</For>
    </div>
  );
}

function SearchResultGroup(props) {
  const group = props.group;
  console.log(group)

  if (group.type == 'VIDEO' || group.type == 'SONG') {
    return (
      <div class="flex flex-col gap-1">
        <h3 class="text-xl font-bold">Songs</h3>
        <div class="flex flex-col leading-[1.2]">
          <For each={group.results}>{(result, j) =>
            <div class="flex flex-row gap-1 hover:bg-white/10 p-1 rounded-sm items-center">
              <img loading="lazy" class="h-16 rounded-sm" src={chooseThumbnailUrl(result.thumbnails, 100)} />
              <div>
                <span class="font-bold">{result.title}</span>
                <AggregateSpans strs={[
                  [result.artist],
                  [result.album, "italic"]
                ]} sep={mds} bf={<br/>} />
                <AggregateSpans strs={[
                  [durationString(result.duration)]
                ]} sep={mds} bf={<br/>} />
              </div>
            </div>
          }</For>
        </div>
      </div>
    )
  }

  if (group.type == 'ALBUM') {
    return (
      <div class="flex flex-col gap-1">
        <h3 class="text-xl font-bold">Albums</h3>
        <div class="flex flex-row no-scrollbar leading-none overflow-scroll">
          <For each={group.results}>{(result, j) =>
            <div class="shrink-0 flex flex-col max-w-32 gap-1 hover:bg-white/10 p-1 rounded-sm items-center">
              <img loading="lazy" class="h-30 rounded-sm" src={chooseThumbnailUrl(result.thumbnails, 120)} />
              <div class="flex flex-col gap-1 items-center">
                <AggregateSpans strs={[
                  [result.title, "font-bold text-center"],
                  [result.artist],
                  [result.year, "opacity-80"]
                ]} sep={''} />
              </div>
            </div>
          }</For>
        </div>
      </div>
    )
  }

  if (group.type == 'ARTIST') {
    return (
      <div class="flex flex-col gap-1">
        <h3 class="text-xl font-bold">Artists</h3>
        <div class="flex flex-row no-scrollbar leading-none overflow-scroll">
          <For each={group.results}>{(result, j) =>
            <div class="shrink-0 flex flex-col max-w-32 gap-1 hover:bg-white/10 p-1 rounded-sm items-center">
              <img loading="lazy" class="h-30 rounded-full" src={chooseThumbnailUrl(result.thumbnails, 120)} />
              <div class="flex flex-col gap-1 items-center">
                <AggregateSpans strs={[
                  [result.title, "font-bold text-center"]
                ]} sep={''} />
              </div>
            </div>
          }</For>
        </div>
      </div>
    )
  }

  if (group.type == 'PLAYLIST') {
    return (
      <div class="flex flex-col gap-1">
        <h3 class="text-xl font-bold">Playlists</h3>
        <div class="flex flex-row no-scrollbar leading-none overflow-scroll">
          <For each={group.results}>{(result, j) =>
            <div class="shrink-0 flex flex-col max-w-32 gap-1 hover:bg-white/10 p-1 rounded-sm items-center">
              <img loading="lazy" class="h-30 rounded-sm" src={chooseThumbnailUrl(result.thumbnails, 120)} />
              <div class="flex flex-col gap-1 items-center">
                <AggregateSpans strs={[
                  [result.title, "font-bold text-center"],
                  [result.artist],
                  [result.year, "opacity-80"]
                ]} sep={''} />
              </div>
            </div>
          }</For>
        </div>
      </div>
    )
  }

  return (
    <div>Not implemented ({group.type})</div>
  )
}

function durationString(duration) {
  if (!duration) return null;
  const pad = (i, w, s) => (s.length < i) ? pad(i, w, w + s) : s;
  return Math.floor(duration / 60) + ':' + pad(2, '0', (duration%60).toString())
}

function AggregateSpans(props) {
  var strs = props.strs.filter(element => element != null && element[0] != null);
  if (strs.length == 0) return (<></>);
  return (
    <>
      {props.bf}
      <For each={strs}>{([text, classes], i) =>
        <>
          <Show when={i() > 0}>{props.sep}</Show>
          <span class={classes}>{text}</span>
        </>
      }</For>
    </>
  )
}

function chooseThumbnailUrl(thumbnails, width=Infinity) {
  if (thumbnails.length == 0) return;
  var sorted = thumbnails
    .sort((thb1, thb2) => thb2.width - thb1.width);
  var filtered = sorted.filter(thb => thb.width <= width)
  if (filtered.length > 0) return filtered[0].url;
  return sorted[sorted.length - 1].url;
}