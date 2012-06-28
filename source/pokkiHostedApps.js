/*global pokki:true */

pokki.App = (function( headObj, pokki ) {

	/// GLOSSARY:
	// target: the name of the window object (View), can be read in window.name (i.e. 'splash') 
	// viewport: the window (currently only 'window' and 'background')

	'use strict';
	
	var config = {
		debug: true
	};

	var Globals = headObj._pokkiAppGlob = {
		windows: {},
		cb: {}
	};

	// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =
	// helpers
	// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =

	var util = {

		log: function() {
			if ( !config.debug ) return;
			var args = Array.prototype.slice.call( arguments );
			args.unshift('[' + (window.name||'unknown').toUpperCase() + ': pokki.App]');
			console.log.apply( console, args );
		},
		
		uniqueId: function(bits) {

			// https://gist.github.com/1175107

			bits || (bits=32);
			
			var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
			var ret = '';
			var i;
			var rand;
			
			while (bits > 0) {
				rand = Math.floor(Math.random() * 0x100000000); // 32-bit integer
				// base 64 means 6 bits per character, so we use the top 30 bits from rand to give 30/6=5 characters.
				for (i = 26; i > 0 && bits > 0; i -= 6, bits -= 6) {
					ret += chars[0x3F & rand >>> i];
				}
			}
			
			return ret.slice(0,3) + (new Date()).getTime() + ret.slice(3);
	
		},
		
		extend: function(obj) {
		
			Array.prototype.slice.call(arguments, 1).forEach( function(source) {
				if (!source) return;
				for (var attr in source) {
					obj[attr] = source[attr];
				}
			});
	
			return obj;
			
		},

		capitalize: function(str) {
			return str.replace(/(?:^|\s)\S/g, function(a) { return a.toUpperCase(); });
		},

		parseUrl: function(url) {
			var a = document.createElement('a');
			a.href = url;
			return {
				source: url,
				protocol: a.protocol.replace(':', '').toLowerCase(),
				host: a.hostname,
				port: a.port,
				query: a.search,
				params: (function() {
					var ret = {},
						seg = a.search.replace(/^\?/, '').split('&'),
						len = seg.length,
						i = 0,
						s;
					for (; i < len; i++) {
						if (!seg[i]) continue;
						s = seg[i].split('=');
						ret[s[0]] = s[1];
					}
					return ret;
				})(),
				file: (a.pathname.match(/\/([^\/?#]+)$/i) || [null, ''])[1],
				hash: a.hash.replace('#', ''),
				path: a.pathname.replace(/^([^\/])/, '/$1'),
				relative: (a.href.match(/tps?:\/\/[^\/]+(.+)/) || [null, ''])[1],
				segments: a.pathname.replace(/^\//, '').split('/')
			};
		},

		httpGet: function(url, cb, cbErr) {

			var client = new XMLHttpRequest();
			// client.onreadystatechange = function() {
			//	if (client.readyState != 4) { return; }
			client.onload = function() {
                try {
					util.log('[httpGet:XMLHttpRequest]', client);
					cb(client.responseText);
				} catch(e) {
					console.log('[httpGet:error]', e);
					cbErr(e);
				}
			};
			client.open('GET', url, true);  
			client.send();

		},

		escape: function(str) {
			return str.replace(/([\"\'])/g,'\\$1').replace(/[\r\n]+/g,'\\\\n').replace(/[\s]+/g,' ');
		},

		setViewVisible: function(target,yesNo) {
			if (pokki.setPageVisible) {
				pokki.setPageVisible(target, yesNo===false ? false : true);
			} else {
				pokki.rpc('background','pokki.setPageVisible("' + target + '", ' + (yesNo?'true':'false') + ')');
			}
		}
		
	};

	// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =
	// Static methods for Overlays
	// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =

	// shortcut if you don't want to instance the pokki.App in an Overlay
	pokki.trigger = function(evtName) {
		util.log('[pokki.broadcast]',evtName);
		pokki.rpc('background', "window._pokkiApp && window._pokkiApp.broadcast('" + window.name + "','" + evtName + "')");
	};

	pokki.on = function(evtName, cb) {
		//TODO:
	};

	pokki.showView = function(target) {
		util.setViewVisible(target,true);
	};

	pokki.hideView = function(target) {
		util.setViewVisible(target,false);
	};

	// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =
	// Event management methods
	// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =
	var eventSplitter = /\s/;
	var Events = {

		// https://github.com/documentcloud/backbone/blob/master/backbone.js

		/*jshint boss:true */

		// Bind one or more space separated events, `events`, to a `callback`
		// function. Passing `"all"` will bind the callback to all events fired.
		on: function (events, callback, context) {
			var calls, event, list;
			if (!callback) return this;
	
			events = events.split(eventSplitter);
			calls = this._callbacks || (this._callbacks = {});
	
			//while (events.length) {
			//	event = events.shift();
			while (event = events.shift()) {
				list = calls[event] || (calls[event] = []);
				list.push(callback, context);
			}
	
			return this;
		},
	
		// Remove one or many callbacks. If `context` is null, removes all callbacks
		// with that function. If `callback` is null, removes all callbacks for the
		// event. If `events` is null, removes all bound callbacks for all events.
		off: function (events, callback, context) {
			var event, calls, list, i;
	
			// No events, or removing *all* events.
			if (!(calls = this._callbacks)) return this;
			if (!(events || callback || context)) {
				delete this._callbacks;
				return this;
			}
	
			events = events ? events.split(eventSplitter) : Object.keys(calls);
	
			// Loop through the callback list, splicing where appropriate.
			while (event = events.shift()) {
				if (!(list = calls[event]) || !(callback || context)) {
					delete calls[event];
					continue;
				}
	
				for (i = list.length - 2; i >= 0; i -= 2) {
					if (!(callback && list[i] !== callback || context && list[i + 1] !== context)) {
						list.splice(i, 2);
					}
				}
			}
	
			return this;
		},
	
		// Trigger one or many events, firing all bound callbacks. Callbacks are
		// passed the same arguments as `trigger` is, apart from the event name
		// (unless you're listening on `"all"`, which will cause your callback to
		// receive the true name of the event as the first argument).
		trigger: function (events) {
			var event, calls, list, i, length, args, all, rest;
			if (!(calls = this._callbacks)) return this;
	
			rest = [];
			events = events.split(eventSplitter);
			for (i = 1, length = arguments.length; i < length; i++) {
				rest[i - 1] = arguments[i];
			}
	
			// For each event, walk through the list of callbacks twice, first to
			// trigger the event, then to trigger any `"all"` callbacks.
			while (event = events.shift()) {
				// Copy callback lists to prevent modification.
				if (all = calls.all) all = all.slice();
				if (list = calls[event]) list = list.slice();
	
				// Execute event callbacks.
				if (list) {
					for (i = 0, length = list.length; i < length; i += 2) {
						list[i].apply(list[i + 1] || this, rest);
					}
				}
	
				// Execute "all" callbacks.
				if (all) {
					args = [event].concat(rest);
					for (i = 0, length = all.length; i < length; i += 2) {
						all[i].apply(all[i + 1] || this, args);
					}
				}
			}
	
			return this;
		}
	
	};

	// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =
	// wrap for Hosted Apps platform callbacks
	// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =

	var onPageLoading = function(app) {
	
		return function(url, targetPageName, currentUrl, action, hasWebsheet) {

			util.log('[onPageLoading]', url, targetPageName, currentUrl, action, hasWebsheet);
			
			var req = {
				url: (url == 'start') ? app.options.url : url,
				caller: {
					name: targetPageName, //window|websheet|someName
					action: action
				},
				uiState: {
					currentUrl: currentUrl,
					websheetOpen: hasWebsheet
				}
			};

			var policy = app.route(req);
			policy = util.extend({
				show: app.options.show,
				target: req.caller.name || 'window',
				url: req.url,
				controller: null
			},policy);

console.log('REQ > POLICY', req, policy);
			
			// pokki.View (singleton to maintain event handlers)
			var page = Globals.windows[policy.target] || new View({
				url: policy.url,
				name: policy.target,
				requester: req.caller
			});
			if (policy.show && !page.hidden) {
				page.show();
			} else {
				page.hide();
			}	

			var callbackId = 'page_' + page.id;

			var ev = {
				getView: function() {
					return page;
				},
				stopPropagation: function() {
					this.propagate = false;
				},
				propagate: true
			};

			Globals.cb[callbackId] = {

				onResponse: function() {

					page.state = 'response';

					// app
					policy.controller && policy.controller.trigger('response', ev);
					ev.propagate && app.trigger('response', ev);
					ev.propagate && page.trigger('response', ev);
				
					util.log('[onPageLoading.onResponse]', 'callback', ev.propagate);
				},

				onDomContentLoaded: function() {

					page.state = 'ready';

					// app
					policy.controller && policy.controller.trigger('ready loading', ev);
					ev.propagate && app.trigger('ready loading', ev);
					ev.propagate && page.trigger('ready loading', ev);
				
					util.log('[onPageLoading.onDomContentLoaded]', 'callback', ev.propagate);
				},

				onLoad: function() {

					page.state = 'load';

					//TODO: wrap triggers to synchronise them (i.e. to attach page.onLoad in app.onLoad)
					policy.controller && policy.controller.trigger('load', ev);
					ev.propagate && app.trigger('load', ev);
					ev.propagate && page.trigger('load', ev);

					util.log('[onPageLoading.onLoad]', 'callback', ev.propagate);
				
					// cleanup
					delete Globals.cb[callbackId];
				},

			};
			var rpcNsStr = "_pokkiAppGlob.cb." + callbackId;

			var eval_onResponse = [
				"window.name = '" + policy.target + "';",
				config.debug ? "console.log('[' + window.name + ']', 'response (injectBeforeDOM)');" : "",
				"window.pokxyRecv = { vars:{} };",
				"window.pokxyRecv.del = function(cbId){ delete pokxyRecv.vars[cbId]; };",
				"window.pokxyRecv.ret = function(cbstr,err,result){ pokki.rpcArgs('_pokkiAppGlob.cb.' + cbstr, (err ? err + '' : ''), (result ? result + '' : '')) };",
				"window.pokxyRecv.assign = function(cmd, cbId){ pokxyRecv.vars[cbId] = window.pokxyRecv.exec(cmd, cbId); };",
				"window.pokxyRecv.exec = function(cmd, cbId){",
				" try { var res = (new Function(cmd))(); console.log('[POKKI-WORKER]:result',arguments,res); pokxyRecv.ret(cbId,null,res); return res; }",
				" catch(err) { console.log('[POKKI-WORKER:error]',arguments,err+'',err); pokxyRecv.ret(cbId,err); } };",
				"window.addEventListener('load', function() { console.log('[' + window.name + ']','load'); pokki.rpc( '" + rpcNsStr + ".onLoad()' ); });",
				"pokki.rpc( '" + rpcNsStr + ".onResponse()' );"
			];

			var eval_onDomContentLoaded = [
				"window.name = '" + policy.target + "';",
				config.debug ? "console.log('[' + window.name + ']', 'DOMContentLoaded (injectAfterDOM)');" : "",
				"pokki.rpc( '" + rpcNsStr + ".onDomContentLoaded()' );"
			];
			
			return {
				targetUrl: policy.url,
				targetPage: policy.target,
				injectBeforeDOM : eval_onResponse.join(' '),
				injectAfterDOM : eval_onDomContentLoaded.join(' ')
			};
		};
	};

	var onPageLoadingError = function(app) {

		return function(url, targetPageName, http_status_code) {
			util.log('[onPageLoadingError]', 'targetPageName:' + targetPageName, 'url:' + url, 'status:' + http_status_code);

			if (!Globals.windows[targetPageName]) return;
			//var trigger = Globals.windows[targetPageName]._trigger || Globals.windows[targetPageName].trigger; //error?
			Globals.windows[targetPageName].trigger('error', {
				status: http_status_code
			});

		};

	};

	var onPageLoadProgress = function(app) {

		return function(targetPageName, progress) {

			util.log('[onPageLoadProgress]:', 'targetPageName:' + targetPageName, 'progress(%): ' + progress);
			if (!Globals.windows[targetPageName]) return;
			//var trigger = Globals.windows[targetPageName]._trigger || Globals.windows[targetPageName].trigger; //error?
			Globals.windows[targetPageName].trigger('progress', {
				progress: progress
			});

		};

	};


	// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =
	// Pokxy - proxy communication layer
	// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =

	var Pokxy = function( target, options ) {
		
		options || (options={});
		this.target = target;

	};
	Pokxy.prototype = {

		send: function(cmd, cb, options) {

			var self = this;

			options || (options={});
			if (options.assign !== false) options.assign=true;
			if (options.silent !== true) options.silent=false;

			var wrkCmd = options.assign ? ("pokxyRecv.assign(\"" + util.escape(cmd) + "\",'{callbackId}');") : ("pokxyRecv.exec(\"" + util.escape(cmd) + "\",'{callbackId}');");

			var pokxyBit = new PokxyBit.Reference('pokxy_' + util.uniqueId(), {
				evalStr: wrkCmd,
				target: this.target,
				worker: this
			});

			Globals.cb[pokxyBit.id] = function( err, res ) {

				if (err) {
					util.log('[Pokxy.send:error]', self.target, err, {cmd: pokxyBit.getCommand()} );
					return options.onError && options.onError( err );
				}

				if (res.match(/^\[object HTML/)) {
					pokxyBit.decorate('domElement'); 
				}
				pokxyBit.setResult(res);
				pokxyBit.trigger('ready'); //TODO: this works only with slow cmds (otherwise it's quasi-synchronous)...

				cb && (!options.silent || pokxyBit.complete) && cb( pokxyBit );
				pokxyBit.complete=true;

				//cleanUp
				// if (!options.keepAlive) delete headObj._pokkiAppGlob.cb[pokxyBit.id];
				// if (!options.keepReference) pokki.rpc(this.target, "pokxyRecv.del('" + pokxyBit.id + "');" );
			};

			util.log( '[Pokxy.send]', this.target, {cmd: pokxyBit.getCommand()} );
			pokki.rpc( this.target, pokxyBit.getCommand() );

			return pokxyBit;

		}

	};

	// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =
	// Pokxy Bit - proxy object
	// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =

	var PokxyBit = { decorators:{} };

	PokxyBit.Reference = function( varId, options ) {
		
		options || (options={});
		this.id = varId;
		this.ready = false;

		this.worker = options.worker;

		this.work = {
			evalStr: options.evalStr.replace(/\{callbackId\}/g, this.id),
			resultStr: options.resultStr,
			target: options.target
		};
		this.ark = [];
		this.complete = false;
	};

	util.extend( PokxyBit.Reference.prototype, Events, {

		getCommand: function() {
			return this.work.evalStr;
		},

		setResult: function(resultStr) {
			this.work.resultStr = resultStr;
			this.ready=true;
		},

		getResult: function() {
			return this.work.resultStr;
		},

		decorate: function(decoratorName) {
			var self = this;

			this.type = decoratorName;

			var klass = PokxyBit.decorators[decoratorName];
			if (!klass) return;

			Object.keys(klass).forEach(function(key) {
				if (key==='on') self._on = self.on;
				if (key==='trigger') self._trigger = self.trigger;
				self[key] = klass[key].bind(self);
			});
		},

	});

	// . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .

	PokxyBit.decorators.domElement = {

		show: function() {

			var cmd = [
				"pokxyRecv.vars['" + this.id + "'].style.display = 'block';",
				"return;"
			];
			return this.worker.send(cmd.join(' '), null ,{assign:false});
		},

		hide: function() {

			var cmd = [
				"pokxyRecv.vars['" + this.id + "'].style.display = 'none';",
				"return;"
			];
			return this.worker.send(cmd.join(' '), null, {assign:false});
		},

		on: function(eventName, onEventCb) {

			var self = this;

			// TODO: test this properly!

			if (['click','change','hover'].indexOf(eventName) >= 0) {

				var cmd = [
					"pokxyRecv.vars['" + this.id + "'].addEventListener('" + eventName + "', function(e) {",
					//TODO: "store e.target"
					"    pokxyRecv.ret('{callbackId}', null, e.target.id);",
					"});"
				];

				var proxyVar = this.worker.send(cmd.join(' '), function(proxyVarUpd) {
					var evTargetId = proxyVarUpd.getResult();
					self.trigger(eventName, evTargetId);
				}, {
					assign:false,
					keepAlive:true,
					silent: true
				});

			}

			self._on(eventName, onEventCb);

		},

		addClass: function() {
			//TODO:
		},

		removeClass: function() {
			//TODO:
		},

		remove: function() {

			var cmd = [
				"pokxyRecv.vars['" + this.id + "'].parentNode.removeChild(pokxyRecv.vars['" + this.id + "']);",
				"return;"
			];
			var newBit = this.worker.send(cmd.join(' '), null, {assign:false});

			//this.ark.push[this.work];
			//this.work = newBit.work;

			//should I update id too?
			//this.id = newBit.id;
		},

		observe: function(onMutationCb, options) {

			options || (options = {polling: 1000});

			//TODO: this.worker.monitor(test, onChange, options);
			var cmd = [
				"var elem = pokxyRecv.vars['" + this.id + "'];",
				"var prevVal = elem.innerText;",
				"pokxyRecv.vars['" + this.id + "_timer'] = setInterval( function(){",
				"  if (prevVal !== elem.innerText) {",
				"    prevVal = elem.innerText;",
				"    pokxyRecv.ret('{callbackId}', null, prevVal);",
				"  }",
				"}," + options.polling + ");",
			];

			var proxyVar = this.worker.send(cmd.join(' '), function(proxyVarUpd) {

				var innerText = proxyVarUpd.getResult();
				onMutationCb(innerText);

			}, {
				assign:false,
				keepAlive:true,
				silent: true
			});

		}

	};

	// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =
	// View
	// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =

	var View = pokki.View = function( attrs, options ) {

		attrs || (attrs={});
		options || (options={});

		this.options = options = util.extend({
			show: true
		},options);

		this.location = attrs.url ? util.parseUrl(attrs.url) : {protocol: 'mirror'};

		this.id = attrs.url ? ((this.location.host+this.location.path).replace(/[\.\/\:]/g,'').toUpperCase() + '_' + util.uniqueId()) : window.name; //singleton(kinda)

		this.remote = this.location.protocol.match(/^http/) ? true : false;
		this.state = attrs.state || null;
		this.hidden = false;
		this.name = attrs.name || this.id; // = "target"
		this.viewport = 'window';
		this.requester = attrs.requester || { name: window.name, action:'app' };
		this.worker = attrs.worker || new Pokxy(this.name);

		Globals.windows[this.name] = this;
		// could be also
		//  app = new pokki.App(); 
		//  var splash = app.getView(window.name);

	};

	util.extend( View.prototype, Events, {_trigger:Events.trigger}, {

		load: function(options) {

			var self = this;

			//mirror view (kinda singleton when calling pokki.View from a satellite page)
			if (!this.location.source) return this;

			//change url
			if (typeof options === 'string') return pokki.navigateTo(options, this.name);

			//reload
			if (this.state === 'load') return this.reLoad();

			options || (options={});
			this.options = util.extend(this.options, options);

			pokki.loadPage(this.viewport, this.location.source, this.name);

			return this;
		},

		reLoad: function(options) {
			pokki.navigateTo(this.location.source, this.name);
		},

		show: function() {
			//TODO: handle layers. Bring on top on-show
			this.name && pokki.showView(this.name);
			this.hidden = false;
			return this;
		},

		hide: function() {
			this.name && pokki.hideView(this.name);
			this.hidden = true;
			return this;
		},

		trigger: function(eventName, params) {
			// broadcast event
			var destination = (window.name === 'background') ? this.id : 'background';
			//var destination = (this.requester.name === this.id) ? this.id : 'background';
			pokki.rpc(destination, "window._pokkiAppGlob && window._pokkiAppGlob.windows['" + this.id + "'] && window._pokkiAppGlob.windows['" + this.id + "']._trigger('" + eventName + "'," + JSON.stringify(params) + ");" );
			this._trigger(eventName, params);
			return this;
		},

		injectStyle: function(fileName) {

			var self = this;

			util.httpGet(fileName, function( cssText ) {

				var cmd = [
					"var style = document.head.appendChild( document.createElement('style') );",
					"style.appendChild(document.createTextNode('" + util.escape(cssText) + "'));",
					"return style;"
				];
				var proxyVar = self.worker.send(cmd.join(' '), function(updProxyVar) {

					util.log('[View.injectStyle]',fileName,updProxyVar);

				}, { assign:false });

			});
			return this;

		},

		injectScript: function(url) {

			var self = this;

			if (url.match(/^https?:/i)) {

				var cmd = [
					"var scr = document.createElement('script');",
					"scr.src = '" + url + "';",
					"document.head.appendChild(scr);",
					"return scr;"
				];
				var proxyVar = self.worker.send(cmd.join(' '), function(updProxyVar) {

					util.log('[View.injectScript:done]', url, updProxyVar);

				}, { assign:false });

			} else {

				util.httpGet(url, function( jsText ) {

					var cmd = [
						"var scr = document.head.appendChild( document.createElement('script') );",
						"scr.appendChild(document.createTextNode('" + util.escape(jsText) + "'));",
						"return scr;"
					];

					// TODO: should work as a simple eval!
					//cmd = [util.escape(jsText)];

					var proxyVar = self.worker.send(cmd.join(' '), function(updProxyVar) {

						util.log('[View.injectScript:done]', url, updProxyVar);

					}, { assign:false });

				});


			}
			return this;

		},

		select: function(selector) {

			var self = this;

			var cmd = [
				"return document.querySelectorAll('" + selector + "')[0];"
			];
			return self.worker.send(cmd.join(' '), function(updProxyVar) {

				util.log('[View.select:done]', selector, updProxyVar);

			}, {assign:true} );

		}

	});

	// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =
	// pokki.App constructor and methods
	// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =

	pokki.Controller = function( options ) {
		this.options = options || {};
	};

	util.extend( pokki.Controller.prototype, Events, {
	});

	// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =
	// pokki.App constructor and methods
	// = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =

	var App = function( options ) {

		var self = this;		
		options || (options={});
		this.options = options = util.extend({
			minWidth: 1024,
			minHeight: 800,
			maxWidth: 0,
			maxHeight: 0,
			allowResize: true,
			show: true
		},options);

		// mount platform hooks
		headObj.onPageLoading = onPageLoading(this);
		headObj.onPageLoadingError = onPageLoadingError(this);
		headObj.onPageLoadProgress = onPageLoadProgress(this);

		headObj._pokkiApp = this;

		this.setRouter( options.router, options );

		pokki.allowResize(
			Array.isArray(options.allowResize) ? options.allowResize[0] : options.allowResize, // resize-x,resize-y,size
			Array.isArray(options.allowResize) ? options.allowResize[1] : options.allowResize, {
			minWidth: options.minWidth,
			minHeight: options.minHeight,
			maxWidth: options.maxWidth,
			maxHeight: options.maxHeight
		});

		Globals.windows = {};

		pokki.addEventListener('showing',function() {
			self.trigger('showing');
		});

	};

	util.extend( App.prototype, Events, {

		start: function() {
			//TODO: there should be an pokki.navigateTo(startUrl) thing to start the flow....
			this.trigger('start');
		},
	
		setRouter: function( router, options ) {

			// routeHandler receives:
			//	{
			//	url: url to go to,
			//	caller: {
			//		name: window|websheet
			//		action: what generated the page change
			//	},
			//	uiState: {
			//		currentUrl: current url,
			//		websheetOpen: websheet is open
			//	}
			//
			// and must return:
			//	{
			//	show: true,
			//	target: websheet|window, empty to maintain the one where req was generated
			//	url: url to go to, empty to continue to requested url
			//	}

			var self = this;

			this.routeHandlers || (this.routeHandlers = []);

			router || ( router = function(req){

				if (!self.routeHandlers.length) return {};

				for (var i = 0, max = self.routeHandlers.length; i < max; i += 1) {
					// first match wins
					if (self.routeHandlers[i].match(req)) return {controller: self.routeHandlers[i].controller};
				}

				return {};

			});
			this.router = router;
		},

		registerRoute: function(pattern, controller, options) {

			if (!controller instanceof pokki.Controller) throw new Error('route handler must be a pokki.Controller instance');
			this.routeHandlers || (this.routeHandlers = []);

			options || (options={});
			options.matchCondition===false || (options.matchCondition=true);

			var ctrlWrap = {
				match: null,
				controller: controller
			};
			if ( Array.isArray(pattern) ) {
				// array of patterns
				ctrlWrap.match = function(req) {
					var ret = pattern.filter( function(regex) {
						return req.url.match(regex);
					}).length;
					return options.matchCondition ? ret : !ret;
				};
			} else if ( typeof pattern === 'string' ) {
				// string
				ctrlWrap.match = function(req) {
					var ret = req.url.toLowerCase().indexOf(pattern.toLowerCase()) >= 0;
					return options.matchCondition ? ret : !ret;
				};
			} else {
				// RegExp
				ctrlWrap.match = function(req) {
					var ret = req.url.match(pattern);
					return options.matchCondition ? ret : !ret;
				};
			}

			this.routeHandlers.push(ctrlWrap);
		},

		route: function(req) {
			// TODO: make private, move to module namespace

			// called by fn onPageLoading to determine whether:
			// - Continue to load and display the page
			// - Deny the loading, and therefore display, of the page
			// - Continue to load the page, however not display it until triggered by the pokki.pageReady API
			// and can define a controller that will receive the "request" event

			var policy = this.router(req);
			util.log('[app.route]', req, policy);

			return policy;
		},

		overlay: function(url, options) {

			options || (options={});

			var overlay = new View( { viewport:'window', url:url }, options );

			// in case we want to manually observe the load event
			if ( !options.onLoad ) return overlay;

			overlay.on('load', function() {
				options.onLoad && options.onLoad(overlay);
			});
			overlay.load();

			return overlay;
		},

		isFirstRun: function(force) {
			return typeof force === 'undefined' ? true : force;
		},

		resize: function(prefs) {

			var windowConf = util.extend({}, this.options);
			if (prefs.width) {
				windowConf.minWidth = prefs.width;
				windowConf.maxWidth = prefs.width+1;
			}
			if (prefs.height) {
				windowConf.minHeight = prefs.width;
				windowConf.maxHeight = prefs.width+1;
			}

			pokki.allowResize(
				Array.isArray(prefs.allowResize) ? prefs.allowResize[0] : prefs.allowResize, // resize-x,resize-y,size
				Array.isArray(prefs.allowResize) ? prefs.allowResize[1] : prefs.allowResize, 
				windowConf
			);

			//TODO: animate ( 1> set allowresize to false 2> resize element)
			//TODO: restore max/min sizes if prefs.allowResize (so the user can resize the window)

		},

		getContextMenu: function(handlers) {

			this.contextMenu || (this.contextMenu = {

				add: function(label,cb) {

					var self = this;

					if (typeof this._items === 'undefined') {
						this._items = [];
						pokki.addEventListener("context_menu", function(id) {
							var item = self._items.filter(function(i){return i.id===id;}).shift();
							item && item.cb();
						});
					}

					var menuItem = {
						id: util.uniqueId(),
						cb: cb,
						label: label,
						_hidden: false,
						show: function() { if (!this._hidden) return this; this._hidden = false; self._refresh(); return this;},
						hide: function() { if (this._hidden) return this; this._hidden = true; self._refresh(); return this;}
					};
					this._items.push(menuItem);
					this._refresh();

					return menuItem;
				},

				_refresh: function() {
					pokki.resetContextMenu();
					this._items.forEach(function(item){
						item._hidden || pokki.addContextMenuItem(item.label, item.id);
					});
				},

				remove: function(kwd) {
					// can remove by passing id, label, callback ref or menuItem object (returned by menu.add)
					if (typeof kwd !== 'string' && typeof kwd !== 'function') kwd = kwd.id;
					this._items = this._items.filter(function(i){return i.id !== kwd && i.label !== kwd && i.cb !== kwd;});
					this._refresh();
				}

			});

			return this.contextMenu;
		},

		broadcast: function(target, eventName, params) {
			// TODO: move this to the global scope 

			params || (params='');

			util.log('[App.broadcast]',target, eventName, params);

			if (!target) throw new Error('app.broadcast requires a target (window.name)');
			if (!eventName) throw new Error('app.broadcast requires an eventName');
			if (!Globals.windows[target]) return;
			Globals.windows[target].trigger(eventName,params);

		}

	});

	return App;

})( window, pokki );

