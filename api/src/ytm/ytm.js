import fs from "fs";

import { YTMParser} from "./ytm_parser.js";
import { YTMPlayer } from "./ytm_player.js";
import * as utils from "./utils.js";
import { palettes, songs } from "../db/schema.js";
import { eq } from "drizzle-orm";

export default class YTM {
  constructor(db) {
    this.db = db;
    this.ww = new utils.WebWrapper();
    this.parser = new YTMParser();

    this.baseContext = {
      "client": {
        "hl": "en",
        "gl": "FR",
        "remoteHost": "88.166.99.84",
        "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:138.0) Gecko/20100101 Firefox/138.0,gzip(gfe)",
        "clientName": "WEB_REMIX",
        "clientVersion": "1.20250514.03.00",
        "originalUrl": "https://music.youtube.com/?cbrd=1",
        "acceptHeader": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      }
    }

    this.baseHeaders = {
      'X-YouTube-Client-Name': '7',
      'X-YouTube-Client-Version': '7.20250521.15.00',
      'Origin': 'https://www.youtube.com',
      'User-Agent': 'Mozilla/5.0 (ChromiumStylePlatform) Cobalt/Version,gzip(gfe)',
      'content-type': 'application/json',
      'X-Goog-Visitor-Id': 'CgstXzB5X3dIaS1fMCjsjtjBBjInCgJGUhIhEh0SGwsMDg8QERITFBUWFxgZGhscHR4fICEiIyQlJiAu'
    }

    this.INNERTUBE_CLIENT_VERSION = '';
  }
  
  generateContext() {
    var context = {
      "client": {
        "hl": "en", 
        "gl": "FR", 
        "userAgent": "Mozilla/5.0 (ChromiumStylePlatform) Cobalt/Version,gzip(gfe)",
        "clientName": "TVHTML5",
        "originalUrl": "https://www.youtube.com/tv",
        "webpSupport": false,
        "tvAppInfo": {"appQuality": "TV_APP_QUALITY_FULL_ANIMATION"},
        "acceptHeader": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "clientVersion": this.INNERTUBE_CLIENT_VERSION
      }
    };

    return context;
  }

  getYtcfg() {
    // Extracts YouTube Configuration object for later authorizations.

    return new Promise((resolve, reject) => {
      this.ww.get(
        "tv", "html",
        "https://www.youtube.com/tv",
        {
          headers: { 'User-Agent': 'Mozilla/5.0 (ChromiumStylePlatform) Cobalt/Version' }
        }
      ).then(html => {
        var cvMatch = html.match(/"INNERTUBE_CLIENT_VERSION":"([0-9\.]+)[^0-9\.]/);
        if (!cvMatch) return reject("Error downloading ytcfg: client version not found in html");

        this.INNERTUBE_CLIENT_VERSION = cvMatch[1];

        resolve()
      })
    })
  }

  getPlayer(id) {
    return new Promise(async (resolve, reject) => {
      var html = await this.ww.get(
        "watch", "html",
        "https://music.youtube.com/watch?v=" + id,
        {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:138.0) Gecko/20100101 Firefox/138.0" }
        },
      );
      var playerMatch = html.match(/\/s\/player\/([a-z0-9]{8})\/player_ias\.vflset\/([a-z]{2}_[A-Z]{2})\/base\.js/);
      if (!playerMatch) return reject("Error downloading player: player URL not found in html");

      var player = new YTMPlayer(playerMatch[1], playerMatch[2]);
      await player.load(this.db);
      resolve(player);
    })
  }

