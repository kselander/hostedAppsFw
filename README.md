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


## Examples

** Hello World **

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

** Injection **

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

** View events **

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

		app.trigger('somethingReady');

	});

	page.on('progress',function(progress){
		console.log('PAGE progress', progress.progress);
	});


});

```


** Relay events **

```javascript

// TODO

```
