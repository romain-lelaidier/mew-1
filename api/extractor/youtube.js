import { YouTubeParser} from "../navigator/youtube.js";
import * as utils from "../utils.js";
import { palettes, songs, players } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import regescape from "regexp.escape";

class YouTubePlayer {
  constructor(pid, plg) {
    this.pid = pid;
    this.plg = plg;
    this.extracted = false;
    this.ww = new utils.WebWrapper();
  }

  toString() {
    if (this.extracted == true) 
      return JSON.stringify({
        pid: this.pid,
        plg: this.plg,
        sts: this.sts,
        sfc: this.sfc,
        nfc: this.nfc,
      });
    return '{}';
  }

  extractSigFunctionCodeFromName(sigFuncName) {
    var match = this.js.match(`${regescape(sigFuncName)}=function\\((\\w+)\\)`);
    if (!match) throw `Error while extracting player: function ${sigFuncName} not found in JS player code.`
    var B = match[1];
    var coreCode = utils.extractBracketsCode(match.index + match[0].length + 1, this.js);
    var rawInstructions = coreCode.split(';')

    var matchY = rawInstructions[0].match(`${regescape(B)}=${regescape(B)}\\[([a-zA-Z]+)\\[([0-9]+)\\]\\]\\(\\1\\[([0-9]+)\\]\\)`)
    if (!matchY) throw "Error while extracting player: Y not matched in function code";
    var Y = matchY[1];
    var Yobj;
    for (const matchYReg of [
      `var ${regescape(Y)}='(.+)'\\.split\((.{3})\)`,
      `var ${regescape(Y)}="(.+)"\\.split\((.{3})\)`
    ]) {
      var matchYobj = this.js.match(matchYReg);
      if (matchYobj) {
        Yobj = matchYobj[1].split(matchYobj[2][2]);
      }
    }

    if (!Yobj) {
      // Yobj may be saved as plain array: trying a basic extraction
      var matchYobj = this.js.match(`var ${regescape(Y)}=\\[`);
      if (matchYobj) {
        var njs = this.js.substring(matchYobj.index, matchYobj.index + 10000);
        var encloser = njs.indexOf('"],');
        njs = njs.substring(0, encloser + 2);
        Yobj = eval(`()=>{${njs};return ${Y}}`)();
      }
    }

    if (!Yobj) throw "Error while extracting player: could not find Y code";

    var matchH = rawInstructions[1].match(`^(.+)\\[${regescape(Y)}\\[([0-9]+)\\]\\]\\(${regescape(B)},([0-9])+\\)$`)
    if (!matchH) throw "Error while extracting player: H not matched in function code";
    var H = matchH[1];
    var Hcode = utils.extractBracketsCode(this.js.indexOf(`var ${H}=`) + 6 + H.length, this.js).replaceAll('\n', '')

    var matchYrep;
    while (matchYrep = Hcode.match(`${regescape(Y)}\\[([0-9]+)\\]`)) {
      Hcode = Hcode.replaceAll(matchYrep[0], "'" + Yobj[matchYrep[1]] + "'")
    }

    while (matchYrep = coreCode.match(`${regescape(Y)}\\[([0-9]+)\\]`)) {
      coreCode = coreCode.replaceAll(matchYrep[0], "'" + Yobj[matchYrep[1]] + "'")
    }

    this.sfc = `${B}=>{var ${H}={${Hcode}};${coreCode}}`;
    return [ Y, Yobj ];
  }

  extractNFunctionCodeFromName(nFuncName, Y, Yobj) {
    var match = this.js.match(`${regescape(nFuncName)}=function\\((\\w+)\\)`);
    if (!match) throw `N Function ${nFuncName} not found in player code`
    var B = match[1];
    var coreBegin = this.js.substring(match.index + match[0].length + 1);
    var returnMatch = coreBegin.match(/return \w[\w\[[0-9]+\]\]\(\w\[[0-9]+\]\)\};/);
    if (!returnMatch) throw `N Function ${nFuncName} not found in player code (could not match return)`;
    var coreCode = coreBegin.substring(0, returnMatch.index + returnMatch[0].length - 2);

