const Router = require('express').Router();

let id=0;

Router.get('/:_id',(req, res, next)=>{
    id = req.params._id;
    req.id = req.params._id;
    console.log('in get middleware');
    next();
})

Router.post('/',(req, res, next)=>{
    console.log('in post middleware');
    req.id=id;
    next();
})

module.exports = Router;