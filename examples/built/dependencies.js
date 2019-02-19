(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(factory((global.DocumentationDependencies = {})));
}(this, (function (exports) { 'use strict';

	/* **********************************************
	     Begin prism-core.js
	********************************************** */

	var _self = (typeof window !== 'undefined')
		? window   // if in browser
		: (
			(typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope)
			? self // if in worker
			: {}   // if in node js
		);

	/**
	 * Prism: Lightweight, robust, elegant syntax highlighting
	 * MIT license http://www.opensource.org/licenses/mit-license.php/
	 * @author Lea Verou http://lea.verou.me
	 */

	var Prism$1 = (function(){

	// Private helper vars
	var lang = /\blang(?:uage)?-([\w-]+)\b/i;
	var uniqueId = 0;

	var _ = _self.Prism = {
		manual: _self.Prism && _self.Prism.manual,
		disableWorkerMessageHandler: _self.Prism && _self.Prism.disableWorkerMessageHandler,
		util: {
			encode: function (tokens) {
				if (tokens instanceof Token) {
					return new Token(tokens.type, _.util.encode(tokens.content), tokens.alias);
				} else if (_.util.type(tokens) === 'Array') {
					return tokens.map(_.util.encode);
				} else {
					return tokens.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\u00a0/g, ' ');
				}
			},

			type: function (o) {
				return Object.prototype.toString.call(o).match(/\[object (\w+)\]/)[1];
			},

			objId: function (obj) {
				if (!obj['__id']) {
					Object.defineProperty(obj, '__id', { value: ++uniqueId });
				}
				return obj['__id'];
			},

			// Deep clone a language definition (e.g. to extend it)
			clone: function (o, visited) {
				var type = _.util.type(o);
				visited = visited || {};

				switch (type) {
					case 'Object':
						if (visited[_.util.objId(o)]) {
							return visited[_.util.objId(o)];
						}
						var clone = {};
						visited[_.util.objId(o)] = clone;

						for (var key in o) {
							if (o.hasOwnProperty(key)) {
								clone[key] = _.util.clone(o[key], visited);
							}
						}

						return clone;

					case 'Array':
						if (visited[_.util.objId(o)]) {
							return visited[_.util.objId(o)];
						}
						var clone = [];
						visited[_.util.objId(o)] = clone;

						o.forEach(function (v, i) {
							clone[i] = _.util.clone(v, visited);
						});

						return clone;
				}

				return o;
			}
		},

		languages: {
			extend: function (id, redef) {
				var lang = _.util.clone(_.languages[id]);

				for (var key in redef) {
					lang[key] = redef[key];
				}

				return lang;
			},

			/**
			 * Insert a token before another token in a language literal
			 * As this needs to recreate the object (we cannot actually insert before keys in object literals),
			 * we cannot just provide an object, we need anobject and a key.
			 * @param inside The key (or language id) of the parent
			 * @param before The key to insert before. If not provided, the function appends instead.
			 * @param insert Object with the key/value pairs to insert
			 * @param root The object that contains `inside`. If equal to Prism.languages, it can be omitted.
			 */
			insertBefore: function (inside, before, insert, root) {
				root = root || _.languages;
				var grammar = root[inside];

				if (arguments.length == 2) {
					insert = arguments[1];

					for (var newToken in insert) {
						if (insert.hasOwnProperty(newToken)) {
							grammar[newToken] = insert[newToken];
						}
					}

					return grammar;
				}

				var ret = {};

				for (var token in grammar) {

					if (grammar.hasOwnProperty(token)) {

						if (token == before) {

							for (var newToken in insert) {

								if (insert.hasOwnProperty(newToken)) {
									ret[newToken] = insert[newToken];
								}
							}
						}

						ret[token] = grammar[token];
					}
				}

				// Update references in other language definitions
				_.languages.DFS(_.languages, function(key, value) {
					if (value === root[inside] && key != inside) {
						this[key] = ret;
					}
				});

				return root[inside] = ret;
			},

			// Traverse a language definition with Depth First Search
			DFS: function(o, callback, type, visited) {
				visited = visited || {};
				for (var i in o) {
					if (o.hasOwnProperty(i)) {
						callback.call(o, i, o[i], type || i);

						if (_.util.type(o[i]) === 'Object' && !visited[_.util.objId(o[i])]) {
							visited[_.util.objId(o[i])] = true;
							_.languages.DFS(o[i], callback, null, visited);
						}
						else if (_.util.type(o[i]) === 'Array' && !visited[_.util.objId(o[i])]) {
							visited[_.util.objId(o[i])] = true;
							_.languages.DFS(o[i], callback, i, visited);
						}
					}
				}
			}
		},
		plugins: {},

		highlightAll: function(async, callback) {
			_.highlightAllUnder(document, async, callback);
		},

		highlightAllUnder: function(container, async, callback) {
			var env = {
				callback: callback,
				selector: 'code[class*="language-"], [class*="language-"] code, code[class*="lang-"], [class*="lang-"] code'
			};

			_.hooks.run("before-highlightall", env);

			var elements = env.elements || container.querySelectorAll(env.selector);

			for (var i=0, element; element = elements[i++];) {
				_.highlightElement(element, async === true, env.callback);
			}
		},

		highlightElement: function(element, async, callback) {
			// Find language
			var language, grammar, parent = element;

			while (parent && !lang.test(parent.className)) {
				parent = parent.parentNode;
			}

			if (parent) {
				language = (parent.className.match(lang) || [,''])[1].toLowerCase();
				grammar = _.languages[language];
			}

			// Set language on the element, if not present
			element.className = element.className.replace(lang, '').replace(/\s+/g, ' ') + ' language-' + language;

			if (element.parentNode) {
				// Set language on the parent, for styling
				parent = element.parentNode;

				if (/pre/i.test(parent.nodeName)) {
					parent.className = parent.className.replace(lang, '').replace(/\s+/g, ' ') + ' language-' + language;
				}
			}

			var code = element.textContent;

			var env = {
				element: element,
				language: language,
				grammar: grammar,
				code: code
			};

			_.hooks.run('before-sanity-check', env);

			if (!env.code || !env.grammar) {
				if (env.code) {
					_.hooks.run('before-highlight', env);
					env.element.textContent = env.code;
					_.hooks.run('after-highlight', env);
				}
				_.hooks.run('complete', env);
				return;
			}

			_.hooks.run('before-highlight', env);

			if (async && _self.Worker) {
				var worker = new Worker(_.filename);

				worker.onmessage = function(evt) {
					env.highlightedCode = evt.data;

					_.hooks.run('before-insert', env);

					env.element.innerHTML = env.highlightedCode;

					callback && callback.call(env.element);
					_.hooks.run('after-highlight', env);
					_.hooks.run('complete', env);
				};

				worker.postMessage(JSON.stringify({
					language: env.language,
					code: env.code,
					immediateClose: true
				}));
			}
			else {
				env.highlightedCode = _.highlight(env.code, env.grammar, env.language);

				_.hooks.run('before-insert', env);

				env.element.innerHTML = env.highlightedCode;

				callback && callback.call(element);

				_.hooks.run('after-highlight', env);
				_.hooks.run('complete', env);
			}
		},

		highlight: function (text, grammar, language) {
			var env = {
				code: text,
				grammar: grammar,
				language: language
			};
			_.hooks.run('before-tokenize', env);
			env.tokens = _.tokenize(env.code, env.grammar);
			_.hooks.run('after-tokenize', env);
			return Token.stringify(_.util.encode(env.tokens), env.language);
		},

		matchGrammar: function (text, strarr, grammar, index, startPos, oneshot, target) {
			var Token = _.Token;

			for (var token in grammar) {
				if(!grammar.hasOwnProperty(token) || !grammar[token]) {
					continue;
				}

				if (token == target) {
					return;
				}

				var patterns = grammar[token];
				patterns = (_.util.type(patterns) === "Array") ? patterns : [patterns];

				for (var j = 0; j < patterns.length; ++j) {
					var pattern = patterns[j],
						inside = pattern.inside,
						lookbehind = !!pattern.lookbehind,
						greedy = !!pattern.greedy,
						lookbehindLength = 0,
						alias = pattern.alias;

					if (greedy && !pattern.pattern.global) {
						// Without the global flag, lastIndex won't work
						var flags = pattern.pattern.toString().match(/[imuy]*$/)[0];
						pattern.pattern = RegExp(pattern.pattern.source, flags + "g");
					}

					pattern = pattern.pattern || pattern;

					// Don’t cache length as it changes during the loop
					for (var i = index, pos = startPos; i < strarr.length; pos += strarr[i].length, ++i) {

						var str = strarr[i];

						if (strarr.length > text.length) {
							// Something went terribly wrong, ABORT, ABORT!
							return;
						}

						if (str instanceof Token) {
							continue;
						}

						if (greedy && i != strarr.length - 1) {
							pattern.lastIndex = pos;
							var match = pattern.exec(text);
							if (!match) {
								break;
							}

							var from = match.index + (lookbehind ? match[1].length : 0),
							    to = match.index + match[0].length,
							    k = i,
							    p = pos;

							for (var len = strarr.length; k < len && (p < to || (!strarr[k].type && !strarr[k - 1].greedy)); ++k) {
								p += strarr[k].length;
								// Move the index i to the element in strarr that is closest to from
								if (from >= p) {
									++i;
									pos = p;
								}
							}

							// If strarr[i] is a Token, then the match starts inside another Token, which is invalid
							if (strarr[i] instanceof Token) {
								continue;
							}

							// Number of tokens to delete and replace with the new match
							delNum = k - i;
							str = text.slice(pos, p);
							match.index -= pos;
						} else {
							pattern.lastIndex = 0;

							var match = pattern.exec(str),
								delNum = 1;
						}

						if (!match) {
							if (oneshot) {
								break;
							}

							continue;
						}

						if(lookbehind) {
							lookbehindLength = match[1] ? match[1].length : 0;
						}

						var from = match.index + lookbehindLength,
						    match = match[0].slice(lookbehindLength),
						    to = from + match.length,
						    before = str.slice(0, from),
						    after = str.slice(to);

						var args = [i, delNum];

						if (before) {
							++i;
							pos += before.length;
							args.push(before);
						}

						var wrapped = new Token(token, inside? _.tokenize(match, inside) : match, alias, match, greedy);

						args.push(wrapped);

						if (after) {
							args.push(after);
						}

						Array.prototype.splice.apply(strarr, args);

						if (delNum != 1)
							_.matchGrammar(text, strarr, grammar, i, pos, true, token);

						if (oneshot)
							break;
					}
				}
			}
		},

		tokenize: function(text, grammar, language) {
			var strarr = [text];

			var rest = grammar.rest;

			if (rest) {
				for (var token in rest) {
					grammar[token] = rest[token];
				}

				delete grammar.rest;
			}

			_.matchGrammar(text, strarr, grammar, 0, 0, false);

			return strarr;
		},

		hooks: {
			all: {},

			add: function (name, callback) {
				var hooks = _.hooks.all;

				hooks[name] = hooks[name] || [];

				hooks[name].push(callback);
			},

			run: function (name, env) {
				var callbacks = _.hooks.all[name];

				if (!callbacks || !callbacks.length) {
					return;
				}

				for (var i=0, callback; callback = callbacks[i++];) {
					callback(env);
				}
			}
		}
	};

	var Token = _.Token = function(type, content, alias, matchedStr, greedy) {
		this.type = type;
		this.content = content;
		this.alias = alias;
		// Copy of the full string this token was created from
		this.length = (matchedStr || "").length|0;
		this.greedy = !!greedy;
	};

	Token.stringify = function(o, language, parent) {
		if (typeof o == 'string') {
			return o;
		}

		if (_.util.type(o) === 'Array') {
			return o.map(function(element) {
				return Token.stringify(element, language, o);
			}).join('');
		}

		var env = {
			type: o.type,
			content: Token.stringify(o.content, language, parent),
			tag: 'span',
			classes: ['token', o.type],
			attributes: {},
			language: language,
			parent: parent
		};

		if (o.alias) {
			var aliases = _.util.type(o.alias) === 'Array' ? o.alias : [o.alias];
			Array.prototype.push.apply(env.classes, aliases);
		}

		_.hooks.run('wrap', env);

		var attributes = Object.keys(env.attributes).map(function(name) {
			return name + '="' + (env.attributes[name] || '').replace(/"/g, '&quot;') + '"';
		}).join(' ');

		return '<' + env.tag + ' class="' + env.classes.join(' ') + '"' + (attributes ? ' ' + attributes : '') + '>' + env.content + '</' + env.tag + '>';

	};

	if (!_self.document) {
		if (!_self.addEventListener) {
			// in Node.js
			return _self.Prism;
		}

		if (!_.disableWorkerMessageHandler) {
			// In worker
			_self.addEventListener('message', function (evt) {
				var message = JSON.parse(evt.data),
					lang = message.language,
					code = message.code,
					immediateClose = message.immediateClose;

				_self.postMessage(_.highlight(code, _.languages[lang], lang));
				if (immediateClose) {
					_self.close();
				}
			}, false);
		}

		return _self.Prism;
	}

	//Get current script and highlight
	var script = document.currentScript || [].slice.call(document.getElementsByTagName("script")).pop();

	if (script) {
		_.filename = script.src;

		if (!_.manual && !script.hasAttribute('data-manual')) {
			if(document.readyState !== "loading") {
				if (window.requestAnimationFrame) {
					window.requestAnimationFrame(_.highlightAll);
				} else {
					window.setTimeout(_.highlightAll, 16);
				}
			}
			else {
				document.addEventListener('DOMContentLoaded', _.highlightAll);
			}
		}
	}

	return _self.Prism;

	})();

	if (typeof module !== 'undefined' && module.exports) {
		module.exports = Prism$1;
	}

	// hack for components to work correctly in node.js
	if (typeof global !== 'undefined') {
		global.Prism = Prism$1;
	}


	/* **********************************************
	     Begin prism-markup.js
	********************************************** */

	Prism$1.languages.markup = {
		'comment': /<!--[\s\S]*?-->/,
		'prolog': /<\?[\s\S]+?\?>/,
		'doctype': /<!DOCTYPE[\s\S]+?>/i,
		'cdata': /<!\[CDATA\[[\s\S]*?]]>/i,
		'tag': {
			pattern: /<\/?(?!\d)[^\s>\/=$<%]+(?:\s+[^\s>\/=]+(?:=(?:("|')(?:\\[\s\S]|(?!\1)[^\\])*\1|[^\s'">=]+))?)*\s*\/?>/i,
			greedy: true,
			inside: {
				'tag': {
					pattern: /^<\/?[^\s>\/]+/i,
					inside: {
						'punctuation': /^<\/?/,
						'namespace': /^[^\s>\/:]+:/
					}
				},
				'attr-value': {
					pattern: /=(?:("|')(?:\\[\s\S]|(?!\1)[^\\])*\1|[^\s'">=]+)/i,
					inside: {
						'punctuation': [
							/^=/,
							{
								pattern: /(^|[^\\])["']/,
								lookbehind: true
							}
						]
					}
				},
				'punctuation': /\/?>/,
				'attr-name': {
					pattern: /[^\s>\/]+/,
					inside: {
						'namespace': /^[^\s>\/:]+:/
					}
				}

			}
		},
		'entity': /&#?[\da-z]{1,8};/i
	};

	Prism$1.languages.markup['tag'].inside['attr-value'].inside['entity'] =
		Prism$1.languages.markup['entity'];

	// Plugin to make entity title show the real entity, idea by Roman Komarov
	Prism$1.hooks.add('wrap', function(env) {

		if (env.type === 'entity') {
			env.attributes['title'] = env.content.replace(/&amp;/, '&');
		}
	});

	Prism$1.languages.xml = Prism$1.languages.markup;
	Prism$1.languages.html = Prism$1.languages.markup;
	Prism$1.languages.mathml = Prism$1.languages.markup;
	Prism$1.languages.svg = Prism$1.languages.markup;


	/* **********************************************
	     Begin prism-css.js
	********************************************** */

	Prism$1.languages.css = {
		'comment': /\/\*[\s\S]*?\*\//,
		'atrule': {
			pattern: /@[\w-]+?.*?(?:;|(?=\s*\{))/i,
			inside: {
				'rule': /@[\w-]+/
				// See rest below
			}
		},
		'url': /url\((?:(["'])(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1|.*?)\)/i,
		'selector': /[^{}\s][^{};]*?(?=\s*\{)/,
		'string': {
			pattern: /("|')(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
			greedy: true
		},
		'property': /[-_a-z\xA0-\uFFFF][-\w\xA0-\uFFFF]*(?=\s*:)/i,
		'important': /\B!important\b/i,
		'function': /[-a-z0-9]+(?=\()/i,
		'punctuation': /[(){};:]/
	};

	Prism$1.languages.css['atrule'].inside.rest = Prism$1.languages.css;

	if (Prism$1.languages.markup) {
		Prism$1.languages.insertBefore('markup', 'tag', {
			'style': {
				pattern: /(<style[\s\S]*?>)[\s\S]*?(?=<\/style>)/i,
				lookbehind: true,
				inside: Prism$1.languages.css,
				alias: 'language-css',
				greedy: true
			}
		});

		Prism$1.languages.insertBefore('inside', 'attr-value', {
			'style-attr': {
				pattern: /\s*style=("|')(?:\\[\s\S]|(?!\1)[^\\])*\1/i,
				inside: {
					'attr-name': {
						pattern: /^\s*style/i,
						inside: Prism$1.languages.markup.tag.inside
					},
					'punctuation': /^\s*=\s*['"]|['"]\s*$/,
					'attr-value': {
						pattern: /.+/i,
						inside: Prism$1.languages.css
					}
				},
				alias: 'language-css'
			}
		}, Prism$1.languages.markup.tag);
	}

	/* **********************************************
	     Begin prism-clike.js
	********************************************** */

	Prism$1.languages.clike = {
		'comment': [
			{
				pattern: /(^|[^\\])\/\*[\s\S]*?(?:\*\/|$)/,
				lookbehind: true
			},
			{
				pattern: /(^|[^\\:])\/\/.*/,
				lookbehind: true,
				greedy: true
			}
		],
		'string': {
			pattern: /(["'])(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
			greedy: true
		},
		'class-name': {
			pattern: /((?:\b(?:class|interface|extends|implements|trait|instanceof|new)\s+)|(?:catch\s+\())[\w.\\]+/i,
			lookbehind: true,
			inside: {
				punctuation: /[.\\]/
			}
		},
		'keyword': /\b(?:if|else|while|do|for|return|in|instanceof|function|new|try|throw|catch|finally|null|break|continue)\b/,
		'boolean': /\b(?:true|false)\b/,
		'function': /[a-z0-9_]+(?=\()/i,
		'number': /\b0x[\da-f]+\b|(?:\b\d+\.?\d*|\B\.\d+)(?:e[+-]?\d+)?/i,
		'operator': /--?|\+\+?|!=?=?|<=?|>=?|==?=?|&&?|\|\|?|\?|\*|\/|~|\^|%/,
		'punctuation': /[{}[\];(),.:]/
	};


	/* **********************************************
	     Begin prism-javascript.js
	********************************************** */

	Prism$1.languages.javascript = Prism$1.languages.extend('clike', {
		'keyword': /\b(?:as|async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally|for|from|function|get|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|set|static|super|switch|this|throw|try|typeof|var|void|while|with|yield)\b/,
		'number': /\b(?:0[xX][\dA-Fa-f]+|0[bB][01]+|0[oO][0-7]+|NaN|Infinity)\b|(?:\b\d+\.?\d*|\B\.\d+)(?:[Ee][+-]?\d+)?/,
		// Allow for all non-ASCII characters (See http://stackoverflow.com/a/2008444)
		'function': /[_$a-z\xA0-\uFFFF][$\w\xA0-\uFFFF]*(?=\s*\()/i,
		'operator': /-[-=]?|\+[+=]?|!=?=?|<<?=?|>>?>?=?|=(?:==?|>)?|&[&=]?|\|[|=]?|\*\*?=?|\/=?|~|\^=?|%=?|\?|\.{3}/
	});

	Prism$1.languages.insertBefore('javascript', 'keyword', {
		'regex': {
			pattern: /((?:^|[^$\w\xA0-\uFFFF."'\])\s])\s*)\/(\[[^\]\r\n]+]|\\.|[^/\\\[\r\n])+\/[gimyu]{0,5}(?=\s*($|[\r\n,.;})\]]))/,
			lookbehind: true,
			greedy: true
		},
		// This must be declared before keyword because we use "function" inside the look-forward
		'function-variable': {
			pattern: /[_$a-z\xA0-\uFFFF][$\w\xA0-\uFFFF]*(?=\s*=\s*(?:function\b|(?:\([^()]*\)|[_$a-z\xA0-\uFFFF][$\w\xA0-\uFFFF]*)\s*=>))/i,
			alias: 'function'
		},
		'constant': /\b[A-Z][A-Z\d_]*\b/
	});

	Prism$1.languages.insertBefore('javascript', 'string', {
		'template-string': {
			pattern: /`(?:\\[\s\S]|\${[^}]+}|[^\\`])*`/,
			greedy: true,
			inside: {
				'interpolation': {
					pattern: /\${[^}]+}/,
					inside: {
						'interpolation-punctuation': {
							pattern: /^\${|}$/,
							alias: 'punctuation'
						},
						rest: null // See below
					}
				},
				'string': /[\s\S]+/
			}
		}
	});
	Prism$1.languages.javascript['template-string'].inside['interpolation'].inside.rest = Prism$1.languages.javascript;

	if (Prism$1.languages.markup) {
		Prism$1.languages.insertBefore('markup', 'tag', {
			'script': {
				pattern: /(<script[\s\S]*?>)[\s\S]*?(?=<\/script>)/i,
				lookbehind: true,
				inside: Prism$1.languages.javascript,
				alias: 'language-javascript',
				greedy: true
			}
		});
	}

	Prism$1.languages.js = Prism$1.languages.javascript;


	/* **********************************************
	     Begin prism-file-highlight.js
	********************************************** */

	(function () {
		if (typeof self === 'undefined' || !self.Prism || !self.document || !document.querySelector) {
			return;
		}

		self.Prism.fileHighlight = function() {

			var Extensions = {
				'js': 'javascript',
				'py': 'python',
				'rb': 'ruby',
				'ps1': 'powershell',
				'psm1': 'powershell',
				'sh': 'bash',
				'bat': 'batch',
				'h': 'c',
				'tex': 'latex'
			};

			Array.prototype.slice.call(document.querySelectorAll('pre[data-src]')).forEach(function (pre) {
				var src = pre.getAttribute('data-src');

				var language, parent = pre;
				var lang = /\blang(?:uage)?-([\w-]+)\b/i;
				while (parent && !lang.test(parent.className)) {
					parent = parent.parentNode;
				}

				if (parent) {
					language = (pre.className.match(lang) || [, ''])[1];
				}

				if (!language) {
					var extension = (src.match(/\.(\w+)$/) || [, ''])[1];
					language = Extensions[extension] || extension;
				}

				var code = document.createElement('code');
				code.className = 'language-' + language;

				pre.textContent = '';

				code.textContent = 'Loading…';

				pre.appendChild(code);

				var xhr = new XMLHttpRequest();

				xhr.open('GET', src, true);

				xhr.onreadystatechange = function () {
					if (xhr.readyState == 4) {

						if (xhr.status < 400 && xhr.responseText) {
							code.textContent = xhr.responseText;

							Prism$1.highlightElement(code);
						}
						else if (xhr.status >= 400) {
							code.textContent = '✖ Error ' + xhr.status + ' while fetching file: ' + xhr.statusText;
						}
						else {
							code.textContent = '✖ Error: File does not exist or is empty';
						}
					}
				};

				xhr.send(null);
			});

			if (Prism$1.plugins.toolbar) {
				Prism$1.plugins.toolbar.registerButton('download-file', function (env) {
					var pre = env.element.parentNode;
					if (!pre || !/pre/i.test(pre.nodeName) || !pre.hasAttribute('data-src') || !pre.hasAttribute('data-download-link')) {
						return;
					}
					var src = pre.getAttribute('data-src');
					var a = document.createElement('a');
					a.textContent = pre.getAttribute('data-download-link-label') || 'Download';
					a.setAttribute('download', '');
					a.href = src;
					return a;
				});
			}

		};

		document.addEventListener('DOMContentLoaded', self.Prism.fileHighlight);

	})();

	/**
	 * @license
	 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
	 * This code may only be used under the BSD style license found at
	 * http://polymer.github.io/LICENSE.txt
	 * The complete set of authors may be found at
	 * http://polymer.github.io/AUTHORS.txt
	 * The complete set of contributors may be found at
	 * http://polymer.github.io/CONTRIBUTORS.txt
	 * Code distributed by Google as part of the polymer project is also
	 * subject to an additional IP rights grant found at
	 * http://polymer.github.io/PATENTS.txt
	 */

	/**
	 * @license
	 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
	 * This code may only be used under the BSD style license found at
	 * http://polymer.github.io/LICENSE.txt
	 * The complete set of authors may be found at
	 * http://polymer.github.io/AUTHORS.txt
	 * The complete set of contributors may be found at
	 * http://polymer.github.io/CONTRIBUTORS.txt
	 * Code distributed by Google as part of the polymer project is also
	 * subject to an additional IP rights grant found at
	 * http://polymer.github.io/PATENTS.txt
	 */
	/**
	 * @module lit-html
	 */
	/**
	 * True if the custom elements polyfill is in use.
	 */
	const isCEPolyfill = window.customElements !== undefined &&
	    window.customElements.polyfillWrapFlushCallback !== undefined;

	/**
	 * @license
	 * Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
	 * This code may only be used under the BSD style license found at
	 * http://polymer.github.io/LICENSE.txt
	 * The complete set of authors may be found at
	 * http://polymer.github.io/AUTHORS.txt
	 * The complete set of contributors may be found at
	 * http://polymer.github.io/CONTRIBUTORS.txt
	 * Code distributed by Google as part of the polymer project is also
	 * subject to an additional IP rights grant found at
	 * http://polymer.github.io/PATENTS.txt
	 */

	/**
	 * @license
	 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
	 * This code may only be used under the BSD style license found at
	 * http://polymer.github.io/LICENSE.txt
	 * The complete set of authors may be found at
	 * http://polymer.github.io/AUTHORS.txt
	 * The complete set of contributors may be found at
	 * http://polymer.github.io/CONTRIBUTORS.txt
	 * Code distributed by Google as part of the polymer project is also
	 * subject to an additional IP rights grant found at
	 * http://polymer.github.io/PATENTS.txt
	 */
	/**
	 * An expression marker with embedded unique key to avoid collision with
	 * possible text in templates.
	 */
	const marker = `{{lit-${String(Math.random()).slice(2)}}}`;

	/**
	 * @license
	 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
	 * This code may only be used under the BSD style license found at
	 * http://polymer.github.io/LICENSE.txt
	 * The complete set of authors may be found at
	 * http://polymer.github.io/AUTHORS.txt
	 * The complete set of contributors may be found at
	 * http://polymer.github.io/CONTRIBUTORS.txt
	 * Code distributed by Google as part of the polymer project is also
	 * subject to an additional IP rights grant found at
	 * http://polymer.github.io/PATENTS.txt
	 */

	/**
	 * @license
	 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
	 * This code may only be used under the BSD style license found at
	 * http://polymer.github.io/LICENSE.txt
	 * The complete set of authors may be found at
	 * http://polymer.github.io/AUTHORS.txt
	 * The complete set of contributors may be found at
	 * http://polymer.github.io/CONTRIBUTORS.txt
	 * Code distributed by Google as part of the polymer project is also
	 * subject to an additional IP rights grant found at
	 * http://polymer.github.io/PATENTS.txt
	 */

	/**
	 * @license
	 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
	 * This code may only be used under the BSD style license found at
	 * http://polymer.github.io/LICENSE.txt
	 * The complete set of authors may be found at
	 * http://polymer.github.io/AUTHORS.txt
	 * The complete set of contributors may be found at
	 * http://polymer.github.io/CONTRIBUTORS.txt
	 * Code distributed by Google as part of the polymer project is also
	 * subject to an additional IP rights grant found at
	 * http://polymer.github.io/PATENTS.txt
	 */
	try {
	    const options = {
	        get capture() {
	            return false;
	        }
	    };
	    window.addEventListener('test', options, options);
	    window.removeEventListener('test', options, options);
	}
	catch (_e) {
	}

	/**
	 * @license
	 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
	 * This code may only be used under the BSD style license found at
	 * http://polymer.github.io/LICENSE.txt
	 * The complete set of authors may be found at
	 * http://polymer.github.io/AUTHORS.txt
	 * The complete set of contributors may be found at
	 * http://polymer.github.io/CONTRIBUTORS.txt
	 * Code distributed by Google as part of the polymer project is also
	 * subject to an additional IP rights grant found at
	 * http://polymer.github.io/PATENTS.txt
	 */

	/**
	 * @license
	 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
	 * This code may only be used under the BSD style license found at
	 * http://polymer.github.io/LICENSE.txt
	 * The complete set of authors may be found at
	 * http://polymer.github.io/AUTHORS.txt
	 * The complete set of contributors may be found at
	 * http://polymer.github.io/CONTRIBUTORS.txt
	 * Code distributed by Google as part of the polymer project is also
	 * subject to an additional IP rights grant found at
	 * http://polymer.github.io/PATENTS.txt
	 */

	/**
	 * @license
	 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
	 * This code may only be used under the BSD style license found at
	 * http://polymer.github.io/LICENSE.txt
	 * The complete set of authors may be found at
	 * http://polymer.github.io/AUTHORS.txt
	 * The complete set of contributors may be found at
	 * http://polymer.github.io/CONTRIBUTORS.txt
	 * Code distributed by Google as part of the polymer project is also
	 * subject to an additional IP rights grant found at
	 * http://polymer.github.io/PATENTS.txt
	 */

	/**
	 * @license
	 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
	 * This code may only be used under the BSD style license found at
	 * http://polymer.github.io/LICENSE.txt
	 * The complete set of authors may be found at
	 * http://polymer.github.io/AUTHORS.txt
	 * The complete set of contributors may be found at
	 * http://polymer.github.io/CONTRIBUTORS.txt
	 * Code distributed by Google as part of the polymer project is also
	 * subject to an additional IP rights grant found at
	 * http://polymer.github.io/PATENTS.txt
	 */

	/**
	 * @license
	 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
	 * This code may only be used under the BSD style license found at
	 * http://polymer.github.io/LICENSE.txt
	 * The complete set of authors may be found at
	 * http://polymer.github.io/AUTHORS.txt
	 * The complete set of contributors may be found at
	 * http://polymer.github.io/CONTRIBUTORS.txt
	 * Code distributed by Google as part of the polymer project is also
	 * subject to an additional IP rights grant found at
	 * http://polymer.github.io/PATENTS.txt
	 */

	/**
	 * @license
	 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
	 * This code may only be used under the BSD style license found at
	 * http://polymer.github.io/LICENSE.txt
	 * The complete set of authors may be found at
	 * http://polymer.github.io/AUTHORS.txt
	 * The complete set of contributors may be found at
	 * http://polymer.github.io/CONTRIBUTORS.txt
	 * Code distributed by Google as part of the polymer project is also
	 * subject to an additional IP rights grant found at
	 * http://polymer.github.io/PATENTS.txt
	 */
	if (typeof window.ShadyCSS === 'undefined') ;
	else if (typeof window.ShadyCSS.prepareTemplateDom === 'undefined') {
	    console.warn(`Incompatible ShadyCSS version detected.` +
	        `Please update to at least @webcomponents/webcomponentsjs@2.0.2 and` +
	        `@webcomponents/shadycss@1.3.1.`);
	}

	/**
	 * @license
	 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
	 * This code may only be used under the BSD style license found at
	 * http://polymer.github.io/LICENSE.txt
	 * The complete set of authors may be found at
	 * http://polymer.github.io/AUTHORS.txt
	 * The complete set of contributors may be found at
	 * http://polymer.github.io/CONTRIBUTORS.txt
	 * Code distributed by Google as part of the polymer project is also
	 * subject to an additional IP rights grant found at
	 * http://polymer.github.io/PATENTS.txt
	 */
	// serializer/deserializers for boolean attribute
	const fromBooleanAttribute = (value) => value !== null;
	const toBooleanAttribute = (value) => value ? '' : null;
	/**
	 * Change function that returns true if `value` is different from `oldValue`.
	 * This method is used as the default for a property's `hasChanged` function.
	 */
	const notEqual = (value, old) => {
	    // This ensures (old==NaN, value==NaN) always returns false
	    return old !== value && (old === old || value === value);
	};
	const defaultPropertyDeclaration = {
	    attribute: true,
	    type: String,
	    reflect: false,
	    hasChanged: notEqual
	};
	const microtaskPromise = new Promise((resolve) => resolve(true));
	const STATE_HAS_UPDATED = 1;
	const STATE_UPDATE_REQUESTED = 1 << 2;
	const STATE_IS_REFLECTING = 1 << 3;
	/**
	 * Base element class which manages element properties and attributes. When
	 * properties change, the `update` method is asynchronously called. This method
	 * should be supplied by subclassers to render updates as desired.
	 */
	class UpdatingElement extends HTMLElement {
	    constructor() {
	        super();
	        this._updateState = 0;
	        this._instanceProperties = undefined;
	        this._updatePromise = microtaskPromise;
	        /**
	         * Map with keys for any properties that have changed since the last
	         * update cycle with previous values.
	         */
	        this._changedProperties = new Map();
	        /**
	         * Map with keys of properties that should be reflected when updated.
	         */
	        this._reflectingProperties = undefined;
	        this.initialize();
	    }
	    /**
	     * Returns a list of attributes corresponding to the registered properties.
	     */
	    static get observedAttributes() {
	        // note: piggy backing on this to ensure we're _finalized.
	        this._finalize();
	        const attributes = [];
	        for (const [p, v] of this._classProperties) {
	            const attr = this._attributeNameForProperty(p, v);
	            if (attr !== undefined) {
	                this._attributeToPropertyMap.set(attr, p);
	                attributes.push(attr);
	            }
	        }
	        return attributes;
	    }
	    /**
	     * Creates a property accessor on the element prototype if one does not exist.
	     * The property setter calls the property's `hasChanged` property option
	     * or uses a strict identity check to determine whether or not to request
	     * an update.
	     */
	    static createProperty(name, options = defaultPropertyDeclaration) {
	        // ensure private storage for property declarations.
	        if (!this.hasOwnProperty('_classProperties')) {
	            this._classProperties = new Map();
	            // NOTE: Workaround IE11 not supporting Map constructor argument.
	            const superProperties = Object.getPrototypeOf(this)._classProperties;
	            if (superProperties !== undefined) {
	                superProperties.forEach((v, k) => this._classProperties.set(k, v));
	            }
	        }
	        this._classProperties.set(name, options);
	        // Allow user defined accessors by not replacing an existing own-property
	        // accessor.
	        if (this.prototype.hasOwnProperty(name)) {
	            return;
	        }
	        const key = typeof name === 'symbol' ? Symbol() : `__${name}`;
	        Object.defineProperty(this.prototype, name, {
	            get() { return this[key]; },
	            set(value) {
	                const oldValue = this[name];
	                this[key] = value;
	                this._requestPropertyUpdate(name, oldValue, options);
	            },
	            configurable: true,
	            enumerable: true
	        });
	    }
	    /**
	     * Creates property accessors for registered properties and ensures
	     * any superclasses are also finalized.
	     */
	    static _finalize() {
	        if (this.hasOwnProperty('_finalized') && this._finalized) {
	            return;
	        }
	        // finalize any superclasses
	        const superCtor = Object.getPrototypeOf(this);
	        if (typeof superCtor._finalize === 'function') {
	            superCtor._finalize();
	        }
	        this._finalized = true;
	        // initialize Map populated in observedAttributes
	        this._attributeToPropertyMap = new Map();
	        // make any properties
	        const props = this.properties;
	        // support symbols in properties (IE11 does not support this)
	        const propKeys = [
	            ...Object.getOwnPropertyNames(props),
	            ...(typeof Object.getOwnPropertySymbols === 'function')
	                ? Object.getOwnPropertySymbols(props)
	                : []
	        ];
	        for (const p of propKeys) {
	            // note, use of `any` is due to TypeSript lack of support for symbol in
	            // index types
	            this.createProperty(p, props[p]);
	        }
	    }
	    /**
	     * Returns the property name for the given attribute `name`.
	     */
	    static _attributeNameForProperty(name, options) {
	        const attribute = options !== undefined && options.attribute;
	        return attribute === false
	            ? undefined
	            : (typeof attribute === 'string'
	                ? attribute
	                : (typeof name === 'string' ? name.toLowerCase()
	                    : undefined));
	    }
	    /**
	     * Returns true if a property should request an update.
	     * Called when a property value is set and uses the `hasChanged`
	     * option for the property if present or a strict identity check.
	     */
	    static _valueHasChanged(value, old, hasChanged = notEqual) {
	        return hasChanged(value, old);
	    }
	    /**
	     * Returns the property value for the given attribute value.
	     * Called via the `attributeChangedCallback` and uses the property's `type`
	     * or `type.fromAttribute` property option.
	     */
	    static _propertyValueFromAttribute(value, options) {
	        const type = options && options.type;
	        if (type === undefined) {
	            return value;
	        }
	        // Note: special case `Boolean` so users can use it as a `type`.
	        const fromAttribute = type === Boolean
	            ? fromBooleanAttribute
	            : (typeof type === 'function' ? type : type.fromAttribute);
	        return fromAttribute ? fromAttribute(value) : value;
	    }
	    /**
	     * Returns the attribute value for the given property value. If this
	     * returns undefined, the property will *not* be reflected to an attribute.
	     * If this returns null, the attribute will be removed, otherwise the
	     * attribute will be set to the value.
	     * This uses the property's `reflect` and `type.toAttribute` property options.
	     */
	    static _propertyValueToAttribute(value, options) {
	        if (options === undefined || options.reflect === undefined) {
	            return;
	        }
	        // Note: special case `Boolean` so users can use it as a `type`.
	        const toAttribute = options.type === Boolean
	            ? toBooleanAttribute
	            : (options.type &&
	                options.type.toAttribute ||
	                String);
	        return toAttribute(value);
	    }
	    /**
	     * Performs element initialization. By default this calls `createRenderRoot`
	     * to create the element `renderRoot` node and captures any pre-set values for
	     * registered properties.
	     */
	    initialize() {
	        this.renderRoot = this.createRenderRoot();
	        this._saveInstanceProperties();
	    }
	    /**
	     * Fixes any properties set on the instance before upgrade time.
	     * Otherwise these would shadow the accessor and break these properties.
	     * The properties are stored in a Map which is played back after the
	     * constructor runs. Note, on very old versions of Safari (<=9) or Chrome
	     * (<=41), properties created for native platform properties like (`id` or
	     * `name`) may not have default values set in the element constructor. On
	     * these browsers native properties appear on instances and therefore their
	     * default value will overwrite any element default (e.g. if the element sets
	     * this.id = 'id' in the constructor, the 'id' will become '' since this is
	     * the native platform default).
	     */
	    _saveInstanceProperties() {
	        for (const [p] of this.constructor
	            ._classProperties) {
	            if (this.hasOwnProperty(p)) {
	                const value = this[p];
	                delete this[p];
	                if (!this._instanceProperties) {
	                    this._instanceProperties = new Map();
	                }
	                this._instanceProperties.set(p, value);
	            }
	        }
	    }
	    /**
	     * Applies previously saved instance properties.
	     */
	    _applyInstanceProperties() {
	        for (const [p, v] of this._instanceProperties) {
	            this[p] = v;
	        }
	        this._instanceProperties = undefined;
	    }
	    /**
	     * Returns the node into which the element should render and by default
	     * creates and returns an open shadowRoot. Implement to customize where the
	     * element's DOM is rendered. For example, to render into the element's
	     * childNodes, return `this`.
	     * @returns {Element|DocumentFragment} Returns a node into which to render.
	     */
	    createRenderRoot() {
	        return this.attachShadow({ mode: 'open' });
	    }
	    /**
	     * Uses ShadyCSS to keep element DOM updated.
	     */
	    connectedCallback() {
	        if ((this._updateState & STATE_HAS_UPDATED)) {
	            if (window.ShadyCSS !== undefined) {
	                window.ShadyCSS.styleElement(this);
	            }
	        }
	        else {
	            this.requestUpdate();
	        }
	    }
	    /**
	     * Allows for `super.disconnectedCallback()` in extensions while
	     * reserving the possibility of making non-breaking feature additions
	     * when disconnecting at some point in the future.
	     */
	    disconnectedCallback() { }
	    /**
	     * Synchronizes property values when attributes change.
	     */
	    attributeChangedCallback(name, old, value) {
	        if (old !== value) {
	            this._attributeToProperty(name, value);
	        }
	    }
	    _propertyToAttribute(name, value, options = defaultPropertyDeclaration) {
	        const ctor = this.constructor;
	        const attrValue = ctor._propertyValueToAttribute(value, options);
	        if (attrValue !== undefined) {
	            const attr = ctor._attributeNameForProperty(name, options);
	            if (attr !== undefined) {
	                // Track if the property is being reflected to avoid
	                // setting the property again via `attributeChangedCallback`. Note:
	                // 1. this takes advantage of the fact that the callback is synchronous.
	                // 2. will behave incorrectly if multiple attributes are in the reaction
	                // stack at time of calling. However, since we process attributes
	                // in `update` this should not be possible (or an extreme corner case
	                // that we'd like to discover).
	                // mark state reflecting
	                this._updateState = this._updateState | STATE_IS_REFLECTING;
	                if (attrValue === null) {
	                    this.removeAttribute(attr);
	                }
	                else {
	                    this.setAttribute(attr, attrValue);
	                }
	                // mark state not reflecting
	                this._updateState = this._updateState & ~STATE_IS_REFLECTING;
	            }
	        }
	    }
	    _attributeToProperty(name, value) {
	        // Use tracking info to avoid deserializing attribute value if it was
	        // just set from a property setter.
	        if (!(this._updateState & STATE_IS_REFLECTING)) {
	            const ctor = this.constructor;
	            const propName = ctor._attributeToPropertyMap.get(name);
	            if (propName !== undefined) {
	                const options = ctor._classProperties.get(propName);
	                this[propName] =
	                    ctor._propertyValueFromAttribute(value, options);
	            }
	        }
	    }
	    /**
	     * Requests an update which is processed asynchronously. This should
	     * be called when an element should update based on some state not triggered
	     * by setting a property. In this case, pass no arguments. It should also be
	     * called when manually implementing a property setter. In this case, pass the
	     * property `name` and `oldValue` to ensure that any configured property
	     * options are honored. Returns the `updateComplete` Promise which is resolved
	     * when the update completes.
	     *
	     * @param name {PropertyKey} (optional) name of requesting property
	     * @param oldValue {any} (optional) old value of requesting property
	     * @returns {Promise} A Promise that is resolved when the update completes.
	     */
	    requestUpdate(name, oldValue) {
	        if (name !== undefined) {
	            const options = this.constructor
	                ._classProperties.get(name) ||
	                defaultPropertyDeclaration;
	            return this._requestPropertyUpdate(name, oldValue, options);
	        }
	        return this._invalidate();
	    }
	    /**
	     * Requests an update for a specific property and records change information.
	     * @param name {PropertyKey} name of requesting property
	     * @param oldValue {any} old value of requesting property
	     * @param options {PropertyDeclaration}
	     */
	    _requestPropertyUpdate(name, oldValue, options) {
	        if (!this.constructor
	            ._valueHasChanged(this[name], oldValue, options.hasChanged)) {
	            return this.updateComplete;
	        }
	        // track old value when changing.
	        if (!this._changedProperties.has(name)) {
	            this._changedProperties.set(name, oldValue);
	        }
	        // add to reflecting properties set
	        if (options.reflect === true) {
	            if (this._reflectingProperties === undefined) {
	                this._reflectingProperties = new Map();
	            }
	            this._reflectingProperties.set(name, options);
	        }
	        return this._invalidate();
	    }
	    /**
	     * Invalidates the element causing it to asynchronously update regardless
	     * of whether or not any property changes are pending. This method is
	     * automatically called when any registered property changes.
	     */
	    async _invalidate() {
	        if (!this._hasRequestedUpdate) {
	            // mark state updating...
	            this._updateState = this._updateState | STATE_UPDATE_REQUESTED;
	            let resolver;
	            const previousValidatePromise = this._updatePromise;
	            this._updatePromise = new Promise((r) => resolver = r);
	            await previousValidatePromise;
	            this._validate();
	            resolver(!this._hasRequestedUpdate);
	        }
	        return this.updateComplete;
	    }
	    get _hasRequestedUpdate() {
	        return (this._updateState & STATE_UPDATE_REQUESTED);
	    }
	    /**
	     * Validates the element by updating it.
	     */
	    _validate() {
	        // Mixin instance properties once, if they exist.
	        if (this._instanceProperties) {
	            this._applyInstanceProperties();
	        }
	        if (this.shouldUpdate(this._changedProperties)) {
	            const changedProperties = this._changedProperties;
	            this.update(changedProperties);
	            this._markUpdated();
	            if (!(this._updateState & STATE_HAS_UPDATED)) {
	                this._updateState = this._updateState | STATE_HAS_UPDATED;
	                this.firstUpdated(changedProperties);
	            }
	            this.updated(changedProperties);
	        }
	        else {
	            this._markUpdated();
	        }
	    }
	    _markUpdated() {
	        this._changedProperties = new Map();
	        this._updateState = this._updateState & ~STATE_UPDATE_REQUESTED;
	    }
	    /**
	     * Returns a Promise that resolves when the element has completed updating.
	     * The Promise value is a boolean that is `true` if the element completed the
	     * update without triggering another update. The Promise result is `false` if
	     * a property was set inside `updated()`. This getter can be implemented to
	     * await additional state. For example, it is sometimes useful to await a
	     * rendered element before fulfilling this Promise. To do this, first await
	     * `super.updateComplete` then any subsequent state.
	     *
	     * @returns {Promise} The Promise returns a boolean that indicates if the
	     * update resolved without triggering another update.
	     */
	    get updateComplete() { return this._updatePromise; }
	    /**
	     * Controls whether or not `update` should be called when the element requests
	     * an update. By default, this method always returns `true`, but this can be
	     * customized to control when to update.
	     *
	     * * @param _changedProperties Map of changed properties with old values
	     */
	    shouldUpdate(_changedProperties) {
	        return true;
	    }
	    /**
	     * Updates the element. This method reflects property values to attributes.
	     * It can be overridden to render and keep updated DOM in the element's
	     * `renderRoot`. Setting properties inside this method will *not* trigger
	     * another update.
	     *
	     * * @param _changedProperties Map of changed properties with old values
	     */
	    update(_changedProperties) {
	        if (this._reflectingProperties !== undefined &&
	            this._reflectingProperties.size > 0) {
	            for (const [k, v] of this._reflectingProperties) {
	                this._propertyToAttribute(k, this[k], v);
	            }
	            this._reflectingProperties = undefined;
	        }
	    }
	    /**
	     * Invoked whenever the element is updated. Implement to perform
	     * post-updating tasks via DOM APIs, for example, focusing an element.
	     *
	     * Setting properties inside this method will trigger the element to update
	     * again after this update cycle completes.
	     *
	     * * @param _changedProperties Map of changed properties with old values
	     */
	    updated(_changedProperties) { }
	    /**
	     * Invoked when the element is first updated. Implement to perform one time
	     * work on the element after update.
	     *
	     * Setting properties inside this method will trigger the element to update
	     * again after this update cycle completes.
	     *
	     * * @param _changedProperties Map of changed properties with old values
	     */
	    firstUpdated(_changedProperties) { }
	}
	/**
	 * Maps attribute names to properties; for example `foobar` attribute
	 * to `fooBar` property.
	 */
	UpdatingElement._attributeToPropertyMap = new Map();
	/**
	 * Marks class as having finished creating properties.
	 */
	UpdatingElement._finalized = true;
	/**
	 * Memoized list of all class properties, including any superclass properties.
	 */
	UpdatingElement._classProperties = new Map();
	UpdatingElement.properties = {};

	/**
	 * @license
	 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
	 * This code may only be used under the BSD style license found at
	 * http://polymer.github.io/LICENSE.txt
	 * The complete set of authors may be found at
	 * http://polymer.github.io/AUTHORS.txt
	 * The complete set of contributors may be found at
	 * http://polymer.github.io/CONTRIBUTORS.txt
	 * Code distributed by Google as part of the polymer project is also
	 * subject to an additional IP rights grant found at
	 * http://polymer.github.io/PATENTS.txt
	 */
	/**
	 * A property decorator which creates a LitElement property which reflects a
	 * corresponding attribute value. A `PropertyDeclaration` may optionally be
	 * supplied to configure property features.
	 */
	const property = (options) => (proto, name) => {
	    proto.constructor.createProperty(name, options);
	};

	/**
	 * @license
	 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
	 * This code may only be used under the BSD style license found at
	 * http://polymer.github.io/LICENSE.txt
	 * The complete set of authors may be found at
	 * http://polymer.github.io/AUTHORS.txt
	 * The complete set of contributors may be found at
	 * http://polymer.github.io/CONTRIBUTORS.txt
	 * Code distributed by Google as part of the polymer project is also
	 * subject to an additional IP rights grant found at
	 * http://polymer.github.io/PATENTS.txt
	 */

	var __decorate = (undefined && undefined.__decorate) || function (decorators, target, key, desc) {
	    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
	    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
	    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
	    return c > 3 && r && Object.defineProperty(target, key, r), r;
	};
	const EMPTY_ATTRIBUTE_RE = /([\w-]+)=\"\"/g;
	class ExampleSnippet extends UpdatingElement {
	    constructor() {
	        super(...arguments);
	        this.useShadowRoot = false;
	        this.stampTo = null;
	        this.template = null;
	        this.highlightAs = 'markup';
	        this.preserveWhitespace = false;
	        this.stamped = false;
	    }
	    stamp() {
	        if (this.stampTo == null || this.template == null) {
	            return;
	        }
	        const root = this.getRootNode();
	        const stampTarget = root.getElementById(this.stampTo);
	        if (stampTarget != null) {
	            let parentNode;
	            if (this.useShadowRoot) {
	                if (stampTarget.shadowRoot == null) {
	                    stampTarget.attachShadow({ mode: 'open' });
	                }
	                parentNode = stampTarget.shadowRoot;
	            }
	            else {
	                parentNode = stampTarget;
	            }
	            const { template, highlightAs } = this;
	            const content = template.content.cloneNode(true);
	            parentNode.appendChild(content);
	            const pre = document.createElement('pre');
	            const code = document.createElement('code');
	            pre.appendChild(code);
	            let snippet = template.innerHTML;
	            if (!this.preserveWhitespace) {
	                snippet = snippet.trim();
	            }
	            if (highlightAs === 'html') {
	                snippet = snippet.replace(EMPTY_ATTRIBUTE_RE, '$1');
	            }
	            const highlighted = Prism.highlight(snippet, Prism.languages[highlightAs], highlightAs);
	            code.innerHTML = highlighted;
	            this.appendChild(pre);
	        }
	    }
	    connectedCallback() {
	        super.connectedCallback && super.connectedCallback();
	        this.template = this.querySelector('template');
	    }
	    createRenderRoot() {
	        return this;
	    }
	    updated(changedProperties) {
	        super.updated(changedProperties);
	        if (!this.stamped &&
	            (changedProperties.has('stamp-to') ||
	                changedProperties.has('template')) &&
	            this.template != null && this.stampTo != null) {
	            this.stamp();
	        }
	    }
	}
	__decorate([
	    property({ type: Boolean, attribute: 'use-shadow-root' })
	], ExampleSnippet.prototype, "useShadowRoot", void 0);
	__decorate([
	    property({ type: String, attribute: 'stamp-to' })
	], ExampleSnippet.prototype, "stampTo", void 0);
	__decorate([
	    property({ type: Object })
	], ExampleSnippet.prototype, "template", void 0);
	__decorate([
	    property({ type: String, attribute: 'highlight-as' })
	], ExampleSnippet.prototype, "highlightAs", void 0);
	__decorate([
	    property({ type: Boolean })
	], ExampleSnippet.prototype, "preserveWhitespace", void 0);
	customElements.define('example-snippet', ExampleSnippet);

	exports.ExampleSnippet = ExampleSnippet;

	Object.defineProperty(exports, '__esModule', { value: true });

})));
