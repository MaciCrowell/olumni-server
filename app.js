
/**
 * Module dependencies.
 */

var express = require('express')
  , http = require('http')
  , path = require('path')
  , mongojs = require('mongojs')
  , MongoStore = require('connect-mongo')(express);

var app = express(), db;

app.configure(function () {
  db = mongojs(process.env.MONGOLAB_URI || 'olumni', ['courses','mySessions','groups','posts']);
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.set('secret', process.env.SESSION_SECRET || 'terrible, terrible secret')
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser(app.get('secret')));
  app.use(express.session({
    secret: app.get('secret'),
    store: new MongoStore({
      url: process.env.MONGOLAB_URI || 'mongodb://localhost/weachieve'
    })
  }));
  app.use(app.router);
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function () {
  app.set('host', 'localhost:3000');
  app.use(express.errorHandler());
});

app.configure('production', function () {
  app.set('host', 'weachieveserver.herokuapp.com');
});

/**
 * Helpful
 */

function validateShort (name) {
  return String(name).substr(0, 25);
}

function validateLong (tweet) {
  return String(tweet).substr(0, 140);
}

function validateUsername (name) {
  return String(name).substr(0, 25);
}

function validateTweet (tweet) {
  return String(tweet).substr(0, 140);
}

/**
 * Routes
 */

app.get('/', function (req, res) {
  res.redirect('https://github.com/MaciCrowell/olumni-server');
})

app.get('/secret', function (req, res) {
  db.groups.find({
    published: true
  }).sort({date: -1}, function (err, docs) {
    console.log(docs);
    res.render('index', {
      title: 'Olumni',
      quotes: docs,
      user: {}
    });
  })
});

RegExp.escape= function(s) {
    return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
};

/**
 * get all groups
 */

app.get('/groups', function (req, res) {
  db.groups.distinct('group', function (err, names) {
    res.json({"groups": names});
  });
})

/**
 * get groups user is in 
 */

app.get('/:username/groups', function (req, res) {
  db.groups.find({
    username: validateUsername(req.params.username)
  }, function (err, docs) {
    res.json({
      "groups": docs.map(function (entry) {
        return entry.group;
      })
    });
  })
});

/**
 * add user to group
 */

app.post('/:username/group', function (req, res) {
  if (req.params.username) {
    db.groups.findOne({
      username: validateShort(req.params.username),
      group: validateShort(req.body.group)
    }, function (err, found) {
      if (!found) {
        db.groups.save({
          username: req.params.username,
          group: req.body.group,
        }, res.json.bind(res, {"error": false, message: '1'}));
      } else {
        res.json({"error": false, message: '2'})
      }
    });
  } else {
    res.json({error: true, message: 'Invalid add group request'}, 500);
  }
})

/**
 * delete group for user
 */

app.post('/:username/delGroup', function (req, res) {
  db.groups.remove({
    username: validateShort(req.params.username),
    group: validateLong(req.body.group)
  }, function (err) {
    res.json({"error": err})
  })
});

/**
 * create post
 */

app.post('/createPost', function (req, res) {
  if (req.body.subject && req.body.reply && req.body.message && req.body.parentItem && req.body.date && req.body.username && req.body.viewers) {
    id = db.ObjectId();
    db.posts.save({
      group: req.body.group,
      parent: req.body.parentItem,
      username: req.body.username,
      date: req.body.date,
      lastDate: req.body.date,
      message: req.body.message,
      subject: req.body.subject,
      resolved: 'false',
      viewers: req.body.viewers.split("&"),
      reply: req.body.reply,
      _id: id
    });
    console.log('true'.localeCompare(req.body.reply) == 0)
    if ('true'.localeCompare(req.body.reply)== 0) {
      db.posts.update(
            {_id: db.ObjectId(req.body.parentItem)},
            { $set : { lastDate: req.body.date} }
          )
    }
    res.json({error: false, postid: id});
  } else {
    res.json({error: true, message: 'Invalid post add request'}, 500);
  }
})

