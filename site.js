var utilities = require('./libs/utilities'),
	pg = require('pg'), 
    postgres = utilities.getDBConnection(),
    marked = require('marked'),
    moment = require('moment'),
    util = require('util');

markedOpts = {
	gfm: true,
	highlight: function (code, lang, callback) {
		pygmentize({ lang: lang, format: 'html' }, code, function (err, result) {
			callback(err, result.toString());
		});
	},
	tables: true,
	breaks: false,
	pedantic: false,
	sanitize: true,
	smartLists: true,
	smartypants: false,
	langPrefix: 'lang-'
}

exports.root = function(req, res) {
	res.redirect("http://quickcast.io");
};

exports.video = function(req, res) {
	var video_entry = req.params.entry,
		client = new pg.Client(postgres);

    client.connect();

    client.query("SELECT casts.*, users.username FROM casts INNER JOIN users ON (casts.ownerid = users.userid) WHERE lower(casts.uniqueid) = $1 AND casts.published = true", [video_entry.toLowerCase()], function(err1, result1){
    
    	if (err1) {
    		client.end();
			res.status(500);
			res.render('500', { error: err1 });
    		return;
    	}

		if (!result1){
			client.end();
			res.render('404', 404);
			return;
		}
		
		var data = result1.rows[0];

		client.query("SELECT tags.name FROM casts_tags INNER JOIN tags ON (casts_tags.tagid = tags.tagid) WHERE casts_tags.castid = $1", [data.castid], function(err2, result2){
				
			client.end();

			var tags = null;

			if (!err2 && result2 != undefined){
				tags = result2.rows;
			}

			utilities.logViews(video_entry, req, function(err3, r) {
				marked(data.description, markedOpts, function (err4, content) {
					if (err4) {
						content = "Error converting Markdown!";
					}

					var a = moment(data.created);
					var b = moment(new Date());

					var duration = moment(data.created).hours();

					var str = 'https://s3.amazonaws.com/quickcast/%s/%s/quickcast.%s';
					var fileCheck = '/%s/%s/quickcast.%s';

					var amazonDetails = utilities.getAmazonDetails();

					var s3 = require('aws2js').load('s3', amazonDetails.accessKeyId, amazonDetails.secretAccessKey)

					s3.setBucket(amazonDetails.destinationBucket);

					s3.head(util.format(fileCheck, data.ownerid, data.castid, 'webm'), function (err5, s3res) {

						var processed = null;

						if (err5 && err5.code === 404){
							processed = "processing";
							//if (duration > 2)
							//	processed = "failed";
						}
						else if (err5 && err5.statusCode != 200)
							processed = "failed";

					    res.render('video', {
							mp4: util.format(str, data.ownerid, data.castid, 'mp4'),
							webm: util.format(str, data.ownerid, data.castid, 'webm'),
							body: content,
							views: data.views + r,
							title: data.name,
							username: data.username,
							when: a.from(b),
							processed: processed,
							id: data.castid,
							pageTitle: data.name,
							video_width: data.width,
							video_height: data.height,
							uniqueid: video_entry.toLowerCase(),
							tags: tags
						});
					});
				});
			});
		});
	});
};

exports.embed = function(req, res) {
	var video_entry = req.params.entry,
		client = new pg.Client(postgres);

    client.connect();

    client.query("SELECT casts.*, users.username FROM casts INNER JOIN users ON (casts.ownerid = users.userid) WHERE lower(casts.uniqueid) = $1 AND casts.published = true", [video_entry.toLowerCase()], function(err1, result1){
		client.end();

		if (err1){
			res.status(500);
			res.render('500', { error: err1 });
    		return;
		}

		if (!result1){
			res.render('404', 404);
			return;
		}
			
		var data = result1.rows[0];

		var a = moment(data.created);
		var b = moment(new Date());

		var duration = moment(data.created).hours();

		var str = 'https://s3.amazonaws.com/quickcast/%s/%s/quickcast.%s';
		var fileCheck = '/%s/%s/quickcast.%s';

		var amazonDetails = utilities.getAmazonDetails();

		var s3 = require('aws2js').load('s3', amazonDetails.accessKeyId, amazonDetails.secretAccessKey)

		s3.setBucket(amazonDetails.destinationBucket);

		s3.head(util.format(fileCheck, data.ownerid, data.castid, 'webm'), function (err3, s3res) {

			var processed = null;

			if (err3 && err3.code === 404){
				processed = "processing";
				if (duration > 2)
					processed = "failed";
			}
			else if (err3 && err3.statusCode != 200)
				processed = "failed";

		    res.render('embed', {
				mp4: util.format(str, data.ownerid, data.castid, 'mp4'),
				webm: util.format(str, data.ownerid, data.castid, 'webm'),
				processed: processed,
				id: data.castid,
				video_width: data.width,
				video_height: data.height,
				uniqueid: video_entry.toLowerCase()
			});

		});
	});
};