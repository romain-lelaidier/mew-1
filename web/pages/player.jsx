import { useNavigate, useParams, useSearchParams, A } from "@solidjs/router";
import { createAudio } from "@solid-primitives/audio";
import { Show, createSignal, createEffect, onMount } from 'solid-js';
import { MetaProvider, Title } from "@solidjs/meta";

import SearchBar from "../components/searchbar";
import { QueueResults } from '../components/results';
import { chooseThumbnailUrl, durationString, url } from "../components/utils";
import { createStore } from "solid-js/store";
import ColorThief from "colorthief";
import { BackButton } from "../components/backbutton";

class Player {

  constructor(id, params) {
    [ this.s, this.setS ] = createStore({
      get current() {
        return this.queue[this.i]
      },
      get next() {
        return this.queue[this.inext]
      },
      get url() {
        return this.queue[this.i]?.stream?.url
      },
    });

    [ this.stream, this.setStream ] = createSignal(null);
    [ this.playing, this.setPlaying ] = createSignal(false);
    [ this.audio, this.controls ] = createAudio(this.stream, this.playing);
    [ this.requestAutoplay, this.setRequestAutoplay ] = createSignal(false);

    [ this.canSkip, this.setCanSkip ] = createSignal(true);

    this.restart(id, params);

    this.actions = {
      playPause: () => {
        this.setPlaying(playing => !playing);
      },
      next: (right = true) => {
        this.controls.pause();
        let delta = right ? 1 : -1;
        let newi = this.s.i + delta;
        if (newi < 0 || newi >= this.s.queue.length) return;
        this.setS("i", newi);
        this.setS("inext", newi + delta);
        this.prepare().then(() => {
          this.tryPlay()
        });
      },
      jump: i => {
        if (i < 0 || i >= this.s.queue.length) return;
        this.controls.pause();
        this.setS("i", i);
        this.setS("inext", i + 1);
        this.prepare().then(() => {
          this.tryPlay()
        });
      }
    }

    createEffect(() => {
      if (this.audio.state == 'complete' && this.canSkip()) {
        this.setCanSkip(false);
        this.setStream(null);
        this.actions.next();
      }
      if (this.audio.state != 'complete') {
        this.setCanSkip(true);
      }
      if (this.audio.state == 'error') {
        const code = this.audio.player.networkState;
        if (code == 1) {
          this.setPlaying(false);
          this.setRequestAutoplay(true);
          var clicked = false;
          window.addEventListener("click", () => {
            if (!clicked) {
              this.setRequestAutoplay(false);
              this.setPlaying(true);
            }
            clicked = true;
          })
          return;
        }
        this.setS("queue", this.s.i, "error", code);
        console.log('audio error: networkState = ' + code);
      }
    })

    window.addEventListener("keydown", e => {
      if (e.target == document.body || e.target.id == "pslider") {
        if (e.keyCode == 32) {  // space bar
          e.preventDefault()
          this.actions.playPause();
        }
        else if (e.key == "n") this.actions.next();
        else if (e.key == "b") this.actions.next(false);
      }
    });
  }

  restart(id, params={}) {
    if (this.s?.info?.id == id) return;

    this.setS({
      loaded: false,
      info: {
        id,
        qid: params.qid,
        issong: id.length == 11
      },

      queue: [],
      i: -1,
      inext: -1,
      get current() {
        return this.queue[this.i]
      },
      get next() {
        return this.queue[this.inext]
      },
      get url() {
        return this.queue[this.i]?.stream?.url
      },
    });

    this.setStream(null)
    this.setPlaying(false);
    this.setCanSkip(true);

    this.firstFetch().then(() => {
      this.prepare().then(() => {
        this.tryPlay()
      });
    })
  }

  appendToQueue(nqueue) {
    this.setS("queue", queue => [
      ...queue,
      ...nqueue.map(video => {
        return {
          id: video.id,
          type: video.type,
          queueId: video.queueId,
          title: video.title,
          artistId: video.artistId,
          artist: video.artist,
          album: video.album,
          albumId: video.albumId,
          thumbnails: JSON.stringify(video.thumbnails),
          stream: video.stream,
          index: video.index,
          duration: video.duration
        }
      })
    ]);
  }

  async firstFetch() {
    if (this.s.info.issong) {
      var url = `${window.location.origin}/api/video/${this.s.info.id}`;
      if (this.s.info.qid) url += '?qid=' + this.s.info.qid;
      const response = await fetch(url);
      const { video, queue } = await response.json();
      if (queue.length == 0 || queue[0].id != video.id) {
        queue.unshift(video);
      }
      this.setS("i", i => 0);
      this.setS("inext", i => 1);
      this.appendToQueue(queue);
      this.setS("loaded", l => true);
    } else {
      var url = `${window.location.origin}/api/album/${this.s.info.id}`;
      const response = await fetch(url);
      const result = await response.json();
      const queue = result.songs;
      for (let i = 0; i < queue.length; i++) {
        queue[i].index = i+1;
        queue[i].type = 'SONG'
      }
      this.setS("info", info => {
        return {
          ...info,
          artist: result.artist,
          artistId: result.artistId,
          thumbnails: JSON.stringify(result.thumbnails),
          title: result.title
        }
      })
      this.setS("i", i => 0);
      this.setS("inext", i => 1);
      this.appendToQueue(result.songs);
      this.setS("loaded", l => true);
    }
  }