  downloadQueue(videoId, queueId) {
    return new Promise((resolve, reject) => {
      if (!queueId) return resolve([]);

      this.ww.post(
        "yti_next_queue", "json",
        "https://music.youtube.com/youtubei/v1/next?prettyPrint=false",
        {
          "enablePersistentPlaylistPanel": true,
          "tunerSettingValue": "AUTOMIX_SETTING_NORMAL",
          "playlistId": queueId,
          "isAudioOnly": true,
          "responsiveSignals": {
            "videoInteraction": [
              {
                "queueImpress": {},
                "videoId": videoId,
                "queueIndex": 0
              }
            ]
          },
          context: this.baseContext
        },
        { headers: this.baseHeaders }
      )
      .then(data => {
        try {
          var results = [];
          for (const entry of data.contents.singleColumnMusicWatchNextResultsRenderer.tabbedRenderer.watchNextTabbedResultsRenderer.tabs[0].tabRenderer.content.musicQueueRenderer.content.playlistPanelRenderer.contents) {
            try {
              var renderer = entry.playlistPanelVideoRenderer;
              results.push(this.parser.extractQueueRendererInfo(renderer));
            } catch(err) {
              console.error(err)
              continue;
            }
          }
          resolve(results);
        } catch(err) {
          console.error(err)
          resolve([])
        }
      }).catch(reject)
    })
  }

  getYtipr(id, player, retry=true) {
    // try a download. If it fails, retries after downloading ytcfg

    return new Promise((resolve, reject) => {
      this.ww.post(
        "yti_player", "json",
        "https://music.youtube.com/youtubei/v1/player?prettyPrint=false",
        {
          "context": this.generateContext(),
          "videoId": id,
          "playbackContext": {"contentPlaybackContext": {"html5Preference": "HTML5_PREF_WANTS", "signatureTimestamp": player.sts}}, 
        },
        {
          headers: {
            ...this.baseHeaders,
            'X-YouTube-Client-Version': this.INNERTUBE_CLIENT_VERSION
          }
        }
      )
      .then(resolve)
      .catch(err => {
        if (retry) {
          this.getYtcfg().then(() => {
            this.getYtipr(id, player, false).then(resolve).catch(reject);
          }).catch(reject)
        } else {
          reject(err);
        }
      })
    })
  }

  downloadVideoData(id, player) {
    // Downloads video data as JSON object, including locked formats

    return new Promise((resolve, reject) => {
      Promise.all([
        this.getYtipr(id, player),
        this.ww.post(
          "yti_next_single", "json",
          "https://music.youtube.com/youtubei/v1/next?prettyPrint=false",
          {
            "videoId": id,
            context: this.baseContext
          },
          { headers: this.baseHeaders }
        )
      ])
      .then(data => {
        var info = {
          id: data[0].videoDetails.videoId,
          title: data[0].videoDetails.title,
          artist: data[0].videoDetails.author,
          views: data[0].videoDetails.viewCount,
          duration: parseInt(data[0].videoDetails.lengthSeconds),
          thumbnails: data[0].videoDetails.thumbnail.thumbnails,
          formats: data[0].streamingData.formats.concat(data[0].streamingData.adaptiveFormats)
            // .filter(fmt => fmt.mimeType.includes("audio/webm"))
        };

        try {
          var entry = data[1].contents.singleColumnMusicWatchNextResultsRenderer.tabbedRenderer.watchNextTabbedResultsRenderer.tabs[0].tabRenderer.content.musicQueueRenderer.content.playlistPanelRenderer.contents[0];
          var renderer = entry.playlistPanelVideoRenderer;
          var result = this.parser.extractQueueRendererInfo(renderer);
          for (var [ key, value ] of Object.entries(result)) {
            info[key] = value;
          }
        } catch(err) {
          console.error(err)
        }

        resolve(info)
      }).catch(reject)
    })
  }

  browse(continuation = {}, depth = 0) {
    return new Promise((resolve, reject) => {
      var url = 'continuation' in continuation && 'clickTrackingParams' in continuation
        ? "https://music.youtube.com/youtubei/v1/browse?prettyPrint=false&type=next&continuation=" + continuation.continuation + "&itct=" + continuation.clickTrackingParams
        : "https://music.youtube.com/youtubei/v1/browse?prettyPrint=false&type=next";

      this.ww.post(
        "yti_browse_" + depth, "json",
        url,
        { context: this.baseContext },
        { headers: this.baseHeaders },
      ).then(json => {
        var continuation;
        try {
          continuation = depth == 0 
            ? json.contents.singleColumnBrowseResultsRenderer.tabs[0].tabRenderer.content.sectionListRenderer.continuations[0].nextContinuationData
            : json.continuationContents.sectionListContinuation.continuations[0].nextContinuationData;
        } catch(err) {
          return reject(err);
        }

        var contents = depth == 0
          ? json.contents.singleColumnBrowseResultsRenderer.tabs[0].tabRenderer.content.sectionListRenderer.contents
          : json.continuationContents.sectionListContinuation.contents;

        var results = this.parser.parseBrowsingResults(contents);
        if (depth == 2) {
          resolve(results);
        } else {
          this.browse(continuation, depth+1)
          .then(followingResults => {
            resolve(results.concat(followingResults))
          })
          .catch(reject);
        }

      }).catch(reject)
    })
  }

