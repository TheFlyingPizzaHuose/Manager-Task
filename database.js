const mongooseClient = require("mongoose");
const mongoosePaginate = require('mongoose-paginate-v2');

mongooseClient.connect("mongodb://localhost/tasks", {useNewUrlParser:true, useUnifiedTopology:true},(err)=>{
    if(err) console.log(err);
});

const NotesSchema = mongooseClient.Schema({title: String, description: String, date: String, priority: Number, user: String, repeatPeriod: Number}, {timestamps: true},)

NotesSchema.plugin(mongoosePaginate);
const Notes = mongooseClient.model("Notes", NotesSchema);

module.exports = Notes;