  async prepare() {
    // recursively retries to prepare current and next songs stream urls.
    // this implies fetching more of the current queue if the end is reached.

    var i, wq = false;

    if (!this.s.current) {
      return alert("current is not in queue");
    }

    if (!this.s.current.stream) {
      // extract current
      i = this.s.i;
      if (i == this.s.current.length && this.s.info.issong) {
        wq = true
      }
    }

    if (i == undefined) {
      // extract next
      if (this.s.next) {
        if (!this.s.next.stream) {
          // extract next
          i = this.s.inext;
          if (!this.s.queue[i] && this.s.info.issong) {
            wq = true;
          }
        }
      } else if (this.s.inext > this.s.i && this.s.info.issong) {
        // no next : extract current with queue
        i = this.s.i;
        wq = true;
      }
    }

    if (i != undefined) {
      var url = `${window.location.origin}/api/video/${this.s.queue[i].id}`
      if (wq) url += '?qid=' + (this.s.info.qid || this.s.queue[i].queueId);
      console.log('prepare', i, wq, url)
      const response = await fetch(url);
      const { video, queue } = await response.json();
      this.setS("queue", i, "stream", video.stream);
      this.appendToQueue(queue);
      this.prepare();
    }
  }

  tryPlay() {
    if (this.stream() != this.s.current.stream) {
      this.setStream('' + this.s.current.stream.url);
      this.setPlaying(true);
    }
  }
}

