//Referencing dependecies
const express = require('express');
const passport = require("passport");
const body_parser = require("body-parser");
const path = require('path');
const pug = require('pug');
const Notes = require('./database');
const updateRouter = require('./update-router');
const LocalStrategy = require("passport-local");
const User = require("./models/user");
const { findByIdAndRemove } = require('./database');
const { GridFSBucketReadStream } = require('mongodb');
const { time } = require('console');
const app = express();
let date_ob = new Date();

//Setup pug.js as view engine
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, "views"));

//Setup urlencoding/decoding
app.use(body_parser.urlencoded({extened:true}));

app.use(body_parser.json());
app.use('/task-edit', updateRouter);

app.use((req, res, next) =>{
    console.log(req.method + ":" + req.url);
next();
})

app.use(require("express-session")({
    secret: "TMG",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

//Redirect localhost/3000 to /index
app.get("/", (req, res, next)=>{
    res.render('login')
})

//Listen for /register
app.get("/register", function(req,res){
    res.render("register");
})
app.post("/register", function(req,res){
    var username = req.body.username;
    var password = req.body.password;
    if(password.length < 8){
        return res.render("register", {alert: "Password Must Be Longer Than 8 Character"})
    }
    User.register(new User({username: username}), 
        password, function(err, user){
            if(err){
                console.log(err);
                return res.render("register");
            }
            passport.authenticate("local")(
                req, res, function(){
                    res.redirect("/deadlines");
                }
            )
        })
})

//Listen for /login
app.get("/login", function(req,res){
    res.render("login");
})
app.post("/login", passport.authenticate("local", {
    successRedirect: "/deadlines",
    failureRedirect: "/login"
}), function(req,res){
})

//Listen for /logout
app.get("/logout", function(req, res){
    req.logout();
    res.redirect("/");
});
//Checks for if user is logged in
function isLoggedIn(req, res, next){
    if(req.isAuthenticated()) return next();
    res.redirect("/login");
}

//Listen for /index/priorities and send data
app.get('/deadlines', isLoggedIn, (req, res, next)=>{
    try{
        Notes.find({user: req.user.id}).exec((err, document)=>{
            if(err) console.log(err);
            let data=[];
            let dates=[];
            //Sorting for Deadlines
            document.forEach((value, i)=>{
                var date = value.date;
                var temp = chkOverAndRepeat(date, value.repeatPeriod);
                var isOverdue = temp[0]
                dates.push([parseInt(temp[1].getFullYear() + temp[1].getMonth() + temp[1].getDate()), 
                            i, 
                            isOverdue, 
                            temp[1].getFullYear() +"-"+ temp[1].getMonth() +"-"+ temp[1].getDate()]);
            })
            dates.sort(sortFunction2);
            //Sorting function
            function sortFunction2(a, b) {
                if (a[0] == b[0]) {
                    return 0;
                }
                else {
                    return (a[0] < b[0]) ? -1 : 1;
                }
            }
            for(i=0; i<document.length; i++){
                var temp = document[dates[i][1]];
                temp.overdue = dates[i][2];
                temp.date = dates[i][3]
                data.push(temp);
            }
            res.render('main', {user: req.user, Data: data})
        })
    }
    catch{
        res.redirect('/login');
    }
})

//Listen for /index/priorities and send data
app.get('/priorities', isLoggedIn, (req, res, next)=>{
    Notes.find({user:req.user.id}).exec((err, document)=>{
        if(err) console.log(err);
        let data=[];
        let priorities=[];
        //Sorting for Priorities
        document.forEach((value, i)=>{
            var date = value.date;
            //Check if date is passed
            var temp = chkOverAndRepeat(date, value.repeatPeriod);
            var isOverdue = temp[0]
            priorities.push([value.priority, 
                             i, 
                             isOverdue, 
                             temp[1].getFullYear() +"-"+ temp[1].getMonth() +"-"+ temp[1].getDate()]);
        })
        priorities.sort(sortFunction);
        //Sorting function
        function sortFunction(a, b) {
            if (a[0] == b[0]) {
                return 0;
            }
            else {
                return (a[0] > b[0]) ? -1 : 1;
            }
        }
        for(i=0; i<document.length; i++){
            var temp = document[priorities[i][1]];
            temp.overdue = priorities[i][2];
            temp.date = priorities[i][3];
            data.push(temp);
        }
        res.render('main', {user: req.user, Data: data})
    })
})

//Listen for /search
app.get('/search?' , isLoggedIn, (req,res,next)=>{
    const {page} = req.query;
    const options = {
        sort: { updatedAt: -1 },
        pagination: false,
    }
    Notes.paginate({user: req.user.id, "title":new RegExp('.*' + req.query.search + '.*', 'i')}, options,
        function (err, results) {
            if(err) res.redirect("/deadlines"); {
                var noresults;
                results.docs === undefined || results.docs.length == 0? noresults = true : noresults = false;
                res.render('main',{user: req.user,
                Data: results.docs,
                Noresults: noresults
            })
        }
    })
})

//Listen for /task-add and send task-add.pug
app.route("/task-add", isLoggedIn)
    .get((req,res,next)=>{
        res.render('task-add');
})

//Post data from task-add to database
.post((req,res,next)=>{
    console.log(req.body);
    const Note = new Notes ({})

    Note.title = req.body.title
    Note.description = req.body.description
    Note.date = req.body.date
    Note.priority = req.body.priority
    Note.user = req.user.id
    Note.repeatPeriod = req.body.repeatPeriod

    Note.save((err, product)=>{
        if(err)console.log(err);
        console.log(product);
    })
    res.redirect('/deadlines')
})

//Listen for /task-edit and send task-edit.pug along with data
app.get('/task-edit/:_id', isLoggedIn ,(req,res)=>{
    console.log('id for get request: ' + req.id);
    Notes.findById(req.id,(err,document)=>{
        console.log(document);
        res.render('task-edit',{data:document});
    })
})

//Post task-edit data to database
app.post('/task-edit', isLoggedIn , (req,res,next)=>{
    console.log('id: ' + req.id);
    Notes.findByIdAndUpdate(req.id, {title: req.body.title, description:req.body.description, date: req.body.date, priority: req.body.priority, repeatPeriod: req.body.repeatPeriod},{useFindAndMondify:false}
        ,(err,document)=>{
            console.log('updated');
        })
    res.redirect('/deadlines');
    return next();
})

//Listens for /delete and deletes the corresponding data in the database
app.get("/delete/:_id", isLoggedIn ,(req,res,next)=>{
    Notes.findByIdAndRemove(req.params._id,{useFindAndModify: false}, (err,document)=>{
        if(err) console.log(err)
        console.log(document);
    })
    res.redirect('/deadlines');
})

function chkOverAndRepeat(date, repeatPeriod){
    //Check if date is passed
    var isOverdue = "";
    if(repeatPeriod){
        var currentDate = new Date()
        var taskDate = new Date(date.slice(0,4) + "-" + date.slice(5, 7) + "-" + date.slice(8, 10))
        var timeDiff = currentDate.getTime() - taskDate.getTime();
        var dayDiff = Math.ceil(Math.abs(timeDiff/86400000))
        var adjDeadline = new Date(taskDate.getTime() + Math.ceil(dayDiff/repeatPeriod)*86400000*repeatPeriod)
        return timeDiff<0?["(Will Repeat)", new Date(date)]:[repeatPeriod - dayDiff%repeatPeriod + " days left", adjDeadline]
    }else{
        var OverYear = false,OverMonth = false,OverDate = false;
        var eqYear = false, eqMonth = false;
        console.log(date)
        if(parseInt(date.slice(0,4)) < date_ob.getFullYear()){OverYear = true;}
        if(parseInt(date.slice(0,4)) == date_ob.getFullYear()){eqYear = true;}
        if(parseInt(date.slice(5, 7)) < date_ob.getMonth()+1){OverMonth = true;}
        if(parseInt(date.slice(5, 7)) == date_ob.getMonth()+1){eqMonth = true;}
        if(parseInt(date.slice(8, 10)) < date_ob.getDate()){OverDate = true;}
        if(OverYear){
            isOverdue = " OVERDUE!";
        }else if(OverMonth && eqYear){
            isOverdue = " OVERDUE!";
        }else if(OverDate && eqMonth){
            isOverdue = " OVERDUE!";
        }
    }
    return [isOverdue, new Date(date)];
}

app.listen(3000);