import * as utils from "./utils.js";

export class YTMParser {
  parseRun(run, musicResult) {
    if ("navigationEndpoint" in run) {
      if ("browseEndpoint" in run.navigationEndpoint) {
        var ytType = run.navigationEndpoint.browseEndpoint.browseEndpointContextSupportedConfigs.browseEndpointContextMusicConfig.pageType;
        var type = {
          "MUSIC_PAGE_TYPE_ARTIST": "artist",
          "MUSIC_PAGE_TYPE_ALBUM": "album"
        } [ ytType ];
        if (type) {
          musicResult[type] = run.text;
          musicResult[type + "Id"] = run.navigationEndpoint.browseEndpoint.browseId
        }
      } else if ("watchEndpoint" in run.navigationEndpoint) {
        // AlbumSongResult
        musicResult.title = run.text;
        musicResult.id = run.navigationEndpoint.watchEndpoint.videoId;
      }
    }

    if (Object.keys(run).length == 1) {
      var yearMatch = run.text.match(/^(1|2)[0-9]{3}$/);
      if (yearMatch) musicResult.year = parseInt(yearMatch[0]);

      var durationMatch = run.text.match(/(\d{1,2}):(\d{1,2})/);
      if (durationMatch) musicResult.duration = parseInt(durationMatch[1]) * 60 + parseInt(durationMatch[2]);

      if (run.text.includes("vues") || run.text.includes("lectures")) {
        musicResult.viewCount = utils.parseViewCount(run.text);
      }
    }
  }

  parseRuns(runs, musicResult) {
    if (!utils.isIterable(runs)) return;
    runs.forEach(run => this.parseRun(run, musicResult))
  }

  extractQueueId(renderer, musicResult) {
    // parses playlist id and adds it to musicResult
    for (const item of renderer.menu.menuRenderer.items) {
      try {
        musicResult.queueId = item.menuNavigationItemRenderer.navigationEndpoint.watchEndpoint.playlistId;
        return;
      } catch(err) {
        continue;
      }
    }
  }
  
  playlistId(id) {
    id = id.substring(id.length - 43);
    if (id.indexOf('VL') == 0) {
      id = id.substring(2);
    }
    return id;
  }

  extractRendererTypeAndId(renderer) {
    if ("navigationEndpoint" in renderer || "onTap" in renderer) {
      var endpoint = "navigationEndpoint" in renderer ? renderer.navigationEndpoint : renderer.onTap;
      if ("watchEndpoint" in endpoint)
        return ["VIDEO", endpoint.watchEndpoint.videoId];
      else if ("browseEndpoint" in endpoint) {
        if (endpoint.browseEndpoint.browseEndpointContextSupportedConfigs.browseEndpointContextMusicConfig.pageType == "MUSIC_PAGE_TYPE_ARTIST")
          return ["ARTIST", endpoint.browseEndpoint.browseId];
        if (endpoint.browseEndpoint.browseEndpointContextSupportedConfigs.browseEndpointContextMusicConfig.pageType == "MUSIC_PAGE_TYPE_ALBUM")
          return ["ALBUM", endpoint.browseEndpoint.browseId];
        if (endpoint.browseEndpoint.browseEndpointContextSupportedConfigs.browseEndpointContextMusicConfig.pageType == "MUSIC_PAGE_TYPE_PLAYLIST")
          return ["PLAYLIST", this.playlistId(endpoint.browseEndpoint.browseId) ];
      }
    } else {
      if ("playlistItemData" in renderer && "videoId" in renderer.playlistItemData) {
        var id = renderer.playlistItemData.videoId
        try {
          if (renderer.overlay.musicItemThumbnailOverlayRenderer.content.musicPlayButtonRenderer.playNavigationEndpoint.watchEndpoint.watchEndpointMusicSupportedConfigs.watchEndpointMusicConfig.musicVideoType.includes('PODCAST'))
            return ['PODCAST', id];
          else
            return ["VIDEO", id ];
        } catch(err) {}
      }
    }
    return [null, null]
  }

