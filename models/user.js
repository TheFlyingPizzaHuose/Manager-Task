const mongoose = require("mongoose");
const passportLocalMongoose = require("passport-local-mongoose");

mongoose.createConnection("mongodb://localhost/auth_app",
{useNewUrlParser: true, useUnifiedTopology: true},(err)=>{
    if(err) console.log(err);
});

//Create Model
const Schema = mongoose.Schema;
const User = new Schema({
    username: String,
    password: String
});

//Export Model
User.plugin(passportLocalMongoose);
module.exports = mongoose.model('userData', User, 'userData');