  getYTInitialDataFromHtml(url, name) {
    return new Promise((resolve, reject) => {
      this.ww.get(
        name, "html",
        url,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:139.0) Gecko/20100101 Firefox/139.0',
            'Cookie': 'PREF=guide_collapsed=false&gl=FR&hl=en-GB'
          }
        },
        // false, true
      )
      .then(html => {
        try {
          var ytJSCodeMatch = html.match(/try \{(.+);ytcfg\.set/);
          if (!ytJSCodeMatch) return reject('Could not find initial data in album html');

          var initialData = eval(`(() => {${ytJSCodeMatch[1]};return initialData;})()`);
          var data = JSON.parse(initialData.filter(d => d.path == '/browse')[0].data);

          resolve(data);
        } catch(err) {
          reject(err);
        }
      })
      .catch(reject)
    })
  }

  async saveSong(song) {
    try {
      await this.db
        .insert(songs)
        .values({
          id: song.id,
          title: song.title.substring(0, 128),
          artist: song.artist.substring(0, 128),
          album: song.album.substring(0, 128),
          artistId: song.artistId,
          albumId: song.albumId,
          thumbnail: utils.chooseThumbnailUrl(song.thumbnails, 0)
        })
    } catch(err) {
      // console.error(err);
    }
  }

  // ----- API FUNCTIONS -----

  async getSearchSuggestions(query) {
    // Fetches search suggestions for the given query.
    // The returned Promise resolves on an object containing two fields :
    //  - extendedQueries : a list of pairs containing a bold text and a completion
    //  - musicResults : a list of music results

    if (query.length < 3) throw new Error("Query length should be at least 3.");

    var data = await this.ww.post(
      "yti_searchsuggestions", "json",
      "https://music.youtube.com/youtubei/v1/music/get_search_suggestions?prettyPrint=false",
      {
        input: query,
        context: this.baseContext
      }
    );

    // extended queries (query autocompletions)
    let extendedQueries = [];
    data.contents[0].searchSuggestionsSectionRenderer.contents.forEach(queryObj => {
      extendedQueries.push(queryObj.searchSuggestionRenderer.suggestion.runs.map(run => run.text))
    })

    // music results (quick video and albums results)
    let musicResults = [];
    data.contents[1].searchSuggestionsSectionRenderer.contents.forEach(musicObj => {
      var renderer = musicObj.musicResponsiveListItemRenderer;
      var musicResult = this.parser.extractRendererInfo(renderer);
      if (musicResult) musicResults.push(musicResult);
    })

    return {
      extendedQueries,
      musicResults
    };
  }

  async getSearch(query, additional=[]) {
    // Fetches search results for the given query.
    // The returned Promise resolves on an object containing fields such as SONG, ARTIST, ALBUM, etc.
    // Each field value is an array of music results.
    // For each type contained in additional, more results are fetched.

    var data = await this.ww.post(
      "yti_search", "json",
      "https://music.youtube.com/youtubei/v1/search?prettyPrint=false",
      {
        query: query,
        context: this.baseContext
      },
    )

    var results = [];
    this.parser.search(data, results);

    return results;

    // Promise.all(
    //   additionalTypes.map(type =>
    //     this.ww.post(
    //       "yti_search_add", "json",
    //       "https://music.youtube.com/youtubei/v1/search?prettyPrint=false",
    //       {
    //         context: {
    //           ...this.baseContext,
    //           clickTracking: { clickTrackingParams: endpoints[type].clickTrackingParams }
    //         },
    //         ...endpoints[type].searchEndpoint,
    //       }
    //     )
    //   )
    // ).then(responses => {
    //   for (var i = 0; i < responses.length; i++) {
    //     var type = additionalTypes[i];
    //     var data = responses[i];
    //     this.parser.extractAdditionalResults(data, results, type);
    //   }
    //   resolve(results)
    // })
  }

  async getAlbum(id) {
    if (!id.match(/^[a-zA-Z0-9_-]{17}$/)) throw new Error("Invalid id.");
    var data = await this.getYTInitialDataFromHtml('https://music.youtube.com/browse/' + id, "browse_album");
    var album = this.parser.extractAlbum(data);
    album.id = id;
    return album;
  }

  async getArtist(id) {
    if (!id.match(/^[a-zA-Z0-9_-]{24}$/)) throw new Error("Invalid id.");
    var data = await this.getYTInitialDataFromHtml('https://music.youtube.com/channel/' + id, "browse_artist")
    var artist = this.parser.extractArtist(data);
    artist.id = id;
    return artist;
  }

  async getPlaylist(info) {
    var html = await this.ww.get(
      "browse_playlist", "html",
      'https://music.youtube.com/playlist?list=' + info.id,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:139.0) Gecko/20100101 Firefox/139.0'
        }
      },
    );

    var ytJSCodeMatch = html.match(/try \{(.+);ytcfg\.set/);
    if (!ytJSCodeMatch) throw new Error('Could not find initial data in playlist html');

    var initialData = eval(`(() => {${ytJSCodeMatch[1]};return initialData;})()`);
    var data = JSON.parse(initialData.filter(d => d.path == '/browse')[0].data);
    fs.writeFileSync('./testing/ytInitialData.json', JSON.stringify(data));

    var playlist = this.parser.extractPlaylist(data);
    playlist.id = info.id;

    return playlist;
  }

  getVideo(info) {
    // Extracts and unlocks video data from id.
    // The returned Promise resolves on an object containig two fields :
    //  - video : an object with the extracted data and formats
    //  - queue : a list

    if (!("id" in info)) throw new Error("No id provided.");
    if (!info.id.match(/^[a-zA-Z0-9_-]{11}$/)) throw new Error("Invalid id.");
    
    return new Promise((resolve, reject) => {

      console.log(`${new Date().toLocaleString()} EU ${info.id}`)

      Promise.all([
        this.getPlayer(info.id),
        this.downloadQueue(info.id, info.queueId),
      ]).then(res => {
        var [ player, queue ] = res;
        this.downloadVideoData(info.id, player)
        .then(extractedInfo => {
          // unlocking stream urls
          var failedDecryptions = 0;
          extractedInfo.formats.forEach(fmt => {
            try {
              fmt.url = player.decryptFormatStreamUrl(fmt)
            } catch(err) {
              failedDecryptions++;
            }
          });
          if (failedDecryptions > 0) console.error(`Unable to decypher stream urls for ${failedDecryptions} formats`)

          // cleaning formats
          extractedInfo.formats = extractedInfo.formats.map(fmt => {
            return {
              url: fmt.url,
              bitrate: fmt.bitrate,
              mimeType: fmt.mimeType
            }
          });

          extractedInfo.stream = utils.chooseFormat(extractedInfo.formats);
          delete extractedInfo.formats;

          for (var [ key, value ] of Object.entries(info)) {
            if (!info.key) extractedInfo[key] = value
          }

          this.saveSong(extractedInfo);

          resolve({
            video: extractedInfo,
            queue
          })
        }).catch(reject);
      }).catch(reject);
    })
  }

  async getColors(id, url) {
    // attempting a load from database
    var results = await this.db
      .select()
      .from(palettes)
      .where(eq(palettes.id, id));
    if (results.length > 0) {
      return JSON.parse(results[0].p);
    }
    
    // downloading from web
    var palette = await utils.downloadColorPalette(url);
    await this.db
      .insert(palettes)
      .values({ id, p: JSON.stringify(palette) });
    return palette;
  }
}
