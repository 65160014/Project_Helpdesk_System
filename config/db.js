const mysql = require('mysql2');

const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'helpdeskdb'
});

module.exports = db.promise();
