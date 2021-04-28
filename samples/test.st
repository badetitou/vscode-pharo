Object.
hello := true.
hello
	ifFalse: [  ]
	ifTrue: [  ].
'To halt' record.
self halt.
1 + 1.
self inform: 'hello world'.
Object.
Transcript crShow: 'Hello'.
true
	ifTrue: [  ]
	ifFalse: [  ].
server := PLSServer.

myClass := MyClass new
	myVar2: (MyClass new myVar2: (MyClass new));
	yourself.
self halt