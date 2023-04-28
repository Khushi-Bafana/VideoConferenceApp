/*
    File Name:- database.js
    Explanation:- This file is used to create a instance of the database
    This will get the mysql driver code from node modules and use export itself
    as a module so it can be used in multiple files
*/
const mysql = require('mysql2');

const dbConnection = mysql.createPool({
    host     : 'localhost',
    user     : 'root',
    password : '',
    database : 'lainVideoAppDB'
}).promise();

module.exports = dbConnection;