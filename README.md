## Pokki Hosted Apps Framework

To use PokkiApps.js add it in your background.html page and any page that needs to interact with it

```html
<!doctype html>
<html>
	<head>
		<script src="http://cdn.pokki.com/libs/pokkiHostedApps.js"></script>
	</head>
[...]
</html>
```


## Hello World

```javascript

var app = new pokki.App({
	url: 'http://google.com/',
	minWidth: 980,
	minHeight: 600
});

app.on('ready', function(e) {

	// do something...

});

```

## Injection

```javascript

var app = new pokki.App({
	url: 'http://google.com/',
	minWidth: 980,
	minHeight: 600
});

app.on('ready', function(e) {
	//DOMcontentLoaded

	var page = e.getView();

	console.log('MAIN', page);

	page.injectStyle('css/custom.css');
	page.injectScript('js/mymagic.js');

});

```

## View events

```javascript

var app = new pokki.App({
	url: 'http://google.com/',
	minWidth: 980,
	minHeight: 600
});

app.on('ready', function(e) {
	//DOMcontentLoaded

	var page = e.getView();

	page.on('load',function(){

		page.off('load');

		console.log('PAGE load', page);

	});

	page.on('progress',function(progress){
		console.log('PAGE progress', progress.progress);
	});


});

```


## Relay events

**background.html**
```javascript

var app = new pokki.App({
	url: 'http://pinterest.com/',
	minWidth: 980,
	minHeight: 600
});

app.on('start', function(e) {

	app.panels={};

	app.panels.splash = app.overlay('splash.html');

	app.panels.splash.on('close', function() {

		console.log('SPLASH finished doing its stuff');

	});
	app.panels.splash.on('load', function() {

		console.log('SPLASH load', app.panels.splash);

	}); // .load() works too
	app.panels.splash.load();

});

app.on('ready', function(e) {
	//DOMcontentLoaded

	var page = e.getView();

	page.injectStyle('css/pinterest.css');
	page.injectScript('js/pinterest.js');

	page.on('load',function(){

		page.off('load');

		console.log('PAGE load', page);

		app.trigger('somethingReady');

	});

	page.on('progress',function(progress){
		console.log('PAGE progress', progress.progress);
		app.panels.splash.trigger('pageProgress', progress);
	});


});

app.on('somethingReady', function(e) {

	console.log('SOMETHING IS READY!');

});

app.start();

```

**splash.html**
```javascript

var splash;
document.addEventListener('DOMContentLoaded',function() {

	splash = new pokki.View();

	splash.on('pageProgress',function(evt){

		var progBar = document.getElementById('progress');
		progBar && (progBar.style.width = evt.progress + '%');

		if ( parseInt(evt.progress,10) < 100 ) return;

		progBar && progBar.parentNode.parentNode.removeChild(progBar.parentNode);
		document.getElementById('close').style.opacity = 0.99;

		document.addEventListener('click',function(){
			splash.hide();
			splash.trigger('close');
		},false);

	});

},false);


```
