| server classServer serverVersion |

"Ensure Pharo-LanguageServer is installed (PLSServer class exists)."
(Smalltalk at: #PLSServer ifAbsent: [ nil ]) ifNil: [
	"The extension gives the release to load from its setting `pharo quick install.server version`."
	serverVersion := Smalltalk os environment at: 'PLS_SERVER_VERSION' ifAbsent: [ '' ].
	serverVersion isEmpty ifTrue: [ serverVersion := '6.0.0-alpha.1' ].
	Metacello new
		githubUser: 'badetitou' project: 'Pharo-LanguageServer' commitish: serverVersion path: 'src';
		baseline: 'PharoLanguageServer';
		load.

	"Persist installation to avoid reloading on next start."
	Smalltalk snapshot: true andQuit: false.
].

classServer := Smalltalk at: #PLSServer ifAbsent: [ nil ].
classServer reset.
server := classServer new.
server start.