    var undefinedIdx = Yobj.includes('undefined') ? Yobj.indexOf('undefined') : '[0-9]+';

    var match = coreCode.match(`;\\s*if\\s*\\(\\s*typeof\\s+[a-zA-Z0-9_$]+\\s*===?\\s*(?:(["\\'])undefined\\1|${regescape(Y)}\\[${undefinedIdx}\\])\\s*\\)\\s*return\\s+${regescape(B)};`)
    var fixedNFuncCode = coreCode.replace(match[0], ";")

    this.nfc = `${B}=>{var ${Y}=${JSON.stringify(Yobj)};${fixedNFuncCode}}`
  }

  async dbLoad(db) {
    var results = await db
      .select()
      .from(players)
      .where(and(eq(players.pid, this.pid), eq(players.plg, this.plg)));
    if (results.length > 0) {
      this.sts = results[0].sts;
      this.sfc = results[0].sfc;
      this.nfc = results[0].nfc;
      this.extracted = true;
      return true;
    }
    return false;
  }
  
  async dbSave(db) {
    try {
      await db
        .insert(players)
        .values({
          pid: this.pid,
          plg: this.plg,
          sts: this.sts,
          sfc: this.sfc,
          nfc: this.nfc
        });
    } catch(err) {
      console.error(err);
    }
  }

  async load(db) {
    var loaded = await this.dbLoad(db);
    if (loaded) return;

    // downloading from web
    var url =  `https://music.youtube.com/s/player/${this.pid}/player_ias.vflset/${this.plg}/base.js`;
    console.log("Player not saved, downloading from Web :", url)
    
    this.js = await this.ww.get("player_ias", "js", url, { save: true });

    // extracting signature timestamp from player (to indicate API which player version we're using)
    var matchSTS = this.js.match(/signatureTimestamp:([0-9]+)[,}]/)
    if (!matchSTS) throw new Error("Could not find signature timestamp from player");
    this.sts = matchSTS[1];

    var sigregexps = [
      // /\b(?P<var>[a-zA-Z0-9_$]+)&&\((?P=var)=(?P<sig>[a-zA-Z0-9_$]{2,})\(decodeURIComponent\((?P=var)\)\)/,
      [ /\b([a-zA-Z0-9_$]+)&&\(\1=([a-zA-Z0-9_$]{2,})\(decodeURIComponent\(\1\)\)/, 2 ],

      // /(?P<sig>[a-zA-Z0-9_$]+)\s*=\s*function\(\s*(?P<arg>[a-zA-Z0-9_$]+)\s*\)\s*{\s*(?P=arg)\s*=\s*(?P=arg)\.split\(\s*""\s*\)\s*;\s*[^}]+;\s*return\s+(?P=arg)\.join\(\s*""\s*\)/,
      // [ /([a-zA-Z0-9_$]+)\s*=\s*function\(\s*([a-zA-Z0-9_$]+)\s*\)\s*{\s*\2\s*=\s*\2\.split\(\s*""\s*\)\s*;\s*[^}]+;\s*return\s+\2\.join\(\s*""\s*\)/, 1 ],

      // /(?:\b|[^a-zA-Z0-9_$])(?P<sig>[a-zA-Z0-9_$]{2,})\s*=\s*function\(\s*a\s*\)\s*{\s*a\s*=\s*a\.split\(\s*""\s*\)(?:;[a-zA-Z0-9_$]{2}\.[a-zA-Z0-9_$]{2}\(a,[0-9]+\))?/,
      // // Old patterns
      // '\b[cs]\s*&&\s*[adf]\.set\([^,]+\s*,\s*encodeURIComponent\s*\(\s*(?P<sig>[a-zA-Z0-9$]+)\(',
      // '\b[a-zA-Z0-9]+\s*&&\s*[a-zA-Z0-9]+\.set\([^,]+\s*,\s*encodeURIComponent\s*\(\s*(?P<sig>[a-zA-Z0-9$]+)\(',
      // '\bm=(?P<sig>[a-zA-Z0-9$]{2,})\(decodeURIComponent\(h\.s\)\)',
      // // Obsolete patterns
      // '("|\')signature\x01\s*,\s*(?P<sig>[a-zA-Z0-9$]+)\(',
      // '\.sig\|\|(?P<sig>[a-zA-Z0-9$]+)\(',
      // 'yt\.akamaized\.net/\)\s*\|\|\s*.*?\s*[cs]\s*&&\s*[adf]\.set\([^,]+\s*,\s*(?:encodeURIComponent\s*\()?\s*(?P<sig>[a-zA-Z0-9$]+)\(',
      // '\b[cs]\s*&&\s*[adf]\.set\([^,]+\s*,\s*(?P<sig>[a-zA-Z0-9$]+)\(',
      // '\bc\s*&&\s*[a-zA-Z0-9]+\.set\([^,]+\s*,\s*\([^)]*\)\s*\(\s*(?P<sig>[a-zA-Z0-9$]+)\(',
    ];
    var sigFuncName;
    for (var sigregexp of sigregexps) {
      var match = this.js.match(sigregexp[0]);
      if (match) {
        sigFuncName = match[sigregexp[1]];
        break;
      }
    }
    if (!sigFuncName) throw "Could not extract signature cipher function name";

    // var match = player.match(/(?xs)[;\n](?:(?P<f>function\s+)|(?:var\s+)?)(?P<funcname>[a-zA-Z0-9_$]+)\s*(?(f)|=\s*function\s*)\((?P<argname>[a-zA-Z0-9_$]+)\)\s*\{(?:(?!\}[;\n]).)+\}\s*catch\(\s*[a-zA-Z0-9_$]+\s*\)\s*\{\s*return\s+%s\[%d\]\s*\+\s*(?P=argname)\s*\}\s*return\s+[^}]+\}[;\n]/)
    var matchNFuncName = this.js.match(/\nvar ([a-zA-Z_$][a-zA-Z0-9_$]*)=\[([a-zA-Z_$][a-zA-Z0-9_$]*)\];/)
    if (!matchNFuncName) throw "Could not extract n cipher function name";
    var nFuncName = matchNFuncName[2];

    console.log("player parsing", this.pid, sigFuncName, nFuncName)
    
    var [ Y, Yobj ] = this.extractSigFunctionCodeFromName(sigFuncName);
    this.extractNFunctionCodeFromName(nFuncName, Y, Yobj);

    this.extracted = true;

    this.dbSave(db);
  }

  decryptFormatStreamUrl(format) {
    if (!this.extracted) throw "Player data is not extracted"

    if (format.signatureCipher) {
      var sc = utils.parseQueryString(format.signatureCipher);
      var url = `${sc.url}&${sc.sp || "signature"}=${encodeURIComponent((eval(this.sfc))(sc.s))}`;
      var urlParams = utils.parseQueryString(url);
      if ('n' in urlParams) {
        var nDecrypted = eval(this.nfc)(urlParams.n)
        url = utils.replaceUrlParam(url, 'n', nDecrypted)
      }
      return url
    }

    // old school video
    var url = format.url;
    var sc = utils.parseQueryString(url);
    url = utils.replaceUrlParam(url, 'n', encodeURIComponent((eval(this.nfc))(sc.n)))
    return url;
  }
}

export class YouTubeExtractor {
  constructor(ww, db) {
    this.ww = ww;
    this.db = db;
    this.parser = new YouTubeParser();

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

      var player = new YouTubePlayer(playerMatch[1], playerMatch[2]);
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

          console.log(info)

          if (info.withQueue && queue.length == 0) {
            this.downloadQueue(info.id, extractedInfo.queueId).then(queue => {
              resolve({ video: extractedInfo, queue })
            })
          } else {
            resolve({ video: extractedInfo, queue })
          }

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
