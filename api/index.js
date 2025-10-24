import express from "express";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { rateLimit } from 'express-rate-limit';
import jsonwebtoken from "jsonwebtoken";
import * as fs from "fs";

import * as schema from "./db/schema.js";
import * as utils from "./utils.js"
import { YouTubeExtractor } from "./extractor/youtube.js"
import { LastFmNavigator } from "./navigator/lastfm.js";
import { YouTubeNavigator } from "./navigator/youtube.js";
import UM from "./um/um.js";

// ip getter
const getip = (req) => req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress;

// ----- database connection -----
const pool = await mysql.createPool({
  host: process.env.DB_MYSQL_HOST,
  user: process.env.DB_MYSQL_USER,
  database: process.env.DB_MYSQL_DATABASE,
  password: process.env.DB_MYSQL_PASSWORD,
  idleTimeout: 10000,
  enableKeepAlive: true
})

const db = drizzle(pool, { schema, mode: "default" });

// request wrapper
const ww = new utils.WebWrapper();

// ----- navigation and extraction -----
var navigators = {
  // lastfm: new YouTubeNavigator(ww),
  lastfm: new LastFmNavigator(ww),
  youtube: new YouTubeNavigator(ww)
};

var extractors = {
  youtube: new YouTubeExtractor(ww, db)
}

// ----- users manager -----
var um = new UM(db);

// ----- logger -----
async function log(origin, req, { vid='', name='', subname='' }) {
  try {
    await db.insert(schema.logs)
      .values({
        ip: getip(req).substring(0, 32),
        date: new Date(),
        type: origin.substring(0, 8),
        vid, name, subname
      })
  } catch(err) {
    console.error(err);
  }
}

// ----- debugger -----
const d = process.env.MEW_DEBUG ? true : false;
if (d) console.log('DEBUG mode');

if (d && !fs.existsSync("./debug")) {
  fs.mkdirSync("./debug");
}

// debug middleware
function dmw(req, res, next) {
  const regex = /[^a-zA-Z0-9]/gi;
  const fpath = './debug/' + decodeURIComponent(req.originalUrl).replaceAll(regex, '_') + '.json'
  if (d && fs.existsSync(fpath)) {
    res.json(JSON.parse(fs.readFileSync(fpath)))
  } else {
    const originalSend = res.send;
    res.send = function(body) {
      if (d) fs.writeFileSync(fpath, body);
      originalSend.call(this, body);
    };
    next();
  }
}

// ----- web server -----
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// throttling
const limiter = rateLimit({
  windowMs: 1 * 1000, // 1 second
  limit: 4,
  keyGenerator: getip
})

// app.use(limiter);

// ----- API itself -----

app.get('/api/search_suggestions/:query', async (req, res) => {
  const results = await navigators.youtube.searchSuggestions(req.params.query);
  res.json(results);
})

app.get('/api/search/:query', dmw, async (req, res) => {
  const results = await navigators.youtube.search(req.params.query);
  log('search', req, { name: req.params.query });
  res.json(results);
});

app.get('/api/artist/:id', dmw, async (req, res) => {
  const artist = await navigators.youtube.artist(req.params.id);
  res.json(artist);
})

app.get('/api/album/:id', dmw, async (req, res) => {
  const album = await navigators.youtube.album(req.params.id);
  res.json(album);
})

app.get('/api/album/:arid/:alid', dmw, async (req, res) => {
  const album = await navigators.lastfm.album(req.params.arid + '/' + req.params.alid);
  res.json(album);
})

app.get('/api/video/:id', dmw, async (req, res) => {
  const obj = { id: req.params.id };
  var params = utils.parseQueryString(req._parsedUrl.query);
  if (params.queueId) obj.queueId = params.queueId;
  if (params.qid) obj.queueId = params.qid;
  if (params.wq) obj.withQueue = true;
  const video = await extractors.youtube.getVideo(obj);
  log('song', req, { vid: req.params.id, name: video.video.title, subname: video.video.artist });
  res.json(video);
})

app.get('/api/img', (req, res) => {
  var params = utils.parseQueryString(req._parsedUrl.query);
  ww.get(
    "thumbnail", "png",
    params.url,
    { responseType: 'stream' }
  ).then(axres => {
      res.status(200);
      axres.pipe(res);
  }).catch(err => {
      res.status(500);
      res.json({ message: err.toString() })
  })
})

app.get('/api/colors', async (req, res) => {
  var params = utils.parseQueryString(req._parsedUrl.query);
  if (!params.id) throw new Error("No id provided.");
  if (!params.url) throw new Error("No url provided.");
  const palette = await extractors.youtube.getColors(params.id, params.url);
  res.json(palette);
})

// ----- um -----
app.post('/api/um/signup', (req, res, next) => um.createUser(req, res, next), (req, res) => um.logUser(req, res));
app.post('/api/um/login', (req, res) => um.logUser(req, res));

const authenticateJWT = (req, res, next) => {
  const token = req.headers.authorization;
  if (token) {
    jsonwebtoken.verify(token, um.SECRET_KEY, (err, user) => {
      if (err) {
        return res.sendStatus(403);
      }
      req.user = user;
      next();
    });
  } else {
    res.sendStatus(401);
  }
};

app.post('/api/um/relog', authenticateJWT, (req, res) => um.reLogUser(req, res));
app.post('/api/pl/get', (req, res) => um.getPlaylist(req, res));
app.post('/api/pl/create', authenticateJWT, (req, res) => um.createPlaylist(req, res));
app.post('/api/pl/delete', authenticateJWT, (req, res) => um.removePlaylist(req, res));
app.post('/api/pl/rename', authenticateJWT, (req, res) => um.renamePlaylist(req, res));
app.post('/api/pl/add', authenticateJWT, (req, res) => um.addToPlaylist(req, res, extractors.youtube));
app.post('/api/pl/remove', authenticateJWT, (req, res) => um.removeFromPlaylist(req, res));
app.post('/api/um/playlists', authenticateJWT, (req, res) => um.getPlaylists(req, res));
app.get('/api/um/user/:uname', (req, res) => um.getUser(req, res));

const PORT = process.env.PORT_API || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
