| hello myClass server |

Object.
hello := true.
hello
	ifFalse: [  ]
	ifTrue: [  ].
self halt.
1 + 1.
self inform: 'Hello'.
Object.
Transcript crShow: 'Hello'.
true
	ifTrue: [  ]
	ifFalse: [  ].
server := PLSServer.

myClass := MyClass new
	myVar2: (MyClass new myVar2: (MyClass new));
	yourself.
myClass helloWorld.
self halt