import { and, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jsonwebtoken from "jsonwebtoken";
import { playlists, playlistSongs, songs, userPlaylists, users } from "../db/schema.js";

export default class UM {
  constructor(db) {
    this.db = db;
    this.SECRET_KEY = "ejefiopa ef jckdlsmfjkp"
  }

  generateId() {
    let uid = '';
    let chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    for (let i = 0; i < 32; i++) {
      uid += chars[Math.floor(Math.random() * chars.length)];
    }
    return uid;
  }

  async generateTableId(table) {
    var uid;
    // generate a random unused uid
    while (true) {
      uid = this.generateId();
      var rows = await this.db
        .select()
        .from(table)
        .where(eq(table.id, uid));
      if (rows.length == 0) return uid;
    }
  }

  async createUser(req, res, next) {
    try {
      if (!req.body.username) return res.status(300).send("Field username not specified")
      if (!req.body.password) return res.status(300).send("Field password not specified")
      const { username, password } = req.body;
      const existing = await this.db.select().from(users).where(eq(users.name, username));
      if (existing.length > 0) return res.status(300).send("This username is already taken");
      const hash = bcrypt.hashSync(password);
      await this.db.insert(users).values({ name: username, hash });
      next();
    } catch(err) {
      console.error(err);
      res.status(500).send(err.toString());
    }
  }

  async logUser(req, res) {
    try {
      if (!req.body.username) return res.status(300).send("Field username not specified")
      if (!req.body.password) return res.status(300).send("Field password not specified")
      const { username, password } = req.body;
      var existing = await this.db.select().from(users).where(eq(users.name, username));
      if (existing.length == 0) return res.status(300).send("This user does not exist");
      const user = existing[0];
      if (!bcrypt.compareSync(password, user.hash)) return res.status(300).send("Wrong password");
      const token = jsonwebtoken.sign({ id: user.id, name: username }, this.SECRET_KEY, { expiresIn: '10d' });
      res.status(200).json({ token, name: username });
    } catch(err) {
      console.error(err);
      res.status(500).send(err.toString());
    }
  }

  async reLogUser(req, res) {
    try {
      var existing = await this.db.select().from(users).where(eq(users.name, req.user.name));
      if (existing.length == 0) return res.status(300).send("This user does not exist");
      const token = jsonwebtoken.sign({ id: req.user.id, name: req.user.name }, this.SECRET_KEY, { expiresIn: '10d' });
      res.status(200).json({ token, name: req.user.name });
    } catch(err) {
      console.error(err);
      res.status(500).send(err.toString());
    }
  }

  async localGetPlaylist(pid) {
    var infoRes = await this.db
      .select()
      .from(userPlaylists)
      .where(eq(userPlaylists.pid, pid))
      .innerJoin(users, eq(users.id, userPlaylists.uid))
      .innerJoin(playlists, eq(playlists.id, userPlaylists.pid));

    if (infoRes.length == 0) throw "Playlist not found";

    var songsRes = await this.db
      .select()
      .from(userPlaylists)
      .where(eq(userPlaylists.pid, pid))
      .innerJoin(playlists, eq(playlists.id, userPlaylists.pid))
      .innerJoin(playlistSongs, eq(playlistSongs.pid, playlists.id))
      .innerJoin(songs, eq(songs.id, playlistSongs.sid));

    return {
      id: pid,
      name: infoRes[0].playlists.name,
      created: infoRes[0].playlists.created,
      modified: infoRes[0].playlists.modified,
      user: {
        id: infoRes[0].users.id,
        name: infoRes[0].users.name
      },
      songs: songsRes.map(songRes => {
        return {
          ...songRes.songs,
          added: songRes.playlistsongs.added
        }
      })
    };
  }

  async getPlaylist(req, res) {
    try {
      if (!req.body.pid) return res.status(300).send("Field pid not specified");
      const { pid } = req.body;
      const playlist = await this.localGetPlaylist(pid);
      res.status(200).json(playlist);
    } catch(err) {
      console.error(err);
      res.status(300).send(err.toString());
    }
  }

  async createPlaylist(req, res) {
    try {
      if (!req.body.name) return res.status(300).send("Field name not specified");
      var { name } = req.body;
      name = name.substring(0, 128);
      var pid = await this.generateTableId(playlists);
      await this.db.insert(playlists).values({ id: pid, name, created: new Date(), modified: new Date() });
      await this.db.insert(userPlaylists).values({ uid: req.user.id, pid });
      var date = new Date();
      res.status(200).json({ id: pid, name, songsIds: [], created: date, modified: date });
    } catch(err) {
      console.error(err);
      res.status(500).send(err.toString());
    }
  }

  async getPlaylists(req, res) {
    try {
      var playlistsRes = await this.db
        .select()
        .from(users)
        .where(eq(users.id, req.user.id))
        .innerJoin(userPlaylists, eq(users.id, userPlaylists.uid))
        .innerJoin(playlists, eq(userPlaylists.pid, playlists.id))
      var response = [];
      for (const playlistRes of playlistsRes) {
        var playlistSongsRes = await this.db
          .select()
          .from(playlistSongs)
          .where(eq(playlistSongs.pid, playlistRes.playlists.id));
        response.push({
          id: playlistRes.playlists.id,
          name: playlistRes.playlists.name,
          created: playlistRes.playlists.created,
          modified: playlistRes.playlists.modified,
          songsIds: playlistSongsRes.map(psr => psr.sid),
        })
      }
      res.status(200).json(response);
    } catch(err) {
      console.error(err);
      res.status(500).send(err.toString());
    }
  }

  async addToPlaylist(req, res, ytm) {
    try {
      if (!req.body.pid) return res.status(300).send("Field pid not specified");
      if (!req.body.sid) return res.status(300).send("Field sid not specified");
      const { pid, sid } = req.body;
      if (!sid.match(/^[a-zA-Z0-9_-]{11}$/)) return res.status(300).send("Invalid id");
      var pl = await this.localGetPlaylist(pid);
      if (pl.user.id != req.user.id) return res.status(401).send("Unauthorized");

      for (const song of pl.songs) {
        // song already in
        if (song.id == sid) return res.status(200).send();
      }

      const songsRes = await this.db.select().from(songs).where(eq(songs.id, sid));
      if (songsRes.length == 0) ytm.getVideo({ id: sid });
      await this.db.insert(playlistSongs).values({ pid, sid });
      await this.db.update(playlists).set({ modified: new Date() }).where(eq(playlists.id, pid));
      return res.status(200).send();
    } catch(err) {
      console.error(err);
      res.status(500).send(err.toString())
    }
  }
  
  async removeFromPlaylist(req, res) {
    try {
      if (!req.body.pid) return res.status(300).send("Field pid not specified");
      if (!req.body.sid) return res.status(300).send("Field sid not specified");
      const { pid, sid } = req.body;
      if (!sid.match(/^[a-zA-Z0-9_-]{11}$/)) return res.status(300).send("Invalid id");
      var pl = await this.localGetPlaylist(pid);
      if (pl.user.id != req.user.id) return res.status(401).send("Unauthorized");

      await this.db.delete(playlistSongs).where(and(eq(playlistSongs.pid, pid), eq(playlistSongs.sid, sid)));
      await this.db.update(playlists).set({ modified: new Date() }).where(eq(playlists.id, pid));
      return res.status(200).send();
    } catch(err) {
      console.error(err);
      res.status(500).send(err.toString())
    }
  }

  async removePlaylist(req, res) {
    try {
      if (!req.body.pid) return res.status(300).send("Field pid not specified");
      const { pid } = req.body;
      await this.db.delete(userPlaylists).where(eq(userPlaylists.pid, pid));
      await this.db.delete(playlistSongs).where(eq(playlistSongs.pid, pid));
      await this.db.delete(playlists).where(eq(playlists.id, pid));
      res.status(200).json({});
    } catch(err) {
      console.error(err);
      res.status(500).send(err.toString());
    }
  }

  async renamePlaylist(req, res) {
    try {
      if (!req.body.pid) return res.status(300).send("Field pid not specified");
      if (!req.body.name) return res.status(300).send("Field name not specified");
      var { pid, name } = req.body;
      name = name.substring(0, 128);
      await this.db.update(playlists).set({ name, modified: new Date() }).where(eq(playlists.id, pid));
      res.status(200).json({});
    } catch(err) {
      console.error(err);
      res.status(500).send(err.toString());
    }
  }
}