app.post('/:username/getMissingPosts', function (req, res) {
 localIDs = req.body.postIDs.split('&').map(function(x){return db.ObjectId(x)});
 localGroups = req.body.groups.split('&');
 console.log(localGroups)
 var query = { 
    group: { $in: localGroups },
    viewers: { $in: ['public', req.params.username] },
    _id: { $nin: localIDs}
  };
  if ('q' in req.query) {
    query.posts = {$regex: ".*" + req.query.q + ".*"};
  }
  db.posts.find(query).sort({date: -1}, function (err, docs) {
    console.log(docs)
    res.json({"posts": docs});
  })
  //console.log(serverIDs)
});
/**
 * get all posts
 */

app.get('/posts', function (req, res) {
  var query = { 

  };
  if ('q' in req.query) {
    query.posts = {$regex: ".*" + req.query.q + ".*"};
  }
  db.posts.find(query).sort({date: -1}, function (err, docs) {
    res.json({"posts": docs});
  })
});

/**
 * get posts from ids
 */

app.get('/:username/getPosts/:postIDs', function (req, res) {
  console.log(req.params.postIDs);
  ids = req.params.postIDs.split('&').map(function(x){return db.ObjectId(x)});
  console.log(ids);
  var query = { 
    viewers: { $in: ['public', req.params.username] },
    _id: { $in: ids }
  };
  if ('q' in req.query) {
    query.posts = {$regex: ".*" + req.query.q + ".*"};
  }
  db.posts.find(query).sort({date: -1}, function (err, docs) {
    res.json({"posts": docs});
  })
});



app.get('/:username/:parentName/postsIDs', function (req, res) {
  var query = { 
    viewers: { $in: ['public', req.params.username] },
    parent: req.params.parentName
  };
  if ('q' in req.query) {
    query.posts = {$regex: ".*" + req.query.q + ".*"};
  }
  db.posts.find(query).sort({date: -1}, function (err, docs) {
    res.json({
      "postIDs": docs.map(function (entry) {
        return entry._id;
      })
    });
  })
});

/**
 * allow user to view post
 */

app.post('/:postID/addViewer', function (req, res) {
  if (req.body.username) {
        db.posts.update(
          {_id: db.ObjectId(req.params.postID)},
          { $addToSet : { viewers: validateUsername(req.body.username) } }
        )
        res.json({error: false});
  } else {
    res.json({error: true, message: 'Invalid add user request'}, 500);
  }
});

/**
 * make post resolved
 */

app.post('/:postID/resolved', function (req, res) {
  if (req.body.resolved) {
    console.log(db.ObjectId(req.params.postID));
    console.log(req.body.resolved);
        db.posts.update(
          {_id: db.ObjectId(req.params.postID)},
          { $set : { resolved: req.body.resolved } }
        )
        res.json({error: false});
  } else {
    res.json({error: true, message: 'Invalid add user request'}, 500);
  }
});

/**
 * get child posts
 */

app.get('/:username/:parentName/posts', function (req, res) {
  var query = { 
    viewers: { $in: ['public', req.params.username] },
    parent: req.params.parentNamefindO
  };
  if ('q' in req.query) {
    query.posts = {$regex: ".*" + req.query.q + ".*"};
  }
  db.posts.find(query).sort({date: -1}, function (err, docs) {
    res.json({
      "posts": docs
    });
  })
});

/**
 * delete post based on id
 */

app.post('/delPost/:id', function (req, res) {
  db.posts.remove({
    _id: db.ObjectId(req.params.id)
  }, function (err) {
    res.json({"error": err})
  })
});

/**
 * delete all posts
 */

app.del('/delAllPosts321', function (req, res) {
  db.posts.drop();
  res.json({"error": "???"})
});

/**
 * Launch
 */

http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on http://" + app.get('host'));
});