  extractRendererInfo(renderer) {
    let [type, id] = this.extractRendererTypeAndId(renderer);
    if (type && ['VIDEO', 'ALBUM', 'ARTIST', 'PLAYLIST'].includes(type)) {
      var extractText = (i, j) => renderer.flexColumns[i]?.musicResponsiveListItemFlexColumnRenderer.text.runs[j]?.text;
      var musicResult = { 
        type, id,
        title: extractText(0, 0)
      };
      
      if ('thumbnail' in renderer) musicResult.thumbnails = renderer.thumbnail.musicThumbnailRenderer.thumbnail.thumbnails;

      for (let i = 1; i < renderer.flexColumns.length; i++) {
        if ("runs" in renderer.flexColumns[i].musicResponsiveListItemFlexColumnRenderer.text) {
          this.parseRuns(renderer.flexColumns[i].musicResponsiveListItemFlexColumnRenderer.text.runs, musicResult)
        }
      }

      this.extractQueueId(renderer, musicResult)

      return musicResult;
    }
  }

  extractTopRendererInfo(renderer, forcedType) {
    let [type, id] = this.extractRendererTypeAndId(renderer);
    if (forcedType) type = forcedType;
    if (type) {
      var musicResult = {
        type, id,
        thumbnails: renderer.thumbnail.musicThumbnailRenderer.thumbnail.thumbnails,
        title: renderer.title.runs[0].text
      };

      this.parseRuns(renderer.subtitle.runs, musicResult);
      this.extractQueueId(renderer, musicResult)

      return musicResult;
    }
  }

  extractQueueRendererInfo(renderer) {
    let [type, id] = this.extractRendererTypeAndId(renderer);
    if (type) {
      var musicResult = { 
        type, id,
        thumbnails: renderer.thumbnail.thumbnails,
        title: renderer.title.runs[0].text
      };
      
      this.parseRuns(renderer.longBylineText.runs, musicResult)
      this.parseRuns(renderer.lengthText.runs, musicResult)
      this.extractQueueId(renderer, musicResult)

      return musicResult;
    }
  }

  addResult(obj, musicResults) {
    if (musicResults.filter(mr => mr.id == obj.id).length > 0) return;
    musicResults.push(obj);
  }

  search(data, musicResults) {
    // Extracts search results videos from the YouTube JSON object.
    // Adds the results to the musicResults object.
    // Returns a map of the music result types to the endpoints for additional info.

    var contents = data.contents.tabbedSearchResultsRenderer.tabs[0].tabRenderer.content.sectionListRenderer.contents;
    var endpoints = {};

    contents.forEach(shelf => {
      if ("musicCardShelfRenderer" in shelf) {
        var renderer = shelf.musicCardShelfRenderer;
        var musicResult = this.extractTopRendererInfo(renderer);
        if (musicResult) {
          musicResult.top = true;
          this.addResult(musicResult, musicResults);
        }
      }
      if ("musicShelfRenderer" in shelf) {
        var forcedType;
        if (shelf.musicShelfRenderer.title.runs[0].text == 'Titres') {
          forcedType = 'SONG';
          endpoints.SONG = shelf.musicShelfRenderer.bottomEndpoint;
        }
        shelf.musicShelfRenderer.contents.forEach(musicObj => {
          var renderer = musicObj.musicResponsiveListItemRenderer;
          var musicResult = this.extractRendererInfo(renderer);
          if (musicResult) {
            if (forcedType) musicResult.type = forcedType;
            this.addResult(musicResult, musicResults);
          }
        })
      }
    });

    return endpoints;
  }

  extractAdditionalResults(data, musicResults, forcedType) {
    // Extracts additional search results videos from the YouTube JSON object.
    // Adds the results to the musicResults object.
    // Returns a map of the music result types to the endpoints for additional info.

    var contents;
    var endpoints = {};

    try {
      contents = data.contents.tabbedSearchResultsRenderer.tabs[0].tabRenderer.content.sectionListRenderer.contents[1].musicShelfRenderer.contents;
    } catch(err) {
      console.error(err);
      return endpoints;
    }

    if (!utils.isIterable(contents)) return endpoints;

    contents.forEach(musicObj => {
      try {
        var renderer = musicObj.musicResponsiveListItemRenderer;
        var musicResult = this.extractRendererInfo(renderer);
        if (musicResult) {
          musicResult.type = forcedType;
          this.addResult(musicResult, musicResults);
        }
      } catch(err) {
        console.error(err)
      }
    });

    return endpoints;
  }

