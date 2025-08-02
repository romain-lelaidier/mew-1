import { createAudio } from "@solid-primitives/audio";
import { createEffect, createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import { getPlaylist } from "../components/playlists";

export class Player {

  constructor() {

    [ this.s, this.setS ] = createStore({
      started: false,
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
        if (code == 1 || code == 2) {
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
        console.log(this.s.i);
        this.setS("queue", this.s.i, "error", code);
        console.log('audio error: networkState = ' + code);
      } else {
        if (this.s.queue && this.s.current && this.s.current.error) {
          this.setS("queue", this.s.i, "error", null);
        }
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

  openSelf(navigate) {
    if (this.s.started) {
      var url = `/player/${this.s.info.id}`;
      if (this.s.info.qid) url += '/' + this.s.info.qid;
      navigate(url)
    }
  }

  start(id, params={}) {

    if (this.s?.info?.id == id) return;

    this.setS({
      started: true,
      loaded: false,
      info: {
        id,
        qid: params.qid,
        type: { 11: 'SONG', 32: 'PLAYLIST' }[ id.length ] || 'ALBUM'
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
    if (this.s.info.type == 'SONG') {
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
    } else if (this.s.info.type == 'ALBUM') {
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
    } else if (this.s.info.type == 'PLAYLIST') {
      const playlist = await getPlaylist(this.s.info.id);
      this.setS("info", info => {
        return {
          ...info,
          user: playlist.user.name,
          title: playlist.name
        }
      })
      this.setS("i", i => 0);
      this.setS("inext", i => 1);
      this.appendToQueue(playlist.songs.map(s => {
        return {
          ...s,
          thumbnails: [ { url: s.thumbnail, width: 60, height: 60 } ]
        }
      }));
    }
    this.setS("loaded", l => true);
  }

  async prepare() {
    // recursively retries to prepare current and next songs stream urls.
    // this implies fetching more of the current queue if the end is reached.

    var i, wq = false;

    if (this.s.queue.length == 0) return;

    if (!this.s.current) {
      return alert("current is not in queue");
    }

    if (!this.s.current.stream) {
      // extract current
      i = this.s.i;
      if (i == this.s.current.length && this.s.info.type == 'SONG') {
        wq = true
      }
    }

    if (i == undefined) {
      // extract next
      if (this.s.next) {
        if (!this.s.next.stream) {
          // extract next
          i = this.s.inext;
          if (!this.s.queue[i] && this.s.info.type == 'SONG') {
            wq = true;
          }
        }
      } else if (this.s.inext > this.s.i && this.s.info.type == 'SONG') {
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
      this.setS("queue", i, "thumbnails", JSON.stringify(video.thumbnails));
      this.appendToQueue(queue);
      this.prepare();
    }
  }

  tryPlay() {
    if (this.s.current) {
      if (this.stream() != this.s.current.stream) {
        this.setStream(this.s.current.stream.url);
        this.setPlaying(true);
      }
    }
  }
}

export const player = new Player();