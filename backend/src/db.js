const sqlite3 = require('sqlite3').verbose();

class Database {
  constructor(filepath) {
    this.db = new sqlite3.Database(filepath);
    this.init();
  }

  init() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS assets (
        id INTEGER PRIMARY KEY,
        computerName TEXT,
        pcUser TEXT,
        modelNumber TEXT,
        serial TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  addAsset(computerName, pcUser, modelNumber, serial) {
    this.db.run(
      'INSERT INTO assets (computerName, pcUser, modelNumber, serial) VALUES (?, ?, ?, ?)',
      [computerName, pcUser, modelNumber, serial]
    );
  }

  getAllAssets() {
    return new Promise((resolve) => {
      this.db.all('SELECT * FROM assets ORDER BY createdAt DESC', [], (err, rows) => {
        resolve(rows || []);
      });
    });
  }
}

module.exports = Database;