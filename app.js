//jshint esversion:6
require('dotenv').config();
const express = require("express");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportlocalmongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github').Strategy;
const findOrCreate = require("mongoose-findorcreate");
const app = express();



app.use(express.urlencoded({extended:true}));
app.use(express.static("public"));
app.set('view engine','ejs');

app.use(session({
    secret: 'This is new Secret.',
    resave: false,
    saveUninitialized: false
  }));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/SecretDB", {useNewUrlParser: true,useUnifiedTopology:true});
mongoose.set("useCreateIndex", true);
const userSchema = new mongoose.Schema({
    email: String,
    password : String,
    Google_Id : String,
    Github_Id : String,
    Secret: String,
});

userSchema.plugin(passportlocalmongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("user", userSchema);

passport.use(User.createStrategy());
passport.serializeUser(function(user, done) {
    done(null, user.id);
  });
  
  passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
      done(err, user);
    });
  });

passport.use(new GoogleStrategy({
    clientID: process.env.Client_ID_google,
    clientSecret: process.env.Client_SECRET_google,
    callbackURL: "http://localhost:3000/auth/google/secrets"
  },
  function(accessToken, refreshToken, profile, cb) {
      console.log(profile);
    User.findOrCreate({  Google_Id: profile.id, username: profile.email}, function (err, user) {
      return cb(err, user);
    });
  }
));

passport.use(new GitHubStrategy({
    clientID: process.env.Client_ID_github,
    clientSecret:process.env.Client_SECRET_github,
    callbackURL: "http://localhost:3000/auth/github/secrets"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ Github_Id: profile.id , username: profile.email}, function (err, user) {
      return cb(err, user);
    });
  }
));

app.get("/",function(req,res){
    res.render("home");
});
app.get("/login",function(req,res){
    res.render("login");
});
app.get("/register",function(req,res){
    res.render("register");
});
app.get("/secrets",function(req,res){
    User.find({"Secret":{$ne:null}},function(err,foundusers){
        if(err){
            console.log(err);
        }
        else{
            if(foundusers){
                res.render("secrets",{userwithSecrets: foundusers});
            }
        }
    })
});
app.get("/submit",function(req,res){
    if(req.isAuthenticated()){
        res.render("submit");
    }
    else{
        res.redirect("/login");
    }
});
app.get("/logout",function (req,res){
    req.logout();
    res.redirect("/");
});

app.get("/auth/google",
  passport.authenticate('google', { scope: ["profile"] })
);

app.get("/auth/google/secrets", 
passport.authenticate("google", { failureRedirect: "/login" }),
function(req, res) {
    // Successful authentication, redirect to secrets.
    res.redirect("/secrets");
});

app.route("/auth/github")
    .get(passport.authenticate("github",{
        scope:["profile"]
    }));

app.get("/auth/github/secrets", 
passport.authenticate("github", { failureRedirect: "/login" }),
function(req, res) {
    // Successful authentication, redirect to secrets.
    res.redirect("/secrets");
});
app.post("/register",function(req,res){
    User.register({username:req.body.username}, req.body.password, function(err,userinfo){
        if(err){
            console.log(err);
            res.redirect("/register");
        }
        else{
            passport.authenticate("local")(req,res,function(){
                res.redirect("/secrets");
            });
        }
    })
});

app.post("/login",function(req,res){
    const user = new User({
        username: req.body.username,
        password: req.body.password
    });

    req.login(user,function(err){
        if(err){
            console.log(err);

        }
        else{
            passport.authenticate("local")(req,res,function(){
                res.redirect("/secrets");
            });
        }
    });
});
app.post("/submit",function(req,res){
    const secret = req.body.secret;
    User.findById(req.user.id,function(err,founduser){
        if(err){
            console.log(err);
        }
        else{
            if(founduser){
                founduser.Secret = secret;
                founduser.save(function(){
                    res.redirect("/secrets");
                });
            }
           
        }
    });
    
});
app.listen(3000, function(){
    console.log("Sucessfully started the Server");
});