  parseAlbumSongResult(renderer) {
    var result = {};
    // result.title = renderer.flexColumns[0].musicResponsiveListItemFlexColumnRenderer.runs[0].text;
    for (var flexColumn of renderer.flexColumns) {
      this.parseRuns(flexColumn.musicResponsiveListItemFlexColumnRenderer.text.runs, result);
    }
    for (var fixedColumn of renderer.fixedColumns) {
      this.parseRuns(fixedColumn.musicResponsiveListItemFixedColumnRenderer.text.runs, result);
    }
    return result;
  }

  extractAlbum(data) {
    var album = {
      songs: []
    };

    var albumRenderer, contents;

    try {
      albumRenderer = data.contents.twoColumnBrowseResultsRenderer.tabs[0].tabRenderer.content.sectionListRenderer.contents[0].musicResponsiveHeaderRenderer;
      contents = data.contents.twoColumnBrowseResultsRenderer.secondaryContents.sectionListRenderer.contents[0].musicShelfRenderer.contents;
    } catch(err) {
      console.error(err);
      return album;
    }

    // parsing album info
    album.title = albumRenderer.title.runs[0].text;
    album.thumbnails = albumRenderer.thumbnail.musicThumbnailRenderer.thumbnail.thumbnails;

    this.parseRuns(albumRenderer.subtitle.runs, album);
    this.parseRuns(albumRenderer.straplineTextOne.runs, album);

    if (!utils.isIterable(contents)) return album;

    var index = 1;
    contents.forEach(musicObj => {
      try {
        var renderer = musicObj.musicResponsiveListItemRenderer;
        var musicResult = this.parseAlbumSongResult(renderer);
        if (musicResult) {
          if (!musicResult.index) musicResult.index = index++;
          album.songs.push(musicResult)
        }
      } catch(err) {
        console.error(err)
      }
    });

    return album
  }

  extractArtist(data) {
    var artist = {
      results: [],
    };

    try {
      let header = data.header.musicImmersiveHeaderRenderer

      artist.title = header.title.runs[0].text;
      artist.description = header.description.runs.map(run => run.text).join('\n');
      artist.thumbnails = header.thumbnail.musicThumbnailRenderer.thumbnail.thumbnails;

      artist.shufflePlaySID = header.playButton.buttonRenderer.navigationEndpoint.watchEndpoint.videoId;
      artist.shufflePlayPID = header.playButton.buttonRenderer.navigationEndpoint.watchEndpoint.playlistId;
      artist.radioPlaySID = header.startRadioButton.buttonRenderer.navigationEndpoint.watchEndpoint.videoId;
      artist.radioPlayPID = header.startRadioButton.buttonRenderer.navigationEndpoint.watchEndpoint.playlistId;

      artist.viewCount = utils.parseViewCount(header.monthlyListenerCount.runs[0].text)
    } catch(err) {}

    let contents = data.contents.singleColumnBrowseResultsRenderer.tabs[0].tabRenderer.content.sectionListRenderer.contents;

    contents.forEach(c => {
      if ('musicShelfRenderer' in c) {
        c.musicShelfRenderer.contents.forEach(rc => {
          let song = this.extractRendererInfo(rc.musicResponsiveListItemRenderer);
          song.type = 'SONG';
          // delete song.artist;
          artist.results.push(song);
        })
      }
      if ('musicCarouselShelfRenderer' in c) {
        c.musicCarouselShelfRenderer.contents.forEach(rc => {
          try {
            if (rc.musicTwoRowItemRenderer.navigationEndpoint.browseEndpoint.browseEndpointContextSupportedConfigs.browseEndpointContextMusicConfig.pageType == "MUSIC_PAGE_TYPE_ALBUM" && rc.musicTwoRowItemRenderer.subtitle.runs.length == 1) {
              let album = {
                type: "ALBUM"
              };
              album.thumbnails = rc.musicTwoRowItemRenderer.thumbnailRenderer.musicThumbnailRenderer.thumbnail.thumbnails;
              album.title = rc.musicTwoRowItemRenderer.title.runs[0].text;
              album.id = rc.musicTwoRowItemRenderer.title.runs[0].navigationEndpoint.browseEndpoint.browseId;
              this.parseRuns(rc.musicTwoRowItemRenderer.subtitle.runs, album)
              artist.results.push(album)
            }
          } catch(err) {}
        })
      }
    })

    return artist;
  }

