import express from "express";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./db/schema.js";
import * as utils from "./ytm/utils.js"
import YTM from "./ytm/ytm.js";

// ----- database connection -----
const connection = await mysql.createConnection({
  host: process.env.DB_MYSQL_HOST,
  user: process.env.DB_MYSQL_USER,
  database: process.env.BD_MYSQL_DATABASE,
  password: process.env.DB_MYSQL_PASSWORD
})

const db = drizzle(connection, { schema, mode: "default" });

// ----- youtube extractor -----
var ytm = new YTM(db);

// ----- logger -----
async function log(origin, req, { vid='', name='', subname='' }) {
  var ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  ip = ip.substring(0, 16)
  origin = origin.substring(0, 4);
  try {
    await db.insert(schema.logs)
      .values({
        ip,
        date: new Date(),
        type: origin,
        vid, name, subname
      })
  } catch(err) {
    console.error(err);
  }
}

// ----- web server -----
const app = express();

app.get('/api/search_suggestions/:query', async (req, res) => {
  const results = await ytm.getSearchSuggestions(req.params.query);
  res.json(results);
})

app.get('/api/search/:query', async (req, res) => {
  const results = await ytm.getSearch(req.params.query);
  log('search', req, { name: req.params.query });
  res.json(results);
});

app.get('/api/artist/:id', async (req, res) => {
  const artist = await ytm.getArtist(req.params.id);
  res.json(artist);
})

app.get('/api/album/:id', async (req, res) => {
  const album = await ytm.getAlbum(req.params.id);
  res.json(album);
})

app.get('/api/video/:id', async (req, res) => {
  const obj = { id: req.params.id };
  const video = await ytm.getVideo(obj);
  log('song', req, { vid: req.params.id, name: video.video.title, subname: video.video.artist });
  res.json(video);
})

app.get('/api/colors', async (req, res) => {
  var params = utils.parseQueryString(req._parsedUrl.query);
  if (!params.id) throw new Error("No id provided.");
  if (!params.url) throw new Error("No url provided.");
  const palette = await ytm.getColors(params.id, params.url);
  res.json(palette);
})

const PORT = process.env.PORT_MEW_API || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});