export default function App() {
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const player = new Player(decodeURIComponent(params.id), searchParams);

  const navigate = useNavigate();

  const colorthief = new ColorThief()

  const onImageLoad = (load) => {
    var img = load.srcElement
    var c = colorthief.getColor(img);
    var nc = Math.sqrt(c.map(x => x*x).reduce((a,b)=>a+b,0))
    c = c.map(x => x*310/nc);
    c = `rgb(${c.join(',')})`;
    document.querySelector(':root').style.setProperty('--color-d', c);
  }

  return (
    <div class="flex flex-col ls:flex-row flex-grow ls:max-h-full ls:overflow-y-scroll">

      <MetaProvider>
        <Title>Mew - {player.s.current ? player.s.current.title : 'Loading...'}</Title>
      </MetaProvider>

      <div class="hidden ls:block">
        <BackButton />
      </div>

      <Show when={player.requestAutoplay()}>
        <div class="absolute z-2 bg-d/90 w-full h-full flex items-center justify-center">
          <div class="flex flex-col p-4 items-center [&>*]:text-center">
            <span class="text-red-700 font-bold">Audio autoplay is blocked.</span>
            <span>Please interact with the page to play the audio, and ideally disable autoplay restrictions.</span>
            <span class="italic">Click anywhere to continue.</span>
          </div>
        </div>
      </Show>

      {/* Current song details */}
      <div class="flex-1 flex m-2 items-center justify-center">
        <Show when={player.s.loaded}>
          <div class="p-2 bg-d rounded-md drop-shadow-[0_0px_10px_rgba(0,0,0,0.15)]">
            <div style="width: min(min(90vw, 90vh),20rem)" class="flex flex-col items-center justify-center gap-3">
              <Show when={player.s.info.artist}>
                <div class="flex flex-col items-center leading-[1.2] mt-1">
                  <span class="text-center">Playing <span class="font-bold">{player.s.info.title}</span> (album) by <A href={`/artist/${player.s.info.artistId}`} class="italic">{player.s.info.artist}</A></span>
                </div>
              </Show>
              <div class="bg-b/20 w-full rounded-md">
                <img class="rounded-md" onLoad={onImageLoad} src={window.location.origin + '/api/img?url=' + chooseThumbnailUrl(player.s.info.thumbnails || player.s.current.thumbnails)} />
              </div>
              <div class="flex flex-col items-center leading-[1.2]">
                <A onClick={() => player.restart(player.s.current.id)} href={url(player.s.current)} class="font-bold text-center">{player.s.current.title}</A>
                <A onClick={() => player.restart(player.s.current.albumId)} href={`/player/${player.s.current.albumId}`} class="text-center">{player.s.current.album}</A>
                <A href={`/artist/${player.s.current.artistId}`} class="italic text-center">{player.s.current.artist}</A>
              </div>
              {/* time indicator */}
              <div class="w-full h-7 flex flex-col items-center">
                <Show when={player.audio.state != "loading"}>
                  <Show when={!player.s.current.error} fallback={<div>Error playing audio (code {player.s.current.error})</div>}>
                    {/* time spans */}
                    <div class="w-full flex flex-row justify-between text-xs">
                      <span>{durationString(player.audio.currentTime)}</span>
                      <span>{durationString(player.audio.duration)}</span>
                    </div>
                    {/* progress bar */}
                    <div class="h-4 w-11/12 relative">
                      {/* background */}
                      <div class="block w-full h-1/5 bg-b/20 rounded-full absolute top-2/5"></div>
                      {/* buffered */}
                      <div class="block h-1/5 bg-b/20 rounded-full absolute top-2/5"></div>
                      {/* progress */}
                      <div class="block h-1/5 bg-b rounded-full absolute top-2/5" style={{width: `${100 * player.audio.currentTime / player.audio.duration}%`}}></div>
                      {/* slider */}
                      <input id="pslider" type="range" value={(player.audio.currentTime / player.audio.duration).toString()} min="0" max="1" step="0.0001" onInput={({ target }) => player.controls.seek((+target.value) * player.audio.duration) } class="absolute h-full" />
                    </div>
                  </Show>
                </Show>
              </div>
              {/* buttons */}
              <div class="flex flex-row justify-center gap-3 mb-1">
                <div classList={{"w-16": true, "h-16": true, "rounded-full": true, "flex": true, "items-center": true, "justify-center": true, "hover:bg-b/8": player.s.i > 0, "opacity-15": player.s.i <= 0 }} onClick={() => player.actions.next(false)}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" class="w-8 h-8">
                    <path d="M491 100.8C478.1 93.8 462.3 94.5 450 102.6L192 272.1L192 128C192 110.3 177.7 96 160 96C142.3 96 128 110.3 128 128L128 512C128 529.7 142.3 544 160 544C177.7 544 192 529.7 192 512L192 367.9L450 537.5C462.3 545.6 478 546.3 491 539.3C504 532.3 512 518.8 512 504.1L512 136.1C512 121.4 503.9 107.9 491 100.9z"/>
                  </svg>
                </div>
                <div class="w-16 h-16 rounded-full flex items-center justify-center bg-b text-d transition duration-200 ease-in-out hover:scale-110" onClick={player.actions.playPause}>
                  <Switch>
                    <Match when={player.playing()}>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 640 640" class="w-8 h-8">
                        <path d="M176 96C149.5 96 128 117.5 128 144L128 496C128 522.5 149.5 544 176 544L240 544C266.5 544 288 522.5 288 496L288 144C288 117.5 266.5 96 240 96L176 96zM400 96C373.5 96 352 117.5 352 144L352 496C352 522.5 373.5 544 400 544L464 544C490.5 544 512 522.5 512 496L512 144C512 117.5 490.5 96 464 96L400 96z"/>
                      </svg>
                    </Match>
                    <Match when={!player.playing()}>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 640 640" class="w-8 h-8" style="transform: translateX(5%)">
                        <path d="M187.2 100.9C174.8 94.1 159.8 94.4 147.6 101.6C135.4 108.8 128 121.9 128 136L128 504C128 518.1 135.5 531.2 147.6 538.4C159.7 545.6 174.8 545.9 187.2 539.1L523.2 355.1C536 348.1 544 334.6 544 320C544 305.4 536 291.9 523.2 284.9L187.2 100.9z"/>
                      </svg>
                    </Match>
                  </Switch>
                </div>
                <div classList={{"w-16": true, "h-16": true, "rounded-full": true, "flex": true, "items-center": true, "justify-center": true, "hover:bg-b/8": player.s.i < player.s.queue.length, "opacity-15": player.s.i >= player.s.queue.length }} onClick={player.actions.next}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" class="w-8 h-8">
                    <path d="M149 100.8C161.9 93.8 177.7 94.5 190 102.6L448 272.1L448 128C448 110.3 462.3 96 480 96C497.7 96 512 110.3 512 128L512 512C512 529.7 497.7 544 480 544C462.3 544 448 529.7 448 512L448 367.9L190 537.5C177.7 545.6 162 546.3 149 539.3C136 532.3 128 518.7 128 504L128 136C128 121.3 136.1 107.8 149 100.8z"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </Show>
      </div>

      {/* Queue */}
      <div style="min-width:50vw" class="bg-d flex flex-row flex-1 w-full justify-center ls:max-h-full ls:overflow-y-scroll">
        <div class="flex flex-col gap-2 py-4 px-4 w-130 max-h-full overflow-y-scroll">
          <SearchBar navigator={navigate} />
          <h3 class="text-xl font-bold">Queue</h3>
          <div class="flex-grow max-h-full overflow-y-scroll">
            <Show when={player.s.queue.length > 0} fallback="Loading queue...">
              <QueueResults queue={player.s.queue} i={player.s.i} onClick={i => player.actions.jump(i)} album={!player.s.info.issong} />
            </Show>
          </div>
        </div>
      </div>

    </div>
  )
}
