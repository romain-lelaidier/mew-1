import express from "express";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
// import YTM from "./ytm.js";

// ----- database connection -----
const connection = mysql.createConnection({
  host: process.env.DB_MYSQL_HOST,
  user: process.env.DB_MYSQL_USER,
  database: process.env.BD_MYSQL_DATABASE,
  password: process.env.DB_MYSQL_PASSWORD
})

const db = drizzle({ client: connection });

// ----- youtube extractor -----
// var ytm = new YTM();
// ytm.init();


// ----- web server -----
const app = express();

app.get('/search/:query', async (req, res) => {
  const results = [] // await fetchResult(req.params.query);
  res.json(results);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});