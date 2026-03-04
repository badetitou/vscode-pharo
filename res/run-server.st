| server classServer |

"Ensure Pharo-LanguageServer is installed (PLSServer class exists)."
(Smalltalk at: #PLSServer ifAbsent: [ nil ]) ifNil: [
	Metacello new
		githubUser: 'badetitou' project: 'Pharo-LanguageServer' commitish: '5.1.0' path: 'src';
		baseline: 'PharoLanguageServer';
		load.

	"Persist installation to avoid reloading on next start."
	Smalltalk snapshot: true andQuit: false.
].

classServer := Smalltalk at: #PLSServer ifAbsent: [ nil ].
classServer reset.
server := classServer new.
server start.