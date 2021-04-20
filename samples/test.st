Object.
hello := true.	"true"
hello
	ifFalse: [  ]
	ifTrue: [  ].
self halt.
1 + 1.
Object.
Transcript crShow.
true
	ifTrue: [  ]
	ifFalse: [  ].
server := PLSServer.	"PLSServer"

myClass := MyClass new
	myVar2: (MyClass new myVar2: (MyClass new));
	yourself.
	 "a MyClass" 
self halt