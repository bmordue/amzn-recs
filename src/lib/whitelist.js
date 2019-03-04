var sqlite = require("sqlite3").verbose();
var util = require("util");

const WHITELIST_TABLE_NAME = "api_whitelist";

function Whitelist(options) {
    this.options = options || {};
    var dbPath = this.options.dbPath || ":memory:";
    try {
        this.db = new sqlite.Database(dbPath);
    } catch (e) {
        console.log(e);
        this.db = null;
    }
}

Whitelist.prototype.add = function(token, callback) {
    var db = this.db;
    try {
        db.serialize(function() {
            var createTableQuery = util.format("CREATE TABLE IF NOT EXISTS %s (token TEXT UNIQUE)", WHITELIST_TABLE_NAME);
            db.run(createTableQuery, function(err) {
                if (err) {
                    return callback(err);
                }
                var addTokenQuery = util.format("INSERT OR IGNORE INTO %s VALUES (?)", WHITELIST_TABLE_NAME);
                db.run(addTokenQuery, token, callback);
            });
        });
    } catch (e) {
        return callback(e);
    }
};

Whitelist.prototype.check = function(token, callback) {
    var db = this.db;
    try {
        db.serialize(function() {
            var queryStr = util.format("SELECT * FROM %s WHERE token = (?)", WHITELIST_TABLE_NAME);
            db.all(queryStr, token, function(err, rows) {
                if (err) {
                    return callback(err);
                }
                var whitelisted = (rows.length > 0);
                callback(null, whitelisted);
            });
        });
    } catch (e) {
        return callback(e);
    }
};

module.exports = Whitelist;