  parsePlaylistSongResult(renderer) {
    var result = {
      thumbnails: renderer.thumbnail.musicThumbnailRenderer.thumbnail.thumbnails
    };
    // result.title = renderer.flexColumns[0].musicResponsiveListItemFlexColumnRenderer.runs[0].text;
    for (var flexColumn of renderer.flexColumns) {
      this.parseRuns(flexColumn.musicResponsiveListItemFlexColumnRenderer.text.runs, result);
    }
    for (var fixedColumn of renderer.fixedColumns) {
      this.parseRuns(fixedColumn.musicResponsiveListItemFixedColumnRenderer.text.runs, result);
    }
    return result;
  }

  extractPlaylist(data) {
    var playlist = {
      songs: []
    };

    var playlistRenderer, contents;

    try {
      playlistRenderer = data.contents.twoColumnBrowseResultsRenderer.tabs[0].tabRenderer.content.sectionListRenderer.contents[0].musicResponsiveHeaderRenderer;
      contents = data.contents.twoColumnBrowseResultsRenderer.secondaryContents.sectionListRenderer.contents[0].musicPlaylistShelfRenderer.contents;
    } catch(err) {
      console.error(err);
      return playlist;
    }

    // parsing album info
    playlist.title = playlistRenderer.title.runs[0].text;
    playlist.thumbnails = playlistRenderer.thumbnail.musicThumbnailRenderer.thumbnail.thumbnails;

    this.parseRuns(playlistRenderer.subtitle.runs, playlist);

    if (!utils.isIterable(contents)) return playlist;

    var index = 1;
    contents.forEach(musicObj => {
      try {
        var renderer = musicObj.musicResponsiveListItemRenderer;
        var musicResult = this.parsePlaylistSongResult(renderer);
        if (musicResult) {
          if (!musicResult.index) musicResult.index = index++;
          playlist.songs.push(musicResult)
        }
      } catch(err) {
        console.error(err)
      }
    });

    return playlist
  }

  parseContent(content) {
    // console.log(content)
    try {
      var item = {};
      var renderer;
      if ('musicTwoRowItemRenderer' in content) {
        renderer = content.musicTwoRowItemRenderer;
        item.thumbnails = renderer.thumbnailRenderer.musicThumbnailRenderer.thumbnail.thumbnails
      } else if ('musicResponsiveListItemRenderer' in content) {
        renderer = content.musicResponsiveListItemRenderer;
        item.thumbnails = renderer.thumbnail.musicThumbnailRenderer.thumbnail.thumbnails
      }
      var [ type, id ] = this.extractRendererTypeAndId(renderer);
      item.type = type;
      item.id = id;
      if ('title' in renderer) {
        item.title = renderer.title.runs[0].text;
      }
      if ('subtitle' in renderer) {
        item.subtitle = renderer.subtitle.runs[0].text;
      }
      if (!('title' in item) && 'flexColumns' in renderer) {
        var runs = [].concat(...renderer.flexColumns.map(fc => fc.musicResponsiveListItemFlexColumnRenderer.text.runs));
        this.parseRuns(runs, item);
      }
      if ('artist' in item) item.type = "SONG";
      return item;
    } catch(err) {
      console.error(err);
      return null;
    }
  }

  parseBrowsingResults(contents) {
    var results = [];
    for (var content of contents) {
      try {
        var renderer = content.musicCarouselShelfRenderer;
        var title = renderer.header.musicCarouselShelfBasicHeaderRenderer.title.runs[0].text;
        var items = [];
        for (var icontent of renderer.contents) {
          var item = this.parseContent(icontent);
          if (item) items.push(item);
        }
        if (items.length > 0) {
          results.push({
            title,
            items
          })
        }
      } catch(err) {
        console.error(err);
      }
    }
    return results;
  }
}